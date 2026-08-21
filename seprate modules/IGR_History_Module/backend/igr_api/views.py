import os
import uuid
import logging
import threading
import re
import datetime
from django.db import connection, transaction, close_old_connections
from django.db.models import F
import concurrent.futures
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Property, WorkflowRun, SourceRun
from .serializers import PropertySerializer, WorkflowRunSerializer, SourceRunSerializer

from scrapers.igr.workflow import IGRInput, IGRWorkflow, IGRResult
from scrapers.igr.constants import FIELD_DISTRICT, FIELD_TALUKA, FIELD_VILLAGE

logger = logging.getLogger("igr_django_api")

# Simple in-memory cache for locations
LOCATIONS_CACHE = {
    "districts": [],
    "talukas": {},
    "villages": {}
}

FALLBACK_DISTRICTS = [
    {"value": "1", "label": "पुणे / Pune"},
    {"value": "2", "label": "सातारा / Satara"},
    {"value": "3", "label": "सांगली / Sangli"},
    {"value": "4", "label": "कोल्हापूर / Kolhapur"},
    {"value": "5", "label": "सोलापूर / Solapur"},
    {"value": "6", "label": "ठाणे / Thane"},
    {"value": "7", "label": "पालघर / Palghar"},
    {"value": "8", "label": "रायगड / Raigad"},
    {"value": "9", "label": "रत्नागिरी / Ratnagiri"},
    {"value": "10", "label": "सिंधुदुर्ग / Sindhudurg"},
    {"value": "11", "label": "नाशिक / Nashik"},
    {"value": "12", "label": "धुळे / Dhule"},
    {"value": "13", "label": "जळगाव / Jalgaon"},
    {"value": "14", "label": "अहमदनगर / Ahmednagar"},
    {"value": "15", "label": "नंदुरबार / Nandurbar"},
    {"value": "16", "label": "छत्रपती संभाजीनगर (औरंगाबाद) / Chhatrapati Sambhajinagar"},
    {"value": "17", "label": "जालना / Jalna"},
    {"value": "18", "label": "परभणी / Parbhani"},
    {"value": "19", "label": "बीड / Beed"},
    {"value": "20", "label": "नांदेड / Nanded"},
    {"value": "21", "label": "धाराशिव (उस्मानाबाद) / Dharashiv"},
    {"value": "22", "label": "लातूर / Latur"},
    {"value": "23", "label": "हिंगोली / Hingoli"},
    {"value": "24", "label": "अमरावती / Amravati"},
    {"value": "25", "label": "बुलढाणा / Buldhana"},
    {"value": "26", "label": "अकोला / Akola"},
    {"value": "27", "label": "वाशिम / Washim"},
    {"value": "28", "label": "यवतमाळ / Yavatmal"},
    {"value": "29", "label": "नागपूर / Nagpur"},
    {"value": "30", "label": "मुंबई शहर / Mumbai City"},
    {"value": "31", "label": "मुंबई उपनगर / Mumbai Suburban"},
    {"value": "32", "label": "वर्धा / Wardha"},
    {"value": "33", "label": "भंडारा / Bhandara"},
    {"value": "34", "label": "गोंदिया / Gondia"},
    {"value": "35", "label": "चंद्रपूर / Chandrapur"},
    {"value": "36", "label": "गडचिरोली / Gadchiroli"},
]

# Helper to fetch dropdown options using the scraper
def fetch_igr_dropdown_options(district_code=None, taluka_code=None):
    try:
        workflow = IGRWorkflow(
            igr_input=IGRInput(
                district=district_code or "interactive",
                taluka=taluka_code or "interactive",
                village="interactive",
                property_number="1",
                year=2025,
            ),
            artifact_root="runs_igr",
        )
        workflow.initialize()

        if not district_code:
            districts = workflow.client.fetch_dropdown(FIELD_DISTRICT)
            if districts:
                return [{"value": val, "label": lbl} for val, lbl in districts.items()]
            return FALLBACK_DISTRICTS

        workflow.select_district(district_code)
        if not taluka_code:
            talukas = workflow.client.fetch_dropdown(FIELD_TALUKA)
            return [{"value": val, "label": lbl} for val, lbl in talukas.items()]

        workflow.select_taluka(taluka_code)
        villages = workflow.client.fetch_dropdown(FIELD_VILLAGE)
        return [{"value": val, "label": lbl} for val, lbl in villages.items()]
    except Exception as e:
        logger.error(f"Error fetching live IGR locations: {e}", exc_info=True)
        if not district_code:
            logger.info("Returning fallback district list")
            return FALLBACK_DISTRICTS
        raise ValueError(f"Failed to fetch locations from IGR server: {str(e)}")


# ----------------------------------------------------
# Location Lookups
# ----------------------------------------------------
@api_view(['GET'])
def get_districts(request):
    try:
        if not LOCATIONS_CACHE["districts"]:
            LOCATIONS_CACHE["districts"] = fetch_igr_dropdown_options()
        return Response(LOCATIONS_CACHE["districts"])
    except Exception as e:
        return Response(FALLBACK_DISTRICTS)


@api_view(['GET'])
def get_talukas(request):
    district_code = request.query_params.get('district_code')
    if not district_code:
        return Response({"error": "district_code param is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        if district_code not in LOCATIONS_CACHE["talukas"]:
            LOCATIONS_CACHE["talukas"][district_code] = fetch_igr_dropdown_options(district_code=district_code)
        return Response(LOCATIONS_CACHE["talukas"][district_code])
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_villages(request):
    district_code = request.query_params.get('district_code')
    taluka_code = request.query_params.get('taluka_code')
    if not district_code or not taluka_code:
        return Response({"error": "district_code and taluka_code are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    cache_key = f"{district_code}_{taluka_code}"
    try:
        if cache_key not in LOCATIONS_CACHE["villages"]:
            LOCATIONS_CACHE["villages"][cache_key] = fetch_igr_dropdown_options(district_code=district_code, taluka_code=taluka_code)
        return Response(LOCATIONS_CACHE["villages"][cache_key])
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ----------------------------------------------------
# Scraper Background Runner
# ----------------------------------------------------
def scrape_single_year(workflow_id, property_id, year):
    close_old_connections()
    source_run_id = f"sr-{uuid.uuid4().hex[:8]}"
    try:
        # Load db records locally in thread context
        workflow = WorkflowRun.objects.get(id=workflow_id)
        db_property = Property.objects.get(id=property_id)

        source_run = SourceRun.objects.create(
            id=source_run_id,
            workflow_run=workflow,
            source_name="igr",
            source_year=year,
            status="running",
            workflow_step="igr_exec",
            input_payload={"year": year, "property_number": db_property.property_number}
        )

        logger.info(f"Starting parallel IGR scrape for workflow {workflow_id}, year {year}")

        # Setup IGR Workflow
        igr_input = IGRInput(
            district=db_property.district_code,
            taluka=db_property.taluka_code,
            village=db_property.village_code,
            property_number=db_property.property_number,
            year=year
        )
        
        igr_wf = IGRWorkflow(
            igr_input=igr_input,
            artifact_root="runs_igr",
            run_id=source_run_id
        )
        
        igr_wf.start()
        source_run.run_dir = igr_wf.run_id
        source_run.save()
        
        result = igr_wf.run()

        if result.status not in {"success", "empty"}:
            raise Exception(f"Unexpected result status: {result.status}")

        # Success
        source_run.status = "completed"
        source_run.completed_at = datetime.datetime.utcnow()
        
        # Extract canonical transactions & ownership
        transactions = result.transactions
        
        # Inferred fields
        inferred_survey = ""
        for txn in transactions:
            desc = txn.get("PropertyDescription") or ""
            match = re.search(r"सर्व्हे\s*नं\.?\s*([0-9A-Za-z/-]+)", desc) or re.search(r"गट\s*नं\.?\s*([0-9A-Za-z/-]+)", desc)
            if match:
                inferred_survey = match.group(1).strip()
                break
                
        inferred_owner = ""
        for txn in transactions:
            owner = txn.get("PurchaserName") or ""
            if owner:
                inferred_owner = owner.strip()
                break

        recent_transactions = []
        ownership_history = []
        for txn in transactions[:10]:
            recent_transactions.append({
                "year": year,
                "from_party": txn.get("SellerName", ""),
                "to_party": txn.get("PurchaserName", ""),
                "date": txn.get("RDate", ""),
                "consideration": txn.get("Status", ""),
                "type": txn.get("DName", ""),
                "area": txn.get("PropertyDescription", "")
            })
            if txn.get("PurchaserName"):
                ownership_history.append({
                    "person": txn.get("PurchaserName"),
                    "year": year,
                    "date": txn.get("RDate", ""),
                    "type": "acquired"
                })

        canonical_data = {
            "source": "igr",
            "run_id": result.run_id,
            "year": year,
            "status": result.status,
            "survey_number_text": inferred_survey or db_property.survey_number,
            "property_number": inferred_survey or db_property.property_number,
            "current_owner": inferred_owner,
            "co_owners": [],
            "transaction_count": len(transactions),
            "transactions": recent_transactions,
            "ownership_history": ownership_history,
            "all_transactions": transactions,
            "selected_labels": {
                "district": db_property.district_name,
                "taluka": db_property.taluka_name,
                "village": db_property.village_name
            }
        }

        result_summary = {
            "status": result.status,
            "year": year,
            "transaction_count": len(transactions),
            "run_id": result.run_id,
            "selected_labels": canonical_data["selected_labels"],
            "sample_transactions": transactions[:3],
            "workflow_step": "result_ready"
        }

        source_run.metadata = {
            "run_id": result.run_id,
            "captcha_status": "solved_automatically",
            "result": result_summary,
            "canonical_data": canonical_data
        }
        source_run.save()

        # Atomic increment of completed_steps
        WorkflowRun.objects.filter(id=workflow_id).update(completed_steps=F('completed_steps') + 1)
        logger.info(f"Completed IGR scrape for year {year}, found {len(transactions)} txns")
        
        return {
            "year": year,
            "status": "completed",
            "result": result_summary
        }
        
    except Exception as e:
        logger.error(f"Error scraping year {year}: {e}", exc_info=True)
        try:
            source_run = SourceRun.objects.get(id=source_run_id)
            source_run.status = "failed"
            source_run.error_message = str(e)
            source_run.completed_at = datetime.datetime.utcnow()
            source_run.save()
        except Exception as db_err:
            logger.error(f"Failed to save failed source run status: {db_err}")
            
        return {
            "year": year,
            "status": "failed",
            "error_message": str(e)
        }
    finally:
        close_old_connections()


def run_igr_scraper_in_background(workflow_id, property_id, year_from, year_to):
    close_old_connections()
    try:
        # Fetch records
        workflow = WorkflowRun.objects.get(id=workflow_id)
        workflow.status = "running"
        workflow.current_step = "igr_exec"
        workflow.save()

        years = list(range(year_from, year_to + 1))
        workflow.total_steps = len(years)
        workflow.completed_steps = 0
        workflow.save()

        years_payload = []

        # Run concurrent scraper using ThreadPoolExecutor
        # max_workers=3 balances performance and government site load
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(scrape_single_year, workflow_id, property_id, year): year
                for year in years
            }
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                years_payload.append(res)

        # Update Workflow Run Overall status
        workflow.refresh_from_db()
        all_completed = all(y["status"] == "completed" for y in years_payload)
        any_completed = any(y["status"] == "completed" for y in years_payload)
        
        workflow.status = "completed" if all_completed else ("partial" if any_completed else "failed")
        workflow.current_step = "completed"
        workflow.result_json = {
            "status": workflow.status,
            "sources": {
                "igr": {
                    "status": workflow.status,
                    "years": sorted(years_payload, key=lambda x: x["year"])
                }
            }
        }
        workflow.save()
        logger.info(f"Workflow {workflow_id} execution completed with status {workflow.status}")

    except Exception as e:
        logger.error(f"Error in overall workflow thread: {e}", exc_info=True)
    finally:
        close_old_connections()


# ----------------------------------------------------
# API Views
# ----------------------------------------------------
@api_view(['POST'])
def start_workflow(request):
    try:
        property_id = request.data.get("property_id")
        year_from = int(request.data.get("year_from"))
        year_to = int(request.data.get("year_to"))

        db_prop = Property.objects.get(id=property_id)
        workflow_id = f"wf-{uuid.uuid4().hex[:8]}"

        db_wf = WorkflowRun.objects.create(
            id=workflow_id,
            property=db_prop,
            district_value=db_prop.district_code,
            district_label=db_prop.district_name,
            taluka_value=db_prop.taluka_code,
            taluka_label=db_prop.taluka_name,
            village_value=db_prop.village_code,
            village_label=db_prop.village_name,
            property_number=db_prop.property_number,
            year_from=year_from,
            year_to=year_to,
            status="pending",
            current_step="initial"
        )

        # Start scraping thread
        thread = threading.Thread(
            target=run_igr_scraper_in_background,
            args=(workflow_id, property_id, year_from, year_to)
        )
        thread.daemon = True
        thread.start()

        return Response({
            "id": workflow_id,
            "status": "pending",
            "current_step": "initial",
            "completed_steps": 0,
            "total_steps": year_to - year_from + 1
        }, status=status.HTTP_201_CREATED)

    except Property.DoesNotExist:
        return Response({"error": "Property not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_450_GENERIC_ERROR or status.HTTP_500_INTERNAL_SERVER_ERROR)


class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer

    def create(self, request, *args, **kwargs):
        metadata = request.data.get("metadata") or {}
        selection = metadata.get("selection") or {}
        
        prop = Property.objects.create(
            label=request.data.get("label"),
            district_name=request.data.get("district_name"),
            taluka_name=request.data.get("taluka_name"),
            village_name=request.data.get("village_name"),
            survey_number=request.data.get("survey_number", ""),
            subdivision_number=request.data.get("subdivision_number", ""),
            property_number=request.data.get("property_number", ""),
            district_code=selection.get("district_code", ""),
            taluka_code=selection.get("taluka_code", ""),
            village_code=selection.get("village_code", "")
        )
        serializer = self.get_serializer(prop)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            "results": serializer.data,
            "count": len(serializer.data)
        })


@api_view(['POST'])
def resolve_sources(request, property_id):
    return Response({"status": "resolved", "property_id": property_id})


class WorkflowRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WorkflowRun.objects.all()
    serializer_class = WorkflowRunSerializer


class SourceRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SourceRun.objects.all()
    serializer_class = SourceRunSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        # Merge sibling years for IGR History Detail
        try:
            wf = instance.workflow_run
            all_runs = SourceRun.objects.filter(workflow_run=wf)

            merged_transactions = []
            ownership_history = []

            for run in all_runs.order_by('source_year'):
                run_data = run.metadata.get("canonical_data") or {}
                txns = run_data.get("all_transactions") or []
                for t in txns:
                    merged_transactions.append(t)
                owners = run_data.get("ownership_history") or []
                for o in owners:
                    ownership_history.append(o)

            metadata = data.get("metadata") or {}
            if "canonical_data" in metadata:
                metadata["canonical_data"]["all_transactions"] = merged_transactions
                metadata["canonical_data"]["transactions"] = merged_transactions[:10]
                metadata["canonical_data"]["ownership_history"] = ownership_history
                metadata["canonical_data"]["transaction_count"] = len(merged_transactions)

            if "result" in metadata:
                metadata["result"]["transaction_count"] = len(merged_transactions)
                metadata["result"]["sample_transactions"] = merged_transactions[:3]

            data["metadata"] = metadata
        except Exception as e:
            logger.error(f"Error merging sibling runs: {e}")

        return Response(data)
