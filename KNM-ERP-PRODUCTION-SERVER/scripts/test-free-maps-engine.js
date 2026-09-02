/**
 * scripts/test-free-maps-engine.js
 * 🧪 فحص واختبار خلو النظام من أي خرائط تتطلب مفاتيح والتحقق من محركات الخرائط المجانية المفتوحة
 */

const fs = require('fs');
const path = require('path');

function runTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🗺️  بدء فحص محركات الخرائط المفتوحة والمجانية 100% وخلو النظام من مفاتيح API');
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

  // 1. فحص ملف محرك الخرائط الموحد UnifiedGisEngine
  const gisFilePath = path.join(__dirname, '..', 'GIS', 'Pages', 'unifiedGisEngine.js');
  assert(fs.existsSync(gisFilePath), '1. UnifiedGisEngine source file exists');
  
  const gisContent = fs.readFileSync(gisFilePath, 'utf8');

  // 2. التحقق من إزالة كافة روابط CARTO التي تتطلب مفتاح
  const hasCarto = gisContent.includes('cartocdn.com') || gisContent.includes('basemaps.cartocdn');
  assert(!hasCarto, '2. All CARTO (API Key Required) basemaps completely eliminated');

  // 3. التحقق من توفير محركات الخرائط المجانية المعتمدة
  assert(gisContent.includes('tile.openstreetmap.org'), '3. OpenStreetMap Standard tile layer available');
  assert(gisContent.includes('World_Imagery/MapServer'), '4. Esri High-Resolution Satellite HD layer available');
  assert(gisContent.includes('World_Street_Map/MapServer'), '5. Esri World Street Navigation layer available');
  assert(gisContent.includes('World_Topo_Map/MapServer'), '6. Esri Engineering Topographic layer available');
  assert(gisContent.includes('NatGeo_World_Map/MapServer'), '7. National Geographic World Map layer available');
  assert(gisContent.includes('opentopomap.org'), '8. OpenTopoMap Contours & Elevation layer available');
  assert(gisContent.includes('tile.openstreetmap.fr/hot'), '9. Humanitarian OSM Team (HOT) layer available');
  assert(gisContent.includes('cyclosm'), '10. CyclOSM Infrastructure layer available');
  assert(gisContent.includes('World_Boundaries_and_Places'), '11. Esri Reference Overlay Labels layer available');


  // 5. فحص لوحة RAMS وخلوها من CARTO
  const ramsPath = path.join(__dirname, '..', 'Roads', 'Pages', 'ramsDashboard.js');
  if (fs.existsSync(ramsPath)) {
    const ramsContent = fs.readFileSync(ramsPath, 'utf8');
    assert(!ramsContent.includes('cartocdn.com'), '13. RAMS Road Network maps free of CARTO key dependency');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest();
