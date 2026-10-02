/**
 * services/engineRegistry.js
 * 🏛️ سجل المحركات المركزي الموحد (Enterprise Engine Registry)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية v2.0 - Anti-Gravity Enterprise Patch
 */

const { logInfo, logWarn, logError } = require('../utils/logger');

class EngineRegistry {
  constructor() {
    this._engines = new Map();
    this._initialized = false;
  }

  /**
   * التحقق من التهيئة الكسولة للمحركات عند أول طلب
   */
  _ensureInitialized() {
    if (!this._initialized) {
      this.autoRegisterAll();
    }
  }

  /**
   * تسجيل محرك في السجل المركزي
   */
  register(descriptor) {
    if (!descriptor || !descriptor.engineId) {
      throw new Error('Engine descriptor must contain a unique "engineId"');
    }

    const engineId = descriptor.engineId.toUpperCase();
    
    // تأمين ربط النطاقات لكافة العمليات المكشوفة (.bind)
    const safeOperations = {};
    if (descriptor.exposedOperations && typeof descriptor.exposedOperations === 'object') {
      for (const [opName, fn] of Object.entries(descriptor.exposedOperations)) {
        if (typeof fn === 'function') {
          safeOperations[opName] = descriptor.instance ? fn.bind(descriptor.instance) : fn;
        }
      }
    }

    const entry = {
      engineId,
      engineName: descriptor.engineName || engineId,
      version: descriptor.version || '1.0.0',
      category: descriptor.category || 'DOMAIN_ENGINE',
      status: descriptor.status || 'REGISTERED',
      capabilities: Array.isArray(descriptor.capabilities) ? descriptor.capabilities : [],
      dependencies: Array.isArray(descriptor.dependencies) ? descriptor.dependencies.map(d => d.toUpperCase()) : [],
      exposedOperations: safeOperations,
      instance: descriptor.instance || null,
      healthCheck: typeof descriptor.healthCheck === 'function' 
        ? (descriptor.instance ? descriptor.healthCheck.bind(descriptor.instance) : descriptor.healthCheck) 
        : null,
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

  get(engineId) {
    if (!engineId) return null;
    this._ensureInitialized();
    const id = engineId.toUpperCase();
    if (this._engines.has(id)) return this._engines.get(id);
    if (id === 'WORK_OPERATIONS_CENTER') return this._engines.get('OPERATIONS_CENTER') || null;
    return null;
  }

  has(engineId) {
    if (!engineId) return false;
    this._ensureInitialized();
    const id = engineId.toUpperCase();
    return this._engines.has(id) || (id === 'WORK_OPERATIONS_CENTER' && this._engines.has('OPERATIONS_CENTER'));
  }

  list(filter = {}) {
    this._ensureInitialized();
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

  setStatus(engineId, status) {
    this._ensureInitialized();
    const entry = this.get(engineId);
    if (entry) {
      entry.status = status;
      entry.updatedAt = new Date().toISOString();
    }
  }

  /**
   * تسجيل آمن للمقاييس مع الحماية من القيم غير المعرفة (NaN Protection)
   */
  recordInvocation(engineId, durationMs, success = true, error = null) {
    this._ensureInitialized();
    const entry = this.get(engineId);
    if (!entry) return;

    const safeDuration = (typeof durationMs === 'number' && !isNaN(durationMs) && durationMs >= 0) ? durationMs : 0;
    const m = entry.metrics;
    
    m.invocations++;
    if (success) {
      m.successCount++;
    } else {
      m.failureCount++;
      m.lastError = error ? (error.message || String(error)) : 'Unknown error';
    }

    m.totalDurationMs += safeDuration;
    m.avgDurationMs = Math.round((m.totalDurationMs / m.invocations) * 100) / 100;
    m.lastInvokedAt = new Date().toISOString();
  }

  /**
   * فحص صحة محرك مع التدقيق التبادلي للتبعيات (Cascade Health Check)
   */
  async checkEngineHealth(engineId, visited = new Set()) {
    this._ensureInitialized();
    const entry = this.get(engineId);
    if (!entry) {
      return { engineId, status: 'NOT_FOUND', healthy: false, error: 'المحرك غير مسجل' };
    }

    // منع الحلقات أثناء فحص شجرة التبعيات
    if (visited.has(entry.engineId)) {
      return { engineId: entry.engineId, status: entry.status, healthy: entry.status === 'READY' };
    }
    visited.add(entry.engineId);

    // 1. فحص صحة التبعيات أولاً
    const unreadyDependencies = [];
    for (const depId of entry.dependencies) {
      const depEntry = this.get(depId);
      if (!depEntry || depEntry.status === 'FAILED') {
        unreadyDependencies.push(depId);
      }
    }

    if (unreadyDependencies.length > 0) {
      entry.status = 'DEGRADED';
      return {
        engineId: entry.engineId,
        engineName: entry.engineName,
        category: entry.category,
        status: 'DEGRADED',
        healthy: false,
        error: `تعطل أو غياب التبعيات التشغيلية للمحرك: [${unreadyDependencies.join(', ')}]`,
        checkedAt: new Date().toISOString()
      };
    }

    // 2. تنفيذ فحص الصحة الذاتي
    if (entry.healthCheck) {
      try {
        const res = await entry.healthCheck();
        const isHealthy = Boolean(res && (res.status === 'READY' || res.status === 'HEALTHY' || res.healthy === true));
        entry.status = isHealthy ? 'READY' : (res?.status || 'DEGRADED');
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
   * فحص متوازٍ فائق السرعة لكافة المحركات دون حجب السيرفر (Promise.allSettled)
   */
  async checkAllHealth() {
    this._ensureInitialized();
    const engineIds = Array.from(this._engines.keys());
    const healthPromises = engineIds.map(id => this.checkEngineHealth(id));
    const settled = await Promise.allSettled(healthPromises);

    const results = {};
    let totalHealthy = 0;

    settled.forEach((res, idx) => {
      const id = engineIds[idx];
      if (res.status === 'fulfilled') {
        results[id] = res.value;
        if (res.value.healthy) totalHealthy++;
      } else {
        results[id] = { engineId: id, status: 'FAILED', healthy: false, error: res.reason?.message };
      }
    });

    const totalCount = engineIds.length;
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
   * التسجيل الكسول الآمن لكافة المحركات الـ 37 للمنظومة (Lazy Dependency Loading)
   */
  autoRegisterAll() {
    if (this._initialized) return;

    // دالة مساعدة للتحميل الآمن ومنع انهيار السجل عند وجود خلل في موديول فردي
    const safeRequire = (path) => {
      try { return require(path); } catch (e) {
        logWarn('EngineRegistry', `Dynamic require skipped for "${path}": ${e.message}`);
        return null;
      }
    };

    // ─── 1. بنية المنصة والخدمات المركزية (Core Platform Engines) ───
    
    const dbModule = safeRequire('../utils/database');
    if (dbModule) {
      this.register({
        engineId: 'DATABASE_ENGINE',
        engineName: 'محرك قواعد البيانات والاتصال المزدوج المعاملاتي',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['dual_persistence', 'acid_transactions', 'in_memory_fallback'],
        dependencies: [],
        instance: dbModule,
        exposedOperations: {
          dbQuery: dbModule.dbQuery,
          dbGet: dbModule.dbGet,
          dbRun: dbModule.dbRun,
          isPostgresActive: dbModule.isPostgresActive
        },
        healthCheck: async () => ({ status: 'READY', mode: dbModule.isPostgresActive() ? 'PostgreSQL' : 'In-Memory' })
      });
    }

    const numberingEngine = safeRequire('./numberingEngine');
    if (numberingEngine) {
      this.register({
        engineId: 'NUMBERING_ENGINE',
        engineName: 'محرك الترقيم والترميز المتسلسل الموحد',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['atomic_sequence', 'custom_prefixes'],
        dependencies: ['DATABASE_ENGINE'],
        instance: numberingEngine,
        exposedOperations: {
          generateNextId: (entityType, options) => numberingEngine.generateNextId(entityType, options),
          resolvePrefix: (entityType, explicit) => numberingEngine.resolvePrefix(entityType, explicit),
          validateIdFormat: (idStr, expected) => numberingEngine.validateIdFormat(idStr, expected)
        },
        healthCheck: () => numberingEngine.healthCheck()
      });
    }

    const authService = safeRequire('./authorizationEngineService');
    const rbacManager = safeRequire('../middlewares/rbacManager');
    const authInstance = authService || rbacManager;
    if (authInstance) {
      this.register({
        engineId: 'AUTHORIZATION_ENGINE',
        engineName: 'محرك التحكم بالوصول والمصفوفة الأمنية (RBAC)',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['jwt_auth', 'role_verification', 'permission_matrix', 'district_scope_filtering', 'field_level_access_control', 'security_audit'],
        dependencies: ['DATABASE_ENGINE'],
        instance: authInstance,
        exposedOperations: {
          hasPermission: (userOrRole, perm, entity, district) => authInstance.hasPermission(userOrRole, perm, entity, district),
          generateToken: (user) => (authInstance.generateToken ? authInstance.generateToken(user) : rbacManager?.generateToken?.(user)),
          verifyToken: (token) => (authInstance.verifyToken ? authInstance.verifyToken(token) : rbacManager?.verifyToken?.(token)),
          isTokenBlacklisted: (jti) => (authInstance.isTokenBlacklisted ? authInstance.isTokenBlacklisted(jti) : false),
          revokeToken: (jti, userId) => (authInstance.revokeToken ? authInstance.revokeToken(jti, userId) : false),
          sanitizeEntityFields: (user, data) => (authInstance.sanitizeEntityFields ? authInstance.sanitizeEntityFields(user, data) : data)
        },
        healthCheck: async () => (authInstance.healthCheck ? authInstance.healthCheck() : { status: 'READY' })
      });
    }

    const notificationCenter = safeRequire('./notificationCenter');
    if (notificationCenter) {
      this.register({
        engineId: 'NOTIFICATION_ENGINE',
        engineName: 'مركز الإشعارات والبث اللحظي للفعاليات',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['event_dispatch', 'user_notifications', 'async_alerts'],
        dependencies: [],
        instance: notificationCenter,
        exposedOperations: {
          notifyUser: (userId, title, msg, type) => notificationCenter.notifyUser(userId, title, msg, type),
          sendInternalAlert: (msg, payload) => notificationCenter.sendInternalAlert(msg, payload)
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    }

    const obsService = safeRequire('./observabilityService');
    if (obsService) {
      this.register({
        engineId: 'OBSERVABILITY_SERVICE',
        engineName: 'خدمة الرصد وتتبع الأداء والأحداث الأمنية',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['latency_tracking', 'security_sanitization', 'metrics_export'],
        dependencies: [],
        instance: obsService,
        exposedOperations: {
          recordTiming: (name, ms, meta) => obsService.recordTiming(name, ms, meta),
          recordSecurityEvent: (type, details, req) => obsService.recordSecurityEvent(type, details, req),
          getMetricsSummary: () => obsService.getMetricsSummary()
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    }

    const reconcilService = safeRequire('./dataReconciliationService');
    if (reconcilService) {
      this.register({
        engineId: 'DATA_RECONCILIATION_ENGINE',
        engineName: 'محرك المزامنة اللاحقة ومعالجة الانقطاع',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['offline_sync', 'conflict_resolution', 'eventual_consistency', 'cross_store_reconciliation'],
        dependencies: ['DATABASE_ENGINE'],
        instance: reconcilService,
        exposedOperations: {
          reconcileOfflineData: () => reconcilService.reconcileOfflineData ? reconcilService.reconcileOfflineData() : null,
          reconcileDataStores: (t) => reconcilService.reconcileDataStores ? reconcilService.reconcileDataStores(t) : null,
          healthCheck: () => reconcilService.healthCheck ? reconcilService.healthCheck() : ({ status: 'READY' })
        },
        healthCheck: () => reconcilService.healthCheck ? reconcilService.healthCheck() : ({ status: 'READY' })
      });
    }

    const loggerService = safeRequire('./loggerService');
    if (loggerService) {
      this.register({
        engineId: 'LOGGER_SERVICE',
        engineName: 'محرك السجلات والتدقيق المركزي الموحد',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['file_logging', 'audit_trail', 'rotation'],
        dependencies: [],
        instance: loggerService,
        exposedOperations: {
          logInfo: loggerService.logInfo,
          logWarn: loggerService.logWarn,
          logError: loggerService.logError
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    }

    const cryptoService = safeRequire('./cryptoSignatureService');
    if (cryptoService) {
      this.register({
        engineId: 'VERIFICATION_ENGINE',
        engineName: 'محرك الختم والتحقق الرقمي المشفر',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['sha256_hash', 'digital_seal', 'hmac_signing', 'tamper_detection'],
        dependencies: [],
        instance: cryptoService,
        exposedOperations: {
          calculateDocumentHash: (doc) => cryptoService.calculateDocumentHash ? cryptoService.calculateDocumentHash(doc) : null,
          signDocument: (p) => cryptoService.signDocument ? cryptoService.signDocument(p) : null,
          verifyDocumentSignature: (p, s, d) => cryptoService.verifyDocumentSignature ? cryptoService.verifyDocumentSignature(p, s, d) : null
        },
        healthCheck: () => cryptoService.healthCheck ? cryptoService.healthCheck() : ({ status: 'READY' })
      });
    }

    const businessRules = safeRequire('./rulesEngineService') || safeRequire('./businessRulesEngine');
    if (businessRules) {
      this.register({
        engineId: 'BUSINESS_RULES_ENGINE',
        engineName: 'محرك قواعد الأعمال والعمليات الحسابية',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['pci_calculation', 'paving_returns', 'claim_deductions', 'safe_expression_evaluation', 'dynamic_rule_evaluation'],
        dependencies: ['DATABASE_ENGINE'],
        instance: businessRules,
        exposedOperations: {
          calculatePciScore: (d, s) => businessRules.calculatePciScore(d, s),
          calculateClaimFinancials: (p) => businessRules.calculateClaimFinancials(p),
          evaluateSafeExpression: (expr, ctx) => businessRules.evaluateSafeExpression(expr, ctx),
          getRules: (f) => businessRules.getRules(f),
          createRule: (d, u) => businessRules.createRule(d, u)
        },
        healthCheck: async () => (businessRules.healthCheck ? businessRules.healthCheck() : { status: 'READY' })
      });
    }

    const spatialTrans = safeRequire('./spatialTranslator');
    if (spatialTrans) {
      this.register({
        engineId: 'SPATIAL_GIS_ENGINE',
        engineName: 'محرك التحليل المكاني والترجمة الجغرافية',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['haversine_distance', 'spatial_buffer', 'postgis_fallback'],
        dependencies: [],
        instance: spatialTrans,
        exposedOperations: {
          calculateDistanceMeters: spatialTrans.calculateHaversineDistance,
          isWithinDistance: spatialTrans.isWithinDistance
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    }

    const reportsEngine = safeRequire('./reportsEngineService');
    if (reportsEngine) {
      this.register({
        engineId: 'PRINT_REPORT_ENGINE',
        engineName: 'محرك التقارير الرسمية والطباعة الموحدة',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: [
          'official_municipal_reports',
          'structured_layout_generation',
          'audit_report_tracking',
          'multi_domain_reporting',
          'official_print_layout',
          'excel_export',
          'watermark_rendering',
          'dynamic_variables',
          'pdf_generation',
          'digital_seal_embedding'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: reportsEngine,
        exposedOperations: {
          generateOfficialReport: (cfg, u) => reportsEngine.generateOfficialReport(cfg, u),
          generateOfficialHeader: (t, b, u) => reportsEngine.generateOfficialHeader(t, b, u),
          generateTableReport: (t, c, r, u) => reportsEngine.generateTableReport(t, c, r, u),
          healthCheck: () => reportsEngine.healthCheck()
        },
        healthCheck: () => reportsEngine.healthCheck()
      });
    }

    const archiveEngine = safeRequire('./archiveEngineService');
    if (archiveEngine) {
      this.register({
        engineId: 'ARCHIVE_DOCUMENT_ENGINE',
        engineName: 'محرك الأرشفة الرقمية وتخزين المستندات',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: ['file_storage', 'document_indexing', 'sha256_integrity', 'soft_delete', 'retention_policy', 'storage_analytics'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: archiveEngine,
        exposedOperations: {
          getDocuments: (f, u) => archiveEngine.getDocuments(f, u),
          getDocumentById: (id) => archiveEngine.getDocumentById(id),
          archiveDocument: (d, u) => archiveEngine.archiveDocument(d, u),
          indexDocument: (d, u) => archiveEngine.indexDocument(d, u),
          updateDocument: (id, d, u) => archiveEngine.updateDocument(id, d, u),
          softDeleteDocument: (id, u) => archiveEngine.softDeleteDocument(id, u),
          batchLockDocuments: (ids, lock, u) => archiveEngine.batchLockDocuments(ids, lock, u),
          batchTagDocuments: (ids, tags, u) => archiveEngine.batchTagDocuments(ids, tags, u),
          batchDeleteDocuments: (ids, u) => archiveEngine.batchDeleteDocuments(ids, u),
          verifyDocumentIntegrity: (id) => archiveEngine.verifyDocumentIntegrity(id),
          getStats: () => archiveEngine.getStats(),
          getStorageBreakdown: () => archiveEngine.getStorageBreakdown()
        },
        healthCheck: () => archiveEngine.healthCheck()
      });
    }

    const workflowEngine = safeRequire('../routes/workflowRouter');
    const workflowAdmin = safeRequire('../Administration/API/workflowEngine');
    const activeWorkflow = workflowEngine || workflowAdmin;
    if (activeWorkflow) {
      this.register({
        engineId: 'WORKFLOW_ENGINE',
        engineName: 'محرك مسارات العمل وتدفق الموافقات',
        category: 'CORE_SERVICE',
        status: 'READY',
        capabilities: [
          'state_machine_transitions',
          'approval_guard_validation',
          'workflow_history_tracking',
          'audit_trail_integration',
          'step_transitions',
          'role_approval_gates',
          'zero_code_workflows',
          'multi_entity_workflow_sync',
          'automated_transition_alerts'
        ],
        dependencies: ['DATABASE_ENGINE', 'AUTHORIZATION_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: activeWorkflow,
        exposedOperations: {
          transitionState: (c, t, u) => activeWorkflow.transitionState ? activeWorkflow.transitionState(c, t, u) : null,
          executeTransition: (p, u) => workflowAdmin && workflowAdmin.executeTransition ? workflowAdmin.executeTransition(p, u) : null,
          healthCheck: () => activeWorkflow.healthCheck ? activeWorkflow.healthCheck() : ({ status: 'READY' })
        },
        healthCheck: () => activeWorkflow.healthCheck ? activeWorkflow.healthCheck() : ({ status: 'READY' })
      });
    }

    const contractTemplateEngine = safeRequire('./contractTemplateEngine');
    if (contractTemplateEngine) {
      this.register({
        engineId: 'CONTRACT_TEMPLATE_ENGINE',
        engineName: 'محرك الصياغة القانونية ونماذج العقود الإنشائية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['official_html_contract', 'clause_builder', 'placeholder_replacement', 'construction_contract_rendering'],
        dependencies: ['BUSINESS_RULES_ENGINE', 'NUMBERING_ENGINE', 'ARCHIVE_DOCUMENT_ENGINE'],
        instance: contractTemplateEngine,
        exposedOperations: {
          generateOfficialContractHTML: (c, t, p) => contractTemplateEngine.generateOfficialContractHTML(c, t, p),
          replacePlaceholders: (t, d) => contractTemplateEngine.replacePlaceholders(t, d),
          generateConstructionContract: (d, u) => contractTemplateEngine.generateConstructionContract(d, u)
        },
        healthCheck: () => contractTemplateEngine.healthCheck ? contractTemplateEngine.healthCheck() : ({ status: 'READY' })
      });
    }

    const ramsAnalytics = safeRequire('../Roads/Reports/ramsAnalyticsEngine');
    if (ramsAnalytics) {
      this.register({
        engineId: 'RAMS_ANALYTICS_ENGINE',
        engineName: 'محرك تحليلات الطرق ونمذجة تدهور الرصفة (RAMS Analytics)',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'astm_d6433_pci_computation',
          'pavement_deterioration_modeling',
          'treatment_decision_matrix',
          'cost_of_deferral_analysis',
          'weighted_network_scoring',
          'rams_audit_logging',
          'pci_distribution',
          'maintenance_backlog',
          'network_kpis'
        ],
        dependencies: ['DATABASE_ENGINE', 'SPATIAL_GIS_ENGINE'],
        instance: ramsAnalytics,
        exposedOperations: {
          analyzeRoadNetwork: (f) => ramsAnalytics.analyzeRoadNetwork(f),
          getNetworkKpis: () => ramsAnalytics.getNetworkKpis(),
          getMaintenancePriorities: () => ramsAnalytics.getMaintenancePriorities(),
          resolveTreatment: (p) => ramsAnalytics.resolveTreatment(p),
          simulateDeterioration: (p, y, t) => ramsAnalytics.simulateDeterioration(p, y, t),
          healthCheck: () => ramsAnalytics.healthCheck()
        },
        healthCheck: () => ramsAnalytics.healthCheck()
      });
    }

    // ─── 2. محركات النطاق الهندسي والمشاريع (Engineering & Projects) ───

    const projectsEngine = safeRequire('./projectsEngineService');
    if (projectsEngine) {
      this.register({
        engineId: 'PROJECTS_ENGINE',
        engineName: 'محرك المشاريع الهندسية والمحافظ الرأسمالية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['project_aggregate', 'lifecycle_workflow', 'progress_tracking'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'AUTHORIZATION_ENGINE'],
        instance: projectsEngine,
        exposedOperations: {
          getProjects: (f, u) => projectsEngine.getProjects(f, u),
          getProjectById: (id) => projectsEngine.getProjectById(id),
          createProject: (d, u) => projectsEngine.createProject(d, u),
          updateProject: (id, d, u) => projectsEngine.updateProject(id, d, u),
          deleteProject: (id, u) => projectsEngine.deleteProject(id, u),
          transitionStatus: (id, s, u, r) => projectsEngine.transitionStatus(id, s, u, r),
          addMilestone: (id, d, u) => projectsEngine.addMilestone(id, d, u),
          addRisk: (id, d, u) => projectsEngine.addRisk(id, d, u),
          addProgressLog: (id, d, u) => projectsEngine.addProgressLog(id, d, u),
          calculateFinancialSummary: (p, c) => projectsEngine.calculateFinancialSummary(p, c)
        },
        healthCheck: () => projectsEngine.healthCheck()
      });
    }

    const portfolioEngine = safeRequire('./projectPortfolioEngineService');
    if (portfolioEngine) {
      this.register({
        engineId: 'PROJECT_PORTFOLIO_ENGINE',
        engineName: 'محرك محافظ وخطط المشاريع الهندسية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['portfolio_aggregate', 'plan_management', 'project_linking'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'PROJECTS_ENGINE'],
        instance: portfolioEngine,
        exposedOperations: {
          createPortfolio: (d, u) => portfolioEngine.createPortfolio(d, u),
          getPortfolios: (f, u) => portfolioEngine.getPortfolios(f, u),
          getPortfolioById: (id) => portfolioEngine.getPortfolioById(id),
          createPlan: (d, u) => portfolioEngine.createPlan(d, u),
          getPlans: (f, u) => portfolioEngine.getPlans(f, u),
          getPlanById: (id) => portfolioEngine.getPlanById(id),
          getIntegratedPortfolioKPIs: (f) => portfolioEngine.getIntegratedPortfolioKPIs(f)
        },
        healthCheck: () => portfolioEngine.healthCheck()
      });
    }

    const prioritizationEngine = safeRequire('./projectPrioritizationEngineService');
    if (prioritizationEngine) {
      this.register({
        engineId: 'PROJECT_PRIORITIZATION_ENGINE',
        engineName: 'محرك ترجيح وأولويات المشاريع الهندسية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['criteria_weighting', 'project_scoring', 'priority_ranking'],
        dependencies: ['DATABASE_ENGINE', 'PROJECTS_ENGINE'],
        instance: prioritizationEngine,
        exposedOperations: {
          createPriorityCriterion: (d, u) => prioritizationEngine.createPriorityCriterion(d, u),
          setProjectCriterionScore: (pId, cId, s, n, u) => prioritizationEngine.setProjectCriterionScore(pId, cId, s, n, u),
          calculateProjectPriority: (pId, u) => prioritizationEngine.calculateProjectPriority(pId, u),
          rankProjects: () => prioritizationEngine.rankProjects()
        },
        healthCheck: () => prioritizationEngine.healthCheck()
      });
    }

    const finProgEngine = safeRequire('./projectFinancialProgrammingEngineService');
    if (finProgEngine) {
      this.register({
        engineId: 'PROJECT_FINANCIAL_PROGRAMMING_ENGINE',
        engineName: 'محرك البرمجة والتخصيص المالي للمشاريع',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['annual_programming', 'budget_ceiling_validation'],
        dependencies: ['DATABASE_ENGINE', 'PROJECTS_ENGINE', 'PROJECT_PORTFOLIO_ENGINE'],
        instance: finProgEngine,
        exposedOperations: {
          createFinancialProgram: (d, u) => finProgEngine.createFinancialProgram(d, u),
          getProjectFinancialProgram: (id) => finProgEngine.getProjectFinancialProgram(id),
          calculateProgrammedTotal: (id) => finProgEngine.calculateProgrammedTotal(id)
        },
        healthCheck: () => finProgEngine.healthCheck()
      });
    }

    const dependencyEngine = safeRequire('./projectDependencyEngineService');
    if (dependencyEngine) {
      this.register({
        engineId: 'PROJECT_DEPENDENCY_ENGINE',
        engineName: 'محرك شبكة واعتماديات تتابع المشاريع',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['dependency_network', 'cycle_detection', 'readiness_validation'],
        dependencies: ['DATABASE_ENGINE', 'PROJECTS_ENGINE'],
        instance: dependencyEngine,
        exposedOperations: {
          createDependency: (d, u) => dependencyEngine.createDependency(d, u),
          getDependencies: (f) => dependencyEngine.getDependencies(f),
          validateProjectReadiness: (id) => dependencyEngine.validateProjectReadiness(id),
          detectCycle: (fId, tId, eId) => dependencyEngine.detectCycle(fId, tId, eId)
        },
        healthCheck: () => dependencyEngine.healthCheck()
      });
    }

    const schedulingEngine = safeRequire('./projectSchedulingEngineService');
    if (schedulingEngine) {
      this.register({
        engineId: 'PROJECT_SCHEDULING_ENGINE',
        engineName: 'محرك الجدولة الزمنية والمسار الحرج (CPM)',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['cpm_calculation', 'critical_path_analysis', 'conflict_detection'],
        dependencies: ['DATABASE_ENGINE', 'PROJECTS_ENGINE', 'PROJECT_DEPENDENCY_ENGINE'],
        instance: schedulingEngine,
        exposedOperations: {
          calculateNetworkCPM: (f, u) => schedulingEngine.calculateNetworkCPM(f, u),
          getProjectSchedule: (id, v) => schedulingEngine.getProjectSchedule(id, v),
          getCriticalPath: (f) => schedulingEngine.getCriticalPath(f),
          detectScheduleConflicts: () => schedulingEngine.detectScheduleConflicts()
        },
        healthCheck: () => schedulingEngine.healthCheck()
      });
    }

    // ─── 3. محركات العطاءات، العقود، والمشتريات (Contracts & Procurement) ───

    const tendersEngine = safeRequire('./tendersEngineService');
    if (tendersEngine) {
      this.register({
        engineId: 'TENDERS_ENGINE',
        engineName: 'محرك إدارة العطاءات والمشاريع الرأسمالية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['tender_crud', 'boq_management', 'tender_awarding'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: tendersEngine,
        exposedOperations: {
          getTenders: (f, u) => tendersEngine.getTenders(f, u),
          getTenderById: (id) => tendersEngine.getTenderById(id),
          createTender: (d, u) => tendersEngine.createTender(d, u),
          awardTender: (id, d, u) => tendersEngine.awardTender(id, d, u)
        },
        healthCheck: () => tendersEngine.healthCheck()
      });
    }

    const contractsEngine = safeRequire('./contractsEngineService');
    if (contractsEngine) {
      this.register({
        engineId: 'CONTRACTS_ENGINE',
        engineName: 'محرك العقود والكفالات البنكية والأوامر التغييرية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['contracts_crud', 'bank_guarantees', 'variation_orders', 'clauses', 'workflow', 'digital_signatures', 'guarantee_alerts'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUDGET_ENGINE'],
        instance: contractsEngine,
        exposedOperations: {
          getContracts: (f, u) => contractsEngine.getContracts(f, u),
          getContractById: (id) => contractsEngine.getContractById(id),
          createContract: (d, u) => contractsEngine.createContract(d, u),
          updateContract: (id, d, u) => contractsEngine.updateContract(id, d, u),
          deleteContract: (id, u) => contractsEngine.deleteContract(id, u),
          addVariationOrder: (id, d, u) => contractsEngine.addVariationOrder(id, d, u),
          getVariationOrders: (id) => contractsEngine.getVariationOrders(id),
          deleteVariationOrder: (id, vId, u) => contractsEngine.deleteVariationOrder(id, vId, u),
          addBankGuarantee: (id, d, u) => contractsEngine.addBankGuarantee(id, d, u),
          getBankGuarantees: (id) => contractsEngine.getBankGuarantees(id),
          getGuaranteesAlerts: () => contractsEngine.getGuaranteesAlerts(),
          transitionWorkflow: (id, d, u) => contractsEngine.transitionWorkflow(id, d, u),
          signContract: (id, d, u) => contractsEngine.signContract(id, d, u),
          getClauses: (id) => contractsEngine.getClauses(id),
          addClause: (id, d, u) => contractsEngine.addClause(id, d, u),
          getKpis: () => contractsEngine.getKpis()
        },
        healthCheck: () => contractsEngine.healthCheck ? contractsEngine.healthCheck() : ({ status: 'READY' })
      });
    }

    const claimsEngine = safeRequire('./claimsEngineService');
    if (claimsEngine) {
      this.register({
        engineId: 'CLAIMS_ENGINE',
        engineName: 'محرك المطالبات والدفعات المالية للمقاولين',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['claims_crud', 'deductions_calculation'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: claimsEngine,
        exposedOperations: {
          getClaims: (f, u) => claimsEngine.getClaims(f, u),
          getClaimById: (id) => claimsEngine.getClaimById(id),
          createClaim: (d, u) => claimsEngine.createClaim(d, u)
        },
        healthCheck: () => claimsEngine.healthCheck ? claimsEngine.healthCheck() : ({ status: 'READY' })
      });
    }

    const budgetEngine = safeRequire('./budgetEngineService');
    if (budgetEngine) {
      this.register({
        engineId: 'BUDGET_ENGINE',
        engineName: 'محرك الموازنة العامة لمديرية الأشغال',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['budget_allocation', 'ceiling_validation'],
        dependencies: ['DATABASE_ENGINE'],
        instance: budgetEngine,
        exposedOperations: {
          createAllocation: (d) => budgetEngine.createAllocation(d),
          getBudgetSummary: (y) => budgetEngine.getBudgetSummary(y)
        },
        healthCheck: () => budgetEngine.healthCheck ? budgetEngine.healthCheck() : ({ status: 'READY' })
      });
    }

    const purchasesEngine = safeRequire('./purchasesEngineService');
    if (purchasesEngine) {
      this.register({
        engineId: 'PURCHASES_ENGINE',
        engineName: 'محرك أوامر الشراء والتوريدات ولجان الاستلام',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['purchases_crud', 'receiving_committee', 'workflow_dispatch', 'budget_commitment', 'archive_integration'],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'BUDGET_ENGINE', 'ARCHIVE_DOCUMENT_ENGINE', 'AUDIT_LOG_ENGINE'],
        instance: purchasesEngine,
        exposedOperations: {
          getPurchases: (f, u) => purchasesEngine.getPurchases(f, u),
          getPurchaseById: (id) => purchasesEngine.getPurchaseById(id),
          createPurchase: (d, u) => purchasesEngine.createPurchase(d, u),
          updatePurchase: (id, d, u) => purchasesEngine.updatePurchase(id, d, u),
          advanceWorkflow: (id, d, u) => purchasesEngine.advanceWorkflow(id, d, u),
          approvePurchase: (id, d, u) => purchasesEngine.approvePurchase(id, d, u),
          receivePurchaseItems: (id, d, u) => purchasesEngine.receivePurchaseItems(id, d, u),
          deletePurchase: (id, u) => purchasesEngine.deletePurchase(id, u),
          batchDeletePurchases: (ids, u) => purchasesEngine.batchDeletePurchases(ids, u),
          getPurchasesStats: () => purchasesEngine.getPurchasesStats()
        },
        healthCheck: () => purchasesEngine.healthCheck()
      });
    }

    // ─── 4. محركات الطرق، الأصول، والمساحة (Roads, Assets & GIS) ───

    const roadsEngine = safeRequire('./roadsEngineService');
    if (roadsEngine) {
      this.register({
        engineId: 'ROADS_ENGINE',
        engineName: 'محرك شبكة الطرق وتقييم الرصفات (PCI)',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['roads_crud', 'pci_assessment', 'network_statistics'],
        dependencies: ['DATABASE_ENGINE', 'SPATIAL_GIS_ENGINE'],
        instance: roadsEngine,
        exposedOperations: {
          getRoads: (f) => roadsEngine.getRoads(f),
          getRoadById: (id) => roadsEngine.getRoadById(id),
          createRoad: (d, u) => roadsEngine.createRoad(d, u),
          calculatePCI: (distresses) => roadsEngine.calculatePCI(distresses),
          addPciSurvey: (id, d, u) => roadsEngine.addPciSurvey(id, d, u),
          getNetworkStats: () => roadsEngine.getNetworkStats()
        },
        healthCheck: () => roadsEngine.healthCheck()
      });
    }

    const gisSurvey = safeRequire('./gisSurveyService');
    if (gisSurvey) {
      this.register({
        engineId: 'GIS_SURVEY_ENGINE',
        engineName: 'محرك الرفع المساحي واستيراد النقاط الجغرافية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['survey_import', 'postgis_geom', 'geojson_conversion'],
        dependencies: ['DATABASE_ENGINE'],
        instance: gisSurvey,
        exposedOperations: {
          importSurveyPoints: (pts, user) => gisSurvey.importSurveyPoints(pts, user)
        },
        healthCheck: async () => ({ status: 'READY' })
      });
    }

    const pavementReturns = safeRequire('./pavementReturnsEngineService');
    if (pavementReturns) {
      this.register({
        engineId: 'PAVEMENT_RETURNS_ENGINE',
        engineName: 'محرك عوائد التعبيد والتحققات البلدية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'returns_calculation',
          'returns_crud',
          'revenue_collection',
          'workflow_approval_lifecycle',
          'spatial_gis_mapping'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: pavementReturns,
        exposedOperations: {
          getPavingReturns: (f, u) => pavementReturns.getPavingReturns(f, u),
          getPavingReturnById: (id) => pavementReturns.getPavingReturnById(id),
          createPavingReturn: (d, u) => pavementReturns.createPavingReturn(d, u),
          updatePavingReturn: (id, d, u) => pavementReturns.updatePavingReturn(id, d, u),
          deletePavingReturn: (id, u) => pavementReturns.deletePavingReturn(id, u),
          recordPayment: (id, d, u) => pavementReturns.recordPayment(id, d, u),
          advanceApproval: (id, p, u) => pavementReturns.advanceApproval(id, p, u),
          calculatePavingReturn: (l, w, p, r) => pavementReturns.calculatePavingReturn(l, w, p, r),
          getReturnsStats: (f, u) => pavementReturns.getReturnsStats(f, u)
        },
        healthCheck: () => pavementReturns.healthCheck()
      });
    }

    const assetsEngine = safeRequire('./assetsEngineService');
    if (assetsEngine) {
      this.register({
        engineId: 'ASSETS_ENGINE',
        engineName: 'محرك الأصول البلدية والمرافق والآليات (Valuation & Depreciation)',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'asset_registry_lifecycle',
          'straight_line_depreciation',
          'book_value_valuation',
          'specialized_engine_bridge',
          'maintenance_expenditure_logging',
          'dual_persistence_storage',
          'assets_crud'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
        instance: assetsEngine,
        exposedOperations: {
          registerAsset: (d, u) => assetsEngine.registerAsset(d, u),
          createAsset: (d, u) => assetsEngine.createAsset(d, u),
          getAssets: (f, u) => assetsEngine.getAssets(f, u),
          getAssetById: (id) => assetsEngine.getAssetById(id),
          updateAsset: (id, u, user) => assetsEngine.updateAsset(id, u, user),
          deleteAsset: (id, user) => assetsEngine.deleteAsset(id, user),
          calculateDepreciation: (a, y, l, s) => assetsEngine.calculateDepreciation(a, y, l, s),
          recordMaintenanceExpense: (id, d, u) => assetsEngine.recordMaintenanceExpense(id, d, u),
          getAssetsStats: () => assetsEngine.getAssetsStats(),
          healthCheck: () => assetsEngine.healthCheck()
        },
        healthCheck: () => assetsEngine.healthCheck()
      });
    }

    const specializedAssets = safeRequire('./specializedAssetsEngine');
    if (specializedAssets) {
      this.register({
        engineId: 'SPECIALIZED_ASSETS_ENGINE',
        engineName: 'محرك الأصول التخصصية وشبكات البنية التحتية والإنارة',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'lighting_networks_management',
          'infrastructure_assets_tracking',
          'structural_buildings_audit',
          'specialized_numbering_integration',
          'asset_condition_monitoring'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'ASSETS_ENGINE'],
        instance: specializedAssets,
        exposedOperations: {
          registerSpecializedAsset: (d, u) => specializedAssets.registerSpecializedAsset(d, u),
          getSpecializedAssets: (f) => specializedAssets.getSpecializedAssets(f),
          getAssetsSummary: () => specializedAssets.getAssetsSummary(),
          getStructuralAssets: (f) => specializedAssets.getStructuralAssets(f),
          createStructuralAsset: (d, u) => specializedAssets.createStructuralAsset(d, u),
          deleteStructuralAsset: (id, u) => specializedAssets.deleteStructuralAsset(id, u),
          getInfrastructureNetworks: (f) => specializedAssets.getInfrastructureNetworks(f),
          createInfrastructureNetwork: (d, u) => specializedAssets.createInfrastructureNetwork(d, u),
          deleteInfrastructureNetwork: (id, u) => specializedAssets.deleteInfrastructureNetwork(id, u),
          getEnergyAssets: (f) => specializedAssets.getEnergyAssets(f),
          createEnergyAsset: (d, u) => specializedAssets.createEnergyAsset(d, u),
          deleteEnergyAsset: (id, u) => specializedAssets.deleteEnergyAsset(id, u),
          getExcavationPermits: (f) => specializedAssets.getExcavationPermits(f),
          createExcavationPermit: (d, u) => specializedAssets.createExcavationPermit(d, u),
          reinstateExcavationPermit: (id, d, u) => specializedAssets.reinstateExcavationPermit(id, d, u),
          deleteExcavationPermit: (id, u) => specializedAssets.deleteExcavationPermit(id, u),
          healthCheck: () => specializedAssets.healthCheck()
        },
        healthCheck: () => specializedAssets.healthCheck()
      });
    }

    // ENERGY_LIGHTING_ENGINE — instance يُستمَد من specializedAssetsEngine (محرك حقيقي مسجّل)
    // لا safeRequire لملفات UI (Assets/Pages/energyLighting.js ملف واجهة متصفح فقط)
    this.register({
      engineId: 'ENERGY_LIGHTING_ENGINE',
      engineName: 'محرك شبكات الطاقة والإنارة العامة',
      category: 'DOMAIN_ENGINE',
      status: specializedAssets ? 'READY' : 'DEGRADED',
      capabilities: ['lighting_network_tracking', 'energy_efficiency'],
      dependencies: ['DATABASE_ENGINE', 'ASSETS_ENGINE', 'SPECIALIZED_ASSETS_ENGINE'],
      instance: specializedAssets || null,
      exposedOperations: {
        registerLightingAsset: (d, u) => specializedAssets ? specializedAssets.createEnergyAsset(d, u) : null,
        getLightingAssets: (f) => specializedAssets ? specializedAssets.getEnergyAssets(f) : [],
        deleteEnergyAsset: (id, u) => specializedAssets ? specializedAssets.deleteEnergyAsset(id, u) : null
      },
      healthCheck: async () => specializedAssets ? specializedAssets.healthCheck() : ({ status: 'DEGRADED', reason: 'SPECIALIZED_ASSETS_ENGINE not loaded' })
    });

    // INFRASTRUCTURE_NETWORKS_ENGINE — instance يُستمَد من specializedAssetsEngine
    // لا safeRequire لملفات UI (Assets/Pages/infrastructureNetworks.js ملف واجهة متصفح فقط)
    this.register({
      engineId: 'INFRASTRUCTURE_NETWORKS_ENGINE',
      engineName: 'محرك شبكات البنية التحتية والمرافق',
      category: 'DOMAIN_ENGINE',
      status: specializedAssets ? 'READY' : 'DEGRADED',
      capabilities: ['infrastructure_lines', 'utility_coordination'],
      dependencies: ['DATABASE_ENGINE', 'ASSETS_ENGINE', 'SPECIALIZED_ASSETS_ENGINE'],
      instance: specializedAssets || null,
      exposedOperations: {
        registerInfrastructureAsset: (d, u) => specializedAssets ? specializedAssets.createInfrastructureNetwork(d, u) : null,
        getInfrastructureAssets: (f) => specializedAssets ? specializedAssets.getInfrastructureNetworks(f) : [],
        deleteInfrastructureNetwork: (id, u) => specializedAssets ? specializedAssets.deleteInfrastructureNetwork(id, u) : null
      },
      healthCheck: async () => specializedAssets ? specializedAssets.healthCheck() : ({ status: 'DEGRADED', reason: 'SPECIALIZED_ASSETS_ENGINE not loaded' })
    });

    // STRUCTURAL_ASSETS_ENGINE — instance يُستمَد من specializedAssetsEngine
    // لا safeRequire لملفات UI (Assets/Pages/structuralAssets.js ملف واجهة متصفح فقط)
    this.register({
      engineId: 'STRUCTURAL_ASSETS_ENGINE',
      engineName: 'محرك الأصول الإنشائية والجدران الاستنادية',
      category: 'DOMAIN_ENGINE',
      status: specializedAssets ? 'READY' : 'DEGRADED',
      capabilities: ['retaining_walls', 'public_buildings_monitoring'],
      dependencies: ['DATABASE_ENGINE', 'ASSETS_ENGINE', 'SPECIALIZED_ASSETS_ENGINE'],
      instance: specializedAssets || null,
      exposedOperations: {
        registerStructuralAsset: (d, u) => specializedAssets ? specializedAssets.createStructuralAsset(d, u) : null,
        getStructuralAssets: (f) => specializedAssets ? specializedAssets.getStructuralAssets(f) : [],
        deleteStructuralAsset: (id, u) => specializedAssets ? specializedAssets.deleteStructuralAsset(id, u) : null
      },
      healthCheck: async () => specializedAssets ? specializedAssets.healthCheck() : ({ status: 'DEGRADED', reason: 'SPECIALIZED_ASSETS_ENGINE not loaded' })
    });

    // ─── 5. العمليات الميدانية والرقابة والتكامل الحكومي (Operations & G2G) ───

    const tasksEngine = safeRequire('./tasksEngineService');
    if (tasksEngine) {
      this.register({
        engineId: 'TASKS_ENGINE',
        engineName: 'محرك إدارة المهام والتكليفات الإدارية والتشغيلية الداخلية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'tasks_crud',
          'atomic_task_numbering',
          'assignee_notifications',
          'status_lifecycle',
          'dual_storage_persistence'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: tasksEngine,
        exposedOperations: {
          getTasks: (f, u) => tasksEngine.getTasks(f, u),
          getTaskById: (id) => tasksEngine.getTaskById(id),
          createTask: (d, u) => tasksEngine.createTask(d, u),
          updateTask: (id, d, u) => tasksEngine.updateTask(id, d, u),
          deleteTask: (id, u) => tasksEngine.deleteTask(id, u)
        },
        healthCheck: async () => tasksEngine.healthCheck ? tasksEngine.healthCheck() : ({ status: 'READY' })
      });
    }

    const wocService = safeRequire('./workOperationsCenterService');
    if (wocService) {
      this.register({
        engineId: 'OPERATIONS_CENTER',
        engineName: 'مركز العمليات والتحكم الهندسي والمتابعة الميدانية',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: [
          'operations_tracking',
          'field_actions',
          'appeals_management',
          'spatial_dispatch',
          'sla_monitoring',
          'routing_orchestration',
          'duplicate_detection'
        ],
        dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: wocService,
        exposedOperations: {
          getOperations: (f, u) => wocService.getOperations(f, u),
          getOperationById: (id) => wocService.getOperationById(id),
          createOperation: (d, u) => wocService.createOperation(d, u),
          updateOperation: (id, d, u) => wocService.updateOperation(id, d, u),
          deleteOperation: (id, u) => wocService.deleteOperation(id, u),
          executeRoutingAction: (p) => wocService.executeRoutingAction(p),
          addEndorsementNote: (p) => wocService.addEndorsementNote(p),
          finalizeAndApprove: (p) => wocService.finalizeAndApprove(p),
          getExecutiveStats: (u) => wocService.getExecutiveStats(u),
          getNearbySpatialContext: (p) => wocService.getNearbySpatialContext(p),
          checkDuplicates: (p) => wocService.checkDuplicates(p),
          saveFieldReport: (id, r, u) => wocService.saveFieldReport(id, r, u),
          addComment: (id, t, u) => wocService.addComment(id, t, u),
          updateSubtasks: (id, s, u) => wocService.updateSubtasks(id, s, u),
          addAttachments: (id, f, u) => wocService.addAttachments(id, f, u),
          deleteAttachment: (id, a) => wocService.deleteAttachment(id, a)
        },
        healthCheck: () => wocService.healthCheck()
      });
    }

    const inspectionEngine = safeRequire('./inspectionEngineService');
    if (inspectionEngine) {
      this.register({
        engineId: 'INSPECTION_ENGINE',
        engineName: 'محرك التفتيش الميداني وضبط الجودة',
        category: 'DOMAIN_ENGINE',
        status: 'READY',
        capabilities: ['field_inspections', 'defect_logging'],
        dependencies: ['DATABASE_ENGINE', 'NOTIFICATION_ENGINE'],
        instance: inspectionEngine,
        exposedOperations: {
          getInspections: (f) => inspectionEngine.getInspections(f),
          getInspectionById: (id) => inspectionEngine.getInspectionById(id),
          recordInspection: (d, u) => inspectionEngine.recordInspection(d, u),
          resolveInspection: (id, d, u) => inspectionEngine.resolveInspection(id, d, u),
          deleteInspection: (id, u) => inspectionEngine.deleteInspection(id, u),
          getInspectionStats: () => inspectionEngine.getInspectionStats()
        },
        healthCheck: () => inspectionEngine.healthCheck()
      });
    }

    const committeesEngine = safeRequire('./committeesEngineService') || safeRequire('../Committees/API/committeesEngine');
    this.register({
      engineId: 'COMMITTEES_ENGINE',
      engineName: 'محرك اللجان ومحاضر الاستلام الفنية',
      category: 'DOMAIN_ENGINE',
      status: 'READY',
      capabilities: ['committees_management', 'minutes_logging', 'handover_protocols', 'tender_evaluation'],
      dependencies: ['DATABASE_ENGINE', 'NUMBERING_ENGINE'],
      instance: committeesEngine,
      exposedOperations: {
        getCommittees: (f, u) => committeesEngine.getCommittees ? committeesEngine.getCommittees(f, u) : [],
        getCommitteeById: (id) => committeesEngine.getCommitteeById ? committeesEngine.getCommitteeById(id) : null,
        createCommittee: (d, u) => committeesEngine.createCommittee ? committeesEngine.createCommittee(d, u) : null,
        getReports: (f) => committeesEngine.getReports ? committeesEngine.getReports(f) : [],
        getStudies: (f) => committeesEngine.getStudies ? committeesEngine.getStudies(f) : [],
        createStudy: (d, u) => committeesEngine.createStudy ? committeesEngine.createStudy(d, u) : null
      },
      healthCheck: async () => (committeesEngine.healthCheck ? committeesEngine.healthCheck() : { status: 'READY' })
    });

    const g2gGateway = safeRequire('./g2gGatewayEngineService');
    if (g2gGateway) {
      this.register({
        engineId: 'G2G_GATEWAY_ENGINE',
        engineName: 'بوابة الربط الحكومي والتكامل مع الوزارات',
        category: 'INTEGRATION_GATEWAY',
        status: 'READY',
        capabilities: ['ministry_dispatch', 'data_hash_verification'],
        dependencies: ['DATABASE_ENGINE'],
        instance: g2gGateway,
        exposedOperations: {
          dispatchPayload: (min, type, data, user) => g2gGateway.dispatchPayload(min, type, data, user)
        },
        healthCheck: () => g2gGateway.healthCheck()
      });
    }

    this._initialized = true;
    logInfo('EngineRegistry', `✅ All ${this._engines.size} Enterprise Engines successfully registered.`);
  }
}

// تصدير الكائن الفردي
const globalRegistry = new EngineRegistry();
module.exports = globalRegistry;
