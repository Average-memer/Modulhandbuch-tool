#!/usr/bin/env python3
"""
preindex_all.py
Batch-indexes all Master Module Handbook PDFs in modulhandbücher/
Saves individual degree profiles into data/degrees/<id>/
Generates an index of installed degrees (data/degrees/degrees_index.json)
Generates public/js/preloaded_degrees.js for standalone offline execution.
"""

import os
import sys
import json
from universal_parser import parse_pdf_file, save_degree_data

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDBOOKS_DIR = os.path.join(BASE_DIR, "modulhandbücher")
DEGREES_DIR = os.path.join(BASE_DIR, "data", "degrees")
PUBLIC_JS_DIR = os.path.join(BASE_DIR, "public", "js")

os.makedirs(DEGREES_DIR, exist_ok=True)
os.makedirs(PUBLIC_JS_DIR, exist_ok=True)

# Selection of master handbooks to pre-index
MASTER_PDFS = [
    ("MHB_MSc25_ETIT_SS26-88-848-H-2025_v1_2026-03-06_en.pdf", "etit-msc-2025"),
    ("88-979-H-2025_v1_2026-04-15_de.pdf", "cs-msc-2025"),
    ("MHB-phys-msc-spo2023-en.pdf", "physics-msc-2023"),
    ("MHB_BIW_MSc_SPO2025_WS_2627_DE.pdf", "biw-msc-2025"),
    ("mhb-master-math-de.pdf", "math-msc-2016"),
    ("250328_MHB_Arch_MA_2021_de.pdf", "arch-msc-2021")
]

def main():
    degrees_index = []
    all_degrees_bundle = {}

    for pdf_name, preferred_id in MASTER_PDFS:
        pdf_path = os.path.join(HANDBOOKS_DIR, pdf_name)
        if not os.path.exists(pdf_path):
            print(f"Skipping {pdf_name} (file not found)")
            continue

        print(f"\n==========================================")
        print(f"Processing {pdf_name}...")
        try:
            res = parse_pdf_file(pdf_path)
            # Override slug with standard clean ID
            res["degree"]["id"] = preferred_id
            
            # Save into data/degrees/<id>/
            save_degree_data(res, DEGREES_DIR)
            
            deg = res["degree"]
            deg_summary = {
                "id": deg["id"],
                "title": deg["title"],
                "spo": deg["spo"],
                "term": deg["term"],
                "faculty": deg["faculty"],
                "totalCredits": deg["totalCredits"],
                "semestersCount": deg["semestersCount"],
                "moduleCount": deg["moduleCount"],
                "specializations": deg.get("specializations", []),
                "categories": deg.get("categories", [])
            }
            degrees_index.append(deg_summary)
            all_degrees_bundle[deg["id"]] = res
            print(f"✓ Indexed {deg['title']} ({deg['moduleCount']} modules)")
        except Exception as e:
            print(f"✗ Error processing {pdf_name}: {e}")

    # Write data/degrees/degrees_index.json
    index_path = os.path.join(DEGREES_DIR, "degrees_index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(degrees_index, f, indent=2, ensure_ascii=False)
    print(f"\nSaved master index: {index_path} ({len(degrees_index)} degrees)")

    # Write public/js/preloaded_degrees.js for standalone offline execution
    js_bundle_path = os.path.join(PUBLIC_JS_DIR, "preloaded_degrees.js")
    with open(js_bundle_path, "w", encoding="utf-8") as f:
        f.write("// Precompiled KIT Master Degrees Bundle for Standalone Browser Mode\n")
        f.write("var rootScope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);\n\n")
        f.write("rootScope.PRELOADED_DEGREES_INDEX = ")
        json.dump(degrees_index, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("rootScope.PRELOADED_DEGREES_DATA = ")
        json.dump(all_degrees_bundle, f, indent=2, ensure_ascii=False)
        f.write(";\n")
    print(f"Saved standalone bundle: {js_bundle_path} ({len(all_degrees_bundle)} full degrees bundled)")

if __name__ == "__main__":
    main()
