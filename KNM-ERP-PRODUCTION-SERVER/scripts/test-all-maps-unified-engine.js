/**
 * scripts/test-all-maps-unified-engine.js
 * 🧪 اختبار الربط الشامل والمطلق لكافة خرائط النظام بمحرك الخرائط الموحد UnifiedGisEngine
 */

const fs = require('fs');
const path = require('path');

function runTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🗺️  فحص الربط الشامل والمطلق لكافة خرائط النظام بمحرك الخرائط الموحد');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  const modulesToCheck = [
    { name: 'Unified GIS Engine', path: 'GIS/Pages/unifiedGisEngine.js' },
    { name: 'Tenders & Projects Manager', path: 'Tenders/Pages/unifiedTendersManager.js' },
    { name: 'Roads & PMS Network Manager', path: 'Roads/Pages/unifiedRoadsManager.js' },
    { name: 'RAMS Roads Dashboard', path: 'Roads/Pages/ramsDashboard.js' },
    { name: 'Pavement Returns Manager', path: 'PavementReturns/Pages/pavingReturns.js' },
    { name: 'Excavation Permits Manager', path: 'Administration/Pages/excavationPermits.js' },
    { name: 'Structural Assets Manager', path: 'Assets/Pages/structuralAssets.js' },
    { name: 'Infrastructure Networks Manager', path: 'Assets/Pages/infrastructureNetworks.js' },
    { name: 'Energy & Lighting Manager', path: 'Assets/Pages/energyLighting.js' },
    { name: 'Committees & Inspection Manager', path: 'Committees/Pages/unifiedCommitteesManager.js' },
    { name: 'System Settings & Visual Identity', path: 'Settings/Pages/unifiedSettingsManager.js' },
    { name: 'Core Dashboard & Portal Engine', path: 'app.js' }
  ];

  modulesToCheck.forEach((mod, idx) => {
    const fullPath = path.join(__dirname, '..', mod.path);
    if (!fs.existsSync(fullPath)) {
      assert(false, `${idx + 1}. Module file exists: ${mod.name}`);
      return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Zero CARTO references
    const noCarto = !content.includes('cartocdn.com') && !content.includes('basemaps.cartocdn');
    assert(noCarto, `${idx + 1}.1. ${mod.name} is 100% free of CARTO / Keyed providers`);

    // 2. Uses UnifiedGisEngine or createUnifiedMap
    const usesUnified = content.includes('UnifiedGisEngine') || content.includes('createUnifiedMap');
    assert(usesUnified, `${idx + 1}.2. ${mod.name} is strictly linked to Unified GIS Engine`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest();
