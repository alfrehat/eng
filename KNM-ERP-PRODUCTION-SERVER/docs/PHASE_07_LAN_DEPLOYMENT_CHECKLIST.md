# 🏢 دليل وقائمة التحقق لنشر النظام على الشبكة المحلية (LAN Deployment Checklist)
## بلدية كفرنجة الجديدة — مديرية الأشغال والخدمات الهندسية
### Enterprise Directorate Management System — Local Area Network (LAN) Setup

---

### 1. المتطلبات البيئية والمواصفات الموصى بها (System Requirements)
* **نظام التشغيل الموصى به**: Windows Server 2019/2022 أو Windows 10/11 Pro (64-bit).
* **المعالج**: Intel Core i5/i7 أو Xeon رباعي النواة كحد أدنى.
* **الذاكرة العشوائية (RAM)**: 8GB كحد أدنى (16GB موصى بها).
* **المساحة التخزينية**: SSD 120GB+ مخصصة للنظام والوثائق والأرشيف الإلكتروني.
* **البيئة البرمجية**: Node.js v18 LTS أو أعلى، PostgreSQL 14/15/16.

---

### 2. إعدادات الشبكة المحلية وجدار الحماية (Network & Firewall Configuration)
1. **تثبيت عنوان IP ثابت للخادم (Static IP)**:
   - تعيين عنوان IP ثابت من شبكة البلدية (مثال: `192.168.1.50`).
2. **منفذ تشغيل النظام (Port Configuration)**:
   - المنفذ الافتراضي المعتمد للنظام: `3000` (أو `80`/`443` عبر Reverse Proxy مثل IIS أو NGINX).
3. **فتح المنفذ في جدار الحماية (Windows Defender Firewall)**:
   - إنشاء قاعدة جديدة (Inbound Rule) للسماح بالاتصال عبر بروتوكول `TCP` على المنفذ `3000`.

---

### 3. إعداد خادم قواعد البيانات (PostgreSQL Setup)
1. التحقق من تشغيل خدمة `postgresql-x64-15`.
2. ضبط ملف `pg_hba.conf` للسماح باتصال التطبيق محلياً عبر `localhost` أو `127.0.0.1`.
3. التحقق من تطبيق كافة الـ Migrations المتسلسلة من `001_initial_schema.sql` إلى `016_unified_financial_programming.sql`.

---

### 4. تشغيل النظام كخدمة مستمرة (Service Setup & PM2)
لتشغيل النظام بشكل دائم وإعادة تشغيله تلقائياً عند إعادة تشغيل الخادم:
```powershell
# تثبيت PM2 لإدارة عمليات Node.js
npm install -g pm2
npm install -g pm2-windows-service

# بدء تشغيل النظام
pm2 start server.js --name "kafranjah-eng-system"

# حفظ الحالة الحالية
pm2 save
```

---

### 5. النسخ الاحتياطي التلقائي (Automated Daily Backup Schedule)
1. ضبط مهمة مجدولة في Windows (Task Scheduler) لتشغيل سكريبت النسخ الاحتياطي يومياً الساعة 11:00 مساءً.
2. توجيه ملفات النسخ الاحتياطي إلى مسار خارجي أو قرص تخزين مستقل (`D:\System_Backups\`).

---

### 6. الوصول للنظام من أجهزة المهندسين والموظفين (Client Browser Access)
* **المتصفحات المدعومة**: Google Chrome (الإصدار 100+), Microsoft Edge, Mozilla Firefox.
* **رابط الوصول من أي جهاز متصل بالشبكة المحلية**:
  ```
  http://192.168.1.50:3000/
  ```
* تسجيل الدخول باستخدام الحساب الوظيفي المعتمد لكل مهندس وفق صلاحيات RBAC المعرفة مسبقاً.
