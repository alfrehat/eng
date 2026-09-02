/**
 * Roads Pavement Layer - PCI & IRI Rating Engine
 */
class PavementRatingEngine {
  /**
   * حساب حالة الرصف بناءً على قيمة PCI (Pavement Condition Index)
   */
  static evaluatePCI(pci) {
    const score = parseFloat(pci || 0);
    if (score >= 85) return { rating: 'Good / Excellent', condition: 'ممتازة', color: '#10b981', action: 'صيانة وقائية دورية' };
    if (score >= 70) return { rating: 'Satisfactory', condition: 'جيدة', color: '#3b82f6', action: 'معالجة شقوق موضعية' };
    if (score >= 55) return { rating: 'Fair', condition: 'متوسطة', color: '#f59e0b', action: 'كشط وتعبيد (Overlay)' };
    if (score >= 40) return { rating: 'Poor', condition: 'ضعيفة', color: '#f97316', action: 'تأهيل جزئي وإعادة رصف' };
    return { rating: 'Serious / Failed', condition: 'متدهورة للغاية', color: '#ef4444', action: 'إعادة إنشاء كاملة (Reconstruction)' };
  }

  /**
   * حساب مؤشر الوعورة IRI (International Roughness Index - m/km)
   */
  static evaluateIRI(iri) {
    const value = parseFloat(iri || 0);
    if (value <= 1.5) return { smoothness: 'Smooth', label: 'ناعمة جداً', pciEquivalent: 95 };
    if (value <= 2.5) return { smoothness: 'Moderate', label: 'مقبولة', pciEquivalent: 80 };
    if (value <= 3.5) return { smoothness: 'Rough', label: 'وعرة', pciEquivalent: 60 };
    return { smoothness: 'Very Rough', label: 'وعرة جداً وتحتاج كشط', pciEquivalent: 40 };
  }
}

module.exports = PavementRatingEngine;
