-- migrations/028_canonical_projects_enterprise_schema.sql
-- 🏛️ المخطط الكانوني المعتمد لإدارة المشاريع والمحافظ والجدولة والأولويات
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- تفعيل امتداد PostGIS إذا لم يكن مفعلاً
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. جدول المشاريع الهندسية الرأسمالية (Canonical Projects Table)
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
  budget_line_id VARCHAR(64),
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
  geom GEOMETRY(Point, 4326),
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

-- 2. جدول معالم ومراحل المشروع (Milestones)
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

-- 3. جدول سجل المخاطر للمشاريع (Project Risk Register)
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

-- 4. جدول تقارير ونسب التقدم الميداني (Progress Logs)
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

-- 5. جدول المحافظ الرأسمالية (Project Portfolios)
CREATE TABLE IF NOT EXISTS public.project_portfolios (
  id VARCHAR(64) PRIMARY KEY,
  portfolio_number VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  directorate_id VARCHAR(64) DEFAULT 'DIR-ENG',
  department_id VARCHAR(64) DEFAULT 'DEPT-PROJECTS',
  section_id VARCHAR(64),
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. جدول ربط المشاريع بالمحافظ (Portfolio Projects Junction)
CREATE TABLE IF NOT EXISTS public.project_portfolio_projects (
  id VARCHAR(64) PRIMARY KEY,
  portfolio_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_portfolio_project UNIQUE (portfolio_id, project_id)
);

-- 7. جدول الخطط الهندسية الاستراتيجية والسنوية (Project Plans)
CREATE TABLE IF NOT EXISTS public.project_plans (
  id VARCHAR(64) PRIMARY KEY,
  plan_number VARCHAR(64) UNIQUE NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) DEFAULT 'ANNUAL',
  year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'DRAFT',
  directorate_id VARCHAR(64) DEFAULT 'DIR-ENG',
  department_id VARCHAR(64) DEFAULT 'DEPT-PROJECTS',
  section_id VARCHAR(64),
  description TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. جدول ربط المشاريع بالخطط (Plan Projects Junction)
CREATE TABLE IF NOT EXISTS public.project_plan_projects (
  id VARCHAR(64) PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plan_project UNIQUE (plan_id, project_id)
);

-- 9. جدول معايير ترجيح وأولويات المشاريع (Priority Criteria)
CREATE TABLE IF NOT EXISTS public.project_priority_criteria (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  weight NUMERIC(6, 2) NOT NULL CHECK (weight >= 0),
  max_score NUMERIC(6, 2) NOT NULL CHECK (max_score > 0) DEFAULT 10.00,
  active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. جدول تقييم المشاريع وفق المعايير (Priority Scores)
CREATE TABLE IF NOT EXISTS public.project_priority_scores (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  criterion_id VARCHAR(64) NOT NULL,
  score NUMERIC(6, 2) NOT NULL,
  weighted_score NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_proj_criterion UNIQUE (project_id, criterion_id)
);

-- 11. جدول الترتيب والنتائج الإجمالية للأولويات (Priority Results)
CREATE TABLE IF NOT EXISTS public.project_priority_results (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) UNIQUE NOT NULL,
  total_score NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  rank INT DEFAULT 0,
  calculation_version VARCHAR(32) DEFAULT 'v1.0',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_by VARCHAR(64)
);

-- 12. جدول البرمجة المالية السنوية ومتعددة السنوات (Financial Programs)
CREATE TABLE IF NOT EXISTS public.project_financial_programs (
  id VARCHAR(64) PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  fiscal_year INT NOT NULL,
  programmed_amount NUMERIC(15, 2) NOT NULL CHECK (programmed_amount >= 0),
  funding_source VARCHAR(150) DEFAULT 'MUNICIPAL_BUDGET',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'DRAFT',
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plan_proj_year UNIQUE (plan_id, project_id, fiscal_year)
);

-- 13. جدول شبكة تتابع واعتماديات المشاريع (Dependencies)
CREATE TABLE IF NOT EXISTS public.project_dependencies (
  id VARCHAR(64) PRIMARY KEY,
  predecessor_project_id VARCHAR(64) NOT NULL,
  successor_project_id VARCHAR(64) NOT NULL,
  dependency_type VARCHAR(10) NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_days INT NOT NULL DEFAULT 0 CHECK (lag_days >= 0),
  description TEXT,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'ACTIVE',
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_proj_dep_pair UNIQUE (predecessor_project_id, successor_project_id),
  CONSTRAINT chk_no_self_dependency CHECK (predecessor_project_id != successor_project_id)
);

-- 14. جدول الجدولة الزمنية وحسابات المسار الحرج (CPM Schedules)
CREATE TABLE IF NOT EXISTS public.project_schedules (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  planned_start_date DATE NOT NULL,
  planned_end_date DATE NOT NULL,
  duration_days INT NOT NULL CHECK (duration_days > 0),
  early_start_date DATE,
  early_finish_date DATE,
  late_start_date DATE,
  late_finish_date DATE,
  total_float_days INT DEFAULT 0,
  free_float_days INT DEFAULT 0,
  is_critical BOOLEAN DEFAULT FALSE,
  is_baseline BOOLEAN DEFAULT FALSE,
  schedule_version VARCHAR(32) DEFAULT 'v1.0',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  notes TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_proj_sched_ver UNIQUE (project_id, schedule_version)
);

-- 15. فهارس الأداء وتأمين المؤشرات المكانية
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_tender ON public.projects(tender_id);
CREATE INDEX IF NOT EXISTS idx_projects_contract ON public.projects(contract_id);
CREATE INDEX IF NOT EXISTS idx_projects_geom ON public.projects USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_project_milestones_proj ON public.project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_risks_proj ON public.project_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_proj ON public.project_progress_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_status ON public.project_portfolios(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_port ON public.project_portfolio_projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_proj ON public.project_portfolio_projects(project_id);

CREATE INDEX IF NOT EXISTS idx_plans_status ON public.project_plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_type_year ON public.project_plans(plan_type, year);
CREATE INDEX IF NOT EXISTS idx_plan_projects_plan ON public.project_plan_projects(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_projects_proj ON public.project_plan_projects(project_id);

CREATE INDEX IF NOT EXISTS idx_prio_criteria_active ON public.project_priority_criteria(active);
CREATE INDEX IF NOT EXISTS idx_prio_scores_proj ON public.project_priority_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_prio_scores_crit ON public.project_priority_scores(criterion_id);
CREATE INDEX IF NOT EXISTS idx_prio_results_score ON public.project_priority_results(total_score DESC);

CREATE INDEX IF NOT EXISTS idx_fin_prog_plan ON public.project_financial_programs(plan_id);
CREATE INDEX IF NOT EXISTS idx_fin_prog_proj ON public.project_financial_programs(project_id);
CREATE INDEX IF NOT EXISTS idx_fin_prog_year ON public.project_financial_programs(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fin_prog_status ON public.project_financial_programs(status);

CREATE INDEX IF NOT EXISTS idx_proj_dep_pred ON public.project_dependencies(predecessor_project_id);
CREATE INDEX IF NOT EXISTS idx_proj_dep_succ ON public.project_dependencies(successor_project_id);

CREATE INDEX IF NOT EXISTS idx_proj_sched_proj ON public.project_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_sched_critical ON public.project_schedules(is_critical);
CREATE INDEX IF NOT EXISTS idx_proj_sched_baseline ON public.project_schedules(is_baseline);

-- إدراج المعايير البلدية القياسية لترجيح المشاريع
INSERT INTO public.project_priority_criteria (id, code, name, description, weight, max_score, active, created_by)
VALUES 
  ('CRT-001', 'SAFETY', 'السلامة العامة والحد من الحوادث المرورية', 'مدى مساهمة المشروع في معالجة النقاط السوداء الخطرة وتأمين السلامة', 25.00, 10.00, TRUE, 'SYSTEM'),
  ('CRT-002', 'POPULATION', 'الكثافة السكانية وخدمة التجمعات السكنية', 'عدد المواطنين والمستفيدين المباشرين من المشروع في مناطق البلدية', 20.00, 10.00, TRUE, 'SYSTEM'),
  ('CRT-003', 'ECONOMIC', 'الأثر التنموي والاستثماري', 'تحفيز الحركة التجارية والزراعية والربط التنموي في كفرنجة', 20.00, 10.00, TRUE, 'SYSTEM'),
  ('CRT-004', 'READINESS', 'الجاهزية التنظيمية والمخططات والموافقات', 'اكتمال الدراسات الهندسية وجاهزية الموقع وخلوه من المعوقات', 15.00, 10.00, TRUE, 'SYSTEM'),
  ('CRT-005', 'COST_EFFICIENCY', 'كفاءة التكلفة والجدوى الاقتصادية', 'النسبة بين الكلفة المقدرة والأثر الإيجابي المستدام', 20.00, 10.00, TRUE, 'SYSTEM')
ON CONFLICT (code) DO NOTHING;
