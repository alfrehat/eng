const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');
const apiFiles = [
    'server.js',
    'Roads/API/roadsEngine.js',
    'PavementReturns/API/pavingReturns.js',
    'services/roadsEngineService.js',
    'services/specializedAssetsEngine.js',
    'services/g2gGatewayEngineService.js',
    'Roads/Services/index.js',
    'Roads/Assets/index.js',
    'Roads/Segments/index.js'
];

console.log('=== INSPECTING GIS / SPATIAL APIS & SERVICES ===');

for (const rel of apiFiles) {
    const full = path.join(rootDir, rel);
    if (!fs.existsSync(full)) {
        console.log(`[NOT FOUND] ${rel}`);
        continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    const routes = [];

    lines.forEach((l, idx) => {
        if (l.match(/(?:app|router)\.(get|post|put|delete|patch)\s*\(/i)) {
            routes.push({ line: idx + 1, code: l.trim() });
        }
    });

    console.log(`\n${rel} has ${routes.length} routes:`);
    routes.forEach(r => console.log(`  L${r.line}: ${r.code}`));
}
