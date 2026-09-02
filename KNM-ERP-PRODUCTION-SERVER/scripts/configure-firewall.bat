@echo off
chcp 65001 > nul

echo =========================================================
echo   تهيئة جدار الحماية (Windows Firewall) للمنفذ 3005
echo =========================================================
echo.

echo [+] إضافة قاعدة السماح بالاتصال الداخلي على المنفذ 3005...
netsh advfirewall firewall delete rule name="KafrInja_ERP_3005" >nul 2>&1
netsh advfirewall firewall add rule name="KafrInja_ERP_3005" dir=in action=allow protocol=TCP localport=3005 profile=any description="Allow incoming LAN access to Kafr Inja Engineering ERP system on port 3005"

if %ERRORLEVEL% EQU 0 (
  echo [✅] تم فتح المنفذ 3005 بنجاح في جدار حماية Windows.
  echo [ℹ️] يمكن للأجهزة على الشبكة المحلية (LAN) الوصول للنظام الآن.
) else (
  echo [❌] يرجى تشغيل هذا الملف كمسؤول (Run as Administrator) لتطبيق إعدادات جدار الحماية.
)

echo.
pause
