/**
 * services/notificationCenter.js
 * مركز الإشعارات الفوري متعدد القنوات (Event-Driven Notification Center)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Notification Patch
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { logInfo, logWarn, logError } = require('./loggerService');
const notificationChannels = require('../config/notificationChannels');

class NotificationCenter extends EventEmitter {
  constructor() {
    super();
    this.engineId = 'NOTIFICATION_ENGINE';
    this.engineName = 'Enterprise Event-Driven Notification Center';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'event_dispatch',
      'user_notifications',
      'role_broadcast',
      'async_channel_dispatch',
      'persistent_audit_logging'
    ];

    this.logDir = path.join(process.cwd(), 'logs');
    this._ensureLogDirectory();
    this.registerDefaultListeners();
    this.registerAdditionalListeners();
  }

  _ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create logs directory:', e.message);
    }
  }

  registerDefaultListeners() {
    // 1. عند إدراج مطالبة جديدة
    this.on('CLAIM_SUBMITTED', (data) =>
      this.dispatchAsync('CLAIM_SUBMITTED', data, async (payload) => {
        await this.sendInternalAlert(`تم تقديم مطالبة جديدة بقيمة ${payload.amount} للعطاء ${payload.tenderId}`, payload);
        if (payload.email) await this.sendEmailSkeleton(payload.email, 'تقديم مطالبة جديدة', `يرجى تدقيق المطالبة للعطاء: ${payload.tenderId}`);
        if (payload.phone) await this.sendSmsSkeleton(payload.phone, `بلدية كفرنجة: تم إدراج مطالبة جديدة للمشروع بقيمة ${payload.amount} د.أ`);
      })
    );

    // 2. عند تأخر الموافقات عن المهلة المحددة
    this.on('APPROVAL_DELAYED', (data) =>
      this.dispatchAsync('APPROVAL_DELAYED', data, async (payload) => {
        await this.sendInternalAlert(`تنبيه: تأخرت الموافقة على العطاء ${payload.tenderId} في مرحلة ${payload.step}`, payload);
        if (payload.managerEmail) await this.sendEmailSkeleton(payload.managerEmail, 'تنبيه تأخر موافقة', `يرجى مراجعة وتمرير الخطوة للعطاء: ${payload.tenderId}`);
      })
    );

    // 3. تحذير الميزانية
    this.on('BUDGET_WARNING', (data) =>
      this.dispatchAsync('BUDGET_WARNING', data, async (payload) => {
        await this.sendInternalAlert(`⚠️ تحذير ميزانية: رصيد البند المالي ${payload.budgetCode} يقترب من النفاد! الرصيد المتبقي: ${payload.available}`, payload);
      })
    );

    // 4. فشل فحوصات جودة الإسفلت أو الخرسانة
    this.on('TEST_FAILED', (data) =>
      this.dispatchAsync('TEST_FAILED', data, async (payload) => {
        await this.sendInternalAlert(`🚨 فشل فحص جودة: الفحص الفني ${payload.testType} للعطاء ${payload.tenderId} رسب بالنتيجة ${payload.resultValue}`, payload);
        if (payload.engineerPhone) await this.sendSmsSkeleton(payload.engineerPhone, `بلدية كفرنجة: فشل فحص الجودة الفني ${payload.testType} للعطاء ${payload.tenderId}. يرجى التدقيق الميداني فوراً.`);
      })
    );
  }

  registerAdditionalListeners() {
    // 5. فشل فحص ميداني
    this.on('INSPECTION_FAILED', (data) =>
      this.dispatchAsync('INSPECTION_FAILED', data, async (payload) => {
        await this.sendInternalAlert(`🚨 فشل فحص ميداني: ${payload.issue} على الطريق ${payload.roadId}`, payload);
        if (payload.engineerPhone) await this.sendSmsSkeleton(payload.engineerPhone, `فشل فحص ميداني: ${payload.issue} على الطريق ${payload.roadId}`);
      })
    );

    // 6. مشكلة جودة الطريق
    this.on('ROAD_QUALITY_ISSUE', (data) =>
      this.dispatchAsync('ROAD_QUALITY_ISSUE', data, async (payload) => {
        await this.sendInternalAlert(`⚠️ مشكلة جودة طريق: ${payload.description} على الطريق ${payload.roadId}`, payload);
        if (payload.managerEmail) await this.sendEmailSkeleton(payload.managerEmail, 'تحذير جودة الطريق', `الطريق ${payload.roadId} يواجه مشكلة: ${payload.description}`);
      })
    );

    // 7. إنشاء مهمة ميدانية جديدة
    this.on('FIELD_TASK_CREATED', (data) =>
      this.dispatchAsync('FIELD_TASK_CREATED', data, async (payload) => {
        await this.sendInternalAlert(`✅ تم إنشاء مهمة ميدانية: ${payload.taskId}`, payload);
        if (payload.assigneeEmail) await this.sendEmailSkeleton(payload.assigneeEmail, 'مهمة ميدانية جديدة', `تم تخصيص مهمة ${payload.taskId} لك.`);
      })
    );
  }

  /**
   * تشغيل مهمة المعالجة غير المتزامنة لعزل قنوات الإرسال الخارجية عن مسار الخادم
   */
  dispatchAsync(eventName, payload, actionFn) {
    setImmediate(async () => {
      try {
        logInfo('NotificationCenter', `Processing channel dispatch for event: ${eventName}`);
        await actionFn(payload);
      } catch (err) {
        await this.logNotificationError(`Error dispatching event ${eventName}`, err);
      }
    });
  }

  setSystemNotifier(sendNotificationFn, broadcastEventFn) {
    this._sendNotification = sendNotificationFn;
    this._broadcastEvent = broadcastEventFn;
  }

  async sendInternalAlert(message, payload = {}) {
    logInfo('NotificationCenter', `[Internal Alert] ${message}`);
    await this.appendNotificationLog(`[INTERNAL ALERT] ${message} | Payload: ${JSON.stringify(payload)}`);
    
    if (typeof this._sendNotification === 'function') {
      try {
        await this._sendNotification({
          userId: payload.userId || 'all',
          title: payload.title || 'تنبيه نظام هندسي',
          message: message,
          link: payload.link || '',
          type: payload.type || 'warning'
        });
      } catch (e) {
        logError('NotificationCenter', `Failed in _sendNotification callback: ${e.message}`);
      }
    }
  }

  async notifyUser(userId, title, message, type = 'info', link = '') {
    return await this.sendInternalAlert(message, { userId, title, type, link });
  }

  async sendEmailSkeleton(to, subject, body) {
    logInfo('NotificationCenter', `[Email Outbox] Sending to: ${to} | Subject: ${subject}`);
    await this.appendNotificationLog(`[EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
  }

  async sendSmsSkeleton(phoneNumber, text) {
    logInfo('NotificationCenter', `[SMS/WhatsApp] Sending to: ${phoneNumber} | Content: ${text}`);
    await this.appendNotificationLog(`[SMS] To: ${phoneNumber} | Content: ${text}`);
  }

  async appendNotificationLog(logLine) {
    try {
      const logPath = path.join(this.logDir, 'notifications.log');
      const timestamp = new Date().toISOString();
      await fs.promises.appendFile(logPath, `[${timestamp}] ${logLine}\n`, 'utf-8');
    } catch (e) {
      console.error('Failed to write notification log:', e.message);
    }
  }

  async logNotificationError(message, err) {
    try {
      const logPath = path.join(this.logDir, 'migration.log');
      const timestamp = new Date().toISOString();
      const errorDump = `[${timestamp}] [NOTIFICATION ERROR] ${message} | Error: ${err.message}\n${err.stack}\n`;
      await fs.promises.appendFile(logPath, errorDump, 'utf-8');
      logError('NotificationCenter', message);
    } catch (e) {
      console.error('Failed to log notification error:', e.message);
    }
  }

  getSupportedChannels() {
    return notificationChannels.getAvailableChannels();
  }

  isChannelSupported(channel) {
    return notificationChannels.isChannelSupported(channel);
  }

  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new NotificationCenter();
