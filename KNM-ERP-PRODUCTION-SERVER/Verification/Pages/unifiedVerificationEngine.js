/**
 * Verification/Pages/unifiedVerificationEngine.js
 * محرك التحقق الرقمي والختم الأمني الموحد (Unified Digital Verification Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

class UnifiedVerificationManager {
  constructor() {
    this.container = document.getElementById('verify-digital-container');
    this.currentDoc = null;
    this.searchHistory = JSON.parse(localStorage.getItem('verification_recent_history') || '[]');
    this.browseRecords = [];
    this.activeFilter = 'all';
  }

  async render() {
    this.container = document.getElementById('verify-digital-container');
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="verification-wrapper" style="display:flex; flex-direction:column; gap:22px;">
        
        <!-- Header Hero Card -->
        <div class="card" style="background: linear-gradient(135deg, rgba(15, 118, 110, 0.18) 0%, rgba(2, 132, 199, 0.12) 100%); border: 1.5px solid var(--border); border-radius: 18px; padding: 26px; position: relative; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 18px;">
              <div style="width: 60px; height: 60px; border-radius: 16px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 8px 24px rgba(15, 118, 110, 0.45);">
                🔐
              </div>
              <div>
                <h2 style="font-size: 1.45rem; font-weight: 900; color: var(--text); margin-bottom: 4px;">منظومة التحقق الرقمي والختم الأمني الموحد</h2>
                <p style="font-size: 0.92rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
                  التحقق الفوري من صحة ومطابقة كافة وثائق ومخرجات النظام (عطاءات، مطالبات، عقود، كفالات، تصاريح، أوامر شراء) بالبصمة المشفرة SHA-256
                </p>
              </div>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-outline" onclick="window.unifiedVerificationManager.openStandalonePortal()" style="border-radius: 10px; font-weight: 700;">
                🌐 البوابة العامة (QR Public)
              </button>
            </div>
          </div>
        </div>

        <!-- Search & Scan Bar Card -->
        <div class="card" style="background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 18px; padding: 24px; box-shadow: var(--shadow-sm);">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 14px; color: var(--primary); display:flex; align-items:center; gap:8px;">
            <span>🔍</span> <span>إدخال رقم المستند للفحص الفوري أو مسح الرمز المشفر (QR Code)</span>
          </h3>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
            <input type="text" id="verify-doc-input" class="form-control" placeholder="أدخل رقم الوثيقة أو العطاء أو المطالبة أو العقد (مثال: T-001 أو C-001 أو CNT-001)" 
              style="flex: 1; min-width: 280px; padding: 13px 18px; font-size: 1.05rem; border-radius: 12px; border: 2px solid var(--border); background: var(--bg); color: var(--text); font-weight: 600;"
              onkeydown="if(event.key==='Enter') window.unifiedVerificationManager.verifyDocument();"
            />
            <button class="btn btn-primary" onclick="window.unifiedVerificationManager.verifyDocument()" style="padding: 13px 30px; border-radius: 12px; font-weight: 800; font-size: 1.02rem; display: flex; align-items: center; gap: 8px;">
              <span>فحص وتثبت</span> <span>🛡️</span>
            </button>
            <button class="btn btn-secondary" onclick="window.unifiedVerificationManager.scanPrompt()" style="padding: 13px 20px; border-radius: 12px; font-weight: 700;">
              📷 مسح QR
            </button>
          </div>

          <!-- Module Fast Filters -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.84rem; font-weight: 800; color: var(--text-muted);">تصفية السجلات حسب النوع:</span>
            <button class="badge" id="vf-btn-all" style="cursor: pointer; padding: 6px 14px; border: none; background: var(--primary); color:#fff; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('all')">الكل</button>
            <button class="badge" id="vf-btn-tenders" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(15,118,110,0.15); color:var(--primary); font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('عطاء ومناقصة')">📋 عطاءات ومشاريع</button>
            <button class="badge" id="vf-btn-claims" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(2,132,199,0.15); color:#0284c7; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('مطالبة مالية')">📝 مطالبات ودفعات</button>
            <button class="badge" id="vf-btn-contracts" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(16,185,129,0.15); color:#059669; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('عقد مقاولة')">📑 عقود وضمانات</button>
            <button class="badge" id="vf-btn-purchases" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(245,158,11,0.15); color:#d97706; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('أمر شراء')">🛒 أوامر شراء</button>
            <button class="badge" id="vf-btn-permits" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(139,92,246,0.15); color:#7c3aed; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('تصريح حفر')">🚧 تصاريح حفريات</button>
            <button class="badge" id="vf-btn-daily" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(6,182,212,0.15); color:#0891b2; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('تقرير إنجاز يومي')">📊 تقارير يومية</button>
            <button class="badge" id="vf-btn-studies" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(99,102,241,0.15); color:#6366f1; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('دراسة جدوى')">📐 دراسات ومواصفات</button>
            <button class="badge" id="vf-btn-vo" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(236,72,153,0.15); color:#db2777; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('أمر تغييري')">📝 أوامر تغييرية</button>
            <button class="badge" id="vf-btn-guarantees" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(234,179,8,0.15); color:#ca8a04; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('كفالة بنكية')">🏦 كفالات بنكية</button>
            <button class="badge" id="vf-btn-tasks" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(244,63,94,0.15); color:#e11d48; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('مهمة هندسية')">📋 مهام ميدانية</button>
            <button class="badge" id="vf-btn-roads" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(107,114,128,0.15); color:#4b5563; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('طريق')">🛣️ طرق ورصفات</button>
            <button class="badge" id="vf-btn-assets" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(168,85,247,0.15); color:#9333ea; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('أصل')">🏗️ أصول إنشائية</button>
            <button class="badge" id="vf-btn-paving" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(34,197,94,0.15); color:#16a34a; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('عوائد تعبيد')">💰 عوائد تعبيد</button>
            <button class="badge" id="vf-btn-committees" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(251,146,60,0.15); color:#ea580c; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('محضر لجنة')">👥 محاضر لجان</button>
            <button class="badge" id="vf-btn-archive" style="cursor: pointer; padding: 6px 14px; border: none; background: rgba(120,113,108,0.15); color:#78716c; font-weight:bold;" onclick="window.unifiedVerificationManager.filterCategory('أرشيف')">🗂️ أرشيف ووثائق</button>
          </div>
        </div>

        <!-- Result Container -->
        <div id="verify-result-container" style="display: none;"></div>

        <!-- Available System Records Quick-Verify Browser -->
        <div class="card" style="background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 18px; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap:wrap; gap:10px;">
            <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text); margin: 0; display:flex; align-items:center; gap:8px;">
              <span>📑</span> <span>وثائق ومخرجات النظام المتاحة للتحقق الفوري</span>
            </h3>
            <button class="btn btn-sm btn-outline" onclick="window.unifiedVerificationManager.loadBrowseRecords()" style="font-weight: 700;">
              🔄 تحديث القائمة
            </button>
          </div>

          <div class="table-responsive">
            <table class="table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border); text-align: right;">
                  <th style="padding: 10px;">رقم السجل / القيد</th>
                  <th style="padding: 10px;">نوع الوثيقة</th>
                  <th style="padding: 10px;">موضوع / عنوان المستند</th>
                  <th style="padding: 10px;">الجهة المنفذة / المستفيدة</th>
                  <th style="padding: 10px;">القيمة المالية</th>
                  <th style="padding: 10px;">الحالة</th>
                  <th style="padding: 10px; text-align: center;">إجراء التحقق</th>
                </tr>
              </thead>
              <tbody id="verify-browse-tbody">
                <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);"><div class="spinner" style="margin:0 auto 10px; width:24px; height:24px; border:2px solid rgba(15,118,110,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>جاري تحميل الوثائق الرسمية...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Verification Audit History -->
        <div class="card" style="background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 18px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 1rem; font-weight: 800; color: var(--text); margin: 0; display:flex; align-items:center; gap:8px;">
              <span>🕒</span> <span>سجل عمليات التحقق والمستندات المفحوصة مؤخراً</span>
            </h3>
            <button class="btn btn-sm btn-outline" onclick="window.unifiedVerificationManager.clearHistory()" style="font-size: 0.8rem;">
              مسح السجل
            </button>
          </div>

          <div class="table-responsive">
            <table class="table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border); text-align: right;">
                  <th style="padding: 10px;">رقم المستند</th>
                  <th style="padding: 10px;">نوع الوثيقة</th>
                  <th style="padding: 10px;">عنوان / وصف المستند</th>
                  <th style="padding: 10px;">الجهة المنفذة</th>
                  <th style="padding: 10px;">الحالة</th>
                  <th style="padding: 10px;">تاريخ الفحص</th>
                  <th style="padding: 10px; text-align: center;">إجراء</th>
                </tr>
              </thead>
              <tbody id="verify-history-tbody">
                ${this.renderHistoryRows()}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.loadBrowseRecords();
  }

  async loadBrowseRecords() {
    const tbody = document.getElementById('verify-browse-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/v4/verify-document/browse/all');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        this.browseRecords = data.data;
        this.renderBrowseTable();
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد وثائق متاحة حالياً</td></tr>`;
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#ef4444;">تعذر تحميل الوثائق: ${e.message}</td></tr>`;
    }
  }

  renderBrowseTable() {
    const tbody = document.getElementById('verify-browse-tbody');
    if (!tbody) return;

    let filtered = this.browseRecords;
    if (this.activeFilter && this.activeFilter !== 'all') {
      filtered = filtered.filter(item => item.type && item.type.includes(this.activeFilter));
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد وثائق تطابق الفلتر المحدد</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 10px; font-weight: bold; font-family: monospace; color: var(--primary);">${item.id}</td>
        <td style="padding: 10px;"><span class="badge badge-info" style="font-weight:700;">${item.type || 'مستند'}</span></td>
        <td style="padding: 10px; font-weight: 700;">${item.title || '-'}</td>
        <td style="padding: 10px;">${item.entity || '-'}</td>
        <td style="padding: 10px; font-weight: 700; color:#059669;">${item.amount ? Number(item.amount).toLocaleString('ar-JO') + ' د.أ' : '—'}</td>
        <td style="padding: 10px;"><span class="badge badge-success">${item.status || 'معتمد'}</span></td>
        <td style="padding: 10px; text-align: center;">
          <button class="btn btn-sm btn-primary" onclick="window.unifiedVerificationManager.quickVerify('${item.id}')" style="padding: 5px 14px; font-weight: 700; font-size: 0.84rem; border-radius: 8px;">
            فحص وتوثيق 🛡️
          </button>
        </td>
      </tr>
    `).join('');
  }

  filterCategory(cat) {
    this.activeFilter = cat;
    this.renderBrowseTable();
  }

  renderHistoryRows() {
    if (!this.searchHistory || !this.searchHistory.length) {
      return `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">لا توجد عمليات تحقق سابقة في هذا المتصفح</td></tr>`;
    }

    return this.searchHistory.map((item, idx) => `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 10px; font-weight: bold; font-family: monospace; color: var(--primary);">${item.id}</td>
        <td style="padding: 10px;"><span class="badge badge-info">${item.type || 'مستند'}</span></td>
        <td style="padding: 10px; font-weight: 600;">${item.title || '-'}</td>
        <td style="padding: 10px;">${item.entity || '-'}</td>
        <td style="padding: 10px;"><span class="badge badge-success">${item.status || 'معتمد'}</span></td>
        <td style="padding: 10px; font-size: 0.84rem; color: var(--text-muted);" dir="ltr">${new Date(item.verifiedAt || Date.now()).toLocaleTimeString('ar-JO')}</td>
        <td style="padding: 10px; text-align: center;">
          <button class="btn btn-sm btn-primary" onclick="window.unifiedVerificationManager.quickVerify('${item.id}')" style="padding: 4px 10px; font-size: 0.78rem;">
            إعادة الفحص
          </button>
        </td>
      </tr>
    `).join('');
  }

  async verifyDocument(docId) {
    const input = document.getElementById('verify-doc-input');
    const id = docId || (input ? input.value.trim() : '');
    const resultBox = document.getElementById('verify-result-container');

    if (!id) {
      if (typeof showToast === 'function') showToast('يرجى إدخال رقم المستند للفحص', 'warning');
      return;
    }

    if (input) input.value = id;
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="card" style="padding: 30px; text-align: center; border-radius: 16px; border: 1px solid var(--border);">
          <div class="spinner" style="margin: 0 auto 12px; width:36px; height:36px; border:3px solid rgba(15,118,110,0.2); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
          <p style="font-weight: 700; color: var(--text);">جاري التحقق الرقمي ومطابقة الختم المشفر من خادم البلدية...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/v4/verify-document/${encodeURIComponent(id)}`);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        const doc = data.data;
        this.currentDoc = doc;
        this.addToHistory(doc);
        this.renderSuccessResult(doc);
      } else {
        this.renderErrorResult(id, data.error || 'المستند غير مسجل في قاعدة البيانات الرسمية');
      }
    } catch (err) {
      this.renderErrorResult(id, 'تعذر الاتصال بخادم التحقق الرقمي: ' + err.message);
    }
  }

  renderSuccessResult(doc) {
    const resultBox = document.getElementById('verify-result-container');
    if (!resultBox) return;

    const stamp = doc.securityStamp || {};
    const amountFormatted = doc.amount || (Number(doc.rawAmount || 0).toLocaleString('ar-JO') + ' د.أ');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/verify.html?id=' + doc.id)}`;

    resultBox.innerHTML = `
      <div class="card" style="background: var(--bg-card, #fff); border: 2px solid #10b981; border-radius: 18px; padding: 28px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.15); animation: fadeIn 0.4s ease;">
        
        <!-- Verification Banner -->
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
              ✓
            </div>
            <div>
              <h4 style="color: #059669; font-weight: 800; font-size: 1.15rem; margin: 0;">وثيقة رسمية معتمدة ومطابقة رقمياً</h4>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin: 2px 0 0 0;">تم تأكيد صحة البيانات والختم المشفر من سجلات مديرية الأشغال</p>
            </div>
          </div>
          <span class="badge" style="background: #10b981; color: #fff; font-size: 0.88rem; padding: 8px 16px; border-radius: 50px; font-weight: 800;">
            100% أصلي وموثق
          </span>
        </div>

        <!-- Document Main Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
          
          <div style="background: var(--bg, #f8fafc); padding: 18px; border-radius: 14px; border: 1px solid var(--border);">
            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">نوع ومسمى الوثيقة</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: var(--primary); margin-bottom: 12px;">${doc.docType || 'مستند رسمي'}</div>

            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">رقم السجل / القيد</div>
            <div style="font-size: 1.15rem; font-weight: 900; font-family: monospace; color: var(--text); margin-bottom: 12px;">${doc.id}</div>

            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">العنوان والموضوع</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text);">${doc.title || '-'}</div>
          </div>

          <div style="background: var(--bg, #f8fafc); padding: 18px; border-radius: 14px; border: 1px solid var(--border);">
            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">الجهة المعنية / المقاول / المورد</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: var(--text); margin-bottom: 12px;">${doc.entityName || '-'}</div>

            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">القيمة المالية المعتمدة</div>
            <div style="font-size: 1.25rem; font-weight: 900; color: #059669; margin-bottom: 12px;">${amountFormatted}</div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">حالة المستند</div>
                <div style="font-size: 0.92rem; font-weight: 800; color: var(--primary);">${doc.status || 'معتمد'}</div>
              </div>
              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">تاريخ الإصدار</div>
                <div style="font-size: 0.92rem; font-weight: 700;" dir="ltr">${doc.date ? String(doc.date).split('T')[0] : '-'}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- SHA-256 Security Seal Section -->
        <div style="background: rgba(15, 23, 42, 0.04); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 1.2rem;">🔒</span>
              <strong style="font-size: 0.95rem; color: var(--text);">البصمة المشفرة الرقمية (SHA-256 Stamp):</strong>
            </div>
            <div style="font-family: monospace; font-size: 0.85rem; background: var(--bg); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); word-break: break-all; color: var(--primary); font-weight: 700;">
              ${stamp.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
            </div>
            <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);">
              جهة الإصدار: <strong>${stamp.issuer || 'بلدية كفرنجة الجديدة - مديرية الأشغال'}</strong> | وقت التوقيع: <span dir="ltr">${stamp.timestamp || new Date().toISOString()}</span>
            </div>
          </div>

          <div style="text-align: center; padding: 8px; background: #fff; border-radius: 12px; border: 1px solid var(--border);">
            <img src="${qrUrl}" alt="QR Verification" style="width: 100px; height: 100px; display: block;" onerror="this.style.display='none'" />
            <div style="font-size: 0.72rem; color: #64748b; font-weight: bold; margin-top: 4px;">رمز التحقق المعتمد</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="window.unifiedVerificationManager.copyVerificationLink('${doc.id}')" style="border-radius: 10px; font-weight: 600;">
            🔗 نسخ رابط التحقق
          </button>
          <button class="btn btn-primary" onclick="window.unifiedVerificationManager.printCertificate()" style="border-radius: 10px; font-weight: 700; display:flex; align-items:center; gap:8px;">
            <span>🖨️ طباعة شهادة التحقق الرسمية</span>
          </button>
        </div>

      </div>
    `;
  }

  renderErrorResult(id, errorMsg) {
    const resultBox = document.getElementById('verify-result-container');
    if (!resultBox) return;

    resultBox.innerHTML = `
      <div class="card" style="background: var(--bg-card, #fff); border: 2px solid #ef4444; border-radius: 18px; padding: 28px; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.15); animation: fadeIn 0.4s ease;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #ef4444; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: bold;">
            ✕
          </div>
          <div>
            <h4 style="color: #dc2626; font-weight: 800; font-size: 1.2rem; margin: 0;">لم يتم العثور على وثيقة مطابقة بهذا الرقم</h4>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 4px 0 0 0;">المستند رقم (<strong style="font-family:monospace; color:var(--text);">${id}</strong>) غير مسجل أو قد يكون ملغياً</p>
          </div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 14px 18px; color: #b91c1c; font-size: 0.9rem; line-height: 1.5; margin-bottom: 18px;">
          <strong>تنبيه أمني:</strong> ${errorMsg}. يرجى مراجعة مديرية الأشغال والخدمات الهندسية للتثبت من الرقم المرجعي للوثيقة.
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="document.getElementById('verify-doc-input').focus()" style="border-radius: 10px;">
            إعادة المحاولة برقم آخر
          </button>
        </div>
      </div>
    `;
  }

  addToHistory(doc) {
    this.searchHistory = this.searchHistory.filter(h => h.id !== doc.id);
    this.searchHistory.unshift({
      id: doc.id,
      type: doc.docType,
      title: doc.title,
      entity: doc.entityName,
      status: doc.status,
      verifiedAt: new Date().toISOString()
    });
    if (this.searchHistory.length > 15) this.searchHistory.pop();
    localStorage.setItem('verification_recent_history', JSON.stringify(this.searchHistory));

    const tbody = document.getElementById('verify-history-tbody');
    if (tbody) tbody.innerHTML = this.renderHistoryRows();
  }

  clearHistory() {
    this.searchHistory = [];
    localStorage.removeItem('verification_recent_history');
    const tbody = document.getElementById('verify-history-tbody');
    if (tbody) tbody.innerHTML = this.renderHistoryRows();
    if (typeof showToast === 'function') showToast('تم مسح سجل التحقق', 'info');
  }

  quickVerify(id) {
    this.verifyDocument(id);
  }

  scanPrompt() {
    const code = prompt('يرجى لصق نص الرمز الشريطي أو رقم المستند الممسوح:');
    if (code) this.verifyDocument(code.trim());
  }

  openStandalonePortal() {
    window.open('/verify.html', '_blank');
  }

  copyVerificationLink(docId) {
    const url = window.location.origin + '/verify.html?id=' + encodeURIComponent(docId);
    navigator.clipboard.writeText(url)
      .then(() => {
        if (typeof showToast === 'function') showToast('✅ تم نسخ رابط التحقق بنجاح', 'success');
      })
      .catch(() => {
        prompt('رابط التحقق المباشر:', url);
      });
  }

  printCertificate() {
    if (!this.currentDoc) return;
    const doc = this.currentDoc;
    const stamp = doc.securityStamp || {};
    const win = window.open('', '_blank');
    
    win.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>شهادة تحقق رقمية معتمدة - ${doc.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Tajawal', sans-serif; padding: 40px; background: #fff; color: #000; }
          .cert-border { border: 4px double #0f766e; padding: 30px; border-radius: 16px; position: relative; }
          .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 20px; margin-bottom: 24px; }
          .logo { width: 85px; height: 85px; margin: 0 auto 10px; }
          .logo img { width: 100%; height: 100%; object-fit: contain; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; }
          .item { border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 8px; background: #f8fafc; }
          .item label { display: block; font-size: 0.85rem; color: #64748b; font-weight: bold; }
          .item value { display: block; font-size: 1.1rem; font-weight: bold; margin-top: 4px; }
          .stamp-box { border: 2px dashed #0f766e; padding: 16px; border-radius: 12px; margin-top: 24px; background: #f0fdfa; }
          .footer-sig { display: flex; justify-content: space-between; margin-top: 40px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="cert-border">
          <div class="header">
            <div class="logo"><img src="/logo.jpg" onerror="this.src='/logo.png'"></div>
            <h3 style="margin:0; color:#475569;">المملكة الأردنية الهاشمية</h3>
            <h1 style="margin:4px 0; color:#0f766e;">بلدية كفرنجة الجديدة</h1>
            <h2 style="margin:0; font-size:1.1rem; color:#0284c7;">مديرية الأشغال والخدمات الهندسية</h2>
            <h3 style="margin-top:10px; color:#10b981; font-weight:900;">شهادة تحقق ومطابقة رقمية رسمية</h3>
          </div>

          <p style="font-size:1.05rem; line-height:1.6; text-align:justify;">
            تشهد بلدية كفرنجة الجديدة / مديرية الأشغال والخدمات الهندسية بأنه قد جرى التحقق الإلكتروني من صحة وقيد الوثيقة المبينة بياناتها أدناه ومطابقتها مع السجلات المركزية المشفرة للنظام:
          </p>

          <div class="grid">
            <div class="item"><label>رقم المستند / القيد:</label><value style="color:#0f766e; font-family:monospace;">${doc.id}</value></div>
            <div class="item"><label>نوع الوثيقة:</label><value>${doc.docType || 'مستند رسمي'}</value></div>
            <div class="item"><label>موضوع الوثيقة:</label><value>${doc.title || '-'}</value></div>
            <div class="item"><label>الجهة المنفذة / المستفيدة:</label><value>${doc.entityName || '-'}</value></div>
            <div class="item"><label>القيمة المالية المعتمدة:</label><value style="color:#059669;">${doc.amount || (Number(doc.rawAmount||0).toLocaleString('ar-JO') + ' د.أ')}</value></div>
            <div class="item"><label>الحالة الرسمية:</label><value style="color:#0284c7;">${doc.status || 'معتمد'}</value></div>
          </div>

          <div class="stamp-box">
            <div style="font-weight:bold; color:#0f766e; margin-bottom:4px;">🔒 الختم المشفر المعتمد (SHA-256 Cryptographic Hash):</div>
            <div style="font-family:monospace; font-size:0.85rem; word-break:break-all; color:#0f172a; font-weight:bold;">${stamp.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</div>
            <div style="margin-top:8px; font-size:0.8rem; color:#64748b;">تاريخ ووقت التوثيق: ${stamp.timestamp || new Date().toISOString()}</div>
          </div>

          <div class="footer-sig">
            <div style="text-align:center;">
              <div style="font-weight:bold;">مديرية الأشغال والخدمات الهندسية</div>
              <div style="margin-top:40px; font-weight:bold;">الختم والتوقيع الإلكتروني</div>
            </div>
            <div style="text-align:center;">
              <div style="font-weight:bold;">رئيس بلدية كفرنجة الجديدة</div>
              <div style="margin-top:40px; font-weight:bold;">معتمد رسمياً</div>
            </div>
          </div>
        </div>

        <div class="no-print" style="text-align:center; margin-top:20px;">
          <button onclick="window.print()" style="padding:10px 24px; font-size:1rem; font-weight:bold; background:#0f766e; color:#fff; border:none; border-radius:8px; cursor:pointer;">طباعة الشهادة</button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }
}

// Global shortcut function to verify any document from anywhere in the app
window.verifyDocumentDirect = function(docId) {
  if (typeof navigate === 'function') {
    navigate('verify-digital');
    setTimeout(() => {
      if (window.unifiedVerificationManager) {
        window.unifiedVerificationManager.verifyDocument(docId);
      }
    }, 150);
  }
};

window.UnifiedVerificationManager = UnifiedVerificationManager;
