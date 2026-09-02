# 📦 بيان محتويات حزمة الإنتاج الرسمية (Production Package Manifest)
## نظام إدارة الأشغال والخدمات الهندسية — بلدية كفرنجة الجديدة

* **اسم الحزمة**: `KNM-ERP-PRODUCTION-SERVER-PHASE11.zip`
* **تاريخ البناء والاعتماد**: 2026-08-30T20:53:18.773Z
* **إصدار النظام**: `4.2.0-Enterprise-Prod`
* **الجهة المستفيدة**: مديرية الأشغال والخدمات الهندسية — بلدية كفرنجة الجديدة
* **منفذ التشغيل وربط الشبكة**: `0.0.0.0:3005` (LAN Binding)
* **المحركات المؤسسية المضمنة (28 محركاً)**:
  1. NUMBERING_ENGINE
  2. BUSINESS_RULES_ENGINE
  3. AUTHORIZATION_ENGINE
  4. VERIFICATION_ENGINE
  5. SPATIAL_GIS_ENGINE
  6. NOTIFICATION_ENGINE
  7. DATABASE_ENGINE
  8. RAMS_ANALYTICS_ENGINE
  9. CONTRACT_TEMPLATE_ENGINE
  10. WORKFLOW_ENGINE
  11. PROJECTS_ENGINE
  12. PROJECT_PORTFOLIO_ENGINE
  13. PROJECT_PRIORITIZATION_ENGINE
  14. PROJECT_FINANCIAL_PROGRAMMING_ENGINE
  15. PROJECT_DEPENDENCY_ENGINE
  16. PROJECT_SCHEDULING_ENGINE
  17. TENDERS_ENGINE
  18. CLAIMS_ENGINE
  19. ROADS_ENGINE
  20. PURCHASES_ENGINE
  21. CONTRACTS_ENGINE
  22. PAVEMENT_RETURNS_ENGINE
  23. ASSETS_ENGINE
  24. ARCHIVE_DOCUMENT_ENGINE
  25. PRINT_REPORT_ENGINE
  26. INSPECTION_ENGINE
  27. COMMITTEES_ENGINE
  28. G2G_GATEWAY_ENGINE

* **تأكيد التنظيف والتطهير (Data & Secret Sanitization)**:
  - إزالة كافة بيانات الـ Pilot والاختبارات من جداول البيانات: **نعم (تأكيد 100%)**
  - تجريد ملفات الأسرار وكلمات المرور الخاصة ببيئة التطوير: **نعم (تأكيد 100%)**
  - استبعاد مجلدات node_modules والسجلات والملفات المؤقتة: **نعم (تأكيد 100%)**
  - تضمين ملف الإعدادات النموذجي `.env.example`: **نعم**
  - تضمين ملفات التشغيل والإدارة لنظام Windows: **نعم**
