-- migrations/009_project_prioritization.sql
-- مصفوفة ترجيح وأولويات المشاريع الهندسية (Enterprise Project Prioritization & Scoring)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- 1. جدول معايير الأولوية وأوزانها (Project Priority Criteria)
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

-- 2. جدول تقييم المشروع لكل معيار (Project Priority Scores)
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

-- 3. جدول المحصلة والترتيب الإجمالي لأولويات المشاريع (Project Priority Results)
CREATE TABLE IF NOT EXISTS public.project_priority_results (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) UNIQUE NOT NULL,
  total_score NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  rank INT DEFAULT 0,
  calculation_version VARCHAR(32) DEFAULT 'v1.0',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  calculated_by VARCHAR(64)
);

-- الفهارس لتحسين سرعة الاستعلام والترتيب
CREATE INDEX IF NOT EXISTS idx_prio_criteria_active ON public.project_priority_criteria(active);
CREATE INDEX IF NOT EXISTS idx_prio_scores_proj ON public.project_priority_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_prio_scores_crit ON public.project_priority_scores(criterion_id);
CREATE INDEX IF NOT EXISTS idx_prio_results_score ON public.project_priority_results(total_score DESC);
