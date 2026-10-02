# ENGINE_OWNERSHIP_FINAL.md
## التاريخ: 2026-09-11 | المرجع: Forensic Audit Baseline

---

## 1. القائمة الكاملة للمحركات المسجلة في EngineRegistry (autoRegisterAll)

| ENGINE_ID | CANONICAL_FILE | CATEGORY | STATUS | DOMAIN_TABLE | UI_LEAK |
|:---|:---|:---|:---|:---|:---|
| DATABASE_ENGINE | utils/database.js | CORE_SERVICE | OK | — | NO |
| NUMBERING_ENGINE | services/numberingEngine.js | CORE_SERVICE | OK | system_sequences | NO |
| AUTHORIZATION_ENGINE | services/authorizationEngineService.js / middlewares/rbacManager.js | CORE_SERVICE | OK | users,roles,permissions | NO |
| NOTIFICATION_ENGINE | services/notificationCenter.js | CORE_SERVICE | OK | notifications.json | NO |
| OBSERVABILITY_SERVICE | services/observabilityService.js | CORE_SERVICE | OK | — | NO |
| DATA_RECONCILIATION_ENGINE | services/dataReconciliationService.js | CORE_SERVICE | OK | — | NO |
| LOGGER_SERVICE | services/loggerService.js | CORE_SERVICE | OK | — | NO |
| VERIFICATION_ENGINE | services/cryptoSignatureService.js | CORE_SERVICE | OK | enterprise.digital_signatures | NO |
| BUSINESS_RULES_ENGINE | services/rulesEngineService.js | CORE_SERVICE | OK | — | NO |
| SPATIAL_GIS_ENGINE | services/spatialTranslator.js | CORE_SERVICE | OK | — | NO |
| PRINT_REPORT_ENGINE | services/reportsEngineService.js | CORE_SERVICE | OK | enterprise.print_templates | NO |
| ARCHIVE_DOCUMENT_ENGINE | services/archiveEngineService.js | CORE_SERVICE | OK | archive,documents | NO |
| WORKFLOW_ENGINE | routes/workflowRouter.js + Administration/API/workflowEngine.js | CORE_SERVICE | DUAL | — | NO |
| CONTRACT_TEMPLATE_ENGINE | services/contractTemplateEngine.js | DOMAIN_ENGINE | OK | — | NO |
| RAMS_ANALYTICS_ENGINE | Roads/Reports/ramsAnalyticsEngine.js | DOMAIN_ENGINE | OK | rams_roads,rams_segments | NO |
| PROJECTS_ENGINE | services/projectsEngineService.js | DOMAIN_ENGINE | OK | public.projects | NO |
| PROJECT_PORTFOLIO_ENGINE | services/projectPortfolioEngineService.js | DOMAIN_ENGINE | OK | project_portfolios,project_plans | NO |
| PROJECT_PRIORITIZATION_ENGINE | services/projectPrioritizationEngineService.js | DOMAIN_ENGINE | OK | project_priority_criteria | NO |
| PROJECT_FINANCIAL_PROGRAMMING_ENGINE | services/projectFinancialProgrammingEngineService.js | DOMAIN_ENGINE | OK | project_financial_programs | NO |
| PROJECT_DEPENDENCY_ENGINE | services/projectDependencyEngineService.js | DOMAIN_ENGINE | OK | project_dependencies | NO |
| PROJECT_SCHEDULING_ENGINE | services/projectSchedulingEngineService.js | DOMAIN_ENGINE | OK | project_schedules | NO |
| TENDERS_ENGINE | services/tendersEngineService.js | DOMAIN_ENGINE | OK | tenders | NO |
| CONTRACTS_ENGINE | services/contractsEngineService.js | DOMAIN_ENGINE | OK | construction_contracts | NO |
| CLAIMS_ENGINE | services/claimsEngineService.js | DOMAIN_ENGINE | OK | claims | NO |
| BUDGET_ENGINE | services/budgetEngineService.js | DOMAIN_ENGINE | OK | directorate_budget_lines | NO |
| PURCHASES_ENGINE | services/purchasesEngineService.js | DOMAIN_ENGINE | OK | purchases | NO |
| ROADS_ENGINE | services/roadsEngineService.js | DOMAIN_ENGINE | OK | roads,pavement_inspections | NO |
| GIS_SURVEY_ENGINE | services/gisSurveyService.js | DOMAIN_ENGINE | OK | gis_survey_points | NO |
| PAVEMENT_RETURNS_ENGINE | services/pavementReturnsEngineService.js | DOMAIN_ENGINE | OK | paving_returns | NO |
| ASSETS_ENGINE | services/assetsEngineService.js | DOMAIN_ENGINE | OK | structural_assets,excavation_permits | NO |
| SPECIALIZED_ASSETS_ENGINE | services/specializedAssetsEngine.js | DOMAIN_ENGINE | OK | energy_lighting,infrastructure_networks | NO |
| ENERGY_LIGHTING_ENGINE | Assets/Pages/energyLighting.js | DOMAIN_ENGINE | UI_LEAK | energy_lighting | YES_CRITICAL |
| INFRASTRUCTURE_NETWORKS_ENGINE | Assets/Pages/infrastructureNetworks.js | DOMAIN_ENGINE | UI_LEAK | infrastructure_networks | YES_CRITICAL |
| STRUCTURAL_ASSETS_ENGINE | Assets/Pages/structuralAssets.js | DOMAIN_ENGINE | UI_LEAK | structural_assets | YES_CRITICAL |
| TASKS_ENGINE | services/tasksEngineService.js | DOMAIN_ENGINE | OK | tasks | NO |
| INSPECTION_ENGINE | services/inspectionEngineService.js | DOMAIN_ENGINE | OK | pavement_inspections | NO |
| G2G_GATEWAY_ENGINE | services/g2gGatewayEngineService.js | DOMAIN_ENGINE | OK | — | NO |
| WORK_OPERATIONS_CENTER | services/workOperationsCenterService.js | DOMAIN_ENGINE | OK | — | NO |

---

## 2. المحركات الموازية (Domain Implementations في API Routers — يجب تحويلها لـ Adapters)

| API_ROUTER | PARALLEL_LOGIC | PRIMARY_ENGINE | DECISION |
|:---|:---|:---|:---|
| Tenders/API/tendersEngine.js | CRUD كامل + memDb helpers مستقلة | TENDERS_ENGINE | تحويل لـ Adapter |
| Tenders/API/claimsEngine.js | CRUD + withTransaction | CLAIMS_ENGINE | تحويل لـ Adapter (الحفاظ على withTransaction) |
| Roads/API/roadsEngine.js | CRUD + 13 pool.query مباشر | ROADS_ENGINE | إصلاح DB bypass أولاً + تحويل |
| PavementReturns/API/pavingReturns.js | CRUD + 10 pool.query مباشر | PAVEMENT_RETURNS_ENGINE | إصلاح DB bypass أولاً + تحويل |
| Contracts/API/contractManagementEngine.js | CRUD + require('pg') + localState | CONTRACTS_ENGINE | إصلاح DB + localState + تحويل |
| Reports/API/printTemplatesEngine.js | 5 pool.query مباشر | PRINT_REPORT_ENGINE | إصلاح DB bypass |
| Assets/API/assetsEngine.js | CRUD | ASSETS_ENGINE | تحويل لـ Adapter |
| Committees/API/committeesEngine.js | CRUD | (لا primary engine موجود، يُبقى كما هو) | NO_CHANGE |
| Inspection/API/inspections.js | CRUD | INSPECTION_ENGINE | تحويل لـ Adapter |

---

## 3. UI Leaks في EngineRegistry (Section G)

| LEAK | السطر في engineRegistry.js | الملف المستورد | العمليات الفعلية |
|:---|:---|:---|:---|
| ENERGY_LIGHTING_ENGINE | L938 | Assets/Pages/energyLighting.js | exposedOperations تُستدعى من specializedAssetsEngine فعلاً |
| INFRASTRUCTURE_NETWORKS_ENGINE | L954 | Assets/Pages/infrastructureNetworks.js | exposedOperations تُستدعى من specializedAssetsEngine فعلاً |
| STRUCTURAL_ASSETS_ENGINE | L970 | Assets/Pages/structuralAssets.js | exposedOperations تُستدعى من specializedAssetsEngine فعلاً |

**الحل**: استبدال instance = UIPageFile بـ instance = specializedAssetsEngine (المحرك الفعلي المسجل بالفعل).
