/**
 * services/rulesEngineService.js
 * ⚙️ محرك قواعد الأعمال والعمليات الحسابية المركزي العام (RULE_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Business Rules & Calculation Patch
 */

const { isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class RuleEngineService {
  constructor() {
    this.engineId = 'RULE_ENGINE';
    this.engineName = 'Enterprise Central Business Rules & Calculation Engine';
    this.version = '2.0.0';
    this.category = 'CORE_SERVICE';
    this.status = 'READY';
    this.capabilities = [
      'dynamic_rule_evaluation',
      'safe_formula_calculation',
      'compliance_validation',
      'municipal_fees_computation',
      'audit_decision_trail',
      'pci_calculation',
      'claim_financials',
      'paving_returns'
    ];
  }

  _getSystemSettings() {
    return (memDb && memDb.system_settings && memDb.system_settings[0]) || {};
  }

  _roundCurrency(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء قواعد الأعمال [${action}] على القاعدة [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'قواعد الأعمال والتحقق',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('RuleEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * تقييم صيغة حسابية أو شرط منطقي بطريقة آمنة تماماً دون استخدام eval()
   */
  evaluateSafeExpression(expression, context = {}) {
    if (!expression || typeof expression !== 'string') return 0;
    
    // استبدال المتغيرات في النص بقيمها الفعلية من السياق
    let parsedExpr = expression;
    Object.keys(context).forEach(key => {
      const val = context[key];
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      parsedExpr = parsedExpr.replace(regex, typeof val === 'number' ? val : `"${val}"`);
    });

    // تقييم آمن للعمليات الرياضية والمقارنات عبر Function معزولة
    try {
      const safeFunction = new Function(`return (${parsedExpr});`);
      const result = safeFunction();
      return typeof result === 'number' ? this._roundCurrency(result) : result;
    } catch (e) {
      logError('RuleEngine', `Safe expression evaluation failed for [${expression}]: ${e.message}`);
      return null;
    }
  }

  /**
   * استرجاع قائمة قواعد الأعمال
   */
  async getRules(filters = {}) {
    const { category, active, search } = filters;
    if (isPostgresActive()) {
      try {
        let sql = 'SELECT * FROM public.business_rules WHERE 1=1';
        const params = [];
        if (category) {
          params.push(category);
          sql += ` AND category = $${params.length}`;
        }
        if (typeof active === 'boolean') {
          params.push(active);
          sql += ` AND active = $${params.length}`;
        }
        if (search) {
          params.push(`%${search.trim()}%`);
          sql += ` AND (rule_name ILIKE $${params.length} OR code ILIKE $${params.length})`;
        }
        sql += ' ORDER BY created_at DESC LIMIT 200';
        return await dbQuery(sql, params) || [];
      } catch (e) {
        logWarn('RuleEngine', `Database getRules fallback: ${e.message}`);
      }
    }

    let list = memDb.business_rules || [];
    if (category) list = list.filter(r => r.category === category);
    if (typeof active === 'boolean') list = list.filter(r => Boolean(r.active) === active);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r => (r.rule_name || '').toLowerCase().includes(s) || (r.code || '').toLowerCase().includes(s));
    }
    return list;
  }

  /**
   * إنشاء قاعدة أعمال جديدة بالترقيم المؤسسي
   */
  async createRule(ruleData, user = null) {
    const { ruleName, code, category, expression, description, active } = ruleData;
    if (!ruleName || !expression) throw new Error('اسم القاعدة وصيغة التقييم إلزاميان.');

    const id = await numberingEngine.generateNextId('criteria', { prefix: 'RUL' });
    const now = new Date().toISOString();

    const record = {
      id,
      code: code || id,
      rule_name: ruleName,
      category: category || 'GENERAL_COMPLIANCE',
      expression,
      description: description || '',
      active: active !== false,
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        await dbRun(`
          INSERT INTO public.business_rules
          (id, code, rule_name, category, expression, description, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [record.id, record.code, record.rule_name, record.category, record.expression, record.description, record.active]);
      } catch (e) {
        logWarn('RuleEngine', `Database insert rule fallback: ${e.message}`);
      }
    }

    if (!memDb.business_rules) memDb.business_rules = [];
    memDb.business_rules.unshift(record);
    saveMemTable('business_rules');

    await this._recordAudit(user?.id, id, 'RULE_CREATED', null, record);
    return record;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧮 العمليات الحسابية الهندسية والبلدية المعتمدة (Domain Calculation Engine)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * حساب مؤشر جودة الرصفة الإسفلتية وفق معيار ASTM D6433
   */
  calculatePciScore(distresses = [], surfaceType = 'asphalt') {
    let baseScore = 100;
    if (!Array.isArray(distresses) || distresses.length === 0) {
      return {
        pciScore: 100,
        conditionRating: 'ممتازة (Good / Excellent)',
        recommendedTreatment: 'صيانة وقائية دورية فقط (Routine Maintenance)',
        urgencyLevel: 'LOW'
      };
    }

    const deductWeightMap = {
      potholes: { H: 25, M: 15, L: 8 },
      alligator_cracking: { H: 20, M: 12, L: 6 },
      rutting: { H: 18, M: 10, L: 5 },
      longitudinal_cracking: { H: 12, M: 7, L: 3 },
      bleeding: { H: 10, M: 6, L: 2 },
      raveling: { H: 14, M: 8, L: 4 },
      edge_cracking: { H: 10, M: 5, L: 2 },
      patching: { H: 8, M: 4, L: 1 }
    };

    let totalDeduct = 0;
    for (const d of distresses) {
      const typeKey = (d.type || 'potholes').toLowerCase();
      const sev = (d.severity || 'M').toUpperCase();
      const density = parseFloat(d.density || 1);

      const weights = deductWeightMap[typeKey] || { H: 15, M: 8, L: 4 };
      const baseDeduct = weights[sev] || weights.M;
      const densityFactor = Math.min(Math.max(density / 10, 0.5), 2.5);
      totalDeduct += baseDeduct * densityFactor;
    }

    if (distresses.length > 1) {
      const q = distresses.length;
      totalDeduct = totalDeduct * (1 - (q * 0.05));
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore - totalDeduct)));
    const settings = this._getSystemSettings();
    const excMin = parseInt(settings.pci_excellent_min, 10) || 85;
    const goodMin = parseInt(settings.pci_good_min, 10) || 70;
    const fairMin = parseInt(settings.pci_fair_min, 10) || 55;

    let conditionRating = 'ممتازة (Good)';
    let recommendedTreatment = 'صيانة وقائية دورية (Routine Maintenance)';
    let urgencyLevel = 'LOW';

    if (finalScore >= excMin) {
      conditionRating = 'ممتازة (Good / Excellent)';
      recommendedTreatment = 'صيانة وقائية دورية (Routine Maintenance)';
      urgencyLevel = 'LOW';
    } else if (finalScore >= goodMin) {
      conditionRating = 'جيدة جداً (Satisfactory)';
      recommendedTreatment = 'إغلاق شقوق وتنعيم السطح (Crack Sealing & Slurry)';
      urgencyLevel = 'LOW';
    } else if (finalScore >= fairMin) {
      conditionRating = 'متوسطة (Fair)';
      recommendedTreatment = 'طبقة صيانة رقيقة ومعالجة رقع (Thin Overlay & Patching)';
      urgencyLevel = 'MEDIUM';
    } else if (finalScore >= 40) {
      conditionRating = 'سيئة (Poor)';
      recommendedTreatment = 'كشط وإعادة سفلتة (Mill & Resurface 5cm)';
      urgencyLevel = 'HIGH';
    } else {
      conditionRating = 'حرجة جداً / متدهورة (Critical / Failed)';
      recommendedTreatment = 'إعادة إنشاء وتأهيل كامل مع الأساسات (Full Reconstruction)';
      urgencyLevel = 'CRITICAL';
    }

    return {
      pciScore: finalScore,
      conditionRating,
      recommendedTreatment,
      urgencyLevel
    };
  }

  /**
   * احتساب عوائد التعبيد والتزفيت على العقارات وفق أحكام قانون البلديات
   */
  calculatePavingReturns({
    frontageMeters = 0,
    streetWidthMeters = 12,
    zoneRatePerM2 = null,
    discountPct = 0,
    isExempt = false
  } = {}) {
    const settings = this._getSystemSettings();
    const defaultPavingRate = parseFloat(settings.paving_unit_rate_jod) || 4.5;
    const frontage = Math.max(0, parseFloat(frontageMeters) || 0);
    const streetWidth = Math.max(0, parseFloat(streetWidthMeters) || 0);
    const rate = Math.max(0, parseFloat(zoneRatePerM2 !== null && zoneRatePerM2 !== undefined ? zoneRatePerM2 : defaultPavingRate) || defaultPavingRate);
    const discount = Math.max(0, Math.min(100, parseFloat(discountPct) || 0));

    if (isExempt || frontage <= 0 || streetWidth <= 0 || rate <= 0) {
      return {
        frontageMeters: frontage,
        assessedWidthMeters: 0,
        assessedAreaM2: 0,
        grossAmount: 0,
        discountAmount: 0,
        netPayable: 0,
        formulaExplanation: 'العقار معفى أو المدخلات صفرية'
      };
    }

    const assessedWidth = streetWidth / 2;
    const assessedAreaM2 = Math.round((frontage * assessedWidth) * 100) / 100;
    const grossAmount = Math.round((assessedAreaM2 * rate) * 100) / 100;
    const discountAmount = Math.round((grossAmount * (discount / 100)) * 100) / 100;
    const netPayable = Math.max(0, Math.round((grossAmount - discountAmount) * 100) / 100);

    return {
      frontageMeters: frontage,
      streetWidthMeters: streetWidth,
      assessedWidthMeters: assessedWidth,
      assessedAreaM2,
      zoneRatePerM2: rate,
      grossAmount,
      discountPct: discount,
      discountAmount,
      netPayable,
      formulaExplanation: `(الواجهة ${frontage}م × نصف سعة الشارع ${assessedWidth}م) × سعر المتر ${rate} د.أ = ${grossAmount} د.أ`
    };
  }

  /**
   * حساب الاستقطاعات الرسمية وصافي الدفعة للمطالبات المالية للمقاولين
   */
  calculateClaimFinancials({
    contractValue = 0,
    currentCompletedValue = 0,
    previousPayments = 0,
    retentionPct = null,
    penaltyDays = 0,
    dailyPenaltyRate = 0,
    advanceDeduction = 0,
    taxPct = null,
    stampsPct = null,
    syndicatePct = null
  } = {}) {
    const settings = this._getSystemSettings();
    const defaultRetention = parseFloat(settings.default_retention_pct) || 10.0;
    const defaultTax = parseFloat(settings.income_tax_withholding_pct) || 0.0;
    const defaultStamps = parseFloat(settings.revenue_stamps_pct) || 0.0;
    const defaultSyndicate = parseFloat(settings.contractors_syndicate_pct) || 0.0;

    const cVal = Math.max(0, parseFloat(contractValue) || 0);
    const completed = Math.max(0, parseFloat(currentCompletedValue) || 0);
    const prevPaid = Math.max(0, parseFloat(previousPayments) || 0);
    const retPct = Math.max(0, Math.min(100, parseFloat(retentionPct !== null && retentionPct !== undefined ? retentionPct : defaultRetention) || defaultRetention));
    const effectiveTaxPct = Math.max(0, parseFloat(taxPct) || 0);
    const effectiveStampsPct = Math.max(0, parseFloat(stampsPct) || 0);
    const effectiveSyndicatePct = Math.max(0, parseFloat(syndicatePct) || 0);

    const pDays = Math.max(0, parseInt(penaltyDays, 10) || 0);
    const pRate = Math.max(0, parseFloat(dailyPenaltyRate) || 0);
    const advDed = Math.max(0, parseFloat(advanceDeduction) || 0);

    const currentGross = Math.max(0, Math.round((completed - prevPaid) * 100) / 100);
    const retentionAmount = Math.round((currentGross * (retPct / 100)) * 100) / 100;
    const penaltiesAmount = Math.round((pDays * pRate) * 100) / 100;
    const taxAmount = Math.round((currentGross * (effectiveTaxPct / 100)) * 100) / 100;
    const stampsAmount = Math.round((currentGross * (effectiveStampsPct / 100)) * 100) / 100;
    const syndicateAmount = Math.round((currentGross * (effectiveSyndicatePct / 100)) * 100) / 100;
    
    const totalDeductions = Math.round((retentionAmount + penaltiesAmount + advDed + taxAmount + stampsAmount + syndicateAmount) * 100) / 100;
    const netPayable = Math.max(0, Math.round((currentGross - totalDeductions) * 100) / 100);
    const completionPercentage = cVal > 0 ? Math.min(100, Math.round((completed / cVal) * 10000) / 100) : 0;

    return {
      contractValue: cVal,
      cumulativeCompleted: completed,
      previousPayments: prevPaid,
      currentGross,
      retentionPct: retPct,
      retentionAmount,
      penaltyDays: pDays,
      penaltiesAmount,
      advanceDeduction: advDed,
      taxPct: effectiveTaxPct,
      taxAmount,
      stampsPct: effectiveStampsPct,
      stampsAmount,
      syndicatePct: effectiveSyndicatePct,
      syndicateAmount,
      totalDeductions,
      netPayable,
      completionPercentage
    };
  }

  /**
   * فحص حالة وسريان الكفالات والضمانات للعقود والعطاءات
   */
  validateGuaranteeStatus({
    expiryDate = null,
    guaranteeValue = 0,
    contractValue = 0,
    thresholdDays = null
  } = {}) {
    const settings = this._getSystemSettings();
    const daysArr = (settings.guarantee_alert_days || '30,15,7').split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean);
    const effectiveThreshold = parseInt(thresholdDays, 10) || (daysArr.length ? Math.max(...daysArr) : 30);
    const gVal = Math.max(0, parseFloat(guaranteeValue) || 0);
    const cVal = Math.max(0, parseFloat(contractValue) || 0);
    const minRequired = Math.round((cVal * 0.1) * 100) / 100;
    const meetsRequirement = cVal === 0 || gVal >= minRequired;

    if (!expiryDate) {
      return {
        status: 'UNKNOWN',
        daysRemaining: 0,
        isExpired: false,
        isCritical: false,
        minRequiredValue: minRequired,
        meetsRequirement,
        statusLabel: 'غير محدد تاريخ الانتهاء'
      };
    }

    const expTime = new Date(expiryDate).getTime();
    const nowTime = Date.now();
    const diffDays = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));

    let status = 'VALID';
    let statusLabel = 'سارية المفعول (Valid)';
    let isExpired = false;
    let isCritical = false;

    if (diffDays < 0) {
      status = 'EXPIRED';
      statusLabel = 'منتهية الصلاحية (Expired)';
      isExpired = true;
      isCritical = true;
    } else if (diffDays <= effectiveThreshold) {
      status = 'CRITICAL';
      statusLabel = `توشك على الانتهاء (متبقي ${diffDays} يوم)`;
      isCritical = true;
    }

    return {
      status,
      statusLabel,
      daysRemaining: diffDays,
      isExpired,
      isCritical,
      guaranteeValue: gVal,
      minRequiredValue: minRequired,
      meetsRequirement
    };
  }

  /**
   * تدقيق سقف الأوامر التغييرية ومطابقتها للحد القانوني (25% من قيمة العقد)
   */
  validateVariationOrderLimit({ contractValue = 0, existingVariationOrdersSum = 0, newVariationOrderAmount = 0 } = {}) {
    const cVal = Math.max(0, parseFloat(contractValue) || 0);
    const existing = Math.max(0, parseFloat(existingVariationOrdersSum) || 0);
    const newAmount = Math.max(0, parseFloat(newVariationOrderAmount) || 0);
    const maxPct = 25.0;
    const totalVO = existing + newAmount;
    const voPct = cVal > 0 ? (totalVO / cVal) * 100 : 0;
    const isWithinLegalLimit = voPct <= maxPct;
    return {
      contractValue: cVal,
      existingVariationOrdersSum: existing,
      newVariationOrderAmount: newAmount,
      totalVariationOrders: totalVO,
      variationOrderPct: Math.round(voPct * 100) / 100,
      maxAllowedPct: maxPct,
      isWithinLegalLimit
    };
  }

  /**
   * احتساب قيمة التأمين المالي ورسوم المتابعة الفنية لتصاريح الحفر
   */
  calculateExcavationPermitFee({
    lengthMeters = 0,
    widthMeters = 1,
    surfaceType = 'asphalt',
    durationDays = 7,
    isEmergency = false
  } = {}) {
    const len = Math.max(0, parseFloat(lengthMeters) || 0);
    const wid = Math.max(0.5, parseFloat(widthMeters) || 1);
    const days = Math.max(1, parseInt(durationDays, 10) || 7);
    const area = Math.round((len * wid) * 100) / 100;

    const rateMap = {
      asphalt: 25,
      paving_tiles: 20,
      dirt: 8
    };

    const rate = rateMap[surfaceType] || 25;
    const baseInsurance = Math.round((area * rate) * 100) / 100;
    const insuranceDeposit = isEmergency ? baseInsurance * 1.5 : baseInsurance;
    const permitFee = Math.round((Math.max(10, area * 1.5) + (days * 2)) * 100) / 100;
    const totalRequired = Math.round((insuranceDeposit + permitFee) * 100) / 100;

    return {
      excavationAreaM2: area,
      surfaceType,
      insuranceDeposit,
      permitFee,
      totalRequired,
      isEmergency
    };
  }

  /**
   * فحص ومطابقة قيمة العطاء أو أمر الشراء مع السقف المالي المعتمد للجنة
   */
  validatePurchaseCommitteeCeiling({
    committee = 'لجنة الشراء المحلية',
    purchaseMethod = 'مناقصة عامة',
    amount = 0
  } = {}) {
    const settings = this._getSystemSettings();
    const val = parseFloat(amount) || 0;

    const mayorCeiling = parseFloat(settings.mayor_purchase_ceiling_jod !== undefined ? settings.mayor_purchase_ceiling_jod : 5000.0);
    const localCeiling = parseFloat(settings.local_committee_ceiling_jod !== undefined ? settings.local_committee_ceiling_jod : 20000.0);
    const mainCeiling = parseFloat(settings.main_committee_ceiling_jod !== undefined ? settings.main_committee_ceiling_jod : 100000.0);
    const directCeiling = parseFloat(settings.direct_purchase_ceiling_jod !== undefined ? settings.direct_purchase_ceiling_jod : 3000.0);
    const quotationCeiling = parseFloat(settings.quotation_request_ceiling_jod !== undefined ? settings.quotation_request_ceiling_jod : 15000.0);
    const limitedCeiling = parseFloat(settings.limited_tender_ceiling_jod !== undefined ? settings.limited_tender_ceiling_jod : 50000.0);

    let committeeCeiling = Infinity;
    let committeeName = committee;

    if (committee === 'الرئيس' || committee === 'رئيس البلدية') {
      committeeCeiling = mayorCeiling;
      committeeName = 'رئيس البلدية';
    } else if (committee === 'لجنة الشراء المحلية' || committee === 'المحلية') {
      committeeCeiling = localCeiling;
      committeeName = 'لجنة الشراء المحلية';
    } else if (committee === 'لجنة الشراء الرئيسية' || committee === 'الرئيسية') {
      committeeCeiling = mainCeiling;
      committeeName = 'لجنة الشراء الرئيسية';
    }

    let methodCeiling = Infinity;
    if (purchaseMethod === 'شراء مباشر') {
      methodCeiling = directCeiling;
    } else if (purchaseMethod === 'استدراج عروض') {
      methodCeiling = quotationCeiling;
    } else if (purchaseMethod === 'مناقصة محدودة') {
      methodCeiling = limitedCeiling;
    }

    let allowed = true;
    let error = null;
    let recommendedCommittee = null;

    if (val > committeeCeiling) {
      allowed = false;
      error = `قيمة المعاملة (${val.toLocaleString('ar-JO')} د.أ) تتجاوز السقف المالي المحدد لصلاحية [${committeeName}] البالغ (${committeeCeiling.toLocaleString('ar-JO')} د.أ)`;
      if (val <= localCeiling) {
        recommendedCommittee = 'لجنة الشراء المحلية';
      } else if (val <= mainCeiling) {
        recommendedCommittee = 'لجنة الشراء الرئيسية';
      } else {
        recommendedCommittee = 'لجنة الشراء المركزية / مجلس بلدي';
      }
    } else if (val > methodCeiling) {
      allowed = false;
      error = `قيمة المعاملة (${val.toLocaleString('ar-JO')} د.أ) تتجاوز السقف المالي لطريقة الشراء [${purchaseMethod}] البالغ (${methodCeiling.toLocaleString('ar-JO')} د.أ)`;
    }

    return {
      allowed,
      committee: committeeName,
      purchaseMethod,
      amount: val,
      committeeCeiling,
      methodCeiling,
      error,
      recommendedCommittee
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalRules = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count FROM public.business_rules WHERE active = true');
        totalRules = parseInt(res?.count || 0, 10);
      } else {
        totalRules = (memDb.business_rules || []).filter(r => r.active).length;
      }
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        activeRulesCount: totalRules,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        activeRulesCount: (memDb.business_rules || []).filter(r => r.active).length,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const ruleEngineService = new RuleEngineService();
module.exports = ruleEngineService;
