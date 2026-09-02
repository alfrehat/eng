require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initializeDatabase, isPostgresActive, dbRun, dbQuery } = require('../utils/database.js');

const OPERATIONAL_TABLES = [
  'tenders',
  'claims',
  'purchases',
  'tasks',
  'contracts',
  'archive',
  'roads',
  'road_inspections',
  'road_defects',
  'road_pci_surveys',
  'pavement_inspections',
  'rams_maintenance_history',
  'paving_returns',
  'structural_assets',
  'infrastructure_networks',
  'energy_assets',
  'excavation_permits',
  'tender_daily_reports',
  'tender_studies',
  'committee_reports',
  'contract_clauses',
  'contract_variation_orders',
  'variation_orders',
  'bank_guarantees',
  'documents',
  'gis_survey_points',
  'projects',
  'project_milestones',
  'project_risks',
  'project_progress_logs',
  'project_portfolios',
  'project_portfolio_projects',
  'project_plans',
  'project_plan_projects',
  'project_priority_scores',
  'project_priority_results',
  'project_financial_programs',
  'project_dependencies',
  'project_schedules',
  'directorate_budget_allocations'
];

async function purgeAllDummyData() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🧹 بدء عملية التطهير والحذف الشامل لكافة البيانات والإدخالات الافتراضية');
  console.log('🏛️ مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  await initializeDatabase();
  const dbDir = path.join(__dirname, '../database');

  // 1. تصفير جداول العمليات التشغيلية في ملفات JSON
  console.log('📁 1. تفريغ وتصفير ملفات العمليات التشغيلية (JSON Files)...');
  for (const table of OPERATIONAL_TABLES) {
    const filePath = path.join(dbDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
    console.log(`  ✓ تم تصفير جدول: ${table}.json`);
  }

  // 2. تصفير الإشعارات
  console.log('\n🔔 2. تصفير سجل الإشعارات الافتراضية...');
  const rootNotif = path.join(__dirname, '../notifications.json');
  const dbNotif = path.join(dbDir, 'notifications.json');
  fs.writeFileSync(rootNotif, JSON.stringify([], null, 2), 'utf8');
  fs.writeFileSync(dbNotif, JSON.stringify([], null, 2), 'utf8');
  console.log('  ✓ تم تصفير كافة الإشعارات');

  // 3. تهيئة سجل النشاط بسجل أمني أولي نظيف
  console.log('\n📜 3. تصفير وإعادة ضبط سجل الرقابة وتدقيق العمليات (Activity Log)...');
  const initialLog = [
    {
      id: 'LOG-INIT-2026',
      userId: 'U-001',
      action: 'تهيئة الإنتاج والتطهير الشامل',
      entity: 'النظام',
      entityId: 'SYS-INIT',
      details: 'تم بنجاح تطهير وتصفير كافة البيانات والاختبارات الافتراضية وتهيئة النظام لبدء استقبال وإدخال البيانات الواقعية لبلدية كفرنجة الجديدة',
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(path.join(dbDir, 'activity_log.json'), JSON.stringify(initialLog, null, 2), 'utf8');
  console.log('  ✓ تم ضبط سجل النشاطات بحالة البداية النظيفة');

  // 4. تطهير جداول PostgreSQL إن كانت نشطة
  if (isPostgresActive()) {
    console.log('\n🐘 4. تطهير جداول العمليات في قاعدة بيانات PostgreSQL...');
    for (const table of OPERATIONAL_TABLES) {
      try {
        await dbRun(`DELETE FROM ${table}`);
        console.log(`  ✓ PostgreSQL DELETE FROM ${table}`);
      } catch (err) {
        // Table might not exist in Postgres yet
      }
    }
    try {
      await dbRun('DELETE FROM activity_log');
      await dbRun(
        'INSERT INTO activity_log (id, "userId", action, entity, "entityId", details, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [initialLog[0].id, initialLog[0].userId, initialLog[0].action, initialLog[0].entity, initialLog[0].entityId, initialLog[0].details, initialLog[0].createdAt]
      );
      console.log('  ✓ PostgreSQL activity_log initialized');
    } catch (e) {}
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('✅ اكتملت عملية التطهير الشامل بنجاح!');
  console.log('🛡️ تم الحفاظ التام على: الأدوار العشرة الرسمية، مصفوفة الصلاحيات، الهيكل التنظيمي، وحسابات المستخدمين.');
  console.log('═══════════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

purgeAllDummyData();
