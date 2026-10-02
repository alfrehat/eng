const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const testDir = path.join(__dirname, 'temp_ci_test');

console.log('--- REPRODUCIBILITY VERIFICATION TEST ---');

// 1. Prepare isolated test directory
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

// 2. Copy only package.json and package-lock.json
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(testDir, 'package.json'));
fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(testDir, 'package-lock.json'));

console.log('1. Created isolated test environment at scratch/temp_ci_test');

// 3. Run npm ci in test directory
console.log('2. Running npm ci in isolated directory...');
try {
  // Use ignore-scripts to avoid downloading electron binary in temporary test
  const ciOutput = cp.execSync('npm ci --ignore-scripts', { cwd: testDir, encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ npm ci succeeded in isolated directory!');
} catch (err) {
  console.error('❌ npm ci failed in isolated directory:', err.stdout || err.message);
  process.exit(1);
}

// 4. Run npm ls in test directory
console.log('3. Running npm ls in isolated directory...');
try {
  const lsOutput = cp.execSync('npm ls --depth=0 --json', { cwd: testDir, encoding: 'utf8', stdio: 'pipe' });
  const lsData = JSON.parse(lsOutput);
  const pkgCount = Object.keys(lsData.dependencies || {}).length;
  console.log(`✅ npm ls succeeded! Found ${pkgCount} resolved root dependencies.`);
} catch (err) {
  console.error('❌ npm ls failed in isolated directory:', err.stdout || err.message);
  process.exit(1);
}

// 5. Clean up temporary test directory
console.log('4. Cleaning up isolated test directory...');
fs.rmSync(testDir, { recursive: true, force: true });
console.log('✅ Isolated reproducibility test completed with 100% success.');
