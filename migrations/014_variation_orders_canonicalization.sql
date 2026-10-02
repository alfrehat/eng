-- =============================================================================
-- migrations/014_variation_orders_canonicalization.sql
-- CANONICAL VARIATION ORDER TABLE = public.contract_variation_orders (قرار إلزامي)
-- Legacy/Duplicate Storage = construction_contracts.variation_orders (JSONB) + localVariationOrders[]
-- تاريخ: 2026-09-11
-- المالك الوحيد لمنطق أوامر التغيير: CONTRACTS_ENGINE (services/contractsEngineService.js)
-- =============================================================================

-- 1) ضمان وجود الجدول الكنوني (idempotent — مطابق لـ migration 000 §4.6)
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

CREATE INDEX IF NOT EXISTS idx_contract_variation_orders_contract
  ON public.contract_variation_orders (contract_id);

-- 2) Reconciliation: نقل أي سجل فريد من JSONB القديم إلى الجدول الكنوني
--    (ON CONFLICT DO NOTHING ⇒ لا فقدان بيانات ولا إعادة كتابة للسجلات الموجودة)
INSERT INTO public.contract_variation_orders
  (id, contract_id, order_number, order_type, amount_change, time_extension_days, reason, approved_by, status, created_at)
SELECT vo->>'id',
       c.id,
       COALESCE(vo->>'vo_number', vo->>'order_number', vo->>'id'),
       COALESCE(vo->>'order_type', CASE WHEN COALESCE((vo->>'amount')::numeric, (vo->>'amount_change')::numeric, 0) >= 0 THEN 'VALUE_INCREASE' ELSE 'VALUE_DECREASE' END),
       COALESCE((vo->>'amount')::numeric, (vo->>'amount_change')::numeric, 0),
       COALESCE((vo->>'extensionDays')::int, (vo->>'extension_days')::int, (vo->>'time_extension_days')::int, 0),
       COALESCE(vo->>'description', vo->>'reason', vo->>'title', ''),
       COALESCE(vo->>'approved_by', vo->>'approvedBy', 'RECONCILIATION_MIGRATION'),
       COALESCE(vo->>'status', 'APPROVED'),
       COALESCE(vo->>'createdAt', vo->>'created_at', NOW())
FROM public.construction_contracts c
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.variation_orders, '[]'::jsonb)) AS vo
WHERE vo ? 'id'
ON CONFLICT (id) DO NOTHING;

-- 3) ملاحظة مهمة (Database Protection Rule):
--    لا يتم حذف عمود construction_contracts.variation_orders في هذه المرحلة.
--    الحذف مشروط بإثبات: 0 readers / 0 writers / 0 dynamic references
--    (انظر تقرير VARIATION_ORDER_CANONICALIZATION.md)
