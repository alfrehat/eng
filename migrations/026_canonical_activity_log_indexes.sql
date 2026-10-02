-- =============================================================================
-- migrations/026_canonical_activity_log_indexes.sql
-- CANONICAL PERFORMANCE INDEXES FOR ACTIVITY_LOG (AUDIT TRAIL)
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- =============================================================================

-- 1. فهرس الطابع الزمني للفرز السريع والتصفية حسب التاريخ (Latest Logs First)
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at 
  ON public.activity_log ("createdAt" DESC);

-- 2. فهرس الكيان ومعرف الكيان لتتبع سجل تعديلات كل عنصر هندسي (Entity Audit Trail)
CREATE INDEX IF NOT EXISTS idx_activity_log_entity 
  ON public.activity_log (entity, "entityId");

-- 3. فهرس نوع الإجراء للبحث والتقارير الإحصائية (Action Audit Filter)
CREATE INDEX IF NOT EXISTS idx_activity_log_action 
  ON public.activity_log (action);
