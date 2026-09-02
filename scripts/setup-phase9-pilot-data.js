/**
 * scripts/setup-phase9-pilot-data.js
 * 🏗️ إنشاء وتهيئة بيانات البيئة التجريبية الميدانية المعزولة (Phase 09 Pilot Dataset)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const { dbRun, isPostgresActive, memDb, saveMemTable } = require('../utils/database');

async function setupPhase9PilotData() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏗️ بدء إعداد وتهيئة بيانات التشغيل التجريبي الميداني (Phase 09 Pilot Dataset)');
  console.log('🏛️ بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. المستخدمين التجريبيين والأدوار الوظيفية
  const pilotUsers = [
    {
      id: 'U-PILOT-01',
      username: 'pilot_admin',
      fullName: 'م. عمر فريحات (مدير النظام)',
      role: 'admin',
      department: 'مديرية الأشغال والخدمات الهندسية',
      permissions: ['*']
    },
    {
      id: 'U-PILOT-02',
      username: 'pilot_manager',
      fullName: 'م. خالد بني نصر (مدير الأشغال)',
      role: 'manager',
      department: 'مديرية الأشغال والخدمات الهندسية',
      permissions: [
        'PROJECTS.VIEW', 'PROJECTS.APPROVE', 'PROJECTS.SUSPEND', 'PROJECTS.RESUME', 'PROJECTS.COMPLETE', 'PROJECTS.CLOSE',
        'TENDERS.VIEW', 'TENDERS.APPROVE', 'TENDERS.AWARD',
        'CONTRACTS.VIEW', 'CONTRACTS.APPROVE',
        'CLAIMS.VIEW', 'CLAIMS.APPROVE',
        'ROADS.VIEW', 'ROADS.APPROVE',
        'PURCHASES.VIEW', 'PURCHASES.APPROVE',
        'REPORTS.VIEW', 'REPORTS.PRINT', 'AUDIT.VIEW', 'ARCHIVE.VIEW'
      ]
    },
    {
      id: 'U-PILOT-03',
      username: 'pilot_section_head',
      fullName: 'م. حمزة الرشايدة (رئيس قسم التنفيذ)',
      role: 'dept_head',
      department: 'قسم التنفيذ والمشاريع الرأسمالية',
      permissions: [
        'PROJECTS.VIEW', 'PROJECTS.CREATE', 'PROJECTS.EDIT', 'PROJECTS.SUBMIT', 'PROJECTS.REVIEW',
        'TENDERS.VIEW', 'TENDERS.CREATE', 'TENDERS.EDIT',
        'CONTRACTS.VIEW', 'CONTRACTS.CREATE',
        'CLAIMS.VIEW', 'CLAIMS.AUDIT',
        'ROADS.VIEW', 'ROADS.CREATE', 'ROADS.EDIT',
        'TASKS.VIEW', 'TASKS.CREATE', 'TASKS.ASSIGN',
        'ARCHIVE.VIEW', 'ARCHIVE.UPLOAD', 'REPORTS.VIEW'
      ]
    },
    {
      id: 'U-PILOT-04',
      username: 'pilot_engineer',
      fullName: 'م. أنس القضاه (مهندس مشاريع ميداني)',
      role: 'engineer',
      department: 'قسم التنفيذ والمشاريع الرأسمالية',
      permissions: [
        'PROJECTS.VIEW', 'PROJECTS.SUBMIT',
        'TENDERS.VIEW',
        'CLAIMS.VIEW', 'CLAIMS.CREATE',
        'ROADS.VIEW', 'ROADS.CREATE', 'ROADS.INSPECT',
        'TASKS.VIEW', 'TASKS.EXECUTE',
        'INSPECTION.VIEW', 'INSPECTION.CREATE',
        'ARCHIVE.VIEW', 'ARCHIVE.UPLOAD'
      ]
    },
    {
      id: 'U-PILOT-05',
      username: 'pilot_auditor',
      fullName: 'أ. ليث الشويات (مدقق ومراقب داخلي)',
      role: 'inspector',
      department: 'وحدة الرقابة والتفتيش الداخلي',
      permissions: [
        'PROJECTS.VIEW', 'TENDERS.VIEW', 'CONTRACTS.VIEW', 'CLAIMS.VIEW', 'ROADS.VIEW',
        'PURCHASES.VIEW', 'REPORTS.VIEW', 'AUDIT.VIEW', 'ARCHIVE.VIEW'
      ]
    }
  ];

  // 2. المحفظة والخطط والمشاريع
  const pilotPortfolio = {
    id: 'PORT-PILOT-01',
    name: 'محفظة مشاريع البنية التحتية وإعادة تأهيل شوارع كفرنجة 2026',
    description: 'محفظة استراتيجية للمشاريع الرأسمالية والتنفيذية لبلدية كفرنجة الجديدة',
    targetYear: 2026,
    totalBudget: 450000.0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  const pilotPlan = {
    id: 'PLAN-PILOT-01',
    portfolioId: 'PORT-PILOT-01',
    name: 'الخطة التنفيذية للربعين الأول والثاني 2026',
    allocatedBudget: 300000.0,
    status: 'APPROVED',
    createdAt: new Date().toISOString()
  };

  const pilotProject = {
    id: 'PRJ-PILOT-01',
    project_code: 'PRJ-2026-PILOT-01',
    name: 'مشروع تعبيد وتصريف مياه الأمطار - شارع القلعة ومنطقة الحسبة',
    portfolio_id: 'PORT-PILOT-01',
    plan_id: 'PLAN-PILOT-01',
    department: 'قسم التنفيذ والمشاريع الرأسمالية',
    engineer_in_charge: 'م. أنس القضاه',
    estimated_budget: 120000.0,
    contract_amount: 115000.0,
    status: 'UNDER_EXECUTION',
    start_date: '2026-03-01',
    end_date: '2026-09-30',
    progress_pct: 42.0,
    description: 'مشروع ميداني تجريبي متكامل لتأهيل البنية التحتية وتعبيد الخلطة الساخنة',
    createdAt: new Date().toISOString()
  };

  const pilotFinancialProgram = {
    id: 'FP-PILOT-01',
    project_id: 'PRJ-PILOT-01',
    fiscal_year: 2026,
    q1_allocated: 30000.0,
    q2_allocated: 40000.0,
    q3_allocated: 35000.0,
    q4_allocated: 15000.0,
    total_allocated: 120000.0,
    total_disbursed: 48300.0,
    notes: 'البرمجة المالية المعتمدة لمشروع شارع القلعة'
  };

  const pilotSchedule = {
    id: 'SCH-PILOT-01',
    project_id: 'PRJ-PILOT-01',
    task_name: 'أعمال فرش وتسوية طبقة البيسكورس والدحل',
    start_date: '2026-03-15',
    end_date: '2026-04-30',
    duration_days: 45,
    cpm_early_start: 0,
    cpm_early_finish: 45,
    cpm_late_start: 0,
    cpm_late_finish: 45,
    cpm_float: 0,
    is_critical: true,
    progress: 100.0
  };

  const pilotTender = {
    id: 'T-PILOT-01',
    tender_number: 'TEN-2026-PILOT-01',
    project_id: 'PRJ-PILOT-01',
    name: 'عطاء توريد وتنفيذ خلطات إسفلتية ساخنة وعناصر تصريف مياه',
    estimated_cost: 120000.0,
    awarded_value: 115000.0,
    awarded_contractor: 'شركة صخور عجلون للمقاولات الإنشائية',
    status: 'AWARDED',
    award_date: '2026-02-15'
  };

  const pilotContract = {
    id: 'CNT-PILOT-01',
    contract_number: 'CNT-2026-PILOT-01',
    tender_id: 'T-PILOT-01',
    project_id: 'PRJ-PILOT-01',
    contractor_name: 'شركة صخور عجلون للمقاولات الإنشائية',
    contract_value: 115000.0,
    advance_payment: 11500.0,
    performance_bond_value: 11500.0,
    performance_bond_expiry: '2026-12-31',
    performance_bond_bank: 'بنك الإسكان للتجارة والتمويل - فرع كفرنجة',
    start_date: '2026-03-01',
    completion_date: '2026-09-30',
    status: 'ACTIVE'
  };

  const pilotClaim = {
    id: 'C-PILOT-01',
    claimNumber: 'CLM-2026-PILOT-01',
    tenderId: 'T-PILOT-01',
    contractId: 'CNT-PILOT-01',
    projectId: 'PRJ-PILOT-01',
    contractor: 'شركة صخور عجلون للمقاولات الإنشائية',
    claimType: 'دفعة إنجاز جارية (مستخلص رقم 1)',
    amount: 35000.0,
    completionPercentage: 30.0,
    retentionPercentage: 10.0,
    retention: 3500.0,
    advanceDeduction: 1150.0,
    taxDeduction: 0.0,
    netPayable: 30350.0,
    status: 'معتمدة وجاهزة للصرف المالي'
  };

  const pilotRoad = {
    id: 'RD-PILOT-01',
    road_number: 'RD-KFR-001',
    name: 'شارع القلعة الرئيسي - كفرنجة',
    zone: 'المنطقة الأولى - وسط البلد',
    length_meters: 1450.0,
    width_meters: 14.0,
    pavement_type: 'asphalt',
    pci_score: 78.5,
    pci_rating: 'جيدة (Good)',
    last_inspection_date: '2026-05-10'
  };

  // تطبيق التخزين المزدوج المعزول (Dual Sync)
  if (!memDb.users) memDb.users = [];
  pilotUsers.forEach(u => {
    const idx = memDb.users.findIndex(x => x.id === u.id);
    if (idx >= 0) memDb.users[idx] = u; else memDb.users.push(u);
  });
  saveMemTable('users');

  const entities = [
    { table: 'project_portfolios', data: pilotPortfolio },
    { table: 'project_plans', data: pilotPlan },
    { table: 'projects', data: pilotProject },
    { table: 'project_financial_programs', data: pilotFinancialProgram },
    { table: 'project_schedules', data: pilotSchedule },
    { table: 'tenders', data: pilotTender },
    { table: 'contracts', data: pilotContract },
    { table: 'claims', data: pilotClaim },
    { table: 'roads', data: pilotRoad }
  ];

  entities.forEach(e => {
    if (!memDb[e.table]) memDb[e.table] = [];
    const idx = memDb[e.table].findIndex(x => x.id === e.data.id);
    if (idx >= 0) memDb[e.table][idx] = e.data; else memDb[e.table].push(e.data);
    saveMemTable(e.table);
  });

  console.log('✅ تم تجهيز 5 مستخدمين تجريبيين بأدوار مختلفة (Admin, Manager, Section Head, Engineer, Auditor)');
  console.log('✅ تم تجهيز 9 كيانات تشغيلية مترابطة وشاملة دورة الحياة الكاملة للمشاريع');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return { success: true, pilotUsersCount: pilotUsers.length, entitiesCount: entities.length };
}

if (require.main === module) {
  setupPhase9PilotData().then(() => process.exit(0)).catch(err => {
    console.error('💥 Failed to setup pilot data:', err);
    process.exit(1);
  });
}

module.exports = setupPhase9PilotData;
