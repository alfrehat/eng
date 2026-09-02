/**
 * services/spatialTranslator.js
 * مترجم الاستعلامات الجغرافية المتقدم (Spatial Query Translator & Fallback Engine)
 * 
 * يوفر حلاً تشغيلياً بديلاً (Fallback) لدوال PostGIS الجغرافية (ST_DWithin, ST_Buffer, ST_Intersects)
 * عند التراجع التلقائي إلى النمط المحلي (JSON/MS Access) بدون توفر ملحق PostGIS.
 */

/**
 * حساب المسافة بين نقطتين جغرافيتين بصيغة Haversine بالشيفرة النصف قطرية (بالمتر)
 * @param {number} lat1 خط عرض النقطة الأولى
 * @param {number} lon1 خط طول النقطة الأولى
 * @param {number} lat2 خط عرض النقطة الثانية
 * @param {number} lon2 خط طول النقطة الثانية
 * @returns {number} المسافة بالمتر
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * محاكاة دالة ST_DWithin في النمط المحلي
 * @param {object} point1 { lat, lng } أو [lon, lat]
 * @param {object} point2 { lat, lng } أو [lon, lat]
 * @param {number} distanceMeters المسافة القصوى المسموحة بالمتر
 * @returns {boolean} هل تقع النقطة ضمن النطاق المتري؟
 */
function isWithinDistance(point1, point2, distanceMeters) {
  const parseCoords = (p) => {
    if (!p) return null;
    if (Array.isArray(p) && p.length >= 2) return { lat: p[1], lon: p[0] };
    if (typeof p === 'object' && (p.lat !== undefined || p.latitude !== undefined)) {
      return { lat: p.lat || p.latitude, lon: p.lng || p.longitude || p.lon };
    }
    if (typeof p === 'string') {
      try {
        const parsed = JSON.parse(p);
        return parseCoords(parsed);
      } catch (e) {
        // Point(lon lat) format WKT
        const match = p.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (match) return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }
    return null;
  };

  const c1 = parseCoords(point1);
  const c2 = parseCoords(point2);
  if (!c1 || !c2) return false;

  const dist = calculateHaversineDistance(c1.lat, c1.lon, c2.lat, c2.lon);
  return dist <= distanceMeters;
}

/**
 * محاكاة دالة ST_Buffer وحساب المربع المحيط (Bounding Box) للمناطق الجغرافية
 * @param {number} lat خط العرض
 * @param {number} lon خط الطول
 * @param {number} radiusMeters النصف قطري بالمتر
 * @returns {object} { minLat, maxLat, minLon, maxLon }
 */
function calculateSpatialBufferBoundingBox(lat, lon, radiusMeters) {
  const latDelta = radiusMeters / 111132;
  const lonDelta = radiusMeters / (111132 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta
  };
}

/**
 * ترجمة الاستعلام النصي الحاوي على PostGIS Spatial Functions إلى شروط تصفية مكافئة في JavaScript
 * @param {string} sqlQuery استعلام SQL
 * @returns {object} { translatedQuery, isSpatial, spatialFilterFn }
 */
function translateSpatialQuery(sqlQuery) {
  let isSpatial = false;
  let translatedQuery = sqlQuery;

  // فحص وجود ST_DWithin
  if (/ST_DWithin/i.test(sqlQuery)) {
    isSpatial = true;
    // استبدال ST_DWithin(geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326), distance)
    translatedQuery = sqlQuery.replace(/ST_DWithin\([^)]+\)/gi, '1=1');
  }

  // فحص وجود ST_Buffer
  if (/ST_Buffer/i.test(sqlQuery)) {
    isSpatial = true;
    translatedQuery = sqlQuery.replace(/ST_Buffer\([^)]+\)/gi, '1=1');
  }

  return {
    translatedQuery,
    isSpatial,
    evaluateSpatialRecord: (record, targetLat, targetLon, maxDistanceMeters) => {
      if (!record) return false;
      const recGeom = record.geom || record.location || record.coordinates;
      return isWithinDistance(recGeom, { lat: targetLat, lon: targetLon }, maxDistanceMeters);
    }
  };
}

module.exports = {
  calculateHaversineDistance,
  calculateDistanceMeters: calculateHaversineDistance,
  isWithinDistance,
  calculateSpatialBufferBoundingBox,
  translateSpatialQuery
};
