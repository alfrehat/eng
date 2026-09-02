/**
 * PavementReturns/Pages/pavingReturns.js
 * وحدة احتساب وإدارة عوائد التعبيد والتحققات المالية البلدية (PRAMS v4.8 Enterprise)
 * مديرية الأشغال الهندسية والشؤون المالية — بلدية كفرنجة الجديدة
 * 
 * الميزات:
 * 1. بنية موحدة متصلة مباشرة بقاعدة بيانات PostgreSQL وبدون أي بيانات وهمية.
 * 2. محرك حساب قانوني لعوائد التعبيد وفق قانون البلديات ونظام التعبيد الأردني.
 * 3. جدول قطع متعددة (Multi-Piece Ledger) داخل المعاملة الواحدة.
 * 4. ربط مكاني تفاعلي كامل GIS مع إحداثيات ثنائية الاتجاه ونقاط قابلة للسحب.
 * 5. تسجيل سندات القبض والدفعات المالية المباشرة مع تغيير حالات التحصيل.
 * 6. طباعة سند المطالبة المالية الرسمي والكشوفات المعتمدة عبر printStandardDocument.
 * 7. تصدير Excel (CSV بترميز UTF-8 BOM).
 */

'use strict';

class ComprehensivePavingReturnsManager {
  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map = null;
    this.modalMap = null;
    this.modalMarker = null;
    this.activeData = [];
    this.tendersList = [];
    this.selectedTenderId = 'all';
    this._editingId = null;
    this._collectingId = null;
    this._searchQuery = '';
    this._filterStatus = 'ALL';
    this._filterDistrict = '';
    this._currentPage = 1;
    this._pageSize = 12;
    this._sortField = 'created_at';
    this._filterApproval = 'ALL';
    this._modalPieces = [];
    this.workflow = [];

    this._readUser();
    this._initWorkflow();
    this._buildUI();
    this._loadData();

    if (typeof window !== 'undefined') {
      window.pavingReturnsManager = this;
    }
  }

  /* ─── قراءة بيانات المستخدم والصلاحيات ─────────────────────────────── */
  _readUser() {
    this.currentUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!this.currentUser) {
      try {
        const saved = localStorage.getItem('user') || sessionStorage.getItem('engineeringUser');
        if (saved) this.currentUser = JSON.parse(saved);
      } catch (e) {}
    }
    if (!this.currentUser) {
      this.currentUser = { id: 'U-001', role: 'admin', name: 'المدير الهندسي - رئيس البلدية' };
    }
  }

  _hasPerm(reqRole) {
    if (!reqRole) return true;
    const r = (this.currentUser && this.currentUser.role) ? this.currentUser.role.toLowerCase() : 'admin';
    if (r === 'admin' || r === 'manager' || r === 'director' || r === 'superadmin') return true;

    const req = String(reqRole).toUpperCase();
    if (req === 'ADMIN') return r === 'admin' || r === 'superadmin';
    if (req === 'DIRECTOR') return r === 'director' || r === 'manager' || r === 'admin' || r === 'superadmin';
    if (req === 'SECTION_HEAD') return r === 'section_head' || r === 'roads_head' || r === 'head_roads' || r === 'director' || r === 'admin' || r === 'superadmin';
    if (req === 'ENGINEER') return true;

    const perms = (this.currentUser && this.currentUser.permissions) || [];
    return perms.includes(reqRole) || perms.includes('*');
  }

  _getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.currentUser) {
      headers['x-user-id'] = this.currentUser.id || 'U-001';
      headers['x-user-role'] = this.currentUser.role || 'admin';
      if (this.currentUser.token) {
        headers['Authorization'] = `Bearer ${this.currentUser.token}`;
      }
    }
    return headers;
  }

  /* ─── بناء الواجهة الرئيسية ────────────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <style>
        .prams-root {
          color: var(--text);
          font-family: inherit;
        }
        .prams-root .card,
        .prams-root .modal-content {
          background-color: var(--bg-card) !important;
          color: var(--text) !important;
          border: 1px solid var(--border) !important;
        }
        .prams-root .form-section-box {
          background-color: var(--bg-surface) !important;
          border: 1px solid var(--border) !important;
          border-radius: 10px;
          padding: 16px;
        }
        .prams-root .form-control,
        .prams-root input[type="text"],
        .prams-root input[type="number"],
        .prams-root input[type="date"],
        .prams-root select,
        .prams-root textarea {
          background-color: var(--input-bg) !important;
          color: var(--input-text) !important;
          border: 1px solid var(--input-border, var(--border)) !important;
          border-radius: 8px !important;
          padding: 9px 12px !important;
          font-size: 0.9rem !important;
          font-family: inherit !important;
        }
        .prams-root .form-control:focus,
        .prams-root input:focus,
        .prams-root select:focus,
        .prams-root textarea:focus {
          border-color: var(--primary, #3b82f6) !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
        }
        .prams-root select option {
          background-color: var(--bg-card, #111a2e) !important;
          color: var(--text, #f8fafc) !important;
        }
        .prams-root input::placeholder,
        .prams-root textarea::placeholder {
          color: var(--input-placeholder, var(--text-muted)) !important;
          opacity: 0.75;
        }
        .prams-root label {
          color: var(--text) !important;
          font-weight: 700;
          font-size: 0.85rem;
          margin-bottom: 4px;
          display: block;
        }
        .prams-root table {
          color: var(--text) !important;
        }
        .prams-root table th {
          background-color: var(--table-header-bg, var(--bg-surface)) !important;
          color: var(--table-header-text, var(--text)) !important;
          border-bottom: 2px solid var(--border) !important;
        }
        .prams-root table td {
          border-bottom: 1px solid var(--border) !important;
          color: var(--text) !important;
        }
        .prams-root table tfoot {
          background-color: var(--bg-surface) !important;
          color: var(--text) !important;
          border-top: 2px solid var(--primary) !important;
        }
      </style>
      <div class="prams-root" dir="rtl">

        <!-- ============================================================== -->
        <!-- 1. شاشة العرض والجدول الرئيسية (List View Dashboard) -->
        <!-- ============================================================== -->
        <div id="prams-view-list">
          <!-- الترويسة الرئيسية والبطاقة التعريفية -->
          <div class="prams-header" style="
            display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;
            margin-bottom:20px; background:linear-gradient(135deg, #0f766e 0%, #065f46 50%, #064e3b 100%);
            padding:24px 28px; border-radius:14px; color:white; box-shadow:0 8px 24px rgba(6,95,70,0.25);
            position:relative; overflow:hidden;
          ">
            <div style="position:absolute; top:-40px; left:-40px; width:140px; height:140px; background:rgba(255,255,255,0.06); border-radius:50%;"></div>
            <div style="position:absolute; bottom:-30px; right:80px; width:100px; height:100px; background:rgba(255,255,255,0.04); border-radius:50%;"></div>
            
            <div style="position:relative; z-index:1;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <span style="font-size:2rem;">🛣️</span>
                <h2 style="margin:0; font-size:1.6rem; font-weight:800; color:white;">وحدة احتساب وإدارة عوائد التعبيد والتحققات</h2>
                <span style="background:rgba(255,255,255,0.2); font-size:0.75rem; padding:4px 10px; border-radius:20px; font-weight:600;">v4.8 Enterprise</span>
              </div>
              <p style="margin:0; opacity:0.9; font-size:0.9rem; max-width:700px; line-height:1.5;">
                إدارة مطالبات عوائد التعبيد القانونية، الربط بالعطاءات، جدول القطع المتعددة، الإسقاط المكاني الجغرافي، وسندات التحصيل المالي المعتمدة
              </p>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; position:relative; z-index:1;">
              <button class="btn btn-outline" id="prams-btn-workflow-config" style="background:rgba(255,255,255,0.18); color:white; border:1px solid rgba(255,255,255,0.35); font-weight:700;">⚙️ سلسلة الاعتمادات</button>
              <button class="btn btn-outline" id="prams-btn-export-csv" style="background:rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.3); font-weight:700;">📊 تصدير Excel</button>
              <button class="btn btn-outline" id="prams-btn-print-summary" style="background:rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.3); font-weight:700;">🖨️ طباعة كشف العطاء</button>
              <button class="btn btn-outline" id="prams-btn-refresh" style="background:rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.3);">🔄 تحديث</button>
              <button class="btn" id="prams-btn-new" style="background:#ffffff; color:#065f46; font-weight:800; border:none; padding:10px 20px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">➕ إضافة معاملة عوائد تعبيد</button>
            </div>
          </div>

          <!-- مؤشرات الأداء الحيوية 4 KPIs -->
          <div class="prams-kpis" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
            <!-- KPI 1 -->
            <div class="card" style="border-radius:12px; padding:16px 20px; border-right:4px solid #3b82f6 !important; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">إجمالي السجلات والتحققات</div>
                  <div id="prams-kpi-total-count" style="font-size:1.6rem; font-weight:800; color:var(--text);">0</div>
                </div>
                <div style="width:44px; height:44px; border-radius:10px; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">📋</div>
              </div>
            </div>

            <!-- KPI 2 -->
            <div class="card" style="border-radius:12px; padding:16px 20px; border-right:4px solid #10b981 !important; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">إجمالي المبالغ المفروضة</div>
                  <div id="prams-kpi-total-required" style="font-size:1.4rem; font-weight:800; color:#10b981;">0.000 د.أ</div>
                </div>
                <div style="width:44px; height:44px; border-radius:10px; background:rgba(16,185,129,0.15); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">💰</div>
              </div>
            </div>

            <!-- KPI 3 -->
            <div class="card" style="border-radius:12px; padding:16px 20px; border-right:4px solid #06b6d4 !important; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">إجمالي المبالغ المحصلة</div>
                  <div id="prams-kpi-total-paid" style="font-size:1.4rem; font-weight:800; color:#06b6d4;">0.000 د.أ</div>
                </div>
                <div style="width:44px; height:44px; border-radius:10px; background:rgba(6,182,212,0.15); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">💵</div>
              </div>
            </div>

            <!-- KPI 4 -->
            <div class="card" style="border-radius:12px; padding:16px 20px; border-right:4px solid #f59e0b !important; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">مجموع أطوال الواجهات</div>
                  <div id="prams-kpi-total-length" style="font-size:1.4rem; font-weight:800; color:#f59e0b;">0.00 م</div>
                </div>
                <div style="width:44px; height:44px; border-radius:10px; background:rgba(245,158,11,0.15); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">📏</div>
              </div>
            </div>
          </div>

          <!-- شريط التقدم المالي ونسبة التحصيل -->
          <div class="card" style="padding:16px 20px; border-radius:12px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.88rem;">
              <div style="font-weight:700; color:var(--text); display:flex; align-items:center; gap:6px;">
                <span>📈</span> <span>نسبة التحصيل المالي العام للبلدية:</span>
                <span id="prams-progress-percent" style="font-weight:800; color:#10b981;">0%</span>
              </div>
              <div id="prams-progress-balance" style="color:var(--text-muted); font-weight:600;">
                المتبقي غير المحصل: 0.000 د.أ
              </div>
            </div>
            <div style="width:100%; height:16px; background:var(--bg-surface); border-radius:10px; overflow:hidden; border:1px solid var(--border);">
              <div id="prams-progress-bar" style="height:100%; width:0%; border-radius:10px; background:linear-gradient(90deg, #10b981 0%, #06b6d4 100%); transition:width 0.8s ease;"></div>
            </div>
          </div>

          <!-- شريط البحث والتصفية واختيار العطاء -->
          <div class="card" style="padding:16px 20px; border-radius:12px; margin-bottom:20px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; align-items:center;">
              <div>
                <label>📋 العطاء المرتبط:</label>
                <select id="prams-filter-tender" class="form-control" style="width:100%;">
                  <option value="all">🌐 كافة العطاءات (السجل الشامل)</option>
                </select>
              </div>

              <div>
                <label>🔍 بحث شامل:</label>
                <input type="text" id="prams-search-input" class="form-control" placeholder="رقم القطعة، الحوض، الحي، الشارع..." style="width:100%;">
              </div>

              <div>
                <label>⚖️ مسار وسلسلة الاعتماد:</label>
                <select id="prams-filter-approval" class="form-control" style="width:100%;">
                  <option value="ALL">جميع مراحل الاعتماد</option>
                  <option value="APPROVED">🟢 معتمد ومدرج بالسجلات</option>
                  <option value="UNDER_REVIEW">🟡 قيد تدقيق رئيس القسم</option>
                  <option value="PENDING_DIRECTOR">🟠 بانتظار مصادقة مدير الأشغال</option>
                  <option value="DRAFT">⚪ مسودة قيد التنظيم</option>
                  <option value="RETURNED">🔴 معادة للتعديل</option>
                </select>
              </div>

              <div>
                <label>💵 حالة التحصيل:</label>
                <select id="prams-filter-status" class="form-control" style="width:100%;">
                  <option value="ALL">جميع الحالات المالية</option>
                  <option value="PAID">🟢 مسدد بالكامل</option>
                  <option value="PARTIAL">🟡 مسدد جزئياً</option>
                  <option value="UNPAID">🔴 غير مسدد (مستحق)</option>
                </select>
              </div>

              <div>
                <label>🏘️ الحي / المنطقة:</label>
                <input type="text" id="prams-filter-district" class="form-control" placeholder="تصفية حسب الحي..." style="width:100%;">
              </div>
            </div>
          </div>

          <!-- قسم الخريطة التفاعلية GIS -->
          <div class="card" style="border-radius:12px; margin-bottom:20px; overflow:hidden;">
            <div style="padding:14px 20px; background:var(--bg-surface); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <div style="font-weight:800; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
                <span>🗺️</span> <span>الإسقاط المكاني لقطع الأراضي والشوارع المشمولة بعوائد التعبيد</span>
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:12px;">
                <span><span style="color:#10b981;">●</span> مسدد</span>
                <span><span style="color:#f59e0b;">●</span> سداد جزئي</span>
                <span><span style="color:#ef4444;">●</span> غير مسدد</span>
              </div>
            </div>
            <div id="prams-main-map" style="width:100%; height:320px; background:#0d1527;"></div>
          </div>

          <!-- جدول السجلات الشامل -->
          <div class="card" style="border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.03);">
            <div class="table-responsive" style="overflow-x:auto;">
              <table class="table" style="width:100%; border-collapse:collapse; text-align:right; font-size:0.88rem;">
                <thead>
                  <tr>
                    <th style="padding:12px 14px; font-weight:800;">حالة الاعتماد والتحصيل</th>
                    <th style="padding:12px 14px; font-weight:800;">رقم المعاملة</th>
                    <th style="padding:12px 14px; font-weight:800;">رقم القطعة / الحوض</th>
                    <th style="padding:12px 14px; font-weight:800;">الحي / موقع الشارع</th>
                    <th style="padding:12px 14px; font-weight:800;">العطاء المرتبط</th>
                    <th style="padding:12px 14px; font-weight:800; text-align:center;">الواجهة (م)</th>
                    <th style="padding:12px 14px; font-weight:800; text-align:center;">المبلغ المفروض (د.أ)</th>
                    <th style="padding:12px 14px; font-weight:800; text-align:center;">المسدد (د.أ)</th>
                    <th style="padding:12px 14px; font-weight:800; text-align:center;">المتبقي (د.أ)</th>
                    <th style="padding:12px 14px; font-weight:800; text-align:center; min-width:180px;">الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="prams-table-body">
                  <tr>
                    <td colspan="10" style="text-align:center; padding:40px; color:var(--text-muted);">
                      جاري تحميل سجلات عوائد التعبيد من قاعدة البيانات...
                    </td>
                  </tr>
                </tbody>
                <tfoot id="prams-table-foot" style="font-weight:800; display:none;">
                  <tr>
                    <td colspan="5" style="padding:12px 14px; color:#10b981; font-size:0.92rem;">📊 الإجمالي الكلي للنتائج المعروضة:</td>
                    <td id="prams-foot-length" style="padding:12px 14px; text-align:center; color:#10b981;">0.00 م</td>
                    <td id="prams-foot-required" style="padding:12px 14px; text-align:center; color:#10b981;">0.000 د.أ</td>
                    <td id="prams-foot-paid" style="padding:12px 14px; text-align:center; color:#06b6d4;">0.000 د.أ</td>
                    <td id="prams-foot-balance" style="padding:12px 14px; text-align:center; color:#ef4444;">0.000 د.أ</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- شريط ترقيم الصفحات -->
            <div id="prams-pagination" style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-top:1px solid var(--border); background:var(--bg-surface); font-size:0.85rem;">
              <div id="prams-pagination-info" style="color:var(--text-muted);">عرض 0 من 0 سجل</div>
              <div id="prams-pagination-buttons" style="display:flex; gap:6px;"></div>
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- 2. شاشة الإدخال والمعاملة المنفصلة بالكامل بتنسيق طولي مريح 100% -->
        <!-- ============================================================== -->
        <div id="prams-view-form" style="display:none; width:100%; max-width:100%; box-sizing:border-box; overflow-x:hidden; animation:fadeIn 0.2s ease-in-out;">
          
          <!-- 1. شريط الترويسة والتحكم العلوي -->
          <div class="card" style="padding:16px 20px; border-radius:12px; margin-bottom:16px; background:linear-gradient(135deg, #0f766e 0%, #065f46 100%); color:white; border:none; box-shadow:0 4px 16px rgba(6,95,70,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <h2 id="prams-modal-title" style="margin:0; font-size:1.3rem; font-weight:800; color:#fff;">
                  إضافة معاملة وفرض عوائد تعبيد بالعطاء
                </h2>
                <div id="prams-modal-subtitle" style="font-size:0.8rem; opacity:0.9; margin-top:2px;">
                  مديرية الأشغال والخدمات الهندسية — مسار وسلسلة الاعتماد والتدقيق المتسلسل
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" class="btn btn-outline" onclick="pavingReturnsManager.closeModal()" style="color:white; border-color:rgba(255,255,255,0.45); font-weight:700; padding:7px 16px; background:rgba(255,255,255,0.1); border-radius:8px;">
                  ← العودة إلى جدول السجلات
                </button>
                <button type="button" class="btn" style="background:#ffffff; color:#065f46; font-weight:800; border:none; padding:8px 18px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);" onclick="document.getElementById('prams-entry-form').requestSubmit();">
                  💾 حفظ المعاملة
                </button>
              </div>
            </div>
          </div>

          <!-- 2. شريط مسار وسلسلة الاعتمادات الفنية والإدارية المتتابع -->
          <div class="card" style="padding:12px 16px; border-radius:12px; margin-bottom:16px; width:100%; box-sizing:border-box;">
            <div style="font-size:0.82rem; font-weight:800; color:var(--text); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <span>⛓️</span> <span>مسار وسلسلة الاعتماد والتدقيق الهندسي:</span>
            </div>
            <div id="prams-modal-workflow-ribbon" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; width:100%; box-sizing:border-box;">
              <!-- Dynamic Stages Rendered in JS -->
            </div>
          </div>

          <!-- 3. نموذج الإدخال الطولي المتتابع المريح (Vertical Flow) -->
          <form id="prams-entry-form" style="display:flex; flex-direction:column; gap:16px; width:100%; box-sizing:border-box;">
            <input type="hidden" id="prams-form-id" value="" />
            <input type="hidden" id="prams-form-approval-status" value="DRAFT" />
            <input type="hidden" id="prams-form-current-stage" value="1" />

            <!-- قسم 1: بيانات العطاء والموقع الهندسي -->
            <div class="card" style="padding:16px 20px; border-radius:12px; width:100%; box-sizing:border-box;">
              <div style="font-weight:800; font-size:0.95rem; color:#10b981; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span>📋</span> <span>بيانات العطاء وموقع التعبيد الهندسي</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                  <label style="font-weight:700; margin-bottom:4px; display:block; font-size:0.85rem;">
                    العطاء / المشروع المعتمد للتعبيد <span style="color:red">*</span>
                  </label>
                  <select id="prams-form-tender-id" class="form-control" required style="width:100%; font-weight:700; font-size:0.9rem; padding:8px 12px;">
                    <option value="">-- اختر العطاء المرتبط بالشارع --</option>
                  </select>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                  <div>
                    <label style="font-weight:700; margin-bottom:4px; display:block; font-size:0.85rem;">
                      🏘️ الحي / المنطقة <span style="color:red">*</span>
                    </label>
                    <input type="text" id="prams-form-district" class="form-control" required placeholder="مثال: حي نخلة / وسط البلد" style="width:100%;">
                  </div>

                  <div>
                    <label style="font-weight:700; margin-bottom:4px; display:block; font-size:0.85rem;">
                      🛣️ اسم الشارع / موقع التعبيد
                    </label>
                    <input type="text" id="prams-form-street-name" class="form-control" placeholder="مثال: شارع القلعة الرئيسي" style="width:100%;">
                  </div>
                </div>
              </div>
            </div>

            <!-- قسم 2: سجل وجدول الفرض للقطع والواجهات (Multi-Piece Ledger) -->
            <div class="card" style="padding:16px 20px; border-radius:12px; width:100%; box-sizing:border-box;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                <div>
                  <div style="font-weight:800; font-size:0.95rem; color:#10b981; display:flex; align-items:center; gap:6px;">
                    <span>📐</span> <span>سجل وجدول الفرض للقطع والواجهات (Multi-Piece Ledger)</span>
                  </div>
                  <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">إدخال أبعاد وواجهات القطع لحساب المبالغ المستحقة وفق قانون رسوم الطرق والتحققات</div>
                </div>
                <button type="button" class="btn btn-outline" id="prams-btn-add-piece" style="border-color:#10b981; color:#10b981; font-weight:800; padding:6px 14px; display:flex; align-items:center; gap:6px; font-size:0.85rem;">
                  <span>➕</span> <span>إضافة قطعة أخرى</span>
                </button>
              </div>

              <div style="width:100%; overflow-x:auto; border-radius:8px; border:1px solid var(--border);">
                <table class="table" style="width:100%; min-width:680px; border-collapse:collapse; text-align:right; font-size:0.85rem; margin:0;">
                  <thead>
                    <tr style="background:var(--bg-surface);">
                      <th style="padding:8px 10px; width:13%;">رقم القطعة *</th>
                      <th style="padding:8px 10px; width:13%;">رقم الحوض *</th>
                      <th style="padding:8px 10px; width:14%;">طول الواجهة (م) *</th>
                      <th style="padding:8px 10px; width:14%;">عرض التعبيد (م) *</th>
                      <th style="padding:8px 10px; width:13%;">سعر المتر (د.أ)</th>
                      <th style="padding:8px 10px; width:15%;">نسبة الفرض (%)</th>
                      <th style="padding:8px 10px; width:14%;">المبلغ (د.أ)</th>
                      <th style="padding:8px 10px; width:4%; text-align:center;">حذف</th>
                    </tr>
                  </thead>
                  <tbody id="prams-pieces-tbody">
                    <!-- Dynamic Piece Rows -->
                  </tbody>
                </table>
              </div>

              <!-- شريط خلاصة الحساب المالي والتفقيط -->
              <div style="margin-top:12px; background:rgba(16,185,129,0.1); padding:12px 16px; border-radius:8px; border:1px solid rgba(16,185,129,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                  <div style="font-size:0.75rem; color:#10b981; font-weight:700;">المعادلة القانونية: المبلغ = طول الواجهة × عرض التعبيد × سعر المتر × نسبة التحقق</div>
                  <div id="prams-modal-amount-words" style="font-size:0.88rem; font-weight:800; color:var(--text); margin-top:2px;">
                    فقط صفر دينار أردني لا غير
                  </div>
                </div>
                <div style="text-align:left;">
                  <div style="font-size:0.75rem; color:#10b981; font-weight:700;">المبلغ الإجمالي المطلوب:</div>
                  <div id="prams-modal-total-amount" style="font-size:1.35rem; font-weight:800; color:#10b981;">0.000 د.أ</div>
                </div>
              </div>
            </div>

            <!-- قسم 3: الإسقاط المكاني وخريطة الموقع GIS -->
            <div class="card" style="padding:16px 20px; border-radius:12px; width:100%; box-sizing:border-box;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:800; font-size:0.95rem; color:#10b981; display:flex; align-items:center; gap:6px;">
                  <span>📍</span> <span>الإسقاط المكاني وموقع القطع على الخريطة (GIS)</span>
                </div>
                <button type="button" class="btn btn-sm btn-outline" id="prams-btn-gps" style="font-size:0.78rem; padding:4px 12px; font-weight:700;">📍 موقعي الحالي</button>
              </div>

              <div id="prams-modal-map" style="width:100%; height:220px; border-radius:8px; border:1px solid var(--border); margin-bottom:10px;"></div>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                <div>
                  <label style="font-size:0.78rem; font-weight:600;">خط العرض (Latitude):</label>
                  <input type="number" step="0.000001" id="prams-form-lat" class="form-control" style="width:100%; direction:ltr; padding:6px 10px; font-size:0.85rem;">
                </div>
                <div>
                  <label style="font-size:0.78rem; font-weight:600;">خط الطول (Longitude):</label>
                  <input type="number" step="0.000001" id="prams-form-lng" class="form-control" style="width:100%; direction:ltr; padding:6px 10px; font-size:0.85rem;">
                </div>
              </div>
            </div>

            <!-- قسم 4: الملاحظات وقرارات المجلس البلدي -->
            <div class="card" style="padding:16px 20px; border-radius:12px; width:100%; box-sizing:border-box;">
              <label style="font-weight:700; margin-bottom:6px; display:block; font-size:0.88rem;">
                📝 ملاحظات التدقيق الهندسي وقرارات المجلس البلدي:
              </label>
              <textarea id="prams-form-notes" class="form-control" rows="2" placeholder="أي ملاحظات فنية، مبررات التدقيق، أو رقم وتاريخ قرار المجلس البلدي..." style="width:100%; font-size:0.88rem;"></textarea>
            </div>

            <!-- قسم 5: شريط أزرار مسار وسلسلة الاعتمادات والتنقل السفلي -->
            <div class="card" style="padding:14px 20px; border-radius:12px; width:100%; box-sizing:border-box;">
              <div id="prams-modal-actions-bar" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                <!-- Dynamic Action & Approval Buttons Generated in JS -->
              </div>
            </div>

          </form>

        </div>

        <!-- ============================================================== -->
        <!-- 3. نافذة إعدادات وتخصيص سلسلة ومسار الاعتمادات لمدير النظام Modal -->
        <!-- ============================================================== -->
        <div class="modal" id="prams-workflow-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; padding:16px;">
          <div class="modal-content" style="width:100%; max-width:960px; height:85vh; border-radius:14px; box-shadow:0 16px 50px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden;">
            
            <div style="padding:14px 20px; background:linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color:white; display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.3rem;">⚙️</span>
                <div>
                  <h3 style="margin:0; font-size:1.1rem; font-weight:800;">تخصيص سلسلة الاعتمادات والمسميات الوظيفية</h3>
                  <div style="font-size:0.75rem; opacity:0.85;">صلاحيات مدير النظام — ضبط مسار التدقيق والتواقيع الرسمية لكافة معاملات عوائد التعبيد</div>
                </div>
              </div>
              <button type="button" class="btn btn-outline icon-btn" id="prams-workflow-close" style="color:white; border-color:rgba(255,255,255,0.4);">✕</button>
            </div>

            <div style="padding:18px 22px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.9rem; font-weight:800; color:var(--text);">⛓️ مراحل مسار الاعتماد المتسلسل:</div>
                <button type="button" class="btn btn-sm btn-outline" id="prams-btn-add-wf-stage" style="border-color:#3b82f6; color:#3b82f6; font-weight:bold;">
                  ➕ إضافة مرحلة اعتماد
                </button>
              </div>

              <div class="table-responsive" style="overflow-x:auto;">
                <table class="table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
                  <thead>
                    <tr>
                      <th style="padding:8px; width:6%; text-align:center;">الترتيب</th>
                      <th style="padding:8px; width:24%;">عنوان مرحلة الاعتماد</th>
                      <th style="padding:8px; width:26%;">المسمى الوظيفي للمعتمد</th>
                      <th style="padding:8px; width:18%;">الصلاحية المطلوبة</th>
                      <th style="padding:8px; width:16%;">نص خانة التوقيع</th>
                      <th style="padding:8px; width:10%; text-align:center;">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody id="prams-workflow-tbody">
                    <!-- Dynamic workflow stages rows -->
                  </tbody>
                </table>
              </div>

              <div style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.25); border-radius:8px; padding:10px 14px; font-size:0.8rem; line-height:1.5;">
                💡 <strong>قواعد الاعتماد:</strong> تنعكس هذه السلسلة فورياً على أزرار المعاملة، وشريط التتبع في شاشة الإدخال، وشريط التواقيع في سندات المطالبة الرسمية ومطبوعات النظام.
              </div>
            </div>

            <div style="padding:14px 20px; background:var(--bg-surface); border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
              <button type="button" class="btn btn-outline" id="prams-workflow-cancel">إلغاء</button>
              <button type="button" class="btn btn-primary" id="prams-workflow-save" style="background:#1e3a8a; border-color:#1e3a8a; font-weight:800; padding:8px 22px;">
                💾 حفظ وتطبيق سلسلة الاعتمادات
              </button>
            </div>

          </div>
        </div>



        <!-- ===== نافذة تسجيل سند القبض والتحصيل Modal ===== -->
        <div class="modal" id="prams-payment-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:9999; align-items:center; justify-content:center; padding:20px;">
          <div class="modal-content" style="width:100%; max-width:520px; border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,0.5); overflow:hidden;">
            
            <div style="padding:16px 20px; background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:white; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:8px;">
                <span>💵</span> <span>تسجيل سند قبض وتحصيل مالي</span>
              </h3>
              <button type="button" class="btn btn-outline icon-btn" id="prams-payment-close" style="color:white; border-color:rgba(255,255,255,0.4);">✕</button>
            </div>

            <form id="prams-payment-form" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
              <input type="hidden" id="prams-pay-id" value="" />

              <div id="prams-pay-summary" class="form-section-box" style="font-size:0.88rem; line-height:1.6;">
                <!-- Summary of current dues -->
              </div>

              <div>
                <label>💵 المبلغ المدفوع (د.أ) <span style="color:red">*</span></label>
                <input type="number" step="0.001" id="prams-pay-amount" class="form-control" required min="0.001" style="width:100%; font-weight:800; font-size:1.1rem; color:#0284c7 !important;">
              </div>

              <div>
                <label>🧾 رقم سند القبض الرسمي <span style="color:red">*</span></label>
                <input type="text" id="prams-pay-receipt" class="form-control" required placeholder="مثال: REC-2026-9042" style="width:100%;">
              </div>

              <div>
                <label>📅 تاريخ السداد <span style="color:red">*</span></label>
                <input type="date" id="prams-pay-date" class="form-control" required style="width:100%;">
              </div>

              <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border); padding-top:14px; margin-top:6px;">
                <button type="button" class="btn btn-outline" id="prams-payment-cancel">إلغاء</button>
                <button type="submit" class="btn btn-primary" style="background:#0284c7; border-color:#0284c7; font-weight:800; padding:8px 20px;">✅ قيد سند القبض</button>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;

    this._bindEvents();
    this._initMainMap();
  }

  /* ─── تهيئة وتحميل سلسلة الاعتمادات المعتمدة للنظام ─────────────────── */
  _initWorkflow() {
    try {
      const stored = localStorage.getItem('system_approval_workflow');
      if (stored) {
        this.workflow = JSON.parse(stored);
      }
    } catch (e) {}

    if (!Array.isArray(this.workflow) || !this.workflow.length) {
      this.workflow = [
        {
          order: 1,
          key: 'ORGANIZER',
          stageTitle: 'إعداد وتنظيم المعاملة',
          roleName: 'المهندس',
          requiredRole: 'ENGINEER',
          icon: '📝',
          signLabel: 'التوقيع والتاريخ'
        },
        {
          order: 2,
          key: 'SECTION_HEAD',
          stageTitle: 'التدقيق الهندسي والميداني',
          roleName: 'رئيس القسم',
          requiredRole: 'SECTION_HEAD',
          icon: '🔍',
          signLabel: 'التوقيع والتاريخ'
        },
        {
          order: 3,
          key: 'DIRECTOR',
          stageTitle: 'الاعتماد والمصادقة الفنية والإدراج بالسجلات',
          roleName: 'مدير الأشغال والخدمات الهندسية',
          requiredRole: 'DIRECTOR',
          icon: '🏛️',
          signLabel: 'التوقيع والاعتماد الرسمي',
          isFinal: true
        }
      ];
    }
  }

  /* ─── ربط الأحداث والأزرار ─────────────────────────────────────────── */
  _bindEvents() {
    const byId = id => document.getElementById(id);

    byId('prams-btn-refresh')?.addEventListener('click', () => this._loadData());
    byId('prams-btn-new')?.addEventListener('click', () => this.openNewModal());
    byId('prams-btn-workflow-config')?.addEventListener('click', () => this.openWorkflowConfigModal());
    byId('prams-workflow-close')?.addEventListener('click', () => this.closeWorkflowConfigModal());
    byId('prams-workflow-cancel')?.addEventListener('click', () => this.closeWorkflowConfigModal());
    byId('prams-btn-add-wf-stage')?.addEventListener('click', () => this._addWorkflowStage());
    byId('prams-workflow-save')?.addEventListener('click', () => this._saveWorkflowConfig());

    byId('prams-modal-max-btn')?.addEventListener('click', () => this._toggleModalMaximize());
    byId('prams-modal-close')?.addEventListener('click', () => this.closeModal());
    byId('prams-btn-cancel-modal')?.addEventListener('click', () => this.closeModal());
    byId('prams-btn-add-piece')?.addEventListener('click', () => this._addPieceRow());
    byId('prams-entry-form')?.addEventListener('submit', e => this._onFormSubmit(e));

    byId('prams-btn-export-csv')?.addEventListener('click', () => this.exportCSV());
    byId('prams-btn-print-summary')?.addEventListener('click', () => this.printSummaryReport());

    byId('prams-filter-tender')?.addEventListener('change', e => {
      this.selectedTenderId = e.target.value;
      this._currentPage = 1;
      this._render();
    });

    byId('prams-search-input')?.addEventListener('input', e => {
      this._searchQuery = e.target.value.trim().toLowerCase();
      this._currentPage = 1;
      this._render();
    });

    byId('prams-filter-approval')?.addEventListener('change', e => {
      this._filterApproval = e.target.value;
      this._currentPage = 1;
      this._render();
    });

    byId('prams-filter-status')?.addEventListener('change', e => {
      this._filterStatus = e.target.value;
      this._currentPage = 1;
      this._render();
    });

    byId('prams-filter-district')?.addEventListener('input', e => {
      this._filterDistrict = e.target.value.trim().toLowerCase();
      this._currentPage = 1;
      this._render();
    });

    byId('prams-btn-gps')?.addEventListener('click', () => this._locateGPS());

    byId('prams-form-lat')?.addEventListener('input', () => this._onManualCoordChange());
    byId('prams-form-lng')?.addEventListener('input', () => this._onManualCoordChange());

    // Payment Modal
    byId('prams-payment-close')?.addEventListener('click', () => this.closePaymentModal());
    byId('prams-payment-cancel')?.addEventListener('click', () => this.closePaymentModal());
    byId('prams-payment-form')?.addEventListener('submit', e => this._onPaymentSubmit(e));
  }

  /* ─── إدارة وتخصيص سلسلة الاعتمادات لمدير النظام ─────────────────── */
  openWorkflowConfigModal() {
    this._renderWorkflowConfigTable();
    const modal = document.getElementById('prams-workflow-modal');
    if (modal) modal.style.display = 'flex';
  }

  closeWorkflowConfigModal() {
    const modal = document.getElementById('prams-workflow-modal');
    if (modal) modal.style.display = 'none';
  }

  _renderWorkflowConfigTable() {
    const tbody = document.getElementById('prams-workflow-tbody');
    if (!tbody) return;

    let html = '';
    this.workflow.forEach((stg, idx) => {
      html += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:8px; text-align:center; font-weight:bold; color:#10b981;">
            ${idx + 1}
          </td>
          <td style="padding:8px;">
            <input type="text" class="form-control" value="${stg.stageTitle || ''}" style="width:100%; padding:5px 8px; font-size:0.83rem;" oninput="pavingReturnsManager._updateWorkflowStage(${idx}, 'stageTitle', this.value)">
          </td>
          <td style="padding:8px;">
            <input type="text" class="form-control" value="${stg.roleName || ''}" style="width:100%; padding:5px 8px; font-size:0.83rem;" oninput="pavingReturnsManager._updateWorkflowStage(${idx}, 'roleName', this.value)">
          </td>
          <td style="padding:8px;">
            <select class="form-control" style="width:100%; padding:5px 8px; font-size:0.83rem;" onchange="pavingReturnsManager._updateWorkflowStage(${idx}, 'requiredRole', this.value)">
              <option value="ENGINEER" ${stg.requiredRole === 'ENGINEER' ? 'selected' : ''}>المهندس</option>
              <option value="SECTION_HEAD" ${stg.requiredRole === 'SECTION_HEAD' ? 'selected' : ''}>رئيس القسم</option>
              <option value="DIRECTOR" ${stg.requiredRole === 'DIRECTOR' ? 'selected' : ''}>مدير الأشغال والخدمات الهندسية</option>
              <option value="MAYOR" ${stg.requiredRole === 'MAYOR' ? 'selected' : ''}>عطوفة رئيس البلدية</option>
              <option value="ADMIN" ${stg.requiredRole === 'ADMIN' ? 'selected' : ''}>مدير النظام (Admin)</option>
            </select>
          </td>
          <td style="padding:8px;">
            <input type="text" class="form-control" value="${stg.signLabel || 'التوقيع والتاريخ'}" style="width:100%; padding:5px 8px; font-size:0.83rem;" oninput="pavingReturnsManager._updateWorkflowStage(${idx}, 'signLabel', this.value)">
          </td>
          <td style="padding:8px; text-align:center;">
            <div style="display:flex; gap:4px; justify-content:center;">
              ${idx > 0 ? `<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;" onclick="pavingReturnsManager._moveWorkflowStage(${idx}, -1)" title="تحريك لأعلى">▲</button>` : ''}
              ${idx < this.workflow.length - 1 ? `<button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px;" onclick="pavingReturnsManager._moveWorkflowStage(${idx}, 1)" title="تحريك لأسفل">▼</button>` : ''}
              ${this.workflow.length > 2 ? `<button type="button" class="btn btn-sm btn-danger" style="padding:2px 6px;" onclick="pavingReturnsManager._removeWorkflowStage(${idx})" title="حذف">✕</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  _updateWorkflowStage(idx, field, val) {
    if (this.workflow[idx]) {
      this.workflow[idx][field] = val;
    }
  }

  _addWorkflowStage() {
    this.workflow.push({
      order: this.workflow.length + 1,
      key: `STAGE_${Date.now().toString().slice(-4)}`,
      stageTitle: 'مرحلة اعتماد جديدة',
      roleName: 'مدقق مختص',
      requiredRole: 'ENGINEER',
      icon: '📌',
      signLabel: 'التوقيع والتاريخ'
    });
    this._renderWorkflowConfigTable();
  }

  _removeWorkflowStage(idx) {
    if (this.workflow.length > 2) {
      this.workflow.splice(idx, 1);
      this._renderWorkflowConfigTable();
    }
  }

  _moveWorkflowStage(idx, dir) {
    const target = idx + dir;
    if (target >= 0 && target < this.workflow.length) {
      const temp = this.workflow[idx];
      this.workflow[idx] = this.workflow[target];
      this.workflow[target] = temp;
      this._renderWorkflowConfigTable();
    }
  }

  async _saveWorkflowConfig() {
    try {
      localStorage.setItem('system_approval_workflow', JSON.stringify(this.workflow));
      if (typeof window !== 'undefined') window.systemApprovalWorkflow = this.workflow;

      await fetch('/api/v4/settings/approval-workflow', {
        method: 'PUT',
        headers: this._getAuthHeaders(),
        body: JSON.stringify({ workflow: this.workflow })
      });

      if (typeof showToast === 'function') showToast('تم حفظ وتطبيق سلسلة الاعتمادات والمسميات بنجاح ✅', 'success');
      this.closeWorkflowConfigModal();
    } catch (e) {
      localStorage.setItem('system_approval_workflow', JSON.stringify(this.workflow));
      if (typeof showToast === 'function') showToast('تم حفظ السلسلة محلياً وتطبيقها فوراً ✅', 'success');
      this.closeWorkflowConfigModal();
    }
  }

  /* ─── تكبير وتصغير نافذة الإدخال (Fullscreen / Resizable Modal) ────── */
  _toggleModalMaximize() {
    const box = document.getElementById('prams-modal-box');
    const btn = document.getElementById('prams-modal-max-btn');
    if (!box) return;

    this._isModalMaximized = !this._isModalMaximized;
    if (this._isModalMaximized) {
      box.style.maxWidth = '98vw';
      box.style.width = '98vw';
      box.style.height = '96vh';
      box.style.borderRadius = '10px';
      if (btn) btn.innerHTML = '🗗';
    } else {
      box.style.maxWidth = '1180px';
      box.style.width = '96%';
      box.style.height = '94vh';
      box.style.borderRadius = '16px';
      if (btn) btn.innerHTML = '⛶';
    }

    setTimeout(() => {
      if (this.modalMap) this.modalMap.invalidateSize();
    }, 200);
  }

  /* ─── تصيير شريط مسار وسلسلة الاعتمادات داخل النافذة ────────────────── */
  _renderModalWorkflowRibbon(approvalStatus, currentStage) {
    const ribbon = document.getElementById('prams-modal-workflow-ribbon');
    if (!ribbon) return;

    const st = (approvalStatus || 'DRAFT').toUpperCase();
    const curIdx = parseInt(currentStage || 1, 10);
    const stages = (Array.isArray(this.workflow) && this.workflow.length) ? this.workflow : [
      { order: 1, stageTitle: 'إعداد وتنظيم المعاملة', roleName: 'المهندس', icon: '📝' },
      { order: 2, stageTitle: 'التدقيق الهندسي والميداني', roleName: 'رئيس القسم', icon: '🔍' },
      { order: 3, stageTitle: 'الاعتماد الفني والمصادقة النهائية', roleName: 'مدير الأشغال والخدمات الهندسية', icon: '🏛️' }
    ];

    let stepsHtml = stages.map((s, idx) => {
      const stepNum = idx + 1;
      let isDone = false;
      let isActive = false;

      if (st === 'APPROVED' || st === 'معتمد') {
        isDone = true;
      } else if (st === 'UNDER_REVIEW') {
        if (stepNum === 1) isDone = true;
        if (stepNum === 2) isActive = true;
      } else if (st === 'PENDING_DIRECTOR') {
        if (stepNum <= 2) isDone = true;
        if (stepNum >= 3 && stepNum === curIdx) isActive = true;
      } else if (st === 'RETURNED') {
        if (stepNum === 1) isActive = true;
      } else { // DRAFT
        if (stepNum === 1) isActive = true;
      }

      let bg = 'background:var(--bg-surface); border:1px solid var(--border); opacity:0.8;';
      let statusBadge = '<span style="color:var(--text-muted); font-size:0.75rem; font-weight:600;">⏳ بانتظار الإحالة</span>';
      let badgeCircle = `<div style="width:26px; height:26px; border-radius:50%; background:var(--bg-card); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.82rem; color:var(--text-muted);">${stepNum}</div>`;

      if (isDone) {
        bg = 'background:rgba(16,185,129,0.12); border:1.5px solid #10b981; opacity:1;';
        statusBadge = '<span style="color:#10b981; font-weight:800; font-size:0.76rem;">✓ معتمد ومكتمل أصولاً</span>';
        badgeCircle = `<div style="width:26px; height:26px; border-radius:50%; background:#10b981; color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.82rem;">✓</div>`;
      } else if (isActive) {
        bg = 'background:rgba(245,158,11,0.15); border:2px solid #f59e0b; opacity:1; box-shadow:0 2px 10px rgba(245,158,11,0.2);';
        statusBadge = '<span style="color:#f59e0b; font-weight:800; font-size:0.76rem;">● المرحلة الحالية النشطة</span>';
        badgeCircle = `<div style="width:26px; height:26px; border-radius:50%; background:#f59e0b; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.82rem;">${stepNum}</div>`;
      }

      return `
        <div style="padding:10px 14px; border-radius:10px; ${bg} box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div style="display:flex; align-items:center; gap:8px;">
              ${badgeCircle}
              <span style="font-weight:800; font-size:0.88rem; color:var(--text);">${s.stageTitle}</span>
            </div>
            <span style="font-size:1rem;">${s.icon || '📌'}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
            المعتمد: <strong style="color:var(--text);">${s.roleName}</strong>
          </div>
          <div>${statusBadge}</div>
        </div>
      `;
    }).join('');

    ribbon.innerHTML = stepsHtml;
  }

  /* ─── تصيير أزرار مسار الاعتماد المتسلسل أسفل النافذة ──────────────── */
  _renderModalActions(approvalStatus, currentStage) {
    const bar = document.getElementById('prams-modal-actions-bar');
    if (!bar) return;

    const st = (approvalStatus || 'DRAFT').toUpperCase();
    const isNew = !this._editingId;

    const canEngineer = this._hasPerm('ENGINEER');
    const canSectionHead = this._hasPerm('SECTION_HEAD');
    const canDirector = this._hasPerm('DIRECTOR');

    let leftButtonsHtml = '';
    let rightInfoHtml = '';

    if (isNew || st === 'DRAFT' || st === 'RETURNED') {
      rightInfoHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:rgba(15,118,110,0.15); color:#0f766e; border:1px solid rgba(15,118,110,0.4); padding:4px 10px; border-radius:8px; font-size:0.78rem; font-weight:800;">
            📝 مرحلة الإعداد والتنظيم
          </span>
          <span style="font-size:0.78rem; color:var(--text-muted);">المعتمد: المهندس</span>
        </div>
      `;
      leftButtonsHtml = `
        <button type="button" class="btn btn-outline" style="padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager.closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-secondary" style="padding:8px 18px; font-weight:800; background:var(--bg-card); color:var(--text); border:1px solid var(--border);" onclick="document.getElementById('prams-form-approval-status').value='DRAFT';">
          💾 حفظ كمسودة
        </button>
        <button type="submit" class="btn btn-primary" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border:none; padding:8px 20px; font-weight:800; box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="document.getElementById('prams-form-approval-status').value='UNDER_REVIEW'; document.getElementById('prams-form-current-stage').value='2';">
          🚀 إرسال إلى رئيس القسم للتدقيق
        </button>
      `;
    } else if (st === 'UNDER_REVIEW') {
      rightInfoHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); padding:4px 10px; border-radius:8px; font-size:0.78rem; font-weight:800;">
            🔍 مرحلة التدقيق الهندسي والميداني
          </span>
          <span style="font-size:0.78rem; color:var(--text-muted);">المعتمد: رئيس القسم</span>
        </div>
      `;
      const approveBtn = canSectionHead
        ? `<button type="button" class="btn btn-primary" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border:none; padding:8px 20px; font-weight:800; box-shadow:0 4px 12px rgba(2,132,199,0.3);" onclick="pavingReturnsManager._advanceWorkflow('REVIEW_APPROVE')">
             🔍 تدقيق وموافقة رئيس القسم ⬅️ إحالة لمدير الأشغال
           </button>`
        : `<button type="button" class="btn btn-primary" disabled style="background:#64748b; border:none; padding:8px 20px; font-weight:800; opacity:0.6; cursor:not-allowed;" title="يتطلب تسجيل الدخول بصلاحية رئيس القسم">
             🔒 تدقيق وموافقة رئيس القسم (غير مصرح)
           </button>`;

      leftButtonsHtml = `
        <button type="button" class="btn btn-outline" style="padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager.closeModal()">إغلاق</button>
        <button type="button" class="btn btn-outline" style="border-color:#ef4444; color:#ef4444; padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager._advanceWorkflow('REJECT_RETURN')">
          ↩️ إعادة للتعديل
        </button>
        ${approveBtn}
      `;
    } else if (st === 'PENDING_DIRECTOR') {
      rightInfoHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:rgba(6,182,212,0.15); color:#06b6d4; border:1px solid rgba(6,182,212,0.4); padding:4px 10px; border-radius:8px; font-size:0.78rem; font-weight:800;">
            🏛️ مرحلة المصادقة والاعتماد الفني النهائي
          </span>
          <span style="font-size:0.78rem; color:var(--text-muted);">المعتمد: مدير الأشغال والخدمات الهندسية</span>
        </div>
      `;
      const finalBtn = canDirector
        ? `<button type="button" class="btn btn-primary" style="background:linear-gradient(135deg, #059669 0%, #047857 100%); border:none; padding:8px 22px; font-weight:800; box-shadow:0 4px 14px rgba(5,150,105,0.4);" onclick="pavingReturnsManager._advanceWorkflow('FINAL_APPROVE')">
             ✅ المصادقة والاعتماد النهائي والإدراج بالسجلات
           </button>`
        : `<button type="button" class="btn btn-primary" disabled style="background:#64748b; border:none; padding:8px 22px; font-weight:800; opacity:0.6; cursor:not-allowed;" title="يتطلب تسجيل الدخول بصلاحية مدير الأشغال">
             🔒 اعتماد مدير الأشغال (غير مصرح)
           </button>`;

      leftButtonsHtml = `
        <button type="button" class="btn btn-outline" style="padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager.closeModal()">إغلاق</button>
        <button type="button" class="btn btn-outline" style="border-color:#ef4444; color:#ef4444; padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager._advanceWorkflow('REJECT_RETURN')">
          ↩️ إعادة للتعديل
        </button>
        ${finalBtn}
      `;
    } else if (st === 'APPROVED' || st === 'معتمد') {
      rightInfoHtml = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981; padding:4px 10px; border-radius:8px; font-size:0.78rem; font-weight:800;">
            ✅ معتمد ومدرج بالسجلات الرسمية
          </span>
        </div>
      `;
      leftButtonsHtml = `
        <button type="button" class="btn btn-outline" style="padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager.closeModal()">إغلاق</button>
        <button type="button" class="btn btn-outline" style="padding:8px 16px; font-weight:700;" onclick="pavingReturnsManager.printNotice('${this._editingId}')">
          🖨️ طباعة سند المطالبة الرسمي
        </button>
        <button type="button" class="btn btn-primary" style="background:#0284c7; border-color:#0284c7; padding:8px 20px; font-weight:800;" onclick="pavingReturnsManager.closeModal(); pavingReturnsManager.openPaymentModal('${this._editingId}')">
          💵 تسجيل سند قبض وتحصيل
        </button>
      `;
    }

    bar.innerHTML = `<div>${rightInfoHtml}</div><div style="display:flex; gap:8px; align-items:center;">${leftButtonsHtml}</div>`;
  }

  /* ─── تمرير وترقية المعاملة عبر مسار وسلسلة الاعتمادات ─────────────── */
  async _advanceWorkflow(action) {
    if (!this._editingId) {
      if (typeof showToast === 'function') showToast('يرجى حفظ المعاملة أولاً قبل تمريرها للاعتماد', 'warning');
      return;
    }
    let notes = '';
    if (action === 'REJECT_RETURN') {
      notes = prompt('يرجى كتابة سبب الإعادة والملاحظات الفنية للتعديل:', 'يرجى مراجعة وتدقيق أطوال الواجهات');
      if (notes === null) return;
    }

    try {
      // حفظ التعديلات في الحقول قبل ترقية المرحلة
      const tenderId = document.getElementById('prams-form-tender-id')?.value;
      if (tenderId) {
        await fetch('/api/paving-returns', {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: JSON.stringify({
            id: this._editingId,
            tenderId,
            district: document.getElementById('prams-form-district')?.value.trim(),
            streetName: document.getElementById('prams-form-street-name')?.value.trim(),
            notes: document.getElementById('prams-form-notes')?.value.trim(),
            lat: parseFloat(document.getElementById('prams-form-lat')?.value) || 32.3301,
            lng: parseFloat(document.getElementById('prams-form-lng')?.value) || 35.7501,
            pieces: this._modalPieces
          })
        });
      }

      const res = await fetch(`/api/paving-returns/${this._editingId}/advance-approval`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify({
          action,
          notes,
          approverName: (this.currentUser && this.currentUser.name) || 'المعتمد',
          approverRole: (this.currentUser && this.currentUser.role) || 'admin'
        })
      });
      const json = await res.json();
      if (json.success) {
        if (typeof showToast === 'function') showToast(json.message || 'تم تحديث مسار وسلسلة الاعتماد بنجاح ✅', 'success');
        this.closeModal();
        await this._loadData();
      } else {
        if (typeof showToast === 'function') showToast('فشل التحديث: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch (err) { console.error('Workflow error:', err); }
  }

  /* ─── تهيئة خريطة العرض الرئيسية GIS ──────────────────────────────── */
  _initMainMap() {
    const el = document.getElementById('prams-main-map');
    if (!el || typeof L === 'undefined') return;

    try {
      if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
        this.map = UnifiedGisEngine.createMap(el, [32.2985, 35.7050], 14);
      } else {
        this.map = createUnifiedMap(el, [32.2985, 35.7050], 14);
      }
    } catch (e) {
      console.warn('GIS Map init notice:', e);
    }
  }

  /* ─── جلب البيانات من PostgreSQL والعطاءات ─────────────────────────── */
  async _loadData() {
    try {
      // 1. جلب العطاءات
      const tenderRes = await fetch('/api/tenders', { headers: this._getAuthHeaders() });
      if (tenderRes.ok) {
        const tenderJson = await tenderRes.json();
        this.tendersList = Array.isArray(tenderJson) ? tenderJson : (tenderJson.data || []);
        this._populateTenderSelects();
      }

      // 2. جلب سجلات عوائد التعبيد
      const res = await fetch('/api/paving-returns', { headers: this._getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        this.activeData = Array.isArray(json) ? json : (json.data || []);
      } else {
        this.activeData = [];
      }
    } catch (err) {
      console.error('Error loading paving returns:', err);
      this.activeData = [];
    }

    this._render();
  }

  _populateTenderSelects() {
    const filterSelect = document.getElementById('prams-filter-tender');
    const formSelect = document.getElementById('prams-form-tender-id');

    if (filterSelect) {
      const cur = filterSelect.value || 'all';
      let html = '<option value="all">🌐 كافة العطاءات (السجل الشامل)</option>';
      this.tendersList.forEach(t => {
        html += `<option value="${t.id}">📋 ${t.id} - ${t.name} (${t.contractor || 'بدون مقاول'})</option>`;
      });
      filterSelect.innerHTML = html;
      filterSelect.value = cur;
    }

    if (formSelect) {
      const cur = formSelect.value || '';
      let html = '<option value="">-- اختر العطاء المرتبط بالشارع --</option>';
      this.tendersList.forEach(t => {
        html += `<option value="${t.id}">📋 ${t.id} - ${t.name} (${t.contractor || 'بدون مقاول'})</option>`;
      });
      formSelect.innerHTML = html;
      formSelect.value = cur;
    }
  }

  /* ─── التصفية والتصيير ─────────────────────────────────────────────── */
  _render() {
    const filtered = this.activeData.filter(item => {
      if (this.selectedTenderId !== 'all' && String(item.tender_id) !== String(this.selectedTenderId)) return false;
      if (this._filterStatus !== 'ALL') {
        const st = (item.payment_status || 'UNPAID').toUpperCase();
        if (st !== this._filterStatus) return false;
      }
      if (this._filterApproval && this._filterApproval !== 'ALL') {
        const appSt = (item.approval_status || 'DRAFT').toUpperCase();
        if (appSt !== this._filterApproval) return false;
      }
      if (this._filterDistrict && !String(item.district || '').toLowerCase().includes(this._filterDistrict)) return false;
      if (this._searchQuery) {
        const str = `${item.id} ${item.owner_name} ${item.piece_number} ${item.basin_number} ${item.district} ${item.street_name} ${item.receipt_number || ''} ${item.approval_status || ''}`.toLowerCase();
        if (!str.includes(this._searchQuery)) return false;
      }
      return true;
    });

    this._updateKPIs(filtered);
    this._renderTable(filtered);
    this._updateMainMap(filtered);
  }

  /* ─── تحديث مؤشرات الأداء 4 KPIs ─────────────────────────────────── */
  _updateKPIs(data) {
    const count = data.length;
    let totalLen = 0;
    let totalReq = 0;
    let totalPaid = 0;

    data.forEach(d => {
      totalLen += parseFloat(d.frontage_length || 0);
      totalReq += parseFloat(d.required_amount || 0);
      totalPaid += parseFloat(d.paid_amount || 0);
    });

    const balance = Math.max(0, totalReq - totalPaid);

    const elCount = document.getElementById('prams-kpi-count');
    const elLen = document.getElementById('prams-kpi-length');
    const elReq = document.getElementById('prams-kpi-required');
    const elPaid = document.getElementById('prams-kpi-paid');
    const elBal = document.getElementById('prams-kpi-balance');

    if (elCount) elCount.textContent = count;
    if (elLen) elLen.textContent = totalLen.toFixed(1) + ' م';
    if (elReq) elReq.textContent = totalReq.toFixed(3) + ' د.أ';
    if (elPaid) elPaid.textContent = totalPaid.toFixed(3) + ' د.أ';
    if (elBal) elBal.textContent = balance.toFixed(3) + ' د.أ';

    // Footer
    const footLen = document.getElementById('prams-foot-length');
    const footReq = document.getElementById('prams-foot-required');
    const footPaid = document.getElementById('prams-foot-paid');
    const footBal = document.getElementById('prams-foot-balance');
    if (footLen) footLen.textContent = totalLen.toFixed(2) + ' م';
    if (footReq) footReq.textContent = totalReq.toFixed(3) + ' د.أ';
    if (footPaid) footPaid.textContent = totalPaid.toFixed(3) + ' د.أ';
    if (footBal) footBal.textContent = balance.toFixed(3) + ' د.أ';
  }

  /* ─── تصيير جدول السجلات ───────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('prams-table-body');
    const tfoot = document.getElementById('prams-table-foot');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; padding:40px; color:var(--text-muted, #64748b);">
            لا توجد سجلات عوائد تعبيد مطابقة للبحث أو التصفية الحالية.
          </td>
        </tr>
      `;
      if (tfoot) tfoot.style.display = 'none';
      this._renderPagination(0);
      return;
    }

    if (tfoot) tfoot.style.display = '';

    const start = (this._currentPage - 1) * this._pageSize;
    const pageItems = data.slice(start, start + this._pageSize);

    let html = '';
    pageItems.forEach(item => {
      const pStatus = (item.payment_status || 'UNPAID').toUpperCase();
      let statusBadge = '';
      if (pStatus === 'PAID') {
        statusBadge = '<span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981; padding:2px 6px; border-radius:10px; font-weight:700; font-size:0.72rem;">🟢 مسدد</span>';
      } else if (pStatus === 'PARTIAL') {
        statusBadge = '<span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid #f59e0b; padding:2px 6px; border-radius:10px; font-weight:700; font-size:0.72rem;">🟡 جزئي</span>';
      } else {
        statusBadge = '<span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid #ef4444; padding:2px 6px; border-radius:10px; font-weight:700; font-size:0.72rem;">🔴 غير مسدد</span>';
      }

      // مسار وسلسلة الاعتماد
      const appStatus = (item.approval_status || 'DRAFT').toUpperCase();
      let approvalBadge = '';
      const isApproved = appStatus === 'APPROVED' || appStatus === 'معتمد';

      if (isApproved) {
        approvalBadge = '<span style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid #10b981; padding:2px 6px; border-radius:10px; font-weight:800; font-size:0.72rem;">✅ معتمد بالسجلات</span>';
      } else if (appStatus === 'UNDER_REVIEW') {
        approvalBadge = '<span style="background:rgba(245,158,11,0.12); color:#f59e0b; border:1px solid #f59e0b; padding:2px 6px; border-radius:10px; font-weight:800; font-size:0.72rem;">⏳ تدقيق رئيس القسم</span>';
      } else if (appStatus === 'PENDING_DIRECTOR') {
        approvalBadge = '<span style="background:rgba(6,182,212,0.12); color:#06b6d4; border:1px solid #06b6d4; padding:2px 6px; border-radius:10px; font-weight:800; font-size:0.72rem;">🏛️ مصادقة المدير</span>';
      } else if (appStatus === 'RETURNED') {
        approvalBadge = '<span style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid #ef4444; padding:2px 6px; border-radius:10px; font-weight:800; font-size:0.72rem;">↩️ معادة للتعديل</span>';
      } else {
        approvalBadge = '<span style="background:rgba(148,163,184,0.12); color:#64748b; border:1px solid #94a3b8; padding:2px 6px; border-radius:10px; font-weight:700; font-size:0.72rem;">📝 مسودة تنظيم</span>';
      }

      const reqAmt = parseFloat(item.required_amount || 0);
      const paidAmt = parseFloat(item.paid_amount || 0);
      const balAmt = Math.max(0, reqAmt - paidAmt);
      const tenderTitle = item.tenderName || item.tender_id || 'عطاء تعبيد';

      // أزرار الإجراءات المرتبة بنظافة وبدون تشويه
      let actionsHtml = '';
      if (appStatus === 'DRAFT' || appStatus === 'RETURNED') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary" style="background:#0f766e; border-color:#0f766e; padding:4px 10px; font-size:0.78rem; font-weight:700;" title="إعداد وتنظيم المعاملة" onclick="pavingReturnsManager.openEditModal('${item.id}')">✏️ تنظيم</button>
          <button class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:0.78rem;" title="حذف" onclick="pavingReturnsManager.deleteRecord('${item.id}')">🗑️</button>
        `;
      } else if (appStatus === 'UNDER_REVIEW') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary" style="background:#f59e0b; border-color:#f59e0b; padding:4px 10px; font-size:0.78rem; font-weight:700; color:#fff;" title="تدقيق رئيس القسم" onclick="pavingReturnsManager.openEditModal('${item.id}')">🔍 تدقيق القسم</button>
          <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.78rem;" title="معاينة المعاملة" onclick="pavingReturnsManager.openEditModal('${item.id}')">👁️</button>
        `;
      } else if (appStatus === 'PENDING_DIRECTOR') {
        actionsHtml = `
          <button class="btn btn-sm btn-primary" style="background:#06b6d4; border-color:#06b6d4; padding:4px 10px; font-size:0.78rem; font-weight:700; color:#fff;" title="مصادقة مدير الأشغال" onclick="pavingReturnsManager.openEditModal('${item.id}')">🏛️ مصادقة المدير</button>
          <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.78rem;" title="معاينة المعاملة" onclick="pavingReturnsManager.openEditModal('${item.id}')">👁️</button>
        `;
      } else if (isApproved) {
        actionsHtml = `
          <button class="btn btn-sm btn-primary" style="background:#0284c7; border-color:#0284c7; padding:4px 10px; font-size:0.78rem; font-weight:700;" title="تسجيل سند قبض وتحصيل مالي" onclick="pavingReturnsManager.openPaymentModal('${item.id}')">💵 قبض</button>
          <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.78rem; font-weight:700;" title="طباعة سند المطالبة الرسمي" onclick="pavingReturnsManager.printNotice('${item.id}')">🖨️ سند</button>
          <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.78rem;" title="معاينة السجل" onclick="pavingReturnsManager.openEditModal('${item.id}')">👁️</button>
        `;
      }

      html += `
        <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''">
          <td style="padding:10px 12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${approvalBadge}
              ${statusBadge}
            </div>
          </td>
          <td style="padding:10px 12px; font-weight:800; color:var(--text);">${item.id}</td>
          <td style="padding:10px 12px; font-weight:700;">قطعة: <strong>${item.piece_number}</strong> | حوض: <strong>${item.basin_number}</strong></td>
          <td style="padding:10px 12px;">${item.district || '—'} <span style="color:var(--text-muted); font-size:0.78rem;">(${item.street_name || 'الشارع'})</span></td>
          <td style="padding:10px 12px; font-size:0.82rem;" title="${tenderTitle}">${tenderTitle.length > 25 ? tenderTitle.slice(0, 25) + '...' : tenderTitle}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:700;">${parseFloat(item.frontage_length || 0).toFixed(2)} م</td>
          <td style="padding:10px 12px; text-align:center; font-weight:800; color:#10b981;">${reqAmt.toFixed(3)}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:700; color:#06b6d4;">${paidAmt.toFixed(3)}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:800; color:${balAmt > 0 ? '#ef4444' : '#10b981'};">${balAmt.toFixed(3)}</td>
          <td style="padding:8px 10px; text-align:center; white-space:nowrap;">
            <div style="display:inline-flex; gap:5px; align-items:center; justify-content:center;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    this._renderPagination(data.length);
  }

  /* ─── ترقيم الصفحات ────────────────────────────────────────────────── */
  _renderPagination(totalItems) {
    const infoEl = document.getElementById('prams-pagination-info');
    const btnsEl = document.getElementById('prams-pagination-buttons');
    if (!infoEl || !btnsEl) return;

    if (totalItems === 0) {
      infoEl.textContent = 'عرض 0 من 0 سجل';
      btnsEl.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(totalItems / this._pageSize);
    const start = (this._currentPage - 1) * this._pageSize + 1;
    const end = Math.min(this._currentPage * this._pageSize, totalItems);

    infoEl.textContent = `عرض ${start} إلى ${end} من إجمالي ${totalItems} سجل`;

    let btnsHtml = '';
    if (this._currentPage > 1) {
      btnsHtml += `<button class="btn btn-sm btn-outline" onclick="pavingReturnsManager.goToPage(${this._currentPage - 1})">السابق</button>`;
    }
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this._currentPage - 1 && p <= this._currentPage + 1)) {
        const active = p === this._currentPage ? 'background:#065f46; color:white; border-color:#065f46;' : '';
        btnsHtml += `<button class="btn btn-sm btn-outline" style="${active}" onclick="pavingReturnsManager.goToPage(${p})">${p}</button>`;
      } else if (p === this._currentPage - 2 || p === this._currentPage + 2) {
        btnsHtml += `<span style="padding:4px;">...</span>`;
      }
    }
    if (this._currentPage < totalPages) {
      btnsHtml += `<button class="btn btn-sm btn-outline" onclick="pavingReturnsManager.goToPage(${this._currentPage + 1})">التالي</button>`;
    }
    btnsEl.innerHTML = btnsHtml;
  }

  goToPage(p) {
    this._currentPage = p;
    this._render();
  }

  /* ─── تحديث علامات الخريطة الرئيسية GIS ────────────────────────────── */
  _updateMainMap(data) {
    if (!this.map || typeof L === 'undefined') return;

    if (this._mapMarkersLayer) {
      this.map.removeLayer(this._mapMarkersLayer);
    }
    this._mapMarkersLayer = L.layerGroup().addTo(this.map);

    const bounds = [];
    data.forEach(item => {
      const lat = parseFloat(item.lat || 32.3301);
      const lng = parseFloat(item.lng || 35.7501);
      if (lat && lng) {
        bounds.push([lat, lng]);
        const pStatus = (item.payment_status || 'UNPAID').toUpperCase();
        let color = '#ef4444';
        if (pStatus === 'PAID') color = '#10b981';
        else if (pStatus === 'PARTIAL') color = '#f59e0b';

        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        marker.bindPopup(`
          <div style="font-family:inherit; text-align:right; font-size:0.85rem; padding:4px;" dir="rtl">
            <div style="font-weight:800; color:#10b981; margin-bottom:4px;">معاملة: ${item.id}</div>
            <div>قطعة: <strong>${item.piece_number}</strong> | حوض: <strong>${item.basin_number}</strong></div>
            <div>الحي: <strong>${item.district}</strong></div>
            <div>المبلغ المطلوب: <strong>${parseFloat(item.required_amount || 0).toFixed(3)} د.أ</strong></div>
            <div>المسدد: <strong>${parseFloat(item.paid_amount || 0).toFixed(3)} د.أ</strong></div>
            <div style="margin-top:8px; display:flex; gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="pavingReturnsManager.printNotice('${item.id}')">🖨️ طباعة سند</button>
              <button class="btn btn-sm btn-primary" onclick="pavingReturnsManager.openEditModal('${item.id}')">✏️ متابعة السلسلة</button>
            </div>
          </div>
        `);
        this._mapMarkersLayer.addLayer(marker);
      }
    });

    if (bounds.length > 0) {
      try { this.map.fitBounds(bounds, { maxZoom: 16, padding: [30, 30] }); } catch (e) {}
    }
  }

  /* ─── فتح شاشة الإضافة / التعديل المنفصلة ──────────────────────────── */
  openNewModal() {
    this._editingId = null;
    const viewList = document.getElementById('prams-view-list');
    const viewForm = document.getElementById('prams-view-form');
    if (viewList) viewList.style.display = 'none';
    if (viewForm) viewForm.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('prams-modal-title').textContent = 'إضافة معاملة وفرض عوائد تعبيد بالعطاء';
    document.getElementById('prams-form-id').value = '';
    document.getElementById('prams-form-approval-status').value = 'DRAFT';
    document.getElementById('prams-form-current-stage').value = '1';
    document.getElementById('prams-form-district').value = 'حي نخلة';
    document.getElementById('prams-form-street-name').value = '';
    document.getElementById('prams-form-notes').value = '';

    const sel = document.getElementById('prams-form-tender-id');
    if (sel) {
      if (this.selectedTenderId !== 'all') sel.value = this.selectedTenderId;
      else if (this.tendersList[0]) sel.value = this.tendersList[0].id;
    }

    this._modalPieces = [
      { pieceNumber: '1', basinNumber: '3', frontageLength: 20, pavingWidth: 6, pricePerMeter: 4.5, impositionRate: 50 }
    ];

    document.getElementById('prams-form-lat').value = (32.3301 + (Math.random() - 0.5) * 0.005).toFixed(6);
    document.getElementById('prams-form-lng').value = (35.7501 + (Math.random() - 0.5) * 0.005).toFixed(6);

    this._renderModalPieces();
    this._renderModalWorkflowRibbon('DRAFT', 1);
    this._renderModalActions('DRAFT', 1);

    setTimeout(() => this._initModalMap(), 200);
  }

  openEditModal(id) {
    const item = this.activeData.find(x => String(x.id) === String(id));
    if (!item) return;

    this._editingId = item.id;
    const viewList = document.getElementById('prams-view-list');
    const viewForm = document.getElementById('prams-view-form');
    if (viewList) viewList.style.display = 'none';
    if (viewForm) viewForm.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const appStatus = item.approval_status || 'DRAFT';
    const curStage = item.current_stage || 1;

    document.getElementById('prams-modal-title').textContent = `معاملة وفرض عوائد التعبيد: ${item.id}`;
    document.getElementById('prams-form-id').value = item.id;
    document.getElementById('prams-form-approval-status').value = appStatus;
    document.getElementById('prams-form-current-stage').value = curStage;
    document.getElementById('prams-form-district').value = item.district || '';
    document.getElementById('prams-form-street-name').value = item.street_name || '';
    document.getElementById('prams-form-notes').value = item.notes || '';

    const sel = document.getElementById('prams-form-tender-id');
    if (sel) sel.value = item.tender_id || '';

    if (Array.isArray(item.pieces) && item.pieces.length > 0) {
      this._modalPieces = JSON.parse(JSON.stringify(item.pieces)).map(p => {
        const r = this._parseNumber(p.impositionRate, 50);
        return {
          ...p,
          impositionRate: (r > 0 && r <= 1) ? (r * 100) : r
        };
      });
    } else {
      const dbRate = this._parseNumber(item.imposition_rate, 0.5);
      const displayRate = (dbRate > 0 && dbRate <= 1) ? (dbRate * 100) : dbRate;
      this._modalPieces = [{
        pieceNumber: item.piece_number || '1',
        basinNumber: item.basin_number || '1',
        frontageLength: parseFloat(item.frontage_length || 0),
        pavingWidth: parseFloat(item.paving_width || 6),
        pricePerMeter: parseFloat(item.price_per_meter || 4.5),
        impositionRate: displayRate
      }];
    }

    document.getElementById('prams-form-lat').value = parseFloat(item.lat || 32.3301).toFixed(6);
    document.getElementById('prams-form-lng').value = parseFloat(item.lng || 35.7501).toFixed(6);

    this._renderModalPieces();
    this._renderModalWorkflowRibbon(appStatus, curStage);
    this._renderModalActions(appStatus, curStage);

    setTimeout(() => this._initModalMap(), 200);
  }

  closeModal() {
    const viewList = document.getElementById('prams-view-list');
    const viewForm = document.getElementById('prams-view-form');
    if (viewForm) viewForm.style.display = 'none';
    if (viewList) viewList.style.display = 'block';
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 150);
  }

  /* ─── محول الأرقام الآمن (يدعم الأرقام العربية/الإنجليزية والفاصلة) ── */
  _parseNumber(val, defaultVal = 0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    let s = String(val).trim();
    // Convert Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard (0-9)
    s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    // Convert Persian numerals (۰۱۲۳۴۵۶۷۸۹) to standard (0-9)
    s = s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    // Replace comma and Arabic decimal separator (، , ٫) with dot
    s = s.replace(/[,،٫]/g, '.');
    const num = parseFloat(s);
    return isNaN(num) ? defaultVal : num;
  }

  /* ─── إدارة وتصيير قطع المعاملة في الشاشة ──────────────────────────── */
  _renderModalPieces() {
    const tbody = document.getElementById('prams-pieces-tbody');
    if (!tbody) return;

    let html = '';

    this._modalPieces.forEach((p, idx) => {
      const len = this._parseNumber(p.frontageLength, 0);
      const wid = this._parseNumber(p.pavingWidth, 6);
      const prc = this._parseNumber(p.pricePerMeter, 4.5);
      let rawRat = p.impositionRate !== undefined ? p.impositionRate : 50;
      let ratVal = this._parseNumber(rawRat, 50);
      let effectiveRat = (ratVal > 0 && ratVal <= 1) ? ratVal : (ratVal / 100);
      let displayRat = (typeof rawRat === 'number' && rawRat > 0 && rawRat <= 1) ? (rawRat * 100) : rawRat;
      const amt = len * wid * prc * effectiveRat;

      html += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px 4px;">
            <input type="text" class="form-control" value="${p.pieceNumber || ''}" placeholder="القطعة" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:0.84rem; font-weight:700;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'pieceNumber', this.value)">
          </td>
          <td style="padding:6px 4px;">
            <input type="text" class="form-control" value="${p.basinNumber || ''}" placeholder="الحوض" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:0.84rem; font-weight:700;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'basinNumber', this.value)">
          </td>
          <td style="padding:6px 4px;">
            <input type="text" inputmode="decimal" class="form-control" value="${p.frontageLength !== undefined ? p.frontageLength : len}" placeholder="0.00" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:0.84rem; font-weight:700; color:#3b82f6 !important;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'frontageLength', this.value)">
          </td>
          <td style="padding:6px 4px;">
            <input type="text" inputmode="decimal" class="form-control" value="${p.pavingWidth !== undefined ? p.pavingWidth : wid}" placeholder="6.00" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:0.84rem; font-weight:700;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'pavingWidth', this.value)">
          </td>
          <td style="padding:6px 4px;">
            <input type="text" inputmode="decimal" class="form-control" value="${p.pricePerMeter !== undefined ? p.pricePerMeter : prc}" placeholder="4.50" style="width:100%; box-sizing:border-box; padding:6px 8px; font-size:0.84rem; font-weight:700;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'pricePerMeter', this.value)">
          </td>
          <td style="padding:6px 4px;">
            <div style="position:relative; display:flex; align-items:center; width:100%;">
              <input type="text" inputmode="decimal" class="form-control" value="${displayRat}" placeholder="50" style="width:100%; box-sizing:border-box; padding:6px 20px 6px 6px; font-size:0.84rem; font-weight:700; text-align:center;" oninput="pavingReturnsManager._onPieceInput(${idx}, 'impositionRate', this.value)" title="نسبة الفرض المئوية (مثال: 50 أو 100 أو 25)">
              <span style="position:absolute; left:6px; font-size:0.75rem; color:var(--text-muted); font-weight:bold; pointer-events:none;">%</span>
            </div>
          </td>
          <td style="padding:6px 4px; font-weight:800; color:#10b981; font-size:0.95rem; vertical-align:middle; text-align:center;">
            <span id="prams-piece-amt-${idx}">${amt.toFixed(3)}</span>
          </td>
          <td style="padding:6px 4px; text-align:center; vertical-align:middle;">
            ${this._modalPieces.length > 1 ? `<button type="button" class="btn btn-sm btn-outline" style="border-color:#ef4444; color:#ef4444; padding:3px 6px; font-weight:800;" onclick="pavingReturnsManager._removePieceRow(${idx})">✕</button>` : '—'}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    this._recalculateModalTotals();
  }

  _onPieceInput(idx, field, val) {
    if (this._modalPieces[idx]) {
      this._modalPieces[idx][field] = val;
      this._recalculateModalTotals();
    }
  }

  _recalculateModalTotals() {
    let totalAmt = 0;
    let totalLen = 0;

    this._modalPieces.forEach((p, idx) => {
      const len = this._parseNumber(p.frontageLength, 0);
      const wid = this._parseNumber(p.pavingWidth, 6);
      const prc = this._parseNumber(p.pricePerMeter, 4.5);
      let ratVal = this._parseNumber(p.impositionRate, 50);
      let effectiveRate = (ratVal > 0 && ratVal <= 1) ? ratVal : (ratVal / 100);
      const amt = len * wid * prc * effectiveRate;

      totalAmt += amt;
      totalLen += len;

      const amtEl = document.getElementById(`prams-piece-amt-${idx}`);
      if (amtEl) amtEl.textContent = amt.toFixed(3);
    });

    const elTotal = document.getElementById('prams-modal-total-amount');
    const elWords = document.getElementById('prams-modal-amount-words');
    if (elTotal) elTotal.textContent = totalAmt.toFixed(3) + ' د.أ';
    if (elWords) elWords.textContent = this._numberToArabicWords(totalAmt);

    const sumCount = document.getElementById('prams-modal-summary-count');
    const sumLen = document.getElementById('prams-modal-summary-length');
    const sumAmt = document.getElementById('prams-modal-summary-amount');
    if (sumCount) sumCount.textContent = this._modalPieces.length + ' قطعة';
    if (sumLen) sumLen.textContent = totalLen.toFixed(2) + ' م';
    if (sumAmt) sumAmt.textContent = totalAmt.toFixed(3) + ' د.أ';
  }

  _addPieceRow() {
    this._modalPieces.push({
      pieceNumber: '',
      basinNumber: this._modalPieces[0]?.basinNumber || '',
      frontageLength: 15,
      pavingWidth: this._modalPieces[0]?.pavingWidth || 6,
      pricePerMeter: this._modalPieces[0]?.pricePerMeter || 4.5,
      impositionRate: this._modalPieces[0]?.impositionRate || 50
    });
    this._renderModalPieces();
  }

  _removePieceRow(idx) {
    if (this._modalPieces.length > 1) {
      this._modalPieces.splice(idx, 1);
      this._renderModalPieces();
    }
  }

  _updatePiece(idx, field, val) {
    this._onPieceInput(idx, field, val);
  }

  /* ─── تهيئة الخريطة المصغرة داخل النافذة ───────────────────────────── */
  _initModalMap() {
    const el = document.getElementById('prams-modal-map');
    if (!el || typeof L === 'undefined') return;

    const lat = parseFloat(document.getElementById('prams-form-lat').value) || 32.2985;
    const lng = parseFloat(document.getElementById('prams-form-lng').value) || 35.7050;

    if (!this.modalMap) {
      if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
        this.modalMap = UnifiedGisEngine.createMap(el, [lat, lng], 16);
      } else {
        this.modalMap = createUnifiedMap(el, [lat, lng], 16);
      }

      this.modalMarker = L.marker([lat, lng], { draggable: true }).addTo(this.modalMap);

      this.modalMarker.on('dragend', () => {
        const pos = this.modalMarker.getLatLng();
        document.getElementById('prams-form-lat').value = pos.lat.toFixed(6);
        document.getElementById('prams-form-lng').value = pos.lng.toFixed(6);
      });

      this.modalMap.on('click', e => {
        this.modalMarker.setLatLng(e.latlng);
        document.getElementById('prams-form-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('prams-form-lng').value = e.latlng.lng.toFixed(6);
      });
    } else {
      this.modalMap.invalidateSize();
      this.modalMap.setView([lat, lng], 16);
      this.modalMarker.setLatLng([lat, lng]);
    }
  }

  _onManualCoordChange() {
    const lat = parseFloat(document.getElementById('prams-form-lat').value);
    const lng = parseFloat(document.getElementById('prams-form-lng').value);
    if (!isNaN(lat) && !isNaN(lng) && this.modalMarker && this.modalMap) {
      this.modalMarker.setLatLng([lat, lng]);
      this.modalMap.setView([lat, lng], this.modalMap.getZoom());
    }
  }

  _locateGPS() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        document.getElementById('prams-form-lat').value = lat;
        document.getElementById('prams-form-lng').value = lng;
        this._onManualCoordChange();
        if (typeof showToast === 'function') showToast('تم تحديد موقعك بدقة 📍', 'success');
      }, () => {
        if (typeof showToast === 'function') showToast('تعذر جلب موقع GPS', 'warning');
      });
    }
  }

  /* ─── حفظ المعاملة في PostgreSQL ───────────────────────────────────── */
  async _onFormSubmit(e) {
    e.preventDefault();

    const idVal = document.getElementById('prams-form-id').value;
    const approvalStatus = document.getElementById('prams-form-approval-status').value || 'DRAFT';
    const currentStage = parseInt(document.getElementById('prams-form-current-stage').value || 1, 10);
    const tenderId = document.getElementById('prams-form-tender-id').value;
    const district = document.getElementById('prams-form-district').value.trim();
    const streetName = document.getElementById('prams-form-street-name').value.trim();
    const notes = document.getElementById('prams-form-notes').value.trim();
    const lat = this._parseNumber(document.getElementById('prams-form-lat').value, 32.3301);
    const lng = this._parseNumber(document.getElementById('prams-form-lng').value, 35.7501);

    if (!tenderId) {
      if (typeof showToast === 'function') showToast('يرجى اختيار العطاء المرتبط', 'warning');
      return;
    }

    const sanitizedPieces = (this._modalPieces || []).map(p => ({
      pieceNumber: String(p.pieceNumber || '').trim(),
      basinNumber: String(p.basinNumber || '').trim(),
      frontageLength: this._parseNumber(p.frontageLength, 0),
      pavingWidth: this._parseNumber(p.pavingWidth, 6),
      pricePerMeter: this._parseNumber(p.pricePerMeter, 4.5),
      impositionRate: this._parseNumber(p.impositionRate, 0.5)
    }));

    if (sanitizedPieces.length === 0) {
      if (typeof showToast === 'function') showToast('يرجى إضافة قطعة واحدة على الأقل', 'warning');
      return;
    }

    const payload = {
      id: idVal || undefined,
      tenderId,
      district,
      streetName,
      notes,
      lat,
      lng,
      pieces: sanitizedPieces,
      approvalStatus,
      currentStage
    };

    try {
      const res = await fetch('/api/paving-returns', {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        if (typeof showToast === 'function') showToast('تم حفظ معاملة عوائد التعبيد بنجاح في قاعدة البيانات ✅', 'success');
        this.closeModal();
        await this._loadData();
      } else {
        if (typeof showToast === 'function') showToast('خطأ في الحفظ: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch (err) {
      console.error('Save error:', err);
      if (typeof showToast === 'function') showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
  }

  /* ─── حذف سجل من PostgreSQL ────────────────────────────────────────── */
  async deleteRecord(id) {
    if (!confirm(`هل أنت متأكد من حذف معاملة عوائد التعبيد رقم ${id}؟ لا يمكن التراجع عن هذه العملية.`)) return;

    try {
      const res = await fetch(`/api/paving-returns/${id}`, {
        method: 'DELETE',
        headers: this._getAuthHeaders()
      });
      const json = await res.json();
      if (json.success) {
        if (typeof showToast === 'function') showToast('تم حذف السجل بنجاح 🗑️', 'success');
        await this._loadData();
      } else {
        if (typeof showToast === 'function') showToast('فشل الحذف: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  /* ─── نافذة سند القبض والتحصيل ──────────────────────────────────────── */
  openPaymentModal(id) {
    const item = this.activeData.find(x => String(x.id) === String(id));
    if (!item) return;

    this._collectingId = item.id;
    const reqAmt = parseFloat(item.required_amount || 0);
    const paidAmt = parseFloat(item.paid_amount || 0);
    const balance = Math.max(0, reqAmt - paidAmt);

    document.getElementById('prams-pay-id').value = item.id;
    document.getElementById('prams-pay-amount').value = balance > 0 ? balance.toFixed(3) : '0.000';
    document.getElementById('prams-pay-receipt').value = `REC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    document.getElementById('prams-pay-date').value = new Date().toISOString().split('T')[0];

    document.getElementById('prams-pay-summary').innerHTML = `
      <div style="font-weight:800; color:#0369a1; margin-bottom:4px;">معاملة: ${item.id} — ${item.owner_name}</div>
      <div>المبلغ المفروض: <strong>${reqAmt.toFixed(3)} د.أ</strong> | المسدد سابقاً: <strong>${paidAmt.toFixed(3)} د.أ</strong></div>
      <div style="margin-top:4px; font-weight:800; color:${balance > 0 ? '#b91c1c' : '#10b981'};">
        الرصيد المتبقي المستحق: ${balance.toFixed(3)} د.أ
      </div>
    `;

    document.getElementById('prams-payment-modal').style.display = 'flex';
  }

  closePaymentModal() {
    document.getElementById('prams-payment-modal').style.display = 'none';
  }

  async _onPaymentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prams-pay-id').value;
    const paidAmount = parseFloat(document.getElementById('prams-pay-amount').value) || 0;
    const receiptNumber = document.getElementById('prams-pay-receipt').value.trim();
    const paymentDate = document.getElementById('prams-pay-date').value;

    try {
      const res = await fetch(`/api/paving-returns/${id}/payment`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify({ paidAmount, receiptNumber, paymentDate })
      });
      const json = await res.json();
      if (json.success) {
        if (typeof showToast === 'function') showToast('تم قيد سند القبض بنجاح في السجل المالي 💵', 'success');
        this.closePaymentModal();
        await this._loadData();
      } else {
        if (typeof showToast === 'function') showToast('فشل قيد السند: ' + (json.error || 'حدث خطأ'), 'error');
      }
    } catch (err) {
      console.error('Payment submit error:', err);
    }
  }

  /* ─── إصدار وطباعة سند المطالبة الرسمي عبر printEngine ──────────────── */
  printNotice(id) {
    const item = this.activeData.find(x => String(x.id) === String(id));
    if (!item) return;

    const reqAmt = parseFloat(item.required_amount || 0);
    const paidAmt = parseFloat(item.paid_amount || 0);
    const balAmt = Math.max(0, reqAmt - paidAmt);
    const tenderTitle = item.tenderName || item.tender_id || 'عطاء تعبيد الشوارع العامة';

    let piecesRowsHtml = '';
    const pieces = Array.isArray(item.pieces) && item.pieces.length ? item.pieces : [{
      pieceNumber: item.piece_number,
      basinNumber: item.basin_number,
      frontageLength: item.frontage_length,
      pavingWidth: item.paving_width,
      pricePerMeter: item.price_per_meter,
      impositionRate: item.imposition_rate,
      requiredAmount: item.required_amount
    }];

    pieces.forEach((p, i) => {
      piecesRowsHtml += `
        <tr style="border-bottom:1px solid #cbd5e1;">
          <td style="padding:6px; text-align:center;">${i + 1}</td>
          <td style="padding:6px; text-align:center; font-weight:bold;">${p.pieceNumber || '—'}</td>
          <td style="padding:6px; text-align:center;">${p.basinNumber || '—'}</td>
          <td style="padding:6px; text-align:center;">${parseFloat(p.frontageLength || 0).toFixed(2)} م</td>
          <td style="padding:6px; text-align:center;">${parseFloat(p.pavingWidth || 6).toFixed(2)} م</td>
          <td style="padding:6px; text-align:center;">${parseFloat(p.pricePerMeter || 4.5).toFixed(2)} د.أ</td>
          <td style="padding:6px; text-align:center;">${((parseFloat(p.impositionRate || 0.5) <= 1 ? parseFloat(p.impositionRate || 0.5) * 100 : parseFloat(p.impositionRate || 0.5))).toFixed(0)}%</td>
          <td style="padding:6px; text-align:center; font-weight:bold;">${parseFloat(p.requiredAmount || 0).toFixed(3)} د.أ</td>
        </tr>
      `;
    });

    const contentHtml = `
      <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#1e293b; line-height:1.4;" dir="rtl">

        <!-- جدول بيانات الموقع والعطاء والمعاملة -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.84rem; border:1px solid #cbd5e1;">
          <tr style="background:#f8fafc;">
            <td style="padding:7px 10px; font-weight:bold; width:20%; border:1px solid #cbd5e1;">رقم المعاملة:</td>
            <td style="padding:7px 10px; width:30%; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e;">${item.id}</td>
            <td style="padding:7px 10px; font-weight:bold; width:20%; border:1px solid #cbd5e1;">الحي / المنطقة:</td>
            <td style="padding:7px 10px; width:30%; border:1px solid #cbd5e1;">${item.district || 'كفرنجة'}</td>
          </tr>
          <tr>
            <td style="padding:7px 10px; font-weight:bold; border:1px solid #cbd5e1;">اسم الشارع / الموقع:</td>
            <td style="padding:7px 10px; border:1px solid #cbd5e1;">${item.street_name || 'الشارع العام'}</td>
            <td style="padding:7px 10px; font-weight:bold; border:1px solid #cbd5e1;">العطاء المرتبط:</td>
            <td style="padding:7px 10px; border:1px solid #cbd5e1; font-weight:600;">${tenderTitle}</td>
          </tr>
        </table>

        <!-- تفاصيل القطع الخاضعة للتحقق -->
        <div style="font-weight:bold; font-size:0.85rem; margin-bottom:6px; color:#0f766e;">📍 تفاصيل القطع والواجهات المحتسبة:</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.8rem; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#0f766e; color:white;">
              <th style="padding:6px;">م</th>
              <th style="padding:6px;">رقم القطعة</th>
              <th style="padding:6px;">رقم الحوض</th>
              <th style="padding:6px;">طول الواجهة</th>
              <th style="padding:6px;">عرض التعبيد</th>
              <th style="padding:6px;">سعر المتر</th>
              <th style="padding:6px;">نسبة التحقق</th>
              <th style="padding:6px;">المبلغ المستحق</th>
            </tr>
          </thead>
          <tbody>
            ${piecesRowsHtml}
          </tbody>
        </table>

        <!-- الملخص المالي والتفقيط -->
        <div style="border:1.5px solid #0f766e; border-radius:6px; padding:10px 16px; background:#f0fdf4; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.78rem; color:#64748b;">المبلغ المطلوب كتابةً:</div>
            <div style="font-size:0.92rem; font-weight:bold; color:#065f46;">${this._numberToArabicWords(reqAmt)}</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:0.78rem; color:#64748b;">المجموع الإجمالي:</div>
            <div style="font-size:1.25rem; font-weight:800; color:#065f46;">${reqAmt.toFixed(3)} د.أ</div>
          </div>
        </div>

      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: `عوائد وتحققات التعبيد`,
        subtitle: `بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية`,
        documentType: 'PAYMENT_NOTICE',
        sectionName: 'رئيس القسم',
        referenceNumber: item.id,
        showApprovalChain: false,
        contentHtml
      });
    } else {
      window.print();
    }
  }

  /* ─── طباعة كشف عوائد التعبيد الإجمالي بالعطاء ─────────────────────── */
  printSummaryReport() {
    const tenderTitle = this.selectedTenderId === 'all' ? 'كافة عطاءات ومشاريع البلدية' : `عطاء رقم ${this.selectedTenderId}`;
    const filtered = this.activeData.filter(item => {
      if (this.selectedTenderId !== 'all' && String(item.tender_id) !== String(this.selectedTenderId)) return false;
      return true;
    });

    let rowsHtml = '';
    let totReq = 0;
    let totPaid = 0;
    let totLen = 0;

    filtered.forEach((item, idx) => {
      const r = parseFloat(item.required_amount || 0);
      const p = parseFloat(item.paid_amount || 0);
      const l = parseFloat(item.frontage_length || 0);
      totReq += r;
      totPaid += p;
      totLen += l;

      rowsHtml += `
        <tr style="border-bottom:1px solid #cbd5e1; font-size:0.85rem;">
          <td style="padding:6px; text-align:center;">${idx + 1}</td>
          <td style="padding:6px; font-weight:bold;">${item.id}</td>
          <td style="padding:6px; text-align:center; font-weight:bold;">${item.piece_number} / ${item.basin_number}</td>
          <td style="padding:6px;">${item.district} <span style="font-size:0.75rem; color:#64748b;">(${item.street_name || 'الشارع'})</span></td>
          <td style="padding:6px; text-align:center;">${l.toFixed(2)} م</td>
          <td style="padding:6px; text-align:center; font-weight:bold;">${r.toFixed(3)}</td>
          <td style="padding:6px; text-align:center; color:#0369a1;">${p.toFixed(3)}</td>
          <td style="padding:6px; text-align:center; font-weight:bold; color:${(r - p) > 0 ? '#b91c1c' : '#10b981'};">${Math.max(0, r - p).toFixed(3)}</td>
        </tr>
      `;
    });

    const contentHtml = `
      <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#1e293b;" dir="rtl">
        <div style="margin-bottom:14px; text-align:center; font-size:1.1rem; font-weight:800; color:#065f46;">
          كشف وسجل عوائد التعبيد والتحققات المالية المعتمد
        </div>
        <div style="margin-bottom:12px; font-size:0.9rem; color:#64748b; text-align:center;">
          نطاق الكشف: <strong>${tenderTitle}</strong> | تاريخ الإصدار: <strong>${new Date().toLocaleDateString('ar-JO')}</strong>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:16px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#0f766e; color:white; font-size:0.85rem;">
              <th style="padding:8px;">م</th>
              <th style="padding:8px;">رقم المعاملة</th>
              <th style="padding:8px;">القطعة / الحوض</th>
              <th style="padding:8px;">الحي / موقع الشارع</th>
              <th style="padding:8px;">الواجهة (م)</th>
              <th style="padding:8px;">المفروض (د.أ)</th>
              <th style="padding:8px;">المحصل (د.أ)</th>
              <th style="padding:8px;">المتبقي (د.أ)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot style="background:#f0fdf4; font-weight:bold; border-top:2px solid #0f766e;">
            <tr>
              <td colspan="4" style="padding:8px; text-align:right;">المجموع الإجمالي:</td>
              <td style="padding:8px; text-align:center;">${totLen.toFixed(2)} م</td>
              <td style="padding:8px; text-align:center; color:#065f46;">${totReq.toFixed(3)} د.أ</td>
              <td style="padding:8px; text-align:center; color:#0369a1;">${totPaid.toFixed(3)} د.أ</td>
              <td style="padding:8px; text-align:center; color:#b91c1c;">${(totReq - totPaid).toFixed(3)} د.أ</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title: `كشف وسجل عوائد التعبيد - ${tenderTitle}`,
        subtitle: `بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية`,
        documentType: 'SUMMARY_REPORT',
        sectionName: 'رئيس القسم',
        contentHtml
      });
    } else {
      window.print();
    }
  }

  /* ─── تصدير كشف Excel مهيكل ودقيق في الخلايا ─────────────────────── */
  exportCSV() {
    if (!this.activeData || !this.activeData.length) {
      if (typeof showToast === 'function') showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم المعاملة',
      'حالة الاعتماد',
      'حالة السداد',
      'العطاء / المشروع المرتبط',
      'الحي / المنطقة',
      'اسم الشارع وموقع التعبيد',
      'رقم القطعة',
      'رقم الحوض',
      'طول الواجهة (م)',
      'عرض التعبيد (م)',
      'سعر المتر (د.أ)',
      'نسبة الفرض (%)',
      'المبلغ المفروض (د.أ)',
      'المبلغ المسدد (د.أ)',
      'المتبقي المستحق (د.أ)',
      'رقم سند القبض',
      'ملاحظات وقرارات'
    ];

    let totalLength = 0;
    let totalReq = 0;
    let totalPaid = 0;
    let totalBal = 0;

    const rows = this.activeData.map(d => {
      const len = this._parseNumber(d.frontage_length, 0);
      const wid = this._parseNumber(d.paving_width, 6);
      const prc = this._parseNumber(d.price_per_meter, 4.5);
      const rat = this._parseNumber(d.imposition_rate, 0.5);
      const req = this._parseNumber(d.required_amount, 0);
      const paid = this._parseNumber(d.paid_amount, 0);
      const bal = Math.max(0, req - paid);

      totalLength += len;
      totalReq += req;
      totalPaid += paid;
      totalBal += bal;

      const appStatusArabic = {
        'APPROVED': 'معتمد ومدرج بالسجلات',
        'UNDER_REVIEW': 'قيد تدقيق رئيس القسم',
        'PENDING_DIRECTOR': 'بانتظار مصادقة مدير الأشغال',
        'DRAFT': 'مسودة تنظيم',
        'RETURNED': 'معادة للتعديل'
      }[d.approval_status] || d.approval_status || 'مسودة';

      const payStatusArabic = {
        'PAID': 'مسدد بالكامل',
        'PARTIAL': 'مسدد جزئياً',
        'UNPAID': 'غير مسدد'
      }[d.payment_status] || d.payment_status || 'غير مسدد';

      return [
        d.id || '',
        appStatusArabic,
        payStatusArabic,
        d.tenderName || d.tender_id || '',
        d.district || '',
        d.street_name || '',
        d.piece_number || '',
        d.basin_number || '',
        len,
        wid,
        prc,
        (rat > 1 ? rat : rat * 100).toFixed(0) + '%',
        req,
        paid,
        bal,
        d.receipt_number || '',
        d.notes || ''
      ];
    });

    const totals = [
      'الإجمالي الكلي',
      '',
      '',
      '',
      '',
      '',
      '',
      `${this.activeData.length} قطعة`,
      totalLength,
      '',
      '',
      '',
      totalReq,
      totalPaid,
      totalBal,
      '',
      ''
    ];

    if (typeof exportToExcelFile === 'function') {
      exportToExcelFile({
        filename: 'سجل_عوائد_التعبيد_والتحققات_بلدية_كفرنجة',
        title: 'سجل وكشف عوائد وتحققات التعبيد الرسمية',
        subtitle: 'مديرية الأشغال والخدمات الهندسية',
        headers,
        rows,
        totals
      });
    }
    if (typeof showToast === 'function') showToast('تم تصدير ملف Excel المنظم بنجاح 📊', 'success');
  }

  /* ─── محول الأرقام إلى كلمات عربية (تفقيط) ─────────────────────────── */
  _numberToArabicWords(num) {
    const val = this._parseNumber(num, 0);
    if (val === 0) return 'فقط صفر دينار أردني لا غير';

    const dinars = Math.floor(val);
    const fils = Math.round((val - dinars) * 1000);

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function parse999(n) {
      if (n === 0) return '';
      let res = '';
      const h = Math.floor(n / 100);
      const rem = n % 100;
      if (h > 0) {
        res += hundreds[h];
      }
      if (rem > 0) {
        if (res) res += ' و';
        if (rem < 20) {
          res += ones[rem];
        } else {
          const o = rem % 10;
          const t = Math.floor(rem / 10);
          if (o > 0) res += ones[o] + ' و' + tens[t];
          else res += tens[t];
        }
      }
      return res;
    }

    function parseScale(n) {
      if (n === 0) return 'صفر';
      let parts = [];

      // Millions
      const millions = Math.floor(n / 1000000);
      let remM = n % 1000000;
      if (millions === 1) parts.push('مليون');
      else if (millions === 2) parts.push('مليونان');
      else if (millions >= 3 && millions <= 10) parts.push(parse999(millions) + ' ملايين');
      else if (millions > 10) parts.push(parse999(millions) + ' مليوناً');

      // Thousands
      const thousands = Math.floor(remM / 1000);
      let remT = remM % 1000;
      if (thousands === 1) parts.push('ألف');
      else if (thousands === 2) parts.push('ألفان');
      else if (thousands >= 3 && thousands <= 10) parts.push(parse999(thousands) + ' آلاف');
      else if (thousands > 10) parts.push(parse999(thousands) + ' ألفاً');

      // Units
      if (remT > 0) {
        parts.push(parse999(remT));
      }

      return parts.join(' و');
    }

    let text = '';
    if (dinars > 0) {
      text = `فقط ${parseScale(dinars)} دينار أردني`;
    }
    if (fils > 0) {
      const filsText = `${parseScale(fils)} فلس`;
      if (text) {
        text += ` و${filsText}`;
      } else {
        text = `فقط ${filsText}`;
      }
    }
    return (text || 'فقط صفر دينار أردني') + ' لا غير';
  }
}

/* ─── التهيئة التلقائية للموديول ─────────────────────────────────────── */
let pavingReturnsManager = null;

function loadPavingReturns() {
  const container = document.getElementById('paving-returns-container');
  if (!container) return;
  if (!pavingReturnsManager) {
    pavingReturnsManager = new ComprehensivePavingReturnsManager('paving-returns-container');
  } else {
    pavingReturnsManager._loadData();
    if (pavingReturnsManager.map) {
      setTimeout(() => pavingReturnsManager.map.invalidateSize(), 200);
    }
  }
}

if (typeof window !== 'undefined') {
  window.loadPavingReturns = loadPavingReturns;
  window.ComprehensivePavingReturnsManager = ComprehensivePavingReturnsManager;
}
