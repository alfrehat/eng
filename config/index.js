/**
 * config/index.js
 * 🏛️ نقطة الدخول المركزية الموحدة لمنظومة الإعدادات (Canonical Configuration Entry Point)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 */

'use strict';

const productionConfig = require('./productionConfig');
const notificationChannels = require('./notificationChannels');

module.exports = {
  // الكائنات الأصلية المباشرة
  productionConfig,
  notificationChannels,

  // الوصول السريع المباشر للإعدادات والتحقق
  config: productionConfig.config,
  validate: () => productionConfig.validate(),
  getSanitizedConfig: () => productionConfig.getSanitizedConfig(),

  // قنوات الإشعارات والتحقق منها
  channels: notificationChannels.channels,
  isChannelSupported: notificationChannels.isChannelSupported,
  getAvailableChannels: notificationChannels.getAvailableChannels
};
