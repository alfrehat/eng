-- migrations/019_canonical_budget_schema.sql
-- 💰 المنظومة الموحدة لبيانات الموازنة العامة والبنود والمخصصات المالية
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- Canonical Budget Schema & Historical Backward Compatibility Views

-- 1. جدول بنود وفصول الموازنة العامة للمديرية (Canonical Directorate Budget Lines)
CREATE TABLE IF NOT EXISTS public.directorate_budget_lines (
  id VARCHAR(50) PRIMARY KEY,
  year VARCHAR(10) NOT NULL,
  fiscal_year INTEGER,
  chapter_code VARCHAR(50),
  chapter_name VARCHAR(255) NOT NULL,
  line_code VARCHAR(50),
  code VARCHAR(50),
  line_name VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(15,2),
  funding_source VARCHAR(100) DEFAULT 'موازنة البلدية الذاتية',
  department VARCHAR(100) DEFAULT 'مديرية الأشغال والخدمات الهندسية',
  department_id VARCHAR(100) DEFAULT 'DIR-ENG',
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- فهارس تحسين الاستعلام المالي والسنوات المالية
CREATE INDEX IF NOT EXISTS idx_dir_budget_lines_year ON public.directorate_budget_lines(year);
CREATE INDEX IF NOT EXISTS idx_dir_budget_lines_fiscal_year ON public.directorate_budget_lines(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_dir_budget_lines_line_code ON public.directorate_budget_lines(line_code);
CREATE INDEX IF NOT EXISTS idx_dir_budget_lines_chapter ON public.directorate_budget_lines(chapter_code);

-- 2. جدول المخصصات والالتزامات التعاقدية المرتبطة بالبنود (Canonical Budget Allocations)
CREATE TABLE IF NOT EXISTS public.directorate_budget_allocations (
  id VARCHAR(50) PRIMARY KEY,
  budget_line_id VARCHAR(50) NOT NULL REFERENCES public.directorate_budget_lines(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  entity_name VARCHAR(255),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'COMMITTED',
  notes TEXT,
  created_by VARCHAR(50) DEFAULT 'SYSTEM',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- فهارس تحسين استعلام المخصصات والكيانات المرتبطة
CREATE INDEX IF NOT EXISTS idx_dir_budget_alloc_line_id ON public.directorate_budget_allocations(budget_line_id);
CREATE INDEX IF NOT EXISTS idx_dir_budget_alloc_entity ON public.directorate_budget_allocations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dir_budget_alloc_status ON public.directorate_budget_allocations(status);

-- 3. إتاحة مسارات التوافق القديمة كـ Views رسمية تمنع أي كسر للمستهلكين التاريخيين
CREATE OR REPLACE VIEW public.budget_lines AS 
  SELECT * FROM public.directorate_budget_lines;

CREATE OR REPLACE VIEW public.budget_allocations AS 
  SELECT * FROM public.directorate_budget_allocations;
