-- migrations/012_central_tasks_appeals_schema.sql
-- توسيع وتثبيت جدول المهام والاستدعيات الميدانية المركزي (Central Tasks & Field Actions)
-- مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(50) PRIMARY KEY,
  task_number VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) DEFAULT 'technical', -- administrative, technical, executive_field, supervisory, emergency, citizen_appeal, summons
  priority VARCHAR(50) DEFAULT 'medium',     -- critical, high, medium, low
  status VARCHAR(50) DEFAULT 'new',          -- new, assigned, accepted, in_progress, pending, under_review, returned, completed, verified, closed, archived
  
  -- الهيكل الإداري والمكلفين
  department_id VARCHAR(50),
  org_unit_id VARCHAR(50),
  assigned_to VARCHAR(50),                   -- Primary assignee user ID
  co_assignees JSONB DEFAULT '[]'::jsonb,    -- Additional team members
  assigned_by VARCHAR(50),                   -- Assigning user ID
  assigned_team VARCHAR(100),
  external_entity VARCHAR(255),
  
  -- التواريخ والمتابعة الزمنية
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMP,
  closed_at TIMESTAMP,
  planned_duration_hours NUMERIC(10,2) DEFAULT 24.0,
  actual_duration_hours NUMERIC(10,2) DEFAULT 0.0,
  sla_hours NUMERIC(10,2) DEFAULT 48.0,
  sla_status VARCHAR(50) DEFAULT 'ON_TRACK', -- ON_TRACK, AT_RISK, DELAYED, CRITICAL
  
  -- الارتباط المركزي بكافة سجلات المنظومة
  entity_type VARCHAR(50),                   -- projects, tenders, contracts, roads, structural_assets, energy_assets, excavation_permits, complaints, correspondence, purchases
  entity_id VARCHAR(50),
  entity_name VARCHAR(255),
  
  -- الموقع والتمثيل المكاني GIS
  location_name VARCHAR(255),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  
  -- الاستدعيات والبلاغات
  appeal_number VARCHAR(100),
  appeal_date VARCHAR(50),
  citizen_name VARCHAR(255),
  citizen_phone VARCHAR(50),
  national_id VARCHAR(50),
  
  -- المهام الفرعية والتقارير الميدانية والمرفقات
  subtasks JSONB DEFAULT '[]'::jsonb,
  field_report JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  approvals JSONB DEFAULT '[]'::jsonb,
  
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
