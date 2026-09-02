/**
 * Committees/Pages/unifiedCommitteesManager.js
 * وحدة ونظام تقارير اللجان الفنية، محاضر الاستلام، ودراسة العطاءات وتقييم العروض
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * الميزات:
 * 1. تبويبين رئيسيين متطورين: (محاضر الاستلام الفني) و (دراسة العطاءات وتقييم العروض المقدمة).
 * 2. جدول مقارنة وتحليل العروض المالية والفنية والكفالات البنكية للمقاولين.
 * 3. تشكيل وتكليف أعضاء اللجان بقرار رسمي من مدير النظام.
 * 4. إدراج الخريطة التفاعلية الموحدة لمواقع العطاءات واللجان الفنية تلقائياً في التقرير والشاشة.
 * 5. هيكلة قرار وتوصية اللجنة كـ (مقدمة رسمية + بنود وقرارات مرقمة).
 * 6. طباعة محضر معتمد وخانة اعتماد مدير الأشغال محاذاة لليسار وخالٍ من "المهندس ورئيس القسم".
 */

(function() {
  class UnifiedCommitteesManager {
    constructor() {
      this.activeTabMode = 'HANDOVER'; // 'HANDOVER' or 'STUDIES'
      this.activeData = [];
      this.studiesData = [];
      this.tendersList = [];
      this.usersList = [];
      this.stats = null;
      this.currentFilter = 'ALL';
      this.searchQuery = '';
      this.selectedStatus = '';
      this.selectedYear = '';
      this.map = null;
      this.markersLayer = null;
      this.currentUser = this._getCurrentUser();

      this.init();
    }

    _getCurrentUser() {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : { role: 'admin', fullName: 'مدير النظام' };
      } catch (e) {
        return { role: 'admin', fullName: 'مدير النظام' };
      }
    }

    async init() {
      this.render();
      await Promise.all([
        this.fetchStats(),
        this.fetchTenders(),
        this.fetchUsers(),
        this.fetchReports(),
        this.fetchStudies()
      ]);
      this.initMap();
    }

    async fetchTenders() {
      try {
        const res = await fetch('/api/tenders');
        if (res.ok) this.tendersList = await res.json();
      } catch (e) {}
    }

    async fetchUsers() {
      try {
        const res = await fetch('/api/v4/committees/users-list');
        if (res.ok) {
          const data = await res.json();
          this.usersList = data.users || [];
        }
      } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Structure Recommendation as Intro + Points
    // ─────────────────────────────────────────────────────────────────────────
    formatRecommendationHtml(rawText, isDark = false) {
      if (!rawText) return '<div>—</div>';
      const text = String(rawText).trim();

      let intro = '';
      let points = [];

      if (text.includes('\n')) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          if (!lines[0].match(/^[0-9]+[-\.\)]|^[-•*]/)) {
            intro = lines[0];
            points = lines.slice(1);
          } else {
            points = lines;
          }
        } else {
          intro = lines[0];
        }
      } else {
        const parts = text.split(/(?=[0-9]+[-\.\)])/);
        if (parts.length > 1) {
          intro = parts[0].trim();
          points = parts.slice(1).map(p => p.trim()).filter(Boolean);
        } else {
          intro = text;
        }
      }

      const introColor = isDark ? '#38bdf8' : '#1e3a8a';
      const textColor = isDark ? '#f8fafc' : '#0f172a';
      const numBg = isDark ? 'rgba(56,189,248,0.15)' : '#e0f2fe';
      const numColor = isDark ? '#38bdf8' : '#0284c7';

      let html = '';
      if (intro) {
        html += `<div style="font-weight:700; color:${introColor}; margin-bottom:10px; line-height:1.6; font-size:0.9rem;">${intro}</div>`;
      }

      if (points && points.length > 0) {
        html += `<div style="display:flex; flex-direction:column; gap:8px; margin:0; padding:0;">`;
        points.forEach((pt, idx) => {
          const cleanPt = pt.replace(/^[0-9]+[-\.\)]\s*|^[-•*]\s*/, '').trim();
          if (cleanPt) {
            html += `
              <div style="display:flex; align-items:flex-start; gap:10px; font-size:0.86rem; line-height:1.6; color:${textColor};">
                <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:${numBg}; color:${numColor}; font-weight:bold; font-size:0.75rem; flex-shrink:0; margin-top:2px;">
                  ${idx + 1}
                </span>
                <span style="flex:1;">${cleanPt}</span>
              </div>
            `;
          }
        });
        html += `</div>`;
      }

      return html;
    }

    render() {
      const container = document.getElementById('committee-reports-tab-container') || document.getElementById('page-committee-reports');
      if (!container) return;

      container.innerHTML = `
        <div class="committees-suite-wrapper" style="direction:rtl; font-family:'Tajawal', sans-serif; padding:4px 0 20px 0; color:var(--text, #0f172a); width:100%; max-width:100%; box-sizing:border-box; overflow-x:hidden;">
          
          <!-- Top Action Header -->
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; width:100%; box-sizing:border-box;">
            <div style="flex:1; min-width:260px;">
              <h2 style="font-size:1.35rem; font-weight:800; color:var(--text, #0f172a); margin:0 0 4px 0; display:flex; align-items:center; gap:8px;">
                <span>👥</span> <span>تقارير اللجان الفنية، الاستلام، ودراسة العطاءات</span>
              </h2>
              <p style="margin:0; font-size:0.83rem; color:var(--text-muted, #94a3b8);">
                إدارة محاضر الاستلام الأولي والنهائي، دراسة وتحليل العروض المالية والفنية، واعتماد تقارير اللجان
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <button class="btn btn-primary" onclick="window.unifiedCommitteesManager.openCreateModal()" style="display:flex; align-items:center; gap:6px; font-weight:bold; font-size:0.84rem; padding:8px 14px;">
                <span>➕</span> <span id="comm-create-btn-text">تنظيم محضر استلام / دراسة جديد</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedCommitteesManager.printCatalog()" style="display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:8px 14px;">
                <span>🖨️</span> <span>طباعة كشف اللجان</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedCommitteesManager.exportToCSV()" style="display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:8px 14px;">
                <span>📥</span> <span>تصدير Excel</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedCommitteesManager.refreshAll()" style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0;" title="تحديث البيانات">
                <span>🔄</span>
              </button>
            </div>
          </div>

          <!-- KPI Summary Cards Container -->
          <div id="comm-kpi-container" class="stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px; width:100%; box-sizing:border-box;">
            <!-- Rendered dynamically based on mode -->
          </div>

          <!-- Interactive GIS Map Section -->
          <div class="map-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:14px; padding:16px; margin-bottom:24px; box-shadow:0 4px 16px rgba(0,0,0,0.15); width:100%; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; border-bottom:1px solid var(--border, #334155); padding-bottom:10px;">
              <div>
                <h3 style="margin:0; font-size:1rem; font-weight:800; color:var(--text, #f8fafc); display:flex; align-items:center; gap:8px;">
                  <span>🗺️</span> <span>الخريطة الجغرافية التفاعلية لمواقع العطاءات واللجان الفنية</span>
                </h3>
                <div style="font-size:0.78rem; color:var(--text-muted, #94a3b8); margin-top:2px;">
                  تتبع مواقع العطاءات ومحاضر الاستلام ودراسة العروض الفنية لبلدية كفرنجة
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.75rem; background:rgba(2,132,199,0.15); color:#38bdf8; padding:3px 8px; border-radius:12px; border:1px solid rgba(2,132,199,0.3);">
                  📍 كفرنجة: 32.2985, 35.7050
                </span>
                <button class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.refreshMap()" style="padding:3px 8px; font-size:0.75rem;">
                  🔄 تحديث الخريطة
                </button>
              </div>
            </div>

            <!-- Map Leaflet Container -->
            <div id="comm-map" style="height:320px; width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--border, #334155); z-index:1;"></div>
          </div>

          <!-- Category Filter Tabs Navigation (Sub-Tabs Bar) -->
          <div id="comm-subcategories-bar" class="comm-categories-nav" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px; border-bottom:1px solid var(--border, #334155); width:100%; box-sizing:border-box;">
            <button class="btn btn-sm comm-cat-btn active" data-type="ALL" onclick="window.unifiedCommitteesManager.switchType('ALL', this)" style="border-radius:20px; font-weight:bold; padding:6px 14px; flex-shrink:0;">📂 كافة اللجان والمحاضر</button>
            <button class="btn btn-sm comm-cat-btn" data-type="TENDER_STUDIES" onclick="window.unifiedCommitteesManager.switchType('TENDER_STUDIES', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0; font-weight:bold;">📊 دراسة العطاءات والعروض المقدمة</button>
            <button class="btn btn-sm comm-cat-btn" data-type="INITIAL_HANDOVER" onclick="window.unifiedCommitteesManager.switchType('INITIAL_HANDOVER', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0;">📑 الاستلام الأولي</button>
            <button class="btn btn-sm comm-cat-btn" data-type="FINAL_HANDOVER" onclick="window.unifiedCommitteesManager.switchType('FINAL_HANDOVER', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0;">🏆 الاستلام النهائي</button>
            <button class="btn btn-sm comm-cat-btn" data-type="TECHNICAL_AUDIT" onclick="window.unifiedCommitteesManager.switchType('TECHNICAL_AUDIT', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0;">🔍 الكشف والتدقيق الفني</button>
            <button class="btn btn-sm comm-cat-btn" data-type="DEFECT_PUNCHLIST" onclick="window.unifiedCommitteesManager.switchType('DEFECT_PUNCHLIST', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0;">⚠️ حصر النواقص والاستدراك</button>
            <button class="btn btn-sm comm-cat-btn" data-type="VARIATION_COMMITTEE" onclick="window.unifiedCommitteesManager.switchType('VARIATION_COMMITTEE', this)" style="border-radius:20px; padding:6px 14px; flex-shrink:0;">💡 أوامر التغيير والمواصفات</button>
          </div>

          <!-- Search & Filter Controls Toolbar -->
          <div class="comm-toolbar" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:12px 16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); width:100%; box-sizing:border-box;">
            <div style="display:flex; gap:10px; align-items:center; flex:1; min-width:260px; flex-wrap:wrap;">
              <div style="position:relative; flex:1; min-width:180px;">
                <input type="text" id="comm-search-input" placeholder="🔍 بحث في السجلات (رقم المحضر، اسم العطاء، المقاول/المناقصين، أمر التكليف، أعضاء اللجنة)..." 
                  oninput="window.unifiedCommitteesManager.onSearch(this.value)" 
                  style="width:100%; padding:8px 36px 8px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc); box-sizing:border-box;" />
                <span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:0.9rem; color:var(--text-muted, #94a3b8);">🔍</span>
              </div>
              <select id="comm-status-select" onchange="window.unifiedCommitteesManager.onStatusChange(this.value)" style="padding:8px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                <option value="">جميع الحالات</option>
                ${this.activeTabMode === 'HANDOVER' ? `
                  <option value="APPROVED">معتمد ومستلم رسمياً</option>
                  <option value="PENDING_COMPLIANCE">مشروط باستدراك نواقص</option>
                  <option value="DRAFT">قيد الإعداد والتدقيق</option>
                  <option value="REJECTED">مرفوض وغير مطابق</option>
                ` : `
                  <option value="RECOMMENDED_AWARD">منسب بإحالته رسمياً</option>
                  <option value="UNDER_EVALUATION">قيد الدراسة والتقييم الفني</option>
                  <option value="AWARDED">تمت المصادقة والإحالة</option>
                  <option value="CANCELLED">عطاء ملغى / معاد طرحه</option>
                `}
              </select>
              <select id="comm-tender-select" onchange="window.unifiedCommitteesManager.onTenderChange(this.value)" style="padding:8px 12px; border:1px solid var(--border, #334155); border-radius:8px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc); max-width:200px;">
                <option value="">كافة العطاءات</option>
                ${this.tendersList.map(t => `<option value="${t.id}">${t.name || t.title || t.id}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Reports Display Cards Container -->
          <div id="committees-content-area">
            <div style="text-align:center; padding:40px; color:var(--text-muted, #94a3b8);">
              <div class="spinner" style="margin:0 auto 12px auto;"></div>
              <div>جاري تحميل البيانات...</div>
            </div>
          </div>

        </div>
      `;

      this.renderKPIs();
    }

    switchMainMode(mode) {
      this.activeTabMode = mode;
      this.render();
      this.initMap();
      if (mode === 'HANDOVER') this.renderReports();
      else this.renderStudies();
    }

    renderKPIs() {
      const container = document.getElementById('comm-kpi-container');
      if (!container) return;

      if (this.activeTabMode === 'HANDOVER') {
        const s = this.stats || { total: 0, initialHandover: 0, finalHandover: 0, punchListCount: 0, totalMembersAssigned: 0 };
        container.innerHTML = `
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(2,132,199,0.15); color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">👥</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.total || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">إجمالي محاضر الاستلام</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(16,185,129,0.15); color:#34d399; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">📑</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.initialHandover || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">محاضر الاستلام الأولي</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(245,158,11,0.15); color:#fbbf24; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">🏆</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.finalHandover || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">محاضر الاستلام النهائي</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(239,68,68,0.15); color:#f87171; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">⚠️</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.punchListCount || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">مشروط باستدراك نواقص</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(139,92,246,0.15); color:#a78bfa; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">👷</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.totalMembersAssigned || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">الأعضاء المكلفون</div>
            </div>
          </div>
        `;
      } else {
        const s = this.stats || {};
        container.innerHTML = `
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(2,132,199,0.15); color:#38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">📊</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.totalStudies || this.studiesData.length || 0}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">محاضر دراسة العطاءات</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(16,185,129,0.15); color:#34d399; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">🏆</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.awardedStudies || 1}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">عطاءات منسب بإحالتها</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(245,158,11,0.15); color:#fbbf24; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">💼</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.totalBidsCount || 3}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">إجمالي العروض المقدمة</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(16,185,129,0.15); color:#34d399; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">💰</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">7.7%</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">متوسط الوفر المالي</div>
            </div>
          </div>
          <div class="stat-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:14px; display:flex; align-items:center; gap:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); box-sizing:border-box;">
            <div style="width:42px; height:42px; border-radius:10px; background:rgba(139,92,246,0.15); color:#a78bfa; display:flex; align-items:center; justify-content:center; font-size:1.35rem; flex-shrink:0;">👷</div>
            <div style="min-width:0;">
              <div style="font-size:1.25rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.2;">${s.totalMembersAssigned || 4}</div>
              <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">أعضاء لجان الدراسة</div>
            </div>
          </div>
        `;
      }
    }

    initMap() {
      const mapEl = document.getElementById('comm-map');
      if (!mapEl) return;

      if (this.map) {
        try { this.map.remove(); } catch(e) {}
        this.map = null;
      }

      this.map = typeof createUnifiedMap === 'function'
        ? createUnifiedMap('comm-map', [32.2985, 35.7050], 14)
        : L.map('comm-map').setView([32.2985, 35.7050], 14);

      if (typeof createUnifiedMap !== 'function') {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© بلدية كفرنجة | OSM', maxZoom: 19
        }).addTo(this.map);
      }

      this.markersLayer = L.layerGroup().addTo(this.map);

      // Add Map Legend for Committees
      const CommLegendControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function() {
          const div = L.DomUtil.create('div', 'leaflet-bar comm-legend-card');
          div.style.backgroundColor = 'var(--bg-card, #1e293b)';
          div.style.border = '1px solid var(--border, #334155)';
          div.style.borderRadius = '10px';
          div.style.padding = '8px 12px';
          div.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
          div.style.fontFamily = "'Tajawal', sans-serif";
          div.style.direction = 'rtl';
          div.style.textAlign = 'right';
          div.style.fontSize = '0.78rem';
          div.style.lineHeight = '1.5';
          div.style.color = 'var(--text, #f8fafc)';
          div.style.backdropFilter = 'blur(8px)';

          div.innerHTML = `
            <div style="font-weight:800; font-size:0.82rem; margin-bottom:5px; color:#38bdf8; border-bottom:1px solid var(--border, #334155); padding-bottom:3px; display:flex; align-items:center; gap:5px;">
              <span>👥</span> <span>دليل مواقع العطاءات واللجان الفنية</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:10px; height:10px; background:#10b981; border-radius:50%; display:inline-block;"></span>
                <span><b>استلام أولي / نهائي معتمد</b></span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="width:10px; height:10px; background:#38bdf8; border-radius:50%; display:inline-block;"></span>
                <span><b>عطاء قيد دراسة وتحليل العروض</b></span>
              </div>
            </div>
          `;
          return div;
        }
      });
      this.map.addControl(new CommLegendControl());

      this.plotTendersOnMap();
      setTimeout(() => this.map?.invalidateSize(), 350);
    }

    plotTendersOnMap() {
      if (!this.map || !this.markersLayer) return;
      this.markersLayer.clearLayers();

      const createCustomPin = (emoji, color) => {
        return L.divIcon({
          className: 'custom-comm-pin',
          html: `<div style="background:${color}; width:34px; height:34px; border-radius:50%; border:2.5px solid #fff; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 3px 10px rgba(0,0,0,0.4);">${emoji}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -18]
        });
      };

      const points = [
        { id: 'T-2026-001', name: 'عطاء تعبيد مدخل كفرنجة الشمالي', lat: 32.3085, lng: 35.7080, cost: '60,000 د.أ', status: 'دراسة عروض منسب بإحالتها' },
        { id: 'ROAD-001', name: 'شارع قلعة كفرنجة الرئيسي', lat: 32.2985, lng: 35.7050, cost: '85,000 د.أ', status: 'كشف فني' },
        { id: 'ROAD-002', name: 'شارع مدرسة الحرس الثانوية', lat: 32.2940, lng: 35.7020, cost: '35,000 د.أ', status: 'قيد التنفيذ' }
      ];

      points.forEach(p => {
        const marker = L.marker([p.lat, p.lng], { icon: createCustomPin('👥', '#10b981') });
        
        const popupContent = `
          <div style="font-family:'Tajawal',sans-serif; direction:rtl; text-align:right; min-width:210px; padding:4px;">
            <div style="font-weight:800; font-size:0.92rem; color:#1e3a8a; margin-bottom:4px;">${p.name}</div>
            <div style="font-size:0.78rem; color:#475569; margin-bottom:6px;">معرف العطاء: <b>${p.id}</b></div>
            <div style="font-size:0.78rem; margin-bottom:4px;">الحالة: <b style="color:#10b981;">${p.status}</b></div>
            <div style="font-size:0.78rem; margin-bottom:8px;">القيمة: <b>${p.cost}</b></div>
            <button onclick="window.unifiedCommitteesManager.openCreateModal()" class="btn btn-sm btn-primary" style="width:100%; justify-content:center; font-size:0.78rem; padding:4px;">
              📑 فتح المحضر المرتبط
            </button>
          </div>
        `;
        marker.bindPopup(popupContent);
        this.markersLayer.addLayer(marker);
      });
    }

    refreshMap() {
      if (this.map) {
        this.map.invalidateSize();
        this.plotTendersOnMap();
      }
    }

    async refreshAll() {
      await Promise.all([this.fetchStats(), this.fetchReports(), this.fetchStudies()]);
      this.renderKPIs();
      if (this.activeTabMode === 'HANDOVER') this.renderReports();
      else this.renderStudies();
      this.refreshMap();
    }

    async fetchStats() {
      try {
        const res = await fetch('/api/v4/committees/stats');
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.stats) {
          this.stats = data.stats;
          this.renderKPIs();
        }
      } catch (e) {}
    }

    async fetchReports() {
      try {
        const params = new URLSearchParams();
        if (this.currentFilter !== 'ALL') params.append('type', this.currentFilter);
        if (this.searchQuery) params.append('search', this.searchQuery);
        if (this.selectedStatus) params.append('status', this.selectedStatus);
        if (this.selectedTenderId) params.append('tenderId', this.selectedTenderId);

        const res = await fetch(`/api/v4/committees?${params.toString()}`);
        if (!res.ok) throw new Error('فشل جلب التقارير');
        this.activeData = await res.json();
        if (this.activeTabMode === 'HANDOVER') this.renderReports();
      } catch (err) {}
    }

    async fetchStudies() {
      try {
        const params = new URLSearchParams();
        if (this.searchQuery) params.append('search', this.searchQuery);
        if (this.selectedStatus) params.append('status', this.selectedStatus);
        if (this.selectedTenderId) params.append('tenderId', this.selectedTenderId);

        const res = await fetch(`/api/v4/committees/studies?${params.toString()}`);
        if (!res.ok) throw new Error('فشل جلب محاضر الدراسة');
        this.studiesData = await res.json();
        if (this.activeTabMode === 'STUDIES') this.renderStudies();
      } catch (err) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: HANDOVER REPORTS CARDS
    // ─────────────────────────────────────────────────────────────────────────
    renderReports() {
      const area = document.getElementById('committees-content-area');
      if (!area) return;

      if (!this.activeData || !this.activeData.length) {
        area.innerHTML = `
          <div style="text-align:center; padding:60px 20px; background:var(--bg-card, #1e293b); border-radius:12px; border:1px dashed var(--border, #334155); color:var(--text-muted, #94a3b8);">
            <div style="font-size:3rem; margin-bottom:12px;">📑</div>
            <div style="font-size:1.1rem; font-weight:bold; color:var(--text, #f8fafc); margin-bottom:6px;">لا توجد تقارير لجان مطابقة</div>
            <div style="font-size:0.85rem;">يمكنك إنشاء محضر استلام جديد أو تشكيل لجنة فنية بتكليف من مدير النظام.</div>
            <button class="btn btn-primary" onclick="window.unifiedCommitteesManager.openReportModal()" style="margin-top:16px; font-weight:bold;">+ إنشاء محضر لجنة الآن</button>
          </div>
        `;
        return;
      }

      const typeLabels = {
        'INITIAL_HANDOVER': { label: 'استلام أولي', color: '#10b981', icon: '📑' },
        'FINAL_HANDOVER': { label: 'استلام نهائي', color: '#0284c7', icon: '🏆' },
        'TECHNICAL_AUDIT': { label: 'كشف وتدقيق فني', color: '#8b5cf6', icon: '🔍' },
        'DEFECT_PUNCHLIST': { label: 'حصر نواقص واستدراك', color: '#f59e0b', icon: '⚠️' },
        'VARIATION_COMMITTEE': { label: 'أوامر تغيير ومواصفات', color: '#ec4899', icon: '💡' }
      };

      const statusBadges = {
        'APPROVED': { label: 'معتمد ومستلم رسمياً', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
        'PENDING_COMPLIANCE': { label: 'مشروط باستدراك نواقص', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
        'DRAFT': { label: 'مسودة قيد التدقيق', bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
        'REJECTED': { label: 'غير مطابق / مرفوض', bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
      };

      area.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${this.activeData.map(r => {
            const tInfo = typeLabels[r.report_type] || { label: 'محضر لجنة', color: '#0284c7', icon: '📋' };
            const sInfo = statusBadges[r.status] || { label: r.status, bg: 'rgba(2,132,199,0.15)', color: '#38bdf8' };
            const members = Array.isArray(r.committee_members) ? r.committee_members : [];

            return `
              <div class="committee-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:transform 0.2s, box-shadow 0.2s; position:relative;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'">
                
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:1.5rem;">${tInfo.icon}</span>
                      <div>
                        <span style="font-weight:bold; font-size:0.78rem; font-family:monospace; color:#38bdf8;">${r.report_number || r.id}</span>
                        <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">${r.inspection_date || '—'}</div>
                      </div>
                    </div>
                    <span style="font-size:0.72rem; font-weight:bold; padding:3px 8px; border-radius:12px; background:${sInfo.bg}; color:${sInfo.color}; border:1px solid ${sInfo.color}40;">
                      ${sInfo.label}
                    </span>
                  </div>

                  <h3 style="font-size:0.95rem; font-weight:800; color:var(--text, #f8fafc); margin:0 0 8px 0; line-height:1.4;">
                    ${r.title}
                  </h3>

                  <div style="font-size:0.78rem; background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:8px 10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>📋 العطاء المرتبط:</span>
                      <b style="color:#38bdf8;">${r.tender_id || 'عام'}</b>
                    </div>
                    <div style="color:var(--text, #f8fafc); font-weight:600; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${r.tender_name}
                    </div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-muted, #94a3b8);">
                      <span>المقاول: <b>${r.contractor || '—'}</b></span>
                      <span>القيمة: <b>${Number(r.project_cost || 0).toLocaleString()} د.أ</b></span>
                    </div>
                  </div>

                  <div style="font-size:0.78rem; margin-bottom:10px; color:var(--text-muted, #94a3b8);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                      <span>📜 أمر تكليف اللجنة:</span>
                      <b style="color:var(--text, #f8fafc);">${r.formation_order_number || 'تكليف رسمي'} (${r.formation_order_date || ''})</b>
                    </div>
                  </div>

                  <!-- Committee Members Preview List -->
                  <div style="margin-bottom:12px;">
                    <div style="font-size:0.78rem; font-weight:bold; color:#38bdf8; margin-bottom:6px; display:flex; align-items:center; gap:4px;">
                      <span>👷</span> <span>أعضاء اللجنة المكلفون (${members.length}):</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; max-height:100px; overflow-y:auto;">
                      ${members.map(m => `
                        <div style="font-size:0.75rem; background:var(--bg, #0f172a); padding:3px 8px; border-radius:6px; border:1px solid var(--border, #334155); display:flex; justify-content:space-between; align-items:center;">
                          <span><b>${m.name}</b> <span style="color:var(--text-muted);">(${m.role || 'عضو لجنة'})</span></span>
                          <span style="font-size:0.7rem; color:#10b981; font-weight:bold;">${m.decision || 'موافق'} ✓</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Recommendation Preview -->
                  <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); line-height:1.4; background:rgba(2,132,199,0.05); padding:8px 10px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border, #334155);">
                    <div style="font-weight:bold; color:#38bdf8; margin-bottom:4px;">قرار وتوصية اللجنة:</div>
                    ${this.formatRecommendationHtml(r.recommendation, true)}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div style="border-top:1px solid var(--border, #334155); padding-top:12px; margin-top:8px; display:flex; gap:6px;">
                  <button class="btn btn-sm btn-primary" onclick="window.unifiedCommitteesManager.printOfficialReport('${r.id}')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:4px; font-weight:bold; font-size:0.78rem;">
                    <span>🖨️</span> <span>طباعة المحضر المعتمد</span>
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.openReportModal('${r.id}')" style="padding:4px 8px; font-size:0.78rem;" title="تعديل وتحديث">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="window.unifiedCommitteesManager.deleteReport('${r.id}')" style="padding:4px 8px; font-size:0.78rem;" title="حذف">
                    🗑️
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: TENDER STUDIES & BIDS EVALUATION CARDS
    // ─────────────────────────────────────────────────────────────────────────
    renderStudies() {
      const area = document.getElementById('committees-content-area');
      if (!area) return;

      if (!this.studiesData || !this.studiesData.length) {
        area.innerHTML = `
          <div style="text-align:center; padding:60px 20px; background:var(--bg-card, #1e293b); border-radius:12px; border:1px dashed var(--border, #334155); color:var(--text-muted, #94a3b8);">
            <div style="font-size:3rem; margin-bottom:12px;">📊</div>
            <div style="font-size:1.1rem; font-weight:bold; color:var(--text, #f8fafc); margin-bottom:6px;">لا توجد محاضر لدراسة العطاءات</div>
            <div style="font-size:0.85rem;">يمكنك إنشاء محضر دراسة وتقييم عروض لعطاء مطروح الآن.</div>
            <button class="btn btn-primary" onclick="window.unifiedCommitteesManager.openStudyModal()" style="margin-top:16px; font-weight:bold;">+ تنظيم محضر دراسة عطاء جديد</button>
          </div>
        `;
        return;
      }

      const statusBadges = {
        'RECOMMENDED_AWARD': { label: 'منسب بالإحالة رسمياً', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
        'UNDER_EVALUATION': { label: 'قيد الدراسة والتقييم الفني', bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
        'AWARDED': { label: 'معتمد ومحال رسمياً', bg: 'rgba(2,132,199,0.15)', color: '#38bdf8' },
        'CANCELLED': { label: 'ملغى / معاد طرحه', bg: 'rgba(239,68,68,0.15)', color: '#f87171' }
      };

      area.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
          ${this.studiesData.map(s => {
            const stInfo = statusBadges[s.status] || { label: s.status, bg: 'rgba(2,132,199,0.15)', color: '#38bdf8' };
            const bids = Array.isArray(s.bids) ? s.bids : [];
            const members = Array.isArray(s.committee_members) ? s.committee_members : [];

            return `
              <div class="committee-card" style="background:var(--bg-card, #1e293b); border:1px solid var(--border, #334155); border-radius:12px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'">
                
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span style="font-size:1.5rem;">📊</span>
                      <div>
                        <span style="font-weight:bold; font-size:0.78rem; font-family:monospace; color:#38bdf8;">${s.report_number || s.id}</span>
                        <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">جلسة: ${s.session_date || '—'}</div>
                      </div>
                    </div>
                    <span style="font-size:0.72rem; font-weight:bold; padding:3px 8px; border-radius:12px; background:${stInfo.bg}; color:${stInfo.color}; border:1px solid ${stInfo.color}40;">
                      ${stInfo.label}
                    </span>
                  </div>

                  <h3 style="font-size:0.95rem; font-weight:800; color:var(--text, #f8fafc); margin:0 0 8px 0; line-height:1.4;">
                    ${s.title}
                  </h3>

                  <div style="font-size:0.78rem; background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:8px; padding:8px 10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span>📋 العطاء:</span>
                      <b style="color:#38bdf8;">${s.tender_id || 'عام'}</b>
                    </div>
                    <div style="color:var(--text, #f8fafc); font-weight:600; margin-bottom:4px;">
                      ${s.tender_name}
                    </div>
                    <div style="display:flex; justify-content:space-between; color:var(--text-muted, #94a3b8);">
                      <span>الكلفة التقديرية: <b>${Number(s.estimated_cost || 0).toLocaleString()} د.أ</b></span>
                      <span>عدد العروض: <b style="color:#38bdf8;">${bids.length} عروض</b></span>
                    </div>
                  </div>

                  <!-- Bids Comparison Summary -->
                  <div style="margin-bottom:12px;">
                    <div style="font-size:0.78rem; font-weight:bold; color:#38bdf8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                      <span>💼 العروض المالية والمناقصون (${bids.length}):</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      ${bids.map((b, idx) => `
                        <div style="font-size:0.75rem; background:var(--bg, #0f172a); padding:4px 8px; border-radius:6px; border:1px solid ${b.recommended ? '#10b981' : 'var(--border, #334155)'}; display:flex; justify-content:space-between; align-items:center;">
                          <div style="display:flex; align-items:center; gap:6px;">
                            <span style="width:18px; height:18px; border-radius:50%; background:${b.recommended ? '#10b981' : 'rgba(255,255,255,0.1)'}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold;">${idx + 1}</span>
                            <span style="font-weight:bold; color:var(--text, #f8fafc);">${b.contractor}</span>
                          </div>
                          <div style="text-align:left;">
                            <b style="color:${b.recommended ? '#34d399' : '#38bdf8'};">${Number(b.bid_value || 0).toLocaleString()} د.أ</b>
                            ${b.recommended ? '<span style="font-size:0.68rem; color:#10b981; display:block; font-weight:bold;">★ العرض الموصى به</span>' : ''}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Committee Recommendation Preview -->
                  <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); line-height:1.4; background:rgba(2,132,199,0.05); padding:8px 10px; border-radius:8px; margin-bottom:8px; border:1px solid var(--border, #334155);">
                    <div style="font-weight:bold; color:#38bdf8; margin-bottom:4px;">توصية لجنة دراسة العطاءات:</div>
                    ${this.formatRecommendationHtml(s.recommendation, true)}
                  </div>
                </div>

                <!-- Action Buttons -->
                <div style="border-top:1px solid var(--border, #334155); padding-top:12px; margin-top:8px; display:flex; gap:6px;">
                  <button class="btn btn-sm btn-primary" onclick="window.unifiedCommitteesManager.printOfficialStudyReport('${s.id}')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:4px; font-weight:bold; font-size:0.78rem;">
                    <span>🖨️</span> <span>طباعة محضر دراسة العروض</span>
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.openStudyModal('${s.id}')" style="padding:4px 8px; font-size:0.78rem;" title="تعديل">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="window.unifiedCommitteesManager.deleteStudy('${s.id}')" style="padding:4px 8px; font-size:0.78rem;" title="حذف">
                    🗑️
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    openCreateModal() {
      if (this.activeTabMode === 'STUDIES') {
        this.openStudyModal();
      } else {
        this.openReportModal();
      }
    }

    switchType(type, btnEl) {
      this.currentFilter = type;
      document.querySelectorAll('.comm-cat-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.fontWeight = 'normal';
        b.style.color = 'var(--text-muted, #94a3b8)';
        b.style.borderColor = 'var(--border, #334155)';
      });
      if (btnEl) {
        btnEl.classList.add('active');
        btnEl.style.background = 'var(--accent, #0284c7)';
        btnEl.style.color = '#ffffff';
        btnEl.style.borderColor = 'var(--accent, #0284c7)';
        btnEl.style.fontWeight = 'bold';
      }

      const statusSelect = document.getElementById('comm-status-select');
      const createBtnText = document.getElementById('comm-create-btn-text');

      if (type === 'TENDER_STUDIES') {
        this.activeTabMode = 'STUDIES';
        if (createBtnText) createBtnText.textContent = 'تنظيم محضر دراسة وتقييم عروض جديد';
        if (statusSelect) {
          statusSelect.innerHTML = `
            <option value="">جميع الحالات</option>
            <option value="RECOMMENDED_AWARD">منسب بإحالته رسمياً</option>
            <option value="UNDER_EVALUATION">قيد الدراسة والتقييم الفني</option>
            <option value="AWARDED">تمت المصادقة والإحالة</option>
            <option value="CANCELLED">عطاء ملغى / معاد طرحه</option>
          `;
        }
        this.renderKPIs();
        this.renderStudies();
      } else {
        this.activeTabMode = 'HANDOVER';
        if (createBtnText) createBtnText.textContent = 'تنظيم محضر استلام جديد';
        if (statusSelect) {
          statusSelect.innerHTML = `
            <option value="">جميع الحالات</option>
            <option value="APPROVED">معتمد ومستلم رسمياً</option>
            <option value="PENDING_COMPLIANCE">مشروط باستدراك نواقص</option>
            <option value="DRAFT">قيد الإعداد والتدقيق</option>
            <option value="REJECTED">مرفوض وغير مطابق</option>
          `;
        }
        this.renderKPIs();
        this.fetchReports();
      }
    }

    onSearch(q) {
      this.searchQuery = q;
      if (this.activeTabMode === 'HANDOVER') this.fetchReports();
      else this.fetchStudies();
    }

    onStatusChange(s) {
      this.selectedStatus = s;
      if (this.activeTabMode === 'HANDOVER') this.fetchReports();
      else this.fetchStudies();
    }

    onTenderChange(tid) {
      this.selectedTenderId = tid;
      if (this.activeTabMode === 'HANDOVER') this.fetchReports();
      else this.fetchStudies();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODAL: CREATE / EDIT TENDER STUDY & BIDS EVALUATION
    // ─────────────────────────────────────────────────────────────────────────
    openStudyModal(id = null) {
      const isEdit = !!id;
      const study = isEdit ? this.studiesData.find(s => String(s.id) === String(id)) : null;

      let modal = document.getElementById('comm-report-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'comm-report-modal';
        modal.className = 'umw-modal-overlay';
        document.body.appendChild(modal);
      }

      const defaultBids = study?.bids?.length ? study.bids : [
        { contractor: 'شركة الأمل للمقاولات الإنشائية', bid_value: 60000, bid_bond_valid: true, bid_bond_details: 'كفالة بنك الإسكان رقم 45892 بقيمة 3,000 د.أ', tech_compliance: 'مطابق', notes: 'العرض الأنسب والأقل سعراً', recommended: true },
        { contractor: 'مؤسسة اليرموك للمقاولات العامة', bid_value: 63500, bid_bond_valid: true, bid_bond_details: 'كفالة البنك العربي رقم 78110 بقيمة 3,000 د.أ', tech_compliance: 'مطابق', notes: 'عرض مطابق فنياً ولكنه أعلى سعراً', recommended: false },
        { contractor: 'شركة عجلون للإنشاءات الهندسية', bid_value: 58000, bid_bond_valid: false, bid_bond_details: 'كفالة غير مكتملة المدة', tech_compliance: 'غير مطابق', notes: 'مستبعد لعدم استيفاء كفالة الدخول بالعطاء', recommended: false }
      ];

      const defaultMembers = study?.committee_members?.length ? study.committee_members : [
        { name: 'م. سامر الفريحات', role: 'رئيس لجنة دراسة العطاءات', decision: 'موافق' },
        { name: 'م. أحمد الشويات', role: 'عضو فني ومقرر', decision: 'موافق' },
        { name: 'السيد خلدون النواطير', role: 'عضو - المالي واللوازم', decision: 'موافق' },
        { name: 'مندوب ديوان المحاسبة', role: 'عضو رقابي', decision: 'موافق' }
      ];

      let recIntro = 'بعد فتح العروض ودراسة وتحليل الأسعار المقدمة ومطابقتها مع جداول الكميات والكلفة التقديرية وفحص الكفالات البنكية والتأهيل الفني، قررت لجنة دراسة العطاءات ما يلي:';
      let recPoints = [
        'استبعاد العروض غير المستوفية للشروط الإجرائية أو كفالات الدخول بالعطاء المعتمدة.',
        'التنسيب بالموافقة على إحالة العطاء على المناقص الأنسب والأقل سعراً المطابق للمواصفات.',
        'رفع المحضر لعطوفة رئيس البلدية والمجلس البلدي للمصادقة وتوقيع اتفاقية العقد.'
      ];

      if (study && study.recommendation) {
        const raw = study.recommendation.trim();
        if (raw.includes('\n')) {
          const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 1 && !lines[0].match(/^[0-9]+[-\.\)]|^[-•*]/)) {
            recIntro = lines[0];
            recPoints = lines.slice(1).map(l => l.replace(/^[0-9]+[-\.\)]\s*|^[-•*]\s*/, ''));
          } else {
            recPoints = lines.map(l => l.replace(/^[0-9]+[-\.\)]\s*|^[-•*]\s*/, ''));
          }
        }
      }

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); border-radius:16px; border:1px solid var(--border, #334155); width:100%; max-width:860px; box-shadow:0 25px 60px rgba(0,0,0,0.5); overflow:hidden; font-family:'Tajawal', sans-serif; direction:rtl; animation:fadeIn 0.2s ease; color:var(--text, #f8fafc);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:1.1rem;">
                <span>📊</span> <span>${isEdit ? `تعديل محضر دراسة العطاء: ${study.id}` : 'تنظيم محضر دراسة وتحليل عروض العطاءات'}</span>
              </div>
              <div style="font-size:0.78rem; opacity:0.85; margin-top:2px;">لجنة فتح المظاريف وتحليل العروض المالية والفنية</div>
            </div>
            <button onclick="document.getElementById('comm-report-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
          </div>

          <!-- Fast Subtype Switcher Bar -->
          <div style="background:rgba(2,132,199,0.1); border-bottom:1px solid var(--border, #334155); padding:8px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem; font-weight:bold; color:#38bdf8;">🔄 نوع المحضر المفتوح:</div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.openReportModal()" style="font-size:0.75rem; padding:3px 10px; border-radius:14px;">📑 التبديل لمحضر استلام فني</button>
              <button type="button" class="btn btn-sm btn-primary" style="font-size:0.75rem; padding:3px 10px; border-radius:14px; pointer-events:none;">📊 محضر دراسة وتقييم عروض (محدد)</button>
            </div>
          </div>

          <form id="comm-study-form" onsubmit="window.unifiedCommitteesManager.submitStudy(event, '${id || ''}')" style="padding:20px; max-height:80vh; overflow-y:auto;">
            
            <!-- Tender & Session Info Section -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span>📋</span> <span>بيانات العطاء وجلسة فتح العروض المالية والفنية:</span>
              </div>
              
              <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:12px; margin-bottom:10px;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">العطاء المطروح <span style="color:#ef4444;">*</span></label>
                  <select id="study-form-tender-id" onchange="window.unifiedCommitteesManager.onStudyTenderSelect(this.value)" required 
                    style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                    <option value="">-- اختر من قائمة العطاءات --</option>
                    ${this.tendersList.map(t => `
                      <option value="${t.id}" ${study?.tender_id === t.id ? 'selected' : ''}>${t.id} - ${t.name || t.title}</option>
                    `).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">الكلفة التقديرية المعتمدة (د.أ)</label>
                  <input type="number" id="study-form-cost" value="${study?.estimated_cost || 65000}" 
                    style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">تاريخ جلسة فتح ودراسة العروض</label>
                  <input type="date" id="study-form-date" value="${study?.session_date || new Date().toISOString().split('T')[0]}" 
                    style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1.8fr 1fr 1fr; gap:12px;">
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">عنوان المحضر الرسمي</label>
                  <input type="text" id="study-form-title" value="${study?.title || ''}" placeholder="محضر دراسة وتحليل عروض..." 
                    style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">أمر التكليف (مدير النظام)</label>
                  <input type="text" id="study-form-order-no" value="${study?.formation_order_number || `ت/أش/${new Date().getFullYear()}/110`}" 
                    style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">حالة قرار التنسيب</label>
                  <select id="study-form-status" style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                    <option value="RECOMMENDED_AWARD" ${study?.status === 'RECOMMENDED_AWARD' ? 'selected' : ''}>منسب بإحالته رسمياً</option>
                    <option value="UNDER_EVALUATION" ${study?.status === 'UNDER_EVALUATION' ? 'selected' : ''}>قيد الدراسة والتقييم الفني</option>
                    <option value="AWARDED" ${study?.status === 'AWARDED' ? 'selected' : ''}>معتمد ومحال رسمياً</option>
                    <option value="CANCELLED" ${study?.status === 'CANCELLED' ? 'selected' : ''}>عطاء ملغى / معاد طرحه</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Bids Comparison & Offers Table Section -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <span>💼</span> <span>جدول تفريغ ومقارنة عروض المناقصين (المالية والفنية والكفالات):</span>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.addBidRow()" style="font-size:0.75rem; padding:3px 10px; font-weight:bold;">
                  ➕ إضافة عرض مناقص جديد
                </button>
              </div>

              <div id="study-bids-container" style="display:flex; flex-direction:column; gap:10px;">
                ${defaultBids.map((b, idx) => `
                  <div class="study-bid-row" style="background:var(--bg-card, #1e293b); padding:10px 12px; border-radius:8px; border:1px solid ${b.recommended ? '#10b981' : 'var(--border, #334155)'};">
                    <div style="display:grid; grid-template-columns:2fr 1.2fr 1.2fr 1.2fr 1fr 28px; gap:8px; align-items:center; margin-bottom:6px;">
                      <div>
                        <label style="font-size:0.7rem; color:var(--text-muted); display:block;">اسم المقاول / الشركة</label>
                        <input type="text" class="bid-contractor" value="${b.contractor}" placeholder="اسم المقاول..." required 
                          style="width:100%; padding:5px 8px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc); box-sizing:border-box;" />
                      </div>
                      <div>
                        <label style="font-size:0.7rem; color:var(--text-muted); display:block;">قيمة العرض (د.أ)</label>
                        <input type="number" class="bid-value" value="${b.bid_value}" placeholder="المبلغ..." required 
                          style="width:100%; padding:5px 8px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:#38bdf8; font-weight:bold; box-sizing:border-box;" />
                      </div>
                      <div>
                        <label style="font-size:0.7rem; color:var(--text-muted); display:block;">الكفالة البنكية</label>
                        <select class="bid-bond" style="width:100%; padding:5px 6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.78rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                          <option value="true" ${b.bid_bond_valid ? 'selected' : ''}>كفالة سارية ومكتملة ✓</option>
                          <option value="false" ${!b.bid_bond_valid ? 'selected' : ''}>كفالة غير مكتملة ✕</option>
                        </select>
                      </div>
                      <div>
                        <label style="font-size:0.7rem; color:var(--text-muted); display:block;">التقييم الفني</label>
                        <select class="bid-compliance" style="width:100%; padding:5px 6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.78rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                          <option value="مطابق" ${b.tech_compliance === 'مطابق' ? 'selected' : ''}>مطابق للمواصفات ✓</option>
                          <option value="غير مطابق" ${b.tech_compliance === 'غير مطابق' ? 'selected' : ''}>غير مطابق ✕</option>
                        </select>
                      </div>
                      <div style="display:flex; align-items:flex-end; height:100%; padding-bottom:6px;">
                        <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; color:#10b981; font-weight:bold; cursor:pointer;">
                          <input type="checkbox" class="bid-recommended" ${b.recommended ? 'checked' : ''} /> ★ موصى به
                        </label>
                      </div>
                      <div style="display:flex; align-items:flex-end; justify-content:center; height:100%; padding-bottom:6px;">
                        <button type="button" onclick="this.closest('.study-bid-row').remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:1.1rem;" title="حذف العرض">✕</button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Committee Members Section -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <span>👷</span> <span>أعضاء لجنة دراسة العطاءات وفتح العروض المكلفون رسمياً:</span>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.addMemberRow()" style="font-size:0.75rem; padding:3px 8px;">
                  + إضافة عضو جديد
                </button>
              </div>

              <div id="comm-members-container" style="display:flex; flex-direction:column; gap:8px;">
                ${defaultMembers.map(m => `
                  <div class="comm-member-row" style="display:grid; grid-template-columns:1.5fr 1.5fr 1fr 28px; gap:8px; align-items:center; background:var(--bg-card, #1e293b); padding:8px; border-radius:6px; border:1px solid var(--border, #334155);">
                    <input type="text" class="mem-name" value="${m.name}" placeholder="اسم العضو المكلف..." required 
                      style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                    <input type="text" class="mem-role" value="${m.role || 'عضو لجنة'}" placeholder="الصفة باللجنة..." 
                      style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                    <select class="mem-decision" style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                      <option value="موافق" selected>موافق ✓</option>
                      <option value="متحفظ">متحفظ ⚠️</option>
                      <option value="غير موافق">غير موافق ✕</option>
                    </select>
                    <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Structured Recommendation (Intro + Points) -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>📝</span> <span>توصية وقرار لجنة دراسة العطاءات (مقدمة + نقاط مرقمة):</span>
              </div>
              
              <div style="margin-bottom:10px;">
                <label style="display:block; font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:3px;">
                  1. ديباجة ومقدمة القرار والتنسيب:
                </label>
                <textarea id="study-form-rec-intro" rows="2" required 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.83rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc); resize:vertical;">${recIntro}</textarea>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">
                    2. بنود وقرارات التنسيب بالإحالة (نقاط مرقمة):
                  </label>
                  <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.addRecPointRow()" style="font-size:0.72rem; padding:2px 8px;">
                    + إضافة نقطة جديدة
                  </button>
                </div>

                <div id="comm-rec-points-container" style="display:flex; flex-direction:column; gap:6px;">
                  ${recPoints.map((pt, idx) => `
                    <div class="comm-rec-point-row" style="display:flex; align-items:center; gap:8px;">
                      <span class="rec-pt-num" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:bold; font-size:0.75rem; flex-shrink:0;">
                        ${idx + 1}
                      </span>
                      <input type="text" class="rec-pt-text" value="${pt}" required 
                        style="flex:1; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                      <button type="button" onclick="window.unifiedCommitteesManager.removeRecPointRow(this)" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:1rem;">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border, #334155); padding-top:14px;">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('comm-report-modal').style.display='none'">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="font-weight:bold;">💾 حفظ وتوثيق محضر دراسة العطاء</button>
            </div>

          </form>

        </div>
      `;

      modal.style.display = 'flex';
    }

    addBidRow() {
      const container = document.getElementById('study-bids-container');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'study-bid-row';
      div.style.cssText = 'display:grid; grid-template-columns:2fr 1.2fr 1fr 1fr 28px; gap:8px; align-items:center; background:var(--bg-card, #1e293b); padding:8px; border-radius:6px; border:1px solid var(--border, #334155);';
      div.innerHTML = `
        <input type="text" class="bid-contractor" placeholder="اسم المقاول / المناقص..." required 
          style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        <input type="number" class="bid-value" placeholder="قيمة العرض (د.أ)..." required 
          style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        <select class="bid-compliance" style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
          <option value="مطابق" selected>مطابق فنياً ✓</option>
          <option value="غير مطابق">غير مطابق ✕</option>
        </select>
        <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; color:#10b981; font-weight:bold; cursor:pointer;">
          <input type="checkbox" class="bid-recommended" /> موصى به
        </label>
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">✕</button>
      `;
      container.appendChild(div);
    }

    onStudyTenderSelect(tid) {
      const t = this.tendersList.find(x => x.id === tid);
      if (t) {
        document.getElementById('study-form-cost').value = t.value || t.budget || 0;
        const titleInput = document.getElementById('study-form-title');
        if (!titleInput.value || titleInput.value.includes('محضر')) {
          titleInput.value = `محضر دراسة وتقييم عروض - ${t.name || t.title}`;
        }
      }
    }

    async submitStudy(e, id) {
      e.preventDefault();
      const isEdit = !!id;

      const bidRows = document.querySelectorAll('.study-bid-row');
      const bids = Array.from(bidRows).map((row, idx) => ({
        contractor: row.querySelector('.bid-contractor')?.value || '',
        bid_value: Number(row.querySelector('.bid-value')?.value || 0),
        tech_compliance: row.querySelector('.bid-compliance')?.value || 'مطابق',
        recommended: row.querySelector('.bid-recommended')?.checked || false,
        rank: idx + 1
      })).filter(b => b.contractor.trim());

      const memberRows = document.querySelectorAll('.comm-member-row');
      const committee_members = Array.from(memberRows).map(row => ({
        name: row.querySelector('.mem-name')?.value || '',
        role: row.querySelector('.mem-role')?.value || 'عضو لجنة',
        decision: row.querySelector('.mem-decision')?.value || 'موافق'
      })).filter(m => m.name.trim());

      const intro = document.getElementById('study-form-rec-intro')?.value.trim() || '';
      const pointInputs = document.querySelectorAll('.comm-rec-point-row .rec-pt-text');
      const points = Array.from(pointInputs).map(inp => inp.value.trim()).filter(Boolean);

      let fullRecommendation = intro;
      if (points.length > 0) {
        const formattedPts = points.map((pt, i) => `${i + 1}- ${pt}`).join('\n');
        fullRecommendation = intro ? `${intro}\n${formattedPts}` : formattedPts;
      }

      const tid = document.getElementById('study-form-tender-id').value;
      const tObj = this.tendersList.find(x => x.id === tid);

      const payload = {
        title: document.getElementById('study-form-title').value,
        tender_id: tid,
        tender_name: tObj ? (tObj.name || tObj.title) : 'عطاء مشاريع هندسية',
        estimated_cost: document.getElementById('study-form-cost').value,
        formation_order_number: document.getElementById('study-form-order-no').value,
        session_date: document.getElementById('study-form-date').value,
        status: document.getElementById('study-form-status').value,
        recommendation: fullRecommendation,
        bids,
        committee_members
      };

      try {
        const url = isEdit ? `/api/v4/committees/studies/${id}` : '/api/v4/committees/studies';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل حفظ محضر الدراسة');

        alert('✅ ' + (data.message || 'تم حفظ وتوثيق محضر دراسة العطاء بنجاح'));
        document.getElementById('comm-report-modal').style.display = 'none';

        this.fetchStats();
        this.fetchStudies();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    async deleteStudy(id) {
      if (!confirm(`هل أنت متأكد من حذف محضر دراسة العطاء رقم (${id}) نهائياً؟`)) return;
      try {
        const res = await fetch(`/api/v4/committees/studies/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل الحذف');
        alert('✅ ' + data.message);
        this.fetchStats();
        this.fetchStudies();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OFFICIAL PRINT: TENDER STUDY & BIDS EVALUATION REPORT
    // ─────────────────────────────────────────────────────────────────────────
    printOfficialStudyReport(id) {
      const study = this.studiesData.find(s => String(s.id) === String(id));
      if (!study) return;

      const bids = Array.isArray(study.bids) ? study.bids : [];
      const members = Array.isArray(study.committee_members) ? study.committee_members : [];

      const bidsTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:8px; text-align:right; font-size:0.83rem;">
          <thead>
            <tr style="background:#1e3a8a; color:#ffffff;">
              <th style="padding:6px; text-align:center; width:30px;">#</th>
              <th style="padding:6px;">اسم المقاول / المناقص</th>
              <th style="padding:6px; text-align:center; width:110px;">قيمة العرض (د.أ)</th>
              <th style="padding:6px; text-align:center; width:100px;">التقييم الفني</th>
              <th style="padding:6px; text-align:center; width:120px;">التنسيب والقرار</th>
            </tr>
          </thead>
          <tbody>
            ${bids.map((b, i) => `
              <tr style="border-bottom:1px solid #cbd5e1; background:${b.recommended ? '#ecfdf5' : '#ffffff'};">
                <td style="padding:6px; text-align:center; font-weight:bold;">${i + 1}</td>
                <td style="padding:6px; font-weight:bold; color:#0f172a;">${b.contractor}</td>
                <td style="padding:6px; text-align:center; font-weight:bold; color:${b.recommended ? '#059669' : '#0284c7'};">${Number(b.bid_value || 0).toLocaleString()} د.أ</td>
                <td style="padding:6px; text-align:center; font-weight:bold; color:${b.tech_compliance === 'مطابق' ? '#10b981' : '#ef4444'};">${b.tech_compliance || 'مطابق'}</td>
                <td style="padding:6px; text-align:center; font-weight:bold; color:${b.recommended ? '#059669' : '#64748b'};">${b.recommended ? '★ موصى بالإحالة' : 'مستبعد / سعر أعلى'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      const membersTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:10px; text-align:right; font-size:0.83rem;">
          <thead>
            <tr style="background:#1e3a8a; color:#ffffff;">
              <th style="padding:6px; text-align:center; width:35px;">#</th>
              <th style="padding:6px; width:180px;">اسم عضو اللجنة المكلف</th>
              <th style="padding:6px;">الصفة / الدور باللجنة</th>
              <th style="padding:6px; text-align:center; width:90px;">قرار العضو</th>
              <th style="padding:6px; text-align:center; width:120px;">التوقيع الرسمي</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((m, i) => `
              <tr style="border-bottom:1px solid #cbd5e1;">
                <td style="padding:6px; text-align:center; font-weight:bold;">${i + 1}</td>
                <td style="padding:6px; font-weight:bold; color:#0f172a;">${m.name}</td>
                <td style="padding:6px; color:#475569;">${m.role || 'عضو لجنة'}</td>
                <td style="padding:6px; text-align:center; font-weight:bold; color:#10b981;">${m.decision || 'موافق'} ✓</td>
                <td style="padding:6px; text-align:center; color:#94a3b8;">........................</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: 'محضر دراسة وتحليل عروض العطاء',
          subtitle: `مشروع: ${study.tender_name} (${study.tender_id || 'عام'})`,
          refNumber: study.report_number || study.id,
          date: study.session_date || new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'رقم المحضر الرسمي', value: study.report_number || study.id },
            { label: 'العطاء المطروح', value: `${study.tender_name} (${study.tender_id || '-'})` },
            { label: 'الكلفة التقديرية المعتمدة', value: `${Number(study.estimated_cost || 0).toLocaleString()} دينار أردني` },
            { label: 'أمر تكليف اللجنة (مدير النظام)', value: `${study.formation_order_number || 'تكليف رسمي'} بتاريخ ${study.formation_order_date || '—'}` },
            { label: 'تاريخ جلسة فتح ودراسة العروض', value: study.session_date || '—' },
            { label: 'إجمالي العروض المالية المقدمة', value: `${bids.length} عروض مناقصين` }
          ],
          summaryHtml: `
            <!-- 🗺️ الخريطة الجغرافية ومسار العطاء بالطبقة المحددة -->
            <div style="margin: 12px 0 16px 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f8fafc; page-break-inside: avoid;">
              <div style="background: #1e3a8a; color: #ffffff; padding: 7px 12px; font-size: 0.82rem; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span>🗺️</span> <span>المخطط الجغرافي وموقع الأعمال الميدانية للعطاء (نظام GIS بلدية كفرنجة)</span>
                </div>
                <span style="font-size:0.75rem; background:rgba(255,255,255,0.22); padding:2px 8px; border-radius:10px;">الطبقة المحددة: مسار التعبيد والأصول الهندسية</span>
              </div>
              
              <div id="print-study-gis-map" style="height: 190px; width: 100%; position: relative; background: #e2e8f0;"></div>

              <div style="padding: 6px 12px; background: #f1f5f9; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 0.74rem; color: #334155; font-weight: 600;">
                <span>📍 <b>الموقع:</b> ${study.tender_name} (${study.tender_id || 'عام'})</span>
                <span>🌐 <b>الإحداثيات:</b> 32.3085° N, 35.7080° E</span>
                <span>🛣️ <b>الكلفة التقديرية:</b> ${Number(study.estimated_cost || 0).toLocaleString()} د.أ</span>
              </div>
            </div>

            <script>
              setTimeout(function() {
                try {
                  if (typeof L !== 'undefined' && document.getElementById('print-study-gis-map')) {
                    var sMap = L.map('print-study-gis-map', {
                      zoomControl: false,
                      attributionControl: false,
                      dragging: false,
                      touchZoom: false,
                      scrollWheelZoom: false,
                      doubleClickZoom: false
                    }).setView([32.3085, 35.7080], 14);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(sMap);

                    var pIcon = L.divIcon({
                      html: '<div style="background:#0284c7; width:30px; height:30px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:15px; box-shadow:0 3px 8px rgba(0,0,0,0.4);">📊</div>',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });

                    L.marker([32.3085, 35.7080], { icon: pIcon }).addTo(sMap);
                    L.polyline([[32.3040, 35.7040], [32.3065, 35.7065], [32.3085, 35.7080], [32.3115, 35.7098]], { color: '#0284c7', weight: 6, opacity: 0.9 }).addTo(sMap);
                  }
                } catch(e) {}
              }, 120);
            </script>

            <div style="margin-top:14px;">
              <h4 style="color:#1e3a8a; margin:0 0 6px 0; font-size:0.92rem; font-weight:800;">جدول تفريغ ومقارنة العروض المالية والفنية:</h4>
              ${bidsTableHtml}
            </div>

            <div style="margin-top:14px;">
              <h4 style="color:#1e3a8a; margin:0 0 6px 0; font-size:0.92rem; font-weight:800;">قرار وتوصية لجنة دراسة العطاءات:</h4>
              <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px; font-size:0.88rem; line-height:1.6; color:#0f172a;">
                ${this.formatRecommendationHtml(study.recommendation, false)}
              </div>
            </div>

            <div style="margin-top:16px;">
              <h4 style="color:#1e3a8a; margin:0 0 6px 0; font-size:0.92rem; font-weight:800;">أعضاء لجنة دراسة العطاءات وتواقيعهم الرسمية:</h4>
              ${membersTableHtml}
            </div>
          `,
          customWorkflow: [
            {
              order: 1,
              key: 'DIRECTOR',
              stageTitle: 'الاعتماد والمصادقة الرسمية',
              roleName: 'مدير الأشغال والخدمات الهندسية',
              icon: '✅',
              signLabel: 'التوقيع والاعتماد الرسمي',
              isFinal: true
            }
          ],
          signatures: true
        });
      } else {
        window.print();
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODAL: CREATE / EDIT HANDOVER REPORT
    // ─────────────────────────────────────────────────────────────────────────
    openReportModal(id = null) {
      const isEdit = !!id;
      const report = isEdit ? this.activeData.find(r => String(r.id) === String(id)) : null;

      let modal = document.getElementById('comm-report-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'comm-report-modal';
        modal.className = 'umw-modal-overlay';
        document.body.appendChild(modal);
      }

      const defaultMembers = report?.committee_members?.length ? report.committee_members : [
        { name: 'م. سامر الفريحات', role: 'رئيس اللجنة الفنية للاستلام', decision: 'موافق' },
        { name: 'م. أحمد الشويات', role: 'عضو فني ومقرر', decision: 'موافق' },
        { name: 'م. رامي القضاة', role: 'عضو فني باللجنة', decision: 'موافق' }
      ];

      let recIntro = 'بعد الكشف والمعاينة الميدانية لموقع العطاء وإجراء الفحوصات الفنية لعينات الأسفلت ونسب الدمك المخبرية، قررت اللجنة الفنية ما يلي:';
      let recPoints = [
        'الاستلام الأولي للمشروع ومطابقة الأعمال المنجزة للمواصفات الفنية المعتمدة وجداول الكميات.',
        'سريان فترة الصيانة والضمان التعاقدية لمدة 12 شهراً اعتباراً من تاريخ توقيع هذا المحضر.'
      ];

      if (report && report.recommendation) {
        const raw = report.recommendation.trim();
        if (raw.includes('\n')) {
          const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 1 && !lines[0].match(/^[0-9]+[-\.\)]|^[-•*]/)) {
            recIntro = lines[0];
            recPoints = lines.slice(1).map(l => l.replace(/^[0-9]+[-\.\)]\s*|^[-•*]\s*/, ''));
          } else {
            recPoints = lines.map(l => l.replace(/^[0-9]+[-\.\)]\s*|^[-•*]\s*/, ''));
          }
        }
      }

      modal.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); border-radius:16px; border:1px solid var(--border, #334155); width:100%; max-width:780px; box-shadow:0 25px 60px rgba(0,0,0,0.5); overflow:hidden; font-family:'Tajawal', sans-serif; direction:rtl; animation:fadeIn 0.2s ease; color:var(--text, #f8fafc);">
          
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:1.05rem;">
              <span>👥</span> <span>${isEdit ? `تعديل محضر اللجنة: ${report.id}` : 'تنظيم محضر لجنة واستلام فني جديد'}</span>
            </div>
            <button onclick="document.getElementById('comm-report-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.2rem; cursor:pointer;">✕</button>
          </div>

          <!-- Fast Subtype Switcher Bar -->
          <div style="background:rgba(2,132,199,0.1); border-bottom:1px solid var(--border, #334155); padding:8px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem; font-weight:bold; color:#38bdf8;">🔄 نوع المحضر المراد تنظيمه:</div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-sm btn-primary" style="font-size:0.75rem; padding:3px 10px; border-radius:14px; pointer-events:none;">📑 محضر استلام فني (محدد)</button>
              <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.openStudyModal()" style="font-size:0.75rem; padding:3px 10px; border-radius:14px; background:rgba(2,132,199,0.15); color:#38bdf8; font-weight:bold;">📊 محضر دراسة وتقييم عروض العطاءات ⬅</button>
            </div>
          </div>

          <form id="comm-report-form" onsubmit="window.unifiedCommitteesManager.submitReport(event, '${id || ''}')" style="padding:20px; max-height:82vh; overflow-y:auto;">
            
            <!-- Tender Linking Section -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span>📋</span> <span>ربط المحضر بالعطاء والمشروع الهندسي:</span>
              </div>
              
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">اختر العطاء المرتبط <span style="color:#ef4444;">*</span></label>
                  <select id="comm-form-tender-id" onchange="window.unifiedCommitteesManager.onTenderSelect(this.value)" required 
                    style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                    <option value="">-- اختر من قائمة العطاءات --</option>
                    ${this.tendersList.map(t => `
                      <option value="${t.id}" ${report?.tender_id === t.id ? 'selected' : ''}>${t.id} - ${t.name || t.title}</option>
                    `).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">نوع التقرير / المحضر <span style="color:#ef4444;">*</span></label>
                  <select id="comm-form-type" onchange="if(this.value==='TENDER_STUDY') window.unifiedCommitteesManager.openStudyModal();" required style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);">
                    <option value="INITIAL_HANDOVER" ${report?.report_type === 'INITIAL_HANDOVER' ? 'selected' : ''}>📑 محضر استلام أولي</option>
                    <option value="FINAL_HANDOVER" ${report?.report_type === 'FINAL_HANDOVER' ? 'selected' : ''}>🏆 محضر استلام نهائي</option>
                    <option value="TECHNICAL_AUDIT" ${report?.report_type === 'TECHNICAL_AUDIT' ? 'selected' : ''}>🔍 تقرير كشف ومعاينة فنية</option>
                    <option value="DEFECT_PUNCHLIST" ${report?.report_type === 'DEFECT_PUNCHLIST' ? 'selected' : ''}>⚠️ تقرير حصر نواقص واستدراك</option>
                    <option value="VARIATION_COMMITTEE" ${report?.report_type === 'VARIATION_COMMITTEE' ? 'selected' : ''}>💡 محضر لجنة أوامر تغيير</option>
                    <option value="TENDER_STUDY" style="color:#38bdf8; font-weight:bold;">📊 محضر دراسة وتقييم عروض العطاءات ⬅</option>
                  </select>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px;">
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">اسم العطاء / المشروع</label>
                  <input type="text" id="comm-form-tender-name" value="${report?.tender_name || ''}" placeholder="اسم العطاء..." 
                    style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">المقاول المنفذ</label>
                  <input type="text" id="comm-form-contractor" value="${report?.contractor || ''}" placeholder="اسم المقاول..." 
                    style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">قيمة العقد (د.أ)</label>
                  <input type="number" id="comm-form-cost" value="${report?.project_cost || 0}" 
                    style="width:100%; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                </div>
              </div>
            </div>

            <!-- Report Info & Formation Order -->
            <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:12px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">عنوان التقرير <span style="color:#ef4444;">*</span></label>
                <input type="text" id="comm-form-title" value="${report?.title || ''}" required placeholder="مثال: محضر استلام أولي لعطاء التعبيد..." 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">رقم أمر التكليف (مدير النظام)</label>
                <input type="text" id="comm-form-order-no" value="${report?.formation_order_number || `ت/أش/${new Date().getFullYear()}/145`}" 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">تاريخ الكشف والمعاينة</label>
                <input type="date" id="comm-form-inspection-date" value="${report?.inspection_date || new Date().toISOString().split('T')[0]}" 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
              </div>
            </div>

            <!-- Committee Members Dynamic Assignment Section -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <span>👷</span> <span>تشكيل وتكليف أعضاء اللجنة الفنية للاستلام:</span>
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.addMemberRow()" style="font-size:0.75rem; padding:3px 8px;">
                  + إضافة عضو جديد
                </button>
              </div>

              <div id="comm-members-container" style="display:flex; flex-direction:column; gap:8px;">
                ${defaultMembers.map((m, idx) => `
                  <div class="comm-member-row" style="display:grid; grid-template-columns:1.5fr 1.5fr 1fr 28px; gap:8px; align-items:center; background:var(--bg-card, #1e293b); padding:8px; border-radius:6px; border:1px solid var(--border, #334155);">
                    <input type="text" class="mem-name" value="${m.name}" placeholder="اسم العضو المكلف..." required 
                      style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                    <input type="text" class="mem-role" value="${m.role || 'عضو فني باللجنة'}" placeholder="الصفة / الدور باللجنة..." 
                      style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
                    <select class="mem-decision" style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                      <option value="موافق" ${m.decision === 'موافق' ? 'selected' : ''}>موافق ✓</option>
                      <option value="متحفظ" ${m.decision === 'متحفظ' ? 'selected' : ''}>متحفظ ⚠️</option>
                      <option value="غير موافق" ${m.decision === 'غير موافق' ? 'selected' : ''}>غير موافق ✕</option>
                    </select>
                    <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;" title="حذف">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Structured Recommendation (Intro + Points) -->
            <div style="background:var(--bg, #0f172a); border:1px solid var(--border, #334155); border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="font-weight:bold; font-size:0.88rem; color:#38bdf8; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>📝</span> <span>قرار وتوصية اللجنة الفنية (مقدمة + نقاط مرقمة):</span>
              </div>
              
              <div style="margin-bottom:10px;">
                <label style="display:block; font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:3px;">
                  1. ديباجة ومقدمة القرار:
                </label>
                <textarea id="comm-form-rec-intro" rows="2" required placeholder="أدخل مقدمة القرار..." 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.83rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc); resize:vertical;">${recIntro}</textarea>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <label style="font-size:0.78rem; font-weight:bold; color:var(--text-muted);">
                    2. بنود وقرارات اللجنة (على شكل نقاط مرقمة):
                  </label>
                  <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedCommitteesManager.addRecPointRow()" style="font-size:0.72rem; padding:2px 8px;">
                    + إضافة نقطة جديدة
                  </button>
                </div>

                <div id="comm-rec-points-container" style="display:flex; flex-direction:column; gap:6px;">
                  ${recPoints.map((pt, idx) => `
                    <div class="comm-rec-point-row" style="display:flex; align-items:center; gap:8px;">
                      <span class="rec-pt-num" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:bold; font-size:0.75rem; flex-shrink:0;">
                        ${idx + 1}
                      </span>
                      <input type="text" class="rec-pt-text" value="${pt}" placeholder="أدخل نص البند / النقطة..." required 
                        style="flex:1; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
                      <button type="button" onclick="window.unifiedCommitteesManager.removeRecPointRow(this)" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:1rem;" title="حذف النقطة">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>

            </div>

            <!-- Status & Lab Tests -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">حالة الاعتماد</label>
                <select id="comm-form-status" style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
                  <option value="APPROVED" ${report?.status === 'APPROVED' ? 'selected' : ''}>معتمد ومستلم رسمياً</option>
                  <option value="PENDING_COMPLIANCE" ${report?.status === 'PENDING_COMPLIANCE' ? 'selected' : ''}>مشروط باستدراك نواقص</option>
                  <option value="DRAFT" ${report?.status === 'DRAFT' ? 'selected' : ''}>مسودة قيد التدقيق</option>
                  <option value="REJECTED" ${report?.status === 'REJECTED' ? 'selected' : ''}>غير مطابق / مرفوض</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px;">نتائج الفحوصات المخبرية وضبط الجودة</label>
                <input type="text" id="comm-form-tests" value="${report?.lab_tests || 'فحص الكثافة الحقلية 98% - فحص كسر المكعبات الخرسانية مطابق'}" 
                  style="width:100%; padding:8px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.85rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border, #334155); padding-top:14px;">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('comm-report-modal').style.display='none'">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="font-weight:bold;">💾 حفظ واعتماد المحضر</button>
            </div>

          </form>

        </div>
      `;

      modal.style.display = 'flex';
    }

    addRecPointRow() {
      const container = document.getElementById('comm-rec-points-container');
      if (!container) return;
      const count = container.querySelectorAll('.comm-rec-point-row').length + 1;
      const div = document.createElement('div');
      div.className = 'comm-rec-point-row';
      div.style.cssText = 'display:flex; align-items:center; gap:8px;';
      div.innerHTML = `
        <span class="rec-pt-num" style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:bold; font-size:0.75rem; flex-shrink:0;">
          ${count}
        </span>
        <input type="text" class="rec-pt-text" placeholder="أدخل نص البند / النقطة..." required 
          style="flex:1; padding:6px 10px; border:1px solid var(--border, #334155); border-radius:6px; font-size:0.82rem; background:var(--bg-card, #1e293b); color:var(--text, #f8fafc);" />
        <button type="button" onclick="window.unifiedCommitteesManager.removeRecPointRow(this)" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold; font-size:1rem;" title="حذف النقطة">✕</button>
      `;
      container.appendChild(div);
    }

    removeRecPointRow(btn) {
      const row = btn.parentElement;
      const container = document.getElementById('comm-rec-points-container');
      if (row && container) {
        row.remove();
        container.querySelectorAll('.comm-rec-point-row').forEach((r, idx) => {
          const numEl = r.querySelector('.rec-pt-num');
          if (numEl) numEl.textContent = idx + 1;
        });
      }
    }

    onTenderSelect(tid) {
      const t = this.tendersList.find(x => x.id === tid);
      if (t) {
        document.getElementById('comm-form-tender-name').value = t.name || t.title || '';
        document.getElementById('comm-form-contractor').value = t.contractor || '';
        document.getElementById('comm-form-cost').value = t.value || t.budget || 0;
        
        const titleInput = document.getElementById('comm-form-title');
        const typeSelect = document.getElementById('comm-form-type');
        const typeName = typeSelect.options[typeSelect.selectedIndex].text.replace(/^[^\s]+\s+/, '');
        if (!titleInput.value || titleInput.value.includes('محضر')) {
          titleInput.value = `${typeName} - ${t.name || t.title}`;
        }
      }
    }

    addMemberRow() {
      const container = document.getElementById('comm-members-container');
      if (!container) return;

      const div = document.createElement('div');
      div.className = 'comm-member-row';
      div.style.cssText = 'display:grid; grid-template-columns:1.5fr 1.5fr 1fr 28px; gap:8px; align-items:center; background:var(--bg-card, #1e293b); padding:8px; border-radius:6px; border:1px solid var(--border, #334155);';
      div.innerHTML = `
        <input type="text" class="mem-name" placeholder="اسم عضو اللجنة المكلف..." required 
          style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        <input type="text" class="mem-role" placeholder="الصفة باللجنة..." value="عضو فني باللجنة" 
          style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);" />
        <select class="mem-decision" style="padding:6px; border:1px solid var(--border, #334155); border-radius:4px; font-size:0.8rem; background:var(--bg, #0f172a); color:var(--text, #f8fafc);">
          <option value="موافق" selected>موافق ✓</option>
          <option value="متحفظ">متحفظ ⚠️</option>
          <option value="غير موافق">غير موافق ✕</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;" title="حذف">✕</button>
      `;
      container.appendChild(div);
    }

    async submitReport(e, id) {
      e.preventDefault();
      const isEdit = !!id;

      const memberRows = document.querySelectorAll('.comm-member-row');
      const committee_members = Array.from(memberRows).map(row => ({
        name: row.querySelector('.mem-name')?.value || '',
        role: row.querySelector('.mem-role')?.value || 'عضو فني باللجنة',
        decision: row.querySelector('.mem-decision')?.value || 'موافق'
      })).filter(m => m.name.trim());

      const intro = document.getElementById('comm-form-rec-intro')?.value.trim() || '';
      const pointInputs = document.querySelectorAll('.comm-rec-point-row .rec-pt-text');
      const points = Array.from(pointInputs).map(inp => inp.value.trim()).filter(Boolean);

      let fullRecommendation = intro;
      if (points.length > 0) {
        const formattedPts = points.map((pt, i) => `${i + 1}- ${pt}`).join('\n');
        fullRecommendation = intro ? `${intro}\n${formattedPts}` : formattedPts;
      }

      const payload = {
        title: document.getElementById('comm-form-title').value,
        report_type: document.getElementById('comm-form-type').value,
        tender_id: document.getElementById('comm-form-tender-id').value,
        tender_name: document.getElementById('comm-form-tender-name').value,
        contractor: document.getElementById('comm-form-contractor').value,
        project_cost: document.getElementById('comm-form-cost').value,
        formation_order_number: document.getElementById('comm-form-order-no').value,
        inspection_date: document.getElementById('comm-form-inspection-date').value,
        recommendation: fullRecommendation,
        status: document.getElementById('comm-form-status').value,
        lab_tests: document.getElementById('comm-form-tests').value,
        committee_members
      };

      try {
        const url = isEdit ? `/api/v4/committees/${id}` : '/api/v4/committees';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل حفظ التقرير');

        alert('✅ ' + (data.message || 'تم حفظ تقرير اللجنة بنجاح'));
        document.getElementById('comm-report-modal').style.display = 'none';

        this.fetchStats();
        this.fetchReports();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    async deleteReport(id) {
      if (!confirm(`هل أنت متأكد من حذف محضر اللجنة رقم (${id}) نهائياً؟`)) return;
      try {
        const res = await fetch(`/api/v4/committees/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل الحذف');
        alert('✅ ' + data.message);
        this.fetchStats();
        this.fetchReports();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OFFICIAL PRINT: HANDOVER REPORT
    // ─────────────────────────────────────────────────────────────────────────
    printOfficialReport(id) {
      const report = this.activeData.find(r => String(r.id) === String(id));
      if (!report) return;

      const typeTitles = {
        'INITIAL_HANDOVER': 'محضر استلام أولي رسمي للأعمال الهندسية',
        'FINAL_HANDOVER': 'محضر استلام نهائي رسمي وانتهاء فترة الصيانة',
        'TECHNICAL_AUDIT': 'تقرير كشف ومعاينة فنية وتدقيق أعمال العطاء',
        'DEFECT_PUNCHLIST': 'محضر حصر نواقص ومتابعة استدراك الأعمال',
        'VARIATION_COMMITTEE': 'محضر لجنة دراسة وتعديل المواصفات الهندسية'
      };

      const members = Array.isArray(report.committee_members) ? report.committee_members : [];

      const membersTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:10px; text-align:right; font-size:0.85rem;">
          <thead>
            <tr style="background:#1e3a8a; color:#ffffff;">
              <th style="padding:8px; text-align:center; width:35px;">#</th>
              <th style="padding:8px; width:180px;">اسم عضو اللجنة المكلف</th>
              <th style="padding:8px;">الصفة / الدور باللجنة</th>
              <th style="padding:8px; text-align:center; width:90px;">قرار العضو</th>
              <th style="padding:8px; text-align:center; width:120px;">التوقيع الرسمي</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((m, i) => `
              <tr style="border-bottom:1px solid #cbd5e1;">
                <td style="padding:8px; text-align:center; font-weight:bold;">${i + 1}</td>
                <td style="padding:8px; font-weight:bold; color:#0f172a;">${m.name}</td>
                <td style="padding:8px; color:#475569;">${m.role || 'عضو لجنة'}</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:#10b981;">${m.decision || 'موافق'} ✓</td>
                <td style="padding:8px; text-align:center; color:#94a3b8;">........................</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: typeTitles[report.report_type] || 'محضر لجنة فنية رسمي',
          subtitle: `مشروع: ${report.tender_name} (${report.tender_id || 'عام'})`,
          refNumber: report.report_number || report.id,
          date: report.inspection_date || new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'رقم المحضر الرسمي', value: report.report_number || report.id },
            { label: 'العطاء المرتبط', value: `${report.tender_name} (${report.tender_id || '-'})` },
            { label: 'المقاول المنفذ', value: report.contractor || '—' },
            { label: 'القيمة الإجمالية للعطاء', value: `${Number(report.project_cost || 0).toLocaleString()} دينار أردني` },
            { label: 'أمر تكليف اللجنة (مدير النظام)', value: `${report.formation_order_number || 'تكليف رسمي'} بتاريخ ${report.formation_order_date || '—'}` },
            { label: 'تاريخ الكشف الميداني', value: report.inspection_date || '—' },
            { label: 'نسبة الإنجاز الفعلي', value: `${report.completion_percentage || 100}%` },
            { label: 'الفحوصات المخبرية', value: report.lab_tests || 'مطابقة للمواصفات' }
          ],
          summaryHtml: `
            <!-- 🗺️ الخريطة الجغرافية ومسار العطاء بالطبقة المحددة -->
            <div style="margin: 12px 0 16px 0; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f8fafc; page-break-inside: avoid;">
              <div style="background: #1e3a8a; color: #ffffff; padding: 7px 12px; font-size: 0.82rem; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span>🗺️</span> <span>المخطط الجغرافي وموقع الأعمال الميدانية للعطاء (نظام GIS بلدية كفرنجة)</span>
                </div>
                <span style="font-size:0.75rem; background:rgba(255,255,255,0.22); padding:2px 8px; border-radius:10px;">الطبقة المحددة: مسار التعبيد والأصول الهندسية</span>
              </div>
              
              <div id="print-committee-gis-map" style="height: 190px; width: 100%; position: relative; background: #e2e8f0;"></div>

              <div style="padding: 6px 12px; background: #f1f5f9; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 0.74rem; color: #334155; font-weight: 600;">
                <span>📍 <b>الموقع:</b> ${report.tender_name} (${report.tender_id || 'عام'})</span>
                <span>🌐 <b>الإحداثيات:</b> 32.3085° N, 35.7080° E</span>
                <span>🛣️ <b>طول المسار:</b> 1,450 م (سماكة الأسفلت 7 سم)</span>
              </div>
            </div>

            <script>
              setTimeout(function() {
                try {
                  if (typeof L !== 'undefined' && document.getElementById('print-committee-gis-map')) {
                    var pMap = L.map('print-committee-gis-map', {
                      zoomControl: false,
                      attributionControl: false,
                      dragging: false,
                      touchZoom: false,
                      scrollWheelZoom: false,
                      doubleClickZoom: false
                    }).setView([32.3085, 35.7080], 14);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(pMap);

                    var pIcon = L.divIcon({
                      html: '<div style="background:#10b981; width:30px; height:30px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:15px; box-shadow:0 3px 8px rgba(0,0,0,0.4);">👥</div>',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });

                    L.marker([32.3085, 35.7080], { icon: pIcon }).addTo(pMap);
                    L.polyline([[32.3040, 35.7040], [32.3065, 35.7065], [32.3085, 35.7080], [32.3115, 35.7098]], { color: '#0284c7', weight: 6, opacity: 0.9 }).addTo(pMap);
                  }
                } catch(e) {}
              }, 120);
            </script>

            <div style="margin-top:14px;">
              <h4 style="color:#1e3a8a; margin:0 0 8px 0; font-size:0.95rem; font-weight:800;">قرار وتوصية اللجنة الفنية:</h4>
              <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px; font-size:0.88rem; line-height:1.6; color:#0f172a;">
                ${this.formatRecommendationHtml(report.recommendation, false)}
              </div>
            </div>

            <div style="margin-top:18px;">
              <h4 style="color:#1e3a8a; margin:0 0 6px 0; font-size:0.95rem; font-weight:800;">أعضاء اللجنة المكلفون رسمياً وتواقيعهم:</h4>
              ${membersTableHtml}
            </div>
          `,
          customWorkflow: [
            {
              order: 1,
              key: 'DIRECTOR',
              stageTitle: 'الاعتماد والمصادقة الرسمية',
              roleName: 'مدير الأشغال والخدمات الهندسية',
              icon: '✅',
              signLabel: 'التوقيع والاعتماد الرسمي',
              isFinal: true
            }
          ],
          signatures: true
        });
      } else {
        window.print();
      }
    }

    printCatalog() {
      const data = this.activeTabMode === 'HANDOVER' ? this.activeData : this.studiesData;
      if (typeof printStandardDocument === 'function') {
        const rows = data.map((r, i) => `
          <tr style="border-bottom:1px solid #cbd5e1; font-size:0.8rem;">
            <td style="padding:6px; text-align:center;">${i + 1}</td>
            <td style="padding:6px; font-weight:bold; font-family:monospace;">${r.report_number || r.id}</td>
            <td style="padding:6px;">${r.title}</td>
            <td style="padding:6px;">${r.tender_name}</td>
            <td style="padding:6px; text-align:center;">${r.inspection_date || r.session_date || '—'}</td>
            <td style="padding:6px; text-align:center; font-weight:bold;">${r.status}</td>
          </tr>
        `).join('');

        printStandardDocument({
          title: this.activeTabMode === 'HANDOVER' ? 'كشف وسجل تقارير اللجان الفنية ومحاضر الاستلام' : 'كشف وسجل لجان دراسة وتحليل العطاءات',
          subtitle: `بلدية كفرنجة الجديدة - إجمالي المحاضر: ${data.length} محضر`,
          refNumber: `COM-CAT-${new Date().getFullYear()}`,
          date: new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'عدد المحاضر المدرجة', value: `${data.length} محضر` },
            { label: 'تاريخ التوليد', value: new Date().toLocaleDateString('ar-JO') }
          ],
          summaryHtml: `
            <table style="width:100%; border-collapse:collapse; margin-top:14px; text-align:right;">
              <thead>
                <tr style="background:#1e3a8a; color:#fff; font-size:0.82rem;">
                  <th style="padding:6px; text-align:center; width:35px;">#</th>
                  <th style="padding:6px; width:110px;">رقم المحضر</th>
                  <th style="padding:6px;">عنوان المحضر</th>
                  <th style="padding:6px;">العطاء المرتبط</th>
                  <th style="padding:6px; text-align:center; width:90px;">التاريخ</th>
                  <th style="padding:6px; text-align:center; width:80px;">الحالة</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `
        });
      } else {
        window.print();
      }
    }

    exportToCSV() {
      const data = this.activeTabMode === 'HANDOVER' ? this.activeData : this.studiesData;
      if (!data || !data.length) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const headers = ['رقم المحضر', 'عنوان المحضر', 'العطاء المرتبط', 'أمر التكليف', 'التاريخ', 'الحالة'];
      const rows = data.map(r => [
        `"${r.report_number || r.id}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.tender_name || '').replace(/"/g, '""')}"`,
        `"${r.formation_order_number || ''}"`,
        `"${r.inspection_date || r.session_date || ''}"`,
        `"${r.status || ''}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `committee_${this.activeTabMode.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // تهيئة وتصدير المدير
  if (typeof window !== 'undefined') {
    window.UnifiedCommitteesManager = UnifiedCommitteesManager;
  }
})();
