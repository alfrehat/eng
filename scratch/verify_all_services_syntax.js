const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.resolve(__dirname, '../services');
const files = fs.readdirSync(servicesDir);

let errors = 0;
files.forEach(f => {
  if (f.endsWith('.js')) {
    const full = path.join(servicesDir, f);
    try {
      execSync(`node -c "${full}"`);
    } catch (e) {
      console.error(`Syntax error in: ${f} -> ${e.message}`);
      errors++;
    }
  }
});

if (errors === 0) {
  console.log(`✅ ALL ${files.filter(f => f.endsWith('.js')).length} SERVICES IN services/ HAVE CLEAN SYNTAX!`);
} else {
  console.error(`${errors} errors found.`);
  process.exit(1);
}
