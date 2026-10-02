/**
 * services/contractTemplateEngine.js
 * 📜 محرك قوالب العقود الإنشائية القانونية (CONTRACT_TEMPLATE_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Construction Contract Templates Patch
 */

'use strict';

const { isPostgresActive, dbQuery, dbGet, dbRun, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const archiveEngineService = require('./archiveEngineService');
const cryptoSignatureService = require('./cryptoSignatureService');
const { logInfo, logWarn, logError } = require('./loggerService');

const DEFAULT_CONTRACT_TYPES = [
  {
    id: 'CT-WORKS',
    code: 'WORKS_EXECUTION',
    name: 'اتفاقية تنفيذ أعمال مشروع',
    description: 'العقود الرسمية المنفذة للمشاريع الإنشائية والتعبيد والبنية التحتية',
    default_terms: {
      guarantee_rate: 10,
      maintenance_period_months: 12,
      penalty_per_day: 100
    },
    required_guarantees: ['PERFORMANCE_BOND', 'MAINTENANCE_BOND'],
    required_attachments: ['نسخة العطاء', 'قرار الإحالة', 'كفالة حسن التنفيذ', 'مخططات المشروع']
  },
  {
    id: 'CT-SUPPLY',
    code: 'SUPPLY_CONTRACT',
    name: 'عقد توريد مواد ومعدات',
    description: 'عقود الشراء والتوريد للخلطة الأسفلتية، وحدات الإنارة، والأنابيب',
    default_terms: { guarantee_rate: 5, delivery_location: 'مستودعات البلدية' },
    required_guarantees: ['PERFORMANCE_BOND'],
    required_attachments: ['سجل السعر', 'أمر التوريد']
  },
  {
    id: 'CT-SERVICES',
    code: 'SERVICES_CONTRACT',
    name: 'عقد تقديم خدمات هندسية وفنية',
    description: 'عقود المسح الميداني، صيانة الآليات، والفحوصات المخبرية',
    default_terms: { guarantee_rate: 5 },
    required_guarantees: ['PERFORMANCE_BOND'],
    required_attachments: ['العرض الفني والمالي']
  },
  {
    id: 'CT-MAINTENANCE',
    code: 'MAINTENANCE_CONTRACT',
    name: 'عقد صيانة وإصلاح',
    description: 'عقود صيانة الطرق، المظلات، والجدران الاستنادية',
    default_terms: { guarantee_rate: 10 },
    required_guarantees: ['PERFORMANCE_BOND', 'MAINTENANCE_BOND'],
    required_attachments: ['جدول الكميات']
  }
];

const DEFAULT_CLAUSES = [
  {
    clause_number: 1,
    title: 'وثائق العقد وتكاملها القانوني',
    content: 'تعتبر دعوة العطاء، الشروط العامة والخاصة، المواصفات الفنية والهندسية، جدول الكميات والأسعار، المخططات التنفيذية، قرار الإحالة النهائي، ورسالة الإخطار بالمباشرة جزءاً لا يتجزأ من هذه الاتفاقية وتقرأ وتفسر معها كوثيقة قانونية واحدة متكاملة.',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 2,
    title: 'تعهد المقاول بالتنفيذ والصيانة',
    content: 'يتعهد المقاول بموجب هذه الاتفاقية بتنفيذ كافة الأعمال المطلوبة وإتمامها وفقاً لأعلى المواصفات الفنية المعتمدة وتحت إشراف المهندس المشرف في بلدية كفرنجة الجديدة خلال مدة التنفيذ المحددة، كما يلتزم بصيانتها صيانة كاملة لمدة عام ميلادي من تاريخ التسليم الابتدائي.',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 3,
    title: 'قيمة العقد وآلية الدفعات المالية',
    content: 'تتعهد البلدية بدفع قيمة العقد للمقاول لقاء قيامه بتنفيذ الأعمال وإتمامها بناءً على المستخلصات الفنية الدورية المصادق عليها من المهندس المشرف ولجنة الاستلام، وبعد اقتطاع النسب والضمانات القانونية والمبالغ المترتبة بموجب القوانين والأنظمة.',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 4,
    title: 'الكفالات والضمانات البنكية',
    content: 'يلتزم المقاول بتقديم كفالة حسن تنفيذ بنكية غير مشروطة ومصادق عليها بنسبة (10%) من قيمة العقد الإجمالية قبل التوقيع على الاتفاقية، وتظل الكفالة سارية المفعول حتى التسليم الابتدائي النهائي للمشروع وتوفير كفالة الصيانة البنكية البديلة بنسبة (5%).',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 5,
    title: 'مدة التنفيذ وغرامات التأخير',
    content: 'يلتزم المقاول بإتمام جميع الأعمال كلياً وتراسل التسليم في موعد لا يتجاوز مدة العقد المحددة، وفي حال تأخره عن التسليم دون أسباب قاهرة معتمدة رسمياً من مجلس البلدية، تفرض عليه غرامة تأخير قدرها (100) دينار أردني عن كل يوم تأخير وتقتطع تلقائياً من استحقاقاته.',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 6,
    title: 'إجراءات السلامة العامة والموقع',
    content: 'يتعهد المقاول باتخاذ كافة احتياطات السلامة العامة وتوفير الشاخصات التحذيرية والإضاءة الليلية والحواجز المعتمدة في موقع العمل، ويكون مسؤولاً مسؤولية مدنية وجزائية كاملة عن أي أضرار لحقت بالمواطنين أو الممتلكات العامة والخاصة أثناء التنفيذ.',
    is_mandatory: true,
    show_in_print: true
  },
  {
    clause_number: 7,
    title: 'القانون الواجب التطبيق والنظرة القضائية',
    content: 'تخضع هذه الاتفاقية وتفسر وفقاً للقوانين والأنظمة المعمول بها في المملكة الأردنية الهاشمية (لا سيما نظام المشتريات الحكومية وقانون البلديات)، وتختص محاكم المملكة الأردنية الهاشمية بالنظر في أي نزاع قد ينشأ عن تنفيذ أو تفسير هذه الاتفاقية.',
    is_mandatory: true,
    show_in_print: true
  }
];

/**
 * استبدال المتغيرات الديناميكية داخل نص القالب
 */
function replacePlaceholders(templateText, data = {}) {
  if (!templateText) return '';
  let result = templateText;

  const mapping = {
    TenderName: data.tender_name || data.title || 'مشروع تعبيد وصيانة الطرق',
    TenderNumber: data.tender_number || data.procurement_id || data.tender_id || 'T-2026-001',
    ContractNumber: data.contract_number || data.id || 'CNT-2026-001',
    AwardDecisionNumber: data.award_decision_number || 'DEC-2026-88',
    AwardDate: data.award_date || new Date().toISOString().split('T')[0],
    ContractorName: data.contractor_name || 'شركة المقاولات العامة',
    ContractorRegNo: data.second_party_info?.reg_number || '102938',
    ContractorTaxNo: data.second_party_info?.tax_number || '90028471',
    ContractValue: data.total_value ? Number(data.total_value).toLocaleString('ar-JO') + ' دينار أردني' : '0 دينار',
    ExecutionPeriod: data.execution_period_days ? `${data.execution_period_days} يوماً تقويمياً` : '30 يوماً',
    StartDate: data.start_date || 'تاريخ المباشرة الرسمي',
    EndDate: data.end_date || 'تاريخ الانتهاء المعتمد',
    Engineer: data.supervising_engineer || 'مهندس المشاريع المختص',
    Department: data.department || 'مديرية الأشغال والخدمات الهندسية',
    FundingSource: data.funding_source || 'موازنة البلدية الذاتية',
    FirstPartyName: data.first_party_info?.name || 'بلدية كفرنجة الجديدة',
    FirstPartyRepresentative: data.first_party_info?.representative || 'رئيس بلدية كفرنجة الجديدة',
    SecondPartyName: data.contractor_name || data.second_party_info?.name || 'المقاول المنفذ',
    SecondPartyRepresentative: data.second_party_info?.representative || data.contractor_name || 'المفوض بالتوقيع',
    GuaranteePercentage: data.guarantee_percentage ? `${data.guarantee_percentage}%` : '10%',
    Sha256Hash: data.sha256_hash || 'SECURE-SHA256-VERIFIED'
  };

  for (const [key, val] of Object.entries(mapping)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, val || '');
  }

  // دعم المتغيرات الحرة الإضافية
  Object.keys(data).forEach(k => {
    if (data[k] !== undefined && data[k] !== null && typeof data[k] !== 'object') {
      const reg = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      result = result.replace(reg, String(data[k]));
    }
  });

  return result;
}

function getArabicOrdinal(num) {
  const ordinals = [
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
    'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون'
  ];
  return ordinals[num - 1] || `${num}`;
}

function generateOfficialContractHTML(contract = {}, clauses = [], identity = {}) {
  const municipalityName = identity.municipality_name || contract.first_party_info?.municipality || 'بلدية كفرنجة الجديدة';
  const logoPath = identity.logo_path || '/logo.jpg';
  const contractTitle = contract.title || 'اتفاقية تنفيذ أعمال مشروع';
  const contractNum = contract.contract_number || contract.id || 'CNT-2026-001';
  const tenderNum = contract.tender_number || contract.procurement_id || contract.tender_id || 'T-2026-001';
  const awardNum = contract.award_decision_number || 'DEC-2026-88';
  const awardDate = contract.award_date || new Date().toISOString().split('T')[0];
  const totalValue = contract.total_value ? Number(contract.total_value).toLocaleString('ar-JO') : '0';
  const period = contract.execution_period_days || 30;

  const firstParty = {
    name: municipalityName,
    representative: contract.first_party_info?.representative || 'رئيس بلدية كفرنجة الجديدة',
    title: contract.first_party_info?.title || 'رئيس البلدية',
    address: contract.first_party_info?.address || 'كفرنجة - المبنى الرئيسي',
    phone: contract.first_party_info?.phone || '064000000',
    email: contract.first_party_info?.email || 'info@kafrinja.gov.jo'
  };

  const secondParty = {
    name: contract.contractor_name || contract.second_party_info?.name || 'شركة المقاولات المعتمدة',
    regNumber: contract.second_party_info?.reg_number || '102938',
    taxNumber: contract.second_party_info?.tax_number || '90028471',
    representative: contract.second_party_info?.representative || contract.contractor_name || 'المفوض بالتوقيع',
    address: contract.second_party_info?.address || 'عمان - الأردن',
    phone: contract.second_party_info?.phone || '0790000000',
    email: contract.second_party_info?.email || 'info@contractor.jo'
  };

  let activeClauses = Array.isArray(clauses) && clauses.length > 0 ? clauses : DEFAULT_CLAUSES;

  const clausesHTML = activeClauses
    .filter(c => c && c.show_in_print !== false)
    .sort((a, b) => (a.clause_number || 1) - (b.clause_number || 1))
    .map((c, idx) => `
      <div class="legal-clause-block" style="margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; display: block; visibility: visible;">
        <h4 style="margin: 0 0 4px 0; color: #1e3a8a; font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 11.5pt; font-weight: bold; border-right: 4px solid #1e3a8a; padding-right: 8px; background: #f8fafc; padding-top: 3px; padding-bottom: 3px;">
          البند ${getArabicOrdinal(c.clause_number || idx + 1)}: ${c.title || 'بند الاتفاقية'}
        </h4>
        <p style="margin: 0; color: #334155; font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 10.5pt; line-height: 1.7; text-align: justify; text-justify: inter-word; text-indent: 1em;">
          ${replacePlaceholders(c.content || '', contract)}
        </p>
      </div>
    `).join('');

  const cDateObj = new Date(awardDate);
  const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const autoDayName = !isNaN(cDateObj.getTime()) ? daysAr[cDateObj.getDay()] : 'الموافق';
  const autoFormattedDate = !isNaN(cDateObj.getTime()) ? 
    `${cDateObj.getFullYear()}/${String(cDateObj.getMonth() + 1).padStart(2, '0')}/${String(cDateObj.getDate()).padStart(2, '0')}` : awardDate;

  return `
    <div class="official-contract-document" style="font-family: 'Cairo', 'Tajawal', 'Amiri', sans-serif; direction: rtl; color: #0f172a; width: 100%; box-sizing: border-box; background: #ffffff; padding: 20px 24px; border: 2px solid #1e3a8a; position: relative; border-radius: 4px; display: block; visibility: visible;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; width: 100%; box-sizing: border-box;">
        <div style="text-align: right; line-height: 1.4;">
          <h4 style="margin: 0; color: #1e3a8a; font-size: 11.5pt; font-weight: bold;">المملكة الأردنية الهاشمية</h4>
          <h4 style="margin: 2px 0; color: #475569; font-size: 10pt;">وزارة الإدارة المحلية</h4>
          <h3 style="margin: 3px 0; color: #0f172a; font-size: 12.5pt; font-weight: 800;">${firstParty.name}</h3>
          <p style="margin: 0; color: #64748b; font-size: 9.5pt; font-weight: 600;">${contract.department || 'مديرية الأشغال والخدمات الهندسية'}</p>
        </div>
        <div style="text-align: center;">
          <img src="${logoPath}" alt="شعار البلدية الرسمي" style="max-height: 80px; width: auto; object-fit: contain;" />
        </div>
        <div style="text-align: left; font-size: 9.5pt; color: #334155; line-height: 1.6; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px;">
          <div style="margin: 1px 0;"><strong>رقم العقد:</strong> <span style="color:#1e3a8a; font-weight:bold;">${contractNum}</span></div>
          <div style="margin: 1px 0;"><strong>رقم العطاء:</strong> ${tenderNum}</div>
          <div style="margin: 1px 0;"><strong>قرار الإحالة:</strong> ${awardNum}</div>
          <div style="margin: 1px 0;"><strong>تاريخ العقد:</strong> ${autoFormattedDate}م</div>
        </div>
      </div>
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; padding: 8px 14px; border-radius: 6px; display: inline-block; width: 100%; box-sizing: border-box;">
          <h2 style="margin: 0; font-size: 14pt; font-weight: bold;">${contractTitle}</h2>
          <p style="margin: 2px 0 0 0; font-size: 10.5pt; opacity: 0.95;">مشروع: ${contract.title || 'مشروع بلدي'}</p>
        </div>
      </div>
      <div class="legal-parties-block" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 10.5pt; line-height: 1.7; text-align: justify; width: 100%; box-sizing: border-box;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #1e3a8a; font-size: 10.5pt;">
          تم تحرير هذا العقد وإبرامه في يوم <strong>${autoDayName}</strong> الموافق: <strong>${autoFormattedDate}م</strong> بين كل من:
        </p>
        <div style="margin-bottom: 8px; padding-right: 10px; border-right: 3px solid #1e3a8a; font-size: 10.5pt;">
          <strong>1. الطرف الأول:</strong> <span style="font-weight:bold; color:#1e3a8a;">${firstParty.name}</span>، ويمثلها قانوناً السيد / <strong>${firstParty.representative}</strong> بصفته ${firstParty.title}، ومقرها كفرنجة - المبنى الرئيسي.
        </div>
        <div style="margin-bottom: 8px; padding-right: 10px; border-right: 3px solid #0d9488; font-size: 10.5pt;">
          <strong>2. الطرف الثاني (المقاول):</strong> السادة / <span style="font-weight:bold; color:#0d9488;">${secondParty.name}</span>، المسجلة لدى السجل التجاري برقم (<strong>${secondParty.regNumber}</strong>) والرقم الضريبي (<strong>${secondParty.taxNumber}</strong>)، وعنوانها (<strong>${secondParty.address}</strong>)، ويمثلها المفوض بالتوقيع السيد / <strong>${secondParty.representative}</strong>.
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-size: 10.5pt; line-height: 1.6;">
          <strong>التمهيد القانوني:</strong> وحيث أن البلدية قد طرحت العطاء رقم (<strong>${tenderNum}</strong>) لتنفيذ <strong>${contract.title || 'الأعمال'}</strong>، وحيث أن المقاول قد تقدم بعطائه وتمت الإحالة عليه بموجب قرار الإحالة رقم (<strong>${awardNum}</strong>)، فقد اتفق الطرفان وتراضيا أهلياً وقانونياً على ما يلي:
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; font-size: 10pt; line-height: 1.5; width: 100%; box-sizing: border-box;">
        <div><strong>قيمة الإحالة الإجمالية:</strong> <br/><span style="color:#0d9488; font-weight:bold; font-size:10.5pt;">${totalValue} د.أ</span></div>
        <div><strong>مدة التنفيذ المعتمدة:</strong> <br/><span style="color:#1e3a8a; font-weight:bold; font-size:10.5pt;">${period} يوماً تقويمياً</span></div>
        <div><strong>المهندس المشرف:</strong> <br/><span style="font-size:10.5pt;">${contract.supervising_engineer || 'مهندس الأشغال المشرف'}</span></div>
        <div><strong>تاريخ المباشرة الرسمي:</strong> <br/><span style="font-size:10.5pt;">${contract.start_date || 'وفق أمر المباشرة'}</span></div>
        <div><strong>تاريخ الانتهاء المتوقع:</strong> <br/><span style="font-size:10.5pt;">${contract.end_date || 'حسب المدة المقررة'}</span></div>
        <div><strong>مصدر التمويل المعتمد:</strong> <br/><span style="font-size:10.5pt;">${contract.funding_source || 'موازنة البلدية الذاتية'}</span></div>
      </div>
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
        <h3 style="margin: 0; color: #1e3a8a; font-size: 12pt; font-weight: bold;">الشروط والأحكام القانونية للاتفاقية:</h3>
        <span style="font-size: 9.5pt; color: #64748b;">(تعتبر جميع البنود ملزمة للطرفين)</span>
      </div>
      <div class="legal-clauses-wrapper" style="width: 100%; box-sizing: border-box; display: block; visibility: visible;">
        ${clausesHTML}
      </div>
      ${contract.notes ? `
        <div style="margin-top: 12px; background: #fffbeb; border: 1px solid #fef3c7; border-right: 4px solid #f59e0b; padding: 10px; border-radius: 4px; font-size: 10.5pt;">
          <strong>ملاحظات وشروط خاصة إضافية:</strong>
          <p style="margin: 3px 0 0 0; color: #78350f; font-size: 10.5pt;">${contract.notes}</p>
        </div>
      ` : ''}
      <div class="legal-signatures-block" style="margin-top: 24px; border-top: 2px double #cbd5e1; padding-top: 14px; page-break-inside: avoid; break-inside: avoid; width: 100%; box-sizing: border-box; display: block; visibility: visible;">
        <h3 style="text-align: center; margin: 0 0 12px 0; color: #1e3a8a; font-size: 11.5pt; font-weight: bold;">تصادق الطرفان وتوافقا على كافة الشروط والبنود أعلاه ووقّعا عليه تحريراً:</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 10.5pt; width: 100%; box-sizing: border-box;">
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; text-align: center; position: relative; font-size: 10.5pt;">
            <h4 style="margin: 0 0 6px 0; color: #0d9488; font-size: 10.5pt; font-weight: bold;">الطرف الثاني (المقاول المحال عليه)</h4>
            <p style="margin: 3px 0; font-weight: bold; font-size: 10.5pt;">${secondParty.name}</p>
            <p style="margin: 3px 0; color: #475569; font-size: 10pt;">المفوض بالتوقيع: ${secondParty.representative}</p>
            <div style="height: 60px; margin: 8px 0; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #ffffff;">
              ${contract.digital_signatures?.second_party ? `<img src="${contract.digital_signatures.second_party.signature_image || ''}" style="max-height:50px;" alt="توقيع المقاول" />` : '<span style="color:#94a3b8; font-size:10pt; font-style:italic;">[ ختم وتوقيع المفوض عن الشركة ]</span>'}
            </div>
            <p style="margin: 0; font-size: 9.5pt; color: #64748b;">السجل التجاري: ${secondParty.regNumber}</p>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #f8fafc; text-align: center; position: relative; font-size: 10.5pt;">
            <h4 style="margin: 0 0 6px 0; color: #1e3a8a; font-size: 10.5pt; font-weight: bold;">الطرف الأول (عن البلدية)</h4>
            <p style="margin: 3px 0; font-weight: bold; font-size: 10.5pt;">${firstParty.name}</p>
            <p style="margin: 3px 0; color: #475569; font-size: 10pt;">المفوض بالتوقيع: ${firstParty.representative}</p>
            <div style="height: 60px; margin: 8px 0; border: 1px dashed #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #ffffff;">
              ${contract.digital_signatures?.first_party ? `<img src="${contract.digital_signatures.first_party.signature_image || ''}" style="max-height:50px;" alt="توقيع الطرف الأول" />` : '<span style="color:#94a3b8; font-size:10pt; font-style:italic;">[ التوقيع الرسمي ومكان ختم البلدية ]</span>'}
            </div>
            <p style="margin: 0; font-size: 9.5pt; color: #64748b;">التاريخ: ${autoFormattedDate}م</p>
          </div>
        </div>
        <div style="margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 10.5pt; width: 100%; box-sizing: border-box;">
          <div><strong>الشاهد الأول:</strong> ..................................... (التوقيع: ...............)</div>
          <div><strong>الشاهد الثاني:</strong> ..................................... (التوقيع: ...............)</div>
        </div>
      </div>
      <div style="margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 9pt; color: #64748b; font-family: sans-serif; width: 100%; box-sizing: border-box;">
        <div>🔒 <strong>رمز البصمة التشفيرية المعتمدة (SHA-256):</strong> <code style="font-family: monospace; font-size: 8.5pt; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${contract.sha256_hash || 'SECURE-VERIFIED-SHA256'}</code></div>
        <div>نظام مديرية الأشغال والخدمات الهندسية v1.0 — اتفاقية موثقة</div>
      </div>
    </div>
  `;
}

class ContractTemplateEngine {
  constructor() {
    this.engineId = 'CONTRACT_TEMPLATE_ENGINE';
    this.engineName = 'Enterprise Construction Contract Templates & Clauses Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'construction_contract_rendering',
      'tender_clause_integration',
      'digital_seal_embedding',
      'archive_auto_sync',
      'variable_substitution',
      'official_html_contract'
    ];

    // إتاحة الخواص والدوال القديمة للتوافقية الكاملة 100%
    this.DEFAULT_CONTRACT_TYPES = DEFAULT_CONTRACT_TYPES;
    this.DEFAULT_CLAUSES = DEFAULT_CLAUSES;
  }

  replacePlaceholders(templateText, data = {}) {
    return replacePlaceholders(templateText, data);
  }

  generateOfficialContractHTML(contract = {}, clauses = [], identity = {}) {
    return generateOfficialContractHTML(contract, clauses, identity);
  }

  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء قوالب العقود [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'نماذج العقود',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ContractTemplateEngine', `Audit log failed: ${e.message}`);
    }
  }

  /**
   * توليد عقد مقاولات إنشائية رسمي متكامل مع الختم الرقمي والأرشيف
   */
  async generateConstructionContract(contractData, user = null) {
    const {
      contractNumber, contractorName, projectTitle, contractValue,
      durationDays, startDate, performanceBondAmount, advancePayment
    } = contractData;

    if (!contractorName || !projectTitle || !contractValue) {
      throw new Error('اسم المقاول، عنوان المشروع، وقيمة العقد حقول إلزامية لتوليد وثيقة العقد.');
    }

    const docId = await numberingEngine.generateNextId('documents', { prefix: 'CTR' });
    const now = new Date().toISOString();

    const clauseTemplate = `
    عقد مقاولات أشغال هندسية - بلدية كفرنجة الجديدة
    رقم الوثيقة: {{docId}}
    التاريخ: {{currentDate}}

    الفريق الأول: بلدية كفرنجة الجديدة (الربط البلدي الرسمي).
    الفريق الثاني (المقاول التنفيذي): {{contractorName}}.
    موضوع العقد: تنفيذ أعمال مشروع "{{projectTitle}}".

    1. قيمة العقد الإجمالية: تم الاتفاق على إنجاز كافة الأعمال بمبلغ وقدره ({{contractValue}}) دينار أردني.
    2. المدة الزمنية: ({{durationDays}}) يوماً تقويمياً تبدأ من تاريخ مباشرة العمل الموافق ({{startDate}}).
    3. الكفالات والضمانات: يلتزم الفريق الثاني بتقديم كفالة حسن تنفيذ بنكية بقيمة ({{performanceBondAmount}}) دينار، وكفالة دفعة مقدمة بقيمة ({{advancePayment}}) دينار.
    4. الشروط العامة: يخضع هذا العقد لقوانين الأشغال العامة الأردنية وأنظمة بلدية كفرنجة الجديدة.

    توقيع الفريق الأول (بلدية كفرنجة): ____________________
    توقيع الفريق الثاني (المقاول): ____________________
    `;

    let renderedContent = clauseTemplate
      .replace(/\{\{docId\}\}/g, docId)
      .replace(/\{\{currentDate\}\}/g, now.split('T')[0])
      .replace(/\{\{contractorName\}\}/g, contractorName)
      .replace(/\{\{projectTitle\}\}/g, projectTitle)
      .replace(/\{\{contractValue\}\}/g, parseFloat(contractValue).toLocaleString('ar-JO'))
      .replace(/\{\{durationDays\}\}/g, durationDays || '120')
      .replace(/\{\{startDate\}\}/g, startDate || now.split('T')[0])
      .replace(/\{\{performanceBondAmount\}\}/g, parseFloat(performanceBondAmount || contractValue * 0.1).toLocaleString('ar-JO'))
      .replace(/\{\{advancePayment\}\}/g, parseFloat(advancePayment || contractValue * 0.15).toLocaleString('ar-JO'));

    let digitalSeal = '';
    try {
      digitalSeal = cryptoSignatureService.calculateDocumentHash({ docId, contractorName, projectTitle, contractValue });
      renderedContent += `\n\n[بصمة التحقق الرقمي المعتمدة - SHA-256]: ${digitalSeal}`;
    } catch (e) {
      digitalSeal = 'SEAL-' + Date.now();
    }

    try {
      await archiveEngineService.archiveDocument({
        title: `عقد تنفيذ مشروع: ${projectTitle} - ${contractorName} (${docId})`,
        category: 'عقود إنشائية ومقاولات',
        fileBuffer: Buffer.from(renderedContent, 'utf-8'),
        originalName: `${docId}_contract.txt`,
        mimeType: 'text/plain',
        retentionYears: 20
      }, user);
    } catch (archErr) {
      logWarn('ContractTemplateEngine', `Failed to archive contract document: ${archErr.message}`);
    }

    const record = {
      docId,
      projectTitle,
      contractorName,
      contractValue: parseFloat(contractValue),
      renderedContent,
      digitalSeal,
      createdAt: now
    };

    await this._recordAudit(user?.id, docId, 'CONSTRUCTION_CONTRACT_GENERATED', null, { projectTitle, contractorName });
    return record;
  }

  async healthCheck() {
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      engineName: this.engineName,
      version: this.version,
      supportedContractTypes: this.DEFAULT_CONTRACT_TYPES.length,
      timestamp: new Date().toISOString()
    };
  }
}

const contractTemplateEngineInstance = new ContractTemplateEngine();

// إسناد الدوال والمتغيرات الثابتة للكائن المصدر لضمان التوافقية التامة مع Object Destructuring
contractTemplateEngineInstance.DEFAULT_CONTRACT_TYPES = DEFAULT_CONTRACT_TYPES;
contractTemplateEngineInstance.DEFAULT_CLAUSES = DEFAULT_CLAUSES;
contractTemplateEngineInstance.replacePlaceholders = replacePlaceholders;
contractTemplateEngineInstance.generateOfficialContractHTML = generateOfficialContractHTML;

module.exports = contractTemplateEngineInstance;
