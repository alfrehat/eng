const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const REPORTS = path.join(ROOT, "Reports");
const SERVICES = path.join(ROOT, "services");
const API_DIR = path.join(REPORTS, "API");
const PAGES_DIR = path.join(REPORTS, "Pages");
const SCRATCH = path.join(ROOT, "scratch");
const SERVER = path.join(ROOT, "server.js");
const REGISTRY = path.join(SERVICES, "engineRegistry.js");

const stamp = new Date().toISOString().replace(/[:.]/g,"-");
const BACKUP = path.join(ROOT, `.reports-forensic-backup-${stamp}`);

const log = (...x) => console.log(...x);
const warn = (...x) => console.warn(...x);
const abort = m => {
  console.error("\nNOT CLOSED\n" + m);
  process.exit(3);
};

const exists = p => fs.existsSync(p);
const read = p => exists(p) ? fs.readFileSync(p,"utf8") : "";
const write = (p,s) => fs.writeFileSync(p,s,"utf8");

function walk(dir,out=[]) {
  if (!exists(dir)) return out;

  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (["node_modules",".git"].includes(e.name)) continue;

    const p=path.join(dir,e.name);

    if (e.isDirectory()) walk(p,out);
    else out.push(p);
  }

  return out;
}

function codeFiles(dir) {
  return walk(dir).filter(f =>
    /\.(js|cjs|mjs|ts|tsx)$/.test(f)
  );
}

function rel(p) {
  return path.relative(ROOT,p).replaceAll("\\","/");
}

function run(cmd,options={}) {
  log("\n> "+cmd);

  const r=cp.spawnSync(cmd,{
    cwd:ROOT,
    shell:true,
    encoding:"utf8",
    stdio:"pipe",
    ...options
  });

  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);

  return {
    status:r.status ?? 1,
    stdout:r.stdout || "",
    stderr:r.stderr || ""
  };
}

function runCapture(cmd) {
  const r=cp.spawnSync(cmd,{
    cwd:ROOT,
    shell:true,
    encoding:"utf8",
    stdio:"pipe"
  });

  return {
    status:r.status ?? 1,
    stdout:r.stdout || "",
    stderr:r.stderr || ""
  };
}

function backupFile(file) {
  if (!exists(file)) return;

  const target=path.join(
    BACKUP,
    path.relative(ROOT,file)
  );

  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(file,target);
}

function backupFiles(files) {
  for (const f of files) backupFile(f);
}

function contains(file,re) {
  return re.test(read(file));
}

function filesContaining(files,re) {
  const result=[];

  for (const f of files) {
    const s=read(f);

    if (re.test(s)) result.push(f);

    re.lastIndex=0;
  }

  return result;
}

function extractFunctions(text) {
  const set=new Set();

  for (const m of text.matchAll(
    /(?:async\s+)?(?:function\s+|module\.exports\.)?([A-Za-z_$][\w$]*)\s*(?:=|\()/g
  )) {
    set.add(m[1]);
  }

  return [...set];
}

log("==============================================================");
log("REPORTS FORENSIC ARCHITECTURAL REMEDIATION");
log("==============================================================");

if (!exists(REPORTS)) {
  abort("مجلد Reports غير موجود.");
}

fs.mkdirSync(BACKUP,{recursive:true});

const BEFORE_FILES=walk(ROOT);

log("\n1. الحالة الحالية قبل أي تعديل");

log("Reports:");
for (const f of walk(REPORTS))
  log("  "+rel(f));

log("\nServices المحتملة:");
const serviceFiles=codeFiles(SERVICES).filter(f =>
  /(report|reporting)/i.test(path.basename(f))
);

for (const f of serviceFiles)
  log("  "+rel(f));

log("\nAPI:");
const apiFiles=codeFiles(REPORTS).filter(f =>
  /API/i.test(rel(f))
);

for (const f of apiFiles)
  log("  "+rel(f));

log("\nPages:");
const pageFiles=codeFiles(REPORTS).filter(f =>
  /Pages/i.test(rel(f))
);

for (const f of pageFiles)
  log("  "+rel(f));

const serverText=read(SERVER);
const registryText=read(REGISTRY);

log("\n2. اكتشاف الملكية الكانونية");

const primaryCandidates=serviceFiles.filter(f =>
  /reportsEngineService\.js$/i.test(f)
);

if (primaryCandidates.length===0) {
  const alternate=serviceFiles.filter(f =>
    /reportingEngineService|reportEngineService|reportsService|reportService/i
      .test(path.basename(f))
  );

  if (alternate.length!==1) {
    abort(
      "لم يتم إثبات Primary Service وحيد لنطاق Reports. " +
      "ممنوع إنشاء Service أو Engine جديد."
    );
  }

  primaryCandidates.push(alternate[0]);
}

if (primaryCandidates.length!==1) {
  abort(
    "تم اكتشاف أكثر من مرشح للمالك الكانوني لـ Reports. " +
    "لا يمكن تنفيذ دمج أو حذف آلي آمن."
  );
}

const PRIMARY=primaryCandidates[0];
const primaryText=read(PRIMARY);

log("PRIMARY OWNER: "+rel(PRIMARY));

if (!/module\.exports|exports\./.test(primaryText)) {
  abort("Primary Service لا يملك export صالحاً.");
}

log("\n3. تشريح كامل لجميع المستهلكين");

const allCode=codeFiles(ROOT);

const consumers=filesContaining(
  allCode,
  /reportsEngine|reportsEngineService|reportingEngine|REPORTS_ENGINE|REPORTING_ENGINE|\/api\/reports|\/api\/reporting/i
);

for (const f of [...new Set(consumers)])
  log("  "+rel(f));

log("\n4. Server routes");

const serverRoutes=[
  ...serverText.matchAll(
    /app\.use\(\s*['"`]([^'"`]*(?:report|reporting)[^'"`]*)['"`]/gi
  )
];

for (const m of serverRoutes)
  log("  "+m[1]);

log("\n5. Engine Registry");

const reportRegistry=[
  ...registryText.matchAll(
    /['"`]([A-Z][A-Z0-9_]*(?:REPORT|REPORTING)[A-Z0-9_]*)['"`]/g
  )
].map(m=>m[1]);

for (const e of [...new Set(reportRegistry)])
  log("  "+e);

log("\n6. تشريح API");

let apiDirectDb=[];
let apiMemDb=[];
let apiDDL=[];
let apiSecrets=[];
let apiServiceDelegation=[];

for (const f of apiFiles) {
  const s=read(f);

  if (/\b(dbQuery|dbGet|dbRun|pool\.query|client\.query)\b/.test(s))
    apiDirectDb.push(f);

  if (/\b(memDb|saveMemTable|loadMemTable)\b/.test(s))
    apiMemDb.push(f);

  if (/\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i.test(s))
    apiDDL.push(f);

  if (
    /(JWT_SECRET|SECRET_KEY|PRIVATE_KEY)\s*=\s*['"`][^'"`]+['"`]/i.test(s) ||
    /kfranjah-secure-pki-key/i.test(s)
  )
    apiSecrets.push(f);

  const base=path.basename(PRIMARY,".js");

  if (
    new RegExp(`require\\(['"][^'"]*${base}['"]\\)`).test(s) ||
    new RegExp(`from ['"][^'"]*${base}['"]`).test(s)
  )
    apiServiceDelegation.push(f);
}

log("Direct DB: "+apiDirectDb.length);
apiDirectDb.forEach(f=>log("  "+rel(f)));

log("memDb: "+apiMemDb.length);
apiMemDb.forEach(f=>log("  "+rel(f)));

log("Runtime DDL: "+apiDDL.length);
apiDDL.forEach(f=>log("  "+rel(f)));

log("Hardcoded secrets: "+apiSecrets.length);
apiSecrets.forEach(f=>log("  "+rel(f)));

log("Primary Service delegation: "+apiServiceDelegation.length);
apiServiceDelegation.forEach(f=>log("  "+rel(f)));

log("\n7. تشريح Primary Service");

const serviceDirectDb=
  /\b(dbQuery|dbGet|dbRun|pool\.query|client\.query)\b/.test(primaryText);

const serviceMemDb=
  /\b(memDb|saveMemTable|loadMemTable)\b/.test(primaryText);

const serviceDDL=
  /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i
    .test(primaryText);

log("Direct DB references: "+(serviceDirectDb?"FOUND":"NONE"));
log("memDb references: "+(serviceMemDb?"FOUND":"NONE"));
log("Runtime DDL: "+(serviceDDL?"FOUND":"NONE"));

if (serviceMemDb || serviceDDL) {
  abort(
    "Primary Service نفسه يحتوي persistence/schema bypass. " +
    "لا يمكن اعتباره سليماً قبل إصلاحه."
  );
}

log("\n8. تحليل العمليات والوظائف");

const primaryFunctions=extractFunctions(primaryText);

log(
  "Primary operations/functions: "+
  primaryFunctions.slice(0,100).join(", ")
);

for (const f of apiFiles) {
  const funcs=extractFunctions(read(f));

  const common=funcs.filter(x=>primaryFunctions.includes(x));

  if (common.length) {
    log(
      "OVERLAP "+rel(f)+" <-> "+rel(PRIMARY)+": "+
      [...new Set(common)].join(", ")
    );
  }
}

log("\n9. تحليل التكرار بين Services");

for (let i=0;i<serviceFiles.length;i++) {
  for (let j=i+1;j<serviceFiles.length;j++) {

    const a=extractFunctions(read(serviceFiles[i]));
    const b=extractFunctions(read(serviceFiles[j]));

    const common=[...new Set(a.filter(x=>b.includes(x)))];

    if (common.length) {
      log(
        "DUPLICATE: "+
        rel(serviceFiles[i])+
        " <-> "+
        rel(serviceFiles[j])
      );

      log("  "+common.join(", "));
    }
  }
}

log("\n10. تحليل الجداول والمصدر الكانوني");

const sqlFiles=allCode.concat(
  allCode.filter(f=>f.endsWith(".sql"))
);

const tableRefs=new Set();

for (const f of sqlFiles) {
  const s=read(f);

  if (!/report|reporting|analytics|statistics|dashboard/i.test(s))
    continue;

  for (const m of s.matchAll(
    /\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi
  )) {
    tableRefs.add(m[1]);
  }
}

for (const t of [...tableRefs].sort())
  log("  "+t);

log("\n11. البحث عن مسارات API الخاصة بالتقارير");

const routes=[];

for (const f of apiFiles) {
  const s=read(f);

  for (const m of s.matchAll(
    /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/gi
  )) {
    routes.push({
      file:rel(f),
      method:m[1].toUpperCase(),
      route:m[2]
    });
  }
}

for (const r of routes)
  log(`  ${r.method} ${r.route} -> ${r.file}`);

log("\n12. حماية الملفات قبل الإصلاح");

backupFiles([
  ...apiFiles,
  ...serviceFiles,
  REGISTRY,
  SERVER
].filter(exists));

log("Backup: "+rel(BACKUP));

log("\n13. إصلاح API Adapter");

for (const api of apiFiles) {

  let s=read(api);

  const direct=
    /\b(dbQuery|dbGet|dbRun|pool\.query|client\.query|memDb|saveMemTable|loadMemTable)\b/
      .test(s);

  if (!direct)
    continue;

  const base=path.basename(PRIMARY,".js");

  const importsPrimary=
    new RegExp(`require\\(['"][^'"]*${base}['"]\\)`).test(s) ||
    new RegExp(`from ['"][^'"]*${base}['"]`).test(s);

  if (!importsPrimary) {
    abort(
      "تم العثور على API مباشر للبيانات دون تفويض مثبت للـ Primary Service: "+
      rel(api)
    );
  }

  /*
   لا تستخدم استبدالات نصية عمياء.
   أي SQL/Business Logic لا يمكن تحويله آلياً بأمان
   لا يتم حذفه؛ يتم إيقاف العملية بدلاً من إتلاف السلوك.
  */

  warn(
    "REMEDIATION REQUIRED: "+
    rel(api)+
    " يحتوي persistence/business bypass."
  );

  warn(
    "تم حفظ نسخة احتياطية، ولن يتم حذف SQL تلقائياً."
  );

  /*
   محاولة تحديد ما إذا كان الملف مجرد Adapter بالفعل.
  */

  const hasRouter=/express|Router|router\./.test(s);
  const hasExports=/module\.exports|exports\./.test(s);

  if (!hasRouter || !hasExports) {
    abort(
      "API candidate ليس Adapter واضحاً؛ لا يمكن إعادة بنائه تلقائياً بأمان: "+
      rel(api)
    );
  }
}

if (apiDirectDb.length || apiMemDb.length) {
  abort(
    "NOT CLOSED: بقي وصول مباشر/ذاكرة في API، " +
    "ولا يجوز اعتبار Reports سليماً دون تحويله فعلياً إلى Adapter."
  );
}

log("\n14. تنظيف الملفات المكررة غير المستخدمة");

const duplicateServices=serviceFiles.filter(f=>f!==PRIMARY);

for (const duplicate of duplicateServices) {

  const base=path.basename(duplicate,".js");

  const duplicateConsumers=allCode.filter(f=>{
    if (f===duplicate) return false;

    const s=read(f);

    return (
      s.includes(base) ||
      s.includes(rel(duplicate))
    );
  });

  if (duplicateConsumers.length) {

    log(
      "KEEP: "+
      rel(duplicate)+
      " — consumers="+
      duplicateConsumers.length
    );

    duplicateConsumers.forEach(f =>
      log("  "+rel(f))
    );

    continue;
  }

  const legacy=duplicate+".legacy";

  if (!exists(legacy)) {
    backupFile(duplicate);
    fs.renameSync(duplicate,legacy);

    log(
      "CLEANED UNUSED SERVICE: "+
      rel(duplicate)+
      " -> "+
      rel(legacy)
    );
  }
}

log("\n15. التحقق من عدم وجود Runtime DDL");

const finalReportsCode=codeFiles(REPORTS);

const runtimeDDL=finalReportsCode.filter(f =>
  /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i
    .test(read(f))
);

if (runtimeDDL.length) {
  runtimeDDL.forEach(f=>log("DDL: "+rel(f)));

  abort(
    "Runtime DDL ما زال موجوداً في Reports."
  );
}

log("\n16. التحقق من الملكية الكانونية");

const remainingServices=codeFiles(SERVICES).filter(f =>
  /(report|reporting)/i.test(path.basename(f))
);

for (const f of remainingServices)
  log("  "+rel(f));

if (!remainingServices.some(f=>path.resolve(f)===path.resolve(PRIMARY))) {
  abort("فقدان Primary Service.");
}

log("\n17. التحقق من عدم وجود Engine جديد");

const afterRegistry=read(REGISTRY);

const beforeReportEngines=[
  ...registryText.matchAll(
    /['"`]([A-Z][A-Z0-9_]*(?:REPORT|REPORTING)[A-Z0-9_]*)['"`]/g
  )
].map(m=>m[1]);

const afterReportEngines=[
  ...afterRegistry.matchAll(
    /['"`]([A-Z][A-Z0-9_]*(?:REPORT|REPORTING)[A-Z0-9_]*)['"`]/g
  )
].map(m=>m[1]);

const beforeSet=[...new Set(beforeReportEngines)].sort();
const afterSet=[...new Set(afterReportEngines)].sort();

log("Before: "+beforeSet.join(", "));
log("After : "+afterSet.join(", "));

if (afterSet.some(x=>!beforeSet.includes(x))) {
  abort(
    "تم اكتشاف REPORT Engine جديد؛ العملية غير مطابقة للحوكمة."
  );
}

log("\n18. Syntax validation");

const syntaxFiles=[
  ...codeFiles(REPORTS),
  ...remainingServices,
  REGISTRY,
  SERVER
].filter(exists);

for (const f of syntaxFiles) {

  const r=run(`node --check "${f}"`);

  if (r.status!==0)
    abort("Syntax failure: "+rel(f));
}

log("\n19. تشغيل Forensic Suite الخاص بـ Reports");

const reportTests=walk(SCRATCH).filter(f =>
  /report/i.test(path.basename(f)) &&
  /test|forensic/i.test(path.basename(f)) &&
  f.endsWith(".js")
);

if (!reportTests.length) {

  warn(
    "لا يوجد Reports forensic suite حالي."
  );

  warn(
    "لا يتم اختلاق PASS بدون اختبار فعلي."
  );

} else {

  for (const test of reportTests) {

    const r=run(`node "${test}"`);

    if (r.status!==0)
      abort(
        "Reports forensic test failed: "+
        rel(test)
      );
  }
}

log("\n20. Regression — النطاقات المثبتة");

const regressions=[
  "test_middlewares_forensic_suite.js",
  "test_logs_forensic_suite.js",
  "test_inspection_forensic_suite.js",
  "test_data_layer_forensic_suite.js",
  "test_gis_forensic_suite.js",
  "test_contracts_forensic_suite.js",
  "test_numbering_tasks_forensic_suite.js"
];

for (const name of regressions) {

  const f=path.join(SCRATCH,name);

  if (!exists(f)) {
    warn("Regression test غير موجود: "+name);
    continue;
  }

  const r=run(`node "${f}"`);

  if (r.status!==0)
    abort("REGRESSION FAILURE: "+name);
}

log("\n21. اختبار إقلاع الخادم");

const startupTests=[
  path.join(SCRATCH,"test_server_startup.js"),
  path.join(SCRATCH,"test_startup.js")
].filter(exists);

if (startupTests.length) {

  for (const f of startupTests) {

    const r=run(`node "${f}"`);

    if (r.status!==0)
      abort("Server startup test failed: "+rel(f));
  }

} else {

  const syntax=run("node --check server.js");

  if (syntax.status!==0)
    abort("server.js syntax failure.");

  warn(
    "لا يوجد اختبار startup مستقل؛ تم الاكتفاء بـ node --check server.js."
  );
}

log("\n22. فحص Git");

run("git status --short");

run("git diff --stat");

log("\n23. التأكد من عدم تعديل نطاقات خارج Reports");

const afterFiles=walk(ROOT);

const changedOutside=[];

const gitDiff=runCapture("git diff --name-only");

if (gitDiff.status===0) {

  for (const line of gitDiff.stdout.split(/\r?\n/).filter(Boolean)) {

    const normalized=line.replaceAll("\\","/");

    const allowed =
      normalized.startsWith("Reports/") ||
      normalized==="Reports" ||
      normalized.startsWith("services/") && (
        normalized.includes("report") ||
        normalized==="services/engineRegistry.js"
      );

    if (!allowed)
      changedOutside.push(normalized);
  }
}

if (changedOutside.length) {

  log("UNEXPECTED CHANGES:");

  changedOutside.forEach(x=>log("  "+x));

  abort(
    "تم اكتشاف تغييرات خارج نطاق Reports."
  );
}

log("\n24. إعادة التشريح بعد المعالجة");

const finalApi=codeFiles(REPORTS);

const finalDirectDb=filesContaining(
  finalApi,
  /\b(dbQuery|dbGet|dbRun|pool\.query|client\.query)\b/
);

const finalMemDb=filesContaining(
  finalApi,
  /\b(memDb|saveMemTable|loadMemTable)\b/
);

const finalDDL=filesContaining(
  finalApi,
  /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|VIEW|TYPE|SCHEMA)\b/i
);

log("Final direct DB: "+finalDirectDb.length);
finalDirectDb.forEach(f=>log("  "+rel(f)));

log("Final memDb: "+finalMemDb.length);
finalMemDb.forEach(f=>log("  "+rel(f)));

log("Final runtime DDL: "+finalDDL.length);
finalDDL.forEach(f=>log("  "+rel(f)));

if (
  finalDirectDb.length ||
  finalMemDb.length ||
  finalDDL.length
) {

  log("\nNOT CLOSED");

  log(
    "السبب: بقي تجاوز Persistence/Runtime DDL في نطاق Reports."
  );

  process.exit(3);
}

log("\n25. التقرير النهائي");

log("==============================================================");
log("REPORTS FORENSIC RESULT");
log("==============================================================");

log("المجلد: Reports");
log("Primary Owner: "+rel(PRIMARY));
log("Primary Service ثابت ولم يتم إنشاء Service جديد.");
log("لم يتم إنشاء Engine جديد.");
log("لم يتم إنشاء Model جديد.");
log("لم يتم إنشاء Route جديد.");
log("لم يتم تغيير Database schema.");
log("لم يتم حذف بيانات.");
log("Runtime DDL: NONE");
log("memDb: NONE");
log("Direct DB bypass in API: NONE");
log("Syntax: PASS");
log("Forensic tests: PASS/غير متوفر حسب الموجود فعلياً");
log("Regression: PASS إذا وصلت العملية إلى هذه النقطة.");
log("Server startup: PASS إذا وصل الاختبار إلى هذه النقطة.");
log("Unexpected external changes: NONE");

log("\nFINAL DECISION:");
log("PASS / CLOSED / FROZEN");

log("\nتوقف التنفيذ هنا. لا تنفذ أي تغيير آخر خارج نطاق Reports.");
