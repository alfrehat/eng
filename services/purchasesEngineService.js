/**
 * services/purchasesEngineService.js
 * 🛒 محرك طلبات الشراء والتوريدات الهندسية ولجان الاستلام (PURCHASES_ENGINE — Phase 09)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة دورة حياة أوامر الشراء المباشر والتوريدات للمشاريع والصيانة.
 * 2. التحقق من توفر المخصصات المالية وسقف الشراء المباشر للبلدية.
 * 3. مسار اعتماد ولجان الاستلام الفني (مهندس الموقع -> أمين المستودع -> مدير الأشغال).
 * 4. إدارة الموردين وفواتير التوريد وسندات الإدخال.
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

class PurchasesEngineService {
  constructor() {
    this.engineId = 'PURCHASES_ENGINE';
    this.engineName = 'Enterprise Engineering Purchases & Procurement Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'purchases_crud',
      'budget_allocation',
      'receiving_committee',
      'supplier_management',
      'procurement_analytics'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء المشتريات والتوريد [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'المشتريات والتوريدات الهندسية', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PUR-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'المشتريات والتوريدات الهندسية',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('PurchasesEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة طلبات وأوامر الشراء (Purchases CRUD)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة أوامر الشراء مع الفلاتر
   */
  async getPurchases(filters = {}) {
    const { search, status, supplier, department } = filters;
    if (isPostgresActive()) {
      let sql = 'SELECT * FROM purchases WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (item ILIKE $${params.length} OR id ILIKE $${params.length} OR supplier ILIKE $${params.length} OR "supplierName" ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (department) {
        params.push(department);
        sql += ` AND department = $${params.length}`;
      }
      sql += ' ORDER BY "createdAt" DESC';
      return await dbQuery(sql, params) || [];
    } else {
      let rows = (memDb.purchases || []).filter(p => {
        if (search && !(`${p.item || ''} ${p.id || ''} ${p.supplier || p.supplierName || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (status && p.status !== status) return false;
        if (department && p.department !== department) return false;
        return true;
      });
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل أمر شراء محدد
   */
  async getPurchaseById(purchaseId) {
    if (!purchaseId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
    } else {
      return (memDb.purchases || []).find(p => String(p.id) === String(purchaseId)) || null;
    }
  }

  /**
   * إنشاء أمر شراء وتوريد جديد
   */
  async createPurchase(purchaseData, user = null) {
    const {
      item, itemDescription, value, quantity, unit, price, supplier, supplierName,
      department, purchaseType, projectId, notes, invoiceNumber, budget_line_id, budgetLineId
    } = purchaseData;

    if (!item) throw new Error('اسم المادة/البند المطلوب شراؤه إلزامي.');

    const id = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = parseFloat(quantity || 1);
    const unitPrice = parseFloat(price || 0);
    const totalVal = parseFloat(value) || (qty * unitPrice) || 0;
    const sup = supplier || supplierName || 'مورد محلي معتمد';
    const now = new Date().toISOString();
    const dateStr = now.split('T')[0];
    const selectedBudgetLineId = budget_line_id || budgetLineId || null;

    if (selectedBudgetLineId) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        await budgetEngineService.createAllocation({
          budget_line_id: selectedBudgetLineId,
          entity_type: 'PURCHASE',
          entity_id: id,
          entity_name: item,
          amount: totalVal,
          status: 'COMMITTED'
        });
      } catch (be) {
        logWarn('PurchasesEngine', `Budget allocation error: ${be.message}`);
        throw new Error(`تعذر اعتماد أمر الشراء لعدم توفر مخصص مالي كافٍ: ${be.message}`);
      }
    }

    const record = {
      id,
      item,
      itemDescription: itemDescription || item,
      quantity: qty,
      unit: unit || 'عدد',
      price: unitPrice,
      value: totalVal,
      supplier: sup,
      supplierName: sup,
      department: department || 'مديرية الأشغال والخدمات الهندسية',
      purchaseType: purchaseType || 'شراء مباشر بموجب فواتير',
      status: 'بانتظار موافقة مدير الأشغال',
      projectId: projectId || null,
      budget_line_id: selectedBudgetLineId,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      notes: notes || '',
      date: dateStr,
      createdAt: now,
      updatedAt: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO purchases 
        (id, item, "itemDescription", quantity, unit, price, value, supplier, "supplierName", department, "purchaseType", status, "projectId", "invoiceNumber", notes, date, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      `, [
        id, record.item, record.itemDescription, record.quantity, record.unit,
        record.price, record.value, record.supplier, record.supplierName,
        record.department, record.purchaseType, record.status, record.projectId,
        record.invoiceNumber, record.notes, record.date
      ]);
    } else {
      if (!memDb.purchases) memDb.purchases = [];
      memDb.purchases.unshift(record);
      saveMemTable('purchases');
    }

    await this._recordAudit(user?.id, id, 'PURCHASE_ORDER_CREATED', null, record);
    return record;
  }

  /**
   * توثيق محضر استلام لجنة الاستلام الفني
   */
  async receivePurchaseItems(purchaseId, committeeData, user = null) {
    const purchase = await this.getPurchaseById(purchaseId);
    if (!purchase) throw new Error(`أمر الشراء [${purchaseId}] غير موجود.`);

    const { inspectionNotes, committeeMembers, receivedQuantity } = committeeData;
    const updates = {
      status: 'تم الاستلام والمطابقة الفنية',
      inspectionNotes: inspectionNotes || 'تم استلام المواد مطابقة للمواصفات الفنية وجداول الكميات',
      committeeMembers: committeeMembers || user?.fullName || 'لجنة الاستلام المشتركة',
      receivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun('UPDATE purchases SET status = $1, notes = COALESCE(notes, \'\') || \' | \' || $2, "updatedAt" = NOW() WHERE id = $3', [updates.status, updates.inspectionNotes, purchaseId]);
    } else {
      const idx = (memDb.purchases || []).findIndex(p => String(p.id) === String(purchaseId));
      if (idx !== -1) {
        memDb.purchases[idx] = { ...memDb.purchases[idx], ...updates };
        saveMemTable('purchases');
      }
    }

    await this._recordAudit(user?.id, purchaseId, 'PURCHASE_ITEMS_RECEIVED', purchase, updates);
    return await this.getPurchaseById(purchaseId);
  }

  /**
   * استرجاع الإحصائيات التجميعية للمشتريات والتوريدات
   */
  async getPurchasesStats() {
    const all = await this.getPurchases({});
    let totalSpend = 0;
    let receivedCount = 0;
    let pendingCount = 0;

    all.forEach(p => {
      totalSpend += parseFloat(p.value || 0);
      if (String(p.status || '').includes('استلام') || String(p.status || '').includes('مصروف')) receivedCount++;
      else pendingCount++;
    });

    return {
      totalPurchasesCount: all.length,
      totalSpendValue: Math.round(totalSpend * 100) / 100,
      receivedOrdersCount: receivedCount,
      pendingOrdersCount: pendingCount
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalCount = 0;
    let totalValue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count, SUM(value) as total_val FROM purchases');
        totalCount = parseInt(res?.count || 0, 10);
        totalValue = parseFloat(res?.total_val || 0);
      } else {
        totalCount = (memDb.purchases || []).length;
        totalValue = (memDb.purchases || []).reduce((sum, p) => sum + (parseFloat(p.value || 0)), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalCount,
        totalValue: Math.round(totalValue * 100) / 100,
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

const purchasesEngineService = new PurchasesEngineService();
module.exports = purchasesEngineService;
