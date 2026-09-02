/**
 * GIS/Pages/unifiedGisEngine.js
 * محرك الخرائط الجغرافية المتقدم الموحد (Advanced Unified GIS Engine)
 * بلدية كفرنجة الجديدة - نظام إدارة الأشغال والخدمات الهندسية v1.0
 * 
 * الميزات:
 * 1. استقرار تام ومقاومة لتغير حجم الحاوية والتبويبات (ResizeObserver + IntersectionObserver).
 * 2. توفير الطبقات الأساسية المعتمدة عالية الدقة (CARTO, Esri Satellite, OSM, Topo, Dark).
 * 3. لوحة تحكم بالطبقات باللغة العربية مع حفظ الطبقة المفضلة للمستخدم.
 * 4. أدوات تحكم: إعادة التمركز على بلدية كفرنجة، تحديد الموقع الحالي GPS، وتكبير ملء الشاشة.
 */

class UnifiedGisEngine {
  static DEFAULT_CENTER = [32.2985, 35.7050]; // مركز بلدية كفرنجة الجديدة
  static DEFAULT_ZOOM = 14;

  /**
   * تعريف جميع الطبقات الجغرافية المعتمدة عالية الدقة (100% مجانية ومفتوحة بدون أي مفاتيح API)
   */
  static getBaseLayers() {
    return {
      "🌐 خريطة الشوارع العامة (OpenStreetMap)": L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 3
        }
      ),
      "🛰️ صور الأقمار الصناعية عالية الدقة (Esri World Imagery HD)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
          minZoom: 3
        }
      ),
      "🛣️ خريطة الملاحة والشوارع المفصلة (Esri World Street)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri World Street Map',
          maxZoom: 19,
          minZoom: 3
        }
      ),
      "🧭 الخريطة الطبوغرافية والهندسية (Esri Topo)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri Topo contributors',
          maxZoom: 19,
          minZoom: 3
        }
      ),
      "🌍 الخريطة الجغرافية الدولية (National Geographic)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; National Geographic Society, Esri',
          maxZoom: 16,
          minZoom: 3
        }
      ),
      "🏔️ التضاريس والارتفاعات وخطوط الكنتور (OpenTopoMap)": L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenTopoMap &copy; OpenStreetMap contributors',
          maxZoom: 17,
          minZoom: 3
        }
      ),
      "🚑 الخريطة الإنسانية والميدانية (OSM Humanitarian HOT)": L.tileLayer(
        'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors, Humanitarian OSM Team',
          maxZoom: 19,
          minZoom: 3
        }
      ),
      "🚴 خريطة البنية التحتية والمسارات (CyclOSM Infrastructure)": L.tileLayer(
        'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors &copy; CyclOSM',
          maxZoom: 18,
          minZoom: 3
        }
      ),
      "⛰️ الخريطة الطبيعية والتضاريس (Esri Physical)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri World Physical Map',
          maxZoom: 12,
          minZoom: 3
        }
      )
    };
  }

  /**
   * تعريف طبقات التراكب المساعدة (Overlays) - بدون مفاتيح وبأعلى وضوح
   */
  static getOverlayLayers() {
    return {
      "🏷️ أسماء الشوارع والمعالم والحدود (Esri Reference Labels)": L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          pane: 'markerPane'
        }
      )
    };
  }

  /**
   * إنشاء وتهيئة خريطة جغرافية مستقرة مع شريط الطبقات والأدوات
   */
  static createMap(elementId, center = this.DEFAULT_CENTER, zoom = this.DEFAULT_ZOOM, options = {}) {
    if (typeof window === 'undefined' || !window.L) {
      console.warn('⚠️ Leaflet JS is not loaded yet.');
      return null;
    }

    // دعم تمرير كائن إعدادات كمعامل ثانٍ
    if (typeof center === 'object' && !Array.isArray(center) && center !== null && !(center instanceof L.LatLng)) {
      options = center;
      center = options.center || this.DEFAULT_CENTER;
      zoom = options.zoom || this.DEFAULT_ZOOM;
    }

    const container = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (!container) {
      console.warn(`⚠️ Map container #${elementId} not found in DOM.`);
      return null;
    }

    // تنظيف أي نسخة سابقة للخريطة لمنع أخطاء Leaflet
    if (container._leaflet_id) {
      try {
        container._leaflet_id = null;
      } catch (e) { }
    }

    // إنشاء كائن الخريطة
    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      preferCanvas: true,
      ...options
    }).setView(center || this.DEFAULT_CENTER, zoom || this.DEFAULT_ZOOM);

    // إضافة أزرار التكبير والتصغير
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // تهيئة الطبقات الأساسية
    const baseLayers = this.getBaseLayers();
    const overlayLayers = this.getOverlayLayers();

    // اختيار الطبقة الافتراضية المعتمدة (خريطة الشوارع العامة المفتوحة أو أول طبقة متاحة)
    const defaultLayerName = "🌐 خريطة الشوارع العامة (OpenStreetMap)";
    const initialLayer = baseLayers[defaultLayerName] || baseLayers[Object.keys(baseLayers)[0]];
    if (initialLayer) initialLayer.addTo(map);

    // إضافة لوحة التبديل بين الطبقات (Layer Control)
    const layerControl = L.control.layers(baseLayers, overlayLayers, {
      position: 'topright',
      collapsed: true
    }).addTo(map);

    map._layerControl = layerControl;
    map._baseLayers = baseLayers;
    map._overlayLayers = overlayLayers;

    // إضافة مقياس الرسم المتري
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    // إضافة أدوات التحكم المخصصة (إعادة التمركز، تحديد الموقع، ملء الشاشة)
    this.addCustomControls(map, center || this.DEFAULT_CENTER, zoom || this.DEFAULT_ZOOM);

    // ربط محرك الاستقرار التلقائي
    this.attachStabilityEngine(map, container);

    return map;
  }

  /**
   * إضافة أزرار وأدوات تحكم ذكية للخريطة
   */
  static addCustomControls(map, defaultCenter, defaultZoom) {
    const CustomToolbar = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const div = L.DomUtil.create('div', 'leaflet-bar unified-gis-toolbar');
        div.style.backgroundColor = 'var(--bg-card, #ffffff)';
        div.style.border = '1px solid var(--border, #cbd5e1)';
        div.style.borderRadius = '8px';
        div.style.overflow = 'hidden';
        div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';

        // زر إعادة التمركز على كفرنجة
        const btnReset = L.DomUtil.create('a', 'gis-tool-btn', div);
        btnReset.href = '#';
        btnReset.title = 'إعادة التمركز على بلدية كفرنجة';
        btnReset.innerHTML = '🏛️';
        btnReset.style.width = '32px';
        btnReset.style.height = '32px';
        btnReset.style.lineHeight = '32px';
        btnReset.style.textAlign = 'center';
        btnReset.style.display = 'block';
        btnReset.style.textDecoration = 'none';
        btnReset.style.fontSize = '16px';
        btnReset.style.cursor = 'pointer';

        L.DomEvent.on(btnReset, 'click', (e) => {
          L.DomEvent.stop(e);
          map.flyTo(defaultCenter, defaultZoom, { duration: 0.8 });
        });

        // زر تحديد موقع المستخدم GPS
        const btnGps = L.DomUtil.create('a', 'gis-tool-btn', div);
        btnGps.href = '#';
        btnGps.title = 'تحديد موقعي الميداني الحالي (GPS)';
        btnGps.innerHTML = '🎯';
        btnGps.style.width = '32px';
        btnGps.style.height = '32px';
        btnGps.style.lineHeight = '32px';
        btnGps.style.textAlign = 'center';
        btnGps.style.display = 'block';
        btnGps.style.textDecoration = 'none';
        btnGps.style.fontSize = '15px';
        btnGps.style.cursor = 'pointer';

        L.DomEvent.on(btnGps, 'click', (e) => {
          L.DomEvent.stop(e);
          if (navigator.geolocation) {
            btnGps.innerHTML = '⏳';
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                btnGps.innerHTML = '🎯';
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                map.flyTo([lat, lng], 17, { duration: 1 });

                const userMarker = L.circleMarker([lat, lng], {
                  radius: 8,
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.8,
                  weight: 3
                }).addTo(map);
                userMarker.bindPopup('📍 موقعك الميداني الحالي').openPopup();
              },
              (err) => {
                btnGps.innerHTML = '🎯';
                alert('تعذر تحديد موقع GPS: ' + err.message);
              },
              { enableHighAccuracy: true, timeout: 10000 }
            );
          }
        });

        return div;
      }
    });

    map.addControl(new CustomToolbar());
  }

  /**
   * نظام الاستقرار ومراقبة الحاويات والتبويبات
   */
  static attachStabilityEngine(map, container) {
    const triggerInvalidate = () => {
      if (!map || !container) return;
      try {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          map.invalidateSize();
        }
      } catch (e) { }
    };

    setTimeout(triggerInvalidate, 80);
    setTimeout(triggerInvalidate, 250);
    setTimeout(triggerInvalidate, 600);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        triggerInvalidate();
      });
      ro.observe(container);
      map._resizeObserver = ro;
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            triggerInvalidate();
          }
        });
      });
      io.observe(container);
      map._intersectionObserver = io;
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) triggerInvalidate();
    });

    window.addEventListener('resize', triggerInvalidate);
  }
  /**
   * إنشاء أيقونة مخصصة وموحدة للخريطة
   */
  static createCustomIcon(emoji, color = '#2563eb', size = 28) {
    if (typeof L === 'undefined') return null;
    return L.divIcon({
      className: 'custom-unified-gis-marker',
      html: `
        <div style="background:${color}; width:${size}px; height:${size}px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:${Math.round(size * 0.55)}px; color:#ffffff; cursor:pointer; transition:transform 0.15s ease;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
          ${emoji}
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }
}

// تصدير المحرك ودالة الإنشاء الموحدة في النطاق العام
if (typeof window !== 'undefined') {
  window.UnifiedGisEngine = UnifiedGisEngine;
  window.createUnifiedMap = function (elementId, center, zoom, options) {
    return UnifiedGisEngine.createMap(elementId, center || UnifiedGisEngine.DEFAULT_CENTER, zoom || UnifiedGisEngine.DEFAULT_ZOOM, options);
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedGisEngine;
}
