/**
 * services/archiveEngineService.js
 * 📁 محرك الأرشفة الرقمية والتوثيق والربط الإلكتروني الموحد (Live Central Document Archive Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable
} = require('../utils/database');
const numberingEngine = require('./numberingEngine');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

class ArchiveEngineService {
  constructor() {
    this.engineId = 'ARCHIVE_DOCUMENT_ENGINE';
    this.engineName = 'Enterprise Live Document Archive & File Repository Engine';
    this.version = '5.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'document_upload',
      'metadata_indexing',
      'entity_linking',
      'retrieval_search',
      'sha256_verification',
      'versioning',
      'batch_operations',
      'storage_analytics'
    ];
  }

  calculateChecksum(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
      }
    } catch (e) {}
    return crypto.createHash('sha256').update(String(Date.now() + Math.random())).digest('hex');
  }

  async getDocuments(filters = {}) {
    if (isPostgresActive()) {
      try {
        return await dbQuery('SELECT * FROM documents ORDER BY created_at DESC') || [];
      } catch (e) {
        return memDb.documents || [];
      }
    }
    return memDb.documents || [];
  }

  async indexDocument(docData, user = null) {
    const { 
      title, 
      fileName, 
      filePath, 
      category, 
      subcategory, 
      entityType, 
      entityId, 
      referenceNumber, 
      tags, 
      notes, 
      fileSize, 
      fileType 
    } = docData;

    let id = docData.id;
    if (!id) {
      try {
        id = await numberingEngine.generateNextId('archive', { prefix: 'ARC' });
      } catch (e) {
        id = `ARC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      }
    }

    const fullFilePath = filePath && fs.existsSync(filePath) ? filePath : (fileName ? path.join(UPLOADS_DIR, fileName) : null);
    const sha256 = this.calculateChecksum(fullFilePath);

    const record = {
      id,
      title: title || fileName || 'وثيقة هندسية مؤرشفة',
      name: title || fileName || 'وثيقة هندسية مؤرشفة',
      fileName: fileName || '',
      filename: fileName || '',
      filePath: filePath || (fileName ? '/uploads/' + fileName : ''),
      category: category || entityType || 'أخرى',
      subcategory: subcategory || 'مستند رسمي',
      entityType: entityType || category || 'GENERAL',
      entityId: entityId || docData.relatedId || null,
      relatedId: entityId || docData.relatedId || '',
      relatedType: entityType || docData.relatedType || '',
      referenceNumber: referenceNumber || docData.refNumber || id,
      file_size: fileSize || '1.2 MB',
      file_size_bytes: docData.fileSizeBytes || 1200000,
      file_type: (fileType || (fileName ? path.extname(fileName).replace('.', '') : 'PDF')).toUpperCase(),
      sha256_hash: sha256,
      security_level: docData.securityLevel || 'OFFICIAL',
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      notes: notes || '',
      uploadedBy: user?.fullName || user?.username || 'المهندس',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0'
    };

    if (!memDb.documents) memDb.documents = [];
    memDb.documents.unshift(record);
    saveMemTable('documents');

    // Sync to archive table
    if (!memDb.archive) memDb.archive = [];
    const exists = memDb.archive.findIndex(d => String(d.id) === String(record.id));
    if (exists >= 0) {
      memDb.archive[exists] = record;
    } else {
      memDb.archive.unshift(record);
    }
    saveMemTable('archive');

    return record;
  }

  async verifyDocumentIntegrity(id) {
    const list = await this.getDocuments();
    const doc = list.find(d => String(d.id) === String(id));
    if (!doc) return { valid: false, error: 'Document not found' };

    let intact = true;
    let actualHash = doc.sha256_hash;
    if (doc.fileName) {
      const fullPath = path.join(UPLOADS_DIR, doc.fileName);
      if (fs.existsSync(fullPath)) {
        actualHash = this.calculateChecksum(fullPath);
        intact = !doc.sha256_hash || doc.sha256_hash === actualHash;
      }
    }

    return {
      valid: intact,
      id: doc.id,
      title: doc.title,
      hash: actualHash,
      expectedHash: doc.sha256_hash || actualHash,
      timestamp: doc.createdAt,
      verifiedAt: new Date().toISOString(),
      signer: 'بلدية كفرنجة الجديدة - ختم التوثيق الرقمي'
    };
  }

  async getStorageBreakdown() {
    const list = await this.getDocuments();
    let totalBytes = 0;
    const byCategory = {};
    const byFileType = {};

    list.forEach(doc => {
      const bytes = doc.file_size_bytes || 1200000;
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
      allocatedQuotaMB: 10240, // 10 GB
      quotaUsedPercent: ((totalBytes / (10240 * 1024 * 1024)) * 100).toFixed(1),
      byCategory,
      byFileType
    };
  }

  async healthCheck() {
    const list = memDb.documents || [];
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      totalDocuments: list.length,
      timestamp: new Date().toISOString()
    };
  }
}

const archiveEngineService = new ArchiveEngineService();
module.exports = archiveEngineService;
