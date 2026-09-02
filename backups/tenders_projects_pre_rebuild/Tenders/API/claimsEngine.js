/**
 * Tenders/API/claimsEngine.js
 * محرك إدارة المطالبات المالية والأوامر التغييرية ومسارات الاعتماد والتدقيق المالي
 * بلدية كفرنجة الجديدة - الإصدار الموحد v4.0
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/rbacManager');
const {
  dbQuery,
  dbGet,
  dbRun,
  withTransaction,
  generateSequenceId,
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
    const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

function memGet(table, id) {
  if (!memDb[table]) return null;
  return memDb[table].find(r => String(r.id) === String(id)) || null;
}

function memInsert(table, item) {
  if (!memDb[table]) memDb[table] = [];
  memDb[table].unshift(item);
  saveMemTable(table);
  return item;
}

function memUpdate(table, id, updates) {
  if (!memDb[table]) return null;
  const idx = memDb[table].findIndex(r => String(r.id) === String(id));
  if (idx !== -1) {
    memDb[table][idx] = { ...memDb[table][idx], ...updates, updatedAt: new Date().toISOString() };
    saveMemTable(table);
    return memDb[table][idx];
  }
  return null;
}

function memDelete(table, id) {
  if (!memDb[table]) return false;
  memDb[table] = memDb[table].filter(r => String(r.id) !== String(id));
  saveMemTable(table);
  return true;
}

let isMigrated = false;
async function ensureClaimsSchema() {
  if (isMigrated || !isPostgresActive()) return;
  try {
    await dbRun(`
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS contractor VARCHAR(255);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "claimNumber" VARCHAR(100);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "claimType" VARCHAR(100);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS type VARCHAR(100);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "previousPayments" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "previousPaid" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "completionPercentage" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "completionPercent" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "retentionPercentage" DOUBLE PRECISION DEFAULT 10;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "retentionPercent" DOUBLE PRECISION DEFAULT 10;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS retention DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "advanceDeduction" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "taxDeduction" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "otherDeductions" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS deduction DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "netPayable" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "netAmount" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "grossCumulative" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "submissionDate" VARCHAR(50);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "submitDate" VARCHAR(50);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "attachmentPath" TEXT;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "approvalStage" VARCHAR(100);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(50);
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS "boqItems" JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE claims ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE claims DROP CONSTRAINT IF EXISTS "claims_tenderId_fkey";
      ALTER TABLE claims ALTER COLUMN "tenderId" DROP NOT NULL;
    `);
    isMigrated = true;
  } catch (e) {
    console.warn('Claims schema ensure note:', e.message);
  }
}

function formatClaimRow(row) {
  if (!row) return null;
  const rawAmt = parseFloat(row.amount) || parseFloat(row.value) || 0;
  const retRate = parseFloat(row.retentionPercent) || parseFloat(row.retentionPercentage) || 10;
  const retVal = parseFloat(row.retention) || ((rawAmt * retRate) / 100);
  const dedVal = parseFloat(row.deduction) || parseFloat(row.otherDeductions) || 0;
  const advVal = parseFloat(row.advanceDeduction) || 0;
  const taxVal = parseFloat(row.taxDeduction) || 0;
  const netVal = parseFloat(row.netAmount) || parseFloat(row.netPayable) || Math.max(0, rawAmt - retVal - dedVal - advVal - taxVal);
  const compVal = parseFloat(row.completionPercent) || parseFloat(row.completionPercentage) || 0;
  const dateVal = (row.submitDate || row.submissionDate || row.createdAt || new Date().toISOString()).split('T')[0];

  return {
    ...row,
    id: row.id,
    tenderId: row.tenderId || row.tender_id || '',
    tenderName: row.tenderName || row.tender_name || '',
    claimant: row.claimant || row.contractor || 'المقاول',
    contractor: row.contractor || row.claimant || 'المقاول',
    claimNumber: row.claimNumber || row.id,
    type: row.type || row.claimType || 'مطالبة إنجاز',
    claimType: row.claimType || row.type || 'مطالبة إنجاز',
    amount: rawAmt,
    value: rawAmt,
    netAmount: netVal,
    netPayable: netVal,
    retention: retVal,
    retentionPercent: retRate,
    retentionPercentage: retRate,
    deduction: dedVal,
    otherDeductions: dedVal,
    advanceDeduction: advVal,
    taxDeduction: taxVal,
    completionPercent: compVal,
    completionPercentage: compVal,
    previousPaid: parseFloat(row.previousPaid) || parseFloat(row.previousPayments) || 0,
    previousPayments: parseFloat(row.previousPayments) || parseFloat(row.previousPaid) || 0,
    grossCumulative: parseFloat(row.grossCumulative) || (rawAmt + (parseFloat(row.previousPaid) || parseFloat(row.previousPayments) || 0)),
    submitDate: dateVal,
    submissionDate: dateVal,
    status: row.status || 'مسودة / قيد الإعداد',
    notes: row.notes || '',
    attachmentPath: row.attachmentPath || row.file || '',
    file: row.file || row.attachmentPath || '',
    boqItems: row.boqItems || '[]',
    history: row.history || '[]'
  };
}

// 1. استرجاع قائمة المطالبات المالية
router.get('/', requireAuth, async (req, res) => {
  await ensureClaimsSchema();
  const { search, status, tenderId, page, limit } = req.query;
  try {
    if (isPostgresActive()) {
      let sql = `
        SELECT c.*, t.name as "tenderName"
        FROM claims c
        LEFT JOIN tenders t ON c."tenderId"::text = t.id::text
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (c.contractor ILIKE $${params.length} OR c.claimant ILIKE $${params.length} OR c.id ILIKE $${params.length} OR c."claimNumber" ILIKE $${params.length} OR t.name ILIKE $${params.length})`;
      }
      if (status && status !== 'ALL') {
        if (status === 'بانتظار') {
          sql += ` AND c.status ILIKE '%بانتظار%'`;
        } else if (status === 'معتمدة') {
          sql += ` AND c.status ILIKE '%معتمدة%'`;
        } else {
          params.push(status);
          sql += ` AND c.status = $${params.length}`;
        }
      }
      if (tenderId) {
        params.push(tenderId);
        sql += ` AND c."tenderId"::text = $${params.length}`;
      }
      sql += ' ORDER BY c."createdAt" DESC';

      if (page && limit) {
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params);
      return res.json((rows || []).map(formatClaimRow));
    }

    // MemDB fallback
    let rows = (memDb.claims || []).filter(r => {
      if (search && !(`${r.contractor || r.claimant || ''} ${r.id} ${r.claimNumber || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
      if (status && status !== 'ALL' && r.status !== status) return false;
      if (tenderId && String(r.tenderId) !== String(tenderId)) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (page && limit) {
      const p = parseInt(page, 10);
      const l = parseInt(limit, 10);
      rows = rows.slice((p - 1) * l, p * l);
    }

    res.json((rows || []).map(formatClaimRow));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. ملخص مطالبات عطاء محدد
router.get('/tender/:tenderId/summary', requireAuth, async (req, res) => {
  await ensureClaimsSchema();
  try {
    const { tenderId } = req.params;
    let claims = [];
    let tender = null;
    if (isPostgresActive()) {
      claims = await dbQuery('SELECT * FROM claims WHERE "tenderId"::text = $1 ORDER BY "createdAt" ASC', [tenderId]);
      tender = await dbGet('SELECT * FROM tenders WHERE id::text = $1', [tenderId]);
    } else {
      claims = (memDb.claims || []).filter(r => String(r.tenderId) === String(tenderId));
      tender = (memDb.tenders || []).find(t => String(t.id) === String(tenderId));
    }

    const formattedClaims = (claims || []).map(formatClaimRow);
    const totalClaimsValue = formattedClaims.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const paidClaimsValue = formattedClaims
      .filter(c => (c.status || '').includes('مدفوعة') || (c.status || '').includes('معتمدة'))
      .reduce((sum, c) => sum + (parseFloat(c.netAmount) || parseFloat(c.amount) || 0), 0);
    const pendingClaimsCount = formattedClaims.filter(c => !(c.status || '').includes('مدفوعة') && !(c.status || '').includes('معتمدة') && !(c.status || '').includes('مرفوضة')).length;

    res.json({
      tenderId,
      tender,
      totalClaims: formattedClaims.length,
      totalClaimsValue,
      paidClaimsValue,
      pendingClaimsCount,
      claims: formattedClaims
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. استرجاع مطالبة مالية واحدة بالتفصيل
router.get('/:id', requireAuth, async (req, res) => {
  await ensureClaimsSchema();
  try {
    let claim = null;
    if (isPostgresActive()) {
      claim = await dbGet(`
        SELECT c.*, t.name as "tenderName"
        FROM claims c
        LEFT JOIN tenders t ON c."tenderId"::text = t.id::text
        WHERE c.id::text = $1
      `, [req.params.id]);
    } else {
      claim = (memDb.claims || []).find(r => String(r.id) === String(req.params.id));
    }

    if (!claim) return res.status(404).json({ error: 'المطالبة المالية غير موجودة' });
    res.json(formatClaimRow(claim));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. إنشاء مطالبة مالية جديدة
router.post('/', requireAuth, authorize('claims:create'), upload.single('file'), async (req, res) => {
  await ensureClaimsSchema();
  const {
    tenderId, contractor, claimant, claimNumber, claimType, type, amount, value, previousPayments, previousPaid,
    completionPercentage, completionPercent, retentionPercentage, retentionPercent, retention, advanceDeduction, taxDeduction,
    otherDeductions, deduction, netPayable, netAmount, grossCumulative, boqItems, status, submissionDate, submitDate, notes
  } = req.body;

  const finalContractor = contractor || claimant;
  if (!finalContractor || !String(finalContractor).trim()) {
    return res.status(400).json({ error: 'اسم المقاول / الجهة المستفيدة مطلوب' });
  }

  try {
    const id = await generateSequenceId('C', 'claims');
    const attachmentPath = req.file ? req.file.filename : (req.body.attachmentPath || '');
    const now = new Date().toISOString();
    const rawAmount = parseFloat(amount || value || 0);
    const defaultRetention = parseFloat((memDb.system_settings && memDb.system_settings[0] && memDb.system_settings[0].default_retention_pct) || 10.0);
    const retRate = parseFloat(retentionPercent) || parseFloat(retentionPercentage) || defaultRetention;
    const retVal = parseFloat(retention) || ((rawAmount * retRate) / 100.0);
    const advDed = parseFloat(advanceDeduction) || 0;
    const taxDed = parseFloat(taxDeduction) || 0;
    const othDed = parseFloat(deduction) || parseFloat(otherDeductions) || 0;
    const calculatedNet = Math.max(0, rawAmount - (retVal + advDed + taxDed + othDed));
    const finalNet = parseFloat(netAmount) || parseFloat(netPayable) || calculatedNet;
    const finalType = claimType || type || 'دفعة إنجاز جارية';
    const finalPrevPaid = parseFloat(previousPaid) || parseFloat(previousPayments) || 0;
    const finalCompPercent = parseFloat(completionPercent) || parseFloat(completionPercentage) || 0;
    const finalGrossCum = parseFloat(grossCumulative) || (rawAmount + finalPrevPaid);
    const finalDate = submitDate || submissionDate || now.split('T')[0];
    const boqData = typeof boqItems === 'string' ? boqItems : JSON.stringify(boqItems || []);

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO claims (
          id, "tenderId", claimant, contractor, "claimNumber", "claimType", type, amount, value,
          "previousPayments", "previousPaid", "completionPercentage", "completionPercent",
          "retentionPercentage", "retentionPercent", retention, "advanceDeduction", "taxDeduction",
          "otherDeductions", deduction, "netPayable", "netAmount", "grossCumulative",
          status, "submissionDate", "submitDate", notes, "attachmentPath", "boqItems", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29::jsonb, NOW(), NOW()
        )
      `, [
        id, tenderId || null, finalContractor, finalContractor, claimNumber || id, finalType, finalType,
        rawAmount, rawAmount, finalPrevPaid, finalPrevPaid, finalCompPercent, finalCompPercent,
        retRate, retRate, retVal, advDed, taxDed,
        othDed, othDed, finalNet, finalNet, finalGrossCum,
        status || 'مسودة / قيد الإعداد', finalDate, finalDate, notes || '', attachmentPath, boqData
      ]);
    }

    // دائماً نحفظ نسخة في ملفات JSON للضمان الشامل (Dual-Sync Persistence)
    memInsert('claims', {
      id, tenderId: tenderId || null, claimant: finalContractor, contractor: finalContractor,
      claimNumber: claimNumber || id, claimType: finalType, type: finalType,
      amount: rawAmount, value: rawAmount, previousPayments: finalPrevPaid, previousPaid: finalPrevPaid,
      completionPercentage: finalCompPercent, completionPercent: finalCompPercent,
      retentionPercentage: retRate, retentionPercent: retRate, retention: retVal,
      advanceDeduction: advDed, taxDeduction: taxDed, otherDeductions: othDed, deduction: othDed,
      netPayable: finalNet, netAmount: finalNet, grossCumulative: finalGrossCum,
      status: status || 'مسودة / قيد الإعداد', submissionDate: finalDate, submitDate: finalDate,
      notes: notes || '', attachmentPath, boqItems: boqData, createdAt: now, updatedAt: now
    });

    if (global.recordActivity) {
      global.recordActivity({
        userId: req.user?.id,
        userName: req.user?.fullName || req.user?.username,
        action: 'إنشاء مطالبة مالية',
        entity: 'المطالبات المالية',
        entityId: id,
        details: `إنشاء المطالبة رقم ${claimNumber || id} للمقاول (${finalContractor}) بقيمة صافية ${finalNet.toLocaleString('ar-JO')} د.أ`,
        ip: req.ip || req.socket?.remoteAddress
      });
    }

    const sendNotification = req.app ? req.app.get('sendNotification') : null;
    if (typeof sendNotification === 'function') {
      sendNotification({
        userId: 'all',
        title: '📝 مطالبة مالية جديدة',
        message: `تم إصدار المطالبة رقم ${claimNumber || id} للمقاول (${finalContractor}) بقيمة صافية ${finalNet.toLocaleString('ar-JO')} د.أ`,
        link: `claims:${id}`,
        type: 'claims'
      });
    }

    res.status(201).json({ id, message: 'تم إنشاء المطالبة المالية بنجاح', success: true, attachmentPath });
  } catch (e) {
    console.error('Create claim error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 5. تعديل مطالبة مالية
router.put('/:id', requireAuth, authorize('claims:edit'), upload.single('file'), async (req, res) => {
  await ensureClaimsSchema();
  const {
    tenderId, contractor, claimant, claimNumber, claimType, type, amount, value, previousPayments, previousPaid,
    completionPercentage, completionPercent, retentionPercentage, retentionPercent, retention, advanceDeduction, taxDeduction,
    otherDeductions, deduction, netPayable, netAmount, grossCumulative, boqItems, status, submissionDate, submitDate, notes, editReason
  } = req.body;

  const finalContractor = contractor || claimant;

  try {
    const rawAmount = parseFloat(amount) || parseFloat(value) || 0;
    const retRate = parseFloat(retentionPercent) || parseFloat(retentionPercentage) || 10.0;
    const retVal = parseFloat(retention) || ((rawAmount * retRate) / 100.0);
    const advDed = parseFloat(advanceDeduction) || 0;
    const taxDed = parseFloat(taxDeduction) || 0;
    const othDed = parseFloat(deduction) || parseFloat(otherDeductions) || 0;
    const calculatedNet = Math.max(0, rawAmount - (retVal + advDed + taxDed + othDed));
    const finalNet = parseFloat(netAmount) || parseFloat(netPayable) || calculatedNet;
    const finalType = claimType || type || 'دفعة إنجاز جارية';
    const finalPrevPaid = parseFloat(previousPaid) || parseFloat(previousPayments) || 0;
    const finalCompPercent = parseFloat(completionPercent) || parseFloat(completionPercentage) || 0;
    const finalGrossCum = parseFloat(grossCumulative) || (rawAmount + finalPrevPaid);
    const finalDate = submitDate || submissionDate || new Date().toISOString().split('T')[0];
    const boqData = typeof boqItems === 'string' ? boqItems : JSON.stringify(boqItems || []);

    let shouldUpdateAttachment = false;
    let finalAttachment = '';
    if (req.file) {
      shouldUpdateAttachment = true;
      finalAttachment = req.file.filename;
    } else if (req.body.attachmentPath !== undefined) {
      shouldUpdateAttachment = true;
      finalAttachment = req.body.attachmentPath || '';
    }

    if (isPostgresActive()) {
      let updateSql = `
        UPDATE claims SET
          "tenderId"=$1, contractor=$2, claimant=$3, "claimNumber"=$4, "claimType"=$5, type=$6,
          amount=$7, value=$8, "previousPayments"=$9, "previousPaid"=$10,
          "completionPercentage"=$11, "completionPercent"=$12, "retentionPercentage"=$13, "retentionPercent"=$14,
          retention=$15, "advanceDeduction"=$16, "taxDeduction"=$17, "otherDeductions"=$18, deduction=$19,
          "netPayable"=$20, "netAmount"=$21, "grossCumulative"=$22,
          status=$23, "submissionDate"=$24, "submitDate"=$25, notes=$26, "boqItems"=$27::jsonb, "updatedAt"=NOW()
      `;
      const params = [
        tenderId || null, finalContractor || '', finalContractor || '', claimNumber || req.params.id, finalType, finalType,
        rawAmount, rawAmount, finalPrevPaid, finalPrevPaid,
        finalCompPercent, finalCompPercent, retRate, retRate,
        retVal, advDed, taxDed, othDed, othDed,
        finalNet, finalNet, finalGrossCum,
        status || 'مسودة / قيد الإعداد', finalDate, finalDate, notes || '', boqData
      ];

      if (shouldUpdateAttachment) {
        params.push(finalAttachment);
        updateSql += `, "attachmentPath"=$${params.length}`;
      }
      params.push(req.params.id);
      updateSql += ` WHERE id=$${params.length}`;

      await dbRun(updateSql, params);
    }

    const updates = {
      tenderId: tenderId || null, contractor: finalContractor || '', claimant: finalContractor || '',
      claimNumber: claimNumber || req.params.id, claimType: finalType, type: finalType,
      amount: rawAmount, value: rawAmount, previousPayments: finalPrevPaid, previousPaid: finalPrevPaid,
      completionPercentage: finalCompPercent, completionPercent: finalCompPercent,
      retentionPercentage: retRate, retentionPercent: retRate, retention: retVal,
      advanceDeduction: advDed, taxDeduction: taxDed, otherDeductions: othDed, deduction: othDed,
      netPayable: finalNet, netAmount: finalNet, grossCumulative: finalGrossCum,
      status: status || 'مسودة / قيد الإعداد', submissionDate: finalDate, submitDate: finalDate,
      notes: notes || '', boqItems: boqData, updatedAt: new Date().toISOString()
    };
    if (shouldUpdateAttachment) updates.attachmentPath = finalAttachment;
    memUpdate('claims', req.params.id, updates);

    res.json({ message: 'تم تحديث المطالبة المالية بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. مسار تدقيق واعتماد المطالبة خطوة بخطوة (Workflow Action & Stepper)
router.post('/:id/workflow', requireAuth, upload.single('file'), async (req, res) => {
  const { targetStatus, notes, action } = req.body;
  const claimId = req.params.id;
  const user = req.user || { id: 'U-001', role: 'admin', fullName: 'المدير الهندسي' };
  const uploadedFile = req.file ? req.file.filename : null;

  if (!targetStatus) {
    return res.status(400).json({ error: 'الحالة المستهدفة مطلوبة' });
  }

  try {
    let updatedClaim;
    await withTransaction(async (client) => {
      let claim;
      if (isPostgresActive()) {
        const r = await client.query('SELECT * FROM claims WHERE id = $1 FOR UPDATE', [claimId]);
        claim = r.rows[0];
      } else {
        claim = memGet('claims', claimId);
      }

      if (!claim) throw new Error('المطالبة المالية غير موجودة');

      // Parse existing history
      let historyList = [];
      try {
        historyList = typeof claim.history === 'string' ? JSON.parse(claim.history) : (claim.history || []);
      } catch (e) {
        historyList = [];
      }

      // Append new workflow step log
      const newStep = {
        id: `STEP-${Date.now()}`,
        action: action || targetStatus,
        targetStatus: targetStatus,
        prevStatus: claim.status || 'مسودة',
        userId: user.id,
        userName: user.fullName || user.username || 'مستخدم',
        userRole: user.role || 'مهندس',
        notes: notes || '',
        attachment: uploadedFile,
        timestamp: new Date().toISOString()
      };
      historyList.push(newStep);

      const historyStr = JSON.stringify(historyList);
      const isFinalApproved = targetStatus.includes('معتمدة') || targetStatus === 'معتمدة';

      if (isPostgresActive()) {
        await client.query(`
          UPDATE claims SET
            status = $1,
            history = $2,
            "approvalStage" = $3,
            "approvedBy" = CASE WHEN $4 THEN $5 ELSE "approvedBy" END,
            "approvedAt" = CASE WHEN $4 THEN NOW() ELSE "approvedAt" END,
            "updatedAt" = NOW()
          WHERE id = $6
        `, [
          targetStatus,
          historyStr,
          action || targetStatus,
          isFinalApproved,
          user.id,
          claimId
        ]);
        updatedClaim = { ...claim, status: targetStatus, history: historyStr };
      } else {
        const updates = {
          status: targetStatus,
          history: historyStr,
          approvalStage: action || targetStatus
        };
        if (isFinalApproved) {
          updates.approvedBy = user.id;
          updates.approvedAt = new Date().toISOString();
        }
        updatedClaim = memUpdate('claims', claimId, updates);
      }
    });

    // Real-time notification broadcast
    const sendNotification = req.app ? req.app.get('sendNotification') : null;
    if (typeof sendNotification === 'function') {
      sendNotification({
        userId: 'all',
        title: `📝 تحديث مسار مطالبة (${claimId})`,
        message: `تم اتخاذ إجراء [${action || targetStatus}] بواسطة المهندس (${user.fullName || user.username}) للمطالبة ${claimId}`,
        link: `claims:${claimId}`,
        type: 'claims'
      });
    }

    res.json({
      success: true,
      message: `تم تطبيق الإجراء [${action || targetStatus}] وتحديث حالة المطالبة بنجاح`,
      status: targetStatus,
      claim: updatedClaim
    });
  } catch (e) {
    console.error('Workflow action error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 7. إعدادات سلسلة الاعتماد الافتراضية
router.get(['/workflow-config', '/api/claim-workflow-config'], requireAuth, async (req, res) => {
  const p = path.resolve(__dirname, '..', '..', 'claim_workflow.json');
  try {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
      return res.json(data);
    }
  } catch (e) { }

  res.json([
    { userId: 'U-002', label: 'المهندس المشرف', printLabel: 'مهندس الموقع والإشراف' },
    { userId: 'U-004', label: 'رئيس القسم الفني', printLabel: 'رئيس قسم العطاءات والمشاريع' },
    { userId: 'U-001', label: 'مدير الأشغال والخدمات الهندسية', printLabel: 'مدير مديرية الأشغال' }
  ]);
});

router.post(['/workflow-config', '/api/claim-workflow-config'], requireAuth, authorize('claims:edit'), async (req, res) => {
  const p = path.resolve(__dirname, '..', '..', 'claim_workflow.json');
  try {
    const configData = Array.isArray(req.body) ? req.body : (req.body.steps || []);
    fs.writeFileSync(p, JSON.stringify(configData, null, 2), 'utf8');
    res.json({ success: true, message: 'تم حفظ وتحديث سلسلة الاعتماد بنجاح', config: configData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. اعتماد المطالبة المالية (ACID Transaction)
router.post('/:id/approve', requireAuth, authorize('claims:approve'), async (req, res) => {
  const { notes, approvalStage } = req.body;
  const userId = req.user ? req.user.id : 'نظام';
  try {
    await withTransaction(async (client) => {
      let claim;
      if (isPostgresActive()) {
        const r = await client.query('SELECT * FROM claims WHERE id = $1 FOR UPDATE', [req.params.id]);
        claim = r.rows[0];
      } else {
        claim = memGet('claims', req.params.id);
      }
      if (!claim) throw new Error('المطالبة غير موجودة');

      const nextStatus = 'معتمدة';
      if (isPostgresActive()) {
        await client.query(
          'UPDATE claims SET status = $1, "approvalStage" = $2, "approvedBy" = $3, "approvedAt" = NOW(), notes = CONCAT(COALESCE(notes, \'\'), \' | اعتماد: \', $4::text), "updatedAt" = NOW() WHERE id = $5',
          [nextStatus, approvalStage || 'اعتماد نهائي', userId, notes || 'تم الاعتماد بنجاح', req.params.id]
        );
      } else {
        memUpdate('claims', req.params.id, {
          status: nextStatus,
          approvalStage: approvalStage || 'اعتماد نهائي',
          approvedBy: userId,
          approvedAt: new Date().toISOString()
        });
      }
    });

    const sendNotification = req.app ? req.app.get('sendNotification') : null;
    if (typeof sendNotification === 'function') {
      sendNotification({
        userId: 'all',
        title: '✅ اعتماد دفعة مالية',
        message: `تم اعتماد وصرف المطالبة المالية رقم (${req.params.id}) بنجاح`,
        link: `claims:${req.params.id}`,
        type: 'claims'
      });
    }

    res.json({ success: true, message: 'تم اعتماد المطالبة المالية وصرفها بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 9. حذف مطالبة مالية
router.delete('/:id', requireAuth, authorize('claims:delete'), async (req, res) => {
  try {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM claims WHERE id = $1', [req.params.id]);
    } else {
      memDelete('claims', req.params.id);
    }
    res.json({ success: true, message: 'تم حذف المطالبة بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
