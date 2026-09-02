# 📖 دليل وإجراءات التشغيل على الشبكة المحلية (LAN Deployment Runbook)
## بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية
### Enterprise Directorate Management System — Operation & Runbook Guide

---

### 1. خطوات التشغيل السريع للخادم (Quick Start on LAN)
1. **تهيئة البيئة والتأكد من تثبيت Node.js (v18+) و PostgreSQL (v15+)**.
2. **نسخ ملف الإعدادات البيئية**:
   ```powershell
   Copy-Item .env.example .env
   ```
3. **تعديل إعدادات الاتصال في `.env`**:
   - تعيين `HOST=0.0.0.0`
   - تعيين `PORT=3005`
   - تعيين كلمة مرور قاعدة بيانات PostgreSQL في `DB_PASSWORD`.
4. **بدء تشغيل الخادم المؤسسي**:
   ```powershell
   node server.js
   ```
   أو باستخدام مدير العمليات الدائمة (PM2):
   ```powershell
   pm2 start server.js --name "kafranjah-eng-lan"
   ```

---

### 2. إعداد قاعدة جدار الحماية (Windows Firewall Rule)
للسماح لأجهزة المهندسين بالوصول عبر الشبكة المحلية، قم بتشغيل الأمر التالي في PowerShell بصلاحيات Administrator:
```powershell
netsh advfirewall firewall add rule name="Kafranjah Engineering System LAN" dir=in action=allow protocol=TCP localport=3005
```

---

### 3. التحقق من نقطة فحص الصحة (Health Endpoint Check)
من أي جهاز متصل بشبكة البلدية:
```
GET http://[SERVER_LAN_IP]:3005/api/health
```
الاستجابة المتوقعة:
```json
{
  "status": "healthy",
  "connected": true,
  "database": "PostgreSQL (Active & Connected)",
  "subsystems": {
    "http": "READY",
    "database": "POSTGRES_CONNECTED",
    "engineRegistry": "28 Engines Registered",
    "rbac": "ACTIVE_ZERO_BYPASS",
    "workflow": "ACTIVE",
    "auditLog": "RECORDING"
  }
}
```

---

### 4. إدارة الطوارئ والنسخ الاحتياطي
- تشغيل النسخ الاحتياطي الفوري:
  ```powershell
  node scripts/test-phase8-backup-restore.js
  ```
- مراجعة سجلات الأخطاء:
  مراجعة مجلد السجلات `logs/` وجدول `activity_log`.
