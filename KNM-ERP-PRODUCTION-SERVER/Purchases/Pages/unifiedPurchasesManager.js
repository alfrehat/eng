/**
 * Purchases/Pages/unifiedPurchasesManager.js
 * المدير الشامل الموحد للمشتريات واللوازم والتوريدات والمستودعات وسلاسل التوكيد والخرائط (Enterprise Unified Purchases Manager v7.0)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

(function (window) {
  'use strict';

  class UnifiedPurchasesManager {
    constructor() {
      this.purchases = [];
      this.filteredPurchases = [];
      this.currentTab = 'all';
      this.currentViewMode = 'table';
      this.selectedIds = new Set();
      this.currentUser = this._getCurrentUser();
      this.map = null;
      this.markersLayer = null;
      this._modalMapInstance = null;
      this._viewMapInstance = null;

      this.filters = {
        search: '',
        category: '',
        status: '',
        urgency: ''
      };

      this.categories = [
        { id: 'all', label: 'كافة السجلات والطلبات', icon: '📋' },
        { id: 'purchases', label: 'أوامر الشراء المباشر واللوازم', icon: '🛒', match: 'لوازم وشراء مباشر' },
        { id: 'maintenance', label: 'طلبات الصيانة وأوامر العمل', icon: '🛠️', match: 'طلب صيانة وأعمال' },
        { id: 'materials', label: 'مواد البناء والتوريدات الإنشائية', icon: '🧱', match: 'مواد بناء وتوريدات' },
        { id: 'map', label: 'الخريطة التفاعلية للمواقع (GIS)', icon: '🗺️' }
      ];

      this.workflowStages = [
        { key: 'مسودة / قيد التنظيم', label: 'مسودة / قيد التنظيم', step: 1, color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
        { key: 'بانتظار تدقيق رئيس القسم', label: 'بانتظار تدقيق رئيس قسم اللوازم', step: 2, color: '#d97706', bg: 'rgba(217,119,6,0.15)' },
        { key: 'بانتظار مصادقة مدير الأشغال', label: 'بانتظار مصادقة مدير الأشغال', step: 3, color: '#2563eb', bg: 'rgba(37,99,235,0.15)' },
        { key: 'معتمد / قيد التوريد والتنفيذ', label: 'معتمد / قيد التوريد والتنفيذ', step: 4, color: '#059669', bg: 'rgba(5,150,105,0.15)' },
        { key: 'تم الاستلام والتسديد والمطابقة - مغلقة', label: '✅ تم الاستلام والتسديد - مغلقة', step: 5, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
        { key: 'تم الاستلام والتسديد', label: '✅ تم الاستلام والتسديد', step: 5, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
        { key: 'معاد للتعديل', label: '↩️ معاد للتعديل', step: 0, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
        { key: 'ملغي', label: '🚫 ملغي', step: 0, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
      ];
    }

    _getCurrentUser() {
      try {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : { role: 'admin', fullName: 'المهندس المشرف' };
      } catch (e) {
        return { role: 'admin', fullName: 'المهندس المشرف' };
      }
    }

    _getAuthHeaders(extraHeaders = {}) {
      const token = localStorage.getItem('token') || (this.currentUser && this.currentUser.token) || '';
      const headers = { ...extraHeaders };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      return headers;
    }

    _hasPermission(permKey) {
      const u = this.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
      const role = String(u?.role || 'admin').toLowerCase();
      if (role === 'admin' || role === 'superadmin') return true;

      if (typeof window.hasPermission === 'function') {
        if (window.hasPermission(permKey) || window.hasPermission('*') || window.hasPermission(permKey.toUpperCase())) return true;
      }

      const perms = Array.isArray(u?.permissions) ? u.permissions : [];
      if (perms.includes('*') || perms.includes(permKey) || perms.includes(permKey.toUpperCase())) return true;

      if (permKey === 'PURCHASES.DELETE' || permKey === 'purchases.delete') return role === 'admin';
      if (permKey === 'PURCHASES.APPROVE' || permKey === 'purchases.approve') return ['admin', 'manager', 'director', 'dept_head'].includes(role);
      if (permKey === 'PURCHASES.RECEIVE' || permKey === 'purchases.receive') return ['admin', 'manager', 'director', 'dept_head', 'engineer', 'accountant'].includes(role);
      if (permKey === 'PURCHASES.CREATE' || permKey === 'purchases.create') return ['admin', 'manager', 'director', 'dept_head', 'engineer', 'accountant'].includes(role);
      if (permKey === 'PURCHASES.EDIT' || permKey === 'purchases.edit') return ['admin', 'manager', 'director', 'dept_head', 'engineer', 'accountant'].includes(role);
      if (permKey === 'PURCHASES.EXPORT' || permKey === 'purchases.export') return ['admin', 'manager', 'director', 'dept_head', 'accountant', 'auditor'].includes(role);
      if (permKey === 'PURCHASES.VIEW' || permKey === 'purchases.view' || permKey === 'PURCHASES.PRINT') return true;

      return false;
    }

    async init() {
      const container = document.getElementById('purchases-tab-container') || document.getElementById('page-purchases');
      if (!container) return;

      this.renderSkeleton(container);
      await this.loadData();
    }

    renderSkeleton(container) {
      container.innerHTML = `
        <div class="purchases-wrapper" style="font-family:'Tajawal', sans-serif; direction:rtl; padding:20px; color:var(--text, #f8fafc); min-height:85vh;">
          
          <!-- Header Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; margin-bottom:20px; background:linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9)); padding:18px 24px; border-radius:18px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 30px rgba(0,0,0,0.25);">
            <div>
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="background:linear-gradient(135deg, #0284c7, #0f766e); width:46px; height:46px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; box-shadow:0 4px 15px rgba(2,132,199,0.4);">🛒</div>
                <div>
                  <h1 style="margin:0; font-size:1.35rem; font-weight:800; color:#ffffff;">إدارة المشتريات واللوازم والتوريدات والمستودعات</h1>
                  <p style="margin:3px 0 0 0; font-size:0.83rem; color:#94a3b8;">سلسلة التوكيد والاعتماد الإداري • توثيق سندات الاستلام • التحديد الجغرافي GIS</p>
                </div>
              </div>
            </div>
            
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.loadData()" style="display:inline-flex; align-items:center; gap:6px; font-weight:bold; padding:9px 15px; border-radius:10px; border:1px solid #334155; color:#94a3b8; background:rgba(30,41,59,0.5); cursor:pointer;">
                <span>🔄</span> <span>تحديث</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.exportExcel()" style="display:inline-flex; align-items:center; gap:6px; font-weight:bold; padding:9px 15px; border-radius:10px; border:1px solid #059669; color:#10b981; background:rgba(5,150,105,0.1); cursor:pointer;">
                <span>📊</span> <span>تصدير إكسل</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.printPurchasesRegistry()" style="display:inline-flex; align-items:center; gap:6px; font-weight:bold; padding:9px 15px; border-radius:10px; border:1px solid #0284c7; color:#38bdf8; background:rgba(2,132,199,0.1); cursor:pointer;">
                <span>🖨️</span> <span>طباعة السجل</span>
              </button>
              ${this._hasPermission('PURCHASES.CREATE') ? `
                <button class="btn btn-primary" onclick="window.unifiedPurchasesManager.openNewModal()" style="display:inline-flex; align-items:center; gap:6px; font-weight:800; padding:9px 18px; border-radius:10px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; box-shadow:0 4px 15px rgba(2,132,199,0.35); cursor:pointer;">
                  <span>✨</span> <span>إصدار طلب شراء / صيانة جديد</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- KPI Summary Cards -->
          <div id="purchases-kpi-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:20px;"></div>

          <!-- Tabs Navigation Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
            <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; max-width:100%;">
              ${this.categories.map(c => `
                <button id="ptab-${c.id}" class="ptab-btn ${this.currentTab === c.id ? 'active' : ''}" onclick="window.unifiedPurchasesManager.switchTab('${c.id}')" style="${this._getTabBtnStyle(this.currentTab === c.id)}">
                  <span>${c.icon}</span> <span>${c.label}</span>
                  <span id="badge-${c.id}" style="padding:2px 7px; border-radius:10px; font-size:0.72rem; background:rgba(0,0,0,0.3);">0</span>
                </button>
              `).join('')}
            </div>

            <div style="display:flex; gap:6px; background:rgba(30,41,59,0.7); padding:4px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
              <button id="pview-table-btn" onclick="window.unifiedPurchasesManager.switchViewMode('table')" style="padding:6px 12px; border-radius:8px; border:none; background:linear-gradient(135deg, #0284c7, #0f766e); color:#fff; cursor:pointer; font-size:0.85rem; font-weight:bold;">📑 جدول</button>
              <button id="pview-grid-btn" onclick="window.unifiedPurchasesManager.switchViewMode('grid')" style="padding:6px 12px; border-radius:8px; border:none; background:transparent; color:#94a3b8; cursor:pointer; font-size:0.85rem; font-weight:bold;">🔲 بطاقات</button>
            </div>
          </div>

          <!-- Search & Filter Controls -->
          <div style="background:rgba(30,41,59,0.5); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:14px; margin-bottom:18px; display:grid; grid-template-columns:2fr 1fr 1fr 1fr auto; gap:12px; align-items:center;">
            <div>
              <input type="text" id="purchases-search-input" placeholder="🔍 بحث برقم المعاملة، بيان المادة، اسم المورد، الحي..." oninput="window.unifiedPurchasesManager.onSearchChange(this.value)" style="width:100%; padding:9px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.86rem;" />
            </div>
            <div>
              <select id="purchases-filter-category" onchange="window.unifiedPurchasesManager.onCategoryFilterChange(this.value)" style="width:100%; padding:9px 12px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.86rem;">
                <option value="">كافة التصنيفات</option>
                <option value="لوازم وشراء مباشر">🛒 أوامر الشراء المباشر واللوازم</option>
                <option value="طلب صيانة وأعمال">🛠️ طلبات الصيانة وأوامر العمل</option>
                <option value="مواد بناء وتوريدات">🧱 مواد البناء والتوريدات الإنشائية</option>
              </select>
            </div>
            <div>
              <select id="purchases-filter-status" onchange="window.unifiedPurchasesManager.onStatusFilterChange(this.value)" style="width:100%; padding:9px 12px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.86rem;">
                <option value="">كافة حالات الاعتماد</option>
                ${this.workflowStages.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <select id="purchases-filter-urgency" onchange="window.unifiedPurchasesManager.onUrgencyFilterChange(this.value)" style="width:100%; padding:9px 12px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.86rem;">
                <option value="">كافة درجات الأهمية</option>
                <option value="عادي">عادي</option>
                <option value="متوسط">متوسط</option>
                <option value="عاجل">عاجل ⚡</option>
                <option value="طارئ">طارئ جداً 🚨</option>
              </select>
            </div>
            <div>
              <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.resetFilters()" style="padding:9px 14px; border-radius:10px; border:1px solid #334155; color:#94a3b8; font-size:0.84rem; cursor:pointer;" title="إعادة ضبط">✕ مسح</button>
            </div>
          </div>

          <!-- Bulk Operations Floating Bar -->
          <div id="purchases-bulk-bar" style="display:none; justify-content:space-between; align-items:center; background:linear-gradient(135deg, #1e3a8a, #0284c7); padding:10px 18px; border-radius:12px; margin-bottom:14px; color:#fff; font-size:0.86rem; box-shadow:0 8px 25px rgba(2,132,199,0.3);">
            <div style="display:flex; align-items:center; gap:10px;">
              <span>تم تحديد (<b id="purchases-selected-count">0</b>) معاملة</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.printPurchasesRegistry()" style="background:#fff; color:#0284c7; font-weight:bold; border:none; padding:5px 12px; border-radius:8px; cursor:pointer;">🖨️ طباعة المحدد</button>
              <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.exportExcel()" style="background:rgba(255,255,255,0.2); color:#fff; font-weight:bold; border:none; padding:5px 12px; border-radius:8px; cursor:pointer;">📊 تصدير المحدد</button>
              ${this._hasPermission('PURCHASES.DELETE') ? `
                <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.bulkDeleteSelected()" style="background:#ef4444; color:#fff; font-weight:bold; border:none; padding:5px 12px; border-radius:8px; cursor:pointer;">🗑️ حذف المحدد</button>
              ` : ''}
              <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.clearSelection()" style="background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.4); padding:5px 10px; border-radius:8px; cursor:pointer;">إلغاء التحديد</button>
            </div>
          </div>

          <!-- Main Content Container -->
          <div id="purchases-main-content"></div>

        </div>
      `;
    }

    _getTabBtnStyle(isActive) {
      if (isActive) {
        return 'padding:8px 16px; font-size:0.84rem; font-weight:800; border-radius:12px; border:1px solid rgba(56,189,248,0.5); background:linear-gradient(135deg, #0284c7, #0f766e); color:#ffffff; display:inline-flex; align-items:center; gap:6px; cursor:pointer; flex-shrink:0; white-space:nowrap; box-shadow:0 4px 14px rgba(2,132,199,0.3);';
      }
      return 'padding:8px 14px; font-size:0.83rem; font-weight:700; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(30,41,59,0.6); color:#94a3b8; display:inline-flex; align-items:center; gap:6px; cursor:pointer; flex-shrink:0; white-space:nowrap;';
    }

    async loadData() {
      try {
        const res = await fetch('/api/purchases', {
          headers: this._getAuthHeaders()
        });
        if (!res.ok) throw new Error('فشل جلب بيانات المشتريات');
        const data = await res.json();
        this.purchases = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.renderKPIs();
        this.updateTabBadges();

        const sidebarBadge = document.getElementById('badge-purchases');
        if (sidebarBadge) {
          sidebarBadge.textContent = this.purchases.length;
        }
      } catch (err) {
        console.error('Failed to load purchases:', err);
        this.renderEmptyState('تعذر الاتصال بخادم المشتريات: ' + err.message);
      }
    }

    renderKPIs() {
      const container = document.getElementById('purchases-kpi-container');
      if (!container) return;

      const totalSpend = this.purchases.reduce((sum, p) => sum + (parseFloat(p.amount || p.value || 0) || 0), 0);
      const pendingApproval = this.purchases.filter(p => (p.status || '').includes('بانتظار') || (p.status || '').includes('مسودة')).length;
      const approvedExecuting = this.purchases.filter(p => (p.status || '').includes('معتمد')).length;
      const receivedClosed = this.purchases.filter(p => (p.status || '').includes('الاستلام') || (p.status || '').includes('مغلقة')).length;

      container.innerHTML = `
        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;">
          <div style="background:rgba(2,132,199,0.15); color:#38bdf8; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">📋</div>
          <div>
            <div style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">إجمالي المعاملات</div>
            <div style="font-size:1.3rem; font-weight:800; color:#f8fafc;">${this.purchases.length} <span style="font-size:0.75rem; color:#94a3b8;">معاملة</span></div>
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;">
          <div style="background:rgba(16,185,129,0.15); color:#10b981; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">💰</div>
          <div>
            <div style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">إجمالي القيمة التقديرية</div>
            <div style="font-size:1.3rem; font-weight:800; color:#10b981;">${totalSpend.toLocaleString('ar-JO')} <span style="font-size:0.75rem; color:#94a3b8;">د.أ</span></div>
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;">
          <div style="background:rgba(217,119,6,0.15); color:#f59e0b; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">⏳</div>
          <div>
            <div style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">سلسلة التوكيد والتدقيق</div>
            <div style="font-size:1.3rem; font-weight:800; color:#f59e0b;">${pendingApproval} <span style="font-size:0.75rem; color:#94a3b8;">طلب</span></div>
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;">
          <div style="background:rgba(5,150,105,0.15); color:#059669; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🚀</div>
          <div>
            <div style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">معتمد قيد التوريد</div>
            <div style="font-size:1.3rem; font-weight:800; color:#059669;">${approvedExecuting} <span style="font-size:0.75rem; color:#94a3b8;">أمر</span></div>
          </div>
        </div>

        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;">
          <div style="background:rgba(16,185,129,0.15); color:#10b981; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🔒</div>
          <div>
            <div style="font-size:0.78rem; color:#94a3b8; font-weight:bold;">مستلم ومغلق رسمياً</div>
            <div style="font-size:1.3rem; font-weight:800; color:#10b981;">${receivedClosed} <span style="font-size:0.75rem; color:#94a3b8;">معاملة</span></div>
          </div>
        </div>
      `;
    }

    updateTabBadges() {
      this.categories.forEach(c => {
        const badge = document.getElementById(`badge-${c.id}`);
        if (!badge) return;

        if (c.id === 'all') {
          badge.textContent = this.purchases.length;
        } else if (c.id === 'map') {
          badge.textContent = this.purchases.length;
        } else {
          const count = this.purchases.filter(p => {
            const cat = p.category || p.purchaseType || '';
            return cat.includes(c.match);
          }).length;
          badge.textContent = count;
        }
      });
    }

    applyFilters() {
      let list = [...this.purchases];

      if (this.currentTab !== 'all' && this.currentTab !== 'map') {
        const catObj = this.categories.find(c => c.id === this.currentTab);
        if (catObj && catObj.match) {
          list = list.filter(p => (p.category || p.purchaseType || '').includes(catObj.match));
        }
      }

      if (this.filters.search) {
        const q = this.filters.search.toLowerCase().trim();
        list = list.filter(p => 
          String(p.id || '').toLowerCase().includes(q) ||
          String(p.item || p.itemDescription || '').toLowerCase().includes(q) ||
          String(p.supplier || '').toLowerCase().includes(q) ||
          String(p.district || '').toLowerCase().includes(q) ||
          String(p.notes || '').toLowerCase().includes(q)
        );
      }

      if (this.filters.category) {
        list = list.filter(p => (p.category || p.purchaseType || '').includes(this.filters.category));
      }

      if (this.filters.status) {
        list = list.filter(p => (p.status || '') === this.filters.status);
      }

      if (this.filters.urgency) {
        list = list.filter(p => (p.urgency || '') === this.filters.urgency);
      }

      this.filteredPurchases = list;
      this.renderMainContent();
    }

    renderMainContent() {
      const container = document.getElementById('purchases-main-content');
      if (!container) return;

      if (this.currentTab === 'map') {
        container.innerHTML = `
          <div style="background:#1e293b; border-radius:18px; border:1px solid rgba(255,255,255,0.08); overflow:hidden; padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="margin:0; font-size:1.1rem; color:#f8fafc; font-weight:800;">🗺️ الخريطة التفاعلية الجغرافية لمواقع المشتريات ومشاريع الصيانة</h3>
              <span style="font-size:0.83rem; color:#94a3b8;">بلدية كفرنجة الجديدة (مركز المدينة والمناطق التابعة)</span>
            </div>
            <div id="purchases-gis-map" style="height:550px; width:100%; border-radius:12px; border:1px solid #334155;"></div>
          </div>
        `;
        this.initGISMap();
        return;
      }

      if (!this.filteredPurchases.length) {
        this.renderEmptyState('لا توجد معاملات شراء أو طلبات صيانة مطابقة للشروط الحالية');
        return;
      }

      if (this.currentViewMode === 'table') {
        this.renderTableView(container);
      } else {
        this.renderGridView(container);
      }
    }

    renderEmptyState(msg) {
      const container = document.getElementById('purchases-main-content');
      if (!container) return;

      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:rgba(30,41,59,0.4); border-radius:18px; border:1px dashed #334155;">
          <div style="font-size:3rem; margin-bottom:12px; opacity:0.6;">📦</div>
          <h3 style="font-size:1.1rem; color:#f8fafc; margin-bottom:6px; font-weight:bold;">${msg}</h3>
          <p style="font-size:0.84rem; color:#94a3b8; margin:0 0 16px 0;">يمكنك إضافة أمر شراء أو صيانة جديد عبر الضغط على الزر أعلاه</p>
          ${this._hasPermission('PURCHASES.CREATE') ? `
            <button class="btn btn-primary" onclick="window.unifiedPurchasesManager.openNewModal()" style="font-weight:bold; padding:8px 18px; border-radius:10px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; cursor:pointer;">
              ✨ إنشاء أول معاملة الآن
            </button>
          ` : ''}
        </div>
      `;
    }

    renderTableView(container) {
      const allSelected = this.filteredPurchases.length > 0 && this.filteredPurchases.every(p => this.selectedIds.has(String(p.id)));
      const totalAmount = this.filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.amount || p.value || 0) || 0), 0);

      container.innerHTML = `
        <div style="background:var(--bg-card, #1e293b); border:1px solid rgba(255,255,255,0.08); border-radius:18px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
          <table style="width:100%; border-collapse:collapse; text-align:right;">
            <thead>
              <tr style="background:rgba(15,23,42,0.8); border-bottom:1px solid #334155; font-size:0.83rem; color:#94a3b8;">
                <th style="padding:14px; width:40px; text-align:center;">
                  <input type="checkbox" id="purchases-select-all-cb" onchange="window.unifiedPurchasesManager.toggleSelectAll(this.checked)" ${allSelected ? 'checked' : ''} style="cursor:pointer;" />
                </th>
                <th style="padding:14px; width:130px;">رقم المعاملة</th>
                <th style="padding:14px; width:120px;">التصنيف</th>
                <th style="padding:14px;">بيان المادة / أمر العمل</th>
                <th style="padding:14px; width:140px;">المورد / الجهة</th>
                <th style="padding:14px; width:120px;">الموقع / الحي</th>
                <th style="padding:14px; width:110px;">القيمة (د.أ)</th>
                <th style="padding:14px; width:150px;">سلسلة التوكيد</th>
                <th style="padding:14px; text-align:center; width:140px;">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${this.filteredPurchases.map(p => {
                const isChecked = this.selectedIds.has(String(p.id));
                const st = this._getStatusBadge(p.status);
                const amt = (parseFloat(p.amount || p.value || 0) || 0).toLocaleString('ar-JO');
                const cat = p.category || p.purchaseType || 'لوازم وشراء مباشر';
                const isPrintable = (p.status || '').includes('معتمد') || (p.status || '').includes('الاستلام') || (p.status || '').includes('مغلقة');

                return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.86rem; transition:background 0.15s; ${isChecked ? 'background:rgba(56,189,248,0.1);' : ''}" onmouseover="this.style.background='rgba(56,189,248,0.06)'" onmouseout="this.style.background='${isChecked ? 'rgba(56,189,248,0.1)' : 'transparent'}'">
                    <td style="padding:12px; text-align:center;">
                      <input type="checkbox" onchange="window.unifiedPurchasesManager.toggleSelectDoc('${p.id}', this.checked)" ${isChecked ? 'checked' : ''} style="cursor:pointer;" />
                    </td>
                    <td style="padding:12px; font-weight:bold; font-family:monospace; color:#38bdf8;">
                      ${p.id}
                      ${p.urgency === 'عاجل' || p.urgency === 'طارئ' ? `<span style="display:block; font-size:0.68rem; color:#ef4444; font-weight:bold;">⚡ ${p.urgency}</span>` : ''}
                    </td>
                    <td style="padding:12px;">
                      <span style="padding:3px 10px; border-radius:10px; font-size:0.75rem; font-weight:bold; background:rgba(2,132,199,0.15); color:#38bdf8;">
                        ${cat}
                      </span>
                    </td>
                    <td style="padding:12px; font-weight:800; color:var(--text, #f8fafc);">
                      <div style="line-height:1.4;">${p.item || p.itemDescription || '—'}</div>
                      <div style="font-size:0.74rem; color:#94a3b8; margin-top:2px;">الكمية: <b>${p.quantity || 1} ${p.unit || 'عدد'}</b> • التاريخ: <b>${p.date || '—'}</b></div>
                    </td>
                    <td style="padding:12px; color:#f8fafc; font-weight:bold;">
                      ${p.supplier || '—'}
                    </td>
                    <td style="padding:12px; color:#94a3b8; font-size:0.82rem;">
                      📍 ${p.district || 'كفرنجة'}
                    </td>
                    <td style="padding:12px; font-weight:bold; font-size:0.92rem; color:#10b981;">
                      ${amt} د.أ
                    </td>
                    <td style="padding:12px;">
                      ${st}
                    </td>
                    <td style="padding:12px; text-align:center;">
                      <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="window.unifiedPurchasesManager.openViewModal('${p.id}')" style="padding:4px 10px; font-size:0.76rem; border-radius:6px; background:#0284c7; border:none; cursor:pointer;" title="تفاصيل ومسار الاعتماد">👁️ تفاصيل</button>
                        ${isPrintable ? `
                          <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.printPurchaseOrder('${p.id}')" style="padding:4px 8px; font-size:0.76rem; border-radius:6px; border:1px solid #0284c7; color:#38bdf8; cursor:pointer;" title="طباعة أمر الشراء المعتمد">🖨️</button>
                          <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.printGoodsReceiptTemplate('${p.id}')" style="padding:4px 8px; font-size:0.76rem; border-radius:6px; border:1px solid #059669; color:#10b981; cursor:pointer;" title="طباعة استمارة ونموذج استلام المواد (قبل الاستلام)">📋</button>
                        ` : `
                          <button class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.76rem; border-radius:6px; border:1px solid #1e293b; color:#475569; cursor:not-allowed; opacity:0.4;" title="الطباعة معلقة لحين اكتمال سلسلة التوكيد" disabled>🔒</button>
                        `}
                        ${this._hasPermission('PURCHASES.EDIT') ? `
                          <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.openEditModal('${p.id}')" style="padding:4px 8px; font-size:0.76rem; border-radius:6px; border:1px solid #334155; color:#fff; cursor:pointer;" title="تعديل">✏️</button>
                        ` : ''}
                        ${this._hasPermission('PURCHASES.DELETE') ? `
                          <button class="btn btn-sm btn-danger" onclick="window.unifiedPurchasesManager.confirmDelete('${p.id}')" style="padding:4px 8px; font-size:0.76rem; border-radius:6px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#ef4444; cursor:pointer;" title="حذف">🗑️</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div style="padding:12px 18px; background:#0f172a; border-top:1px solid #334155; display:flex; justify-content:space-between; align-items:center; font-size:0.83rem; color:#94a3b8;">
            <span>إجمالي المعاملات المدرجة: <b style="color:#38bdf8;">${this.filteredPurchases.length}</b> معاملة</span>
            <span>إجمالي القيمة: <b style="color:#10b981; font-size:0.95rem;">${totalAmount.toLocaleString('ar-JO')} د.أ</b></span>
          </div>
        </div>
      `;
    }

    renderGridView(container) {
      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:18px;">
          ${this.filteredPurchases.map(p => {
            const isChecked = this.selectedIds.has(String(p.id));
            const st = this._getStatusBadge(p.status);
            const amt = (parseFloat(p.amount || p.value || 0) || 0).toLocaleString('ar-JO');
            const cat = p.category || p.purchaseType || 'لوازم وشراء مباشر';
            const isPrintable = (p.status || '').includes('معتمد') || (p.status || '').includes('الاستلام') || (p.status || '').includes('مغلقة');

            return `
              <div style="background:var(--bg-card, #1e293b); border:1px solid ${isChecked ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; border-radius:16px; padding:18px; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.2s ease; box-shadow:0 6px 20px rgba(0,0,0,0.2);">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <input type="checkbox" onchange="window.unifiedPurchasesManager.toggleSelectDoc('${p.id}', this.checked)" ${isChecked ? 'checked' : ''} style="cursor:pointer;" />
                      <span style="font-weight:bold; font-family:monospace; color:#38bdf8; font-size:0.88rem;">${p.id}</span>
                    </div>
                    ${st}
                  </div>

                  <div style="font-size:1rem; font-weight:800; color:var(--text, #f8fafc); line-height:1.4; margin-bottom:8px;">
                    ${p.item || p.itemDescription || '—'}
                  </div>

                  <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px; margin-bottom:12px; font-size:0.8rem; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                      <span>المورد / المنفذ:</span>
                      <b style="color:#f8fafc;">${p.supplier || '—'}</b>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                      <span>الموقع والحي:</span>
                      <span style="color:#f8fafc;">📍 ${p.district || 'كفرنجة'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:#94a3b8;">
                      <span>الكمية والقيمة:</span>
                      <b style="color:#10b981;">${p.quantity || 1} ${p.unit || 'عدد'} | ${amt} د.أ</b>
                    </div>
                  </div>
                </div>

                <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                  <button class="btn btn-sm btn-primary" onclick="window.unifiedPurchasesManager.openViewModal('${p.id}')" style="flex:1; padding:6px 12px; font-weight:bold; border-radius:8px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; cursor:pointer;">
                    👁️ تفاصيل ومسار
                  </button>
                  ${isPrintable ? `
                    <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.printPurchaseOrder('${p.id}')" style="padding:6px 10px; border-radius:8px; border:1px solid #0284c7; color:#38bdf8;" title="طباعة أمر الشراء المعتمد">
                      🖨️
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.printGoodsReceiptTemplate('${p.id}')" style="padding:6px 10px; border-radius:8px; border:1px solid #059669; color:#10b981;" title="طباعة نموذج استلام المواد">
                      📋
                    </button>
                  ` : ''}
                  ${this._hasPermission('PURCHASES.EDIT') ? `
                    <button class="btn btn-sm btn-outline" onclick="window.unifiedPurchasesManager.openEditModal('${p.id}')" style="padding:6px 10px; border-radius:8px; border:1px solid #334155; color:#fff;" title="تعديل">
                      ✏️
                    </button>
                  ` : ''}
                  ${this._hasPermission('PURCHASES.DELETE') ? `
                    <button class="btn btn-sm btn-danger" onclick="window.unifiedPurchasesManager.confirmDelete('${p.id}')" style="padding:6px 10px; border-radius:8px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#ef4444;" title="حذف">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    _getStatusBadge(status) {
      const match = this.workflowStages.find(s => s.key === status) || { label: status || 'مسودة', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
      return `<span style="display:inline-block; padding:4px 12px; border-radius:12px; font-size:0.75rem; font-weight:800; color:${match.color}; background:${match.bg}; border:1px solid ${match.color};">${match.label}</span>`;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       7. الخريطة التفاعلية الجغرافية (GIS)
       ═══════════════════════════════════════════════════════════════════════════ */
    initGISMap() {
      setTimeout(() => {
        const mapEl = document.getElementById('purchases-gis-map');
        if (!mapEl) return;

        if (typeof L === 'undefined') {
          mapEl.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">جاري تحميل محرك الخرائط الجغرافية GIS...</div>';
          return;
        }

        if (!this.map) {
          this.map = L.map('purchases-gis-map').setView([32.2985, 35.7050], 14);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: '© Esri World Street - بلدية كفرنجة الجديدة'
          }).addTo(this.map);
          this.markersLayer = L.layerGroup().addTo(this.map);
        } else {
          this.map.invalidateSize();
        }

        this.markersLayer.clearLayers();

        this.purchases.forEach(p => {
          const lat = parseFloat(p.lat) || 32.2985;
          const lng = parseFloat(p.lng) || 35.7050;
          
          let color = '#0284c7';
          if ((p.category || p.purchaseType || '').includes('صيانة')) color = '#d97706';
          if ((p.category || p.purchaseType || '').includes('مواد')) color = '#059669';

          const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
          });

          marker.bindPopup(`
            <div style="direction:rtl; font-family:'Tajawal',sans-serif; text-align:right; min-width:190px;">
              <b style="color:#0284c7; font-size:0.9rem;">${p.id}</b>
              <div style="font-weight:bold; margin:4px 0; color:#0f172a;">${p.item || p.itemDescription}</div>
              <div style="font-size:0.8rem; color:#64748b;">المورد: ${p.supplier || '—'}</div>
              <div style="font-size:0.8rem; color:#059669; font-weight:bold; margin-top:2px;">القيمة: ${(p.amount || 0).toLocaleString('ar-JO')} د.أ</div>
              <div style="margin-top:6px; font-size:0.75rem; color:#334155;">الحالة: ${p.status || 'مسودة'}</div>
            </div>
          `);

          this.markersLayer.addLayer(marker);
        });
      }, 150);
    }

    _initModalMap(targetMapId, latInputId, lngInputId, initialLat, initialLng) {
      setTimeout(() => {
        const container = document.getElementById(targetMapId);
        if (!container || typeof L === 'undefined') return;

        const defaultLat = parseFloat(initialLat) || 32.2985;
        const defaultLng = parseFloat(initialLng) || 35.7050;

        if (this._modalMapInstance) {
          try { this._modalMapInstance.remove(); } catch (e) {}
          this._modalMapInstance = null;
        }

        const streetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '© Esri World Street'
        });
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        });

        this._modalMapInstance = L.map(targetMapId, {
          center: [defaultLat, defaultLng],
          zoom: 14,
          layers: [streetLayer]
        });

        L.control.layers({
          '🗺️ خريطة الشوارع': streetLayer,
          '🌐 OpenStreetMap': osmLayer
        }, null, { position: 'topleft' }).addTo(this._modalMapInstance);

        let marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(this._modalMapInstance);

        const updateInputs = (lat, lng) => {
          const latEl = document.getElementById(latInputId);
          const lngEl = document.getElementById(lngInputId);
          const coordsDisplay = document.getElementById(targetMapId + '-coords');
          if (latEl) latEl.value = lat.toFixed(6);
          if (lngEl) lngEl.value = lng.toFixed(6);
          if (coordsDisplay) coordsDisplay.innerHTML = `📍 الإحداثيات المحددة: خط العرض <b>${lat.toFixed(5)}</b> | خط الطول <b>${lng.toFixed(5)}</b>`;
        };

        this._modalMapInstance.on('click', (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng(e.latlng);
          updateInputs(lat, lng);
        });

        marker.on('dragend', (de) => {
          const pos = de.target.getLatLng();
          updateInputs(pos.lat, pos.lng);
        });

        updateInputs(defaultLat, defaultLng);

        setTimeout(() => {
          if (this._modalMapInstance) this._modalMapInstance.invalidateSize();
        }, 250);
      }, 150);
    }

    _initViewMap(lat, lng, title) {
      setTimeout(() => {
        const container = document.getElementById('pview-gis-map');
        if (!container || typeof L === 'undefined') return;

        const finalLat = parseFloat(lat) || 32.2985;
        const finalLng = parseFloat(lng) || 35.7050;

        if (this._viewMapInstance) {
          try { this._viewMapInstance.remove(); } catch (e) {}
          this._viewMapInstance = null;
        }

        const streetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '© Esri World Street'
        });

        this._viewMapInstance = L.map('pview-gis-map', {
          center: [finalLat, finalLng],
          zoom: 15,
          layers: [streetLayer]
        });

        const marker = L.marker([finalLat, finalLng]).addTo(this._viewMapInstance);
        marker.bindPopup(`<b>${title || 'موقع طلب الشراء / الصيانة'}</b><br>بلدية كفرنجة الجديدة`).openPopup();

        setTimeout(() => {
          if (this._viewMapInstance) this._viewMapInstance.invalidateSize();
        }, 250);
      }, 150);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       8. النوافذ التفاعلية (View / New / Edit Modals)
       ═══════════════════════════════════════════════════════════════════════════ */
    openViewModal(id) {
      const record = this.purchases.find(p => String(p.id) === String(id));
      if (!record) return;

      let modal = document.getElementById('purchases-view-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'purchases-view-modal';
        modal.className = 'umw-modal-overlay';
        document.body.appendChild(modal);
      }

      const st = this._getStatusBadge(record.status);
      const history = Array.isArray(record.workflowHistory) ? record.workflowHistory : [];

      const currentStatus = record.status || 'مسودة / قيد التنظيم';
      const isApproved = currentStatus.includes('معتمد') || currentStatus.includes('الاستلام') || currentStatus.includes('مغلقة');
      const isClosed = currentStatus.includes('مغلقة') || currentStatus.includes('تم الاستلام والتسديد') || record.isClosed;

      // حساب مرحلة السلسلة الحالية
      let activeStepIdx = 1;
      if (currentStatus.includes('رئيس القسم') || currentStatus.includes('تدقيق')) activeStepIdx = 2;
      else if (currentStatus.includes('مدير الأشغال') || currentStatus.includes('مصادقة')) activeStepIdx = 3;
      else if (currentStatus.includes('معتمد')) activeStepIdx = 4;
      else if (isClosed) activeStepIdx = 5;

      modal.innerHTML = `
        <div style="background:#1e293b; border-radius:18px; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:780px; box-shadow:0 25px 70px rgba(0,0,0,0.6); overflow:hidden; font-family:'Tajawal', sans-serif; direction:rtl; color:#f8fafc; animation:fadeIn 0.2s ease;">
          
          <!-- Modal Header -->
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px; font-weight:800; font-size:1.1rem;">
              <span>🛒</span> <span>تفاصيل ومسار اعتماد المعاملة: ${record.id}</span>
            </div>
            <button onclick="document.getElementById('purchases-view-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
          </div>

          <div style="padding:22px; max-height:80vh; overflow-y:auto;">
            
            <!-- Header Card -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <h3 style="margin:0; font-size:1.15rem; color:#f8fafc; font-weight:800;">${record.item || record.itemDescription}</h3>
                ${st}
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.82rem; color:#94a3b8;">
                <span><b>التصنيف:</b> <span style="color:#38bdf8;">${record.category || record.purchaseType || 'لوازم وشراء مباشر'}</span></span> •
                <span><b>المورد / الجهة:</b> <span style="color:#f8fafc;">${record.supplier || '—'}</span></span> •
                <span><b>تاريخ الطلب:</b> <span style="color:#f8fafc;">${record.date || '—'}</span></span> •
                <span><b>درجة الأهمية:</b> <span style="color:#fbbf24;">${record.urgency || 'عادي'}</span></span>
              </div>
            </div>

            <!-- Verification Progress Stepper -->
            <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:14px; padding:16px; margin-bottom:16px;">
              <div style="font-weight:800; font-size:0.88rem; color:#38bdf8; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span>⛓️</span> <span>سلسلة التوكيد والمسار الإداري المعتمد:</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; text-align:center;">
                
                <div style="padding:8px 4px; border-radius:8px; border:1px solid ${activeStepIdx >= 1 ? '#0284c7' : '#334155'}; background:${activeStepIdx >= 1 ? 'rgba(2,132,199,0.15)' : 'transparent'};">
                  <div style="font-size:0.95rem;">📝</div>
                  <div style="font-size:0.72rem; font-weight:bold; color:${activeStepIdx >= 1 ? '#38bdf8' : '#64748b'};">1. تنظيم الطلب</div>
                </div>

                <div style="padding:8px 4px; border-radius:8px; border:1px solid ${activeStepIdx >= 2 ? '#d97706' : '#334155'}; background:${activeStepIdx >= 2 ? 'rgba(217,119,6,0.15)' : 'transparent'};">
                  <div style="font-size:0.95rem;">🔍</div>
                  <div style="font-size:0.72rem; font-weight:bold; color:${activeStepIdx >= 2 ? '#fbbf24' : '#64748b'};">2. تدقيق اللوازم</div>
                </div>

                <div style="padding:8px 4px; border-radius:8px; border:1px solid ${activeStepIdx >= 3 ? '#2563eb' : '#334155'}; background:${activeStepIdx >= 3 ? 'rgba(37,99,235,0.15)' : 'transparent'};">
                  <div style="font-size:0.95rem;">⚖️</div>
                  <div style="font-size:0.72rem; font-weight:bold; color:${activeStepIdx >= 3 ? '#60a5fa' : '#64748b'};">3. مصادقة المدير</div>
                </div>

                <div style="padding:8px 4px; border-radius:8px; border:1px solid ${activeStepIdx >= 4 ? '#059669' : '#334155'}; background:${activeStepIdx >= 4 ? 'rgba(5,150,105,0.15)' : 'transparent'};">
                  <div style="font-size:0.95rem;">🚀</div>
                  <div style="font-size:0.72rem; font-weight:bold; color:${activeStepIdx >= 4 ? '#34d399' : '#64748b'};">4. أمر الشراء</div>
                </div>

                <div style="padding:8px 4px; border-radius:8px; border:1px solid ${activeStepIdx >= 5 ? '#10b981' : '#334155'}; background:${activeStepIdx >= 5 ? 'rgba(16,185,129,0.2)' : 'transparent'};">
                  <div style="font-size:0.95rem;">🔒</div>
                  <div style="font-size:0.72rem; font-weight:bold; color:${activeStepIdx >= 5 ? '#10b981' : '#64748b'};">5. الاستلام والإغلاق</div>
                </div>

              </div>
            </div>

            <!-- Financial & Quantities Details -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
              <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; font-size:0.84rem;">
                <div style="color:#94a3b8; margin-bottom:4px;">الكمية والوحدة:</div>
                <b style="color:#f8fafc; font-size:1.05rem;">${record.quantity || 1} ${record.unit || 'عدد'}</b>
              </div>
              <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; font-size:0.84rem;">
                <div style="color:#94a3b8; margin-bottom:4px;">القيمة المالية المعتمدة:</div>
                <b style="color:#10b981; font-size:1.15rem;">${(record.amount || record.value || 0).toLocaleString('ar-JO')} د.أ</b>
              </div>
            </div>

            <!-- GIS Map Location Container -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:14px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-weight:800; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <span>📍</span> <span>الموقع الجغرافي المعتمد (محرك الخرائط GIS):</span>
                </div>
                <span style="font-size:0.8rem; color:#94a3b8;">${record.district || 'كفرنجة'} - ${record.street || 'الشارع الرئيسي'}</span>
              </div>
              <div id="pview-gis-map" style="height:160px; width:100%; border-radius:10px; border:1px solid #334155;"></div>
              <div style="font-size:0.76rem; color:#64748b; margin-top:6px;">
                الإحداثيات الجغرافية: Lat: <b>${(record.lat || 32.2985)}</b> | Lng: <b>${(record.lng || 35.7050)}</b>
              </div>
            </div>

            <!-- Intermediate Workflow Decision Buttons -->
            ${!isClosed ? `
              <div style="background:linear-gradient(135deg, rgba(2,132,199,0.1), rgba(15,118,110,0.1)); border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:16px; margin-bottom:16px;">
                <div style="font-weight:800; font-size:0.9rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                  <span>⚡</span> <span>إجراءات مسار الاعتماد الإداري:</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  ${activeStepIdx === 1 ? `
                    <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.advanceWorkflow('${record.id}', 'بانتظار تدقيق رئيس القسم')" style="background:#d97706; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-weight:bold; cursor:pointer;">
                      📤 إرسال لتدقيق رئيس قسم اللوازم (المرحلة 2)
                    </button>
                  ` : ''}

                  ${activeStepIdx === 2 && this._hasPermission('PURCHASES.APPROVE') ? `
                    <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.advanceWorkflow('${record.id}', 'بانتظار مصادقة مدير الأشغال')" style="background:#2563eb; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-weight:bold; cursor:pointer;">
                      ⚖️ إحالة لمصادقة مدير الأشغال (المرحلة 3)
                    </button>
                  ` : ''}

                  ${activeStepIdx === 3 && this._hasPermission('PURCHASES.APPROVE') ? `
                    <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.advanceWorkflow('${record.id}', 'معتمد / قيد التوريد والتنفيذ')" style="background:#059669; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-weight:bold; cursor:pointer;">
                      ✅ اعتماد ومصادقة نهائية وإصدار أمر الشراء (المرحلة 4)
                    </button>
                  ` : ''}

                  ${activeStepIdx > 1 && !isApproved ? `
                    <button class="btn btn-sm" onclick="window.unifiedPurchasesManager.advanceWorkflow('${record.id}', 'معاد للتعديل')" style="background:#ef4444; color:#fff; border:none; border-radius:8px; padding:7px 14px; font-weight:bold; cursor:pointer;">
                      ↩️ إعادة للتعديل
                    </button>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Receiving & Closing Hub (Active when Approved and not yet closed) -->
            ${isApproved && !isClosed ? `
              <div style="background:linear-gradient(135deg, rgba(5,150,105,0.15), rgba(16,185,129,0.1)); border:1px solid rgba(16,185,129,0.4); border-radius:14px; padding:18px; margin-bottom:16px;">
                <div style="font-weight:800; font-size:0.95rem; color:#10b981; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                  <span>📦</span> <span>توثيق استلام المواد وسند الإدخال وإغلاق المعاملة (المرحلة 5 النهائية):</span>
                </div>
                <p style="font-size:0.82rem; color:#94a3b8; margin:0 0 14px 0;">
                  يتم إغلاق المعاملة رسمياً عند رفع مذكرة الاستلام وسند الإدخال المخزني من قبل المستخدم صاحب الصلاحية.
                </p>

                <!-- شريط طباعة استمارة ونموذج الاستلام الميداني قبل الاستلام -->
                <div style="background:#0f172a; border:1px solid #059669; border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                  <div>
                    <div style="font-weight:800; font-size:0.86rem; color:#10b981; display:flex; align-items:center; gap:6px;">
                      <span>📋</span> <span>استمارة ونموذج استلام المواد الميداني (جاهز للطباعة والتعبئة والتوقيع):</span>
                    </div>
                    <div style="font-size:0.78rem; color:#94a3b8; margin-top:2px;">
                      يمكنك طباعة هذا النموذج المعتمد لإجراء الفحص الحسي وتوقيعه من لجنة الاستلام وأمين المستودع عند التوريد، ثم رفعه أدناه.
                    </div>
                  </div>
                  <button type="button" class="btn btn-outline" onclick="window.unifiedPurchasesManager.printGoodsReceiptTemplate('${record.id}')" style="font-weight:bold; font-size:0.82rem; padding:6px 14px; border-radius:8px; color:#10b981; border:1px solid #059669; background:rgba(16,185,129,0.1); cursor:pointer;">
                    🖨️ طباعة نموذج الاستلام الورقي
                  </button>
                </div>

                <form onsubmit="window.unifiedPurchasesManager.submitCloseAndReceive(event, '${record.id}')" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                  <div>
                    <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px; color:#f8fafc;">رقم مذكرة الاستلام / سند الإدخال <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="pclose-receipt-num" name="receiptNumber" required placeholder="مثال: REC-2026-084" 
                      style="width:100%; padding:8px 12px; border:1px solid #334155; border-radius:8px; font-size:0.84rem; background:#0f172a; color:#f8fafc;" />
                  </div>
                  <div>
                    <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px; color:#f8fafc;">اسم المستلم / أمين المستودع <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="pclose-receiver" name="receiverName" value="${this.currentUser?.fullName || 'أمين المستودع'}" required 
                      style="width:100%; padding:8px 12px; border:1px solid #334155; border-radius:8px; font-size:0.84rem; background:#0f172a; color:#f8fafc;" />
                  </div>
                  <div>
                    <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px; color:#f8fafc;">رفع مذكرة وسند استلام المواد (PDF/صورة) <span style="color:#ef4444;">*</span></label>
                    <input type="file" id="pclose-receipt-file" name="receiptFile" required 
                      style="width:100%; padding:6px; border:1px dashed #10b981; border-radius:8px; font-size:0.8rem; background:#0f172a; color:#f8fafc;" />
                  </div>
                  <div>
                    <label style="display:block; font-size:0.8rem; font-weight:bold; margin-bottom:4px; color:#f8fafc;">رفع أمر الشراء الموقع والمختوم (اختياري)</label>
                    <input type="file" id="pclose-order-file" name="orderFile" 
                      style="width:100%; padding:6px; border:1px dashed #0284c7; border-radius:8px; font-size:0.8rem; background:#0f172a; color:#f8fafc;" />
                  </div>
                  <div style="grid-column:1 / -1; margin-top:6px; display:flex; justify-content:flex-end;">
                    <button type="submit" id="pclose-submit-btn" class="btn btn-primary" style="font-weight:800; padding:9px 22px; border-radius:10px; background:linear-gradient(135deg, #059669, #10b981); border:none; cursor:pointer;">
                      🔒 اعتماد الاستلام وتوثيق المستندات وإغلاق المعاملة رسمياً
                    </button>
                  </div>
                </form>
              </div>
            ` : ''}

            <!-- Closed Transaction Certificate Display -->
            ${isClosed ? `
              <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.4); border-radius:14px; padding:16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div style="font-weight:800; font-size:0.95rem; color:#10b981; display:flex; align-items:center; gap:8px;">
                    <span>🛡️</span> <span>المعاملة مكتملة ومغلقة رسمياً ومطابقة للمواصفات</span>
                  </div>
                  <span style="font-size:0.8rem; color:#94a3b8;">تاريخ الإغلاق: ${record.closedAt ? new Date(record.closedAt).toLocaleDateString('ar-JO') : record.updatedAt?.split('T')[0]}</span>
                </div>
                <div style="font-size:0.84rem; color:#f8fafc; margin-bottom:10px;">
                  تم استلام المواد وتدقيقها وإدخالها بالمستودعات بواسطة: <b>${record.receiverName || record.closedBy || 'أمين المستودع'}</b> 
                  ${record.receiptNumber ? `• سند إدخال رقم: <b style="color:#38bdf8;">${record.receiptNumber}</b>` : ''}
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                  ${record.receiptFilePath ? `
                    <a href="/uploads/${record.receiptFilePath}" target="_blank" style="padding:6px 12px; border-radius:8px; background:#0f172a; border:1px solid #10b981; color:#10b981; font-size:0.8rem; text-decoration:none; font-weight:bold; display:inline-flex; align-items:center; gap:6px;">
                      📄 عرض مذكرة الاستلام المرفوعة
                    </a>
                  ` : ''}
                  ${record.orderFilePath ? `
                    <a href="/uploads/${record.orderFilePath}" target="_blank" style="padding:6px 12px; border-radius:8px; background:#0f172a; border:1px solid #0284c7; color:#38bdf8; font-size:0.8rem; text-decoration:none; font-weight:bold; display:inline-flex; align-items:center; gap:6px;">
                      📜 عرض أمر الشراء الموقع
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Dynamic Receiving Committee Management Card -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:14px; padding:16px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <div style="font-weight:800; font-size:0.92rem; color:#38bdf8; display:flex; align-items:center; gap:8px;">
                  <span>👥</span> <span>أعضاء وصفات لجنة الاستلام والتسليم (إدخال وتعديل يدوي للأدوار والأسماء):</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="button" onclick="window.unifiedPurchasesManager.addCommitteeRow('${record.id}')" 
                    style="padding:6px 12px; border-radius:8px; background:#1e293b; border:1px solid #38bdf8; color:#38bdf8; font-weight:bold; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:5px;">
                    ➕ إضافة صفة / عضو
                  </button>
                  <button type="button" id="pview-comm-save-btn-${record.id}" onclick="window.unifiedPurchasesManager.saveCommitteeMembers('${record.id}')" 
                    style="padding:6px 14px; border-radius:8px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; color:#fff; font-weight:bold; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                    💾 حفظ وتثبيت أسماء وصفات اللجنة
                  </button>
                </div>
              </div>

              <div id="pview-comm-list-${record.id}" style="display:flex; flex-direction:column; gap:10px;">
                ${this._renderCommitteeRowsHtml(record.id, record.receivingCommittee || [
                  { role: 'رئيس لجنة الاستلام والمشاريع', name: record.committeeHead || 'رئيس قسم العطاءات والمشاريع' },
                  { role: 'عضو لجنة الاستلام الفني', name: record.committeeMember || 'مهندس تنفيذ أشغال' },
                  { role: 'أمين المستودعات واللوازم', name: record.warehouseKeeper || record.receiverName || 'محاسب ومدقق مالي / أمين المستودع' },
                  { role: 'مندوب المورد / المتعهد المسلم', name: record.supplierRepresentative || record.supplier || '' }
                ])}
              </div>
            </div>

            <!-- Notes & Audit Trail -->
            ${record.notes ? `
              <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; font-size:0.86rem; margin-bottom:16px;">
                <b style="color:#38bdf8;">ملاحظات ووصف الطلب:</b>
                <div style="margin-top:4px; color:#f8fafc; line-height:1.6;">${record.notes}</div>
              </div>
            ` : ''}

            <!-- Bottom Actions Bar with Verification Gate -->
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:16px; flex-wrap:wrap; gap:10px;">
              <div>
                ${!isApproved ? `
                  <div style="background:rgba(217,119,6,0.12); border:1px solid rgba(217,119,6,0.3); border-radius:10px; padding:8px 14px; font-size:0.82rem; color:#f59e0b; display:flex; align-items:center; gap:8px;">
                    <span>🔒</span> <span>أمر الشراء ومذكرات الاستلام تصدر وتتاح طباعتها حصراً بعد إتمام سلسلة التوكيد ومصادقة مدير الأشغال.</span>
                  </div>
                ` : `
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.printPurchaseOrder('${record.id}')" style="font-weight:bold; padding:8px 14px; border-radius:8px; color:#38bdf8; border:1px solid #0284c7; background:rgba(2,132,199,0.1); cursor:pointer;" title="طباعة أمر الشراء المعتمد">
                      🖨️ طباعة أمر الشراء المعتمد
                    </button>
                    <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.printGoodsReceiptTemplate('${record.id}')" style="font-weight:bold; padding:8px 14px; border-radius:8px; color:#059669; border:1px solid #059669; background:rgba(5,150,105,0.1); cursor:pointer;" title="طباعة استمارة ونموذج استلام وفحص المواد قبل الاستلام">
                      📋 نموذج استلام المواد (قبل الاستلام)
                    </button>
                    ${isClosed ? `
                      <button class="btn btn-outline" onclick="window.unifiedPurchasesManager.printGoodsReceipt('${record.id}')" style="font-weight:bold; padding:8px 14px; border-radius:8px; color:#10b981; border:1px solid #10b981; background:rgba(16,185,129,0.1); cursor:pointer;" title="طباعة مذكرة وسند الاستلام بعد الإغلاق">
                        📦 طباعة مذكرة وسند الإدخال المعتمد
                      </button>
                    ` : ''}
                  </div>
                `}
              </div>
              <button class="btn btn-outline" onclick="document.getElementById('purchases-view-modal').style.display='none'" style="padding:8px 18px; border-radius:10px; border:1px solid #334155; color:#94a3b8; cursor:pointer;">إغلاق</button>
            </div>

          </div>

        </div>
      `;

      modal.style.display = 'flex';
      this._initViewMap(record.lat, record.lng, record.item || record.itemDescription);
    }

    _renderCommitteeRowsHtml(id, list) {
      if (!Array.isArray(list) || list.length === 0) {
        list = [
          { role: 'رئيس لجنة الاستلام والمشاريع', name: '' },
          { role: 'عضو لجنة الاستلام الفني', name: '' },
          { role: 'أمين المستودعات واللوازم', name: '' },
          { role: 'مندوب المورد / المتعهد المسلم', name: '' }
        ];
      }

      return list.map((item, idx) => `
        <div class="pview-comm-row" id="pview-comm-row-${id}-${idx}" style="display:grid; grid-template-columns: 1fr 1.2fr auto; gap:10px; align-items:center; background:#1e293b; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
          <div>
            <label style="display:block; font-size:0.72rem; color:#94a3b8; font-weight:bold; margin-bottom:3px;">الصفة / الدور في اللجنة (يدوياً):</label>
            <input type="text" class="pview-comm-role" value="${(item.role || '').replace(/"/g, '&quot;')}" placeholder="الصفة باللجنة (مثال: رئيس اللجنة، عضو فني...)" 
              style="width:100%; padding:7px 10px; border:1px solid #334155; border-radius:6px; font-size:0.83rem; background:#0f172a; color:#38bdf8; font-weight:bold;" />
          </div>
          <div>
            <label style="display:block; font-size:0.72rem; color:#94a3b8; font-weight:bold; margin-bottom:3px;">الاسم الثلاثي / المسمى (يدوياً):</label>
            <input type="text" class="pview-comm-name" value="${(item.name || '').replace(/"/g, '&quot;')}" placeholder="أدخل اسم الشخص أو المسؤول..." 
              style="width:100%; padding:7px 10px; border:1px solid #334155; border-radius:6px; font-size:0.83rem; background:#0f172a; color:#f8fafc; font-weight:bold;" />
          </div>
          <div style="padding-top:14px;">
            <button type="button" onclick="this.closest('.pview-comm-row').remove()" title="حذف هذا العضو من اللجنة" 
              style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:0.82rem; font-weight:bold;">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    }

    addCommitteeRow(id) {
      const container = document.getElementById(`pview-comm-list-${id}`);
      if (!container) return;
      const newIdx = container.querySelectorAll('.pview-comm-row').length + '_' + Date.now();
      const rowHtml = `
        <div class="pview-comm-row" id="pview-comm-row-${id}-${newIdx}" style="display:grid; grid-template-columns: 1fr 1.2fr auto; gap:10px; align-items:center; background:#1e293b; padding:10px 12px; border-radius:10px; border:1px solid #0284c7; margin-top:4px;">
          <div>
            <label style="display:block; font-size:0.72rem; color:#94a3b8; font-weight:bold; margin-bottom:3px;">الصفة / الدور في اللجنة (يدوياً):</label>
            <input type="text" class="pview-comm-role" value="عضو لجنة الاستلام" placeholder="الصفة باللجنة..." 
              style="width:100%; padding:7px 10px; border:1px solid #334155; border-radius:6px; font-size:0.83rem; background:#0f172a; color:#38bdf8; font-weight:bold;" />
          </div>
          <div>
            <label style="display:block; font-size:0.72rem; color:#94a3b8; font-weight:bold; margin-bottom:3px;">الاسم الثلاثي / المسمى (يدوياً):</label>
            <input type="text" class="pview-comm-name" value="" placeholder="أدخل اسم الشخص أو المسؤول..." 
              style="width:100%; padding:7px 10px; border:1px solid #334155; border-radius:6px; font-size:0.83rem; background:#0f172a; color:#f8fafc; font-weight:bold;" />
          </div>
          <div style="padding-top:14px;">
            <button type="button" onclick="this.closest('.pview-comm-row').remove()" title="حذف هذا العضو" 
              style="background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#ef4444; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:0.82rem; font-weight:bold;">
              🗑️
            </button>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', rowHtml);
    }

    async saveCommitteeMembers(id) {
      const container = document.getElementById(`pview-comm-list-${id}`);
      const saveBtn = document.getElementById(`pview-comm-save-btn-${id}`);
      const rows = container ? container.querySelectorAll('.pview-comm-row') : [];

      const receivingCommittee = [];
      rows.forEach(r => {
        const role = r.querySelector('.pview-comm-role')?.value.trim() || '';
        const name = r.querySelector('.pview-comm-name')?.value.trim() || '';
        if (role || name) {
          receivingCommittee.push({ role: role || 'عضو لجنة الاستلام', name: name || '' });
        }
      });

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ جاري الحفظ...';
      }

      try {
        const res = await fetch(`/api/purchases/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this._getAuthHeaders()
          },
          body: JSON.stringify({
            receivingCommittee,
            committeeHead: receivingCommittee[0]?.name || '',
            committeeMember: receivingCommittee[1]?.name || '',
            warehouseKeeper: receivingCommittee[2]?.name || '',
            supplierRepresentative: receivingCommittee[3]?.name || ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل حفظ أسماء وصفات اللجنة');

        // Update local cache
        const idx = this.purchases.findIndex(p => String(p.id) === String(id));
        if (idx !== -1) {
          this.purchases[idx].receivingCommittee = receivingCommittee;
          if (receivingCommittee[0]) this.purchases[idx].committeeHead = receivingCommittee[0].name;
          if (receivingCommittee[1]) this.purchases[idx].committeeMember = receivingCommittee[1].name;
          if (receivingCommittee[2]) this.purchases[idx].warehouseKeeper = receivingCommittee[2].name;
          if (receivingCommittee[3]) this.purchases[idx].supplierRepresentative = receivingCommittee[3].name;
        }

        alert('✅ تم حفظ وتثبيت أدوار وأسماء أعضاء لجنة الاستلام يدوياً بنجاح! ستنعكس التواقيع والصفات فوراً في التقارير.');
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 حفظ وتثبيت أسماء وصفات اللجنة';
        }
      }
    }

    openNewModal() {
      let modal = document.getElementById('purchases-form-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'purchases-form-modal';
        modal.className = 'umw-modal-overlay';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:#1e293b; border-radius:18px; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:720px; box-shadow:0 25px 70px rgba(0,0,0,0.6); overflow:hidden; font-family:'Tajawal', sans-serif; direction:rtl; color:#f8fafc; animation:fadeIn 0.2s ease;">
          
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:1.1rem;">✨ إصدار طلب / أمر شراء وصيانة جديد</div>
            <button onclick="document.getElementById('purchases-form-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
          </div>

          <form id="purchases-new-form" onsubmit="window.unifiedPurchasesManager.submitNew(event)" style="padding:22px; max-height:80vh; overflow-y:auto;">
            
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">اسم المادة / بيان أعمال الصيانة <span style="color:#ef4444;">*</span></label>
              <input type="text" id="pform-item" name="item" required placeholder="مثال: توريد خلطة إسفلتية ساخنة لصيانة الشارع الرئيسي..." 
                style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">التصنيف الرئيسي <span style="color:#ef4444;">*</span></label>
                <select id="pform-category" name="category" required style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;">
                  <option value="لوازم وشراء مباشر">🛒 أوامر الشراء المباشر واللوازم</option>
                  <option value="طلب صيانة وأعمال">🛠️ طلبات الصيانة وأوامر العمل</option>
                  <option value="مواد بناء وتوريدات">🧱 مواد البناء والتوريدات الإنشائية</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">المورد / الجهة المنفذة</label>
                <input type="text" id="pform-supplier" name="supplier" placeholder="اسم الشركة أو المورد المعتمد..." 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">الكمية</label>
                <input type="number" id="pform-qty" name="quantity" value="1" min="1" step="any" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">الوحدة</label>
                <input type="text" id="pform-unit" name="unit" value="عدد" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">القيمة التقديرية (د.أ) <span style="color:#ef4444;">*</span></label>
                <input type="number" id="pform-amount" name="amount" required min="0" step="any" placeholder="0.00" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">الحي / المنطقة</label>
                <input type="text" id="pform-district" name="district" value="كفرنجة" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">درجة الأهمية</label>
                <select id="pform-urgency" name="urgency" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;">
                  <option value="عادي">عادي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="عاجل">عاجل ⚡</option>
                  <option value="طارئ">طارئ جداً 🚨</option>
                </select>
              </div>
            </div>

            <!-- GIS Map Location Picker -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <label style="font-size:0.84rem; font-weight:bold; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                  <span>📍</span> <span>تحديد الموقع الجغرافي على الخريطة (GIS Location Picker):</span>
                </label>
                <span id="pmodal-gis-map-coords" style="font-size:0.75rem; color:#94a3b8;">انقر على الخريطة لتثبيت الموقع</span>
              </div>
              
              <div id="pmodal-gis-map" style="height:170px; width:100%; border-radius:8px; border:1px solid #334155;"></div>
              
              <input type="hidden" id="pform-lat" name="lat" value="32.2985" />
              <input type="hidden" id="pform-lng" name="lng" value="35.7050" />
            </div>

            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">إرفاق عروض الأسعار / الفاتورة / المخطط (اختياري)</label>
              <input type="file" id="pform-file" name="file" 
                style="width:100%; padding:8px; border:1px dashed #0284c7; border-radius:8px; background:#0f172a; color:#f8fafc; font-size:0.82rem;" />
            </div>

            <!-- Receiving Committee Assignment -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:14px;">
              <div style="font-weight:800; font-size:0.86rem; color:#38bdf8; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span>👥</span> <span>لجنة الاستلام الفني والتسليم المحددة للمعاملة:</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:bold; margin-bottom:4px; color:#cbd5e1;">رئيس لجنة الاستلام والمشاريع <span style="color:#ef4444;">*</span></label>
                  <input type="text" id="pform-comm-head" name="committeeHead" value="رئيس قسم العطاءات والمشاريع" required 
                    style="width:100%; padding:8px 10px; border:1px solid #334155; border-radius:8px; font-size:0.82rem; background:#1e293b; color:#f8fafc;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:bold; margin-bottom:4px; color:#cbd5e1;">عضو لجنة الاستلام الفني <span style="color:#ef4444;">*</span></label>
                  <input type="text" id="pform-comm-member" name="committeeMember" value="مهندس تنفيذ أشغال" required 
                    style="width:100%; padding:8px 10px; border:1px solid #334155; border-radius:8px; font-size:0.82rem; background:#1e293b; color:#f8fafc;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:bold; margin-bottom:4px; color:#cbd5e1;">أمين المستودعات واللوازم <span style="color:#ef4444;">*</span></label>
                  <input type="text" id="pform-comm-warehouse" name="warehouseKeeper" value="محاسب ومدقق مالي / أمين المستودع" required 
                    style="width:100%; padding:8px 10px; border:1px solid #334155; border-radius:8px; font-size:0.82rem; background:#1e293b; color:#f8fafc;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:bold; margin-bottom:4px; color:#cbd5e1;">مندوب المورد / المتعهد المسلم</label>
                  <input type="text" id="pform-comm-supp-rep" name="supplierRepresentative" placeholder="مندوب الشركة الموردة..." 
                    style="width:100%; padding:8px 10px; border:1px solid #334155; border-radius:8px; font-size:0.82rem; background:#1e293b; color:#f8fafc;" />
                </div>
              </div>
            </div>

            <div style="margin-bottom:18px;">
              <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">ملاحظات ووصف فني إضافي</label>
              <textarea id="pform-notes" name="notes" rows="2" placeholder="أدخل أية تفاصيل فنية أو مبررات طلب الشراء..." 
                style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc; resize:vertical;"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:16px;">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('purchases-form-modal').style.display='none'" style="padding:8px 16px; border-radius:10px; border:1px solid #334155; color:#94a3b8; cursor:pointer;">إلغاء</button>
              <button type="submit" id="pform-submit-btn" class="btn btn-primary" style="font-weight:bold; padding:9px 22px; border-radius:10px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; cursor:pointer;">🚀 حفظ وإصدار المعاملة</button>
            </div>

          </form>

        </div>
      `;

      modal.style.display = 'flex';
      this._initModalMap('pmodal-gis-map', 'pform-lat', 'pform-lng', 32.2985, 35.7050);
    }

    async submitNew(e) {
      e.preventDefault();
      const form = document.getElementById('purchases-new-form');
      const submitBtn = document.getElementById('pform-submit-btn');
      if (!form) return;

      const formData = new FormData(form);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ جاري الحفظ والتسجيل...';
      }

      try {
        const res = await fetch('/api/purchases', {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل إصدار أمر الشراء');

        alert('✅ ' + (data.message || 'تم إصدار المعاملة بنجاح'));
        document.getElementById('purchases-form-modal').style.display = 'none';
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '🚀 حفظ وإصدار المعاملة';
        }
      }
    }

    openEditModal(id) {
      const record = this.purchases.find(p => String(p.id) === String(id));
      if (!record) return;

      let modal = document.getElementById('purchases-edit-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'purchases-edit-modal';
        modal.className = 'umw-modal-overlay';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:#1e293b; border-radius:18px; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:680px; box-shadow:0 25px 70px rgba(0,0,0,0.6); overflow:hidden; font-family:'Tajawal', sans-serif; direction:rtl; color:#f8fafc;">
          
          <div style="background:linear-gradient(135deg, #1e3a8a, #0284c7); color:#fff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:1.1rem;">✏️ تعديل بيانات المعاملة: ${record.id}</div>
            <button onclick="document.getElementById('purchases-edit-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:1.3rem; cursor:pointer;">✕</button>
          </div>

          <form onsubmit="window.unifiedPurchasesManager.submitEdit(event, '${record.id}')" style="padding:22px; max-height:80vh; overflow-y:auto;">
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">اسم المادة / تفاصيل العمل</label>
              <input type="text" id="pedit-item" value="${record.item || record.itemDescription || ''}" required 
                style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">المورد / الجهة</label>
                <input type="text" id="pedit-supplier" value="${record.supplier || ''}" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">القيمة المالية (د.أ)</label>
                <input type="number" id="pedit-amount" value="${record.amount || record.value || 0}" step="any" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">الحي / المنطقة</label>
                <input type="text" id="pedit-district" value="${record.district || 'كفرنجة'}" 
                  style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">درجة الأهمية</label>
                <select id="pedit-urgency" style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc;">
                  <option value="عادي" ${record.urgency === 'عادي' ? 'selected' : ''}>عادي</option>
                  <option value="متوسط" ${record.urgency === 'متوسط' ? 'selected' : ''}>متوسط</option>
                  <option value="عاجل" ${record.urgency === 'عاجل' ? 'selected' : ''}>عاجل ⚡</option>
                  <option value="طارئ" ${record.urgency === 'طارئ' ? 'selected' : ''}>طارئ جداً 🚨</option>
                </select>
              </div>
            </div>

            <!-- GIS Map Location Picker -->
            <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <label style="font-size:0.84rem; font-weight:bold; color:#38bdf8;">📍 تعديل الموقع الجغرافي (GIS):</label>
                <span id="pedit-gis-map-coords" style="font-size:0.75rem; color:#94a3b8;">انقر لنقل الدبوس</span>
              </div>
              <div id="pedit-gis-map" style="height:160px; width:100%; border-radius:8px; border:1px solid #334155;"></div>
              <input type="hidden" id="pedit-lat" value="${record.lat || 32.2985}" />
              <input type="hidden" id="pedit-lng" value="${record.lng || 35.7050}" />
            </div>

            <div style="margin-bottom:18px;">
              <label style="display:block; font-size:0.84rem; font-weight:bold; margin-bottom:6px;">ملاحظات</label>
              <textarea id="pedit-notes" rows="2" 
                style="width:100%; padding:9px 12px; border:1px solid #334155; border-radius:8px; font-size:0.86rem; background:#0f172a; color:#f8fafc; resize:vertical;">${record.notes || ''}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:16px;">
              <button type="button" class="btn btn-outline" onclick="document.getElementById('purchases-edit-modal').style.display='none'" style="padding:8px 16px; border-radius:10px; border:1px solid #334155; color:#94a3b8; cursor:pointer;">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="font-weight:bold; padding:9px 20px; border-radius:10px; cursor:pointer;">💾 حفظ التعديلات</button>
            </div>
          </form>

        </div>
      `;

      modal.style.display = 'flex';
      this._initModalMap('pedit-gis-map', 'pedit-lat', 'pedit-lng', record.lat || 32.2985, record.lng || 35.7050);
    }

    async submitEdit(e, id) {
      e.preventDefault();
      const body = {
        item: document.getElementById('pedit-item').value,
        supplier: document.getElementById('pedit-supplier').value,
        amount: parseFloat(document.getElementById('pedit-amount').value) || 0,
        district: document.getElementById('pedit-district').value,
        urgency: document.getElementById('pedit-urgency').value,
        lat: parseFloat(document.getElementById('pedit-lat').value) || 32.2985,
        lng: parseFloat(document.getElementById('pedit-lng').value) || 35.7050,
        notes: document.getElementById('pedit-notes').value
      };

      try {
        const res = await fetch(`/api/purchases/${id}`, {
          method: 'PUT',
          headers: this._getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل التعديل');

        alert('✅ تم تحديث بيانات المعاملة بنجاح');
        document.getElementById('purchases-edit-modal').style.display = 'none';
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    async advanceWorkflow(id, nextStatus) {
      let note = '';
      if (nextStatus === 'معاد للتعديل') {
        note = prompt('يرجى كتابة أسباب الإعادة والملاحظات الفنية المطلوبة:');
        if (note === null) return;
      } else {
        if (!confirm(`هل تؤكد تحويل مسار المعاملة (${id}) إلى: "${nextStatus}"؟`)) return;
      }

      try {
        const res = await fetch(`/api/purchases/${id}/workflow`, {
          method: 'POST',
          headers: this._getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ 
            nextStatus, 
            actor: this.currentUser?.fullName || 'المهندس المسؤول',
            note: note || `تحويل مسار المعاملة إلى: ${nextStatus}`
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل تحويل المسار');

        alert('✅ ' + data.message);
        this.openViewModal(id);
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    async submitCloseAndReceive(e, id) {
      e.preventDefault();
      const receiptNumber = document.getElementById('pclose-receipt-num').value;
      const receiverName = document.getElementById('pclose-receiver').value;
      const receiptFileInput = document.getElementById('pclose-receipt-file');
      const orderFileInput = document.getElementById('pclose-order-file');
      const submitBtn = document.getElementById('pclose-submit-btn');

      if (!receiptFileInput || !receiptFileInput.files[0]) {
        alert('⚠️ يرجى إرفاق ملف مذكرة الاستلام وسند الإدخال المعتمد');
        return;
      }

      const formData = new FormData();
      formData.append('nextStatus', 'تم الاستلام والتسديد والمطابقة - مغلقة');
      formData.append('actor', receiverName || this.currentUser?.fullName || 'أمين المستودع');
      formData.append('receiptNumber', receiptNumber);
      formData.append('receiverName', receiverName);
      formData.append('receiptFile', receiptFileInput.files[0]);
      if (orderFileInput && orderFileInput.files[0]) {
        formData.append('orderFile', orderFileInput.files[0]);
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ جاري توثيق الاستلام والأرشفة...';
      }

      try {
        const res = await fetch(`/api/purchases/${id}/workflow`, {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل توثيق الاستلام');

        alert('✅ ' + (data.message || 'تم توثيق استلام المواد وإغلاق المعاملة بنجاح'));
        this.openViewModal(id);
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '🔒 اعتماد الاستلام وتوثيق المستندات وإغلاق المعاملة رسمياً';
        }
      }
    }

    async confirmDelete(id) {
      if (!confirm(`هل أنت متأكد من حذف معاملة الشراء رقم (${id}) نهائياً؟`)) return;

      try {
        const res = await fetch(`/api/purchases/${id}`, {
          method: 'DELETE',
          headers: this._getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل الحذف');

        alert('✅ ' + data.message);
        this.selectedIds.delete(String(id));
        this.updateBulkBar();
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       9. العمليات الجماعية والتحديد
       ═══════════════════════════════════════════════════════════════════════════ */
    toggleSelectDoc(id, isChecked) {
      if (isChecked) {
        this.selectedIds.add(String(id));
      } else {
        this.selectedIds.delete(String(id));
      }
      this.updateBulkBar();
      this.renderMainContent();
    }

    toggleSelectAll(isChecked) {
      if (isChecked) {
        this.filteredPurchases.forEach(p => this.selectedIds.add(String(p.id)));
      } else {
        this.selectedIds.clear();
      }
      this.updateBulkBar();
      this.renderMainContent();
    }

    clearSelection() {
      this.selectedIds.clear();
      const cb = document.getElementById('purchases-select-all-cb');
      if (cb) cb.checked = false;
      this.updateBulkBar();
      this.renderMainContent();
    }

    updateBulkBar() {
      const bar = document.getElementById('purchases-bulk-bar');
      const countEl = document.getElementById('purchases-selected-count');
      if (!bar) return;

      const count = this.selectedIds.size;
      if (count > 0) {
        bar.style.display = 'flex';
        if (countEl) countEl.textContent = count;
      } else {
        bar.style.display = 'none';
      }
    }

    async bulkDeleteSelected() {
      const ids = Array.from(this.selectedIds);
      if (!ids.length) return;
      if (!confirm(`هل أنت متأكد من حذف (${ids.length}) معاملة محددة نهائياً؟`)) return;

      try {
        const res = await fetch('/api/purchases/batch-delete', {
          method: 'POST',
          headers: this._getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل الحذف الجماعي');

        alert('✅ ' + data.message);
        this.clearSelection();
        this.loadData();
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       10. الطباعة والتصدير المعتمد
       ═══════════════════════════════════════════════════════════════════════════ */
    printPurchaseOrder(id) {
      const record = this.purchases.find(p => String(p.id) === String(id));
      if (!record) return;

      const lat = parseFloat(record.lat) || 32.2985;
      const lng = parseFloat(record.lng) || 35.7050;
      const district = record.district || 'كفرنجة';
      const street = record.street || 'الشارع الرئيسي';
      const mapId = 'gis-print-map-' + record.id.replace(/[^a-zA-Z0-9]/g, '_');

      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: 'أمر شراء ولوازم رسمي معتمد',
          subtitle: `بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية`,
          refNumber: record.id,
          date: record.date || new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'رقم المعاملة والأمر', value: record.id },
            { label: 'بيان المادة / الأعمال', value: record.item || record.itemDescription },
            { label: 'التصنيف الرئيسي', value: record.category || record.purchaseType || 'لوازم وشراء مباشر' },
            { label: 'المورد / المتعهد', value: record.supplier || '—' },
            { label: 'الكمية المطلوبة', value: `${record.quantity || 1} ${record.unit || 'عدد'}` },
            { label: 'القيمة المالية الإجمالية', value: `${(record.amount || 0).toLocaleString('ar-JO')} د.أ` },
            { label: 'الحي والمنطقة', value: `${district} - ${street}` },
            { label: 'حالة الاعتماد', value: record.status || 'معتمد' }
          ],
          summaryHtml: `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-top:14px; page-break-inside:avoid;">
              <b style="color:#1e3a8a; font-size:0.9rem;">مبررات ووصف الشراء:</b>
              <div style="font-size:0.86rem; color:#334155; margin-top:4px; line-height:1.6;">${record.notes || 'أمر شراء صادر ومطابق للمواصفات الفنية وجداول الاحتياجات لبلدية كفرنجة الجديدة ومصادق عليه أصولياً.'}</div>
            </div>

            <!-- الخريطة البصرية والتحديد الجغرافي GIS للموقع -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-top:14px; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                <div style="font-weight:800; font-size:0.9rem; color:#1e3a8a; display:flex; align-items:center; gap:6px;">
                  <span>🗺️</span> <span>الخريطة البصرية للموقع الجغرافي (GIS Visual Location Map):</span>
                </div>
                <div style="font-size:0.8rem; color:#475569;">
                  📍 <b>${district}</b> - ${street} | الإحداثيات: Lat: <b style="color:#0284c7;">${lat.toFixed(5)}</b>, Lng: <b style="color:#0284c7;">${lng.toFixed(5)}</b>
                </div>
              </div>

              <div id="${mapId}" style="width:100%; height:190px; border-radius:6px; border:1px solid #94a3b8; background:#e2e8f0; overflow:hidden;"></div>
            </div>

            <script>
              (function() {
                function setupPrintGisMap() {
                  if (typeof L === 'undefined') return;
                  var el = document.getElementById('${mapId}');
                  if (!el || el._leaflet_id) return;
                  
                  try {
                    var map = L.map('${mapId}', {
                      zoomControl: false,
                      attributionControl: false,
                      dragging: false,
                      scrollWheelZoom: false,
                      touchZoom: false,
                      doubleClickZoom: false
                    }).setView([${lat}, ${lng}], 15);

                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                      maxZoom: 19
                    }).addTo(map);

                    var marker = L.marker([${lat}, ${lng}]).addTo(map);
                    marker.bindPopup('<b>${(record.item || record.itemDescription || 'موقع المعاملة').replace(/'/g, "\\'")}</b><br>${district}').openPopup();

                    setTimeout(function() { map.invalidateSize(); }, 250);
                  } catch (e) {
                    console.error('Print map error:', e);
                  }
                }

                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  setTimeout(setupPrintGisMap, 150);
                } else {
                  window.addEventListener('load', setupPrintGisMap);
                }
              })();
            </script>
          `,
          footerHtml: `
            <div style="display:flex; justify-content:space-between; margin-top:35px; padding:0 25px; font-size:0.92rem; text-align:center;">
              <div><b>المهندس المنظم:</b><br><br>.........................<div style="font-size:0.75rem; color:#64748b; margin-top:4px;">إعداد وتنظيم المعاملة</div></div>
              <div><b>رئيس القسم:</b><br><br>.........................<div style="font-size:0.75rem; color:#64748b; margin-top:4px;">التدقيق الفني والهندسي</div></div>
              <div><b>مدير الأشغال والخدمات الهندسية:</b><br><br>.........................<div style="font-size:0.75rem; color:#64748b; margin-top:4px;">الاعتماد والمصادقة</div></div>
            </div>
          `
        });
      } else {
        window.print();
      }
    }

    printGoodsReceiptTemplate(id) {
      const record = this.purchases.find(p => String(p.id) === String(id));
      if (!record) return;

      const lat = parseFloat(record.lat) || 32.2985;
      const lng = parseFloat(record.lng) || 35.7050;
      const district = record.district || 'كفرنجة';
      const street = record.street || 'الشارع الرئيسي';
      const mapId = 'gis-print-receipt-tmpl-' + record.id.replace(/[^a-zA-Z0-9]/g, '_');

      // قراءة الأدوار والأسماء حياً من الشاشة أو من السجل
      let committeeList = [];
      const rows = document.querySelectorAll(`#pview-comm-list-${record.id} .pview-comm-row`);
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          const role = r.querySelector('.pview-comm-role')?.value.trim() || '';
          const name = r.querySelector('.pview-comm-name')?.value.trim() || '';
          if (role || name) {
            committeeList.push({ role: role || 'عضو لجنة الاستلام', name: name || '—' });
          }
        });
      }
      if (committeeList.length === 0 && Array.isArray(record.receivingCommittee) && record.receivingCommittee.length > 0) {
        committeeList = record.receivingCommittee;
      }
      if (committeeList.length === 0) {
        committeeList = [
          { role: 'مندوب المورد / المتعهد المسلم', name: record.supplierRepresentative || record.supplier || 'مندوب المتعهد المورد' },
          { role: 'عضو لجنة الاستلام الفني', name: record.committeeMember || 'مهندس تنفيذ أشغال' },
          { role: 'أمين المستودعات واللوازم', name: record.warehouseKeeper || record.receiverName || 'محاسب ومدقق مالي / أمين المستودع' },
          { role: 'رئيس لجنة الاستلام والمشاريع', name: record.committeeHead || 'رئيس قسم العطاءات والمشاريع' }
        ];
      }

      const commTableColsHtml = committeeList.map(c => `
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; text-align:center; font-size:0.75rem;">
          <div style="font-weight:bold; color:#1e3a8a; font-size:0.72rem; margin-bottom:2px;">${c.role}</div>
          <div style="font-weight:800; color:#0f172a;">${c.name || '—'}</div>
        </div>
      `).join('');

      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: 'استمارة ونموذج استلام وفحص مواد هندسية (قبل الاستلام والتسديد)',
          subtitle: 'بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية - لجنة الاستلام والمستودعات',
          refNumber: `TMPL-REC-${record.id}`,
          date: new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'رقم أمر الشراء المعتمد', value: record.id },
            { label: 'بيان المادة / المواصفة', value: record.item || record.itemDescription },
            { label: 'التصنيف الرئيسي', value: record.category || record.purchaseType || 'لوازم وشراء مباشر' },
            { label: 'المورد / المتعهد', value: record.supplier || '—' },
            { label: 'الكمية المصرح بشرائها', value: `${record.quantity || 1} ${record.unit || 'عدد'}` },
            { label: 'القيمة المالية التقديرية', value: `${(record.amount || 0).toLocaleString('ar-JO')} د.أ` },
            { label: 'الحي والموقع المحدد', value: `${district} - ${street}` },
            { label: 'حالة المعاملة', value: 'معتمد قيد التوريد والفحص الميداني' }
          ],
          summaryHtml: `
            <!-- شبكة أعضاء وصفات لجنة الاستلام والتسليم -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin-top:8px; page-break-inside:avoid;">
              <div style="font-weight:800; font-size:0.84rem; color:#1e3a8a; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; display:flex; align-items:center; gap:6px;">
                <span>👥</span> <span>تشكيل وصفات لجنة الاستلام والتسليم المحددة للمعاملة:</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(${Math.min(committeeList.length, 4)}, 1fr); gap:6px;">
                ${commTableColsHtml}
              </div>
            </div>

            <!-- جدول الفحص الميداني وتفريغ نتائج المعاينة والاستلام -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin-top:8px; page-break-inside:avoid;">
              <div style="font-weight:800; font-size:0.84rem; color:#1e3a8a; margin-bottom:5px; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">
                📋 نتائج الفحص والمعاينة الميدانية (تُعبأ من قبل لجنة الاستلام):
              </div>

              <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.78rem; margin-bottom:4px;">
                <tr style="border-bottom:1px solid #cbd5e1;">
                  <td style="padding:4px 6px; width:200px; font-weight:bold; background:#f8fafc;">الكمية الموردة والمستلمة:</td>
                  <td style="padding:4px 6px;">[ ................................... ] ${record.unit || 'عدد'}</td>
                  <td style="padding:4px 6px; width:180px; font-weight:bold; background:#f8fafc;">الكمية المرفوضة (إن وجدت):</td>
                  <td style="padding:4px 6px;">[ ................................... ]</td>
                </tr>
                <tr style="border-bottom:1px solid #cbd5e1;">
                  <td style="padding:4px 6px; font-weight:bold; background:#f8fafc;">مطابقة المواصفات الفنية:</td>
                  <td style="padding:4px 6px;">( &nbsp;&nbsp; ) مطابق تماماً &nbsp;&nbsp; ( &nbsp;&nbsp; ) غير مطابق</td>
                  <td style="padding:4px 6px; font-weight:bold; background:#f8fafc;">سلامة المواد من التلف:</td>
                  <td style="padding:4px 6px;">( &nbsp;&nbsp; ) سليم &nbsp;&nbsp; ( &nbsp;&nbsp; ) ملاحظات</td>
                </tr>
                <tr style="border-bottom:1px solid #cbd5e1;">
                  <td style="padding:4px 6px; font-weight:bold; background:#f8fafc;">تاريخ وساعة الاستلام:</td>
                  <td style="padding:4px 6px;">التاريخ: &nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/ 2026م &nbsp; الساعة: .......</td>
                  <td style="padding:4px 6px; font-weight:bold; background:#f8fafc;">رقم مذكرة / سند الإدخال:</td>
                  <td style="padding:4px 6px; font-family:monospace; font-weight:bold;">REC-2026-..................</td>
                </tr>
              </table>

              <div style="background:#f8fafc; border:1px dashed #94a3b8; border-radius:6px; padding:4px 8px; font-size:0.75rem; color:#334155; min-height:30px;">
                <b>ملاحظات وتوصيات الفحص الفني:</b>
                <span style="color:#64748b; margin-right:6px;">................................................................................................................................................................................................</span>
              </div>
            </div>

            <!-- الخريطة البصرية لموقع التسليم والاستلام -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin-top:8px; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">
                <div style="font-weight:800; font-size:0.84rem; color:#1e3a8a; display:flex; align-items:center; gap:6px;">
                  <span>🗺️</span> <span>الموقع الجغرافي المعتمد للتسليم (GIS Visual Map):</span>
                </div>
                <div style="font-size:0.75rem; color:#475569;">
                  📍 <b>${district}</b> - ${street} | Lat: <b style="color:#0284c7;">${lat.toFixed(5)}</b>, Lng: <b style="color:#0284c7;">${lng.toFixed(5)}</b>
                </div>
              </div>

              <div id="${mapId}" style="width:100%; height:110px; border-radius:6px; border:1px solid #94a3b8; background:#e2e8f0; overflow:hidden;"></div>
            </div>

            <script>
              (function() {
                function setupTmplPrintGisMap() {
                  if (typeof L === 'undefined') return;
                  var el = document.getElementById('${mapId}');
                  if (!el || el._leaflet_id) return;
                  
                  try {
                    var map = L.map('${mapId}', {
                      zoomControl: false,
                      attributionControl: false,
                      dragging: false,
                      scrollWheelZoom: false,
                      touchZoom: false,
                      doubleClickZoom: false
                    }).setView([${lat}, ${lng}], 15);

                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                      maxZoom: 19
                    }).addTo(map);

                    var marker = L.marker([${lat}, ${lng}]).addTo(map);
                    marker.bindPopup('<b>موقع استلام: ${(record.item || record.itemDescription || '').replace(/'/g, "\\'")}</b><br>${district}').openPopup();

                    setTimeout(function() { map.invalidateSize(); }, 250);
                  } catch (e) {
                    console.error('Print receipt template map error:', e);
                  }
                }

                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  setTimeout(setupTmplPrintGisMap, 150);
                } else {
                  window.addEventListener('load', setupTmplPrintGisMap);
                }
              })();
            </script>
          `,
          customWorkflow: committeeList.map(c => ({
            roleName: c.role || 'عضو لجنة الاستلام',
            signLabel: `الاسم: ${c.name || '—'}`
          }))
        });
      } else {
        window.print();
      }
    }

    printGoodsReceipt(id) {
      const record = this.purchases.find(p => String(p.id) === String(id));
      if (!record) return;

      const lat = parseFloat(record.lat) || 32.2985;
      const lng = parseFloat(record.lng) || 35.7050;
      const district = record.district || 'كفرنجة';
      const street = record.street || 'الشارع الرئيسي';
      const mapId = 'gis-print-receipt-' + record.id.replace(/[^a-zA-Z0-9]/g, '_');

      let committeeList = [];
      const rows = document.querySelectorAll(`#pview-comm-list-${record.id} .pview-comm-row`);
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          const role = r.querySelector('.pview-comm-role')?.value.trim() || '';
          const name = r.querySelector('.pview-comm-name')?.value.trim() || '';
          if (role || name) {
            committeeList.push({ role: role || 'عضو لجنة الاستلام', name: name || '—' });
          }
        });
      }
      if (committeeList.length === 0 && Array.isArray(record.receivingCommittee) && record.receivingCommittee.length > 0) {
        committeeList = record.receivingCommittee;
      }
      if (committeeList.length === 0) {
        committeeList = [
          { role: 'مندوب المورد / المتعهد المسلم', name: record.supplierRepresentative || record.supplier || 'مندوب المتعهد المورد' },
          { role: 'عضو لجنة الاستلام الفني', name: record.committeeMember || 'مهندس تنفيذ أشغال' },
          { role: 'أمين المستودعات واللوازم', name: record.warehouseKeeper || record.receiverName || 'محاسب ومدقق مالي / أمين المستودع' },
          { role: 'رئيس لجنة الاستلام والمشاريع', name: record.committeeHead || 'رئيس قسم العطاءات والمشاريع' }
        ];
      }

      const commTableColsHtml = committeeList.map(c => `
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:4px 8px; text-align:center; font-size:0.75rem;">
          <div style="font-weight:bold; color:#065f46; font-size:0.72rem; margin-bottom:2px;">${c.role}</div>
          <div style="font-weight:800; color:#0f172a;">${c.name || '—'}</div>
        </div>
      `).join('');

      if (typeof printStandardDocument === 'function') {
        printStandardDocument({
          title: 'مذكرة استلام وفحص وسند إدخال مخزني',
          subtitle: 'بلدية كفرنجة الجديدة - لجنة الاستلام الفني والمستودعات',
          refNumber: record.receiptNumber || `REC-${record.id}`,
          date: record.closedAt ? new Date(record.closedAt).toLocaleDateString('ar-JO') : new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'رقم أمر الشراء المرتبط', value: record.id },
            { label: 'رقم مذكرة / سند الاستلام', value: record.receiptNumber || `REC-${record.id}` },
            { label: 'المادة المستلمة', value: record.item || record.itemDescription },
            { label: 'المورد المورد', value: record.supplier || '—' },
            { label: 'الكمية الفعلية المستلمة', value: `${record.quantity || 1} ${record.unit || 'عدد'}` },
            { label: 'الحي والموقع الجغرافي', value: `${district} - ${street}` },
            { label: 'المستلم / أمين المستودع', value: record.receiverName || record.closedBy || 'أمين المستودع' },
            { label: 'المطابقة الفنية', value: 'مطابق للمواصفات الفنية ومفحوص أصولياً' }
          ],
          summaryHtml: `
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:8px 12px; margin-top:8px; font-size:0.82rem; line-height:1.5; color:#065f46; page-break-inside:avoid;">
              <b>إقرار لجنة الاستلام والمستودعات:</b>
              <div>نشهد نحن الموقعين أدناه بأنه تم فحص ومعاينة وتدقيق المواد واستلامها وإدخالها لمستودعات بلدية كفرنجة الجديدة بحالة ممتازة ومطابقة لكافة المواصفات المطلوبة.</div>
            </div>

            <!-- شبكة تشكيل وصفات لجنة الاستلام والتسليم -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin-top:8px; page-break-inside:avoid;">
              <div style="font-weight:800; font-size:0.84rem; color:#065f46; margin-bottom:6px; border-bottom:1px solid #e2e8f0; padding-bottom:3px; display:flex; align-items:center; gap:6px;">
                <span>👥</span> <span>تشكيل وصفات لجنة الاستلام والتسليم المحددة للمعاملة:</span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(${Math.min(committeeList.length, 4)}, 1fr); gap:6px;">
                ${commTableColsHtml}
              </div>
            </div>

            <!-- الخريطة البصرية لموقع الاستلام الفني -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin-top:8px; page-break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">
                <div style="font-weight:800; font-size:0.84rem; color:#065f46; display:flex; align-items:center; gap:6px;">
                  <span>🗺️</span> <span>الخريطة البصرية لموقع التسليم والاستلام (GIS Map):</span>
                </div>
                <div style="font-size:0.75rem; color:#475569;">
                  📍 <b>${district}</b> - ${street} | Lat: <b style="color:#059669;">${lat.toFixed(5)}</b>, Lng: <b style="color:#059669;">${lng.toFixed(5)}</b>
                </div>
              </div>

              <div id="${mapId}" style="width:100%; height:110px; border-radius:6px; border:1px solid #94a3b8; background:#e2e8f0; overflow:hidden;"></div>
            </div>

            <script>
              (function() {
                function setupReceiptPrintGisMap() {
                  if (typeof L === 'undefined') return;
                  var el = document.getElementById('${mapId}');
                  if (!el || el._leaflet_id) return;
                  
                  try {
                    var map = L.map('${mapId}', {
                      zoomControl: false,
                      attributionControl: false,
                      dragging: false,
                      scrollWheelZoom: false,
                      touchZoom: false,
                      doubleClickZoom: false
                    }).setView([${lat}, ${lng}], 15);

                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                      maxZoom: 19
                    }).addTo(map);

                    var marker = L.marker([${lat}, ${lng}]).addTo(map);
                    marker.bindPopup('<b>موقع استلام: ${(record.item || record.itemDescription || '').replace(/'/g, "\\'")}</b><br>${district}').openPopup();

                    setTimeout(function() { map.invalidateSize(); }, 250);
                  } catch (e) {
                    console.error('Print receipt map error:', e);
                  }
                }

                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                  setTimeout(setupReceiptPrintGisMap, 150);
                } else {
                  window.addEventListener('load', setupReceiptPrintGisMap);
                }
              })();
            </script>
          `,
          customWorkflow: committeeList.map(c => ({
            roleName: c.role || 'عضو لجنة الاستلام',
            signLabel: `الاسم: ${c.name || '—'}`
          }))
        });
      } else {
        window.print();
      }
    }

    printPurchasesRegistry() {
      const dataToPrint = this.selectedIds.size > 0 
        ? this.filteredPurchases.filter(p => this.selectedIds.has(String(p.id)))
        : this.filteredPurchases;

      if (typeof printStandardDocument === 'function') {
        const rowsHtml = dataToPrint.map((p, i) => `
          <tr style="border-bottom:1px solid #cbd5e1; font-size:0.8rem;">
            <td style="padding:6px; text-align:center;">${i + 1}</td>
            <td style="padding:6px; font-weight:bold; font-family:monospace;">${p.id}</td>
            <td style="padding:6px;">${p.item || p.itemDescription}</td>
            <td style="padding:6px;">${p.supplier || '—'}</td>
            <td style="padding:6px; text-align:center;">${(p.amount || 0).toLocaleString('ar-JO')} د.أ</td>
            <td style="padding:6px; text-align:center;">${p.status || 'مسودة'}</td>
          </tr>
        `).join('');

        printStandardDocument({
          title: 'كشف وسجل أوامر الشراء والمواد',
          subtitle: `بلدية كفرنجة الجديدة - عدد المعاملات: ${dataToPrint.length}`,
          refNumber: `REG-PUR-${new Date().getFullYear()}`,
          date: new Date().toLocaleDateString('ar-JO'),
          fields: [
            { label: 'عدد المعاملات المدرجة', value: `${dataToPrint.length} معاملة` },
            { label: 'تاريخ التوليد', value: new Date().toLocaleDateString('ar-JO') }
          ],
          summaryHtml: `
            <table style="width:100%; border-collapse:collapse; margin-top:14px; text-align:right;">
              <thead>
                <tr style="background:#1e3a8a; color:#fff; font-size:0.82rem;">
                  <th style="padding:6px; text-align:center; width:40px;">#</th>
                  <th style="padding:6px; width:110px;">الرقم</th>
                  <th style="padding:6px;">بيان المادة</th>
                  <th style="padding:6px; width:130px;">المورد</th>
                  <th style="padding:6px; text-align:center; width:100px;">القيمة</th>
                  <th style="padding:6px; text-align:center; width:120px;">الحالة</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          `
        });
      } else {
        window.print();
      }
    }

    exportExcel() {
      const dataToExport = this.selectedIds.size > 0 
        ? this.filteredPurchases.filter(p => this.selectedIds.has(String(p.id)))
        : this.filteredPurchases;

      if (!dataToExport || !dataToExport.length) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const headers = ['رقم الطلب', 'المادة/البيان', 'التصنيف', 'المورد', 'الكمية', 'الوحدة', 'القيمة (د.أ)', 'الحي', 'التاريخ', 'الحالة', 'درجة الأهمية'];
      const rows = dataToExport.map(p => [
        `"${p.id || ''}"`,
        `"${(p.item || p.itemDescription || '').replace(/"/g, '""')}"`,
        `"${p.category || p.purchaseType || ''}"`,
        `"${p.supplier || ''}"`,
        `"${p.quantity || 1}"`,
        `"${p.unit || 'عدد'}"`,
        `"${p.amount || p.value || 0}"`,
        `"${p.district || ''}"`,
        `"${p.date || ''}"`,
        `"${p.status || ''}"`,
        `"${p.urgency || ''}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchases_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       11. التحكم بالفلاتر والتبويبات
       ═══════════════════════════════════════════════════════════════════════════ */
    switchTab(tabId) {
      this.currentTab = tabId;
      document.querySelectorAll('.ptab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.cssText = this._getTabBtnStyle(false);
      });

      const activeBtn = document.getElementById(`ptab-${tabId}`);
      if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.cssText = this._getTabBtnStyle(true);
      }

      this.applyFilters();
    }

    switchViewMode(mode) {
      this.currentViewMode = mode;
      const tBtn = document.getElementById('pview-table-btn');
      const gBtn = document.getElementById('pview-grid-btn');
      if (mode === 'table') {
        if (tBtn) { tBtn.style.background = 'linear-gradient(135deg, #0284c7, #0f766e)'; tBtn.style.color = '#fff'; }
        if (gBtn) { gBtn.style.background = 'transparent'; gBtn.style.color = '#94a3b8'; }
      } else {
        if (gBtn) { gBtn.style.background = 'linear-gradient(135deg, #0284c7, #0f766e)'; gBtn.style.color = '#fff'; }
        if (tBtn) { tBtn.style.background = 'transparent'; tBtn.style.color = '#94a3b8'; }
      }
      this.renderMainContent();
    }

    onSearchChange(val) {
      this.filters.search = val;
      this.applyFilters();
    }

    onCategoryFilterChange(val) {
      this.filters.category = val;
      this.applyFilters();
    }

    onStatusFilterChange(val) {
      this.filters.status = val;
      this.applyFilters();
    }

    onUrgencyFilterChange(val) {
      this.filters.urgency = val;
      this.applyFilters();
    }

    resetFilters() {
      this.filters = { search: '', category: '', status: '', urgency: '' };
      const sInput = document.getElementById('purchases-search-input');
      if (sInput) sInput.value = '';
      const cSel = document.getElementById('purchases-filter-category');
      if (cSel) cSel.value = '';
      const stSel = document.getElementById('purchases-filter-status');
      if (stSel) stSel.value = '';
      const uSel = document.getElementById('purchases-filter-urgency');
      if (uSel) uSel.value = '';
      this.applyFilters();
    }
  }

  // تصدير وتهيئة المدير في النطاق العام فوراً
  if (typeof window !== 'undefined') {
    window.UnifiedPurchasesManager = UnifiedPurchasesManager;
    window.unifiedPurchasesManager = new UnifiedPurchasesManager();

    // تهيئة تلقائية فورية عند جاهزية DOM أو استدعاء الصفحة
    const initPurchasesWhenReady = () => {
      const container = document.getElementById('purchases-tab-container') || document.getElementById('page-purchases');
      if (container && window.unifiedPurchasesManager) {
        window.unifiedPurchasesManager.init();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPurchasesWhenReady);
    } else {
      initPurchasesWhenReady();
    }
  }
})(typeof window !== 'undefined' ? window : this);
