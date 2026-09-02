/**
 * middlewares/globalErrorHandler.js
 * موجه إدارة الاستثناءات والأخطاء الموحد (Global Express Exception Handler Middleware)
 * 
 * الميزات المعمارية والبرمجية:
 * 1. حجب تسريب أخطاء تتبع المكدس (Stack Traces) للواجهة الأمامية لمنع كشف بنية الخادم.
 * 2. توحيد صيغ استجابات الأخطاء بنسق JSON آمن ومعتمد.
 * 3. التوثيق الموحد في مركز مراقبة التشغيل (loggerService).
 */

const { logError } = require('../services/loggerService');

/**
 * Middleware معالجة الأخطاء العام لـ Express
 */
function globalErrorHandler(err, req, res, next) {
  const correlationId = 'ERR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const statusCode = err.statusCode || err.status || 500;

  // توثيق الخطأ كاملاً في سجلات النظام الداخلية مع تتبع المكدس
  logError('EXPRESS_EXCEPTION', err.message || 'Internal Server Error', {
    correlationId,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || 'ANONYMOUS',
    stack: err.stack
  });

  // في حالة خطأ العميل (4xx) نُظهر الرسالة، وفي أخطاء السيرفر (5xx) نُظهر رسالة آمنة موحدة
  const isClientError = statusCode >= 400 && statusCode < 500;
  const clientMessage = isClientError ? err.message : 'عذراً، حدث خطأ داخلي في الخادم. تم تسجيل المشكلة للمتابعة.';

  res.status(statusCode).json({
    error: clientMessage,
    correlationId,
    timestamp: new Date().toISOString()
  });
}

module.exports = globalErrorHandler;
