-- =============================================================================
-- migrations/015_drop_legacy_variation_orders_column.sql
-- PHASE 5C: FINAL REMOVAL OF LEGACY JSONB COLUMN
-- Target: public.construction_contracts.variation_orders
-- Canonical Replacement: public.contract_variation_orders
-- Date: 2026-09-11
-- Authorization: Explicit User Approval Granted based on 0-Reference Forensic Proof
-- STRICT RULE: NO CASCADE ALLOWED. PRE-DROP ASSERTIONS MANDATORY.
-- =============================================================================

DO $$
DECLARE
  v_schema_exists BOOLEAN;
  v_table_exists BOOLEAN;
  v_col_exists BOOLEAN;
  v_canonical_exists BOOLEAN;
  v_non_empty_count INT;
  v_dep_count INT;
BEGIN
  -- 0. Assertion: Check schema public existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'public'
  ) INTO v_schema_exists;

  IF NOT v_schema_exists THEN
    RAISE EXCEPTION 'PRE-DROP ASSERTION FAILED: Schema public does not exist.';
  END IF;

  -- 1. Assertion: Check table existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'construction_contracts'
  ) INTO v_table_exists;

  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'PRE-DROP ASSERTION FAILED: Table public.construction_contracts does not exist.';
  END IF;

  -- 2. Assertion: Check column existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'construction_contracts' 
      AND column_name = 'variation_orders'
  ) INTO v_col_exists;

  IF NOT v_col_exists THEN
    RAISE NOTICE 'PRE-DROP NOTICE: Column public.construction_contracts.variation_orders does not exist. Already dropped.';
    RETURN;
  END IF;

  -- 3. Assertion: Check canonical table existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'contract_variation_orders'
  ) INTO v_canonical_exists;

  IF NOT v_canonical_exists THEN
    RAISE EXCEPTION 'PRE-DROP ASSERTION FAILED: Canonical table public.contract_variation_orders does not exist.';
  END IF;

  -- 4. Assertion: Check for non-empty records (Zero Data Loss Protection)
  EXECUTE 'SELECT COUNT(*) FROM public.construction_contracts WHERE variation_orders IS NOT NULL AND variation_orders::text != ''[]'' AND variation_orders::text != '''''
  INTO v_non_empty_count;

  IF v_non_empty_count > 0 THEN
    RAISE EXCEPTION 'PRE-DROP ASSERTION FAILED: Found % non-empty record(s) in public.construction_contracts.variation_orders. Aborting DROP.', v_non_empty_count;
  END IF;

  -- 5. Assertion: Check dependent database objects (Views, Indexes, Constraints, Triggers)
  SELECT COUNT(*) INTO v_dep_count
  FROM pg_depend dep
  JOIN pg_attribute att ON dep.refobjid = att.attrelid AND dep.refobjsubid = att.attnum
  JOIN pg_class cls ON att.attrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'construction_contracts'
    AND att.attname = 'variation_orders'
    AND dep.deptype NOT IN ('i', 'a');

  IF v_dep_count > 0 THEN
    RAISE EXCEPTION 'PRE-DROP ASSERTION FAILED: Found % dependent database object(s) on column variation_orders. Aborting DROP.', v_dep_count;
  END IF;

  RAISE NOTICE '✅ ALL PRE-DROP ASSERTIONS PASSED SUCCESSFULLY.';

  -- 6. DROP COLUMN (STRICTLY WITHOUT CASCADE)
  EXECUTE 'ALTER TABLE public.construction_contracts DROP COLUMN variation_orders';
  RAISE NOTICE '✅ COLUMN DROP EXECUTED: ALTER TABLE public.construction_contracts DROP COLUMN variation_orders;';
END $$;

-- 7. Verification Query
DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'construction_contracts' 
      AND column_name = 'variation_orders'
  ) INTO v_still_exists;

  IF v_still_exists THEN
    RAISE EXCEPTION 'POST-DROP VALIDATION FAILED: Column variation_orders still exists in public.construction_contracts!';
  ELSE
    RAISE NOTICE '✅ POST-DROP VALIDATION PASSED: Column variation_orders successfully removed from public.construction_contracts.';
  END IF;
END $$;
