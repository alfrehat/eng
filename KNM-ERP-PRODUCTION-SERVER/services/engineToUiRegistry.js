/**
 * services/engineToUiRegistry.js
 * 🗺️ سجل ربط المحركات المؤسسية بالواجهة وتوزيع الصلاحيات (Engine-to-UI Registry)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * يربط هذا السجل كافة المحركات الـ 28 بمجموعاتها الوظيفية الثمانية وشاشاتها وصلاحياتها.
 */

const ENGINE_UI_MODULES = [
  // ─── 1. التخطيط والمحفظة (Planning & Portfolio) ───
  {
    groupId: 'PLANNING_PORTFOLIO',
    groupName: 'التخطيط والمحفظة الاستثمارية',
    groupIcon: '📊',
    engines: [
      {
        engineId: 'PROJECT_PORTFOLIO_ENGINE',
        displayName: 'المحافظ والخطط الاستثمارية',
        pageId: 'portfolios',
        icon: '📁',
        requiredPermission: 'PORTFOLIO.VIEW',
        actions: [
          { action: 'CREATE', label: 'إنشاء محفظة', permission: 'PORTFOLIO.CREATE' },
          { action: 'EDIT', label: 'تعديل المحفظة', permission: 'PORTFOLIO.EDIT' },
          { action: 'APPROVE', label: 'اعتماد الخطة', permission: 'PORTFOLIO.APPROVE' },
          { action: 'EXPORT', label: 'تصدير الخطة', permission: 'PORTFOLIO.EXPORT' }
        ]
      },
      {
        engineId: 'PROJECTS_ENGINE',
        displayName: 'المشاريع الهندسية الرأسمالية',
        pageId: 'projects',
        icon: '🏗️',
        requiredPermission: 'PROJECTS.VIEW',
        actions: [
          { action: 'CREATE', label: 'مشروع جديد', permission: 'PROJECTS.CREATE' },
          { action: 'EDIT', label: 'تعديل البيانات', permission: 'PROJECTS.EDIT' },
          { action: 'SUBMIT', label: 'تقديم للاعتماد', permission: 'PROJECTS.SUBMIT' },
          { action: 'APPROVE', label: 'اعتماد المشروع', permission: 'PROJECTS.APPROVE' },
          { action: 'SUSPEND', label: 'إيقاف مؤقت', permission: 'PROJECTS.SUSPEND' },
          { action: 'PRINT', label: 'طباعة البطاقة', permission: 'PROJECTS.PRINT' },
          { action: 'EXPORT', label: 'تصدير البيانات', permission: 'PROJECTS.EXPORT' }
        ]
      },
      {
        engineId: 'PROJECT_PRIORITIZATION_ENGINE',
        displayName: 'ترجيح وأولويات المشاريع',
        pageId: 'project-priorities',
        icon: '🎯',
        requiredPermission: 'PROJECT_PRIORITY.VIEW',
        actions: [
          { action: 'CALCULATE', label: 'احتساب الدرجات', permission: 'PROJECT_PRIORITY.CALCULATE' },
          { action: 'APPROVE', label: 'تثبيت الترتيب', permission: 'PROJECT_PRIORITY.APPROVE' }
        ]
      },
      {
        engineId: 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE',
        displayName: 'البرمجة والتدفقات المالية',
        pageId: 'financial-programs',
        icon: '💵',
        requiredPermission: 'FINANCIAL_PROGRAM.VIEW',
        actions: [
          { action: 'ALLOCATE', label: 'تخصيص الموازنة', permission: 'FINANCIAL_PROGRAM.ALLOCATE' },
          { action: 'APPROVE', label: 'اعتماد الصرف', permission: 'FINANCIAL_PROGRAM.APPROVE' }
        ]
      },
      {
        engineId: 'PROJECT_DEPENDENCY_ENGINE',
        displayName: 'شبكة التتابع والاعتماديات',
        pageId: 'project-dependencies',
        icon: '🔗',
        requiredPermission: 'PROJECT_DEPENDENCY.VIEW',
        actions: [
          { action: 'MANAGE', label: 'ربط الاعتماديات', permission: 'PROJECT_DEPENDENCY.MANAGE' },
          { action: 'CHECK', label: 'فحص الحلقات', permission: 'PROJECT_DEPENDENCY.CHECK' }
        ]
      },
      {
        engineId: 'PROJECT_SCHEDULING_ENGINE',
        displayName: 'الجدولة والمسار الحرج (CPM)',
        pageId: 'project-schedules',
        icon: '📅',
        requiredPermission: 'PROJECT_SCHEDULE.VIEW',
        actions: [
          { action: 'CALCULATE', label: 'احتساب CPM', permission: 'PROJECT_SCHEDULE.CALCULATE' },
          { action: 'BASELINE', label: 'تثبيت خط الأساس', permission: 'PROJECT_SCHEDULE.BASELINE' }
        ]
      }
    ]
  },

  // ─── 2. العطاءات والعقود (Tenders & Contracts) ───
  {
    groupId: 'TENDERS_CONTRACTS',
    groupName: 'العطاءات والعقود والمطالبات',
    groupIcon: '📜',
    engines: [
      {
        engineId: 'TENDERS_ENGINE',
        displayName: 'العطاءات واستدراج العروض',
        pageId: 'tenders',
        icon: '📋',
        requiredPermission: 'TENDERS.VIEW',
        actions: [
          { action: 'CREATE', label: 'طرح عطاء جديد', permission: 'TENDERS.CREATE' },
          { action: 'AWARD', label: 'إحالة العطاء', permission: 'TENDERS.AWARD' },
          { action: 'PRINT', label: 'طباعة الإعلان', permission: 'TENDERS.PRINT' }
        ]
      },
      {
        engineId: 'CONTRACTS_ENGINE',
        displayName: 'العقود والكفالات البنكية',
        pageId: 'contracts',
        icon: '📜',
        requiredPermission: 'CONTRACTS.VIEW',
        actions: [
          { action: 'CREATE', label: 'توثيق عقد', permission: 'CONTRACTS.CREATE' },
          { action: 'VO_ADD', label: 'أمر تغييري', permission: 'CONTRACTS.EDIT' },
          { action: 'BG_MANAGE', label: 'إدارة الكفالات', permission: 'GUARANTEES.MANAGE' }
        ]
      },
      {
        engineId: 'CLAIMS_ENGINE',
        displayName: 'المطالبات والدفعات المالية',
        pageId: 'claims',
        icon: '💰',
        requiredPermission: 'CLAIMS.VIEW',
        actions: [
          { action: 'CREATE', label: 'تسجيل مطالبة', permission: 'CLAIMS.CREATE' },
          { action: 'AUDIT', label: 'تدقيق واعتماد', permission: 'CLAIMS.AUDIT' }
        ]
      }
    ]
  },

  // ─── 3. شبكة الطرق والرصفات (Roads & Infrastructure) ───
  {
    groupId: 'ROADS_INFRASTRUCTURE',
    groupName: 'شبكة الطرق وعوائد التعبيد',
    groupIcon: '🛣️',
    engines: [
      {
        engineId: 'ROADS_ENGINE',
        displayName: 'شبكة الطرق وتقييم الرصفات (PCI)',
        pageId: 'roads',
        icon: '🛣️',
        requiredPermission: 'ROADS.VIEW',
        actions: [
          { action: 'CREATE', label: 'إضافة طريق', permission: 'ROADS.CREATE' },
          { action: 'PCI_SURVEY', label: 'مسح ميداني PCI', permission: 'ROADS.EDIT' }
        ]
      },
      {
        engineId: 'PAVEMENT_RETURNS_ENGINE',
        displayName: 'عوائد التعبيد والتحققات البلدية',
        pageId: 'paving-returns',
        icon: '💵',
        requiredPermission: 'PAVING.VIEW',
        actions: [
          { action: 'CREATE', label: 'تحقق قطعة', permission: 'PAVING.CREATE' },
          { action: 'RECORD_PAYMENT', label: 'سند قبض', permission: 'PAVING.APPROVE' }
        ]
      },
      {
        engineId: 'SPATIAL_GIS_ENGINE',
        displayName: 'نظم المعلومات الجغرافية (GIS)',
        pageId: 'gis',
        icon: '🗺️',
        requiredPermission: 'ROADS.VIEW',
        actions: [
          { action: 'VIEW_MAP', label: 'الخريطة التفاعلية', permission: 'ROADS.VIEW' }
        ]
      }
    ]
  },

  // ─── 4. الأصول والمرافق البلدية (Assets & Facilities) ───
  {
    groupId: 'MUNICIPAL_ASSETS',
    groupName: 'الأصول والمرافق والآليات',
    groupIcon: '🏛️',
    engines: [
      {
        engineId: 'ASSETS_ENGINE',
        displayName: 'الأبنية والجدران والآليات',
        pageId: 'structural-assets',
        icon: '🏛️',
        requiredPermission: 'ASSETS.VIEW',
        actions: [
          { action: 'CREATE', label: 'تسجيل أصل', permission: 'ASSETS.CREATE' },
          { action: 'DEPRECIATION', label: 'حساب الاستهلاك', permission: 'ASSETS.EDIT' }
        ]
      }
    ]
  },

  // ─── 5. المشتريات واللوازم (Procurement & Purchases) ───
  {
    groupId: 'PURCHASES_PROCUREMENT',
    groupName: 'المشتريات والتوريدات الهندسية',
    groupIcon: '🛒',
    engines: [
      {
        engineId: 'PURCHASES_ENGINE',
        displayName: 'أوامر الشراء ولجان الاستلام',
        pageId: 'purchases',
        icon: '🛒',
        requiredPermission: 'PURCHASES.VIEW',
        actions: [
          { action: 'CREATE', label: 'طلب شراء', permission: 'PURCHASES.CREATE' },
          { action: 'RECEIVE', label: 'محضر استلام', permission: 'PURCHASES.EDIT' }
        ]
      }
    ]
  },

  // ─── 6. الرقابة والتفتيش واللجان (Inspection & Committees) ───
  {
    groupId: 'INSPECTION_COMMITTEES',
    groupName: 'الرقابة الميدانية واللجان الفنية',
    groupIcon: '🔍',
    engines: [
      {
        engineId: 'INSPECTION_ENGINE',
        displayName: 'التفتيش الميداني وضبط الجودة',
        pageId: 'inspections',
        icon: '🔍',
        requiredPermission: 'TASKS.VIEW',
        actions: [
          { action: 'INSPECT', label: 'كشف موقعي', permission: 'TASKS.CREATE' }
        ]
      },
      {
        engineId: 'COMMITTEES_ENGINE',
        displayName: 'محاضر اللجان والاستلام الأولي والنهائي',
        pageId: 'committee-reports',
        icon: '📝',
        requiredPermission: 'TENDERS.VIEW',
        actions: [
          { action: 'REPORT', label: 'توثيق محضر', permission: 'TENDERS.EDIT' }
        ]
      }
    ]
  },

  // ─── 7. الأرشيف والتقارير والطباعة (Archive & Reports) ───
  {
    groupId: 'ARCHIVE_REPORTS',
    groupName: 'الأرشيف والتقارير والطباعة',
    groupIcon: '📁',
    engines: [
      {
        engineId: 'ARCHIVE_DOCUMENT_ENGINE',
        displayName: 'الأرشيف الرقمي للمستندات',
        pageId: 'archive',
        icon: '🗄️',
        requiredPermission: 'ARCHIVE.VIEW',
        actions: [
          { action: 'UPLOAD', label: 'أرشفة وثيقة', permission: 'ARCHIVE.UPLOAD' }
        ]
      },
      {
        engineId: 'PRINT_REPORT_ENGINE',
        displayName: 'التقارير والمخرجات الرسمية',
        pageId: 'reports',
        icon: '🖨️',
        requiredPermission: 'REPORTS.VIEW',
        actions: [
          { action: 'PRINT', label: 'طباعة رسمية', permission: 'REPORTS.PRINT' }
        ]
      },
      {
        engineId: 'G2G_GATEWAY_ENGINE',
        displayName: 'بوابة الربط الحكومي (G2G)',
        pageId: 'g2g-gateway',
        icon: '🌐',
        requiredPermission: 'SYSTEM.MANAGE',
        actions: [
          { action: 'SYNC', label: 'مزامنة مع الوزارة', permission: 'SYSTEM.MANAGE' }
        ]
      }
    ]
  },

  // ─── 8. إدارة النظام والمستخدمين (Administration) ───
  {
    groupId: 'SYSTEM_ADMINISTRATION',
    groupName: 'الإدارة العامة والصلاحيات',
    groupIcon: '⚙️',
    engines: [
      {
        engineId: 'AUTHORIZATION_ENGINE',
        displayName: 'المستخدمون والأدوار والصلاحيات',
        pageId: 'settings',
        icon: '👥',
        requiredPermission: 'USERS.VIEW',
        actions: [
          { action: 'USER_CREATE', label: 'مستخدم جديد', permission: 'USERS.CREATE' },
          { action: 'ROLE_MANAGE', label: 'إدارة الأدوار', permission: 'ROLES.MANAGE' },
          { action: 'PERM_EDIT', label: 'تعديل الصلاحيات', permission: 'ROLES.EDIT' }
        ]
      },
      {
        engineId: 'WORKFLOW_ENGINE',
        displayName: 'محرك سير العمل ومسارات الاعتماد',
        pageId: 'workflows',
        icon: '🔄',
        requiredPermission: 'WORKFLOW.VIEW',
        actions: [
          { action: 'MANAGE', label: 'تعديل المسار', permission: 'WORKFLOW.MANAGE' }
        ]
      }
    ]
  }
];

class EngineToUiRegistry {
  constructor() {
    this.modules = ENGINE_UI_MODULES;
  }

  getModulesForUser(userPermissions = [], userRole = 'engineer') {
    if (userRole === 'admin' || userPermissions.includes('ADMIN.SUPER') || userPermissions.includes('*')) {
      return this.modules;
    }

    const filtered = [];
    this.modules.forEach(group => {
      const allowedEngines = group.engines.filter(engine => {
        if (!engine.requiredPermission) return true;
        return userPermissions.includes(engine.requiredPermission);
      });

      if (allowedEngines.length > 0) {
        filtered.push({
          ...group,
          engines: allowedEngines.map(e => ({
            ...e,
            actions: e.actions.filter(a => !a.permission || userPermissions.includes(a.permission))
          }))
        });
      }
    });

    return filtered;
  }

  getAllEngines() {
    const list = [];
    this.modules.forEach(g => {
      g.engines.forEach(e => {
        list.push({ ...e, groupId: g.groupId, groupName: g.groupName });
      });
    });
    return list;
  }
}

const engineToUiRegistry = new EngineToUiRegistry();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = engineToUiRegistry;
}
if (typeof window !== 'undefined') {
  window.engineToUiRegistry = engineToUiRegistry;
}
