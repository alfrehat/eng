/**
 * scripts/reset-phase9-pilot-data.js
 * 🧹 تنظيف وإعادة ضبط البيانات التجريبية المعزولة (Phase 09 Pilot Reset)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { isPostgresActive, memDb, saveMemTable } = require('../utils/database');

async function resetPhase9PilotData() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧹 بدء تنظيف وإعادة ضبط البيانات التجريبية للمرحلة التاسعة (Phase 09 Pilot Reset)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const tablesToClean = [
    'users', 'project_portfolios', 'project_plans', 'projects',
    'project_financial_programs', 'project_schedules', 'tenders',
    'contracts', 'claims', 'roads'
  ];

  tablesToClean.forEach(table => {
    if (memDb[table] && Array.isArray(memDb[table])) {
      memDb[table] = memDb[table].filter(row => {
        const id = String(row.id || '');
        return !id.includes('PILOT');
      });
      saveMemTable(table);
    }
  });

  console.log('✅ تم بنجاح إزالة كافة السجلات التجريبية الموسومة بـ PILOT دون المساس بالبيانات الأساسية.');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { success: true };
}

if (require.main === module) {
  resetPhase9PilotData().then(() => process.exit(0)).catch(err => {
    console.error('💥 Failed to reset pilot data:', err);
    process.exit(1);
  });
}

module.exports = resetPhase9PilotData;
