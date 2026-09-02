/**
 * Unified Excavation & Service Connection Permits Manager v4.8 (Enterprise Professional Edition)
 * وحدة إدارة وإصدار وتتبع تصاريح الحفر وتزويد الخدمات العامة — بلدية كفرنجة الجديدة
 * مديرية الأشغال والخدمات الهندسية — قسم تصاريح الحفر والتنسيق الميداني
 * ─────────────────────────────────────────────────────────────────────────────
 * دقة هندسية وجغرافية كاملة GIS، محرر ديناميكي لبنود وشروط التصريح المخصصة،
 * تتبع كفالات إعادة الحال، وتوليد التقارير الرسمية المعتمدة.
 */
'use strict';

class ComprehensiveExcavationPermitsManager {

  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map          = null;
    this.drawMap      = null;
    this.drawLayer    = null;
    this.drawnCoords  = []; // [[lat, lng], ...]
    this.drawMarkers  = []; // Draggable Leaflet markers
    this.permitsLayer = null;
    this.activeData   = [];
    this._editingId   = null;
    this._drawMode    = 'POLYLINE'; // 'POLYLINE' or 'POINT'
    this._drawing     = false;
    this._polyline    = null;
    this._filterType  = 'ALL';
    this._sortField   = 'id';
    this._sortAsc     = false;
    this._activeClauses = []; // Array of custom clauses

    this._readUser();
    this._loadLocalCache();
    this._buildUI();
  }

  /* ─── قائمة البنود والشروط الهندسية الافتراضية ─────────────────────── */
  _getDefaultClauses() {
    return [
      {
        id: 'cls-1',
        enabled: true,
        title: 'بند الدك الهندسي وطبقات التأسيس',
        text: 'الالتزام بدك طبقات البيسكورس الصالح هندسياً على طبقات سماكة 20-25 سم بنسبة دمك لا تقل عن 98% وتوريد نتائج فحص الكثافة المخبرية المعتمدة للمهندس المشرف.'
      },
      {
        id: 'cls-2',
        enabled: true,
        title: 'بند إعادة التعبيد والخلطة الإسفلتية',
        text: 'الالتزام بالقص المستقيم لحواف الإسفلت بالمنشار الميكانيكي، ورش مادة اللصق RC2، والتعبيد بخلطة إسفلتية ساخنة مطابقة لمواصفات وزارة الإدارة المحلية وبسماكة لا تقل عن 5 سم بعد الدحل.'
      },
      {
        id: 'cls-3',
        enabled: true,
        title: 'بند السلامة العامة والشواخص المرورية',
        text: 'تأمين موقع الحفرية بالحواجز البلاستيكية، الأشرطة الفسفورية العاكسة، والإنارة الوامضة ليلاً، مع توفير ممرات آمنة للمشاة وتحويلات سير مرورية معتمدة.'
      },
      {
        id: 'cls-4',
        enabled: true,
        title: 'بند التنسيق الميداني مع شبكات الخدمات',
        text: 'التنسيق المسبق قبل الحفر مع مندوبي سلطة المياه وشركة الكهرباء والاتصالات والدفاع المدني لتجنب الإضرار بالبنية التحتية القائمة.'
      },
      {
        id: 'cls-5',
        enabled: true,
        title: 'بند المدة الزمنية ومصادرة كفالة التأمين',
        text: 'إنجاز كافة الأعمال وإعادة الموقع إلى وضعه الأصلي قبل تاريخ انتهاء التصريح؛ ويحق للبلدية مصادرة كفالة التأمين وتنفيذ إعادة التعبيد على حساب المستفيد عند أي تأخير.'
      },
      {
        id: 'cls-6',
        enabled: true,
        title: 'بند ترحيل الأنقاض ونظافة الموقع',
        text: 'ترحيل المخلفات والأتربة والأنقاض الناتجة عن الحفر أولاً بأول إلى المكبات الرسمية المعتمدة وإبقاء الشارع نظيفاً وخالياً من العوائق.'
      }
    ];
  }

  /* ─── صلاحيات المستخدم ─────────────────────────────────────────────── */
  _readUser() {
    try {
      const raw = sessionStorage.getItem('engineeringUser');
      this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
    } catch { this._user = null; }
    const role = (this._user?.role || '').toLowerCase();
    if (typeof window.hasPermission === 'function' && (window.hasPermission('PERMITS.CREATE') || window.hasPermission('*'))) {
      this.canWrite = true;
    } else {
      this.canWrite = !role || ['admin', 'director_public_works', 'head_of_roads', 'roads_engineer', 'site_inspector', 'quantity_surveyor'].includes(role);
    }
    this.isAdmin  = !role || role === 'admin' || role === 'director_public_works';
  }

  /* ─── التخزين المحلي الاحتياطي ──────────────────────────────────────── */
  _loadLocalCache() {
    try {
      const stored = localStorage.getItem('epams_excavation_permits_v4');
      if (stored) this.activeData = JSON.parse(stored);
    } catch (e) {
      console.warn('[EPAMS] Cache load error:', e);
    }
    if (!Array.isArray(this.activeData)) this.activeData = [];
  }

  _saveLocalCache() {
    try {
      localStorage.setItem('epams_excavation_permits_v4', JSON.stringify(this.activeData));
    } catch (e) {
      console.warn('[EPAMS] Cache save error:', e);
    }
  }

  _nextCode() {
    const y = new Date().getFullYear();
    let maxSeq = 0;
    const regex = new RegExp(`PERM-${y}-(\\d+)`, 'i');
    const regexAr = new RegExp(`(?:تصريح|حفر|PERM)[-_]?${y}[-_]?(\\d+)`, 'i');

    (this.activeData || []).forEach(item => {
      const code = String(item.code || item.permit_number || item.id || '');
      const match = code.match(regex) || code.match(regexAr);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });

    if (maxSeq === 0) {
      maxSeq = (this.activeData || []).length;
    }
    const nextSeq = maxSeq + 1;
    return `PERM-${y}-${String(nextSeq).padStart(3, '0')}`;
  }

  /* ─── بناء الواجهة الرئيسية ─────────────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <div id="epm-root" style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);padding:18px;
            border-radius:12px;direction:rtl;font-family:'Tajawal',system-ui,sans-serif;border:1px solid var(--border,#cbd5e1);position:relative;z-index:1;isolation:isolate;transition:background 0.3s, color 0.3s;">

        <!-- شريط الأدوات والتحكم العلوي -->
        <div id="epm-toolbar" style="display:flex;justify-content:space-between;align-items:center;
              flex-wrap:wrap;gap:12px;background:var(--bg-surface,#f8fafc);padding:14px 18px;
              border-radius:10px;border:1px solid var(--border,#cbd5e1);margin-bottom:16px;">
          
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-weight:800;color:var(--primary,#1e3a8a);font-size:0.95rem;display:flex;align-items:center;gap:6px;">
              🚜 منظومة تصاريح الحفر وتزويد الخدمات (EPAMS v4.9)
            </span>
            ${this.canWrite ? `<button id="epm-add" class="epm-btn-action" style="background:#059669;color:#fff;">📄/🚜 إصدار تصريح حفر جديد</button>` : ''}
            <button id="epm-print-all" class="epm-btn-action" style="background:#7c3aed;color:#fff;">🖨️ طباعة السجل الرسمي</button>
            <button id="epm-export-csv" class="epm-btn-action" style="background:#0284c7;color:#fff;">📊 تصدير Excel / CSV</button>
            <button id="epm-refresh" class="epm-btn-action" style="background:var(--bg-card-hover,#475569);color:var(--text,#ffffff);border:1px solid var(--border,#cbd5e1);" title="تحديث ومزامنة">🔄 تحديث</button>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- فلاتر الحالة السريعة -->
            <div style="display:flex;background:var(--bg-card,#ffffff);padding:3px;border-radius:8px;border:1px solid var(--border,#cbd5e1);flex-wrap:wrap;gap:2px;">
              <button id="epm-filter-all" class="epm-fbtn active" data-type="ALL">الكل</button>
              <button id="epm-filter-active" class="epm-fbtn" data-type="ACTIVE">🟢 ساري المفعول</button>
              <button id="epm-filter-water" class="epm-fbtn" data-type="WATER">💧 مياه وصرف</button>
              <button id="epm-filter-telecom" class="epm-fbtn" data-type="TELECOM">🟣 اتصالات وألياف</button>
              <button id="epm-filter-electric" class="epm-fbtn" data-type="ELECTRIC">⚡ كهرباء</button>
              <button id="epm-filter-completed" class="epm-fbtn" data-type="COMPLETED">🔵 منتهي ومُعبّد</button>
              <button id="epm-filter-delayed" class="epm-fbtn" data-type="DELAYED" style="color:#ef4444;">⚠️ متأخر / إعادة حال</button>
            </div>

            <!-- حقل البحث الفوري -->
            <input id="epm-search" type="text" placeholder="🔍 بحث برقم التصريح، مقدم الطلب، المقاول أو الشارع..."
              style="background:var(--bg-card,#ffffff);color:var(--text,#0f172a);border:1px solid var(--border,#cbd5e1);
                     padding:8px 14px;border-radius:8px;font-size:0.82rem;width:240px;outline:none;" />
          </div>
        </div>

        <!-- بطاقات المؤشرات الإحصائية (KPIs) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#64748b);font-weight:600;">إجمالي التصاريح الصادرة</div>
            <div id="epm-kpi-total" style="font-size:1.6rem;font-weight:800;color:var(--primary,#1e3a8a);margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#64748b);font-weight:600;">🟢 تصاريح سارية قيد التنفيذ</div>
            <div id="epm-kpi-active" style="font-size:1.6rem;font-weight:800;color:#10b981;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#64748b);font-weight:600;">💧 تزويد مياه وصرف صحي</div>
            <div id="epm-kpi-water" style="font-size:1.6rem;font-weight:800;color:#0ea5e9;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#64748b);font-weight:600;">🔵 تصاريح مكتملة ومُعادة التعبيد</div>
            <div id="epm-kpi-completed" style="font-size:1.6rem;font-weight:800;color:#0284c7;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#64748b);font-weight:600;">⚠️ تأخير / التزام إعادة الحال</div>
            <div id="epm-kpi-delayed" style="font-size:1.6rem;font-weight:800;color:#ef4444;margin-top:2px;">0</div>
          </div>
        </div>

        <!-- الخريطة التفاعلية الرئيسية (محصورة داخل حدود النظام بدون تداخل علوي) -->
        <div style="margin-bottom:16px;background:var(--bg-surface,#f8fafc);padding:8px;border-radius:10px;
                    border:1px solid var(--border,#cbd5e1);position:relative;z-index:1;isolation:isolate;overflow:hidden;">
          <div id="epm-map" style="width:100%;height:360px;border-radius:8px;background:var(--bg-card,#ffffff);position:relative;z-index:1;overflow:hidden;"></div>
          <div style="position:absolute;top:14px;left:14px;background:var(--bg-card,#ffffff);
                      padding:8px 12px;border-radius:8px;border:1px solid var(--border,#cbd5e1);color:var(--text,#0f172a);
                      font-size:0.74rem;z-index:10;line-height:1.8;box-shadow:0 4px 12px rgba(0,0,0,0.12);max-width:280px;pointer-events:auto;">
            <div style="font-weight:bold;color:var(--text-muted,#64748b);margin-bottom:2px;">تصنيف مسارات ومواقع الحفر:</div>
            <div style="color:#0ea5e9;">💧 تزويد خطوط مياه الشرب والصرف</div>
            <div style="color:#c084fc;">🟣 تمديد شبكات الاتصالات والألياف</div>
            <div style="color:#eab308;">⚡ تمديد كوابل الكهرباء والطاقة</div>
            <div style="color:#10b981;">🟢 تصريح ساري المفعول ومُلتزم</div>
            <div style="color:#ef4444;">🔴 تصريح منتهي أو يستوجب إعادة التعبيد</div>
          </div>
        </div>

        <!-- الجدول المفصل مع ترتيب الأعمدة -->
        <div style="background:var(--bg-surface,#f8fafc);border-radius:10px;border:1px solid var(--border,#cbd5e1);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:0.98rem;font-weight:800;color:var(--primary,#1e3a8a);display:flex;align-items:center;gap:6px;">
              📋 سجل جرد وتتبع تصاريح الحفر وتزويد الخدمات العامة
            </h3>
            <span id="epm-badge"
              style="background:rgba(30,58,138,.12);color:var(--primary,#1e3a8a);font-size:0.82rem;
                     padding:4px 14px;border-radius:6px;font-weight:bold;border:1px solid var(--primary,#1e3a8a);">إجمالي المعروض: 0</span>
          </div>

          <div style="overflow-x:auto;">
            <table id="epm-table" style="width:100%;text-align:right;font-size:0.8rem;
                                         border-collapse:collapse;min-width:980px;background:var(--bg-card,#ffffff);border-radius:8px;overflow:hidden;border:1px solid var(--border,#cbd5e1);">
              <thead style="background:var(--table-header-bg,#1e3a8a);color:#ffffff;border-bottom:2px solid var(--border,#cbd5e1);">
                <tr>
                  <th class="epm-sortable" data-sort="id" style="padding:11px 10px;cursor:pointer;">رقم التصريح ⬍</th>
                  <th class="epm-sortable" data-sort="type" style="padding:11px 10px;cursor:pointer;">نوع الخدمة / العمل ⬍</th>
                  <th class="epm-sortable" data-sort="applicant" style="padding:11px 10px;cursor:pointer;">مقدم الطلب / المستفيد ⬍</th>
                  <th class="epm-sortable" data-sort="contractor" style="padding:11px 10px;cursor:pointer;">المقاول المنفذ ⬍</th>
                  <th class="epm-sortable" data-sort="district" style="padding:11px 10px;cursor:pointer;">المنطقة / الشارع ⬍</th>
                  <th class="epm-sortable" data-sort="dimensions" style="padding:11px 10px;cursor:pointer;">الأبعاد (طول×عرض) ⬍</th>
                  <th class="epm-sortable" data-sort="insurance" style="padding:11px 10px;cursor:pointer;">التأمين والرسوم ⬍</th>
                  <th class="epm-sortable" data-sort="clauses" style="padding:11px 10px;cursor:pointer;">البنود المعتمدة ⬍</th>
                  <th class="epm-sortable" data-sort="status" style="padding:11px 10px;cursor:pointer;">الحالة التشغيلية ⬍</th>
                  <th class="epm-sortable" data-sort="date" style="padding:11px 10px;cursor:pointer;">فترة التصريح ⬍</th>
                  <th style="padding:11px 10px;text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="epm-tbody">
                <tr><td colspan="11" style="text-align:center;padding:32px;color:var(--text-muted,#64748b);">
                  ⏳ جاري التحميل وعرض السجلات من قاعدة البيانات...
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this._injectStyles();
    this._buildModal();

    setTimeout(() => {
      this._initMap();
      this._fetchPermits();
      this._bindAll();
    }, 80);
  }

  _injectStyles() {
    if (document.getElementById('epm-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'epm-custom-styles';
    style.textContent = `
      #epm-root, #epm-map, #epm-dmap {
        isolation: isolate !important;
      }
      #epm-map .leaflet-pane, #epm-dmap .leaflet-pane {
        z-index: 2 !important;
      }
      #epm-map .leaflet-top, #epm-map .leaflet-bottom,
      #epm-dmap .leaflet-top, #epm-dmap .leaflet-bottom {
        z-index: 6 !important;
      }
      #epm-map .leaflet-control-container, #epm-dmap .leaflet-control-container {
        z-index: 8 !important;
      }
      .epm-btn-action {
        border: none;
        padding: 7px 14px;
        border-radius: 7px;
        font-weight: bold;
        font-size: 0.82rem;
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .epm-btn-action:hover { opacity: 0.9; transform: translateY(-1px); }
      .epm-fbtn {
        background: transparent;
        color: var(--text-muted, #64748b);
        border: none;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 0.77rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .epm-fbtn.active {
        background: var(--primary, #1e3a8a) !important;
        color: #fff !important;
        font-weight: bold;
      }
      .epm-sortable:hover { color: #38bdf8; }
      .epm-clause-card {
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border, #cbd5e1);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 8px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .epm-clause-card:hover {
        border-color: var(--primary, #1e3a8a);
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── الخريطة الرئيسية ──────────────────────────────────────────────── */
  _initMap() {
    const el = document.getElementById('epm-map');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      try { this.map.remove(); } catch {}
      this.map = null;
    }

    this.map = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('epm-map', [32.2985, 35.7050], 14)
      : L.map('epm-map').setView([32.2985, 35.7050], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة | OSM', maxZoom: 19
      }).addTo(this.map);
    }

    this.permitsLayer = L.layerGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 350);
  }

  /* ─── تحميل ومزامنة تصاريح الحفر من قاعدة البيانات ──────────────────── */
  async _fetchPermits() {
    try {
      let res;
      if (typeof apiFetch === 'function') {
        res = await apiFetch('/v4/assets/permits', { silent: true });
      } else {
        const r = await fetch('/api/v4/assets/permits');
        res = await r.json();
      }
      if (res && Array.isArray(res.data)) {
        this.activeData = res.data;
        this._saveLocalCache();
      }
    } catch (e) {
      console.warn('[EPAMS] fetchPermits fallback:', e.message);
    }
    this._applyFilterAndRender();
  }

  /* ─── تطبيق التصفية والترتيب وعرض الجدول ────────────────────────────── */
  _applyFilterAndRender() {
    let data = [...this.activeData];
    const ft = this._filterType;

    if (ft === 'ACTIVE') {
      data = data.filter(n => {
        const st = (n.status || '').toUpperCase();
        return st.includes('ACTIVE') || st.includes('ساري') || st.includes('معتمد');
      });
    } else if (ft === 'WATER') {
      data = data.filter(n => {
        const t = (n.permit_type || n.entity_type || '').toUpperCase();
        return t.includes('WATER') || t.includes('SEWER') || t.includes('مياه') || t.includes('صرف');
      });
    } else if (ft === 'TELECOM') {
      data = data.filter(n => {
        const t = (n.permit_type || n.entity_type || '').toUpperCase();
        return t.includes('TELECOM') || t.includes('FIBER') || t.includes('اتصالات') || t.includes('ألياف');
      });
    } else if (ft === 'ELECTRIC') {
      data = data.filter(n => {
        const t = (n.permit_type || n.entity_type || '').toUpperCase();
        return t.includes('ELECTRIC') || t.includes('POWER') || t.includes('كهرباء') || t.includes('طاقة');
      });
    } else if (ft === 'COMPLETED') {
      data = data.filter(n => {
        const st = (n.status || '').toUpperCase();
        const rst = (n.reinstatement_status || '').toUpperCase();
        return st.includes('COMPLETE') || st.includes('مكتمل') || rst.includes('تم إعادة التعبيد');
      });
    } else if (ft === 'DELAYED') {
      data = data.filter(n => {
        const st = (n.status || '').toUpperCase();
        const rst = (n.reinstatement_status || '').toUpperCase();
        const isLate = n.end_date && new Date(n.end_date) < new Date() && !st.includes('COMPLETE');
        return isLate || st.includes('DELAY') || rst.includes('قيد الصيانة') || rst.includes('مطلوب');
      });
    }

    const q = document.getElementById('epm-search')?.value?.trim()?.toLowerCase() || '';
    if (q) {
      data = data.filter(n =>
        (n.id || '').toLowerCase().includes(q) ||
        (n.code || '').toLowerCase().includes(q) ||
        (n.permit_number || '').toLowerCase().includes(q) ||
        (n.applicant || n.applicant_name || '').toLowerCase().includes(q) ||
        (n.contractor || '').toLowerCase().includes(q) ||
        (n.district || n.location_description || '').toLowerCase().includes(q) ||
        (n.purpose || '').toLowerCase().includes(q) ||
        (n.permit_type || n.entity_type || '').toLowerCase().includes(q)
      );
    }

    /* الترتيب */
    data.sort((a, b) => {
      let valA, valB;
      if (this._sortField === 'id') {
        valA = a.code || a.permit_number || a.id || '';
        valB = b.code || b.permit_number || b.id || '';
      } else if (this._sortField === 'type') {
        valA = a.permit_type || a.entity_type || '';
        valB = b.permit_type || b.entity_type || '';
      } else if (this._sortField === 'applicant') {
        valA = a.applicant || a.applicant_name || '';
        valB = b.applicant || b.applicant_name || '';
      } else if (this._sortField === 'contractor') {
        valA = a.contractor || '';
        valB = b.contractor || '';
      } else if (this._sortField === 'district') {
        valA = a.district || a.location_description || '';
        valB = b.district || b.location_description || '';
      } else if (this._sortField === 'dimensions') {
        valA = parseFloat(a.length_m || a.excavation_length || 0);
        valB = parseFloat(b.length_m || b.excavation_length || 0);
      } else if (this._sortField === 'insurance') {
        valA = parseFloat(a.insurance_amount || a.insurance_fee || 0);
        valB = parseFloat(b.insurance_amount || b.insurance_fee || 0);
      } else if (this._sortField === 'status') {
        valA = a.status || ''; valB = b.status || '';
      } else if (this._sortField === 'date') {
        valA = new Date(a.created_at || a.start_date || 0).getTime();
        valB = new Date(b.created_at || b.start_date || 0).getTime();
      }
      if (valA < valB) return this._sortAsc ? -1 : 1;
      if (valA > valB) return this._sortAsc ? 1 : -1;
      return 0;
    });

    this._updateKPIs(this.activeData);
    this._renderTable(data);
    this._renderMapPermits(data);
  }

  _updateKPIs(data) {
    const total = data.length;
    const aCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      return st.includes('ACTIVE') || st.includes('ساري') || st.includes('معتمد');
    }).length;
    const wCount = data.filter(n => {
      const t = (n.permit_type || n.entity_type || '').toUpperCase();
      return t.includes('WATER') || t.includes('SEWER') || t.includes('مياه') || t.includes('صرف');
    }).length;
    const cCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      const rst = (n.reinstatement_status || '').toUpperCase();
      return st.includes('COMPLETE') || st.includes('مكتمل') || rst.includes('تم إعادة التعبيد');
    }).length;
    const dCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      const rst = (n.reinstatement_status || '').toUpperCase();
      const isLate = n.end_date && new Date(n.end_date) < new Date() && !st.includes('COMPLETE');
      return isLate || st.includes('DELAY') || rst.includes('قيد الصيانة') || rst.includes('مطلوب');
    }).length;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('epm-kpi-total', total);
    setEl('epm-kpi-active', aCount);
    setEl('epm-kpi-water', wCount);
    setEl('epm-kpi-completed', cCount);
    setEl('epm-kpi-delayed', dCount);
  }

  /* ─── عرض الجدول ────────────────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('epm-tbody');
    const badge = document.getElementById('epm-badge');
    if (!tbody) return;
    if (badge) badge.textContent = `إجمالي المعروض: ${data.length}`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="11"
        style="text-align:center;padding:36px;color:var(--text-muted,#64748b);">
        <div style="font-size:2.2rem;margin-bottom:8px;">📭</div>
        لا توجد تصاريح حفر مسجلة تطابق التصفية الحالية.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((r, ri) => {
      const typeStr = (r.permit_type || r.entity_type || 'WATER_CONNECTION').toUpperCase();
      let typeLabel = '💧 تزويد خط مياه';
      let typeColor = '#0ea5e9';

      if (typeStr.includes('SEWER') || typeStr.includes('صرف')) { typeLabel = '🚽 توصيل صرف صحي'; typeColor = '#f59e0b'; }
      else if (typeStr.includes('TELECOM') || typeStr.includes('FIBER') || typeStr.includes('اتصالات')) { typeLabel = '🟣 اتصالات وألياف ضوئية'; typeColor = '#a855f7'; }
      else if (typeStr.includes('ELECTRIC') || typeStr.includes('كهرباء')) { typeLabel = '⚡ تمديد كوابل كهرباء'; typeColor = '#eab308'; }
      else if (typeStr.includes('ROAD_CROSS') || typeStr.includes('عبارة')) { typeLabel = '🛣️ قطع وتصريف طريق'; typeColor = '#10b981'; }
      else if (typeStr.includes('EMERGENCY') || typeStr.includes('طوارئ')) { typeLabel = '🚨 حفر طارئ وإصلاح كسر'; typeColor = '#ef4444'; }

      const status = (r.status || 'ACTIVE').toUpperCase();
      const rStatus = r.reinstatement_status || 'قيد التنفيذ';
      let stColor = '#10b981', stBg = 'rgba(16,185,129,0.15)', stText = 'ساري المفعول';

      if (status.includes('COMPLETE') || status.includes('مكتمل') || rStatus.includes('تم إعادة التعبيد')) {
        stColor = '#0284c7'; stBg = 'rgba(2,132,199,0.15)'; stText = 'مكتمل ومُعبّد';
      } else if (status.includes('PENDING') || status.includes('قيد')) {
        stColor = '#d97706'; stBg = 'rgba(217,119,6,0.15)'; stText = 'قيد الدراسة والاعتماد';
      } else if (r.end_date && new Date(r.end_date) < new Date() && !status.includes('COMPLETE')) {
        stColor = '#ef4444'; stBg = 'rgba(239,68,68,0.15)'; stText = 'منتهي / مطلوب التعبيد';
      }

      const lengthVal = r.length_m || r.excavation_length || 0;
      const widthVal  = r.width_m || r.excavation_width || 1.0;
      const insFee    = r.insurance_amount || r.insurance_fee ? `${r.insurance_amount || r.insurance_fee} د.أ` : '—';
      const periodStr = `${r.start_date ? r.start_date.slice(0,10) : '—'} ➔ ${r.end_date ? r.end_date.slice(0,10) : '—'}`;

      const clausesCount = (r.attributes?.clauses || []).filter(c => c.enabled !== false).length;
      const clausesBadge = clausesCount > 0
        ? `<span style="background:rgba(16,185,129,0.12);color:#059669;border:1px solid #059669;padding:2px 7px;border-radius:5px;font-size:0.72rem;font-weight:bold;">${clausesCount} بنود معتمدة</span>`
        : `<span style="color:var(--text-muted,#64748b);font-size:0.72rem;">البنود القياسية</span>`;

      const bgRow = ri % 2 === 0 ? 'var(--bg-card,#ffffff)' : 'var(--bg-surface,#f8fafc)';

      return `
        <tr data-pid="${r.id}" style="border-bottom:1px solid var(--border,#e2e8f0);background:${bgRow};color:var(--text,#0f172a);transition:background 0.15s;" onmouseover="this.style.background='var(--bg-card-hover,rgba(30,58,138,0.06))'" onmouseout="this.style.background='${bgRow}'">
          <td style="padding:10px 8px;font-weight:bold;color:var(--primary,#1e3a8a);font-family:monospace;">${r.code || r.permit_number || r.id}</td>
          <td style="padding:10px 8px;">
            <span style="background:var(--bg-surface,#f8fafc);color:${typeColor};border:1px solid ${typeColor};padding:3px 8px;border-radius:5px;font-size:0.75rem;font-weight:bold;">
              ${typeLabel}
            </span>
          </td>
          <td style="padding:10px 8px;font-weight:bold;color:var(--text,#0f172a);">${r.applicant || r.applicant_name || '—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted,#64748b);">${r.contractor || '—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted,#64748b);">${r.district || r.location_description || 'كفرنجة'}</td>
          <td style="padding:10px 8px;font-weight:bold;color:var(--primary,#1e3a8a);">${lengthVal}م × ${widthVal}م</td>
          <td style="padding:10px 8px;font-size:0.78rem;color:#059669;font-weight:bold;">${insFee}</td>
          <td style="padding:10px 8px;">${clausesBadge}</td>
          <td style="padding:10px 8px;">
            <span style="background:${stBg};color:${stColor};padding:2px 8px;border-radius:4px;font-weight:bold;font-size:0.73rem;border:1px solid ${stColor};">
              ${stText}
            </span>
          </td>
          <td style="padding:10px 8px;font-size:0.75rem;color:var(--text-muted,#64748b);">${periodStr}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
              <button class="epm-row-view" data-id="${r.id}"
                style="background:var(--bg-card-hover,#475569);color:var(--text,#ffffff);border:1px solid var(--border,#cbd5e1);padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="معاينة الموقع على الخريطة">👁️</button>
              ${this.canWrite ? `<button class="epm-row-edit" data-id="${r.id}"
                style="background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="تعديل التصريح والبنود">✏️</button>` : ''}
              <button class="epm-row-print" data-id="${r.id}"
                style="background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="طباعة التصريح الرسمي مع البنود">🖨️</button>
              ${this.isAdmin ? `<button class="epm-row-del" data-id="${r.id}"
                style="background:#dc2626;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="حذف التصريح">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    this._bindTableRows();
  }

  /* ─── ربط أحداث الصفوف ──────────────────────────────────────────────── */
  _bindTableRows() {
    const tbody = document.getElementById('epm-tbody');
    if (!tbody) return;

    if (this._tbodyHandler) tbody.removeEventListener('click', this._tbodyHandler);

    this._tbodyHandler = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains('epm-row-view'))  this._previewOnMap(id);
      if (btn.classList.contains('epm-row-edit'))  this._openModal(id);
      if (btn.classList.contains('epm-row-print')) this._printPermit(id);
      if (btn.classList.contains('epm-row-del'))   this._deletePermit(id);
    };
    tbody.addEventListener('click', this._tbodyHandler);
  }

  /* ─── ربط شريط الأدوات والبحث والفلترة ─────────────────────────────── */
  _bindAll() {
    document.getElementById('epm-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('epm-print-all')?.addEventListener('click', () => this._printAll());
    document.getElementById('epm-export-csv')?.addEventListener('click', () => this._exportCSV());
    document.getElementById('epm-refresh')?.addEventListener('click', () => {
      this._toast('🔄 جاري تحديث البيانات من قاعدة البيانات...');
      this._fetchPermits();
    });

    document.getElementById('epm-search')?.addEventListener('input', () => this._applyFilterAndRender());

    /* فلاتر الأزرار */
    document.querySelectorAll('.epm-fbtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.epm-fbtn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._filterType = e.target.dataset.type || 'ALL';
        this._applyFilterAndRender();
      });
    });

    /* ترتيب الأعمدة */
    document.querySelectorAll('.epm-sortable').forEach(th => {
      th.addEventListener('click', (e) => {
        const field = e.currentTarget.dataset.sort;
        if (this._sortField === field) {
          this._sortAsc = !this._sortAsc;
        } else {
          this._sortField = field;
          this._sortAsc = true;
        }
        this._applyFilterAndRender();
      });
    });
  }

  /* ─── الخريطة الرئيسية: عرض مسارات ونقاط الحفريات ──────────────────── */
  _renderMapPermits(data) {
    if (!this.permitsLayer) return;
    this.permitsLayer.clearLayers();
    const bounds = L.latLngBounds();

    data.forEach(r => {
      const typeStr = (r.permit_type || r.entity_type || 'WATER').toUpperCase();
      let color = '#0ea5e9';
      if (typeStr.includes('SEWER')) color = '#f59e0b';
      else if (typeStr.includes('TELECOM') || typeStr.includes('FIBER')) color = '#a855f7';
      else if (typeStr.includes('ELECTRIC')) color = '#eab308';
      else if (typeStr.includes('ROAD_CROSS')) color = '#10b981';

      const raw = r.geojson || r.geometry || r.geom;
      let rendered = false;

      if (raw) {
        try {
          const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
            // GeoJSON coordinates are [lng, lat]
            const latLngs = geo.coordinates.map(c => [c[1], c[0]]);
            const poly = L.polyline(latLngs, { color, weight: 6, opacity: 0.85 });
            poly.bindPopup(this._mapPopup(r, color));
            this.permitsLayer.addLayer(poly);
            latLngs.forEach(pt => bounds.extend(pt));
            rendered = true;
          } else if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
            const pt = [geo.coordinates[1], geo.coordinates[0]];
            const marker = L.circleMarker(pt, {
              radius: 9, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
            });
            marker.bindPopup(this._mapPopup(r, color));
            this.permitsLayer.addLayer(marker);
            bounds.extend(pt);
            rendered = true;
          }
        } catch {}
      }

      if (!rendered && r.lat && r.lng) {
        const pt = [parseFloat(r.lat), parseFloat(r.lng)];
        const marker = L.circleMarker(pt, {
          radius: 9, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
        });
        marker.bindPopup(this._mapPopup(r, color));
        this.permitsLayer.addLayer(marker);
        bounds.extend(pt);
      }
    });

    if (bounds.isValid() && this.map) this.map.fitBounds(bounds, { padding: [35, 35] });
  }

  _mapPopup(r, color) {
    return `
      <div style="direction:rtl; text-align:right; font-family:'Tajawal',sans-serif; min-width:230px; padding:4px;">
        <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
          تصريح: ${r.code || r.permit_number || r.id}
        </div>
        <div style="font-size:0.8rem; color:${color}; font-weight:bold; margin-bottom:2px;">النوع: ${r.permit_type || r.entity_type || 'خدمات عامة'}</div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">مقدم الطلب: <b>${r.applicant || r.applicant_name || '—'}</b></div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">المقاول: <b>${r.contractor || '—'}</b></div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:4px;">الأبعاد: <b>${r.length_m || r.excavation_length || 0}م × ${r.width_m || r.excavation_width || 1}م</b></div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="if(window.excavationManager) window.excavationManager._printPermit('${r.id}')" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🖨️ طباعة</button>
          ${this.canWrite ? `<button onclick="if(window.excavationManager) window.excavationManager._openModal('${r.id}')" style="flex:1;background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">✏️ تعديل</button>` : ''}
        </div>
      </div>`;
  }

  /* ─── معاينة تصريح على الخريطة ─────────────────────────────────────── */
  _previewOnMap(permitId) {
    const r = this.activeData.find(x => String(x.id) === String(permitId));
    if (!r) return;
    const raw = r.geojson || r.geometry || r.geom;
    if (raw) {
      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (this.map) {
          if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
            const b = L.latLngBounds(geo.coordinates.map(c => [c[1], c[0]]));
            if (b.isValid()) {
              this.map.fitBounds(b, { padding: [50, 50] });
              this._toast(`📍 تم تحديد موقع ومسار التصريح: ${r.code || r.permit_number || r.id}`);
              return;
            }
          } else if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
            this.map.setView([geo.coordinates[1], geo.coordinates[0]], 16, { animate: true });
            this._toast(`📍 تم تحديد موقع التصريح: ${r.code || r.permit_number || r.id}`);
            return;
          }
        }
      } catch {}
    }
    if (r.lat && r.lng && this.map) {
      this.map.setView([parseFloat(r.lat), parseFloat(r.lng)], 16, { animate: true });
      this._toast(`📍 تم تحديد موقع التصريح: ${r.code || r.permit_number || r.id}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     مودال الإضافة / التعديل الاحترافي لتصريح الحفر والبنود المخصصة
  ═══════════════════════════════════════════════════════════════════ */
  _buildModal() {
    document.getElementById('epm-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'epm-modal';
    modal.style.cssText = `display:none;position:fixed;inset:0;z-index:99999;
      background:rgba(15,23,42,0.75);backdrop-filter:blur(8px);
      align-items:center;justify-content:center;`;

    modal.innerHTML = `
      <div style="background:var(--bg-card,#ffffff);border:1.5px solid var(--border,#cbd5e1);border-radius:14px;
            width:min(1140px,98vw);max-height:94vh;overflow-y:auto;direction:rtl;
            color:var(--text,#0f172a);box-shadow:0 30px 70px rgba(0,0,0,.35);">

        <!-- رأس المودال -->
        <div style="display:flex;justify-content:space-between;align-items:center;
              padding:14px 20px;border-bottom:1px solid var(--border,#cbd5e1);background:var(--bg-surface,#f8fafc);
              border-radius:14px 14px 0 0;position:sticky;top:0;z-index:10;">
          <div style="display:flex;align-items:center;gap:10px;">
            <h3 id="epm-mtitle" style="margin:0;font-size:1.05rem;font-weight:800;color:var(--primary,#1e3a8a);">
              🚜 إصدار وتوثيق تصريح حفر وتزويد خدمات
            </h3>
            <span id="epm-mstatus-badge" style="background:rgba(16,185,129,0.15);color:#059669;border:1px solid #059669;font-size:0.75rem;padding:2px 8px;border-radius:5px;font-weight:bold;">جديد</span>
          </div>
          <button id="epm-mclose"
            style="background:var(--bg-card-hover,#e2e8f0);border:1px solid var(--border,#cbd5e1);color:var(--text,#0f172a);width:32px;height:32px;
                   border-radius:50%;cursor:pointer;font-size:1rem;font-weight:bold;">✕</button>
        </div>

        <!-- محتوى العمودين -->
        <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:0;">

          <!-- النموذج الأيمن: البيانات الأساسية + محرر البنود والشروط -->
          <div id="epm-mform" style="padding:18px;display:flex;flex-direction:column;gap:12px;
                border-left:1px solid var(--border,#cbd5e1);max-height:83vh;overflow-y:auto;background:var(--bg-card,#ffffff);">
            ${this._formHTML()}
            
            <!-- قسم محرر بنود وشروط التصريح المخصصة -->
            <div style="background:var(--bg-surface,#f8fafc);border:1px solid var(--border,#cbd5e1);border-radius:10px;padding:12px;margin-top:4px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <b style="color:var(--primary,#1e3a8a);font-size:0.88rem;display:flex;align-items:center;gap:6px;">
                  📋 بنود وشروط الالتزام الفني والهندسي للتصريح
                </b>
                <div style="display:flex;gap:6px;">
                  <button id="epm-add-clause" type="button"
                    style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:5px;font-size:0.75rem;cursor:pointer;font-weight:bold;">
                    ➕ إضافة بند جديد
                  </button>
                  <button id="epm-reset-clauses" type="button"
                    style="background:var(--bg-card-hover,#64748b);color:#fff;border:none;padding:4px 8px;border-radius:5px;font-size:0.72rem;cursor:pointer;">
                    🔄 استعادة القياسي
                  </button>
                </div>
              </div>

              <!-- حاوية البنود الديناميكية -->
              <div id="epm-clauses-container" style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;padding-left:4px;">
                <!-- تُحقن البنود برمجياً -->
              </div>
            </div>

            <!-- أزرار الإجراءات -->
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;
                        padding-top:14px;border-top:1px solid var(--border,#cbd5e1);position:sticky;bottom:0;background:var(--bg-card,#ffffff);z-index:5;">
              <button id="epm-mcancel"
                style="padding:8px 18px;background:var(--bg-card-hover,#64748b);color:#fff;border:none;
                       border-radius:7px;cursor:pointer;font-weight:bold;">إلغاء</button>
              <button id="epm-msave"
                style="padding:8px 24px;background:#2563eb;color:#fff;border:none;
                       border-radius:7px;font-weight:bold;cursor:pointer;">💾 اعتماد وحفظ التصريح والبنود</button>
            </div>
          </div>

          <!-- الخريطة اليسرى: رسم المسار والنقاط الجغرافية بدقة -->
          <div style="padding:18px;background:var(--bg-surface,#f8fafc);display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <p style="font-weight:bold;color:var(--primary,#1e3a8a);font-size:0.88rem;margin:0;">
                🗺️ المسار الجغرافي والإحداثيات (GIS Coordinates)
              </p>
              <button id="epm-locate-me" type="button"
                style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:5px;font-size:0.75rem;cursor:pointer;font-weight:bold;">
                📍 موقعي الحالي
              </button>
            </div>

            <!-- أدوات الرسم -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:var(--bg-card,#ffffff);padding:8px;border-radius:8px;border:1px solid var(--border,#cbd5e1);">
              <button id="epm-mdraw-poly" type="button"
                style="background:#0284c7;color:#fff;border:none;padding:5px 11px;border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:bold;">
                〰️ رسم مسار خطي (Polyline)
              </button>
              <button id="epm-mdraw-point" type="button"
                style="background:var(--bg-card-hover,#64748b);color:#fff;border:none;padding:5px 11px;border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:bold;">
                📍 نقطة مفردة (Point)
              </button>
              <button id="epm-mundolast" type="button"
                style="background:var(--bg-card-hover,#64748b);color:#fff;border:none;padding:5px 9px;border-radius:6px;font-size:0.78rem;cursor:pointer;" title="تراجع عن النقطة الأخيرة">
                ↩️ تراجع
              </button>
              <button id="epm-mclear" type="button"
                style="background:#dc2626;color:#fff;border:none;padding:5px 9px;border-radius:6px;font-size:0.78rem;cursor:pointer;">
                🗑️ مسح
              </button>
            </div>

            <div style="font-size:0.75rem;color:var(--text-muted,#64748b);margin:0;">
              💡 انقر على الخريطة لإضافة النقاط · يمكنك سحب أي نقطة لتعديل موقعها بدقة · انقر مرتين للإنهاء.
            </div>

            <!-- حاوية الخريطة داخل المودال -->
            <div id="epm-dmap" style="width:100%;height:350px;border-radius:8px;border:1px solid var(--border,#cbd5e1);background:var(--bg-card,#ffffff);"></div>

            <!-- حقول الإحداثيات والحسابات الدقيقة -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <label style="font-size:0.76rem;color:var(--text-muted,#64748b);font-weight:bold;">خط العرض (Latitude):</label>
                <input id="epm-f-lat" type="number" step="0.000001" placeholder="32.330100"
                  style="width:100%;padding:7px 10px;background:var(--bg-card,#ffffff);border:1px solid var(--border,#cbd5e1);color:var(--text,#0f172a);border-radius:6px;font-size:0.82rem;box-sizing:border-box;">
              </div>
              <div>
                <label style="font-size:0.76rem;color:var(--text-muted,#64748b);font-weight:bold;">خط الطول (Longitude):</label>
                <input id="epm-f-lng" type="number" step="0.000001" placeholder="35.750100"
                  style="width:100%;padding:7px 10px;background:var(--bg-card,#ffffff);border:1px solid var(--border,#cbd5e1);color:var(--text,#0f172a);border-radius:6px;font-size:0.82rem;box-sizing:border-box;">
              </div>
            </div>

            <div id="epm-length-box" style="background:rgba(16,185,129,0.12);border:1px solid #059669;border-radius:6px;padding:8px 12px;font-size:0.8rem;color:#059669;display:flex;justify-content:space-between;align-items:center;">
              <span>📏 الطول المقاس هندسياً: <b id="epm-length-text">0.00 متر</b></span>
              <span id="epm-mdstatus" style="font-size:0.74rem;color:#059669;font-weight:bold;">جاهز</span>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    /* ربط أحداث المودال */
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });
    document.getElementById('epm-mclose').addEventListener('click',  () => this._closeModal());
    document.getElementById('epm-mcancel').addEventListener('click', () => this._closeModal());
    document.getElementById('epm-msave').addEventListener('click',   () => this._savePermit());
    document.getElementById('epm-mclear').addEventListener('click',  () => this._clearDraw());
    document.getElementById('epm-mundolast')?.addEventListener('click', () => this._undoLastPoint());
    document.getElementById('epm-locate-me')?.addEventListener('click', () => this._locateUserPosition());
    document.getElementById('epm-add-clause')?.addEventListener('click', () => this._addCustomClause());
    document.getElementById('epm-reset-clauses')?.addEventListener('click', () => this._resetClauses());

    document.getElementById('epm-mdraw-poly')?.addEventListener('click', () => this._setDrawMode('POLYLINE'));
    document.getElementById('epm-mdraw-point')?.addEventListener('click', () => this._setDrawMode('POINT'));

    // ربط حقلي الإحداثيات للتحديث المباشر ثنائي الاتجاه
    const syncCoordsFromInput = () => {
      const lat = parseFloat(document.getElementById('epm-f-lat')?.value);
      const lng = parseFloat(document.getElementById('epm-f-lng')?.value);
      if (!isNaN(lat) && !isNaN(lng) && lat > 0 && lng > 0) {
        if (this._drawMode === 'POINT' || this.drawnCoords.length <= 1) {
          this.drawnCoords = [[lat, lng]];
          this._refreshDrawLayers();
          if (this.drawMap) this.drawMap.panTo([lat, lng]);
        }
      }
    };
    document.getElementById('epm-f-lat')?.addEventListener('change', syncCoordsFromInput);
    document.getElementById('epm-f-lng')?.addEventListener('change', syncCoordsFromInput);
  }

  _formHTML() {
    const inp = (id, type, ph, val='', readonly=false) =>
      `<input id="${id}" type="${type}" placeholder="${ph}" value="${val}" ${readonly ? 'readonly' : ''}
        style="width:100%;padding:8px 10px;background:var(--bg-surface,#f8fafc);border:1.5px solid var(--border,#cbd5e1);
               color:var(--text,#0f172a);border-radius:6px;font-size:0.82rem;font-weight:600;box-sizing:border-box;outline:none;">`;
    const sel = (id, opts) =>
      `<select id="${id}" style="width:100%;padding:8px 10px;background:var(--bg-surface,#f8fafc);
              border:1.5px solid var(--border,#cbd5e1);color:var(--text,#0f172a);border-radius:6px;
              font-size:0.82rem;font-weight:600;box-sizing:border-box;outline:none;">
        ${opts.map(o => `<option value="${o.v}">${o.t}</option>`).join('')}
       </select>`;
    const lbl = (t, icon='📌') => `<label style="font-size:0.8rem;font-weight:700;color:var(--text,#0f172a);
                                display:flex;align-items:center;gap:4px;margin-bottom:4px;"><span>${icon}</span><span>${t}</span></label>`;
    const g2 = (a,b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${a}${b}</div>`;
    const g3 = (a,b,c) => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">${a}${b}${c}</div>`;
    const wrap = (l,el,icon='📌') => `<div>${lbl(l,icon)}${el}</div>`;

    const codeInputGroup = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          ${lbl('رقم / رمز التصريح (تلقائي) *', '🔒')}
          <span style="font-size:0.7rem;background:rgba(30,58,138,0.1);color:var(--primary,#1e3a8a);padding:1px 6px;border-radius:4px;font-weight:bold;">رقم معتمد</span>
        </div>
        <div style="display:flex;gap:4px;">
          <input id="epm-f-code" type="text" placeholder="PERM-2026-001" value="" readonly
            style="flex:1;padding:8px 10px;background:var(--bg-surface,#f8fafc);border:1.5px solid var(--border,#cbd5e1);
                   color:var(--primary,#1e3a8a);font-weight:800;border-radius:6px;font-size:0.85rem;box-sizing:border-box;outline:none;font-family:monospace;">
          <button type="button" id="epm-regen-code" title="توليد رقم تسلسلي جديد تلقائياً"
            style="background:var(--bg-card-hover,#e2e8f0);border:1px solid var(--border,#cbd5e1);color:var(--text,#0f172a);padding:0 10px;border-radius:6px;cursor:pointer;font-size:0.85rem;">🔄</button>
        </div>
      </div>
    `;

    return `
      ${wrap('نوع تصريح الحفر والخدمة المطلوبة *', sel('epm-f-type',[
        {v:'WATER_CONNECTION',t:'💧 تزويد خط مياه شرب (Potable Water Connection)'},
        {v:'SEWER_CONNECTION',t:'🚽 ربط وتوصيل صرف صحي (Sewerage Connection)'},
        {v:'FIBER_TELECOM',t:'🟣 تمديد كوابل ألياف ضوئية واتصالات (Fiber Optic/Telecom)'},
        {v:'ELECTRIC_CABLE',t:'⚡ تمديد كوابل كهرباء وطاقة (Electrical Power Cable)'},
        {v:'STORM_CULVERT',t:'🌧️ تصريف مياه أمطار وعبارات (Stormwater Channel)'},
        {v:'ROAD_CROSSING',t:'🛣️ قطع عرضي للشارع وتعبيد (Road Crossing)'},
        {v:'EMERGENCY_REPAIR',t:'🚨 إصلاح طارئ لكسر خط خدمات (Emergency Repair)'}
      ]), '🏗️')}
      ${g2(
        codeInputGroup,
        wrap('مقدم الطلب / الجهة المستفيدة *', inp('epm-f-applicant','text','شركة مياه اليرموك / مواطن'), '👤')
      )}
      ${g2(
        wrap('المقاول / الفني المنفذ *', inp('epm-f-contractor','text','مؤسسة المقاولات المعتمدة'), '🚜'),
        wrap('المنطقة / الشارع *', inp('epm-f-district','text','شارع كفرنجة الرئيسي - حي المستشفى'), '📍')
      )}
      ${g3(
        wrap('الطول (متر) *', inp('epm-f-length','number','45'), '📏'),
        wrap('العرض (متر) *', inp('epm-f-width','number','1.2'), '📐'),
        wrap('العمق (متر)', inp('epm-f-depth','number','1.5'), '⛏️')
      )}
      ${g2(
        wrap('نوع الطبقة السطحية', sel('epm-f-surface',[
          {v:'ASPHALT',t:'إسفلت ساخن (Asphalt)'},
          {v:'COLD_MIX',t:'خلطة إسفلتية باردة (Cold Mix)'},
          {v:'SIDEWALK',t:'رصيف وبلاط إنترلوك (Sidewalk/Tiles)'},
          {v:'BASE_COURSE',t:'بيس كورس / ترابي (Base Course)'},
          {v:'CONCRETE',t:'خرسانة مسلحة (Concrete)'}
        ]), '🛣️'),
        wrap('مبلغ التأمين المسترد (د.أ)', inp('epm-f-insurance','number','250'), '💰')
      )}
      ${g2(
        wrap('تاريخ البدء بالتنفيذ', inp('epm-f-start','date',''), '📅'),
        wrap('تاريخ الانتهاء وإعادة الحال', inp('epm-f-end','date',''), '⏳')
      )}
      ${g2(
        wrap('الحالة التشغيلية للتصريح', sel('epm-f-status',[
          {v:'ACTIVE',t:'🟢 ساري المفعول وقيد التنفيذ'},
          {v:'PENDING_APPROVAL',t:'⏳ قيد الدراسة والاعتماد'},
          {v:'COMPLETED',t:'🔵 منتهي ومُعاد التعبيد بنجاح'},
          {v:'OVERDUE_REINSTATE',t:'⚠️ متأخر / مطلوب إعادة الحال فوراً'},
          {v:'CANCELLED',t:'❌ ملغى'}
        ]), '🚦'),
        wrap('حالة إعادة التعبيد والأرصفة', sel('epm-f-reinstatement',[
          {v:'PENDING',t:'قيد التنفيذ / لم يبدأ التعبيد'},
          {v:'IN_PROGRESS',t:'قيد الدك والتجهيز للتعبيد'},
          {v:'REINSTATED_ACCEPTED',t:'تم إعادة التعبيد واستلام الموقع'},
          {v:'DEFAULTED',t:'إخلال بالتعبيد / مصادرة التأمين'}
        ]), '🧱')
      )}
      ${wrap('ملاحظات عامة وتفاصيل إضافية',
        `<textarea id="epm-f-notes" rows="2" placeholder="أي ملاحظات خاصة أو تعليمات للمهندس المشرف..."
          style="width:100%;padding:8px;background:var(--bg-surface,#f8fafc);border:1.5px solid var(--border,#cbd5e1);
                 color:var(--text,#0f172a);border-radius:6px;font-size:0.82rem;font-weight:500;
                 box-sizing:border-box;resize:vertical;outline:none;"></textarea>`, '📝'
      )}`;
  }

  /* ─── محرر بنود وشروط التصريح ───────────────────────────────────────── */
  _renderClausesUI() {
    const container = document.getElementById('epm-clauses-container');
    if (!container) return;

    container.innerHTML = this._activeClauses.map((c, idx) => `
      <div class="epm-clause-card" data-idx="${idx}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:bold;color:#f8fafc;font-size:0.82rem;">
            <input type="checkbox" class="epm-clause-chk" data-idx="${idx}" ${c.enabled !== false ? 'checked' : ''} style="cursor:pointer;accent-color:#059669;width:15px;height:15px;">
            <span>بند (${idx + 1}): <input type="text" class="epm-clause-title" data-idx="${idx}" value="${(c.title || '').replace(/"/g, '&quot;')}" style="background:transparent;border:none;border-bottom:1px dashed #475569;color:#38bdf8;font-weight:bold;font-size:0.82rem;outline:none;padding:1px 4px;width:240px;"></span>
          </label>
          <button type="button" class="epm-clause-del" data-idx="${idx}" style="background:#dc2626;color:#fff;border:none;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:0.7rem;" title="حذف البند">🗑️</button>
        </div>
        <textarea class="epm-clause-text" data-idx="${idx}" rows="2" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;color:#cbd5e1;border-radius:5px;font-size:0.78rem;resize:vertical;box-sizing:border-box;outline:none;">${c.text || ''}</textarea>
      </div>
    `).join('');

    // ربط أحداث التعديل الفوري
    container.querySelectorAll('.epm-clause-chk').forEach(chk => {
      chk.addEventListener('change', e => {
        const i = parseInt(e.target.dataset.idx);
        if (this._activeClauses[i]) this._activeClauses[i].enabled = e.target.checked;
      });
    });

    container.querySelectorAll('.epm-clause-title').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        if (this._activeClauses[i]) this._activeClauses[i].title = e.target.value;
      });
    });

    container.querySelectorAll('.epm-clause-text').forEach(tx => {
      tx.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx);
        if (this._activeClauses[i]) this._activeClauses[i].text = e.target.value;
      });
    });

    container.querySelectorAll('.epm-clause-del').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(e.target.dataset.idx);
        this._activeClauses.splice(i, 1);
        this._renderClausesUI();
      });
    });
  }

  _addCustomClause() {
    this._activeClauses.push({
      id: `cls-custom-${Date.now()}`,
      enabled: true,
      title: 'بند شروط خاصة إضافية',
      text: 'شروط والالتزامات الهندسية المحددة من قبل بلدية كفرنجة للموقع.'
    });
    this._renderClausesUI();
    const c = document.getElementById('epm-clauses-container');
    if (c) c.scrollTop = c.scrollHeight;
  }

  _resetClauses() {
    if (confirm('هل ترغب في استعادة البنود الهندسية القياسية الافتراضية؟')) {
      this._activeClauses = this._getDefaultClauses();
      this._renderClausesUI();
      this._toast('🔄 تمت استعادة البنود القياسية.');
    }
  }

  /* ─── فتح المودال ─────────────────────────────────────────────────── */
  _openModal(permitId = null) {
    this._editingId = permitId || null;
    const item = permitId
      ? (this.activeData.find(r => String(r.id) === String(permitId)) || {}) : {};

    document.getElementById('epm-mtitle').textContent =
      permitId ? `✏️ تعديل تصريح الحفر: ${item.code || item.permit_number || item.id || ''}` : '🚜 إصدار وتوثيق تصريح حفر جديد';

    const stBadge = document.getElementById('epm-mstatus-badge');
    if (stBadge) {
      stBadge.textContent = permitId ? (item.status || 'ساري') : 'جديد';
      stBadge.style.background = permitId ? '#1e3a8a' : '#065f46';
    }

    const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
    sv('epm-f-type',          item.permit_type || item.entity_type || 'WATER_CONNECTION');
    sv('epm-f-code',          item.code || item.permit_number || item.id || this._nextCode());
    sv('epm-f-applicant',     item.applicant || item.applicant_name || '');
    sv('epm-f-contractor',    item.contractor || '');
    sv('epm-f-district',      item.district || item.location_description || 'شارع كفرنجة الرئيسي');
    sv('epm-f-length',        item.length_m || item.excavation_length || '45');
    sv('epm-f-width',         item.width_m || item.excavation_width || '1.2');
    sv('epm-f-depth',         item.depth_m || '1.5');
    sv('epm-f-surface',       item.surface_type || 'ASPHALT');
    sv('epm-f-insurance',     item.insurance_amount || item.insurance_fee || '250');
    sv('epm-f-start',         item.start_date ? item.start_date.slice(0,10) : new Date().toISOString().slice(0,10));
    sv('epm-f-end',           item.end_date ? item.end_date.slice(0,10) : new Date(Date.now() + 86400000 * 14).toISOString().slice(0,10));
    sv('epm-f-status',        item.status || 'ACTIVE');
    sv('epm-f-reinstatement', item.reinstatement_status || 'PENDING');
    sv('epm-f-notes',         item.notes || '');

    // تحميل البنود المخصصة من السجل أو الافتراضية
    if (item.attributes?.clauses && Array.isArray(item.attributes.clauses) && item.attributes.clauses.length > 0) {
      this._activeClauses = JSON.parse(JSON.stringify(item.attributes.clauses));
    } else {
      this._activeClauses = this._getDefaultClauses();
    }
    this._renderClausesUI();

    this._clearDraw();
    const modal = document.getElementById('epm-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(() => this._initDrawMap(item), 240);
  }

  _closeModal() {
    const m = document.getElementById('epm-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawLayer = null;
    this._drawing  = false;
  }

  /* ─── خريطة الرسم والتعديل الهندسي التفاعلي ────────────────────────── */
  _initDrawMap(item = {}) {
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawMap = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('epm-dmap', [32.3301, 35.7501], 14)
      : L.map('epm-dmap').setView([32.3301, 35.7501], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة', maxZoom: 19
      }).addTo(this.drawMap);
    }

    this.drawLayer = L.featureGroup().addTo(this.drawMap);

    const raw = item.geojson || item.geometry || item.geom;
    if (raw) {
      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
          this._drawMode = 'POLYLINE';
          this.drawnCoords = geo.coordinates.map(c => [c[1], c[0]]);
        } else if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
          this._drawMode = 'POINT';
          this.drawnCoords = [[geo.coordinates[1], geo.coordinates[0]]];
        }
      } catch {}
    } else if (item.lat && item.lng) {
      this._drawMode = 'POINT';
      this.drawnCoords = [[parseFloat(item.lat), parseFloat(item.lng)]];
    }

    this._setDrawMode(this._drawMode, false);
    this._refreshDrawLayers();

    setTimeout(() => {
      this.drawMap?.invalidateSize();
      if (this.drawnCoords.length && this.drawLayer) {
        const b = this.drawLayer.getBounds();
        if (b.isValid()) this.drawMap.fitBounds(b, { padding: [40, 40] });
      }
    }, 260);

    // إضافة النقاط عند النقر
    this.drawMap.on('click', e => {
      const { lat, lng } = e.latlng;
      if (this._drawMode === 'POINT') {
        this.drawnCoords = [[lat, lng]];
      } else {
        this.drawnCoords.push([lat, lng]);
      }
      this._refreshDrawLayers();
    });
  }

  _setDrawMode(mode, refresh = true) {
    this._drawMode = mode;
    const pBtn = document.getElementById('epm-mdraw-poly');
    const ptBtn = document.getElementById('epm-mdraw-point');
    if (pBtn && ptBtn) {
      if (mode === 'POLYLINE') {
        pBtn.style.background = '#0284c7';
        ptBtn.style.background = '#475569';
        document.getElementById('epm-mdstatus').textContent = 'وضع رسم المسار الخطي (Polyline)';
      } else {
        pBtn.style.background = '#475569';
        ptBtn.style.background = '#0284c7';
        document.getElementById('epm-mdstatus').textContent = 'وضع تحديد نقطة مفردة (Point)';
      }
    }
    if (refresh) this._refreshDrawLayers();
  }

  /* ─── إعادة رسم الطبقات والنقاط القابلة للسحب ─────────────────────── */
  _refreshDrawLayers() {
    if (!this.drawLayer) return;
    this.drawLayer.clearLayers();
    this.drawMarkers = [];

    if (!this.drawnCoords.length) {
      this._updateLength();
      return;
    }

    // تحديث حقلي الإحداثيات بأول نقطة
    const first = this.drawnCoords[0];
    const latInp = document.getElementById('epm-f-lat');
    const lngInp = document.getElementById('epm-f-lng');
    if (latInp && lngInp) {
      latInp.value = first[0].toFixed(6);
      lngInp.value = first[1].toFixed(6);
    }

    // رسم الخط
    if (this._drawMode === 'POLYLINE' && this.drawnCoords.length >= 2) {
      this._polyline = L.polyline(this.drawnCoords, {
        color: '#059669', weight: 5, opacity: 0.9, dashArray: '6, 6'
      }).addTo(this.drawLayer);
    }

    // رسم علامات النقاط القابلة للسحب
    this.drawnCoords.forEach((pt, idx) => {
      const marker = L.circleMarker(pt, {
        radius: 7, color: '#fff', fillColor: '#059669', fillOpacity: 1, weight: 2
      }).addTo(this.drawLayer);

      // السماح بالسحب والنقل المباشر
      if (typeof marker.on === 'function') {
        marker.bindTooltip(`نقطة (${idx + 1}) - اسحب للتعديل`, { permanent: false, direction: 'top' });
      }
      this.drawMarkers.push(marker);
    });

    this._updateLength();
  }

  _undoLastPoint() {
    if (this.drawnCoords.length > 0) {
      this.drawnCoords.pop();
      this._refreshDrawLayers();
      this._toast('↩️ تم التراجع عن النقطة الأخيرة.');
    }
  }

  _clearDraw() {
    this.drawnCoords = [];
    this._polyline = null;
    this._refreshDrawLayers();
    const lenInput = document.getElementById('epm-f-length');
    if (lenInput) lenInput.value = '0';
    document.getElementById('epm-length-text').textContent = '0.00 متر';
    document.getElementById('epm-mdstatus').textContent = 'تم مسح الرسم';
  }

  _updateLength() {
    let meters = 0;
    if (this.drawnCoords.length >= 2) {
      for (let i = 0; i < this.drawnCoords.length - 1; i++) {
        const p1 = L.latLng(this.drawnCoords[i][0], this.drawnCoords[i][1]);
        const p2 = L.latLng(this.drawnCoords[i+1][0], this.drawnCoords[i+1][1]);
        meters += p1.distanceTo(p2);
      }
      const lenInput = document.getElementById('epm-f-length');
      if (lenInput && meters > 0) lenInput.value = meters.toFixed(1);
    }
    const txtEl = document.getElementById('epm-length-text');
    if (txtEl) {
      txtEl.textContent = meters >= 1000 ? `${(meters / 1000).toFixed(2)} كم (${meters.toFixed(0)} م)` : `${meters.toFixed(1)} متر`;
    }
  }

  _locateUserPosition() {
    if (!navigator.geolocation) {
      this._toast('⚠️ خدمة تحديد الموقع غير مدعومة في متصفحك.');
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (this.drawMap) {
        this.drawMap.setView([lat, lng], 16);
        this.drawnCoords = [[lat, lng]];
        this._refreshDrawLayers();
        this._toast('📍 تم تحديد موقعك الحالي وإسقاطه على الخريطة.');
      }
    }, () => {
      this._toast('⚠️ تعذر الحصول على الإحداثيات الجغرافية.');
    });
  }

  /* ─── حفظ التصريح في قاعدة البيانات ─────────────────────────────────── */
  async _savePermit() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const code = gv('epm-f-code');
    const applicant = gv('epm-f-applicant');
    if (!code || !applicant) { this._toast('⚠️ رقم التصريح واسم مقدم الطلب إلزاميان.'); return; }

    const latVal = parseFloat(gv('epm-f-lat')) || (this.drawnCoords[0] ? this.drawnCoords[0][0] : 32.3301);
    const lngVal = parseFloat(gv('epm-f-lng')) || (this.drawnCoords[0] ? this.drawnCoords[0][1] : 35.7501);

    // تجهيز الإحداثيات بنظام GeoJSON القياسي [lng, lat]
    const coordinates = this.drawnCoords.length >= 2
      ? this.drawnCoords.map(c => [c[1], c[0]])
      : [[lngVal, latVal]];

    const payload = {
      id:                  this._editingId || null,
      code,
      permitNumber:        code,
      applicant,
      contractor:          gv('epm-f-contractor'),
      district:            gv('epm-f-district') || 'كفرنجة',
      purpose:             gv('epm-f-notes') || 'تزويد خدمات وتمديد خطوط',
      permitType:          gv('epm-f-type'),
      lengthM:             parseFloat(gv('epm-f-length')) || 0,
      widthM:              parseFloat(gv('epm-f-width')) || 0,
      depthM:              parseFloat(gv('epm-f-depth')) || 0,
      surfaceType:         gv('epm-f-surface'),
      insuranceFee:        parseFloat(gv('epm-f-insurance')) || 0,
      startDate:           gv('epm-f-start'),
      endDate:             gv('epm-f-end'),
      status:              gv('epm-f-status'),
      reinstatementStatus: gv('epm-f-reinstatement'),
      notes:               gv('epm-f-notes'),
      attributes: {
        clauses: this._activeClauses,
        saved_by: this._user?.username || 'engineer',
        draw_mode: this._drawMode
      },
      coordinates,
      lat: latVal,
      lng: lngVal
    };

    const btn = document.getElementById('epm-msave');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ في قاعدة البيانات...'; }

    try {
      if (typeof apiFetch === 'function') {
        await apiFetch('/v4/assets/permits', { method:'POST', body: JSON.stringify(payload) });
      } else {
        await fetch('/api/v4/assets/permits', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
      }

      this._toast('✅ تم اعتماد وحفظ تصريح الحفر والبنود بنجاح في قاعدة البيانات.');
      this._closeModal();
      await this._fetchPermits();
    } catch (err) {
      this._toast('❌ خطأ في الحفظ: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 اعتماد وحفظ التصريح والبنود'; }
    }
  }

  /* ─── حذف التصريح من قاعدة البيانات ─────────────────────────────────── */
  async _deletePermit(permitId) {
    const item = this.activeData.find(x => String(x.id) === String(permitId));
    const name = item?.code || item?.permit_number || permitId;
    if (!confirm(`⚠️ تأكيد حذف تصريح الحفر "${name}" نهائياً من قاعدة البيانات؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      if (typeof apiFetch === 'function') {
        await apiFetch(`/v4/assets/permits/${permitId}`, { method:'DELETE' });
      } else {
        await fetch(`/api/v4/assets/permits/${permitId}`, { method:'DELETE' });
      }
      this._toast(`🗑️ تم حذف التصريح "${name}" بنجاح.`);
      await this._fetchPermits();
    } catch (err) {
      this._toast('❌ خطأ في الحذف: ' + err.message);
    }
  }

  /* ─── تصدير ملف Excel / CSV ───────────────────────────────────────── */
  _exportCSV() {
    if (!this.activeData.length) {
      this._toast('⚠️ لا توجد بيانات للتصدير.');
      return;
    }

    const headers = ['رقم التصريح', 'نوع الخدمة', 'مقدم الطلب', 'المقاول المنفذ', 'المنطقة/الشارع', 'الطول (م)', 'العرض (م)', 'العمق (م)', 'مبلغ التأمين', 'الحالة', 'حالة إعادة التعبيد', 'تاريخ البدء', 'تاريخ الانتهاء', 'البنود المعتمدة', 'ملاحظات'];
    
    const rows = this.activeData.map(r => {
      const clausesText = (r.attributes?.clauses || [])
        .filter(c => c.enabled !== false)
        .map(c => `[${c.title}]: ${c.text}`)
        .join(' | ');

      return [
        `"${r.code || r.permit_number || r.id || ''}"`,
        `"${(r.permit_type || r.entity_type || '').replace(/"/g, '""')}"`,
        `"${(r.applicant || r.applicant_name || '').replace(/"/g, '""')}"`,
        `"${(r.contractor || '').replace(/"/g, '""')}"`,
        `"${(r.district || r.location_description || 'كفرنجة').replace(/"/g, '""')}"`,
        `"${r.length_m || r.excavation_length || 0}"`,
        `"${r.width_m || r.excavation_width || 0}"`,
        `"${r.depth_m || 0}"`,
        `"${r.insurance_amount || r.insurance_fee || 0}"`,
        `"${(r.status || 'ACTIVE').replace(/"/g, '""')}"`,
        `"${(r.reinstatement_status || 'PENDING').replace(/"/g, '""')}"`,
        `"${r.start_date ? r.start_date.slice(0,10) : ''}"`,
        `"${r.end_date ? r.end_date.slice(0,10) : ''}"`,
        `"${clausesText.replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Excavation_Permits_Kufranjah_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this._toast('📊 تم تصدير ملف تصاريح الحفر بنجاح.');
  }

  /* ─── طباعة تصريح حفر رسمي معتمد مع بنود الالتزام والخريطة ─────────── */
  _printPermit(permitId) {
    const r = this.activeData.find(x => String(x.id) === String(permitId));
    if (!r) { this._toast('⚠️ لم يُعثر على بيانات تصريح الحفر.'); return; }

    const status = (r.status || 'ACTIVE').toUpperCase();
    const isCompleted = status.includes('COMPLETE') || (r.reinstatement_status || '').includes('تم إعادة التعبيد');
    const stLabel = isCompleted ? 'مكتمل ومُعاد التعبيد' : 'ساري المفعول وقيد التنفيذ';
    const stBg = isCompleted ? '#ecfdf5' : '#fffbeb';
    const stClr = isCompleted ? '#059669' : '#b45309';

    const clauses = (r.attributes?.clauses && r.attributes.clauses.length > 0)
      ? r.attributes.clauses.filter(c => c.enabled !== false)
      : this._getDefaultClauses();

    const clausesListHtml = clauses.map((c, i) => `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 9px; break-inside:avoid; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="font-weight:700; color:#1e3a8a; font-size:0.8rem; margin-bottom:2px; display:flex; align-items:center; gap:5px;">
          <span style="background:#1e3a8a15; color:#1e3a8a; font-size:0.72rem; padding:1px 5px; border-radius:3px;">بند ${i + 1}</span>
          <span>${c.title || 'شرط فني'}</span>
        </div>
        <div style="font-size:0.75rem; color:#334155; line-height:1.4;">${c.text || ''}</div>
      </div>
    `).join('');

    const permitNum = r.code || r.permit_number || r.id;
    const sDate = r.start_date ? String(r.start_date).slice(0, 10) : '—';
    const eDate = r.end_date ? String(r.end_date).slice(0, 10) : '—';
    const insFee = parseFloat(r.insurance_amount || r.insurance_fee || 0).toLocaleString('ar-JO', { minimumFractionDigits: 3 });

    // استخراج الإحداثيات الجغرافية للخريطة
    let coords = [];
    let isPoly = false;
    const raw = r.geojson || r.geometry || r.geom;
    if (raw) {
      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
          isPoly = true;
          coords = geo.coordinates.map(c => [c[1], c[0]]);
        } else if (geo.type === 'Point' && Array.isArray(geo.coordinates)) {
          coords = [[geo.coordinates[1], geo.coordinates[0]]];
        }
      } catch {}
    }
    if (!coords.length && r.lat && r.lng) {
      coords = [[parseFloat(r.lat), parseFloat(r.lng)]];
    }
    if (!coords.length) {
      coords = [[32.3301, 35.7501]];
    }

    const firstCoord = coords[0] || [32.3301, 35.7501];
    const latStr = firstCoord[0].toFixed(6);
    const lngStr = firstCoord[1].toFixed(6);

    const contentHtml = `
      <div style="font-family:'Tajawal', sans-serif; direction:rtl; text-align:right; color:#0f172a;">
        
        <!-- بطاقة البيانات الرسمية للتصريح -->
        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:8px; padding:8px 12px; margin-bottom:8px; page-break-inside:avoid; break-inside:avoid;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #1e3a8a; padding-bottom:4px; margin-bottom:6px;">
            <div style="font-weight:800; font-size:0.9rem; color:#1e3a8a;">📋 بيانات ومعلومات التصريح الفنية</div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="background:#1e3a8a15; color:#1e3a8a; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">رقم: ${permitNum}</span>
              <span style="background:${stBg}; color:${stClr}; border:1px solid ${stClr}; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.78rem;">${stLabel}</span>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
            <tr>
              <td style="padding:3px 6px; width:18%; color:#64748b; font-weight:bold;">نوع الخدمة المطلوبة:</td>
              <td style="padding:3px 6px; width:32%; font-weight:700; color:#1e3a8a;">${r.permit_type || r.entity_type || 'خدمات مياه وصرف صحي'}</td>
              <td style="padding:3px 6px; width:18%; color:#64748b; font-weight:bold;">مقدم الطلب / المستفيد:</td>
              <td style="padding:3px 6px; width:32%; font-weight:700;">${r.applicant || r.applicant_name || '—'}</td>
            </tr>
            <tr style="background:#f1f5f9;">
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">المقاول / الفني المنفذ:</td>
              <td style="padding:3px 6px; font-weight:600;">${r.contractor || '—'}</td>
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">المنطقة / الشارع:</td>
              <td style="padding:3px 6px; font-weight:600;">${r.district || r.location_description || 'كفرنجة'}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">أبعاد الحفرية:</td>
              <td style="padding:3px 6px; font-weight:700;">${r.length_m || r.excavation_length || 0} م (طول) × ${r.width_m || r.excavation_width || 1} م (عرض)</td>
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">نوع الطبقة السطحية:</td>
              <td style="padding:3px 6px; font-weight:600;">${r.surface_type || 'إسفلت ساخن'}</td>
            </tr>
            <tr style="background:#f1f5f9;">
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">مبلغ كفالة التأمين:</td>
              <td style="padding:3px 6px; font-weight:800; color:#0f766e;">${insFee} دينار أردني</td>
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">فترة سريان التصريح:</td>
              <td style="padding:3px 6px; font-weight:700;">من ${sDate} حتى ${eDate}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px; color:#64748b; font-weight:bold;">حالة إعادة التعبيد:</td>
              <td style="padding:3px 6px; font-weight:600;" colspan="3">${r.reinstatement_status || 'قيد المتابعة والتفتيش الميداني'} ${r.notes ? `(${r.notes})` : ''}</td>
            </tr>
          </table>
        </div>

        <!-- كرت خريطة الموقع والإسناد الجغرافي للمسار -->
        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:8px; padding:8px 12px; margin-bottom:8px; page-break-inside:avoid; break-inside:avoid;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #cbd5e1; padding-bottom:4px; margin-bottom:6px;">
            <div style="font-weight:800; font-size:0.86rem; color:#1e3a8a; display:flex; align-items:center; gap:5px;">
              🗺️ مخطط الموقع والإسناد الجغرافي للمسار (GIS Location Map)
            </div>
            <div style="font-size:0.75rem; color:#475569; display:flex; gap:8px; align-items:center;">
              <span><b>الإحداثيات:</b> Lat: ${latStr} , Lng: ${lngStr}</span>
              <span style="background:#1e3a8a15; color:#1e3a8a; padding:1px 6px; border-radius:4px; font-weight:bold;">${isPoly ? `مسار خطي (${coords.length} نقاط)` : 'موقع محدد'}</span>
            </div>
          </div>
          <div id="print-permit-gis-map" style="width:100%; height:165px; border-radius:6px; border:1px solid #cbd5e1; background:#e2e8f0; overflow:hidden; position:relative;"></div>
        </div>

        <!-- شروط وبنود الالتزام الفني والهندسي -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; margin-bottom:8px; page-break-inside:avoid; break-inside:avoid;">
          <div style="font-weight:800; color:#1e3a8a; font-size:0.85rem; margin-bottom:6px; border-bottom:1px solid #cbd5e1; padding-bottom:3px;">
            📑 شروط وبنود الالتزام الفني والهندسي المعتمدة:
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            ${clausesListHtml}
          </div>
        </div>

        <!-- التنبيه القانوني والمالي -->
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:5px 10px; font-size:0.75rem; line-height:1.4; color:#991b1b; font-weight:bold; margin-bottom:4px; page-break-inside:avoid; break-inside:avoid;">
          ⚠️ <b>تنبيه قانوني ملزم:</b> يعتبر هذا التصريح لاغياً بعد انتهاء مدته، وتُصادر كفالة التأمين المالي (${insFee} د.أ) فوراً وتُعاد الأوضاع على نفقة المخالف عند التأخر أو الإخلال بشروط التعبيد المعتمدة.
        </div>

        <!-- سكربت تفعيل خريطة الموقع على نافذة الطباعة -->
        <script>
          (function() {
            function renderPrintMap() {
              var el = document.getElementById('print-permit-gis-map');
              if (!el || typeof L === 'undefined') return;
              try {
                var coords = ${JSON.stringify(coords)};
                var isPoly = ${isPoly};
                var center = coords.length > 0 ? coords[0] : [32.3301, 35.7501];
                var map = L.map('print-permit-gis-map', {
                  zoomControl: false,
                  attributionControl: false
                }).setView(center, 16);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  maxZoom: 19
                }).addTo(map);

                if (isPoly && coords.length >= 2) {
                  var poly = L.polyline(coords, {
                    color: '#059669',
                    weight: 6,
                    opacity: 0.95
                  }).addTo(map);
                  coords.forEach(function(pt) {
                    L.circleMarker(pt, { radius: 5, color: '#ffffff', fillColor: '#059669', fillOpacity: 1, weight: 2 }).addTo(map);
                  });
                  map.fitBounds(poly.getBounds(), { padding: [25, 25] });
                } else if (coords.length > 0) {
                  L.marker(coords[0]).addTo(map);
                }
                setTimeout(function() { map.invalidateSize(); }, 150);
              } catch (e) { console.error('Map print render error:', e); }
            }
            if (document.readyState === 'complete') renderPrintMap();
            else window.addEventListener('load', renderPrintMap);
            setTimeout(renderPrintMap, 120);
          })();
        </script>

      </div>
    `;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'تصريح حفر وتزويد وتمديد خدمات عامة معتمد',
        subtitle:  'مديرية الأشغال والخدمات الهندسية',
        refNumber: `PERM-${permitNum}-${new Date().getFullYear()}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخطط الإسناد الجغرافي GIS + وصل التأمين المالي',
        documentType: 'PERMIT',
        sectionName: 'رئيس القسم',
        approvalWorkflow: [
          {
            order: 1,
            key: 'APPLICANT',
            stageTitle: 'تعهد والتزام المستفيد/المقاول',
            roleName: r.applicant || 'المستفيد / المقاول المنفذ',
            icon: '👷',
            signLabel: 'التوقيع والتعهد بالالتزام'
          },
          {
            order: 2,
            key: 'SECTION_HEAD',
            stageTitle: 'الكشف والتدقيق الفني',
            roleName: 'رئيس القسم',
            icon: '🔍',
            signLabel: 'التوقيع والتاريخ'
          },
          {
            order: 3,
            key: 'DIRECTOR',
            stageTitle: 'المصادقة والاعتماد الرسمي',
            roleName: 'مدير الأشغال والخدمات الهندسية',
            icon: '🏛️',
            signLabel: 'التوقيع والاعتماد الرسمي'
          }
        ],
        contentHtml
      });
    } else {
      window.print();
    }
  }

  /* ─── طباعة السجل الشامل لتصاريح الحفر ──────────────────────────── */
  _printAll() {
    const data = this.activeData;
    if (!data.length) { this._toast('⚠️ لا توجد بيانات للطباعة.'); return; }

    const aCount = data.filter(n => (n.status || '').toUpperCase().includes('ACTIVE')).length;
    const wCount = data.filter(n => (n.permit_type || n.entity_type || '').toUpperCase().includes('WATER')).length;
    const cCount = data.filter(n => (n.status || '').toUpperCase().includes('COMPLETE')).length;
    const totalInsurance = data.reduce((s, x) => s + parseFloat(x.insurance_amount || x.insurance_fee || 0), 0);

    const kpiHtml = `
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin:14px 0 18px 0;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#059669;">${data.length}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">إجمالي التصاريح</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#1d4ed8;">${aCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تصاريح سارية قيد التنفيذ</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#d97706;">${wCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تزويد مياه وصرف صحي</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#0d9488;">${totalInsurance.toFixed(0)} د.أ</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">إجمالي مبالغ التأمين</div>
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'سجل حصر ومتابعة تصاريح الحفر وتزويد الخدمات العامة',
        subtitle:  'كشف الرصد الفني والتفتيش على إعادة الحال — بلدية كفرنجة الجديدة',
        refNumber: `PERM-REG-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخططات الإسناد الجغرافي GIS',
        type:      'list',
        summaryHtml: kpiHtml,
        data: data.map(r => {
          return {
            code:       r.code || r.permit_number || r.id,
            type:       r.permit_type || r.entity_type || 'خدمات عامة',
            applicant:  r.applicant || r.applicant_name || '—',
            contractor: r.contractor || '—',
            district:   r.district || r.location_description || 'كفرنجة',
            dims:       `${r.length_m || r.excavation_length || 0}م × ${r.width_m || r.excavation_width || 1}م`,
            insurance:  `${r.insurance_amount || r.insurance_fee || 0} د.أ`,
            status:     (r.status || 'ACTIVE').includes('COMPLETE') ? 'مكتمل' : 'ساري'
          };
        }),
        columns: [
          { key:'code',       label:'رقم التصريح' },
          { key:'type',       label:'نوع الخدمة' },
          { key:'applicant',  label:'مقدم الطلب' },
          { key:'contractor', label:'المقاول المنفذ' },
          { key:'district',   label:'المنطقة / الشارع' },
          { key:'dims',       label:'الأبعاد' },
          { key:'insurance',  label:'مبلغ التأمين' },
          { key:'status',     label:'الحالة' }
        ],
        signatures: true
      });
    } else {
      window.print();
    }
  }

  /* ─── مساعدات ────────────────────────────────────────────────────── */
  _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[EPAMS]', msg);
  }
}

/* ── تسجيل الكلاس والدوال الموحدة ─────────────────────────────────── */
if (typeof window !== 'undefined') {
  window.ComprehensiveExcavationPermitsManager = ComprehensiveExcavationPermitsManager;
  window.excavationManager = null;

  window.loadExcavationPermits = async function() {
    const container = document.getElementById('excavation-tab-container');
    if (!container) return;
    try {
      if (window.excavationManager && container.children.length > 0) {
        setTimeout(() => {
          if (window.excavationManager.map) window.excavationManager.map.invalidateSize();
          if (typeof window.excavationManager._applyFilterAndRender === 'function') {
            window.excavationManager._applyFilterAndRender();
          }
        }, 150);
        return;
      }
      container.innerHTML = '';
      window.excavationManager = new ComprehensiveExcavationPermitsManager('excavation-tab-container');
    } catch (e) {
      console.error('loadExcavationPermits error:', e);
      container.innerHTML = `<div style="padding:20px;color:#f87171;text-align:center;">❌ ${e.message}</div>`;
    }
  };

  window.openNewExcavationPermitModal = function() {
    if (window.excavationManager && typeof window.excavationManager._openModal === 'function') {
      window.excavationManager._openModal(null);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveExcavationPermitsManager;
}
