// generator.js - Automated Study Plan Generator & Constraint Solver for KIT M.Sc. ETIT SPO 2025

class PlanGenerator {
  constructor(modulesData, specializationsData) {
    this.modules = Array.isArray(modulesData) ? modulesData : Object.values(modulesData);
    this.modulesMap = new Map(this.modules.map(m => [m.id, m]));
    this.specializations = specializationsData;
  }

  getModule(id) {
    return this.modulesMap.get(id);
  }

  /**
   * Generates a 100% permissible, conflict-free 4-semester study plan.
   * Total = 120 CP:
   *  - 4 Fundamentals = 24 CP
   *  - 1 Spec Lab = 6 CP
   *  - Focus Area = 30 CP
   *  - Electives = 24 CP
   *  - Interdisciplinary Qualifications = 6 CP
   *  - Master's Thesis = 30 CP (Sem 4)
   * @param {Object} options - { specializationId, startTerm, englishOnly, focusProfile }
   */
  /**
   * Generates a study plan respecting pinned modules, staged pool, and degree constraints.
   * @param {Object} options - { specializationId, startTerm, englishOnly, stagedModuleIds, pinnedModules, fillMissingWithCatalog }
   */
  generatePlan(options = {}) {
    const specId = options.specializationId || "ARSE";
    const startTerm = options.startTerm || "WS";
    const englishOnly = !!options.englishOnly;
    const focusProfile = options.focusProfile || null;
    const stagedModuleIds = options.stagedModuleIds || [];
    const pinnedModules = options.pinnedModules || {};
    const fillMissingWithCatalog = options.fillMissingWithCatalog === true; // defaults to false!

    const spec = this.specializations.find(s => s.id === specId);
    if (!spec) {
      throw new Error(`Specialization ${specId} not found`);
    }

    const semesterTerms = {};
    for (let sem = 1; sem <= 4; sem++) {
      if (startTerm === 'WS') {
        semesterTerms[sem] = (sem % 2 === 1) ? 'WS' : 'SS';
      } else {
        semesterTerms[sem] = (sem % 2 === 1) ? 'SS' : 'WS';
      }
    }

    const plan = {
      specialization: specId,
      startTerm: startTerm,
      name: `Study Plan: ${spec.name} (${startTerm} Start)`,
      semesters: { 1: [], 2: [], 3: [], 4: [] }
    };

    const usedModuleIds = new Set();
    const semesterCP = { 1: 0, 2: 0, 3: 0, 4: 0 };

    let fundsCount = 0;
    let fundsCP = 0;
    let specLabCount = 0;
    let electiveLabCount = 0;
    let focusCP = 0;
    let electiveCP = 0;
    let uqCP = 0;
    let thesisPlaced = false;

    const canPlaceInSemester = (mod, sem, maxCP = 34) => {
      if (!mod) return false;
      if (usedModuleIds.has(mod.id)) return false;
      if (englishOnly && mod.language !== 'English' && mod.language !== 'German/English') return false;
      if (this.hasExclusionConflict(mod, usedModuleIds)) return false;

      const term = semesterTerms[sem];
      if (mod.term !== 'WS+SS' && mod.term !== 'Each term' && mod.term !== term) {
        return false;
      }
      if (semesterCP[sem] + mod.credits > maxCP) {
        return false;
      }
      return true;
    };

    const addModuleToSemester = (mod, sem, category, isPinned = false) => {
      plan.semesters[sem].push({
        id: mod.id,
        category: category,
        isPinned: !!isPinned
      });
      usedModuleIds.add(mod.id);
      semesterCP[sem] += mod.credits;
    };

    // --- STEP 1: PRESERVE ALL PINNED MODULES ---
    let pinnedCount = 0;
    for (let sem = 1; sem <= 4; sem++) {
      const pinnedList = pinnedModules[sem] || [];
      for (const item of pinnedList) {
        const mod = this.getModule(item.id);
        if (!mod || usedModuleIds.has(mod.id)) continue;

        addModuleToSemester(mod, sem, item.category || 'Electives', true);
        pinnedCount++;

        // Track category fulfillment for pinned items
        const cat = item.category;
        if (cat === 'Fundamentals') {
          fundsCount++;
          fundsCP += mod.credits;
        } else if (cat === 'Lab Course') {
          if (specLabCount === 0 && (spec.labCourses || []).includes(mod.id)) {
            specLabCount++;
          } else {
            electiveLabCount++;
          }
        } else if (cat === 'Focus Area') {
          focusCP += mod.credits;
        } else if (cat === 'Electives') {
          electiveCP += mod.credits;
          if (mod.isLab) electiveLabCount++;
        } else if (cat === 'Interdisciplinary Qualifications' || cat === 'UQ') {
          uqCP += mod.credits;
        } else if (cat === "Master's Thesis" || mod.id === 'M-ETIT-107191') {
          thesisPlaced = true;
        }
      }
    }

    // --- STEP 2: MASTER'S THESIS IN SEMESTER 4 ---
    // If no thesis is pinned/placed yet, place Master's Thesis in Semester 4
    const stagedThesis = stagedModuleIds.find(id => id === 'M-ETIT-107191' || this.getModule(id)?.categories?.includes("Master's Thesis"));
    if (!thesisPlaced) {
      const thesisId = stagedThesis || 'M-ETIT-107191';
      const thesisMod = this.getModule(thesisId);
      if (thesisMod && !usedModuleIds.has(thesisMod.id) && semesterCP[4] + thesisMod.credits <= 35) {
        addModuleToSemester(thesisMod, 4, "Master's Thesis");
        thesisPlaced = true;
      }
    }

    // --- STEP 3: PARTITION STAGED MODULES ---
    const availableStaged = stagedModuleIds
      .map(id => this.getModule(id))
      .filter(m => m && !usedModuleIds.has(m.id));

    const specFundIds = new Set(spec.fundamentalsList || []);
    const specLabIds = new Set(spec.labCourses || []);
    const specFocusIds = new Set(spec.focusModules || []);

    const stagedFunds = [];
    const stagedLabs = [];
    const stagedUQs = [];
    const stagedFocus = [];
    const stagedOthers = [];

    for (const mod of availableStaged) {
      if (mod.id === 'M-ETIT-107191') continue;
      if (specFundIds.has(mod.id)) {
        stagedFunds.push(mod);
      } else if (mod.isLab || specLabIds.has(mod.id)) {
        stagedLabs.push(mod);
      } else if (mod.categories?.includes('Interdisciplinary Qualifications') || mod.id === 'M-ETIT-105803') {
        stagedUQs.push(mod);
      } else if (specFocusIds.has(mod.id) || mod.categories?.includes('Focus Area')) {
        stagedFocus.push(mod);
      } else {
        stagedOthers.push(mod);
      }
    }

    let stagedPlacedCount = 0;
    const stagedUnplaced = [];

    const getBestSemester = (mod, targetSemesters = [1, 2, 3], maxCP = 34) => {
      let bestSem = null;
      let lowestCP = 999;
      for (const sem of targetSemesters) {
        if (canPlaceInSemester(mod, sem, maxCP)) {
          if (semesterCP[sem] < lowestCP) {
            lowestCP = semesterCP[sem];
            bestSem = sem;
          }
        }
      }
      return bestSem;
    };

    // Place Staged Fundamentals (up to 4 modules / 24 CP)
    // If a focus profile is chosen, prioritize fundamentals recommended for that profile
    if (focusProfile && spec.profileFundamentals && spec.profileFundamentals[focusProfile]) {
      const pSet = new Set(spec.profileFundamentals[focusProfile]);
      stagedFunds.sort((a, b) => (pSet.has(b.id) ? 1 : 0) - (pSet.has(a.id) ? 1 : 0));
    }

    const excessStagedFunds = [];
    for (const mod of stagedFunds) {
      if (fundsCount < 4) {
        const sem = getBestSemester(mod, [1, 2, 3]);
        if (sem) {
          addModuleToSemester(mod, sem, 'Fundamentals');
          fundsCount++;
          fundsCP += mod.credits;
          stagedPlacedCount++;
        } else {
          stagedUnplaced.push({ mod, reason: 'No term slot with capacity <= 34 CP' });
        }
      } else {
        excessStagedFunds.push(mod);
      }
    }

    // Place Staged Labs (1 for Spec Lab, up to 1 for Electives)
    for (const mod of stagedLabs) {
      if (specLabCount === 0 && specLabIds.has(mod.id)) {
        const sem = getBestSemester(mod, [2, 1, 3]); // prefer Sem 2
        if (sem) {
          addModuleToSemester(mod, sem, 'Lab Course');
          specLabCount++;
          stagedPlacedCount++;
          continue;
        }
      }
      if (electiveLabCount < 1) {
        const sem = getBestSemester(mod, [2, 1, 3]);
        if (sem) {
          addModuleToSemester(mod, sem, 'Electives');
          electiveLabCount++;
          electiveCP += mod.credits;
          stagedPlacedCount++;
          continue;
        }
      }
      stagedUnplaced.push({ mod, reason: 'Specialization lab and elective lab slots already filled or no term slot' });
    }

    // Place Staged ÜQ Modules
    for (const mod of stagedUQs) {
      const sem = getBestSemester(mod, [3, 2, 1]);
      if (sem) {
        addModuleToSemester(mod, sem, 'Interdisciplinary Qualifications');
        uqCP += mod.credits;
        stagedPlacedCount++;
      } else {
        stagedUnplaced.push({ mod, reason: 'No term slot with capacity <= 34 CP' });
      }
    }

    // Place Staged Focus Modules (+ excess fundamentals)
    const focusCandidates = [...stagedFocus, ...excessStagedFunds];
    const excessFocus = [];
    for (const mod of focusCandidates) {
      if (focusCP < 30) {
        const sem = getBestSemester(mod, [1, 2, 3]);
        if (sem) {
          addModuleToSemester(mod, sem, 'Focus Area');
          focusCP += mod.credits;
          stagedPlacedCount++;
        } else {
          excessFocus.push(mod);
        }
      } else {
        excessFocus.push(mod);
      }
    }

    // Place Staged Electives & Remaining Candidates
    const remainingStaged = [...excessFocus, ...stagedOthers];
    for (const mod of remainingStaged) {
      if (mod.isLab && electiveLabCount >= 1) {
        stagedUnplaced.push({ mod, reason: 'Max 1 elective lab permitted' });
        continue;
      }
      const sem = getBestSemester(mod, [1, 2, 3]);
      if (sem) {
        const cat = (mod.categories?.includes('Focus Area') && focusCP < 30) ? 'Focus Area' : 'Electives';
        addModuleToSemester(mod, sem, cat);
        if (cat === 'Focus Area') focusCP += mod.credits;
        else electiveCP += mod.credits;
        if (mod.isLab) electiveLabCount++;
        stagedPlacedCount++;
      } else {
        stagedUnplaced.push({ mod, reason: 'No compatible term slot with available capacity' });
      }
    }

    // --- STEP 4: OPTIONAL FILL WITH CATALOG MODULES ---
    let catalogFilledCount = 0;
    if (fillMissingWithCatalog) {
      // 4a. Fill missing Fundamentals (up to 4 modules)
      if (fundsCount < 4) {
        let fundPool = (spec.fundamentalsList || [])
          .map(id => this.getModule(id))
          .filter(m => m && !usedModuleIds.has(m.id) && (!englishOnly || m.language === 'English' || m.language === 'German/English'));

        if (focusProfile && spec.profileFundamentals && spec.profileFundamentals[focusProfile]) {
          const pSet = new Set(spec.profileFundamentals[focusProfile]);
          fundPool.sort((a, b) => (pSet.has(b.id) ? 1 : 0) - (pSet.has(a.id) ? 1 : 0));
        }

        for (const mod of fundPool) {
          if (fundsCount >= 4) break;
          const sem = getBestSemester(mod, [1, 2, 3], 32);
          if (sem) {
            addModuleToSemester(mod, sem, 'Fundamentals');
            fundsCount++;
            fundsCP += mod.credits;
            catalogFilledCount++;
          }
        }
      }

      // 4b. Fill missing Spec Lab (1 module)
      if (specLabCount === 0) {
        const labPool = this.modules.filter(m =>
          m.isLab &&
          specLabIds.has(m.id) &&
          !usedModuleIds.has(m.id) &&
          (!englishOnly || m.language === 'English' || m.language === 'German/English')
        );
        for (const sem of [2, 1, 3]) {
          const cand = labPool.find(m => canPlaceInSemester(m, sem, 32));
          if (cand) {
            addModuleToSemester(cand, sem, 'Lab Course');
            specLabCount++;
            catalogFilledCount++;
            break;
          }
        }
      }

      // 4c. Fill missing ÜQ (at least 6 CP)
      if (uqCP < 6) {
        const uqMod = this.getModule('M-ETIT-105803');
        if (uqMod && !usedModuleIds.has(uqMod.id)) {
          const sem = getBestSemester(uqMod, [3, 2, 1], 34);
          if (sem) {
            addModuleToSemester(uqMod, sem, 'Interdisciplinary Qualifications');
            uqCP += uqMod.credits;
            catalogFilledCount++;
          }
        }
      }

      // 4d. Fill missing Focus Area (target ~30 CP)
      const targetFocusCP = 30;
      if (focusCP < targetFocusCP) {
        const focusPool = this.modules.filter(m =>
          !m.isLab &&
          specFocusIds.has(m.id) &&
          !usedModuleIds.has(m.id) &&
          (!englishOnly || m.language === 'English' || m.language === 'German/English')
        );

        for (let sem = 1; sem <= 3; sem++) {
          while (focusCP < targetFocusCP && semesterCP[sem] < 28) {
            const cand = focusPool.find(m =>
              canPlaceInSemester(m, sem, 34) &&
              (focusCP + m.credits <= targetFocusCP + 2) &&
              !this.hasExclusionConflict(m, usedModuleIds)
            );
            if (cand) {
              addModuleToSemester(cand, sem, 'Focus Area');
              focusCP += cand.credits;
              catalogFilledCount++;
            } else {
              break;
            }
          }
        }
      }

      // 4e. Fill missing Electives (target ~24 CP / ~30 CP per semester)
      const electivePool = this.modules.filter(m =>
        !m.isLab &&
        m.categories && m.categories.includes('Electives') &&
        !usedModuleIds.has(m.id) &&
        (!englishOnly || m.language === 'English' || m.language === 'German/English')
      );

      for (let sem = 1; sem <= 3; sem++) {
        while (semesterCP[sem] < 30) {
          const remainingInSem = 30 - semesterCP[sem];
          const cand = electivePool.find(m =>
            canPlaceInSemester(m, sem, 34) &&
            m.credits <= (remainingInSem + 2) &&
            !this.hasExclusionConflict(m, usedModuleIds)
          );
          if (cand) {
            addModuleToSemester(cand, sem, 'Electives');
            electiveCP += cand.credits;
            catalogFilledCount++;
          } else {
            break;
          }
        }
      }
    }

    plan.report = {
      pinnedCount,
      stagedPlacedCount,
      stagedUnplacedCount: stagedUnplaced.length,
      stagedUnplaced,
      catalogFilledCount,
      fillMissingWithCatalog
    };

    return plan;
  }

  hasExclusionConflict(mod, usedModuleIds) {
    if (mod.exclusions) {
      for (const exclId of mod.exclusions) {
        if (usedModuleIds.has(exclId)) return true;
      }
    }
    const pairs = [
      ["M-ETIT-100524", "M-ETIT-100513"],
      ["M-ETIT-102264", "M-ETIT-102266"],
      ["M-ETIT-107444", "M-ETIT-100453"]
    ];
    for (const [a, b] of pairs) {
      if (mod.id === a && usedModuleIds.has(b)) return true;
      if (mod.id === b && usedModuleIds.has(a)) return true;
    }
    return false;
  }
}

// Export for node or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlanGenerator;
}
