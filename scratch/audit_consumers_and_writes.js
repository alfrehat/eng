const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');
const codeExtensions = ['.js', '.json', '.sql'];
const skipDirs = ['node_modules', '.git', 'coverage', '.system_generated', 'dist'];

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

console.log(`Total files scanned: ${allFiles.length}`);

// Scan for direct fs.write* calls
const writeMatches = [];
const dataReferences = [];
const directPoolMatches = [];
const rawDdlMatches = [];

for (const file of allFiles) {
    if (!file.endsWith('.js')) continue;
    // Skip scratch scripts
    if (file.includes(path.sep + 'scratch' + path.sep)) continue;
    
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(rootDir, file);

    // 1. fs writes
    if (content.match(/fs\.(writeFile|writeFileSync|appendFile|appendFileSync)/)) {
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
            if (l.match(/fs\.(writeFile|writeFileSync|appendFile|appendFileSync)/)) {
                writeMatches.push({ file: rel, line: idx + 1, code: l.trim() });
            }
        });
    }

    // 2. data/ or database/ references
    if (content.match(/['"`].*?data\//i) || content.match(/['"`].*?database\//i) || content.match(/path\.join\(.*?['"`](data|database)['"`]/)) {
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
            if (l.match(/['"`].*?(data|database)\/.*?['"`]/i) || l.match(/path\.join\(.*?['"`](data|database)['"`]/i)) {
                dataReferences.push({ file: rel, line: idx + 1, code: l.trim() });
            }
        });
    }

    // 3. direct require('pg') or new Pool outside utils/database.js
    if (rel !== 'utils\\database.js' && rel !== 'utils/database.js') {
        if (content.includes("require('pg')") || content.includes('require("pg")') || content.includes('new Pool')) {
            directPoolMatches.push({ file: rel });
        }
    }

    // 4. Runtime DDL outside migrations/ and setup scripts
    if (!rel.startsWith('migrations') && !rel.startsWith('database') && !rel.includes('migrate')) {
        const ddlRegex = /(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+INDEX|DROP\s+INDEX)/i;
        if (content.match(ddlRegex)) {
            const lines = content.split('\n');
            lines.forEach((l, idx) => {
                if (l.match(ddlRegex) && !l.includes('//') && !l.includes('*') && !l.includes('description') && !l.includes('label')) {
                    rawDdlMatches.push({ file: rel, line: idx + 1, code: l.trim() });
                }
            });
        }
    }
}

console.log(`\n--- fs.write* calls (${writeMatches.length}): ---`);
writeMatches.forEach(m => console.log(`${m.file}:${m.line} -> ${m.code.substring(0, 100)}`));

console.log(`\n--- data/database path references (${dataReferences.length}): ---`);
dataReferences.forEach(m => console.log(`${m.file}:${m.line} -> ${m.code.substring(0, 100)}`));

console.log(`\n--- Direct PG pool matches outside utils/database.js (${directPoolMatches.length}): ---`);
directPoolMatches.forEach(m => console.log(m.file));

console.log(`\n--- Runtime DDL matches (${rawDdlMatches.length}): ---`);
rawDdlMatches.forEach(m => console.log(`${m.file}:${m.line} -> ${m.code.substring(0, 100)}`));
