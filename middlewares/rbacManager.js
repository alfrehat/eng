/**
 * middlewares/rbacManager.js
 * 🛡️ منظومة التحكم الموحد بالصلاحيات والمصفوفة الأمنية المؤسسية (Enterprise RBAC & Permission Enforcement Engine)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v4.0
 * 
 * المبادئ الأمنية والمعمارية:
 * 1. نموذج صلاحيات موحد (Unified Canonical Permission Model) مع دعم التوافق التراجعي الكامل لكافة الصيغ.
 * 2. تطبيق الحماية الصارمة من جانب الخادم (Server-Side Enforcement) برمز 401 عند غياب الهوية و 403 عند نقص الصلاحية.
 * 3. منع الاعتماد الحصري على إخفاء الأزرار أو التبويبات بالواجهة الأمامية.
 * 4. إدارة ديناميكية خالية من الكود (Zero-Code Dynamic RBAC) للأدوار والصلاحيات والمستخدمين.
 * 5. تسجيل ومراقبة كافة محاولات الوصول المرفوضة والقرارات الأمنية الحساسة في سجل التدقيق (Audit Trail).
 * 6. فرض قواعد فصل المهام والمسؤوليات (Separation of Duties).
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';

/**
 * خريطة جرد الصلاحيات المؤسسية الرسمية المعتمدة في النظام (Canonical Permission Inventory)
 */
const PERMISSION_INVENTORY = [
  // ─── 1. التبويبات والشاشات الرئيسية (Navigation & View Permissions) ───
  { permissionCode: 'DASHBOARD.VIEW', aliases: ['dashboard', 'dashboard:view'], module: 'DASHBOARD', resource: 'dashboard', action: 'VIEW', scope: 'ALL', name: 'لوحة التحكم الرئيسية', group: 'screens', icon: '📊', sensitive: false, requiresApproval: false },
  { permissionCode: 'MY_WORK.VIEW', aliases: ['my-work', 'my-work:view', 'my_work'], module: 'MY_WORK', resource: 'my_work', action: 'VIEW', scope: 'OWN', name: 'أعمالي والمهام الموكلة', group: 'screens', icon: '💼', sensitive: false, requiresApproval: false },
  { permissionCode: 'ROADS.VIEW', aliases: ['roads', 'roads:view'], module: 'ROADS', resource: 'roads', action: 'VIEW', scope: 'ALL', name: 'شبكة الطرق والرصفات (RAMS)', group: 'screens', icon: '🛣️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ASSETS.VIEW', aliases: ['structural-assets', 'assets', 'assets:view', 'infrastructure', 'energy-lighting'], module: 'ASSETS', resource: 'assets', action: 'VIEW', scope: 'ALL', name: 'الأصول الإنشائية والشبكات', group: 'screens', icon: '🏛️', sensitive: false, requiresApproval: false },
  { permissionCode: 'PERMITS.VIEW', aliases: ['excavation-permits', 'permits', 'permits:view'], module: 'PERMITS', resource: 'excavation_permits', action: 'VIEW', scope: 'ALL', name: 'تصاريh الحفر وتزويد الخدمات', group: 'screens', icon: '🚜', sensitive: false, requiresApproval: false },
  { permissionCode: 'PAVING.VIEW', aliases: ['paving-returns', 'paving', 'paving:view'], module: 'PAVING', resource: 'paving_returns', action: 'VIEW', scope: 'ALL', name: 'عوائد التعبيد والتحققات', group: 'screens', icon: '💰', sensitive: false, requiresApproval: false },
  { permissionCode: 'TENDERS.VIEW', aliases: ['tenders', 'tenders:view'], module: 'TENDERS', resource: 'tenders', action: 'VIEW', scope: 'ALL', name: 'إدارة العطاءات والمشاريع الرأسمالية', group: 'screens', icon: '📋', sensitive: false, requiresApproval: false },
  { permissionCode: 'CLAIMS.VIEW', aliases: ['claims', 'claims:view'], module: 'CLAIMS', resource: 'claims', action: 'VIEW', scope: 'ALL', name: 'المطالبات والدفعات المالية للمقاولين', group: 'screens', icon: '📝', sensitive: false, requiresApproval: false },
  { permissionCode: 'PURCHASES.VIEW', aliases: ['purchases', 'purchases:view'], module: 'PURCHASES', resource: 'purchases', action: 'VIEW', scope: 'ALL', name: 'أوامر الشراء والتوريدات الهندسية', group: 'screens', icon: '🛒', sensitive: false, requiresApproval: false },
  { permissionCode: 'CONTRACTS.VIEW', aliases: ['contracts', 'contracts:view'], module: 'CONTRACTS', resource: 'contracts', action: 'VIEW', scope: 'ALL', name: 'العقود والضمانات البنكية', group: 'screens', icon: '📜', sensitive: false, requiresApproval: false },
  { permissionCode: 'REPORTS.VIEW', aliases: ['reports', 'reports:view', 'print-templates'], module: 'REPORTS', resource: 'reports', action: 'VIEW', scope: 'ALL', name: 'التقارير ونماذج الطباعة والمحرر الذكي', group: 'screens', icon: '🖨️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ARCHIVE.VIEW', aliases: ['archive', 'archive:view'], module: 'ARCHIVE', resource: 'archive', action: 'VIEW', scope: 'ALL', name: 'الأرشيف الإلكتروني والوثائق', group: 'screens', icon: '🗄️', sensitive: false, requiresApproval: false },
  { permissionCode: 'BUDGET.VIEW', aliases: ['budget', 'budget:view'], module: 'BUDGET', resource: 'budget', action: 'VIEW', scope: 'ALL', name: 'الموازنة العامة للمديرية', group: 'screens', icon: '💵', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECTS.VIEW', aliases: ['projects', 'projects:view'], module: 'PROJECTS', resource: 'projects', action: 'VIEW', scope: 'ALL', name: 'إدارة المشاريع الهندسية والمحافظ الرأسمالية', group: 'screens', icon: '🏗️', sensitive: false, requiresApproval: false },
  { permissionCode: 'SETTINGS.VIEW', aliases: ['settings', 'settings:view'], module: 'SETTINGS', resource: 'settings', action: 'VIEW', scope: 'ALL', name: 'الإعدادات العامة وإدارة النظام', group: 'screens', icon: '⚙️', sensitive: true, requiresApproval: false },
  { permissionCode: 'AUDIT.VIEW', aliases: ['activity', 'activity:view', 'audit:view'], module: 'AUDIT', resource: 'activity_log', action: 'VIEW', scope: 'ALL', name: 'سجل العمليات والرقابة والأمان', group: 'screens', icon: '🕵️', sensitive: true, requiresApproval: false },

  // ─── 1.1 عمليات الموازنة العامة للمديرية (Budget Actions) ───
  { permissionCode: 'BUDGET.CREATE', aliases: ['budget:create', 'budget.create'], module: 'BUDGET', resource: 'budget', action: 'CREATE', scope: 'ALL', name: 'إضافة بند موازنة جديد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'BUDGET.EDIT', aliases: ['budget:edit', 'budget.edit'], module: 'BUDGET', resource: 'budget', action: 'EDIT', scope: 'ALL', name: 'تعديل بنود وفصول الموازنة', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'BUDGET.DELETE', aliases: ['budget:delete', 'budget.delete'], module: 'BUDGET', resource: 'budget', action: 'DELETE', scope: 'ALL', name: 'حذف بند موازنة', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'BUDGET.ALLOCATE', aliases: ['budget:allocate', 'budget.allocate'], module: 'BUDGET', resource: 'budget', action: 'ALLOCATE', scope: 'ALL', name: 'تخصيص وحجز مخصصات مالية للمشاريع', group: 'actions', icon: '🔒', sensitive: true, requiresApproval: false },
  { permissionCode: 'BUDGET.EXPORT', aliases: ['budget:export', 'budget.export'], module: 'BUDGET', resource: 'budget', action: 'EXPORT', scope: 'ALL', name: 'تصدير وطباعة كشف الموازنة', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false },

  // ─── 2. عمليات المشاريع الهندسية (Projects Actions) ───
  { permissionCode: 'PROJECTS.CREATE', aliases: ['projects:create', 'projects.create'], module: 'PROJECTS', resource: 'projects', action: 'CREATE', scope: 'ALL', name: 'إنشاء وتوثيق مشروع هندسي جديد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECTS.EDIT', aliases: ['projects:edit', 'projects.edit'], module: 'PROJECTS', resource: 'projects', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات وخطة المشروع', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECTS.DELETE', aliases: ['projects:delete', 'projects.delete'], module: 'PROJECTS', resource: 'projects', action: 'DELETE', scope: 'ALL', name: 'حذف أو إلغاء قيد المشروع', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.SUBMIT', aliases: ['projects:submit', 'projects.submit'], module: 'PROJECTS', resource: 'projects', action: 'SUBMIT', scope: 'ALL', name: 'تقديم المشروع للاعتماد والمراجعة', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECTS.REVIEW', aliases: ['projects:review', 'projects.review'], module: 'PROJECTS', resource: 'projects', action: 'REVIEW', scope: 'ALL', name: 'التدقيق الفني والهندسي للمشروع', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECTS.APPROVE', aliases: ['projects:approve', 'projects.approve'], module: 'PROJECTS', resource: 'projects', action: 'APPROVE', scope: 'ALL', name: 'المصادقة الإدارية واعتماد طرح المشروع', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.SUSPEND', aliases: ['projects:suspend', 'projects.suspend'], module: 'PROJECTS', resource: 'projects', action: 'SUSPEND', scope: 'ALL', name: 'إيقاف المشروع مؤقتاً لأسباب فنية', group: 'actions', icon: '⏸️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.RESUME', aliases: ['projects:resume', 'projects.resume'], module: 'PROJECTS', resource: 'projects', action: 'RESUME', scope: 'ALL', name: 'استئناف العمل في المشروع', group: 'actions', icon: '▶️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.COMPLETE', aliases: ['projects:complete', 'projects.complete'], module: 'PROJECTS', resource: 'projects', action: 'COMPLETE', scope: 'ALL', name: 'إنجاز المشروع والاستلام الأولي', group: 'actions', icon: '🏆', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.CLOSE', aliases: ['projects:close', 'projects.close'], module: 'PROJECTS', resource: 'projects', action: 'CLOSE', scope: 'ALL', name: 'الإغلاق النهائي للمشروع والمحاسبة الختامية', group: 'actions', icon: '🔒', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECTS.PRINT', aliases: ['projects:print', 'projects.print'], module: 'PROJECTS', resource: 'projects', action: 'PRINT', scope: 'ALL', name: 'طباعة بطاقة وتقارير المشروع', group: 'actions', icon: '🖨️', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECTS.EXPORT', aliases: ['projects:export', 'projects.export'], module: 'PROJECTS', resource: 'projects', action: 'EXPORT', scope: 'ALL', name: 'تصدير بيانات محفظة المشاريع', group: 'actions', icon: '📊', sensitive: false, requiresApproval: false },

  // ─── 2.1 عمليات المحافظ والخطط الهندسية (Portfolios & Plans) ───
  { permissionCode: 'PORTFOLIO.VIEW', aliases: ['portfolio:view', 'portfolios:view', 'portfolios.view'], module: 'PROJECTS', resource: 'project_portfolios', action: 'VIEW', scope: 'ALL', name: 'استعراض المحافظ الاستثمارية الرأسمالية', group: 'actions', icon: '📁', sensitive: false, requiresApproval: false },
  { permissionCode: 'PORTFOLIO.CREATE', aliases: ['portfolio:create', 'portfolios:create', 'portfolios.create'], module: 'PROJECTS', resource: 'project_portfolios', action: 'CREATE', scope: 'ALL', name: 'إنشاء محفظة رأسمالية جديدة', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PORTFOLIO.EDIT', aliases: ['portfolio:edit', 'portfolios:edit', 'portfolios.edit'], module: 'PROJECTS', resource: 'project_portfolios', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات المحفظة الرأسمالية', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PORTFOLIO.DELETE', aliases: ['portfolio:delete', 'portfolios:delete', 'portfolios.delete'], module: 'PROJECTS', resource: 'project_portfolios', action: 'DELETE', scope: 'ALL', name: 'حذف المحفظة الرأسمالية', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PORTFOLIO.MANAGE', aliases: ['portfolio:manage', 'portfolios:manage', 'portfolios.manage'], module: 'PROJECTS', resource: 'project_portfolios', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتخصيص مشاريع المحفظة', group: 'actions', icon: '⚙️', sensitive: true, requiresApproval: false },

  { permissionCode: 'PLAN.VIEW', aliases: ['plan:view', 'plans:view', 'plans.view'], module: 'PROJECTS', resource: 'project_plans', action: 'VIEW', scope: 'ALL', name: 'استعراض الخطط السنوية والاستراتيجية', group: 'actions', icon: '📅', sensitive: false, requiresApproval: false },
  { permissionCode: 'PLAN.CREATE', aliases: ['plan:create', 'plans:create', 'plans.create'], module: 'PROJECTS', resource: 'project_plans', action: 'CREATE', scope: 'ALL', name: 'إعداد خطة هندسية / سنوية جديدة', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PLAN.EDIT', aliases: ['plan:edit', 'plans:edit', 'plans.edit'], module: 'PROJECTS', resource: 'project_plans', action: 'EDIT', scope: 'ALL', name: 'تعديل الخطة الهندسية', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PLAN.DELETE', aliases: ['plan:delete', 'plans:delete', 'plans.delete'], module: 'PROJECTS', resource: 'project_plans', action: 'DELETE', scope: 'ALL', name: 'حذف الخطة الهندسية', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PLAN.MANAGE', aliases: ['plan:manage', 'plans:manage', 'plans.manage'], module: 'PROJECTS', resource: 'project_plans', action: 'MANAGE', scope: 'ALL', name: 'إدارة وبرمجة مشاريع الخطة', group: 'actions', icon: '⚙️', sensitive: true, requiresApproval: false },

  // ─── 2.2 مصفوفة أولويات وترجيح المشاريع (Project Prioritization & Scoring) ───
  { permissionCode: 'PROJECT_PRIORITY.VIEW', aliases: ['project_priority:view', 'project-priority:view', 'priority:view'], module: 'PROJECTS', resource: 'project_priority', action: 'VIEW', scope: 'ALL', name: 'استعراض معايير وترتيب أولويات المشاريع', group: 'actions', icon: '⚖️', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECT_PRIORITY.CREATE', aliases: ['project_priority:create', 'project-priority:create', 'priority:create'], module: 'PROJECTS', resource: 'project_priority', action: 'CREATE', scope: 'ALL', name: 'إضافة معيار تقييم أو ترجيح جديد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_PRIORITY.EDIT', aliases: ['project_priority:edit', 'project-priority:edit', 'priority:edit'], module: 'PROJECTS', resource: 'project_priority', action: 'EDIT', scope: 'ALL', name: 'تعديل معايير وترجيحات الأولوية', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_PRIORITY.MANAGE', aliases: ['project_priority:manage', 'project-priority:manage', 'priority:manage'], module: 'PROJECTS', resource: 'project_priority', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتقييم واحتساب درجات الأولوية للمشاريع', group: 'actions', icon: '🎯', sensitive: true, requiresApproval: false },

  // ─── 2.3 البرمجة والتخصيص المالي السنوي ومتعدد السنوات (Financial Programming) ───
  { permissionCode: 'FINANCIAL_PROGRAM.VIEW', aliases: ['financial_program:view', 'financial-program:view', 'fin_prog:view'], module: 'PROJECTS', resource: 'project_financial_programs', action: 'VIEW', scope: 'ALL', name: 'استعراض مخصصات البرمجة المالية للمشاريع', group: 'actions', icon: '💵', sensitive: false, requiresApproval: false },
  { permissionCode: 'FINANCIAL_PROGRAM.CREATE', aliases: ['financial_program:create', 'financial-program:create', 'fin_prog:create'], module: 'PROJECTS', resource: 'project_financial_programs', action: 'CREATE', scope: 'ALL', name: 'إعداد وبرمجة مخصصات مالية سنوية للمشروع', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'FINANCIAL_PROGRAM.EDIT', aliases: ['financial_program:edit', 'financial-program:edit', 'fin_prog:edit'], module: 'PROJECTS', resource: 'project_financial_programs', action: 'EDIT', scope: 'ALL', name: 'تعديل المخصصات المالية السنوية للمشروع', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'FINANCIAL_PROGRAM.DELETE', aliases: ['financial_program:delete', 'financial-program:delete', 'fin_prog:delete'], module: 'PROJECTS', resource: 'project_financial_programs', action: 'DELETE', scope: 'ALL', name: 'حذف مخصص مالي مبرمج', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'FINANCIAL_PROGRAM.MANAGE', aliases: ['financial_program:manage', 'financial-program:manage', 'fin_prog:manage'], module: 'PROJECTS', resource: 'project_financial_programs', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتوزيع الموازنات الرأسمالية والبرمجة متعددة السنوات', group: 'actions', icon: '📊', sensitive: true, requiresApproval: false },

  // ─── 2.4 شبكة واعتماديات تتابع المشاريع (Project Dependencies & Precedence) ───
  { permissionCode: 'PROJECT_DEPENDENCY.VIEW', aliases: ['project_dependency:view', 'project-dependency:view', 'dependency:view'], module: 'PROJECTS', resource: 'project_dependencies', action: 'VIEW', scope: 'ALL', name: 'استعراض شبكة وعلاقات تتابع المشاريع', group: 'actions', icon: '🔗', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECT_DEPENDENCY.CREATE', aliases: ['project_dependency:create', 'project-dependency:create', 'dependency:create'], module: 'PROJECTS', resource: 'project_dependencies', action: 'CREATE', scope: 'ALL', name: 'إنشاء علاقة أسبقية واعتمادية بين المشاريع', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_DEPENDENCY.EDIT', aliases: ['project_dependency:edit', 'project-dependency:edit', 'dependency:edit'], module: 'PROJECTS', resource: 'project_dependencies', action: 'EDIT', scope: 'ALL', name: 'تعديل نوع علاقة الأسبقية أو فترة التأخير', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_DEPENDENCY.DELETE', aliases: ['project_dependency:delete', 'project-dependency:delete', 'dependency:delete'], module: 'PROJECTS', resource: 'project_dependencies', action: 'DELETE', scope: 'ALL', name: 'حذف علاقة اعتمادية بين مشروعين', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECT_DEPENDENCY.MANAGE', aliases: ['project_dependency:manage', 'project-dependency:manage', 'dependency:manage'], module: 'PROJECTS', resource: 'project_dependencies', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتحليل شبكة التتابع وفحص جاهزية المشاريع', group: 'actions', icon: '🕸️', sensitive: true, requiresApproval: false },

  // ─── 2.5 الجدولة الزمنية وحسابات المسار الحرج (Project Scheduling & CPM) ───
  { permissionCode: 'PROJECT_SCHEDULE.VIEW', aliases: ['project_schedule:view', 'project-schedule:view', 'schedule:view'], module: 'PROJECTS', resource: 'project_schedules', action: 'VIEW', scope: 'ALL', name: 'استعراض الجداول الزمنية والمسار الحرج للمشاريع', group: 'actions', icon: '⏱️', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECT_SCHEDULE.CREATE', aliases: ['project_schedule:create', 'project-schedule:create', 'schedule:create'], module: 'PROJECTS', resource: 'project_schedules', action: 'CREATE', scope: 'ALL', name: 'إنشاء وضبط جدول زمني للمشروع', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_SCHEDULE.EDIT', aliases: ['project_schedule:edit', 'project-schedule:edit', 'schedule:edit'], module: 'PROJECTS', resource: 'project_schedules', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات وإصدارات الجدول الزمني', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PROJECT_SCHEDULE.DELETE', aliases: ['project_schedule:delete', 'project-schedule:delete', 'schedule:delete'], module: 'PROJECTS', resource: 'project_schedules', action: 'DELETE', scope: 'ALL', name: 'حذف جدول زمني محسوب', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'PROJECT_SCHEDULE.CALCULATE', aliases: ['project_schedule:calculate', 'project-schedule:calculate', 'schedule:calculate'], module: 'PROJECTS', resource: 'project_schedules', action: 'CALCULATE', scope: 'ALL', name: 'احتساب المسار الحرج والتواريخ المبكرة والمتأخرة والطفو', group: 'actions', icon: '🧮', sensitive: false, requiresApproval: false },
  { permissionCode: 'PROJECT_SCHEDULE.MANAGE', aliases: ['project_schedule:manage', 'project-schedule:manage', 'schedule:manage'], module: 'PROJECTS', resource: 'project_schedules', action: 'MANAGE', scope: 'ALL', name: 'إدارة واعتماد الخط المرجعي للجدول الزمني (Baseline)', group: 'actions', icon: '📐', sensitive: true, requiresApproval: false },

  // ─── 3. عمليات العطاءات والمشاريع (Tenders Actions) ───
  { permissionCode: 'TENDERS.CREATE', aliases: ['tenders:create', 'tenders.create'], module: 'TENDERS', resource: 'tenders', action: 'CREATE', scope: 'ALL', name: 'إضافة عطاء جديد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'TENDERS.EDIT', aliases: ['tenders:edit', 'tenders.edit'], module: 'TENDERS', resource: 'tenders', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات العطاء', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'TENDERS.DELETE', aliases: ['tenders:delete', 'tenders.delete'], module: 'TENDERS', resource: 'tenders', action: 'DELETE', scope: 'ALL', name: 'حذف العطاء', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'TENDERS.APPROVE', aliases: ['tenders:approve', 'tenders.approve'], module: 'TENDERS', resource: 'tenders', action: 'APPROVE', scope: 'ALL', name: 'المصادقة الفنية على العطاء', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'TENDERS.PRINT', aliases: ['tenders:print', 'tenders.print'], module: 'TENDERS', resource: 'tenders', action: 'PRINT', scope: 'ALL', name: 'طباعة تفاصيل ووثائق العطاء', group: 'actions', icon: '🖨️', sensitive: false, requiresApproval: false },
  { permissionCode: 'TENDERS.EXPORT', aliases: ['tenders:export', 'tenders.export'], module: 'TENDERS', resource: 'tenders', action: 'EXPORT', scope: 'ALL', name: 'تصدير بيانات العطاءات', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false },

  // ─── 3. عمليات المطالبات المالية (Claims Actions) ───
  { permissionCode: 'CLAIMS.CREATE', aliases: ['claims:create', 'claims.create'], module: 'CLAIMS', resource: 'claims', action: 'CREATE', scope: 'ALL', name: 'إصدار مطالبة مالية جديدة للمقاول', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'CLAIMS.EDIT', aliases: ['claims:edit', 'claims.edit'], module: 'CLAIMS', resource: 'claims', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات المطالبة', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'CLAIMS.AUDIT', aliases: ['claims:audit', 'claims.audit'], module: 'CLAIMS', resource: 'claims', action: 'AUDIT', scope: 'ALL', name: 'تدقيق المطالبة وإبداء الرأي الهندسي/المالي', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'CLAIMS.APPROVE', aliases: ['claims:approve', 'claims.approve'], module: 'CLAIMS', resource: 'claims', action: 'APPROVE', scope: 'ALL', name: 'اعتماد وصرف المطالبة المالية', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'CLAIMS.DELETE', aliases: ['claims:delete', 'claims.delete'], module: 'CLAIMS', resource: 'claims', action: 'DELETE', scope: 'ALL', name: 'حذف المطالبة المالية', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'CLAIMS.PRINT', aliases: ['claims:print', 'claims.print'], module: 'CLAIMS', resource: 'claims', action: 'PRINT', scope: 'ALL', name: 'طباعة شهادة الدفعة الرسمية المعتمدة', group: 'actions', icon: '🖨️', sensitive: false, requiresApproval: false },
  { permissionCode: 'CLAIMS.EXPORT', aliases: ['claims:export', 'claims.export'], module: 'CLAIMS', resource: 'claims', action: 'EXPORT', scope: 'ALL', name: 'تصدير سجل المطالبات المالية', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false },

  // ─── 4. عمليات العقود والضمانات البنكية (Contracts Actions) ───
  { permissionCode: 'CONTRACTS.CREATE', aliases: ['contracts:create', 'contracts.create'], module: 'CONTRACTS', resource: 'contracts', action: 'CREATE', scope: 'ALL', name: 'إنشاء وتوثيق عقد إنشائي', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'CONTRACTS.EDIT', aliases: ['contracts:edit', 'contracts.edit'], module: 'CONTRACTS', resource: 'contracts', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات العقد', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'CONTRACTS.DELETE', aliases: ['contracts:delete', 'contracts.delete'], module: 'CONTRACTS', resource: 'contracts', action: 'DELETE', scope: 'ALL', name: 'حذف العقد', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'CONTRACTS.APPROVE', aliases: ['contracts:approve', 'contracts.approve'], module: 'CONTRACTS', resource: 'contracts', action: 'APPROVE', scope: 'ALL', name: 'المصادقة القانونية وتوقيع العقد', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'GUARANTEES.MANAGE', aliases: ['guarantees.manage', 'guarantees:manage', 'contracts:guarantees'], module: 'CONTRACTS', resource: 'bank_guarantees', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتمديد الكفالات والضمانات البنكية', group: 'actions', icon: '🔄', sensitive: true, requiresApproval: false },

  // ─── 5. عمليات أوامر الشراء والتوريد (Purchases Actions) ───
  { permissionCode: 'PURCHASES.CREATE', aliases: ['purchases:create', 'purchases.create'], module: 'PURCHASES', resource: 'purchases', action: 'CREATE', scope: 'ALL', name: 'إضافة أمر شراء وتوريد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PURCHASES.EDIT', aliases: ['purchases:edit', 'purchases.edit'], module: 'PURCHASES', resource: 'purchases', action: 'EDIT', scope: 'ALL', name: 'تعديل أمر الشراء', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PURCHASES.DELETE', aliases: ['purchases:delete', 'purchases.delete'], module: 'PURCHASES', resource: 'purchases', action: 'DELETE', scope: 'ALL', name: 'حذف أمر الشراء', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },

  // ─── 6. عمليات شبكة الطرق والرصفات (Roads Actions) ───
  { permissionCode: 'ROADS.CREATE', aliases: ['roads:create', 'roads.create'], module: 'ROADS', resource: 'roads', action: 'CREATE', scope: 'ALL', name: 'إضافة طريق جديد لشبكة البلدية', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'ROADS.EDIT', aliases: ['roads:edit', 'roads.edit'], module: 'ROADS', resource: 'roads', action: 'EDIT', scope: 'ALL', name: 'تعديل مسار وتصنيف وبيانات الطريق', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'ROADS.DELETE', aliases: ['roads:delete', 'roads.delete'], module: 'ROADS', resource: 'roads', action: 'DELETE', scope: 'ALL', name: 'حذف طريق من الشبكة', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },

  // ─── 8. عمليات الأصول والمنشآت (Assets Actions) ───
  { permissionCode: 'ASSETS.CREATE', aliases: ['assets:create', 'assets.create'], module: 'ASSETS', resource: 'assets', action: 'CREATE', scope: 'ALL', name: 'إضافة أصل / جدار / شبكة خدمات', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'ASSETS.EDIT', aliases: ['assets:edit', 'assets.edit'], module: 'ASSETS', resource: 'assets', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات الأصل وقيم الإهلاك', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'ASSETS.DELETE', aliases: ['assets:delete', 'assets.delete'], module: 'ASSETS', resource: 'assets', action: 'DELETE', scope: 'ALL', name: 'حذف الأصل أو المنشأة', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },

  // ─── 9. عمليات تصاريح الحفر (Permits Actions) ───
  { permissionCode: 'PERMITS.CREATE', aliases: ['permits:create', 'permits.create'], module: 'PERMITS', resource: 'excavation_permits', action: 'CREATE', scope: 'ALL', name: 'إصدار تصريح حفر وتزويد خدمات', group: 'actions', icon: '➕', sensitive: false, requiresApproval: false },
  { permissionCode: 'PERMITS.EDIT', aliases: ['permits:edit', 'permits.edit'], module: 'PERMITS', resource: 'excavation_permits', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات التصريح وموقع الحفر', group: 'actions', icon: '✏️', sensitive: false, requiresApproval: false },
  { permissionCode: 'PERMITS.APPROVE', aliases: ['permits:approve', 'permits.approve'], module: 'PERMITS', resource: 'excavation_permits', action: 'APPROVE', scope: 'ALL', name: 'اعتماد وإغلاق التصريح ورد التأمين', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'PERMITS.DELETE', aliases: ['permits:delete', 'permits.delete'], module: 'PERMITS', resource: 'excavation_permits', action: 'DELETE', scope: 'ALL', name: 'إلغاء وحذف التصريح', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },

  // ─── 10. عمليات عوائد التعبيد والتحققات (Paving Actions) ───
  { permissionCode: 'PAVING.CREATE', aliases: ['paving:create', 'paving.create'], module: 'PAVING', resource: 'paving_returns', action: 'CREATE', scope: 'ALL', name: 'إضافة واحتساب قيد عوائد تعبيد', group: 'actions', icon: '➕', sensitive: true, requiresApproval: false },
  { permissionCode: 'PAVING.EDIT', aliases: ['paving:edit', 'paving.edit'], module: 'PAVING', resource: 'paving_returns', action: 'EDIT', scope: 'ALL', name: 'تعديل قيود عوائد التعبيد والمساحات', group: 'actions', icon: '✏️', sensitive: true, requiresApproval: false },
  { permissionCode: 'PAVING.APPROVE', aliases: ['paving:approve', 'paving.approve'], module: 'PAVING', resource: 'paving_returns', action: 'APPROVE', scope: 'ALL', name: 'الاعتماد المالي وإبراء الذمة', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'PAVING.DELETE', aliases: ['paving:delete', 'paving.delete'], module: 'PAVING', resource: 'paving_returns', action: 'DELETE', scope: 'ALL', name: 'حذف قيد عوائد تعبيد', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },

  // ─── 12. عمليات جداول وحساب الكميات (Quantities Actions) ───
  { permissionCode: 'QUANTITIES.VIEW', aliases: ['quantities:view', 'quantities.view'], module: 'PROJECTS', resource: 'quantities', action: 'VIEW', scope: 'ALL', name: 'عرض كشوفات وجداول الكميات', group: 'actions', icon: '📐', sensitive: false, requiresApproval: false },
  { permissionCode: 'QUANTITIES.CREATE', aliases: ['quantities:create', 'quantities.create'], module: 'PROJECTS', resource: 'quantities', action: 'CREATE', scope: 'ALL', name: 'إدخال وحصر الكميات الميدانية', group: 'actions', icon: '➕', sensitive: false, requiresApproval: false },
  { permissionCode: 'QUANTITIES.EDIT', aliases: ['quantities:edit', 'quantities.edit'], module: 'PROJECTS', resource: 'quantities', action: 'EDIT', scope: 'ALL', name: 'تعديل قياسات الكميات قبل الاعتماد', group: 'actions', icon: '✏️', sensitive: false, requiresApproval: false },
  { permissionCode: 'QUANTITIES.REVIEW', aliases: ['quantities:review', 'quantities.review'], module: 'PROJECTS', resource: 'quantities', action: 'REVIEW', scope: 'ALL', name: 'مراجعة وتدقيق كشوفات الكميات', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'QUANTITIES.APPROVE', aliases: ['quantities:approve', 'quantities.approve'], module: 'PROJECTS', resource: 'quantities', action: 'APPROVE', scope: 'ALL', name: 'اعتماد الكميات رسمياً', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },

  // ─── 13. عمليات الفحوصات المخبرية وضبط الجودة وتقارير عدم المطابقة (Quality & NCR) ───
  { permissionCode: 'QUALITY.VIEW', aliases: ['quality:view', 'quality.view'], module: 'PROJECTS', resource: 'quality', action: 'VIEW', scope: 'ALL', name: 'عرض سجلات الجودة والفحوصات', group: 'actions', icon: '🧪', sensitive: false, requiresApproval: false },
  { permissionCode: 'QUALITY.TEST_REQUEST', aliases: ['quality.test.request', 'quality:test_request', 'quality:request'], module: 'PROJECTS', resource: 'quality', action: 'CREATE', scope: 'ALL', name: 'إصدار طلب فحص مخبري / عينات', group: 'actions', icon: '📋', sensitive: false, requiresApproval: false },
  { permissionCode: 'QUALITY.TEST_RECORD', aliases: ['quality.test.record', 'quality:test_record', 'quality:record'], module: 'PROJECTS', resource: 'quality', action: 'CREATE', scope: 'ALL', name: 'تسجيل نتائج الفحوصات والاختبارات', group: 'actions', icon: '📝', sensitive: true, requiresApproval: false },
  { permissionCode: 'QUALITY.TEST_REVIEW', aliases: ['quality.test.review', 'quality:test_review'], module: 'PROJECTS', resource: 'quality', action: 'REVIEW', scope: 'ALL', name: 'مراجعة وتدقيق نتائج الفحوصات', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'QUALITY.TEST_APPROVE', aliases: ['quality.test.approve', 'quality:test_approve'], module: 'PROJECTS', resource: 'quality', action: 'APPROVE', scope: 'ALL', name: 'اعتماد نتائج الفحوصات الفنية', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'QUALITY.NCR_CREATE', aliases: ['quality.ncr.create', 'quality:ncr_create', 'ncr:create'], module: 'PROJECTS', resource: 'quality', action: 'CREATE', scope: 'ALL', name: 'إنشاء تقرير حالة عدم مطابقة (NCR)', group: 'actions', icon: '⚠️', sensitive: true, requiresApproval: false },
  { permissionCode: 'QUALITY.NCR_CLOSE', aliases: ['quality.ncr.close', 'quality:ncr_close', 'ncr:close'], module: 'PROJECTS', resource: 'quality', action: 'APPROVE', scope: 'ALL', name: 'التحقق من التصحيح وإغلاق الـ NCR', group: 'actions', icon: '🔒', sensitive: true, requiresApproval: true },

  // ─── 14. عمليات التقارير اليومية والملاحظات الميدانية (Daily Reports & Observations) ───
  { permissionCode: 'DAILY_REPORTS.VIEW', aliases: ['daily_reports.view', 'daily-reports:view'], module: 'PROJECTS', resource: 'daily_reports', action: 'VIEW', scope: 'ALL', name: 'عرض سجلات وتقارير العمل اليومية', group: 'actions', icon: '📅', sensitive: false, requiresApproval: false },
  { permissionCode: 'DAILY_REPORTS.CREATE', aliases: ['daily_reports.create', 'daily-reports:create'], module: 'PROJECTS', resource: 'daily_reports', action: 'CREATE', scope: 'ALL', name: 'إعداد وتسجيل تقرير العمل الميداني اليومي', group: 'actions', icon: '➕', sensitive: false, requiresApproval: false },
  { permissionCode: 'DAILY_REPORTS.EDIT', aliases: ['daily_reports.edit', 'daily-reports:edit'], module: 'PROJECTS', resource: 'daily_reports', action: 'EDIT', scope: 'ALL', name: 'تعديل تقرير العمل اليومي', group: 'actions', icon: '✏️', sensitive: false, requiresApproval: false },
  { permissionCode: 'DAILY_REPORTS.FORWARD', aliases: ['daily_reports.forward', 'daily-reports:forward'], module: 'PROJECTS', resource: 'daily_reports', action: 'SUBMIT', scope: 'ALL', name: 'إحالة وتقديم التقرير للمراجعة', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false },
  { permissionCode: 'DAILY_REPORTS.REVIEW', aliases: ['daily_reports.review', 'daily-reports:review'], module: 'PROJECTS', resource: 'daily_reports', action: 'REVIEW', scope: 'ALL', name: 'مراجعة وتدقيق التقرير اليومي', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'DAILY_REPORTS.APPROVE', aliases: ['daily_reports.approve', 'daily-reports:approve'], module: 'PROJECTS', resource: 'daily_reports', action: 'APPROVE', scope: 'ALL', name: 'اعتماد تقرير العمل اليومي', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'OBSERVATIONS.CREATE', aliases: ['observations:create', 'observations.create'], module: 'PROJECTS', resource: 'observations', action: 'CREATE', scope: 'ALL', name: 'تسجيل ملاحظة ميدانية وتوثيق بالصور', group: 'actions', icon: '📷', sensitive: false, requiresApproval: false },
  { permissionCode: 'OBSERVATIONS.RESOLVE', aliases: ['observations:resolve', 'observations.resolve'], module: 'PROJECTS', resource: 'observations', action: 'EDIT', scope: 'ALL', name: 'معالجة وتصحيح الملاحظة الميدانية', group: 'actions', icon: '🔧', sensitive: false, requiresApproval: false },

  // ─── 15. عمليات الرفع المساحي والقياسات الميدانية (Surveys & Spatial) ───
  { permissionCode: 'SURVEYS.VIEW', aliases: ['surveys:view', 'surveys.view'], module: 'PROJECTS', resource: 'surveys', action: 'VIEW', scope: 'ALL', name: 'عرض المخططات وسجلات الرفع المساحي', group: 'actions', icon: '🗺️', sensitive: false, requiresApproval: false },
  { permissionCode: 'SURVEYS.CREATE', aliases: ['surveys:create', 'surveys.create'], module: 'PROJECTS', resource: 'surveys', action: 'CREATE', scope: 'ALL', name: 'تسجيل الرفع المساحي والمناسيب والمحاور', group: 'actions', icon: '📍', sensitive: false, requiresApproval: false },
  { permissionCode: 'SURVEYS.EDIT', aliases: ['surveys:edit', 'surveys.edit'], module: 'PROJECTS', resource: 'surveys', action: 'EDIT', scope: 'ALL', name: 'تعديل البيانات المساحية قبل الاعتماد', group: 'actions', icon: '✏️', sensitive: false, requiresApproval: false },
  { permissionCode: 'SURVEYS.REVIEW', aliases: ['surveys:review', 'surveys.review'], module: 'PROJECTS', resource: 'surveys', action: 'REVIEW', scope: 'ALL', name: 'مراجعة وتدقيق المخططات المساحية', group: 'actions', icon: '🔍', sensitive: true, requiresApproval: false },
  { permissionCode: 'SURVEYS.MEASURE', aliases: ['surveys:measure', 'surveys.measure'], module: 'PROJECTS', resource: 'surveys', action: 'MEASURE', scope: 'ALL', name: 'إجراء القياسات الميدانية وحساب المساحات', group: 'actions', icon: '📐', sensitive: false, requiresApproval: false },

  // ─── 16. عمليات لجان الاستلام المرحلي والنهائي (Interim & Final Handover) ───
  { permissionCode: 'INSPECTION.INTERIM', aliases: ['inspection:interim', 'inspection.interim'], module: 'PROJECTS', resource: 'inspections', action: 'APPROVE', scope: 'ALL', name: 'إجراء الاستلام المرحلي للأعمال', group: 'actions', icon: '📑', sensitive: true, requiresApproval: true },
  { permissionCode: 'INSPECTION.FINAL', aliases: ['inspection:final', 'inspection.final'], module: 'PROJECTS', resource: 'inspections', action: 'APPROVE', scope: 'ALL', name: 'المشاركة في لجان الاستلام النهائي', group: 'actions', icon: '🏆', sensitive: true, requiresApproval: true },

  // ─── 17. إدارة النظام والأمان والمستخدمين (Administration Actions) ───
  { permissionCode: 'SETTINGS.MANAGE', aliases: ['settings:manage', 'settings.manage'], module: 'SETTINGS', resource: 'system_settings', action: 'MANAGE', scope: 'ALL', name: 'إدارة وتعديل إعدادات وهوية ومعايير النظام', group: 'actions', icon: '⚙️', sensitive: true, requiresApproval: true },
  { permissionCode: 'USERS.MANAGE', aliases: ['users:manage', 'users.manage'], module: 'USERS', resource: 'users', action: 'MANAGE', scope: 'ALL', name: 'إدارة حسابات المستخدمين وكلمات المرور', group: 'actions', icon: '👥', sensitive: true, requiresApproval: true },
  { permissionCode: 'ROLES.MANAGE', aliases: ['roles:manage', 'roles.manage'], module: 'ROLES', resource: 'roles', action: 'MANAGE', scope: 'ALL', name: 'تصميم وإدارة الأدوار ومصفوفة الصلاحيات (Zero-Code)', group: 'actions', icon: '🛡️', sensitive: true, requiresApproval: true },
  { permissionCode: 'WORKFLOWS.MANAGE', aliases: ['workflows:manage', 'workflows.manage'], module: 'WORKFLOWS', resource: 'workflows', action: 'MANAGE', scope: 'ALL', name: 'تصميم مسارات العمل وسلاسل الاعتماد (Zero-Code)', group: 'actions', icon: '🔄', sensitive: true, requiresApproval: true },

  // ─── 18. عمليات الكهرباء والإنارة والطاقة المتجددة (Energy & Renewable Assets) ───
  { permissionCode: 'ENERGY.VIEW', aliases: ['energy', 'energy:view', 'energy-lighting', 'lighting'], module: 'ENERGY', resource: 'energy_assets', action: 'VIEW', scope: 'ALL', name: 'عرض سجل أصول الكهرباء والطاقة والإنارة', group: 'screens', icon: '⚡', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.CREATE', aliases: ['energy:create', 'energy.create', 'lighting:create'], module: 'ENERGY', resource: 'energy_assets', action: 'CREATE', scope: 'ALL', name: 'إضافة أصل كهربائي / محطة طاقة شمسية', group: 'actions', icon: '➕', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.EDIT', aliases: ['energy:edit', 'energy.edit', 'lighting:edit'], module: 'ENERGY', resource: 'energy_assets', action: 'EDIT', scope: 'ALL', name: 'تعديل بيانات الأصل وتحديث القدرة والمواصفات', group: 'actions', icon: '✏️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.DELETE', aliases: ['energy:delete', 'energy.delete'], module: 'ENERGY', resource: 'energy_assets', action: 'DELETE', scope: 'ALL', name: 'حذف أصل كهربائي / إنارة', group: 'actions', icon: '🗑️', sensitive: true, requiresApproval: true },
  { permissionCode: 'ENERGY.MAINTENANCE', aliases: ['energy:maintenance', 'energy.maintenance', 'lighting:maintenance'], module: 'ENERGY', resource: 'energy_maintenance', action: 'CREATE', scope: 'ALL', name: 'إنشاء أمر صيانة وقائية / تصحيحية / طارئة', group: 'actions', icon: '🔧', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.MAINT_EXECUTE', aliases: ['energy:maint_execute', 'energy.maint_execute'], module: 'ENERGY', resource: 'energy_maintenance', action: 'EDIT', scope: 'ALL', name: 'تنفيذ وتسجيل صيانة الإنارة والتمديدات والمواد', group: 'actions', icon: '🛠️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.SOLAR', aliases: ['energy:solar', 'energy.solar', 'solar:track'], module: 'ENERGY', resource: 'solar_energy', action: 'VIEW', scope: 'ALL', name: 'متابعة أداء وإنتاج وكفاءة محطات الطاقة الشمسية', group: 'actions', icon: '☀️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.EMERGENCY', aliases: ['energy:emergency', 'energy.emergency', 'hazard:report'], module: 'ENERGY', resource: 'electrical_hazards', action: 'CREATE', scope: 'ALL', name: 'رصد وتوثيق المخاطر الكهربائية والبلاغات الطارئة', group: 'actions', icon: '🚨', sensitive: true, requiresApproval: false },
  { permissionCode: 'ENERGY.APPROVE', aliases: ['energy:approve', 'energy.approve'], module: 'ENERGY', resource: 'energy_assets', action: 'APPROVE', scope: 'ALL', name: 'اعتماد الكشوفات وأوامر الصيانة وإغلاق البلاغات', group: 'actions', icon: '✅', sensitive: true, requiresApproval: true },
  { permissionCode: 'ENERGY.AUDIT', aliases: ['energy:audit', 'energy.audit'], module: 'ENERGY', resource: 'energy_audit', action: 'VIEW', scope: 'ALL', name: 'تدقيق استهلاك الكهرباء والتكاليف وفرص التوفير', group: 'actions', icon: '💡', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.GIS', aliases: ['energy:gis', 'energy.gis'], module: 'ENERGY', resource: 'energy_gis', action: 'VIEW', scope: 'ALL', name: 'الربط والتحليل الجغرافي لأعمدة وشبكات الإنارة', group: 'actions', icon: '🗺️', sensitive: false, requiresApproval: false },
  { permissionCode: 'ENERGY.EXPORT', aliases: ['energy:export', 'energy.export'], module: 'ENERGY', resource: 'energy_reports', action: 'EXPORT', scope: 'ALL', name: 'تصدير وطباعة تقارير الكهرباء والطاقة', group: 'actions', icon: '📤', sensitive: false, requiresApproval: false }
];

// بناء جدول المطابقة السريعة للأسماء البديلة
const ALIAS_MAP = new Map();
PERMISSION_INVENTORY.forEach(item => {
  ALIAS_MAP.set(item.permissionCode.toUpperCase(), item.permissionCode);
  if (Array.isArray(item.aliases)) {
    item.aliases.forEach(a => {
      ALIAS_MAP.set(a.toUpperCase(), item.permissionCode);
      ALIAS_MAP.set(a.toLowerCase(), item.permissionCode);
    });
  }
});

// مصفوفة الصلاحيات الافتراضية للأدوار الرسمية لمديرية الأشغال (Zero-Code Dynamic RBAC)
const ROLE_PERMISSIONS = {
  admin: ['*'],
  director_public_works: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'ASSETS.VIEW', 'ENERGY.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
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
    'ENERGY.CREATE', 'ENERGY.EDIT', 'ENERGY.APPROVE', 'ENERGY.SOLAR', 'ENERGY.MAINTENANCE', 'ENERGY.AUDIT', 'ENERGY.EXPORT',
    'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.APPROVE', 'TASKS.PRINT',
    'QUANTITIES.REVIEW', 'QUANTITIES.APPROVE',
    'QUALITY.TEST_REVIEW', 'QUALITY.NCR_CLOSE',
    'DAILY_REPORTS.REVIEW', 'DAILY_REPORTS.APPROVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
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
    'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.REVIEW', 'TASKS.APPROVE', 'TASKS.PRINT',
    'QUANTITIES.REVIEW', 'QUANTITIES.APPROVE',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE', 'QUALITY.NCR_CLOSE',
    'DAILY_REPORTS.REVIEW', 'DAILY_REPORTS.APPROVE',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  head_of_buildings: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW',
    'TASKS.VIEW', 'CONTRACTS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
    'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PROJECTS.REVIEW', 'PROJECTS.PRINT',
    'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT', 'TENDERS.EXPORT',
    'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.PRINT',
    'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT', 'ASSETS.EXPORT',
    'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.REVIEW', 'TASKS.APPROVE', 'TASKS.PRINT',
    'QUANTITIES.REVIEW', 'QUANTITIES.APPROVE',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE', 'QUALITY.NCR_CLOSE',
    'DAILY_REPORTS.REVIEW', 'DAILY_REPORTS.APPROVE',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
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
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'QUANTITIES.CREATE', 'QUANTITIES.EDIT',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  buildings_engineer: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW',
    'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
    'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.PRINT',
    'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT',
    'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.PRINT',
    'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'QUANTITIES.CREATE', 'QUANTITIES.EDIT',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  quantity_surveyor: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'TENDERS.VIEW', 'CLAIMS.VIEW', 'CONTRACTS.VIEW',
    'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW', 'ROADS.VIEW', 'PAVING.VIEW',
    'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.PRINT',
    'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.PRINT',
    'PAVING.CALCULATE', 'PAVING.PRINT',
    'CONTRACTS.VIEW', 'CONTRACTS.PRINT', 'REPORTS.EXPORT',
    'QUANTITIES.CREATE', 'QUANTITIES.EDIT', 'QUANTITIES.REVIEW',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  site_inspector: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'ASSETS.VIEW',
    'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW',
    'PERMITS.INSPECT', 'PERMITS.REINSTATE',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'ROADS.PCI', 'ASSETS.INSPECT',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  qa_qc_engineer: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'ASSETS.VIEW', 'TENDERS.VIEW',
    'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'PROJECTS.VIEW',
    'ROADS.PCI', 'ASSETS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'REPORTS.PRINT', 'REPORTS.EXPORT',
    'QUALITY.TEST_REQUEST', 'QUALITY.TEST_RECORD', 'QUALITY.TEST_REVIEW', 'QUALITY.TEST_APPROVE',
    'QUALITY.NCR_CREATE', 'QUALITY.NCR_CLOSE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  land_surveyor: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ROADS.VIEW', 'PERMITS.VIEW', 'PAVING.VIEW',
    'TASKS.VIEW', 'REPORTS.VIEW', 'ARCHIVE.VIEW', 'ASSETS.VIEW',
    'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.PCI',
    'PAVING.CREATE', 'PAVING.CALCULATE',
    'PERMITS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'SURVEYS.CREATE', 'SURVEYS.EDIT', 'SURVEYS.REVIEW', 'SURVEYS.MEASURE',
    'QUANTITIES.CREATE', 'OBSERVATIONS.CREATE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  head_of_electricity_energy: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'ENERGY.VIEW', 'TASKS.VIEW', 'REPORTS.VIEW',
    'ARCHIVE.VIEW', 'PROJECTS.VIEW', 'TENDERS.VIEW',
    'ENERGY.CREATE', 'ENERGY.EDIT', 'ENERGY.MAINTENANCE', 'ENERGY.MAINT_EXECUTE', 'ENERGY.SOLAR',
    'ENERGY.EMERGENCY', 'ENERGY.APPROVE', 'ENERGY.AUDIT', 'ENERGY.GIS', 'ENERGY.EXPORT',
    'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT', 'ASSETS.EXPORT',
    'TASKS.CREATE', 'TASKS.ASSIGN', 'TASKS.REVIEW', 'TASKS.APPROVE', 'TASKS.PRINT',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE', 'QUALITY.NCR_CLOSE',
    'DAILY_REPORTS.REVIEW', 'DAILY_REPORTS.APPROVE',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  electrical_engineer: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'ENERGY.VIEW', 'TASKS.VIEW', 'REPORTS.VIEW',
    'ARCHIVE.VIEW', 'PROJECTS.VIEW',
    'ENERGY.CREATE', 'ENERGY.EDIT', 'ENERGY.MAINTENANCE', 'ENERGY.MAINT_EXECUTE', 'ENERGY.EMERGENCY',
    'ENERGY.SOLAR', 'ENERGY.GIS', 'ENERGY.EXPORT',
    'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  renewable_energy_engineer: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'ENERGY.VIEW', 'TASKS.VIEW', 'REPORTS.VIEW',
    'ARCHIVE.VIEW', 'PROJECTS.VIEW',
    'ENERGY.CREATE', 'ENERGY.EDIT', 'ENERGY.SOLAR', 'ENERGY.AUDIT', 'ENERGY.MAINTENANCE',
    'ENERGY.GIS', 'ENERGY.EXPORT',
    'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.PRINT',
    'QUALITY.TEST_REQUEST', 'QUALITY.NCR_CREATE',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  electrical_works_inspector: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ASSETS.VIEW', 'ENERGY.VIEW', 'TASKS.VIEW', 'REPORTS.VIEW',
    'ARCHIVE.VIEW',
    'ENERGY.MAINTENANCE', 'ENERGY.EMERGENCY', 'ENERGY.GIS',
    'ASSETS.INSPECT',
    'TASKS.CREATE', 'TASKS.EXECUTE', 'TASKS.INSPECT', 'TASKS.PRINT',
    'DAILY_REPORTS.CREATE', 'DAILY_REPORTS.EDIT', 'DAILY_REPORTS.FORWARD',
    'OBSERVATIONS.CREATE', 'OBSERVATIONS.RESOLVE',
    'INSPECTION.INTERIM', 'INSPECTION.FINAL'
  ],
  electrical_technician: [
    'DASHBOARD.VIEW', 'MY_WORK.VIEW', 'ENERGY.VIEW', 'TASKS.VIEW', 'ARCHIVE.VIEW',
    'ENERGY.MAINT_EXECUTE', 'ENERGY.EMERGENCY',
    'TASKS.EXECUTE', 'TASKS.PRINT',
    'DAILY_REPORTS.CREATE', 'OBSERVATIONS.CREATE'
  ]
};

try {
  reloadDynamicPermissions();
} catch (e) {}


/**
 * توحيد صيغة رمز الصلاحية إلى الرمز القانوني المعتمد
 * @param {string} rawCode - e.g. "tenders:create", "tenders.create", "TENDERS.CREATE"
 * @returns {string} الرمز الموحد
 */
function normalizePermissionCode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  const trimmed = rawCode.trim();
  if (trimmed === '*') return '*';

  const mapped = ALIAS_MAP.get(trimmed) || ALIAS_MAP.get(trimmed.toUpperCase()) || ALIAS_MAP.get(trimmed.toLowerCase());
  if (mapped) return mapped;

  // تحويل النمط البديل مثل tenders:create إلى TENDERS.CREATE
  return trimmed.replace(/:/g, '.').toUpperCase();
}

/**
 * قراءة وتحديث مصفوفة الصلاحيات الديناميكية من قاعدة البيانات أو الذاكرة
 */
async function reloadDynamicPermissions(pool = null, memDb = null) {
  try {
    const { dbQuery, isPostgresActive, memDb: activeMemDb } = require('../utils/database');
    const isPg = isPostgresActive();
    const mem = memDb || activeMemDb;

    // Helper to register role keys
    const registerRoleMapping = (rolesList, rolePermsList) => {
      const roleKeyMap = {};
      rolesList.forEach(r => {
        const idKey = String(r.id || '').toLowerCase();
        const nameKey = String(r.name || '').toLowerCase();
        const labelKey = String(r.label || '').toLowerCase();
        
        [idKey, nameKey, labelKey, r.id, r.name, r.label].filter(Boolean).forEach(k => {
          if (!ROLE_PERMISSIONS[k]) ROLE_PERMISSIONS[k] = [];
        });

        const allKeys = Array.from(new Set([idKey, nameKey, labelKey, r.id, r.name, r.label].filter(Boolean)));
        roleKeyMap[r.id] = allKeys;
        if (r.name) roleKeyMap[r.name] = allKeys;
        if (idKey) roleKeyMap[idKey] = allKeys;
        if (nameKey) roleKeyMap[nameKey] = allKeys;
      });

      if (Array.isArray(rolePermsList) && rolePermsList.length > 0) {
        // Clear only the roles that have explicit database configurations, preserving defaults for others
        const configuredRoles = new Set();
        rolePermsList.forEach(rp => {
          const roleIdentifier = rp.role_id || rp.roleId || rp.role_name;
          const targetKeys = roleKeyMap[roleIdentifier] || [String(roleIdentifier).toLowerCase()];
          targetKeys.forEach(k => configuredRoles.add(k));
        });
        configuredRoles.forEach(k => {
          if (k !== 'admin') ROLE_PERMISSIONS[k] = [];
        });

        rolePermsList.forEach(rp => {
          const roleIdentifier = rp.role_id || rp.roleId || rp.role_name;
          const targetKeys = roleKeyMap[roleIdentifier] || roleKeyMap[String(roleIdentifier).toLowerCase()] || [String(roleIdentifier).toLowerCase(), String(roleIdentifier)];
          const permRaw = rp.permission_id || rp.permissionId || rp.permission_code;
          const normPerm = normalizePermissionCode(permRaw);

          targetKeys.forEach(k => {
            if (!ROLE_PERMISSIONS[k]) ROLE_PERMISSIONS[k] = [];
            if (normPerm && !ROLE_PERMISSIONS[k].includes(normPerm)) {
              ROLE_PERMISSIONS[k].push(normPerm);
            }
            if (permRaw && !ROLE_PERMISSIONS[k].includes(permRaw)) {
              ROLE_PERMISSIONS[k].push(permRaw);
            }
          });
        });
      }
    };

    if (isPg) {
      const rolesRes = await dbQuery('SELECT id, name, label FROM roles');
      const rpRes = await dbQuery('SELECT COALESCE(role_id, "roleId") as role_id, COALESCE(permission_id, "permissionId") as permission_id FROM role_permissions');
      registerRoleMapping(rolesRes || [], rpRes || []);
    } else if (mem && mem.roles && mem.role_permissions) {
      registerRoleMapping(mem.roles || [], mem.role_permissions || []);
    }
    // Always ensure admin retains all permissions wildcard
    ROLE_PERMISSIONS['admin'] = Array.from(new Set([...PERMISSION_INVENTORY.map(p => p.permissionCode), '*']));
  } catch (e) {
    // Fallback to static defaults
  }
}

/**
 * تحليل واستخراج الصلاحيات المطبقة على المستخدم بصيغة موحدة
 * @param {Object} user
 * @returns {Array<string>}
 */
function parseUserPermissions(user) {
  if (!user) return [];
  const userRole = String(user.role || '').toLowerCase();
  if (userRole === 'admin' || userRole === 'super_admin') return ['*'];

  let perms = [];
  if (Array.isArray(user.permissions)) {
    perms = user.permissions.map(p => normalizePermissionCode(p) || p).filter(Boolean);
  } else if (typeof user.permissions === 'string') {
    try {
      const parsed = JSON.parse(user.permissions);
      perms = Array.isArray(parsed) ? parsed.map(p => normalizePermissionCode(p) || p).filter(Boolean) : user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      perms = user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // دمج صلاحيات الدور الوظيفي
  const roleKeys = [userRole, String(user.role || '')];
  roleKeys.forEach(rk => {
    if (rk && ROLE_PERMISSIONS[rk]) {
      ROLE_PERMISSIONS[rk].forEach(p => {
        if (!perms.includes(p)) perms.push(p);
      });
    }
  });

  return perms;
}

/**
 * التحقق من امتلاك دور أو مستخدم لصلاحية معينة
 * @param {string|Object} roleOrUser
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(roleOrUser, permission) {
  if (!roleOrUser || !permission) return false;

  let role = '';
  let userPerms = [];

  if (typeof roleOrUser === 'string') {
    role = roleOrUser.toLowerCase();
    if (role === 'admin' || role === 'super_admin') return true;
    userPerms = (ROLE_PERMISSIONS[role] || []).map(normalizePermissionCode);
  } else if (typeof roleOrUser === 'object') {
    role = String(roleOrUser.role || '').toLowerCase();
    if (role === 'admin' || role === 'super_admin') return true;
    userPerms = parseUserPermissions(roleOrUser);
  }

  if (userPerms.includes('*')) return true;

  const targetNorm = normalizePermissionCode(permission);
  if (userPerms.includes(targetNorm)) return true;

  // فحص بالصيغة البديلة
  const rawTarget = permission.trim();
  if (userPerms.includes(rawTarget) || userPerms.includes(rawTarget.toLowerCase()) || userPerms.includes(rawTarget.toUpperCase())) {
    return true;
  }

  return false;
}

/**
 * فحص قواعد فصل المهام والمسؤوليات (Separation of Duties)
 * @param {Object} user - المستخدم الحالي
 * @param {Object} entity - الكيان المطلوب معالجته (مطالبة، تصريح، عطاء)
 * @param {string} action - نوع الإجراء (APPROVE, AUDIT, SIGN)
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkSeparationOfDuties(user, entity, action) {
  if (!user || !entity) return { allowed: true };
  const userRole = String(user.role || '').toLowerCase();
  if (userRole === 'admin' || userRole === 'super_admin') return { allowed: true };

  // قاعدة: منشئ المعاملة لا يجوز له اعتمادها كجهة تصديق نهائية منفصلة
  if (action === 'APPROVE' || action === 'FINAL_SIGN') {
    const creatorId = entity.created_by || entity.userId || entity.creatorId || entity.inspectorId;
    if (creatorId && String(creatorId) === String(user.id)) {
      return {
        allowed: false,
        reason: 'فصل المهام والمسؤوليات: لا يجوز لمنشئ المعاملة اعتمادها بشكل نهائي.'
      };
    }
  }

  return { allowed: true };
}

/**
 * تسجيل محاولة وصول أو قرار أمني في سجل التدقيق
 */
async function recordAuthAudit(req, permissionRequired, success, reason = null) {
  try {
    const { isPostgresActive, dbRun, memDb } = require('../utils/database');
    const user = req.user || { id: 'ANONYMOUS', username: 'مجهول', role: 'none' };
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const endpoint = req.originalUrl || req.url;
    const method = req.method;

    const action = success ? 'منح إذن أمني' : 'رفض وصول أمني (403)';
    const details = success 
      ? `تم السماح للمستخدم (${user.fullName || user.username || user.id}) بتنفيذ [${permissionRequired}] على [${method} ${endpoint}]`
      : `محاولة وصول غير مصرح بها: طلب [${permissionRequired}] للمستخدم (${user.fullName || user.username || user.id}) على [${method} ${endpoint}]. السبب: ${reason || 'عدم امتلاك الصلاحية'}`;

    const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
    await recordFn({
      userId: user.id || 'ANONYMOUS',
      userName: user.fullName || user.username || user.id,
      action,
      entity: 'الأمان والصلاحيات',
      entityId: permissionRequired,
      details,
      ip
    });
  } catch (e) {
    // Silently ignore audit log failures to prevent blocking core logic
  }
}

/**
 * حارس وميدلوير التحقق الإلزامي من الصلاحية (Server-Side Authorization Guard)
 * @param {string|Array<string>} permission - الصلاحية أو مصفوفة الصلاحيات المطلوبة (أي منها يكفي)
 * @param {Object} options - { requireAll: boolean, checkSoD: boolean, entityExtractor: Function }
 */
function requirePermission(permission, options = {}) {
  const permsToCheck = Array.isArray(permission) ? permission : [permission];

  return async (req, res, next) => {
    // 1. التحقق من التوثيق (Authentication Check -> 401)
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى هذا الإجراء الهندسي.'
      });
    }

    // 2. حساب الصلاحيات الفعالة
    const userPerms = parseUserPermissions(user);
    const userRole = String(user.role || '').toLowerCase();
    if (userRole === 'admin' || userRole === 'super_admin' || userPerms.includes('*')) {
      return next();
    }

    // 3. مطابقة الصلاحيات
    let isAuthorized = false;
    if (options.requireAll) {
      isAuthorized = permsToCheck.every(p => hasPermission(user, p));
    } else {
      isAuthorized = permsToCheck.some(p => hasPermission(user, p));
    }

    if (!isAuthorized) {
      const neededCodes = permsToCheck.map(normalizePermissionCode).join(' أو ');
      await recordAuthAudit(req, neededCodes, false, 'صلاحيات غير كافية في مصفوفة الصلاحيات');
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        error: `صلاحيات غير كافية: يتطلب هذا الإجراء صلاحية [${neededCodes}].`,
        requiredPermissions: permsToCheck
      });
    }

    // 4. فحص فصل المهام (Separation of Duties Check)
    if (options.checkSoD && typeof options.entityExtractor === 'function') {
      try {
        const entity = await options.entityExtractor(req);
        const sodCheck = checkSeparationOfDuties(user, entity, options.sodAction || 'APPROVE');
        if (!sodCheck.allowed) {
          await recordAuthAudit(req, permsToCheck.join(','), false, sodCheck.reason);
          return res.status(403).json({
            success: false,
            code: 'SOD_VIOLATION',
            error: sodCheck.reason
          });
        }
      } catch (err) {
        console.warn('⚠️ SoD entity extraction note:', err.message);
      }
    }

    next();
  };
}

/**
 * جلب تفاصيل الصلاحيات الفعالة للمستخدم ومصدر كل صلاحية
 * @param {string|Object} userOrId
 * @returns {Promise<Object>}
 */
async function getEffectiveUserPermissions(userOrId) {
  const { isPostgresActive, dbGet, memDb } = require('../utils/database');
  let user = null;

  if (typeof userOrId === 'object' && userOrId !== null) {
    user = userOrId;
  } else {
    const uId = String(userOrId);
    if (isPostgresActive()) {
      user = await dbGet('SELECT id, username, "fullName", role, email, permissions FROM users WHERE id = $1', [uId]);
    }
    if (!user && memDb && memDb.users) {
      user = memDb.users.find(u => String(u.id) === uId || u.username === uId);
    }
  }

  if (!user) {
    return { error: 'المستخدم غير موجود', permissions: [], details: [] };
  }

  const role = String(user.role || '').toLowerCase();
  const rawRole = String(user.role || '');
  const isSuperAdmin = role === 'admin' || role === 'super_admin';
  const rolePerms = Array.from(new Set([
    ...(ROLE_PERMISSIONS[role] || []),
    ...(ROLE_PERMISSIONS[rawRole] || [])
  ]));
  
  let directPerms = [];
  if (Array.isArray(user.permissions)) {
    directPerms = user.permissions.filter(Boolean);
  } else if (typeof user.permissions === 'string') {
    try {
      const p = JSON.parse(user.permissions);
      directPerms = Array.isArray(p) ? p.filter(Boolean) : user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      directPerms = user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  const allEffective = new Set();
  if (isSuperAdmin) {
    allEffective.add('*');
    PERMISSION_INVENTORY.forEach(p => {
      allEffective.add(p.permissionCode);
      if (Array.isArray(p.aliases)) p.aliases.forEach(a => allEffective.add(a));
    });
  } else {
    [...rolePerms, ...directPerms].forEach(p => {
      if (!p) return;
      allEffective.add(p);
      const norm = normalizePermissionCode(p);
      if (norm) allEffective.add(norm);
      const invItem = PERMISSION_INVENTORY.find(item => item.permissionCode === norm);
      if (invItem && Array.isArray(invItem.aliases)) {
        invItem.aliases.forEach(a => allEffective.add(a));
      }
    });
  }

  // بناء تفاصيل المصدر لكل صلاحية مسجلة
  const permissionDetails = PERMISSION_INVENTORY.map(item => {
    const code = item.permissionCode;
    const grantedByAdmin = isSuperAdmin;
    const grantedByRole = rolePerms.some(p => p === code || normalizePermissionCode(p) === code);
    const grantedDirect = directPerms.some(p => p === code || normalizePermissionCode(p) === code);
    const hasPerm = grantedByAdmin || grantedByRole || grantedDirect;

    let source = 'NONE';
    if (grantedByAdmin) source = 'SUPER_ADMIN';
    else if (grantedDirect && grantedByRole) source = 'ROLE_AND_DIRECT';
    else if (grantedDirect) source = 'DIRECT_USER_GRANT';
    else if (grantedByRole) source = `ROLE_${role.toUpperCase()}`;

    return {
      permissionCode: code,
      name: item.name,
      module: item.module,
      action: item.action,
      group: item.group,
      icon: item.icon,
      sensitive: item.sensitive,
      granted: hasPerm,
      source
    };
  });

  return {
    userId: user.id,
    username: user.username,
    fullName: user.fullName || user.username,
    role: user.role,
    isSuperAdmin,
    effectivePermissions: Array.from(allEffective),
    permissionCount: isSuperAdmin ? PERMISSION_INVENTORY.length : allEffective.size,
    permissionDetails
  };
}

const rbacManager = {
  JWT_SECRET,
  PERMISSION_INVENTORY,
  ROLE_PERMISSIONS,
  ALL_SYSTEM_PERMISSIONS: PERMISSION_INVENTORY.map(p => ({
    key: p.permissionCode,
    name: p.name,
    group: p.group,
    icon: p.icon,
    sensitive: p.sensitive
  })),

  normalizePermissionCode,
  parseUserPermissions,
  hasPermission,
  requirePermission,
  authorize: requirePermission,
  authorizeRoles: (...allowedRoles) => {
    const rolesArray = allowedRoles.flat().map(r => String(r).toLowerCase());
    return (req, res, next) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'غير مصرح: يرجى تسجيل الدخول.' });
      }
      const userRole = String(user.role || '').toLowerCase();
      if (userRole === 'admin' || userRole === 'super_admin' || rolesArray.includes(userRole)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'صلاحيات غير كافية: الدور الوظيفي غير مصرح له بتنفيذ هذا الإجراء.'
      });
    };
  },

  verifyToken: async (req, res, next) => {
    const fullPath = req.originalUrl || req.baseUrl + req.path || req.path;
    if (
      fullPath === '/api/login' ||
      fullPath === '/login' ||
      fullPath === '/api/health' ||
      fullPath === '/api/db-status'
    ) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.jti) {
          try {
            const authService = require('../services/authorizationEngineService');
            if (authService && typeof authService.isTokenBlacklisted === 'function') {
              const blacklisted = await authService.isTokenBlacklisted(decoded.jti);
              if (blacklisted) {
                req.user = null;
                return res.status(401).json({ success: false, error: 'جلسة العمل ملغاة أو منتهية، يرجى إعادة تسجيل الدخول.' });
              }
            }
          } catch (blErr) {}
        }
        req.user = decoded;
        req.user.permissionsList = parseUserPermissions(decoded);
        return next();
      } catch (err) {
        req.user = null;
        return res.status(401).json({ success: false, error: 'جلسة العمل غير صالحة أو منتهية، يرجى إعادة تسجيل الدخول.' });
      }
    }

    req.user = null;
    next();
  },

  generateToken: (payload, expiresIn = '12h') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  },

  decodeToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return null;
    }
  },

  isTokenBlacklisted: async (jtiOrToken) => {
    try {
      const authService = require('../services/authorizationEngineService');
      return await authService.isTokenBlacklisted(jtiOrToken);
    } catch (e) {
      return false;
    }
  },

  revokeToken: async (jtiOrToken, userId = 'SYSTEM') => {
    try {
      const authService = require('../services/authorizationEngineService');
      return await authService.revokeToken(jtiOrToken, userId);
    } catch (e) {
      return false;
    }
  },

  reloadDynamicPermissions,
  getEffectiveUserPermissions,
  checkSeparationOfDuties,
  recordAuthAudit
};

module.exports = rbacManager;
