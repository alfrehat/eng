/**
 * Road Asset Management System (RAMS) - Interactive Map & Dashboard
 * Vanilla CSS Responsive Platform
 */

class RamsDashboardController {
  constructor(containerId) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;
    this.map = null;
    this.layers = {
      roadsPolyline: L.featureGroup(),
      segmentsLayer: L.layerGroup(),
      intersectionsLayer: L.layerGroup(),
      heatMapLayer: L.layerGroup(),
      clusterGroup: (typeof L !== 'undefined' && L.markerClusterGroup) ? L.markerClusterGroup() : L.layerGroup()
    };
    this.initUI();
  }

  initUI() {
    this.container.innerHTML = `
      <style>
        .rams-platform-wrapper {
          background:var(--bg-card);
          color: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          direction: rtl;
          font-family: 'Tajawal', 'Cairo', sans-serif;
          margin-top: 10px;
        }
        .rams-toolbar {
          background:var(--bg-surface);
          padding: 12px 16px;
          border-radius: 8px;
          border:1px solid var(--border);
          margin-bottom: 16px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .rams-toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .rams-title {
          font-size: 0.85rem;
          font-weight: bold;
          color: #38bdf8;
        }
        .rams-btn-snap {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.2s;
          font-family: 'Tajawal', sans-serif;
        }
        .rams-btn-snap:hover { background: #1d4ed8; }
        .rams-btn-buffer {
          background: #7c3aed;
          color: #ffffff;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.2s;
          font-family: 'Tajawal', sans-serif;
        }
        .rams-btn-buffer:hover { background: #6d28d9; }
        .rams-input-search {
          background:var(--bg-surface);
          color: #ffffff;
          border: 1px solid #475569;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          width: 240px;
          font-family: 'Tajawal', sans-serif;
        }
        .rams-input-search:focus { outline: none; border-color: #38bdf8; }
        .rams-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .rams-kpi-card {
          padding: 14px;
          border-radius: 8px;
          font-size: 0.85rem;
        }
        .rams-kpi-card.excellent {
          background: rgba(6, 78, 59, 0.5);
          border: 1px solid #10b981;
        }
        .rams-kpi-card.fair {
          background: rgba(120, 53, 15, 0.5);
          border: 1px solid #f59e0b;
        }
        .rams-kpi-card.poor {
          background: rgba(136, 19, 55, 0.5);
          border: 1px solid #ef4444;
        }
        .rams-kpi-card.projects {
          background: rgba(30, 58, 138, 0.5);
          border: 1px solid #3b82f6;
        }
        .rams-kpi-label {
          display: block;
          font-size: 0.75rem;
          margin-bottom: 4px;
        }
        .rams-kpi-card.excellent .rams-kpi-label { color: #6ee7b7; }
        .rams-kpi-card.fair .rams-kpi-label { color: #fde68a; }
        .rams-kpi-card.poor .rams-kpi-label { color: #fca5a5; }
        .rams-kpi-card.projects .rams-kpi-label { color: #93c5fd; }
        .rams-kpi-val {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 0;
        }
        .rams-kpi-card.excellent .rams-kpi-val { color: #a7f3d0; }
        .rams-kpi-card.fair .rams-kpi-val { color: #fef08a; }
        .rams-kpi-card.poor .rams-kpi-val { color: #fecdd3; }
        .rams-kpi-card.projects .rams-kpi-val { color: #bfdbfe; }
        .rams-main-grid {
          display: grid;
          grid-template-columns: 3fr 1fr;
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .rams-main-grid { grid-template-columns: 1fr; }
        }
        .rams-map-box {
          background: #020617;
          border:1px solid var(--border);
          padding: 6px;
          border-radius: 8px;
          position: relative;
        }
        #rams-interactive-map {
          width: 100%;
          height: 520px;
          border-radius: 6px;
          z-index: 1;
        }
        .rams-details-box {
          background:var(--bg-surface);
          border:1px solid var(--border);
          padding: 14px;
          border-radius: 8px;
          max-height: 532px;
          overflow-y: auto;
          font-size: 0.85rem;
        }
        .rams-details-header {
          font-weight: bold;
          color: #38bdf8;
          border-bottom:1px solid var(--border);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .rams-detail-sec {
          background:var(--bg-card);
          padding: 10px;
          border-radius: 6px;
          border:1px solid var(--border);
          margin-top: 8px;
        }
      </style>

      <div class="rams-platform-wrapper">
        <!-- Toolbar -->
        <div class="rams-toolbar">
          <div class="rams-toolbar-left">
            <span class="rams-title">🛣️ منصة RAMS للتحليل المكاني وإدارة أصول الطرق:</span>
            <button id="btn-snap-road" class="rams-btn-snap">🧲 أداة Snap إلى الشارع والرسم (Polyline)</button>
            <button id="btn-buffer-analyze" class="rams-btn-buffer">⭕ تحليل النطاق (Buffer 500m)</button>
          </div>
          <div>
            <input type="text" id="rams-geo-search" placeholder="🔍 البحث الجغرافي أو كود الطريق..." class="rams-input-search" />
          </div>
        </div>

        <!-- KPIs Row -->
        <div class="rams-kpi-grid">
          <div class="rams-kpi-card excellent">
            <span class="rams-kpi-label">ممتازة (PCI 85-100)</span>
            <p class="rams-kpi-val" id="rams-kpi-excellent">62.4 كم</p>
          </div>
          <div class="rams-kpi-card fair">
            <span class="rams-kpi-label">متوسطة (PCI 60-84)</span>
            <p class="rams-kpi-val" id="rams-kpi-fair">28.1 كم</p>
          </div>
          <div class="rams-kpi-card poor">
            <span class="rams-kpi-label">متدهورة / طرق متعثرة (PCI < 60)</span>
            <p class="rams-kpi-val" id="rams-kpi-poor">12.5 كم</p>
          </div>
          <div class="rams-kpi-card projects">
            <span class="rams-kpi-label">مشاريع الصيانة الجارية</span>
            <p class="rams-kpi-val" id="rams-kpi-projects">8 مشاريع قيد التنفيذ</p>
          </div>
        </div>

        <!-- Main Map & Side Panel Grid -->
        <div class="rams-main-grid">
          <div class="rams-map-box">
            <div id="rams-interactive-map"></div>
          </div>
          <div class="rams-details-box" id="rams-side-details">
            <div class="rams-details-header">📋 بيانات الطريق والمقاطع المحددة</div>
            <p style="color: #94a3b8; text-align: center; padding: 24px 0;">اختر طريقاً من الخريطة لاستعراض المقاطع، المرور AADT، وسجل الصيانة والمقاولين...</p>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => this.initMapEngine(), 100);
  }

  initMapEngine() {
    const mapEl = document.getElementById('rams-interactive-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.map = UnifiedGisEngine.createMap('rams-interactive-map', [32.2985, 35.7050], 14);
    } else {
      this.map = typeof createUnifiedMap === 'function'
        ? createUnifiedMap('rams-interactive-map', [32.2985, 35.7050], 14)
        : L.map('rams-interactive-map').setView([32.2985, 35.7050], 14);
      const satelliteEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri Satellite' });
      L.control.layers({ "الخريطة المعتمدة": this.map._layers[Object.keys(this.map._layers)[0]], "صورة الأقمار الصناعية": satelliteEsri }).addTo(this.map);
    }

    Object.values(this.layers).forEach(layer => layer.addTo(this.map));

    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 300);

    this.loadRamsRoadsLayer();
  }

  async loadRamsRoadsLayer() {
    try {
      const res = await fetch('/api/v4/rams/roads');
      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        this.layers.roadsPolyline.clearLayers();
        data.data.forEach(road => {
          if (road.geometry_json) {
            const geojson = typeof road.geometry_json === 'string' ? JSON.parse(road.geometry_json) : road.geometry_json;
            const pci = road.pci_index || 80;
            const color = pci >= 85 ? '#10b981' : (pci >= 60 ? '#f59e0b' : '#ef4444');
            const line = L.geoJSON(geojson, { style: { color: color, weight: 6, opacity: 0.9 } });
            line.on('click', () => this.displayRoadFullLifecycle(road));
            this.layers.roadsPolyline.addLayer(line);
          }
        });
      }
    } catch (err) {
      console.warn('تنبيه جلب طبقات الطرق:', err);
    }
  }

  displayRoadFullLifecycle(road) {
    const detailsContainer = document.getElementById('rams-side-details');
    if (!detailsContainer) return;

    detailsContainer.innerHTML = `
      <div style="direction: rtl;">
        <h3 style="font-size: 1rem; font-weight: bold; color: #38bdf8; margin: 0 0 10px 0;">${road.name}</h3>
        
        <div class="rams-detail-sec">
          <div>كود الطريق: <strong>${road.code || road.id}</strong></div>
          <div>التصنيف: <strong>${road.category || 'رئيسي'}</strong></div>
          <div>الطول: <strong>${road.length_km || 1.2} كم</strong> | العرض: <strong>${road.width_m || 10} م</strong></div>
          <div>مؤشر PCI الحالي: <strong style="color: #f59e0b;">${road.pci_index || 72}</strong></div>
          <div>المرور اليومي (AADT): <strong>${road.aadt_volume || 3500} سيارة/يوم</strong></div>
        </div>

        <div style="font-weight: bold; color: #f59e0b; border-bottom:1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">⛓️ المقاطع التقسيمية (Chainage)</div>
        <div class="rams-detail-sec">
          <div>المقطع 1: KM 0+000 ➔ KM 0+600 (حالة ممتازة)</div>
          <div>المقطع 2: KM 0+600 ➔ KM 1+200 (تحتاج كشط وتعبيد)</div>
        </div>

        <div style="font-weight: bold; color: #10b981; border-bottom:1px solid var(--border); padding-bottom: 4px; margin-top: 12px;">🏗️ المشاريع والعقود المرتبطة</div>
        <div class="rams-detail-sec">
          <div>مشروع تعبيد كفرنجة (T-2026-001)</div>
          <div>المقاول: شركة الأشغال الأردنية</div>
          <div>الكلفة: 45,000 دينار</div>
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.RamsDashboardController = RamsDashboardController;
}

module.exports = RamsDashboardController;
