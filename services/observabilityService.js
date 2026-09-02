/**
 * services/observabilityService.js
 * 📊 خدمة الرصد الموحد وتتبع مقاييس الأداء والأحداث الأمنية (Observability Service)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

const { logInfo, logError, logWarn } = require('./loggerService');

class ObservabilityService {
  constructor() {
    this._metrics = {
      apiRequestsTotal: 0,
      apiErrorsTotal: 0,
      engineExecutionsTotal: 0,
      engineFailuresTotal: 0,
      latencies: []
    };
  }

  /**
   * تسجيل حدث أمني مع تنقية الأسرار
   */
  recordSecurityEvent(eventType, details = {}, req = null) {
    const sanitizedDetails = this._sanitize(details);
    const correlationId = req?.headers?.['x-correlation-id'] || `SEC-${Date.now()}`;
    
    logWarn('SECURITY_EVENT', `[${eventType}] CorrelationID: ${correlationId}`, sanitizedDetails);
    return { eventType, correlationId, timestamp: new Date().toISOString() };
  }

  /**
   * رصد وتسجيل توقيت تنفيذ محرك أو عملية API
   */
  recordTiming(metricName, durationMs, metadata = {}) {
    this._metrics.latencies.push({
      metricName,
      durationMs,
      timestamp: Date.now()
    });
    if (this._metrics.latencies.length > 500) {
      this._metrics.latencies.shift();
    }
  }

  /**
   * استخراج ملخص فوري للمقاييس التشغيلية
   */
  getMetricsSummary() {
    const latencies = this._metrics.latencies;
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((acc, l) => acc + l.durationMs, 0) / latencies.length)
      : 0;

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      metricsCount: latencies.length,
      averageLatencyMs: avgLatency,
      systemUptimeSeconds: Math.floor(process.uptime())
    };
  }

  /**
   * تنقية الكائنات من الأسرار والبيانات الحساسة
   */
  _sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = Array.isArray(obj) ? [...obj] : { ...obj };
    const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization'];
    
    Object.keys(clean).forEach(k => {
      if (sensitiveKeys.includes(k.toLowerCase())) {
        clean[k] = '***REDACTED***';
      } else if (typeof clean[k] === 'object') {
        clean[k] = this._sanitize(clean[k]);
      }
    });
    return clean;
  }
}

const instance = new ObservabilityService();
module.exports = instance;
