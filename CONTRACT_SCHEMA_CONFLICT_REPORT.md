# CONTRACT_SCHEMA_CONFLICT_REPORT.md
# Phase 5 — STEP 5: Schema Conflict — STOP CONDITION ACTIVATED
# Generated: 2026-09-11

## STOP CONDITION: CONTRACT/CONSTRUCTION_CONTRACTS CONFLICT
## =========================================================
## Per Phase 5 instructions STEP 5: Execution HALTED.
## This report must be reviewed and canonical table decided before proceeding.

## CONFLICT SUMMARY TABLE

| TABLE | USED_BY | READS | WRITES | KEY_FIELDS | NOTES |
|-------|---------|-------|--------|-----------|-------|
| public.contracts | contractManagementEngine.js | YES (queryPg) | YES (queryPg) | id, title, contract_number, total_value, contractor_name, status, bank_name, guarantee_*, approval_stage, workflow_history, digital_signatures, sha256_hash, first_party_info, second_party_info, handover_committee | RICH SCHEMA — primary API table |
| public.construction_contracts | contractsEngineService.js | YES (dbQuery) | YES (dbRun) | id, contract_number, title, tender_id, contractor_name, contract_value, bank_guarantees(JSONB), variation_orders(JSONB) | SIMPLER SCHEMA — embedded JSONB approach |
| public.contract_clauses | contractManagementEngine.js | YES | YES | id, contract_id, clause_number, title, content, display_order | Normalized — OK. No conflict. |
| public.bank_guarantees | contractManagementEngine.js + contractsEngineService | YES | YES (both) | id, contract_id, guarantee_type, amount, expiry_date, status, qr_code_data, barcode_data | DUAL WRITE: normalized table + also embedded in construction_contracts.bank_guarantees JSONB |
| public.contract_variation_orders | contractManagementEngine.js + contractsEngineService | YES | YES (both) | id, contract_id, order_type, amount_change, time_extension_days | DUAL WRITE: normalized table + also embedded in construction_contracts.variation_orders JSONB |

## FOREIGN KEYS
| TABLE | FK_COLUMN | REFERENCES | CASCADE | STATUS |
|-------|-----------|------------|---------|--------|
| public.contract_clauses | contract_id | public.contracts(id) | DELETE CASCADE | Depends on contracts (not construction_contracts) |
| public.bank_guarantees | contract_id | public.contracts(id) | DELETE CASCADE | Depends on contracts (not construction_contracts) |
| public.contract_variation_orders | contract_id | public.contracts(id) | DELETE CASCADE | Depends on contracts (not construction_contracts) |

## WORKFLOW REFERENCES
- contractManagementEngine.js routes: POST /:id/workflow → writes to public.contracts.workflow_history
- contractManagementEngine.js routes: POST /:id/sign → writes to public.contracts.digital_signatures
- contractsEngineService.js: updates public.construction_contracts.status
- No foreign key from construction_contracts to contracts (independent tables)

## ANALYSIS: WHY THE CONFLICT EXISTS
contractManagementEngine.js was written for the legacy ERP structure using public.contracts.
contractsEngineService.js was written later using public.construction_contracts with JSONB embedded approach.
Both are active production code paths. Both write to DB. The normalized sub-tables
(contract_clauses, bank_guarantees, contract_variation_orders) have FK to public.contracts only.

## CANONICAL TABLE RECOMMENDATION (AWAITING USER DECISION)

### Option A: public.contracts = CANONICAL
- Pros: Already has FK from all sub-tables. Has richer schema. Used by active API routes (contractManagementEngine.js). Supports digital_signatures, sha256_hash, workflow_history, approval_stage.
- Cons: contractsEngineService.js must be updated to use public.contracts (drop construction_contracts writes).
- Action: Migrate construction_contracts data to contracts, update contractsEngineService to read/write public.contracts, keep sub-tables normalized.

### Option B: public.construction_contracts = CANONICAL  
- Pros: Cleaner JSONB embedded approach for BI.
- Cons: Requires rebuilding FK from contract_clauses, bank_guarantees, contract_variation_orders to construction_contracts. Requires rewriting contractManagementEngine.js SQL. High risk.
- Action: NOT RECOMMENDED — high migration risk.

### Option C (RECOMMENDED): public.contracts = CANONICAL (immediate), with contractsEngineService bridged
- Keep public.contracts as canonical.
- In contractsEngineService.getContracts(): query public.contracts as primary (swap priority — currently construction_contracts is primary with contracts as fallback at L186/L212).
- Keep public.construction_contracts as alias view or leave in place (no new writes to it from contractsEngineService).
- bank_guarantees and contract_variation_orders remain normalized sub-tables with FK to public.contracts.
- Remove JSONB duplication of bank_guarantees and variation_orders from construction_contracts.

## LOCALSTATE IMPACT (Back to Phase 5 Goal)
Given the conflict analysis, the localState arrays map as follows:

| localState Array | Target Canonical Table | Action After Decision |
|-----------------|------------------------|----------------------|
| localContracts | public.contracts | Replace reads with queryPg → public.contracts (already done in some routes) |
| localContractClauses | public.contract_clauses | Replace reads with queryPg → public.contract_clauses (L607, L657, L683, L689 use empty array — safe to fix) |
| localBankGuarantees | public.bank_guarantees | Replace push (L772) + find (L790) with queryPg → public.bank_guarantees |
| localVariationOrders | public.contract_variation_orders | Replace push (L1122) + filter (L1040) + length (L1103) with queryPg → public.contract_variation_orders |

## CRITICAL BUG IDENTIFIED — L864 sign endpoint
  localContracts is always [] → the find() always returns undefined →
  the route returns HTTP 404 for ALL sign requests → the sign endpoint is broken in production.
  Fix: replace localContracts.find() with queryPg(req, 'SELECT * FROM public.contracts WHERE id=\', [id])

## REQUIRED USER DECISION BEFORE PROCEEDING
1. Confirm Option C: public.contracts = CANONICAL TABLE
2. Authorize contractsEngineService.js to be updated to query public.contracts as PRIMARY
3. Authorize localState reads to be replaced with direct queryPg to canonical tables
4. Authorize removal of JSONB duplication pattern in construction_contracts (optional — lower priority)

## STATUS: HALTED — AWAITING USER AUTHORIZATION
