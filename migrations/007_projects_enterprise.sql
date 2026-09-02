-- migrations/007_projects_enterprise.sql
-- جدول المشاريع الهندسية والمحافظ الرأسمالية (Enterprise Projects Aggregate)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

CREATE TABLE IF NOT EXISTS public.projects (
  id VARCHAR(64) PRIMARY KEY,
  project_number VARCHAR(64) UNIQUE NOT NULL,
  project_code VARCHAR(64),
  project_name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100) DEFAULT 'إنشاء وتعبيد طرق',
  description TEXT,
  directorate_id VARCHAR(64) DEFAULT 'DIR-ENG',
  department_id VARCHAR(64) DEFAULT 'DEPT-PROJECTS',
  responsible_user_id VARCHAR(64),
  project_manager_id VARCHAR(64),
  project_manager_name VARCHAR(150),
  status VARCHAR(50) DEFAULT 'DRAFT',
  priority VARCHAR(30) DEFAULT 'MEDIUM',
  funding_source VARCHAR(150) DEFAULT 'موازنة البلدية',
  budget_amount NUMERIC(15, 2) DEFAULT 0.00,
  approved_budget NUMERIC(15, 2) DEFAULT 0.00,
  contracted_amount NUMERIC(15, 2) DEFAULT 0.00,
  actual_cost NUMERIC(15, 2) DEFAULT 0.00,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  completion_percentage NUMERIC(5, 2) DEFAULT 0.00,
  physical_progress NUMERIC(5, 2) DEFAULT 0.00,
  financial_progress NUMERIC(5, 2) DEFAULT 0.00,
  location VARCHAR(255),
  location_description TEXT,
  latitude NUMERIC(10, 6) DEFAULT 32.2980,
  longitude NUMERIC(10, 6) DEFAULT 35.7920,
  gis_reference VARCHAR(100),
  geometry JSONB,
  tender_id VARCHAR(64),
  contract_id VARCHAR(64),
  parent_project_id VARCHAR(64),
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  planned_date DATE,
  actual_date DATE,
  status VARCHAR(50) DEFAULT 'PENDING',
  weight NUMERIC(5, 2) DEFAULT 10.00,
  completion_percentage NUMERIC(5, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_risks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  risk_type VARCHAR(100) DEFAULT 'TECHNICAL',
  description TEXT NOT NULL,
  probability VARCHAR(30) DEFAULT 'MEDIUM',
  impact VARCHAR(30) DEFAULT 'MEDIUM',
  severity VARCHAR(30) DEFAULT 'MEDIUM',
  mitigation TEXT,
  owner VARCHAR(150),
  status VARCHAR(50) DEFAULT 'OPEN',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_progress_logs (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  reporting_period VARCHAR(100),
  progress_date DATE DEFAULT CURRENT_DATE,
  physical_progress NUMERIC(5, 2) DEFAULT 0.00,
  financial_progress NUMERIC(5, 2) DEFAULT 0.00,
  variance NUMERIC(5, 2) DEFAULT 0.00,
  notes TEXT,
  reported_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- الفهارس لتحسين الأداء وسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_tender ON public.projects(tender_id);
CREATE INDEX IF NOT EXISTS idx_projects_contract ON public.projects(contract_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_proj ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_proj ON public.project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_proj ON public.project_progress_logs(project_id);
