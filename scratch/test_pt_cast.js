const { dbRun } = require('../utils/database');

async function test() {
  try {
    const fakeValues = [
      'test-id-1', 'PRJ-TEST-001', 'CODE-01', 'Test Prj', 'DEVELOPMENT', 'desc',
      null, null, null, null, null,
      'DRAFT', 'MEDIUM', 'MUNICIPALITY', null, 1000, 1000,
      0, 0, null, null, null,
      null, 0, 0, 0,
      'Kafranja', 'Center', 32.2980, 35.7920, null, null,
      null, null, null, 'SYSTEM', new Date().toISOString(), 'SYSTEM', new Date().toISOString()
    ];
    fakeValues.push(35.7920, 32.2980);

    const sql1 = `INSERT INTO public.projects (id, project_number, project_code, project_name, project_type, description,
      directorate_id, department_id, responsible_user_id, project_manager_id, project_manager_name,
      status, priority, funding_source, budget_line_id, budget_amount, approved_budget,
      contracted_amount, actual_cost, planned_start_date, planned_end_date, actual_start_date,
      actual_end_date, completion_percentage, physical_progress, financial_progress,
      location, location_description, latitude, longitude, gis_reference, geometry,
      tender_id, contract_id, parent_project_id, created_by, created_at, updated_by, updated_at, geom) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, ST_SetSRID(ST_MakePoint($40, $41), 4326))`;

    await dbRun(sql1, fakeValues);
    console.log('INSERT SUCCESS!');

    // Test UPDATE
    const sqlUpdate = `
      UPDATE public.projects
      SET project_name = $1, project_type = $2, description = $3, priority = $4,
          funding_source = $5, budget_amount = $6, approved_budget = $7, contracted_amount = $8,
          actual_cost = $9, planned_start_date = $10, planned_end_date = $11, actual_start_date = $12,
          actual_end_date = $13, location = $14, location_description = $15, latitude = $16, longitude = $17,
          geom = ST_SetSRID(ST_MakePoint($22, $23), 4326),
          tender_id = $18, contract_id = $19, updated_by = $20, updated_at = NOW()
      WHERE id = $21
    `;
    const updateParams = [
      'Updated Prj', 'INFRASTRUCTURE', 'desc updated', 'HIGH',
      'MUNICIPALITY', 1200, 1200, 100,
      50, null, null, null,
      null, 'Kafranja', 'North', 32.3000, 35.8000,
      null, null, 'U-001', 'test-id-1',
      35.8000, 32.3000
    ];

    await dbRun(sqlUpdate, updateParams);
    console.log('UPDATE SUCCESS!');

    await dbRun('DELETE FROM public.projects WHERE id = $1', ['test-id-1']);
    console.log('CLEANUP SUCCESS!');
  } catch (e) {
    console.error('FAIL:', e);
  }
  process.exit(0);
}

test();
