-- =============================================================================
-- migrations/013_remediation_fixes.sql
-- CONTROLLED REMEDIATION - Schema Fixes (Section E + I)
-- تاريخ: 2026-09-11
-- =============================================================================

-- 1. اصلاح activity_log -- اضافة عمود ip المفقود (DA-007)
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip VARCHAR(50) DEFAULT '127.0.0.1';

-- 2. استعادة Foreign Keys في role_permissions (DA-005)
ALTER TABLE role_permissions
  DROP CONSTRAINT IF EXISTS fk_rp_role,
  DROP CONSTRAINT IF EXISTS fk_rp_permission;

ALTER TABLE role_permissions
  ADD CONSTRAINT fk_rp_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;

ALTER TABLE role_permissions
  ADD CONSTRAINT fk_rp_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- 3. فهارس مكانية مفقودة (DA-013/014)
CREATE INDEX IF NOT EXISTS idx_road_side_assets_geom
  ON road_side_assets USING GIST(geom);

CREATE INDEX IF NOT EXISTS idx_road_survey_points_geom
  ON road_survey_points USING GIST(geom);

-- 4. تحويل ALTER TABLE runtime من pavingReturns.js الى migration
ALTER TABLE public.paving_returns
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS current_stage INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_paving_returns_approval_status
  ON public.paving_returns(approval_status);

-- 5. lat/lng لـ paving_returns
ALTER TABLE public.paving_returns
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 6. فهرس مكاني على paving_returns
CREATE INDEX IF NOT EXISTS idx_paving_returns_geom
  ON public.paving_returns USING GIST(geom);
