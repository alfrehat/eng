/**
 * scripts/archive-redundant-code.js
 * نقل الأكواد والملفات الزائدة والمؤقتة إلى مجلد زائدة/
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const redundantDir = path.join(rootDir, 'زائدة');
const redundantScriptsDir = path.join(redundantDir, 'scripts_مؤقتة');
const redundantDataDir = path.join(redundantDir, 'بيانات_قديمة');

[redundantDir, redundantScriptsDir, redundantDataDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const redundantScripts = [
  'add-columns.js',
  'add-pms-timestamps.js',
  'check-columns.js',
  'check_db_status.js',
  'check_purchases_table.js',
  'clear-dummy-data.js',
  'db-audit.js',
  'ensure-pavement-inspections-table.js',
  'fix-all-columns.js',
  'fix-db-constraints.js',
  'fix-identity.js',
  'fix-lookups-table.js',
  'fix-pms-table.js',
  'fix-workflows.js',
  'full-db-sync.js',
  'inspect-all-tables.js',
  'inspect-lookups.js',
  'inspect-settings-cols.js',
  'inspect-users-table.js',
  'inspect_columns.js',
  'inspect_paving_db.js',
  'migrate-users-profile.js',
  'patch-app-print.js',
  'relax-date-columns.js',
  'reset-theme.js',
  'seed_purchases.js',
  'seed_tasks.js',
  'sync-asset-schema.js',
  'sync_excavation_permits.js',
  'sync_paving_schema.js',
  'sync_real_db_assets.js',
  'test-all-forms.js',
  'test_crud.js',
  'unify-column-casing.js',
  'update_permits_engineer.js',
  'update_permits_schema.js',
  'verify-roads-tab.js'
];

let movedCount = 0;

redundantScripts.forEach(file => {
  const src = path.join(rootDir, 'scripts', file);
  const dest = path.join(redundantScriptsDir, file);
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
    movedCount++;
    console.log(`✅ نقل سكريبت مؤقت: ${file} -> زائدة/scripts_مؤقتة/`);
  }
});

const otherFiles = [
  { src: 'claim_workflow.json', dest: path.join(redundantDataDir, 'claim_workflow.json') },
  { src: 'notifications.json', dest: path.join(redundantDataDir, 'notifications.json') },
  { src: 'data/contracts_db_storage.json', dest: path.join(redundantDataDir, 'contracts_db_storage.json') },
  { src: 'Settings/Pages/visualIdentityManager.js', dest: path.join(redundantDir, 'visualIdentityManager.js') }
];

otherFiles.forEach(({ src, dest }) => {
  const fullSrc = path.join(rootDir, src);
  if (fs.existsSync(fullSrc)) {
    fs.renameSync(fullSrc, dest);
    movedCount++;
    console.log(`✅ نقل ملف قديم: ${src} -> زائدة/`);
  }
});

console.log(`\n🎉 اكتمل نقل ${movedCount} ملفاً زائداً بنجاح إلى مجلد "زائدة" دون التأثير على النظام.`);
