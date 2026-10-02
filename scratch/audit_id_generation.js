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
        } else if (f.endsWith('.js')) {
            results.push(full);
        }
    }
    return results;
}

const files = walk(rootDir);
const idIssues = [];

const pattern = /(?:id\s*[:=]\s*(?:['"`][^'"`]*\$\{Date\.now\(\)\}|Date\.now\(\)|Math\.random\(\)|Math\.floor\(Math\.random\(\)\)))/i;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (pattern.test(line)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
                idIssues.push({
                    file: path.relative(rootDir, file).replace(/\\/g, '/'),
                    line: idx + 1,
                    code: trimmed
                });
            }
        }
    });
}

console.log(`Potential manual ID generation lines: ${idIssues.length}`);
idIssues.forEach(i => console.log(`${i.file}:${i.line} -> ${i.code.substring(0, 100)}`));
