# 🏛️ دليل التشغيل والنشر القياسي (Standard Operating Procedure - Deployment & Operations)
## نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0

---

### 📋 1. نظرة عامة على المعمارية الموحدة (Architecture Overview)

يعتمد النظام معمارية مؤسسية حديثة توحد البيانات في خادم **PostgreSQL/PostGIS** كـ **مصدر واحد ووحيد للحقيقة (Single Source of Truth)** مع توفير محرك مزامنة لاحق وتراجع سلس للنمط المحلي.

* **Backend Stack**: Node.js v18+ (Express.js ES6+), PostgreSQL 15+ / PostGIS 3.3+.
* **Security & Auth**: JWT Tokens + BCrypt Hashing + Unified RBAC/ABAC Security Engine.
* **PKI Digital Signatures**: RSA-PSS / SHA-256 Triple Co-signature (Supervisor, Manager, Mayor).
* **Logging**: Structured JSON Logging (`logs/app.log`, `logs/security-audit.log`, `logs/backup-ops.log`).

---

### 🚀 2. متطلبات وتشغيل البيئة (Environment Setup)

#### أ. المتطلبات الأولية (Prerequisites):
1. **Node.js**: الإصدار 18.0.0 أو أحدث.
2. **PostgreSQL / PostGIS**: خادم PostgreSQL ممتد بـ PostGIS (`CREATE EXTENSION postgis;`).
3. **Docker & Docker Compose**: (اختياري للنشر عبر الحاويات).

#### ب. ضبط متغيرات البيئة (`.env`):
أنشئ ملف `.env` في المجلد الرئيسي بالتكوين التالي:
```env
# PostgreSQL Configuration
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=kafr_inja_engineering

# Application Server Port & JWT Secret
PORT=3005
JWT_SECRET=KafrInjaEnterprise2026SecureJWTKey

# Production Backup Encryption
BACKUP_ENCRYPTION_KEY=KafrInjaEnterprise2026SecureKey
BACKUP_S3_BUCKET=s3://kafr-inja-engineering-backups
```

---

### 🗄️ 3. إجراءات التوحيد والترحيل (Unified Database Migration)

لتجميع البيانات التاريخية من كافة المصادر وتغذية قاعدة بيانات PostgreSQL الموحدة:

```bash
# 1. تثبيت الاعتماديات الأساسية
npm install

# 2. تشغيل السكريبت الموحد الشامل للترحيل
npm run db:migrate
```

---

### 🛡️ 4. تشغيل خادم التطبيق (Running the Application)

#### أ. وضع التشغيل المباشر للإنتاج (Production Mode):
```bash
npm start
```
* **رابط الخدمة المباشر**: `http://localhost:3005`

#### ب. وضع التطوير وإعادة التشغيل الآلي (Development Mode):
```bash
npm run dev
```

#### جـ. تشغيل تطبيق سطح المكتب (Desktop Shell - Electron):
```bash
npm run electron
```

---

### 🐳 5. التشغيل والنشر باستخدام حاويات Docker (Containerized Deployment)

#### أ. بناء صورة Docker المعزولة:
```bash
docker build -t kafr-inja-engineering-erp:4.0 .
```

#### ب. تشغيل الحاوية الموحدة:
```bash
docker run -d \
  --name kafr_inja_erp \
  -p 3005:3005 \
  --env-file .env \
  kafr-inja-engineering-erp:4.0
```

---

### 📦 6. النسخ الاحتياطي السحابي المشفر (Encrypted Production Backup)

لتشغيل عملية النسخ الاحتياطي والتشفير بـ AES-256-CBC والرفع للسحابة:

```bash
npm run db:backup
```

---

### 📞 7. سجلات التشغيل والتتبع (Monitoring & Log Files)

جميع السجلات مجمعة بنسق Structured JSON داخل مجلد `logs/`:
* `logs/app.log`: سجلات التطبيق والاستعلامات العامة.
* `logs/security-audit.log`: سجلات الأمان، تسجيل الدخول، وانتهاكات الصلاحيات (RBAC/ABAC).
* `logs/backup-ops.log`: سجلات النسخ الاحتياطي والأرشيف المشفر.
* `logs/migration.log`: سجلات الترحيل والمزامنة اللاحقة.
* `logs/server-autostart.log`: سجلات خدمة التشغيل التلقائي وإعادة التشغيل الذاتي (Watchdog).

---

### ⚡ 8. التشغيل التلقائي مع إقلاع نظام التشغيل (Windows Auto-Start Service)

تم تجهيز النظام ليعمل كخدمة خلفية (Background Service / Watchdog) تقلع تلقائياً مع بدء تشغيل الويندوز وتستمر بالعمل دون الحاجة لفتح نافذة موجه الأوامر:

#### أ. التفعيل بنقرة واحدة:
- تشغيل ملف `تفعيل_التشغيل_التلقائي.bat` أو عبر الأمر:
```bash
npm run autostart:enable
```

#### ب. الإلغاء بنقرة واحدة:
- تشغيل ملف `إلغاء_التشغيل_التلقائي.bat` أو عبر الأمر:
```bash
npm run autostart:disable
```

#### ج. فحص حالة التشغيل التلقائي:
```bash
node scripts/manage-autostart.js status
```

