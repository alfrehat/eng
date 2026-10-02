const inspectionEngine = require('../services/inspectionEngineService');
const { closeDatabase } = require('../utils/database');

async function test() {
  console.log('Testing inspectionEngine.recordInspection...');
  const res = await inspectionEngine.recordInspection({
    roadId: 'ROAD-001',
    siteLocation: 'وسط البلد - كفرنجة',
    inspectorName: 'م. أحمد فريحات',
    condition: 'PASSED',
    severityLevel: 'NORMAL',
    defects: [{ type: 'حفرة سطحية', severity: 'منخفضة' }],
    notes: 'فحص دوري للمقطع أ'
  }, { id: 'U-ADMIN', fullName: 'مدير النظام' });

  console.log('Recorded Inspection:', res);

  const fetched = await inspectionEngine.getInspectionById(res.id);
  console.log('Fetched Inspection:', fetched);

  const stats = await inspectionEngine.getInspectionStats();
  console.log('Stats:', stats);

  await closeDatabase();
  process.exit(0);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
