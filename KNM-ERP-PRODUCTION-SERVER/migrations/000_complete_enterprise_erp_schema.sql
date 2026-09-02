-- ====================================================================
-- KAFR INJA ENGINEERING ERP - UNIFIED SCHEMA MIGRATION V4.0
-- SCRIPT: 000_complete_enterprise_erp_schema.sql
-- DESCRIPTION: الإنتاج الشامل لجميع الجداول، العلاقات، القيود، الفهارس، 
--             المستخدمين الافتراضيين، الصلاحيات، والبيانات التأسيسية.
-- ====================================================================

-- 1. تفعيل الامتدادات والمخططات المؤسسية
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS enterprise;
CREATE SCHEMA IF NOT EXISTS public;

-- ====================================================================
-- 2. جداول النظام الأساسية (Core ERP Tables)
-- ====================================================================

-- 2.1 جدول الأدوار (Roles)
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 جدول الصلاحيات (Permissions)
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  module VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 جدول ربط الأدوار بالصلاحيات (Role-Permissions Matrix)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 2.4 جدول المستخدمين (Users)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  permissions TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 2.5 جدول العطاءات والمشاريع (Tenders)
CREATE TABLE IF NOT EXISTS tenders (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  status VARCHAR(100),
  budget DOUBLE PRECISION DEFAULT 0,
  value DOUBLE PRECISION DEFAULT 0,
  "startDate" DATE,
  "endDate" DATE,
  contractor VARCHAR(255),
  details TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.6 جدول المطالبات والمالية (Claims)
CREATE TABLE IF NOT EXISTS claims (
  id VARCHAR(50) PRIMARY KEY,
  "tenderId" VARCHAR(50) REFERENCES tenders(id) ON DELETE SET NULL,
  claimant VARCHAR(255),
  amount DOUBLE PRECISION DEFAULT 0,
  deduction DOUBLE PRECISION DEFAULT 0,
  type VARCHAR(100),
  status VARCHAR(100),
  history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS "tenderId" VARCHAR(50) REFERENCES tenders(id) ON DELETE SET NULL;

-- 2.7 جدول أوامر الشراء (Purchases)
CREATE TABLE IF NOT EXISTS purchases (
  id VARCHAR(50) PRIMARY KEY,
  supplier VARCHAR(255),
  amount DOUBLE PRECISION DEFAULT 0,
  "itemDescription" TEXT,
  status VARCHAR(100),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.8 جدول المهام والطلبات الميدانية (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  "appealNumber" VARCHAR(100),
  "appealDate" VARCHAR(50),
  "citizenName" VARCHAR(255),
  "citizenPhone" VARCHAR(50),
  "assignedTo" VARCHAR(50),
  "assignedBy" VARCHAR(50),
  status VARCHAR(50) DEFAULT 'جديدة',
  priority VARCHAR(50) DEFAULT 'عادي',
  "dueDate" DATE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "reportTemplate" VARCHAR(100),
  "reportText" TEXT,
  "reportDate" VARCHAR(50),
  "reportFile" VARCHAR(255),
  comments JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.9 جدول إعدادات النظام الموحدة (System Settings)
CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(50) PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.10 جدول سجل النشاطات (Activity Log)
CREATE TABLE IF NOT EXISTS activity_log (
  id VARCHAR(50) PRIMARY KEY,
  "userId" VARCHAR(50),
  action VARCHAR(100),
  entity VARCHAR(100),
  "entityId" VARCHAR(50),
  details TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 3. جداول شبكة الطرق والبنية التحتية (Roads, PMS & RAMS)
-- ====================================================================

-- 3.1 جدول الطرق الرئيسي (Roads)
CREATE TABLE IF NOT EXISTS roads (
  id VARCHAR(100) PRIMARY KEY,
  code VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  classification VARCHAR(100) DEFAULT 'فرعي',
  category VARCHAR(100) DEFAULT 'فرعي',
  length_km DOUBLE PRECISION DEFAULT 0.0,
  "lengthKm" DOUBLE PRECISION DEFAULT 0.0,
  width_m DOUBLE PRECISION DEFAULT 0.0,
  "widthMeters" DOUBLE PRECISION DEFAULT 0.0,
  surface_type VARCHAR(100) DEFAULT 'خلطة ساخنة',
  "surfaceType" VARCHAR(100) DEFAULT 'خلطة ساخنة',
  pci_score DOUBLE PRECISION DEFAULT 85.0 CHECK (pci_score BETWEEN 0 AND 100),
  "conditionIndex" DOUBLE PRECISION DEFAULT 85.0,
  last_maintenance_date DATE,
  lanes INT DEFAULT 2,
  lanes_count INT DEFAULT 2,
  "lanesCount" INT DEFAULT 2,
  total_cost_estimate DOUBLE PRECISION DEFAULT 0.0,
  surveying_status VARCHAR(50) DEFAULT 'SURVEYED',
  spatial_layer_type VARCHAR(50) DEFAULT 'POLYLINE',
  "geoJson" TEXT,
  geom GEOMETRY(LineString, 4326),
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 جدول فحوصات حالة الطرق (Pavement Inspections - PMS)
CREATE TABLE IF NOT EXISTS pavement_inspections (
  inspection_id VARCHAR(100) PRIMARY KEY,
  road_id VARCHAR(100) NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
  inspection_date DATE DEFAULT CURRENT_DATE,
  defect_type VARCHAR(150) NOT NULL,
  severity VARCHAR(50),
  recommended_action VARCHAR(255),
  pci_impact DOUBLE PRECISION DEFAULT 0.0,
  inspector_name VARCHAR(150),
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 جدول أولويات صيانة الطرق (Road Priorities)
CREATE TABLE IF NOT EXISTS road_priorities (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(100) REFERENCES roads(id) ON DELETE CASCADE,
  traffic_volume_score INT DEFAULT 1,
  vital_facilities_score INT DEFAULT 1,
  complaints_score INT DEFAULT 0,
  calculated_priority_score DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) DEFAULT 'QUEUED_FOR_MAINTENANCE',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.4 جدول أثاث جانب الطريق والأصول المساندة (Road Side Assets)
CREATE TABLE IF NOT EXISTS road_side_assets (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(100) REFERENCES roads(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL,
  condition_status VARCHAR(50) DEFAULT 'GOOD',
  geom GEOMETRY(Point, 4326),
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.5 جدول النقاط والمقاطع المساحية (Road Survey Points)
CREATE TABLE IF NOT EXISTS road_survey_points (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(100) REFERENCES roads(id) ON DELETE SET NULL,
  point_code VARCHAR(100),
  elevation_m DOUBLE PRECISION,
  srid_code INT DEFAULT 4326,
  geom GEOMETRY(Point, 4326),
  raw_properties JSONB DEFAULT '{}'::jsonb,
  uploaded_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.6 جداول RAMS Enterprise (RAMS Roads, Segments, Intersections, Maintenance)
CREATE TABLE IF NOT EXISTS public.rams_roads (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  length_km DOUBLE PRECISION,
  width_m DOUBLE PRECISION,
  lanes_count INT DEFAULT 2,
  surface_condition VARCHAR(100),
  construction_year INT,
  last_maintenance_date DATE,
  pci_index DOUBLE PRECISION CHECK (pci_index BETWEEN 0 AND 100),
  iri_index DOUBLE PRECISION,
  aadt_volume INT DEFAULT 0,
  images JSONB DEFAULT '[]'::jsonb,
  documents JSONB DEFAULT '[]'::jsonb,
  geom GEOMETRY(MultiLineString, 4326),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.rams_segments (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(50) REFERENCES public.rams_roads(id) ON DELETE CASCADE,
  segment_code VARCHAR(100),
  start_chainage DOUBLE PRECISION NOT NULL,
  end_chainage DOUBLE PRECISION NOT NULL,
  lanes_detail JSONB DEFAULT '{}'::jsonb,
  geom GEOMETRY(LineString, 4326),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.rams_intersections (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  intersection_type VARCHAR(100),
  geom GEOMETRY(Point, 4326),
  attributes JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.rams_maintenance_history (
  id VARCHAR(50) PRIMARY KEY,
  road_id VARCHAR(50) REFERENCES public.rams_roads(id) ON DELETE CASCADE,
  project_id VARCHAR(50),
  contractor_name VARCHAR(255),
  cost_amount DOUBLE PRECISION,
  work_type VARCHAR(100),
  complaint_id VARCHAR(50),
  photos_before JSONB DEFAULT '[]'::jsonb,
  photos_after JSONB DEFAULT '[]'::jsonb,
  execution_date DATE NOT NULL
);

-- ====================================================================
-- 4. جداول العقود، الكفالات وعوائد التعبيد (Contracts & Guarantees)
-- ====================================================================

-- 4.1 أنواع العقود (Contract Types)
CREATE TABLE IF NOT EXISTS public.contract_types (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_terms JSONB DEFAULT '{}'::jsonb,
  required_guarantees JSONB DEFAULT '[]'::jsonb,
  required_attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 قوالب العقود (Contract Templates)
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id VARCHAR(50) PRIMARY KEY,
  contract_type_id VARCHAR(50) REFERENCES public.contract_types(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  content_html TEXT NOT NULL,
  placeholders JSONB DEFAULT '[]'::jsonb,
  header_html TEXT,
  footer_html TEXT,
  style_css TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.3 جدول العقود الرئيسي (Contracts)
CREATE TABLE IF NOT EXISTS public.contracts (
  id VARCHAR(50) PRIMARY KEY,
  procurement_type VARCHAR(50) DEFAULT 'TENDER',
  procurement_id VARCHAR(50),
  contract_type_id VARCHAR(50) REFERENCES public.contract_types(id) ON DELETE SET NULL,
  tender_id VARCHAR(50) REFERENCES tenders(id) ON DELETE SET NULL,
  contract_number VARCHAR(100),
  award_decision_number VARCHAR(100),
  award_date DATE,
  title VARCHAR(255) NOT NULL,
  contractor_id VARCHAR(50),
  contractor_name VARCHAR(255),
  total_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  execution_period_days INT DEFAULT 30,
  start_date DATE,
  end_date DATE,
  department VARCHAR(150),
  funding_source VARCHAR(150),
  supervising_engineer VARCHAR(150),
  handover_committee JSONB DEFAULT '[]'::jsonb,
  guarantee_percentage DOUBLE PRECISION DEFAULT 10,
  first_party_info JSONB DEFAULT '{}'::jsonb,
  second_party_info JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'DRAFT',
  workflow_history JSONB DEFAULT '[]'::jsonb,
  digital_signatures JSONB DEFAULT '[]'::jsonb,
  sha256_hash VARCHAR(64),
  guarantees JSONB DEFAULT '[]'::jsonb,
  terms JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.4 بنود العقود (Contract Clauses)
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id VARCHAR(50) PRIMARY KEY,
  contract_id VARCHAR(50) REFERENCES public.contracts(id) ON DELETE CASCADE,
  clause_number INT NOT NULL,
  clause_code VARCHAR(50),
  title VARCHAR(255),
  content TEXT NOT NULL,
  display_order INT DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT TRUE,
  is_optional BOOLEAN DEFAULT FALSE,
  show_in_print BOOLEAN DEFAULT TRUE,
  show_in_electronic BOOLEAN DEFAULT TRUE,
  contract_type_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.5 الكفالات والضمانات البنكية (Bank Guarantees)
CREATE TABLE IF NOT EXISTS public.bank_guarantees (
  id VARCHAR(50) PRIMARY KEY,
  contract_id VARCHAR(50) REFERENCES public.contracts(id) ON DELETE CASCADE,
  guarantee_type VARCHAR(50) NOT NULL,
  guarantee_number VARCHAR(100) NOT NULL,
  issuing_bank VARCHAR(255) NOT NULL,
  bank_branch VARCHAR(255),
  amount DOUBLE PRECISION NOT NULL,
  percentage DOUBLE PRECISION DEFAULT 0,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  pdf_path VARCHAR(550),
  qr_code_data TEXT,
  barcode_data VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.6 أوامر التغيير للعقود (Contract Variation Orders)
CREATE TABLE IF NOT EXISTS public.contract_variation_orders (
  id VARCHAR(50) PRIMARY KEY,
  contract_id VARCHAR(50) REFERENCES public.contracts(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  order_type VARCHAR(50) NOT NULL,
  amount_change DOUBLE PRECISION DEFAULT 0,
  time_extension_days INT DEFAULT 0,
  reason TEXT,
  approval_date DATE DEFAULT CURRENT_DATE,
  approved_by VARCHAR(50),
  status VARCHAR(50) DEFAULT 'APPROVED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.7 المطالبات المالية (Claims)
CREATE TABLE IF NOT EXISTS public.claims (
  id VARCHAR(50) PRIMARY KEY,
  tender_id VARCHAR(50),
  "tenderId" VARCHAR(50),
  claimant VARCHAR(255) NOT NULL,
  amount DOUBLE PRECISION DEFAULT 0,
  deduction DOUBLE PRECISION DEFAULT 0,
  type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'جديدة',
  submit_date VARCHAR(50),
  "submitDate" VARCHAR(50),
  completion_percent DOUBLE PRECISION DEFAULT 0,
  "completionPercent" DOUBLE PRECISION DEFAULT 0,
  payment_date VARCHAR(50),
  "paymentDate" VARCHAR(50),
  history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS tender_id VARCHAR(50);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS "tenderId" VARCHAR(50);

-- 4.8 المشتريات والموردين (Purchases)
CREATE TABLE IF NOT EXISTS public.purchases (
  id VARCHAR(50) PRIMARY KEY,
  supplier VARCHAR(255) NOT NULL,
  description TEXT,
  qty DOUBLE PRECISION DEFAULT 0,
  "unitPrice" DOUBLE PRECISION DEFAULT 0,
  date VARCHAR(50),
  status VARCHAR(50) DEFAULT 'جديد',
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS qty DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS "unitPrice" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS date VARCHAR(50);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'جديد';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4.9 المهام الهندسية (Tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  assignee VARCHAR(255),
  "dueDate" VARCHAR(50),
  priority VARCHAR(50) DEFAULT 'عادية',
  status VARCHAR(50) DEFAULT 'جديدة',
  description TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee VARCHAR(255);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS "dueDate" VARCHAR(50);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4.10 الهيكل التنظيمي والأدوار والصلاحيات (Org Units & Roles)
CREATE TABLE IF NOT EXISTS public.org_units (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) DEFAULT 'DEPARTMENT',
  "parentId" VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.roles ALTER COLUMN code DROP NOT NULL;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS label VARCHAR(255);
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS public.user_org_units (
  id VARCHAR(50) PRIMARY KEY,
  "userId" VARCHAR(50),
  userid VARCHAR(50),
  user_id VARCHAR(50),
  "orgUnitId" VARCHAR(50),
  orgunitid VARCHAR(50),
  org_unit_id VARCHAR(50),
  "roleId" VARCHAR(50),
  roleid VARCHAR(50),
  role_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS "userId" VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS userid VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS "orgUnitId" VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS orgunitid VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS org_unit_id VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS "roleId" VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS roleid VARCHAR(50);
ALTER TABLE public.user_org_units ADD COLUMN IF NOT EXISTS role_id VARCHAR(50);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id VARCHAR(50) PRIMARY KEY,
  "roleId" VARCHAR(50),
  roleid VARCHAR(50),
  role_id VARCHAR(50),
  "permissionId" VARCHAR(100),
  permissionid VARCHAR(100),
  permission_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS id VARCHAR(50);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS "roleId" VARCHAR(50);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS roleid VARCHAR(50);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS role_id VARCHAR(50);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS "permissionId" VARCHAR(100);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS permissionid VARCHAR(100);
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS permission_id VARCHAR(100);
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;

-- 4.7 عوائد التعبيد (Paving Returns)
CREATE TABLE IF NOT EXISTS public.paving_returns (
  id VARCHAR(50) PRIMARY KEY,
  tender_id VARCHAR(50),
  piece_number VARCHAR(100) NOT NULL,
  basin_number VARCHAR(100) NOT NULL,
  district VARCHAR(150) NOT NULL,
  frontage_length DOUBLE PRECISION DEFAULT 0,
  paving_width DOUBLE PRECISION DEFAULT 0,
  price_per_meter DOUBLE PRECISION DEFAULT 0,
  imposition_rate DOUBLE PRECISION DEFAULT 1,
  required_amount DOUBLE PRECISION DEFAULT 0,
  pieces JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'معتمد',
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.paving_returns DROP CONSTRAINT IF EXISTS paving_returns_tender_id_fkey;

-- 4.8 الأصول الهيكلية والجدران الاستنادية (Structural Assets)
CREATE TABLE IF NOT EXISTS public.structural_assets (
  id VARCHAR(50) PRIMARY KEY,
  asset_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  condition_index DOUBLE PRECISION,
  height_meters DOUBLE PRECISION,
  floors_count INT,
  geom GEOMETRY(Geometry, 4326),
  inspection_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.9 شبكات البنية التحتية (Infrastructure Networks)
CREATE TABLE IF NOT EXISTS public.infrastructure_networks (
  id VARCHAR(50) PRIMARY KEY,
  network_type VARCHAR(50) NOT NULL,
  code VARCHAR(100) UNIQUE,
  material VARCHAR(100),
  diameter_mm DOUBLE PRECISION,
  status VARCHAR(50) DEFAULT 'OPERATIONAL',
  geom GEOMETRY(Geometry, 4326),
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 5. مخطط المؤسسة الرقمية (Enterprise Schema Objects)
-- ====================================================================

-- 5.1 جدول الهوية البصرية للبلدية
CREATE TABLE IF NOT EXISTS enterprise.system_identity (
  id INT PRIMARY KEY DEFAULT 1,
  app_title VARCHAR(255) DEFAULT 'نظام إدارة الأشغال والخدمات الهندسية',
  municipality_name VARCHAR(255) DEFAULT 'بلدية كفرنجة الجديدة',
  primary_color VARCHAR(20) DEFAULT '#1e3a8a',
  secondary_color VARCHAR(20) DEFAULT '#0d9488',
  accent_color VARCHAR(20) DEFAULT '#3b82f6',
  background_color VARCHAR(20) DEFAULT '#0f172a',
  font_family VARCHAR(100) DEFAULT 'Cairo',
  border_radius_px INT DEFAULT 8,
  dark_mode_enabled BOOLEAN DEFAULT true,
  header_logo_b64 TEXT,
  watermark_logo_b64 TEXT,
  logo_path VARCHAR(255),
  watermark_path VARCHAR(255),
  custom_css TEXT,
  theme_variables JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

-- 5.2 قوالب الطباعة التقنية
CREATE TABLE IF NOT EXISTS enterprise.print_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  module VARCHAR(50) NOT NULL,
  html_template TEXT NOT NULL,
  header_config JSONB DEFAULT '{}'::jsonb,
  footer_config JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5.3 إصدارات الوثائق الآمنة
CREATE TABLE IF NOT EXISTS enterprise.document_versions (
  id VARCHAR(50) PRIMARY KEY,
  documentId VARCHAR(50) NOT NULL,
  versionNumber INT NOT NULL,
  fileHash VARCHAR(64) NOT NULL,
  filePath VARCHAR(255) NOT NULL,
  uploadedBy VARCHAR(50) NOT NULL,
  isLocked BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5.4 التوقيعات الرقمية المعتمدة
CREATE TABLE IF NOT EXISTS enterprise.digital_signatures (
  id VARCHAR(50) PRIMARY KEY,
  documentVersionId VARCHAR(50) NOT NULL REFERENCES enterprise.document_versions(id) ON DELETE CASCADE,
  signedBy VARCHAR(50) NOT NULL,
  signature TEXT NOT NULL,
  publicKey TEXT NOT NULL,
  signedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 6. الفهارس المؤسسية لرفع كفاءة الاستعلامات (Indexes)
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
CREATE INDEX IF NOT EXISTS idx_claims_tender ON claims(tenderId);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assignedTo);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_roads_code ON roads(code);
CREATE INDEX IF NOT EXISTS idx_roads_pci ON roads(pci_score);
CREATE INDEX IF NOT EXISTS idx_pavement_inspections_road ON pavement_inspections(road_id);
CREATE INDEX IF NOT EXISTS idx_road_priorities_road ON road_priorities(road_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tender ON public.contracts(tender_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_bank_guarantees_contract ON public.bank_guarantees(contract_id);
CREATE INDEX IF NOT EXISTS idx_bank_guarantees_expiry ON public.bank_guarantees(expiry_date);
CREATE INDEX IF NOT EXISTS idx_paving_returns_tender ON public.paving_returns(tender_id);
CREATE INDEX IF NOT EXISTS idx_paving_returns_parcel ON public.paving_returns(piece_number, basin_number);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log("userId");

-- فهارس مكانية لجداول GIS
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rams_roads_geom ON public.rams_roads USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rams_segments_geom ON public.rams_segments USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_rams_intersections_geom ON public.rams_intersections USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_structural_assets_geom ON public.structural_assets USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_infrastructure_networks_geom ON public.infrastructure_networks USING GIST(geom);

-- ====================================================================
-- 7. التوابع (Functions) والتريجرات (Triggers)
-- ====================================================================

-- 7.1 حساب مؤشر PCI تلقائياً بعد الفحص
CREATE OR REPLACE FUNCTION update_road_pci_on_inspection()
RETURNS TRIGGER AS $$
DECLARE
    total_deduct NUMERIC(5,2);
    new_pci NUMERIC(5,2);
BEGIN
    SELECT COALESCE(SUM(pci_impact), 0) INTO total_deduct
    FROM pavement_inspections
    WHERE road_id = NEW.road_id;

    new_pci := GREATEST(0.00, 100.00 - total_deduct);

    UPDATE roads
    SET pci_score = new_pci,
        "conditionIndex" = new_pci,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = NEW.road_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_road_pci ON pavement_inspections;
CREATE TRIGGER trg_update_road_pci
AFTER INSERT OR UPDATE OR DELETE ON pavement_inspections
FOR EACH ROW EXECUTE FUNCTION update_road_pci_on_inspection();

-- 7.2 قفل المستندات الموقعة رقمياً
CREATE OR REPLACE FUNCTION enterprise.prevent_locked_document_mod()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.isLocked = TRUE THEN
    RAISE EXCEPTION 'ERR_DOCUMENT_LOCKED: Cannot modify or delete a signed and locked document version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_locked_doc_update ON enterprise.document_versions;
CREATE TRIGGER prevent_locked_doc_update
BEFORE UPDATE OR DELETE ON enterprise.document_versions
FOR EACH ROW
EXECUTE FUNCTION enterprise.prevent_locked_document_mod();

-- ====================================================================
-- 8. العروض المخصصة (Views)
-- ====================================================================
CREATE OR REPLACE VIEW v_roads_geojson AS
SELECT 
    r.id,
    r.code,
    r.name,
    COALESCE(r.classification, r.category) AS classification,
    COALESCE(r.length_km, r."lengthKm") AS length_km,
    COALESCE(r.width_m, r."widthMeters") AS width_m,
    COALESCE(r.surface_type, r."surfaceType") AS surface_type,
    COALESCE(r.pci_score, r."conditionIndex") AS pci_score,
    CASE 
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 85 THEN 'ممتازة (Good)'
        WHEN COALESCE(r.pci_score, r."conditionIndex") >= 60 THEN 'متوسطة (Fair)'
        ELSE 'متدهورة (Poor)'
    END AS pci_status_ar,
    r.last_maintenance_date,
    r.lanes,
    r."geoJson",
    CASE WHEN r.geom IS NOT NULL THEN ST_AsGeoJSON(r.geom) ELSE NULL END AS geom_geojson,
    r."createdAt",
    r."updatedAt"
FROM roads r;

-- ====================================================================
-- 9. البيانات التأسيسية والافتراضية للنظام (Seed Data)
-- ====================================================================

-- 9.1 الأدوار الافتراضية
INSERT INTO roles (id, code, name, description)
VALUES 
  ('role-admin', 'admin', 'مدير النظام', 'صلاحيات مطلقة لإدارة كافة مفاصل النظام'),
  ('role-engineer', 'engineer', 'مهندس المشاريع', 'إدارة وتتبع الطرق والعطاءات والمعاينات الميدانية'),
  ('role-inspector', 'inspector', 'مراقب فني', 'إدخال الفحوصات والتقرير عن حالة الرصفة'),
  ('role-auditor', 'auditor', 'مدقق مالي', 'مراجعة الكفالات، عوائد التعبيد، والمطالبات'),
  ('role-user', 'user', 'مستخدم عادي', 'صلاحيات العرض والاستعلام')
ON CONFLICT (code) DO NOTHING;

-- 9.2 الصلاحيات الأساسية
INSERT INTO permissions (id, code, name, module, description)
VALUES
  ('perm-dashboard-view', 'dashboard.view', 'عرض لوحة التحكم', 'اللوحة الرئيسية', 'إمكانية استعراض الإحصائيات الشاملة'),
  ('perm-roads-manage', 'roads.manage', 'إدارة شبكة الطرق', 'الطرق والـ GIS', 'إضافة وتعديل وحذف الطرق ورفع النقاط'),
  ('perm-tenders-manage', 'tenders.manage', 'إدارة العطاءات', 'المشاريع', 'إدارة العطاءات وأوامر الشراء والمطالبات'),
  ('perm-contracts-manage', 'contracts.manage', 'إدارة العقود والضمانات', 'العقود', 'إنشاء العقود وتوليد الكفالات البنكية'),
  ('perm-paving-returns', 'paving.returns', 'إدارة عوائد التعبيد', 'التعبيد', 'حساب وإدارة عوائد التعبيد على القطع'),
  ('perm-users-manage', 'users.manage', 'إدارة المستخدمين والصلاحيات', 'الإدارة', 'إضافة وتعديل المستخدمين وتخصيص الأدوار')
ON CONFLICT (code) DO NOTHING;

-- 9.3 ربط دور مدير النظام بكل الصلاحيات
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- 9.4 المستخدم الافتراضي (Default Admin Account)
INSERT INTO users (id, username, password, "fullName", role, permissions, "createdAt", "updatedAt")
VALUES (
  'U-001',
  'admin',
  'admin123',
  'مدير النظام الافتراضي',
  'admin',
  '*',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
UPDATE public.users SET password = 'admin123', password_hash = NULL WHERE username = 'admin';

-- حساب مهندس افتراضي
INSERT INTO users (id, username, password, "fullName", role, permissions, "createdAt", "updatedAt")
VALUES (
  'U-002',
  'engineer',
  'user123',
  'مهندس المنطقة المسؤول',
  'engineer',
  'dashboard,roads,tenders,contracts,paving',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 9.5 بيانات الهوية البصرية للبلدية
INSERT INTO enterprise.system_identity (
  id, app_title, municipality_name, primary_color, secondary_color, accent_color, background_color, font_family, border_radius_px, dark_mode_enabled
) VALUES (
  1,
  'نظام إدارة الأشغال والخدمات الهندسية',
  'بلدية كفرنجة الجديدة',
  '#1e3a8a',
  '#0d9488',
  '#3b82f6',
  '#0f172a',
  'Cairo',
  8,
  true
) ON CONFLICT (id) DO NOTHING;

-- 9.6 أنواع العقود التأسيسية
INSERT INTO public.contract_types (id, code, name, description)
VALUES
  ('ct-01', 'ROAD_CONSTRUCTION', 'عقد إنشاءات وتعبيد طرق', 'عقود التعبيد والصيانة والشوارع الإسفلتية'),
  ('ct-02', 'EQUIPMENT_SUPPLY', 'عقد توريد مواد ومعدات', 'توريد خلطات إسفلتية، عبارات خرسانية، أو شواخص'),
  ('ct-03', 'ENGINEERING_SERVICES', 'عقد خدمات هندسية واستشارية', 'الدراسات والمخططات والتصاميم الهندسية والمساحة')
ON CONFLICT (code) DO NOTHING;

-- 9.7 جداول وحدات المستخدمين والجداول الترميزية الفرعية (Lookup Tables)
CREATE TABLE IF NOT EXISTS public.user_org_units (
  id VARCHAR(50) PRIMARY KEY,
  "userId" VARCHAR(50),
  "orgUnitId" VARCHAR(50),
  "roleId" VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.project_sectors (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.tender_classifications (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.financing_sources (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.road_surface_types (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.inspection_defect_types (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.test_result_status (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.appeal_categories (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.rejection_reasons (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE
);

-- بذر البيانات الأولية للجداول الترميزية
INSERT INTO public.project_sectors (id, code, label, sort_order, is_active) VALUES
  ('sec-1', 'INFRASTRUCTURE', 'البنية التحتية والطرق', 1, true),
  ('sec-2', 'BUILDINGS', 'المباني والأصول الهيكلية', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tender_classifications (id, code, label, sort_order, is_active) VALUES
  ('tc-1', 'WORKS', 'أعمال إنشائية وتعبيد', 1, true),
  ('tc-2', 'SUPPLIES', 'توريد مواد ومعدات', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.financing_sources (id, code, label, sort_order, is_active) VALUES
  ('fs-1', 'MUNICIPAL_BUDGET', 'موازنة البلدية الذاتية', 1, true),
  ('fs-2', 'MINISTRY_GRANT', 'منح وزارة الإدارة المحلية', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.road_surface_types (id, code, label, sort_order, is_active) VALUES
  ('rst-1', 'HOT_MIX_ASPHALT', 'خلطة إسفلتية ساخنة', 1, true),
  ('rst-2', 'CONCRETE_PAVEMENT', 'بلاط خرساني وتعبيد جزئي', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inspection_defect_types (id, code, label, sort_order, is_active) VALUES
  ('idt-1', 'POTHOLING', 'حفر وتخسفات إسفلتية', 1, true),
  ('idt-2', 'CRACKING', 'تصدعات وشقوق طولية', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.test_result_status (id, code, label, sort_order, is_active) VALUES
  ('trs-1', 'PASS', 'مطابق للمواصفات الرسمية', 1, true),
  ('trs-2', 'FAIL', 'غير مطابق للمواصفات', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.appeal_categories (id, code, label, sort_order, is_active) VALUES
  ('ac-1', 'AMOUNT_APPEAL', 'اعتراض على قيمة العوائد', 1, true),
  ('ac-2', 'BOUNDARY_APPEAL', 'اعتراض على الحدود والأطوال', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rejection_reasons (id, code, label, sort_order, is_active) VALUES
  ('rr-1', 'INCOMPLETE_DOCS', 'نقص وثائق أو مخططات مساحية', 1, true),
  ('rr-2', 'OUT_OF_SCOPE', 'خارج نطاق التنظيم والبلدية', 2, true)
ON CONFLICT (id) DO NOTHING;

-- 9.8 جداول الوحدات التطبيقية المفقودة (Application Module Tables)
CREATE TABLE IF NOT EXISTS public.excavation_permits (
  id VARCHAR(50) PRIMARY KEY,
  permit_number VARCHAR(100),
  applicant_name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  location_description TEXT,
  excavation_length DOUBLE PRECISION DEFAULT 0,
  excavation_width DOUBLE PRECISION DEFAULT 0,
  surface_type VARCHAR(100),
  start_date DATE,
  end_date DATE,
  insurance_amount DOUBLE PRECISION DEFAULT 0,
  fee_amount DOUBLE PRECISION DEFAULT 0,
  status VARCHAR(50) DEFAULT 'معتمد',
  reinstatement_status VARCHAR(50) DEFAULT 'قيد المتابعة',
  notes TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.energy_lighting (
  id VARCHAR(50) PRIMARY KEY,
  unit_code VARCHAR(100),
  district VARCHAR(150) NOT NULL,
  street_name VARCHAR(255),
  fixture_type VARCHAR(100) DEFAULT 'LED 150W',
  pole_count INT DEFAULT 1,
  lamp_count INT DEFAULT 1,
  wattage INT DEFAULT 150,
  status VARCHAR(50) DEFAULT 'عاملة',
  last_maintenance DATE,
  transformer_code VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id VARCHAR(50) PRIMARY KEY,
  tender_id VARCHAR(50),
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  contractor_name VARCHAR(255) NOT NULL,
  value DOUBLE PRECISION DEFAULT 0,
  guarantee_amount DOUBLE PRECISION DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'ساري',
  contract_type VARCHAR(100) DEFAULT 'عقد تنفيذ أعمال',
  supervising_engineer VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.archive (
  id VARCHAR(50) PRIMARY KEY,
  doc_number VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  year INT DEFAULT 2026,
  file_name VARCHAR(255),
  file_path TEXT,
  file_size INT DEFAULT 0,
  tags VARCHAR(255),
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- بذر البيانات الأولية للوحدات المتبقية
INSERT INTO public.excavation_permits (id, permit_number, applicant_name, entity_type, location_description, excavation_length, excavation_width, surface_type, start_date, end_date, insurance_amount, fee_amount, status, reinstatement_status, notes, created_by) VALUES
  ('EPM-2026-001', 'PERM-2026-101', 'شركة مياه اليرموك', 'خدمات مياه', 'شارع الحي الشرقي الرئيسي - كفرنجة', 120, 1.2, 'إسفلت ساخن', '2026-07-01', '2026-07-15', 500, 150, 'معتمد', 'تم إعادة التعبيد', 'تم الفحص والموافقة الميدانية', 'U-001'),
  ('EPM-2026-002', 'PERM-2026-102', 'شركة الاتصالات الأردنية', 'اتصالات وألياف', 'حي نخلة - قرب مدرسة البنات', 350, 0.8, 'خلطة باردة', '2026-07-10', '2026-07-25', 1000, 300, 'معتمد', 'قيد الصيانة', 'تأمين سلامة المرور والدحرجة', 'U-001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.structural_assets (id, asset_type, name, district, condition_index, height_meters, floors_count, inspection_history) VALUES
  ('SA-2026-01', 'جدار استنادي', 'جدار استنادي خرساني - طريق قلعة كفرنجة', 'حي القلعة', 92, 4.5, 1, '[]'::jsonb),
  ('SA-2026-02', 'عبارة تصريف', 'عبارة صندوقية مزدوجة - وادي كفرنجة', 'وسط البلد', 88, 2.0, 1, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.infrastructure_networks (id, network_type, code, material, diameter_mm, status, attributes) VALUES
  ('INF-2026-01', 'تصريف مياه أمطار', 'NET-RAIN-01', 'خرسانة دائرية', 800, 'عاملة', '{}'::jsonb),
  ('INF-2026-02', 'شبكة إنارة شوارع', 'NET-LIGHT-02', 'كوابل أرضية وأعمدة', 0, 'عاملة', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.energy_lighting (id, unit_code, district, street_name, fixture_type, pole_count, lamp_count, wattage, status, last_maintenance, transformer_code, notes) VALUES
  ('EL-2026-01', 'EL-UNIT-101', 'حي نخلة', 'شارع القلعة الرئيسي', 'LED 150W High Bay', 45, 45, 150, 'عاملة', '2026-07-20', 'TR-NK-01', 'استبدال الصوديوم بالـ LED التوفيري'),
  ('EL-2026-02', 'EL-UNIT-102', 'حي الزهور', 'شارع مدرسة الحرس', 'LED 100W Standard', 30, 30, 100, 'عاملة', '2026-07-22', 'TR-ZH-03', 'جاهزة ومربوطة على المؤقت الآلي')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contracts (id, tender_id, contract_number, title, contractor_name, total_value, start_date, end_date, status, supervising_engineer) VALUES
  ('CNT-2026-001', 'T-2026-001', 'CT-2026-1001', 'اتفاقية تنفيذ مشروع خلطة إسفلتية ساخنة وتعبيد شوارع كفرنجة', 'شركة الاختبار للمقاولات العامة', 75000, '2026-07-01', '2026-09-01', 'ساري', 'م. أحمد الخشمان'),
  ('CNT-2026-002', 'T-2026-002', 'CT-2026-1002', 'عقد توريد خلطات إسفلتية وآليات كشط', 'مؤسسة الشمال للإنشاءات والتعهيدات', 28000, '2026-07-10', '2026-08-30', 'ساري', 'م. خالد بني نصر')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.archive (id, doc_number, title, category, year, file_name, file_path, file_size, tags, created_by) VALUES
  ('ARC-2026-01', 'DOC-2026-001', 'المخطط الطبوغرافي والتنظيمي لحي نخلة وحي الزهور', 'مخططات مساحية', 2026, 'nakhlah_plan_2026.pdf', 'uploads/nakhlah_plan_2026.pdf', 1450200, 'مخططات, تنظيم, نخلة', 'U-001'),
  ('ARC-2026-02', 'DOC-2026-002', 'محضر استلام موقع عطاء تعبيد شوارع كفرنجة T-2026-001', 'محاضر استلام', 2026, 'handover_t2026_001.pdf', 'uploads/handover_t2026_001.pdf', 840500, 'محضر, تسليم, عطاءات', 'U-001')
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- END OF MIGRATION SCRIPT 000_complete_enterprise_erp_schema.sql
-- ====================================================================
