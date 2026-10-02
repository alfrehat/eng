/**
 * Archive/API/archiveEngine.js
 * 🗄️ محول بروتوكول الأرشيف والتوثيق الإلكتروني الموحد (ARCHIVE_ENGINE HTTP Adapter)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Anti-Gravity Enterprise Thin HTTP Adapter
 * 
 * هذا الملف يعمل حصراً كـ HTTP Adapter خفيف يقوم بتوجيه كافة الطلبات إلى المحرك الكانوني:
 * services/archiveEngineService.js (ARCHIVE_DOCUMENT_ENGINE)
 * وخالٍ تماماً من أي استعلامات مباشرة لقواعد البيانات أو تعديلات Schema بالتشغيل أو بيانات وهمية.
 */

'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');
const archiveEngineService = require('../../services/archiveEngineService');
const { logError } = require('../../services/loggerService');

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${unique}-${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ─────────────────────────────────────────────────────────────────────────────
// نقاط النهاية لقراءة الإحصائيات والتحليلات (Read / Analytics Endpoints)
// ─────────────────────────────────────────────────────────────────────────────

router.get(['/stats', '/analytics'], requireAuth, async (req, res) => {
  try {
    const stats = await archiveEngineService.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    logError('ArchiveAPI', `Failed to get stats: ${err.message}`);
    res.status(500).json({ success: false, error: 'فشل جلب إحصائيات الأرشيف', details: err.message });
  }
});

router.get('/storage-breakdown', requireAuth, async (req, res) => {
  try {
    const breakdown = await archiveEngineService.getStorageBreakdown();
    res.json({ success: true, breakdown });
  } catch (err) {
    logError('ArchiveAPI', `Failed to get storage breakdown: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// استرجاع الوثائق والبحث المفصل (Document Retrieval & Search)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await archiveEngineService.getDocuments(req.query);
    res.json(list);
  } catch (err) {
    logError('ArchiveAPI', `Failed to get documents: ${err.message}`);
    res.status(500).json({ success: false, error: 'فشل جلب وثائق الأرشيف', details: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await archiveEngineService.getDocumentById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'الوثيقة غير موجودة' });
    }
    res.json(doc);
  } catch (err) {
    logError('ArchiveAPI', `Failed to get document [${req.params.id}]: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/verify', requireAuth, async (req, res) => {
  try {
    const verification = await archiveEngineService.verifyDocumentIntegrity(req.params.id);
    res.json({ success: true, verification });
  } catch (err) {
    logError('ArchiveAPI', `Verification failed [${req.params.id}]: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// إنشاء وأرشفة المستندات (Create / Upload Endpoints)
// ─────────────────────────────────────────────────────────────────────────────

router.post(['/', '/upload'], requireAuth, upload.array('files', 15), async (req, res) => {
  try {
    const {
      title, name, category, type, subcategory, relatedId, relatedType,
      referenceNumber, notes, tags, securityLevel, year, date
    } = req.body;

    const parsedTags = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const createdDocs = [];

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const docTitle = req.files.length > 1
          ? `${title || name || file.originalname} (${i + 1})`
          : (title || name || file.originalname);

        const newDoc = await archiveEngineService.archiveDocument({
          title: docTitle,
          name: docTitle,
          category,
          type,
          subcategory,
          filePath: file.path,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          relatedId,
          relatedType,
          referenceNumber,
          notes,
          tags: parsedTags,
          securityLevel,
          year,
          date
        }, req.user);

        createdDocs.push(newDoc);
      }
    } else {
      const docTitle = title || name || 'مستند مؤرشف';
      const newDoc = await archiveEngineService.archiveDocument({
        title: docTitle,
        name: docTitle,
        category,
        type,
        subcategory,
        relatedId,
        relatedType,
        referenceNumber,
        notes,
        tags: parsedTags,
        securityLevel,
        year,
        date
      }, req.user);

      createdDocs.push(newDoc);
    }

    res.status(201).json({
      success: true,
      message: `تمت أرشفة وتوثيق ${createdDocs.length} مستند بنجاح بالرقم [${createdDocs[0]?.id}]`,
      documents: createdDocs,
      id: createdDocs[0]?.id
    });
  } catch (err) {
    logError('ArchiveAPI', `Upload error: ${err.message}`);
    res.status(500).json({ success: false, error: 'فشل حفظ وأرشفة المستند', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// تعديل البيانات الوصفية (Metadata Update)
// ─────────────────────────────────────────────────────────────────────────────

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const updated = await archiveEngineService.updateDocument(req.params.id, req.body, req.user);
    res.json({ success: true, message: 'تم تحديث بيانات الوثيقة بنجاح', document: updated });
  } catch (err) {
    logError('ArchiveAPI', `Update document error: ${err.message}`);
    const isForbidden = err.message && err.message.includes('مقفلة');
    const isNotFound = err.message && err.message.includes('غير موجود');
    const status = isForbidden ? 403 : (isNotFound ? 404 : 500);
    res.status(status).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// العمليات الجماعية (Batch Operations)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/batch-lock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids, isLocked } = req.body;
    const result = await archiveEngineService.batchLockDocuments(ids, isLocked, req.user);
    res.json(result);
  } catch (err) {
    logError('ArchiveAPI', `Batch lock error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batch-tag', requireAuth, async (req, res) => {
  try {
    const { ids, tags } = req.body;
    const result = await archiveEngineService.batchTagDocuments(ids, tags, req.user);
    res.json(result);
  } catch (err) {
    logError('ArchiveAPI', `Batch tag error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// الحذف الناعم (Soft Delete)
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await archiveEngineService.softDeleteDocument(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    logError('ArchiveAPI', `Delete document error: ${err.message}`);
    const isForbidden = err.message && err.message.includes('مقفلة');
    const isNotFound = err.message && err.message.includes('غير موجود');
    const status = isForbidden ? 403 : (isNotFound ? 404 : 500);
    res.status(status).json({ success: false, error: err.message });
  }
});

router.post('/batch-delete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await archiveEngineService.batchDeleteDocuments(ids, req.user);
    res.json(result);
  } catch (err) {
    logError('ArchiveAPI', `Batch delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
