import os
import sys
import json
import time
from pathlib import Path

# Add the current directory to sys.path so we can import Django modules
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR))

# Setup Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bhulekh_backend.settings')
import django
django.setup()

from bhulekh_app.bhulekh.models import PropertyInput
from bhulekh_app.bhulekh.workflow import BhulekhWorkflow

OUTPUT_FILE = BASE_DIR / "bhulekh_app" / "locations_data.json"
STORAGE_ROOT = BASE_DIR / "storage"

def load_data():
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load existing json data: {e}. Starting fresh.")
    return {
        "districts": [],
        "talukas": {},
        "villages": {}
    }

def save_data(data):
    try:
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving data to disk: {e}")

def main():
    print("Loading existing locations data (to support resuming)...")
    data = load_data()
    
    # Initialize basic BhulekhWorkflow
    print("Connecting to homepage to fetch districts...")
    prop_in = PropertyInput(
        district="interactive",
        taluka="interactive",
        village="interactive",
        survey_number="1"
    )
    
    # Check if we already have districts
    if not data.get("districts"):
        try:
            wf = BhulekhWorkflow(property_input=prop_in, artifact_root=str(STORAGE_ROOT))
            wf.load_home()
            districts = [{"label": opt.text, "value": opt.value} for opt in wf.state.district_options if opt.value]
            data["districts"] = districts
            save_data(data)
            print(f"Successfully loaded and saved {len(districts)} districts.")
        except Exception as e:
            print(f"Failed to load districts: {e}")
            return
    else:
        districts = data["districts"]
        print(f"Loaded {len(districts)} districts from cache.")

    # Fetch talukas for each district
    for dist_idx, dist in enumerate(districts, start=1):
        dist_val = dist["value"]
        dist_label = dist["label"]
        
        # Skip if talukas already scraped for this district
        if dist_val in data["talukas"] and data["talukas"][dist_val]:
            print(f"[{dist_idx}/{len(districts)}] Skipping district {dist_label} (talukas already cached).")
            talukas = data["talukas"][dist_val]
        else:
            print(f"[{dist_idx}/{len(districts)}] Fetching talukas for district {dist_label} ({dist_val})...")
            try:
                # Limit speed to be friendly to server/proxy
                time.sleep(0.5)
                wf_dist = BhulekhWorkflow(property_input=PropertyInput(
                    district=dist_val,
                    taluka="interactive",
                    village="interactive",
                    survey_number="1"
                ), artifact_root=str(STORAGE_ROOT))
                wf_dist.load_home()
                wf_dist.select_district(dist_val)
                talukas = [{"label": opt.text, "value": opt.value} for opt in wf_dist.state.taluka_options if opt.value]
                
                data["talukas"][dist_val] = talukas
                save_data(data)
                print(f"  Loaded and saved {len(talukas)} talukas.")
            except Exception as e:
                print(f"  Error loading talukas for district {dist_label}: {e}")
                continue

        # Fetch villages for each taluka
        for tal_idx, tal in enumerate(talukas, start=1):
            tal_val = tal["value"]
            tal_label = tal["label"]
            cache_key = f"{dist_val}_{tal_val}"
            
            # Skip if villages already scraped for this taluka
            if cache_key in data["villages"] and data["villages"][cache_key]:
                # Print output occasionally to show progress
                if tal_idx % 5 == 1:
                    print(f"  ({tal_idx}/{len(talukas)}) Skipping taluka {tal_label} (villages already cached).")
                continue
                
            print(f"  ({tal_idx}/{len(talukas)}) Fetching villages for taluka {tal_label} ({tal_val})...")
            try:
                # Speed limit
                time.sleep(0.5)
                wf_tal = BhulekhWorkflow(property_input=PropertyInput(
                    district=dist_val,
                    taluka=tal_val,
                    village="interactive",
                    survey_number="1"
                ), artifact_root=str(STORAGE_ROOT))
                wf_tal.load_home()
                wf_tal.select_district(dist_val)
                wf_tal.select_taluka(tal_val)
                
                villages = [{"label": opt.text, "value": opt.value} for opt in wf_tal.state.village_options if opt.value]
                data["villages"][cache_key] = villages
                save_data(data)
                print(f"    Loaded and saved {len(villages)} villages.")
            except Exception as e:
                print(f"    Error loading villages for taluka {tal_label}: {e}")
                
    print("Scraping completed successfully!")

if __name__ == "__main__":
    main()
