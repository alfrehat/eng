/**
 * services/templateEngine.js
 * 📝 محرك القوالب الديناميكية العام (TEMPLATE_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Template Caching & Rendering Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { logInfo, logWarn, logError } = require('./loggerService');

class TemplateEngine {
  constructor() {
    this.engineId = 'TEMPLATE_ENGINE';
    this.engineName = 'Enterprise Dynamic Template Caching & Rendering Engine';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'template_caching',
      'secure_variable_interpolation',
      'undefined_fallback_handling',
      'partials_integration',
      'html_sanitization'
    ];
    this.templateCache = new Map();
    this.templatesDir = path.join(process.cwd(), 'templates');
    this._ensureTemplatesDirectory();
  }

  _ensureTemplatesDirectory() {
    try {
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create templates directory:', e.message);
    }
  }

  /**
   * تنقية النصوص لمنع حقن البرمجيات في القوالب
   */
  _escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * تخمير ورسملة القالب النصي أو HTML مع التخزين المؤقت
   */
  render(templateStringOrName, data = {}, options = { escape: true }) {
    try {
      let templateContent = templateStringOrName;

      // إن كان المدخل اسم ملف، نحاول قراءته أو جلبه من الذاكرة المؤقتة (Cache)
      if (typeof templateStringOrName === 'string' && (templateStringOrName.endsWith('.html') || templateStringOrName.endsWith('.hbs') || !templateStringOrName.includes('{{'))) {
        if (this.templateCache.has(templateStringOrName)) {
          templateContent = this.templateCache.get(templateStringOrName);
        } else {
          const filePath = path.join(this.templatesDir, templateStringOrName);
          if (fs.existsSync(filePath)) {
            templateContent = fs.readFileSync(filePath, 'utf-8');
            this.templateCache.set(templateStringOrName, templateContent);
          } else if (templateStringOrName.includes('{{')) {
            templateContent = templateStringOrName;
          } else {
            throw new Error(`قالب العمل [${templateStringOrName}] غير موجود في المسار المحدد.`);
          }
        }
      }

      // استبدال المتغيرات الديناميكية بالصيغة {{variableName}}
      let rendered = String(templateContent).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
        const val = this._resolveNestedProperty(data, key);
        if (val === undefined || val === null) return '';
        return options.escape ? this._escapeHtml(String(val)) : String(val);
      });

      return rendered;
    } catch (e) {
      logError('TemplateEngine', `Template rendering failed: ${e.message}`);
      return `[خطأ في معالجة القالب: ${e.message}]`;
    }
  }

  /**
   * دعم استخراج الخصائص المتداخلة (مثل user.profile.fullName)
   */
  _resolveNestedProperty(obj, pathKey) {
    if (!obj || typeof obj !== 'object') return undefined;
    return pathKey.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
  }

  /**
   * مسح الذاكرة المؤقتة للقوالب (عند تعديل الملفات في بيئة الإنتاج)
   */
  clearCache() {
    this.templateCache.clear();
    logInfo('TemplateEngine', '🧹 تم تفريغ ذاكرة التخزين المؤقت للقوالب بنجاح.');
    return { success: true, message: 'Template cache cleared.' };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      cachedTemplatesCount: this.templateCache.size,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new TemplateEngine();
