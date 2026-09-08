// Starter dataset containing representative modules from KIT M.Sc. ETIT (SPO 2025)
// This enables full interactive testing of the UI, drag-and-drop, inspector, and rules validation.

const MOCK_SPECIALIZATIONS = [
  {
    id: "ARSE",
    name: "Automation, Robotics, and Systems Engineering",
    germanName: "Automatisierungs-, Roboter- und Systemtechnik",
    fundamentalsNeeded: 24, // 4 modules of 6 CP
    fundamentalsList: [
      "M-ETIT-106953", // Cyber-Physical Modeling (SS, 6 CP)
      "M-ETIT-106974", // Optical Engineering and Machine Vision (WS, 6 CP)
      "M-ETIT-107497", // Optimal Control (WS, 6 CP)
      "M-MACH-107558", // Robotic Intelligence: Perception and Scene Understanding (WS, 6 CP)
      "M-ETIT-106899", // Signal Processing Methods (WS, 6 CP)
      "M-ETIT-100537"  // Systems and Software Engineering (WS, 6 CP)
    ],
    focusProfiles: [
      "Automation, Control & Robotics",
      "Measurement, Sensing & Signal Processing",
      "Systems Engineering"
    ],
    profileFundamentals: {
      "Automation, Control & Robotics": [
        "M-ETIT-107497",
        "M-MACH-107558",
        "M-ETIT-100537"
      ],
      "Measurement, Sensing & Signal Processing": [
        "M-ETIT-106974",
        "M-ETIT-106899",
        "M-ETIT-100537"
      ],
      "Systems Engineering": [
        "M-ETIT-106953",
        "M-MACH-107558",
        "M-ETIT-100537"
      ]
    }
  },
  {
    id: "EPSE",
    name: "Electrical Power Systems and Electromobility",
    germanName: "Elektrische Energiesysteme und Elektromobilität",
    fundamentalsNeeded: 24,
    fundamentalsList: [
      "M-ETIT-107005", // Batteries, Fuel Cells, and Electrolysis (WS, 6 CP)
      "M-ETIT-105394", // Electric Power Transmission & Grid Control (SS, 6 CP)
      "M-MATH-106972", // Numerical Methods with Programming Practice (SS, 6 CP)
      "M-ETIT-107497", // Optimal Control (WS, 6 CP)
      "M-ETIT-104567", // Power Electronics (SS, 6 CP)
      "M-ETIT-105611"  // Superconductivity for Engineers (WS, 6 CP)
    ],
    focusProfiles: [
      "Electromobility",
      "Electric Drives",
      "Power Electronic Systems",
      "Renewables",
      "Electrochemical Systems",
      "Power Systems Engineering & Economics",
      "Superconductor Engineering"
    ],
    profileFundamentals: {
      "Electromobility": [
        "M-ETIT-107005",
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Electric Drives": [
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Power Electronic Systems": [
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Renewables": [
        "M-ETIT-107005",
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Electrochemical Systems": [
        "M-ETIT-107005",
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Power Systems Engineering & Economics": [
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567"
      ],
      "Superconductor Engineering": [
        "M-ETIT-105394",
        "M-MATH-106972",
        "M-ETIT-107497",
        "M-ETIT-104567",
        "M-ETIT-105611"
      ]
    }
  },
  {
    id: "ICT",
    name: "Information and Communication Technology",
    germanName: "Informations- und Kommunikationstechnik",
    fundamentalsNeeded: 24,
    fundamentalsList: [
      "M-ETIT-106815", // Advanced Communications Engineering (WS, 6 CP)
      "M-ETIT-107444", // Hardware/Software Co-Design (WS, 6 CP)
      "M-ETIT-100427", // Modern Radio Systems Engineering (WS+SS, 6 CP)
      "M-MATH-106972", // Numerical Methods with Programming Practice (SS, 6 CP)
      "M-ETIT-103270", // Optical Networks and Systems (WS, 6 CP)
      "M-ETIT-106899"  // Signal Processing Methods (WS, 6 CP)
    ],
    focusProfiles: [
      "Communication Systems",
      "Communication Algorithms and Theory",
      "Signal and Information Processing",
      "Microwave Systems",
      "Photonic Systems",
      "Embedded System Integration"
    ],
    profileFundamentals: {
      "Communication Systems": [
        "M-ETIT-106815",
        "M-ETIT-100427",
        "M-MATH-106972",
        "M-ETIT-103270",
        "M-ETIT-106899"
      ],
      "Communication Algorithms and Theory": [
        "M-ETIT-106815",
        "M-MATH-106972",
        "M-ETIT-106899"
      ],
      "Signal and Information Processing": [
        "M-ETIT-106815",
        "M-MATH-106972",
        "M-ETIT-106899"
      ],
      "Microwave Systems": [
        "M-ETIT-106815",
        "M-ETIT-107444",
        "M-ETIT-100427",
        "M-MATH-106972",
        "M-ETIT-106899"
      ],
      "Photonic Systems": [
        "M-ETIT-106815",
        "M-MATH-106972",
        "M-ETIT-103270",
        "M-ETIT-106899"
      ],
      "Embedded System Integration": [
        "M-ETIT-106815",
        "M-ETIT-107444",
        "M-MATH-106972",
        "M-ETIT-106899"
      ]
    }
  },
  {
    id: "MPQT",
    name: "Microelectronics, Photonics, and Quantum Technologies",
    germanName: "Mikroelektronik, Photonik und Quantentechnologien",
    fundamentalsNeeded: 24,
    fundamentalsList: [
      "M-ETIT-106963", // Hardware Synthesis and Optimization (SS, 6 CP)
      "M-MATH-106972", // Numerical Methods with Programming Practice (SS, 6 CP)
      "M-ETIT-106954", // Quantum Engineering (SS, 6 CP)
      "M-ETIT-106955", // Radio-Frequency Electronics (WS, 6 CP)
      "M-ETIT-107344"  // Integrated Photonics (WS, 6 CP)
    ],
    focusProfiles: [
      "Microelectronics",
      "Radio Frequency Electronics",
      "Quantum Technologies",
      "Optics and Photonics"
    ],
    profileFundamentals: {
      "Microelectronics": [
        "M-ETIT-106963",
        "M-MATH-106972",
        "M-ETIT-106954",
        "M-ETIT-106955",
        "M-ETIT-107344"
      ],
      "Radio Frequency Electronics": [
        "M-ETIT-106963",
        "M-MATH-106972",
        "M-ETIT-106954",
        "M-ETIT-106955",
        "M-ETIT-107344"
      ],
      "Quantum Technologies": [
        "M-ETIT-106963",
        "M-MATH-106972",
        "M-ETIT-106954",
        "M-ETIT-106955",
        "M-ETIT-107344"
      ],
      "Optics and Photonics": [
        "M-ETIT-106963",
        "M-MATH-106972",
        "M-ETIT-106954",
        "M-ETIT-106955",
        "M-ETIT-107344"
      ]
    }
  }
];

const MOCK_MODULES = [
  // Fundamentals - ARSE & others
  {
    id: "M-ETIT-107497",
    title: "Optimal Control",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Sören Hohmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "EPSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: ["M-ETIT-100531"],
    competenceGoal: "The students know the mathematical basics as well as fundamental methods and algorithms to solve constrained and unconstrained nonlinear static and dynamic optimization problems (Bellman Principle, Model Predictive Control, Euler-Lagrange).",
    content: "Mathematical basics for optimization problems. Dynamic Programming, calculus of variations (Hamilton method), transformation of dynamic optimization into static problems, constrained and unconstrained nonlinear programming, Model Predictive Control (MPC).",
    workload: "Presence: 60h (2+2 SWS), Prep/Follow-up: 90h, Exam prep: 30h. Total: 180h (6 CP).",
    literature: "Lecture slides, scriptum, Bertsekas: Dynamic Programming and Optimal Control."
  },
  {
    id: "M-ETIT-106899",
    title: "Signal Processing Methods",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Sander Wahls"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students can choose appropriate estimation methods based on theoretical properties and practical considerations, determine estimators for specific problems, weight pros and cons of data decomposition and time-frequency methods.",
    content: "Parameter estimation: BLUE, Maximum Likelihood, Bayesian estimators. Data decomposition: PCA, ICA, empirical mode decomposition. Time-frequency analysis: Short-time Fourier transform, Wavelets, Wigner-Ville, Hilbert spaces.",
    workload: "Lectures & tutorials: 60h (4 SWS), Self-study: 60h, Exam prep: 60h. Total: 180h (6 CP).",
    literature: "Oppenheim/Schafer: Discrete-Time Signal Processing; Kay: Fundamentals of Statistical Signal Processing."
  },
  {
    id: "M-ETIT-106953",
    title: "Cyber-Physical Modeling",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Mike Barth", "Prof. Dr.-Ing. Sören Hohmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (90 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students understand concepts of Cyber-Physical Systems and Digital Twins, validate information models and ontologies (AutomationML, Asset Administration Shell), and perform cross-domain physical and data-based modeling.",
    content: "Architectures, modeling & simulation for Cyber-Physical Systems. Digital Twins and Asset Administration Shell. Physics-based modeling (Euler-Lagrange, equivalent circuits) and data-based identification. Co-simulation with FMU/FMI.",
    workload: "Lectures & exercise: 60h (3+1 SWS), Prep/follow-up: 90h, Exam: 30h. Total: 180h (6 CP).",
    literature: "Lecture notes, AutomationML standards, VWS specifications."
  },
  {
    id: "M-ETIT-100537",
    title: "Systems and Software Engineering",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Eric Sax"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (90 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students can analyze embedded system functional principles, apply SDLC models (V-model, Agile, DevOps), create UML/SysML models, and understand testing, reliability, and functional safety.",
    content: "Design processes and specification languages for embedded software and systems. UML/SysML diagrams, requirement engineering, co-design, architectural patterns, verification and validation, ISO 26262 functional safety basics.",
    workload: "Attendance: 45h (2+2 SWS), Preparation/Homework: 75h, Exam prep: 60h. Total: 180h (6 CP).",
    literature: "Sommerville: Software Engineering; Liggesmeyer: Software-Qualität."
  },
  {
    id: "M-ETIT-106974",
    title: "Optical Engineering and Machine Vision",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Michael Heizmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students master fundamentals of optical imaging, sensors (CCD, CMOS, Line-scan), 2D Fourier transforms, image enhancement, segmentation, and feature extraction.",
    content: "Optical imaging (pinhole, lens optics), photometry, image sensors, 2D signals & filtering, noise, morphological operations, segmentation, Hough transform.",
    workload: "Attendance: 60h (3+1 SWS), Prep: 60h, Exam: 60h. Total: 180h (6 CP).",
    literature: "Beyerer, Puente León: Machine Vision."
  },
  {
    id: "M-MACH-107558",
    title: "Robotic Intelligence: Perception and Scene Understanding",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Arne Rönnau"],
    organisation: "KIT Department of Mechanical Engineering",
    categories: ["Fundamentals", "Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (60 min)",
    prerequisites: "None",
    exclusions: ["M-MACH-114034"],
    competenceGoal: "Students understand modern AI perception pipelines for robotics, 2D/3D vision transformers, object detection, multimodal fusion, and scene representation.",
    content: "Machine learning for robotics, Vision Transformers, 3D point clouds, sensor calibration, multimodal perception pipelines, integration on real mobile robots.",
    workload: "Lectures: 30h, Exercises/Labs: 110h, Exam: 40h. Total: 180h (6 CP).",
    literature: "Lecture slides, current CVPR/ICRA papers."
  },

  // Focus Area Modules - ARSE & ICT
  {
    id: "M-ETIT-106789",
    title: "IT/OT-Security Seminar",
    credits: 4,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Mike Barth"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Oral examination (approx. 25 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students know security requirements of industrial IT and OT domains, apply cryptographic mechanisms, and analyze IEC 62443 standard compliance.",
    content: "Industrial Control Systems (ICS) security, defense-in-depth, OPC UA security, Stuxnet case study, risk analysis, PKI in OT environments.",
    workload: "Lectures/Exercises: 24h, Prep: 36h, Project: 36h, Exam prep: 24h. Total: 120h (4 CP).",
    literature: "IEC 62443 standards, NIST SP 800-82."
  },
  {
    id: "M-ETIT-100420",
    title: "Radar Systems Engineering",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Marwan Younis", "Prof. Dr.-Ing. Thomas Zwick"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students can design and evaluate radar systems (CW, FMCW, Pulse, SAR), calculate link budgets, and implement radar signal processing.",
    content: "Radar principles, antenna arrays, FMCW radar, pulse compression, Doppler radar, synthetic aperture radar (SAR), automotive radar sensors.",
    workload: "Lectures: 44h, Computer exercise: 16h, Self-study: 120h. Total: 180h (6 CP).",
    literature: "Skolnik: Introduction to Radar Systems; Richards: Fundamentals of Radar Signal Processing."
  },
  {
    id: "M-ETIT-106040",
    title: "Digital Twin Engineering",
    credits: 4,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Mike Barth"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Model library project + presentation (25 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students can build physical models using Modelica, create functional mockup units (FMUs), and implement digital twins for mechatronic systems.",
    content: "Object-oriented physical modeling with Modelica, OpenModelica Editor, FMI standard, bidirectional physical flows, digital twin administration shells.",
    workload: "Lectures: 15h, Prep: 30h, Project modeling: 60h, Presentation: 15h. Total: 120h (4 CP).",
    literature: "Fritzson: Principles of Object-Oriented Modeling and Simulation with Modelica."
  },
  {
    id: "M-ETIT-105881",
    title: "Navigation and Localization Techniques",
    credits: 3,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Thomas Zwick"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Oral examination (approx. 20 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students understand positioning principles (dead reckoning, GNSS, trilateration, angle-of-arrival, Kalman filter, SLAM).",
    content: "Satellite navigation (GPS, Galileo), IMU sensor fusion, Kalman filtering, SLAM algorithms, indoor radio positioning (UWB, WiFi).",
    workload: "Lectures: 30h, Self-study: 60h. Total: 90h (3 CP).",
    literature: "Groves: Principles of GNSS, Inertial, and Multisensor Integrated Navigation Systems."
  },
  {
    id: "M-ETIT-100434",
    title: "Laser Metrology",
    credits: 3,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr. Marc Eichhorn"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Oral examination (approx. 20 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students master interferometry, Moiré methods, laser Doppler velocimetry, and LiDAR distance measurements.",
    content: "Laser diagnostics, coherence properties, two-beam interferometry, laser gyroscopes, time-of-flight LiDAR, Doppler anemometry.",
    workload: "Lectures: 30h, Self-study: 60h. Total: 90h (3 CP).",
    literature: "Eichhorn: Laser metrology scriptum; Saleh & Teich: Fundamentals of Photonics."
  },
  {
    id: "M-ETIT-107515",
    title: "Multivariable Control Systems",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Sören Hohmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: ["M-ETIT-100374"],
    competenceGoal: "Students design controllers for MIMO dynamic systems in state space and frequency domain (pole placement, observers, Kalman filters, decoupling).",
    content: "State space representation, controllability, observability, Ackermann formula, modal synthesis, state observers, Kalman filter design, decoupling control.",
    workload: "Lectures & exercises: 60h (4 SWS), Prep: 60h, Exam: 60h. Total: 180h (6 CP).",
    literature: "Lunze: Regelungstechnik 2; Chen: Linear System Theory and Design."
  },
  {
    id: "M-ETIT-107644",
    title: "Nonlinear Control Systems",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Sören Hohmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: ["M-ETIT-100371"],
    competenceGoal: "Students analyze nonlinear systems with Lyapunov methods, passivity, sliding-mode control, feedback linearization, and backstepping.",
    content: "State space of nonlinear systems, Lyapunov stability, passivity, sliding mode control, differential flatness, feedback linearization.",
    workload: "Lectures: 60h (4 SWS), Prep: 60h, Exam: 60h. Total: 180h (6 CP).",
    literature: "Khalil: Nonlinear Systems; Slotine & Li: Applied Nonlinear Control."
  },

  // Lab Courses
  {
    id: "M-ETIT-107524",
    title: "Robotics, Automation, and Systems Control Lab",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Mike Barth", "Prof. Dr.-Ing. Sören Hohmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Lab Course", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: true,
    examType: "Pitches + Presentation + Oral examination (20 min)",
    prerequisites: "None (Max 25 places, application in March)",
    exclusions: [],
    competenceGoal: "Hands-on implementation of automated robotic systems using ROS, EtherCAT, PLC, and motion controllers on real robotic manipulators.",
    content: "Robotic arm control, ROS driver interfaces, bus communication, trajectory planning, end-effector 3D printing and integration.",
    workload: "Lab sessions & exercises: 48h, Project development: 102h, Presentations & exam: 30h. Total: 180h (6 CP).",
    literature: "Lab manual, ROS documentation, EtherCAT guidelines."
  },
  {
    id: "M-ETIT-107294",
    title: "Mechatronic Measurement Systems Lab",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "German/English",
    coordinators: ["Prof. Dr.-Ing. Michael Heizmann"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Lab Course", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: true,
    examType: "Oral examination (approx. 20 min) + Lab reports",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students operate optical surface measurement systems (white light interferometry, confocal microscopy) and develop signal processing algorithms.",
    content: "8 lab experiments on surface metrology, optical sensors, sensor data processing, measurement uncertainty analysis.",
    workload: "Lab appointments: 36h, Protocol writing: 74h, Exam prep: 60h. Total: 170h (6 CP).",
    literature: "Lab scripts, DIN ISO standards."
  },
  {
    id: "M-ETIT-106633",
    title: "Signal Processing Lab",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Sander Wahls"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Lab Course", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: true,
    examType: "Written examination (120 min) + Protocols",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students conduct 8 experiments covering correlation measurements, modal analysis, Kalman filtering, and digital image processing.",
    content: "Hardware signal processing, filter implementation in DSP and MATLAB, modal analysis, state estimation.",
    workload: "Lab sessions: 32h, Preparation & protocols: 64h, Exam prep: 64h. Total: 160h (6 CP).",
    literature: "Lab instructions provided on ILIAS."
  },
  {
    id: "M-ETIT-107136",
    title: "Communications Engineering Lab",
    credits: 6,
    term: "WS+SS",
    termString: "Each term (WS & SS)",
    duration: "1 term",
    language: "German/English",
    coordinators: ["Dr.-Ing. Holger Jäkel"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Lab Course", "Electives"],
    applicableSpecializations: ["ICT"],
    isLab: true,
    examType: "Lab performance + Oral examination (30 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Implement communication components using Software Defined Radio (GNU Radio), Python, multirate filters, OFDM, and digital modulations.",
    content: "11 experiments: Python for DSP, DFT, sampling, filters, digital modulations, channel coding, GNU Radio SDR, OFDM.",
    workload: "Lab: 44h, Preparation: 88h, Exam: 48h. Total: 180h (6 CP).",
    literature: "Lab manual on ILIAS."
  },
  {
    id: "M-ETIT-107138",
    title: "Electric Drives and Power Electronics Lab",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "German/English",
    coordinators: ["Prof. Dr. Martin Doppelbauer"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Lab Course", "Electives"],
    applicableSpecializations: ["EPSE"],
    isLab: true,
    examType: "Oral exam per experiment + Reports",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Operate test benches for electric machines (PSM, induction machines), power semiconductors (IGBT, SiC MOSFET), and MMC converters.",
    content: "8 experiments: Space vector transformation, SiC/IGBT dynamic switching, field weakening, field-oriented control, dual active bridge, modular multilevel converters.",
    workload: "Lab: 40h, Preparation: 125h, Review: 15h. Total: 180h (6 CP).",
    literature: "ETI Lab Guide."
  },

  // Electives & Interdisciplinary
  {
    id: "M-ETIT-107440",
    title: "Coding of Audiovisual Signals",
    credits: 3,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Laurent Schmalen"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE", "ICT"],
    isLab: false,
    examType: "Oral examination (approx. 20 min)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students understand source coding, transform coding, audio compression (MP3, AAC) and video codecs (H.264, HEVC).",
    content: "Lossless compression (Huffman, Arithmetic), rate-distortion theory, psychoacoustic models, DCT, motion estimation in video compression.",
    workload: "Lectures: 30h, Prep: 30h, Exam: 30h. Total: 90h (3 CP).",
    literature: "Ohm: Multimedia Communication Technology; Sayood: Data Compression."
  },
  {
    id: "M-INFO-107197",
    title: "Deep Learning and Neural Networks",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr. Jan Niehues"],
    organisation: "KIT Department of Informatics",
    categories: ["Electives"],
    applicableSpecializations: ["ARSE", "ICT", "EPSE", "MPQT"],
    isLab: false,
    examType: "Written examination (60 min)",
    prerequisites: "None",
    exclusions: ["T-INFO-101383", "T-INFO-109124"],
    competenceGoal: "Students understand deep learning architectures, CNNs, RNNs, transformers, training dynamics, loss functions, and optimization.",
    content: "Multilayer perceptrons, backpropagation, CNN architectures, sequence models (LSTM, Transformers), generative models.",
    workload: "Lectures: 60h (4 SWS), Self-study: 90h, Exam: 30h. Total: 180h (6 CP).",
    literature: "Goodfellow, Bengio, Courville: Deep Learning."
  },
  {
    id: "M-ETIT-106780",
    title: "Practical Tools for Control Engineers",
    credits: 4,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Dr.-Ing. Balint Varga"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["ARSE"],
    isLab: false,
    examType: "Oral exam (25 min) + Programming assignment",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Students apply modular software engineering and Model Predictive Control tools to automotive and robotic problems.",
    content: "Modular control code in C++/Python, real-time optimization tools, ROS integration, MPC case studies.",
    workload: "Lectures: 30h, Homework: 60h, Exam: 30h. Total: 120h (4 CP).",
    literature: "Lecture slides and code repositories."
  },
  {
    id: "M-ETIT-100524",
    title: "Solar Energy",
    credits: 6,
    term: "WS",
    termString: "Each winter term",
    duration: "1 term",
    language: "English",
    coordinators: ["Prof. Dr. Ulrich Wilhelm Paetzold", "Prof. Dr. Bryce Sydney Richards"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["EPSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "Basic knowledge of optoelectronics",
    exclusions: ["M-ETIT-100513"], // MUTUAL EXCLUSION with Photovoltaics!
    competenceGoal: "Students master solar cells physics, crystalline silicon, thin films, tandem solar cells, PV systems and economics.",
    content: "Solar spectrum, pn-junction physics under illumination, recombination, silicon cells, perovskite and tandem cells, PV modules.",
    workload: "Lectures: 60h, Self-study: 120h. Total: 180h (6 CP).",
    literature: "Smets: Solar Energy; Würfel: Physics of Solar Cells."
  },
  {
    id: "M-ETIT-100513",
    title: "Photovoltaics",
    credits: 6,
    term: "SS",
    termString: "Each summer term",
    duration: "1 term",
    language: "German",
    coordinators: ["Prof. Dr.-Ing. Michael Powalla"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Focus Area", "Electives"],
    applicableSpecializations: ["EPSE"],
    isLab: false,
    examType: "Written examination (120 min)",
    prerequisites: "None",
    exclusions: ["M-ETIT-100524"], // MUTUAL EXCLUSION with Solar Energy!
    competenceGoal: "Verständnis der photovoltaischen Energiewandlung in Halbleitern, Fertigungstechnologien und Systemtechnik.",
    content: "Halbleitergrundlagen, pn-Übergang, Silizium-Solarzellen, Dünnschichttechnologien, Systemtechnik, Wechselrichter.",
    workload: "Vorlesung & Übung: 45h, Nachbereitung: 74h, Prüfung: 51h. Gesamt: 180h (6 CP).",
    literature: "Mertens: Photovoltaik Lehrbuch."
  },

  // Interdisciplinary Qualifications (ÜQ)
  {
    id: "M-ETIT-105803",
    title: "Interdisciplinary Qualifications",
    credits: 6,
    term: "WS+SS",
    termString: "Each term (WS & SS)",
    duration: "1 term",
    language: "German/English",
    coordinators: ["Prof. Dr.-Ing. Marc Hiller"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Interdisciplinary Qualifications"],
    applicableSpecializations: ["ARSE", "EPSE", "ICT", "MPQT"],
    isLab: false,
    examType: "Pass/Fail achievements (coursework)",
    prerequisites: "None",
    exclusions: [],
    competenceGoal: "Acquisition of key interdisciplinary, non-technical competences (languages, project management, business administration, ethics).",
    content: "Elective courses chosen from House of Competence (HOC), Sprachenzentrum (SPZ), ZAK/FORUM, or departmental courses such as Engineer's Field of Work, Ethics of Technology, Patent Law.",
    workload: "Total 180h (6 CP) typically across 2-3 courses.",
    literature: "Depends on chosen courses."
  },

  // Master's Thesis
  {
    id: "M-ETIT-107191",
    title: "Master's Thesis",
    credits: 30,
    term: "WS+SS",
    termString: "Each term (WS & SS)",
    duration: "1 term (6 months)",
    language: "English",
    coordinators: ["Prof. Dr.-Ing. Marc Hiller"],
    organisation: "KIT Department of Electrical Engineering and Information Technology",
    categories: ["Master's Thesis"],
    applicableSpecializations: ["ARSE", "EPSE", "ICT", "MPQT"],
    isLab: false,
    examType: "Thesis (6 months) + Final oral presentation",
    prerequisites: "At least 75 credits must be successfully earned in modules of the Master's program before admission (SPO §14(1)).",
    exclusions: [],
    competenceGoal: "Independent scientific research and development on a challenging topic in Electrical Engineering and Information Technology, with structured scientific reporting and conference-style defense.",
    content: "Individual scientific project supervised by a university professor at the KIT Department of Electrical Engineering and Information Technology.",
    workload: "Total: 900 hours = 30 CP (full-time semester).",
    literature: "Provided by supervisor according to research topic."
  }
];

// Official exemplary study plan from Module Handbook Chapter 6 (page 27)
const OFFICIAL_EXEMPLARY_PLAN = {
  specialization: "ARSE",
  startTerm: "WS",
  name: "Official Exemplary Plan (Handbook p. 27)",
  semesters: {
    1: [
      { id: "M-ETIT-107497", category: "Fundamentals" }, // Optimal Control (6 CP)
      { id: "M-ETIT-106899", category: "Fundamentals" }, // Signal Processing Methods (6 CP)
      { id: "M-ETIT-106789", category: "Focus Area" },   // IT/OT-Security Seminar (4 CP)
      { id: "M-ETIT-100420", category: "Focus Area" },   // Radar Systems Engineering (6 CP)
      { id: "M-ETIT-106040", category: "Focus Area" },   // Digital Twin Engineering (4 CP)
      { id: "M-ETIT-107440", category: "Electives" }     // Coding of Audiovisual Signals (3 CP)
      // Sum = 29 CP
    ],
    2: [
      { id: "M-ETIT-106953", category: "Fundamentals" }, // Cyber-Physical Modeling (6 CP)
      { id: "M-ETIT-105881", category: "Focus Area" },   // Navigation and Localization Techniques (3 CP)
      { id: "M-ETIT-100434", category: "Focus Area" },   // Laser Metrology (3 CP)
      { id: "M-ETIT-107524", category: "Lab Course" },   // Robotics, Automation, and Systems Control Lab (6 CP)
      { id: "M-INFO-107197", category: "Electives" }     // Deep Learning and Neural Networks (6 CP)
      // Sum = 24 CP
    ],
    3: [
      { id: "M-ETIT-100537", category: "Fundamentals" }, // Systems and Software Engineering (6 CP)
      { id: "M-ETIT-107515", category: "Focus Area" },   // Multivariable Control Systems (6 CP)
      { id: "M-ETIT-107294", category: "Electives" },    // Mechatronic Measurement Systems Lab (6 CP - allowed elective lab)
      { id: "M-ETIT-106780", category: "Electives" },    // Practical Tools for Control Engineers (4 CP)
      { id: "M-ETIT-105803", category: "Interdisciplinary Qualifications" } // ÜQ (6 CP)
      // Sum = 28 CP
    ],
    4: [
      { id: "M-ETIT-107191", category: "Master's Thesis" } // Master's Thesis (30 CP)
    ]
  }
};
