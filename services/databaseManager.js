/**
 * services/databaseManager.js
 * 🗄️ وكيل الوصول لمدير قاعدة البيانات والطبقة الهجينة للبيانات (DATABASE_MANAGER)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const dbUtils = require('../utils/database');

module.exports = {
  ...dbUtils,
  engineId: 'DATABASE_MANAGER',
  version: '2.0.0'
};
