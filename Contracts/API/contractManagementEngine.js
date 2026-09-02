/**
 * routes/contractManagementEngine.js
 * محرك وحدة إدارة العقود والضمانات البنكية المؤسسية (Enterprise Contract Management Engine)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v4.0 Enterprise
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const rbacManager = require('../../middlewares/rbacManager');
const cryptoSignatureService = require('../../services/cryptoSignatureService');
const { DEFAULT_CONTRACT_TYPES, DEFAULT_CLAUSES, replacePlaceholders, generateOfficialContractHTML } = require('../../services/contractTemplateEngine');
const { localContracts, localContractClauses, localBankGuarantees, localVariationOrders } = require('../../utils/localState');

const CONTRACT_UPLOADS_DIR = path.join(__dirname, '../../uploads/contracts');
if (!fs.existsSync(CONTRACT_UPLOADS_DIR)) {
  fs.mkdirSync(CONTRACT_UPLOADS_DIR, { recursive: true });
}

const contractStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CONTRACT_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'guarantee-' + uniqueSuffix + ext);
  }
});
const contractUpload = multer({
  storage: contractStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const { getPool, isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../../utils/database');

async function queryPg(req, sql, params = []) {
  try {
    const activePool = (req && req.app ? req.app.get('pgClient') : null) || getPool();
    if (isPostgresActive() && activePool) {
      return await activePool.query(sql, params);
    }
  } catch (err) {
    console.warn('⚠️ Database query note in Contracts engine:', err.message);
  }
  return { rows: [] };
}

// التأكد الذاتي من الأعمدة في قاعدة البيانات لمنع أخطاء السيرفر
(async () => {
  try {
    const activePool = getPool();
    if (isPostgresActive() && activePool) {
      await activePool.query(`
        ALTER TABLE public.contracts 
        ADD COLUMN IF NOT EXISTS procurement_type VARCHAR(50) DEFAULT 'TENDER',
        ADD COLUMN IF NOT EXISTS procurement_id VARCHAR(50),
        ADD COLUMN IF NOT EXISTS contract_type_id VARCHAR(50),
        ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS award_decision_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS award_date DATE,
        ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS execution_period_days INT DEFAULT 30,
        ADD COLUMN IF NOT EXISTS department VARCHAR(150),
        ADD COLUMN IF NOT EXISTS funding_source VARCHAR(150),
        ADD COLUMN IF NOT EXISTS supervising_engineer VARCHAR(150),
        ADD COLUMN IF NOT EXISTS handover_committee JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS guarantee_percentage DOUBLE PRECISION DEFAULT 10,
        ADD COLUMN IF NOT EXISTS first_party_info JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS second_party_info JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS workflow_history JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS digital_signatures JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64),
        ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS guarantee_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS guarantee_value NUMERIC(15,2),
        ADD COLUMN IF NOT EXISTS guarantee_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS guarantee_attachment JSONB,
        ADD COLUMN IF NOT EXISTS signed_contract_attachment JSONB,
        ADD COLUMN IF NOT EXISTS approval_stage VARCHAR(50) DEFAULT 'PREPARED',
        ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS additional_guarantees JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS guarantee_extensions JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
      `);
    }
  } catch (e) {}
})();

// مسار رفع وثائق الكفالات والعقود الرسمية
router.post('/upload', contractUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم استلام أي ملف' });
    }
    const fileUrl = `/uploads/contracts/${req.file.filename}`;
    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
        url: fileUrl,
        date: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. العمليات الشرائية والبحث الذكي للتعبئة التلقائية (Procurement Auto-Populate)
// ==========================================

// 1.1 استعلام جميع العمليات الشرائية المتاحة
router.get('/procurements', rbacManager.verifyToken, async (req, res, next) => {
  try {
    let procurements = [];

    // أ) سحب العطاءات (Tenders)
    try {
      const resTenders = await queryPg(req, 'SELECT * FROM public.tenders ORDER BY id DESC');
      if (resTenders.rows.length) {
        resTenders.rows.forEach(t => {
          procurements.push({
            procurement_type: 'TENDER',
            procurement_type_name: 'عطاء',
            procurement_id: t.id,
            project_name: t.name,
            tender_number: t.id,
            contractor_name: t.contractor || 'غير محدد',
            value: parseFloat(t.value || t.budget || 0),
            award_decision_number: `DEC-${t.id}`,
            award_date: t.openDate || new Date().toISOString().split('T')[0],
            execution_period_days: 60,
            department: 'قسم المشروعات والعطاءات',
            funding_source: 'موازنة البلدية الذاتية',
            supervising_engineer: 'م. أحمد الخشمان',
            handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي', 'رئيس القسم'],
            guarantee_percentage: 10,
            raw_data: t
          });
        });
      }
    } catch {}

    // ب) سحب طلبات الشراء المباشر والاتفاقيات الإطارية (Purchases)
    try {
      const resPurchases = await queryPg(req, 'SELECT * FROM public.purchases ORDER BY id DESC');
      if (resPurchases.rows.length) {
        resPurchases.rows.forEach(p => {
          procurements.push({
            procurement_type: 'DIRECT_PURCHASE',
            procurement_type_name: 'شراء مباشر / أمر شراء',
            procurement_id: p.id,
            project_name: p.itemDescription || p.supplier,
            tender_number: p.id,
            contractor_name: p.supplier || 'غير محدد',
            value: parseFloat(p.amount || 0),
            award_decision_number: `PUR-DEC-${p.id}`,
            award_date: p.date || new Date().toISOString().split('T')[0],
            execution_period_days: 15,
            department: 'قسم المشتريات واللوازم',
            funding_source: 'موازنة البلدية الذاتية',
            supervising_engineer: 'م. سامر الفريحات',
            handover_committee: ['رئيس القسم', 'أمين المستودع'],
            guarantee_percentage: 5,
            raw_data: p
          });
        });
      }
    } catch {}

    res.json({ success: true, count: procurements.length, data: procurements });
  } catch (err) { next(err); }
});

// 1.2 سحب التفاصيل الكاملة لعملية شرائية لتعبئة العقد إلكترونياً بالكامل
router.get('/procurement-details/:type/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { type, id } = req.params;
  try {
    let details = null;

    if (type === 'TENDER' || type === 'tenders') {
      try {
        const result = await queryPg(req, 'SELECT * FROM public.tenders WHERE id = $1', [id]);
        if (result.rows.length) {
          const t = result.rows[0];
          details = {
            procurement_type: 'TENDER',
            procurement_id: t.id,
            project_name: t.name,
            tender_name: t.name,
            tender_number: t.id,
            award_decision_number: `DEC-${t.id}`,
            contractor_name: t.contractor || 'غير محدد',
            contractor_id: 'CTR-' + String(t.contractor || '001').replace(/\s+/g, ''),
            total_value: parseFloat(t.value || t.budget || 0),
            execution_period_days: 60,
            award_date: t.openDate || new Date().toISOString().split('T')[0],
            department: 'قسم المشروعات والعطاءات',
            funding_source: 'موازنة البلدية الذاتية',
            supervising_engineer: 'م. أحمد الخشمان',
            handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي', 'ممثل المالية'],
            guarantee_percentage: 10,
            required_guarantees: ['ضمان حسن التنفيذ (10%)', 'ضمان الصيانة (5%)'],
            attachments: t.attachments || []
          };
        }
      } catch {}
    }

    if (!details) {
      details = {
        procurement_type: type || 'TENDER',
        procurement_id: id,
        project_name: `مشروع العملية الشرائية ${id}`,
        tender_name: `عطاء رقم ${id}`,
        tender_number: id,
        award_decision_number: `DEC-${id}`,
        contractor_name: 'مؤسسة الخدمات العامة والمقاولات',
        contractor_id: 'CTR-9901',
        total_value: 50000,
        execution_period_days: 60,
        award_date: new Date().toISOString().split('T')[0],
        department: 'مديرية الأشغال والخدمات الهندسية',
        funding_source: 'موازنة البلدية',
        supervising_engineer: 'مهندس الأشغال المشرف',
        handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي'],
        guarantee_percentage: 10,
        required_guarantees: ['ضمان حسن التنفيذ (10%)', 'ضمان الصيانة (5%)'],
        attachments: []
      };
    }

    res.json({ success: true, data: details });
  } catch (err) { next(err); }
});

// ==========================================
// 2. إدارة أنواع العقود وقوالب النظام (Contract Types & Templates)
// ==========================================

router.get('/contract-types', async (req, res, next) => {
  try {
    const result = await queryPg(req, 'SELECT * FROM public.contract_types ORDER BY created_at ASC');
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) { next(err); }
});

// ==========================================
// 2.5 مسارات ثابتة تُسجَّل قبل /:id لمنع الالتباس (Fixed Routes BEFORE /:id)
// ==========================================

// تنبيهات الكفالات البنكية (يجب أن تُسجَّل قبل /:id)
router.get('/guarantees/alerts', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const result = await queryPg(req, `
        SELECT bg.*, c.title as contract_title, c.contractor_name, c.contract_number
        FROM public.bank_guarantees bg
        LEFT JOIN public.contracts c ON bg.contract_id = c.id
        ORDER BY bg.expiry_date ASC
      `);
      const guarantees = result.rows;

    const now = new Date();
    const alerts = {
      within_30_days: [],
      within_60_days: [],
      within_90_days: [],
      expired: []
    };

    guarantees.forEach(g => {
      if (!g.expiry_date) return;
      const expiry = new Date(g.expiry_date);
      const diffTime = expiry - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        alerts.expired.push({ ...g, days_left: diffDays, alert_level: 'DANGER' });
      } else if (diffDays <= 30) {
        alerts.within_30_days.push({ ...g, days_left: diffDays, alert_level: 'CRITICAL' });
      } else if (diffDays <= 60) {
        alerts.within_60_days.push({ ...g, days_left: diffDays, alert_level: 'WARNING' });
      } else if (diffDays <= 90) {
        alerts.within_90_days.push({ ...g, days_left: diffDays, alert_level: 'INFO' });
      }
    });

    res.json({ success: true, alerts });
  } catch (err) { next(err); }
});

// الإحصائيات التنفيذية (يجب أن تُسجَّل قبل /:id)
router.get('/analytics/kpis', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const result = await queryPg(req, 'SELECT * FROM public.contracts');
    const contracts = result.rows;

    const totalCount = contracts.length;
    const activeCount = contracts.filter(c => c.status === 'ACTIVE' || c.status === 'ELECTRONICALLY_SIGNED').length;
    const totalValueSum = contracts.reduce((acc, curr) => acc + (parseFloat(curr.total_value) || 0), 0);
    const completedCount = contracts.filter(c => c.status === 'COMPLETED').length;

    res.json({
      success: true,
      data: {
        total_contracts: totalCount,
        active_contracts: activeCount,
        completed_contracts: completedCount,
        total_value_jod: totalValueSum,
        total_guarantees_count: (await queryPg(req, "SELECT COUNT(*) as count FROM public.bank_guarantees")).rows[0].count
      }
    });
  } catch (err) { next(err); }
});

// ==========================================
// 3. إدارة العقود الرئيسية (Contracts Main CRUD & Smart Search)
// ==========================================

// 3.1 البحث المتقدم والفلترة الشاملة لسجل العقود
router.get('/', rbacManager.verifyToken, async (req, res, next) => {
  const { search, status, contractType, contractor, bank, minVal, maxVal, engineer } = req.query;
  try {
    let contracts = [];
    
      let query = `
        SELECT c.*, 
               ct.name as contract_type_name,
               COALESCE((SELECT json_agg(bg.*) FROM public.bank_guarantees bg WHERE bg.contract_id = c.id), '[]'::json) as guarantees_list,
               COALESCE((SELECT json_agg(vo.*) FROM public.contract_variation_orders vo WHERE vo.contract_id = c.id), '[]'::json) as variation_orders_list
        FROM public.contracts c
        LEFT JOIN public.contract_types ct ON c.contract_type_id = ct.id
        WHERE 1=1
      `;
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (c.id ILIKE $${params.length} OR c.title ILIKE $${params.length} OR c.contract_number ILIKE $${params.length} OR c.contractor_name ILIKE $${params.length} OR c.tender_id ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }
      if (contractor) {
        params.push(`%${contractor}%`);
        query += ` AND c.contractor_name ILIKE $${params.length}`;
      }
      if (engineer) {
        params.push(`%${engineer}%`);
        query += ` AND c.supervising_engineer ILIKE $${params.length}`;
      }
      if (minVal) {
        params.push(parseFloat(minVal));
        query += ` AND c.total_value >= $${params.length}`;
      }
      if (maxVal) {
        params.push(parseFloat(maxVal));
        query += ` AND c.total_value <= $${params.length}`;
      }

      query += ' ORDER BY c.created_at DESC';
      const result = await queryPg(req, query, params);
      contracts = result.rows;
    

    res.json({ success: true, count: contracts.length, data: contracts });
  } catch (err) { next(err); }
});

// 3.2 استعلام بيانات عقد محدد بالتفصيل (يجب أن يكون بعد كل المسارات الثابتة)
router.get('/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    let contract = null;
    let clauses = [];
    let guarantees = [];
    let variationOrders = [];

    const cRes = await queryPg(req, 'SELECT * FROM public.contracts WHERE id = $1', [id]);
    if (cRes.rows.length) contract = cRes.rows[0];

    const clRes = await queryPg(req, 'SELECT * FROM public.contract_clauses WHERE contract_id = $1 ORDER BY clause_number ASC', [id]);
    if (clRes.rows.length) clauses = clRes.rows;

    const gRes = await queryPg(req, 'SELECT * FROM public.bank_guarantees WHERE contract_id = $1 ORDER BY created_at DESC', [id]);
    if (gRes.rows.length) guarantees = gRes.rows;

    const vRes = await queryPg(req, 'SELECT * FROM public.contract_variation_orders WHERE contract_id = $1 ORDER BY created_at DESC', [id]);
    if (vRes.rows.length) variationOrders = vRes.rows;

    if (!contract) {
      return res.status(404).json({ success: false, error: 'العقد المطلوب غير موجود.' });
    }

    res.json({
      success: true,
      data: {
        ...contract,
        clauses,
        guarantees,
        variation_orders: variationOrders
      }
    });
  } catch (err) { next(err); }
});

// 3.4 حذف عقد نهائياً من النظام (خاص بمدير النظام وصاحب الصلاحية)
router.delete('/:id', rbacManager.verifyToken, rbacManager.requirePermission('CONTRACTS.DELETE'), async (req, res, next) => {
  const { id } = req.params;
  try {
    // الحذف من قاعدة البيانات
    try {
      await queryPg(req, 'DELETE FROM public.contract_clauses WHERE contract_id = $1', [id]);
      await queryPg(req, 'DELETE FROM public.bank_guarantees WHERE contract_id = $1', [id]);
      await queryPg(req, 'DELETE FROM public.contracts WHERE id = $1', [id]);
    } catch (dbErr) {
      console.warn('⚠️ DB Delete fallback notice:', dbErr.message);
    }

    res.json({ success: true, message: 'تم حذف العقد وكافة بنوده وكفالاته نهائياً من النظام بنجاح' });
  } catch (err) { next(err); }
});

// 3.3 إنشاء وتوثيق عقد جديد وحفظه في قاعدة البيانات
router.post('/', rbacManager.verifyToken, rbacManager.requirePermission('CONTRACTS.CREATE'), async (req, res, next) => {
  const data = req.body;
  const contractId = data.id || `CNT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const finalContractNumber = data.contract_number || `CN-KAF-${Date.now().toString().slice(-5)}`;
  const val = parseFloat(data.total_value || data.contractValue || 0);
  const periodDays = parseInt(data.execution_period_days || data.durationDays || 30);
  const startD = data.start_date || new Date().toISOString().split('T')[0];
  const endD = data.end_date || new Date(Date.now() + periodDays * 86400000).toISOString().split('T')[0];

  const hashContent = `${contractId}|${data.tender_id || data.procurement_id}|${data.contractor_name}|${val}|${startD}|${endD}`;
  const sha256Hash = crypto.createHash('sha256').update(hashContent).digest('hex');

  const contractObj = {
    id: contractId,
    procurement_type: data.procurement_type || 'TENDER',
    procurement_id: data.procurement_id || data.tender_id || null,
    contract_type_id: data.contract_type_id || 'CT-WORKS',
    tender_id: data.tender_id || data.procurement_id || null,
    contract_number: finalContractNumber,
    award_decision_number: data.award_decision_number || `DEC-${contractId}`,
    award_date: data.award_date || startD,
    title: data.title || `عقد مشروع ${contractId}`,
    contractor_id: data.contractor_id || '',
    contractor_name: data.contractor_name || 'المقاول المحال عليه',
    total_value: val,
    execution_period_days: periodDays,
    start_date: startD,
    end_date: endD,
    bank_name: data.bank_name || '',
    guarantee_number: data.guarantee_number || '',
    guarantee_value: parseFloat(data.guarantee_value || 0),
    guarantee_expiry_date: data.guarantee_expiry_date || null,
    guarantee_attachment: data.guarantee_attachment || null,
    signed_contract_attachment: data.signed_contract_attachment || null,
    department: data.department || 'مديرية الأشغال والخدمات الهندسية',
    funding_source: data.funding_source || 'موازنة البلدية الذاتية',
    supervising_engineer: data.supervising_engineer || 'مهندس المشاريع المشرف',
    handover_committee: data.handover_committee || ['م. أحمد الخشمان', 'م. خالد الصمادي'],
    guarantee_percentage: parseFloat(data.guarantee_percentage || 10),
    approval_stage: data.approval_stage || 'PREPARED',
    approval_history: data.approval_history || [{ stage: 'PREPARED', by: req.user ? req.user.username : 'ADMIN', date: new Date().toISOString().split('T')[0], notes: 'إنشاء مسودة العقد' }],
    additional_guarantees: data.additional_guarantees || [],
    guarantee_extensions: data.guarantee_extensions || [],
    status: data.status || 'PENDING',
    workflow_history: [{ status: 'PREPARED', date: new Date().toISOString(), user: req.user ? req.user.username : 'ADMIN', note: 'إنشاء وتوثيق العقد' }],
    sha256_hash: sha256Hash,
    notes: data.notes || '',
    clauses: data.clauses || DEFAULT_CLAUSES,
    created_by: req.user ? req.user.id : 'ADMIN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    await queryPg(req, `
      INSERT INTO public.contracts (
        id, procurement_type, procurement_id, contract_type_id, tender_id, contract_number, award_decision_number,
        award_date, title, contractor_id, contractor_name, total_value, execution_period_days, start_date, end_date,
        department, funding_source, supervising_engineer, handover_committee, guarantee_percentage,
        bank_name, guarantee_number, guarantee_value, guarantee_expiry_date, guarantee_attachment, signed_contract_attachment,
        approval_stage, approval_history, additional_guarantees, guarantee_extensions,
        status, workflow_history, sha256_hash, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20,
        $21, $22, $23, $24, $25::jsonb, $26::jsonb, $27, $28::jsonb, $29::jsonb, $30::jsonb, $31, $32::jsonb, $33, $34, $35, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        contract_number = EXCLUDED.contract_number,
        contractor_name = EXCLUDED.contractor_name,
        total_value = EXCLUDED.total_value,
        bank_name = EXCLUDED.bank_name,
        guarantee_number = EXCLUDED.guarantee_number,
        guarantee_value = EXCLUDED.guarantee_value,
        guarantee_expiry_date = EXCLUDED.guarantee_expiry_date,
        guarantee_attachment = EXCLUDED.guarantee_attachment,
        signed_contract_attachment = EXCLUDED.signed_contract_attachment,
        approval_stage = EXCLUDED.approval_stage,
        approval_history = EXCLUDED.approval_history,
        additional_guarantees = EXCLUDED.additional_guarantees,
        guarantee_extensions = EXCLUDED.guarantee_extensions,
        status = EXCLUDED.status,
        updated_at = NOW();
    `, [
      contractId, contractObj.procurement_type, contractObj.procurement_id, contractObj.contract_type_id,
      contractObj.tender_id, contractObj.contract_number, contractObj.award_decision_number,
      contractObj.award_date, contractObj.title, contractObj.contractor_id, contractObj.contractor_name,
      contractObj.total_value, contractObj.execution_period_days, contractObj.start_date, contractObj.end_date,
      contractObj.department, contractObj.funding_source, contractObj.supervising_engineer,
      JSON.stringify(contractObj.handover_committee), contractObj.guarantee_percentage,
      contractObj.bank_name, contractObj.guarantee_number, contractObj.guarantee_value,
      contractObj.guarantee_expiry_date, JSON.stringify(contractObj.guarantee_attachment),
      JSON.stringify(contractObj.signed_contract_attachment),
      contractObj.approval_stage, JSON.stringify(contractObj.approval_history),
      JSON.stringify(contractObj.additional_guarantees), JSON.stringify(contractObj.guarantee_extensions),
      contractObj.status, JSON.stringify(contractObj.workflow_history), contractObj.sha256_hash,
      contractObj.notes, contractObj.created_by
    ]);
  } catch (dbErr) {
    console.warn('⚠️ DB Insert notice:', dbErr.message);
  }

  res.status(201).json({ success: true, message: 'تم حفظ وتوثيق العقد في قاعدة البيانات بنجاح', data: contractObj });
});

// 3.3.1 تحديث بيانات العقد والكفالات المرفقة
router.put('/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const data = req.body;
  try {
    try {
      await queryPg(req, `
        UPDATE public.contracts SET
          title = COALESCE($1, title),
          contract_number = COALESCE($2, contract_number),
          tender_id = COALESCE($3, tender_id),
          contractor_name = COALESCE($4, contractor_name),
          total_value = COALESCE($5, total_value),
          award_date = COALESCE($6, award_date),
          start_date = COALESCE($7, start_date),
          execution_period_days = COALESCE($8, execution_period_days),
          end_date = COALESCE($9, end_date),
          bank_name = COALESCE($10, bank_name),
          guarantee_number = COALESCE($11, guarantee_number),
          guarantee_value = COALESCE($12, guarantee_value),
          guarantee_expiry_date = COALESCE($13, guarantee_expiry_date),
          guarantee_attachment = $14::jsonb,
          signed_contract_attachment = $15::jsonb,
          approval_stage = COALESCE($16, approval_stage),
          approval_history = $17::jsonb,
          additional_guarantees = $18::jsonb,
          guarantee_extensions = $19::jsonb,
          status = COALESCE($20, status),
          supervising_engineer = COALESCE($21, supervising_engineer),
          funding_source = COALESCE($22, funding_source),
          updated_at = NOW()
        WHERE id = $23
      `, [
        data.title, data.contract_number, data.tender_id || data.procurement_id, data.contractor_name,
        data.total_value, data.award_date || null, data.start_date || null, data.execution_period_days,
        data.end_date || null, data.bank_name, data.guarantee_number, data.guarantee_value,
        data.guarantee_expiry_date || null, JSON.stringify(data.guarantee_attachment || null),
        JSON.stringify(data.signed_contract_attachment || null),
        data.approval_stage, JSON.stringify(data.approval_history || []),
        JSON.stringify(data.additional_guarantees || []), JSON.stringify(data.guarantee_extensions || []),
        data.status, data.supervising_engineer, data.funding_source, id
      ]);
    } catch (dbErr) {
      console.warn('⚠️ DB Update notice:', dbErr.message);
    }
    res.json({ success: true, message: 'تم تحديث بيانات العقد والكفالات بنجاح', data });
  } catch (err) { next(err); }
});

// ==========================================
// 4. إدارة بنود العقد الحرة (Contract Clauses Editor & Reordering)
// ==========================================

router.get('/:id/clauses', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await queryPg(req, 'SELECT * FROM public.contract_clauses WHERE contract_id = $1 ORDER BY clause_number ASC', [id]);
    const clauses = result.rows;
    res.json({ success: true, count: clauses.length, data: clauses });
  } catch (err) { next(err); }
});

router.post('/:id/clauses', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { title, content, clauseNumber, isMandatory, isOptional, showInPrint, showInElectronic } = req.body;

  const clauseId = `CLS-${id}-${Date.now()}`;
  const num = parseInt(clauseNumber || (localContractClauses.length + 1));
  const clauseObj = {
    id: clauseId,
    contract_id: id,
    clause_number: num,
    clause_code: `C-${num}`,
    title,
    content,
    display_order: num,
    is_mandatory: isMandatory !== false,
    is_optional: isOptional === true,
    show_in_print: showInPrint !== false,
    show_in_electronic: showInElectronic !== false,
    created_at: new Date().toISOString()
  };

  
  

  try {
    await queryPg(req, `
      INSERT INTO public.contract_clauses (id, contract_id, clause_number, clause_code, title, content, display_order, is_mandatory, is_optional, show_in_print, show_in_electronic)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [clauseId, id, num, `C-${num}`, title, content, num, isMandatory !== false, isOptional === true, showInPrint !== false, showInElectronic !== false]);
  } catch {}

  res.status(201).json({ success: true, data: clauseObj });
});

router.post('/:id/clauses/reorder', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { clauseIds } = req.body; // قائمة الآيدي مرتبة

  if (!Array.isArray(clauseIds)) {
    return res.status(400).json({ success: false, error: 'ترتيب البنود غير صالح' });
  }

  try {
    for (let i = 0; i < clauseIds.length; i++) {
      await queryPg(req, 'UPDATE public.contract_clauses SET clause_number = $1, display_order = $1 WHERE id = $2 AND contract_id = $3', [i + 1, clauseIds[i], id]);
    }
  } catch {}

  res.json({ success: true, message: 'تم إعادة ترتيب بنود العقد بنجاح' });
});

router.put('/:id/clauses/:clauseId', rbacManager.verifyToken, async (req, res, next) => {
  const { id, clauseId } = req.params;
  const { title, content, isMandatory, showInPrint } = req.body;

  const found = localContractClauses.find(cl => String(cl.id) === String(clauseId) && String(cl.contract_id) === String(id));
  if (found) {
    if (title !== undefined) found.title = title;
    if (content !== undefined) found.content = content;
    if (isMandatory !== undefined) found.is_mandatory = isMandatory;
    if (showInPrint !== undefined) found.show_in_print = showInPrint;
  }

  

  try {
    await queryPg(req, `
      UPDATE public.contract_clauses
      SET title = COALESCE($1, title),
          content = COALESCE($2, content),
          is_mandatory = COALESCE($3, is_mandatory),
          show_in_print = COALESCE($4, show_in_print)
      WHERE id = $5 AND contract_id = $6
    `, [title || null, content || null, isMandatory !== undefined ? isMandatory : null, showInPrint !== undefined ? showInPrint : null, clauseId, id]);
  } catch {}

  res.json({ success: true, message: 'تم تحديث بيانات البند بنجاح', data: found });
});

router.post('/:id/clauses/:clauseId/duplicate', rbacManager.verifyToken, async (req, res, next) => {
  const { id, clauseId } = req.params;
  const target = localContractClauses.find(cl => String(cl.id) === String(clauseId) && String(cl.contract_id) === String(id));

  if (!target) {
    return res.status(404).json({ success: false, error: 'البند غير موجود.' });
  }

  const newNum = localContractClauses.filter(c => String(c.contract_id) === String(id)).length + 1;
  const newClauseId = `CLS-${id}-${Date.now()}`;
  const duplicatedObj = {
    ...target,
    id: newClauseId,
    clause_number: newNum,
    title: `${target.title} (نسخة مكررة)`,
    display_order: newNum,
    created_at: new Date().toISOString()
  };

  
  try {
    await queryPg(req, 'DELETE FROM public.contract_clauses WHERE id = $1 AND contract_id = $2', [clauseId, id]);
  } catch {}
  res.json({ success: true, message: 'تم حذف بند العقد بنجاح' });
});

// 4.5 تعديل نموذج العقد المخصص قبل الطباعة حسب الصلاحية الممنوحة
router.put('/:id/custom-template', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { title, firstPartyInfo, secondPartyInfo, notes } = req.body;

  // فحص الصلاحية
  const allowedRoles = ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor'];
  const userRole = req.user && req.user.role ? String(req.user.role).toLowerCase() : 'admin';

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل نموذج العقد قبل الطباعة. هذه الصلاحية مقتصرة على مديري الأشغال والمهندسين.' });
  }

  const contract = localContracts.find(c => String(c.id) === String(id));
  if (contract) {
    if (title) contract.title = title;
    if (firstPartyInfo) contract.first_party_info = firstPartyInfo;
    if (secondPartyInfo) contract.second_party_info = secondPartyInfo;
    if (notes !== undefined) contract.notes = notes;
    
  }

  try {
    await queryPg(req, `
      UPDATE public.contracts
      SET title = COALESCE($1, title),
          first_party_info = COALESCE($2::jsonb, first_party_info),
          second_party_info = COALESCE($3::jsonb, second_party_info),
          notes = COALESCE($4, notes),
          updated_at = NOW()
      WHERE id = $5
    `, [title || null, firstPartyInfo ? JSON.stringify(firstPartyInfo) : null, secondPartyInfo ? JSON.stringify(secondPartyInfo) : null, notes !== undefined ? notes : null, id]);
  } catch {}

  res.json({ success: true, message: 'تم حفظ وتخصيص نموذج العقد قبل الطباعة بنجاح', data: contract });
});


// 5.2 إضافة كفالة بنكية جديدة
router.post('/:id/guarantees', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { guaranteeType, guaranteeNumber, issuingBank, bankBranch, amount, percentage, issueDate, expiryDate, notes } = req.body;

  const bgId = `BG-${Date.now()}`;
  const qrData = `KAF-BG|ID:${bgId}|NUM:${guaranteeNumber}|BANK:${issuingBank}|AMT:${amount}|EXP:${expiryDate}`;
  const barcodeData = `BG-${guaranteeNumber}`;

  const guaranteeObj = {
    id: bgId,
    contract_id: id,
    guarantee_type: guaranteeType || 'PERFORMANCE_BOND',
    guarantee_number: guaranteeNumber,
    issuing_bank: issuingBank,
    bank_branch: bankBranch || 'فرع رئيسي',
    amount: parseFloat(amount || 0),
    percentage: parseFloat(percentage || 0),
    issue_date: issueDate,
    expiry_date: expiryDate,
    status: 'ACTIVE',
    qr_code_data: qrData,
    barcode_data: barcodeData,
    notes: notes || '',
    created_at: new Date().toISOString()
  };

  localBankGuarantees.push(guaranteeObj);
  

  try {
    await queryPg(req, `
      INSERT INTO public.bank_guarantees (id, contract_id, guarantee_type, guarantee_number, issuing_bank, bank_branch, amount, percentage, issue_date, expiry_date, status, qr_code_data, barcode_data, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [bgId, id, guaranteeType || 'PERFORMANCE_BOND', guaranteeNumber, issuingBank, bankBranch || '', parseFloat(amount || 0), parseFloat(percentage || 0), issueDate, expiryDate, 'ACTIVE', qrData, barcodeData, notes || '']);
  } catch {}

  res.status(201).json({ success: true, message: 'تم إضافة الكفالة البنكية بنجاح وتوليد رموز التحقق QR والباركود', data: guaranteeObj });
});

// 5.3 إجراءات تجديد / مصادرة / إفراج الكفالة البنكية
router.post('/guarantees/:guaranteeId/:action', rbacManager.verifyToken, async (req, res, next) => {
  const { guaranteeId, action } = req.params;
  const { newExpiryDate, reason } = req.body;

  const found = localBankGuarantees.find(g => String(g.id) === String(guaranteeId));
  if (found) {
    if (action === 'renew') {
      found.expiry_date = newExpiryDate || found.expiry_date;
      found.status = 'ACTIVE';
    } else if (action === 'confiscate') {
      found.status = 'CONFISCATED';
    } else if (action === 'release') {
      found.status = 'RELEASED';
    }
  }

  try {
    if (action === 'renew') {
      await queryPg(req, 'UPDATE public.bank_guarantees SET expiry_date = $1, status = $2, updated_at = NOW() WHERE id = $3', [newExpiryDate, 'ACTIVE', guaranteeId]);
    } else if (action === 'confiscate') {
      await queryPg(req, 'UPDATE public.bank_guarantees SET status = $1, updated_at = NOW() WHERE id = $2', ['CONFISCATED', guaranteeId]);
    } else if (action === 'release') {
      await queryPg(req, 'UPDATE public.bank_guarantees SET status = $1, updated_at = NOW() WHERE id = $2', ['RELEASED', guaranteeId]);
    }
  } catch {}

  res.json({ success: true, message: `تم تنفيذ إجراء (${action}) على الكفالة بنجاح` });
});

// ==========================================
// 6. دورة حياة العقد والتوقيع التشفيري (Workflow & SHA-256 E-Signature)
// ==========================================

// 6.1 الانتقال في مسار دورة حياة العقد (Workflow Engine)
router.post('/:id/workflow', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { nextStatus, notes } = req.body;

  const ALLOWED_STAGES = [
    'DRAFT', 'REVIEW', 'LEGAL_AUDIT', 'MANAGER_APPROVAL',
    'PRESIDENT_APPROVAL', 'ELECTRONICALLY_SIGNED', 'ACTIVE',
    'AMENDMENT', 'EXTENSION', 'COMPLETED', 'RESCINDED', 'ARCHIVED'
  ];

  if (!ALLOWED_STAGES.includes(nextStatus)) {
    return res.status(400).json({ success: false, error: 'مرحلة الاعتماد غير معرفة داخل المحرك.' });
  }

  const contract = localContracts.find(c => String(c.id) === String(id));
  if (contract) {
    contract.status = nextStatus;
    if (!contract.workflow_history) contract.workflow_history = [];
    contract.workflow_history.push({
      status: nextStatus,
      date: new Date().toISOString(),
      user: req.user ? req.user.username : 'ADMIN',
      notes: notes || ''
    });
  }

  try {
    await queryPg(req, `
      UPDATE public.contracts 
      SET status = $1, 
          workflow_history = workflow_history || $2::jsonb,
          updated_at = NOW()
      WHERE id = $3
    `, [nextStatus, JSON.stringify([{ status: nextStatus, date: new Date().toISOString(), user: req.user ? req.user.username : 'ADMIN', notes: notes || '' }]), id]);
  } catch {}

  res.json({ success: true, message: `تم تحديث حالة العقد إلى (${nextStatus}) بنجاح`, newStatus: nextStatus });
});

// 6.2 التوقيع الإلكتروني التشفيري والتوقيع الثلاثي مع حاسب SHA-256
router.post('/:id/sign', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { party, signerName, signatureImage, sealImage } = req.body;

  const contract = localContracts.find(c => String(c.id) === String(id));
  if (!contract) {
    return res.status(404).json({ success: false, error: 'العقد غير موجود.' });
  }

  // حساب الهاش التشفيري
  const dataToHash = `${contract.id}|${contract.total_value}|${contract.contractor_name}|${new Date().toISOString()}`;
  const signatureHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

  if (!contract.digital_signatures) contract.digital_signatures = {};

  contract.digital_signatures[party || 'first_party'] = {
    signer_name: signerName || (party === 'first_party' ? 'رئيس بلدية كفرنجة الجديدة' : contract.contractor_name),
    signature_image: signatureImage || '',
    seal_image: sealImage || '',
    hash: signatureHash,
    signed_at: new Date().toISOString()
  };

  contract.sha256_hash = signatureHash;
  contract.status = 'ELECTRONICALLY_SIGNED';
  

  try {
    await queryPg(req, `
      UPDATE public.contracts 
      SET digital_signatures = $1::jsonb,
          sha256_hash = $2,
          status = 'ELECTRONICALLY_SIGNED',
          updated_at = NOW()
      WHERE id = $3
    `, [JSON.stringify(contract.digital_signatures), signatureHash, id]);
  } catch {}

  res.json({
    success: true,
    message: 'تم إتمام التوقيع الإلكتروني والتثبيت التشفيري للعقد بنجاح',
    sha256_hash: signatureHash,
    signatures: contract.digital_signatures
  });
});

// ==========================================
// 6.5 محرك الرقابة والتنبيهات الذكية للكفالات البنكية (Bank Guarantees Smart Expiry Alerts)
// ==========================================

router.get('/guarantees/alerts', rbacManager.verifyToken, async (req, res, next) => {
  try {
    let contracts = localContracts;
    try {
      const cRes = await queryPg(req, 'SELECT id, contract_number, title, contractor_name, total_value, bank_name, guarantee_number, guarantee_value, guarantee_expiry_date, status, guarantee_attachment FROM public.contracts WHERE guarantee_expiry_date IS NOT NULL');
      if (cRes.rows && cRes.rows.length) contracts = cRes.rows;
    } catch {}

    const now = new Date();
    const alerts = [];
    let expiredCount = 0, criticalCount = 0, warningCount = 0, safeCount = 0, totalGuaranteeValue = 0;

    contracts.forEach(c => {
      if (!c.guarantee_expiry_date) return;
      const expDate = new Date(c.guarantee_expiry_date);
      const diffTime = expDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const gVal = parseFloat(c.guarantee_value || 0) || (parseFloat(c.total_value || 0) * 0.1);
      totalGuaranteeValue += gVal;

      let urgency = 'SAFE';
      let urgencyLabel = 'سارية المفعول';
      let badgeClass = 'badge-success';

      if (daysRemaining <= 0) {
        urgency = 'EXPIRED';
        urgencyLabel = 'منتهية الصلاحية (تستوجب المصادرة أو التجديد الفوري)';
        badgeClass = 'badge-danger';
        expiredCount++;
      } else if (daysRemaining <= 15) {
        urgency = 'CRITICAL';
        urgencyLabel = 'حرجة (تنتهي خلال أقل من 15 يوماً)';
        badgeClass = 'badge-danger';
        criticalCount++;
      } else if (daysRemaining <= 30) {
        urgency = 'WARNING';
        urgencyLabel = 'تنبيه (تنتهي خلال 30 يوماً)';
        badgeClass = 'badge-warning';
        warningCount++;
      } else {
        safeCount++;
      }

      alerts.push({
        contract_id: c.id,
        contract_number: c.contract_number || c.id,
        contract_title: c.title || `مشروع ${c.id}`,
        contractor_name: c.contractor_name || 'غير محدد',
        bank_name: c.bank_name || 'البنك الإسلامي الأردني',
        guarantee_number: c.guarantee_number || `BG-${c.id}`,
        guarantee_value: gVal,
        guarantee_expiry_date: c.guarantee_expiry_date,
        days_remaining: daysRemaining,
        urgency,
        urgency_label: urgencyLabel,
        badge_class: badgeClass,
        contract_status: c.status || 'ACTIVE'
      });
    });

    alerts.sort((a, b) => a.days_remaining - b.days_remaining);

    res.json({
      success: true,
      summary: {
        total_tracked: alerts.length,
        expired_count: expiredCount,
        critical_count: criticalCount,
        warning_count: warningCount,
        safe_count: safeCount,
        total_guarantee_value: totalGuaranteeValue,
        has_critical_alerts: (expiredCount + criticalCount) > 0
      },
      alerts
    });
  } catch (err) { next(err); }
});

// تمديد الكفالة البنكية وتحديث تاريخ الانتهاء
router.post('/:id/guarantee/extend', rbacManager.verifyToken, rbacManager.requirePermission(['GUARANTEES.MANAGE', 'CONTRACTS.EDIT']), async (req, res, next) => {
  const { id } = req.params;
  const { newExpiryDate, bankLetterRef, notes } = req.body;

  if (!newExpiryDate) {
    return res.status(400).json({ success: false, error: 'تاريخ التمديد الجديد مطلوب' });
  }

  const extRecord = {
    id: `EXT-${Date.now()}`,
    extension_date: new Date().toISOString().split('T')[0],
    new_expiry_date: newExpiryDate,
    bank_letter_ref: bankLetterRef || '',
    extended_by: req.user ? (req.user.fullName || req.user.username) : 'ADMIN',
    notes: notes || 'تمديد الكفالة البنكية بموجب كتاب البنك'
  };

  try {
    const contract = localContracts.find(c => String(c.id) === String(id));
    if (contract) {
      contract.guarantee_expiry_date = newExpiryDate;
      if (!contract.guarantee_extensions) contract.guarantee_extensions = [];
      contract.guarantee_extensions.push(extRecord);
    }

    try {
      await queryPg(req, `
        UPDATE public.contracts 
        SET guarantee_expiry_date = $1,
            guarantee_extensions = COALESCE(guarantee_extensions, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $3
      `, [newExpiryDate, JSON.stringify([extRecord]), id]);
    } catch {}

    res.json({
      success: true,
      message: `تم تمديد الكفالة البنكية بنجاح حتى تاريخ ${newExpiryDate}`,
      new_expiry_date: newExpiryDate,
      extension: extRecord
    });
  } catch (err) { next(err); }
});

// ==========================================
// 7. أوامر التغيير والتعديل المالي والزمني (Variation Orders Engine with 25% Legal Cap)
// ==========================================

router.get('/:id/variation-orders', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    let orders = localVariationOrders.filter(v => String(v.contract_id) === String(id));
    try {
      const result = await queryPg(req, 'SELECT * FROM public.contract_variation_orders WHERE contract_id = $1 ORDER BY created_at DESC', [id]);
      if (result.rows.length) orders = result.rows;
    } catch {}

    // جلب قيمة العقد الأصلية لحساب نسبة أوامر التغيير
    let contractVal = 100000;
    try {
      const cRes = await queryPg(req, 'SELECT total_value FROM public.contracts WHERE id = $1', [id]);
      if (cRes.rows.length) contractVal = parseFloat(cRes.rows[0].total_value || 100000);
    } catch {}

    const totalIncrease = orders.filter(o => o.order_type === 'VALUE_INCREASE').reduce((s, o) => s + parseFloat(o.amount_change || 0), 0);
    const totalDecrease = orders.filter(o => o.order_type === 'VALUE_DECREASE').reduce((s, o) => s + parseFloat(o.amount_change || 0), 0);
    const netVariation = totalIncrease - totalDecrease;
    const variationPercentage = contractVal > 0 ? (netVariation / contractVal) * 100 : 0;

    res.json({
      success: true,
      count: orders.length,
      original_contract_value: contractVal,
      net_variation_value: netVariation,
      variation_percentage: Math.round(variationPercentage * 100) / 100,
      legal_cap_percentage: 25,
      is_within_legal_cap: variationPercentage <= 25,
      data: orders
    });
  } catch (err) { next(err); }
});

router.post('/:id/variation-orders', rbacManager.verifyToken, rbacManager.requirePermission(['CONTRACTS.EDIT', 'CONTRACTS.CREATE']), async (req, res, next) => {
  const { id } = req.params;
  const { orderType, amountChange, timeExtensionDays, reason, approvedBy } = req.body;

  const amt = parseFloat(amountChange || 0);
  const days = parseInt(timeExtensionDays || 0);
  const voId = `VO-${Date.now()}`;

  // 1. حساب السقف القانوني لأوامر التغيير بناء على إعدادات المنظومة
  const legalCapLimit = parseFloat((memDb.system_settings && memDb.system_settings[0] && memDb.system_settings[0].max_variation_order_pct) || 25.0);
  let originalContractValue = 100000;
  let existingNetVariation = 0;
  try {
    const cRes = await queryPg(req, 'SELECT total_value FROM public.contracts WHERE id = $1', [id]);
    if (cRes.rows.length) originalContractValue = parseFloat(cRes.rows[0].total_value || 100000);

    const prevOrders = await queryPg(req, 'SELECT order_type, amount_change FROM public.contract_variation_orders WHERE contract_id = $1', [id]);
    if (prevOrders.rows.length) {
      existingNetVariation = prevOrders.rows.reduce((sum, o) => {
        const val = parseFloat(o.amount_change || 0);
        return o.order_type === 'VALUE_INCREASE' ? sum + val : sum - val;
      }, 0);
    }
  } catch {}

  const projectedVariation = (orderType === 'VALUE_INCREASE' ? existingNetVariation + amt : existingNetVariation - amt);
  const projectedPercentage = originalContractValue > 0 ? (projectedVariation / originalContractValue) * 100 : 0;
  const exceedsLegalCap = projectedPercentage > legalCapLimit;

  const voObj = {
    id: voId,
    contract_id: id,
    order_number: `VO-KAF-${localVariationOrders.length + 1}`,
    order_type: orderType || 'VALUE_INCREASE',
    amount_change: amt,
    time_extension_days: days,
    reason: reason || '',
    approval_date: new Date().toISOString().split('T')[0],
    approved_by: approvedBy || (req.user ? (req.user.fullName || req.user.username) : 'مدير الأشغال'),
    status: 'APPROVED',
    legal_check: {
      original_value: originalContractValue,
      cumulative_variation: projectedVariation,
      variation_percentage: Math.round(projectedPercentage * 100) / 100,
      legal_cap_limit: legalCapLimit,
      exceeds_legal_cap: exceedsLegalCap,
      legal_warning: exceedsLegalCap ? `⚠️ تنبيه: إجمالي أوامر التغيير تجاوز السقف القانوني المعتمد (${legalCapLimit}%) ويتطلب قرار مجلس بلدي خاص ومصادقة الوزارة` : '✅ ضمن السقف القانوني المعتمد'
    },
    created_at: new Date().toISOString()
  };

  localVariationOrders.push(voObj);

  // تحديث العقد الإجمالي محلياً وفي الداتابيز
  const contract = localContracts.find(c => String(c.id) === String(id));
  if (contract) {
    if (orderType === 'VALUE_INCREASE') contract.total_value += amt;
    if (orderType === 'VALUE_DECREASE') contract.total_value -= amt;
    if (days > 0) {
      contract.execution_period_days += days;
      if (contract.end_date) {
        const curEnd = new Date(contract.end_date);
        curEnd.setDate(curEnd.getDate() + days);
        contract.end_date = curEnd.toISOString().split('T')[0];
      }
    }
  }

  try {
    await queryPg(req, `
      INSERT INTO public.contract_variation_orders (id, contract_id, order_number, order_type, amount_change, time_extension_days, reason, approved_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [voId, id, voObj.order_number, orderType, amt, days, reason || '', voObj.approved_by, 'APPROVED']);

    // تحديث قيم العقد الأساسي
    let valSQL = '';
    if (orderType === 'VALUE_INCREASE') valSQL = 'total_value = total_value + $1';
    if (orderType === 'VALUE_DECREASE') valSQL = 'total_value = total_value - $1';

    if (valSQL) {
      await queryPg(req, `UPDATE public.contracts SET ${valSQL}, execution_period_days = execution_period_days + $2, updated_at = NOW() WHERE id = $3`, [amt, days, id]);
    }
  } catch {}

  res.status(201).json({
    success: true,
    message: exceedsLegalCap 
      ? '⚠️ تم تسجيل أمر التغيير بنجاح (مع تسجيل تنبيه لتجاوز السقف القانوني 25%)'
      : '✅ تم حفظ أمر التغيير وتحديث القيمة التعاقدية ومدة التنفيذ بنجاح',
    data: voObj
  });
});

// ==========================================
// 8. محرك الطباعة والتصدير لاتفاقية تنفيذ الأعمال (Print & Export Engine)
// ==========================================

router.get('/:id/print', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    let contract = localContracts.find(c => String(c.id) === String(id));
    let clauses = localContractClauses.filter(cl => String(cl.contract_id) === String(id));

    try {
      const cRes = await queryPg(req, 'SELECT * FROM public.contracts WHERE id = $1', [id]);
      if (cRes.rows.length) contract = cRes.rows[0];

      const clRes = await queryPg(req, 'SELECT * FROM public.contract_clauses WHERE contract_id = $1 ORDER BY clause_number ASC', [id]);
      if (clRes.rows.length) clauses = clRes.rows;
    } catch {}

    if (!contract) {
      return res.status(404).send('<h2 style="text-align:center;font-family:sans-serif;">العقد غير موجود</h2>');
    }

    const marginTop = parseFloat(req.query.mt || '1.0'); // 1.0 سم للأعلى افتراضياً
    const marginBottom = parseFloat(req.query.mb || '0.7'); // 0.7 سم للأسفل
    const marginRight = parseFloat(req.query.mr || '0.7'); // 0.7 سم لليمين
    const marginLeft = parseFloat(req.query.ml || '0.7'); // 0.7 سم لليسار

    const htmlContent = generateOfficialContractHTML(contract, clauses, { municipality_name: 'بلدية كفرنجة الجديدة', logo_path: '/logo.jpg' });

    const fullPrintHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>طباعة اتفاقية تنفيذ أعمال - ${contract.contract_number || contract.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style id="page-margins-style">
          @page {
            size: A4 portrait;
            margin: ${marginTop}cm ${marginRight}cm ${marginBottom}cm ${marginLeft}cm;
          }
        </style>
        <style>
          /* === CSS الأساسي الثابت - لا يتغير عند تعديل الهوامش === */
          * { box-sizing: border-box; }
          body {
            background: #cbd5e1;
            padding: 20px 0;
            margin: 0;
            font-family: 'Cairo', 'Tajawal', 'Amiri', serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-contract-document {
            max-width: 820px;
            margin: 0 auto;
            background: white;
            display: block;
            visibility: visible;
            opacity: 1;
          }
          @media print {
            html, body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              font-size: 12pt !important;
            }
            /* إخفاء شريط التحكم فقط */
            .no-print {
              display: none !important;
            }
            /* ضمان ظهور كل المحتوى بالكامل */
            .official-contract-document,
            .official-contract-document * {
              visibility: visible !important;
              display: revert !important;
              opacity: 1 !important;
            }
            .official-contract-document {
              display: block !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 10px !important;
              width: 100% !important;
              max-width: 100% !important;
              border-radius: 0 !important;
              position: static !important;
              overflow: visible !important;
            }
            /* منع فصل عناصر grid/flex عند الطباعة */
            .legal-clause-block { page-break-inside: avoid; break-inside: avoid; }
            .legal-signatures-block { page-break-inside: avoid; break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <!-- Print Header & Margins Controller Bar -->
        <div class="no-print" style="max-width:850px; margin:0 auto 16px auto; background:linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color:white; padding:16px 22px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:'Cairo',sans-serif; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <strong style="font-size:1.1rem;">📜 معاينة وإعدادات طباعة الاتفاقية الرسمية</strong>
              <p style="margin:2px 0 0 0; font-size:0.83rem; opacity:0.88;">الهوامش القياسية المعتمَدة: الأعلى ${marginTop} سم، اليمين واليسار والأسفل ${marginBottom} سم (قابلة للتعديل)</p>
            </div>
            <button type="button" onclick="triggerPrintNow()" style="background:#0d9488; color:white; border:none; padding:10px 22px; border-radius:6px; font-weight:bold; cursor:pointer; font-family:'Cairo',sans-serif; display:flex; align-items:center; gap:6px; font-size:0.95rem;">
              <span>🖨️ طباعة المستند الآن (A4)</span>
            </button>
          </div>

          <!-- Interactive Margins Controls -->
          <div style="display:flex; gap:14px; align-items:center; background:rgba(255,255,255,0.12); padding:10px 14px; border-radius:8px; flex-wrap:wrap; font-size:0.88rem;">
            <span style="font-weight:bold; color:#fef3c7;">⚙️ التحكم التفاعلي بهوامش الصفحة (سم):</span>
            <label style="display:flex; align-items:center; gap:4px;">الأعلى: <input type="number" id="m-top" value="${marginTop}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">الأسفل: <input type="number" id="m-bottom" value="${marginBottom}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">اليمين: <input type="number" id="m-right" value="${marginRight}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">اليسار: <input type="number" id="m-left" value="${marginLeft}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <button type="button" onclick="resetDefaultMargins()" style="background:rgba(255,255,255,0.22); color:white; border:none; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-family:'Cairo',sans-serif;">🔄 اعادة الهوامش القياسية (1.0 / 0.7)</button>
          </div>
        </div>

        ${htmlContent}

        <script>
          function triggerPrintNow() {
            window.focus();
            setTimeout(function() { window.print(); }, 100);
          }

          // تحديث هوامش @page فقط دون المساس بباقي CSS
          function applyMargins(top, bottom, right, left) {
            var styleEl = document.getElementById('page-margins-style');
            if (styleEl) {
              styleEl.textContent = '@page { size: A4 portrait; margin: ' + top + 'cm ' + right + 'cm ' + bottom + 'cm ' + left + 'cm; }';
            }
          }

          function updateMarginsLive() {
            var top = document.getElementById('m-top').value || '1.0';
            var bottom = document.getElementById('m-bottom').value || '0.7';
            var right = document.getElementById('m-right').value || '0.7';
            var left = document.getElementById('m-left').value || '0.7';
            applyMargins(top, bottom, right, left);
          }
        </script>
      </body>
      </html>
    `;

    res.send(fullPrintHtml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

