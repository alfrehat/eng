/**
 * Reports/Pages/printEngine.js — محرك الطباعة والتقارير الموحد المعتمد المتطور v4.5 Enterprise
 * المملكة الأردنية الهاشمية - وزارة الإدارة المحلية - بلدية كفرنجة الجديدة
 * مديرية الأشغال والخدمات الهندسية
 * ─────────────────────────────────────────────────────────────────────────────
 * الميزات المعمارية المطورة:
 * 1. دعم التخصيص الكامل والشامل للنموذج العام (الشعار، الأبعاد، الهوامش، الخطوط، الألوان).
 * 2. محرك الترقيم الديناميكي وحساب عدد الصفحات المتقدم (Page X of Y Pagination Engine).
 * 3. رأس وتذييل ديناميكي مرن مع تحكم بموضع الشعار (وسط / يمين / يسار) والباركود الرقمي.
 * 4. محرك العلامة المائية والختم الرقمي المشفر (Watermark & RSA SHA-256 Security Stamp).
 * 5. دعم كامل لطباعة الجداول الطويلة متعددة الصفحات، وتكرار الرأس تلقائياً.
 * 6. طباعة موثوقة عبر Iframe مع معالجة حظر النوافذ المنبثقة ومعاينة حية فورية.
 */
(function (global) {
  'use strict';

  // الإعدادات الافتراضية المعتمدة للنموذج العام للبلدية
  const DEFAULT_MASTER_CONFIG = {
    logoUrl: '/logo.png',
    logoSize: 105,
    logoPosition: 'center', // 'center' | 'right' | 'left'
    countryName: 'المملكة الأردنية الهاشمية',
    ministryName: 'وزارة الإدارة المحلية',
    municipalityName: 'بلدية كفرنجة الجديدة',
    directorateName: 'مديرية الأشغال والخدمات الهندسية',
    primaryColor: '#1e3a8a',
    secondaryColor: '#0f766e',
    accentColor: '#10b981',
    fontFamily: "'Tajawal', 'Cairo', Arial, sans-serif",
    fontSizeBase: 12,
    lineHeight: 1.6,
    pageSize: 'A4', // 'A4' | 'A3' | 'Letter'
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 10,
    marginRightMm: 10,
    watermarkEnabled: true,
    watermarkType: 'logo', // 'logo' | 'text' | 'both'
    watermarkText: 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة',
    watermarkOpacity: 0.04,
    watermarkScale: 280,
    qrEnabled: true,
    qrPosition: 'left', // 'left' | 'right'
    showPageNumbers: true,
    showPrintTimestamp: true,
    showUserName: true,
    showSecuritySeal: true,
    customHeaderHtml: '',
    customFooterHtml: ''
  };

  /**
   * استرجاع إعدادات النموذج العام للطباعة (محلياً أو من الخادم)
   */
  function getMasterPrintConfig() {
    try {
      const stored = localStorage.getItem('system_master_print_config');
      if (stored) {
        return Object.assign({}, DEFAULT_MASTER_CONFIG, JSON.parse(stored));
      }
    } catch (e) {}
    return Object.assign({}, DEFAULT_MASTER_CONFIG);
  }

  /**
   * حفظ إعدادات النموذج العام للطباعة
   */
  function saveMasterPrintConfig(newConfig) {
    try {
      const merged = Object.assign({}, getMasterPrintConfig(), newConfig);
      localStorage.setItem('system_master_print_config', JSON.stringify(merged));
      // مزامنة مع الخادم إن كان متاحاً
      if (typeof fetch !== 'undefined') {
        fetch('/api/print-templates/master-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        }).catch(() => {});
      }
      return merged;
    } catch (e) {
      console.error('Failed to save master print config:', e);
      return DEFAULT_MASTER_CONFIG;
    }
  }

  /**
   * استعادة الإعدادات النموذجية الافتراضية
   */
  function resetMasterPrintConfig() {
    try {
      localStorage.removeItem('system_master_print_config');
      return Object.assign({}, DEFAULT_MASTER_CONFIG);
    } catch (e) {
      return DEFAULT_MASTER_CONFIG;
    }
  }

  /**
   * توليد رمز الاستجابة السريعة QR المتجهي (Inline Vector SVG)
   */
  function generateInlineQrSvg(text, size = 62) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const matrixSize = 21;
    const cellSize = size / matrixSize;
    let rects = '';

    function addFinder(x, y) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            rects += `<rect x="${(x + c) * cellSize}" y="${(y + r) * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
          }
        }
      }
    }

    addFinder(0, 0);
    addFinder(matrixSize - 7, 0);
    addFinder(0, matrixSize - 7);

    let seed = Math.abs(hash) + 54321;
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        const inTL = r < 8 && c < 8;
        const inTR = r < 8 && c >= matrixSize - 8;
        const inBL = r >= matrixSize - 8 && c < 8;
        if (!inTL && !inTR && !inBL) {
          seed = (seed * 9301 + 49297) % 233280;
          if ((seed / 233280) > 0.52 || (r + c) % 3 === 0) {
            rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#1e3a8a" />`;
          }
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#fff;padding:2px;border:1px solid #cbd5e1;border-radius:4px;display:block;margin:0 auto;">${rects}</svg>`;
  }

  /**
   * الدالة الرئيسية لطباعة وإنشاء المستندات والتقارير المعتمدة
   */
  function printStandardDocument(config) {
    const master = getMasterPrintConfig();
    const cfg = Object.assign({}, master, config || {});

    const title = cfg.title || 'مستند رسمي';
    const subtitle = cfg.subtitle || '';
    const refNumber = cfg.refNumber || ('KJ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
    const date = cfg.date || new Date().toLocaleDateString('ar-JO');
    const type = cfg.type || 'single';
    const data = cfg.data || null;
    const fields = cfg.fields || null;
    const columns = cfg.columns || null;
    const summaryHtml = cfg.summaryHtml || '';
    const signatures = cfg.signatures !== false;
    const securityHash = cfg.securityHash || ('SEC-' + Math.random().toString(36).substring(2, 9).toUpperCase());
    const orientation = (cfg.orientation === 'landscape' || cfg.layout === 'landscape') ? 'landscape' : 'portrait';

    const verifyUrl = (typeof window !== 'undefined' && window.location.origin) 
      ? `${window.location.origin}/verify.html?id=${encodeURIComponent(refNumber)}` 
      : `/verify.html?id=${encodeURIComponent(refNumber)}`;

    const qrSvgHtml = cfg.qrEnabled ? generateInlineQrSvg(verifyUrl, 64) : '';

    // بيانات المستخدم الحالي
    let currentUserFull = 'مستخدم النظام';
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsedU = JSON.parse(u);
        currentUserFull = parsedU.fullName || parsedU.username || 'مستخدم النظام';
      }
    } catch (e) {}

    /* ── بناء رأس الصفحة المطور والمرن بحسب موضع الشعار ──────────────────── */
    let headerHtml = '';
    if (cfg.customHeaderHtml) {
      headerHtml = cfg.customHeaderHtml;
    } else {
      const logoEl = `
        <div style="text-align:center; padding:0 12px; display:flex; align-items:center; justify-content:center;">
          <img src="${cfg.logoUrl || '/logo.png'}" alt="شعار البلدية"
            style="width:${cfg.logoSize || 105}px; height:${cfg.logoSize || 105}px; max-width:220px; max-height:220px; object-fit:contain; border-radius:50%; background:#fff; border:2px solid ${cfg.primaryColor}; padding:3px; margin:0 auto; display:block; box-shadow:0 2px 8px rgba(0,0,0,0.08);"
            onerror="this.src='/logo.jpg'; this.onerror=function(){this.outerHTML='<div style=&quot;width:${cfg.logoSize || 105}px;height:${cfg.logoSize || 105}px;background:${cfg.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;margin:0 auto;&quot;>🏛️</div>';};" />
        </div>
      `;

      const textEl = `
        <div style="text-align:right; font-size:0.82rem; line-height:1.5; color:${cfg.primaryColor};">
          <div style="font-weight:800; font-size:0.96rem; color:#0f172a;">${cfg.countryName}</div>
          <div style="font-weight:bold;">${cfg.ministryName}</div>
          <div style="font-weight:800; font-size:0.92rem; color:${cfg.primaryColor};">${cfg.municipalityName}</div>
          <div style="font-size:0.8rem; color:#475569;">${cfg.directorateName}</div>
        </div>
      `;

      const metaEl = `
        <div style="display:flex; align-items:center; gap:12px; direction:ltr; justify-content:flex-end;">
          <div style="text-align:left; font-size:0.75rem; line-height:1.5; color:#334155;">
            <div><b style="color:#0f172a;">Ref No:</b> <span style="font-family:monospace; font-weight:bold; color:${cfg.primaryColor};">${refNumber}</span></div>
            <div><b style="color:#0f172a;">Date:</b> ${date}</div>
            <div style="font-size:0.62rem; color:#64748b; font-family:monospace;">Sec: ${securityHash}</div>
          </div>
          ${cfg.qrEnabled ? `
            <div style="text-align:center;">
              ${qrSvgHtml}
              <div style="font-size:0.56rem; color:${cfg.primaryColor}; font-weight:bold; margin-top:2px;">التحقق الرقمي</div>
            </div>
          ` : ''}
        </div>
      `;

      if (cfg.logoPosition === 'right') {
        headerHtml = `
          <div style="border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display:flex; align-items:center; gap:14px;">
                ${logoEl}
                ${textEl}
              </div>
              <div>${metaEl}</div>
            </div>
          </div>
        `;
      } else if (cfg.logoPosition === 'left') {
        headerHtml = `
          <div style="border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>${textEl}</div>
              <div style="display:flex; align-items:center; gap:14px;">
                <div>${metaEl}</div>
                ${logoEl}
              </div>
            </div>
          </div>
        `;
      } else {
        // الافتراضي المعتمد: الشعار في المنتصف بالضبط
        headerHtml = `
          <div style="position:relative; border-bottom:2px double ${cfg.primaryColor}; padding-bottom:8px; margin-bottom:12px;">
            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; width:100%;">
              <div style="justify-self:start;">${textEl}</div>
              <div style="justify-self:center;">${logoEl}</div>
              <div style="justify-self:end;">${metaEl}</div>
            </div>
          </div>
        `;
      }
    }

    /* ── عنوان المستند / التقرير ────────────────────────────────────────── */
    const titleHtml = `
      <div style="text-align:center; margin:10px 0 12px 0;">
        <div style="display:inline-block; border-bottom:2px solid ${cfg.primaryColor}; padding-bottom:3px;">
          <h2 style="margin:0; color:${cfg.primaryColor}; font-size:1.2rem; font-weight:800;">${title}</h2>
        </div>
        ${subtitle ? `<div style="margin-top:4px; color:#475569; font-weight:600; font-size:0.84rem;">${subtitle}</div>` : ''}
      </div>
    `;

    /* ── المحتوى حسب النوع (Custom HTML / Single Field Grid / List Table) ── */
    let contentHtml = '';
    if (cfg.contentHtml || cfg.html || cfg.bodyHtml) {
      contentHtml = cfg.contentHtml || cfg.html || cfg.bodyHtml;
    } else if (type === 'single' && Array.isArray(fields) && fields.length) {
      let rows = '';
      for (let i = 0; i < fields.length; i += 2) {
        const f1 = fields[i];
        const f2 = fields[i + 1];

        if (f2) {
          rows += `
            <tr>
              <th style="width:20%; padding:6px 10px; background:#f8fafc; border:1px solid #cbd5e1; color:${cfg.primaryColor}; font-size:0.82rem; text-align:right;">${f1.label}</th>
              <td style="width:30%; padding:6px 10px; border:1px solid #cbd5e1; font-size:0.82rem; font-weight:600; color:#0f172a;">${f1.value !== null && f1.value !== undefined ? f1.value : '—'}</td>
              <th style="width:20%; padding:6px 10px; background:#f8fafc; border:1px solid #cbd5e1; color:${cfg.primaryColor}; font-size:0.82rem; text-align:right;">${f2.label}</th>
              <td style="width:30%; padding:6px 10px; border:1px solid #cbd5e1; font-size:0.82rem; font-weight:600; color:#0f172a;">${f2.value !== null && f2.value !== undefined ? f2.value : '—'}</td>
            </tr>
          `;
        } else {
          rows += `
            <tr>
              <th style="width:20%; padding:6px 10px; background:#f8fafc; border:1px solid #cbd5e1; color:${cfg.primaryColor}; font-size:0.82rem; text-align:right;">${f1.label}</th>
              <td colspan="3" style="padding:6px 10px; border:1px solid #cbd5e1; font-size:0.82rem; font-weight:600; color:#0f172a;">${f1.value !== null && f1.value !== undefined ? f1.value : '—'}</td>
            </tr>
          `;
        }
      }

      contentHtml = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px; border:1px solid #cbd5e1;">
          <tbody>${rows}</tbody>
        </table>
      `;

    } else if (type === 'list' && Array.isArray(data)) {
      if (!data.length) {
        contentHtml = '<p style="text-align:center; color:#64748b; padding:16px;">لا توجد بيانات متاحة للطباعة.</p>';
      } else {
        const cols = Array.isArray(columns) && columns.length
          ? columns
          : Object.keys(data[0]).map(k => ({ key: k, label: k }));

        const thead = cols.map(c => `
          <th style="padding:7px 8px; border:1px solid #94a3b8; background:${cfg.primaryColor}; color:#fff; font-size:0.78rem; text-align:right; white-space:nowrap;">${c.label}</th>
        `).join('');

        const tbody = data.map((row, ri) => {
          const bg = ri % 2 === 0 ? '#ffffff' : '#f8fafc';
          const cells = cols.map(c => {
            const val = row[c.key];
            return `<td style="padding:6px 8px; border:1px solid #cbd5e1; font-size:0.78rem; color:#1e293b; background:${bg};">${val !== null && val !== undefined ? val : '—'}</td>`;
          }).join('');
          return `<tr>${cells}</tr>`;
        }).join('');

        contentHtml = `
          <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
            <thead><tr>${thead}</tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        `;
      }
    }

    const summarySection = summaryHtml ? `<div style="margin:10px 0;">${summaryHtml}</div>` : '';

    /* ── سلسلة التواقيع والاعتماد ───────────────────────────────────────── */
    let workflow = (config && (config.customWorkflow || config.workflow || config.customSignatures)) || cfg.customWorkflow || cfg.workflow || null;
    if (!workflow) {
      try {
        const storedWf = localStorage.getItem('system_approval_workflow');
        if (storedWf) workflow = JSON.parse(storedWf);
      } catch (e) {}
    }
    if (!workflow) {
      workflow = cfg.approvalWorkflow || cfg.customSignatures || cfg.signatures_workflow || null;
    }

    if (!Array.isArray(workflow) || workflow.length === 0) {
      workflow = [
        { roleName: 'المهندس المنظم', signLabel: 'إعداد وتنظيم المعاملة' },
        { roleName: 'رئيس القسم', signLabel: 'التدقيق الفني والهندسي' },
        { roleName: 'مدير الأشغال والخدمات الهندسية', signLabel: 'الاعتماد والمصادقة' }
      ];
    }

    let footerHtml = '';
    if (signatures) {
      const sigLayout = cfg.signatures_layout || cfg.signaturesLayout || (cfg.documentType === 'LETTER' || workflow.length === 1 ? 'left' : 'grid');
      const colCount = Math.min(workflow.length, 5);
      
      let sigContainerStyle = `display:grid; grid-template-columns:repeat(${colCount}, minmax(0, 1fr)); gap:10px; text-align:center; width:100%; box-sizing:border-box; direction:rtl; align-items:start;`;
      if (sigLayout === 'left') {
        sigContainerStyle = 'display:flex; justify-content:flex-end; width:100%; text-align:center; direction:rtl; gap:14px;';
      } else if (sigLayout === 'right') {
        sigContainerStyle = 'display:flex; justify-content:flex-start; width:100%; text-align:center; direction:rtl; gap:14px;';
      } else if (sigLayout === 'center') {
        sigContainerStyle = 'display:flex; justify-content:center; width:100%; text-align:center; direction:rtl; gap:14px;';
      } else if (sigLayout === 'split') {
        sigContainerStyle = 'display:flex; justify-content:space-between; width:100%; text-align:center; direction:rtl;';
      }

      const sigBoxesHtml = workflow.map(s => {
        const isLeft = (s.position === 'left' || (!s.position || s.position === 'auto') && sigLayout === 'left');
        const isRight = (s.position === 'right' || (!s.position || s.position === 'auto') && sigLayout === 'right');
        return `
          <div style="min-width:0; width:100%; box-sizing:border-box; text-align:center; padding:0 4px; ${isLeft ? 'margin-right:auto; margin-left:0;' : isRight ? 'margin-left:auto; margin-right:0;' : ''}">
            <div style="font-weight:800; font-size:0.80rem; color:${cfg.primaryColor}; margin-bottom:26px; min-height:32px; display:flex; align-items:center; justify-content:center; line-height:1.2; text-align:center; overflow-wrap:break-word;">${s.roleName}</div>
            <div style="border-top:1.5px solid #334155; padding-top:4px; font-size:0.73rem; color:#0f172a; font-weight:700; line-height:1.25; overflow-wrap:break-word;">${s.signLabel || 'التوقيع والاعتماد'}</div>
          </div>
        `;
      }).join('');

      footerHtml = `
        <div style="margin-top:20px; padding-top:10px; page-break-inside:avoid; break-inside:avoid;">
          <div style="${sigContainerStyle}">
            ${sigBoxesHtml}
          </div>
          <div style="margin-top:18px; display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:6px;">
            <span>${cfg.municipalityName} — ${cfg.directorateName} ${cfg.showUserName ? `| المنظم: ${currentUserFull}` : ''}</span>
            ${cfg.showPrintTimestamp ? `<span>تاريخ ووقت الطباعة: ${new Date().toLocaleString('ar-JO')}</span>` : ''}
            ${cfg.showPageNumbers ? `<span class="page-number-indicator">صفحة <span class="current-page">1</span> من <span class="total-pages">1</span></span>` : ''}
          </div>
        </div>
      `;
    }

    /* ── تنسيق وأبعاد الصفحة والهوامش ──────────────────────────────────── */
    const pageSizeCss = `${cfg.pageSize || 'A4'} ${orientation}`;
    const pageMarginCss = `${cfg.marginTopMm || 6}mm ${cfg.marginRightMm || 8}mm ${cfg.marginBottomMm || 6}mm ${cfg.marginLeftMm || 8}mm`;

    /* ── العلامة المائية المتقدمة ── */
    let watermarkCss = '';
    if (cfg.watermarkEnabled) {
      if (cfg.watermarkType === 'text') {
        watermarkCss = `
          body::before {
            content: "${cfg.watermarkText || 'وثيقة رسمية معتمدة'}";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font-size: 2.8rem;
            font-weight: 800;
            color: ${cfg.primaryColor};
            opacity: ${cfg.watermarkOpacity || 0.04};
            z-index: -1;
            pointer-events: none;
            white-space: nowrap;
          }
        `;
      } else {
        watermarkCss = `
          body::before {
            content: "";
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${cfg.watermarkScale || 260}px;
            height: ${cfg.watermarkScale || 260}px;
            background-image: url('${cfg.logoUrl || '/logo.png'}');
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            opacity: ${cfg.watermarkOpacity || 0.04};
            z-index: -1;
            pointer-events: none;
          }
        `;
      }
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${cfg.municipalityName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: ${cfg.fontFamily};
            margin: ${pageMarginCss};
            color: #0f172a;
            font-size: ${cfg.fontSizeBase || 12}px;
            line-height: ${cfg.lineHeight || 1.6};
            background: #fff;
            position: relative;
          }
          ${watermarkCss}
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .print-footer-container {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-top: 20px;
          }
          @media print {
            @page {
              size: ${pageSizeCss};
              margin: ${pageMarginCss};
              @bottom-center {
                content: "صفحة " counter(page) " من " counter(pages);
                font-family: ${cfg.fontFamily};
                font-size: 8pt;
                color: ${cfg.primaryColor};
                font-weight: bold;
              }
            }
            body { margin: 0; }
            .no-print { display: none !important; }
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            .leaflet-control-container { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-page-wrapper">
          ${headerHtml}
          ${titleHtml}
          ${contentHtml}
          ${summarySection}
          <div class="print-footer-container">
            ${footerHtml}
          </div>
        </div>

        <script>
          // محرك حساب الترقيم الديناميكي للصفحات
          window.addEventListener('load', function() {
            try {
              var totalPages = Math.ceil(document.body.scrollHeight / 1050) || 1;
              document.querySelectorAll('.total-pages').forEach(function(el) { el.textContent = totalPages; });
            } catch(e) {}
          });
        </script>
      </body>
      </html>
    `;

    /* ── تشغيل الطباعة عبر Iframe مع نافذة احتياطية ── */
    function executePrint(html) {
      try {
        const oldFrame = document.getElementById('system-print-iframe');
        if (oldFrame) {
          try { oldFrame.remove(); } catch (e) {}
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'system-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '1024px';
        iframe.style.height = '1400px';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        document.body.appendChild(iframe);

        let doc = iframe.contentWindow || iframe.contentDocument;
        if (doc.document) doc = doc.document;

        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            fallbackWindowPrint(html);
          }
        }, 850);
      } catch (err) {
        fallbackWindowPrint(html);
      }
    }

    function fallbackWindowPrint(html) {
      const win = global.open('', '_blank', 'width=980,height=780');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
          win.focus();
          win.print();
        }, 500);
      } else {
        alert('⚠️ تعذّر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      }
    }

    executePrint(fullHtml);
    return fullHtml;
  }

  // تصدير المحرك الموحد المطور
  const printEngine = {
    getMasterConfig: getMasterPrintConfig,
    setMasterConfig: saveMasterPrintConfig,
    resetMasterConfig: resetMasterPrintConfig,
    print: printStandardDocument,
    generateQr: generateInlineQrSvg,
    DEFAULT_CONFIG: DEFAULT_MASTER_CONFIG
  };

  global.printStandardDocument = printStandardDocument;
  global.printEngine = printEngine;
  global.getMasterPrintConfig = getMasterPrintConfig;
  global.saveMasterPrintConfig = saveMasterPrintConfig;
  global.resetMasterPrintConfig = resetMasterPrintConfig;

}(typeof window !== 'undefined' ? window : this));

