/**
 * Visual Template Builder - No-Code WYSIWYG Integration
 * نظام بلدية كفرنجة v4.0 Enterprise
 */

class VisualTemplateBuilder {
  constructor(containerId) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!this.container) return;
    this.templateData = {
      header: { logoUrl: '', title: '', subtitle: '', showBorder: true },
      content: '',
      signatures: [],
      footer: { pageNumbers: true, text: '' }
    };
    this.initUI();
  }

  // بناء عناصر التحكم البصرية بالكامل بدلاً من كود HTML اليدوي
  initUI() {
    this.container.innerHTML = `
      <div class="visual-builder-wrapper" style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; color:var(--text);">
        <!-- 1. شريط الأدوات البصري (No-Code Toolbar) -->
        <div class="toolbar" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; padding:10px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border);">
          <button type="button" id="btn-add-header" class="btn btn-sm btn-primary">
            🖼️ إضافة ترويسة/شعار
          </button>
          <button type="button" id="btn-add-signature" class="btn btn-sm btn-success">
            ✍️ إضافة مربع توقيع رسمي
          </button>
          <button type="button" id="btn-add-watermark" class="btn btn-sm btn-outline">
            🛡️ إضافة ختم البلدية
          </button>
        </div>

        <!-- 2. لوحة إعداد الرأس والتذييل بصرياً -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div style="background:var(--bg-card); padding:12px; border-radius:8px; border:1px solid var(--border);">
            <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">شعار المملكة / البلدية</label>
            <input type="file" id="logo-uploader" accept="image/*" class="form-control" style="font-size:0.8rem; padding:4px;" />
          </div>
          <div style="background:var(--bg-card); padding:12px; border-radius:8px; border:1px solid var(--border);">
            <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">عنوان النموذج الرسمي</label>
            <input type="text" id="input-official-title" placeholder="مثال: نموذج مطالبات جارية" class="form-control" style="width:100%; font-size:0.9rem;" />
          </div>
        </div>

        <!-- 3. منطقة المعاينة والتعديل البصري المباشر (WYSIWYG Canvas) -->
        <div class="visual-canvas" id="visual-editor-canvas" contenteditable="true" style="background:#ffffff; color:#000000; padding:24px; border-radius:8px; border:2px dashed #cbd5e1; min-height:280px; direction:rtl; outline:none;">
          <div class="text-center text-gray-400 py-10" id="canvas-placeholder" style="text-align:center; color:#94a3b8; padding:40px 0;">
            انقر على الأزرار أعلاه لبناء الترويسة والتواقيع، أو ابدأ بكتابة نص النموذج مباشرة هنا...
          </div>
        </div>

        <!-- حقل مخفي يحتوي على الـ HTML المولد تلقائياً لمنع أي أخطاء Validation -->
        <input type="hidden" id="generated-html-output" name="htmlTemplate" />
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const uploader = document.getElementById('logo-uploader');
    if (uploader) {
      uploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.templateData.header.logoUrl = event.target.result;
            this.renderCanvas();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    const titleInput = document.getElementById('input-official-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.templateData.header.title = e.target.value;
        this.renderCanvas();
      });
    }

    const btnHeader = document.getElementById('btn-add-header');
    if (btnHeader) {
      btnHeader.addEventListener('click', () => {
        this.templateData.header.title = this.templateData.header.title || 'نموذج إداري هندسي رسمي';
        this.renderCanvas();
      });
    }

    const btnSig = document.getElementById('btn-add-signature');
    if (btnSig) {
      btnSig.addEventListener('click', () => {
        this.templateData.signatures.push({
          role: 'توقيع المهندس المشرف / المدقق',
          name: '........................'
        });
        this.renderCanvas();
      });
    }

    const btnWatermark = document.getElementById('btn-add-watermark');
    if (btnWatermark) {
      btnWatermark.addEventListener('click', () => {
        this.templateData.header.subtitle = 'محتوم بالختم الرسمي - بلدية كفرنجة الجديدة';
        this.renderCanvas();
      });
    }

    const canvas = document.getElementById('visual-editor-canvas');
    if (canvas) {
      canvas.addEventListener('input', () => {
        this.syncOutput();
      });
    }
  }

  // توليد الهيكل البصري النهائي تلقائياً بدون تدخل المستخدم
  renderCanvas() {
    const canvas = document.getElementById('visual-editor-canvas');
    if (!canvas) return;

    let headerHTML = '';
    if (this.templateData.header.logoUrl || this.templateData.header.title || this.templateData.header.subtitle) {
      headerHTML = `
        <div class="print-header-block" style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e293b; padding-bottom:16px; margin-bottom:20px; direction:rtl;">
          <div style="text-align:right;">
            <h2 style="font-size:1.1rem; font-weight:bold; margin:0; color:#0f172a;">المملكة الأردنية الهاشمية</h2>
            <h3 style="font-size:0.95rem; margin:2px 0; color:#1e293b;">بلدية كفرنجة الجديدة</h3>
            <p style="font-size:0.8rem; color:#475569; margin:0;">مديرية الأشغال والخدمات الهندسية</p>
          </div>
          ${this.templateData.header.logoUrl ? `<img src="${this.templateData.header.logoUrl}" style="height:65px; object-fit:contain;" alt="Logo" />` : `<img src="/logo.png" style="height:65px; object-fit:contain;" alt="Logo" onerror="this.style.display='none'" />`}
          <div style="text-align:left;">
            <h1 style="font-size:1.2rem; font-weight:bold; color:#1e3a8a; margin:0;">${this.templateData.header.title || 'وثيقة رسمية'}</h1>
            <p style="font-size:0.75rem; color:#64748b; margin:4px 0 0 0;">التاريخ: ${new Date().toLocaleDateString('ar-JO')}</p>
            ${this.templateData.header.subtitle ? `<p style="font-size:0.7rem; color:#0d9488; font-weight:bold; margin:2px 0 0 0;">${this.templateData.header.subtitle}</p>` : ''}
          </div>
        </div>
      `;
    }

    let signaturesHTML = '';
    if (this.templateData.signatures.length > 0) {
      signaturesHTML = `
        <div class="signatures-block" style="display:grid; grid-template-columns:repeat(${Math.min(this.templateData.signatures.length, 3)}, 1fr); gap:16px; margin-top:32px; padding-top:16px; border-top:1px solid #cbd5e1; text-align:center; font-weight:bold; direction:rtl;">
          ${this.templateData.signatures.map(sig => `
            <div style="padding:8px;">
              <p style="margin-bottom:28px; font-size:0.85rem; color:#1e293b;">${sig.role}</p>
              <p style="color:#94a3b8; font-size:0.75rem;">${sig.name}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    // الدمج البصري بدون إدراج كود
    canvas.innerHTML = headerHTML + `<div class="editable-content" contenteditable="true" style="margin:16px 0; min-height:100px; color:#1e293b;">أدخل نص وقرارات النموذج هنا...</div>` + signaturesHTML;
    this.syncOutput();
  }

  // مزامنة الكود مع الحقل المخفي ليتوافق مع قاعدة البيانات
  syncOutput() {
    const canvas = document.getElementById('visual-editor-canvas');
    const hiddenInput = document.getElementById('generated-html-output');
    if (canvas && hiddenInput) {
      hiddenInput.value = canvas.innerHTML;
    }
  }
}

if (typeof window !== 'undefined') {
  window.VisualTemplateBuilder = VisualTemplateBuilder;
}
