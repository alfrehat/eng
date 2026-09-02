-- migrations/012_project_scheduling.sql
-- محرك الجدولة الزمنية وحسابات المسار الحرج للمشاريع الهندسية (Project Scheduling & CPM Timeline Engine)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية

-- جدول الجداول الزمنية وحسابات المسار الحرج (Project Schedules & CPM Results)
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

-- الفهارس لتحسين سرعة استعلام الجداول الزمنية والمسار الحرج
CREATE INDEX IF NOT EXISTS idx_proj_sched_proj ON public.project_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_sched_critical ON public.project_schedules(is_critical);
CREATE INDEX IF NOT EXISTS idx_proj_sched_baseline ON public.project_schedules(is_baseline);
CREATE INDEX IF NOT EXISTS idx_proj_sched_ver ON public.project_schedules(schedule_version);
CREATE INDEX IF NOT EXISTS idx_proj_sched_status ON public.project_schedules(status);
