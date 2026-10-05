#!/usr/bin/env python3
"""
universal_parser.py
Universal parser for KIT Master Module Handbooks (German and English).
Extracts:
- Degree metadata (Title, SPO, Faculty, Term, Credits, Semesters)
- Specializations / Tracks
- Categories & Credit Quotas
- Modules with comprehensive metadata, exclusions, and category mapping
"""

import os
import re
import sys
import json
import subprocess

def strip_page_artifacts(text):
    if not text:
        return ""
    # Remove page break delimiters
    text = re.sub(r'---\s*PAGE\s*\d+\s*---', ' ', text)
    # Remove generic running header text
    text = re.sub(r'\b(?:Module\s+Handbook|Modulhandbuch)\s+(?:as\s+of|mit\s+Stand\s+vom|Stand)\s+[\d\.\/]+(?:\s*\d+)?', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'M\.Sc\.\s+.*?(?:\(Master of Science\)|Masterarbeit|Master\'s Thesis)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\d+\s+MODULES\s+Module:\s+.*?(?=\n|$)', ' ', text, flags=re.IGNORECASE)
    text = re.sub(r'\bM\s+\d+\.\d+\s+Module:.*?(?=\n|$)', ' ', text, flags=re.IGNORECASE)
    # Strip excessive blank lines and leading/trailing whitespace
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return '\n'.join(lines).strip()

def normalize_term(rec_text):
    if not rec_text:
        return "WS+SS"
    t = rec_text.lower()
    if ("winter" in t and "sommer" in t) or ("winter" in t and "summer" in t):
        return "WS+SS"
    if "jedes semester" in t or "each term" in t or "jedes zweite" in t:
        return "WS+SS"
    if "winter" in t:
        return "WS"
    if "sommer" in t or "summer" in t:
        return "SS"
    return "WS+SS"

def normalize_language(lang_text):
    if not lang_text:
        return "English"
    l = lang_text.strip().lower()
    if "deutsch" in l and ("englisch" in l or "english" in l):
        return "German/English"
    if "german" in l and "english" in l:
        return "German/English"
    if "deutsch" in l or "german" in l:
        return "German"
    if "englisch" in l or "english" in l:
        return "English"
    return lang_text.strip()

def extract_degree_metadata(cover_text, filename=""):
    """Extracts degree title, SPO year, semester, and faculty from cover text."""
    lines = [l.strip() for l in cover_text.split('\n') if l.strip()]
    
    title = ""
    spo = 2025
    term_str = "Summer Semester 2026"
    faculty = "Karlsruhe Institute of Technology"
    
    # Try to find Title
    for i, line in enumerate(lines[:12]):
        if re.match(r'^(?:Module\s+Handbook|Modulhandbuch)$', line, re.IGNORECASE):
            # The next 1-3 lines usually contain the title
            title_parts = []
            for next_line in lines[i+1:i+4]:
                if re.match(r'^(?:SPO\s+\d+|Sommersemester|Wintersemester|Summer\s+semester|Winter\s+term|Stand|Date|KIT)', next_line, re.IGNORECASE):
                    break
                title_parts.append(next_line)
            title = ' '.join(title_parts).strip()
            break
            
    if not title:
        # Fallback from filename
        base = os.path.basename(filename).replace(".pdf", "")
        title = base.replace("_", " ").replace("-", " ")
        
    # SPO match
    spo_m = re.search(r'SPO\s+(\d{4})', cover_text, re.IGNORECASE)
    if spo_m:
        spo = int(spo_m.group(1))
    else:
        spo_m2 = re.search(r'\b(201\d|202\d)\b', cover_text)
        if spo_m2:
            spo = int(spo_m2.group(1))
            
    # Term match
    term_m = re.search(r'((?:Sommersemester|Wintersemester|Summer\s+semester|Winter\s+semester)\s+[\d\/]+)', cover_text, re.IGNORECASE)
    if term_m:
        term_str = term_m.group(1).strip()
        
    # Faculty match
    fac_m = re.search(r'(KIT[\s\-]*(?:FAKULTÄT|DEPARTMENT|Fakultät|Department)\s+[^\n]+)', cover_text, re.IGNORECASE)
    if fac_m:
        faculty = fac_m.group(1).strip().title()

    # Generate slug ID
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', title.lower()).strip('-')
    if not slug:
        slug = "kit-master"
    if not slug.endswith(str(spo)):
        slug = f"{slug}-{spo}"
    # Keep slug reasonably short
    slug_parts = slug.split('-')
    if len(slug_parts) > 5:
        slug = '-'.join(slug_parts[:5]) + f"-{spo}"

    return {
        "id": slug,
        "title": title,
        "spo": spo,
        "term": term_str,
        "faculty": faculty,
        "totalCredits": 120,
        "semestersCount": 4,
        "thesisCredits": 30,
        "thesisPrerequisiteCredits": 75
    }

def clean_specialization_name(raw):
    name = re.sub(r'^(?:Vertiefung|Area of Specialization|Specialization|Field of Specialisation|Major in Physics|Major):\s*', '', raw, flags=re.IGNORECASE).strip()
    name = re.sub(r'\s*\([^\)]*\)', '', name).strip()
    name = re.sub(r'^(?:Dr\.-Ing\.|Prof\.|KIT-Fakultät)[^\n]*', '', name).strip()
    return name

def parse_handbook_text(text, filename=""):
    # Split Cover (first 2 pages)
    pages = text.split('--- PAGE ')
    cover_text = ""
    if len(pages) > 1:
        cover_text = '--- PAGE '.join(pages[:3])
    else:
        cover_text = text[:3000]
        
    degree_meta = extract_degree_metadata(cover_text, filename)
    
    # Split text into Module section and Teilleistungen section
    split_tl = re.split(
        r'\b(?:\d+\s+TEILLEISTUNGEN|\d+\s+Teilleistungen|\d+\s+MODULE\s+COMPONENTS|\d+\s+Module\s+components)\b',
        text,
        flags=re.IGNORECASE
    )
    catalog_text = split_tl[0]
    
    # Module header regex
    mod_pattern = re.compile(
        r'(?:^|\n)\s*(?:M\s+)?(?:\d+\.\d+|\d+)\s+(?:Modul|Module):\s*(.*?)\s*\[\s*(M-[\sA-Z0-9\-]+?)\s*\]',
        re.IGNORECASE
    )
    splits = list(mod_pattern.finditer(catalog_text))
    
    modules = {}
    specialization_candidates = {}
    part_of_set = set()
    
    for i in range(len(splits)):
        match = splits[i]
        title_raw = match.group(1).strip()
        mod_id = ''.join(match.group(2).split()).strip()
        
        # Clean up title
        title = re.sub(r'\s+', ' ', title_raw).strip()
        
        start_pos = match.start()
        end_pos = splits[i+1].start() if i+1 < len(splits) else len(catalog_text)
        body = catalog_text[start_pos:end_pos]
        
        # Credits
        cr_m = re.search(r'(?:Credits|Leistungspunkte)\s*\n?\s*(\d+)', body, re.IGNORECASE)
        credits = int(cr_m.group(1)) if cr_m else 6
        
        # Recurrence / Turnus
        rec_m = re.search(
            r'(?:Recurrence|Turnus)\s*\n?\s*(.*?)(?=\n\s*(?:Duration|Dauer|Language|Sprache|Level|Notenskala|Grading))',
            body,
            re.DOTALL | re.IGNORECASE
        )
        recurrence_raw = ' '.join(rec_m.group(1).split()) if rec_m else "Each term"
        term = normalize_term(recurrence_raw)
        
        # Duration / Dauer
        dur_m = re.search(
            r'(?:Duration|Dauer)\s*\n?\s*(.*?)(?=\n\s*(?:Language|Sprache|Level|Notenskala|Grading))',
            body,
            re.DOTALL | re.IGNORECASE
        )
        duration = ' '.join(dur_m.group(1).split()) if dur_m else "1 term"
        
        # Language / Sprache
        lang_m = re.search(r'(?:Language|Sprache)\s*\n?\s*([a-zA-ZäöüÄÖÜ/]+)', body, re.IGNORECASE)
        language = normalize_language(lang_m.group(1)) if lang_m else "English"
        
        # Grading / Notenskala
        gr_m = re.search(r'(?:Grading|Notenskala)\s*\n?\s*([a-zA-ZäöüÄÖÜ/]+)', body, re.IGNORECASE)
        grading = gr_m.group(1).strip() if gr_m else "graded"
        
        # Coordinators / Verantwortung
        coord_m = re.search(r'(?:Coordinators|Verantwortung):\s*(.*?)(?=\n\s*(?:Organisation|Einrichtung):)', body, re.DOTALL | re.IGNORECASE)
        coordinators = []
        if coord_m:
            coordinators = [l.strip() for l in coord_m.group(1).split('\n') if l.strip()]
            
        # Organisation / Einrichtung
        org_m = re.search(r'(?:Organisation|Einrichtung):\s*(.*?)(?=\n\s*(?:Part of|Bestandteil von|Credits|Leistungspunkte):)', body, re.DOTALL | re.IGNORECASE)
        organisation = org_m.group(1).strip().replace('\n', ' ') if org_m else degree_meta["faculty"]
        
        # Part of / Bestandteil von
        part_of = []
        part_m = re.search(r'(?:Part of|Bestandteil von):\s*(.*?)(?=\n\s*(?:Credits|Leistungspunkte|Voraussetzung für|Prerequisite for):)', body, re.DOTALL | re.IGNORECASE)
        if part_m:
            raw_parts = part_m.group(1).replace('\n', ' ')
            # Often separated by comma or multiple entries
            for p in re.split(r'[,;]|\s{2,}', raw_parts):
                p_clean = p.strip()
                if p_clean and len(p_clean) > 2:
                    part_of.append(p_clean)
                    part_of_set.add(p_clean)
                    
                    # Track potential specializations
                    if any(k in p_clean for k in ["Vertiefung", "Area of Specialization", "Specialization", "Major", "Schwerpunkt"]):
                        spec_name = clean_specialization_name(p_clean)
                        if spec_name and len(spec_name) > 3 and not spec_name.startswith("Dr.") and not spec_name.startswith("Prof."):
                            specialization_candidates.setdefault(spec_name, set()).add(mod_id)

        # Assessment / Erfolgskontrolle
        assess_m = re.search(r'(?:Assessment|Erfolgskontrolle(?:\(en\))?)\s*\n(.*?)(?=\n\s*(?:Prerequisites|Voraussetzungen|Qualifikationsziele|Competence Goal|Content|Inhalt|\Z))', body, re.DOTALL | re.IGNORECASE)
        assessment = strip_page_artifacts(assess_m.group(1)) if assess_m else ""
        
        # Prerequisites / Voraussetzungen
        prereq_m = re.search(r'(?:Prerequisites|Voraussetzungen)\s*\n(.*?)(?=\n\s*(?:Modeled Prerequisites|Qualifikationsziele|Competence Goal|Content|Inhalt|\Z))', body, re.DOTALL | re.IGNORECASE)
        prerequisites = strip_page_artifacts(prereq_m.group(1)) if prereq_m else "None"
        
        # Modeled Prerequisites
        modeled_m = re.search(r'Modeled Prerequisites\s*\n(.*?)(?=\n\s*(?:Qualifikationsziele|Competence Goal|Content|Inhalt|\Z))', body, re.DOTALL | re.IGNORECASE)
        modeled_prerequisites = strip_page_artifacts(modeled_m.group(1)) if modeled_m else ""
        
        # Mining exclusions & requires
        combined_prereqs = f"{prerequisites} {modeled_prerequisites}"
        exclusions = []
        requires = []
        
        # Exclusions patterns (English & German)
        excl_matches = re.findall(
            r'(?:must not have been started|must not have started|must not be started|not allowed to take|is not allowed to be|darf nicht begonnen worden sein|nicht begonnen worden sein|muss nicht begonnen).*?(M-[A-Z0-9\-]+)',
            combined_prereqs,
            re.IGNORECASE
        )
        exclusions.extend(excl_matches)
        
        one_of_matches = re.findall(r'(?:Only one out of|nur eines von).*?(M-[A-Z0-9\-]+).*?(M-[A-Z0-9\-]+)', combined_prereqs, re.IGNORECASE)
        for pair in one_of_matches:
            for p in pair:
                if p != mod_id:
                    exclusions.append(p)
                    
        # Competence Goal / Qualifikationsziele
        cg_m = re.search(r'(?:Competence Goal|Qualifikationsziele)\s*\n(.*?)(?=\n\s*(?:Content|Inhalt|Workload|Arbeitsaufwand|\Z))', body, re.DOTALL | re.IGNORECASE)
        competence_goal = strip_page_artifacts(cg_m.group(1)) if cg_m else ""
        
        # Content / Inhalt
        cnt_m = re.search(r'(?:Content|Inhalt)\s*\n(.*?)(?=\n\s*(?:Module Grade Calculation|Zusammensetzung der Modulnote|Workload|Arbeitsaufwand|Recommendations|Empfehlungen|Literature|Literatur|\Z))', body, re.DOTALL | re.IGNORECASE)
        content = strip_page_artifacts(cnt_m.group(1)) if cnt_m else ""
        
        # Workload / Arbeitsaufwand
        wl_m = re.search(r'(?:Workload|Arbeitsaufwand)\s*\n(.*?)(?=\n\s*(?:Recommendations|Empfehlungen|Literature|Literatur|Teaching and Learning Methods|Lehr- und Lernformen|\Z))', body, re.DOTALL | re.IGNORECASE)
        workload = strip_page_artifacts(wl_m.group(1)) if wl_m else f"{credits * 30} hours workload."
        
        # Recommendations & Literature
        rec_m = re.search(r'(?:Recommendations|Empfehlungen)\s*\n(.*?)(?=\n\s*(?:Literature|Literatur|Teaching and Learning Methods|Lehr- und Lernformen|\Z))', body, re.DOTALL | re.IGNORECASE)
        recommendations = strip_page_artifacts(rec_m.group(1)) if rec_m else ""
        
        lit_m = re.search(r'(?:Literature|Literatur)\s*\n(.*?)(?=\n\s*(?:Teaching and Learning Methods|Lehr- und Lernformen|\Z))', body, re.DOTALL | re.IGNORECASE)
        literature = strip_page_artifacts(lit_m.group(1)) if lit_m else ""
        
        # Lab course detection
        is_lab = False
        t_lower = title.lower()
        if any(k in t_lower for k in ["lab", "praktikum", "laboratory", "workshop"]):
            is_lab = True
            
        # Thesis detection
        is_thesis = False
        if credits >= 24 and any(k in t_lower for k in ["thesis", "masterarbeit", "master's thesis", "abschlussarbeit"]):
            is_thesis = True
            
        # Basic category classification
        categories = set()
        if is_thesis:
            categories.add("Master's Thesis")
        elif "überfachliche qualifikation" in t_lower or "interdisciplinary" in t_lower or "m-etit-105803" in mod_id.lower():
            categories.add("Interdisciplinary Qualifications")
        elif is_lab:
            categories.add("Lab Course")
            categories.add("Electives")
        else:
            categories.add("Electives")

        modules[mod_id] = {
            "id": mod_id,
            "title": title,
            "credits": credits,
            "term": term,
            "termString": recurrence_raw,
            "duration": duration,
            "language": language,
            "grading": grading,
            "coordinators": coordinators,
            "organisation": organisation,
            "partOf": part_of,
            "categories": sorted(list(categories)),
            "applicableSpecializations": [],
            "isLab": is_lab,
            "isThesis": is_thesis,
            "examType": assessment or "Examination",
            "prerequisites": prerequisites,
            "modeledPrerequisites": modeled_prerequisites,
            "exclusions": sorted(list(set(exclusions))),
            "requires": sorted(list(set(requires))),
            "competenceGoal": competence_goal,
            "content": content,
            "workload": workload,
            "recommendations": recommendations,
            "literature": literature
        }
        
        # Exclusions hardcoded overrides for known pairs
        if mod_id == "M-ETIT-100513" and "M-ETIT-100524" not in exclusions: exclusions.append("M-ETIT-100524")
        if mod_id == "M-ETIT-100524" and "M-ETIT-100513" not in exclusions: exclusions.append("M-ETIT-100513")
        if mod_id == "M-ETIT-102264" and "M-ETIT-102266" not in exclusions: exclusions.append("M-ETIT-102266")
        if mod_id == "M-ETIT-102266" and "M-ETIT-102264" not in exclusions: exclusions.append("M-ETIT-102264")
        if mod_id == "M-ETIT-107444" and "M-ETIT-100453" not in exclusions: exclusions.append("M-ETIT-100453")
        if mod_id == "M-ETIT-100453" and "M-ETIT-107444" not in exclusions: exclusions.append("M-ETIT-107444")

    # --- PROCESS STUDY PROGRAM STRUCTURE & SPECIALIZATIONS ---
    is_etit = "etit" in degree_meta["id"] or "electrical" in degree_meta["title"].lower()
    
    # Check for ETIT Section 7
    etit_sec7 = None
    if is_etit:
        sec7_m = re.search(r'7\s+STUDY PROGRAM STRUCTURE.*?(?=8\s+MASTER|\Z)', text, re.DOTALL | re.IGNORECASE)
        if sec7_m:
            etit_sec7 = sec7_m.group(0)

    if is_etit and etit_sec7:
        # Exact Section 7 structure extraction for official ETIT Master (SPO 2025)
        etit_spec_defs = [
            {
                "id": "ARSE",
                "name": "Automation, Robotics, and Systems Engineering",
                "start": r'7\.2\.3\s+Automation, Robotics, and Systems Engineering',
                "end": r'7\.2\.4\s+Microelectronics'
            },
            {
                "id": "EPSE",
                "name": "Electrical Power Systems and Electromobility",
                "start": r'7\.2\.1\s+Electrical Power Systems and Electromobility',
                "end": r'7\.2\.2\s+Information'
            },
            {
                "id": "ICT",
                "name": "Information and Communication Technology",
                "start": r'7\.2\.2\s+Information and Communication Technology',
                "end": r'7\.2\.3\s+Automation'
            },
            {
                "id": "MPQT",
                "name": "Microelectronics, Photonics, and Quantum Technologies",
                "start": r'7\.2\.4\s+Microelectronics, Photonics, and Quantum Technologies',
                "end": r'7\.3\s+Electives'
            }
        ]

        spec_fund_map = {}
        spec_focus_map = {}
        spec_lab_map = {}
        valid_specs = []

        for s in etit_spec_defs:
            part = re.search(f"{s['start']}(.*?)(?={s['end']})", etit_sec7, re.DOTALL)
            if not part:
                continue
            s_txt = part.group(1)
            funds_m = re.findall(r'Fundamentals \(Election: at least 24 credits\)(.*?)(?=Focus Area)', s_txt, re.DOTALL)
            fund_mods = list(dict.fromkeys(re.findall(r'(M-[A-Z0-9\-]+)', funds_m[0]))) if funds_m else []

            focus_m = re.findall(r'Focus Area \(Election: at least 24 credits\)(.*?)(?=Lab Course)', s_txt, re.DOTALL)
            focus_mods = list(dict.fromkeys(re.findall(r'(M-[A-Z0-9\-]+)', focus_m[0]))) if focus_m else []

            labs_m = re.findall(r'Lab Course \(Election: 1 item\)(.*?)(?=M\.Sc\. Electrical|7\.2|\Z)', s_txt, re.DOTALL)
            lab_mods = list(dict.fromkeys(re.findall(r'(M-[A-Z0-9\-]+)', labs_m[0]))) if labs_m else []

            for f in fund_mods:
                spec_fund_map.setdefault(f, set()).add(s["id"])
            for fc in focus_mods:
                spec_focus_map.setdefault(fc, set()).add(s["id"])
            for l in lab_mods:
                spec_lab_map.setdefault(l, set()).add(s["id"])

            all_track_mods = list(dict.fromkeys(fund_mods + focus_mods + lab_mods))
            valid_specs.append({
                "id": s["id"],
                "name": s["name"],
                "fundamentals": fund_mods,
                "focus": focus_mods,
                "labs": lab_mods,
                "modules": all_track_mods
            })

        # Apply categories and specialization tags to all modules
        for mod_id, mod in modules.items():
            mod_cats = set()
            mod_specs = set()
            mod_spec_roles = {}

            if mod_id == "M-ETIT-107191" or mod["isThesis"]:
                mod_cats.add("Master's Thesis")
                mod["isThesis"] = True
            elif mod_id == "M-ETIT-105803" or "interdisciplinary" in mod["title"].lower():
                mod_cats.add("Interdisciplinary Qualifications")
            else:
                if mod_id in spec_fund_map:
                    mod_cats.add("Fundamentals")
                    mod_cats.add("Specialization")
                    mod_specs.update(spec_fund_map[mod_id])
                    for sid in spec_fund_map[mod_id]:
                        mod_spec_roles[sid] = "Fundamentals"
                if mod_id in spec_focus_map:
                    mod_cats.add("Focus Area")
                    mod_cats.add("Specialization")
                    mod_specs.update(spec_focus_map[mod_id])
                    for sid in spec_focus_map[mod_id]:
                        if sid not in mod_spec_roles:
                            mod_spec_roles[sid] = "Focus Area"
                if mod_id in spec_lab_map or mod["isLab"]:
                    mod_cats.add("Lab Course")
                    mod_cats.add("Specialization")
                    mod["isLab"] = True
                    if mod_id in spec_lab_map:
                        mod_specs.update(spec_lab_map[mod_id])
                        for sid in spec_lab_map[mod_id]:
                            mod_spec_roles[sid] = "Lab Course"

                # All courses can also be taken as Electives
                mod_cats.add("Electives")

            mod["categories"] = sorted(list(mod_cats))
            mod["applicableSpecializations"] = sorted(list(mod_specs))
            mod["specializationRoles"] = mod_spec_roles

        # Regulation-compliant categories for ETIT Master SPO 2025
        categories_def = [
            {
                "id": "fundamentals",
                "name": "Fundamentals",
                "targetCredits": 24,
                "color": "var(--cat-fundamentals)"
            },
            {
                "id": "focus",
                "name": "Focus Area",
                "targetCredits": 24,
                "color": "var(--cat-focus)"
            },
            {
                "id": "lab",
                "name": "Lab Course",
                "targetCredits": 6,
                "color": "var(--cat-lab)"
            },
            {
                "id": "electives",
                "name": "Electives",
                "targetCredits": 24,
                "color": "var(--cat-electives)"
            },
            {
                "id": "uq",
                "name": "Interdisciplinary (ÜQ)",
                "targetCredits": 6,
                "color": "var(--cat-uq)"
            },
            {
                "id": "thesis",
                "name": "Master's Thesis",
                "targetCredits": 30,
                "color": "var(--cat-thesis)"
            }
        ]

    else:
        # Generic multi-degree track & category detection
        valid_specs = []
        spec_id_map = {}
        for spec_name, mod_set in specialization_candidates.items():
            if len(mod_set) >= 2:
                spec_slug = re.sub(r'[^A-Za-z0-9]+', '_', spec_name.upper()).strip('_')[:12]
                base_slug = spec_slug
                counter = 1
                while spec_slug in spec_id_map:
                    spec_slug = f"{base_slug}_{counter}"
                    counter += 1
                spec_id_map[spec_slug] = spec_name
                
                valid_specs.append({
                    "id": spec_slug,
                    "name": spec_name,
                    "modules": sorted(list(mod_set))
                })
                
                for mid in mod_set:
                    if mid in modules:
                        if spec_slug not in modules[mid]["applicableSpecializations"]:
                            modules[mid]["applicableSpecializations"].append(spec_slug)
                        if "Specialization" not in modules[mid]["categories"] and not modules[mid]["isThesis"]:
                            modules[mid]["categories"].append("Specialization")

        categories_def = []
        has_specs = len(valid_specs) > 0
        if has_specs:
            categories_def.append({
                "id": "specialization",
                "name": "Specialization",
                "targetCredits": 54,
                "color": "var(--cat-focus)"
            })
        else:
            categories_def.append({
                "id": "core",
                "name": "Core Subjects",
                "targetCredits": 54,
                "color": "var(--cat-fundamentals)"
            })
            
        categories_def.append({
            "id": "electives",
            "name": "Electives",
            "targetCredits": 30,
            "color": "var(--cat-electives)"
        })
        categories_def.append({
            "id": "uq",
            "name": "Interdisciplinary (ÜQ)",
            "targetCredits": 6,
            "color": "var(--cat-uq)"
        })
        categories_def.append({
            "id": "thesis",
            "name": "Master's Thesis",
            "targetCredits": 30,
            "color": "var(--cat-thesis)"
        })

    degree_meta["specializations"] = valid_specs
    degree_meta["categories"] = categories_def
    degree_meta["moduleCount"] = len(modules)
    
    # Save rules
    degree_meta["rules"] = {
        "degree": degree_meta["title"],
        "spo": degree_meta["spo"],
        "totalCreditsTarget": 120,
        "thesisCredits": 30,
        "thesisPrerequisiteCredits": 75,
        "semestersTarget": 4,
        "categories": categories_def
    }

    return {
        "degree": degree_meta,
        "modules": modules
    }

def parse_pdf_file(pdf_path, pdfextract_bin="./pdfextract"):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if not os.path.exists(pdfextract_bin):
        raise FileNotFoundError(f"pdfextract binary not found: {pdfextract_bin}")
        
    print(f"Extracting text from {pdf_path} using {pdfextract_bin}...")
    txt = subprocess.check_output([pdfextract_bin, pdf_path], text=True)
    return parse_handbook_text(txt, filename=pdf_path)

def save_degree_data(parsed_data, output_dir):
    degree = parsed_data["degree"]
    modules = parsed_data["modules"]
    
    deg_dir = os.path.join(output_dir, degree["id"])
    os.makedirs(deg_dir, exist_ok=True)
    
    deg_json_path = os.path.join(deg_dir, "degree.json")
    with open(deg_json_path, "w", encoding="utf-8") as f:
        json.dump(degree, f, indent=2, ensure_ascii=False)
        
    mod_json_path = os.path.join(deg_dir, "modules.json")
    with open(mod_json_path, "w", encoding="utf-8") as f:
        json.dump(modules, f, indent=2, ensure_ascii=False)
        
    print(f"Saved degree profile: {degree['title']} ({degree['id']}) -> {deg_dir}")
    return degree["id"]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/universal_parser.py <path-to-handbook.pdf> [output-dir]")
        sys.exit(1)
        
    pdf_file = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "data/degrees"
    
    res = parse_pdf_file(pdf_file)
    slug = save_degree_data(res, out_dir)
    print(f"Successfully parsed {res['degree']['moduleCount']} modules for '{res['degree']['title']}'!")
