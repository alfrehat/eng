-- =============================================================================
-- migrations/017_canonical_documents_schema.sql
-- CANONICAL ENTERPRISE DOCUMENTS & ARCHIVE SCHEMA CONSOLIDATION
-- بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
-- =============================================================================

-- 1. إنشاء جدول الوثائق والأرشفة المؤسسية الكنوني (Canonical Documents Table)
CREATE TABLE IF NOT EXISTS public.documents (
  id VARCHAR(100) PRIMARY KEY,
  document_number VARCHAR(100),
  title TEXT NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  file_hash VARCHAR(64),
  mime_type VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  retention_years INT DEFAULT 5,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  archived_by VARCHAR(100),
  related_id VARCHAR(100),
  related_type VARCHAR(100),
  reference_number VARCHAR(100),
  security_level VARCHAR(50) DEFAULT 'OFFICIAL',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. إنشاء الفهارس المعمارية لتسريع البحث والتصفح
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_related ON public.documents(related_id, related_type);
CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON public.documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- 3. إزالة الجدول المكرر archive_documents إن وُجد
DROP TABLE IF EXISTS public.archive_documents CASCADE;

-- 4. إبقاء توافق جدول archive كـ view أو جدول فرعي دون كسر
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'archive'
  ) THEN
    CREATE VIEW public.archive AS 
      SELECT id, document_number as doc_number, title, category, 
             file_path, file_size, tags::text, archived_by as created_by, 
             created_at, updated_at
      FROM public.documents WHERE is_deleted = false;
  END IF;
END $$;
