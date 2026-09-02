-- migrations/011_project_dependencies.sql
-- شبكة واعتماديات تتابع المشاريع الهندسية (Project Dependencies & Precedence Management)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- جدول علاقات الأسبقية والاعتماديات بين المشاريع الهندسية
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

-- الفهارس لتحسين سرعة استعلام شبكة العلاقات ومسارات الاعتماد
CREATE INDEX IF NOT EXISTS idx_proj_dep_pred ON public.project_dependencies(predecessor_project_id);
CREATE INDEX IF NOT EXISTS idx_proj_dep_succ ON public.project_dependencies(successor_project_id);
CREATE INDEX IF NOT EXISTS idx_proj_dep_type ON public.project_dependencies(dependency_type);
CREATE INDEX IF NOT EXISTS idx_proj_dep_status ON public.project_dependencies(status);
