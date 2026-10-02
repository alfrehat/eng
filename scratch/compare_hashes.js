const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.resolve('data');
const dbDir = path.resolve('database');

const files = fs.readdirSync(dataDir);

let identical = 0;
let different = 0;
let missing = 0;

for (const f of files) {
    const dataPath = path.join(dataDir, f);
    const dbPath = path.join(dbDir, f);

    if (!fs.existsSync(dbPath)) {
        console.log(`MISSING in database/: ${f}`);
        missing++;
        continue;
    }

    const dataHash = crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex');
    const dbHash = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');

    if (dataHash === dbHash) {
        identical++;
    } else {
        console.log(`DIFFERENT: ${f} (data: ${dataHash.slice(0,8)} vs db: ${dbHash.slice(0,8)})`);
        different++;
    }
}

console.log(`\nComparison Summary for data/ files:`);
console.log(`Identical: ${identical}`);
console.log(`Different: ${different}`);
console.log(`Missing in database/: ${missing}`);
