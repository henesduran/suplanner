import json
import os

# Defaults kept for backward compatibility
DEFAULT_INPUT_FILE = "raw_courses.json"
DEFAULT_OUTPUT_FILE = "processed_data.json"

def parse_time_to_minutes(time_str: str):
    if not time_str: return None
    parts = time_str.split()
    if len(parts) != 2: return None
    time_part = parts[0]
    period = parts[-1].lower()
    
    try:
        hour, minute = map(int, time_part.split(":"))
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return (hour * 60 + minute)
    except ValueError:
        return None

def map_day_to_index(day_char):
    mapping = { "M": 0, "T": 1, "W": 2, "R": 3, "F": 4 }
    return mapping.get(day_char, -1)

def normalize(input_file: str = DEFAULT_INPUT_FILE, output_file: str = DEFAULT_OUTPUT_FILE):
    if not os.path.exists(input_file):
        print(f"{input_file} not found.")
        return

    with open(input_file, "r", encoding="UTF-8") as f:
        data = json.load(f)
    
    processed_count = 0
    
    for course_details in data.values():
        if "sections" in course_details:
            for section in course_details["sections"]:
                
                if not section.get("schedule"): continue

                for meeting in section["schedule"]:
                    raw_time = meeting.get("time", "")
                    raw_day = meeting.get("days", "")

                    if raw_time and " - " in raw_time:
                        start_str, end_str = raw_time.split(" - ")
                        start_min = parse_time_to_minutes(start_str)
                        end_min = parse_time_to_minutes(end_str)
                    else:
                        start_min, end_min = None, None

                    day_index = map_day_to_index(raw_day)

                    meeting["start_min"] = start_min
                    meeting["end_min"] = end_min
                    meeting["day_index"] = day_index
                
                processed_count += 1

    with open(output_file, "w", encoding="UTF-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"Normalization complete. {processed_count} sections processed.")

if __name__ == "__main__":
    normalize()