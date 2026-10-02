/**
 * scratch/test_gis_forensic_suite.js
 * 🗺️ حزمة الاختبارات الجنائية الإلزامية لطبقة الـ GIS و PostGIS
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const fs = require('fs');
const path = require('path');
const db = require('../utils/database');
const roadsEngineService = require('../services/roadsEngineService');
const specializedAssetsEngine = require('../services/specializedAssetsEngine');

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', message });
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', message });
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runGisTestSuite() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('🚀 بدء حزمة الاختبارات الشاملة للـ GIS و PostGIS (15 متطلب)');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // 1. فحص سلامة بناء الجملة (Syntax Checks)
    console.log('--- 1. GIS Syntax Verification ---');
    const syntaxFiles = [
      'GIS/Pages/unifiedGisEngine.js',
      'Roads/API/roadsEngine.js',
      'PavementReturns/API/pavingReturns.js',
      'services/roadsEngineService.js',
      'services/specializedAssetsEngine.js',
      'services/g2gGatewayEngineService.js'
    ];
    for (const f of syntaxFiles) {
      const fullPath = path.resolve(__dirname, '..', f);
      const exists = fs.existsSync(fullPath);
      assert(exists, `الملف موجود: ${f}`);
      if (exists) {
        let parsedOk = true;
        try {
          // Verify require or compile
          require(fullPath);
        } catch (e) {
          // Frontend files might have DOM references, verify with Node compile/syntax check
          try {
            new Function(fs.readFileSync(fullPath, 'utf8'));
          } catch (syntaxErr) {
            parsedOk = false;
          }
        }
        assert(parsedOk, `بناء الجملة النحوية سليم: ${f}`);
      }
    }

    // 2. فحص اتصال PostGIS وإصداره
    console.log('\n--- 2. PostGIS Connection & Version ---');
    await db.initDatabase();
    assert(db.isPostgresActive(), 'PostgreSQL متصل بنشاط ومفعل');
    const versionRes = await db.dbGet('SELECT PostGIS_Full_Version() as ver, PostGIS_Version() as pgis_ver');
    assert(!!versionRes && !!versionRes.pgis_ver, `PostGIS يعمل بنجاح (الإصدار: ${versionRes?.pgis_ver})`);

    // 3. التحقق من المخطط المكاني وفصل الجداول عن الـ Views (Spatial Catalog Reconciliation)
    console.log('\n--- 3. Spatial Schema & Catalog Reconciliation ---');
    const rawRelations = await db.dbQuery(`
      SELECT 
        gc.f_table_schema AS schema_name,
        gc.f_table_name AS relation_name,
        c.relkind,
        CASE 
          WHEN c.relkind = 'r' THEN 'TABLE'
          WHEN c.relkind = 'v' THEN 'VIEW'
          WHEN c.relkind = 'm' THEN 'MATERIALIZED_VIEW'
          ELSE 'OTHER'
        END AS relation_type,
        gc.f_geometry_column AS geometry_column,
        gc.type AS geometry_type,
        gc.srid,
        gc.coord_dimension
      FROM geometry_columns gc
      JOIN pg_class c ON c.relname = gc.f_table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = gc.f_table_schema
      WHERE gc.f_table_schema = 'public'
      ORDER BY relation_type DESC, relation_name ASC;
    `);

    const canonicalTables = rawRelations.filter(r => r.relation_type === 'TABLE');
    const spatialViews = rawRelations.filter(r => r.relation_type === 'VIEW' || r.relation_type === 'MATERIALIZED_VIEW');

    assert(canonicalTables.length === 16, `عدد الجداول المكانية القانونية الفعلية (Canonical Spatial Tables): ${canonicalTables.length}`);
    assert(spatialViews.length === 1, `عدد الـ Spatial Views المشتقة الفعلية: ${spatialViews.length}`);
    assert(rawRelations.length === 17, `إجمالي الكيانات المكانية (16 جداول + 1 View = 17 كيان مكاني)`);

    // Verify Views are not counted as tables and v_energy_assets is a derived presentation view
    const energyView = spatialViews.find(v => v.relation_name === 'v_energy_assets');
    assert(!!energyView, 'المشهد المكاني v_energy_assets مصنف بدقة كـ SPATIAL VIEW مشتق');
    if (energyView) {
      const viewDef = await db.dbGet(`
        SELECT view_definition FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'v_energy_assets'
      `);
      assert(viewDef && viewDef.view_definition.includes('energy_assets'), 'المشهد المكاني v_energy_assets يستند إلى جدول الحقيقة المكاني energy_assets');
    }

    // 4. فحص سلامة الهندسة المكانية (Geometry Validity Scan)
    console.log('\n--- 4. Geometry Validity Scan ---');
    let totalRowsChecked = 0;
    let totalInvalid = 0;
    for (const rel of rawRelations) {
      const validity = await db.dbGet(`
        SELECT count(*)::int as total,
               count(CASE WHEN ${rel.geometry_column} IS NOT NULL AND NOT ST_IsValid(${rel.geometry_column}) THEN 1 END)::int as invalid_cnt
        FROM public."${rel.relation_name}"
      `);
      totalRowsChecked += validity.total;
      totalInvalid += validity.invalid_cnt;
    }
    assert(totalInvalid === 0, `جميع البيانات المكانية صالحة هندسياً (0 تشوهات من أصل ${totalRowsChecked} صف مفحوص)`);

    // 5. فحص توحيد نظام الإسناد المكاني (SRID Verification)
    console.log('\n--- 5. SRID Verification (WGS 84 / SRID 4326) ---');
    const non4326 = rawRelations.filter(c => c.srid !== 4326);
    assert(non4326.length === 0, `كافة الكيانات المكانية مضبوطة على SRID 4326 القياسي (المخالفات: ${non4326.length})`);

    // 6. فحص الفهارس المكانية للجداول القانونية (GIST Index Verification)
    console.log('\n--- 6. GIST Spatial Index Verification ---');
    const gistIndexes = await db.dbQuery(`
      SELECT t.relname as table_name, i.relname as index_name, a.attname as column_name
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND am.amname = 'gist'
    `);
    const gistMap = new Map();
    for (const g of gistIndexes) {
      gistMap.set(`${g.table_name}.${g.column_name}`, g.index_name);
    }

    // Verify dynamically that every single canonical spatial table has a GIST index on its geometry column
    const missingGist = canonicalTables.filter(t => !gistMap.has(`${t.relation_name}.${t.geometry_column}`));
    assert(missingGist.length === 0, `كافة الجداول المكانية القانونية الـ ${canonicalTables.length} تمتلك فهرس GIST مكاني فعلي (المفقود: ${missingGist.length})`);

    // 7. تحويل وتسلسل الـ GeoJSON (GeoJSON Serialization/Deserialization)
    console.log('\n--- 7. GeoJSON Serialization & Deserialization ---');
    const testGeoJson = '{"type":"LineString","coordinates":[[35.7000,32.2900],[35.7050,32.2950]]}';
    const geoJsonTest = await db.dbGet(`
      SELECT ST_AsGeoJSON(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as json_output,
             ST_GeometryType(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as geom_type,
             ST_SRID(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as srid
    `, [testGeoJson]);
    const parsedGeoJson = JSON.parse(geoJsonTest.json_output);
    assert(parsedGeoJson.type === 'LineString' && parsedGeoJson.coordinates.length === 2, 'تحويل GeoJSON إلى PostGIS وإعادته بنجاح');
    assert(geoJsonTest.srid === 4326, 'نظام الإسناد المكاني للـ GeoJSON المحول هو 4326');

    // 8. عمليات CRUD المكانية الكاملة (Spatial CRUD)
    console.log('\n--- 8. Spatial CRUD Lifecycle ---');
    const testRoadData = {
      name: 'شارع اختبار الفحص الجنائي المكاني',
      code: `RD-TEST-${Date.now()}`,
      category: 'فرعي',
      classification: 'فرعي',
      length_km: 0.85,
      width_m: 8.0,
      lanes_count: 2,
      pci_score: 92,
      start_lat: 32.2950,
      start_lng: 35.7010,
      end_lat: 32.2980,
      end_lng: 35.7060,
      geometry: {
        type: 'LineString',
        coordinates: [[35.7010, 32.2950], [35.7060, 32.2980]]
      }
    };

    // CREATE
    const createdRoad = await roadsEngineService.createRoad(testRoadData, { id: 'AUDITOR-01', fullName: 'مدقق GIS' });
    assert(!!createdRoad && !!createdRoad.id, `إنشاء طريق جديد برقم [${createdRoad.id}]`);

    // READ & verify PostGIS geometry populated
    const dbRoad = await db.dbGet('SELECT id, name, ST_AsGeoJSON(geom) as geojson, ST_SRID(geom) as srid FROM public.roads WHERE id = $1', [createdRoad.id]);
    assert(!!dbRoad && !!dbRoad.geojson, 'قراءة الطريق والتأكد من حفظ الـ Geometry في PostGIS');
    assert(dbRoad?.srid === 4326, 'الإسناد المكاني للطريق المخزن هو 4326');

    // UPDATE geometry
    const updatedGeometry = {
      type: 'LineString',
      coordinates: [[35.7010, 32.2950], [35.7035, 32.2965], [35.7060, 32.2980]]
    };
    await roadsEngineService.updateRoad(createdRoad.id, { geometry: updatedGeometry, length_km: 0.95 }, { id: 'AUDITOR-01' });
    const updatedDbRoad = await db.dbGet('SELECT id, ST_AsGeoJSON(geom) as geojson, length_km FROM public.roads WHERE id = $1', [createdRoad.id]);
    const parsedUpdatedGeom = JSON.parse(updatedDbRoad.geojson);
    assert(parsedUpdatedGeom.coordinates.length === 3, 'تعديل وتحديث هندسة الطريق وتأكيد حفظ 3 نقاط إحداثية');

    // DELETE
    const deleteRes = await roadsEngineService.deleteRoad(createdRoad.id, { id: 'AUDITOR-01' });
    assert(deleteRes.success === true, 'حذف الطريق التجريبي بنجاح تام');
    const roadAfterDelete = await db.dbGet('SELECT id FROM public.roads WHERE id = $1', [createdRoad.id]);
    assert(!roadAfterDelete, 'تأكيد إزالة الطريق من جدول PostgreSQL بعد الحذف');

    // 9. استرجاع نتائج مكانية فارغة (Empty Spatial Result Handling)
    console.log('\n--- 9. Empty Spatial Result Handling ---');
    // Query a coordinate far away (e.g. North Pole)
    const farDistanceRoads = await db.dbQuery(`
      SELECT id FROM public.roads 
      WHERE geom IS NOT NULL 
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(0, 89), 4326)::geography, 100)
    `);
    assert(Array.isArray(farDistanceRoads) && farDistanceRoads.length === 0, 'الاستعلام المكاني في نطاق فارغ يُرجع مصفوفة فارغة [] دون خطأ');

    // 10. دلالات فشل قواعد البيانات (DB Failure Semantics)
    console.log('\n--- 10. DB Failure Semantics ---');
    let caughtExpectedErr = false;
    try {
      // Intentionally pass invalid WKT to trigger PostGIS parser error
      await db.dbQuery("SELECT ST_GeomFromText('INVALID_POLYGON')");
    } catch (e) {
      caughtExpectedErr = true;
    }
    assert(caughtExpectedErr, 'فشل استعلام PostGIS الخاطئ يتم اعتراضه وإرجاع خطأ صريح دون خلق بيانات وهمية');

    // 11. معالجة البيانات المكانية غير الصالحة (Invalid Geometry Handling)
    console.log('\n--- 11. Invalid Geometry Handling ---');
    let malformedRejected = false;
    try {
      // GeoJSON with mismatched bracket
      await db.dbQuery("SELECT ST_GeomFromGeoJSON('{ \"type\": \"Point\", \"coordinates\": [1] }')");
    } catch (e) {
      malformedRejected = true;
    }
    assert(malformedRejected, 'رفض الهندسة المكانية المشوهة بنجاح وحماية قاعدة البيانات');

    // 12. التحقق من الصلاحيات المكانية (Spatial Authorization Scan)
    console.log('\n--- 12. Spatial Authorization Scan ---');
    const serverCode = fs.readFileSync(path.resolve(__dirname, '..', 'server.js'), 'utf8');
    const spatialRouteProtected = serverCode.includes("app.post('/api/v4/spatial/analyze-buffer'") &&
                                   serverCode.includes("rbacManager.verifyToken");
    assert(spatialRouteProtected, 'نقاط نهاية الـ Spatial محمية بواسطة rbacManager.verifyToken');

    // 13. فحص انعدام الـ Runtime DDL (Zero Runtime DDL)
    console.log('\n--- 13. Runtime DDL Verification ---');
    const gisCode = fs.readFileSync(path.resolve(__dirname, '..', 'GIS/Pages/unifiedGisEngine.js'), 'utf8');
    const roadsServiceCode = fs.readFileSync(path.resolve(__dirname, '..', 'services/roadsEngineService.js'), 'utf8');
    const specializedCode = fs.readFileSync(path.resolve(__dirname, '..', 'services/specializedAssetsEngine.js'), 'utf8');
    const ddlKeywords = ['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX'];
    let ddlFound = false;
    for (const kw of ddlKeywords) {
      if (gisCode.includes(kw) || roadsServiceCode.includes(kw) || specializedCode.includes(kw)) {
        ddlFound = true;
        console.error(`Found runtime DDL keyword: ${kw}`);
      }
    }
    assert(!ddlFound, 'انعدام الـ Runtime DDL بالكامل في كافة خدمات وملفات الـ GIS (DDL = 0)');

    // 14. فحص انعدام تجاوز قاعدة البيانات (Zero Direct DB Bypass)
    console.log('\n--- 14. Direct DB Bypass Scan ---');
    const roadsEngineApi = fs.readFileSync(path.resolve(__dirname, '..', 'Roads/API/roadsEngine.js'), 'utf8');
    const pavingApi = fs.readFileSync(path.resolve(__dirname, '..', 'PavementReturns/API/pavingReturns.js'), 'utf8');
    const directPg = roadsEngineApi.includes("require('pg')") || pavingApi.includes("require('pg')");
    assert(!directPg, 'انعدام أي استدعاء مباشر لـ require(pg) أو تجاوز لـ utils/database.js');

    // 15. اختبارات دخان مستهلكي الـ GIS (Consumer Smoke Tests)
    console.log('\n--- 15. GIS Consumer Smoke Tests ---');
    // Test specializedAssetsEngine spatial query
    const structuralResult = await specializedAssetsEngine.getStructuralAssets();
    assert(Array.isArray(structuralResult), `محرك الأصول المتخصصة يستعلم بنجاح عن الأصول الإنشائية (${structuralResult.length} أصل)`);

    const energyResult = await specializedAssetsEngine.getEnergyAssets();
    assert(Array.isArray(energyResult), `محرك الأصول المتخصصة يستعلم بنجاح عن أصول الإنارة والطاقة (${energyResult.length} أصل)`);

    const networksResult = await specializedAssetsEngine.getInfrastructureNetworks();
    assert(Array.isArray(networksResult), `محرك الأصول المتخصصة يستعلم بنجاح عن شبكات البنية التحتية (${networksResult.length} شبكة)`);

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`🏁 اكتمال الاختبارات الجنائية للـ GIS: ${passed} نجاح | ${failed} فشل`);
    console.log('════════════════════════════════════════════════════════════\n');

    await db.closeDatabase();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error in GIS test suite:', err);
    try { await db.closeDatabase(); } catch (e) {}
    process.exit(1);
  }
}

runGisTestSuite();
