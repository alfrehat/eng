/**
 * services/authorizationEngineService.js
 * 🛡️ محرك الصلاحيات والأمان المتقدم (AUTHORIZATION_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Enterprise IAM, FLAC & Security Audit Edition
 */

const jwt = require('jsonwebtoken');
const { isPostgresActive, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const { logWarn, logError, logInfo } = require('./loggerService');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

class AuthorizationEngineService {
  constructor() {
    this.engineId = 'AUTHORIZATION_ENGINE';
    this.engineName = 'Enterprise IAM, FLAC & Security Audit Engine';
    this.version = '3.0.0';
    this.category = 'SECURITY_CORE';
    this.status = 'READY';
    this.capabilities = [
      'rbac_matrix_validation',
      'field_level_access_control',
      'unauthorized_intrusion_audit',
      'token_revocation_blacklist',
      'context_aware_abac',
      'district_scope_filtering'
    ];

    this.rolePermissions = {
      admin: ['*'],
      director_public_works: ['PROJECTS.*', 'TENDERS.*', 'BUDGET.*', 'ROADS.*', 'INSPECTION.*', 'TASKS.*', 'REPORTS.VIEW', 'PURCHASES.*', 'CONTRACTS.*'],
      head_of_section: ['PROJECTS.VIEW', 'PROJECTS.EDIT', 'TENDERS.VIEW', 'ROADS.*', 'INSPECTION.*', 'TASKS.*', 'REPORTS.VIEW'],
      engineer: ['PROJECTS.VIEW', 'ROADS.VIEW', 'ROADS.SURVEY', 'INSPECTION.CREATE', 'TASKS.VIEW', 'TASKS.EDIT', 'REPORTS.VIEW'],
      accountant: ['BUDGET.*', 'TENDERS.VIEW', 'PURCHASES.*', 'REPORTS.VIEW', 'CLAIMS.*'],
      viewer: ['*.VIEW']
    };

    // حقول حساسة ممنوعة عن الأدوار الدنيا (Field-Level Restrictions - FLAC)
    this.restrictedFields = {
      engineer: ['approved_budget', 'awarded_value', 'estimated_value', 'salary'],
      viewer: ['approved_budget', 'awarded_value', 'estimated_value', 'salary', 'national_id']
    };
  }

  _normalizePermission(perm) {
    if (!perm || typeof perm !== 'string') return '';
    return perm.replace(':', '.').toUpperCase().trim();
  }

  /**
   * تسجيل محاولة اختراق أو تجاوز صلاحيات في سجل التدقيق الأمني
   */
  async _auditUnauthorizedAccess(user, requiredPermission, targetEntity) {
    try {
      const actorId = user?.id || user?.username || 'ANONYMOUS';
      const details = `⚠️ محاولة وصول غير مصرح بها للمستخدم [${actorId}] بطلب الإذن [${requiredPermission}] على الكيان [${targetEntity || 'GENERAL'}]`;
      
      logWarn('SecurityAudit', details);

      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: actorId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entity: 'SECURITY_AUDIT',
        entityId: String(targetEntity || 'SYSTEM'),
        details,
        ip: '127.0.0.1'
      });
    } catch (e) {
      logError('AuthorizationEngine', `Failed to record security audit: ${e.message}`);
    }
  }

  /**
   * التحقق من القائمة السوداء للتوكنات الملغاة
   */
  async isTokenBlacklisted(jtiOrToken) {
    if (!jtiOrToken) return false;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT 1 FROM public.token_blacklist WHERE token_hash = $1', [jtiOrToken]);
        return Boolean(res);
      } else {
        return (memDb.token_blacklist || []).some(t => t.token_hash === jtiOrToken);
      }
    } catch (e) {
      logWarn('AuthorizationEngine', `Token blacklist query fallback: ${e.message}`);
      return false;
    }
  }

  /**
   * إبطال توكن وإضافته للقائمة السوداء عند تسجيل الخروج أو الفصل
   */
  async revokeToken(jtiOrToken, userId = 'SYSTEM') {
    if (!jtiOrToken) return false;
    const now = new Date().toISOString();

    try {
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO public.token_blacklist (token_hash, revoked_by, revoked_at) VALUES ($1, $2, NOW()) ON CONFLICT (token_hash) DO NOTHING',
          [jtiOrToken, userId]
        );
      } else {
        if (!memDb.token_blacklist) memDb.token_blacklist = [];
        if (!memDb.token_blacklist.some(t => t.token_hash === jtiOrToken)) {
          memDb.token_blacklist.push({ token_hash: jtiOrToken, revoked_by: userId, revoked_at: now });
          saveMemTable('token_blacklist');
        }
      }
      logInfo('AuthorizationEngine', '🔒 Token revoked and blacklisted successfully.');
      return true;
    } catch (e) {
      logError('AuthorizationEngine', `Failed to revoke token: ${e.message}`);
      return false;
    }
  }

  /**
   * توليد توكن مصادقة رقمي آمن
   */
  generateToken(user, expiresIn = '24h') {
    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      role: user.role || 'viewer',
      district: user.district || 'كفرنجة',
      jti: user.jti || `JTI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  /**
   * التحقق من سلامة وصلاحية التوكن الرقمي
   */
  async verifyToken(token) {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.jti && (await this.isTokenBlacklisted(decoded.jti))) {
        return null;
      }
      return decoded;
    } catch (e) {
      return null;
    }
  }

  /**
   * فحص صلاحية مستخدم مع التدقيق الأمني التلقائي عند الرفض
   */
  async hasPermission(userOrRole, requiredPermission, targetEntity = null, targetDistrict = null) {
    if (!userOrRole) {
      await this._auditUnauthorizedAccess({ id: 'GUEST' }, requiredPermission, targetEntity);
      return false;
    }

    const user = typeof userOrRole === 'string' ? { role: userOrRole } : userOrRole;

    if (user.jti && (await this.isTokenBlacklisted(user.jti))) {
      await this._auditUnauthorizedAccess(user, 'REVOKED_TOKEN_ACCESS', targetEntity);
      return false;
    }

    const role = (user.role || 'viewer').toLowerCase().trim();
    if (role === 'admin' || user.id === 'U-001') return true;

    const permissions = this.rolePermissions[role] || this.rolePermissions.viewer || [];
    const normalizedReq = this._normalizePermission(requiredPermission);

    let hasAccess = false;
    for (const p of permissions) {
      if (p === '*') {
        hasAccess = true;
        break;
      }
      if (p === '*.VIEW' && normalizedReq.endsWith('.VIEW')) {
        hasAccess = true;
        break;
      }
      if (p.endsWith('.*')) {
        const prefix = p.split('.')[0];
        const reqPrefix = normalizedReq.split('.')[0];
        if (prefix === reqPrefix) {
          hasAccess = true;
          break;
        }
      }
      if (this._normalizePermission(p) === normalizedReq) {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      await this._auditUnauthorizedAccess(user, requiredPermission, targetEntity);
      return false;
    }

    // التحقق من النطاق الإداري أو الجغرافي إن وُجد
    const districtToCheck = targetDistrict || (targetEntity && typeof targetEntity === 'string' && targetEntity.startsWith('DISTRICT_') ? targetEntity.replace('DISTRICT_', '') : null);
    if (districtToCheck && user.district && role !== 'admin' && role !== 'director_public_works') {
      if (user.district !== districtToCheck) {
        await this._auditUnauthorizedAccess(user, `DISTRICT_BREACH_${districtToCheck}`, targetEntity);
        return false;
      }
    }

    return true;
  }

  /**
   * تطبيق سياسة الحجب على مستوى الحقول (FLAC)
   */
  sanitizeEntityFields(user, entityData) {
    if (!user || !entityData) return entityData;
    const role = (user.role || 'viewer').toLowerCase().trim();
    if (role === 'admin' || user.id === 'U-001' || role === 'director_public_works') return entityData;

    const restricted = this.restrictedFields[role] || [];
    if (restricted.length === 0) return entityData;

    const sanitized = Array.isArray(entityData) 
      ? JSON.parse(JSON.stringify(entityData)) 
      : JSON.parse(JSON.stringify(entityData));

    const cleanObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(key => {
        if (restricted.includes(key)) {
          obj[key] = '*** محجوب لدواعي الصلاحية ***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanObject(obj[key]);
        }
      });
    };

    if (Array.isArray(sanitized)) {
      sanitized.forEach(item => cleanObject(item));
    } else {
      cleanObject(sanitized);
    }

    return sanitized;
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      rolesManaged: Object.keys(this.rolePermissions).length,
      flacRulesActive: Object.keys(this.restrictedFields).length,
      timestamp: new Date().toISOString()
    };
  }
}

const instance = new AuthorizationEngineService();
module.exports = instance;
