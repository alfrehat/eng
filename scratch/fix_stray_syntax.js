const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.resolve(__dirname, '../services');
const files = fs.readdirSync(servicesDir);

let fixed = 0;
files.forEach(f => {
  if (!f.endsWith('.js')) return;
  const full = path.join(servicesDir, f);
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes('}););')) {
    content = content.replace(/ \}\); \);/g, '      });');
    content = content.replace(/\}\);\);/g, '});');
    fs.writeFileSync(full, content, 'utf8');
    fixed++;
  }
  // Check specializedAssetsEngine.js specifically
  if (f === 'specializedAssetsEngine.js') {
    content = fs.readFileSync(full, 'utf8');
    // Let's inspect around line 62
  }
  try {
    execSync(`node -c "${full}"`);
    console.log(`✅ Clean syntax: ${f}`);
  } catch (err) {
    console.error(`❌ Still has syntax error: ${f} ->`, err.message);
  }
});
console.log(`Fixed ${fixed} files.`);
