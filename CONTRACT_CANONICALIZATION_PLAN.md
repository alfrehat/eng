# CONTRACT_CANONICALIZATION_PLAN.md
## تحليل توحيد كيان العقود (Contract Entity Canonicalization)
## READ: لا تعديل حتى الاعتماد الصريح

---

## 1. المشكلة الجوهرية

كيان العقود مُشتّت عبر ثلاث طبقات غير متزامنة:

| الطبقة | الجدول / المتغير | من يكتب | من يقرأ | استمرارية |
|:---|:---|:---|:---|:---|
| PostgreSQL | public.contracts | contractManagementEngine (queryPg) | contractManagementEngine | نعم |
| PostgreSQL | public.construction_contracts | contractsEngineService | contractsEngineService, workflowRouter | نعم |
| memDb | memDb.contracts (= memDb.construction_contracts) | contractsEngineService | projectsEngineService | نعم (JSON) |
| localState | localContracts[] | لا أحد يكتب (مصفوفة ثابتة) | contractManagementEngine (7 مواضع) | لا |

---

## 2. Schema الجداول الموجودة

### 2.1 public.contracts (من migration 000 §4.3 — النسخة الأولى)
id, title, contract_number, tender_id, contractor_name, contractor_id,
contract_type, start_date, end_date, total_value, status, signed_date,
description, notes, payment_schedule(JSONB), deliverables(JSONB),
performance_guarantees(JSONB), created_at, updated_at, created_by

### 2.2 public.contracts (من migration 000 §9.8 — النسخة الثانية في نفس الملف)
id, contract_number, title, contractor_name, total_value, bank_name,
guarantee_number, guarantee_value, guarantee_expiry_date, status,
guarantee_attachment, ...

### 2.3 public.construction_contracts (يُنشئها contractsEngineService._ensureTable)
id, contract_number, title, tender_id, contractor_name,
contract_value, start_date, end_date, budget_line_id, status,
bank_guarantees(JSONB), variation_orders(JSONB), notes,
created_at, updated_at

---

## 3. Schema الكيانات الفرعية

### 3.1 bank_guarantees (جدول مستقل في 000 §4.5)
id, contract_id(FK→contracts), guarantee_type, bank_name,
guarantee_number, amount, issue_date, expiry_date, status, notes

### 3.2 JSONB مضمّن في construction_contracts.bank_guarantees
{ id, type, bankName, guaranteeNumber, value, expiryDate, status, attachment }

### 3.3 JSONB مضمّن في contracts.performance_guarantees (النسخة 1)
مصفوفة عامة

### 3.4 localBankGuarantees[] (utils/localState.js)
مصفوفة ذاكرة فقط — تُقرَأ من contractManagementEngine (غير مستخدمة للكتابة فعلياً)

---

## 4. contract_variation_orders

| التخزين | الوصف |
|:---|:---|
| جدول public.contract_variation_orders (migration 000 §4.6) | id, contract_id, title, type, amount, status, created_at |
| JSONB في construction_contracts.variation_orders | مصفوفة مضمّنة |
| localVariationOrders[] | مصفوفة ذاكرة فقط |

---

## 5. contract_clauses

| التخزين | الوصف |
|:---|:---|
| جدول public.contract_clauses (migration 000 §4.4) | id, contract_id, title, content, order_num |
| localContractClauses[] | مصفوفة ذاكرة فقط |

---

## 6. المستهلكون الكاملون

| الكيان | الملف | ما يستهلك | نوع الوصول |
|:---|:---|:---|:---|
| contracts | Contracts/API/contractManagementEngine.js | queryPg → public.contracts + localContracts[] | pool مباشر + localState |
| construction_contracts | services/contractsEngineService.js | dbQuery → public.construction_contracts | dbQuery (معتمد) |
| memDb.contracts | services/projectsEngineService.js | memDb.contracts | memDb fallback |
| construction_contracts | routes/workflowRouter.js | 'CONTRACT': 'construction_contracts' | entity mapping |
| contracts | Administration/API/workflowEngine.js | dbGet FROM claims JOIN contracts | dbGet (معتمد) |
| contracts | Archive/API/archiveEngine.js | dbQuery FROM contracts | dbQuery (معتمد) |
| bank_guarantees JSONB | services/contractsEngineService.js | UPDATE construction_contracts SET bank_guarantees | dbRun (معتمد) |

---

## 7. Foreign Keys الموجودة

| FK | جدول المصدر | يُشير إلى | حالة |
|:---|:---|:---|:---|
| tender_id → tenders.id | construction_contracts | tenders | يُشير ضمنياً فقط |
| contract_id → contracts.id | bank_guarantees | contracts | موجود في migration |
| contract_id → contracts.id | contract_clauses | contracts | موجود في migration |
| contract_id → contracts.id | contract_variation_orders | contracts | موجود في migration |

---

## 8. Indexes الموجودة

| الفهرس | الجدول | العمود |
|:---|:---|:---|
| idx_contracts_status | contracts | status |
| idx_contracts_tender | contracts | tender_id |
| idx_bank_guarantees_contract | bank_guarantees | contract_id |

---

## 9. Workflow References

| الملف | القيمة | الجدول المستخدم |
|:---|:---|:---|
| routes/workflowRouter.js L50 | 'CONTRACT': 'construction_contracts' | construction_contracts |
| Administration/API/workflowEngine.js L106 | CONTRACT: 'construction_contracts' | construction_contracts |

---

## 10. القرار المقترح — الجدول الكنوني (CANONICAL CONTRACT TABLE)

**الجدول الكنوني**: public.contracts (النسخة الموحدة)
**سبب الاختيار**: يمتلك FK من bank_guarantees, contract_clauses, contract_variation_orders

**CANONICAL GUARANTEE STORAGE**: جدول public.bank_guarantees المستقل (وليس JSONB)
**سبب**: يدعم الاستعلام المستقل، الفهرسة، وسجل التدقيق

**CANONICAL VARIATION ORDER STORAGE**: جدول public.contract_variation_orders المستقل
**CANONICAL CLAUSE STORAGE**: جدول public.contract_clauses المستقل

---

## 11. خطوات التوحيد (بعد الاعتماد فقط)

1. إنشاء migration 013: دمج حقول construction_contracts الإضافية (contract_value) في public.contracts
2. نقل بيانات construction_contracts → contracts (data migration)
3. تحديث workflowRouter وworkflowEngine لاستخدام 'contracts'
4. تحديث contractsEngineService للكتابة في contracts بدلاً من construction_contracts
5. استبدال JSONB bank_guarantees بالجدول المستقل في contractsEngineService
6. إيقاف localState.js تدريجياً (localContracts → memDb.contracts)
7. Regression tests كاملة
8. بعد التحقق: وضع علامة construction_contracts كـ DEPRECATED (لا حذف فورياً)

---

## 12. الحالة الحرجة للـ localState

localContracts[] في contractManagementEngine.js مُستخدَمة في **7 مواضع**:
- L720, L834, L864, L912, L1007, L1125, L1171
- جميعها عمليات قراءة (find)
- لا كتابة في localContracts من أي مكان
- **المعنى**: localContracts دائماً فارغة (مصفوفة []) → جميع هذه المواضع ترجع null/undefined
- **الإصلاح الفوري**: استبدال localContracts.find(...) بـ استعلام معتمد (dbGet أو memDb.contracts.find)
