/**
 * services/notificationCenter.js
 * مركز الإشعارات الفوري متعدد القنوات (Event-Driven Notification Center)
 * يضمن تشغيل مهام الإرسال الخارجي والشبكي بشكل غير متزامن تماماً لعزلها عن المسار الرئيسي للاستجابة.
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class NotificationCenter extends EventEmitter {
  constructor() {
    super();
    this.registerDefaultListeners();
    this.registerAdditionalListeners();
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

  // Additional listeners for GIS and field task events
  registerAdditionalListeners() {
    // 5. فشل فحص ميداني (Inspection Failure)
    this.on('INSPECTION_FAILED', (data) =>
      this.dispatchAsync('INSPECTION_FAILED', data, async (payload) => {
        await this.sendInternalAlert(`🚨 فشل فحص ميداني: ${payload.issue} على الطريق ${payload.roadId}`, payload);
        if (payload.engineerPhone) await this.sendSmsSkeleton(payload.engineerPhone, `فشل فحص ميداني: ${payload.issue} على الطريق ${payload.roadId}`);
      })
    );

    // 6. مشكلة جودة الطريق (Road Quality Issue)
    this.on('ROAD_QUALITY_ISSUE', (data) =>
      this.dispatchAsync('ROAD_QUALITY_ISSUE', data, async (payload) => {
        await this.sendInternalAlert(`⚠️ مشكلة جودة طريق: ${payload.description} على الطريق ${payload.roadId}`, payload);
        if (payload.managerEmail) await this.sendEmailSkeleton(payload.managerEmail, 'تحذير جودة الطريق', `الطريق ${payload.roadId} يواجه مشكلة: ${payload.description}`);
      })
    );

    // 7. إنشاء مهمة ميدانية جديدة (Field Task Created)
    this.on('FIELD_TASK_CREATED', (data) =>
      this.dispatchAsync('FIELD_TASK_CREATED', data, async (payload) => {
        await this.sendInternalAlert(`✅ تم إنشاء مهمة ميدانية: ${payload.taskId}`, payload);
        if (payload.assigneeEmail) await this.sendEmailSkeleton(payload.assigneeEmail, 'مهمة ميدانية جديدة', `تم تخصيص مهمة ${payload.taskId} لك.`);
      })
    );
  }

  /**
   * تشغيل مهمة المعالجة غير المتزامنة لعزل قنوات الإرسال الخارجية عن مسار خادم الويب
   */
  dispatchAsync(eventName, payload, actionFn) {
    setImmediate(async () => {
      try {
        console.log(`✉️ [Notification Center] Processing channel dispatch for event: ${eventName}`);
        await actionFn(payload);
      } catch (err) {
        this.logNotificationError(`Error dispatching event ${eventName}`, err);
      }
    });
  }

  // --- قنوات الإرسال المخصصة (Stub Dispatchers) ---

  /**
   * ربط مركز الإشعارات بمحرك البث الحي والإشعارات بالسيرفر
   */
  setSystemNotifier(sendNotificationFn, broadcastEventFn) {
    this._sendNotification = sendNotificationFn;
    this._broadcastEvent = broadcastEventFn;
  }

  async sendInternalAlert(message, payload = {}) {
    console.log(`🔔 [Internal Alert] ${message}`);
    this.appendNotificationLog(`[INTERNAL ALERT] ${message} | Payload: ${JSON.stringify(payload)}`);
    
    if (typeof this._sendNotification === 'function') {
      try {
        this._sendNotification({
          userId: payload.userId || 'all',
          title: payload.title || 'تنبيه نظام هندسي',
          message: message,
          link: payload.link || '',
          type: payload.type || 'warning'
        });
      } catch (e) {}
    }
  }

  async notifyUser(userId, title, message, type = 'info', link = '') {
    return await this.sendInternalAlert(message, { userId, title, type, link });
  }

  async sendEmailSkeleton(to, subject, body) {
    console.log(`📧 [Email Outbox] Sending to: ${to} | Subject: ${subject}`);
    this.appendNotificationLog(`[EMAIL] To: ${to} | Subject: ${subject} | Body: ${body}`);
  }

  async sendSmsSkeleton(phoneNumber, text) {
    console.log(`📱 [SMS/WhatsApp Webhook] Sending to: ${phoneNumber} | Content: ${text}`);
    this.appendNotificationLog(`[SMS] To: ${phoneNumber} | Content: ${text}`);
  }

  // --- دوال المساعدة وحفظ السجلات ---

  appendNotificationLog(logLine) {
    try {
      const logDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, 'notifications.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logPath, `[${timestamp}] ${logLine}\n`);
    } catch (e) {
      console.error('Failed to write notification log:', e.message);
    }
  }

  logNotificationError(message, err) {
    try {
      const logDir = path.join(__dirname, '..', 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, 'migration.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logPath, `[${timestamp}] [NOTIFICATION ERROR] ${message} | Error: ${err.message}\n${err.stack}\n`);
    } catch (e) {
      console.error('Failed to log notification error:', e.message);
    }
  }
}

// تصدير كائن مركز الإشعارات الفردي (Singleton Pattern)
module.exports = new NotificationCenter();

