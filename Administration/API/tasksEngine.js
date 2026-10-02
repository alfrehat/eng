/**
 * Administration/API/tasksEngine.js
 * 📋 موجه مهايئ المهام الإدارية القديم (Legacy Tasks Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * [LEGACY CANDIDATE / ADAPTER ONLY]:
 * هذا الملف مهايئ توافقي رفيع (Thin HTTP Adapter) يفوّض كافة عملياته إلى
 * المحرك الكنوني المعتمد: services/tasksEngineService.js المسجل في engineRegistry.
 * لا يحتوي هذا الملف على أي منطق نطاق (Domain Logic) أو استعلامات بيانات مستقلة.
 */

'use strict';

const express = require('express');
const router = express.Router();
const tasksEngineService = require('../../services/tasksEngineService');
const { requireAuth } = require('../../middlewares/authMiddleware');

// 1. استعلام قائمة المهام (تفويض مباشر للخدمة الكنونية)
router.get('/', requireAuth, async (req, res) => {
  try {
    const tasks = await tasksEngineService.getTasks(req.query, req.user);
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. فحص الجاهزية التشغيلية للمحرك
router.get('/health', async (req, res) => {
  try {
    const health = await tasksEngineService.healthCheck();
    res.json(health);
  } catch (err) {
    res.status(500).json({ healthy: false, error: err.message });
  }
});

// 3. استرجاع مهمة محددة بالمعرف
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const task = await tasksEngineService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'المهمة المطلوبة غير موجودة' });
    }
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. إنشاء مهمة جديدة
router.post('/', requireAuth, async (req, res) => {
  try {
    const created = await tasksEngineService.createTask(req.body, req.user);
    res.status(201).json({ success: true, message: 'تم إنشاء المهمة بنجاح', data: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. تعديل بيانات مهمة
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await tasksEngineService.updateTask(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'تم تحديث المهمة بنجاح', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. حذف مهمة
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await tasksEngineService.deleteTask(req.params.id, req.user);
    res.json({ success: true, message: 'تم حذف المهمة بنجاح', data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
