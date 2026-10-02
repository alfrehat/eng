/**
 * services/archiveEngineService.js
 * 📦 محرك الأرشفة الرقمية والتوثيق المؤسسي الموحد (ARCHIVE_DOCUMENT_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.1 - Anti-Gravity Enterprise Canonical Archive Engine (Strict ACID & No False Success)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable, getPool } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class ArchiveEngineService {
  constructor() {
    this.engineId = 'ARCHIVE_DOCUMENT_ENGINE';
    this.engineAlias = 'ARCHIVE_ENGINE';
    this.engineName = 'Enterprise Digital Archive & Document Retention Engine';
    this.version = '3.1.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'document_retention',
      'sha256_integrity_check',
      'soft_delete_protection',
      'secure_search',
      'audit_integration',
      'backward_compatible_indexing',
      'storage_analytics',
      'batch_lock',
      'batch_tag',
      'batch_delete'
    ];
    this.archiveStorageDir = path.join(process.cwd(), 'storage', 'archive');
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this._ensureStorageDir();
  }

  _ensureStorageDir() {
    try {
      if (!fs.existsSync(this.archiveStorageDir)) {
        fs.mkdirSync(this.archiveStorageDir, { recursive: true });
      }
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
    } catch (e) {
      logError('ArchiveEngine', `Failed to create storage directory: ${e.message}`);
    }
  }

  /**
   * مزامنة المرآة التوافقية (Compatibility Projection) لـ memDb.archive
   * ملاحظة معمارية: هذا الإجراء مشتق حصراً من memDb.documents ولا يمثل Source of Truth مستقل
   */
  _syncCompatibilityProjection() {
    if (!memDb) return;
    if (!memDb.documents) memDb.documents = [];
    memDb.archive = memDb.documents.map(d => ({
      ...d,
      department: 'مديرية الأشغال والخدمات الهندسية'
    }));
    saveMemTable('archive');
  }

  /**
   * حساب بصمة الهاش المشفرة SHA-256 الفعلية (بدون قيم عشوائية أو وهمية)
   */
  async calculateFileHashStream(filePath) {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => {
          logWarn('ArchiveEngine', `Stream hash error on [${filePath}]: ${err.message}`);
          resolve(null);
        });
      } catch (err) {
        logWarn('ArchiveEngine', `File stream open failed [${filePath}]: ${err.message}`);
        resolve(null);
      }
    });
  }

  _calculateBufferHash(buffer) {
    if (Buffer.isBuffer(buffer) && buffer.length > 0) {
      return crypto.createHash('sha256').update(buffer).digest('hex');
    }
    return null;
  }

  calculateChecksum(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      const buf = fs.readFileSync(filePath);
      return this._calculateBufferHash(buf);
    } catch (e) {
      return null;
    }
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي activity_log
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء الأرشفة [${action}] على المستند [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const logId = 'LOG-ARC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأرشيف الإلكتروني والوثائق',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ArchiveEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * أرشفة مستند رسمي جديد مع بصمة SHA-256 والترقيم الموحد في public.documents
   * صارم: ممنوع False Success عند فشل PostgreSQL
   */
  async archiveDocument(docData, user = null) {
    const { title, name, fileName, category, subcategory, filePath, fileBuffer, originalName, mimeType, tags, retentionYears, relatedId, relatedType, referenceNumber, securityLevel, notes } = docData;
    if (!title && !fileName && !name && !originalName) {
      throw new Error('عنوان المستند أو اسم الملف إلزامي لإتمام الأرشفة.');
    }

    const docTitle = title || name || fileName || originalName || 'مستند مؤرشف';
    const id = docData.id || await numberingEngine.generateNextId('documents', { prefix: 'ARC' });
    const now = new Date().toISOString();

    let targetPath = filePath || '';
    let fileSize = Number(docData.fileSize || docData.file_size_bytes || docData.file_size || 0);
    let fileHash = docData.file_hash || docData.sha256_hash || null;

    if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
      fileSize = fileBuffer.length;
      fileHash = this._calculateBufferHash(fileBuffer);
      const safeFilename = `${id}_${Date.now()}_${originalName || fileName || 'document.dat'}`;
      targetPath = path.join(this.archiveStorageDir, safeFilename);
      fs.writeFileSync(targetPath, fileBuffer);
    } else if (filePath && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
      fileHash = await this.calculateFileHashStream(filePath);
    }

    const parsedTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    const storedFilename = targetPath ? path.basename(targetPath) : (fileName || originalName || '');

    const record = {
      id,
      document_number: id,
      title: docTitle,
      name: docTitle,
      category: category || docData.entityType || 'مستند هندسي عام',
      subcategory: subcategory || 'مستند رسمي',
      file_path: targetPath,
      filePath: targetPath,
      file_size: fileSize,
      file_size_bytes: fileSize,
      file_hash: fileHash,
      sha256_hash: fileHash,
      mime_type: mimeType || docData.fileType || 'application/pdf',
      file_type: (docData.fileType || (targetPath ? path.extname(targetPath).replace('.', '') : 'PDF')).toUpperCase(),
      filename: storedFilename,
      originalName: originalName || fileName || storedFilename,
      tags: parsedTags,
      retention_years: parseInt(retentionYears || 5, 10),
      is_locked: false,
      isLocked: false,
      locked_at: null,
      lockedAt: null,
      is_deleted: false,
      deleted_at: null,
      archived_by: user?.fullName || user?.username || 'النظام المركزي',
      uploadedBy: user?.fullName || user?.username || 'النظام المركزي',
      related_id: relatedId || docData.entityId || '',
      relatedId: relatedId || docData.entityId || '',
      related_type: relatedType || docData.entityType || '',
      relatedType: relatedType || docData.entityType || '',
      reference_number: referenceNumber || id,
      referenceNumber: referenceNumber || id,
      security_level: securityLevel || 'OFFICIAL',
      notes: notes || '',
      created_at: now,
      updated_at: now,
      createdAt: now,
      updatedAt: now,
      date: docData.date || now.split('T')[0],
      year: docData.year || now.split('-')[0]
    };

    // 1. الكتابة في PostgreSQL أولاً إن كان نشطاً (بدون ابتلاع الأخطاء)
    if (isPostgresActive()) {
      try {
        await dbRun(`
          INSERT INTO public.documents
          (id, document_number, title, category, subcategory, file_path, file_size, file_hash, mime_type, tags, retention_years, is_locked, locked_at, is_deleted, archived_by, related_id, related_type, reference_number, security_level, notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title, category = EXCLUDED.category, subcategory = EXCLUDED.subcategory,
            file_path = EXCLUDED.file_path, file_size = EXCLUDED.file_size, file_hash = EXCLUDED.file_hash,
            tags = EXCLUDED.tags, related_id = EXCLUDED.related_id, related_type = EXCLUDED.related_type,
            reference_number = EXCLUDED.reference_number, security_level = EXCLUDED.security_level,
            notes = EXCLUDED.notes, updated_at = NOW()
        `, [
          record.id, record.document_number, record.title, record.category, record.subcategory,
          record.file_path, record.file_size, record.file_hash, record.mime_type,
          JSON.stringify(record.tags), record.retention_years, record.is_locked, record.locked_at,
          record.is_deleted, record.archived_by, record.related_id, record.related_type,
          record.reference_number, record.security_level, record.notes
        ]);
      } catch (dbErr) {
        logError('ArchiveEngine', `PostgreSQL write failed in archiveDocument: ${dbErr.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${dbErr.message}`);
      }
    }

    // 2. مزامنة الذاكرة والـ Fallback فقط بعد نجاح الكتابة في قاعدة البيانات
    if (!memDb.documents) memDb.documents = [];
    const dIdx = memDb.documents.findIndex(d => d.id === record.id);
    if (dIdx !== -1) memDb.documents[dIdx] = record;
    else memDb.documents.unshift(record);
    saveMemTable('documents');

    this._syncCompatibilityProjection();

    const clientIp = user?.clientIp || '127.0.0.1';
    await this._recordAudit(user?.id, id, 'DOCUMENT_ARCHIVED', null, { title: docTitle, fileHash }, clientIp);
    return record;
  }

  /**
   * فهرسة وأرشفة متوافقة مع الإصدارات السابقة (Backward Compatibility)
   */
  async indexDocument(docData, user = null) {
    return await this.archiveDocument(docData, user);
  }

  /**
   * تطبيع واسترجاع قائمة المستندات المؤرشفة مع التصفح والبحث
   * صارم: فصل النتيجة الفارغة الصحيحة عن فشل قاعدة البيانات
   */
  async getDocuments(filters = {}) {
    const { search, category, type, year, fileType, relatedId, limit = 500, offset = 0 } = filters;
    let list = [];

    if (isPostgresActive()) {
      try {
        let sql = 'SELECT * FROM public.documents WHERE is_deleted = false';
        const params = [];

        if (category && category !== 'ALL') {
          params.push(category);
          sql += ` AND (category = $${params.length} OR subcategory = $${params.length})`;
        }
        if (relatedId) {
          params.push(relatedId);
          sql += ` AND (related_id = $${params.length} OR reference_number = $${params.length})`;
        }
        if (search) {
          params.push(`%${search.trim()}%`);
          sql += ` AND (title ILIKE $${params.length} OR id ILIKE $${params.length} OR reference_number ILIKE $${params.length} OR related_id ILIKE $${params.length} OR notes ILIKE $${params.length})`;
        }

        sql += ` ORDER BY created_at DESC LIMIT ${Math.max(1, parseInt(limit, 10))} OFFSET ${Math.max(0, parseInt(offset, 10))}`;
        const pool = getPool();
        const res = await pool.query(sql, params);
        list = (res.rows || []).map(r => this._normalizeDocumentRecord(r));

        if (year) {
          list = list.filter(d => String(d.year) === String(year) || (d.date && d.date.startsWith(String(year))));
        }
        if (fileType) {
          list = list.filter(d => (d.file_type || '').toUpperCase() === fileType.toUpperCase());
        }

        // عند نجاح استعلام PostgreSQL: rows.length === 0 هو نتيجة فارغة صحيحة تماماً.
        // ممنوع منعاً باتاً التراجع إلى الذاكرة المحلية memDb في هذه الحالة!
        return list;
      } catch (e) {
        logError('ArchiveEngine', `PostgreSQL query failed: ${e.message}`);
        throw new Error(`DATABASE_QUERY_FAILED: ${e.message}`);
      }
    }

    // النمط المحلي فقط عند عدم تشغيل PostgreSQL نهائياً
    list = (memDb.documents || []).filter(d => !d.is_deleted).map(r => this._normalizeDocumentRecord(r));
    if (category && category !== 'ALL') {
      list = list.filter(d => (d.category && d.category.includes(category)) || (d.subcategory && d.subcategory.includes(category)));
    }
    if (relatedId) {
      list = list.filter(d => d.relatedId === relatedId || d.referenceNumber === relatedId);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(d =>
        (d.title && d.title.toLowerCase().includes(s)) ||
        (d.id && d.id.toLowerCase().includes(s)) ||
        (d.referenceNumber && d.referenceNumber.toLowerCase().includes(s)) ||
        (d.relatedId && d.relatedId.toLowerCase().includes(s))
      );
    }
    if (year) {
      list = list.filter(d => String(d.year) === String(year) || (d.date && d.date.startsWith(String(year))));
    }
    if (fileType) {
      list = list.filter(d => (d.file_type || '').toUpperCase() === fileType.toUpperCase());
    }

    return list;
  }

  _normalizeDocumentRecord(r) {
    const rawSize = Number(r.file_size_bytes || r.file_size || 0);
    const sizeStr = rawSize > 0 ? (rawSize / (1024 * 1024)).toFixed(2) + ' MB' : '—';
    const parsedTags = Array.isArray(r.tags) ? r.tags : (typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : []);
    const dateStr = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : (r.date || '—');
    const filename = r.file_path ? path.basename(r.file_path) : (r.filename || r.fileName || '');

    return {
      id: r.id,
      title: r.title,
      name: r.title,
      category: r.category || 'أخرى',
      type: r.category || 'مستند',
      subcategory: r.subcategory || 'مستند رسمي',
      file_path: r.file_path,
      filePath: r.file_path,
      file_size: sizeStr,
      file_size_bytes: rawSize,
      file_type: (r.file_type || (filename ? path.extname(filename).replace('.', '') : 'PDF')).toUpperCase(),
      filename,
      originalName: r.original_name || r.originalName || filename,
      sha256_hash: r.file_hash || r.sha256_hash || null,
      security_level: r.security_level || 'OFFICIAL',
      year: r.year || (dateStr !== '—' ? dateStr.split('-')[0] : '2026'),
      date: dateStr,
      relatedId: r.related_id || r.relatedId || '',
      relatedType: r.related_type || r.relatedType || '',
      uploadedBy: r.archived_by || r.uploadedBy || 'المهندس',
      referenceNumber: r.reference_number || r.referenceNumber || r.id,
      tags: parsedTags,
      notes: r.notes || '',
      is_locked: !!(r.is_locked || r.isLocked),
      isLocked: !!(r.is_locked || r.isLocked),
      locked_at: r.locked_at || r.lockedAt || null,
      lockedAt: r.locked_at || r.lockedAt || null,
      created_at: r.created_at || r.createdAt,
      updated_at: r.updated_at || r.updatedAt
    };
  }

  /**
   * استرجاع مستند مفرد بالمعرف
   */
  async getDocumentById(docId) {
    if (!docId) return null;

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('SELECT * FROM public.documents WHERE (id = $1 OR document_number = $1) AND is_deleted = false', [docId]);
        const row = res.rows && res.rows.length > 0 ? res.rows[0] : null;
        return row ? this._normalizeDocumentRecord(row) : null;
      } catch (e) {
        logError('ArchiveEngine', `PostgreSQL getDocumentById failed: ${e.message}`);
        throw new Error(`DATABASE_QUERY_FAILED: ${e.message}`);
      }
    }

    const memDoc = (memDb.documents || []).find(d => (d.id === docId || d.document_number === docId) && !d.is_deleted);
    return memDoc ? this._normalizeDocumentRecord(memDoc) : null;
  }

  /**
   * تحديث بيانات المستند الوصفية (Metadata Update) مع حماية القفل
   * صارم: ممنوع False Success عند فشل PostgreSQL
   */
  async updateDocument(id, updateData, user = null) {
    const existing = await this.getDocumentById(id);
    if (!existing) throw new Error(`المستند [${id}] غير موجود.`);

    if (existing.isLocked && user?.role !== 'admin' && user?.role !== 'director_public_works' && user?.id !== 'U-001') {
      throw new Error('الوثيقة مقفلة ومعتمدة رسمياً ولا يمكن تعديلها إلا من قبل مدير النظام أو المدير الهندسي.');
    }

    const { title, name, category, subcategory, relatedId, referenceNumber, notes, tags, securityLevel, isLocked } = updateData;
    const finalTitle = title || name || existing.title;
    const finalCategory = category || existing.category;
    const finalSubcategory = subcategory || existing.subcategory;
    const finalRelated = relatedId !== undefined ? relatedId : existing.relatedId;
    const finalRef = referenceNumber !== undefined ? referenceNumber : existing.referenceNumber;
    const finalSec = securityLevel || existing.security_level;
    const finalNotes = notes !== undefined ? notes : existing.notes;
    const finalTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : existing.tags);
    const nextLocked = isLocked !== undefined ? Boolean(isLocked) : existing.isLocked;
    const nextLockedAt = nextLocked ? (existing.lockedAt || new Date().toISOString()) : null;

    // 1. الكتابة في PostgreSQL أولاً دون ابتلاع الخطأ
    if (isPostgresActive()) {
      try {
        await dbRun(`
          UPDATE public.documents SET
            title = $1, category = $2, subcategory = $3, related_id = $4,
            reference_number = $5, security_level = $6, notes = $7,
            tags = $8::jsonb, is_locked = $9, locked_at = $10, updated_at = NOW()
          WHERE id = $11
        `, [
          finalTitle, finalCategory, finalSubcategory, finalRelated,
          finalRef, finalSec, finalNotes, JSON.stringify(finalTags),
          nextLocked, nextLockedAt, existing.id
        ]);
      } catch (dbErr) {
        logError('ArchiveEngine', `PostgreSQL write failed in updateDocument: ${dbErr.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${dbErr.message}`);
      }
    }

    // 2. تحديث الذاكرة المحلية فقط بعد نجاح الكتابة في قاعدة البيانات
    const updated = {
      ...existing,
      title: finalTitle,
      name: finalTitle,
      category: finalCategory,
      subcategory: finalSubcategory,
      relatedId: finalRelated,
      referenceNumber: finalRef,
      security_level: finalSec,
      notes: finalNotes,
      tags: finalTags,
      is_locked: nextLocked,
      isLocked: nextLocked,
      locked_at: nextLockedAt,
      lockedAt: nextLockedAt,
      updated_at: new Date().toISOString()
    };

    if (memDb.documents) {
      const idx = memDb.documents.findIndex(d => d.id === existing.id);
      if (idx !== -1) memDb.documents[idx] = updated;
      saveMemTable('documents');
    }

    this._syncCompatibilityProjection();

    const clientIp = user?.clientIp || '127.0.0.1';
    await this._recordAudit(user?.id, existing.id, 'DOCUMENT_UPDATED', existing, updated, clientIp);
    return updated;
  }

  /**
   * قفل / إلغاء قفل وثائق متعددة (Batch Lock)
   */
  async batchLockDocuments(ids, isLocked = true, user = null) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('يجب تحديد معرفات الوثائق.');
    if (user?.role !== 'admin' && user?.role !== 'director_public_works' && user?.id !== 'U-001') {
      throw new Error('صلاحية قفل واعتماد الوثائق مخصصة لمدير النظام والمدير الهندسي فقط.');
    }

    const lockVal = Boolean(isLocked);
    const lockTime = lockVal ? new Date().toISOString() : null;

    if (isPostgresActive()) {
      try {
        for (const id of ids) {
          await dbRun('UPDATE public.documents SET is_locked = $1, locked_at = $2, updated_at = NOW() WHERE id = $3',
            [lockVal, lockTime, id]);
        }
      } catch (dbErr) {
        logError('ArchiveEngine', `PostgreSQL write failed in batchLockDocuments: ${dbErr.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${dbErr.message}`);
      }
    }

    if (memDb.documents) {
      for (const id of ids) {
        const doc = memDb.documents.find(d => String(d.id) === String(id));
        if (doc) {
          doc.is_locked = lockVal;
          doc.isLocked = lockVal;
          doc.locked_at = lockTime;
          doc.lockedAt = lockTime;
        }
      }
      saveMemTable('documents');
    }

    this._syncCompatibilityProjection();

    const clientIp = user?.clientIp || '127.0.0.1';
    await this._recordAudit(user?.id, 'BATCH', 'BATCH_LOCK', { count: ids.length }, { isLocked: lockVal }, clientIp);
    return { success: true, message: `تم ${lockVal ? 'قفل واعتماد' : 'إلغاء قفل'} ${ids.length} وثيقة بنجاح`, count: ids.length };
  }

  /**
   * إضافة وسوم لوثائق متعددة دفعة واحدة (Batch Tag)
   */
  async batchTagDocuments(ids, tags, user = null) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('يجب تحديد معرفات الوثائق.');
    const newTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    if (!newTags.length) throw new Error('يجب تحديد وسوم صالحة لإضافتها.');

    let updatedCount = 0;

    if (isPostgresActive()) {
      try {
        for (const id of ids) {
          const doc = await this.getDocumentById(id);
          if (!doc) continue;
          const merged = Array.from(new Set([...(doc.tags || []), ...newTags]));
          await dbRun('UPDATE public.documents SET tags = $1::jsonb, updated_at = NOW() WHERE id = $2', [JSON.stringify(merged), id]);
          updatedCount++;
        }
      } catch (dbErr) {
        logError('ArchiveEngine', `PostgreSQL write failed in batchTagDocuments: ${dbErr.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${dbErr.message}`);
      }
    } else {
      for (const id of ids) {
        const doc = await this.getDocumentById(id);
        if (!doc) continue;
        updatedCount++;
      }
    }

    if (memDb.documents) {
      for (const id of ids) {
        const m = memDb.documents.find(d => String(d.id) === String(id));
        if (m) {
          m.tags = Array.from(new Set([...(m.tags || []), ...newTags]));
        }
      }
      saveMemTable('documents');
    }

    this._syncCompatibilityProjection();

    const clientIp = user?.clientIp || '127.0.0.1';
    await this._recordAudit(user?.id, 'BATCH', 'BATCH_TAG', { ids }, { addedTags: newTags }, clientIp);
    return { success: true, message: `تمت إضافة الوسوم إلى ${updatedCount} وثيقة بنجاح`, updatedCount };
  }

  /**
   * حذف جماعي ناعم ومحمي (Batch Delete)
   */
  async batchDeleteDocuments(ids, user = null) {
    if (!Array.isArray(ids) || !ids.length) throw new Error('يجب تحديد معرفات الوثائق للحذف.');
    let deletedCount = 0;
    const errors = [];

    for (const id of ids) {
      try {
        await this.softDeleteDocument(id, user);
        deletedCount++;
      } catch (err) {
        errors.push(`${id}: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `تم حذف ${deletedCount} وثيقة بنجاح من الأرشيف الإلكتروني`,
      deletedCount,
      errors: errors.length ? errors : undefined
    };
  }

  /**
   * تطبيق الحذف الناعم (Soft Delete)
   * صارم: ممنوع False Success عند فشل PostgreSQL
   */
  async softDeleteDocument(docId, user = null) {
    const existing = await this.getDocumentById(docId);
    if (!existing) throw new Error(`المستند [${docId}] غير موجود.`);

    if (existing.isLocked) {
      throw new Error(`لا يمكن حذف الوثيقة [${docId}] لأنها مقفلة ومعتمدة رسمياً.`);
    }

    if (isPostgresActive()) {
      try {
        await dbRun('UPDATE public.documents SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [existing.id]);
      } catch (dbErr) {
        logError('ArchiveEngine', `PostgreSQL write failed in softDeleteDocument: ${dbErr.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${dbErr.message}`);
      }
    }

    if (memDb.documents) {
      const idx = memDb.documents.findIndex(d => d.id === existing.id);
      if (idx !== -1) memDb.documents[idx].is_deleted = true;
      saveMemTable('documents');
    }

    this._syncCompatibilityProjection();

    const clientIp = user?.clientIp || '127.0.0.1';
    await this._recordAudit(user?.id, existing.id, 'DOCUMENT_SOFT_DELETED', existing, { is_deleted: true }, clientIp);
    return { success: true, message: 'تم حذف المستند بنجاح من الأرشيف الإلكتروني (حذف ناعم آمن).' };
  }

  /**
   * التحقق الصارم من نزاهة وبصمة المستند الرقمية (SHA-256 Checksum Verification)
   * صارم: لا تعلن الوثيقة سليمة إذا كان الهاش مفقوداً أو الملف مفقوداً أو الهاش غير متطابق
   */
  async verifyDocumentIntegrity(id) {
    const doc = await this.getDocumentById(id);
    if (!doc) return { valid: false, error: 'الوثيقة غير مسجلة في الأرشيف.' };

    const p = doc.file_path || doc.filePath;
    const expectedHash = doc.file_hash || doc.sha256_hash;

    // 1. فحص وجود الملف الفيزيائي على القرص
    if (!p || !fs.existsSync(p)) {
      return {
        valid: false,
        id: doc.id,
        title: doc.title || doc.name,
        error: doc.filename
          ? 'الملف الفيزيائي غير موجود على خادم التخزين.'
          : 'هذا السجل هو قيد أرشفة إلكتروني بدون ملف فيزيائي مرفق.',
        hash: null,
        expectedHash: expectedHash || null,
        timestamp: doc.created_at || doc.createdAt,
        verifiedAt: new Date().toISOString(),
        signer: 'بلدية كفرنجة الجديدة - ختم التوثيق الرقمي'
      };
    }

    // 2. فحص وجود بصمة متوقعة مسجلة مسبقاً (ممنوع إعلان السلامة بدون بصمة سابقة)
    if (!expectedHash) {
      const actualHash = await this.calculateFileHashStream(p);
      return {
        valid: false,
        id: doc.id,
        title: doc.title || doc.name,
        error: 'لم يتم العثور على بصمة تشفير مسجلة مسبقاً لمطابقتها.',
        hash: actualHash,
        expectedHash: null,
        timestamp: doc.created_at || doc.createdAt,
        verifiedAt: new Date().toISOString(),
        signer: 'بلدية كفرنجة الجديدة - ختم التوثيق الرقمي'
      };
    }

    // 3. حساب البصمة الفعلية عبر التدفق ومقارنتها بدقة وحزم
    const actualHash = await this.calculateFileHashStream(p);
    const intact = Boolean(actualHash && (expectedHash.toLowerCase() === actualHash.toLowerCase()));

    return {
      valid: intact,
      id: doc.id,
      title: doc.title || doc.name,
      hash: actualHash,
      expectedHash: expectedHash,
      timestamp: doc.created_at || doc.createdAt,
      verifiedAt: new Date().toISOString(),
      signer: 'بلدية كفرنجة الجديدة - ختم التوثيق الرقمي'
    };
  }

  /**
   * استخراج مؤشرات وإحصائيات الأرشيف الشاملة (Archive Analytics & Storage Quota)
   */
  async getStats() {
    const all = await this.getDocuments({ limit: 10000 });
    let tendersCount = 0, tasksCount = 0, claimsCount = 0, permitsCount = 0, contractsCount = 0, otherCount = 0;
    let totalBytes = 0;

    all.forEach(doc => {
      const cat = (doc.category || doc.type || '').toLowerCase();
      if (cat.includes('عطاء') || cat.includes('tender')) tendersCount++;
      else if (cat.includes('مطالب') || cat.includes('مال') || cat.includes('claim')) claimsCount++;
      else if (cat.includes('تصريح') || cat.includes('حفر') || cat.includes('permit')) permitsCount++;
      else if (cat.includes('عقد') || cat.includes('contract')) contractsCount++;
      else if (cat.includes('مهم') || cat.includes('task')) tasksCount++;
      else otherCount++;

      totalBytes += Number(doc.file_size_bytes || 0);
    });

    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    const allocatedQuotaMB = 10240; // 10 GB
    const usagePercent = Math.min(100, ((totalBytes / (allocatedQuotaMB * 1024 * 1024)) * 100)).toFixed(1);

    return {
      total: all.length,
      tendersCount,
      tasksCount,
      claimsCount,
      permitsCount,
      contractsCount,
      otherCount,
      totalBytes,
      totalSizeMB: totalMB + ' MB',
      allocatedQuotaMB,
      usagePercent,
      storageStatus: 'HEALTHY',
      latestUploads: all.slice(0, 5)
    };
  }

  /**
   * تحليل توزيع السعة التخزينية (Storage Breakdown)
   */
  async getStorageBreakdown() {
    const list = await this.getDocuments({ limit: 10000 });
    let totalBytes = 0;
    const byCategory = {};
    const byFileType = {};

    list.forEach(doc => {
      const bytes = Number(doc.file_size_bytes || 0);
      totalBytes += bytes;

      const cat = doc.category || 'أخرى';
      byCategory[cat] = (byCategory[cat] || 0) + bytes;

      const ft = (doc.file_type || 'PDF').toUpperCase();
      byFileType[ft] = (byFileType[ft] || 0) + bytes;
    });

    return {
      totalDocuments: list.length,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      allocatedQuotaMB: 10240,
      quotaUsedPercent: ((totalBytes / (10240 * 1024 * 1024)) * 100).toFixed(1),
      byCategory,
      byFileType
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   * صارم: إرجاع healthy: false و status: DEGRADED عند فشل PostgreSQL
   */
  async healthCheck() {
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        if (!pool) throw new Error('PostgreSQL pool is null');
        const res = await pool.query('SELECT COUNT(*) as count FROM public.documents WHERE is_deleted = false');
        const totalDocs = parseInt(res?.rows?.[0]?.count || 0, 10);
        return {
          healthy: true,
          status: 'READY',
          engineId: this.engineId,
          engineName: this.engineName,
          totalActiveDocuments: totalDocs,
          timestamp: new Date().toISOString()
        };
      } catch (e) {
        logError('ArchiveEngine', `HealthCheck PostgreSQL failure: ${e.message}`);
        return {
          healthy: false,
          status: 'DEGRADED',
          engineId: this.engineId,
          engineName: this.engineName,
          error: `DATABASE_UNAVAILABLE: ${e.message}`,
          timestamp: new Date().toISOString()
        };
      }
    }

    // النمط المحلي فقط إذا لم يكن PostgreSQL مفعلاً في الإعدادات
    const totalDocs = (memDb.documents || []).filter(d => !d.is_deleted).length;
    return {
      healthy: true,
      status: 'READY',
      mode: 'LOCAL_FALLBACK',
      engineId: this.engineId,
      engineName: this.engineName,
      totalActiveDocuments: totalDocs,
      timestamp: new Date().toISOString()
    };
  }
}

const archiveEngineService = new ArchiveEngineService();
module.exports = archiveEngineService;
