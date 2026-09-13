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

        const card = document.createElement('div');
        card.className = `scheduled-card ${stateClass}`;
        card.draggable = true;
        card.dataset.id = mod.id;
        card.dataset.semester = sem;

        const catInfo = this.getModuleCategoryInfo(mod);

        card.innerHTML = `
          <div class="card-top">
            <span class="module-code">${mod.id}</span>
            <span class="badge badge-cat ${catInfo.cssClass}">${catInfo.label}</span>
            ${isPinned ? '<span class="pin-badge">📌 Pinned</span>' : ''}
            <span class="badge badge-cp" style="margin-left:auto;">${mod.credits} CP</span>
          </div>
          <div class="module-title">${mod.title}</div>
          <div class="badge-row">
            <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
            <span class="badge badge-lang">${mod.language}</span>
          </div>
          <div class="card-actions">
            <button class="action-icon-btn btn-pin" title="${isPinned ? 'Unpin from semester' : 'Pin to semester'}">${isPinned ? '🔓' : '📌'}</button>
            <button class="action-icon-btn btn-stage" title="Move to Staging Area">📦</button>
            <button class="action-icon-btn btn-remove" title="Remove from plan">✕</button>
          </div>
        `;

        // Card clicks
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-actions')) return;
          this.showModuleModal(mod);
        });

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
          <span class="badge badge-cat ${catInfo.cssClass}">${catInfo.label}</span>
          <span class="badge badge-cp">${mod.credits} CP</span>
          <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
          <button class="action-icon-btn btn-unstage" style="margin-left:auto;" title="Remove from staging">✕</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-unstage')) return;
        this.showModuleModal(mod);
      });

      card.querySelector('.btn-unstage').addEventListener('click', (e) => {
        e.stopPropagation();
        this.unstageModule(mod.id);
      });

      list.appendChild(card);
    });

    const pill = document.getElementById('pillStaged');
    if (pill) pill.textContent = `📦 Staged (${this.stagedModules.length})`;
  }

  unstageModule(moduleId) {
    const idx = this.stagedModules.indexOf(moduleId);
    if (idx !== -1) {
      this.stagedModules.splice(idx, 1);
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
    }
  }

  stageModule(moduleId) {
    if (!this.stagedModules.includes(moduleId)) {
      this.stagedModules.push(moduleId);
      this.saveDegreeState();
      this.renderStagingArea();
      this.renderCatalog();
    }
  }

  // --- CATALOG LIST ---

  getModuleCategoryInfo(mod) {
    if (!mod) return { label: 'Electives', cssClass: 'cat-electives' };
    if (mod.isThesis) return { label: "Master's Thesis", cssClass: 'cat-thesis' };
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
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone');
      if (dropzone) {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone');
      if (dropzone) {
        dropzone.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      const dropzone = e.target.closest('.semester-dropzone, #stagingDropzone');
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
        if (dropzone.id === 'stagingDropzone') {
          if (fromSem) {
            this.removeModuleFromPlan(modId);
          }
          if (!this.stagedModules.includes(modId)) {
            this.stagedModules.push(modId);
          }
          this.saveDegreeState();
          this.renderPlanner();
          this.renderCatalog();
          this.runValidation();
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
      const res = this.generator.generatePlan({
        specializationId: this.currentSpecialization,
        startTerm: this.startTerm,
        semestersCount: this.semestersCount,
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
      const res = this.generator.generatePlan({
        specializationId: this.currentSpecialization,
        startTerm: this.startTerm,
        semestersCount: this.semestersCount,
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
    });

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

    // Module modal close
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
      document.getElementById('moduleModal').classList.remove('open');
    });
    document.getElementById('modalCloseFooterBtn')?.addEventListener('click', () => {
      document.getElementById('moduleModal').classList.remove('open');
    });

    // Custom course modal
    document.getElementById('btnOpenCustomModal')?.addEventListener('click', () => {
      document.getElementById('customModal').classList.add('open');
    });
    document.getElementById('customCloseBtn')?.addEventListener('click', () => {
      document.getElementById('customModal').classList.remove('open');
    });
    document.getElementById('customCourseForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('customTitle').value.trim();
      const credits = parseInt(document.getElementById('customCredits').value) || 3;
      const category = document.getElementById('customCategory').value;
      const term = document.getElementById('customTerm').value;
      const lang = document.getElementById('customLang').value;

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
      this.renderCatalog();
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

  showModuleModal(mod) {
    this.inspectedModule = mod;
    document.getElementById('modalModCode').textContent = mod.id;
    document.getElementById('modalModTitle').textContent = mod.title;

    const body = document.getElementById('modalModBody');
    body.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        <span class="badge badge-cp">${mod.credits} CP</span>
        <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.termString || mod.term}</span>
        <span class="badge badge-lang">${mod.language}</span>
        <span class="badge" style="background:#e0e7ff;color:#3730a3;">${mod.categories?.join(', ') || 'Electives'}</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--kit-muted); margin-bottom: 10px;"><strong>Organisation / Institute:</strong> ${mod.organisation || 'KIT'}</p>
      <p style="font-size: 0.85rem; color: var(--kit-muted); margin-bottom: 10px;"><strong>Coordinators:</strong> ${(mod.coordinators || []).join(', ') || 'Department Faculty'}</p>
      ${mod.examType ? `<p style="font-size: 0.85rem; margin-bottom: 10px;"><strong>Assessment / Examination:</strong> ${mod.examType}</p>` : ''}
      ${mod.prerequisites && mod.prerequisites !== 'None' ? `<p style="font-size: 0.85rem; margin-bottom: 10px;"><strong>Prerequisites:</strong> ${mod.prerequisites}</p>` : ''}
      ${mod.competenceGoal ? `<div style="margin-top: 12px;"><strong>Competence Goals:</strong><p style="font-size: 0.82rem; line-height: 1.4; color: #334155; margin-top: 4px;">${mod.competenceGoal}</p></div>` : ''}
      ${mod.content ? `<div style="margin-top: 12px;"><strong>Course Content:</strong><p style="font-size: 0.82rem; line-height: 1.4; color: #334155; margin-top: 4px;">${mod.content}</p></div>` : ''}
    `;

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

  getModule(id) {
    return this.modulesMap.get(id);
  }

  getTermBadgeClass(term) {
    if (term === 'WS') return 'badge-term-ws';
    if (term === 'SS') return 'badge-term-ss';
    return 'badge-term-both';
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new UniversalStudyPlannerApp();
  window.app.init();
});
