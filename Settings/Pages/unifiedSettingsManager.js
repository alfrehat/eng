/**
 * Settings/Pages/unifiedSettingsManager.js
 * منظومة الإعدادات العامة وإدارة النظام الموحدة (Unified Enterprise System Settings Suite v6.0)
 * المملكة الأردنية الهاشمية - بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * ─────────────────────────────────────────────────────────────────────────────
 * توحيد الهوية البصرية، محرك الترقيم الذكي، المعايير الهندسية والمالية الشاملة،
 * التنبيهات والأمان، نظم المعلومات الجغرافية GIS، الأختام الرقمية، المستخدمين،
 * الهيكل التنظيمي، الصلاحيات، مسارات العمل، والنسخ الاحتياطي
 */

(function (global) {
  'use strict';

  const CANONICAL_ROLE_MODULES = [
    {
      id: 'dashboard',
      name: 'لوحة القيادة والمؤشرات العامة',
      icon: '📊',
      color: '#0284c7',
      description: 'عرض المؤشرات البيانية وإحصائيات المشاريع ونسب الإنجاز العامة',
      permissions: [
        { key: 'DASHBOARD.VIEW', name: 'لوحة التحكم والمؤشرات الرئيسية', desc: 'عرض لوحة التحكم والمؤشرات الإحصائية العامة', risk: 'normal' },
        { key: 'MY_WORK.VIEW', name: 'شاشة مكتبي والمهام المسندة', desc: 'استعراض المهام المسندة والتنبيهات المباشرة للموظف', risk: 'normal' }
      ]
    },
    {
      id: 'projects',
      name: 'المشاريع الهندسية والمحافظ الاستثمارية',
      icon: '🏗️',
      color: '#0f766e',
      description: 'إدارة دورة حياة المشاريع الهندسية، المحافظ الرأسمالية، الخطط، والمسار الحرج',
      permissions: [
        { key: 'PROJECTS.VIEW', name: 'عرض شاشة المشاريع والمحافظ', desc: 'الاطلاع على قائمة المشاريع الهندسية وخطط التنفيذ', risk: 'normal' },
        { key: 'PROJECTS.CREATE', name: 'إنشاء وتوثيق مشروع جديد', desc: 'إدراج مشروع هندسي جديد وتحديد كلفته وموقعه الجغرافي', risk: 'action' },
        { key: 'PROJECTS.EDIT', name: 'تعديل بيانات وخطة المشروع', desc: 'تحديث الجداول الزمنية والمواصفات ومراحل الإنجاز', risk: 'action' },
        { key: 'PROJECTS.SUBMIT', name: 'تقديم المشروع للاعتماد', desc: 'إحالة مسودة المشروع للمراجعة الفنية لرئيس القسم', risk: 'action' },
        { key: 'PROJECTS.REVIEW', name: 'التدقيق والمراجعة الفنية', desc: 'مراجعة المخططات والدراسات الفنية للمشروع', risk: 'action' },
        { key: 'PROJECTS.APPROVE', name: 'المصادقة الإدارية واعتماد الطرح', desc: 'الاعتماد الإداري النهائي للمشروع من مدير الأشغال', risk: 'critical' },
        { key: 'PROJECTS.COMPLETE', name: 'إنجاز المشروع والاستلام الأولي', desc: 'توثيق انتهاء الأعمال وتشكيل لجان الاستلام', risk: 'critical' },
        { key: 'PROJECTS.CLOSE', name: 'الإغلاق النهائي والمحاسبة الختامية', desc: 'تسوية الحسابات الختامية والأرشفة النهائية', risk: 'critical' }
      ]
    },
    {
      id: 'tenders',
      name: 'العطاءات والمطالبات والعقود',
      icon: '📋',
      color: '#d97706',
      description: 'إدارة العطاءات، المطالبات المالية للمقاولين، العقود الإنشائية، والكفالات البنكية',
      permissions: [
        { key: 'TENDERS.VIEW', name: 'عرض شاشة العطاءات', desc: 'استعراض سجل العطاءات والمناقصات والمشاريع المطروحة', risk: 'normal' },
        { key: 'TENDERS.CREATE', name: 'طرح وإدراج عطاء جديد', desc: 'إنشاء عطاء وتحديد الشروط والمواصفات التنافسية', risk: 'action' },
        { key: 'TENDERS.EDIT', name: 'تعديل بيانات العطاء وجداول الكميات', desc: 'تحديث المواصفات وتقديرات الكلفة وفترات الإنجاز', risk: 'action' },
        { key: 'TENDERS.APPROVE', name: 'المصادقة والترسية النهائية للعطاء', desc: 'اعتماد قرار الإحالة وتوقيع قرار لجنة العطاءات', risk: 'critical' },
        { key: 'CLAIMS.VIEW', name: 'عرض سجل المطالبات المالية', desc: 'متابعة دفعات المقاولين والمستخلصات الدورية', risk: 'normal' },
        { key: 'CLAIMS.CREATE', name: 'إنشاء وتسجيل مطالبة مالية', desc: 'إدخال مستخلص دوري وتفريغ الكميات المنفذة', risk: 'action' },
        { key: 'CLAIMS.EDIT', name: 'تعديل المطالبة والاستقطاعات', desc: 'احتساب المحتجزات والضرائب وغرامات التأخير', risk: 'action' },
        { key: 'CLAIMS.AUDIT', name: 'تدقيق المطالبة وإبداء الرأي الفني/المالي', desc: 'التدقيق الهندسي والمحاسبي المسبق قبل الصرف', risk: 'action' },
        { key: 'CLAIMS.APPROVE', name: 'اعتماد وصرف المطالبة المالية', desc: 'المصادقة النهائية على أمر الصرف للمقاول', risk: 'critical' },
        { key: 'CONTRACTS.VIEW', name: 'عرض العقود والضمانات البنكية', desc: 'متابعة عقود المشاريع وتواريخ انتهاء الكفالات', risk: 'normal' },
        { key: 'CONTRACTS.CREATE', name: 'إنشاء وتوثيق عقد إنشائي', desc: 'إبرام عقد مقاولة وربط الكفالات والضمانات البنكية', risk: 'action' },
        { key: 'CONTRACTS.EDIT', name: 'تعديل العقد والأوامر التغييرية', desc: 'تحديث المدد الإضافية وملاحق العقد ضمن الحدود القانونية', risk: 'action' },
        { key: 'CONTRACTS.APPROVE', name: 'المصادقة القانونية وتوقيع العقد', desc: 'الاعتماد الرسمي والنهائي لتوقيع العقد', risk: 'critical' }
      ]
    },
    {
      id: 'quantities',
      name: 'جداول وحساب الكميات والمستخلصات',
      icon: '📐',
      color: '#7c3aed',
      description: 'حصر الكميات الميدانية، مطابقة المخططات، قياسات المنفذ، وتدقيق المستخلصات',
      permissions: [
        { key: 'QUANTITIES.VIEW', name: 'عرض كشوفات وجداول الكميات', desc: 'الاطلاع على جداول الكميات BOQ والقياسات الميدانية', risk: 'normal' },
        { key: 'QUANTITIES.CREATE', name: 'إدخال وحصر الكميات الميدانية', desc: 'تسجيل القياسات الفعلية المنفذة على الطبيعة', risk: 'action' },
        { key: 'QUANTITIES.EDIT', name: 'تعديل قياسات الكميات', desc: 'تحديث بيانات الحصر والقياس الميداني قبل الاعتماد', risk: 'action' },
        { key: 'QUANTITIES.REVIEW', name: 'مراجعة وتدقيق كشوف الكميات', desc: 'مطابقة الكميات مع المخططات والمواصفات الفنية', risk: 'action' },
        { key: 'QUANTITIES.APPROVE', name: 'اعتماد الكميات رسمياً', desc: 'المصادقة النهائية على كشف الكميات المعتمد للصرف', risk: 'critical' }
      ]
    },
    {
      id: 'quality_ncr',
      name: 'المختبرات وضبط الجودة وتقارير عدم المطابقة (NCR)',
      icon: '🧪',
      color: '#ea580c',
      description: 'الفحوصات المخبرية (خرسانة، إسفلت، دمك)، طلبات الفحص، وحالات عدم المطابقة',
      permissions: [
        { key: 'QUALITY.VIEW', name: 'عرض سجلات الجودة والفحوصات', desc: 'استعراض نتائج الاختبارات المخبرية وسجل تقارير NCR', risk: 'normal' },
        { key: 'QUALITY.TEST_REQUEST', name: 'إصدار طلب فحص مخبري / عينات', desc: 'طلب فحص عينات المواد الإنشائية والإسفلت والخرسانة', risk: 'action' },
        { key: 'QUALITY.TEST_RECORD', name: 'تسجيل نتائج الفحوصات والاختبارات', desc: 'إدخال قيم كسر الخرسانة، فحص الدمك، ودرجة حرارة الإسفلت', risk: 'action' },
        { key: 'QUALITY.TEST_REVIEW', name: 'مراجعة وتدقيق نتائج الفحوصات', desc: 'التحقق الهندسي من مطابقة النتائج للمواصفات الأردنية', risk: 'action' },
        { key: 'QUALITY.TEST_APPROVE', name: 'اعتماد نتائج الفحوصات الفنية', desc: 'المصادقة الرسمية على شهادة الفحص المخبري', risk: 'critical' },
        { key: 'QUALITY.NCR_CREATE', name: 'إنشاء تقرير عدم مطابقة (NCR)', desc: 'توثيق الأعمال أو المواد المخالفة للمواصفات الهندسية', risk: 'action' },
        { key: 'QUALITY.NCR_CLOSE', name: 'التحقق من التصحيح وإغلاق NCR', desc: 'المصادقة على تصحيح المخالفة بعد إعادة الفحص المخبري', risk: 'critical' }
      ]
    },
    {
      id: 'daily_reports',
      name: 'التقارير اليومية والملاحظات الميدانية',
      icon: '📅',
      color: '#2563eb',
      description: 'سجلات العمل الميدانية اليومية، توثيق العمالة والمعدات، الصور، والملاحظات',
      permissions: [
        { key: 'DAILY_REPORTS.VIEW', name: 'عرض سجلات وتقارير العمل اليومية', desc: 'الاطلاع على تقارير التنفيذ الميداني وسجلات الأحوال الجوية', risk: 'normal' },
        { key: 'DAILY_REPORTS.CREATE', name: 'إعداد وتسجيل تقرير يومي', desc: 'تسجيل العمالة، الآليات، الأعمال المنجزة، والمواد الموردة', risk: 'action' },
        { key: 'DAILY_REPORTS.EDIT', name: 'تعديل تقرير العمل اليومي', desc: 'تحديث بيانات اليومية الميدانية قبل التقديم', risk: 'action' },
        { key: 'DAILY_REPORTS.FORWARD', name: 'إحالة وتقديم التقرير للمراجعة', desc: 'إرسال التقرير اليومي للمهندس المشرف ورئيس القسم', risk: 'action' },
        { key: 'DAILY_REPORTS.REVIEW', name: 'مراجعة وتدقيق التقرير اليومي', desc: 'تدقيق الأعمال الموثقة والملاحظات الميدانية', risk: 'action' },
        { key: 'DAILY_REPORTS.APPROVE', name: 'اعتماد تقرير العمل اليومي', desc: 'المصادقة الرسمية على تقرير الإنجاز اليومي', risk: 'critical' },
        { key: 'OBSERVATIONS.CREATE', name: 'تسجيل ملاحظة ميدانية بالصور', desc: 'توثيق العوائق والملاحظات الفنية والموقع بالصور', risk: 'action' },
        { key: 'OBSERVATIONS.RESOLVE', name: 'معالجة وتصحيح الملاحظة الميدانية', desc: 'إغلاق الملاحظة وتوثيق الإجراء التصحيحي المتخذ', risk: 'action' }
      ]
    },
    {
      id: 'surveys',
      name: 'الرفع المساحي والقياسات والمناسيب',
      icon: '🗺️',
      color: '#0891b2',
      description: 'أعمال الرفع المساحي، الإحداثيات، المناسيب، المحاور، والقياسات المكانية',
      permissions: [
        { key: 'SURVEYS.VIEW', name: 'عرض المخططات وسجلات الرفع المساحي', desc: 'استعراض نقاط المناسيب والمخططات المساحية الطبوغرافية', risk: 'normal' },
        { key: 'SURVEYS.CREATE', name: 'تسجيل الرفع المساحي والمناسيب', desc: 'إدخال إحداثيات النقاط والمناسيب ومحاور الشوارع والمباني', risk: 'action' },
        { key: 'SURVEYS.EDIT', name: 'تعديل البيانات المساحية', desc: 'تحديث القياسات والمخططات المساحية قبل الاعتماد', risk: 'action' },
        { key: 'SURVEYS.REVIEW', name: 'مراجعة وتدقيق المخططات المساحية', desc: 'مطابقة المخطط المساحي مع المخططات التنظيمية', risk: 'action' },
        { key: 'SURVEYS.MEASURE', name: 'إجراء القياسات الحقلية والمساحات', desc: 'حساب الأطوال والمساحات المكانية للأعمال المنفذة', risk: 'action' }
      ]
    },
    {
      id: 'roads_infrastructure',
      name: 'الطرق والأصول والتصاريح والتعبيد',
      icon: '🛣️',
      color: '#4f46e5',
      description: 'شبكة الطرق (RAMS/PCI)، الأصول الإنشائية، تصاريح الحفريات، وعوائد التعبيد',
      permissions: [
        { key: 'ROADS.VIEW', name: 'عرض شاشة شبكة الطرق والرصفات', desc: 'استعراض شبكة الشوارع وحالة الرصف ومؤشر الـ PCI', risk: 'normal' },
        { key: 'ROADS.CREATE', name: 'إضافة شارع جديد لشبكة البلدية', desc: 'إدراج طريق تنظيمي جديد مع بيانات الأبعاد والطبقات', risk: 'action' },
        { key: 'ROADS.EDIT', name: 'تحديث تقييم الطريق وفحص PCI', desc: 'تسجيل عيوب الطريق واحتساب أولويات إعادة التأهيل', risk: 'action' },
        { key: 'ASSETS.VIEW', name: 'عرض شاشة الأصول والمنشآت', desc: 'استعراض المباني البلدية والجدران الاستنادية والعبارات', risk: 'normal' },
        { key: 'ASSETS.CREATE', name: 'تسجيل أصل إنشائي أو منشأة جديدة', desc: 'إضافة منشأة أو جدار استنادي وحساب تكاليف الإنشاء', risk: 'action' },
        { key: 'ASSETS.EDIT', name: 'تعديل بيانات الأصل وجداول الصيانة', desc: 'تحديث الفحوصات الإنشائية وجداول الصيانة الوقائية', risk: 'action' },
        { key: 'PERMITS.VIEW', name: 'عرض شاشة تصاريح الحفريات', desc: 'متابعة طلبات الحفر للشركات الخدمية والمواطنين', risk: 'normal' },
        { key: 'PERMITS.CREATE', name: 'إصدار تصريح حفر وتزويد خدمات', desc: 'إنشاء تصريح حفر مع تحديد المسار وقيمة التأمين والرسوم', risk: 'action' },
        { key: 'PERMITS.EDIT', name: 'تعديل بيانات التصريح وموقع الحفر', desc: 'تحديث أطوال ومسارات الحفر والتمديدات', risk: 'action' },
        { key: 'PERMITS.APPROVE', name: 'اعتماد وإغلاق التصريح ورد التأمين', desc: 'المصادقة على إعادة الأوضاع واسترداد كفالة التأمين', risk: 'critical' },
        { key: 'PAVING.VIEW', name: 'عرض شاشة عوائد التعبيد والتحققات', desc: 'استعراض قيود التحقق المالي على القطع المخدومة', risk: 'normal' },
        { key: 'PAVING.CREATE', name: 'إضافة واحتساب عوائد التعبيد', desc: 'احتساب المبالغ المستحقة حسب المساحة وواجهة القطعة', risk: 'action' },
        { key: 'PAVING.EDIT', name: 'تعديل قيود عوائد التعبيد والمبالغ', desc: 'تحديث بيانات الحوض والحي والمبالغ المقسطة', risk: 'action' },
        { key: 'PAVING.APPROVE', name: 'الاعتماد المالي وإبراء الذمة', desc: 'ترحيل المبالغ للدائرة المالية وإصدار براءة الذمة', risk: 'critical' }
      ]
    },
    {
      id: 'tasks_handover',
      name: 'الكشوفات الميدانية ولجان الاستلام',
      icon: '📌',
      color: '#059669',
      description: 'تكليفات الكشف الهندسي الميداني والمشاركة في لجان الاستلام المرحلي والنهائي',
      permissions: [
        { key: 'TASKS.VIEW', name: 'عرض شاشة المهام والكشوفات الفنية', desc: 'متابعة جدول الكشوفات الميدانية المسندة للمهندسين', risk: 'normal' },
        { key: 'TASKS.CREATE', name: 'إسناد وتكليف مهمة كشف هندسي', desc: 'توجيه مهندس أو مراقب لإجراء كشف تنظيمي أو فني', risk: 'action' },
        { key: 'TASKS.EDIT', name: 'إعداد وتوثيق التقرير الفني الميداني', desc: 'رفع نتائج المعاينة والتوصيات الفنية الميدانية', risk: 'action' },
        { key: 'INSPECTION.INTERIM', name: 'إجراء الاستلام المرحلي للأعمال', desc: 'معاينة الأعمال المنجزة في مراحل المشروع المختلفة', risk: 'critical' },
        { key: 'INSPECTION.FINAL', name: 'المشاركة في لجان الاستلام النهائي', desc: 'التوقيع والمصادقة على محضر الاستلام النهائي للمشروع', risk: 'critical' }
      ]
    },
    {
      id: 'budget_finance',
      name: 'الموازنة العامة والتخصيص المالي',
      icon: '💵',
      color: '#16a34a',
      description: 'إدارة بنود الموازنة، حجز المخصصات، ونقل الاعتمادات المالية للمشاريع',
      permissions: [
        { key: 'BUDGET.VIEW', name: 'عرض شاشة الموازنة العامة للمديرية', desc: 'الاطلاع على بنود وفصول الموازنة وسقوف الإنفاق', risk: 'normal' },
        { key: 'BUDGET.CREATE', name: 'إضافة بند موازنة جديد', desc: 'إدراج بند مالي وتحديد المخصص السنوي المعتمد', risk: 'action' },
        { key: 'BUDGET.EDIT', name: 'تعديل بنود وفصول الموازنة', desc: 'تحديث بيانات الفصل والمادة وتدوير المخصصات', risk: 'action' },
        { key: 'BUDGET.ALLOCATE', name: 'حجز وتخصيص مالي للمشاريع والعطاءات', desc: 'حجز الالتزامات المالية قبل الطرح أو التعاقد', risk: 'critical' },
        { key: 'PURCHASES.VIEW', name: 'عرض شاشة أوامر الشراء والتوريد', desc: 'الاطلاع على طلبات الشراء المحلي واستدراج العروض', risk: 'normal' },
        { key: 'PURCHASES.CREATE', name: 'إنشاء طلب شراء وتوريد', desc: 'طلب شراء مواد هندسية ولوازم ميدانية ومحروقات', risk: 'action' },
        { key: 'PURCHASES.EDIT', name: 'تعديل وتدقيق عروض الأسعار', desc: 'تفريغ عروض المناقصين وتحديد الفائز ومحضر الشراء', risk: 'action' },
        { key: 'PURCHASES.APPROVE', name: 'اعتماد طلب الشراء والصرف', desc: 'المصادقة الإدارية والمالية على أمر الشراء', risk: 'critical' }
      ]
    },
    {
      id: 'admin_security',
      name: 'الإدارة العامة والصلاحيات والتقارير والأرشيف',
      icon: '⚙️',
      color: '#4338ca',
      description: 'التحكم بالهوية، مسارات العمل، مصفوفة الصلاحيات، التقارير، والأرشيف الإلكتروني',
      permissions: [
        { key: 'REPORTS.VIEW', name: 'مركز التقارير والإحصائيات الهندسية', desc: 'توليد وطباعة التقارير الرسمية وتقارير الإنجاز التفصيلية', risk: 'normal' },
        { key: 'ARCHIVE.VIEW', name: 'عرض شاشة الأرشيف الإلكتروني', desc: 'استعراض الوثائق والمخططات الهندسية المؤرشفة', risk: 'normal' },
        { key: 'ARCHIVE.UPLOAD', name: 'رفع وأرشفة وثائق ومخططات', desc: 'إرفاق المستندات الممسوحة ضوئياً والمذكرات الرسمية', risk: 'action' },
        { key: 'SETTINGS.VIEW', name: 'عرض شاشة إعدادات النظام', desc: 'الاطلاع على الضوابط والمعايير الهندسية والهوية المؤسسية', risk: 'normal' },
        { key: 'SETTINGS.MANAGE', name: 'إدارة وتعديل إعدادات وهوية النظام', desc: 'تعديل المعايير الهندسية، محرك الترقيم، وقوالب الطباعة', risk: 'critical' },
        { key: 'USERS.MANAGE', name: 'إدارة حسابات المستخدمين وكلمات المرور', desc: 'إضافة وتعديل حسابات المهندسين والموظفين وتعيين الأقسام', risk: 'critical' },
        { key: 'ROLES.MANAGE', name: 'تصميم وإدارة الأدوار ومصفوفة الصلاحيات', desc: 'التحكم الديناميكي بمصفوفة الـ RBAC وصلاحيات الأزرار', risk: 'critical' },
        { key: 'WORKFLOWS.MANAGE', name: 'تصميم مسارات العمل وسلاسل الاعتماد', desc: 'تخصيص مراحل الموافقة والتفويض الإداري', risk: 'critical' },
        { key: 'AUDIT.VIEW', name: 'سجل الرقابة وتدقيق العمليات (Audit Trail)', desc: 'استعراض السجل الأمني الموحد لكافة حركات المستخدمين', risk: 'critical' }
      ]
    }
  ];

  class UnifiedSettingsManager {
    constructor(containerId) {
      this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      this.activeTab = 'engineering-rules'; // Default to requested tab or 'numbering'
      this.users = [];
      this.orgUnits = [];
      this.roles = [];
      this.permissions = [];
      this.assignments = [];
      this.lookups = [];
      this.workflows = [];
      this.activityLogs = [];
      this.backups = [];
      this.mapInstance = null;
      this.mapMarker = null;

      // 🔐 حالة مصفوفة الصلاحيات المركزية التفاعلية
      this.selectedMatrixRoleId = null;
      this.rolePermissionsCache = {};
      this.matrixSearchQuery = '';
      this.matrixCategoryFilter = 'ALL';

      this.stats = {
        usersCount: 0,
        unitsCount: 0,
        rolesCount: 0,
        lookupsCount: 0,
        workflowsCount: 0,
        backupsCount: 0
      };

      this.visualState = {
        appTitle: 'نظام إدارة المشاريع والأشغال الهندسية',
        municipalityName: 'بلدية كفرنجة الجديدة',
        directorateName: 'مديرية الأشغال والخدمات الهندسية',
        primaryColor: '#0f766e',
        secondaryColor: '#0284c7',
        accentColor: '#10b981',
        backgroundColor: '#0f172a',
        fontFamily: 'Tajawal',
        borderRadius: 12,
        darkMode: true,
        sessionTimeout: 15,
        headerLogo: '/logo.jpg',
        watermarkText: 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة',
        watermarkLogo: '',
        contactPhone: '02-6466001',
        contactEmail: 'info@kafrinja.gov.jo',
        fiscalYear: '2026',
        currency: 'د.أ',

        // 1. الضوابط والمعايير الهندسية والمالية الشاملة
        // أ. العطاءات والمشاريع
        max_variation_order_pct: 25.0,
        performance_bond_pct: 10.0,
        advance_payment_guarantee_pct: 100.0,
        max_advance_payment_pct: 10.0,
        maintenance_guarantee_pct: 5.0,
        maintenance_period_months: 12,
        daily_penalty_rate_pct: 0.1,
        max_delay_penalties_pct: 15.0,

        // ب. الاستقطاعات والضرائب على المطالبات
        default_retention_pct: 10.0,
        income_tax_withholding_pct: 0.0,
        revenue_stamps_pct: 0.6,
        contractors_syndicate_pct: 0.2,
        advance_recovery_rate_pct: 10.0,

        // ج. تسعيرات التعبيد وتصاريح الحفر
        paving_unit_rate_jod: 4.5,
        curbstone_unit_rate_jod: 6.0,
        interlock_unit_rate_jod: 8.5,
        asphalt_reinstatement_rate_jod: 18.0,
        basecourse_reinstatement_rate_jod: 8.0,
        permit_admin_fee_jod: 15.0,
        excavation_insurance_rate_jod: 25.0,

        // د. معايير جودة الرصفة وضبط الجودة
        pci_excellent_min: 85,
        pci_good_min: 70,
        pci_fair_min: 55,
        pci_poor_min: 40,
        default_asphalt_thickness_cm: 5.0,
        asphalt_delivery_temp_min_c: 145,
        min_compaction_rate_pct: 98.0,
        concrete_slump_target_cm: 8.0,

        // هـ. الأصول ومعدلات الإهلاك
        roads_useful_life_years: 15,
        bridges_useful_life_years: 40,
        machinery_useful_life_years: 10,
        lighting_useful_life_years: 7,
        asset_salvage_value_pct: 10.0,

        // 2. محرك الترقيم التلقائي
        prefix_tenders: 'TEN-',
        prefix_claims: 'CLM-',
        prefix_permits: 'PER-',
        prefix_paving: 'PAV-',
        prefix_tasks: 'TSK-',
        prefix_contracts: 'CNT-',

        // 3. التنبيهات الذكية
        guarantee_alert_days: '30,15,7',
        project_delay_threshold_pct: 15.0,
        auto_backup_enabled: true,
        auto_backup_time: '02:00',

        // 4. GIS والخرائط والأختام
        gis_center_lat: 32.3025,
        gis_center_lng: 35.7008,
        gis_default_zoom: 14,
        gis_map_layer: 'osm',
        director_stamp_b64: '',
        municipality_seal_b64: '',
        verification_portal_url: '/verify.html'
      };

      this.currentUser = this._getCurrentUser();
      this.init();
    }

    _getCurrentUser() {
      try {
        const u = localStorage.getItem('user') || sessionStorage.getItem('engineeringUser') || sessionStorage.getItem('user');
        return u ? JSON.parse(u) : { role: 'admin', fullName: 'المدير الهندسي - رئيس البلدية' };
      } catch (e) {
        return { role: 'admin', fullName: 'المدير الهندسي - رئيس البلدية' };
      }
    }

    _authFetch(url, opts = {}) {
      const token = localStorage.getItem('token') || (this.currentUser && this.currentUser.token) || '';
      const headers = Object.assign({}, opts.headers || {});
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
      if (!headers['Content-Type'] && !(opts.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      return fetch(url, Object.assign({}, opts, { headers }));
    }

    async init() {
      this.render();
      await Promise.all([
        this.fetchVisualIdentity(),
        this.fetchAllData()
      ]);
      this.render();
      this.updateBadge();
    }

    /* ── جلب الهوية البصرية وإعدادات النظام الكاملة ──────────────────────────── */
    async fetchVisualIdentity() {
      try {
        const res = await this._authFetch('/api/settings/identity');
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) {
            const d = json.data;
            if (d.app_title) this.visualState.appTitle = d.app_title;
            if (d.municipality_name) this.visualState.municipalityName = d.municipality_name;
            if (d.directorate_name) this.visualState.directorateName = d.directorate_name;
            if (d.primary_color) this.visualState.primaryColor = d.primary_color;
            if (d.secondary_color) this.visualState.secondaryColor = d.secondary_color;
            if (d.accent_color) this.visualState.accentColor = d.accent_color;
            if (d.background_color) this.visualState.backgroundColor = d.background_color;
            if (d.font_family) this.visualState.fontFamily = d.font_family;
            if (d.border_radius_px !== undefined) this.visualState.borderRadius = d.border_radius_px;
            if (d.dark_mode_enabled !== undefined) this.visualState.darkMode = d.dark_mode_enabled;
            if (d.session_timeout_minutes) this.visualState.sessionTimeout = d.session_timeout_minutes;
            if (d.fiscal_year) this.visualState.fiscalYear = d.fiscal_year;
            if (d.currency) this.visualState.currency = d.currency;
            if (d.watermark_text) this.visualState.watermarkText = d.watermark_text;
            if (d.header_logo_b64 || d.logo_path) this.visualState.headerLogo = d.header_logo_b64 || d.logo_path;
            if (d.watermark_logo_b64 || d.watermark_path) this.visualState.watermarkLogo = d.watermark_logo_b64 || d.watermark_path;

            // 1. المعايير الهندسية والمالية الشاملة
            if (d.max_variation_order_pct !== undefined) this.visualState.max_variation_order_pct = d.max_variation_order_pct;
            if (d.performance_bond_pct !== undefined) this.visualState.performance_bond_pct = d.performance_bond_pct;
            if (d.advance_payment_guarantee_pct !== undefined) this.visualState.advance_payment_guarantee_pct = d.advance_payment_guarantee_pct;
            if (d.max_advance_payment_pct !== undefined) this.visualState.max_advance_payment_pct = d.max_advance_payment_pct;
            if (d.maintenance_guarantee_pct !== undefined) this.visualState.maintenance_guarantee_pct = d.maintenance_guarantee_pct;
            if (d.maintenance_period_months !== undefined) this.visualState.maintenance_period_months = d.maintenance_period_months;
            if (d.daily_penalty_rate_pct !== undefined) this.visualState.daily_penalty_rate_pct = d.daily_penalty_rate_pct;
            if (d.max_delay_penalties_pct !== undefined) this.visualState.max_delay_penalties_pct = d.max_delay_penalties_pct;

            if (d.default_retention_pct !== undefined) this.visualState.default_retention_pct = d.default_retention_pct;
            if (d.income_tax_withholding_pct !== undefined) this.visualState.income_tax_withholding_pct = d.income_tax_withholding_pct;
            if (d.revenue_stamps_pct !== undefined) this.visualState.revenue_stamps_pct = d.revenue_stamps_pct;
            if (d.contractors_syndicate_pct !== undefined) this.visualState.contractors_syndicate_pct = d.contractors_syndicate_pct;
            if (d.advance_recovery_rate_pct !== undefined) this.visualState.advance_recovery_rate_pct = d.advance_recovery_rate_pct;

            if (d.paving_unit_rate_jod !== undefined) this.visualState.paving_unit_rate_jod = d.paving_unit_rate_jod;
            if (d.curbstone_unit_rate_jod !== undefined) this.visualState.curbstone_unit_rate_jod = d.curbstone_unit_rate_jod;
            if (d.interlock_unit_rate_jod !== undefined) this.visualState.interlock_unit_rate_jod = d.interlock_unit_rate_jod;
            if (d.asphalt_reinstatement_rate_jod !== undefined) this.visualState.asphalt_reinstatement_rate_jod = d.asphalt_reinstatement_rate_jod;
            if (d.basecourse_reinstatement_rate_jod !== undefined) this.visualState.basecourse_reinstatement_rate_jod = d.basecourse_reinstatement_rate_jod;
            if (d.permit_admin_fee_jod !== undefined) this.visualState.permit_admin_fee_jod = d.permit_admin_fee_jod;
            if (d.excavation_insurance_rate_jod !== undefined) this.visualState.excavation_insurance_rate_jod = d.excavation_insurance_rate_jod;

            if (d.pci_excellent_min !== undefined) this.visualState.pci_excellent_min = d.pci_excellent_min;
            if (d.pci_good_min !== undefined) this.visualState.pci_good_min = d.pci_good_min;
            if (d.pci_fair_min !== undefined) this.visualState.pci_fair_min = d.pci_fair_min;
            if (d.pci_poor_min !== undefined) this.visualState.pci_poor_min = d.pci_poor_min;
            if (d.default_asphalt_thickness_cm !== undefined) this.visualState.default_asphalt_thickness_cm = d.default_asphalt_thickness_cm;
            if (d.asphalt_delivery_temp_min_c !== undefined) this.visualState.asphalt_delivery_temp_min_c = d.asphalt_delivery_temp_min_c;
            if (d.min_compaction_rate_pct !== undefined) this.visualState.min_compaction_rate_pct = d.min_compaction_rate_pct;
            if (d.concrete_slump_target_cm !== undefined) this.visualState.concrete_slump_target_cm = d.concrete_slump_target_cm;

            if (d.roads_useful_life_years !== undefined) this.visualState.roads_useful_life_years = d.roads_useful_life_years;
            if (d.bridges_useful_life_years !== undefined) this.visualState.bridges_useful_life_years = d.bridges_useful_life_years;
            if (d.machinery_useful_life_years !== undefined) this.visualState.machinery_useful_life_years = d.machinery_useful_life_years;
            if (d.lighting_useful_life_years !== undefined) this.visualState.lighting_useful_life_years = d.lighting_useful_life_years;
            if (d.asset_salvage_value_pct !== undefined) this.visualState.asset_salvage_value_pct = d.asset_salvage_value_pct;

            // 2. الترقيم
            if (d.prefix_tenders) this.visualState.prefix_tenders = d.prefix_tenders;
            if (d.prefix_claims) this.visualState.prefix_claims = d.prefix_claims;
            if (d.prefix_permits) this.visualState.prefix_permits = d.prefix_permits;
            if (d.prefix_paving) this.visualState.prefix_paving = d.prefix_paving;
            if (d.prefix_tasks) this.visualState.prefix_tasks = d.prefix_tasks;
            if (d.prefix_contracts) this.visualState.prefix_contracts = d.prefix_contracts;

            // 3. التنبيهات
            if (d.guarantee_alert_days) this.visualState.guarantee_alert_days = d.guarantee_alert_days;
            if (d.project_delay_threshold_pct !== undefined) this.visualState.project_delay_threshold_pct = d.project_delay_threshold_pct;
            if (d.auto_backup_enabled !== undefined) this.visualState.auto_backup_enabled = d.auto_backup_enabled;
            if (d.auto_backup_time) this.visualState.auto_backup_time = d.auto_backup_time;

            // 4. GIS والأختام
            if (d.gis_center_lat !== undefined) this.visualState.gis_center_lat = d.gis_center_lat;
            if (d.gis_center_lng !== undefined) this.visualState.gis_center_lng = d.gis_center_lng;
            if (d.gis_default_zoom !== undefined) this.visualState.gis_default_zoom = d.gis_default_zoom;
            if (d.gis_map_layer) this.visualState.gis_map_layer = d.gis_map_layer;
            if (d.director_stamp_b64) this.visualState.director_stamp_b64 = d.director_stamp_b64;
            if (d.municipality_seal_b64) this.visualState.municipality_seal_b64 = d.municipality_seal_b64;
            if (d.verification_portal_url) this.visualState.verification_portal_url = d.verification_portal_url;

            // Auto-apply globally
            if (typeof window.applySystemIdentity === 'function') {
              window.applySystemIdentity(d);
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Visual identity fetch fallback');
      }
    }

    /* ── جلب كافة بيانات النظام الإدارية ───────────────────────────────────── */
    async fetchAllData() {
      try {
        const [uRes, ouRes, rRes, pRes, aRes, lRes, wRes, bRes, actRes] = await Promise.all([
          this._authFetch('/api/users').catch(() => null),
          this._authFetch('/api/org-units').catch(() => null),
          this._authFetch('/api/roles').catch(() => null),
          this._authFetch('/api/permissions').catch(() => null),
          this._authFetch('/api/user-org-units').catch(() => null),
          this._authFetch('/api/lookups').catch(() => null),
          this._authFetch('/api/workflows').catch(() => null),
          this._authFetch('/api/v4/admin/backups-list').catch(() => null),
          this._authFetch('/api/activity').catch(() => null)
        ]);

        if (uRes && uRes.ok) this.users = await uRes.json();
        if (ouRes && ouRes.ok) this.orgUnits = await ouRes.json();
        if (rRes && rRes.ok) this.roles = await rRes.json();
        if (pRes && pRes.ok) this.permissions = await pRes.json();
        if (aRes && aRes.ok) this.assignments = await aRes.json();
        if (lRes && lRes.ok) this.lookups = await lRes.json();
        if (wRes && wRes.ok) this.workflows = await wRes.json();
        if (bRes && bRes.ok) {
          const bJson = await bRes.json();
          this.backups = Array.isArray(bJson.data) ? bJson.data : [];
        }
        if (actRes && actRes.ok) {
          const actLogs = await actRes.json();
          this.activityLogs = Array.isArray(actLogs) ? actLogs : (Array.isArray(actLogs.data) ? actLogs.data : []);
        }

        this.stats.usersCount = Array.isArray(this.users) ? this.users.length : 0;
        this.stats.unitsCount = Array.isArray(this.orgUnits) ? this.orgUnits.length : 0;
        this.stats.rolesCount = Array.isArray(this.roles) ? this.roles.length : 0;
        this.stats.lookupsCount = Array.isArray(this.lookups) ? this.lookups.length : 0;
        this.stats.workflowsCount = Array.isArray(this.workflows) ? this.workflows.length : 0;
        this.stats.backupsCount = Array.isArray(this.backups) ? this.backups.length : 0;
        this.stats.activityCount = Array.isArray(this.activityLogs) ? this.activityLogs.length : 0;

        if (Array.isArray(this.roles) && this.roles.length > 0) {
          if (!this.selectedMatrixRoleId) {
            this.selectedMatrixRoleId = this.roles[0].id;
          }
          await this.fetchRolePermissions(this.selectedMatrixRoleId);
        }
      } catch (err) {
        console.warn('⚠️ Error fetching settings data:', err.message);
      }
    }

    async fetchActivityLogs() {
      try {
        const res = await this._authFetch('/api/activity');
        if (res.ok) {
          const logs = await res.json();
          this.activityLogs = Array.isArray(logs) ? logs : (Array.isArray(logs.data) ? logs.data : []);
          this.stats.activityCount = this.activityLogs.length;
          if (this.activeTab === 'activity') {
            const pane = document.getElementById('settings-tab-main-pane');
            if (pane) pane.innerHTML = this.renderActivityTab();
          }
        }
      } catch (e) {}
    }

    updateBadge() {
      const b = document.getElementById('badge-settings');
      if (b) b.textContent = this.stats.usersCount || '5';
    }

    switchTab(tabKey) {
      this.activeTab = tabKey;
      this.render();
      if (tabKey === 'gis-maps') {
        setTimeout(() => this.initGisMap(), 150);
      }
      if (tabKey === 'activity') {
        this.fetchActivityLogs();
      }
      if (tabKey === 'roles') {
        if (!this.selectedMatrixRoleId && Array.isArray(this.roles) && this.roles.length > 0) {
          this.selectedMatrixRoleId = this.roles[0].id;
        }
        if (this.selectedMatrixRoleId) {
          this.fetchRolePermissions(this.selectedMatrixRoleId).then(() => {
            const pane = document.getElementById('settings-tab-main-pane');
            if (pane && this.activeTab === 'roles') {
              pane.innerHTML = this.renderRolesTab();
            }
          });
        }
      }
    }

    _getTabBtnStyle(isActive) {
      if (isActive) {
        return 'padding:10px 18px; font-size:0.86rem; font-weight:800; border-radius:12px; border:1px solid rgba(56,189,248,0.5); background:linear-gradient(135deg, #0284c7, #0f766e); color:#ffffff; display:inline-flex; align-items:center; gap:8px; cursor:pointer; flex-shrink:0; white-space:nowrap; box-shadow:0 4px 16px rgba(2,132,199,0.35); transform:translateY(-1px); transition:all 0.2s ease;';
      }
      return 'padding:10px 16px; font-size:0.85rem; font-weight:700; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(30,41,59,0.6); color:var(--text-muted, #94a3b8); display:inline-flex; align-items:center; gap:8px; cursor:pointer; flex-shrink:0; white-space:nowrap; transition:all 0.2s ease;';
    }

    _getBadgeStyle(isActive) {
      if (isActive) {
        return 'background:rgba(255,255,255,0.28); color:#ffffff; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:800; margin-right:4px;';
      }
      return 'background:rgba(255,255,255,0.08); color:var(--text-muted, #94a3b8); padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:700; margin-right:4px;';
    }

    /* ── الهيكل الرئيسي لواجهة الإعدادات وإدارة النظام ───────────────────────── */
    render() {
      if (!this.container) {
        this.container = document.getElementById('settings-tab-container') || document.getElementById('page-settings');
      }
      if (!this.container) return;

      this.container.innerHTML = `
        <div class="settings-suite-wrapper" style="direction:rtl; font-family:'Tajawal',sans-serif; padding:4px 0 24px 0; color:var(--text, #0f172a); width:100%; box-sizing:border-box;">
          
          <!-- Executive Modern Header Card -->
          <div class="page-header" style="background:linear-gradient(135deg, rgba(30,58,138,0.4), rgba(15,118,110,0.3)); border:1px solid rgba(255,255,255,0.1); border-radius:18px; padding:20px 24px; margin-bottom:20px; backdrop-filter:blur(10px); box-shadow:0 8px 32px rgba(0,0,0,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:300px;">
              <div style="width:50px; height:50px; border-radius:14px; background:linear-gradient(135deg, #0284c7, #0f766e); display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow:0 6px 20px rgba(2,132,199,0.35); flex-shrink:0;">⚙️</div>
              <div>
                <h2 style="font-size:1.35rem; font-weight:900; color:#ffffff; margin:0 0 4px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                  <span>منظومة الإعدادات العامة وإدارة النظام الموحدة</span>
                  <span class="badge" style="background:linear-gradient(135deg, rgba(16,185,129,0.2), rgba(2,132,199,0.2)); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; font-size:0.75rem; font-weight:800; padding:3px 12px; border-radius:20px;">Zero-Code Enterprise v6.0</span>
                </h2>
                <p style="margin:0; font-size:0.85rem; color:#94a3b8;">
                  التحكم المركزي التام بالهوية، محرك الترقيم، المعايير والضوابط الهندسية الشاملة، نظم الخرائط والـ GIS، الأختام الرقمية، والصلاحيات
                </p>
              </div>
            </div>

            <!-- Header Quick Actions -->
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <input type="file" id="settings-json-import-input" accept=".json" style="display:none;" onchange="window.unifiedSettingsManager.handleImportConfigJson(this)" />
              <button class="btn btn-outline" onclick="document.getElementById('settings-json-import-input').click()" style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:0.84rem; padding:8px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#f8fafc;">
                <span>📥</span> <span>استيراد الإعدادات (JSON)</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.exportConfigurationJson()" style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:0.84rem; padding:8px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#f8fafc;">
                <span>📤</span> <span>تصدير الإعدادات (JSON)</span>
              </button>
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.triggerInstantBackup()" style="display:flex; align-items:center; gap:6px; font-weight:800; font-size:0.85rem; padding:8px 18px; border-radius:10px; background:linear-gradient(135deg, #10b981, #059669); border:none; color:#ffffff; box-shadow:0 4px 16px rgba(16,185,129,0.35);">
                <span>📦</span> <span>نسخة احتياطية مشفرة</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.checkServerHealth()" style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:8px 14px; font-weight:700; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#f8fafc;">
                <span style="color:#eab308;">⚡</span> <span>فحص الخادم</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.init()" style="display:flex; align-items:center; justify-content:center; width:38px; height:38px; padding:0; font-weight:bold; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:#f8fafc;" title="تحديث البيانات">
                <span>🔄</span>
              </button>
            </div>
          </div>

          <!-- Modern Categorized Tabs Navigation Bar -->
          <div class="settings-nav-tabs" style="background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:10px 14px; margin-bottom:22px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; box-shadow:0 6px 24px rgba(0,0,0,0.25); backdrop-filter:blur(10px);">
            
            <button type="button" class="settings-nav-btn ${this.activeTab === 'engineering-rules' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('engineering-rules')" style="${this._getTabBtnStyle(this.activeTab === 'engineering-rules')}">
              <span>📐</span> <span>المعايير الهندسية والمالية</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'numbering' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('numbering')" style="${this._getTabBtnStyle(this.activeTab === 'numbering')}">
              <span>🔢</span> <span>محرك الترقيم</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'visual-identity' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('visual-identity')" style="${this._getTabBtnStyle(this.activeTab === 'visual-identity')}">
              <span>🎨</span> <span>الهوية والمظهر</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'gis-maps' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('gis-maps')" style="${this._getTabBtnStyle(this.activeTab === 'gis-maps')}">
              <span>🗺️</span> <span>الـ GIS والأختام الرقمية</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'smart-alerts' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('smart-alerts')" style="${this._getTabBtnStyle(this.activeTab === 'smart-alerts')}">
              <span>🔔</span> <span>التنبيهات والأمان</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'users' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('users')" style="${this._getTabBtnStyle(this.activeTab === 'users')}">
              <span>👥</span> <span>المستخدمين</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'users')}">${this.stats.usersCount}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'org-units' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('org-units')" style="${this._getTabBtnStyle(this.activeTab === 'org-units')}">
              <span>🏛️</span> <span>الهيكل التنظيمي</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'org-units')}">${this.stats.unitsCount}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'roles' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('roles')" style="${this._getTabBtnStyle(this.activeTab === 'roles')}">
              <span>🔑</span> <span>الأدوار والصلاحيات</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'roles')}">${this.stats.rolesCount}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'lookups' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('lookups')" style="${this._getTabBtnStyle(this.activeTab === 'lookups')}">
              <span>🏷️</span> <span>جداول الترميز</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'lookups')}">${this.stats.lookupsCount}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'workflows' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('workflows')" style="${this._getTabBtnStyle(this.activeTab === 'workflows')}">
              <span>⛓️</span> <span>مسارات العمل</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'workflows')}">${this.stats.workflowsCount}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'server' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('server')" style="${this._getTabBtnStyle(this.activeTab === 'server')}">
              <span>🖥️</span> <span>الخادم والنسخ الاحتياطي</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'server')}">${this.stats.backupsCount || 0}</span>
            </button>

            <button type="button" class="settings-nav-btn ${this.activeTab === 'activity' ? 'active' : ''}" onclick="window.unifiedSettingsManager.switchTab('activity')" style="${this._getTabBtnStyle(this.activeTab === 'activity')}">
              <span>🕵️</span> <span>سجل النشاطات</span>
              <span style="${this._getBadgeStyle(this.activeTab === 'activity')}">${this.stats.activityCount || 0}</span>
            </button>

          </div>

          <!-- Dynamic Active Tab Content Container -->
          <div id="settings-tab-main-pane">
            ${this.renderTabContent()}
          </div>

        </div>
      `;
    }

    /* ── عرض محتوى التبويب النشط ───────────────────────────────────────────── */
    renderTabContent() {
      switch (this.activeTab) {
        case 'engineering-rules':
          return this.renderEngineeringRulesTab();
        case 'numbering':
          return this.renderNumberingTab();
        case 'smart-alerts':
          return this.renderSmartAlertsTab();
        case 'gis-maps':
          return this.renderGisMapsTab();
        case 'visual-identity':
          return this.renderVisualIdentityTab();
        case 'users':
        case 'assignments':
          return this.renderUsersTab();
        case 'org-units':
          return this.renderOrgUnitsTab();
        case 'roles':
          return this.renderRolesTab();
        case 'lookups':
          return this.renderLookupsTab();
        case 'workflows':
          return this.renderWorkflowsTab();
        case 'server':
          return this.renderServerTab();
        case 'activity':
          return this.renderActivityTab();
        default:
          return this.renderEngineeringRulesTab();
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       1. تبويب المعايير والضوابط الهندسية والمالية الشاملة
       ═══════════════════════════════════════════════════════════════════════════ */
    renderEngineeringRulesTab() {
      return `
        <div style="display:flex; flex-direction:column; gap:20px;">
          
          <!-- Top Executive Banner -->
          <div style="background:linear-gradient(135deg, rgba(15,118,110,0.09), rgba(2,132,199,0.09)); border:1px solid var(--border); border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.15rem; font-weight:800; color:var(--primary, #0f766e); display:flex; align-items:center; gap:8px;">
                <span>📐</span> <span>مصفوفة المعايير والضوابط الهندسية والمالية الشاملة للنظام</span>
              </h3>
              <p style="margin:0; font-size:0.84rem; color:var(--text-muted);">
                تحديد ومطابقة كافة الضوابط القانونية للعطاءات، استقطاعات المستخلصات، تسعيرات التعبيد والحفريات، اشتراطات جودة الطرق (PCI)، ومعدلات إهلاك الأصول
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.resetEngineeringDefaults()" style="font-weight:700; font-size:0.84rem; color:#d97706; border-color:#d97706;">
                <span>🔄</span> <span>القيم الوزارية القياسية</span>
              </button>
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveEngineeringRules()" style="font-weight:800; font-size:0.86rem; padding:8px 22px; display:flex; align-items:center; gap:6px;">
                <span>💾</span> <span>حفظ وتعميم كافة المعايير</span>
              </button>
            </div>
          </div>

          <!-- Cards Grid for all 5 Standard Categories -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(350px, 1fr)); gap:18px;">
            
            <!-- 1. الضوابط المالية للعطاءات والمشاريع -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="font-size:1.02rem; font-weight:800; color:#1e3a8a; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>📋</span> <span>ضوابط العطاءات والمشاريع الرأسمالية</span>
                </h4>
                <span class="badge" style="background:rgba(30,58,138,0.1); color:#1e3a8a; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Tenders</span>
              </div>

              <!-- Max Variation Orders -->
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                  <label style="font-size:0.82rem; font-weight:800; color:var(--text);">الحد الأقصى لأوامر التغيير التراكمية (%)</label>
                  <span id="label-val-vo" style="font-weight:800; color:#dc2626; font-size:0.9rem;">${this.visualState.max_variation_order_pct || 25}%</span>
                </div>
                <input type="range" id="cfg-maxVoPct-range" min="5" max="50" step="0.5" value="${this.visualState.max_variation_order_pct || 25.0}" oninput="document.getElementById('cfg-maxVoPct').value = this.value; document.getElementById('label-val-vo').textContent = this.value + '%';" style="width:100%; accent-color:#0f766e;" />
                <input type="number" id="cfg-maxVoPct" class="form-control" value="${this.visualState.max_variation_order_pct || 25.0}" step="0.5" oninput="document.getElementById('cfg-maxVoPct-range').value = this.value; document.getElementById('label-val-vo').textContent = this.value + '%';" style="width:100%; padding:6px 10px; border-radius:6px; font-weight:bold; margin-top:2px;" />
              </div>

              <!-- Performance Bond & Advance Payment Pct -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">كفالة حسن التنفيذ (%)</label>
                  <input type="number" id="cfg-perfBondPct" class="form-control" value="${this.visualState.performance_bond_pct || 10.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سقف الدفعة المقدمة (%)</label>
                  <input type="number" id="cfg-maxAdvPct" class="form-control" value="${this.visualState.max_advance_payment_pct || 10.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Maintenance Guarantee & Period -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">كفالة الصيانة والضمان (%)</label>
                  <input type="number" id="cfg-maintBondPct" class="form-control" value="${this.visualState.maintenance_guarantee_pct || 5.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">فترة الضمان (أشهر)</label>
                  <input type="number" id="cfg-maintPeriodMonths" class="form-control" value="${this.visualState.maintenance_period_months || 12}" min="1" max="60" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Daily Delay Penalty & Max Penalties -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">غرامة التأخير اليومية (%)</label>
                  <input type="number" id="cfg-dailyPenaltyRate" class="form-control" value="${this.visualState.daily_penalty_rate_pct || 0.1}" step="0.01" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سقف الغرامات الإجمالي (%)</label>
                  <input type="number" id="cfg-maxDelayPenalties" class="form-control" value="${this.visualState.max_delay_penalties_pct || 15.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>
            </div>

            <!-- 2. استقطاعات وضرائب ورسوم المستخلصات المالية -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="font-size:1.02rem; font-weight:800; color:#0f766e; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>📝</span> <span>استقطاعات وضرائب المستخلصات المالية</span>
                </h4>
                <span class="badge" style="background:rgba(15,118,110,0.1); color:#0f766e; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Claims & Deductions</span>
              </div>

              <!-- Retention Pct -->
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                  <label style="font-size:0.82rem; font-weight:800; color:var(--text);">استقطاع حسن التنفيذ التلقائي (Retention %)</label>
                  <span id="label-val-ret" style="font-weight:800; color:#0284c7; font-size:0.9rem;">${this.visualState.default_retention_pct || 10}%</span>
                </div>
                <input type="range" id="cfg-retentionPct-range" min="0" max="20" step="0.5" value="${this.visualState.default_retention_pct || 10.0}" oninput="document.getElementById('cfg-retentionPct').value = this.value; document.getElementById('label-val-ret').textContent = this.value + '%'; window.unifiedSettingsManager.updateClaimSim();" style="width:100%; accent-color:#0284c7;" />
                <input type="number" id="cfg-retentionPct" class="form-control" value="${this.visualState.default_retention_pct || 10.0}" step="0.5" oninput="document.getElementById('cfg-retentionPct-range').value = this.value; document.getElementById('label-val-ret').textContent = this.value + '%'; window.unifiedSettingsManager.updateClaimSim();" style="width:100%; padding:6px 10px; border-radius:6px; font-weight:bold; margin-top:2px;" />
              </div>

              <!-- Income Tax & Revenue Stamps -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">اقتطاع ضريبة الدخل (%)</label>
                  <input type="number" id="cfg-taxWithholding" class="form-control" value="${this.visualState.income_tax_withholding_pct || 0.0}" step="0.5" oninput="window.unifiedSettingsManager.updateClaimSim()" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">طوابع الواردات (%)</label>
                  <input type="number" id="cfg-revenueStamps" class="form-control" value="${this.visualState.revenue_stamps_pct || 0.6}" step="0.1" oninput="window.unifiedSettingsManager.updateClaimSim()" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Contractors Syndicate & Advance Recovery -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">رسوم نقابة المقاولين (%)</label>
                  <input type="number" id="cfg-syndicateFee" class="form-control" value="${this.visualState.contractors_syndicate_pct || 0.2}" step="0.05" oninput="window.unifiedSettingsManager.updateClaimSim()" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">استرداد الدفعة المقدمة (%)</label>
                  <input type="number" id="cfg-advRecovery" class="form-control" value="${this.visualState.advance_recovery_rate_pct || 10.0}" step="0.5" oninput="window.unifiedSettingsManager.updateClaimSim()" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Live Claim Payout Simulator -->
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; font-size:0.76rem;">
                <div style="font-weight:bold; color:var(--text); margin-bottom:4px;">🧪 محاكي احتساب المستخلص المالي الحي:</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span>إنجاز المطالبة: <input type="number" id="sim-claim-gross" value="10000" style="width:75px; padding:2px 4px; font-weight:bold;" oninput="window.unifiedSettingsManager.updateClaimSim()" /> د.أ</span>
                  <span>الصافي: <b id="sim-claim-net" style="color:#16a34a; font-size:0.85rem;">8,920.00 د.أ</b></span>
                </div>
                <div id="sim-claim-details" style="color:var(--text-muted); font-size:0.72rem;">استقطاع حسن تنفيذ: 1,000 د.أ | طوابع: 60 د.أ | نقابة: 20 د.أ</div>
              </div>
            </div>

            <!-- 3. تسعيرات عوائد التعبيد وتصاريح الحفر -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="font-size:1.02rem; font-weight:800; color:#d97706; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>💰</span> <span>تسعيرات التعبيد وتصاريح الحفر وتنسيق الخدمات</span>
                </h4>
                <span class="badge" style="background:rgba(217,119,6,0.1); color:#d97706; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Tariffs & Paving</span>
              </div>

              <!-- Paving, Curbstone, Interlock Rates -->
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:var(--text); margin-bottom:4px;">إسفلت (د.أ/م²)</label>
                  <input type="number" id="cfg-pavingRate" class="form-control" value="${this.visualState.paving_unit_rate_jod || 4.5}" step="0.1" oninput="window.unifiedSettingsManager.updatePavingSim()" style="width:100%; padding:6px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:var(--text); margin-bottom:4px;">بردورات (د.أ/م.ط)</label>
                  <input type="number" id="cfg-curbstoneRate" class="form-control" value="${this.visualState.curbstone_unit_rate_jod || 6.0}" step="0.5" style="width:100%; padding:6px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:800; color:var(--text); margin-bottom:4px;">إنترلوك (د.أ/م²)</label>
                  <input type="number" id="cfg-interlockRate" class="form-control" value="${this.visualState.interlock_unit_rate_jod || 8.5}" step="0.5" style="width:100%; padding:6px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Excavation Reinstatements -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">إعادة تأهيل حفر إسفلت (د.أ/م²)</label>
                  <input type="number" id="cfg-asphaltReinstate" class="form-control" value="${this.visualState.asphalt_reinstatement_rate_jod || 18.0}" step="1.0" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">إعادة تأهيل بيسكورس (د.أ/م²)</label>
                  <input type="number" id="cfg-baseReinstate" class="form-control" value="${this.visualState.basecourse_reinstatement_rate_jod || 8.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Permit Admin Fee & Insurance Rate -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">رسم التصريح الإداري (د.أ)</label>
                  <input type="number" id="cfg-permitFee" class="form-control" value="${this.visualState.permit_admin_fee_jod || 15.0}" step="1.0" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">تأمين حفر الخدمات (د.أ/م²)</label>
                  <input type="number" id="cfg-excavInsurance" class="form-control" value="${this.visualState.excavation_insurance_rate_jod || 25.0}" step="1.0" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Paving Mini Simulator -->
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; font-size:0.76rem;">
                <div style="font-weight:bold; color:var(--text); margin-bottom:4px;">💡 تجربة احتساب سريعة لقطعة تنظيمية:</div>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                  <span>واجهة: <input type="number" id="sim-frontage" value="20" style="width:45px; padding:2px 4px; font-weight:bold;" oninput="window.unifiedSettingsManager.updatePavingSim()" /> م × شارع: <input type="number" id="sim-width" value="12" style="width:45px; padding:2px 4px; font-weight:bold;" oninput="window.unifiedSettingsManager.updatePavingSim()" /> م</span>
                  <span>التحقق: <b id="sim-paving-total" style="color:#16a34a; font-size:0.85rem;">540.00 د.أ</b></span>
                </div>
              </div>
            </div>

            <!-- 4. معايير جودة الرصفة وضبط الجودة الفنية -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="font-size:1.02rem; font-weight:800; color:#16a34a; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>🛣️</span> <span>عتبات جودة الطرق وضبط الجودة الفنية (PCI)</span>
                </h4>
                <span class="badge" style="background:rgba(22,163,74,0.1); color:#16a34a; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">ASTM D6433</span>
              </div>

              <!-- PCI Thresholds -->
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px;">
                <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:6px; padding:6px; text-align:center;">
                  <label style="display:block; font-size:0.7rem; font-weight:800; color:#166534;">🟢 ممتاز</label>
                  <input type="number" id="cfg-pciExc" class="form-control" value="${this.visualState.pci_excellent_min || 85}" min="75" max="100" style="width:100%; padding:4px; font-weight:bold; text-align:center;" />
                </div>
                <div style="background:#fefce8; border:1px solid #fde047; border-radius:6px; padding:6px; text-align:center;">
                  <label style="display:block; font-size:0.7rem; font-weight:800; color:#854d0e;">🟡 جيد</label>
                  <input type="number" id="cfg-pciGood" class="form-control" value="${this.visualState.pci_good_min || 70}" min="60" max="84" style="width:100%; padding:4px; font-weight:bold; text-align:center;" />
                </div>
                <div style="background:#fff7ed; border:1px solid #fdba74; border-radius:6px; padding:6px; text-align:center;">
                  <label style="display:block; font-size:0.7rem; font-weight:800; color:#9a3412;">🟠 متوسط</label>
                  <input type="number" id="cfg-pciFair" class="form-control" value="${this.visualState.pci_fair_min || 55}" min="40" max="69" style="width:100%; padding:4px; font-weight:bold; text-align:center;" />
                </div>
                <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; padding:6px; text-align:center;">
                  <label style="display:block; font-size:0.7rem; font-weight:800; color:#991b1b;">🔴 سيء</label>
                  <input type="number" id="cfg-pciPoor" class="form-control" value="${this.visualState.pci_poor_min || 40}" min="20" max="54" style="width:100%; padding:4px; font-weight:bold; text-align:center;" />
                </div>
              </div>

              <!-- Technical QA/QC specs -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سماكة الإسفلت (سم)</label>
                  <input type="number" id="cfg-asphaltThick" class="form-control" value="${this.visualState.default_asphalt_thickness_cm || 5.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">حرارة التوريد الأدنى (°C)</label>
                  <input type="number" id="cfg-asphaltTemp" class="form-control" value="${this.visualState.asphalt_delivery_temp_min_c || 145}" step="5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">نسبة الدمك المطلوبة (%)</label>
                  <input type="number" id="cfg-minCompact" class="form-control" value="${this.visualState.min_compaction_rate_pct || 98.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">هبوط الخرسانة Slump (سم)</label>
                  <input type="number" id="cfg-concreteSlump" class="form-control" value="${this.visualState.concrete_slump_target_cm || 8.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>
            </div>

            <!-- 5. الأعمار التشغيلية للأصول ومعدلات الإهلاك -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <h4 style="font-size:1.02rem; font-weight:800; color:#7c3aed; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>🏗️</span> <span>الأعمار التشغيلية للأصول ومعدلات الإهلاك</span>
                </h4>
                <span class="badge" style="background:rgba(124,58,237,0.1); color:#7c3aed; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Asset Life</span>
              </div>

              <!-- Roads & Bridges Life -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">العمر الافتراضي للطرق (سنة)</label>
                  <input type="number" id="cfg-roadsLife" class="form-control" value="${this.visualState.roads_useful_life_years || 15}" min="5" max="50" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">الجسور والعبارات (سنة)</label>
                  <input type="number" id="cfg-bridgesLife" class="form-control" value="${this.visualState.bridges_useful_life_years || 40}" min="10" max="100" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Machinery & Lighting Life -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">الآليات والمعدات (سنة)</label>
                  <input type="number" id="cfg-machineryLife" class="form-control" value="${this.visualState.machinery_useful_life_years || 10}" min="3" max="30" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">إنارة الشوارع LED (سنة)</label>
                  <input type="number" id="cfg-lightingLife" class="form-control" value="${this.visualState.lighting_useful_life_years || 7}" min="2" max="20" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- Salvage Value -->
              <div>
                <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">نسبة القيمة التخريدية المتبقية للأصل (%)</label>
                <input type="number" id="cfg-salvageValue" class="form-control" value="${this.visualState.asset_salvage_value_pct || 10.0}" step="0.5" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                <p style="margin:4px 0 0 0; font-size:0.72rem; color:var(--text-muted);">تُعتمد في حساب قسط الإهلاك السنوي للأصول الثابتة وفق طريقة القسط الثابت</p>
              </div>
            </div>

            <!-- 6. صلاحيات وسقوف لجان الشراء والعطاءات (Purchase Committees & Authority Financial Ceilings) -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02); grid-column: 1 / -1;">
              <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <h4 style="font-size:1.05rem; font-weight:800; color:#0284c7; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>⚖️</span> <span>صلاحيات وسقوف لجان الشراء والجهات المختصة (Financial Ceilings per Purchase Committee)</span>
                </h4>
                <div style="display:flex; align-items:center; gap:10px;">
                  <label style="font-size:0.78rem; font-weight:bold; color:var(--text); display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="cfg-enforceCommittees" ${this.visualState.enforce_committee_ceilings !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:#0284c7;" />
                    <span>تفعيل التدقيق والتحقق التلقائي عند إدخال العطاءات والمشتريات</span>
                  </label>
                  <span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">نظام المشتريات البلدية</span>
                </div>
              </div>

              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">
                تحديد السقوف المالية المعتمدة قانونياً لكل جهة ولجنة شراء وفق تعليمات المشتريات الحكومية البلدية، حيث يقوم النظام بالتحقق اللحظي من قيمة المعاملة ومطابقتها مع صلاحية اللجنة المختصة.
              </p>

              <!-- شبكة حقول السقوف المالية للجان -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
                
                <!-- سقف رئيس البلدية -->
                <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border); border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <label style="font-size:0.83rem; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                      <span>👤</span> <span>سقف صلاحية رئيس البلدية</span>
                    </label>
                    <span style="font-size:0.75rem; color:#0284c7; font-weight:bold;">الشراء المباشر والخدمات</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="cfg-mayorCeiling" class="form-control" value="${this.visualState.mayor_purchase_ceiling_jod !== undefined ? this.visualState.mayor_purchase_ceiling_jod : 5000.0}" step="100" oninput="window.unifiedSettingsManager.updateCommitteeSim()" style="width:100%; padding:8px 10px; border-radius:8px; font-weight:bold; font-size:0.95rem; color:#0284c7;" />
                    <span style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">د.أ</span>
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">الحد المالي الأقصى لمعاملات الشراء بقرار مباشر من الرئيس دون الحاجة للجنة.</div>
                </div>

                <!-- سقف لجنة الشراء المحلية -->
                <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border); border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <label style="font-size:0.83rem; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                      <span>👥</span> <span>سقف لجنة الشراء المحلية</span>
                    </label>
                    <span style="font-size:0.75rem; color:#10b981; font-weight:bold;">Local Committee</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="cfg-localCommCeiling" class="form-control" value="${this.visualState.local_committee_ceiling_jod !== undefined ? this.visualState.local_committee_ceiling_jod : 20000.0}" step="500" oninput="window.unifiedSettingsManager.updateCommitteeSim()" style="width:100%; padding:8px 10px; border-radius:8px; font-weight:bold; font-size:0.95rem; color:#10b981;" />
                    <span style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">د.أ</span>
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">سقف صلاحيات لجنة الشراء المحلية المشكلة بالمديرية والبلدية.</div>
                </div>

                <!-- سقف لجنة الشراء الرئيسية -->
                <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border); border-radius:10px; padding:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <label style="font-size:0.83rem; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                      <span>🏛️</span> <span>سقف لجنة الشراء الرئيسية</span>
                    </label>
                    <span style="font-size:0.75rem; color:#8b5cf6; font-weight:bold;">Main Committee</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" id="cfg-mainCommCeiling" class="form-control" value="${this.visualState.main_committee_ceiling_jod !== undefined ? this.visualState.main_committee_ceiling_jod : 100000.0}" step="1000" oninput="window.unifiedSettingsManager.updateCommitteeSim()" style="width:100%; padding:8px 10px; border-radius:8px; font-weight:bold; font-size:0.95rem; color:#8b5cf6;" />
                    <span style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">د.أ</span>
                  </div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">سقف صلاحيات لجنة الشراء الرئيسية للعطاءات الكبرى والمشاريع المركزية.</div>
                </div>

              </div>

              <!-- سقوف طرق الشراء (شراء مباشر، استدراج عروض، مناقصة محدودة) -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; border-top:1px dashed var(--border); padding-top:10px;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سقف الشراء المباشر (د.أ)</label>
                  <input type="number" id="cfg-directPurchaseCeiling" class="form-control" value="${this.visualState.direct_purchase_ceiling_jod !== undefined ? this.visualState.direct_purchase_ceiling_jod : 3000.0}" step="100" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سقف استدراج العروض (د.أ)</label>
                  <input type="number" id="cfg-quotationCeiling" class="form-control" value="${this.visualState.quotation_request_ceiling_jod !== undefined ? this.visualState.quotation_request_ceiling_jod : 15000.0}" step="500" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:800; color:var(--text); margin-bottom:4px;">سقف المناقصة المحدودة (د.أ)</label>
                  <input type="number" id="cfg-limitedTenderCeiling" class="form-control" value="${this.visualState.limited_tender_ceiling_jod !== undefined ? this.visualState.limited_tender_ceiling_jod : 50000.0}" step="1000" style="width:100%; padding:6px 8px; border-radius:6px; font-weight:bold;" />
                </div>
              </div>

              <!-- محاكي فحص الصلاحية الحي -->
              <div style="background:rgba(2,132,199,0.05); border:1px solid rgba(2,132,199,0.2); border-radius:8px; padding:12px; font-size:0.78rem;">
                <div style="font-weight:bold; color:var(--text); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                  <span>🧪</span> <span>محاكي فحص ومطابقة الصلاحية للجان الشراء:</span>
                </div>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                  <div>
                    <span>القيمة: </span>
                    <input type="number" id="sim-comm-val" value="12000" style="width:90px; padding:4px 6px; font-weight:bold;" oninput="window.unifiedSettingsManager.updateCommitteeSim()" /> د.أ
                  </div>
                  <div>
                    <span>اللجنة: </span>
                    <select id="sim-comm-select" style="padding:4px 8px; font-weight:bold;" onchange="window.unifiedSettingsManager.updateCommitteeSim()">
                      <option value="الرئيس">رئيس البلدية</option>
                      <option value="لجنة الشراء المحلية" selected>لجنة الشراء المحلية</option>
                      <option value="لجنة الشراء الرئيسية">لجنة الشراء الرئيسية</option>
                    </select>
                  </div>
                  <div id="sim-comm-result" style="font-weight:bold; font-size:0.85rem; color:#16a34a; padding:4px 10px; background:rgba(22,163,74,0.1); border-radius:6px; border:1px solid rgba(22,163,74,0.2);">
                    ✅ مطابقة وضمن سقف الصلاحية المعتمد
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Bottom Big Save Button -->
          <div style="padding-top:10px; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveEngineeringRules()" style="font-weight:800; padding:12px 32px; font-size:0.96rem; display:flex; align-items:center; gap:10px; box-shadow:0 4px 14px rgba(15,118,110,0.3);">
              <span>💾</span> <span>حفظ وتعميم كافة المعايير الهندسية والمالية على مستوى المنظومة</span>
            </button>
          </div>

        </div>
      `;
    }

    updateClaimSim() {
      const gross = parseFloat(document.getElementById('sim-claim-gross')?.value || 10000);
      const retPct = parseFloat(document.getElementById('cfg-retentionPct')?.value || 10);
      const taxPct = parseFloat(document.getElementById('cfg-taxWithholding')?.value || 0);
      const stampsPct = parseFloat(document.getElementById('cfg-revenueStamps')?.value || 0.6);
      const syndPct = parseFloat(document.getElementById('cfg-syndicateFee')?.value || 0.2);

      const retAmt = gross * (retPct / 100);
      const taxAmt = gross * (taxPct / 100);
      const stampsAmt = gross * (stampsPct / 100);
      const syndAmt = gross * (syndPct / 100);

      const totalDed = retAmt + taxAmt + stampsAmt + syndAmt;
      const net = Math.max(0, gross - totalDed);

      const netEl = document.getElementById('sim-claim-net');
      const detEl = document.getElementById('sim-claim-details');
      if (netEl) netEl.textContent = net.toLocaleString('ar-JO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.أ';
      if (detEl) detEl.textContent = `استقطاع حسن تنفيذ: ${retAmt.toFixed(0)} د.أ | طوابع: ${stampsAmt.toFixed(1)} د.أ | نقابة: ${syndAmt.toFixed(1)} د.أ ${taxAmt > 0 ? `| ضريبة: ${taxAmt.toFixed(1)} د.أ` : ''}`;
    }

    updatePavingSim() {
      const rate = parseFloat(document.getElementById('cfg-pavingRate')?.value || 4.5);
      const frontage = parseFloat(document.getElementById('sim-frontage')?.value || 20);
      const width = parseFloat(document.getElementById('sim-width')?.value || 12);
      const assessedWidth = width / 2;
      const total = frontage * assessedWidth * rate;
      const el = document.getElementById('sim-paving-total');
      if (el) el.textContent = total.toFixed(2) + ' د.أ';
    }

    updateCommitteeSim() {
      const val = parseFloat(document.getElementById('sim-comm-val')?.value || 0);
      const comm = document.getElementById('sim-comm-select')?.value || 'لجنة الشراء المحلية';
      const mayorC = parseFloat(document.getElementById('cfg-mayorCeiling')?.value || 5000);
      const localC = parseFloat(document.getElementById('cfg-localCommCeiling')?.value || 20000);
      const mainC = parseFloat(document.getElementById('cfg-mainCommCeiling')?.value || 100000);

      let maxAllowed = Infinity;
      if (comm === 'الرئيس' || comm === 'رئيس البلدية') maxAllowed = mayorC;
      else if (comm === 'لجنة الشراء المحلية') maxAllowed = localC;
      else if (comm === 'لجنة الشراء الرئيسية') maxAllowed = mainC;

      const resEl = document.getElementById('sim-comm-result');
      if (!resEl) return;
      if (val <= maxAllowed) {
        resEl.style.color = '#16a34a';
        resEl.style.background = 'rgba(22,163,74,0.1)';
        resEl.style.borderColor = 'rgba(22,163,74,0.2)';
        resEl.innerHTML = `✅ مطابقة وضمن سقف الصلاحية (السقف المعتمد: ${maxAllowed.toLocaleString('ar-JO')} د.أ)`;
      } else {
        resEl.style.color = '#ef4444';
        resEl.style.background = 'rgba(239,68,68,0.1)';
        resEl.style.borderColor = 'rgba(239,68,68,0.2)';
        resEl.innerHTML = `❌ تجاوز للصلاحية المحددة! تتطلب الإحالة للجنة أعلى (السقف: ${maxAllowed.toLocaleString('ar-JO')} د.أ)`;
      }
    }

    resetEngineeringDefaults() {
      if (!confirm('هل تود استرجاع القيم والضوابط الهندسية والمالية القياسية المعتمدة من وزارة الإدارة المحلية؟')) return;
      document.getElementById('cfg-maxVoPct').value = 25.0;
      document.getElementById('cfg-maxVoPct-range').value = 25.0;
      document.getElementById('label-val-vo').textContent = '25%';
      document.getElementById('cfg-perfBondPct').value = 10.0;
      document.getElementById('cfg-maxAdvPct').value = 10.0;
      document.getElementById('cfg-maintBondPct').value = 5.0;
      document.getElementById('cfg-maintPeriodMonths').value = 12;
      document.getElementById('cfg-dailyPenaltyRate').value = 0.1;
      document.getElementById('cfg-maxDelayPenalties').value = 15.0;

      document.getElementById('cfg-retentionPct').value = 10.0;
      document.getElementById('cfg-retentionPct-range').value = 10.0;
      document.getElementById('label-val-ret').textContent = '10%';
      document.getElementById('cfg-taxWithholding').value = 0.0;
      document.getElementById('cfg-revenueStamps').value = 0.6;
      document.getElementById('cfg-syndicateFee').value = 0.2;
      document.getElementById('cfg-advRecovery').value = 10.0;

      document.getElementById('cfg-pavingRate').value = 4.5;
      document.getElementById('cfg-curbstoneRate').value = 6.0;
      document.getElementById('cfg-interlockRate').value = 8.5;
      document.getElementById('cfg-asphaltReinstate').value = 18.0;
      document.getElementById('cfg-baseReinstate').value = 8.0;
      document.getElementById('cfg-permitFee').value = 15.0;
      document.getElementById('cfg-excavInsurance').value = 25.0;

      document.getElementById('cfg-pciExc').value = 85;
      document.getElementById('cfg-pciGood').value = 70;
      document.getElementById('cfg-pciFair').value = 55;
      document.getElementById('cfg-pciPoor').value = 40;
      document.getElementById('cfg-asphaltThick').value = 5.0;
      document.getElementById('cfg-asphaltTemp').value = 145;
      document.getElementById('cfg-minCompact').value = 98.0;
      document.getElementById('cfg-concreteSlump').value = 8.0;

      document.getElementById('cfg-roadsLife').value = 15;
      document.getElementById('cfg-bridgesLife').value = 40;
      document.getElementById('cfg-machineryLife').value = 10;
      document.getElementById('cfg-lightingLife').value = 7;
      document.getElementById('cfg-salvageValue').value = 10.0;

      if (document.getElementById('cfg-mayorCeiling')) document.getElementById('cfg-mayorCeiling').value = 5000.0;
      if (document.getElementById('cfg-localCommCeiling')) document.getElementById('cfg-localCommCeiling').value = 20000.0;
      if (document.getElementById('cfg-mainCommCeiling')) document.getElementById('cfg-mainCommCeiling').value = 100000.0;
      if (document.getElementById('cfg-directPurchaseCeiling')) document.getElementById('cfg-directPurchaseCeiling').value = 3000.0;
      if (document.getElementById('cfg-quotationCeiling')) document.getElementById('cfg-quotationCeiling').value = 15000.0;
      if (document.getElementById('cfg-limitedTenderCeiling')) document.getElementById('cfg-limitedTenderCeiling').value = 50000.0;
      if (document.getElementById('cfg-enforceCommittees')) document.getElementById('cfg-enforceCommittees').checked = true;

      this.updateClaimSim();
      this.updatePavingSim();
      this.updateCommitteeSim();
      showToast('🔄 تم استرجاع القيم القياسية');
    }

    async saveEngineeringRules() {
      const payload = {
        max_variation_order_pct: parseFloat(document.getElementById('cfg-maxVoPct')?.value || 25.0),
        performance_bond_pct: parseFloat(document.getElementById('cfg-perfBondPct')?.value || 10.0),
        max_advance_payment_pct: parseFloat(document.getElementById('cfg-maxAdvPct')?.value || 10.0),
        advance_payment_guarantee_pct: 100.0,
        maintenance_guarantee_pct: parseFloat(document.getElementById('cfg-maintBondPct')?.value || 5.0),
        maintenance_period_months: parseInt(document.getElementById('cfg-maintPeriodMonths')?.value || 12, 10),
        daily_penalty_rate_pct: parseFloat(document.getElementById('cfg-dailyPenaltyRate')?.value || 0.1),
        max_delay_penalties_pct: parseFloat(document.getElementById('cfg-maxDelayPenalties')?.value || 15.0),

        default_retention_pct: parseFloat(document.getElementById('cfg-retentionPct')?.value || 10.0),
        income_tax_withholding_pct: parseFloat(document.getElementById('cfg-taxWithholding')?.value || 0.0),
        revenue_stamps_pct: parseFloat(document.getElementById('cfg-revenueStamps')?.value || 0.6),
        contractors_syndicate_pct: parseFloat(document.getElementById('cfg-syndicateFee')?.value || 0.2),
        advance_recovery_rate_pct: parseFloat(document.getElementById('cfg-advRecovery')?.value || 10.0),

        paving_unit_rate_jod: parseFloat(document.getElementById('cfg-pavingRate')?.value || 4.5),
        curbstone_unit_rate_jod: parseFloat(document.getElementById('cfg-curbstoneRate')?.value || 6.0),
        interlock_unit_rate_jod: parseFloat(document.getElementById('cfg-interlockRate')?.value || 8.5),
        asphalt_reinstatement_rate_jod: parseFloat(document.getElementById('cfg-asphaltReinstate')?.value || 18.0),
        basecourse_reinstatement_rate_jod: parseFloat(document.getElementById('cfg-baseReinstate')?.value || 8.0),
        permit_admin_fee_jod: parseFloat(document.getElementById('cfg-permitFee')?.value || 15.0),
        excavation_insurance_rate_jod: parseFloat(document.getElementById('cfg-excavInsurance')?.value || 25.0),

        pci_excellent_min: parseInt(document.getElementById('cfg-pciExc')?.value || 85, 10),
        pci_good_min: parseInt(document.getElementById('cfg-pciGood')?.value || 70, 10),
        pci_fair_min: parseInt(document.getElementById('cfg-pciFair')?.value || 55, 10),
        pci_poor_min: parseInt(document.getElementById('cfg-pciPoor')?.value || 40, 10),
        default_asphalt_thickness_cm: parseFloat(document.getElementById('cfg-asphaltThick')?.value || 5.0),
        asphalt_delivery_temp_min_c: parseInt(document.getElementById('cfg-asphaltTemp')?.value || 145, 10),
        min_compaction_rate_pct: parseFloat(document.getElementById('cfg-minCompact')?.value || 98.0),
        concrete_slump_target_cm: parseFloat(document.getElementById('cfg-concreteSlump')?.value || 8.0),

        roads_useful_life_years: parseInt(document.getElementById('cfg-roadsLife')?.value || 15, 10),
        bridges_useful_life_years: parseInt(document.getElementById('cfg-bridgesLife')?.value || 40, 10),
        machinery_useful_life_years: parseInt(document.getElementById('cfg-machineryLife')?.value || 10, 10),
        lighting_useful_life_years: parseInt(document.getElementById('cfg-lightingLife')?.value || 7, 10),
        asset_salvage_value_pct: parseFloat(document.getElementById('cfg-salvageValue')?.value || 10.0),

        mayor_purchase_ceiling_jod: parseFloat(document.getElementById('cfg-mayorCeiling')?.value || 5000.0),
        local_committee_ceiling_jod: parseFloat(document.getElementById('cfg-localCommCeiling')?.value || 20000.0),
        main_committee_ceiling_jod: parseFloat(document.getElementById('cfg-mainCommCeiling')?.value || 100000.0),
        direct_purchase_ceiling_jod: parseFloat(document.getElementById('cfg-directPurchaseCeiling')?.value || 3000.0),
        quotation_request_ceiling_jod: parseFloat(document.getElementById('cfg-quotationCeiling')?.value || 15000.0),
        limited_tender_ceiling_jod: parseFloat(document.getElementById('cfg-limitedTenderCeiling')?.value || 50000.0),
        enforce_committee_ceilings: document.getElementById('cfg-enforceCommittees') ? document.getElementById('cfg-enforceCommittees').checked : true
      };

      Object.assign(this.visualState, payload);
      await this.saveUnifiedConfig(payload, '✅ تم حفظ وتعميم مصفوفة المعايير الهندسية والمالية الشاملة وسقوف اللجان بنجاح');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       2. تبويب محرك الترقيم التلقائي المطور (Smart Numbering Engine)
       ═══════════════════════════════════════════════════════════════════════════ */
    renderNumberingTab() {
      const year = this.visualState.fiscalYear || '2026';
      return `
        <div style="display:flex; flex-direction:column; gap:18px;">
          
          <!-- Top Executive Banner -->
          <div style="background:linear-gradient(135deg, rgba(15,118,110,0.08), rgba(2,132,199,0.08)); border:1px solid var(--border); border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.1rem; font-weight:800; color:var(--primary, #0f766e); display:flex; align-items:center; gap:8px;">
                <span>🔢</span> <span>محرك الترقيم التلقائي الموحد (Zero-Code Numbering Engine)</span>
              </h3>
              <p style="margin:0; font-size:0.83rem; color:var(--text-muted);">توليد متسلسل آمن وموحد بدون تضارب لكافة المستندات والمعاملات الرسمية مع تصفير سنوي ذكي</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.testSimulateNumbering()" style="font-weight:700; font-size:0.82rem; display:flex; align-items:center; gap:6px;">
                <span>⚡</span> <span>فحص التوليد الآلي</span>
              </button>
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.resetNumberingDefaults()" style="font-weight:700; font-size:0.82rem; color:#d97706; border-color:#d97706;">
                <span>🔄</span> <span>التهيئة القياسية</span>
              </button>
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveNumberingSettings()" style="font-weight:800; font-size:0.85rem; padding:8px 20px; display:flex; align-items:center; gap:6px;">
                <span>💾</span> <span>حفظ وتعميم الترقيم</span>
              </button>
            </div>
          </div>

          <!-- Cards Grid for all Entities -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
            
            <!-- 1. Tenders -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#1e3a8a; display:flex; align-items:center; gap:8px;">
                  <span>📋</span> <span>العطاءات والمشاريع الرأسمالية</span>
                </div>
                <span class="badge" style="background:rgba(30,58,138,0.1); color:#1e3a8a; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Tenders</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixTenders" class="form-control" value="${this.visualState.prefix_tenders || 'TEN-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-tenders" style="font-weight:800; color:#1e3a8a; font-size:0.9rem;">${this.visualState.prefix_tenders || 'TEN-'}${year}-001</code>
              </div>
            </div>

            <!-- 2. Claims -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0f766e; display:flex; align-items:center; gap:8px;">
                  <span>📝</span> <span>المطالبات والمستخلصات المالية</span>
                </div>
                <span class="badge" style="background:rgba(15,118,110,0.1); color:#0f766e; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Claims</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixClaims" class="form-control" value="${this.visualState.prefix_claims || 'CLM-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-claims" style="font-weight:800; color:#0f766e; font-size:0.9rem;">${this.visualState.prefix_claims || 'CLM-'}${year}-001</code>
              </div>
            </div>

            <!-- 3. Permits -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#d97706; display:flex; align-items:center; gap:8px;">
                  <span>🚜</span> <span>تصاريح الحفر وتنسيق الخدمات</span>
                </div>
                <span class="badge" style="background:rgba(217,119,6,0.1); color:#d97706; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Permits</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixPermits" class="form-control" value="${this.visualState.prefix_permits || 'PER-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-permits" style="font-weight:800; color:#d97706; font-size:0.9rem;">${this.visualState.prefix_permits || 'PER-'}${year}-001</code>
              </div>
            </div>

            <!-- 4. Paving Returns -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#16a34a; display:flex; align-items:center; gap:8px;">
                  <span>💰</span> <span>عوائد التعبيد والتحققات البلدية</span>
                </div>
                <span class="badge" style="background:rgba(22,163,74,0.1); color:#16a34a; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Paving</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixPaving" class="form-control" value="${this.visualState.prefix_paving || 'PAV-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-paving" style="font-weight:800; color:#16a34a; font-size:0.9rem;">${this.visualState.prefix_paving || 'PAV-'}${year}-001</code>
              </div>
            </div>

            <!-- 5. Tasks -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#7c3aed; display:flex; align-items:center; gap:8px;">
                  <span>📌</span> <span>الكشوفات والمهام الفنية الميدانية</span>
                </div>
                <span class="badge" style="background:rgba(124,58,237,0.1); color:#7c3aed; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Tasks</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixTasks" class="form-control" value="${this.visualState.prefix_tasks || 'TSK-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-tasks" style="font-weight:800; color:#7c3aed; font-size:0.9rem;">${this.visualState.prefix_tasks || 'TSK-'}${year}-001</code>
              </div>
            </div>

            <!-- 6. Contracts -->
            <div class="card" style="background:var(--bg-card, #fff); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0284c7; display:flex; align-items:center; gap:8px;">
                  <span>📜</span> <span>العقود والضمانات البنكية</span>
                </div>
                <span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; font-weight:bold; font-size:0.72rem; padding:2px 8px; border-radius:6px;">Contracts</span>
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:4px;">بادئة الرقم التسلسلي (Prefix)</label>
                <input type="text" id="cfg-prefixContracts" class="form-control" value="${this.visualState.prefix_contracts || 'CNT-'}" oninput="window.unifiedSettingsManager.updateNumberingPreviews()" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:800; font-family:monospace; font-size:0.92rem;" />
              </div>
              <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.78rem; color:var(--text-muted);">معاينة الترقيم الحي:</span>
                <code id="preview-code-contracts" style="font-weight:800; color:#0284c7; font-size:0.9rem;">${this.visualState.prefix_contracts || 'CNT-'}${year}-001</code>
              </div>
            </div>

          </div>

          <!-- Simulator Box -->
          <div id="numbering-sim-box" style="display:none; background:var(--bg-card, #fff); border:1px solid #38bdf8; border-radius:12px; padding:16px; margin-top:8px;">
            <div style="font-weight:800; color:#0284c7; margin-bottom:8px; font-size:0.9rem;">⚡ نتائج فحص التوليد التسلسلي الحي للوثائق الثلاث القادمة:</div>
            <div id="numbering-sim-content" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;"></div>
          </div>

        </div>
      `;
    }

    updateNumberingPreviews() {
      const year = this.visualState.fiscalYear || '2026';
      const t = document.getElementById('cfg-prefixTenders')?.value || 'TEN-';
      const c = document.getElementById('cfg-prefixClaims')?.value || 'CLM-';
      const p = document.getElementById('cfg-prefixPermits')?.value || 'PER-';
      const v = document.getElementById('cfg-prefixPaving')?.value || 'PAV-';
      const k = document.getElementById('cfg-prefixTasks')?.value || 'TSK-';
      const ct = document.getElementById('cfg-prefixContracts')?.value || 'CNT-';

      if (document.getElementById('preview-code-tenders')) document.getElementById('preview-code-tenders').textContent = `${t}${year}-001`;
      if (document.getElementById('preview-code-claims')) document.getElementById('preview-code-claims').textContent = `${c}${year}-001`;
      if (document.getElementById('preview-code-permits')) document.getElementById('preview-code-permits').textContent = `${p}${year}-001`;
      if (document.getElementById('preview-code-paving')) document.getElementById('preview-code-paving').textContent = `${v}${year}-001`;
      if (document.getElementById('preview-code-tasks')) document.getElementById('preview-code-tasks').textContent = `${k}${year}-001`;
      if (document.getElementById('preview-code-contracts')) document.getElementById('preview-code-contracts').textContent = `${ct}${year}-001`;
    }

    testSimulateNumbering() {
      const year = this.visualState.fiscalYear || '2026';
      const box = document.getElementById('numbering-sim-box');
      const content = document.getElementById('numbering-sim-content');
      if (!box || !content) return;

      const t = document.getElementById('cfg-prefixTenders')?.value || 'TEN-';
      const c = document.getElementById('cfg-prefixClaims')?.value || 'CLM-';

      content.innerHTML = `
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:8px 12px; font-size:0.82rem;">
          <div style="font-weight:bold; color:#166534;">عطاء تجريبي #1</div>
          <code style="font-weight:bold; font-size:0.9rem;">${t}${year}-001</code>
        </div>
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:8px 12px; font-size:0.82rem;">
          <div style="font-weight:bold; color:#166534;">عطاء تجريبي #2</div>
          <code style="font-weight:bold; font-size:0.9rem;">${t}${year}-002</code>
        </div>
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:8px 12px; font-size:0.82rem;">
          <div style="font-weight:bold; color:#166534;">مطالبة تجريبية #1</div>
          <code style="font-weight:bold; font-size:0.9rem;">${c}${year}-001</code>
        </div>
      `;
      box.style.display = 'block';
      showToast('⚡ تم فحص تسلسل الأرقام بنجاح');
    }

    resetNumberingDefaults() {
      if (!confirm('هل تود استرجاع بادئات الترقيم القياسية المعتمدة للنظام؟')) return;
      document.getElementById('cfg-prefixTenders').value = 'TEN-';
      document.getElementById('cfg-prefixClaims').value = 'CLM-';
      document.getElementById('cfg-prefixPermits').value = 'PER-';
      document.getElementById('cfg-prefixPaving').value = 'PAV-';
      document.getElementById('cfg-prefixTasks').value = 'TSK-';
      document.getElementById('cfg-prefixContracts').value = 'CNT-';
      this.updateNumberingPreviews();
      showToast('🔄 تم استرجاع القيم القياسية');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       3. تبويب التنبيهات الذكية والأمان والجدولة الآلية المطور
       ═══════════════════════════════════════════════════════════════════════════ */
    renderSmartAlertsTab() {
      return `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px;">
          
          <!-- Card 1: تنبيهات الكفالات والمشاريع -->
          <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:16px;">
            <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:1.05rem; font-weight:800; color:var(--primary, #0f766e); margin:0; display:flex; align-items:center; gap:8px;">
                <span>🔔</span> <span>قواعد التنبيهات الاستباقية للمشاريع والكفالات</span>
              </h3>
              <span class="badge" style="background:rgba(217,119,6,0.1); color:#d97706; font-weight:bold; font-size:0.75rem; padding:2px 8px; border-radius:6px;">Smart Rules</span>
            </div>

            <!-- Guarantee alert days -->
            <div>
              <label style="display:block; font-size:0.85rem; font-weight:800; color:var(--text); margin-bottom:4px;">فترات التنبيه التلقائي قبل انتهاء الكفالات البنكية (أيام)</label>
              <input type="text" id="cfg-alertDays" class="form-control" value="${this.visualState.guarantee_alert_days || '30,15,7'}" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:bold; font-family:monospace;" />
              <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.appendAlertDay(90)" style="font-size:0.75rem; padding:2px 6px;">+ 90 يوم</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.appendAlertDay(60)" style="font-size:0.75rem; padding:2px 6px;">+ 60 يوم</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.appendAlertDay(30)" style="font-size:0.75rem; padding:2px 6px;">+ 30 يوم</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.appendAlertDay(15)" style="font-size:0.75rem; padding:2px 6px;">+ 15 يوم</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.appendAlertDay(7)" style="font-size:0.75rem; padding:2px 6px;">+ 7 أيام</button>
              </div>
            </div>

            <!-- Delay Threshold -->
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <label style="font-size:0.85rem; font-weight:800; color:var(--text);">عتبة فارق الإنجاز الزمني والمالي لإطلاق تنبيه التأخير</label>
                <span id="label-val-delay" style="font-weight:800; color:#ea580c; font-size:0.95rem;">${this.visualState.project_delay_threshold_pct || 15}%</span>
              </div>
              <input type="range" id="cfg-delayPct-range" min="5" max="35" step="1" value="${this.visualState.project_delay_threshold_pct || 15.0}" oninput="document.getElementById('cfg-delayPct').value = this.value; document.getElementById('label-val-delay').textContent = this.value + '%';" style="width:100%; accent-color:#ea580c;" />
              <div style="display:flex; gap:10px; align-items:center; margin-top:4px;">
                <input type="number" id="cfg-delayPct" class="form-control" value="${this.visualState.project_delay_threshold_pct || 15.0}" step="1" oninput="document.getElementById('cfg-delayPct-range').value = this.value; document.getElementById('label-val-delay').textContent = this.value + '%';" style="width:100px; padding:6px 10px; border-radius:6px; font-weight:bold;" />
                <span style="font-size:0.74rem; color:var(--text-muted);">إشعار تلقائي في لوحة القيادة عند تجاوز الفارق بين الإنجاز المالي والزمني</span>
              </div>
            </div>

            <!-- Test Audio Notification -->
            <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.78rem; color:var(--text-muted);">فحص نظام الإشعارات والتنبيهات المباشرة:</span>
              <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.testLiveNotification()" style="font-weight:bold; font-size:0.75rem;">🔔 تجربة إشعار حي</button>
            </div>

            <div style="margin-top:auto; padding-top:10px;">
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveSmartAlerts()" style="width:100%; font-weight:800; padding:12px; font-size:0.92rem; display:flex; justify-content:center; align-items:center; gap:8px;">
                <span>💾</span> <span>حفظ قواعد التنبيهات الذكية</span>
              </button>
            </div>
          </div>

          <!-- Card 2: الجدولة الآلية للنسخ الاحتياطي المشفر -->
          <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:16px;">
            <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:1.05rem; font-weight:800; color:var(--primary, #0f766e); margin:0; display:flex; align-items:center; gap:8px;">
                <span>🛡️</span> <span>الجدولة الآلية للنسخ الاحتياطي والأمان</span>
              </h3>
              <span class="badge" style="background:rgba(22,163,74,0.1); color:#16a34a; font-weight:bold; font-size:0.75rem; padding:2px 8px; border-radius:6px;">AES-256 Crypto</span>
            </div>

            <!-- Toggle Auto Backup -->
            <div>
              <label style="display:block; font-size:0.85rem; font-weight:800; color:var(--text); margin-bottom:4px;">النسخ الاحتياطي التلقائي اليومي</label>
              <select id="cfg-autoBackup" class="form-control" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:bold;">
                <option value="true" ${this.visualState.auto_backup_enabled !== false ? 'selected' : ''}>🟢 مفعل يومياً وفق الجدول الزمني المشفر (موصى به)</option>
                <option value="false" ${this.visualState.auto_backup_enabled === false ? 'selected' : ''}>🔴 معطل (غير موصى به)</option>
              </select>
            </div>

            <!-- Time Picker -->
            <div>
              <label style="display:block; font-size:0.85rem; font-weight:800; color:var(--text); margin-bottom:4px;">ساعة التشغيل اليومية المجدولة</label>
              <input type="time" id="cfg-backupTime" class="form-control" value="${this.visualState.auto_backup_time || '02:00'}" style="width:100%; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:0.95rem;" />
              <p style="margin:4px 0 0 0; font-size:0.74rem; color:var(--text-muted);">الوقت المفضل لتوليد وتشفير قاعدة البيانات دون التأثير على حركة الموظفين (02:00 فجراً)</p>
            </div>

            <!-- Security Badges -->
            <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border); border-radius:8px; padding:12px;">
              <div style="font-size:0.8rem; font-weight:bold; color:#1e3a8a; margin-bottom:6px;">🔒 بروتوكولات حماية النسخ الاحتياطية:</div>
              <ul style="margin:0; padding-right:16px; font-size:0.76rem; color:var(--text-muted); line-height:1.6;">
                <li>تشفير عالي الأمان وفق معيار AES-256-CBC مع مفتاح سري ديناميكي.</li>
                <li>توليد بصمة رقمية SHA-256 لكل ملف لمنع التلاعب والاستبدال غير المصرح به.</li>
                <li>تخزين محمي مع إمكانية التنزيل المباشر للإدارة الهندسية.</li>
              </ul>
            </div>

            <div style="margin-top:auto; padding-top:10px;">
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveSmartAlerts()" style="width:100%; font-weight:800; padding:12px; font-size:0.92rem; display:flex; justify-content:center; align-items:center; gap:8px;">
                <span>💾</span> <span>حفظ إعدادات الأمان والجدولة</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }

    appendAlertDay(day) {
      const inp = document.getElementById('cfg-alertDays');
      if (!inp) return;
      let cur = inp.value.split(',').map(s => s.trim()).filter(Boolean);
      if (!cur.includes(String(day))) {
        cur.push(String(day));
        cur.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        inp.value = cur.join(',');
      }
    }

    testLiveNotification() {
      showToast('🔔 [تنبيه تجريبي ذكي] كفالة حسن تنفيذ للعطاء TEN-2026-001 توشك على الانتهاء خلال 15 يوماً');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       4. تبويب نظم المعلومات الجغرافية GIS والأختام الرقمية المطور
       ═══════════════════════════════════════════════════════════════════════════ */
    renderGisMapsTab() {
      return `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px;">
          
          <!-- Card 1: إعدادات الخرائط و GIS -->
          <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px;">
            <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:1.05rem; font-weight:800; color:var(--primary, #0f766e); margin:0; display:flex; align-items:center; gap:8px;">
                <span>🗺️</span> <span>نظم المعلومات الجغرافية والخرائط التفاعلية (GIS)</span>
              </h3>
              <span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; font-weight:bold; font-size:0.75rem; padding:2px 8px; border-radius:6px;">Leaflet / PostGIS</span>
            </div>

            <!-- Quick District Presets -->
            <div>
              <label style="display:block; font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px;">المواقع الجغرافية الرئيسية في بلدية كفرنجة:</label>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.setGisPreset(32.3025, 35.7008, 15, 'مركز كفرنجة')" style="font-size:0.75rem; padding:3px 8px;">📍 مركز البلدية</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.setGisPreset(32.3110, 35.7145, 15, 'عين البستان')" style="font-size:0.75rem; padding:3px 8px;">📍 عين البستان</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.setGisPreset(32.2850, 35.6890, 15, 'راجب')" style="font-size:0.75rem; padding:3px 8px;">📍 وادي راجب</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.setGisPreset(32.3220, 35.6980, 15, 'بلاص وسفينة')" style="font-size:0.75rem; padding:3px 8px;">📍 بلاص وسفينة</button>
              </div>
            </div>

            <!-- Coords Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
              <div>
                <label style="display:block; font-size:0.75rem; font-weight:bold; color:var(--text);">خط العرض (Lat)</label>
                <input type="number" id="cfg-gisLat" class="form-control" value="${this.visualState.gis_center_lat || 32.3025}" step="0.0001" oninput="window.unifiedSettingsManager.updateMapCenterFromInput()" style="width:100%; padding:6px; border-radius:6px; font-weight:bold; font-size:0.85rem;" />
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; font-weight:bold; color:var(--text);">خط الطول (Lng)</label>
                <input type="number" id="cfg-gisLng" class="form-control" value="${this.visualState.gis_center_lng || 35.7008}" step="0.0001" oninput="window.unifiedSettingsManager.updateMapCenterFromInput()" style="width:100%; padding:6px; border-radius:6px; font-weight:bold; font-size:0.85rem;" />
              </div>
              <div>
                <label style="display:block; font-size:0.75rem; font-weight:bold; color:var(--text);">التقريب (Zoom)</label>
                <input type="number" id="cfg-gisZoom" class="form-control" value="${this.visualState.gis_default_zoom || 14}" min="10" max="19" oninput="window.unifiedSettingsManager.updateMapCenterFromInput()" style="width:100%; padding:6px; border-radius:6px; font-weight:bold; font-size:0.85rem;" />
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.78rem; font-weight:bold; color:var(--text);">طبقة الخريطة الافتراضية المعتمدة</label>
              <select id="cfg-gisLayer" class="form-control" onchange="window.unifiedSettingsManager.changeMapLayer(this.value)" style="width:100%; padding:8px; border-radius:8px; font-weight:bold;">
                <option value="osm" ${this.visualState.gis_map_layer === 'osm' ? 'selected' : ''}>🗺️ خريطة الشوارع القياسية (OpenStreetMap Standard)</option>
                <option value="satellite" ${this.visualState.gis_map_layer === 'satellite' ? 'selected' : ''}>🛰️ صور الأقمار الصناعية عالية الدقة (Satellite)</option>
                <option value="topo" ${this.visualState.gis_map_layer === 'topo' ? 'selected' : ''}>⛰️ الخريطة الطبوغرافية والتضاريس (Topographic)</option>
              </select>
            </div>

            <!-- Live Map Preview Container -->
            <div id="settings-gis-map-container" style="width:100%; height:200px; border-radius:10px; border:1px solid var(--border); overflow:hidden; position:relative; background:#e2e8f0;">
              <div id="settings-gis-map" style="width:100%; height:100%;"></div>
            </div>

            <div style="margin-top:auto; padding-top:6px;">
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveGisMapsSettings()" style="width:100%; font-weight:800; padding:12px; font-size:0.92rem; display:flex; justify-content:center; align-items:center; gap:8px;">
                <span>💾</span> <span>حفظ وتعميم إعدادات الـ GIS</span>
              </button>
            </div>
          </div>

          <!-- Card 2: الأختام الرسمية وبوابة التحقق -->
          <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border); display:flex; flex-direction:column; gap:14px;">
            <div style="border-bottom:1px solid var(--border); padding-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:1.05rem; font-weight:800; color:var(--primary, #0f766e); margin:0; display:flex; align-items:center; gap:8px;">
                <span>🖋️</span> <span>الأختام الرسمية وبوابة التحقق الرقمي الموحدة</span>
              </h3>
              <span class="badge" style="background:rgba(124,58,237,0.1); color:#7c3aed; font-weight:bold; font-size:0.75rem; padding:2px 8px; border-radius:6px;">Digital Stamp</span>
            </div>

            <!-- Director Stamp -->
            <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); padding:12px; border-radius:10px;">
              <label style="display:block; font-size:0.82rem; font-weight:800; color:var(--text); margin-bottom:6px;">خاتم المدير الهندسي المعتمد (Director Stamp)</label>
              <div style="display:flex; align-items:center; gap:14px;">
                <img id="preview-stamp-director" src="${this.visualState.director_stamp_b64 || '/logo.jpg'}" onerror="this.src='/logo.jpg'" style="width:55px; height:55px; object-fit:contain; border-radius:8px; background:#fff; border:1px solid var(--border);" />
                <div style="flex:1;">
                  <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('input-stamp-director').click()" style="font-weight:bold;">📂 تغيير الخاتم</button>
                  <input type="file" id="input-stamp-director" accept="image/*" style="display:none;" onchange="window.unifiedSettingsManager.handleDirectorStampUpload(this)" />
                  <p style="margin:4px 0 0 0; font-size:0.72rem; color:var(--text-muted);">يُضاف آلياً إلى تقارير الاستلام والمطالبات المعتمدة</p>
                </div>
              </div>
            </div>

            <!-- Municipality Seal -->
            <div style="background:var(--bg-surface, #f8fafc); border:1px dashed var(--border); padding:12px; border-radius:10px;">
              <label style="display:block; font-size:0.82rem; font-weight:800; color:var(--text); margin-bottom:6px;">خاتم ديوان بلدية كفرنجة الرسمي (Municipality Seal)</label>
              <div style="display:flex; align-items:center; gap:14px;">
                <img id="preview-stamp-mun" src="${this.visualState.municipality_seal_b64 || '/logo.jpg'}" onerror="this.src='/logo.jpg'" style="width:55px; height:55px; object-fit:contain; border-radius:8px; background:#fff; border:1px solid var(--border);" />
                <div style="flex:1;">
                  <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('input-stamp-mun').click()" style="font-weight:bold;">📂 تغيير الخاتم</button>
                  <input type="file" id="input-stamp-mun" accept="image/*" style="display:none;" onchange="window.unifiedSettingsManager.handleMunicipalitySealUpload(this)" />
                  <p style="margin:4px 0 0 0; font-size:0.72rem; color:var(--text-muted);">يُضاف آلياً مع الباركود الأمني للوثائق الصادرة</p>
                </div>
              </div>
            </div>

            <!-- Portal URL -->
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:800; color:var(--text); margin-bottom:4px;">مسار بوابة التحقق الرقمي العامة (Verification Portal URL)</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="cfg-verifyUrl" class="form-control" value="${this.visualState.verification_portal_url || '/verify.html'}" style="flex:1; padding:8px 12px; border-radius:8px; font-family:monospace; font-weight:bold;" />
                <a href="${this.visualState.verification_portal_url || '/verify.html'}" target="_blank" class="btn btn-outline" style="font-size:0.8rem; font-weight:bold; display:flex; align-items:center; gap:4px;">
                  <span>🔗</span> <span>معاينة</span>
                </a>
              </div>
            </div>

            <div style="margin-top:auto; padding-top:6px;">
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveGisMapsSettings()" style="width:100%; font-weight:800; padding:12px; font-size:0.92rem; display:flex; justify-content:center; align-items:center; gap:8px;">
                <span>💾</span> <span>حفظ الأختام وبوابة التحقق</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }

    initGisMap() {
      const mapContainer = document.getElementById('settings-gis-map');
      if (!mapContainer || typeof L === 'undefined') return;

      if (this.mapInstance) {
        this.mapInstance.remove();
        this.mapInstance = null;
      }

      const lat = this.visualState.gis_center_lat || 32.3025;
      const lng = this.visualState.gis_center_lng || 35.7008;
      const zoom = this.visualState.gis_default_zoom || 14;

      try {
        if (typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function') {
          this.mapInstance = UnifiedGisEngine.createMap('settings-gis-map', [lat, lng], zoom);
        } else {
          this.mapInstance = createUnifiedMap('settings-gis-map', [lat, lng], zoom);
        }

        this.mapMarker = L.marker([lat, lng], { draggable: true }).addTo(this.mapInstance);
        this.mapMarker.bindPopup('<b>📍 مركز بلدية كفرنجة المعتمد</b><br>اسحب الدبوس لتحديث الإحداثيات المركزية').openPopup();

        this.mapMarker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          document.getElementById('cfg-gisLat').value = pos.lat.toFixed(4);
          document.getElementById('cfg-gisLng').value = pos.lng.toFixed(4);
          this.visualState.gis_center_lat = parseFloat(pos.lat.toFixed(4));
          this.visualState.gis_center_lng = parseFloat(pos.lng.toFixed(4));
        });

        setTimeout(() => this.mapInstance && this.mapInstance.invalidateSize(), 200);
      } catch (err) {
        console.warn('⚠️ GIS settings map init error:', err);
      }
    }

    setGisPreset(lat, lng, zoom, label) {
      document.getElementById('cfg-gisLat').value = lat;
      document.getElementById('cfg-gisLng').value = lng;
      document.getElementById('cfg-gisZoom').value = zoom;
      this.visualState.gis_center_lat = lat;
      this.visualState.gis_center_lng = lng;
      this.visualState.gis_default_zoom = zoom;

      if (this.mapInstance && this.mapMarker) {
        this.mapInstance.setView([lat, lng], zoom);
        this.mapMarker.setLatLng([lat, lng]);
        this.mapMarker.bindPopup(`<b>📍 ${label}</b>`).openPopup();
      }
      showToast(`📍 تم توجيه الخريطة إلى (${label})`);
    }

    updateMapCenterFromInput() {
      const lat = parseFloat(document.getElementById('cfg-gisLat')?.value || 32.3025);
      const lng = parseFloat(document.getElementById('cfg-gisLng')?.value || 35.7008);
      const zoom = parseInt(document.getElementById('cfg-gisZoom')?.value || 14, 10);

      if (this.mapInstance && this.mapMarker) {
        this.mapInstance.setView([lat, lng], zoom);
        this.mapMarker.setLatLng([lat, lng]);
      }
    }

    changeMapLayer(layerType) {
      this.visualState.gis_map_layer = layerType;
      this.initGisMap();
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       دوال الحفظ والتطبيق المركزية
       ═══════════════════════════════════════════════════════════════════════════ */
    async saveNumberingSettings() {
      const prefix_tenders = document.getElementById('cfg-prefixTenders')?.value || this.visualState.prefix_tenders;
      const prefix_claims = document.getElementById('cfg-prefixClaims')?.value || this.visualState.prefix_claims;
      const prefix_permits = document.getElementById('cfg-prefixPermits')?.value || this.visualState.prefix_permits;
      const prefix_paving = document.getElementById('cfg-prefixPaving')?.value || this.visualState.prefix_paving;
      const prefix_tasks = document.getElementById('cfg-prefixTasks')?.value || this.visualState.prefix_tasks;
      const prefix_contracts = document.getElementById('cfg-prefixContracts')?.value || this.visualState.prefix_contracts;

      Object.assign(this.visualState, { prefix_tenders, prefix_claims, prefix_permits, prefix_paving, prefix_tasks, prefix_contracts });
      await this.saveUnifiedConfig({ prefix_tenders, prefix_claims, prefix_permits, prefix_paving, prefix_tasks, prefix_contracts }, '✅ تم حفظ وتعميم صيغ محرك الترقيم التلقائي بنجاح');
    }

    async saveSmartAlerts() {
      const guarantee_alert_days = document.getElementById('cfg-alertDays')?.value || this.visualState.guarantee_alert_days;
      const project_delay_threshold_pct = parseFloat(document.getElementById('cfg-delayPct')?.value || 15.0);
      const auto_backup_enabled = document.getElementById('cfg-autoBackup')?.value === 'true';
      const auto_backup_time = document.getElementById('cfg-backupTime')?.value || this.visualState.auto_backup_time;

      Object.assign(this.visualState, { guarantee_alert_days, project_delay_threshold_pct, auto_backup_enabled, auto_backup_time });
      await this.saveUnifiedConfig({ guarantee_alert_days, project_delay_threshold_pct, auto_backup_enabled, auto_backup_time }, '✅ تم حفظ إعدادات التنبيهات والأمان بنجاح');
    }

    async saveGisMapsSettings() {
      const gis_center_lat = parseFloat(document.getElementById('cfg-gisLat')?.value || 32.3025);
      const gis_center_lng = parseFloat(document.getElementById('cfg-gisLng')?.value || 35.7008);
      const gis_default_zoom = parseInt(document.getElementById('cfg-gisZoom')?.value || 14, 10);
      const gis_map_layer = document.getElementById('cfg-gisLayer')?.value || this.visualState.gis_map_layer;
      const verification_portal_url = document.getElementById('cfg-verifyUrl')?.value || this.visualState.verification_portal_url;

      Object.assign(this.visualState, { gis_center_lat, gis_center_lng, gis_default_zoom, gis_map_layer, verification_portal_url });
      await this.saveUnifiedConfig({
        gis_center_lat, gis_center_lng, gis_default_zoom, gis_map_layer, verification_portal_url,
        director_stamp_b64: this.visualState.director_stamp_b64,
        municipality_seal_b64: this.visualState.municipality_seal_b64
      }, '✅ تم حفظ إعدادات نظم المعلومات والـ GIS والأختام بنجاح');
    }

    handleDirectorStampUpload(input) {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.visualState.director_stamp_b64 = e.target.result;
          const img = document.getElementById('preview-stamp-director');
          if (img) { img.src = e.target.result; img.style.display = 'block'; }
        };
        reader.readAsDataURL(input.files[0]);
      }
    }

    handleMunicipalitySealUpload(input) {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.visualState.municipality_seal_b64 = e.target.result;
          const img = document.getElementById('preview-stamp-mun');
          if (img) { img.src = e.target.result; img.style.display = 'block'; }
        };
        reader.readAsDataURL(input.files[0]);
      }
    }

    async saveUnifiedConfig(payload, msg = '✅ تم حفظ وتطبيق الإعدادات بنجاح') {
      try {
        const res = await this._authFetch('/api/settings/config', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json && json.success) {
          if (typeof window.applySystemIdentity === 'function') {
            window.applySystemIdentity(json.data || payload);
          }
          showToast(msg);
        } else {
          showToast('⚠️ تم الحفظ محلياً: ' + (json?.error || ''));
        }
      } catch (err) {
        showToast('❌ خطأ في الاتصال: ' + err.message);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       5. تبويب الهوية والمظهر
       ═══════════════════════════════════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════════════════════════════════
       5. تبويب الهوية والمظهر (المطور بتصميم عصري فائق الجودة)
       ═══════════════════════════════════════════════════════════════════════════ */
    renderVisualIdentityTab() {
      const pri = this.visualState.primaryColor || '#0f766e';
      const sec = this.visualState.secondaryColor || '#0284c7';
      const acc = this.visualState.accentColor || '#10b981';
      const rad = this.visualState.borderRadius || 12;
      const isDark = this.visualState.darkMode !== false;

      return `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start;">
          
          <!-- Card 1: البيانات الرسمية للمؤسسة -->
          <div class="card" style="background:var(--bg-card, #1e293b); padding:24px; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 8px 30px rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom:4px;">
              <h3 style="font-size:1.08rem; font-weight:800; color:#38bdf8; margin:0; display:flex; align-items:center; gap:8px;">
                <span>🏛️</span> <span>البيانات والهوية الرسمية للمؤسسة</span>
              </h3>
              <span style="font-size:0.75rem; background:rgba(56,189,248,0.12); color:#38bdf8; padding:3px 10px; border-radius:10px; font-weight:700;">بيانات الترويسة والتقارير</span>
            </div>

            <div>
              <label style="display:block; font-size:0.84rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">اسم النظام الرسمي (System Title)</label>
              <div style="position:relative;">
                <input type="text" id="cfg-appTitle" class="form-control" value="${this.visualState.appTitle || 'نظام إدارة المشاريع والأشغال الهندسية الموحد'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.9rem; font-weight:600;" oninput="window.unifiedSettingsManager.previewThemeLive()" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">اسم البلدية / الأمانة</label>
                <input type="text" id="cfg-municipalityName" class="form-control" value="${this.visualState.municipalityName || 'بلدية كفرنجة الجديدة'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.9rem; font-weight:600;" oninput="window.unifiedSettingsManager.previewThemeLive()" />
              </div>
              <div>
                <label style="display:block; font-size:0.84rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">المديرية / الإدارة الهندسية</label>
                <input type="text" id="cfg-directorateName" class="form-control" value="${this.visualState.directorateName || 'مديرية الأشغال والخدمات الهندسية'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.9rem; font-weight:600;" oninput="window.unifiedSettingsManager.previewThemeLive()" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">السنة المالية النشطة</label>
                <input type="text" id="cfg-fiscalYear" class="form-control" value="${this.visualState.fiscalYear || '2026'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.9rem; font-weight:bold;" />
              </div>
              <div>
                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">العملة الرسمية المعتمدة</label>
                <input type="text" id="cfg-currency" class="form-control" value="${this.visualState.currency || 'د.أ'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.9rem; font-weight:bold;" />
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">نص العلامة المائية للتقارير والمستخلصات</label>
              <input type="text" id="cfg-watermarkText" class="form-control" value="${this.visualState.watermarkText || 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة'}" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.88rem;" />
            </div>

            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">⏱️ مهلة عدم النشاط والقفل التلقائي للجلسة</label>
              <select id="cfg-sessionTimeout" class="form-control" style="width:100%; padding:10px 14px; border-radius:10px; border:1px solid #334155; background:#0f172a; color:#f8fafc; font-size:0.88rem;">
                <option value="5" ${this.visualState.sessionTimeout === 5 ? 'selected' : ''}>5 دقائق</option>
                <option value="10" ${this.visualState.sessionTimeout === 10 ? 'selected' : ''}>10 دقائق</option>
                <option value="15" ${(!this.visualState.sessionTimeout || this.visualState.sessionTimeout === 15) ? 'selected' : ''}>15 دقيقة (الموصى به افتراضياً)</option>
                <option value="30" ${this.visualState.sessionTimeout === 30 ? 'selected' : ''}>30 دقيقة</option>
                <option value="60" ${this.visualState.sessionTimeout === 60 ? 'selected' : ''}>60 دقيقة (ساعة واحدة)</option>
              </select>
            </div>
          </div>

          <!-- Card 2: الألوان والسمات البصرية ولوحات الألوان -->
          <div class="card" style="background:var(--bg-card, #1e293b); padding:24px; border-radius:16px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 8px 30px rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px; margin-bottom:4px;">
              <h3 style="font-size:1.08rem; font-weight:800; color:#38bdf8; margin:0; display:flex; align-items:center; gap:8px;">
                <span>🎨</span> <span>الألوان ونمط العرض والسمات</span>
              </h3>
              <span style="font-size:0.75rem; background:rgba(16,185,129,0.15); color:#34d399; padding:3px 10px; border-radius:10px; font-weight:700;">تخصيص فوري مباشر</span>
            </div>

            <!-- Quick Palette Presets -->
            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:8px; color:#94a3b8;">🎨 لوحات ألوان معتمدة بنقرة واحدة (Presets):</label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button type="button" class="btn btn-sm" onclick="window.unifiedSettingsManager.applyPalettePreset('#0f766e', '#0284c7', '#10b981')" style="background:#0f172a; border:1px solid #334155; color:#f8fafc; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; font-size:0.8rem; font-weight:bold; cursor:pointer;">
                  <span>🌲 أصالة كفرنجة</span>
                  <div style="display:flex; gap:4px;">
                    <span style="width:14px; height:14px; border-radius:50%; background:#0f766e; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#0284c7; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                  </div>
                </button>

                <button type="button" class="btn btn-sm" onclick="window.unifiedSettingsManager.applyPalettePreset('#1e3a8a', '#d97706', '#0284c7')" style="background:#0f172a; border:1px solid #334155; color:#f8fafc; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; font-size:0.8rem; font-weight:bold; cursor:pointer;">
                  <span>🏛️ الهندسة الملكية</span>
                  <div style="display:flex; gap:4px;">
                    <span style="width:14px; height:14px; border-radius:50%; background:#1e3a8a; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#d97706; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#0284c7; display:inline-block;"></span>
                  </div>
                </button>

                <button type="button" class="btn btn-sm" onclick="window.unifiedSettingsManager.applyPalettePreset('#4f46e5', '#06b6d4', '#6366f1')" style="background:#0f172a; border:1px solid #334155; color:#f8fafc; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; font-size:0.8rem; font-weight:bold; cursor:pointer;">
                  <span>⚡ التقنية الذكية</span>
                  <div style="display:flex; gap:4px;">
                    <span style="width:14px; height:14px; border-radius:50%; background:#4f46e5; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#06b6d4; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#6366f1; display:inline-block;"></span>
                  </div>
                </button>

                <button type="button" class="btn btn-sm" onclick="window.unifiedSettingsManager.applyPalettePreset('#059669', '#0284c7', '#34d399')" style="background:#0f172a; border:1px solid #334155; color:#f8fafc; display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:10px; font-size:0.8rem; font-weight:bold; cursor:pointer;">
                  <span>🍃 الواحات الخضراء</span>
                  <div style="display:flex; gap:4px;">
                    <span style="width:14px; height:14px; border-radius:50%; background:#059669; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#0284c7; display:inline-block;"></span>
                    <span style="width:14px; height:14px; border-radius:50%; background:#34d399; display:inline-block;"></span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Custom Colors -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 14px;">
                <label style="display:block; font-size:0.8rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">اللون الرئيسي (Primary)</label>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="color" id="cfg-primaryColor" value="${pri}" style="width:38px; height:34px; border:none; border-radius:8px; cursor:pointer; background:none;" onchange="window.unifiedSettingsManager.previewThemeLive()" />
                  <span style="font-size:0.86rem; font-family:monospace; font-weight:bold; color:#f8fafc;">${pri}</span>
                </div>
              </div>

              <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 14px;">
                <label style="display:block; font-size:0.8rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">اللون الثانوي (Secondary)</label>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="color" id="cfg-secondaryColor" value="${sec}" style="width:38px; height:34px; border:none; border-radius:8px; cursor:pointer; background:none;" onchange="window.unifiedSettingsManager.previewThemeLive()" />
                  <span style="font-size:0.86rem; font-family:monospace; font-weight:bold; color:#f8fafc;">${sec}</span>
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 14px;">
                <label style="display:block; font-size:0.8rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">لون التمييز (Accent)</label>
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="color" id="cfg-accentColor" value="${acc}" style="width:38px; height:34px; border:none; border-radius:8px; cursor:pointer; background:none;" onchange="window.unifiedSettingsManager.previewThemeLive()" />
                  <span style="font-size:0.86rem; font-family:monospace; font-weight:bold; color:#f8fafc;">${acc}</span>
                </div>
              </div>

              <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 14px;">
                <label style="display:block; font-size:0.8rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">نمط السمة (Theme Mode)</label>
                <select id="cfg-darkMode" class="form-control" style="width:100%; padding:6px 10px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#f8fafc; font-size:0.84rem; font-weight:bold;" onchange="window.unifiedSettingsManager.previewThemeLive()">
                  <option value="true" ${isDark ? 'selected' : ''}>🌙 الوضع الليلي (Dark Mode)</option>
                  <option value="false" ${!isDark ? 'selected' : ''}>☀️ الوضع النهاري (Light Mode)</option>
                </select>
              </div>
            </div>

            <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.82rem; font-weight:700; color:#94a3b8;">انحناء حواف العناصر (Border Radius)</label>
                <span id="val-radius" style="font-weight:bold; font-size:0.86rem; color:#38bdf8; background:#1e293b; padding:2px 8px; border-radius:6px;">${rad}px</span>
              </div>
              <input type="range" id="cfg-borderRadius" min="0" max="24" value="${rad}" style="width:100%; accent-color:#0284c7; cursor:pointer;" oninput="window.unifiedSettingsManager.previewThemeLive()" />
            </div>

            <div>
              <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:6px; color:#94a3b8;">شعار البلدية الرسمي</label>
              <div style="display:flex; align-items:center; gap:16px; background:#0f172a; border:1px dashed #334155; border-radius:12px; padding:12px 16px;">
                <img id="preview-logo-img" src="${this.visualState.headerLogo || '/logo.jpg'}" onerror="this.src='/logo.jpg'" style="width:55px; height:55px; object-fit:contain; border-radius:10px; background:#fff; border:2px solid #0284c7; padding:2px;" />
                <div style="flex:1;">
                  <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('input-logo-file').click()" style="padding:6px 14px; font-weight:bold; font-size:0.84rem;">📂 اختيار وتحميل شعار جديد</button>
                  <input type="file" id="input-logo-file" accept="image/*" style="display:none;" onchange="window.unifiedSettingsManager.handleLogoUpload(this)" />
                  <p style="margin:4px 0 0 0; font-size:0.72rem; color:#64748b;">يدعم ملفات الصور عالية الدقة (PNG, JPG, SVG)</p>
                </div>
              </div>
            </div>

            <div style="margin-top:8px;">
              <button class="btn btn-primary" onclick="window.unifiedSettingsManager.saveVisualIdentity()" style="width:100%; font-weight:800; padding:14px; font-size:0.95rem; display:flex; justify-content:center; align-items:center; gap:8px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0f766e); border:none; box-shadow:0 6px 20px rgba(2,132,199,0.35);">
                <span>💾</span> <span>حفظ وتعميم إعدادات الهوية والمظهر فوراً</span>
              </button>
            </div>
          </div>

        </div>
      `;
    }

    applyPalettePreset(pri, sec, acc) {
      const priInp = document.getElementById('cfg-primaryColor');
      const secInp = document.getElementById('cfg-secondaryColor');
      const accInp = document.getElementById('cfg-accentColor');
      if (priInp) priInp.value = pri;
      if (secInp) secInp.value = sec;
      if (accInp) accInp.value = acc;
      this.visualState.primaryColor = pri;
      this.visualState.secondaryColor = sec;
      this.visualState.accentColor = acc;
      this.previewThemeLive();
      showToast('🎨 تم تطبيق لوحة الألوان للمعاينة الحية');
    }

    previewThemeLive() {
      const primaryColor = document.getElementById('cfg-primaryColor')?.value || this.visualState.primaryColor;
      const secondaryColor = document.getElementById('cfg-secondaryColor')?.value || this.visualState.secondaryColor;
      const accentColor = document.getElementById('cfg-accentColor')?.value || this.visualState.accentColor;
      const borderRadius = parseInt(document.getElementById('cfg-borderRadius')?.value || this.visualState.borderRadius, 10);
      const darkMode = document.getElementById('cfg-darkMode')?.value === 'true';
      const appTitle = document.getElementById('cfg-appTitle')?.value || this.visualState.appTitle;
      const municipalityName = document.getElementById('cfg-municipalityName')?.value || this.visualState.municipalityName;
      const directorateName = document.getElementById('cfg-directorateName')?.value || this.visualState.directorateName;

      const spPri = document.getElementById('cfg-primaryColor')?.nextElementSibling;
      if (spPri) spPri.textContent = primaryColor;
      const spSec = document.getElementById('cfg-secondaryColor')?.nextElementSibling;
      if (spSec) spSec.textContent = secondaryColor;
      const spAcc = document.getElementById('cfg-accentColor')?.nextElementSibling;
      if (spAcc) spAcc.textContent = accentColor;
      const valRad = document.getElementById('val-radius');
      if (valRad) valRad.textContent = borderRadius + 'px';

      if (typeof window.applySystemIdentity === 'function') {
        window.applySystemIdentity({
          appTitle,
          municipalityName,
          directorateName,
          primaryColor,
          secondaryColor,
          accentColor,
          borderRadius,
          darkMode,
          headerLogo: this.visualState.headerLogo
        });
      }
    }

    handleLogoUpload(input) {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.visualState.headerLogo = e.target.result;
          const img = document.getElementById('preview-logo-img');
          if (img) img.src = e.target.result;
          document.querySelectorAll('.app-logo-img, #sidebar-logo-img, .sidebar-icon img, #header-logo-img').forEach(el => {
            if (el) el.src = e.target.result;
          });
        };
        reader.readAsDataURL(input.files[0]);
      }
    }

    async saveVisualIdentity() {
      const appTitle = document.getElementById('cfg-appTitle')?.value || this.visualState.appTitle;
      const municipalityName = document.getElementById('cfg-municipalityName')?.value || this.visualState.municipalityName;
      const directorateName = document.getElementById('cfg-directorateName')?.value || this.visualState.directorateName;
      const primaryColor = document.getElementById('cfg-primaryColor')?.value || this.visualState.primaryColor;
      const secondaryColor = document.getElementById('cfg-secondaryColor')?.value || this.visualState.secondaryColor;
      const accentColor = document.getElementById('cfg-accentColor')?.value || this.visualState.accentColor;
      const borderRadius = parseInt(document.getElementById('cfg-borderRadius')?.value || this.visualState.borderRadius, 10);
      const darkMode = document.getElementById('cfg-darkMode')?.value === 'true';
      const sessionTimeout = parseInt(document.getElementById('cfg-sessionTimeout')?.value || 15, 10);
      const fiscalYear = document.getElementById('cfg-fiscalYear')?.value || this.visualState.fiscalYear;
      const currency = document.getElementById('cfg-currency')?.value || this.visualState.currency;
      const watermarkText = document.getElementById('cfg-watermarkText')?.value || this.visualState.watermarkText;

      this.visualState.appTitle = appTitle;
      this.visualState.municipalityName = municipalityName;
      this.visualState.directorateName = directorateName;
      this.visualState.primaryColor = primaryColor;
      this.visualState.secondaryColor = secondaryColor;
      this.visualState.accentColor = accentColor;
      this.visualState.borderRadius = borderRadius;
      this.visualState.darkMode = darkMode;
      this.visualState.sessionTimeout = sessionTimeout;
      this.visualState.fiscalYear = fiscalYear;
      this.visualState.currency = currency;
      this.visualState.watermarkText = watermarkText;

      const payload = {
        appTitle,
        municipalityName,
        directorateName,
        primaryColor,
        secondaryColor,
        accentColor,
        borderRadius,
        darkMode,
        sessionTimeout,
        session_timeout_minutes: sessionTimeout,
        headerLogo: this.visualState.headerLogo,
        logo_path: this.visualState.headerLogo,
        watermarkText,
        fiscalYear,
        currency
      };

      await this.saveUnifiedConfig(payload, '✅ تم حفظ وتطبيق الهوية البصرية وإعدادات النظام بنجاح');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       6. تبويب إدارة المستخدمين
       ═══════════════════════════════════════════════════════════════════════════ */
    renderUsersTab() {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.05rem; font-weight:bold; color:#1e3a8a;">👥 حسابات المستخدمين وإسناد الأقسام الهندسية</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">إدارة كاملة لبيانات تسجيل الدخول، الأقسام الرسمية، والربط بالأدوار المعتمدة</p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="window.openMergeUserModal()" style="font-weight:bold; border-color:#d97706; color:#d97706;">
                🔀 دمج حسابين ونقل المهام
              </button>
              <button class="btn btn-primary" onclick="openModal('users')" style="font-weight:bold;">
                + إضافة مستخدم جديد
              </button>
            </div>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                  <th style="padding:10px 14px;">المعرف</th>
                  <th style="padding:10px 14px;">اسم المستخدم</th>
                  <th style="padding:10px 14px;">الاسم الكامل</th>
                  <th style="padding:10px 14px;">القسم الرسمي</th>
                  <th style="padding:10px 14px;">الدور الوظيفي</th>
                  <th style="padding:10px 14px;">تاريخ الإنشاء</th>
                  <th style="padding:10px 14px; text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="users-tbody">
                ${this.users.map(u => `
                  <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                    <td style="padding:10px 14px; font-family:monospace; font-weight:bold; color:#1e3a8a;">${u.id}</td>
                    <td style="padding:10px 14px; font-weight:bold;">${u.username}</td>
                    <td style="padding:10px 14px;">${u.fullName}</td>
                    <td style="padding:10px 14px; font-size:0.85rem;">${u.department || 'مديرية الأشغال'}</td>
                    <td style="padding:10px 14px;"><span class="badge" style="background:rgba(30,58,138,0.1); color:#1e3a8a; font-weight:bold; padding:2px 8px; border-radius:6px;">${u.role || 'engineer'}</span></td>
                    <td style="padding:10px 14px; font-size:0.8rem; color:var(--text-muted);">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-JO') : '—'}</td>
                    <td style="padding:10px 14px; text-align:center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-sm btn-primary" onclick="openEditUserModal('${u.id}')" title="تعديل بيانات الحساب">✏️ تعديل</button>
                        ${u.id !== 'U-001' ? `<button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="deleteUserAccount('${u.id}')" title="حذف المستخدم">🗑️ حذف</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       7. تبويب الهيكل التنظيمي
       ═══════════════════════════════════════════════════════════════════════════ */
    renderOrgUnitsTab() {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.05rem; font-weight:bold; color:#1e3a8a;">🏛️ الهيكل التنظيمي والأقسام والدوائر الرسمية</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">إدارة وتحديد التبعية الإدارية للمديريات والأقسام والشعب الهندسية</p>
            </div>
            <button class="btn btn-primary" onclick="openOrgUnitModal()" style="font-weight:bold;">
              + إضافة قسم / وحدة جديدة
            </button>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                  <th style="padding:10px 14px;">المعرف</th>
                  <th style="padding:10px 14px;">اسم الوحدة / القسم</th>
                  <th style="padding:10px 14px;">المستوى الإداري</th>
                  <th style="padding:10px 14px;">الوصف والمهام</th>
                  <th style="padding:10px 14px; text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="org-units-tbody">
                ${this.orgUnits.map(u => `
                  <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                    <td style="padding:10px 14px; font-family:monospace; font-weight:bold; color:#1e3a8a;">${u.id}</td>
                    <td style="padding:10px 14px; font-weight:bold;">${u.name}</td>
                    <td style="padding:10px 14px;"><span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 8px; border-radius:6px; font-weight:bold;">${u.type || 'قسم'}</span></td>
                    <td style="padding:10px 14px; font-size:0.85rem; color:var(--text-muted);">${u.description || '—'}</td>
                    <td style="padding:10px 14px; text-align:center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" onclick="openOrgUnitModal('${u.id}')" title="تعديل">✏️ تعديل</button>
                        ${u.id !== 'OU-01' ? `<button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="deleteOrgUnit('${u.id}')" title="حذف">🗑️ حذف</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       8. مصفوفة الأدوار والصلاحيات الديناميكية المعتمدة (Zero-Code Dynamic RBAC)
       ═══════════════════════════════════════════════════════════════════════════ */
    renderRolesTab() {
      const roles = Array.isArray(this.roles) ? this.roles : [];
      if (!this.selectedMatrixRoleId && roles.length > 0) {
        this.selectedMatrixRoleId = roles[0].id;
      }

      const currentRole = roles.find(r => r.id === this.selectedMatrixRoleId) || roles[0] || { id: 'R-001', name: 'admin', label: 'مدير النظام', description: 'مدير النظام الرئيسي' };
      const currentRoleId = currentRole.id;
      const isAdmin = currentRole.name === 'admin' || currentRole.id === 'R-001';
      const activePerms = this.rolePermissionsCache[currentRoleId] || [];

      // حساب إجمالي الصلاحيات
      let totalCanonPerms = 0;
      CANONICAL_ROLE_MODULES.forEach(m => totalCanonPerms += m.permissions.length);
      const totalActiveCount = isAdmin ? totalCanonPerms : activePerms.length;

      // تصفية وبحث في الصلاحيات
      const q = (this.matrixSearchQuery || '').toLowerCase().trim();
      const catFilter = this.matrixCategoryFilter || 'ALL';

      const filteredModules = CANONICAL_ROLE_MODULES.filter(m => {
        if (catFilter !== 'ALL' && m.id !== catFilter) return false;
        if (!q) return true;
        const matchesMod = m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
        const matchesPerm = m.permissions.some(p => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
        return matchesMod || matchesPerm;
      });

      return `
        <div class="rbac-matrix-suite" style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- 1. شريط المؤشرات والتحكم الأمني (Live KPI Bar) -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
            
            <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(15,118,110,0.1); color:#0f766e; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                👥
              </div>
              <div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted, #64748b);">الأدوار المعتمدة</div>
                <div style="font-size:1.35rem; font-weight:800; color:#0f766e; line-height:1.2;">${roles.length} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">أدوار وظيفية</span></div>
              </div>
            </div>

            <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(2,132,199,0.1); color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                🔑
              </div>
              <div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted, #64748b);">صلاحيات الدور المختار</div>
                <div style="font-size:1.35rem; font-weight:800; color:#0284c7; line-height:1.2;">
                  ${isAdmin ? 'كامل الصلاحيات (*)' : `${totalActiveCount} / ${totalCanonPerms}`}
                </div>
              </div>
            </div>

            <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(16,185,129,0.1); color:#10b981; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                ⚡
              </div>
              <div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted, #64748b);">محرك الصلاحيات (RBAC)</div>
                <div style="font-size:0.95rem; font-weight:800; color:#10b981; line-height:1.2;">ديناميكي لحظي (Zero-Code)</div>
              </div>
            </div>

            <div style="background:var(--bg-card, #ffffff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
              <div style="width:44px; height:44px; border-radius:10px; background:rgba(217,119,6,0.1); color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
                🛡️
              </div>
              <div>
                <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted, #64748b);">حماية وتدقيق الحركات</div>
                <div style="font-size:0.95rem; font-weight:800; color:#d97706; line-height:1.2;">مشفر وموثق بالسجل</div>
              </div>
            </div>

          </div>

          <!-- 2. محدد الأدوار الوظيفية التفاعلي (Interactive Role Cards Selector) -->
          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
              <div>
                <h3 style="margin:0 0 4px 0; font-size:1.05rem; font-weight:800; color:#1e3a8a; display:flex; align-items:center; gap:8px;">
                  <span>👥</span> <span>الأدوار الوظيفية المعتمدة في النظام</span>
                </h3>
                <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">انقر على الدور الوظيفي لتعديل مصفوفة صلاحياته وحفظ التعديلات فورياً</p>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="window.unifiedSettingsManager.openCreateRoleModal()" style="font-weight:bold; font-size:0.85rem; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;">
                  <span>➕</span> <span>إضافة دور وظيفي جديد</span>
                </button>
              </div>
            </div>

            <!-- Role Selector Grid -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
              ${roles.map(r => {
                const isSelected = r.id === currentRoleId;
                const isRoleAdmin = r.name === 'admin' || r.id === 'R-001';
                const usersCount = (this.users || []).filter(u => u.role === r.name || u.role === r.id).length;
                const rawDesc = r.description || 'دور وظيفي معتمد في الهيكل الهندسي';
                const cleanDesc = rawDesc.replace(/#+\s*/g, '').replace(/[*_`~]/g, '').trim();
                const hasDetailedProfile = rawDesc.length > 90 || rawDesc.includes('#');

                return `
                  <div onclick="window.unifiedSettingsManager.selectRoleForMatrix('${r.id}')"
                       style="cursor:pointer; padding:14px 16px; border-radius:12px; border:2px solid ${isSelected ? 'var(--primary, #0f766e)' : 'var(--border, #e2e8f0)'}; background:${isSelected ? 'rgba(15,118,110,0.06)' : 'var(--bg-surface, #f8fafc)'}; transition:all 0.2s ease; display:flex; flex-direction:column; justify-content:space-between; position:relative; box-shadow:${isSelected ? '0 4px 14px rgba(15,118,110,0.18)' : '0 1px 3px rgba(0,0,0,0.02)'}; min-height:130px; max-height:165px; overflow:hidden;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; gap:8px;">
                      <div style="font-weight:800; font-size:0.92rem; color:${isSelected ? 'var(--primary, #0f766e)' : 'var(--text, #1e293b)'}; display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <span>${isRoleAdmin ? '👑' : (r.name.includes('eng') ? '📐' : (r.name.includes('acc') ? '💳' : (r.name.includes('head') || r.name.includes('mgr') ? '🎖️' : (r.name.includes('proc') ? '🛒' : (r.name.includes('qa') ? '🧪' : '🔑')))))}</span>
                        <span title="${r.label || r.name}">${r.label || r.name}</span>
                      </div>
                      ${isSelected ? '<span class="badge" style="background:#0f766e; color:#fff; font-size:0.7rem; padding:2px 8px; border-radius:6px; flex-shrink:0;">نشط حالياً</span>' : ''}
                    </div>

                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4; height:2.8em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis; word-break:break-word;" title="${cleanDesc}">
                      ${cleanDesc}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border, #e2e8f0); padding-top:8px; font-size:0.75rem; margin-top:auto;">
                      <span style="color:var(--text-muted); font-weight:600;">👥 ${usersCount} موظف</span>
                      ${hasDetailedProfile ? `
                        <span onclick="event.stopPropagation(); window.unifiedSettingsManager.openRoleDetailsModal('${r.id}')" style="color:var(--primary, #0f766e); font-weight:bold; cursor:pointer; text-decoration:underline; font-size:0.72rem;">📄 بطاقة الوصف</span>
                      ` : ''}
                      <span style="font-family:monospace; font-weight:bold; color:#0284c7;">${r.name}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Role Quick Actions Bar -->
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border, #e2e8f0); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:0.9rem; color:#0f766e;">الدور المحدد للضبط:</span>
                <span class="badge" style="background:rgba(15,118,110,0.15); color:#0f766e; font-weight:800; padding:4px 10px; border-radius:8px; font-size:0.85rem;">${currentRole.label || currentRole.name} (${currentRole.name})</span>
              </div>

              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.openEditRoleModal('${currentRole.id}')" style="font-size:0.8rem; padding:5px 12px;">
                  ✏️ تعديل بيانات الدور
                </button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.cloneRole('${currentRole.id}')" style="font-size:0.8rem; padding:5px 12px; color:#0284c7; border-color:#0284c7;">
                  📋 استنساخ مصفوفة الدور
                </button>
                ${!isAdmin ? `
                  <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.deleteRole('${currentRole.id}')" style="font-size:0.8rem; padding:5px 12px; color:#dc2626; border-color:#dc2626;">
                    🗑️ حذف الدور
                  </button>
                ` : ''}
              </div>
            </div>

          </div>

          <!-- 3. شريط البحث والتصفية والتحكم السريع في الصلاحيات -->
          <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:14px 18px; box-shadow:0 2px 8px rgba(0,0,0,0.02); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; flex:1; min-width:280px;">
              <div style="position:relative; flex:1; min-width:180px;">
                <input type="text" id="rbac-search-input" value="${this.matrixSearchQuery || ''}" placeholder="🔍 بحث فوري في الصلاحيات الـ ${totalCanonPerms}..." 
                       oninput="window.unifiedSettingsManager.filterMatrixSearch(this.value)"
                       style="width:100%; box-sizing:border-box; padding:8px 12px; font-size:0.85rem; border-radius:8px; border:1px solid var(--border, #cbd5e1); background:var(--bg, #f8fafc); color:var(--text);" />
              </div>

              <select id="rbac-cat-select" onchange="window.unifiedSettingsManager.filterMatrixCategory(this.value)"
                      style="padding:8px 12px; font-size:0.85rem; font-weight:700; border-radius:8px; border:1px solid var(--border, #cbd5e1); background:var(--bg, #f8fafc); color:var(--text);">
                <option value="ALL" ${catFilter === 'ALL' ? 'selected' : ''}>📂 جميع المحركات والموديولات (${CANONICAL_ROLE_MODULES.length})</option>
                ${CANONICAL_ROLE_MODULES.map(m => `
                  <option value="${m.id}" ${catFilter === m.id ? 'selected' : ''}>${m.icon} ${m.name}</option>
                `).join('')}
              </select>
            </div>

            ${!isAdmin ? `
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.toggleAllMatrixPermissions(true)" style="font-size:0.8rem; padding:6px 12px; font-weight:bold;">
                  ✅ تحديد الكل
                </button>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.toggleAllMatrixPermissions(false)" style="font-size:0.8rem; padding:6px 12px; font-weight:bold;">
                  ❌ إلغاء التحديد
                </button>
                <button type="button" class="btn btn-sm btn-primary" onclick="window.unifiedSettingsManager.saveCurrentRolePermissions()" style="font-size:0.85rem; padding:6px 16px; font-weight:800; box-shadow:0 2px 8px rgba(15,118,110,0.3);">
                  💾 حفظ وتطبيق الصلاحيات
                </button>
              </div>
            ` : `
              <div style="background:rgba(217,119,6,0.1); border:1px solid rgba(217,119,6,0.3); border-radius:8px; padding:6px 12px; font-size:0.82rem; font-weight:800; color:#d97706; display:flex; align-items:center; gap:6px;">
                <span>🔒</span> <span>دور مدير النظام الرئيسي يتمتع بكافة الصلاحيات (*) تلقائياً وغير قابل للتعديل</span>
              </div>
            `}

          </div>

          <!-- 4. مصفوفة الصلاحيات المبوبة حسب المحركات (Engine-Grouped Matrix Grid) -->
          <div id="rbac-matrix-container" style="display:flex; flex-direction:column; gap:16px;">
            ${filteredModules.map(mod => {
              const modPerms = mod.permissions;
              const activeInMod = modPerms.filter(p => isAdmin || activePerms.includes(p.key)).length;
              const allCheckedInMod = activeInMod === modPerms.length;

              return `
                <div class="rbac-module-card" style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
                  
                  <!-- Module Header -->
                  <div style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border, #e2e8f0); padding:12px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span style="font-size:1.3rem;">${mod.icon}</span>
                      <div>
                        <div style="font-weight:800; font-size:0.95rem; color:#1e3a8a;">${mod.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${mod.description}</div>
                      </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px;">
                      <span class="badge" style="background:${activeInMod > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)'}; color:${activeInMod > 0 ? '#10b981' : '#64748b'}; font-weight:800; font-size:0.8rem; padding:3px 10px; border-radius:8px;">
                        ${isAdmin ? 'كاملة' : `${activeInMod} من ${modPerms.length} مفعلة`}
                      </span>

                      ${!isAdmin ? `
                        <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.toggleModulePermissions('${mod.id}', ${!allCheckedInMod})" style="font-size:0.75rem; padding:4px 10px; font-weight:bold;">
                          ${allCheckedInMod ? 'إلغاء المحرك' : 'تحديد كل المحرك'}
                        </button>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Permissions Grid -->
                  <div style="padding:16px 18px; display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
                    ${modPerms.map(p => {
                      const isChecked = isAdmin || activePerms.includes(p.key);
                      const riskBadge = p.risk === 'critical' 
                        ? '<span style="font-size:0.68rem; font-weight:800; background:rgba(220,38,38,0.1); color:#dc2626; padding:2px 6px; border-radius:4px;">إداري حرج</span>'
                        : (p.risk === 'action' ? '<span style="font-size:0.68rem; font-weight:800; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 6px; border-radius:4px;">إجراء تشغيلي</span>' : '<span style="font-size:0.68rem; font-weight:800; background:rgba(16,185,129,0.1); color:#10b981; padding:2px 6px; border-radius:4px;">عرض قياسي</span>');

                      return `
                        <label class="rbac-perm-card" style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-radius:8px; border:1px solid ${isChecked ? 'rgba(15,118,110,0.3)' : 'var(--border, #e2e8f0)'}; background:${isChecked ? 'rgba(15,118,110,0.03)' : 'var(--bg, #f8fafc)'}; cursor:${isAdmin ? 'default' : 'pointer'}; transition:all 0.15s ease;">
                          <input type="checkbox" class="rbac-matrix-checkbox" data-module="${mod.id}" value="${p.key}" ${isChecked ? 'checked' : ''} ${isAdmin ? 'disabled' : ''}
                                 onchange="window.unifiedSettingsManager.onPermCheckboxChange(this)"
                                 style="accent-color:var(--primary, #0f766e); transform:scale(1.2); margin-top:3px;" />
                          <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                              <span style="font-weight:700; font-size:0.86rem; color:var(--text, #1e293b);">${p.name}</span>
                              ${riskBadge}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.3;">${p.desc}</div>
                            <div style="font-family:monospace; font-size:0.7rem; color:#64748b; margin-top:4px;"><code>${p.key}</code></div>
                          </div>
                        </label>
                      `;
                    }).join('')}
                  </div>

                </div>
              `;
            }).join('')}
          </div>

          <!-- 5. شريط الحفظ والتطبيق العائم السفلي -->
          ${!isAdmin ? `
            <div style="position:sticky; bottom:12px; z-index:30; background:var(--bg-card, #fff); border:2px solid var(--primary, #0f766e); border-radius:12px; padding:12px 20px; box-shadow:0 8px 24px rgba(0,0,0,0.15); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.3rem;">🛡️</span>
                <div>
                  <div style="font-weight:800; font-size:0.92rem; color:#0f766e;">تطبيق مصفوفة الصلاحيات للدور: ${currentRole.label || currentRole.name}</div>
                  <div style="font-size:0.78rem; color:var(--text-muted);" id="rbac-bottom-summary">سيتم تفعيل الصلاحيات لحظياً لكافة الموظفين المسندين لهذا الدور</div>
                </div>
              </div>

              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-outline" onclick="window.unifiedSettingsManager.selectRoleForMatrix('${currentRole.id}')" style="font-weight:bold; font-size:0.85rem;">
                  تراجع
                </button>
                <button type="button" class="btn btn-primary" onclick="window.unifiedSettingsManager.saveCurrentRolePermissions()" style="font-weight:800; font-size:0.9rem; padding:8px 24px; box-shadow:0 4px 12px rgba(15,118,110,0.35);">
                  💾 حفظ وتطبيق فوري (Instant Propagation)
                </button>
              </div>
            </div>
          ` : ''}

        </div>
      `;
    }

    /* ── دوال إدارة مصفوفة الصلاحيات والأدوار (Dynamic RBAC Engine Suite) ─────── */
    async fetchRolePermissions(roleId) {
      if (!roleId) return [];
      try {
        const res = await this._authFetch('/api/role-permissions/' + roleId);
        if (res.ok) {
          const perms = await res.json();
          this.rolePermissionsCache[roleId] = Array.isArray(perms) ? perms : [];
          return this.rolePermissionsCache[roleId];
        }
      } catch (e) {
        console.warn('⚠️ Error fetching role permissions:', e);
      }
      return this.rolePermissionsCache[roleId] || [];
    }

    async selectRoleForMatrix(roleId) {
      this.selectedMatrixRoleId = roleId;
      await this.fetchRolePermissions(roleId);
      const pane = document.getElementById('settings-tab-main-pane');
      if (pane && this.activeTab === 'roles') {
        pane.innerHTML = this.renderRolesTab();
      }
    }

    filterMatrixSearch(query) {
      this.matrixSearchQuery = query || '';
      const pane = document.getElementById('settings-tab-main-pane');
      if (pane && this.activeTab === 'roles') {
        pane.innerHTML = this.renderRolesTab();
        const input = document.getElementById('rbac-search-input');
        if (input) {
          input.focus();
          input.selectionStart = input.selectionEnd = input.value.length;
        }
      }
    }

    filterMatrixCategory(cat) {
      this.matrixCategoryFilter = cat || 'ALL';
      const pane = document.getElementById('settings-tab-main-pane');
      if (pane && this.activeTab === 'roles') {
        pane.innerHTML = this.renderRolesTab();
      }
    }

    toggleAllMatrixPermissions(checked) {
      document.querySelectorAll('.rbac-matrix-checkbox:not(:disabled)').forEach(cb => {
        cb.checked = checked;
      });
      this.updateMatrixStateFromUI();
    }

    toggleModulePermissions(moduleId, checked) {
      document.querySelectorAll(`.rbac-matrix-checkbox[data-module="${moduleId}"]:not(:disabled)`).forEach(cb => {
        cb.checked = checked;
      });
      this.updateMatrixStateFromUI();
    }

    onPermCheckboxChange(cb) {
      this.updateMatrixStateFromUI();
    }

    updateMatrixStateFromUI() {
      if (!this.selectedMatrixRoleId) return;
      const checkedBoxes = document.querySelectorAll('.rbac-matrix-checkbox:checked');
      const keys = Array.from(checkedBoxes).map(cb => cb.value);
      this.rolePermissionsCache[this.selectedMatrixRoleId] = keys;
    }

    async saveCurrentRolePermissions() {
      if (!this.selectedMatrixRoleId) return;
      this.updateMatrixStateFromUI();
      const permissions = this.rolePermissionsCache[this.selectedMatrixRoleId] || [];

      try {
        const res = await this._authFetch('/api/role-permissions/' + this.selectedMatrixRoleId, {
          method: 'POST',
          body: JSON.stringify({ permissions })
        });
        if (res.ok) {
          if (typeof showToast === 'function') {
            showToast('✅ تم حفظ وتطبيق مصفوفة الصلاحيات للدور بنجاح (Instant Dynamic Propagation)');
          }
          await this.fetchAllData();
          if (typeof window.refreshCurrentUserPermissions === 'function') {
            await window.refreshCurrentUserPermissions();
          }
          const pane = document.getElementById('settings-tab-main-pane');
          if (pane && this.activeTab === 'roles') {
            pane.innerHTML = this.renderRolesTab();
          }
        } else {
          const err = await res.json();
          throw new Error(err.error || 'فشل حفظ الصلاحيات');
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('❌ خطأ: ' + err.message);
      }
    }

    handleRoleTemplateChange(templateKey) {
      const TEMPLATES = {
        'director_public_works': { name: 'director_public_works', label: 'مدير الأشغال والخدمات الهندسية' },
        'head_of_roads': { name: 'head_of_roads', label: 'رئيس قسم الطرق' },
        'head_of_buildings': { name: 'head_of_buildings', label: 'رئيس قسم الأبنية والإنشاءات' },
        'roads_engineer': { name: 'roads_engineer', label: 'مهندس الطرق' },
        'buildings_engineer': { name: 'buildings_engineer', label: 'مهندس الأبنية والإنشاءات' },
        'quantity_surveyor': { name: 'quantity_surveyor', label: 'حاسب الكميات' },
        'site_inspector': { name: 'site_inspector', label: 'المراقب' },
        'qa_qc_engineer': { name: 'qa_qc_engineer', label: 'مهندس ضبط الجودة' },
        'land_surveyor': { name: 'land_surveyor', label: 'المساح' }
      };

      const selected = TEMPLATES[templateKey];
      if (selected) {
        const nameInput = document.getElementById('new-role-name');
        const labelInput = document.getElementById('new-role-label');
        if (nameInput) nameInput.value = selected.name;
        if (labelInput) labelInput.value = selected.label;
      }
    }

    openCreateRoleModal() {
      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.getElementById('modalBody');
      if (!modalTitle || !modalBody) return;

      modalTitle.textContent = '➕ إضافة دور وظيفي جديد ومصفوفة الصلاحيات';
      modalBody.innerHTML = `
        <form id="new-role-form" onsubmit="window.unifiedSettingsManager.submitNewRole(event)" style="display:flex; flex-direction:column; gap:14px; direction:rtl; font-family:'Tajawal',sans-serif;">
          
          <div class="form-group">
            <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">قالب الصلاحيات الابتدائي (Permission Preset Template)</label>
            <select id="new-role-template" onchange="window.unifiedSettingsManager.handleRoleTemplateChange(this.value)" class="form-control" style="width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);">
              <option value="empty">بدء بمصفوفة صلاحيات فارغة</option>
              <option value="head_of_roads">استيراد قالب: رئيس قسم الطرق</option>
              <option value="head_of_buildings">استيراد قالب: رئيس قسم الأبنية والإنشاءات</option>
              <option value="roads_engineer">استيراد قالب: مهندس الطرق</option>
              <option value="buildings_engineer">استيراد قالب: مهندس الأبنية والإنشاءات</option>
              <option value="quantity_surveyor">استيراد قالب: حاسب الكميات</option>
              <option value="site_inspector">استيراد قالب: المراقب</option>
              <option value="qa_qc_engineer">استيراد قالب: مهندس ضبط الجودة</option>
              <option value="land_surveyor">استيراد قالب: المساح</option>
              <option value="director_public_works">استيراد قالب: مدير الأشغال والخدمات الهندسية</option>
            </select>
          </div>

          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">اسم الدور بالإنجليزية (Code Identifier) *</label>
              <input type="text" id="new-role-name" required placeholder="مثال: roads_engineer" class="form-control" style="width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" />
            </div>

            <div class="form-group">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المسمى الوظيفي بالعربية (Arabic Label) *</label>
              <input type="text" id="new-role-label" required placeholder="مثال: مهندس الطرق" class="form-control" style="width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" />
            </div>
          </div>

          <div class="form-group">
            <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">الوصف والمهام والمسؤوليات</label>
            <textarea id="new-role-description" class="form-control" style="width:100%; box-sizing:border-box; height:60px; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" placeholder="اكتب وصفاً موجزاً لطبيعة المهام والمسؤوليات المنوطة بهذا الدور"></textarea>
          </div>

          <div class="form-actions" style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="font-weight:bold; padding:8px 20px;">💾 إنشاء الدور وتفعيل الصلاحيات</button>
          </div>
        </form>
      `;

      const overlay = document.getElementById('modalOverlay');
      if (overlay) overlay.classList.add('open');
    }

    async submitNewRole(e) {
      e.preventDefault();
      const name = document.getElementById('new-role-name')?.value.trim();
      const label = document.getElementById('new-role-label')?.value.trim();
      const description = document.getElementById('new-role-description')?.value.trim();
      const template = document.getElementById('new-role-template')?.value;

      if (!name) return;

      const ENGINEERING_PRESETS = {
        director_public_works: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'ASSETS.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
          'TENDERS.VIEW', 'CLAIMS.VIEW', 'PURCHASES.VIEW', 'TASKS.VIEW', 'CONTRACTS.VIEW', 'REPORTS.VIEW',
          'ARCHIVE.VIEW', 'BUDGET.VIEW', 'PROJECTS.VIEW', 'SETTINGS.VIEW', 'AUDIT.VIEW',
          'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PROJECTS.REVIEW', 'PROJECTS.APPROVE',
          'PROJECTS.COMPLETE', 'PROJECTS.CLOSE', 'PROJECTS.PRINT', 'PROJECTS.EXPORT',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.APPROVE', 'TENDERS.PRINT', 'TENDERS.EXPORT',
          'CLAIMS.AUDIT', 'CLAIMS.APPROVE', 'CLAIMS.PRINT', 'CLAIMS.EXPORT',
          'BUDGET.CREATE', 'BUDGET.EDIT', 'BUDGET.ALLOCATE', 'BUDGET.EXPORT',
          'CONTRACTS.CREATE', 'CONTRACTS.EDIT', 'CONTRACTS.APPROVE', 'CONTRACTS.PRINT', 'CONTRACTS.EXPORT',
          'PURCHASES.CREATE', 'PURCHASES.EDIT', 'PURCHASES.APPROVE', 'PURCHASES.PRINT',
          'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.PCI', 'ROADS.EXPORT',
          'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.APPROVE', 'TASKS.PRINT'
        ],
        head_of_roads: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
          'TENDERS.VIEW', 'CLAIMS.VIEW', 'TASKS.VIEW', 'CONTRACTS.VIEW', 'REPORTS.VIEW',
          'ARCHIVE.VIEW', 'PROJECTS.VIEW',
          'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PROJECTS.REVIEW', 'PROJECTS.PRINT',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT', 'TENDERS.EXPORT',
          'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.PRINT',
          'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.PCI', 'ROADS.EXPORT',
          'PERMITS.CREATE', 'PERMITS.EDIT', 'PERMITS.APPROVE', 'PERMITS.INSPECT', 'PERMITS.REINSTATE',
          'PAVING.CREATE', 'PAVING.EDIT', 'PAVING.CALCULATE', 'PAVING.EXPORT',
          'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.REVIEW', 'TASKS.APPROVE', 'TASKS.PRINT'
        ],
        head_of_buildings: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW',
          'TASKS.VIEW', 'CONTRACTS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
          'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PROJECTS.REVIEW', 'PROJECTS.PRINT',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT', 'TENDERS.EXPORT',
          'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.PRINT',
          'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT', 'ASSETS.EXPORT',
          'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.REVIEW', 'TASKS.APPROVE', 'TASKS.PRINT'
        ],
        roads_engineer: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
          'TENDERS.VIEW', 'CLAIMS.VIEW', 'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
          'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.PRINT',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT',
          'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.PRINT',
          'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.PCI', 'ROADS.EXPORT',
          'PERMITS.CREATE', 'PERMITS.EDIT', 'PERMITS.INSPECT',
          'PAVING.CREATE', 'PAVING.EDIT', 'PAVING.CALCULATE',
          'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT'
        ],
        buildings_engineer: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW',
          'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
          'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.PRINT',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT',
          'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.PRINT',
          'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT',
          'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT'
        ],
        quantity_surveyor: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW', 'CONTRACTS.VIEW',
          'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW', 'ROADS.VIEW', 'PAVING.VIEW',
          'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT',
          'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.PRINT',
          'PAVING.CALCULATE', 'PAVING.PRINT',
          'CONTRACTS.VIEW', 'CONTRACTS.PRINT', 'REPORTS.EXPORT'
        ],
        site_inspector: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'ASSETS.VIEW',
          'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW',
          'PERMITS.INSPECT', 'PERMITS.REINSTATE',
          'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
          'ROADS.PCI', 'ASSETS.INSPECT'
        ],
        qa_qc_engineer: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW',
          'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
          'ROADS.PCI', 'ASSETS.INSPECT',
          'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
          'REPORTS.PRINT', 'REPORTS.EXPORT'
        ],
        land_surveyor: [
          'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
          'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'ASSETS.VIEW',
          'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.PCI',
          'PAVING.CREATE', 'PAVING.CALCULATE',
          'PERMITS.INSPECT',
          'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT'
        ]
      };

      try {
        const res = await this._authFetch('/api/roles', {
          method: 'POST',
          body: JSON.stringify({ name, label: label || name, description })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'فشل إضافة الدور');
        }

        const data = await res.json();
        const roleId = data.id;

        // Apply template permissions if selected
        if (template && template !== 'empty' && ENGINEERING_PRESETS[template]) {
          await this._authFetch('/api/role-permissions/' + encodeURIComponent(roleId), {
            method: 'POST',
            body: JSON.stringify({ permissions: ENGINEERING_PRESETS[template] })
          });
        }

        if (typeof showToast === 'function') showToast('✅ تم إنشاء الدور الوظيفي بنجاح وتفعيل قالبه');
        if (typeof closeModal === 'function') closeModal();
        document.getElementById('modalOverlay')?.classList.remove('open');
        await this.fetchAllData();
        this.selectedMatrixRoleId = roleId;
        await this.fetchRolePermissions(roleId);
        const pane = document.getElementById('settings-tab-main-pane');
        if (pane && this.activeTab === 'roles') {
          pane.innerHTML = this.renderRolesTab();
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('❌ خطأ: ' + err.message);
      }
    }

    openRoleDetailsModal(roleId) {
      const role = (this.roles || []).find(r => r.id === roleId);
      if (!role) return;

      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.getElementById('modalBody');
      if (!modalTitle || !modalBody) return;

      const rawDesc = role.description || 'لا يوجد وصف مفصل متاح لهذا الدور الوظيفي.';
      let formattedHtml = rawDesc
        .replace(/^### (.*$)/gim, '<h4 style="color:#0f766e; margin:12px 0 6px; font-size:0.95rem; font-weight:800;">$1</h4>')
        .replace(/^## (.*$)/gim, '<h3 style="color:#1e3a8a; margin:14px 0 8px; font-size:1.05rem; font-weight:800; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">$1</h3>')
        .replace(/^# (.*$)/gim, '<h2 style="color:#1e293b; margin:16px 0 10px; font-size:1.15rem; font-weight:800;">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text, #1e293b); font-weight:800;">$1</strong>')
        .replace(/\n/g, '<br/>');

      modalTitle.textContent = `📋 بطاقة الوصف والمهام الوظيفية: ${role.label || role.name}`;
      modalBody.innerHTML = `
        <div style="direction:rtl; font-family:'Tajawal',sans-serif; display:flex; flex-direction:column; gap:14px; max-height:70vh; overflow-y:auto; padding:4px;">
          
          <div style="background:rgba(15,118,110,0.08); border:1px solid rgba(15,118,110,0.2); border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-weight:800; font-size:1.05rem; color:#0f766e;">${role.label || role.name}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-family:monospace;">رمز الدور: ${role.name} (${role.id})</div>
            </div>
            <span class="badge" style="background:#0f766e; color:#fff; font-size:0.8rem; padding:4px 12px; border-radius:8px;">مديرية الأشغال الهندسية</span>
          </div>

          <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border, #e2e8f0); border-radius:10px; padding:16px; font-size:0.88rem; line-height:1.7; color:var(--text, #334155);">
            ${formattedHtml}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border, #e2e8f0);">
            <button type="button" class="btn btn-outline" onclick="closeModal()">إغلاق النافذة</button>
            <button type="button" class="btn btn-primary" onclick="closeModal(); window.unifiedSettingsManager.openEditRoleModal('${role.id}')">✏️ تعديل الوصف</button>
          </div>
        </div>
      `;

      const overlay = document.getElementById('modalOverlay');
      if (overlay) overlay.classList.add('open');
    }

    openEditRoleModal(roleId) {
      const role = (this.roles || []).find(r => r.id === roleId || r.name === roleId);
      if (!role) return;

      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.getElementById('modalBody');
      if (!modalTitle || !modalBody) return;

      const currentLabel = (role.label && role.label.trim()) ? role.label.trim() : (role.name || '');
      const targetId = role.id || role.name;

      modalTitle.textContent = `✏️ تعديل بيانات الدور: ${currentLabel}`;
      modalBody.innerHTML = `
        <form id="edit-role-form" onsubmit="window.unifiedSettingsManager.submitEditRole(event, '${targetId}')" style="display:flex; flex-direction:column; gap:14px; direction:rtl; font-family:'Tajawal',sans-serif;">
          
          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">اسم الدور (Code Identifier)</label>
              <input type="text" id="edit-role-name" value="${role.name}" ${role.id === 'R-001' || role.name === 'admin' ? 'disabled' : ''} class="form-control" style="width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" />
            </div>

            <div class="form-group">
              <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">المسمى الوظيفي بالعربية (Arabic Label)</label>
              <input type="text" id="edit-role-label" value="${currentLabel}" class="form-control" style="width:100%; box-sizing:border-box; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);" placeholder="اكتب المسمى الوظيفي بالعربية" required />
            </div>
          </div>

          <div class="form-group">
            <label style="font-weight:bold; font-size:0.85rem; margin-bottom:4px; display:block;">الوصف والمهام والمسؤوليات</label>
            <textarea id="edit-role-description" class="form-control" style="width:100%; box-sizing:border-box; height:70px; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text);">${role.description || ''}</textarea>
          </div>

          <div class="form-actions" style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="font-weight:bold; padding:8px 20px;">💾 حفظ التعديلات</button>
          </div>
        </form>
      `;

      const overlay = document.getElementById('modalOverlay');
      if (overlay) overlay.classList.add('open');
    }

    async submitEditRole(e, roleId) {
      if (e) e.preventDefault();
      const name = document.getElementById('edit-role-name')?.value.trim();
      const label = document.getElementById('edit-role-label')?.value.trim();
      const description = document.getElementById('edit-role-description')?.value.trim();

      if (!label) {
        if (typeof showToast === 'function') showToast('⚠️ يرجى إدخال المسمى الوظيفي بالعربية');
        return;
      }

      try {
        const res = await this._authFetch('/api/roles/' + encodeURIComponent(roleId), {
          method: 'PUT',
          body: JSON.stringify({ name: name || roleId, label: label, description: description !== undefined ? description : '' })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'فشل تعديل الدور');
        }

        // Instantly update local roles array in memory
        const roleObj = (this.roles || []).find(r => r.id === roleId || r.name === roleId);
        if (roleObj) {
          if (name) roleObj.name = name;
          if (label) roleObj.label = label;
          if (description !== undefined) roleObj.description = description;
        }

        if (typeof showToast === 'function') showToast('✅ تم تعديل بيانات الدور بنجاح');
        if (typeof closeModal === 'function') closeModal();
        document.getElementById('modalOverlay')?.classList.remove('open');

        await this.fetchAllData();
        const pane = document.getElementById('settings-tab-main-pane');
        if (pane && this.activeTab === 'roles') {
          pane.innerHTML = this.renderRolesTab();
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('❌ خطأ: ' + err.message);
      }
    }

    async cloneRole(roleId) {
      const sourceRole = (this.roles || []).find(r => r.id === roleId);
      if (!sourceRole) return;

      const newName = `${sourceRole.name}_copy`;
      const newLabel = `${sourceRole.label || sourceRole.name} (نسخة)`;
      const newDesc = `استنساخ من ${sourceRole.label || sourceRole.name} - ${sourceRole.description || ''}`;

      try {
        const res = await this._authFetch('/api/roles', {
          method: 'POST',
          body: JSON.stringify({ name: newName, label: newLabel, description: newDesc })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'فشل استنساخ الدور');
        }

        const data = await res.json();
        const newRoleId = data.id;

        const sourcePerms = await this.fetchRolePermissions(roleId);
        if (sourcePerms && sourcePerms.length > 0) {
          await this._authFetch('/api/role-permissions/' + newRoleId, {
            method: 'POST',
            body: JSON.stringify({ permissions: sourcePerms })
          });
        }

        if (typeof showToast === 'function') showToast('✅ تم استنساخ مصفوفة الدور بنجاح');
        await this.fetchAllData();
        this.selectedMatrixRoleId = newRoleId;
        await this.fetchRolePermissions(newRoleId);
        const pane = document.getElementById('settings-tab-main-pane');
        if (pane && this.activeTab === 'roles') {
          pane.innerHTML = this.renderRolesTab();
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('❌ خطأ: ' + err.message);
      }
    }

    async deleteRole(roleId) {
      if (roleId === 'R-001') {
        if (typeof showToast === 'function') showToast('⚠️ لا يمكن حذف دور مدير النظام الرئيسي!');
        return;
      }
      if (!confirm('هل أنت متأكد من حذف هذا الدور الوظيفي ومصفوفة صلاحياته؟')) return;

      try {
        const res = await this._authFetch('/api/roles/' + roleId, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'فشل حذف الدور');
        }

        if (typeof showToast === 'function') showToast('🗑️ تم حذف الدور بنجاح');
        this.selectedMatrixRoleId = null;
        await this.fetchAllData();
        const pane = document.getElementById('settings-tab-main-pane');
        if (pane && this.activeTab === 'roles') {
          pane.innerHTML = this.renderRolesTab();
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('❌ فشل الحذف: ' + err.message);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       9. تبويب جداول الترميز
       ═══════════════════════════════════════════════════════════════════════════ */
    renderLookupsTab() {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.05rem; font-weight:bold; color:#1e3a8a;">🏷️ جداول الترميز والخيارات العامة (System Lookups)</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">إدارة القوائم المنسدلة، أنواع العطاءات، الأولويات، وحالات المشاريع</p>
            </div>
            <button class="btn btn-primary" onclick="openLookupModal()" style="font-weight:bold;">
              + إضافة ترميز جديد
            </button>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                  <th style="padding:10px 14px;">المعرف</th>
                  <th style="padding:10px 14px;">المجموعة (Group)</th>
                  <th style="padding:10px 14px;">الرمز (Code)</th>
                  <th style="padding:10px 14px;">القيمة المعروضة (العربية)</th>
                  <th style="padding:10px 14px;">الترتيب</th>
                  <th style="padding:10px 14px;">الحالة</th>
                  <th style="padding:10px 14px; text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="lookups-tbody">
                ${this.lookups.map(l => `
                  <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                    <td style="padding:10px 14px; font-family:monospace; color:var(--text-muted);">${l.id}</td>
                    <td style="padding:10px 14px; font-weight:bold; color:#1e3a8a;">${l.group}</td>
                    <td style="padding:10px 14px;"><code>${l.code}</code></td>
                    <td style="padding:10px 14px; font-weight:bold;">${l.valueAr}</td>
                    <td style="padding:10px 14px;">${l.sortOrder}</td>
                    <td style="padding:10px 14px;">${l.isActive ? '<span style="color:#16a34a; font-weight:bold;">نشط</span>' : '<span style="color:var(--text-muted);">معطل</span>'}</td>
                    <td style="padding:10px 14px; text-align:center;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" onclick="openLookupModal('${l.id}')">✏️ تعديل</button>
                        <button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="deleteLookup('${l.id}')">🗑️ حذف</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       10. تبويب مسارات العمل
       ═══════════════════════════════════════════════════════════════════════════ */
    renderWorkflowsTab() {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0 0 4px 0; font-size:1.05rem; font-weight:bold; color:#1e3a8a;">⛓️ مسارات الموافقات وسلاسل الاعتماد (Workflows)</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">تصميم ومتابعة خطوات تدقيق واعتماد المستندات والمطالبات</p>
            </div>
            <button class="btn btn-primary" onclick="openWorkflowModal()" style="font-weight:bold;">
              + إضافة مسار عمل جديد
            </button>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                  <th style="padding:10px 14px;">المعرف</th>
                  <th style="padding:10px 14px;">اسم مسار العمل</th>
                  <th style="padding:10px 14px;">المعاملة المرتبطة</th>
                  <th style="padding:10px 14px;">سلسلة خطوات ومراحل الاعتماد</th>
                  <th style="padding:10px 14px; text-align:center;">الإجراءات</th>
                </tr>
              </thead>
              <tbody id="workflows-tbody">
                ${this.workflows.map(w => {
                  let steps = [];
                  try { steps = typeof w.stepsJson === 'string' ? JSON.parse(w.stepsJson) : (w.stepsJson || []); } catch (e) {}
                  
                  const entityLabels = {
                    'claims': 'المطالبات والمستخلصات',
                    'excavation_permits': 'تصاريح الحفر وتنسيق الخدمات',
                    'paving_returns': 'عوائد التعبيد والإنشاء',
                    'tasks': 'الكشوفات والتكليفات الميدانية',
                    'variation_orders': 'أوامر التغيير الهندسية',
                    'tenders': 'المشاريع والعطاءات',
                    'purchases': 'المشتريات واللوازم والتوريدات'
                  };
                  const entityName = entityLabels[w.entityType] || w.entityType;

                  const stepsPipelineHtml = steps.length ? `
                    <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                      ${steps.map((s, i) => `
                        <span style="font-size:0.75rem; background:rgba(30,58,138,0.08); color:#1e3a8a; padding:2px 7px; border-radius:12px; font-weight:600; border:1px solid rgba(30,58,138,0.15);">
                          ${i + 1}. ${s.label || s.title || 'مرحلة'}
                        </span>
                        ${i < steps.length - 1 ? '<span style="color:var(--text-muted); font-size:0.7rem;">⬅️</span>' : ''}
                      `).join('')}
                    </div>
                  ` : '<span style="color:var(--text-muted); font-size:0.8rem;">لا توجد خطوات</span>';

                  return `
                    <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                      <td style="padding:10px 14px; font-family:monospace; color:var(--text-muted); font-weight:600;">${w.id}</td>
                      <td style="padding:10px 14px;">
                        <div style="font-weight:bold; color:var(--text);">${w.name}</div>
                        ${w.description ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${w.description}</div>` : ''}
                      </td>
                      <td style="padding:10px 14px;">
                        <span class="badge" style="background:rgba(2,132,199,0.1); color:#0284c7; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.8rem;">
                          ${entityName}
                        </span>
                      </td>
                      <td style="padding:10px 14px;">
                        ${stepsPipelineHtml}
                      </td>
                      <td style="padding:10px 14px; text-align:center;">
                        <div style="display:inline-flex; gap:6px;">
                          <button class="btn btn-sm btn-primary" onclick="openWorkflowModal('${w.id}')" style="font-weight:bold;">⚙️ تعديل وتصميم</button>
                          <button class="btn btn-sm btn-outline" style="color:#dc2626;" onclick="deleteWorkflow('${w.id}')">🗑️ حذف</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       11. تبويب الخادم والأمان والنسخ الاحتياطي
       ═══════════════════════════════════════════════════════════════════════════ */
    renderServerTab() {
      return `
        <div style="display:flex; flex-direction:column; gap:18px;">
          <input type="file" id="import-db-file-input" style="display:none;" onchange="window.unifiedSettingsManager.handleImportBackup(this)" accept=".enc,.json" />
          
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
            <!-- Database Info Card -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border, #cbd5e1); display:flex; flex-direction:column; gap:12px;">
              <h3 style="font-size:1.02rem; font-weight:bold; color:#1e3a8a; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:8px; margin:0; display:flex; align-items:center; gap:8px;">
                <span>🗄️</span> <span>خادم قاعدة البيانات PostgreSQL</span>
              </h3>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">حالة الاتصال المباشر:</span>
                <span style="color:#16a34a; font-weight:bold;">🟢 متصل ويعمل بكفاءة</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">اسم قاعدة البيانات:</span>
                <span style="font-family:monospace; color:var(--text); font-weight:bold;">kafr_inja_engineering</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">المحرك الجغرافي PostGIS:</span>
                <span style="color:#0284c7; font-weight:bold;">v3.6.2 (Spatial Active)</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0;">
                <span style="color:var(--text-muted);">منفذ الاستماع (Port):</span>
                <span style="font-family:monospace; color:var(--text);">5432 (TCP)</span>
              </div>
            </div>

            <!-- Network & LAN Security Card -->
            <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border, #cbd5e1); display:flex; flex-direction:column; gap:12px;">
              <h3 style="font-size:1.02rem; font-weight:bold; color:#1e3a8a; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:8px; margin:0; display:flex; align-items:center; gap:8px;">
                <span>🌐</span> <span>الشبكة المحلية والأمان (LAN & Gateway)</span>
              </h3>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">منفذ خادم الويب (Web Port):</span>
                <span style="font-family:monospace; color:#0284c7; font-weight:bold;">3005 (HTTP/WebSocket)</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">جدار الحماية (Firewall Rule):</span>
                <span style="color:#16a34a; font-weight:bold;">✅ مسموح (KafrInja_ERP_3005)</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0; border-bottom:1px solid var(--border, #f1f5f9);">
                <span style="color:var(--text-muted);">التشفير والأمان (Crypto):</span>
                <span style="color:var(--text); font-weight:600;">AES-256-CBC Encrypted Backups</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:6px 0;">
                <span style="color:var(--text-muted);">صلاحيات النظام المحمية:</span>
                <span style="color:#1e3a8a; font-weight:bold;">51 صلاحية مفعلة (RBAC)</span>
              </div>
            </div>
          </div>

          <!-- Fast Maintenance & Backup Operations -->
          <div class="card" style="background:var(--bg-card, #fff); padding:20px; border-radius:12px; border:1px solid var(--border, #cbd5e1); display:flex; flex-direction:column; gap:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:10px; flex-wrap:wrap; gap:10px;">
              <div>
                <h3 style="font-size:1.02rem; font-weight:bold; color:#1e3a8a; margin:0 0 2px 0; display:flex; align-items:center; gap:8px;">
                  <span>⚡</span> <span>عمليات الصيانة والنسخ الاحتياطي الفوري المشفر</span>
                </h3>
                <span style="font-size:0.8rem; color:var(--text-muted);">توليد وتنزيل نسخ احتياطية كاملة ومحمية بكلمات مرور وتشفير AES-256</span>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-primary" onclick="window.unifiedSettingsManager.triggerInstantBackup()" style="padding:8px 18px; font-weight:bold; display:flex; align-items:center; gap:6px;">
                  <span>📦</span> <span>أخذ وتنزيل نسخة احتياطية مشفرة فورية الآن</span>
                </button>
                <button type="button" class="btn btn-outline" onclick="window.unifiedSettingsManager.checkServerHealth()" style="padding:8px 16px; font-weight:bold;">
                  🔄 إعادة فحص حالة الاتصال بالخادم
                </button>
              </div>
            </div>

            <!-- جدول النسخ الاحتياطية المحفوظة -->
            <div>
              <div style="font-weight:bold; font-size:0.88rem; color:#1e3a8a; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                <span>🗄️ سجل النسخ الاحتياطية المحفوظة بالنظام (Encrypted Backups Archive):</span>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.fetchBackupsList()" style="font-size:0.75rem; padding:2px 8px;">🔄 تحديث الأرشيف</button>
              </div>
              <div class="table-container" style="overflow-x:auto;">
                <table class="data-table" style="width:100%; border-collapse:collapse;">
                  <thead>
                    <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                      <th style="padding:8px 12px; font-size:0.82rem;">اسم ملف النسخة</th>
                      <th style="padding:8px 12px; font-size:0.82rem;">نوع التشفير</th>
                      <th style="padding:8px 12px; font-size:0.82rem;">الحجم (KB)</th>
                      <th style="padding:8px 12px; font-size:0.82rem;">تاريخ الإنشاء</th>
                      <th style="padding:8px 12px; text-align:center; font-size:0.82rem;">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.backups.length ? this.backups.map(b => `
                      <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                        <td style="padding:8px 12px; font-family:monospace; font-weight:bold; color:var(--text); font-size:0.82rem;">🔒 ${b.filename}</td>
                        <td style="padding:8px 12px;"><span class="badge" style="background:rgba(22,163,74,0.1); color:#16a34a; font-weight:bold; font-size:0.75rem; padding:2px 6px; border-radius:4px;">AES-256-CBC</span></td>
                        <td style="padding:8px 12px; font-weight:600; font-size:0.82rem;">${b.sizeKb} KB</td>
                        <td style="padding:8px 12px; font-size:0.8rem; color:var(--text-muted);">${new Date(b.createdAt).toLocaleString('ar-JO')}</td>
                        <td style="padding:8px 12px; text-align:center;">
                          <div style="display:inline-flex; gap:6px;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="window.unifiedSettingsManager.downloadBackupFile('${b.filename}')" style="font-size:0.75rem; padding:3px 8px;">⬇️ تنزيل</button>
                            <button type="button" class="btn btn-sm btn-outline" onclick="window.unifiedSettingsManager.deleteBackupFile('${b.filename}')" style="color:#dc2626; font-size:0.75rem; padding:3px 8px;">🗑️ حذف</button>
                          </div>
                        </td>
                      </tr>
                    `).join('') : `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--text-muted); font-size:0.83rem;">لا توجد نسخ احتياطية سابقة، اضغط "أخذ وتنزيل نسخة احتياطية مشفرة فورية الآن" لإنشاء أول نسخة.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      `;
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       12. تبويب سجل النشاطات
       ═══════════════════════════════════════════════════════════════════════════ */
    _getActionBadge(action = '') {
      const act = String(action).toLowerCase();
      if (act.includes('دخول') || act.includes('login') || act.includes('auth')) {
        return `<span class="badge" style="background:rgba(22,163,74,0.1); color:#16a34a; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🟢 ${action}</span>`;
      }
      if (act.includes('اعتماد') || act.includes('مسار') || act.includes('workflow') || act.includes('approve')) {
        return `<span class="badge" style="background:rgba(37,99,235,0.1); color:#2563eb; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🔵 ${action}</span>`;
      }
      if (act.includes('صلاح') || act.includes('دور') || act.includes('rbac') || act.includes('user')) {
        return `<span class="badge" style="background:rgba(147,51,234,0.1); color:#9333ea; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🟣 ${action}</span>`;
      }
      if (act.includes('احتياط') || act.includes('تحديث') || act.includes('هوية') || act.includes('backup') || act.includes('edit')) {
        return `<span class="badge" style="background:rgba(217,119,6,0.1); color:#d97706; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🟠 ${action}</span>`;
      }
      if (act.includes('حذف') || act.includes('delete') || act.includes('رفض') || act.includes('reject')) {
        return `<span class="badge" style="background:rgba(220,38,38,0.1); color:#dc2626; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🔴 ${action}</span>`;
      }
      return `<span class="badge" style="background:rgba(15,118,110,0.1); color:#0f766e; padding:3px 10px; border-radius:6px; font-weight:bold; font-size:0.78rem;">🔷 ${action}</span>`;
    }

    renderActivityTab() {
      return `
        <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:14px;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border, #f1f5f9); padding-bottom:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="margin:0; font-size:1.05rem; font-weight:bold; color:#1e3a8a;">🕵️ سجل النشاطات والتدقيق الأمني (Audit Trail)</h3>
                <span class="badge" style="background:rgba(30,58,138,0.1); color:#1e3a8a; font-weight:bold; font-size:0.8rem; padding:2px 8px; border-radius:12px;">${this.activityLogs.length} حركة مسجلة</span>
              </div>
              <p style="margin:4px 0 0 0; font-size:0.8rem; color:var(--text-muted);">تتبع وتوثيق رقمي مشفر لكافة العمليات الإدارية وتعديلات الصلاحيات وحركات المشاريع</p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="text" id="activity-search-input" placeholder="🔍 بحث في الحركات والأنشطة..." oninput="window.unifiedSettingsManager.filterActivityLogs(this.value)" style="padding:6px 12px; font-size:0.82rem; border-radius:8px; border:1px solid var(--border, #cbd5e1); width:240px;" />
              <button class="btn btn-outline" onclick="window.unifiedSettingsManager.fetchActivityLogs()" style="display:flex; align-items:center; gap:6px; font-size:0.82rem; padding:6px 14px; font-weight:bold;">
                <span>🔄</span> <span>تحديث السجل</span>
              </button>
            </div>
          </div>

          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-surface, #f8fafc); border-bottom:1px solid var(--border);">
                  <th style="padding:10px 12px; font-size:0.82rem;">المعرف</th>
                  <th style="padding:10px 12px; font-size:0.82rem;">المستخدم / القائم بالحركة</th>
                  <th style="padding:10px 12px; font-size:0.82rem;">نوع الإجراء</th>
                  <th style="padding:10px 12px; font-size:0.82rem;">العنصر المستهدف</th>
                  <th style="padding:10px 12px; font-size:0.82rem;">التفاصيل وملاحظات التدقيق</th>
                  <th style="padding:10px 12px; font-size:0.82rem;">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody id="activity-tbody">
                ${this.activityLogs.length ? this.activityLogs.map(l => `
                  <tr style="border-bottom:1px solid var(--border, #f1f5f9);">
                    <td style="padding:10px 12px; font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${l.id}</td>
                    <td style="padding:10px 12px; font-weight:bold; color:var(--text);">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:1rem;">👤</span>
                        <span>${l.userName || l.userId || 'مدير النظام'}</span>
                      </div>
                    </td>
                    <td style="padding:10px 12px;">${this._getActionBadge(l.action)}</td>
                    <td style="padding:10px 12px; font-weight:600; color:#1e3a8a; font-size:0.83rem;">${l.entity || '—'} ${l.entityId ? `<span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">(${l.entityId})</span>` : ''}</td>
                    <td style="padding:10px 12px; font-size:0.84rem; color:var(--text);">${l.details || '—'}</td>
                    <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-muted); font-family:monospace;">${l.createdAt ? new Date(l.createdAt).toLocaleString('ar-JO') : '—'}</td>
                  </tr>
                `).join('') : `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">لا توجد حركات مسجلة في السجل</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    filterActivityLogs(q = '') {
      const query = String(q).trim().toLowerCase();
      const rows = document.querySelectorAll('#activity-tbody tr');
      rows.forEach(tr => {
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(query) ? '' : 'none';
      });
    }

    async checkServerHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          showToast('✅ خادم النظام وقاعدة البيانات تعمل بكفاءة عالية (HTTP 200 OK)');
        } else {
          showToast('⚠️ استجابة الخادم غير اعتيادية');
        }
      } catch (e) {
        showToast('❌ تعذر الوصول للخادم: ' + e.message);
      }
    }

    async fetchBackupsList() {
      try {
        const res = await this._authFetch('/api/v4/admin/backups-list');
        if (res.ok) {
          const json = await res.json();
          this.backups = Array.isArray(json.data) ? json.data : [];
          this.stats.backupsCount = this.backups.length;
          if (this.activeTab === 'server') this.renderTabContent();
        }
      } catch (e) {}
    }

    async triggerInstantBackup() {
      try {
        showToast('⏳ جاري إنشاء وتشفير النسخة الاحتياطية بـ AES-256...');
        const res = await this._authFetch('/api/v4/admin/trigger-backup', { method: 'POST' });
        if (res.ok) {
          const json = await res.json();
          showToast('✅ تم إنشاء النسخة الاحتياطية المشفرة بنجاح: ' + json.data.filename);
          await this.fetchBackupsList();
          this.downloadBackupFile(json.data.filename);
        } else {
          showToast('❌ فشل إنشاء النسخة الاحتياطية');
        }
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    downloadBackupFile(filename) {
      const token = localStorage.getItem('token');
      const url = `/api/v4/admin/download-backup/${encodeURIComponent(filename)}`;
      fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      .then(res => {
        if (!res.ok) throw new Error('فشل تحميل الملف');
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('📥 تم بدء تنزيل النسخة الاحتياطية المشفرة بنجاح');
      })
      .catch(err => {
        showToast('❌ خطأ في تنزيل الملف: ' + err.message);
      });
    }

    async deleteBackupFile(filename) {
      if (!confirm(`هل أنت متأكد من حذف ملف النسخة الاحتياطية (${filename})؟`)) return;
      try {
        const res = await this._authFetch(`/api/v4/admin/delete-backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('🗑️ تم حذف ملف النسخة الاحتياطية بنجاح');
          await this.fetchBackupsList();
        } else {
          showToast('❌ فشل حذف الملف');
        }
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
      }
    }

    async handleImportBackup(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (!confirm('⚠️ تحذير: استيراد النسخة الاحتياطية سيقوم بتحديث واستبدال الجداول الحالية. هل تود المتابعة؟')) {
        input.value = '';
        return;
      }

      showToast('⏳ جاري قراءة وفك تشفير النسخة واسترجاع البيانات...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const res = await this._authFetch('/api/v4/admin/restore-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: typeof content === 'string' ? content : JSON.stringify(content)
          });
          if (res.ok) {
            showToast('✅ تم استرجاع وفك تشفير قاعدة البيانات بنجاح! جاري التحديث...');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            const errJson = await res.json();
            showToast('❌ فشل الاسترجاع: ' + (errJson.error || 'خطأ غير معروف'));
          }
        } catch (err) {
          showToast('❌ خطأ في معالجة الملف: ' + err.message);
        }
        input.value = '';
      };
      reader.readAsText(file);
    }

    async exportConfigurationJson() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/settings/export-config', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('فشل تصدير ملف الإعدادات');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = `kafrinja_system_settings_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('📥 تم تصدير ملف إعدادات المنظومة (JSON) بنجاح');
      } catch (err) {
        showToast('❌ خطأ أثناء التصدير: ' + err.message);
      }
    }

    async handleImportConfigJson(input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (!confirm(`هل تود استيراد وتطبيق الإعدادات من الملف (${file.name})؟ سيتم تحديث كافة المعايير والهوية والترقيم فوراً.`)) {
        input.value = '';
        return;
      }

      showToast('⏳ جاري قراءة وتطبيق ملف الإعدادات...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const res = await this._authFetch('/api/settings/import-config', {
            method: 'POST',
            body: JSON.stringify(parsed)
          });
          const json = await res.json();
          if (json && json.success) {
            showToast('✅ تم استيراد وتطبيق كافة إعدادات المنظومة بنجاح!');
            if (typeof window.applySystemIdentity === 'function') {
              window.applySystemIdentity(json.data);
            }
            await this.fetchVisualIdentity();
            this.render();
          } else {
            showToast('❌ فشل الاستيراد: ' + (json?.error || 'خطأ غير معروف'));
          }
        } catch (err) {
          showToast('❌ خطأ في معالجة ملف JSON: ' + err.message);
        }
        input.value = '';
      };
      reader.readAsText(file);
    }
  }

  /* تسجيل المحرك عالمياً */
  global.UnifiedSettingsManager = UnifiedSettingsManager;
  if (!global.unifiedSettingsManager) {
    global.unifiedSettingsManager = new UnifiedSettingsManager();
  }

}(window));
