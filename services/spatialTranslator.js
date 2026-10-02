/**
 * services/spatialTranslator.js
 * 🗺️ محرك التحليل المكاني والترجمة الجغرافية البديلة (SPATIAL_GIS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Spatial Fallback Patch
 */

const { logInfo, logWarn, logError } = require('./loggerService');

class SpatialTranslatorService {
  constructor() {
    this.engineId = 'SPATIAL_GIS_ENGINE';
    this.engineName = 'Enterprise Spatial Analysis & PostGIS Fallback Engine';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'haversine_distance',
      'point_to_linestring_distance',
      'universal_coordinate_parsing',
      'spatial_bounding_box',
      'balanced_sql_translation',
      'proximity_filtering'
    ];
    this.EARTH_RADIUS_METERS = 6371000; // نصف قطر الأرض المعياري بالمتر

    // ربط الدوال لضمان الأمان الكامل عند تفكيك الخصائص (Destructuring) أو التمرير كـ Callback
    this.parsePoint = this.parsePoint.bind(this);
    this.calculateHaversineDistance = this.calculateHaversineDistance.bind(this);
    this.calculateDistanceMeters = this.calculateDistanceMeters.bind(this);
    this.calculatePointToLineStringDistance = this.calculatePointToLineStringDistance.bind(this);
    this.isWithinDistance = this.isWithinDistance.bind(this);
    this.calculateSpatialBufferBoundingBox = this.calculateSpatialBufferBoundingBox.bind(this);
    this.translateSpatialQuery = this.translateSpatialQuery.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ تحليل واستخلاص الإحداثيات الشامل (Universal Coordinate Parser)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استخراج نقطة جغرافية نقية { lat, lon } من أي صيغة مدخلة
   */
  parsePoint(p) {
    if (!p) return null;

    // 1. معالجة النصوص المشفرة أو صيغ WKT
    if (typeof p === 'string') {
      const trimmed = p.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return this.parsePoint(JSON.parse(trimmed));
        } catch (e) {
          return null;
        }
      }
      // دعم WKT: POINT(lon lat)
      const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        return this._sanitizeCoords(parseFloat(match[2]), parseFloat(match[1]));
      }
      return null;
    }

    // 2. معالجة كائنات GeoJSON القياسية { type: "Point", coordinates: [lon, lat] }
    if (typeof p === 'object' && p.type === 'Point' && Array.isArray(p.coordinates)) {
      return this._sanitizeCoords(p.coordinates[1], p.coordinates[0]);
    }

    // 3. معالجة المصفوفات [lon, lat] أو [lat, lon]
    if (Array.isArray(p) && p.length >= 2) {
      const v0 = parseFloat(p[0]);
      const v1 = parseFloat(p[1]);
      if (isNaN(v0) || isNaN(v1)) return null;

      // تمييز ذكي لإحداثيات الأردن (خط العرض ~32، خط الطول ~35)
      if (v0 >= 28 && v0 <= 34 && v1 >= 34 && v1 <= 40) {
        return this._sanitizeCoords(v0, v1); // ممررة [lat, lon]
      }
      // الترتيب الجغرافي المعياري العالمي للـ GeoJSON هو [lon, lat]
      return this._sanitizeCoords(v1, v0);
    }

    // 4. معالجة الكائنات المسطحة { lat, lng } / { latitude, longitude }
    if (typeof p === 'object') {
      const lat = parseFloat(p.lat !== undefined ? p.lat : p.latitude);
      const lon = parseFloat(p.lng !== undefined ? p.lng : (p.longitude !== undefined ? p.longitude : p.lon));
      if (!isNaN(lat) && !isNaN(lon)) {
        return this._sanitizeCoords(lat, lon);
      }
    }

    return null;
  }

  /**
   * تقييد وتطهير الإحداثيات ضمن النطاق الفيزيائي للكرة الأرضية
   */
  _sanitizeCoords(lat, lon) {
    if (isNaN(lat) || isNaN(lon)) return null;
    const clampedLat = Math.max(-90, Math.min(90, lat));
    let clampedLon = lon % 360;
    if (clampedLon > 180) clampedLon -= 360;
    if (clampedLon < -180) clampedLon += 360;
    return { lat: clampedLat, lon: clampedLon };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ الحسابات المكانية والمسافات (Haversine & LineString Math)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * حساب المسافة المترية بين نقطتين وفق معادلة Haversine
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const p1 = this._sanitizeCoords(parseFloat(lat1), parseFloat(lon1));
    const p2 = this._sanitizeCoords(parseFloat(lat2), parseFloat(lon2));
    if (!p1 || !p2) return Infinity;

    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLon = (p2.lon - p1.lon) * (Math.PI / 180);
    const rLat1 = p1.lat * (Math.PI / 180);
    const rLat2 = p2.lat * (Math.PI / 180);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(rLat1) * Math.cos(rLat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return Math.round(this.EARTH_RADIUS_METERS * c * 10) / 10;
  }

  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    return this.calculateHaversineDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * حساب المسافة من نقطة إلى أقرب نقطة على مسار خطي (Point-to-LineString Distance)
   */
  calculatePointToLineStringDistance(point, lineCoordinates) {
    const pt = this.parsePoint(point);
    if (!pt || !Array.isArray(lineCoordinates) || lineCoordinates.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;

    for (let i = 0; i < lineCoordinates.length - 1; i++) {
      const pA = this.parsePoint(lineCoordinates[i]);
      const pB = this.parsePoint(lineCoordinates[i + 1]);
      if (!pA || !pB) continue;

      // حساب المسافة العمودية على القطعة المستقيمة [pA, pB]
      const dist = this._distanceToSegment(pt, pA, pB);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return minDistance;
  }

  /**
   * المسافة بين نقطة وقطعة مستقيمة على سطح الأرض
   */
  _distanceToSegment(p, a, b) {
    // التحويل إلى إسقاط متري موضعي مبسط (Equirectangular Approximation)
    const midLat = (a.lat + b.lat + p.lat) / 3 * (Math.PI / 180);
    const kx = Math.cos(midLat) * 111320;
    const ky = 110540;

    const px = p.lon * kx, py = p.lat * ky;
    const ax = a.lon * kx, ay = a.lat * ky;
    const bx = b.lon * kx, by = b.lat * ky;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return this.calculateHaversineDistance(p.lat, p.lon, a.lat, a.lon);

    // نسبة الإسقاط t على القطعة [0, 1]
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;

    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  /**
   * التحقق مما إذا كان الكيان يقع ضمن النطاق المتري لنقطة المقارنة
   */
  isWithinDistance(entityGeom, targetPoint, distanceMeters) {
    const target = this.parsePoint(targetPoint);
    if (!target || isNaN(distanceMeters) || distanceMeters < 0) return false;

    // 1. إذا كان الكيان نقطة مفردة
    const singlePt = this.parsePoint(entityGeom);
    if (singlePt) {
      return this.calculateHaversineDistance(singlePt.lat, singlePt.lon, target.lat, target.lon) <= distanceMeters;
    }

    // 2. إذا كان الكيان مساراً أو مضلعاً GeoJSON
    if (typeof entityGeom === 'object' && entityGeom !== null) {
      let coords = null;
      if (Array.isArray(entityGeom.coordinates)) {
        coords = entityGeom.coordinates;
      } else if (Array.isArray(entityGeom)) {
        coords = entityGeom;
      }

      if (Array.isArray(coords)) {
        const dist = this.calculatePointToLineStringDistance(target, coords);
        return dist <= distanceMeters;
      }
    }

    return false;
  }

  /**
   * حساب المربع المحيط الدقيق مع الحماية الرياضية من القسمة على صفر
   */
  calculateSpatialBufferBoundingBox(lat, lon, radiusMeters) {
    const pt = this._sanitizeCoords(parseFloat(lat), parseFloat(lon));
    const r = Math.max(0, parseFloat(radiusMeters) || 0);

    if (!pt) {
      return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
    }

    const latDelta = r / 111132;
    const cosLat = Math.cos(pt.lat * Math.PI / 180);
    // منع القسمة على صفر عند الأقطاب
    const safeCos = Math.abs(cosLat) < 0.00001 ? 0.00001 : Math.abs(cosLat);
    const lonDelta = r / (111132 * safeCos);

    return {
      minLat: Math.max(-90, Math.round((pt.lat - latDelta) * 100000) / 100000),
      maxLat: Math.min(90, Math.round((pt.lat + latDelta) * 100000) / 100000),
      minLon: Math.max(-180, Math.round((pt.lon - lonDelta) * 100000) / 100000),
      maxLon: Math.min(180, Math.round((pt.lon + lonDelta) * 100000) / 100000)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ مترجم استعلامات PostGIS الآمن (Balanced SQL Function Translator)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ترجمة استعلام SQL واستبدال دوال PostGIS المتداخلة بأمان
   */
  translateSpatialQuery(sqlQuery) {
    if (!sqlQuery || typeof sqlQuery !== 'string') {
      return { translatedQuery: sqlQuery, isSpatial: false, evaluateSpatialRecord: () => true };
    }

    let isSpatial = false;
    let translated = sqlQuery;

    // دالة استبدال ذكية تتعقب الأقواس المتوازنة (Balanced Parentheses Matching)
    const replaceBalancedFunction = (query, fnName) => {
      let idx = query.search(new RegExp(`\\b${fnName}\\s*\\(`, 'i'));
      while (idx !== -1) {
        isSpatial = true;
        const startIdx = query.indexOf('(', idx);
        let depth = 1;
        let endIdx = startIdx + 1;

        while (endIdx < query.length && depth > 0) {
          if (query[endIdx] === '(') depth++;
          else if (query[endIdx] === ')') depth--;
          endIdx++;
        }

        if (depth === 0) {
          // استبدال الدالة بالكامل بشرط محايد 1=1
          query = query.substring(0, idx) + '1=1' + query.substring(endIdx);
        } else {
          break;
        }

        idx = query.search(new RegExp(`\\b${fnName}\\s*\\(`, 'i'));
      }
      return query;
    };

    translated = replaceBalancedFunction(translated, 'ST_DWithin');
    translated = replaceBalancedFunction(translated, 'ST_Buffer');
    translated = replaceBalancedFunction(translated, 'ST_Intersects');
    translated = replaceBalancedFunction(translated, 'ST_Contains');

    return {
      translatedQuery: translated,
      isSpatial,
      evaluateSpatialRecord: (record, targetLat, targetLon, maxDistanceMeters) => {
        if (!record) return false;
        const geom = record.geom || record.location || record.coordinates || record.geometry;
        return this.isWithinDistance(geom, { lat: targetLat, lon: targetLon }, maxDistanceMeters);
      }
    };
  }

  /**
   * فحص الجاهزية والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    try {
      // فحص حسابي لمعادلة Haversine بين نقطتين معروفتين في كفرنجة
      const testDist = this.calculateHaversineDistance(32.2985, 35.7050, 32.3000, 35.7070);
      const isAccurate = testDist > 200 && testDist < 300;

      // فحص مترجم الاستعلامات المتداخلة
      const testSql = "SELECT * FROM roads WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(35.7, 32.3), 4326), 500) AND active = true";
      const trans = this.translateSpatialQuery(testSql);
      const isSqlValid = trans.isSpatial && trans.translatedQuery.includes('WHERE 1=1 AND active = true');

      return {
        healthy: isAccurate && isSqlValid,
        status: (isAccurate && isSqlValid) ? 'READY' : 'DEGRADED',
        engineId: this.engineId,
        haversineTestMeters: testDist,
        sqlTranslationAccurate: isSqlValid,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: false,
        status: 'FAILED',
        engineId: this.engineId,
        error: e.message
      };
    }
  }
}

const spatialTranslator = new SpatialTranslatorService();
module.exports = spatialTranslator;
