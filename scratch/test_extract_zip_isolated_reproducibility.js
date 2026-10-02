const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const tempDir = path.join(__dirname, 'temp_extract_zip_audit');

console.log('--- ISOLATED VERIFICATION OF ELECTRON & EXTRACT-ZIP ---');

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(tempDir, 'package.json'));
fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(tempDir, 'package-lock.json'));
console.log('1. Prepared isolated sandbox environment at scratch/temp_extract_zip_audit');

console.log('2. Running npm ci in isolated directory...');
try {
  cp.execSync('npm ci --ignore-scripts', { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ npm ci passed in isolated sandbox!');
} catch (e) {
  console.error('❌ npm ci failed:', e.stdout || e.message);
  process.exit(1);
}

console.log('3. Running npm ls electron extract-zip --all in isolated directory...');
try {
  const lsOut = cp.execSync('npm ls electron extract-zip --all', { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' });
  console.log(lsOut.trim());
} catch (e) {
  console.error('❌ npm ls failed:', e.stdout || e.message);
  process.exit(1);
}

console.log('4. Running npm audit --json in isolated directory...');
let auditReport;
try {
  const auditOut = cp.execSync('npm audit --json', { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' });
  auditReport = JSON.parse(auditOut);
} catch (e) {
  // npm audit exits with 1 when vulnerabilities exist
  try {
    auditReport = JSON.parse(e.stdout);
  } catch (parseErr) {
    auditReport = { error: e.message };
  }
}

const vulns = auditReport.metadata?.vulnerabilities || {};
console.log('Vulnerability summary in isolated sandbox:', vulns);
console.log('Advisories detected:', Object.keys(auditReport.vulnerabilities || {}));

console.log('5. Cleaning up isolated test directory...');
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✅ Isolated verification completed successfully!');
