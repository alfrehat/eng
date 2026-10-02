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
        } else if (f.endsWith('.js') || f.endsWith('.html')) {
            results.push(full);
        }
    }
    return results;
}

const files = walk(rootDir);

const unifiedGisConsumers = [];
const postgisQueries = [];
const gisEndpoints = [];

for (const f of files) {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    const content = fs.readFileSync(f, 'utf8');

    if (content.includes('UnifiedGisEngine') || content.includes('createUnifiedMap') || content.includes('unifiedGisEngine.js')) {
        unifiedGisConsumers.push(rel);
    }

    if (/ST_AsGeoJSON|ST_GeomFromGeoJSON|ST_SetSRID|ST_MakePoint|ST_Intersects|ST_Within|ST_DWithin|ST_Distance/i.test(content)) {
        const lines = content.split('\n');
        lines.forEach((l, idx) => {
            if (/ST_[a-zA-Z]+/i.test(l)) {
                postgisQueries.push({ file: rel, line: idx + 1, code: l.trim() });
            }
        });
    }

    if (content.includes('/api/gis') || content.includes('/api/spatial') || content.includes('/api/map') || content.includes('/api/roads/spatial') || content.includes('/api/g2g/spatial')) {
        gisEndpoints.push(rel);
    }
}

console.log(`unifiedGisEngine consumers (${unifiedGisConsumers.length}):`);
unifiedGisConsumers.forEach(c => console.log(' - ' + c));

console.log(`\nPostGIS queries in code (${postgisQueries.length}):`);
postgisQueries.slice(0, 30).forEach(q => console.log(` ${q.file}:${q.line} -> ${q.code.substring(0, 100)}`));

console.log(`\nFiles referencing GIS endpoints (${gisEndpoints.length}):`);
gisEndpoints.forEach(e => console.log(' - ' + e));
