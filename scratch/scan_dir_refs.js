const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');
const skipDirs = ['node_modules', '.git', 'coverage', '.system_generated', 'dist', 'scratch'];

function walk(dir) {
    let results = [];
    for (const f of fs.readdirSync(dir)) {
        if (skipDirs.includes(f)) continue;
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(walk(full));
        } else if (f.endsWith('.js') || f.endsWith('.json')) {
            results.push(full);
        }
    }
    return results;
}

const files = walk(rootDir);
const hits = [];

for (const file of files) {
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    if (rel === 'scratch/scan_memdb_mutations.js') continue;
    const content = fs.readFileSync(file, 'utf8');
    
    // Check references to path 'data/' or 'data\\'
    const regex = /(?:['"`][^'"`]*\/data\/[^'"`]*['"`]|path\.join\([^)]*['"`]data['"`][^)]*\))/;
    if (regex.test(content)) {
        hits.push({ file: rel, match: 'data' });
    }

    const regexDb = /(?:['"`][^'"`]*\/database\/[^'"`]*['"`]|path\.join\([^)]*['"`]database['"`][^)]*\))/;
    if (regexDb.test(content)) {
        hits.push({ file: rel, match: 'database' });
    }
}

console.log('Hits for data/ and database/ directory references:');
hits.forEach(h => console.log(`${h.match} -> ${h.file}`));
