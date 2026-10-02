-- =============================================================================
-- migrations/018_canonical_assets_schema.sql
-- CANONICAL MUNICIPAL & SPECIALIZED ASSETS SCHEMA CONSOLIDATION
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- =============================================================================

-- 1. جدول الأصول البلدية الرأسمالية والآليات والمركبات (Municipal Capital Assets & Fleet)
CREATE TABLE IF NOT EXISTS public.municipal_assets (
  id VARCHAR(100) PRIMARY KEY,
  asset_number VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  asset_category VARCHAR(100) DEFAULT 'HEAVY_MACHINERY',
  category VARCHAR(100),
  purchase_cost NUMERIC(15, 2) DEFAULT 0,
  salvage_value NUMERIC(15, 2) DEFAULT 0,
  purchase_date DATE,
  purchase_year INT,
  department VARCHAR(150),
  department_id VARCHAR(100),
  plate_number VARCHAR(50),
  serial_number VARCHAR(100),
  custodian_name VARCHAR(150),
  operational_status VARCHAR(50) DEFAULT 'ACTIVE',
  condition_status VARCHAR(50) DEFAULT 'GOOD',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_municipal_assets_category ON public.municipal_assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_municipal_assets_status ON public.municipal_assets(operational_status);
CREATE INDEX IF NOT EXISTS idx_municipal_assets_dept ON public.municipal_assets(department_id);

-- 2. جدول الأصول التخصصية وسجل التكامل (Specialized Assets Registry)
CREATE TABLE IF NOT EXISTS public.specialized_assets (
  id VARCHAR(100) PRIMARY KEY,
  asset_number VARCHAR(100) UNIQUE,
  asset_category VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  operational_status VARCHAR(50) DEFAULT 'ACTIVE',
  specs JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_specialized_assets_category ON public.specialized_assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_specialized_assets_status ON public.specialized_assets(operational_status);

-- 3. تأكيد الفهارس المكانية المكفولة لشبكات وأصول الـ GIS
CREATE INDEX IF NOT EXISTS idx_structural_assets_geom ON public.structural_assets USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_infrastructure_networks_geom ON public.infrastructure_networks USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_energy_assets_geom ON public.energy_assets USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_excavation_permits_geom ON public.excavation_permits USING GIST(geom);
