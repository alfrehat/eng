/**
 * services/assetsEngineService.js
 * 🏛️ محرك إدارة الأصول والمرافق الهندسية والآليات الثقيلة (ASSETS_ENGINE — Phase 08)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. حصر وتوثيق الأصول البلدية الهندسية (أبنية، جدران استنادية، شبكات تصريف أمطار، عبارات، إنارة، وآليات).
 * 2. احتساب مؤشر الحالة الإنشائية والتشغيلية والاستهلاك السنوي (Straight-Line Depreciation).
 * 3. ربط الأصول بالمناطق والأحواض الجغرافية لبلدية كفرنجة الجديدة.
 * 4. متابعة خطط الصيانة الدورية وتجديد الأصول الحيوية.
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

class AssetsEngineService {
  constructor() {
    this.engineId = 'ASSETS_ENGINE';
    this.engineName = 'Enterprise Municipal Infrastructure Assets & Machinery Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'assets_crud',
      'structural_assets',
      'infrastructure_networks',
      'energy_lighting',
      'machinery_fleet',
      'condition_depreciation_calculation',
      'assets_analytics'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الأصول البلدية [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأصول البلدية والمرافق والآليات',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('AssetsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ احتساب الاستهلاك والقيمة الدفترية الحالية (Depreciation Calculation)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب الاستهلاك السنوي والقيمة الدفترية الحالية للأصل (Straight-Line Depreciation)
   */
  calculateAssetDepreciation(initialCost, acquisitionYear, usefulLifeYears = 20, salvageValue = 0) {
    const cost = parseFloat(initialCost || 0);
    const life = parseInt(usefulLifeYears || 20, 10);
    const salvage = parseFloat(salvageValue || 0);
    const currentYear = new Date().getFullYear();
    const acqYear = parseInt(acquisitionYear || currentYear, 10);
    const age = Math.max(0, currentYear - acqYear);

    const depreciableBase = Math.max(0, cost - salvage);
    const annualDepreciation = life > 0 ? (depreciableBase / life) : 0;
    const accumulatedDepreciation = Math.min(depreciableBase, annualDepreciation * age);
    const currentBookValue = Math.max(salvage, cost - accumulatedDepreciation);

    return {
      initialCost: cost,
      salvageValue: salvage,
      usefulLifeYears: life,
      assetAgeYears: age,
      annualDepreciation: Math.round(annualDepreciation * 100) / 100,
      accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      currentBookValue: Math.round(currentBookValue * 100) / 100
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة الأصول البلدية (Assets CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة الأصول مع الفلاتر والتصنيفات
   */
  async getAssets(filters = {}) {
    const { search, category, district, status } = filters;
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM public.structural_assets WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (name ILIKE $${params.length} OR id ILIKE $${params.length} OR district ILIKE $${params.length})`;
      }
      if (category) {
        params.push(category);
        sql += ` AND asset_type = $${params.length}`;
      }
      if (district) {
        params.push(district);
        sql += ` AND district = $${params.length}`;
      }
      sql += ' ORDER BY created_at DESC';
      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.structural_assets || []).filter(a => {
        if (search && !(`${a.name || ''} ${a.id || ''} ${a.district || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (category && a.asset_type !== category && a.category !== category) return false;
        if (district && a.district !== district) return false;
        return true;
      });
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل أصل بلدي محدد
   */
  async getAssetById(assetId) {
    if (!assetId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.structural_assets WHERE id = $1', [assetId]);
    } else {
      return (memDb.structural_assets || []).find(a => String(a.id) === String(assetId)) || null;
    }
  }

  /**
   * إنشاء وتوثيق أصل بلدي جديد
   */
  async createAsset(assetData, user = null) {
    const {
      name, asset_type, assetType, category, district, condition_index, conditionIndex,
      initial_cost, initialCost, acquisition_year, acquisitionYear, useful_life_years,
      height_meters, floors_count, notes
    } = assetData;

    if (!name) throw new Error('اسم الأصل البلدي/المرفق مطلوب.');

    const id = `AST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const actualType = asset_type || assetType || category || 'جدار استنادي';
    const actualDistrict = district || 'كفرنجة المركز';
    const actualCond = condition_index !== undefined ? parseInt(condition_index || conditionIndex, 10) : 85;
    const cost = parseFloat(initial_cost || initialCost || 10000.0);
    const acqYear = parseInt(acquisition_year || acquisitionYear || new Date().getFullYear(), 10);
    const dep = this.calculateAssetDepreciation(cost, acqYear, useful_life_years || 20);

    const now = new Date().toISOString();
    const record = {
      id,
      name,
      asset_type: actualType,
      category: actualType,
      district: actualDistrict,
      condition_index: actualCond,
      initial_cost: cost,
      current_book_value: dep.currentBookValue,
      acquisition_year: acqYear,
      height_meters: parseFloat(height_meters || 0),
      floors_count: parseInt(floors_count || 1, 10),
      notes: notes || '',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.structural_assets
        (id, name, asset_type, district, condition_index, height_meters, floors_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [id, record.name, record.asset_type, record.district, record.condition_index, record.height_meters, record.floors_count]);
    } else {
      if (!memDb.structural_assets) memDb.structural_assets = [];
      memDb.structural_assets.unshift(record);
      saveMemTable('structural_assets');
    }

    await this._recordAudit(user?.id, id, 'ASSET_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع الإحصائيات التجميعية للأصول البلدية
   */
  async getAssetsStats() {
    const assets = await this.getAssets({});
    let totalValue = 0;
    let goodCount = 0;
    let criticalCount = 0;

    assets.forEach(a => {
      totalValue += parseFloat(a.initial_cost || a.current_book_value || 10000);
      const cond = parseInt(a.condition_index || 80, 10);
      if (cond >= 70) goodCount++;
      else criticalCount++;
    });

    return {
      totalAssetsCount: assets.length,
      totalEstimatedValue: Math.round(totalValue * 100) / 100,
      goodConditionAssetsCount: goodCount,
      criticalAssetsCount: criticalCount,
      maintenancePriorityCount: criticalCount
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalAssets = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.structural_assets');
        totalAssets = parseInt(res?.count || 0, 10);
      } else {
        totalAssets = (memDb.structural_assets || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalAssets,
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

const assetsEngineService = new AssetsEngineService();
module.exports = assetsEngineService;
