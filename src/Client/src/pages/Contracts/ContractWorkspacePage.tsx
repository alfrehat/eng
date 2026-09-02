import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Layers, Clock, 
  Users, Award, Shield, FileText, Plus, 
  RefreshCw, ChevronRight, Lock, CheckCircle2,
  AlertTriangle, DollarSign
} from 'lucide-react';

interface ContractDetails {
  id: string;
  contractNumber: string;
  title: string;
  description: string;
  projectId: string;
  project: {
    id: string;
    projectNumber: string;
    name: string;
    estimatedCost: number;
    contractValue: number;
  };
  tenderId: string;
  tender: {
    id: string;
    tenderNumber: string;
    title: string;
    estimatedValue: number;
  };
  awardDecision: {
    id: string;
    councilDecisionNumber: string;
    decisionDate: string;
    decisionStatus: string;
    finalAwardedAmount: number;
  } | null;
  contractor: {
    id: string;
    name: string;
    registrationNumber: string;
    phone: string;
    contactPerson: string;
  } | null;
  contractTypeCode: string;
  contractStatus: number;
  statusName: string;
  contractDate: string;
  startDate: string;
  originalCompletionDate: string;
  currentCompletionDate: string;
  originalValue: number;
  taxAmount: number;
  totalValue: number;
  currentContractValue: number;
  currency: string;
  boqs: Array<{
    id: string;
    title: string;
    originalSubTotal: number;
    currentSubTotal: number;
    taxRatePercent: number;
    taxAmount: number;
    grandTotal: number;
    items: Array<{
      id: string;
      itemCode: string;
      description: string;
      unit: string;
      originalQuantity: number;
      originalUnitPrice: number;
      originalAmount: number;
      currentQuantity: number;
      currentUnitPrice: number;
      currentAmount: number;
    }>;
  }>;
  guarantees: Array<{
    id: string;
    guaranteeType: string;
    referenceNumber: string;
    bankName: string;
    amount: number;
    currency: string;
    issueDate: string;
    expiryDate: string;
    status: string;
  }>;
  extensions: Array<{
    id: string;
    extensionNumber: string;
    previousCompletionDate: string;
    approvedCompletionDate: string;
    extensionDays: number;
    reason: string;
    status: string;
    approvalDate: string | null;
  }>;
  variations: Array<{
    id: string;
    variationNumber: string;
    reason: string;
    variationType: string;
    variationAmount: number;
    status: string;
    approvalDate: string | null;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    milestoneType: string;
    plannedDate: string;
    percentage: number;
    status: string;
  }>;
  signatures: Array<{
    id: string;
    signerName: string;
    signerRole: string;
    signatureDate: string;
    signatureStatus: string;
    hashAlgorithm: string;
    documentHash: string;
  }>;
}

export const ContractWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'parties' | 'tender' | 'boq' | 'financial' | 'guarantees' | 
    'documents' | 'extensions' | 'amendments' | 'variations' | 'milestones' | 
    'notices' | 'signatures' | 'workflow' | 'audit'
  >('overview');

  // Guarantee Form Modal
  const [showGuaranteeModal, setShowGuaranteeModal] = useState(false);
  const [guaranteeType, setGuaranteeType] = useState('PERFORMANCE_BOND');
  const [guaranteeRef, setGuaranteeRef] = useState('');
  const [bankName, setBankName] = useState('بنك الإسكان للتجارة والتمويل');
  const [guaranteeAmount, setGuaranteeAmount] = useState(0);

  // Extension Form Modal
  const [showExtModal, setShowExtModal] = useState(false);
  const [extDays, setExtDays] = useState(15);
  const [extReason, setExtReason] = useState('');

  // Variation Form Modal
  const [showVarModal, setShowVarModal] = useState(false);
  const [varReason, setVarReason] = useState('');
  const [varAmount, setVarAmount] = useState(0);

  useEffect(() => {
    if (id) fetchContractDetails();
  }, [id]);

  const fetchContractDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const json = await res.json();
        setContract(json.data);
      }
    } catch (err) {
      console.error('Failed to load contract details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuarantee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}/contractguarantees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guaranteeType,
          referenceNumber: guaranteeRef,
          bankName,
          amount: Number(guaranteeAmount),
          currency: 'JOD'
        })
      });
      if (res.ok) {
        setShowGuaranteeModal(false);
        await fetchContractDetails();
      }
    } catch (err) {
      console.error('Failed to add guarantee', err);
    }
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}/contractextensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionDays: Number(extDays),
          reason: extReason
        })
      });
      if (res.ok) {
        setShowExtModal(false);
        setExtReason('');
        await fetchContractDetails();
      }
    } catch (err) {
      console.error('Failed to request extension', err);
    }
  };

  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}/contractvariations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: varReason,
          variationAmount: Number(varAmount),
          variationType: 'ADDITIONAL_WORKS'
        })
      });
      if (res.ok) {
        setShowVarModal(false);
        setVarReason('');
        await fetchContractDetails();
      }
    } catch (err) {
      console.error('Failed to create variation order', err);
    }
  };

  const handleTransitionStatus = async (newStatus: number) => {
    if (!contract) return;
    try {
      const res = await fetch(`/api/contracts/${contract.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus })
      });
      if (res.ok) {
        await fetchContractDetails();
      }
    } catch (err) {
      console.error('Failed to change contract status', err);
    }
  };

  if (loading || !contract) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">جاري تحميل مساحة عمل العقد...</p>
      </div>
    );
  }

  const primaryBoq = contract.boqs?.[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/contracts" className="hover:text-blue-600 transition-colors">سجل العقود</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{contract.contractNumber}</span>
      </div>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-mono font-semibold text-xs border border-blue-500/30">
                {contract.contractNumber}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30 font-semibold">
                الحالة: {contract.statusName}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 text-xs border border-slate-500/30">
                {contract.contractTypeCode}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{contract.title}</h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              المقاول المنفذ: <strong className="text-white">{contract.contractor?.name || 'غير مسند'}</strong> | المشروع: <strong className="text-white">{contract.project.projectNumber}</strong>
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-6 min-w-[280px]">
            <div>
              <p className="text-xs text-blue-200">القيمة التعاقدية الحالية</p>
              <p className="text-2xl font-bold font-mono text-white mt-0.5">
                {contract.currentContractValue?.toLocaleString()} {contract.currency}
              </p>
              <p className="text-[11px] text-slate-300 mt-1">
                القيمة الأصلية: {contract.originalValue?.toLocaleString()} {contract.currency}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 15 Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
        <div className="flex border-b border-slate-200 dark:border-slate-700 p-1 min-w-max text-xs font-semibold">
          {[
            { id: 'overview', label: 'البيانات الأساسية', icon: FileText },
            { id: 'parties', label: 'أطراف العقد', icon: Users },
            { id: 'tender', label: 'العطاء والإحالة', icon: Award },
            { id: 'boq', label: `جدول الكميات (${primaryBoq?.items?.length || 0})`, icon: Layers },
            { id: 'financial', label: 'القيم المالية', icon: DollarSign },
            { id: 'guarantees', label: `الضمانات (${contract.guarantees?.length || 0})`, icon: Shield },
            { id: 'extensions', label: `المدد والتمديدات (${contract.extensions?.length || 0})`, icon: Clock },
            { id: 'variations', label: `الأوامر التغييرية (${contract.variations?.length || 0})`, icon: AlertTriangle },
            { id: 'milestones', label: `المراحل (${contract.milestones?.length || 0})`, icon: CheckCircle2 },
            { id: 'signatures', label: 'التوقيع الإلكتروني', icon: Lock },
            { id: 'workflow', label: 'سير العمل', icon: RefreshCw },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">المعلومات التعاقدية والتسلسل الزمني</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ العقد</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {new Date(contract.contractDate).toLocaleDateString('ar-JO')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ المباشرة</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {contract.startDate ? new Date(contract.startDate).toLocaleDateString('ar-JO') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ الإنجاز الأصلي (ثابت)</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {new Date(contract.originalCompletionDate).toLocaleDateString('ar-JO')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">تاريخ الإنجاز الحالي (المعدل)</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mt-1">
                    {new Date(contract.currentCompletionDate).toLocaleDateString('ar-JO')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي التمديدات المعتمدة</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {contract.extensions.filter(e => e.status === 'APPROVED').reduce((acc, cur) => acc + cur.extensionDays, 0)} يوماً
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">عدد الأوامر التغييرية</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {contract.variations.length} أمر تغييري
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">التحكم المالي (Financial Immutability)</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">القيمة الأصلية (Original Value)</p>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {contract.originalValue?.toLocaleString()} د.أ
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">ضريبة المبيعات</p>
                  <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {contract.taxAmount?.toLocaleString()} د.أ
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold">القيمة التعاقدية الحالية المعدلة</p>
                  <p className="text-xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
                    {contract.currentContractValue?.toLocaleString()} د.أ
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">المقاول المعتمد</h2>
              {contract.contractor ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">{contract.contractor.name}</p>
                  <p className="text-xs text-slate-500 font-mono">سجل تجاري: {contract.contractor.registrationNumber}</p>
                  <p className="text-xs text-slate-500">هاتف: {contract.contractor.phone || '-'}</p>
                  <p className="text-xs text-slate-500">الشخص المسؤول: {contract.contractor.contactPerson || '-'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">لم يتم ربط مقاول بالعقد بعد.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Contract BOQ */}
      {activeTab === 'boq' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">جدول كميات العقد (لقطة معتمدة ومضبوطة)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                الكميات والأسعار الأصلية محفوظة وتُحدّث الكميات الحالية فقط عبر الأوامر التغييرية.
              </p>
            </div>
          </div>

          {primaryBoq && primaryBoq.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2.5">الرمز</th>
                    <th className="px-3 py-2.5">الوصف</th>
                    <th className="px-3 py-2.5">الوحدة</th>
                    <th className="px-3 py-2.5">الكمية الأصلية</th>
                    <th className="px-3 py-2.5">الكمية الحالية</th>
                    <th className="px-3 py-2.5">سعر الوحدة</th>
                    <th className="px-3 py-2.5">الإجمالي الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-xs">
                  {primaryBoq.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-3 py-3 font-semibold text-blue-600">{item.itemCode}</td>
                      <td className="px-3 py-3 font-sans text-slate-900 dark:text-white font-medium">{item.description}</td>
                      <td className="px-3 py-3">{item.unit}</td>
                      <td className="px-3 py-3 text-slate-400">{item.originalQuantity.toLocaleString()}</td>
                      <td className="px-3 py-3 font-bold text-blue-700 dark:text-blue-300">{item.currentQuantity.toLocaleString()}</td>
                      <td className="px-3 py-3">{item.currentUnitPrice.toLocaleString()} د.أ</td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{item.currentAmount.toLocaleString()} د.أ</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 text-sm font-semibold">
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-slate-600 dark:text-slate-300">المجموع الحالي (SubTotal):</td>
                    <td className="px-4 py-2.5 font-mono text-slate-900 dark:text-white">{primaryBoq.currentSubTotal.toLocaleString()} د.أ</td>
                  </tr>
                  <tr className="text-base text-blue-700 dark:text-blue-400">
                    <td colSpan={6} className="px-4 py-3 font-bold">المجموع الإجمالي مع الضريبة:</td>
                    <td className="px-4 py-3 font-mono font-bold">{primaryBoq.grandTotal.toLocaleString()} د.أ</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد بنود كميات مرتبطة بالعقد.</p>
          )}
        </div>
      )}

      {/* Tab 6: Guarantees */}
      {activeTab === 'guarantees' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">كفالات وضمانات العقد الرسمية</h2>
            <button
              onClick={() => setShowGuaranteeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة كفالة جديدة</span>
            </button>
          </div>

          {contract.guarantees && contract.guarantees.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {contract.guarantees.map((g) => (
                <div key={g.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{g.guaranteeType}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold font-mono">
                        {g.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-1">رقم الكفالة: {g.referenceNumber} | المصرف: {g.bankName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">تاريخ الانتهاء: {new Date(g.expiryDate).toLocaleDateString('ar-JO')}</p>
                  </div>
                  <div className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                    {g.amount.toLocaleString()} {g.currency}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد كفالات مسجلة على هذا العقد.</p>
          )}

          {/* Guarantee Modal */}
          {showGuaranteeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">إضافة كفالة عقدية</h3>
                <form onSubmit={handleAddGuarantee} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نوع الكفالة</label>
                    <select
                      value={guaranteeType}
                      onChange={(e) => setGuaranteeType(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PERFORMANCE_BOND">كفالة حسن تنفيذ (10%)</option>
                      <option value="ADVANCE_PAYMENT">كفالة دفعة مقدمة</option>
                      <option value="RETENTION">كفالة صيانة ومحجوزات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم الكفالة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: BG-2026-99"
                      value={guaranteeRef}
                      onChange={(e) => setGuaranteeRef(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المصرف المصدر *</label>
                    <input
                      type="text"
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">مبلغ الكفالة (د.أ) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={guaranteeAmount}
                      onChange={(e) => setGuaranteeAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowGuaranteeModal(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                    >
                      حفظ الكفالة
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Extensions */}
      {activeTab === 'extensions' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">سجل التمديدات الزمنية للعقد</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تاريخ الإنجاز الأصلي: {new Date(contract.originalCompletionDate).toLocaleDateString('ar-JO')} (محمي وثابت)
              </p>
            </div>
            <button
              onClick={() => setShowExtModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>طلب تمديد مدة</span>
            </button>
          </div>

          {contract.extensions && contract.extensions.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {contract.extensions.map((ext) => (
                <div key={ext.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600">{ext.extensionNumber}</span>
                      <span className="font-bold text-slate-900 dark:text-white">+{ext.extensionDays} يوماً إضافياً</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold font-mono ${ext.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {ext.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">السبب: {ext.reason}</p>
                    <p className="text-xs text-slate-400 mt-0.5">تاريخ الإنجاز المعتمد الجديد: {new Date(ext.approvedCompletionDate).toLocaleDateString('ar-JO')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد طلبات تمديد مسجلة على هذا العقد.</p>
          )}

          {showExtModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">طلب تمديد مدة العقد</h3>
                <form onSubmit={handleRequestExtension} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">عدد أيام التمديد *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={extDays}
                      onChange={(e) => setExtDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">أسباب ومبررات التمديد *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="مثال: تأخر بسبب الأحوال الجوية الطارئة..."
                      value={extReason}
                      onChange={(e) => setExtReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowExtModal(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                    >
                      تقديم الطلب
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 10: Variations */}
      {activeTab === 'variations' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">الأوامر التغييرية (Variation Orders)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                القيمة الأصلية للعقد: {contract.originalValue?.toLocaleString()} د.أ (محمية ومحفوظة)
              </p>
            </div>
            <button
              onClick={() => setShowVarModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار أمر تغييري</span>
            </button>
          </div>

          {contract.variations && contract.variations.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {contract.variations.map((v) => (
                <div key={v.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600">{v.variationNumber}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{v.reason}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold font-mono ${v.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {v.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">النوع: {v.variationType}</p>
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    +{v.variationAmount.toLocaleString()} د.أ
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد أوامر تغييرية مسجلة على هذا العقد.</p>
          )}

          {showVarModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">إصدار أمر تغييري جديد</h3>
                <form onSubmit={handleCreateVariation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">موضوع وسبب الأمر التغييري *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: تمديد عبّارات مياه إضافية..."
                      value={varReason}
                      onChange={(e) => setVarReason(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">قيمة الأمر التغييري (د.أ) *</label>
                    <input
                      type="number"
                      required
                      value={varAmount}
                      onChange={(e) => setVarAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowVarModal(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                    >
                      إصدار الأمر
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 13: Signatures */}
      {activeTab === 'signatures' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">التوقيعات الإلكترونية وبصمة الوثيقة المشفرة (SHA-256)</h2>
          {contract.signatures && contract.signatures.length > 0 ? (
            <div className="space-y-3">
              {contract.signatures.map((sig) => (
                <div key={sig.id} className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{sig.signerName} ({sig.signerRole})</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold font-mono">
                      {sig.signatureStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">تاريخ التوقيع: {new Date(sig.signatureDate).toLocaleString('ar-JO')}</p>
                  <div className="p-2 rounded bg-slate-100 dark:bg-slate-900 text-[11px] font-mono break-all text-slate-600 dark:text-slate-300">
                    بصمة الوثيقة (SHA-256): {sig.documentHash}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لم يتم توقيع العقد إلكترونياً بعد.</p>
          )}
        </div>
      )}

      {/* Tab 14: Workflow */}
      {activeTab === 'workflow' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">دورة حياة وسير عمل العقد (Workflow Engine)</h2>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { status: 0, label: 'مسودة' },
              { status: 1, label: 'قيد التدقيق' },
              { status: 2, label: 'معتمد للتوقيع' },
              { status: 4, label: 'موقع رسمياً' },
              { status: 5, label: 'ساري المفعول' },
              { status: 10, label: 'مكتمل' },
              { status: 11, label: 'مغلق نهائياً' }
            ].map((step) => {
              const isCurrent = contract.contractStatus === step.status;
              const isPast = contract.contractStatus > step.status;
              return (
                <button
                  key={step.status}
                  onClick={() => handleTransitionStatus(step.status)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                      : isPast
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
