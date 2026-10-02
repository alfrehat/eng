const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const REPORTS = path.join(ROOT, "Reports");
const SERVICES = path.join(ROOT, "services");
const SCRATCH = path.join(ROOT, "scratch");
const SERVER = path.join(ROOT, "server.js");
const REGISTRY = path.join(SERVICES, "engineRegistry.js");

const log = (...x) => console.log(...x);
const abort = m => {
  console.error("\nABORT: " + m);
  process.exit(2);
};
const exists = p => fs.existsSync(p);
const read = p => exists(p) ? fs.readFileSync(p, "utf8") : "";
const write = (p,s) => fs.writeFileSync(p,s,"utf8");

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (["node_modules",".git"].includes(e.name)) continue;
    const p = path.join(dir,e.name);
    if (e.isDirectory()) walk(p,out);
    else out.push(p);
  }
  return out;
}

function jsFiles(dir) {
  return walk(dir).filter(f => /\.(js|cjs|mjs|ts|tsx)$/.test(f));
}

function rel(p) {
  return path.relative(ROOT,p).replaceAll("\\","/");
}

function run(cmd) {
  log("\n> " + cmd);
  const r = cp.spawnSync(cmd,{
    cwd:ROOT,
    shell:true,
    encoding:"utf8",
    stdio:"pipe"
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function matches(files, regex) {
  const result=[];
  for (const f of files) {
    const s=read(f);
    if (regex.test(s)) result.push(f);
    regex.lastIndex=0;
  }
  return result;
}

function backup(file) {
  const b=file+".reports-forensic-backup";
  if (!exists(b)) fs.copyFileSync(file,b);
  return b;
}

function assertNoRuntimeDDL(files) {
  return matches(
    files,
    /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i
  );
}

log("REPORTS DOMAIN FORENSIC REMEDIATION");

if (!exists(REPORTS)) {
  abort("مجلد Reports غير موجود؛ لا يمكن تنفيذ المعالجة.");
}

log("\n1. جرد كامل لنطاق Reports");

const reportsFiles = walk(REPORTS);
const allFiles = walk(ROOT);
const reportCode = reportsFiles.filter(f => /\.(js|cjs|mjs|ts|tsx)$/.test(f));

log("عدد ملفات Reports: " + reportsFiles.length);
reportsFiles.forEach(f => log("  " + rel(f)));

log("\n2. اكتشاف جميع مكونات Reports خارج المجلد");

const candidateServices = jsFiles(SERVICES).filter(f =>
  /(report|reporting)/i.test(path.basename(f))
);

const candidateApis = allFiles.filter(f =>
  /\.(js|cjs|mjs|ts|tsx)$/.test(f) &&
  /(API|api|report|reporting)/i.test(rel(f))
);

const registry = read(REGISTRY);
const server = read(SERVER);

candidateServices.forEach(f => log("SERVICE: " + rel(f)));
candidateApis.forEach(f => log("CANDIDATE: " + rel(f)));

log("\n3. تحديد الملكية الكانونية");

const canonicalServices = candidateServices.filter(f =>
  /reportsEngineService|reportingEngineService|reportEngineService/i
    .test(path.basename(f))
);

if (canonicalServices.length === 0) {
  abort(
    "لم يتم العثور على Service كانوني موجود مسبقاً لـ Reports. " +
    "ممنوع إنشاء Service/Engine جديد تلقائياً."
  );
}

if (canonicalServices.length > 1) {
  log("تم العثور على أكثر من Service محتمل:");
  canonicalServices.forEach(f => log("  " + rel(f)));

  const primary = canonicalServices.find(f =>
    /reportsEngineService\.js$/i.test(f)
  );

  if (!primary) {
    abort(
      "تعدد ملاك محتمل لـ Reports دون إمكانية إثبات المالك الأساسي. " +
      "لن يتم الدمج أو الحذف آلياً."
    );
  }
}

const PRIMARY = canonicalServices.find(f =>
  /reportsEngineService\.js$/i.test(f)
) || canonicalServices[0];

log("PRIMARY OWNER: " + rel(PRIMARY));

const primaryText = read(PRIMARY);

if (!/module\.exports|exports\./.test(primaryText)) {
  abort("الـ Primary Service لا يملك عقد تصدير صالحاً.");
}

log("\n4. تشريح API وطبقة العرض");

const reportApis = reportCode.filter(f =>
  /API/i.test(rel(f)) ||
  /(reports|reporting).*engine/i.test(path.basename(f))
);

for (const f of reportApis) {
  const s=read(f);

  const directDb =
    /\b(dbQuery|dbGet|dbRun|pool\.query|client\.query)\b/.test(s);

  const memoryDb =
    /\b(memDb|saveMemTable|loadMemTable)\b/.test(s);

  const runtimeDDL =
    /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i.test(s);

  const hardcodedSecret =
    /(JWT_SECRET|SECRET_KEY|PRIVATE_KEY)\s*=\s*['"`][^'"`]+['"`]/i.test(s) ||
    /kfranjah-secure-pki-key/i.test(s);

  log("\nFILE: " + rel(f));
  log("  Direct DB: " + (directDb ? "FOUND" : "NONE"));
  log("  memDb: " + (memoryDb ? "FOUND" : "NONE"));
  log("  Runtime DDL: " + (runtimeDDL ? "FOUND" : "NONE"));
  log("  Hardcoded secret: " + (hardcodedSecret ? "FOUND" : "NONE"));
}

log("\n5. تحليل جميع مستهلكي Reports");

const reportConsumers = allFiles.filter(f =>
  /\.(js|cjs|mjs|ts|tsx)$/.test(f)
);

const consumerHits=[];

for (const f of reportConsumers) {
  const s=read(f);

  if (
    /reportsEngine|reportsEngineService|reportingEngine|REPORTS_ENGINE|REPORTING_ENGINE|\/api\/reports|\/api\/reporting/i.test(s)
  ) {
    consumerHits.push(f);
  }
}

[...new Set(consumerHits)].forEach(f =>
  log("CONSUMER: " + rel(f))
);

log("\n6. فحص Server Routes");

for (const m of server.matchAll(
  /app\.use\(\s*['"`]([^'"`]*(?:report|reporting)[^'"`]*)['"`]/gi
)) {
  log("ROUTE: " + m[1]);
}

log("\n7. فحص Engine Registry");

const registryMatches = [
  ...registry.matchAll(
    /['"`]([A-Z][A-Z0-9_]*(?:REPORT|REPORTING)[A-Z0-9_]*)['"`]/g
  )
].map(m=>m[1]);

if (registryMatches.length) {
  [...new Set(registryMatches)].forEach(x => log("ENGINE: " + x));
} else {
  log("لا يوجد REPORT Engine ظاهر في Registry.");
}

log("\n8. فحص التكرار بين Services");

const serviceTexts = candidateServices.map(f => ({
  file:f,
  text:read(f)
}));

for (let i=0;i<serviceTexts.length;i++) {
  for (let j=i+1;j<serviceTexts.length;j++) {
    const a=serviceTexts[i];
    const b=serviceTexts[j];

    const aFunctions=[...a.text.matchAll(
      /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/g
    )].map(x=>x[1]);

    const bFunctions=[...b.text.matchAll(
      /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/g
    )].map(x=>x[1]);

    const common=[...new Set(aFunctions.filter(x=>bFunctions.includes(x)))];

    if (common.length) {
      log(
        "DUPLICATED FUNCTIONS: " +
        rel(a.file) + " <-> " + rel(b.file)
      );
      log("  " + common.slice(0,30).join(", "));
    }
  }
}

log("\n9. إصلاح API إلى Primary Service");

for (const api of reportApis) {
  let s=read(api);

  const directPersistence =
    /\b(dbQuery|dbGet|dbRun|pool\.query|client\.query|memDb|saveMemTable|loadMemTable)\b/
      .test(s);

  if (!directPersistence) continue;

  const base=path.basename(PRIMARY,".js");

  const importsPrimary =
    new RegExp(
      `require\\(['"][^'"]*${base}['"]\\)`
    ).test(s) ||
    new RegExp(
      `from ['"][^'"]*${base}['"]`
    ).test(s);

  if (!importsPrimary) {
    log(
      "WARNING: API يحتوي وصولاً مباشراً للبيانات ولا يستورد Primary Service: " +
      rel(api)
    );
  }

  backup(api);

  log(
    "تم إثبات أن " + rel(api) +
    " يحتوي تجاوزاً يحتاج تفويضاً للـ Primary Service."
  );
  log("تم إنشاء نسخة حماية: " + rel(api) + ".reports-forensic-backup");
}

log("\n10. تنظيف المكونات المكررة — بعد إثبات الاستهلاك فقط");

const duplicateServices=candidateServices.filter(f=>f!==PRIMARY);

for (const duplicate of duplicateServices) {
  const consumers=allFiles.filter(f=>{
    if (f===duplicate) return false;
    const s=read(f);
    const base=path.basename(duplicate,".js");
    return (
      s.includes(base) ||
      s.includes(rel(duplicate)) ||
      s.includes("./"+rel(duplicate)) ||
      s.includes("../"+rel(duplicate))
    );
  });

  if (consumers.length) {
    log(
      "KEEP DUPLICATE — consumers found: " +
      rel(duplicate)
    );
    consumers.forEach(f=>log("  " + rel(f)));
    continue;
  }

  log("Potential unused candidate (no consumers): " + rel(duplicate));
}

log("\n11. فحص Persistence Architecture");

const primaryDbBypass =
  /\b(memDb|saveMemTable|loadMemTable)\b/.test(primaryText);

const primaryDDL =
  /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i
    .test(primaryText);

const allReportRuntimeDDL =
  assertNoRuntimeDDL(reportCode);

log("Primary memDb: " + (primaryDbBypass ? "FOUND" : "NONE"));
log("Primary runtime DDL: " + (primaryDDL ? "FOUND" : "NONE"));
log("Reports runtime DDL files: " + allReportRuntimeDDL.length);

log("\n12. اكتشاف الجداول الكانونية");

const sqlFiles=allFiles.filter(f=>/\.(sql|js)$/i.test(f));
const tables=new Set();

for (const f of sqlFiles) {
  const s=read(f);

  if (!/report|reporting/i.test(s)) continue;

  for (const m of s.matchAll(
    /\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi
  )) {
    const t=m[1];

    if (
      /report|reporting|analytic|statistic|dashboard/i.test(t)
    ) {
      tables.add(t);
    }
  }
}

if (tables.size) {
  [...tables].sort().forEach(t=>log("TABLE: "+t));
} else {
  log("لم يتم إثبات جدول Reports مستقل من الفحص النصي.");
}

log("\n13. فحص API/Service Contract");

const primaryExports =
  [...primaryText.matchAll(
    /(?:async\s+)?([A-Za-z_$][\w$]*)\s*:/g
  )].map(m=>m[1]);

const apiRoutes=[];

for (const f of reportApis) {
  const s=read(f);

  for (const m of s.matchAll(
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/gi
  )) {
    apiRoutes.push({
      file:rel(f),
      method:m[1].toUpperCase(),
      route:m[2]
    });
  }
}

apiRoutes.forEach(r =>
  log(
    `${r.method} ${r.route} -> ${r.file}`
  )
);

log("Primary exported operation candidates: " +
  [...new Set(primaryExports)].join(", ")
);

log("\n14. فحص Numbering / Auth / Audit / Archive / Reporting");

const crossCutting = [
  ["NUMBERING",/numberingEngine|generateNextId|NUMBERING_ENGINE/i],
  ["AUTH",/requireAuth|authMiddleware|requirePermission|RBAC/i],
  ["AUDIT",/activityEngine|recordActivity|AUDIT_LOG_ENGINE|activity_log/i],
  ["ARCHIVE",/archiveEngine|ARCHIVE_DOCUMENT_ENGINE|documents/i],
  ["REPORTING",/report|analytics|statistics|aggregation/i]
];

for (const [name,re] of crossCutting) {
  const hits=matches([PRIMARY],re);
  log(name+": "+(hits.length ? "FOUND" : "NOT PROVEN"));
}

log("\n15. حماية Migration/Schema");

const migrationFiles=allFiles.filter(f =>
  /migrations|migration/i.test(rel(f)) &&
  /\.sql$/i.test(f)
);

const reportMigrations=migrationFiles.filter(f =>
  /report|reporting/i.test(read(f))
);

reportMigrations.forEach(f=>log("MIGRATION: "+rel(f)));

log("\n16. Syntax validation");

const syntaxTargets=[
  ...reportCode,
  ...candidateServices,
  REGISTRY,
  SERVER
].filter(exists);

for (const f of syntaxTargets) {
  const st = run(`node --check "${f}"`);
  log(`Syntax check: ${rel(f)} -> ${st === 0 ? "OK" : "FAILED"}`);
}

log("\nExecution completed for inspection phase.");
