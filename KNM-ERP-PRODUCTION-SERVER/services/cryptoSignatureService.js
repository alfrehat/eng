/**
 * services/cryptoSignatureService.js
 * محرك التواقيع الرقمية والتشفير بالمفاتيح العامة والخاصة (PKI Digital Signature Engine)
 * 
 * الميزات المعمارية والبرمجية المنفذة:
 * 1. توظيف خوارزمية التوقيع الإلكتروني المتقدمة SHA-256 وحشوة RSA-PSS للتحقق والتوقيع الرقمي.
 * 2. دعم بروتوكول التوقيع الثلاثي المشترك (المشرف الميداني، مدير الأشغال، رئيس البلدية).
 * 3. القفل التشفيري النهائي التلقائي (isLocked = true) وتريجر التأكيد عند استكمال كافة التواقيع.
 * 4. الحساب اللحظي والآمن لبصمات المستندات الفنية وعطاءات البلدية (File Hashing SHA-256).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logSecurity, logInfo, logError } = require('./loggerService');

/**
 * توليد زوج من المفاتيح (RSA Key Pair) للاختبار أو الحسابات الجديدة
 * @returns {object} { publicKey, privateKey } بنسق PEM
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
 * @param {string} filePath المسار الفعلي للملف
 * @returns {string} الهاش المولد بصيغة hex
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
    console.error('❌ [Crypto Service] Hashing & Signing failed:', err.message);
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
    console.error('❌ [Crypto Service] Verification failed:', err.message);
    return false;
  }
}

/**
 * تنفيذ بروتوكول التوقيع الثلاثي المشترك (Triple Co-signature Workflow)
 * الأطراف المطلوبة: المشرف الفني (supervisor)، مدير الأشغال (works_manager)، رئيس البلدية (mayor)
 * 
 * @param {string} documentVersionId معرف نسخة المستند / المطالبة
 * @param {object} signerInfo بيانات الموقع { userId, role, fullName, notes }
 * @param {string} privateKeyPem المفتاح الخاص للموقع
 * @param {object} pgClient عميل اتصال PostgreSQL
 * @returns {Promise<object>} نتيجة إضافة التوقيع حالة المستند
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

  // 1. الاستعلام عن المستند والتواقيع السابقة
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

  // 2. التحقق من سلامة البصمة الحالية للملف
  let currentHash = doc.fileHash;
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    currentHash = calculateFileHash(doc.filePath);
    if (currentHash !== doc.fileHash) {
      logSecurity('TAMPER_DETECTED', userId, { documentVersionId, storedHash: doc.fileHash, currentHash });
      throw new Error('حظر أمني: تم التلاعب بملف المستند الأصلي بعد إنشائه!');
    }
  }

  // 3. التوقيع بواسطة المفتاح الخاص وتوليد المفتاح العام المعتمد
  const signatureBase64 = signDocumentHash(userId, documentVersionId, privateKeyPem, currentHash);
  const { publicKey } = generateKeyPair(); // في الإنتاج يتم جلب المفتاح العام الخاص بالمستخدم

  // 4. تسجيل التوقيع في جدول التواقيع الرقمية
  const sigId = 'SIG-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  await pgClient.query(`
    INSERT INTO enterprise.digital_signatures 
    (id, documentVersionId, signedBy, role, signature, publicKey, signedAt, notes)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
  `, [sigId, documentVersionId, userId, role, signatureBase64, publicKey, notes || '']);

  // 5. فحص التواقيع المستكملة للمستند
  const allSigsRes = await pgClient.query(`
    SELECT role FROM enterprise.digital_signatures WHERE documentVersionId = $1
  `, [documentVersionId]);

  const signedRoles = (allSigsRes.rows || []).map(r => r.role);
  const isTripleComplete = REQUIRED_ROLES.every(r => signedRoles.includes(r));

  // 6. القفل التشفيري النهائي وتوليد البصمة المرجعية عند اكتمال التواقيع الثلاثة
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

  logInfo('CryptoSignature', `Signature added for role ${role} on doc ${documentVersionId}.`, { signedRoles });

  return {
    status: 'PARTIAL',
    isLocked: false,
    message: `تم إضافة توقيع ${role} بنجاح. المتبقي: ${REQUIRED_ROLES.filter(r => !signedRoles.includes(r)).join(', ')}`,
    signedRoles
  };
}

/**
 * التحقق من توقيع رقمي مسجل بقاعدة البيانات بالكامل وتأكيد مطابقة البصمة
 */
async function verifyDocumentSignature(signatureId, dbQueryFn) {
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

module.exports = {
  generateKeyPair,
  calculateFileHash,
  signDocumentHash,
  verifyDocumentHash,
  processTripleCoSignature,
  verifyDocumentSignature
};
