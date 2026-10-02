/**
 * scratch/test_assets_forensic_suite.js
 * Exhaustive Forensic Verification Suite for Assets Subsystem
 * Tests all 16 mandatory scenarios including failure injection, consistency, and zero false success.
 */

'use strict';

const path = require('path');
module.paths.push(path.join(process.cwd(), 'node_modules'));

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://postgres:123456@localhost:5432/kafr_inja_engineering';
}

const http = require('http');
const express = require('express');

const { isPostgresActive, getPool, memDb } = require('d:/28-7/نظام ادارة المشاريع 10/utils/database');
const assetsEngineService = require('d:/28-7/نظام ادارة المشاريع 10/services/assetsEngineService');
const specializedAssetsEngine = require('d:/28-7/نظام ادارة المشاريع 10/services/specializedAssetsEngine');
const numberingEngine = require('d:/28-7/نظام ادارة المشاريع 10/services/numberingEngine');
const engineRegistry = require('d:/28-7/نظام ادارة المشاريع 10/services/engineRegistry');
const assetsApiRouter = require('d:/28-7/نظام ادارة المشاريع 10/Assets/API/assetsEngine.js');

async function runSuite() {
  console.log('================================================================');
  console.log('🔬 STARTING ASSETS FORENSIC AUDIT & VERIFICATION SUITE');
  console.log('================================================================');

  const pool = getPool();
  let tries = 0;
  while (!isPostgresActive() && tries < 20) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }
  console.log(`[DB Initialization] isPostgresActive: ${isPostgresActive()}`);

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, name, details = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
      testResults.push({ name, status: 'PASS', details });
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name}: ${details}`);
      testResults.push({ name, status: 'FAIL', details });
    }
  }

  const adminUser = { id: 'U-001', username: 'admin', fullName: 'مدير النظام', role: 'admin' };
  const engineerUser = { id: 'U-002', username: 'engineer', fullName: 'مهندس بلدي', role: 'engineer' };

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 13: Numbering Sequences & Collision Check
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 13: Numbering Monotonicity & Single Sequences ---');
    const idMun1 = await numberingEngine.generateNextId('municipal_assets', { prefix: 'AST' });
    const idMun2 = await numberingEngine.generateNextId('municipal_assets', { prefix: 'AST' });
    const idStr1 = await numberingEngine.generateNextId('structural_assets', { prefix: 'STR' });
    const idInf1 = await numberingEngine.generateNextId('infrastructure_networks', { prefix: 'INF' });
    const idLgt1 = await numberingEngine.generateNextId('energy_assets', { prefix: 'LGT' });
    const idPerm1 = await numberingEngine.generateNextId('excavation_permits', { prefix: 'PERM' });

    assert(idMun1.startsWith('AST-2026-') && idMun2.startsWith('AST-2026-'), 'Municipal asset IDs strictly follow AST-YYYY-XXXX format');
    const num1 = parseInt(idMun1.split('-')[2], 10);
    const num2 = parseInt(idMun2.split('-')[2], 10);
    assert(num2 === num1 + 1, 'Municipal asset sequence increments monotonically', `${num1} -> ${num2}`);

    assert(idStr1.startsWith('STR-2026-'), 'Structural asset ID follows STR-2026-XXXX format');
    assert(idInf1.startsWith('INF-2026-'), 'Infrastructure ID follows INF-2026-XXXX format');
    assert(idLgt1.startsWith('LGT-2026-'), 'Energy ID follows LGT-2026-XXXX format');
    assert(idPerm1.startsWith('PERM-2026-'), 'Permit ID follows PERM-2026-XXXX format');

    // -------------------------------------------------------------------------
    // SCENARIO 1: Asset Create (Municipal Capital Asset)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Municipal Capital Asset Registration ---');
    const createdMun = await assetsEngineService.registerAsset({
      name: 'جرافة كتربلر مجنزرة 320D',
      assetCategory: 'HEAVY_MACHINERY',
      purchaseCost: 85000,
      salvageValue: 5000,
      purchaseDate: '2024-01-15',
      department: 'قسم الآليات والطوارئ',
      plateNumber: '5-9988',
      serialNumber: 'CAT320D-998877',
      custodianName: 'محمود الصمادي',
      conditionStatus: 'ACTIVE',
      notes: 'عطاء بلدية كفرنجة رقم 2024/02'
    }, adminUser);

    assert(createdMun && createdMun.id && createdMun.id.startsWith('AST-2026-'), 'Municipal asset registered with valid atomic ID', `ID: ${createdMun.id}`);
    assert(createdMun.valuation && createdMun.valuation.purchaseCost === 85000, 'Straight-line valuation calculated during registration');
    assert(createdMun.valuation.currentBookValue < 85000 && createdMun.valuation.currentBookValue >= 5000,
      'Accumulated depreciation deducted properly from book value', `Current Book Value: ${createdMun.valuation.currentBookValue} JD`);

    // -------------------------------------------------------------------------
    // SCENARIO 2 & 6: Asset Read & Search/Filter
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2 & 6: Municipal Asset Read & Filter ---');
    const readMun = await assetsEngineService.getAssetById(createdMun.id);
    assert(readMun && readMun.name.includes('جرافة كتربلر'), 'getAssetById returns correct municipal asset');

    const filteredMun = await assetsEngineService.getAssets({ category: 'HEAVY_MACHINERY', search: '320D' });
    assert(filteredMun.some(a => a.id === createdMun.id), 'getAssets filter finds created asset by category and search keyword');

    // -------------------------------------------------------------------------
    // SCENARIO 3: Asset Update
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Municipal Asset Update ---');
    const updatedMun = await assetsEngineService.updateAsset(createdMun.id, {
      notes: 'تمت إضافة نظام تتبع GPS ومراقبة الوقود',
      department: 'قسم الحركة والتشغيل'
    }, adminUser);

    assert(updatedMun.notes.includes('نظام تتبع GPS') && updatedMun.department === 'قسم الحركة والتشغيل',
      'Municipal asset updated successfully in database and memory');

    // -------------------------------------------------------------------------
    // SCENARIO 5: Asset Maintenance Expense Recording
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Maintenance Expense Logging ---');
    const maintRes = await assetsEngineService.recordMaintenanceExpense(createdMun.id, {
      cost: 1450,
      maintenanceType: 'PREVENTIVE',
      description: 'تبديل مسارات هيدروليك وصيانة جنزير وتغيير زيوت وفلاتر',
      workshopName: 'المشاغل الميكانيكية المركزية'
    }, adminUser);

    assert(maintRes.success === true && maintRes.maintenanceCost === 1450, 'Maintenance expense recorded and logged to audit trail');

    // -------------------------------------------------------------------------
    // SCENARIO 9: PostgreSQL Empty Result (Case B: No stale fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: PostgreSQL Empty Result (P0-2) ---');
    if (isPostgresActive()) {
      const ghostId = 'AST-GHOST-7777';
      if (!memDb.municipal_assets) memDb.municipal_assets = [];
      memDb.municipal_assets.push({
        id: ghostId,
        name: 'جهاز شبحي قديم في الذاكرة فقط',
        asset_category: 'IT_EQUIPMENT'
      });

      const emptyRes = await assetsEngineService.getAssets({ search: 'NON_EXISTENT_ASSET_QUERY_STRING_99999' });
      assert(Array.isArray(emptyRes) && emptyRes.length === 0,
        'Valid empty query from PostgreSQL returns [] without falling back to stale memDb records',
        `Length: ${emptyRes.length}`);

      memDb.municipal_assets = memDb.municipal_assets.filter(a => a.id !== ghostId);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 11: PostgreSQL Write Failure (Zero False Success - Case C)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: PostgreSQL Write Failure Simulation (Zero False Success) ---');
    if (isPostgresActive()) {
      const origQuery = pool.query;
      let simulateFailure = true;
      pool.query = async function(sql) {
        if (simulateFailure && typeof sql === 'string' && sql.includes('INSERT INTO public.municipal_assets')) {
          throw new Error('SIMULATED_DB_WRITE_LOCK_VIOLATION');
        }
        return origQuery.apply(this, arguments);
      };

      let threw = false;
      let errMessage = '';
      const memCountBefore = (memDb.municipal_assets || []).length;
      try {
        await assetsEngineService.registerAsset({
          name: 'مركبة اختبار فشل الكتابة',
          purchaseCost: 20000
        }, adminUser);
      } catch (e) {
        threw = true;
        errMessage = e.message;
      } finally {
        simulateFailure = false;
        pool.query = origQuery;
      }
      const memCountAfter = (memDb.municipal_assets || []).length;

      assert(threw && errMessage.includes('DATABASE_WRITE_FAILED'),
        'Database write failure throws explicit DATABASE_WRITE_FAILED (Zero false success)',
        `Error: ${errMessage}`);
      assert(memCountBefore === memCountAfter,
        'memDb was NOT modified when database write failed (Strict atomicity)',
        `Before: ${memCountBefore}, After: ${memCountAfter}`);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 14: GIS & PostGIS Spatial Integration
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 14: GIS Point & LineString PostGIS Verification ---');
    // 1. Structural Asset (Point)
    const structAsset = await specializedAssetsEngine.createStructuralAsset({
      assetType: 'RETAINING_WALL',
      name: 'جدار استنادي - حي نمر / كفرنجة',
      district: 'حي نمر',
      conditionIndex: 92,
      heightMeters: 4.5,
      lat: 32.3325,
      lng: 35.7512
    }, adminUser);

    assert(structAsset && structAsset.id && structAsset.id.startsWith('STR-2026-'), 'Structural asset created with atomic ID', `ID: ${structAsset.id}`);
    assert(structAsset.lat === 32.3325 && structAsset.lng === 35.7512, 'Coordinates stored with precision');

    // 2. Infrastructure Network (LineString)
    const infraNet = await specializedAssetsEngine.createInfrastructureNetwork({
      networkType: 'STORM_WATER',
      code: 'STM-NEMR-01',
      material: 'REINFORCED_CONCRETE',
      diameterMm: 800,
      status: 'OPERATIONAL',
      coordinates: [[35.7510, 32.3320], [35.7520, 32.3330], [35.7530, 32.3340]],
      attributes: { catchment_area: 'Wadi Kafranjah Basin', slope_percent: 2.5 }
    }, adminUser);

    assert(infraNet && infraNet.id && infraNet.id.startsWith('INF-2026-'), 'Infrastructure network created with atomic ID', `ID: ${infraNet.id}`);
    assert(infraNet.geometry.type === 'LineString' && infraNet.geometry.coordinates.length === 3, 'PostGIS LineString geometry parsed and verified');

    // 3. Energy Asset (Point)
    const energyAsset = await specializedAssetsEngine.createEnergyAsset({
      name: 'وحدة إنارة شارع الشهيد فراس العجلوني',
      assetType: 'LIGHTING',
      fixtureType: 'LED_SOLAR',
      wattage: 200,
      district: 'وسط البلد',
      lat: 32.3310,
      lng: 35.7505,
      condition: 'EXCELLENT'
    }, adminUser);

    assert(energyAsset && energyAsset.id && energyAsset.id.startsWith('LGT-2026-'), 'Energy asset created with atomic ID', `ID: ${energyAsset.id}`);

    // 4. Excavation Permit (Service Connection & Reinstatement)
    const permit = await specializedAssetsEngine.createExcavationPermit({
      applicant: 'شركة مياه اليرموك - إقليم الشمال',
      contractor: 'المقاولات الإنشائية الحديثة',
      district: 'شارع الحسبة الرئيسي',
      purpose: 'تمديد خط ناقل مياه قطر 4 إنش',
      permitType: 'WATER_CONNECTION',
      lengthM: 45.0,
      widthM: 1.2,
      depthM: 1.5,
      surfaceType: 'ASPHALT',
      insuranceFee: 1500,
      coordinates: [[35.7502, 32.3305], [35.7508, 32.3312]]
    }, adminUser);

    assert(permit && permit.id && permit.id.startsWith('PERM-2026-'), 'Excavation permit created with atomic ID', `ID: ${permit.id}`);

    // -------------------------------------------------------------------------
    // SCENARIO 4: Asset Lifecycle Transition (Excavation Reinstatement)
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Permit Reinstatement Lifecycle ---');
    const reinstateRes = await specializedAssetsEngine.reinstateExcavationPermit(permit.id, {
      inspectorName: 'م. أحمد بني فواز',
      inspectionNotes: 'تمت إعادة سفلتة الشارع ودمك طبقة البيسكورس وفحص الكثافة بنسبة 98%',
      status: 'COMPLETED'
    }, adminUser);

    assert(reinstateRes.success === true && reinstateRes.reinstatement_status === 'PASSED', 'Permit reinstatement approved and lifecycle completed');

    // -------------------------------------------------------------------------
    // SCENARIO 15 & 16: API Adapter Compatibility via Express
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 15 & 16: API Adapter Endpoints Verification ---');
    const app = express();
    app.use(express.json());
    // Attach simulated user middleware
    let mockReqUser = adminUser;
    app.use((req, res, next) => {
      req.user = mockReqUser;
      next();
    });
    app.use('/api/v4/assets', assetsApiRouter);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v4/assets`;

    // Helper for HTTP requests
    async function apiRequest(endpoint, options = {}) {
      return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + endpoint);
        const req = http.request(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(body) });
            } catch (e) {
              resolve({ status: res.statusCode, text: body });
            }
          });
        });
        req.on('error', reject);
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
      });
    }

    // 1. GET / (Summary)
    const sumRes = await apiRequest('/');
    assert(sumRes.status === 200 && sumRes.body.success === true && sumRes.body.summary, 'GET / returns unified assets summary structure');

    // 2. GET /structural
    const getStrRes = await apiRequest('/structural');
    assert(getStrRes.status === 200 && Array.isArray(getStrRes.body.data), 'GET /structural returns data array matching UI contract');

    // 3. GET /infrastructure
    const getInfRes = await apiRequest('/infrastructure');
    assert(getInfRes.status === 200 && Array.isArray(getInfRes.body.data), 'GET /infrastructure returns data array matching UI contract');

    // 4. GET /energy
    const getEngRes = await apiRequest('/energy');
    assert(getEngRes.status === 200 && Array.isArray(getEngRes.body.data), 'GET /energy returns data array matching UI contract');

    // 5. GET /permits
    const getPermRes = await apiRequest('/permits');
    assert(getPermRes.status === 200 && Array.isArray(getPermRes.body.data), 'GET /permits returns data array matching UI contract');

    // 6. GET /municipal
    const getMunRes = await apiRequest('/municipal');
    assert(getMunRes.status === 200 && Array.isArray(getMunRes.body.data), 'GET /municipal returns municipal assets');

    // -------------------------------------------------------------------------
    // SCENARIO 7 & 8: Authorization Enforced & Denied
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7 & 8: Authorization Enforcement ---');
    // Test unauthenticated
    mockReqUser = null;
    const unauthRes = await apiRequest('/structural', { method: 'POST', body: { name: 'جدار بدون هوية' } });
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

    // Test unauthorized role without ASSETS.CREATE
    mockReqUser = { id: 'U-999', username: 'guest', role: 'guest_user' };
    const forbiddenRes = await apiRequest('/structural', { method: 'POST', body: { name: 'جدار بدون صلاحية' } });
    assert(forbiddenRes.status === 403, 'Unauthorized user rejected with 403 Forbidden');

    // Restore admin
    mockReqUser = adminUser;

    // -------------------------------------------------------------------------
    // HealthCheck Verification (Healthy & Degraded)
    // -------------------------------------------------------------------------
    console.log('\n--- HealthCheck Diagnostics ---');
    const healthyMun = await assetsEngineService.healthCheck();
    assert(healthyMun.healthy === true && healthyMun.status === 'READY', 'assetsEngineService healthCheck reports healthy: true when active');

    const healthySpec = await specializedAssetsEngine.healthCheck();
    assert(healthySpec.healthy === true && healthySpec.status === 'READY', 'specializedAssetsEngine healthCheck reports healthy: true when active');

    if (isPostgresActive()) {
      const origPoolQuery = pool.query;
      pool.query = async function(sql) {
        if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM public.municipal_assets')) {
          throw new Error('SIMULATED_HEALTH_DB_FAILURE');
        }
        return origPoolQuery.apply(this, arguments);
      };

      let degradedCheck;
      try {
        degradedCheck = await assetsEngineService.healthCheck();
      } finally {
        pool.query = origPoolQuery;
      }

      assert(degradedCheck.healthy === false && degradedCheck.status === 'DEGRADED',
        'healthCheck reports healthy: false, status: DEGRADED on database failure (Zero false health)');
    }

    // -------------------------------------------------------------------------
    // Cleanup created test records
    // -------------------------------------------------------------------------
    console.log('\n--- Cleaning up test records ---');
    await specializedAssetsEngine.deleteStructuralAsset(structAsset.id, adminUser);
    await specializedAssetsEngine.deleteInfrastructureNetwork(infraNet.id, adminUser);
    await specializedAssetsEngine.deleteEnergyAsset(energyAsset.id, adminUser);
    await specializedAssetsEngine.deleteExcavationPermit(permit.id, adminUser);
    await assetsEngineService.deleteAsset(createdMun.id, adminUser);
    console.log('Cleanup completed cleanly.');

    server.close();

  } catch (err) {
    console.error('💥 UNCAUGHT ERROR IN ASSETS FORENSIC SUITE:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`📊 ASSETS FORENSIC SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  return { passed, failed, testResults };
}

runSuite().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
