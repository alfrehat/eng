# DEPENDENCY_REWIRE_PLAN.md
## خطة إعادة توجيه التبعيات (Dependency Rewire Plan)
## المرجع: ENGINE_OWNERSHIP_FINAL + Data Layer Forensic Audit

---

## PHASE 0 — قبل أي تعديل (VALIDATION BASELINE)

- [ ] تشغيل: node --check server.js
- [ ] تشغيل: node --check services/engineRegistry.js
- [ ] تشغيل: node --check Contracts/API/contractManagementEngine.js
- [ ] تشغيل: node --check Roads/API/roadsEngine.js

---

## PHASE 1 — إصلاح UI Leaks في EngineRegistry (Section G)
**الهدف**: إزالة require(Assets/Pages/*) من engineRegistry.js
**الملف**: services/engineRegistry.js
**الأسطر**: L938, L954, L970
**الإجراء**: استبدال instance = energyLighting/infraNetworks/structuralAssets بـ instance = specializedAssets (مسجّل بالفعل)

**قبل**:
const energyLighting = safeRequire('../Assets/Pages/energyLighting');
this.register({ engineId: 'ENERGY_LIGHTING_ENGINE', instance: energyLighting, ... });

**بعد**:
// لا safeRequire للـ UI pages
this.register({ engineId: 'ENERGY_LIGHTING_ENGINE', instance: specializedAssets, ... });

**Validation Gate**: node --check services/engineRegistry.js

---

## PHASE 2 — إصلاح Database Layer Bypass (Section C)
**الأولوية**: CRITICAL

### 2.1 contractManagementEngine.js — إزالة require('pg')
**الملف**: Contracts/API/contractManagementEngine.js
**التغيير**: حذف L9 const { Pool } = require('pg');
**الإجراء**: دالة queryPg موجودة بالفعل وتستخدم getPool() من utils/database (L37, L41)
**النتيجة**: لا تغيير في السلوك — getPool() موجودة، Pool من pg لم تُستخدَم مباشرة إلا في تعريف الاستيراد

**Validation Gate**: node --check Contracts/API/contractManagementEngine.js

### 2.2 Roads/API/roadsEngine.js — 13 pool.query → dbQuery/dbGet/dbRun
**الملف**: Roads/API/roadsEngine.js
**الخطوة**: استيراد dbQuery,dbGet,dbRun من utils/database إذا لم تكن مستوردة
**القواعد**:
- SELECT متعدد الصفوف → dbQuery
- SELECT صف واحد → dbGet
- INSERT/UPDATE/DELETE → dbRun
- الحفاظ على: params, returned rows, error semantics
- NO_ROWS ≠ QUERY_FAILURE: dbQuery ترجع [] عند لا صفوف — ترمي خطأ عند فشل

**Validation Gate**: node --check Roads/API/roadsEngine.js

### 2.3 PavementReturns/API/pavingReturns.js — 10 pool.query → dbQuery/dbGet/dbRun
**نفس القواعد أعلاه**
**ملاحظة**: pavingReturns تستورد getPool() من utils/database — استبدال pool بالدوال المعتمدة

**Validation Gate**: node --check PavementReturns/API/pavingReturns.js

### 2.4 Reports/API/printTemplatesEngine.js — 5 pool.query → dbQuery/dbGet/dbRun
**نفس القواعد**

---

## PHASE 3 — إصلاح Security (Section I)

### 3.1 activity_log — إضافة عمود ip
**الملف**: migrations/013_remediation_fixes.sql (جديد)
`sql
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip VARCHAR(50) DEFAULT '127.0.0.1';
`

### 3.2 role_permissions — استعادة Foreign Keys
`sql
ALTER TABLE role_permissions
  ADD CONSTRAINT IF NOT EXISTS fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  ADD CONSTRAINT IF NOT EXISTS fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;
`

### 3.3 كلمات المرور
**الملف**: database/users.json (بعد التحقق من عدم وجود auth login بدون bcrypt)
**الإجراء**: لا تعديل في users.json مباشرة — تصحيح في authorizationEngineService عند تسجيل الدخول

---

## PHASE 4 — إيقاف localState.js (Section F)

### 4.1 localContracts[] (7 مواضع في contractManagementEngine.js)
**الاكتشاف**: localContracts دائماً فارغة (لا أحد يكتب فيها)
**الإصلاح**: استبدال localContracts.find(c => ...) بـ memDb.contracts?.find(c => ...) أو dbGet

| الموضع | الاستبدال |
|:---|:---|
| L720 localContracts.find | (await contractsEngineService.getContractById(id))?.data |
| L834 localContracts.find | نفس أعلاه |
| L864 localContracts.find | نفس أعلاه |
| L912 let contracts = localContracts | contracts = memDb.contracts مع fallback لـ dbQuery |
| L1007 localContracts.find | نفس أعلاه |
| L1125 localContracts.find | نفس أعلاه |
| L1171 localContracts.find | نفس أعلاه |

### 4.2 localContractClauses[], localBankGuarantees[], localVariationOrders[]
**الاكتشاف**: لا تُستخدَم فعلياً في أي كتابة — تُقرَأ فقط وهي فارغة دائماً
**الإصلاح**: استبدال أي .find() على هذه المصفوفات بـ dbGet من الجداول المعتمدة

---

## PHASE 5 — Transactions (Section H)

| العملية | الملف | الإجراء |
|:---|:---|:---|
| createContract + bank_guarantees | contractsEngineService.js | لف بـ withTransaction |
| createProject + portfolio link | projectsEngineService.js | لف بـ withTransaction عند ربط المحفظة |
| تحديث طريق + trigger PCI | Roads/API/roadsEngine.js | trigger موجود — لا حاجة لـ transaction |

---

## PHASE 6 — Schema Reconciliation Migration (Section E)
**الملف**: migrations/013_remediation_fixes.sql

`sql
-- إضافة ip لـ activity_log
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip VARCHAR(50) DEFAULT '127.0.0.1';

-- استعادة FK في role_permissions
ALTER TABLE role_permissions
  ADD CONSTRAINT IF NOT EXISTS fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions
  ADD CONSTRAINT IF NOT EXISTS fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- إضافة فهارس مكانية مفقودة
CREATE INDEX IF NOT EXISTS idx_road_side_assets_geom ON road_side_assets USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_road_survey_points_geom ON road_survey_points USING GIST(geom);

-- إصلاح energy_lighting / energy_assets naming (MEM_TABLES فقط — لا تعديل جدول)
-- تُعالَج في utils/database.js MEM_TABLES
`

---

## PHASE 7 — إصلاح memDb.energy_assets → energy_lighting
**الملف**: utils/database.js
**الموضع**: قائمة MEM_TABLES (السطر 35 تقريباً)
**التغيير**: تغيير 'energy_assets' إلى 'energy_lighting'
**التأثير**: كل saveMemTable('energy_assets') يصبح saveMemTable('energy_lighting')
**ملاحظة**: مراجعة كل مواضع الاستخدام قبل التعديل

---

## ترتيب التنفيذ

1. [PHASE 1] engineRegistry UI Leaks (أقل خطراً، لا DB)
2. [PHASE 2.1] إزالة require('pg') من contractManagementEngine
3. [PHASE 2.2] روadsEngine pool.query → dbQuery
4. [PHASE 2.3] pavingReturns pool.query → dbQuery
5. [PHASE 2.4] printTemplatesEngine pool.query → dbQuery
6. [PHASE 6] migration 013 (activity_log + FK + indexes)
7. [PHASE 7] MEM_TABLES energy fix
8. [PHASE 4] localState elimination
9. [PHASE 5] withTransaction في العمليات الحرجة
10. [CONTRACT] Contract Canonicalization (مرحلة مستقلة تتطلب اعتماداً)
