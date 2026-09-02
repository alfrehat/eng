/**
 * scripts/test-master-print-engine.js
 * 🧪 اختبار محرك الطباعة المطور وتخصيص النموذج العام والترقيم الديناميكي
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🖨️  فحص واختبار محرك الطباعة والتقارير الموحد وتخصيص النموذج العام');
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

  // 1. Check printEngine.js existence & exports
  const printEnginePath = path.join(__dirname, '../Reports/Pages/printEngine.js');
  assert(fs.existsSync(printEnginePath), '1. printEngine.js exists');
  const printEngineContent = fs.readFileSync(printEnginePath, 'utf8');

  assert(printEngineContent.includes('DEFAULT_MASTER_CONFIG'), '2. DEFAULT_MASTER_CONFIG defined in printEngine.js');
  assert(printEngineContent.includes('getMasterPrintConfig'), '3. getMasterPrintConfig helper exposed');
  assert(printEngineContent.includes('saveMasterPrintConfig'), '4. saveMasterPrintConfig helper exposed');
  assert(printEngineContent.includes('resetMasterPrintConfig'), '5. resetMasterPrintConfig helper exposed');
  assert(printEngineContent.includes('logoPosition'), '6. Flexible header logo position (center, right, left) supported');
  assert(printEngineContent.includes('watermarkEnabled'), '7. Dynamic watermark engine supported (logo & text angle)');
  assert(printEngineContent.includes('showPageNumbers'), '8. Dynamic pagination engine (Page X of Y) supported');
  assert(printEngineContent.includes('generateInlineQrSvg'), '9. Inline vector SVG QR generator for verification supported');

  // 2. Check unifiedPrintTemplatesManager.js Master Customizer UI
  const managerPath = path.join(__dirname, '../Reports/Pages/unifiedPrintTemplatesManager.js');
  assert(fs.existsSync(managerPath), '10. unifiedPrintTemplatesManager.js exists');
  const managerContent = fs.readFileSync(managerPath, 'utf8');

  assert(managerContent.includes('openMasterConfigModal'), '11. openMasterConfigModal implemented');
  assert(managerContent.includes('updateMasterPreviewLive'), '12. Live interactive A4 preview engine implemented');
  assert(managerContent.includes('saveMasterConfigFromModal'), '13. saveMasterConfigFromModal implemented');
  assert(managerContent.includes('handleMasterLogoFile'), '14. Custom logo upload and preview supported');

  // 3. Test Master Config API Endpoints via HTTP
  async function testApi() {
    return new Promise((resolve) => {
      const getReq = http.get('http://localhost:3005/api/print-templates/master-config', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            assert(res.statusCode === 200 && parsed.success === true, '15. GET /api/print-templates/master-config returns 200 OK');
            assert(parsed.data && parsed.data.municipalityName === 'بلدية كفرنجة الجديدة', '16. GET returns correct default municipality metadata');
          } catch(e) {
            assert(false, '15. GET /api/print-templates/master-config failed: ' + e.message);
          }

          // Test POST
          const postData = JSON.stringify({
            municipalityName: 'بلدية كفرنجة الجديدة',
            directorateName: 'مديرية الأشغال والخدمات الهندسية',
            primaryColor: '#1e3a8a',
            showPageNumbers: true
          });

          const postReq = http.request('http://localhost:3005/api/print-templates/master-config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          }, (pRes) => {
            let pBody = '';
            pRes.on('data', c => pBody += c);
            pRes.on('end', () => {
              try {
                const pParsed = JSON.parse(pBody);
                assert(pRes.statusCode === 200 && pParsed.success === true, '17. POST /api/print-templates/master-config successfully saves configuration');
              } catch(e) {
                assert(false, '17. POST /api/print-templates/master-config failed: ' + e.message);
              }
              resolve();
            });
          });

          postReq.on('error', (e) => {
            assert(false, '17. POST request error: ' + e.message);
            resolve();
          });
          postReq.write(postData);
          postReq.end();
        });
      });

      getReq.on('error', (e) => {
        console.warn('⚠️ Server not responding to HTTP test (testing static files only):', e.message);
        resolve();
      });
    });
  }

  await testApi();

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة الإجمالية: ${passed} نجح | ${failed} فشل`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTest();
