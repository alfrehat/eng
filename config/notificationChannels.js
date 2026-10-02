// config/notificationChannels.js
// تعريف القنوات المتاحة للإشعارات. يمكن توسيع القائمة حسب الحاجة.
'use strict';

const CHANNELS = Object.freeze([
  "INTERNAL_ALERT", // للتنبيهات الداخلية داخل النظام
  "EMAIL",
  "SMS",
  "WHATSAPP"
]);

module.exports = {
  channels: [...CHANNELS],
  CHANNELS,
  isChannelSupported(channel) {
    if (!channel || typeof channel !== 'string') return false;
    return CHANNELS.includes(channel.trim().toUpperCase());
  },
  getAvailableChannels() {
    return [...CHANNELS];
  }
};

