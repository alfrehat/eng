const fs = require('fs');
const path = require('path');

const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
const current = process.version; // e.g. v24.19.0
console.log('Current runtime Node version:', current);

const enginesList = [];
for (const [pkgPath, pkgData] of Object.entries(lock.packages || {})) {
  if (pkgData.engines && pkgData.engines.node) {
    enginesList.push({
      package: pkgPath,
      required: pkgData.engines.node
    });
  }
}

console.log(`Found ${enginesList.length} packages with engines.node constraints.`);

// Check root dependencies
const rootDeps = ['bcryptjs', 'cors', 'dotenv', 'express', 'jsonwebtoken', 'multer', 'pg', 'ws', 'electron', 'nodemon'];
const rootConstraints = enginesList.filter(e => rootDeps.some(d => e.package === `node_modules/${d}`));
console.log('\nRoot Dependencies Node Engines:');
console.log(JSON.stringify(rootConstraints, null, 2));
