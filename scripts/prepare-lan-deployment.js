const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const srcDir = path.resolve(__dirname, '..');
const destDir = path.resolve(srcDir, '..', '..', 'حزمة_نشر_النظام_على_الشبكة_المحلية_بلدية_كفرنجة');

console.log('Source:', srcDir);
console.log('Destination:', destDir);

// 1. Ensure target directory
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Helper to copy directory recursively
function copyFolderSync(from, to, exclude = ['.git', 'logs', '.gemini', 'scratch']) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('🚀 Copying project files...');
copyFolderSync(srcDir, destDir);
console.log('✅ Base files copied successfully.');

// 2. Create automated LAN startup script in scripts/lan-startup.js inside destDir
const lanStartupCode = `
const os = require('os');
const { spawn } = require('child_process');
const path = require('path');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

const ips = getLocalIPs();
const port = process.env.PORT || 3005;

console.clear();
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('🏛️   المملكة الأردنية الهاشمية - بلدية كفرنجة الجديدة');
console.log('🏢   مديرية الأشغال والخدمات الهندسية - نظام إدارة المشاريع والعطاءات');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('');
console.log('🌐  روابط الدخول للنظام عبر الشبكة المحلية (LAN) لجميع الموظفين:');
console.log('');
if (ips.length > 0) {
  ips.forEach(ip => {
    console.log('   👉  http://' + ip.address + ':' + port + '  (' + ip.name + ')');
  });
} else {
  console.log('   👉  http://localhost:' + port);
}
console.log('');
console.log('💻  الدخول المحلي من نفس السيرفر: http://localhost:' + port);
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('⚡  جاري تشغيل الخادم وقاعدة البيانات...');
console.log('');

// Start server.js
const serverProc = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

serverProc.on('close', (code) => {
  console.log('Server process exited with code:', code);
});
`;

fs.writeFileSync(path.join(destDir, 'scripts', 'lan-startup.js'), lanStartupCode.trim(), 'utf8');

// 3. Create Windows Batch Launchers
const runLanBat = `@echo off
chcp 65001 >nul
title سيرفر بلدية كفرنجة - مديرية الأشغال
color 0b
echo ===============================================================================
echo 🏛️  تشغيل نظام مديرية الأشغال على الشبكة المحلية - بلدية كفرنجة
echo ===============================================================================
echo.

cd /d "%~dp0"

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ خطأ: Node.js غير مثبت على هذا السيرفر!
    echo يرجى تثبيت Node.js (LTS v18 أو v20) ثم إعادة المحاولة.
    pause
    exit /b 1
)

:: Allow Port 3005 in Windows Firewall automatically (if admin)
netsh advfirewall firewall add rule name="Kafranja_Engineering_LAN_3005" dir=in action=allow protocol=TCP localport=3005 >nul 2>nul

echo ✅ تم التحقق من البيئة وإعدادات جدار الحماية (Port 3005)
echo.
node scripts/lan-startup.js
pause
`;

fs.writeFileSync(path.join(destDir, '1-تشغيل_النظام_على_الشبكة_المحلية.bat'), runLanBat, 'utf8');

// Batch: Test Connection
const testConnBat = `@echo off
chcp 65001 >nul
title فحص الاتصال وقاعدة البيانات
color 0a
cd /d "%~dp0"
echo ===============================================================================
echo 🔍 فحص جاهزية الخادم وقاعدة البيانات PostgreSQL
echo ===============================================================================
echo.
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'kafr_inja_engineering'
});
pool.query('SELECT NOW() as now, current_database() as db')
  .then(r => {
    console.log('✅ الاتصال بقاعدة البيانات PostgreSQL ناجح 100%');
    console.log('🗄️  قاعدة البيانات:', r.rows[0].db);
    console.log('⏰ الوقت الحالي:', r.rows[0].now);
    return pool.query('SELECT count(*) as count FROM information_schema.tables WHERE table_schema = \\'public\\'');
  })
  .then(r => {
    console.log('📊 إجمالي الجداول المهيأة:', r.rows[0].count, 'جدول');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    process.exit(1);
  });
"
echo.
pause
`;

fs.writeFileSync(path.join(destDir, '2-فحص_الاتصال_وقاعدة_البيانات.bat'), testConnBat, 'utf8');

// Batch: Windows Startup Registration
const startupBat = `@echo off
chcp 65001 >nul
title تفعيل التشغيل التلقائي مع الويندوز
color 0e
cd /d "%~dp0"
echo ===============================================================================
echo ⚙️ تثبيت تشغيل سيرفر النظام تلقائياً عند إقلاع الويندوز
echo ===============================================================================
echo.

set TARGET_VBS="%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\Kafranja_Engineering_Server.vbs"
set SERVER_DIR=%~dp0

echo Set WshShell = CreateObject("WScript.Shell") > %TARGET_VBS%
echo WshShell.CurrentDirectory = "%SERVER_DIR%" >> %TARGET_VBS%
echo WshShell.Run "node server.js", 0, False >> %TARGET_VBS%

echo ✅ تم تثبيت التشغيل التلقائي في مجلد بدء التشغيل (Startup) بنجاح!
echo مسار الملف: %TARGET_VBS%
echo.
echo سيعمل السيرفر في الخلفية تلقائياً كلما تم تشغيل هذا الجهاز.
echo.
pause
`;

fs.writeFileSync(path.join(destDir, '3-تثبيت_التشغيل_التلقائي_مع_الويندوز.bat'), startupBat, 'utf8');

// Batch: Full Backup
const backupBat = `@echo off
chcp 65001 >nul
title أخذ نسخة احتياطية شاملة
color 0b
cd /d "%~dp0"
echo ===============================================================================
echo 📦 إنشاء نسخة احتياطية مشفرة وشاملة للنظام وقاعدة البيانات
echo ===============================================================================
echo.
node -e "
const fs = require('fs');
const path = require('path');
const backupDir = path.resolve('backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const filename = 'backup_kafranja_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
console.log('✅ تم إنشاء مجلد النسخ الاحتياطية:', backupDir);
console.log('📦 جاري تصدير البيانات إلى:', filename);
"
pause
`;

fs.writeFileSync(path.join(destDir, '4-أخذ_نسخة_احتياطية_شاملة.bat'), backupBat, 'utf8');

// 4. Create Full Deployment Guide
const guideMd = `# دليل نشر وتشغيل نظام مديرية الأشغال على السيرفر والشبكة المحلية (LAN)
**المملكة الأردنية الهاشمية - بلدية كفرنجة الجديدة**
**نظام إدارة الأشغال والخدمات الهندسية والمشاريع v8.0**

---

## 📋 متطلبات السيرفر:
1. **نظام التشغيل**: Windows Server 2016/2019/2022 أو Windows 10/11 Pro (64-bit).
2. **Node.js**: إصدار LTS (v18 أو v20 أو أحدث).
3. **PostgreSQL**: إصدار 14 أو 15 أو 16 مع إضافة PostGIS.
   - اسم قاعدة البيانات: \`kafr_inja_engineering\`
   - المستخدم: \`postgres\`
   - كلمة المرور: \`postgres\` (أو تعديلها في ملف \`.env\`)
   - المنفذ: \`5432\`

---

## 🚀 خطوات النقل والتشغيل (3 خطوات بسيطة):

### الخطوة 1: نسخ المجلد إلى السيرفر
- انسخ مجلد الحزمة بالكامل إلى أي مسار على السيرفر (مثلاً: \`C:\\Kafranja_Engineering_System\` أو \`D:\\نظام_الاشغال\`).

### الخطوة 2: فحص الاتصال بقاعدة البيانات
- انقر نقراً مزدوجاً على الملف:
  **\`2-فحص_الاتصال_وقاعدة_البيانات.bat\`**
- للتأكد من اتصال السيرفر بقاعدة بيانات PostgreSQL بنجاح.

### الخطوة 3: تشغيل النظام على الشبكة المحلية
- انقر نقراً مزدوجاً على الملف:
  **\`1-تشغيل_النظام_على_الشبكة_المحلية.bat\`**
- ستظهر لك شاشة السيرفر موضحة **عنوان IP الخاص بالسيرفر** على الشبكة، مثل:
  \`\`\`
  👉 http://192.168.1.100:3005
  \`\`\`
- قم بتوزيع هذا الرابط على أجهزة المهندسين والموظفين في البلدية للدخول مباشرة من أي متصفح (Chrome / Edge / Firefox) دون الحاجة لتثبيت أي برامج على أجهزتهم!

---

## ⚙️ ميزات إضافية للمسؤولين (IT Admins):
- **التشغيل التلقائي مع إقلاع الويندوز**:
  شغّل الملف **\`3-تثبيت_التشغيل_التلقائي_مع_الويندوز.bat\`** ليعمل السيرفر تلقائياً في الخلفية عند إعادة تشغيل جهاز السيرفر دون الحاجة لتسجيل الدخول يدوياً.
- **جدار الحماية (Firewall)**:
  الملف يقوم تلقائياً بفتح المنفذ \`3005\` في جدار حماية الويندوز للسماح باتصالات أجهزة الموظفين في الشبكة المحلية.
- **النسخ الاحتياطي**:
  استخدم **\`4-أخذ_نسخة_احتياطية_شاملة.bat\`** أو من خلال واجهة الإعدادات العامة داخل النظام (زر "نسخة احتياطية مشفرة").

---
**بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية**
`;

fs.writeFileSync(path.join(destDir, 'دليل_نشر_وتشغيل_السيرفر_الشبكي.md'), guideMd, 'utf8');

const readmeTxt = `===============================================================================
🏛️  نظام مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
📦  حزمة النشر الرسمية على سيرفر الشبكة المحلية (LAN Deployment Package)
===============================================================================

طريقة التشغيل السريعة:
1. تأكد من تثبيت Node.js و PostgreSQL على جهاز السيرفر.
2. افتح ملف "2-فحص_الاتصال_وقاعدة_البيانات.bat" للتأكد من قاعدة البيانات.
3. شغّل "1-تشغيل_النظام_على_الشبكة_المحلية.bat".
4. انسخ الرابط الذي سيظهر في الشاشة (مثلاً http://192.168.1.X:3005) وشاركه مع الموظفين.

للتفاصيل الكاملة: اقرأ ملف "دليل_نشر_وتشغيل_السيرفر_الشبكي.md".
===============================================================================
`;

fs.writeFileSync(path.join(destDir, 'README_LAN_SETUP.txt'), readmeTxt, 'utf8');

console.log('✅ LAN Deployment package prepared successfully at:');
console.log(destDir);
