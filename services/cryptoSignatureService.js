/**
 * services/cryptoSignatureService.js
 * 🔐 محرك التوقيع والتحقق الرقمي والشهادات (VERIFICATION_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Cryptographic Signature & Verification Patch
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isPostgresActive, dbRun, memDb, saveMemTable } = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

/**
 * توليد زوج من المفاتيح (RSA Key Pair) للاختبار أو الحسابات الجديدة
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

/**
 * حساب بصمة ملف (SHA-256 Hash) من مساره على السيرفر
 */
function calculateFileHash(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * التوقيع الرقمي على محتوى ملف أو مطالبة باستخدام مفتاح خاص بنسق RSA-PSS
 */
function signDocumentHash(userId, documentVersionId, privateKeyPem, fileHash) {
  try {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(fileHash);
    const signature = sign.sign({
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO
    }, 'base64');
    return signature;
  } catch (err) {
    logError('CryptoSignature', `Hashing & Signing failed: ${err.message}`);
    throw new Error('فشل التوقيع الرقمي للمستند: ' + err.message);
  }
}

/**
 * التحقق من توقيع رقمي معين بواسطة المفتاح العام والهاش
 */
function verifyDocumentHash(publicKeyPem, signatureBase64, fileHash) {
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(fileHash);
    return verify.verify({
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO
    }, signatureBase64, 'base64');
  } catch (err) {
    logError('CryptoSignature', `Verification failed: ${err.message}`);
    return false;
  }
}

/**
 * تنفيذ بروتوكول التوقيع الثلاثي المشترك (Triple Co-signature Workflow)
 */
async function processTripleCoSignature(documentVersionId, signerInfo, privateKeyPem, pgClient) {
  const REQUIRED_ROLES = ['supervisor', 'works_manager', 'mayor'];
  const { userId, role, fullName, notes } = signerInfo;

  if (!REQUIRED_ROLES.includes(role)) {
    throw new Error(`الدور '${role}' غير مصرح له بالتوقيع الثلاثي الرسمي المعتمد.`);
  }

  if (!pgClient) {
    throw new Error('قاعدة البيانات غير متصلة؛ تعذر إتمام التوقيع التشفيري الثلاثي.');
  }

  const docRes = await pgClient.query(`
    SELECT * FROM enterprise.document_versions WHERE id = $1
  `, [documentVersionId]);

  if (!docRes.rows || docRes.rows.length === 0) {
    throw new Error('المستند المالي/الفني المحدد غير موجود في سجلات الأرشيف التشفيري.');
  }

  const doc = docRes.rows[0];

  if (doc.isLocked) {
    throw new Error('المستند مغلق تشفيرياً بالفعل ولا يمكن إضافة أي توقيع جديد عليه.');
  }

  let currentHash = doc.fileHash;
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    currentHash = calculateFileHash(doc.filePath);
    if (currentHash !== doc.fileHash) {
      logError('CryptoSignature', 'TAMPER_DETECTED: Document file hash mismatch!', { documentVersionId, storedHash: doc.fileHash, currentHash });
      throw new Error('حظر أمني: تم التلاعب بملف المستند الأصلي بعد إنشائه!');
    }
  }

  const signatureBase64 = signDocumentHash(userId, documentVersionId, privateKeyPem, currentHash);
  const { publicKey } = generateKeyPair();

  const sigId = 'SIG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  await pgClient.query(`
    INSERT INTO enterprise.digital_signatures 
    (id, documentVersionId, signedBy, role, signature, publicKey, signedAt, notes)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
  `, [sigId, documentVersionId, userId, role, signatureBase64, publicKey, notes || '']);

  const allSigsRes = await pgClient.query(`
    SELECT role FROM enterprise.digital_signatures WHERE documentVersionId = $1
  `, [documentVersionId]);

  const signedRoles = (allSigsRes.rows || []).map(r => r.role);
  const isTripleComplete = REQUIRED_ROLES.every(r => signedRoles.includes(r));

  if (isTripleComplete) {
    const finalFingerprint = crypto.createHash('sha256')
      .update(currentHash + signedRoles.sort().join(':') + Date.now())
      .digest('hex');

    await pgClient.query(`
      UPDATE enterprise.document_versions
      SET isLocked = true,
          lockedAt = NOW(),
          finalFingerprint = $1
      WHERE id = $2
    `, [finalFingerprint, documentVersionId]);

    logInfo('CryptoSignature', `🔒 Document ${documentVersionId} FULLY LOCKED with Triple Co-signature!`, {
      finalFingerprint,
      signedBy: signedRoles
    });

    return {
      status: 'LOCKED',
      isLocked: true,
      message: 'تم استكمال التوقيع الثلاثي المشترك وقفل المستند تشفيرياً بنجاح.',
      finalFingerprint,
      signedRoles
    };
  }

  return {
    status: 'PARTIAL',
    isLocked: false,
    message: `تم إضافة توقيع ${role} بنجاح. المتبقي: ${REQUIRED_ROLES.filter(r => !signedRoles.includes(r)).join(', ')}`,
    signedRoles
  };
}

class CryptoSignatureService {
  constructor() {
    this.engineId = 'VERIFICATION_ENGINE';
    this.engineName = 'Enterprise Cryptographic Signature & Document Verification Engine';
    this.version = '2.0.0';
    this.category = 'SECURITY_CORE';
    this.status = 'READY';
    this.capabilities = [
      'sha256_digital_sealing',
      'hmac_document_signing',
      'cryptographic_integrity_verification',
      'verification_audit_logging',
      'tamper_detection',
      'pki_triple_co_signature'
    ];
    this.secretKey = process.env.MUNICIPAL_CRYPTO_SECRET || 'KAFERANJA_MUNICIPALITY_SECURE_2026_KEY';
  }

  async _recordAudit(entityId, action, details) {
    try {
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity: 'التحقق الرقمي',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });
    } catch (e) {
      logWarn('CryptoSignatureService', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * حساب بصمة الهاش الرقمية المشفرة (SHA-256) لأي كينونة أو مستند
   */
  calculateDocumentHash(payload) {
    try {
      const canonicalString = typeof payload === 'string' ? payload : JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
      return crypto.createHash('sha256').update(canonicalString).digest('hex');
    } catch (e) {
      logError('CryptoSignatureService', `Failed to calculate document hash: ${e.message}`);
      return crypto.createHash('sha256').update(String(Date.now())).digest('hex');
    }
  }

  calculateFileHash(filePath) {
    return calculateFileHash(filePath);
  }

  generateKeyPair() {
    return generateKeyPair();
  }

  signDocumentHash(userId, documentVersionId, privateKeyPem, fileHash) {
    return signDocumentHash(userId, documentVersionId, privateKeyPem, fileHash);
  }

  verifyDocumentHash(publicKeyPem, signatureBase64, fileHash) {
    return verifyDocumentHash(publicKeyPem, signatureBase64, fileHash);
  }

  processTripleCoSignature(documentVersionId, signerInfo, privateKeyPem, pgClient) {
    return processTripleCoSignature(documentVersionId, signerInfo, privateKeyPem, pgClient);
  }

  /**
   * توليد توقيع رقمي مؤمن باستخدام HMAC-SHA256
   */
  signDocument(payload) {
    try {
      const canonicalString = typeof payload === 'string' ? payload : JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
      const signature = crypto.createHmac('sha256', this.secretKey).update(canonicalString).digest('hex');
      return {
        success: true,
        signature,
        algorithm: 'HMAC-SHA256',
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      logError('CryptoSignatureService', `Document signing failed: ${e.message}`);
      throw new Error(`تعذر توقيع المستند رقمياً: ${e.message}`);
    }
  }

  /**
   * التحقق من سلامة البصمة والتوقيع الرقمي للمستند
   */
  async verifyDocumentSignature(payloadOrSignatureId, expectedSignatureOrDbQuery, documentId = 'UNKNOWN') {
    // دعم التوافق العكسي في حال كان المعامل الثاني دالة استعلام قاعدة بيانات
    if (typeof expectedSignatureOrDbQuery === 'function') {
      return await this._verifyDocumentSignatureFromDb(payloadOrSignatureId, expectedSignatureOrDbQuery);
    }

    try {
      const generated = this.signDocument(payloadOrSignatureId);
      const isValid = crypto.timingSafeEqual(
        Buffer.from(generated.signature, 'hex'),
        Buffer.from(expectedSignatureOrDbQuery || '', 'hex')
      );

      if (!isValid) {
        await this._recordAudit(documentId, 'TAMPER_DETECTED', `⚠️ تحذير أمني: اكتشاف محاولة تلاعب أو عدم مطابقة للختم الرقمي للمستند [${documentId}]`);
      }

      return {
        isValid,
        documentId,
        checkedAt: new Date().toISOString()
      };
    } catch (e) {
      logWarn('CryptoSignatureService', `Signature verification error: ${e.message}`);
      await this._recordAudit(documentId, 'VERIFICATION_ERROR', `خطأ في عملية التحقق من التوقيع للمستند [${documentId}]: ${e.message}`);
      return { isValid: false, error: e.message };
    }
  }

  async _verifyDocumentSignatureFromDb(signatureId, dbQueryFn) {
    try {
      const sigRows = await dbQueryFn(`
        SELECT sig.*, doc.fileHash, doc.filePath, doc.isLocked 
        FROM enterprise.digital_signatures sig
        INNER JOIN enterprise.document_versions doc ON sig.documentVersionId = doc.id
        WHERE sig.id = $1
      `, [signatureId]);

      if (!sigRows || sigRows.length === 0) {
        return { isValid: false, message: 'لم يتم العثور على التوقيع الرقمي المحدد' };
      }

      const sigData = sigRows[0];
      let currentHash = '';
      try {
        currentHash = calculateFileHash(sigData.filePath);
      } catch (err) {
        return { isValid: false, message: 'الملف الفعلي المرفق مفقود أو تعذر قراءته' };
      }

      if (currentHash !== sigData.fileHash) {
        return { 
          isValid: false, 
          message: 'تحذير أمني: تم التلاعب بالملف أو تعديله بعد إضافة التوقيع الرقمي عليه!' 
        };
      }

      const isCryptoValid = verifyDocumentHash(sigData.publicKey, sigData.signature, currentHash);
      
      if (isCryptoValid) {
        return {
          isValid: true,
          message: 'التوقيع الرقمي سليم تماماً ولم يخضع الملف لأي تعديل منذ توقيعه.',
          details: {
            signedBy: sigData.signedBy,
            signedAt: sigData.signedAt,
            fileHash: currentHash
          }
        };
      } else {
        return { isValid: false, message: 'فشل التطابق التشفيري للتوقيع الرقمي؛ المفتاح العام أو التوقيع غير متطابقين.' };
      }
    } catch (err) {
      return { isValid: false, message: 'حدث خطأ غير متوقع أثناء التحقق: ' + err.message };
    }
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      algorithm: 'HMAC-SHA256 / SHA-256',
      timestamp: new Date().toISOString()
    };
  }
}

const cryptoSignatureInstance = new CryptoSignatureService();

// ربط الدوال للتوافق المباشر مع استدعاءات Destructuring
cryptoSignatureInstance.generateKeyPair = generateKeyPair;
cryptoSignatureInstance.calculateFileHash = calculateFileHash;
cryptoSignatureInstance.calculateDocumentHash = cryptoSignatureInstance.calculateDocumentHash.bind(cryptoSignatureInstance);
cryptoSignatureInstance.signDocumentHash = signDocumentHash;
cryptoSignatureInstance.verifyDocumentHash = verifyDocumentHash;
cryptoSignatureInstance.processTripleCoSignature = processTripleCoSignature;
cryptoSignatureInstance.verifyDocumentSignature = cryptoSignatureInstance.verifyDocumentSignature.bind(cryptoSignatureInstance);

module.exports = cryptoSignatureInstance;
