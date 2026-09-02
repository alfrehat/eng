// config/notificationChannels.js
// تعريف القنوات المتاحة للإشعارات. يمكن توسيع القائمة حسب الحاجة.
module.exports = {
  channels: [
    "INTERNAL_ALERT", // للتنبيهات الداخلية داخل النظام
    "EMAIL",
    "SMS",
    "WHATSAPP"
  ]
};
