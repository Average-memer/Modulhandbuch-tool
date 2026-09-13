// generator.js - Universal Study Plan Generator & Constraint Solver for KIT Master's Degrees
// Supports dynamic semesters (4, 5, 6+), arbitrary categories, and term-aware bin-packing

class PlanGenerator {
  constructor(modulesList, degreeData) {
    this.modules = Array.isArray(modulesList) ? modulesList : Object.values(modulesList || {});
    this.modulesMap = new Map(this.modules.map(m => [m.id, m]));
    this.degree = degreeData || {};
  }

  getModule(id) {
    return this.modulesMap.get(id);
  }

  /**
   * Generates a conflict-free study plan respecting pinned modules, staged pool, and N semesters.
   * @param {Object} options - { specializationId, startTerm, englishOnly, stagedModuleIds, pinnedModules, fillMissingWithCatalog, semestersCount }
   * @returns {Object} { plan, report }
   */
  generatePlan(options = {}) {
    const semCount = options.semestersCount || 4;
    const startTerm = options.startTerm || "WS";
    const specId = options.specializationId || options.specialization || null;
    const englishOnly = !!options.englishOnly;
    const stagedModuleIds = options.stagedModuleIds || [];
    const pinnedModules = options.pinnedModules || {};
    const fillMissingWithCatalog = options.fillMissingWithCatalog === true;

    // Calculate semester terms
    const semesterTerms = {};
    for (let sem = 1; sem <= semCount; sem++) {
      if (startTerm === 'WS') {
        semesterTerms[sem] = (sem % 2 === 1) ? 'WS' : 'SS';
      } else {
        semesterTerms[sem] = (sem % 2 === 1) ? 'SS' : 'WS';
      }
    }

    const plan = {
      degree: this.degree.id || "etit-msc-2025",
      specialization: specId,
      startTerm: startTerm,
      semestersCount: semCount,
      name: `Study Plan: ${this.degree.title || 'Master'} (${startTerm} Start, ${semCount} Semesters)`,
      semesters: {}
    };

    for (let sem = 1; sem <= semCount; sem++) {
      plan.semesters[sem] = [];
    }

    const usedModuleIds = new Set();
    const semesterCP = {};
    for (let sem = 1; sem <= semCount; sem++) {
      semesterCP[sem] = 0;
    }

    const report = {
      pinnedPreserved: 0,
      stagedPlaced: 0,
      stagedRejected: [],
      catalogAdded: 0,
      notes: []
    };

    // Calculate average non-thesis semester target
    const nonThesisSemCount = Math.max(1, semCount - 1);
    const targetCPPerSem = Math.min(32, Math.round(90 / nonThesisSemCount));
    const maxCPPerSem = Math.min(35, targetCPPerSem + 4);

    const canPlaceInSemester = (mod, sem, maxLimit = maxCPPerSem) => {
      if (!mod) return false;
      if (usedModuleIds.has(mod.id)) return false;
      if (englishOnly && mod.language !== 'English' && mod.language !== 'German/English') return false;
      if (this.hasExclusionConflict(mod, usedModuleIds)) return false;

      const term = semesterTerms[sem];
      if (mod.term !== 'WS+SS' && mod.term !== 'Each term' && mod.term !== term) {
        return false;
      }
      if ((semesterCP[sem] + mod.credits) > maxLimit) {
        return false;
      }
      return true;
    };

    const addModuleToSemester = (mod, sem, category, isPinned = false) => {
      plan.semesters[sem].push({
        id: mod.id,
        category: category || mod.categories?.[0] || 'Electives',
        isPinned: !!isPinned
      });
      usedModuleIds.add(mod.id);
      semesterCP[sem] += mod.credits;
    };

    // --- STEP 1: PRESERVE PINNED MODULES ---
    for (let sem = 1; sem <= semCount; sem++) {
      const pinnedList = pinnedModules[sem] || [];
      for (const item of pinnedList) {
        const modId = typeof item === 'string' ? item : item.id;
        const mod = this.getModule(modId);
        if (mod && !usedModuleIds.has(mod.id)) {
          addModuleToSemester(mod, sem, item.category || mod.categories?.[0], true);
          report.pinnedPreserved++;
        }
      }
    }

    // --- STEP 2: MASTER'S THESIS PLACEMENT (Semester N) ---
    const thesisSem = semCount;
    let thesisMod = this.modules.find(m => m.isThesis || m.credits >= 24 && (m.title.toLowerCase().includes('thesis') || m.title.toLowerCase().includes('masterarbeit')));
    
    // Check if thesis was already pinned somewhere
    let thesisAlreadyPlaced = false;
    for (let sem = 1; sem <= semCount; sem++) {
      if (plan.semesters[sem].some(it => {
        const m = this.getModule(it.id);
        return m && (m.isThesis || m.credits >= 24 && m.title.toLowerCase().includes('thesis'));
      })) {
        thesisAlreadyPlaced = true;
        break;
      }
    }

    if (!thesisAlreadyPlaced && thesisMod) {
      addModuleToSemester(thesisMod, thesisSem, "Master's Thesis", true);
      report.notes.push(`Master's Thesis (30 CP) scheduled in final semester (${thesisSem}).`);
    }

    // --- STEP 3: SCHEDULE STAGED MODULES ---
    const stagedMods = stagedModuleIds
      .map(id => this.getModule(id))
      .filter(m => m && !usedModuleIds.has(m.id));

    // Sort staged modules by credits descending
    stagedMods.sort((a, b) => b.credits - a.credits);

    for (const mod of stagedMods) {
      let placed = false;
      // Search non-thesis semesters first
      for (let sem = 1; sem < thesisSem; sem++) {
        if (canPlaceInSemester(mod, sem, maxCPPerSem)) {
          addModuleToSemester(mod, sem, mod.categories?.[0] || 'Specialization');
          placed = true;
          report.stagedPlaced++;
          break;
        }
      }
      // If still not placed, check if semester capacity can stretch slightly
      if (!placed) {
        for (let sem = 1; sem < thesisSem; sem++) {
          if (canPlaceInSemester(mod, sem, 36)) {
            addModuleToSemester(mod, sem, mod.categories?.[0] || 'Specialization');
            placed = true;
            report.stagedPlaced++;
            break;
          }
        }
      }
      if (!placed) {
        report.stagedRejected.push({
          id: mod.id,
          title: mod.title,
          reason: `No matching term slot or capacity in Semesters 1-${thesisSem - 1}.`
        });
      }
    }

    // --- STEP 4: CATALOG FILL (If Requested) ---
    if (fillMissingWithCatalog) {
      const getAvailableCatalog = () => this.modules.filter(m => !usedModuleIds.has(m.id) && !m.isThesis);

      let fundsCP = 0;
      let focusCP = 0;
      let labCP = 0;
      let uqCP = 0;

      // Count already placed credits
      for (let s = 1; s <= semCount; s++) {
        for (const it of plan.semesters[s]) {
          const m = this.getModule(it.id);
          if (!m || m.isThesis) continue;
          if (it.category === 'Fundamentals' || (specId && m.applicableSpecializations?.includes(specId) && m.categories?.includes('Fundamentals'))) fundsCP += m.credits;
          else if (it.category === 'Lab Course' || m.isLab || m.categories?.includes('Lab Course')) labCP += m.credits;
          else if (it.category === 'Focus Area' || (specId && m.applicableSpecializations?.includes(specId) && m.categories?.includes('Focus Area'))) focusCP += m.credits;
          else if (m.categories?.includes('Interdisciplinary Qualifications') || m.title.toLowerCase().includes('interdisciplinary')) uqCP += m.credits;
        }
      }

      const placeCandidate = (mod, catLabel) => {
        for (let sem = 1; sem < thesisSem; sem++) {
          if (canPlaceInSemester(mod, sem, maxCPPerSem)) {
            addModuleToSemester(mod, sem, catLabel);
            report.catalogAdded++;
            return true;
          }
        }
        for (let sem = 1; sem < thesisSem; sem++) {
          if (canPlaceInSemester(mod, sem, 35)) {
            addModuleToSemester(mod, sem, catLabel);
            report.catalogAdded++;
            return true;
          }
        }
        return false;
      };

      const specObj = this.degree?.specializations?.find(s => s.id === specId);

      // 1. Fundamentals (Target: 24 CP)
      const fundsTarget = this.degree.categories?.find(c => c.id === 'fundamentals')?.targetCredits || 24;
      const fundsCandidates = getAvailableCatalog().filter(m => {
        if (specObj) return specObj.fundamentals?.includes(m.id);
        return m.categories?.includes('Fundamentals') || m.categories?.includes('Core Subjects');
      });
      for (const m of fundsCandidates) {
        if (fundsCP >= fundsTarget) break;
        if (placeCandidate(m, 'Fundamentals')) {
          fundsCP += m.credits;
        }
      }

      // 2. Lab Course (Target: 6 CP)
      const labTarget = this.degree.categories?.find(c => c.id === 'lab')?.targetCredits || 6;
      if (labCP < labTarget) {
        const labCandidates = getAvailableCatalog().filter(m => {
          if (specObj) return specObj.labs?.includes(m.id) || (m.isLab && specObj.modules?.includes(m.id));
          return m.isLab || m.categories?.includes('Lab Course');
        });
        for (const m of labCandidates) {
          if (labCP >= labTarget) break;
          if (placeCandidate(m, 'Lab Course')) {
            labCP += m.credits;
          }
        }
      }

      // 3. Focus Area (Target: 24 CP)
      const focusTarget = this.degree.categories?.find(c => c.id === 'focus')?.targetCredits || 24;
      const focusCandidates = getAvailableCatalog().filter(m => {
        if (specObj) return specObj.focus?.includes(m.id);
        return m.categories?.includes('Focus Area');
      });
      for (const m of focusCandidates) {
        if (focusCP >= focusTarget) break;
        if (placeCandidate(m, 'Focus Area')) {
          focusCP += m.credits;
        }
      }

      // 4. Interdisciplinary Qualifications (ÜQ) (Target: 6 CP)
      const uqTarget = this.degree.categories?.find(c => c.id === 'uq')?.targetCredits || 6;
      if (uqCP < uqTarget) {
        const uqCandidates = getAvailableCatalog().filter(m => m.categories?.includes('Interdisciplinary Qualifications') || m.title.toLowerCase().includes('interdisciplinary'));
        for (const m of uqCandidates) {
          if (uqCP >= uqTarget) break;
          if (placeCandidate(m, 'Interdisciplinary (ÜQ)')) {
            uqCP += m.credits;
          }
        }
      }

      // 5. Electives / Remaining pool to balance semesters to ~30 CP
      const remainingCandidates = getAvailableCatalog();
      remainingCandidates.sort((a, b) => b.credits - a.credits);

      for (let sem = 1; sem < thesisSem; sem++) {
        while (semesterCP[sem] < targetCPPerSem) {
          const candidate = remainingCandidates.find(m => canPlaceInSemester(m, sem, maxCPPerSem));
          if (!candidate) break;
          addModuleToSemester(candidate, sem, 'Electives');
          report.catalogAdded++;
        }
      }
    }

    return { plan, report };
  }

  hasExclusionConflict(mod, usedModuleIds) {
    if (!mod.exclusions || !Array.isArray(mod.exclusions)) return false;
    for (const excl of mod.exclusions) {
      if (usedModuleIds.has(excl)) return true;
    }
    return false;
  }
}

// Global browser registration
if (typeof window !== 'undefined') {
  window.PlanGenerator = PlanGenerator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlanGenerator };
}
