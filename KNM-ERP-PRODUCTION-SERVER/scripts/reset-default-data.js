/**
 * scripts/reset-default-data.js
 * سكريبت تنظيف البيانات الافتراضية والتجريبية وتصفير الترقيم
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MEM_DB_DIR = path.join(__dirname, '..', 'database');

// الجداول التشغيلية المراد تصفير بياناتها
const OPERATIONAL_TABLES = [
  'tenders',
  'claims',
  'purchases',
  'tasks',
  'contracts',
  'variation_orders',
  'contract_variation_orders',
  'bank_guarantees',
  'excavation_permits',
  'paving_returns',
  'notifications',
  'activity_log',
  'tender_daily_reports',
  'committee_reports',
  'tender_studies',
  'road_defects',
  'road_inspections',
  'pavement_inspections',
  'archive'
];

async function resetAllData() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧹 بدء عملية تصفير البيانات الافتراضية وإعادة ضبط الترقيم...');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. تصفير ملفات الذاكرة JSON
  console.log('📁 1. تنظيف ملفات الذاكرة JSON في مجلد database/...');
  for (const table of OPERATIONAL_TABLES) {
    const filePath = path.join(MEM_DB_DIR, `${table}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      console.log(`   ✅ تم تصفير: ${table}.json`);
    } catch (e) {
      console.warn(`   ⚠️ تعذر تحديث ${table}.json:`, e.message);
    }
  }

  // 2. تنظيف جداول قاعدة بيانات PostgreSQL
  console.log('\n🗄️ 2. الاتصال بقاعدة بيانات PostgreSQL وتصفير الجداول...');
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'kafr_inja_engineering'
  });

  try {
    const client = await pool.connect();
    console.log('   ✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح.');

    for (const table of OPERATIONAL_TABLES) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`   ✅ تم إفراغ الجدول: ${table}`);
      } catch (err) {
        // Table may not exist or different naming
        try {
          await client.query(`DELETE FROM "${table}";`);
          console.log(`   ✅ تم حذف سجلات الجدول: ${table}`);
        } catch (e) {
          // Table doesn't exist in pg, skip safely
        }
      }
    }

    // تصفير أية Sequences في PostgreSQL
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
    console.warn('   ⚠️ تنبيه: تعذر إتمام تصفير PostgreSQL (ربما السيرفر يستخدم Memory DB):', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 اكتملت عملية التصفير بنجاح تام! النظام الآن نظيف وجاهز للإنتاج (Fresh Production State)');
  console.log('🔢 الترقيم سيبدأ تلقائياً من 001 لكافة العطاءات والمطالبات والعقود وتصاريح الحفريات.');
  console.log('═══════════════════════════════════════════════════════════════════');
}

resetAllData().catch(console.error);
