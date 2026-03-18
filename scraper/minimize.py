import json
import os

KEYS_TO_REMOVE = [
    "date_range",    
    "type",          
    "schedule_type",
]

DEFAULT_INPUT_FILE = 'processed_data.json'
DEFAULT_OUTPUT_FILE = 'data.json'

def minimize_data(input_file: str = DEFAULT_INPUT_FILE, output_file: str = DEFAULT_OUTPUT_FILE):
    if not os.path.exists(input_file):
        print(f"{input_file} not found.")
        return

    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for course_code, course_data in data.items():
        if "sections" in course_data:
            for section in course_data["sections"]:
                if "schedule" in section:
                    for slot in section["schedule"]:
                        for key in KEYS_TO_REMOVE:
                            if key in slot:
                                del slot[key]

    print("Minimizing...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
    
    print(f"Done. Saved to {output_file}")

if __name__ == "__main__":
    minimize_data()