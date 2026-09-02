/**
 * Unified Energy, Lighting & Renewable Energy Manager v4.5 (Enterprise Edition)
 * وحدة إدارة الطاقة والإنارة والطاقة المتجددة المعتمدة - بلدية كفرنجة الجديدة
 * مديرية الأشغال والخدمات الهندسية — قسم شبكات الإنارة والطاقة والتحكم الذكي
 * ─────────────────────────────────────────────────────────────────────────────
 * تغطية شاملة لوحدات إنارة الشوارع LED، الأعمدة والأبراج، المحولات ولوحات التغذية،
 * العدادات الذكية، الحقول الشمسية، وأنظمة الطاقة الشمسية لأسطح المباني البلدية.
 */
'use strict';

class ComprehensiveEnergyLightingManager {

  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map          = null;
    this.drawMap      = null;
    this.drawLayer    = null;
    this.drawnCoords  = [];
    this.assetsLayer  = null;
    this.activeData   = [];
    this._editingId   = null;
    this._marker      = null;
    this._filterType  = 'ALL';
    this._sortField   = 'id';
    this._sortAsc     = false;

    this._readUser();
    this._loadLocalCache();
    this._buildUI();
  }

  /* ─── التخزين المحلي والنسخ الاحتياطي المستمر ────────────────────────── */
  _loadLocalCache() {
    try {
      const stored = localStorage.getItem('emams_energy_assets_v4');
      if (stored) {
        this.activeData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[EMAMS] Cache load error:', e);
    }
    if (!Array.isArray(this.activeData)) {
      this.activeData = [];
    }
  }

  _saveLocalCache() {
    try {
      localStorage.setItem('emams_energy_assets_v4', JSON.stringify(this.activeData));
    } catch (e) {
      console.warn('[EMAMS] Cache save error:', e);
    }
  }

  /* ─── صلاحيات المستخدم ─────────────────────────────────────────────── */
  _readUser() {
    try {
      const raw = sessionStorage.getItem('engineeringUser');
      this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
    } catch { this._user = null; }
    const role = (this._user?.role || '').toLowerCase();
    if (typeof window.hasPermission === 'function' && (window.hasPermission('ENERGY.CREATE') || window.hasPermission('ASSETS.CREATE') || window.hasPermission('*'))) {
      this.canWrite = true;
    } else {
      this.canWrite = !role || ['admin', 'director_public_works', 'head_of_electricity_energy', 'electrical_engineer', 'renewable_energy_engineer', 'electrical_technician', 'electrical_works_inspector', 'head_of_roads', 'roads_engineer'].includes(role);
    }
    this.isAdmin = !role || ['admin', 'director_public_works', 'head_of_electricity_energy'].includes(role);
    this.canApprove = !role || ['admin', 'director_public_works', 'head_of_electricity_energy'].includes(role);
    this.canMaintain = !role || ['admin', 'director_public_works', 'head_of_electricity_energy', 'electrical_engineer', 'renewable_energy_engineer', 'electrical_technician', 'electrical_works_inspector'].includes(role);
  }

  /* ─── بناء الواجهة الرئيسية ─────────────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <div id="elm-root" style="background:var(--bg-card,#0f172a);color:var(--text,#f8fafc);padding:18px;
            border-radius:12px;direction:rtl;font-family:'Tajawal',system-ui,sans-serif;">

        <!-- شريط الأدوات والتحكم العلوي -->
        <div style="display:flex;justify-content:space-between;align-items:center;
              flex-wrap:wrap;gap:12px;background:var(--bg-surface,#1e293b);padding:14px 18px;
              border-radius:10px;border:1px solid var(--border,#334155);margin-bottom:16px;">
          
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-weight:800;color:#38bdf8;font-size:0.92rem;display:flex;align-items:center;gap:6px;">
              ⚡ منظومة إدارة الطاقة والإنارة والطاقة المتجددة (EMAMS v4.5)
            </span>
            ${this.canWrite ? `<button id="elm-add" class="elm-btn-action" style="background:#059669;color:#fff;">⚡/☀️ إضافة أصل طاقة / إنارة</button>` : ''}
            <button id="elm-print-all" class="elm-btn-action" style="background:#7c3aed;color:#fff;">🖨️ طباعة السجل الرسمي</button>
            <button id="elm-export-csv" class="elm-btn-action" style="background:#0284c7;color:#fff;">📊 تصدير Excel / CSV</button>
            <button id="elm-refresh" class="elm-btn-action" style="background:#475569;color:#fff;" title="تحديث ومزامنة">🔄 تحديث</button>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- فلاتر النوع السريعة -->
            <div style="display:flex;background:#090d16;padding:3px;border-radius:8px;border:1px solid var(--border,#334155);flex-wrap:wrap;gap:2px;">
              <button id="elm-filter-all" class="elm-fbtn active" data-type="ALL">الكل</button>
              <button id="elm-filter-lighting" class="elm-fbtn" data-type="LIGHTING">💡 إنارة شوارع</button>
              <button id="elm-filter-trans" class="elm-fbtn" data-type="TRANSFORMER">🔌 محولات ولوحات</button>
              <button id="elm-filter-meter" class="elm-fbtn" data-type="METER">⚡ عدادات كهرباء</button>
              <button id="elm-filter-solar" class="elm-fbtn" data-type="SOLAR">☀️ حقول شمسية</button>
              <button id="elm-filter-bldg" class="elm-fbtn" data-type="BUILDING_ENERGY">🏢 طاقة المباني</button>
              <button id="elm-filter-maint" class="elm-fbtn" data-type="MAINT" style="color:#f87171;">⚠️ أعطال وصيانة</button>
            </div>

            <!-- حقل البحث الفوري الذكي -->
            <input id="elm-search" type="text" placeholder="🔍 بحث بالرمز، الاسم، الشارع، أو القدرة..."
              style="background:var(--input-bg,#0f172a);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,#334155);
                     padding:8px 14px;border-radius:8px;font-size:0.82rem;width:230px;outline:none;" />
          </div>
        </div>

        <!-- بطاقات المؤشرات الإحصائية والفنية (KPIs) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">إجمالي أصول الطاقة والإنارة</div>
            <div id="elm-kpi-total" style="font-size:1.6rem;font-weight:800;color:#38bdf8;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">💡 أعمدة ووحدات إنارة الشوارع</div>
            <div id="elm-kpi-lighting" style="font-size:1.6rem;font-weight:800;color:#eab308;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🔌 المحولات ولوحات التوزيع</div>
            <div id="elm-kpi-trans" style="font-size:1.6rem;font-weight:800;color:#f97316;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">☀️ حقول شمسية وطاقة متجددة</div>
            <div id="elm-kpi-solar" style="font-size:1.6rem;font-weight:800;color:#10b981;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">⚠️ أصول تحت الصيانة / أعطال</div>
            <div id="elm-kpi-maint" style="font-size:1.6rem;font-weight:800;color:#ef4444;margin-top:2px;">0</div>
          </div>
        </div>

        <!-- الخريطة التفاعلية -->
        <div style="margin-bottom:16px;background:var(--table-header-bg,#1e293b);padding:8px;border-radius:10px;
                    border:1px solid var(--border,#334155);position:relative;">
          <div id="elm-map" style="width:100%;height:390px;border-radius:8px;background:#0f172a;"></div>
          <div style="position:absolute;top:16px;left:16px;background:rgba(15,23,42,0.92);
                      padding:9px 14px;border-radius:8px;border:1px solid var(--border,#334155);
                      font-size:0.74rem;z-index:400;line-height:1.9;backdrop-filter:blur(4px);">
            <div style="font-weight:bold;color:#94a3b8;margin-bottom:2px;">تصنيف أصول الطاقة والإنارة:</div>
            <div style="color:#facc15;">🟡 وحدات وأعمدة إنارة الشوارع</div>
            <div style="color:#fb923c;">🟠 المحولات ولوحات التوزيع والتغذية</div>
            <div style="color:#22d3ee;">🔵 عدادات الكهرباء الذكية والبلدية</div>
            <div style="color:#34d399;">🟢 الحقول الشمسية والطاقة المتجددة</div>
            <div style="color:#c084fc;">🟣 انفرترات وطاقة المباني البلدية</div>
          </div>
        </div>

        <!-- الجدول المفصل مع ترتيب الأعمدة -->
        <div style="background:var(--bg-surface,#1e293b);border-radius:10px;border:1px solid var(--border,#334155);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:0.98rem;font-weight:800;color:#38bdf8;display:flex;align-items:center;gap:6px;">
              📋 سجل جرد وتتبع أصول الطاقة والإنارة والطاقة المتجددة
            </h3>
            <span id="elm-badge"
              style="background:rgba(30,58,138,.6);color:#93c5fd;font-size:0.82rem;
                     padding:4px 14px;border-radius:6px;font-weight:bold;border:1px solid #1e3a8a;">إجمالي المعروض: 0</span>
          </div>

          <div style="overflow-x:auto;">
            <table id="elm-table" style="width:100%;text-align:right;font-size:0.8rem;
                                         border-collapse:collapse;min-width:940px;">
              <thead style="background:var(--table-header-bg,#0f172a);color:var(--text-muted,#94a3b8);border-bottom:2px solid var(--border,#334155);">
                <tr>
                  <th class="elm-sortable" data-sort="id" style="padding:11px 10px;cursor:pointer;">رمز الأصل ⬍</th>
                  <th class="elm-sortable" data-sort="type" style="padding:11px 10px;cursor:pointer;">نوع الأصل / الخدمة ⬍</th>
                  <th class="elm-sortable" data-sort="name" style="padding:11px 10px;cursor:pointer;">اسم الأصل / المواصفات ⬍</th>
                  <th class="elm-sortable" data-sort="district" style="padding:11px 10px;cursor:pointer;">المنطقة / الشارع ⬍</th>
                  <th class="elm-sortable" data-sort="capacity" style="padding:11px 10px;cursor:pointer;">القدرة / الطاقة ⬍</th>
                  <th style="padding:11px 10px;">الفولتية والضغط</th>
                  <th class="elm-sortable" data-sort="status" style="padding:11px 10px;cursor:pointer;">الحالة التشغيلية ⬍</th>
                  <th style="padding:11px 10px;">الموقع المكاني (GIS)</th>
                  <th class="elm-sortable" data-sort="date" style="padding:11px 10px;cursor:pointer;">تاريخ التسجيل ⬍</th>
                  <th style="padding:11px 10px;text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="elm-tbody">
                <tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted,#94a3b8);">
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
      this._fetchAssets();
      this._bindAll();
    }, 80);
  }

  _injectStyles() {
    if (document.getElementById('elm-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'elm-custom-styles';
    style.textContent = `
      .elm-btn-action {
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
      .elm-btn-action:hover { opacity: 0.9; transform: translateY(-1px); }
      .elm-fbtn {
        background: transparent;
        color: #94a3b8;
        border: none;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 0.77rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .elm-fbtn.active {
        background: #2563eb !important;
        color: #fff !important;
        font-weight: bold;
      }
      .elm-sortable:hover { color: #38bdf8; }
    `;
    document.head.appendChild(style);
  }

  /* ─── الخريطة الرئيسية ──────────────────────────────────────────────── */
  _initMap() {
    const el = document.getElementById('elm-map');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      try { this.map.remove(); } catch {}
      this.map = null;
    }

    this.map = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('elm-map', [32.2985, 35.7050], 14)
      : L.map('elm-map').setView([32.2985, 35.7050], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة | OSM', maxZoom: 19
      }).addTo(this.map);
    }

    this.assetsLayer = L.layerGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 350);
  }

  /* ─── تحميل ومزامنة أصول الطاقة من قاعدة البيانات ──────────────────── */
  async _fetchAssets() {
    try {
      let res;
      if (typeof apiFetch === 'function') {
        res = await apiFetch('/v4/assets/energy', { silent: true });
      } else {
        const r = await fetch('/api/v4/assets/energy');
        res = await r.json();
      }
      if (res && Array.isArray(res.data)) {
        this.activeData = res.data;
        this._saveLocalCache();
      }
    } catch (e) {
      console.warn('[EMAMS] fetchAssets error:', e.message);
    }
    this._applyFilterAndRender();
  }

  /* ─── تطبيق التصفية والترتيب وعرض الجدول ────────────────────────────── */
  _applyFilterAndRender() {
    let data = [...this.activeData];
    const ft = this._filterType;

    if (ft === 'LIGHTING') {
      data = data.filter(n => {
        const t = (n.asset_type || n.assetType || '').toUpperCase();
        return t.includes('LIGHT') || t.includes('POLE') || t.includes('MAST') || t.includes('إنارة') || t.includes('عمود');
      });
    } else if (ft === 'TRANSFORMER') {
      data = data.filter(n => {
        const t = (n.asset_type || n.assetType || '').toUpperCase();
        return t.includes('TRANS') || t.includes('FEEDER') || t.includes('PANEL') || t.includes('محول') || t.includes('لوحة');
      });
    } else if (ft === 'METER') {
      data = data.filter(n => {
        const t = (n.asset_type || n.assetType || '').toUpperCase();
        return t.includes('METER') || t.includes('عداد');
      });
    } else if (ft === 'SOLAR') {
      data = data.filter(n => {
        const t = (n.asset_type || n.assetType || '').toUpperCase();
        return t.includes('SOLAR') || t.includes('FARM') || t.includes('PV') || t.includes('شمسي') || t.includes('طاقة متجددة');
      });
    } else if (ft === 'BUILDING_ENERGY') {
      data = data.filter(n => {
        const t = (n.asset_type || n.assetType || '').toUpperCase();
        return t.includes('INVERTER') || t.includes('BUILDING') || t.includes('مبنى') || t.includes('انفرتر');
      });
    } else if (ft === 'MAINT') {
      data = data.filter(n => {
        const st = (n.status || '').toUpperCase();
        return st.includes('MAINT') || st.includes('FAIL') || st.includes('عطل') || st.includes('صيانة');
      });
    }

    const q = document.getElementById('elm-search')?.value?.trim()?.toLowerCase() || '';
    if (q) {
      data = data.filter(n =>
        (n.id || '').toLowerCase().includes(q) ||
        (n.code || '').toLowerCase().includes(q) ||
        (n.name || '').toLowerCase().includes(q) ||
        (n.district || '').toLowerCase().includes(q) ||
        (n.asset_type || n.assetType || '').toLowerCase().includes(q) ||
        (n.capacity || '').toLowerCase().includes(q) ||
        (n.notes || '').toLowerCase().includes(q)
      );
    }

    /* الترتيب */
    data.sort((a, b) => {
      let valA, valB;
      if (this._sortField === 'id') {
        valA = a.id || a.code || ''; valB = b.id || b.code || '';
      } else if (this._sortField === 'type') {
        valA = a.asset_type || a.assetType || ''; valB = b.asset_type || b.assetType || '';
      } else if (this._sortField === 'name') {
        valA = a.name || ''; valB = b.name || '';
      } else if (this._sortField === 'district') {
        valA = a.district || ''; valB = b.district || '';
      } else if (this._sortField === 'capacity') {
        valA = parseFloat(a.wattage || a.capacity || 0);
        valB = parseFloat(b.wattage || b.capacity || 0);
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
    this._renderMapAssets(data);
  }

  _updateKPIs(data) {
    const total = data.length;
    const lCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('LIGHT') || t.includes('POLE') || t.includes('MAST') || t.includes('إنارة') || t.includes('عمود');
    }).length;
    const tCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('TRANS') || t.includes('FEEDER') || t.includes('PANEL') || t.includes('محول') || t.includes('لوحة');
    }).length;
    const sCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('SOLAR') || t.includes('FARM') || t.includes('PV') || t.includes('INVERTER') || t.includes('شمسي');
    }).length;
    const mCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      return st.includes('MAINT') || st.includes('FAIL') || st.includes('عطل') || st.includes('صيانة');
    }).length;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('elm-kpi-total', total);
    setEl('elm-kpi-lighting', lCount);
    setEl('elm-kpi-trans', tCount);
    setEl('elm-kpi-solar', sCount);
    setEl('elm-kpi-maint', mCount);
  }

  /* ─── عرض الجدول ────────────────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('elm-tbody');
    const badge = document.getElementById('elm-badge');
    if (!tbody) return;
    if (badge) badge.textContent = `إجمالي المعروض: ${data.length}`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="10"
        style="text-align:center;padding:36px;color:var(--text-muted,#94a3b8);">
        <div style="font-size:2.2rem;margin-bottom:8px;">📭</div>
        لا توجد أصول طاقة أو إنارة مسجلة تطابق التصفية الحالية.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const typeStr = (r.asset_type || r.assetType || 'LED_STREETLIGHT').toUpperCase();
      let typeLabel = '💡 وحدة إنارة LED';
      let typeColor = '#eab308';

      if (typeStr.includes('POLE') || typeStr.includes('عمود')) { typeLabel = '💡 عمود إنارة شوارع'; typeColor = '#facc15'; }
      else if (typeStr.includes('HIGH_MAST') || typeStr.includes('برج')) { typeLabel = '💡 برج إنارة مرتفع High Mast'; typeColor = '#eab308'; }
      else if (typeStr.includes('TRANS') || typeStr.includes('محول')) { typeLabel = '🔌 محول كهربائي فرعي/رئيسي'; typeColor = '#f97316'; }
      else if (typeStr.includes('FEEDER') || typeStr.includes('لوحة')) { typeLabel = '🔌 لوحة تغذية وتوزيع إنارة'; typeColor = '#fb923c'; }
      else if (typeStr.includes('METER') || typeStr.includes('عداد')) { typeLabel = '⚡ عداد كهرباء ذكي/بلدي'; typeColor = '#06b6d4'; }
      else if (typeStr.includes('SOLAR_FARM') || typeStr.includes('حقل')) { typeLabel = '☀️ حقل شمسي أرضي Solar Farm'; typeColor = '#10b981'; }
      else if (typeStr.includes('ROOFTOP') || typeStr.includes('سطح')) { typeLabel = '☀️ نظام طاقة شمسية أسطح'; typeColor = '#34d399'; }
      else if (typeStr.includes('INVERTER') || typeStr.includes('انفرتر')) { typeLabel = '🏢 انفرتر وطاقة مبنى بلدي'; typeColor = '#a855f7'; }

      const status = r.status || 'OPERATIONAL';
      const isMaint = status.includes('MAINT') || status.includes('FAIL') || status.includes('صيانة') || status.includes('عطل');
      const stColor = isMaint ? '#ef4444' : '#10b981';
      const stBg    = isMaint ? '#7f1d1d' : '#065f46';
      const stText  = isMaint ? 'تحت الصيانة / عطل' : 'عمليات منتظمة (فعّال)';

      const cap   = r.capacity || (r.wattage ? `${r.wattage}W` : 'قياسي');
      const volt  = r.voltage || '220V (Single Phase)';
      const createdDate = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : '—';

      return `
        <tr data-aid="${r.id}" style="border-bottom:1px solid #1e293b;transition:background 0.15s;" onmouseover="this.style.background='rgba(51,65,85,0.3)'" onmouseout="this.style.background='transparent'">
          <td style="padding:10px 8px;font-weight:bold;color:#38bdf8;font-family:monospace;">${r.id}</td>
          <td style="padding:10px 8px;">
            <span style="background:var(--bg-surface,#1e293b);color:${typeColor};border:1px solid ${typeColor};padding:3px 8px;border-radius:5px;font-size:0.75rem;font-weight:bold;">
              ${typeLabel}
            </span>
          </td>
          <td style="padding:10px 8px;font-weight:bold;color:#f8fafc;">${r.name || '—'}</td>
          <td style="padding:10px 8px;color:#cbd5e1;">${r.district || 'كفرنجة'}</td>
          <td style="padding:10px 8px;font-weight:bold;color:#38bdf8;">${cap}</td>
          <td style="padding:10px 8px;font-size:0.76rem;color:#cbd5e1;">${volt}</td>
          <td style="padding:10px 8px;">
            <span style="background:${stBg};color:${stColor};padding:2px 8px;border-radius:4px;font-weight:bold;font-size:0.73rem;">
              ${stText}
            </span>
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#38bdf8;">
            ${(r.lat && r.lng) ? '📍 متصل ونشط بالـ GIS' : 'غير محدد'}
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#94a3b8;">${createdDate}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
              <button class="elm-row-view" data-id="${r.id}"
                style="background:#475569;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="معاينة الموقع على الخريطة">👁️</button>
              ${this.canWrite ? `<button class="elm-row-edit" data-id="${r.id}"
                style="background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="تعديل">✏️</button>` : ''}
              <button class="elm-row-print" data-id="${r.id}"
                style="background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="طباعة التقرير الفني">🖨️</button>
              ${this.isAdmin ? `<button class="elm-row-del" data-id="${r.id}"
                style="background:#dc2626;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="حذف">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    this._bindTableRows();
  }

  /* ─── ربط أحداث الصفوف بالتفويض ────────────────────────────────────── */
  _bindTableRows() {
    const tbody = document.getElementById('elm-tbody');
    if (!tbody) return;

    if (this._tbodyHandler) tbody.removeEventListener('click', this._tbodyHandler);

    this._tbodyHandler = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains('elm-row-view'))  this._previewOnMap(id);
      if (btn.classList.contains('elm-row-edit'))  this._openModal(id);
      if (btn.classList.contains('elm-row-print')) this._printAsset(id);
      if (btn.classList.contains('elm-row-del'))   this._deleteAsset(id);
    };
    tbody.addEventListener('click', this._tbodyHandler);
  }

  /* ─── ربط شريط الأدوات والبحث والفلترة ─────────────────────────────── */
  _bindAll() {
    document.getElementById('elm-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('elm-print-all')?.addEventListener('click', () => this._printAll());
    document.getElementById('elm-export-csv')?.addEventListener('click', () => this._exportCSV());
    document.getElementById('elm-refresh')?.addEventListener('click', () => {
      this._toast('🔄 جاري تحديث البيانات من الخادم...');
      this._fetchAssets();
    });

    document.getElementById('elm-search')?.addEventListener('input', () => this._applyFilterAndRender());

    /* فلاتر الأزرار */
    document.querySelectorAll('.elm-fbtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.elm-fbtn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._filterType = e.target.dataset.type || 'ALL';
        this._applyFilterAndRender();
      });
    });

    /* ترتيب الأعمدة عند النقر على العناوين */
    document.querySelectorAll('.elm-sortable').forEach(th => {
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

  /* ─── الخريطة الرئيسية: عرض الأصول ─────────────────────────────────── */
  _renderMapAssets(data) {
    if (!this.assetsLayer) return;
    this.assetsLayer.clearLayers();
    const bounds = L.latLngBounds();

    data.forEach(r => {
      let lat = parseFloat(r.lat || r.latitude || 0);
      let lng = parseFloat(r.lng || r.longitude || 0);

      if (!lat || !lng) {
        const raw = r.geojson || r.geom;
        if (raw) {
          try {
            const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (geo.type === 'Point' && geo.coordinates) {
              lng = geo.coordinates[0];
              lat = geo.coordinates[1];
            }
          } catch {}
        }
      }

      if (!lat || !lng) return;

      const typeStr = (r.asset_type || r.assetType || 'LED_STREETLIGHT').toUpperCase();
      let color = '#eab308';
      if (typeStr.includes('TRANS') || typeStr.includes('FEEDER')) color = '#f97316';
      else if (typeStr.includes('METER')) color = '#06b6d4';
      else if (typeStr.includes('SOLAR') || typeStr.includes('PV')) color = '#10b981';
      else if (typeStr.includes('INVERTER') || typeStr.includes('BUILDING')) color = '#a855f7';

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9
      });

      marker.bindPopup(this._mapPopup(r, color));
      this.assetsLayer.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    if (bounds.isValid() && this.map) this.map.fitBounds(bounds, { padding: [30, 30] });
  }

  _mapPopup(r, color) {
    const isMaint = (r.status || '').includes('MAINT') || (r.status || '').includes('FAIL') || (r.status || '').includes('عطل');
    return `
      <div style="direction:rtl; text-align:right; font-family:'Tajawal',sans-serif; min-width:210px; padding:4px;">
        <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">رمز الأصل: ${r.id}</div>
        <div style="font-size:0.8rem; color:${color}; font-weight:bold; margin-bottom:2px;">${r.name || r.asset_type}</div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">المنطقة: <b>${r.district || 'كفرنجة'}</b></div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:4px;">القدرة/الجهد: <b>${r.capacity || 'قياسي'} | ${r.voltage || '220V'}</b></div>
        <div style="margin:6px 0; font-size:0.82rem; font-weight:bold; background:${isMaint ? '#fef2f2' : '#f0fdf4'}; color:${isMaint ? '#dc2626' : '#15803d'}; padding:3px 6px; border-radius:4px; border:1px solid #e2e8f0;">
          الحالة: ${isMaint ? '⚠️ قيد الصيانة والإصلاح' : '🟢 فعّال ومنتظم'}
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="if(window.energyLightingManager) window.energyLightingManager._printAsset('${r.id}')" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🖨️ طباعة</button>
          ${this.canWrite ? `<button onclick="if(window.energyLightingManager) window.energyLightingManager._openModal('${r.id}')" style="flex:1;background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">✏️ تعديل</button>` : ''}
        </div>
      </div>`;
  }

  /* ─── معاينة أصل على الخريطة ───────────────────────────────────────── */
  _previewOnMap(assetId) {
    const r = this.activeData.find(x => String(x.id) === String(assetId));
    if (!r) return;
    let lat = parseFloat(r.lat || r.latitude || 0);
    let lng = parseFloat(r.lng || r.longitude || 0);
    if (!lat || !lng) {
      this._toast('⚠️ لم يُحدد موقع مكاني دقيق لهذا الأصل.');
      return;
    }
    if (this.map) {
      this.map.setView([lat, lng], 16, { animate: true });
      this._toast(`📍 تم تحديد موقع: ${r.name || r.id}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     مودال الإضافة / التعديل لأصل الطاقة والإنارة
  ═══════════════════════════════════════════════════════════════════ */
  _buildModal() {
    document.getElementById('elm-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'elm-modal';
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
          <h3 id="elm-mtitle" style="margin:0;font-size:1rem;font-weight:800;color:#38bdf8;">
            ⚡ إضافة أصل طاقة / إنارة / حقل شمسي جديد
          </h3>
          <button id="elm-mclose"
            style="background:#475569;border:none;color:#fff;width:32px;height:32px;
                   border-radius:50%;cursor:pointer;font-size:1rem;font-weight:bold;">✕</button>
        </div>

        <!-- محتوى العمودين -->
        <div style="display:grid;grid-template-columns:1.05fr 0.95fr;">

          <!-- النموذج -->
          <div id="elm-mform" style="padding:18px;display:flex;flex-direction:column;gap:10px;
                border-left:1px solid var(--border,#334155);">
            ${this._formHTML()}
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;
                        padding-top:14px;border-top:1px solid var(--border,#334155);">
              <button id="elm-mcancel"
                style="padding:8px 18px;background:#475569;color:#fff;border:none;
                       border-radius:7px;cursor:pointer;font-weight:bold;">إلغاء</button>
              <button id="elm-msave"
                style="padding:8px 22px;background:#2563eb;color:#fff;border:none;
                       border-radius:7px;font-weight:bold;cursor:pointer;">💾 حفظ الأصل</button>
            </div>
          </div>

          <!-- خريطة اختيار الموقع -->
          <div style="padding:18px;background:#090d16;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <p style="font-weight:bold;color:#38bdf8;font-size:0.85rem;margin:0;">
                🗺️ حدد موقع أصل الطاقة على الخريطة
              </p>
              <button id="elm-locate-me" type="button"
                style="background:#059669;color:#fff;border:none;padding:4px 8px;border-radius:5px;font-size:0.73rem;cursor:pointer;font-weight:bold;">
                📍 موقعي الحالي
              </button>
            </div>
            <p style="font-size:0.75rem;color:var(--text-muted,#94a3b8);margin:0 0 8px;">
              انقر على الخريطة أو اسحب العلامة لتثبيت الإحداثيات المكانية الدقيقة
            </p>
            <div id="elm-dmap" style="width:100%;height:380px;border-radius:8px;border:1px solid var(--border,#334155);background:#0f172a;"></div>
            <div id="elm-dinfo" style="margin-top:10px;background:#0f2a1d;
                  border:1px solid #059669;border-radius:6px;padding:8px 12px;
                  font-size:0.78rem;color:#34d399;display:flex;justify-content:space-between;align-items:center;">
              <span>📍 الإحداثيات المحددة: <b id="elm-coords-text">32.3301 , 35.7501</b></span>
              <span style="font-size:0.7rem;color:#6ee7b7;">WGS84 EPSG:4326</span>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    /* ربط الأحداث */
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });
    document.getElementById('elm-mclose').addEventListener('click',  () => this._closeModal());
    document.getElementById('elm-mcancel').addEventListener('click', () => this._closeModal());
    document.getElementById('elm-msave').addEventListener('click',   () => this._saveAsset());
    document.getElementById('elm-locate-me')?.addEventListener('click', () => this._locateUserPosition());
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
      ${wrap('نوع أصل الطاقة والإنارة *', sel('elm-f-type',[
        {v:'LED_STREETLIGHT',t:'💡 وحدة إنارة شوارع LED (LED Fixture)'},
        {v:'LIGHTING_POLE',t:'💡 عمود إنارة فولاذي / ديكوري (Lighting Pole)'},
        {v:'HIGH_MAST',t:'💡 برج إنارة مرتفع (High Mast Tower)'},
        {v:'TRANSFORMER_PAD',t:'🔌 محول كهربائي فرعي/رئيسي (Transformer)'},
        {v:'FEEDER_PILLAR',t:'🔌 لوحة تغذية وتوزيع إنارة (Feeder Pillar)'},
        {v:'SMART_METER',t:'⚡ عداد كهرباء ذكي / بلدي (Smart Meter)'},
        {v:'SOLAR_FARM',t:'☀️ حقل شمسي أرضي (Solar Farm Field)'},
        {v:'ROOFTOP_SOLAR',t:'☀️ نظام طاقة شمسية أسطح المباني (Rooftop PV)'},
        {v:'BUILDING_INVERTER',t:'🏢 انفرتر وطاقة مبنى بلدي (Building Inverter System)'}
      ]))}
      ${g2(
        wrap('رمز / كود الأصل *', inp('elm-f-code','text','ENG-2026-001')),
        wrap('اسم / وصف الأصل *', inp('elm-f-name','text','وحدة إنارة شارع المستشفى'))
      )}
      ${wrap('المنطقة / الشارع / المبنى', inp('elm-f-district','text','شارع القلعة الرئيسي'))}
      ${g2(
        wrap('القدرة / الطاقة (Watt/kVA/kWp)', inp('elm-f-cap','text','150 Watt LED')),
        wrap('الفولتية والضغط', sel('elm-f-volt',[
          {v:'220V (Single Phase)',t:'220V (Single Phase)'},
          {v:'380V (Three Phase)',t:'380V (Three Phase)'},
          {v:'11kV (Medium Voltage)',t:'11kV (Medium Voltage)'},
          {v:'DC (Solar System)',t:'DC (Solar System)'}
        ]))
      )}
      ${g2(
        wrap('خط العرض Lat', inp('elm-f-lat','number','32.3301')),
        wrap('خط الطول Lng', inp('elm-f-lng','number','35.7501'))
      )}
      ${wrap('الحالة التشغيلية', sel('elm-f-status',[
        {v:'OPERATIONAL',t:'عمليات منتظمة (فعّال وجيد)'},
        {v:'PREVENTIVE_MAINT',t:'تحت الصيانة الوقائية'},
        {v:'FAULTY_REPLACE',t:'عطل يستدعي الصيانة أو الاستبدال'},
        {v:'OUT_OF_SERVICE',t:'خارج الخدمة'}
      ]))}
      ${wrap('ملاحظات والتحليل الفني للأصل',
        `<textarea id="elm-f-notes" rows="2" placeholder="ملاحظات الشركة الصانعة، الضمان، وتوصيات الفحص الدوري..."
          style="width:100%;padding:8px;background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);
                 color:#f1f5f9;border-radius:6px;font-size:0.82rem;
                 box-sizing:border-box;resize:vertical;outline:none;"></textarea>`
      )}`;
  }

  /* ─── فتح المودال ─────────────────────────────────────────────────── */
  _openModal(assetId = null) {
    this._editingId = assetId || null;
    const item = assetId
      ? (this.activeData.find(r => String(r.id) === String(assetId)) || {}) : {};

    document.getElementById('elm-mtitle').textContent =
      assetId ? `✏️ تعديل الأصل: ${item.name || item.id || ''}` : '⚡ إضافة أصل طاقة / إنارة جديد';

    const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
    sv('elm-f-type',     item.asset_type || item.assetType || 'LED_STREETLIGHT');
    sv('elm-f-code',     item.id || item.code || this._nextCode());
    sv('elm-f-name',     item.name || '');
    sv('elm-f-district', item.district || 'شارع القلعة الرئيسي');
    sv('elm-f-cap',      item.capacity || (item.wattage ? `${item.wattage}W` : '150 Watt LED'));
    sv('elm-f-volt',     item.voltage || '220V (Single Phase)');
    sv('elm-f-status',   item.status || 'OPERATIONAL');
    sv('elm-f-notes',    item.notes || '');

    let lat = item.lat || 32.3301;
    let lng = item.lng || 35.7501;
    sv('elm-f-lat', lat);
    sv('elm-f-lng', lng);

    const modal = document.getElementById('elm-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(() => this._initDrawMap(lat, lng), 240);
  }

  _closeModal() {
    const m = document.getElementById('elm-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawLayer = null;
    this._marker   = null;
  }

  /* ─── خريطة اختيار موقع الأصل داخل المودال ───────────────────────────── */
  _initDrawMap(initialLat, initialLng) {
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawMap = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('elm-dmap', [initialLat, initialLng], 14)
      : L.map('elm-dmap').setView([initialLat, initialLng], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة', maxZoom: 19
      }).addTo(this.drawMap);
    }

    this.drawLayer = L.featureGroup().addTo(this.drawMap);
    this._marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(this.drawLayer);

    const updateInputs = (lat, lng) => {
      document.getElementById('elm-f-lat').value = lat.toFixed(6);
      document.getElementById('elm-f-lng').value = lng.toFixed(6);
      document.getElementById('elm-coords-text').textContent = `${lat.toFixed(5)} , ${lng.toFixed(5)}`;
    };

    updateInputs(initialLat, initialLng);

    this._marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateInputs(pos.lat, pos.lng);
    });

    this.drawMap.on('click', e => {
      const { lat, lng } = e.latlng;
      this._marker.setLatLng([lat, lng]);
      updateInputs(lat, lng);
    });

    setTimeout(() => this.drawMap?.invalidateSize(), 260);
  }

  _locateUserPosition() {
    if (!navigator.geolocation) {
      this._toast('⚠️ خدمة تحديد الموقع غير مدعومة في متصفحك.');
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (this._marker && this.drawMap) {
        this._marker.setLatLng([lat, lng]);
        this.drawMap.setView([lat, lng], 16);
        document.getElementById('elm-f-lat').value = lat.toFixed(6);
        document.getElementById('elm-f-lng').value = lng.toFixed(6);
        document.getElementById('elm-coords-text').textContent = `${lat.toFixed(5)} , ${lng.toFixed(5)}`;
        this._toast('📍 تم تحديد موقعك الميداني بنجاح.');
      }
    }, () => {
      this._toast('⚠️ تعذر الحصول على الإحداثيات الجغرافية.');
    });
  }

  /* ─── حفظ الأصل ─────────────────────────────────────────────────── */
  async _saveAsset() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const id = gv('elm-f-code'), name = gv('elm-f-name');
    if (!id || !name) { this._toast('⚠️ رمز الأصل واسمه إلزاميان.'); return; }

    const payload = {
      id,
      code:      id,
      name,
      assetType: gv('elm-f-type'),
      district:  gv('elm-f-district') || 'كفرنجة',
      capacity:  gv('elm-f-cap'),
      voltage:   gv('elm-f-volt'),
      status:    gv('elm-f-status'),
      notes:     gv('elm-f-notes'),
      lat:       parseFloat(gv('elm-f-lat')) || 32.3301,
      lng:       parseFloat(gv('elm-f-lng')) || 35.7501
    };

    const btn = document.getElementById('elm-msave');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }

    try {
      try {
        if (typeof apiFetch === 'function') {
          await apiFetch('/v4/assets/energy', { method:'POST', body: JSON.stringify(payload) });
        } else {
          await fetch('/api/v4/assets/energy', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
          });
        }
      } catch (netErr) {
        console.warn('⚠️ Energy server save fallback:', netErr.message);
      }

      const newObj = {
        id: payload.id,
        code: payload.code,
        asset_type: payload.assetType,
        assetType: payload.assetType,
        name: payload.name,
        district: payload.district,
        capacity: payload.capacity,
        voltage: payload.voltage,
        status: payload.status,
        notes: payload.notes,
        lat: payload.lat,
        lng: payload.lng,
        geojson: { type: 'Point', coordinates: [payload.lng, payload.lat] },
        created_at: new Date().toISOString()
      };

      this.activeData = this.activeData.filter(x => String(x.id) !== String(payload.id));
      this.activeData.unshift(newObj);
      this._saveLocalCache();

      this._toast('✅ تم حفظ بيانات أصل الطاقة والإنارة والموقع الجغرافي بنجاح.');
      this._closeModal();
      this._applyFilterAndRender();
    } catch (err) {
      this._toast('❌ خطأ في الحفظ: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ الأصل'; }
    }
  }

  /* ─── حذف الأصل ─────────────────────────────────────────────────── */
  async _deleteAsset(assetId) {
    const item = this.activeData.find(x => String(x.id) === String(assetId));
    const name = item?.name || assetId;
    if (!confirm(`⚠️ تأكيد حذف أصل الطاقة/الإنارة "${name}" نهائياً من النظام؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      if (typeof apiFetch === 'function') {
        await apiFetch(`/v4/assets/energy/${assetId}`, { method:'DELETE' });
      } else {
        await fetch(`/api/v4/assets/energy/${assetId}`, { method:'DELETE' });
      }
    } catch (err) {}
    this.activeData = this.activeData.filter(x => String(x.id) !== String(assetId));
    this._saveLocalCache();
    this._toast(`🗑️ تم حذف الأصل "${name}" بنجاح.`);
    this._applyFilterAndRender();
  }

  /* ─── تصدير ملف Excel / CSV ───────────────────────────────────────── */
  _exportCSV() {
    if (!this.activeData.length) {
      this._toast('⚠️ لا توجد بيانات للتصدير.');
      return;
    }

    const headers = ['رمز الأصل', 'اسم الأصل', 'نوع الخدمة', 'المنطقة/الشارع', 'القدرة/الطاقة', 'الفولتية', 'الحالة التشغيلية', 'خط العرض', 'خط الطول', 'تاريخ التسجيل', 'ملاحظات'];
    
    const rows = this.activeData.map(r => {
      return [
        `"${r.id || r.code || ''}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${(r.asset_type || r.assetType || '').replace(/"/g, '""')}"`,
        `"${(r.district || 'كفرنجة').replace(/"/g, '""')}"`,
        `"${(r.capacity || '').replace(/"/g, '""')}"`,
        `"${(r.voltage || '220V').replace(/"/g, '""')}"`,
        `"${(r.status || 'OPERATIONAL').replace(/"/g, '""')}"`,
        `"${r.lat || ''}"`,
        `"${r.lng || ''}"`,
        `"${r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : ''}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Energy_Lighting_Kufranjah_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this._toast('📊 تم تصدير ملف بيانات الطاقة والإنارة بنجاح.');
  }

  /* ─── طباعة أصل واحد ────────────────────────────────────────────── */
  _printAsset(assetId) {
    const r = this.activeData.find(x => String(x.id) === String(assetId));
    if (!r) { this._toast('⚠️ لم يُعثر على بيانات أصل الطاقة.'); return; }

    const isMaint = (r.status || '').includes('MAINT') || (r.status || '').includes('FAIL') || (r.status || '').includes('عطل') || (r.status || '').includes('صيانة');
    const stLabel = isMaint ? 'تحت الصيانة والإصلاح الفوري' : 'عمليات منتظمة وفعّالة';
    const clr = isMaint ? '#dc2626' : '#059669';

    const summary = `
      <div style="margin:16px 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #cbd5e1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="color:#1e3a8a;font-size:0.92rem;">📊 الحالة التشغيلية والفنية لأصل الطاقة</b>
          <span style="background:${isMaint ? '#fef2f2' : '#ecfdf5'};color:${clr};border:1px solid ${clr};padding:3px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;">${stLabel}</span>
        </div>
        <div style="margin-top:10px;font-size:0.86rem;line-height:1.7;color:#1e293b;background:#ffffff;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <b style="color:#1e3a8a;">📌 التوصية الفنية المعتمدة:</b>
          ${isMaint ? 'إرسال ورشة الصيانة الكهربائية لفحص القواطع والخلايا الضوئية واستبدال الأجزاء التالفة.' : 'متابعة جدول الصيانة الوقائية وفحص قراءات العدادات والقدرة التوليدية بانتظام.'}
          ${r.notes ? `<div style="margin-top:4px;color:#475569;"><b>ملاحظات الفحص:</b> ${r.notes}</div>` : ''}
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'تقرير المعاينة والتقييم الفني لأصل الطاقة والإنارة والتحكم الذكي',
        subtitle:  'المملكة الأردنية الهاشمية — بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية',
        refNumber: `ENG-${r.id}-${new Date().getFullYear()}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخطط الإسناد الجغرافي GIS',
        type:      'single',
        fields: [
          { label: 'رمز الأصل الجغرافي',  value: r.id },
          { label: 'اسم / وصف الأصل',    value: r.name },
          { label: 'نوع الأصل والخدمة', value: r.asset_type || r.assetType || 'إنارة' },
          { label: 'المنطقة / الشارع',   value: r.district || 'كفرنجة' },
          { label: 'القدرة / الطاقة',    value: r.capacity || 'قياسي' },
          { label: 'الفولتية والضغط',    value: r.voltage || '220V' },
          { label: 'الحالة التشغيلية',  value: stLabel },
          { label: 'الإحداثيات المكانية', value: (r.lat && r.lng) ? `${r.lat} , ${r.lng}` : 'GIS Verified' },
          { label: 'تاريخ التوثيق',      value: r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : new Date().toLocaleDateString('ar-JO') }
        ],
        summaryHtml: summary,
        signatures: true
      });
    } else {
      window.print();
    }
  }

  /* ─── طباعة السجل الشامل لأصول الطاقة ──────────────────────────── */
  _printAll() {
    const data = this.activeData;
    if (!data.length) { this._toast('⚠️ لا توجد بيانات للطباعة.'); return; }

    const lCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('LIGHT') || t.includes('POLE') || t.includes('MAST') || t.includes('إنارة');
    }).length;
    const tCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('TRANS') || t.includes('FEEDER') || t.includes('محول');
    }).length;
    const sCount = data.filter(n => {
      const t = (n.asset_type || n.assetType || '').toUpperCase();
      return t.includes('SOLAR') || t.includes('PV') || t.includes('شمسي');
    }).length;
    const mCount = data.filter(n => {
      const st = (n.status || '').toUpperCase();
      return st.includes('MAINT') || st.includes('FAIL') || st.includes('عطل');
    }).length;

    const kpiHtml = `
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:12px;margin:14px 0 18px 0;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#059669;">${data.length}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">إجمالي الأصول</div>
        </div>
        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#ca8a04;">${lCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">أعمدة ووحدات إنارة</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#d97706;">${tCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">محولات ولوحات تغذية</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#0d9488;">${sCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">حقول شمسية وطاقة</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#dc2626;">${mCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تحت الصيانة</div>
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'سجل حصر وتتبع أصول الطاقة والإنارة والطاقة المتجددة',
        subtitle:  'كشف الرصد المكاني والفني المعتمد — بلدية كفرنجة الجديدة',
        refNumber: `ENG-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخططات الإسناد الجغرافي GIS',
        type:      'list',
        summaryHtml: kpiHtml,
        data: data.map(r => {
          return {
            id:       r.id,
            name:     r.name || '—',
            type:     r.asset_type || r.assetType || 'إنارة',
            district: r.district || 'كفرنجة',
            cap:      r.capacity || (r.wattage ? `${r.wattage}W` : 'قياسي'),
            status:   (r.status || '').includes('MAINT') || (r.status || '').includes('FAIL') ? 'تحت الصيانة' : 'فعّال'
          };
        }),
        columns: [
          { key:'id',       label:'رمز الأصل' },
          { key:'name',     label:'اسم الأصل / المواصفات' },
          { key:'type',     label:'نوع الأصل والخدمة' },
          { key:'district', label:'المنطقة / الشارع' },
          { key:'cap',      label:'القدرة / الطاقة' },
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
    return `ENG-${y}-${String(this.activeData.length + 1).padStart(3,'0')}`;
  }

  _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[EMAMS]', msg);
  }
}

/* ── تسجيل الكلاس والدوال الموحدة ─────────────────────────────────── */
if (typeof window !== 'undefined') {
  window.ComprehensiveEnergyLightingManager = ComprehensiveEnergyLightingManager;
  window.energyLightingManager = null;

  window.loadEnergyLighting = async function() {
    const container = document.getElementById('energy-tab-container');
    if (!container) return;
    try {
      if (window.energyLightingManager && container.children.length > 0) {
        setTimeout(() => {
          if (window.energyLightingManager.map) window.energyLightingManager.map.invalidateSize();
          if (typeof window.energyLightingManager._applyFilterAndRender === 'function') {
            window.energyLightingManager._applyFilterAndRender();
          }
        }, 150);
        return;
      }
      container.innerHTML = '';
      window.energyLightingManager = new ComprehensiveEnergyLightingManager('energy-tab-container');
    } catch (e) {
      console.error('loadEnergyLighting error:', e);
      container.innerHTML = `<div style="padding:20px;color:#f87171;text-align:center;">❌ ${e.message}</div>`;
    }
  };

  window.openNewEnergyLightingModal = function() {
    if (window.energyLightingManager && typeof window.energyLightingManager._openModal === 'function') {
      window.energyLightingManager._openModal(null);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveEnergyLightingManager;
}
