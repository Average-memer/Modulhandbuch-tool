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
- **Real-Time Degree Audit Engine**:
  - Live 120 CP degree progress tracking
  - Category credit auditing (Core/Specialization, Electives, Interdisciplinary ÜQ, Master's Thesis)
  - Dynamic Master's Thesis §14(1) gate: checks that $\ge 75\text{ CP}$ is accumulated prior to the thesis semester across extended plans
  - Antirequisite and mutual exclusion conflict detection
  - Term availability warnings (WS vs. SS)
- **Selective Auto-Planner & Staging Area**: Curate courses into a staging pool and let the constraint solver schedule them without pulling unwanted subjects.
- **Custom Course Creator**: Add language courses (*Sprachenzentrum*), HoC/ZAK workshops, transfer credits, or custom electives.
- **Visual Analytics Dashboard**: Semester credit distribution charts, workload pacing metrics, and language breakdowns.
- **Zero External Dependencies**: Powered entirely by the Python 3 standard library (`server.py`) and standard browser web technologies (no `npm`, no `pip install`).

---

## Quickstart

### Option 1: Local Web Server (Recommended)
```bash
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
├── server.py                        # Zero-dependency Python HTTP & REST API server
├── pdfextract                       # Native macOS PDFKit extraction binary
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
│   └── validate_plan.py             # CLI headless plan validator
├── public/                          # Frontend web assets
│   ├── index.html                   # Responsive SPA layout
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

## Developer Guide

For detailed architecture explanations, regex specifications, data schemas, and maintenance workflows, refer to:
👉 **[DOCUMENTATION.md](DOCUMENTATION.md)**
