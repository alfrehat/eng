const fs = require('fs');
const path = require('path');

const servicesDir = path.resolve('./services');
const files = fs.readdirSync(servicesDir);

files.forEach(f => {
  if (f.endsWith('.js')) {
    const full = path.join(servicesDir, f);
    const content = fs.readFileSync(full, 'utf8');
    if (content.includes('activity_log')) {
      const match = content.match(/(async\s+_recordAudit[\s\S]*?)(?=\n\s*(?:async\s+|\/\*\*|class\s+|module\.exports))/);
      if (match) {
        console.log(`=== ${f} ===`);
        console.log(match[1].slice(0, 400));
        console.log('...\n');
      } else {
        console.log(`=== ${f} (NO _recordAudit match - other pattern) ===`);
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('activity_log')) {
            console.log(`  L${i+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
});
