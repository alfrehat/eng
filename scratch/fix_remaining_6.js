const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.resolve(__dirname, '../services');

const badFiles = [
  'assetsEngineService.js',
  'claimsEngineService.js',
  'committeesEngineService.js',
  'dataReconciliationService.js',
  'reportsEngineService.js',
  'rulesEngineService.js'
];

badFiles.forEach(f => {
  const full = path.join(servicesDir, f);
  let content = fs.readFileSync(full, 'utf8');
  content = content.replace(/\s*saveMemTable\('activity_log'\);\s*\}\s*\}\s*catch\s*\(e\)\s*\{/g, '\n    } catch (e) {');
  content = content.replace(/\s*\}\s*\}\s*catch\s*\(e\)\s*\{/g, '\n    } catch (e) {');
  fs.writeFileSync(full, content, 'utf8');

  try {
    execSync(`node -c "${full}"`);
    console.log(`✅ Fixed & OK: ${f}`);
  } catch (err) {
    console.error(`❌ Still error in ${f}:`, err.message);
  }
});
