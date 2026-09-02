const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'kafr_inja_engineering'
});

async function main() {
  console.log('Seeding enterprise settings data...');

  // 1. Seed Org Units
  const orgUnits = [
    { id: 'OU-01', name: 'مديرية الأشغال والخدمات الهندسية', type: 'DIRECTORATE', parentId: null, description: 'الإدارة العليا الهندسية لبلدية كفرنجة الجديدة' },
    { id: 'OU-02', name: 'قسم الطرق والبنية التحتية', type: 'DEPARTMENT', parentId: 'OU-01', description: 'إدارة وصيانة شبكات الطرق والإنارة وتصريف الأمطار' },
    { id: 'OU-03', name: 'قسم العطاءات والمشاريع', type: 'DEPARTMENT', parentId: 'OU-01', description: 'متابعة دراسات وطروحات العطاءات والمطالبات والكفالات' },
    { id: 'OU-04', name: 'قسم الرقابة والتفتيش الميداني', type: 'SECTION', parentId: 'OU-01', description: 'الفحوصات المخبرية وتصاريح الحفريات والرقابة' },
    { id: 'OU-05', name: 'الدائرة المالية والمحاسبة', type: 'DEPARTMENT', parentId: 'OU-01', description: 'تدقيق المشتريات والكفالات وعوائد التعبيد' }
  ];

  for (const ou of orgUnits) {
    await pool.query(`
      INSERT INTO public.org_units (id, name, type, "parentId", description)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        "parentId" = EXCLUDED."parentId",
        description = EXCLUDED.description;
    `, [ou.id, ou.name, ou.type, ou.parentId, ou.description]);
  }

  // 2. Seed Roles
  const roles = [
    { id: 'R-001', name: 'admin', label: 'مدير النظام (كامل الصلاحيات)', description: 'صلاحيات شاملة ومطلقة لكافة مكونات النظام وإعداداته' },
    { id: 'R-002', name: 'manager', label: 'مدير مديرية الأشغال', description: 'إدارة المشاريع، العطاءات، الاعتمادات المالية والمطالبات' },
    { id: 'R-003', name: 'dept_head', label: 'رئيس القسم الهندسي', description: 'مراجعة واعتماد الفحوصات، دراسات العطاءات والتصاريح' },
    { id: 'R-004', name: 'engineer', label: 'مهندس تنفيذ مشاريع', description: 'إدخال ومتابعة بيانات الطرق، الأصول، المطالبات وعوائد التعبيد' },
    { id: 'R-005', name: 'inspector', label: 'مراقب ومفتش ميداني', description: 'إدخال فحوصات الطرق وتصاريح الحفريات والزيارات الميدانية' },
    { id: 'R-006', name: 'accountant', label: 'محاسب ومدقق مالي', description: 'مراجعة وتدقيق المشتريات والمطالبات وعوائد التعبيد' }
  ];

  for (const r of roles) {
    await pool.query(`
      INSERT INTO public.roles (id, name, label, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        label = EXCLUDED.label,
        description = EXCLUDED.description;
    `, [r.id, r.name, r.label, r.description]);
  }

  // 3. Seed Workflows from database/workflows.json
  const fs = require('fs');
  const path = require('path');
  const workflows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database', 'workflows.json'), 'utf8'));

  for (const wf of workflows) {
    await pool.query(`
      INSERT INTO public.workflows (id, name, "entityType", "stepsJson")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "entityType" = EXCLUDED."entityType",
        "stepsJson" = EXCLUDED."stepsJson";
    `, [wf.id, wf.name, wf.entityType, wf.stepsJson]);
  }

  // 4. Seed Staff Assignments
  const assignments = [
    { id: 'UOM-001', userId: 'U-001', orgUnitId: 'OU-01', roleId: 'R-001' },
    { id: 'UOM-002', userId: 'U-002', orgUnitId: 'OU-02', roleId: 'R-004' },
    { id: 'UOM-003', userId: 'U-003', orgUnitId: 'OU-05', roleId: 'R-006' }
  ];

  for (const a of assignments) {
    await pool.query(`
      INSERT INTO public.user_org_units (id, "userId", "orgUnitId", "roleId")
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "orgUnitId" = EXCLUDED."orgUnitId",
        "roleId" = EXCLUDED."roleId";
    `, [a.id, a.userId, a.orgUnitId, a.roleId]);
  }

  console.log('✅ Enterprise settings tables seeded successfully!');
  await pool.end();
}

main().catch(err => {
  console.error('❌ Error seeding enterprise settings:', err);
  process.exit(1);
});
