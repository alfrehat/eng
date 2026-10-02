-- =============================================================================
-- migrations/021_canonical_contracts_schema.sql
-- 🏛️ توحيد وحسم مصدر الحقيقة لجدول العقود (Canonical Contract Table Unification)
-- نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
--
-- المصدر القانوني والمعتمد الوحيد للعقود: public.contracts
-- معالجة construction_contracts: تحويله إلى Legacy Compatibility View مع مشغلات INSTEAD OF
-- لضمان مسار كتابة وقراءة موحد 100% بدون ازدواجية وبدون أي كسر للتوافقية العكسية.
-- =============================================================================

-- 1. إضافة الحقول التكميلية في الجدول الكنوني public.contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS budget_line_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(15,2);

-- 2. توحيد القيم المالية في الجدول الكنوني
UPDATE public.contracts 
SET contract_value = total_value 
WHERE contract_value IS NULL AND total_value IS NOT NULL;

UPDATE public.contracts 
SET total_value = contract_value 
WHERE total_value IS NULL AND contract_value IS NOT NULL;

-- 3. مزامنة أي بيانات قديمة من construction_contracts قبل تحويله
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'construction_contracts' AND table_type = 'BASE TABLE'
  ) THEN
    INSERT INTO public.contracts (
      id, contract_number, title, tender_id, contractor_name,
      total_value, contract_value, start_date, end_date, budget_line_id,
      status, notes, created_at, updated_at
    )
    SELECT 
      cc.id, 
      COALESCE(cc.contract_number, cc.id), 
      COALESCE(cc.title, 'عقد إنشائي'), 
      cc.tender_id, 
      COALESCE(cc.contractor_name, 'المقاول المحال عليه'),
      COALESCE(cc.contract_value, 0), 
      COALESCE(cc.contract_value, 0), 
      CASE WHEN cc.start_date IS NOT NULL AND cc.start_date ~ '^\d{4}-\d{2}-\d{2}' THEN cc.start_date::date ELSE CURRENT_DATE END,
      CASE WHEN cc.end_date IS NOT NULL AND cc.end_date ~ '^\d{4}-\d{2}-\d{2}' THEN cc.end_date::date ELSE CURRENT_DATE + INTERVAL '60 days' END,
      cc.budget_line_id,
      COALESCE(cc.status, 'ACTIVE'), 
      cc.notes, 
      COALESCE(cc.created_at, NOW()), 
      COALESCE(cc.updated_at, NOW())
    FROM public.construction_contracts cc
    ON CONFLICT (id) DO UPDATE SET
      contract_value = COALESCE(public.contracts.contract_value, EXCLUDED.contract_value),
      budget_line_id = COALESCE(public.contracts.budget_line_id, EXCLUDED.budget_line_id);
    
    -- إسقاط الجدول القديم لإعادة بنائه كـ View متوافق 100%
    DROP TABLE public.construction_contracts CASCADE;
  END IF;
END $$;

-- 4. إنشاء واجهة التوافقية العكسية (Legacy Compatibility View) فوق public.contracts
CREATE OR REPLACE VIEW public.construction_contracts AS
SELECT 
  c.id,
  c.contract_number,
  c.title,
  c.tender_id,
  c.contractor_name,
  COALESCE(c.contract_value, c.total_value, 0) AS contract_value,
  c.start_date::text AS start_date,
  c.end_date::text AS end_date,
  c.budget_line_id,
  c.status,
  COALESCE(
    (SELECT jsonb_agg(to_jsonb(bg)) FROM public.bank_guarantees bg WHERE bg.contract_id = c.id),
    '[]'::jsonb
  ) AS bank_guarantees,
  c.notes,
  c.created_at,
  c.updated_at
FROM public.contracts c;

-- 5. إنشاء دالة ومشغل INSTEAD OF لتحويل أي كتابة legacy على construction_contracts إلى public.contracts
CREATE OR REPLACE FUNCTION public.trg_construction_contracts_view_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.contracts (
      id, contract_number, title, tender_id, contractor_name,
      total_value, contract_value, budget_line_id,
      status, notes, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.contract_number, NEW.title, NEW.tender_id, NEW.contractor_name,
      COALESCE(NEW.contract_value, 0), COALESCE(NEW.contract_value, 0), NEW.budget_line_id,
      COALESCE(NEW.status, 'ACTIVE'), NEW.notes, COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      contractor_name = EXCLUDED.contractor_name,
      total_value = EXCLUDED.total_value,
      contract_value = EXCLUDED.contract_value,
      budget_line_id = EXCLUDED.budget_line_id,
      status = EXCLUDED.status,
      updated_at = NOW();
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.contracts SET
      title = COALESCE(NEW.title, title),
      contractor_name = COALESCE(NEW.contractor_name, contractor_name),
      total_value = COALESCE(NEW.contract_value, total_value),
      contract_value = COALESCE(NEW.contract_value, contract_value),
      budget_line_id = COALESCE(NEW.budget_line_id, budget_line_id),
      status = COALESCE(NEW.status, status),
      notes = COALESCE(NEW.notes, notes),
      updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.contracts WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_construction_contracts_view ON public.construction_contracts;
CREATE TRIGGER trg_construction_contracts_view
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.construction_contracts
FOR EACH ROW EXECUTE FUNCTION public.trg_construction_contracts_view_sync();

-- 6. إنشاء الفهارس لتعزيز كفاءة الاستعلام
CREATE INDEX IF NOT EXISTS idx_contracts_canonical_number ON public.contracts (contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_canonical_tender ON public.contracts (tender_id);
CREATE INDEX IF NOT EXISTS idx_contracts_canonical_status ON public.contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_canonical_budget ON public.contracts (budget_line_id);
