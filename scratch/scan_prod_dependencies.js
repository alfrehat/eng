const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const prodDirs = [
  'Administration', 'Archive', 'Assets', 'Budget', 'Committees', 'Contracts',
  'Inspection', 'PavementReturns', 'Projects', 'Purchases', 'Reports', 'Roads',
  'Settings', 'Tenders', 'middlewares', 'routes', 'services', 'utils', 'scripts',
  'GIS', 'OperationsCenter'
];
const rootFiles = ['server.js', 'electron-main.js', 'security-bridge.js'];

const builtins = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'https', 'inspector', 'module', 'net', 'os', 'path', 'process', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

const found = {};

function scan(fp) {
  try {
    const c = fs.readFileSync(fp, 'utf8');
    const rel = path.relative(rootDir, fp).replace(/\\/g, '/');
    const re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(c)) !== null) {
      const p = m[1];
      if (!p.startsWith('.') && !p.startsWith('/') && !path.isAbsolute(p)) {
        const pkg = p.startsWith('@') ? p.split('/').slice(0, 2).join('/') : p.split('/')[0];
        if (!builtins.has(pkg)) {
          if (!found[pkg]) found[pkg] = [];
          found[pkg].push(rel);
        }
      }
    }
  } catch (e) {}
}

rootFiles.forEach(f => {
  const fp = path.join(rootDir, f);
  if (fs.existsSync(fp)) scan(fp);
});

prodDirs.forEach(d => {
  const dp = path.join(rootDir, d);
  if (fs.existsSync(dp)) {
    const files = fs.readdirSync(dp, { recursive: true });
    files.forEach(f => {
      const fp = path.join(dp, f);
      if (fs.statSync(fp).isFile() && (fp.endsWith('.js') || fp.endsWith('.mjs'))) {
        scan(fp);
      }
    });
  }
});

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkgJson.dependencies || {}),
  ...Object.keys(pkgJson.devDependencies || {})
]);

console.log('Production required packages:');
for (const [k, v] of Object.entries(found)) {
  console.log(`- ${k} (${v.length} files) -> ${declared.has(k) ? 'DECLARED' : 'MISSING'}`);
}

const missing = Object.keys(found).filter(k => !declared.has(k));
console.log('\nMissing production dependencies:', missing);
