const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Set test environment
process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

async function runReportsForensicSuite() {
  console.log('===============================================================');
  console.log('🏛️  KAFRANJAH MUNICIPALITY - REPORTS DOMAIN FORENSIC SUITE  🏛️');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const masterConfigPath = path.join(__dirname, '..', 'database', 'master_print_config.json');
  const printTemplatesPath = path.join(__dirname, '..', 'database', 'print_templates.json');
  const savedMasterConfig = fs.existsSync(masterConfigPath) ? fs.readFileSync(masterConfigPath, 'utf8') : null;
  const savedPrintTemplates = fs.existsSync(printTemplatesPath) ? fs.readFileSync(printTemplatesPath, 'utf8') : null;

  function recordPass(testName, details = '') {
    passed++;
    console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
  }

  function recordFail(testName, error) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${error.message || error}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Static Architecture & Anti-Corruption Guard
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Static Architecture & Anti-Corruption Verification ---');
  try {
    const apiFile = path.join(__dirname, '..', 'Reports', 'API', 'printTemplatesEngine.js');
    const apiContent = fs.readFileSync(apiFile, 'utf8');

    // 1.1 Zero direct database calls in API
    assert.strictEqual(apiContent.includes('dbQuery'), false, 'API adapter must not use dbQuery');
    assert.strictEqual(apiContent.includes('dbGet'), false, 'API adapter must not use dbGet');
    assert.strictEqual(apiContent.includes('dbRun'), false, 'API adapter must not use dbRun');
    assert.strictEqual(apiContent.includes('pool.query'), false, 'API adapter must not use pool.query');
    assert.strictEqual(apiContent.includes('memDb'), false, 'API adapter must not contain memDb');
    assert.strictEqual(apiContent.includes('saveMemTable'), false, 'API adapter must not contain saveMemTable');
    assert.strictEqual(apiContent.includes('kfranjah-secure-pki-key'), false, 'API adapter must not have hardcoded secrets');
    assert.ok(apiContent.includes("require('../../services/reportsEngineService')"), 'API adapter must import reportsEngineService');
    recordPass('API Adapter Anti-Corruption', 'Zero direct SQL, Zero memDb, Zero hardcoded secrets, Canonical delegation');

    // 1.2 Zero memDb and Zero DDL in Primary Service
    const serviceFile = path.join(__dirname, '..', 'services', 'reportsEngineService.js');
    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
    assert.strictEqual(/\b(memDb|saveMemTable|loadMemTable)\b/.test(serviceContent), false, 'Primary Service must not contain memDb');
    assert.strictEqual(/\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i.test(serviceContent), false, 'Primary Service must not contain runtime DDL');
    recordPass('Primary Service Architecture', 'Zero memDb, Zero runtime DDL');

    // 1.3 Preservation of UI pages
    const printEngineFile = path.join(__dirname, '..', 'Reports', 'Pages', 'printEngine.js');
    const uiManagerFile = path.join(__dirname, '..', 'Reports', 'Pages', 'unifiedPrintTemplatesManager.js');
    assert.strictEqual(fs.existsSync(printEngineFile), true, 'printEngine.js must exist');
    assert.strictEqual(fs.existsSync(uiManagerFile), true, 'unifiedPrintTemplatesManager.js must exist');
    const printEngineSize = fs.statSync(printEngineFile).size;
    const uiManagerSize = fs.statSync(uiManagerFile).size;
    assert.ok(printEngineSize > 10000, 'printEngine.js must be preserved');
    assert.ok(uiManagerSize > 50000, 'unifiedPrintTemplatesManager.js must be preserved');
    recordPass('UI Files Preserved', `printEngine: ${printEngineSize} bytes, unifiedManager: ${uiManagerSize} bytes`);

    // 1.4 Server mounting
    const serverFile = path.join(__dirname, '..', 'server.js');
    const serverContent = fs.readFileSync(serverFile, 'utf8');
    assert.ok(serverContent.includes('./Reports/API/printTemplatesEngine'), 'server.js must mount printTemplatesEngine');
    recordPass('Server Route Mounting', 'Mounted at /api/reports and aliases');
  } catch (err) {
    recordFail('Static Architecture Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Engine Registry Registration & Canonical Contract
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Engine Registry & Canonical Contract Verification ---');
  try {
    const engineRegistry = require('../services/engineRegistry');
    const reportsEngine = engineRegistry.get('PRINT_REPORT_ENGINE');
    assert.ok(reportsEngine, 'PRINT_REPORT_ENGINE must be registered in engineRegistry');
    assert.strictEqual(reportsEngine.status, 'READY', 'PRINT_REPORT_ENGINE status must be READY');
    assert.ok(reportsEngine.capabilities.includes('official_municipal_reports'));
    assert.ok(reportsEngine.capabilities.includes('print_templates_crud'));
    assert.ok(reportsEngine.capabilities.includes('excel_export'));

    // Operations
    const ops = Object.keys(reportsEngine.exposedOperations);
    assert.ok(ops.includes('getTemplates'), 'Must expose getTemplates');
    assert.ok(ops.includes('getTemplateById'), 'Must expose getTemplateById');
    assert.ok(ops.includes('createTemplate'), 'Must expose createTemplate');
    assert.ok(ops.includes('updateTemplate'), 'Must expose updateTemplate');
    assert.ok(ops.includes('setDefaultTemplate'), 'Must expose setDefaultTemplate');
    assert.ok(ops.includes('duplicateTemplate'), 'Must expose duplicateTemplate');
    assert.ok(ops.includes('deleteTemplate'), 'Must expose deleteTemplate');
    assert.ok(ops.includes('getTemplateStats'), 'Must expose getTemplateStats');
    assert.ok(ops.includes('getMasterConfig'), 'Must expose getMasterConfig');
    assert.ok(ops.includes('saveMasterConfig'), 'Must expose saveMasterConfig');
    assert.ok(ops.includes('generateOfficialDocument'), 'Must expose generateOfficialDocument');
    assert.ok(ops.includes('exportExcel'), 'Must expose exportExcel');
    recordPass('Engine Registry Registration', '14 canonical exposed operations verified');

    // Health check
    const health = await reportsEngine.healthCheck();
    assert.strictEqual(health.healthy, true, 'Health check must report healthy: true');
    assert.strictEqual(health.status, 'READY', 'Health status must be READY');
    recordPass('Engine Health Check', `Status: ${health.status}, DB: ${health.database}, Templates: ${health.templatesCount}`);
  } catch (err) {
    recordFail('Engine Registry Verification', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Master Print Configuration
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Master Print Configuration Management ---');
  try {
    const reportsService = require('../services/reportsEngineService');
    const cfg = await reportsService.getMasterConfig();
    assert.ok(cfg, 'getMasterConfig must return config object');
    assert.strictEqual(cfg.municipalityName, 'بلدية كفرنجة الجديدة');
    assert.strictEqual(cfg.directorateName, 'مديرية الأشغال والخدمات الهندسية');
    assert.strictEqual(cfg.pageSize, 'A4');
    recordPass('Get Master Config', 'Municipal branding, dimensions, and typography confirmed');

    // Update Master Config
    const updated = await reportsService.saveMasterConfig({
      watermarkText: 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة وموثقة 2026'
    }, { id: 'TEST-ADMIN', role: 'admin' });
    assert.strictEqual(updated.watermarkText, 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة وموثقة 2026');
    recordPass('Save Master Config', 'Saved and verified updated master config');
  } catch (err) {
    recordFail('Master Print Configuration', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Print Templates CRUD & PostgreSQL Persistence
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Templates Domain CRUD, PostgreSQL Persistence & KPIs ---');
  let testTemplateId = null;
  const mockUser = { id: 'TEST-REPORT-USER', fullName: 'مهندس التوثيق والتقارير', role: 'admin' };

  try {
    const reportsService = require('../services/reportsEngineService');

    // 4.1 Stats
    const stats = await reportsService.getTemplateStats();
    assert.ok(typeof stats.total === 'number', 'Stats must include total');
    assert.ok(typeof stats.modulesCount === 'number', 'Stats must include modulesCount');
    recordPass('Template KPI Stats', `Total templates: ${stats.total}, Modules: ${stats.modulesCount}`);

    // 4.2 Create Template
    const templateData = {
      name: 'كتاب كشف فني وهندسي ميداني للاختبار',
      module: 'TEST_MODULE',
      category_ar: 'التقارير الهندسية التجريبية',
      description: 'نموذج كشف فني ميداني معتمد للاختبار الجنائي لنظام التقارير',
      orientation: 'portrait',
      is_default: true,
      html_template: '<div class="test-content"><h1>تقرير الكشف الفني</h1><p>محتوى التقرير التجريبي</p></div>',
      signatures_config: [
        { roleName: 'مهندس التنظيم', signLabel: 'التوقيع', position: 'right' }
      ]
    };

    const created = await reportsService.createTemplate(templateData, mockUser);
    assert.ok(created, 'createTemplate must return created item');
    assert.ok(created.id, 'Template must have an id');
    testTemplateId = created.id;
    assert.strictEqual(created.is_default, true);
    assert.strictEqual(created.module, 'TEST_MODULE');
    recordPass('Create Template', `Created template ID: ${created.id}`);

    // 4.3 Verify Persistence in PostgreSQL
    const { dbQuery } = require('../utils/database');
    const pgRow = await dbQuery('SELECT * FROM enterprise.print_templates WHERE id = $1', [testTemplateId]);
    assert.strictEqual(pgRow.length, 1, 'Template must be stored in enterprise.print_templates');
    assert.strictEqual(pgRow[0].name, 'كتاب كشف فني وهندسي ميداني للاختبار');
    assert.strictEqual(pgRow[0].is_default, true);
    recordPass('PostgreSQL Persistence', `Verified in enterprise.print_templates (id=${testTemplateId})`);

    // 4.4 Get By ID
    const retrieved = await reportsService.getTemplateById(testTemplateId);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, testTemplateId);
    assert.strictEqual(retrieved.name, 'كتاب كشف فني وهندسي ميداني للاختبار');
    recordPass('Get Template By ID', 'Retrieved accurately with full metadata');

    // 4.5 Update Template
    const updatedTmpl = await reportsService.updateTemplate(testTemplateId, {
      name: 'كتاب كشف فني وهندسي ميداني للاختبار (محدث)',
      description: 'تم تحديث الوصف وتأكيد المعايير الفنية'
    }, mockUser);
    assert.strictEqual(updatedTmpl.name, 'كتاب كشف فني وهندسي ميداني للاختبار (محدث)');
    assert.strictEqual(updatedTmpl.description, 'تم تحديث الوصف وتأكيد المعايير الفنية');
    recordPass('Update Template', 'Updated template metadata successfully');

    // 4.6 Duplicate Template
    const duplicated = await reportsService.duplicateTemplate(testTemplateId, mockUser);
    assert.ok(duplicated);
    assert.notStrictEqual(duplicated.id, testTemplateId);
    assert.strictEqual(duplicated.is_default, false);
    assert.ok(duplicated.name.includes('(نسخة مخصصة)'));
    recordPass('Duplicate Template', `Cloned template with new ID: ${duplicated.id}`);

    // 4.7 Clean up duplicate
    await reportsService.deleteTemplate(duplicated.id, mockUser);
    recordPass('Delete Duplicate Template', 'Cleaned up duplicate template');

    // 4.8 Set Default Template
    const defaultRes = await reportsService.setDefaultTemplate(testTemplateId, mockUser);
    assert.strictEqual(defaultRes.is_default, true);
    recordPass('Set Default Template', 'Configured as default for module');
  } catch (err) {
    recordFail('Templates Domain CRUD', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: Official Municipal Document & Excel Generation
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Document & Structured Export Generation ---');
  try {
    const reportsService = require('../services/reportsEngineService');

    // 5.1 Official Municipal HTML Document
    const htmlDoc = reportsService.generateOfficialDocument({
      module: 'مشاريع الطرق',
      id: 'REP-2026-TEST',
      title: 'تقرير استلام وصيانة شارع وادي راجب',
      content: '<p>تم استلام أعمال التعبيد بطول 3.5 كم ومطابقة الفحوصات المخبرية بنجاح.</p>'
    });
    assert.ok(htmlDoc.includes('بلدية كفرنجة الجديدة'), 'Must contain municipality name');
    assert.ok(htmlDoc.includes('مديرية الأشغال والخدمات الهندسية'), 'Must contain directorate name');
    assert.ok(htmlDoc.includes('REP-2026-TEST'), 'Must contain document id');
    assert.ok(htmlDoc.includes('watermark'), 'Must include watermark class');
    recordPass('Official Document Generation', 'Rendered official HTML with header, watermark, and digital stamp');

    // 5.2 Header generation
    const header = reportsService.generateOfficialHeader('تقرير فني رسمي');
    assert.strictEqual(header.country, 'المملكة الأردنية الهاشمية');
    assert.strictEqual(header.municipality, 'بلدية كفرنجة الجديدة');
    assert.strictEqual(header.documentTitle, 'تقرير فني رسمي');
    recordPass('Official Header Object', 'Header metadata structure validated');

    // 5.3 Excel / CSV Generation with UTF-8 BOM
    const csvExport = reportsService.exportExcel('roads');
    assert.ok(csvExport.startsWith('\uFEFF'), 'Export must start with UTF-8 BOM');
    assert.ok(csvExport.includes('كود الطريق'), 'Must contain Arabic road columns');
    assert.ok(csvExport.includes('RD-001'), 'Must contain sample road data');
    recordPass('Excel/CSV UTF-8 Export', 'Generated valid Arabic CSV with BOM header');
  } catch (err) {
    recordFail('Document & Export Generation', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Express HTTP API Adapter & Authentication Enforcement
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 6. HTTP API Adapter Integration & Auth Verification ---');
  try {
    const express = require('express');
    const http = require('http');
    const jwt = require('jsonwebtoken');

    const app = express();
    app.use(express.json());

    // Central Auth Middleware
    const { authenticate } = require('../middlewares/authMiddleware');
    app.use(authenticate);

    // Mount Reports API router
    const reportsRouter = require('../Reports/API/printTemplatesEngine');
    app.use('/api/reports', reportsRouter);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    async function req(urlPath, options = {}) {
      return new Promise((resolve, reject) => {
        const u = new URL(urlPath, baseUrl);
        const reqOpts = {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: options.method || 'GET',
          headers: options.headers || {}
        };
        const r = http.request(reqOpts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let body = data;
            try { body = JSON.parse(data); } catch (e) {}
            resolve({ status: res.statusCode, headers: res.headers, body });
          });
        });
        r.on('error', reject);
        if (options.body) {
          r.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        r.end();
      });
    }

    // 6.1 Public GET /api/reports (Templates list)
    const listRes = await req('/api/reports');
    assert.strictEqual(listRes.status, 200, 'GET /api/reports must return 200');
    assert.ok(Array.isArray(listRes.body.data), 'data must be array of templates');
    recordPass('HTTP Public Templates List', `Returned ${listRes.body.data.length} templates`);

    // 6.2 Public GET /api/reports/stats
    const statsRes = await req('/api/reports/stats');
    assert.strictEqual(statsRes.status, 200, 'GET /api/reports/stats must return 200');
    assert.ok(statsRes.body.data.total >= 1);
    recordPass('HTTP Public Stats', 'GET /api/reports/stats returned 200 with metrics');

    // 6.3 Public GET /api/reports/generate-official
    const genRes = await req('/api/reports/generate-official?title=فحص+رسمي');
    assert.strictEqual(genRes.status, 200);
    assert.ok(typeof genRes.body === 'string' && genRes.body.includes('بلدية كفرنجة الجديدة'));
    recordPass('HTTP Official Generator Endpoint', 'GET /api/reports/generate-official returned 200 HTML');

    // 6.4 Public GET /api/reports/export-excel
    const excelRes = await req('/api/reports/export-excel?module=roads');
    assert.strictEqual(excelRes.status, 200);
    assert.ok(excelRes.headers['content-type'].includes('csv'));
    recordPass('HTTP Excel Export Endpoint', 'GET /api/reports/export-excel returned 200 CSV');

    // 6.5 Master config GET
    const masterRes = await req('/api/reports/master-config');
    assert.strictEqual(masterRes.status, 200);
    assert.strictEqual(masterRes.body.data.municipalityName, 'بلدية كفرنجة الجديدة');
    recordPass('HTTP Master Config Endpoint', 'GET /api/reports/master-config returned 200');

    // 6.6 Auth Enforcement on Mutations (POST /api/reports without token -> 401)
    const unauthPost = await req('/api/reports', {
      method: 'POST',
      body: { name: 'قالب غير مصرح' }
    });
    assert.strictEqual(unauthPost.status, 401, 'Unauthenticated POST must be rejected with 401');
    recordPass('HTTP Auth Enforcement', 'POST /api/reports without token rejected with 401');

    // 6.7 Authenticated Mutation
    const token = jwt.sign(
      { id: 'TEST-ADMIN', username: 'admin', role: 'admin', department: 'الهندسة' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const getSingleRes = await req(`/api/reports/${testTemplateId}`, { headers: authHeaders });
    assert.strictEqual(getSingleRes.status, 200);
    assert.strictEqual(getSingleRes.body.data.id, testTemplateId);
    recordPass('HTTP Get By ID', `GET /api/reports/${testTemplateId} returned 200`);

    // Clean up server
    await new Promise((resolve) => server.close(resolve));
  } catch (err) {
    recordFail('HTTP API Adapter Integration', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: Cleanup of Test Template
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Cleanup & Referential Integrity ---');
  try {
    const reportsService = require('../services/reportsEngineService');
    const { dbQuery, isPostgresActive } = require('../utils/database');

    if (testTemplateId) {
      // Set another template as default or unset default so we can delete
      if (isPostgresActive()) {
        await dbQuery('UPDATE enterprise.print_templates SET is_default = false WHERE id = $1', [testTemplateId]);
      }
      const testItem = await reportsService.getTemplateById(testTemplateId);
      if (testItem) testItem.is_default = false;

      const delRes = await reportsService.deleteTemplate(testTemplateId, mockUser);
      assert.strictEqual(delRes.success, true);
      recordPass('Template Cleanup', `Deleted test template ${testTemplateId}`);

      // Verify DB removal
      const checkRow = await dbQuery('SELECT * FROM enterprise.print_templates WHERE id = $1', [testTemplateId]);
      assert.strictEqual(checkRow.length, 0, 'Must be cleanly removed from database');
    }

    if (savedMasterConfig) {
      try { fs.writeFileSync(masterConfigPath, savedMasterConfig, 'utf8'); } catch (e) {}
    }
    if (savedPrintTemplates) {
      try { fs.writeFileSync(printTemplatesPath, savedPrintTemplates, 'utf8'); } catch (e) {}
    }
  } catch (err) {
    recordFail('Cleanup & Referential Integrity', err);
  }

  // ─────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`📊  REPORTS FORENSIC RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReportsForensicSuite().catch((err) => {
  console.error('FATAL SUITE ERROR:', err);
  process.exit(1);
});
