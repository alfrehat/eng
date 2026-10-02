const fs = require('fs');
const path = require('path');

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');

const lifecycleScripts = ['preinstall', 'install', 'postinstall', 'preuninstall', 'postuninstall', 'prepare'];
const results = [];

function scanPkg(dir, pkgName) {
  const pkgJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const scripts = pkg.scripts || {};
    const foundScripts = {};

    lifecycleScripts.forEach(s => {
      if (scripts[s]) {
        foundScripts[s] = scripts[s];
      }
    });

    if (Object.keys(foundScripts).length > 0) {
      // Analyze script contents
      const analysis = {};
      for (const [sName, sCmd] of Object.entries(foundScripts)) {
        let category = 'LEGITIMATE_BUILD_SCRIPT';
        let flags = [];

        if (sCmd.includes('curl') || sCmd.includes('wget')) flags.push('NETWORK_DOWNLOAD');
        if (sCmd.includes('powershell') || sCmd.includes('cmd.exe')) flags.push('SHELL_EXECUTION');
        if (/eval\s*\(/.test(sCmd) || /base64/i.test(sCmd)) flags.push('OBFUSCATION_SUSPICION');

        // Known legitimate:
        // electron postinstall: node install.js (downloads binary for current OS)
        // esbuild/node-gyp/etc
        if (pkgName === 'electron' && sCmd === 'node install.js') {
          category = 'LEGITIMATE_ELECTRON_BINARY_FETCHER';
        }

        analysis[sName] = {
          command: sCmd,
          category,
          flags
        };
      }

      results.push({
        package: pkgName,
        version: pkg.version,
        path: path.relative(nodeModulesDir, dir).replace(/\\/g, '/'),
        scripts: analysis
      });
    }
  } catch (e) {}
}

function walk(dir, currentPkg = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('@')) {
        // Scoped dir
        const scopedEntries = fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true });
        for (const sub of scopedEntries) {
          if (sub.isDirectory()) {
            scanPkg(path.join(dir, entry.name, sub.name), `${entry.name}/${sub.name}`);
            const nested = path.join(dir, entry.name, sub.name, 'node_modules');
            if (fs.existsSync(nested)) walk(nested);
          }
        }
      } else {
        scanPkg(path.join(dir, entry.name), entry.name);
        const nested = path.join(dir, entry.name, 'node_modules');
        if (fs.existsSync(nested)) walk(nested);
      }
    }
  }
}

walk(nodeModulesDir);

console.log(`Scanned node_modules. Packages with lifecycle scripts: ${results.length}`);
console.log(JSON.stringify(results, null, 2));
