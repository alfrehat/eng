const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve('.');
const dataDir = path.resolve('data');
const dbDir = path.resolve('database');

function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
}

const dataFiles = getFiles(dataDir);
const databaseFiles = getFiles(dbDir);

console.log('=== DATA FILES IN data/ ===');
dataFiles.forEach(f => {
    const size = fs.statSync(path.join(dataDir, f)).size;
    console.log(`- ${f} (${size} bytes)`);
});

console.log('\n=== DATA FILES IN database/ ===');
databaseFiles.forEach(f => {
    const size = fs.statSync(path.join(dbDir, f)).size;
    console.log(`- ${f} (${size} bytes)`);
});
