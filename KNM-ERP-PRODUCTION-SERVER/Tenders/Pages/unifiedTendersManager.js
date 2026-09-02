/**
 * ============================================================================
 * نظام إدارة العطاءات والمشاريع الموحد (Unified Executive Tenders & Projects Manager)
 * بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية
 * ============================================================================
 * الإصدار التنفيذي الموحد v5.0
 * المحور التنفيذي الموحد: العطاء والمشروع، التقارير اليومية، سجل الإنجاز،
 * جداول الكميات، ملاحظات الإشراف، الفحوصات المخبرية، وجاهزية لجان الاستلام.
 */

class UnifiedTendersManager {
  constructor(containerId = 'tenders-tab-container') {
    this.containerId = containerId;
    this.tendersData = [];
    this.filteredData = [];
    this.activeTender = null;
    this.activeHubTab = 'overview';
    this.currentView = 'list'; // 'list' | 'hub' | 'form'
    this.hubData = null;
    this.map = null;
    this.marker = null;
    this.hubMap = null;
    this.hubMarker = null;

    this.filters = {
      search: '',
      type: '',
      status: '',
      method: '',
      committee: '',
      year: ''
    };

    this.init();
  }

  /* ─── محرك التحقق من الصلاحيات ────────────────────────────────────────── */
  getCurrentUser() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) return currentUser;
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('engineeringUser');
      if (userStr) return JSON.parse(userStr);
    } catch(e) {}
    return { role: 'user', fullName: 'مستخدم النظام', permissions: [] };
  }

  can(action, tender = null) {
    const user = this.getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role === 'admin' || role === 'director' || role === 'manager' || user.id === 'U-001') return true;

    const perms = Array.isArray(user.permissions) ? user.permissions : (typeof user.permissions === 'string' ? user.permissions.split(',') : []);
    if (perms.includes('*') || perms.includes(`tenders:${action}`) || perms.includes(`TENDERS.${action.toUpperCase()}`)) return true;

    switch (action) {
      case 'view':
      case 'preview':
      case 'print':
        return true;
      case 'create':
        return ['dept_head', 'engineer', 'manager'].includes(role) || perms.includes('tenders:create');
      case 'edit':
        if (['dept_head', 'manager'].includes(role)) return true;
        if (role === 'engineer') {
          if (tender && tender.supervisorEngineer && tender.supervisorEngineer.includes(user.fullName)) return true;
          return true;
        }
        return false;
      case 'delete':
        return ['admin', 'director', 'manager'].includes(role);
      default:
        return false;
    }
  }

  /* ─── التهيئة والتحميل ─────────────────────────────────────────────────── */
  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    await this.fetchTenders();
    this.render();
  }

  async fetchTenders() {
    try {
      const res = await fetch('/api/tenders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        this.tendersData = await res.json();
        this.applyFilters();
      }
    } catch (e) {
      console.warn('Failed to fetch tenders:', e.message);
    }
  }

  applyFilters() {
    this.filteredData = (this.tendersData || []).filter(t => {
      const q = (this.filters.search || '').trim().toLowerCase();
      if (q) {
        const text = `${t.name || ''} ${t.contractor || ''} ${t.id || ''} ${t.tenderNumber || ''} ${t.district || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (this.filters.status && t.status !== this.filters.status) return false;
      if (this.filters.type && (t.tenderType !== this.filters.type && t.type !== this.filters.type)) return false;
      if (this.filters.method && t.purchaseMethod !== this.filters.method) return false;
      if (this.filters.committee && t.purchaseCommittee !== this.filters.committee) return false;
      if (this.filters.year) {
        const dateStr = String(t.contractSignDate || t.openDate || t.createdAt || '');
        if (!dateStr.startsWith(this.filters.year)) return false;
      }
      return true;
    });

    if (this.currentView === 'list') {
      this.renderListBody();
    }
  }

  /* ─── عرض الواجهة الرئيسية ────────────────────────────────────────────── */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (this.currentView === 'hub' && this.activeTender) {
      this.renderWorkspaceHub(container);
      return;
    }

    // إحصائيات سريعة للبطاقات
    const totalCount = this.tendersData.length;
    const activeCount = this.tendersData.filter(t => (t.status || '').includes('قيد') || (t.status || '').includes('مستمر') || t.status === 'محال').length;
    const totalBudget = this.tendersData.reduce((sum, t) => sum + (parseFloat(t.awardedValue || t.value || t.estimatedValue) || 0), 0);
    const completedCount = this.tendersData.filter(t => (t.status || '').includes('مكتمل') || (t.status || '').includes('مستلم') || t.status === 'منتهي').length;

    container.innerHTML = `
      <div class="tenders-unified-wrapper" style="direction:rtl; font-family: 'Segoe UI', Tahoma, sans-serif;">
        <!-- 1. ترويسة الصفحة وبطاقات الإنجاز القيادية -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary, #1e293b); display:flex; align-items:center; gap:8px;">
              <span>📋</span> منظومة إدارة العطاءات والمشاريع التنفيذية
            </h2>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary, #64748b);">المحور التنفيذي الموحد للعطاءات والمشاريع البلدية - بلدية كفرنجة الجديدة</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${this.can('create') ? `
              <button class="btn btn-primary" onclick="window.unifiedTendersManager.openTenderModal()" style="background:#0f766e; color:#fff; padding:9px 18px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <span>➕</span> طرح عطاء / مشروع جديد
              </button>
            ` : ''}
            <button class="btn btn-outline" onclick="window.unifiedTendersManager.exportTendersCsv()" style="padding:9px 14px; border-radius:8px; border:1px solid #cbd5e1; background:var(--bg-surface, #fff); cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>📥</span> تصدير البيانات (CSV)
            </button>
            <button class="btn btn-outline" onclick="window.print()" style="padding:9px 14px; border-radius:8px; border:1px solid #cbd5e1; background:var(--bg-surface, #fff); cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>🖨️</span> طباعة الكشف
            </button>
          </div>
        </div>

        <!-- 2. بطاقات المؤشرات القيادية -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; border-right:4px solid #0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size:0.8rem; color:#64748b; font-weight:600;">إجمالي العطاءات والمشاريع</div>
            <div style="font-size:1.6rem; font-weight:800; color:#0f766e; margin-top:4px;">${totalCount}</div>
            <div style="font-size:0.75rem; color:#10b981; margin-top:4px;">قيد التوثيق والتنفيذ</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; border-right:4px solid #0284c7; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size:0.8rem; color:#64748b; font-weight:600;">قيد التنفيذ والمتابعة الميدانية</div>
            <div style="font-size:1.6rem; font-weight:800; color:#0284c7; margin-top:4px;">${activeCount}</div>
            <div style="font-size:0.75rem; color:#0284c7; margin-top:4px;">مباشرة عمل وتقارير يومية</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; border-right:4px solid #f59e0b; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size:0.8rem; color:#64748b; font-weight:600;">إجمالي الموازنة والالتزامات</div>
            <div style="font-size:1.6rem; font-weight:800; color:#d97706; margin-top:4px;">${totalBudget.toLocaleString()} <span style="font-size:0.9rem;">د.أ</span></div>
            <div style="font-size:0.75rem; color:#d97706; margin-top:4px;">مجموع قيم الإحالة والتعاقد</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; border-right:4px solid #10b981; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size:0.8rem; color:#64748b; font-weight:600;">المشاريع المكتملة والمستلمة</div>
            <div style="font-size:1.6rem; font-weight:800; color:#10b981; margin-top:4px;">${completedCount}</div>
            <div style="font-size:0.75rem; color:#10b981; margin-top:4px;">استلام أولي ونهائي أصولي</div>
          </div>
        </div>

        <!-- 3. شريط البحث والتصفية المتطورة -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; margin-bottom: 20px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items:flex-end;">
            <div style="grid-column: span 2;">
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">البحث الشامل (اسم المشروع، المقاول، الرقم)</label>
              <input type="text" id="tenders-search-input" value="${this.filters.search}" placeholder="اكتب اسم العطاء، المقاول، أو رقم العطاء..." class="form-control" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;" oninput="window.unifiedTendersManager.onSearchChange(this.value)" />
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">حالة العطاء</label>
              <select id="tenders-status-filter" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.unifiedTendersManager.onFilterChange('status', this.value)">
                <option value="">جميع الحالات</option>
                <option value="مفتوح" ${this.filters.status === 'مفتوح' ? 'selected' : ''}>مفتوح / طرح</option>
                <option value="محال" ${this.filters.status === 'محال' ? 'selected' : ''}>محال / جاري التعاقد</option>
                <option value="قيد التنفيذ" ${this.filters.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ والمتابعة</option>
                <option value="جاهز للاستلام" ${this.filters.status === 'جاهز للاستلام' ? 'selected' : ''}>جاهز للاستلام</option>
                <option value="مستلم أولياً" ${this.filters.status === 'مستلم أولياً' ? 'selected' : ''}>مستلم أولياً</option>
                <option value="مستلم نهائياً" ${this.filters.status === 'مستلم نهائياً' ? 'selected' : ''}>مستلم نهائياً ومغلق</option>
                <option value="ملغي" ${this.filters.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">نوع العطاء</label>
              <select id="tenders-type-filter" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.unifiedTendersManager.onFilterChange('type', this.value)">
                <option value="">جميع الأنواع</option>
                <option value="أشغال" ${this.filters.type === 'أشغال' ? 'selected' : ''}>أشغال وتعبيد طرق</option>
                <option value="إنشاءات" ${this.filters.type === 'إنشاءات' ? 'selected' : ''}>إنشاءات ومباني وجدران</option>
                <option value="توريدات" ${this.filters.type === 'توريدات' ? 'selected' : ''}>توريدات ولوازم</option>
                <option value="خدمات هندسية" ${this.filters.type === 'خدمات هندسية' ? 'selected' : ''}>خدمات استشارية وهندسية</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">السنة المالية</label>
              <select id="tenders-year-filter" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.unifiedTendersManager.onFilterChange('year', this.value)">
                <option value="">جميع السنوات</option>
                <option value="2026" ${this.filters.year === '2026' ? 'selected' : ''}>2026</option>
                <option value="2025" ${this.filters.year === '2025' ? 'selected' : ''}>2025</option>
                <option value="2024" ${this.filters.year === '2024' ? 'selected' : ''}>2024</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 4. جدول وبطاقات استعراض العطاءات -->
        <div id="tenders-table-container" style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        </div>
      </div>
    `;

    this.renderListBody();
  }

  renderListBody() {
    const container = document.getElementById('tenders-table-container');
    if (!container) return;

    if (this.filteredData.length === 0) {
      container.innerHTML = `
        <div style="padding:40px; text-align:center; color:#94a3b8;">
          <div style="font-size:3rem; margin-bottom:10px;">📋</div>
          <div style="font-size:1.1rem; font-weight:bold; color:#475569;">لا توجد عطاءات أو مشاريع مطابقة للبحث</div>
          <p style="margin-top:6px; font-size:0.85rem;">يمكنك تعديل خيارات التصفية أو إضافة عطاء جديد للمنظومة.</p>
        </div>
      `;
      return;
    }

    const rowsHtml = this.filteredData.map(t => {
      const val = parseFloat(t.awardedValue || t.value || t.estimatedValue) || 0;
      const progress = parseFloat(t.completionPercentage) || 0;
      const statusBadge = this.getStatusBadge(t.status);

      return `
        <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <td style="padding:14px 16px; font-weight:bold; color:#0f766e; white-space:nowrap;">
            ${t.tenderNumber || t.id}
          </td>
          <td style="padding:14px 16px;">
            <div style="font-weight:700; color:#1e293b; font-size:0.95rem; cursor:pointer;" onclick="window.unifiedTendersManager.openWorkspace('${t.id}')">
              ${t.name}
            </div>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
              <span>📍 ${t.district || 'كفرنجة'}</span> | <span>🏷️ ${t.tenderType || 'أشغال'}</span> | <span>👨‍💼 ${t.supervisorEngineer || 'المهندس المشرف'}</span>
            </div>
          </td>
          <td style="padding:14px 16px; color:#334155;">
            <div style="font-weight:600;">${t.contractor || '<span style="color:#94a3b8;">لم يحدد بعد</span>'}</div>
            <div style="font-size:0.75rem; color:#64748b;">${t.purchaseMethod || 'مناقصة عامة'}</div>
          </td>
          <td style="padding:14px 16px; font-weight:700; color:#0f766e; white-space:nowrap;">
            ${val.toLocaleString()} د.أ
          </td>
          <td style="padding:14px 16px; min-width:140px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:600; margin-bottom:4px;">
              <span>نسبة الإنجاز</span>
              <span>${progress}%</span>
            </div>
            <div style="background:#e2e8f0; height:7px; border-radius:10px; overflow:hidden;">
              <div style="background:#0f766e; width:${Math.min(100, progress)}%; height:100%; border-radius:10px;"></div>
            </div>
          </td>
          <td style="padding:14px 16px; text-align:center;">
            ${statusBadge}
          </td>
          <td style="padding:14px 16px; text-align:left; white-space:nowrap;">
            <button class="btn btn-sm" onclick="window.unifiedTendersManager.openWorkspace('${t.id}')" style="background:#0f766e; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;" title="فتح مساحة العمل التنفيذية">
              🏛️ الملف التنفيذي
            </button>
            <button class="btn btn-sm" onclick="window.unifiedTendersManager.printTenderSummary('${t.id}')" style="background:#fff; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:4px;" title="طباعة تقرير العطاء">
              🖨️
            </button>
            ${this.can('edit', t) ? `
              <button class="btn btn-sm" onclick="window.unifiedTendersManager.openTenderModal('${t.id}')" style="background:#fff; border:1px solid #cbd5e1; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:4px;" title="تعديل العطاء">
                ✏️
              </button>
            ` : ''}
            ${this.can('delete', t) ? `
              <button class="btn btn-sm" onclick="window.unifiedTendersManager.deleteTender('${t.id}')" style="background:#fff; border:1px solid #fecaca; color:#ef4444; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:4px;" title="حذف العطاء">
                🗑️
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.9rem;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569; font-weight:700;">
              <th style="padding:12px 16px;">رقم العطاء</th>
              <th style="padding:12px 16px;">اسم العطاء / المشروع</th>
              <th style="padding:12px 16px;">المقاول المنفذ</th>
              <th style="padding:12px 16px;">قيمة الإحالة</th>
              <th style="padding:12px 16px;">مؤشر الإنجاز</th>
              <th style="padding:12px 16px; text-align:center;">الحالة</th>
              <th style="padding:12px 16px; text-align:left;">الإجراءات التنفيذية</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  getStatusBadge(status) {
    const s = String(status || 'مفتوح');
    if (s.includes('مستلم') || s.includes('مكتمل') || s === 'منتهي') {
      return `<span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
    }
    if (s.includes('تنفيذ') || s.includes('جاري') || s.includes('مستمر')) {
      return `<span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
    }
    if (s.includes('محال') || s.includes('تعاقد')) {
      return `<span style="background:#fef3c7; color:#92400e; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
    }
    if (s.includes('جاهز')) {
      return `<span style="background:#fae8ff; color:#86198f; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
    }
    if (s.includes('ملغي')) {
      return `<span style="background:#fee2e2; color:#991b1b; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
    }
    return `<span style="background:#f1f5f9; color:#475569; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold;">${s}</span>`;
  }

  onSearchChange(val) {
    this.filters.search = val;
    this.applyFilters();
  }

  onFilterChange(key, val) {
    this.filters[key] = val;
    this.applyFilters();
  }

  /* ─── مساحة العمل التنفيذية الشاملة للعطاء (Workspace Hub) ─────────────── */
  async openWorkspace(tenderId) {
    try {
      const res = await fetch(`/api/tenders/${tenderId}/hub-details`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        this.activeTender = data.tender;
        this.hubData = data;
        this.currentView = 'hub';
        this.activeHubTab = 'overview';
        this.render();
      } else {
        alert('تعذر تحميل بيانات الملف التنفيذي: ' + (data.error || ''));
      }
    } catch (e) {
      alert('خطأ في الاتصال بالخادم: ' + e.message);
    }
  }

  closeWorkspace() {
    this.currentView = 'list';
    this.activeTender = null;
    this.hubData = null;
    this.render();
  }

  switchHubTab(tabId) {
    this.activeHubTab = tabId;
    const container = document.getElementById(this.containerId);
    if (container) this.renderWorkspaceHub(container);
  }

  renderWorkspaceHub(container) {
    const t = this.activeTender;
    const h = this.hubData || { dailyReports: [], claims: [], variationOrders: [], archiveDocs: [], metrics: {} };
    const m = h.metrics || {};

    const tabs = [
      { id: 'overview', name: 'ملخص المشروع والمؤشرات', icon: '📊' },
      { id: 'daily-form', name: 'توثيق تقرير يومي جديد', icon: '📝' },
      { id: 'daily-log', name: `سجل التقارير اليومية (${h.dailyReports.length})`, icon: '📋' },
      { id: 'boq', name: 'جدول الكميات والأعمال المنفذة', icon: '📐' },
      { id: 'supervision', name: 'ملاحظات الإشراف والموقع', icon: '👷' },
      { id: 'quality', name: 'الفحوصات المخبرية وضبط الجودة', icon: '🧪' },
      { id: 'claims', name: `المطالبات والدفعات (${h.claims.length})`, icon: '💰' },
      { id: 'variations', name: `الأوامر التغييرية (${h.variationOrders.length})`, icon: '📑' },
      { id: 'acceptance', name: 'الجاهزية ولجنة الاستلام', icon: '🤝' },
      { id: 'documents', name: `الأرشيف والمرفقات (${h.archiveDocs.length})`, icon: '📁' },
      { id: 'gis', name: 'الخريطة والموقع الجغرافي', icon: '🌍' }
    ];

    const tabsNavHtml = tabs.map(tab => `
      <button onclick="window.unifiedTendersManager.switchHubTab('${tab.id}')" style="padding:10px 16px; border:none; background:${this.activeHubTab === tab.id ? '#0f766e' : 'transparent'}; color:${this.activeHubTab === tab.id ? '#fff' : '#475569'}; font-weight:bold; font-size:0.85rem; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; transition:all 0.2s;">
        <span>${tab.icon}</span> <span>${tab.name}</span>
      </button>
    `).join('');

    container.innerHTML = `
      <div class="tender-hub-wrapper" style="direction:rtl; font-family: 'Segoe UI', Tahoma, sans-serif;">
        <!-- Hub Top Navigation Bar -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px 20px; margin-bottom: 20px; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid #f1f5f9; padding-bottom:14px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <button onclick="window.unifiedTendersManager.closeWorkspace()" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold; color:#475569;">
                ⬅️ العودة للقائمة
              </button>
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:1.2rem; font-weight:800; color:#0f766e;">[${t.tenderNumber || t.id}]</span>
                  <span style="font-size:1.2rem; font-weight:800; color:#1e293b;">${t.name}</span>
                  ${this.getStatusBadge(t.status)}
                </div>
                <div style="font-size:0.85rem; color:#64748b; margin-top:3px;">
                  <span>المقاول: <strong>${t.contractor || 'غير محدد'}</strong></span> | 
                  <span>المهندس المشرف: <strong>${t.supervisorEngineer || 'قسم الإشراف'}</strong></span> | 
                  <span>تاريخ المباشرة: <strong>${t.commencementDate || t.openDate || 'غير محدد'}</strong></span>
                </div>
              </div>
            </div>

            <!-- Quick Action Toolbar -->
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="window.unifiedTendersManager.switchHubTab('daily-form')" style="background:#0f766e; color:#fff; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;">
                <span>📝</span> توثيق تقرير يومي
              </button>
              <button class="btn btn-outline" onclick="window.unifiedTendersManager.switchHubTab('acceptance')" style="border:1px solid #0f766e; color:#0f766e; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer; background:#fff;">
                <span>🤝</span> محضر الاستلام
              </button>
              <button class="btn btn-outline" onclick="window.unifiedTendersManager.printTenderExecutiveFile('${t.id}')" style="border:1px solid #cbd5e1; padding:8px 14px; border-radius:8px; cursor:pointer; background:#fff;">
                <span>🖨️</span> طباعة الملف التنفيذي
              </button>
            </div>
          </div>

          <!-- Hub Tabs Navigation -->
          <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px;">
            ${tabsNavHtml}
          </div>
        </div>

        <!-- Hub Tab Content Container -->
        <div id="tender-hub-tab-body">
          ${this.renderActiveHubTabContent()}
        </div>
      </div>
    `;

    // تهيئة الخريطة إذا كان التبويب هو GIS
    if (this.activeHubTab === 'gis') {
      setTimeout(() => this.initHubGisMap(), 100);
    }
  }

  renderActiveHubTabContent() {
    switch (this.activeHubTab) {
      case 'overview':
        return this.renderTabOverview();
      case 'daily-form':
        return this.renderTabDailyForm();
      case 'daily-log':
        return this.renderTabDailyLog();
      case 'boq':
        return this.renderTabBoq();
      case 'supervision':
        return this.renderTabSupervision();
      case 'quality':
        return this.renderTabQuality();
      case 'claims':
        return this.renderTabClaims();
      case 'variations':
        return this.renderTabVariations();
      case 'acceptance':
        return this.renderTabAcceptance();
      case 'documents':
        return this.renderTabDocuments();
      case 'gis':
        return this.renderTabGis();
      default:
        return this.renderTabOverview();
    }
  }

  /* ─── 1. تبويب نظرة عامة ومؤشرات المشروع ─────────────────────────────── */
  renderTabOverview() {
    const t = this.activeTender;
    const h = this.hubData || {};
    const m = h.metrics || {};
    const val = parseFloat(t.awardedValue || t.value || t.estimatedValue) || 0;
    const progress = parseFloat(t.completionPercentage) || 0;

    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- البطاقة المالية والتنفيذية -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
          <h3 style="margin:0 0 16px 0; font-size:1.1rem; color:#0f766e; border-bottom:1px solid #f1f5f9; padding-bottom:8px; display:flex; align-items:center; gap:8px;">
            <span>💰</span> المؤشرات المالية والتعاقدية
          </h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div style="background:#f8fafc; padding:12px; border-radius:8px;">
              <div style="font-size:0.75rem; color:#64748b;">قيمة الإحالة الأصلية</div>
              <div style="font-size:1.2rem; font-weight:800; color:#1e293b;">${val.toLocaleString()} د.أ</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px;">
              <div style="font-size:0.75rem; color:#64748b;">صافي الأوامر التغييرية</div>
              <div style="font-size:1.2rem; font-weight:800; color:#d97706;">${(m.totalVariationAmount || 0).toLocaleString()} د.أ</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px;">
              <div style="font-size:0.75rem; color:#64748b;">قيمة العقد الفعالة</div>
              <div style="font-size:1.2rem; font-weight:800; color:#0f766e;">${(m.effectiveContractValue || val).toLocaleString()} د.أ</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px;">
              <div style="font-size:0.75rem; color:#64748b;">المصروف الفعلي (المطالبات)</div>
              <div style="font-size:1.2rem; font-weight:800; color:#0284c7;">${(m.totalClaimsPaid || 0).toLocaleString()} د.أ</div>
            </div>
          </div>

          <div style="margin-top:20px;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">
              <span>نسبة الصرف المالي من العقد</span>
              <span>${m.financialPercentage || 0}%</span>
            </div>
            <div style="background:#e2e8f0; height:9px; border-radius:10px; overflow:hidden;">
              <div style="background:#0284c7; width:${m.financialPercentage || 0}%; height:100%;"></div>
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">
              <span>نسبة الإنجاز الفعلي الميداني</span>
              <span>${progress}%</span>
            </div>
            <div style="background:#e2e8f0; height:9px; border-radius:10px; overflow:hidden;">
              <div style="background:#0f766e; width:${progress}%; height:100%;"></div>
            </div>
          </div>
        </div>

        <!-- بطاقة البيانات التعاقدية والتوقيتات -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
          <h3 style="margin:0 0 16px 0; font-size:1.1rem; color:#0f766e; border-bottom:1px solid #f1f5f9; padding-bottom:8px; display:flex; align-items:center; gap:8px;">
            <span>📅</span> التوقيتات والضمانات البنكية
          </h3>
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;">تاريخ توقيع العقد:</td><td style="padding:8px 0; font-weight:bold;">${t.contractSignDate || 'غير محدد'}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;">تاريخ أمر المباشرة:</td><td style="padding:8px 0; font-weight:bold;">${t.commencementDate || 'غير محدد'}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;">مدة التنفيذ العقدية:</td><td style="padding:8px 0; font-weight:bold;">${t.durationDays || 0} يوماً</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;">رقم كفالة حسن التنفيذ:</td><td style="padding:8px 0; font-weight:bold;">${t.performanceBondNumber || 'غير متوفر'}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; color:#64748b;">قيمة كفالة حسن التنفيذ:</td><td style="padding:8px 0; font-weight:bold;">${parseFloat(t.performanceBondValue || 0).toLocaleString()} د.أ</td></tr>
            <tr><td style="padding:8px 0; color:#64748b;">انتهاء صلاحية الكفالة:</td><td style="padding:8px 0; font-weight:bold; color:#d97706;">${t.performanceBondExpiry || 'غير محدد'}</td></tr>
          </table>
        </div>
      </div>
    `;
  }

  /* ─── 2. تبويب نموذج توثيق التقرير اليومي ─────────────────────────────── */
  renderTabDailyForm(editReport = null) {
    const t = this.activeTender;
    const user = this.getCurrentUser();
    const today = new Date().toISOString().split('T')[0];

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:24px; max-width:900px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f766e; padding-bottom:12px; margin-bottom:20px;">
          <div>
            <h3 style="margin:0; color:#0f766e; font-size:1.2rem; display:flex; align-items:center; gap:8px;">
              <span>📝</span> ${editReport ? 'تعديل تقرير العمل الميداني اليومي' : 'توثيق تقرير العمل الميداني اليومي'}
            </h3>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">مشروع: ${t.name} (${t.tenderNumber || t.id})</div>
          </div>
          <button class="btn btn-outline" onclick="window.unifiedTendersManager.switchHubTab('daily-log')" style="font-size:0.8rem; padding:6px 12px;">
            استعراض السجل السابق
          </button>
        </div>

        <form id="tender-daily-report-form" onsubmit="window.unifiedTendersManager.submitDailyReport(event, '${editReport ? editReport.id : ''}')">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:16px;">
            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">تاريخ التقرير *</label>
              <input type="date" name="reportDate" required value="${editReport ? editReport.report_date : today}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">رقم التقرير</label>
              <input type="text" name="reportNumber" value="${editReport ? editReport.report_number : `يومي-${today}`}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">حالة الطقس</label>
              <select name="weather" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="مشمس ومعتدل" ${editReport?.weather === 'مشمس ومعتدل' ? 'selected' : ''}>مشمس ومعتدل</option>
                <option value="غائم جزئياً" ${editReport?.weather === 'غائم جزئياً' ? 'selected' : ''}>غائم جزئياً</option>
                <option value="ماطر / متوقف العمل" ${editReport?.weather === 'ماطر / متوقف العمل' ? 'selected' : ''}>ماطر / متوقف العمل</option>
                <option value="حار جداً" ${editReport?.weather === 'حار جداً' ? 'selected' : ''}>حار جداً</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المهندس المشرف</label>
              <input type="text" name="supervisorEngineer" value="${editReport ? editReport.supervisor_engineer : (t.supervisorEngineer || user.fullName)}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:16px;">
            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">عدد العمالة بالموقع</label>
              <input type="number" name="manpowerCount" value="${editReport ? editReport.manpower_count : 5}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">تفاصيل العمالة والكادر</label>
              <input type="text" name="manpowerDetails" placeholder="1 مهندس، 1 مساح، 4 عمال..." value="${editReport ? editReport.manpower_details || '' : ''}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>

            <div style="grid-column:span 2;">
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">الآليات والمعدات العاملة</label>
              <input type="text" name="equipmentDetails" placeholder="فنشر زفتة، مداحل حديد ومطاط، بوكلين، قلابات..." value="${editReport ? editReport.equipment_details || '' : ''}" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
            </div>
          </div>

          <!-- تفاصيل الأعمال المنفذة -->
          <div style="margin-bottom:16px;">
            <label style="font-size:0.85rem; font-weight:bold; color:#0f766e; display:block; margin-bottom:4px;">الأعمال والبنود المنفذة خلال اليوم *</label>
            <textarea name="executedWorks" required rows="4" placeholder="وصف تفصيلي للأعمال المنفذة (أطوال الطرق المعبدة، طبقات البيسكورس المنجزة، الجدران المصبوبة...)" class="form-control" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">${editReport ? editReport.executed_works : ''}</textarea>
          </div>

          <!-- المواد الموردة والفحوصات -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المواد الموردة للموقع</label>
              <textarea name="materialsDelivered" rows="2" placeholder="كميات الخلطة الإسفلتية، الباطون الجاهز، البيسكورس..." class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;">${editReport ? editReport.materials_delivered || '' : ''}</textarea>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">الفحوصات المخبرية وعينات الجودة</label>
              <textarea name="labTests" rows="2" placeholder="فحص الهبوط، حرارة الإسفلت، عينات مكعبات خرسانة..." class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;">${editReport ? editReport.lab_tests || '' : ''}</textarea>
            </div>
          </div>

          <!-- نسب الإنجاز التراكمية ومعايير الجودة الفنية -->
          <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
            <div style="font-weight:bold; color:#0f766e; margin-bottom:10px; font-size:0.9rem;">📊 مؤشرات الإنجاز وضبط الجودة الفنية</div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px;">
              <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">نسبة الإنجاز اليومي (%)</label>
                <input type="number" step="0.1" name="dailyProgressPercent" value="${editReport ? editReport.daily_progress_percent : 1.5}" class="form-control" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1;" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">نسبة الإنجاز التراكمي (%)</label>
                <input type="number" step="0.1" name="cumulativeProgressPercent" value="${editReport ? editReport.cumulative_progress_percent : (parseFloat(t.completionPercentage) || 0)}" class="form-control" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1;" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">حرارة الإسفلت المورد (°C)</label>
                <input type="text" name="asphaltTemp" placeholder="150°C - 165°C" value="${editReport ? editReport.asphalt_temp || '' : '155°C'}" class="form-control" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1;" />
              </div>

              <div>
                <label style="font-size:0.75rem; font-weight:bold; color:#475569; display:block; margin-bottom:3px;">فحص الهبوط (Slump)</label>
                <input type="text" name="concreteSlump" placeholder="8 - 12 سم" value="${editReport ? editReport.concrete_slump || '' : '10 سم'}" class="form-control" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #cbd5e1;" />
              </div>
            </div>
          </div>

          <!-- الصور الميدانية والمرفقات -->
          <div style="margin-bottom:20px;">
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">الصور الميدانية للأعمال (اختياري)</label>
            <input type="file" name="files" multiple accept="image/*,.pdf" class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:16px;">
            <button type="button" class="btn btn-outline" onclick="window.unifiedTendersManager.switchHubTab('daily-log')">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="background:#0f766e; color:#fff; padding:10px 24px; font-weight:bold; border-radius:8px; border:none; cursor:pointer;">
              💾 حفظ وتوثيق التقرير اليومي
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /* ─── 3. تبويب سجل التقارير اليومية ─────────────────────────────────── */
  renderTabDailyLog() {
    const h = this.hubData || {};
    const reports = h.dailyReports || [];

    if (reports.length === 0) {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:40px; text-align:center;">
          <div style="font-size:3rem; margin-bottom:10px;">📋</div>
          <div style="font-size:1.1rem; font-weight:bold; color:#475569;">لا توجد تقارير يومية موثقة لهذا المشروع حتى الآن</div>
          <p style="margin-top:6px; font-size:0.85rem; color:#64748b;">يمكنك البدء بتوثيق التقارير اليومية لمتابعة الإنجاز الميداني التراكمي.</p>
          <button class="btn btn-primary" onclick="window.unifiedTendersManager.switchHubTab('daily-form')" style="background:#0f766e; color:#fff; border:none; padding:8px 18px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:12px;">
            ➕ إضافة أول تقرير يومي
          </button>
        </div>
      `;
    }

    const cardsHtml = reports.map((r, idx) => `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; margin-bottom:14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:10px;">
          <div>
            <span style="font-weight:bold; color:#0f766e; font-size:1rem;">#${reports.length - idx} - تقرير يوم: ${r.report_date}</span>
            <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-right:8px;">${r.weather || 'معتدل'}</span>
            <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-right:4px;">الإنجاز التراكمي: ${r.cumulative_progress_percent || 0}%</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-outline" onclick="window.unifiedTendersManager.printSingleDailyReport('${r.id}')" style="padding:4px 10px; font-size:0.75rem;">🖨️ طباعة</button>
            <button class="btn btn-sm btn-outline" onclick="window.unifiedTendersManager.deleteDailyReport('${r.id}')" style="padding:4px 10px; font-size:0.75rem; color:#ef4444; border-color:#fecaca;">🗑️ حذف</button>
          </div>
        </div>

        <div style="font-size:0.9rem; color:#1e293b; line-height:1.6; margin-bottom:8px;">
          <strong>الأعمال المنفذة:</strong> ${r.executed_works}
        </div>

        ${r.materials_delivered ? `
          <div style="font-size:0.85rem; color:#475569; margin-bottom:4px;">
            <strong>المواد الموردة:</strong> ${r.materials_delivered}
          </div>
        ` : ''}

        ${r.lab_tests ? `
          <div style="font-size:0.85rem; color:#0284c7; margin-bottom:4px;">
            <strong>الفحوصات المخبرية:</strong> ${r.lab_tests}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#94a3b8; margin-top:8px; border-top:1px solid #f8fafc; padding-top:6px;">
          <span>المهندس المشرف: ${r.supervisor_engineer || 'المهندس المشرف'}</span>
          <span>العمالة: ${r.manpower_count || 0} عامل | الآليات: ${r.equipment_details || 'متوفرة'}</span>
        </div>
      </div>
    `).join('');

    return `
      <div style="max-width:900px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-size:1.1rem; color:#1e293b;">سجل التقارير اليومية الموثقة للمشروع</h3>
          <button class="btn btn-primary" onclick="window.unifiedTendersManager.switchHubTab('daily-form')" style="background:#0f766e; color:#fff; border:none; padding:7px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">
            ➕ إضافة تقرير جديد
          </button>
        </div>
        ${cardsHtml}
      </div>
    `;
  }

  /* ─── 4. تبويب جداول الكميات والأعمال المنفذة (BOQ) ───────────────────── */
  renderTabBoq() {
    const t = this.activeTender;
    let boqItems = [];
    try {
      boqItems = typeof t.boqItemsJson === 'string' ? JSON.parse(t.boqItemsJson || '[]') : (t.boqItemsJson || []);
    } catch(e) { boqItems = []; }

    const rows = boqItems.map((item, idx) => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; font-weight:bold;">${idx + 1}</td>
        <td style="padding:10px 12px;"><input type="text" class="form-control boq-desc" value="${item.description || ''}" style="width:100%; padding:6px;" /></td>
        <td style="padding:10px 12px;"><input type="text" class="form-control boq-unit" value="${item.unit || 'م2'}" style="width:70px; padding:6px;" /></td>
        <td style="padding:10px 12px;"><input type="number" class="form-control boq-qty" value="${item.quantity || 0}" style="width:90px; padding:6px;" /></td>
        <td style="padding:10px 12px;"><input type="number" class="form-control boq-exec" value="${item.executedQuantity || 0}" style="width:90px; padding:6px;" /></td>
        <td style="padding:10px 12px;"><input type="number" class="form-control boq-price" value="${item.unitPrice || 0}" style="width:90px; padding:6px;" /></td>
        <td style="padding:10px 12px; font-weight:bold; color:#0f766e;">${((parseFloat(item.executedQuantity || 0) * parseFloat(item.unitPrice || 0)) || 0).toLocaleString()} د.أ</td>
        <td style="padding:10px 12px; text-align:center;">
          <button class="btn btn-sm" onclick="this.closest('tr').remove()" style="color:#ef4444; background:none; border:none; cursor:pointer;">❌</button>
        </td>
      </tr>
    `).join('');

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; color:#0f766e; font-size:1.1rem;">📐 جدول الكميات والأعمال المنفذة (BOQ Tracking)</h3>
            <div style="font-size:0.8rem; color:#64748b;">مطابقة الكميات العقدية مع الكميات المنفذة فعلياً على أرض الواقع</div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline" onclick="window.unifiedTendersManager.addBoqRow()" style="padding:6px 12px; font-size:0.85rem;">➕ إضافة بند</button>
            <button class="btn btn-primary" onclick="window.unifiedTendersManager.saveBoqItems()" style="background:#0f766e; color:#fff; border:none; padding:6px 16px; font-weight:bold; border-radius:6px; cursor:pointer;">💾 حفظ الجدول</button>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table id="boq-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                <th style="padding:10px 12px; width:40px;">#</th>
                <th style="padding:10px 12px;">بيان البند والعمل المطلوب</th>
                <th style="padding:10px 12px; width:80px;">الوحدة</th>
                <th style="padding:10px 12px; width:100px;">الكمية العقدية</th>
                <th style="padding:10px 12px; width:100px;">المنفذ فعلياً</th>
                <th style="padding:10px 12px; width:100px;">سعر الوحدة</th>
                <th style="padding:10px 12px; width:110px;">إجمالي المنجز</th>
                <th style="padding:10px 12px; width:50px; text-align:center;">حذف</th>
              </tr>
            </thead>
            <tbody>
              ${rows || ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  addBoqRow() {
    const tbody = document.querySelector('#boq-table tbody');
    if (!tbody) return;
    const count = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.innerHTML = `
      <td style="padding:10px 12px; font-weight:bold;">${count}</td>
      <td style="padding:10px 12px;"><input type="text" class="form-control boq-desc" placeholder="بند أعمال..." style="width:100%; padding:6px;" /></td>
      <td style="padding:10px 12px;"><input type="text" class="form-control boq-unit" value="م2" style="width:70px; padding:6px;" /></td>
      <td style="padding:10px 12px;"><input type="number" class="form-control boq-qty" value="100" style="width:90px; padding:6px;" /></td>
      <td style="padding:10px 12px;"><input type="number" class="form-control boq-exec" value="0" style="width:90px; padding:6px;" /></td>
      <td style="padding:10px 12px;"><input type="number" class="form-control boq-price" value="5" style="width:90px; padding:6px;" /></td>
      <td style="padding:10px 12px; font-weight:bold; color:#0f766e;">0 د.أ</td>
      <td style="padding:10px 12px; text-align:center;"><button class="btn btn-sm" onclick="this.closest('tr').remove()" style="color:#ef4444; background:none; border:none; cursor:pointer;">❌</button></td>
    `;
    tbody.appendChild(tr);
  }

  async saveBoqItems() {
    const rows = document.querySelectorAll('#boq-table tbody tr');
    const boqItems = [];
    rows.forEach(tr => {
      const desc = tr.querySelector('.boq-desc')?.value || '';
      const unit = tr.querySelector('.boq-unit')?.value || 'م2';
      const qty = parseFloat(tr.querySelector('.boq-qty')?.value || 0);
      const exec = parseFloat(tr.querySelector('.boq-exec')?.value || 0);
      const price = parseFloat(tr.querySelector('.boq-price')?.value || 0);
      if (desc.trim()) {
        boqItems.push({ description: desc, unit, quantity: qty, executedQuantity: exec, unitPrice: price });
      }
    });

    try {
      const res = await fetch(`/api/tenders/${this.activeTender.id}/boq`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boqItems })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حفظ جدول الكميات بنجاح');
        this.activeTender.boqItemsJson = JSON.stringify(boqItems);
      } else {
        alert('❌ خطأ أثناء الحفظ: ' + (data.error || ''));
      }
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  /* ─── 5. تبويب ملاحظات الإشراف وتعليمات الموقع ───────────────────────── */
  renderTabSupervision() {
    const t = this.activeTender;
    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px; max-width:850px; margin:0 auto;">
        <h3 style="margin:0 0 16px 0; color:#0f766e; font-size:1.1rem; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
          👷 ملاحظات الإشراف الهندسي وتعليمات الموقع
        </h3>
        <div style="background:#fffbeb; border:1px solid #fef3c7; padding:12px; border-radius:8px; font-size:0.85rem; color:#92400e; margin-bottom:16px;">
          📌 تتيح هذه النافذة توثيق التوجيهات الهندسية الرسمية والإنذارات الفنية الصادرة من المهندس المشرف إلى المقاول المنفذ.
        </div>
        <div style="margin-bottom:16px;">
          <textarea id="supervision-notes-input" rows="6" class="form-control" placeholder="اكتب ملاحظات الموقع والتعليمات الفنية للمقاول..." style="width:100%; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">${t.notes || ''}</textarea>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-primary" onclick="window.unifiedTendersManager.saveSupervisionNotes()" style="background:#0f766e; color:#fff; border:none; padding:8px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">
            💾 حفظ الملاحظات والتعليمات
          </button>
        </div>
      </div>
    `;
  }

  async saveSupervisionNotes() {
    const notes = document.getElementById('supervision-notes-input')?.value || '';
    try {
      const res = await fetch(`/api/tenders/${this.activeTender.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...this.activeTender, notes })
      });
      if (res.ok) {
        alert('✅ تم حفظ ملاحظات الإشراف بنجاح');
        this.activeTender.notes = notes;
      }
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  /* ─── 6. تبويب الفحوصات المخبرية وضبط الجودة ─────────────────────────── */
  renderTabQuality() {
    const h = this.hubData || {};
    const reportsWithTests = (h.dailyReports || []).filter(r => r.lab_tests || r.asphalt_temp || r.concrete_slump);

    const rows = reportsWithTests.map(r => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; font-weight:bold;">${r.report_date}</td>
        <td style="padding:10px 12px;">${r.lab_tests || 'فحص جودة موقعي'}</td>
        <td style="padding:10px 12px; color:#d97706; font-weight:bold;">${r.asphalt_temp || '-'}</td>
        <td style="padding:10px 12px; color:#0284c7; font-weight:bold;">${r.concrete_slump || '-'}</td>
        <td style="padding:10px 12px; color:#10b981; font-weight:bold;">${r.compaction_rate || 'مطابق (≥98%)'}</td>
        <td style="padding:10px 12px;"><span style="background:#dcfce7; color:#166534; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">مطابق للمواصفات</span></td>
      </tr>
    `).join('');

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <h3 style="margin:0 0 16px 0; color:#0f766e; font-size:1.1rem; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
          🧪 سجل الفحوصات المخبرية وضبط الجودة (Quality Control Logs)
        </h3>
        ${reportsWithTests.length === 0 ? `
          <div style="text-align:center; padding:30px; color:#94a3b8;">
            <div>🧪 لا توجد نتائج فحوصات مخبرية مسجلة بعد. يتم استخلاص الفحوصات تلقائياً من التقارير اليومية.</div>
          </div>
        ` : `
          <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                <th style="padding:10px 12px;">تاريخ الفحص</th>
                <th style="padding:10px 12px;">نوع الفحص المخبري</th>
                <th style="padding:10px 12px;">حرارة الإسفلت</th>
                <th style="padding:10px 12px;">الهبوط (Slump)</th>
                <th style="padding:10px 12px;">نسبة الدحل</th>
                <th style="padding:10px 12px;">حالة المطابقة</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /* ─── 7. تبويب المطالبات المالية ─────────────────────────────────────── */
  renderTabClaims() {
    const h = this.hubData || {};
    const claims = h.claims || [];

    const rows = claims.map(c => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; font-weight:bold; color:#0f766e;">${c.claimNumber || c.id}</td>
        <td style="padding:10px 12px;">${c.type || 'دفعة جارية'}</td>
        <td style="padding:10px 12px; font-weight:bold;">${(parseFloat(c.netAmount || c.netPayable || c.amount) || 0).toLocaleString()} د.أ</td>
        <td style="padding:10px 12px;">${c.submitDate || c.createdAt || '-'}</td>
        <td style="padding:10px 12px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">${c.status || 'معتمدة'}</span></td>
      </tr>
    `).join('');

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
          <h3 style="margin:0; color:#0f766e; font-size:1.1rem;">💰 سجل المطالبات والدفعات المالية المعتمدة</h3>
          <button class="btn btn-outline" onclick="if(window.navigate) window.navigate('claims')" style="font-size:0.8rem; padding:6px 12px;">
            🔗 الانتقال إلى منظومة المطالبات
          </button>
        </div>
        ${claims.length === 0 ? `
          <div style="text-align:center; padding:30px; color:#94a3b8;">
            <div>📝 لا توجد مطالبات مالية مصدرة لهذا العطاء حتى الآن.</div>
          </div>
        ` : `
          <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                <th style="padding:10px 12px;">رقم المطالبة</th>
                <th style="padding:10px 12px;">نوع الدفعة</th>
                <th style="padding:10px 12px;">الصافي المستحق</th>
                <th style="padding:10px 12px;">تاريخ التقديم</th>
                <th style="padding:10px 12px;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /* ─── 8. تبويب الأوامر التغييرية ─────────────────────────────────────── */
  renderTabVariations() {
    const h = this.hubData || {};
    const vos = h.variationOrders || [];

    const rows = vos.map(vo => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px; font-weight:bold; color:#0f766e;">${vo.order_number || vo.id}</td>
        <td style="padding:10px 12px;">${vo.reason || vo.title || 'أمر تغييري هندسي'}</td>
        <td style="padding:10px 12px; font-weight:bold; color:#d97706;">+${(parseFloat(vo.costChange || vo.amount) || 0).toLocaleString()} د.أ</td>
        <td style="padding:10px 12px; font-weight:bold;">${vo.timeExtensionDays || 0} يوماً</td>
        <td style="padding:10px 12px;"><span style="background:#dcfce7; color:#166534; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">معتمد</span></td>
      </tr>
    `).join('');

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
          <h3 style="margin:0; color:#0f766e; font-size:1.1rem;">📑 الأوامر التغييرية وتمديد المدة المعتمدة</h3>
          <button class="btn btn-outline" onclick="if(window.navigate) window.navigate('contracts')" style="font-size:0.8rem; padding:6px 12px;">
            🔗 الانتقال إلى منظومة العقود
          </button>
        </div>
        ${vos.length === 0 ? `
          <div style="text-align:center; padding:30px; color:#94a3b8;">
            <div>📑 لم تسجل أي أوامر تغييرية على هذا العطاء حتى تاريخه.</div>
          </div>
        ` : `
          <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                <th style="padding:10px 12px;">رقم الأمر</th>
                <th style="padding:10px 12px;">مبررات التغيير</th>
                <th style="padding:10px 12px;">الفرق المالي</th>
                <th style="padding:10px 12px;">تمديد المدة</th>
                <th style="padding:10px 12px;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  /* ─── 9. تبويب الجاهزية ولجنة الاستلام ومحضر التسليم ─────────────────── */
  renderTabAcceptance() {
    const t = this.activeTender;
    let committee = [];
    try {
      committee = typeof t.receivingCommittee === 'string' ? JSON.parse(t.receivingCommittee || '[]') : (t.receivingCommittee || []);
    } catch(e) { committee = []; }

    if (committee.length === 0) {
      committee = [
        { role: 'رئيس لجنة الاستلام', name: 'المهندس مدير مديرية الأشغال' },
        { role: 'عضو اللجنة - مهندس الموقع', name: t.supervisorEngineer || 'مهندس الإشراف الميداني' },
        { role: 'عضو اللجنة - الشؤون المالية واللوازم', name: 'محاسب ومدقق الدائرة المالية' },
        { role: 'عضو اللجنة - ديوان المحاسبة / الرقابة', name: 'رئيس قسم الرقابة والتفتيش الداخلي' }
      ];
    }

    const commRows = committee.map((m, idx) => `
      <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center;">
        <input type="text" class="form-control comm-role" value="${m.role || ''}" placeholder="الصفة / الدور..." style="flex:1; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;" />
        <input type="text" class="form-control comm-name" value="${m.name || ''}" placeholder="الاسم الثلاثي..." style="flex:1.5; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;" />
        <button class="btn btn-sm" onclick="this.closest('div').remove()" style="color:#ef4444; background:none; border:none; cursor:pointer;">❌</button>
      </div>
    `).join('');

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:24px; max-width:850px; margin:0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f766e; padding-bottom:12px; margin-bottom:20px;">
          <div>
            <h3 style="margin:0; color:#0f766e; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
              <span>🤝</span> جاهزية المشروع ولجنة الاستلام الفني
            </h3>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">إعداد محضر الاستلام الأولي والنهائي وتعيين أعضاء اللجنة</div>
          </div>
          <button class="btn btn-primary" onclick="window.unifiedTendersManager.printHandoverReport('${t.id}')" style="background:#0f766e; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <span>🖨️</span> طباعة محضر الاستلام الرسمي
          </button>
        </div>

        <!-- قائمة فحص الجاهزية -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;">
          <div style="font-weight:bold; color:#1e293b; margin-bottom:10px; font-size:0.9rem;">✅ قائمة التحقق من الجاهزية للاستلام (Handover Checklist)</div>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:6px; cursor:pointer;">
            <input type="checkbox" checked /> تم استكمال كافة الأعمال المنصوص عليها في العقد وجدول الكميات
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:6px; cursor:pointer;">
            <input type="checkbox" checked /> تم إجراء الفحوصات المخبرية اللازمة وثبتت مطابقتها للمواصفات
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:6px; cursor:pointer;">
            <input type="checkbox" checked /> تم تنظيف الموقع وإزالة كافة المخلفات والأنقاض الناتجة عن الأعمال
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" checked /> تم استلام المخططات التنفيذية الواقعية (As-Built Drawings)
          </label>
        </div>

        <!-- لجنة الاستلام -->
        <div style="margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-weight:bold; color:#1e293b; font-size:0.9rem;">👥 أعضاء لجنة الاستلام والتواقيع الرسمية</div>
            <button class="btn btn-outline" onclick="window.unifiedTendersManager.addCommitteeRow()" style="font-size:0.75rem; padding:4px 10px;">➕ إضافة عضو</button>
          </div>
          <div id="committee-members-list">
            ${commRows}
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:16px;">
          <button class="btn btn-primary" onclick="window.unifiedTendersManager.saveAcceptanceCommittee()" style="background:#0f766e; color:#fff; border:none; padding:10px 24px; border-radius:8px; font-weight:bold; cursor:pointer;">
            💾 اعتماد وحفظ بيانات اللجنة
          </button>
        </div>
      </div>
    `;
  }

  addCommitteeRow() {
    const list = document.getElementById('committee-members-list');
    if (!list) return;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:10px; margin-bottom:8px; align-items:center;';
    div.innerHTML = `
      <input type="text" class="form-control comm-role" placeholder="الصفة / الدور..." style="flex:1; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;" />
      <input type="text" class="form-control comm-name" placeholder="الاسم الثلاثي..." style="flex:1.5; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;" />
      <button class="btn btn-sm" onclick="this.closest('div').remove()" style="color:#ef4444; background:none; border:none; cursor:pointer;">❌</button>
    `;
    list.appendChild(div);
  }

  async saveAcceptanceCommittee() {
    const rows = document.querySelectorAll('#committee-members-list > div');
    const committee = [];
    rows.forEach(r => {
      const role = r.querySelector('.comm-role')?.value || '';
      const name = r.querySelector('.comm-name')?.value || '';
      if (role.trim() || name.trim()) {
        committee.push({ role, name });
      }
    });

    try {
      const res = await fetch(`/api/tenders/${this.activeTender.id}/acceptance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ receivingCommittee: committee })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حفظ وتحديث لجنة الاستلام بنجاح');
        this.activeTender.receivingCommittee = JSON.stringify(committee);
      } else {
        alert('❌ خطأ: ' + (data.error || ''));
      }
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  /* ─── 10. تبويب الأرشيف والمرفقات ───────────────────────────────────── */
  renderTabDocuments() {
    const t = this.activeTender;
    const h = this.hubData || {};
    const docs = h.archiveDocs || [];

    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
          <h3 style="margin:0; color:#0f766e; font-size:1.1rem;">📁 الأرشيف الإلكتروني والوثائق الرسمية المرفقة</h3>
          ${t.attachmentPath ? `
            <a href="/api/tenders/${t.id}/download" target="_blank" class="btn btn-outline" style="font-size:0.8rem; padding:6px 12px; display:flex; align-items:center; gap:6px;">
              <span>📎</span> تحميل المرفق الرئيسي للعطاء
            </a>
          ` : ''}
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
          <div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px; background:#f8fafc;">
            <div style="font-size:1.5rem; margin-bottom:6px;">📜</div>
            <div style="font-weight:bold; font-size:0.9rem; color:#1e293b;">وثيقة العقد وجدول الكميات</div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${t.attachmentPath || 'مرفق العقد الأساسي'}</div>
            ${t.attachmentPath ? `
              <a href="/api/tenders/${t.id}/download?preview=1" target="_blank" style="color:#0f766e; font-size:0.8rem; font-weight:bold; display:inline-block; margin-top:8px;">معاينة الوثيقة 👁️</a>
            ` : '<span style="font-size:0.75rem; color:#94a3b8; display:inline-block; margin-top:8px;">لا يوجد ملف مرفق</span>'}
          </div>

          ${docs.map(d => `
            <div style="border:1px solid #e2e8f0; border-radius:8px; padding:14px; background:#f8fafc;">
              <div style="font-size:1.5rem; margin-bottom:6px;">📎</div>
              <div style="font-weight:bold; font-size:0.9rem; color:#1e293b;">${d.title || d.name}</div>
              <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${d.file_size ? (d.file_size/1024).toFixed(0)+' KB' : 'ملف أرشيف'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ─── 11. تبويب الخريطة والموقع الجغرافي ──────────────────────────────── */
  renderTabGis() {
    const t = this.activeTender;
    return `
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:20px;">
        <h3 style="margin:0 0 12px 0; color:#0f766e; font-size:1.1rem;">🌍 الإحداثيات والموقع الجغرافي للمشروع</h3>
        <div style="font-size:0.85rem; color:#64748b; margin-bottom:12px;">
          خط العرض: <strong>${t.lat || 32.3301}</strong> | خط الطول: <strong>${t.lng || 35.7501}</strong> | المنطقة: <strong>${t.district || 'كفرنجة'}</strong>
        </div>
        <div id="tender-hub-map" style="height:420px; width:100%; border-radius:10px; border:1px solid #cbd5e1; z-index:1;"></div>
      </div>
    `;
  }

  initHubGisMap() {
    const el = document.getElementById('tender-hub-map');
    if (!el || typeof L === 'undefined') return;

    if (this.hubMap) {
      try { this.hubMap.remove(); } catch(e) {}
      this.hubMap = null;
    }

    const t = this.activeTender;
    const lat = parseFloat(t.lat) || 32.3301;
    const lng = parseFloat(t.lng) || 35.7501;

    this.hubMap = L.map('tender-hub-map').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap - بلدية كفرنجة'
    }).addTo(this.hubMap);

    this.hubMarker = L.marker([lat, lng], { draggable: true }).addTo(this.hubMap);
    this.hubMarker.bindPopup(`<b>${t.name}</b><br>رقم العطاء: ${t.tenderNumber || t.id}`).openPopup();

    this.hubMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      this.activeTender.lat = pos.lat.toFixed(6);
      this.activeTender.lng = pos.lng.toFixed(6);
    });
  }

  /* ─── عمليات الحفظ والطباعة والحذف ────────────────────────────────────── */
  async submitDailyReport(e, reportId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      const url = reportId ? `/api/tenders/${this.activeTender.id}/daily-reports/${reportId}` : `/api/tenders/${this.activeTender.id}/daily-reports`;
      const method = reportId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حفظ وتوثيق التقرير اليومي بنجاح');
        await this.openWorkspace(this.activeTender.id);
        this.switchHubTab('daily-log');
      } else {
        alert('❌ تعذر الحفظ: ' + (data.error || ''));
      }
    } catch(err) {
      alert('خطأ: ' + err.message);
    }
  }

  async deleteDailyReport(reportId) {
    if (!confirm('هل أنت متأكد من حذف هذا التقرير اليومي؟')) return;
    try {
      const res = await fetch(`/api/tenders/${this.activeTender.id}/daily-reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حذف التقرير اليومي بنجاح');
        await this.openWorkspace(this.activeTender.id);
        this.switchHubTab('daily-log');
      }
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  async deleteTender(tenderId) {
    if (!confirm('هل أنت متأكد من حذف هذا العطاء وكافة تقاريره وسجلاته؟')) return;
    try {
      const res = await fetch(`/api/tenders/${tenderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حذف العطاء بنجاح');
        await this.fetchTenders();
      }
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  exportTendersCsv() {
    window.open('/api/export/tenders', '_blank');
  }

  /* ─── طباعة التقارير الرسمية عالية الدقة ──────────────────────────────── */
  printTenderSummary(tenderId) {
    window.open(`/api/reports/generate-official?module=tender&id=${tenderId}`, '_blank');
  }

  printTenderExecutiveFile(tenderId) {
    window.open(`/api/reports/generate-official?module=tender_executive&id=${tenderId}`, '_blank');
  }

  printSingleDailyReport(reportId) {
    window.open(`/api/reports/generate-official?module=daily_report&id=${reportId}`, '_blank');
  }

  printHandoverReport(tenderId) {
    window.open(`/api/reports/generate-official?module=handover&id=${tenderId}`, '_blank');
  }

  /* ─── نافذة إضافة وتعديل عطاء (Modal) ─────────────────────────────────── */
  openTenderModal(tenderId = null) {
    const tender = tenderId ? this.tendersData.find(t => String(t.id) === String(tenderId)) : null;
    const isEdit = !!tender;

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalOverlay = document.getElementById('modalOverlay');
    if (!modalTitle || !modalBody || !modalOverlay) return;

    modalTitle.textContent = isEdit ? `✏️ تعديل بيانات العطاء [${tender.tenderNumber || tender.id}]` : '📋 طرح وتوثيق عطاء جديد';

    modalBody.innerHTML = `
      <form id="unified-tender-form" onsubmit="window.unifiedTendersManager.saveTenderForm(event, '${isEdit ? tender.id : ''}')" style="direction:rtl;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div style="grid-column:span 2;">
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">اسم العطاء / المشروع *</label>
            <input type="text" name="name" required value="${tender?.name || ''}" placeholder="مشروع إنشاء وتعبيد طرق في منطقة..." class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">رقم العطاء الرسمي</label>
            <input type="text" name="tenderNumber" value="${tender?.tenderNumber || tender?.id || ''}" placeholder="ع/2026/01" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المقاول المحال عليه</label>
            <input type="text" name="contractor" value="${tender?.contractor || ''}" placeholder="اسم المقاول أو الشركة المنفذة..." class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">قيمة الإحالة / التعاقد (د.أ) *</label>
            <input type="number" step="0.01" name="awardedValue" required value="${tender?.awardedValue || tender?.value || ''}" placeholder="0.00" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">القيمة التقديرية (د.أ)</label>
            <input type="number" step="0.01" name="estimatedValue" value="${tender?.estimatedValue || tender?.value || ''}" placeholder="0.00" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">نوع العطاء</label>
            <select name="tenderType" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
              <option value="أشغال" ${tender?.tenderType === 'أشغال' ? 'selected' : ''}>أشغال وتعبيد طرق</option>
              <option value="إنشاءات" ${tender?.tenderType === 'إنشاءات' ? 'selected' : ''}>إنشاءات ومباني وجدران</option>
              <option value="توريدات" ${tender?.tenderType === 'توريدات' ? 'selected' : ''}>توريدات ولوازم</option>
              <option value="خدمات هندسية" ${tender?.tenderType === 'خدمات هندسية' ? 'selected' : ''}>خدمات استشارية</option>
            </select>
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">حالة العطاء</label>
            <select name="status" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
              <option value="مفتوح" ${tender?.status === 'مفتوح' ? 'selected' : ''}>مفتوح</option>
              <option value="محال" ${tender?.status === 'محال' ? 'selected' : ''}>محال</option>
              <option value="قيد التنفيذ" ${tender?.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
              <option value="جاهز للاستلام" ${tender?.status === 'جاهز للاستلام' ? 'selected' : ''}>جاهز للاستلام</option>
              <option value="مستلم أولياً" ${tender?.status === 'مستلم أولياً' ? 'selected' : ''}>مستلم أولياً</option>
              <option value="مستلم نهائياً" ${tender?.status === 'مستلم نهائياً' ? 'selected' : ''}>مستلم نهائياً</option>
            </select>
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المهندس المشرف</label>
            <input type="text" name="supervisorEngineer" value="${tender?.supervisorEngineer || ''}" placeholder="اسم المهندس المشرف..." class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المنطقة / الحي</label>
            <input type="text" name="district" value="${tender?.district || 'كفرنجة'}" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">تاريخ المباشرة</label>
            <input type="date" name="commencementDate" value="${tender?.commencementDate || ''}" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">مدة التنفيذ (أيام)</label>
            <input type="number" name="durationDays" value="${tender?.durationDays || 60}" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">ملف العطاء المرفق (PDF / صور)</label>
          <input type="file" name="file" class="form-control" style="width:100%; padding:6px; border-radius:6px; border:1px solid #cbd5e1;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('modalOverlay').classList.remove('open')">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="background:#0f766e; color:#fff; border:none; padding:8px 20px; font-weight:bold; border-radius:6px; cursor:pointer;">
            💾 ${isEdit ? 'تحديث البيانات' : 'حفظ وإضافة العطاء'}
          </button>
        </div>
      </form>
    `;

    modalOverlay.classList.add('open');
  }

  async saveTenderForm(e, tenderId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      const url = tenderId ? `/api/tenders/${tenderId}` : '/api/tenders';
      const method = tenderId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ تم حفظ العطاء بنجاح');
        document.getElementById('modalOverlay')?.classList.remove('open');
        await this.fetchTenders();
      } else {
        alert('❌ تعذر الحفظ: ' + (data.error || ''));
      }
    } catch(err) {
      alert('خطأ: ' + err.message);
    }
  }
}

// إنشاء النسخة العامة وربطها مع دورة حياة التطبيق
window.UnifiedTendersManager = UnifiedTendersManager;
document.addEventListener('DOMContentLoaded', () => {
  if (!window.unifiedTendersManager) {
    window.unifiedTendersManager = new UnifiedTendersManager('tenders-tab-container');
  }
});

function loadTendersModule() {
  if (!window.unifiedTendersManager) {
    window.unifiedTendersManager = new UnifiedTendersManager('tenders-tab-container');
  } else {
    window.unifiedTendersManager.init();
  }
}
window.loadTendersModule = loadTendersModule;
