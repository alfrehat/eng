-- =====================================================================
-- Migration: 024_canonical_postgis_indexes_and_srid.sql
-- Description: PostGIS SRID normalization and complete GIST spatial index coverage
-- Scope: GIS / PostGIS Canonical Layer
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- =====================================================================

-- 1. توحيد وتثبيت الإسناد المكاني WGS84 (SRID 4326) على الطبقات المكانية غير المقيدة
DO $$
BEGIN
  -- ضبط SRID = 4326 لجدول عوائد التعبيد
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'paving_returns' AND column_name = 'geom'
  ) THEN
    ALTER TABLE public.paving_returns 
      ALTER COLUMN geom TYPE geometry(Geometry, 4326) 
      USING ST_SetSRID(geom, 4326);
  END IF;

  -- ضبط SRID = 4326 لجدول تصاريح الحفريات
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'excavation_permits' AND column_name = 'geom'
  ) THEN
    ALTER TABLE public.excavation_permits 
      ALTER COLUMN geom TYPE geometry(Geometry, 4326) 
      USING ST_SetSRID(geom, 4326);
  END IF;
END $$;

-- 2. إنشاء الفهارس المكانية الشاملة من نوع GIST لكافة الأعمدة الهندسية المكانية
CREATE INDEX IF NOT EXISTS idx_gis_survey_points_geom ON public.gis_survey_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_paving_returns_geom ON public.paving_returns USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_defects_geom ON public.road_defects USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_side_assets_geom ON public.road_side_assets USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_survey_points_geom ON public.road_survey_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_tasks_geom ON public.tasks USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_tenders_geom ON public.tenders USING GIST (geom);
