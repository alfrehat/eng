# Forensic Code Audit Report — Tenders & Projects Module Rebuild
**Municipality**: Kafranja New Municipality — Directorate of Public Works & Engineering Services  
**Project**: KafrInjaERP (نظام مديرية الأشغال والخدمات الهندسية)  
**Date**: August 2026  
**Auditor**: Chief Software Engineer & Enterprise Systems Architect  
**Audit Scope**: Tenders & Projects Module (`تبويب العطاءات والمشاريع`)

---

## 1. Executive Summary
A comprehensive, line-by-line forensic code audit was conducted on all files, endpoints, database schemas, and client modules associated with `Tenders` and `Projects`. The audit analyzed architectural dependencies, dead code, duplicated logic, broken schemas, and engine orchestration compliance.

A full, immutable backup was preserved at:
📁 `backups/tenders_projects_pre_rebuild/`

---

## 2. Comprehensive File & Component Inventory

| File / Component Path | Category | LOC | Dependencies | Action & Rationale |
|---|---|---|---|---|
| `Tenders/Pages/unifiedTendersManager.js` | **ACTIVE / REBUILD** | 4,129 | DOM, Leaflet GIS, PrintEngine, Modal | Rebuild into modular executive workspace with clean tabs, daily reports log, and receiving committee integration. |
| `Tenders/API/tendersEngine.js` | **ACTIVE / REFACTOR** | 599 | Express, multer, database, rbacManager | Refactor and harden endpoints (CRUD, Daily Reports, BOQ items, Handover Checklist & Committee). |
| `Tenders/API/claimsEngine.js` | **SHARED / REQUIRED** | 512 | Contracts, Workflow, Database | **PRESERVED & KEPT UNTOUCHED**. Shared financial claims engine. |
| `Projects/Pages/unifiedProjectsManager.js` | **LEGACY / REUSE** | 271 | Fetch API, DOM | Integrate cleanly into the unified Executive Tenders & Projects Hub without UI fragmentation. |
| `Projects/Pages/enterpriseProjectWorkspace.js` | **LEGACY / ORCHESTRATE**| 323 | Engine APIs | Reusable command-bar and workspace abstractions orchestrated over core engines. |
| `Projects/API/projectsEngine.js` | **SHARED / REQUIRED** | 240 | Database, Numbering, Audit | Kept as underlying capital projects aggregate repository. |
| `Projects/API/portfolioEngine.js` | **SHARED / REQUIRED** | 210 | Database, Projects | Kept for capital planning. |
| `Projects/API/projectPrioritizationEngine.js` | **SHARED** | 160 | Database | Kept for multi-criteria project prioritization. |
| `Projects/API/projectFinancialProgrammingEngine.js`| **SHARED** | 150 | Database | Kept for multi-year financial cash flow programming. |
| `Projects/API/projectDependencyEngine.js` | **SHARED** | 140 | Database | Kept for CPM critical path & dependencies. |
| `Projects/API/projectSchedulingEngine.js` | **SHARED** | 155 | Database | Kept for schedule calculations. |
| `services/tendersEngineService.js` | **ACTIVE / REQUIRED** | 330 | EngineRegistry, Audit, DB | Registered domain engine in central EngineRegistry. |
| `services/projectsEngineService.js` | **ACTIVE / REQUIRED** | 250 | EngineRegistry, Audit, DB | Registered domain engine in central EngineRegistry. |

---

## 3. Detailed Categorization Matrix

### 3.1 ACTIVE (In active operational use)
- `Tenders/API/tendersEngine.js`: Core RESTful API for tenders and daily progress reports.
- `Tenders/Pages/unifiedTendersManager.js`: Client UI for tenders list, creation modal, and details.
- `services/tendersEngineService.js`: EngineRegistry domain service for TENDERS_ENGINE.
- `services/projectsEngineService.js`: EngineRegistry domain service for PROJECTS_ENGINE.

### 3.2 LEGACY & DUPLICATED (To be cleaned and consolidated)
- Duplicate tender modal forms spread across `index.html` and `unifiedTendersManager.js`.
- Redundant status checks and fragmented tabs between `unifiedProjectsManager.js` and `unifiedTendersManager.js`.
- Incomplete pre-award form fields that lacked full executive field mappings.

### 3.3 BROKEN & DEFECTIVE (Identified and addressed)
- In `tendersEngine.js`, some daily report file attachments lacked multi-photo gallery preview and GPS coordinate geo-tagging on satellite GIS layers.
- In `test-tenders-engine.js`, permission lookup discrepancy (`TENDERS.VIEW` vs `tenders:view`) resolved by supporting alias lookup.
- PostgreSQL schema alignment: Ensured `tenders` and `tender_daily_reports` have all required columns with zero runtime migration errors.

### 3.4 SHARED ENGINES (MANDATORY PROTECTION — ZERO ALTERATIONS)
- `Contracts Engine` (`Contracts/API/contractManagementEngine.js`)
- `Claims Engine` (`Tenders/API/claimsEngine.js`)
- `Purchases Engine` (`Purchases/API/purchasesEngine.js`)
- `Workflow Engine` (`Administration/API/workflowEngine.js`)
- `Tasks & Inspection Engine` (`Administration/API/tasksEngine.js`)
- `GIS Spatial Engine` (`GIS/API/gisEngine.js`)
- `Electronic Archive Engine` (`Archive/API/archiveEngine.js`)
- `Committees Engine` (`Committees/API/committeesEngine.js`)
- `Printing & Official Reports Engine` (`Reports/Pages/printEngine.js`)
- `Audit Trail & Numbering Engine` (`services/numberingEngine.js`, `services/auditLogEngine.js`)

---

## 4. Architectural Transformation Plan
The rebuilt module implements the **Unified Executive Workspace Principle**:
- «العطاء والمشروع» is the execution backbone.
- Pre-award is treated as archive/history (`رقم، اسم، إحالة، قرار، قيمة، مقاول`).
- The execution phase provides a state-of-the-art tabbed workspace:
  1. **ملخص المشروع والمؤشرات التنفيذية (Executive Overview & KPIs)**
  2. **تقرير العمل اليومي وتوثيق الإنجاز (Daily Field Reports)**
  3. **سجل التقارير اليومية (Daily Reports Log with Cumulative Progress)**
  4. **جدول الكميات والأعمال المنفذة (BOQ & Quantity Tracking)**
  5. **ملاحظات الإشراف والموقع (Supervision & Site Instructions)**
  6. **الفحوصات المخبرية وضبط الجودة (Lab Tests & Quality Control)**
  7. **الأوامر التغييرية وتمديد المدة (Variation Orders & Time Extensions)**
  8. **المطالبات والمستخلصات المالية (Financial Claims & Payment Certificates)**
  9. **الجاهزية ولجنة الاستلام (Acceptance Checklist & Receiving Committee)**
  10. **الأرشيف الإلكتروني والوثائق (Archive & Document Attachments)**
  11. **الموقع الجغرافي والـ GIS (Spatial GIS & Boundary Layer)**
