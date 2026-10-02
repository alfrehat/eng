const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('.');
const skipDirs = ['node_modules', '.git', 'coverage', '.system_generated', 'dist', 'scratch', 'migrations'];

function walk(dir) {
    let results = [];
    for (const f of fs.readdirSync(dir)) {
        if (skipDirs.includes(f)) continue;
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(walk(full));
        } else if (f.endsWith('.js')) {
            results.push(full);
        }
    }
    return results;
}

const files = walk(rootDir);
const ddlHits = [];

const ddlPattern = /\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+INDEX|DROP\s+INDEX|ALTER\s+COLUMN)\b/i;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (ddlPattern.test(line)) {
            // Check if comment
            const trimmed = line.trim();
            if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
                ddlHits.push({
                    file: path.relative(rootDir, file).replace(/\\/g, '/'),
                    line: idx + 1,
                    code: trimmed
                });
            }
        }
    });
}

console.log(`Total runtime DDL hits: ${ddlHits.length}`);
ddlHits.forEach(h => console.log(`${h.file}:${h.line} -> ${h.code}`));
