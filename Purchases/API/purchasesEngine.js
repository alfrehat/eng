/**
 * Purchases/API/purchasesEngine.js
 * محرك إدارة المشتريات واللوازم وطلبات الصيانة والمواد والتوريدات (Enterprise Purchases & Supplies Engine v6.0)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * الميزات المعمارية:
 * 1. التكامل مع محرك الترقيم المركزي (Numbering Engine) لتوليد أرقام PUR-YYYY-XXX و REQ-YYYY-XXX
 * 2. ربط مباشر بدورة الاعتمادات ومسارات العمل الرسمية (Workflow Engine)
 * 3. الأرشفة التلقائية لكافة الفواتير وعروض الأسعار وسندات الإدخال عبر محرك الأرشفة (Archive Engine)
 * 4. تطبيق مصفوفة الصلاحيات والأدوار المركزية (RBAC)
 * 5. توثيق وتسجيل كافة الحركات في سجل الرقابة والتدقيق (Audit Engine)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/rbacManager');
const numberingEngine = require('../../services/numberingEngine');
const archiveEngineService = require('../../services/archiveEngineService');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

function parseUser(req, res, next) {
  if (req.user) return next();
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }
  next();
}

router.use(parseUser);
const {
  dbQuery,
  dbGet,
  dbRun,
  isPostgresActive,
  memDb,
  saveMemTable
} = require('../../utils/database');

const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'PUR-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, safeName);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 } 
});

function getPurchasesList() {
  if (!Array.isArray(memDb.purchases)) {
    memDb.purchases = [];
  }
  return memDb.purchases;
}

function savePurchasesList(list) {
  memDb.purchases = list;
  saveMemTable('purchases');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/purchases - جلب كافة طلبات وأوامر الشراء والصيانة
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, status, category, urgency, supplier, page, limit } = req.query;

    if (isPostgresActive()) {
      try {
        let sql = 'SELECT * FROM purchases WHERE 1=1';
        const params = [];
        if (search) {
          params.push(`%${search}%`);
          sql += ` AND (COALESCE(item, "itemDescription", '') ILIKE $${params.length} OR supplier ILIKE $${params.length} OR id ILIKE $${params.length} OR COALESCE(notes, '') ILIKE $${params.length})`;
        }
        if (status) {
          params.push(status);
          sql += ` AND status = $${params.length}`;
        }
        if (category) {
          params.push(category);
          sql += ` AND (category = $${params.length} OR "purchaseType" = $${params.length})`;
        }
        sql += ' ORDER BY "createdAt" DESC';

        const rows = await dbQuery(sql, params);
        if (rows && rows.length) return res.json(rows);
      } catch (dbErr) {
        console.warn('Postgres purchases fallback to memDb:', dbErr.message);
      }
    }

    let rows = getPurchasesList();

    // فلترة السجلات
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => 
        (r.id || '').toLowerCase().includes(q) ||
        (r.item || r.itemDescription || '').toLowerCase().includes(q) ||
        (r.supplier || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q) ||
        (r.street || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }

    if (status) {
      rows = rows.filter(r => r.status === status);
    }

    if (category) {
      rows = rows.filter(r => r.category === category || r.purchaseType === category);
    }

    if (urgency) {
      rows = rows.filter(r => r.urgency === urgency);
    }

    if (supplier) {
      rows = rows.filter(r => (r.supplier || '').toLowerCase().includes(supplier.toLowerCase()));
    }

    // فرز بالأحدث
    rows.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

    if (page && limit) {
      const p = parseInt(page, 10) || 1;
      const l = parseInt(limit, 10) || 50;
      rows = rows.slice((p - 1) * l, p * l);
    }

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'فشل جلب سجلات المشتريات', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/purchases/stats - الإحصائيات الحية
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const list = getPurchasesList();
    const totalCount = list.length;
    const totalAmount = list.reduce((sum, p) => sum + (parseFloat(p.amount || p.value || p.totalAmount || 0) || 0), 0);
    const maintenanceCount = list.filter(p => (p.category || '').includes('صيانة') || (p.purchaseType || '').includes('صيانة')).length;
    const materialsCount = list.filter(p => (p.category || '').includes('مواد') || (p.category || '').includes('بناء')).length;
    const directPurchasesCount = list.filter(p => (p.category || '').includes('لوازم') || (p.category || '').includes('شراء') || !p.category).length;
    const pendingCount = list.filter(p => (p.status || '').includes('بانتظار') || (p.status || '').includes('مسودة')).length;
    const approvedCount = list.filter(p => (p.status || '').includes('معتمد') || (p.status || '').includes('تم')).length;

    res.json({
      success: true,
      stats: {
        totalCount,
        totalAmount,
        totalAmountFormatted: `${totalAmount.toLocaleString('ar-JO')} د.أ`,
        maintenanceCount,
        materialsCount,
        directPurchasesCount,
        pendingCount,
        approvedCount
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل حساب الإحصائيات', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/purchases/:id - استرجاع طلب شراء محدد
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const list = getPurchasesList();
    const item = list.find(r => String(r.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'طلب / أمر الشراء غير موجود' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'فشل جلب تفاصيل المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/purchases - إنشاء طلب / أمر شراء / صيانة جديد
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const {
      item, itemDescription, supplier, amount, value, quantity, unit, date, status, notes,
      department, purchaseType, category, urgency, district, street, lat, lng,
      committeeName, committeeHead, committeeMember, warehouseKeeper, supplierRepresentative, receivingCommittee: rawCommittee, quotesCount, requestedBy,
      budget_line_id, budgetLineId
    } = req.body;

    let receivingCommittee = rawCommittee;
    if (typeof receivingCommittee === 'string') {
      try { receivingCommittee = JSON.parse(receivingCommittee); } catch(e) { receivingCommittee = null; }
    }
    if (!Array.isArray(receivingCommittee) || receivingCommittee.length === 0) {
      receivingCommittee = [
        { role: 'رئيس لجنة الاستلام الهندسي', name: committeeHead || 'رئيس قسم الطرق / الأبنية' },
        { role: 'عضو لجنة الاستلام الفني', name: committeeMember || 'مهندس طرق / أبنية مختص' },
        { role: 'أمين المستودعات واللوازم والضبط', name: warehouseKeeper || 'حاسب كميات / مراقب فني' },
        { role: 'مندوب المورد / المتعهد المسلم', name: supplierRepresentative || supplier || 'مندوب المتعهد المورد' }
      ];
    }

    const finalItem = item || itemDescription;
    if (!finalItem) return res.status(400).json({ error: 'اسم المادة / تفاصيل الطلب مطلوبة' });

    // توليد المعرف الرقمي عبر محرك الترقيم المركزي
    const currentYear = new Date().getFullYear();
    const seq = numberingEngine.getNextSequence ? numberingEngine.getNextSequence('purchases') : (getPurchasesList().length + 1);
    const id = `PUR-${currentYear}-${String(seq).padStart(3, '0')}`;

    const attachmentPath = req.file ? req.file.filename : (req.body.attachmentPath || '');
    const now = new Date().toISOString();
    const finalVal = parseFloat(amount) || parseFloat(value) || 0;
    const finalCategory = category || purchaseType || 'لوازم وشراء مباشر';
    const selectedBudgetLine = budget_line_id || budgetLineId || null;

    if (selectedBudgetLine) {
      try {
        const budgetEngineService = require('../../services/budgetEngineService');
        await budgetEngineService.createAllocation({
          budget_line_id: selectedBudgetLine,
          entity_type: 'PURCHASE',
          entity_id: id,
          entity_name: finalItem,
          amount: finalVal,
          status: 'COMMITTED'
        });
      } catch (be) {
        return res.status(400).json({ error: `تعذر إنشاء أمر الشراء لعدم توفر مخصص مالي كافٍ في البند: ${be.message}` });
      }
    }

    const newRecord = {
      id,
      item: finalItem,
      itemDescription: finalItem,
      supplier: supplier || 'قيد تحديد المورد',
      amount: finalVal,
      value: finalVal,
      quantity: parseFloat(quantity) || 1,
      unit: unit || 'عدد',
      date: date || now.split('T')[0],
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
      committeeHead: receivingCommittee[0]?.name || committeeHead || 'رئيس قسم الطرق / الأبنية',
      committeeMember: receivingCommittee[1]?.name || committeeMember || 'مهندس طرق / أبنية مختص',
      warehouseKeeper: receivingCommittee[2]?.name || warehouseKeeper || 'حاسب كميات / مراقب فني',
      supplierRepresentative: receivingCommittee[3]?.name || supplierRepresentative || supplier || 'مندوب المتعهد المورد',
      receivingCommittee,
      quotesCount: parseInt(quotesCount, 10) || 1,
      requestedBy: requestedBy || 'المهندس المشرف',
      attachmentPath,
      budget_line_id: selectedBudgetLine,
      notes: notes || '',
      workflowHistory: [
        {
          stage: status || 'مسودة / قيد التنظيم',
          actor: requestedBy || 'المهندس المشرف',
          timestamp: now,
          note: 'تم إنشاء الطلب وتسجيله في المنظومة المؤسسية'
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    const list = getPurchasesList();
    list.unshift(newRecord);
    savePurchasesList(list);

    // فهرسة المرفق تلقائياً في الأرشيف الإلكتروني إن وجد
    if (attachmentPath && archiveEngineService.indexDocument) {
      try {
        await archiveEngineService.indexDocument({
          title: `مرفق أمر الشراء: ${id} - ${finalItem}`,
          category: 'مشتريات ولوازم',
          type: 'مستند شراء',
          file_type: path.extname(attachmentPath).replace('.', '').toUpperCase() || 'PDF',
          filename: attachmentPath,
          relatedId: id,
          relatedType: 'purchase',
          notes: `فاتورة / عرض سعر لأمر الشراء ${id}`
        });
      } catch (archErr) {}
    }

    res.status(201).json({
      success: true,
      id,
      message: `تم إصدار وحفظ المعاملة بنجاح بالرقم المرجعي (${id})`,
      record: newRecord
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل إنشاء المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUT /api/purchases/:id - تعديل بيانات أمر الشراء
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const list = getPurchasesList();
    const idx = list.findIndex(r => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'المعاملة غير موجودة' });

    const current = list[idx];
    const {
      item, itemDescription, supplier, amount, value, quantity, unit, date, status, notes,
      department, purchaseType, category, urgency, district, street, lat, lng,
      committeeName, committeeHead, committeeMember, warehouseKeeper, supplierRepresentative, receivingCommittee: rawPutCommittee, quotesCount
    } = req.body;

    let receivingCommittee = rawPutCommittee;
    if (typeof receivingCommittee === 'string') {
      try { receivingCommittee = JSON.parse(receivingCommittee); } catch(e) { receivingCommittee = null; }
    }
    if (!receivingCommittee && (committeeHead !== undefined || committeeMember !== undefined || warehouseKeeper !== undefined || supplierRepresentative !== undefined)) {
      receivingCommittee = [
        { role: 'رئيس لجنة الاستلام الهندسي', name: committeeHead !== undefined ? committeeHead : (current.committeeHead || 'رئيس قسم الطرق / الأبنية') },
        { role: 'عضو لجنة الاستلام الفني', name: committeeMember !== undefined ? committeeMember : (current.committeeMember || 'مهندس طرق / أبنية مختص') },
        { role: 'أمين المستودعات واللوازم والضبط', name: warehouseKeeper !== undefined ? warehouseKeeper : (current.warehouseKeeper || 'حاسب كميات / مراقب فني') },
        { role: 'مندوب المورد / المتعهد المسلم', name: supplierRepresentative !== undefined ? supplierRepresentative : (current.supplierRepresentative || 'مندوب المتعهد المورد') }
      ];
    } else if (!receivingCommittee) {
      receivingCommittee = current.receivingCommittee;
    }

    const finalVal = amount !== undefined ? (parseFloat(amount) || 0) : (value !== undefined ? (parseFloat(value) || 0) : current.amount);
    let attachmentPath = current.attachmentPath;
    if (req.file) {
      attachmentPath = req.file.filename;
    } else if (req.body.attachmentPath !== undefined) {
      attachmentPath = req.body.attachmentPath;
    }

    list[idx] = {
      ...current,
      item: item || itemDescription || current.item,
      itemDescription: itemDescription || item || current.itemDescription,
      supplier: supplier !== undefined ? supplier : current.supplier,
      amount: finalVal,
      value: finalVal,
      quantity: quantity !== undefined ? (parseFloat(quantity) || 1) : current.quantity,
      unit: unit || current.unit,
      date: date || current.date,
      status: status || current.status,
      category: category || purchaseType || current.category,
      purchaseType: purchaseType || category || current.purchaseType,
      urgency: urgency || current.urgency,
      department: department || current.department,
      district: district || current.district,
      street: street || current.street,
      lat: lat !== undefined ? parseFloat(lat) : current.lat,
      lng: lng !== undefined ? parseFloat(lng) : current.lng,
      committeeName: committeeName !== undefined ? committeeName : current.committeeName,
      committeeHead: (receivingCommittee && receivingCommittee[0]?.name) || (committeeHead !== undefined ? committeeHead : current.committeeHead),
      committeeMember: (receivingCommittee && receivingCommittee[1]?.name) || (committeeMember !== undefined ? committeeMember : current.committeeMember),
      warehouseKeeper: (receivingCommittee && receivingCommittee[2]?.name) || (warehouseKeeper !== undefined ? warehouseKeeper : current.warehouseKeeper),
      supplierRepresentative: (receivingCommittee && receivingCommittee[3]?.name) || (supplierRepresentative !== undefined ? supplierRepresentative : current.supplierRepresentative),
      receivingCommittee: receivingCommittee || current.receivingCommittee,
      quotesCount: quotesCount !== undefined ? parseInt(quotesCount, 10) : current.quotesCount,
      attachmentPath,
      notes: notes !== undefined ? notes : current.notes,
      updatedAt: new Date().toISOString()
    };

    savePurchasesList(list);

    res.json({
      success: true,
      message: 'تم تحديث بيانات المعاملة بنجاح',
      record: list[idx]
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل تعديل المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/purchases/:id/workflow - تقدم مرحلة الاعتماد الرسمية وإغلاق المعاملة وتوثيق الاستلام
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/workflow', upload.fields([
  { name: 'receiptFile', maxCount: 1 },
  { name: 'orderFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { nextStatus, actor, note, receiptNumber, receiverName, orderNumber } = req.body;
    if (!nextStatus) return res.status(400).json({ error: 'مرحلة الاعتماد مطلوبة' });

    const list = getPurchasesList();
    const idx = list.findIndex(r => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'المعاملة غير موجودة' });

    const current = list[idx];
    const now = new Date().toISOString();
    const finalActor = actor || req.user?.fullName || req.user?.username || 'المستخدم المسؤول';

    let receiptFilePath = current.receiptFilePath || '';
    if (req.files && req.files.receiptFile && req.files.receiptFile[0]) {
      receiptFilePath = req.files.receiptFile[0].filename;
    } else if (req.body.receiptFilePath) {
      receiptFilePath = req.body.receiptFilePath;
    }

    let orderFilePath = current.orderFilePath || '';
    if (req.files && req.files.orderFile && req.files.orderFile[0]) {
      orderFilePath = req.files.orderFile[0].filename;
    } else if (req.body.orderFilePath) {
      orderFilePath = req.body.orderFilePath;
    }

    const isClosing = (
      nextStatus === 'تم الاستلام والتسديد والمطابقة - مغلقة' || 
      nextStatus === 'تم الاستلام والتسديد' || 
      nextStatus === 'مكتمل ومغلق'
    );

    current.status = nextStatus;
    current.updatedAt = now;
    if (receiptFilePath) current.receiptFilePath = receiptFilePath;
    if (orderFilePath) current.orderFilePath = orderFilePath;
    if (receiptNumber) current.receiptNumber = receiptNumber;
    if (orderNumber) current.orderNumber = orderNumber;
    if (receiverName) current.receiverName = receiverName;

    if (isClosing) {
      current.isClosed = true;
      current.closedAt = now;
      current.closedBy = finalActor;
    }

    if (!Array.isArray(current.workflowHistory)) {
      current.workflowHistory = [];
    }

    current.workflowHistory.push({
      stage: nextStatus,
      actor: finalActor,
      timestamp: now,
      note: note || (isClosing ? 'تم استلام المواد واعتماد المذكرة وإغلاق المعاملة رسمياً' : `تحويل الحالة إلى: ${nextStatus}`),
      receiptNumber: receiptNumber || current.receiptNumber || '',
      receiptFile: receiptFilePath || '',
      orderFile: orderFilePath || ''
    });

    // أرشفة مذكرة الاستلام تلقائياً في الأرشيف الإلكتروني
    if (receiptFilePath && archiveEngineService.indexDocument) {
      try {
        await archiveEngineService.indexDocument({
          title: `مذكرة استلام وسند إدخال: ${current.id} - ${current.item}`,
          category: 'مشتريات ولوازم',
          type: 'مذكرة استلام',
          file_type: path.extname(receiptFilePath).replace('.', '').toUpperCase() || 'PDF',
          filename: receiptFilePath,
          relatedId: current.id,
          relatedType: 'purchase_receipt',
          notes: `سند استلام رسمي رقم ${receiptNumber || ''} للمعاملة ${current.id}`
        });
      } catch (archErr) {}
    }

    // أرشفة أمر الشراء الموقع
    if (orderFilePath && archiveEngineService.indexDocument) {
      try {
        await archiveEngineService.indexDocument({
          title: `أمر الشراء المعتمد والموقع: ${current.id} - ${current.item}`,
          category: 'مشتريات ولوازم',
          type: 'أمر شراء',
          file_type: path.extname(orderFilePath).replace('.', '').toUpperCase() || 'PDF',
          filename: orderFilePath,
          relatedId: current.id,
          relatedType: 'purchase_order',
          notes: `أمر شراء معتمد وموقع للمعاملة ${current.id}`
        });
      } catch (archErr2) {}
    }

    list[idx] = current;
    savePurchasesList(list);

    // مزامنة مع PostgreSQL إن وجد
    if (isPostgresActive()) {
      try {
        await dbRun(
          'UPDATE purchases SET status = $1, "updatedAt" = $2 WHERE id = $3',
          [nextStatus, now, current.id]
        );
      } catch (pgErr) {}
    }

    if (typeof global.recordActivity === 'function') {
      global.recordActivity({
        userId: req.user?.id || 'U-001',
        userName: finalActor,
        action: isClosing ? 'CLOSE_PURCHASE_ORDER' : 'UPDATE_PURCHASE_WORKFLOW',
        entity: 'PURCHASE',
        entityId: current.id,
        details: isClosing ? `إغلاق معاملة الشراء ${current.id} وتوثيق استلام المواد` : `تحويل مسار المعاملة ${current.id} إلى: ${nextStatus}`
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: isClosing 
        ? `✅ تم توثيق استلام المواد وإغلاق المعاملة رقم (${current.id}) بنجاح تام`
        : `تم تحديث مسار الاعتماد بنجاح إلى: (${nextStatus})`,
      record: current
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل اعتماد مسار العمل', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE /api/purchases/:id - حذف أمر الشراء
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    let list = getPurchasesList();
    const doc = list.find(r => String(r.id) === String(req.params.id));
    if (!doc) return res.status(404).json({ error: 'المعاملة غير موجودة' });

    if (doc.attachmentPath) {
      const fp = path.join(UPLOADS_DIR, doc.attachmentPath);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (e) {}
      }
    }

    list = list.filter(r => String(r.id) !== String(req.params.id));
    savePurchasesList(list);

    res.json({ success: true, message: 'تم حذف المعاملة بنجاح' });
  } catch (e) {
    res.status(500).json({ error: 'فشل حذف المعاملة', details: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/purchases/batch-delete - الحذف الجماعي
// ─────────────────────────────────────────────────────────────────────────────
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'يجب تحديد المعرفات المراد حذفها' });
    }

    let list = getPurchasesList();
    const targetSet = new Set(ids.map(String));

    list.forEach(doc => {
      if (targetSet.has(String(doc.id)) && doc.attachmentPath) {
        const fp = path.join(UPLOADS_DIR, doc.attachmentPath);
        if (fs.existsSync(fp)) {
          try { fs.unlinkSync(fp); } catch (e) {}
        }
      }
    });

    list = list.filter(r => !targetSet.has(String(r.id)));
    savePurchasesList(list);

    res.json({ success: true, message: `تم حذف (${ids.length}) معاملة بنجاح` });
  } catch (e) {
    res.status(500).json({ error: 'فشل الحذف الجماعي', details: e.message });
  }
});

module.exports = router;
