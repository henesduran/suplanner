import os
import shutil
from pulldata import master as pull_master
import normalize_data
import minimize

DEST_PUBLIC_DIR = os.path.join("..", "frontend", "public")


def run_pipeline(index: int, label: str):
    print(f"\nRunning pipeline for term index={index} label={label}")

    raw_name = f"raw_courses_{label}.json"
    processed_name = f"processed_{label}.json"
    data_name = f"data_{label}.json"

    try:
        print("--- scraping ---")
        pull_master(term_index=index, output_name=raw_name)
    except Exception as e:
        print(f"Scraping failed for {label}: {e}")
        return False

    try:
        print("--- normalizing ---")
        normalize_data.normalize(input_file=raw_name, output_file=processed_name)
    except Exception as e:
        print(f"Normalization failed for {label}: {e}")
        return False

    try:
        print("--- minimizing ---")
        minimize.minimize_data(input_file=processed_name, output_file=data_name)
    except Exception as e:
        print(f"Minimization failed for {label}: {e}")
        return False

    # ensure destination
    os.makedirs(DEST_PUBLIC_DIR, exist_ok=True)
    dest_path = os.path.join(DEST_PUBLIC_DIR, data_name)

    if os.path.exists(data_name):
        shutil.move(data_name, dest_path)
        print(f"Moved {data_name} -> {dest_path}")
    else:
        print(f"Expected {data_name} but not found.")
        return False

    # cleanup intermediates
    for f in [raw_name, processed_name]:
        if os.path.exists(f):
            os.remove(f)

    return True


def main():
    print("Update process started...")

    ok_current = run_pipeline(0, 'current')
    ok_previous = run_pipeline(1, 'previous')

    if ok_current and ok_previous:
        print("Both pipelines completed successfully.")
    else:
        print("One or more pipelines failed. Check logs above.")

    # For backward compatibility, ensure data.json points to the current dataset
    try:
        if ok_current:
            src = os.path.join(DEST_PUBLIC_DIR, 'data_current.json')
            legacy = os.path.join(DEST_PUBLIC_DIR, 'data.json')
            if os.path.exists(src):
                shutil.copy2(src, legacy)
                print(f"Updated legacy file {legacy} from {src}")
    except Exception as e:
        print(f"Failed to update legacy data.json: {e}")


if __name__ == "__main__":
    main()