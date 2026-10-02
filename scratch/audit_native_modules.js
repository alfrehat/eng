const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');
const nodeBinaries = [];

function searchNodeFiles(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        searchNodeFiles(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.node') || entry.name.endsWith('.dll') || entry.name.endsWith('.exe')) {
          nodeBinaries.push({
            name: entry.name,
            size: fs.statSync(fullPath).size,
            relPath: path.relative(nodeModulesDir, fullPath).replace(/\\/g, '/')
          });
        }
      }
    }
  } catch (e) {}
}

searchNodeFiles(nodeModulesDir);

console.log('Binary files in node_modules:');
console.log(JSON.stringify(nodeBinaries, null, 2));

// Check specific packages
const packagesToCheck = ['bcryptjs', 'bcrypt', 'pg', 'pg-native', 'ws', 'bufferutil', 'utf-8-validate', 'electron'];
const status = {};

packagesToCheck.forEach(pkg => {
  const pPath = path.join(nodeModulesDir, pkg);
  if (fs.existsSync(pPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pPath, 'package.json'), 'utf8'));
    status[pkg] = {
      installed: true,
      version: pkgJson.version,
      isPureJs: pkg === 'bcryptjs' ? true : (pkg === 'pg' ? true : false)
    };
  } else {
    status[pkg] = { installed: false };
  }
});

console.log('\nPackage Binary / Native Check:');
console.log(JSON.stringify(status, null, 2));
