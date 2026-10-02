/**
 * services/observabilityService.js
 * 📊 خدمة الرصد الموحد وتتبع مقاييس الأداء والأحداث الأمنية (Observability Service)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Observability Patch
 */

const { logInfo, logError, logWarn } = require('./loggerService');

class ObservabilityService {
  constructor() {
    this.engineId = 'OBSERVABILITY_SERVICE';
    this.engineName = 'Enterprise Observability & Security Monitoring Service';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'latency_tracking',
      'security_sanitization',
      'metrics_export',
      'deep_payload_redaction',
      'uptime_monitoring'
    ];

    this._metrics = {
      apiRequestsTotal: 0,
      apiErrorsTotal: 0,
      engineExecutionsTotal: 0,
      engineFailuresTotal: 0,
      latencies: []
    };
    this.startTime = Date.now();
  }

  /**
   * تسجيل وزيادة العدادات التشغيلية آلياً
   */
  incrementMetric(metricName, amount = 1) {
    if (this._metrics[metricName] !== undefined) {
      this._metrics[metricName] += amount;
    }
  }

  /**
   * تسجيل حدث أمني مع تنقية عميقة ومتطورة للأسرار والبيانات الحساسة
   */
  recordSecurityEvent(eventType, details = {}, req = null) {
    const sanitizedDetails = this._deepSanitize(details);
    const correlationId = req?.headers?.['x-correlation-id'] || `SEC-${Date.now()}`;
    
    logWarn('SECURITY_EVENT', `[${eventType}] CorrelationID: ${correlationId}`, sanitizedDetails);
    return { eventType, correlationId, timestamp: new Date().toISOString() };
  }

  /**
   * رصد وتسجيل توقيت تنفيذ محرك أو عملية API بشكل آمن ومحمي
   */
  recordTiming(metricName, durationMs, metadata = {}) {
    const safeDuration = (typeof durationMs === 'number' && !isNaN(durationMs) && durationMs >= 0) ? durationMs : 0;
    
    this._metrics.latencies.push({
      metricName,
      durationMs: safeDuration,
      metadata: this._deepSanitize(metadata),
      timestamp: Date.now()
    });

    // الحفاظ على نافذة منزلقة لا تتجاوز 500 عنصر بأمان
    if (this._metrics.latencies.length > 500) {
      this._metrics.latencies.shift();
    }
  }

  /**
   * استخراج ملخص فوري للمقاييس والجاهزية التشغيلية
   */
  getMetricsSummary() {
    const latencies = this._metrics.latencies;
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((acc, l) => acc + l.durationMs, 0) / latencies.length)
      : 0;

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      counters: {
        apiRequestsTotal: this._metrics.apiRequestsTotal,
        apiErrorsTotal: this._metrics.apiErrorsTotal,
        engineExecutionsTotal: this._metrics.engineExecutionsTotal,
        engineFailuresTotal: this._metrics.engineFailuresTotal
      },
      metricsCount: latencies.length,
      averageLatencyMs: avgLatency,
      systemUptimeSeconds: Math.floor(process.uptime())
    };
  }

  /**
   * خوارزمية تنقية عميقة ومتطورة تحجب الأسرار وكلمات المرور والتوكنات
   */
  _deepSanitize(obj, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object') {
      if (typeof obj === 'string') {
        // تنقية الأنماط النصية الحساسة مثل التوكنات أو كلمات المرور المضمنة
        return obj.replace(/(Bearer\s+[a-zA-Z0-9._-]+|password=[\w@#$%^&*]+)/gi, '***REDACTED***');
      }
      return obj;
    }

    if (seen.has(obj)) return '[Circular Reference]';
    seen.add(obj);

    const clean = Array.isArray(obj) ? [] : {};
    const sensitiveKeys = [
      'password', 'password_hash', 'token', 'jwt', 'secret', 
      'authorization', 'auth', 'api_key', 'apikey', 'credit_card', 'card_number'
    ];
    
    Object.keys(obj).forEach(k => {
      const lowerKey = k.toLowerCase();
      const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

      if (isSensitive) {
        clean[k] = '***REDACTED***';
      } else {
        clean[k] = this._deepSanitize(obj[k], seen);
      }
    });

    return clean;
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      metricsSummary: this.getMetricsSummary(),
      timestamp: new Date().toISOString()
    };
  }
}

const instance = new ObservabilityService();
module.exports = instance;
