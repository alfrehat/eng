-- migrations/008_project_portfolio_planning.sql
-- جدول المحافظ والخطط الاستثمارية الرأسمالية (Enterprise Project Portfolio & Planning Foundation)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- 1. جدول المحافظ الرأسمالية (Project Portfolios)
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

-- 2. جدول ربط المشاريع بالمحافظ (Portfolio Projects Junction)
CREATE TABLE IF NOT EXISTS public.project_portfolio_projects (
  id VARCHAR(64) PRIMARY KEY,
  portfolio_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_portfolio_project UNIQUE (portfolio_id, project_id)
);

-- 3. جدول الخطط الهندسية (Project Plans - Annual, Multi-Year, Strategic)
CREATE TABLE IF NOT EXISTS public.project_plans (
  id VARCHAR(64) PRIMARY KEY,
  plan_number VARCHAR(64) UNIQUE NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) DEFAULT 'ANNUAL', -- ANNUAL, MULTI_YEAR, STRATEGIC
  year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, APPROVED, ACTIVE, CLOSED, CANCELLED
  directorate_id VARCHAR(64) DEFAULT 'DIR-ENG',
  department_id VARCHAR(64) DEFAULT 'DEPT-PROJECTS',
  section_id VARCHAR(64),
  description TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. جدول ربط المشاريع بالخطط (Plan Projects Junction)
CREATE TABLE IF NOT EXISTS public.project_plan_projects (
  id VARCHAR(64) PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plan_project UNIQUE (plan_id, project_id)
);

-- الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_portfolios_status ON public.project_portfolios(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_port ON public.project_portfolio_projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_proj ON public.project_portfolio_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON public.project_plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_type_year ON public.project_plans(plan_type, year);
CREATE INDEX IF NOT EXISTS idx_plan_projects_plan ON public.project_plan_projects(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_projects_proj ON public.project_plan_projects(project_id);
