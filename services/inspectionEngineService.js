/**
 * services/inspectionEngineService.js
 * 🔍 محرك التفتيش والرقابة الميدانية وضبط الجودة (INSPECTION_ENGINE — Phase 10-A)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable
} = require('../utils/database');
const notificationCenter = require('./notificationCenter');
const { logInfo, logWarn } = require('./loggerService');

class InspectionEngineService {
  constructor() {
    this.engineId = 'INSPECTION_ENGINE';
    this.engineName = 'Enterprise Field Inspection & Quality Control Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'field_inspections',
      'defect_logging',
      'quality_compliance',
      'incident_notifications'
    ];
  }

  async getInspections(filters = {}) {
    if (isPostgresActive()) {
      try {
        return await dbQuery('SELECT * FROM road_inspections ORDER BY created_at DESC') || [];
      } catch (e) {
        return memDb.road_inspections || [];
      }
    }
    return memDb.road_inspections || [];
  }

  async recordInspection(inspectionData, user = null) {
    const { roadId, siteLocation, inspectorName, condition, defects, notes } = inspectionData;
    const id = `INSP-${Date.now()}`;
    const record = {
      id,
      roadId: roadId || null,
      siteLocation: siteLocation || 'كفرنجة',
      inspectorName: inspectorName || user?.fullName || 'مفتش الجودة والسلامة',
      condition: condition || 'PASSED',
      defects: defects || [],
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    if (!memDb.road_inspections) memDb.road_inspections = [];
    memDb.road_inspections.unshift(record);
    saveMemTable('road_inspections');

    if (condition === 'FAILED') {
      notificationCenter.emit('INSPECTION_FAILED', {
        roadId,
        issue: notes || 'فشل الفحص الميداني للموقع',
        inspector: record.inspectorName
      });
    }

    return record;
  }

  async healthCheck() {
    const list = memDb.road_inspections || [];
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      totalInspections: list.length,
      timestamp: new Date().toISOString()
    };
  }
}

const inspectionEngineService = new InspectionEngineService();
module.exports = inspectionEngineService;
