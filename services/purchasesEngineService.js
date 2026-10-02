/**
 * services/purchasesEngineService.js
 * 🛒 محرك إدارة المشتريات واللوازم والتوريدات الهندسية ولجان الاستلام (PURCHASES_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v3.0 - Anti-Gravity Enterprise Architecture
 * 
 * الميزات المعمارية:
 * 1. المالك الوحيد والكانوني لكافة منطق المشتريات واللوازم وسلاسل التوريد (Domain Owner).
 * 2. التكامل مع محرك الترقيم المركزي (Numbering Engine) لتوليد أرقام PUR-YYYY-XXXX الذرية.
 * 3. التكامل المالي التبادلي مع محرك الموازنة (Budget Engine) لحجز وصرف مخصصات بنود الموازنة.
 * 4. التكامل الكامل مع محرك الأرشفة الرقمية (ARCHIVE_DOCUMENT_ENGINE) لأرشفة الفواتير ومحاضر الاستلام وأوامر الشراء.
 * 5. استخدام طبقة البيانات utils/database.js حصراً مع الحفاظ على مرآة الذاكرة memDb للتوافقية.
 * 6. توثيق وتسجيل كامل لكافة الحركات في سجل التدقيق المؤسسي activity_log.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable
} = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const archiveEngineService = require('./archiveEngineService');
const { logInfo, logWarn, logError } = require('./loggerService');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

class PurchasesEngineService {
  constructor() {
    this.engineId = 'PURCHASES_ENGINE';
    this.engineName = 'Enterprise Engineering Purchases & Procurement Engine';
    this.version = '3.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'purchases_crud',
      'budget_allocation',
      'receiving_committee',
      'workflow_lifecycle',
      'document_archiving',
      'supplier_management',
      'procurement_analytics',
      'budget_synchronization',
      'batch_operations'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي activity_log
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء المشتريات والتوريد [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أوامر الشراء والتوريد',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('PurchasesEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة استعلامات وسجلات الشراء (Queries & Analytics)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة أوامر الشراء مع الفلاتر والتصفح والفرز
   */
  async getPurchases(filters = {}, user = null) {
    const { search, status, category, urgency, supplier, department, projectId, page, limit } = filters;

    if (isPostgresActive()) {
      let sql = 'SELECT * FROM public.purchases WHERE 1=1';
      const params = [];

      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (COALESCE(item, "itemDescription", description, '') ILIKE $${params.length} OR supplier ILIKE $${params.length} OR id ILIKE $${params.length} OR COALESCE(notes, '') ILIKE $${params.length} OR COALESCE(street, '') ILIKE $${params.length} OR COALESCE(district, '') ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (category) {
        params.push(category);
        sql += ` AND (category = $${params.length} OR "purchaseType" = $${params.length})`;
      }
      if (urgency) {
        params.push(urgency);
        sql += ` AND urgency = $${params.length}`;
      }
      if (supplier) {
        params.push(`%${supplier.trim()}%`);
        sql += ` AND supplier ILIKE $${params.length}`;
      }
      if (department) {
        params.push(department);
        sql += ` AND department = $${params.length}`;
      }
      if (projectId) {
        params.push(projectId);
        sql += ` AND ("projectId" = $${params.length} OR project_id = $${params.length} OR tender_id = $${params.length})`;
      }

      sql += ' ORDER BY "createdAt" DESC, id DESC';

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        sql += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params) || [];
      return rows;
    } else {
      let rows = (memDb.purchases || []).filter(p => {
        const sTarget = `${p.item || ''} ${p.itemDescription || ''} ${p.id || ''} ${p.supplier || ''} ${p.supplierName || ''} ${p.notes || ''} ${p.street || ''} ${p.district || ''}`.toLowerCase();
        if (search && !sTarget.includes(search.toLowerCase())) return false;
        if (status && p.status !== status) return false;
        if (category && p.category !== category && p.purchaseType !== category) return false;
        if (urgency && p.urgency !== urgency) return false;
        if (supplier && !(p.supplier || '').toLowerCase().includes(supplier.toLowerCase())) return false;
        if (department && p.department !== department) return false;
        if (projectId && (p.projectId !== projectId && p.project_id !== projectId && p.tender_id !== projectId)) return false;
        return true;
      }).sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        rows = rows.slice(offset, offset + parsedLimit);
      }
      return rows;
    }
  }

  /**
   * استرجاع تفاصيل أمر شراء محدد بالمعرف
   */
  async getPurchaseById(purchaseId) {
    if (!purchaseId) return null;
    if (isPostgresActive()) {
      return await dbGet('SELECT * FROM public.purchases WHERE id = $1', [purchaseId]);
    } else {
      return (memDb.purchases || []).find(p => String(p.id) === String(purchaseId)) || null;
    }
  }

  /**
   * استرجاع الإحصائيات التجميعية الحية للمشتريات والتوريدات
   */
  async getPurchasesStats() {
    const all = await this.getPurchases({});
    let totalSpend = 0;
    let receivedCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let maintenanceCount = 0;
    let materialsCount = 0;
    let directPurchasesCount = 0;

    all.forEach(p => {
      const val = parseFloat(p.amount || p.value || p.totalAmount || 0) || 0;
      totalSpend += val;

      const s = String(p.status || '');
      if (s.includes('استلام') || s.includes('مصروف') || s.includes('مغلقة') || s.includes('تم')) {
        receivedCount++;
      } else if (s.includes('معتمد')) {
        approvedCount++;
      } else {
        pendingCount++;
      }

      const cat = String(p.category || p.purchaseType || '');
      if (cat.includes('صيانة')) maintenanceCount++;
      else if (cat.includes('مواد') || cat.includes('بناء')) materialsCount++;
      else directPurchasesCount++;
    });

    const totalSpendRounded = Math.round(totalSpend * 100) / 100;

    return {
      success: true,
      stats: {
        totalCount: all.length,
        totalAmount: totalSpendRounded,
        totalAmountFormatted: `${totalSpendRounded.toLocaleString('ar-JO')} د.أ`,
        maintenanceCount,
        materialsCount,
        directPurchasesCount,
        pendingCount,
        approvedCount,
        receivedCount
      },
      // مؤشرات النطاق المؤسسية (Domain Metrics)
      totalPurchasesCount: all.length,
      totalSpendValue: totalSpendRounded,
      receivedOrdersCount: receivedCount,
      pendingOrdersCount: pendingCount
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة دورة الحياة والعمليات (Purchases Lifecycle & Mutations)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إنشاء طلب / أمر شراء وتوريد جديد بالترقيم المركزي والربط المالي والأرشفة التلقائية
   */
  async createPurchase(purchaseData, user = null) {
    const {
      item, itemDescription, supplier, amount, value, quantity, unit, price, date, status, notes,
      department, purchaseType, category, urgency, district, street, lat, lng,
      committeeName, committeeHead, committeeMember, warehouseKeeper, supplierRepresentative,
      receivingCommittee: rawCommittee, quotesCount, requestedBy,
      budget_line_id, budgetLineId, attachmentPath, invoiceNumber
    } = purchaseData;

    const finalItem = item || itemDescription;
    if (!finalItem) {
      throw new Error('اسم المادة أو البند المطلوب شراؤه إلزامي.');
    }

    // 1. توليد الرقم المتسلسل الموحد عبر محرك الترقيم المركزي
    const id = await numberingEngine.generateNextId('purchases');
    const qty = Math.max(0.01, parseFloat(quantity || 1));
    const unitPrice = Math.max(0, parseFloat(price || 0));
    const finalVal = Math.round((parseFloat(amount) || parseFloat(value) || (qty * unitPrice) || 0) * 100) / 100;
    const sup = supplier || 'قيد تحديد المورد';
    const now = new Date().toISOString();
    const dateStr = date || now.split('T')[0];
    const finalCategory = category || purchaseType || 'لوازم وشراء مباشر';
    const selectedBudgetLine = budget_line_id || budgetLineId || null;

    let receivingCommittee = rawCommittee;
    if (typeof receivingCommittee === 'string') {
      try { receivingCommittee = JSON.parse(receivingCommittee); } catch(e) { receivingCommittee = null; }
    }
    if (!Array.isArray(receivingCommittee) || receivingCommittee.length === 0) {
      receivingCommittee = [
        { role: 'رئيس لجنة الاستلام الهندسي', name: committeeHead || 'رئيس قسم الطرق / الأبنية' },
        { role: 'عضو لجنة الاستلام الفني', name: committeeMember || 'مهندس طرق / أبنية مختص' },
        { role: 'أمين المستودعات واللوازم والضبط', name: warehouseKeeper || 'حاسب كميات / مراقب فني' },
        { role: 'مندوب المورد / المتعهد المسلم', name: supplierRepresentative || sup || 'مندوب المتعهد المورد' }
      ];
    }

    // 2. حجز المخصص المالي في محرك الموازنة
    if (selectedBudgetLine && finalVal > 0) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.createAllocation === 'function') {
          await budgetEngineService.createAllocation({
            budget_line_id: selectedBudgetLine,
            entity_type: 'PURCHASE',
            entity_id: id,
            entity_name: finalItem,
            amount: finalVal,
            status: 'COMMITTED'
          });
        }
      } catch (be) {
        logWarn('PurchasesEngine', `Budget allocation error: ${be.message}`);
        throw new Error(`تعذر إنشاء أمر الشراء لعدم توفر مخصص مالي كافٍ في البند: ${be.message}`);
      }
    }

    const workflowHistory = [
      {
        stage: status || 'مسودة / قيد التنظيم',
        actor: requestedBy || user?.fullName || 'المهندس المشرف',
        timestamp: now,
        note: 'تم إنشاء طلب الشراء وتوثيقه في المنظومة المؤسسية'
      }
    ];

    const record = {
      id,
      item: finalItem,
      itemDescription: itemDescription || finalItem,
      description: itemDescription || finalItem,
      supplier: sup,
      supplierName: sup,
      amount: finalVal,
      value: finalVal,
      quantity: qty,
      qty,
      unit: unit || 'عدد',
      price: unitPrice,
      unitPrice,
      date: dateStr,
      status: status || 'مسودة / قيد التنظيم',
      category: finalCategory,
      purchaseType: finalCategory,
      urgency: urgency || 'عادي',
      department: department || 'مديرية الأشغال والخدمات الهندسية',
      district: district || 'كفرنجة',
      street: street || 'الشارع الرئيسي',
      lat: parseFloat(lat) || 32.298,
      lng: parseFloat(lng) || 35.759,
      committeeName: committeeName || 'لجنة الاستلام الفني والمستودعات',
      receivingCommittee,
      quotesCount: parseInt(quotesCount, 10) || 1,
      requestedBy: requestedBy || user?.fullName || 'المهندس المشرف',
      attachmentPath: attachmentPath || '',
      budget_line_id: selectedBudgetLine,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      notes: notes || '',
      workflowHistory,
      createdAt: now,
      updatedAt: now
    };

    // 3. الحفظ في طبقة البيانات
    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.purchases (
          id, item, "itemDescription", description, quantity, qty, unit, "unitPrice", unit_price,
          value, amount, supplier, department, "purchaseType", category, urgency, status,
          district, street, location_lat, location_lng, "committeeName", "attachmentPath",
          attachment_path, notes, date, history, "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27::jsonb, NOW(), NOW()
        )
      `, [
        record.id, record.item, record.itemDescription, record.description,
        record.quantity, record.qty, record.unit, record.unitPrice, record.unitPrice,
        record.value, record.amount, record.supplier, record.department,
        record.purchaseType, record.category, record.urgency, record.status,
        record.district, record.street, record.lat, record.lng,
        record.committeeName, record.attachmentPath, record.attachmentPath,
        record.notes, record.date, JSON.stringify(workflowHistory)
      ]);
    } else {
      if (!memDb.purchases) memDb.purchases = [];
      memDb.purchases.unshift(record);
      saveMemTable('purchases');
    }

    // 4. الأرشفة التلقائية للمرفق إن وجد
    if (attachmentPath && archiveEngineService.archiveDocument) {
      try {
        const fullFilePath = path.join(UPLOADS_DIR, attachmentPath);
        await archiveEngineService.archiveDocument({
          title: `مرفق أمر الشراء: ${id} - ${finalItem}`,
          name: attachmentPath,
          fileName: attachmentPath,
          category: 'مشتريات ولوازم',
          subcategory: 'مستند شراء',
          filePath: fullFilePath,
          relatedId: id,
          relatedType: 'purchase',
          notes: `فاتورة / عرض سعر لأمر الشراء ${id}`
        }, user);
      } catch (archErr) {
        logWarn('PurchasesEngine', `Archive indexing skipped: ${archErr.message}`);
      }
    }

    await this._recordAudit(user?.id, id, 'PURCHASE_ORDER_CREATED', null, record);
    return record;
  }

  /**
   * تعديل بيانات أمر الشراء
   */
  async updatePurchase(purchaseId, updates, user = null) {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) {
      throw new Error(`أمر الشراء [${purchaseId}] غير موجود.`);
    }

    const now = new Date().toISOString();
    const finalItem = updates.item || updates.itemDescription || existing.item || existing.itemDescription;
    const finalQty = updates.quantity !== undefined ? parseFloat(updates.quantity) : (existing.quantity || existing.qty || 1);
    const finalPrice = updates.price !== undefined ? parseFloat(updates.price) : (existing.price || existing.unitPrice || 0);
    const finalVal = updates.amount !== undefined ? parseFloat(updates.amount) : (updates.value !== undefined ? parseFloat(updates.value) : (existing.value || existing.amount || 0));
    const newAttachment = updates.attachmentPath !== undefined ? updates.attachmentPath : existing.attachmentPath;

    const updated = {
      ...existing,
      ...updates,
      item: finalItem,
      itemDescription: finalItem,
      description: finalItem,
      quantity: finalQty,
      qty: finalQty,
      price: finalPrice,
      unitPrice: finalPrice,
      value: finalVal,
      amount: finalVal,
      attachmentPath: newAttachment,
      attachment_path: newAttachment,
      updatedAt: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.purchases
        SET item = $1, "itemDescription" = $2, description = $3, quantity = $4, qty = $5,
            "unitPrice" = $6, unit_price = $7, value = $8, amount = $9, supplier = $10,
            department = $11, category = $12, "purchaseType" = $13, urgency = $14,
            status = $15, notes = $16, "attachmentPath" = $17, attachment_path = $18,
            district = $19, street = $20, "updatedAt" = NOW()
        WHERE id = $21
      `, [
        updated.item, updated.itemDescription, updated.description,
        updated.quantity, updated.qty, updated.unitPrice, updated.unitPrice,
        updated.value, updated.amount, updated.supplier || existing.supplier,
        updated.department || existing.department, updated.category || existing.category,
        updated.purchaseType || existing.purchaseType, updated.urgency || existing.urgency,
        updated.status || existing.status, updated.notes || existing.notes,
        newAttachment, newAttachment,
        updated.district || existing.district, updated.street || existing.street,
        purchaseId
      ]);
    } else {
      const idx = (memDb.purchases || []).findIndex(p => String(p.id) === String(purchaseId));
      if (idx !== -1) {
        memDb.purchases[idx] = updated;
        saveMemTable('purchases');
      }
    }

    // أرشفة المرفق الجديد إذا تم تغييره
    if (newAttachment && newAttachment !== existing.attachmentPath && archiveEngineService.archiveDocument) {
      try {
        const fullFilePath = path.join(UPLOADS_DIR, newAttachment);
        await archiveEngineService.archiveDocument({
          title: `مرفق محدث لأمر الشراء: ${purchaseId} - ${finalItem}`,
          name: newAttachment,
          fileName: newAttachment,
          category: 'مشتريات ولوازم',
          subcategory: 'مستند شراء',
          filePath: fullFilePath,
          relatedId: purchaseId,
          relatedType: 'purchase',
          notes: `مرفق محدث للمعاملة ${purchaseId}`
        }, user);
      } catch (archErr) {
        logWarn('PurchasesEngine', `Archive indexing skipped: ${archErr.message}`);
      }
    }

    await this._recordAudit(user?.id, purchaseId, 'PURCHASE_ORDER_UPDATED', existing, updated);
    return await this.getPurchaseById(purchaseId);
  }

  /**
   * تقدم مرحلة الاعتماد الرسمية وتوثيق الاستلام والإغلاق (Workflow Engine Integration)
   */
  async advanceWorkflow(purchaseId, workflowData, user = null) {
    const purchase = await this.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error(`أمر الشراء [${purchaseId}] غير موجود.`);
    }

    const nextStatus = workflowData.nextStatus || workflowData.status || 'معتمد / قيد التوريد والتنفيذ';
    const { actor, note, receiptNumber, receiverName, orderNumber, receiptFilePath, orderFilePath } = workflowData;

    const now = new Date().toISOString();
    const finalActor = actor || user?.fullName || user?.username || 'المستخدم المسؤول';

    const isClosing = (
      nextStatus === 'تم الاستلام والتسديد والمطابقة - مغلقة' ||
      nextStatus === 'تم الاستلام والتسديد' ||
      nextStatus === 'مكتمل ومغلق' ||
      nextStatus === 'delivered' ||
      nextStatus.includes('الاستلام')
    );

    let history = [];
    if (Array.isArray(purchase.history)) history = [...purchase.history];
    else if (Array.isArray(purchase.workflowHistory)) history = [...purchase.workflowHistory];

    history.push({
      stage: nextStatus,
      actor: finalActor,
      timestamp: now,
      note: note || (isClosing ? 'تم استلام المواد واعتماد المحضر وإغلاق المعاملة رسمياً' : `تحويل الحالة إلى: ${nextStatus}`),
      receiptNumber: receiptNumber || purchase.receiptNumber || '',
      receiptFile: receiptFilePath || purchase.receiptFilePath || '',
      orderFile: orderFilePath || purchase.orderFilePath || ''
    });

    // 1. أرشفة مذكرة الاستلام وسند الإدخال تلقائياً في الأرشيف المؤسسي
    if ((receiptFilePath || isClosing) && archiveEngineService.archiveDocument) {
      try {
        const fullReceiptPath = receiptFilePath ? path.join(UPLOADS_DIR, receiptFilePath) : path.join(UPLOADS_DIR, `RECEIPT-${purchase.id}.pdf`);
        await archiveEngineService.archiveDocument({
          title: `محضر استلام توريدات: ${purchase.id} - ${purchase.item}`,
          name: receiptFilePath || `RECEIPT-${purchase.id}.pdf`,
          fileName: receiptFilePath || `RECEIPT-${purchase.id}.pdf`,
          category: 'مشتريات ولوازم',
          subcategory: 'مذكرة استلام',
          filePath: fullReceiptPath,
          relatedId: purchase.id,
          relatedType: 'purchase_receipt',
          referenceNumber: purchase.id,
          notes: `سند ومحضر استلام رسمي رقم ${receiptNumber || ''} للمعاملة ${purchase.id}`
        }, user);
      } catch (archErr) {
        logWarn('PurchasesEngine', `Receipt archive failed: ${archErr.message}`);
      }
    }

    // 2. أرشفة أمر الشراء الموقع
    if (orderFilePath && archiveEngineService.archiveDocument) {
      try {
        const fullOrderPath = path.join(UPLOADS_DIR, orderFilePath);
        await archiveEngineService.archiveDocument({
          title: `أمر الشراء المعتمد والموقع: ${purchase.id} - ${purchase.item}`,
          name: orderFilePath,
          fileName: orderFilePath,
          category: 'مشتريات ولوازم',
          subcategory: 'أمر شراء',
          filePath: fullOrderPath,
          relatedId: purchase.id,
          relatedType: 'purchase_order',
          notes: `أمر شراء معتمد وموقع للمعاملة ${purchase.id}`
        }, user);
      } catch (archErr) {
        logWarn('PurchasesEngine', `Order archive failed: ${archErr.message}`);
      }
    }

    // 3. تحويل الالتزام المالي لمصروف فعلي في الموازنة عند الإغلاق والاستلام
    const bId = purchase.budget_line_id;
    if (isClosing && bId) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.disburseAllocation === 'function') {
          await budgetEngineService.disburseAllocation({
            entity_type: 'PURCHASE',
            entity_id: purchase.id
          });
        }
      } catch (be) {
        logWarn('PurchasesEngine', `Budget disbursement failed: ${be.message}`);
      }
    }

    // 4. الحفظ في قاعدة البيانات
    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.purchases 
        SET status = $1, history = $2::jsonb, notes = COALESCE(notes, '') || ' | ' || $3, "updatedAt" = NOW() 
        WHERE id = $4
      `, [nextStatus, JSON.stringify(history), note || `مرحلة: ${nextStatus}`, purchaseId]);
    } else {
      const idx = (memDb.purchases || []).findIndex(p => String(p.id) === String(purchaseId));
      if (idx !== -1) {
        memDb.purchases[idx].status = nextStatus;
        memDb.purchases[idx].workflowHistory = history;
        memDb.purchases[idx].history = history;
        memDb.purchases[idx].updatedAt = now;
        if (receiptFilePath) memDb.purchases[idx].receiptFilePath = receiptFilePath;
        if (orderFilePath) memDb.purchases[idx].orderFilePath = orderFilePath;
        if (receiptNumber) memDb.purchases[idx].receiptNumber = receiptNumber;
        if (orderNumber) memDb.purchases[idx].orderNumber = orderNumber;
        if (receiverName) memDb.purchases[idx].receiverName = receiverName;
        saveMemTable('purchases');
      }
    }

    await this._recordAudit(user?.id, purchaseId, isClosing ? 'CLOSE_PURCHASE_ORDER' : 'ADVANCE_PURCHASE_WORKFLOW', purchase, { nextStatus, actor: finalActor });
    return await this.getPurchaseById(purchaseId);
  }

  /**
   * اعتماد أمر الشراء من قبل مدير الأشغال
   */
  async approvePurchase(purchaseId, user = null) {
    return await this.advanceWorkflow(purchaseId, {
      nextStatus: 'معتمد للتوريد والتنفيذ',
      actor: user?.fullName || 'مدير الأشغال الهندسية',
      note: 'تمت المصادقة والاعتماد الإداري للتوريد والتنفيذ'
    }, user);
  }

  /**
   * توثيق محضر استلام لجنة الاستلام الفني والمستودعات
   */
  async receivePurchaseItems(purchaseId, committeeData = {}, user = null) {
    const { inspectionNotes, committeeMembers, receiptNumber, receiptFilePath, condition, receivingCommittee, notes } = committeeData || {};
    return await this.advanceWorkflow(purchaseId, {
      nextStatus: 'تم الاستلام والتسديد والمطابقة - مغلقة',
      actor: committeeMembers || receivingCommittee || user?.fullName || 'لجنة الاستلام المشتركة',
      note: inspectionNotes || notes || condition || 'تم استلام المواد مطابقة للمواصفات الفنية وجداول الكميات',
      receiptNumber: receiptNumber || '',
      receiptFilePath: receiptFilePath || ''
    }, user);
  }

  /**
   * حذف أمر شراء مع إلغاء حجز المخصص المالي وتنظيف المرفقات بأمان
   */
  async deletePurchase(purchaseId, user = null) {
    const existing = await this.getPurchaseById(purchaseId);
    if (!existing) {
      throw new Error(`أمر الشراء [${purchaseId}] غير موجود.`);
    }

    // 1. تحرير مخصص الموازنة المرتبط
    const bId = existing.budget_line_id;
    if (bId) {
      try {
        const budgetEngineService = require('./budgetEngineService');
        if (typeof budgetEngineService.releaseAllocation === 'function') {
          await budgetEngineService.releaseAllocation({
            entity_type: 'PURCHASE',
            entity_id: purchaseId
          });
        }
      } catch (e) {
        logWarn('PurchasesEngine', `Failed to release budget allocation: ${e.message}`);
      }
    }

    // 2. إزالة المرفق المادي من القرص إن وجد
    const att = existing.attachmentPath || existing.attachment_path;
    if (att) {
      const fp = path.join(UPLOADS_DIR, att);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) {}
      }
    }

    // 3. الحذف من قاعدة البيانات
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.purchases WHERE id = $1', [purchaseId]);
    } else {
      memDb.purchases = (memDb.purchases || []).filter(p => String(p.id) !== String(purchaseId));
      saveMemTable('purchases');
    }

    await this._recordAudit(user?.id, purchaseId, 'PURCHASE_ORDER_DELETED', existing, null);
    return { success: true, message: 'تم حذف أمر الشراء وإلغاء حجز المخصص المالي بنجاح.' };
  }

  /**
   * الحذف الجماعي لأوامر الشراء
   */
  async batchDeletePurchases(ids, user = null) {
    if (!Array.isArray(ids) || !ids.length) {
      throw new Error('يجب تحديد مصفوفة معرفات صالحة للحذف الجماعي.');
    }

    for (const id of ids) {
      try {
        await this.deletePurchase(id, user);
      } catch (e) {
        logWarn('PurchasesEngine', `Batch delete item [${id}] skipped: ${e.message}`);
      }
    }

    return {
      success: true,
      count: ids.length,
      message: `تم تنفيذ الحذف الجماعي لـ (${ids.length}) معاملة شراء بنجاح.`
    };
  }

  /**
   * فحص الجاهزية والمؤشرات التشغيلية للمحرك (Health Probe)
   */
  async healthCheck() {
    let totalCount = 0;
    let totalValue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as total_val FROM public.purchases');
        totalCount = parseInt(res?.count || 0, 10);
        totalValue = parseFloat(res?.total_val || 0);
      } else {
        totalCount = (memDb.purchases || []).length;
        totalValue = (memDb.purchases || []).reduce((sum, p) => sum + (parseFloat(p.value || p.amount || 0)), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        database: isPostgresActive() ? 'CONNECTED' : 'IN_MEMORY',
        engineId: this.engineId,
        totalCount,
        totalPurchasesCount: totalCount,
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

module.exports = new PurchasesEngineService();
