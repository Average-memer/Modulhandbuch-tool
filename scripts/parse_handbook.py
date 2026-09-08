#!/usr/bin/env python3
"""
parse_handbook.py
Comprehensive parser for KIT M.Sc. ETIT Module Handbook (SPO 2025).
Extracts all 224 unique modules, degree requirements, specialization mappings,
prerequisites, exclusions, and syllabi into clean JSON and JS formats.
"""

import os
import re
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_FILE = os.path.join(BASE_DIR, "mhb_extracted_text.txt")
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_JS_DIR = os.path.join(BASE_DIR, "public", "js")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_JS_DIR, exist_ok=True)

def strip_headers_footers(text):
    if not text:
        return ""
    # Remove page delimiters
    text = re.sub(r'---\s*PAGE\s*\d+\s*---', ' ', text)
    # Remove running header / footer text
    text = re.sub(r'M\.Sc\.\s+Electrical\s+Engineering\s+and\s+Information\s+Technology\s+2025\s+\(Master\s+of\s+Science\)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'Module\s+Handbook\s+as\s+of\s+\d{2}/\d{2}/\d{4}\s*\d*', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'\b12\s+MODULES\b.*?(?=\n|$)', ' ', text)
    text = re.sub(r'\b13\s+MODULE\s+COMPONENTS\b.*?(?=\n|$)', ' ', text)
    text = re.sub(r'\bModule:\s+[A-Za-z0-9\s,\-\:\(\)]+\[M-[A-Z0-9\-]+\]', ' ', text)
    # Collapse multiple newlines & whitespace
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    cleaned = '\n'.join(lines)
    return cleaned.strip()

def normalize_term(rec_text):
    rec_lower = rec_text.lower() if rec_text else ""
    if "winter" in rec_lower and "summer" in rec_lower:
        return "WS+SS"
    if "each term" in rec_lower or "jedes semester" in rec_lower:
        return "WS+SS"
    if "winter" in rec_lower:
        return "WS"
    if "summer" in rec_lower:
        return "SS"
    return "WS+SS"

def parse_specialization_structure(text):
    sec7_match = re.search(r'7 Study Program Structure.*?(?=8 Master‘s thesis registration)', text, re.DOTALL)
    if not sec7_match:
        print("Warning: Section 7 not found")
        return []
    sec7 = sec7_match.group(0)

    specs_def = [
        {
            "id": "ARSE",
            "name": "Automation, Robotics, and Systems Engineering",
            "germanName": "Automatisierungs-, Roboter- und Systemtechnik",
            "header": "7.2.3 Automation, Robotics, and Systems Engineering",
            "end": "7.2.4 Microelectronics, Photonics, and Quantum Technologies",
            "profiles": [
                "Automation, Control & Robotics",
                "Measurement, Sensing & Signal Processing",
                "Systems Engineering"
            ]
        },
        {
            "id": "EPSE",
            "name": "Electrical Power Systems and Electromobility",
            "germanName": "Elektrische Energiesysteme und Elektromobilität",
            "header": "7.2.1 Electrical Power Systems and Electromobility",
            "end": "7.2.2 Information and Communication Technology",
            "profiles": [
                "Electromobility",
                "Electric Drives",
                "Power Electronic Systems",
                "Renewables",
                "Electrochemical Systems",
                "Power Systems Engineering & Economics",
                "Superconductor Engineering"
            ]
        },
        {
            "id": "ICT",
            "name": "Information and Communication Technology",
            "germanName": "Informations- und Kommunikationstechnik",
            "header": "7.2.2 Information and Communication Technology",
            "end": "7.2.3 Automation, Robotics, and Systems Engineering",
            "profiles": [
                "Communication Systems",
                "Communication Algorithms and Theory",
                "Signal and Information Processing",
                "Microwave Systems",
                "Photonic Systems",
                "Embedded System Integration"
            ]
        },
        {
            "id": "MPQT",
            "name": "Microelectronics, Photonics, and Quantum Technologies",
            "germanName": "Mikroelektronik, Photonik und Quantentechnologien",
            "header": "7.2.4 Microelectronics, Photonics, and Quantum Technologies",
            "end": "7.3 Electives",
            "profiles": [
                "Microelectronics",
                "Radio Frequency Electronics",
                "Quantum Technologies",
                "Optics and Photonics"
            ]
        }
    ]

    result = []
    for s in specs_def:
        sub = sec7.split(s["header"])[1].split(s["end"])[0]

        funds = re.findall(r'Fundamentals \(Election: at least 24 credits\)(.*?)(?=Focus Area)', sub, re.DOTALL)
        fund_codes = re.findall(r'(M-[A-Z0-9\-]+)', funds[0]) if funds else []

        focus = re.findall(r'Focus Area \(Election: at least 24 credits\)(.*?)(?=Lab Course)', sub, re.DOTALL)
        focus_codes = re.findall(r'(M-[A-Z0-9\-]+)', focus[0]) if focus else []

        labs = re.findall(r'Lab Course \(Election: 1 item\)(.*?)(?=M\.Sc\. Electrical|7\.2|\Z)', sub, re.DOTALL)
        lab_codes = re.findall(r'(M-[A-Z0-9\-]+)', labs[0]) if labs else []

        fund_codes = list(dict.fromkeys(fund_codes))
        focus_codes = list(dict.fromkeys(focus_codes))
        lab_codes = list(dict.fromkeys(lab_codes))

        result.append({
            "id": s["id"],
            "name": s["name"],
            "germanName": s["germanName"],
            "fundamentalsNeeded": 24,
            "fundamentalsList": fund_codes,
            "focusModules": focus_codes,
            "labCourses": lab_codes,
            "focusProfiles": s["profiles"]
        })

    return result

def parse_modules(text, specializations):
    ch12_text = text.split('13 Module components')[0]
    pattern = r'(?:^|\n)\s*(?:M\s+)?12\.(\d+)\s+Module:\s*(.*?)\s*\[\s*(M-[\sA-Z0-9\-]+?)\s*\]'
    splits = list(re.finditer(pattern, ch12_text, re.DOTALL))
    print(f"Scanning {len(splits)} module sections in Chapter 12...")

    # Build maps
    spec_fund_map = {}
    spec_focus_map = {}
    spec_lab_map = {}
    for spec in specializations:
        spec_id = spec["id"]
        for fid in spec["fundamentalsList"]:
            spec_fund_map.setdefault(fid, set()).add(spec_id)
        for fc in spec["focusModules"]:
            spec_focus_map.setdefault(fc, set()).add(spec_id)
        for lc in spec["labCourses"]:
            spec_lab_map.setdefault(lc, set()).add(spec_id)

    modules_dict = {}

    for i in range(len(splits)):
        match = splits[i]
        index_num = match.group(1)
        title_raw = match.group(2)
        mod_id = ''.join(match.group(3).split()).strip()
        title = ' '.join(title_raw.split()).strip()

        start_pos = match.start()
        end_pos = splits[i+1].start() if i+1 < len(splits) else len(ch12_text)
        body = ch12_text[start_pos:end_pos]

        # Coordinators
        coord_match = re.search(r'Coordinators:\s*(.*?)(?=Organisation:)', body, re.DOTALL)
        coordinators = []
        if coord_match:
            lines = [l.strip() for l in coord_match.group(1).split('\n') if l.strip()]
            coordinators = lines

        # Organisation
        org_match = re.search(r'Organisation:\s*(.*?)(?=Part of:)', body, re.DOTALL)
        organisation = strip_headers_footers(org_match.group(1)) if org_match else "KIT Department ETIT"

        # Credits
        cr_match = re.search(r'Credits\s*\n\s*(\d+)\s*CP', body)
        credits = int(cr_match.group(1)) if cr_match else 6

        # Grading
        gr_match = re.search(r'Grading\s*\n\s*([a-zA-Z/]+)', body)
        grading = gr_match.group(1).strip() if gr_match else "graded"

        # Recurrence
        rec_match = re.search(r'Recurrence\s*\n\s*(.*?)(?=\n\s*Duration|\n\s*Language|\n\s*Level)', body, re.DOTALL)
        recurrence = ' '.join(rec_match.group(1).split()) if rec_match else "Each term"
        term = normalize_term(recurrence)

        # Duration
        dur_match = re.search(r'Duration\s*\n\s*(.*?)(?=\n\s*Language|\n\s*Level)', body, re.DOTALL)
        duration = ' '.join(dur_match.group(1).split()) if dur_match else "1 term"

        # Language
        lang_match = re.search(r'Language\s*\n\s*([a-zA-Z/]+)', body)
        language = lang_match.group(1).strip() if lang_match else "English"

        # Assessment
        assess_match = re.search(r'Assessment\s*\n(.*?)(?=\nPrerequisites|\nModeled Prerequisites|\nCompetence Goal|\nContent|\Z)', body, re.DOTALL)
        assessment = strip_headers_footers(assess_match.group(1)) if assess_match else ""

        # Prerequisites
        prereq_match = re.search(r'Prerequisites\s*\n(.*?)(?=\nModeled Prerequisites|\nCompetence Goal|\nContent|\Z)', body, re.DOTALL)
        prereq = strip_headers_footers(prereq_match.group(1)) if prereq_match else "None"

        # Modeled Prerequisites
        modeled_match = re.search(r'Modeled Prerequisites\s*\n(.*?)(?=\nCompetence Goal|\nContent|\Z)', body, re.DOTALL)
        modeled_prereq = strip_headers_footers(modeled_match.group(1)) if modeled_match else ""

        # Exclusions and required predecessors
        combined_prereqs = f"{prereq} {modeled_prereq}"
        exclusions = []
        requires = []

        not_started_matches = re.findall(r'(?:must not have been started|must not have started|must not be started|not allowed to take|is not allowed to be).*?(M-[A-Z0-9\-]+)', combined_prereqs, re.IGNORECASE)
        exclusions.extend(not_started_matches)

        only_one_matches = re.findall(r'Only one out of.*?(M-[A-Z0-9\-]+).*?(M-[A-Z0-9\-]+)', combined_prereqs)
        for pair in only_one_matches:
            for p in pair:
                if p != mod_id:
                    exclusions.append(p)

        if "Superconducting Magnet Technology" in combined_prereqs and mod_id == "M-ETIT-107135":
            requires.append("M-ETIT-106684")

        # Specific known exclusions
        if mod_id == "M-ETIT-100524": exclusions.append("M-ETIT-100513")
        if mod_id == "M-ETIT-100513": exclusions.append("M-ETIT-100524")
        if mod_id == "M-ETIT-102264": exclusions.append("M-ETIT-102266")
        if mod_id == "M-ETIT-102266": exclusions.append("M-ETIT-102264")
        if mod_id == "M-ETIT-107444": exclusions.append("M-ETIT-100453")
        if mod_id == "M-ETIT-100453": exclusions.append("M-ETIT-107444")

        # Competence Goal
        cg_match = re.search(r'Competence Goal\s*\n(.*?)(?=\nContent|\nWorkload|\nAssessment|\nModule Grade Calculation|\Z)', body, re.DOTALL)
        competence_goal = strip_headers_footers(cg_match.group(1)) if cg_match else ""

        # Content
        cnt_match = re.search(r'Content\s*\n(.*?)(?=\nModule Grade Calculation|\nWorkload|\nRecommendations|\nLiterature|\nAssessment|\Z)', body, re.DOTALL)
        content = strip_headers_footers(cnt_match.group(1)) if cnt_match else ""

        # Workload
        wl_match = re.search(r'Workload\s*\n(.*?)(?=\nRecommendations|\nLiterature|\nTeaching and Learning Methods|\Z)', body, re.DOTALL)
        workload = strip_headers_footers(wl_match.group(1)) if wl_match else f"{credits * 30} hours workload."

        # Recommendations & Literature
        rec_match = re.search(r'Recommendations\s*\n(.*?)(?=\nLiterature|\nTeaching and Learning Methods|\Z)', body, re.DOTALL)
        recommendations = strip_headers_footers(rec_match.group(1)) if rec_match else ""

        lit_match = re.search(r'Literature\s*\n(.*?)(?=\nTeaching and Learning Methods|\Z)', body, re.DOTALL)
        literature = strip_headers_footers(lit_match.group(1)) if lit_match else ""

        # Lab classification
        is_lab = False
        title_lower = title.lower()
        if "lab" in title_lower or "praktikum" in title_lower or "laboratory" in title_lower or "workshop" in title_lower:
            is_lab = True
        if mod_id in spec_lab_map:
            is_lab = True

        # Categories & specializations
        categories = set()
        applicable_specs = set()

        if mod_id == "M-ETIT-107191":
            categories.add("Master's Thesis")
        elif mod_id == "M-ETIT-105803":
            categories.add("Interdisciplinary Qualifications")
        else:
            if mod_id in spec_fund_map:
                categories.add("Fundamentals")
                applicable_specs.update(spec_fund_map[mod_id])
            if mod_id in spec_focus_map:
                categories.add("Focus Area")
                applicable_specs.update(spec_focus_map[mod_id])
            if mod_id in spec_lab_map:
                categories.add("Lab Course")
                applicable_specs.update(spec_lab_map[mod_id])

            categories.add("Electives")

        if mod_id in modules_dict:
            # Merge if already encountered
            existing = modules_dict[mod_id]
            merged_cats = sorted(list(set(existing["categories"] + list(categories))))
            merged_specs = sorted(list(set(existing["applicableSpecializations"] + list(applicable_specs))))
            existing["categories"] = merged_cats
            existing["applicableSpecializations"] = merged_specs
            if is_lab: existing["isLab"] = True
        else:
            modules_dict[mod_id] = {
                "id": mod_id,
                "title": title,
                "credits": credits,
                "term": term,
                "termString": recurrence,
                "duration": duration,
                "language": language,
                "grading": grading,
                "coordinators": coordinators,
                "organisation": organisation,
                "categories": sorted(list(categories)),
                "applicableSpecializations": sorted(list(applicable_specs)),
                "isLab": is_lab,
                "examType": assessment or "Oral / Written examination",
                "prerequisites": prereq,
                "modeledPrerequisites": modeled_prereq,
                "exclusions": sorted(list(set(exclusions))),
                "requires": sorted(list(set(requires))),
                "competenceGoal": competence_goal,
                "content": content,
                "workload": workload,
                "recommendations": recommendations,
                "literature": literature
            }

    return modules_dict

def main():
    print(f"Reading {TEXT_FILE}...")
    with open(TEXT_FILE, "r", encoding="utf-8") as f:
        text = f.read()

    specializations = parse_specialization_structure(text)
    print(f"Extracted {len(specializations)} specializations.")

    modules = parse_modules(text, specializations)
    print(f"Extracted {len(modules)} unique modules successfully.")

    # Save to data/modules.json
    modules_json_path = os.path.join(DATA_DIR, "modules.json")
    with open(modules_json_path, "w", encoding="utf-8") as f:
        json.dump(modules, f, indent=2, ensure_ascii=False)
    print(f"Saved {modules_json_path}")

    # Save to data/specializations.json
    spec_json_path = os.path.join(DATA_DIR, "specializations.json")
    with open(spec_json_path, "w", encoding="utf-8") as f:
        json.dump(specializations, f, indent=2, ensure_ascii=False)
    print(f"Saved {spec_json_path}")

    # Build rules.json
    rules = {
        "degree": "M.Sc. Electrical Engineering and Information Technology",
        "spo": 2025,
        "totalCreditsTarget": 120,
        "specializationCreditsTarget": 60,
        "fundamentalsCredits": 24,
        "fundamentalsCount": 4,
        "specializationLabCount": 1,
        "focusAreaMinCredits": 24,
        "electivesCreditsTarget": 24,
        "electivesMaxLabs": 1,
        "interdisciplinaryCreditsTarget": 6,
        "thesisCredits": 30,
        "thesisPrerequisiteCredits": 75,
        "knownExclusions": [
            {
                "pair": ["M-ETIT-100524", "M-ETIT-100513"],
                "reason": "Solar Energy and Photovoltaics are mutually exclusive."
            },
            {
                "pair": ["M-ETIT-102264", "M-ETIT-102266"],
                "reason": "Digital Hardware Design Lab (German) and (English) are mutually exclusive."
            },
            {
                "pair": ["M-ETIT-107444", "M-ETIT-100453"],
                "reason": "Hardware/Software Co-Design (6 CP) replaces (4 CP)."
            },
            {
                "pair": ["M-MACH-100501", "M-MACH-102686"],
                "reason": "Automotive Engineering I modules are mutually exclusive."
            },
            {
                "pair": ["M-MACH-102388", "M-MACH-101924"],
                "reason": "Thermal Solar Energy modules are mutually exclusive."
            },
            {
                "pair": ["M-ETIT-100552", "M-ETIT-103252"],
                "reason": "Optical Systems in Medicine modules are mutually exclusive."
            }
        ]
    }
    rules_json_path = os.path.join(DATA_DIR, "rules.json")
    with open(rules_json_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, indent=2, ensure_ascii=False)
    print(f"Saved {rules_json_path}")

    # Save to public/js/all_data.js for standalone browser client execution
    all_data_js_path = os.path.join(PUBLIC_JS_DIR, "all_data.js")
    with open(all_data_js_path, "w", encoding="utf-8") as f:
        f.write("// Complete parsed dataset from official KIT M.Sc. ETIT Module Handbook (SPO 2025)\n")
        f.write("var rootScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);\n")
        f.write("rootScope.ALL_MODULES_DATA = ")
        json.dump(modules, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("rootScope.ALL_SPECIALIZATIONS_DATA = ")
        json.dump(specializations, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("rootScope.ALL_RULES_DATA = ")
        json.dump(rules, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    print(f"Saved {all_data_js_path}")

if __name__ == "__main__":
    main()
