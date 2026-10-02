const db = require('../utils/database');
const inspectionEngineService = require('../services/inspectionEngineService');

async function testRecord() {
  try {
    await db.initDatabase();
    console.log('Testing inspectionEngineService.recordInspection...');
    const res = await inspectionEngineService.recordInspection({
      roadId: 'RD-001',
      siteLocation: 'وسط البلد كفرنجة',
      inspectorName: 'م. أحمد بني نصر',
      condition: 'PASSED',
      severityLevel: 'LOW',
      defects: ['شقوق شعرية بسيطة'],
      notes: 'فحص تجريبي للتدقيق الجنائي'
    }, { id: 'TEST_USER', fullName: 'م. أحمد' });
    console.log('Success result:', res);
    await db.closeDatabase();
  } catch (err) {
    console.error('Expected/Discovered error:', err.message);
    await db.closeDatabase();
  }
}

testRecord();
