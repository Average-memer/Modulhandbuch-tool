// validator.js - Degree Rules & Conflict Inference Engine for KIT M.Sc. ETIT SPO 2025

class DegreeValidator {
  constructor(modulesData, specializationsData, rulesData) {
    this.modules = modulesData; // Map or Object of id -> module
    this.specializations = specializationsData;
    this.rules = rulesData || {};
  }

  getModule(id) {
    if (this.modules instanceof Map) return this.modules.get(id);
    return this.modules[id];
  }

  getSpecialization(specId) {
    if (!this.specializations) return null;
    return this.specializations.find(s => s.id === specId) || null;
  }

  /**
   * Validates the complete study plan.
   * @param {Object} plan - { specialization: 'ARSE', startTerm: 'WS', semesters: { 1: [ {id, category} ], ... } }
   * @returns {Object} validation result
   */
  validate(plan) {
    const spec = this.getSpecialization(plan.specialization);
    const startTerm = plan.startTerm || 'WS';
    const errors = [];
    const warnings = [];
    const passed = [];

    // Flatten all scheduled modules with semester information
    const scheduled = [];
    const moduleCounts = {};
    const semesterCP = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const semesterTermType = {};

    for (let sem = 1; sem <= 4; sem++) {
      // Determine term for semester (WS or SS)
      if (startTerm === 'WS') {
        semesterTermType[sem] = (sem % 2 === 1) ? 'WS' : 'SS';
      } else {
        semesterTermType[sem] = (sem % 2 === 1) ? 'SS' : 'WS';
      }

      const items = plan.semesters[sem] || [];
      for (const item of items) {
        const mod = this.getModule(item.id);
        if (!mod) continue;

        scheduled.push({
          ...mod,
          semester: sem,
          scheduledCategory: item.category || this.inferCategory(mod, spec)
        });

        moduleCounts[mod.id] = (moduleCounts[mod.id] || 0) + 1;
        semesterCP[sem] += mod.credits;
      }
    }

    const totalCredits = Object.values(semesterCP).reduce((a, b) => a + b, 0);

    // 1. DUPLICATE CHECK
    for (const [modId, count] of Object.entries(moduleCounts)) {
      if (count > 1) {
        const mod = this.getModule(modId);
        errors.push({
          type: 'duplicate',
          moduleId: modId,
          message: `Module "${mod?.title || modId}" is selected ${count} times. Each module may only be taken once.`
        });
      }
    }

    // 2. MUTUAL EXCLUSIONS & CONFLICTS
    const knownExclusions = [
      {
        pair: ["M-ETIT-100524", "M-ETIT-100513"],
        desc: "Solar Energy [M-ETIT-100524] and Photovoltaics [M-ETIT-100513] are mutually exclusive."
      },
      {
        pair: ["M-ETIT-102264", "M-ETIT-102266"],
        desc: "Digital Hardware Design Lab (German) and (English) are mutually exclusive."
      },
      {
        pair: ["M-ETIT-107444", "M-ETIT-100453"],
        desc: "Hardware/Software Co-Design (6 CP) replaces (4 CP); both cannot be taken."
      },
      {
        pair: ["M-MACH-100501", "M-MACH-102686"],
        desc: "Automotive Engineering I modules are mutually exclusive."
      },
      {
        pair: ["M-MACH-102388", "M-MACH-101924"],
        desc: "Thermal Solar Energy modules are mutually exclusive."
      },
      {
        pair: ["M-ETIT-100552", "M-ETIT-103252"],
        desc: "Optical Systems in Medicine modules are mutually exclusive."
      }
    ];

    for (const excl of knownExclusions) {
      const [idA, idB] = excl.pair;
      if (moduleCounts[idA] && moduleCounts[idB]) {
        errors.push({
          type: 'mutual_exclusion',
          modules: [idA, idB],
          message: `Conflict: ${excl.desc}`
        });
      }
    }

    // Dynamic exclusions from module metadata
    for (const item of scheduled) {
      if (item.exclusions && Array.isArray(item.exclusions)) {
        for (const exclId of item.exclusions) {
          if (moduleCounts[exclId]) {
            const exclMod = this.getModule(exclId);
            errors.push({
              type: 'mutual_exclusion',
              modules: [item.id, exclId],
              message: `Conflict: "${item.title}" cannot be taken together with "${exclMod?.title || exclId}".`
            });
          }
        }
      }
    }

    // 3. TERM AVAILABILITY CHECK
    for (const item of scheduled) {
      const semTerm = semesterTermType[item.semester];
      const modTerm = item.term; // "WS", "SS", "WS+SS", "Each term"

      if (modTerm === 'WS' && semTerm !== 'WS') {
        warnings.push({
          type: 'term_mismatch',
          moduleId: item.id,
          semester: item.semester,
          message: `"${item.title}" is only offered in Winter semester, but placed in Semester ${item.semester} (${semTerm}).`
        });
      } else if (modTerm === 'SS' && semTerm !== 'SS') {
        warnings.push({
          type: 'term_mismatch',
          moduleId: item.id,
          semester: item.semester,
          message: `"${item.title}" is only offered in Summer semester, but placed in Semester ${item.semester} (${semTerm}).`
        });
      }
    }

    // 4. CATEGORY CREDIT TALLYING & RULES
    let fundamentalsCP = 0;
    let focusAreaCP = 0;
    let specLabCount = 0;
    let specLabCP = 0;
    let electiveCP = 0;
    let electiveLabCount = 0;
    let uqCP = 0;
    let thesisCP = 0;
    let thesisSem = null;

    const fundamentalsSelected = [];
    const focusAreaSelected = [];
    const specLabSelected = [];
    const electivesSelected = [];
    const uqSelected = [];

    for (const item of scheduled) {
      const cat = item.scheduledCategory;
      if (cat === 'Fundamentals') {
        fundamentalsCP += item.credits;
        fundamentalsSelected.push(item);
      } else if (cat === 'Lab Course' && !item.isElectiveLab) {
        specLabCount++;
        specLabCP += item.credits;
        specLabSelected.push(item);
      } else if (cat === 'Focus Area') {
        focusAreaCP += item.credits;
        focusAreaSelected.push(item);
      } else if (cat === 'Electives') {
        electiveCP += item.credits;
        electivesSelected.push(item);
        if (item.isLab) {
          electiveLabCount++;
        }
      } else if (cat === 'Interdisciplinary Qualifications' || cat === 'UQ') {
        uqCP += item.credits;
        uqSelected.push(item);
      } else if (cat === "Master's Thesis" || item.id === 'M-ETIT-107191') {
        thesisCP += item.credits;
        thesisSem = item.semester;
      }
    }

    // Field of Specialization rules check
    if (!spec) {
      errors.push({
        type: 'missing_spec',
        message: 'No Field of Specialization selected.'
      });
    } else {
      // Check Fundamentals
      // Each specialization requires 24 CP (4 modules of 6 CP from the approved list)
      const validFundIds = new Set(spec.fundamentalsList || []);
      const invalidFunds = fundamentalsSelected.filter(m => !validFundIds.has(m.id));
      if (invalidFunds.length > 0) {
        errors.push({
          type: 'invalid_fundamentals',
          message: `Some selected Fundamentals are not approved for ${spec.name}: ${invalidFunds.map(m => m.title).join(', ')}.`
        });
      }

      if (fundamentalsCP < 24) {
        errors.push({
          type: 'fundamentals_insufficient',
          message: `Fundamentals requirement not met: ${fundamentalsCP}/24 CP selected. Choose 4 modules (6 CP each) from the specialization fundamentals.`
        });
      } else if (fundamentalsCP > 24) {
        warnings.push({
          type: 'fundamentals_excess',
          message: `More than 24 CP (${fundamentalsCP} CP) assigned to Fundamentals. Standard is exactly 4 modules (24 CP). Excess modules can be credited under Focus Area or Electives.`
        });
      } else {
        passed.push(`Fundamentals satisfied: 24/24 CP (4 modules).`);
      }

      // Check Specialization Lab (exactly 1)
      if (specLabCount === 0) {
        errors.push({
          type: 'speclab_missing',
          message: `Field of Specialization requires exactly 1 Lab Course (currently 0 selected).`
        });
      } else if (specLabCount > 1) {
        errors.push({
          type: 'speclab_excess',
          message: `Field of Specialization allows exactly 1 Lab Course (currently ${specLabCount} selected). Move additional labs to Electives (maximum 1 allowed in Electives).`
        });
      } else {
        passed.push(`Specialization Lab satisfied: 1 Lab course (${specLabCP} CP).`);
      }

      // Check Elective Lab (at most 1)
      if (electiveLabCount > 1) {
        errors.push({
          type: 'electivelab_excess',
          message: `At most 1 additional Lab/Practical course is allowed in Electives (currently ${electiveLabCount} selected).`
        });
      } else if (electiveLabCount === 1) {
        passed.push(`Elective Lab: 1 allowed practical course included.`);
      }

      // Check Focus Area credits:
      // Fundamentals (24) + Lab (typically 6) + Focus Area = 60 CP total for Specialization
      const specTotalCP = fundamentalsCP + focusAreaCP + specLabCP;
      const targetFocusCP = 60 - 24 - specLabCP; // e.g. 60 - 24 - 6 = 30 CP

      if (focusAreaCP < 24) {
        errors.push({
          type: 'focus_insufficient',
          message: `Focus Area requires at least 24 CP (currently ${focusAreaCP} CP selected).`
        });
      } else if (specTotalCP < 60) {
        errors.push({
          type: 'spec_total_insufficient',
          message: `Field of Specialization total is ${specTotalCP}/60 CP. Add more Focus Area modules to reach 60 CP.`
        });
      } else {
        passed.push(`Field of Specialization total satisfied: ${specTotalCP}/60 CP (Focus: ${focusAreaCP} CP).`);
      }
    }

    // Check Electives (at most 24 CP, target 24 CP)
    if (electiveCP < 24) {
      warnings.push({
        type: 'electives_pending',
        message: `Electives: ${electiveCP}/24 CP selected. Add ${24 - electiveCP} more CP to complete Electives.`
      });
    } else {
      passed.push(`Electives satisfied: ${electiveCP}/24 CP.`);
    }

    // Check Interdisciplinary Qualifications (at least 6 CP)
    if (uqCP < 6) {
      errors.push({
        type: 'uq_insufficient',
        message: `Interdisciplinary Qualifications (ÜQ) requires at least 6 CP (currently ${uqCP}/6 CP).`
      });
    } else {
      passed.push(`Interdisciplinary Qualifications satisfied: ${uqCP}/6 CP.`);
    }

    // Check Master's Thesis (30 CP)
    if (thesisCP < 30) {
      errors.push({
        type: 'thesis_missing',
        message: `Master's Thesis (30 CP) is not scheduled.`
      });
    } else {
      passed.push(`Master's Thesis scheduled: 30 CP.`);

      // Check Master's Thesis admission rule (SPO §14(1): requires >= 75 CP completed before admission)
      if (thesisSem) {
        let cpPriorToThesis = 0;
        for (let s = 1; s < thesisSem; s++) {
          cpPriorToThesis += semesterCP[s];
        }
        if (cpPriorToThesis < 75) {
          errors.push({
            type: 'thesis_prerequisite_unmet',
            message: `Master's Thesis prerequisite violation: SPO §14(1) requires at least 75 CP completed prior to the thesis semester. Currently only ${cpPriorToThesis} CP planned before Semester ${thesisSem}.`
          });
        } else {
          passed.push(`Thesis admission requirement met (${cpPriorToThesis} CP completed prior to thesis semester, minimum required: 75 CP).`);
        }
      }
    }

    // Workload Balance per Semester
    for (let sem = 1; sem <= 4; sem++) {
      const cp = semesterCP[sem];
      if (sem < 4 && cp > 35) {
        warnings.push({
          type: 'semester_overload',
          semester: sem,
          message: `Semester ${sem} has ${cp} CP (heavy workload, standard is ~30 CP).`
        });
      } else if (sem < 4 && cp < 20 && cp > 0) {
        warnings.push({
          type: 'semester_underload',
          semester: sem,
          message: `Semester ${sem} has only ${cp} CP (low workload, standard is ~30 CP).`
        });
      }
    }

    // Total degree credits
    const isTotalComplete = totalCredits >= 120;
    if (totalCredits < 120) {
      warnings.push({
        type: 'total_credits_pending',
        message: `Total degree progress: ${totalCredits}/120 CP. ${120 - totalCredits} CP remaining.`
      });
    } else if (totalCredits === 120) {
      passed.push(`Total Degree Credits: exactly 120/120 CP!`);
    } else {
      passed.push(`Total Degree Credits: ${totalCredits}/120 CP.`);
    }

    const isPermissible = errors.length === 0;

    return {
      permissible: isPermissible,
      isComplete: isPermissible && isTotalComplete,
      totalCredits,
      semesterCP,
      semesterTermType,
      categories: {
        fundamentals: { current: fundamentalsCP, target: 24, ok: fundamentalsCP >= 24 },
        focusArea: { current: focusAreaCP, target: 30, ok: focusAreaCP >= 24 },
        specLab: { current: specLabCount, target: 1, ok: specLabCount === 1 },
        electives: { current: electiveCP, target: 24, ok: electiveCP >= 24 },
        electiveLab: { current: electiveLabCount, max: 1, ok: electiveLabCount <= 1 },
        uq: { current: uqCP, target: 6, ok: uqCP >= 6 },
        thesis: { current: thesisCP, target: 30, ok: thesisCP === 30 }
      },
      errors,
      warnings,
      passed
    };
  }

  inferCategory(mod, spec) {
    if (mod.id === 'M-ETIT-107191') return "Master's Thesis";
    if (mod.id === 'M-ETIT-105803') return "Interdisciplinary Qualifications";
    if (spec && spec.fundamentalsList && spec.fundamentalsList.includes(mod.id)) {
      return "Fundamentals";
    }
    if (mod.isLab) return "Lab Course";
    if (mod.categories && mod.categories.includes("Focus Area")) return "Focus Area";
    return "Electives";
  }
}

// Export for node or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DegreeValidator;
}
