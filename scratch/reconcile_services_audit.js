const fs = require('fs');
const path = require('path');

const servicesDir = path.resolve(__dirname, '../services');

// List of services to check and update
const files = fs.readdirSync(servicesDir);

let updatedCount = 0;

files.forEach(file => {
  if (!file.endsWith('.js')) return;
  const fullPath = path.join(servicesDir, file);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Look for the standard if (isPostgresActive()) { ... INSERT INTO (public\.)?activity_log ... } else if (memDb ... ) { ... }
  // pattern inside _recordAudit
  const pattern = /if\s*\(isPostgresActive\(\)\)\s*\{[\s\S]*?INSERT\s+INTO\s+(?:public\.)?activity_log[\s\S]*?\}\s*else\s*if\s*\(memDb[\s\S]*?\}\s*\}/;

  if (pattern.test(content)) {
    console.log(`Found direct INSERT in: ${file}`);
  }
});
