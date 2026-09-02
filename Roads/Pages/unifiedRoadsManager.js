/**
 * Unified Road Asset & PMS Management System (RAMS / PMS Enterprise v7.0)
 * بلدية كفرنجة - مديرية الأشغال والخدمات الهندسية
 * ─────────────────────────────────────────────────────────────
 * نظام متكامل لإدارة شبكة الطرق، الخرائط الجغرافية PostGIS، فحوصات الرصف وتوزيع كلف الصيانة
 */
'use strict';

class ComprehensiveRoadsManager {

  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!this.container) return;

    this.map          = null;
    this.drawMap      = null;
    this.drawLayer    = null;
    this.drawnCoords  = [];
    this.roadsLayer   = null;
    this.activeData   = [];
    this._editingId   = null;
    this._drawing     = false;
    this._polyline    = null;

    this._readUser();
    this._buildUI();
  }

  /* ─── صلاحيات المستخدم ─────────────────────────────────────────────── */
  _readUser() {
    try {
      const raw = sessionStorage.getItem('engineeringUser') || localStorage.getItem('engineeringUser');
      this._user = raw ? JSON.parse(raw) : (window.currentUser || null);
    } catch { this._user = null; }
    const role = (this._user?.role || '').toLowerCase();
    if (typeof window.hasPermission === 'function' && (window.hasPermission('ROADS.CREATE') || window.hasPermission('*'))) {
      this.canWrite = true;
    } else {
      this.canWrite = !role || ['admin', 'director_public_works', 'head_of_roads', 'roads_engineer', 'land_surveyor', 'quantity_surveyor'].includes(role);
    }
    this.isAdmin  = !role || role === 'admin' || role === 'director_public_works';
  }

  /* ─── بناء الواجهة الرئيسية ─────────────────────────────────────────── */
  _buildUI() {
    this.container.innerHTML = `
      <div id="rm-root" style="background:var(--bg-card);color:var(--text);padding:20px;
            border-radius:var(--radius);border:1px solid var(--border);direction:rtl;font-family:'Tajawal',system-ui,sans-serif;">

        <!-- شريط الرأس والأدوات التنفيذية -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;font-size:1.25rem;font-weight:800;color:var(--text);display:flex;align-items:center;gap:8px;">
              <span>🛣️</span> منظومة إدارة أصول وشبكة الطرق (RAMS / PMS)
            </h2>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
              إدارة المخزون الهندسي، التقييم الدوري لحالة الرصفة (PCI)، وحساب كلف الصيانة والتأهيل
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button id="rm-export-excel" class="btn btn-outline" style="font-size:0.82rem;padding:7px 14px;">📊 تصدير Excel</button>
            <button id="rm-print-all" class="btn btn-outline" style="font-size:0.82rem;padding:7px 14px;">🖨️ طباعة تقرير الشبكة</button>
            <button id="rm-refresh" class="btn btn-outline" style="font-size:0.82rem;padding:7px 14px;">🔄 تحديث</button>
            <button id="rm-add" class="btn btn-primary" style="font-size:0.82rem;padding:7px 16px;font-weight:bold;">➕ إضافة طريق جديد</button>
          </div>
        </div>

        <!-- بطاقات مؤشرات الأداء الرئيسية (KPIs Grid) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px;margin-bottom:18px;">
          <div class="stat-card" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">إجمالي أطوال الشبكة</span>
              <span style="font-size:1.3rem;">📏</span>
            </div>
            <div id="kpi-road-length" style="font-size:1.45rem;font-weight:800;color:var(--primary);margin-top:6px;">0.0 كم</div>
            <div id="kpi-road-count" style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">إجمالي: 0 طريق مسجل</div>
          </div>

          <div class="stat-card" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">متوسط جودة الرصف (PCI)</span>
              <span style="font-size:1.3rem;">📊</span>
            </div>
            <div id="kpi-road-pci" style="font-size:1.45rem;font-weight:800;color:#10b981;margin-top:6px;">80 / 100</div>
            <div id="kpi-road-status" style="font-size:0.72rem;color:#10b981;margin-top:2px;">حالة الشبكة العامة: جيدة</div>
          </div>

          <div class="stat-card" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">مقاطع حرجة (أولوية صيانة)</span>
              <span style="font-size:1.3rem;">🚨</span>
            </div>
            <div id="kpi-road-critical" style="font-size:1.45rem;font-weight:800;color:#ef4444;margin-top:6px;">0 طريق</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">مؤشر PCI أقل من 60</div>
          </div>

          <div class="stat-card" style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">كلفة التأهيل والصيانة التقديرية</span>
              <span style="font-size:1.3rem;">💰</span>
            </div>
            <div id="kpi-road-cost" style="font-size:1.45rem;font-weight:800;color:var(--accent);margin-top:6px;">0 د.أ</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">بناءً على فحوصات ومعايير PMS</div>
          </div>
        </div>

        <!-- الخريطة الجغرافية التفاعلية -->
        <div style="margin-bottom:18px;background:var(--bg-surface);padding:8px;border-radius:12px;border:1px solid var(--border);position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
            <div style="font-weight:700;font-size:0.88rem;color:var(--text);display:flex;align-items:center;gap:6px;">
              <span>🗺️</span> خارطة شبكة الطرق المكانية (GIS Spatial Map)
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;">
              <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#10b981;"></span> ممتاز (85-100)</span>
              <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span> متوسط (60-84)</span>
              <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;"></span> حرج (&lt;60)</span>
            </div>
          </div>
          <div id="rm-map" style="width:100%;height:430px;border-radius:10px;border:1px solid var(--border);"></div>
        </div>

        <!-- شريط الفلاتر والبحث -->
        <div style="background:var(--bg-surface);padding:14px;border-radius:12px;border:1px solid var(--border);margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <input id="rm-search" type="text" placeholder="🔍 بحث باسم الشارع أو الكود..."
            style="background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);padding:8px 14px;border-radius:8px;font-size:0.84rem;flex:1 1 220px;outline:none;" />
          
          <select id="rm-filter-category" style="background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);padding:8px 14px;border-radius:8px;font-size:0.84rem;outline:none;">
            <option value="">جميع التصنيفات</option>
            <option value="شرياني">شرياني</option>
            <option value="رئيسي">رئيسي</option>
            <option value="تجميعي">تجميعي</option>
            <option value="محلي">محلي</option>
            <option value="فرعي">فرعي</option>
            <option value="زراعي">زراعي</option>
          </select>

          <select id="rm-filter-pci" style="background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);padding:8px 14px;border-radius:8px;font-size:0.84rem;outline:none;">
            <option value="">جميع حالات الرصف</option>
            <option value="good">🟢 ممتاز (85-100)</option>
            <option value="fair">🟡 متوسط (60-84)</option>
            <option value="poor">🔴 متدهور وحرج (&lt;60)</option>
          </select>

          <span id="rm-badge" style="background:rgba(59,130,246,0.12);color:var(--primary);font-size:0.82rem;padding:6px 14px;border-radius:8px;font-weight:bold;border:1px solid rgba(59,130,246,0.25);">
            إجمالي: 0 طريق
          </span>
        </div>

        <!-- جدول بيانات الطرق -->
        <div style="background:var(--bg-surface);border-radius:12px;border:1px solid var(--border);padding:16px;overflow-x:auto;">
          <table id="rm-table" style="width:100%;text-align:right;font-size:0.82rem;border-collapse:collapse;min-width:920px;">
            <thead style="background:var(--table-header-bg);color:var(--table-header-text);border-bottom:2px solid var(--border);">
              <tr>
                <th style="padding:11px 10px;">كود الطريق</th>
                <th style="padding:11px 10px;">اسم الشارع / الطريق</th>
                <th style="padding:11px 10px;">التصنيف الهيكلي</th>
                <th style="padding:11px 10px;">الطول (كم)</th>
                <th style="padding:11px 10px;">العرض (م)</th>
                <th style="padding:11px 10px;">المسارب</th>
                <th style="padding:11px 10px;">مؤشر الرصف (PCI)</th>
                <th style="padding:11px 10px;">نوع السطح</th>
                <th style="padding:11px 10px;text-align:center;">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody id="rm-tbody">
              <tr><td colspan="9" style="text-align:center;padding:36px;color:var(--text-muted);">
                ⏳ جاري تحميل بيانات الطرق...
              </td></tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- النافذة المنبثقة لإضافة / تعديل طريق -->
      <div id="rm-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;backdrop-filter:blur(6px);align-items:center;justify-content:center;">
        <div style="background:var(--bg-card);color:var(--text);width:90%;max-width:760px;max-height:90vh;overflow-y:auto;border-radius:16px;border:1px solid var(--border);padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.5);direction:rtl;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:18px;">
            <h3 id="rm-modal-title" style="margin:0;font-size:1.15rem;font-weight:bold;color:var(--text);">🛣️ إضافة طريق جديد</h3>
            <button id="rm-modal-close" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;">✕</button>
          </div>

          <form id="rm-form" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="f-rm-id" />
            <input type="hidden" id="f-rm-geojson" />

            <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">كود الطريق *</label>
                <input type="text" id="f-rm-code" required placeholder="RD-2026-001"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">اسم الطريق / الشارع *</label>
                <input type="text" id="f-rm-name" required placeholder="شارع كفرنجة الرئيسي..."
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">التصنيف</label>
                <select id="f-rm-category" style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;">
                  <option value="شرياني">شرياني</option>
                  <option value="رئيسي">رئيسي</option>
                  <option value="تجميعي">تجميعي</option>
                  <option value="محلي">محلي</option>
                  <option value="فرعي" selected>فرعي</option>
                  <option value="زراعي">زراعي</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">الطول (كم)</label>
                <input type="number" step="0.001" id="f-rm-length" placeholder="0.000"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">العرض (م)</label>
                <input type="number" step="0.1" id="f-rm-width" placeholder="12.0"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">المسارب</label>
                <input type="number" id="f-rm-lanes" value="2"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">حالة السطح / الرصف</label>
                <select id="f-rm-surface" style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;">
                  <option value="خلطة إسفلتية ساخنة">خلطة إسفلتية ساخنة</option>
                  <option value="خلطة إسفلتية باردة">خلطة إسفلتية باردة</option>
                  <option value="فرشيات ترابية">فرشيات ترابية</option>
                  <option value="بلاط تعشيق إنترلوك">بلاط تعشيق إنترلوك</option>
                  <option value="خرسانة مسلحة">خرسانة مسلحة</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">مؤشر جودة الرصف (PCI)</label>
                <input type="number" min="0" max="100" id="f-rm-pci" value="85"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">حجم المرور اليومي (AADT)</label>
                <input type="number" id="f-rm-aadt" placeholder="1000"
                  style="width:100%;padding:9px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
            </div>

            <!-- خريطة رسم المسار الهندسي في النافذة -->
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <label style="font-size:0.8rem;font-weight:bold;color:var(--text-muted);">📍 المسار الجغرافي المكاني (انقر على الخريطة لرسم مسار الطريق):</label>
                <button type="button" id="rm-clear-draw" class="btn btn-sm btn-outline" style="font-size:0.72rem;padding:3px 8px;">مسح المسار 🔄</button>
              </div>
              <div id="rm-draw-map" style="width:100%;height:220px;border-radius:8px;border:1px solid var(--border);"></div>
              <div id="rm-draw-length-hint" style="font-size:0.75rem;color:var(--primary);margin-top:4px;font-weight:bold;">الطول المحسوب للمسار: 0.00 كم</div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;border-top:1px solid var(--border);padding-top:14px;">
              <button type="button" id="rm-modal-cancel" class="btn btn-outline">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="font-weight:bold;padding:9px 24px;">💾 حفظ الطريق في المنظومة</button>
            </div>
          </form>
        </div>
      </div>

      <!-- النافذة المنبثقة لفحص وتقييم عيوب الرصف (PMS Distress Inspection Modal) -->
      <div id="rm-pms-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;backdrop-filter:blur(6px);align-items:center;justify-content:center;">
        <div style="background:var(--bg-card);color:var(--text);width:90%;max-width:650px;max-height:90vh;overflow-y:auto;border-radius:16px;border:1px solid var(--border);padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.5);direction:rtl;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:16px;">
            <h3 style="margin:0;font-size:1.15rem;font-weight:bold;color:var(--text);">🛠️ تقييم فني لحالة الرصف والعيوب (PMS Inspection)</h3>
            <button id="rm-pms-close" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;">✕</button>
          </div>

          <form id="rm-pms-form" style="display:flex;flex-direction:column;gap:14px;">
            <input type="hidden" id="pms-road-id" />

            <div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <b id="pms-road-title" style="color:var(--primary);font-size:0.95rem;">-</b>
              <div id="pms-road-subtitle" style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">-</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">تاريخ الكشف الفني</label>
                <input type="date" id="pms-date" required style="width:100%;padding:8px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">نوع العيب الرئيسي المكتشف</label>
                <select id="pms-distress" style="width:100%;padding:8px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;">
                  <option value="تشققات تمساحية Alligator">تشققات تمساحية (Alligator Cracking)</option>
                  <option value="تشققات طولية وعرضية Longitudinal">تشققات طولية وعرضية (Longitudinal)</option>
                  <option value="حفر وتآكل Potholes">حفر وتآكل موضعي (Potholes)</option>
                  <option value="أخاديد ومسارات عجلات Rutting">أخاديد مسارات عجلات (Rutting)</option>
                  <option value="هبوطات ونزف إسفلتي Bleeding">هبوطات ونزف إسفلتي (Bleeding)</option>
                  <option value="لا توجد عيوب جوهرية">حالة ممتازة - لا توجد عيوب جوهرية</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">مؤشر جودة الرصف المقيم (PCI)</label>
                <input type="number" min="0" max="100" id="pms-pci" value="80" style="width:100%;padding:8px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;" />
              </div>
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:bold;margin-bottom:6px;color:var(--text-muted);">التوصية الهندسية المعتمدة</label>
                <select id="pms-recommendation" style="width:100%;padding:8px 12px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--input-border);border-radius:8px;outline:none;">
                  <option value="صيانة دورية عادية">صيانة دورية عادية</option>
                  <option value="ختم شقوق ومعالجة سطحية">ختم شقوق ومعالجة سطحية (Crack Sealing)</option>
                  <option value="ترقيع إسفلتي ساخن Patching">ترقيع إسفلتي ساخن (Patching)</option>
                  <option value="كشط وإعادة تعبيد Mill & Overlay">كشط وإعادة تعبيد (Mill & Overlay)</option>
                  <option value="إعادة إنشاء كاملة Reconstruction">إعادة إنشاء كاملة (Full Reconstruction)</option>
                </select>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;border-top:1px solid var(--border);padding-top:14px;">
              <button type="button" id="rm-pms-cancel" class="btn btn-outline">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="font-weight:bold;padding:9px 24px;">💾 اعتماد تقرير الفحص وتحديث مؤشر الطريق</button>
            </div>
          </form>
        </div>
      </div>
    `;

    if (!this.canWrite) {
      const addBtn = document.getElementById('rm-add');
      if (addBtn) addBtn.style.display = 'none';
    }

    setTimeout(() => {
      this._initMap();
      this._fetchStats();
      this._fetchRoads();
      this._bindEvents();
    }, 100);
  }

  /* ─── الخريطة الجغرافية ──────────────────────────────────────────────── */
  _initMap() {
    const el = document.getElementById('rm-map');
    if (!el || typeof L === 'undefined') return;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.map = UnifiedGisEngine.createMap('rm-map', [32.2985, 35.7050], 14);
    } else {
      this.map = createUnifiedMap('rm-map', [32.2985, 35.7050], 14);
    }

    this.roadsLayer = L.featureGroup().addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  /* ─── جلب الإحصائيات والمؤشرات التنفيذية ───────────────────────────────── */
  async _fetchStats() {
    try {
      const res = await apiFetch('/v4/roads/stats', { silent: true }).catch(() => null);
      if (res && res.data) {
        const d = res.data;
        document.getElementById('kpi-road-length').textContent = `${d.totalLengthKm || 0} كم`;
        document.getElementById('kpi-road-count').textContent = `إجمالي: ${d.totalCount || 0} طريق مسجل`;
        
        const pciEl = document.getElementById('kpi-road-pci');
        const stEl = document.getElementById('kpi-road-status');
        const pciVal = d.avgPci || 80;
        pciEl.textContent = `${pciVal} / 100`;
        pciEl.style.color = pciVal >= 85 ? '#10b981' : pciVal >= 60 ? '#f59e0b' : '#ef4444';
        stEl.textContent = pciVal >= 85 ? 'حالة الشبكة العامة: ممتازة' : pciVal >= 60 ? 'حالة الشبكة العامة: متوسطة' : 'حالة الشبكة: حرجة';
        stEl.style.color = pciEl.style.color;

        document.getElementById('kpi-road-critical').textContent = `${d.criticalCount || 0} طريق`;
        document.getElementById('kpi-road-cost').textContent = `${(d.estimatedCost || 0).toLocaleString('ar-JO')} د.أ`;
      }
    } catch (e) {
      console.warn('RAMS stats error:', e);
    }
  }

  /* ─── جلب وتحديث بيانات الطرق ─────────────────────────────────────────── */
  async _fetchRoads() {
    try {
      const res = await apiFetch('/v4/roads', { silent: true }).catch(() => []);
      const dataArr = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
      this.activeData = dataArr;
    } catch (e) {
      console.warn('RAMS fetchRoads error:', e);
    }
    this._renderTable(this.activeData);
    this._renderMapRoads(this.activeData);
  }

  /* ─── عرض بيانات الجدول ────────────────────────────────────────────────── */
  _renderTable(data) {
    const tbody = document.getElementById('rm-tbody');
    const badge = document.getElementById('rm-badge');
    if (!tbody) return;
    if (badge) badge.textContent = `إجمالي: ${data.length} طريق`;

    if (!data.length) {
      tbody.innerHTML = `
        <tr><td colspan="9" style="text-align:center;padding:36px;color:var(--text-muted);">
          <div style="font-size:2.2rem;margin-bottom:8px;">📭</div>
          <b style="font-size:0.95rem;">لا توجد طرق مسجلة تطابق معايير البحث والفلترة</b>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const pci = parseFloat(r.pci_score || 80);
      const clr = pci >= 85 ? '#10b981' : pci >= 60 ? '#f59e0b' : '#ef4444';
      const bgClr = pci >= 85 ? 'rgba(16, 185, 129, 0.12)' : pci >= 60 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      const lbl = pci >= 85 ? 'ممتاز' : pci >= 60 ? 'متوسط' : 'حرج';

      return `
        <tr data-rid="${r.id}" style="border-bottom:1px solid var(--border);transition:background 0.2s;">
          <td style="padding:11px 10px;font-weight:bold;color:var(--primary);">${r.code || r.id}</td>
          <td style="padding:11px 10px;font-weight:700;color:var(--text);">${r.name || '—'}</td>
          <td style="padding:11px 10px;">
            <span style="background:var(--bg-card);color:var(--text);padding:3px 9px;border-radius:6px;font-size:0.75rem;border:1px solid var(--border);">
              ${r.category || r.classification || 'فرعي'}
            </span>
          </td>
          <td style="padding:11px 10px;font-weight:600;">${parseFloat(r.length_km || 0).toFixed(2)} كم</td>
          <td style="padding:11px 10px;">${parseFloat(r.width_m || 0).toFixed(1)} م</td>
          <td style="padding:11px 10px;">${r.lanes_count || r.lanes || 2}</td>
          <td style="padding:11px 10px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:55px;height:7px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
                <div style="width:${pci}%;height:100%;background:${clr};border-radius:4px;"></div>
              </div>
              <span style="background:${bgClr};color:${clr};padding:2px 6px;border-radius:6px;font-weight:bold;font-size:0.74rem;">${pci} | ${lbl}</span>
            </div>
          </td>
          <td style="padding:11px 10px;font-size:0.78rem;color:var(--text-muted);">${r.surface_condition || 'خلطة إسفلتية'}</td>
          <td style="padding:11px 10px;text-align:center;">
            <div style="display:flex;gap:4px;justify-content:center;align-items:center;">
              <button class="btn btn-sm btn-outline rm-row-view" data-id="${r.id}" title="معاينة وتكبير على الخريطة" style="padding:4px 8px;font-size:0.78rem;">👁️</button>
              <button class="btn btn-sm btn-outline rm-row-pms" data-id="${r.id}" title="تقييم وفحص حالة الرصف (PMS)" style="padding:4px 8px;font-size:0.78rem;color:#f59e0b;border-color:#f59e0b;">🛠️ فحص</button>
              ${this.canWrite ? `<button class="btn btn-sm btn-outline rm-row-edit" data-id="${r.id}" title="تعديل بيانات الطريق" style="padding:4px 8px;font-size:0.78rem;color:var(--primary);">✏️</button>` : ''}
              <button class="btn btn-sm btn-outline rm-row-print" data-id="${r.id}" title="طباعة بطاقة الطريق الفنية" style="padding:4px 8px;font-size:0.78rem;">🖨️</button>
              ${this.isAdmin ? `<button class="btn btn-sm btn-outline rm-row-del" data-id="${r.id}" title="حذف الطريق" style="padding:4px 8px;font-size:0.78rem;color:#ef4444;border-color:#ef4444;">🗑️</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this._bindTableEvents();
  }

  /* ─── رسم الطرق على الخريطة ─────────────────────────────────────────── */
  _renderMapRoads(data) {
    if (!this.roadsLayer) return;
    this.roadsLayer.clearLayers();
    const bounds = L.latLngBounds();

    data.forEach(r => {
      const raw = r.geometry || r.geom_geojson || r.geoJson;
      if (!raw) return;
      try {
        const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const pci = parseFloat(r.pci_score || 80);
        const clr = pci >= 85 ? '#10b981' : pci >= 60 ? '#f59e0b' : '#ef4444';
        
        const lyr = L.geoJSON(geo, {
          style: {
            color: clr,
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round'
          }
        });

        lyr.bindPopup(`
          <div style="direction:rtl;font-family:'Tajawal',sans-serif;padding:6px;min-width:200px;">
            <b style="color:var(--primary);font-size:0.95rem;display:block;margin-bottom:4px;">🛣️ ${r.name}</b>
            <div style="font-size:0.78rem;color:#64748b;margin-bottom:4px;">كود: ${r.code || r.id} | ${r.category || 'فرعي'}</div>
            <div style="font-size:0.8rem;margin-bottom:4px;">📏 الطول: <b>${parseFloat(r.length_km||0).toFixed(2)} كم</b> | العرض: <b>${parseFloat(r.width_m||0).toFixed(1)} م</b></div>
            <div style="font-size:0.8rem;margin-bottom:8px;font-weight:bold;color:${clr};">مؤشر الرصف: ${pci} / 100 (${pci>=85?'ممتاز':pci>=60?'متوسط':'حرج'})</div>
            <div style="display:flex;gap:4px;">
              <button onclick="window.roadsManager._openPmsModal('${r.id}')" style="flex:1;background:#f59e0b;color:#fff;border:none;padding:5px;border-radius:4px;cursor:pointer;font-size:0.75rem;">🛠️ فحص PMS</button>
              <button onclick="window.roadsManager._openModal('${r.id}')" style="flex:1;background:#2563eb;color:#fff;border:none;padding:5px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✏️ تعديل</button>
            </div>
          </div>
        `);

        this.roadsLayer.addLayer(lyr);
        try {
          const b = lyr.getBounds();
          if (b.isValid()) bounds.extend(b);
        } catch {}
      } catch (e) {
        console.warn('Map road render error:', e);
      }
    });

    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /* ─── ربط تفاعلات الواجهة والبحث ─────────────────────────────────────── */
  _bindEvents() {
    document.getElementById('rm-refresh')?.addEventListener('click', () => {
      this._fetchStats();
      this._fetchRoads();
    });

    document.getElementById('rm-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('rm-modal-close')?.addEventListener('click', () => this._closeModal());
    document.getElementById('rm-modal-cancel')?.addEventListener('click', () => this._closeModal());

    document.getElementById('rm-pms-close')?.addEventListener('click', () => this._closePmsModal());
    document.getElementById('rm-pms-cancel')?.addEventListener('click', () => this._closePmsModal());

    document.getElementById('rm-clear-draw')?.addEventListener('click', () => this._clearDrawnGeometry());

    // البحث والفلترة الذكية
    const applyFilters = () => {
      const q = document.getElementById('rm-search')?.value.trim().toLowerCase() || '';
      const cat = document.getElementById('rm-filter-category')?.value || '';
      const pciFilter = document.getElementById('rm-filter-pci')?.value || '';

      const filtered = this.activeData.filter(r => {
        const matchesQ = !q || (r.name||'').toLowerCase().includes(q) || (r.code||'').toLowerCase().includes(q);
        const matchesCat = !cat || (r.category === cat || r.classification === cat);
        
        const pci = parseFloat(r.pci_score || 80);
        let matchesPci = true;
        if (pciFilter === 'good') matchesPci = pci >= 85;
        if (pciFilter === 'fair') matchesPci = pci >= 60 && pci < 85;
        if (pciFilter === 'poor') matchesPci = pci < 60;

        return matchesQ && matchesCat && matchesPci;
      });

      this._renderTable(filtered);
    };

    document.getElementById('rm-search')?.addEventListener('input', applyFilters);
    document.getElementById('rm-filter-category')?.addEventListener('change', applyFilters);
    document.getElementById('rm-filter-pci')?.addEventListener('change', applyFilters);

    // Form Submits
    document.getElementById('rm-form')?.addEventListener('submit', (e) => this._handleRoadSubmit(e));
    document.getElementById('rm-pms-form')?.addEventListener('submit', (e) => this._handlePmsSubmit(e));

    // Print all & Export Excel
    document.getElementById('rm-print-all')?.addEventListener('click', () => this._printAll());
    document.getElementById('rm-export-excel')?.addEventListener('click', () => this._exportExcel());
  }

  _bindTableEvents() {
    const tbody = document.getElementById('rm-tbody');
    if (!tbody) return;

    tbody.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains('rm-row-view')) {
        this._previewOnMap(id);
      } else if (btn.classList.contains('rm-row-pms')) {
        this._openPmsModal(id);
      } else if (btn.classList.contains('rm-row-edit')) {
        this._openModal(id);
      } else if (btn.classList.contains('rm-row-print')) {
        this._printRoad(id);
      } else if (btn.classList.contains('rm-row-del')) {
        this._deleteRoad(id);
      }
    };
  }

  /* ─── نافذة إضافة / تعديل طريق ورسم المسار ────────────────────────────── */
  _openModal(roadId) {
    this._editingId = roadId;
    const modal = document.getElementById('rm-modal');
    const titleEl = document.getElementById('rm-modal-title');
    if (!modal) return;

    modal.style.display = 'flex';

    if (roadId) {
      titleEl.textContent = '✏️ تعديل بيانات ومسار الطريق';
      const r = this.activeData.find(x => String(x.id) === String(roadId));
      if (r) {
        document.getElementById('f-rm-id').value = r.id;
        document.getElementById('f-rm-code').value = r.code || '';
        document.getElementById('f-rm-name').value = r.name || '';
        document.getElementById('f-rm-category').value = r.category || r.classification || 'فرعي';
        document.getElementById('f-rm-length').value = parseFloat(r.length_km || 0);
        document.getElementById('f-rm-width').value = parseFloat(r.width_m || 0);
        document.getElementById('f-rm-lanes').value = r.lanes_count || r.lanes || 2;
        document.getElementById('f-rm-surface').value = r.surface_condition || 'خلطة إسفلتية ساخنة';
        document.getElementById('f-rm-pci').value = r.pci_score || 85;
        document.getElementById('f-rm-aadt').value = r.aadt_volume || 1000;
        document.getElementById('f-rm-geojson').value = r.geometry || r.geom_geojson || r.geoJson || '';
      }
    } else {
      titleEl.textContent = '🛣️ إضافة طريق جديد إلى الشبكة';
      document.getElementById('rm-form').reset();
      document.getElementById('f-rm-id').value = '';
      document.getElementById('f-rm-code').value = `RD-${new Date().getFullYear()}-${String(this.activeData.length + 1).padStart(3, '0')}`;
      document.getElementById('f-rm-geojson').value = '';
    }

    setTimeout(() => this._initDrawMap(), 200);
  }

  _closeModal() {
    const modal = document.getElementById('rm-modal');
    if (modal) modal.style.display = 'none';
  }

  _initDrawMap() {
    const el = document.getElementById('rm-draw-map');
    if (!el || typeof L === 'undefined') return;

    if (this.drawMap) {
      this.drawMap.remove();
      this.drawMap = null;
    }

    if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
      this.drawMap = UnifiedGisEngine.createMap('rm-draw-map', [32.2985, 35.7050], 14);
    } else {
      this.drawMap = createUnifiedMap('rm-draw-map', [32.2985, 35.7050], 14);
    }

    this.drawLayer = L.featureGroup().addTo(this.drawMap);
    this.drawnCoords = [];

    // Load existing geometry if editing
    const rawGeo = document.getElementById('f-rm-geojson')?.value;
    if (rawGeo) {
      try {
        const parsed = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
        if (parsed && parsed.coordinates) {
          const lyr = L.geoJSON(parsed, { style: { color: '#2563eb', weight: 5 } }).addTo(this.drawLayer);
          this.drawMap.fitBounds(lyr.getBounds(), { padding: [20, 20] });
          if (parsed.type === 'LineString') {
            this.drawnCoords = parsed.coordinates.map(c => [c[1], c[0]]);
          }
        }
      } catch {}
    }

    // Click to draw line coordinates
    this.drawMap.on('click', (e) => {
      this.drawnCoords.push([e.latlng.lat, e.latlng.lng]);
      this._updateDrawnPolyline();
    });
  }

  _updateDrawnPolyline() {
    if (!this.drawLayer) return;
    this.drawLayer.clearLayers();

    if (this.drawnCoords.length > 0) {
      // Draw points
      this.drawnCoords.forEach((pt, i) => {
        L.circleMarker(pt, { radius: 5, color: i === 0 ? '#10b981' : '#2563eb', fillOpacity: 1 }).addTo(this.drawLayer);
      });

      if (this.drawnCoords.length > 1) {
        L.polyline(this.drawnCoords, { color: '#2563eb', weight: 5 }).addTo(this.drawLayer);
        
        // Calculate length in km
        let totalMeters = 0;
        for (let i = 0; i < this.drawnCoords.length - 1; i++) {
          totalMeters += L.latLng(this.drawnCoords[i]).distanceTo(L.latLng(this.drawnCoords[i+1]));
        }
        const totalKm = Math.round((totalMeters / 1000) * 1000) / 1000;
        
        const lenHint = document.getElementById('rm-draw-length-hint');
        if (lenHint) lenHint.textContent = `الطول المحسوب للمسار: ${totalKm} كم (${Math.round(totalMeters)} متر)`;
        
        const lenInput = document.getElementById('f-rm-length');
        if (lenInput && (!lenInput.value || lenInput.value === '0')) lenInput.value = totalKm;

        // Set GeoJSON payload (GeoJSON uses [lng, lat])
        const geoJsonObj = {
          type: 'LineString',
          coordinates: this.drawnCoords.map(pt => [pt[1], pt[0]])
        };
        document.getElementById('f-rm-geojson').value = JSON.stringify(geoJsonObj);
      }
    }
  }

  _clearDrawnGeometry() {
    this.drawnCoords = [];
    if (this.drawLayer) this.drawLayer.clearLayers();
    document.getElementById('f-rm-geojson').value = '';
    const lenHint = document.getElementById('rm-draw-length-hint');
    if (lenHint) lenHint.textContent = 'الطول المحسوب للمسار: 0.00 كم';
  }

  /* ─── حفظ بيانات الطريق ───────────────────────────────────────────────── */
  async _handleRoadSubmit(e) {
    e.preventDefault();
    const payload = {
      id: document.getElementById('f-rm-id').value || undefined,
      code: document.getElementById('f-rm-code').value.trim(),
      name: document.getElementById('f-rm-name').value.trim(),
      category: document.getElementById('f-rm-category').value,
      lengthKm: parseFloat(document.getElementById('f-rm-length').value) || 0,
      widthMeters: parseFloat(document.getElementById('f-rm-width').value) || 0,
      lanesCount: parseInt(document.getElementById('f-rm-lanes').value) || 2,
      surfaceCondition: document.getElementById('f-rm-surface').value,
      pciScore: parseFloat(document.getElementById('f-rm-pci').value) || 85,
      aadtVolume: parseInt(document.getElementById('f-rm-aadt').value) || 0,
      geoJson: document.getElementById('f-rm-geojson').value || undefined
    };

    try {
      const res = await apiFetch('/v4/roads/save-complete', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('✅ تم حفظ بيانات الطريق والمسار بنجاح');
      this._closeModal();
      this._fetchStats();
      this._fetchRoads();
    } catch (err) {
      showToast('❌ خطأ في حفظ الطريق: ' + err.message, 'error');
    }
  }

  /* ─── نافذة فحص وتقييم عيوب الرصف (PMS) ───────────────────────────────── */
  _openPmsModal(roadId) {
    const r = this.activeData.find(x => String(x.id) === String(roadId));
    if (!r) return;

    document.getElementById('pms-road-id').value = r.id;
    document.getElementById('pms-road-title').textContent = `طريق: ${r.name} (${r.code || r.id})`;
    document.getElementById('pms-road-subtitle').textContent = `التصنيف: ${r.category || 'فرعي'} | الطول: ${r.length_km || 0} كم | PCI الحالي: ${r.pci_score || 80}`;
    document.getElementById('pms-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('pms-pci').value = r.pci_score || 80;

    const modal = document.getElementById('rm-pms-modal');
    if (modal) modal.style.display = 'flex';
  }

  _closePmsModal() {
    const modal = document.getElementById('rm-pms-modal');
    if (modal) modal.style.display = 'none';
  }

  async _handlePmsSubmit(e) {
    e.preventDefault();
    const payload = {
      roadId: document.getElementById('pms-road-id').value,
      inspectionDate: document.getElementById('pms-date').value,
      distressType: document.getElementById('pms-distress').value,
      pciScore: parseFloat(document.getElementById('pms-pci').value) || 80,
      recommendation: document.getElementById('pms-recommendation').value
    };

    try {
      await apiFetch('/v4/roads/inspections/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('✅ تم اعتماد الكشف الفني وتحديث مؤشر الرصف بنجاح');
      this._closePmsModal();
      this._fetchStats();
      this._fetchRoads();
    } catch (err) {
      showToast('❌ خطأ في حفظ تقرير الفحص: ' + err.message, 'error');
    }
  }

  /* ─── معاينة طريق على الخريطة ────────────────────────────────────────── */
  _previewOnMap(roadId) {
    const r = this.activeData.find(x => String(x.id) === String(roadId));
    const raw = r ? (r.geometry || r.geom_geojson || r.geoJson) : null;
    if (!raw) {
      showToast('⚠️ لا يوجد مسار مكاني محدد لهذا الطريق');
      return;
    }
    try {
      const geo = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (this.map) {
        const lyr = L.geoJSON(geo);
        this.map.fitBounds(lyr.getBounds(), { padding: [60, 60] });
        showToast(`📍 تم تكبير الخريطة على مسار: ${r.name}`);
      }
    } catch {}
  }

  /* ─── حذف طريق ────────────────────────────────────────────────────────── */
  async _deleteRoad(roadId) {
    if (!confirm('هل أنت متأكد من حذف هذا الطريق نهائياً من قاعدة البيانات؟')) return;
    try {
      await apiFetch(`/v4/roads/${roadId}`, { method: 'DELETE' });
      showToast('✅ تم حذف الطريق بنجاح');
      this._fetchStats();
      this._fetchRoads();
    } catch (err) {
      showToast('❌ خطأ في حذف الطريق: ' + err.message, 'error');
    }
  }

  /* ─── طباعة بطاقة الطريق الفنية بالترويسة والشعار الرسمي المعتمد ────────── */
  _printRoad(roadId) {
    const r = this.activeData.find(x => String(x.id) === String(roadId));
    if (!r) return;

    const pci = parseFloat(r.pci_score || 80);
    const pciStatus = pci >= 85 ? 'ممتاز (85-100)' : pci >= 60 ? 'متوسط (60-84) - صيانة وقائية' : 'حرج (<60) - بحاجة إعادة تأهيل وتعبيد';

    if (typeof window.printStandardDocument === 'function') {
      window.printStandardDocument({
        title: 'بطاقة أصل طريق ومواصفات الرصفة الفنية (RAMS Passport)',
        subtitle: `طريق: ${r.name} (${r.code || r.id})`,
        refNumber: r.code || r.id,
        date: new Date().toLocaleDateString('ar-JO'),
        type: 'single',
        fields: [
          { label: 'كود الطريق المرجعي', value: r.code || r.id },
          { label: 'اسم الطريق / الشارع', value: r.name },
          { label: 'التصنيف الهيكلي', value: r.category || r.classification || 'فرعي' },
          { label: 'الطول الإجمالي (كم)', value: `${parseFloat(r.length_km || 0).toFixed(2)} كم` },
          { label: 'عرض الطريق (م)', value: `${parseFloat(r.width_m || 0).toFixed(1)} م` },
          { label: 'عدد المسارب', value: `${r.lanes_count || r.lanes || 2} مسرب` },
          { label: 'مؤشر جودة الرصف (PCI)', value: `${pci} / 100 — ${pciStatus}` },
          { label: 'حالة ونوع السطح', value: r.surface_condition || r.surface_type || 'خلطة إسفلتية ساخنة' },
          { label: 'حجم المرور اليومي (AADT)', value: r.aadt_volume ? `${r.aadt_volume} مركبة/يوم` : 'غير محدد' },
          { label: 'تاريخ آخر كشف / صيانة', value: r.last_maintenance_date || 'كشف دوري حديث' },
          { label: 'الملاحظات الهندسية', value: r.notes || 'الطريق مسجل وموثق مكانياً ضمن منظومة شبكة الطرق الجغرافية' }
        ],
        signatures: true
      });
    }
  }

  _printAll() {
    if (!this.activeData || !this.activeData.length) {
      showToast('⚠️ لا توجد بيانات طرق للطباعة');
      return;
    }

    if (typeof window.printStandardDocument === 'function') {
      window.printStandardDocument({
        title: 'كشف الجرد الفني الشامل لشبكة الطرق والمواصلات',
        subtitle: 'مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة',
        refNumber: `RAMS-ALL-${new Date().getFullYear()}`,
        date: new Date().toLocaleDateString('ar-JO'),
        type: 'list',
        data: this.activeData.map(r => ({
          code: r.code || r.id,
          name: r.name,
          category: r.category || r.classification || 'فرعي',
          length_km: `${parseFloat(r.length_km || 0).toFixed(2)} كم`,
          width_m: `${parseFloat(r.width_m || 0).toFixed(1)} م`,
          pci_score: `${r.pci_score || 80} / 100`,
          surface_condition: r.surface_condition || 'خلطة إسفلتية'
        })),
        columns: [
          { key: 'code', label: 'كود الطريق' },
          { key: 'name', label: 'اسم الطريق' },
          { key: 'category', label: 'التصنيف' },
          { key: 'length_km', label: 'الطول' },
          { key: 'width_m', label: 'العرض' },
          { key: 'pci_score', label: 'مؤشر الرصف (PCI)' },
          { key: 'surface_condition', label: 'نوع السطح' }
        ],
        signatures: true
      });
    }
  }

  _exportExcel() {
    if (!this.activeData || !this.activeData.length) {
      if (typeof showToast === 'function') showToast('⚠️ لا توجد بيانات للتصدير');
      return;
    }

    const headers = [
      'كود الطريق',
      'اسم الطريق / الشارع',
      'التصنيف الهيكلي',
      'الطول الإجمالي (كم)',
      'عرض الطريق (م)',
      'عدد المسارب',
      'مؤشر جودة الرصف (PCI)',
      'حالة الرصفة',
      'نوع السطح',
      'حجم المرور اليومي (AADT)',
      'كلفة الصيانة التقديرية (د.أ)',
      'الملاحظات'
    ];

    let sumLen = 0;
    let sumCost = 0;

    const rows = this.activeData.map(r => {
      const len = parseFloat(r.length_km || 0);
      const wid = parseFloat(r.width_m || 0);
      const pci = parseFloat(r.pci_score || 80);
      const area = len * 1000 * wid;
      let unitCost = pci < 60 ? 4.5 : (pci < 85 ? 1.5 : 0.2);
      let cost = area * unitCost;

      sumLen += len;
      sumCost += cost;

      const pciStatus = pci >= 85 ? 'ممتاز' : (pci >= 60 ? 'متوسط / صيانة وقائية' : 'حرج / إعادة تأهيل');

      return [
        r.code || r.id,
        r.name || '',
        r.category || r.classification || 'فرعي',
        len,
        wid,
        r.lanes_count || r.lanes || 2,
        pci,
        pciStatus,
        r.surface_condition || 'خلطة إسفلتية ساخنة',
        r.aadt_volume || 0,
        cost,
        r.notes || ''
      ];
    });

    const totals = [
      'الإجمالي الكلي',
      `${this.activeData.length} طريق`,
      '',
      sumLen,
      '',
      '',
      '',
      '',
      '',
      '',
      sumCost,
      ''
    ];

    if (typeof window.exportToExcelFile === 'function') {
      window.exportToExcelFile({
        filename: 'شبكة_وأصول_الطرق_بلدية_كفرنجة',
        title: 'سجل وجرد شبكة الطرق وأصول الرصفات (RAMS / PMS)',
        subtitle: 'مديرية الأشغال والخدمات الهندسية',
        headers,
        rows,
        totals
      });
      if (typeof showToast === 'function') showToast('تم تصدير ملف Excel بنجاح 📊', 'success');
    }
  }
}

// Global initializers
window.ComprehensiveRoadsManager = ComprehensiveRoadsManager;
window.loadRoads = function() {
  const container = document.getElementById('roads-tab-container') || document.getElementById('page-roads');
  if (container) {
    if (!window.roadsManager) {
      window.roadsManager = new ComprehensiveRoadsManager(container.id || 'roads-tab-container');
    } else {
      window.roadsManager._fetchStats();
      window.roadsManager._fetchRoads();
      if (window.roadsManager.map) {
        setTimeout(() => window.roadsManager.map.invalidateSize(), 200);
      }
    }
  }
};
