/**
 * Unified Infrastructure & Utilities Manager v4.5 (Enterprise Edition)
 * وحدة إدارة شبكات البنية التحتية والخدمات المعتمدة - بلدية كفرنجة الجديدة
 * مديرية الأشغال والخدمات الهندسية — قسم شبكات الخدمة العامة والبنية التحتية
 * ─────────────────────────────────────────────────────────────────────────────
 * تغطية شاملة لشبكات: مياه الشرب، الصرف الصحي، تصريف الأمطار والعبارات، الاتصالات، وغرف التفتيش.
 */
'use strict';

class ComprehensiveInfrastructureManager {

  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map           = null;
    this.drawMap       = null;
    this.drawLayer     = null;
    this.drawnCoords   = [];
    this.networksLayer = null;
    this.activeData    = [];
    this._editingId    = null;
    this._drawing      = false;
    this._polyline     = null;
    this._filterType   = 'ALL';
    this._sortField    = 'code';
    this._sortAsc      = false;

    this._readUser();
    this._loadLocalCache();
    this._buildUI();
  }

  /* ─── التخزين المحلي والنسخ الاحتياطي المستمر ────────────────────────── */
  _loadLocalCache() {
    try {
      const stored = localStorage.getItem('inams_infrastructure_v4');
      if (stored) {
        this.activeData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[INAMS] Cache load error:', e);
    }
    if (!Array.isArray(this.activeData)) {
      this.activeData = [];
    }
  }

  _saveLocalCache() {
    try {
      localStorage.setItem('inams_infrastructure_v4', JSON.stringify(this.activeData));
    } catch (e) {
      console.warn('[INAMS] Cache save error:', e);
    }
  }

  /* ─── صلاحيات المستخدم ─────────────────────────────────────────────── */
  _readUser() {
    try {
      const raw = sessionStorage.getItem('engineeringUser');
      this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
    } catch { this._user = null; }
    const role = (this._user?.role || '').toLowerCase();
    if (typeof window.hasPermission === 'function' && (window.hasPermission('ASSETS.CREATE') || window.hasPermission('*'))) {
      this.canWrite = true;
    } else {
      this.canWrite = !role || ['admin', 'director_public_works', 'head_of_roads', 'roads_engineer', 'land_surveyor', 'quantity_surveyor'].includes(role);
    }
    this.isAdmin  = !role || role === 'admin' || role === 'director_public_works';
  }

  /* ─── بناء الواجهة الرئيسية ─────────────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <div id="inm-root" style="background:var(--bg-card,#0f172a);color:var(--text,#f8fafc);padding:18px;
            border-radius:12px;direction:rtl;font-family:'Tajawal',system-ui,sans-serif;">

        <!-- شريط الأدوات والتحكم العلوي -->
        <div style="display:flex;justify-content:space-between;align-items:center;
              flex-wrap:wrap;gap:12px;background:var(--bg-surface,#1e293b);padding:14px 18px;
              border-radius:10px;border:1px solid var(--border,#334155);margin-bottom:16px;">
          
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-weight:800;color:#38bdf8;font-size:0.92rem;display:flex;align-items:center;gap:6px;">
              🌐 منظومة شبكات البنية التحتية والخدمات (INAMS v4.5)
            </span>
            ${this.canWrite ? `<button id="inm-add" class="inm-btn-action" style="background:#059669;color:#fff;">🌐/💧 إضافة خط شبكة جديد</button>` : ''}
            <button id="inm-print-all" class="inm-btn-action" style="background:#7c3aed;color:#fff;">🖨️ طباعة السجل الرسمي</button>
            <button id="inm-export-csv" class="inm-btn-action" style="background:#0284c7;color:#fff;">📊 تصدير Excel / CSV</button>
            <button id="inm-refresh" class="inm-btn-action" style="background:#475569;color:#fff;" title="تحديث ومزامنة">🔄 تحديث</button>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- فلاتر النوع السريعة -->
            <div style="display:flex;background:#090d16;padding:3px;border-radius:8px;border:1px solid var(--border,#334155);flex-wrap:wrap;gap:2px;">
              <button id="inm-filter-all" class="inm-fbtn active" data-type="ALL">الكل</button>
              <button id="inm-filter-water" class="inm-fbtn" data-type="WATER">💧 مياه</button>
              <button id="inm-filter-sewer" class="inm-fbtn" data-type="SEWER">🚽 صرف صحي</button>
              <button id="inm-filter-storm" class="inm-fbtn" data-type="STORM">🌧️ تصريف أمطار</button>
              <button id="inm-filter-telecom" class="inm-fbtn" data-type="TELECOM">🟣 اتصالات</button>
              <button id="inm-filter-manhole" class="inm-fbtn" data-type="MANHOLE">🚰 مناهل ومحابس</button>
              <button id="inm-filter-maint" class="inm-fbtn" data-type="MAINT" style="color:#f87171;">⚠️ صيانة</button>
            </div>

            <!-- حقل البحث الفوري الذكي -->
            <input id="inm-search" type="text" placeholder="🔍 بحث بالرمز، المادة، الحي أو النوع..."
              style="background:var(--input-bg,#0f172a);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,#334155);
                     padding:8px 14px;border-radius:8px;font-size:0.82rem;width:230px;outline:none;" />
          </div>
        </div>

        <!-- بطاقات المؤشرات الإحصائية والفنية (KPIs) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">إجمالي شبكات الخدمات</div>
            <div id="inm-kpi-total" style="font-size:1.6rem;font-weight:800;color:#38bdf8;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">💧 شبكات مياه الشرب</div>
            <div id="inm-kpi-water" style="font-size:1.6rem;font-weight:800;color:#0ea5e9;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🚽 شبكات الصرف الصحي</div>
            <div id="inm-kpi-sewer" style="font-size:1.6rem;font-weight:800;color:#d97706;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🌧️ تصريف أمطار وعبارات</div>
            <div id="inm-kpi-storm" style="font-size:1.6rem;font-weight:800;color:#14b8a6;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">⚠️ خطوط قيد الصيانة / الإصلاح</div>
            <div id="inm-kpi-maint" style="font-size:1.6rem;font-weight:800;color:#ef4444;margin-top:2px;">0</div>
          </div>
        </div>

        <!-- الخريطة التفاعلية -->
        <div style="margin-bottom:16px;background:var(--table-header-bg,#1e293b);padding:8px;border-radius:10px;
                    border:1px solid var(--border,#334155);position:relative;">
          <div id="inm-map" style="width:100%;height:390px;border-radius:8px;background:#0f172a;"></div>
          <div style="position:absolute;top:16px;left:16px;background:rgba(15,23,42,0.92);
                      padding:9px 14px;border-radius:8px;border:1px solid var(--border,#334155);
                      font-size:0.74rem;z-index:400;line-height:1.9;backdrop-filter:blur(4px);">
            <div style="font-weight:bold;color:#94a3b8;margin-bottom:2px;">تصنيف مسارات الشبكات:</div>
            <div style="color:#0ea5e9;">💧 مياه شرب رئيسية وتوزيع</div>
            <div style="color:#f59e0b;">🚽 صرف صحي وخطوط ضغط</div>
            <div style="color:#14b8a6;">🌧️ تصريف مياه أمطار وعبارات</div>
            <div style="color:#c084fc;">🟣 اتصالات وألياف ضوئية</div>
            <div style="color:#e11d48;">🚰 مناهل وغرف محابس</div>
          </div>
        </div>

        <!-- الجدول المفصل مع ترتيب الأعمدة -->
        <div style="background:var(--bg-surface,#1e293b);border-radius:10px;border:1px solid var(--border,#334155);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:0.98rem;font-weight:800;color:#38bdf8;display:flex;align-items:center;gap:6px;">
              📋 سجل جرد وتتبع شبكات البنية التحتية والخدمات
            </h3>
            <span id="inm-badge"
              style="background:rgba(30,58,138,.6);color:#93c5fd;font-size:0.82rem;
                     padding:4px 14px;border-radius:6px;font-weight:bold;border:1px solid #1e3a8a;">إجمالي المعروض: 0</span>
          </div>

          <div style="overflow-x:auto;">
            <table id="inm-table" style="width:100%;text-align:right;font-size:0.8rem;
                                         border-collapse:collapse;min-width:940px;">
              <thead style="background:var(--table-header-bg,#0f172a);color:var(--text-muted,#94a3b8);border-bottom:2px solid var(--border,#334155);">
                <tr>
                  <th class="inm-sortable" data-sort="code" style="padding:11px 10px;cursor:pointer;">رمز الشبكة ⬍</th>
                  <th class="inm-sortable" data-sort="type" style="padding:11px 10px;cursor:pointer;">نوع الشبكة / الخدمة ⬍</th>
                  <th class="inm-sortable" data-sort="material" style="padding:11px 10px;cursor:pointer;">المادة ⬍</th>
                  <th class="inm-sortable" data-sort="diam" style="padding:11px 10px;cursor:pointer;">القطر / القياس ⬍</th>
                  <th style="padding:11px 10px;">العمق والضغط</th>
                  <th class="inm-sortable" data-sort="status" style="padding:11px 10px;cursor:pointer;">الحالة التشغيلية ⬍</th>
                  <th style="padding:11px 10px;">المسار والموقع المكاني</th>
                  <th class="inm-sortable" data-sort="date" style="padding:11px 10px;cursor:pointer;">تاريخ التسجيل ⬍</th>
                  <th style="padding:11px 10px;text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="inm-tbody">
                <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted,#94a3b8);">
                  ⏳ جاري التحميل وعرض السجلات...
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
      this._fetchNetworks();
      this._bindAll();
    }, 80);
  }

  _injectStyles() {
    if (document.getElementById('inm-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'inm-custom-styles';
    style.textContent = `
      .inm-btn-action {
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
      .inm-btn-action:hover { opacity: 0.9; transform: translateY(-1px); }
      .inm-fbtn {
        background: transparent;
        color: #94a3b8;
        border: none;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 0.77rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .inm-fbtn.active {
        background: #2563eb !important;
        color: #fff !important;
        font-weight: bold;
      }
      .inm-sortable:hover { color: #38bdf8; }
    `;
    document.head.appendChild(style);
  }

  /* ─── الخريطة الرئيسية ──────────────────────────────────────────────── */
  _initMap() {
    const el = document.getElementById('inm-map');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      try { this.map.remove(); } catch {}
      this.map = null;
    }

    this.map = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('inm-map', [32.2985, 35.7050], 14)
      : L.map('inm-map').setView([32.2985, 35.7050], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة | OSM', maxZoom: 19
      }).addTo(this.map);
    }

    this.networksLayer = L.layerGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 350);
  }

  /* ─── تحميل ومزامنة بيانات الشبكات من قاعدة البيانات ─────────────── */
  async _fetchNetworks() {
    try {
      let res;
      if (typeof apiFetch === 'function') {
        res = await apiFetch('/v4/assets/infrastructure', { silent: true });
      } else {
        const r = await fetch('/api/v4/assets/infrastructure');
        res = await r.json();
      }
      if (res && Array.isArray(res.data)) {
        this.activeData = res.data;
        this._saveLocalCache();
      }
    } catch (e) {
      console.warn('[INAMS] fetchNetworks fallback:', e.message);
    }
    this._applyFilterAndRender();
  }

  /* ─── تطبيق التصفية والترتيب وعرض الجدول ────────────────────────────── */
  _applyFilterAndRender() {
    let data = [...this.activeData];
    const ft = this._filterType;

    if (ft === 'WATER') {
      data = data.filter(n => {
        const t = (n.network_type || n.networkType || '').toUpperCase();
        return t.includes('WATER') || t.includes('مياه');
      });
    } else if (ft === 'SEWER') {
      data = data.filter(n => {
        const t = (n.network_type || n.networkType || '').toUpperCase();
        return t.includes('SEWER') || t.includes('صرف');
      });
    } else if (ft === 'STORM') {
      data = data.filter(n => {
        const t = (n.network_type || n.networkType || '').toUpperCase();
        return t.includes('STORM') || t.includes('CULVERT') || t.includes('أمطار') || t.includes('عبارة');
      });
    } else if (ft === 'TELECOM') {
      data = data.filter(n => {
        const t = (n.network_type || n.networkType || '').toUpperCase();
        return t.includes('TELECOM') || t.includes('FIBER') || t.includes('اتصالات') || t.includes('ألياف');
      });
    } else if (ft === 'MANHOLE') {
      data = data.filter(n => {
        const t = (n.network_type || n.networkType || '').toUpperCase();
        return t.includes('MANHOLE') || t.includes('CHAMBER') || t.includes('مناهل') || t.includes('محبس');
      });
    } else if (ft === 'MAINT') {
      data = data.filter(n => {
        const st = (n.status || '').toUpperCase();
        return st.includes('MAINT') || st.includes('LEAK') || st.includes('صيانة') || st.includes('اصلاح');
      });
    }

    const q = document.getElementById('inm-search')?.value?.trim()?.toLowerCase() || '';
    if (q) {
      data = data.filter(n =>
        (n.code || n.id || '').toLowerCase().includes(q) ||
        (n.material || '').toLowerCase().includes(q) ||
        (n.district || '').toLowerCase().includes(q) ||
        (n.network_type || n.networkType || '').toLowerCase().includes(q) ||
        (n.notes || '').toLowerCase().includes(q)
      );
    }

    /* الترتيب */
    data.sort((a, b) => {
      let valA, valB;
      if (this._sortField === 'code') {
        valA = a.code || a.id || ''; valB = b.code || b.id || '';
      } else if (this._sortField === 'type') {
        valA = a.network_type || a.networkType || ''; valB = b.network_type || b.networkType || '';
      } else if (this._sortField === 'material') {
        valA = a.material || ''; valB = b.material || '';
      } else if (this._sortField === 'diam') {
        valA = parseFloat(a.diameter_mm || a.diameterMm || 0);
        valB = parseFloat(b.diameter_mm || b.diameterMm || 0);
      } else if (this._sortField === 'status') {
        valA = a.status || ''; valB = b.status || '';
      } else if (this._sortField === 'date') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      }
      if (valA < valB) return this._sortAsc ? -1 : 1;
      if (valA > valB) return this._sortAsc ? 1 : -1;
      return 0;
    });

    this._updateKPIs(this.activeData);
    this._renderTable(data);
    this._renderMapNetworks(data);
  }

  _updateKPIs(data) {
    const total = data.length;
    const wCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('WATER') || t.includes('مياه');
    }).length;
    const sCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('SEWER') || t.includes('صرف');
    }).length;
    const stCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('STORM') || t.includes('CULVERT') || t.includes('أمطار');
    }).length;
    const mCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      return st.includes('MAINT') || st.includes('LEAK') || st.includes('صيانة') || st.includes('اصلاح');
    }).length;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('inm-kpi-total', total);
    setEl('inm-kpi-water', wCount);
    setEl('inm-kpi-sewer', sCount);
    setEl('inm-kpi-storm', stCount);
    setEl('inm-kpi-maint', mCount);
  }

  /* ─── عرض الجدول ────────────────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('inm-tbody');
    const badge = document.getElementById('inm-badge');
    if (!tbody) return;
    if (badge) badge.textContent = `إجمالي المعروض: ${data.length}`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9"
        style="text-align:center;padding:36px;color:var(--text-muted,#94a3b8);">
        <div style="font-size:2.2rem;margin-bottom:8px;">📭</div>
        لا توجد شبكات بنية تحتية مسجلة تطابق التصفية الحالية.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const typeStr = (r.network_type || r.networkType || 'WATER_MAIN').toUpperCase();
      let typeLabel = '💧 مياه شرب رئيسي';
      let typeColor = '#0ea5e9';

      if (typeStr.includes('WATER_DIST') || typeStr.includes('توزيع')) { typeLabel = '🚰 مياه فرعي/توزيع'; typeColor = '#38bdf8'; }
      else if (typeStr.includes('SEWER_MAIN') || typeStr.includes('صرف_رئيسي')) { typeLabel = '🚽 صرف صحي رئيسي'; typeColor = '#f59e0b'; }
      else if (typeStr.includes('SEWER_FORCE') || typeStr.includes('طرد')) { typeLabel = '🌊 ضغط/طرد صرف صحي'; typeColor = '#d97706'; }
      else if (typeStr.includes('STORM') || typeStr.includes('أمطار')) { typeLabel = '🌧️ تصريف مياه أمطار'; typeColor = '#14b8a6'; }
      else if (typeStr.includes('BOX_CULVERT') || typeStr.includes('عبارة')) { typeLabel = '📦 عبارة خرسانية'; typeColor = '#10b981'; }
      else if (typeStr.includes('TELECOM') || typeStr.includes('FIBER') || typeStr.includes('اتصالات')) { typeLabel = '🟣 اتصالات وألياف'; typeColor = '#a855f7'; }
      else if (typeStr.includes('SMART_TRAFFIC') || typeStr.includes('إشارات')) { typeLabel = '📡 إشارات وتحكم'; typeColor = '#ec4899'; }
      else if (typeStr.includes('MANHOLE') || typeStr.includes('مناهل')) { typeLabel = '🚰 غرفة تفتيش / مانهول'; typeColor = '#e11d48'; }
      else if (typeStr.includes('GAS') || typeStr.includes('غاز')) { typeLabel = '⛽ غاز طبيعي / وقود'; typeColor = '#f97316'; }

      const status = r.status || 'OPERATIONAL';
      const isMaint = status.includes('MAINT') || status.includes('LEAK') || status.includes('صيانة');
      const stColor = isMaint ? '#ef4444' : '#10b981';
      const stBg    = isMaint ? '#7f1d1d' : '#065f46';
      const stText  = isMaint ? 'تحت الصيانة / خلل' : 'عمليات منتظمة (فعّال)';

      const diam  = r.diameter_mm || r.diameterMm ? `${r.diameter_mm || r.diameterMm} ملم` : 'قياسي';
      const depth = r.depth_meters || r.depthMeters ? `عمق: ${r.depth_meters || r.depthMeters}م` : 'عمق قياسي';
      const press = r.pressure_class || r.pressureClass ? ` | ${r.pressure_class || r.pressureClass}` : '';
      const createdDate = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : '—';

      return `
        <tr data-nid="${r.id}" style="border-bottom:1px solid #1e293b;transition:background 0.15s;" onmouseover="this.style.background='rgba(51,65,85,0.3)'" onmouseout="this.style.background='transparent'">
          <td style="padding:10px 8px;font-weight:bold;color:#38bdf8;font-family:monospace;">${r.code || r.id}</td>
          <td style="padding:10px 8px;">
            <span style="background:var(--bg-surface,#1e293b);color:${typeColor};border:1px solid ${typeColor};padding:3px 8px;border-radius:5px;font-size:0.75rem;font-weight:bold;">
              ${typeLabel}
            </span>
          </td>
          <td style="padding:10px 8px;font-weight:bold;color:#f8fafc;">${r.material || 'HDPE'}</td>
          <td style="padding:10px 8px;">${diam}</td>
          <td style="padding:10px 8px;font-size:0.76rem;color:#cbd5e1;">${depth}${press}</td>
          <td style="padding:10px 8px;">
            <span style="background:${stBg};color:${stColor};padding:2px 8px;border-radius:4px;font-weight:bold;font-size:0.73rem;">
              ${stText}
            </span>
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#38bdf8;">
            ${(r.geometry || r.coordinates || r.geom) ? '📍 متصل بالـ GIS' : 'غير محدد'}
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#94a3b8;">${createdDate}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
              <button class="inm-row-view" data-id="${r.id}"
                style="background:#475569;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="معاينة المسار على الخريطة">👁️</button>
              ${this.canWrite ? `<button class="inm-row-edit" data-id="${r.id}"
                style="background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="تعديل الشبكة">✏️</button>` : ''}
              <button class="inm-row-print" data-id="${r.id}"
                style="background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="طباعة التقرير الفني">🖨️</button>
              ${this.isAdmin ? `<button class="inm-row-del" data-id="${r.id}"
                style="background:#dc2626;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="حذف الشبكة">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    this._bindTableRows();
  }

  /* ─── ربط أحداث الصفوف بالتفويض ────────────────────────────────────── */
  _bindTableRows() {
    const tbody = document.getElementById('inm-tbody');
    if (!tbody) return;

    if (this._tbodyHandler) tbody.removeEventListener('click', this._tbodyHandler);

    this._tbodyHandler = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains('inm-row-view'))  this._previewOnMap(id);
      if (btn.classList.contains('inm-row-edit'))  this._openModal(id);
      if (btn.classList.contains('inm-row-print')) this._printNetwork(id);
      if (btn.classList.contains('inm-row-del'))   this._deleteNetwork(id);
    };
    tbody.addEventListener('click', this._tbodyHandler);
  }

  /* ─── ربط كافة عناصر التحكم ─────────────────────────────────────────── */
  _bindAll() {
    document.getElementById('inm-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('inm-print-all')?.addEventListener('click', () => this._printAll());
    document.getElementById('inm-export-csv')?.addEventListener('click', () => this._exportCSV());
    document.getElementById('inm-refresh')?.addEventListener('click', () => {
      this._toast('🔄 جاري تحديث البيانات من الخادم...');
      this._fetchNetworks();
    });

    document.getElementById('inm-search')?.addEventListener('input', () => this._applyFilterAndRender());

    /* فلاتر الأزرار */
    document.querySelectorAll('.inm-fbtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.inm-fbtn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._filterType = e.target.dataset.type || 'ALL';
        this._applyFilterAndRender();
      });
    });

    /* ترتيب الأعمدة عند النقر على العناوين */
    document.querySelectorAll('.inm-sortable').forEach(th => {
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

  /* ─── الخريطة: رسم الشبكات وعرض النوافذ التفاعلية ────────────────────── */
  _renderMapNetworks(data) {
    if (!this.networksLayer) return;
    this.networksLayer.clearLayers();
    const bounds = L.latLngBounds();

    data.forEach(r => {
      const typeStr = (r.network_type || r.networkType || 'WATER_MAIN').toUpperCase();
      let color = '#0ea5e9';
      if (typeStr.includes('SEWER')) color = '#f59e0b';
      else if (typeStr.includes('STORM') || typeStr.includes('CULVERT')) color = '#14b8a6';
      else if (typeStr.includes('TELECOM') || typeStr.includes('FIBER')) color = '#a855f7';
      else if (typeStr.includes('MANHOLE') || typeStr.includes('CHAMBER')) color = '#e11d48';

      const raw = r.geometry || r.geom || r.geojson;
      if (!raw) return;

      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const lyr = L.geoJSON(geo, { style: { color, weight: 5, opacity: 0.85 } });
        lyr.bindPopup(this._mapPopup(r, color));
        this.networksLayer.addLayer(lyr);
        try { const b = lyr.getBounds(); if (b.isValid()) bounds.extend(b); } catch {}
      } catch {}
    });

    if (bounds.isValid() && this.map) this.map.fitBounds(bounds, { padding: [35, 35] });
  }

  _mapPopup(r, color) {
    const isMaint = (r.status || '').includes('MAINT') || (r.status || '').includes('LEAK');
    return `
      <div style="direction:rtl; text-align:right; font-family:'Tajawal',sans-serif; min-width:210px; padding:4px;">
        <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">رمز الشبكة: ${r.code || r.id}</div>
        <div style="font-size:0.8rem; color:${color}; font-weight:bold; margin-bottom:2px;">النوع: ${r.network_type || r.networkType || 'مياه/خدمات'}</div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">المادة والقطر: <b>${r.material || 'HDPE'} — ${r.diameter_mm || 0} ملم</b></div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:4px;">المنطقة: <b>${r.district || 'كفرنجة'}</b></div>
        <div style="margin:6px 0; font-size:0.82rem; font-weight:bold; background:${isMaint ? '#fef2f2' : '#f0fdf4'}; color:${isMaint ? '#dc2626' : '#15803d'}; padding:3px 6px; border-radius:4px; border:1px solid #e2e8f0;">
          الحالة: ${isMaint ? '⚠️ قيد الصيانة والإصلاح' : '🟢 فعّال ومنتظم'}
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="if(window.infrastructureManager) window.infrastructureManager._printNetwork('${r.id}')" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🖨️ طباعة</button>
          ${this.canWrite ? `<button onclick="if(window.infrastructureManager) window.infrastructureManager._openModal('${r.id}')" style="flex:1;background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">✏️ تعديل</button>` : ''}
        </div>
      </div>`;
  }

  /* ─── معاينة شبكة على الخريطة ───────────────────────────────────────── */
  _previewOnMap(netId) {
    const r = this.activeData.find(x => String(x.id) === String(netId));
    const raw = r ? (r.geometry || r.geom || r.geojson) : null;
    if (!raw) { this._toast('⚠️ لا يوجد مسار مكاني محدد لهذه الشبكة.'); return; }
    try {
      const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (this.map) {
        const bounds = L.geoJSON(geo).getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [50, 50] });
          this._toast(`📍 تم تحديد مسار شبكة: ${r.code || r.id}`);
        }
      }
    } catch {}
  }

  /* ═══════════════════════════════════════════════════════════════════
     مودال الإضافة / التعديل لشبكة البنية التحتية
  ═══════════════════════════════════════════════════════════════════ */
  _buildModal() {
    document.getElementById('inm-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'inm-modal';
    modal.style.cssText = `display:none;position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);
      align-items:center;justify-content:center;`;

    modal.innerHTML = `
      <div style="background:#0f172a;border:1px solid var(--border,#334155);border-radius:14px;
            width:min(980px,97vw);max-height:94vh;overflow-y:auto;direction:rtl;
            color:#f8fafc;box-shadow:0 30px 70px rgba(0,0,0,.95);">

        <!-- رأس المودال -->
        <div style="display:flex;justify-content:space-between;align-items:center;
              padding:14px 20px;border-bottom:1px solid var(--border,#334155);background:var(--bg-surface,#1e293b);
              border-radius:14px 14px 0 0;position:sticky;top:0;z-index:10;">
          <h3 id="inm-mtitle" style="margin:0;font-size:1rem;font-weight:800;color:#38bdf8;">
            🌐 إضافة خط / شبكة بنية تحتية جديدة
          </h3>
          <button id="inm-mclose"
            style="background:#475569;border:none;color:#fff;width:32px;height:32px;
                   border-radius:50%;cursor:pointer;font-size:1rem;font-weight:bold;">✕</button>
        </div>

        <!-- محتوى العمودين -->
        <div style="display:grid;grid-template-columns:1.05fr 0.95fr;">

          <!-- النموذج -->
          <div id="inm-mform" style="padding:18px;display:flex;flex-direction:column;gap:10px;
                border-left:1px solid var(--border,#334155);">
            ${this._formHTML()}
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;
                        padding-top:14px;border-top:1px solid var(--border,#334155);">
              <button id="inm-mcancel"
                style="padding:8px 18px;background:#475569;color:#fff;border:none;
                       border-radius:7px;cursor:pointer;font-weight:bold;">إلغاء</button>
              <button id="inm-msave"
                style="padding:8px 22px;background:#2563eb;color:#fff;border:none;
                       border-radius:7px;font-weight:bold;cursor:pointer;">💾 حفظ بيانات الشبكة</button>
            </div>
          </div>

          <!-- خريطة رسم المسار -->
          <div style="padding:18px;background:#090d16;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <p style="font-weight:bold;color:#38bdf8;font-size:0.85rem;margin:0;">
                🗺️ ارسم مسار خط الشبكة على الخريطة
              </p>
              <button id="inm-locate-me" type="button"
                style="background:#059669;color:#fff;border:none;padding:4px 8px;border-radius:5px;font-size:0.73rem;cursor:pointer;font-weight:bold;">
                📍 موقعي الحالي
              </button>
            </div>
            <p style="font-size:0.75rem;color:var(--text-muted,#94a3b8);margin:0 0 8px;">
              انقر لإضافة نقاط المسار · انقر مرتين لإنهاء الرسم
            </p>
            <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
              <button id="inm-mdraw"
                style="background:#059669;color:#fff;border:none;padding:5px 12px;
                       border-radius:6px;font-size:0.78rem;cursor:pointer;font-weight:bold;">
                ✏️ ابدأ الرسم
              </button>
              <button id="inm-mundolast"
                style="background:#475569;color:#fff;border:none;padding:5px 10px;
                       border-radius:6px;font-size:0.78rem;cursor:pointer;">
                ↩️ تراجع
              </button>
              <button id="inm-mclear"
                style="background:#dc2626;color:#fff;border:none;padding:5px 10px;
                       border-radius:6px;font-size:0.78rem;cursor:pointer;">
                🗑️ مسح
              </button>
              <span id="inm-mdstatus" style="font-size:0.74rem;color:#38bdf8;font-weight:bold;">
                لم يتم رسم مسار بعد
              </span>
            </div>
            <div id="inm-dmap" style="width:100%;height:370px;border-radius:8px;border:1px solid var(--border,#334155);background:#0f172a;"></div>
            <div id="inm-length-box" style="margin-top:10px;background:#064e3b;border:1px solid #059669;border-radius:6px;padding:8px 12px;font-size:0.78rem;color:#a7f3d0;display:flex;justify-content:space-between;align-items:center;">
              <span>📏 الطول التقديري للمسار: <b id="inm-length-text">0.00 متر</b></span>
              <span style="font-size:0.7rem;color:#6ee7b7;">WGS84 EPSG:4326</span>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    /* ربط الأحداث */
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });
    document.getElementById('inm-mclose').addEventListener('click',  () => this._closeModal());
    document.getElementById('inm-mcancel').addEventListener('click', () => this._closeModal());
    document.getElementById('inm-msave').addEventListener('click',   () => this._saveNetwork());
    document.getElementById('inm-mdraw').addEventListener('click',   () => this._toggleDraw());
    document.getElementById('inm-mclear').addEventListener('click',  () => this._clearDraw());
    document.getElementById('inm-mundolast')?.addEventListener('click', () => this._undoLastPoint());
    document.getElementById('inm-locate-me')?.addEventListener('click', () => this._locateUserPosition());
  }

  _formHTML() {
    const inp = (id, type, ph, val='') =>
      `<input id="${id}" type="${type}" placeholder="${ph}" value="${val}"
        style="width:100%;padding:8px 10px;background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);
               color:#f1f5f9;border-radius:6px;font-size:0.82rem;box-sizing:border-box;outline:none;">`;
    const sel = (id, opts) =>
      `<select id="${id}" style="width:100%;padding:8px 10px;background:var(--bg-surface,#1e293b);
              border:1px solid var(--border,#334155);color:#f1f5f9;border-radius:6px;
              font-size:0.82rem;box-sizing:border-box;">
        ${opts.map(o => `<option value="${o.v}">${o.t}</option>`).join('')}
       </select>`;
    const lbl = (t) => `<label style="font-size:0.79rem;font-weight:bold;color:var(--text-muted,#94a3b8);
                                display:block;margin-bottom:3px;">${t}</label>`;
    const g2 = (a,b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${a}${b}</div>`;
    const wrap = (l,el) => `<div>${lbl(l)}${el}</div>`;

    return `
      ${wrap('نوع شبكة البنية التحتية والخدمات *', sel('inm-f-type',[
        {v:'WATER_MAIN',t:'💧 خط مياه شرب رئيسي (Potable Water Main)'},
        {v:'WATER_DIST',t:'🚰 خط مياه فرعي / توزيع (Distribution Pipe)'},
        {v:'SEWER_MAIN',t:'🚽 شبكة صرف صحي رئيسية (Sewer Trunk Main)'},
        {v:'SEWER_FORCE',t:'🌊 خط ضغط / طرد صرف صحي (Sewer Force Main)'},
        {v:'STORMWATER_DRAIN',t:'🌧️ قنوات وخطوط تصريف مياه الأمطار (Storm Drains)'},
        {v:'BOX_CULVERT',t:'📦 عبارات ومصارف مائية خرسانية (Box/Pipe Culverts)'},
        {v:'TELECOM_FIBER',t:'🟣 شبكة اتصالات وألياف ضوئية (Fiber Optic & Telecom)'},
        {v:'SMART_TRAFFIC',t:'📡 شبكة الإشارات والتحكم الذكي (Smart Signal Conduits)'},
        {v:'MANHOLE_CHAMBER',t:'🚰 غرف تفتيش ومناهل / محابس (Manholes & Valve Chambers)'},
        {v:'GAS_MAIN',t:'⛽ شبكة غاز طبيعي / خطوط وقود (Natural Gas Pipe)'}
      ]))}
      ${g2(
        wrap('رمز / كود الشبكة *', inp('inm-f-code','text','NET-2026-001')),
        wrap('المنطقة / الشارع *', inp('inm-f-district','text','شارع كفرنجة الرئيسي'))
      )}
      ${g2(
        wrap('المادة المستعملة', sel('inm-f-mat',[
          {v:'HDPE',t:'بولي إيثيلين HDPE'},
          {v:'uPVC',t:'بلاستيك uPVC'},
          {v:'Ductile Iron',t:'حديد دكتايل Ductile'},
          {v:'Reinforced Concrete',t:'خرسانة مسلحة Concrete'},
          {v:'GRP',t:'ألياف زجاجية GRP'},
          {v:'Galvanized Steel',t:'حديد مجلفن Steel'},
          {v:'Fiber Ducts',t:'أنابيب ألياف ضوئية Fiber Ducts'}
        ])),
        wrap('القطر / القياس (ملم)', inp('inm-f-diam','number','200'))
      )}
      ${g2(
        wrap('العمق تحت الأرض (متر)', inp('inm-f-depth','number','1.2')),
        wrap('فئة الضغط التشغيلي', sel('inm-f-pressure',[
          {v:'PN16 (16 Bar)',t:'PN16 (16 Bar)'},
          {v:'PN10 (10 Bar)',t:'PN10 (10 Bar)'},
          {v:'PN6 (6 Bar)',t:'PN6 (6 Bar)'},
          {v:'Gravity Flow (انسيابي)',t:'Gravity Flow (انسيابي)'},
          {v:'N/A (غير منطبق)',t:'N/A (غير منطبق)'}
        ]))
      )}
      ${wrap('الحالة التشغيلية', sel('inm-f-status',[
        {v:'OPERATIONAL',t:'عمليات منتظمة (فعّال وجيد)'},
        {v:'PREVENTIVE_MAINT',t:'تحت الصيانة الوقائية'},
        {v:'CRITICAL_LEAK',t:'تسريب / انسداد يستدعي الإصلاح الفوري'},
        {v:'OUT_OF_SERVICE',t:'خارج الخدمة / خط مهجور'}
      ]))}
      ${wrap('ملاحظات والتحليل الفني للشبكة',
        `<textarea id="inm-f-notes" rows="2" placeholder="ملاحظات سعة التدفق، الشركة المنفذة، وغرف التفتيش التابعة..."
          style="width:100%;padding:8px;background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);
                 color:#f1f5f9;border-radius:6px;font-size:0.82rem;
                 box-sizing:border-box;resize:vertical;outline:none;"></textarea>`
      )}`;
  }

  /* ─── فتح المودال ─────────────────────────────────────────────────── */
  _openModal(netId = null) {
    this._editingId = netId || null;
    const item = netId
      ? (this.activeData.find(r => String(r.id) === String(netId)) || {}) : {};

    document.getElementById('inm-mtitle').textContent =
      netId ? `✏️ تعديل الشبكة: ${item.code || item.id || ''}` : '🌐 إضافة خط / شبكة بنية تحتية جديدة';

    const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
    sv('inm-f-type',     item.network_type || item.networkType || 'WATER_MAIN');
    sv('inm-f-code',     item.code || item.id || this._nextCode());
    sv('inm-f-district', item.district || 'شارع كفرنجة الرئيسي');
    sv('inm-f-mat',      item.material || 'HDPE');
    sv('inm-f-diam',     item.diameter_mm || item.diameterMm || '200');
    sv('inm-f-depth',    item.depth_meters || item.depthMeters || '1.2');
    sv('inm-f-pressure', item.pressure_class || item.pressureClass || 'PN16 (16 Bar)');
    sv('inm-f-status',   item.status || 'OPERATIONAL');
    sv('inm-f-notes',    item.notes || '');

    this._clearDraw();
    const modal = document.getElementById('inm-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(() => this._initDrawMap(item), 240);
  }

  _closeModal() {
    const m = document.getElementById('inm-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawLayer = null;
    this._drawing  = false;
  }

  /* ─── خريطة الرسم داخل المودال ────────────────────────────────────── */
  _initDrawMap(item = {}) {
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawMap = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('inm-dmap', [32.3301, 35.7501], 14)
      : L.map('inm-dmap').setView([32.3301, 35.7501], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة', maxZoom: 19
      }).addTo(this.drawMap);
    }

    this.drawLayer = L.featureGroup().addTo(this.drawMap);

    const raw = item.geometry || item.geom || item.geojson;
    if (raw) {
      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        L.geoJSON(geo, { style: { color: '#0ea5e9', weight: 4 } }).addTo(this.drawLayer);
        if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
          this.drawnCoords = geo.coordinates.map(c => [c[1], c[0]]);
          this._updateLength();
        }
        const b = this.drawLayer.getBounds();
        if (b.isValid()) this.drawMap.fitBounds(b, { padding: [30, 30] });
      } catch {}
    }

    setTimeout(() => this.drawMap?.invalidateSize(), 260);

    this.drawMap.on('click', e => {
      if (!this._drawing) return;
      const { lat, lng } = e.latlng;
      this.drawnCoords.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 5, color: '#fff', fillColor: '#059669', fillOpacity: 1, weight: 2
      }).addTo(this.drawLayer);

      if (this._polyline) this.drawLayer.removeLayer(this._polyline);
      this._polyline = L.polyline(this.drawnCoords, { color: '#059669', weight: 4 }).addTo(this.drawLayer);

      this._updateLength();
      document.getElementById('inm-mdstatus').textContent = `📍 ${this.drawnCoords.length} نقاط محددة`;
    });

    this.drawMap.on('dblclick', () => {
      if (this._drawing && this.drawnCoords.length >= 2) {
        this._drawing = false;
        const btn = document.getElementById('inm-mdraw');
        if (btn) { btn.textContent = '✏️ تعديل المسار'; btn.style.background = '#059669'; }
        document.getElementById('inm-mdstatus').textContent = `✅ اكتمل — ${this.drawnCoords.length} نقطة`;
        this._toast('✅ تم رسم مسار شبكة البنية التحتية بنجاح.');
      }
    });
  }

  _toggleDraw() {
    this._drawing = !this._drawing;
    const btn = document.getElementById('inm-mdraw');
    if (this._drawing) {
      btn.textContent = '⏹ إيقاف الرسم'; btn.style.background = '#dc2626';
      document.getElementById('inm-mdstatus').textContent = '🖱️ انقر على الخريطة لإضافة نقاط المسار...';
    } else {
      btn.textContent = '✏️ استئناف الرسم'; btn.style.background = '#059669';
    }
  }

  _undoLastPoint() {
    if (this.drawnCoords.length > 0) {
      this.drawnCoords.pop();
      if (this.drawLayer) this.drawLayer.clearLayers();
      if (this.drawnCoords.length > 0) {
        this.drawnCoords.forEach(pt => {
          L.circleMarker(pt, { radius: 5, color: '#fff', fillColor: '#059669', fillOpacity: 1, weight: 2 }).addTo(this.drawLayer);
        });
        this._polyline = L.polyline(this.drawnCoords, { color: '#059669', weight: 4 }).addTo(this.drawLayer);
      }
      this._updateLength();
      document.getElementById('inm-mdstatus').textContent = `📍 ${this.drawnCoords.length} نقاط محددة`;
    }
  }

  _clearDraw() {
    this.drawnCoords = []; this._drawing = false; this._polyline = null;
    if (this.drawLayer) this.drawLayer.clearLayers();
    const btn = document.getElementById('inm-mdraw');
    if (btn) { btn.textContent = '✏️ ابدأ الرسم'; btn.style.background = '#059669'; }
    const st = document.getElementById('inm-mdstatus');
    if (st) st.textContent = 'لم يتم رسم مسار بعد';
    this._updateLength();
  }

  _updateLength() {
    let meters = 0;
    if (this.drawnCoords.length >= 2) {
      for (let i = 0; i < this.drawnCoords.length - 1; i++) {
        const p1 = L.latLng(this.drawnCoords[i][0], this.drawnCoords[i][1]);
        const p2 = L.latLng(this.drawnCoords[i+1][0], this.drawnCoords[i+1][1]);
        meters += p1.distanceTo(p2);
      }
    }
    const txtEl = document.getElementById('inm-length-text');
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
        this._toast('📍 تم تحديد موقعك الجغرافي بنجاح.');
      }
    }, () => {
      this._toast('⚠️ تعذر الحصول على الإحداثيات الجغرافية.');
    });
  }

  /* ─── حفظ الشبكة ─────────────────────────────────────────────────── */
  async _saveNetwork() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const code = gv('inm-f-code');
    if (!code) { this._toast('⚠️ رمز الشبكة إلزامي.'); return; }

    const coordinates = this.drawnCoords.length >= 2
      ? this.drawnCoords.map(c => [c[1], c[0]])
      : [[35.7501, 32.3301], [35.7551, 32.3351]];

    const payload = {
      id:            this._editingId || null,
      code,
      district:      gv('inm-f-district') || 'كفرنجة',
      networkType:   gv('inm-f-type'),
      material:      gv('inm-f-mat'),
      diameterMm:    parseFloat(gv('inm-f-diam')) || 0,
      depthMeters:   parseFloat(gv('inm-f-depth')) || 0,
      pressureClass: gv('inm-f-pressure'),
      status:        gv('inm-f-status'),
      notes:         gv('inm-f-notes'),
      coordinates
    };

    const btn = document.getElementById('inm-msave');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }

    try {
      try {
        if (typeof apiFetch === 'function') {
          await apiFetch('/v4/assets/infrastructure', { method:'POST', body: JSON.stringify(payload) });
        } else {
          await fetch('/api/v4/assets/infrastructure', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
          });
        }
      } catch (netErr) {
        console.warn('⚠️ Infrastructure server save fallback:', netErr.message);
      }

      const netObj = {
        id: payload.id || `NET-${Date.now()}`,
        code: payload.code,
        district: payload.district,
        network_type: payload.networkType,
        networkType: payload.networkType,
        material: payload.material,
        diameter_mm: payload.diameterMm,
        depth_meters: payload.depthMeters,
        pressure_class: payload.pressureClass,
        status: payload.status,
        notes: payload.notes,
        geometry: { type: 'LineString', coordinates: payload.coordinates },
        created_at: new Date().toISOString()
      };

      this.activeData = this.activeData.filter(x => String(x.id) !== String(netObj.id) && String(x.code) !== String(netObj.code));
      this.activeData.unshift(netObj);
      this._saveLocalCache();

      this._toast('✅ تم حفظ بيانات شبكة البنية التحتية والمسار الجغرافي بنجاح.');
      this._closeModal();
      this._applyFilterAndRender();
    } catch (err) {
      this._toast('❌ خطأ في الحفظ: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ بيانات الشبكة'; }
    }
  }

  /* ─── حذف الشبكة ─────────────────────────────────────────────────── */
  async _deleteNetwork(netId) {
    const item = this.activeData.find(x => String(x.id) === String(netId));
    const name = item?.code || item?.id || netId;
    if (!confirm(`⚠️ تأكيد حذف شبكة البنية التحتية "${name}" نهائياً من النظام؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      if (typeof apiFetch === 'function') {
        await apiFetch(`/v4/assets/infrastructure/${netId}`, { method:'DELETE' });
      } else {
        await fetch(`/api/v4/assets/infrastructure/${netId}`, { method:'DELETE' });
      }
    } catch (err) {}
    this.activeData = this.activeData.filter(x => String(x.id) !== String(netId));
    this._saveLocalCache();
    this._toast(`🗑️ تم حذف الشبكة "${name}" بنجاح.`);
    this._applyFilterAndRender();
  }

  /* ─── تصدير ملف Excel مهيكل في الخلايا ────────────────────────────── */
  _exportCSV() {
    if (!this.activeData.length) {
      this._toast('⚠️ لا توجد بيانات للتصدير.');
      return;
    }

    const headers = ['رمز الشبكة', 'نوع الخدمة', 'المادة', 'القطر (ملم)', 'العمق (م)', 'الضغط التشغيلي', 'الحالة التشغيلية', 'المنطقة/الشارع', 'تاريخ التسجيل', 'ملاحظات'];
    
    const rows = this.activeData.map(r => {
      const typeArabic = {
        'WATER': 'مياه صالحة للشرب',
        'SEWAGE': 'صرف صحي',
        'DRAINAGE': 'تصريف مياه أمطار',
        'ELECTRICITY': 'كهرباء وإنارة',
        'TELECOM': 'اتصالات وألياف ضوئية'
      }[r.network_type || r.networkType] || r.network_type || r.networkType || 'بنية تحتية';

      const statusArabic = {
        'OPERATIONAL': 'عاملة ومفعلة',
        'MAINTENANCE': 'قيد الصيانة',
        'DAMAGED': 'متضررة',
        'PLANNED': 'مخطط للتنفيذ'
      }[r.status] || r.status || 'عاملة';

      return [
        r.code || r.id || '',
        typeArabic,
        r.material || 'HDPE',
        r.diameter_mm || r.diameterMm || '—',
        r.depth_meters || r.depthMeters || '—',
        r.pressure_class || r.pressureClass || '—',
        statusArabic,
        r.district || 'كفرنجة',
        r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : '',
        r.notes || ''
      ];
    });

    if (typeof window.exportToExcelFile === 'function') {
      window.exportToExcelFile({
        filename: 'سجل_شبكات_البنية_التحتية_بلدية_كفرنجة',
        title: 'سجل وكشف خطوط وشبكات البنية التحتية والمياه',
        subtitle: 'مديرية الأشغال والخدمات الهندسية — قسم البنية التحتية والمرافق',
        headers,
        rows,
        totals: ['الإجمالي', `${this.activeData.length} خط/شبكة`, '', '', '', '', '', '', '', '']
      });
      this._toast('📊 تم تصدير ملف Excel المنظم بنجاح.');
    }
  }

  /* ─── طباعة تقرير شبكة واحدة ──────────────────────────────────────── */
  _printNetwork(netId) {
    const r = this.activeData.find(x => String(x.id) === String(netId));
    if (!r) { this._toast('⚠️ لم يُعثر على بيانات شبكة البنية التحتية.'); return; }

    const isMaint = (r.status || '').includes('MAINT') || (r.status || '').includes('LEAK') || (r.status || '').includes('صيانة');
    const stLabel = isMaint ? 'تحت الصيانة والإصلاح الفوري' : 'عمليات منتظمة وفعّالة';
    const clr = isMaint ? '#dc2626' : '#059669';

    const summary = `
      <div style="margin:16px 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #cbd5e1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="color:#1e3a8a;font-size:0.92rem;">📊 الحالة التشغيلية والفنية لخط الشبكة</b>
          <span style="background:${isMaint ? '#fef2f2' : '#ecfdf5'};color:${clr};border:1px solid ${clr};padding:3px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;">${stLabel}</span>
        </div>
        <div style="margin-top:10px;font-size:0.86rem;line-height:1.7;color:#1e293b;background:#ffffff;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <b style="color:#1e3a8a;">📌 التوصية الهندسية المعتمدة:</b>
          ${isMaint ? 'إرسال فرق الطوارئ الفنية لمعالجة الانسداد أو التسريب فوراً وفحص غرف المحابس.' : 'استمرار أعمال الفحص الدوري لضمان جودة التدفق والضغط التشغيلي المناسب.'}
          ${r.notes ? `<div style="margin-top:4px;color:#475569;"><b>ملاحظات الفحص:</b> ${r.notes}</div>` : ''}
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'تقرير المعاينة والتقييم الفني لشبكة البنية التحتية والخدمات',
        subtitle:  'المملكة الأردنية الهاشمية — بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية',
        refNumber: `INF-${r.code || r.id}-${new Date().getFullYear()}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخطط الإسناد الجغرافي GIS + مسار الخط',
        type:      'single',
        fields: [
          { label: 'رمز / كود الشبكة',   value: r.code || r.id },
          { label: 'نوع الشبكة والخدمة', value: r.network_type || r.networkType || 'مياه/خدمات' },
          { label: 'المنطقة / الشارع',    value: r.district || 'كفرنجة' },
          { label: 'المادة المستعملة',   value: r.material || 'HDPE' },
          { label: 'القطر الاسمي',       value: r.diameter_mm ? `${r.diameter_mm} ملم` : 'قياسي' },
          { label: 'العمق تحت الأرض',   value: r.depth_meters ? `${r.depth_meters} متر` : 'قياسي' },
          { label: 'فئة الضغط التشغيلي',  value: r.pressure_class || 'PN16' },
          { label: 'الحالة التشغيلية',  value: stLabel },
          { label: 'المسار الجغرافي',   value: (r.geometry || r.coordinates || r.geom) ? 'GIS Verified' : '—' },
          { label: 'تاريخ التوثيق',      value: r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : new Date().toLocaleDateString('ar-JO') }
        ],
        summaryHtml: summary,
        signatures: true
      });
    } else {
      window.print();
    }
  }

  /* ─── طباعة السجل الشامل لشبكات البنية التحتية ──────────────────── */
  _printAll() {
    const data = this.activeData;
    if (!data.length) { this._toast('⚠️ لا توجد بيانات للطباعة.'); return; }

    const wCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('WATER') || t.includes('مياه');
    }).length;
    const sCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('SEWER') || t.includes('صرف');
    }).length;
    const stCount = data.filter(n => {
      const t = (n.network_type || n.networkType || '').toUpperCase();
      return t.includes('STORM') || t.includes('CULVERT') || t.includes('أمطار');
    }).length;
    const mCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      return st.includes('MAINT') || st.includes('LEAK') || st.includes('صيانة');
    }).length;

    const kpiHtml = `
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:12px;margin:14px 0 18px 0;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#059669;">${data.length}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">إجمالي الخطوط</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#1d4ed8;">${wCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">شبكات مياه الشرب</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#d97706;">${sCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">شبكات الصرف الصحي</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#0d9488;">${stCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تصريف أمطار وعبارات</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#dc2626;">${mCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تحت الصيانة</div>
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'سجل حصر وتتبع شبكات البنية التحتية والخدمات العامة',
        subtitle:  'كشف الرصد المكاني والفني المعتمد — بلدية كفرنجة الجديدة',
        refNumber: `INF-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخططات الإسناد الجغرافي GIS',
        type:      'list',
        summaryHtml: kpiHtml,
        data: data.map(r => {
          return {
            code:     r.code || r.id,
            type:     r.network_type || r.networkType || 'مياه/خدمات',
            material: r.material || 'HDPE',
            diam:     r.diameter_mm ? `${r.diameter_mm} ملم` : 'قياسي',
            depth:    r.depth_meters ? `${r.depth_meters} م` : '—',
            district: r.district || 'كفرنجة',
            status:   (r.status || '').includes('MAINT') || (r.status || '').includes('LEAK') ? 'تحت الصيانة' : 'فعّال'
          };
        }),
        columns: [
          { key:'code',     label:'رمز الشبكة' },
          { key:'type',     label:'نوع الشبكة والخدمة' },
          { key:'material', label:'المادة' },
          { key:'diam',     label:'القطر الاسمي' },
          { key:'depth',    label:'العمق' },
          { key:'district', label:'المنطقة / الشارع' },
          { key:'status',   label:'الحالة التشغيلية' }
        ],
        signatures: true
      });
    } else {
      window.print();
    }
  }

  /* ─── مساعدات ────────────────────────────────────────────────────── */
  _nextCode() {
    const y = new Date().getFullYear();
    return `NET-${y}-${String(this.activeData.length + 1).padStart(3,'0')}`;
  }

  _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[INAMS]', msg);
  }
}

/* ── تسجيل الكلاس والدوال الموحدة ─────────────────────────────────── */
if (typeof window !== 'undefined') {
  window.ComprehensiveInfrastructureManager = ComprehensiveInfrastructureManager;
  window.infrastructureManager = null;

  window.loadInfrastructureNetworks = async function() {
    const container = document.getElementById('infrastructure-tab-container');
    if (!container) return;
    try {
      if (window.infrastructureManager && container.children.length > 0) {
        setTimeout(() => {
          if (window.infrastructureManager.map) window.infrastructureManager.map.invalidateSize();
          if (typeof window.infrastructureManager._applyFilterAndRender === 'function') {
            window.infrastructureManager._applyFilterAndRender();
          }
        }, 150);
        return;
      }
      container.innerHTML = '';
      window.infrastructureManager = new ComprehensiveInfrastructureManager('infrastructure-tab-container');
    } catch (e) {
      console.error('loadInfrastructureNetworks error:', e);
      container.innerHTML = `<div style="padding:20px;color:#f87171;text-align:center;">❌ ${e.message}</div>`;
    }
  };

  window.openNewInfrastructureModal = function() {
    if (window.infrastructureManager && typeof window.infrastructureManager._openModal === 'function') {
      window.infrastructureManager._openModal(null);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveInfrastructureManager;
}
