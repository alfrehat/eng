const fs = require('fs');
const path = require('path');

const servicesDir = path.resolve(__dirname, '../services');
const files = fs.readdirSync(servicesDir);

files.forEach(f => {
  if (!f.endsWith('.js')) return;
  const full = path.join(servicesDir, f);
  let content = fs.readFileSync(full, 'utf8');

  // Regex to match the if (isPostgresActive()) block containing activity_log insert
  // and the following else if (memDb) block
  const regex = /if\s*\(isPostgresActive\(\)\)\s*\{[\s\S]*?INSERT\s+INTO\s+(?:public\.)?activity_log[\s\S]*?\}\s*else\s*if\s*\((?:memDb[\s\S]*?|isMemDbActive[\s\S]*?)\)\s*\{[\s\S]*?\}/;

  const m = content.match(regex);
  if (m) {
    console.log(`Matched in ${f}:`);
    console.log(m[0].slice(0, 150) + '...\n');
  }
});
