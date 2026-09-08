# KIT M.Sc. ETIT Study Planner & Modulhandbuch Tool (SPO 2025)

An interactive, zero-dependency degree planning, audit, and course catalog tool for the Master of Science in Electrical Engineering and Information Technology (M.Sc. ETIT) at the **Karlsruhe Institute of Technology (KIT)** under **SPO 2025**.

---

## Features

- **Official 2025 Handbook Integration**: Includes 247 accredited modules parsed directly from the official KIT Module Handbook (`MHB_MSc25_ETIT_SS26`).
- **All 4 Fields of Specialisation**: Full support for Automation, Robotics & Systems Engineering (ARSE), Electrical Power Systems & Electromobility (EPSE), Information & Communication Technology (ICT), and Microelectronics, Photonics & Quantum Technologies (MPQT).
- **Interactive 4-Semester Planner Board**: Drag-and-drop course scheduling across semesters with term availability awareness (Winter vs. Summer semester).
- **Real-Time Degree Audit**: Live validation of the 9 official SPO 2025 regulations:
  - 120 CP total degree target
  - 24 CP Fundamentals (4 modules of 6 CP from approved list)
  - Exactly 1 Specialization Lab
  - Focus Area & 60 CP Specialization total
  - 24 CP Electives (max 1 elective lab)
  - At least 6 CP Interdisciplinary Qualifications (ÜQ / SQ)
  - 30 CP Master's Thesis with strict SPO §14(1) gate ($\ge 75\text{ CP}$ earned prior to thesis semester)
  - Mutual exclusion and antirequisite conflict checks
  - Workload balance indicators (target 30 CP / semester)
- **Selective Auto-Planner & Staging Area**: Curate your preferred courses into a staging pool and let the constraint solver optimize placement into semesters without pulling unwanted courses. Pin modules to lock them to specific semesters.
- **Custom Course Creator**: Add language courses (*Sprachenzentrum*), HoC/ZAK workshops, transfer credits, or custom electives.
- **Visual Analytics Dashboard**: Stacked semester workload breakdown chart, English vs. German language ratio, and examination modality distribution.
- **Official Export**: Instant study plan text summary for academic advisor submission, JSON download/backup, and print-optimized PDF layout.
- **Zero External Dependencies**: Runs with standard Python 3 or standalone offline in any browser.

---

## Quickstart

### Option 1: Local Server (Recommended)
```bash
python3 server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Option 2: Standalone Offline Mode
Open `public/index.html` directly in your browser without any server:
```bash
open public/index.html
```

---

## Project Structure

- [`DOCUMENTATION.md`](DOCUMENTATION.md): Comprehensive developer guide, system architecture, data models, and maintenance workflows.
- [`server.py`](server.py): Zero-dependency Python HTTP and REST API server.
- [`data/`](data/): Extracted JSON datasets (`modules.json`, `specializations.json`, `rules.json`).
- [`scripts/`](scripts/): Handbook parser (`parse_handbook.py`) and CLI plan validator (`validate_plan.py`).
- [`public/`](public/): Frontend application (HTML, CSS, vanilla JavaScript).

---

## Detailed Documentation

For an in-depth explanation of system architecture, data structures, parsing regexes, validation rules, and maintenance workflows, refer to:
👉 **[DOCUMENTATION.md](DOCUMENTATION.md)**
