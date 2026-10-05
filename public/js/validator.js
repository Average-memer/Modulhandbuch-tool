// validator.js - Universal Degree Rules & Conflict Inference Engine for KIT Master's Degrees
// Supports dynamic semesters (4, 5, 6+), arbitrary categories, mutual exclusions, and §14(1) thesis gate

class DegreeValidator {
  constructor(modulesMap, degreeData) {
    this.modulesMap = modulesMap || new Map();
    this.degree = degreeData || {};
  }

  getModule(id) {
    if (this.modulesMap instanceof Map) return this.modulesMap.get(id);
    return this.modulesMap[id] || null;
  }

  /**
   * Validates the complete study plan across N semesters.
   * @param {Object} plan - { degree, specialization, startTerm, semestersCount, semesters: { 1: [ {id, category} ], ... } }
   * @returns {Object} validation result
   */
  validate(plan, overrideSpec = null) {
    const activeSpec = overrideSpec || plan.specialization || null;
    const semCount = plan.semestersCount || 4;
    const startTerm = plan.startTerm || 'WS';
    const errors = [];
    const warnings = [];
    const passed = [];

    // Calculate term (WS / SS) for each semester 1..N
    const semesterTerms = {};
    for (let sem = 1; sem <= semCount; sem++) {
      if (startTerm === 'WS') {
        semesterTerms[sem] = (sem % 2 === 1) ? 'WS' : 'SS';
      } else {
        semesterTerms[sem] = (sem % 2 === 1) ? 'SS' : 'WS';
      }
    }

    const scheduled = [];
    const moduleCounts = {};
    const semesterCP = {};
    for (let sem = 1; sem <= semCount; sem++) {
      semesterCP[sem] = 0;
    }

    let thesisSemester = null;

    for (let sem = 1; sem <= semCount; sem++) {
      const items = plan.semesters?.[sem] || [];
      for (const item of items) {
        const modId = typeof item === 'string' ? item : item.id;
        const mod = this.getModule(modId);
        if (!mod) continue;

        const isThesis = mod.isThesis || mod.credits >= 24 && (mod.title.toLowerCase().includes('thesis') || mod.title.toLowerCase().includes('masterarbeit'));
        if (isThesis) {
          thesisSemester = sem;
        }

        scheduled.push({
          ...mod,
          semester: sem,
          isThesis: isThesis,
          isPinned: !!item.isPinned,
          scheduledCategory: item.category || this.inferCategory(mod, activeSpec)
        });

        moduleCounts[mod.id] = (moduleCounts[mod.id] || 0) + 1;
        semesterCP[sem] += mod.credits || 0;
      }
    }

    const totalCredits = Object.values(semesterCP).reduce((a, b) => a + b, 0);
    const targetCredits = this.degree.totalCredits || 120;

    // 1. DUPLICATE CHECK
    let hasDuplicate = false;
    for (const [modId, count] of Object.entries(moduleCounts)) {
      if (count > 1) {
        hasDuplicate = true;
        const mod = this.getModule(modId);
        errors.push({
          type: 'duplicate',
          moduleId: modId,
          message: `Module "${mod?.title || modId}" is selected ${count} times. Each module may only be taken once.`
        });
      }
    }
    if (!hasDuplicate && scheduled.length > 0) {
      passed.push('No duplicate courses enrolled across all semesters.');
    }

    // 2. MUTUAL EXCLUSIONS & PREREQUISITE CONFLICTS
    let hasExclusionConflict = false;
    for (const item of scheduled) {
      if (item.exclusions && Array.isArray(item.exclusions)) {
        for (const exclId of item.exclusions) {
          if (moduleCounts[exclId]) {
            hasExclusionConflict = true;
            const exclMod = this.getModule(exclId);
            errors.push({
              type: 'mutual_exclusion',
              modules: [item.id, exclId],
              message: `Mutual Exclusion: "${item.title}" [${item.id}] and "${exclMod?.title || exclId}" are mutually exclusive.`
            });
          }
        }
      }
    }
    if (!hasExclusionConflict && scheduled.length > 0) {
      passed.push('All course exclusion rules and antirequisite constraints satisfied.');
    }

    // 3. TERM AVAILABILITY (WS vs SS)
    let termMismatches = 0;
    for (const item of scheduled) {
      const sem = item.semester;
      const semTerm = semesterTerms[sem];
      const modTerm = item.term;

      if (modTerm === 'WS' && semTerm !== 'WS') {
        termMismatches++;
        warnings.push({
          type: 'term_mismatch',
          moduleId: item.id,
          semester: sem,
          message: `"${item.title}" is usually offered only in Winter Semester (WS), but scheduled in Semester ${sem} (${semTerm}).`
        });
      } else if (modTerm === 'SS' && semTerm !== 'SS') {
        termMismatches++;
        warnings.push({
          type: 'term_mismatch',
          moduleId: item.id,
          semester: sem,
          message: `"${item.title}" is usually offered only in Summer Semester (SS), but scheduled in Semester ${sem} (${semTerm}).`
        });
      }
    }
    if (termMismatches === 0 && scheduled.length > 0) {
      passed.push('All scheduled modules match their offered term frequency (WS / SS).');
    }

    // 4. CATEGORY CREDIT AUDITING
    const categoriesResult = {};
    const degreeCats = this.degree.categories || [
      { id: 'fundamentals', name: 'Fundamentals', targetCredits: 24 },
      { id: 'focus', name: 'Focus Area', targetCredits: 24 },
      { id: 'lab', name: 'Lab Course', targetCredits: 6 },
      { id: 'electives', name: 'Electives', targetCredits: 24 },
      { id: 'uq', name: 'Interdisciplinary (ÜQ)', targetCredits: 6 },
      { id: 'thesis', name: 'Master\'s Thesis', targetCredits: 30 }
    ];

    degreeCats.forEach(cat => {
      categoriesResult[cat.id] = {
        name: cat.name,
        target: cat.targetCredits,
        current: 0,
        ok: false
      };
    });

    const specObj = this.degree?.specializations?.find(s => s.id === activeSpec);

    for (const item of scheduled) {
      let catId = this.normalizeCategoryId(item.scheduledCategory);
      const mod = this.getModule(item.id) || item;
      
      // If degree has specializations, enforce active specialization track boundaries
      if (specObj) {
        const allowed = this.getAvailableCategoryIds(mod, specObj);
        if (!allowed.includes(catId)) {
          // If assigned category is not permitted for this module, fallback to first valid option
          catId = allowed[0] || 'electives';
        }
      } else if (activeSpec && ['fundamentals', 'focus', 'lab', 'specialization'].includes(catId)) {
        const inSpec = item.applicableSpecializations && item.applicableSpecializations.includes(activeSpec);
        if (!inSpec && !item.isLab) {
          catId = 'electives';
        }
      }

      // Attribute full credits directly to the designated category (no fractional overflow splitting)
      if (['fundamentals', 'focus', 'lab'].includes(catId) && !categoriesResult[catId] && categoriesResult['specialization']) {
        categoriesResult['specialization'].current += item.credits || 0;
      } else if (catId === 'fundamentals' && !categoriesResult['fundamentals'] && categoriesResult['core']) {
        categoriesResult['core'].current += item.credits || 0;
      } else if (categoriesResult[catId]) {
        categoriesResult[catId].current += item.credits || 0;
      } else if (item.isThesis && categoriesResult['thesis']) {
        categoriesResult['thesis'].current += item.credits || 0;
      } else if (categoriesResult['electives']) {
        categoriesResult['electives'].current += item.credits || 0;
      }
    }

    // Update 'ok' flags
    for (const [catKey, catData] of Object.entries(categoriesResult)) {
      catData.ok = catData.current >= catData.target;
      if (catData.ok) {
        passed.push(`${catData.name}: target of ${catData.target} CP reached (${catData.current} CP).`);
      }
    }

    // 5. MASTER'S THESIS & §14(1) PREREQUISITE GATE
    const thesisPrereqRequired = this.degree.thesisPrerequisiteCredits || 75;
    if (thesisSemester) {
      let priorCredits = 0;
      for (let s = 1; s < thesisSemester; s++) {
        priorCredits += semesterCP[s] || 0;
      }

      if (priorCredits < thesisPrereqRequired) {
        errors.push({
          type: 'thesis_prereq_shortfall',
          message: `Master's Thesis (§14(1) Gate): Only ${priorCredits} CP planned before thesis semester (Semester ${thesisSemester}). KIT examination regulations mandate at least ${thesisPrereqRequired} CP prior to registration.`
        });
      } else {
        passed.push(`Master's Thesis admission gate satisfied (${priorCredits} CP prior to Semester ${thesisSemester} >= ${thesisPrereqRequired} CP).`);
      }
    } else {
      warnings.push({
        type: 'missing_thesis',
        message: 'Master\'s Thesis (30 CP) is not yet scheduled in any semester.'
      });
    }

    // 6. WORKLOAD BALANCE ADVISORIES
    for (let sem = 1; sem <= semCount; sem++) {
      const cp = semesterCP[sem] || 0;
      if (sem === thesisSemester) {
        if (cp > 34) {
          warnings.push({
            type: 'thesis_overload',
            semester: sem,
            message: `Semester ${sem} includes the 30 CP Master's Thesis plus extra coursework (${cp} CP total). This may result in severe study overload.`
          });
        }
      } else {
        if (cp > 35) {
          warnings.push({
            type: 'semester_overload',
            semester: sem,
            message: `Semester ${sem} is overloaded with ${cp} CP (recommended standard: 25-32 CP).`
          });
        }
      }
    }

    // 7. OVERALL DEGREE COMPLETION
    const permissible = errors.length === 0;
    const allMandatoryCatsMet = Object.values(categoriesResult).every(c => c.ok || c.current >= c.target);
    const isComplete = permissible && totalCredits >= targetCredits && allMandatoryCatsMet;

    return {
      permissible,
      isComplete,
      totalCredits,
      targetCredits,
      semesterCP,
      semesterTerms,
      categories: categoriesResult,
      scheduledModules: scheduled,
      moduleCounts,
      errors,
      warnings,
      passed
    };
  }

  normalizeCategoryId(catName) {
    if (!catName) return 'electives';
    const c = catName.toLowerCase();
    if (c.includes('thesis') || c.includes('masterarbeit') || c.includes('abschlussarbeit')) return 'thesis';
    if (c.includes('uq') || c.includes('interdisciplinary') || c.includes('überfachliche')) return 'uq';
    if (c.includes('fundamental') || c.includes('stamm') || c.includes('pflicht') || c.includes('core') || c.includes('kern')) return 'fundamentals';
    if (c.includes('focus') || c.includes('schwerpunkt')) return 'focus';
    if (c.includes('lab') || c.includes('praktikum')) return 'lab';
    if (c.includes('specialization') || c.includes('vertiefung') || c.includes('major')) return 'specialization';
    return 'electives';
  }

  inferCategory(mod, activeSpecId = null) {
    if (!mod) return 'Electives';
    if (mod.isThesis) return "Master's Thesis";
    const cats = mod.categories || [];
    if (cats.includes("Master's Thesis")) return "Master's Thesis";
    if (cats.includes("Interdisciplinary Qualifications") || mod.id === 'M-ETIT-105803' || mod.title?.toLowerCase().includes("interdisciplinary")) {
      return "Interdisciplinary (ÜQ)";
    }
    if (mod.isCustom && cats.length > 0) {
      return cats[0];
    }

    const specObj = this.degree?.specializations?.find(s => s.id === activeSpecId);
    if (specObj) {
      if (specObj.fundamentals && specObj.fundamentals.includes(mod.id)) return "Fundamentals";
      if (specObj.labs && specObj.labs.includes(mod.id)) return "Lab Course";
      if (specObj.focus && specObj.focus.includes(mod.id)) return "Focus Area";
      return "Electives";
    }

    if (cats.includes("Fundamentals") || cats.includes("Core Subjects")) return "Fundamentals";
    if (cats.includes("Focus Area")) return "Focus Area";
    if (mod.isLab || cats.includes("Lab Course")) return "Lab Course";
    return "Electives";
  }

  getAvailableCategoryIds(mod, activeSpecId = null) {
    if (!mod) return ['electives'];
    if (mod.isThesis || (mod.credits >= 24 && (mod.title?.toLowerCase().includes('thesis') || mod.title?.toLowerCase().includes('masterarbeit')))) {
      return ['thesis'];
    }
    if (mod.id === 'M-ETIT-105803' || mod.categories?.includes("Interdisciplinary Qualifications") || mod.title?.toLowerCase().includes("interdisciplinary")) {
      return ['uq'];
    }
    if (mod.isCustom) {
      const customCats = ['electives'];
      (mod.categories || []).forEach(c => {
        customCats.push(this.normalizeCategoryId(c));
      });
      return [...new Set(customCats)];
    }

    const available = [];
    const specObj = typeof activeSpecId === 'object' && activeSpecId !== null
      ? activeSpecId
      : this.degree?.specializations?.find(s => s.id === activeSpecId);

    if (specObj) {
      if (specObj.fundamentals && specObj.fundamentals.includes(mod.id)) {
        available.push('fundamentals');
      }
      if (specObj.focus && specObj.focus.includes(mod.id)) {
        available.push('focus');
      }
      if ((specObj.labs && specObj.labs.includes(mod.id)) || mod.isLab) {
        available.push('lab');
      }
      // Any technical or catalog module can count as Electives
      available.push('electives');
    } else {
      const degreeCats = this.degree?.categories || [];
      const hasCore = degreeCats.some(c => c.id === 'core' || c.id === 'fundamentals');
      const hasFocus = degreeCats.some(c => c.id === 'focus');
      const hasLab = degreeCats.some(c => c.id === 'lab');

      const cats = mod.categories || [];
      if ((cats.includes("Fundamentals") || cats.includes("Core Subjects")) && hasCore) {
        const coreCat = degreeCats.find(c => c.id === 'core' || c.id === 'fundamentals');
        available.push(coreCat.id);
      }
      if (cats.includes("Focus Area") && hasFocus) {
        available.push('focus');
      }
      if ((mod.isLab || cats.includes("Lab Course")) && hasLab) {
        available.push('lab');
      }
      available.push('electives');
    }

    return [...new Set(available)];
  }
}

// Global browser registration
if (typeof window !== 'undefined') {
  window.DegreeValidator = DegreeValidator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DegreeValidator };
}
