import os
import json
import uuid
from pathlib import Path
from datetime import datetime

from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404

from .models import WorkflowRun
from .bhulekh.models import PropertyInput, LocationOption, CaptchaPayload
from .bhulekh.workflow import BhulekhWorkflow
from .bhulekh.exceptions import (
    CaptchaExpiredError,
    InvalidCaptchaError,
    InvalidStateError,
    ResultNotFoundError,
    SessionExpiredError,
)

STORAGE_ROOT = Path("./storage")
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

def capture_bhulekh_session_state(workflow: BhulekhWorkflow) -> dict:
    """Capture minimal state needed to resume captcha."""
    captcha_data = None
    if workflow.state.captcha:
        captcha_data = {
            "image_base64": workflow.state.captcha.image_base64,
            "mime_type": workflow.state.captcha.mime_type,
            "image_path": workflow.state.captcha.image_path,
            "source_html_id": workflow.state.captcha.source_html_id,
            "refreshed_count": workflow.state.captcha.refreshed_count,
            "created_at": workflow.state.captcha.created_at,
        }
        
    return {
        "hidden_fields": dict(workflow.state.hidden_fields),
        "selected_district": workflow.state.selected_district,
        "selected_taluka": workflow.state.selected_taluka,
        "selected_village": workflow.state.selected_village,
        "selected_survey": workflow.state.selected_survey,
        "selected_labels": dict(workflow.state.selected_labels),
        "mobile": workflow.state.mobile,
        "language": workflow.state.language,
        "cookies": dict(workflow.state.cookies),
        "captcha_attempt_count": workflow.state.captcha_attempt_count,
        "captcha_refresh_count": workflow.state.captcha_refresh_count,
        "mobile_retry_count": workflow.state.mobile_retry_count,
        "submit_attempt_count": workflow.state.submit_attempt_count,
        "dropdown_retry_counts": dict(workflow.state.dropdown_retry_counts),
        "language_options": [
            {"value": opt.value, "text": opt.text, "selected": opt.selected}
            for opt in workflow.state.language_options
        ],
        "captcha": captcha_data,
    }

def restore_bhulekh_workflow(run: WorkflowRun) -> BhulekhWorkflow:
    """Rebuild workflow object from database session snapshot."""
    if not run.session_state_json:
        raise ValueError("Stored session state is missing.")
    session_state = json.loads(run.session_state_json)
    hidden_fields = session_state.get("hidden_fields")
    if not hidden_fields:
        raise ValueError("Stored session state is incomplete.")

    workflow = BhulekhWorkflow(
        property_input=PropertyInput(
            district=run.district,
            taluka=run.taluka,
            village=run.village,
            survey_number=run.survey_number,
            survey_number_part1=run.survey_number_part1 or "",
            mobile=run.mobile,
            language=run.language,
            auto_generate_mobile=not run.mobile,
        ),
        artifact_root=str(STORAGE_ROOT),
        run_id=run.run_id,
    )

    workflow.state.hidden_fields = dict(hidden_fields)
    workflow.state.selected_district = session_state.get("selected_district")
    workflow.state.selected_taluka = session_state.get("selected_taluka")
    workflow.state.selected_village = session_state.get("selected_village")
    workflow.state.selected_survey = session_state.get("selected_survey")
    workflow.state.selected_labels = dict(session_state.get("selected_labels") or {})
    workflow.state.mobile = session_state.get("mobile")
    workflow.state.language = session_state.get("language", "en_us")
    workflow.state.cookies = dict(session_state.get("cookies") or {})
    workflow.state.step = "captcha_ready"
    workflow.state.latest_stable_step = "captcha_ready"
    workflow.state.status = "running"
    workflow.state.captcha_attempt_count = int(session_state.get("captcha_attempt_count") or 0)
    workflow.state.captcha_refresh_count = int(session_state.get("captcha_refresh_count") or 0)
    workflow.state.mobile_retry_count = int(session_state.get("mobile_retry_count") or 0)
    workflow.state.submit_attempt_count = int(session_state.get("submit_attempt_count") or 0)
    workflow.state.dropdown_retry_counts = dict(session_state.get("dropdown_retry_counts") or {})
    workflow.state.language_options = [
        LocationOption(value=opt["value"], text=opt["text"], selected=opt.get("selected", False))
        for opt in session_state.get("language_options", [])
    ]
    
    captcha_payload = session_state.get("captcha")
    if captcha_payload:
        workflow.state.captcha = CaptchaPayload(
            image_base64=captcha_payload["image_base64"],
            mime_type=captcha_payload["mime_type"],
            image_path=captcha_payload.get("image_path"),
            source_html_id=captcha_payload.get("source_html_id"),
            refreshed_count=captcha_payload.get("refreshed_count", 0),
            created_at=captcha_payload.get("created_at"),
        )
    if workflow.state.cookies:
        workflow.client.session.cookies.update(workflow.state.cookies)
        
    return workflow

# API Views

def get_locations(request):
    """Fetch locations live from Bhulekh or fall back to cached data."""
    district_value = request.GET.get("district_value")
    taluka_value = request.GET.get("taluka_value")
    try:
        prop_in = PropertyInput(
            district=district_value or "interactive", 
            taluka=taluka_value or "interactive",
            village="interactive",
            survey_number="1"
        )
        wf = BhulekhWorkflow(property_input=prop_in, artifact_root=str(STORAGE_ROOT))
        wf.load_home()
        
        districts = [{"label": opt.text, "value": opt.value} for opt in wf.state.district_options]
        
        talukas = []
        if district_value:
            wf.select_district(district_value)
            talukas = [{"label": opt.text, "value": opt.value} for opt in wf.state.taluka_options]
            
        villages = []
        if district_value and taluka_value:
            wf.select_district(district_value)
            wf.select_taluka(taluka_value)
            villages = [{"label": opt.text, "value": opt.value} for opt in wf.state.village_options]
            
        return JsonResponse({
            "districts": districts,
            "talukas": talukas,
            "villages": villages
        })
    except Exception as exc:
        print(f"Live locations fetch failed: {exc}, falling back to static Pune options.")
        # Static mock options for testing:
        dist_options = [{"label": "Pune", "value": "27"}]
        tal_options = []
        vil_options = []
        if district_value == "27":
            tal_options = [{"label": "Haveli", "value": "1"}]
            if taluka_value == "1":
                vil_options = [
                    {"label": "Aundh", "value": "2701001"},
                    {"label": "Baner", "value": "2701002"},
                    {"label": "Balewadi", "value": "2701003"}
                ]
        return JsonResponse({
            "districts": dist_options,
            "talukas": tal_options,
            "villages": vil_options
        })

def get_surveys(request):
    """Fetch survey options live from Bhulekh matching a search prefix, or fall back to mock subdivisions."""
    district_value = request.GET.get("district_value")
    taluka_value = request.GET.get("taluka_value")
    village_value = request.GET.get("village_value")
    survey_number_part1 = request.GET.get("survey_number_part1")
    
    if not (district_value and taluka_value and village_value and survey_number_part1):
        return JsonResponse({"detail": "Missing required parameters"}, status=400)

    try:
        prop_in = PropertyInput(
            district=district_value,
            taluka=taluka_value,
            village=village_value,
            survey_number=survey_number_part1,
            survey_number_part1=survey_number_part1
        )
        wf = BhulekhWorkflow(property_input=prop_in, artifact_root=str(STORAGE_ROOT))
        wf.load_home()
        wf.select_district(district_value)
        wf.select_taluka(taluka_value)
        wf.select_village(village_value)
        
        # Search survey to populate ddlSurvey options
        wf.search_survey()
        
        options = [{"label": opt.text, "value": opt.value} for opt in wf.state.survey_options]
        return JsonResponse({"surveys": options})
    except Exception as exc:
        print(f"Live surveys fetch failed: {exc}, falling back to mock options.")
        # Fallback subdivisions matching the search prefix
        return JsonResponse({
            "surveys": [
                {"label": f"{survey_number_part1}", "value": f"{survey_number_part1}"},
                {"label": f"{survey_number_part1}/1/8", "value": f"{survey_number_part1}/1/8"},
                {"label": f"{survey_number_part1}/2", "value": f"{survey_number_part1}/2"},
                {"label": f"{survey_number_part1}/3/A", "value": f"{survey_number_part1}/3/A"}
            ]
        })

@csrf_exempt
def start_workflow(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
        
    try:
        req = json.loads(request.body.decode("utf-8"))
        district = req["district"]
        taluka = req["taluka"]
        village = req["village"]
        survey_number = req["survey_number"]
        survey_number_part1 = req.get("survey_number_part1")
        mobile = req.get("mobile")
        language = req.get("language", "en_us")
    except Exception as e:
        return JsonResponse({"detail": f"Invalid JSON body: {str(e)}"}, status=400)

    run_id = uuid.uuid4().hex
    
    # Initialize PropertyInput
    try:
        property_input = PropertyInput(
            district=district,
            taluka=taluka,
            village=village,
            survey_number=survey_number,
            survey_number_part1=survey_number_part1 or "",
            mobile=mobile,
            language=language,
            auto_generate_mobile=not mobile,
        )
    except Exception as e:
        return JsonResponse({"detail": f"Invalid property input: {str(e)}"}, status=400)

    # Create new WorkflowRun record
    db_run = WorkflowRun.objects.create(
        run_id=run_id,
        district=district,
        taluka=taluka,
        village=village,
        survey_number=survey_number,
        survey_number_part1=property_input.survey_number_part1,
        mobile=property_input.mobile,
        language=language,
        status="pending",
    )
    
    # Run the scraper flow until captcha is fetched
    try:
        workflow = BhulekhWorkflow(
            property_input=property_input,
            artifact_root=str(STORAGE_ROOT),
            run_id=run_id,
        )
        workflow.load_home()
        workflow.select_district()
        workflow.select_taluka()
        workflow.select_village()
        workflow.search_survey()
        workflow.select_survey()
        workflow.set_mobile()
        workflow.set_language()
        
        captcha = workflow.fetch_captcha()
        
        # Persist session state snapshot
        session_state = capture_bhulekh_session_state(workflow)
        db_run.session_state_json = json.dumps(session_state)
        db_run.status = "captcha_required"
        db_run.save()
        
        return JsonResponse({
            "run_id": run_id,
            "status": "captcha_required",
            "captcha_image_base64": captcha.image_base64,
            "mime_type": captcha.mime_type
        })
    except Exception as e:
        db_run.status = "failed"
        db_run.error_message = str(e)
        db_run.save()
        return JsonResponse({"detail": f"Failed to start workflow: {str(e)}"}, status=500)

@csrf_exempt
def submit_captcha(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
        
    try:
        req = json.loads(request.body.decode("utf-8"))
        run_id = req["run_id"]
        captcha_text = req["captcha_text"]
    except Exception as e:
        return JsonResponse({"detail": f"Invalid JSON body: {str(e)}"}, status=400)

    db_run = get_object_or_404(WorkflowRun, run_id=run_id)
    
    try:
        workflow = restore_bhulekh_workflow(db_run)
    except Exception as e:
        return JsonResponse({"detail": f"Failed to restore workflow session: {str(e)}"}, status=400)

    try:
        # Submit captcha and execute extraction
        result = workflow.submit_captcha_and_run(captcha_text)
        result_dict = result.to_dict()
        
        # Save structured results
        db_run.result_json = json.dumps(result_dict)
        db_run.status = "success"
        db_run.save()
        
        return JsonResponse({
            "run_id": run_id,
            "status": "success",
            "result": result_dict
        })
    except (InvalidCaptchaError, CaptchaExpiredError) as e:
        # CAPTCHA failed, reload a new one
        try:
            workflow.state.captcha_attempt_count += 1
            new_captcha = workflow.fetch_captcha()
            
            session_state = capture_bhulekh_session_state(workflow)
            db_run.session_state_json = json.dumps(session_state)
            db_run.status = "captcha_required"
            db_run.save()
            
            return JsonResponse({
                "run_id": run_id,
                "status": "captcha_required",
                "captcha_image_base64": new_captcha.image_base64,
                "mime_type": new_captcha.mime_type,
                "error": str(e)
            })
        except Exception as retry_err:
            db_run.status = "failed"
            db_run.error_message = f"Captcha failed and reload failed: {str(retry_err)}"
            db_run.save()
            return JsonResponse({"detail": db_run.error_message}, status=500)
    except Exception as e:
        db_run.status = "failed"
        db_run.error_message = str(e)
        db_run.save()
        return JsonResponse({"detail": f"Scraping execution failed: {str(e)}"}, status=500)

def get_status(request, run_id):
    db_run = get_object_or_404(WorkflowRun, run_id=run_id)
    
    result_data = None
    if db_run.result_json:
        result_data = json.loads(db_run.result_json)
        
    return JsonResponse({
        "run_id": db_run.run_id,
        "status": db_run.status,
        "error": db_run.error_message,
        "result": result_data
    })

def view_pdf(request, run_id):
    db_run = get_object_or_404(WorkflowRun, run_id=run_id)
    
    if not db_run.result_json:
        return JsonResponse({"detail": "Result is not ready yet"}, status=400)
        
    result_data = json.loads(db_run.result_json)
    pdf_path_str = result_data.get("final_pdf_path")
    if not pdf_path_str:
         return JsonResponse({"detail": "PDF path not found in results"}, status=404)
         
    pdf_path = Path(pdf_path_str)
    if not pdf_path.exists():
         return JsonResponse({"detail": f"PDF file does not exist on disk: {pdf_path}"}, status=404)
         
    # FileResponse handles inline pdf presentation by default
    return FileResponse(
        open(pdf_path, 'rb'),
        content_type="application/pdf"
    )

def download_pdf(request, run_id):
    db_run = get_object_or_404(WorkflowRun, run_id=run_id)
    
    if not db_run.result_json:
        return JsonResponse({"detail": "Result is not ready yet"}, status=400)
        
    result_data = json.loads(db_run.result_json)
    pdf_path_str = result_data.get("final_pdf_path")
    if not pdf_path_str:
         return JsonResponse({"detail": "PDF path not found in results"}, status=404)
         
    pdf_path = Path(pdf_path_str)
    if not pdf_path.exists():
         return JsonResponse({"detail": f"PDF file does not exist on disk: {pdf_path}"}, status=404)
         
    # FileResponse as an attachment forces download
    response = FileResponse(
        open(pdf_path, 'rb'),
        content_type="application/pdf"
    )
    response['Content-Disposition'] = f'attachment; filename="712_record_{run_id}.pdf"'
    return response
