-- =============================================================================
-- migrations/023_canonical_sequences_and_tasks_schema.sql
-- 🏛️ التوثيق الكنوني لمخطط جداول الترقيم المركزي والمهام الإدارية
-- نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
--
-- الهدف:
-- 1. القضاء التام على Runtime DDL في services/numberingEngine.js و services/tasksEngineService.js
-- 2. إضفاء الطابع الكنوني الرسمي عبر Migration نسخي لجدول عدادات الترقيم public.system_sequences
-- 3. تأكيد وتثبيت فهارس وحقول جدول المهام public.tasks
-- =============================================================================

-- 1. جدول متسلسلات الترقيم المركزي (public.system_sequences)
CREATE TABLE IF NOT EXISTS public.system_sequences (
  seq_key VARCHAR(100) PRIMARY KEY,
  prefix VARCHAR(20) NOT NULL,
  fiscal_year INT NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_sequences_year ON public.system_sequences (fiscal_year);

-- 2. جدول المهام الإدارية والتكليفات الفنية (public.tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
  id VARCHAR(100) PRIMARY KEY,
  task_number VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  assigned_to VARCHAR(100),
  due_date VARCHAR(50),
  priority VARCHAR(50) DEFAULT 'MEDIUM',
  status VARCHAR(50) DEFAULT 'NEW',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);
