# Developer Documentation & Architecture Guide
## Universal KIT Master Degree Planner & Modulhandbuch Platform

This document provides a comprehensive reference for developers, maintainers, and contributors working on the **Universal KIT Master Degree Planner and Module Handbook Platform**. It covers the system architecture, universal bilingual data ingestion pipeline, dynamic multi-degree models, degree audit engines, and frontend state management.

---

## 1. System Overview & Philosophy

The platform is an interactive web-based study planning, conflict analysis, and degree audit application designed for Master of Science degrees at the **Karlsruhe Institute of Technology (KIT)**. It allows students to select from pre-indexed KIT Master's programs or upload **any official KIT Module Handbook PDF** to automatically generate an interactive planner board, catalog search, and rule verification system.

### Core Architectural Principles
1. **Zero External Dependencies**: The backend requires only the Python 3 standard library (`http.server`, `json`, `re`, `urllib`, `subprocess`, `selectors`). No `pip install`, no node/npm build step, and no external package managers are needed to run or deploy the system.
2. **Dual-Mode Execution (Server & Standalone Offline)**: The frontend can run either via the local Python HTTP server (`server.py`) using REST APIs or completely standalone via `file:///` in a web browser using the embedded multi-degree bundle (`public/js/preloaded_degrees.js`).
3. **Universal Document Schema Ingestion**: KIT faculties generate Module Handbooks through a shared campus management system. A single unified regex pipeline extracts 100% of accredited modules, prerequisites, exclusion rules, and recurrence terms across all faculties in both German and English.
4. **Dynamic Semester Pacing & Pacing Flexibility**: Students can dynamically add or remove semesters (`+ Add Semester` / `- Remove Semester`) for internships, working student positions, or study abroad. Workload benchmarks and term alternating frequencies (`WS` $\leftrightarrow$ `SS`) adjust automatically.
5. **Instant Interactive Verification**: Degree audit algorithms and constraint solvers run in real-time in the browser upon every drag, drop, pin, or configuration change.
6. **Live Lecture Times & Weekly Timetable Grid (`Stundenplan`)**: Live extraction of lecture, exercise, and tutorial slots, room numbers, campus plan links, and docents directly from the official KIT Campus Management & Vorlesungsverzeichnis (`cascampus.studium.kit.edu`).
7. **Strict Semester Scoping Without Fallback**: Timetables are strictly scoped to the active/upcoming semester (**Winter Semester 26/27, `WS 26/27`**). Because lecture times, rooms, and docents are unstable across semesters, cross-semester fallbacks are strictly prohibited and unoffered courses are explicitly flagged.
8. **Resilient Server Architecture**: `server.py` implements socket address reuse (`allow_reuse_address = True`), automatic port conflict resolution (`free_port_if_occupied`), and macOS Darwin selector patches (`KqueueSelector`) to eliminate 100% idle CPU busy-polling.

---

## 2. High-Level Architecture

```mermaid
flowchart TD
    subgraph DataIngestion["1. Ingestion & Scraper Layer"]
        PDF["Official KIT Handbook PDF<br/>(German or English)"] -->|pypdf / pdftotext| RawText["In-Memory Text Stream"]
        RawText -->|universal_parser.py| Parser["Bilingual Regex Parser & Entity Normalizer"]
        Parser --> DataJSON["data/degrees/<slug>/<br/>• degree.json<br/>• modules.json"]
        Parser --> Preindex["scripts/preindex_all.py"]
        Preindex --> JSData["public/js/preloaded_degrees.js<br/>(Standalone Offline Bundle)"]

        CampusVVZ["KIT Campus Management<br/>(cascampus.studium.kit.edu)"] -->|campus_scraper.py| Scraper["Zero-Dependency Scraper<br/>• Bot Challenge Solver<br/>• Quicksearch & Bricks<br/>• Strict WS 26/27 Scoping"]
        Scraper --> SchedCache["data/schedules/<br/>• modules_cache.json<br/>• terms.json"]
    end

    subgraph Backend["2. Backend Web Server (server.py)"]
        Server["ReusableThreadingHTTPServer<br/>(Port 8080, KqueueSelector)"]
        Server -->|GET /api/degrees| DegreesIndex["data/degrees/degrees_index.json"]
        Server -->|GET /api/degree?id=...| DataJSON
        Server -->|POST /api/upload| Parser
        Server -->|GET /api/schedule<br/>POST /api/schedule/batch<br/>GET /api/terms| Scraper
        Server -->|POST /api/auth/kit-campus| Scraper
        Server -->|Static Files| PublicDir["public/ (HTML/CSS/JS)"]
    end

    subgraph ClientData["3. Frontend Data Loading Cascade"]
        AppInit["UniversalStudyPlannerApp.init()"]
        AppInit -->|1. Try REST API| FetchAPI["fetch('/api/degrees'), fetch('/api/degree') & fetch('/api/schedule/batch')"]
        AppInit -->|2. Offline Fallback| JSData
    end

    subgraph ClientEngines["4. Core Business Logic Engines"]
        Validator["DegreeValidator (validator.js)<br/>• N-Semester Evaluation<br/>• Category Credit Quotas<br/>• Mutual Exclusions & Antirequisites<br/>• §14(1) Thesis Gate Checks<br/>• Term Constraints (WS/SS)<br/>• Timetable Overlap & Conflict Engine"]
        Generator["PlanGenerator (generator.js)<br/>• Heuristic Bin-Packing across N-1 Semesters<br/>• Pinned Module Locking<br/>• Staging Pool Optimization<br/>• Final Semester Thesis Placement"]
    end

    subgraph ClientUI["5. Presentation & Interaction Layer"]
        UI["Universal SPA Interface (index.html, styles.css, app.js)"]
        UI <-->|Semester Planner Board| ClientEngines
        UI <-->|Weekly Timetable Grid (Stundenplan)| ClientEngines
        UI <-->|Multi-Degree State| LocalStorage["Browser LocalStorage<br/>• kit_active_degree<br/>• kit_plan_<degreeId><br/>• kit_staged_<degreeId><br/>• kit_custom_<degreeId><br/>• kit_schedules_cache"]
    end

    Backend --> ClientData
```

---

## 3. Directory & File Structure

```
Modulhandbuch-tool/
├── server.py                        # Lightweight Python HTTP & REST API server (Reusable, Kqueue)
├── requirements.txt                 # Python dependencies (pypdf)
├── modulhandbücher/                 # Canonical storage of official KIT handbook PDFs
├── data/
│   ├── degrees/                     # Extracted degree profiles
│   │   ├── etit-msc-2025/           # { degree.json, modules.json }
│   │   ├── cs-msc-2025/             # { degree.json, modules.json }
│   │   ├── physics-msc-2023/        # { degree.json, modules.json }
│   │   ├── biw-msc-2025/            # { degree.json, modules.json }
│   │   ├── math-msc-2016/           # { degree.json, modules.json }
│   │   ├── arch-msc-2021/           # { degree.json, modules.json }
│   │   └── degrees_index.json       # Manifest of installed degrees
│   └── schedules/                   # Cached lecture times & term manifests
│       ├── modules_cache.json       # Persisted module timeslots, rooms & docents
│       └── terms.json               # KIT Campus academic term registry
├── scripts/
│   ├── campus_scraper.py            # Zero-dependency KIT Campus VVZ scraper & SSO client
│   ├── universal_parser.py          # Bilingual extraction engine for KIT Master handbooks
│   ├── preindex_all.py              # CLI utility to pre-index all handbooks
│   ├── validate_plan.py             # Headless CLI plan verification tool
│   ├── test_timetable_conflicts.py  # Automated integration & timetable collision test suite
│   ├── test_category_attribution.js # Automated verification for category attribution
│   └── test_staged_autoplan.js      # Automated test suite for staged autoplan solver
├── DOCUMENTATION.md                 # Developer & architecture guide
├── README.md                        # Quickstart guide & repository overview
└── public/                          # Client web assets
    ├── index.html                   # Main application layout, Timetable view & modal dialogs
    ├── css/
    │   └── styles.css               # KIT design system tokens, timetable grid & component styles
    └── js/
        ├── preloaded_degrees.js     # Standalone offline bundle of precompiled degrees
        ├── validator.js             # Universal degree rules & timetable conflict engine
        ├── generator.js             # Universal heuristic auto-planner
        └── app.js                   # Universal application controller & timetable coordinator
```

---

## 4. Data Models & Schemas

The application revolves around four primary entities: `Degree`, `Module`, `DegreeCategory`, and `StudyPlan`.

### 4.1 Degree Schema (`degree.json`)
```typescript
interface Degree {
  id: string;                        // e.g., "etit-msc-2025", "cs-msc-2025"
  title: string;                     // e.g., "M.Sc. Electrical Engineering and Information Technology"
  spo: number;                       // e.g., 2025
  term: string;                      // e.g., "Summer semester 2026"
  faculty: string;                   // e.g., "KIT Department of Electrical Engineering..."
  totalCredits: number;              // Fixed at 120 CP for Master's programs
  semestersCount: number;            // Default 4 semesters (dynamically expandable)
  thesisCredits: number;             // Fixed at 30 CP
  thesisPrerequisiteCredits: number; // §14(1) gate: 75 CP
  moduleCount: number;               // Total modules in catalog
  specializations: Specialization[]; // Tracks / Vertiefungsrichtungen (if applicable)
  categories: DegreeCategory[];      // Subject areas & CP target quotas
  rules: DegreeRules;                // Validation rules object
}

interface Specialization {
  id: string;                        // e.g., "ARSE", "EPSE"
  name: string;                      // Full English or German name
  modules?: string[];                // Eligible module IDs
}

interface DegreeCategory {
  id: string;                        // "specialization", "core", "electives", "uq", "thesis"
  name: string;                      // Display name, e.g., "Specialization", "Electives"
  targetCredits: number;             // e.g., 54, 30, 6, 30
  color: string;                     // CSS variable token
}
```

### 4.2 Module Schema (`modules.json`)
```typescript
interface Module {
  id: string;                        // e.g., "M-ETIT-103802"
  title: string;                     // e.g., "Adaptive Optics"
  credits: number;                   // Credit points (ECTS)
  term: "WS" | "SS" | "WS+SS";       // Normalized recurrence
  termString: string;                // Raw description, e.g., "Each winter term"
  duration: string;                  // e.g., "1 term"
  language: string;                  // "English", "German", or "German/English"
  grading: "graded" | "pass/fail";   // Grading modality
  coordinators: string[];            // Lecturers and coordinators
  organisation: string;              // Institute or faculty
  partOf: string[];                  // Categories & curriculum blocks from handbook
  categories: string[];              // Normalized category assignments
  applicableSpecializations: string[];// Track codes (e.g. ["ARSE", "ICT"])
  isLab: boolean;                    // True if laboratory, practical, or workshop
  isThesis: boolean;                 // True if Master's Thesis
  isCustom?: boolean;                // True if user-created course
  examType: string;                  // Assessment modality
  prerequisites: string;             // Text prerequisites
  modeledPrerequisites: string;      // Formal KIT prerequisites
  exclusions: string[];              // Mutually exclusive module IDs
  requires: string[];                // Hard prerequisite module IDs
  competenceGoal: string;            // Learning outcomes
  content: string;                   // Syllabus
  workload: string;                  // Workload hours breakdown
  recommendations: string;           // Recommended prior knowledge
  literature: string;                // Bibliography
}
```

### 4.3 Study Plan Schema (LocalStorage: `kit_plan_<degreeId>`)
```typescript
interface StudyPlan {
  degree: string;                    // Degree ID
  specialization: string | null;     // Selected track
  startTerm: "WS" | "SS";            // Starting semester term
  semestersCount: number;            // Current planned semesters (4, 5, 6, 7, 8)
  name?: string;                     // Custom plan name
  semesters: Record<number, ScheduledItem[]>; // 1: [...], 2: [...], ..., N: [...]
}

interface ScheduledItem {
  id: string;                        // Module ID (e.g. "M-ETIT-105123" or "CUSTOM-123456")
  category: string;                  // Designated category label
  isPinned?: boolean;                // True if locked to this semester
}
```

### 4.4 Custom Module Schema (LocalStorage: `kit_custom_<degreeId>`)
```typescript
interface CustomModule extends Module {
  id: string;                        // Format: "CUSTOM-XXXXXX"
  title: string;                     // User-defined course or external credit name
  moduleCode?: string;               // Optional official KIT module code (e.g. "M-INFO-106812", "M-ETIT-106815") for timetable sync
  credits: number;                   // 1 to 30 ECTS CP
  term: "WS" | "SS" | "WS+SS";       // Offered semester recurrence
  language: "German" | "English" | "German/English";
  categories: string[];              // e.g. ["Interdisciplinary (ÜQ)"], ["Electives"], or ["Specialization"]
  applicableSpecializations: string[];
  isCustom: true;                    // Flag indicating user-managed module
  coordinators: string[];            // Default: ["Self-Enrolled / HoC / SPZ"]
  prerequisites: string;             // Default: "None"
}
```

### 4.5 Lecture Schedule & Timetable Schemas (`data/schedules/modules_cache.json`)
```typescript
interface ScheduleData {
  moduleId: string;                  // Canonical module code (e.g., "M-ETIT-106815") or mapped custom ID
  moduleTitle: string;               // Official course title from CAS Campus
  term: "WS" | "SS";                 // Term type
  termGuid: string | null;           // Internal CAS Campus term GUID
  termNote: string;                  // e.g. "Official schedule for Winter Semester 26/27" or "Not offered..."
  found: boolean;                    // True if resolved successfully in CAS Campus
  offeredInTerm: boolean;            // True if lecture/exercise events exist in the requested term
  lastUpdated: number;               // Epoch timestamp (seconds) of retrieval
  events: ScheduleEvent[];           // List of course components (Vorlesung, Übung, Praktikum)
}

interface ScheduleEvent {
  eventId: string;                   // Event number (e.g., "2304021")
  eventGuid: string;                 // Hexadecimal event GUID (e.g., "0x98A1B...")
  title: string;                     // Event name (e.g., "Systemdynamik und Regelungstechnik II")
  type: string;                      // Display type (e.g., "Vorlesung", "Übung", "Tutorium")
  typeCode: string;                  // Event code ("V", "Ü", "P", "T")
  lecturer: string;                  // Instructor / Professor name
  slots: ScheduleSlot[];             // Weekly or recurring time allocations
}

interface ScheduleSlot {
  day: "Mo" | "Di" | "Mi" | "Do" | "Fr" | "Sa" | "So"; // Weekday abbreviation
  dayIndex: number;                  // 1 (Monday) to 7 (Sunday)
  dayName: string;                   // "Monday", "Tuesday", etc.
  frequency: "weekly" | "biweekly" | "single"; // Recurrence cadence
  startTime: string;                 // Format "HH:MM" (e.g. "14:00")
  endTime: string;                   // Format "HH:MM" (e.g. "15:30")
  startMinutes: number;              // Offset from midnight in minutes (e.g., 840)
  endMinutes: number;                // Offset from midnight in minutes (e.g., 930)
  room: string;                      // Room designation (e.g. "Geb. 30.22 Gaede-Hörsaal")
  campusUrl: string;                 // Direct campus map link (or empty)
  notes: string;                     // Detailed date notes or alternation comments
}
```

### 4.6 Client LocalStorage State Keys
| Key | Type | Description |
|---|---|---|
| `kit_active_degree` | `string` | ID of the currently active degree program |
| `kit_plan_<degreeId>` | `StudyPlan` | Saved semester distribution, track, and pinned states |
| `kit_staged_<degreeId>` | `string[]` | Array of module IDs currently staged in the candidate backlog |
| `kit_custom_<degreeId>` | `CustomModule[]` | Array of user-created custom courses and external credits |
| `kit_staging_collapsed` | `"true" \| "false"` | Persisted UI collapse state for the Staging Area drawer |
| `kit_ribbon_collapsed` | `"true" \| "false"` | Persisted UI collapse state for the top header ribbon |
| `kit_schedules_cache` | `Record<string, ScheduleData>` | Client-side cache of fetched module schedules and timeslots |
| `kit_timetable_active_sem` | `number` | Selected semester currently rendered in the weekly timetable view |
| `kit_active_view` | `"planner" \| "timetable"` | Active main layout view tab |

---

## 5. Universal Ingestion Pipeline (`scripts/universal_parser.py`)

The universal parser processes official KIT Module Handbook PDFs into standardized JSON datasets:

1. **Text Extraction**: Runs `extract_text_from_pdf` (powered by `pypdf`, with fallback to `pdftotext` CLI) to parse PDF layout into an in-memory text stream across Windows and Linux x86/64.
2. **Metadata Discovery**:
   - Cover text analysis identifies the degree title, SPO year, and faculty.
   - Determines standard 120 CP total and 4-semester duration.
3. **Module Extraction**:
   - Finds the start of the *Teilleistungen* / *Module components* section to isolate the module catalog.
   - Matches module entries across both German and English handbooks using the universal regex:
     ```regex
     (?:^|\n)\s*(?:M\s+)?(?:\d+\.\d+|\d+)\s+(?:Modul|Module):\s*(.*?)\s*\[\s*(M-[\sA-Z0-9\-]+?)\s*\]
     ```
   - Bilingual field extractors map `Credits` / `Leistungspunkte`, `Recurrence` / `Turnus`, `Language` / `Sprache`, `Organisation` / `Einrichtung`, and `Part of:` / `Bestandteil von:`.
4. **Antirequisite Mining**:
   - Scans prerequisites text for German and English exclusion phrases:
     - *"must not have been started"*, *"not allowed to take"*, *"only one out of"*
     - *"darf nicht begonnen worden sein"*, *"muss nicht begonnen haben"*, *"nur eines von"*
   - Automatically registers mutual exclusion pairs between modules.
5. **Specialization & Category Tagging**:
   - Parses the `Part of:` / `Bestandteil von:` field for track designations (e.g. *Vertiefung*, *Area of Specialization*, *Major*).
   - Associates modules with their respective tracks and degree categories.

---

## 6. KIT Campus Timetable Scraper & REST APIs (`scripts/campus_scraper.py`)

The platform includes a real-time lecture and exercise timetable scraper that queries the official **KIT Campus Management & Vorlesungsverzeichnis (VVZ)** (`cascampus.studium.kit.edu`):

### 6.1 Architecture & Bot Challenge Resolution
- **Zero External Dependencies**: Operates entirely using Python 3 standard library modules (`urllib.request`, `http.cookiejar`, `html`, `re`, `json`).
- **Automated Client Challenge Solving**: CAS Campus gates automated requests with a JavaScript challenge (`var seed = (\d+);`). The scraper evaluates the mathematical formula dynamically:
  $$\text{answer} = ((\text{seed} \times 7) \pmod{100000}) + (\text{seed} \pmod 3)$$
  and resubmits via POST `botchallenge=<answer>` while preserving session cookies.

### 6.2 Recursive Extraction Pipeline
1. **Module Resolution**: Extracts numeric identifiers from module codes (e.g., `M-ETIT-106815` $\to$ `106815`) and queries `quicksearch.asp?find=<digits>&type=module` to resolve the internal CAS hexadecimal GUID.
2. **Direct Event Scraping**: Inspects `abstractModuleView.asp?gguid=<guid>` for direct lecture and tutorial listings.
3. **Recursive Teilleistungen (Bricks) Traversal**: In modern KIT SPO structures, modules often do not bind events directly; instead, they decompose into *Teilleistungen* (Bricks). If direct events are absent, the scraper recursively queries all `abstractBrickView.asp?gguid=<guid>` links within the module page.
4. **Event Detail Extraction (`event.asp?gguid=<guid>`)**:
   - Parses day, start/end minutes, frequency (`weekly`, `biweekly`, `single`), room numbers, campus building links, and lecturer names.
   - Automatically filters out examination and test dates (`Klausur`, `Prüfung`, `Exam`) to keep weekly planners clean.

### 6.3 Strict Semester Scoping Policy
- **Scoped Exclusively to Winter Semester 26/27 (`WS 26/27`)**:
  - Lecture times, rooms, and schedules are unstable across semesters and vary from year to year.
  - **Cross-semester fallbacks are strictly prohibited**: past terms (e.g., previous summer semesters) must never be used as a fallback for planning the upcoming semester.
  - If a course is not offered in WS 26/27 (e.g. Sommersemester-only modules), the scraper loads 0 events, sets `offeredInTerm: false`, and records an informative note (`"Not offered in Winter Semester 26/27"`), alerting the student in the UI.

### 6.4 Local Persistent Caching & SSO Authentication
- **Local Cache**: Fetched module schedules are written to `data/schedules/modules_cache.json` and academic term GUIDs to `data/schedules/terms.json`, enabling offline development and instant reload performance.
- **Optional KIT Shibboleth SSO (`/api/auth/kit-campus`)**:
  - For restricted or internal campus entries, supports optional authentication through KIT Shibboleth SSO (`idp.scc.kit.edu`).
  - Session cookies remain in-memory; credentials are never written to disk or logs.

### 6.5 Server REST Endpoints
| Endpoint | Method | Parameters / Body | Description |
|---|---|---|---|
| `/api/schedule` | `GET` | `id=<mod_id>&term=WS&year=2026&refresh=false` | Fetches lecture timeslots for a single module. |
| `/api/schedule/batch` | `POST` | `{"modules": string[], "term": "WS", "year": 2026}` | Bulk schedule retrieval for all modules in a semester. |
| `/api/terms` | `GET` | None | Returns all registered CAS Campus terms and current active GUID. |
| `/api/auth/kit-campus` | `POST` | `{"username": "...", "password": "..."}` | Authenticates session via KIT Shibboleth SSO. |

---

## 7. Universal Degree Rules & Validation Engine (`public/js/validator.js`)

The validator audits any study plan across $1 \dots N$ semesters in real time:

| # | Rule Check | Type | Description |
|---|---|---|---|
| 1 | **Duplicate Enrollment** | Error | No course may be enrolled more than once across any semester. |
| 2 | **Mutual Exclusions** | Error | Enforces antirequisite pairs mined from course prerequisites and degree rules. |
| 3 | **Term Availability** | Warning | Compares course frequency (`WS` vs. `SS`) against the calculated term for Semester $k$. |
| 4 | **Category Quotas & Attribution** | Warning/OK | Audits planned credits against category targets (Specialization, Electives, ÜQ, Thesis). Credits are assigned strictly without fractional overflow leaks. |
| 5 | **Master's Thesis §14(1) Gate** | Error | Checks which semester holds the Master's Thesis ($S_{thesis}$) and verifies that $\ge 75\text{ CP}$ has been accumulated across all prior semesters $1 \dots (S_{thesis} - 1)$. |
| 6 | **Workload Balance** | Warning | Advisories for semesters exceeding 35 CP or deviating significantly from target pace. |
| 7 | **Lecture & Exercise Timetable Conflicts** | Error / Warning | Cross-evaluates timetable slots for all courses scheduled in each semester. Hard collisions (`error`) occur if two weekly events overlap with at least one lecture. Bi-weekly alternating overlaps are flagged with advisories (`warning`). |

### 7.1 Multi-Category Attribution & Leak Prevention
Certain courses qualify for multiple categories (e.g., both Focus Area and Electives). `validator.js` evaluates the explicit user selection stored in `ScheduledItem.category` via `normalizeCategoryId()`. Credits are attributed strictly to the designated category without splitting or leaking overflow points into general electives.

### 7.2 Custom Module Category Integration
When auditing user-created custom courses (`mod.isCustom === true`), `inferCategory()` returns the module's declared category (e.g. *Interdisciplinary (ÜQ)*, *Electives*, or *Specialization*). Similarly, `getAvailableCategoryIds()` permits the course to count towards its assigned category or general electives.

### 7.3 Timetable Conflict & Overlap Engine (`checkTimetableConflicts`)
`checkTimetableConflicts(plan, schedules)` evaluates all unique pairs $(A, B)$ of modules enrolled within each semester:
1. **Day Alignment**: Compares slots where `slotA.day === slotB.day`.
2. **Interval Overlap Equation**: An intersection exists if:
   $$\max(\text{startA}, \text{startB}) < \min(\text{endA}, \text{endB})$$
3. **Severity Classification**:
   - **Hard Collision (`error`)**: Triggered when both slots are weekly and at least one is a lecture (`V` / *Vorlesung*).
   - **Bi-weekly Overlap (`warning`)**: Triggered when at least one slot alternates bi-weekly or involves tutorial/exercise sessions.
4. **UI Notification**: Outputs conflict descriptors detailing the day, overlapping time range (`HH:MM - HH:MM`), lecturers, room names, and affected module titles, which trigger red warning badges and conflict banners in the timetable view.

---

## 8. Universal Auto-Planner & Constraint Solver (`public/js/generator.js`)

The auto-planner uses heuristic constraint satisfaction:
1. **Pinned Preservation**: Locks all user-pinned modules to their exact semesters.
2. **Master's Thesis Placement**: Schedules the 30 CP thesis into the final semester ($N$).
3. **Staged Pool Distribution**: Distributes courses curated in the Staging Area across Semesters $1 \dots (N - 1)$, using `inferCategory()` to assign canonical category labels while respecting term frequency (`WS` vs. `SS`) and ~30 CP semester limits.
4. **Optional Catalog Fill**: When enabled, draws from available specialization and elective modules to complete 120 CP.

---

## 9. Frontend Architecture & State Management (`public/js/app.js`)

The client application manages all multi-degree interactions, persistent state, and interactive controls:

### 9.1 Custom Modules Management & Official KIT Code Linking (CRUD Lifecycle)
Users can add, edit, and delete custom courses or external credits (e.g. *Sprachenzentrum* language courses, HoC/ZAK workshops, transfer credits):
- **Creation (`openAddCustomModal`)**: Opens `#customModal` in creation mode with dynamic degree categories, pre-selecting *Interdisciplinary (ÜQ)*.
- **Official KIT Module Code Linking (`#customModuleCode`)**:
  - Students can optionally specify an official KIT module code (e.g., `M-INFO-106812`, `M-ETIT-106815`, `M-WIWI-105003`).
  - During schedule fetching, the planner translates the custom course ID (`CUSTOM-XXXXXX`) to its linked KIT module code, retrieves live timeslots from `/api/schedule`, and indexes them directly under `schedulesMap[customMod.id]`.
  - Custom courses with linked codes render lecture/exercise blocks on the weekly timetable grid and participate fully in timetable conflict auditing.
- **In-Place Editing (`openEditCustomModal`)**:
  - Populates `#customModal` with the module's active title, module code, credits, term, language, and category.
  - Automatically synchronizes edits across `this.customModules`, `this.modulesMap`, `this.modulesList`, and active semester slots in `this.plan.semesters`.
  - Re-triggers degree validation and refreshes catalog, staging, planner, and timetable views.
- **Safe Deletion (`deleteCustomModule`)**:
  - Prompts with a native confirmation dialog to prevent accidental data loss.
  - Cascades removal across `customModules`, `modulesList`, `modulesMap`, `stagedModules`, and all semester plan slots.
  - Closes the inspection modal if displaying the deleted module and automatically resets the active category filter if no custom courses remain.
- **UI Quick-Action Triggers**:
  - **Catalog Cards**: `✏️ Edit` and `🗑️` Delete buttons in the card footer.
  - **Staged Cards**: `✏️` Edit icon button and `✕` Unstage button.
  - **Semester Cards**: `✏️` Edit icon button in the action bar.
  - **Module Details Modal**: `✏️ Edit Course` and `🗑️ Delete Course` buttons in the footer, plus an identifying custom course badge and linked code in the header.
- **Dynamic Catalog Filter Pill**: When custom modules exist, a dynamic `✏️ Custom (<count>)` pill appears in `#categoryPills` to filter the catalog down to user-created courses.

### 9.2 Weekly Timetable Grid (`Stundenplan`) View
The timetable view provides a visual weekly calendar for scheduled semester courses:
- **Tabbed Layout Switching**: Seamlessly toggle between the Semester Board (`#tabPlannerView`) and the Weekly Timetable (`#tabTimetableView`).
- **5-Day Calendar Grid**:
  - Columns: Monday through Friday (`Mo` – `Fr`).
  - Rows: 12 hourly time bands from 08:00 to 20:00 (60px per hour).
  - Event positioning: calculated dynamically based on slot start minutes (`(startMinutes - 480) * 1px`) and duration.
- **Card Metadata**: Displays event type badges (`V` Vorlesung, `Ü` Übung, `P` Praktikum), course title, room name, lecturer, time range, and a direct link to the KIT campus building map.
- **Semester Selector & Stats**:
  - Dropdown `#timetableSemSelect` allows instantaneous switching between Semesters $1 \dots N$.
  - Live `#timetableSemStats` badge displays course count and enrolled ECTS credits.
- **Conflict Highlighting & Banners**:
  - Overlapping events are outlined with high-contrast red collision borders.
  - `#timetableConflictIndicator` danger badge lights up when collisions exist.
  - `#timetableConflictBanner` presents an itemized list of colliding lectures, affected days, and exact overlap intervals.
- **Strict Term Availability Notices**:
  - `#timetableTermNotice` warns students if enrolled modules have no scheduled events for Winter Semester 26/27.

### 9.3 Collapsible Staging Area
The staging tray provides an uncommitted backlog for prospective courses:
- **Collapsible Toggle**: Toggleable via `#btnToggleStaging` or chevron controls. State is persisted in `localStorage` under `kit_staging_collapsed`.
- **Live CP & Course Counter**: The badge `#stagedStatsBadge` displays real-time course and credit totals with a `.badge-pulse` animation on additions or removals.
- **Drag-and-Drop Staging**: Modules can be dragged directly into the staging tray or added via the `📦 Stage` button.

### 9.4 Multi-Category Attribution Switcher
For modules eligible for multiple curriculum areas (e.g. Focus Area vs. Electives):
- An interactive `.cat-pill-wrapper` dropdown pill is rendered on the semester card and in the inspection modal.
- Selecting an alternative category updates `ScheduledItem.category`, persists to `localStorage`, and instantly updates progress tallies with zero fractional leaks.

### 9.5 Collapsible Top Ribbon & Workspace Optimization
- The top header ribbon (Degree Selector, Specialization, Actions) can be toggled using `#btnToggleRibbon` or the keyboard shortcut **`Alt+H`**.
- State is preserved across reloads via `kit_ribbon_collapsed`.

### 9.6 Dynamic Semester Controls
- **`+ Add Semester`**: Expands the plan up to 8 semesters, alternating terms automatically (`WS` $\leftrightarrow$ `SS`) and updating pacing benchmarks.
- **`- Remove Semester`**: Safely trims trailing empty semesters, warning users if courses need to be moved to staging.

### 9.7 Module Catalog Sorting & Pagination
- **Credit Points & Alphabetical Sorting**: The `#filterSort` dropdown allows students to sort the course catalog by:
  - **`Credits (High → Low)`**: Sorts by ECTS credit weighting descending (with alphabetical secondary tie-break).
  - **`Credits (Low → High)`**: Sorts by ECTS credit weighting ascending.
  - **`Title (A → Z)`**: Alphabetical by course title.
  - **`Code (A → Z)`**: Alphabetical by module ID.
  - **`Sort: Default`**: Restores the natural handbook syllabus order.
- **State Persistence**: Selected sort order is preserved in `localStorage` under `kit_catalog_sort`.
- **Dynamic Catalog Status Bar**: Displays real-time matching counts (`#catalogCountText`) and active sort indicators (`#catalogSortIndicator`).
- **Responsive Pagination**: Smoothly renders an initial batch with an on-demand `Show more (+50 remaining)` button for extensive curricula with hundreds of modules.

---

## 10. Developer Operations & Verification Guide

### 10.1 Running Locally & Server Stability Architecture
```bash
python3 server.py
# Server runs at http://localhost:8080/
```
The backend `server.py` implements:
- **`ReusableThreadingHTTPServer`**: Sets `allow_reuse_address = True` and `daemon_threads = True` so child threads never block server shutdown.
- **Darwin Kqueue Selector Patch**: On macOS, replaces Python's default `PollSelector` with `selectors.KqueueSelector` to prevent 100% idle CPU busy-polling in socketserver loops.
- **Automatic Port Conflict Reclamation (`free_port_if_occupied`)**: Checks `lsof -ti :<port>` upon launch and automatically sends `SIGTERM` to orphaned instances, completely eliminating `[Errno 48] Address already in use`.

### 10.2 Uploading a New Handbook via UI
1. Start `server.py`.
2. Click **"Upload Handbook"** in the top navigation bar.
3. Drop in any official KIT Master Module Handbook PDF.
4. Review the extracted title, module count, and tracks in the preview card.
5. Click **"Activate & Start Planning"** to immediately switch to the new degree.

### 10.3 Batch Re-indexing Local Handbooks via CLI
To parse and index all PDFs in `modulhandbücher/`:
```bash
python3 scripts/preindex_all.py
```
This updates `data/degrees/` and regenerates `public/js/preloaded_degrees.js`.

### 10.4 Headless Plan Verification via CLI
```bash
python3 scripts/validate_plan.py etit-msc-2025
python3 scripts/validate_plan.py cs-msc-2025
```

### 10.5 Running Automated Verification Suites
Execute the full automated test suite covering timetable extraction, degree rules, and constraint solving:
```bash
# 1. Timetable extraction, strict term scoping, and collision solver suite
python3 scripts/test_timetable_conflicts.py

# 2. Multi-category attribution & CP leak prevention audit
node scripts/test_category_attribution.js

# 3. Staged pool distribution & heuristic auto-planner solver tests
node scripts/test_staged_autoplan.js
```
The test suite validates:
- Port binding and live `/api/terms` discovery.
- Single module schedule retrieval (`/api/schedule?id=M-ETIT-106815`).
- Strict semester scoping on unoffered courses (`M-ETIT-106953` has 0 events and `offeredInTerm: false` in WS 26/27).
- Batch schedule retrieval (`/api/schedule/batch`).
- Timetable interval collision math ($\max(\text{startA}, \text{startB}) < \min(\text{endA}, \text{endB})$).
- Clean shutdown of background test processes.

---

## 9. Study Plan Export & Import Architecture

### 9.1 Overview
The platform provides a unified JSON backup, publication-ready PDF, and high-DPI graphic export system. To allow students to save their work, share schedules, or continue planning across devices or sessions, a dedicated **Plan Import** capability is integrated directly into the top navigation ribbon.

### 9.2 Ribbon Integration & UI Components
- **Top Ribbon Placement**: Located in `<div class="controls-section">` right next to the active degree selector, specialization dropdown, and Export button:
  - Button: `<button id="btnImportPlan" class="btn btn-outline"><span>📥</span> Import</button>`
  - Cross-Modal Shortcut: Inside the Export modal, a shortcut link (`#btnSwitchToImport`) enables instant transition to the Import dialog.
- **Import Modal (`#importModal`)**:
  - Interactive drag-and-drop dropzone (`#importDropzone`) supporting direct file picking or dragging `.json` files.
  - Global window drag-and-drop listener that automatically triggers the import preview when a user drops a `.json` plan file anywhere onto the application.
  - Dynamic preview card (`#importPlanPreview`) displaying target degree match, specialization, academic start term/year, total planned courses, credit breakdown, and semester distribution pills.
  - Confirmation button: `<button id="btnConfirmImportPlan" class="btn btn-primary">✓ Import & Load Plan</button>`

### 9.3 Data Schema & Compatibility
The import engine is backwards- and forwards-compatible, supporting:
1. Standard plan exports (`{ degree, specialization, startTerm, startYear, semestersCount, semesters }`).
2. Extended exports with custom module definitions (`customModules`) and staged candidate pools (`stagedModules`).
3. Wrapped payloads (`{ plan: { ... } }`) or raw semester dictionaries (`{ "1": [...], "2": [...] }`).

### 9.4 Auto-Degree Switching & Custom Course Recovery
- **Automatic Degree Switching**: If the imported plan specifies a different degree installed in `data/degrees`, the planner automatically invokes `switchDegree(planDegree)`, updates the active handbook context, and applies the plan without loss of state.
- **Custom Course Synthesis**: If a module ID in the imported plan is not present in the active catalog or custom modules list, the system automatically registers a synthesized custom course object so that all courses and ECTS credits are preserved, displayed on the planner board, and included in validation audits.
- **Feedback System**: Toast notifications (`#kitToastContainer`) provide immediate visual confirmation on import and export operations.


