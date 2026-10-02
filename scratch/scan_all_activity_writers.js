const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const results = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'artifacts'].includes(entry.name)) continue;
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (/INSERT\s+INTO\s+(public\.)?activity_log/i.test(line)) {
          results.push({
            file: relPath,
            line: lineNum,
            type: 'SQL_INSERT',
            content: line.trim()
          });
        }
        if (/recordActivity\s*\(/i.test(line) && !line.includes('async function recordActivity') && !line.includes('const { recordActivity }')) {
          results.push({
            file: relPath,
            line: lineNum,
            type: 'CALL_RECORDACTIVITY',
            content: line.trim()
          });
        }
        if (/logActivity\s*\(/i.test(line) && !line.includes('async function logActivity') && !line.includes('global.logActivity =') && !line.includes("app.set('logActivity'")) {
          results.push({
            file: relPath,
            line: lineNum,
            type: 'CALL_LOGACTIVITY',
            content: line.trim()
          });
        }
      });
    }
  }
}

scanDir(rootDir);

console.log(`Found ${results.length} occurrences in JS files:\n`);
const grouped = {};
results.forEach(r => {
  if (!grouped[r.file]) grouped[r.file] = [];
  grouped[r.file].push(r);
});

for (const [file, items] of Object.entries(grouped)) {
  console.log(`📄 ${file} (${items.length} occurrences):`);
  items.forEach(i => console.log(`   L${i.line} [${i.type}]: ${i.content.substring(0, 100)}`));
}
