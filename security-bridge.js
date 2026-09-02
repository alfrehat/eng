/**
 * security-bridge.js
 * الجسر الأمني لإدارة تشفير كلمات المرور والترقية التلقائية (On-the-fly BCrypt Hashing)
 */

const bcrypt = require('bcryptjs');

/**
 * تشفير كلمة المرور النصية باستخدام BCrypt بـ 12 جولة
 * @param {string} password كلمة المرور النصية
 * @returns {string} الهاش المولد
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

/**
 * مقارنة كلمة مرور نصية مع الهاش المشفر
 * @param {string} password كلمة المرور النصية
 * @param {string} hash الهاش المخزن
 * @returns {boolean} النتيجة
 */
function comparePassword(password, hash) {
  try {
    return bcrypt.compareSync(password, hash);
  } catch (e) {
    return false;
  }
}

/**
 * التحقق من كلمة المرور وترقيتها تلقائياً للظل الأمني عند الدخول الناجح
 * @param {string} username اسم المستخدم
 * @param {string} password كلمة المرور النصية
 * @param {object} legacyUser بيانات المستخدم من الطبقة القديمة
 * @param {object} pgClient عميل اتصال PostgreSQL (إن وجد)
 */
async function verifyAndUpgradeOnTheFly(username, password, legacyUser, pgClient) {
  if (!pgClient) {
    return false;
  }

  try {
    // 1. استعلام عن المستخدم من جدول users العام
    const res = await pgClient.query('SELECT * FROM public.users WHERE username = $1', [username]);
    const user = res.rows && res.rows.length ? res.rows[0] : null;

    if (user) {
      if (user.password_hash) {
        // التحقق من صحة كلمة المرور المشفّرة
        return comparePassword(password, user.password_hash);
      } else if (user.password) {
        // التحقق أولاً من المطابقة مع كلمة المرور النصية
        const isMatch = (user.password === password);
        if (isMatch) {
          // ترقية وتشفير كلمة المرور على الطاير (On-the-fly) وحفظ الهاش
          const hash = hashPassword(password);
          await pgClient.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
          return true;
        }
        return false;
      }
    }
    return false;
  } catch (err) {
    console.warn('⚠️ [Security Bridge] Shadow sync notice:', err.message);
    return false;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  verifyAndUpgradeOnTheFly
};
