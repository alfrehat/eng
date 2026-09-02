@echo off
chcp 65001 > nul
cd /d "%~dp0\.."

echo =========================================================
echo   تثبيت التشغيل التلقائي للخدمة (Windows Auto-Start Service)
echo   نظام إدارة الأشغال - بلدية كفرنجة
echo =========================================================
echo.

set TASK_NAME=KafrInja_ERP_Server
set VBS_PATH="%~dp0run-silent.vbs"

:: إنشاء سكربت VBS للتشغيل بالخلفية بدون نافذة سوداء
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%~dp0.."
echo WshShell.Run "node server.js", 0, False
) > "%~dp0run-silent.vbs"

echo [+] جاري تسجيل خدمة التشغيل التلقائي عند بدء تشغيل الجهاز (On System Startup)...

schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%~dp0run-silent.vbs\"" /sc onstart /ru "SYSTEM" /f 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [!] جاري المحاولة على مستوى بدء تسجيل الدخول (On User Logon)...
  schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%~dp0run-silent.vbs\"" /sc onlogon /f
)

if %ERRORLEVEL% EQU 0 (
  echo.
  echo [✅] تم تثبيت التشغيل التلقائي بنجاح!
  echo [ℹ️] سيعمل السيرفر تلقائياً في الخلفية فور إقلاع الجهاز.
) else (
  echo.
  echo [❌] يرجى تشغيل الملف كمسؤول (Run as Administrator) لتثبيت الخدمة التلقائية.
)

echo.
pause
