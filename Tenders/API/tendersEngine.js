/**
 * Tenders/API/tendersEngine.js
 * محرك إدارة العطاءات والمشاريع الرأسمالية والتقارير اليومية الميدانية
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

// 1. استرجاع قائمة العطاءات مع التصفية والبحث
router.get('/', requireAuth, async (req, res) => {
  const { search, status, tenderType, purchaseMethod, purchaseCommittee, page, limit } = req.query;
  try {
    const pg = isPostgresActive();
    if (pg) {
      let sql = 'SELECT * FROM tenders WHERE 1=1';
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (name ILIKE $${params.length} OR contractor ILIKE $${params.length} OR id ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }
      if (tenderType) {
        params.push(tenderType);
        sql += ` AND "tenderType" = $${params.length}`;
      }
      if (purchaseMethod) {
        params.push(purchaseMethod);
        sql += ` AND "purchaseMethod" = $${params.length}`;
      }
      if (purchaseCommittee) {
        params.push(purchaseCommittee);
        sql += ` AND "purchaseCommittee" = $${params.length}`;
      }
      sql += ' ORDER BY "createdAt" DESC';

      if (page && limit) {
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        sql += ` LIMIT ${parseInt(limit, 10)} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params);
      return res.json(rows || []);
    }

    // MemDB fallback
    let rows = (memDb.tenders || []).filter(r => {
      if (search && !(`${r.name} ${r.contractor} ${r.id}`).toLowerCase().includes(search.toLowerCase())) return false;
      if (status && r.status !== status) return false;
      if (tenderType && r.tenderType !== tenderType) return false;
      if (purchaseMethod && r.purchaseMethod !== purchaseMethod) return false;
      if (purchaseCommittee && r.purchaseCommittee !== purchaseCommittee) return false;
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

// 2. استرجاع بيانات عطاء محدد
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

// 3. تحميل ومعاينة مرفقات العطاء
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    let row;
    if (isPostgresActive()) {
      row = await dbGet('SELECT "attachmentPath" FROM tenders WHERE id = $1', [req.params.id]);
    } else {
      row = memGet('tenders', req.params.id);
    }
    if (!row || !row.attachmentPath) return res.status(404).json({ error: 'لا يوجد مرفق لهذا العطاء' });
    const filePath = path.join(UPLOADS_DIR, row.attachmentPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود على الخادم' });

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

// 4. إنشاء عطاء جديد
router.post('/', requireAuth, authorize('tenders:create'), upload.single('file'), async (req, res) => {
  const {
    name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
    commencementDate, durationDays, supervisorEngineer, completionPercentage,
    variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
    preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
    performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
    tenderType, purchaseMethod, purchaseCommittee, budget_line_id, budgetLineId
  } = req.body;

  if (!name) return res.status(400).json({ error: 'اسم المشروع مطلوب' });

  try {
    const id = await generateSequenceId('T', 'tenders');
    const attachmentPath = req.file ? req.file.filename : (req.body.attachmentPath || '');
    const now = new Date().toISOString();
    const finalVal = parseFloat(awardedValue) || parseFloat(value) || parseFloat(estimatedValue) || 0;
    const estVal = parseFloat(estimatedValue) || parseFloat(value) || 0;
    const awdVal = parseFloat(awardedValue) || finalVal;
    const selectedBudgetLine = budget_line_id || budgetLineId || null;

    if (selectedBudgetLine) {
      try {
        const budgetEngineService = require('../../services/budgetEngineService');
        await budgetEngineService.createAllocation({
          budget_line_id: selectedBudgetLine,
          entity_type: 'TENDER',
          entity_id: id,
          entity_name: name,
          amount: finalVal,
          status: 'COMMITTED'
        });
      } catch (be) {
        return res.status(400).json({ error: `تعذر اعتماد العطاء لعدم توفر مخصص مالي كافٍ: ${be.message}` });
      }
    }

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
        district || 'كفرنجة', tenderNumber || id, typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
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
        boqItemsJson: typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
        contractSignDate: contractSignDate || '', preliminaryHandoverDate: preliminaryHandoverDate || '',
        finalHandoverDate: finalHandoverDate || '', performanceBondNumber: performanceBondNumber || '',
        performanceBondValue: parseFloat(performanceBondValue) || 0, performanceBondExpiry: performanceBondExpiry || '',
        budget_line_id: selectedBudgetLine,
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
      } catch (ae) {
        console.warn('Archive insert error:', ae.message);
      }
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

    const sendNotification = req.app ? req.app.get('sendNotification') : null;
    if (sendNotification) {
      sendNotification({
        userId: 'all',
        title: 'عطاء جديد',
        message: `تم إضافة العطاء: ${name} بقيمة ${finalVal.toLocaleString()} د.أ`,
        link: 'tenders',
        type: 'success'
      });
    }

    res.status(201).json({ success: true, id, message: 'تم إضافة العطاء بنجاح', attachmentPath });
  } catch (e) {
    console.error('Create tender error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 5. تعديل عطاء
router.put('/:id', requireAuth, authorize('tenders:edit'), upload.single('file'), async (req, res) => {
  const {
    name, contractor, openDate, closeDate, value, estimatedValue, awardedValue,
    commencementDate, durationDays, supervisorEngineer, completionPercentage,
    variationOrdersValue, district, tenderNumber, boqItemsJson, contractSignDate,
    preliminaryHandoverDate, finalHandoverDate, performanceBondNumber,
    performanceBondValue, performanceBondExpiry, status, notes, lat, lng,
    tenderType, purchaseMethod, purchaseCommittee
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
        typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
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
        boqItemsJson: typeof boqItemsJson === 'object' ? JSON.stringify(boqItemsJson) : (boqItemsJson || '[]'),
        contractSignDate: contractSignDate || '', preliminaryHandoverDate: preliminaryHandoverDate || '',
        finalHandoverDate: finalHandoverDate || '', performanceBondNumber: performanceBondNumber || '',
        performanceBondValue: parseFloat(performanceBondValue) || 0, performanceBondExpiry: performanceBondExpiry || ''
      };
      if (shouldUpdateAttachment) updates.attachmentPath = finalAttachment;
      memUpdate('tenders', req.params.id, updates);
    }

    res.json({ message: 'تم تحديث العطاء بنجاح', success: true });
  } catch (e) {
    console.error('Update tender error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 6. حذف عطاء
router.delete('/:id', requireAuth, authorize('tenders:delete'), async (req, res) => {
  try {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    } else {
      memDelete('tenders', req.params.id);
    }
    res.json({ message: 'تم حذف العطاء بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 📝 منظومة التقارير اليومية للأعمال الميدانية (Daily Reports)
// ══════════════════════════════════════════════════════════════════════

// 7. استرجاع التقارير اليومية لعطاء
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

// 8. إضافة تقرير يومي لعطاء
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
    const userId = req.user ? req.user.id : 'نظام';
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
        supervisorEngineer || '', fieldInspector || '', parseInt(manpowerCount, 10) || 0, manpowerDetails || '',
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
        weather: weather || 'معتدل', temperature: temperature || '', supervisor_engineer: supervisorEngineer || '',
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

    const sendNotification = req.app ? req.app.get('sendNotification') : null;
    if (typeof sendNotification === 'function') {
      sendNotification({
        userId: 'all',
        title: '📝 تقرير ميداني جديد',
        message: `تم توثيق تقرير يومي جديد للعطاء (${tenderId}) بتاريخ ${reportDate}`,
        link: `tenders:${tenderId}`,
        type: 'tenders'
      });
    }

    res.status(201).json({ success: true, id: reportId, message: 'تم حفظ وتوثيق التقرير اليومي بنجاح' });
  } catch (e) {
    console.error('Create daily report error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 9. تعديل تقرير يومي
router.put('/:tenderId/daily-reports/:reportId', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { reportId } = req.params;
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
    }

    res.json({ success: true, message: 'تم تحديث التقرير اليومي بنجاح' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 10. حذف تقرير يومي
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

module.exports = router;
