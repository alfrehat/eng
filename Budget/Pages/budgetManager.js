/**
 * Budget/Pages/budgetManager.js
 * 🏛️ إدارة الموازنة العامة لمديرية الأشغال والخدمات الهندسية (Directorate Budget Manager)
 * بلدية كفرنجة الجديدة — الإصدار المؤسسي الموحد
 * v2.0 - Anti-Gravity Enterprise Budget Frontend Manager Patch
 */

'use strict';

class BudgetManager {
  constructor(containerId = 'budget-container') {
    this.containerId = containerId;
    this.summaryData = null;
    this.budgetLines = [];
    this.selectedYear = new Date().getFullYear().toString();
    this.filterFundingSource = '';
    this.filterDepartment = '';
    this.searchQuery = '';
    this.init();
  }

  getCurrentUser() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.role) return currentUser;
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('engineeringUser');
      if (userStr) return JSON.parse(userStr);
    } catch(e) {}
    return { role: 'user', fullName: 'مستخدم النظام', permissions: [] };
  }

  can(action) {
    const user = this.getCurrentUser();
    const role = (user.role || '').toLowerCase();
    if (role === 'admin' || role === 'director_public_works' || user.id === 'U-001') return true;
    const perms = Array.isArray(user.permissions) ? user.permissions : (typeof user.permissions === 'string' ? user.permissions.split(',') : []);
    if (perms.includes('*') || perms.includes(`budget:${action}`) || perms.includes(`BUDGET.${action.toUpperCase()}`)) return true;
    if (action === 'view' || action === 'print' || action === 'export') return true;
    if (['head_of_roads', 'head_of_buildings', 'quantity_surveyor'].includes(role) && ['create', 'edit', 'allocate'].includes(action)) return true;
    return false;
  }

  async init() {
    await this.fetchData();
    this.render();
  }

  async fetchData() {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      };

      const [summaryRes, linesRes] = await Promise.all([
        fetch(`/api/budget/summary?year=${this.selectedYear}`, { headers }),
        fetch(`/api/budget/lines?year=${this.selectedYear}&funding_source=${encodeURIComponent(this.filterFundingSource)}&department=${encodeURIComponent(this.filterDepartment)}`, { headers })
      ]);

      if (summaryRes.ok) {
        const json = await summaryRes.json();
        if (json.success) this.summaryData = json.data;
      }
      if (linesRes.ok) {
        const json = await linesRes.json();
        if (json.success) this.budgetLines = json.data;
      }
    } catch (e) {
      console.warn('Failed to load budget data:', e.message);
    }
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const s = this.summaryData || {
      totalAllocated: 0,
      totalCommitted: 0,
      totalSpent: 0,
      uncommittedBalance: 0,
      unspentBalance: 0,
      commitmentRate: 0,
      executionRate: 0,
      totalLines: 0
    };

    const filteredLines = (this.budgetLines || []).filter(l => {
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const str = `${l.chapter_name || ''} ${l.line_name || ''} ${l.id || ''} ${l.funding_source || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    container.innerHTML = `
      <div class="budget-dashboard-wrapper" style="direction:rtl; font-family:'Tajawal', 'Segoe UI', sans-serif;">
        <!-- 1. ترويسة الصفحة والعمليات الرئيسية -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="margin:0; font-size:1.35rem; color:var(--text-primary, #1e293b); display:flex; align-items:center; gap:8px;">
              <span>💵</span> الموازنة العامة لمديرية الأشغال والخدمات الهندسية
            </h2>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary, #64748b);">
              رصد المخصصات المعتمدة، الالتزامات التعاقدية، المصروف الفعلي، والتحليلات المالية
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${this.can('create') ? `
              <button class="btn btn-primary" onclick="window.budgetManager.openLineModal()" style="background:#0f766e; color:#fff; padding:9px 18px; border-radius:8px; border:none; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:6px;">
                <span>➕</span> إضافة بند موازنة جديد
              </button>
            ` : ''}
            <button class="btn btn-outline" onclick="window.budgetManager.exportCsv()" style="padding:9px 14px; border-radius:8px; border:1px solid #cbd5e1; background:var(--bg-surface, #fff); cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>📥</span> تصدير الموازنة (CSV)
            </button>
            <button class="btn btn-outline" onclick="window.print()" style="padding:9px 14px; border-radius:8px; border:1px solid #cbd5e1; background:var(--bg-surface, #fff); cursor:pointer; display:flex; align-items:center; gap:6px;">
              <span>🖨️</span> طباعة الكشف الرسمي
            </button>
          </div>
        </div>

        <!-- 2. بطاقات المؤشرات المالية القيادية -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 22px;">
          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; border-right:4px solid #0f766e;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">الموازنة المعتمدة (${this.selectedYear})</div>
            <div style="font-size:1.5rem; font-weight:800; color:#0f766e; margin-top:2px;">${Math.round(s.totalAllocated).toLocaleString()} <span style="font-size:0.8rem;">د.أ</span></div>
            <div style="font-size:0.75rem; color:#0f766e; margin-top:4px;">إجمالي المخصصات (${s.totalLines} بند)</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; border-right:4px solid #d97706;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">الالتزامات المحجوزة</div>
            <div style="font-size:1.5rem; font-weight:800; color:#d97706; margin-top:2px;">${Math.round(s.totalCommitted).toLocaleString()} <span style="font-size:0.8rem;">د.أ</span></div>
            <div style="font-size:0.75rem; color:#d97706; margin-top:4px;">نسبة الالتزام: ${s.commitmentRate}%</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; border-right:4px solid #0284c7;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">المصروف الفعلي (المطالبات)</div>
            <div style="font-size:1.5rem; font-weight:800; color:#0284c7; margin-top:2px;">${Math.round(s.totalSpent).toLocaleString()} <span style="font-size:0.8rem;">د.أ</span></div>
            <div style="font-size:0.75rem; color:#0284c7; margin-top:4px;">نسبة الإنفاق: ${s.executionRate}%</div>
          </div>

          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; border-right:4px solid #10b981;">
            <div style="font-size:0.75rem; color:#64748b; font-weight:600;">الرصيد المتاح للارتباط</div>
            <div style="font-size:1.5rem; font-weight:800; color:#10b981; margin-top:2px;">${Math.round(s.uncommittedBalance).toLocaleString()} <span style="font-size:0.8rem;">د.أ</span></div>
            <div style="font-size:0.75rem; color:#10b981; margin-top:4px;">مخصصات شاغرة للمشاريع</div>
          </div>
        </div>

        <!-- 3. شريط التصفية والبحث بالسنة والمصدر -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; padding:16px; margin-bottom: 20px;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items:flex-end;">
            <div style="grid-column:span 2;">
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">البحث السريع (اسم البند، الفصل، الرقم)</label>
              <input type="text" value="${this.searchQuery}" placeholder="ابحث في بنود الموازنة..." class="form-control" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;" oninput="window.budgetManager.onSearch(this.value)" />
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">السنة المالية</label>
              <select class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.budgetManager.onYearChange(this.value)">
                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">مصدر التمويل</label>
              <select class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.budgetManager.onFundingChange(this.value)">
                <option value="">جميع المصادر</option>
                <option value="موازنة البلدية الذاتية" ${this.filterFundingSource === 'موازنة البلدية الذاتية' ? 'selected' : ''}>موازنة البلدية الذاتية</option>
                <option value="منحة وزارة الإدارة المحلية" ${this.filterFundingSource === 'منحة وزارة الإدارة المحلية' ? 'selected' : ''}>منحة وزارة الإدارة المحلية</option>
                <option value="قرض بنك تنمية المدن والقرى" ${this.filterFundingSource === 'قرض بنك تنمية المدن والقرى' ? 'selected' : ''}>قرض بنك تنمية المدن والقرى</option>
                <option value="مخصصات مجلس المحافظة (اللامركزية)" ${this.filterFundingSource === 'مخصصات مجلس المحافظة (اللامركزية)' ? 'selected' : ''}>مخصصات اللامركزية</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.8rem; font-weight:600; color:#475569; margin-bottom:4px; display:block;">القسم المسؤول</label>
              <select class="form-control" style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="window.budgetManager.onDeptChange(this.value)">
                <option value="">جميع الأقسام</option>
                <option value="قسم المشاريع والعطاءات">قسم المشاريع والعطاءات</option>
                <option value="قسم صيانة الطرق والآليات">قسم صيانة الطرق والآليات</option>
                <option value="قسم الأبنية والإنشاءات">قسم الأبنية والإنشاءات</option>
                <option value="قسم الطاقة والإنارة">قسم الطاقة والإنارة</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 4. جدول بنود وفصول الموازنة مع أشرطة الالتزام والصرف -->
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #e2e8f0); border-radius:12px; overflow:hidden;">
          ${this.renderBudgetTable(filteredLines)}
        </div>
      </div>
    `;
  }

  renderBudgetTable(lines) {
    if (!lines || lines.length === 0) {
      return `
        <div style="padding:40px; text-align:center; color:#94a3b8;">
          <div style="font-size:3rem; margin-bottom:10px;">💵</div>
          <div style="font-size:1.1rem; font-weight:bold; color:#475569;">لا توجد بنود موازنة مسجلة لهذه السنة / التصفية</div>
          <p style="margin-top:6px; font-size:0.85rem;">يمكنك إضافة بنود موازنة المديرية بالضغط على زر "إضافة بند موازنة جديد".</p>
        </div>
      `;
    }

    const rows = lines.map(l => {
      const allocated = parseFloat(l.allocated_amount) || 0;
      const committed = parseFloat(l.committed_amount) || 0;
      const spent = parseFloat(l.spent_amount) || 0;
      const available = parseFloat(l.available_commitment) || 0;
      const commitPct = l.commitment_percentage || 0;
      const spentPct = l.spent_percentage || 0;

      return `
        <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <td style="padding:12px 14px; font-weight:bold; color:#0f766e; white-space:nowrap;">
            ${l.chapter_code ? `[${l.chapter_code}] ` : ''}${l.line_code || l.id}
          </td>
          <td style="padding:12px 14px;">
            <div style="font-weight:700; color:#1e293b; font-size:0.95rem;">${l.line_name}</div>
            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
              <span>📁 ${l.chapter_name || 'فصل رأسمالي'}</span> | <span>🏛️ ${l.funding_source || 'موازنة البلدية'}</span>
            </div>
          </td>
          <td style="padding:12px 14px; font-weight:700; color:#0f766e; white-space:nowrap;">
            ${allocated.toLocaleString()} د.أ
          </td>
          <td style="padding:12px 14px; min-width:140px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:600; margin-bottom:3px;">
              <span>${committed.toLocaleString()} د.أ</span>
              <span>${commitPct}%</span>
            </div>
            <div style="background:#e2e8f0; height:6px; border-radius:10px; overflow:hidden;">
              <div style="background:#d97706; width:${commitPct}%; height:100%;"></div>
            </div>
          </td>
          <td style="padding:12px 14px; min-width:140px;">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:600; margin-bottom:3px;">
              <span>${spent.toLocaleString()} د.أ</span>
              <span>${spentPct}%</span>
            </div>
            <div style="background:#e2e8f0; height:6px; border-radius:10px; overflow:hidden;">
              <div style="background:#0284c7; width:${spentPct}%; height:100%;"></div>
            </div>
          </td>
          <td style="padding:12px 14px; font-weight:700; color:${available > 0 ? '#10b981' : '#ef4444'}; white-space:nowrap;">
            ${available.toLocaleString()} د.أ
          </td>
          <td style="padding:12px 14px; text-align:left; white-space:nowrap;">
            <button class="btn btn-sm" onclick="window.budgetManager.openLineDetails('${l.id}')" style="background:#0f766e; color:#fff; border:none; padding:5px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer;" title="عرض الارتباطات">
              🔍 الارتباطات
            </button>
            ${this.can('edit') ? `
              <button class="btn btn-sm" onclick="window.budgetManager.openLineModal('${l.id}')" style="background:#fff; border:1px solid #cbd5e1; padding:5px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer; margin-right:4px;" title="تعديل">
                ✏️
              </button>
            ` : ''}
            ${this.can('delete') ? `
              <button class="btn btn-sm" onclick="window.budgetManager.deleteLine('${l.id}')" style="background:#fff; border:1px solid #fecaca; color:#ef4444; padding:5px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer; margin-right:4px;" title="حذف">
                🗑️
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.88rem;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569; font-weight:700;">
              <th style="padding:12px 14px;">رمز البند</th>
              <th style="padding:12px 14px;">بيان وفصل الموازنة</th>
              <th style="padding:12px 14px;">المخصص المعتمد</th>
              <th style="padding:12px 14px;">الالتزامات التعاقدية</th>
              <th style="padding:12px 14px;">المصروف الفعلي</th>
              <th style="padding:12px 14px;">الرصيد المتاح</th>
              <th style="padding:12px 14px; text-align:left;">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  onSearch(val) {
    this.searchQuery = val;
    this.render();
  }

  onYearChange(year) {
    this.selectedYear = year;
    this.init();
  }

  onFundingChange(source) {
    this.filterFundingSource = source;
    this.init();
  }

  onDeptChange(dept) {
    this.filterDepartment = dept;
    this.init();
  }

  _ensureModalContainer() {
    let overlay = document.getElementById('budget-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'budget-modal-overlay';
      overlay.style.cssText = 'display:none; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.75); backdrop-filter:blur(6px); align-items:center; justify-content:center; padding:16px;';
      overlay.innerHTML = `
        <div style="background:#ffffff; border-radius:14px; max-width:680px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:1px solid #cbd5e1; direction:rtl; font-family:'Tajawal', sans-serif;">
          <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border-radius:14px 14px 0 0;">
            <h3 id="budget-modal-title" style="margin:0; font-size:1.05rem; color:#0f766e; font-weight:800;"></h3>
            <button onclick="document.getElementById('budget-modal-overlay').style.display='none'" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;">✕</button>
          </div>
          <div id="budget-modal-body" style="padding:20px;"></div>
        </div>
      `;
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
      document.body.appendChild(overlay);
    }
    return {
      overlay,
      title: document.getElementById('budget-modal-title'),
      body: document.getElementById('budget-modal-body')
    };
  }

  /* ─── نافذة إضافة / تعديل بند الموازنة ─────────────────────────────────── */
  openLineModal(lineId = null) {
    const line = lineId ? this.budgetLines.find(l => String(l.id) === String(lineId)) : null;
    const isEdit = !!line;

    const modal = this._ensureModalContainer();
    modal.title.textContent = isEdit ? `✏️ تعديل بند الموازنة [${line.line_code || line.id}]` : '💵 إضافة بند موازنة جديد للمديرية';

    modal.body.innerHTML = `
      <form id="budget-line-form" onsubmit="window.budgetManager.saveLineForm(event, '${isEdit ? line.id : ''}')" style="direction:rtl;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">السنة المالية *</label>
            <input type="text" name="year" required value="${line?.year || this.selectedYear}" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">رمز الفصل المحاسبي</label>
            <input type="text" name="chapter_code" value="${line?.chapter_code || '211'}" placeholder="211" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div style="grid-column:span 2;">
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">اسم الفصل المالي *</label>
            <input type="text" name="chapter_name" required value="${line?.chapter_name || 'نفقات المشاريع الإنشائية والرأسمالية'}" placeholder="مثال: نفقات تعبيد وصيانة الطرق..." class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">رمز البند</label>
            <input type="text" name="line_code" value="${line?.line_code || ''}" placeholder="BL-2026-01" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">المخصص المالي المعتمد (د.أ) *</label>
            <input type="number" step="0.01" name="allocated_amount" required value="${line?.allocated_amount || ''}" placeholder="0.00" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div style="grid-column:span 2;">
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">اسم وبيان البند التفصيلي *</label>
            <input type="text" name="line_name" required value="${line?.line_name || ''}" placeholder="مشروع خلطات إسفلتية، جدران استنادية، لوازم هندسية..." class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">مصدر التمويل</label>
            <select name="funding_source" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
              <option value="موازنة البلدية الذاتية" ${line?.funding_source === 'موازنة البلدية الذاتية' ? 'selected' : ''}>موازنة البلدية الذاتية</option>
              <option value="منحة وزارة الإدارة المحلية" ${line?.funding_source === 'منحة وزارة الإدارة المحلية' ? 'selected' : ''}>منحة وزارة الإدارة المحلية</option>
              <option value="قرض بنك تنمية المدن والقرى" ${line?.funding_source === 'قرض بنك تنمية المدن والقرى' ? 'selected' : ''}>قرض بنك تنمية المدن والقرى</option>
              <option value="مخصصات مجلس المحافظة (اللامركزية)" ${line?.funding_source === 'مخصصات مجلس المحافظة (اللامركزية)' ? 'selected' : ''}>مخصصات مجلس المحافظة (اللامركزية)</option>
            </select>
          </div>

          <div>
            <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">القسم المسؤول</label>
            <select name="department" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
              <option value="قسم المشاريع والعطاءات" ${line?.department === 'قسم المشاريع والعطاءات' ? 'selected' : ''}>قسم المشاريع والعطاءات</option>
              <option value="قسم صيانة الطرق والآليات" ${line?.department === 'قسم صيانة الطرق والآليات' ? 'selected' : ''}>قسم صيانة الطرق والآليات</option>
              <option value="قسم الأبنية والإنشاءات" ${line?.department === 'قسم الأبنية والإنشاءات' ? 'selected' : ''}>قسم الأبنية والإنشاءات</option>
              <option value="قسم الطاقة والإنارة" ${line?.department === 'قسم الطاقة والإنارة' ? 'selected' : ''}>قسم الطاقة والإنارة</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:0.8rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">ملاحظات وشروط الصرف</label>
          <textarea name="notes" rows="2" class="form-control" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" placeholder="ملاحظات حول سقف الصرف أو قرار المجلس البلدي...">${line?.notes || ''}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:14px;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('budget-modal-overlay').style.display='none'">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="background:#0f766e; color:#fff; border:none; padding:8px 20px; font-weight:bold; border-radius:6px; cursor:pointer;">
            💾 ${isEdit ? 'تحديث البند' : 'حفظ البند المالي'}
          </button>
        </div>
      </form>
    `;

    modal.overlay.style.display = 'flex';
  }

  async saveLineForm(e, lineId) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((val, key) => data[key] = val);

    try {
      const url = lineId ? `/api/budget/lines/${lineId}` : '/api/budget/lines';
      const method = lineId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const resJson = await res.json();
      if (resJson.success) {
        alert(resJson.message || 'تم حفظ بند الموازنة بنجاح');
        document.getElementById('budget-modal-overlay').style.display = 'none';
        await this.init();
      } else {
        alert('❌ خطأ: ' + (resJson.error || ''));
      }
    } catch(err) {
      alert('خطأ: ' + err.message);
    }
  }

  async deleteLine(id) {
    if (!confirm('هل أنت متأكد من حذف بند الموازنة هذا وكافة ارتباطاته؟')) return;
    try {
      const res = await fetch(`/api/budget/lines/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ تم حذف البند بنجاح');
        await this.init();
      } else {
        alert('❌ خطأ: ' + (data.error || ''));
      }
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  }

  /* ─── نافذة تفاصيل الارتباطات والمشاريع لبند الموازنة ─────────────────── */
  async openLineDetails(lineId) {
    try {
      const res = await fetch(`/api/budget/lines/${lineId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const resJson = await res.json();
      if (!resJson.success) return alert('تعذر تحميل بيانات البند');

      const line = resJson.data;
      const allocs = line.allocations || [];

      const modal = this._ensureModalContainer();
      modal.title.textContent = `🔍 سجل الارتباطات والمشاريع للبند [${line.line_name}]`;

      const allocRows = allocs.map((a, idx) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:8px 10px; font-weight:bold;">${idx + 1}</td>
          <td style="padding:8px 10px; font-weight:600; color:#0f766e;">${a.entity_type}</td>
          <td style="padding:8px 10px;">${a.entity_name || a.entity_id}</td>
          <td style="padding:8px 10px; font-weight:bold;">${parseFloat(a.amount || 0).toLocaleString()} د.أ</td>
          <td style="padding:8px 10px;"><span style="background:${a.status==='PAID'?'#dcfce7':'#fef3c7'}; color:${a.status==='PAID'?'#166534':'#92400e'}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold;">${a.status}</span></td>
        </tr>
      `).join('');

      modal.body.innerHTML = `
        <div style="direction:rtl; font-size:0.88rem;">
          <div style="background:#f8fafc; padding:12px; border-radius:8px; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <div><strong>المخصص المعتمد:</strong> <span style="color:#0f766e; font-weight:bold;">${parseFloat(line.allocated_amount).toLocaleString()} د.أ</span></div>
            <div><strong>الالتزام المحجوز:</strong> <span style="color:#d97706; font-weight:bold;">${parseFloat(line.committed_amount).toLocaleString()} د.أ</span></div>
            <div><strong>الرصيد المتاح:</strong> <span style="color:#10b981; font-weight:bold;">${parseFloat(line.available_commitment).toLocaleString()} د.أ</span></div>
          </div>

          <div style="font-weight:bold; margin-bottom:8px; color:#1e293b;">المشاريع والعطاءات وأوامر الشراء المرتبطة:</div>
          ${allocs.length === 0 ? `
            <div style="padding:20px; text-align:center; color:#94a3b8;">لا توجد ارتباطات محجوزة على هذا البند حتى الآن.</div>
          ` : `
            <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
              <thead>
                <tr style="background:#f1f5f9; color:#475569;">
                  <th style="padding:8px 10px;">#</th>
                  <th style="padding:8px 10px;">نوع الارتباط</th>
                  <th style="padding:8px 10px;">اسم الكيان / المشروع</th>
                  <th style="padding:8px 10px;">المبلغ المرصود</th>
                  <th style="padding:8px 10px;">الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${allocRows}
              </tbody>
            </table>
          `}

          <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <button class="btn btn-outline" onclick="document.getElementById('budget-modal-overlay').style.display='none'">إغلاق</button>
          </div>
        </div>
      `;

      modal.overlay.style.display = 'flex';
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  }

  /* تصدير ملف الـ CSV بأمان عبر Blob مع الترويسة المعتمدة */
  async exportCsv() {
    try {
      const res = await fetch(`/api/budget/export?year=${this.selectedYear}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!res.ok) throw new Error('فشل تصدير ملف الموازنة من الخادم.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `directorate-budget-${this.selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('❌ تعذر تصدير الملف: ' + err.message);
    }
  }
}

window.BudgetManager = BudgetManager;
document.addEventListener('DOMContentLoaded', () => {
  if (!window.budgetManager && document.getElementById('budget-container')) {
    window.budgetManager = new BudgetManager('budget-container');
  }
});

function loadBudgetModule() {
  if (!window.budgetManager) {
    window.budgetManager = new BudgetManager('budget-container');
  } else {
    window.budgetManager.init();
  }
}
window.loadBudgetModule = loadBudgetModule;
