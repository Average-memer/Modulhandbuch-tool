# Universal KIT Master Degree Planner & Modulhandbuch Platform

An interactive, zero-dependency degree planning, conflict audit, and module handbook platform for Master of Science degrees at the **Karlsruhe Institute of Technology (KIT)**.

---

## Key Features

- **Universal Multi-Degree Platform**: Seamlessly switch between different KIT Master's programs:
  - **M.Sc. Electrical Engineering and Information Technology (ETIT)** (SPO 2025, English)
  - **M.Sc. Computer Science (Informatik)** (SPO 2025, German/English)
  - **M.Sc. Physics** (SPO 2023, English)
  - **M.Sc. Bioengineering (Bioingenieurwesen)** (SPO 2025, German)
  - **M.Sc. Mathematics** (SPO 2016, German)
  - **M.Sc. Architecture** (SPO 2021, German)
- **One-Click PDF Handbook Upload**: Drop in any official KIT Master Module Handbook PDF (German or English). The built-in universal parser automatically extracts modules, credit points, recurrence terms, prerequisites, and degree structure.
- **Dynamic Semester Extension**: Expand your degree plan beyond 4 semesters (`+ Add Semester` / `- Remove Semester`) for internships, working student positions, or study abroad. Term frequency (`WS` $\leftrightarrow$ `SS`) and target pacing benchmarks automatically adjust.
- **Interactive Drag-and-Drop Planner Board**: Drag courses across semesters, pin mandatory modules, and stage courses before scheduling.
- **Collapsible Staging Area**: Keep a curated backlog of candidate courses in a collapsible drawer featuring live course and CP counters, pulse animations, and instant one-click staging/unstaging.
- **Full Custom Module Management (Create, Edit & Delete)**:
  - Add language courses (*Sprachenzentrum*), HoC/ZAK workshops, transfer credits, or custom electives.
  - In-place editing: update course title, ECTS credits, category, term, and language with automatic synchronization across the catalog, staging area, and scheduled semesters.
  - Safe deletion: guarded by confirmation prompts, removing courses cleanly across all planner views and persistent storage.
  - Dynamic `✏️ Custom (<count>)` catalog filter pill to quickly isolate all user-created modules.
  - Dedicated quick-action buttons (✏️ Edit and 🗑️ Delete) on catalog cards, staged cards, semester cards, and inside the inspection modal.
- **Flexible Multi-Category Attribution**:
  - Interactive category selector directly on semester cards and modal for multi-category modules (e.g., Focus Area vs. Electives).
  - Strict credit attribution preventing fractional CP leaks into general electives.
- **Real-Time Degree Audit Engine**:
  - Live 120 CP degree progress tracking
  - Category credit auditing (Core/Specialization, Electives, Interdisciplinary ÜQ, Master's Thesis)
  - Dynamic Master's Thesis §14(1) gate: checks that $\ge 75\text{ CP}$ is accumulated prior to the thesis semester across extended plans
  - Antirequisite and mutual exclusion conflict detection
  - Term availability warnings (WS vs. SS)
- **Selective Auto-Planner**: Curate courses into the staging pool and let the constraint solver schedule them without pulling unwanted subjects.
- **Collapsible Top Ribbon**: Maximize planning space with a collapsible header ribbon (`Alt+H` shortcut or toggle button).
- **Visual Analytics Dashboard**: Semester credit distribution charts, workload pacing metrics, and language breakdowns.
- **Zero External Dependencies for Server & UI**: Powered by standard Python 3 and web technologies (no `npm`). PDF handbook parsing uses `pypdf` across Windows and Linux x86/64.

---

## Quickstart

### Option 1: Local Web Server (Recommended)
```bash
pip install -r requirements.txt
python3 server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Option 2: Zero-Server Standalone Offline Mode
Open `public/index.html` directly in any web browser:
```bash
open public/index.html
```

---

## Repository Structure

```
Modulhandbuch-tool/
├── server.py                        # Lightweight Python HTTP & REST API server
├── requirements.txt                 # Python dependencies (pypdf)
├── modulhandbücher/                 # Collection of official KIT handbook PDFs
├── data/
│   └── degrees/                     # Parsed degree profiles (degree.json, modules.json)
│       ├── etit-msc-2025/
│       ├── cs-msc-2025/
│       ├── physics-msc-2023/
│       ├── biw-msc-2025/
│       ├── math-msc-2016/
│       ├── arch-msc-2021/
│       └── degrees_index.json
├── scripts/
│   ├── universal_parser.py          # Bilingual extraction engine for KIT Master handbooks
│   ├── preindex_all.py              # CLI batch pre-indexer for local handbooks
│   ├── validate_plan.py             # CLI headless plan validator
│   ├── test_category_attribution.js # Automated verification for category attribution
│   └── test_staged_autoplan.js      # Automated test suite for staged autoplan solver
├── public/                          # Frontend web assets
│   ├── index.html                   # Responsive SPA layout with custom modals
│   ├── css/styles.css               # KIT Design System and component styling
│   └── js/
│       ├── preloaded_degrees.js     # Precompiled degrees bundle for offline mode
│       ├── validator.js             # Universal degree validator engine
│       ├── generator.js             # Universal constraint solver & auto-planner
│       └── app.js                   # Main application controller
├── DOCUMENTATION.md                 # Complete architecture and developer guide
└── README.md                        # Quickstart and overview
```

---

## Managing Default Degrees & Updating Module Handbooks

Follow these steps to update an existing default degree or add a new official KIT handbook to the platform:

### 1. Add the New Handbook PDF
Place the official KIT Module Handbook PDF into the `modulhandbücher/` directory:
```bash
cp /path/to/handbook.pdf modulhandbücher/MHB_MSc25_ETIT_WS26-88-848-H-2025_v1_2026-09-08_en.pdf
```

### 2. Configure Default Degrees in `scripts/preindex_all.py`
Open `scripts/preindex_all.py` and modify the `MASTER_PDFS` list:
- **To update an existing degree** (e.g., updating ETIT Master from SS26 to WS26/27):
  Replace the old handbook filename with the new one:
  ```python
  MASTER_PDFS = [
      ("MHB_MSc25_ETIT_WS26-88-848-H-2025_v1_2026-09-08_en.pdf", "etit-msc-2025"),
      ("88-979-H-2025_v1_2026-04-15_de.pdf", "cs-msc-2025"),
      # ...
  ]
  ```
- **To add a new default degree**: Append a tuple with the PDF filename and canonical degree slug ID:
  ```python
  ("MHB_NewDegree_SPO2025.pdf", "new-degree-slug-2025")
  ```
- **To remove an obsolete degree**: Remove its entry from `MASTER_PDFS` and delete its folder from `data/degrees/<old-slug>/`.

### 3. Run the Batch Pre-Indexer
Execute the pre-indexer script to parse the PDF, extract all modules, tracks, credit quotas, and antirequisites:
```bash
python3 scripts/preindex_all.py
```
This automatically:
- Extracts catalog data via `scripts/universal_parser.py`
- Saves structured `degree.json` and `modules.json` into `data/degrees/<id>/`
- Rebuilds the master degree manifest `data/degrees/degrees_index.json`
- Recompiles the standalone offline bundle `public/js/preloaded_degrees.js`

### 4. Verify Plan Validation
Test the parsed curriculum against the degree audit engine using the headless CLI validator:
```bash
python3 scripts/validate_plan.py etit-msc-2025
```

### 5. Launch and Verify in the Browser
Start the server and test the planner:
```bash
python3 server.py
```
Open **[http://localhost:8080](http://localhost:8080)** (or reload with `Cmd+Shift+R` / `Ctrl+F5`). The degree dropdown and catalog will now reflect the updated handbook version, recurrence terms, and module counts.

---

## Developer Guide

For detailed architecture explanations, regex specifications, data schemas, and maintenance workflows, refer to:
👉 **[DOCUMENTATION.md](DOCUMENTATION.md)**

