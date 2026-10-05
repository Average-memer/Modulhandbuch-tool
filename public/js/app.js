// app.js - Universal Master Degree Planner Controller
// Clean, modular architecture with multi-degree support, dynamic N semesters, and bilingual handbook ingestion

class UniversalStudyPlannerApp {
  constructor() {
    this.degreesIndex = [];
    this.activeDegree = null;
    this.modulesList = [];
    this.modulesMap = new Map();
    this.currentSpecialization = null;
    this.startTerm = 'WS';
    this.semestersCount = 4;
    this.activeCategoryFilter = 'all';
    this.activeTermFilter = 'all';
    this.activeLangFilter = 'all';
    this.searchQuery = '';

    this.plan = {
      degree: null,
      specialization: null,
      startTerm: 'WS',
      semestersCount: 4,
      semesters: { 1: [], 2: [], 3: [], 4: [] }
    };

    this.stagedModules = [];
    this.customModules = [];
    this.validator = null;
    this.generator = null;
    this.inspectedModule = null;
    this.lastValidationResult = null;
    this.pendingUploadedDegreeId = null;
  }

  async init() {
    await this.loadDegreesIndex();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupUploadModal();
  }

  // --- DEGREE LOADING & SWITCHING ---

  async loadDegreesIndex() {
    // 1. Immediately hydrate synchronously from preloaded bundle if available
    if (typeof window !== 'undefined' && window.PRELOADED_DEGREES_INDEX && window.PRELOADED_DEGREES_INDEX.length > 0) {
      this.degreesIndex = window.PRELOADED_DEGREES_INDEX;
      this.renderDegreeSelector();

      const savedDegreeId = localStorage.getItem('kit_active_degree');
      const initialDegreeId = (savedDegreeId && this.degreesIndex.some(d => d.id === savedDegreeId))
        ? savedDegreeId
        : (this.degreesIndex[0]?.id || 'etit-msc-2025');

      if (window.PRELOADED_DEGREES_DATA && window.PRELOADED_DEGREES_DATA[initialDegreeId]) {
        this.applyDegreePackage(window.PRELOADED_DEGREES_DATA[initialDegreeId]);
      }
    }

    // 2. Refresh from server API in background
    try {
      const res = await fetch('/api/degrees');
      if (res.ok) {
        const serverIndex = await res.json();
        if (serverIndex && serverIndex.length > 0) {
          this.degreesIndex = serverIndex;
          this.renderDegreeSelector();
        }
      }
    } catch (e) {
      console.log('Using offline preloaded index');
    }

    // Determine target degree
    const savedDegreeId = localStorage.getItem('kit_active_degree');
    const targetDegreeId = (savedDegreeId && this.degreesIndex.some(d => d.id === savedDegreeId))
      ? savedDegreeId
      : (this.degreesIndex[0]?.id || 'etit-msc-2025');

    // Only switch if active degree is not yet loaded
    if (!this.activeDegree || this.activeDegree.id !== targetDegreeId) {
      await this.switchDegree(targetDegreeId);
    }
  }

  renderDegreeSelector() {
    const select = document.getElementById('degreeSelect');
    if (!select) return;
    select.innerHTML = '';

    this.degreesIndex.forEach(deg => {
      const opt = document.createElement('option');
      opt.value = deg.id;
      opt.textContent = `${deg.title} (SPO ${deg.spo})`;
      select.appendChild(opt);
    });

    if (this.activeDegree) {
      select.value = this.activeDegree.id;
    }
  }

  async switchDegree(degreeId) {
    if (!degreeId) return;

    let degreePkg = null;

    // 1. Try fetching from server API
    try {
      const res = await fetch(`/api/degree?id=${encodeURIComponent(degreeId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          degreePkg = { degree: data.degree, modules: data.modules };
        }
      }
    } catch (e) {
      console.log('Falling back to offline preloaded data for', degreeId);
    }

    // 2. Fallback to preloaded bundle
    if (!degreePkg && typeof window !== 'undefined' && window.PRELOADED_DEGREES_DATA) {
      degreePkg = window.PRELOADED_DEGREES_DATA[degreeId];
    }

    if (!degreePkg) {
      console.error('Could not load degree package for', degreeId);
      return;
    }

    this.applyDegreePackage(degreePkg);
  }

  applyDegreePackage(degreePkg) {
    if (!degreePkg || !degreePkg.degree) return;

    this.activeDegree = degreePkg.degree;
    const rawModules = Array.isArray(degreePkg.modules) ? degreePkg.modules : Object.values(degreePkg.modules);
    this.modulesList = rawModules;
    this.modulesMap = new Map(this.modulesList.map(m => [m.id, m]));

    localStorage.setItem('kit_active_degree', this.activeDegree.id);

    // Sync select dropdown
    const select = document.getElementById('degreeSelect');
    if (select && select.value !== this.activeDegree.id) {
      select.value = this.activeDegree.id;
    }

    // Update Header Brand
    const titleEl = document.getElementById('brandDegreeTitle');
    if (titleEl) titleEl.textContent = this.activeDegree.title;
    const subEl = document.getElementById('brandDegreeSubtitle');
    if (subEl) subEl.textContent = `${this.activeDegree.faculty} • SPO ${this.activeDegree.spo}`;

    // Initialize engines
    this.validator = new DegreeValidator(this.modulesMap, this.activeDegree);
    this.generator = new PlanGenerator(this.modulesList, this.activeDegree);

    // Load degree-namespaced state
    this.loadDegreeState();

    // Render UI components
    this.renderSpecializationSelector();
    this.renderCategoryPills();
    this.renderCategoryChips();
    this.renderPlanner();
    this.renderCatalog();
    this.runValidation();
  }

  loadDegreeState() {
    const degId = this.activeDegree.id;
    // Load Custom Modules
    try {
      const rawCustom = localStorage.getItem(`kit_custom_${degId}`);
      this.customModules = rawCustom ? JSON.parse(rawCustom) : [];
      this.customModules.forEach(m => {
        m.isCustom = true;
        this.modulesMap.set(m.id, m);
        if (!this.modulesList.some(x => x.id === m.id)) {
          this.modulesList.push(m);
        }
      });
    } catch (e) {
      this.customModules = [];
    }

    // Load Staged Modules
    try {
      const rawStaged = localStorage.getItem(`kit_staged_${degId}`);
      this.stagedModules = rawStaged ? JSON.parse(rawStaged) : [];
    } catch (e) {
      this.stagedModules = [];
    }

    // Load Study Plan
    try {
      const rawPlan = localStorage.getItem(`kit_plan_${degId}`);
      if (rawPlan) {
        const parsed = JSON.parse(rawPlan);
        this.startTerm = parsed.startTerm || 'WS';
        this.semestersCount = parsed.semestersCount || 4;
        this.currentSpecialization = parsed.specialization || (this.activeDegree.specializations?.[0]?.id || null);
        this.plan = {
          degree: degId,
          specialization: this.currentSpecialization,
          startTerm: this.startTerm,
          semestersCount: this.semestersCount,
          semesters: parsed.semesters || {}
        };
      } else {
        this.semestersCount = this.activeDegree.semestersCount || 4;
        this.startTerm = 'WS';
        this.currentSpecialization = this.activeDegree.specializations?.[0]?.id || null;
        this.plan = {
          degree: degId,
          specialization: this.currentSpecialization,
          startTerm: this.startTerm,
          semestersCount: this.semestersCount,
          semesters: {}
        };
        for (let s = 1; s <= this.semestersCount; s++) {
          this.plan.semesters[s] = [];
        }
      }
    } catch (e) {
      this.semestersCount = 4;
      this.plan = { degree: degId, semestersCount: 4, semesters: { 1: [], 2: [], 3: [], 4: [] } };
    }

    // Ensure all semester keys exist
    for (let s = 1; s <= this.semestersCount; s++) {
      if (!this.plan.semesters[s]) {
        this.plan.semesters[s] = [];
      }
    }

    // Sync start term dropdown
    const termSelect = document.getElementById('startTermSelect');
    if (termSelect) termSelect.value = this.startTerm;
  }

  saveDegreeState() {
    if (!this.activeDegree) return;
    const degId = this.activeDegree.id;
    try {
      localStorage.setItem(`kit_plan_${degId}`, JSON.stringify(this.plan));
      localStorage.setItem(`kit_staged_${degId}`, JSON.stringify(this.stagedModules));
      localStorage.setItem(`kit_custom_${degId}`, JSON.stringify(this.customModules));
    } catch (e) {
      console.warn('Error saving state:', e);
    }
  }

  // --- SPECIALIZATION & CATEGORY UI ---

  renderSpecializationSelector() {
    const group = document.getElementById('specializationGroup');
    const select = document.getElementById('specializationSelect');
    if (!group || !select) return;

    const specs = this.activeDegree.specializations || [];
    if (specs.length === 0) {
      group.style.display = 'none';
      this.currentSpecialization = null;
      this.plan.specialization = null;
      return;
    }

    group.style.display = 'flex';
    select.innerHTML = '';

    specs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });

    if (this.currentSpecialization && specs.some(s => s.id === this.currentSpecialization)) {
      select.value = this.currentSpecialization;
    } else {
      this.currentSpecialization = specs[0].id;
      select.value = this.currentSpecialization;
      this.plan.specialization = this.currentSpecialization;
    }
  }

  renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;
    container.innerHTML = '';

    // 'All' pill
    const allBtn = document.createElement('button');
    allBtn.className = `filter-pill ${this.activeCategoryFilter === 'all' ? 'active' : ''}`;
    allBtn.textContent = 'All';
    allBtn.dataset.cat = 'all';
    container.appendChild(allBtn);

    // Degree category pills
    const cats = this.activeDegree.categories || [];
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `filter-pill ${this.activeCategoryFilter === cat.id ? 'active' : ''}`;
      btn.textContent = cat.name;
      btn.dataset.cat = cat.id;
      container.appendChild(btn);
    });

    // 'Staged' pill
    const stagedBtn = document.createElement('button');
    stagedBtn.className = `filter-pill ${this.activeCategoryFilter === 'staged' ? 'active' : ''}`;
    stagedBtn.id = 'pillStaged';
    stagedBtn.textContent = `📦 Staged (${this.stagedModules.length})`;
    stagedBtn.dataset.cat = 'staged';
    container.appendChild(stagedBtn);

    // 'Custom' pill
    if (this.customModules && this.customModules.length > 0) {
      const customBtn = document.createElement('button');
      customBtn.className = `filter-pill ${this.activeCategoryFilter === 'custom' ? 'active' : ''}`;
      customBtn.id = 'pillCustom';
      customBtn.textContent = `✏️ Custom (${this.customModules.length})`;
      customBtn.dataset.cat = 'custom';
      container.appendChild(customBtn);
    }
  }

  renderCategoryChips() {
    const container = document.getElementById('categoryChipsContainer');
    if (!container) return;
    container.innerHTML = '';

    const cats = this.activeDegree.categories || [];
    cats.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.id = `chip_${cat.id}`;
      chip.style.borderLeft = `3px solid ${cat.color || 'var(--kit-green)'}`;
      chip.innerHTML = `
        <span class="status-dot"></span>
        <span>${cat.name}: <strong id="val_${cat.id}">0/${cat.targetCredits} CP</strong></span>
      `;
      container.appendChild(chip);
    });
  }

  // --- DYNAMIC SEMESTERS (ADD / REMOVE) ---

  addSemester() {
    if (this.semestersCount >= 8) {
      alert('Maximum 8 semesters recommended.');
      return;
    }
    this.semestersCount++;
    this.plan.semestersCount = this.semestersCount;
    if (!this.plan.semesters[this.semestersCount]) {
      this.plan.semesters[this.semestersCount] = [];
    }
    this.saveDegreeState();
    this.renderPlanner();
    this.runValidation();
  }

  removeSemester() {
    if (this.semestersCount <= 2) {
      alert('A minimum of 2 semesters is required.');
      return;
    }

    const lastSem = this.semestersCount;
    const items = this.plan.semesters[lastSem] || [];
    if (items.length > 0) {
      if (!confirm(`Semester ${lastSem} contains ${items.length} scheduled course(s). Move them to the Staging Area before removing?`)) {
        return;
      }
      items.forEach(it => {
        if (!this.stagedModules.includes(it.id)) {
          this.stagedModules.push(it.id);
        }
      });
    }

    delete this.plan.semesters[lastSem];
    this.semestersCount--;
    this.plan.semestersCount = this.semestersCount;

    this.saveDegreeState();
    this.renderPlanner();
    this.renderStagingArea();
    this.runValidation();
  }

  // --- SEMESTER PLANNER BOARD ---

  renderPlanner() {
    this.renderStagingArea();
    const grid = document.getElementById('semestersGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const pacing = Math.round(120 / this.semestersCount);
    const pacingHint = document.getElementById('semesterPacingHint');
    if (pacingHint) {
      pacingHint.textContent = `Target pace: ~${pacing} CP / semester (${this.semestersCount} Semesters)`;
    }

    const conflicts = this.lastValidationResult?.errors || [];
    const warnings = this.lastValidationResult?.warnings || [];

    for (let sem = 1; sem <= this.semestersCount; sem++) {
      const term = (this.startTerm === 'WS')
        ? (sem % 2 === 1 ? 'WS' : 'SS')
        : (sem % 2 === 1 ? 'SS' : 'WS');

      const col = document.createElement('div');
      col.className = 'semester-col';
      col.dataset.semester = sem;

      col.innerHTML = `
        <div class="semester-header">
          <div class="semester-title-row">
            <span class="semester-title">Semester ${sem}</span>
            <span class="badge ${term === 'WS' ? 'badge-term-ws' : 'badge-term-ss'}">${term}</span>
          </div>
          <div class="semester-stats">
            <span class="semester-cp" id="sem${sem}CP">0 CP</span>
            <span style="font-size: 0.72rem; color: var(--kit-muted);">Target: ~${pacing} CP</span>
          </div>
        </div>
        <div class="semester-dropzone" id="dropzoneSem${sem}" data-semester="${sem}"></div>
      `;

      grid.appendChild(col);

      const dropzone = col.querySelector(`#dropzoneSem${sem}`);
      const items = this.plan.semesters[sem] || [];

      if (items.length === 0) {
        dropzone.innerHTML = `
          <div class="empty-placeholder">
            <p>Drag courses here</p>
            <span style="font-size: 0.7rem; color: var(--kit-muted); margin-top: 4px;">or click '+' in catalog</span>
          </div>
        `;
        continue;
      }

      // Sort pinned courses to top
      const sorted = [...items].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

      sorted.forEach(item => {
        const mod = this.getModule(item.id);
        if (!mod) return;

        const isPinned = !!item.isPinned;
        const cardError = conflicts.find(e => e.moduleId === mod.id || (e.modules && e.modules.includes(mod.id)));
        const cardWarn = warnings.find(w => w.moduleId === mod.id && w.semester === sem);

        let stateClass = '';
        if (cardError) stateClass = 'conflict-error';
        else if (cardWarn) stateClass = 'conflict-warning';
        if (isPinned) stateClass += ' is-pinned';

        const availableCats = this.getAvailableCategoriesForModule(mod);

        // If item has no category set or current category is not permitted, pick default
        if (!item.category || !availableCats.some(c => c.label === item.category)) {
          const defaultCat = this.getModuleCategoryInfo(mod);
          item.category = availableCats.some(c => c.label === defaultCat.label) ? defaultCat.label : availableCats[0].label;
        }

        const catInfo = this.getModuleCategoryInfo(mod, item.category);
        const catClassSuffix = catInfo.label.replace(/[^a-zA-Z0-9]/g, '-');

        const hasMultiple = availableCats.length > 1;
        const card = document.createElement('div');
        card.className = `scheduled-card ${stateClass} cat-${catClassSuffix}${hasMultiple ? ' has-multiple-categories' : ''}`;
        card.draggable = true;
        card.dataset.id = mod.id;
        card.dataset.semester = sem;

        let categoryBadgeHtml = '';
        if (hasMultiple) {
          categoryBadgeHtml = `
            <div class="cat-pill-wrapper has-multiple-categories ${catInfo.cssClass}" title="Eligible for ${availableCats.length} categories (${availableCats.map(c => c.label).join(', ')}). Click to switch!">
              <span class="multi-cat-dot"></span>
              <select class="badge-cat-select" data-module-id="${mod.id}" data-semester="${sem}">
                ${availableCats.map(c => `<option value="${c.label}" ${c.label === catInfo.label ? 'selected' : ''}>${c.label}</option>`).join('')}
              </select>
              <span class="cat-pill-arrow">▾</span>
            </div>
          `;
        } else {
          categoryBadgeHtml = `<span class="badge badge-cat ${catInfo.cssClass}" title="Category: ${catInfo.label}">${catInfo.label}</span>`;
        }

        card.innerHTML = `
          <div class="card-top">
            <span class="module-code">${mod.id}</span>
            ${mod.isCustom ? '<span class="badge badge-custom" style="font-size: 0.65rem; padding: 1px 6px;">Custom</span>' : ''}
            ${categoryBadgeHtml}
            ${isPinned ? '<span class="pin-badge">📌 Pinned</span>' : ''}
            <span class="badge badge-cp" style="margin-left:auto;">${mod.credits} CP</span>
          </div>
          <div class="module-title">${mod.title}</div>
          <div class="badge-row">
            <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
            <span class="badge badge-lang">${mod.language}</span>
          </div>
          <div class="card-actions">
            ${mod.isCustom ? `<button class="action-icon-btn btn-edit-plan" title="Edit custom course">✏️</button>` : ''}
            <button class="action-icon-btn btn-pin" title="${isPinned ? 'Unpin from semester' : 'Pin to semester'}">${isPinned ? '🔓' : '📌'}</button>
            <button class="action-icon-btn btn-stage" title="Move to Staging Area">📦</button>
            <button class="action-icon-btn btn-remove" title="Remove from plan">✕</button>
          </div>
        `;

        // Card clicks
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-actions') || e.target.closest('.cat-pill-wrapper')) return;
          this.showModuleModal(mod);
        });

        if (mod.isCustom) {
          card.querySelector('.btn-edit-plan')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditCustomModal(mod.id);
          });
        }

        // Category dropdown wrapper click & change
        const pillWrapper = card.querySelector('.cat-pill-wrapper');
        const catSelect = card.querySelector('.badge-cat-select');

        if (pillWrapper && catSelect) {
          pillWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target !== catSelect && typeof catSelect.showPicker === 'function') {
              try { catSelect.showPicker(); } catch (_) { catSelect.focus(); }
            }
          });
          catSelect.addEventListener('click', (e) => e.stopPropagation());
          catSelect.addEventListener('mousedown', (e) => e.stopPropagation());
          catSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            item.category = e.target.value;
            this.saveDegreeState();
            this.renderPlanner();
            this.runValidation();
          });
        }

        card.querySelector('.btn-pin').addEventListener('click', (e) => {
          e.stopPropagation();
          item.isPinned = !item.isPinned;
          this.saveDegreeState();
          this.renderPlanner();
          this.runValidation();
        });

        card.querySelector('.btn-stage').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeModuleFromPlan(mod.id);
          if (!this.stagedModules.includes(mod.id)) {
            this.stagedModules.push(mod.id);
          }
          this.saveDegreeState();
          this.renderPlanner();
          this.renderCatalog();
          this.runValidation();
        });

        card.querySelector('.btn-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeModuleFromPlan(mod.id);
          this.saveDegreeState();
          this.renderPlanner();
          this.renderCatalog();
          this.runValidation();
        });

        dropzone.appendChild(card);
      });
    }
  }

  // --- STAGING AREA ---

  renderStagingArea() {
    const list = document.getElementById('stagingCardsList');
    const badge = document.getElementById('stagedStatsBadge');
    const emptyPlaceholder = document.getElementById('stagingEmptyPlaceholder');
    if (!list) return;
    list.innerHTML = '';

    const validStaged = this.stagedModules.map(id => this.getModule(id)).filter(Boolean);
    const totalCP = validStaged.reduce((a, b) => a + (b.credits || 0), 0);

    if (badge) {
      badge.textContent = `${validStaged.length} courses • ${totalCP} CP`;
    }

    if (validStaged.length === 0) {
      if (emptyPlaceholder) emptyPlaceholder.style.display = 'flex';
      return;
    }
    if (emptyPlaceholder) emptyPlaceholder.style.display = 'none';

    validStaged.forEach(mod => {
      const card = document.createElement('div');
      card.className = 'staged-card';
      card.draggable = true;
      card.dataset.id = mod.id;

      const catInfo = this.getModuleCategoryInfo(mod);

      card.innerHTML = `
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--kit-muted);">${mod.id}</div>
        <div style="font-weight: 600; font-size: 0.82rem; margin: 2px 0 4px 0;">${mod.title}</div>
        <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
          ${mod.isCustom ? '<span class="badge badge-custom" style="font-size: 0.65rem; padding: 1px 6px;">Custom</span>' : ''}
          <span class="badge badge-cat ${catInfo.cssClass}">${catInfo.label}</span>
          <span class="badge badge-cp">${mod.credits} CP</span>
          <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
          ${mod.isCustom ? '<button class="action-icon-btn btn-edit-staged" title="Edit custom course" style="margin-left:auto;">✏️</button>' : ''}
          <button class="action-icon-btn btn-unstage" style="${mod.isCustom ? '' : 'margin-left:auto;'}" title="Remove from staging">✕</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-unstage') || e.target.closest('.btn-edit-staged')) return;
        this.showModuleModal(mod);
      });

      if (mod.isCustom) {
        card.querySelector('.btn-edit-staged')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditCustomModal(mod.id);
        });
      }

      card.querySelector('.btn-unstage').addEventListener('click', (e) => {
        e.stopPropagation();
        this.unstageModule(mod.id);
      });

      list.appendChild(card);
    });

    const pill = document.getElementById('pillStaged');
    if (pill) pill.textContent = `📦 Staged (${this.stagedModules.length})`;
  }

  pulseStagingBadge() {
    const badge = document.getElementById('stagedStatsBadge');
    if (badge) {
      badge.classList.remove('badge-pulse');
      void badge.offsetWidth;
      badge.classList.add('badge-pulse');
    }
  }

  unstageModule(moduleId) {
    const idx = this.stagedModules.indexOf(moduleId);
    if (idx !== -1) {
      this.stagedModules.splice(idx, 1);
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
      this.pulseStagingBadge();
    }
  }

  stageModule(moduleId) {
    if (!this.stagedModules.includes(moduleId)) {
      this.stagedModules.push(moduleId);
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
      this.pulseStagingBadge();
    }
  }

  // --- CATALOG LIST ---

  getCategoryCssClass(catIdOrName) {
    if (!catIdOrName) return 'cat-electives';
    const c = String(catIdOrName).toLowerCase();
    if (c.includes('thesis') || c.includes('masterarbeit') || c.includes('abschlussarbeit')) return 'cat-thesis';
    if (c.includes('uq') || c.includes('interdisciplinary') || c.includes('überfachliche')) return 'cat-uq';
    if (c.includes('fundamental') || c.includes('stamm') || c.includes('pflicht') || c.includes('core') || c.includes('kern')) return 'cat-fundamentals';
    if (c.includes('focus') || c.includes('schwerpunkt') || c.includes('specialization')) return 'cat-focus';
    if (c.includes('lab') || c.includes('praktikum')) return 'cat-lab';
    return 'cat-electives';
  }

  getModuleCategoryInfo(mod, selectedCategoryLabel = null) {
    if (selectedCategoryLabel) {
      return {
        label: selectedCategoryLabel,
        cssClass: this.getCategoryCssClass(selectedCategoryLabel)
      };
    }
    if (!mod) return { label: 'Electives', cssClass: 'cat-electives' };
    if (mod.isThesis) return { label: "Master's Thesis", cssClass: 'cat-thesis' };
    if (mod.isCustom && mod.categories && mod.categories.length > 0) {
      const cat = mod.categories[0];
      return { label: cat, cssClass: this.getCategoryCssClass(cat) };
    }
    const cats = mod.categories || [];
    if (cats.includes("Master's Thesis")) return { label: "Master's Thesis", cssClass: 'cat-thesis' };
    if (cats.includes("Interdisciplinary Qualifications") || mod.title?.toLowerCase().includes("interdisciplinary") || mod.id === 'M-ETIT-105803') {
      return { label: "Interdisciplinary (ÜQ)", cssClass: 'cat-uq' };
    }

    const activeSpecId = this.currentSpecialization;
    const specObj = this.activeDegree?.specializations?.find(s => s.id === activeSpecId);

    if (specObj) {
      if (specObj.fundamentals && specObj.fundamentals.includes(mod.id)) {
        return { label: "Fundamentals", cssClass: 'cat-fundamentals' };
      }
      if (specObj.labs && specObj.labs.includes(mod.id)) {
        return { label: "Lab Course", cssClass: 'cat-lab' };
      }
      if (specObj.focus && specObj.focus.includes(mod.id)) {
        return { label: "Focus Area", cssClass: 'cat-focus' };
      }
      return { label: "Electives", cssClass: 'cat-electives' };
    }

    // Fallback for degrees without explicit specializations (e.g. CS, Physics, etc.)
    if (cats.includes("Fundamentals") || cats.includes("Core Subjects")) {
      return { label: "Fundamentals", cssClass: 'cat-fundamentals' };
    }
    if (cats.includes("Focus Area")) return { label: "Focus Area", cssClass: 'cat-focus' };
    if (mod.isLab || cats.includes("Lab Course")) return { label: "Lab Course", cssClass: 'cat-lab' };
    return { label: "Electives", cssClass: 'cat-electives' };
  }

  getAvailableCategoriesForModule(mod) {
    if (!mod) return [{ id: 'electives', label: 'Electives', cssClass: 'cat-electives' }];
    if (mod.isThesis || (mod.credits >= 24 && (mod.title?.toLowerCase().includes('thesis') || mod.title?.toLowerCase().includes('masterarbeit')))) {
      return [{ id: 'thesis', label: "Master's Thesis", cssClass: 'cat-thesis' }];
    }
    if (mod.id === 'M-ETIT-105803' || mod.categories?.includes("Interdisciplinary Qualifications") || mod.title?.toLowerCase().includes("interdisciplinary")) {
      return [{ id: 'uq', label: "Interdisciplinary (ÜQ)", cssClass: 'cat-uq' }];
    }
    if (mod.isCustom) {
      const available = (mod.categories || []).map(c => ({
        id: this.getCategoryCssClass(c),
        label: c,
        cssClass: this.getCategoryCssClass(c)
      }));
      if (!available.some(c => c.label.toLowerCase() === 'electives')) {
        available.push({ id: 'electives', label: 'Electives', cssClass: 'cat-electives' });
      }
      return available;
    }

    const available = [];
    const activeSpecId = this.currentSpecialization;
    const specObj = this.activeDegree?.specializations?.find(s => s.id === activeSpecId);

    if (specObj) {
      if (specObj.fundamentals && specObj.fundamentals.includes(mod.id)) {
        available.push({ id: 'fundamentals', label: "Fundamentals", cssClass: 'cat-fundamentals' });
      }
      if (specObj.focus && specObj.focus.includes(mod.id)) {
        available.push({ id: 'focus', label: "Focus Area", cssClass: 'cat-focus' });
      }
      if ((specObj.labs && specObj.labs.includes(mod.id)) || mod.isLab) {
        available.push({ id: 'lab', label: "Lab Course", cssClass: 'cat-lab' });
      }
      // Any technical / specialization module can count as Electives
      available.push({ id: 'electives', label: "Electives", cssClass: 'cat-electives' });
    } else {
      const degreeCats = this.activeDegree?.categories || [];
      const hasCore = degreeCats.some(c => c.id === 'core' || c.id === 'fundamentals');
      const hasFocus = degreeCats.some(c => c.id === 'focus');
      const hasLab = degreeCats.some(c => c.id === 'lab');

      const cats = mod.categories || [];
      if ((cats.includes("Fundamentals") || cats.includes("Core Subjects")) && hasCore) {
        const coreCat = degreeCats.find(c => c.id === 'core' || c.id === 'fundamentals');
        available.push({ id: coreCat.id, label: coreCat.name || "Fundamentals", cssClass: 'cat-fundamentals' });
      }
      if (cats.includes("Focus Area") && hasFocus) {
        available.push({ id: 'focus', label: "Focus Area", cssClass: 'cat-focus' });
      }
      if ((mod.isLab || cats.includes("Lab Course")) && hasLab) {
        available.push({ id: 'lab', label: "Lab Course", cssClass: 'cat-lab' });
      }
      available.push({ id: 'electives', label: "Electives", cssClass: 'cat-electives' });
    }

    // Deduplicate by label
    const seen = new Set();
    return available.filter(c => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });
  }

  renderCatalog() {
    const list = document.getElementById('catalogList');
    if (!list) return;
    list.innerHTML = '';

    const scheduledIds = this.getScheduledModuleIds();

    const filtered = this.modulesList.filter(mod => {
      // 1. Search filter
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const inId = mod.id.toLowerCase().includes(q);
        const inTitle = mod.title.toLowerCase().includes(q);
        const inCoord = (mod.coordinators || []).some(c => c.toLowerCase().includes(q));
        if (!inId && !inTitle && !inCoord) return false;
      }

      // 2. Category pill filter
      if (this.activeCategoryFilter === 'staged') {
        if (!this.stagedModules.includes(mod.id)) return false;
      } else if (this.activeCategoryFilter === 'custom') {
        if (!mod.isCustom) return false;
      } else if (this.activeCategoryFilter !== 'all') {
        const catFilter = this.activeCategoryFilter.toLowerCase();
        const catInfo = this.getModuleCategoryInfo(mod);
        const labelLower = catInfo.label.toLowerCase();

        if (catFilter === 'fundamentals') {
          if (!labelLower.includes('fundamental') && !labelLower.includes('core')) return false;
        } else if (catFilter === 'focus') {
          if (!labelLower.includes('focus')) return false;
        } else if (catFilter === 'lab') {
          if (!labelLower.includes('lab') && !mod.isLab) return false;
        } else if (catFilter === 'specialization') {
          if (labelLower !== 'fundamentals' && labelLower !== 'focus area' && labelLower !== 'lab course') return false;
        } else if (catFilter === 'thesis') {
          if (!labelLower.includes('thesis')) return false;
        } else if (catFilter === 'uq') {
          if (!labelLower.includes('interdisciplinary') && !labelLower.includes('üq')) return false;
        } else if (catFilter === 'electives') {
          if (labelLower !== 'electives') return false;
        } else {
          if (!labelLower.includes(catFilter)) return false;
        }
      }

      // 3. Term filter
      if (this.activeTermFilter !== 'all') {
        if (mod.term !== 'WS+SS' && mod.term !== 'Each term' && mod.term !== this.activeTermFilter) {
          return false;
        }
      }

      // 4. Language filter
      if (this.activeLangFilter !== 'all') {
        if (mod.language !== this.activeLangFilter && mod.language !== 'German/English') {
          return false;
        }
      }

      return true;
    });

    filtered.slice(0, 100).forEach(mod => {
      const isScheduled = scheduledIds.has(mod.id);
      const isStaged = this.stagedModules.includes(mod.id);
      const catInfo = this.getModuleCategoryInfo(mod);
      const activeSpec = this.currentSpecialization;
      const inActiveSpec = activeSpec && mod.applicableSpecializations && mod.applicableSpecializations.includes(activeSpec);

      const card = document.createElement('div');
      card.className = `catalog-card ${isScheduled ? 'already-scheduled' : ''}`;
      card.draggable = true;
      card.dataset.id = mod.id;

      card.innerHTML = `
        <div class="card-top">
          <span class="module-code">${mod.id}</span>
          ${mod.isCustom ? '<span class="badge badge-custom">Custom</span>' : ''}
          <span class="badge badge-cat ${catInfo.cssClass}">${catInfo.label}</span>
          <span class="badge badge-cp" style="margin-left: auto;">${mod.credits} CP</span>
        </div>
        <div class="module-title">${mod.title}</div>
        <div class="badge-row">
          <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
          <span class="badge badge-lang">${mod.language}</span>
          ${inActiveSpec ? `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:700;">★ ${activeSpec}</span>` : ''}
          ${isScheduled ? '<span class="badge" style="background:#dcfce7;color:#166534;">Enrolled</span>' : ''}
          ${isStaged ? '<span class="badge" style="background:#fef3c7;color:#92400e;">Staged</span>' : ''}
        </div>
        <div class="catalog-card-footer">
          <button class="btn btn-sm ${isStaged ? 'btn-primary' : 'btn-outline'} btn-card-stage">
            ${isStaged ? '✓ Staged' : '📦 Stage'}
          </button>
          <button class="btn btn-sm btn-outline btn-card-add" title="Add to first available semester slot">
            ➕ Add
          </button>
          ${mod.isCustom ? `
            <button class="btn btn-sm btn-outline btn-card-edit" title="Edit custom course">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-outline btn-card-delete" title="Delete custom course">
              🗑️
            </button>
          ` : ''}
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.catalog-card-footer')) return;
        this.showModuleModal(mod);
      });

      card.querySelector('.btn-card-stage').addEventListener('click', (e) => {
        e.stopPropagation();
        if (isStaged) {
          this.unstageModule(mod.id);
        } else {
          this.stageModule(mod.id);
        }
      });

      card.querySelector('.btn-card-add').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addModuleToFirstSlot(mod);
      });

      if (mod.isCustom) {
        card.querySelector('.btn-card-edit')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditCustomModal(mod.id);
        });
        card.querySelector('.btn-card-delete')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteCustomModule(mod.id);
        });
      }

      list.appendChild(card);
    });
  }

  addModuleToFirstSlot(mod) {
    const catInfo = this.getModuleCategoryInfo(mod);
    for (let sem = 1; sem <= this.semestersCount; sem++) {
      const items = this.plan.semesters[sem] || [];
      const cp = items.reduce((a, b) => a + (this.getModule(b.id)?.credits || 0), 0);
      if (cp + mod.credits <= 34) {
        items.push({ id: mod.id, category: catInfo.label });
        this.saveDegreeState();
        this.renderPlanner();
        this.renderCatalog();
        this.runValidation();
        return;
      }
    }
    // Default to semester 1
    this.plan.semesters[1].push({ id: mod.id, category: catInfo.label });
    this.saveDegreeState();
    this.renderPlanner();
    this.renderCatalog();
    this.runValidation();
  }

  removeModuleFromPlan(moduleId) {
    for (let sem = 1; sem <= this.semestersCount; sem++) {
      if (this.plan.semesters[sem]) {
        this.plan.semesters[sem] = this.plan.semesters[sem].filter(it => it.id !== moduleId);
      }
    }
  }

  getScheduledModuleIds() {
    const ids = new Set();
    for (let sem = 1; sem <= this.semestersCount; sem++) {
      const list = this.plan.semesters[sem] || [];
      list.forEach(it => ids.add(it.id));
    }
    return ids;
  }

  // --- VALIDATION EXECUTION & UI UPDATE ---

  runValidation() {
    if (!this.validator) return;
    const res = this.validator.validate(this.plan);
    this.lastValidationResult = res;

    // Total credits progress
    const totalCredits = res.totalCredits;
    const targetCredits = res.targetCredits;
    document.getElementById('totalCreditsLabel').textContent = `${totalCredits} / ${targetCredits} CP`;
    const pct = Math.min(100, Math.round((totalCredits / targetCredits) * 100));
    document.getElementById('overallProgressFill').style.width = `${pct}%`;

    // Category chips update
    for (const [catId, data] of Object.entries(res.categories)) {
      const valEl = document.getElementById(`val_${catId}`);
      const chipEl = document.getElementById(`chip_${catId}`);
      if (valEl) {
        valEl.textContent = `${data.current}/${data.target} CP`;
      }
      if (chipEl) {
        chipEl.style.borderColor = data.ok ? '#10b981' : 'transparent';
      }
    }

    // Status badge
    const badge = document.getElementById('overallStatusBadge');
    const icon = document.getElementById('statusIcon');
    const text = document.getElementById('statusText');

    if (res.isComplete) {
      badge.className = 'status-badge status-ok';
      icon.textContent = '✓';
      text.textContent = 'Study Plan 100% Permissible & Complete!';
    } else if (res.errors.length > 0) {
      badge.className = 'status-badge status-error';
      icon.textContent = '❌';
      text.textContent = `${res.errors.length} Conflict${res.errors.length > 1 ? 's' : ''} / Violations`;
    } else {
      badge.className = 'status-badge status-warning';
      icon.textContent = '⚠️';
      text.textContent = `Incomplete (${totalCredits}/${targetCredits} CP)`;
    }

    // Semester CP stats update
    const pacing = Math.round(targetCredits / this.semestersCount);
    for (let sem = 1; sem <= this.semestersCount; sem++) {
      const cpEl = document.getElementById(`sem${sem}CP`);
      if (cpEl) {
        const cp = res.semesterCP[sem] || 0;
        cpEl.textContent = `${cp} CP`;
        if (cp >= pacing - 4 && cp <= pacing + 4) {
          cpEl.className = 'semester-cp balanced';
        } else if (cp < pacing - 4) {
          cpEl.className = 'semester-cp underload';
        } else {
          cpEl.className = 'semester-cp overload';
        }
      }
    }

    this.updateAuditModal(res);
    this.updateAnalytics(res);
  }

  updateAuditModal(res) {
    const list = document.getElementById('auditList');
    if (!list) return;
    list.innerHTML = '';

    res.errors.forEach(err => {
      const item = document.createElement('div');
      item.className = 'audit-item error';
      item.innerHTML = `<span>❌</span><div><strong>Error:</strong> ${err.message}</div>`;
      list.appendChild(item);
    });

    res.warnings.forEach(warn => {
      const item = document.createElement('div');
      item.className = 'audit-item warning';
      item.innerHTML = `<span>⚠️</span><div><strong>Warning:</strong> ${warn.message}</div>`;
      list.appendChild(item);
    });

    res.passed.forEach(p => {
      const item = document.createElement('div');
      item.className = 'audit-item success';
      item.innerHTML = `<span>✓</span><div>${p}</div>`;
      list.appendChild(item);
    });
  }

  updateAnalytics(res) {
    const chart = document.getElementById('analyticsCPChart');
    if (!chart) return;
    chart.innerHTML = '';

    for (let sem = 1; sem <= this.semestersCount; sem++) {
      const cp = res.semesterCP[sem] || 0;
      const term = res.semesterTerms[sem] || 'WS';
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.innerHTML = `
        <span style="font-size: 0.75rem; width: 85px;">Semester ${sem} (${term}):</span>
        <div style="flex:1; height: 16px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
          <div style="width: ${Math.min(100, Math.round((cp / 35) * 100))}%; height: 100%; background: var(--kit-green);"></div>
        </div>
        <span style="font-size: 0.75rem; font-weight:700; width: 45px;">${cp} CP</span>
      `;
      chart.appendChild(row);
    }
  }

  // --- DRAG AND DROP ---

  setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[draggable="true"]');
      if (!card) return;
      e.dataTransfer.setData('text/plain', JSON.stringify({
        id: card.dataset.id,
        fromSemester: card.dataset.semester || null
      }));
      card.classList.add('dragging');
    });

    document.addEventListener('dragend', (e) => {
      const card = e.target.closest('[draggable="true"]');
      if (card) card.classList.remove('dragging');
    });

    document.addEventListener('dragover', (e) => {
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone, #stagingArea');
      if (dropzone) {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone, #stagingArea');
      if (dropzone) {
        dropzone.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone, #stagingArea');
      if (!dropzone) return;
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const modId = data.id;
        const fromSem = data.fromSemester ? parseInt(data.fromSemester) : null;
        const mod = this.getModule(modId);
        if (!mod) return;

        // Dropped into Staging Area
        if (dropzone.id === 'stagingDropzone' || dropzone.id === 'stagingArea' || dropzone.closest('#stagingArea')) {
          if (fromSem) {
            this.removeModuleFromPlan(modId);
          }
          if (!this.stagedModules.includes(modId)) {
            this.stagedModules.push(modId);
          }
          this.saveDegreeState();
          this.renderPlanner();
          this.renderStagingArea();
          this.renderCatalog();
          this.runValidation();
          this.pulseStagingBadge();
          return;
        }

        // Dropped into Semester Column
        const targetSem = parseInt(dropzone.dataset.semester);
        if (!targetSem) return;

        if (fromSem) {
          this.removeModuleFromPlan(modId);
        } else if (this.stagedModules.includes(modId)) {
          this.unstageModule(modId);
        }

        const catInfo = this.getModuleCategoryInfo(mod);
        this.plan.semesters[targetSem].push({
          id: mod.id,
          category: catInfo.label
        });

        this.saveDegreeState();
        this.renderPlanner();
        this.renderCatalog();
        this.runValidation();
      } catch (err) {
        console.warn('Drop error:', err);
      }
    });
  }

  // --- UPLOAD HANDBOOK WORKFLOW ---

  setupUploadModal() {
    const btnOpen = document.getElementById('btnUploadHandbook');
    const modal = document.getElementById('uploadModal');
    const btnClose = document.getElementById('uploadCloseBtn');
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('handbookFileInput');
    const progress = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const previewCard = document.getElementById('degreePreviewCard');
    const btnActivate = document.getElementById('btnActivateUploadedDegree');

    if (!btnOpen || !modal) return;

    btnOpen.addEventListener('click', () => {
      modal.classList.add('open');
      previewCard.style.display = 'none';
      progress.style.display = 'none';
      progressBar.style.width = '0%';
    });

    btnClose.addEventListener('click', () => modal.classList.remove('open'));

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        this.handleHandbookUpload(fileInput.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this.handleHandbookUpload(e.dataTransfer.files[0]);
      }
    });

    btnActivate.addEventListener('click', async () => {
      if (this.pendingUploadedDegreeId) {
        modal.classList.remove('open');
        await this.loadDegreesIndex();
        await this.switchDegree(this.pendingUploadedDegreeId);
      }
    });
  }

  async handleHandbookUpload(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid PDF file.');
      return;
    }

    const progress = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const previewCard = document.getElementById('degreePreviewCard');
    const previewTitle = document.getElementById('previewTitle');
    const previewMeta = document.getElementById('previewMeta');

    progress.style.display = 'block';
    progressBar.style.width = '30%';

    try {
      progressBar.style.width = '60%';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'X-Filename': file.name
        },
        body: file
      });

      progressBar.style.width = '90%';
      const data = await res.json();

      if (data.success) {
        progressBar.style.width = '100%';
        this.pendingUploadedDegreeId = data.id;

        previewTitle.textContent = `${data.degree.title} (SPO ${data.degree.spo})`;
        previewMeta.innerHTML = `
          <span class="degree-meta-badge">✓ ${data.moduleCount} Modules Parsed</span>
          <span class="degree-meta-badge">120 ECTS Target</span>
          <span class="degree-meta-badge">${data.degree.specializations?.length || 0} Tracks</span>
          <span class="degree-meta-badge">${data.degree.term || 'Master'}</span>
        `;
        previewCard.style.display = 'block';
      } else {
        alert(`Upload error: ${data.error || 'Failed to parse handbook'}`);
        progress.style.display = 'none';
      }
    } catch (err) {
      alert(`Server connection failed. Make sure 'python3 server.py' is running.`);
      progress.style.display = 'none';
    }
  }

  // --- GENERAL EVENT LISTENERS ---

  setupEventListeners() {
    // Degree switch
    document.getElementById('degreeSelect')?.addEventListener('change', (e) => {
      this.switchDegree(e.target.value);
    });

    // Specialization switch
    document.getElementById('specializationSelect')?.addEventListener('change', (e) => {
      this.currentSpecialization = e.target.value;
      this.plan.specialization = this.currentSpecialization;
      this.saveDegreeState();
      this.renderPlanner();
      this.renderCatalog();
      this.runValidation();
    });

    // Start Term switch
    document.getElementById('startTermSelect')?.addEventListener('change', (e) => {
      this.startTerm = e.target.value;
      this.plan.startTerm = this.startTerm;
      this.saveDegreeState();
      this.renderPlanner();
      this.runValidation();
    });

    // Add & Remove Semester
    document.getElementById('btnAddSemester')?.addEventListener('click', () => this.addSemester());
    document.getElementById('btnRemoveSemester')?.addEventListener('click', () => this.removeSemester());

    // Search catalog
    document.getElementById('catalogSearch')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderCatalog();
    });

    // Category pills filter
    document.getElementById('categoryPills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      document.querySelectorAll('#categoryPills .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.activeCategoryFilter = btn.dataset.cat;
      this.renderCatalog();
    });

    // Term filter
    document.getElementById('filterTerm')?.addEventListener('change', (e) => {
      this.activeTermFilter = e.target.value;
      this.renderCatalog();
    });

    // Language filter
    document.getElementById('filterLang')?.addEventListener('change', (e) => {
      this.activeLangFilter = e.target.value;
      this.renderCatalog();
    });

    // Auto-Plan button
    document.getElementById('btnAutoPlan')?.addEventListener('click', () => {
      if (!this.generator) return;
      const pinnedModules = {};
      for (let sem = 1; sem <= this.semestersCount; sem++) {
        const pinnedInSem = (this.plan?.semesters?.[sem] || []).filter(it => it.isPinned);
        if (pinnedInSem.length > 0) pinnedModules[sem] = pinnedInSem;
      }
      const res = this.generator.generatePlan({
        specializationId: this.currentSpecialization,
        startTerm: this.startTerm,
        semestersCount: this.semestersCount,
        pinnedModules: pinnedModules,
        fillMissingWithCatalog: true
      });
      this.plan = res.plan;
      this.saveDegreeState();
      this.renderPlanner();
      this.renderCatalog();
      this.runValidation();
    });

    // Auto-Plan Staged button
    document.getElementById('btnAutoPlanStaged')?.addEventListener('click', () => {
      if (!this.generator) return;
      const fillMissing = document.getElementById('chkFillMissing')?.checked;
      const pinnedModules = {};
      for (let sem = 1; sem <= this.semestersCount; sem++) {
        const pinnedInSem = (this.plan?.semesters?.[sem] || []).filter(it => it.isPinned);
        if (pinnedInSem.length > 0) pinnedModules[sem] = pinnedInSem;
      }
      const res = this.generator.generatePlan({
        specializationId: this.currentSpecialization,
        startTerm: this.startTerm,
        semestersCount: this.semestersCount,
        pinnedModules: pinnedModules,
        stagedModuleIds: this.stagedModules,
        fillMissingWithCatalog: fillMissing
      });
      this.plan = res.plan;
      this.saveDegreeState();
      this.renderPlanner();
      this.renderCatalog();
      this.runValidation();
    });

    // Reset button
    document.getElementById('btnReset')?.addEventListener('click', () => {
      if (confirm('Clear all scheduled modules from your study plan?')) {
        for (let sem = 1; sem <= this.semestersCount; sem++) {
          this.plan.semesters[sem] = [];
        }
        this.saveDegreeState();
        this.renderPlanner();
        this.renderCatalog();
        this.runValidation();
      }
    });

    // Clear Staging button
    document.getElementById('btnClearStaging')?.addEventListener('click', () => {
      this.stagedModules = [];
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
      this.pulseStagingBadge();
    });

    // Stage Current Plan button
    document.getElementById('btnStageCurrentPlan')?.addEventListener('click', () => {
      const scheduledIds = this.getScheduledModuleIds();
      scheduledIds.forEach(id => {
        if (!this.stagedModules.includes(id)) {
          this.stagedModules.push(id);
        }
      });
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
      this.pulseStagingBadge();
    });

    // Staging Area collapse/expand toggle
    const stagingArea = document.getElementById('stagingArea');
    const btnToggleStaging = document.getElementById('btnToggleStaging');
    const stagingTitleGroup = document.getElementById('stagingTitleGroup');

    const setStagingCollapsed = (collapsed) => {
      if (!stagingArea) return;
      if (collapsed) {
        stagingArea.classList.add('collapsed');
        btnToggleStaging?.setAttribute('title', 'Expand Staging Area [Alt+S]');
        btnToggleStaging?.setAttribute('aria-expanded', 'false');
      } else {
        stagingArea.classList.remove('collapsed');
        btnToggleStaging?.setAttribute('title', 'Collapse Staging Area [Alt+S]');
        btnToggleStaging?.setAttribute('aria-expanded', 'true');
      }
      localStorage.setItem('kit_staging_collapsed', collapsed ? 'true' : 'false');
    };

    const toggleStaging = () => {
      if (!stagingArea) return;
      const isCollapsed = stagingArea.classList.contains('collapsed');
      setStagingCollapsed(!isCollapsed);
    };

    btnToggleStaging?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStaging();
    });

    stagingTitleGroup?.addEventListener('click', () => {
      toggleStaging();
    });

    // Keyboard shortcut Alt+S to toggle Staging Area
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleStaging();
      }
    });

    // Restore saved staging collapsed state
    if (localStorage.getItem('kit_staging_collapsed') === 'true') {
      setStagingCollapsed(true);
    }

    // View toggle (Schedule vs Analytics)
    document.getElementById('tabScheduleView')?.addEventListener('click', () => {
      document.getElementById('scheduleViewContainer').style.display = 'block';
      document.getElementById('analyticsViewContainer').style.display = 'none';
      document.getElementById('tabScheduleView').className = 'btn btn-primary';
      document.getElementById('tabAnalyticsView').className = 'btn btn-outline';
    });

    document.getElementById('tabAnalyticsView')?.addEventListener('click', () => {
      document.getElementById('scheduleViewContainer').style.display = 'none';
      document.getElementById('analyticsViewContainer').style.display = 'block';
      document.getElementById('tabScheduleView').className = 'btn btn-outline';
      document.getElementById('tabAnalyticsView').className = 'btn btn-primary';
    });

    // Audit modal toggle
    document.getElementById('overallStatusBadge')?.addEventListener('click', () => {
      document.getElementById('auditModal').classList.add('open');
    });
    document.getElementById('auditCloseBtn')?.addEventListener('click', () => {
      document.getElementById('auditModal').classList.remove('open');
    });
    document.getElementById('auditCloseFooterBtn')?.addEventListener('click', () => {
      document.getElementById('auditModal').classList.remove('open');
    });

    // Ribbon collapse/expand toggle
    const header = document.querySelector('.app-header');
    const btnToggleRibbon = document.getElementById('btnToggleRibbon');
    const btnCollapseRibbon = document.getElementById('btnCollapseRibbon');
    const ribbonToggleIcon = document.getElementById('ribbonToggleIcon');
    const ribbonToggleText = document.getElementById('ribbonToggleText');

    const setRibbonCollapsed = (collapsed) => {
      if (!header) return;
      if (collapsed) {
        header.classList.add('collapsed');
        if (ribbonToggleIcon) ribbonToggleIcon.textContent = '▼';
        if (ribbonToggleText) ribbonToggleText.textContent = 'Show Ribbon';
        btnToggleRibbon?.setAttribute('title', 'Show top ribbon (Degree, Focus Area, Actions) [Alt+H]');
      } else {
        header.classList.remove('collapsed');
        if (ribbonToggleIcon) ribbonToggleIcon.textContent = '▲';
        if (ribbonToggleText) ribbonToggleText.textContent = 'Hide Ribbon';
        btnToggleRibbon?.setAttribute('title', 'Hide top ribbon to maximize workspace [Alt+H]');
      }
      localStorage.setItem('kit_ribbon_collapsed', collapsed ? 'true' : 'false');
    };

    const toggleRibbon = () => {
      if (!header) return;
      const isCollapsed = header.classList.contains('collapsed');
      setRibbonCollapsed(!isCollapsed);
    };

    btnToggleRibbon?.addEventListener('click', toggleRibbon);
    btnCollapseRibbon?.addEventListener('click', toggleRibbon);

    // Keyboard shortcut Alt+H to toggle ribbon
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        toggleRibbon();
      }
    });

    // Restore saved ribbon state
    if (localStorage.getItem('kit_ribbon_collapsed') === 'true') {
      setRibbonCollapsed(true);
    }

    // Backdrop click-to-close for all modal overlays (including moduleModal)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    // Keyboard shortcut Escape to close open modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(modal => {
          modal.classList.remove('open');
        });
      }
    });

    // Module modal close buttons
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
      document.getElementById('moduleModal').classList.remove('open');
    });
    document.getElementById('modalCloseFooterBtn')?.addEventListener('click', () => {
      document.getElementById('moduleModal').classList.remove('open');
    });

    // Custom course modal
    document.getElementById('btnOpenCustomModal')?.addEventListener('click', () => {
      this.openAddCustomModal();
    });
    document.getElementById('customCloseBtn')?.addEventListener('click', () => {
      document.getElementById('customModal').classList.remove('open');
    });
    document.getElementById('customCancelBtn')?.addEventListener('click', () => {
      document.getElementById('customModal').classList.remove('open');
    });
    document.getElementById('customCourseForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('customEditId')?.value?.trim();
      const title = document.getElementById('customTitle').value.trim();
      const credits = parseInt(document.getElementById('customCredits').value, 10) || 3;
      const category = document.getElementById('customCategory').value;
      const term = document.getElementById('customTerm').value;
      const lang = document.getElementById('customLang').value;

      if (editId) {
        // Edit existing custom module
        const mod = this.modulesMap.get(editId) || this.customModules.find(m => m.id === editId);
        if (mod) {
          mod.title = title;
          mod.credits = credits;
          mod.term = term;
          mod.termString = term;
          mod.language = lang;
          mod.categories = [category];

          // Also update category on scheduled instance in plan if present
          for (let sem = 1; sem <= this.semestersCount; sem++) {
            const scheduled = (this.plan?.semesters?.[sem] || []).find(it => it.id === editId);
            if (scheduled) {
              scheduled.category = category;
            }
          }

          this.saveDegreeState();
          document.getElementById('customModal').classList.remove('open');

          if (this.inspectedModule?.id === editId) {
            this.showModuleModal(mod);
          }

          this.renderCategoryPills();
          this.renderCatalog();
          this.renderStagingArea();
          this.renderPlanner();
          this.runValidation();
        }
      } else {
        // Create new custom module
        const customId = `CUSTOM-${Date.now().toString().slice(-6)}`;
        const customMod = {
          id: customId,
          title: title,
          credits: credits,
          term: term,
          termString: term,
          language: lang,
          categories: [category],
          applicableSpecializations: [],
          isCustom: true,
          coordinators: ['Self-Enrolled / HoC / SPZ'],
          prerequisites: 'None'
        };

        this.customModules.push(customMod);
        this.modulesList.push(customMod);
        this.modulesMap.set(customId, customMod);
        this.saveDegreeState();

        document.getElementById('customModal').classList.remove('open');
        document.getElementById('customCourseForm').reset();
        this.renderCategoryPills();
        this.renderCatalog();
        this.runValidation();
      }
    });

    // Export button
    document.getElementById('btnExport')?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.plan, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `study_plan_${this.activeDegree.id}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  formatHandbookText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText.trim();
    if (!text) return '';

    // 1. Clean PDF running headers/footers and page break artifacts
    text = text.replace(/---\s*PAGE\s*\d+\s*---/gi, '');
    text = text.replace(/\b(?:Module\s+Handbook|Modulhandbuch)\s+(?:as\s+of|mit\s+Stand\s+vom|Stand)\s+[\d\.\/]+(?:\s*\d+)?/gi, '');
    text = text.replace(/M\.Sc\.\s+.*?(?:\(Master of Science\)|Masterarbeit|Master's Thesis)/gi, '');
    text = text.replace(/\b\d+\s+MODULES\s+Module:\s+.*?(?=\n|$)/gi, '');
    text = text.replace(/\bM\s+\d+\.\d+\s+Module:.*?(?=\n|$)/gi, '');
    text = text.replace(/\b(?:Module Grade Calculation|Zusammensetzung der Modulnote)[\s\S]*$/gi, '');

    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return '';

    // PASS 1: Merge soft-wrapped continuation lines within sentences/items
    const normalizedLines = [];
    for (const line of rawLines) {
      const isBulletMarker = /^([•◦▪·*–—\-]|(\d+[\.\)]))\s*$/.test(line);
      const startsWithBullet = /^([•◦▪·*–—\-]\s+|\d+[\.\)]\s+|[◦▪]\s*)/.test(line);
      const isHeading = line.endsWith(':') || /^(Professional qualification goals|Interdisciplinary qualification goals|Learning objectives|Qualification goal|Fachliche Qualifikationsziele|Überfachliche Qualifikationsziele)\b/i.test(line);

      if (normalizedLines.length > 0) {
        const prev = normalizedLines[normalizedLines.length - 1];
        const prevIsMarker = /^([•◦▪·*–—\-]|(\d+[\.\)]))\s*$/.test(prev);
        const prevIsLeadin = prev.endsWith(':');
        const prevEndsClause = /[\.,;:!\?]$/.test(prev);

        let shouldMerge = false;
        if (!isBulletMarker && !startsWithBullet && !isHeading && !prevIsMarker && !prevIsLeadin) {
          if (prev.endsWith('-')) {
            normalizedLines[normalizedLines.length - 1] = prev.slice(0, -1) + line;
            continue;
          }
          if (!prevEndsClause) {
            if (/^[a-z0-9]/.test(line)) {
              const isNewAction = /^(get|understand|learn|analyze|apply|know|be able|can|design|describe|explain|reproduce|select|derive|demonstrate|können|haben|sind|verstehen|lernen|beschreiben|erkennen|wiedergeben|lösen)\b/i.test(line);
              if (!isNewAction) {
                shouldMerge = true;
              }
            } else if (!/^(The students|Students|Die Studierenden|Absolventen|In summary|After|By the end|[A-Z][a-z]+ [A-Z])\b/.test(line)) {
              shouldMerge = true;
            }
          }
        }

        if (shouldMerge) {
          normalizedLines[normalizedLines.length - 1] = prev + ' ' + line;
          continue;
        }
      }

      normalizedLines.push(line);
    }

    // PASS 2: Match stacked/isolated bullets with following items
    const lines = [];
    let i = 0;
    while (i < normalizedLines.length) {
      const line = normalizedLines[i];

      if (/^([•◦▪·*–—\-]|(\d+[\.\)]))\s*$/.test(line)) {
        const bulletCluster = [];
        while (i < normalizedLines.length && /^([•◦▪·*–—\-]|(\d+[\.\)]))\s*$/.test(normalizedLines[i])) {
          bulletCluster.push(normalizedLines[i]);
          i++;
        }

        // Check if line before bullets had a continuation right after bullets
        if (i < normalizedLines.length && lines.length > 0 && !/^([•◦▪·*–—\-]\s*|\d+[\.\)])/.test(normalizedLines[i])) {
          const candidate = normalizedLines[i];
          if (/^[a-z0-9,\.\)]/.test(candidate) && !/^(can|are|is|have|has|get|know|understand|learn|distinguish|können|haben|sind|verstehen|lernen)\b/i.test(candidate)) {
            lines[lines.length - 1] = lines[lines.length - 1] + ' ' + candidate;
            i++;
          }
        }

        for (const b of bulletCluster) {
          if (i < normalizedLines.length) {
            const item = normalizedLines[i];
            if (/^([•◦▪·*–—\-]\s+|\d+[\.\)]\s+|[◦▪]\s*)/.test(item)) {
              lines.push(item);
            } else {
              let marker = b.endsWith('.') || b.endsWith(')') ? b : `${b} `;
              if (!marker.endsWith(' ')) marker += ' ';
              lines.push(`${marker}${item}`);
            }
            i++;
          }
        }
        continue;
      }

      lines.push(line);
      i++;
    }

    // Helper escape
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Format item content (e.g. bolding "Topic Name: details")
    const formatItemContent = (raw) => {
      const escaped = esc(raw);
      return escaped.replace(/^([^:\n]{3,45}):\s+/, '<strong>$1:</strong> ');
    };

    // PASS 3: Generate semantic HTML
    const htmlParts = [];
    let currentListType = null; // 'ul' | 'ol' | 'sub-ul'

    const closeList = () => {
      if (currentListType === 'ul' || currentListType === 'sub-ul') {
        htmlParts.push('</ul>');
      } else if (currentListType === 'ol') {
        htmlParts.push('</ol>');
      }
      currentListType = null;
    };

    for (const line of lines) {
      const subMatch = line.match(/^[◦▪o]\s*(.*)/);
      const bulletMatch = line.match(/^[•·*–—\-]\s*(.*)/);
      const numberedMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);

      if (subMatch) {
        if (currentListType !== 'sub-ul' && currentListType !== 'ul') {
          closeList();
          htmlParts.push('<ul class="handbook-list handbook-sublist">');
          currentListType = 'sub-ul';
        }
        htmlParts.push(`  <li class="handbook-subitem">${formatItemContent(subMatch[1])}</li>`);
      } else if (bulletMatch) {
        if (currentListType !== 'ul') {
          closeList();
          htmlParts.push('<ul class="handbook-list handbook-bullet-list">');
          currentListType = 'ul';
        }
        htmlParts.push(`  <li>${formatItemContent(bulletMatch[1])}</li>`);
      } else if (numberedMatch) {
        if (currentListType !== 'ol') {
          closeList();
          htmlParts.push('<ol class="handbook-list handbook-ordered-list">');
          currentListType = 'ol';
        }
        htmlParts.push(`  <li value="${numberedMatch[1]}">${formatItemContent(numberedMatch[2])}</li>`);
      } else {
        closeList();
        const isHeader = line.endsWith(':') || /^(Professional qualification goals|Interdisciplinary qualification goals|Learning objectives|Qualification goal|Fachliche Qualifikationsziele|Überfachliche Qualifikationsziele)\b/i.test(line);
        if (isHeader) {
          htmlParts.push(`<p class="handbook-lead-in">${esc(line)}</p>`);
        } else {
          htmlParts.push(`<p class="handbook-paragraph">${esc(line)}</p>`);
        }
      }
    }

    closeList();
    return htmlParts.join('\n');
  }

  showModuleModal(mod) {
    this.inspectedModule = mod;
    document.getElementById('modalModCode').textContent = mod.id;
    document.getElementById('modalModTitle').textContent = mod.title;

    // Check if module is currently scheduled in the study plan
    let scheduledItem = null;
    let scheduledSem = null;
    for (let s = 1; s <= this.semestersCount; s++) {
      const match = (this.plan.semesters[s] || []).find(it => it.id === mod.id);
      if (match) {
        scheduledItem = match;
        scheduledSem = s;
        break;
      }
    }

    const availableCats = this.getAvailableCategoriesForModule(mod);
    const activeCatLabel = scheduledItem?.category || this.getModuleCategoryInfo(mod).label;
    const catInfo = this.getModuleCategoryInfo(mod, activeCatLabel);

    const body = document.getElementById('modalModBody');
    body.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center;">
        ${mod.isCustom ? '<span class="badge badge-custom">Custom Module</span>' : ''}
        <span class="badge badge-cp">${mod.credits} CP</span>
        <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.termString || mod.term}</span>
        <span class="badge badge-lang">${mod.language}</span>
        <span class="badge" style="background:#e0e7ff;color:#3730a3;">Catalog: ${mod.categories?.join(', ') || 'Electives'}</span>
      </div>

      ${mod.isCustom ? `
        <div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.83rem; color: #86198f; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span>💡 <strong>Custom Module / External Credit:</strong> You can edit this course's title, ECTS credits, category, term, or delete it anytime.</span>
        </div>
      ` : ''}

      ${scheduledItem ? `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--kit-muted); text-transform: uppercase; letter-spacing: 0.05em;">Plan Assignment (Semester ${scheduledSem})</div>
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--kit-dark); margin-top: 2px;">Attributed Category for CP Tally:</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${availableCats.length > 1 ? `
              <div class="cat-pill-wrapper has-multiple-categories ${catInfo.cssClass}" style="padding: 2.5px 10px 2.5px 8px;">
                <span class="multi-cat-dot"></span>
                <select id="modalCatSelect" class="badge-cat-select" style="font-size: 0.75rem;">
                  ${availableCats.map(c => `<option value="${c.label}" ${c.label === activeCatLabel ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
                <span class="cat-pill-arrow">▾</span>
              </div>
            ` : `
              <span class="badge badge-cat ${catInfo.cssClass}">${catInfo.label}</span>
            `}
          </div>
        </div>
      ` : ''}

      <div class="meta-grid" style="margin-bottom: 14px;">
        <div class="meta-item">
          <span class="meta-label">Organisation / Institute</span>
          <span class="meta-value">${mod.organisation || 'KIT'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Coordinators</span>
          <span class="meta-value">${(mod.coordinators || []).join(', ') || 'Department Faculty'}</span>
        </div>
      </div>

      ${mod.prerequisites && mod.prerequisites !== 'None' ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>⚠️</span> Prerequisites (Voraussetzungen)</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.prerequisites)}</div>
        </div>
      ` : ''}

      ${mod.competenceGoal ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>🎯</span> Competence Goals (Qualifikationsziele)</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.competenceGoal)}</div>
        </div>
      ` : ''}

      ${mod.content ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>📚</span> Course Content (Inhalt)</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.content)}</div>
        </div>
      ` : ''}

      ${mod.examType ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>📝</span> Assessment & Examination</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.examType)}</div>
        </div>
      ` : ''}

      ${mod.workload ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>⏱️</span> Workload</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.workload)}</div>
        </div>
      ` : ''}

      ${mod.recommendations ? `
        <div class="modal-detail-section">
          <h3 class="modal-section-title"><span>💡</span> Recommendations</h3>
          <div class="handbook-formatted-text">${this.formatHandbookText(mod.recommendations)}</div>
        </div>
      ` : ''}
    `;

    const modalCatSelect = document.getElementById('modalCatSelect');
    if (modalCatSelect && scheduledItem) {
      modalCatSelect.addEventListener('change', (e) => {
        scheduledItem.category = e.target.value;
        const newCatInfo = this.getModuleCategoryInfo(mod, scheduledItem.category);
        modalCatSelect.className = `badge badge-cat badge-cat-select ${newCatInfo.cssClass}`;
        this.saveDegreeState();
        this.renderPlanner();
        this.runValidation();
      });
    }

    // Custom course actions in modal footer
    const editBtn = document.getElementById('modalEditCustomBtn');
    const deleteBtn = document.getElementById('modalDeleteCustomBtn');
    if (editBtn && deleteBtn) {
      if (mod.isCustom) {
        editBtn.style.display = 'inline-flex';
        deleteBtn.style.display = 'inline-flex';
        editBtn.onclick = () => {
          this.openEditCustomModal(mod.id);
        };
        deleteBtn.onclick = () => {
          this.deleteCustomModule(mod.id);
        };
      } else {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
      }
    }

    const stageBtn = document.getElementById('modalStageBtn');
    const isStaged = this.stagedModules.includes(mod.id);
    stageBtn.textContent = isStaged ? '✓ Staged' : '📦 Stage Course';
    stageBtn.onclick = () => {
      if (this.stagedModules.includes(mod.id)) {
        this.unstageModule(mod.id);
        stageBtn.textContent = '📦 Stage Course';
      } else {
        this.stageModule(mod.id);
        stageBtn.textContent = '✓ Staged';
      }
    };

    document.getElementById('moduleModal').classList.add('open');
  }

  // --- CUSTOM MODULES MANAGEMENT (ADD / EDIT / DELETE) ---

  populateCustomCategories(selectedCategory = null) {
    const select = document.getElementById('customCategory');
    if (!select) return;
    select.innerHTML = '';

    const cats = this.activeDegree?.categories || [];
    const options = [];

    // Always include Interdisciplinary (ÜQ)
    options.push({ value: 'Interdisciplinary (ÜQ)', label: 'Interdisciplinary (ÜQ / Soft Skills)' });

    // Include degree categories except thesis
    cats.forEach(c => {
      if (c.id === 'thesis' || c.id === 'uq') return;
      options.push({ value: c.name, label: c.name });
    });

    // Ensure Electives is present
    if (!options.some(o => o.value.toLowerCase().includes('elective'))) {
      options.push({ value: 'Electives', label: 'Electives' });
    }

    const seen = new Set();
    options.forEach(opt => {
      if (!seen.has(opt.value)) {
        seen.add(opt.value);
        const optEl = document.createElement('option');
        optEl.value = opt.value;
        optEl.textContent = opt.label;
        if (selectedCategory && (opt.value === selectedCategory || opt.label.toLowerCase().includes(selectedCategory.toLowerCase()))) {
          optEl.selected = true;
        }
        select.appendChild(optEl);
      }
    });

    if (selectedCategory && !seen.has(selectedCategory)) {
      const optEl = document.createElement('option');
      optEl.value = selectedCategory;
      optEl.textContent = selectedCategory;
      optEl.selected = true;
      select.appendChild(optEl);
    }
  }

  openAddCustomModal() {
    const modal = document.getElementById('customModal');
    if (!modal) return;
    const form = document.getElementById('customCourseForm');
    if (form) form.reset();

    const titleEl = document.getElementById('customModalTitle');
    if (titleEl) titleEl.textContent = 'Add Custom Course or External Credit';

    const submitBtn = document.getElementById('customSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Save & Add Course';

    const editIdInput = document.getElementById('customEditId');
    if (editIdInput) editIdInput.value = '';

    this.populateCustomCategories('Interdisciplinary (ÜQ)');
    modal.classList.add('open');
    setTimeout(() => document.getElementById('customTitle')?.focus(), 50);
  }

  openEditCustomModal(moduleId) {
    const mod = this.modulesMap?.get(moduleId) || this.customModules.find(m => m.id === moduleId);
    if (!mod) return;

    const modal = document.getElementById('customModal');
    if (!modal) return;

    const titleEl = document.getElementById('customModalTitle');
    if (titleEl) titleEl.textContent = `Edit Custom Course: ${mod.title}`;

    const submitBtn = document.getElementById('customSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    const editIdInput = document.getElementById('customEditId');
    if (editIdInput) editIdInput.value = mod.id;

    const titleInput = document.getElementById('customTitle');
    if (titleInput) titleInput.value = mod.title || '';

    const creditsInput = document.getElementById('customCredits');
    if (creditsInput) creditsInput.value = mod.credits || 3;

    const catValue = mod.categories?.[0] || 'Interdisciplinary (ÜQ)';
    this.populateCustomCategories(catValue);

    const termSelect = document.getElementById('customTerm');
    if (termSelect) termSelect.value = mod.term || 'WS+SS';

    const langSelect = document.getElementById('customLang');
    if (langSelect) langSelect.value = mod.language || 'German';

    modal.classList.add('open');
    setTimeout(() => document.getElementById('customTitle')?.focus(), 50);
  }

  deleteCustomModule(moduleId) {
    const mod = this.modulesMap?.get(moduleId) || this.customModules.find(m => m.id === moduleId);
    if (!mod || !mod.isCustom) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete custom module "${mod.title}" (${mod.id})?\n\nThis will remove it from your course catalog, staging area, and semester plan.`
    );
    if (!confirmed) return;

    // 1. Remove from customModules
    this.customModules = this.customModules.filter(m => m.id !== moduleId);

    // 2. Remove from modulesList & modulesMap
    this.modulesList = this.modulesList.filter(m => m.id !== moduleId);
    this.modulesMap.delete(moduleId);

    // 3. Remove from staging area
    this.stagedModules = this.stagedModules.filter(id => id !== moduleId);

    // 4. Remove from semester plan
    this.removeModuleFromPlan(moduleId);

    // 5. Persist state
    this.saveDegreeState();

    // 6. Close details modal if open for this module
    if (this.inspectedModule?.id === moduleId) {
      document.getElementById('moduleModal')?.classList.remove('open');
      this.inspectedModule = null;
    }

    // 7. Close custom modal if open
    document.getElementById('customModal')?.classList.remove('open');

    // 8. If custom filter was active and no custom modules remain, switch back to 'all'
    if (this.activeCategoryFilter === 'custom' && this.customModules.length === 0) {
      this.activeCategoryFilter = 'all';
    }

    // 9. Re-render UI
    this.renderCategoryPills();
    this.renderCatalog();
    this.renderStagingArea();
    this.renderPlanner();
    this.runValidation();
  }

  getModule(id) {
    return this.modulesMap.get(id);
  }

  getTermBadgeClass(term) {
    if (term === 'WS') return 'badge-term-ws';
    if (term === 'SS') return 'badge-term-ss';
    return 'badge-term-both';
  }
}

// Global browser & runtime registration
if (typeof window !== 'undefined') {
  window.UniversalStudyPlannerApp = UniversalStudyPlannerApp;
}
if (typeof globalThis !== 'undefined') {
  globalThis.UniversalStudyPlannerApp = UniversalStudyPlannerApp;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UniversalStudyPlannerApp };
}

// Bootstrap application on DOM ready
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniversalStudyPlannerApp();
    window.app.init();
  });
}
