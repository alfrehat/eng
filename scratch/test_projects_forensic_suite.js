/**
 * scratch/test_projects_forensic_suite.js
 * 🏛️ حزمة الاختبارات الجنائية والتحقق المعماري الشامل لنطاق المشاريع والمحافظ الهندسية (Projects)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

const { dbQuery, dbGet, dbRun, isPostgresActive } = require('../utils/database');
const engineRegistry = require('../services/engineRegistry');
const projectsEngineService = require('../services/projectsEngineService');
const projectPortfolioEngineService = require('../services/projectPortfolioEngineService');
const projectPrioritizationEngineService = require('../services/projectPrioritizationEngineService');
const projectFinancialProgrammingEngineService = require('../services/projectFinancialProgrammingEngineService');
const projectDependencyEngineService = require('../services/projectDependencyEngineService');
const projectSchedulingEngineService = require('../services/projectSchedulingEngineService');
const numberingEngine = require('../services/numberingEngine');

const projectsApiRouter = require('../Projects/API/projectsEngine');
const { portfoliosRouter, plansRouter } = require('../Projects/API/portfolioEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

function generateTestToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

function makeRequest(app, method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (payload && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (payload) {
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: reqHeaders
      }, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          server.close(() => {
            let parsedBody = rawData;
            try {
              parsedBody = JSON.parse(rawData);
            } catch (e) {}
            resolve({
              status: res.statusCode,
              statusCode: res.statusCode,
              headers: res.headers,
              body: parsedBody
            });
          });
        });
      });

      req.on('error', (err) => {
        server.close(() => reject(err));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

const adminUser = {
  id: 'U-001',
  username: 'admin',
  role: 'admin',
  fullName: 'مدير النظام التنفيذي',
  permissions: ['*']
};

const directorUser = {
  id: 'U-002',
  username: 'director_eng',
  role: 'director_public_works',
  fullName: 'مدير الأشغال والخدمات الهندسية',
  permissions: ['PROJECTS.VIEW', 'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.APPROVE', 'PROJECTS.DELETE', 'PROJECTS.MANAGE', 'PORTFOLIO.VIEW', 'PORTFOLIO.CREATE', 'PORTFOLIO.EDIT', 'PLAN.VIEW', 'PLAN.CREATE']
};

const projectEngineer = {
  id: 'U-006',
  username: 'proj_eng',
  role: 'project_engineer',
  fullName: 'مهندس إدارة المشاريع',
  permissions: ['PROJECTS.VIEW', 'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PORTFOLIO.VIEW', 'PLAN.VIEW']
};

const viewerUser = {
  id: 'U-999',
  username: 'readonly_user',
  role: 'viewer',
  fullName: 'مراقب عام بدون صلاحيات تعديل',
  permissions: ['DASHBOARD.VIEW']
};

let testProjectId = null;
let testProjectNumber = null;
let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    })
    .catch(err => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      throw err;
    });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️ PROJECTS & CAPITAL PORTFOLIO — FORENSIC & ARCHITECTURAL VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  console.log(`[DB Mode]: ${isPostgresActive() ? 'PostgreSQL Active (Canonical)' : 'In-Memory Fallback'}`);

  // Test 1: Registry Discovery & Health Checks for all 6 Projects Engines
  await runTest('1. EngineRegistry Discovery & Health Check for all 6 Projects Engines', async () => {
    engineRegistry._ensureInitialized();
    const expectedEngines = [
      'PROJECTS_ENGINE',
      'PROJECT_PORTFOLIO_ENGINE',
      'PROJECT_PRIORITIZATION_ENGINE',
      'PROJECT_FINANCIAL_PROGRAMMING_ENGINE',
      'PROJECT_DEPENDENCY_ENGINE',
      'PROJECT_SCHEDULING_ENGINE'
    ];

    for (const eid of expectedEngines) {
      const entry = engineRegistry.get(eid);
      assert(entry, `Engine ${eid} must be registered in engineRegistry`);
      assert.strictEqual(entry.status, 'READY', `Status of ${eid} should be READY`);
      assert(entry.healthCheck, `Engine ${eid} must expose a healthCheck function`);
      const h = await entry.healthCheck();
      assert(h && (h.healthy === true || h.status === 'READY'), `Health check for ${eid} must succeed`);
    }
  });

  // Test 2: Numbering Engine Integration for Projects & Sub-Entities
  await runTest('2. Numbering Engine Integration for Projects, Portfolios, Plans & Sub-Entities', async () => {
    const prjId = await numberingEngine.generateNextId('projects');
    assert(prjId && prjId.startsWith('PRJ-'), `Expected project ID starting with PRJ-, got ${prjId}`);

    const porId = await numberingEngine.generateNextId('portfolios');
    assert(porId && porId.startsWith('POR-'), `Expected portfolio ID starting with POR-, got ${porId}`);

    const plnId = await numberingEngine.generateNextId('plans');
    assert(plnId && plnId.startsWith('PLN-'), `Expected plan ID starting with PLN-, got ${plnId}`);

    const mlsId = await numberingEngine.generateNextId('milestones');
    assert(mlsId && mlsId.startsWith('MLS-'), `Expected milestone ID starting with MLS-, got ${mlsId}`);

    const rskId = await numberingEngine.generateNextId('risks');
    assert(rskId && rskId.startsWith('RSK-'), `Expected risk ID starting with RSK-, got ${rskId}`);

    const prgId = await numberingEngine.generateNextId('progress_logs');
    assert(prgId && prgId.startsWith('PRG-'), `Expected progress ID starting with PRG-, got ${prgId}`);
  });

  // Test 3: Project Creation with PostGIS SRID 4326 Geometry
  await runTest('3. Canonical Project Creation & PostGIS SRID 4326 Point Storage', async () => {
    const projectData = {
      projectName: 'مشروع إنشاء وتعبيد شوارع حي نمر - المرحلة الأولى',
      projectType: 'إنشاء وتعبيد طرق',
      description: 'تنفيذ أعمال تسوية وخلطة إسفلتية ساخنة وأرصفة ومصارف مياه أمطار',
      approvedBudget: 120000.00,
      budgetAmount: 120000.00,
      contractedAmount: 115000.00,
      fundingSource: 'موازنة البلدية الذاتية',
      latitude: 32.298500,
      longitude: 35.792400,
      location: 'كفرنجة - حي نمر',
      locationDescription: 'منطقة الميدان وحتى تقاطع مدرسة البنين'
    };

    const created = await projectsEngineService.createProject(projectData, projectEngineer);
    assert(created && created.id, 'Project must be created with ID');
    assert(created.project_number && created.project_number.startsWith('PRJ-'), 'Project number starts with PRJ-');
    assert.strictEqual(created.status, 'DRAFT', 'Initial status must be DRAFT');
    assert.strictEqual(created.approved_budget, 120000.00, 'Approved budget preserved');

    testProjectId = created.id;
    testProjectNumber = created.project_number;

    if (isPostgresActive()) {
      const spatialRow = await dbGet(`
        SELECT id, ST_AsText(geom) as geom_wkt, ST_SRID(geom) as srid, ST_AsGeoJSON(geom) as geojson
        FROM public.projects
        WHERE id = $1
      `, [testProjectId]);

      assert(spatialRow, 'Spatial row must exist in PostgreSQL');
      assert.strictEqual(spatialRow.srid, 4326, 'Geometry SRID must be 4326 (WGS 84)');
      assert(spatialRow.geom_wkt && spatialRow.geom_wkt.includes('POINT'), 'Geometry must be a POINT');
      assert(spatialRow.geojson && spatialRow.geojson.includes('Point'), 'GeoJSON must be valid');
    }
  });

  // Test 4: Milestones, Risks, and Progress Logs Management
  await runTest('4. Project Sub-Entities: Milestones, Progress Recalculation, Risks, and Logs', async () => {
    // 4.1 Add Milestone 1 (Weight 40%, Complete 100%)
    const m1 = await projectsEngineService.addMilestone(testProjectId, {
      name: 'تسوية الموقع والفرشيات وصب الأرصفة',
      weight: 40.0,
      completionPercentage: 100.0
    }, projectEngineer);
    assert(m1 && m1.id && m1.id.startsWith('MLS-'), 'Milestone 1 created with MLS- prefix');

    // 4.2 Add Milestone 2 (Weight 60%, Complete 50%)
    const m2 = await projectsEngineService.addMilestone(testProjectId, {
      name: 'فرش الخلطة الإسفلتية والدهانات المرورية',
      weight: 60.0,
      completionPercentage: 50.0
    }, projectEngineer);
    assert(m2 && m2.id && m2.id.startsWith('MLS-'), 'Milestone 2 created with MLS- prefix');

    // Expected weighted progress: (40*1.0) + (60*0.5) = 40 + 30 = 70%
    const proj = await projectsEngineService.getProjectById(testProjectId);
    assert.strictEqual(Math.round(proj.physical_progress), 70, 'Physical progress should be 70%');
    assert.strictEqual(proj.milestones.length, 2, 'Two milestones retrieved');

    // 4.3 Add Risk
    const risk = await projectsEngineService.addRisk(testProjectId, {
      riskType: 'WEATHER',
      description: 'أمطار غزيرة مفاجئة قد تؤخر أعمال الخلطة الإسفلتية',
      probability: 'MEDIUM',
      impact: 'HIGH',
      severity: 'HIGH'
    }, projectEngineer);
    assert(risk && risk.id && risk.id.startsWith('RSK-'), 'Risk created with RSK- prefix');

    // 4.4 Add Progress Log
    const log = await projectsEngineService.addProgressLog(testProjectId, {
      reportingPeriod: 'التقرير الأسبوعي الأول',
      physicalProgress: 70.0,
      financialProgress: 60.0,
      notes: 'تم إنجاز الفرشيات بالكامل والبدء بتوريد الخلطة'
    }, projectEngineer);
    assert(log && log.id && log.id.startsWith('PRG-'), 'Progress log created with PRG- prefix');
  });

  // Test 5: Financial Summary & Analytics Calculation
  await runTest('5. Financial Summary, Budget Commitment & Variance Analytics', async () => {
    const proj = await projectsEngineService.getProjectById(testProjectId);
    const summary = proj.financialSummary;
    assert(summary, 'Financial summary must be present');
    assert.strictEqual(summary.approvedBudget, 120000);
    assert.strictEqual(summary.contractedAmount, 115000);
    assert.strictEqual(summary.physicalProgress, 70);
    assert.strictEqual(summary.isUnderBudget, true);
  });

  // Test 6: Workflow Lifecycle Transitions & Separation of Duties (SoD) Guard
  await runTest('6. Workflow Lifecycle Transitions & SoD Enforcement', async () => {
    // 6.1 Engineer submits project for review
    const submitRes = await projectsEngineService.transitionStatus(testProjectId, 'SUBMITTED', projectEngineer, 'تم استكمال كافة المخططات والدراسات الفنية');
    assert.strictEqual(submitRes.currentStatus, 'SUBMITTED', 'Transition to SUBMITTED succeeds');

    // 6.2 Negative SoD Test: Creator engineer cannot approve their own project
    let sodBlocked = false;
    try {
      await projectsEngineService.transitionStatus(testProjectId, 'APPROVED', projectEngineer, 'محاولة اعتماد ذاتي');
    } catch (e) {
      sodBlocked = e.message.includes('فصل المهام');
    }
    assert(sodBlocked, 'SoD MUST block creator engineer from self-approving project');

    // 6.3 Director of Public Works officially approves
    const approveRes = await projectsEngineService.transitionStatus(testProjectId, 'APPROVED', directorUser, 'تم تدقيق الجدوى والموافقة على المشروع');
    assert.strictEqual(approveRes.currentStatus, 'APPROVED', 'Transition to APPROVED succeeds');

    // 6.4 Transition to IN_PROGRESS
    const startRes = await projectsEngineService.transitionStatus(testProjectId, 'IN_PROGRESS', directorUser, 'بدء الأعمال الميدانية');
    assert.strictEqual(startRes.currentStatus, 'IN_PROGRESS');

    // 6.5 Illegal Transition check: cannot go directly from IN_PROGRESS to DRAFT
    let illegalBlocked = false;
    try {
      await projectsEngineService.transitionStatus(testProjectId, 'DRAFT', directorUser);
    } catch (e) {
      illegalBlocked = e.message.includes('انتقال غير مسموح');
    }
    assert(illegalBlocked, 'Illegal state transitions must be blocked');
  });

  // Test 7: Portfolio & Planning Domain Service Integration
  let testPortfolioId = null;
  let testPlanId = null;
  await runTest('7. Portfolio, Planning & Multi-Year Financial Programming Integration', async () => {
    // 7.1 Create Portfolio
    const port = await projectPortfolioEngineService.createPortfolio({
      name: 'محفظة مشاريع البنية التحتية وإعادة التأهيل 2026',
      description: 'مشاريع تطوير الطرق وشبكات تصريف الأمطار في كفرنجة'
    }, directorUser);
    assert(port && port.id && port.portfolio_number.startsWith('POR-'), 'Portfolio created with POR- prefix');
    testPortfolioId = port.id;

    // 7.2 Link project to portfolio
    const linkPort = await projectPortfolioEngineService.addProjectToPortfolio(testPortfolioId, testProjectId, directorUser);
    assert(linkPort.success, 'Project linked to portfolio successfully');

    // 7.3 Create Plan
    const plan = await projectPortfolioEngineService.createPlan({
      planName: 'الخطة التنموية السنوية 2026',
      planType: 'ANNUAL',
      year: 2026
    }, directorUser);
    assert(plan && plan.id && plan.plan_number.startsWith('PLN-'), 'Plan created with PLN- prefix');
    testPlanId = plan.id;

    // 7.4 Link project to plan
    const linkPlan = await projectPortfolioEngineService.addProjectToPlan(testPlanId, testProjectId, directorUser);
    assert(linkPlan.success, 'Project linked to plan successfully');

    // 7.5 Financial Programming for the project within the plan
    const finProg = await projectFinancialProgrammingEngineService.createFinancialProgram({
      planId: testPlanId,
      projectId: testProjectId,
      fiscalYear: 2026,
      programmedAmount: 120000.00,
      fundingSource: 'MUNICIPAL_BUDGET'
    }, directorUser);
    assert(finProg && finProg.id, 'Financial program created successfully');
    assert.strictEqual(finProg.programmed_amount, 120000.00);
  });

  // Test 8: Prioritization Matrix & Project Scoring
  await runTest('8. Prioritization Matrix, Multi-Criteria Scoring & Ranking', async () => {
    // 8.1 List criteria (5 seeded criteria)
    const criteria = await projectPrioritizationEngineService.getPriorityCriteria();
    assert(criteria && criteria.length >= 5, 'At least 5 criteria must exist');

    // 8.2 Score project on Criterion 1 (SAFETY)
    const safetyCrit = criteria.find(c => c.code === 'SAFETY');
    assert(safetyCrit, 'SAFETY criterion found');

    const scoreRes = await projectPrioritizationEngineService.setProjectCriterionScore(
      testProjectId,
      safetyCrit.id,
      9.0, // Score 9 out of 10
      'طريق حيوي يشهد حركة سير مرتفعة ويخدم مدرسة',
      directorUser
    );
    assert(scoreRes && scoreRes.score && scoreRes.score.score === 9, 'Score 9 recorded');

    // 8.3 Calculate overall project priority
    const prioResult = await projectPrioritizationEngineService.calculateProjectPriority(testProjectId, directorUser);
    assert(prioResult && prioResult.totalScore > 0, 'Project total score calculated');
  });

  // Test 9: Network Dependencies & CPM Scheduling
  await runTest('9. Project Network Dependencies & CPM Timeline Scheduling', async () => {
    // Create second temporary project for dependency test
    const prj2 = await projectsEngineService.createProject({
      projectName: 'مشروع أعمال الإنارة الذكية لحي نمر',
      projectType: 'إنارة وطاقة',
      approvedBudget: 25000.00
    }, projectEngineer);

    // Create Precedence relationship (prj1 Finish to prj2 Start: FS)
    const dep = await projectDependencyEngineService.createDependency({
      predecessorProjectId: testProjectId,
      successorProjectId: prj2.id,
      dependencyType: 'FS',
      lagDays: 2,
      description: 'أعمال الإنارة تبدأ بعد الانتهاء من خلطة التعبيد بيومين'
    }, directorUser);
    assert(dep && dep.id, 'Dependency relation created');

    // Negative test: Cycle detection (cannot make prj2 predecessor of prj1)
    let cycleBlocked = false;
    try {
      await projectDependencyEngineService.createDependency({
        predecessorProjectId: prj2.id,
        successorProjectId: testProjectId,
        dependencyType: 'FS'
      }, directorUser);
    } catch (e) {
      console.log('DEBUG TEST 9 ERROR:', e.message);
      cycleBlocked = e.message.includes('حلقة دائرية') || e.message.includes('تعارض') || e.message.includes('اعتمادية دائرية');
    }
    assert(cycleBlocked, 'Cycle detection MUST block circular dependency');

    // Clean up temporary project 2
    await projectsEngineService.deleteProject(prj2.id, adminUser);
  });

  // Test 10: Accounting & Contractual Deletion Protection (Guard)
  await runTest('10. Accounting & Contractual Deletion Protection Guard', async () => {
    // Simulate active expenses on project
    if (isPostgresActive()) {
      await dbRun('UPDATE public.projects SET actual_cost = 5000.00 WHERE id = $1', [testProjectId]);
    }

    let deleteBlocked = false;
    try {
      await projectsEngineService.deleteProject(testProjectId, adminUser);
    } catch (e) {
      deleteBlocked = e.message.includes('حظر محاسبي وقانوني');
    }
    assert(deleteBlocked, 'Accounting guard MUST block deletion of project with actual_cost > 0');

    // Reset actual_cost to 0 for clean testing
    if (isPostgresActive()) {
      await dbRun('UPDATE public.projects SET actual_cost = 0.00 WHERE id = $1', [testProjectId]);
    }
  });

  // Test 11: Canonical Audit Trail in public.activity_log
  await runTest('11. Canonical Audit Trail in public.activity_log', async () => {
    if (isPostgresActive()) {
      const logs = await dbQuery(`
        SELECT action, entity, "entityId"
        FROM public.activity_log
        WHERE "entityId" = $1
        ORDER BY "createdAt" ASC
      `, [testProjectId]);

      assert(logs && logs.length > 0, 'Audit entries must be recorded');
      const actions = logs.map(l => l.action);
      console.log(`     Recorded Project Audit Actions: [${actions.join(', ')}]`);
      assert(actions.includes('PROJECT_CREATED'), 'Must record PROJECT_CREATED');
      assert(actions.includes('MILESTONE_ADDED'), 'Must record MILESTONE_ADDED');
      assert(actions.includes('RISK_REGISTERED'), 'Must record RISK_REGISTERED');
      assert(actions.includes('PROGRESS_LOGGED'), 'Must record PROGRESS_LOGGED');
    }
  });

  // Test 12: HTTP API Adapter & RBAC Security Enforcement (401 / 403 / 200)
  await runTest('12. HTTP API Adapters & RBAC Security Enforcement (401 / 403 / 200)', async () => {
    const { authenticate } = require('../middlewares/authMiddleware');
    const app = express();
    app.use(express.json());
    app.use(authenticate);
    app.use('/api/projects', projectsApiRouter);
    app.use('/api/portfolios', portfoliosRouter);
    app.use('/api/plans', plansRouter);

    // 12.1 Unauthenticated requests (401)
    const unauthGet = await makeRequest(app, 'GET', '/api/projects');
    assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET /api/projects must return 401');

    const unauthPost = await makeRequest(app, 'POST', '/api/projects', {}, { projectName: 'Test' });
    assert.strictEqual(unauthPost.status, 401, 'Unauthenticated POST /api/projects must return 401');

    // 12.2 Unauthorized access without PROJECTS.CREATE (403)
    const viewerToken = generateTestToken(viewerUser);
    const forbiddenPost = await makeRequest(app, 'POST', '/api/projects', {
      Authorization: `Bearer ${viewerToken}`
    }, { projectName: 'Test' });
    assert.strictEqual(forbiddenPost.status, 403, 'Unauthorized POST without PROJECTS.CREATE must return 403');

    // 12.3 Authorized Access with Engineer Token (200)
    const engToken = generateTestToken(projectEngineer);
    const authGet = await makeRequest(app, 'GET', '/api/projects', {
      Authorization: `Bearer ${engToken}`
    });
    assert.strictEqual(authGet.status, 200, 'Authorized GET must return 200');
    assert(authGet.body.success, 'Response must have success: true');
    assert(authGet.body.data && authGet.body.data.length > 0, 'Projects data returned');

    // 12.4 Stats Endpoint
    const statsRes = await makeRequest(app, 'GET', '/api/projects/stats', {
      Authorization: `Bearer ${engToken}`
    });
    assert.strictEqual(statsRes.status, 200, 'Stats endpoint must return 200');
    assert(statsRes.body.data && statsRes.body.data.totalProjects !== undefined, 'Stats data present');

    // 12.5 Health Probes
    const prjHealth = await makeRequest(app, 'GET', '/api/projects/health');
    assert.strictEqual(prjHealth.status, 200, 'Projects health endpoint must return 200');
    assert.strictEqual(prjHealth.body.engineId, 'PROJECTS_ENGINE');

    const portHealth = await makeRequest(app, 'GET', '/api/portfolios/health');
    assert.strictEqual(portHealth.status, 200, 'Portfolios health endpoint must return 200');

    const planHealth = await makeRequest(app, 'GET', '/api/plans/health');
    assert.strictEqual(planHealth.status, 200, 'Plans health endpoint must return 200');
  });

  // Test 13: Zero Direct DB Bypass & Zero Runtime DDL AST Inspection
  await runTest('13. Zero Direct DB Bypass & Zero Runtime DDL Verification in Projects/', async () => {
    const projectApiFiles = fs.readdirSync(path.join(__dirname, '../Projects/API')).filter(f => f.endsWith('.js'));
    for (const f of projectApiFiles) {
      const code = fs.readFileSync(path.join(__dirname, '../Projects/API', f), 'utf8');
      assert(!code.includes('dbQuery('), `API router ${f} MUST NOT contain direct dbQuery()`);
      assert(!code.includes('dbGet('), `API router ${f} MUST NOT contain direct dbGet()`);
      assert(!code.includes('dbRun('), `API router ${f} MUST NOT contain direct dbRun()`);
      assert(!code.includes('pool.query('), `API router ${f} MUST NOT contain pool.query()`);
      assert(!code.includes("require('pg')"), `API router ${f} MUST NOT contain require("pg")`);
      assert(!code.includes('CREATE TABLE'), `No CREATE TABLE in ${f}`);
      assert(!code.includes('ALTER TABLE'), `No ALTER TABLE in ${f}`);
      assert(!code.includes('DROP TABLE'), `No DROP TABLE in ${f}`);
    }

    const services = [
      'projectsEngineService.js',
      'projectPortfolioEngineService.js',
      'projectPrioritizationEngineService.js',
      'projectFinancialProgrammingEngineService.js',
      'projectDependencyEngineService.js',
      'projectSchedulingEngineService.js'
    ];

    for (const s of services) {
      const code = fs.readFileSync(path.join(__dirname, '../services', s), 'utf8');
      assert(!code.includes('CREATE TABLE'), `No CREATE TABLE in service ${s}`);
      assert(!code.includes('ALTER TABLE'), `No ALTER TABLE in service ${s}`);
      assert(!code.includes('DROP TABLE'), `No DROP TABLE in service ${s}`);
    }
  });

  // Clean up test project cleanly via cascade delete
  await projectsEngineService.deleteProject(testProjectId, adminUser);
  const checkDeleted = await projectsEngineService.getProjectById(testProjectId);
  assert(checkDeleted === null, 'Test project must be cleanly deleted');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`🎯 ALL ${totalTests} PROJECTS FORENSIC TESTS PASSED (100%)`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n💥 TEST SUITE FAILED:', err);
  process.exit(1);
});
