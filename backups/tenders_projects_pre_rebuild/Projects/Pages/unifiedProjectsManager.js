/**
 * Projects/Pages/unifiedProjectsManager.js
 * 🏗️ واجهة إدارة المشاريع الهندسية والمحافظ الرأسمالية الموحدة
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

(function() {
  'use strict';

  class UnifiedProjectsManager {
    constructor() {
      this.projects = [];
      this.activeFilters = { status: '', search: '', departmentId: '' };
      this.selectedProject = null;
      this.isLoading = false;
    }

    _hasPermission(perm) {
      if (typeof window.hasPermission === 'function') {
        return window.hasPermission(perm);
      }
      return true;
    }

    async init() {
      const container = document.getElementById('projects-tab-pane') || document.getElementById('mainContent');
      if (!container) return;
      await this.loadProjects();
    }

    async loadProjects() {
      this.isLoading = true;
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const query = new URLSearchParams();
        if (this.activeFilters.status) query.append('status', this.activeFilters.status);
        if (this.activeFilters.search) query.append('search', this.activeFilters.search);

        const res = await fetch(`/api/projects?${query.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        if (data.success) {
          this.projects = data.data || [];
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        this.isLoading = false;
        this.render();
      }
    }

    getStatusBadge(status) {
      const badges = {
        DRAFT: '<span class="badge" style="background:#64748b;color:#fff;">مسودة</span>',
        PLANNED: '<span class="badge" style="background:#0284c7;color:#fff;">مخطط</span>',
        SUBMITTED: '<span class="badge" style="background:#f59e0b;color:#fff;">مقدم للاعتماد</span>',
        UNDER_REVIEW: '<span class="badge" style="background:#8b5cf6;color:#fff;">قيد المراجعة</span>',
        APPROVED: '<span class="badge" style="background:#10b981;color:#fff;">معتمد</span>',
        PROCUREMENT: '<span class="badge" style="background:#06b6d4;color:#fff;">طرح عطاء</span>',
        CONTRACTED: '<span class="badge" style="background:#3b82f6;color:#fff;">تم التعاقد</span>',
        IN_PROGRESS: '<span class="badge" style="background:#2563eb;color:#fff;">قيد التنفيذ</span>',
        SUSPENDED: '<span class="badge" style="background:#ef4444;color:#fff;">موقوف مؤقتاً</span>',
        COMPLETED: '<span class="badge" style="background:#059669;color:#fff;">مكتمل ومستلم</span>',
        CLOSED: '<span class="badge" style="background:#334155;color:#fff;">مغلق نهائياً</span>',
        CANCELLED: '<span class="badge" style="background:#dc2626;color:#fff;">ملغي</span>'
      };
      return badges[status] || `<span class="badge badge-secondary">${status}</span>`;
    }

    render() {
      const container = document.getElementById('projects-tab-pane') || document.getElementById('projectsContainer');
      if (!container) return;

      const totalBudget = this.projects.reduce((s, p) => s + parseFloat(p.approved_budget || p.budget_amount || 0), 0);
      const inProgressCount = this.projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'CONTRACTED').length;
      const completedCount = this.projects.filter(p => p.status === 'COMPLETED' || p.status === 'CLOSED').length;

      container.innerHTML = `
        <div class="projects-engine-wrapper" style="padding: 10px; font-family: 'Segoe UI', Tahoma, sans-serif;">
          <!-- 1. Header & KPI Cards -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary, #1e293b); display:flex; align-items:center; gap:8px;">
                <span>🏗️</span> منظومة إدارة المشاريع والمحافظ الرأسمالية
              </h2>
              <p style="margin:4px 0 0 0; font-size:0.85rem; color:var(--text-secondary, #64748b);">مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة</p>
            </div>
            <div style="display:flex; gap:8px;">
              ${this._hasPermission('PROJECTS.CREATE') ? `
                <button class="btn btn-primary" onclick="window.unifiedProjectsManager.openNewProjectModal()" style="background:#2563eb; color:#fff; padding:8px 16px; border-radius:6px; border:none; cursor:pointer; font-weight:bold; display:flex; align-items:center; gap:6px;">
                  <span>➕</span> إنشاء مشروع جديد
                </button>
              ` : ''}
              ${this._hasPermission('PROJECTS.EXPORT') ? `
                <button class="btn btn-outline" onclick="window.unifiedProjectsManager.exportPortfolio()" style="padding:8px 14px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; cursor:pointer;">
                  <span>📊</span> تصدير المحفظة
                </button>
              ` : ''}
            </div>
          </div>

          <!-- KPI Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:20px;">
            <div style="background:var(--card-bg, #ffffff); border-radius:10px; padding:15px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.8rem; color:#64748b;">إجمالي المشاريع بالمحفظة</div>
              <div style="font-size:1.5rem; font-weight:bold; color:#1e293b; margin-top:4px;">${this.projects.length}</div>
            </div>
            <div style="background:var(--card-bg, #ffffff); border-radius:10px; padding:15px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.8rem; color:#64748b;">قيد التنفيذ والتعاقد</div>
              <div style="font-size:1.5rem; font-weight:bold; color:#2563eb; margin-top:4px;">${inProgressCount}</div>
            </div>
            <div style="background:var(--card-bg, #ffffff); border-radius:10px; padding:15px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.8rem; color:#64748b;">مشاريع منجزة ومستلمة</div>
              <div style="font-size:1.5rem; font-weight:bold; color:#059669; margin-top:4px;">${completedCount}</div>
            </div>
            <div style="background:var(--card-bg, #ffffff); border-radius:10px; padding:15px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div style="font-size:0.8rem; color:#64748b;">إجمالي الموازنة المعتمدة</div>
              <div style="font-size:1.3rem; font-weight:bold; color:#d97706; margin-top:4px;">${totalBudget.toLocaleString('ar-JO')} د.أ</div>
            </div>
          </div>

          <!-- Filters Bar -->
          <div style="background:var(--card-bg, #ffffff); padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap;">
            <input type="text" placeholder="🔍 بحث برقم المشروع، الاسم، الموقع..." value="${this.activeFilters.search}" oninput="window.unifiedProjectsManager.setSearch(this.value)" style="flex:1; min-width:200px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;">
            <select onchange="window.unifiedProjectsManager.setStatusFilter(this.value)" style="padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px;">
              <option value="">جميع الحالات</option>
              <option value="DRAFT" ${this.activeFilters.status === 'DRAFT' ? 'selected' : ''}>مسودة</option>
              <option value="APPROVED" ${this.activeFilters.status === 'APPROVED' ? 'selected' : ''}>معتمد</option>
              <option value="IN_PROGRESS" ${this.activeFilters.status === 'IN_PROGRESS' ? 'selected' : ''}>قيد التنفيذ</option>
              <option value="COMPLETED" ${this.activeFilters.status === 'COMPLETED' ? 'selected' : ''}>مكتمل</option>
            </select>
          </div>

          <!-- Projects Table / Grid -->
          <div style="background:var(--card-bg, #ffffff); border-radius:8px; border:1px solid #e2e8f0; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:right; font-size:0.85rem;">
              <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                  <th style="padding:10px 14px;">رقم المشروع</th>
                  <th style="padding:10px 14px;">اسم المشروع</th>
                  <th style="padding:10px 14px;">النوع والموقع</th>
                  <th style="padding:10px 14px;">الموازنة المعتمدة</th>
                  <th style="padding:10px 14px;">نسبة الإنجاز الفعلي</th>
                  <th style="padding:10px 14px;">الحالة</th>
                  <th style="padding:10px 14px; text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${this.projects.length === 0 ? `
                  <tr><td colspan="7" style="padding:30px; text-align:center; color:#94a3b8;">لا توجد مشاريع مطابقة لمعايير البحث.</td></tr>
                ` : this.projects.map(p => `
                  <tr style="border-bottom:1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                    <td style="padding:10px 14px; font-weight:bold; color:#0369a1;">${p.project_number || p.projectNumber || p.id}</td>
                    <td style="padding:10px 14px; font-weight:600; color:#1e293b;">${p.project_name || p.projectName}</td>
                    <td style="padding:10px 14px; color:#64748b;">${p.project_type || p.projectType || 'عام'} - ${p.location || 'كفرنجة'}</td>
                    <td style="padding:10px 14px; font-weight:bold; color:#047857;">${parseFloat(p.approved_budget || p.budget_amount || 0).toLocaleString('ar-JO')} د.أ</td>
                    <td style="padding:10px 14px;">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <div style="flex:1; background:#e2e8f0; border-radius:4px; height:8px; overflow:hidden;">
                          <div style="background:#2563eb; height:100%; width:${p.completion_percentage || p.completionPercentage || 0}%;"></div>
                        </div>
                        <span style="font-weight:bold; font-size:0.75rem;">${p.completion_percentage || p.completionPercentage || 0}%</span>
                      </div>
                    </td>
                    <td style="padding:10px 14px;">${this.getStatusBadge(p.status)}</td>
                    <td style="padding:10px 14px; text-align:center;">
                      <button onclick="window.unifiedProjectsManager.openDetailsModal('${p.id}')" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.75rem; color:#1e293b; margin-left:4px;">👁️ تفاصيل</button>
                      ${this._hasPermission('PROJECTS.EDIT') ? `
                        <button onclick="window.unifiedProjectsManager.openEditModal('${p.id}')" style="background:#e0f2fe; border:1px solid #bae6fd; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; color:#0369a1; margin-left:4px;">✏️</button>
                      ` : ''}
                      ${this._hasPermission('PROJECTS.DELETE') ? `
                        <button onclick="window.unifiedProjectsManager.deleteProject('${p.id}')" style="background:#fee2e2; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem; color:#dc2626;">🗑️</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    setSearch(val) {
      this.activeFilters.search = val;
      this.loadProjects();
    }

    setStatusFilter(val) {
      this.activeFilters.status = val;
      this.loadProjects();
    }

    async openDetailsModal(id) {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      try {
        const res = await fetch(`/api/projects/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          this.selectedProject = data.data;
          alert(`تفاصيل المشروع: ${this.selectedProject.project_name}\nالحالة: ${this.selectedProject.status}\nالموازنة: ${this.selectedProject.approved_budget} د.أ`);
        }
      } catch (e) {
        alert('تعذر جلب تفاصيل المشروع');
      }
    }

    openNewProjectModal() {
      const name = prompt('أدخل اسم المشروع الجديد:');
      if (!name) return;
      const budget = prompt('أدخل الموازنة المقدرة (د.أ):', '50000');
      
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectName: name,
          budgetAmount: parseFloat(budget || 0),
          approvedBudget: parseFloat(budget || 0)
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('تم إنشاء المشروع بنجاح برقم: ' + data.data.project_number);
          this.loadProjects();
        } else {
          alert('فشل إنشاء المشروع: ' + (data.error || 'خطأ غير معروف'));
        }
      });
    }

    async deleteProject(id) {
      if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع نهائياً؟')) return;
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          alert('تم حذف المشروع بنجاح.');
          this.loadProjects();
        } else {
          alert('خطأ: ' + (data.error || 'فشلت العملية'));
        }
      } catch (e) {
        alert('تعذر حذف المشروع');
      }
    }

    exportPortfolio() {
      alert('جاري تصدير بيانات محفظة المشاريع الهندسية...');
    }
  }

  window.unifiedProjectsManager = new UnifiedProjectsManager();
})();
