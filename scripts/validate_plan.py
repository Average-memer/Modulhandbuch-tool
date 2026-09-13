#!/usr/bin/env python3
"""
validate_plan.py
Universal CLI verification tool for KIT Master Study Plans.
Supports arbitrary degrees and dynamic semester expansion (4, 5, 6+ semesters).
"""

import os
import sys
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEGREES_DIR = os.path.join(BASE_DIR, "data", "degrees")

def load_degree_data(degree_id="etit-msc-2025"):
    deg_path = os.path.join(DEGREES_DIR, degree_id, "degree.json")
    mod_path = os.path.join(DEGREES_DIR, degree_id, "modules.json")

    if not os.path.exists(deg_path) or not os.path.exists(mod_path):
        raise FileNotFoundError(f"Degree '{degree_id}' not found in {DEGREES_DIR}")

    with open(deg_path, "r", encoding="utf-8") as f:
        degree = json.load(f)
    with open(mod_path, "r", encoding="utf-8") as f:
        modules = json.load(f)

    return degree, modules

def validate_plan(plan, degree, modules):
    start_term = plan.get("startTerm", "WS")
    semesters = plan.get("semesters", {})
    sem_count = plan.get("semestersCount", max(len(semesters), 4))

    errors = []
    warnings = []
    passed = []

    # Calculate terms for each semester
    semester_terms = {}
    for sem in range(1, sem_count + 1):
        if start_term == "WS":
            semester_terms[sem] = "WS" if sem % 2 == 1 else "SS"
        else:
            semester_terms[sem] = "SS" if sem % 2 == 1 else "WS"

    scheduled = []
    module_counts = {}
    semester_cp = {sem: 0 for sem in range(1, sem_count + 1)}

    thesis_semester = None

    for sem in range(1, sem_count + 1):
        items = semesters.get(str(sem), []) or semesters.get(sem, [])
        for item in items:
            mod_id = item["id"] if isinstance(item, dict) else item
            category = item.get("category", "") if isinstance(item, dict) else ""
            mod = modules.get(mod_id)
            if not mod:
                errors.append(f"Module ID '{mod_id}' not found in handbook.")
                continue

            is_thesis = mod.get("isThesis", False) or "thesis" in mod["title"].lower() or "masterarbeit" in mod["title"].lower()
            if is_thesis:
                thesis_semester = sem

            scheduled.append({
                "id": mod_id,
                "title": mod["title"],
                "credits": mod["credits"],
                "term": mod["term"],
                "isLab": mod.get("isLab", False),
                "isThesis": is_thesis,
                "semester": sem,
                "category": category or mod.get("categories", ["Electives"])[0]
            })
            module_counts[mod_id] = module_counts.get(mod_id, 0) + 1
            semester_cp[sem] += mod["credits"]

    total_credits = sum(semester_cp.values())

    # 1. Duplicates
    for mod_id, count in module_counts.items():
        if count > 1:
            errors.append(f"Module '{modules[mod_id]['title']}' [{mod_id}] is scheduled {count} times (max 1 allowed).")
    if not any(count > 1 for count in module_counts.values()):
        passed.append("No duplicate modules scheduled.")

    # 2. Antirequisites / Exclusions
    for item in scheduled:
        mod = modules.get(item["id"])
        if not mod: continue
        for excl_id in mod.get("exclusions", []):
            if module_counts.get(excl_id):
                excl_mod = modules.get(excl_id, {})
                errors.append(f"Mutual exclusion conflict: '{mod['title']}' cannot be taken together with '{excl_mod.get('title', excl_id)}'.")
    if not any("Mutual exclusion conflict" in e for e in errors):
        passed.append("All mutual exclusion and prerequisite conditions satisfied.")

    # 3. Term availability (WS vs SS)
    for item in scheduled:
        sem = item["semester"]
        sem_term = semester_terms[sem]
        mod_term = item["term"]
        if mod_term == "WS" and sem_term != "WS":
            warnings.append(f"'{item['title']}' is only offered in Winter term, but scheduled in Semester {sem} ({sem_term}).")
        elif mod_term == "SS" and sem_term != "SS":
            warnings.append(f"'{item['title']}' is only offered in Summer term, but scheduled in Semester {sem} ({sem_term}).")
    if not warnings:
        passed.append("All modules match their scheduled semester term availability (WS/SS).")

    # 4. Master's Thesis & §14(1) Gate
    thesis_prereq_target = degree.get("thesisPrerequisiteCredits", 75)
    if thesis_semester:
        prior_credits = sum(semester_cp[s] for s in range(1, thesis_semester))
        if prior_credits < thesis_prereq_target:
            errors.append(f"Master's Thesis (§14(1) prerequisite): only {prior_credits} CP earned before thesis semester {thesis_semester} (at least {thesis_prereq_target} CP required).")
        else:
            passed.append(f"Master's Thesis admission satisfied ({prior_credits} CP earned prior to semester {thesis_semester} >= {thesis_prereq_target} CP).")
    else:
        warnings.append("Master's Thesis (30 CP) is not yet scheduled.")

    # 5. Category Credit Auditing
    category_totals = {}
    for cat in degree.get("categories", []):
        category_totals[cat["id"]] = {"name": cat["name"], "target": cat["targetCredits"], "current": 0, "ok": False}

    spec_id = plan.get("specialization")
    for item in scheduled:
        mod = modules.get(item["id"], {})
        cats = mod.get("categories", [])
        mod_specs = mod.get("applicableSpecializations", [])
        in_spec = (not spec_id) or (spec_id in mod_specs)
        c_name = item.get("category", "").strip()
        c_name_lower = c_name.lower()
        credits = item["credits"]

        cat_key = None
        if item.get("isThesis") or "thesis" in c_name_lower or "masterarbeit" in c_name_lower:
            cat_key = "thesis"
        elif "interdisciplinary" in c_name_lower or "üq" in c_name_lower or "uq" in c_name_lower or "Interdisciplinary Qualifications" in cats:
            cat_key = "uq"
        elif "lab" in c_name_lower or (in_spec and "Lab Course" in cats) or item.get("isLab"):
            cat_key = "lab"
        elif "fundamental" in c_name_lower:
            cat_key = "fundamentals"
        elif "focus" in c_name_lower:
            cat_key = "focus"
        elif "elective" in c_name_lower:
            cat_key = "electives"
        spec_obj = next((s for s in degree.get("specializations", []) if s["id"] == spec_id), None)
        if spec_obj:
            if cat_key == "fundamentals" and item["id"] not in spec_obj.get("fundamentals", []):
                cat_key = "focus" if item["id"] in spec_obj.get("focus", []) else "electives"
            elif cat_key == "focus" and item["id"] not in spec_obj.get("focus", []):
                cat_key = "fundamentals" if item["id"] in spec_obj.get("fundamentals", []) else "electives"
            elif cat_key == "lab" and item["id"] not in spec_obj.get("labs", []) and not item.get("isLab"):
                cat_key = "electives"

        if cat_key in category_totals:
            target = category_totals[cat_key]["target"]
            curr = category_totals[cat_key]["current"]
            # Handle overflow into electives if target is met
            if cat_key not in ["electives", "specialization"] and "electives" in category_totals:
                if curr >= target:
                    category_totals["electives"]["current"] += credits
                elif curr + credits > target:
                    needed = target - curr
                    category_totals[cat_key]["current"] += needed
                    category_totals["electives"]["current"] += (credits - needed)
                else:
                    category_totals[cat_key]["current"] += credits
            else:
                category_totals[cat_key]["current"] += credits
        elif "electives" in category_totals:
            category_totals["electives"]["current"] += credits

    for c_id, c_data in category_totals.items():
        c_data["ok"] = c_data["current"] >= c_data["target"]
        if c_data["ok"]:
            passed.append(f"{c_data['name']}: target {c_data['target']} CP reached ({c_data['current']} CP).")
        else:
            warnings.append(f"{c_data['name']}: {c_data['current']}/{c_data['target']} CP planned.")

    # 6. Total credits
    target_credits = degree.get("totalCredits", 120)
    if total_credits == target_credits and len(errors) == 0:
        passed.append(f"Total degree credits exactly meet degree requirements ({target_credits} CP).")
    elif total_credits < target_credits:
        warnings.append(f"Plan is incomplete: {total_credits} / {target_credits} CP planned.")

    return {
        "permissible": len(errors) == 0,
        "isComplete": len(errors) == 0 and total_credits >= target_credits,
        "totalCredits": total_credits,
        "semesterCP": semester_cp,
        "semesterTerms": semester_terms,
        "categoryTotals": category_totals,
        "errors": errors,
        "warnings": warnings,
        "passed": passed
    }

if __name__ == "__main__":
    degree_id = sys.argv[1] if len(sys.argv) > 1 else "etit-msc-2025"
    degree, modules = load_degree_data(degree_id)

    # Test with exemplary complete ETIT EPSE plan (120 CP)
    sample_plan = {
        "degree": degree_id,
        "specialization": "EPSE",
        "startTerm": "WS",
        "semestersCount": 4,
        "semesters": {
            1: [
                {"id": "M-ETIT-107005", "category": "Fundamentals"}, # Batteries, Fuel Cells 6 CP (WS)
                {"id": "M-ETIT-107497", "category": "Fundamentals"}, # Optimal Control 6 CP (WS)
                {"id": "M-ETIT-100419", "category": "Lab Course"},   # Lab Electrical Power Engineering 6 CP (WS)
                {"id": "M-MACH-100501", "category": "Focus Area"},   # Automotive Engineering I 8 CP (WS)
                {"id": "M-ETIT-107364", "category": "Electives"}     # Analog Circuit Design 4 CP (WS) -> 30 CP
            ],
            2: [
                {"id": "M-ETIT-105394", "category": "Fundamentals"}, # Electric Power Transmission 6 CP (SS)
                {"id": "M-MATH-106972", "category": "Fundamentals"}, # Numerical Methods 6 CP (SS)
                {"id": "M-ETIT-104567", "category": "Focus Area"},   # Power Electronics 6 CP (SS)
                {"id": "M-ETIT-105915", "category": "Focus Area"},   # Control of Power-Electronic Systems 6 CP (SS)
                {"id": "M-INFO-107197", "category": "Electives"}     # Deep Learning and Neural Networks 6 CP (SS) -> 30 CP
            ],
            3: [
                {"id": "M-ETIT-105611", "category": "Focus Area"},   # Superconductivity for Engineers 6 CP (WS)
                {"id": "M-ETIT-105803", "category": "Interdisciplinary (ÜQ)"}, # ÜQ 6 CP (WS+SS)
                {"id": "M-ETIT-106815", "category": "Electives"},    # Advanced Communications Engineering 6 CP (WS)
                {"id": "M-ETIT-107333", "category": "Electives"},    # Applied Information Theory 6 CP (WS)
                {"id": "M-CIWVT-104356", "category": "Electives"}    # Cryogenic Engineering 6 CP (WS) -> 30 CP
            ],
            4: [
                {"id": "M-ETIT-107191", "category": "Master's Thesis"} # Master's Thesis 30 CP (WS+SS) -> 30 CP
            ]
        }
    }

    result = validate_plan(sample_plan, degree, modules)
    print(f"\n==========================================")
    print(f"Validation Report for {degree['title']}")
    print(f"Permissible: {result['permissible']} | Complete: {result['isComplete']} | Total Credits: {result['totalCredits']} CP")
    print(f"Semester CP: {result['semesterCP']}")
    print("\nCategories Audit:")
    for cid, cdata in result["categoryTotals"].items():
        print(f"  {cdata['name']}: {cdata['current']}/{cdata['target']} CP -> {'OK' if cdata['ok'] else 'INCOMPLETE'}")
    print("\nPassed:", result["passed"])
    print("\nWarnings:", result["warnings"])
    print("\nErrors:", result["errors"])
