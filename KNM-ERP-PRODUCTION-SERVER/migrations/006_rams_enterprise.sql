-- ====================================================================
-- SCRIPT: 006_rams_enterprise.sql
-- DESCRIPTION: Road Asset Management System (RAMS Enterprise) Schema
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. جدول الطرق والمقاطع الرئيسي (Roads & Segments - RAMS)
CREATE TABLE IF NOT EXISTS public.rams_roads (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,       -- رقم/كود الطريق
  name VARCHAR(255) NOT NULL,              -- اسم الطريق
  category VARCHAR(100),                   -- التصنيف (رئيسي، فرعي، شرياني)
  length_km DOUBLE PRECISION,              -- الطول الإجمالي
  width_m DOUBLE PRECISION,                -- العرض بالأمتار
  lanes_count INT DEFAULT 2,               -- عدد المسارات/الحارات
  surface_condition VARCHAR(100),          -- حالة الرصف
  construction_year INT,                   -- سنة الإنشاء
  last_maintenance_date DATE,              -- آخر صيانة
  pci_index DOUBLE PRECISION CHECK (pci_index BETWEEN 0 AND 100), -- مؤشر PCI
  iri_index DOUBLE PRECISION,              -- مؤشر الوعورة IRI
  aadt_volume INT DEFAULT 0,               -- المرور اليومي AADT
  images JSONB DEFAULT '[]'::jsonb,        -- الصور قبل وبعد التنفيذ
  documents JSONB DEFAULT '[]'::jsonb,     -- المستندات المرفقة
  geom GEOMETRY(MultiLineString, 4326),    -- رسم الطريق بالكامل Polyline
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول تقسيم الطرق إلى مقاطع (Road Segments & Chainage)
CREATE TABLE IF NOT EXISTS public.rams_segments (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(50) REFERENCES public.rams_roads(id) ON DELETE CASCADE,
  segment_code VARCHAR(100),               -- كود المقطع
  start_chainage DOUBLE PRECISION NOT NULL,-- بداية المقطع بالـ Chainage (مثال: 0+000)
  end_chainage DOUBLE PRECISION NOT NULL,  -- نهاية المقطع بالـ Chainage
  lanes_detail JSONB DEFAULT '{}'::jsonb,  -- تحديد الحارات والمسارات
  geom GEOMETRY(LineString, 4326),         -- مسار المقطع الجغرافي
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول التقاطعات والأصول الملحقة (Intersections & Assets)
CREATE TABLE IF NOT EXISTS public.rams_intersections (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  intersection_type VARCHAR(100),          -- نوع التقاطع (دوار، إشارة، تقاطع سطحي)
  geom GEOMETRY(Point, 4326),              -- الموقع المكاني
  attributes JSONB DEFAULT '{}'::jsonb
);

-- 4. سجل تاريخ أعمال الصيانة، الحفريات، والعقود المباشرة
CREATE TABLE IF NOT EXISTS public.rams_maintenance_history (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(50) REFERENCES public.rams_roads(id) ON DELETE CASCADE,
  project_id VARCHAR(50),                  -- ربط بالمشروع/العقد
  contractor_name VARCHAR(255),            -- المقاول المنفذ
  cost_amount DOUBLE PRECISION,            -- الكلفة
  work_type VARCHAR(100),                  -- (صيانة، حفريات، كشط وتعبيد)
  complaint_id VARCHAR(50),                -- ربط بالشكاوى
  photos_before JSONB DEFAULT '[]'::jsonb, -- الصور قبل التنفيذ
  photos_after JSONB DEFAULT '[]'::jsonb,  -- الصور بعد التنفيذ
  execution_date DATE NOT NULL
);

-- Indexes for GIS Spatial Queries
CREATE INDEX IF NOT EXISTS idx_rams_roads_geom ON public.rams_roads USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rams_segments_geom ON public.rams_segments USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rams_intersections_geom ON public.rams_intersections USING GIST(geom);
