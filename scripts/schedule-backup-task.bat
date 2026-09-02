@echo off
chcp 65001 > nul
cd /d "%~dp0\.."

echo =========================================================
echo   جدولة النسخ الاحتياطي التلقائي اليومي - بلدية كفرنجة
echo =========================================================
echo.

set TASK_NAME=KafrInja_Daily_Backup
set NODE_PATH=node
set SCRIPT_PATH="%~dp0prod-backup.js"

echo [+] جاري إنشاء مهمة مجدولة في نظام Windows (يومياً الساعة 11:00 مساءً)...

schtasks /create /tn "%TASK_NAME%" /tr "node \"%~dp0prod-backup.js\"" /sc daily /st 23:00 /f /ru "SYSTEM" 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [!] جاري المحاولة بصلاحيات المستخدم الحالي...
  schtasks /create /tn "%TASK_NAME%" /tr "node \"%~dp0prod-backup.js\"" /sc daily /st 23:00 /f
)

if %ERRORLEVEL% EQU 0 (
  echo.
  echo [✅] تم تسجيل مهمة النسخ الاحتياطي بنجاح!
  echo [📅] التوقيت: يومياً الساعة 23:00 (11:00 PM)
  echo [📁] مسار الحفظ: %~dp0..\backups
) else (
  echo.
  echo [❌] فشل تسجيل المهمة. يرجى تشغيل السكربت كمسؤول (Run as Administrator).
)

echo.
pause
