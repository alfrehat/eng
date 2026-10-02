/**
 * OperationsCenter/Pages/workOperationsCenterManager.js
 * 🏛️ مركز العمل والمتابعة — Work & Operations Center Suite
 * مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v2.0 Enterprise
 * يعتمد 100% على Enterprise Core ويدعم التوجيه والإسناد الديناميكي وسجل التحويلات الشامل
 */

'use strict';

class WorkOperationsCenterManager {
  constructor(containerId = 'work-center-container') {
    this.containerId = containerId;
    this.container = null;
    this.operations = [];
    this.stats = {
      total: 0, today: 0, open: 0, inProgress: 0, overdue: 0, critical: 0,
      underReview: 0, awaitingClosure: 0, upcomingAppeals: 0, overdueAppeals: 0,
      completedCount: 0, onTimeRate: 100
    };
    
    // 12 Tabs
    this.activeTab = 'overview';
    // 5 Data Presentation Views: list | kanban | calendar | map | timeline
    this.activeViewMode = 'list';
    
    this.filters = {
      search: '',
      status: 'all',
      priority: 'all',
      task_type: 'all',
      assigned_to: 'all',
      entity_type: 'all'
    };

    this.usersList = [];
    this.mapInstance = null;
    this.modalMapInstance = null;
    this.modalMarker = null;
    this.selectedOp = null;
    this._readUser();
  }

  _getToken() {
    return localStorage.getItem('token') || 
           sessionStorage.getItem('token') || 
           localStorage.getItem('authToken') || 
           sessionStorage.getItem('authToken') || 
           (this._user && this._user.token) || 
           (window.currentUser && window.currentUser.token) || '';
  }

  async _apiFetch(url, options = {}) {
    const token = this._getToken();
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    return fetch(url, { ...options, headers, body });
  }

  _readUser() {
    try {
      const raw = sessionStorage.getItem('engineeringUser') || localStorage.getItem('user') || localStorage.getItem('engineeringUser');
      this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
    } catch {
      this._user = null;
    }
    this.isAdmin = this._user && (this._user.role === 'admin' || this._user.role === 'super_admin' || this._user.role === 'director_public_works');
  }

  async init() {
    this.container = document.getElementById(this.containerId) || document.getElementById('work-center-container') || document.getElementById('mainContent');
    if (!this.container) return;

    this._readUser();
    this._buildLayoutSkeleton();

    // إغلاق القوائم المنسدلة عند النقر خارجها
    if (!this._hasClickOutsideBound) {
      document.addEventListener('click', () => this.closeAllMenus());
      this._hasClickOutsideBound = true;
    }

    await this.loadUsersLookups();
    await this.fetchData();
    this.renderCurrentTab();
  }

  async loadUsersLookups() {
    try {
      const res = await this._apiFetch('/api/users');
      const json = await res.json();
      if (json && Array.isArray(json.users || json.data || json)) {
        this.usersList = json.users || json.data || json;
      }
    } catch (e) {
      this.usersList = [
        { id: 'U-001', fullName: 'مدير النظام (كامل الصلاحيات)', role: 'admin', department: 'الإدارة العامة' },
        { id: 'U-002', fullName: 'م. محمد الفريحات', role: 'director_public_works', department: 'مديرية الأشغال' },
        { id: 'U-003', fullName: 'م. أحمد الكراز', role: 'head_of_roads', department: 'قسم الطرق' },
        { id: 'U-004', fullName: 'م. محمد خير عنانزة', role: 'head_of_buildings', department: 'قسم الأبنية' },
        { id: 'U-005', fullName: 'م. وعد العنانبة', role: 'roads_engineer', department: 'قسم الطرق' },
        { id: 'U-006', fullName: 'م. ياسمين عنانبة', role: 'buildings_engineer', department: 'قسم الأبنية' },
        { id: 'U-007', fullName: 'أحمد العنانبة', role: 'quantity_surveyor', department: 'قسم الدراسات' },
        { id: 'U-008', fullName: 'رشاد الرشايدة', role: 'site_inspector', department: 'قسم الطرق' },
        { id: 'U-009', fullName: 'م. محمد الفريحات', role: 'qa_qc_engineer', department: 'ضبط الجودة' },
        { id: 'U-010', fullName: 'مامون بني نصر', role: 'land_surveyor', department: 'المساحة' },
        { id: 'U-011', fullName: 'م. مامون الفريحات', role: 'head_of_electricity_energy', department: 'قسم الإنارة والكهرباء' }
      ];
    }
  }

  async fetchData() {
    try {
      let scopeParam = '';
      if (this.activeTab === 'my_tasks') scopeParam = '&view_scope=my_tasks';
      else if (this.activeTab === 'appeals') scopeParam = '&view_scope=appeals';
      else if (this.activeTab === 'field_actions') scopeParam = '&view_scope=field_actions';
      else if (this.activeTab === 'overdue') scopeParam = '&view_scope=overdue';

      const [opsRes, statsRes] = await Promise.all([
        this._apiFetch(`/api/v4/operations-center?search=${encodeURIComponent(this.filters.search)}${scopeParam}`),
        this._apiFetch('/api/v4/operations-center/stats')
      ]);

      const opsJson = await opsRes.json();
      const statsJson = await statsRes.json();

      this.operations = (opsJson && opsJson.data) ? opsJson.data : (Array.isArray(opsJson) ? opsJson : []);
      if (statsJson && statsJson.data) {
        this.stats = statsJson.data;
      }

      this._updateExecutiveMetricPills();
    } catch (err) {
      console.warn('Work Operations Center fetch fallback:', err.message);
    }
  }

  _buildLayoutSkeleton() {
    this.container.innerHTML = `
      <div class="work-ops-suite" style="direction:rtl; font-family:'Tajawal', system-ui, sans-serif; color:var(--text, #f1f5f9);">
        
        <!-- Header Executive Banner -->
        <div style="background: linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.92) 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px 22px; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); backdrop-filter: blur(12px);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0f766e); display:flex; align-items:center; justify-content:center; font-size:1.4rem; box-shadow:0 4px 14px rgba(2,132,199,0.3);">
                ⚡
              </div>
              <div>
                <h2 style="margin:0; font-size:1.3rem; font-weight:800; color:#fff; letter-spacing:-0.2px;">
                  مركز العمل والمتابعة
                </h2>
                <div style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">
                  المنصة التشغيلية الموحدة للمهام الميدانية، الاستدعيات، التكليفات، والتوجيه الإداري الديناميكي
                </div>
              </div>
            </div>

            <!-- Action Controls -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="window.workOperationsCenterManager.refresh()" style="display:flex; align-items:center; gap:6px; font-size:0.82rem; padding:8px 14px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; cursor:pointer;">
                <span>🔄</span> تحديث
              </button>
              <button class="btn btn-outline" onclick="window.workOperationsCenterManager.exportExcel()" style="display:flex; align-items:center; gap:6px; font-size:0.82rem; padding:8px 14px; border-radius:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; cursor:pointer;">
                <span>📊</span> تصدير Excel
              </button>
              <button class="btn btn-primary" onclick="window.workOperationsCenterManager.openNewOperationModal()" style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:8px 20px; border-radius:10px; font-weight:800; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; color:#fff; cursor:pointer; box-shadow:0 4px 14px rgba(2,132,199,0.35);">
                <span>➕</span> تكليف عمل / استدعاء جديد
              </button>
            </div>
          </div>

          <!-- Comprehensive KPI Metric Strip (10 Core Metrics) -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(115px, 1fr)); gap:8px; margin-top:16px; border-top:1px solid rgba(255,255,255,0.06); padding-top:14px;">
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">إجمالي الأعمال</div>
              <div id="woc-kpi-total" class="woc-kpi-val" style="color:#38bdf8;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">أعمال اليوم</div>
              <div id="woc-kpi-today" class="woc-kpi-val" style="color:#0ea5e9;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">المهام المفتوحة</div>
              <div id="woc-kpi-open" class="woc-kpi-val" style="color:#10b981;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">قيد التنفيذ</div>
              <div id="woc-kpi-inprogress" class="woc-kpi-val" style="color:#8b5cf6;">0</div>
            </div>
            <div class="woc-kpi-pill" style="border-color:rgba(239,68,68,0.25); background:rgba(239,68,68,0.05);">
              <div class="woc-kpi-label" style="color:#f87171;">المهام المتأخرة 🚨</div>
              <div id="woc-kpi-overdue" class="woc-kpi-val" style="color:#ef4444;">0</div>
            </div>
            <div class="woc-kpi-pill" style="border-color:rgba(245,158,11,0.25); background:rgba(245,158,11,0.05);">
              <div class="woc-kpi-label" style="color:#fbbf24;">المهام الحرجة</div>
              <div id="woc-kpi-critical" class="woc-kpi-val" style="color:#f59e0b;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">بانتظار المراجعة</div>
              <div id="woc-kpi-review" class="woc-kpi-val" style="color:#ec4899;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">بانتظار الإغلاق</div>
              <div id="woc-kpi-closure" class="woc-kpi-val" style="color:#6366f1;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">استدعيات قادمة</div>
              <div id="woc-kpi-up-appeals" class="woc-kpi-val" style="color:#14b8a6;">0</div>
            </div>
            <div class="woc-kpi-pill">
              <div class="woc-kpi-label">استدعيات متأخرة</div>
              <div id="woc-kpi-od-appeals" class="woc-kpi-val" style="color:#f43f5e;">0</div>
            </div>
          </div>
        </div>

        <!-- 12 Unified Tabs Bar -->
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:6px 10px; margin-bottom:12px; overflow-x:auto;">
          <div style="display:flex; gap:4px; min-width:max-content;">
            <button class="woc-tab-btn active" onclick="window.workOperationsCenterManager.switchTab('overview')" id="woc-tab-overview">📊 لوحة المتابعة</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('my_tasks')" id="woc-tab-my_tasks">👤 مهامي</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('team_tasks')" id="woc-tab-team_tasks">👥 مهام الفريق</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('appeals')" id="woc-tab-appeals">📝 الاستدعيات</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('field_actions')" id="woc-tab-field_actions">🚜 الأعمال الميدانية</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('followups')" id="woc-tab-followups">🎯 المتابعات</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('overdue')" id="woc-tab-overdue">🚨 المتأخرات</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('calendar')" id="woc-tab-calendar">📅 التقويم</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('map')" id="woc-tab-map">🗺️ الخريطة التشغيلية</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('attachments')" id="woc-tab-attachments">📁 الملفات والمرفقات</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('activity')" id="woc-tab-activity">🕒 سجل النشاط</button>
            <button class="woc-tab-btn" onclick="window.workOperationsCenterManager.switchTab('reports')" id="woc-tab-reports">📈 التقارير والمؤشرات</button>
          </div>
        </div>

        <!-- Filter, Search & View Switcher Strip -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; background:rgba(30,41,59,0.5); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:8px 14px;">
          <!-- 5 Presentation Modes -->
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:0.75rem; color:#94a3b8; font-weight:700; margin-left:6px;">نمط العرض:</span>
            <button class="woc-vmode-btn ${this.activeViewMode === 'list' ? 'active' : ''}" onclick="window.workOperationsCenterManager.switchViewMode('list')" id="woc-vmode-list">📑 قائمة</button>
            <button class="woc-vmode-btn ${this.activeViewMode === 'kanban' ? 'active' : ''}" onclick="window.workOperationsCenterManager.switchViewMode('kanban')" id="woc-vmode-kanban">📊 كانبان</button>
            <button class="woc-vmode-btn ${this.activeViewMode === 'calendar' ? 'active' : ''}" onclick="window.workOperationsCenterManager.switchViewMode('calendar')" id="woc-vmode-calendar">📅 تقويم</button>
            <button class="woc-vmode-btn ${this.activeViewMode === 'map' ? 'active' : ''}" onclick="window.workOperationsCenterManager.switchViewMode('map')" id="woc-vmode-map">🗺️ خريطة</button>
            <button class="woc-vmode-btn ${this.activeViewMode === 'timeline' ? 'active' : ''}" onclick="window.workOperationsCenterManager.switchViewMode('timeline')" id="woc-vmode-timeline">🕒 مسار زمني</button>
          </div>

          <!-- Live Search & Select Filters -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <input type="text" id="woc-search-input" placeholder="🔍 بحث في العمليات والمواقع والمواطنين..." oninput="window.workOperationsCenterManager.onSearchChange(this.value)" style="padding:6px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.8rem; width:220px;" />
            
            <select id="woc-filter-status" onchange="window.workOperationsCenterManager.onFilterChange('status', this.value)" style="padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#cbd5e1; font-size:0.8rem; cursor:pointer;">
              <option value="all">كل الحالات</option>
              <option value="new">جديدة</option>
              <option value="assigned">مسندة</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="under_review">بانتظار المراجعة</option>
              <option value="completed">منجزة</option>
              <option value="closed">مغلقة</option>
            </select>

            <select id="woc-filter-priority" onchange="window.workOperationsCenterManager.onFilterChange('priority', this.value)" style="padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#cbd5e1; font-size:0.8rem; cursor:pointer;">
              <option value="all">كل الأولويات</option>
              <option value="critical">🚨 حرجة (طوارئ)</option>
              <option value="high">عالية</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>

            <select id="woc-filter-type" onchange="window.workOperationsCenterManager.onFilterChange('task_type', this.value)" style="padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#cbd5e1; font-size:0.8rem; cursor:pointer;">
              <option value="all">كافة الأنواع</option>
              <option value="technical">كشف فني وهندسي</option>
              <option value="executive_field">تنفيذي ميداني / صيانة</option>
              <option value="supervisory">رقابي / جودة</option>
              <option value="emergency">طوارئ وسلامة</option>
              <option value="citizen_appeal">استدعاء مواطن</option>
              <option value="administrative">إداري ومتابعة</option>
            </select>
          </div>
        </div>

        <!-- Dynamic Main Content Pane -->
        <div id="woc-dynamic-pane" style="min-height:460px;"></div>
      </div>
    `;

    if (!document.getElementById('woc-enterprise-style')) {
      const s = document.createElement('style');
      s.id = 'woc-enterprise-style';
      s.textContent = `
        .woc-kpi-pill { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 12px; }
        .woc-kpi-label { font-size: 0.7rem; color: #94a3b8; font-weight: 700; }
        .woc-kpi-val { font-size: 1.25rem; font-weight: 800; margin-top: 2px; }
        .woc-tab-btn { background: transparent; border: none; color: #94a3b8; font-size: 0.78rem; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; white-space: nowrap; }
        .woc-tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .woc-tab-btn.active { background: #0284c7 !important; color: #fff !important; box-shadow: 0 2px 8px rgba(2,132,199,0.3); }
        .woc-vmode-btn { background: transparent; border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
        .woc-vmode-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .woc-vmode-btn.active { background: rgba(2,132,199,0.2) !important; border-color: #0284c7 !important; color: #38bdf8 !important; }
        .woc-card { background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease; }
        .woc-card:hover { transform: translateY(-2px); border-color: #0284c7; background: rgba(30,41,59,0.95); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
        .woc-empty-state { text-align: center; padding: 60px 20px; color: #64748b; background: rgba(30,41,59,0.4); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px; }
      `;
      document.head.appendChild(s);
    }
  }

  _updateExecutiveMetricPills() {
    const s = this.stats;
    const el = id => document.getElementById(id);
    if (el('woc-kpi-total')) el('woc-kpi-total').textContent = s.total || 0;
    if (el('woc-kpi-today')) el('woc-kpi-today').textContent = s.today || 0;
    if (el('woc-kpi-open')) el('woc-kpi-open').textContent = s.open || 0;
    if (el('woc-kpi-inprogress')) el('woc-kpi-inprogress').textContent = s.inProgress || 0;
    if (el('woc-kpi-overdue')) el('woc-kpi-overdue').textContent = s.overdue || 0;
    if (el('woc-kpi-critical')) el('woc-kpi-critical').textContent = s.critical || 0;
    if (el('woc-kpi-review')) el('woc-kpi-review').textContent = s.underReview || 0;
    if (el('woc-kpi-closure')) el('woc-kpi-closure').textContent = s.awaitingClosure || 0;
    if (el('woc-kpi-up-appeals')) el('woc-kpi-up-appeals').textContent = s.upcomingAppeals || 0;
    if (el('woc-kpi-od-appeals')) el('woc-kpi-od-appeals').textContent = s.overdueAppeals || 0;
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.woc-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`woc-tab-${tabId}`);
    if (btn) btn.classList.add('active');

    if (tabId === 'calendar') this.activeViewMode = 'calendar';
    else if (tabId === 'map') this.activeViewMode = 'map';
    else if (tabId === 'activity') this.activeViewMode = 'timeline';

    this.fetchData().then(() => this.renderCurrentTab());
  }

  switchViewMode(mode) {
    this.activeViewMode = mode;
    document.querySelectorAll('.woc-vmode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`woc-vmode-${mode}`);
    if (btn) btn.classList.add('active');
    this.renderCurrentTab();
  }

  onSearchChange(val) {
    this.filters.search = val.trim();
    this.fetchData().then(() => this.renderCurrentTab());
  }

  onFilterChange(field, val) {
    this.filters[field] = val;
    this.renderCurrentTab();
  }

  getFilteredOperations() {
    const myId = this._user?.id || '';
    const todayStr = new Date().toISOString().split('T')[0];

    return this.operations.filter(op => {
      // فلترة حسب التبويب النشط
      if (this.activeTab === 'my_tasks' && op.assigned_to !== myId) return false;
      if (this.activeTab === 'appeals' && !['appeal', 'citizen_appeal'].includes(op.task_type)) return false;
      if (this.activeTab === 'field_actions' && !['executive_field', 'technical', 'supervisory'].includes(op.task_type)) return false;
      if (this.activeTab === 'followups' && !['in_progress', 'under_review', 'assigned'].includes(op.status)) return false;
      if (this.activeTab === 'overdue' && !(op.due_date && op.due_date < todayStr && !['completed', 'closed', 'verified'].includes(op.status))) return false;

      // فلترة القوائم المنسدلة
      if (this.filters.status !== 'all' && op.status !== this.filters.status) return false;
      if (this.filters.priority !== 'all' && op.priority !== this.filters.priority) return false;
      if (this.filters.task_type !== 'all' && op.task_type !== this.filters.task_type) return false;
      if (this.filters.assigned_to !== 'all' && op.assigned_to !== this.filters.assigned_to) return false;
      if (this.filters.entity_type !== 'all' && op.entity_type !== this.filters.entity_type) return false;
      return true;
    });
  }

  renderCurrentTab() {
    const pane = document.getElementById('woc-dynamic-pane');
    if (!pane) return;

    if (this.activeTab === 'attachments') {
      this._renderAttachmentsGallery(pane);
      return;
    }
    if (this.activeTab === 'reports') {
      this._renderReportsAndKPIs(pane);
      return;
    }

    if (this.activeViewMode === 'list') {
      this._renderListView(pane);
    } else if (this.activeViewMode === 'kanban') {
      this._renderKanbanView(pane);
    } else if (this.activeViewMode === 'calendar') {
      this._renderCalendarView(pane);
    } else if (this.activeViewMode === 'map') {
      this._renderMapView(pane);
    } else if (this.activeViewMode === 'timeline') {
      this._renderTimelineView(pane);
    }
  }

  _renderListView(container) {
    const list = this.getFilteredOperations();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="woc-empty-state">
          <div style="font-size:2.5rem; margin-bottom:8px;">📋</div>
          <div style="font-weight:800; font-size:1rem; color:#f1f5f9; margin-bottom:4px;">لا توجد عمليات أو تكليفات مطابقة حالياً</div>
          <div style="font-size:0.8rem; color:#94a3b8; margin-bottom:16px;">لم يتم العثور على سجلات تطابق خيارات التصفية والبحث الحالية.</div>
          <button class="btn btn-primary" onclick="window.workOperationsCenterManager.openNewOperationModal()" style="font-size:0.82rem; padding:6px 18px; border-radius:8px;">➕ تسجيل وتكليف عملية جديدة</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.82rem;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-weight:700;">
              <th style="padding:10px;">رقم المعاملة / الاستدعاء</th>
              <th style="padding:10px;">عنوان العمل / الإجراء</th>
              <th style="padding:10px;">النوع</th>
              <th style="padding:10px;">الكيان المرتبط</th>
              <th style="padding:10px;">المكلف بالعمل</th>
              <th style="padding:10px;">الأولوية</th>
              <th style="padding:10px;">الحالة</th>
              <th style="padding:10px;">الاستحقاق والـ SLA</th>
              <th style="padding:10px; text-align:center;">إجراءات المعاملة</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(op => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                <td style="padding:10px; font-weight:bold; font-family:monospace;">
                  <a href="javascript:void(0)" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}', 'details')" style="color:#38bdf8; text-decoration:none; font-weight:800; display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:5px; background:rgba(2,132,199,0.12); border:1px solid rgba(2,132,199,0.25);" title="فتح شاشة الاستدعاء والمعاملة">
                    <span>🏛️</span> <span>${op.task_number || op.id}</span>
                  </a>
                </td>
                <td style="padding:10px; font-weight:700; color:#f1f5f9; max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  <a href="javascript:void(0)" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}', 'details')" style="color:inherit; text-decoration:none;" title="عرض التفاصيل">
                    ${op.title}
                  </a>
                </td>
                <td style="padding:10px;">${this._getTypeBadge(op.task_type)}</td>
                <td style="padding:10px; color:#94a3b8; font-size:0.75rem;">${op.entity_name || op.entity_type || '—'}</td>
                <td style="padding:10px; font-weight:600; color:#e2e8f0;">👤 ${this._getUserName(op.assigned_to)}</td>
                <td style="padding:10px;">${this._getPriorityBadge(op.priority)}</td>
                <td style="padding:10px;">${this._getStatusBadge(op.status)}</td>
                <td style="padding:10px; font-size:0.75rem;">
                  <div style="color:#94a3b8;">${op.due_date || '—'}</div>
                  <span class="badge" style="font-size:0.65rem; padding:1px 4px; border-radius:4px; ${op.sla_status === 'DELAYED' ? 'background:rgba(239,68,68,0.2); color:#f87171;' : 'background:rgba(16,185,129,0.15); color:#34d399;'}">${op.sla_status || 'ON_TRACK'}</span>
                </td>
                <td style="padding:10px; text-align:center; white-space:nowrap;">
                  <div style="display:inline-flex; align-items:center; gap:5px; justify-content:center;">
                    <button type="button" class="btn btn-primary" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}', 'details')" style="font-size:0.75rem; padding:4px 10px; border-radius:6px; background:#0284c7; border:none; color:#fff; font-weight:800; cursor:pointer;" title="عرض وتوجيه المعاملة">
                      ⚡ عرض وتوجيه
                    </button>
                    <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}', 'endorsements')" style="font-size:0.75rem; padding:4px 8px; border-radius:6px; background:rgba(2,132,199,0.15); border:1px solid #0284c7; color:#38bdf8; cursor:pointer; font-weight:700;" title="إضافة مشروحة أو كشف فني">
                      ✍️ مشروحة
                    </button>
                    <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.printOfficialReport('${op.id}')" style="font-size:0.75rem; padding:4px 8px; border-radius:6px; background:rgba(16,185,129,0.12); border:1px solid #10b981; color:#34d399; cursor:pointer; font-weight:700;" title="طباعة التقرير الفني الموحد">
                      🖨️ طباعة
                    </button>
                    ${this._canEdit(op) ? `
                      <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.openEditOperationModal('${op.id}')" style="font-size:0.75rem; padding:4px 8px; border-radius:6px; background:rgba(245,158,11,0.12); border:1px solid #f59e0b; color:#fbbf24; cursor:pointer; font-weight:700;" title="تعديل بيانات المعاملة">
                        ✏️ تعديل
                      </button>
                    ` : ''}
                    ${this._canDelete(op) ? `
                      <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.deleteOperation('${op.id}')" style="font-size:0.75rem; padding:4px 8px; border-radius:6px; background:rgba(239,68,68,0.12); border:1px solid #ef4444; color:#f87171; cursor:pointer; font-weight:700;" title="حذف المعاملة نهائياً">
                        🗑️ حذف
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  _renderKanbanView(container) {
    const list = this.getFilteredOperations();
    const columns = [
      { id: 'new', title: 'جديدة وغير مسندة', color: '#64748b' },
      { id: 'assigned', title: 'مسندة ومقبولة', color: '#0284c7' },
      { id: 'in_progress', title: 'قيد التنفيذ الميداني', color: '#8b5cf6' },
      { id: 'under_review', title: 'بانتظار التدقيق والاعتماد', color: '#ec4899' },
      { id: 'completed', title: 'منجزة ومغلقة', color: '#10b981' }
    ];

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(5, minmax(220px, 1fr)); gap:12px; overflow-x:auto; padding-bottom:12px;">
        ${columns.map(col => {
          const colItems = list.filter(op => {
            if (col.id === 'completed') return ['completed', 'verified', 'closed'].includes(op.status);
            if (col.id === 'assigned') return ['assigned', 'accepted'].includes(op.status);
            return op.status === col.id;
          });
          return `
            <div style="background:rgba(30,41,59,0.5); border:1px solid rgba(255,255,255,0.06); border-top:3px solid ${col.color}; border-radius:12px; padding:12px; min-height:460px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="font-weight:800; font-size:0.82rem; color:#f1f5f9;">${col.title}</span>
                <span class="badge" style="background:rgba(255,255,255,0.06); color:#cbd5e1; font-weight:800; font-size:0.7rem; padding:1px 6px; border-radius:6px;">${colItems.length}</span>
              </div>
              <div style="min-height:380px;">
                ${colItems.length === 0 ? '<div style="text-align:center; padding:30px; color:#64748b; font-size:0.75rem;">لا توجد عمليات</div>' : ''}
                ${colItems.map(op => `
                  <div class="woc-card" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}')">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; margin-bottom:4px;">
                      <span style="font-weight:bold; font-family:monospace; color:#38bdf8;">${op.task_number || op.id}</span>
                      ${this._getPriorityBadge(op.priority)}
                    </div>
                    <div style="font-weight:700; font-size:0.82rem; color:#f8fafc; margin:4px 0; line-height:1.4;">${op.title}</div>
                    <div style="font-size:0.7rem; color:#94a3b8; display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px;">
                      <span>👤 ${this._getUserName(op.assigned_to)}</span>
                      <span>📅 ${op.due_date || '—'}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  _renderCalendarView(container) {
    const list = this.getFilteredOperations().filter(op => op.due_date || op.start_date);
    const sorted = [...list].sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:0.95rem; font-weight:800; color:#fff;">📅 جدول المواعيد والاستحقاقات الميدانية</h3>
          <span style="font-size:0.75rem; color:#94a3b8;">إجمالي العمليات المجدولة: ${sorted.length}</span>
        </div>
        ${sorted.length === 0 ? `
          <div class="woc-empty-state">
            <div style="font-size:2rem; margin-bottom:6px;">📅</div>
            <div>لا توجد عمليات مجدولة بتواريخ استحقاق</div>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
            ${sorted.map(op => `
              <div class="woc-card" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}')">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem;">
                  <span style="font-weight:bold; color:#38bdf8; font-family:monospace;">${op.task_number || op.id}</span>
                  <span class="badge" style="background:rgba(2,132,199,0.15); color:#38bdf8; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px;">استحقاق: ${op.due_date || '—'}</span>
                </div>
                <div style="font-weight:700; font-size:0.86rem; margin:6px 0; color:#f1f5f9;">${op.title}</div>
                <div style="font-size:0.72rem; color:#94a3b8; display:flex; justify-content:space-between;">
                  <span>📍 ${op.location_name || 'بلدية كفرنجة'}</span>
                  <span>👤 ${this._getUserName(op.assigned_to)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  _renderMapView(container) {
    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:#fff; display:flex; align-items:center; gap:8px;">
              <span>🗺️</span> الخريطة الجغرافية التشغيلية لمركز العمل والمتابعة — كفرنجة
            </div>
            <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">
              توزيع مكاني لحظي للبلاغات الميدانية، الاستدعيات، فرق الصيانة، والمشاريع
            </div>
          </div>
          <button class="btn btn-outline" onclick="window.workOperationsCenterManager._centerKafranjah()" style="font-size:0.78rem; padding:5px 12px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#fff; cursor:pointer;">
            🎯 إعادة التمركز
          </button>
        </div>
        <div id="woc-leaflet-map" style="width:100%; height:500px; border-radius:10px; border:1px solid rgba(255,255,255,0.08); z-index:1;"></div>
      </div>
    `;

    setTimeout(() => {
      this._initMap();
    }, 150);
  }

  _initMap() {
    const mapEl = document.getElementById('woc-leaflet-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (this.mapInstance) {
      try { this.mapInstance.remove(); } catch (e) {}
      this.mapInstance = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.mapInstance = UnifiedGisEngine.createMap('woc-leaflet-map', [32.2985, 35.7050], 14);
    } else {
      this.mapInstance = L.map('woc-leaflet-map').setView([32.2985, 35.7050], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | بلدية كفرنجة الجديدة'
      }).addTo(this.mapInstance);
    }

    const spatialOps = this.operations.filter(op => op.lat && op.lng);

    spatialOps.forEach(op => {
      const color = op.priority === 'critical' ? '#ef4444' : op.priority === 'high' ? '#f59e0b' : '#0284c7';
      const marker = L.circleMarker([op.lat, op.lng], {
        radius: 9,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(this.mapInstance);

      marker.bindPopup(`
        <div style="direction:rtl; font-family:'Tajawal',sans-serif; min-width:220px; padding:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-weight:800; font-size:0.85rem; color:#0284c7; font-family:monospace;">${op.task_number || op.id}</span>
            <span style="background:${color}20; color:${color}; font-size:0.7rem; font-weight:bold; padding:2px 6px; border-radius:4px;">${this._getPriorityLabel(op.priority)}</span>
          </div>
          <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px; color:#0f172a;">${op.title}</div>
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">📍 الموقع: ${op.location_name || 'كفرنجة'}</div>
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">🔗 الكيان: ${op.entity_name || op.entity_type || '—'}</div>
          <div style="font-size:0.75rem; color:#64748b; margin-bottom:8px;">👤 المكلف: ${this._getUserName(op.assigned_to)} | 📅 ${op.due_date || '—'}</div>
          <button onclick="window.workOperationsCenterManager.openOperationModal('${op.id}')" style="width:100%; padding:6px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.8rem;">
            فتح تفاصيل وتوجيه العملية ⚡
          </button>
        </div>
      `);

      // رسم الأشكال الهندسية المرتبطة (Line / Polygon) إن وجدت
      if (op.entity_geometry) {
        try {
          const geom = typeof op.entity_geometry === 'string' ? JSON.parse(op.entity_geometry) : op.entity_geometry;
          if (Array.isArray(geom) && geom.length > 0) {
            L.polyline(geom, { color, weight: 4, opacity: 0.8 }).addTo(this.mapInstance);
          }
        } catch(e) {}
      }
    });

    // استعلام مكاني حي عند النقر على الخريطة (GIS Spatial Nearby Query)
    this.mapInstance.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      try {
        const res = await this._apiFetch(`/api/v4/operations-center/spatial/nearby?lat=${lat}&lng=${lng}&radiusMeters=600`);
        const json = await res.json();
        if (json && json.data) {
          const { nearbyTasks, nearbyAssets, nearbyProjects } = json.data;
          L.popup()
            .setLatLng(e.latlng)
            .setContent(`
              <div style="direction:rtl; font-family:'Tajawal',sans-serif; min-width:240px; padding:4px;">
                <div style="font-weight:800; font-size:0.85rem; color:#0284c7; margin-bottom:4px;">📍 الاستعلام المكاني (نطاق 600م)</div>
                <div style="font-size:0.75rem; color:#64748b; margin-bottom:6px;">الإحداثيات: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                <div style="font-size:0.75rem; color:#0f172a; margin-bottom:2px;">⚡ المهام والعمليات المجاورة: <b>${nearbyTasks.length}</b></div>
                <div style="font-size:0.75rem; color:#0f172a; margin-bottom:2px;">🏛️ الأصول الهندسية المجاورة: <b>${nearbyAssets.length}</b></div>
                <div style="font-size:0.75rem; color:#0f172a; margin-bottom:6px;">🏗️ المشاريع القريبة: <b>${nearbyProjects.length}</b></div>
                <button onclick="window.workOperationsCenterManager.openNewOpAtCoords(${lat}, ${lng})" style="width:100%; padding:5px; background:#10b981; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.75rem;">
                  ➕ تكليف عمل في هذا الموقع
                </button>
              </div>
            `)
            .openOn(this.mapInstance);
        }
      } catch(err) {}
    });

    setTimeout(() => {
      if (this.mapInstance) this.mapInstance.invalidateSize();
    }, 250);
  }

  _centerKafranjah() {
    if (this.mapInstance) {
      this.mapInstance.setView([32.2985, 35.7050], 15);
    }
  }

  openNewOpAtCoords(lat, lng) {
    this.openNewOperationModal();
    setTimeout(() => {
      const latEl = document.getElementById('nwoc-lat');
      const lngEl = document.getElementById('nwoc-lng');
      if (latEl) latEl.value = lat.toFixed(6);
      if (lngEl) lngEl.value = lng.toFixed(6);
      const display = document.getElementById('nwoc-coords');
      if (display) display.textContent = `إحداثيات: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (this.modalMarker) this.modalMarker.setLatLng([lat, lng]);
      if (this.modalMapInstance) this.modalMapInstance.setView([lat, lng], 16);
    }, 250);
  }

  _renderTimelineView(container) {
    const list = [...this.operations].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px;">
        <h3 style="margin:0 0 16px 0; font-size:0.95rem; font-weight:800; color:#fff;">🕒 المسار الزمني وسجل العمليات اللحظي</h3>
        ${list.length === 0 ? `
          <div class="woc-empty-state">لا توجد عمليات مسجلة في المسار الزمني</div>
        ` : `
          <div style="border-right:2px solid rgba(2,132,199,0.6); padding-right:18px; margin-right:8px;">
            ${list.map(op => `
              <div style="position:relative; margin-bottom:16px;">
                <div style="position:absolute; right:-24px; top:4px; width:10px; height:10px; border-radius:50%; background:#0284c7; border:2px solid #0f172a;"></div>
                <div class="woc-card" onclick="window.workOperationsCenterManager.openOperationModal('${op.id}')">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem;">
                    <span style="font-weight:bold; color:#38bdf8; font-family:monospace;">${op.task_number || op.id}</span>
                    <span style="color:#94a3b8;">${(op.created_at || '').replace('T', ' ').substring(0, 16)}</span>
                  </div>
                  <div style="font-weight:700; font-size:0.88rem; margin:4px 0; color:#f1f5f9;">${op.title}</div>
                  <div style="font-size:0.75rem; color:#94a3b8; display:flex; justify-content:space-between;">
                    <span>👤 المكلف: ${this._getUserName(op.assigned_to)}</span>
                    <span>الحالة: ${this._getStatusLabel(op.status)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  _renderAttachmentsGallery(container) {
    let allAtts = [];
    this.operations.forEach(op => {
      const atts = Array.isArray(op.attachments) ? op.attachments : (typeof op.attachments === 'string' ? JSON.parse(op.attachments || '[]') : []);
      atts.forEach(a => allAtts.push({ ...a, opTitle: op.title, opNumber: op.task_number || op.id, opId: op.id }));
    });

    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:0.95rem; font-weight:800; color:#fff;">📁 الأرشيف والمرفقات الميدانية الموحدة</h3>
          <span style="font-size:0.75rem; color:#94a3b8;">إجمالي الملفات الموثقة: ${allAtts.length}</span>
        </div>
        ${allAtts.length === 0 ? `
          <div class="woc-empty-state">
            <div style="font-size:2rem; margin-bottom:6px;">📸</div>
            <div>لا توجد مرفقات أو صور ميدانية مرفوعة حالياً</div>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
            ${allAtts.map(a => `
              <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:2rem; margin-bottom:4px;">📄</div>
                <div style="font-size:0.78rem; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${a.name}">${a.name}</div>
                <div style="font-size:0.68rem; color:#38bdf8; margin:3px 0;">العملية: ${a.opNumber}</div>
                <div style="display:flex; justify-content:center; gap:6px; margin-top:8px;">
                  <a href="${a.url}" target="_blank" class="btn btn-outline" style="padding:2px 8px; font-size:0.7rem; border-radius:4px;">معاينة</a>
                  <button class="btn btn-outline" onclick="window.workOperationsCenterManager.openOperationModal('${a.opId}')" style="padding:2px 8px; font-size:0.7rem; border-radius:4px;">فتح العملية</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  _renderReportsAndKPIs(container) {
    const s = this.stats;
    container.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px;">
        <h3 style="margin:0 0 14px 0; font-size:1rem; font-weight:800; color:#fff;">📈 مؤشرات الأداء التشغيلي الميداني والإنجاز الهندسي</h3>
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:0.8rem; color:#94a3b8;">نسبة الالتزام بالـ SLA</div>
            <div style="font-size:1.8rem; font-weight:800; color:#34d399; margin-top:4px;">${s.onTimeRate || 100}%</div>
          </div>

          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:0.8rem; color:#94a3b8;">إجمالي العمليات المنجزة</div>
            <div style="font-size:1.8rem; font-weight:800; color:#38bdf8; margin-top:4px;">${s.completedCount || 0}</div>
          </div>

          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px; text-align:center;">
            <div style="font-size:0.8rem; color:#94a3b8;">الاستدعيات المتأخرة</div>
            <div style="font-size:1.8rem; font-weight:800; color:#ef4444; margin-top:4px;">${s.overdueAppeals || 0}</div>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:14px; display:flex; justify-content:flex-end;">
          <button class="btn btn-primary" onclick="window.workOperationsCenterManager.exportExcel()" style="padding:8px 20px; font-weight:800; font-size:0.82rem; border-radius:8px;">
            📊 تصدير الكشف الإحصائي الشامل (Excel)
          </button>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════
     8. بطاقة متابعة وتوجيه العملية (Dynamic Routing & Modal)
     ══════════════════════════════════════════════════════════════════ */
  async openOperationModal(opId, defaultTab = 'details') {
    let op = this.operations.find(o => o.id === opId);
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}`);
      const json = await res.json();
      if (res.ok && json.data) op = json.data;
    } catch (e) {}

    if (!op) return;
    this.selectedOp = op;

    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');

    if (!modalBody || !modalOverlay) return;
    if (modal) modal.style.maxWidth = '900px';

    const notes = Array.isArray(op.notes_and_endorsements) 
      ? op.notes_and_endorsements 
      : (typeof op.notes_and_endorsements === 'string' ? JSON.parse(op.notes_and_endorsements || '[]') : []);

    modalTitle.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-size:1.2rem;">🏛️</span>
        <span style="font-weight:800;">معاملة واستدعاء رقم [${op.task_number || op.id}]</span>
        ${this._getStatusBadge(op.status)}
        ${this._getPriorityBadge(op.priority)}
        <span class="badge" style="background:rgba(2,132,199,0.15); color:#38bdf8; font-size:0.75rem; font-weight:bold; padding:2px 8px; border-radius:4px;">${this._getTaskTypeLabel(op.task_type)}</span>
      </div>
    `;

    modalBody.innerHTML = `
      <div style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text, #f1f5f9);">
        
        <!-- Summary Strip -->
        <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#fff;">${op.title}</h3>
            <div style="font-size:0.78rem; color:#94a3b8; margin-top:3px; display:flex; gap:14px; flex-wrap:wrap;">
              <span>📍 <b>الموقع:</b> ${op.location_name || 'بلدية كفرنجة'}</span>
              <span>👤 <b>المكلف الحالي:</b> <b style="color:#38bdf8;">${this._getUserName(op.assigned_to)}</b></span>
              <span>📅 <b>تاريخ الاستحقاق:</b> ${op.due_date || '—'}</span>
            </div>
          </div>
          <button class="btn btn-primary" onclick="window.workOperationsCenterManager.printOfficialReport('${op.id}')" style="font-size:0.82rem; padding:6px 14px; border-radius:6px; background:#0284c7; display:flex; align-items:center; gap:6px; font-weight:bold;">
            <span>🖨️</span> <span>طباعة التقرير الفني الشامل</span>
          </button>
        </div>

        <!-- 3 Primary Tabs -->
        <div style="display:flex; gap:6px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:14px; padding-bottom:6px;">
          <button class="btn btn-outline" id="woc-mtab-btn-details" onclick="window.workOperationsCenterManager.switchModalTab('details')" style="font-weight:bold; font-size:0.82rem; padding:7px 16px; border-radius:6px; background:rgba(2,132,199,0.15); border-color:#0284c7; color:#38bdf8;">
            📋 تفاصيل الاستدعاء والموقع
          </button>
          <button class="btn btn-outline" id="woc-mtab-btn-endorsements" onclick="window.workOperationsCenterManager.switchModalTab('endorsements')" style="font-weight:bold; font-size:0.82rem; padding:7px 16px; border-radius:6px;">
            📝 المشروحات والكشوفات والمرفقات (${notes.length})
          </button>
          <button class="btn btn-outline" id="woc-mtab-btn-finalize" onclick="window.workOperationsCenterManager.switchModalTab('finalize')" style="font-weight:bold; font-size:0.82rem; padding:7px 16px; border-radius:6px;">
            🏆 الاعتماد النهائي وتثبيت المعاملة
          </button>
        </div>

        <!-- Tab Content Body -->
        <div id="woc-modal-tab-content" style="min-height:280px;"></div>

        <!-- Footer -->
        <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:16px; padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; color:#64748b;">مركز العمل والمتابعة — مديرية الأشغال والخدمات الهندسية</span>
          <button class="btn btn-outline" onclick="window.workOperationsCenterManager.closeModal()" style="font-size:0.8rem; padding:6px 16px; border-radius:6px;">إغلاق النافذة</button>
        </div>
      </div>
    `;

    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('open');
    this.switchModalTab(defaultTab || 'details');
  }

  switchModalTab(tabName) {
    const pane = document.getElementById('woc-modal-tab-content');
    if (!pane || !this.selectedOp) return;
    const op = this.selectedOp;

    document.querySelectorAll('[id^="woc-mtab-btn-"]').forEach(b => {
      b.classList.remove('btn-primary');
      b.style.background = 'rgba(255,255,255,0.03)';
      b.style.borderColor = 'rgba(255,255,255,0.1)';
      b.style.color = '#fff';
    });
    const activeBtn = document.getElementById(`woc-mtab-btn-${tabName}`);
    if (activeBtn) {
      activeBtn.style.background = 'rgba(2,132,199,0.2)';
      activeBtn.style.borderColor = '#0284c7';
      activeBtn.style.color = '#38bdf8';
    }

    if (tabName === 'details') {
      pane.innerHTML = `
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:14px;">
          
          <!-- Column 1: Details & Appeal info -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px;">
            <div style="font-weight:800; font-size:0.88rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              <span>📄</span> بيانات الاستدعاء وموضوع المعاملة
            </div>

            <div style="margin-bottom:10px;">
              <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:2px;">تفاصيل الطلب / وصف المعاينة:</div>
              <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:10px; font-size:0.85rem; line-height:1.5; color:#e2e8f0; min-height:60px;">
                ${op.description || 'لا يوجد وصف تفصيلي مسجل'}
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.8rem; background:rgba(0,0,0,0.15); padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
              <div><span style="color:#94a3b8;">👤 مقدم الاستدعاء:</span> <b>${op.citizen_name || '—'}</b></div>
              <div><span style="color:#94a3b8;">📞 رقم الهاتف:</span> <b>${op.citizen_phone || '—'}</b></div>
              <div><span style="color:#94a3b8;">🔢 رقم الوارد/الاستدعاء:</span> <b>${op.appeal_number || '—'}</b></div>
              <div><span style="color:#94a3b8;">🔗 الكيان المرتبط:</span> <b style="color:#38bdf8;">${op.entity_name || op.entity_type || '—'}</b></div>
            </div>
          </div>

          <!-- Column 2: Location & Map -->
          <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px;">
            <div style="font-weight:800; font-size:0.88rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
              <span>📍 الموقع الجغرافي والإحداثيات</span>
              <span style="font-size:0.72rem; color:#34d399; font-family:monospace;">${(op.lat && op.lng) ? `${Number(op.lat).toFixed(5)}, ${Number(op.lng).toFixed(5)}` : 'غير محدد'}</span>
            </div>
            <div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:8px;">
              <b>الحي / الشارع:</b> ${op.location_name || 'كفرنجة'}
            </div>
            <div id="woc-modal-detail-map" style="width:100%; height:180px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); z-index:1;"></div>
          </div>
        </div>
      `;

      setTimeout(() => {
        const mapEl = document.getElementById('woc-modal-detail-map');
        if (mapEl && typeof L !== 'undefined') {
          const lat = parseFloat(op.lat) || 32.2985;
          const lng = parseFloat(op.lng) || 35.7050;
          const m = L.map('woc-modal-detail-map').setView([lat, lng], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
          L.marker([lat, lng]).addTo(m).bindPopup(`<b>${op.title}</b><br/>${op.location_name || 'كفرنجة'}`).openPopup();
          setTimeout(() => m.invalidateSize(), 200);
        }
      }, 150);

    } else if (tabName === 'endorsements') {
      const notes = Array.isArray(op.notes_and_endorsements) 
        ? op.notes_and_endorsements 
        : (typeof op.notes_and_endorsements === 'string' ? JSON.parse(op.notes_and_endorsements || '[]') : []);

      pane.innerHTML = `
        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:14px;">
          
          <!-- Column 1: Chronological Endorsements Log -->
          <div>
            <div style="font-weight:800; font-size:0.88rem; color:#fff; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>📜 سجل المشروحات والكشوفات السابقة (${notes.length})</span>
            </div>

            <div style="max-height:360px; overflow-y:auto; padding-left:4px;">
              ${notes.length === 0 ? `
                <div class="woc-empty-state" style="padding:30px; background:rgba(15,23,42,0.4); border-radius:8px;">
                  لا توجد مشروحات أو كشوفات مضافة بعد. يمكنك إضافة المشروحة والتنسيب الأول من النموذج المقابل ➔
                </div>
              ` : notes.map((n, idx) => `
                <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-right:4px solid #0284c7; border-radius:8px; padding:12px; margin-bottom:10px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-weight:800; font-size:0.85rem; color:#fff;">👤 ${n.userName}</span>
                      <span style="font-size:0.72rem; color:#38bdf8; background:rgba(2,132,199,0.15); padding:1px 6px; border-radius:4px;">[${n.userJobTitle || n.userRole}]</span>
                    </div>
                    <span style="font-size:0.72rem; color:#94a3b8;">📅 ${(n.createdAt || '').replace('T', ' ').substring(0, 16)}</span>
                  </div>

                  ${n.recommendation ? `
                    <div style="margin-bottom:6px;">
                      <span style="background:rgba(16,185,129,0.15); color:#34d399; font-size:0.75rem; font-weight:bold; padding:2px 8px; border-radius:4px; display:inline-block;">
                        🎯 التنسيب: ${n.recommendation}
                      </span>
                    </div>
                  ` : ''}

                  <div style="font-size:0.84rem; line-height:1.5; color:#e2e8f0; background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:6px; margin-bottom:8px;">
                    ${n.noteText || '—'}
                  </div>

                  <!-- Sub-Attachments attached directly to this note -->
                  ${(n.attachments && n.attachments.length > 0) ? `
                    <div style="border-top:1px dashed rgba(255,255,255,0.08); padding-top:6px; margin-top:6px;">
                      <div style="font-size:0.72rem; font-weight:700; color:#94a3b8; margin-bottom:4px;">📁 المرفقات والصور الملحقة (${n.attachments.length}):</div>
                      <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${n.attachments.map(att => `
                          <a href="${att.url}" target="_blank" style="text-decoration:none; background:rgba(2,132,199,0.1); border:1px solid rgba(2,132,199,0.3); color:#38bdf8; padding:3px 8px; border-radius:4px; font-size:0.72rem; display:inline-flex; align-items:center; gap:4px;">
                            <span>📎</span> <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${att.name}</span>
                          </a>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Column 2: New Endorsement Entry Form -->
          <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(2,132,199,0.3); border-radius:10px; padding:14px;">
            <div style="font-weight:800; font-size:0.88rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              <span>✍️</span> إضافة مشروحة / كشف هندسي وتنسيب جديد
            </div>

            <div style="margin-bottom:8px;">
              <label style="font-size:0.75rem; font-weight:700; color:#cbd5e1;">المشروحة والملاحظات الفنية والكشف الميداني *</label>
              <textarea id="woc-new-note-text" rows="3" placeholder="اكتب المشروحة الهندسية أو نتائج الكشف الميداني والملاحظات الفنية بالتفصيل..." style="width:100%; margin-top:2px; padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.82rem;"></textarea>
            </div>

            <div style="margin-bottom:8px;">
              <label style="font-size:0.75rem; font-weight:700; color:#cbd5e1;">نوع التنسيب / التوصية الهندسية</label>
              <select id="woc-new-note-rec" style="width:100%; margin-top:2px; padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.8rem; cursor:pointer;">
                <option value="تنسيب بالموافقة والتنفيذ">✅ تنسيب بالموافقة والتنفيذ</option>
                <option value="تنسيب بإجراء كشف ميداني ورفع قياسات">📐 تنسيب بإجراء كشف ميداني ورفع قياسات</option>
                <option value="تنسيب بطلب استكمال وثائق ومخططات من المستدعي">📄 تنسيب بطلب استكمال وثائق ومخططات</option>
                <option value="تنسيب بعدم الموافقة لمخالفة التعليمات">❌ تنسيب بعدم الموافقة لمخالفة التعليمات</option>
                <option value="إحالة للدراسة والتنسيق الهندسي">🔄 إحالة للدراسة والتنسيق الهندسي</option>
                <option value="ملاحظات توثيقية فقط">📝 ملاحظات توثيقية فقط</option>
              </select>
            </div>

            <div style="margin-bottom:8px;">
              <label style="font-size:0.75rem; font-weight:700; color:#cbd5e1;">المرفقات والصور الملحقة بالمشروحة</label>
              <input type="file" id="woc-new-note-files" multiple style="width:100%; margin-top:2px; padding:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.75rem;" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
              <div>
                <label style="font-size:0.72rem; font-weight:700; color:#cbd5e1;">المسار الإداري</label>
                <select id="woc-new-note-action" onchange="window.workOperationsCenterManager.onNoteActionChange(this.value)" style="width:100%; margin-top:2px; padding:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.75rem; font-weight:bold;">
                  <option value="NOTE_ONLY">مشروحة دون تحويل</option>
                  <option value="FORWARD">🔄 إحالة وتوجيه (Forward)</option>
                  <option value="SUBMIT">📤 رفع للاعتماد (Submit)</option>
                  <option value="ESCALATE">🚨 تصعيد للمدير (Escalate)</option>
                  <option value="RETURN">↩️ إرجاع للنواقص (Return)</option>
                </select>
              </div>
              <div id="woc-new-note-target-box" style="display:none;">
                <label style="font-size:0.72rem; font-weight:700; color:#cbd5e1;">المستلم المستهدف</label>
                <select id="woc-new-note-target" style="width:100%; margin-top:2px; padding:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.75rem;">
                  ${this._getHierarchyGroupedUsersOptions(op.assigned_to)}
                </select>
              </div>
            </div>

            <button class="btn btn-primary" onclick="window.workOperationsCenterManager.submitEndorsementNote('${op.id}')" style="width:100%; padding:8px; font-weight:800; font-size:0.82rem; border-radius:6px; background:#0284c7;">
              ➕ تثبيت المشروحة والتنسيب والمرفقات
            </button>
          </div>
        </div>
      `;

    } else if (tabName === 'finalize') {
      const decision = typeof op.final_decision === 'object' ? op.final_decision : (typeof op.final_decision === 'string' ? JSON.parse(op.final_decision || '{}') : {});
      const isFinalized = decision && decision.finalizedAt;

      pane.innerHTML = `
        <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
          <div style="font-weight:800; font-size:0.95rem; color:#38bdf8; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <span>🏆</span> قرار الاعتماد النهائي وتثبيت المعاملة الرسمية
          </div>

          ${isFinalized ? `
            <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:14px; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:800; font-size:0.9rem; color:#34d399;">✅ تم الاعتماد والتثبيت الرسمي للمعاملة</span>
                <span style="font-size:0.75rem; color:#94a3b8;">📅 ${(decision.finalizedAt || '').replace('T', ' ').substring(0, 16)}</span>
              </div>
              <div style="font-size:0.85rem; color:#fff; margin-bottom:4px;"><b>المعتمد:</b> ${decision.finalizedByName || 'مدير المديرية'}</div>
              <div style="font-size:0.85rem; color:#e2e8f0; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:6px;">
                <b>نص القرار:</b> ${decision.decisionText || '—'}
              </div>
            </div>
          ` : `
            <div style="font-size:0.78rem; color:#94a3b8; margin-bottom:14px;">
              يتم تثبيت المعاملة بعد استكمال كافة الكشوفات والمشروحات الهندسية من الكوادر الفنية والميدانية.
            </div>

            <div style="display:grid; grid-template-columns:1fr; gap:10px; max-width:650px;">
              <div>
                <label style="font-size:0.78rem; font-weight:700; color:#cbd5e1;">نص القرار والتوجيه النهائي للمديرية *</label>
                <textarea id="woc-final-decision-text" rows="3" placeholder="مثال: تمت الموافقة على التنسيبات الفنية الواردة في المشروحات، وتكليف قسم الصيانة بالتنفيذ الفوري..." style="width:100%; margin-top:2px; padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.82rem;"></textarea>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:0.78rem; font-weight:700; color:#cbd5e1;">حالة التثبيت النهائية</label>
                  <select id="woc-final-status" style="width:100%; margin-top:2px; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(30,41,59,0.8); color:#fff; font-size:0.82rem;">
                    <option value="completed">✅ معتمد ومنجز (Completed)</option>
                    <option value="closed">🔒 معتمد ومغلق نهائياً (Closed & Archived)</option>
                    <option value="returned">↩️ معادة للمراجعة (Returned)</option>
                  </select>
                </div>
              </div>

              <div style="margin-top:10px;">
                <button class="btn btn-primary" onclick="window.workOperationsCenterManager.submitFinalizeTransaction('${op.id}')" style="padding:8px 24px; font-weight:800; font-size:0.85rem; border-radius:6px; background:#10b981; border-color:#10b981;">
                  ✅ تثبيت واعتماد المعاملة نهائياً
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    }
  }

  onNoteActionChange(val) {
    const box = document.getElementById('woc-new-note-target-box');
    if (!box) return;
    if (val === 'NOTE_ONLY') {
      box.style.display = 'none';
    } else {
      box.style.display = 'block';
    }
  }

  async submitEndorsementNote(opId) {
    const textEl = document.getElementById('woc-new-note-text');
    const recEl = document.getElementById('woc-new-note-rec');
    const actionEl = document.getElementById('woc-new-note-action');
    const targetEl = document.getElementById('woc-new-note-target');
    const filesEl = document.getElementById('woc-new-note-files');

    const noteText = textEl ? textEl.value.trim() : '';
    const recommendation = recEl ? recEl.value : '';
    const actionType = actionEl ? actionEl.value : 'NOTE_ONLY';
    const targetUserId = targetEl ? targetEl.value : null;

    if (!noteText && (!filesEl || !filesEl.files || !filesEl.files.length)) {
      alert('يرجى كتابة نص المشروحة أو اختيار ملفات مرفقة');
      return;
    }

    const fd = new FormData();
    fd.append('noteText', noteText);
    fd.append('recommendation', recommendation);
    fd.append('actionType', actionType);
    if (targetUserId) fd.append('targetUserId', targetUserId);

    if (filesEl && filesEl.files) {
      for (let i = 0; i < filesEl.files.length; i++) {
        fd.append('files', filesEl.files[i]);
      }
    }

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/endorsement`, {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('✅ تم حفظ المشروحة والتنسيب والمرفقات بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
        setTimeout(() => this.switchModalTab('endorsements'), 100);
      } else {
        alert('خطأ: ' + (json.error || 'فشل الحفظ'));
      }
    } catch (e) {
      alert('فشل الاتصال: ' + e.message);
    }
  }

  async submitFinalizeTransaction(opId) {
    const textEl = document.getElementById('woc-final-decision-text');
    const statusEl = document.getElementById('woc-final-status');
    const decisionText = textEl ? textEl.value.trim() : '';
    const decisionStatus = statusEl ? statusEl.value : 'completed';

    if (!decisionText) {
      alert('يرجى كتابة نص القرار والتوجيه النهائي');
      return;
    }

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/finalize`, {
        method: 'POST',
        body: { decisionText, decisionStatus }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('✅ تم تثبيت واعتماد المعاملة بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
        setTimeout(() => this.switchModalTab('finalize'), 100);
      } else {
        alert('خطأ: ' + (json.error || 'فشل الاعتماد'));
      }
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  }

  _getHierarchyGroupedUsersOptions(selectedUserId = '') {
    const list = Array.isArray(this.usersList) ? this.usersList : [];
    
    // المستوى 1: الإدارة العامة والمديرية
    const directorate = list.filter(u => u.role === 'admin' || u.role === 'director_public_works' || u.id === 'U-002');
    // المستوى 2 & 3 & 4: قسم الطرق والبنية التحتية
    const roads = list.filter(u => 
      u.role === 'head_of_roads' || 
      u.role === 'roads_engineer' || 
      (u.role === 'site_inspector' && ((u.department || '').includes('طرق') || !u.department)) ||
      (u.id === 'U-003' || u.id === 'U-005' || u.id === 'U-008')
    );
    // المستوى 2 & 3 & 4: قسم الأبنية والإنشاءات
    const buildings = list.filter(u => 
      u.role === 'head_of_buildings' || 
      u.role === 'buildings_engineer' || 
      u.role === 'quantity_surveyor' ||
      (u.id === 'U-004' || u.id === 'U-006' || u.id === 'U-007')
    );
    // المستوى 2 & 3: قسم الكهرباء والطاقة المتجددة
    const energy = list.filter(u => 
      u.role === 'head_of_electricity_energy' || 
      u.role === 'electrical_engineer' || 
      u.role === 'renewable_energy_engineer' || 
      u.role === 'electrical_works_inspector' || 
      u.role === 'electrical_technician' ||
      u.id === 'U-011'
    );
    // المستوى 3 & 4: شعبة ضبط الجودة والمساحة العامة
    const qualitySurvey = list.filter(u => 
      u.role === 'qa_qc_engineer' || 
      u.role === 'land_surveyor' ||
      u.id === 'U-009' || u.id === 'U-010'
    );

    const renderGroup = (users) => {
      // إزالة التكرار
      const seen = new Set();
      const unique = users.filter(u => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });
      return unique.map(u => {
        const isSel = u.id === selectedUserId ? 'selected' : '';
        const titleBadge = u.job_title || u.role || 'موظف';
        return `<option value="${u.id}" ${isSel}>${u.fullName || u.username} — [${titleBadge}]</option>`;
      }).join('');
    };

    let html = `<option value="">-- اختر المكلف / المستلم حسب التسلسل الإداري --</option>`;
    if (directorate.length) {
      html += `<optgroup label="🏛️ الإدارة العليا — مديرية الأشغال والخدمات الهندسية">${renderGroup(directorate)}</optgroup>`;
    }
    if (roads.length) {
      html += `<optgroup label="🛣️ قسم الطرق والبنية التحتية (رئيس القسم ➔ المهندس ➔ المراقب)">${renderGroup(roads)}</optgroup>`;
    }
    if (buildings.length) {
      html += `<optgroup label="🏛️ قسم الأبنية والإنشاءات (رئيس القسم ➔ المهندسة ➔ حاسب الكميات)">${renderGroup(buildings)}</optgroup>`;
    }
    if (energy.length) {
      html += `<optgroup label="⚡ قسم الكهرباء والطاقة المتجددة (مهندس الكهرباء والطاقة)">${renderGroup(energy)}</optgroup>`;
    }
    if (qualitySurvey.length) {
      html += `<optgroup label="🔍 الكوادر الفنية (ضبط الجودة ➔ المساحة العامة)">${renderGroup(qualitySurvey)}</optgroup>`;
    }
    return html;
  }

  onRouteChangeAction(action) {
    const targetGroup = document.getElementById('woc-target-user-group');
    const targetSelect = document.getElementById('woc-route-target-user');
    if (!targetGroup) return;

    if (['ACCEPT', 'APPROVE', 'REJECT', 'VERIFY', 'CLOSE'].includes(action)) {
      targetGroup.style.display = 'none';
    } else {
      targetGroup.style.display = 'block';
      if (targetSelect && this.selectedOp) {
        if (action === 'ESCALATE') {
          // تصعيد افتراضي للمدير أو رئيس القسم
          targetSelect.value = 'U-002'; // م. محمد الفريحات (المدير)
        } else if (action === 'SUBMIT') {
          // رفع للاعتماد لرئيس قسم الطرق أو الأبنية
          const dept = (this.selectedOp.department_id || this.selectedOp.entity_type || '').toLowerCase();
          if (dept.includes('build') || dept.includes('asset')) {
            targetSelect.value = 'U-004'; // رئيس قسم الأبنية
          } else {
            targetSelect.value = 'U-003'; // رئيس قسم الطرق
          }
        } else if (action === 'RETURN') {
          // إرجاع للمنشئ أو المكلف الأصلي
          targetSelect.value = this.selectedOp.created_by || this.selectedOp.assigned_to || '';
        }
      }
    }
  }

  _renderQuickActionButtons(op) {
    let html = '';
    const myId = this._user?.id || '';
    const isMine = op.assigned_to === myId;

    if (op.status === 'new' || op.status === 'assigned') {
      html += `<button class="btn btn-primary" onclick="window.workOperationsCenterManager.quickAction('${op.id}', 'START', 'بدء التنفيذ الميداني')" style="font-size:0.8rem; padding:6px 14px; border-radius:6px;">▶️ بدء التنفيذ</button>`;
    }
    if (op.status === 'in_progress') {
      html += `<button class="btn btn-primary" style="background:#ec4899; border-color:#ec4899; font-size:0.8rem; padding:6px 14px; border-radius:6px;" onclick="window.workOperationsCenterManager.quickAction('${op.id}', 'SUBMIT', 'تقديم للاعتماد')">📤 تقديم للاعتماد</button>`;
    }
    if (op.status === 'under_review' && (this.isAdmin || this._user?.role?.startsWith('head_of_'))) {
      html += `<button class="btn btn-primary" style="background:#10b981; border-color:#10b981; font-size:0.8rem; padding:6px 14px; border-radius:6px;" onclick="window.workOperationsCenterManager.quickAction('${op.id}', 'APPROVE', 'اعتماد وإنجاز')">✅ اعتماد رسمي</button>`;
      html += `<button class="btn btn-outline" style="color:#ef4444; border-color:#ef4444; font-size:0.8rem; padding:6px 14px; border-radius:6px;" onclick="window.workOperationsCenterManager.quickAction('${op.id}', 'RETURN', 'إرجاع للتعديل')">↩️ إرجاع</button>`;
    }
    return html;
  }

  async quickAction(opId, action, defaultRemark = '') {
    const remark = prompt(`تأكيد الإجراء [${action}]:`, defaultRemark);
    if (remark === null) return;
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/route`, {
        method: 'POST',
        body: { action, remarks: remark }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || 'تم تنفيذ الإجراء بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
        this.renderCurrentTab();
      } else {
        alert('رفض من Authorization Engine: ' + (json.error || 'غير مصرح'));
      }
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  }

  async submitRoutingAction(opId) {
    const actionEl = document.getElementById('woc-route-action');
    const targetUserEl = document.getElementById('woc-route-target-user');
    const remarksEl = document.getElementById('woc-route-remarks');

    const action = actionEl ? actionEl.value : 'FORWARD';
    const targetUserId = targetUserEl ? targetUserEl.value : null;
    const remarks = remarksEl ? remarksEl.value.trim() : '';

    if (['ASSIGN', 'REASSIGN', 'FORWARD', 'DELEGATE'].includes(action) && !targetUserId) {
      alert('يرجى اختيار المستخدم المستهدف بالتحويل أولاً');
      return;
    }

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/route`, {
        method: 'POST',
        body: { action, targetUserId, remarks }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || 'تم توجيه العملية بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
        this.renderCurrentTab();
      } else {
        alert('⛔ رفض الإجراء (Authorization Engine): ' + (json.error || 'غير مصرح'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم: ' + err.message);
    }
  }

  async saveFieldReport(opId) {
    const completionPercentage = parseInt(document.getElementById('woc-rpt-num')?.value || '100', 10);
    const laborAndMachinery = document.getElementById('woc-rpt-labor')?.value || '';
    const materialsAndQuantities = document.getElementById('woc-rpt-qty')?.value || '';
    const fieldNotes = document.getElementById('woc-rpt-notes')?.value || '';

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/field-report`, {
        method: 'POST',
        body: { completionPercentage, laborAndMachinery, materialsAndQuantities, fieldNotes }
      });
      const json = await res.json();
      if (json.success) {
        alert('✅ تم حفظ وتوثيق التقرير الميداني بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
      } else {
        alert('خطأ: ' + (json.error || 'فشل الحفظ'));
      }
    } catch (e) {
      alert('فشل حفظ التقرير: ' + e.message);
    }
  }

  async submitComment(opId) {
    const input = document.getElementById('woc-modal-comment-input');
    if (!input || !input.value.trim()) return;
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/comments`, {
        method: 'POST',
        body: { text: input.value.trim() }
      });
      const json = await res.json();
      if (json.success) {
        input.value = '';
        await this.fetchData();
        this.openOperationModal(opId);
      }
    } catch (e) {}
  }

  async addSubtaskPrompt(opId) {
    const title = prompt('أدخل عنوان الخطوة الفرعية الجديدة:');
    if (!title || !title.trim()) return;
    const op = this.selectedOp;
    const currentSubs = Array.isArray(op.subtasks) ? op.subtasks : (typeof op.subtasks === 'string' ? JSON.parse(op.subtasks || '[]') : []);
    currentSubs.push({ id: `SUB-${Date.now()}`, title: title.trim(), completed: false });

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/subtasks`, {
        method: 'POST',
        body: { subtasks: currentSubs }
      });
      const json = await res.json();
      if (json.success) {
        await this.fetchData();
        this.openOperationModal(opId);
      }
    } catch (e) {}
  }

  async toggleSubtask(opId, idx, completed) {
    const op = this.selectedOp;
    const currentSubs = Array.isArray(op.subtasks) ? op.subtasks : (typeof op.subtasks === 'string' ? JSON.parse(op.subtasks || '[]') : []);
    if (!currentSubs[idx]) return;
    currentSubs[idx].completed = completed;
    try {
      await this._apiFetch(`/api/v4/operations-center/${opId}/subtasks`, {
        method: 'POST',
        body: { subtasks: currentSubs }
      });
      await this.fetchData();
    } catch (e) {}
  }

  async uploadAttachments(opId, files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/attachments`, {
        method: 'POST',
        body: fd
      });
      const json = await res.json();
      if (json.success) {
        alert('✅ تم رفع المرفقات بنجاح');
        await this.fetchData();
        this.openOperationModal(opId);
      } else {
        alert('خطأ: ' + (json.error || 'فشل الرفع'));
      }
    } catch (e) {
      alert('فشل رفع الملفات: ' + e.message);
    }
  }

  async deleteAttachment(opId, attId) {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}/attachments/${attId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.success) {
        await this.fetchData();
        this.openOperationModal(opId);
      }
    } catch (e) {}
  }

  openNewOperationModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');

    if (!modalBody || !modalOverlay) return;
    if (modal) modal.style.maxWidth = '720px';

    modalTitle.innerHTML = `<span>➕</span> <span>تكليف وتسجيل عملية جديدة — مركز العمل والمتابعة</span>`;

    modalBody.innerHTML = `
      <form id="woc-form-new" onsubmit="window.workOperationsCenterManager.submitNewOperation(event)" style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text,#f1f5f9);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="grid-column:1/-1;">
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">عنوان العمل / الإجراء المطلوب *</label>
            <input type="text" id="nwoc-title" required placeholder="مثال: كشف فني على جدار استنادي آيل للسقوط" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">نوع العملية *</label>
            <select id="nwoc-type" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              <option value="technical">كشف فني وهندسي</option>
              <option value="executive_field">تنفيذي ميداني / صيانة</option>
              <option value="supervisory">رقابي / ضبط جودة</option>
              <option value="emergency">طوارئ وسلامة عامة</option>
              <option value="citizen_appeal">استدعاء مواطن / بلاغ</option>
              <option value="administrative">إداري ومتابعة</option>
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">الأولوية *</label>
            <select id="nwoc-priority" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              <option value="medium">متوسطة</option>
              <option value="high">عالية (مستعجل)</option>
              <option value="critical">🚨 حرجة (طوارئ فورية)</option>
              <option value="low">منخفضة</option>
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">المكلف بالعمل (حسب التسلسل الإداري)</label>
            <select id="nwoc-assignee" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              ${this._getHierarchyGroupedUsersOptions()}
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">تاريخ الاستحقاق</label>
            <input type="date" id="nwoc-duedate" value="${new Date(Date.now() + 48*3600*1000).toISOString().split('T')[0]}" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">الارتباط بكيان</label>
            <select id="nwoc-entitytype" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              <option value="">-- غير مرتبط بكيان --</option>
              <option value="roads">شبكة الطرق (Roads)</option>
              <option value="projects">المشاريع الرأسمالية (Projects)</option>
              <option value="tenders">العطاءات (Tenders)</option>
              <option value="contracts">العقود (Contracts)</option>
              <option value="structural_assets">الأبنية والجدران (Assets)</option>
              <option value="energy_assets">شبكات الإنارة (Energy)</option>
              <option value="excavation_permits">تصاريح الحفر (Permits)</option>
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">الموقع / الحي / الشارع</label>
            <input type="text" id="nwoc-location" placeholder="مثال: حي الصوان، شارع المستشفى" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div style="grid-column:1/-1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <label style="font-weight:700; font-size:0.8rem; color:#38bdf8;">🗺️ تحديد الموقع على الخريطة:</label>
              <span id="nwoc-coords" style="font-size:0.72rem; color:#34d399; font-family:monospace;">إحداثيات: 32.2985, 35.7050</span>
            </div>
            <input type="hidden" id="nwoc-lat" value="32.2985" />
            <input type="hidden" id="nwoc-lng" value="35.7050" />
            <div id="modal-woc-map" style="width:100%; height:150px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); z-index:1;"></div>
          </div>

          <div style="grid-column:1/-1;">
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">تفاصيل العمل والتوجيهات</label>
            <textarea id="nwoc-desc" rows="2" placeholder="أدخل تفاصيل التكليف والمعاينة المطلوبة..." style="width:100%; margin-top:2px; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.8rem;"></textarea>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
          <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.closeModal()" style="font-size:0.8rem; padding:6px 14px; border-radius:6px;">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="padding:6px 20px; font-weight:800; font-size:0.82rem; border-radius:6px; background:#0284c7;">تثبيت وتكليف العملية 🚀</button>
        </div>
      </form>
    `;

    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('open');

    setTimeout(() => {
      this._initModalPickerMap();
    }, 200);
  }

  _initModalPickerMap() {
    const mapEl = document.getElementById('modal-woc-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (this.modalMapInstance) {
      try { this.modalMapInstance.remove(); } catch (e) {}
      this.modalMapInstance = null;
    }

    const defaultLat = 32.2985;
    const defaultLng = 35.7050;

    this.modalMapInstance = L.map('modal-woc-map').setView([defaultLat, defaultLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(this.modalMapInstance);

    this.modalMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(this.modalMapInstance);

    const updateCoords = (lat, lng) => {
      const latEl = document.getElementById('nwoc-lat');
      const lngEl = document.getElementById('nwoc-lng');
      if (latEl) latEl.value = lat.toFixed(6);
      if (lngEl) lngEl.value = lng.toFixed(6);
      const display = document.getElementById('nwoc-coords');
      if (display) display.textContent = `إحداثيات: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    };

    this.modalMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateCoords(pos.lat, pos.lng);
    });

    this.modalMapInstance.on('click', (e) => {
      this.modalMarker.setLatLng(e.latlng);
      updateCoords(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      if (this.modalMapInstance) this.modalMapInstance.invalidateSize();
    }, 150);
  }

  async submitNewOperation(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const title = document.getElementById('nwoc-title')?.value;
    if (!title || !title.trim()) {
      alert('يرجى إدخال عنوان العمل المطلوب');
      return;
    }

    const payload = {
      title: title.trim(),
      task_type: document.getElementById('nwoc-type')?.value || 'technical',
      priority: document.getElementById('nwoc-priority')?.value || 'medium',
      assigned_to: document.getElementById('nwoc-assignee')?.value || null,
      due_date: document.getElementById('nwoc-duedate')?.value || null,
      entity_type: document.getElementById('nwoc-entitytype')?.value || null,
      location_name: document.getElementById('nwoc-location')?.value?.trim() || 'بلدية كفرنجة الجديدة',
      lat: parseFloat(document.getElementById('nwoc-lat')?.value) || 32.2985,
      lng: parseFloat(document.getElementById('nwoc-lng')?.value) || 35.7050,
      description: document.getElementById('nwoc-desc')?.value?.trim() || ''
    };

    try {
      const res = await this._apiFetch('/api/v4/operations-center', {
        method: 'POST',
        body: payload
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || 'تم إنشاء وتسجيل العملية بنجاح');
        this.closeModal();
        await this.fetchData();
        this.renderCurrentTab();
      } else {
        alert('خطأ: ' + (json.error || 'فشل الحفظ'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم: ' + err.message);
    }
  }

  async openEditOperationModal(opId) {
    let op = this.operations.find(o => o.id === opId);
    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}`);
      const json = await res.json();
      if (res.ok && json.data) op = json.data;
    } catch (e) {}

    if (!op) return;

    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');

    if (!modalBody || !modalOverlay) return;
    if (modal) modal.style.maxWidth = '720px';

    modalTitle.innerHTML = `<span>✏️</span> <span>تعديل بيانات المعاملة [${op.task_number || op.id}]</span>`;

    modalBody.innerHTML = `
      <form id="woc-form-edit" onsubmit="window.workOperationsCenterManager.submitEditOperation(event, '${op.id}')" style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text,#f1f5f9);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="grid-column:1/-1;">
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">عنوان العمل / الإجراء المطلوب *</label>
            <input type="text" id="ewoc-title" required value="${op.title || ''}" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">نوع العملية *</label>
            <select id="ewoc-type" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              <option value="technical" ${op.task_type === 'technical' ? 'selected' : ''}>كشف فني وهندسي</option>
              <option value="executive_field" ${op.task_type === 'executive_field' ? 'selected' : ''}>تنفيذي ميداني / صيانة</option>
              <option value="supervisory" ${op.task_type === 'supervisory' ? 'selected' : ''}>رقابي / ضبط جودة</option>
              <option value="emergency" ${op.task_type === 'emergency' ? 'selected' : ''}>طوارئ وسلامة عامة</option>
              <option value="citizen_appeal" ${op.task_type === 'citizen_appeal' || op.task_type === 'appeal' ? 'selected' : ''}>استدعاء مواطن / بلاغ</option>
              <option value="administrative" ${op.task_type === 'administrative' ? 'selected' : ''}>إداري ومتابعة</option>
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">الأولوية *</label>
            <select id="ewoc-priority" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              <option value="medium" ${op.priority === 'medium' ? 'selected' : ''}>متوسطة</option>
              <option value="high" ${op.priority === 'high' ? 'selected' : ''}>عالية (مستعجل)</option>
              <option value="critical" ${op.priority === 'critical' ? 'selected' : ''}>🚨 حرجة (طوارئ فورية)</option>
              <option value="low" ${op.priority === 'low' ? 'selected' : ''}>منخفضة</option>
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">المكلف بالعمل (حسب التسلسل الإداري)</label>
            <select id="ewoc-assignee" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem; cursor:pointer;">
              ${this._getHierarchyGroupedUsersOptions(op.assigned_to)}
            </select>
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">تاريخ الاستحقاق</label>
            <input type="date" id="ewoc-duedate" value="${op.due_date ? op.due_date.split('T')[0] : ''}" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">اسم مقدم الاستدعاء</label>
            <input type="text" id="ewoc-citizen-name" value="${op.citizen_name || ''}" placeholder="اسم المواطن أو الجهة المستدعية" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">هاتف المستدعي</label>
            <input type="text" id="ewoc-citizen-phone" value="${op.citizen_phone || ''}" placeholder="07xxxxxxxx" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">رقم الاستدعاء / الوارد</label>
            <input type="text" id="ewoc-appeal-num" value="${op.appeal_number || ''}" placeholder="رقم وتاريخ الاستدعاء" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div>
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">الموقع / الحي / الشارع</label>
            <input type="text" id="ewoc-location" value="${op.location_name || ''}" placeholder="مثال: حي الصوان، شارع المستشفى" style="width:100%; margin-top:2px; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.82rem;" />
          </div>

          <div style="grid-column:1/-1;">
            <label style="font-weight:700; font-size:0.8rem; color:#cbd5e1;">تفاصيل العمل والتوجيهات</label>
            <textarea id="ewoc-desc" rows="3" placeholder="أدخل تفاصيل التكليف والمعاينة المطلوبة..." style="width:100%; margin-top:2px; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.6); color:#fff; font-size:0.8rem;">${op.description || ''}</textarea>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
          <button type="button" class="btn btn-outline" onclick="window.workOperationsCenterManager.closeModal()" style="font-size:0.8rem; padding:6px 14px; border-radius:6px;">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="padding:6px 20px; font-weight:800; font-size:0.82rem; border-radius:6px; background:#f59e0b; border-color:#f59e0b; color:#fff;">حفظ التعديلات 💾</button>
        </div>
      </form>
    `;

    modalOverlay.style.display = 'flex';
    modalOverlay.classList.add('open');
  }

  async submitEditOperation(e, opId) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const title = document.getElementById('ewoc-title')?.value;
    if (!title || !title.trim()) {
      alert('يرجى إدخال عنوان العمل');
      return;
    }

    const payload = {
      title: title.trim(),
      task_type: document.getElementById('ewoc-type')?.value || 'technical',
      priority: document.getElementById('ewoc-priority')?.value || 'medium',
      assigned_to: document.getElementById('ewoc-assignee')?.value || null,
      due_date: document.getElementById('ewoc-duedate')?.value || null,
      citizen_name: document.getElementById('ewoc-citizen-name')?.value?.trim() || null,
      citizen_phone: document.getElementById('ewoc-citizen-phone')?.value?.trim() || null,
      appeal_number: document.getElementById('ewoc-appeal-num')?.value?.trim() || null,
      location_name: document.getElementById('ewoc-location')?.value?.trim() || 'بلدية كفرنجة',
      description: document.getElementById('ewoc-desc')?.value?.trim() || ''
    };

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}`, {
        method: 'PUT',
        body: payload
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('✅ تم تحديث بيانات المعاملة بنجاح');
        this.closeModal();
        await this.fetchData();
        this.renderCurrentTab();
      } else {
        alert('خطأ: ' + (json.error || 'فشل التعديل'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم: ' + err.message);
    }
  }

  async deleteOperation(opId) {
    const op = this.operations.find(o => o.id === opId);
    const title = op ? `[${op.task_number || op.id}] ${op.title}` : opId;
    if (!confirm(`هل أنت متأكد تماماً من رغبتك في حذف المعاملة:\n${title}\n\nتحذير: سيتم حذف كافة المشروحات والمرفقات المرتبطة بها.`)) {
      return;
    }

    try {
      const res = await this._apiFetch(`/api/v4/operations-center/${opId}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert('✅ تم حذف المعاملة بنجاح');
        await this.fetchData();
        this.renderCurrentTab();
      } else {
        alert('خطأ: ' + (json.error || 'فشل الحذف'));
      }
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  }

  _canEdit(op) {
    if (!this._user) return true;
    if (this.isAdmin || this._user.role === 'admin' || this._user.role === 'super_admin' || this._user.role === 'director_public_works') return true;
    if (op.assigned_to === this._user.id || op.created_by === this._user.id) return true;
    const perms = this._user.permissions || [];
    return perms.includes('tasks.edit') || perms.includes('OPERATIONS.EDIT') || (this._user.role && this._user.role.startsWith('head_of_'));
  }

  _canDelete(op) {
    if (!this._user) return false;
    if (this.isAdmin || this._user.role === 'admin' || this._user.role === 'super_admin' || this._user.role === 'director_public_works') return true;
    const perms = this._user.permissions || [];
    return perms.includes('tasks.delete') || perms.includes('OPERATIONS.DELETE');
  }

  toggleActionMenu(e, opId) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const menu = document.getElementById(`woc-menu-${opId}`);
    const isVisible = menu && menu.style.display === 'block';
    this.closeAllMenus();
    if (!isVisible && menu) {
      menu.style.display = 'block';
    }
  }

  closeAllMenus() {
    document.querySelectorAll('.woc-action-dropdown').forEach(m => m.style.display = 'none');
  }

  printOfficialReport(opId) {
    const op = this.operations.find(o => o.id === opId) || this.selectedOp;
    if (!op) return;

    const notes = Array.isArray(op.notes_and_endorsements) 
      ? op.notes_and_endorsements 
      : (typeof op.notes_and_endorsements === 'string' ? JSON.parse(op.notes_and_endorsements || '[]') : []);

    const atts = Array.isArray(op.attachments) 
      ? op.attachments 
      : (typeof op.attachments === 'string' ? JSON.parse(op.attachments || '[]') : []);

    const decision = typeof op.final_decision === 'object' 
      ? op.final_decision 
      : (typeof op.final_decision === 'string' ? JSON.parse(op.final_decision || '{}') : {});

    const dateStr = new Date().toLocaleDateString('ar-JO');

    const printHtml = `
      <div style="direction:rtl; font-family:'Tajawal',Arial,sans-serif; color:#0f172a; padding:25px; line-height:1.6; max-width:900px; margin:0 auto;">
        
        <!-- Official Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px double #0f172a; padding-bottom:12px; margin-bottom:16px;">
          <div style="text-align:right;">
            <div style="font-weight:900; font-size:13pt;">المملكة الأردنية الهاشمية</div>
            <div style="font-weight:900; font-size:14pt; color:#0284c7;">بلدية كفرنجة الجديدة</div>
            <div style="font-size:11pt; font-weight:bold;">مديرية الأشغال والخدمات الهندسية</div>
            <div style="font-size:9.5pt; color:#475569;">مركز العمل والمتابعة — التقرير الفني الموحد</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:28pt;">🏛️</div>
            <div style="font-weight:bold; font-size:12pt; margin-top:2px;">بطاقة كشف ومعاملة رسمية</div>
          </div>
          <div style="text-align:left; font-size:10pt;">
            <div><b>رقم المعاملة:</b> <span style="font-family:monospace; font-size:11pt; color:#0284c7;">${op.task_number || op.id}</span></div>
            <div><b>رقم الاستدعاء:</b> ${op.appeal_number || '—'}</div>
            <div><b>تاريخ التقرير:</b> ${dateStr}</div>
            <div><b>حالة المعاملة:</b> ${this._getStatusLabel(op.status)}</div>
          </div>
        </div>

        <!-- 1. General Info Table -->
        <div style="margin-bottom:14px;">
          <div style="font-weight:bold; font-size:11pt; background:#0f172a; color:#fff; padding:4px 10px; border-radius:4px 4px 0 0;">
            أولاً: بيانات الاستدعاء وموضوع المعاملة والموقع
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5pt; border:1px solid #cbd5e1;" border="1">
            <tr style="background:#f8fafc;">
              <td style="padding:6px 8px; font-weight:bold; width:20%;">موضوع المعاملة</td>
              <td style="padding:6px 8px;" colspan="3"><b>${op.title}</b></td>
            </tr>
            <tr>
              <td style="padding:6px 8px; font-weight:bold;">مقدم الاستدعاء</td>
              <td style="padding:6px 8px;">${op.citizen_name || '—'} ${op.citizen_phone ? `(${op.citizen_phone})` : ''}</td>
              <td style="padding:6px 8px; font-weight:bold; width:18%;">نوع العمل</td>
              <td style="padding:6px 8px;">${this._getTaskTypeLabel(op.task_type)}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:6px 8px; font-weight:bold;">الموقع الميداني</td>
              <td style="padding:6px 8px;">${op.location_name || 'كفرنجة'} ${(op.lat && op.lng) ? `[إحداثيات: ${Number(op.lat).toFixed(4)}, ${Number(op.lng).toFixed(4)}]` : ''}</td>
              <td style="padding:6px 8px; font-weight:bold;">الكيان المرتبط</td>
              <td style="padding:6px 8px;">${op.entity_name || op.entity_type || '—'}</td>
            </tr>
            <tr>
              <td style="padding:6px 8px; font-weight:bold;">وصف الطلب الأصلي</td>
              <td style="padding:6px 8px;" colspan="3">${op.description || 'لا يوجد وصف مدخل'}</td>
            </tr>
          </table>
        </div>

        <!-- 2. Endorsements & Inspections Table -->
        <div style="margin-bottom:14px;">
          <div style="font-weight:bold; font-size:11pt; background:#0f172a; color:#fff; padding:4px 10px; border-radius:4px 4px 0 0;">
            ثانياً: سجل المشروحات والكشوفات والتنسيبات الهندسية (المسار الإداري)
          </div>
          ${notes.length === 0 ? `
            <div style="padding:10px; border:1px solid #cbd5e1; font-size:10pt; color:#64748b; text-align:center;">
              لا توجد مشروحات مسجلة
            </div>
          ` : `
            <table style="width:100%; border-collapse:collapse; font-size:10pt; border:1px solid #cbd5e1;" border="1">
              <thead>
                <tr style="background:#e2e8f0; font-weight:bold; text-align:center;">
                  <th style="padding:6px; width:5%;">#</th>
                  <th style="padding:6px; width:24%;">الموظف / المهندس المختص</th>
                  <th style="padding:6px; width:45%;">المشروحة والكشف الفني والتوصيات</th>
                  <th style="padding:6px; width:26%;">التنسيب الهندسي والتوقيع</th>
                </tr>
              </thead>
              <tbody>
                ${notes.map((n, i) => `
                  <tr>
                    <td style="padding:6px; text-align:center; font-weight:bold;">${i + 1}</td>
                    <td style="padding:6px;">
                      <b>${n.userName}</b><br/>
                      <span style="font-size:9pt; color:#475569;">${n.userJobTitle || n.userRole} (${n.department || 'مديرية الأشغال'})</span><br/>
                      <span style="font-size:8.5pt; color:#64748b;">📅 ${(n.createdAt || '').replace('T', ' ').substring(0, 16)}</span>
                    </td>
                    <td style="padding:6px; line-height:1.4;">
                      ${n.noteText || '—'}
                      ${(n.attachments && n.attachments.length > 0) ? `
                        <div style="margin-top:4px; font-size:8.5pt; color:#0284c7;">
                          <b>مرفقات المشروحة:</b> ${n.attachments.map(a => a.name).join('، ')}
                        </div>
                      ` : ''}
                    </td>
                    <td style="padding:6px; vertical-align:top;">
                      <div style="font-weight:bold; color:#0f172a; margin-bottom:14px;">${n.recommendation || '—'}</div>
                      <div style="font-size:8.5pt; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:4px;">
                        التوقيع: .....................
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- 3. Attached Documents & Annexes -->
        ${atts.length > 0 ? `
          <div style="margin-bottom:14px;">
            <div style="font-weight:bold; font-size:11pt; background:#0f172a; color:#fff; padding:4px 10px; border-radius:4px 4px 0 0;">
              ثالثاً: ملاحق الوثائق والمخططات والصور الميدانية المرفقة
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:9.5pt; border:1px solid #cbd5e1;" border="1">
              <thead>
                <tr style="background:#f1f5f9; font-weight:bold;">
                  <th style="padding:5px; width:6%; text-align:center;">#</th>
                  <th style="padding:5px;">اسم الملف / المخطط / الصورة</th>
                  <th style="padding:5px; width:25%;">بواسطة</th>
                  <th style="padding:5px; width:20%;">تاريخ الإرفاق</th>
                </tr>
              </thead>
              <tbody>
                ${atts.map((a, idx) => `
                  <tr>
                    <td style="padding:5px; text-align:center;">${idx + 1}</td>
                    <td style="padding:5px;"><b>${a.name}</b></td>
                    <td style="padding:5px;">${a.uploadedByName || this._getUserName(a.uploadedBy)}</td>
                    <td style="padding:5px;">${(a.uploadedAt || '').replace('T', ' ').substring(0, 16)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- 4. Final Decision & Endorsement -->
        <div style="margin-bottom:18px; border:2px solid #0f172a; border-radius:6px; padding:10px 14px; background:#f8fafc;">
          <div style="font-weight:bold; font-size:11pt; color:#0f172a; margin-bottom:4px; border-bottom:1px solid #cbd5e1; padding-bottom:4px;">
            رابعاً: قرار الاعتماد النهائي والتثبيت التنفيذي لمديرية الأشغال
          </div>
          <div style="font-size:10.5pt; line-height:1.5; color:#0f172a; min-height:40px; margin-top:6px;">
            ${decision.decisionText || 'بناءً على الكشوفات والمشروحات والتنسيبات الفنية الواردة أعلاه، تمت الموافقة والاعتماد للتنفيذ وفق الأصول الفنية والقانونية المعتمدة.'}
          </div>
          ${decision.finalizedAt ? `
            <div style="font-size:9pt; color:#64748b; margin-top:6px; text-align:left;">
              اعتمد بتاريخ: ${decision.finalizedAt.replace('T', ' ').substring(0, 16)} بواسطة: <b>${decision.finalizedByName || 'مدير المديرية'}</b>
            </div>
          ` : ''}
        </div>

        <!-- 5. Signature Footer Block -->
        <div style="margin-top:30px; display:flex; justify-content:space-between; text-align:center; page-break-inside:avoid;">
          <div style="width:30%;">
            <div style="font-weight:bold; font-size:10.5pt; margin-bottom:40px;">المهندس / المراقب الميداني</div>
            <div>...................................</div>
          </div>
          <div style="width:30%;">
            <div style="font-weight:bold; font-size:10.5pt; margin-bottom:40px;">رئيس القسم المختص</div>
            <div>...................................</div>
          </div>
          <div style="width:30%;">
            <div style="font-weight:bold; font-size:10.5pt; margin-bottom:40px;">مدير الأشغال والخدمات الهندسية</div>
            <div>...................................</div>
          </div>
        </div>
      </div>
    `;

    const printFrame = document.getElementById('global-print-frame');
    if (printFrame) {
      printFrame.innerHTML = printHtml;
      printFrame.style.display = 'block';
      window.print();
      setTimeout(() => { printFrame.style.display = 'none'; }, 1000);
    } else {
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>تقرير استدعاء ومعاملة - ${op.task_number || op.id}</title><style>@page { size: A4; margin: 15mm; } body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; }</style></head><body>${printHtml}</body></html>`);
      w.document.close();
      w.print();
    }
  }

  closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.classList.remove('open');
      modalOverlay.style.display = 'none';
    }
    const viewOverlay = document.getElementById('viewOverlay');
    if (viewOverlay) {
      viewOverlay.classList.remove('open');
      viewOverlay.style.display = 'none';
    }
    if (typeof window.closeModal === 'function') window.closeModal();
  }

  async refresh() {
    await this.fetchData();
    this.renderCurrentTab();
  }

  exportExcel() {
    const token = this._getToken();
    window.open(`/api/export/tasks?token=${token}`, '_blank');
  }

  _getUserName(userId) {
    if (!userId) return 'غير مسند';
    const u = this.usersList.find(x => x.id === userId || x.username === userId);
    return u ? (u.fullName || u.username) : userId;
  }

  _getStatusLabel(status) {
    const map = {
      new: 'جديدة', assigned: 'مسندة', accepted: 'مقبولة',
      in_progress: 'قيد التنفيذ', pending: 'معلقة', under_review: 'بانتظار المراجعة',
      returned: 'معادة للتعديل', completed: 'منجزة', verified: 'مدققة',
      closed: 'مغلقة', archived: 'مؤرشفة'
    };
    return map[status] || status;
  }

  _getStatusBadge(status) {
    const colors = {
      new: '#64748b', assigned: '#0284c7', in_progress: '#8b5cf6',
      under_review: '#ec4899', returned: '#ef4444', completed: '#10b981',
      closed: '#10b981', archived: '#6b7280'
    };
    const c = colors[status] || '#64748b';
    return `<span class="badge" style="background:${c}18; color:${c}; font-weight:700; font-size:0.72rem; border:1px solid ${c}35; padding:2px 8px; border-radius:6px;">${this._getStatusLabel(status)}</span>`;
  }

  _getPriorityLabel(p) {
    const map = { critical: 'حرجة 🚨', high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
    return map[p] || p;
  }

  _getPriorityBadge(p) {
    const colors = { critical: '#ef4444', high: '#f59e0b', medium: '#0284c7', low: '#64748b' };
    const c = colors[p] || '#0284c7';
    return `<span class="badge" style="background:${c}18; color:${c}; font-weight:700; font-size:0.7rem; padding:2px 6px; border-radius:4px; border:1px solid ${c}30;">${this._getPriorityLabel(p)}</span>`;
  }

  _getTypeBadge(t) {
    const map = {
      technical: '📐 كشف فني', executive_field: '🚜 تنفيذي ميداني',
      supervisory: '🔍 رقابي وضبط جودة', emergency: '🚨 طوارئ',
      citizen_appeal: '📝 استدعاء مواطن', administrative: '📂 إداري'
    };
    return `<span style="font-size:0.72rem; font-weight:600; color:#cbd5e1;">${map[t] || t}</span>`;
  }
}

window.workOperationsCenterManager = new WorkOperationsCenterManager('work-center-container');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('page-operations-center')?.classList.contains('active') || document.getElementById('page-work-center')?.classList.contains('active')) {
      window.workOperationsCenterManager.init();
    }
  });
} else {
  if (document.getElementById('page-operations-center')?.classList.contains('active') || document.getElementById('page-work-center')?.classList.contains('active')) {
    window.workOperationsCenterManager.init();
  }
}
