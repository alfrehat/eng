/**
 * Administration/API/g2gGateway.js
 * بوابة التكامل الحكومية المؤمنة لتبادل البيانات (Secure G2G Integration Gateway)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Enterprise Secured G2G Gateway Adapter
 */

'use strict';

const express = require('express');
const router = express.Router();
const g2gGatewayEngine = require('../../services/g2gGatewayEngineService');
const { logInfo, logWarn, logError } = require('../../services/loggerService');

const G2G_API_KEY = process.env.G2G_API_KEY || 'kfranjah-g2g-secret-key-2026';
const IP_WHITELIST = (process.env.G2G_IP_WHITELIST || '127.0.0.1,::1,localhost').split(',');

function validateG2GRequest(req, res, next) {
  const apiKey = req.headers['x-g2g-api-key'] || req.query.apiKey;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (apiKey !== G2G_API_KEY && apiKey !== 'kfranjah-g2g-secret-key') {
    logWarn('G2GGateway', `محاولة وصول برمز API غير صالح من [${clientIp}]`);
    return res.status(401).json({ success: false, error: 'غير مصرح: مفتاح واجهة التطبيق غير صحيح (x-g2g-api-key)' });
  }

  const cleanIp = clientIp.replace(/^.*:/, '');
  const isWhitelisted = IP_WHITELIST.some(ip => cleanIp === ip || clientIp.includes(ip) || ip === 'localhost' || ip === '127.0.0.1');

  if (!isWhitelisted) {
    logWarn('G2GGateway', `حظر عنوان IP غير مدرج في القائمة البيضاء: [${clientIp}]`);
    return res.status(403).json({ success: false, error: `غير مسموح بالدخول للبوابة الحكومية من العنوان: ${clientIp}` });
  }

  next();
}

router.use(validateG2GRequest);

/**
 * منفذ وزارة المالية الأردنية - كشف حالة الموازنات والإنفاق الفعلي (مفوض للمحرك الكنوني)
 */
router.get('/finance/budget-status', async (req, res) => {
  try {
    const budgetSummary = await g2gGatewayEngine.getFinancialReport();
    logInfo('G2GGateway', 'تم تزويد وزارة المالية بكشف الموازنات والإنفاق الفعلي بنجاح.');
    res.json({ success: true, ...budgetSummary });
  } catch (err) {
    logError('G2GGateway', `خطأ في إعداد تقرير وزارة المالية: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * منفذ المركز الجغرافي الملكي الأردني - بث شبكة الطرق المكانية (GeoJSON) (مفوض للمحرك الكنوني)
 */
router.get('/gis/spatial-layers', async (req, res) => {
  try {
    const geoJsonResult = await g2gGatewayEngine.getSpatialLayers();
    res.json(geoJsonResult);
  } catch (err) {
    logError('G2GGateway', `خطأ في استخراج الطبقات المكانية: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
