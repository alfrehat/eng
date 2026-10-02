# CONTRACT_SOURCE_OF_TRUTH_REPORT.md
# Phase 5 — STEP 1 + STEP 2 Forensic Analysis
# Generated: 2026-09-11

## ============================================================
## STEP 1 — LOCALSTATE FORENSIC USAGE TABLE
## ============================================================

### CONSUMER FILES (PRODUCTION)
| File | Line | Variable | Operation | Read/Write | Business Purpose |
|------|------|----------|-----------|------------|------------------|
| contractManagementEngine.js | L17 | all 4 | IMPORT | - | Destructure from localState |
| contractManagementEngine.js | L607 | localContractClauses | READ | R | clause number fallback: .length+1 |
| contractManagementEngine.js | L657 | localContractClauses | READ | R | PUT clause: find by id+contract_id |
| contractManagementEngine.js | L683 | localContractClauses | READ | R | duplicate clause: find source |
| contractManagementEngine.js | L689 | localContractClauses | READ | R | duplicate clause: count for new num |
| contractManagementEngine.js | L720 | localContracts | READ | R | custom-template PUT: find contract |
| contractManagementEngine.js | L772 | localBankGuarantees | WRITE | W | POST guarantee: push new guarantee |
| contractManagementEngine.js | L790 | localBankGuarantees | READ | R | guarantee action: find by id |
| contractManagementEngine.js | L834 | localContracts | READ | R | workflow POST: find contract |
| contractManagementEngine.js | L864 | localContracts | READ | R | sign POST: find contract (CRITICAL: 404 if not found) |
| contractManagementEngine.js | L912 | localContracts | READ | R | guarantee alerts: fallback if PG fails |
| contractManagementEngine.js | L1007 | localContracts | READ | R | guarantee/extend: find contract |
| contractManagementEngine.js | L1040 | localVariationOrders | READ | R | GET variation-orders: fallback list |
| contractManagementEngine.js | L1103 | localVariationOrders | READ | R | POST variation-order: order_number generation |
| contractManagementEngine.js | L1122 | localVariationOrders | WRITE | W | POST variation-order: push VO |
| contractManagementEngine.js | L1125 | localContracts | READ | R | POST variation-order: update contract value |
| contractManagementEngine.js | L1171 | localContracts | READ | R | GET print: load contract (fallback) |
| contractManagementEngine.js | L1172 | localContractClauses | READ | R | GET print: load clauses (fallback) |

### WRITE ANALYSIS (CRITICAL — WHO POPULATES THE ARRAYS?)
| Array | WRITE Locations | Initializer | Hydration | Result |
|-------|----------------|-------------|-----------|--------|
| localContracts | NONE | [] empty | NEVER | ALWAYS EMPTY |
| localContractClauses | NONE | [] empty | NEVER | ALWAYS EMPTY |
| localBankGuarantees | L772 only (push) | [] empty | NEVER | Populated only in same process instance (lost on restart) |
| localVariationOrders | L1122 only (push) | [] empty | NEVER | Populated only in same process instance (lost on restart) |

### ANSWERS TO STOP-CONDITION QUESTIONS:
- Writes to arrays?          YES for localBankGuarantees (L772) and localVariationOrders (L1122)
- Loaded from any source?    NO — no hydration, no JSON load, no DB preload
- Used as cache?             ATTEMPTED but non-functional (empty on start, lost on restart)
- Route dependency?          YES — L864 sign endpoint returns 404 if localContracts empty (CRITICAL BUG)
- Workflow dependency?       YES — L834 workflow endpoint tries to update localContracts (silently fails)
- Historical data in them?   NO — arrays always [] on startup
- Hidden initialization?     NO — verified by grep scan. No require-time hydration exists.

### CRITICAL FINDING — L864 BUG:
  const contract = localContracts.find(...);
  if (!contract) return res.status(404)...  ← ALWAYS 404 since array is always empty
  // The sha256 signing route is COMPLETELY BROKEN in production.
  // The actual DB update below (queryPg) runs regardless, but the response
  // uses contract.digital_signatures from the null object — NEVER EXECUTED.

## ============================================================
## STEP 2 — CONTRACT DATA SOURCE DECISION
## ============================================================

### CANONICAL SOURCE ANALYSIS

#### TABLE COMPARISON
| Table | Used By | Primary Operations | Fields |
|-------|---------|-------------------|--------|
| public.contracts | contractManagementEngine.js (queryPg) | SELECT,INSERT,UPDATE,DELETE | id,title,contract_number,total_value,contractor_name,status,bank_name,guarantee_*,workflow_history,digital_signatures,sha256_hash,approval_stage,clauses,etc |
| public.construction_contracts | contractsEngineService.js (dbQuery) | SELECT,INSERT,UPDATE,DELETE | id,contract_number,title,tender_id,contractor_name,contract_value,start_date,end_date,bank_guarantees(JSONB),variation_orders(JSONB) |
| public.contract_clauses | contractManagementEngine.js only | SELECT,INSERT,UPDATE,DELETE | id,contract_id,clause_number,title,content,display_order |
| public.bank_guarantees | contractManagementEngine.js + contractsEngineService | SELECT,INSERT,UPDATE | id,contract_id,guarantee_type,amount,expiry_date,status,qr_code_data |
| public.contract_variation_orders | contractManagementEngine.js + contractsEngineService | SELECT,INSERT | id,contract_id,order_type,amount_change,time_extension_days |

#### ⚠ STOP CONDITION TRIGGERED: CONTRACT/CONSTRUCTION_CONTRACTS CONFLICT

contracts              → used by contractManagementEngine.js (API router)
                       → contractsEngineService tries public.construction_contracts FIRST,
                         then FALLS BACK to public.contracts as legacy (L209-232)
                       → projectsEngineService reads from public.contracts

construction_contracts → primary table of contractsEngineService.js
                       → stores bank_guarantees and variation_orders as JSONB columns
                         (in addition to normalized tables)

#### CONFLICT DETAILS:
- contractManagementEngine.js writes to: public.contracts (normalized)
- contractsEngineService.js writes to: public.construction_contracts (JSONB embedded)
- Both tables exist and both are written to by different code paths
- bank_guarantees exist in BOTH:
    • public.bank_guarantees (normalized, used by contractManagementEngine.js)
    • construction_contracts.bank_guarantees JSONB (embedded, used by contractsEngineService.js)
- variation_orders exist in BOTH:
    • public.contract_variation_orders (normalized, used by contractManagementEngine.js)
    • construction_contracts.variation_orders JSONB (embedded, used by contractsEngineService.js)

This is a SCHEMA CONFLICT requiring CONTRACT_SCHEMA_CONFLICT_REPORT before proceeding.
