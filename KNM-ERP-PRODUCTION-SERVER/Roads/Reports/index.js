/**
 * Roads Reports Layer - Technical RAMS Reports Generator
 */
const RamsAnalyticsEngine = require('./ramsAnalyticsEngine');
const RoadsService = require('../Services');

class RamsReportGenerator {
  /**
   * توليد تقرير التقييم الفني الشامل لشبكة الطرق بصيغة HTML جاهز للطباعة والتصدير
   */
  static async generateTechnicalNetworkReport() {
    const kpis = await RamsAnalyticsEngine.getNetworkKpis();
    const priorities = await RamsAnalyticsEngine.getMaintenancePriorities();
    const roads = await RoadsService.getAllRoads();

    const reportHtml = `
      <div style="font-family:'Cairo','Tajawal',sans-serif; direction:rtl; padding:20px; color:#1e293b;">
        <div style="text-align:center; border-bottom:3px double #0284c7; padding-bottom:12px; margin-bottom:20px;">
          <h1 style="margin:0; font-size:1.6rem; color:#0f172a;">🗺️ التقرير الفني الشامل لحصر وتأهيل شبكة الطرق ونظام الرصفات (RAMS)</h1>
          <p style="margin:4px 0 0; color:#64748b; font-size:0.9rem;">قسم إدارة أصول الطرق والتحليل المكانية - بلدية كفرنجة الجديدة</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:20px;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:12px; border-radius:8px; text-align:center;">
            <span style="font-size:0.8rem; color:#64748b;">إجمالي الطرق المسجلة</span>
            <div style="font-size:1.4rem; font-weight:bold; color:#0f172a;">${kpis.total_roads} شارع</div>
          </div>
          <div style="background:#ecfdf5; border:1px solid #6ee7b7; padding:12px; border-radius:8px; text-align:center;">
            <span style="font-size:0.8rem; color:#047857;">الطرق الممتازة (PCI 85+)</span>
            <div style="font-size:1.4rem; font-weight:bold; color:#065f46;">${parseFloat(kpis.excellent_km).toFixed(1)} كم</div>
          </div>
          <div style="background:#fffbeb; border:1px solid #fde68a; padding:12px; border-radius:8px; text-align:center;">
            <span style="font-size:0.8rem; color:#b45309;">الطرق المتوسطة (PCI 60-84)</span>
            <div style="font-size:1.4rem; font-weight:bold; color:#92400e;">${parseFloat(kpis.fair_km).toFixed(1)} كم</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fca5a5; padding:12px; border-radius:8px; text-align:center;">
            <span style="font-size:0.8rem; color:#b91c1c;">الطرق المتدهورة (PCI < 60)</span>
            <div style="font-size:1.4rem; font-weight:bold; color:#991b1b;">${parseFloat(kpis.poor_km).toFixed(1)} كم</div>
          </div>
        </div>

        <h3 style="color:#0369a1; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">📊 كشف الطرق وأولويات الصيانة والتأهيل الهندسية:</h3>
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:right; margin-top:10px;">
          <thead>
            <tr style="background:#f1f5f9; color:#334155;">
              <th style="border:1px solid #cbd5e1; padding:8px;">رقم الطريق</th>
              <th style="border:1px solid #cbd5e1; padding:8px;">اسم الشارع</th>
              <th style="border:1px solid #cbd5e1; padding:8px;">التصنيف</th>
              <th style="border:1px solid #cbd5e1; padding:8px;">الطول (كم)</th>
              <th style="border:1px solid #cbd5e1; padding:8px;">مؤشر PCI</th>
              <th style="border:1px solid #cbd5e1; padding:8px;">درجة الأولوية</th>
            </tr>
          </thead>
          <tbody>
            ${priorities.map(p => `
              <tr>
                <td style="border:1px solid #e2e8f0; padding:8px;">${p.code || p.id}</td>
                <td style="border:1px solid #e2e8f0; padding:8px;"><strong>${p.name}</strong></td>
                <td style="border:1px solid #e2e8f0; padding:8px;">${p.surface_condition || 'رئيسي'}</td>
                <td style="border:1px solid #e2e8f0; padding:8px;">${p.length_km || 1.0}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold; color:${(p.pci_score || p.pci_index || 80) >= 85 ? '#10b981' : ((p.pci_score || p.pci_index || 80) >= 60 ? '#f59e0b' : '#ef4444')}">${p.pci_score || p.pci_index || 80}</td>
                <td style="border:1px solid #e2e8f0; padding:8px; font-weight:bold;">${p.priority_rank || p.priority_score || 'عادية'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return reportHtml;
  }
}

module.exports = RamsReportGenerator;
