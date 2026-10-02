/**
 * ============================================================================
 * نظام إدارة العطاءات والمشاريع الموحد (Unified Tenders & Projects Manager)
 * بلدية كفرنجة — مديرية الأشغال والخدمات الهندسية
 * ============================================================================
 * معيار هندسي شامل لإدارة دورة حياة العطاءات والمشاريع البلدية بالكامل
 * مع خريطة جغرافية فضائية متطورة ونظام إدارة وعرض المرفقات والوثائق
 */

class UnifiedTendersManager {
  constructor(containerId = 'tenders-tab-container') {
    this.containerId = containerId;
    this.tendersData = [];
    this.filteredData = [];
    this.claimsData = [];
    this.usersList = [];
    this.activeTender = null;
    this.currentView = 'list'; // 'list' | 'form' | 'hub'
    this.modalMap = null;
    this.modalMarker = null;
    this.hubMap = null;
    this.boqItems = [];

    this.filters = {
      search: '',
      type: '',
      budgetLine: '',
      method: '',
      committee: '',
      status: '',
      year: ''
    };

    this.init();
  }

  /* ─── محرك الصلاحيات والأدوار الصارمة (Strict RBAC Engine) ──────────── */
  getCurrentUser() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) return currentUser;
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('engineeringUser');
      if (userStr) return JSON.parse(userStr);
    } catch(e) {}
    return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : { role: 'user', fullName: 'مستخدم النظام', permissions: [] };
  }

  can(action, tender = null) {
    const user = this.getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    // الإدارة العليا ومدير النظام والمدير التنفيذي يتمتعون بكافة الصلاحيات
    if (role === 'admin' || role === 'director' || role === 'mayor' || role === 'manager') return true;

    // فحص قائمة الصلاحيات المعرفة للمستخدم
    const perms = Array.isArray(user.permissions) ? user.permissions : (typeof user.permissions === 'string' ? user.permissions.split(',') : []);
    if (perms.includes('*') || perms.includes(`tenders:${action}`)) return true;

    switch (action) {
      case 'view':
      case 'preview':
      case 'print':
      case 'download':
        return true; // المعاينة، الطباعة والتحميل متاحة لكافة مستخدمي البلدية المعتمدين

      case 'create':
      case 'new':
        return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor'].includes(role);

      case 'edit':
        if (['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings'].includes(role)) return true;
        if (['roads_engineer', 'buildings_engineer', 'quantity_surveyor'].includes(role)) {
          // المهندس المشرف يمكنه تعديل العطاء المكلف به رسمياً أو العطاءات غير المسندة
          if (tender && tender.supervisorEngineer && tender.supervisorEngineer === user.fullName) return true;
          if (!tender) return true;
        }
        return false;

      case 'delete':
        // الحذف مقيد بصرامة وحزم بمدير النظام
        return role === 'admin';

      case 'status':
      case 'workflow':
      case 'approve':
        // تغيير واعتماد مراحل العطاءات والأوامر التغييرية
        return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings'].includes(role);

      case 'export':
        return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor', 'site_inspector', 'qa_qc_engineer', 'land_surveyor'].includes(role);

      case 'duplicate':
        return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'quantity_surveyor'].includes(role);

      case 'upload_attachment':
        return this.can('create') || this.can('edit', tender);

      case 'delete_attachment':
        if (['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings'].includes(role)) return true;
        if (['roads_engineer', 'buildings_engineer'].includes(role) && tender && tender.supervisorEngineer === user.fullName) return true;
        return false;

      default:
        return false;
    }
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this._renderBaseLayout();
    this._bindEvents();
    await this.loadData();
  }

  /* ─── جلب البيانات من الخادم ────────────────────────────────────────── */
  async loadData() {
    try {
      this._setLoading(true);
      const [tendersRes, claimsRes, usersRes, budgetRes, settingsRes] = await Promise.all([
        fetch('/api/tenders', { headers: this._getAuthHeaders(false) }).then(r => r.json()).catch(() => []),
        fetch('/api/claims', { headers: this._getAuthHeaders(false) }).then(r => r.json()).catch(() => []),
        fetch('/api/users', { headers: this._getAuthHeaders(false) }).then(r => r.json()).catch(() => []),
        fetch('/api/budget/lines', { headers: this._getAuthHeaders(false) }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/settings/identity', { headers: this._getAuthHeaders(false) }).then(r => r.json()).catch(() => ({}))
      ]);

      this.tendersData = Array.isArray(tendersRes) ? tendersRes : [];
      this.claimsData = Array.isArray(claimsRes) ? claimsRes : [];
      this.usersList = Array.isArray(usersRes) ? usersRes : [];
      this.budgetLines = Array.isArray(budgetRes.data) ? budgetRes.data : (Array.isArray(budgetRes) ? budgetRes : []);
      this.systemSettings = (settingsRes && settingsRes.data) ? settingsRes.data : (settingsRes || {});

      this._populateYearsFilter();
      this._populateBudgetLinesFilter();
      this.applyFilters();
      this._updateKpiDashboard();
      setTimeout(() => { this._initMainMap(); }, 200);
    } catch (err) {
      console.error('Error loading tenders data:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء تحميل بيانات العطاءات', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  _getAuthHeaders(includeJson = true) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let role = 'admin';
    let uid = 'admin';
    try {
      if (userStr) {
        const u = JSON.parse(userStr);
        role = u.role || role;
        uid = u.id || uid;
      }
    } catch(e) {}
    
    const headers = {
      'Authorization': token ? `Bearer ${token}` : '',
      'x-user-role': role,
      'x-user-id': uid
    };
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  /* ─── الهيكل البنائي الأساسي للتبويب ───────────────────────────────── */
  _renderBaseLayout() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="unified-tenders-wrapper" style="width:100%; direction:rtl; font-family:'Tajawal', sans-serif;">
        
        <!-- 1. شاشة قائمة وسجلات العطاءات الرئيسية -->
        <div id="tenders-view-list" class="tenders-view-section">
          
          <!-- الهيدر التنفيذي وقائمة الإجراءات -->
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
            <div>
              <h2 style="margin:0; font-size:1.4rem; font-weight:800; color:var(--text-main, #0f172a); display:flex; align-items:center; gap:8px;">
                <span>📋</span> العطاءات والمشاريع
              </h2>
              <p style="margin:4px 0 0; color:var(--text-muted, #64748b); font-size:0.85rem;">
                إدارة شاملة لدورة حياة العطاءات والمشاريع البلدية، الاتفاقيات، الأوامر التغييرية، والمتابعة المالية والزمنية.
              </p>
            </div>
            <div id="tenders-header-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
              ${this._renderHeaderActions()}
            </div>
          </div>

          <!-- لوحة الموقف المالي للموازنة العامة والالتزام السقفي (Directorate Budget & Financial Position Bar) -->
          <div class="card" id="tenders-budget-position-card" style="padding:16px 20px; margin-bottom:20px; background:linear-gradient(135deg, #0f172a, #1e293b); border:1px solid rgba(14,165,233,0.3); border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,0.25); color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg,#0284c7,#38bdf8); display:flex; align-items:center; justify-content:center; font-size:1.3rem; box-shadow:0 4px 12px rgba(2,132,199,0.4);">
                  🏛️
                </div>
                <div>
                  <div style="font-weight:800; font-size:1.05rem; display:flex; align-items:center; gap:8px;">
                    <span>الموقف المالي العام لموازنة مشاريع المديرية</span>
                    <span id="tender-budget-year-badge" style="background:#0284c730; color:#38bdf8; border:1px solid #0284c7; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">2026</span>
                  </div>
                  <div style="font-size:0.78rem; color:#94a3b8;">مراقبة سقف المخصصات الرأسمالية المعتمدة، الارتباطات التعاقدية، والصرف الفعلي</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <button type="button" class="btn btn-sm" onclick="tendersManager._toggleBudgetDetails()" style="background:rgba(255,255,255,0.08); color:#e2e8f0; border:1px solid rgba(255,255,255,0.15); font-size:0.78rem; border-radius:8px; padding:5px 14px; cursor:pointer;">
                  <span id="tender-budget-details-icon">📊</span> <span id="tender-budget-details-text">تفاصيل بنود الموازنة</span>
                </button>
              </div>
            </div>

            <!-- شبكة مؤشرات الموازنة العامة الـ 4 -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:14px;">
              
              <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:10px; border-right:3px solid #38bdf8;">
                <div style="font-size:0.75rem; color:#94a3b8; font-weight:bold;">الموازنة المعتمدة (السقف الإجمالي)</div>
                <div id="tender-budget-allocated-val" style="font-size:1.35rem; font-weight:800; color:#38bdf8; margin-top:2px;">0.000 د.أ</div>
                <div style="font-size:0.72rem; color:#64748b;" id="tender-budget-lines-count">0 بنود موازنة معتمدة</div>
              </div>

              <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:10px; border-right:3px solid #f59e0b;">
                <div style="font-size:0.75rem; color:#94a3b8; font-weight:bold;">إجمالي الارتباطات المحجوزة</div>
                <div id="tender-budget-committed-val" style="font-size:1.35rem; font-weight:800; color:#fbbf24; margin-top:2px;">0.000 د.أ</div>
                <div style="font-size:0.72rem; color:#64748b;" id="tender-budget-commit-pct">نسبة الارتباط: 0%</div>
              </div>

              <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:10px; border-right:3px solid #10b981;">
                <div style="font-size:0.75rem; color:#94a3b8; font-weight:bold;">المصروف الفعلي (المطالبات)</div>
                <div id="tender-budget-spent-val" style="font-size:1.35rem; font-weight:800; color:#34d399; margin-top:2px;">0.000 د.أ</div>
                <div style="font-size:0.72rem; color:#64748b;" id="tender-budget-spent-pct">نسبة الصرف: 0%</div>
              </div>

              <div style="background:rgba(255,255,255,0.04); padding:12px 14px; border-radius:10px; border-right:3px solid #a855f7;">
                <div style="font-size:0.75rem; color:#94a3b8; font-weight:bold;">الرصيد الحر المتاح للارتباط</div>
                <div id="tender-budget-available-val" style="font-size:1.35rem; font-weight:800; color:#c084fc; margin-top:2px;">0.000 د.أ</div>
                <div style="font-size:0.72rem; color:#64748b;" id="tender-budget-avail-pct">المتبقي للتخصيص: 0%</div>
              </div>

            </div>

            <!-- شريط التقدم التراكمي الملون للالتزام المالي بالموازنة -->
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#cbd5e1; margin-bottom:6px; font-weight:bold;">
                <span>مؤشر استخدام الموازنة الرأسمالية:</span>
                <span id="tender-budget-progress-label">الارتباط 0% | الصرف الفعلي 0%</span>
              </div>
              <div style="background:rgba(255,255,255,0.1); height:10px; border-radius:6px; overflow:hidden; display:flex; position:relative;">
                <div id="tender-budget-spent-bar" style="background:#10b981; width:0%; height:100%; transition:width 0.5s ease;" title="المصروف الفعلي"></div>
                <div id="tender-budget-commit-bar" style="background:#f59e0b; width:0%; height:100%; transition:width 0.5s ease;" title="الارتباطات المحجوزة"></div>
              </div>
            </div>

            <!-- جدول تفصيلي لبنود الموازنة يظهر عند النقر -->
            <div id="tender-budget-breakdown-container" style="display:none; margin-top:16px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:14px;">
              <div style="font-size:0.83rem; font-weight:bold; color:#38bdf8; margin-bottom:8px;">
                📋 توزيع المخصصات والارتباطات حسب بنود الموازنة المعتمدة:
              </div>
              <div id="tender-budget-breakdown-list" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:10px;">
                <!-- سيتم الحقن ديناميكياً -->
              </div>
            </div>
          </div>

          <!-- بطاقات مؤشرات الأداء الحية (Live KPIs) -->
          <div class="tenders-kpi-row" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
            
            <div class="card kpi-card" style="border-right:4px solid #0284c7; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">إجمالي العطاءات والمشاريع</span>
                  <div style="font-size:1.6rem; font-weight:800; color:#0284c7; margin-top:4px;" id="tender-kpi-total-count">0</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);" id="tender-kpi-total-val">0.000 د.أ</div>
                </div>
                <div style="font-size:2rem; background:#0284c715; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px;">📋</div>
              </div>
            </div>

            <div class="card kpi-card" style="border-right:4px solid #10b981; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">مشاريع الأشغال الهندسية</span>
                  <div style="font-size:1.6rem; font-weight:800; color:#10b981; margin-top:4px;" id="tender-kpi-works-count">0</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);" id="tender-kpi-works-val">0.000 د.أ</div>
                </div>
                <div style="font-size:2rem; background:#10b98115; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px;">🏗️</div>
              </div>
            </div>

            <div class="card kpi-card" style="border-right:4px solid #f59e0b; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">عطاءات اللوازم والتوريدات</span>
                  <div style="font-size:1.6rem; font-weight:800; color:#f59e0b; margin-top:4px;" id="tender-kpi-supplies-count">0</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);" id="tender-kpi-supplies-val">0.000 د.أ</div>
                </div>
                <div style="font-size:2rem; background:#f59e0b15; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px;">📦</div>
              </div>
            </div>

            <div class="card kpi-card" style="border-right:4px solid #8b5cf6; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <span style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">المشاريع قيد التنفيذ النشطة</span>
                  <div style="font-size:1.6rem; font-weight:800; color:#8b5cf6; margin-top:4px;" id="tender-kpi-active-count">0</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);" id="tender-kpi-active-sub">قيد العمل والمتابعة</div>
                </div>
                <div style="font-size:2rem; background:#8b5cf615; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px;">⚡</div>
              </div>
            </div>

          </div>

          <!-- شريط أدوات البحث والتصفية المتقدمة -->
          <div class="card" style="padding:14px; margin-bottom:16px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">بحث سريع</label>
                <input type="text" id="tenders-filter-search" class="form-control" placeholder="🔍 بالاسم، الرقم، أو المقاول..." style="width:100%;">
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">نوع العطاء</label>
                <select id="tenders-filter-type" class="form-control" style="width:100%;">
                  <option value="">جميع الأنواع</option>
                  <option value="أشغال">أشغال عامة وهندسية</option>
                  <option value="لوازم">لوازم وتوريدات</option>
                  <option value="استشارات">دراسات واستشارات</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">بند الموازنة المرتبط</label>
                <select id="tenders-filter-budget-line" class="form-control" style="width:100%;">
                  <option value="">جميع بنود الموازنة</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">طريقة الشراء</label>
                <select id="tenders-filter-method" class="form-control" style="width:100%;">
                  <option value="">جميع طرق الشراء</option>
                  <option value="مناقصة عامة">مناقصة عامة</option>
                  <option value="مناقصة محدودة">مناقصة محدودة</option>
                  <option value="استدراج عروض">استدراج عروض</option>
                  <option value="شراء مباشر">شراء مباشر</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">لجنة الشراء</label>
                <select id="tenders-filter-committee" class="form-control" style="width:100%;">
                  <option value="">جميع اللجان</option>
                  <option value="الرئيس">رئيس البلدية</option>
                  <option value="لجنة الشراء المحلية">لجنة الشراء المحلية</option>
                  <option value="لجنة الشراء الرئيسية">لجنة الشراء الرئيسية</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">الحالة التنفيذية</label>
                <select id="tenders-filter-status" class="form-control" style="width:100%;">
                  <option value="">جميع الحالات</option>
                  <option value="مفتوح">مفتوح / قيد الطرح</option>
                  <option value="قيد الدراسة">قيد الدراسة والتقييم</option>
                  <option value="مُحال">مُحال / قيد المباشرة</option>
                  <option value="قيد التنفيذ">قيد التنفيذ الفعلي</option>
                  <option value="مُنجز">مُنجز / مستلم أولي</option>
                  <option value="منتهي">منتهي ومستلم نهائياً</option>
                  <option value="ملغي">ملغي</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:block;">السنة المالية</label>
                <select id="tenders-filter-year" class="form-control" style="width:100%;">
                  <option value="">جميع السنوات</option>
                </select>
              </div>
            </div>
          </div>

          <!-- الخريطة التفاعلية الجغرافية المعتمدة لمنظومة المشاريع والعطاءات -->
          <div class="card" id="tenders-main-map-card" style="padding:16px; margin-bottom:16px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.3rem;">🗺️</span>
                <div>
                  <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">الخريطة التفاعلية الجغرافية لمواقع العطاءات والمشاريع</h4>
                  <span id="tenders-map-stats-badge" style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">المشاريع المحددة جغرافياً: 0 من 0</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <!-- أدوات تعديل الحجم والارتفاع -->
                <div style="display:inline-flex; border:1px solid var(--border); border-radius:6px; overflow:hidden;">
                  <button type="button" class="btn btn-sm btn-outline" style="padding:4px 10px; font-size:0.75rem;" onclick="tendersManager._setMainMapHeight('300px', this)">صغيرة (300px)</button>
                  <button type="button" class="btn btn-sm btn-primary" style="padding:4px 10px; font-size:0.75rem;" onclick="tendersManager._setMainMapHeight('460px', this)">متوسطة (460px)</button>
                  <button type="button" class="btn btn-sm btn-outline" style="padding:4px 10px; font-size:0.75rem;" onclick="tendersManager._setMainMapHeight('650px', this)">واسعة (650px)</button>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._fitMainMapBounds()">
                  🎯 ضبط الرؤية
                </button>
                <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._toggleMainMapVisibility()">
                  <span id="tenders-toggle-map-icon">👁️</span> <span id="tenders-toggle-map-text">إخفاء / إظهار الخريطة</span>
                </button>
              </div>
            </div>


            <!-- حاوية الخريطة التفاعلية -->
            <div id="tenders-main-gis-map" style="height:460px; width:100%; border-radius:10px; border:2px solid var(--border); box-shadow:inset 0 2px 6px rgba(0,0,0,0.1); z-index:1; transition:height 0.3s ease;"></div>
          </div>

          <!-- جدول العطاءات الرئيسي -->
          <div class="card" style="padding:0; overflow:hidden;">
            <div class="table-responsive" style="overflow-x:auto;">
              <table class="data-table" style="width:100%; border-collapse:collapse; margin:0; text-align:right;">
                <thead>
                  <tr style="background:var(--bg-card-hover, rgba(0,0,0,0.04));">
                    <th style="padding:10px 12px; width:110px;">رقم العطاء</th>
                    <th style="padding:10px 12px; min-width:200px;">اسم المشروع / العطاء</th>
                    <th style="padding:10px 12px; width:110px;">النوع</th>
                    <th style="padding:10px 12px; width:120px;">طريقة الشراء</th>
                    <th style="padding:10px 12px; width:130px;">لجنة الشراء</th>
                    <th style="padding:10px 12px; width:140px;">المقاول / المنفذ</th>
                    <th style="padding:10px 12px; width:110px; text-align:center;">تاريخ الطرح</th>
                    <th style="padding:10px 12px; width:120px; text-align:center;">القيمة (د.أ)</th>
                    <th style="padding:10px 12px; width:110px; text-align:center;">الحالة</th>
                    <th style="padding:10px 12px; width:180px; text-align:center;">الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="tenders-table-tbody">
                  <!-- يتم التوليد ديناميكياً -->
                </tbody>
              </table>
            </div>
            <div id="tenders-table-footer" style="padding:10px 16px; border-top:1px solid var(--border); font-size:0.85rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>إجمالي السجلات: 0</span>
              <span>بلدية كفرنجة — منظومة العطاءات</span>
            </div>
          </div>

        </div>

        <!-- 2. شاشة إضافة وتعديل العطاء المخصصة (Full-Page Form View) -->
        <div id="tenders-view-form" class="tenders-view-section" style="display:none;">
          <!-- توليد ديناميكي لنموذج الإدخال الموحد -->
        </div>

        <!-- 3. شاشة بطاقة المشروع الشاملة (Project 360° Hub) -->
        <div id="tenders-view-hub" class="tenders-view-section" style="display:none;">
          <!-- توليد ديناميكي لبطاقة العطاء والمطالبات المرتبطة -->
        </div>

        <!-- 4. نافذة المعاينة السريعة للوثائق والمرفقات (Document Viewer Modal) -->
        <div id="tender-doc-preview-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; justify-content:center; align-items:center; padding:20px;">
          <div class="modal" style="width:90%; max-width:950px; height:85vh; display:flex; flex-direction:column; background:var(--bg-card); border-radius:12px; overflow:hidden; border:1px solid var(--border);">
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 18px; border-bottom:1px solid var(--border); background:var(--bg-surface);">
              <h3 id="tender-doc-preview-title" style="margin:0; font-size:1.1rem; font-weight:800;">📄 معاينة وثيقة العطاء</h3>
              <div style="display:flex; gap:8px;">
                <a id="tender-doc-preview-download" href="#" target="_blank" class="btn btn-sm btn-primary">📥 تحميل الملف الأصلي</a>
                <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._closeDocPreview()">✕ إغلاق</button>
              </div>
            </div>
            <div id="tender-doc-preview-body" style="flex:1; width:100%; height:100%; overflow:auto; background:#1e293b; display:flex; justify-content:center; align-items:center;">
              <!-- سيتم حقن iframe أو img هنا -->
            </div>
          </div>
        </div>
        <!-- 5. نافذة تغيير الحالة ومسار الاعتماد والقرارات (Status Transition Modal) -->
        <div id="tender-status-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:9999; justify-content:center; align-items:center; padding:20px; backdrop-filter:blur(4px);">
          <div class="modal" style="width:90%; max-width:550px; background:var(--bg-card); border-radius:12px; overflow:hidden; border:1px solid var(--border); box-shadow:0 20px 40px rgba(0,0,0,0.4);">
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg-surface);">
              <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:var(--text-main);">⚙️ تحديث حالة المشروع ومسار الاعتماد</h3>
              <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._closeStatusModal()">✕</button>
            </div>
            <form id="tender-status-form" onsubmit="event.preventDefault(); tendersManager._submitStatusTransition();" style="padding:18px; display:flex; flex-direction:column; gap:14px;">
              <input type="hidden" id="tender-status-id">
              <div>
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المشروع المحدد:</label>
                <div id="tender-status-target-name" style="padding:8px 12px; background:var(--bg-surface); border-radius:6px; font-weight:bold; color:var(--primary); font-size:0.9rem;">-</div>
              </div>
              <div>
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">الحالة التنفيذية / التعاقدية الجديدة *</label>
                <select id="tender-status-select" class="form-control" style="width:100%; font-weight:700; padding:8px;" required>
                  <option value="مفتوح">مفتوح (قيد الإعلان وطرح المناقصة)</option>
                  <option value="قيد الدراسة">قيد الدراسة والتقييم الفني والمالي</option>
                  <option value="مُحال">مُحال (بانتظار توقيع العقد وأمر المباشرة)</option>
                  <option value="قيد التنفيذ">قيد التنفيذ والمباشرة الميدانية</option>
                  <option value="مُنجز">مُنجز (استلام أولي / محضر استلام فني)</option>
                  <option value="منتهي">منتهي ومستلم نهائياً (إبراء ذمة وإفراج كفالة)</option>
                  <option value="ملغي">ملغي (بقرار مجلس بلدي رسمي)</option>
                </select>
              </div>
              <div>
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المبرر الهندسي / رقم وتاريخ القرار الرسمي</label>
                <textarea id="tender-status-notes" class="form-control" rows="3" placeholder="أدخل رقم وتاريخ قرار المجلس البلدي أو التقرير الفني لتغيير الحالة..." style="width:100%;"></textarea>
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px; border-top:1px solid var(--border); padding-top:12px;">
                <button type="button" class="btn btn-outline" onclick="tendersManager._closeStatusModal()">إلغاء</button>
                <button type="submit" class="btn btn-primary" style="font-weight:800; padding:8px 20px;">💾 حفظ واعتماد الحالة</button>
              </div>
            </form>
          </div>
        </div>

        <!-- 6. نافذة كتابة وتوليد التقرير اليومي الميداني المتقدم (Advanced Daily Site Report Modal) -->
        <div id="tender-daily-report-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; justify-content:center; align-items:center; padding:16px; backdrop-filter:blur(5px); overflow-y:auto;">
          <div class="modal" style="width:92%; max-width:920px; background:var(--bg-card); border-radius:14px; overflow:hidden; border:1px solid var(--border); box-shadow:0 30px 60px rgba(0,0,0,0.45); margin:auto; max-height:92vh; display:flex; flex-direction:column;">
            
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:14px 22px; border-bottom:1px solid var(--border); background:var(--bg-surface);">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.4rem;">📝</span>
                <div>
                  <h3 id="dr-modal-title" style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-main);">تسجيل وتوليد تقرير الإشراف الهندسي اليومي</h3>
                  <div style="font-size:0.75rem; color:var(--text-muted);">توثيق الأعمال الميدانية، القوى العاملة، ضبط الجودة، وفحوصات المختبر</div>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._closeDailyReportModal()">✕</button>
            </div>

            <form id="tender-daily-report-form" onsubmit="event.preventDefault(); tendersManager.saveDailyReport();" style="padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">
              <input type="hidden" id="dr-tender-id">
              <input type="hidden" id="dr-report-id">
              
              <!-- أزرار القوالب الهندسية السريعة -->
              <div style="background:linear-gradient(135deg, rgba(14,165,233,0.08), rgba(99,102,241,0.08)); border:1px dashed #0284c7; border-radius:10px; padding:12px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span style="font-weight:800; font-size:0.83rem; color:var(--primary); display:flex; align-items:center; gap:6px;">
                    ⚡ <b>قوالب هندسية سريعة (تعبئة فورية بنقرة واحدة):</b>
                  </span>
                  <span style="font-size:0.72rem; color:var(--text-muted);">اختر القالب لتعبئة تفاصيل الأعمال، الآليات، والمواد تلقائياً</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('asphalt')" style="font-size:0.78rem; font-weight:700;">
                    🛣️ أعمال التعبيد والإسفلت
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('curbs')" style="font-size:0.78rem; font-weight:700;">
                    🧱 الأرصفة والكندرين والإنترلوك
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('drainage')" style="font-size:0.78rem; font-weight:700;">
                    🌧️ تصريف الأمطار والعبارات
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('walls')" style="font-size:0.78rem; font-weight:700;">
                    🚧 الجدران والخرسانة المسلحة
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('patching')" style="font-size:0.78rem; font-weight:700;">
                    🚜 الترقيعات والصيانة الطارئة
                  </button>
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.applyEngineeringTemplate('earthwork')" style="font-size:0.78rem; font-weight:700;">
                    ⛏️ الحفريات والتأسيس
                  </button>
                </div>
              </div>

              <!-- السطر 1: التاريخ، الرقم، الطقس، وساعات العمل -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">تاريخ التقرير *</label>
                  <input type="date" id="dr-report-date" class="form-control" style="width:100%; font-weight:bold;" required>
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">رقم التقرير</label>
                  <input type="text" id="dr-report-number" class="form-control" placeholder="تلقائي (يومي-01)" style="width:100%;">
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">حالة الطقس</label>
                  <select id="dr-weather" class="form-control" style="width:100%;">
                    <option value="مشمس وصحو">☀️ مشمس وصحو</option>
                    <option value="معتدل">🌤️ معتدل</option>
                    <option value="غائم جزئياً">⛅ غائم جزئياً</option>
                    <option value="ماطر (تأثير على العمل)">🌧️ ماطر (تأثير على العمل)</option>
                    <option value="حار">🌡️ حار</option>
                    <option value="رياح شديدة وغبار">💨 رياح شديدة وغبار</option>
                  </select>
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">درجة الحرارة</label>
                  <input type="text" id="dr-temperature" class="form-control" placeholder="مثال: 28°C" style="width:100%;">
                </div>
              </div>

              <!-- السطر 2: الإشراف الهندسي وساعات الدوام والتوقف -->
              <div style="display:grid; grid-template-columns:1.5fr 1.5fr 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">المهندس المشرف المعتمد *</label>
                  <input type="text" id="dr-supervisor" class="form-control" style="width:100%; font-weight:600;" required>
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">المراقب الميداني / الفني</label>
                  <input type="text" id="dr-inspector" class="form-control" placeholder="اسم المراقب بالموقع" style="width:100%;">
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">ساعات العمل (ساعة)</label>
                  <input type="number" id="dr-work-hours" class="form-control" step="0.5" min="0" max="24" value="8" style="width:100%;">
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">ساعات التوقف / العطل</label>
                  <input type="number" id="dr-delay-hours" class="form-control" step="0.5" min="0" max="24" value="0" style="width:100%; color:#ef4444;">
                </div>
              </div>

              <!-- السطر 3: العمالة والآليات بالموقع -->
              <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px;">
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">إجمالي عدد العمال بالموقع</label>
                  <input type="number" id="dr-manpower-count" class="form-control" min="0" placeholder="0" style="width:100%;">
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">تفصيل العمالة والمعدات والآليات الثقيلة المتواجدة</label>
                  <input type="text" id="dr-equipment-details" class="form-control" placeholder="مثال: 1 جرافة كتربلر، 1 مدحلة 12 طن، 2 قلاب، 1 فورمان، 6 عمال" style="width:100%;">
                </div>
              </div>

              <!-- السطر 4: تفاصيل الأعمال المنفذة -->
              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block; color:var(--primary);">
                  🏗️ وصف الأعمال والبنود المنجزة ميدانياً خلال اليوم *
                </label>
                <textarea id="dr-executed-works" class="form-control" rows="4" placeholder="اكتب بالتفصيل الأعمال المنفذة: مثل فرش وفرد طبقة بيسكورس بسماكة 15 سم بطول 250م، رش مادة MC1، أعمال حفر وتجهيز منسوب التأسيس..." style="width:100%; line-height:1.6;" required></textarea>
              </div>

              <!-- السطر 5: ضبط الجودة والفحوصات المخبرية المتخصصة -->
              <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:8px; padding:12px;">
                <h4 style="margin:0 0 10px; font-size:0.88rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                  <span>🧪</span> ضبط الجودة والفحوصات المخبرية والمعايرات:
                </h4>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:10px;">
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">حرارة الخلطة الإسفلتية</label>
                    <input type="text" id="dr-asphalt-temp" class="form-control" placeholder="مثال: 155°C" style="font-size:0.82rem;">
                  </div>
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">هبوط الخرسانة (Slump)</label>
                    <input type="text" id="dr-concrete-slump" class="form-control" placeholder="مثال: 100 ملم" style="font-size:0.82rem;">
                  </div>
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">نسبة الدمك (Compaction)</label>
                    <input type="text" id="dr-compaction-rate" class="form-control" placeholder="مثال: 98.5%" style="font-size:0.82rem;">
                  </div>
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">معايير السلامة العامة</label>
                    <select id="dr-safety-status" class="form-control" style="font-size:0.82rem;">
                      <option value="ملتزم بالكامل بمعايير السلامة">✅ ملتزم بالكامل بالسلامة والشواخص</option>
                      <option value="ملاحظات سلامة طفيفة تم التنبيه لها">⚠️ ملاحظات سلامة طفيفة</option>
                      <option value="مخالفة سلامة وتوقف حتى التصويب">🚫 مخالفة سلامة عامة</option>
                    </select>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">المواد الموردة للموقع</label>
                    <textarea id="dr-materials" class="form-control" rows="2" placeholder="كميات المواد المستلمة (حصمة، باطون جاهز، خلطة إسفلتية...)" style="width:100%; font-size:0.82rem;"></textarea>
                  </div>
                  <div class="form-group">
                    <label style="font-size:0.78rem; font-weight:bold; margin-bottom:2px; display:block;">الفحوصات المخبرية وعينات الفحص</label>
                    <textarea id="dr-lab-tests" class="form-control" rows="2" placeholder="أخذ مكعبات خرسانية، كود الخلطة، نتائج الكثافة الحقلية..." style="width:100%; font-size:0.82rem;"></textarea>
                  </div>
                </div>
              </div>

              <!-- السطر 6: نسب الإنجاز والمعوقات والتعليمات -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">نسبة إنجاز اليوم المقدرة (%)</label>
                  <input type="number" id="dr-daily-pct" class="form-control" step="0.1" min="0" max="100" placeholder="0.0%" style="width:100%;">
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">نسبة الإنجاز التراكمية للمشروع (%)</label>
                  <input type="number" id="dr-cumulative-pct" class="form-control" step="0.1" min="0" max="100" placeholder="تحديث نسبة إنجاز المشروع الكلية" style="width:100%; font-weight:bold; color:#10b981;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">التوجيهات والتعليمات المسلمة للمقاول</label>
                  <textarea id="dr-instructions" class="form-control" rows="2" placeholder="أي أوامر خطية أو تعليمات موقعية سلمت لمهندس المقاول..." style="width:100%; font-size:0.83rem;"></textarea>
                </div>
                <div class="form-group">
                  <label style="font-weight:bold; font-size:0.83rem; margin-bottom:4px; display:block;">المعوقات وأسباب التوقف الميدانية</label>
                  <textarea id="dr-obstacles" class="form-control" rows="2" placeholder="معوقات بنية تحتية (مياه، كهرباء)، اعتداءات، أو تعارض مناسيب..." style="width:100%; font-size:0.83rem;"></textarea>
                </div>
              </div>

              <!-- السطر 7: تحديد موقع العمل الميداني الدقيق على الخريطة التفاعلية (GIS Site Map) -->
              <div class="card" style="padding:14px; background:var(--bg-surface); border:1px solid var(--border); border-radius:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:1.2rem;">🗺️</span>
                    <label style="font-weight:800; font-size:0.88rem; margin:0; color:var(--text-main);">
                      تحديد موقع العمل الميداني الدقيق على الخريطة (GIS):
                    </label>
                  </div>
                  <div style="display:flex; gap:6px;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._resetDailyReportMapToTender()" style="font-size:0.75rem;">
                      🎯 محاذاة لموقع المشروع
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._locateUserOnDailyReportMap()" style="font-size:0.75rem;">
                      📍 موقعي الحالي (GPS)
                    </button>
                  </div>
                </div>

                <div class="form-group" style="margin-bottom:8px;">
                  <input type="text" id="dr-site-location-name" class="form-control" placeholder="اسم الشارع / المحطة الميدانية (مثال: مدخل كفرنجة الشمالي - محطة 0+300 إلى 0+600 أو قرب مسجد عتبة)" style="font-size:0.83rem; width:100%; font-weight:600;">
                </div>

                <div id="dr-report-map" style="height:250px; width:100%; border-radius:8px; border:2px solid var(--border); z-index:1; position:relative;"></div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap; gap:6px;">
                  <span>💡 انقر على الخريطة أو اسحب المؤشر لتحديد موقع عمل اليوم بدقة.</span>
                  <span id="dr-map-coord-badge" style="background:var(--bg-card); padding:3px 10px; border-radius:6px; border:1px solid var(--border); font-family:monospace; font-weight:bold; color:var(--primary);">32.330100, 35.750100</span>
                </div>
                <input type="hidden" id="dr-lat" value="32.3301">
                <input type="hidden" id="dr-lng" value="35.7501">
              </div>

              <!-- السطر 8: رفع صور الموقع المتعددة ووثائق الفحص -->
              <div class="form-group" style="background:var(--bg-surface); padding:12px; border-radius:8px; border:1px solid var(--border);">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">
                  📷 إرفاق صور الموقع الميدانية المتعددة ووثائق الفحص المخبري (يمكن اختيار عدة صور معا):
                </label>
                <input type="file" id="dr-file" class="form-control" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="width:100%; padding:8px;">
                <input type="hidden" id="dr-existing-attach">
                <input type="hidden" id="dr-existing-photos">
                <div id="dr-existing-photos-preview" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;"></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px; border-top:1px solid var(--border); padding-top:14px;">
                <button type="button" class="btn btn-outline" onclick="tendersManager._closeDailyReportModal()">إلغاء</button>
                <button type="submit" class="btn btn-primary" style="font-weight:800; padding:10px 26px;">💾 حفظ وتوثيق التقرير اليومي</button>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;
  }

  /* ─── توليد أزرار الترويسة التنفيذية بحسب الصلاحيات ────────────────── */
  _renderHeaderActions() {
    const canCreate = this.can('create');
    const canExport = this.can('export');
    const canPrint = this.can('print');

    return `
      <button class="btn btn-outline" id="tenders-btn-refresh" onclick="tendersManager.loadData()" style="display:inline-flex; align-items:center; gap:6px;">
        <span>🔄</span> تحديث
      </button>
      ${canExport ? `
        <button class="btn btn-outline" id="tenders-btn-export-excel" onclick="tendersManager.exportExcel()" style="display:inline-flex; align-items:center; gap:6px;">
          <span>📊</span> تصدير Excel منظم
        </button>
      ` : ''}
      ${canPrint ? `
        <button class="btn btn-outline" id="tenders-btn-print-summary" onclick="tendersManager.printSummaryReport()" style="display:inline-flex; align-items:center; gap:6px;">
          <span>🖨️</span> طباعة الكشف العام
        </button>
      ` : ''}
      ${canCreate ? `
        <button class="btn btn-primary" id="tenders-btn-new-tender" onclick="tendersManager.openCreateForm()" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          <span>➕</span> طرح عطاء / مشروع جديد
        </button>
      ` : ''}
    `;
  }

  /* ─── ربط الأحداث وعناصر التحكم ─────────────────────────────────────── */
  _bindEvents() {
    const searchInp = document.getElementById('tenders-filter-search');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.applyFilters();
      });
    }

    const typeSel = document.getElementById('tenders-filter-type');
    if (typeSel) typeSel.addEventListener('change', (e) => { this.filters.type = e.target.value; this.applyFilters(); });

    const budgetSel = document.getElementById('tenders-filter-budget-line');
    if (budgetSel) budgetSel.addEventListener('change', (e) => { this.filters.budgetLine = e.target.value; this.applyFilters(); });

    const methodSel = document.getElementById('tenders-filter-method');
    if (methodSel) methodSel.addEventListener('change', (e) => { this.filters.method = e.target.value; this.applyFilters(); });

    const commSel = document.getElementById('tenders-filter-committee');
    if (commSel) commSel.addEventListener('change', (e) => { this.filters.committee = e.target.value; this.applyFilters(); });

    const statusSel = document.getElementById('tenders-filter-status');
    if (statusSel) statusSel.addEventListener('change', (e) => { this.filters.status = e.target.value; this.applyFilters(); });

    const yearSel = document.getElementById('tenders-filter-year');
    if (yearSel) yearSel.addEventListener('change', (e) => { this.filters.year = e.target.value; this.applyFilters(); });

    // إغلاق قوائم الإجراءات المنبثقة عند النقر في أي مكان آخر
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tenders-action-menu-container')) {
        this.closeAllRowMenus();
      }
    });
  }

  /* ─── التحكم بقوائم الإجراءات المنبثقة للجدول (Fixed Floating Dropdown) ─── */
  toggleRowMenu(tenderId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const menu = document.getElementById(`tender-row-menu-${tenderId}`);
    const isCurrentlyOpen = menu && menu.style.display === 'block';

    this.closeAllRowMenus();

    if (menu && !isCurrentlyOpen) {
      const btn = event.currentTarget;
      const rect = btn.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const menuHeight = 230;

      menu.style.position = 'fixed';
      menu.style.zIndex = '999999';
      menu.style.left = `${Math.max(10, rect.left)}px`;
      menu.style.right = 'auto';

      if (rect.bottom + menuHeight > windowHeight && rect.top > menuHeight) {
        // فتح القائمة للأعلى إذا كانت قريبة من أسفل الشاشة
        menu.style.top = `${rect.top - menuHeight - 4}px`;
        menu.style.bottom = 'auto';
      } else {
        // فتح القائمة للأسفل
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.bottom = 'auto';
      }

      menu.style.display = 'block';
    }
  }

  closeAllRowMenus() {
    document.querySelectorAll('.tenders-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }

  /* ─── تعبئة قائمة السنوات ─────────────────────────────────────────── */
  _populateYearsFilter() {
    const yearSel = document.getElementById('tenders-filter-year');
    if (!yearSel) return;
    const years = new Set();
    this.tendersData.forEach(t => {
      const d = t.openDate || t.created_at || t.createdAt;
      if (d) {
        const y = new Date(d).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });

    const currentYears = Array.from(years).sort((a, b) => b - a);
    let opts = '<option value="">جميع السنوات</option>';
    currentYears.forEach(y => {
      opts += `<option value="${y}">${y}</option>`;
    });
    yearSel.innerHTML = opts;
  }

  /* ─── تعبئة قائمة بنود الموازنة المعتمدة في الفلتر ─────────────────── */
  _populateBudgetLinesFilter() {
    const bSel = document.getElementById('tenders-filter-budget-line');
    if (!bSel) return;
    const lines = this.budgetLines || [];
    let opts = '<option value="">جميع بنود الموازنة</option>';
    lines.forEach(b => {
      const bAlloc = parseFloat(b.allocated_amount || 0).toLocaleString('ar-JO');
      opts += `<option value="${b.id}">[${b.line_code || b.id}] ${b.line_name} (${bAlloc} د.أ)</option>`;
    });
    bSel.innerHTML = opts;
  }

  /* ─── تصفية وعرض البيانات ─────────────────────────────────────────── */
  applyFilters() {
    let list = [...this.tendersData];

    if (this.filters.search) {
      const q = this.filters.search.trim().toLowerCase();
      list = list.filter(t => 
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.tenderNumber && t.tenderNumber.toLowerCase().includes(q)) ||
        (t.contractor && t.contractor.toLowerCase().includes(q)) ||
        (t.supervisorEngineer && t.supervisorEngineer.toLowerCase().includes(q))
      );
    }

    if (this.filters.type) {
      list = list.filter(t => (t.tenderType || '').includes(this.filters.type));
    }

    if (this.filters.budgetLine) {
      list = list.filter(t => String(t.budget_line_id || t.budgetLineId || '') === String(this.filters.budgetLine));
    }

    if (this.filters.method) {
      list = list.filter(t => (t.purchaseMethod || '') === this.filters.method);
    }

    if (this.filters.committee) {
      list = list.filter(t => (t.purchaseCommittee || '') === this.filters.committee);
    }

    if (this.filters.status) {
      list = list.filter(t => (t.status || '') === this.filters.status);
    }

    if (this.filters.year) {
      list = list.filter(t => {
        const d = t.openDate || t.created_at || t.createdAt;
        return d && String(new Date(d).getFullYear()) === String(this.filters.year);
      });
    }

    this.filteredData = list;
    this._renderTable();
    this._renderMainMapMarkers();
  }

  /* ─── تصيير جدول العطاءات ──────────────────────────────────────────── */
  _renderTable() {
    const tbody = document.getElementById('tenders-table-tbody');
    const footer = document.getElementById('tenders-table-footer');
    if (!tbody) return;

    if (!this.filteredData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:8px;">📭</div>
            <div style="font-weight:bold;">لا توجد عطاءات أو مشاريع مطابقة للبحث</div>
          </td>
        </tr>
      `;
      if (footer) footer.innerHTML = `<span>إجمالي السجلات: 0</span>`;
      return;
    }

    const html = this.filteredData.map(t => {
      const typeBadge = (t.tenderType === 'أشغال' || !t.tenderType)
        ? `<span class="badge" style="background:#0284c715; color:#0284c7; border:1px solid #0284c740;">🏗️ أشغال</span>`
        : (t.tenderType === 'لوازم'
          ? `<span class="badge" style="background:#f59e0b15; color:#f59e0b; border:1px solid #f59e0b40;">📦 لوازم</span>`
          : `<span class="badge" style="background:#8b5cf615; color:#8b5cf6; border:1px solid #8b5cf640;">📐 استشارات</span>`);

      const methodText = t.purchaseMethod || 'مناقصة عامة';
      const committeeText = t.purchaseCommittee || 'لجنة الشراء المحلية';
      
      const st = t.status || 'مفتوح';
      let stColor = '#0284c7';
      if (st === 'قيد التنفيذ' || st === 'مُحال') stColor = '#8b5cf6';
      else if (st === 'مُنجز' || st === 'منتهي') stColor = '#10b981';
      else if (st === 'ملغي' || st === 'مرفوض') stColor = '#ef4444';
      else if (st === 'قيد الدراسة') stColor = '#f59e0b';

      const val = parseFloat(t.awardedValue || t.value || t.estimatedValue || 0);
      const hasAttach = !!(t.attachmentPath || t.file);

      // بند الموازنة المرتبط
      const bLine = (this.budgetLines || []).find(b => String(b.id) === String(t.budget_line_id || t.budgetLineId));
      const budgetBadge = bLine 
        ? `<div style="margin-top:3px;"><span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; border:1px solid rgba(2,132,199,0.3); font-size:0.7rem; padding:1px 6px; border-radius:4px; font-weight:600;">💵 [${bLine.line_code || bLine.id}] ${bLine.line_name}</span></div>`
        : '';

      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:10px 12px; font-weight:bold;">
            <a href="javascript:void(0)" onclick="tendersManager.openProjectHub('${t.id}')" style="color:var(--primary); text-decoration:none; font-weight:800;">
              ${t.id || t.tenderNumber || '—'}
            </a>
            ${hasAttach ? `<span title="يوجد ملف مرفق" style="margin-right:4px; font-size:0.85rem; cursor:pointer;" onclick="tendersManager.previewDocument('${t.id}', '${t.attachmentPath || t.file}')">📎</span>` : ''}
          </td>
          <td style="padding:10px 12px;">
            <div style="font-weight:700; color:var(--text-main);">${t.name}</div>
            ${budgetBadge}
            ${t.district ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">📍 ${t.district}</div>` : ''}
          </td>
          <td style="padding:10px 12px;">${typeBadge}</td>
          <td style="padding:10px 12px; font-size:0.83rem;">${methodText}</td>
          <td style="padding:10px 12px; font-size:0.83rem;">${committeeText}</td>
          <td style="padding:10px 12px; font-weight:600;">${t.contractor || '—'}</td>
          <td style="padding:10px 12px; text-align:center; font-size:0.83rem;">${t.openDate || '—'}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:800; color:#10b981;">
            ${val.toLocaleString('ar-JO', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          </td>
          <td style="padding:10px 12px; text-align:center;">
            <span class="badge" style="background:${stColor}18; color:${stColor}; border:1px solid ${stColor}40; font-size:0.75rem; padding:3px 8px; border-radius:12px; font-weight:700;">
              ${st}
            </span>
          </td>
          <td style="padding:8px 12px; text-align:center;">
            <div style="display:inline-flex; align-items:center; justify-content:center; gap:5px; flex-wrap:nowrap;">
              <button class="btn btn-sm btn-info" onclick="tendersManager.openProjectHub('${t.id}')" title="فتح بطاقة المشروع 360°" style="padding:4px 10px; font-size:0.78rem; font-weight:700; display:inline-flex; align-items:center; gap:4px; border-radius:6px; white-space:nowrap;">
                <span>👁️</span> بطاقة المشروع
              </button>
              ${this.can('edit', t) ? `
                <button class="btn btn-sm btn-outline" onclick="tendersManager.openEditForm('${t.id}')" title="تعديل بيانات العطاء" style="padding:4px 8px; font-size:0.78rem; font-weight:700; border-radius:6px; white-space:nowrap;">
                  ✏️ تعديل
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline" onclick="tendersManager.printTenderDossier('${t.id}')" title="طباعة ملف العطاء الرسمي" style="padding:4px 8px; font-size:0.78rem; border-radius:6px;">
                🖨️
              </button>
              ${this.can('delete', t) ? `
                <button class="btn btn-sm btn-danger" onclick="tendersManager.deleteTender('${t.id}')" title="حذف العطاء" style="padding:4px 7px; font-size:0.78rem; border-radius:6px;">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;

    const totalVal = this.filteredData.reduce((acc, t) => acc + parseFloat(t.awardedValue || t.value || t.estimatedValue || 0), 0);
    if (footer) {
      footer.innerHTML = `
        <span>إجمالي العطاءات المعروضة: <b>${this.filteredData.length}</b> عطاء</span>
        <span>مجموع القيمة المالية: <b style="color:#10b981;">${totalVal.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</b></span>
      `;
    }
  }

  /* ─── إظهار / إخفاء تفاصيل بنود الموازنة ─────────────────────────────── */
  _toggleBudgetDetails() {
    const cont = document.getElementById('tender-budget-breakdown-container');
    const icon = document.getElementById('tender-budget-details-icon');
    const text = document.getElementById('tender-budget-details-text');
    if (!cont) return;
    if (cont.style.display === 'none' || !cont.style.display) {
      cont.style.display = 'block';
      if (icon) icon.textContent = '▲';
      if (text) text.textContent = 'إخفاء تفاصيل البنود';
    } else {
      cont.style.display = 'none';
      if (icon) icon.textContent = '📊';
      if (text) text.textContent = 'تفاصيل بنود الموازنة';
    }
  }

  /* ─── تحديث مؤشرات الأداء الحية (KPI Dashboard) ─────────────────────── */
  _updateKpiDashboard() {
    const totalCount = this.tendersData.length;
    let totalVal = 0;
    let worksCount = 0;
    let worksVal = 0;
    let suppliesCount = 0;
    let suppliesVal = 0;
    let activeCount = 0;

    this.tendersData.forEach(t => {
      const val = parseFloat(t.awardedValue || t.value || t.estimatedValue || 0);
      totalVal += val;

      const type = t.tenderType || 'أشغال';
      if (type === 'أشغال') {
        worksCount++;
        worksVal += val;
      } else if (type === 'لوازم') {
        suppliesCount++;
        suppliesVal += val;
      }

      const st = t.status || 'مفتوح';
      if (st === 'قيد التنفيذ' || st === 'مُحال' || st === 'مفتوح') {
        activeCount++;
      }
    });

    const setT = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    setT('tender-kpi-total-count', totalCount + ' عطاء');
    setT('tender-kpi-total-val', totalVal.toLocaleString('ar-JO', { minimumFractionDigits: 3 }) + ' د.أ');

    setT('tender-kpi-works-count', worksCount + ' مشروع');
    setT('tender-kpi-works-val', worksVal.toLocaleString('ar-JO', { minimumFractionDigits: 3 }) + ' د.أ');

    setT('tender-kpi-supplies-count', suppliesCount + ' عطاء');
    setT('tender-kpi-supplies-val', suppliesVal.toLocaleString('ar-JO', { minimumFractionDigits: 3 }) + ' د.أ');

    setT('tender-kpi-active-count', activeCount + ' مشروع');

    // 🏛️ تحديث الموقف المالي العام لموازنة مشاريع المديرية
    const budgetLines = this.budgetLines || [];
    const totalAllocated = budgetLines.reduce((acc, b) => acc + parseFloat(b.allocated_amount || 0), 0);
    const totalCommitted = totalVal; // إجمالي قيمة العطاءات الملتزم بها
    const approvedClaims = (this.claimsData || []).filter(c => String(c.status || '').includes('معتمدة'));
    const totalSpent = approvedClaims.reduce((acc, c) => acc + parseFloat(c.amount || c.value || 0), 0);
    const totalAvailable = Math.max(0, totalAllocated - totalCommitted);

    const commitPct = totalAllocated > 0 ? Math.min(100, Math.round((totalCommitted / totalAllocated) * 100)) : 0;
    const spentPct = totalAllocated > 0 ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100)) : 0;
    const availPct = totalAllocated > 0 ? Math.max(0, 100 - commitPct) : 0;

    setT('tender-budget-allocated-val', totalAllocated.toLocaleString('ar-JO', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.أ');
    setT('tender-budget-lines-count', `${budgetLines.length} بنود موازنة معتمدة`);

    setT('tender-budget-committed-val', totalCommitted.toLocaleString('ar-JO', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.أ');
    setT('tender-budget-commit-pct', `نسبة الارتباط: ${commitPct}%`);

    setT('tender-budget-spent-val', totalSpent.toLocaleString('ar-JO', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.أ');
    setT('tender-budget-spent-pct', `نسبة الصرف: ${spentPct}%`);

    setT('tender-budget-available-val', totalAvailable.toLocaleString('ar-JO', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.أ');
    setT('tender-budget-avail-pct', `المتبقي للتخصيص: ${availPct}%`);

    setT('tender-budget-progress-label', `الارتباط: ${commitPct}% | الصرف الفعلي: ${spentPct}% | الرصيد الحر: ${availPct}%`);

    const spentBar = document.getElementById('tender-budget-spent-bar');
    if (spentBar) spentBar.style.width = `${spentPct}%`;

    const commitBar = document.getElementById('tender-budget-commit-bar');
    if (commitBar) commitBar.style.width = `${Math.max(0, commitPct - spentPct)}%`;

    // قائمة تفصيل بنود الموازنة
    const listCont = document.getElementById('tender-budget-breakdown-list');
    if (listCont) {
      listCont.innerHTML = budgetLines.map(b => {
        const bAlloc = parseFloat(b.allocated_amount || 0);
        const bTenders = this.tendersData.filter(t => String(t.budget_line_id || t.budgetLineId) === String(b.id));
        const bCommitted = bTenders.reduce((sum, t) => sum + parseFloat(t.awardedValue || t.value || t.estimatedValue || 0), 0);
        const bPct = bAlloc > 0 ? Math.min(100, Math.round((bCommitted / bAlloc) * 100)) : 0;
        return `
          <div style="background:rgba(255,255,255,0.06); padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); font-size:0.78rem;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; color:#38bdf8; margin-bottom:4px;">
              <span>[${b.line_code || b.id}] ${b.line_name}</span>
              <span style="color:${bPct > 90 ? '#ef4444' : '#34d399'};">${bPct}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:0.72rem; margin-bottom:4px;">
              <span>المخصص: ${bAlloc.toLocaleString('ar-JO')} د.أ</span>
              <span>المحجوز: ${bCommitted.toLocaleString('ar-JO')} د.أ (${bTenders.length} عطاء)</span>
            </div>
            <div style="background:rgba(255,255,255,0.1); height:4px; border-radius:2px; overflow:hidden;">
              <div style="background:${bPct > 90 ? '#ef4444' : '#38bdf8'}; width:${bPct}%; height:100%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  /* ─── فتح نموذج إنشاء عطاء جديد ─────────────────────────────────────── */
  openCreateForm() {
    if (!this.can('create')) {
      if (typeof showToast === 'function') showToast('🚫 عذراً، ليس لديك صلاحية طرح عطاءات جديدة', 'error');
      return;
    }
    this.activeTender = null;
    this.boqItems = [];
    this._renderFormView(null);
    this._switchView('form');
  }

  /* ─── فتح نموذج تعديل أو استنساخ عطاء ────────────────────────────────── */
  openEditForm(id, draftItem = null) {
    let item = draftItem;
    if (!item && id) {
      item = this.tendersData.find(x => String(x.id) === String(id));
    }
    if (!item && !draftItem) return;

    if (id && !draftItem && !this.can('edit', item)) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية لتعديل هذا العطاء', 'error');
      return;
    }

    this.activeTender = item;
    try {
      this.boqItems = typeof item.boqItemsJson === 'string' ? JSON.parse(item.boqItemsJson || '[]') : (item.boqItemsJson || []);
    } catch(e) {
      this.boqItems = [];
    }

    this._renderFormView(item, !!id && !draftItem);
    this._switchView('form');
  }

  /* ─── تصيير شاشة إدخال وتعديل العطاء المخصصة ────────────────────────── */
  _renderFormView(item, isActualEdit = null) {
    const formView = document.getElementById('tenders-view-form');
    if (!formView) return;

    const isEdit = isActualEdit !== null ? isActualEdit : (!!item && !!item.id);
    const titleText = isEdit ? `تعديل بيانات العطاء / المشروع: ${item.id} — ${item.name}` : (item ? `استنساخ عطاء جديد: ${item.name}` : 'طرح وتسجيل عطاء / مشروع هندسي جديد');

    const val = item ? parseFloat(item.value || item.awardedValue || item.estimatedValue || 0) : 0;
    const estVal = item ? parseFloat(item.estimatedValue || val || 0) : 0;
    const awdVal = item ? parseFloat(item.awardedValue || val || 0) : 0;
    const voVal = item ? parseFloat(item.variationOrdersValue || 0) : 0;
    const currentAttach = item ? (item.attachmentPath || item.file || '') : '';

    const tenderRoleMap = {
      admin: 'مدير النظام',
      director_public_works: 'مدير الأشغال',
      head_of_roads: 'رئيس قسم الطرق',
      head_of_buildings: 'رئيس قسم الأبنية',
      roads_engineer: 'مهندس طرق',
      buildings_engineer: 'مهندس أبنية',
      quantity_surveyor: 'حاسب كميات',
      site_inspector: 'مراقب',
      qa_qc_engineer: 'مهندس ضبط الجودة',
      land_surveyor: 'مساح'
    };
    let engineerOpts = '<option value="">-- اختر المهندس المشرف --</option>';
    this.usersList.forEach(u => {
      const isSel = item && (item.supervisorEngineer === u.fullName || item.supervisorEngineer === u.id);
      engineerOpts += `<option value="${u.fullName}" ${isSel ? 'selected' : ''}>${u.fullName} (${tenderRoleMap[u.role] || u.role})</option>`;
    });

    let budgetLineOpts = '<option value="">-- يرجى اختيار بند الموازنة المعتمد (إجباري) * --</option>';
    (this.budgetLines || []).forEach(b => {
      const isSel = item && (item.budget_line_id === b.id || item.budgetLineId === b.id);
      const avail = parseFloat(b.available_commitment || 0);
      budgetLineOpts += `<option value="${b.id}" ${isSel ? 'selected' : ''}>[${b.chapter_code || ''} - ${b.line_code || b.id}] ${b.line_name} (المتاح للارتباط: ${Math.round(avail).toLocaleString('ar-JO')} د.أ)</option>`;
    });

    const s = this.systemSettings || {};
    const mayorC = parseFloat(s.mayor_purchase_ceiling_jod !== undefined ? s.mayor_purchase_ceiling_jod : 5000);
    const localC = parseFloat(s.local_committee_ceiling_jod !== undefined ? s.local_committee_ceiling_jod : 20000);
    const mainC = parseFloat(s.main_committee_ceiling_jod !== undefined ? s.main_committee_ceiling_jod : 100000);

    const commVal = item ? (item.purchaseCommittee || 'لجنة الشراء المحلية') : 'لجنة الشراء المحلية';
    const isMayor = (commVal === 'الرئيس' || commVal === 'رئيس البلدية');
    const isLocal = (commVal === 'لجنة الشراء المحلية' || commVal === 'المحلية');
    const isMain = (commVal === 'لجنة الشراء الرئيسية' || commVal === 'الرئيسية');

    const committeeOpts = `
      <option value="الرئيس" ${isMayor ? 'selected' : ''}>رئيس البلدية (سقف حتى ${Math.round(mayorC).toLocaleString('ar-JO')} د.أ)</option>
      <option value="لجنة الشراء المحلية" ${(!item || isLocal) ? 'selected' : ''}>لجنة الشراء المحلية (سقف حتى ${Math.round(localC).toLocaleString('ar-JO')} د.أ)</option>
      <option value="لجنة الشراء الرئيسية" ${isMain ? 'selected' : ''}>لجنة الشراء الرئيسية (سقف حتى ${Math.round(mainC).toLocaleString('ar-JO')} د.أ)</option>
    `;

    formView.innerHTML = `
      <div style="max-width:1100px; margin:0 auto; padding-bottom:40px;">
        
        <!-- شريط الترويسة والرجوع -->
        <div class="card" style="padding:14px 20px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-right:4px solid var(--primary);">
          <div>
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">
              <a href="javascript:void(0)" onclick="tendersManager._switchView('list')" style="color:var(--primary); text-decoration:none;">قائمة العطاءات</a> / ${isEdit ? 'تعديل عطاء' : 'طرح جديد'}
            </span>
            <h3 style="margin:4px 0 0; font-size:1.25rem; font-weight:800; color:var(--text-main);">${titleText}</h3>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-outline" onclick="tendersManager._switchView('list')">✕ إلغاء ورجوع</button>
            <button type="button" class="btn btn-primary" onclick="tendersManager.saveTenderForm()" style="font-weight:800;">
              💾 ${isEdit ? 'تحديث وحفظ التعديلات' : 'اعتماد وحفظ العطاء'}
            </button>
          </div>
        </div>

        <form id="tender-detailed-form" onsubmit="event.preventDefault(); tendersManager.saveTenderForm();" style="display:flex; flex-direction:column; gap:16px;">
          <input type="hidden" id="tender-f-id" value="${item ? item.id : ''}">
          <input type="hidden" id="tender-f-existing-attach" value="${currentAttach}">

          <!-- القسم 1: هوية وبيانات العطاء الإدارية -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:1.2rem;">📌</span>
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">1. الهوية الإدارية وتصنيف العطاء</h4>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
              <div class="form-group" style="grid-column:1 / -1;">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">اسم العطاء / المشروع الكامل *</label>
                <input type="text" id="tender-f-name" class="form-control" value="${item ? (item.name || '') : ''}" placeholder="مثال: عطاء فتح وتعبيد شوارع كفرنجة وعين البستان بالخلطة الساخنة" required style="width:100%; font-weight:700;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">رقم العطاء الرسمي</label>
                <input type="text" id="tender-f-number" class="form-control" value="${item ? (item.tenderNumber || item.id || '') : ''}" placeholder="مثال: 5/2026 أو T-2026-05" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">نوع العطاء *</label>
                <select id="tender-f-type" class="form-control" style="width:100%;">
                  <option value="أشغال" ${(!item || item.tenderType === 'أشغال') ? 'selected' : ''}>أشغال عامة وهندسية</option>
                  <option value="لوازم" ${item && item.tenderType === 'لوازم' ? 'selected' : ''}>لوازم وتوريدات</option>
                  <option value="استشارات" ${item && item.tenderType === 'استشارات' ? 'selected' : ''}>دراسات واستشارات هندسية</option>
                </select>
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">طريقة الشراء *</label>
                <select id="tender-f-method" class="form-control" style="width:100%;" onchange="tendersManager._recalcFormFinancials()">
                  <option value="مناقصة عامة" ${!item || item.purchaseMethod === 'مناقصة عامة' ? 'selected' : ''}>مناقصة عامة</option>
                  <option value="مناقصة محدودة" ${item && item.purchaseMethod === 'مناقصة محدودة' ? 'selected' : ''}>مناقصة محدودة</option>
                  <option value="استدراج عروض" ${item && item.purchaseMethod === 'استدراج عروض' ? 'selected' : ''}>استدراج عروض</option>
                  <option value="شراء مباشر" ${item && item.purchaseMethod === 'شراء مباشر' ? 'selected' : ''}>شراء مباشر</option>
                </select>
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">لجنة الشراء المختصة *</label>
                <select id="tender-f-committee" class="form-control" style="width:100%; font-weight:700;" onchange="tendersManager._recalcFormFinancials()">
                  ${committeeOpts}
                </select>
                <div id="tender-f-committee-ceiling-badge" style="font-size:0.78rem; margin-top:4px;"></div>
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المنطقة / الحي</label>
                <input type="text" id="tender-f-district" class="form-control" value="${item ? (item.district || 'كفرنجة') : 'كفرنجة'}" placeholder="مثال: كفرنجة / حي النزهة" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">الحالة التنفيذية</label>
                <select id="tender-f-status" class="form-control" style="width:100%;">
                  <option value="مفتوح" ${!item || item.status === 'مفتوح' ? 'selected' : ''}>مفتوح / قيد الطرح</option>
                  <option value="قيد الدراسة" ${item && item.status === 'قيد الدراسة' ? 'selected' : ''}>قيد الدراسة والتقييم</option>
                  <option value="مُحال" ${item && item.status === 'مُحال' ? 'selected' : ''}>مُحال / بانتظار توقيع العقد</option>
                  <option value="قيد التنفيذ" ${item && item.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ والمباشرة</option>
                  <option value="مُنجز" ${item && item.status === 'مُنجز' ? 'selected' : ''}>مُنجز / مستلم أولياً</option>
                  <option value="منتهي" ${item && item.status === 'منتهي' ? 'selected' : ''}>منتهي ومستلم نهائياً</option>
                  <option value="ملغي" ${item && item.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
                </select>
              </div>
            </div>
          </div>

          <!-- القسم 2: البيانات المالية والموازنات -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:1.2rem;">💰</span>
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">2. القيم المالية والتعاقدية (دينار أردني)</h4>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <div class="form-group" style="grid-column:1 / -1; background:rgba(15,118,110,0.06); border:1px solid #0f766e40; border-radius:8px; padding:10px 12px;">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; color:#0f766e;">
                  <span>💵 بند الموازنة العامة المعتمد للمشروع (Directorate Budget Line) *</span>
                  <span style="color:#ef4444; font-size:0.75rem; font-weight:800; background:rgba(239,68,68,0.1); padding:2px 8px; border-radius:4px; border:1px solid rgba(239,68,68,0.2);">حقل إجباري</span>
                </label>
                <select id="tender-f-budget-line" class="form-control" style="width:100%; font-weight:700; border-color:#0f766e;" required>
                  ${budgetLineOpts}
                </select>
                <div style="font-size:0.75rem; color:#64748b; margin-top:4px;">
                  ⚠️ ربط إجباري: يتم حجز المخصص المالي تلقائياً ومطابقته مع سقف الموازنة المتاح للبلدية قبل الاعتماد.
                </div>
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">القيمة التقديرية (د.أ)</label>
                <input type="text" inputmode="decimal" id="tender-f-est-value" class="form-control" value="${estVal}" placeholder="0.000" oninput="tendersManager._recalcFormFinancials()" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">قيمة الإحالة / العقد الأساسي (د.أ) *</label>
                <input type="text" inputmode="decimal" id="tender-f-awd-value" class="form-control" value="${awdVal}" placeholder="0.000" oninput="tendersManager._recalcFormFinancials()" style="width:100%; font-weight:700; color:#10b981 !important;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">مجموع الأوامر التغييرية (د.أ)</label>
                <input type="text" inputmode="decimal" id="tender-f-vo-value" class="form-control" value="${voVal}" placeholder="0.000" oninput="tendersManager._recalcFormFinancials()" style="width:100%; color:#f59e0b;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">القيمة الإجمالية المعدلة للعقد</label>
                <div id="tender-f-total-contract-val" style="padding:8px 12px; background:rgba(16,185,129,0.1); border:1px solid #10b98140; border-radius:6px; font-size:1.05rem; font-weight:800; color:#10b981; text-align:center;">
                  ${(awdVal + voVal).toFixed(3)} د.أ
                </div>
              </div>
            </div>
          </div>

          <!-- القسم 3: الأطراف والضمانات والكفالات -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:1.2rem;">🤝</span>
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">3. الأطراف المتعاقدة، الإشراف، والكفالات</h4>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">اسم المقاول / الشركة المنفذة *</label>
                <input type="text" id="tender-f-contractor" class="form-control" value="${item ? (item.contractor || '') : ''}" placeholder="اسم المقاول أو المورد المعتمد" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المهندس المشرف / ممثل البلدية</label>
                <select id="tender-f-supervisor" class="form-control" style="width:100%;">
                  ${engineerOpts}
                </select>
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">رقم كفالة حسن التنفيذ</label>
                <input type="text" id="tender-f-bond-num" class="form-control" value="${item ? (item.performanceBondNumber || '') : ''}" placeholder="مثال: BG-2026-99" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">قيمة كفالة حسن التنفيذ (د.أ)</label>
                <input type="text" inputmode="decimal" id="tender-f-bond-val" class="form-control" value="${item ? (item.performanceBondValue || '') : ''}" placeholder="0.000" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ انتهاء الكفالة</label>
                <input type="date" id="tender-f-bond-exp" class="form-control" value="${item ? (item.performanceBondExpiry || '') : ''}" style="width:100%;">
              </div>
            </div>
          </div>

          <!-- القسم 4: المدد الزمنية والتواريخ ومراحل الاستلام -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:1.2rem;">📅</span>
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">4. المدد التعاقدية والتواريخ الزمنية</h4>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ الطرح والإعلان</label>
                <input type="date" id="tender-f-open-date" class="form-control" value="${item ? (item.openDate || '') : ''}" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ إغلاق وفتح العروض</label>
                <input type="date" id="tender-f-close-date" class="form-control" value="${item ? (item.closeDate || '') : ''}" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ توقيع الاتفاقية</label>
                <input type="date" id="tender-f-sign-date" class="form-control" value="${item ? (item.contractSignDate || '') : ''}" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ أمر المباشرة</label>
                <input type="date" id="tender-f-commence-date" class="form-control" value="${item ? (item.commencementDate || '') : ''}" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المدة التعاقدية (بالأيام)</label>
                <input type="number" id="tender-f-duration-days" class="form-control" value="${item ? (item.durationDays || 60) : 60}" placeholder="60" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">نسبة الإنجاز الفعلي %</label>
                <input type="number" min="0" max="100" id="tender-f-completion-pct" class="form-control" value="${item ? (item.completionPercentage || 0) : 0}" placeholder="0" style="width:100%; color:#3b82f6; font-weight:700;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ الاستلام الأولي</label>
                <input type="date" id="tender-f-prelim-date" class="form-control" value="${item ? (item.preliminaryHandoverDate || '') : ''}" style="width:100%;">
              </div>

              <div class="form-group">
                <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">تاريخ الاستلام النهائي</label>
                <input type="date" id="tender-f-final-date" class="form-control" value="${item ? (item.finalHandoverDate || '') : ''}" style="width:100%;">
              </div>
            </div>
          </div>

          <!-- القسم 5: محدد الموقع الجغرافي GIS المتقدم -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.2rem;">🗺️</span>
                <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">5. الخريطة التفاعلية الفضائية وتحديد موقع المشروع (GIS)</h4>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._toggleMapLayer()" id="tenders-btn-map-layer">
                  🛰️ التبديل للأقمار الصناعية
                </button>
              </div>
            </div>


            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
              <div>
                <label style="font-size:0.8rem; font-weight:bold; color:var(--text-muted);">خط العرض (Latitude)</label>
                <input type="text" id="tender-f-lat" class="form-control" value="${item ? (item.lat || 32.3301) : 32.3301}" onchange="tendersManager._onManualCoordChange()" style="width:100%; font-weight:700;">
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:bold; color:var(--text-muted);">خط الطول (Longitude)</label>
                <input type="text" id="tender-f-lng" class="form-control" value="${item ? (item.lng || 35.7501) : 35.7501}" onchange="tendersManager._onManualCoordChange()" style="width:100%; font-weight:700;">
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">🗺️ حيز الخريطة التفاعلية:</span>
              <div style="display:inline-flex; border:1px solid var(--border); border-radius:4px; overflow:hidden;">
                <button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:0.72rem;" onclick="tendersManager._setFormMapHeight('300px', this)">صغيرة (300px)</button>
                <button type="button" class="btn btn-sm btn-primary" style="padding:2px 6px; font-size:0.72rem;" onclick="tendersManager._setFormMapHeight('440px', this)">متوسطة (440px)</button>
                <button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:0.72rem;" onclick="tendersManager._setFormMapHeight('600px', this)">واسعة (600px)</button>
              </div>
            </div>

            <div id="tender-modal-map" style="height:440px; width:100%; border-radius:10px; border:2px solid var(--border); box-shadow:inset 0 2px 6px rgba(0,0,0,0.1); z-index:1; transition:height 0.3s ease;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:0.78rem; color:var(--text-muted);">
              <span>💡 انقر على الخريطة أو اسحب المؤشر لتحديد موقع تنفيذ المشروع بدقة.</span>
              <span id="tender-map-coord-badge" style="background:var(--bg-surface); padding:2px 8px; border-radius:4px; border:1px solid var(--border); font-family:monospace;">32.330100, 35.750100</span>
            </div>
          </div>

          <!-- القسم 6: جدول بنود الكميات والمواصفات (BOQ Table) -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.2rem;">📑</span>
                <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">6. جدول بنود الأعمال والكميات التعاقدية (BOQ)</h4>
              </div>
              <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._addBoqRow()" style="font-weight:700;">
                ➕ إضافة بند عمل
              </button>
            </div>

            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
                <thead>
                  <tr style="background:var(--bg-card-hover); border-bottom:2px solid var(--border);">
                    <th style="padding:6px; width:40px; text-align:center;">#</th>
                    <th style="padding:6px;">وصف بند العمل</th>
                    <th style="padding:6px; width:90px; text-align:center;">الوحدة</th>
                    <th style="padding:6px; width:100px; text-align:center;">الكمية</th>
                    <th style="padding:6px; width:110px; text-align:center;">سعر الفئة (د.أ)</th>
                    <th style="padding:6px; width:120px; text-align:center;">الإجمالي (د.أ)</th>
                    <th style="padding:6px; width:40px; text-align:center;"></th>
                  </tr>
                </thead>
                <tbody id="tender-boq-tbody">
                  <!-- توليد ديناميكي لأسطر البنود -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- القسم 7: الملاحظات والمرفقات الرسمية المتقدمة -->
          <div class="card" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <span style="font-size:1.2rem;">📝</span>
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1rem;">7. الملاحظات والوثائق والمرفقات الرسمية</h4>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">ملاحظات وشروط إضافية للعطاء</label>
              <textarea id="tender-f-notes" class="form-control" rows="3" placeholder="أدخل أي شروط خاصة، قرارات مجلس بلدي، أو تفاصيل تنفيذية..." style="width:100%;">${item ? (item.notes || '') : ''}</textarea>
            </div>

            <!-- عرض المرفق الحالي إن وجد مع تدقيق الصلاحيات -->
            ${currentAttach ? `
              <div id="tender-current-attach-box" style="background:var(--bg-surface); border:1px solid #10b98140; border-radius:8px; padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:1.6rem;">📎</span>
                  <div>
                    <div style="font-weight:bold; font-size:0.9rem; color:var(--text-main); direction:ltr; text-align:right;">${currentAttach.split(/[/\\]/).pop()}</div>
                    <div style="font-size:0.75rem; color:#10b981; font-weight:bold;">محفوظ في الأرشيف الإلكتروني المشفر للبلدية</div>
                  </div>
                </div>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm btn-info" onclick="tendersManager.previewDocument('${item.id}', '${currentAttach}')" title="معاينة فورية بدون تحميل">
                    👁️ معاينة فورية
                  </button>
                  ${this.can('download', item) ? `
                    <a href="/api/tenders/${item.id}/download" target="_blank" class="btn btn-sm btn-outline" title="تحميل الملف الأصلي">
                      📥 تحميل
                    </a>
                  ` : ''}
                  ${this.can('delete_attachment', item) ? `
                    <button type="button" class="btn btn-sm btn-danger" onclick="tendersManager.deleteAttachment('${item.id}')" title="حذف المرفق نهائياً من الأرشيف">
                      🗑️ حذف المرفق
                    </button>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- حقل رفع واستبدال المرفقات مشروط بالصلاحيات -->
            <div class="form-group">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">
                ${currentAttach ? 'استبدال / رفع ملف وثيقة جديد (PDF، صور، عقود، Excel، Word)' : 'إرفاق وثيقة العطاء / العقد (PDF، صور، عقود، Excel، Word)'}
              </label>
              ${this.can('upload_attachment', item) ? `
                <input type="file" id="tender-f-file" class="form-control" style="width:100%; padding:8px;" onchange="tendersManager._onFileSelected(this)">
                <div id="tender-file-info-badge" style="font-size:0.8rem; color:#0284c7; margin-top:4px; font-weight:bold; display:none;"></div>
              ` : `
                <div style="background:var(--bg-surface); padding:10px 14px; border-radius:6px; border:1px dashed var(--border); color:var(--text-muted); font-size:0.83rem;">
                  🔒 <b>صلاحية مقيدة:</b> رفع واستبدال المرفقات متاح فقط للمهندس المشرف المعتمد أو مسؤولي الإدارة الهندسية.
                </div>
              `}
            </div>
          </div>

          <!-- شريط الإجراءات السفلي -->
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button type="button" class="btn btn-outline" onclick="tendersManager._switchView('list')">✕ إلغاء ورجوع</button>
            <button type="submit" class="btn btn-primary" style="font-weight:800; padding:10px 24px;">
              💾 ${isEdit ? 'تحديث وحفظ التعديلات' : 'اعتماد وحفظ العطاء'}
            </button>
          </div>

        </form>
      </div>
    `;

    this._renderBoqRows();
    setTimeout(() => this._initFormMap(item), 200);
  }

  _onFileSelected(input) {
    const info = document.getElementById('tender-file-info-badge');
    if (!info) return;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      const mb = (f.size / (1024 * 1024)).toFixed(2);
      info.textContent = `📁 تم تحديد الملف: ${f.name} (الحجم: ${mb} ميجابايت)`;
      info.style.display = 'block';
    } else {
      info.style.display = 'none';
    }
  }

  /* ─── الخريطة التفاعلية الجغرافية المعتمدة للقائمة الرئيسية (Master GIS Map) ─── */
  _initMainMap() {
    const mapEl = document.getElementById('tenders-main-gis-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (this.mainMap) {
      try { this.mainMap.remove(); } catch(e) {}
      this.mainMap = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.mainMap = UnifiedGisEngine.createMap('tenders-main-gis-map', [32.3301, 35.7501], 13);
    } else {
      this.mainMap = createUnifiedMap('tenders-main-gis-map', [32.3301, 35.7501], 13);
    }

    if (typeof L.markerClusterGroup !== 'undefined') {
      this.mainMarkersGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 35,
        spiderfyOnMaxZoom: true
      }).addTo(this.mainMap);
    } else {
      this.mainMarkersGroup = L.featureGroup().addTo(this.mainMap);
    }

    this._renderMainMapMarkers();

    setTimeout(() => {
      if (this.mainMap) this.mainMap.invalidateSize();
    }, 200);
  }

  /* ─── رسم وإسقاط مشاريع العطاءات على الخريطة ────────────────────────── */
  _renderMainMapMarkers() {
    if (!this.mainMap || !this.mainMarkersGroup) return;

    this.mainMarkersGroup.clearLayers();

    const statsBadge = document.getElementById('tenders-map-stats-badge');
    let mappedCount = 0;
    const bounds = L.latLngBounds();

    this.filteredData.forEach(t => {
      const lat = parseFloat(t.lat);
      const lng = parseFloat(t.lng);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        mappedCount++;

        const st = t.status || 'مفتوح';
        let pinColor = '#0284c7';
        if (st === 'قيد التنفيذ' || st === 'مُحال') pinColor = '#8b5cf6';
        else if (st === 'مُنجز' || st === 'منتهي') pinColor = '#10b981';
        else if (st === 'ملغي' || st === 'مرفوض') pinColor = '#ef4444';
        else if (st === 'قيد الدراسة') pinColor = '#f59e0b';

        const iconSymbol = (t.tenderType === 'لوازم') ? '📦' : ((t.tenderType === 'استشارات') ? '📐' : '🏗️');

        const customIcon = L.divIcon({
          className: 'custom-project-pin',
          html: `
            <div style="position:relative; width:34px; height:34px; background:${pinColor}; border:2.5px solid #ffffff; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.35); font-size:16px; cursor:pointer; transition:transform 0.15s ease;">
              ${iconSymbol}
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const val = parseFloat(t.awardedValue || t.value || t.estimatedValue || 0);
        const comp = parseFloat(t.completionPercentage || 0);

        const marker = L.marker([lat, lng], { icon: customIcon });

        const popupContent = `
          <div style="direction:rtl; font-family:'Tajawal', sans-serif; text-align:right; min-width:240px; padding:4px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:6px;">
              <b style="color:#1e3a8a; font-size:0.95rem;">${t.name}</b>
              <span style="background:${pinColor}20; color:${pinColor}; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:bold; white-space:nowrap; margin-right:4px;">
                ${st}
              </span>
            </div>

            <div style="font-size:0.8rem; color:#475569; line-height:1.6; margin-bottom:8px;">
              <div><b>رقم العطاء:</b> ${t.id || t.tenderNumber || '—'}</div>
              <div><b>المقاول المنفذ:</b> ${t.contractor || 'غير محدد'}</div>
              <div><b>المهندس المشرف:</b> ${t.supervisorEngineer || 'غير محدد'}</div>
              <div><b>القيمة الإجمالية:</b> <b style="color:#0f766e;">${val.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</b></div>
              <div><b>نسبة الإنجاز:</b> ${comp}%</div>
              <div style="background:#e2e8f0; height:5px; border-radius:3px; overflow:hidden; margin-top:3px;">
                <div style="background:#10b981; width:${Math.min(100, comp)}%; height:100%;"></div>
              </div>
            </div>

            <div style="display:flex; gap:6px; margin-top:10px;">
              <button type="button" class="btn btn-sm btn-primary" style="flex:1; font-size:0.75rem; padding:4px 8px;" onclick="tendersManager.openProjectHub('${t.id}')">
                👁️ بطاقة المشروع
              </button>
              <button type="button" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:4px 8px;" onclick="tendersManager.openEditForm('${t.id}')">
                ✏️ تعديل
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        this.mainMarkersGroup.addLayer(marker);
        bounds.extend([lat, lng]);
      }
    });

    if (statsBadge) {
      statsBadge.textContent = `المشاريع المحددة جغرافياً: ${mappedCount} من إجمالي ${this.filteredData.length} عطاء`;
    }

    if (mappedCount > 0 && this.mainMap) {
      setTimeout(() => {
        try {
          this.mainMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        } catch(e) {}
      }, 100);
    }
  }

  /* ─── التحكم بحجم وارتفاع الخريطة التفاعلية ──────────────────────────── */
  _setMainMapHeight(heightStr, btnEl) {
    const mapEl = document.getElementById('tenders-main-gis-map');
    if (!mapEl) return;

    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('button').forEach(b => b.className = 'btn btn-sm btn-outline');
      btnEl.className = 'btn btn-sm btn-primary';
    }

    mapEl.style.height = heightStr;

    setTimeout(() => {
      if (this.mainMap) this.mainMap.invalidateSize();
    }, 320);
  }

  _fitMainMapBounds() {
    if (!this.mainMap || !this.mainMarkersGroup) return;
    try {
      const bounds = this.mainMarkersGroup.getBounds();
      if (bounds.isValid()) {
        this.mainMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        this.mainMap.setView([32.3301, 35.7501], 13);
      }
    } catch(e) {}
  }

  _toggleMainMapVisibility() {
    const mapEl = document.getElementById('tenders-main-gis-map');
    const iconEl = document.getElementById('tenders-toggle-map-icon');
    const textEl = document.getElementById('tenders-toggle-map-text');
    if (!mapEl) return;

    if (mapEl.style.display === 'none') {
      mapEl.style.display = 'block';
      if (iconEl) iconEl.textContent = '👁️';
      if (textEl) textEl.textContent = 'إخفاء الخريطة';
      setTimeout(() => {
        if (this.mainMap) this.mainMap.invalidateSize();
      }, 100);
    } else {
      mapEl.style.display = 'none';
      if (iconEl) iconEl.textContent = '🗺️';
      if (textEl) textEl.textContent = 'إظهار الخريطة';
    }
  }


  /* ─── إدارة خريطة نموذج الإدخال (Leaflet Map Overhaul) ──────────────── */
  _initFormMap(item) {
    const mapEl = document.getElementById('tender-modal-map');
    if (!mapEl || typeof L === 'undefined') return;

    const lat = item ? parseFloat(item.lat || 32.3301) : 32.3301;
    const lng = item ? parseFloat(item.lng || 35.7501) : 35.7501;

    if (this.modalMap) {
      this.modalMap.remove();
      this.modalMap = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.modalMap = UnifiedGisEngine.createMap('tender-modal-map', [lat, lng], 15);
    } else {
      this.modalMap = createUnifiedMap('tender-modal-map', [lat, lng], 15);
    }

    // Draggable Marker with pulsing badge
    const customIcon = L.divIcon({
      className: 'custom-tender-marker',
      html: `
        <div style="position:relative; display:flex; align-items:center; justify-content:center;">
          <div style="background:#ef4444; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(239,68,68,0.7); font-size:18px; border:2px solid white; cursor:grab;">
            🏗️
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    this.modalMarker = L.marker([lat, lng], {
      draggable: true,
      icon: customIcon
    }).addTo(this.modalMap);

    const updateCoordFields = (latVal, lngVal) => {
      const latInp = document.getElementById('tender-f-lat');
      const lngInp = document.getElementById('tender-f-lng');
      const badge = document.getElementById('tender-map-coord-badge');
      if (latInp) latInp.value = latVal.toFixed(6);
      if (lngInp) lngInp.value = lngVal.toFixed(6);
      if (badge) badge.textContent = `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`;
    };

    this.modalMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateCoordFields(pos.lat, pos.lng);
    });

    this.modalMap.on('click', (e) => {
      this.modalMarker.setLatLng(e.latlng);
      updateCoordFields(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      if (this.modalMap) this.modalMap.invalidateSize();
    }, 250);
  }

  _toggleMapLayer() {
    if (!this.modalMap) return;
    const btn = document.getElementById('tenders-btn-map-layer');
    if (this.currentMapMode === 'osm') {
      this.modalMap.removeLayer(this.osmLayer);
      this.satelliteLayer.addTo(this.modalMap);
      this.currentMapMode = 'satellite';
      if (btn) btn.innerHTML = '🗺️ التبديل لخريطة الشوارع';
    } else {
      this.modalMap.removeLayer(this.satelliteLayer);
      this.osmLayer.addTo(this.modalMap);
      this.currentMapMode = 'osm';
      if (btn) btn.innerHTML = '🛰️ التبديل للأقمار الصناعية';
    }
  }


  _onManualCoordChange() {
    const latInp = document.getElementById('tender-f-lat');
    const lngInp = document.getElementById('tender-f-lng');
    const lat = parseFloat(latInp ? latInp.value : 32.3301);
    const lng = parseFloat(lngInp ? lngInp.value : 35.7501);

    if (!isNaN(lat) && !isNaN(lng) && this.modalMap && this.modalMarker) {
      this.modalMarker.setLatLng([lat, lng]);
      this.modalMap.panTo([lat, lng]);
      const badge = document.getElementById('tender-map-coord-badge');
      if (badge) badge.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  _setFormMapHeight(heightStr, btnEl) {
    const mapEl = document.getElementById('tender-modal-map');
    if (!mapEl) return;
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('button').forEach(b => b.className = 'btn btn-sm btn-outline');
      btnEl.className = 'btn btn-sm btn-primary';
    }
    mapEl.style.height = heightStr;
    setTimeout(() => {
      if (this.modalMap) this.modalMap.invalidateSize();
    }, 320);
  }

  /* ─── إدارة جدول بنود الكميات (BOQ) ─────────────────────────────────── */
  _addBoqRow() {
    this.boqItems.push({
      itemDescription: '',
      unit: 'م2',
      qty: 100,
      unitPrice: 5.0
    });
    this._renderBoqRows();
  }

  _removeBoqRow(idx) {
    this.boqItems.splice(idx, 1);
    this._renderBoqRows();
  }

  _onBoqInput(idx, field, val) {
    if (this.boqItems[idx]) {
      this.boqItems[idx][field] = val;
      const amtEl = document.getElementById(`tender-boq-amt-${idx}`);
      if (amtEl) {
        const q = parseFloat(this.boqItems[idx].qty || 0);
        const p = parseFloat(this.boqItems[idx].unitPrice || 0);
        amtEl.textContent = (q * p).toFixed(3) + ' د.أ';
      }
    }
  }

  _renderBoqRows() {
    const tbody = document.getElementById('tender-boq-tbody');
    if (!tbody) return;

    if (!this.boqItems.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:15px; color:var(--text-muted);">
            لا توجد بنود كميات مضافة حالياً. انقر على "➕ إضافة بند عمل" لإدراج بنود العطاء.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.boqItems.map((b, idx) => {
      const q = parseFloat(b.qty || 0);
      const p = parseFloat(b.unitPrice || 0);
      const total = q * p;

      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="padding:6px;">
            <input type="text" class="form-control" value="${b.itemDescription || ''}" placeholder="وصف البند (مثال: خخلطة اسفلتية ساخنة سمك 5سم)" style="width:100%; font-size:0.83rem;" oninput="tendersManager._onBoqInput(${idx}, 'itemDescription', this.value)">
          </td>
          <td style="padding:6px;">
            <input type="text" class="form-control" value="${b.unit || 'م2'}" placeholder="الوحدة" style="width:100%; font-size:0.83rem; text-align:center;" oninput="tendersManager._onBoqInput(${idx}, 'unit', this.value)">
          </td>
          <td style="padding:6px;">
            <input type="number" step="any" class="form-control" value="${b.qty || 0}" placeholder="الكمية" style="width:100%; font-size:0.83rem; text-align:center;" oninput="tendersManager._onBoqInput(${idx}, 'qty', this.value)">
          </td>
          <td style="padding:6px;">
            <input type="number" step="any" class="form-control" value="${b.unitPrice || 0}" placeholder="السعر" style="width:100%; font-size:0.83rem; text-align:center;" oninput="tendersManager._onBoqInput(${idx}, 'unitPrice', this.value)">
          </td>
          <td style="padding:6px; text-align:center; font-weight:bold; color:#10b981;" id="tender-boq-amt-${idx}">
            ${total.toFixed(3)} د.أ
          </td>
          <td style="padding:6px; text-align:center;">
            <button type="button" class="btn btn-sm btn-danger" style="padding:2px 6px;" onclick="tendersManager._removeBoqRow(${idx})">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  _recalcFormFinancials() {
    const awdInp = document.getElementById('tender-f-awd-value');
    const voInp = document.getElementById('tender-f-vo-value');
    const estInp = document.getElementById('tender-f-est-value');
    const totEl = document.getElementById('tender-f-total-contract-val');
    const commSel = document.getElementById('tender-f-committee');
    const commBadge = document.getElementById('tender-f-committee-ceiling-badge');

    const awd = parseFloat(awdInp ? awdInp.value : 0) || 0;
    const vo = parseFloat(voInp ? voInp.value : 0) || 0;
    const est = parseFloat(estInp ? estInp.value : 0) || 0;
    const totalVal = awd > 0 ? (awd + vo) : est;

    if (totEl) {
      totEl.textContent = (awd + vo).toFixed(3) + ' د.أ';
    }

    if (commSel && commBadge) {
      const s = this.systemSettings || {};
      const mayorC = parseFloat(s.mayor_purchase_ceiling_jod !== undefined ? s.mayor_purchase_ceiling_jod : 5000);
      const localC = parseFloat(s.local_committee_ceiling_jod !== undefined ? s.local_committee_ceiling_jod : 20000);
      const mainC = parseFloat(s.main_committee_ceiling_jod !== undefined ? s.main_committee_ceiling_jod : 100000);

      const comm = commSel.value;
      let limit = Infinity;
      let commName = 'لجنة الشراء المحلية';
      if (comm === 'الرئيس' || comm === 'رئيس البلدية') { limit = mayorC; commName = 'رئيس البلدية'; }
      else if (comm === 'لجنة الشراء المحلية') { limit = localC; commName = 'لجنة الشراء المحلية'; }
      else if (comm === 'لجنة الشراء الرئيسية') { limit = mainC; commName = 'لجنة الشراء الرئيسية'; }

      if (totalVal > 0) {
        if (totalVal <= limit) {
          commBadge.innerHTML = `<span style="color:#10b981; font-weight:bold;">✅ القيمة (${totalVal.toLocaleString('ar-JO')} د.أ) ضمن السقف المعتمد لصلاحية [${commName}] (${limit.toLocaleString('ar-JO')} د.أ)</span>`;
          commBadge.style.display = 'block';
        } else {
          let rec = 'لجنة الشراء الرئيسية';
          if (totalVal > mainC) rec = 'لجنة الشراء المركزية / مجلس بلدي';
          commBadge.innerHTML = `<span style="color:#ef4444; font-weight:800; background:rgba(239,68,68,0.1); padding:3px 8px; border-radius:4px; border:1px solid rgba(239,68,68,0.3); display:inline-block;">⚠️ تنبيه: القيمة (${totalVal.toLocaleString('ar-JO')} د.أ) تتجاوز سقف صلاحية [${commName}] (${limit.toLocaleString('ar-JO')} د.أ) - يُوصى بالتحويل إلى [${rec}]</span>`;
          commBadge.style.display = 'block';
        }
      } else {
        commBadge.style.display = 'none';
      }
    }
  }

  /* ─── حفظ نموذج العطاء والمرفقات في قاعدة البيانات ─────────────────── */
  async saveTenderForm() {
    const idVal = document.getElementById('tender-f-id').value.trim();
    const name = document.getElementById('tender-f-name').value.trim();
    const tenderNumber = document.getElementById('tender-f-number').value.trim();
    const tenderType = document.getElementById('tender-f-type').value;
    const purchaseMethod = document.getElementById('tender-f-method').value;
    const purchaseCommittee = document.getElementById('tender-f-committee').value;
    const district = document.getElementById('tender-f-district').value.trim();
    const status = document.getElementById('tender-f-status').value;

    const estimatedValue = parseFloat(document.getElementById('tender-f-est-value').value) || 0;
    const awardedValue = parseFloat(document.getElementById('tender-f-awd-value').value) || 0;
    const variationOrdersValue = parseFloat(document.getElementById('tender-f-vo-value').value) || 0;
    const value = awardedValue > 0 ? awardedValue : estimatedValue;

    const contractor = document.getElementById('tender-f-contractor').value.trim();
    const supervisorEngineer = document.getElementById('tender-f-supervisor').value;
    const performanceBondNumber = document.getElementById('tender-f-bond-num').value.trim();
    const performanceBondValue = parseFloat(document.getElementById('tender-f-bond-val').value) || 0;
    const performanceBondExpiry = document.getElementById('tender-f-bond-exp').value;

    const openDate = document.getElementById('tender-f-open-date').value;
    const closeDate = document.getElementById('tender-f-close-date').value;
    const contractSignDate = document.getElementById('tender-f-sign-date').value;
    const commencementDate = document.getElementById('tender-f-commence-date').value;
    const durationDays = parseInt(document.getElementById('tender-f-duration-days').value) || 0;
    const completionPercentage = parseFloat(document.getElementById('tender-f-completion-pct').value) || 0;
    const preliminaryHandoverDate = document.getElementById('tender-f-prelim-date').value;
    const finalHandoverDate = document.getElementById('tender-f-final-date').value;

    const lat = parseFloat(document.getElementById('tender-f-lat').value) || 32.3301;
    const lng = parseFloat(document.getElementById('tender-f-lng').value) || 35.7501;
    const notes = document.getElementById('tender-f-notes').value.trim();
    const existingAttach = document.getElementById('tender-f-existing-attach').value;
    const budget_line_id = document.getElementById('tender-f-budget-line')?.value || '';

    if (!name) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم المشروع / العطاء', 'warning');
      return;
    }

    if (!budget_line_id) {
      if (typeof showToast === 'function') showToast('⚠️ يرجى تحديد واختيار بند الموازنة العامة المعتمد للمشروع (حقل إجباري)', 'warning');
      const bLineInput = document.getElementById('tender-f-budget-line');
      if (bLineInput) {
        bLineInput.focus();
        bLineInput.style.borderColor = '#ef4444';
      }
      return;
    }

    // التحقق من السقف المالي لصلاحية لجنة الشراء المختصة
    const s = this.systemSettings || {};
    const mayorC = parseFloat(s.mayor_purchase_ceiling_jod !== undefined ? s.mayor_purchase_ceiling_jod : 5000);
    const localC = parseFloat(s.local_committee_ceiling_jod !== undefined ? s.local_committee_ceiling_jod : 20000);
    const mainC = parseFloat(s.main_committee_ceiling_jod !== undefined ? s.main_committee_ceiling_jod : 100000);

    let ceiling = Infinity;
    let commName = purchaseCommittee;
    if (purchaseCommittee === 'الرئيس' || purchaseCommittee === 'رئيس البلدية') { ceiling = mayorC; commName = 'رئيس البلدية'; }
    else if (purchaseCommittee === 'لجنة الشراء المحلية') { ceiling = localC; commName = 'لجنة الشراء المحلية'; }
    else if (purchaseCommittee === 'لجنة الشراء الرئيسية') { ceiling = mainC; commName = 'لجنة الشراء الرئيسية'; }

    if (s.enforce_committee_ceilings !== false && value > ceiling) {
      const confirmOverride = confirm(`⚠️ تنبيه تدقيق الصلاحيات المالية:\nقيمة العطاء (${value.toLocaleString('ar-JO')} د.أ) تتجاوز السقف المالي المحدد لصلاحية [${commName}] البالغ (${ceiling.toLocaleString('ar-JO')} د.أ).\n\nهل ترغب بالاستمرار والحفظ استثنائياً؟`);
      if (!confirmOverride) {
        if (typeof showToast === 'function') showToast(`⚠️ يرجى تعديل لجنة الشراء لتتناسب مع سقف القيمة المالية`, 'warning');
        return;
      }
    }

    const payload = {
      id: idVal || undefined,
      name,
      tenderNumber: tenderNumber || idVal,
      tenderType,
      purchaseMethod,
      purchaseCommittee,
      district,
      status,
      estimatedValue,
      awardedValue,
      variationOrdersValue,
      value,
      contractor,
      supervisorEngineer,
      performanceBondNumber,
      performanceBondValue,
      performanceBondExpiry,
      openDate,
      closeDate,
      contractSignDate,
      commencementDate,
      durationDays,
      completionPercentage,
      preliminaryHandoverDate,
      finalHandoverDate,
      lat,
      lng,
      notes,
      budget_line_id,
      budgetLineId: budget_line_id,
      attachmentPath: existingAttach,
      boqItemsJson: JSON.stringify(this.boqItems || [])
    };

    const isEdit = !!idVal;

    // فحص الصلاحيات بصرامة
    if (isEdit && !this.can('edit', { id: idVal, supervisorEngineer })) {
      if (typeof showToast === 'function') showToast('🚫 عذراً، ليس لديك صلاحية تعديل هذا العطاء', 'error');
      return;
    }
    if (!isEdit && !this.can('create')) {
      if (typeof showToast === 'function') showToast('🚫 عذراً، ليس لديك صلاحية طرح عطاء جديد', 'error');
      return;
    }

    const url = isEdit ? `/api/tenders/${idVal}` : '/api/tenders';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const fileInput = document.getElementById('tender-f-file');
      let res;

      if (fileInput && fileInput.files && fileInput.files[0]) {
        const formData = new FormData();
        Object.keys(payload).forEach(k => {
          if (payload[k] !== undefined && payload[k] !== null) {
            formData.append(k, payload[k]);
          }
        });
        formData.append('file', fileInput.files[0]);

        // Clean headers without Content-Type so browser sets boundary
        const headers = this._getAuthHeaders(false);
        res = await fetch(url, { method, headers, body: formData });
      } else {
        res = await fetch(url, {
          method,
          headers: this._getAuthHeaders(true),
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (res.ok && (json.success !== false)) {
        if (typeof showToast === 'function') showToast(`تم ${isEdit ? 'تحديث' : 'حفظ'} العطاء والمرفقات بنجاح ✅`, 'success');
        this._switchView('list');
        await this.loadData();
      } else {
        if (typeof showToast === 'function') showToast('فشل في حفظ العطاء: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch (err) {
      console.error('Save tender error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
  }

  /* ─── معاينة الوثائق والمرفقات المتعددة دون تحميل (Multi-Format Document Previewer) ─── */
  async previewDocument(tenderId, filename) {
    const item = this.tendersData.find(t => String(t.id) === String(tenderId));
    const actualAttach = (item && (item.attachmentPath || item.file)) || filename;
    if (!actualAttach) {
      if (typeof showToast === 'function') showToast('⚠️ لا توجد وثيقة مرفقة لهذا العطاء أو تم حذفها نهائياً', 'warning');
      return;
    }

    const modal = document.getElementById('tender-doc-preview-modal');
    const titleEl = document.getElementById('tender-doc-preview-title');
    const bodyEl = document.getElementById('tender-doc-preview-body');
    const downBtn = document.getElementById('tender-doc-preview-download');
    if (!modal || !bodyEl) return;

    const fileUrl = `/api/tenders/${tenderId}/download?preview=1`;
    const downloadUrl = `/api/tenders/${tenderId}/download`;

    const fname = actualAttach;
    const ext = fname.split('.').pop().toLowerCase();

    if (titleEl) {
      titleEl.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;">📄 معاينة: <b>${fname.split(/[/\\]/).pop()}</b> <span style="background:var(--primary); color:#fff; font-size:0.75rem; padding:2px 8px; border-radius:4px; text-transform:uppercase;">${ext}</span></span>`;
    }
    if (downBtn) downBtn.href = downloadUrl;

    modal.style.display = 'flex';
    bodyEl.innerHTML = `
      <div style="text-align:center; padding:40px; color:#fff;">
        <div class="spinner" style="margin:0 auto 12px; border-top-color:#38bdf8;"></div>
        <div style="font-size:0.95rem; font-weight:bold;">جارٍ تحميل ومعالجة الوثيقة للمعاينة الفورية...</div>
      </div>
    `;

    try {
      // 1. معاينة الصور (Images Preview مع أدوات التكبير والتدوير)
      if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'bmp'].includes(ext)) {
        bodyEl.innerHTML = `
          <div style="width:100%; height:100%; display:flex; flex-direction:column; background:#0f172a;">
            <div style="display:flex; justify-content:center; gap:10px; padding:10px; background:#1e293b; border-bottom:1px solid #334155;">
              <button type="button" class="btn btn-sm btn-outline" onclick="window._tenderImgZoom(1.2)" style="color:#fff;">🔍 تكبير (+)</button>
              <button type="button" class="btn btn-sm btn-outline" onclick="window._tenderImgZoom(0.8)" style="color:#fff;">🔍 تصغير (-)</button>
              <button type="button" class="btn btn-sm btn-outline" onclick="window._tenderImgRotate()" style="color:#fff;">🔄 تدوير</button>
              <button type="button" class="btn btn-sm btn-outline" onclick="window._tenderImgReset()" style="color:#fff;">↺ إعادة ضبط</button>
            </div>
            <div style="flex:1; overflow:auto; display:flex; justify-content:center; align-items:center; padding:20px;">
              <img id="tender-preview-img" src="${fileUrl}" alt="${fname}" style="max-width:90%; max-height:90%; object-fit:contain; border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.5); transition:transform 0.2s ease;">
            </div>
          </div>
        `;
        window._tenderImgScale = 1;
        window._tenderImgAngle = 0;
        window._tenderImgZoom = (factor) => {
          window._tenderImgScale = Math.max(0.2, Math.min(5, (window._tenderImgScale || 1) * factor));
          const img = document.getElementById('tender-preview-img');
          if (img) img.style.transform = `scale(${window._tenderImgScale}) rotate(${window._tenderImgAngle || 0}deg)`;
        };
        window._tenderImgRotate = () => {
          window._tenderImgAngle = ((window._tenderImgAngle || 0) + 90) % 360;
          const img = document.getElementById('tender-preview-img');
          if (img) img.style.transform = `scale(${window._tenderImgScale || 1}) rotate(${window._tenderImgAngle}deg)`;
        };
        window._tenderImgReset = () => {
          window._tenderImgScale = 1;
          window._tenderImgAngle = 0;
          const img = document.getElementById('tender-preview-img');
          if (img) img.style.transform = `scale(1) rotate(0deg)`;
        };
        return;
      }

      // 2. معاينة مستندات الوورد (Word .docx Preview via Mammoth.js)
      if (['docx', 'doc'].includes(ext)) {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('فشل جلب ملف الوورد من الخادم');
        const arrayBuffer = await response.arrayBuffer();

        if (typeof mammoth !== 'undefined') {
          const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
          const docHtml = result.value || '<p style="color:#64748b;">المستند فارغ.</p>';

          bodyEl.innerHTML = `
            <div style="width:100%; height:100%; overflow:auto; background:#475569; padding:24px; display:flex; justify-content:center;">
              <div style="width:100%; max-width:850px; min-height:100%; background:#ffffff; color:#0f172a; padding:40px 50px; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.3); font-family:'Tajawal', 'Calibri', sans-serif; line-height:1.8; direction:rtl; text-align:right;">
                <div style="border-bottom:2px solid #e2e8f0; padding-bottom:12px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:bold; color:#1e3a8a; font-size:1.1rem;">📄 مستند Word: ${fname.split(/[/\\]/).pop()}</span>
                  <button type="button" class="btn btn-sm btn-outline" onclick="window.print()" style="color:#0f172a;">🖨️ طباعة المستند</button>
                </div>
                <div class="word-doc-content" style="font-size:1rem;">
                  ${docHtml}
                </div>
              </div>
            </div>
          `;
        } else {
          // Fallback if Mammoth CDN unavailable
          bodyEl.innerHTML = `
            <div style="padding:40px; text-align:center; color:#fff;">
              <div style="font-size:3rem; margin-bottom:12px;">📝</div>
              <h3 style="color:#fff; margin-bottom:8px;">مستند Microsoft Word (${fname.split(/[/\\]/).pop()})</h3>
              <p style="color:#cbd5e1; max-width:500px; margin:0 auto 20px;">يمكنك تحميل المستند مباشرة لفتحه في Microsoft Word أو تطبيق المستندات المفضل لديك.</p>
              <a href="${downloadUrl}" class="btn btn-primary" style="padding:10px 24px; font-weight:bold;">📥 تحميل المستند الآن</a>
            </div>
          `;
        }
        return;
      }

      // 3. معاينة جداول الإكسل (Excel .xlsx / .xls / .csv via SheetJS)
      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('فشل جلب ملف الإكسل من الخادم');
        const arrayBuffer = await response.arrayBuffer();

        if (typeof XLSX !== 'undefined') {
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetNames = workbook.SheetNames || [];

          if (sheetNames.length === 0) {
            bodyEl.innerHTML = '<p style="color:#fff; padding:30px;">ملف الإكسل لا يحتوي على أوراق عمل.</p>';
            return;
          }

          window._activeWorkbook = workbook;

          const sheetTabsHtml = sheetNames.map((s, idx) => `
            <button type="button" class="btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-outline'}" onclick="window._tenderShowSheet('${s}', this)">
              📊 ${s}
            </button>
          `).join('');

          bodyEl.innerHTML = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; background:#0f172a; overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#1e293b; border-bottom:1px solid #334155; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; overflow-x:auto;">
                  ${tabsHtml}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="text" id="excel-sheet-search" placeholder="🔍 بحث داخل الجدول..." class="form-control" style="width:180px; padding:4px 8px; font-size:0.8rem; height:30px; background:#0f172a; color:#fff; border-color:#475569;" oninput="window._tenderFilterSheet(this.value)">
                </div>
              </div>
              <div id="tender-excel-sheet-container" style="flex:1; overflow:auto; padding:16px; background:#ffffff;"></div>
            </div>
          `;

          window._tenderShowSheet = (sheetName, btnEl) => {
            if (btnEl) {
              btnEl.parentElement.querySelectorAll('button').forEach(b => {
                b.className = 'btn btn-sm btn-outline';
              });
              btnEl.className = 'btn btn-sm btn-primary';
            }
            const sheet = window._activeWorkbook.Sheets[sheetName];
            if (!sheet) return;
            const html = XLSX.utils.sheet_to_html(sheet, { id: 'excel-preview-table', editable: false });
            const cont = document.getElementById('tender-excel-sheet-container');
            if (cont) {
              cont.innerHTML = `
                <div style="direction:rtl; font-family:'Tajawal', sans-serif;">
                  <style>
                    #excel-preview-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
                    #excel-preview-table th, #excel-preview-table td { border:1px solid #cbd5e1; padding:6px 10px; text-align:right; }
                    #excel-preview-table tr:first-child { background:#1e3a8a; color:#ffffff; font-weight:bold; }
                    #excel-preview-table tr:nth-child(even) { background:#f8fafc; }
                    #excel-preview-table tr:hover { background:#e0f2fe; }
                  </style>
                  ${html}
                </div>
              `;
            }
          };

          window._tenderFilterSheet = (query) => {
            const q = query.trim().toLowerCase();
            const table = document.getElementById('excel-preview-table');
            if (!table) return;
            const rows = table.querySelectorAll('tr');
            rows.forEach((r, idx) => {
              if (idx === 0) return; // Keep header
              const text = r.textContent.toLowerCase();
              r.style.display = !q || text.includes(q) ? '' : 'none';
            });
          };

          // Render first sheet by default
          window._tenderShowSheet(sheetNames[0], null);
        } else {
          bodyEl.innerHTML = `
            <div style="padding:40px; text-align:center; color:#fff;">
              <div style="font-size:3rem; margin-bottom:12px;">📊</div>
              <h3 style="color:#fff; margin-bottom:8px;">جدول بيانات Excel (${fname})</h3>
              <p style="color:#cbd5e1; max-width:500px; margin:0 auto 20px;">يمكنك تحميل الملف مباشرة لفتحه في Microsoft Excel.</p>
              <a href="${downloadUrl}" class="btn btn-primary" style="padding:10px 24px; font-weight:bold;">📥 تحميل الجدول الآن</a>
            </div>
          `;
        }
        return;
      }

      // 4. معاينة النصوص والبيانات البرمجية (Text / JSON / Logs / CSV)
      if (['txt', 'json', 'log', 'xml', 'sql'].includes(ext)) {
        const response = await fetch(downloadUrl);
        const text = await response.text();
        bodyEl.innerHTML = `
          <div style="width:100%; height:100%; overflow:auto; padding:20px; background:#0f172a;">
            <pre style="margin:0; font-family:monospace; font-size:0.9rem; color:#38bdf8; background:#1e293b; padding:18px; border-radius:8px; border:1px solid #334155; line-height:1.6; white-space:pre-wrap; direction:ltr; text-align:left;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        `;
        return;
      }

      // 5. معاينة ملفات الـ PDF كخيار أساسي أو افتراضي
      bodyEl.innerHTML = `
        <iframe src="${fileUrl}" style="width:100%; height:100%; border:none; background:#525659;" title="${fname}"></iframe>
      `;

    } catch (err) {
      console.error('Document preview error:', err);
      bodyEl.innerHTML = `
        <div style="padding:40px; text-align:center; color:#fff;">
          <div style="font-size:3rem; margin-bottom:12px;">⚠️</div>
          <h3 style="color:#f87171; margin-bottom:8px;">تعذر عرض المعاينة التلقائية للوثيقة</h3>
          <p style="color:#cbd5e1; max-width:500px; margin:0 auto 20px;">حدث خطأ أثناء قراءة الملف أو أن صيغة الملف تتطلب فتحها عبر التطبيق المخصص.</p>
          <a href="${downloadUrl}" class="btn btn-primary" style="padding:10px 24px; font-weight:bold;">📥 تحميل الملف الأصلي</a>
        </div>
      `;
    }
  }

  /* ─── حذف المرفق والوثيقة الرسمية للعطاء ───────────────────────────── */
  async deleteAttachment(tenderId) {
    const item = this.tendersData.find(t => String(t.id) === String(tenderId));
    if (!item) return;

    if (!this.can('delete_attachment', item)) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية لحذف المرفقات والوثائق الرسمية', 'error');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف الملف المرفق للعطاء:\n"${item.name}" نهائياً من الأرشيف؟`)) {
      return;
    }

    try {
      this._setLoading(true);
      const payload = {
        ...item,
        attachmentPath: '',
        file: ''
      };

      const res = await fetch(`/api/tenders/${tenderId}`, {
        method: 'PUT',
        headers: this._getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success !== false) {
        if (typeof showToast === 'function') showToast('🗑️ تم حذف الملف المرفق من الأرشيف بنجاح', 'success');
        item.attachmentPath = '';
        item.file = '';
        const existingInput = document.getElementById('tender-f-existing-attach');
        if (existingInput) existingInput.value = '';
        const attachBox = document.getElementById('tender-current-attach-box');
        if (attachBox) attachBox.remove();
        await this.loadData();
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل حذف الملف: ' + (data.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Delete attachment error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء حذف المرفق', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  _closeDocPreview() {
    const modal = document.getElementById('tender-doc-preview-modal');
    const bodyEl = document.getElementById('tender-doc-preview-body');
    if (modal) modal.style.display = 'none';
    if (bodyEl) bodyEl.innerHTML = '';
  }

  /* ─── حذف عطاء بصرامة وأمان ─────────────────────────────────────────── */
  async deleteTender(id) {
    const item = this.tendersData.find(t => String(t.id) === String(id));
    if (!item) return;

    if (!this.can('delete', item)) {
      if (typeof showToast === 'function') showToast('🚫 إجراء محظور: صلاحية حذف العطاءات محصورة بالإدارة العليا فقط', 'error');
      return;
    }

    const confirmMsg = `⚠️ تحذير أمني هام:\n\nهل أنت متأكد تماماً من حذف العطاء:\n"${item.name}" (رقم: ${item.id})؟\n\nهذا الإجراء سيقوم بحذف كافة السجلات والمرفقات نهائياً ولا يمكن التراجع عنه.`;
    if (!confirm(confirmMsg)) return;

    try {
      this._setLoading(true);
      const res = await fetch(`/api/tenders/${id}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders(true)
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        if (typeof showToast === 'function') showToast('🗑️ تم حذف العطاء من قاعدة البيانات بنجاح', 'success');
        this.tendersData = this.tendersData.filter(t => String(t.id) !== String(id));
        this.applyFilters();
        this._updateKpiDashboard();
        if (this.currentView === 'hub' || this.currentView === 'form') {
          this._switchView('list');
        }
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل الحذف: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Delete error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  /* ─── استنساخ وتكرار العطاء (Duplicate Tender) ───────────────────────── */
  duplicateTender(id) {
    if (!this.can('duplicate')) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية استنساخ العطاءات', 'error');
      return;
    }

    const item = this.tendersData.find(t => String(t.id) === String(id));
    if (!item) {
      if (typeof showToast === 'function') showToast('لم يتم العثور على العطاء المراد استنساخه', 'error');
      return;
    }

    if (!confirm(`هل أنت متأكد من رغبتك في إنشاء نسخة جديدة من العطاء:\n"${item.name}"؟`)) {
      return;
    }

    const cloned = {
      ...item,
      id: '', // New ID on save
      tenderNumber: (item.tenderNumber || item.id || '') + '-نسخة',
      name: item.name + ' (نسخة مستنسخة)',
      status: 'مفتوح',
      completionPercentage: 0,
      openDate: new Date().toISOString().split('T')[0],
      closeDate: '',
      contractSignDate: '',
      commencementDate: '',
      preliminaryHandoverDate: '',
      finalHandoverDate: '',
      attachmentPath: '',
      file: ''
    };

    this.openEditForm(null, cloned);
    if (typeof showToast === 'function') showToast('📋 تم استنساخ بيانات العطاء كمسودة جديدة جاهزة للمراجعة والحفظ', 'info');
  }

  /* ─── نافذة تغيير وتحديث الحالة ومسار الاعتماد ────────────────────────── */
  openStatusModal(id) {
    const item = this.tendersData.find(t => String(t.id) === String(id));
    if (!item) return;

    if (!this.can('status', item)) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية لتغيير ومتابعة حالة هذا العطاء', 'error');
      return;
    }

    const modal = document.getElementById('tender-status-modal');
    const idInput = document.getElementById('tender-status-id');
    const nameEl = document.getElementById('tender-status-target-name');
    const selectEl = document.getElementById('tender-status-select');
    const notesEl = document.getElementById('tender-status-notes');

    if (!modal) return;

    if (idInput) idInput.value = item.id;
    if (nameEl) nameEl.textContent = `${item.name} (${item.id || item.tenderNumber || ''}) — [الحالة الحالية: ${item.status || 'مفتوح'}]`;
    if (selectEl) selectEl.value = item.status || 'مفتوح';
    if (notesEl) notesEl.value = '';

    modal.style.display = 'flex';
  }

  _closeStatusModal() {
    const modal = document.getElementById('tender-status-modal');
    if (modal) modal.style.display = 'none';
  }

  async _submitStatusTransition() {
    const id = document.getElementById('tender-status-id').value;
    const newStatus = document.getElementById('tender-status-select').value;
    const notes = document.getElementById('tender-status-notes').value.trim();

    if (!id || !newStatus) return;

    const item = this.tendersData.find(t => String(t.id) === String(id));
    if (!item) return;

    if (!this.can('status', item)) {
      if (typeof showToast === 'function') showToast('🚫 ليس لديك صلاحية لاعتماد تغيير الحالة', 'error');
      return;
    }

    try {
      this._setLoading(true);
      const user = this.getCurrentUser();
      const updatedNotes = notes 
        ? `${item.notes || ''}\n[${new Date().toLocaleDateString('ar-JO')}]: تغيير الحالة إلى (${newStatus}) بواسطة (${user.fullName || user.role}) — ${notes}`
        : item.notes;

      const payload = {
        ...item,
        status: newStatus,
        notes: updatedNotes
      };

      const res = await fetch(`/api/tenders/${id}`, {
        method: 'PUT',
        headers: this._getAuthHeaders(true),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success !== false) {
        if (typeof showToast === 'function') showToast(`✅ تم تحديث حالة العطاء إلى (${newStatus}) بنجاح`, 'success');
        this._closeStatusModal();
        await this.loadData();
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل تحديث الحالة: ' + (data.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Status update error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  /* ─── فتح بطاقة المشروع الشاملة (Project 360° Hub) ───────────────────── */
  openProjectHub(id) {
    const item = this.tendersData.find(x => String(x.id) === String(id));
    if (!item) return;

    this.activeTender = item;
    const hubView = document.getElementById('tenders-view-hub');
    if (!hubView) return;

    const val = parseFloat(item.awardedValue || item.value || item.estimatedValue || 0);
    const est = parseFloat(item.estimatedValue || val);
    const vo = parseFloat(item.variationOrdersValue || 0);
    const totalContract = val + vo;
    const attach = item.attachmentPath || item.file || '';

    // Filter linked claims for this tender
    const linkedClaims = this.claimsData.filter(c => String(c.tenderId) === String(item.id) || String(c.tender_id) === String(item.id));
    const totalClaimsPaid = linkedClaims.reduce((acc, c) => acc + parseFloat(c.amount || 0), 0);
    const remainingContractBal = Math.max(0, totalContract - totalClaimsPaid);
    const claimsDisbursedPct = totalContract > 0 ? ((totalClaimsPaid / totalContract) * 100).toFixed(1) : '0.0';
    const completionPct = parseFloat(item.completionPercentage || 0);

    // حساب تاريخ الإنجاز المتوقع بناءً على تاريخ المباشرة والمدة العقدية
    let expectedEndDate = '—';
    if (item.commencementDate && item.durationDays) {
      try {
        const cDate = new Date(item.commencementDate);
        if (!isNaN(cDate.getTime())) {
          cDate.setDate(cDate.getDate() + parseInt(item.durationDays));
          expectedEndDate = cDate.toISOString().split('T')[0];
        }
      } catch(e) {}
    }

    // تلوين وشارة الحالة
    const st = item.status || 'مفتوح';
    let stBg = 'rgba(2, 132, 199, 0.15)', stColor = '#38bdf8', stBorder = 'rgba(2, 132, 199, 0.4)';
    if (st === 'قيد التنفيذ' || st === 'مُحال') {
      stBg = 'rgba(139, 92, 246, 0.15)'; stColor = '#a78bfa'; stBorder = 'rgba(139, 92, 246, 0.4)';
    } else if (st === 'مُنجز' || st === 'منتهي') {
      stBg = 'rgba(16, 185, 129, 0.15)'; stColor = '#34d399'; stBorder = 'rgba(16, 185, 129, 0.4)';
    } else if (st === 'ملغي' || st === 'مرفوض') {
      stBg = 'rgba(239, 68, 68, 0.15)'; stColor = '#f87171'; stBorder = 'rgba(239, 68, 68, 0.4)';
    } else if (st === 'قيد الدراسة') {
      stBg = 'rgba(245, 158, 11, 0.15)'; stColor = '#fbbf24'; stBorder = 'rgba(245, 158, 11, 0.4)';
    }

    // بند الموازنة
    const bLine = (this.budgetLines || []).find(b => String(b.id) === String(item.budget_line_id || item.budgetLineId));
    const budgetDisplay = bLine 
      ? `[${bLine.line_code || bLine.id}] ${bLine.line_name}` 
      : 'غير محدد بموازنة رسمية';

    let boqRows = [];
    try {
      boqRows = typeof item.boqItemsJson === 'string' ? JSON.parse(item.boqItemsJson || '[]') : (item.boqItemsJson || []);
    } catch(e) {}

    const lat = parseFloat(item.lat || 32.3301);
    const lng = parseFloat(item.lng || 35.7501);

    hubView.innerHTML = `
      <style>
        .tender-hub-wrapper {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          padding: 4px 6px 40px;
          box-sizing: border-box;
        }
        .tender-hub-header-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 14px;
          padding: 20px 24px;
          margin-bottom: 20px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .tender-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 22px;
        }
        .tender-kpi-card {
          background: var(--bg-card, rgba(30, 41, 59, 0.6));
          border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .tender-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        .tender-tabs-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          padding: 6px;
          background: var(--bg-surface, rgba(15, 23, 42, 0.6));
          border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          border-radius: 12px;
          overflow-x: auto;
        }
        .tender-tab-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 9px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted, #94a3b8);
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .tender-tab-nav-btn:hover {
          color: var(--text-main, #f8fafc);
          background: rgba(255, 255, 255, 0.05);
        }
        .tender-tab-nav-btn.active {
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
          border-color: rgba(56, 189, 248, 0.4);
        }
        .tender-hub-layout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .tender-hub-layout-grid {
            grid-template-columns: 1fr;
          }
        }
        .tender-info-grid-tiles {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 12px;
        }
        .tender-info-tile {
          background: var(--bg-surface, rgba(15, 23, 42, 0.5));
          border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s ease;
        }
        .tender-info-tile:hover {
          transform: translateY(-2px);
          border-color: rgba(56, 189, 248, 0.35);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
        }
        .tender-tile-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
        }
      </style>

      <div class="tender-hub-wrapper">
        
        <!-- الهيدر التنفيذي لبطاقة المشروع 360° -->
        <div class="tender-hub-header-card">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
              <a href="javascript:void(0)" onclick="tendersManager._switchView('list')" style="color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                <span>📋</span> قائمة العطاءات والمشاريع
              </a>
              <span>/</span>
              <span style="color: #a78bfa;">بطاقة المشروع الشاملة 360°</span>
            </div>

            <h2 style="margin: 0 0 10px; font-size: 1.45rem; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; line-height: 1.4;">
              <span>🏛️ ${item.name}</span>
            </h2>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82rem;">
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.35); padding: 4px 10px; border-radius: 6px; font-weight: 800;">
                # ${item.id || item.tenderNumber}
              </span>
              <span class="badge" style="background: ${stBg}; color: ${stColor}; border: 1px solid ${stBorder}; padding: 4px 10px; border-radius: 6px; font-weight: 800;">
                ● حالة العطاء: ${st}
              </span>
              <span class="badge" style="background: rgba(2, 132, 199, 0.12); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                🏗️ ${item.tenderType || 'أشغال هندسية'}
              </span>
              <span class="badge" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                📍 ${item.district || 'بلدية كفرنجة'}
              </span>
              ${bLine ? `
                <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700;">
                  💵 موازنة: [${bLine.line_code || bLine.id}] ${bLine.line_name}
                </span>
              ` : ''}
            </div>
          </div>

          <!-- شريط الإجراءات السريعة -->
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline" onclick="tendersManager.printTenderDossier('${item.id}')" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; padding: 8px 14px; border-radius: 8px;">
              <span>🖨️</span> طباعة ملف المشروع
            </button>
            ${this.can('status', item) ? `
              <button type="button" class="btn btn-outline" onclick="tendersManager.openStatusModal('${item.id}')" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; padding: 8px 14px; border-radius: 8px; border-color: rgba(139, 92, 246, 0.5); color: #a78bfa;">
                <span>🔄</span> تغيير الحالة
              </button>
            ` : ''}
            ${this.can('edit', item) ? `
              <button type="button" class="btn btn-primary" onclick="tendersManager.openEditForm('${item.id}')" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 800; padding: 8px 16px; border-radius: 8px;">
                <span>✏️</span> تعديل بيانات العطاء
              </button>
            ` : ''}
            <button type="button" class="btn btn-outline" onclick="tendersManager._switchView('list')" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px;" title="العودة للقائمة">
              <span>✕</span> رجوع
            </button>
          </div>
        </div>

        <!-- بطاقات المؤشرات المالية والزمنية التنفيذية (KPI Cards) -->
        <div class="tender-kpi-grid">
          
          <!-- بطاقة القيمة الإجمالية للعقد -->
          <div class="tender-kpi-card" style="border-right: 4px solid #10b981;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700;">قيمة العقد الإجمالية</span>
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
                💰
              </div>
            </div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #10b981; line-height: 1.2;">
              ${totalContract.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} <span style="font-size: 0.9rem; font-weight: 700;">د.أ</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>أساسي: ${val.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</span>
              <span>أوامر: ${vo.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</span>
            </div>
          </div>

          <!-- بطاقة المطالبات المصروفة -->
          <div class="tender-kpi-card" style="border-right: 4px solid #0284c7;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700;">إجمالي المطالبات المصروفة</span>
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(2, 132, 199, 0.12); color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
                💳
              </div>
            </div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #0284c7; line-height: 1.2;">
              ${totalClaimsPaid.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} <span style="font-size: 0.9rem; font-weight: 700;">د.أ</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>${linkedClaims.length} دفعات ومطالبات</span>
              <span style="color: #38bdf8; font-weight: 700;">${claimsDisbursedPct}% من العقد</span>
            </div>
          </div>

          <!-- بطاقة الرصيد المالي المتبقي -->
          <div class="tender-kpi-card" style="border-right: 4px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700;">الرصيد المالي المتبقي</span>
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(245, 158, 11, 0.12); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
                ⚖️
              </div>
            </div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #f59e0b; line-height: 1.2;">
              ${remainingContractBal.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} <span style="font-size: 0.9rem; font-weight: 700;">د.أ</span>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>المتبقي من سقف العقد</span>
              <span style="color: #fbbf24; font-weight: 700;">${(100 - parseFloat(claimsDisbursedPct)).toFixed(1)}% متبقي</span>
            </div>
          </div>

          <!-- بطاقة نسبة الإنجاز الفعلي -->
          <div class="tender-kpi-card" style="border-right: 4px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700;">نسبة الإنجاز الفعلي</span>
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
                📈
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <div style="font-size: 1.55rem; font-weight: 900; color: #8b5cf6; line-height: 1.2;">
                ${completionPct}%
              </div>
              <span style="font-size: 0.76rem; color: var(--text-muted);">
                المدة: ${item.durationDays || '—'} يوم
              </span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.08); height: 8px; border-radius: 4px; margin-top: 8px; overflow: hidden; position: relative;">
              <div style="background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%); width: ${Math.min(100, completionPct)}%; height: 100%; border-radius: 4px; transition: width 0.6s ease;"></div>
            </div>
          </div>

        </div>

        <!-- أشرطة التبويبات الفرعية لبطاقة المشروع 360° -->
        <div class="tender-tabs-bar">
          <button type="button" id="tender-tab-btn-overview" class="tender-tab-nav-btn active" onclick="tendersManager.switchHubSubTab('overview')">
            <span>📋</span> البيانات التعاقدية وجدول الكميات (BOQ)
          </button>
          <button type="button" id="tender-tab-btn-daily-reports" class="tender-tab-nav-btn" onclick="tendersManager.switchHubSubTab('daily-reports')">
            <span>📝</span> التقارير اليومية وسجل الموقع (<span id="tender-hub-reports-count">...</span>)
          </button>
          <button type="button" id="tender-tab-btn-claims" class="tender-tab-nav-btn" onclick="tendersManager.switchHubSubTab('claims')">
            <span>💰</span> المطالبات والدفعات المالية (${linkedClaims.length})
          </button>
        </div>

        <!-- 1. تبويب البيانات التعاقدية وجدول الكميات والخريطة -->
        <div id="tender-hub-subtab-overview" class="tender-hub-subtab-pane">
          <div class="tender-hub-layout-grid">
            
            <!-- العمود الأيمن: تفاصيل العقد والبيانات الهندسية وجدول الكميات -->
            <div style="display: flex; flex-direction: column; gap: 18px;">
              
              <!-- بطاقة البيانات التعاقدية والتنفيذية المصنفة -->
              <div class="card" style="padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                  <h4 style="margin: 0; font-weight: 800; color: var(--text-main); font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                    <span>📋</span> البيانات التعاقدية والتنفيذية
                  </h4>
                  <span style="font-size: 0.78rem; color: var(--text-muted);">سجل معتمد بمديرية الأشغال</span>
                </div>
                
                <div class="tender-info-grid-tiles">
                  
                  <!-- المقاول المنفذ -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(2, 132, 199, 0.12); color: #38bdf8;">🏢</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">المقاول المنفذ</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.contractor || '—'}">
                        ${item.contractor || '—'}
                      </div>
                    </div>
                  </div>

                  <!-- المهندس المشرف -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(16, 185, 129, 0.12); color: #34d399;">👷</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">المهندس المشرف</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.supervisorEngineer || '—'}">
                        ${item.supervisorEngineer || '—'}
                      </div>
                    </div>
                  </div>

                  <!-- بند الموازنة المرتبط -->
                  <div class="tender-info-tile" style="grid-column: span 2;">
                    <div class="tender-tile-icon-box" style="background: rgba(245, 158, 11, 0.12); color: #fbbf24;">💵</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">بند الموازنة المرتبط</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${budgetDisplay}">
                        ${budgetDisplay}
                      </div>
                    </div>
                  </div>

                  <!-- نوع العطاء -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(139, 92, 246, 0.12); color: #a78bfa;">🏗️</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">نوع وتصنيف العطاء</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.tenderType || 'أشغال'}
                      </div>
                    </div>
                  </div>

                  <!-- طريقة الشراء -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(6, 182, 212, 0.12); color: #22d3ee;">🏷️</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">طريقة الشراء</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.purchaseMethod || 'مناقصة عامة'}
                      </div>
                    </div>
                  </div>

                  <!-- لجنة الشراء -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(236, 72, 153, 0.12); color: #f472b6;">🏛️</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">لجنة الشراء المختصة</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.purchaseCommittee || 'لجنة الشراء المحلية'}
                      </div>
                    </div>
                  </div>

                  <!-- المنطقة / الحي -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(34, 197, 94, 0.12); color: #4ade80;">📍</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">المنطقة / الحي</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.district || 'كفرنجة'}
                      </div>
                    </div>
                  </div>

                  <!-- تاريخ الطرح -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(99, 102, 241, 0.12); color: #818cf8;">📅</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">تاريخ الطرح</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.openDate || '—'}
                      </div>
                    </div>
                  </div>

                  <!-- أمر المباشرة -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(234, 88, 12, 0.12); color: #fb923c;">🚀</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">تاريخ أمر المباشرة</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.commencementDate || '—'}
                      </div>
                    </div>
                  </div>

                  <!-- المدة العقدية وتاريخ الانتهاء -->
                  <div class="tender-info-tile">
                    <div class="tender-tile-icon-box" style="background: rgba(168, 85, 247, 0.12); color: #c084fc;">⏳</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">المدة العقدية</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        ${item.durationDays || '—'} يوم ${expectedEndDate !== '—' ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(حتى ${expectedEndDate})</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <!-- كفالة حسن التنفيذ -->
                  <div class="tender-info-tile" style="grid-column: span 2;">
                    <div class="tender-tile-icon-box" style="background: rgba(20, 184, 166, 0.12); color: #2dd4bf;">🛡️</div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">كفالة حسن التنفيذ</div>
                      <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-main);">
                        رقم: <b>${item.performanceBondNumber || '—'}</b> | القيمة: <b style="color:#10b981;">${parseFloat(item.performanceBondValue || 0).toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</b>
                      </div>
                    </div>
                  </div>

                  ${item.notes ? `
                    <!-- ملاحظات وقرارات -->
                    <div class="tender-info-tile" style="grid-column: 1 / -1; align-items: flex-start;">
                      <div class="tender-tile-icon-box" style="background: rgba(100, 116, 139, 0.12); color: #94a3b8;">📝</div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">ملاحظات وقرارات المجلس البلدي</div>
                        <div style="font-size: 0.84rem; color: var(--text-main); line-height: 1.5; white-space: pre-line;">
                          ${item.notes}
                        </div>
                      </div>
                    </div>
                  ` : ''}

                </div>
              </div>

              <!-- جدول بنود الكميات والمواصفات (إن وجدت) -->
              ${boqRows.length ? `
                <div class="card" style="padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                    <h4 style="margin: 0; font-weight: 800; color: var(--text-main); font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                      <span>📑</span> بنود الأعمال والكميات التعاقدية (BOQ)
                    </h4>
                    <span class="badge" style="background: rgba(2, 132, 199, 0.15); color: #38bdf8; font-weight: 800; padding: 3px 8px; border-radius: 6px;">
                      ${boqRows.length} بند
                    </span>
                  </div>
                  <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.85rem;">
                      <thead>
                        <tr style="background: var(--bg-surface); border-bottom: 2px solid var(--border);">
                          <th style="padding: 8px 10px; text-align: center; width: 40px;">#</th>
                          <th style="padding: 8px 10px;">وصف البند الهندسي</th>
                          <th style="padding: 8px 10px; text-align: center; width: 70px;">الوحدة</th>
                          <th style="padding: 8px 10px; text-align: center; width: 80px;">الكمية</th>
                          <th style="padding: 8px 10px; text-align: center; width: 100px;">السعر (د.أ)</th>
                          <th style="padding: 8px 10px; text-align: center; width: 110px;">الإجمالي (د.أ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${boqRows.map((b, i) => `
                          <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 8px 10px; text-align: center; color: var(--text-muted); font-weight: 700;">${i+1}</td>
                            <td style="padding: 8px 10px; font-weight: 700; color: var(--text-main);">${b.itemDescription || '—'}</td>
                            <td style="padding: 8px 10px; text-align: center;">${b.unit || '—'}</td>
                            <td style="padding: 8px 10px; text-align: center; font-weight: 700;">${b.qty || 0}</td>
                            <td style="padding: 8px 10px; text-align: center;">${parseFloat(b.unitPrice || 0).toFixed(3)}</td>
                            <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #10b981;">
                              ${(parseFloat(b.qty || 0) * parseFloat(b.unitPrice || 0)).toFixed(3)}
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : ''}

            </div>

            <!-- العمود الأيسر: الخريطة الجغرافية والملفات والمرفقات الرسمية -->
            <div style="display: flex; flex-direction: column; gap: 18px;">
              
              <!-- موقع المشروع على الخريطة الجغرافية (GIS) -->
              <div class="card" style="padding: 16px; border-radius: 12px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <h4 style="margin: 0; font-weight: 800; color: var(--text-main); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                    <span>🗺️</span> موقع المشروع على الخريطة (GIS)
                  </h4>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="font-size: 0.74rem; background: var(--bg-surface); padding: 3px 8px; border-radius: 6px; color: var(--primary); font-family: monospace; font-weight: 700; border: 1px solid var(--border);">
                      ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </span>
                    <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 8px; font-size: 0.72rem;" onclick="navigator.clipboard.writeText('${lat}, ${lng}'); if (typeof showToast==='function') showToast('تم نسخ الإحداثيات 📋', 'success');" title="نسخ الإحداثيات">
                      نسخ
                    </button>
                    <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="btn btn-sm btn-outline" style="padding: 2px 8px; font-size: 0.72rem; text-decoration: none;" title="فتح في Google Maps">
                      🌐
                    </a>
                  </div>
                </div>
                <div id="tender-hub-map" style="height: 460px; width: 100%; border-radius: 10px; border: 1px solid var(--border); z-index: 1;"></div>
              </div>

              <!-- الوثائق والمرفقات الرسمية -->
              <div class="card" style="padding: 18px; border-radius: 12px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                  <h4 style="margin: 0; font-weight: 800; color: var(--text-main); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                    <span>📎</span> الوثائق والمرفقات الرسمية
                  </h4>
                  ${attach ? `
                    <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">
                      ملف معتمد
                    </span>
                  ` : ''}
                </div>

                ${attach ? `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                      <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(2, 132, 199, 0.15); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                        📄
                      </div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main); word-break: break-all; direction: ltr; text-align: right;" title="${attach}">
                          ${attach.split(/[/\\]/).pop()}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                          وثيقة رسمية مرفقة بالعطاء
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button type="button" class="btn btn-sm btn-primary" style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 6px; padding: 6px 12px; font-weight: 700;" onclick="tendersManager.previewDocument('${item.id}', '${attach}')">
                        <span>👁️</span> معاينة فورية
                      </button>
                      <a href="/api/tenders/${item.id}/download" target="_blank" class="btn btn-sm btn-outline" style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 6px; padding: 6px 12px; font-weight: 700; text-decoration: none;">
                        <span>📥</span> تحميل الملف
                      </a>
                      ${this.can('delete_attachment', item) ? `
                        <button type="button" class="btn btn-sm btn-danger" style="display: flex; justify-content: center; align-items: center; gap: 4px; padding: 6px 10px;" onclick="tendersManager.deleteAttachment('${item.id}')" title="حذف المرفق نهائياً">
                          <span>🗑️</span>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                ` : `
                  <div style="font-size: 0.84rem; color: var(--text-muted); text-align: center; padding: 24px 14px; background: var(--bg-surface); border-radius: 10px; border: 1px dashed var(--border);">
                    <div style="font-size: 1.8rem; margin-bottom: 6px;">📂</div>
                    <div>لا توجد وثائق مرفقة لهذا العطاء حالياً</div>
                    ${this.can('edit', item) ? `
                      <button type="button" class="btn btn-sm btn-outline" style="margin-top: 10px; font-size: 0.76rem;" onclick="tendersManager.openEditForm('${item.id}')">
                        + إرفاق ملف من شاشة التعديل
                      </button>
                    ` : ''}
                  </div>
                `}
              </div>

            </div>

          </div>
        </div>

        <!-- 2. تبويب التقارير اليومية للأعمال الميدانية وسجل الموقع -->
        <div id="tender-hub-subtab-daily-reports" class="tender-hub-subtab-pane" style="display:none;">
          <div id="tender-daily-reports-container">
            <div style="text-align:center; padding:40px;">
              <div class="spinner" style="margin:0 auto 12px;"></div>
              <div style="font-weight:700; color:var(--text-muted);">جارٍ تحميل سجل التقارير اليومية الميدانية...</div>
            </div>
          </div>
        </div>

        <!-- 3. تبويب سجل المطالبات والدفعات المالية المرتبطة -->
        <div id="tender-hub-subtab-claims" class="tender-hub-subtab-pane" style="display:none;">
          <div class="card" style="padding:22px; border-radius:12px; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <h4 style="margin:0; font-weight:800; color:var(--text-main); font-size:1.05rem; display:flex; align-items:center; gap:8px;">
                <span>💰</span> سجل المطالبات والدفعات المالية المرتبطة (${linkedClaims.length})
              </h4>
              <a href="javascript:void(0)" onclick="navigate('claims')" class="btn btn-sm btn-outline" style="font-size:0.78rem; font-weight:700;">
                إدارة المطالبات ➔
              </a>
            </div>

            ${linkedClaims.length ? `
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.86rem;">
                  <thead>
                    <tr style="background:var(--bg-surface); border-bottom:2px solid var(--border);">
                      <th style="padding:8px 12px;">رقم المطالبة</th>
                      <th style="padding:8px 12px;">النوع / الدفعة</th>
                      <th style="padding:8px 12px;">تاريخ التقديم</th>
                      <th style="padding:8px 12px; text-align:center;">المبلغ (د.أ)</th>
                      <th style="padding:8px 12px; text-align:center;">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linkedClaims.map(c => `
                      <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:8px 12px; font-weight:800; color:var(--text-main);">${c.id}</td>
                        <td style="padding:8px 12px; font-weight:600;">${c.type || 'مطالبة إنجاز'}</td>
                        <td style="padding:8px 12px;">${c.submitDate || c.claimDate || '—'}</td>
                        <td style="padding:8px 12px; text-align:center; font-weight:900; color:#10b981;">
                          ${parseFloat(c.amount || 0).toLocaleString('ar-JO', { minimumFractionDigits: 3 })}
                        </td>
                        <td style="padding:8px 12px; text-align:center;">
                          <span class="badge" style="background:rgba(2,132,199,0.12); color:#0284c7; padding:3px 8px; border-radius:6px; font-size:0.74rem; font-weight:700;">
                            ${c.status || 'معتمدة'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.88rem;">
                لا توجد مطالبات مالية مسجلة لهذا العطاء بعد.
              </div>
            `}
          </div>
        </div>

      </div>
    `;

    this._switchView('hub');
    this.switchHubSubTab('overview');
    this.loadDailyReports(item.id);
    setTimeout(() => this._initHubMap(item), 200);
  }

  /* ─── إدارة خريطة الـ Hub الفضائية ────────────────────────────────── */
  _initHubMap(item) {
    const mapEl = document.getElementById('tender-hub-map');
    if (!mapEl || typeof L === 'undefined') return;

    const lat = parseFloat(item.lat || 32.3301);
    const lng = parseFloat(item.lng || 35.7501);

    if (this.hubMap) {
      try {
        this.hubMap.remove();
      } catch(e) {}
      this.hubMap = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.hubMap = UnifiedGisEngine.createMap('tender-hub-map', [lat, lng], 15);
    } else {
      this.hubMap = createUnifiedMap('tender-hub-map', [lat, lng], 15);
    }

    const marker = L.marker([lat, lng]).addTo(this.hubMap);
    marker.bindPopup(`
      <div style="direction:rtl; font-family:'Tajawal',sans-serif; text-align:right; min-width:200px;">
        <h4 style="margin:0 0 6px; color:#0284c7; font-weight:800; font-size:0.95rem;">${item.name}</h4>
        <div style="font-size:0.8rem; color:#64748b; margin-bottom:2px;">رقم العطاء: <b>${item.id || item.tenderNumber}</b></div>
        <div style="font-size:0.8rem; margin-bottom:2px;">المقاول: <b>${item.contractor || '—'}</b></div>
        <div style="font-size:0.82rem; color:#10b981; font-weight:800; margin-top:4px;">القيمة: ${parseFloat(item.value || item.awardedValue || 0).toLocaleString('ar-JO')} د.أ</div>
        <div style="margin-top:6px; border-top:1px solid #e2e8f0; padding-top:4px;">
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="font-size:0.75rem; color:#0284c7; text-decoration:none; font-weight:bold;">فتح في خرائط Google ↗</a>
        </div>
      </div>
    `).openPopup();

    setTimeout(() => {
      if (this.hubMap) {
        try {
          this.hubMap.invalidateSize();
        } catch(e) {}
      }
    }, 250);
  }

  /* ─── تبديل الشاشات داخل الموديول ─────────────────────────────────── */
  _switchView(viewName) {
    this.currentView = viewName;
    const vList = document.getElementById('tenders-view-list');
    const vForm = document.getElementById('tenders-view-form');
    const vHub = document.getElementById('tenders-view-hub');

    if (vList) vList.style.display = viewName === 'list' ? 'block' : 'none';
    if (vForm) vForm.style.display = viewName === 'form' ? 'block' : 'none';
    if (vHub) vHub.style.display = viewName === 'hub' ? 'block' : 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ─── تصدير بيانات العطاءات إلى Excel ──────────────────────────────── */
  exportExcel() {
    if (!this.tendersData.length) {
      if (typeof showToast === 'function') showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم العطاء',
      'اسم المشروع / العطاء',
      'النوع',
      'طريقة الشراء',
      'لجنة الشراء',
      'المقاول المنفذ',
      'المهندس المشرف',
      'المنطقة / الحي',
      'تاريخ الطرح',
      'تاريخ المباشرة',
      'المدة (يوم)',
      'نسبة الإنجاز %',
      'القيمة التقديرية (د.أ)',
      'قيمة الإحالة (د.أ)',
      'الأوامر التغييرية (د.أ)',
      'القيمة الإجمالية للعقد (د.أ)',
      'الحالة',
      'المرفقات'
    ];

    let sumEst = 0;
    let sumAwd = 0;
    let sumVo = 0;
    let sumTot = 0;

    const rows = this.filteredData.map(t => {
      const val = parseFloat(t.awardedValue || t.value || t.estimatedValue || 0);
      const est = parseFloat(t.estimatedValue || val);
      const vo = parseFloat(t.variationOrdersValue || 0);
      const tot = val + vo;

      sumEst += est;
      sumAwd += val;
      sumVo += vo;
      sumTot += tot;

      return [
        t.id || t.tenderNumber || '',
        t.name || '',
        t.tenderType || 'أشغال',
        t.purchaseMethod || 'مناقصة عامة',
        t.purchaseCommittee || 'لجنة الشراء المحلية',
        t.contractor || '',
        t.supervisorEngineer || '',
        t.district || 'كفرنجة',
        t.openDate || '',
        t.commencementDate || '',
        parseInt(t.durationDays || 0),
        parseFloat(t.completionPercentage || 0) + '%',
        est,
        val,
        vo,
        tot,
        t.status || 'مفتوح',
        t.attachmentPath ? 'يوجد مرفق رسمي' : 'لا يوجد'
      ];
    });

    const totals = [
      'الإجمالي الكلي',
      `${this.filteredData.length} عطاء`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      sumEst,
      sumAwd,
      sumVo,
      sumTot,
      '',
      ''
    ];

    if (typeof window.exportToExcelFile === 'function') {
      window.exportToExcelFile({
        filename: 'سجل_العطاءات_والمشاريع_بلدية_كفرنجة',
        title: 'سجل وكشف العطاءات والمشاريع الهندسية المعتمدة',
        subtitle: 'مديرية الأشغال والخدمات الهندسية',
        headers,
        rows,
        totals
      });
      if (typeof showToast === 'function') showToast('تم تصدير ملف Excel بنجاح 📊', 'success');
    }
  }

  /* ─── طباعة الكشف العام للعطاءات ───────────────────────────────────── */
  printSummaryReport() {
    const totalVal = this.filteredData.reduce((acc, t) => acc + parseFloat(t.awardedValue || t.value || t.estimatedValue || 0), 0);
    const dateStr = new Date().toLocaleDateString('ar-JO');

    const contentHtml = `
      <div style="direction:rtl; font-family:'Tajawal', sans-serif; padding:10px;">
        <div style="text-align:center; margin-bottom:15px; border-bottom:2px solid #065f46; padding-bottom:10px;">
          <h2 style="margin:0; color:#065f46;">المملكة الأردنية الهاشمية</h2>
          <h3 style="margin:4px 0; color:#1e293b;">بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية</h3>
          <h4 style="margin:4px 0; color:#475569;">سجل وكشف العطاءات والمشاريع المعتمدة</h4>
          <div style="font-size:0.85rem; color:#64748b; margin-top:4px;">تاريخ الاستخراج: ${dateStr}</div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right; margin-bottom:15px;">
          <thead>
            <tr style="background:#065f46; color:#ffffff;">
              <th style="padding:6px; border:1px solid #044e3a;">رقم العطاء</th>
              <th style="padding:6px; border:1px solid #044e3a;">اسم المشروع</th>
              <th style="padding:6px; border:1px solid #044e3a;">النوع</th>
              <th style="padding:6px; border:1px solid #044e3a;">طريقة الشراء</th>
              <th style="padding:6px; border:1px solid #044e3a;">المقاول</th>
              <th style="padding:6px; border:1px solid #044e3a; text-align:center;">تاريخ الطرح</th>
              <th style="padding:6px; border:1px solid #044e3a; text-align:center;">القيمة (د.أ)</th>
              <th style="padding:6px; border:1px solid #044e3a; text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredData.map((t, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'};">
                <td style="padding:6px 8px; border:1px solid #cbd5e1; font-weight:bold;">${t.id || t.tenderNumber}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1;">${t.name}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1;">${t.tenderType || 'أشغال'}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1;">${t.purchaseMethod || 'مناقصة عامة'}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1;">${t.contractor || '—'}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${t.openDate || '—'}</td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#0f766e;">
                  ${parseFloat(t.awardedValue || t.value || t.estimatedValue || 0).toLocaleString('ar-JO', { minimumFractionDigits: 3 })}
                </td>
                <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${t.status || 'مفتوح'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#eff6ff; font-weight:bold; color:#1e3a8a;">
              <td colspan="6" style="padding:8px; border:1px solid #93c5fd; text-align:right;">الإجمالي الكلي (${this.filteredData.length} عطاء):</td>
              <td style="padding:8px; border:1px solid #93c5fd; text-align:center; color:#0f766e;">${totalVal.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</td>
              <td style="padding:8px; border:1px solid #93c5fd;"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: 'كشف العطاءات والمشاريع المعتمدة',
        subtitle: 'مديرية الأشغال والخدمات الهندسية',
        documentType: 'SUMMARY_REPORT',
        sectionName: 'رئيس القسم',
        contentHtml
      });
    }
  }

  /* ─── طباعة ملف العطاء الفردي الكامل (Dossier) ───────────────────────── */
  printTenderDossier(id) {
    const item = this.tendersData.find(x => String(x.id) === String(id));
    if (!item) return;

    const val = parseFloat(item.awardedValue || item.value || item.estimatedValue || 0);
    const vo = parseFloat(item.variationOrdersValue || 0);
    const total = val + vo;

    const contentHtml = `
      <div style="direction:rtl; font-family:'Tajawal', sans-serif;">
        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; border-radius:8px; margin-bottom:12px;">
          <h4 style="margin:0 0 8px; color:#1e3a8a; font-size:0.95rem;">1. البيانات العامة للمشروع</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <tr><td style="padding:4px; width:25%; color:#64748b;">اسم المشروع:</td><td style="font-weight:bold;">${item.name}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">النوع والتصنيف:</td><td>${item.tenderType || 'أشغال'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">طريقة الشراء:</td><td>${item.purchaseMethod || 'مناقصة عامة'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">لجنة الشراء:</td><td>${item.purchaseCommittee || 'لجنة الشراء المحلية'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">المنطقة / الحي:</td><td>${item.district || 'كفرنجة'}</td></tr>
          </table>
        </div>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; border-radius:8px; margin-bottom:12px;">
          <h4 style="margin:0 0 8px; color:#1e3a8a; font-size:0.95rem;">2. الأطراف والقيم المالية</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <tr><td style="padding:4px; width:25%; color:#64748b;">المقاول المنفذ:</td><td style="font-weight:bold;">${item.contractor || '—'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">المهندس المشرف:</td><td>${item.supervisorEngineer || '—'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">قيمة الإحالة الأساسية:</td><td style="font-weight:bold; color:#0f766e;">${val.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</td></tr>
            <tr><td style="padding:4px; color:#64748b;">الأوامر التغييرية:</td><td>${vo.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</td></tr>
            <tr><td style="padding:4px; color:#64748b;">القيمة الإجمالية المعدلة:</td><td style="font-weight:bold; color:#0f766e;">${total.toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</td></tr>
            <tr><td style="padding:4px; color:#64748b;">كفالة حسن التنفيذ:</td><td>رقم ${item.performanceBondNumber || '—'} بقيمة ${parseFloat(item.performanceBondValue || 0).toLocaleString('ar-JO', { minimumFractionDigits: 3 })} د.أ</td></tr>
          </table>
        </div>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; border-radius:8px; margin-bottom:12px;">
          <h4 style="margin:0 0 8px; color:#1e3a8a; font-size:0.95rem;">3. المدد الزمنية ومراحل الاستلام</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <tr><td style="padding:4px; width:25%; color:#64748b;">تاريخ الطرح:</td><td>${item.openDate || '—'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">تاريخ المباشرة:</td><td>${item.commencementDate || '—'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">المدة التعاقدية:</td><td>${item.durationDays || '—'} يوم</td></tr>
            <tr><td style="padding:4px; color:#64748b;">نسبة الإنجاز الفعلي:</td><td style="font-weight:bold;">${item.completionPercentage || 0}%</td></tr>
            <tr><td style="padding:4px; color:#64748b;">الاستلام الأولي:</td><td>${item.preliminaryHandoverDate || '—'}</td></tr>
            <tr><td style="padding:4px; color:#64748b;">الاستلام النهائي:</td><td>${item.finalHandoverDate || '—'}</td></tr>
          </table>
        </div>

        ${item.notes ? `
          <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px 16px; border-radius:8px; margin-bottom:12px;">
            <h4 style="margin:0 0 6px; color:#1e3a8a; font-size:0.95rem;">4. الملاحظات والقرارات</h4>
            <div style="font-size:0.85rem; line-height:1.5;">${item.notes}</div>
          </div>
        ` : ''}
      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: `ملف العطاء الفني والتعاقدي (${item.id || item.tenderNumber})`,
        subtitle: `${item.name}`,
        documentType: 'SUMMARY_REPORT',
        sectionName: 'رئيس القسم',
        contentHtml
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     📝 إدارة وتطوير التقارير اليومية للأعمال الميدانية (Advanced Site Reports Suite)
     ══════════════════════════════════════════════════════════════════════ */

  switchHubSubTab(tabName) {
    this.currentHubSubTab = tabName;

    const tabs = ['overview', 'daily-reports', 'claims'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tender-tab-btn-${t}`);
      const pane = document.getElementById(`tender-hub-subtab-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.classList.add('active');
          btn.classList.add('btn-primary');
          btn.classList.remove('btn-outline');
        } else {
          btn.classList.remove('active');
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline');
        }
      }
      if (pane) {
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    if (tabName === 'daily-reports' && this.activeTender) {
      this.loadDailyReports(this.activeTender.id);
    }
    if (tabName === 'overview' && this.hubMap) {
      setTimeout(() => {
        try { this.hubMap.invalidateSize(); } catch(e) {}
      }, 120);
    }
  }

  async loadDailyReports(tenderId) {
    const cont = document.getElementById('tender-daily-reports-container');
    const badge = document.getElementById('tender-hub-reports-count');

    try {
      const res = await fetch(`/api/tenders/${tenderId}/daily-reports`, {
        headers: this._getAuthHeaders(false)
      });
      const json = await res.json();
      const reports = (json && json.data) ? json.data : [];
      this.activeDailyReports = reports;
      this.filteredDailyReports = [...reports];

      if (badge) badge.textContent = reports.length;

      this._renderDailyReportsTab();
    } catch(err) {
      console.error('Load daily reports error:', err);
      if (cont) {
        cont.innerHTML = `
          <div style="text-align:center; padding:30px; color:#ef4444;">
            ❌ تعذر تحميل التقارير اليومية. يرجى المحاولة لاحقاً.
          </div>
        `;
      }
    }
  }

  _filterDailyReports() {
    const q = (document.getElementById('dr-search-input') ? document.getElementById('dr-search-input').value.toLowerCase().trim() : '');
    const dateFrom = (document.getElementById('dr-filter-from') ? document.getElementById('dr-filter-from').value : '');
    const dateTo = (document.getElementById('dr-filter-to') ? document.getElementById('dr-filter-to').value : '');
    const weatherFilter = (document.getElementById('dr-filter-weather') ? document.getElementById('dr-filter-weather').value : '');

    const all = this.activeDailyReports || [];
    this.filteredDailyReports = all.filter(r => {
      const rDate = String(r.report_date || '').split('T')[0];
      if (dateFrom && rDate < dateFrom) return false;
      if (dateTo && rDate > dateTo) return false;
      if (weatherFilter && !(r.weather || '').includes(weatherFilter)) return false;
      if (q) {
        const text = `${r.executed_works || ''} ${r.supervisor_engineer || ''} ${r.field_inspector || ''} ${r.materials_delivered || ''} ${r.equipment_details || ''} ${r.report_number || ''} ${r.site_location_name || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    this._renderDailyReportsListOnly();
    this._initDailyReportsSummaryMap(this.filteredDailyReports);
  }

  _renderDailyReportsTab() {
    const cont = document.getElementById('tender-daily-reports-container');
    if (!cont) return;

    const item = this.activeTender;
    if (!item) return;

    const reports = this.activeDailyReports || [];
    const canCreate = this.can('create') || this.can('edit', item);
    const totalReports = reports.length;
    const latestReport = reports[0];
    const latestProgress = latestReport ? (latestReport.cumulative_progress_percent || item.completionPercentage || 0) : (item.completionPercentage || 0);

    // حسابات إحصائية متقدمة
    let totalManpower = 0;
    let totalWorkHours = 0;
    let totalDelayHours = 0;
    reports.forEach(r => {
      totalManpower += (parseInt(r.manpower_count) || 0);
      totalWorkHours += (parseFloat(r.work_hours) || 8);
      totalDelayHours += (parseFloat(r.work_delay_hours) || 0);
    });
    const avgDailyPct = totalReports > 0 ? (parseFloat(latestProgress) / totalReports).toFixed(1) : '0';

    let html = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        
        <!-- بطاقة الإحصائيات والمؤشرات الميدانية المتقدمة -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
          <div class="card" style="padding:14px; border-right:3px solid var(--primary); background:var(--bg-surface);">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">إجمالي التقارير المسجلة</span>
            <div style="font-size:1.4rem; font-weight:800; color:var(--primary); margin-top:2px;">${totalReports} تقرير</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">سجل الرقابة الميدانية</div>
          </div>
          <div class="card" style="padding:14px; border-right:3px solid #10b981; background:var(--bg-surface);">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">نسبة الإنجاز الميداني</span>
            <div style="font-size:1.4rem; font-weight:800; color:#10b981; margin-top:2px;">${parseFloat(latestProgress).toFixed(1)}%</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">معدل ${avgDailyPct}% لكل زيارة</div>
          </div>
          <div class="card" style="padding:14px; border-right:3px solid #0284c7; background:var(--bg-surface);">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">ساعات العمل الفعلية</span>
            <div style="font-size:1.4rem; font-weight:800; color:#0284c7; margin-top:2px;">${totalWorkHours.toFixed(0)} ساعة</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${totalManpower} عامل تم تشغيلهم</div>
          </div>
          <div class="card" style="padding:14px; border-right:3px solid #f59e0b; background:var(--bg-surface);">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold;">ساعات التوقف والطقس</span>
            <div style="font-size:1.4rem; font-weight:800; color:#f59e0b; margin-top:2px;">${totalDelayHours.toFixed(1)} ساعة</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">أعطال / معوقات موقعية</div>
          </div>
        </div>

        <!-- بطاقة الخريطة التفاعلية لمواقع العمل اليومية (GIS Map) -->
        <div class="card" style="padding:14px 18px; background:var(--bg-surface); border:1px solid var(--border); border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">🗺️</span>
              <div>
                <h4 style="margin:0; font-size:0.95rem; font-weight:800; color:var(--text-main);">الخريطة التفاعلية لمواقع العمل والإنجاز الميداني (GIS Tracking)</h4>
                <div style="font-size:0.75rem; color:var(--text-muted);">تتبع دقيق لمحطات ومواقع الأعمال المنفذة يومياً على صور الأقمار الصناعية</div>
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager._toggleDailyReportsMapSize()" id="dr-map-toggle-btn" style="font-size:0.75rem;">
                ⛶ تكبير الخريطة
              </button>
            </div>
          </div>
          <div id="tender-daily-reports-gis-map" style="height:320px; width:100%; border-radius:8px; border:1px solid var(--border); z-index:1; position:relative;"></div>
        </div>

        <!-- شريط الإجراءات والبحث والتصفية -->
        <div class="card" style="padding:14px 18px; background:var(--bg-surface); border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${canCreate ? `
                <button type="button" class="btn btn-primary" onclick="tendersManager.openDailyReportModal()" style="display:inline-flex; align-items:center; gap:6px; font-weight:800;">
                  <span>➕</span> كتابة تقرير يومي جديد
                </button>
                <button type="button" class="btn btn-outline" onclick="tendersManager.cloneLatestDailyReport()" title="استنساخ بيانات آخر تقرير للتسهيل والتعديل السريع" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
                  <span>📋</span> تكرار تقرير الأمس
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline" onclick="tendersManager.printDailyReportsDossier('${item.id}')" title="طباعة السجل الشامل لكافة التقارير الميدانية" style="display:inline-flex; align-items:center; gap:6px;">
                <span>🖨️</span> طباعة السجل الشامل
              </button>
              <button type="button" class="btn btn-outline" onclick="tendersManager.exportDailyReportsToExcel()" title="تصدير كشف التقارير إلى ملف Excel" style="display:inline-flex; align-items:center; gap:6px;">
                <span>📊</span> تصدير Excel
              </button>
            </div>
          </div>

          <!-- أدوات الفلترة والبحث السريع -->
          <div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr auto; gap:10px; align-items:center;">
            <input type="text" id="dr-search-input" class="form-control" placeholder="🔍 بحث في الأعمال المنفذة، المهندس، الموقع، المواد..." oninput="tendersManager._filterDailyReports()" style="font-size:0.83rem;">
            <input type="date" id="dr-filter-from" class="form-control" placeholder="من تاريخ" onchange="tendersManager._filterDailyReports()" style="font-size:0.83rem;">
            <input type="date" id="dr-filter-to" class="form-control" placeholder="إلى تاريخ" onchange="tendersManager._filterDailyReports()" style="font-size:0.83rem;">
            <select id="dr-filter-weather" class="form-control" onchange="tendersManager._filterDailyReports()" style="font-size:0.83rem;">
              <option value="">جميع حالات الطقس</option>
              <option value="مشمس">☀️ مشمس</option>
              <option value="معتدل">🌤️ معتدل</option>
              <option value="ماطر">🌧️ ماطر</option>
              <option value="حار">🌡️ حار</option>
            </select>
            <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('dr-search-input').value=''; document.getElementById('dr-filter-from').value=''; document.getElementById('dr-filter-to').value=''; document.getElementById('dr-filter-weather').value=''; tendersManager._filterDailyReports();" title="إعادة تعيين الفلترة">
              ↺ تفريغ
            </button>
          </div>
        </div>

        <!-- وعاء قائمة التقارير الفردية -->
        <div id="tender-daily-reports-list-container">
          <!-- توليد ديناميكي -->
        </div>

      </div>
    `;

    cont.innerHTML = html;
    this._renderDailyReportsListOnly();
    setTimeout(() => {
      this._initDailyReportsSummaryMap(reports);
    }, 150);
  }

  _toggleDailyReportsMapSize() {
    const mapEl = document.getElementById('tender-daily-reports-gis-map');
    const btn = document.getElementById('dr-map-toggle-btn');
    if (!mapEl) return;

    if (mapEl.style.height === '320px' || !mapEl.style.height) {
      mapEl.style.height = '520px';
      if (btn) btn.textContent = '🗗 تصغير الخريطة';
    } else {
      mapEl.style.height = '320px';
      if (btn) btn.textContent = '⛶ تكبير الخريطة';
    }
    if (this.dailyReportsOverviewMap) {
      this.dailyReportsOverviewMap.invalidateSize();
    }
  }

  _initDailyReportsSummaryMap(reports = []) {
    const mapContainer = document.getElementById('tender-daily-reports-gis-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (this.dailyReportsOverviewMap) {
      this.dailyReportsOverviewMap.remove();
      this.dailyReportsOverviewMap = null;
    }

    const item = this.activeTender;
    let defaultLat = 32.3301;
    let defaultLng = 35.7501;

    if (item && item.lat && item.lng) {
      defaultLat = parseFloat(item.lat);
      defaultLng = parseFloat(item.lng);
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.dailyReportsOverviewMap = UnifiedGisEngine.createMap('tender-daily-reports-gis-map', [defaultLat, defaultLng], 15);
    } else {
      this.dailyReportsOverviewMap = createUnifiedMap('tender-daily-reports-gis-map', [defaultLat, defaultLng], 15);
    }

    const bounds = L.latLngBounds();

    // إضافة مؤشر مركز العطاء
    if (item) {
      const tenderIcon = L.divIcon({
        className: 'tender-center-marker',
        html: `<div style="background:#1e3a8a; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.5);">🏛️</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const tenderMarker = L.marker([defaultLat, defaultLng], { icon: tenderIcon }).addTo(this.dailyReportsOverviewMap);
      tenderMarker.bindPopup(`
        <div style="font-family:'Tajawal', sans-serif; direction:rtl; text-align:right;">
          <h4 style="margin:0 0 4px; color:#1e3a8a; font-size:0.95rem;">🏛️ مركز المشروع: ${item.name}</h4>
          <div style="font-size:0.8rem; color:#64748b;">رقم العطاء: ${item.id || item.tenderNumber}</div>
        </div>
      `);
      bounds.extend([defaultLat, defaultLng]);
    }

    // إضافة مؤشرات التقارير اليومية
    reports.forEach((r, idx) => {
      const rLat = parseFloat(r.lat);
      const rLng = parseFloat(r.lng);
      if (rLat && rLng) {
        bounds.extend([rLat, rLng]);

        const rDate = String(r.report_date || '').split('T')[0];
        const markerIcon = L.divIcon({
          className: 'daily-report-marker',
          html: `<div style="background:#0284c7; color:#fff; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.4); white-space:nowrap; display:flex; align-items:center; gap:4px;">
            <span>📍</span> #${reports.length - idx} (${parseFloat(r.cumulative_progress_percent || 0).toFixed(0)}%)
          </div>`,
          iconSize: [80, 26],
          iconAnchor: [40, 13]
        });

        const m = L.marker([rLat, rLng], { icon: markerIcon }).addTo(this.dailyReportsOverviewMap);
        m.bindPopup(`
          <div style="font-family:'Tajawal', sans-serif; direction:rtl; text-align:right; max-width:240px;">
            <div style="font-weight:800; font-size:0.9rem; color:#0284c7; margin-bottom:4px;">
              📅 ${rDate} — ${r.report_number || `تقرير #${reports.length - idx}`}
            </div>
            ${r.site_location_name ? `<div style="font-size:0.78rem; font-weight:bold; margin-bottom:4px; color:#1e293b;">📍 ${r.site_location_name}</div>` : ''}
            <div style="font-size:0.75rem; color:#475569; margin-bottom:6px; line-height:1.4;">
              ${(r.executed_works || '').substring(0, 90)}...
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:6px; font-size:0.75rem;">
              <span style="font-weight:bold; color:#10b981;">🏁 الإنجاز: ${r.cumulative_progress_percent || 0}%</span>
              <button type="button" class="btn btn-sm btn-primary" onclick="tendersManager.openDailyReportModal('${r.id}')" style="padding:2px 8px; font-size:0.72rem;">✏️ فتح</button>
            </div>
          </div>
        `);
      }
    });

    if (bounds.isValid()) {
      this.dailyReportsOverviewMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }

  _zoomToDailyReportLocation(lat, lng, locName) {
    if (!this.dailyReportsOverviewMap || typeof L === 'undefined') return;
    const mapEl = document.getElementById('tender-daily-reports-gis-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.dailyReportsOverviewMap.setView([lat, lng], 17);
      L.popup()
        .setLatLng([lat, lng])
        .setContent(`<div style="font-family:'Tajawal',sans-serif; direction:rtl; text-align:right; font-weight:bold; font-size:0.85rem;">📍 ${locName || 'موقع العمل الميداني'}</div>`)
        .openOn(this.dailyReportsOverviewMap);
    }
  }

  _renderDailyReportsListOnly() {
    const listCont = document.getElementById('tender-daily-reports-list-container');
    if (!listCont) return;

    const item = this.activeTender;
    const reports = this.filteredDailyReports || [];
    const canCreate = this.can('create') || (item && this.can('edit', item));
    const totalReports = (this.activeDailyReports || []).length;

    if (!reports.length) {
      listCont.innerHTML = `
        <div class="card" style="text-align:center; padding:40px 20px;">
          <div style="font-size:3rem; margin-bottom:10px;">📝</div>
          <h4 style="margin:0 0 6px; color:var(--text-main); font-weight:800;">لا توجد تقارير يومية مطابقة لخيارات البحث</h4>
          <p style="color:var(--text-muted); font-size:0.85rem; max-width:450px; margin:0 auto 16px;">
            يمكنك كتابة وتوليد تقرير يومي جديد لتوثيق أعمال الإشراف الهندسي الميداني ونسب الإنجاز.
          </p>
          ${canCreate ? `
            <button type="button" class="btn btn-primary" onclick="tendersManager.openDailyReportModal()" style="font-weight:700;">
              ➕ كتابة تقرير يومي جديد
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    listCont.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        ${reports.map((r, idx) => {
          const rDate = String(r.report_date || '').split('T')[0];
          let photos = [];
          try {
            if (r.site_photos) photos = JSON.parse(r.site_photos);
          } catch(e) {}
          if (!photos.length && r.attachment_path) photos = [r.attachment_path];

          const hasCoords = (r.lat && r.lng);

          return `
            <div class="card" style="padding:18px; border-right:4px solid var(--primary); transition:all 0.2s ease;">
              
              <!-- ترويسة التقرير -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                  <span class="badge" style="background:#0284c718; color:#0284c7; font-weight:800; font-size:0.85rem; padding:4px 10px; border-radius:6px;">
                    📅 ${rDate}
                  </span>
                  <span style="font-weight:bold; font-size:0.95rem; color:var(--text-main);">
                    ${r.report_number || `تقرير يومي #${totalReports - idx}`}
                  </span>
                  <span class="badge" style="background:#f59e0b15; color:#f59e0b; font-size:0.75rem; padding:3px 8px; border-radius:12px;">
                    ${r.weather || 'معتدل'} ${r.temperature ? `(${r.temperature})` : ''}
                  </span>
                  <span style="font-size:0.8rem; color:var(--text-muted);">
                    👤 المهندس المشرف: <b>${r.supervisor_engineer || item.supervisorEngineer || '—'}</b>
                  </span>
                  ${r.field_inspector ? `<span style="font-size:0.8rem; color:var(--text-muted);">| المراقب: <b>${r.field_inspector}</b></span>` : ''}
                  ${r.safety_status ? `
                    <span class="badge" style="background:${r.safety_status.includes('مخالفة') ? '#ef444420' : '#10b98118'}; color:${r.safety_status.includes('مخالفة') ? '#ef4444' : '#10b981'}; font-size:0.72rem; padding:2px 8px; border-radius:8px;">
                      🛡️ ${r.safety_status}
                    </span>
                  ` : ''}
                </div>

                <!-- أزرار الإجراءات للتقرير -->
                <div style="display:flex; gap:6px; align-items:center;">
                  ${hasCoords ? `
                    <button type="button" class="btn btn-sm btn-info" onclick="tendersManager._zoomToDailyReportLocation(${r.lat}, ${r.lng}, '${r.site_location_name || rDate}')" title="عرض موقع العمل على الخريطة">
                      🗺️ على الخريطة
                    </button>
                  ` : ''}
                  <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.printDailyReport('${r.id}')" title="طباعة نموذج التقرير اليومي المعتمد">
                    🖨️ طباعة
                  </button>
                  ${canCreate ? `
                    <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.openDailyReportModal('${r.id}')" title="تعديل بيانات التقرير">
                      ✏️ تعديل
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="tendersManager.cloneDailyReport('${r.id}')" title="استنساخ هذا التقرير لإنشاء تقرير جديد">
                      📋 استنساخ
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="tendersManager.deleteDailyReport('${r.id}')" title="حذف التقرير نهائياً">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- شريط الموقع والمحطة إن وجد -->
              ${(r.site_location_name || hasCoords) ? `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:0.83rem; background:rgba(2,132,199,0.06); border:1px solid rgba(2,132,199,0.2); padding:6px 12px; border-radius:6px;">
                  <span>📍</span>
                  <span style="font-weight:bold; color:var(--primary);">الموقع الميداني / المحطة:</span>
                  <span style="color:var(--text-main);">${r.site_location_name || 'تم تحديد الإحداثيات على الخريطة'}</span>
                  ${hasCoords ? `<span style="font-family:monospace; font-size:0.75rem; color:var(--text-muted); margin-right:auto;">[${parseFloat(r.lat).toFixed(5)}, ${parseFloat(r.lng).toFixed(5)}]</span>` : ''}
                </div>
              ` : ''}

              <!-- شريط العمالة، الآليات، وساعات العمل والإنجاز -->
              <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px; font-size:0.82rem; background:var(--bg-surface); padding:8px 12px; border-radius:6px; align-items:center;">
                ${r.manpower_count ? `<div>👷 <b>العمالة:</b> ${r.manpower_count} عامل</div>` : ''}
                ${r.equipment_details ? `<div>🚜 <b>الآليات:</b> ${r.equipment_details}</div>` : ''}
                <div>⏱️ <b>ساعات العمل:</b> ${parseFloat(r.work_hours || 8)} س ${parseFloat(r.work_delay_hours || 0) > 0 ? `<span style="color:#ef4444;">(توقف: ${r.work_delay_hours} س)</span>` : ''}</div>
                ${r.daily_progress_percent ? `<div>📈 <b>إنجاز اليوم:</b> ${parseFloat(r.daily_progress_percent).toFixed(1)}%</div>` : ''}
                ${r.cumulative_progress_percent ? `<div>🏁 <b>الإنجاز التراكمي:</b> <b style="color:#10b981;">${parseFloat(r.cumulative_progress_percent).toFixed(1)}%</b></div>` : ''}
              </div>

              <!-- تفاصيل الأعمال المنجزة -->
              <div style="margin-bottom:10px;">
                <div style="font-weight:bold; font-size:0.88rem; color:var(--primary); margin-bottom:4px;">
                  🏗️ الأعمال والبنود المنجزة ميدانياً:
                </div>
                <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); background:var(--bg-card); padding:10px 14px; border-radius:6px; border:1px solid var(--border); white-space:pre-wrap;">
                  ${r.executed_works || '—'}
                </div>
              </div>

              <!-- شريط مؤشرات الفحص وضبط الجودة الفنية (QC Metrics) -->
              ${(r.asphalt_temp || r.concrete_slump || r.compaction_rate) ? `
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; font-size:0.8rem;">
                  ${r.asphalt_temp ? `<div style="background:#f9731615; color:#ea580c; padding:4px 10px; border-radius:6px; font-weight:bold;">🔥 حرارة الأسفلت: ${r.asphalt_temp}</div>` : ''}
                  ${r.concrete_slump ? `<div style="background:#0284c715; color:#0284c7; padding:4px 10px; border-radius:6px; font-weight:bold;">🧪 هبوط الخرسانة (Slump): ${r.concrete_slump}</div>` : ''}
                  ${r.compaction_rate ? `<div style="background:#10b98115; color:#10b981; padding:4px 10px; border-radius:6px; font-weight:bold;">🎯 نسبة الدمك: ${r.compaction_rate}</div>` : ''}
                </div>
              ` : ''}

              <!-- تفاصيل إضافية (المواد، الفحوصات، المعوقات، التوجيهات) -->
              ${(r.materials_delivered || r.lab_tests || r.instructions_to_contractor || r.site_obstacles || r.delay_reason) ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin-top:8px; font-size:0.8rem;">
                  ${r.materials_delivered ? `
                    <div style="background:var(--bg-surface); padding:8px 10px; border-radius:6px;">
                      <b>📦 المواد الموردة:</b> ${r.materials_delivered}
                    </div>
                  ` : ''}
                  ${r.lab_tests ? `
                    <div style="background:var(--bg-surface); padding:8px 10px; border-radius:6px;">
                      <b>🧪 الفحوصات وضبط الجودة:</b> ${r.lab_tests}
                    </div>
                  ` : ''}
                  ${r.instructions_to_contractor ? `
                    <div style="background:var(--bg-surface); padding:8px 10px; border-radius:6px; color:#f59e0b;">
                      <b>⚠️ توجيهات المقاول:</b> ${r.instructions_to_contractor}
                    </div>
                  ` : ''}
                  ${(r.site_obstacles || r.delay_reason) ? `
                    <div style="background:var(--bg-surface); padding:8px 10px; border-radius:6px; color:#ef4444;">
                      <b>🚧 المعوقات والتوقف:</b> ${r.site_obstacles || ''} ${r.delay_reason ? `(${r.delay_reason})` : ''}
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <!-- معرض الصور الميدانية الحية للتقرير -->
              ${photos.length ? `
                <div style="margin-top:12px; border-top:1px dashed var(--border); padding-top:10px;">
                  <div style="font-size:0.8rem; font-weight:bold; color:var(--text-muted); margin-bottom:6px;">
                    📷 صور الموقع والوثائق المرفقة (${photos.length}):
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${photos.map(p => {
                      const ext = p.split('.').pop().toLowerCase();
                      const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                      if (isImg) {
                        return `
                          <div style="position:relative; width:90px; height:70px; border-radius:6px; overflow:hidden; border:1px solid var(--border); cursor:pointer;" onclick="tendersManager.previewDocument('${item.id}', '${p}')" title="انقر لتكبير ومعاينة الصورة">
                            <img src="/uploads/${p}" style="width:100%; height:100%; object-fit:cover;">
                            <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; font-size:0.65rem; padding:1px 4px; border-radius:3px;">🔍</span>
                          </div>
                        `;
                      } else {
                        return `
                          <button type="button" class="btn btn-sm btn-info" onclick="tendersManager.previewDocument('${item.id}', '${p}')" style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem;">
                            📄 ${p.split(/[/\\]/).pop()}
                          </button>
                        `;
                      }
                    }).join('')}
                  </div>
                </div>
              ` : ''}

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ─── القوالب الهندسية السريعة ────────────────────────────────────── */
  applyEngineeringTemplate(type) {
    const templates = {
      asphalt: {
        executedWorks: 'فرش وفرد طبقة خلطة إسفلتية ساخنة بسماكة 5 سم بعد الدحل الميكانيكي، ورش مادة اللاصق (Tack Coat / MC1) بمعدل 0.65 كغم/م²، وإجراء الدحل بالمدحلة الفولاذية والمدحلة المطاطية حتى الوصول إلى الكثافة المطلوبة وضبط الميول العرضية لتصريف المياه.',
        equipmentDetails: '1 فرادة إسفلت (Finisher)، 1 مدحلة حديد 10 طن، 1 مدحلة مطاط (Pneumatic Roller)، 3 قلابات نقل خلطة إسفلتية.',
        materials: 'توريد 180 طن خلطة إسفلتية ساخنة رابطة/سطحية، و 1.5 طن مادة MC1/Tack Coat.',
        labTests: 'أخذ عينات خلطة إسفلتية لفحص مارشال واستخلاص الإسفلت، قياس درجة حرارة الخلطة عند الوصول والفرش (150°م-160°م).',
        asphaltTemp: '155°C',
        compactionRate: '98.0%',
        manpowerCount: 10
      },
      curbs: {
        executedWorks: 'حفر وتجهيز مجرى الأرصفة، صب خرسانة نظافة، توريد وتركيب أطراف خرسانية (كندرين وباطون أردني) مع ضبط المناسيب والاستقامة، صب خرسانة الدعم الخلفي (Backing Concrete C20)، وفرش بلاط إنترلوك ملون سماكة 6 سم مع الدحل بالرجاج.',
        equipmentDetails: '1 جرافة صغيرة (Bobcat)، 1 خلاطة متنقلة، 1 رجاج بلاط، مناشير قص خرسانة.',
        materials: 'توريد 300 متر طولي كندرين مسبق الصنع، 15 متر مكعب خرسانة جاهزة C20، 120 متر مربع بلاط إنترلوك ملون.',
        labTests: 'فحص مطابقة أبعاد وقوة كسر الكندرين وبلاط الإنترلوك وأخذ مكعبات خرسانة الدعم.',
        concreteSlump: '80 ملم',
        manpowerCount: 8
      },
      drainage: {
        executedWorks: 'حفر خنادق تصريف مياه الأمطار بعمق 1.6م، توريد وتنزيل أنابيب خرسانية مسلحة قطر 600 ملم، صب فرشة خرسانية تحت الأنابيب، بناء وصب مناهل ومصائد مياه أمطار مع تركيب جريلات حديد سكب ثقيل (Ductile Iron).',
        equipmentDetails: '1 باجر جنزير (Excavator)، 1 ونش تنزيل مواسير، 2 قلاب نقل مخلفات الحفر.',
        materials: 'توريد 60 متر طولي أنابيب خرسانية مسلحة قطر 600 ملم، 4 مناهل مسبقة الصنع، 6 مصائد أمطار حديد سكب.',
        labTests: 'فحص مطابقة الأنابيب الخرسانية للضغط الهيدروليكي وقوة الكسر، فحص دمك الردم حول الأنابيب.',
        compactionRate: '95.0%',
        manpowerCount: 7
      },
      walls: {
        executedWorks: 'حفر أساسات الجدار الاستنادي حتى الوصول إلى المنسوب الصخري المعتمد، صب خرسانة نظافة C15، تفصيل وتركيب حديد التسليح للجدار حسب المخططات الإنشائية، تركيب الطوبار الخشبي، وصب الجدار بخرسانة جاهزة C25 مع استخدام الهزاز الميكانيكي وتركيب مواسير تصريف المياه (Weep Holes).',
        equipmentDetails: '1 مضخة باطون (Boom Pump)، 2 هزاز ميكانيكي، 1 باجر حفر، شاحنات خلاطات باطون.',
        materials: 'توريد 40 متر مكعب خرسانة جاهزة C25، 3.5 طن حديد تسليح عالي المقاومة، مواسير PVC قطر 3 إنش.',
        labTests: 'أخذ 6 مكعبات خرسانية لفحص كسر 7 و 28 يوم، إجراء فحص الهبوط (Slump Test) في الموقع.',
        concreteSlump: '110 ملم',
        manpowerCount: 9
      },
      patching: {
        executedWorks: 'تحديد الحفر والتخسفات في مسار الطريق، قص أطراف الحفر هندسياً بالمنشار الآلي، تنظيف وتفريغ الأتربة بضاغط الهواء (Blower)، رش مادة اللاصق (Tack Coat)، وتعبئة خلطة إسفلتية ساخنة ودحلها بالمدحلة الصغيرة لضمان استواء السطح مع الإسفلت القديم.',
        equipmentDetails: '1 منشار قص إسفلت، 1 كمبروسر هواء، 1 مدحلة صغيرة 3 طن، 1 قلاب صغير.',
        materials: 'توريد 15 طن خلطة إسفلتية ترقيعات، 150 كغم مادة لاصقة RC2.',
        labTests: 'فحص استواء السطح بالقدة الألمنيوم وضبط درجة حرارة الخلطة عند الفرد.',
        asphaltTemp: '150°C',
        manpowerCount: 5
      },
      earthwork: {
        executedWorks: 'حفر وتجريف طبقات التربة غير الصالحة، تسوية وتشكيل منسوب التأسيس (Subgrade)، رش المياه والدمك بالمدحلة الاهتزازية الثقيلة حتى الحصول على منسوب مستوٍ مطابق للمخططات والميول التصميمية.',
        equipmentDetails: '1 جرافة كتربلر D8، 1 جريدر (Grader)، 1 صهريج مياه، 1 مدحلة اهتزازية 15 طن.',
        materials: 'استهلاك مياه للرش والدمك بمعدل 40 متر مكعب.',
        labTests: 'إجراء فحص الكثافة الحقلية ونسبة الرطوبة لطبقة التأسيس (Proctor Test / Sand Cone).',
        compactionRate: '96.0%',
        manpowerCount: 6
      }
    };

    const t = templates[type];
    if (!t) return;

    if (t.executedWorks) document.getElementById('dr-executed-works').value = t.executedWorks;
    if (t.equipmentDetails) document.getElementById('dr-equipment-details').value = t.equipmentDetails;
    if (t.materials) document.getElementById('dr-materials').value = t.materials;
    if (t.labTests) document.getElementById('dr-lab-tests').value = t.labTests;
    if (t.asphaltTemp) document.getElementById('dr-asphalt-temp').value = t.asphaltTemp;
    if (t.concreteSlump) document.getElementById('dr-concrete-slump').value = t.concreteSlump;
    if (t.compactionRate) document.getElementById('dr-compaction-rate').value = t.compactionRate;
    if (t.manpowerCount) document.getElementById('dr-manpower-count').value = t.manpowerCount;

    if (typeof showToast === 'function') showToast(`✅ تم تطبيق قالب ${type} وتعبئة الحقول الهندسية بنجاح`, 'success');
  }

  /* ─── التحكم بالخريطة داخل نافذة التقرير اليومي ────────────────────── */
  _initDailyReportModalMap(initialLat, initialLng) {
    const mapEl = document.getElementById('dr-report-map');
    if (!mapEl || typeof L === 'undefined') return;

    const lat = parseFloat(initialLat) || 32.3301;
    const lng = parseFloat(initialLng) || 35.7501;

    document.getElementById('dr-lat').value = lat;
    document.getElementById('dr-lng').value = lng;
    const badge = document.getElementById('dr-map-coord-badge');
    if (badge) badge.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    if (this.dailyReportModalMap) {
      this.dailyReportModalMap.remove();
      this.dailyReportModalMap = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.dailyReportModalMap = UnifiedGisEngine.createMap('dr-report-map', [lat, lng], 16);
    } else {
      this.dailyReportModalMap = createUnifiedMap('dr-report-map', [lat, lng], 16);
    }

    const customIcon = L.divIcon({
      className: 'daily-report-modal-pin',
      html: `<div style="background:#0284c7; color:#fff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.3rem; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:grab;">📍</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.dailyReportModalMarker = L.marker([lat, lng], {
      icon: customIcon,
      draggable: true
    }).addTo(this.dailyReportModalMap);

    const updateCoords = (newLat, newLng) => {
      document.getElementById('dr-lat').value = newLat.toFixed(6);
      document.getElementById('dr-lng').value = newLng.toFixed(6);
      if (badge) badge.textContent = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`;
    };

    this.dailyReportModalMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateCoords(pos.lat, pos.lng);
    });

    this.dailyReportModalMap.on('click', (e) => {
      this.dailyReportModalMarker.setLatLng(e.latlng);
      updateCoords(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      if (this.dailyReportModalMap) {
        this.dailyReportModalMap.invalidateSize();
        this.dailyReportModalMap.setView([lat, lng], 16);
      }
    }, 250);
  }

  _resetDailyReportMapToTender() {
    const item = this.activeTender;
    if (!item) return;

    let targetLat = 32.3301;
    let targetLng = 35.7501;

    if (item.lat && item.lng) {
      targetLat = parseFloat(item.lat);
      targetLng = parseFloat(item.lng);
    }

    if (this.dailyReportModalMap && this.dailyReportModalMarker) {
      this.dailyReportModalMarker.setLatLng([targetLat, targetLng]);
      this.dailyReportModalMap.setView([targetLat, targetLng], 16);
      document.getElementById('dr-lat').value = targetLat.toFixed(6);
      document.getElementById('dr-lng').value = targetLng.toFixed(6);
      const badge = document.getElementById('dr-map-coord-badge');
      if (badge) badge.textContent = `${targetLat.toFixed(6)}, ${targetLng.toFixed(6)}`;
      if (typeof showToast === 'function') showToast('🎯 تم ضبط موقع التقرير على مركز العطاء', 'info');
    }
  }

  _locateUserOnDailyReportMap() {
    if (!navigator.geolocation) {
      if (typeof showToast === 'function') showToast('خاصية تحديد الموقع غير مدعومة في المتصفح', 'warning');
      return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
      const uLat = pos.coords.latitude;
      const uLng = pos.coords.longitude;
      if (this.dailyReportModalMap && this.dailyReportModalMarker) {
        this.dailyReportModalMarker.setLatLng([uLat, uLng]);
        this.dailyReportModalMap.setView([uLat, uLng], 17);
        document.getElementById('dr-lat').value = uLat.toFixed(6);
        document.getElementById('dr-lng').value = uLng.toFixed(6);
        const badge = document.getElementById('dr-map-coord-badge');
        if (badge) badge.textContent = `${uLat.toFixed(6)}, ${uLng.toFixed(6)}`;
        if (typeof showToast === 'function') showToast('📍 تم تحديد موقعك الحالي الميداني عبر GPS بنجاح', 'success');
      }
    }, (err) => {
      console.warn('Geolocation error:', err);
      if (typeof showToast === 'function') showToast('تعذر جلب موقع GPS الحالي', 'warning');
    });
  }

  /* ─── فتح وإغلاق نافذة التقرير اليومي ───────────────────────────────── */
  openDailyReportModal(reportIdOrObject = null) {
    const item = this.activeTender;
    if (!item) return;

    const modal = document.getElementById('tender-daily-report-modal');
    const titleEl = document.getElementById('dr-modal-title');
    if (!modal) return;

    let report = null;
    if (typeof reportIdOrObject === 'string' && reportIdOrObject) {
      report = (this.activeDailyReports || []).find(r => String(r.id) === String(reportIdOrObject));
    } else if (typeof reportIdOrObject === 'object' && reportIdOrObject) {
      report = reportIdOrObject;
    }

    const isEdit = !!(report && report.id && !report._isClone);

    if (titleEl) {
      titleEl.textContent = isEdit ? `تعديل تقرير الإشراف اليومي (${report.report_number || report.report_date})` : 'تسجيل وتوليد تقرير الإشراف الهندسي اليومي';
    }

    document.getElementById('dr-tender-id').value = item.id;
    document.getElementById('dr-report-id').value = isEdit ? report.id : '';

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('dr-report-date').value = report ? (String(report.report_date).split('T')[0] || todayStr) : todayStr;
    document.getElementById('dr-report-number').value = report ? (report.report_number || '') : '';
    document.getElementById('dr-weather').value = report ? (report.weather || 'مشمس وصحو') : 'مشمس وصحو';
    document.getElementById('dr-temperature').value = report ? (report.temperature || '') : '';

    const user = this.getCurrentUser();
    document.getElementById('dr-supervisor').value = report ? (report.supervisor_engineer || item.supervisorEngineer || '') : (item.supervisorEngineer || user.fullName || '');
    document.getElementById('dr-inspector').value = report ? (report.field_inspector || '') : '';
    document.getElementById('dr-work-hours').value = report ? (report.work_hours || 8) : 8;
    document.getElementById('dr-delay-hours').value = report ? (report.work_delay_hours || 0) : 0;
    document.getElementById('dr-manpower-count').value = report ? (report.manpower_count || '') : '';
    document.getElementById('dr-equipment-details').value = report ? (report.equipment_details || '') : '';
    document.getElementById('dr-executed-works').value = report ? (report.executed_works || '') : '';
    document.getElementById('dr-asphalt-temp').value = report ? (report.asphalt_temp || '') : '';
    document.getElementById('dr-concrete-slump').value = report ? (report.concrete_slump || '') : '';
    document.getElementById('dr-compaction-rate').value = report ? (report.compaction_rate || '') : '';
    document.getElementById('dr-safety-status').value = report ? (report.safety_status || 'ملتزم بالكامل بمعايير السلامة') : 'ملتزم بالكامل بمعايير السلامة';
    document.getElementById('dr-materials').value = report ? (report.materials_delivered || '') : '';
    document.getElementById('dr-lab-tests').value = report ? (report.lab_tests || '') : '';
    document.getElementById('dr-daily-pct').value = report ? (report.daily_progress_percent || '') : '';
    document.getElementById('dr-cumulative-pct').value = report ? (report.cumulative_progress_percent || item.completionPercentage || '') : (item.completionPercentage || '');
    document.getElementById('dr-instructions').value = report ? (report.instructions_to_contractor || '') : '';
    document.getElementById('dr-obstacles').value = report ? (report.site_obstacles || report.delay_reason || '') : '';
    document.getElementById('dr-site-location-name').value = report ? (report.site_location_name || '') : '';

    // تحديد إحداثيات الخريطة الابتدائية
    let mapLat = 32.3301;
    let mapLng = 35.7501;
    if (report && report.lat && report.lng) {
      mapLat = parseFloat(report.lat);
      mapLng = parseFloat(report.lng);
    } else if (item && item.lat && item.lng) {
      mapLat = parseFloat(item.lat);
      mapLng = parseFloat(item.lng);
    }

    const fileInput = document.getElementById('dr-file');
    if (fileInput) fileInput.value = '';
    const existingAttach = document.getElementById('dr-existing-attach');
    if (existingAttach) existingAttach.value = report ? (report.attachment_path || '') : '';

    const previewCont = document.getElementById('dr-existing-photos-preview');
    if (previewCont) {
      let photos = [];
      try {
        if (report && report.site_photos) photos = JSON.parse(report.site_photos);
      } catch(e) {}
      if (!photos.length && report && report.attachment_path) photos = [report.attachment_path];

      if (photos.length) {
        previewCont.innerHTML = `
          <div style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); width:100%;">المرفقات الحالية المسجلة:</div>
          ${photos.map(p => `<span class="badge" style="background:#0284c718; color:#0284c7; padding:4px 8px; border-radius:4px; font-size:0.75rem;">📎 ${p.split(/[/\\]/).pop()}</span>`).join('')}
        `;
      } else {
        previewCont.innerHTML = '';
      }
    }

    modal.style.display = 'flex';
    this._initDailyReportModalMap(mapLat, mapLng);
  }

  _closeDailyReportModal() {
    const modal = document.getElementById('tender-daily-report-modal');
    if (modal) modal.style.display = 'none';
  }

  /* ─── استنساخ وتكرار التقارير ────────────────────────────────────── */
  cloneLatestDailyReport() {
    const reports = this.activeDailyReports || [];
    if (!reports.length) {
      if (typeof showToast === 'function') showToast('لا توجد تقارير سابقة لاستنساخها', 'info');
      this.openDailyReportModal();
      return;
    }
    this.cloneDailyReport(reports[0].id);
  }

  cloneDailyReport(reportId) {
    const report = (this.activeDailyReports || []).find(r => String(r.id) === String(reportId));
    if (!report) return;

    const cloned = { ...report, _isClone: true, id: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    cloned.report_date = todayStr;
    cloned.report_number = `يومي-${todayStr}`;
    this.openDailyReportModal(cloned);
    if (typeof showToast === 'function') showToast('📋 تم استنساخ بيانات التقرير وتحديث التاريخ لليوم، يمكنك تعديل المنجزات وحفظه', 'info');
  }

  /* ─── حفظ وتوثيق التقرير اليومي (Create / Update) ─────────────────── */
  async saveDailyReport() {
    const tenderId = document.getElementById('dr-tender-id').value;
    const reportId = document.getElementById('dr-report-id').value;
    const reportDate = document.getElementById('dr-report-date').value;
    const executedWorks = document.getElementById('dr-executed-works').value.trim();

    if (!tenderId || !reportDate || !executedWorks) {
      if (typeof showToast === 'function') showToast('يرجى تحديد تاريخ التقرير وتفاصيل الأعمال المنفذة', 'warning');
      return;
    }

    const payload = {
      reportDate,
      reportNumber: document.getElementById('dr-report-number').value.trim(),
      weather: document.getElementById('dr-weather').value,
      temperature: document.getElementById('dr-temperature').value.trim(),
      supervisorEngineer: document.getElementById('dr-supervisor').value.trim(),
      fieldInspector: document.getElementById('dr-inspector').value.trim(),
      workHours: document.getElementById('dr-work-hours').value,
      workDelayHours: document.getElementById('dr-delay-hours').value,
      manpowerCount: document.getElementById('dr-manpower-count').value,
      equipmentDetails: document.getElementById('dr-equipment-details').value.trim(),
      executedWorks,
      asphaltTemp: document.getElementById('dr-asphalt-temp').value.trim(),
      concreteSlump: document.getElementById('dr-concrete-slump').value.trim(),
      compactionRate: document.getElementById('dr-compaction-rate').value.trim(),
      safetyStatus: document.getElementById('dr-safety-status').value,
      materialsDelivered: document.getElementById('dr-materials').value.trim(),
      labTests: document.getElementById('dr-lab-tests').value.trim(),
      dailyProgressPercent: document.getElementById('dr-daily-pct').value,
      cumulativeProgressPercent: document.getElementById('dr-cumulative-pct').value,
      instructionsToContractor: document.getElementById('dr-instructions').value.trim(),
      siteObstacles: document.getElementById('dr-obstacles').value.trim(),
      lat: document.getElementById('dr-lat') ? document.getElementById('dr-lat').value : '',
      lng: document.getElementById('dr-lng') ? document.getElementById('dr-lng').value : '',
      siteLocationName: document.getElementById('dr-site-location-name') ? document.getElementById('dr-site-location-name').value.trim() : ''
    };

    const isEdit = !!reportId;
    const url = isEdit ? `/api/daily-reports/${reportId}` : `/api/tenders/${tenderId}/daily-reports`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      this._setLoading(true);
      const fileInput = document.getElementById('dr-file');
      let res;

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const formData = new FormData();
        Object.keys(payload).forEach(k => {
          if (payload[k] !== undefined && payload[k] !== null) {
            formData.append(k, payload[k]);
          }
        });
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('files', fileInput.files[i]);
        }
        res = await fetch(url, {
          method,
          headers: this._getAuthHeaders(false),
          body: formData
        });
      } else {
        res = await fetch(url, {
          method,
          headers: this._getAuthHeaders(true),
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (res.ok && json.success !== false) {
        if (typeof showToast === 'function') showToast(isEdit ? '✅ تم تحديث بيانات التقرير اليومي بنجاح' : '✅ تم حفظ وتوثيق التقرير اليومي بنجاح', 'success');
        this._closeDailyReportModal();
        await this.loadDailyReports(tenderId);
        await this.loadData();
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل حفظ التقرير: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Save daily report error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  /* ─── حذف التقرير اليومي ─────────────────────────────────────────── */
  async deleteDailyReport(reportId) {
    if (!confirm('هل أنت متأكد من حذف هذا التقرير اليومي نهائياً من سجلات المشروع؟')) return;

    try {
      this._setLoading(true);
      const res = await fetch(`/api/daily-reports/${reportId}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders(true)
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        if (typeof showToast === 'function') showToast('🗑️ تم حذف التقرير اليومي بنجاح', 'success');
        if (this.activeTender) {
          await this.loadDailyReports(this.activeTender.id);
        }
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل حذف التقرير: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Delete daily report error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء حذف التقرير', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  /* ─── طباعة نموذج التقرير اليومي الفردي المعتمد ───────────────────── */
  /* ─── طباعة نموذج التقرير اليومي الفردي المعتمد ───────────────────── */
  printDailyReport(reportId) {
    const report = (this.activeDailyReports || []).find(r => String(r.id) === String(reportId));
    if (!report) return;

    const item = this.activeTender;
    if (!item) return;

    const rDate = String(report.report_date || '').split('T')[0];

    const contentHtml = `
      <div style="font-family:'Tajawal', sans-serif; direction:rtl; text-align:right; color:#0f172a;">
        
        <!-- بطاقة بيانات المشروع والموقع -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.85rem;">
          <tr style="background:#f1f5f9;">
            <td style="padding:6px 10px; border:1px solid #cbd5e1; width:20%; font-weight:bold;">اسم المشروع:</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;" colspan="3"><b>${item.name}</b> (${item.id || item.tenderNumber})</td>
          </tr>
          <tr>
            <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:bold;">المقاول المنفذ:</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;">${item.contractor || '—'}</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:bold;">المهندس المشرف:</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;"><b>${report.supervisor_engineer || item.supervisorEngineer || '—'}</b></td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:bold;">موقع العمل الدقيق (المحطة):</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;"><b>${report.site_location_name || '—'}</b> ${report.lat ? `(GPS: ${parseFloat(report.lat).toFixed(5)}, ${parseFloat(report.lng).toFixed(5)})` : ''}</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:bold;">المراقب الميداني:</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;">${report.field_inspector || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 10px; border:1px solid #cbd5e1; font-weight:bold;">حالة الطقس وساعات العمل:</td>
            <td style="padding:6px 10px; border:1px solid #cbd5e1;" colspan="3">${report.weather || 'معتدل'} (${report.temperature || '—'}) | ساعات العمل: <b>${report.work_hours || 8} س</b> ${parseFloat(report.work_delay_hours || 0) > 0 ? `| ساعات التوقف: <span style="color:#ef4444;">${report.work_delay_hours} س (${report.delay_reason || 'معوقات'})</span>` : ''}</td>
          </tr>
        </table>

        <!-- جدول القوى العاملة والمعدات والإنجاز -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:0.85rem;">
          <tr style="background:#1e3a8a; color:#fff;">
            <th style="padding:6px 10px; border:1px solid #1e3a8a; text-align:right;">عدد العمالة بالموقع</th>
            <th style="padding:6px 10px; border:1px solid #1e3a8a; text-align:right;">المعدات والآليات الثقيلة المتواجدة</th>
            <th style="padding:6px 10px; border:1px solid #1e3a8a; text-align:center;">إنجاز اليوم (%)</th>
            <th style="padding:6px 10px; border:1px solid #1e3a8a; text-align:center;">الإنجاز التراكمي (%)</th>
          </tr>
          <tr>
            <td style="padding:8px 10px; border:1px solid #cbd5e1;">${report.manpower_count || 0} عمال</td>
            <td style="padding:8px 10px; border:1px solid #cbd5e1;">${report.equipment_details || '—'}</td>
            <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${parseFloat(report.daily_progress_percent || 0).toFixed(1)}%</td>
            <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#10b981;">${parseFloat(report.cumulative_progress_percent || 0).toFixed(1)}%</td>
          </tr>
        </table>

        <!-- الأعمال المنفذة ميدانياً -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:12px; margin-bottom:12px;">
          <h4 style="margin:0 0 6px; color:#1e3a8a; font-size:0.95rem;">🏗️ وصف الأعمال والبنود المنفذة ميدانياً:</h4>
          <div style="font-size:0.85rem; line-height:1.7; white-space:pre-wrap;">${report.executed_works}</div>
        </div>

        <!-- ضبط الجودة والفحوصات -->
        ${(report.asphalt_temp || report.concrete_slump || report.compaction_rate || report.lab_tests || report.materials_delivered) ? `
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:12px; margin-bottom:12px; font-size:0.85rem;">
            <h4 style="margin:0 0 6px; color:#1e3a8a; font-size:0.95rem;">🧪 ضبط الجودة والمواد والفحوصات المخبرية:</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              ${report.asphalt_temp ? `<div><b>حرارة الأسفلت:</b> ${report.asphalt_temp}</div>` : ''}
              ${report.concrete_slump ? `<div><b>هبوط الخرسانة:</b> ${report.concrete_slump}</div>` : ''}
              ${report.compaction_rate ? `<div><b>نسبة الدمك:</b> ${report.compaction_rate}</div>` : ''}
              ${report.safety_status ? `<div><b>معايير السلامة:</b> ${report.safety_status}</div>` : ''}
            </div>
            ${report.materials_delivered ? `<div style="margin-top:6px;"><b>المواد الموردة:</b> ${report.materials_delivered}</div>` : ''}
            ${report.lab_tests ? `<div style="margin-top:4px;"><b>الفحوصات المخبرية:</b> ${report.lab_tests}</div>` : ''}
          </div>
        ` : ''}

        ${report.instructions_to_contractor ? `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px 12px; margin-bottom:10px; font-size:0.85rem; color:#92400e;">
            <b>⚠️ التوجيهات والتعليمات المسلمة للمقاول:</b> ${report.instructions_to_contractor}
          </div>
        ` : ''}

        ${(report.site_obstacles || report.delay_reason) ? `
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:10px 12px; margin-bottom:14px; font-size:0.85rem; color:#991b1b;">
            <b>🚧 المعوقات وأسباب التوقف:</b> ${report.site_obstacles || ''} ${report.delay_reason ? `(${report.delay_reason})` : ''}
          </div>
        ` : ''}

      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: `تقرير الإشراف الهندسي والمتابعة الميدانية اليومية`,
        subtitle: `مشروع: ${item.name} (${report.report_number || 'تقرير يومي'} — تاريخ: ${rDate})`,
        documentType: 'SUMMARY_REPORT',
        date: rDate,
        approvalWorkflow: [
          {
            order: 1,
            key: 'INSPECTOR',
            stageTitle: 'التوثيق الميداني',
            roleName: report.field_inspector ? `المراقب الميداني (${report.field_inspector})` : 'المراقب الميداني',
            icon: '👷',
            signLabel: 'التوقيع والتاريخ'
          },
          {
            order: 2,
            key: 'CONTRACTOR_ENG',
            stageTitle: 'الاستلام والمتابعة',
            roleName: 'مندوب المقاول / مهندس الموقع',
            icon: '📐',
            signLabel: 'التوقيع والتاريخ'
          },
          {
            order: 3,
            key: 'SUPERVISOR',
            stageTitle: 'التدقيق والاعتماد الهندسي',
            roleName: report.supervisor_engineer ? `المهندس المشرف (${report.supervisor_engineer})` : 'المهندس المشرف المعتمد',
            icon: '👔',
            signLabel: 'التوقيع والاعتماد'
          }
        ],
        contentHtml
      });
    }
  }

  /* ─── طباعة السجل الشامل لكافة التقارير اليومية (Site Dossier) ─────── */
  printDailyReportsDossier(tenderId) {
    const item = this.tendersData.find(x => String(x.id) === String(tenderId)) || this.activeTender;
    if (!item) return;

    const reports = this.activeDailyReports || [];
    if (!reports.length) {
      if (typeof showToast === 'function') showToast('لا توجد تقارير يومية مسجلة للطباعة', 'warning');
      return;
    }

    const contentHtml = `
      <div style="font-family:'Tajawal', sans-serif; direction:rtl; text-align:right; color:#0f172a;">
        <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:16px;">
          <thead>
            <tr style="background:#1e3a8a; color:#fff;">
              <th style="padding:6px; border:1px solid #1e3a8a; text-align:center; width:30px;">#</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:80px; text-align:center;">التاريخ</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:110px;">الموقع / المحطة</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:70px;">الطقس</th>
              <th style="padding:6px; border:1px solid #1e3a8a;">الأعمال المنفذة ميدانياً</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:90px;">العمال والمعدات</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:90px;">ضبط الجودة</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:50px; text-align:center;">الإنجاز</th>
              <th style="padding:6px; border:1px solid #1e3a8a; width:80px;">المشرف</th>
            </tr>
          </thead>
          <tbody>
            ${reports.map((r, i) => `
              <tr style="border-bottom:1px solid #cbd5e1; background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${i+1}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${String(r.report_date).split('T')[0]}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; font-size:0.75rem;"><b>${r.site_location_name || '—'}</b> ${r.lat ? `<br><span style="font-family:monospace; color:#64748b;">${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lng).toFixed(4)}</span>` : ''}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${r.weather || 'معتدل'}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; line-height:1.4;">${r.executed_works}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; font-size:0.75rem;">${r.manpower_count ? `${r.manpower_count} عمال` : ''}<br>${r.equipment_details || ''}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; font-size:0.75rem;">${r.asphalt_temp ? `حرارة: ${r.asphalt_temp}<br>` : ''}${r.compaction_rate ? `دمك: ${r.compaction_rate}` : ''}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#10b981;">${parseFloat(r.cumulative_progress_percent || 0).toFixed(1)}%</td>
                <td style="padding:6px; border:1px solid #cbd5e1; font-size:0.75rem;">${r.supervisor_engineer || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: `السجل الميداني الشامل للتقارير اليومية (Site Diary Log)`,
        subtitle: `مشروع: ${item.name} (${item.id || item.tenderNumber}) — إجمالي التقارير: ${reports.length}`,
        documentType: 'SUMMARY_REPORT',
        orientation: 'landscape',
        sectionName: 'رئيس القسم',
        approvalWorkflow: [
          {
            order: 1,
            key: 'SUPERVISOR',
            stageTitle: 'الإشراف والمتابعة الميدانية',
            roleName: item.supervisorEngineer ? `المهندس المشرف (${item.supervisorEngineer})` : 'المهندس المشرف المعتمد',
            icon: '📝',
            signLabel: 'التوقيع والتاريخ'
          },
          {
            order: 2,
            key: 'SECTION_HEAD',
            stageTitle: 'التدقيق الهندسي والمطابقة',
            roleName: 'رئيس القسم',
            icon: '🔍',
            signLabel: 'التوقيع والتاريخ'
          },
          {
            order: 3,
            key: 'DIRECTOR',
            stageTitle: 'المصادقة والاعتماد النهائي',
            roleName: 'مدير الأشغال والخدمات الهندسية',
            icon: '🏛️',
            signLabel: 'التوقيع والاعتماد الرسمي'
          }
        ],
        contentHtml
      });
    }
  }

  /* ─── تصدير التقارير اليومية إلى ملف Excel (CSV) ──────────────────── */
  exportDailyReportsToExcel() {
    const item = this.activeTender;
    const reports = this.filteredDailyReports || this.activeDailyReports || [];
    if (!reports.length) {
      if (typeof showToast === 'function') showToast('لا توجد بيانات تقارير للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم التقرير', 'تاريخ التقرير', 'المشروع', 'موقع العمل والمحطة', 'خط العرض (Lat)', 'خط الطول (Lng)',
      'المهندس المشرف', 'المراقب الميداني', 'حالة الطقس', 'درجة الحرارة', 'ساعات العمل', 'ساعات التوقف',
      'عدد العمال', 'الآليات والمعدات', 'الأعمال المنفذة', 'حرارة الأسفلت', 'هبوط الخرسانة',
      'نسبة الدمك', 'المواد الموردة', 'الفحوصات المخبرية', 'إنجاز اليوم %',
      'الإنجاز التراكمي %', 'معايير السلامة', 'توجيهات المقاول', 'المعوقات'
    ];

    const rows = reports.map(r => [
      r.report_number || '',
      String(r.report_date).split('T')[0],
      item ? item.name : '',
      `"${(r.site_location_name || '').replace(/"/g, '""')}"`,
      r.lat || '',
      r.lng || '',
      r.supervisor_engineer || '',
      r.field_inspector || '',
      r.weather || '',
      r.temperature || '',
      r.work_hours || 8,
      r.work_delay_hours || 0,
      r.manpower_count || 0,
      `"${(r.equipment_details || '').replace(/"/g, '""')}"`,
      `"${(r.executed_works || '').replace(/"/g, '""')}"`,
      r.asphalt_temp || '',
      r.concrete_slump || '',
      r.compaction_rate || '',
      `"${(r.materials_delivered || '').replace(/"/g, '""')}"`,
      `"${(r.lab_tests || '').replace(/"/g, '""')}"`,
      r.daily_progress_percent || 0,
      r.cumulative_progress_percent || 0,
      r.safety_status || '',
      `"${(r.instructions_to_contractor || '').replace(/"/g, '""')}"`,
      `"${(r.site_obstacles || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Reports_${item ? item.id : 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof showToast === 'function') showToast('📊 تم تصدير سجل التقارير اليومية إلى ملف Excel بنجاح', 'success');
  }

  async deleteDailyReport(reportId) {
    if (!confirm('هل أنت متأكد من حذف هذا التقرير اليومي نهائياً من سجلات المشروع؟')) return;

    try {
      this._setLoading(true);
      const res = await fetch(`/api/daily-reports/${reportId}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders(true)
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        if (typeof showToast === 'function') showToast('🗑️ تم حذف التقرير اليومي بنجاح', 'success');
        if (this.activeTender) {
          await this.loadDailyReports(this.activeTender.id);
        }
      } else {
        if (typeof showToast === 'function') showToast('❌ فشل حذف التقرير: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch(err) {
      console.error('Delete daily report error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ أثناء حذف التقرير', 'error');
    } finally {
      this._setLoading(false);
    }
  }



  _setLoading(loading) {
    const tbody = document.getElementById('tenders-table-tbody');
    if (tbody && loading) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:30px;">
            <div class="spinner" style="margin:0 auto 10px;"></div>
            <div style="color:var(--text-muted); font-size:0.9rem;">جارٍ تحميل ومعالجة بيانات العطاءات...</div>
          </td>
        </tr>
      `;
    }
  }
}

/* ─── التهيئة العامة للموديول ─────────────────────────────────────────── */
let tendersManager = null;

function loadTendersModule() {
  const container = document.getElementById('tenders-tab-container');
  if (!container) return;

  if (!tendersManager) {
    tendersManager = new UnifiedTendersManager('tenders-tab-container');
  } else {
    tendersManager.loadData();
    tendersManager._switchView('list');
  }
}

window.previewTenderDoc = function(tenderId, filename) {
  if (tendersManager) {
    tendersManager.previewDocument(tenderId, filename);
  }
};
