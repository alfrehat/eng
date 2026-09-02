/**
 * Cross-version Windows Auto-Start Manager
 * Supports: Enable, Disable, Status
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const VBS_TARGET = path.join(SCRIPTS_DIR, 'launch-silent.vbs');

const APPDATA = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const STARTUP_DIR = path.join(APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const SHORTCUT_PATH = path.join(STARTUP_DIR, 'KafrInja_ERP_Server.lnk');
const VBS_STARTUP_PATH = path.join(STARTUP_DIR, 'KafrInja_ERP_Server.vbs');

const action = (process.argv[2] || 'status').toLowerCase();

function createShortcut() {
  const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${SHORTCUT_PATH.replace(/\\/g, '\\\\')}')
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = '"${VBS_TARGET.replace(/\\/g, '\\\\')}"'
$Shortcut.WorkingDirectory = '${ROOT_DIR.replace(/\\/g, '\\\\')}'
$Shortcut.Description = 'Kafr Inja ERP Server AutoStart'
$Shortcut.Save()
`;
  const tempPs = path.join(SCRIPTS_DIR, 'temp-create-shortcut.ps1');
  fs.writeFileSync(tempPs, psScript, 'utf8');
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs}"`, { stdio: 'pipe' });
  } finally {
    if (fs.existsSync(tempPs)) fs.unlinkSync(tempPs);
  }
}

function enable() {
  console.log('⚡ تفعيل التشغيل التلقائي لخادم نظام الأشغال...');

  // 1. Create Startup Shortcut
  try {
    createShortcut();
    console.log('✅ تم إنشاء اختصار التشغيل التلقائي في مجلد بدء تشغيل ويندوز (Startup):');
    console.log(`   ${SHORTCUT_PATH}`);
  } catch (err) {
    console.warn('⚠️ تعذر إنشاء ملف .lnk، جاري إنشاء رابط VBS بديل...');
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run "wscript.exe """ & "${VBS_TARGET.replace(/\\/g, '\\\\')}" & """", 0, False\n`;
    fs.writeFileSync(VBS_STARTUP_PATH, vbsContent, 'utf8');
    console.log(`✅ تم إنشاء ملف التشغيل التلقائي: ${VBS_STARTUP_PATH}`);
  }

  // 2. Register Scheduled Task as backup
  try {
    execSync(`schtasks /create /tn "KafrInja_ERP_Server" /tr "wscript.exe \\"${VBS_TARGET}\\"" /sc onlogon /f`, { stdio: 'pipe' });
    console.log('✅ تم تسجيل المهمة المجدولة في نظام ويندوز (Scheduled Task).');
  } catch (e) {
    // Scheduled tasks might require admin or already be handled by Startup folder
    console.log('ℹ️ تم الاكتفاء بمجلد بدء التشغيل (Startup Folder).');
  }

  // 3. Configure Firewall
  try {
    execSync('netsh advfirewall firewall add rule name="KafrInja_ERP_3005" dir=in action=allow protocol=TCP localport=3005 profile=any', { stdio: 'pipe' });
    console.log('✅ تم ضبط جدار الحماية (Firewall) للمنفذ 3005.');
  } catch (e) {
    // Ignore firewall errors
  }

  console.log('\n🎉 تم تفعيل التشغيل التلقائي بنجاح! سيعمل السيرفر تلقائياً في الخلفية عند كل تشغيل للجهاز.');
}

function disable() {
  console.log('⛔ جاري إلغاء التشغيل التلقائي...');

  let removed = false;
  if (fs.existsSync(SHORTCUT_PATH)) {
    fs.unlinkSync(SHORTCUT_PATH);
    console.log('✅ تم حذف اختصار Startup (.lnk).');
    removed = true;
  }
  if (fs.existsSync(VBS_STARTUP_PATH)) {
    fs.unlinkSync(VBS_STARTUP_PATH);
    console.log('✅ تم حذف اختصار Startup (.vbs).');
    removed = true;
  }

  try {
    execSync('schtasks /delete /tn "KafrInja_ERP_Server" /f', { stdio: 'pipe' });
    console.log('✅ تم حذف المهمة المجدولة من Task Scheduler.');
    removed = true;
  } catch (e) {}

  if (removed) {
    console.log('✅ تم إلغاء التشغيل التلقائي بنجاح.');
  } else {
    console.log('ℹ️ لم يكن التشغيل التلقائي مفعلاً مسبقاً.');
  }
}

function status() {
  const hasLnk = fs.existsSync(SHORTCUT_PATH);
  const hasVbs = fs.existsSync(VBS_STARTUP_PATH);
  let hasTask = false;

  try {
    const taskOut = execSync('schtasks /query /tn "KafrInja_ERP_Server"', { stdio: 'pipe' }).toString();
    if (taskOut.includes('KafrInja_ERP_Server')) hasTask = true;
  } catch (e) {}

  const isEnabled = hasLnk || hasVbs || hasTask;

  console.log('====================================================');
  console.log('📊 حالة التشغيل التلقائي للنظام:');
  console.log(`   • مجلد Startup: ${hasLnk || hasVbs ? '🟢 مفعّل' : '🔴 غير مفعّل'}`);
  console.log(`   • المهمة المجدولة (Task Scheduler): ${hasTask ? '🟢 مسجلة' : '⚪ غير مسجلة'}`);
  console.log(`   • الحالة العامة: ${isEnabled ? '✅ مفعّل تلقائياً عند الإقلاع' : '❌ غير مفعّل'}`);
  console.log('====================================================');
}

switch (action) {
  case 'enable':
    enable();
    break;
  case 'disable':
    disable();
    break;
  case 'status':
  default:
    status();
    break;
}
