// routes/inspections.js
/**
 * routes/inspections.js
 * بوابة فحص ميداني (Inspection Gateway) لالتقاط فشل الفحص وإرسال إشعارات
 */

const express = require('express');
const router = express.Router();
const notificationCenter = require('../../services/notificationCenter');
const { memDb } = require('../../utils/database');

// GET /api/inspections
router.get('/', (req, res) => {
  const roadInspections = memDb.road_inspections || [];
  const roadDefects = memDb.road_defects || [];
  res.json({
    success: true,
    inspections: roadInspections,
    defects: roadDefects,
    count: roadInspections.length
  });
});

// POST /api/v4/inspections/failure
// توقع payload يحتوي على: { roadId, issue, engineerPhone }
router.post('/failure', async (req, res) => {
  const { roadId, issue, engineerPhone } = req.body;
  if (!roadId || !issue) {
    return res.status(400).json({ error: 'الحقول المطلوبة مفقودة' });
  }
  // هنا يمكن إضافة منطق لتسجيل الفشل في قاعدة البيانات إذا لزم الأمر
  // ... (omitted for brevity)

  // إطلاق حدث فشل الفحص الميداني
  notificationCenter.emit('INSPECTION_FAILED', {
    roadId,
    issue,
    engineerPhone: engineerPhone || '0780479507'
  });

  res.json({ message: 'تم تسجيل فشل الفحص وإرسال إشعار' });
});

module.exports = router;
