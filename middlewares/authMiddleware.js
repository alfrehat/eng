// authMiddleware.js
// JWT based authentication middleware for the ERP system
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

/**
 * Authenticate request using JWT.
 * Expects token in Authorization header as: Bearer <token>
 * On success, attaches decoded payload to req.user.
 */
async function authenticate(req, res, next) {
  // Allow public static files and public login endpoints
  if (
    req.path === '/api/login' ||
    req.path === '/login' ||
    req.path === '/api/health' ||
    req.path === '/api/db-status' ||
    !req.path.startsWith('/api/')
  ) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.jti) {
        try {
          const authService = require('../services/authorizationEngineService');
          if (authService && typeof authService.isTokenBlacklisted === 'function') {
            const blacklisted = await authService.isTokenBlacklisted(payload.jti);
            if (blacklisted) {
              req.user = null;
              return res.status(401).json({ error: 'جلسة العمل ملغاة أو منتهية، يرجى إعادة تسجيل الدخول' });
            }
          }
        } catch (blErr) {
          // fallback if authService is unavailable
        }
      }
      req.user = payload;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'جلسة العمل غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول' });
    }
  }

  // If no bearer token is present, req.user remains null
  req.user = null;
  next();
}

/**
 * Authorize admin users.
 * Checks that req.user is valid and role is 'admin' or 'super_admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول بحساب مدير النظام' });
  }
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') {
    return next();
  }
  return res.status(403).json({ error: 'صلاحيات غير كافية: هذا الإجراء مخصص لمدير النظام فقط' });
}

/**
 * Require any authenticated user (used for protected routes).
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireAuth };

