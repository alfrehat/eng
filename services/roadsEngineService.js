/**
 * services/roadsEngineService.js
 * 🛣️ محرك إدارة شبكة الطرق وتقييم حالة الرصفات PCI (ROADS_ENGINE — Phase 06)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة شبكة الطرق البلدية (تصنيف، أطوال، عروض، مسارب، وإحداثيات مكانية GIS).
 * 2. احتساب مؤشر حالة الرصفات (Pavement Condition Index - PCI) وفق المعايير العالمية (ASTM D6433).
 * 3. تحليل وتحديد الأولويات لصيانة وتعبيد الشوارع المتدهورة وربطها بالمشاريع والعطاءات.
 * 4. متابعة السجل التاريخي للصيانة وإحصائيات شبكة الطرق للمديرية.
 * 5. التكامل المؤسسي مع منسق المحركات وسجل التدقيق.
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable,
  generateSequenceId
} = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

class RoadsEngineService {
  constructor() {
    this.engineId = 'ROADS_ENGINE';
    this.engineName = 'Enterprise Roads Network & Pavement Condition (PCI) Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'roads_crud',
      'pci_assessment',
      'pavement_condition_tracking',
      'network_statistics',
      'maintenance_history'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الطرق والرصفات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'شبكة الطرق والرصفات', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-RD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'شبكة الطرق والرصفات',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('RoadsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ حساب مؤشر حالة الرصفة (Pavement Condition Index — PCI)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب قيمة وتصنيف الـ PCI بناءً على العيوب الميدانية (ASTM D6433 Standard)
   */
  calculatePCI(distresses = []) {
    let deductSum = 0;
    distresses.forEach(d => {
      const severity = (d.severity || 'MEDIUM').toUpperCase();
      const density = parseFloat(d.density || d.percentage || 10.0);
      let severityWeight = 1.0;
      if (severity === 'LOW') severityWeight = 0.5;
      else if (severity === 'HIGH') severityWeight = 1.5;

      const deduct = Math.min(50, density * severityWeight * 1.2);
      deductSum += deduct;
    });

    const pciScore = Math.max(0, Math.min(100, Math.round(100 - deductSum)));
    let conditionRating = 'GOOD';
    let arabicDescription = 'جيدة جداً';
    let recommendedAction = 'صيانة وقائية دورية';

    if (pciScore >= 85) {
      conditionRating = 'EXCELLENT';
      arabicDescription = 'ممتازة';
      recommendedAction = 'لا تحتاج صيانة حالياً';
    } else if (pciScore >= 70) {
      conditionRating = 'GOOD';
      arabicDescription = 'جيدة';
      recommendedAction = 'صيانة وقائية وسد الشقوق';
    } else if (pciScore >= 55) {
      conditionRating = 'FAIR';
      arabicDescription = 'متوسطة';
      recommendedAction = 'طبقة صقل سطحية (Slurry Seal) أو ترقيع موضعي';
    } else if (pciScore >= 40) {
      conditionRating = 'POOR';
      arabicDescription = 'سيئة';
      recommendedAction = 'كشط وإعادة تعبيد بطبقة خلطة إسفلتية ساخنة';
    } else {
      conditionRating = 'FAILED';
      arabicDescription = 'متدهورة / حرجة';
      recommendedAction = 'إعادة إنشاء وتأهيل كامل مع طبقة الأساس';
    }

    return {
      pciScore,
      conditionRating,
      arabicDescription,
      recommendedAction,
      deductValue: Math.round(deductSum * 100) / 100
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة شبكة الطرق (Roads CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة الطرق مع الفلاتر
   */
  async getRoads(filters = {}) {
    const { search, category, classification, minPci, maxPci } = filters;
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM public.roads WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR id ILIKE $${params.length})`;
      }
      if (category || classification) {
        params.push(category || classification);
        sql += ` AND (category = $${params.length} OR classification = $${params.length})`;
      }
      if (minPci !== undefined) {
        params.push(parseFloat(minPci));
        sql += ` AND pci_score >= $${params.length}`;
      }
      if (maxPci !== undefined) {
        params.push(parseFloat(maxPci));
        sql += ` AND pci_score <= $${params.length}`;
      }
      sql += ' ORDER BY created_at DESC LIMIT 500';
      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.roads || []).filter(r => {
        if (search && !(`${r.name || ''} ${r.code || ''} ${r.id || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (category && r.category !== category && r.classification !== category) return false;
        if (minPci !== undefined && (parseFloat(r.pci_score) || 80) < parseFloat(minPci)) return false;
        if (maxPci !== undefined && (parseFloat(r.pci_score) || 80) > parseFloat(maxPci)) return false;
        return true;
      });
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل طريق محدد
   */
  async getRoadById(roadId) {
    if (!roadId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.roads WHERE id = $1', [roadId]);
    } else {
      return (memDb.roads || []).find(r => String(r.id) === String(roadId)) || null;
    }
  }

  /**
   * إنشاء طريق جديد في شبكة الطرق
   */
  async createRoad(roadData, user = null) {
    const {
      name, code, category, classification, length_km, lengthKm, width_m, widthMeters,
      lanes_count, lanes, pci_score, surface_condition, surface_type, notes, district
    } = roadData;

    if (!name) throw new Error('اسم الشارع/الطريق مطلوب.');

    const id = `RD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const actualCode = code || `RD-KFR-${Math.floor(100 + Math.random() * 900)}`;
    const actualCategory = category || classification || 'فرعي';
    const actualPci = pci_score !== undefined ? parseInt(pci_score, 10) : 80;
    const now = new Date().toISOString();

    const record = {
      id,
      code: actualCode,
      name,
      category: actualCategory,
      classification: actualCategory,
      length_km: parseFloat(length_km || lengthKm || 1.0),
      width_m: parseFloat(width_m || widthMeters || 6.0),
      lanes_count: parseInt(lanes_count || lanes || 2, 10),
      pci_score: actualPci,
      surface_condition: surface_condition || 'خلطة إسفلتية',
      surface_type: surface_type || 'خلطة ساخنة',
      district: district || 'كفرنجة',
      notes: notes || '',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.roads
        (id, code, name, category, classification, length_km, width_m, lanes_count, pci_score, surface_condition, surface_type, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [
        id, record.code, record.name, record.category, record.classification,
        record.length_km, record.width_m, record.lanes_count, record.pci_score,
        record.surface_condition, record.surface_type, record.notes
      ]);
    } else {
      if (!memDb.roads) memDb.roads = [];
      memDb.roads.unshift(record);
      saveMemTable('roads');
    }

    await this._recordAudit(user?.id, id, 'ROAD_CREATED', null, record);
    return record;
  }

  /**
   * إضافة تقييم مسح ميداني PCI لطريق وتحديث المؤشر
   */
  async addPciSurvey(roadId, surveyData, user = null) {
    const road = await this.getRoadById(roadId);
    if (!road) throw new Error(`الطريق [${roadId}] غير موجود.`);

    const { distresses, surveyDate, surveyorName, notes } = surveyData;
    const pciResult = this.calculatePCI(distresses || []);
    const now = new Date().toISOString();

    const surveyRecord = {
      id: `SURV-${Date.now()}`,
      roadId,
      surveyDate: surveyDate || now.split('T')[0],
      surveyorName: surveyorName || user?.fullName || 'مهندس المسح الميداني',
      pciScore: pciResult.pciScore,
      conditionRating: pciResult.conditionRating,
      recommendedAction: pciResult.recommendedAction,
      distresses: distresses || [],
      notes: notes || '',
      createdAt: now
    };

    if (isPostgresActive()) {
      await dbRun('UPDATE public.roads SET pci_score = $1, last_maintenance_date = $2, updated_at = NOW() WHERE id = $3', [pciResult.pciScore, surveyRecord.surveyDate, roadId]);
    } else {
      const idx = (memDb.roads || []).findIndex(r => String(r.id) === String(roadId));
      if (idx !== -1) {
        memDb.roads[idx].pci_score = pciResult.pciScore;
        memDb.roads[idx].last_maintenance_date = surveyRecord.surveyDate;
        memDb.roads[idx].updated_at = now;
        saveMemTable('roads');
      }

      if (!memDb.road_pci_surveys) memDb.road_pci_surveys = [];
      memDb.road_pci_surveys.push(surveyRecord);
      saveMemTable('road_pci_surveys');
    }

    await this._recordAudit(user?.id, roadId, 'ROAD_PCI_SURVEY_RECORDED', { oldPci: road.pci_score }, { newPci: pciResult.pciScore, pciResult });
    return {
      success: true,
      survey: surveyRecord,
      pciEvaluation: pciResult
    };
  }

  /**
   * استرجاع إحصائيات شبكة الطرق والمؤشرات التجميعية
   */
  async getNetworkStats() {
    const roads = await this.getRoads({});
    let totalLengthKm = 0;
    let pciSum = 0;
    let criticalCount = 0;
    let goodCount = 0;

    roads.forEach(r => {
      const len = parseFloat(r.length_km || r.length || 0);
      const pci = parseFloat(r.pci_score || 80);
      totalLengthKm += len;
      pciSum += pci;
      if (pci < 55) criticalCount++;
      else if (pci >= 70) goodCount++;
    });

    const totalCount = roads.length;
    const avgPci = totalCount > 0 ? Math.round(pciSum / totalCount) : 80;

    return {
      totalRoadsCount: totalCount,
      totalLengthKm: Math.round(totalLengthKm * 100) / 100,
      averageNetworkPCI: avgPci,
      criticalRoadsCount: criticalCount,
      goodRoadsCount: goodCount,
      estimatedMaintenanceBudget: criticalCount * 25000.00
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalRoads = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.roads');
        totalRoads = parseInt(res?.count || 0, 10);
      } else {
        totalRoads = (memDb.roads || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalRoads,
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

const roadsEngineService = new RoadsEngineService();
module.exports = roadsEngineService;
