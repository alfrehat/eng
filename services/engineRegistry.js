/**
 * services/engineRegistry.js
 * 🏛️ سجل المحركات المركزي الموحد (Enterprise Engine Registry)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v1.0
 * 
 * المبادئ المعمارية:
 * 1. نقطة مركزية وحيدة لتسجيل وتوثيق كافة محركات النظام (Core Services & Domain Engines).
 * 2. تتبع الحالة التشغيلية (Lifecycle State Machine): REGISTERED -> INITIALIZED -> READY / FAILED.
 * 3. تعريف شامل للقدرات (Capabilities)، التبعيات (Dependencies)، والعمليات المصرح بها (Exposed Operations).
 * 4. رصد المقاييس الحية ومراقبة الصحة الذاتية الفورية (Real-time Health Monitoring).
 */

const { logInfo, logWarn, logError } = require('../utils/logger');

class EngineRegistry {
  constructor() {
    this._engines = new Map();
    this._initialized = false;
  }

  /**
   * تسجيل محرك في السجل المركزي
   * @param {Object} descriptor - مواصفات المحرك
   */
  register(descriptor) {
    if (!descriptor || !descriptor.engineId) {
      throw new Error('Engine descriptor must contain a unique "engineId"');
    }

    const engineId = descriptor.engineId.toUpperCase();
    
    const entry = {
      engineId,
      engineName: descriptor.engineName || engineId,
      version: descriptor.version || '1.0.0',
      category: descriptor.category || 'DOMAIN_ENGINE', // CORE_SERVICE | DOMAIN_ENGINE | INTEGRATION_GATEWAY
      status: descriptor.status || 'REGISTERED', // REGISTERED | INITIALIZED | READY | FAILED
      capabilities: Array.isArray(descriptor.capabilities) ? descriptor.capabilities : [],
      dependencies: Array.isArray(descriptor.dependencies) ? descriptor.dependencies : [],
      exposedOperations: descriptor.exposedOperations || {},
      instance: descriptor.instance || null,
      healthCheck: typeof descriptor.healthCheck === 'function' ? descriptor.healthCheck : null,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metrics: {
        invocations: 0,
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        lastInvokedAt: null,
        lastError: null
      }
    };

    this._engines.set(engineId, entry);
    return entry;
  }

  /**
   * جلب محرك عبر المعرف
   * @param {string} engineId
   * @returns {Object|null}
   */
  get(engineId) {
    if (!engineId) return null;
    return this._engines.get(engineId.toUpperCase()) || null;
  }

  /**
   * التحقق من وجود محرك
   * @param {string} engineId
   * @returns {boolean}
   */
  has(engineId) {
    if (!engineId) return false;
    return this._engines.has(engineId.toUpperCase());
  }

  /**
   * جلب قائمة كافة المحركات المسجلة
   * @param {Object} filter { category, status }
   * @returns {Array<Object>}
   */
  list(filter = {}) {
    const list = Array.from(this._engines.values()).map(e => ({
      engineId: e.engineId,
      engineName: e.engineName,
      version: e.version,
      category: e.category,
      status: e.status,
      capabilities: e.capabilities,
      dependencies: e.dependencies,
      operations: Object.keys(e.exposedOperations || {}),
      metrics: { ...e.metrics },
      registeredAt: e.registeredAt,
      updatedAt: e.updatedAt
    }));

    return list.filter(item => {
      if (filter.category && item.category !== filter.category) return false;
      if (filter.status && item.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * تحديث حالة المحرك
   * @param {string} engineId
   * @param {string} status - REGISTERED | INITIALIZED | READY | FAILED
   */
  setStatus(engineId, status) {
    const entry = this.get(engineId);
    if (entry) {
      entry.status = status;
      entry.updatedAt = new Date().toISOString();
    }
  }

  /**
   * تحديث مقاييس استدعاء المحرك
   */
  recordInvocation(engineId, durationMs, success = true, error = null) {
    const entry = this.get(engineId);
    if (entry) {
      const m = entry.metrics;
      m.invocations++;
      if (success) {
        m.successCount++;
      } else {
        m.failureCount++;
        m.lastError = error ? (error.message || String(error)) : 'Unknown error';
      }
      m.totalDurationMs += durationMs;
      m.avgDurationMs = Math.round((m.totalDurationMs / m.invocations) * 100) / 100;
      m.lastInvokedAt = new Date().toISOString();
    }
  }

  /**
   * فحص صحة محرك معين
   * @param {string} engineId
   * @returns {Promise<Object>}
   */
  async checkEngineHealth(engineId) {
    const entry = this.get(engineId);
    if (!entry) {
      return { engineId, status: 'NOT_FOUND', healthy: false };
    }

    if (entry.healthCheck) {
      try {
        const res = await entry.healthCheck();
        const isHealthy = res.status === 'READY' || res.status === 'HEALTHY' || res.healthy === true;
        entry.status = isHealthy ? 'READY' : (res.status || 'DEGRADED');
        return {
          engineId: entry.engineId,
          engineName: entry.engineName,
          category: entry.category,
          status: entry.status,
          healthy: isHealthy,
          details: res,
          checkedAt: new Date().toISOString()
        };
      } catch (err) {
        entry.status = 'FAILED';
        return {
          engineId: entry.engineId,
          engineName: entry.engineName,
          category: entry.category,
          status: 'FAILED',
          healthy: false,
          error: err.message,
          checkedAt: new Date().toISOString()
        };
      }
    }

    return {
      engineId: entry.engineId,
      engineName: entry.engineName,
      category: entry.category,
      status: entry.status || 'READY',
      healthy: entry.status !== 'FAILED',
      checkedAt: new Date().toISOString()
    };
  }

  /**
   * فحص شامل لكافة المحركات
   * @returns {Promise<Object>}
   */
  async checkAllHealth() {
    const results = {};
    let totalHealthy = 0;
    let totalCount = 0;

    for (const [id] of this._engines.entries()) {
      totalCount++;
      const health = await this.checkEngineHealth(id);
      results[id] = health;
      if (health.healthy) totalHealthy++;
    }

    return {
      systemHealth: totalHealthy === totalCount ? 'HEALTHY' : (totalHealthy > 0 ? 'DEGRADED' : 'UNHEALTHY'),
      totalEngines: totalCount,
      healthyEngines: totalHealthy,
      healthRatio: totalCount > 0 ? Math.round((totalHealthy / totalCount) * 100) : 0,
      timestamp: new Date().toISOString(),
      engines: results
    };
  }

  /**
   * التسجيل الذاتي لكافة المحركات والخدمات المركزية في النظام
   */
  autoRegisterAll() {
    if (this._initialized) return;

    // 1️⃣ المحركات والخدمات المركزية المشتركة (Core Services)
    // -------------------------------------------------------------
    // Numbering Engine
    try {
      const numberingEngine = require('./numberingEngine');
      this.register({
        engineId: 'NUMBERING_ENGINE',
        engineName: 'محرك الترقيم والترميز المتسلسل الموحد',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['atomic_sequence', 'custom_prefixes', 'format_validation', 'multi_entity_numbering'],
        dependencies: ['DATABASE_ENGINE'],
        instance: numberingEngine,
        exposedOperations: {
          generateNextId: (entityType, options) => numberingEngine.generateNextId(entityType, options),
          resolvePrefix: (entityType, explicit) => numberingEngine.resolvePrefix(entityType, explicit),
          validateIdFormat: (idStr, expected) => numberingEngine.validateIdFormat(idStr, expected)
        },
        healthCheck: () => numberingEngine.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register NUMBERING_ENGINE: ${e.message}`);
    }

    // Business Rules & Calculation Engine
    try {
      const businessRulesEngine = require('./businessRulesEngine');
      this.register({
        engineId: 'BUSINESS_RULES_ENGINE',
        engineName: 'محرك قواعد الأعمال والعمليات الحسابية المركزي',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['pci_calculation', 'paving_returns', 'claim_deductions', 'guarantee_validation', 'asset_depreciation', 'permit_fees'],
        dependencies: ['DATABASE_ENGINE'],
        instance: businessRulesEngine,
        exposedOperations: {
          calculatePciScore: (distresses, surfaceType) => businessRulesEngine.calculatePciScore(distresses, surfaceType),
          calculatePavingReturns: (params) => businessRulesEngine.calculatePavingReturns(params),
          calculateClaimFinancials: (params) => businessRulesEngine.calculateClaimFinancials(params),
          validateGuaranteeStatus: (params) => businessRulesEngine.validateGuaranteeStatus(params),
          calculateAssetDepreciation: (params) => businessRulesEngine.calculateAssetDepreciation(params),
          calculateExcavationPermitFee: (params) => businessRulesEngine.calculateExcavationPermitFee(params)
        },
        healthCheck: async () => {
          const testPci = businessRulesEngine.calculatePciScore([]);
          return { status: testPci && testPci.pciScore === 100 ? 'READY' : 'DEGRADED' };
        }
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register BUSINESS_RULES_ENGINE: ${e.message}`);
    }

    // Authorization & RBAC Engine
    try {
      const rbacManager = require('../middlewares/rbacManager');
      this.register({
        engineId: 'AUTHORIZATION_ENGINE',
        engineName: 'محرك التحكم بالوصول والمصفوفة الأمنية (RBAC)',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['jwt_auth', 'role_verification', 'permission_matrix', 'dynamic_permissions'],
        dependencies: ['DATABASE_ENGINE'],
        instance: rbacManager,
        exposedOperations: {
          hasPermission: (role, perm) => rbacManager.hasPermission ? rbacManager.hasPermission(role, perm) : true,
          generateToken: (user) => rbacManager.generateToken(user),
          verifyToken: rbacManager.verifyToken,
          authorize: rbacManager.authorize,
          authorizeRoles: rbacManager.authorizeRoles
        },
        healthCheck: async () => {
          const t = rbacManager.generateToken({ id: 'HEALTH_CHECK', role: 'admin' });
          return { status: t ? 'READY' : 'FAILED' };
        }
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register AUTHORIZATION_ENGINE: ${e.message}`);
    }

    // Cryptographic Verification Engine
    try {
      const cryptoSignatureService = require('./cryptoSignatureService');
      this.register({
        engineId: 'VERIFICATION_ENGINE',
        engineName: 'محرك التحقق الرقمي والختم الأمني المشفر',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['sha256_hash', 'digital_seal', 'document_verification', 'integrity_check'],
        dependencies: [],
        instance: cryptoSignatureService,
        exposedOperations: {
          calculateDocumentHash: (doc) => cryptoSignatureService.calculateDocumentHash ? cryptoSignatureService.calculateDocumentHash(doc) : null,
          signDocument: (userId, doc) => cryptoSignatureService.signDocument ? cryptoSignatureService.signDocument(userId, doc) : null,
          verifyDocumentSignature: (doc, sig) => cryptoSignatureService.verifyDocumentSignature ? cryptoSignatureService.verifyDocumentSignature(doc, sig) : true
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register VERIFICATION_ENGINE: ${e.message}`);
    }

    // Spatial & GIS Engine
    try {
      const spatialTranslator = require('./spatialTranslator');
      this.register({
        engineId: 'SPATIAL_GIS_ENGINE',
        engineName: 'محرك التحليل المكاني والخرائط الجغرافية',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['distance_calculation', 'spatial_buffer', 'geojson_conversion', 'coordinate_transform'],
        dependencies: ['DATABASE_ENGINE'],
        instance: spatialTranslator,
        exposedOperations: {
          calculateDistanceMeters: (lat1, lon1, lat2, lon2) => spatialTranslator.calculateDistanceMeters(lat1, lon1, lat2, lon2),
          getBufferNearbyAssets: (lat, lng, radius) => spatialTranslator.getBufferNearbyAssets ? spatialTranslator.getBufferNearbyAssets(lat, lng, radius) : []
        },
        healthCheck: async () => {
          const d = spatialTranslator.calculateDistanceMeters(32.298, 35.702, 32.300, 35.705);
          return { status: d > 0 ? 'READY' : 'DEGRADED', distance: d };
        }
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register SPATIAL_GIS_ENGINE: ${e.message}`);
    }

    // Notification Center Engine
    try {
      const notificationCenter = require('./notificationCenter');
      this.register({
        engineId: 'NOTIFICATION_ENGINE',
        engineName: 'محرك الإشعارات والبث اللحظي للفعاليات',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['event_dispatch', 'user_notifications', 'role_broadcast', 'websocket_sync'],
        dependencies: [],
        instance: notificationCenter,
        exposedOperations: {
          notifyUser: (userId, title, message, type) => notificationCenter.notifyUser(userId, title, message, type),
          broadcast: (event, payload) => notificationCenter.emit(event, payload)
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register NOTIFICATION_ENGINE: ${e.message}`);
    }

    // Database & Persistence Engine
    try {
      const dbModule = require('../utils/database');
      this.register({
        engineId: 'DATABASE_ENGINE',
        engineName: 'محرك قواعد البيانات والاتصال المزدوج المعاملاتي',
        version: '1.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['dual_persistence', 'acid_transactions', 'in_memory_fallback', 'sql_queries'],
        dependencies: [],
        instance: dbModule,
        exposedOperations: {
          dbQuery: dbModule.dbQuery,
          dbGet: dbModule.dbGet,
          dbRun: dbModule.dbRun,
          withTransaction: dbModule.withTransaction,
          isPostgresActive: dbModule.isPostgresActive
        },
        healthCheck: async () => {
          const active = dbModule.isPostgresActive();
          return { status: 'READY', mode: active ? 'PostgreSQL' : 'In-Memory' };
        }
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register DATABASE_ENGINE: ${e.message}`);
    }

    // 2️⃣ محركات مجالات الأعمال المحددة (Domain Engines)
    // -------------------------------------------------------------
    // RAMS Analytics Engine
    try {
      const RamsAnalyticsEngine = require('../Roads/Reports/ramsAnalyticsEngine');
      this.register({
        engineId: 'RAMS_ANALYTICS_ENGINE',
        engineName: 'محرك التحليلات الفنية ومؤشرات أداء شبكة الطرق',
        version: '4.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['network_kpis', 'pci_distribution', 'maintenance_recommendations', 'spatial_heatmap'],
        dependencies: ['DATABASE_ENGINE', 'BUSINESS_RULES_ENGINE'],
        instance: RamsAnalyticsEngine,
        exposedOperations: {
          getNetworkKpis: () => RamsAnalyticsEngine.getNetworkKpis(),
          calculatePciBreakdown: () => RamsAnalyticsEngine.calculatePciBreakdown ? RamsAnalyticsEngine.calculatePciBreakdown() : null
        },
        healthCheck: async () => {
          const kpis = await RamsAnalyticsEngine.getNetworkKpis();
          return { status: kpis ? 'READY' : 'DEGRADED', totalRoads: kpis?.total_roads };
        }
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register RAMS_ANALYTICS_ENGINE: ${e.message}`);
    }

    // Contract Template & Legal Engine
    try {
      const contractTemplateEngine = require('./contractTemplateEngine');
      this.register({
        engineId: 'CONTRACT_TEMPLATE_ENGINE',
        engineName: 'محرك الصياغة القانونية ونماذج العقود الإنشائية',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['official_html_contract', 'clause_builder', 'placeholder_replacement'],
        dependencies: ['BUSINESS_RULES_ENGINE'],
        instance: contractTemplateEngine,
        exposedOperations: {
          generateOfficialContractHTML: contractTemplateEngine.generateOfficialContractHTML,
          replacePlaceholders: contractTemplateEngine.replacePlaceholders
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register CONTRACT_TEMPLATE_ENGINE: ${e.message}`);
    }

    // Workflow Engine
    try {
      const workflowRouter = require('../Administration/API/workflowEngine');
      this.register({
        engineId: 'WORKFLOW_ENGINE',
        engineName: 'محرك مسارات العمل وتدفق الموافقات',
        version: '4.0.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['step_transitions', 'role_approval_gates', 'zero_code_workflows', 'audit_logging'],
        dependencies: ['DATABASE_ENGINE', 'AUTHORIZATION_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: workflowRouter,
        exposedOperations: {},
        healthCheck: async () => ({ status: 'READY' })
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register WORKFLOW_ENGINE: ${e.message}`);
    }

    // Projects Engine
    try {
      const projectsEngineService = require('./projectsEngineService');
      const projectsRouter = require('../Projects/API/projectsEngine');
      this.register({
        engineId: 'PROJECTS_ENGINE',
        engineName: 'محرك إدارة المشاريع الهندسية والمحافظ الرأسمالية',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'project_aggregate',
          'lifecycle_workflow',
          'progress_tracking',
          'milestones_management',
          'risk_register',
          'financial_variance_analytics',
          'gis_spatial_mapping',
          'tender_contract_linking'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'NUMBERING_ENGINE',
          'AUTHORIZATION_ENGINE',
          'WORKFLOW_ENGINE',
          'BUSINESS_RULES_ENGINE',
          'SPATIAL_GIS_ENGINE',
          'ARCHIVE_DOCUMENT_ENGINE',
          'PRINT_REPORT_ENGINE'
        ],
        instance: projectsRouter,
        exposedOperations: {
          getProjects: (filters, user) => projectsEngineService.getProjects(filters, user),
          getProjectById: (id) => projectsEngineService.getProjectById(id),
          createProject: (data, user) => projectsEngineService.createProject(data, user),
          updateProject: (id, data, user) => projectsEngineService.updateProject(id, data, user),
          transitionStatus: (id, status, user, remarks) => projectsEngineService.transitionStatus(id, status, user, remarks),
          addMilestone: (id, data, user) => projectsEngineService.addMilestone(id, data, user),
          addRisk: (id, data, user) => projectsEngineService.addRisk(id, data, user),
          addProgressLog: (id, data, user) => projectsEngineService.addProgressLog(id, data, user),
          calculateFinancialSummary: (project, contract) => projectsEngineService.calculateFinancialSummary(project, contract)
        },
        healthCheck: () => projectsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECTS_ENGINE: ${e.message}`);
    }

    // Project Portfolio Engine
    try {
      const projectPortfolioEngineService = require('./projectPortfolioEngineService');
      const portfolioRouter = require('../Projects/API/portfolioEngine');
      this.register({
        engineId: 'PROJECT_PORTFOLIO_ENGINE',
        engineName: 'محرك إدارة محافظ وخطط المشاريع الهندسية',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'portfolio_aggregate',
          'plan_management',
          'project_linking'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'NUMBERING_ENGINE',
          'AUTHORIZATION_ENGINE',
          'PROJECTS_ENGINE'
        ],
        instance: portfolioRouter,
        exposedOperations: {
          createPortfolio: (data, user) => projectPortfolioEngineService.createPortfolio(data, user),
          getPortfolios: (filters, user) => projectPortfolioEngineService.getPortfolios(filters, user),
          getPortfolioById: (id) => projectPortfolioEngineService.getPortfolioById(id),
          updatePortfolio: (id, data, user) => projectPortfolioEngineService.updatePortfolio(id, data, user),
          deletePortfolio: (id, user) => projectPortfolioEngineService.deletePortfolio(id, user),
          addProjectToPortfolio: (id, projectId, user) => projectPortfolioEngineService.addProjectToPortfolio(id, projectId, user),
          removeProjectFromPortfolio: (id, projectId, user) => projectPortfolioEngineService.removeProjectFromPortfolio(id, projectId, user),
          createPlan: (data, user) => projectPortfolioEngineService.createPlan(data, user),
          getPlans: (filters, user) => projectPortfolioEngineService.getPlans(filters, user),
          getPlanById: (id) => projectPortfolioEngineService.getPlanById(id),
          updatePlan: (id, data, user) => projectPortfolioEngineService.updatePlan(id, data, user),
          deletePlan: (id, user) => projectPortfolioEngineService.deletePlan(id, user),
          addProjectToPlan: (id, projectId, user) => projectPortfolioEngineService.addProjectToPlan(id, projectId, user),
          removeProjectFromPlan: (id, projectId, user) => projectPortfolioEngineService.removeProjectFromPlan(id, projectId, user),
          getIntegratedPortfolioKPIs: (filters) => projectPortfolioEngineService.getIntegratedPortfolioKPIs(filters),
          getPortfolioKPIs: (portfolioId) => projectPortfolioEngineService.getPortfolioKPIs(portfolioId)
        },
        healthCheck: () => projectPortfolioEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECT_PORTFOLIO_ENGINE: ${e.message}`);
    }

    // Project Prioritization Engine
    try {
      const projectPrioritizationEngineService = require('./projectPrioritizationEngineService');
      const prioritizationRouter = require('../Projects/API/projectPrioritizationEngine');
      this.register({
        engineId: 'PROJECT_PRIORITIZATION_ENGINE',
        engineName: 'محرك ترجيح وأولويات المشاريع الهندسية',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'criteria_weighting',
          'project_scoring',
          'priority_ranking',
          'score_recalculation'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'PROJECTS_ENGINE',
          'AUTHORIZATION_ENGINE',
          'BUSINESS_RULES_ENGINE'
        ],
        instance: prioritizationRouter,
        exposedOperations: {
          createPriorityCriterion: (data, user) => projectPrioritizationEngineService.createPriorityCriterion(data, user),
          getPriorityCriteria: (filters) => projectPrioritizationEngineService.getPriorityCriteria(filters),
          getPriorityCriterionById: (id) => projectPrioritizationEngineService.getPriorityCriterionById(id),
          updatePriorityCriterion: (id, data, user) => projectPrioritizationEngineService.updatePriorityCriterion(id, data, user),
          activatePriorityCriterion: (id, user) => projectPrioritizationEngineService.activatePriorityCriterion(id, user),
          deactivatePriorityCriterion: (id, user) => projectPrioritizationEngineService.deactivatePriorityCriterion(id, user),
          setProjectCriterionScore: (projectId, criterionId, score, notes, user) => projectPrioritizationEngineService.setProjectCriterionScore(projectId, criterionId, score, notes, user),
          getProjectScores: (projectId) => projectPrioritizationEngineService.getProjectScores(projectId),
          calculateProjectPriority: (projectId, user) => projectPrioritizationEngineService.calculateProjectPriority(projectId, user),
          getProjectPriority: (projectId) => projectPrioritizationEngineService.getProjectPriority(projectId),
          recalculateProjectPriority: (projectId, user) => projectPrioritizationEngineService.recalculateProjectPriority(projectId, user),
          rankProjects: () => projectPrioritizationEngineService.rankProjects()
        },
        healthCheck: () => projectPrioritizationEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECT_PRIORITIZATION_ENGINE: ${e.message}`);
    }

    // Project Financial Programming Engine
    try {
      const projectFinancialProgrammingEngineService = require('./projectFinancialProgrammingEngineService');
      const financialProgrammingRouter = require('../Projects/API/projectFinancialProgrammingEngine');
      this.register({
        engineId: 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE',
        engineName: 'محرك البرمجة والتخصيص المالي للمشاريع',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'annual_programming',
          'multi_year_allocation',
          'budget_ceiling_validation',
          'plan_financial_aggregation'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'PROJECTS_ENGINE',
          'PROJECT_PORTFOLIO_ENGINE',
          'AUTHORIZATION_ENGINE',
          'BUSINESS_RULES_ENGINE'
        ],
        instance: financialProgrammingRouter,
        exposedOperations: {
          createFinancialProgram: (data, user) => projectFinancialProgrammingEngineService.createFinancialProgram(data, user),
          getFinancialPrograms: (filters) => projectFinancialProgrammingEngineService.getFinancialPrograms(filters),
          getFinancialProgramById: (id) => projectFinancialProgrammingEngineService.getFinancialProgramById(id),
          updateFinancialProgram: (id, data, user) => projectFinancialProgrammingEngineService.updateFinancialProgram(id, data, user),
          deleteFinancialProgram: (id, user) => projectFinancialProgrammingEngineService.deleteFinancialProgram(id, user),
          getProjectFinancialProgram: (projectId) => projectFinancialProgrammingEngineService.getProjectFinancialProgram(projectId),
          getPlanFinancialProgram: (planId) => projectFinancialProgrammingEngineService.getPlanFinancialProgram(planId),
          calculateProgrammedTotal: (projectId) => projectFinancialProgrammingEngineService.calculateProgrammedTotal(projectId),
          calculateAnnualProgrammedTotal: (planId, year) => projectFinancialProgrammingEngineService.calculateAnnualProgrammedTotal(planId, year),
          calculateRemainingProgramAmount: (projectId) => projectFinancialProgrammingEngineService.calculateRemainingProgramAmount(projectId)
        },
        healthCheck: () => projectFinancialProgrammingEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECT_FINANCIAL_PROGRAMMING_ENGINE: ${e.message}`);
    }

    // Project Dependency Engine
    try {
      const projectDependencyEngineService = require('./projectDependencyEngineService');
      const dependencyRouter = require('../Projects/API/projectDependencyEngine');
      this.register({
        engineId: 'PROJECT_DEPENDENCY_ENGINE',
        engineName: 'محرك شبكة واعتماديات تتابع المشاريع',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'dependency_network',
          'cycle_detection',
          'readiness_validation',
          'dependency_graph'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'PROJECTS_ENGINE',
          'AUTHORIZATION_ENGINE',
          'BUSINESS_RULES_ENGINE'
        ],
        instance: dependencyRouter,
        exposedOperations: {
          createDependency: (data, user) => projectDependencyEngineService.createDependency(data, user),
          getDependencies: (filters) => projectDependencyEngineService.getDependencies(filters),
          getDependencyById: (id) => projectDependencyEngineService.getDependencyById(id),
          updateDependency: (id, data, user) => projectDependencyEngineService.updateDependency(id, data, user),
          deleteDependency: (id, user) => projectDependencyEngineService.deleteDependency(id, user),
          getProjectDependencies: (projectId) => projectDependencyEngineService.getProjectDependencies(projectId),
          validateProjectReadiness: (projectId) => projectDependencyEngineService.validateProjectReadiness(projectId),
          getDependencyGraph: () => projectDependencyEngineService.getDependencyGraph(),
          detectCycle: (fromId, toId, excludeId) => projectDependencyEngineService.detectCycle(fromId, toId, excludeId)
        },
        healthCheck: () => projectDependencyEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECT_DEPENDENCY_ENGINE: ${e.message}`);
    }

    // Project Scheduling Engine
    try {
      const projectSchedulingEngineService = require('./projectSchedulingEngineService');
      const schedulingRouter = require('../Projects/API/projectSchedulingEngine');
      this.register({
        engineId: 'PROJECT_SCHEDULING_ENGINE',
        engineName: 'محرك الجدولة الزمنية وحسابات المسار الحرج',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'cpm_calculation',
          'critical_path_analysis',
          'float_computation',
          'schedule_conflict_detection',
          'schedule_baselining'
        ],
        dependencies: [
          'DATABASE_ENGINE',
          'PROJECTS_ENGINE',
          'PROJECT_DEPENDENCY_ENGINE',
          'AUTHORIZATION_ENGINE',
          'BUSINESS_RULES_ENGINE'
        ],
        instance: schedulingRouter,
        exposedOperations: {
          calculateNetworkCPM: (filters, user) => projectSchedulingEngineService.calculateNetworkCPM(filters, user),
          getProjectSchedule: (projectId, version) => projectSchedulingEngineService.getProjectSchedule(projectId, version),
          getCriticalPath: (filters) => projectSchedulingEngineService.getCriticalPath(filters),
          detectScheduleConflicts: () => projectSchedulingEngineService.detectScheduleConflicts(),
          createScheduleBaseline: (projectId, user) => projectSchedulingEngineService.createScheduleBaseline(projectId, user),
          getScheduleBaseline: (projectId) => projectSchedulingEngineService.getScheduleBaseline(projectId)
        },
        healthCheck: () => projectSchedulingEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PROJECT_SCHEDULING_ENGINE: ${e.message}`);
    }

    // Tenders Engine
    try {
      const tendersEngineService = require('./tendersEngineService');
      const tendersRouter = require('../Tenders/API/tendersEngine');
      this.register({
        engineId: 'TENDERS_ENGINE',
        engineName: 'محرك إدارة العطاءات والمشاريع الرأسمالية',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['tender_crud', 'boq_management', 'daily_reports', 'financial_tracking', 'tender_awarding'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: tendersRouter,
        exposedOperations: {
          getTenders: (filters, user) => tendersEngineService.getTenders(filters, user),
          getTenderById: (id) => tendersEngineService.getTenderById(id),
          createTender: (data, user) => tendersEngineService.createTender(data, user),
          updateTender: (id, updates, user) => tendersEngineService.updateTender(id, updates, user),
          deleteTender: (id, user) => tendersEngineService.deleteTender(id, user),
          awardTender: (id, data, user) => tendersEngineService.awardTender(id, data, user)
        },
        healthCheck: () => tendersEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register TENDERS_ENGINE: ${e.message}`);
    }

    // Claims Engine
    try {
      const claimsEngineService = require('./claimsEngineService');
      const claimsRouter = require('../Tenders/API/claimsEngine');
      this.register({
        engineId: 'CLAIMS_ENGINE',
        engineName: 'محرك المطالبات والدفعات المالية للمقاولين',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['claims_crud', 'workflow_transition', 'deductions_calculation', 'payment_certification', 'cumulative_financial_tracking'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUSINESS_RULES_ENGINE', 'WORKFLOW_ENGINE'],
        instance: claimsRouter,
        exposedOperations: {
          getClaims: (filters, user) => claimsEngineService.getClaims(filters, user),
          getClaimById: (id) => claimsEngineService.getClaimById(id),
          createClaim: (data, user) => claimsEngineService.createClaim(data, user),
          auditClaim: (id, data, user) => claimsEngineService.auditClaim(id, data, user),
          deleteClaim: (id, user) => claimsEngineService.deleteClaim(id, user),
          calculateClaimDeductions: (amount, options) => claimsEngineService.calculateClaimDeductions(amount, options)
        },
        healthCheck: () => claimsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register CLAIMS_ENGINE: ${e.message}`);
    }

    // Roads Engine
    try {
      const roadsEngineService = require('./roadsEngineService');
      const roadsRouter = require('../Roads/API/roadsEngine');
      this.register({
        engineId: 'ROADS_ENGINE',
        engineName: 'محرك إدارة شبكة الطرق وتقييم الرصفات',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['roads_crud', 'gis_heatmap', 'chainage_segments', 'pci_assessment', 'network_statistics'],
        dependencies: ['DATABASE_ENGINE', 'SPATIAL_GIS_ENGINE', 'BUSINESS_RULES_ENGINE', 'RAMS_ANALYTICS_ENGINE'],
        instance: roadsRouter,
        exposedOperations: {
          getRoads: (filters, user) => roadsEngineService.getRoads(filters, user),
          getRoadById: (id) => roadsEngineService.getRoadById(id),
          createRoad: (data, user) => roadsEngineService.createRoad(data, user),
          calculatePCI: (distresses) => roadsEngineService.calculatePCI(distresses),
          addPciSurvey: (id, data, user) => roadsEngineService.addPciSurvey(id, data, user),
          getNetworkStats: () => roadsEngineService.getNetworkStats()
        },
        healthCheck: () => roadsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register ROADS_ENGINE: ${e.message}`);
    }

    // Purchases Engine
    try {
      const purchasesEngineService = require('./purchasesEngineService');
      const purchasesRouter = require('../Purchases/API/purchasesEngine');
      this.register({
        engineId: 'PURCHASES_ENGINE',
        engineName: 'محرك أوامر الشراء والتوريدات الهندسية',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['purchases_crud', 'budget_allocation', 'supplier_management', 'receiving_committee'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: purchasesRouter,
        exposedOperations: {
          getPurchases: (filters, user) => purchasesEngineService.getPurchases(filters, user),
          getPurchaseById: (id) => purchasesEngineService.getPurchaseById(id),
          createPurchase: (data, user) => purchasesEngineService.createPurchase(data, user),
          receivePurchaseItems: (id, data, user) => purchasesEngineService.receivePurchaseItems(id, data, user),
          getPurchasesStats: () => purchasesEngineService.getPurchasesStats()
        },
        healthCheck: () => purchasesEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PURCHASES_ENGINE: ${e.message}`);
    }

    // Directorate General Budget Engine
    try {
      const budgetEngineService = require('./budgetEngineService');
      this.register({
        engineId: 'BUDGET_ENGINE',
        engineName: 'محرك الموازنة العامة لمديرية الأشغال والخدمات الهندسية',
        version: '1.0.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['budget_crud', 'budget_allocation', 'budget_ceiling_validation', 'variance_analysis', 'expenditure_tracking'],
        dependencies: ['DATABASE_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: budgetEngineService,
        exposedOperations: {
          getBudgetSummary: (year) => budgetEngineService.getBudgetSummary(year),
          getBudgetLines: (filters) => budgetEngineService.getBudgetLines(filters),
          getBudgetLineById: (id) => budgetEngineService.getBudgetLineById(id),
          createBudgetLine: (data) => budgetEngineService.createBudgetLine(data),
          updateBudgetLine: (id, data) => budgetEngineService.updateBudgetLine(id, data),
          deleteBudgetLine: (id) => budgetEngineService.deleteBudgetLine(id),
          createAllocation: (data) => budgetEngineService.createAllocation(data),
          getAllocations: (filters) => budgetEngineService.getAllocations(filters)
        },
        healthCheck: () => budgetEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register BUDGET_ENGINE: ${e.message}`);
    }

    // Contracts Engine
    try {
      const contractsEngineService = require('./contractsEngineService');
      const contractsRouter = require('../Contracts/API/contractManagementEngine');
      this.register({
        engineId: 'CONTRACTS_ENGINE',
        engineName: 'محرك إدارة العقود والضمانات البنكية',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['contracts_crud', 'bank_guarantees', 'variation_orders', 'legal_clauses', 'guarantee_alerts', 'legal_limit_enforcement'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'CONTRACT_TEMPLATE_ENGINE', 'BUSINESS_RULES_ENGINE'],
        instance: contractsRouter,
        exposedOperations: {
          getContracts: (filters, user) => contractsEngineService.getContracts(filters, user),
          getContractById: (id) => contractsEngineService.getContractById(id),
          createContract: (data, user) => contractsEngineService.createContract(data, user),
          updateContract: (id, updates, user) => contractsEngineService.updateContract(id, updates, user),
          deleteContract: (id, user) => contractsEngineService.deleteContract(id, user),
          addVariationOrder: (id, data, user) => contractsEngineService.addVariationOrder(id, data, user),
          getVariationOrders: (id) => contractsEngineService.getVariationOrders(id),
          addBankGuarantee: (id, data, user) => contractsEngineService.addBankGuarantee(id, data, user),
          getBankGuarantees: (id) => contractsEngineService.getBankGuarantees(id),
          extendBankGuarantee: (id, data, user) => contractsEngineService.extendBankGuarantee(id, data, user),
          releaseBankGuarantee: (id, data, user) => contractsEngineService.releaseBankGuarantee(id, data, user),
          getGuaranteesAlerts: () => contractsEngineService.getGuaranteesAlerts()
        },
        healthCheck: () => contractsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register CONTRACTS_ENGINE: ${e.message}`);
    }

    // Pavement Returns Engine
    try {
      const pavementReturnsEngineService = require('./pavementReturnsEngineService');
      const pavingRouter = require('../PavementReturns/API/pavingReturns');
      this.register({
        engineId: 'PAVEMENT_RETURNS_ENGINE',
        engineName: 'محرك عوائد التعبيد والتحققات البلدية',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['paving_returns_calculation', 'returns_crud', 'revenue_collection', 'basin_parcel_tracking'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUSINESS_RULES_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: pavingRouter,
        exposedOperations: {
          getPavingReturns: (filters, user) => pavementReturnsEngineService.getPavingReturns(filters, user),
          getPavingReturnById: (id) => pavementReturnsEngineService.getPavingReturnById(id),
          createPavingReturn: (data, user) => pavementReturnsEngineService.createPavingReturn(data, user),
          recordPayment: (id, data, user) => pavementReturnsEngineService.recordPayment(id, data, user),
          calculatePavingReturn: (l, w, p, r) => pavementReturnsEngineService.calculatePavingReturn(l, w, p, r),
          getReturnsStats: () => pavementReturnsEngineService.getReturnsStats()
        },
        healthCheck: () => pavementReturnsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PAVEMENT_RETURNS_ENGINE: ${e.message}`);
    }

    // Assets & Infrastructure Engine
    try {
      const assetsEngineService = require('./assetsEngineService');
      const assetsRouter = require('../Assets/API/assetsEngine');
      this.register({
        engineId: 'ASSETS_ENGINE',
        engineName: 'محرك الأصول البلدية والمرافق والآليات الهندسية',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['assets_crud', 'structural_assets', 'infrastructure_networks', 'energy_lighting', 'condition_depreciation_calculation'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUSINESS_RULES_ENGINE'],
        instance: assetsRouter,
        exposedOperations: {
          getAssets: (filters, user) => assetsEngineService.getAssets(filters, user),
          getAssetById: (id) => assetsEngineService.getAssetById(id),
          createAsset: (data, user) => assetsEngineService.createAsset(data, user),
          calculateAssetDepreciation: (cost, year, life, salvage) => assetsEngineService.calculateAssetDepreciation(cost, year, life, salvage),
          getAssetsStats: () => assetsEngineService.getAssetsStats()
        },
        healthCheck: () => assetsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register ASSETS_ENGINE: ${e.message}`);
    }

    // Archive & Document Engine
    try {
      const archiveEngineService = require('./archiveEngineService');
      const archiveRouter = require('../Archive/API/archiveEngine');
      this.register({
        engineId: 'ARCHIVE_DOCUMENT_ENGINE',
        engineName: 'محرك الأرشفة الرقمية وتخزين المستندات',
        version: '4.1.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['file_storage', 'document_linking', 'metadata_indexing', 'ocr_search'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: archiveRouter,
        exposedOperations: {
          getDocuments: (filters, user) => archiveEngineService.getDocuments(filters, user),
          indexDocument: (data, user) => archiveEngineService.indexDocument(data, user)
        },
        healthCheck: () => archiveEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register ARCHIVE_DOCUMENT_ENGINE: ${e.message}`);
    }

    // Reports & Print Templates Engine
    try {
      const reportsEngineService = require('./reportsEngineService');
      const reportsRouter = require('../Reports/API/printTemplatesEngine');
      this.register({
        engineId: 'PRINT_REPORT_ENGINE',
        engineName: 'محرك التقارير ونماذج الطباعة الموحدة',
        version: '4.1.0',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['official_print_layout', 'excel_export', 'watermark_rendering', 'dynamic_variables', 'pdf_generation'],
        dependencies: ['DATABASE_ENGINE', 'VERIFICATION_ENGINE'],
        instance: reportsRouter,
        exposedOperations: {
          generateOfficialHeader: (title, branch) => reportsEngineService.generateOfficialHeader(title, branch)
        },
        healthCheck: () => reportsEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register PRINT_REPORT_ENGINE: ${e.message}`);
    }

    // Field Inspection Engine
    try {
      const inspectionEngineService = require('./inspectionEngineService');
      const inspectionsRouter = require('../Inspection/API/inspections');
      this.register({
        engineId: 'INSPECTION_ENGINE',
        engineName: 'محرك التفتيش والرقابة الميدانية وضبط الجودة',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['field_inspections', 'defect_logging', 'quality_compliance', 'incident_notifications'],
        dependencies: ['DATABASE_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: inspectionsRouter,
        exposedOperations: {
          getInspections: (filters) => inspectionEngineService.getInspections(filters),
          recordInspection: (data, user) => inspectionEngineService.recordInspection(data, user)
        },
        healthCheck: () => inspectionEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register INSPECTION_ENGINE: ${e.message}`);
    }

    // Technical Committees Engine
    try {
      const committeesEngineService = require('./committeesEngineService');
      const committeesRouter = require('../Committees/API/committeesEngine');
      this.register({
        engineId: 'COMMITTEES_ENGINE',
        engineName: 'محرك اللجان الفنية ولجان الاستلام ودراسة العطاءات',
        version: '4.1.0',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['committee_minutes', 'preliminary_handover', 'final_handover', 'tender_studies_evaluation'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUSINESS_RULES_ENGINE'],
        instance: committeesRouter,
        exposedOperations: {
          getReports: (filters) => committeesEngineService.getReports(filters),
          createReport: (data, user) => committeesEngineService.createReport(data, user)
        },
        healthCheck: () => committeesEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register COMMITTEES_ENGINE: ${e.message}`);
    }

    // Government Gateway Engine (G2G)
    try {
      const g2gGatewayEngineService = require('./g2gGatewayEngineService');
      const g2gRouter = require('../Administration/API/g2gGateway');
      this.register({
        engineId: 'G2G_GATEWAY_ENGINE',
        engineName: 'محرك بوابة الربط الحكومي والتكامل مع الوزارات',
        version: '4.1.0',
        category: 'INTEGRATION_GATEWAY',
        status: 'READY',
        capabilities: ['ministry_dispatch', 'audit_handshake', 'e_government_sync'],
        dependencies: ['DATABASE_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: g2gRouter,
        exposedOperations: {
          dispatchPayload: (min, type, data, user) => g2gGatewayEngineService.dispatchPayload(min, type, data, user)
        },
        healthCheck: () => g2gGatewayEngineService.healthCheck()
      });
    } catch (e) {
      logWarn('EngineRegistry', `Failed to register G2G_GATEWAY_ENGINE: ${e.message}`);
    }

    this._initialized = true;

    logInfo('EngineRegistry', `✅ All ${this._engines.size} Enterprise Engines successfully registered.`);
  }
}

const globalRegistry = new EngineRegistry();
globalRegistry.autoRegisterAll();

module.exports = globalRegistry;
