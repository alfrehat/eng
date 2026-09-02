/**
 * services/pavementReturnsEngineService.js
 * 🏗️ محرك حساب وتحصيل عوائد التعبيد والتحققات البلدية (PAVEMENT_RETURNS_ENGINE — Phase 07)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. احتساب عوائد التعبيد للقطع والعقارات وفق قانون البلديات الأردني:
 *    المبلغ = طول الواجهة (م) × عرض التعبيد (م) × سعر المتر المربع (د.أ) × نسبة التحقق المفروضة
 * 2. ربط عوائد التعبيد بعطاءات ومشاريع التعبيد المنفذة من قبل البلدية.
 * 3. إدارة المطالبات وسندات القبض والتحصيل المالي (PAID, UNPAID, PARTIAL).
 * 4. ربط بيانات القطع بالأحواض والقرى (كفرنجة، راجب، بلاص، العامرية، السفينة).
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

class PavementReturnsEngineService {
  constructor() {
    this.engineId = 'PAVEMENT_RETURNS_ENGINE';
    this.engineName = 'Enterprise Pavement Returns & Municipal Revenue Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'paving_returns_calculation',
      'returns_crud',
      'revenue_collection',
      'basin_parcel_tracking',
      'financial_reconciliation'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء عوائد التعبيد [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'عوائد التعبيد والتحققات البلدية', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PAV-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'عوائد التعبيد والتحققات البلدية',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('PavementReturnsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ خوارزمية احتساب عوائد التعبيد (Calculation Algorithm)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب قيمة عوائد التعبيد للقطعة
   */
  calculatePavingReturn(frontageLength, pavingWidth, pricePerMeterSquare = 4.5, impositionRate = 1.0) {
    const l = parseFloat(frontageLength || 0);
    const w = parseFloat(pavingWidth || 0);
    const p = parseFloat(pricePerMeterSquare || 4.5);
    let r = parseFloat(impositionRate || 1.0);
    if (r > 1) r = r / 100.0;
    if (r <= 0) r = 1.0;

    const areaSquareMeters = Math.round(l * w * 100) / 100;
    const requiredAmount = Math.round(areaSquareMeters * p * r * 1000) / 1000;

    return {
      frontageLength: l,
      pavingWidth: w,
      areaSquareMeters,
      pricePerMeterSquare: p,
      impositionRate: r,
      requiredAmount
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة سجلات عوائد التعبيد (Returns CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة عوائد التعبيد مع الفلاتر
   */
  async getPavingReturns(filters = {}) {
    const { search, tenderId, pieceNumber, basinNumber, district, paymentStatus } = filters;
    if (isPostgresActive()) {
      let sql = `
        SELECT pr.*, 
               COALESCE(pr.owner_name, 'مواطن / مكلف') as owner_name,
               COALESCE(pr.street_name, 'شارع معبد') as street_name,
               COALESCE(pr.paid_amount, 0) as paid_amount,
               COALESCE(pr.payment_status, 'UNPAID') as payment_status,
               t.name as "tenderName"
        FROM public.paving_returns pr
        LEFT JOIN public.tenders t ON pr.tender_id = t.id
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (pr.owner_name ILIKE $${params.length} OR pr.national_id ILIKE $${params.length} OR pr.street_name ILIKE $${params.length} OR pr.id ILIKE $${params.length})`;
      }
      if (tenderId && tenderId !== 'all') {
        params.push(tenderId);
        sql += ` AND pr.tender_id = $${params.length}`;
      }
      if (pieceNumber) {
        params.push(`%${pieceNumber}%`);
        sql += ` AND pr.piece_number ILIKE $${params.length}`;
      }
      if (basinNumber) {
        params.push(`%${basinNumber}%`);
        sql += ` AND pr.basin_number ILIKE $${params.length}`;
      }
      if (district) {
        params.push(`%${district}%`);
        sql += ` AND pr.district ILIKE $${params.length}`;
      }
      if (paymentStatus) {
        params.push(paymentStatus);
        sql += ` AND pr.payment_status = $${params.length}`;
      }
      sql += ' ORDER BY pr.created_at DESC';
      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.paving_returns || []).filter(r => {
        if (search && !(`${r.owner_name || ''} ${r.national_id || ''} ${r.street_name || ''} ${r.id || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (tenderId && tenderId !== 'all' && r.tender_id !== tenderId) return false;
        if (pieceNumber && !String(r.piece_number || '').includes(pieceNumber)) return false;
        if (basinNumber && !String(r.basin_number || '').includes(basinNumber)) return false;
        if (district && r.district !== district) return false;
        if (paymentStatus && r.payment_status !== paymentStatus) return false;
        return true;
      });
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل سجل عوائد تعبيد محدد
   */
  async getPavingReturnById(returnId) {
    if (!returnId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.paving_returns WHERE id = $1', [returnId]);
    } else {
      return (memDb.paving_returns || []).find(r => String(r.id) === String(returnId)) || null;
    }
  }

  /**
   * إنشاء وتوثيق قيد عوائد تعبيد جديد
   */
  async createPavingReturn(returnData, user = null) {
    const {
      tender_id, tenderId, piece_number, pieceNumber, basin_number, basinNumber,
      district, owner_name, ownerName, national_id, nationalId, street_name, streetName,
      frontage_length, frontageLength, paving_width, pavingWidth, price_per_sqm, pricePerSqm,
      imposition_rate, impositionRate, notes
    } = returnData;

    const id = `PAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const calc = this.calculatePavingReturn(
      frontage_length || frontageLength,
      paving_width || pavingWidth,
      price_per_sqm || pricePerSqm || 4.5,
      imposition_rate || impositionRate || 1.0
    );

    const now = new Date().toISOString();
    const record = {
      id,
      tender_id: tender_id || tenderId || null,
      piece_number: piece_number || pieceNumber || '1',
      basin_number: basin_number || basinNumber || '1',
      district: district || 'كفرنجة',
      owner_name: owner_name || ownerName || 'مواطن مكلف',
      national_id: national_id || nationalId || '—',
      street_name: street_name || streetName || 'شارع رئيسي',
      frontage_length: calc.frontageLength,
      paving_width: calc.pavingWidth,
      area_sqm: calc.areaSquareMeters,
      price_per_sqm: calc.pricePerMeterSquare,
      imposition_rate: calc.impositionRate,
      required_amount: calc.requiredAmount,
      paid_amount: 0.0,
      payment_status: 'UNPAID',
      notes: notes || '',
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.paving_returns
        (id, tender_id, piece_number, basin_number, district, owner_name, national_id, street_name, frontage_length, paving_width, area_sqm, price_per_sqm, imposition_rate, required_amount, paid_amount, payment_status, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
      `, [
        id, record.tender_id, record.piece_number, record.basin_number, record.district,
        record.owner_name, record.national_id, record.street_name, record.frontage_length,
        record.paving_width, record.area_sqm, record.price_per_sqm, record.imposition_rate,
        record.required_amount, record.paid_amount, record.payment_status, record.notes
      ]);
    } else {
      if (!memDb.paving_returns) memDb.paving_returns = [];
      memDb.paving_returns.unshift(record);
      saveMemTable('paving_returns');
    }

    await this._recordAudit(user?.id, id, 'PAVING_RETURN_CREATED', null, record);
    return record;
  }

  /**
   * توثيق تحصيل وسند قبض لعوائد التعبيد
   */
  async recordPayment(returnId, paymentData, user = null) {
    const item = await this.getPavingReturnById(returnId);
    if (!item) throw new Error(`سجل عوائد التعبيد [${returnId}] غير موجود.`);

    const { amountPaid, receiptNumber, paymentDate, notes } = paymentData;
    const paidVal = parseFloat(amountPaid || 0);
    const newPaidTotal = (parseFloat(item.paid_amount || 0)) + paidVal;
    const required = parseFloat(item.required_amount || 0);

    let status = 'PARTIAL';
    if (newPaidTotal >= required) {
      status = 'PAID';
    }

    const updates = {
      paid_amount: Math.round(newPaidTotal * 1000) / 1000,
      payment_status: status,
      receipt_number: receiptNumber || `REC-${Date.now()}`,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun('UPDATE public.paving_returns SET paid_amount = $1, payment_status = $2, receipt_number = $3, updated_at = NOW() WHERE id = $4', [updates.paid_amount, updates.payment_status, updates.receipt_number, returnId]);
    } else {
      const idx = (memDb.paving_returns || []).findIndex(r => String(r.id) === String(returnId));
      if (idx !== -1) {
        memDb.paving_returns[idx] = { ...memDb.paving_returns[idx], ...updates };
        saveMemTable('paving_returns');
      }
    }

    await this._recordAudit(user?.id, returnId, 'PAVING_RETURN_PAID', item, updates);
    return await this.getPavingReturnById(returnId);
  }

  /**
   * استرجاع الإحصائيات التجميعية لعوائد التعبيد والتحصيل
   */
  async getReturnsStats() {
    const all = await this.getPavingReturns({});
    let totalRequired = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    all.forEach(r => {
      const req = parseFloat(r.required_amount || 0);
      const paid = parseFloat(r.paid_amount || 0);
      totalRequired += req;
      totalCollected += paid;
      if (r.payment_status === 'PAID') paidCount++;
      else unpaidCount++;
    });

    const totalUnpaid = Math.max(0, totalRequired - totalCollected);
    const collectionRate = totalRequired > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0;

    return {
      totalRecords: all.length,
      totalRequiredAmount: Math.round(totalRequired * 100) / 100,
      totalCollectedAmount: Math.round(totalCollected * 100) / 100,
      totalUnpaidAmount: Math.round(totalUnpaid * 100) / 100,
      collectionPercentage: collectionRate,
      paidParcelsCount: paidCount,
      unpaidParcelsCount: unpaidCount
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalCount = 0;
    let totalRevenue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count, SUM(paid_amount) as total_paid FROM public.paving_returns');
        totalCount = parseInt(res?.count || 0, 10);
        totalRevenue = parseFloat(res?.total_paid || 0);
      } else {
        totalCount = (memDb.paving_returns || []).length;
        totalRevenue = (memDb.paving_returns || []).reduce((sum, r) => sum + (parseFloat(r.paid_amount || 0)), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
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

const pavementReturnsEngineService = new PavementReturnsEngineService();
module.exports = pavementReturnsEngineService;
