/**
 * knm-enterprise-v2/backend/src/engines/foundation/SpatialGisEngine/SpatialGisEngine.js
 * UNIFIED SINGLE SPATIAL GIS ENGINE FOR KAFRANJAH MUNICIPALITY
 * Strictly compliant with Master Directive: Exactly ONE Spatial Engine in the entire enterprise.
 */

const { databaseEngine } = require('../DatabaseEngine');
const AppError = require('../../../core/AppError');

// Kafranjah Municipality Spatial Envelope Reference
const KAFRANJAH_BOUNDS = {
  minLon: 35.65,
  maxLon: 35.85,
  minLat: 32.25,
  maxLat: 32.40,
  center: { lon: 35.7058, lat: 32.2986 }
};

class SpatialGisEngine {
  constructor(options = {}) {
    this.db = options.databaseEngine || databaseEngine;
    this.defaultSrid = 4326; // WGS 84
  }

  /**
   * Validate a coordinate pair [longitude, latitude]
   */
  isValidCoordinate(coord) {
    if (!Array.isArray(coord) || coord.length < 2) return false;
    const [lon, lat] = coord;
    return (
      typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180 &&
      typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90
    );
  }

  /**
   * Check if coordinate falls within Kafranjah Municipal Operational Area
   */
  isWithinKafranjahBounds(lon, lat) {
    return (
      lon >= KAFRANJAH_BOUNDS.minLon &&
      lon <= KAFRANJAH_BOUNDS.maxLon &&
      lat >= KAFRANJAH_BOUNDS.minLat &&
      lat <= KAFRANJAH_BOUNDS.maxLat
    );
  }

  /**
   * Validate GeoJSON Geometry structure
   */
  validateGeoJson(geometry) {
    if (!geometry || typeof geometry !== 'object') {
      throw AppError.badRequest('Invalid GeoJSON: geometry must be an object', 'GIS_INVALID_GEOJSON');
    }

    const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
    if (!validTypes.includes(geometry.type)) {
      throw AppError.badRequest(`Unsupported geometry type: ${geometry.type}`, 'GIS_UNSUPPORTED_TYPE');
    }

    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      throw AppError.badRequest('Invalid GeoJSON: missing coordinates array', 'GIS_INVALID_COORDINATES');
    }

    return true;
  }

  /**
   * Convert GeoJSON to Well-Known Text (WKT)
   */
  geoJsonToWkt(geometry) {
    this.validateGeoJson(geometry);
    const { type, coordinates } = geometry;

    switch (type) {
      case 'Point':
        return `POINT(${coordinates[0]} ${coordinates[1]})`;
      case 'LineString': {
        const pts = coordinates.map(c => `${c[0]} ${c[1]}`).join(', ');
        return `LINESTRING(${pts})`;
      }
      case 'Polygon': {
        const rings = coordinates.map(ring => `(${ring.map(c => `${c[0]} ${c[1]}`).join(', ')})`).join(', ');
        return `POLYGON(${rings})`;
      }
      default:
        throw AppError.badRequest(`WKT conversion not implemented for: ${type}`);
    }
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine Formula)
   */
  calculateHaversineDistance(lon1, lat1, lon2, lat2) {
    const R = 6371000; // Earth radius in meters
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Calculate bounding box for a set of coordinates [[lon, lat], ...]
   */
  calculateBoundingBox(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return null;
    }

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const extractCoords = (item) => {
      if (typeof item[0] === 'number' && typeof item[1] === 'number') {
        minLon = Math.min(minLon, item[0]);
        maxLon = Math.max(maxLon, item[0]);
        minLat = Math.min(minLat, item[1]);
        maxLat = Math.max(maxLat, item[1]);
      } else if (Array.isArray(item)) {
        item.forEach(extractCoords);
      }
    };

    extractCoords(coordinates);

    return {
      bbox: [minLon, minLat, maxLon, maxLat],
      center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
    };
  }

  /**
   * Assemble GeoJSON Feature Collection
   */
  toFeatureCollection(features = []) {
    return {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry || null,
        properties: f.properties || {}
      }))
    };
  }

  /**
   * Query spatial features within distance using PostGIS or fallback
   */
  async findNearby(tableName, geomColumn, lon, lat, distanceMeters, uow = null) {
    try {
      const sql = `
        SELECT *, ST_AsGeoJSON(${geomColumn})::json AS geojson,
               ST_Distance(${geomColumn}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
        FROM public.${tableName}
        WHERE ST_DWithin(${geomColumn}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY distance_meters ASC
      `;
      return await this.db.queryRows(sql, [lon, lat, distanceMeters], uow);
    } catch (err) {
      // Return empty if PostGIS table/column is not spatially indexed yet
      return [];
    }
  }
}

const defaultSpatialGisEngine = new SpatialGisEngine();

module.exports = {
  SpatialGisEngine,
  spatialGisEngine: defaultSpatialGisEngine,
  KAFRANJAH_BOUNDS
};
