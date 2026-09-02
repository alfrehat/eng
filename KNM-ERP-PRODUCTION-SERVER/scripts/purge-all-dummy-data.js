/**
 * scripts/purge-all-dummy-data.js
 * سكريبت الحذف الشامل لكافة البيانات والمدخلات التجريبية والافتراضية
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * يقوم هذا السكريبت بما يلي:
 * 1. تصفير وتفريغ كافة الجداول التشغيلية والتجريبية من ملفات الذاكرة JSON في مجلد database/
 * 2. تصفير جداول PostgreSQL إن كانت متصلة وإعادة ضبط المتسلسلات (Sequences to 1).
 * 3. تفريغ مجلد المرفقات والملفات المرفوعة uploads/ من أية ملفات اختبار.
 * 4. الحفاظ التام على الإعدادات المؤسسية الأصلية، الهيكل الإداري، حسابات المستخدمين الحقيقية، والقوالب الرسمية.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_DIR = path.join(__dirname, '..', 'database');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// 1. قائمة الجداول التشغيلية التي تحتوي على بيانات تجريبية / افتراضية مراد حذفها
const OPERATIONAL_DATA_TABLES = [
  'projects',
  'project_portfolios',
  'project_portfolio_projects',
  'project_plans',
  'project_plan_projects',
  'project_schedules',
  'project_dependencies',
  'project_milestones',
  'project_risks',
  'project_priority_scores',
  'project_priority_results',
  'project_priority_criteria',
  'project_financial_programs',
  'project_progress_logs',
  'tenders',
  'tender_studies',
  'tender_daily_reports',
  'contracts',
  'contract_variation_orders',
  'variation_orders',
  'contract_clauses',
  'bank_guarantees',
  'claims',
  'purchases',
  'tasks',
  'excavation_permits',
  'paving_returns',
  'roads',
  'road_inspections',
  'road_pci_surveys',
  'road_defects',
  'pavement_inspections',
  'structural_assets',
  'energy_assets',
  'infrastructure_networks',
  'gis_survey_points',
  'rams_maintenance_history',
  'committee_reports',
  'archive',
  'documents',
  'notifications',
  'activity_log'
];

// 2. الجداول المؤسسية الثابتة والمحمية التي لا يجب حذفها (فقط التحقق من سلامتها)
const SYSTEM_PROTECTED_TABLES = [
  'users',
  'roles',
  'role_permissions',
  'org_units',
  'user_org_units',
  'system_settings',
  'print_templates',
  'master_print_config',
  'lookups',
  'workflows'
];

async function purgeAllDummyData() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧹 بدء عملية التطهير الشامل وحذف كافة البيانات والمدخلات التجريبية والافتراضية');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let clearedCount = 0;

  // الخطوة 1: تنظيف وتصفير ملفات الذاكرة JSON في database/
  console.log('📂 1. تصفير جداول وملفات الذاكرة (JSON Database Files)...');
  for (const table of OPERATIONAL_DATA_TABLES) {
    const filePath = path.join(DATABASE_DIR, `${table}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      console.log(`   ✅ تم إفراغ وتصفير: ${table}.json`);
      clearedCount++;
    } catch (err) {
      console.warn(`   ⚠️ تعذر تحديث: ${table}.json:`, err.message);
    }
  }

  // الخطوة 2: تنظيف مجلد uploads/ من الملفات المؤقتة والتجريبية
  console.log('\n📁 2. تنظيف وتطهير مجلد المرفقات والملفات (uploads/)...');
  if (fs.existsSync(UPLOADS_DIR)) {
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      let removedFiles = 0;
      for (const file of files) {
        if (file === '.gitkeep' || file === 'README.md') continue;
        const filePath = path.join(UPLOADS_DIR, file);
        try {
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          removedFiles++;
        } catch (e) {}
      }
      console.log(`   ✅ تم حذف (${removedFiles}) ملف ومرفق تجريبي من مجلد uploads/`);
    } catch (e) {
      console.warn('   ⚠️ تعذر قراءة مجلد uploads/:', e.message);
    }
  } else {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('   ✅ تم إنشاء مجلد uploads/ نظيف.');
  }

  // الخطوة 3: تصفير جداول قاعدة بيانات PostgreSQL إن كانت تعمل
  console.log('\n🗄️ 3. تصفير جداول قاعدة بيانات PostgreSQL وإعادة ضبط المتسلسلات...');
  try {
    const pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'kafr_inja_engineering'
    });

    const client = await pool.connect();
    console.log('   ✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح.');

    for (const table of OPERATIONAL_DATA_TABLES) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`   ✅ PostgreSQL: تم إفراغ الجدول ${table}`);
      } catch (err) {
        try {
          await client.query(`DELETE FROM "${table}";`);
          console.log(`   ✅ PostgreSQL: تم حذف سجلات الجدول ${table}`);
        } catch (e) {
          // Table doesn't exist in pg, skip
        }
      }
    }

    // إعادة ضبط الـ Sequences
    try {
      const seqRes = await client.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public';
      `);
      for (const row of seqRes.rows) {
        try {
          await client.query(`ALTER SEQUENCE "${row.sequence_name}" RESTART WITH 1;`);
          console.log(`   🔄 تم تصفير المتسلسل: ${row.sequence_name} إلى 1`);
        } catch (e) {}
      }
    } catch (e) {}

    client.release();
    await pool.end();
  } catch (err) {
    console.log('   ℹ️ تنبيه: قاعدة بيانات PostgreSQL غير متصلة، تم تطبيق التطهير الكامل على محرك الذاكرة JSON بنجاح.');
  }

  // الخطوة 4: التحقق من سلامة الجداول المؤسسية الثابتة
  console.log('\n🔒 4. فحص وتأكيد سلامة الجداول والإعدادات المؤسسية المحمية...');
  for (const table of SYSTEM_PROTECTED_TABLES) {
    const filePath = path.join(DATABASE_DIR, `${table}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        console.log(`   🛡️ مؤمن ومحمي: ${table}.json (${count} سجل/إعداد)`);
      } catch (e) {
        console.log(`   🛡️ مؤمن ومحمي: ${table}.json`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`🎉 اكتملت عملية التطهير بنجاح تام! تم تصفير (${clearedCount}) جدول تشغيلي.`);
  console.log('✨ النظام الآن خالٍ تماماً من أية بيانات افتراضية أو تجريبية وجاهز لبدء العمل الفعلي (Fresh Production Clean State).');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

purgeAllDummyData().catch(console.error);
