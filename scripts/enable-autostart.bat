@echo off
chcp 65001 > nul
cd /d "%~dp0\.."

node scripts\manage-autostart.js enable

echo.
echo -------------------------------------------------------------------
echo 🌐 يمكنك الوصول للنظام عبر الرابط: http://localhost:3005
echo -------------------------------------------------------------------
echo.
pause
