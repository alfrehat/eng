-- migrations/010_project_financial_programming.sql
-- البرمجة المالية السنوية ومتعددة السنوات للمشاريع الهندسية (Project Annual & Multi-Year Financial Programming)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- جدول مخصصات البرمجة المالية السنوية للمشاريع ضمن الخطط (Project Financial Programs)
CREATE TABLE IF NOT EXISTS public.project_financial_programs (
  id VARCHAR(64) PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  fiscal_year INT NOT NULL,
  programmed_amount NUMERIC(15, 2) NOT NULL CHECK (programmed_amount >= 0),
  funding_source VARCHAR(150) DEFAULT 'MUNICIPAL_BUDGET',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, APPROVED, ACTIVE, CLOSED, CANCELLED
  created_by VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(64),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_plan_proj_year UNIQUE (plan_id, project_id, fiscal_year)
);

-- الفهارس لتحسين سرعة الاستعلام والتجميع المالي
CREATE INDEX IF NOT EXISTS idx_fin_prog_plan ON public.project_financial_programs(plan_id);
CREATE INDEX IF NOT EXISTS idx_fin_prog_proj ON public.project_financial_programs(project_id);
CREATE INDEX IF NOT EXISTS idx_fin_prog_year ON public.project_financial_programs(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fin_prog_status ON public.project_financial_programs(status);
