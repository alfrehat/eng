/**
 * security-bridge.js
 * 🛡️ الجسر الأمني لإدارة تشفير كلمات المرور والترقية التلقائية غير التزامنية
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Async Cryptographic Bridge
 */

'use strict';

const bcrypt = require('bcryptjs');

/**
 * تشفير كلمة المرور النصية بشكل لا تزامني لحماية الـ Event Loop
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * مقارنة كلمة مرور نصية مع الهاش المشفر لا تزامناً
 */
async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

/**
 * التحقق من كلمة المرور وترقيتها تلقائياً عند الدخول
 */
async function verifyAndUpgradeOnTheFly(username, password, pgClient) {
  if (!pgClient || !username || !password) return false;

  try {
    const res = await pgClient.query('SELECT * FROM public.users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const user = res.rows && res.rows.length ? res.rows[0] : null;

    if (!user) return false;

    // فحص ما إذا كانت كلمة المرور مشفرة مسبقاً بـ BCrypt
    const isEncrypted = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'));

    if (isEncrypted) {
      return await comparePassword(password.trim(), user.password);
    } else {
      // تطابق نصي قديم -> ترقية فورية وتخزين الهاش
      if (user.password === password.trim()) {
        const newHash = await hashPassword(password.trim());
        await pgClient.query('UPDATE public.users SET password = $1, "updatedAt" = NOW() WHERE id = $2', [newHash, user.id]);
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('⚠️ [Security Bridge] Password check error:', err.message);
    return false;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  verifyAndUpgradeOnTheFly
};
