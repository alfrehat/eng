-- =============================================================================
-- migrations/016_activity_log_schema_alignment.sql
-- ALIGNMENT & COMPATIBILITY MIGRATION FOR ACTIVITY_LOG AND ROLES
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- =============================================================================

-- 1. ضمان وجود عمود ip للتوافقية الكاملة مع الخدمات ومحركات النظام
ALTER TABLE IF EXISTS public.activity_log 
  ADD COLUMN IF NOT EXISTS ip VARCHAR(100) DEFAULT '127.0.0.1';

-- 2. مزامنة عمود ip مع ip_address إن كان موجوداً وفارغاً
UPDATE public.activity_log 
SET ip = ip_address 
WHERE ip IS NULL AND ip_address IS NOT NULL;

-- 3. ضمان وجود عمود label في جدول الأدوار roles بشكل دائم وversioned
ALTER TABLE IF EXISTS public.roles 
  ADD COLUMN IF NOT EXISTS label VARCHAR(255);

-- 4. تعبئة label من name للأدوار القديمة التي لا تملك label
UPDATE public.roles 
SET label = name 
WHERE label IS NULL OR label = '';
