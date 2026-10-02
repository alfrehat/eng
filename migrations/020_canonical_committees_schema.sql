-- migrations/020_canonical_committees_schema.sql
-- 🏛️ المنظومة الموحدة لبيانات اللجان الفنية ومحاضر الاستلام ودراسة العطاءات
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- Canonical Committees & Tender Studies Schema

-- 1. جدول اللجان الفنية ومحاضر الاستلام (Canonical Technical Committees & Handover Protocols)
CREATE TABLE IF NOT EXISTS public.technical_committees (
  id VARCHAR(50) PRIMARY KEY,
  committee_number VARCHAR(100),
  report_number VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  report_type VARCHAR(100) NOT NULL DEFAULT 'INITIAL_HANDOVER',
  committee_type VARCHAR(100) DEFAULT 'HANDOVER',
  tender_id VARCHAR(50),
  tender_name VARCHAR(255),
  project_id VARCHAR(50),
  contractor VARCHAR(255),
  project_cost NUMERIC(15,2) DEFAULT 0.00,
  formation_order_number VARCHAR(100),
  formation_order_date DATE,
  inspection_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
  completion_percentage NUMERIC(5,2) DEFAULT 100.00,
  recommendation TEXT,
  committee_members JSONB DEFAULT '[]'::jsonb,
  members JSONB DEFAULT '[]'::jsonb,
  punch_list JSONB DEFAULT '[]'::jsonb,
  minutes JSONB DEFAULT '[]'::jsonb,
  lab_tests TEXT,
  guarantee_period_months INTEGER DEFAULT 12,
  guarantee_end_date DATE,
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- الفهارس الحيوية للجان
CREATE INDEX IF NOT EXISTS idx_technical_committees_status ON public.technical_committees(status);
CREATE INDEX IF NOT EXISTS idx_technical_committees_type ON public.technical_committees(report_type);
CREATE INDEX IF NOT EXISTS idx_technical_committees_tender ON public.technical_committees(tender_id);
CREATE INDEX IF NOT EXISTS idx_technical_committees_project ON public.technical_committees(project_id);

-- 2. جدول دراسة العطاءات وتقييم العروض المقدمة (Canonical Tender Studies & Bid Evaluations)
CREATE TABLE IF NOT EXISTS public.tender_studies (
  id VARCHAR(50) PRIMARY KEY,
  report_number VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  tender_id VARCHAR(50),
  tender_name VARCHAR(255),
  estimated_cost NUMERIC(15,2) DEFAULT 0.00,
  formation_order_number VARCHAR(100),
  formation_order_date DATE,
  session_date DATE,
  opening_session_number VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'RECOMMENDED_AWARD',
  bids JSONB DEFAULT '[]'::jsonb,
  recommendation TEXT,
  committee_members JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tender_studies_status ON public.tender_studies(status);
CREATE INDEX IF NOT EXISTS idx_tender_studies_tender ON public.tender_studies(tender_id);

-- 3. واجهة توافق عكسي (Backward Compatibility View for committee_reports)
CREATE OR REPLACE VIEW public.committee_reports AS
SELECT * FROM public.technical_committees;
