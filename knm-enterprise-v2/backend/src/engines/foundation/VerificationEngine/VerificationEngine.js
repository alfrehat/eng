/**
 * knm-enterprise-v2/backend/src/engines/foundation/VerificationEngine/VerificationEngine.js
 * Centralized Enterprise Cryptographic & QR Verification Engine
 */

const crypto = require('crypto');
const AppError = require('../../../core/AppError');

class VerificationEngine {
  constructor(options = {}) {
    this._secret = options.secret || process.env.JWT_SECRET || 'kafranjah-verification-secret-2026';
    this._algorithm = 'sha256';
  }

  /**
   * Create an immutable verification seal for an entity or document
   */
  createSeal(referenceNumber, documentType, payload = {}, issuedBy = 'SYSTEM') {
    if (!referenceNumber) throw AppError.badRequest('Reference number is required for verification seal');
    if (!documentType) throw AppError.badRequest('Document type is required for verification seal');

    const timestamp = new Date().toISOString();
    const dataToSign = JSON.stringify({
      ref: referenceNumber,
      type: documentType,
      data: payload,
      issuer: issuedBy,
      ts: timestamp
    });

    const hmac = crypto.createHmac(this._algorithm, this._secret);
    hmac.update(dataToSign);
    const signature = hmac.digest('hex');

    // Create a compact verifiable token
    const tokenPayload = {
      ref: referenceNumber,
      type: documentType,
      ts: timestamp,
      sig: signature.slice(0, 32) // Compact 32-char seal
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    return {
      sealId: crypto.randomUUID(),
      referenceNumber,
      documentType,
      timestamp,
      issuedBy,
      signature,
      compactSeal: tokenPayload.sig,
      verificationToken: token,
      verificationUrl: `/verify.html?seal=${token}`
    };
  }

  /**
   * Verify the integrity of a sealed entity against a provided signature
   */
  verifyIntegrity(referenceNumber, documentType, payload, timestamp, issuedBy, expectedSignature) {
    const dataToSign = JSON.stringify({
      ref: referenceNumber,
      type: documentType,
      data: payload,
      issuer: issuedBy,
      ts: timestamp
    });

    const hmac = crypto.createHmac(this._algorithm, this._secret);
    hmac.update(dataToSign);
    const calculatedSignature = hmac.digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(expectedSignature)
    );

    return {
      verified: isValid,
      tampered: !isValid,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Decode and validate a compact verification token
   */
  decodeToken(token) {
    try {
      const json = Buffer.from(token, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);

      if (!parsed.ref || !parsed.type || !parsed.sig) {
        throw new Error('Malformed seal token payload');
      }

      return {
        valid: true,
        referenceNumber: parsed.ref,
        documentType: parsed.type,
        issuedAt: parsed.ts,
        seal: parsed.sig
      };
    } catch (err) {
      return {
        valid: false,
        error: 'Invalid or corrupted verification token'
      };
    }
  }

  /**
   * Generate SHA-256 fingerprint for document file contents
   */
  hashFile(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer)) {
      throw AppError.badRequest('File buffer is required for hashing');
    }
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
}

const defaultVerificationEngine = new VerificationEngine();

module.exports = {
  VerificationEngine,
  verificationEngine: defaultVerificationEngine
};
