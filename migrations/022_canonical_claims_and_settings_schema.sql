-- =============================================================================
-- migrations/022_canonical_claims_and_settings_schema.sql
-- 🏛️ إضفاء الطابع الكنوني المعتمد على مخطط المطالبات المالية وهوية النظام
-- نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
--
-- الهدف:
-- 1. القضاء التام على Runtime DDL في Tenders/API/claimsEngine.js و Settings/API/systemSettings.js
-- 2. إثبات وتوحيد جداول public.system_identity و public.claims رسمياً عبر Migration نسخي
-- 3. ضمان استيفاء كافة الحقول والمحددات الفنية والهندسية والمالية بدون أي مخاطرة أو كسر للتوافقية.
-- =============================================================================

-- 1. جدول هوية النظام والإعدادات البلدية الكنونية (public.system_identity)
CREATE TABLE IF NOT EXISTS public.system_identity (
  id INT PRIMARY KEY DEFAULT 1,
  app_title VARCHAR(255) DEFAULT 'نظام إدارة المشاريع والأشغال الهندسية',
  municipality_name VARCHAR(255) DEFAULT 'بلدية كفرنجة الجديدة',
  directorate_name VARCHAR(255) DEFAULT 'مديرية الأشغال والخدمات الهندسية',
  primary_color VARCHAR(50) DEFAULT '#0f766e',
  secondary_color VARCHAR(50) DEFAULT '#0284c7',
  accent_color VARCHAR(50) DEFAULT '#10b981',
  background_color VARCHAR(50) DEFAULT '#0f172a',
  border_radius_px INT DEFAULT 12,
  dark_mode_enabled BOOLEAN DEFAULT true,
  session_timeout_minutes INT DEFAULT 15,
  header_logo_b64 TEXT,
  logo_path TEXT DEFAULT '/logo.jpg',
  watermark_text TEXT DEFAULT 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة',
  watermark_logo_b64 TEXT,
  contact_phone VARCHAR(50) DEFAULT '02-6466001',
  contact_email VARCHAR(100) DEFAULT 'info@kafrinja.gov.jo',
  fiscal_year VARCHAR(20) DEFAULT '2026',
  currency VARCHAR(10) DEFAULT 'JOD',
  custom_css TEXT,
  theme_variables JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- السقوف المالية والضوابط المحاسبية
  max_variation_order_pct DOUBLE PRECISION DEFAULT 25.0,
  performance_bond_pct DOUBLE PRECISION DEFAULT 10.0,
  advance_payment_guarantee_pct DOUBLE PRECISION DEFAULT 10.0,
  max_advance_payment_pct DOUBLE PRECISION DEFAULT 10.0,
  maintenance_guarantee_pct DOUBLE PRECISION DEFAULT 5.0,
  maintenance_period_months INT DEFAULT 12,
  daily_penalty_rate_pct DOUBLE PRECISION DEFAULT 0.1,
  max_delay_penalties_pct DOUBLE PRECISION DEFAULT 15.0,
  default_retention_pct DOUBLE PRECISION DEFAULT 10.0,
  income_tax_withholding_pct DOUBLE PRECISION DEFAULT 0.0,
  revenue_stamps_pct DOUBLE PRECISION DEFAULT 0.6,
  contractors_syndicate_pct DOUBLE PRECISION DEFAULT 0.2,
  advance_recovery_rate_pct DOUBLE PRECISION DEFAULT 10.0,

  -- المعايير الهندسية وأسعار إعادة الأوضاع
  paving_unit_rate_jod DOUBLE PRECISION DEFAULT 4.5,
  curbstone_unit_rate_jod DOUBLE PRECISION DEFAULT 6.0,
  interlock_unit_rate_jod DOUBLE PRECISION DEFAULT 8.5,
  asphalt_reinstatement_rate_jod DOUBLE PRECISION DEFAULT 18.0,
  basecourse_reinstatement_rate_jod DOUBLE PRECISION DEFAULT 8.0,
  permit_admin_fee_jod DOUBLE PRECISION DEFAULT 15.0,
  excavation_insurance_rate_jod DOUBLE PRECISION DEFAULT 25.0,

  -- محددات جودة الطرق والخلطات الإسفلتية
  pci_excellent_min INT DEFAULT 85,
  pci_good_min INT DEFAULT 70,
  pci_fair_min INT DEFAULT 55,
  pci_poor_min INT DEFAULT 40,
  default_asphalt_thickness_cm DOUBLE PRECISION DEFAULT 5.0,
  asphalt_delivery_temp_min_c INT DEFAULT 145,
  min_compaction_rate_pct DOUBLE PRECISION DEFAULT 98.0,
  concrete_slump_target_cm DOUBLE PRECISION DEFAULT 8.0,

  -- الأعمار الافتراضية للأصول البلدية
  roads_useful_life_years INT DEFAULT 15,
  bridges_useful_life_years INT DEFAULT 40,
  machinery_useful_life_years INT DEFAULT 10,
  lighting_useful_life_years INT DEFAULT 7,
  asset_salvage_value_pct DOUBLE PRECISION DEFAULT 10.0,

  -- بادئات الترقيم المعتمدة
  prefix_tenders VARCHAR(50) DEFAULT 'TEN-',
  prefix_claims VARCHAR(50) DEFAULT 'CLM-',
  prefix_permits VARCHAR(50) DEFAULT 'PER-',
  prefix_paving VARCHAR(50) DEFAULT 'PAV-',
  prefix_tasks VARCHAR(50) DEFAULT 'TSK-',
  prefix_contracts VARCHAR(50) DEFAULT 'CNT-',

  -- إعدادات التنبيهات والنظام والنسخ الاحتياطي
  guarantee_alert_days VARCHAR(100) DEFAULT '30,15,7',
  project_delay_threshold_pct DOUBLE PRECISION DEFAULT 15.0,
  auto_backup_enabled BOOLEAN DEFAULT true,
  auto_backup_time VARCHAR(20) DEFAULT '02:00',

  -- إعدادات الخرائط ونظام GIS
  gis_center_lat DOUBLE PRECISION DEFAULT 32.3025,
  gis_center_lng DOUBLE PRECISION DEFAULT 35.7008,
  gis_default_zoom INT DEFAULT 14,
  gis_map_layer VARCHAR(50) DEFAULT 'osm',

  -- الأختام والتواقيع الرقمية
  director_stamp_b64 TEXT,
  municipality_seal_b64 TEXT,
  verification_portal_url VARCHAR(255) DEFAULT '/verify.html',

  -- سقوف صلاحيات الشراء واللجان
  mayor_purchase_ceiling_jod DOUBLE PRECISION DEFAULT 5000.0,
  local_committee_ceiling_jod DOUBLE PRECISION DEFAULT 20000.0,
  main_committee_ceiling_jod DOUBLE PRECISION DEFAULT 100000.0,
  direct_purchase_ceiling_jod DOUBLE PRECISION DEFAULT 3000.0,
  quotation_request_ceiling_jod DOUBLE PRECISION DEFAULT 15000.0,
  limited_tender_ceiling_jod DOUBLE PRECISION DEFAULT 50000.0,
  enforce_committee_ceilings BOOLEAN DEFAULT true
);

-- إدراج السجل الافتراضي لهوية النظام إذا لم يكن موجوداً
INSERT INTO public.system_identity (id, app_title, municipality_name, directorate_name)
VALUES (1, 'نظام إدارة المشاريع والأشغال الهندسية الموحد', 'بلدية كفرنجة الجديدة', 'مديرية الأشغال والخدمات الهندسية')
ON CONFLICT (id) DO NOTHING;

-- 2. جدول المطالبات المالية الموحد (public.claims)
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS contractor VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "claimNumber" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "claimType" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "previousPayments" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "previousPaid" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completionPercentage" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completionPercent" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retentionPercentage" DOUBLE PRECISION DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "retentionPercent" DOUBLE PRECISION DEFAULT 10,
  ADD COLUMN IF NOT EXISTS retention DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "advanceDeduction" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxDeduction" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherDeductions" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netPayable" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netAmount" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossCumulative" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "submissionDate" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "submitDate" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "attachmentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalStage" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "boqItems" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- إنشاء فهارس الأداء على جدول المطالبات
CREATE INDEX IF NOT EXISTS idx_claims_tender_id ON public.claims ("tenderId");
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims (status);
