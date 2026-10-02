const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const nodeModulesDir = path.join(rootDir, 'node_modules');

const allDeps = {
  ...pkgJson.dependencies,
  ...pkgJson.devDependencies
};

const directLicenses = {};
const licenseCounts = {};
const legalReviewFlags = [];

for (const pkgName of Object.keys(allDeps)) {
  const pPath = path.join(nodeModulesDir, pkgName, 'package.json');
  if (fs.existsSync(pPath)) {
    try {
      const p = JSON.parse(fs.readFileSync(pPath, 'utf8'));
      let lic = p.license || (p.licenses ? JSON.stringify(p.licenses) : 'UNKNOWN');
      if (typeof lic === 'object' && lic.type) lic = lic.type;
      directLicenses[pkgName] = {
        version: p.version,
        license: lic,
        isDev: Boolean(pkgJson.devDependencies && pkgJson.devDependencies[pkgName])
      };

      licenseCounts[lic] = (licenseCounts[lic] || 0) + 1;

      const licUpper = String(lic).toUpperCase();
      if (licUpper.includes('GPL') || licUpper.includes('AGPL')) {
        legalReviewFlags.push({ package: pkgName, license: lic });
      }
    } catch (e) {
      directLicenses[pkgName] = { license: 'ERROR_READING' };
    }
  }
}

console.log('Direct Dependencies Licenses:');
console.log(JSON.stringify(directLicenses, null, 2));

console.log('\nSummary of Licenses:');
console.log(JSON.stringify(licenseCounts, null, 2));

console.log('\nLegal Review Required (GPL/AGPL):');
console.log(JSON.stringify(legalReviewFlags, null, 2));
