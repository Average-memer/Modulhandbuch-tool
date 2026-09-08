// app.js - Main Application Controller for KIT M.Sc. ETIT Study Planner

class StudyPlannerApp {
  constructor() {
    if (typeof window !== 'undefined' && window.ALL_MODULES_DATA && Object.keys(window.ALL_MODULES_DATA).length > 0) {
      this.modulesList = Object.values(window.ALL_MODULES_DATA);
    } else {
      this.modulesList = (typeof MOCK_MODULES !== 'undefined') ? MOCK_MODULES : [];
    }
    this.modulesMap = new Map();
    this.modulesList.forEach(m => this.modulesMap.set(m.id, m));

    if (typeof window !== 'undefined' && window.ALL_SPECIALIZATIONS_DATA && window.ALL_SPECIALIZATIONS_DATA.length > 0) {
      this.specializations = window.ALL_SPECIALIZATIONS_DATA;
    } else {
      this.specializations = (typeof MOCK_SPECIALIZATIONS !== 'undefined') ? MOCK_SPECIALIZATIONS : [];
    }

    this.currentSpecialization = 'ARSE';
    this.startTerm = 'WS';
    this.activeCategoryFilter = 'all';
    this.activeTermFilter = 'all';
    this.activeLangFilter = 'all';
    this.searchQuery = '';

    this.plan = {
      specialization: this.currentSpecialization,
      startTerm: this.startTerm,
      semesters: { 1: [], 2: [], 3: [], 4: [] }
    };

    this.validator = new DegreeValidator(this.modulesMap, this.specializations);
    this.generator = new PlanGenerator(this.modulesList, this.specializations);

    this.inspectedModule = null;
    this.lastValidationResult = null;
    this.customModules = [];
    this.stagedModules = [];
    this.loadCustomModules();
    this.loadStagedModules();
  }

  loadStagedModules() {
    try {
      const raw = localStorage.getItem('kit_etit_staged_modules');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.stagedModules = parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading staged modules:', e);
      this.stagedModules = [];
    }
  }

  saveStagedModules() {
    try {
      localStorage.setItem('kit_etit_staged_modules', JSON.stringify(this.stagedModules));
    } catch (e) {
      console.warn('Error saving staged modules:', e);
    }
  }

  isStaged(moduleId) {
    return this.stagedModules.includes(moduleId);
  }

  stageModule(moduleId) {
    if (!this.stagedModules.includes(moduleId)) {
      this.stagedModules.push(moduleId);
      this.saveStagedModules();
      this.renderStagingArea();
      this.renderCatalog();
    }
  }

  unstageModule(moduleId) {
    const idx = this.stagedModules.indexOf(moduleId);
    if (idx !== -1) {
      this.stagedModules.splice(idx, 1);
      this.saveStagedModules();
      this.renderStagingArea();
      this.renderCatalog();
    }
  }

  toggleStageModule(moduleId) {
    if (this.isStaged(moduleId)) {
      this.unstageModule(moduleId);
    } else {
      this.stageModule(moduleId);
    }
  }

  toggleStageFromModal() {
    if (this.inspectedModule) {
      this.toggleStageModule(this.inspectedModule.id);
      this.updateModalStageButton(this.inspectedModule.id);
    }
  }

  updateModalStageButton(moduleId) {
    const btn = document.getElementById('modalStageBtn');
    if (!btn) return;
    const staged = this.isStaged(moduleId);
    btn.textContent = staged ? '✓ Staged' : '📦 Stage';
    if (staged) {
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    }
  }

  clearStaging() {
    if (this.stagedModules.length === 0) return;
    if (confirm('Clear all modules from the Staging Area?')) {
      this.stagedModules = [];
      this.saveStagedModules();
      this.renderStagingArea();
      this.renderCatalog();
    }
  }

  stageCurrentPlan() {
    const ids = this.getScheduledModuleIds();
    if (ids.size === 0) {
      alert('Your semester plan is currently empty. Add or generate modules first!');
      return;
    }
    let addedCount = 0;
    ids.forEach(id => {
      if (!this.stagedModules.includes(id)) {
        this.stagedModules.push(id);
        addedCount++;
      }
    });
    this.saveStagedModules();
    this.renderStagingArea();
    this.renderCatalog();
    this.showQuickNotice(`Added ${addedCount} module(s) from current plan into Staging Area.`);
  }

  autoStageFundamentals(options = {}) {
    const {
      specId = this.currentSpecialization,
      replaceOldSpec = null,
      silent = false
    } = options;

    const spec = this.validator?.getSpecialization(specId) || this.specializations.find(s => s.id === specId);
    if (!spec) return 0;

    const targetFundIds = [...(spec.fundamentalsList || [])];
    if (targetFundIds.length === 0) return 0;

    const targetSet = new Set(targetFundIds);

    // If changing field of specialisation, remove old specialisation fundamentals that are not in targetSet
    if (replaceOldSpec && replaceOldSpec !== specId) {
      const oldSpec = this.specializations.find(s => s.id === replaceOldSpec);
      if (oldSpec && oldSpec.fundamentalsList) {
        const oldFundSet = new Set(oldSpec.fundamentalsList);
        this.stagedModules = this.stagedModules.filter(id => !oldFundSet.has(id) || targetSet.has(id));
      }
    }

    // Add target fundamentals
    let addedCount = 0;
    targetFundIds.forEach(id => {
      if (!this.stagedModules.includes(id)) {
        this.stagedModules.push(id);
        addedCount++;
      }
    });

    this.saveStagedModules();
    this.renderStagingArea();
    this.renderCatalog();

    if (!silent) {
      if (addedCount > 0) {
        this.showQuickNotice(`Added ${addedCount} mandatory Fundamental module(s) for Field of Specialisation "${spec.name}" (${spec.id}) to Staging Area.`);
      } else {
        this.showQuickNotice(`Mandatory Fundamentals for Field of Specialisation "${spec.name}" (${spec.id}) are in Staging Area.`);
      }
    }

    return addedCount;
  }

  togglePinModule(moduleId, sem) {
    const list = this.plan.semesters[sem] || [];
    const item = list.find(it => it.id === moduleId);
    if (item) {
      item.isPinned = !item.isPinned;
      list.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      this.saveState();
      this.renderPlanner();
    }
  }

  removeModuleFromAnySemester(moduleId) {
    let removed = false;
    for (let sem = 1; sem <= 4; sem++) {
      const list = this.plan.semesters[sem] || [];
      const index = list.findIndex(item => item.id === moduleId);
      if (index !== -1) {
        list.splice(index, 1);
        removed = true;
      }
    }
    if (removed) {
      this.saveState();
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    }
  }

  showQuickNotice(msg) {
    const alertEl = document.getElementById('quickAuditAlert');
    if (!alertEl) return;
    alertEl.innerHTML = `<span style="background:var(--kit-green-light); color:var(--kit-green); padding:3px 8px; border-radius:4px; border:1px solid #99f6e4;">ℹ️ ${msg.replace(/\n/g, ' ')}</span>`;
    setTimeout(() => {
      if (alertEl.innerHTML.includes(msg.slice(0, 15))) {
        alertEl.innerHTML = '';
      }
    }, 6000);
  }

  loadCustomModules() {
    try {
      const raw = localStorage.getItem('kit_etit_custom_modules');
      if (raw) {
        this.customModules = JSON.parse(raw);
        if (Array.isArray(this.customModules)) {
          this.customModules.forEach(mod => {
            mod.isCustom = true;
            this.modulesMap.set(mod.id, mod);
            const idx = this.modulesList.findIndex(m => m.id === mod.id);
            if (idx !== -1) {
              this.modulesList[idx] = mod;
            } else {
              this.modulesList.unshift(mod);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error loading custom modules:', e);
    }
  }

  saveCustomModules() {
    try {
      localStorage.setItem('kit_etit_custom_modules', JSON.stringify(this.customModules));
    } catch (e) {
      console.warn('Error saving custom modules:', e);
    }
  }

  init() {
    this.loadStateFromStorage();
    this.loadCustomModules();
    this.loadStagedModules();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.updateFocusProfilesDropdown();
    this.renderCatalog();
    this.renderPlanner();
    this.runValidation();
  }

  // Load external parsed data if available
  async loadDataFromAPI() {
    try {
      const modRes = await fetch('/api/modules');
      if (modRes.ok) {
        const data = await modRes.json();
        const list = Array.isArray(data) ? data : Object.values(data);
        if (list.length > 0) {
          this.modulesList = list;
          this.modulesMap = new Map(this.modulesList.map(m => [m.id, m]));
        }
      }
      const specRes = await fetch('/api/specializations');
      if (specRes.ok) {
        const specData = await specRes.json();
        if (Array.isArray(specData) && specData.length > 0) {
          this.specializations = specData;
        }
      }
      this.validator = new DegreeValidator(this.modulesMap, this.specializations);
      this.generator = new PlanGenerator(this.modulesList, this.specializations);
      this.updateFocusProfilesDropdown();
      if (this.stagedModules.length === 0) {
        this.autoStageFundamentals({ silent: true });
      }
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    } catch (err) {
      console.log('Using local client dataset:', err);
    }
  }

  setSpecialization(newSpecId) {
    if (!newSpecId || newSpecId === this.currentSpecialization) return;
    const oldSpec = this.currentSpecialization;
    this.currentSpecialization = newSpecId;
    this.plan.specialization = this.currentSpecialization;

    // Sync header dropdown
    const specSelect = document.getElementById('specializationSelect');
    if (specSelect && specSelect.value !== newSpecId) {
      specSelect.value = newSpecId;
    }

    // Sync sidebar dropdown
    const focusSelect = document.getElementById('focusProfileSelect');
    if (focusSelect && focusSelect.value !== newSpecId) {
      focusSelect.value = newSpecId;
    }

    this.autoStageFundamentals({ specId: this.currentSpecialization, replaceOldSpec: oldSpec });
    this.saveState();
    this.renderCatalog();
    this.renderPlanner();
    this.runValidation();
  }

  setupEventListeners() {
    // Field of Specialisation Select (Header)
    const specSelect = document.getElementById('specializationSelect');
    if (specSelect) {
      specSelect.value = this.currentSpecialization;
      specSelect.addEventListener('change', (e) => {
        this.setSpecialization(e.target.value);
      });
    }

    // Start Term Select
    const termSelect = document.getElementById('startTermSelect');
    termSelect.value = this.startTerm;
    termSelect.addEventListener('change', (e) => {
      this.startTerm = e.target.value;
      this.plan.startTerm = this.startTerm;
      this.updateSemesterHeaders();
      this.saveState();
      this.renderPlanner();
      this.runValidation();
    });

    // Search input
    const searchInput = document.getElementById('catalogSearch');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderCatalog();
    });

    // Category pills
    const pills = document.querySelectorAll('#categoryPills .filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeCategoryFilter = pill.getAttribute('data-cat');
        this.renderCatalog();
      });
    });

    // Dropdown filters
    document.getElementById('filterTerm').addEventListener('change', (e) => {
      this.activeTermFilter = e.target.value;
      this.renderCatalog();
    });
    document.getElementById('filterLang').addEventListener('change', (e) => {
      this.activeLangFilter = e.target.value;
      this.renderCatalog();
    });

    // Field of Specialisation Select (Sidebar)
    const focusSelect = document.getElementById('focusProfileSelect');
    if (focusSelect) {
      focusSelect.value = this.currentSpecialization;
      focusSelect.addEventListener('change', (e) => {
        this.setSpecialization(e.target.value);
      });
    }

    // View tabs
    const tabSchedule = document.getElementById('tabScheduleView');
    const tabAnalytics = document.getElementById('tabAnalyticsView');
    const scheduleContainer = document.getElementById('scheduleViewContainer');
    const analyticsContainer = document.getElementById('analyticsViewContainer');

    if (tabSchedule && tabAnalytics) {
      tabSchedule.addEventListener('click', () => {
        tabSchedule.className = 'btn btn-primary';
        tabAnalytics.className = 'btn btn-outline';
        scheduleContainer.style.display = 'block';
        analyticsContainer.style.display = 'none';
      });

      tabAnalytics.addEventListener('click', () => {
        tabAnalytics.className = 'btn btn-primary';
        tabSchedule.className = 'btn btn-outline';
        scheduleContainer.style.display = 'none';
        analyticsContainer.style.display = 'flex';
        this.renderAnalytics();
      });
    }

    // Buttons
    document.getElementById('btnAutoPlan').addEventListener('click', () => this.handleAutoPlan());
    document.getElementById('btnExemplaryPlan').addEventListener('click', () => this.handleExemplaryPlan());
    document.getElementById('btnReset').addEventListener('click', () => this.handleResetPlan());
    document.getElementById('btnExport').addEventListener('click', () => this.handleExportPlan());
    document.getElementById('overallStatusBadge').addEventListener('click', () => this.showAuditModal());

    // Modal Close
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      document.getElementById('moduleModal').classList.remove('open');
    });
    document.getElementById('moduleModal').addEventListener('click', (e) => {
      if (e.target.id === 'moduleModal') {
        document.getElementById('moduleModal').classList.remove('open');
      }
    });

    // Export modal actions
    document.getElementById('btnCopyExportText').addEventListener('click', () => {
      const text = document.getElementById('exportText').value;
      navigator.clipboard.writeText(text).then(() => {
        alert('Plan copied to clipboard!');
      });
    });

    document.getElementById('btnDownloadJson').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.plan, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KIT_ETIT_StudyPlan_${this.currentSpecialization}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Custom module modal listeners
    const btnOpenCustom = document.getElementById('btnOpenCustomModal');
    const customModal = document.getElementById('customModuleModal');
    const customCloseBtn = document.getElementById('customModalCloseBtn');
    const btnCancelCustom = document.getElementById('btnCancelCustom');
    const customForm = document.getElementById('customModuleForm');

    if (btnOpenCustom && customModal) {
      btnOpenCustom.addEventListener('click', () => {
        customModal.classList.add('open');
        document.getElementById('customTitle').focus();
      });
      if (customCloseBtn) customCloseBtn.addEventListener('click', () => customModal.classList.remove('open'));
      if (btnCancelCustom) btnCancelCustom.addEventListener('click', () => customModal.classList.remove('open'));
      customModal.addEventListener('click', (e) => {
        if (e.target.id === 'customModuleModal') customModal.classList.remove('open');
      });

      if (customForm) {
        customForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSaveCustomModule();
        });
      }
    }

    // Staging Area controls
    const btnToggleStaging = document.getElementById('btnToggleStaging');
    const stagingArea = document.getElementById('stagingArea');
    const stagingToggleIcon = document.getElementById('stagingToggleIcon');
    if (btnToggleStaging && stagingArea) {
      btnToggleStaging.addEventListener('click', () => {
        stagingArea.classList.toggle('collapsed');
        if (stagingToggleIcon) {
          stagingToggleIcon.textContent = stagingArea.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    }

    const btnClearStaging = document.getElementById('btnClearStaging');
    if (btnClearStaging) {
      btnClearStaging.addEventListener('click', () => this.clearStaging());
    }

    const btnStageFundamentals = document.getElementById('btnStageFundamentals');
    if (btnStageFundamentals) {
      btnStageFundamentals.addEventListener('click', () => this.autoStageFundamentals({ silent: false }));
    }

    const btnStageCurrent = document.getElementById('btnStageCurrentPlan');
    if (btnStageCurrent) {
      btnStageCurrent.addEventListener('click', () => this.stageCurrentPlan());
    }

    const btnAutoPlanStaged = document.getElementById('btnAutoPlanStaged');
    if (btnAutoPlanStaged) {
      btnAutoPlanStaged.addEventListener('click', () => this.handleAutoPlan());
    }

    this.updateSemesterHeaders();
  }

  updateSemesterHeaders() {
    for (let sem = 1; sem <= 4; sem++) {
      const isWS = (this.startTerm === 'WS') ? (sem % 2 === 1) : (sem % 2 === 0);
      const badgeEl = document.getElementById(`sem${sem}TermBadge`);
      if (badgeEl) {
        badgeEl.textContent = isWS ? 'WS' : 'SS';
        badgeEl.className = isWS ? 'badge badge-term-ws' : 'badge badge-term-ss';
      }
    }
  }

  // --- Drag and Drop Implementation ---
  setupDragAndDrop() {
    // Setup dropzone for Staging Area
    const stagingArea = document.getElementById('stagingArea');
    const stagingDropzone = document.getElementById('stagingDropzone');
    if (stagingArea && stagingDropzone) {
      stagingArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        stagingArea.classList.add('drag-over');
      });

      stagingArea.addEventListener('dragleave', (e) => {
        if (!stagingArea.contains(e.relatedTarget)) {
          stagingArea.classList.remove('drag-over');
        }
      });

      stagingArea.addEventListener('drop', (e) => {
        e.preventDefault();
        stagingArea.classList.remove('drag-over');

        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;

        try {
          const payload = JSON.parse(rawData);
          const moduleId = payload.id;
          this.stageModule(moduleId);
          if (payload.fromSemester) {
            this.removeModule(moduleId, payload.fromSemester);
          }
        } catch (err) {
          console.error('Staging drop error:', err);
        }
      });
    }

    // Setup dropzones on each semester
    for (let sem = 1; sem <= 4; sem++) {
      const dropzone = document.getElementById(`dropzoneSem${sem}`);
      if (!dropzone) continue;

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const col = dropzone.closest('.semester-col');
        col?.classList.add('drag-over');
      });

      dropzone.addEventListener('dragleave', () => {
        const col = dropzone.closest('.semester-col');
        col?.classList.remove('drag-over');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        const col = dropzone.closest('.semester-col');
        col?.classList.remove('drag-over');

        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;

        try {
          const payload = JSON.parse(rawData);
          const moduleId = payload.id;
          const fromSem = payload.fromSemester;

          if (fromSem) {
            // Move between semesters
            this.moveModule(moduleId, fromSem, sem);
          } else {
            // Add from catalog or staging
            this.addModuleToSemester(moduleId, sem);
          }
        } catch (err) {
          console.error('Drop error:', err);
        }
      });
    }
  }

  // --- Catalog Rendering ---
  renderCatalog() {
    const listEl = document.getElementById('catalogList');
    if (!listEl) return;
    listEl.innerHTML = '';

    const scheduledIds = this.getScheduledModuleIds();

    // Update pill badge count in catalog header
    const pillStaged = document.getElementById('pillStaged');
    if (pillStaged) {
      pillStaged.textContent = `📦 Staged (${this.stagedModules.length})`;
    }

    const filtered = this.modulesList.filter(mod => {
      // Query filter
      if (this.searchQuery) {
        const titleMatch = mod.title.toLowerCase().includes(this.searchQuery);
        const codeMatch = mod.id.toLowerCase().includes(this.searchQuery);
        const coordMatch = (mod.coordinators || []).some(c => c.toLowerCase().includes(this.searchQuery));
        const contentMatch = (mod.content || '').toLowerCase().includes(this.searchQuery);
        if (!titleMatch && !codeMatch && !coordMatch && !contentMatch) return false;
      }

      // Specialization compatibility:
      if (mod.applicableSpecializations && mod.applicableSpecializations.length > 0) {
        if (!mod.applicableSpecializations.includes(this.currentSpecialization)) {
          if (!mod.categories.includes('Electives') && !mod.categories.includes('Interdisciplinary Qualifications')) {
            return false;
          }
        }
      }

      // Category filter
      if (this.activeCategoryFilter === 'staged') {
        if (!this.isStaged(mod.id)) return false;
      } else if (this.activeCategoryFilter !== 'all') {
        const spec = this.validator.getSpecialization(this.currentSpecialization);
        const isSpecFund = spec?.fundamentalsList?.includes(mod.id);

        if (this.activeCategoryFilter === 'Fundamentals') {
          if (!isSpecFund) return false;
        } else if (this.activeCategoryFilter === 'Lab Course') {
          if (!mod.isLab) return false;
        } else if (!mod.categories || !mod.categories.includes(this.activeCategoryFilter)) {
          return false;
        }
      }

      // Term filter
      if (this.activeTermFilter !== 'all') {
        if (mod.term !== 'WS+SS' && mod.term !== 'Each term' && mod.term !== this.activeTermFilter) {
          return false;
        }
      }

      // Language filter
      if (this.activeLangFilter !== 'all') {
        if (mod.language !== this.activeLangFilter && mod.language !== 'German/English') {
          return false;
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-placeholder" style="margin: 40px auto;">
          <p>No modules found matching filters.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(mod => {
      const isScheduled = scheduledIds.has(mod.id);
      const isStaged = this.isStaged(mod.id);
      const card = document.createElement('div');
      card.className = `module-card ${isScheduled ? 'is-scheduled' : ''}`;
      card.draggable = true;

      // Determine default category for this module
      const defaultCat = this.validator.inferCategory(mod, this.validator.getSpecialization(this.currentSpecialization));
      const catClass = this.getCategoryClass(defaultCat);

      card.innerHTML = `
        <div class="card-top">
          <span class="module-code">${mod.id}</span>
          <span class="badge badge-cp">${mod.credits} CP</span>
        </div>
        <div class="module-title">${mod.title}</div>
        <div class="badge-row">
          <span class="badge badge-cat ${catClass}">${defaultCat}</span>
          <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
          <span class="badge badge-lang">${mod.language}</span>
          ${mod.isCustom ? '<span class="badge badge-custom">✨ Custom</span>' : ''}
          ${mod.isLab ? '<span class="badge badge-cat cat-lab">🔬 Practical</span>' : ''}
        </div>
        <div class="card-actions">
          <button class="action-icon-btn info-btn" title="View details and handbook syllabus">👁️ Info</button>
          <button class="action-stage-btn ${isStaged ? 'is-staged' : ''}" title="${isStaged ? 'Remove from Staging' : 'Add to Staging Area'}">
            ${isStaged ? '✓ Staged' : '📦 Stage'}
          </button>
          ${mod.isCustom ? `<button class="action-icon-btn delete-custom-btn" title="Delete custom course" style="color:#ef4444;">🗑️</button>` : ''}
          <button class="action-add-btn ${isScheduled ? 'is-in-plan' : ''}" title="${isScheduled ? 'Click to remove from study plan' : 'Add to schedule'}">
            ${isScheduled ? '<span class="btn-text-normal">✓ In Plan</span><span class="btn-text-hover">✕ Remove</span>' : '+ Add'}
          </button>
        </div>
      `;

      // Drag start
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({ id: mod.id }));
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      // Info button
      card.querySelector('.info-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModuleModal(mod);
      });

      // Stage button
      card.querySelector('.action-stage-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleStageModule(mod.id);
      });

      // Delete custom button
      const delCustomBtn = card.querySelector('.delete-custom-btn');
      if (delCustomBtn) {
        delCustomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteCustomModule(mod.id);
        });
      }

      // Add / Remove button
      card.querySelector('.action-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (isScheduled) {
          this.removeModuleFromAnySemester(mod.id);
        } else {
          this.addModuleSmartly(mod.id);
        }
      });

      card.addEventListener('click', () => this.openModuleModal(mod));

      listEl.appendChild(card);
    });
  }

  // --- Staging Area Rendering ---
  renderStagingArea() {
    const statsBadge = document.getElementById('stagedStatsBadge');
    const placeholder = document.getElementById('stagingEmptyPlaceholder');
    const listEl = document.getElementById('stagingCardsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    const scheduledMap = new Map();
    for (let sem = 1; sem <= 4; sem++) {
      (this.plan.semesters[sem] || []).forEach(it => scheduledMap.set(it.id, sem));
    }

    let totalCP = 0;
    const validStaged = [];

    this.stagedModules.forEach(id => {
      const mod = this.getModule(id);
      if (mod) {
        validStaged.push(mod);
        totalCP += mod.credits || 0;
      }
    });

    if (statsBadge) {
      statsBadge.textContent = `${validStaged.length} module${validStaged.length === 1 ? '' : 's'} • ${totalCP} CP`;
    }

    const pillStaged = document.getElementById('pillStaged');
    if (pillStaged) {
      pillStaged.textContent = `📦 Staged (${validStaged.length})`;
    }

    if (validStaged.length === 0) {
      if (placeholder) placeholder.style.display = 'flex';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';

    validStaged.forEach(mod => {
      const semPlaced = scheduledMap.get(mod.id);
      const isPlaced = semPlaced !== undefined;
      const defaultCat = this.validator.inferCategory(mod, this.validator.getSpecialization(this.currentSpecialization));
      const catClass = this.getCategoryClass(defaultCat);

      const card = document.createElement('div');
      card.className = `staged-card ${catClass}`;
      card.draggable = true;

      card.innerHTML = `
        <div class="staged-card-info">
          <div class="staged-card-title" title="${mod.title}">[${mod.id}] ${mod.title}</div>
          <div class="staged-card-meta">
            <span class="badge badge-cp" style="font-size:0.65rem; padding:1px 4px;">${mod.credits} CP</span>
            <span class="badge ${this.getTermBadgeClass(mod.term)}" style="font-size:0.65rem; padding:1px 4px;">${mod.term}</span>
            <span class="badge badge-cat ${catClass}" style="font-size:0.65rem; padding:1px 4px;">${defaultCat}</span>
            <span class="staged-sem-badge ${isPlaced ? 'is-placed' : 'is-unplaced'}">
              ${isPlaced ? `✓ Sem ${semPlaced}` : '○ Unassigned'}
            </span>
          </div>
        </div>
        <div class="staged-card-actions">
          <button class="action-icon-btn quick-add-btn" title="${isPlaced ? 'Move to another semester' : 'Add to plan'}">
            ${isPlaced ? '⚙️' : '+ Sem'}
          </button>
          <button class="action-icon-btn delete-staged-btn" title="Remove from staging" style="color:#ef4444;">✕</button>
        </div>
      `;

      // Dragstart
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('application/json', JSON.stringify({
          id: mod.id,
          fromStaging: true
        }));
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      // Click to inspect
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.openModuleModal(mod);
        }
      });

      // Quick add / move
      card.querySelector('.quick-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addModuleSmartly(mod.id);
      });

      // Delete from staging
      card.querySelector('.delete-staged-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.unstageModule(mod.id);
      });

      listEl.appendChild(card);
    });
  }

  // --- Planner Board Rendering ---
  renderPlanner() {
    this.renderStagingArea();
    const conflicts = this.lastValidationResult?.errors || [];
    const warnings = this.lastValidationResult?.warnings || [];

    for (let sem = 1; sem <= 4; sem++) {
      const dropzone = document.getElementById(`dropzoneSem${sem}`);
      if (!dropzone) continue;
      dropzone.innerHTML = '';

      const items = this.plan.semesters[sem] || [];
      if (items.length === 0) {
        dropzone.innerHTML = `
          <div class="empty-placeholder">
            <p>Drag modules here</p>
            <span style="font-size: 0.7rem; color: var(--kit-muted); margin-top: 4px;">or click '+' in catalog</span>
          </div>
        `;
        continue;
      }

      // Float pinned modules to the top of the semester
      const sortedItems = [...items].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

      sortedItems.forEach((item, index) => {
        const mod = this.getModule(item.id);
        if (!mod) return;

        // Check if this card has errors or warnings
        const cardError = conflicts.find(e => e.moduleId === mod.id || (e.modules && e.modules.includes(mod.id)));
        const cardWarn = warnings.find(w => w.moduleId === mod.id && w.semester === sem);
        const isPinned = !!item.isPinned;

        const card = document.createElement('div');
        const catClass = this.getCategoryClass(item.category || mod.categories?.[0] || 'Electives');
        let stateClass = '';
        if (cardError) stateClass = 'conflict-error';
        else if (cardWarn) stateClass = 'conflict-warning';
        if (isPinned) stateClass += ' is-pinned';

        card.className = `scheduled-card ${catClass} ${stateClass}`;
        card.draggable = true;

        card.innerHTML = `
          <div class="card-top">
            <span class="module-code">${mod.id}</span>
            ${isPinned ? '<span class="pin-badge" title="Locked in this semester (won\'t be moved by auto-planner)">📌 Pinned</span>' : ''}
            <span class="badge badge-cp" style="margin-left:auto;">${mod.credits} CP</span>
          </div>
          <div class="module-title">${mod.title}</div>
          <div class="badge-row">
            <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
            <span class="badge badge-lang">${mod.language}</span>
            ${cardWarn ? `<span class="badge" style="background:#fef08a; color:#854d0e;">⚠️ Term mismatch</span>` : ''}
          </div>
          ${cardError ? `<div class="card-conflict-notice">❌ ${cardError.message}</div>` : ''}
          <div class="scheduled-actions">
            <select class="category-select-mini" title="Change credited category">
              <option value="Fundamentals" ${item.category === 'Fundamentals' ? 'selected' : ''}>Fundamentals</option>
              <option value="Focus Area" ${item.category === 'Focus Area' ? 'selected' : ''}>Focus Area</option>
              <option value="Lab Course" ${item.category === 'Lab Course' ? 'selected' : ''}>Lab Course</option>
              <option value="Electives" ${item.category === 'Electives' ? 'selected' : ''}>Electives</option>
              <option value="Interdisciplinary Qualifications" ${item.category === 'Interdisciplinary Qualifications' ? 'selected' : ''}>ÜQ</option>
              <option value="Master's Thesis" ${item.category === "Master's Thesis" ? 'selected' : ''}>Thesis</option>
            </select>
            <button class="action-icon-btn pin-btn ${isPinned ? 'active' : ''}" title="${isPinned ? 'Unpin module (allow auto-planner to move)' : 'Pin module to this semester'}">📌</button>
            <button class="action-icon-btn move-left" title="Move to previous semester" ${sem === 1 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
            <button class="action-icon-btn move-right" title="Move to next semester" ${sem === 4 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
            <button class="action-icon-btn delete-btn" title="Remove from plan" style="color:#ef4444; margin-left:auto;">✕</button>
          </div>
        `;

        // Card dragstart for moving
        card.addEventListener('dragstart', (e) => {
          card.classList.add('dragging');
          e.dataTransfer.setData('application/json', JSON.stringify({
            id: mod.id,
            fromSemester: sem,
            isPinned: item.isPinned
          }));
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));

        // Pin toggle
        card.querySelector('.pin-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePinModule(mod.id, sem);
        });

        // Category change
        card.querySelector('.category-select-mini').addEventListener('change', (e) => {
          item.category = e.target.value;
          this.saveState();
          this.renderPlanner();
          this.runValidation();
        });

        // Move left
        card.querySelector('.move-left').addEventListener('click', (e) => {
          e.stopPropagation();
          if (sem > 1) this.moveModule(mod.id, sem, sem - 1);
        });

        // Move right
        card.querySelector('.move-right').addEventListener('click', (e) => {
          e.stopPropagation();
          if (sem < 4) this.moveModule(mod.id, sem, sem + 1);
        });

        // Delete
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeModule(mod.id, sem);
        });

        card.addEventListener('click', () => this.openModuleModal(mod));

        dropzone.appendChild(card);
      });
    }
  }

  // --- Validation Execution & UI Update ---
  runValidation() {
    const result = this.validator.validate(this.plan);
    this.lastValidationResult = result;

    // 1. Total credits
    const totalCredits = result.totalCredits;
    document.getElementById('totalCreditsLabel').textContent = `${totalCredits} / 120 CP`;
    const progressPct = Math.min(100, Math.round((totalCredits / 120) * 100));
    document.getElementById('overallProgressFill').style.width = `${progressPct}%`;

    // 2. Category counters
    const cats = result.categories;
    const updateChip = (valId, chipId, current, target, isCount = false) => {
      const el = document.getElementById(valId);
      const chip = document.getElementById(chipId);
      if (!el || !chip) return;
      el.textContent = isCount ? `${current}/${target}` : `${current}/${target} CP`;
      if (current >= target) {
        chip.style.borderColor = '#10b981';
      } else {
        chip.style.borderColor = 'transparent';
      }
    };

    updateChip('valFundamentals', 'chipFundamentals', cats.fundamentals.current, 24);
    updateChip('valFocus', 'chipFocus', cats.focusArea.current, 24);
    updateChip('valLab', 'chipLab', cats.specLab.current, 1, true);
    updateChip('valElectives', 'chipElectives', cats.electives.current, 24);
    updateChip('valUQ', 'chipUQ', cats.uq.current, 6);
    updateChip('valThesis', 'chipThesis', cats.thesis.current, 30);

    // 3. Overall status badge
    const badge = document.getElementById('overallStatusBadge');
    const icon = document.getElementById('statusIcon');
    const text = document.getElementById('statusText');

    if (result.isComplete) {
      badge.className = 'status-badge status-ok';
      icon.textContent = '✓';
      text.textContent = 'Degree Plan 100% Permissible & Complete!';
    } else if (result.errors.length > 0) {
      badge.className = 'status-badge status-error';
      icon.textContent = '❌';
      text.textContent = `${result.errors.length} Conflict${result.errors.length > 1 ? 's' : ''} / Violations`;
    } else {
      badge.className = 'status-badge status-warning';
      icon.textContent = '⚠️';
      text.textContent = `Incomplete (${totalCredits}/120 CP)`;
    }

    // 4. Semester CP badges
    for (let sem = 1; sem <= 4; sem++) {
      const cpEl = document.getElementById(`sem${sem}CP`);
      if (cpEl) {
        const cp = result.semesterCP[sem] || 0;
        cpEl.textContent = `${cp} CP`;
        if (sem === 4) {
          cpEl.className = 'semester-cp ' + (cp === 30 ? 'balanced' : (cp < 30 ? 'underload' : 'overload'));
        } else {
          cpEl.className = 'semester-cp ' + (cp >= 26 && cp <= 32 ? 'balanced' : (cp < 26 ? 'underload' : 'overload'));
        }
      }
    }

    // Update audit modal contents
    this.updateAuditModal(result);
  }

  updateAuditModal(result) {
    const listEl = document.getElementById('auditList');
    if (!listEl) return;
    listEl.innerHTML = '';

    // Errors
    result.errors.forEach(err => {
      const item = document.createElement('div');
      item.className = 'audit-item error';
      item.innerHTML = `<span>❌</span><div><strong>Error:</strong> ${err.message}</div>`;
      listEl.appendChild(item);
    });

    // Warnings
    result.warnings.forEach(warn => {
      const item = document.createElement('div');
      item.className = 'audit-item warning';
      item.innerHTML = `<span>⚠️</span><div><strong>Warning:</strong> ${warn.message}</div>`;
      listEl.appendChild(item);
    });

    // Passed rules
    result.passed.forEach(p => {
      const item = document.createElement('div');
      item.className = 'audit-item success';
      item.innerHTML = `<span>✓</span><div>${p}</div>`;
      listEl.appendChild(item);
    });
  }

  showAuditModal() {
    document.getElementById('auditModal').classList.add('open');
  }

  // --- Module Inspector Modal ---
  openModuleModal(mod) {
    this.inspectedModule = mod;
    this.updateModalStageButton(mod.id);
    document.getElementById('modalModuleCode').textContent = mod.id;
    document.getElementById('modalModuleTitle').textContent = mod.title;

    const badgesEl = document.getElementById('modalBadges');
    badgesEl.innerHTML = `
      <span class="badge badge-cp">${mod.credits} CP</span>
      <span class="badge ${this.getTermBadgeClass(mod.term)}">${mod.term}</span>
      <span class="badge badge-lang">${mod.language}</span>
      ${mod.isLab ? '<span class="badge badge-cat cat-lab">🔬 Practical / Lab</span>' : ''}
    `;

    document.getElementById('modalCredits').textContent = `${mod.credits} CP (${mod.credits * 30}h total workload)`;
    document.getElementById('modalTerm').textContent = mod.termString || mod.term;
    document.getElementById('modalLanguage').textContent = mod.language;
    document.getElementById('modalExam').textContent = mod.examType || 'See handbook description';
    document.getElementById('modalCoordinators').textContent = (mod.coordinators || []).join(', ') || 'N/A';
    document.getElementById('modalOrganisation').textContent = mod.organisation || 'KIT Department ETIT';

    document.getElementById('modalPrerequisites').textContent = mod.prerequisites || 'None';
    document.getElementById('modalCompetenceGoal').textContent = mod.competenceGoal || 'See module handbook.';
    document.getElementById('modalContent').textContent = mod.content || 'Detailed syllabus in handbook.';
    document.getElementById('modalWorkload').textContent = mod.workload || `${mod.credits * 30} hours workload.`;
    document.getElementById('modalLiterature').textContent = mod.literature || 'See course recommendations.';

    document.getElementById('moduleModal').classList.add('open');
  }

  addModuleToSemesterFromModal(sem) {
    if (this.inspectedModule) {
      this.addModuleToSemester(this.inspectedModule.id, sem);
      document.getElementById('moduleModal').classList.remove('open');
    }
  }

  // --- State Manipulation ---
  addModuleToSemester(moduleId, sem, category) {
    const mod = this.getModule(moduleId);
    if (!mod) return;

    // Check if already in plan
    if (this.getScheduledModuleIds().has(moduleId)) {
      alert(`"${mod.title}" is already in your study plan!`);
      return;
    }

    const defaultCat = category || this.validator.inferCategory(mod, this.validator.getSpecialization(this.currentSpecialization));
    this.plan.semesters[sem].push({
      id: moduleId,
      category: defaultCat
    });

    this.saveState();
    this.renderCatalog();
    this.renderPlanner();
    this.runValidation();
  }

  addModuleSmartly(moduleId) {
    const mod = this.getModule(moduleId);
    if (!mod) return;

    if (this.getScheduledModuleIds().has(moduleId)) {
      alert(`"${mod.title}" is already in your study plan!`);
      return;
    }

    // Determine target semester: find semester with lowest credits that matches term
    let bestSem = 1;
    let minCP = 999;

    for (let sem = 1; sem <= 3; sem++) { // usually semesters 1-3 for courses
      const isWS = (this.startTerm === 'WS') ? (sem % 2 === 1) : (sem % 2 === 0);
      const semTerm = isWS ? 'WS' : 'SS';
      const termMatches = (mod.term === 'WS+SS' || mod.term === 'Each term' || mod.term === semTerm);

      const curCP = (this.plan.semesters[sem] || []).reduce((sum, item) => sum + (this.getModule(item.id)?.credits || 0), 0);

      if (termMatches && curCP < minCP && curCP + mod.credits <= 34) {
        minCP = curCP;
        bestSem = sem;
      }
    }

    this.addModuleToSemester(moduleId, bestSem);
  }

  moveModule(moduleId, fromSem, toSem) {
    const list = this.plan.semesters[fromSem] || [];
    const index = list.findIndex(item => item.id === moduleId);
    if (index === -1) return;

    const [movedItem] = list.splice(index, 1);
    this.plan.semesters[toSem].push(movedItem);

    this.saveState();
    this.renderPlanner();
    this.runValidation();
  }

  removeModule(moduleId, sem) {
    const list = this.plan.semesters[sem] || [];
    const index = list.findIndex(item => item.id === moduleId);
    if (index !== -1) {
      list.splice(index, 1);
      this.saveState();
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    }
  }

  // --- Automation Buttons ---
  handleAutoPlan() {
    const fillMissing = document.getElementById('chkFillMissing')?.checked || false;

    // Collect pinned modules from current plan
    const pinnedModules = { 1: [], 2: [], 3: [], 4: [] };
    for (let sem = 1; sem <= 4; sem++) {
      const list = this.plan.semesters[sem] || [];
      pinnedModules[sem] = list.filter(item => item.isPinned);
    }

    const gen = this.generator.generatePlan({
      specializationId: this.currentSpecialization,
      startTerm: this.startTerm,
      focusProfile: this.selectedFocusProfile,
      stagedModuleIds: this.stagedModules,
      pinnedModules: pinnedModules,
      fillMissingWithCatalog: fillMissing
    });

    this.plan = gen;
    this.saveState();
    this.renderCatalog();
    this.renderPlanner();
    this.runValidation();

    if (gen.report) {
      const r = gen.report;
      const parts = [];
      if (r.pinnedCount > 0) parts.push(`${r.pinnedCount} pinned module(s) preserved`);
      if (r.stagedPlacedCount > 0) parts.push(`${r.stagedPlacedCount} staged module(s) scheduled`);
      if (r.catalogFilledCount > 0) parts.push(`${r.catalogFilledCount} catalog module(s) added`);
      else if (!fillMissing) parts.push(`catalog fill was OFF (only staged/pinned modules placed)`);
      if (r.stagedUnplacedCount > 0) parts.push(`${r.stagedUnplacedCount} staged could not fit`);
      this.showQuickNotice(`Auto-Plan: ${parts.join(', ')}.`);
    }
  }

  handleExemplaryPlan() {
    if (typeof OFFICIAL_EXEMPLARY_PLAN !== 'undefined') {
      this.currentSpecialization = OFFICIAL_EXEMPLARY_PLAN.specialization;
      this.startTerm = OFFICIAL_EXEMPLARY_PLAN.startTerm;
      document.getElementById('specializationSelect').value = this.currentSpecialization;
      document.getElementById('startTermSelect').value = this.startTerm;
      this.plan = JSON.parse(JSON.stringify(OFFICIAL_EXEMPLARY_PLAN));
      this.updateSemesterHeaders();
      this.saveState();
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    }
  }

  handleResetPlan() {
    if (confirm('Clear all modules from the plan?')) {
      this.plan.semesters = { 1: [], 2: [], 3: [], 4: [] };
      this.saveState();
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    }
  }

  handleExportPlan() {
    const spec = this.validator.getSpecialization(this.currentSpecialization);
    let out = `========================================================================\n`;
    out += `KIT M.Sc. ELECTRICAL ENGINEERING AND INFORMATION TECHNOLOGY (SPO 2025)\n`;
    out += `STUDY PLAN SUBMISSION / VERIFICATION FORM\n`;
    out += `========================================================================\n\n`;
    out += `Field of Specialization: ${spec?.name || this.currentSpecialization}\n`;
    out += `Start Term:              ${this.startTerm === 'WS' ? 'Winter Semester' : 'Summer Semester'}\n`;
    out += `Total Credits Planned:   ${this.lastValidationResult?.totalCredits || 0} / 120 CP\n`;
    out += `Status:                  ${this.lastValidationResult?.isComplete ? 'PERMISSIBLE & COMPLETE (100%)' : 'INCOMPLETE / WARNINGS'}\n\n`;

    for (let sem = 1; sem <= 4; sem++) {
      const isWS = (this.startTerm === 'WS') ? (sem % 2 === 1) : (sem % 2 === 0);
      const semCP = this.lastValidationResult?.semesterCP[sem] || 0;
      out += `------------------------------------------------------------------------\n`;
      out += `SEMESTER ${sem} (${isWS ? 'Winter Term' : 'Summer Term'}) - Total: ${semCP} CP\n`;
      out += `------------------------------------------------------------------------\n`;
      const items = this.plan.semesters[sem] || [];
      if (items.length === 0) {
        out += `  (No modules scheduled)\n`;
      } else {
        items.forEach(it => {
          const mod = this.getModule(it.id);
          out += `  • [${mod?.id || it.id}] ${mod?.title || 'Unknown'} (${mod?.credits} CP) [${it.category}]\n`;
        });
      }
      out += `\n`;
    }

    document.getElementById('exportText').value = out;
    document.getElementById('exportModal').classList.add('open');
  }

  updateFocusProfilesDropdown() {
    const sel = document.getElementById('focusProfileSelect');
    if (!sel) return;
    sel.innerHTML = `
      <option value="ARSE">Automation, Robotics, and Systems Engineering</option>
      <option value="EPSE">Electrical Power Systems and Electromobility</option>
      <option value="ICT">Information and Communication Technology</option>
      <option value="MPQT">Microelectronics, Photonics, and Quantum Technologies</option>
    `;
    sel.value = this.currentSpecialization;
  }

  renderAnalytics() {
    const res = this.validator.validate(this.plan);
    const totalCP = res.totalCredits;
    const totalHours = totalCP * 30;

    // 1. Top stats
    document.getElementById('statTotalHours').textContent = `${totalHours.toLocaleString()} Hours`;
    
    // Language breakdown
    let enCP = 0;
    let deCP = 0;
    let writtenCount = 0;
    let oralCount = 0;
    let otherCount = 0;

    for (let sem = 1; sem <= 4; sem++) {
      (this.plan.semesters[sem] || []).forEach(item => {
        const mod = this.getModule(item.id);
        if (!mod) return;
        if (mod.language === 'English') enCP += mod.credits;
        else if (mod.language === 'German') deCP += mod.credits;
        else { enCP += mod.credits / 2; deCP += mod.credits / 2; }

        const ex = (mod.examType || '').toLowerCase();
        if (ex.includes('written') || ex.includes('klausur')) writtenCount++;
        else if (ex.includes('oral') || ex.includes('mündlich')) oralCount++;
        else otherCount++;
      });
    }

    const enPct = totalCP > 0 ? Math.round((enCP / totalCP) * 100) : 100;
    document.getElementById('statLangRatio').textContent = `${enPct}% EN / ${100 - enPct}% DE`;
    document.getElementById('statLangSub').textContent = `${Math.round(enCP)} CP English • ${Math.round(deCP)} CP German`;
    document.getElementById('statExamsRatio').textContent = `${writtenCount} Written • ${oralCount} Oral • ${otherCount} Lab/Project`;

    const compEl = document.getElementById('statCompliance');
    const compSubEl = document.getElementById('statComplianceSub');
    if (res.isComplete) {
      compEl.textContent = '100% Permissible';
      compEl.style.color = '#15803d';
      compSubEl.textContent = 'All SPO 2025 requirements satisfied';
    } else if (res.errors.length > 0) {
      compEl.textContent = `${res.errors.length} Violation${res.errors.length > 1 ? 's' : ''}`;
      compEl.style.color = '#b91c1c';
      compSubEl.textContent = 'Action required to meet SPO rules';
    } else {
      compEl.textContent = 'In Progress';
      compEl.style.color = '#b45309';
      compSubEl.textContent = `${120 - totalCP} CP remaining to complete degree`;
    }

    // 2. Stacked Semester Workload Chart
    const chartContainer = document.getElementById('semesterChartContainer');
    if (chartContainer) {
      chartContainer.innerHTML = '';

      // Legend
      const legend = document.createElement('div');
      legend.style.display = 'flex';
      legend.style.flexWrap = 'wrap';
      legend.style.gap = '12px';
      legend.style.fontSize = '0.75rem';
      legend.style.fontWeight = '600';
      legend.style.marginBottom = '8px';
      legend.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-fundamentals); border-radius:2px;"></span> Fundamentals (24 CP)</span>
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-focus); border-radius:2px;"></span> Focus Area (24-30 CP)</span>
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-lab); border-radius:2px;"></span> Lab Course (6 CP)</span>
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-electives); border-radius:2px;"></span> Electives (24 CP)</span>
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-uq); border-radius:2px;"></span> ÜQ (6 CP)</span>
        <span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:var(--cat-thesis); border-radius:2px;"></span> Master's Thesis (30 CP)</span>
      `;
      chartContainer.appendChild(legend);

      const maxScaleCP = 40; // visual bar width scale

      for (let sem = 1; sem <= 4; sem++) {
        const isWS = (this.startTerm === 'WS') ? (sem % 2 === 1) : (sem % 2 === 0);
        const semCP = res.semesterCP[sem] || 0;
        const items = this.plan.semesters[sem] || [];

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '4px';

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.fontSize = '0.8rem';
        labelRow.style.fontWeight = '700';
        labelRow.innerHTML = `
          <span>Semester ${sem} (${isWS ? 'Winter' : 'Summer'})</span>
          <span style="color:${semCP === 30 ? '#15803d' : (semCP > 34 ? '#b91c1c' : '#b45309')}">${semCP} CP / 30 CP Target</span>
        `;
        row.appendChild(labelRow);

        // Bar container
        const barTrack = document.createElement('div');
        barTrack.style.position = 'relative';
        barTrack.style.height = '26px';
        barTrack.style.background = '#e2e8f0';
        barTrack.style.borderRadius = '6px';
        barTrack.style.overflow = 'hidden';
        barTrack.style.display = 'flex';

        // 30 CP Target vertical line indicator
        const targetLine = document.createElement('div');
        targetLine.style.position = 'absolute';
        targetLine.style.left = `${(30 / maxScaleCP) * 100}%`;
        targetLine.style.top = '0';
        targetLine.style.bottom = '0';
        targetLine.style.width = '2px';
        targetLine.style.background = '#0f172a';
        targetLine.style.zIndex = '5';
        targetLine.title = 'Target 30 CP';
        barTrack.appendChild(targetLine);

        items.forEach(it => {
          const mod = this.getModule(it.id);
          if (!mod) return;
          const segment = document.createElement('div');
          const widthPct = (mod.credits / maxScaleCP) * 100;
          segment.style.width = `${widthPct}%`;
          segment.style.height = '100%';
          segment.style.display = 'flex';
          segment.style.alignItems = 'center';
          segment.style.justifyContent = 'center';
          segment.style.fontSize = '0.7rem';
          segment.style.fontWeight = '700';
          segment.style.color = '#fff';
          segment.style.overflow = 'hidden';
          segment.style.textOverflow = 'ellipsis';
          segment.style.whiteSpace = 'nowrap';
          segment.style.padding = '0 4px';
          segment.title = `${mod.title} (${mod.credits} CP) [${it.category}]`;

          // Color based on category
          const cat = it.category || 'Electives';
          if (cat === 'Fundamentals') segment.style.background = 'var(--cat-fundamentals)';
          else if (cat === 'Focus Area') segment.style.background = 'var(--cat-focus)';
          else if (cat === 'Lab Course') segment.style.background = 'var(--cat-lab)';
          else if (cat === 'Electives') segment.style.background = 'var(--cat-electives)';
          else if (cat === 'Interdisciplinary Qualifications' || cat === 'UQ') segment.style.background = 'var(--cat-uq)';
          else if (cat === "Master's Thesis") segment.style.background = 'var(--cat-thesis)';

          segment.textContent = `${mod.credits} CP`;
          barTrack.appendChild(segment);
        });

        row.appendChild(barTrack);
        chartContainer.appendChild(row);
      }
    }

    // 3. Analytics checklist list
    const auditEl = document.getElementById('analyticsAuditList');
    if (auditEl) {
      auditEl.innerHTML = '';
      res.errors.forEach(e => {
        const item = document.createElement('div');
        item.className = 'audit-item error';
        item.innerHTML = `<span>❌</span><div><strong>Violation:</strong> ${e.message}</div>`;
        auditEl.appendChild(item);
      });
      res.warnings.forEach(w => {
        const item = document.createElement('div');
        item.className = 'audit-item warning';
        item.innerHTML = `<span>⚠️</span><div><strong>Warning:</strong> ${w.message}</div>`;
        auditEl.appendChild(item);
      });
      res.passed.forEach(p => {
        const item = document.createElement('div');
        item.className = 'audit-item success';
        item.innerHTML = `<span>✓</span><div>${p}</div>`;
        auditEl.appendChild(item);
      });
    }
  }

  handleSaveCustomModule() {
    const title = document.getElementById('customTitle').value.trim();
    let code = document.getElementById('customCode').value.trim();
    const credits = parseInt(document.getElementById('customCredits').value, 10) || 2;
    const category = document.getElementById('customCategory').value;
    const term = document.getElementById('customTerm').value;
    const language = document.getElementById('customLanguage').value;
    const examType = document.getElementById('customExam').value.trim() || 'Coursework (pass/fail)';
    const coordinator = document.getElementById('customCoordinator').value.trim() || 'Custom Provider / KIT';
    const description = document.getElementById('customDescription').value.trim() || 'Custom module defined by student.';
    const initialSemVal = document.getElementById('customInitialSem').value;

    if (!title) {
      alert('Please enter a course title.');
      return;
    }

    if (!code) {
      const prefix = category === 'Interdisciplinary Qualifications' ? 'CUSTOM-UQ' : 'CUSTOM';
      code = `${prefix}-${Date.now().toString().slice(-5)}`;
    }

    const newMod = {
      id: code,
      title: title,
      credits: credits,
      term: term,
      termString: term === 'WS+SS' ? 'Each term (WS & SS)' : (term === 'WS' ? 'Each winter term' : 'Each summer term'),
      duration: '1 term',
      language: language,
      grading: (examType.toLowerCase().includes('pass/fail') || examType.toLowerCase().includes('ungraded')) ? 'pass/fail' : 'graded',
      coordinators: [coordinator],
      organisation: coordinator,
      categories: [category, 'Electives'],
      applicableSpecializations: ['ARSE', 'EPSE', 'ICT', 'MPQT'],
      isLab: category === 'Lab Course',
      isCustom: true,
      examType: examType,
      prerequisites: 'None',
      modeledPrerequisites: '',
      exclusions: [],
      requires: [],
      competenceGoal: description,
      content: description,
      workload: `${credits * 30} hours workload (${credits} CP).`,
      recommendations: '',
      literature: ''
    };

    // Add to custom list & update maps
    this.customModules = this.customModules.filter(m => m.id !== code);
    this.customModules.unshift(newMod);
    this.saveCustomModules();

    this.modulesMap.set(code, newMod);
    const existingIdx = this.modulesList.findIndex(m => m.id === code);
    if (existingIdx !== -1) {
      this.modulesList[existingIdx] = newMod;
    } else {
      this.modulesList.unshift(newMod);
    }

    // Add to requested semester or staging area
    if (initialSemVal === 'stage') {
      this.stageModule(code);
    } else {
      const initialSem = parseInt(initialSemVal, 10);
      if (initialSem >= 1 && initialSem <= 4) {
        this.addModuleToSemester(code, initialSem, category);
      }
    }

    // Reset form and close modal
    document.getElementById('customModuleForm').reset();
    document.getElementById('customCredits').value = "2";
    document.getElementById('customModuleModal').classList.remove('open');

    this.renderCatalog();
    this.renderPlanner();
    this.runValidation();
  }

  deleteCustomModule(moduleId) {
    if (confirm(`Remove custom course [${moduleId}] from catalog and plan?`)) {
      // Remove from any semester
      for (let sem = 1; sem <= 4; sem++) {
        this.plan.semesters[sem] = (this.plan.semesters[sem] || []).filter(it => it.id !== moduleId);
      }
      this.unstageModule(moduleId);
      this.customModules = this.customModules.filter(m => m.id !== moduleId);
      this.saveCustomModules();
      this.modulesMap.delete(moduleId);
      this.modulesList = this.modulesList.filter(m => m.id !== moduleId);

      this.saveState();
      this.renderCatalog();
      this.renderPlanner();
      this.runValidation();
    }
  }

  // --- Helpers ---
  getScheduledModuleIds() {
    const set = new Set();
    for (let sem = 1; sem <= 4; sem++) {
      (this.plan.semesters[sem] || []).forEach(it => set.add(it.id));
    }
    return set;
  }

  getCategoryClass(cat) {
    if (!cat) return 'cat-electives';
    const clean = cat.replace(/[^a-zA-Z0-9]/g, '-');
    return `cat-${clean}`;
  }

  getTermBadgeClass(term) {
    if (term === 'WS') return 'badge-term-ws';
    if (term === 'SS') return 'badge-term-ss';
    return 'badge-term-both';
  }

  getModule(id) {
    return this.modulesMap.get(id);
  }

  saveState() {
    try {
      localStorage.setItem('kit_etit_plan', JSON.stringify(this.plan));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  loadStateFromStorage() {
    try {
      const saved = localStorage.getItem('kit_etit_plan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.semesters) {
          this.plan = parsed;
          this.currentSpecialization = parsed.specialization || 'ARSE';
          this.startTerm = parsed.startTerm || 'WS';
          return;
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
    // Default to exemplary plan if no saved state
    this.handleExemplaryPlan();
  }
}

// Instantiate and start app on page load
let app;
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('DOMContentLoaded', () => {
    app = new StudyPlannerApp();
    app.init();
    app.loadDataFromAPI();
  });
}
