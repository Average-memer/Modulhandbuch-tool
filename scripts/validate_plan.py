#!/usr/bin/env python3
"""
validate_plan.py
Command-line verification tool for KIT M.Sc. ETIT Study Plans (SPO 2025).
"""

import os
import sys
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_data():
    with open(os.path.join(DATA_DIR, "modules.json"), "r", encoding="utf-8") as f:
        modules = json.load(f)
    with open(os.path.join(DATA_DIR, "specializations.json"), "r", encoding="utf-8") as f:
        specializations = json.load(f)
    with open(os.path.join(DATA_DIR, "rules.json"), "r", encoding="utf-8") as f:
        rules = json.load(f)
    return modules, specializations, rules

def validate_plan(plan, modules, specializations, rules):
    spec_id = plan.get("specialization", "ARSE")
    start_term = plan.get("startTerm", "WS")
    semesters = plan.get("semesters", {})

    spec = next((s for s in specializations if s["id"] == spec_id), None)
    if not spec:
        return {"permissible": False, "errors": [f"Specialization '{spec_id}' not recognized."]}

    errors = []
    warnings = []
    passed = []

    # Semester terms
    semester_terms = {}
    for sem in range(1, 5):
        if start_term == "WS":
            semester_terms[sem] = "WS" if sem % 2 == 1 else "SS"
        else:
            semester_terms[sem] = "SS" if sem % 2 == 1 else "WS"

    scheduled = []
    module_counts = {}
    semester_cp = {1: 0, 2: 0, 3: 0, 4: 0}

    for sem in range(1, 5):
        items = semesters.get(str(sem), []) or semesters.get(sem, [])
        for item in items:
            mod_id = item["id"] if isinstance(item, dict) else item
            category = item.get("category", "") if isinstance(item, dict) else ""
            mod = modules.get(mod_id)
            if not mod:
                errors.append(f"Module ID '{mod_id}' not found in handbook.")
                continue

            scheduled.append({
                "id": mod_id,
                "title": mod["title"],
                "credits": mod["credits"],
                "term": mod["term"],
                "isLab": mod.get("isLab", False),
                "semester": sem,
                "category": category or ("Fundamentals" if mod_id in spec["fundamentalsList"] else ("Lab Course" if mod.get("isLab") else "Electives"))
            })
            module_counts[mod_id] = module_counts.get(mod_id, 0) + 1
            semester_cp[sem] += mod["credits"]

    total_credits = sum(semester_cp.values())

    # 1. Duplicates
    for mod_id, count in module_counts.items():
        if count > 1:
            errors.append(f"Module '{modules[mod_id]['title']}' [{mod_id}] is scheduled {count} times (max 1 allowed).")

    # 2. Known exclusions
    for excl in rules.get("knownExclusions", []):
        id_a, id_b = excl["pair"]
        if module_counts.get(id_a) and module_counts.get(id_b):
            errors.append(f"Mutual Exclusion Conflict: {excl['reason']}")

    # 3. Term availability
    for item in scheduled:
        sem = item["semester"]
        sem_term = semester_terms[sem]
        mod_term = item["term"]
        if mod_term == "WS" and sem_term != "WS":
            warnings.append(f"'{item['title']}' is only offered in Winter term, but scheduled in Semester {sem} ({sem_term}).")
        elif mod_term == "SS" and sem_term != "SS":
            warnings.append(f"'{item['title']}' is only offered in Summer term, but scheduled in Semester {sem} ({sem_term}).")

    # 4. Categories breakdown
    fund_cp = sum(it["credits"] for it in scheduled if it["category"] == "Fundamentals")
    focus_cp = sum(it["credits"] for it in scheduled if it["category"] == "Focus Area")
    spec_labs = [it for it in scheduled if it["category"] == "Lab Course"]
    elec_cp = sum(it["credits"] for it in scheduled if it["category"] == "Electives")
    elec_labs = [it for it in scheduled if it["category"] == "Electives" and it["isLab"]]
    uq_cp = sum(it["credits"] for it in scheduled if it["category"] in ["Interdisciplinary Qualifications", "UQ"])
    thesis_items = [it for it in scheduled if it["category"] == "Master's Thesis" or it["id"] == "M-ETIT-107191"]
    thesis_cp = sum(it["credits"] for it in thesis_items)

    # Fundamentals rule
    if fund_cp < 24:
        errors.append(f"Fundamentals requirement not met: {fund_cp}/24 CP selected. Choose 4 modules (6 CP each) from {spec['name']}.")
    else:
        passed.append(f"Fundamentals requirement satisfied: {fund_cp}/24 CP.")

    # Lab course rule
    if len(spec_labs) == 0:
        errors.append(f"Specialization requires exactly 1 Lab Course (currently 0 selected).")
    elif len(spec_labs) > 1:
        errors.append(f"Specialization allows exactly 1 Lab Course (currently {len(spec_labs)} selected).")
    else:
        passed.append(f"Specialization Lab satisfied: {spec_labs[0]['title']} ({spec_labs[0]['credits']} CP).")

    if len(elec_labs) > 1:
        errors.append(f"At most 1 Lab Course allowed in Electives (currently {len(elec_labs)} selected).")

    # Focus Area + Spec total rule
    spec_total = fund_cp + focus_cp + sum(l["credits"] for l in spec_labs)
    if focus_cp < 24:
        errors.append(f"Focus Area requires at least 24 CP (currently {focus_cp} CP).")
    elif spec_total < 60:
        errors.append(f"Field of Specialization total is {spec_total}/60 CP. Need {60 - spec_total} more CP.")
    else:
        passed.append(f"Field of Specialization total satisfied: {spec_total}/60 CP.")

    # Electives rule
    if elec_cp < 24:
        warnings.append(f"Electives: {elec_cp}/24 CP selected.")
    else:
        passed.append(f"Electives satisfied: {elec_cp}/24 CP.")

    # UQ rule
    if uq_cp < 6:
        errors.append(f"Interdisciplinary Qualifications (ÜQ) requires at least 6 CP (currently {uq_cp}/6 CP).")
    else:
        passed.append(f"Interdisciplinary Qualifications satisfied: {uq_cp}/6 CP.")

    # Thesis rule
    if thesis_cp < 30:
        errors.append(f"Master's Thesis (30 CP) is not scheduled.")
    else:
        passed.append(f"Master's Thesis scheduled: 30 CP.")
        thesis_sem = thesis_items[0]["semester"]
        prior_cp = sum(semester_cp[s] for s in range(1, thesis_sem))
        if prior_cp < 75:
            errors.append(f"Master's Thesis prerequisite unmet: SPO §14(1) requires >= 75 CP prior to thesis semester. Planned: {prior_cp} CP.")
        else:
            passed.append(f"Thesis prerequisite met ({prior_cp} CP completed prior to semester {thesis_sem}).")

    is_permissible = (len(errors) == 0)
    is_complete = is_permissible and (total_credits >= 120)

    return {
        "permissible": is_permissible,
        "isComplete": is_complete,
        "totalCredits": total_credits,
        "semesterCP": semester_cp,
        "errors": errors,
        "warnings": warnings,
        "passed": passed
    }

def main():
    modules, specializations, rules = load_data()
    print(f"Loaded {len(modules)} modules, {len(specializations)} specializations.")

    # Test official exemplary plan
    sample_plan = {
        "specialization": "ARSE",
        "startTerm": "WS",
        "semesters": {
            "1": [
                {"id": "M-ETIT-107497", "category": "Fundamentals"},
                {"id": "M-ETIT-106899", "category": "Fundamentals"},
                {"id": "M-ETIT-106789", "category": "Focus Area"},
                {"id": "M-ETIT-100420", "category": "Focus Area"},
                {"id": "M-ETIT-106040", "category": "Focus Area"},
                {"id": "M-ETIT-107440", "category": "Electives"}
            ],
            "2": [
                {"id": "M-ETIT-106953", "category": "Fundamentals"},
                {"id": "M-ETIT-105881", "category": "Focus Area"},
                {"id": "M-ETIT-100434", "category": "Focus Area"},
                {"id": "M-ETIT-107524", "category": "Lab Course"},
                {"id": "M-ETIT-100539", "category": "Electives"},
                {"id": "M-INFO-107197", "category": "Electives"}
            ],
            "3": [
                {"id": "M-ETIT-100537", "category": "Fundamentals"},
                {"id": "M-ETIT-107515", "category": "Focus Area"},
                {"id": "M-ETIT-103264", "category": "Focus Area"},
                {"id": "M-ETIT-107294", "category": "Electives"},
                {"id": "M-ETIT-106780", "category": "Electives"},
                {"id": "M-ETIT-105803", "category": "Interdisciplinary Qualifications"}
            ],
            "4": [
                {"id": "M-ETIT-107191", "category": "Master's Thesis"}
            ]
        }
    }

    print("\n--- Validating Official Exemplary Plan ---")
    res = validate_plan(sample_plan, modules, specializations, rules)
    print(f"Permissible: {res['permissible']}, Complete: {res['isComplete']}, Total CP: {res['totalCredits']}")
    print(f"Errors ({len(res['errors'])}):", res["errors"])
    print(f"Warnings ({len(res['warnings'])}):", res["warnings"])
    print(f"Passed rules ({len(res['passed'])}):")
    for p in res["passed"]:
        print(f"  ✓ {p}")

if __name__ == "__main__":
    main()
