import requests
from bs4 import BeautifulSoup
import time
import re
import json
import concurrent.futures

BASE_URL = "http://suis.sabanciuniv.edu"
START_URL = "http://suis.sabanciuniv.edu/prod/bwckschd.p_disp_dyn_sched"
TERM_POST_URL = "http://suis.sabanciuniv.edu/prod/bwckgens.p_proc_term_date"
DETAIL_URL = "https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched"

course_coreq_cache = {}

def process_batch(batch, soup, term_code):
    local_session = requests.Session() 
    
    payload = generatePayload(batch, soup)
    if not payload: return []

    try:
        html_content = fetch_course_data(local_session, payload)
        parsed_batch = parse_detailed_schedule(html_content, local_session, term_code)
        return parsed_batch
    except Exception as e:
        print(f"Batch processing error {batch}: {e}")
        return []

def master(term_index=0, output_name='raw_courses.json'):
    session = requests.session()
    subject_codes, soup, term_code = getSubjects(session, term_index=term_index)
    if not term_code:
        print("Term code not found.")
        return

    all_courses_data = []
    chunk_size = 15 
    batches = [subject_codes[i:i+chunk_size] for i in range(0, len(subject_codes), chunk_size)]
    
    print(f"Starting scrape for term: {term_code}")
    print(f"Total subjects: {len(subject_codes)} | Batches: {len(batches)}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_batch = {
            executor.submit(process_batch, batch, soup, term_code): batch 
            for batch in batches
        }
        
        for future in concurrent.futures.as_completed(future_to_batch):
            batch_data = future.result()
            if batch_data:
                all_courses_data.extend(batch_data)
                print(f"Batch done. Total sections: {len(all_courses_data)}")

    print(f"Scrape complete. Total sections: {len(all_courses_data)}")
    
    save_grouped_format(all_courses_data, filename=output_name)

def getSubjects(session, term_index=0):
    FALLBACK_SUBJECTS = ['AL', 'ACC', 'GR', 'ANTH', 'ARA', 'BAN', 'CHEM', 'CIP', 'CS', 'CONF', 'CULT', 'DSA', 'DS', 'ECON', 'EE', 'ETM', 'ENRG', 'ENS', 'ENG', 'ENT', 'ES', 'FIN', 'GEN', 'GER', 'HART', 'HIST', 'HUM', 'IE', 'IF', 'IR', 'LAW', 'LIT', 'MGMT', 'MRES', 'MFE', 'MFG', 'MKTG', 'MAT', 'MATH', 'ME', 'BIO', 'NS', 'OPIM', 'ORG', 'PERS', 'PHIL', 'PHYS', 'PSIR', 'POLS', 'PROJ', 'XM', 'PSY', 'QL', 'SEC', 'SPS', 'SOC', 'TLL', 'TS', 'TUR', 'VA']

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": START_URL,
        "Origin": BASE_URL,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    try:
        res_start = session.get(START_URL, headers=headers)
        res_start.raise_for_status()
        
        soup_start = BeautifulSoup(res_start.content, 'html.parser')
        term_select = soup_start.find("select", {"name": "p_term"})
        
        if not term_select:
            return FALLBACK_SUBJECTS, None, None

        terms = []
        for opt in term_select.find_all("option"):
            if opt.get("value"):
                terms.append((opt.get("value"), opt.text.strip()))
        terms = [t for t in terms if not t[0].endswith('03')]
        
        terms.sort(key=lambda x: x[0], reverse=True)
        if not terms:
            return FALLBACK_SUBJECTS, None, None

        if term_index < 0 or term_index >= len(terms):
            term_index = 0

        selected_term_code, selected_term_name = terms[term_index]
        
        payload = {"p_term": selected_term_code, "p_calling_proc": "P_DispDynSched"}
        
        form = soup_start.find("form")
        if form:
            for inp in form.find_all("input", {"type": "hidden"}):
                payload[inp.get("name")] = inp.get("value")
        
        r_post = session.post(TERM_POST_URL, headers=headers, data=payload)
        r_post.raise_for_status()
        
        soup_result = BeautifulSoup(r_post.content, "html.parser")
        subject_select = soup_result.find("select", {"name": "sel_subj"})

        if not subject_select:
            return FALLBACK_SUBJECTS, soup_result, selected_term_code

        all_subjects = [opt.get("value") for opt in subject_select.find_all("option") if opt.get("value") not in ["dummy", "%"]]
        
        return all_subjects, soup_result, selected_term_code

    except Exception as e:
        print(f"Subject fetch error: {e}")
        return FALLBACK_SUBJECTS, None, None

def generatePayload(subject_codes, soup):
    payload = {}
    if not soup: return None
    
    form = soup.find("form", {"action": "/prod/bwckschd.p_get_crse_unsec"})
    if not form: return None

    for inp in form.find_all("input"):
        if inp.get("type") not in ["submit", "reset", "button"] and inp.get("name"):
            payload[inp.get("name")] = inp.get("value", "")
            
    for sel in form.find_all("select"):
        if sel.get("name"): payload[sel.get("name")] = "dummy"

    payload["sel_subj"] = ["dummy"] + subject_codes
    for key in ["sel_crse", "sel_title", "sel_from_cred", "sel_to_cred", "begin_hh", "begin_mi", "begin_ap", "end_hh", "end_mi", "end_ap"]:
        payload[key] = "" if "cred" in key or "title" in key or "crse" in key else "0"
        if "ap" in key: payload[key] = "a"

    return payload

def fetch_course_data(session, payload):
    GET_URL = "http://suis.sabanciuniv.edu/prod/bwckschd.p_get_crse_unsec"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://suis.sabanciuniv.edu/prod/bwckgens.p_proc_term_date",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    r_post = session.post(GET_URL, headers=headers, data=payload)
    return r_post.content

def get_corequisites(session, term_code, crn):
    params = {
        'term_in': term_code,
        'crn_in': crn
    }
    try:
        response = session.get(DETAIL_URL, params=params)
        if response.status_code != 200: return []
            
        soup = BeautifulSoup(response.text, 'html.parser')
        full_text = soup.get_text()
        
        match = re.search(r'Corequisites:\s*((?:[A-Z]{2,4}\s+\d+[A-Z]?(?:,\s*)?)+)', full_text)
        
        if match:
            coreq_string = match.group(1)
            coreqs = [c.strip().replace('\xa0', ' ') for c in coreq_string.split(',')]
            return coreqs
        return []

    except Exception:
        return []

def parse_detailed_schedule(html_content, session, term_code):
    soup = BeautifulSoup(html_content, 'html.parser')
    course_headers = soup.find_all("th", class_="ddlabel")
    parsed_courses = []
    
    for header in course_headers:
        full_title = header.text.strip()
        parts = full_title.split(" - ")

        if len(parts) >= 4:
            raw_section = parts[-1].strip()
            section = raw_section.split('[')[0].strip()
            course_code = parts[-2].strip()
            crn = parts[-3].strip()
            course_name = " - ".join(parts[:-3]).strip()
        else:
            continue

        if course_code in course_coreq_cache:
            coreqs = course_coreq_cache[course_code]
        else:
            coreqs = get_corequisites(session, term_code, crn)
            course_coreq_cache[course_code] = coreqs
            time.sleep(0.1)

        header_row = header.find_parent("tr")
        details_row = header_row.find_next_sibling("tr")
        if not details_row: continue
        
        details_td = details_row.find("td", class_="dddefault")
        if not details_td: continue
        
        text_content = details_td.text
        cred_match = re.search(r'(\d+\.\d+)\s+Credits', text_content)
        credits = cred_match.group(1) if cred_match else "0.000"

        schedule_table = details_td.find("table", class_="datadisplaytable")
        schedule = []

        if schedule_table:
            rows = schedule_table.find_all("tr")[1:]
            for row in rows:
                cols = row.find_all("td")
                if len(cols) < 7: continue
                
                instr_text = cols[6].text.strip().replace("(P)", "").strip()
                if not instr_text: instr_text = "TBA"
                
                meeting = {
                    "type": cols[0].text.strip(),      
                    "time": cols[1].text.strip(),       
                    "days": cols[2].text.strip(),       
                    "where": cols[3].text.strip(),      
                    "date_range": cols[4].text.strip(),
                    "schedule_type": cols[5].text.strip(),
                    "instructor": instr_text
                }
                schedule.append(meeting)
        
        course_obj = {
            "code": course_code,
            "name": course_name,
            "crn": crn,
            "section": section,
            "credits": credits,
            "corequisites": coreqs,
            "schedule": schedule,
        }

        parsed_courses.append(course_obj)
    return parsed_courses

def save_grouped_format(flat_data, filename='raw_courses.json'):
    grouped = {}
    for item in flat_data:
        code = item["code"]
        if code not in grouped:
            grouped[code] = {
                "name": item["name"],
                "credits": item["credits"],
                "corequisites": item["corequisites"],
                "sections": []
            }
        
        section_obj = {
            "code": item["code"],
            "crn": item["crn"],
            "section": item["section"],
            "schedule": item["schedule"]
        }
        grouped[code]["sections"].append(section_obj)
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(grouped, f, indent=4, ensure_ascii=False)
    print(f"Saved grouped data to {filename}")

if __name__ == "__main__":
    master()