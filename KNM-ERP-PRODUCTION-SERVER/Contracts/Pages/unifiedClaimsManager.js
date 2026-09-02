/**
 * Contracts/Pages/unifiedClaimsManager.js
 * منظومة إدارة المطالبات والدفعات المالية للمشاريع (FCMS v5.0 Enterprise)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * الميزات المتقدمة:
 * 1. توحيد كافة التسميات والأدوار ومراحل التدقيق والاعتماد الهندسي والمالي.
 * 2. لوحة مؤشرات أداء حية (Live Financial KPI Cards) لحساب الإجمالي والمحتجزات والصافي.
 * 3. جدول بنود الكميات (BOQ) التفاعلي مع الحساب الرياضي التلقائي.
 * 4. مسار اعتماد مرئي تفاعلي (Interactive Workflow Stepper & Audit Trail).
 * 5. ربط محكم مع العطاءات وقاعدة البيانات وسجل النشاطات والأرشيف الإلكتروني.
 * 6. طباعة شهادات الصرف الرسمية المعتمدة وتصدير البيانات إلى Excel و CSV.
 */

(function () {
  'use strict';

  class UnifiedClaimsManager {
    constructor() {
      this.container = null;
      this.claims = [];
      this.tenders = [];
      this.workflowConfig = [];
      this.activeFilter = 'ALL';
      this.selectedTender = '';
      this.searchTerm = '';
      this.currentUser = null;
      this.isLoading = false;
      this.sortCol = 'id';
      this.sortAsc = false;

      this.STATUS_DEFINITIONS = {
        DRAFT: 'مسودة / قيد الإعداد',
        PENDING_DEPT: 'بانتظار تدقيق رئيس القسم',
        PENDING_DIR: 'بانتظار اعتماد المدير الهندسي',
        APPROVED: 'معتمدة وجاهزة للصرف المالي',
        REJECTED: 'مرفوضة / معادة للدراسة'
      };

      this.initUser();
    }

    initUser() {
      try {
        const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
        this.currentUser = raw ? JSON.parse(raw) : (window.currentUser || { id: 'U-001', role: 'admin', fullName: 'مدير النظام' });
      } catch (e) {
        this.currentUser = { id: 'U-001', role: 'admin', fullName: 'مدير النظام' };
      }
    }

    hasPermission(perm) {
      if (!this.currentUser) return true;
      const role = (this.currentUser.role || '').toLowerCase();
      if (role === 'admin' || role === 'superadmin') return true;
      if (typeof window.hasPermission === 'function') {
        if (window.hasPermission(perm) || window.hasPermission('*')) return true;
      }
      const perms = Array.isArray(this.currentUser.permissions) 
        ? this.currentUser.permissions 
        : (typeof this.currentUser.permissions === 'string' ? this.currentUser.permissions.split(',') : []);
      if (perms.includes('*') || perms.includes(perm) || perms.includes('claims:*')) return true;
      
      // Default role presets
      if (perm === 'claims:delete') return role === 'admin';
      if (perm === 'claims:approve') return ['admin', 'manager', 'accountant'].includes(role);
      if (perm === 'claims:audit') return ['admin', 'manager', 'dept_head', 'accountant'].includes(role);
      if (perm === 'claims:create' || perm === 'claims:edit') return ['admin', 'manager', 'dept_head', 'engineer', 'accountant'].includes(role);
      return true;
    }

    async init(containerId = 'page-claims') {
      this.container = document.getElementById(containerId);
      if (!this.container) return;
      this.initUser();
      this.renderSkeleton();
      await this.loadData();
    }

    renderSkeleton() {
      this.container.innerHTML = `
        <div class="unified-claims-module" dir="rtl">
          <!-- Main Header -->
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
            <div>
              <h2 style="margin:0; font-size:1.4rem; font-weight:800; color:var(--text); display:flex; align-items:center; gap:8px;">
                <span>💰</span> <span>إدارة المطالبات والدفعات المالية للمشاريع</span>
              </h2>
              <p style="color:var(--text-muted); font-size:0.84rem; margin:4px 0 0 0;">
                المنظومة المؤسسية لإصدار، تدقيق، اعتماد وصرف الدفعات الإنجازية والختامية المرتبطة بالعطاءات
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline" id="btn-claims-wf-cfg" onclick="unifiedClaimsManager.openWorkflowConfigModal()" style="display:${this.currentUser?.role === 'admin' ? 'inline-flex' : 'none'};">
                ⚙️ سلسلة الاعتماد
              </button>
              <button class="btn btn-outline" onclick="unifiedClaimsManager.exportExcel()">
                📥 تصدير Excel
              </button>
              <button class="btn btn-outline" onclick="unifiedClaimsManager.printClaimsRegistry()">
                🖨️ طباعة السجل
              </button>
              <button class="btn btn-primary" onclick="unifiedClaimsManager.openCreateModal()" style="font-weight:bold;">
                ✨ + إصدار مطالبة مالية
              </button>
            </div>
          </div>

          <!-- Live KPI Analytics Cards -->
          <div class="claims-kpi-grid" id="claims-kpi-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
            <div class="kpi-loading-card" style="padding:20px; background:var(--bg-card); border-radius:10px; text-align:center; color:var(--text-muted);">جاري تحميل المؤشرات...</div>
          </div>

          <!-- Active Workflow Pipeline Banner -->
          <div id="claims-pipeline-banner" style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:20px; display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <span style="font-weight:700; font-size:0.86rem; color:var(--primary); display:flex; align-items:center; gap:6px;">
                <span>🔄</span> <span>مسار الاعتماد والتدقيق المعتمد في البلدية:</span>
              </span>
              <div id="claims-pipeline-steps" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"></div>
            </div>
          </div>

          <!-- Filters & Search Toolbar -->
          <div class="card" style="padding:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:280px;">
                <div class="search-box-modern" style="width:100%;">
                  <span class="search-icon">🔍</span>
                  <input type="text" id="claims-global-search" placeholder="بحث سريع برقم المطالبة، اسم المقاول، أو العطاء..." oninput="unifiedClaimsManager.onSearch(this.value)" autocomplete="off" />
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <select id="claims-filter-status" class="filter-select" onchange="unifiedClaimsManager.onStatusFilter(this.value)" style="min-width:160px; padding:8px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); color:var(--text);">
                  <option value="ALL">جميع الحالات</option>
                  <option value="مسودة / قيد الإعداد">مسودة / قيد الإعداد</option>
                  <option value="بانتظار تدقيق رئيس القسم">بانتظار رئيس القسم</option>
                  <option value="بانتظار اعتماد المدير الهندسي">بانتظار المدير الهندسي</option>
                  <option value="معتمدة وجاهزة للصرف المالي">معتمدة وجاهزة للصرف</option>
                  <option value="مرفوضة / معادة للدراسة">مرفوضة / معادة للدراسة</option>
                </select>

                <select id="claims-filter-tender" class="filter-select" onchange="unifiedClaimsManager.onTenderFilter(this.value)" style="max-width:220px; padding:8px 12px; border-radius:8px; background:var(--bg); border:1px solid var(--border); color:var(--text);">
                  <option value="">جميع العطاءات والمشاريع</option>
                </select>

                <button class="btn btn-outline" onclick="unifiedClaimsManager.resetFilters()" title="إعادة ضبط الفلاتر">
                  🔄 تفريغ
                </button>
              </div>
            </div>
          </div>

          <!-- Main Claims Data Table -->
          <div class="table-container" style="background:var(--bg-card); border-radius:10px; border:1px solid var(--border); overflow:hidden;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg); border-bottom:2px solid var(--border); text-align:right;">
                  <th style="width:110px; padding:12px 10px;">رقم المطالبة</th>
                  <th style="min-width:190px; padding:12px 10px;">العطاء / المشروع</th>
                  <th style="min-width:150px; padding:12px 10px;">المقاول المنفذ</th>
                  <th style="width:105px; padding:12px 10px;">تاريخ التقديم</th>
                  <th style="width:120px; padding:12px 10px;">المبلغ المطلوب</th>
                  <th style="width:120px; padding:12px 10px;">الصافي للصرف</th>
                  <th style="width:110px; text-align:center; padding:12px 10px;">نسبة الإنجاز</th>
                  <th style="width:145px; text-align:center; padding:12px 10px;">مرحلة التدقيق</th>
                  <th style="width:80px; text-align:center; padding:12px 10px;">المرفق</th>
                  <th style="width:150px; text-align:center; padding:12px 10px;">الإجراءات المتاحة</th>
                </tr>
              </thead>
              <tbody id="claims-table-body">
                <tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);"><div class="spinner"></div> جاري تحميل البيانات...</td></tr>
              </tbody>
            </table>
            <div id="claims-table-footer" style="padding:12px 16px; background:var(--bg); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--text-muted);">
              <span>جاري العد...</span>
            </div>
          </div>
        </div>
      `;
    }

    async loadData() {
      this.isLoading = true;
      try {
        const [claimsData, tendersData, workflowSteps] = await Promise.all([
          apiFetch('/claims').catch(() => []),
          apiFetch('/tenders').catch(() => []),
          apiFetch('/claim-workflow-config').catch(() => [])
        ]);

        this.claims = Array.isArray(claimsData) ? claimsData : [];
        this.tenders = Array.isArray(tendersData) ? tendersData : [];
        this.workflowConfig = Array.isArray(workflowSteps) ? workflowSteps : [];

        this.populateTenderFilter();
        this.renderStats();
        this.renderPipelineBanner();
        this.renderTable();
      } catch (err) {
        console.error('Error loading claims data:', err);
        showToast('⚠️ تعذر تحميل بيانات المطالبات: ' + err.message, 'error');
      } finally {
        this.isLoading = false;
      }
    }

    populateTenderFilter() {
      const select = document.getElementById('claims-filter-tender');
      if (!select) return;
      select.innerHTML = '<option value="">جميع العطاءات والمشاريع</option>' +
        this.tenders.map(t => `<option value="${t.id}">${t.id} — ${(t.name || '').substring(0, 35)}</option>`).join('');
    }

    renderStats() {
      const container = document.getElementById('claims-kpi-container');
      if (!container) return;

      const totalCount = this.claims.length;
      const draftCount = this.claims.filter(c => (c.status || '').includes('مسودة')).length;
      const pendingCount = this.claims.filter(c => (c.status || '').includes('بانتظار')).length;
      const approvedCount = this.claims.filter(c => (c.status || '').includes('معتمدة')).length;
      const rejectedCount = this.claims.filter(c => (c.status || '').includes('مرفوضة')).length;

      const totalGross = this.claims.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
      const totalNet = this.claims.reduce((s, c) => s + (parseFloat(c.netAmount) || (parseFloat(c.amount) || 0) - (parseFloat(c.retention) || 0) - (parseFloat(c.deduction) || 0)), 0);
      const totalRetention = this.claims.reduce((s, c) => s + (parseFloat(c.retention) || 0), 0);

      container.innerHTML = `
        <div class="card" onclick="unifiedClaimsManager.onStatusFilter('ALL')" style="padding:14px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border); border-right:4px solid var(--primary); cursor:pointer; transition:transform 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">إجمالي المطالبات</div>
              <div style="font-size:1.35rem; font-weight:800; color:var(--text); margin-top:4px;">${totalCount} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">مطالبة</span></div>
            </div>
            <div style="font-size:1.8rem; background:rgba(99,102,241,0.1); width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center;">📄</div>
          </div>
          <div style="font-size:0.75rem; color:var(--primary); margin-top:6px; font-weight:600;">إجمالي قيمة الفواتير: ${totalGross.toLocaleString('ar-JO')} د.أ</div>
        </div>

        <div class="card" onclick="unifiedClaimsManager.onStatusFilter('بانتظار')" style="padding:14px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border); border-right:4px solid #f59e0b; cursor:pointer; transition:transform 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">قيد التدقيق والمتابعة</div>
              <div style="font-size:1.35rem; font-weight:800; color:#f59e0b; margin-top:4px;">${pendingCount} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">مطالبة</span></div>
            </div>
            <div style="font-size:1.8rem; background:rgba(245,158,11,0.1); width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center;">⏳</div>
          </div>
          <div style="font-size:0.75rem; color:#d97706; margin-top:6px; font-weight:600;">بانتظار رئيس القسم أو المدير</div>
        </div>

        <div class="card" onclick="unifiedClaimsManager.onStatusFilter('معتمدة')" style="padding:14px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border); border-right:4px solid #10b981; cursor:pointer; transition:transform 0.2s;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">معتمدة وجاهزة للصرف</div>
              <div style="font-size:1.35rem; font-weight:800; color:#10b981; margin-top:4px;">${approvedCount} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">مطالبة</span></div>
            </div>
            <div style="font-size:1.8rem; background:rgba(16,185,129,0.1); width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center;">✅</div>
          </div>
          <div style="font-size:0.75rem; color:#059669; margin-top:6px; font-weight:600;">مصادق عليها بالكامل</div>
        </div>

        <div class="card" style="padding:14px; background:var(--bg-card); border-radius:10px; border:1px solid var(--border); border-right:4px solid #38bdf8;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">الصافي المعتمد للصرف</div>
              <div style="font-size:1.35rem; font-weight:800; color:#0284c7; margin-top:4px;">${totalNet.toLocaleString('ar-JO')} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">د.أ</span></div>
            </div>
            <div style="font-size:1.8rem; background:rgba(56,189,248,0.1); width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center;">💵</div>
          </div>
          <div style="font-size:0.75rem; color:#0369a1; margin-top:6px; font-weight:600;">المحتجزات المقتطعة: ${totalRetention.toLocaleString('ar-JO')} د.أ</div>
        </div>
      `;
    }

    renderPipelineBanner() {
      const banner = document.getElementById('claims-pipeline-banner');
      const stepsEl = document.getElementById('claims-pipeline-steps');
      if (!banner || !stepsEl) return;

      if (!this.workflowConfig || this.workflowConfig.length === 0) {
        banner.style.display = 'none';
        return;
      }

      banner.style.display = 'block';
      stepsEl.innerHTML = this.workflowConfig.map((s, idx) => `
        <div style="display:inline-flex; align-items:center; gap:6px;">
          <span style="background:rgba(99,102,241,0.15); color:var(--primary); font-weight:bold; font-size:0.75rem; padding:4px 10px; border-radius:6px; border:1px solid rgba(99,102,241,0.3); display:inline-flex; align-items:center; gap:4px;">
            <b style="color:#6366f1;">${idx + 1}.</b> <span>${s.label || s.printLabel || s.userName || s.userId}</span>
          </span>
          ${idx < this.workflowConfig.length - 1 ? '<span style="color:var(--text-muted); font-size:0.8rem;">←</span>' : ''}
        </div>
      `).join('');
    }

    getFilteredClaims() {
      return this.claims.filter(c => {
        // Search term
        if (this.searchTerm) {
          const q = this.searchTerm.toLowerCase();
          const target = `${c.id || ''} ${c.claimant || ''} ${c.tenderId || ''} ${c.tenderName || ''} ${c.type || ''}`.toLowerCase();
          if (!target.includes(q)) return false;
        }

        // Status filter
        if (this.activeFilter && this.activeFilter !== 'ALL') {
          if (this.activeFilter === 'بانتظار') {
            if (!(c.status || '').includes('بانتظار')) return false;
          } else if (this.activeFilter === 'معتمدة') {
            if (!(c.status || '').includes('معتمدة')) return false;
          } else {
            if ((c.status || '') !== this.activeFilter) return false;
          }
        }

        // Tender filter
        if (this.selectedTender) {
          const matchTender = String(c.tenderId || '').trim() === String(this.selectedTender).trim();
          if (!matchTender) return false;
        }

        return true;
      }).sort((a, b) => {
        const valA = a[this.sortCol] || '';
        const valB = b[this.sortCol] || '';
        return this.sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    renderTable() {
      const tbody = document.getElementById('claims-table-body');
      const footer = document.getElementById('claims-table-footer');
      if (!tbody) return;

      const filtered = this.getFilteredClaims();

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; padding:40px 20px;">
              <div style="font-size:2.4rem; margin-bottom:8px;">📭</div>
              <div style="font-weight:700; color:var(--text); font-size:1rem;">لا توجد مطالبات مالية مطابقة لخيارات البحث والتصفية</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">يمكنك إضافة مطالبة جديدة بالنقر على زر "إصدار مطالبة مالية" بالأعلى</div>
            </td>
          </tr>
        `;
        if (footer) footer.innerHTML = `<span>إجمالي السجلات: 0</span>`;
        return;
      }

      tbody.innerHTML = filtered.map(row => {
        const gross = parseFloat(row.amount) || 0;
        const net = parseFloat(row.netAmount) || Math.max(0, gross - (parseFloat(row.retention) || 0) - (parseFloat(row.deduction) || 0));
        const progress = parseFloat(row.completionPercent) || 0;
        const dateStr = (row.submitDate || row.createdAt || '-').split('T')[0];

        let statusBadgeColor = '#64748b';
        let statusBg = 'rgba(100,116,139,0.1)';

        if ((row.status || '').includes('معتمدة')) {
          statusBadgeColor = '#10b981';
          statusBg = 'rgba(16,185,129,0.12)';
        } else if ((row.status || '').includes('بانتظار')) {
          statusBadgeColor = '#f59e0b';
          statusBg = 'rgba(245,158,11,0.12)';
        } else if ((row.status || '').includes('مرفوضة')) {
          statusBadgeColor = '#ef4444';
          statusBg = 'rgba(239,68,68,0.12)';
        }

        const hasAttach = !!(row.file || row.attachmentPath);
        const attachBtn = hasAttach ? `
          <a href="/uploads/${row.file || row.attachmentPath}" target="_blank" class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:0.72rem; text-decoration:none;" title="معاينة الملف المرفق">
            📄 مرفق
          </a>
        ` : `<span style="color:var(--text-muted); font-size:0.75rem;">—</span>`;

        return `
          <tr style="border-bottom:1px solid var(--border); transition:background 0.15s;">
            <td style="padding:10px;">
              <strong style="color:var(--primary); font-size:0.88rem;">${row.id}</strong>
              <div style="font-size:0.72rem; color:var(--text-muted);">${row.type || 'مطالبة إنجاز'}</div>
            </td>
            <td style="padding:10px;">
              <div style="font-weight:700; font-size:0.84rem; color:var(--text);">${row.tenderId || '—'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${row.tenderName || ''}">${row.tenderName || ''}</div>
            </td>
            <td style="padding:10px; font-weight:600; font-size:0.83rem;">
              <span title="${row.claimant || ''}">${row.claimant || 'غير محدد'}</span>
            </td>
            <td style="padding:10px; font-size:0.8rem; color:var(--text-muted);">${dateStr}</td>
            <td style="padding:10px; font-weight:700; font-size:0.86rem; color:var(--text);">
              ${gross.toLocaleString('ar-JO')} <span style="font-size:0.7rem; color:var(--text-muted);">د.أ</span>
            </td>
            <td style="padding:10px; font-weight:800; font-size:0.92rem; color:#10b981;">
              ${net.toLocaleString('ar-JO')} <span style="font-size:0.7rem; color:#34d399;">د.أ</span>
            </td>
            <td style="padding:10px; text-align:center;">
              <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                <span style="font-weight:700; font-size:0.78rem; color:#38bdf8;">${progress}%</span>
                <div style="width:60px; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                  <div style="width:${Math.min(100, progress)}%; height:100%; background:linear-gradient(90deg, #0284c7, #38bdf8);"></div>
                </div>
              </div>
            </td>
            <td style="padding:10px; text-align:center;">
              <span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:0.74rem; font-weight:bold; color:${statusBadgeColor}; background:${statusBg}; border:1px solid ${statusBadgeColor}30;">
                ${row.status || 'مسودة'}
              </span>
            </td>
            <td style="padding:10px; text-align:center;">
              ${attachBtn}
            </td>
            <td style="padding:10px; text-align:center;">
              <div style="display:flex; gap:4px; justify-content:center; align-items:center;">
                <button class="btn btn-sm btn-info" onclick="unifiedClaimsManager.openViewModal('${row.id}')" title="عرض التفاصيل ومسار التدقيق">👁️</button>
                ${(row.status || '').includes('معتمدة') ? `
                  <button class="btn btn-sm btn-outline" onclick="unifiedClaimsManager.printClaimCertificate('${row.id}')" style="color:#6366f1; border-color:rgba(99,102,241,0.4);" title="طباعة شهادة الدفعة الرسمية المعتمدة">🖨️</button>
                ` : `
                  <button class="btn btn-sm btn-outline" onclick="showToast('⚠️ لا يمكن طباعة شهادة الدفعة الرسمية إلا بعد إنهاء سلسلة الاعتمادات والمصادقة النهائية (الحالة الحالية: ${row.status || 'مسودة'})', 'warning')" style="opacity:0.45; cursor:pointer; color:#94a3b8; border-color:#cbd5e1;" title="الطباعة مقفلة: بانتظار استكمال سلسلة الاعتماد">🔒🖨️</button>
                `}
                ${this.hasPermission('claims:edit') ? `<button class="btn btn-sm btn-outline" onclick="unifiedClaimsManager.openEditModal('${row.id}')" title="تعديل بيانات المطالبة">✏️</button>` : ''}
                ${this.hasPermission('claims:delete') ? `<button class="btn btn-sm btn-danger" onclick="unifiedClaimsManager.confirmDelete('${row.id}')" title="حذف المطالبة">🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (footer) {
        const sumNet = filtered.reduce((s, c) => s + (parseFloat(c.netAmount) || 0), 0);
        footer.innerHTML = `
          <span>إجمالي السجلات المعروضة: <b>${filtered.length}</b> من أصل <b>${this.claims.length}</b></span>
          <span>مجموع الصافي للصرف: <b style="color:#10b981;">${sumNet.toLocaleString('ar-JO')} د.أ</b></span>
        `;
      }
    }

    onSearch(val) {
      this.searchTerm = (val || '').trim();
      this.renderTable();
    }

    onStatusFilter(val) {
      this.activeFilter = val;
      const select = document.getElementById('claims-filter-status');
      if (select) select.value = val;
      this.renderTable();
    }

    onTenderFilter(val) {
      this.selectedTender = val;
      this.renderTable();
    }

    resetFilters() {
      this.searchTerm = '';
      this.activeFilter = 'ALL';
      this.selectedTender = '';
      const sInput = document.getElementById('claims-global-search');
      if (sInput) sInput.value = '';
      const sSelect = document.getElementById('claims-filter-status');
      if (sSelect) sSelect.value = 'ALL';
      const tSelect = document.getElementById('claims-filter-tender');
      if (tSelect) tSelect.value = '';
      this.renderTable();
    }

    // =========================================================================
    // MODAL: VIEW & AUDIT TRAIL
    // =========================================================================
    async openViewModal(claimId) {
      try {
        const claim = await apiFetch(`/claims/${claimId}`);
        if (!claim) return showToast('⚠️ تعذر جلب بيانات المطالبة', 'error');

        // Fetch tender previous summary
        let prevClaims = [];
        let tenderObj = null;
        if (claim.tenderId) {
          try {
            const sumData = await apiFetch(`/claims/tender/${encodeURIComponent(claim.tenderId)}/summary`);
            if (sumData && sumData.claims) {
              prevClaims = sumData.claims.filter(c => String(c.id) !== String(claim.id));
              tenderObj = sumData.tender;
            }
          } catch (e) {}
        }

        const gross = parseFloat(claim.amount) || 0;
        const prevPaid = parseFloat(claim.previousPaid) || prevClaims.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
        const cumulativeGross = parseFloat(claim.grossCumulative) || (gross + prevPaid);
        const retPercent = claim.retentionPercent !== undefined ? parseFloat(claim.retentionPercent) : 10;
        const retention = parseFloat(claim.retention) || (gross * (retPercent / 100));
        const deduction = parseFloat(claim.deduction) || 0;
        const net = parseFloat(claim.netAmount) || Math.max(0, gross - retention - deduction);

        let historyList = [];
        try {
          historyList = typeof claim.history === 'string' ? JSON.parse(claim.history) : (claim.history || []);
        } catch (e) {}

        let boqItems = [];
        try {
          boqItems = typeof claim.boqItems === 'string' ? JSON.parse(claim.boqItems) : (claim.boqItems || []);
        } catch (e) {}

        // Workflow action permissions & dynamic chain progression
        const canAudit = this.hasPermission('claims:audit');
        const canApprove = this.hasPermission('claims:approve');
        const currentStatus = claim.status || 'مسودة / قيد الإعداد';

        let workflowActionButtons = '';
        if (Array.isArray(this.workflowConfig) && this.workflowConfig.length > 0) {
          const stepIndex = this.workflowConfig.findIndex(s => (currentStatus || '').includes(s.label || s.printLabel || s.userName || ''));
          if (currentStatus.includes('مسودة') || (stepIndex === -1 && !currentStatus.includes('معتمدة') && !currentStatus.includes('مرفوضة'))) {
            const firstStep = this.workflowConfig[0];
            const targetStatus = `بانتظار ${firstStep.label || firstStep.printLabel || 'التدقيق'}`;
            workflowActionButtons = `
              <button class="btn btn-warning" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', '${targetStatus}', 'إحالة إلى: ${firstStep.label || firstStep.printLabel}')">
                📤 تحويل إلى (${firstStep.label || firstStep.printLabel})
              </button>
            `;
          } else if (stepIndex >= 0 && stepIndex < this.workflowConfig.length - 1) {
            const currentStep = this.workflowConfig[stepIndex];
            const nextStep = this.workflowConfig[stepIndex + 1];
            const targetStatus = `بانتظار ${nextStep.label || nextStep.printLabel}`;
            const isUserAuthorized = canAudit || this.currentUser?.id === currentStep.userId || this.currentUser?.role === 'admin' || this.currentUser?.role === currentStep.userRole;
            if (isUserAuthorized) {
              workflowActionButtons = `
                <button class="btn btn-primary" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', '${targetStatus}', 'تدقيق وموافقة: ${currentStep.label || currentStep.printLabel}')">
                  ✓ تدقيق وإحالة إلى (${nextStep.label || nextStep.printLabel})
                </button>
                <button class="btn btn-danger" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مرفوضة / معادة للدراسة', 'إعادة المطالبة للتعديل')">
                  ✕ إعادة للدراسة والتعديل
                </button>
              `;
            }
          } else if (stepIndex === this.workflowConfig.length - 1) {
            const finalStep = this.workflowConfig[stepIndex];
            const isUserAuthorized = canApprove || this.currentUser?.id === finalStep.userId || this.currentUser?.role === 'admin';
            if (isUserAuthorized) {
              workflowActionButtons = `
                <button class="btn btn-success" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'معتمدة وجاهزة للصرف المالي', 'المصادقة والاعتماد النهائي للصرف')">
                  ✅ اعتماد وصرف نهائي للمطالبة
                </button>
                <button class="btn btn-danger" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مرفوضة / معادة للدراسة', 'رفض أو إعادة توجيه')">
                  ✕ رفض / إعادة للدراسة
                </button>
              `;
            }
          } else if (currentStatus.includes('مرفوضة')) {
            workflowActionButtons = `
              <button class="btn btn-outline" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مسودة / قيد الإعداد', 'إعادة فتح المطالبة كمسودة')">
                🔄 إعادة فتح المسودة
              </button>
            `;
          }
        } else {
          // Default workflow fallback
          if (currentStatus.includes('مسودة')) {
            workflowActionButtons = `
              <button class="btn btn-warning" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'بانتظار تدقيق رئيس القسم', 'إحالة لتدقيق رئيس القسم')">
                📤 تحويل لتدقيق رئيس القسم
              </button>
            `;
          } else if (currentStatus.includes('بانتظار تدقيق رئيس القسم')) {
            if (canAudit) {
              workflowActionButtons = `
                <button class="btn btn-primary" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'بانتظار اعتماد المدير الهندسي', 'تدقيق وموافقة رئيس القسم')">
                  ✓ تدقيق وتحويل للمدير الهندسي
                </button>
                <button class="btn btn-danger" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مرفوضة / معادة للدراسة', 'إعادة المطالبة للمهندس لتعديلها')">
                  ✕ إعادة للدراسة والتعديل
                </button>
              `;
            }
          } else if (currentStatus.includes('بانتظار اعتماد المدير الهندسي')) {
            if (canApprove) {
              workflowActionButtons = `
                <button class="btn btn-success" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'معتمدة وجاهزة للصرف المالي', 'المصادقة والاعتماد النهائي للصرف')">
                  ✅ اعتماد وصرف نهائي للمطالبة
                </button>
                <button class="btn btn-danger" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مرفوضة / معادة للدراسة', 'رفض أو إعادة توجيه من المدير')">
                  ✕ رفض / إعادة للدراسة
                </button>
              `;
            }
          } else if (currentStatus.includes('مرفوضة')) {
            workflowActionButtons = `
              <button class="btn btn-outline" onclick="unifiedClaimsManager.promptWorkflowAction('${claim.id}', 'مسودة / قيد الإعداد', 'إعادة فتح المطالبة كمسودة')">
                🔄 إعادة فتح المسودة
              </button>
            `;
          }
        }

        const modalHtml = `
          <div style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text);">
            <!-- Top Status Banner -->
            <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <span style="font-size:0.8rem; color:var(--text-muted);">رقم المطالبة المرجعي:</span>
                <h3 style="margin:2px 0 0 0; font-size:1.2rem; color:var(--primary); font-weight:800;">${claim.id}</h3>
              </div>
              <div>
                <span style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:2px;">حالة المطالبة الحالية:</span>
                <span style="display:inline-block; padding:4px 12px; border-radius:14px; font-weight:bold; font-size:0.82rem; background:rgba(99,102,241,0.15); color:var(--primary); border:1px solid rgba(99,102,241,0.3);">
                  ${currentStatus}
                </span>
              </div>
              <div style="display:flex; gap:8px;">
                ${(claim.status || '').includes('معتمدة') ? `
                  <button class="btn btn-outline btn-sm" onclick="unifiedClaimsManager.printClaimCertificate('${claim.id}')" style="color:#6366f1; border-color:rgba(99,102,241,0.4);">
                    🖨️ طباعة الشهادة المعتمدة
                  </button>
                ` : `
                  <button class="btn btn-outline btn-sm" onclick="showToast('⚠️ لا يمكن طباعة شهادة الدفعة الرسمية إلا بعد إنهاء سلسلة الاعتمادات والمصادقة النهائية (الحالة: ${claim.status || 'مسودة'})', 'warning')" style="opacity:0.6; color:#94a3b8; border-color:#cbd5e1;" title="الطباعة مقفلة لحين الاعتماد النهائي">
                    🔒 طباعة الشهادة (بانتظار الاعتماد)
                  </button>
                `}
              </div>
            </div>

            <!-- Overview Grid -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
              <div class="card" style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px;">
                <span style="font-size:0.75rem; color:var(--text-muted);">المشروع / العطاء:</span>
                <div style="font-weight:700; font-size:0.88rem; margin-top:2px;">${claim.tenderId || '—'}</div>
                <div style="font-size:0.74rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${claim.tenderName || ''}</div>
              </div>
              <div class="card" style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px;">
                <span style="font-size:0.75rem; color:var(--text-muted);">المقاول / المنفذ:</span>
                <div style="font-weight:700; font-size:0.88rem; margin-top:2px;">${claim.claimant || '—'}</div>
              </div>
              <div class="card" style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px;">
                <span style="font-size:0.75rem; color:var(--text-muted);">تاريخ التقديم:</span>
                <div style="font-weight:700; font-size:0.88rem; margin-top:2px;">${(claim.submitDate || claim.createdAt || '-').split('T')[0]}</div>
              </div>
              <div class="card" style="padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px;">
                <span style="font-size:0.75rem; color:var(--text-muted);">نسبة الإنجاز التراكمية:</span>
                <div style="font-weight:800; font-size:1.05rem; color:#38bdf8; margin-top:2px;">${claim.completionPercent || 0}%</div>
              </div>
            </div>

            <!-- Financial Settlement Table -->
            <div style="background:var(--bg-surface); border:2px solid var(--primary); border-radius:10px; padding:14px; margin-bottom:18px;">
              <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:0.95rem; font-weight:800; border-bottom:1px solid var(--border); padding-bottom:6px; display:flex; align-items:center; gap:6px;">
                <span>💰</span> <span>الخلاصة:</span>
              </h4>
              <table style="width:100%; border-collapse:collapse; font-size:0.86rem; line-height:1.9;">
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:4px 8px;">1. إجمالي قيمة الأعمال المنفذة تراكمياً حتى تاريخه:</td>
                  <td style="text-align:left; font-weight:bold; color:var(--text);">${cumulativeGross.toLocaleString('ar-JO')} د.أ</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border); background:rgba(245,158,11,0.06);">
                  <td style="padding:4px 8px; color:#d97706; font-weight:bold;">2. تنزيل: إجمالي المطالبات والدفعات السابقة المسددة:</td>
                  <td style="text-align:left; font-weight:bold; color:#d97706;">(-) ${prevPaid.toLocaleString('ar-JO')} د.أ</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border); background:rgba(16,185,129,0.06);">
                  <td style="padding:4px 8px; color:#059669; font-weight:bold;">3. قيمة الأعمال المنفذة في هذه المطالبة الحالية:</td>
                  <td style="text-align:left; font-weight:bold; color:#059669;">${gross.toLocaleString('ar-JO')} د.أ</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:4px 8px; color:#ef4444;">4. تنزيل: اقتطاع المحتجزات وتأمين التنفيذ بنسبة (<b>${retPercent}%</b>):</td>
                  <td style="text-align:left; font-weight:bold; color:#ef4444;">(-) ${retention.toLocaleString('ar-JO')} د.أ</td>
                </tr>
                ${deduction > 0 ? `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:4px 8px; color:#ef4444;">5. تنزيل: خصميات وأمانات ومخالفات أخرى:</td>
                    <td style="text-align:left; font-weight:bold; color:#ef4444;">(-) ${deduction.toLocaleString('ar-JO')} د.أ</td>
                  </tr>
                ` : ''}
                <tr style="background:rgba(99,102,241,0.12); font-weight:800; border-top:2px solid var(--primary);">
                  <td style="padding:8px; font-size:0.95rem; color:var(--primary);">6. صافي المبلغ المستحق والصافي الصريح للصرف بموجب هذه الشهادة:</td>
                  <td style="text-align:left; font-size:1.2rem; color:#10b981;">${net.toLocaleString('ar-JO')} د.أ</td>
                </tr>
              </table>
            </div>

            <!-- BOQ Items Statement -->
            ${boqItems.length > 0 ? `
              <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:18px;">
                <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:0.9rem; font-weight:700;">📋 كشف تفاصيل بنود الأعمال والكميات المنفذة بالدفعة (BOQ Table):</h4>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:right;">
                    <thead>
                      <tr style="background:var(--bg); border-bottom:1px solid var(--border);">
                        <th style="padding:6px;">#</th>
                        <th style="padding:6px;">بيان بند العمل</th>
                        <th style="padding:6px; width:70px;">الوحدة</th>
                        <th style="padding:6px; width:85px;">الفئة (د.أ)</th>
                        <th style="padding:6px; width:85px;">الكمية السابقة</th>
                        <th style="padding:6px; width:85px;">الكمية الحالية</th>
                        <th style="padding:6px; width:85px;">إجمالي الكمية</th>
                        <th style="padding:6px; width:100px;">المبلغ (د.أ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${boqItems.map((b, i) => `
                        <tr style="border-bottom:1px solid var(--border);">
                          <td style="padding:6px; font-weight:bold;">${i + 1}</td>
                          <td style="padding:6px; font-weight:600;">${b.desc || ''}</td>
                          <td style="padding:6px;">${b.unit || ''}</td>
                          <td style="padding:6px; font-weight:bold;">${(parseFloat(b.rate) || 0).toLocaleString('ar-JO')}</td>
                          <td style="padding:6px; color:var(--text-muted);">${b.prevQty || 0}</td>
                          <td style="padding:6px; font-weight:bold; color:#10b981;">${b.currQty || 0}</td>
                          <td style="padding:6px; font-weight:bold; color:#38bdf8;">${b.totalQty || ((parseFloat(b.prevQty) || 0) + (parseFloat(b.currQty) || 0))}</td>
                          <td style="padding:6px; font-weight:bold; color:#10b981;">${(parseFloat(b.amount) || 0).toLocaleString('ar-JO')} د.أ</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            <!-- Prior Payments History -->
            ${prevClaims.length > 0 ? `
              <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:18px;">
                <h4 style="margin:0 0 10px 0; color:#38bdf8; font-size:0.9rem; font-weight:700;">📚 سجل الدفعات السابقة المسددة للعطاء:</h4>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:right;">
                    <thead>
                      <tr style="background:var(--bg); border-bottom:1px solid var(--border);">
                        <th style="padding:6px;">رقم المطالبة</th>
                        <th style="padding:6px;">تاريخ التقديم</th>
                        <th style="padding:6px;">المبلغ المطلوب</th>
                        <th style="padding:6px;">الصافي المصروف</th>
                        <th style="padding:6px;">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${prevClaims.map(pc => `
                        <tr style="border-bottom:1px solid var(--border);">
                          <td style="padding:6px; font-weight:bold; color:var(--primary);">${pc.id}</td>
                          <td style="padding:6px;">${(pc.submitDate || pc.createdAt || '-').split('T')[0]}</td>
                          <td style="padding:6px; font-weight:bold;">${(parseFloat(pc.amount) || 0).toLocaleString('ar-JO')} د.أ</td>
                          <td style="padding:6px; font-weight:bold; color:#10b981;">${(parseFloat(pc.netAmount) || (parseFloat(pc.amount) || 0)).toLocaleString('ar-JO')} د.أ</td>
                          <td style="padding:6px;"><span style="font-size:0.72rem;">${pc.status}</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}

            <!-- Audit Trail & Timeline -->
            <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:18px;">
              <h4 style="margin:0 0 10px 0; color:var(--text); font-size:0.9rem; font-weight:700;">🛡️ السجل الزمني للقرارات والتدقيق (Audit Trail):</h4>
              ${historyList.length > 0 ? `
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${historyList.map(h => `
                    <div style="background:var(--bg); border:1px solid var(--border); border-right:4px solid var(--primary); border-radius:8px; padding:10px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-weight:bold; font-size:0.84rem; color:var(--text);">${h.action || 'إجراء'}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(h.date || Date.now()).toLocaleString('ar-JO')}</span>
                      </div>
                      <div style="font-size:0.78rem; color:var(--text-muted);">
                        👤 <strong>المنفذ:</strong> ${h.actionBy || 'مستخدم'} | <strong>الحالة:</strong> <span style="font-weight:bold; color:var(--primary);">${h.status || ''}</span>
                      </div>
                      ${h.notes ? `<div style="margin-top:4px; font-size:0.8rem; background:rgba(0,0,0,0.1); padding:4px 8px; border-radius:4px; color:var(--text);">💬 ${h.notes}</div>` : ''}
                      ${h.attachment ? `<div style="margin-top:4px;"><a href="/uploads/${h.attachment}" target="_blank" style="color:var(--primary); font-size:0.78rem; text-decoration:none;">📎 تحميل الوثيقة المرفقة</a></div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:0.8rem;">لا توجد سجلات تدقيق سابقة.</div>`}
            </div>

            <!-- Modal Action Buttons -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border); padding-top:14px; margin-top:10px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${workflowActionButtons}
              </div>
              <button class="btn btn-outline" onclick="if (typeof window.closeModal === 'function') window.closeModal(); else { document.getElementById('viewOverlay')?.classList.remove('open'); document.getElementById('modalOverlay')?.classList.remove('open'); }">إغلاق النافذة</button>
            </div>
          </div>
        `;

        document.getElementById('viewTitle').textContent = `تفاصيل وتدقيق المطالبة المالية: ${claim.id}`;
        document.getElementById('viewBody').innerHTML = modalHtml;
        document.getElementById('viewOverlay').classList.add('open');
      } catch (e) {
        showToast('⚠️ خطأ في فتح تفاصيل المطالبة: ' + e.message, 'error');
      }
    }

    promptWorkflowAction(claimId, targetStatus, actionLabel) {
      closeModal();
      const modalHtml = `
        <div style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text); padding:4px 0;">
          <div style="background:rgba(99,102,241,0.1); border:1px solid var(--primary); border-radius:8px; padding:10px; margin-bottom:12px; font-size:0.88rem;">
            <strong>📌 الإجراء المطلوب:</strong> <span style="color:var(--primary); font-weight:bold;">${actionLabel || targetStatus}</span>
          </div>
          <div class="form-group" style="margin-bottom:12px;">
            <label style="font-weight:700; font-size:0.84rem; display:block; margin-bottom:6px;">
              💬 تبريرات وملاحظات القرار الإداري / الفني *
            </label>
            <textarea id="wf-action-notes" rows="3" placeholder="اكتب التبريرات الفنية أو التوجيهات الإدارية الصادرة..." style="width:100%; padding:8px; background:var(--bg); border:1px solid var(--border); border-radius:8px; color:var(--text); resize:none;"></textarea>
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:4px;">📎 إرفاق كتاب تغطية أو تقرير فني (اختياري)</label>
            <input type="file" id="wf-action-file" style="color:var(--text);" />
          </div>
          <div class="form-actions" style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="unifiedClaimsManager.submitWorkflowAction('${claimId}', '${targetStatus}', '${actionLabel}')">
              تأكيد وتطبيق القرار ✓
            </button>
          </div>
        </div>
      `;

      document.getElementById('modalTitle').textContent = '📝 قرار التدقيق والاعتماد المالي';
      document.getElementById('modalBody').innerHTML = modalHtml;
      document.getElementById('modalOverlay').classList.add('open');
    }

    async submitWorkflowAction(claimId, targetStatus, actionLabel) {
      const notes = document.getElementById('wf-action-notes')?.value || '';
      const fileInput = document.getElementById('wf-action-file');
      closeModal();

      try {
        let body;
        const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
        if (hasFile) {
          const fd = new FormData();
          fd.append('targetStatus', targetStatus);
          fd.append('notes', notes);
          fd.append('action', actionLabel);
          fd.append('file', fileInput.files[0]);
          body = fd;
        } else {
          body = JSON.stringify({ targetStatus, notes, action: actionLabel });
        }

        const res = await apiFetch(`/claims/${claimId}/workflow`, {
          method: 'POST',
          body: body
        });

        showToast(`✅ ${res.message || 'تم تحديث حالة المسار بنجاح'}`);
        await this.loadData();
        this.openViewModal(claimId);
      } catch (e) {
        showToast('❌ تعذر تطبيق الإجراء: ' + e.message, 'error');
      }
    }

    // =========================================================================
    // MODAL: CREATE & EDIT
    // =========================================================================
    async openCreateModal() {
      if (!this.hasPermission('claims:create')) {
        return showToast('⚠️ ليست لديك الصلاحية لإنشاء مطالبة مالية', 'error');
      }
      this.renderFormModal(null);
    }

    async openEditModal(claimId) {
      if (!this.hasPermission('claims:edit')) {
        return showToast('⚠️ ليست لديك الصلاحية لتعديل المطالبات المالية', 'error');
      }
      try {
        const claim = await apiFetch(`/claims/${claimId}`);
        if (!claim) return showToast('⚠️ تعذر جلب سجل المطالبة', 'error');
        this.renderFormModal(claim);
      } catch (e) {
        showToast('⚠️ خطأ في فتح التعديل: ' + e.message, 'error');
      }
    }

    renderFormModal(existingRecord = null) {
      const isEdit = !!existingRecord;
      const tenderOptionsHtml = '<option value="">-- اختر المشروع / العطاء --</option>' +
        this.tenders.map(t => `<option value="${t.id}" ${existingRecord && existingRecord.tenderId === t.id ? 'selected' : ''}>${t.id} — ${(t.name || '').substring(0, 45)}</option>`).join('');

      const formHtml = `
        <div style="direction:rtl; font-family:'Tajawal',sans-serif; color:var(--text); display:flex; flex-direction:column; gap:14px;">
          <!-- القسم 1: بيانات العطاء والمقاول -->
          <div style="background:var(--bg-surface); border:1px solid var(--border); padding:12px; border-radius:10px;">
            <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:0.92rem; font-weight:800;">📌 1. بيانات العطاء والمقاول المنفذ</h4>
            <div class="form-row">
              <div class="form-group">
                <label>العطاء المرتبط (يتم جلب الحسابات والسجل تلقائياً) *</label>
                <select id="fc-tenderId" onchange="unifiedClaimsManager.onFormTenderSelect()">${tenderOptionsHtml}</select>
              </div>
              <div class="form-group">
                <label>اسم المقاول / مقدم المطالبة *</label>
                <input id="fc-claimant" type="text" value="${existingRecord?.claimant || ''}" placeholder="يُجلب تلقائياً من العطاء" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>تاريخ تقديم المطالبة *</label>
                <input id="fc-submitDate" type="date" value="${(existingRecord?.submitDate || new Date().toISOString()).split('T')[0]}" />
              </div>
              <div class="form-group">
                <label>نوع المطالبة *</label>
                <select id="fc-type">
                  <option value="مطالبة إنجاز" ${existingRecord?.type === 'مطالبة إنجاز' ? 'selected' : ''}>مطالبة إنجاز (دفعة جارية)</option>
                  <option value="مطالبة ختامية" ${existingRecord?.type === 'مطالبة ختامية' ? 'selected' : ''}>مطالبة ختامية (دفعة نهائية)</option>
                  <option value="مطالبة إضافية / أوامر تغييرية" ${existingRecord?.type === 'مطالبة إضافية / أوامر تغييرية' ? 'selected' : ''}>مطالبة إضافية / أمر تغييري</option>
                </select>
              </div>
              <div class="form-group">
                <label>حالة المطالبة</label>
                <select id="fc-status">
                  <option value="مسودة / قيد الإعداد" ${existingRecord?.status === 'مسودة / قيد الإعداد' ? 'selected' : ''}>مسودة / قيد الإعداد</option>
                  <option value="بانتظار تدقيق رئيس القسم" ${existingRecord?.status === 'بانتظار تدقيق رئيس القسم' ? 'selected' : ''}>بانتظار تدقيق رئيس القسم</option>
                  <option value="بانتظار اعتماد المدير الهندسي" ${existingRecord?.status === 'بانتظار اعتماد المدير الهندسي' ? 'selected' : ''}>بانتظار اعتماد المدير الهندسي</option>
                  <option value="معتمدة وجاهزة للصرف المالي" ${existingRecord?.status === 'معتمدة وجاهزة للصرف المالي' ? 'selected' : ''}>معتمدة وجاهزة للصرف</option>
                  <option value="مرفوضة / معادة للدراسة" ${existingRecord?.status === 'مرفوضة / معادة للدراسة' ? 'selected' : ''}>مرفوضة</option>
                </select>
              </div>
            </div>
          </div>

          <!-- القسم 2: سجل المطالبات والدفعات السابقة للعطاء -->
          <div id="fc-prev-card" style="background:#0f172a; border:1px solid #334155; padding:12px; border-radius:10px; color:#f8fafc;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:bold; color:#38bdf8; font-size:0.85rem;">📚 2. سجل وحسابات المطالبات والدفعات السابقة التراكمية:</span>
              <span id="fc-prev-badge" style="background:#1e3a8a; color:#93c5fd; padding:2px 8px; border-radius:10px; font-size:0.75rem;">0 مطالبات سابقة</span>
            </div>
            <div id="fc-prev-container">
              <div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.8rem;">يرجى اختيار العطاء لعرض المطالبات والدفعات السابقة المسددة.</div>
            </div>
          </div>

          <!-- القسم 3: جدول بنود الكميات المنفذة (BOQ Table) -->
          <div style="background:var(--bg-surface); border:1px solid var(--border); padding:12px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
              <div>
                <h4 style="margin:0; color:var(--primary); font-size:0.92rem; font-weight:bold;">📊 3. جدول بنود الأعمال والكميات المنفذة في المطالبة (BOQ Table)</h4>
                <span style="font-size:0.75rem; color:var(--text-muted);">أدخل الكميات المنفذة وسعر الفئة لاحتساب المبالغ تلقائياً</span>
              </div>
              <button type="button" class="btn btn-sm btn-success" onclick="unifiedClaimsManager.addBoqRow()" style="font-size:0.78rem;">
                ➕ إضافة بند عمل جديد
              </button>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.78rem; text-align:right; min-width:820px;">
                <thead style="background:var(--bg); color:var(--text-muted); border-bottom:2px solid var(--border);">
                  <tr>
                    <th style="padding:6px; width:30px;">#</th>
                    <th style="padding:6px;">بيان بند العمل / الوصف</th>
                    <th style="padding:6px; width:75px;">الوحدة</th>
                    <th style="padding:6px; width:90px;">الفئة (د.أ)</th>
                    <th style="padding:6px; width:85px;">كمية العطاء</th>
                    <th style="padding:6px; width:85px;">الكمية السابقة</th>
                    <th style="padding:6px; width:90px;">الكمية الحالية</th>
                    <th style="padding:6px; width:90px;">إجمالي الكمية</th>
                    <th style="padding:6px; width:100px;">المبلغ (د.أ)</th>
                    <th style="padding:6px; width:35px;"></th>
                  </tr>
                </thead>
                <tbody id="fc-boq-tbody"></tbody>
              </table>
            </div>
          </div>

          <!-- القسم 4: التسوية المالية واقتطاع المحتجزات -->
          <div style="background:var(--bg-surface); border:1px solid var(--border); padding:12px; border-radius:10px;">
            <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:0.92rem; font-weight:bold;">💰 4. التسوية المالية التراكمية واقتطاع المحتجزات والخصميات</h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:10px;">
              <div class="form-group">
                <label>إجمالي الأعمال التراكمية (د.أ)</label>
                <input id="fc-grossCumulative" type="number" readonly placeholder="0" style="font-weight:bold; color:#38bdf8;" />
              </div>
              <div class="form-group">
                <label>تنزيل: المطالبات السابقة (د.أ)</label>
                <input id="fc-previousPaid" type="number" readonly placeholder="0" style="font-weight:bold; color:#f59e0b;" />
              </div>
              <div class="form-group">
                <label>قيمة أعمال المطالبة الحالية (د.أ)</label>
                <input id="fc-amount" type="number" readonly placeholder="0" style="font-weight:bold; color:#10b981;" />
              </div>
              <div class="form-group">
                <label>نسبة ومبلغ المحتجزات (%)</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input id="fc-retentionPercent" type="number" value="${existingRecord?.retentionPercent !== undefined ? existingRecord.retentionPercent : 10}" placeholder="10" step="0.5" min="0" max="100" oninput="unifiedClaimsManager.recalculateTotals()" style="width:65px; font-weight:bold; color:#ef4444;" />
                  <span style="font-size:0.75rem; color:var(--text-muted);">%</span>
                  <input id="fc-retention" type="number" value="${existingRecord?.retention || 0}" placeholder="0" oninput="unifiedClaimsManager.recalculateTotals(true)" style="flex:1; color:#ef4444; font-weight:bold;" />
                </div>
              </div>
              <div class="form-group">
                <label>خصميات وأمانات أخرى (د.أ)</label>
                <input id="fc-deduction" type="number" value="${existingRecord?.deduction || 0}" placeholder="0" oninput="unifiedClaimsManager.recalculateTotals()" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:var(--bg); padding:10px; border-radius:8px; border:1px solid var(--border);">
              <div>
                <label style="font-size:0.78rem; color:var(--text-muted); display:block; margin-bottom:2px;">نسبة الإنجاز التراكمية للعطاء (%)</label>
                <div style="display:flex; align-items:center; gap:6px;">
                  <input id="fc-completionPercent" type="number" readonly value="${existingRecord?.completionPercent || 0}" placeholder="0" style="font-size:1.05rem; font-weight:bold; color:#38bdf8; width:90px;" />
                  <span style="font-size:0.8rem; color:var(--text-muted);">% من القيمة الأصلية للعطاء</span>
                </div>
              </div>
              <div>
                <label style="font-size:0.78rem; color:var(--text-muted); display:block; margin-bottom:2px;">صافي المبلغ المعتمد والصافي للصرف (د.أ)</label>
                <input id="fc-netAmount" type="number" readonly value="${existingRecord?.netAmount || 0}" placeholder="0" style="font-size:1.15rem; font-weight:bold; color:#059669; background:rgba(5,150,105,0.1); border:1px solid #059669;" />
              </div>
            </div>
          </div>

          <!-- ملاحظات وإرفاق ملفات -->
          ${isEdit ? `
            <div class="form-group">
              <label>سبب وتبرير التعديل (يسجل في Audit Trail) *</label>
              <input id="fc-editReason" type="text" placeholder="مثال: تعديل كميات الحفر وفق كشف القياس الفعلي" />
            </div>
          ` : ''}

          <div class="form-group">
            <label>ملاحظات وتنسيبات فنية</label>
            <textarea id="fc-notes" placeholder="أية ملاحظات إضافية حول نسبة الإنجاز والخصميات والتدقيق...">${existingRecord?.notes || ''}</textarea>
          </div>

          <div class="form-group">
            <label>إرفاق وثيقة المطالبة / كشف الحصر (اختياري)</label>
            <input id="fc-file" type="file" style="color:var(--text);" />
          </div>

          <div class="form-actions" style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border); padding-top:12px; margin-top:4px;">
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
            <button class="btn btn-primary" onclick="unifiedClaimsManager.saveForm('${existingRecord?.id || ''}')">
              💾 ${isEdit ? 'حفظ وتحديث المطالبة' : 'حفظ وإصدار المطالبة المالية'}
            </button>
          </div>
        </div>
      `;

      document.getElementById('modalTitle').textContent = isEdit ? `تعديل المطالبة المالية: ${existingRecord.id}` : '✨ إصدار مطالبة مالية / دفعة إنجازية جديدة';
      document.getElementById('modalBody').innerHTML = formHtml;
      document.getElementById('modalOverlay').classList.add('open');

      if (isEdit && existingRecord) {
        this.onFormTenderSelect(existingRecord);
      }
    }

    async onFormTenderSelect(existingRecord = null) {
      const tenderId = document.getElementById('fc-tenderId')?.value;
      const claimantInput = document.getElementById('fc-claimant');
      const prevContainer = document.getElementById('fc-prev-container');
      const prevBadge = document.getElementById('fc-prev-badge');
      const prevPaidInput = document.getElementById('fc-previousPaid');

      if (!tenderId) {
        if (prevContainer) prevContainer.innerHTML = '<div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.8rem;">يرجى اختيار العطاء لعرض المطالبات السابقة.</div>';
        if (prevBadge) prevBadge.textContent = '0 مطالبات سابقة';
        return;
      }

      const tender = this.tenders.find(t => String(t.id) === String(tenderId));
      if (tender && claimantInput && (!claimantInput.value || claimantInput.value.trim() === '')) {
        claimantInput.value = tender.contractor || '';
      }

      try {
        const sumData = await apiFetch(`/claims/tender/${encodeURIComponent(tenderId)}/summary`);
        const allTenderClaims = sumData.claims || [];
        const prevList = existingRecord ? allTenderClaims.filter(c => String(c.id) !== String(existingRecord.id)) : allTenderClaims;

        const sumPrevGross = prevList.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
        if (prevPaidInput) prevPaidInput.value = sumPrevGross.toFixed(2);
        if (prevBadge) prevBadge.textContent = `${prevList.length} مطالبات سابقة (${sumPrevGross.toLocaleString('ar-JO')} د.أ)`;

        if (prevContainer) {
          if (prevList.length === 0) {
            prevContainer.innerHTML = '<div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.8rem;">لا توجد مطالبات أو دفعات سابقة مسجلة لهذا العطاء (هذه هي الدفعة الأولى #1).</div>';
          } else {
            prevContainer.innerHTML = `
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.75rem; color:#f8fafc; text-align:right;">
                  <thead>
                    <tr style="border-bottom:1px solid #334155; color:#94a3b8;">
                      <th style="padding:4px;">#</th>
                      <th style="padding:4px;">رقم المطالبة</th>
                      <th style="padding:4px;">تاريخ التقديم</th>
                      <th style="padding:4px;">المبلغ الإجمالي</th>
                      <th style="padding:4px;">الصافي</th>
                      <th style="padding:4px;">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${prevList.map((pc, idx) => `
                      <tr style="border-bottom:1px solid #1e3a8a;">
                        <td style="padding:4px;">${idx + 1}</td>
                        <td style="padding:4px; font-weight:bold; color:#38bdf8;">${pc.id}</td>
                        <td style="padding:4px;">${(pc.submitDate || pc.createdAt || '-').split('T')[0]}</td>
                        <td style="padding:4px; color:#34d399; font-weight:bold;">${(parseFloat(pc.amount) || 0).toLocaleString('ar-JO')} د.أ</td>
                        <td style="padding:4px; color:#60a5fa;">${(parseFloat(pc.netAmount) || (parseFloat(pc.amount) || 0)).toLocaleString('ar-JO')} د.أ</td>
                        <td style="padding:4px;"><span style="font-size:0.7rem; color:#f59e0b;">${pc.status}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }
        }

        // Fill BOQ Items if existing or populate default
        const tbody = document.getElementById('fc-boq-tbody');
        if (tbody) {
          tbody.innerHTML = '';
          let boqItems = [];
          if (existingRecord && existingRecord.boqItems) {
            try { boqItems = typeof existingRecord.boqItems === 'string' ? JSON.parse(existingRecord.boqItems) : existingRecord.boqItems; } catch (e) {}
          }

          if (boqItems.length > 0) {
            boqItems.forEach(b => this.addBoqRow(b.desc, b.unit, b.rate, b.contractQty, b.prevQty, b.currQty));
          } else {
            // Default rows from tender boq if available, or template
            let tenderBoq = [];
            if (tender && tender.boqItemsJson) {
              try { tenderBoq = typeof tender.boqItemsJson === 'string' ? JSON.parse(tender.boqItemsJson) : tender.boqItemsJson; } catch (e) {}
            }
            if (tenderBoq && tenderBoq.length > 0) {
              tenderBoq.forEach(tb => this.addBoqRow(tb.description || tb.desc, tb.unit, tb.unitPrice || tb.rate, tb.quantity || tb.contractQty, 0, 0));
            } else {
              this.addBoqRow('أعمال حفريات وتسوية وفرشيات', 'م3', 5.0, 100, 0, 0);
              this.addBoqRow('أعمال خلطة إسفلتية ساخنة', 'م2', 4.5, 500, 0, 0);
            }
          }
        }

        this.recalculateTotals();
      } catch (e) {
        console.error('Error fetching tender summary for claim form:', e);
      }
    }

    addBoqRow(desc = '', unit = 'م3', rate = 0, contractQty = 0, prevQty = 0, currQty = 0) {
      const tbody = document.getElementById('fc-boq-tbody');
      if (!tbody) return;

      const idx = tbody.children.length + 1;
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid var(--border);';
      tr.innerHTML = `
        <td style="padding:6px; font-weight:bold; color:var(--primary);">${idx}</td>
        <td style="padding:6px;"><input type="text" class="fc-boq-desc" value="${desc}" placeholder="بيان وتفاصيل بند العمل" style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; font-size:0.79rem;" /></td>
        <td style="padding:6px;">
          <select class="fc-boq-unit" style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; font-size:0.77rem;">
            <option value="م3" ${unit === 'م3' ? 'selected' : ''}>م3</option>
            <option value="م2" ${unit === 'م2' ? 'selected' : ''}>م2</option>
            <option value="م.ط" ${unit === 'م.ط' ? 'selected' : ''}>م.ط</option>
            <option value="كغم" ${unit === 'كغم' ? 'selected' : ''}>كغم</option>
            <option value="طن" ${unit === 'طن' ? 'selected' : ''}>طن</option>
            <option value="عدد" ${unit === 'عدد' ? 'selected' : ''}>عدد</option>
            <option value="مقطوعية" ${unit === 'مقطوعية' ? 'selected' : ''}>مقطوعية</option>
          </select>
        </td>
        <td style="padding:6px;"><input type="number" class="fc-boq-rate" value="${rate}" placeholder="0" step="0.01" oninput="unifiedClaimsManager.recalculateTotals()" style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; font-size:0.79rem;" /></td>
        <td style="padding:6px;"><input type="number" class="fc-boq-cqty" value="${contractQty}" placeholder="0" style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; font-size:0.79rem;" /></td>
        <td style="padding:6px;"><input type="number" class="fc-boq-pqty" value="${prevQty}" readonly style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text-muted); border-radius:4px; font-size:0.79rem;" /></td>
        <td style="padding:6px;"><input type="number" class="fc-boq-currqty" value="${currQty}" placeholder="0" step="0.1" oninput="unifiedClaimsManager.recalculateTotals()" style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:#10b981; font-weight:bold; border-radius:4px; font-size:0.79rem;" /></td>
        <td style="padding:6px;"><input type="number" class="fc-boq-tqty" value="${prevQty + currQty}" readonly style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:#38bdf8; border-radius:4px; font-size:0.79rem; font-weight:bold;" /></td>
        <td style="padding:6px;"><input type="number" class="fc-boq-amount" value="${currQty * rate}" readonly style="width:100%; padding:4px; background:var(--bg); border:1px solid var(--border); color:#059669; font-weight:bold; border-radius:4px; font-size:0.8rem;" /></td>
        <td style="padding:6px; text-align:center;"><button type="button" onclick="this.closest('tr').remove(); unifiedClaimsManager.recalculateTotals();" style="background:#dc2626; color:#fff; border:none; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:0.75rem;">✕</button></td>
      `;
      tbody.appendChild(tr);
    }

    recalculateTotals(isManualRetention = false) {
      let grossCurrentAmount = 0;
      let grossCumulativeAmount = 0;

      const rows = document.querySelectorAll('#fc-boq-tbody tr');
      rows.forEach(tr => {
        const rate = parseFloat(tr.querySelector('.fc-boq-rate')?.value) || 0;
        const prevQ = parseFloat(tr.querySelector('.fc-boq-pqty')?.value) || 0;
        const currQ = parseFloat(tr.querySelector('.fc-boq-currqty')?.value) || 0;

        const totalQ = prevQ + currQ;
        const itemCurrentAmount = currQ * rate;
        const itemCumulativeAmount = totalQ * rate;

        const tqEl = tr.querySelector('.fc-boq-tqty');
        const amEl = tr.querySelector('.fc-boq-amount');
        if (tqEl) tqEl.value = totalQ.toFixed(1);
        if (amEl) amEl.value = itemCurrentAmount.toFixed(2);

        grossCurrentAmount += itemCurrentAmount;
        grossCumulativeAmount += itemCumulativeAmount;
      });

      const prevGrossPaid = parseFloat(document.getElementById('fc-previousPaid')?.value) || 0;
      if (grossCumulativeAmount === 0 && grossCurrentAmount > 0) {
        grossCumulativeAmount = grossCurrentAmount + prevGrossPaid;
      }

      const grossCumInput = document.getElementById('fc-grossCumulative');
      if (grossCumInput) grossCumInput.value = grossCumulativeAmount.toFixed(2);

      const amountInput = document.getElementById('fc-amount');
      if (amountInput) amountInput.value = grossCurrentAmount.toFixed(2);

      const retPercentInput = document.getElementById('fc-retentionPercent');
      const retInput = document.getElementById('fc-retention');
      let retentionDeduction = 0;

      if (isManualRetention && retInput && retInput.value !== '') {
        retentionDeduction = parseFloat(retInput.value) || 0;
        const computedPercent = grossCurrentAmount > 0 ? (retentionDeduction / grossCurrentAmount) * 100 : 0;
        if (retPercentInput) retPercentInput.value = computedPercent.toFixed(1);
      } else {
        const retPercent = parseFloat(retPercentInput?.value) || 0;
        retentionDeduction = grossCurrentAmount * (retPercent / 100);
        if (retInput) retInput.value = retentionDeduction.toFixed(2);
      }

      const otherDeduction = parseFloat(document.getElementById('fc-deduction')?.value) || 0;
      const netPayable = Math.max(0, grossCurrentAmount - retentionDeduction - otherDeduction);

      const netInput = document.getElementById('fc-netAmount');
      if (netInput) netInput.value = netPayable.toFixed(2);

      const tenderId = document.getElementById('fc-tenderId')?.value;
      const tender = this.tenders.find(t => String(t.id) === String(tenderId));
      const tenderValue = tender ? (parseFloat(tender.value) || parseFloat(tender.awardedValue) || 1) : 1;
      const completionPercent = Math.min(100, (grossCumulativeAmount / tenderValue) * 100);

      const compInput = document.getElementById('fc-completionPercent');
      if (compInput) compInput.value = completionPercent.toFixed(1);
    }

    async saveForm(editId = '') {
      const tenderId = document.getElementById('fc-tenderId')?.value;
      const claimant = document.getElementById('fc-claimant')?.value;
      if (!tenderId) return showToast('⚠️ يرجى اختيار العطاء المرتبط بالمطالبة', 'error');
      if (!claimant || !claimant.trim()) return showToast('⚠️ يرجى إدخال اسم المقاول / مقدم المطالبة', 'error');

      const boqRows = Array.from(document.querySelectorAll('#fc-boq-tbody tr')).map(tr => ({
        desc: tr.querySelector('.fc-boq-desc')?.value || '',
        unit: tr.querySelector('.fc-boq-unit')?.value || 'م3',
        rate: parseFloat(tr.querySelector('.fc-boq-rate')?.value) || 0,
        contractQty: parseFloat(tr.querySelector('.fc-boq-cqty')?.value) || 0,
        prevQty: parseFloat(tr.querySelector('.fc-boq-pqty')?.value) || 0,
        currQty: parseFloat(tr.querySelector('.fc-boq-currqty')?.value) || 0,
        totalQty: parseFloat(tr.querySelector('.fc-boq-tqty')?.value) || 0,
        amount: parseFloat(tr.querySelector('.fc-boq-amount')?.value) || 0
      })).filter(r => r.desc.trim() !== '');

      const payload = {
        tenderId,
        claimant,
        submitDate: document.getElementById('fc-submitDate')?.value,
        type: document.getElementById('fc-type')?.value || 'مطالبة إنجاز',
        status: document.getElementById('fc-status')?.value || 'مسودة / قيد الإعداد',
        notes: document.getElementById('fc-notes')?.value || '',
        boqItems: JSON.stringify(boqRows),
        grossCumulative: document.getElementById('fc-grossCumulative')?.value || 0,
        previousPaid: document.getElementById('fc-previousPaid')?.value || 0,
        amount: document.getElementById('fc-amount')?.value || 0,
        retentionPercent: document.getElementById('fc-retentionPercent')?.value || 10,
        retention: document.getElementById('fc-retention')?.value || 0,
        deduction: document.getElementById('fc-deduction')?.value || 0,
        netAmount: document.getElementById('fc-netAmount')?.value || 0,
        completionPercent: document.getElementById('fc-completionPercent')?.value || 0,
        editReason: document.getElementById('fc-editReason')?.value || ''
      };

      const fileInput = document.getElementById('fc-file');
      const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

      let bodyData;
      if (hasFile) {
        const fd = new FormData();
        Object.keys(payload).forEach(k => fd.append(k, payload[k]));
        fd.append('file', fileInput.files[0]);
        bodyData = fd;
      } else {
        bodyData = JSON.stringify(payload);
      }

      try {
        const isEdit = !!editId;
        const endpoint = isEdit ? `/claims/${editId}` : '/claims';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await apiFetch(endpoint, { method, body: bodyData });
        showToast(`✅ ${res.message || 'تم حفظ المطالبة المالية بنجاح'}`);
        closeModal();
        await this.loadData();
      } catch (e) {
        showToast('❌ تعذر حفظ المطالبة: ' + e.message, 'error');
      }
    }

    async confirmDelete(claimId) {
      if (!this.hasPermission('claims:delete')) {
        return showToast('⚠️ ليست لديك صلاحية حذف المطالبات', 'error');
      }
      if (!confirm(`هل أنت متأكد من حذف المطالبة المالية رقم (${claimId}) نهائياً؟ لا يمكن التراجع عن هذه العملية.`)) {
        return;
      }

      try {
        const res = await apiFetch(`/claims/${claimId}`, { method: 'DELETE' });
        showToast(`🗑️ ${res.message || 'تم حذف المطالبة بنجاح'}`);
        await this.loadData();
      } catch (e) {
        showToast('❌ فشل الحذف: ' + e.message, 'error');
      }
    }

    // =========================================================================
    // OFFICIAL PRINTING & EXPORT ENGINE
    // =========================================================================
    async printClaimCertificate(claimId) {
      const claim = this.claims.find(c => String(c.id) === String(claimId));
      if (claim && !(claim.status || '').includes('معتمدة')) {
        return showToast(`⚠️ لا يمكن طباعة شهادة الدفعة الرسمية إلا بعد إنهاء سلسلة الاعتمادات والمصادقة النهائية (حالة المطالبة الحالية: ${claim.status || 'مسودة'})`, 'warning');
      }
      if (typeof window.printClaim === 'function') {
        return window.printClaim(claimId);
      }
      showToast('⏳ جاري إعداد شهادة الدفعة الرسمية...');
    }

    async printClaimsRegistry() {
      if (typeof window.printClaimsTable === 'function') {
        return window.printClaimsTable();
      }
    }

    exportExcel() {
      const filtered = this.getFilteredClaims();
      if (!filtered.length) {
        return showToast('⚠️ لا توجد بيانات لتصديرها', 'error');
      }

      if (typeof window.exportToExcelFile === 'function') {
        window.exportToExcelFile({
          filename: `Claims_Registry_${new Date().toISOString().split('T')[0]}.xls`,
          title: 'سجل وجرد المطالبات والدفعات المالية للمشاريع',
          subtitle: 'بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية',
          headers: ['رقم المطالبة', 'رقم العطاء', 'اسم المشروع', 'المقاول', 'تاريخ التقديم', 'نوع الدفعة', 'المبلغ الإجمالي (د.أ)', 'المحتجزات (د.أ)', 'الصافي للصرف (د.أ)', 'نسبة الإنجاز %', 'حالة الاعتماد'],
          rows: filtered.map(c => [
            c.id,
            c.tenderId || '—',
            c.tenderName || '—',
            c.claimant || '—',
            (c.submitDate || c.createdAt || '-').split('T')[0],
            c.type || 'مطالبة إنجاز',
            parseFloat(c.amount) || 0,
            parseFloat(c.retention) || 0,
            parseFloat(c.netAmount) || 0,
            parseFloat(c.completionPercent) || 0,
            c.status || 'مسودة'
          ])
        });
        showToast('✅ تم تصدير ملف Excel بنجاح');
      } else {
        exportCSV('claims');
      }
    }

    openWorkflowConfigModal() {
      if (typeof window.openClaimWorkflowConfig === 'function') {
        window.openClaimWorkflowConfig();
      }
    }
  }

  // Expose to window globally
  window.UnifiedClaimsManager = UnifiedClaimsManager;
  window.unifiedClaimsManager = new UnifiedClaimsManager();
  window.loadClaimsModule = function () {
    window.unifiedClaimsManager.init('page-claims');
  };
})();
