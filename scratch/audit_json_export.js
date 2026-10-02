const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');
const skipDirs = ['node_modules', '.git', 'coverage', '.system_generated', 'dist', 'scratch'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (skipDirs.includes(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

const allFiles = walk(rootDir);

const fsWrites = [];
const directPool = [];
const dataReferences = [];

for (const file of allFiles) {
    if (!file.endsWith('.js')) continue;
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((l, idx) => {
        if (l.match(/fs\.(writeFile|writeFileSync|appendFile|appendFileSync)/)) {
            fsWrites.push({ file: rel, line: idx + 1, code: l.trim() });
        }
        if (l.match(/['"`](?:\.\.\/|\.\/|\/)??(?:data|database)\/[^'"`]+\.json['"`]/)) {
            dataReferences.push({ file: rel, line: idx + 1, code: l.trim() });
        }
    });

    if (rel !== 'utils/database.js' && (content.includes("require('pg')") || content.includes('require("pg")') || content.includes('new Pool'))) {
        directPool.push(rel);
    }
}

fs.writeFileSync('scratch/fs_and_data_audit.json', JSON.stringify({
    fsWrites,
    directPool,
    dataReferences
}, null, 2));

console.log(`fsWrites count: ${fsWrites.length}`);
console.log(`directPool count: ${directPool.length}`);
console.log(`dataReferences count: ${dataReferences.length}`);
