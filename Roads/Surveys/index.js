/**
 * Roads Surveys Layer - Field Surveys & GPS Point Processing Engine
 */
class SurveyGpsProcessor {
  /**
   * تحويل سلسلة من إحداثيات GPS إلى GeoJSON MultiLineString للطرق
   */
  static parseGpsCoordinatesToPolyline(coordinatesArray) {
    if (!Array.isArray(coordinatesArray) || coordinatesArray.length < 2) {
      throw new Error('Valid GPS Survey requires at least 2 coordinate points');
    }

    const formattedPoints = coordinatesArray.map(pt => {
      if (Array.isArray(pt)) return [pt[0], pt[1]]; // [lng, lat]
      return [parseFloat(pt.lng || pt.longitude), parseFloat(pt.lat || pt.latitude)];
    });

    return {
      type: 'MultiLineString',
      coordinates: [[formattedPoints]]
    };
  }

  /**
   * حساب الطول بالكيلومترات بناءً على نقاط GPS (Haversine Formula)
   */
  static calculateLengthFromGpsPoints(points) {
    let totalKm = 0;
    const R = 6371; // radius of Earth in km

    for (let i = 0; i < points.length - 1; i++) {
      const [lng1, lat1] = points[i];
      const [lng2, lat2] = points[i + 1];

      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;

      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalKm += R * c;
    }

    return parseFloat(totalKm.toFixed(3));
  }
}

module.exports = SurveyGpsProcessor;
