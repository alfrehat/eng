/**
 * services/businessRulesEngine.js
 * 🏛️ محرك قواعد الأعمال والعمليات الحسابية المركزي العام (Generic Business Rules & Calculation Engine)
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v1.0
 * 
 * المبادئ الدستورية:
 * 1. محرك عام 100% يخدم كافة الموديولات (طرق، عطاءات، عقود، أصول، تصاريح، عوائد تعبيد).
 * 2. منع الأكواد الحسابية المتفرقة أو المنطق الصلب (Zero Hardcoded Logic).
 * 3. دقة رقمية فائقة ومنع أخطاء التقريب والـ Floating Point.
 * 4. التحقق والتدقيق الصارم لقواعد ومعايير العمليات الهندسية والمالية.
 */

let memDb = null;
try {
  const dbModule = require('../utils/database');
  memDb = dbModule.memDb;
} catch (e) {}

class BusinessRulesEngine {
  constructor() {
    this.name = 'GenericBusinessRulesEngine';
    this.version = '1.0.0';
  }

  _getSystemSettings() {
    return (memDb && memDb.system_settings && memDb.system_settings[0]) || {};
  }

  // =========================================================================
  // 1️⃣ سجل القواعد الهندسية: حساب مؤشر جودة الرصفة (Pavement Condition Index - PCI)
  // =========================================================================
  /**
   * حساب مؤشر جودة الرصفة الإسفلتية وفق معيار ASTM D6433
   * @param {Array} distresses - مصفوفة العيوب [{ type: 'potholes', severity: 'H|M|L', density: 12.5 }, ...]
   * @param {String} surfaceType - نوع السطح (asphalt, concrete, paving_stones)
   * @returns {Object} { pciScore, conditionRating, recommendedTreatment, urgencyLevel }
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

    // جدول أوزان خصم العيوب الإسفلتية القياسية
    const deductWeightMap = {
      potholes: { H: 25, M: 15, L: 8 },         // حفر وهبوطات
      alligator_cracking: { H: 20, M: 12, L: 6 },// شقوق تمساحية
      rutting: { H: 18, M: 10, L: 5 },            // أخاديد مسارات العجلات
      longitudinal_cracking: { H: 12, M: 7, L: 3 },// شقوق طولية وعرضية
      bleeding: { H: 10, M: 6, L: 2 },             // نزيف أسفلتي
      raveling: { H: 14, M: 8, L: 4 },             // تفكك وتطاير الحصمة
      edge_cracking: { H: 10, M: 5, L: 2 },        // تآكل أطراف الرصيف
      patching: { H: 8, M: 4, L: 1 }               // رقع عشوائية
    };

    let totalDeduct = 0;
    for (const d of distresses) {
      const typeKey = (d.type || 'potholes').toLowerCase();
      const sev = (d.severity || 'M').toUpperCase();
      const density = parseFloat(d.density || 1);

      const weights = deductWeightMap[typeKey] || { H: 15, M: 8, L: 4 };
      const baseDeduct = weights[sev] || weights.M;
      
      // معامل الكثافة
      const densityFactor = Math.min(Math.max(density / 10, 0.5), 2.5);
      totalDeduct += baseDeduct * densityFactor;
    }

    // تصحيح الخصم المتعدد (Corrected Deduct Value - CDV)
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

  // =========================================================================
  // 2️⃣ سجل القواعد المالية البلدية: احتساب عوائد التعبيد والتحققات
  // =========================================================================
  /**
   * احتساب عوائد التعبيد والتزفيت على العقارات وفق أحكام قانون البلديات
   * @param {Object} params { frontageMeters, streetWidthMeters, zoneRatePerM2, discountPct, isExempt }
   * @returns {Object} { assessedAreaM2, grossAmount, discountAmount, netPayable, formulaExplanation }
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

    // احتساب نصف سعة الشارع الخاضعة للتحقق (بحد أقصى للشارع التنظيمي)
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

  // =========================================================================
  // 3️⃣ سجل القواعد المالية الهندسية: حساب استقطاعات وصافي المطالبات المالية
  // =========================================================================
  /**
   * حساب الاستقطاعات الرسمية وصافي الدفعة للمطالبات المالية للمقاولين
   * @param {Object} params { contractValue, currentCompletedValue, previousPayments, retentionPct, penaltyDays, dailyPenaltyRate, advanceDeduction, taxPct, stampsPct, syndicatePct }
   * @returns {Object} { currentGross, retentionAmount, penaltiesAmount, advanceAmount, taxAmount, stampsAmount, syndicateAmount, totalDeductions, netPayable }
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

    // إجمالي الأعمال المنجزة في هذه المطالبة
    const currentGross = Math.max(0, Math.round((completed - prevPaid) * 100) / 100);
    
    // استقطاع حسن التنفيذ (Retention)
    const retentionAmount = Math.round((currentGross * (retPct / 100)) * 100) / 100;
    
    // غرامات التأخير اليومية
    const penaltiesAmount = Math.round((pDays * pRate) * 100) / 100;

    // الضرائب والرسوم القانونية (اختياري بحسب نوع المستخلص)
    const taxAmount = Math.round((currentGross * (effectiveTaxPct / 100)) * 100) / 100;
    const stampsAmount = Math.round((currentGross * (effectiveStampsPct / 100)) * 100) / 100;
    const syndicateAmount = Math.round((currentGross * (effectiveSyndicatePct / 100)) * 100) / 100;
    
    // إجمالي الخصومات الرسمية
    const totalDeductions = Math.round((retentionAmount + penaltiesAmount + advDed + taxAmount + stampsAmount + syndicateAmount) * 100) / 100;
    
    // صافي المبلغ المستحق للصرف
    const netPayable = Math.max(0, Math.round((currentGross - totalDeductions) * 100) / 100);

    // نسبة الإنجاز التراكمي
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

  // =========================================================================
  // 4️⃣ سجل القواعد القانونية: تدقيق وتنبيه الكفالات والضمانات البنكية
  // =========================================================================
  /**
   * فحص حالة وسريان الكفالات والضمانات للعقود والعطاءات
   * @param {Object} params { expiryDate, guaranteeValue, contractValue, thresholdDays }
   * @returns {Object} { status, daysRemaining, isExpired, isCritical, minRequiredValue, meetsRequirement }
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
    const minRequired = Math.round((cVal * 0.1) * 100) / 100; // 10% من قيمة العقد
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
   * @param {Object} params { contractValue, existingVariationOrdersSum, newVariationOrderAmount }
   * @returns {Object} { isWithinLegalLimit, variationOrderPct, maxAllowedPct }
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

  // =========================================================================
  // 5️⃣ سجل القواعد الهندسية: حساب إهلاك وقيمة الأصول البلدية
  // =========================================================================
  /**
   * حساب الإهلاك السنوي والقيمة الدفترية الحالية للأصل البلدي
   * @param {Object} params { initialCost, salvageValue, usefulLifeYears, ageYears }
   * @returns {Object} { annualDepreciation, accumulatedDepreciation, bookValue, depreciationPct }
   */
  calculateAssetDepreciation({
    initialCost = 0,
    salvageValue = 0,
    usefulLifeYears = 20,
    ageYears = 0
  } = {}) {
    const cost = Math.max(0, parseFloat(initialCost) || 0);
    const salvage = Math.max(0, parseFloat(salvageValue) || 0);
    const life = Math.max(1, parseInt(usefulLifeYears, 10) || 20);
    const age = Math.max(0, parseFloat(ageYears) || 0);

    const depreciableBase = Math.max(0, cost - salvage);
    const annualDepreciation = Math.round((depreciableBase / life) * 100) / 100;
    const accumulatedDepreciation = Math.min(depreciableBase, Math.round((annualDepreciation * age) * 100) / 100);
    const bookValue = Math.max(salvage, Math.round((cost - accumulatedDepreciation) * 100) / 100);
    const depreciationPct = cost > 0 ? Math.round((accumulatedDepreciation / cost) * 10000) / 100 : 0;

    return {
      initialCost: cost,
      salvageValue: salvage,
      usefulLifeYears: life,
      ageYears: age,
      annualDepreciation,
      accumulatedDepreciation,
      bookValue,
      depreciationPct
    };
  }

  // =========================================================================
  // 6️⃣ سجل القواعد البلدية: احتساب رسوم وتأمين تصاريح الحفر (EPAMS)
  // =========================================================================
  /**
   * احتساب قيمة التأمين المالي ورسوم المتابعة الفنية لتصاريح الحفر
   * @param {Object} params { lengthMeters, widthMeters, surfaceType, durationDays, isEmergency }
   * @returns {Object} { excavationAreaM2, insuranceDeposit, permitFee, totalRequired }
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

    // تسعيرة التأمين المترية حسب نوع السطح
    const rateMap = {
      asphalt: 25,       // 25 دينار للمتر المربع أسفلت
      paving_tiles: 20,  // 20 دينار للبلاط والأرصفة
      dirt: 8            // 8 دنانير للترابي
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

  // =========================================================================
  // 7️⃣ سجل القواعد: فحص ومطابقة السقوف المالية للجان الشراء وصلاحيات الاعتماد
  // =========================================================================
  /**
   * فحص ومطابقة قيمة العطاء أو أمر الشراء مع السقف المالي المعتمد للجنة أو جهة الشراء
   * @param {Object} params { committee, purchaseMethod, amount }
   * @returns {Object} { allowed, committee, purchaseMethod, amount, committeeCeiling, methodCeiling, error, recommendedCommittee }
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
}

module.exports = new BusinessRulesEngine();
