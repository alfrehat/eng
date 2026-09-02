/**
 * Tenders/API/tendersEngine.js
 * 🏛️ محرك إدارة العطاءات والمشاريع التنفيذية الموحد (Unified Executive Tenders & Projects Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المعايير الهندسية:
 * 1. واجهة متكاملة لإدارة دورة حياة العطاء والمشروع بالكامل.
 * 2. منظومة التقارير اليومية وسجل الإنجاز التراكمي الميداني.
 * 3. إدارة جداول الكميات (BOQ) والأعمال المنفذة.
 * 4. ملاحظات الإشراف وتعليمات الموقع الفنية.
 * 5. الفحوصات المخبرية ومعايير ضبط الجودة.
 * 6. الجاهزية ولجنة الاستلام ومحاضر التسليم الرسمية.
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
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
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

// ══════════════════════════════════════════════════════════════════════
// 1️⃣ قائمة واستعلام العطاءات والمشاريع (Tenders Query & Listing)
// ══════════════════════════════════════════════════════════════════════
router.get('/', requireAuth, async (req, res) => {
  const { search, status, tenderType, purchaseMethod, purchaseCommittee, year, page, limit } = req.query;
  try {
    const pg = isPostgresActive();
    if (pg) {
      let sql = 'SELECT * FROM tenders WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (name ILIKE $${params.length} OR contractor ILIKE $${params.length} OR id ILIKE $${params.length} OR "tenderNumber" ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (tenderType) {
        params.push(tenderType);
        sql += ` AND ("tenderType" = $${params.length} OR type = $${params.length})`;
      }
      if (purchaseMethod) {
        params.push(purchaseMethod);
        sql += ` AND "purchaseMethod" = $${params.length}`;
      }
      if (purchaseCommittee) {
        params.push(purchaseCommittee);
        sql += ` AND "purchaseCommittee" = $${params.length}`;
      }
      if (year) {
        params.push(`${year}%`);
        sql += ` AND ("contractSignDate"::text LIKE $${params.length} OR "openDate"::text LIKE $${params.length} OR "createdAt"::text LIKE $${params.length})`;
      }
      sql += ' ORDER BY "createdAt" DESC';

      if (page && limit) {
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params);
      return res.json(rows || []);
    }

    // MemDB Fallback
    let rows = (memDb.tenders || []).filter(r => {
      if (search && !(`${r.name} ${r.contractor} ${r.id} ${r.tenderNumber || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
      if (status && r.status !== status) return false;
      if (tenderType && r.tenderType !== tenderType && r.type !== tenderType) return false;
      if (purchaseMethod && r.purchaseMethod !== purchaseMethod) return false;
      if (purchaseCommittee && r.purchaseCommittee !== purchaseCommittee) return false;
      if (year && !String(r.contractSignDate || r.openDate || r.createdAt || '').startsWith(year)) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (page && limit) {
      const p = parseInt(page, 10);
      const l = parseInt(limit, 10);
      rows = rows.slice((p - 1) * l, p * l);
    }

    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2️⃣ تفاصيل العطاء ومساحة العمل التنفيذية المجمعة (Tender Workspace Hub)
// ══════════════════════════════════════════════════════════════════════
router.get('/:id', requireAuth, async (req, res) => {
  try {
    let row;
    if (isPostgresActive()) {
      row = await dbGet('SELECT * FROM tenders WHERE id = $1', [req.params.id]);
    } else {
      row = memGet('tenders', req.params.id);
    }
    if (!row) return res.status(404).json({ error: 'العطاء غير موجود' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/hub-details', requireAuth, async (req, res) => {
  try {
    const tenderId = req.params.id;
    let tender = null;
    let dailyReports = [];
    let claims = [];
    let contracts = [];
    let variationOrders = [];
    let archiveDocs = [];

    if (isPostgresActive()) {
      tender = await dbGet('SELECT * FROM tenders WHERE id = $1', [tenderId]);
      if (tender) {
        dailyReports = await dbQuery('SELECT * FROM tender_daily_reports WHERE tender_id = $1 ORDER BY report_date DESC', [tenderId]).catch(() => []);
        claims = await dbQuery('SELECT * FROM claims WHERE "tenderId" = $1 OR tender_id = $1 ORDER BY "createdAt" DESC', [tenderId]).catch(() => []);
        contracts = await dbQuery('SELECT * FROM contracts WHERE tender_id = $1 OR id = $1 ORDER BY "createdAt" DESC', [tenderId]).catch(() => []);
        variationOrders = await dbQuery('SELECT * FROM contract_variation_orders WHERE contract_id = $1 OR tender_id = $1', [tenderId]).catch(() => []);
        archiveDocs = await dbQuery('SELECT * FROM archive WHERE "relatedId" = $1 OR id = $1', [tenderId]).catch(() => []);
      }
    } else {
      tender = memGet('tenders', tenderId);
      if (tender) {
        dailyReports = (memDb.tender_daily_reports || []).filter(r => String(r.tender_id) === String(tenderId));
        claims = (memDb.claims || []).filter(c => String(c.tenderId || c.tender_id) === String(tenderId));
        contracts = (memDb.contracts || []).filter(ct => String(ct.tender_id) === String(tenderId) || String(ct.id) === String(tenderId));
        variationOrders = (memDb.contract_variation_orders || []).filter(vo => String(vo.tender_id) === String(tenderId) || String(vo.contract_id) === String(tenderId));
        archiveDocs = (memDb.archive || []).filter(a => String(a.relatedId) === String(tenderId));
      }
    }

    if (!tender) return res.status(404).json({ success: false, error: 'العطاء غير موجود' });

    // حساب المجاميع المالية ونسب الإنجاز التراكمية
    const totalClaimsPaid = claims.reduce((sum, c) => sum + (parseFloat(c.netAmount || c.netPayable || c.amount) || 0), 0);
    const totalVariationAmount = variationOrders.reduce((sum, vo) => sum + (parseFloat(vo.costChange || vo.amount) || 0), 0);
    const effectiveContractValue = (parseFloat(tender.awardedValue || tender.value || tender.estimatedValue) || 0) + totalVariationAmount;
    const financialPercentage = effectiveContractValue > 0 ? Math.min(100, Math.round((totalClaimsPaid / effectiveContractValue) * 100)) : 0;

    res.json({
      success: true,
      tender,
      dailyReports,
      claims,
      contracts,
      variationOrders,
      archiveDocs,
      metrics: {
        totalDailyReports: dailyReports.length,
        totalClaims: claims.length,
        totalClaimsPaid,
        totalVariationAmount,
        effectiveContractValue,
        financialPercentage,
        physicalPercentage: parseFloat(tender.completionPercentage) || 0
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3️⃣ إضافة وتعديل وحذف العطاءات (Tenders CRUD)
// ══════════════════════════════════════════════════════════════════════
router.post('/', requireAuth, authorize('tenders:create'), upload.single('file'), async (req, res) => {
  const {
    name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
    commencementDate, durationDays, supervisorEngineer, completionPercentage,
    variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
    preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
    performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
    tenderType, purchaseMethod, purchaseCommittee, receivingCommittee,
    acceptanceChecklist, supervisionNotesJson, labTestsJson
  } = req.body;

  if (!name) return res.status(400).json({ error: 'اسم المشروع / العطاء حقل إلزامي' });

  try {
    const id = await generateSequenceId('T', 'tenders');
    const attachmentPath = req.file ? req.file.filename : (req.body.attachmentPath || '');
    const now = new Date().toISOString();
    const finalVal = parseFloat(awardedValue) || parseFloat(value) || parseFloat(estimatedValue) || 0;
    const estVal = parseFloat(estimatedValue) || parseFloat(value) || 0;
    const awdVal = parseFloat(awardedValue) || finalVal;

    const safeJsonString = (val) => typeof val === 'object' ? JSON.stringify(val) : (val || '[]');

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO tenders (
          id, name, contractor, "openDate", "closeDate", value, status, notes, lat, lng,
          "attachmentPath", "tenderType", "purchaseMethod", "purchaseCommittee",
          "estimatedValue", "awardedValue", "commencementDate", "durationDays",
          "supervisorEngineer", "completionPercentage", "variationOrdersValue",
          "district", "tenderNumber", "boqItemsJson", "contractSignDate",
          "preliminaryHandoverDate", "finalHandoverDate", "performanceBondNumber",
          "performanceBondValue", "performanceBondExpiry", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, NOW(), NOW()
        )
      `, [
        id, name, contractor || '', openDate || '', closeDate || '', finalVal, status || 'مفتوح', notes || '',
        parseFloat(lat) || 32.3301, parseFloat(lng) || 35.7501, attachmentPath, tenderType || 'أشغال',
        purchaseMethod || 'مناقصة عامة', purchaseCommittee || 'لجنة الشراء المحلية',
        estVal, awdVal, commencementDate || '', parseInt(durationDays, 10) || 0,
        supervisorEngineer || '', parseFloat(completionPercentage) || 0, parseFloat(variationOrdersValue) || 0,
        district || 'كفرنجة', tenderNumber || id, safeJsonString(boqItemsJson),
        contractSignDate || '', preliminaryHandoverDate || '', finalHandoverDate || '',
        performanceBondNumber || '', parseFloat(performanceBondValue) || 0, performanceBondExpiry || ''
      ]);
    } else {
      memInsert('tenders', {
        id, name, contractor: contractor || '', openDate: openDate || '', closeDate: closeDate || '',
        value: finalVal, estimatedValue: estVal, awardedValue: awdVal, status: status || 'مفتوح',
        notes: notes || '', lat: parseFloat(lat) || 32.3301, lng: parseFloat(lng) || 35.7501,
        attachmentPath, tenderType: tenderType || 'أشغال', purchaseMethod: purchaseMethod || 'مناقصة عامة',
        purchaseCommittee: purchaseCommittee || 'لجنة الشراء المحلية', commencementDate: commencementDate || '',
        durationDays: parseInt(durationDays, 10) || 0, supervisorEngineer: supervisorEngineer || '',
        completionPercentage: parseFloat(completionPercentage) || 0, variationOrdersValue: parseFloat(variationOrdersValue) || 0,
        district: district || 'كفرنجة', tenderNumber: tenderNumber || id,
        boqItemsJson: safeJsonString(boqItemsJson),
        receivingCommittee: safeJsonString(receivingCommittee),
        acceptanceChecklist: safeJsonString(acceptanceChecklist),
        supervisionNotesJson: safeJsonString(supervisionNotesJson),
        labTestsJson: safeJsonString(labTestsJson),
        contractSignDate: contractSignDate || '', preliminaryHandoverDate: preliminaryHandoverDate || '',
        finalHandoverDate: finalHandoverDate || '', performanceBondNumber: performanceBondNumber || '',
        performanceBondValue: parseFloat(performanceBondValue) || 0, performanceBondExpiry: performanceBondExpiry || '',
        createdAt: now, updatedAt: now
      });
    }

    if (req.file) {
      const arcId = 'A-' + Date.now();
      try {
        if (isPostgresActive()) {
          await dbRun(
            `INSERT INTO archive (id, title, name, type, file_size, year, "relatedId", file_name, file_path, "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [arcId, 'مرفق عطاء: ' + id, 'مرفق عطاء: ' + id, 'عطاء', req.file.size, new Date().getFullYear(), id, req.file.originalname || req.file.filename, req.file.filename]
          );
        } else {
          memInsert('archive', { id: arcId, name: 'مرفق عطاء: ' + id, type: 'عطاء', size: (req.file.size/1024/1024).toFixed(1)+'MB', date: new Date().toISOString().split('T')[0], year: new Date().getFullYear().toString(), icon: '📎', relatedId: id, filename: req.file.filename, createdAt: now });
        }
      } catch (ae) {}
    }

    if (global.recordActivity) {
      global.recordActivity({
        userId: req.user?.id,
        userName: req.user?.fullName || req.user?.username,
        action: 'إضافة عطاء',
        entity: 'العطاءات والمشاريع',
        entityId: id,
        details: `إضافة عطاء جديد: ${tenderNumber || id} - ${name} بقيمة ${finalVal.toLocaleString()} د.أ`,
        ip: req.ip || req.socket?.remoteAddress
      });
    }

    res.status(201).json({ success: true, id, message: 'تم إضافة العطاء بنجاح', attachmentPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, authorize('tenders:edit'), upload.single('file'), async (req, res) => {
  const {
    name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
    commencementDate, durationDays, supervisorEngineer, completionPercentage,
    variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
    preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
    performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
    tenderType, purchaseMethod, purchaseCommittee, receivingCommittee,
    acceptanceChecklist, supervisionNotesJson, labTestsJson
  } = req.body;

  try {
    const finalVal = parseFloat(awardedValue) || parseFloat(value) || parseFloat(estimatedValue) || 0;
    const estVal = parseFloat(estimatedValue) || parseFloat(value) || 0;
    const awdVal = parseFloat(awardedValue) || finalVal;

    let shouldUpdateAttachment = false;
    let finalAttachment = '';
    if (req.file) {
      shouldUpdateAttachment = true;
      finalAttachment = req.file.filename;
    } else if (req.body.attachmentPath !== undefined) {
      shouldUpdateAttachment = true;
      finalAttachment = req.body.attachmentPath || '';
    }

    const safeJsonString = (val) => typeof val === 'object' ? JSON.stringify(val) : (val || '[]');

    if (isPostgresActive()) {
      let updateSql = `
        UPDATE tenders SET
          name=$1, contractor=$2, "openDate"=$3, "closeDate"=$4, value=$5, status=$6, notes=$7,
          lat=$8, lng=$9, "tenderType"=$10, "purchaseMethod"=$11, "purchaseCommittee"=$12,
          "estimatedValue"=$13, "awardedValue"=$14, "commencementDate"=$15, "durationDays"=$16,
          "supervisorEngineer"=$17, "completionPercentage"=$18, "variationOrdersValue"=$19,
          "district"=$20, "tenderNumber"=$21, "boqItemsJson"=$22, "contractSignDate"=$23,
          "preliminaryHandoverDate"=$24, "finalHandoverDate"=$25, "performanceBondNumber"=$26,
          "performanceBondValue"=$27, "performanceBondExpiry"=$28, "updatedAt"=NOW()
      `;
      const params = [
        name, contractor || '', openDate || '', closeDate || '', finalVal, status || 'مفتوح', notes || '',
        parseFloat(lat) || 32.3301, parseFloat(lng) || 35.7501, tenderType || 'أشغال',
        purchaseMethod || 'مناقصة عامة', purchaseCommittee || 'لجنة الشراء المحلية',
        estVal, awdVal, commencementDate || '', parseInt(durationDays, 10) || 0,
        supervisorEngineer || '', parseFloat(completionPercentage) || 0, parseFloat(variationOrdersValue) || 0,
        district || 'كفرنجة', tenderNumber || req.params.id,
        safeJsonString(boqItemsJson),
        contractSignDate || '', preliminaryHandoverDate || '', finalHandoverDate || '',
        performanceBondNumber || '', parseFloat(performanceBondValue) || 0, performanceBondExpiry || ''
      ];

      if (shouldUpdateAttachment) {
        params.push(finalAttachment);
        updateSql += `, "attachmentPath"=$${params.length}`;
      }
      params.push(req.params.id);
      updateSql += ` WHERE id=$${params.length}`;

      await dbRun(updateSql, params);
    } else {
      const updates = {
        name, contractor: contractor || '', openDate: openDate || '', closeDate: closeDate || '',
        value: finalVal, estimatedValue: estVal, awardedValue: awdVal, status: status || 'مفتوح',
        notes: notes || '', lat: parseFloat(lat) || 32.3301, lng: parseFloat(lng) || 35.7501,
        tenderType: tenderType || 'أشغال', purchaseMethod: purchaseMethod || 'مناقصة عامة',
        purchaseCommittee: purchaseCommittee || 'لجنة الشراء المحلية', commencementDate: commencementDate || '',
        durationDays: parseInt(durationDays, 10) || 0, supervisorEngineer: supervisorEngineer || '',
        completionPercentage: parseFloat(completionPercentage) || 0, variationOrdersValue: parseFloat(variationOrdersValue) || 0,
        district: district || 'كفرنجة', tenderNumber: tenderNumber || req.params.id,
        boqItemsJson: safeJsonString(boqItemsJson),
        receivingCommittee: safeJsonString(receivingCommittee),
        acceptanceChecklist: safeJsonString(acceptanceChecklist),
        supervisionNotesJson: safeJsonString(supervisionNotesJson),
        labTestsJson: safeJsonString(labTestsJson),
        contractSignDate: contractSignDate || '', preliminaryHandoverDate: preliminaryHandoverDate || '',
        finalHandoverDate: finalHandoverDate || '', performanceBondNumber: performanceBondNumber || '',
        performanceBondValue: parseFloat(performanceBondValue) || 0, performanceBondExpiry: performanceBondExpiry || ''
      };
      if (shouldUpdateAttachment) updates.attachmentPath = finalAttachment;
      memUpdate('tenders', req.params.id, updates);
    }

    res.json({ message: 'تم تحديث العطاء بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, authorize('tenders:delete'), async (req, res) => {
  try {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM tender_daily_reports WHERE tender_id = $1', [req.params.id]);
      await dbRun('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    } else {
      if (memDb.tender_daily_reports) {
        memDb.tender_daily_reports = memDb.tender_daily_reports.filter(r => String(r.tender_id) !== String(req.params.id));
        saveMemTable('tender_daily_reports');
      }
      memDelete('tenders', req.params.id);
    }
    res.json({ message: 'تم حذف العطاء وسجلاته بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4️⃣ منظومة التقارير اليومية وسجل الإنجاز (Daily Field Reports)
// ══════════════════════════════════════════════════════════════════════
router.get('/:id/daily-reports', requireAuth, async (req, res) => {
  try {
    const tenderId = req.params.id;
    let rows = [];
    if (isPostgresActive()) {
      rows = await dbQuery(
        'SELECT * FROM tender_daily_reports WHERE tender_id = $1 ORDER BY report_date DESC, created_at DESC',
        [tenderId]
      );
    } else {
      rows = (memDb.tender_daily_reports || [])
        .filter(r => String(r.tender_id) === String(tenderId))
        .sort((a, b) => new Date(b.report_date || b.created_at || 0) - new Date(a.report_date || a.created_at || 0));
    }
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/daily-reports', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const tenderId = req.params.id;
    const {
      reportDate, reportNumber, weather, temperature, supervisorEngineer,
      fieldInspector, manpowerCount, manpowerDetails, equipmentDetails,
      executedWorks, materialsDelivered, labTests, dailyProgressPercent,
      cumulativeProgressPercent, siteObstacles, instructionsToContractor,
      safetyStatus, asphaltTemp, concreteSlump, compactionRate,
      workHours, workDelayHours, delayReason, lat, lng, siteLocationName
    } = req.body;

    if (!executedWorks || !reportDate) {
      return res.status(400).json({ success: false, error: 'تاريخ التقرير وتفاصيل الأعمال المنفذة حقول إلزامية' });
    }

    const reportId = 'DR-' + tenderId + '-' + Date.now();
    const uploadedFiles = (req.files && Array.isArray(req.files)) ? req.files.map(f => f.filename) : [];
    const attachmentPath = uploadedFiles.length > 0 ? uploadedFiles[0] : (req.body.attachmentPath || '');
    const sitePhotos = uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : (req.body.sitePhotos || '[]');
    const userId = req.user ? (req.user.fullName || req.user.username) : 'مهندس الإشراف';
    const now = new Date().toISOString();

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO tender_daily_reports (
          id, tender_id, report_date, report_number, weather, temperature,
          supervisor_engineer, field_inspector, manpower_count, manpower_details,
          equipment_details, executed_works, materials_delivered, lab_tests,
          daily_progress_percent, cumulative_progress_percent, site_obstacles,
          instructions_to_contractor, attachment_path, site_photos, safety_status,
          asphalt_temp, concrete_slump, compaction_rate, work_hours,
          work_delay_hours, delay_reason, lat, lng, site_location_name,
          created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW(), NOW()
        )
      `, [
        reportId, tenderId, reportDate, reportNumber || `يومي-${reportDate}`, weather || 'معتدل', temperature || '',
        supervisorEngineer || userId, fieldInspector || '', parseInt(manpowerCount, 10) || 0, manpowerDetails || '',
        equipmentDetails || '', executedWorks, materialsDelivered || '', labTests || '',
        parseFloat(dailyProgressPercent) || 0, parseFloat(cumulativeProgressPercent) || 0, siteObstacles || '',
        instructionsToContractor || '', attachmentPath, sitePhotos, safetyStatus || 'ملتزم بمعايير السلامة',
        asphaltTemp || '', concreteSlump || '', compactionRate || '', parseFloat(workHours) || 8.0,
        parseFloat(workDelayHours) || 0, delayReason || '',
        parseFloat(lat) || null, parseFloat(lng) || null, siteLocationName || '', userId
      ]);

      if (parseFloat(cumulativeProgressPercent) > 0) {
        await dbRun('UPDATE tenders SET "completionPercentage" = $1, "updatedAt" = NOW() WHERE id = $2', [parseFloat(cumulativeProgressPercent), tenderId]);
      }
    } else {
      memInsert('tender_daily_reports', {
        id: reportId, tender_id: tenderId, report_date: reportDate, report_number: reportNumber || `يومي-${reportDate}`,
        weather: weather || 'معتدل', temperature: temperature || '', supervisor_engineer: supervisorEngineer || userId,
        field_inspector: fieldInspector || '', manpower_count: parseInt(manpowerCount, 10) || 0, manpower_details: manpowerDetails || '',
        equipment_details: equipmentDetails || '', executed_works: executedWorks, materials_delivered: materialsDelivered || '',
        lab_tests: labTests || '', daily_progress_percent: parseFloat(dailyProgressPercent) || 0,
        cumulative_progress_percent: parseFloat(cumulativeProgressPercent) || 0, site_obstacles: siteObstacles || '',
        instructions_to_contractor: instructionsToContractor || '', attachment_path: attachmentPath,
        site_photos: sitePhotos, safety_status: safetyStatus || 'ملتزم بمعايير السلامة',
        asphalt_temp: asphaltTemp || '', concrete_slump: concreteSlump || '', compaction_rate: compactionRate || '',
        work_hours: parseFloat(workHours) || 8.0, work_delay_hours: parseFloat(workDelayHours) || 0,
        delay_reason: delayReason || '', lat: parseFloat(lat) || 32.3301, lng: parseFloat(lng) || 35.7501,
        site_location_name: siteLocationName || '', created_by: userId, created_at: now, updated_at: now
      });

      if (parseFloat(cumulativeProgressPercent) > 0) {
        const t = memGet('tenders', tenderId);
        if (t) t.completionPercentage = parseFloat(cumulativeProgressPercent);
      }
    }

    res.status(201).json({ success: true, id: reportId, message: 'تم توثيق التقرير اليومي بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:tenderId/daily-reports/:reportId', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { reportId, tenderId } = req.params;
    const {
      reportDate, reportNumber, weather, temperature, supervisorEngineer,
      fieldInspector, manpowerCount, manpowerDetails, equipmentDetails,
      executedWorks, materialsDelivered, labTests, dailyProgressPercent,
      cumulativeProgressPercent, siteObstacles, instructionsToContractor,
      safetyStatus, asphaltTemp, concreteSlump, compactionRate,
      workHours, workDelayHours, delayReason, lat, lng, siteLocationName
    } = req.body;

    const uploadedFiles = (req.files && Array.isArray(req.files)) ? req.files.map(f => f.filename) : [];

    if (isPostgresActive()) {
      let updateSql = `
        UPDATE tender_daily_reports SET
          report_date=$1, report_number=$2, weather=$3, temperature=$4, supervisor_engineer=$5,
          field_inspector=$6, manpower_count=$7, manpower_details=$8, equipment_details=$9,
          executed_works=$10, materials_delivered=$11, lab_tests=$12, daily_progress_percent=$13,
          cumulative_progress_percent=$14, site_obstacles=$15, instructions_to_contractor=$16,
          safety_status=$17, asphalt_temp=$18, concrete_slump=$19, compaction_rate=$20,
          work_hours=$21, work_delay_hours=$22, delay_reason=$23, lat=$24, lng=$25,
          site_location_name=$26, updated_at=NOW()
      `;
      const params = [
        reportDate, reportNumber, weather, temperature, supervisorEngineer,
        fieldInspector, parseInt(manpowerCount, 10) || 0, manpowerDetails, equipmentDetails,
        executedWorks, materialsDelivered, labTests, parseFloat(dailyProgressPercent) || 0,
        parseFloat(cumulativeProgressPercent) || 0, siteObstacles, instructionsToContractor,
        safetyStatus, asphaltTemp, concreteSlump, compactionRate,
        parseFloat(workHours) || 8.0, parseFloat(workDelayHours) || 0, delayReason,
        parseFloat(lat) || null, parseFloat(lng) || null, siteLocationName
      ];

      if (uploadedFiles.length > 0) {
        params.push(uploadedFiles[0]);
        params.push(JSON.stringify(uploadedFiles));
        updateSql += `, attachment_path=$${params.length - 1}, site_photos=$${params.length}`;
      }

      params.push(reportId);
      updateSql += ` WHERE id=$${params.length}`;

      await dbRun(updateSql, params);
      if (parseFloat(cumulativeProgressPercent) > 0) {
        await dbRun('UPDATE tenders SET "completionPercentage" = $1 WHERE id = $2', [parseFloat(cumulativeProgressPercent), tenderId]);
      }
    } else {
      const updates = {
        report_date: reportDate, report_number: reportNumber, weather, temperature, supervisor_engineer: supervisorEngineer,
        field_inspector: fieldInspector, manpower_count: parseInt(manpowerCount, 10) || 0, manpower_details: manpowerDetails,
        equipment_details: equipmentDetails, executed_works: executedWorks, materials_delivered: materialsDelivered,
        lab_tests: labTests, daily_progress_percent: parseFloat(dailyProgressPercent) || 0,
        cumulative_progress_percent: parseFloat(cumulativeProgressPercent) || 0, site_obstacles: siteObstacles,
        instructions_to_contractor: instructionsToContractor, safety_status: safetyStatus,
        asphalt_temp: asphaltTemp, concrete_slump: concreteSlump, compaction_rate: compactionRate,
        work_hours: parseFloat(workHours) || 8.0, work_delay_hours: parseFloat(workDelayHours) || 0,
        delay_reason: delayReason, lat: parseFloat(lat) || 32.3301, lng: parseFloat(lng) || 35.7501,
        site_location_name: siteLocationName
      };
      if (uploadedFiles.length > 0) {
        updates.attachment_path = uploadedFiles[0];
        updates.site_photos = JSON.stringify(uploadedFiles);
      }
      memUpdate('tender_daily_reports', reportId, updates);
      if (parseFloat(cumulativeProgressPercent) > 0) {
        const t = memGet('tenders', tenderId);
        if (t) t.completionPercentage = parseFloat(cumulativeProgressPercent);
      }
    }

    res.json({ success: true, message: 'تم تحديث التقرير اليومي بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:tenderId/daily-reports/:reportId', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    if (isPostgresActive()) {
      await dbRun('DELETE FROM tender_daily_reports WHERE id = $1', [reportId]);
    } else {
      memDelete('tender_daily_reports', reportId);
    }
    res.json({ success: true, message: 'تم حذف التقرير اليومي بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 5️⃣ جداول الكميات وضبط الجودة ولجان الاستلام (BOQ, Quality & Committee)
// ══════════════════════════════════════════════════════════════════════
router.post('/:id/boq', requireAuth, async (req, res) => {
  try {
    const tenderId = req.params.id;
    const { boqItems } = req.body;
    const jsonStr = typeof boqItems === 'object' ? JSON.stringify(boqItems) : (boqItems || '[]');

    if (isPostgresActive()) {
      await dbRun('UPDATE tenders SET "boqItemsJson" = $1, "updatedAt" = NOW() WHERE id = $2', [jsonStr, tenderId]);
    } else {
      const t = memGet('tenders', tenderId);
      if (t) { t.boqItemsJson = jsonStr; saveMemTable('tenders'); }
    }
    res.json({ success: true, message: 'تم حفظ جدول الكميات والأعمال المنفذة بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/acceptance', requireAuth, async (req, res) => {
  try {
    const tenderId = req.params.id;
    const { receivingCommittee, acceptanceChecklist, status, preliminaryHandoverDate, finalHandoverDate } = req.body;

    const commStr = typeof receivingCommittee === 'object' ? JSON.stringify(receivingCommittee) : (receivingCommittee || '[]');
    const chkStr = typeof acceptanceChecklist === 'object' ? JSON.stringify(acceptanceChecklist) : (acceptanceChecklist || '[]');

    if (isPostgresActive()) {
      let sql = 'UPDATE tenders SET "updatedAt" = NOW()';
      const params = [];
      if (status) { params.push(status); sql += `, status = $${params.length}`; }
      if (preliminaryHandoverDate) { params.push(preliminaryHandoverDate); sql += `, "preliminaryHandoverDate" = $${params.length}`; }
      if (finalHandoverDate) { params.push(finalHandoverDate); sql += `, "finalHandoverDate" = $${params.length}`; }
      params.push(tenderId);
      sql += ` WHERE id = $${params.length}`;
      await dbRun(sql, params);
    } else {
      const t = memGet('tenders', tenderId);
      if (t) {
        if (status) t.status = status;
        if (preliminaryHandoverDate) t.preliminaryHandoverDate = preliminaryHandoverDate;
        if (finalHandoverDate) t.finalHandoverDate = finalHandoverDate;
        t.receivingCommittee = commStr;
        t.acceptanceChecklist = chkStr;
        saveMemTable('tenders');
      }
    }

    res.json({ success: true, message: 'تم تحديث لجنة ومحضر الاستلام وجاهزية المشروع بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 6️⃣ تحميل ومعاينة المرفقات الرسمية (Download & Preview)
// ══════════════════════════════════════════════════════════════════════
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    let row;
    if (isPostgresActive()) {
      row = await dbGet('SELECT "attachmentPath" FROM tenders WHERE id = $1', [req.params.id]);
    } else {
      row = memGet('tenders', req.params.id);
    }
    if (!row || !row.attachmentPath) return res.status(404).json({ error: 'لا يوجد مرفق رسمي لهذا العطاء' });
    const filePath = path.join(UPLOADS_DIR, row.attachmentPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود على خادم التخزين' });

    if (req.query.preview === '1') {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
        res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(row.attachmentPath) + '"');
        return res.sendFile(filePath);
      }
    }
    res.download(filePath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
