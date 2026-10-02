const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const declaredDeps = Object.keys(pkg.dependencies || {});
const declaredDevDeps = Object.keys(pkg.devDependencies || {});
const allDeclared = new Set([...declaredDeps, ...declaredDevDeps]);

const excludeDirs = new Set(['node_modules', '.git', 'uploads', 'logs', 'backups', 'temp', 'tmp', 'dist', 'build', '.system_generated', 'obj', 'bin']);

const builtinModules = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'stream/promises', 'stream/consumers', 'stream/web', 'string_decoder',
  'timers', 'timers/promises', 'tls', 'trace_events', 'tty', 'url', 'util',
  'util/types', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

const packageConsumers = {};
const allFoundPackages = new Set();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) {
        walk(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js', '.mjs', '.cjs', '.ts', '.json'].includes(ext)) {
        scanFile(path.join(dir, entry.name));
      }
    }
  }
}

function scanFile(filePath) {
  // skip package.json and package-lock.json themselves
  const base = path.basename(filePath);
  if (base === 'package.json' || base === 'package-lock.json' || base === 'consumer_scan_results.json' || base === 'schema_forensic_output.json') return;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

    // match require('pkg') or require("pkg")
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      handleImport(match[1], relPath);
    }

    // match import ... from 'pkg' or import('pkg')
    const importRegex = /(?:import\s+(?:[\w*\s{},]+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content)) !== null) {
      handleImport(match[1], relPath);
    }
  } catch (e) {}
}

function handleImport(importPath, relPath) {
  // If local relative or absolute path, ignore
  if (importPath.startsWith('.') || importPath.startsWith('/') || importPath.startsWith('\\') || path.isAbsolute(importPath)) {
    return;
  }

  // Extract package name (handles scoped packages e.g. @org/pkg or package subpath e.g. pkg/sub)
  let pkgName;
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    pkgName = parts.slice(0, 2).join('/');
  } else {
    pkgName = importPath.split('/')[0];
  }

  // Check if builtin
  if (builtinModules.has(pkgName) || builtinModules.has(importPath) || importPath.startsWith('node:')) {
    return;
  }

  allFoundPackages.add(pkgName);
  if (!packageConsumers[pkgName]) {
    packageConsumers[pkgName] = new Set();
  }
  packageConsumers[pkgName].add(relPath);
}

walk(rootDir);

const result = {
  declaredDependencies: declaredDeps,
  declaredDevDependencies: declaredDevDeps,
  foundPackages: Array.from(allFoundPackages),
  packageConsumers: {}
};

for (const [pkg, consumers] of Object.entries(packageConsumers)) {
  result.packageConsumers[pkg] = Array.from(consumers);
}

// Missing direct declarations: found in code but not in package.json
const missingDeclarations = Array.from(allFoundPackages).filter(p => !allDeclared.has(p));

// Declared but unused directly in codebase
const unusedDeclared = Array.from(allDeclared).filter(p => !allFoundPackages.has(p));

result.missingDeclarations = missingDeclarations;
result.unusedDeclared = unusedDeclared;

console.log(JSON.stringify(result, null, 2));
