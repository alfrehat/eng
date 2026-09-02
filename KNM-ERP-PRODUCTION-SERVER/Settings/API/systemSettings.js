/**
 * Settings/API/systemSettings.js
 * محرك الهوية البصرية وإعدادات النظام العامة والمعايير الهندسية والترقيم (System Settings Suite)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية - الإصدار الموحد v5.0
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const { authorize } = require('../../middlewares/rbacManager');
const {
  dbQuery,
  dbGet,
  dbRun,
  isPostgresActive,
  memDb,
  saveMemTable
} = require('../../utils/database');

const DEFAULT_IDENTITY = {
  id: 1,
  app_title: 'نظام إدارة المشاريع والأشغال الهندسية',
  municipality_name: 'بلدية كفرنجة الجديدة',
  directorate_name: 'مديرية الأشغال والخدمات الهندسية',
  primary_color: '#0f766e',
  secondary_color: '#0284c7',
  accent_color: '#10b981',
  background_color: '#0f172a',
  border_radius_px: 12,
  dark_mode_enabled: true,
  session_timeout_minutes: 15,
  logo_path: '/logo.jpg',
  header_logo_b64: '',
  watermark_text: 'بلدية كفرنجة الجديدة - وثيقة رسمية معتمدة',
  watermark_logo_b64: '',
  contact_phone: '02-6466001',
  contact_email: 'info@kafrinja.gov.jo',
  fiscal_year: '2026',
  currency: 'د.أ',
  custom_css: '',

  // 1. الضوابط والمعايير الهندسية والمالية الشاملة
  max_variation_order_pct: 25.0,
  performance_bond_pct: 10.0,
  advance_payment_guarantee_pct: 100.0,
  max_advance_payment_pct: 10.0,
  maintenance_guarantee_pct: 5.0,
  maintenance_period_months: 12,
  daily_penalty_rate_pct: 0.1,
  max_delay_penalties_pct: 15.0,

  default_retention_pct: 10.0,
  income_tax_withholding_pct: 0.0,
  revenue_stamps_pct: 0.6,
  contractors_syndicate_pct: 0.2,
  advance_recovery_rate_pct: 10.0,

  paving_unit_rate_jod: 4.5,
  curbstone_unit_rate_jod: 6.0,
  interlock_unit_rate_jod: 8.5,
  asphalt_reinstatement_rate_jod: 18.0,
  basecourse_reinstatement_rate_jod: 8.0,
  permit_admin_fee_jod: 15.0,
  excavation_insurance_rate_jod: 25.0,

  pci_excellent_min: 85,
  pci_good_min: 70,
  pci_fair_min: 55,
  pci_poor_min: 40,
  default_asphalt_thickness_cm: 5.0,
  asphalt_delivery_temp_min_c: 145,
  min_compaction_rate_pct: 98.0,
  concrete_slump_target_cm: 8.0,

  roads_useful_life_years: 15,
  bridges_useful_life_years: 40,
  machinery_useful_life_years: 10,
  lighting_useful_life_years: 7,
  asset_salvage_value_pct: 10.0,

  // 2. محرك الترقيم التلقائي
  prefix_tenders: 'TEN-',
  prefix_claims: 'CLM-',
  prefix_permits: 'PER-',
  prefix_paving: 'PAV-',
  prefix_tasks: 'TSK-',
  prefix_contracts: 'CNT-',

  // 3. التنبيهات الذكية
  guarantee_alert_days: '30,15,7',
  project_delay_threshold_pct: 15.0,
  auto_backup_enabled: true,
  auto_backup_time: '02:00',

  // 4. نظم المعلومات الجغرافية والخرائط (GIS)
  gis_center_lat: 32.3025,
  gis_center_lng: 35.7008,
  gis_default_zoom: 14,
  gis_map_layer: 'osm',

  // 5. الأختام الرقمية وبوابة التحقق
  director_stamp_b64: '',
  municipality_seal_b64: '',
  verification_portal_url: '/verify.html'
};

let isSchemaEnsured = false;
async function ensureSettingsSchema() {
  if (isSchemaEnsured) return;
  if (isPostgresActive()) {
    try {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS system_identity (
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
          currency VARCHAR(20) DEFAULT 'د.أ',
          custom_css TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Add newly introduced engineering, financial, GIS, and numbering fields
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS max_variation_order_pct DOUBLE PRECISION DEFAULT 25.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS performance_bond_pct DOUBLE PRECISION DEFAULT 10.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS advance_payment_guarantee_pct DOUBLE PRECISION DEFAULT 100.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS max_advance_payment_pct DOUBLE PRECISION DEFAULT 10.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS maintenance_guarantee_pct DOUBLE PRECISION DEFAULT 5.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS maintenance_period_months INT DEFAULT 12;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS daily_penalty_rate_pct DOUBLE PRECISION DEFAULT 0.1;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS max_delay_penalties_pct DOUBLE PRECISION DEFAULT 15.0;

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS default_retention_pct DOUBLE PRECISION DEFAULT 10.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS income_tax_withholding_pct DOUBLE PRECISION DEFAULT 0.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS revenue_stamps_pct DOUBLE PRECISION DEFAULT 0.6;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS contractors_syndicate_pct DOUBLE PRECISION DEFAULT 0.2;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS advance_recovery_rate_pct DOUBLE PRECISION DEFAULT 10.0;

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS paving_unit_rate_jod DOUBLE PRECISION DEFAULT 4.5;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS curbstone_unit_rate_jod DOUBLE PRECISION DEFAULT 6.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS interlock_unit_rate_jod DOUBLE PRECISION DEFAULT 8.5;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS asphalt_reinstatement_rate_jod DOUBLE PRECISION DEFAULT 18.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS basecourse_reinstatement_rate_jod DOUBLE PRECISION DEFAULT 8.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS permit_admin_fee_jod DOUBLE PRECISION DEFAULT 15.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS excavation_insurance_rate_jod DOUBLE PRECISION DEFAULT 25.0;

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS pci_excellent_min INT DEFAULT 85;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS pci_good_min INT DEFAULT 70;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS pci_fair_min INT DEFAULT 55;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS pci_poor_min INT DEFAULT 40;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS default_asphalt_thickness_cm DOUBLE PRECISION DEFAULT 5.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS asphalt_delivery_temp_min_c INT DEFAULT 145;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS min_compaction_rate_pct DOUBLE PRECISION DEFAULT 98.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS concrete_slump_target_cm DOUBLE PRECISION DEFAULT 8.0;

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS roads_useful_life_years INT DEFAULT 15;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS bridges_useful_life_years INT DEFAULT 40;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS machinery_useful_life_years INT DEFAULT 10;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS lighting_useful_life_years INT DEFAULT 7;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS asset_salvage_value_pct DOUBLE PRECISION DEFAULT 10.0;

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_tenders VARCHAR(50) DEFAULT 'TEN-';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_claims VARCHAR(50) DEFAULT 'CLM-';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_permits VARCHAR(50) DEFAULT 'PER-';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_paving VARCHAR(50) DEFAULT 'PAV-';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_tasks VARCHAR(50) DEFAULT 'TSK-';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS prefix_contracts VARCHAR(50) DEFAULT 'CNT-';

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS guarantee_alert_days VARCHAR(100) DEFAULT '30,15,7';
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS project_delay_threshold_pct DOUBLE PRECISION DEFAULT 15.0;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT true;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS auto_backup_time VARCHAR(20) DEFAULT '02:00';

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS gis_center_lat DOUBLE PRECISION DEFAULT 32.3025;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS gis_center_lng DOUBLE PRECISION DEFAULT 35.7008;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS gis_default_zoom INT DEFAULT 14;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS gis_map_layer VARCHAR(50) DEFAULT 'osm';

        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS director_stamp_b64 TEXT;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS municipality_seal_b64 TEXT;
        ALTER TABLE system_identity ADD COLUMN IF NOT EXISTS verification_portal_url VARCHAR(255) DEFAULT '/verify.html';
      `);

      const row = await dbGet('SELECT id FROM system_identity WHERE id = 1');
      if (!row) {
        await dbRun(`
          INSERT INTO system_identity (
            id, app_title, municipality_name, directorate_name, primary_color, secondary_color,
            accent_color, background_color, border_radius_px, dark_mode_enabled, logo_path,
            watermark_text, contact_phone, contact_email, fiscal_year, currency, updated_at
          ) VALUES (
            1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
          );
        `, [
          DEFAULT_IDENTITY.app_title, DEFAULT_IDENTITY.municipality_name, DEFAULT_IDENTITY.directorate_name,
          DEFAULT_IDENTITY.primary_color, DEFAULT_IDENTITY.secondary_color, DEFAULT_IDENTITY.accent_color,
          DEFAULT_IDENTITY.background_color, DEFAULT_IDENTITY.border_radius_px, DEFAULT_IDENTITY.dark_mode_enabled,
          DEFAULT_IDENTITY.logo_path, DEFAULT_IDENTITY.watermark_text, DEFAULT_IDENTITY.contact_phone,
          DEFAULT_IDENTITY.contact_email, DEFAULT_IDENTITY.fiscal_year, DEFAULT_IDENTITY.currency
        ]);
      }
    } catch (e) {
      console.warn('System settings schema ensure note:', e.message);
    }
  }

  if (!memDb.system_settings || !memDb.system_settings.length) {
    memDb.system_settings = [{ ...DEFAULT_IDENTITY }];
    saveMemTable('system_settings');
  } else {
    memDb.system_settings[0] = Object.assign({}, DEFAULT_IDENTITY, memDb.system_settings[0]);
  }
  isSchemaEnsured = true;
}

// 1. استرجاع الهوية البصرية وإعدادات النظام العامة والمعايير
router.get(['/identity', '/', '/general', '/config'], async (req, res) => {
  await ensureSettingsSchema();
  try {
    let identity = null;
    if (isPostgresActive()) {
      identity = await dbGet('SELECT * FROM system_identity WHERE id = 1');
    }
    if (!identity) {
      identity = (memDb.system_settings && memDb.system_settings[0]) || DEFAULT_IDENTITY;
    }
    const merged = Object.assign({}, DEFAULT_IDENTITY, identity);
    res.json({ success: true, data: merged });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: DEFAULT_IDENTITY });
  }
});

// 2. تحديث الهوية البصرية والمظهر والإعدادات العامة والمعايير الهندسية (Zero-Code Unified Update)
router.put(['/identity-visual', '/identity', '/', '/config'], requireAuth, async (req, res) => {
  await ensureSettingsSchema();
  
  let currentConfig = DEFAULT_IDENTITY;
  if (isPostgresActive()) {
    try {
      const dbRow = await dbGet('SELECT * FROM system_identity WHERE id = 1');
      if (dbRow) currentConfig = Object.assign({}, DEFAULT_IDENTITY, dbRow);
    } catch(e) {}
  } else if (memDb.system_settings && memDb.system_settings[0]) {
    currentConfig = Object.assign({}, DEFAULT_IDENTITY, memDb.system_settings[0]);
  }

  const b = req.body;
  const updatedData = {
    id: 1,
    app_title: b.appTitle || b.app_title || currentConfig.app_title,
    municipality_name: b.municipalityName || b.municipality_name || currentConfig.municipality_name,
    directorate_name: b.directorateName || b.directorate_name || currentConfig.directorate_name,
    primary_color: b.primaryColor || b.primary_color || currentConfig.primary_color,
    secondary_color: b.secondaryColor || b.secondary_color || currentConfig.secondary_color,
    accent_color: b.accentColor || b.accent_color || currentConfig.accent_color,
    background_color: b.backgroundColor || b.background_color || currentConfig.background_color,
    border_radius_px: parseInt(b.borderRadius !== undefined ? b.borderRadius : (b.border_radius_px !== undefined ? b.border_radius_px : currentConfig.border_radius_px), 10),
    dark_mode_enabled: b.darkMode !== undefined ? !!b.darkMode : (b.dark_mode_enabled !== undefined ? !!b.dark_mode_enabled : currentConfig.dark_mode_enabled),
    session_timeout_minutes: parseInt(b.sessionTimeout !== undefined ? b.sessionTimeout : (b.session_timeout_minutes !== undefined ? b.session_timeout_minutes : currentConfig.session_timeout_minutes), 10),
    header_logo_b64: b.headerLogo !== undefined ? b.headerLogo : (b.header_logo_b64 !== undefined ? b.header_logo_b64 : currentConfig.header_logo_b64),
    logo_path: b.headerLogo || b.header_logo_b64 || b.logo_path || currentConfig.logo_path,
    watermark_text: b.watermarkText !== undefined ? b.watermarkText : (b.watermark_text !== undefined ? b.watermark_text : currentConfig.watermark_text),
    watermark_logo_b64: b.watermarkLogo !== undefined ? b.watermarkLogo : (b.watermark_logo_b64 !== undefined ? b.watermark_logo_b64 : currentConfig.watermark_logo_b64),
    contact_phone: b.contactPhone || b.contact_phone || currentConfig.contact_phone,
    contact_email: b.contactEmail || b.contact_email || currentConfig.contact_email,
    fiscal_year: b.fiscalYear || b.fiscal_year || currentConfig.fiscal_year,
    currency: b.currency || currentConfig.currency,
    custom_css: b.custom_css !== undefined ? b.custom_css : currentConfig.custom_css,

    // 1. الضوابط والمعايير الهندسية والمالية الشاملة
    max_variation_order_pct: parseFloat(b.max_variation_order_pct !== undefined ? b.max_variation_order_pct : currentConfig.max_variation_order_pct),
    performance_bond_pct: parseFloat(b.performance_bond_pct !== undefined ? b.performance_bond_pct : currentConfig.performance_bond_pct),
    advance_payment_guarantee_pct: parseFloat(b.advance_payment_guarantee_pct !== undefined ? b.advance_payment_guarantee_pct : currentConfig.advance_payment_guarantee_pct),
    max_advance_payment_pct: parseFloat(b.max_advance_payment_pct !== undefined ? b.max_advance_payment_pct : currentConfig.max_advance_payment_pct),
    maintenance_guarantee_pct: parseFloat(b.maintenance_guarantee_pct !== undefined ? b.maintenance_guarantee_pct : currentConfig.maintenance_guarantee_pct),
    maintenance_period_months: parseInt(b.maintenance_period_months !== undefined ? b.maintenance_period_months : currentConfig.maintenance_period_months, 10),
    daily_penalty_rate_pct: parseFloat(b.daily_penalty_rate_pct !== undefined ? b.daily_penalty_rate_pct : currentConfig.daily_penalty_rate_pct),
    max_delay_penalties_pct: parseFloat(b.max_delay_penalties_pct !== undefined ? b.max_delay_penalties_pct : currentConfig.max_delay_penalties_pct),

    default_retention_pct: parseFloat(b.default_retention_pct !== undefined ? b.default_retention_pct : currentConfig.default_retention_pct),
    income_tax_withholding_pct: parseFloat(b.income_tax_withholding_pct !== undefined ? b.income_tax_withholding_pct : currentConfig.income_tax_withholding_pct),
    revenue_stamps_pct: parseFloat(b.revenue_stamps_pct !== undefined ? b.revenue_stamps_pct : currentConfig.revenue_stamps_pct),
    contractors_syndicate_pct: parseFloat(b.contractors_syndicate_pct !== undefined ? b.contractors_syndicate_pct : currentConfig.contractors_syndicate_pct),
    advance_recovery_rate_pct: parseFloat(b.advance_recovery_rate_pct !== undefined ? b.advance_recovery_rate_pct : currentConfig.advance_recovery_rate_pct),

    paving_unit_rate_jod: parseFloat(b.paving_unit_rate_jod !== undefined ? b.paving_unit_rate_jod : currentConfig.paving_unit_rate_jod),
    curbstone_unit_rate_jod: parseFloat(b.curbstone_unit_rate_jod !== undefined ? b.curbstone_unit_rate_jod : currentConfig.curbstone_unit_rate_jod),
    interlock_unit_rate_jod: parseFloat(b.interlock_unit_rate_jod !== undefined ? b.interlock_unit_rate_jod : currentConfig.interlock_unit_rate_jod),
    asphalt_reinstatement_rate_jod: parseFloat(b.asphalt_reinstatement_rate_jod !== undefined ? b.asphalt_reinstatement_rate_jod : currentConfig.asphalt_reinstatement_rate_jod),
    basecourse_reinstatement_rate_jod: parseFloat(b.basecourse_reinstatement_rate_jod !== undefined ? b.basecourse_reinstatement_rate_jod : currentConfig.basecourse_reinstatement_rate_jod),
    permit_admin_fee_jod: parseFloat(b.permit_admin_fee_jod !== undefined ? b.permit_admin_fee_jod : currentConfig.permit_admin_fee_jod),
    excavation_insurance_rate_jod: parseFloat(b.excavation_insurance_rate_jod !== undefined ? b.excavation_insurance_rate_jod : currentConfig.excavation_insurance_rate_jod),

    pci_excellent_min: parseInt(b.pci_excellent_min !== undefined ? b.pci_excellent_min : currentConfig.pci_excellent_min, 10),
    pci_good_min: parseInt(b.pci_good_min !== undefined ? b.pci_good_min : currentConfig.pci_good_min, 10),
    pci_fair_min: parseInt(b.pci_fair_min !== undefined ? b.pci_fair_min : currentConfig.pci_fair_min, 10),
    pci_poor_min: parseInt(b.pci_poor_min !== undefined ? b.pci_poor_min : currentConfig.pci_poor_min, 10),
    default_asphalt_thickness_cm: parseFloat(b.default_asphalt_thickness_cm !== undefined ? b.default_asphalt_thickness_cm : currentConfig.default_asphalt_thickness_cm),
    asphalt_delivery_temp_min_c: parseInt(b.asphalt_delivery_temp_min_c !== undefined ? b.asphalt_delivery_temp_min_c : currentConfig.asphalt_delivery_temp_min_c, 10),
    min_compaction_rate_pct: parseFloat(b.min_compaction_rate_pct !== undefined ? b.min_compaction_rate_pct : currentConfig.min_compaction_rate_pct),
    concrete_slump_target_cm: parseFloat(b.concrete_slump_target_cm !== undefined ? b.concrete_slump_target_cm : currentConfig.concrete_slump_target_cm),

    roads_useful_life_years: parseInt(b.roads_useful_life_years !== undefined ? b.roads_useful_life_years : currentConfig.roads_useful_life_years, 10),
    bridges_useful_life_years: parseInt(b.bridges_useful_life_years !== undefined ? b.bridges_useful_life_years : currentConfig.bridges_useful_life_years, 10),
    machinery_useful_life_years: parseInt(b.machinery_useful_life_years !== undefined ? b.machinery_useful_life_years : currentConfig.machinery_useful_life_years, 10),
    lighting_useful_life_years: parseInt(b.lighting_useful_life_years !== undefined ? b.lighting_useful_life_years : currentConfig.lighting_useful_life_years, 10),
    asset_salvage_value_pct: parseFloat(b.asset_salvage_value_pct !== undefined ? b.asset_salvage_value_pct : currentConfig.asset_salvage_value_pct),

    // 2. محرك الترقيم التلقائي
    prefix_tenders: b.prefix_tenders || currentConfig.prefix_tenders,
    prefix_claims: b.prefix_claims || currentConfig.prefix_claims,
    prefix_permits: b.prefix_permits || currentConfig.prefix_permits,
    prefix_paving: b.prefix_paving || currentConfig.prefix_paving,
    prefix_tasks: b.prefix_tasks || currentConfig.prefix_tasks,
    prefix_contracts: b.prefix_contracts || currentConfig.prefix_contracts,

    // 3. التنبيهات الذكية
    guarantee_alert_days: b.guarantee_alert_days || currentConfig.guarantee_alert_days,
    project_delay_threshold_pct: parseFloat(b.project_delay_threshold_pct !== undefined ? b.project_delay_threshold_pct : currentConfig.project_delay_threshold_pct),
    auto_backup_enabled: b.auto_backup_enabled !== undefined ? !!b.auto_backup_enabled : currentConfig.auto_backup_enabled,
    auto_backup_time: b.auto_backup_time || currentConfig.auto_backup_time,

    // 4. GIS
    gis_center_lat: parseFloat(b.gis_center_lat !== undefined ? b.gis_center_lat : currentConfig.gis_center_lat),
    gis_center_lng: parseFloat(b.gis_center_lng !== undefined ? b.gis_center_lng : currentConfig.gis_center_lng),
    gis_default_zoom: parseInt(b.gis_default_zoom !== undefined ? b.gis_default_zoom : currentConfig.gis_default_zoom, 10),
    gis_map_layer: b.gis_map_layer || currentConfig.gis_map_layer,

    // 5. الأختام
    director_stamp_b64: b.director_stamp_b64 !== undefined ? b.director_stamp_b64 : currentConfig.director_stamp_b64,
    municipality_seal_b64: b.municipality_seal_b64 !== undefined ? b.municipality_seal_b64 : currentConfig.municipality_seal_b64,
    verification_portal_url: b.verification_portal_url || currentConfig.verification_portal_url,

    updated_at: new Date().toISOString()
  };

  try {
    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO system_identity (
          id, app_title, municipality_name, directorate_name, primary_color, secondary_color,
          accent_color, background_color, border_radius_px, dark_mode_enabled, session_timeout_minutes,
          header_logo_b64, logo_path, watermark_text, watermark_logo_b64,
          contact_phone, contact_email, fiscal_year, currency, custom_css,
          max_variation_order_pct, performance_bond_pct, advance_payment_guarantee_pct, max_advance_payment_pct,
          maintenance_guarantee_pct, maintenance_period_months, daily_penalty_rate_pct, max_delay_penalties_pct,
          default_retention_pct, income_tax_withholding_pct, revenue_stamps_pct, contractors_syndicate_pct, advance_recovery_rate_pct,
          paving_unit_rate_jod, curbstone_unit_rate_jod, interlock_unit_rate_jod, asphalt_reinstatement_rate_jod, basecourse_reinstatement_rate_jod,
          permit_admin_fee_jod, excavation_insurance_rate_jod,
          pci_excellent_min, pci_good_min, pci_fair_min, pci_poor_min,
          default_asphalt_thickness_cm, asphalt_delivery_temp_min_c, min_compaction_rate_pct, concrete_slump_target_cm,
          roads_useful_life_years, bridges_useful_life_years, machinery_useful_life_years, lighting_useful_life_years, asset_salvage_value_pct,
          prefix_tenders, prefix_claims, prefix_permits, prefix_paving, prefix_tasks, prefix_contracts,
          guarantee_alert_days, project_delay_threshold_pct, auto_backup_enabled, auto_backup_time,
          gis_center_lat, gis_center_lng, gis_default_zoom, gis_map_layer,
          director_stamp_b64, municipality_seal_b64, verification_portal_url,
          updated_at
        ) VALUES (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
          $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55,
          $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          app_title = EXCLUDED.app_title,
          municipality_name = EXCLUDED.municipality_name,
          directorate_name = EXCLUDED.directorate_name,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          accent_color = EXCLUDED.accent_color,
          background_color = EXCLUDED.background_color,
          border_radius_px = EXCLUDED.border_radius_px,
          dark_mode_enabled = EXCLUDED.dark_mode_enabled,
          session_timeout_minutes = EXCLUDED.session_timeout_minutes,
          header_logo_b64 = EXCLUDED.header_logo_b64,
          logo_path = EXCLUDED.logo_path,
          watermark_text = EXCLUDED.watermark_text,
          watermark_logo_b64 = EXCLUDED.watermark_logo_b64,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email,
          fiscal_year = EXCLUDED.fiscal_year,
          currency = EXCLUDED.currency,
          custom_css = EXCLUDED.custom_css,
          max_variation_order_pct = EXCLUDED.max_variation_order_pct,
          performance_bond_pct = EXCLUDED.performance_bond_pct,
          advance_payment_guarantee_pct = EXCLUDED.advance_payment_guarantee_pct,
          max_advance_payment_pct = EXCLUDED.max_advance_payment_pct,
          maintenance_guarantee_pct = EXCLUDED.maintenance_guarantee_pct,
          maintenance_period_months = EXCLUDED.maintenance_period_months,
          daily_penalty_rate_pct = EXCLUDED.daily_penalty_rate_pct,
          max_delay_penalties_pct = EXCLUDED.max_delay_penalties_pct,
          default_retention_pct = EXCLUDED.default_retention_pct,
          income_tax_withholding_pct = EXCLUDED.income_tax_withholding_pct,
          revenue_stamps_pct = EXCLUDED.revenue_stamps_pct,
          contractors_syndicate_pct = EXCLUDED.contractors_syndicate_pct,
          advance_recovery_rate_pct = EXCLUDED.advance_recovery_rate_pct,
          paving_unit_rate_jod = EXCLUDED.paving_unit_rate_jod,
          curbstone_unit_rate_jod = EXCLUDED.curbstone_unit_rate_jod,
          interlock_unit_rate_jod = EXCLUDED.interlock_unit_rate_jod,
          asphalt_reinstatement_rate_jod = EXCLUDED.asphalt_reinstatement_rate_jod,
          basecourse_reinstatement_rate_jod = EXCLUDED.basecourse_reinstatement_rate_jod,
          permit_admin_fee_jod = EXCLUDED.permit_admin_fee_jod,
          excavation_insurance_rate_jod = EXCLUDED.excavation_insurance_rate_jod,
          pci_excellent_min = EXCLUDED.pci_excellent_min,
          pci_good_min = EXCLUDED.pci_good_min,
          pci_fair_min = EXCLUDED.pci_fair_min,
          pci_poor_min = EXCLUDED.pci_poor_min,
          default_asphalt_thickness_cm = EXCLUDED.default_asphalt_thickness_cm,
          asphalt_delivery_temp_min_c = EXCLUDED.asphalt_delivery_temp_min_c,
          min_compaction_rate_pct = EXCLUDED.min_compaction_rate_pct,
          concrete_slump_target_cm = EXCLUDED.concrete_slump_target_cm,
          roads_useful_life_years = EXCLUDED.roads_useful_life_years,
          bridges_useful_life_years = EXCLUDED.bridges_useful_life_years,
          machinery_useful_life_years = EXCLUDED.machinery_useful_life_years,
          lighting_useful_life_years = EXCLUDED.lighting_useful_life_years,
          asset_salvage_value_pct = EXCLUDED.asset_salvage_value_pct,
          prefix_tenders = EXCLUDED.prefix_tenders,
          prefix_claims = EXCLUDED.prefix_claims,
          prefix_permits = EXCLUDED.prefix_permits,
          prefix_paving = EXCLUDED.prefix_paving,
          prefix_tasks = EXCLUDED.prefix_tasks,
          prefix_contracts = EXCLUDED.prefix_contracts,
          guarantee_alert_days = EXCLUDED.guarantee_alert_days,
          project_delay_threshold_pct = EXCLUDED.project_delay_threshold_pct,
          auto_backup_enabled = EXCLUDED.auto_backup_enabled,
          auto_backup_time = EXCLUDED.auto_backup_time,
          gis_center_lat = EXCLUDED.gis_center_lat,
          gis_center_lng = EXCLUDED.gis_center_lng,
          gis_default_zoom = EXCLUDED.gis_default_zoom,
          gis_map_layer = EXCLUDED.gis_map_layer,
          director_stamp_b64 = EXCLUDED.director_stamp_b64,
          municipality_seal_b64 = EXCLUDED.municipality_seal_b64,
          verification_portal_url = EXCLUDED.verification_portal_url,
          updated_at = NOW();
      `, [
        updatedData.app_title, updatedData.municipality_name, updatedData.directorate_name,
        updatedData.primary_color, updatedData.secondary_color, updatedData.accent_color,
        updatedData.background_color, updatedData.border_radius_px, updatedData.dark_mode_enabled,
        updatedData.session_timeout_minutes, updatedData.header_logo_b64, updatedData.logo_path,
        updatedData.watermark_text, updatedData.watermark_logo_b64, updatedData.contact_phone,
        updatedData.contact_email, updatedData.fiscal_year, updatedData.currency, updatedData.custom_css,
        updatedData.max_variation_order_pct, updatedData.performance_bond_pct, updatedData.advance_payment_guarantee_pct,
        updatedData.max_advance_payment_pct, updatedData.maintenance_guarantee_pct, updatedData.maintenance_period_months,
        updatedData.daily_penalty_rate_pct, updatedData.max_delay_penalties_pct,
        updatedData.default_retention_pct, updatedData.income_tax_withholding_pct, updatedData.revenue_stamps_pct,
        updatedData.contractors_syndicate_pct, updatedData.advance_recovery_rate_pct,
        updatedData.paving_unit_rate_jod, updatedData.curbstone_unit_rate_jod, updatedData.interlock_unit_rate_jod,
        updatedData.asphalt_reinstatement_rate_jod, updatedData.basecourse_reinstatement_rate_jod,
        updatedData.permit_admin_fee_jod, updatedData.excavation_insurance_rate_jod,
        updatedData.pci_excellent_min, updatedData.pci_good_min, updatedData.pci_fair_min, updatedData.pci_poor_min,
        updatedData.default_asphalt_thickness_cm, updatedData.asphalt_delivery_temp_min_c,
        updatedData.min_compaction_rate_pct, updatedData.concrete_slump_target_cm,
        updatedData.roads_useful_life_years, updatedData.bridges_useful_life_years,
        updatedData.machinery_useful_life_years, updatedData.lighting_useful_life_years,
        updatedData.asset_salvage_value_pct,
        updatedData.prefix_tenders, updatedData.prefix_claims, updatedData.prefix_permits,
        updatedData.prefix_paving, updatedData.prefix_tasks, updatedData.prefix_contracts,
        updatedData.guarantee_alert_days, updatedData.project_delay_threshold_pct,
        updatedData.auto_backup_enabled, updatedData.auto_backup_time,
        updatedData.gis_center_lat, updatedData.gis_center_lng, updatedData.gis_default_zoom,
        updatedData.gis_map_layer, updatedData.director_stamp_b64, updatedData.municipality_seal_b64,
        updatedData.verification_portal_url
      ]);
    }

    memDb.system_settings = [updatedData];
    saveMemTable('system_settings');

    // تسجيل حركة التدقيق الأمني
    try {
      const { recordActivity } = require('../../Administration/API/activityEngine');
      if (typeof recordActivity === 'function') {
        const u = req.user || {};
        await recordActivity({
          userId: u.id || u.username || 'U-001',
          userName: u.fullName || u.username || 'المدير الهندسي',
          action: 'تعديل الإعدادات والمعايير المركزية',
          entity: 'system_settings',
          entityId: '1',
          details: 'تم تحديث مصفوفة الإعدادات والهوية والمعايير الهندسية والمالية بنجاح',
          ip: req.ip || req.connection?.remoteAddress
        });
      }
    } catch(e) {}

    // Broadcast live WebSocket event
    if (global.broadcastWs) {
      global.broadcastWs({
        type: 'SYSTEM_IDENTITY_UPDATED',
        data: updatedData
      });
    }

    res.json({
      success: true,
      message: 'تم حفظ وتطبيق كافة إعدادات المنظومة والمعايير الهندسية بنجاح',
      data: updatedData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. تصدير ملف الإعدادات الكامل بصيغة JSON (Configuration Export)
router.get('/export-config', requireAuth, async (req, res) => {
  try {
    await ensureSettingsSchema();
    let currentConfig = DEFAULT_IDENTITY;
    if (isPostgresActive()) {
      const dbRow = await dbGet('SELECT * FROM system_identity WHERE id = 1');
      if (dbRow) currentConfig = Object.assign({}, DEFAULT_IDENTITY, dbRow);
    } else if (memDb.system_settings && memDb.system_settings[0]) {
      currentConfig = Object.assign({}, DEFAULT_IDENTITY, memDb.system_settings[0]);
    }

    const exportPayload = {
      system_name: 'نظام إدارة المشاريع والأشغال الهندسية - بلدية كفرنجة الجديدة',
      version: '6.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user ? (req.user.fullName || req.user.username) : 'المدير الهندسي',
      configuration: currentConfig
    };

    res.setHeader('Content-Disposition', `attachment; filename="kafrinja_system_settings_${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. استيراد ملف الإعدادات المعتمد (Configuration Import)
router.post('/import-config', requireAuth, async (req, res) => {
  try {
    await ensureSettingsSchema();
    const body = req.body;
    const configToImport = body.configuration || body;
    if (!configToImport || typeof configToImport !== 'object') {
      return res.status(400).json({ success: false, error: 'ملف الإعدادات غير صالح' });
    }

    const merged = Object.assign({}, DEFAULT_IDENTITY, configToImport, { id: 1, updated_at: new Date().toISOString() });
    
    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO system_identity (
          id, app_title, municipality_name, directorate_name, primary_color, secondary_color,
          accent_color, background_color, border_radius_px, dark_mode_enabled, session_timeout_minutes,
          header_logo_b64, logo_path, watermark_text, watermark_logo_b64,
          contact_phone, contact_email, fiscal_year, currency, custom_css,
          max_variation_order_pct, performance_bond_pct, advance_payment_guarantee_pct, max_advance_payment_pct,
          maintenance_guarantee_pct, maintenance_period_months, daily_penalty_rate_pct, max_delay_penalties_pct,
          default_retention_pct, income_tax_withholding_pct, revenue_stamps_pct, contractors_syndicate_pct, advance_recovery_rate_pct,
          paving_unit_rate_jod, curbstone_unit_rate_jod, interlock_unit_rate_jod, asphalt_reinstatement_rate_jod, basecourse_reinstatement_rate_jod,
          permit_admin_fee_jod, excavation_insurance_rate_jod,
          pci_excellent_min, pci_good_min, pci_fair_min, pci_poor_min,
          default_asphalt_thickness_cm, asphalt_delivery_temp_min_c, min_compaction_rate_pct, concrete_slump_target_cm,
          roads_useful_life_years, bridges_useful_life_years, machinery_useful_life_years, lighting_useful_life_years, asset_salvage_value_pct,
          prefix_tenders, prefix_claims, prefix_permits, prefix_paving, prefix_tasks, prefix_contracts,
          guarantee_alert_days, project_delay_threshold_pct, auto_backup_enabled, auto_backup_time,
          gis_center_lat, gis_center_lng, gis_default_zoom, gis_map_layer,
          director_stamp_b64, municipality_seal_b64, verification_portal_url,
          updated_at
        ) VALUES (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
          $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55,
          $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          app_title = EXCLUDED.app_title,
          municipality_name = EXCLUDED.municipality_name,
          directorate_name = EXCLUDED.directorate_name,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          accent_color = EXCLUDED.accent_color,
          background_color = EXCLUDED.background_color,
          border_radius_px = EXCLUDED.border_radius_px,
          dark_mode_enabled = EXCLUDED.dark_mode_enabled,
          session_timeout_minutes = EXCLUDED.session_timeout_minutes,
          header_logo_b64 = EXCLUDED.header_logo_b64,
          logo_path = EXCLUDED.logo_path,
          watermark_text = EXCLUDED.watermark_text,
          watermark_logo_b64 = EXCLUDED.watermark_logo_b64,
          contact_phone = EXCLUDED.contact_phone,
          contact_email = EXCLUDED.contact_email,
          fiscal_year = EXCLUDED.fiscal_year,
          currency = EXCLUDED.currency,
          custom_css = EXCLUDED.custom_css,
          max_variation_order_pct = EXCLUDED.max_variation_order_pct,
          performance_bond_pct = EXCLUDED.performance_bond_pct,
          advance_payment_guarantee_pct = EXCLUDED.advance_payment_guarantee_pct,
          max_advance_payment_pct = EXCLUDED.max_advance_payment_pct,
          maintenance_guarantee_pct = EXCLUDED.maintenance_guarantee_pct,
          maintenance_period_months = EXCLUDED.maintenance_period_months,
          daily_penalty_rate_pct = EXCLUDED.daily_penalty_rate_pct,
          max_delay_penalties_pct = EXCLUDED.max_delay_penalties_pct,
          default_retention_pct = EXCLUDED.default_retention_pct,
          income_tax_withholding_pct = EXCLUDED.income_tax_withholding_pct,
          revenue_stamps_pct = EXCLUDED.revenue_stamps_pct,
          contractors_syndicate_pct = EXCLUDED.contractors_syndicate_pct,
          advance_recovery_rate_pct = EXCLUDED.advance_recovery_rate_pct,
          paving_unit_rate_jod = EXCLUDED.paving_unit_rate_jod,
          curbstone_unit_rate_jod = EXCLUDED.curbstone_unit_rate_jod,
          interlock_unit_rate_jod = EXCLUDED.interlock_unit_rate_jod,
          asphalt_reinstatement_rate_jod = EXCLUDED.asphalt_reinstatement_rate_jod,
          basecourse_reinstatement_rate_jod = EXCLUDED.basecourse_reinstatement_rate_jod,
          permit_admin_fee_jod = EXCLUDED.permit_admin_fee_jod,
          excavation_insurance_rate_jod = EXCLUDED.excavation_insurance_rate_jod,
          pci_excellent_min = EXCLUDED.pci_excellent_min,
          pci_good_min = EXCLUDED.pci_good_min,
          pci_fair_min = EXCLUDED.pci_fair_min,
          pci_poor_min = EXCLUDED.pci_poor_min,
          default_asphalt_thickness_cm = EXCLUDED.default_asphalt_thickness_cm,
          asphalt_delivery_temp_min_c = EXCLUDED.asphalt_delivery_temp_min_c,
          min_compaction_rate_pct = EXCLUDED.min_compaction_rate_pct,
          concrete_slump_target_cm = EXCLUDED.concrete_slump_target_cm,
          roads_useful_life_years = EXCLUDED.roads_useful_life_years,
          bridges_useful_life_years = EXCLUDED.bridges_useful_life_years,
          machinery_useful_life_years = EXCLUDED.machinery_useful_life_years,
          lighting_useful_life_years = EXCLUDED.lighting_useful_life_years,
          asset_salvage_value_pct = EXCLUDED.asset_salvage_value_pct,
          prefix_tenders = EXCLUDED.prefix_tenders,
          prefix_claims = EXCLUDED.prefix_claims,
          prefix_permits = EXCLUDED.prefix_permits,
          prefix_paving = EXCLUDED.prefix_paving,
          prefix_tasks = EXCLUDED.prefix_tasks,
          prefix_contracts = EXCLUDED.prefix_contracts,
          guarantee_alert_days = EXCLUDED.guarantee_alert_days,
          project_delay_threshold_pct = EXCLUDED.project_delay_threshold_pct,
          auto_backup_enabled = EXCLUDED.auto_backup_enabled,
          auto_backup_time = EXCLUDED.auto_backup_time,
          gis_center_lat = EXCLUDED.gis_center_lat,
          gis_center_lng = EXCLUDED.gis_center_lng,
          gis_default_zoom = EXCLUDED.gis_default_zoom,
          gis_map_layer = EXCLUDED.gis_map_layer,
          director_stamp_b64 = EXCLUDED.director_stamp_b64,
          municipality_seal_b64 = EXCLUDED.municipality_seal_b64,
          verification_portal_url = EXCLUDED.verification_portal_url,
          updated_at = NOW();
      `, [
        merged.app_title, merged.municipality_name, merged.directorate_name,
        merged.primary_color, merged.secondary_color, merged.accent_color,
        merged.background_color, merged.border_radius_px, merged.dark_mode_enabled,
        merged.session_timeout_minutes, merged.header_logo_b64, merged.logo_path,
        merged.watermark_text, merged.watermark_logo_b64, merged.contact_phone,
        merged.contact_email, merged.fiscal_year, merged.currency, merged.custom_css,
        merged.max_variation_order_pct, merged.performance_bond_pct, merged.advance_payment_guarantee_pct,
        merged.max_advance_payment_pct, merged.maintenance_guarantee_pct, merged.maintenance_period_months,
        merged.daily_penalty_rate_pct, merged.max_delay_penalties_pct,
        merged.default_retention_pct, merged.income_tax_withholding_pct, merged.revenue_stamps_pct,
        merged.contractors_syndicate_pct, merged.advance_recovery_rate_pct,
        merged.paving_unit_rate_jod, merged.curbstone_unit_rate_jod, merged.interlock_unit_rate_jod,
        merged.asphalt_reinstatement_rate_jod, merged.basecourse_reinstatement_rate_jod,
        merged.permit_admin_fee_jod, merged.excavation_insurance_rate_jod,
        merged.pci_excellent_min, merged.pci_good_min, merged.pci_fair_min, merged.pci_poor_min,
        merged.default_asphalt_thickness_cm, merged.asphalt_delivery_temp_min_c,
        merged.min_compaction_rate_pct, merged.concrete_slump_target_cm,
        merged.roads_useful_life_years, merged.bridges_useful_life_years,
        merged.machinery_useful_life_years, merged.lighting_useful_life_years,
        merged.asset_salvage_value_pct,
        merged.prefix_tenders, merged.prefix_claims, merged.prefix_permits,
        merged.prefix_paving, merged.prefix_tasks, merged.prefix_contracts,
        merged.guarantee_alert_days, merged.project_delay_threshold_pct,
        merged.auto_backup_enabled, merged.auto_backup_time,
        merged.gis_center_lat, merged.gis_center_lng, merged.gis_default_zoom,
        merged.gis_map_layer, merged.director_stamp_b64, merged.municipality_seal_b64,
        merged.verification_portal_url
      ]);
    }

    memDb.system_settings = [merged];
    saveMemTable('system_settings');

    if (global.broadcastWs) {
      global.broadcastWs({
        type: 'SYSTEM_IDENTITY_UPDATED',
        data: merged
      });
    }

    res.json({
      success: true,
      message: 'تم استيراد وتطبيق كافة إعدادات المنظومة بنجاح',
      data: merged
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. استرجاع قوالب الطباعة
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const list = (memDb.print_templates || []);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. استرجاع مسار وسلسلة الاعتمادات الحالية
router.get('/approval-workflow', async (req, res) => {
  try {
    const wf = (memDb.workflows || []);
    res.json({ success: true, data: wf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

