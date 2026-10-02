-- ==============================================================================
-- Migration 025: Canonical Inspection Schema & Synchronization
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- Scope: Inspection Quality Control & Pavement Distress Alignment
-- ==============================================================================

-- 1. Align public.road_inspections with INSPECTION_ENGINE domain requirements
ALTER TABLE public.road_inspections
  ADD COLUMN IF NOT EXISTS site_location VARCHAR(255) DEFAULT 'كفرنجة',
  ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'PASSED',
  ADD COLUMN IF NOT EXISTS severity_level VARCHAR(50) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS defects TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reinspection_date DATE,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_road_inspections_road ON public.road_inspections(road_id);
CREATE INDEX IF NOT EXISTS idx_road_inspections_condition ON public.road_inspections(condition);
CREATE INDEX IF NOT EXISTS idx_road_inspections_created_at ON public.road_inspections(created_at);

-- 2. Align public.pavement_inspections for schema parity across inspections
ALTER TABLE public.pavement_inspections
  ADD COLUMN IF NOT EXISTS site_location VARCHAR(255) DEFAULT 'كفرنجة',
  ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'PASSED',
  ADD COLUMN IF NOT EXISTS severity_level VARCHAR(50) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS defects TEXT DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reinspection_date DATE,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pavement_inspections_date ON public.pavement_inspections(inspection_date);

-- 3. Robust fallback sequence default on activity_log.id to prevent null-constraint aborts
ALTER TABLE public.activity_log 
  ALTER COLUMN id SET DEFAULT ('LOG-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISSMS') || '-' || floor(random()*1000)::text);
