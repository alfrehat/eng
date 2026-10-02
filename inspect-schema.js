/**
 * inspect-schema.js
 * 🔍 أداة التدقيق والتشريح الشامل لمخطط قاعدة بيانات بلدية كفرنجة (38 محركاً)
 */

const { dbQuery, isPostgresActive, initializeDatabase } = require('./utils/database');

async function inspectFullSchema() {
  await initializeDatabase();
  console.log('--------------------------------------------------');
  console.log('🏛️ فحص جاهزية قاعدة البيانات - بلدية كفرنجة الجديدة');
  console.log('حالة الاتصال بـ PostgreSQL:', isPostgresActive() ? '✅ نشط (PostgreSQL Mode)' : '⚠️ وضع التخزين المحلي (In-Memory/JSON)');
  console.log('--------------------------------------------------');

  if (isPostgresActive()) {
    const requiredTables = [
      'tenders', 'projects', 'claims', 'contracts', 'construction_contracts',
      'budget_lines', 'budget_allocations', 'road_sections', 'pavement_inspections',
      'paving_returns', 'structural_assets', 'infrastructure_networks', 'energy_assets',
      'excavation_permits', 'archive_documents', 'activity_log', 'users', 'roles',
      'role_permissions', 'workflows', 'org_units', 'tasks', 'purchase_orders'
    ];

    const existingTablesRes = await dbQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const existingTables = new Set(existingTablesRes.map(t => t.table_name));

    console.log(`📦 إجمالي الجداول المرصودة: ${existingTables.size}`);
    
    requiredTables.forEach(t => {
      if (existingTables.has(t)) {
        console.log(`  ✅ الجدول [${t}]: موجود ومفعل.`);
      } else {
        console.log(`  ⚠️ الجدول [${t}]: مفقود (يتطلب ترحيل DDL).`);
      }
    });

    // فحص امتداد PostGIS
    try {
      const postgisVer = await dbQuery("SELECT PostGIS_Version()");
      console.log('🗺️ دعم العمليات المكانية (PostGIS):', postgisVer[0]?.postgis_version || 'مفعل');
    } catch (e) {
      console.log('🗺️ دعم العمليات المكانية (PostGIS): غير مفعل (يعتمد حسابات Haversine الرياضية)');
    }
  }
  console.log('--------------------------------------------------');
}

inspectFullSchema().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
