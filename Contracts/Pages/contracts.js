/**
 * Contracts/Pages/contracts.js
 * وحدة إدارة العقود والضمانات البنكية المؤسسية (ECMS v5.0)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

(function () {
  'use strict';

  class ContractsManager {
    constructor() {
      this.container = null;
      this.activeData = [];
      this.tendersList = [];
      this.activeTab = 'REGISTRY'; // REGISTRY | GUARANTEES | ALERTS
      this.currentFilter = 'ALL';
      this.searchTerm = '';
      this.sortCol = 'id';
      this.sortAsc = false;
      this.canWrite = true;
      this.isAdmin = true;

      // البنود والشروط القانونية النموذجية المعتمدة
      this.defaultClauses = [
        {
          id: 'CLS-01',
          title: 'موضوع العقد ونطاق الأعمال',
          text: 'يلتزم الطرف الثاني (المقاول) بتنفيذ وإنجاز وصيانة كافة الأعمال المبينة في وثائق العطاء والشروط والمواصفات وجداول الكميات المعتمدة وفق الأصول الهندسية والتعليمات الصادرة عن المهندس المشرف.'
        },
        {
          id: 'CLS-02',
          title: 'وثائق ومستندات العقد',
          text: 'تعتبر الوثائق التالية جزءاً لا يتجزأ من هذا العقد وتقرأ وتفسر معه: كتاب الإحالة وقرار المجلس البلدي، الشروط العامة والخاصة، المخططات والمواصفات الفنية، جدول الكميات وفئات الأسعار المقدمة من المقاول، وكفالة حسن التنفيذ.'
        },
        {
          id: 'CLS-03',
          title: 'قيمة العقد والدفعات المالية',
          text: 'تعتبر القيمة الإجمالية للعقد خاضعة للقياس الفعلي للأعمال المنفذة على أرض الواقع وفق الأسعار الإفرادية، وتصرف الدفعات بموجب مطالبات مالية وكشوفات حصر معتمدة من مديرية الأشغال والخدمات الهندسية بعد حسم الاستقطاعات القانونية.'
        },
        {
          id: 'CLS-04',
          title: 'مدة التنفيذ وغرامات التأخير',
          text: 'يلتزم الطرف الثاني بإنجاز كافة الأعمال خلال المدة التعاقدية المحددة اعتباراً من تاريخ أمر المباشرة الخطي. وفي حال التأخر غير المبرر، تفرض غرامة تأخير يومية بنسبة (0.001) من قيمة العقد عن كل يوم تأخير بحد أقصى 10% من القيمة الإجمالية.'
        },
        {
          id: 'CLS-05',
          title: 'الكفالات والضمانات البنكية',
          text: 'يقدم المقاول قبل توقيع الاتفاقية كفالة بنكية غير مشروطة لحسن التنفيذ بنسبة 10% من قيمة العقد صادرة عن بنك مرخص في المملكة سارية المفعول حتى الاستلام الأولي للمشروع، تليها كفالة صيانة بنسبة 5% لمدة سنة كاملة.'
        },
        {
          id: 'CLS-06',
          title: 'السلامة العامة والبيئة والحراسة',
          text: 'يتحمل المقاول كامل المسؤولية المدنية والجزائية عن تأمين موقع العمل وعناصر السلامة العامة ووضع الشواخص التحذيرية والإشارات الليلية وحماية المنشآت المجاورة والمواطنين طيلة فترة التنفيذ.'
        },
        {
          id: 'CLS-07',
          title: 'القانون الواجب التطبيق وفض النزاعات',
          text: 'يخضع هذا العقد وتفسيره لكافة التشريعات والقوانين النافذة في المملكة الأردنية الهاشمية، ونظام المشتريات الحكومية وتعديلاته، وتختص محاكم المملكة الأردنية الهاشمية بالنظر في أي نزاع قد ينشأ حول تنفيذ هذا العقد.'
        }
      ];

      this._readUser();
      this._loadLocalCache();
    }

    _readUser() {
      try {
        const raw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') ||
                    localStorage.getItem('engineeringUser') || sessionStorage.getItem('engineeringUser');
        this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
      } catch { this._user = null; }
      
      if (!this._user) {
        this._user = { id: 'U-001', name: 'مدير النظام', role: 'admin', permissions: ['*'] };
      }

      this.canWrite = this._hasPermission('contracts.create');
      this.canEdit = this._hasPermission('contracts.edit');
      this.canDelete = this._hasPermission('contracts.delete');
      this.canApprove = this._hasPermission('contracts.approve');
      this.canManageGuarantees = this._hasPermission('guarantees.manage');
      this.isAdmin = (this._user?.role || '').toLowerCase() === 'admin';
    }

    _hasPermission(permKey) {
      const u = this._user || (typeof currentUser !== 'undefined' ? currentUser : null);
      const role = String(u?.role || 'admin').toLowerCase();
      if (role === 'admin' || role === 'superadmin') return true;

      if (typeof window.hasPermission === 'function') {
        if (window.hasPermission(permKey) || window.hasPermission('*')) return true;
      }

      const perms = Array.isArray(u?.permissions) ? u.permissions : [];
      if (perms.includes('*') || perms.includes(permKey)) return true;

      // قواعد الصلاحيات المعتمدة للأدوار
      if (permKey === 'contracts.delete') return role === 'admin';
      if (permKey === 'contracts.create') return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor'].includes(role);
      if (permKey === 'contracts.edit') return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor'].includes(role);
      if (permKey === 'contracts.approve') return ['admin', 'director_public_works'].includes(role);
      if (permKey === 'guarantees.manage') return ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'quantity_surveyor'].includes(role);

      return false;
    }

    _getRoleLabel(role) {
      const map = {
        'admin': 'مدير النظام (كامل الصلاحيات) 🛡️',
        'director_public_works': 'مدير الأشغال والخدمات الهندسية 🏛️',
        'head_of_roads': 'رئيس قسم الطرق 🛣️',
        'head_of_buildings': 'رئيس قسم الأبنية والإنشاءات 🏢',
        'head_of_electricity_energy': 'رئيس قسم الكهرباء والطاقة المتجددة ⚡',
        'roads_engineer': 'مهندس طرق 🚧',
        'buildings_engineer': 'مهندس أبنية وإنشاءات 🏗️',
        'electrical_engineer': 'مهندس كهرباء 💡',
        'renewable_energy_engineer': 'مهندس طاقة متجددة ☀️',
        'quantity_surveyor': 'حاسب كميات 📐',
        'site_inspector': 'مراقب 🔍',
        'electrical_works_inspector': 'مراقب أعمال كهربائية 🔌',
        'electrical_technician': 'فني كهرباء وإنارة 🛠️',
        'qa_qc_engineer': 'مهندس ضبط الجودة 🧪',
        'land_surveyor': 'مساح 🗺️'
      };
      return map[String(role || '').toLowerCase()] || role || 'مستخدم النظام';
    }

    _loadLocalCache() {
      try {
        const stored = localStorage.getItem('epams_contracts_v5');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // تصفية العينات القديمة المحددة فقط إن وجدت
            this.activeData = parsed.filter(c => {
              const title = String(c.title || '');
              return !title.includes('خلطات أسفلتية ساخنة وتعبيد الشوارع الرئيسية') &&
                     !title.includes('عطاء إنشاء جدران استنادية مسلحة');
            });
          }
        }
      } catch (e) {
        console.warn('[ECMS] Cache load error:', e);
      }
      if (!Array.isArray(this.activeData)) {
        this.activeData = [];
      }
    }

    _saveLocalCache() {
      try {
        localStorage.setItem('epams_contracts_v5', JSON.stringify(this.activeData || []));
      } catch (e) {
        console.warn('[ECMS] Cache save error:', e);
      }
    }

    _getDefaultSampleContracts() {
      return [];
    }

    _nextCode() {
      const y = new Date().getFullYear();
      let maxSeq = 0;
      const regex = new RegExp(`CNT-${y}-(\\d+)`, 'i');
      (this.activeData || []).forEach(item => {
        const code = String(item.id || item.contract_number || '');
        const match = code.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      return `CNT-${y}-${String(maxSeq + 1).padStart(3, '0')}`;
    }

    /* ─── تهيئة الواجهة الرئيسية ─────────────────────────────────────────── */
    init(container) {
      this.container = container || document.getElementById('page-contracts');
      if (!this.container) return;
      this._buildUI();
    }

    _buildUI() {
      this._readUser();
      const roleLabel = this._getRoleLabel(this._user?.role);
      const userName = this._user?.fullName || this._user?.name || 'مستخدم النظام';

      this.container.innerHTML = `
        <div id="ecm-root" style="background:var(--bg-card,#111a2e);color:var(--text,#f8fafc);padding:18px;
              border-radius:12px;direction:rtl;font-family:'Tajawal',system-ui,sans-serif;border:1px solid var(--border,rgba(255,255,255,0.1));position:relative;z-index:1;isolation:isolate;transition:background 0.3s, color 0.3s;">

          <!-- شريط العنوان والأزرار الرئيسية -->
          <div id="ecm-toolbar" style="display:flex;justify-content:space-between;align-items:center;
                flex-wrap:wrap;gap:12px;background:var(--bg-surface,#18243e);padding:14px 18px;
                border-radius:10px;border:1px solid var(--border,rgba(255,255,255,0.1));margin-bottom:16px;">
            
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="font-weight:800;color:var(--accent,#38bdf8);font-size:0.98rem;display:flex;align-items:center;gap:6px;">
                📜 وحدة إدارة العقود والضمانات البنكية (ECMS v5.0)
              </span>
              <span style="font-size:0.75rem;background:rgba(59,130,246,0.15);color:var(--primary-light,#60a5fa);padding:4px 10px;border-radius:6px;font-weight:bold;border:1px solid rgba(59,130,246,0.3);">
                👤 ${userName} (${roleLabel})
              </span>
              ${this._hasPermission('contracts.create') ? `<button id="ecm-btn-add" class="ecm-action-btn" style="background:#059669;color:#fff;padding:7px 13px;font-size:0.82rem;">➕ إنشاء / توثيق عقد جديد</button>` : ''}
              <button id="ecm-btn-print-all" class="ecm-action-btn" style="background:#6366f1;color:#fff;padding:7px 13px;font-size:0.82rem;">🖨️ طباعة السجل الرسمي</button>
              <button id="ecm-btn-export-csv" class="ecm-action-btn" style="background:#0284c7;color:#fff;padding:7px 13px;font-size:0.82rem;">📊 تصدير Excel / CSV</button>
              <button id="ecm-btn-refresh" class="ecm-action-btn" style="background:var(--bg-card-hover,#16223b);color:var(--text,#f8fafc);border:1px solid var(--border,rgba(255,255,255,0.15));padding:7px 13px;font-size:0.82rem;" title="تحديث ومزامنة">🔄 تحديث</button>
            </div>

            <!-- حقل البحث -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <input id="ecm-search-input" type="text" placeholder="🔍 بحث برقم العقد، العطاء، المقاول، أو البنك..."
                style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));
                       padding:8px 14px;border-radius:8px;font-size:0.82rem;width:270px;outline:none;" />
            </div>
          </div>

          <!-- بطاقات المؤشرات الإحصائية (KPIs) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-surface,#18243e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;text-align:center;border-right:4px solid var(--primary,#3b82f6);">
              <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">إجمالي العقود المسجلة</div>
              <div id="ecm-kpi-total" style="font-size:1.6rem;font-weight:800;color:var(--primary-light,#60a5fa);margin-top:2px;">0</div>
              <div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">عقود سارية ومؤرشفة</div>
            </div>
            <div style="background:var(--bg-surface,#18243e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;text-align:center;border-right:4px solid #0284c7;">
              <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">القيمة الإجمالية للعقود</div>
              <div id="ecm-kpi-value" style="font-size:1.4rem;font-weight:800;color:#38bdf8;margin-top:2px;">0 د.أ</div>
              <div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">إجمالي قيم الإحالات</div>
            </div>
            <div style="background:var(--bg-surface,#18243e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;text-align:center;border-right:4px solid #10b981;">
              <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🟢 عقود سارية قيد التنفيذ</div>
              <div id="ecm-kpi-active" style="font-size:1.6rem;font-weight:800;color:#34d399;margin-top:2px;">0</div>
              <div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">مشاريع قيد الإنجاز</div>
            </div>
            <div style="background:var(--bg-surface,#18243e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;text-align:center;border-right:4px solid #f59e0b;">
              <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🏦 الكفالات البنكية النشطة</div>
              <div id="ecm-kpi-guarantees" style="font-size:1.6rem;font-weight:800;color:#fbbf24;margin-top:2px;">0</div>
              <div id="ecm-kpi-guarantees-val" style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:2px;">حسن تنفيذ وصيانة</div>
            </div>
            <div style="background:var(--bg-surface,#18243e);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:10px;padding:12px;text-align:center;border-right:4px solid #ef4444;">
              <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">⚠️ تنبيهات الاستحقاق النشطة</div>
              <div id="ecm-kpi-alerts" style="font-size:1.6rem;font-weight:800;color:#f87171;margin-top:2px;">0</div>
              <div style="font-size:0.7rem;color:#f87171;margin-top:2px;font-weight:bold;">كفالات ومدد تعاقدية</div>
            </div>
          </div>

          <!-- شريط التبويبات المدمجة والفلاتر -->
          <div style="background:var(--bg-surface,#18243e);border-radius:10px;border:1px solid var(--border,rgba(255,255,255,0.1));padding:12px 16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
              
              <!-- أزرار التبويبات الرئيسية المعتمدة -->
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="ecm-tab-btn active" id="ecm-tab-registry" data-tab="REGISTRY">📁 سجل العقود الرئيسي والبنود</button>
                <button class="ecm-tab-btn" id="ecm-tab-guarantees" data-tab="GUARANTEES">🏦 إدارة الكفالات والضمانات</button>
                <button class="ecm-tab-btn" id="ecm-tab-alerts" data-tab="ALERTS">🔔 تنبيهات الاستحقاق والمدد</button>
              </div>

              <!-- فلاتر الحالة -->
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.8rem;color:var(--text-muted,#94a3b8);font-weight:600;">الحالة:</span>
                <select id="ecm-status-filter" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 12px;border-radius:6px;font-size:0.8rem;outline:none;">
                  <option value="ALL">جميع الحالات</option>
                  <option value="ACTIVE">🟢 ساري المفعول قيد التنفيذ</option>
                  <option value="PENDING">🟡 مسودة / قيد الاعتماد</option>
                  <option value="COMPLETED">🔵 مكتمل ومستلم نهائياً</option>
                  <option value="MAINTENANCE">⚠️ بانتظار فترة الصيانة</option>
                  <option value="SUSPENDED">🔴 مفسوخ / متوقف</option>
                </select>
                <span id="ecm-badge-count" style="background:rgba(59,130,246,0.15);color:var(--accent,#38bdf8);font-size:0.8rem;padding:4px 10px;border-radius:6px;font-weight:bold;border:1px solid rgba(59,130,246,0.3);">0 عقد</span>
              </div>
            </div>
          </div>

          <!-- حاوية المحتوى الديناميكي -->
          <div id="ecm-dynamic-container">
            <!-- Dynamic Table Content -->
          </div>
        </div>
      `;

      this._injectStyles();
      this._buildModal();
      this._buildClausesDrawerModal();
      this._buildWorkflowApprovalModal();
      this._buildGuaranteesModals();

      setTimeout(() => {
        this._bindEvents();
        this._fetchTenders();
        this._fetchContracts();
      }, 50);
    }

    _injectStyles() {
      if (document.getElementById('ecm-custom-styles')) return;
      const style = document.createElement('style');
      style.id = 'ecm-custom-styles';
      style.textContent = `
        /* تصميم الحاوية والجدول الفاخر ليتماشى 100% مع النمط الداكن والفاتح */
        .ecm-table-card {
          background: var(--bg-card, #111a2e);
          border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          box-shadow: var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.2));
          scrollbar-width: thin;
          scrollbar-color: var(--primary, #3b82f6) rgba(0, 0, 0, 0.1);
        }
        .ecm-table-card::-webkit-scrollbar {
          height: 6px;
        }
        .ecm-table-card::-webkit-scrollbar-thumb {
          background: var(--primary, #3b82f6);
          border-radius: 4px;
        }
        .ecm-table {
          width: 100%;
          min-width: 960px;
          text-align: right;
          font-size: 0.8rem;
          border-collapse: collapse;
          border-spacing: 0;
          direction: rtl;
          color: var(--text, #f8fafc);
        }
        .ecm-table thead th {
          background: var(--table-header-bg, #152038) !important;
          color: var(--table-header-text, #38bdf8) !important;
          font-weight: 800 !important;
          padding: 10px 8px !important;
          font-size: 0.78rem !important;
          white-space: nowrap !important;
          border-bottom: 2px solid var(--border, rgba(255, 255, 255, 0.15)) !important;
          letter-spacing: 0.2px;
        }
        .ecm-table tbody tr {
          transition: background-color 0.15s ease;
          border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          color: var(--text, #f8fafc);
        }
        .ecm-table tbody tr:hover {
          background-color: var(--bg-card-hover, rgba(56, 189, 248, 0.06)) !important;
        }
        .ecm-table tbody td {
          padding: 8px 8px;
          vertical-align: middle;
          border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
          color: var(--text, #f8fafc);
        }

        /* كود ورقم العقد */
        .ecm-id-badge {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.35);
          font-weight: 800;
          padding: 3px 6px;
          border-radius: 5px;
          font-size: 0.76rem;
          display: inline-block;
          white-space: nowrap;
        }

        /* الشارات والأزرار الحديثة المتوافقة مع النمط الداكن والفاتح */
        .ecm-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          white-space: nowrap;
        }
        .ecm-badge-pill:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .ecm-pill-emerald {
          background: rgba(16, 185, 129, 0.16) !important;
          color: #34d399 !important;
          border: 1px solid rgba(16, 185, 129, 0.35) !important;
        }
        .ecm-pill-amber {
          background: rgba(245, 158, 11, 0.16) !important;
          color: #fbbf24 !important;
          border: 1px solid rgba(245, 158, 11, 0.35) !important;
        }
        .ecm-pill-rose {
          background: rgba(239, 68, 68, 0.16) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239, 68, 68, 0.35) !important;
        }
        .ecm-pill-indigo {
          background: rgba(99, 102, 241, 0.16) !important;
          color: #a5b4fc !important;
          border: 1px solid rgba(99, 102, 241, 0.35) !important;
        }
        .ecm-pill-sky {
          background: rgba(14, 165, 233, 0.16) !important;
          color: #38bdf8 !important;
          border: 1px solid rgba(14, 165, 233, 0.35) !important;
        }
        .ecm-pill-slate {
          background: rgba(148, 163, 184, 0.12) !important;
          color: var(--text-muted, #94a3b8) !important;
          border: 1px solid var(--border, rgba(255, 255, 255, 0.15)) !important;
        }

        /* أزرار الإجراءات المصغرة */
        .ecm-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 4px 7px;
          border-radius: 5px;
          font-size: 0.72rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ecm-action-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .ecm-tab-btn {
          background: transparent;
          color: var(--text-muted, #94a3b8);
          border: 1px solid transparent;
          padding: 7px 14px;
          border-radius: 7px;
          font-size: 0.81rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ecm-tab-btn.active {
          background: var(--primary, #3b82f6) !important;
          color: #ffffff !important;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
      `;
      document.head.appendChild(style);
    }

    _bindEvents() {
      // Add Contract
      document.getElementById('ecm-btn-add')?.addEventListener('click', () => this._openModal());

      // Refresh
      document.getElementById('ecm-btn-refresh')?.addEventListener('click', () => {
        this._fetchContracts();
        this._fetchTenders();
      });

      // Export CSV
      document.getElementById('ecm-btn-export-csv')?.addEventListener('click', () => this._exportCSV());

      // Print Registry
      document.getElementById('ecm-btn-print-all')?.addEventListener('click', () => this._printRegistryReport());

      // Search Input
      document.getElementById('ecm-search-input')?.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.trim().toLowerCase();
        this._renderCurrentTab();
      });

      // Status Filter
      document.getElementById('ecm-status-filter')?.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this._renderCurrentTab();
      });

      // Tab Buttons
      const tabBtns = document.querySelectorAll('.ecm-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTab = btn.getAttribute('data-tab');
          this._renderCurrentTab();
        });
      });
    }

    /* ─── جلب البيانات من الخادم ─────────────────────────────────────────── */
    async _fetchTenders() {
      try {
        const res = await fetch('/api/tenders');
        if (res.ok) {
          const json = await res.json();
          this.tendersList = Array.isArray(json) ? json : (json.data || []);
        }
      } catch (e) {
        console.warn('[ECMS] Failed fetching tenders:', e);
      }
    }

    async _fetchContracts() {
      const tbody = document.getElementById('ecm-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">⏳ جاري تحميل سجلات العقود والضمانات...</td></tr>';
      
      try {
        const res = await fetch('/api/v4/contracts');
        if (res.ok) {
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json.data || []);
          if (list.length > 0) {
            this.activeData = list;
            this._saveLocalCache();
          }
        }
      } catch (e) {
        console.warn('[ECMS] Network fetch error, using local cache:', e);
      }

      this._updateSidebarBadge();
      this._renderKPIs();
      this._renderCurrentTab();
    }

    _updateSidebarBadge() {
      const badge = document.getElementById('badge-contracts');
      if (badge) {
        const count = this.activeData.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    }

    /* ─── بطاقات المؤشرات الإحصائية (KPIs) ───────────────────────────────── */
    _renderKPIs() {
      const list = this.activeData || [];
      const totalCount = list.length;
      const totalVal = list.reduce((acc, c) => acc + (parseFloat(c.total_value || c.value || c.contractValue || 0) || 0), 0);
      const activeCount = list.filter(c => ['ACTIVE', 'ساري', 'ساري المفعول'].includes(c.status)).length;
      
      const guaranteesCount = list.filter(c => c.guarantee_number || c.guaranteeNumber).length;
      const guaranteesVal = list.reduce((acc, c) => acc + (parseFloat(c.guarantee_value || c.guaranteeValue || 0) || 0), 0);

      // تنبيهات الكفالات والمدد والوثائق غير المرفوعة
      const now = new Date();
      const next60 = new Date(now.getTime() + 60 * 86400000);
      const next20 = new Date(now.getTime() + 20 * 86400000);

      const gAlerts = list.filter(c => {
        const expStr = c.guarantee_expiry_date || c.guaranteeExpiryDate;
        if (!expStr) return false;
        const exp = new Date(expStr);
        return !isNaN(exp) && exp <= next60;
      }).length;

      const cAlerts = list.filter(c => {
        if (!['ACTIVE', 'ساري'].includes(c.status)) return false;
        const endStr = c.end_date || c.endDate;
        if (!endStr) return false;
        const end = new Date(endStr);
        return !isNaN(end) && end <= next20;
      }).length;

      const unarchivedAlerts = list.filter(c => !c.signed_contract_attachment).length;

      document.getElementById('ecm-kpi-total').textContent = totalCount;
      document.getElementById('ecm-kpi-value').textContent = Number(totalVal.toFixed(0)).toLocaleString() + ' د.أ';
      document.getElementById('ecm-kpi-active').textContent = activeCount;
      document.getElementById('ecm-kpi-guarantees').textContent = guaranteesCount;
      document.getElementById('ecm-kpi-guarantees-val').textContent = `بقيمة ${Number(guaranteesVal.toFixed(0)).toLocaleString()} د.أ`;
      document.getElementById('ecm-kpi-alerts').textContent = gAlerts + cAlerts + unarchivedAlerts;
    }

    _renderCurrentTab() {
      if (this.activeTab === 'REGISTRY') {
        this._renderRegistryTable();
      } else if (this.activeTab === 'GUARANTEES') {
        this._renderGuaranteesTable();
      } else if (this.activeTab === 'ALERTS') {
        this._renderAlertsTable();
      }
    }

    _filterData() {
      let filtered = [...this.activeData];

      if (this.currentFilter !== 'ALL') {
        filtered = filtered.filter(item => {
          const st = String(item.status || '').toUpperCase();
          if (this.currentFilter === 'ACTIVE') return ['ACTIVE', 'ساري', 'ساري المفعول'].includes(st);
          if (this.currentFilter === 'PENDING') return ['PENDING', 'قيد التوقيع', 'مسودة'].includes(st);
          if (this.currentFilter === 'COMPLETED') return ['COMPLETED', 'مكتمل', 'مستلم'].includes(st);
          if (this.currentFilter === 'MAINTENANCE') return ['MAINTENANCE', 'صيانة'].includes(st);
          if (this.currentFilter === 'SUSPENDED') return ['SUSPENDED', 'مفسوخ', 'متوقف'].includes(st);
          return true;
        });
      }

      if (this.searchTerm) {
        const q = this.searchTerm;
        filtered = filtered.filter(item => {
          return String(item.id || '').toLowerCase().includes(q) ||
            String(item.contract_number || item.contractNumber || '').toLowerCase().includes(q) ||
            String(item.tender_id || item.tenderId || item.procurement_id || '').toLowerCase().includes(q) ||
            String(item.title || item.name || '').toLowerCase().includes(q) ||
            String(item.contractor_name || item.contractorName || '').toLowerCase().includes(q) ||
            String(item.bank_name || item.bankName || '').toLowerCase().includes(q);
        });
      }

      filtered.sort((a, b) => {
        let valA = a[this.sortCol] || '';
        let valB = b[this.sortCol] || '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return this.sortAsc ? valA - valB : valB - valA;
        }
        return this.sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });

      return filtered;
    }

    /* ─── 1. سجل العقود الرئيسي مع البنود وسلسلة الاعتمادات ──────────────── */
    _renderRegistryTable() {
      const container = document.getElementById('ecm-dynamic-container');
      const filtered = this._filterData();

      document.getElementById('ecm-badge-count').textContent = `${filtered.length} عقد`;

      let rowsHtml = '';
      if (filtered.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="10" style="text-align:center;padding:48px 20px;color:var(--text-muted,#94a3b8);">
              <div style="font-size:2.5rem;margin-bottom:8px;">📜</div>
              <div style="font-weight:bold;font-size:1rem;color:var(--text,#f8fafc);margin-bottom:4px;">لا توجد سجلات عقود مطابقة</div>
              <div style="font-size:0.82rem;color:var(--text-muted,#94a3b8);">يمكنك إضافة وتوثيق عقد جديد بالضغط على زر <strong>➕ إنشاء / توثيق عقد جديد</strong> أعلاه.</div>
            </td>
          </tr>
        `;
      } else {
        rowsHtml = filtered.map(item => {
          const val = parseFloat(item.total_value || item.contractValue || item.value || 0);
          const gVal = parseFloat(item.guarantee_value || item.guaranteeValue || 0);
          const clausesCount = Array.isArray(item.clauses) ? item.clauses.length : (this.defaultClauses.length);
          const sDate = (item.start_date || item.startDate || '-').split('T')[0];
          const eDate = (item.end_date || item.endDate || '-').split('T')[0];
          
          // مرحلة الاعتماد والصلاحيات
          const stage = item.approval_stage || 'PREPARED';
          let stageBadge = '<button class="ecm-badge-pill ecm-pill-amber" onclick="window.contractsManager._openApprovalModal(\'' + item.id + '\')" title="تسلسل الاعتماد">✍️ (1/4) إعداد</button>';
          if (stage === 'AUDITED') stageBadge = '<button class="ecm-badge-pill ecm-pill-sky" onclick="window.contractsManager._openApprovalModal(\'' + item.id + '\')" title="تسلسل الاعتماد">🔍 (2/4) تدقيق</button>';
          else if (stage === 'APPROVED') stageBadge = '<button class="ecm-badge-pill ecm-pill-indigo" onclick="window.contractsManager._openApprovalModal(\'' + item.id + '\')" title="تسلسل الاعتماد">⚖️ (3/4) مصادقة</button>';
          else if (stage === 'FINALIZED') stageBadge = '<button class="ecm-badge-pill ecm-pill-emerald" onclick="window.contractsManager._openApprovalModal(\'' + item.id + '\')" title="تسلسل الاعتماد">🏛️ (4/4) معتمد</button>';

          const guaranteeHtml = (item.guarantee_number || item.guaranteeNumber) ? `
            <div style="font-size:0.73rem;line-height:1.3;">
              <div style="font-weight:700;color:#38bdf8;">🏦 ${item.bank_name || item.bankName || 'البنك'}</div>
              <div style="font-weight:800;color:#10b981;">${Number(gVal).toLocaleString()} د.أ</div>
            </div>
          ` : `<span class="ecm-badge-pill ecm-pill-slate">غير مسجلة</span>`;

          const hasSignedDoc = !!item.signed_contract_attachment;
          const signedDocHtml = hasSignedDoc ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <button class="ecm-badge-pill ecm-pill-emerald" onclick="window.contractsManager._viewContractAttachment('${item.id}')" title="معاينة وثيقة العقد الموقعة والمختومة رسمياً">
                📄 معروض
              </button>
              <span style="font-size:0.65rem;color:#34d399;font-weight:700;">✅ مؤرشف</span>
            </div>
          ` : (this._hasPermission('contracts.edit') ? `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              <button class="ecm-badge-pill ecm-pill-rose" onclick="window.contractsManager._uploadContractAttachmentPrompt('${item.id}')" title="يجب رفع نسخة العقد بعد توقيعها حياً ومصادقتها">
                ⚠️ رفع العقد 📤
              </button>
              <span style="font-size:0.65rem;color:#f87171;font-weight:700;">بانتظار الرفع</span>
            </div>
          ` : `<span class="ecm-badge-pill ecm-pill-rose">⚠️ غير مرفوع</span>`);

          return `
            <tr style="border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-id-badge">
                  ${item.id || item.contract_number}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;max-width:200px;">
                <div style="font-weight:700;color:var(--text,#f8fafc);font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.title || ''}">${item.title || '-'}</div>
                <div style="font-size:0.7rem;color:var(--text-muted,#94a3b8);margin-top:1px;">العطاء: <span style="font-weight:600;color:var(--accent,#38bdf8);">${item.tender_id || item.procurement_id || 'عام'}</span></div>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);font-size:0.81rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${item.contractor_name || item.contractorName || '-'}
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;color:#10b981;font-size:0.9rem;white-space:nowrap;">
                ${Number(val).toLocaleString()} <span style="font-size:0.68rem;color:#34d399;font-weight:600;">د.أ</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-size:0.72rem;line-height:1.3;white-space:nowrap;">
                <div style="color:var(--text-muted,#94a3b8);">المباشرة: <span style="color:var(--text,#f8fafc);font-weight:600;">${sDate}</span></div>
                <div style="color:#38bdf8;font-weight:700;margin-top:1px;">الانتهاء: ${eDate}</div>
              </td>
              <td style="padding:8px 6px;text-align:right;">${guaranteeHtml}</td>
              <td style="padding:8px 6px;text-align:center;">${signedDocHtml}</td>
              <td style="padding:8px 6px;text-align:center;">${stageBadge}</td>
              <td style="padding:8px 6px;text-align:center;">
                <button class="ecm-badge-pill ecm-pill-indigo" onclick="window.contractsManager._openClausesDrawer('${item.id}')" title="عرض وتعديل بنود هذا العقد">
                  📜 ${clausesCount} بنود
                </button>
              </td>
              <td style="padding:8px 6px;text-align:center;white-space:nowrap;">
                <div style="display:flex;gap:3px;align-items:center;justify-content:center;flex-wrap:nowrap;">
                  <button class="ecm-action-btn" onclick="window.contractsManager._printContract('${item.id}')" style="background:#6366f1;color:#fff;" title="طباعة العقد الرسمي">🖨️ طباعة</button>
                  ${this._hasPermission('contracts.edit') ? `<button class="ecm-action-btn" onclick="window.contractsManager._openModal('${item.id}')" style="background:#0ea5e9;color:#fff;" title="تعديل ومعاينة">✏️ تعديل</button>` : ''}
                  ${this._hasPermission('contracts.delete') ? `<button class="ecm-action-btn" onclick="window.contractsManager._deleteContract('${item.id}')" style="background:#ef4444;color:#fff;" title="حذف العقد">🗑️</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      container.innerHTML = `
        <div class="ecm-table-card">
          <table class="ecm-table">
            <thead>
              <tr>
                <th style="width:80px;text-align:right;">رقم العقد</th>
                <th style="width:200px;text-align:right;">العطاء / موضوع المشروع</th>
                <th style="width:130px;text-align:right;">المقاول المحال عليه</th>
                <th style="width:95px;text-align:right;">قيمة العقد</th>
                <th style="width:110px;text-align:right;">المدة والانتهاء</th>
                <th style="width:95px;text-align:right;">الكفالة البنكية</th>
                <th style="width:105px;text-align:center;">وثيقة العقد الموقع</th>
                <th style="width:115px;text-align:center;">تسلسل الاعتماد</th>
                <th style="width:85px;text-align:center;">البنود</th>
                <th style="width:125px;text-align:center;">الإجراءات</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    }

    /* ─── 2. جدول وسجل إدارة الكفالات والضمانات البنكية المطور ──────────── */
    _renderGuaranteesTable() {
      const container = document.getElementById('ecm-dynamic-container');
      const filtered = this._filterData();
      
      // استخراج كافة الكفالات المسجلة (الأساسية والإضافية)
      let allGuarantees = [];
      filtered.forEach(contract => {
        if (contract.guarantee_number || contract.guaranteeNumber) {
          allGuarantees.push({
            contractId: contract.id,
            contractTitle: contract.title,
            contractorName: contract.contractor_name || contract.contractorName,
            guaranteeNumber: contract.guarantee_number || contract.guaranteeNumber,
            bankName: contract.bank_name || contract.bankName || 'البنك المعتمد',
            guaranteeType: contract.guarantee_type || 'حسن تنفيذ (10%)',
            guaranteeValue: parseFloat(contract.guarantee_value || contract.guaranteeValue || 0),
            expiryDate: contract.guarantee_expiry_date || contract.guaranteeExpiryDate,
            attachment: contract.guarantee_attachment || contract.guaranteeAttachment || null,
            status: contract.status,
            contract: contract
          });
        }
        // كفالات إضافية إن وجدت (مثل كفالة الصيانة)
        if (Array.isArray(contract.additional_guarantees)) {
          contract.additional_guarantees.forEach(ag => {
            allGuarantees.push({
              contractId: contract.id,
              contractTitle: contract.title,
              contractorName: contract.contractor_name || contract.contractorName,
              guaranteeNumber: ag.number || ag.guaranteeNumber,
              bankName: ag.bank || ag.bankName,
              guaranteeType: ag.type || 'كفالة صيانة (5%)',
              guaranteeValue: parseFloat(ag.value || 0),
              expiryDate: ag.expiryDate,
              attachment: ag.attachment || null,
              status: contract.status,
              contract: contract,
              isAdditional: true
            });
          });
        }
      });

      document.getElementById('ecm-badge-count').textContent = `${allGuarantees.length} كفالة بنكية`;

      const now = new Date();
      const totalGVal = allGuarantees.reduce((sum, g) => sum + g.guaranteeValue, 0);

      let rowsHtml = '';
      if (allGuarantees.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="10" style="text-align:center;padding:48px 20px;color:var(--text-muted,#64748b);">
              <div style="font-size:2.2rem;margin-bottom:8px;">🏦</div>
              <div style="font-weight:bold;font-size:0.95rem;color:var(--text,#0f172a);margin-bottom:4px;">لا توجد كفالات أو ضمانات بنكية مسجلة حالياً</div>
              <div style="font-size:0.8rem;color:var(--text-muted,#64748b);">يتم تسجيل الكفالات تلقائياً عند توثيق العقود أو تسجيل كفالات صيانة إضافية.</div>
            </td>
          </tr>
        `;
      } else {
        rowsHtml = allGuarantees.map((g, idx) => {
          let statusBadge = '<span style="background:#059669;color:#fff;padding:3px 9px;border-radius:12px;font-size:0.72rem;font-weight:bold;">🟢 سارية المفعول</span>';
          let diffDaysText = '-';

          if (g.expiryDate) {
            const expDate = new Date(g.expiryDate);
            const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
              statusBadge = '<span style="background:#ef4444;color:#fff;padding:3px 9px;border-radius:12px;font-size:0.72rem;font-weight:bold;">🔴 منتهية الصلاحية</span>';
              diffDaysText = `<span style="color:#ef4444;font-weight:bold;">منتهية منذ ${Math.abs(diffDays)} يوم</span>`;
            } else if (diffDays <= 60) {
              statusBadge = '<span style="background:#f59e0b;color:#fff;padding:3px 9px;border-radius:12px;font-size:0.72rem;font-weight:bold;">⚠️ تستحق قريباً</span>';
              diffDaysText = `<span style="color:#f59e0b;font-weight:bold;">تستحق خلال ${diffDays} يوم</span>`;
            } else {
              diffDaysText = `<span style="color:#059669;">متبقي ${diffDays} يوم</span>`;
            }
          }

          const hasAttach = !!g.attachment;
          const attachBtn = hasAttach ? `
            <button class="ecm-badge-pill ecm-pill-sky" onclick="window.contractsManager._viewAttachment('${g.contractId}', '${g.guaranteeNumber}')" title="معاينة الوثيقة المرفقة">📄 معروضة</button>
          ` : (this._hasPermission('guarantees.manage') ? `
            <button class="ecm-badge-pill ecm-pill-amber" onclick="window.contractsManager._uploadAttachmentPrompt('${g.contractId}', '${g.guaranteeNumber}')" title="رفع صورة أو ملف الكفالة الورقية">📤 رفع وثيقة</button>
          ` : `<span style="color:#94a3b8;font-size:0.72rem;">غير مرفوعة</span>`);

          const expDateClean = (g.expiryDate || '-').split('T')[0];
          return `
            <tr style="border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-id-badge">
                  ${g.guaranteeNumber}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:#38bdf8;">🏦 ${g.bankName}</td>
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-badge-pill ecm-pill-indigo">
                  ${g.guaranteeType}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;color:#10b981;font-size:0.9rem;">
                ${Number(g.guaranteeValue).toLocaleString()} <span style="font-size:0.68rem;color:#34d399;font-weight:600;">د.أ</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.contractorName}</td>
              <td style="padding:8px 6px;text-align:right;font-size:0.72rem;">
                <span style="color:var(--accent,#38bdf8);font-weight:800;">${g.contractId}</span><br/>
                <span style="color:var(--text-muted,#94a3b8);">${g.contractTitle.slice(0, 24)}...</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-size:0.72rem;">
                <strong style="color:var(--text,#f8fafc);">${expDateClean}</strong><br/>
                ${diffDaysText}
              </td>
              <td style="padding:8px 6px;text-align:center;">${attachBtn}</td>
              <td style="padding:8px 6px;text-align:center;">${statusBadge}</td>
              <td style="padding:8px 6px;text-align:center;white-space:nowrap;">
                <div style="display:flex;gap:3px;align-items:center;justify-content:center;flex-wrap:nowrap;">
                  ${this._hasPermission('guarantees.manage') ? `<button class="ecm-action-btn" onclick="window.contractsManager._openExtendGuaranteeModal('${g.contractId}')" style="background:#f59e0b;color:#fff;" title="تمديد صلاحية الكفالة">🔄 تمديد</button>` : ''}
                  <button class="ecm-action-btn" onclick="window.contractsManager._printGuaranteeDemandLetter('${g.contractId}')" style="background:#6366f1;color:#fff;" title="طباعة كتاب مطالبة وتمديد للبنك">🖨️ كتاب رسمي</button>
                  ${this._hasPermission('contracts.delete') ? `<button class="ecm-action-btn" onclick="window.contractsManager._deleteGuarantee('${g.contractId}', '${g.guaranteeNumber}')" style="background:#ef4444;color:#fff;" title="حذف الكفالة">🗑️</button>` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- شريط أدوات الكفالات المخصص -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:var(--bg-surface,#18243e);padding:12px 16px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,0.1));box-shadow:0 2px 8px rgba(0,0,0,0.2);">
            <div style="display:flex;align-items:center;gap:10px;">
              <strong style="color:var(--accent,#38bdf8);font-size:0.95rem;">🏦 سجل الكفالات والضمانات البنكية الموثقة:</strong>
              <span style="font-size:0.8rem;background:rgba(16,185,129,0.15);color:#34d399;padding:3px 10px;border-radius:9999px;font-weight:800;border:1px solid rgba(16,185,129,0.3);">
                إجمالي الكفالات: ${Number(totalGVal).toLocaleString()} د.أ
              </span>
            </div>
            <div style="display:flex;gap:8px;">
              ${this._hasPermission('guarantees.manage') ? `<button class="ecm-action-btn" onclick="window.contractsManager._openAddGuaranteeModal()" style="background:#059669;color:#fff;padding:6px 12px;font-size:0.8rem;">➕ تسجيل كفالة إضافية / صيانة</button>` : ''}
              <button class="ecm-action-btn" onclick="window.contractsManager._printGuaranteesLedger()" style="background:#6366f1;color:#fff;padding:6px 12px;font-size:0.8rem;">🖨️ طباعة كشف الكفالات</button>
            </div>
          </div>

          <!-- جدول الكفالات -->
          <div class="ecm-table-card">
            <table class="ecm-table">
              <thead>
                <tr>
                  <th style="width:90px;text-align:right;">رقم الكفالة</th>
                  <th style="width:130px;text-align:right;">البنك الضامن</th>
                  <th style="width:110px;text-align:right;">نوع الضمان</th>
                  <th style="width:95px;text-align:right;">قيمة الكفالة</th>
                  <th style="width:130px;text-align:right;">المقاول / الملتزم</th>
                  <th style="width:120px;text-align:right;">العقد المرتبط</th>
                  <th style="width:105px;text-align:right;">تاريخ الاستحقاق</th>
                  <th style="width:95px;text-align:center;">الوثيقة الورقية</th>
                  <th style="width:110px;text-align:center;">الحالة والإنذار</th>
                  <th style="width:130px;text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    /* ─── 3. تنبيهات استحقاق الكفالات والمدد ──────────────────────────────── */
    _renderAlertsTable() {
      const container = document.getElementById('ecm-dynamic-container');
      const now = new Date();
      const next60 = new Date(now.getTime() + 60 * 86400000);
      const next20 = new Date(now.getTime() + 20 * 86400000);

      const guaranteeAlerts = (this.activeData || []).filter(item => {
        const expStr = item.guarantee_expiry_date || item.guaranteeExpiryDate;
        if (!expStr) return false;
        const exp = new Date(expStr);
        return !isNaN(exp) && exp <= next60;
      });

      const contractAlerts = (this.activeData || []).filter(item => {
        if (!['ACTIVE', 'ساري', 'ساري المفعول'].includes(item.status)) return false;
        const endStr = item.end_date || item.endDate;
        if (!endStr) return false;
        const endDate = new Date(endStr);
        return !isNaN(endDate) && endDate <= next20;
      });

      const unsignedContracts = (this.activeData || []).filter(item => !item.signed_contract_attachment);

      const totalAlerts = guaranteeAlerts.length + contractAlerts.length + unsignedContracts.length;
      document.getElementById('ecm-badge-count').textContent = `${totalAlerts} تنبيه نشط`;

      let gRowsHtml = guaranteeAlerts.length === 0 ? 
        `<tr><td colspan="7" style="text-align:center;padding:24px;color:#059669;font-weight:bold;">✅ جميع الكفالات البنكية سارية ولا توجد كفالات تستحق قريباً.</td></tr>` :
        guaranteeAlerts.map(item => {
          const expDate = new Date(item.guarantee_expiry_date || item.guaranteeExpiryDate);
          const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
          const gVal = parseFloat(item.guarantee_value || item.guaranteeValue || 0);

          let alertBadge = `<span class="ecm-badge-pill ecm-pill-amber">⚠️ تستحق خلال ${diffDays} يوم</span>`;
          if (diffDays < 0) alertBadge = `<span class="ecm-badge-pill ecm-pill-rose">🚨 منتهية منذ ${Math.abs(diffDays)} يوم</span>`;

          const gExpClean = (item.guarantee_expiry_date || item.guaranteeExpiryDate || '-').split('T')[0];
          return `
            <tr style="border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-id-badge">
                  ${item.guarantee_number || item.guaranteeNumber || '-'}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:#38bdf8;">🏦 ${item.bank_name || item.bankName || 'البنك'}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${item.contractor_name || item.contractorName || '-'}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;color:#10b981;font-size:0.9rem;">
                ${Number(gVal).toLocaleString()} <span style="font-size:0.68rem;color:#34d399;font-weight:600;">د.أ</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${gExpClean}</td>
              <td style="padding:8px 6px;text-align:center;">${alertBadge}</td>
              <td style="padding:8px 6px;text-align:center;">
                <button class="ecm-action-btn" onclick="alert('🔔 تم إرسال إشعار تمديد كفالة بنكية للمقاول (${item.contractor_name || ''}) والبنك الضامن')" style="background:#f59e0b;color:#fff;">🔔 إشعار تمديد</button>
              </td>
            </tr>
          `;
        }).join('');

      let cRowsHtml = contractAlerts.length === 0 ?
        `<tr><td colspan="7" style="text-align:center;padding:24px;color:#059669;font-weight:bold;">✅ جميع المشاريع قيد التنفيذ ضمن المدد التعاقدية المحددة.</td></tr>` :
        contractAlerts.map(item => {
          const endDate = new Date(item.end_date || item.endDate);
          const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          const val = parseFloat(item.total_value || item.contractValue || 0);
          const cEndClean = (item.end_date || item.endDate || '-').split('T')[0];

          let alertBadge = `<span class="ecm-badge-pill ecm-pill-amber">⏱️ تنتهي خلال ${diffDays} يوم</span>`;
          if (diffDays < 0) alertBadge = `<span class="ecm-badge-pill ecm-pill-rose">🚨 تأخر (${Math.abs(diffDays)} يوم)</span>`;

          return `
            <tr style="border-bottom:1px solid var(--border, rgba(255,255,255,0.08));">
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-id-badge">
                  ${item.id}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${item.title}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${item.contractor_name || item.contractorName || '-'}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;color:#10b981;font-size:0.9rem;">
                ${Number(val).toLocaleString()} <span style="font-size:0.68rem;color:#34d399;font-weight:600;">د.أ</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:#38bdf8;">${cEndClean}</td>
              <td style="padding:8px 6px;text-align:center;">${alertBadge}</td>
              <td style="padding:8px 6px;text-align:center;">
                <button class="ecm-action-btn" onclick="alert('⚠️ تم توجيه كتاب متابعة وإنذار تعاقدي بخصوص سرعة إنجاز الأعمال')" style="background:#ef4444;color:#fff;">⚠️ إشعار متابعة</button>
              </td>
            </tr>
          `;
        }).join('');

      let uRowsHtml = unsignedContracts.length === 0 ?
        `<tr><td colspan="7" style="text-align:center;padding:24px;color:#059669;font-weight:bold;">✅ جميع العقود موثقة ومرفوعة بالنسخ الموقعة والمختومة حياً.</td></tr>` :
        unsignedContracts.map(item => {
          const val = parseFloat(item.total_value || item.contractValue || 0);
          const uStartClean = (item.start_date || '-').split('T')[0];
          return `
            <tr style="border-bottom:1px solid var(--border, rgba(255,255,255,0.08));background:rgba(239,68,68,0.04);">
              <td style="padding:8px 6px;text-align:right;">
                <span class="ecm-id-badge">
                  ${item.id}
                </span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${item.title}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--text,#f8fafc);">${item.contractor_name || item.contractorName || '-'}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:800;color:#10b981;font-size:0.9rem;">
                ${Number(val).toLocaleString()} <span style="font-size:0.68rem;color:#34d399;font-weight:600;">د.أ</span>
              </td>
              <td style="padding:8px 6px;text-align:right;font-size:0.72rem;color:var(--text-muted,#94a3b8);">${uStartClean}</td>
              <td style="padding:8px 6px;text-align:center;">
                <span class="ecm-badge-pill ecm-pill-rose">⚠️ بانتظار رفع العقد الموقع</span>
              </td>
              <td style="padding:8px 6px;text-align:center;">
                <button class="ecm-action-btn" onclick="window.contractsManager._uploadContractAttachmentPrompt('${item.id}')" style="background:#059669;color:#fff;padding:5px 10px;font-size:0.75rem;">📤 رفع العقد الموقع الآن</button>
              </td>
            </tr>
          `;
        }).join('');

      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:24px;">
          
          <!-- تنبيهات رفع العقد الموقع حياً -->
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <strong style="color:#b91c1c;font-size:0.95rem;">📜 تنبيهات العقود التي تتطلب رفع النسخة الموقعة والمختومة حياً:</strong>
              <span style="font-size:0.75rem;background:#fef2f2;color:#b91c1c;padding:2px 8px;border-radius:9999px;border:1px solid #fecaca;font-weight:bold;">${unsignedContracts.length} عقد معلق</span>
            </div>
            <div class="ecm-table-card">
              <div style="overflow-x:auto;">
                <table class="ecm-table" style="min-width:950px;">
                  <thead>
                    <tr>
                      <th style="padding:12px 10px;text-align:right;background:#991b1b !important;">رقم العقد</th>
                      <th style="padding:12px 10px;text-align:right;background:#991b1b !important;">موضوع المشروع</th>
                      <th style="padding:12px 10px;text-align:right;background:#991b1b !important;">المقاول المنفذ</th>
                      <th style="padding:12px 10px;text-align:right;background:#991b1b !important;">قيمة العقد</th>
                      <th style="padding:12px 10px;text-align:right;background:#991b1b !important;">تاريخ المباشرة</th>
                      <th style="padding:12px 10px;text-align:center;background:#991b1b !important;">حالة الأرشفة والتوقيع</th>
                      <th style="padding:12px 10px;text-align:center;background:#991b1b !important;">الإجراء المطلوب</th>
                    </tr>
                  </thead>
                  <tbody>${uRowsHtml}</tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- تنبيهات الكفالات البنكية -->
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <strong style="color:#1e3a8a;font-size:0.95rem;">🏦 تنبيهات استحقاق وانتهاء الكفالات البنكية:</strong>
              <span style="font-size:0.75rem;background:#eff6ff;color:#1e3a8a;padding:2px 8px;border-radius:9999px;border:1px solid #bfdbfe;font-weight:bold;">${guaranteeAlerts.length} كفالة نشطة</span>
            </div>
            <div class="ecm-table-card">
              <div style="overflow-x:auto;">
                <table class="ecm-table" style="min-width:950px;">
                  <thead>
                    <tr>
                      <th style="padding:12px 10px;text-align:right;">رقم الكفالة</th>
                      <th style="padding:12px 10px;text-align:right;">البنك الضامن</th>
                      <th style="padding:12px 10px;text-align:right;">المقاول</th>
                      <th style="padding:12px 10px;text-align:right;">قيمة الكفالة</th>
                      <th style="padding:12px 10px;text-align:right;">تاريخ الانتهاء</th>
                      <th style="padding:12px 10px;text-align:center;">حالة الإنذار</th>
                      <th style="padding:12px 10px;text-align:center;">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>${gRowsHtml}</tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- تنبيهات المدد الزمنية -->
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <strong style="color:#1e3a8a;font-size:0.95rem;">⏱️ تنبيهات قرب انتهاء المدد التعاقدية أو التأخير الزمني:</strong>
              <span style="font-size:0.75rem;background:#eff6ff;color:#1e3a8a;padding:2px 8px;border-radius:9999px;border:1px solid #bfdbfe;font-weight:bold;">${contractAlerts.length} مشروع</span>
            </div>
            <div class="ecm-table-card">
              <div style="overflow-x:auto;">
                <table class="ecm-table" style="min-width:950px;">
                  <thead>
                    <tr>
                      <th style="padding:12px 10px;text-align:right;">رقم العقد</th>
                      <th style="padding:12px 10px;text-align:right;">موضوع المشروع</th>
                      <th style="padding:12px 10px;text-align:right;">المقاول المنفذ</th>
                      <th style="padding:12px 10px;text-align:right;">قيمة العقد</th>
                      <th style="padding:12px 10px;text-align:right;">تاريخ الانتهاء التعاقدي</th>
                      <th style="padding:12px 10px;text-align:center;">الموقف الزمني</th>
                      <th style="padding:12px 10px;text-align:center;">الإجراء الفني</th>
                    </tr>
                  </thead>
                  <tbody>${cRowsHtml}</tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      `;
    }

    /* ─── 4. نافذة إدارة بنود الاتفاقية الخاصة بالعقد (Clauses Drawer) ─────── */
    _buildClausesDrawerModal() {
      if (document.getElementById('ecm-clauses-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'ecm-clauses-modal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:\'Tajawal\',sans-serif;';
      modal.innerHTML = `
        <div style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border-radius:14px;max-width:850px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 36px rgba(0,0,0,0.3);border:1px solid var(--border,#cbd5e1);overflow:hidden;">
          <div style="padding:14px 20px;background:linear-gradient(135deg,var(--primary,#1e3a8a),#0f172a);color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 id="ecm-clauses-modal-title" style="margin:0;font-size:1.05rem;font-weight:800;">✍️ نصوص وشروط الاتفاقية الخاصة بالعقد</h3>
              <div id="ecm-clauses-modal-subtitle" style="font-size:0.75rem;color:#cbd5e1;margin-top:2px;"></div>
            </div>
            <button id="ecm-clauses-modal-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">✕</button>
          </div>
          <div id="ecm-clauses-modal-body" style="padding:20px;overflow-y:auto;flex:1;">
            <!-- Dynamic Clauses List -->
          </div>
          <div style="padding:12px 20px;background:var(--bg-surface,#f8fafc);border-top:1px solid var(--border,#cbd5e1);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <button type="button" id="ecm-btn-add-clause" class="ecm-btn-action" style="background:#0284c7;color:#fff;">➕ إضافة بند تعاقدي إضافي</button>
            <div style="display:flex;gap:8px;">
              <button type="button" id="ecm-btn-reset-clauses" class="ecm-btn-action" style="background:var(--bg-card-hover,#475569);color:#fff;">🔄 استعادة البنود النموذجية</button>
              <button type="button" id="ecm-btn-save-clauses" class="ecm-btn-action" style="background:#059669;color:#fff;">💾 حفظ وتثبيت بنود هذا العقد</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('ecm-clauses-modal-close')?.addEventListener('click', () => {
        document.getElementById('ecm-clauses-modal').style.display = 'none';
      });
    }

    _openClausesDrawer(contractId) {
      const modal = document.getElementById('ecm-clauses-modal');
      const subTitle = document.getElementById('ecm-clauses-modal-subtitle');
      const bodyEl = document.getElementById('ecm-clauses-modal-body');
      if (!modal || !bodyEl) return;

      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      subTitle.textContent = `العقد: ${item.id} | ${item.title || ''} | المقاول: ${item.contractor_name || ''}`;

      if (!Array.isArray(item.clauses) || item.clauses.length === 0) {
        item.clauses = JSON.parse(JSON.stringify(this.defaultClauses));
      }

      this._currentEditingContractId = contractId;
      this._renderClausesEditorList(item.clauses);

      // Bind Drawer buttons
      document.getElementById('ecm-btn-add-clause').onclick = () => {
        const nextIndex = item.clauses.length + 1;
        item.clauses.push({
          id: `CLS-${String(nextIndex).padStart(2, '0')}`,
          title: `بند إضافي خاص (${nextIndex})`,
          text: 'نص الشروط الخاصة المتفق عليها بين الطرفين...'
        });
        this._renderClausesEditorList(item.clauses);
      };

      document.getElementById('ecm-btn-reset-clauses').onclick = () => {
        if (confirm('هل تريد استعادة البنود النموذجية السبعة المعتمدة لهذا العقد؟')) {
          item.clauses = JSON.parse(JSON.stringify(this.defaultClauses));
          this._renderClausesEditorList(item.clauses);
        }
      };

      document.getElementById('ecm-btn-save-clauses').onclick = () => {
        // Collect updated text from DOM
        const rows = bodyEl.querySelectorAll('.ecm-clause-editor-row');
        const updatedClauses = [];
        rows.forEach((row, i) => {
          const t = row.querySelector('.ecm-c-title')?.value || `البند (${i + 1})`;
          const txt = row.querySelector('.ecm-c-text')?.value || '';
          updatedClauses.push({ id: `CLS-${i + 1}`, title: t, text: txt });
        });
        item.clauses = updatedClauses;
        this._saveLocalCache();
        this._renderCurrentTab();
        modal.style.display = 'none';
        if (typeof showToast === 'function') showToast('✅ تم حفظ وتثبيت بنود الاتفاقية الخاصة بالعقد بنجاح');
      };

      modal.style.display = 'flex';
    }

    _renderClausesEditorList(clauses) {
      const bodyEl = document.getElementById('ecm-clauses-modal-body');
      if (!bodyEl) return;

      bodyEl.innerHTML = clauses.map((c, idx) => `
        <div class="ecm-clause-editor-row ecm-clause-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;flex:1;">
              <span style="font-weight:bold;color:var(--primary,#1e3a8a);font-size:0.85rem;">البند (${idx + 1}):</span>
              <input type="text" class="ecm-c-title" value="${c.title}" style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:4px 8px;border-radius:6px;font-weight:bold;font-size:0.82rem;flex:1;" />
            </div>
            <button type="button" onclick="window.contractsManager._removeClause(${idx})" style="background:none;border:none;color:#ef4444;font-size:1.1rem;cursor:pointer;margin-right:8px;" title="حذف هذا البند">🗑️</button>
          </div>
          <textarea class="ecm-c-text" rows="3" style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px;border-radius:6px;width:100%;font-size:0.82rem;line-height:1.6;resize:vertical;">${c.text}</textarea>
        </div>
      `).join('');
    }

    _removeClause(idx) {
      const item = this.activeData.find(c => String(c.id) === String(this._currentEditingContractId));
      if (!item || !item.clauses) return;
      if (item.clauses.length <= 1) {
        alert('يجب أن يحتوي العقد على بند تعاقدي واحد على الأقل');
        return;
      }
      item.clauses.splice(idx, 1);
      this._renderClausesEditorList(item.clauses);
    }

    /* ─── 5. سلسلة الاعتماد والصلاحيات الصارمة (Strict Approval Chain Workflow) ─ */
    _buildWorkflowApprovalModal() {
      if (document.getElementById('ecm-approval-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'ecm-approval-modal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:\'Tajawal\',sans-serif;';
      modal.innerHTML = `
        <div style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border-radius:14px;max-width:700px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 36px rgba(0,0,0,0.3);border:1px solid var(--border,#cbd5e1);overflow:hidden;">
          <div style="padding:14px 20px;background:linear-gradient(135deg,var(--primary,#1e3a8a),#0f172a);color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <h3 id="ecm-appr-modal-title" style="margin:0;font-size:1.05rem;font-weight:800;">🔄 سلسلة اعتماد وصلاحيات العقد الرسمية</h3>
              <div id="ecm-appr-modal-sub" style="font-size:0.75rem;color:#cbd5e1;margin-top:2px;"></div>
            </div>
            <button id="ecm-appr-modal-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">✕</button>
          </div>
          <div id="ecm-appr-modal-body" style="padding:20px;overflow-y:auto;flex:1;">
            <!-- Workflow Steps & Logs -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('ecm-appr-modal-close')?.addEventListener('click', () => {
        document.getElementById('ecm-approval-modal').style.display = 'none';
      });
    }

    _openApprovalModal(contractId) {
      const modal = document.getElementById('ecm-approval-modal');
      const sub = document.getElementById('ecm-appr-modal-sub');
      const body = document.getElementById('ecm-appr-modal-body');
      if (!modal || !body) return;

      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const stage = item.approval_stage || 'PREPARED';
      sub.textContent = `العقد: ${item.id} | ${item.title || ''} | القيمة: ${Number(item.total_value || 0).toLocaleString()} د.أ`;

      const stages = [
        { key: 'PREPARED', name: 'المرحلة 1: إعداد وتدقيق البنود والكميات', roleKey: 'engineer', role: 'المهندس المشرف / معد العقد 📐', icon: '✍️' },
        { key: 'AUDITED', name: 'المرحلة 2: التدقيق المالي والقانوني والكفالة', roleKey: 'auditor', role: 'المدقق المالي والقانوني 🔍', icon: '🔍' },
        { key: 'APPROVED', name: 'المرحلة 3: الاعتماد والمصادقة الهندسية', roleKey: 'director', role: 'مدير الأشغال الهندسية ⚖️', icon: '⚖️' },
        { key: 'FINALIZED', name: 'المرحلة 4 (النهائية): التوقيع والمصادقة والختم الرسمي', roleKey: 'admin', role: 'عطوفة رئيس البلدية 🏛️', icon: '🏛️' }
      ];

      const stageIdx = stages.findIndex(s => s.key === stage);
      const isCompleted = stage === 'FINALIZED';

      // فحص صلاحية المستخدم للمرحلة الحالية
      const userRole = String(this._user?.role || 'admin').toLowerCase();
      const currentRequired = stages[stageIdx] || stages[0];
      const canApproveCurrent = userRole === 'admin' || userRole === 'superadmin' || userRole === currentRequired.roleKey || 
                                (currentRequired.roleKey === 'engineer' && ['manager', 'director'].includes(userRole));

      const stepsHtml = stages.map((st, idx) => {
        let statusBadge = '<span style="font-size:0.75rem;color:#94a3b8;font-weight:600;">🔒 مقفلة بانتظار المراحل السابقة</span>';
        let borderColor = '#cbd5e1';
        let bg = '#f8fafc';
        let iconStatus = '🔒';

        if (idx < stageIdx || isCompleted) {
          statusBadge = '<span style="font-size:0.75rem;color:#059669;font-weight:bold;">✅ مكتمل ومعتمد رسمياً</span>';
          borderColor = '#059669';
          bg = 'rgba(5,150,105,0.06)';
          iconStatus = '✅';
        } else if (idx === stageIdx) {
          statusBadge = '<span style="font-size:0.75rem;color:#d97706;font-weight:bold;">⏳ قيد التدقيق والمعالجة حالياً</span>';
          borderColor = '#d97706';
          bg = 'rgba(217,119,6,0.08)';
          iconStatus = '👉';
        }

        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${bg};border-radius:8px;margin-bottom:10px;border:1.5px solid ${borderColor};">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.3rem;">${st.icon}</span>
              <div>
                <strong style="color:var(--text,#0f172a);font-size:0.88rem;display:block;">${st.name}</strong>
                <div style="font-size:0.75rem;color:var(--text-muted,#64748b);">المخول بالاعتماد: <strong>${st.role}</strong></div>
              </div>
            </div>
            <div style="text-align:left;">
              ${statusBadge}
            </div>
          </div>
        `;
      }).join('');

      // سجل الإجراءات والموافقات السابقة
      const historyHtml = (item.approval_history || []).map(h => `
        <div style="font-size:0.78rem;padding:8px 0;border-bottom:1px dashed var(--border,#cbd5e1);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="color:var(--primary,#1e3a8a);">${h.stage}</strong> بواسطة <strong>${h.by}</strong>:
            <span style="color:var(--text-muted,#475569);margin-right:6px;">"${h.notes || 'تم الاعتماد'}"</span>
          </div>
          <span style="color:#64748b;font-size:0.72rem;">📅 ${h.date}</span>
        </div>
      `).join('');

      let actionBlock = '';
      if (isCompleted) {
        actionBlock = `
          <div style="background:rgba(5,150,105,0.08);border:1.5px solid #059669;padding:16px;border-radius:10px;text-align:center;">
            <h4 style="margin:0 0 4px 0;color:#059669;font-size:0.95rem;">🎉 اكتملت سلسلة الاعتماد بالكامل وتم تفعيل العقد رسمياً</h4>
            <p style="margin:0 0 10px 0;font-size:0.82rem;color:#475569;">العقد ساري المفعول حالياً وموثق بتوقيع وخاتم بلدية كفرنجة الجديدة.</p>
            <div style="display:flex;justify-content:center;gap:8px;">
              ${item.signed_contract_attachment ? 
                `<button class="ecm-action-btn" onclick="window.contractsManager._viewContractAttachment('${item.id}')" style="background:#059669;color:#fff;">📄 معاينة نسخة العقد الموقعة حياً</button>` :
                `<button class="ecm-action-btn" onclick="window.contractsManager._uploadContractAttachmentPrompt('${item.id}')" style="background:#059669;color:#fff;">📤 رفع وأرشفة نسخة العقد الموقعة حياً</button>`
              }
              <button class="ecm-action-btn" onclick="window.contractsManager._printContract('${item.id}')" style="background:#6366f1;color:#fff;">🖨️ طباعة العقد النهائي</button>
            </div>
          </div>
        `;
      } else if (!canApproveCurrent) {
        actionBlock = `
          <div style="background:#fffbeb;border:1px solid #fef3c7;border-right:4px solid #f59e0b;padding:12px;border-radius:6px;font-size:0.82rem;color:#78350f;">
            ⚠️ <strong>المرحلة الحالية (${currentRequired.name})</strong> تتطلب اعتماد: <strong>${currentRequired.role}</strong>. دورك الحالي في النظام هو: <strong>${this._getRoleLabel(this._user?.role)}</strong>.
          </div>
        `;
      } else {
        const nextStageName = stages[stageIdx + 1]?.name || 'التفعيل النهائي';
        const isFinalStep = stageIdx === stages.length - 2; // Approving step 3 to move to step 4 or step 4 itself
        
        actionBlock = `
          <div style="background:var(--bg-surface,#f8fafc);padding:14px;border-radius:8px;border:1px solid var(--border,#cbd5e1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="color:var(--primary,#1e3a8a);font-size:0.88rem;">✍️ اعتماد: ${currentRequired.name}</strong>
              <span style="font-size:0.75rem;background:#059669;color:#fff;padding:2px 8px;border-radius:10px;font-weight:bold;">المرحلة ${stageIdx + 1} من 4</span>
            </div>
            <div>
              <textarea id="ecm-appr-notes" placeholder="اكتب ملاحظات التدقيق والاعتماد الفني / المالي هنا..." rows="2" style="width:100%;background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px;border-radius:6px;font-size:0.82rem;"></textarea>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
              <button class="ecm-btn-action" onclick="window.contractsManager._advanceApproval('${item.id}', false)" style="background:#ef4444;color:#fff;">↩️ إعادة للمراجعة</button>
              <button class="ecm-btn-action" onclick="window.contractsManager._advanceApproval('${item.id}', true)" style="background:#059669;color:#fff;font-weight:bold;padding:7px 14px;">
                ${stageIdx === 2 ? '🏛️ المصادقة والختم النهائي لرئيس البلدية' : `✅ اعتماد وترقية إلى (${nextStageName})`}
              </button>
            </div>
          </div>
        `;
      }

      body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>${stepsHtml}</div>
          ${actionBlock}
          
          <!-- سجل الموافقات -->
          ${historyHtml ? `
            <div>
              <strong style="font-size:0.8rem;color:var(--text-muted,#64748b);">📜 سجل التوثيق الزمني للاعتمادات السابقة:</strong>
              <div style="margin-top:6px;">${historyHtml}</div>
            </div>
          ` : ''}
        </div>
      `;

      modal.style.display = 'flex';
    }

    /* ─── ترقية مرحلة الاعتماد في السلسلة بالتسلسل الصارم ─────────────────── */
    _advanceApproval(contractId, isApproved) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const notes = document.getElementById('ecm-appr-notes')?.value || 'تمت المصادقة والاعتماد';
      const currentUser = this._user?.fullName || this._user?.name || 'مدير النظام';
      const stages = ['PREPARED', 'AUDITED', 'APPROVED', 'FINALIZED'];
      let currentIdx = stages.indexOf(item.approval_stage || 'PREPARED');

      if (!item.approval_history) item.approval_history = [];

      if (isApproved) {
        if (currentIdx < stages.length - 1) {
          currentIdx += 1;
          item.approval_stage = stages[currentIdx];
          
          // إذا وصلت السلسلة للمرحلة النهائية 4، يتم تفعيل العقد وبدء التنبيهات رسمياً
          if (item.approval_stage === 'FINALIZED') {
            item.status = 'ACTIVE';
            item.finalized_at = new Date().toISOString();
            item.finalized_by = currentUser;
          }
        }
        item.approval_history.push({
          stage: item.approval_stage,
          by: currentUser,
          date: new Date().toISOString().split('T')[0],
          notes: notes
        });
      } else {
        item.approval_stage = 'PREPARED';
        item.status = 'PENDING';
        item.approval_history.push({
          stage: 'RETURNED_FOR_REVISION',
          by: currentUser,
          date: new Date().toISOString().split('T')[0],
          notes: `إعادة للمراجعة: ${notes}`
        });
      }

      this._saveLocalCache();
      this._renderKPIs();
      this._renderCurrentTab();
      document.getElementById('ecm-approval-modal').style.display = 'none';

      if (typeof showToast === 'function') {
        if (item.approval_stage === 'FINALIZED') {
          showToast('🏛️ تم الاعتماد النهائي للعقد وتفعيله رسمياً بنجاح');
        } else if (isApproved) {
          showToast(`✅ تم اعتماد المرحلة وترقية العقد إلى (${item.approval_stage}) بنجاح`);
        } else {
          showToast('↩️ تمت إعادة العقد لمرحلة الإعداد للمراجعة والتعديل');
        }
      }
    }

    /* ─── 6. نموذج إنشاء وتعديل العقد (Modal Wizard) ─────────────────────── */
    _buildModal() {
      if (document.getElementById('ecm-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'ecm-modal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:\'Tajawal\',sans-serif;';
      modal.innerHTML = `
        <div style="background:var(--modal-bg,#111a2e);color:var(--text,#f8fafc);border-radius:14px;max-width:850px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 36px rgba(0,0,0,0.5);border:1px solid var(--border,rgba(255,255,255,0.15));overflow:hidden;">
          <div style="padding:14px 20px;background:var(--table-header-bg,#152038);color:#fff;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border,rgba(255,255,255,0.1));">
            <h3 id="ecm-modal-title" style="margin:0;font-size:1.1rem;font-weight:800;color:var(--accent,#38bdf8);">📜 توثيق عقد واتفاقية تنفيذ أعمال جديدة</h3>
            <button id="ecm-modal-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">✕</button>
          </div>
          <div id="ecm-modal-body" style="padding:20px;overflow-y:auto;flex:1;">
            <!-- Dynamic Form -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('ecm-modal-close')?.addEventListener('click', () => {
        document.getElementById('ecm-modal').style.display = 'none';
      });
    }

    _openModal(contractId = null) {
      const modal = document.getElementById('ecm-modal');
      const titleEl = document.getElementById('ecm-modal-title');
      const bodyEl = document.getElementById('ecm-modal-body');
      if (!modal || !bodyEl) return;

      let item = null;
      if (contractId) {
        item = this.activeData.find(c => String(c.id) === String(contractId));
      }

      const isEdit = !!item;
      titleEl.textContent = isEdit ? `✏️ تعديل بيانات العقد: ${item.id}` : '📜 إنشاء وتوثيق اتفاقية تنفيذ أعمال جديدة';

      const code = isEdit ? item.id : this._nextCode();
      const defaultStartDate = item?.start_date || item?.startDate || new Date().toISOString().split('T')[0];
      const defaultDays = item?.execution_period_days || item?.durationDays || 60;
      
      let defaultEndDate = item?.end_date || item?.endDate || '';
      if (!defaultEndDate && defaultStartDate && defaultDays) {
        const d = new Date(defaultStartDate);
        const end = new Date(d.getTime() + parseInt(defaultDays, 10) * 24 * 60 * 60 * 1000);
        defaultEndDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      }

      const tenderOptions = (this.tendersList || []).map(t => `
        <option value="${t.id}" ${(item && (item.tender_id === t.id || item.procurement_id === t.id)) ? 'selected' : ''}>
          ${t.id} - ${t.name || t.title} (${Number(t.value || t.budget || 0).toLocaleString()} د.أ)
        </option>
      `).join('');

      bodyEl.innerHTML = `
        <form id="ecm-contract-form" style="display:flex;flex-direction:column;gap:16px;">
          <!-- رقم العقد والعطاء المرتبط -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;">
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">رقم العقد التلقائي *</label>
              <input type="text" id="ecm-f-id" value="${code}" readonly style="background:var(--bg-surface,#18243e);color:var(--accent,#38bdf8);border:1px solid var(--border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-weight:bold;font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">العملية الشرائية / العطاء المرتبط</label>
              <select id="ecm-f-tender" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;">
                <option value="">-- اختياري: ربط بعطاء موجود --</option>
                ${tenderOptions}
              </select>
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">رقم العقد الدفتري / الرسمي</label>
              <input type="text" id="ecm-f-contract-num" value="${item?.contract_number || item?.contractNumber || code}" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
          </div>

          <!-- موضوع العقد والمقاول والقيمة -->
          <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr;gap:12px;">
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">موضوع العقد / عنوان المشروع *</label>
              <input type="text" id="ecm-f-title" value="${item?.title || ''}" required placeholder="مثال: عطاء خلطات أسفلتية وتعبيد شوارع كفرنجة" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">المقاول المحال عليه (الطرف الثاني) *</label>
              <input type="text" id="ecm-f-contractor" value="${item?.contractor_name || item?.contractorName || ''}" required placeholder="اسم المقاول أو الشركة المنفذة" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#94a3b8);">قيمة العقد (د.أ) *</label>
              <input type="number" id="ecm-f-value" value="${item?.total_value || item?.contractValue || ''}" required step="0.01" style="background:var(--input-bg,#0d1527);color:#10b981;border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:8px 12px;border-radius:6px;width:100%;font-weight:bold;font-size:0.85rem;" />
            </div>
          </div>

          <!-- تواريخ التنفيذ والمباشرة مع الحساب التلقائي -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;background:var(--bg-surface,#18243e);padding:12px;border-radius:8px;border:1px solid var(--border,rgba(255,255,255,0.1));">
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">تاريخ الإحالة / القرار</label>
              <input type="date" id="ecm-f-award-date" value="${item?.award_date || ''}" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">تاريخ أمر المباشرة *</label>
              <input type="date" id="ecm-f-start-date" value="${defaultStartDate}" required style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;font-weight:bold;" />
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">مدة التنفيذ (بالأيام) *</label>
              <input type="number" id="ecm-f-days" value="${defaultDays}" required min="1" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;font-weight:bold;" />
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">تاريخ الانتهاء التعاقدي</label>
                <span style="font-size:0.68rem;background:rgba(14,165,233,0.2);color:#38bdf8;padding:1px 6px;border-radius:4px;font-weight:bold;border:1px solid rgba(14,165,233,0.35);">⚡ محسوب تلقائياً</span>
              </div>
              <input type="date" id="ecm-f-end-date" value="${defaultEndDate}" style="background:var(--bg-surface,#18243e);color:#38bdf8;border:1.5px solid #0284c7;padding:6px 10px;border-radius:6px;width:100%;font-size:0.82rem;font-weight:bold;" />
            </div>
          </div>

          <!-- بيانات الكفالة البنكية ورفع المستند الورقي -->
          <div style="background:rgba(2,132,199,0.08);border:1px solid rgba(2,132,199,0.25);padding:14px;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="font-weight:bold;color:#38bdf8;font-size:0.85rem;">🏦 بيانات الكفالة والضمان البنكي (10% حسن تنفيذ):</div>
              <button type="button" id="ecm-btn-calc-guarantee" style="background:#0284c7;color:#fff;border:none;padding:3px 10px;border-radius:4px;font-size:0.75rem;cursor:pointer;font-weight:bold;">⚡ حساب 10% تلقائياً</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
              <div>
                <label style="font-size:0.78rem;color:var(--text-muted,#94a3b8);">البنك المصدر للكفالة</label>
                <input type="text" id="ecm-f-bank-name" value="${item?.bank_name || item?.bankName || ''}" placeholder="مثال: البنك الإسلامي الأردني" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
              </div>
              <div>
                <label style="font-size:0.78rem;color:var(--text-muted,#94a3b8);">رقم الكفالة البنكية</label>
                <input type="text" id="ecm-f-guarantee-num" value="${item?.guarantee_number || item?.guaranteeNumber || ''}" placeholder="مثال: BG-2026-9901" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
              </div>
              <div>
                <label style="font-size:0.78rem;color:var(--text-muted,#94a3b8);">قيمة الكفالة (د.أ)</label>
                <input type="number" id="ecm-f-guarantee-val" value="${item?.guarantee_value || item?.guaranteeValue || ''}" step="0.01" placeholder="10% من قيمة العقد" style="background:var(--input-bg,#0d1527);color:#10b981;border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
              </div>
              <div>
                <label style="font-size:0.78rem;color:var(--text-muted,#94a3b8);">تاريخ انتهاء وصلاحية الكفالة *</label>
                <input type="date" id="ecm-f-guarantee-exp" value="${item?.guarantee_expiry_date || item?.guaranteeExpiryDate || ''}" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;font-weight:bold;" />
              </div>
            </div>

            <!-- رفع صورة أو ملف الكفالة الورقية -->
            <div style="margin-top:10px;border-top:1px dashed var(--border,rgba(255,255,255,0.15));padding-top:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div>
                <label style="font-size:0.78rem;font-weight:bold;color:#38bdf8;">📄 رفع مستند الكفالة البنكية الورقية (PDF أو صورة):</label>
                <input type="file" id="ecm-f-guarantee-file" accept="image/*,application/pdf" style="font-size:0.78rem;margin-top:3px;display:block;color:var(--text,#f8fafc);" />
              </div>
              <div id="ecm-f-guarantee-attach-preview" style="font-size:0.75rem;color:#34d399;">
                ${item?.guarantee_attachment ? `✅ المستند الحالي: <strong>${item.guarantee_attachment.name || 'وثيقة ورقية مرفوعة'}</strong>` : 'ℹ️ لم يتم رفع ملف ورقي بعد'}
              </div>
            </div>
          </div>

          <!-- الإشراف الهندسي والحالة ومرحلة الاعتماد -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">المهندس المشرف</label>
              <input type="text" id="ecm-f-engineer" value="${item?.supervising_engineer || 'م. أحمد الخشمان'}" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">مصدر التمويل</label>
              <input type="text" id="ecm-f-funding" value="${item?.funding_source || 'موازنة البلدية الذاتية'}" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;" />
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">مرحلة الاعتماد الحالية</label>
              <select id="ecm-f-stage" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;font-weight:bold;">
                <option value="PREPARED" ${item?.approval_stage === 'PREPARED' ? 'selected' : ''}>✍️ مسودة مهندس</option>
                <option value="AUDITED" ${item?.approval_stage === 'AUDITED' ? 'selected' : ''}>🔍 مدقق مالياً وكفالة</option>
                <option value="APPROVED" ${item?.approval_stage === 'APPROVED' ? 'selected' : ''}>⚖️ معتمد هندسياً</option>
                <option value="FINALIZED" ${item?.approval_stage === 'FINALIZED' ? 'selected' : ''}>🏛️ موقع ومعتمد رسمياً</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.78rem;font-weight:bold;color:var(--text-muted,#94a3b8);">الحالة التشغيلية *</label>
              <select id="ecm-f-status" style="background:var(--input-bg,#0d1527);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,rgba(255,255,255,0.15));padding:6px 10px;border-radius:6px;width:100%;font-size:0.8rem;font-weight:bold;">
                <option value="ACTIVE" ${item?.status === 'ACTIVE' ? 'selected' : ''}>🟢 ساري المفعول قيد التنفيذ</option>
                <option value="PENDING" ${item?.status === 'PENDING' ? 'selected' : ''}>🟡 مسودة / قيد التوقيع</option>
                <option value="COMPLETED" ${item?.status === 'COMPLETED' ? 'selected' : ''}>🔵 مكتمل ومستلم نهائياً</option>
                <option value="MAINTENANCE" ${item?.status === 'MAINTENANCE' ? 'selected' : ''}>⚠️ بانتظار فترة الصيانة</option>
                <option value="SUSPENDED" ${item?.status === 'SUSPENDED' ? 'selected' : ''}>🔴 مفسوخ / متوقف</option>
              </select>
            </div>
          </div>

          <!-- أزرار الإجراء -->
          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--border,rgba(255,255,255,0.15));padding-top:14px;">
            <button type="button" onclick="document.getElementById('ecm-modal').style.display='none';" class="ecm-action-btn" style="background:var(--bg-card-hover,#16223b);color:var(--text,#f8fafc);border:1px solid var(--border,rgba(255,255,255,0.15));padding:8px 16px;">إلغاء</button>
            <button type="submit" class="ecm-action-btn" style="background:#059669;color:#ffffff;padding:8px 18px;">💾 ${isEdit ? 'حفظ التعديلات' : 'توثيق العقد واعتماده'}</button>
          </div>
        </form>
      `;

      // الدوال التفاعلية للحساب التلقائي للتواريخ والقيم
      const calcEndDate = () => {
        const startVal = document.getElementById('ecm-f-start-date')?.value;
        const daysVal = parseInt(document.getElementById('ecm-f-days')?.value, 10);
        if (startVal && !isNaN(daysVal) && daysVal > 0) {
          const startDate = new Date(startVal);
          const endDate = new Date(startDate.getTime() + daysVal * 24 * 60 * 60 * 1000);
          const yyyy = endDate.getFullYear();
          const mm = String(endDate.getMonth() + 1).padStart(2, '0');
          const dd = String(endDate.getDate()).padStart(2, '0');
          document.getElementById('ecm-f-end-date').value = `${yyyy}-${mm}-${dd}`;

          const gExp = document.getElementById('ecm-f-guarantee-exp');
          if (gExp && !gExp.value) {
            const gDate = new Date(endDate.getTime() + 90 * 24 * 60 * 60 * 1000);
            gExp.value = `${gDate.getFullYear()}-${String(gDate.getMonth() + 1).padStart(2, '0')}-${String(gDate.getDate()).padStart(2, '0')}`;
          }
        }
      };

      const calcDaysFromEnd = () => {
        const startVal = document.getElementById('ecm-f-start-date')?.value;
        const endVal = document.getElementById('ecm-f-end-date')?.value;
        if (startVal && endVal) {
          const startDate = new Date(startVal);
          const endDate = new Date(endVal);
          const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) document.getElementById('ecm-f-days').value = diffDays;
        }
      };

      const calcGuaranteeVal = () => {
        const totalV = parseFloat(document.getElementById('ecm-f-value')?.value || 0);
        if (totalV > 0) document.getElementById('ecm-f-guarantee-val').value = (totalV * 0.1).toFixed(2);
      };

      document.getElementById('ecm-f-start-date')?.addEventListener('input', calcEndDate);
      document.getElementById('ecm-f-days')?.addEventListener('input', calcEndDate);
      document.getElementById('ecm-f-end-date')?.addEventListener('input', calcDaysFromEnd);
      document.getElementById('ecm-f-value')?.addEventListener('input', calcGuaranteeVal);
      document.getElementById('ecm-btn-calc-guarantee')?.addEventListener('click', calcGuaranteeVal);

      document.getElementById('ecm-f-tender')?.addEventListener('change', (e) => {
        const tenderId = e.target.value;
        const tender = (this.tendersList || []).find(t => String(t.id) === String(tenderId));
        if (tender) {
          if (!document.getElementById('ecm-f-title').value) document.getElementById('ecm-f-title').value = tender.name || tender.title || '';
          if (!document.getElementById('ecm-f-contractor').value) document.getElementById('ecm-f-contractor').value = tender.contractor || '';
          const v = parseFloat(tender.value || tender.budget || 0);
          if (v > 0) {
            document.getElementById('ecm-f-value').value = v;
            document.getElementById('ecm-f-guarantee-val').value = (v * 0.1).toFixed(2);
          }
          calcEndDate();
        }
      });

      document.getElementById('ecm-f-guarantee-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const previewEl = document.getElementById('ecm-f-guarantee-attach-preview');
        if (file && previewEl) {
          previewEl.innerHTML = `<span style="color:#059669;font-weight:bold;">📄 تم اختيار الملف: ${file.name} (${Math.round(file.size / 1024)} KB)</span>`;
        }
      });

      document.getElementById('ecm-contract-form').onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('ecm-f-guarantee-file');
        let attachObj = item?.guarantee_attachment || null;

        if (fileInput && fileInput.files && fileInput.files[0]) {
          attachObj = await this._uploadFile(fileInput.files[0]);
        }

        const formData = {
          id: document.getElementById('ecm-f-id').value,
          contract_number: document.getElementById('ecm-f-contract-num').value,
          tender_id: document.getElementById('ecm-f-tender').value,
          procurement_id: document.getElementById('ecm-f-tender').value,
          procurement_type: 'TENDER',
          title: document.getElementById('ecm-f-title').value,
          contractor_name: document.getElementById('ecm-f-contractor').value,
          total_value: parseFloat(document.getElementById('ecm-f-value').value || 0),
          award_date: document.getElementById('ecm-f-award-date').value,
          start_date: document.getElementById('ecm-f-start-date').value,
          execution_period_days: parseInt(document.getElementById('ecm-f-days').value || 30, 10),
          end_date: document.getElementById('ecm-f-end-date').value,
          bank_name: document.getElementById('ecm-f-bank-name').value,
          guarantee_number: document.getElementById('ecm-f-guarantee-num').value,
          guarantee_value: parseFloat(document.getElementById('ecm-f-guarantee-val').value || 0),
          guarantee_expiry_date: document.getElementById('ecm-f-guarantee-exp').value,
          guarantee_type: 'حسن تنفيذ (10%)',
          guarantee_attachment: attachObj,
          signed_contract_attachment: item?.signed_contract_attachment || null,
          supervising_engineer: document.getElementById('ecm-f-engineer').value,
          funding_source: document.getElementById('ecm-f-funding').value,
          approval_stage: document.getElementById('ecm-f-stage').value,
          status: document.getElementById('ecm-f-status').value,
          clauses: item?.clauses || this.defaultClauses,
          approval_history: item?.approval_history || [{ stage: 'PREPARED', by: this._user?.name || 'معد العقد', date: new Date().toISOString().split('T')[0], notes: 'إنشاء مسودة العقد وبنوده' }],
          additional_guarantees: item?.additional_guarantees || [],
          created_at: item?.created_at || new Date().toISOString()
        };

        await this._saveContract(formData, isEdit);
        document.getElementById('ecm-modal').style.display = 'none';
      };

      modal.style.display = 'flex';
    }

    /* ─── رفع الملفات إلى الخادم وقاعدة البيانات ────────────────────────── */
    async _uploadFile(file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/v4/contracts/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.file) {
            return json.file;
          }
        }
      } catch (err) {
        console.warn('[ECMS] File server upload fallback:', err);
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: evt.target.result,
            date: new Date().toISOString().split('T')[0]
          });
        };
        reader.readAsDataURL(file);
      });
    }

    /* ─── حفظ العقد ──────────────────────────────────────────────────────── */
    async _saveContract(contractData, isEdit) {
      if (isEdit) {
        const idx = this.activeData.findIndex(c => String(c.id) === String(contractData.id));
        if (idx !== -1) {
          this.activeData[idx] = { ...this.activeData[idx], ...contractData, updated_at: new Date().toISOString() };
        }
      } else {
        this.activeData.unshift(contractData);
        this.activeTab = 'REGISTRY';
        this.currentFilter = 'ALL';
        const filterSelect = document.getElementById('ecm-status-filter');
        if (filterSelect) filterSelect.value = 'ALL';
        const tabBtns = document.querySelectorAll('.ecm-tab-btn');
        tabBtns.forEach(b => {
          if (b.getAttribute('data-tab') === 'REGISTRY') b.classList.add('active');
          else b.classList.remove('active');
        });
      }

      this._saveLocalCache();
      this._updateSidebarBadge();
      this._renderKPIs();
      this._renderCurrentTab();

      try {
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/v4/contracts/${contractData.id}` : '/api/v4/contracts';
        await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contractData)
        });
      } catch (e) {
        console.warn('[ECMS] Saved locally, server sync deferred:', e);
      }

      if (typeof showToast === 'function') {
        showToast(`✅ تم ${isEdit ? 'تحديث بيانات' : 'توثيق'} العقد (${contractData.id}) وحفظه في السجل بنجاح`);
      } else {
        alert(`✅ تم ${isEdit ? 'تحديث بيانات' : 'توثيق'} العقد (${contractData.id}) بنجاح.`);
      }
    }

    /* ─── حذف العقد بناءً على الصلاحيات ────────────────────────────────── */
    async _deleteContract(id) {
      if (!this._hasPermission('contracts.delete')) {
        alert('⛔ عذراً، ليست لديك صلاحية حذف العقود الموثقة. هذه الصلاحية مقصورة على مدير النظام فقط.');
        return;
      }

      const item = this.activeData.find(c => String(c.id) === String(id));
      const title = item ? (item.title || item.id) : id;
      if (!confirm(`⚠️ تحذير أمني: هل أنت متأكد من حذف العقد (${id} - ${title}) نهائياً من النظام؟\n\nلن يمكن استعادة هذا العقد وبنوده وتواقيعه بعد الحذف.`)) {
        return;
      }

      this.activeData = this.activeData.filter(c => String(c.id) !== String(id));
      this._saveLocalCache();
      this._updateSidebarBadge();
      this._renderKPIs();
      this._renderCurrentTab();

      try {
        await fetch(`/api/v4/contracts/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('[ECMS] Deleted locally, server sync error:', e);
      }

      if (typeof showToast === 'function') {
        showToast('🗑️ تم حذف العقد وسجلاته بنجاح');
      }
    }

    /* ─── حذف كفالة بنكية بناءً على الصلاحيات ────────────────────────────── */
    async _deleteGuarantee(contractId, guaranteeNumber) {
      if (!this._hasPermission('contracts.delete')) {
        alert('⛔ عذراً، ليست لديك صلاحية حذف الكفالات البنكية.');
        return;
      }

      if (!confirm(`⚠️ هل أنت متأكد من حذف الكفالة البنكية رقم (${guaranteeNumber}) من السجل؟`)) {
        return;
      }

      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      if (item.guarantee_number === guaranteeNumber) {
        item.guarantee_number = '';
        item.guarantee_value = 0;
        item.guarantee_expiry_date = '';
        item.guarantee_attachment = null;
      } else if (Array.isArray(item.additional_guarantees)) {
        item.additional_guarantees = item.additional_guarantees.filter(ag => (ag.number || ag.guaranteeNumber) !== guaranteeNumber);
      }

      await this._saveContract(item, true);
      if (typeof showToast === 'function') {
        showToast('🗑️ تم حذف الكفالة من السجل بنجاح');
      }
    }

    /* ─── طباعة العقد الرسمي المعتمد (النموذج الرسمي الشامل) ───────────── */
    _printContract(contractId) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) {
        alert('العقد غير موجود بالنظام');
        return;
      }

      const totalVal = parseFloat(item.total_value || item.contractValue || 0);
      const gVal = parseFloat(item.guarantee_value || item.guaranteeValue || 0);
      const clauses = Array.isArray(item.clauses) && item.clauses.length > 0 ? item.clauses : this.defaultClauses;

      const getArabicOrdinal = (n) => {
        const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر'];
        return ordinals[n - 1] || `(${n})`;
      };

      const clausesHTML = clauses.map((c, i) => `
        <div style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
          <div style="font-weight: bold; color: #1e3a8a; font-size: 10.5pt; margin-bottom: 3px; background: #f8fafc; padding: 4px 8px; border-right: 4px solid #1e3a8a; border-radius: 2px;">
            البند ${getArabicOrdinal(i + 1)}: ${c.title || `بند الاتفاقية (${i + 1})`}
          </div>
          <p style="margin: 0; padding: 0 6px; font-size: 10pt; line-height: 1.7; color: #1e293b; text-align: justify; text-justify: inter-word;">
            ${c.text || ''}
          </p>
        </div>
      `).join('');

      const contractDateStr = item.award_date || item.start_date || new Date().toISOString().split('T')[0];
      const contractDateObj = new Date(contractDateStr);
      const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = !isNaN(contractDateObj.getTime()) ? daysArabic[contractDateObj.getDay()] : 'الموافق';
      const formattedContractDate = !isNaN(contractDateObj.getTime()) ? 
        `${contractDateObj.getFullYear()}/${String(contractDateObj.getMonth() + 1).padStart(2, '0')}/${String(contractDateObj.getDate()).padStart(2, '0')}` : contractDateStr;

      const printBody = `
        <div style="font-family: 'Cairo', 'Tajawal', 'Amiri', serif; direction: rtl; color: #0f172a; line-height: 1.7; padding: 12px 16px; background: #ffffff;">
          
          <!-- الترويسة الملكية الرسمية مع الشعار بالمنتصف -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px;">
            <div style="text-align: right; line-height: 1.4;">
              <h4 style="margin: 0; color: #1e3a8a; font-size: 11pt; font-weight: bold;">المملكة الأردنية الهاشمية</h4>
              <h4 style="margin: 2px 0; color: #475569; font-size: 9.5pt;">وزارة الإدارة المحلية</h4>
              <h3 style="margin: 3px 0; color: #0f172a; font-size: 12pt; font-weight: 800;">بلدية كفرنجة الجديدة</h3>
              <p style="margin: 0; color: #64748b; font-size: 9pt; font-weight: 600;">${item.department || 'مديرية الأشغال والخدمات الهندسية'}</p>
            </div>

            <div style="text-align: center;">
              <img src="/logo.jpg" onerror="this.src='/logo.png';this.onerror=null;" alt="شعار بلدية كفرنجة" style="max-height: 75px; width: auto; object-fit: contain;" />
            </div>

            <div style="text-align: left; font-size: 9pt; color: #334155; line-height: 1.6; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px;">
              <div><strong>رقم العقد:</strong> <span style="color:#1e3a8a; font-weight:bold;">${item.contract_number || item.id}</span></div>
              <div><strong>رقم العطاء:</strong> ${item.tender_id || item.procurement_id || 'عام'}</div>
              <div><strong>قرار الإحالة:</strong> ${item.award_decision_number || `DEC-${item.id}`}</div>
              <div><strong>تاريخ العقد:</strong> ${formattedContractDate}م</div>
            </div>
          </div>

          ${item.approval_stage !== 'FINALIZED' ? `
            <div style="background:#fffbeb;border:1.5px dashed #d97706;color:#b45309;padding:8px 12px;text-align:center;font-weight:bold;margin-bottom:14px;border-radius:6px;font-size:9.5pt;">
              ⚠️ مسودة اتفاقية غير معتمدة نهائياً — قيد سلسلة التدقيق والاعتماد (المرحلة: ${item.approval_stage || 'PREPARED'})
            </div>
          ` : ''}

          <!-- عنوان الاتفاقية المعتمد -->
          <div style="text-align: center; margin-bottom: 14px;">
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; padding: 8px 14px; border-radius: 6px; display: inline-block; width: 100%; box-sizing: border-box;">
              <h2 style="margin: 0; font-size: 13.5pt; font-weight: bold;">اتفاقية تنفيذ أشغال وعقد مقاولة</h2>
              <p style="margin: 2px 0 0 0; font-size: 10pt; opacity: 0.95;">مشروع: ${item.title}</p>
            </div>
          </div>

          <!-- التعريف بأطراف الاتفاقية والتمهيد القانوني مع التعبئة التلقائية لليوم والتاريخ -->
          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; font-size: 10pt; line-height: 1.7; text-align: justify;">
            <p style="margin: 0 0 6px 0; font-weight: bold; color: #1e3a8a;">
              تم تحرير هذا العقد وإبرامه في يوم <strong>${dayName}</strong> الموافق: <strong>${formattedContractDate}م</strong> بين كل من:
            </p>

            <div style="margin-bottom: 6px; padding-right: 8px; border-right: 3px solid #1e3a8a;">
              <strong>1. الفريق الأول:</strong> <span style="font-weight:bold; color:#1e3a8a;">بلدية كفرنجة الجديدة</span>، ويمثلها قانونياً عطوفة رئيس بلدية كفرنجة الجديدة بصفته الوظيفية.
            </div>

            <div style="margin-bottom: 6px; padding-right: 8px; border-right: 3px solid #0d9488;">
              <strong>2. الفريق الثاني (المقاول):</strong> السادة / <span style="font-weight:bold; color:#0d9488;">${item.contractor_name || item.contractorName}</span>، ويمثلها المفوض بالتوقيع.
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px; margin-top: 6px; font-size: 9.5pt;">
              <strong>التمهيد القانوني:</strong> وحيث أن البلدية قد طرحت العطاء رقم (<strong>${item.tender_id || item.procurement_id || 'عام'}</strong>) لتنفيذ <strong>${item.title}</strong>، وحيث تمت الإحالة على الفريق الثاني بموجب قرار المجلس البلدي رقم (<strong>${item.award_decision_number || 'DEC-KAF'}</strong>)، فقد اتفق الطرفان وتراضيا أهلياً وقانونياً على ما يلي:
            </div>
          </div>

          <!-- ملخص البيانات المالية والتعاقدية بتصميم عصري ناعم بدون حدود جداول قاسية -->
          <div style="background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 16px; font-size: 9.5pt; line-height: 1.5;">
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">القيمة الإجمالية للعقد:</span>
              <strong style="color: #0d9488; font-size: 11pt;">${Number(totalVal).toLocaleString()} دينار أردني</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">مدة التنفيذ التعاقدية:</span>
              <strong style="color: #1e3a8a; font-size: 10.5pt;">${item.execution_period_days || 60} يوماً تقويمياً</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">تاريخ المباشرة الرسمي:</span>
              <strong style="color: #0f172a; font-size: 10pt;">${item.start_date || '-'}</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">تاريخ الانتهاء التعاقدي:</span>
              <strong style="color: #0d9488; font-size: 10pt;">${item.end_date || '-'}</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">مصدر التمويل المعتمد:</span>
              <strong style="color: #0f172a; font-size: 10pt;">${item.funding_source || 'موازنة البلدية الذاتية'}</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 8.5pt; display: block;">المهندس المشرف:</span>
              <strong style="color: #0f172a; font-size: 10pt;">${item.supervising_engineer || 'م. أحمد الخشمان'}</strong>
            </div>
            <div style="grid-column: span 3; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5pt;">
              <span style="color: #64748b;">الكفالة البنكية المقدمة: </span>
              <strong style="color: #0284c7;">كفالة حسن تنفيذ صادرة عن (${item.bank_name || 'البنك'})</strong> برقم <strong>${item.guarantee_number || '-'}</strong> بقيمة <strong>${Number(gVal).toLocaleString()} د.أ</strong> سارية حتى <strong>${item.guarantee_expiry_date || '-'}</strong>.
            </div>
          </div>

          <!-- نصوص وبنود الاتفاقية القانونية المعتمدة بتنسيق مريح للعين -->
          <div style="margin-bottom: 18px;">
            <div style="border-bottom: 1.5px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; color: #1e3a8a; font-size: 11.5pt; font-weight: bold;">الشروط والأحكام التعاقدية القانونية:</h3>
              <span style="font-size: 8.5pt; color: #64748b;">(تعتبر جميع البنود ملزمة وتفسر مع وثائق العطاء)</span>
            </div>
            <div>${clausesHTML}</div>
          </div>

          <!-- التواقيع الرسمية للطرفين والمصادقة بتصميم متناسق ومريح للعين (طرفين فقط) -->
          <div style="page-break-inside: avoid; break-inside: avoid; margin-top: 24px; border-top: 1.5px solid #cbd5e1; padding-top: 14px;">
            <p style="text-align: center; font-weight: bold; font-size: 10pt; margin-bottom: 18px; color: #1e3a8a;">
              وعليه جرى الاتفاق والتوقيع على هذه الاتفاقية من نسختين أصليتين بيد كل طرف نسخة للعمل بموجبها.
            </p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; font-size: 10pt; padding: 0 16px;">
              
              <!-- الطرف الثاني (المقاول المحال عليه) على اليمين -->
              <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
                <h4 style="margin: 0 0 6px 0; color: #0d9488; font-size: 10.5pt; font-weight: bold;">عن الفريق الثاني (المقاول):</h4>
                <p style="margin: 4px 0; font-weight: bold; font-size: 10.5pt; color: #0f172a;">${item.contractor_name || item.contractorName}</p>
                <div style="height: 55px; margin: 10px 0; display: flex; align-items: center; justify-content: center;">
                  <span style="color: #94a3b8; font-size: 9pt; font-style: italic;">[ التوقيع وخاتم المقاول الرسمي ]</span>
                </div>
                <span style="font-size: 8.5pt; color: #64748b;">التاريخ: ${formattedContractDate}م</span>
              </div>

              <!-- الطرف الأول (البلدية) على اليسار -->
              <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
                <h4 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 10.5pt; font-weight: bold;">عن الفريق الأول (البلدية):</h4>
                <p style="margin: 4px 0; font-weight: bold; font-size: 10.5pt; color: #0f172a;">رئيس بلدية كفرنجة الجديدة</p>
                <div style="height: 55px; margin: 10px 0; display: flex; align-items: center; justify-content: center;">
                  <span style="color: #94a3b8; font-size: 9pt; font-style: italic;">[ التوقيع وخاتم البلدية الرسمي ]</span>
                </div>
                <span style="font-size: 8.5pt; color: #64748b;">التاريخ: ${formattedContractDate}م</span>
              </div>

            </div>

            <!-- شهود الاتفاقية بتصميم انسيابي مريح -->
            <div style="margin-top: 14px; padding: 8px 16px; background: #ffffff; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 9pt; color: #475569;">
              <div><strong>الشاهد الأول:</strong> ..................................... (التوقيع: ...............)</div>
              <div><strong>الشاهد الثاني:</strong> ..................................... (التوقيع: ...............)</div>
            </div>

            <!-- شريط التوثيق والأمان وحالة الاعتماد -->
            <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #64748b;">
              <div>🔒 <strong>حالة الاعتماد:</strong> <span style="font-weight:bold; color:${item.approval_stage === 'FINALIZED' ? '#059669' : '#d97706'};">${item.approval_stage === 'FINALIZED' ? 'معتمد رسمياً وساري المفعول' : 'مسودة قيد التدقيق بالسلسلة'}</span></div>
              <div>نظام إدارة المشاريع والأشغال الهندسية — بلدية كفرنجة الجديدة</div>
            </div>

          </div>
        </div>
      `;

      if (window.printEngine && typeof window.printEngine.printReport === 'function') {
        window.printEngine.printReport({
          title: `اتفاقية تنفيذ أعمال - ${item.contract_number || item.id}`,
          content: printBody
        });
      } else {
        const w = window.open('', '_blank');
        w.document.write(`
          <html dir="rtl"><head><title>طباعة اتفاقية تنفيذ أعمال - ${item.contract_number || item.id}</title>
          <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
          <style>@page{size:A4 portrait;margin:10mm 12mm;} body{font-family:'Tajawal',sans-serif;margin:0;padding:10px;} *{box-sizing:border-box;}</style>
          </head><body onload="window.print();">${printBody}</body></html>
        `);
        w.document.close();
      }
    }

    /* ─── طباعة السجل الإجمالي ─────────────────────────────────────────────── */
    _printRegistryReport() {
      const list = this._filterData();
      const totalVal = list.reduce((acc, c) => acc + (parseFloat(c.total_value || c.contractValue || 0) || 0), 0);
      const rows = list.map((item, idx) => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${item.id || item.contract_number}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${item.tender_id || item.procurement_id || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:600;">${item.title}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${item.contractor_name || item.contractorName || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-weight:bold;">${Number(item.total_value || item.contractValue || 0).toLocaleString()} د.أ</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${item.start_date || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${item.end_date || '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${item.approval_stage || 'مكتمل'}</td>
        </tr>
      `).join('');

      const content = `
        <div style="direction:rtl;font-family:'Tajawal',sans-serif;padding:10px;">
          <h2 style="text-align:center;color:#1e3a8a;margin-bottom:6px;">📋 سجل وجرد عقود المقاولات والضمانات البنكية</h2>
          <p style="text-align:center;font-size:0.85rem;color:#64748b;margin-top:0;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-JO')} | إجمالي العقود: ${list.length} | إجمالي القيمة: ${Number(totalVal).toLocaleString()} دينار أردني</p>
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:16px;">
            <thead style="background:#1e3a8a;color:#fff;">
              <tr>
                <th style="padding:8px;">#</th>
                <th style="padding:8px;">رقم العقد</th>
                <th style="padding:8px;">العطاء</th>
                <th style="padding:8px;">موضوع المشروع</th>
                <th style="padding:8px;">المقاول</th>
                <th style="padding:8px;">قيمة العقد</th>
                <th style="padding:8px;">تاريخ المباشرة</th>
                <th style="padding:8px;">الانتهاء التعاقدي</th>
                <th style="padding:8px;">مرحلة الاعتماد</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      if (window.printEngine && typeof window.printEngine.printReport === 'function') {
        window.printEngine.printReport({ title: 'سجل العقود والضمانات البنكية', content });
      } else {
        const w = window.open('', '_blank');
        w.document.write(`<html dir="rtl"><head><title>سجل العقود</title><style>@page{size:A4 landscape;margin:1cm;} body{font-family:sans-serif;}</style></head><body onload="window.print();">${content}</body></html>`);
        w.document.close();
      }
    }

    /* ─── بناء نوافذ إدارة الكفالات والضمانات البنكية ─────────────────────── */
    _buildGuaranteesModals() {
      if (document.getElementById('ecm-guarantee-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'ecm-guarantee-modal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:\'Tajawal\',sans-serif;';
      modal.innerHTML = `
        <div style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border-radius:14px;max-width:620px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 36px rgba(0,0,0,0.3);border:1px solid var(--border,#cbd5e1);overflow:hidden;">
          <div style="padding:14px 20px;background:linear-gradient(135deg,var(--primary,#1e3a8a),#0f172a);color:#fff;display:flex;justify-content:space-between;align-items:center;">
            <h3 id="ecm-gt-modal-title" style="margin:0;font-size:1.05rem;font-weight:800;">🏦 إدارة الكفالة البنكية</h3>
            <button id="ecm-gt-modal-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">✕</button>
          </div>
          <div id="ecm-gt-modal-body" style="padding:20px;overflow-y:auto;flex:1;">
            <!-- Guarantee Action Content -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('ecm-gt-modal-close')?.addEventListener('click', () => {
        document.getElementById('ecm-guarantee-modal').style.display = 'none';
      });
    }

    /* ─── تمديد صلاحية الكفالة البنكية ───────────────────────────────────── */
    _openExtendGuaranteeModal(contractId) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      titleEl.textContent = `🔄 تمديد الكفالة البنكية: ${item.guarantee_number || item.id}`;

      const currExp = item.guarantee_expiry_date || item.guaranteeExpiryDate || '';
      let suggestedDate = '';
      if (currExp) {
        const d = new Date(currExp);
        d.setDate(d.getDate() + 90);
        suggestedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      bodyEl.innerHTML = `
        <form id="ecm-extend-gt-form" style="display:flex;flex-direction:column;gap:14px;">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.85rem;line-height:1.6;">
            <div><strong>رقم الكفالة:</strong> <span style="color:#1e3a8a;font-weight:bold;">${item.guarantee_number || '-'}</span> | <strong>البنك:</strong> ${item.bank_name || '-'}</div>
            <div><strong>المقاول الملتزم:</strong> ${item.contractor_name || item.contractorName}</div>
            <div><strong>قيمة الكفالة:</strong> <span style="color:#0d9488;font-weight:bold;">${Number(item.guarantee_value || 0).toLocaleString()} د.أ</span></div>
            <div><strong>تاريخ الانتهاء الحالي:</strong> <span style="color:#ef4444;font-weight:bold;">${currExp || 'غير محدد'}</span></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">تاريخ التمديد الجديد *</label>
              <input type="date" id="ecm-ext-new-date" value="${suggestedDate}" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-weight:bold;font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">رقم كتاب التمديد / المرجعية</label>
              <input type="text" id="ecm-ext-ref" placeholder="مثال: EXT-2026/88" style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
          </div>

          <div>
            <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">📄 رفع صورة ملحق التمديد البنكي الورقي (اختياري)</label>
            <input type="file" id="ecm-ext-file" accept="image/*,application/pdf" style="display:block;margin-top:4px;font-size:0.8rem;width:100%;" />
          </div>

          <div>
            <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">ملاحظات وأسباب التمديد</label>
            <textarea id="ecm-ext-notes" rows="2" placeholder="تمديد بناءً على طلب المهندس المشرف أو تأخر التوريد..." style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;"></textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">
            <button type="button" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" class="ecm-btn-action" style="background:#64748b;color:#fff;">إلغاء</button>
            <button type="submit" class="ecm-btn-action" style="background:#059669;color:#fff;">💾 حفظ التمديد وتحديث السجل</button>
          </div>
        </form>
      `;

      document.getElementById('ecm-extend-gt-form').onsubmit = async (e) => {
        e.preventDefault();
        const newDate = document.getElementById('ecm-ext-new-date').value;
        const ref = document.getElementById('ecm-ext-ref').value;
        const notes = document.getElementById('ecm-ext-notes').value;
        const fileInput = document.getElementById('ecm-ext-file');

        let attachData = item.guarantee_attachment || null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
          attachData = await this._uploadFile(fileInput.files[0]);
        }

        item.guarantee_expiry_date = newDate;
        item.guarantee_attachment = attachData;
        if (!Array.isArray(item.guarantee_extensions)) item.guarantee_extensions = [];
        item.guarantee_extensions.push({
          extended_to: newDate,
          ref: ref,
          notes: notes,
          date: new Date().toISOString(),
          by: this._user?.name || 'مدير العقود'
        });

        await this._saveContract(item, true);
        document.getElementById('ecm-guarantee-modal').style.display = 'none';
        if (typeof showToast === 'function') showToast('✅ تم تمديد الكفالة وتحديث السجل والتنبيهات بنجاح');
      };

      modal.style.display = 'flex';
    }

    /* ─── رفع مستند ورقي للكفالة ────────────────────────────────────────── */
    _uploadAttachmentPrompt(contractId, guaranteeNumber = null) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      const gNum = guaranteeNumber || item.guarantee_number || item.id;
      titleEl.textContent = `📤 رفع وحفظ وثيقة الكفالة الورقية (${gNum})`;

      bodyEl.innerHTML = `
        <form id="ecm-upload-gt-form" style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.85rem;line-height:1.6;">
            <div><strong>رقم الكفالة:</strong> <span style="color:#1e3a8a;font-weight:bold;">${gNum}</span></div>
            <div><strong>البنك الضامن:</strong> ${item.bank_name || 'البنك المعتمد'}</div>
            <div><strong>المقاول الملتزم:</strong> ${item.contractor_name || item.contractorName}</div>
          </div>

          <div style="border:2px dashed #0284c7;background:rgba(2,132,199,0.04);border-radius:8px;padding:24px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:8px;">📄</div>
            <label style="font-weight:bold;color:#0284c7;font-size:0.9rem;display:block;margin-bottom:8px;">اختر صورة أو ملف PDF لوثيقة الكفالة الصادرة من البنك</label>
            <input type="file" id="ecm-upload-file-input" accept="image/*,application/pdf" required style="font-size:0.85rem;display:inline-block;" />
            <div id="ecm-upload-live-preview" style="margin-top:10px;font-size:0.8rem;color:#059669;font-weight:bold;"></div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" class="ecm-btn-action" style="background:#64748b;color:#fff;">إلغاء</button>
            <button type="submit" class="ecm-btn-action" style="background:#059669;color:#fff;font-weight:bold;">📤 حفظ وتثبيت الوثيقة</button>
          </div>
        </form>
      `;

      document.getElementById('ecm-upload-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const prev = document.getElementById('ecm-upload-live-preview');
        if (file && prev) {
          prev.textContent = `✅ تم تحديد: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        }
      });

      document.getElementById('ecm-upload-gt-form').onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('ecm-upload-file-input');
        if (fileInput && fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const submitBtn = e.target.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ جاري رفع وتوثيق الملف...';
          }

          const attachObj = await this._uploadFile(file);

          if (guaranteeNumber && Array.isArray(item.additional_guarantees)) {
            const match = item.additional_guarantees.find(ag => (ag.number || ag.guaranteeNumber) === guaranteeNumber);
            if (match) match.attachment = attachObj;
            else item.guarantee_attachment = attachObj;
          } else {
            item.guarantee_attachment = attachObj;
          }

          await this._saveContract(item, true);
          document.getElementById('ecm-guarantee-modal').style.display = 'none';
          if (typeof showToast === 'function') {
            showToast('📄 تم رفع وتوثيق الكفالة الورقية في قاعدة البيانات بنجاح');
          } else {
            alert('📄 تم رفع وتوثيق الكفالة الورقية في قاعدة البيانات بنجاح');
          }
        }
      };

      modal.style.display = 'flex';
    }

    /* ─── معاينة الوثيقة المرفوعة مع دعم الصور وملفات PDF ─────────────────── */
    _viewAttachment(contractId, guaranteeNumber = null) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) {
        alert('العقد غير موجود');
        return;
      }

      let att = null;
      let gtTitle = item.guarantee_number || item.id;

      if (guaranteeNumber) {
        if (item.guarantee_number === guaranteeNumber) {
          att = item.guarantee_attachment;
          gtTitle = item.guarantee_number;
        } else if (Array.isArray(item.additional_guarantees)) {
          const match = item.additional_guarantees.find(ag => (ag.number || ag.guaranteeNumber) === guaranteeNumber);
          if (match) {
            att = match.attachment;
            gtTitle = match.number || guaranteeNumber;
          }
        }
      } else {
        att = item.guarantee_attachment;
      }

      if (!att) {
        if (confirm('لم يتم إرفاق وثيقة ورقية لهذه الكفالة بعد. هل ترغب في رفع وثيقة الكفالة الورقية الآن؟')) {
          this._uploadAttachmentPrompt(contractId, guaranteeNumber);
        }
        return;
      }

      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      titleEl.textContent = `📄 معاينة وثيقة الكفالة الورقية: ${gtTitle}`;

      let targetUrl = att.url || '';
      if (!targetUrl && att.dataUrl) {
        if (att.dataUrl.startsWith('data:application/pdf')) {
          try {
            const byteCharacters = atob(att.dataUrl.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            targetUrl = URL.createObjectURL(blob);
          } catch (e) {
            targetUrl = att.dataUrl;
          }
        } else {
          targetUrl = att.dataUrl;
        }
      }

      const isPdf = (att.type && att.type.includes('pdf')) || (att.name && att.name.toLowerCase().endsWith('.pdf')) || (targetUrl && (targetUrl.includes('.pdf') || targetUrl.startsWith('blob:')));
      const isImg = (att.type && att.type.startsWith('image/')) || (att.name && /\.(png|jpe?g|webp|gif)$/i.test(att.name)) || (targetUrl && (targetUrl.startsWith('data:image') || /\.(png|jpe?g|webp|gif)$/i.test(targetUrl)));

      let previewHtml = '';
      if (isPdf) {
        previewHtml = `
          <div style="width:100%;height:520px;background:#f8fafc;border:1.5px solid #0284c7;border-radius:8px;overflow:hidden;box-shadow:inset 0 2px 6px rgba(0,0,0,0.08);">
            <iframe src="${targetUrl}#toolbar=1" width="100%" height="100%" style="border:none;"></iframe>
          </div>
        `;
      } else if (isImg) {
        previewHtml = `
          <div style="text-align:center;background:#0f172a;padding:14px;border-radius:8px;max-height:520px;overflow:auto;">
            <img src="${targetUrl}" alt="${att.name || 'وثيقة الكفالة'}" style="max-width:100%;max-height:480px;border-radius:4px;object-fit:contain;box-shadow:0 4px 12px rgba(0,0,0,0.3);" />
          </div>
        `;
      } else {
        previewHtml = `
          <div style="background:#f8fafc;padding:36px;border-radius:8px;text-align:center;border:1px solid #cbd5e1;">
            <div style="font-size:3.5rem;color:#0284c7;margin-bottom:12px;">📜</div>
            <h3 style="margin:0 0 6px 0;color:#1e3a8a;">وثيقة كفالة بنكية ورقية معتمدة</h3>
            <p style="margin:0;font-size:0.85rem;color:#64748b;">اسم الملف: <strong>${att.name || 'وثيقة الكفالة'}</strong></p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.82rem;">
            <div><strong>اسم الملف:</strong> <span style="color:#1e3a8a;font-weight:bold;">${att.name || 'وثيقة الكفالة'}</span> | <strong>الحجم:</strong> ${Math.round((att.size || 1024) / 1024)} KB</div>
            <div><strong>تاريخ الرفع:</strong> ${att.date || new Date().toISOString().split('T')[0]}</div>
          </div>
          
          ${previewHtml}

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;border-top:1px solid #cbd5e1;padding-top:10px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:8px;">
              ${targetUrl ? `<a href="${targetUrl}" download="${att.name || 'guarantee_document.pdf'}" class="ecm-btn-action" style="background:#059669;color:#fff;text-decoration:none;">📥 تنزيل المستند</a>` : ''}
              ${targetUrl ? `<a href="${targetUrl}" target="_blank" class="ecm-btn-action" style="background:#0284c7;color:#fff;text-decoration:none;">🔗 فتح في نافذة مستقلة</a>` : ''}
              <button class="ecm-btn-action" onclick="window.contractsManager._uploadAttachmentPrompt('${contractId}', '${guaranteeNumber || ''}')" style="background:var(--primary,#1e3a8a);color:#fff;">🔄 استبدال الملف</button>
            </div>
            <button class="ecm-btn-action" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" style="background:#64748b;color:#fff;">✕ إغلاق</button>
          </div>
        </div>
      `;

      modal.style.display = 'flex';
    }

    /* ─── رفع وأرشفة وثيقة العقد الموقعة والمختومة حياً ───────────────── */
    _uploadContractAttachmentPrompt(contractId) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      titleEl.textContent = `📤 رفع وأرشفة نسخة العقد الموقعة حياً (${item.id})`;

      bodyEl.innerHTML = `
        <form id="ecm-upload-cnt-form" style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.85rem;line-height:1.6;">
            <div><strong>رقم العقد:</strong> <span style="color:#1e3a8a;font-weight:bold;">${item.id}</span> (${item.contract_number || 'عام'})</div>
            <div><strong>موضوع المشروع:</strong> ${item.title}</div>
            <div><strong>المقاول المحال عليه:</strong> ${item.contractor_name || item.contractorName || '-'}</div>
            <div><strong>القيمة الإجمالية:</strong> ${Number(item.total_value || 0).toLocaleString()} د.أ</div>
          </div>

          <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);padding:10px 14px;border-radius:8px;font-size:0.82rem;color:#b91c1c;line-height:1.5;">
            ⚠️ <strong>تنبيه توثيقي هام:</strong> يجب رفع النسخة الكاملة الموقعة حياً والمختومة رسمياً بالخاتم الحي من عطوفة رئيس البلدية والمقاول المعتمد لاستكمال الأرشفة القانونية للعقد وتفعيل كافة العمليات المرتبطة به.
          </div>

          <div style="border:2px dashed #059669;background:rgba(5,150,105,0.04);border-radius:8px;padding:24px;text-align:center;">
            <div style="font-size:2.5rem;margin-bottom:8px;">📜</div>
            <label style="font-weight:bold;color:#059669;font-size:0.9rem;display:block;margin-bottom:8px;">اختر ملف PDF أو صورة واضحة لوثيقة العقد الموقعة حياً</label>
            <input type="file" id="ecm-upload-cnt-file-input" accept="image/*,application/pdf" required style="font-size:0.85rem;display:inline-block;" />
            <div id="ecm-upload-cnt-live-preview" style="margin-top:10px;font-size:0.8rem;color:#059669;font-weight:bold;"></div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" class="ecm-btn-action" style="background:#64748b;color:#fff;">إلغاء</button>
            <button type="submit" class="ecm-btn-action" style="background:#059669;color:#fff;font-weight:bold;">📤 حفظ وتثبيت العقد الموقع بالسجل</button>
          </div>
        </form>
      `;

      document.getElementById('ecm-upload-cnt-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const prev = document.getElementById('ecm-upload-cnt-live-preview');
        if (file && prev) {
          prev.textContent = `✅ تم تحديد: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        }
      });

      document.getElementById('ecm-upload-cnt-form').onsubmit = async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('ecm-upload-cnt-file-input');
        if (fileInput && fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const submitBtn = e.target.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ جاري رفع وتوثيق العقد...';
          }

          const attachObj = await this._uploadFile(file);
          item.signed_contract_attachment = attachObj;

          await this._saveContract(item, true);
          document.getElementById('ecm-guarantee-modal').style.display = 'none';
          if (typeof showToast === 'function') {
            showToast('📄 تم رفع وتوثيق نسخة العقد الموقعة حياً بنجاح وتحديث السجل والتنبيهات');
          } else {
            alert('📄 تم رفع وتوثيق نسخة العقد الموقعة حياً بنجاح وتحديث السجل والتنبيهات');
          }
        }
      };

      modal.style.display = 'flex';
    }

    /* ─── معاينة وثيقة العقد الموقعة حياً مع دعم الصور وملفات PDF ───────── */
    _viewContractAttachment(contractId) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) {
        alert('العقد غير موجود');
        return;
      }

      const att = item.signed_contract_attachment;
      if (!att) {
        if (confirm('لم يتم رفع نسخة العقد الموقعة حياً بعد. هل ترغب في رفع النسخة الموقعة الآن؟')) {
          this._uploadContractAttachmentPrompt(contractId);
        }
        return;
      }

      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      titleEl.textContent = `📄 معاينة وثيقة العقد الموقعة والمختومة حياً: ${item.id}`;

      let targetUrl = att.url || '';
      if (!targetUrl && att.dataUrl) {
        if (att.dataUrl.startsWith('data:application/pdf')) {
          try {
            const byteCharacters = atob(att.dataUrl.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            targetUrl = URL.createObjectURL(blob);
          } catch (e) {
            targetUrl = att.dataUrl;
          }
        } else {
          targetUrl = att.dataUrl;
        }
      }

      const isPdf = (att.type && att.type.includes('pdf')) || (att.name && att.name.toLowerCase().endsWith('.pdf')) || (targetUrl && (targetUrl.includes('.pdf') || targetUrl.startsWith('blob:')));
      const isImg = (att.type && att.type.startsWith('image/')) || (att.name && /\.(png|jpe?g|webp|gif)$/i.test(att.name)) || (targetUrl && (targetUrl.startsWith('data:image') || /\.(png|jpe?g|webp|gif)$/i.test(targetUrl)));

      let previewHtml = '';
      if (isPdf) {
        previewHtml = `
          <div style="width:100%;height:520px;background:#f8fafc;border:1.5px solid #059669;border-radius:8px;overflow:hidden;box-shadow:inset 0 2px 6px rgba(0,0,0,0.08);">
            <iframe src="${targetUrl}#toolbar=1" width="100%" height="100%" style="border:none;"></iframe>
          </div>
        `;
      } else if (isImg) {
        previewHtml = `
          <div style="text-align:center;background:#0f172a;padding:14px;border-radius:8px;max-height:520px;overflow:auto;">
            <img src="${targetUrl}" alt="${att.name || 'وثيقة العقد الموقع'}" style="max-width:100%;max-height:480px;border-radius:4px;object-fit:contain;box-shadow:0 4px 12px rgba(0,0,0,0.3);" />
          </div>
        `;
      } else {
        previewHtml = `
          <div style="background:#f8fafc;padding:36px;border-radius:8px;text-align:center;border:1px solid #cbd5e1;">
            <div style="font-size:3.5rem;color:#059669;margin-bottom:12px;">📜</div>
            <h3 style="margin:0 0 6px 0;color:#1e3a8a;">وثيقة العقد الموقعة والمختومة حياً</h3>
            <p style="margin:0;font-size:0.85rem;color:#64748b;">اسم الملف: <strong>${att.name || 'العقد الموقع'}</strong></p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.82rem;">
            <div><strong>اسم الملف:</strong> <span style="color:#059669;font-weight:bold;">${att.name || 'وثيقة العقد الموقع'}</span> | <strong>الحجم:</strong> ${Math.round((att.size || 1024) / 1024)} KB</div>
            <div><strong>تاريخ الرفع:</strong> ${att.date || new Date().toISOString().split('T')[0]}</div>
          </div>
          
          ${previewHtml}

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;border-top:1px solid #cbd5e1;padding-top:10px;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;gap:8px;">
              ${targetUrl ? `<a href="${targetUrl}" download="${att.name || 'signed_contract.pdf'}" class="ecm-btn-action" style="background:#059669;color:#fff;text-decoration:none;">📥 تنزيل المستند</a>` : ''}
              ${targetUrl ? `<a href="${targetUrl}" target="_blank" class="ecm-btn-action" style="background:#0284c7;color:#fff;text-decoration:none;">🔗 فتح في نافذة مستقلة</a>` : ''}
              <button class="ecm-btn-action" onclick="window.contractsManager._uploadContractAttachmentPrompt('${contractId}')" style="background:var(--primary,#1e3a8a);color:#fff;">🔄 استبدال النسخة</button>
            </div>
            <button class="ecm-btn-action" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" style="background:#64748b;color:#fff;">✕ إغلاق</button>
          </div>
        </div>
      `;

      modal.style.display = 'flex';
    }

    /* ─── إضافة كفالة جديدة / كفالة صيانة إضافية ─────────────────────────── */
    _openAddGuaranteeModal() {
      const modal = document.getElementById('ecm-guarantee-modal');
      const titleEl = document.getElementById('ecm-gt-modal-title');
      const bodyEl = document.getElementById('ecm-gt-modal-body');
      if (!modal || !bodyEl) return;

      titleEl.textContent = '➕ تسجيل وتوثيق كفالة بنكية إضافية / كفالة صيانة';

      const contractOptions = this.activeData.map(c => `
        <option value="${c.id}">
          ${c.id} - ${c.title} (${c.contractor_name || c.contractorName || 'المقاول'}) - القيمة: ${Number(c.total_value || 0).toLocaleString()} د.أ
        </option>
      `).join('');

      bodyEl.innerHTML = `
        <form id="ecm-add-gt-form" style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">العقد والمشروع المرتبط *</label>
            <select id="ecm-add-gt-contract" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;">
              <option value="">-- اختر العقد المرتبط بالكفالة --</option>
              ${contractOptions}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">نوع الكفالة والضمان *</label>
              <select id="ecm-add-gt-type" style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;">
                <option value="كفالة صيانة (5%)">🛡️ كفالة صيانة (5%)</option>
                <option value="كفالة حسن تنفيذ (10%)">💎 كفالة حسن تنفيذ (10%)</option>
                <option value="كفالة دفعة مقدمة">💰 كفالة دفعة مقدمة</option>
                <option value="تأمين وضمان آخر">📜 تأمين وضمان آخر</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">رقم الكفالة البنكية *</label>
              <input type="text" id="ecm-add-gt-number" placeholder="مثال: BG-MNT-2026/01" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">البنك المصدر للكفالة *</label>
              <input type="text" id="ecm-add-gt-bank" placeholder="مثال: بنك الإسكان" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
            <div>
              <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">قيمة الكفالة (د.أ) *</label>
              <input type="number" id="ecm-add-gt-val" step="0.01" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-size:0.85rem;" />
            </div>
          </div>

          <div>
            <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">تاريخ انتهاء وصلاحية الكفالة *</label>
            <input type="date" id="ecm-add-gt-exp" required style="background:var(--bg-card,#fff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);padding:8px 12px;border-radius:6px;width:100%;font-weight:bold;font-size:0.85rem;" />
          </div>

          <div>
            <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted,#64748b);">📄 رفع صورة أو ملف الكفالة الورقية (اختياري)</label>
            <input type="file" id="ecm-add-gt-file" accept="image/*,application/pdf" style="font-size:0.8rem;width:100%;margin-top:4px;" />
            <div id="ecm-add-gt-file-preview" style="margin-top:4px;font-size:0.75rem;color:#059669;font-weight:bold;"></div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">
            <button type="button" onclick="document.getElementById('ecm-guarantee-modal').style.display='none'" class="ecm-btn-action" style="background:#64748b;color:#fff;">إلغاء</button>
            <button type="submit" class="ecm-btn-action" style="background:#059669;color:#fff;font-weight:bold;">💾 حفظ وتوثيق الكفالة بالسجل</button>
          </div>
        </form>
      `;

      document.getElementById('ecm-add-gt-file')?.addEventListener('change', (e) => {
        const f = e.target.files[0];
        const p = document.getElementById('ecm-add-gt-file-preview');
        if (f && p) p.textContent = `✅ تم اختيار الملف: ${f.name} (${Math.round(f.size / 1024)} KB)`;
      });

      // حساب 5% تلقائياً عند اختيار كفالة صيانة
      document.getElementById('ecm-add-gt-contract')?.addEventListener('change', (e) => {
        const cId = e.target.value;
        const contract = this.activeData.find(c => String(c.id) === String(cId));
        if (contract) {
          const val = parseFloat(contract.total_value || 0);
          const type = document.getElementById('ecm-add-gt-type').value;
          const rate = type.includes('صيانة') ? 0.05 : 0.10;
          document.getElementById('ecm-add-gt-val').value = (val * rate).toFixed(2);
        }
      });

      document.getElementById('ecm-add-gt-form').onsubmit = async (e) => {
        e.preventDefault();
        const cId = document.getElementById('ecm-add-gt-contract').value;
        const contract = this.activeData.find(c => String(c.id) === String(cId));
        if (!contract) return;

        const fileInput = document.getElementById('ecm-add-gt-file');
        let attachData = null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
          attachData = await this._uploadFile(fileInput.files[0]);
        }

        const newGuarantee = {
          number: document.getElementById('ecm-add-gt-number').value,
          bank: document.getElementById('ecm-add-gt-bank').value,
          type: document.getElementById('ecm-add-gt-type').value,
          value: parseFloat(document.getElementById('ecm-add-gt-val').value || 0),
          expiryDate: document.getElementById('ecm-add-gt-exp').value,
          attachment: attachData,
          createdAt: new Date().toISOString()
        };

        if (!Array.isArray(contract.additional_guarantees)) contract.additional_guarantees = [];
        contract.additional_guarantees.push(newGuarantee);

        await this._saveContract(contract, true);
        document.getElementById('ecm-guarantee-modal').style.display = 'none';
        if (typeof showToast === 'function') showToast('✅ تم تسجيل الكفالة الإضافية وربطها بالعقد بنجاح');
      };

      modal.style.display = 'flex';
    }

    /* ─── طباعة كتاب رسمي بمطالبة وتمديد الكفالة للبنك ────────────────────── */
    _printGuaranteeDemandLetter(contractId) {
      const item = this.activeData.find(c => String(c.id) === String(contractId));
      if (!item) return;

      const todayStr = new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const expStr = item.guarantee_expiry_date || item.guaranteeExpiryDate || '-';
      const gVal = parseFloat(item.guarantee_value || item.guaranteeValue || 0);

      const content = `
        <div style="font-family:'Cairo','Tajawal',sans-serif;direction:rtl;padding:20px;color:#0f172a;line-height:1.8;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:12px;margin-bottom:20px;">
            <div>
              <h3 style="margin:0;color:#1e3a8a;">المملكة الأردنية الهاشمية</h3>
              <h4 style="margin:2px 0;color:#475569;">وزارة الإدارة المحلية</h4>
              <h2 style="margin:2px 0;color:#0f172a;font-weight:bold;">بلدية كفرنجة الجديدة</h2>
              <p style="margin:0;font-size:9pt;color:#64748b;">مديرية الأشغال والخدمات الهندسية</p>
            </div>
            <div style="text-align:center;">
              <img src="/logo.jpg" onerror="this.src='/logo.png';this.onerror=null;" alt="شعار البلدية" style="max-height:80px;" />
            </div>
            <div style="text-align:left;font-size:9.5pt;background:#f8fafc;padding:8px 12px;border-radius:6px;border:1px solid #cbd5e1;">
              <div><strong>الرقم:</strong> ب ك / كفالات / ${item.id}</div>
              <div><strong>التاريخ:</strong> ${todayStr}م</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <p style="font-size:11pt;font-weight:bold;margin:0 0 4px 0;">عطوفة مدير / <strong>${item.bank_name || 'البنك المحترم'}</strong> المحترم،</p>
            <p style="font-size:10pt;color:#475569;margin:0;">نسخة إلى السادة / <strong>${item.contractor_name || item.contractorName}</strong> المحترمين</p>
          </div>

          <div style="text-align:center;margin:16px 0;background:#f1f5f9;padding:8px;border-radius:6px;">
            <h3 style="margin:0;color:#1e3a8a;font-size:12pt;">الموضوع: طلب تمديد كفالة حسن التنفيذ رقم (${item.guarantee_number || item.id})</h3>
          </div>

          <p style="font-size:10.5pt;text-align:justify;line-height:1.8;">
            تحية طيبة وبعد،<br/><br/>
            بالإشارة إلى كفالة حسن التنفيذ المذكورة أعلاه والصادرة من طرفكم لصالح <strong>بلدية كفرنجة الجديدة</strong>، والخاصة بمشروع <strong>${item.title}</strong> (العطاء رقم: <strong>${item.tender_id || 'عام'}</strong>)، والبالغة قيمتها <strong>(${Number(gVal).toLocaleString()} دينار أردني)</strong>، وحيث أن صلاحية الكفالة تنتهي بتاريخ <strong>${expStr}</strong>، ولما تقتضيه المصلحة العامة واستكمال الأعمال التعاقدية؛
          </p>

          <p style="font-size:10.5pt;text-align:justify;line-height:1.8;font-weight:bold;color:#1e3a8a;">
            يرجى التكرم بالعمل على تمديد سريان مفعول الكفالة المذكورة لمدة (90) يوماً إضافية اعتباراً من تاريخ انتهائها، وتزويدنا بكتاب التمديد الأصلي بالسرعة الممكنة، وبخلاف ذلك نرجو اعتبار هذا الكتاب بمثابة مطالبة رسمية بمصادرة ودفع كامل قيمة الكفالة لحساب البلدية فوراً ودون تأخير.
          </p>

          <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;">
            <div style="font-size:9.5pt;color:#64748b;">
              <div>المهندس المشرف: ${item.supervising_engineer || 'م. أحمد الخشمان'}</div>
              <div>مديرية الأشغال الهندسية</div>
            </div>
            <div style="text-align:center;">
              <p style="font-weight:bold;font-size:11pt;margin:0 0 50px 0;">واقبلوا فائق الاحترام والتقدير،،،</p>
              <h4 style="margin:0;color:#1e3a8a;font-size:12pt;font-weight:bold;">رئيس بلدية كفرنجة الجديدة</h4>
            </div>
          </div>
        </div>
      `;

      if (window.printEngine && typeof window.printEngine.printReport === 'function') {
        window.printEngine.printReport({ title: `كتاب تمديد كفالة - ${item.guarantee_number || item.id}`, content });
      } else {
        const w = window.open('', '_blank');
        w.document.write(`<html dir="rtl"><head><title>كتاب تمديد كفالة</title><style>@page{size:A4 portrait;margin:1.5cm;} body{font-family:sans-serif;}</style></head><body onload="window.print();">${content}</body></html>`);
        w.document.close();
      }
    }

    /* ─── طباعة كشف وسجل الكفالات البنكية ─────────────────────────────────── */
    _printGuaranteesLedger() {
      const list = this.activeData.filter(c => c.guarantee_number || c.guaranteeNumber);
      const totalVal = list.reduce((sum, c) => sum + parseFloat(c.guarantee_value || c.guaranteeValue || 0), 0);
      const now = new Date();

      const rows = list.map((c, i) => {
        const expStr = c.guarantee_expiry_date || c.guaranteeExpiryDate || '-';
        let st = 'سارية';
        if (expStr !== '-') {
          const diff = Math.ceil((new Date(expStr) - now) / 86400000);
          if (diff < 0) st = 'منتهية 🔴';
          else if (diff <= 60) st = 'تستحق قريباً 🟡';
          else st = 'سارية 🟢';
        }

        return `
          <tr style="border-bottom:1px solid #cbd5e1;">
            <td style="padding:6px;text-align:center;">${i + 1}</td>
            <td style="padding:6px;font-weight:bold;">${c.guarantee_number || '-'}</td>
            <td style="padding:6px;">${c.bank_name || '-'}</td>
            <td style="padding:6px;">${c.contractor_name || c.contractorName}</td>
            <td style="padding:6px;">${c.title}</td>
            <td style="padding:6px;font-weight:bold;color:#0d9488;">${Number(c.guarantee_value || 0).toLocaleString()} د.أ</td>
            <td style="padding:6px;">${expStr}</td>
            <td style="padding:6px;text-align:center;">${st}</td>
          </tr>
        `;
      }).join('');

      const content = `
        <div style="direction:rtl;font-family:'Tajawal',sans-serif;padding:10px;">
          <h2 style="text-align:center;color:#1e3a8a;margin-bottom:4px;">🏦 كشف وجرد الكفالات والضمانات البنكية المعتمدة</h2>
          <p style="text-align:center;font-size:0.85rem;color:#64748b;margin-top:0;">بلدية كفرنجة الجديدة | إجمالي الكفالات: ${list.length} | القيمة الإجمالية: ${Number(totalVal).toLocaleString()} دينار أردني</p>
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:14px;">
            <thead style="background:#1e3a8a;color:#fff;">
              <tr>
                <th style="padding:8px;">#</th>
                <th style="padding:8px;">رقم الكفالة</th>
                <th style="padding:8px;">البنك الضامن</th>
                <th style="padding:8px;">المقاول</th>
                <th style="padding:8px;">المشروع</th>
                <th style="padding:8px;">قيمة الكفالة</th>
                <th style="padding:8px;">تاريخ الانتهاء</th>
                <th style="padding:8px;">الحالة</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;

      if (window.printEngine && typeof window.printEngine.printReport === 'function') {
        window.printEngine.printReport({ title: 'كشف الكفالات والضمانات البنكية', content });
      } else {
        const w = window.open('', '_blank');
        w.document.write(`<html dir="rtl"><head><title>كشف الكفالات البنكية</title><style>@page{size:A4 landscape;margin:1cm;} body{font-family:sans-serif;}</style></head><body onload="window.print();">${content}</body></html>`);
        w.document.close();
      }
    }

    /* ─── تصدير Excel / CSV ──────────────────────────────────────────────── */
    _exportCSV() {
      const list = this._filterData();
      if (list.length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const headers = ['رقم العقد', 'رقم العطاء', 'عنوان المشروع', 'المقاول المنفذ', 'قيمة العقد (د.أ)', 'تاريخ الإحالة', 'تاريخ المباشرة', 'مدة التنفيذ (يوم)', 'تاريخ الانتهاء التعاقدي', 'البنك المصدر للكفالة', 'رقم الكفالة', 'قيمة الكفالة (د.أ)', 'تاريخ انتهاء الكفالة', 'مرحلة الاعتماد', 'الحالة التشغيلية'];

      const rows = list.map(c => [
        `"${c.id || c.contract_number || ''}"`,
        `"${c.tender_id || c.procurement_id || ''}"`,
        `"${(c.title || '').replace(/"/g, '""')}"`,
        `"${(c.contractor_name || c.contractorName || '').replace(/"/g, '""')}"`,
        c.total_value || c.contractValue || 0,
        `"${c.award_date || ''}"`,
        `"${c.start_date || c.startDate || ''}"`,
        c.execution_period_days || 30,
        `"${c.end_date || c.endDate || ''}"`,
        `"${c.bank_name || c.bankName || ''}"`,
        `"${c.guarantee_number || c.guaranteeNumber || ''}"`,
        c.guarantee_value || c.guaranteeValue || 0,
        `"${c.guarantee_expiry_date || c.guaranteeExpiryDate || ''}"`,
        `"${c.approval_stage || ''}"`,
        `"${c.status || ''}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `سجل_العقود_والضمانات_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  window.contractsManager = new ContractsManager();
  window.initContractManagementUI = function () {
    const el = document.getElementById('page-contracts');
    if (el) window.contractsManager.init(el);
  };
})();
