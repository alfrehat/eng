/**
 * Unified Structural Assets & Buildings Manager v4.5 (Enterprise Edition)
 * وحدة إدارة الأبنية والجدران الاستنادية والأصول الهيكلية المعتمدة - بلدية كفرنجة الجديدة
 * مديرية الأشغال والخدمات الهندسية — قسم الأصول الإنشائية والمشاريع
 */
'use strict';

class ComprehensiveStructuralManager {

  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map          = null;
    this.drawMap      = null;
    this.drawLayer    = null;
    this.assetsLayer  = null;
    this.activeData   = [];
    this._editingId   = null;
    this._marker      = null;
    this._filterType  = 'ALL';
    this._filterCond  = 'ALL';
    this._sortField   = 'id';
    this._sortAsc     = false;

    this._readUser();
    this._loadLocalCache();
    this._buildUI();
  }

  /* ─── التخزين المحلي والنسخ الاحتياطي المستمر ────────────────────────── */
  _loadLocalCache() {
    try {
      const stored = localStorage.getItem('sams_structural_v4');
      if (stored) {
        this.activeData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[SAMS] Cache load error:', e);
    }
    if (!Array.isArray(this.activeData)) {
      this.activeData = [];
    }
  }

  _saveLocalCache() {
    try {
      localStorage.setItem('sams_structural_v4', JSON.stringify(this.activeData));
    } catch (e) {
      console.warn('[SAMS] Cache save error:', e);
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
      this.canWrite = !role || ['admin', 'director_public_works', 'head_of_buildings', 'buildings_engineer', 'quantity_surveyor'].includes(role);
    }
    this.isAdmin  = !role || role === 'admin' || role === 'director_public_works';
  }

  /* ─── بناء الواجهة الرئيسية الفائقة ─────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <div id="sam-root" style="background:var(--bg-card,#0f172a);color:var(--text,#f8fafc);padding:18px;
            border-radius:12px;direction:rtl;font-family:'Tajawal',system-ui,sans-serif;">

        <!-- شريط الأدوات والتحكم العلوي -->
        <div style="display:flex;justify-content:space-between;align-items:center;
              flex-wrap:wrap;gap:12px;background:var(--bg-surface,#1e293b);padding:14px 18px;
              border-radius:10px;border:1px solid var(--border,#334155);margin-bottom:16px;">
          
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-weight:800;color:#38bdf8;font-size:0.92rem;display:flex;align-items:center;gap:6px;">
              🏛️ منظومة الأبنية والجدران الاستنادية (SAMS v4.5)
            </span>
            ${this.canWrite ? `<button id="sam-add" class="sam-btn-action" style="background:#059669;color:#fff;">🏢/🧱 إضافة أصل إنشائي</button>` : ''}
            <button id="sam-print-all" class="sam-btn-action" style="background:#7c3aed;color:#fff;">🖨️ طباعة السجل الرسمي</button>
            <button id="sam-export-csv" class="sam-btn-action" style="background:#0284c7;color:#fff;">📊 تصدير Excel / CSV</button>
            <button id="sam-refresh" class="sam-btn-action" style="background:#475569;color:#fff;" title="تحديث ومزامنة">🔄 تحديث</button>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- فلاتر النوع -->
            <div style="display:flex;background:#090d16;padding:3px;border-radius:8px;border:1px solid var(--border,#334155);">
              <button id="sam-filter-all" class="sam-fbtn active" data-type="ALL">الكل</button>
              <button id="sam-filter-building" class="sam-fbtn" data-type="BUILDING">🏢 المباني</button>
              <button id="sam-filter-wall" class="sam-fbtn" data-type="WALL">🧱 الجدران</button>
              <button id="sam-filter-urgent" class="sam-fbtn" data-type="URGENT" style="color:#f87171;">⚠️ حرجة / تدعيم</button>
            </div>

            <!-- حقل البحث الفوري الذكي -->
            <input id="sam-search" type="text" placeholder="🔍 بحث بالاسم، الحي، الرمز، أو التقييم..."
              style="background:var(--input-bg,#0f172a);color:var(--input-text,#f8fafc);border:1px solid var(--input-border,#334155);
                     padding:8px 14px;border-radius:8px;font-size:0.82rem;width:240px;outline:none;" />
          </div>
        </div>

        <!-- بطاقات المؤشرات الإحصائية والفنية (KPIs) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">إجمالي الأصول الهيكلية</div>
            <div id="sam-kpi-total" style="font-size:1.6rem;font-weight:800;color:#38bdf8;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🏢 المباني والمنشآت البلدية</div>
            <div id="sam-kpi-buildings" style="font-size:1.6rem;font-weight:800;color:#10b981;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">🧱 الجدران الاستنادية</div>
            <div id="sam-kpi-walls" style="font-size:1.6rem;font-weight:800;color:#f59e0b;margin-top:2px;">0</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">متوسط السلامة الإنشائية</div>
            <div id="sam-kpi-pci" style="font-size:1.6rem;font-weight:800;color:#a855f7;margin-top:2px;">0%</div>
          </div>
          <div style="background:var(--bg-surface,#1e293b);border:1px solid var(--border,#334155);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:0.78rem;color:var(--text-muted,#94a3b8);font-weight:600;">⚠️ تتطلب تدعيماً عاجلاً</div>
            <div id="sam-kpi-urgent" style="font-size:1.6rem;font-weight:800;color:#ef4444;margin-top:2px;">0</div>
          </div>
        </div>

        <!-- الخريطة التفاعلية -->
        <div style="margin-bottom:16px;background:var(--table-header-bg,#1e293b);padding:8px;border-radius:10px;
                    border:1px solid var(--border,#334155);position:relative;">
          <div id="sam-map" style="width:100%;height:390px;border-radius:8px;background:#0f172a;"></div>
          <div style="position:absolute;top:16px;left:16px;background:rgba(15,23,42,0.92);
                      padding:9px 14px;border-radius:8px;border:1px solid var(--border,#334155);
                      font-size:0.74rem;z-index:400;line-height:1.9;backdrop-filter:blur(4px);">
            <div style="font-weight:bold;color:#94a3b8;margin-bottom:2px;">دليل السلامة الإنشائية:</div>
            <div style="color:#34d399;">🟢 85 - 100 سلامة ممتازة / آمن</div>
            <div style="color:#fbbf24;">🟡 60 - 84 صيانة وقائية وتكحيل</div>
            <div style="color:#f87171;">🔴 &lt; 60 خطر إنشائي وتدعيم فوري</div>
          </div>
        </div>

        <!-- الجدول المفصل مع ترتيب الأعمدة -->
        <div style="background:var(--bg-surface,#1e293b);border-radius:10px;border:1px solid var(--border,#334155);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <h3 style="margin:0;font-size:0.98rem;font-weight:800;color:#38bdf8;display:flex;align-items:center;gap:6px;">
              📋 سجل جرد الأبنية والمنشآت والجدران الاستنادية
            </h3>
            <span id="sam-badge"
              style="background:rgba(30,58,138,.6);color:#93c5fd;font-size:0.82rem;
                     padding:4px 14px;border-radius:6px;font-weight:bold;border:1px solid #1e3a8a;">إجمالي المعروض: 0</span>
          </div>

          <div style="overflow-x:auto;">
            <table id="sam-table" style="width:100%;text-align:right;font-size:0.8rem;
                                         border-collapse:collapse;min-width:920px;">
              <thead style="background:var(--table-header-bg,#0f172a);color:var(--text-muted,#94a3b8);border-bottom:2px solid var(--border,#334155);">
                <tr>
                  <th class="sam-sortable" data-sort="id" style="padding:11px 10px;cursor:pointer;">رمز الأصل ⬍</th>
                  <th style="padding:11px 10px;">النوع والتصنيف</th>
                  <th class="sam-sortable" data-sort="name" style="padding:11px 10px;cursor:pointer;">اسم المنشأة / الجدار ⬍</th>
                  <th class="sam-sortable" data-sort="district" style="padding:11px 10px;cursor:pointer;">المنطقة / الحي ⬍</th>
                  <th style="padding:11px 10px;">الارتفاع / الأبعاد</th>
                  <th class="sam-sortable" data-sort="pci" style="padding:11px 10px;cursor:pointer;">مؤشر السلامة (PCI) ⬍</th>
                  <th style="padding:11px 10px;">الموقع الجغرافي</th>
                  <th class="sam-sortable" data-sort="date" style="padding:11px 10px;cursor:pointer;">تاريخ التسجيل ⬍</th>
                  <th style="padding:11px 10px;text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="sam-tbody">
                <tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted,#94a3b8);">
                  ⏳ جاري التحميل وعرض السجلات...
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    /* حقن أنماط الأزرار والفلاتر */
    this._injectStyles();

    this._buildModal();

    setTimeout(() => {
      this._initMap();
      this._fetchAssets();
      this._bindAll();
    }, 80);
  }

  _injectStyles() {
    if (document.getElementById('sam-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'sam-custom-styles';
    style.textContent = `
      .sam-btn-action {
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
      .sam-btn-action:hover { opacity: 0.9; transform: translateY(-1px); }
      .sam-fbtn {
        background: transparent;
        color: #94a3b8;
        border: none;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 0.78rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .sam-fbtn.active {
        background: #2563eb !important;
        color: #fff !important;
        font-weight: bold;
      }
      .sam-sortable:hover { color: #38bdf8; }
    `;
    document.head.appendChild(style);
  }

  /* ─── الخريطة الرئيسية ──────────────────────────────────────────────── */
  _initMap() {
    const el = document.getElementById('sam-map');
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      try { this.map.remove(); } catch {}
      this.map = null;
    }

    this.map = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('sam-map', [32.2985, 35.7050], 14)
      : L.map('sam-map').setView([32.2985, 35.7050], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة الجديدة | OSM',
        maxZoom: 19
      }).addTo(this.map);
    }

    this.assetsLayer = L.layerGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 350);
  }

  /* ─── تحميل ومزامنة بيانات الأصول من قاعدة البيانات ───────────────── */
  async _fetchAssets() {
    try {
      let res;
      if (typeof apiFetch === 'function') {
        res = await apiFetch('/v4/assets/structural', { silent: true });
      } else {
        const r = await fetch('/api/v4/assets/structural');
        res = await r.json();
      }
      if (res && Array.isArray(res.data)) {
        this.activeData = res.data;
        this._saveLocalCache();
      }
    } catch (e) {
      console.warn('[SAMS] fetchAssets fallback:', e.message);
    }
    this._applyFilterAndRender();
  }

  /* ─── تطبيق التصفية والترتيب وعرض الجدول ────────────────────────────── */
  _applyFilterAndRender() {
    let data = [...this.activeData];

    /* فلاتر النوع */
    if (this._filterType === 'BUILDING') {
      data = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('BUILDING') || (a.name || '').includes('مبنى'));
    } else if (this._filterType === 'WALL') {
      data = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('WALL') || (a.name || '').includes('جدار'));
    } else if (this._filterType === 'URGENT') {
      data = data.filter(a => parseFloat(a.condition_index || a.conditionIndex || a.structural_condition_index || 85) < 60);
    }

    /* فلتر البحث */
    const q = document.getElementById('sam-search')?.value?.trim()?.toLowerCase() || '';
    if (q) {
      data = data.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.district || '').toLowerCase().includes(q) ||
        (a.id || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      );
    }

    /* الترتيب */
    data.sort((a, b) => {
      let valA, valB;
      if (this._sortField === 'id') {
        valA = a.id || ''; valB = b.id || '';
      } else if (this._sortField === 'name') {
        valA = a.name || ''; valB = b.name || '';
      } else if (this._sortField === 'district') {
        valA = a.district || ''; valB = b.district || '';
      } else if (this._sortField === 'pci') {
        valA = parseFloat(a.condition_index || a.conditionIndex || 85);
        valB = parseFloat(b.condition_index || b.conditionIndex || 85);
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
    const bCount = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('BUILDING') || (a.name || '').includes('مبنى')).length;
    const wCount = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('WALL') || (a.name || '').includes('جدار')).length;
    const avgPci = total ? (data.reduce((s, a) => s + parseFloat(a.condition_index || a.conditionIndex || a.structural_condition_index || 85), 0) / total).toFixed(1) : 0;
    const urgent = data.filter(a => parseFloat(a.condition_index || a.conditionIndex || a.structural_condition_index || 85) < 60).length;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('sam-kpi-total', total);
    setEl('sam-kpi-buildings', bCount);
    setEl('sam-kpi-walls', wCount);
    setEl('sam-kpi-pci', `${avgPci}%`);
    setEl('sam-kpi-urgent', urgent);
  }

  /* ─── عرض الجدول المفصل ──────────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('sam-tbody');
    const badge = document.getElementById('sam-badge');
    if (!tbody) return;
    if (badge) badge.textContent = `إجمالي المعروض: ${data.length}`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="9"
        style="text-align:center;padding:36px;color:var(--text-muted,#94a3b8);">
        <div style="font-size:2.2rem;margin-bottom:8px;">📭</div>
        لا توجد أبنية أو جدران استنادية مسجلة تطابق التصفية الحالية.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const pci = parseFloat(r.condition_index || r.conditionIndex || r.structural_condition_index || 85);
      const clr = pci >= 85 ? '#10b981' : pci >= 60 ? '#f59e0b' : '#ef4444';
      const bg  = pci >= 85 ? '#065f46' : pci >= 60 ? '#78350f' : '#7f1d1d';
      const lbl = pci >= 85 ? 'ممتاز / آمن' : pci >= 60 ? 'متوسط / صيانة' : 'خطر / تدعيم';
      const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
      const typeIcon = isWall ? '🧱 جدار استنادي' : '🏢 مبنى/مرفق';
      const dims = r.height_meters ? `${r.height_meters} م` : (r.floors_count ? `${r.floors_count} طوابق` : '—');
      const createdDate = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : '—';

      return `
        <tr data-aid="${r.id}" style="border-bottom:1px solid #1e293b;transition:background 0.15s;" onmouseover="this.style.background='rgba(51,65,85,0.3)'" onmouseout="this.style.background='transparent'">
          <td style="padding:10px 8px;font-weight:bold;color:#38bdf8;font-family:monospace;">${r.id}</td>
          <td style="padding:10px 8px;">
            <span style="background:#334155;color:#cbd5e1;padding:3px 8px;border-radius:5px;font-size:0.75rem;font-weight:600;">
              ${typeIcon}
            </span>
          </td>
          <td style="padding:10px 8px;font-weight:bold;color:#f8fafc;">${r.name || '—'}</td>
          <td style="padding:10px 8px;color:var(--text-muted,#94a3b8);">${r.district || 'حي وسط البلد'}</td>
          <td style="padding:10px 8px;">${dims}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:55px;height:7px;background:var(--bg-surface,#0f172a);border-radius:4px;overflow:hidden;border:1px solid #334155;">
                <div style="width:${pci}%;height:100%;background:${clr};border-radius:4px;"></div>
              </div>
              <span style="background:${bg};color:${clr};padding:2px 6px;border-radius:4px;
                           font-weight:bold;font-size:0.74rem;">${pci}% | ${lbl}</span>
            </div>
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#38bdf8;">
            ${(r.lat || r.geojson) ? '📍 GIS مثبت' : 'غير محدد'}
          </td>
          <td style="padding:10px 8px;font-size:0.77rem;color:#94a3b8;">${createdDate}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
              <button class="sam-row-view" data-id="${r.id}"
                style="background:#475569;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="تحديد على الخريطة">👁️</button>
              ${this.canWrite ? `<button class="sam-row-edit" data-id="${r.id}"
                style="background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="تعديل الأصل">✏️</button>` : ''}
              <button class="sam-row-print" data-id="${r.id}"
                style="background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="طباعة التقرير الفني">🖨️</button>
              ${this.isAdmin ? `<button class="sam-row-del" data-id="${r.id}"
                style="background:#dc2626;color:#fff;border:none;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.78rem;" title="حذف الأصل">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    this._bindTableRows();
  }

  /* ─── ربط أحداث الجدول ──────────────────────────────────────────────── */
  _bindTableRows() {
    const tbody = document.getElementById('sam-tbody');
    if (!tbody) return;

    if (this._tbodyHandler) tbody.removeEventListener('click', this._tbodyHandler);

    this._tbodyHandler = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains('sam-row-view'))  this._previewOnMap(id);
      if (btn.classList.contains('sam-row-edit'))  this._openModal(id);
      if (btn.classList.contains('sam-row-print')) this._printAsset(id);
      if (btn.classList.contains('sam-row-del'))   this._deleteAsset(id);
    };
    tbody.addEventListener('click', this._tbodyHandler);
  }

  /* ─── ربط كافة عناصر التحكم ─────────────────────────────────────────── */
  _bindAll() {
    document.getElementById('sam-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('sam-print-all')?.addEventListener('click', () => this._printAll());
    document.getElementById('sam-export-csv')?.addEventListener('click', () => this._exportCSV());
    document.getElementById('sam-refresh')?.addEventListener('click', () => {
      this._toast('🔄 جاري تحديث البيانات من الخادم...');
      this._fetchAssets();
    });

    document.getElementById('sam-search')?.addEventListener('input', () => this._applyFilterAndRender());

    /* فلاتر الأزرار */
    document.querySelectorAll('.sam-fbtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sam-fbtn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this._filterType = e.target.dataset.type || 'ALL';
        this._applyFilterAndRender();
      });
    });

    /* ترتيب الأعمدة عند النقر على العناوين */
    document.querySelectorAll('.sam-sortable').forEach(th => {
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

  /* ─── الخريطة: رسم الأصول وعرض النوافذ التفاعلية ────────────────────── */
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

      const pci = parseFloat(r.condition_index || r.conditionIndex || r.structural_condition_index || 85);
      const clr = pci >= 85 ? '#10b981' : pci >= 60 ? '#f59e0b' : '#ef4444';
      const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
      const iconEmoji = isWall ? '🧱' : '🏛️';

      const icon = typeof UnifiedGisEngine !== 'undefined'
        ? UnifiedGisEngine.createCustomIcon(iconEmoji, clr, 30)
        : L.circleMarker([lat, lng], { radius: 8, fillColor: clr, color: '#fff', weight: 2, fillOpacity: 0.9 });

      const marker = typeof icon.options === 'object' && icon.options.iconSize
        ? L.marker([lat, lng], { icon })
        : icon;

      marker.bindPopup(this._mapPopup(r, pci, clr));
      this.assetsLayer.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }

  _mapPopup(r, pci, clr) {
    const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
    const iconName = isWall ? '🧱 جدار استنادي' : '🏢 مبنى بلدي';
    return `
      <div style="direction:rtl; text-align:right; font-family:'Tajawal',sans-serif; min-width:220px; padding:4px;">
        <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">${r.name || 'أصل إنشائي'}</div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">الرمز: <b style="color:#1e3a8a;">${r.id}</b> (${iconName})</div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:2px;">المنطقة: <b>${r.district || 'كفرنجة'}</b></div>
        <div style="font-size:0.8rem; color:#475569; margin-bottom:4px;">الارتفاع / الأبعاد: <b>${r.height_meters ? r.height_meters + ' م' : (r.floors_count ? r.floors_count + ' طوابق' : '—')}</b></div>
        <div style="margin:6px 0; font-size:0.82rem; color:${clr}; font-weight:bold; background:#f8fafc; padding:4px 6px; border-radius:4px; border:1px solid #e2e8f0;">
          التقييم الإنشائي: ${pci}% — ${pci >= 85 ? 'حالة ممتازة' : pci >= 60 ? 'صيانة دورية' : 'تدعيم عاجل'}
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="if(window.structuralManager) window.structuralManager._printAsset('${r.id}')" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🖨️ طباعة</button>
          ${this.canWrite ? `<button onclick="if(window.structuralManager) window.structuralManager._openModal('${r.id}')" style="flex:1;background:#1d4ed8;color:#fff;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">✏️ تعديل</button>` : ''}
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
      this._toast(`📍 تم تحديد موقع: ${r.name}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     مودال الإضافة / التعديل للأصل الإنشائي مع التقاط الـ GPS
  ═══════════════════════════════════════════════════════════════════ */
  _buildModal() {
    document.getElementById('sam-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'sam-modal';
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
          <h3 id="sam-mtitle" style="margin:0;font-size:1rem;font-weight:800;color:#38bdf8;">
            🏛️ إضافة أصل إنشائي جديد (مبنى / جدار استنادي)
          </h3>
          <button id="sam-mclose"
            style="background:#475569;border:none;color:#fff;width:32px;height:32px;
                   border-radius:50%;cursor:pointer;font-size:1rem;font-weight:bold;">✕</button>
        </div>

        <!-- محتوى العمودين -->
        <div style="display:grid;grid-template-columns:1fr 1fr;">

          <!-- النموذج -->
          <div id="sam-mform" style="padding:18px;display:flex;flex-direction:column;gap:10px;
                border-left:1px solid var(--border,#334155);">
            ${this._formHTML()}
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;
                        padding-top:14px;border-top:1px solid var(--border,#334155);">
              <button id="sam-mcancel"
                style="padding:8px 18px;background:#475569;color:#fff;border:none;
                       border-radius:7px;cursor:pointer;font-weight:bold;">إلغاء</button>
              <button id="sam-msave"
                style="padding:8px 22px;background:#2563eb;color:#fff;border:none;
                       border-radius:7px;font-weight:bold;cursor:pointer;">💾 حفظ الأصل الإنشائي</button>
            </div>
          </div>

          <!-- خريطة اختيار الموقع -->
          <div style="padding:18px;background:#090d16;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <p style="font-weight:bold;color:#38bdf8;font-size:0.85rem;margin:0;">
                🗺️ تثبيت الموقع المكاني (GIS Verification)
              </p>
              <button id="sam-locate-me" type="button"
                style="background:#059669;color:#fff;border:none;padding:4px 8px;border-radius:5px;font-size:0.73rem;cursor:pointer;font-weight:bold;">
                📍 موقعي الحالي
              </button>
            </div>
            <p style="font-size:0.75rem;color:var(--text-muted,#94a3b8);margin:0 0 8px;">
              انقر على الخريطة أو اسحب المؤشر لتحديد الإحداثيات المكانية الدقيقة
            </p>
            <div id="sam-dmap" style="width:100%;height:380px;border-radius:8px;border:1px solid var(--border,#334155);background:#0f172a;"></div>
            <div id="sam-dinfo" style="margin-top:10px;background:#064e3b;
                  border:1px solid #059669;border-radius:6px;padding:8px 12px;
                  font-size:0.78rem;color:#a7f3d0;display:flex;justify-content:space-between;align-items:center;">
              <span>📍 الإحداثيات المحددة: <b id="sam-coords-text">32.33010 , 35.75010</b></span>
              <span style="font-size:0.7rem;color:#6ee7b7;">WGS84 EPSG:4326</span>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    /* ربط الأحداث */
    modal.addEventListener('click', e => { if (e.target === modal) this._closeModal(); });
    document.getElementById('sam-mclose').addEventListener('click',  () => this._closeModal());
    document.getElementById('sam-mcancel').addEventListener('click', () => this._closeModal());
    document.getElementById('sam-msave').addEventListener('click',   () => this._saveAsset());
    document.getElementById('sam-locate-me')?.addEventListener('click', () => this._locateUserPosition());
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
      ${wrap('نوع الأصل الإنشائي *', sel('sam-f-type',[
        {v:'RETAINING_WALL',t:'🧱 جدار استنادي خرساني / حجري'},
        {v:'BUILDING',t:'🏢 مبنى بلدي / مرفق حكومي'},
        {v:'BOX_CULVERT',t:'📦 عبارة خرسانية / منشأة تصريف مائية'},
        {v:'PUBLIC_HALL',t:'🏛️ قاعة عامة / مركز خدمات بلدية'}
      ]))}
      ${g2(
        wrap('كود الأصل الإنشائي *', inp('sam-f-id','text','AST-2026-001')),
        wrap('اسم الأصل / المنشأة *', inp('sam-f-name','text','جدار شارع المستشفى الاستنادي'))
      )}
      ${wrap('المنطقة / الحي', inp('sam-f-district','text','منطقة كفرنجة الشمالية'))}
      ${g2(
        wrap('الارتفاع (متر)', inp('sam-f-height','number','4.5')),
        wrap('عدد الطوابق (للمباني)', inp('sam-f-floors','number','1'))
      )}
      ${g2(
        wrap('مؤشر التقييم الإنشائي (0-100)', inp('sam-f-pci','number','85')),
        wrap('حالة الخرسانة / البناء', sel('sam-f-condition',[
          {v:'ممتازة - لا توجد تشققات',t:'ممتازة - لا توجد تشققات'},
          {v:'جيدة - تشققات شعرية طفيفة',t:'جيدة - تشققات شعرية طفيفة'},
          {v:'متوسطة - تحتاج صيانة وتكحيل',t:'متوسطة - تحتاج صيانة وتكحيل'},
          {v:'حرجة - ميلان أو تصدع خرساني',t:'حرجة - ميلان أو تصدع خرساني'}
        ]))
      )}
      ${g2(
        wrap('خط العرض (Lat)', inp('sam-f-lat','number','32.330100')),
        wrap('خط الطول (Lng)', inp('sam-f-lng','number','35.750100'))
      )}
      ${wrap('ملاحظات الفحص والسلامة الإنشائية والتوصيات',
        `<textarea id="sam-f-notes" rows="2" placeholder="ملاحظات العيوب الإنشائية، سلامة المصارف، والتدعيم..."
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

    document.getElementById('sam-mtitle').textContent =
      assetId ? `✏️ تعديل الأصل: ${item.name || ''}` : '🏛️ إضافة أصل إنشائي جديد';

    const sv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
    sv('sam-f-id',       item.id || this._nextCode());
    sv('sam-f-type',     item.asset_type || item.assetType || item.category || 'RETAINING_WALL');
    sv('sam-f-name',     item.name || '');
    sv('sam-f-district', item.district || 'منطقة كفرنجة الشمالية');
    sv('sam-f-height',   item.height_meters || item.heightMeters || '4.5');
    sv('sam-f-floors',   item.floors_count || item.floorsCount || '1');
    sv('sam-f-pci',      item.condition_index || item.conditionIndex || item.structural_condition_index || 85);
    sv('sam-f-notes',    item.notes || '');

    let lat = parseFloat(item.lat || 32.33010);
    let lng = parseFloat(item.lng || 35.75010);
    sv('sam-f-lat', lat.toFixed(6));
    sv('sam-f-lng', lng.toFixed(6));

    const modal = document.getElementById('sam-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    setTimeout(() => this._initDrawMap(lat, lng), 240);
  }

  _closeModal() {
    const m = document.getElementById('sam-modal');
    if (m) m.style.display = 'none';
    document.body.style.overflow = '';
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawLayer = null;
    this._marker   = null;
  }

  /* ─── خريطة تحديد الإحداثيات داخل المودال ───────────────────────────── */
  _initDrawMap(initialLat, initialLng) {
    if (this.drawMap) { try { this.drawMap.remove(); } catch {} this.drawMap = null; }
    this.drawMap = typeof createUnifiedMap === 'function'
      ? createUnifiedMap('sam-dmap', [initialLat, initialLng], 14)
      : L.map('sam-dmap').setView([initialLat, initialLng], 14);

    if (typeof createUnifiedMap !== 'function') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© بلدية كفرنجة', maxZoom: 19
      }).addTo(this.drawMap);
    }

    this.drawLayer = L.featureGroup().addTo(this.drawMap);

    this._marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(this.drawLayer);

    const updateInputs = (lat, lng) => {
      const latEl = document.getElementById('sam-f-lat');
      const lngEl = document.getElementById('sam-f-lng');
      const txtEl = document.getElementById('sam-coords-text');
      if (latEl) latEl.value = lat.toFixed(6);
      if (lngEl) lngEl.value = lng.toFixed(6);
      if (txtEl) txtEl.textContent = `${lat.toFixed(5)} , ${lng.toFixed(5)}`;
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
      if (this.drawMap && this._marker) {
        this.drawMap.setView([lat, lng], 16);
        this._marker.setLatLng([lat, lng]);
        document.getElementById('sam-f-lat').value = lat.toFixed(6);
        document.getElementById('sam-f-lng').value = lng.toFixed(6);
        document.getElementById('sam-coords-text').textContent = `${lat.toFixed(5)} , ${lng.toFixed(5)}`;
        this._toast('📍 تم تحديد موقعك الجغرافي بنجاح.');
      }
    }, () => {
      this._toast('⚠️ تعذر الحصول على الإحداثيات الجغرافية.');
    });
  }

  /* ─── حفظ الأصل الإنشائي ─────────────────────────────────────────── */
  async _saveAsset() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const id = gv('sam-f-id'), name = gv('sam-f-name');
    if (!id || !name) { this._toast('⚠️ كود الأصل واسمه إلزاميان.'); return; }

    const rawType = gv('sam-f-type');
    const isWall = rawType.includes('WALL') || name.includes('جدار');

    const pciVal = parseFloat(gv('sam-f-pci')) || 85;
    const validatedPci = Math.min(100, Math.max(0, pciVal));

    const payload = {
      id,
      assetType:       rawType,
      category:        isWall ? 'WALL' : 'BUILDING',
      subType:         rawType,
      name,
      district:        gv('sam-f-district') || 'كفرنجة',
      heightMeters:    parseFloat(gv('sam-f-height')) || 0,
      floorsCount:     parseInt(gv('sam-f-floors')) || 0,
      conditionIndex:  validatedPci,
      lat:             parseFloat(gv('sam-f-lat')) || 32.3301,
      lng:             parseFloat(gv('sam-f-lng')) || 35.7501,
      notes:           gv('sam-f-notes')
    };

    const btn = document.getElementById('sam-msave');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }

    try {
      try {
        if (typeof apiFetch === 'function') {
          await apiFetch('/v4/assets/structural', { method:'POST', body: JSON.stringify(payload) });
        } else {
          await fetch('/api/v4/assets/structural', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
          });
        }
      } catch (netErr) {
        console.warn('⚠️ Structural asset server save fallback:', netErr.message);
      }

      const newObj = {
        id: payload.id,
        name: payload.name,
        category: payload.category,
        sub_type: payload.subType,
        asset_type: payload.assetType,
        district: payload.district,
        height_meters: payload.heightMeters,
        floors_count: payload.floorsCount,
        structural_condition_index: payload.conditionIndex,
        condition_index: payload.conditionIndex,
        conditionIndex: payload.conditionIndex,
        lat: payload.lat,
        lng: payload.lng,
        notes: payload.notes,
        geojson: { type: 'Point', coordinates: [payload.lng, payload.lat] },
        created_at: new Date().toISOString()
      };

      this.activeData = this.activeData.filter(x => String(x.id) !== String(newObj.id));
      this.activeData.unshift(newObj);
      this._saveLocalCache();

      this._toast('✅ تم حفظ بيانات الأصل الإنشائي والموقع الجغرافي بنجاح.');
      this._closeModal();
      this._applyFilterAndRender();
    } catch (err) {
      this._toast('❌ خطأ في الحفظ: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ الأصل الإنشائي'; }
    }
  }

  /* ─── حذف الأصل ─────────────────────────────────────────────────── */
  async _deleteAsset(assetId) {
    const item = this.activeData.find(x => String(x.id) === String(assetId));
    const name = item?.name || assetId;
    if (!confirm(`⚠️ تأكيد حذف الأصل الإنشائي "${name}" نهائياً من النظام؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      if (typeof apiFetch === 'function') {
        await apiFetch(`/v4/assets/structural/${assetId}`, { method:'DELETE' });
      } else {
        await fetch(`/api/v4/assets/structural/${assetId}`, { method:'DELETE' });
      }
    } catch (err) {}
    this.activeData = this.activeData.filter(x => String(x.id) !== String(assetId));
    this._saveLocalCache();
    this._toast(`🗑️ تم حذف الأصل "${name}" بنجاح.`);
    this._applyFilterAndRender();
  }

  /* ─── تصدير ملف Excel مهيكل في الخلايا ────────────────────────────── */
  _exportCSV() {
    if (!this.activeData.length) {
      this._toast('⚠️ لا توجد بيانات للتصدير.');
      return;
    }

    const headers = ['رمز الأصل', 'اسم المنشأة/الجدار', 'التصنيف', 'المنطقة/الحي', 'الارتفاع (م)', 'الطوابق', 'مؤشر السلامة (PCI)', 'الحالة الإنشائية', 'خط العرض', 'خط الطول', 'تاريخ التسجيل', 'ملاحظات'];
    
    const rows = this.activeData.map(r => {
      const pci = parseFloat(r.condition_index || r.conditionIndex || r.structural_condition_index || 85);
      const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
      return [
        r.id || '',
        r.name || '',
        isWall ? 'جدار استنادي' : 'مبنى بلدي',
        r.district || 'كفرنجة',
        r.height_meters || '—',
        r.floors_count || '—',
        `${pci}%`,
        pci >= 85 ? 'ممتازة / آمن' : pci >= 60 ? 'متوسطة / صيانة' : 'حرجة / تدعيم',
        r.lat || '',
        r.lng || '',
        r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : '',
        r.notes || ''
      ];
    });

    if (typeof window.exportToExcelFile === 'function') {
      window.exportToExcelFile({
        filename: 'سجل_الأبنية_والجدران_الاستنادية_بلدية_كفرنجة',
        title: 'سجل الأبنية والمرافق والجدران الاستنادية',
        subtitle: 'مديرية الأشغال والخدمات الهندسية — شعبة الأصول الإنشائية',
        headers,
        rows,
        totals: ['الإجمالي', `${this.activeData.length} أصل`, '', '', '', '', '', '', '', '', '', '']
      });
      this._toast('📊 تم تصدير ملف Excel المنظم بنجاح.');
    }
  }

  /* ─── طباعة تقرير أصل إنشائي فردي ─────────────────────────────────── */
  _printAsset(assetId) {
    const r = this.activeData.find(x => String(x.id) === String(assetId));
    if (!r) { this._toast('⚠️ لم يُعثر على بيانات الأصل الإنشائي.'); return; }

    const pci = parseFloat(r.condition_index || r.conditionIndex || r.structural_condition_index || 85);
    const clr = pci >= 85 ? '#059669' : pci >= 60 ? '#d97706' : '#dc2626';
    const bgBadge = pci >= 85 ? '#ecfdf5' : pci >= 60 ? '#fffbeb' : '#fef2f2';
    const lbl = pci >= 85 ? 'حالة آمنة — سلامة هيكلية ممتازة' : pci >= 60 ? 'حالة متوسطة — تحتاج صيانة وقائية وتكحيل' : 'حالة حرجة — خطورة انزلاق وتشققات تقتضي التدعيم الفوري';
    const rec = pci >= 85 ? 'الفحص الدوري المستمر والتأكد من سلامة مصارف مياه الأمطار خلف المنشأة ونظافة المزاريب.'
               : pci >= 60 ? 'تكحيل الفواصل الإنشائية، معالجة التشققات الشعرية، ومراقبة فواصل التمدد والهبوط.'
               : 'بناء دعامات خرسانية مسلحة إضافية، عمل تحويلات مرورية فورية، والبدء بإعادة تأهيل المنشأة.';

    const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
    const typeLabel = isWall ? 'جدار استنادي خرساني / حجري (Retaining Wall)' : 'مبنى / منشأة بلدية (Municipal Facility)';

    const summary = `
      <div style="margin:16px 0;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #cbd5e1;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="color:#1e3a8a;font-size:0.92rem;">📊 تقييم السلامة الإنشائية ومؤشر الحالة (Structural Condition Index)</b>
          <span style="background:${bgBadge};color:${clr};border:1px solid ${clr};padding:3px 10px;border-radius:6px;font-weight:bold;font-size:0.85rem;">${lbl}</span>
        </div>
        <div style="margin:10px 0;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;height:16px;background:#e2e8f0;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;">
            <div style="width:${pci}%;height:100%;background:${clr};border-radius:8px;transition:width 0.4s;"></div>
          </div>
          <b style="color:${clr};font-size:1.15rem;min-width:70px;text-align:left;">${pci} / 100</b>
        </div>
        <div style="margin-top:10px;font-size:0.86rem;line-height:1.7;color:#1e293b;background:#ffffff;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <b style="color:#1e3a8a;">📌 التوصية الفنية المعتمدة للمهندس المشرف:</b> ${rec}
          ${r.notes ? `<div style="margin-top:4px;color:#475569;"><b>ملاحظات الفحص الميداني:</b> ${r.notes}</div>` : ''}
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'تقرير المعاينة الفنية وتقييم السلامة الإنشائية',
        subtitle:  'المملكة الأردنية الهاشمية — بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية',
        refNumber: `STR-${r.id}-${new Date().getFullYear()}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخطط الموقع المكاني GIS + تقرير الفحص الميداني',
        type:      'single',
        fields: [
          { label: 'اسم الأصل / المنشأة',  value: r.name || '—' },
          { label: 'رمز الأصل الجغرافي',  value: r.id || '—' },
          { label: 'تصنيف الأصل الإنشائي', value: typeLabel },
          { label: 'المنطقة / الحي',       value: r.district || 'كفرنجة' },
          { label: 'الارتفاع الإجمالي',    value: r.height_meters ? `${r.height_meters} م` : '—' },
          { label: 'عدد الطوابق الإنشائية', value: r.floors_count ? `${r.floors_count} طوابق` : '—' },
          { label: 'الموقع المكاني (GIS)',  value: (r.lat && r.lng) ? `${Number(r.lat).toFixed(5)} , ${Number(r.lng).toFixed(5)}` : 'GIS Verified' },
          { label: 'مؤشر التقييم الإنشائي', value: `${pci} / 100` },
          { label: 'الحالة الهيكلية العامة', value: lbl },
          { label: 'تاريخ التوثيق والتسجيل', value: r.created_at ? new Date(r.created_at).toLocaleDateString('ar-JO') : new Date().toLocaleDateString('ar-JO') }
        ],
        summaryHtml: summary,
        signatures: true
      });
    } else {
      window.print();
    }
  }

  /* ─── طباعة السجل الشامل للأصول الإنشائية ────────────────────────── */
  _printAll() {
    const data = this.activeData;
    if (!data.length) { this._toast('⚠️ لا توجد بيانات للطباعة.'); return; }

    const bCount = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('BUILDING') || (a.name || '').includes('مبنى')).length;
    const wCount = data.filter(a => (a.asset_type || a.assetType || a.category || '').toUpperCase().includes('WALL') || (a.name || '').includes('جدار')).length;
    const avgPci = (data.reduce((s, a) => s + parseFloat(a.condition_index || a.conditionIndex || a.structural_condition_index || 85), 0) / data.length).toFixed(1);
    const urgent = data.filter(a => parseFloat(a.condition_index || a.conditionIndex || a.structural_condition_index || 85) < 60).length;

    const kpiHtml = `
      <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:12px;margin:14px 0 18px 0;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#059669;">${data.length}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">إجمالي الأصول</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#1d4ed8;">${bCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">المباني والمرافق</div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#d97706;">${wCount}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">الجدران الاستنادية</div>
        </div>
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#7c3aed;">${avgPci}%</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">متوسط السلامة</div>
        </div>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
          <div style="font-size:1.35rem;font-weight:bold;color:#dc2626;">${urgent}</div>
          <div style="font-size:0.78rem;color:#374151;font-weight:600;">تحتاج تدعيماً عاجلاً</div>
        </div>
      </div>`;

    if (typeof printStandardDocument === 'function') {
      printStandardDocument({
        title:     'سجل حصر وجرد الأبنية والمنشآت والجدران الاستنادية',
        subtitle:  'كشف الرصد الإنشائي والمكاني المعتمد — بلدية كفرنجة الجديدة',
        refNumber: `STR-INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date:      new Date().toLocaleDateString('ar-JO'),
        attachments: 'مخططات الإسناد الجغرافي GIS',
        type:      'list',
        summaryHtml: kpiHtml,
        data: data.map(r => {
          const pci = parseFloat(r.condition_index || r.conditionIndex || r.structural_condition_index || 85);
          const isWall = (r.asset_type || r.assetType || r.category || '').toUpperCase().includes('WALL') || (r.name || '').includes('جدار');
          return {
            id:       r.id,
            name:     r.name || '—',
            type:     isWall ? 'جدار استنادي' : 'مبنى / مرفق',
            district: r.district || 'كفرنجة',
            height:   r.height_meters ? `${r.height_meters} م` : (r.floors_count ? `${r.floors_count} طابق` : '—'),
            pci:      `${pci}%`,
            cond:     pci >= 85 ? 'ممتازة / آمنة' : pci >= 60 ? 'متوسطة / صيانة' : 'حرجة / تدعيم'
          };
        }),
        columns: [
          { key:'id',       label:'رمز الأصل' },
          { key:'name',     label:'اسم المنشأة / الجدار' },
          { key:'type',     label:'التصنيف' },
          { key:'district', label:'المنطقة / الحي' },
          { key:'height',   label:'الارتفاع / الطوابق' },
          { key:'pci',      label:'التقييم الإنشائي' },
          { key:'cond',     label:'الحالة والسلامة' }
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
    return `AST-${y}-${String(this.activeData.length + 1).padStart(3,'0')}`;
  }

  _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[SAMS]', msg);
  }
}

/* ── تسجيل الكلاس والدوال الموحدة ─────────────────────────────────── */
if (typeof window !== 'undefined') {
  window.ComprehensiveStructuralManager = ComprehensiveStructuralManager;
  window.structuralManager = null;

  window.loadStructuralAssets = async function() {
    const container = document.getElementById('structural-tab-container');
    if (!container) return;
    try {
      if (window.structuralManager && container.children.length > 0) {
        setTimeout(() => {
          if (window.structuralManager.map) window.structuralManager.map.invalidateSize();
          if (typeof window.structuralManager._applyFilterAndRender === 'function') {
            window.structuralManager._applyFilterAndRender();
          }
        }, 150);
        return;
      }
      container.innerHTML = '';
      window.structuralManager = new ComprehensiveStructuralManager('structural-tab-container');
    } catch (e) {
      console.error('loadStructuralAssets error:', e);
      container.innerHTML = `<div style="padding:20px;color:#f87171;text-align:center;">❌ ${e.message}</div>`;
    }
  };

  window.openNewStructuralAssetModal = function() {
    if (window.structuralManager && typeof window.structuralManager._openModal === 'function') {
      window.structuralManager._openModal(null);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveStructuralManager;
}
