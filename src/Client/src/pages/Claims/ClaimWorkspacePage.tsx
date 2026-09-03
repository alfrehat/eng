import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, 
  DollarSign, Calculator, Percent, Layers, Award, ShieldCheck, 
  Send, FileCheck, Share2, History, AlertCircle
} from 'lucide-react';

export const ClaimWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Add Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    contractItemId: '',
    previousQuantity: 0,
    currentQuantity: 0,
    unitPrice: 0
  });

  // Certificate Modal
  const [showCertModal, setShowCertModal] = useState(false);
  const [certSigner, setCertSigner] = useState('رئيس قسم المشاريع ومديرية الأشغال الهندسية');

  // Payment Link Modal
  const [showPayLinkModal, setShowPayLinkModal] = useState(false);
  const [payLink, setPayLink] = useState({
    reference: 'REF-FIN-2026-0001',
    amount: 0,
    notes: 'تحويل المستخلص إلى الدائرة المالية لإصدار الشيك'
  });

  const fetchClaimDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/claims/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClaim(data.data);
      }
    } catch (e) {
      console.error('Failed to load claim details', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchClaimDetails();
  }, [id]);

  const handleRecalculate = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/claims/${id}/calculate?retentionRate=5&advanceRecoveryRate=10`, {
        method: 'POST'
      });
      if (res.ok) {
        setStatusMsg('تمت إعادة الحسابات وتحديث الخصومات والاحتجاز بنجاح');
        await fetchClaimDetails();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/claims/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        setShowItemModal(false);
        setStatusMsg('تمت إضافة البند للمستخلص بنجاح');
        await fetchClaimDetails();
      } else {
        const err = await res.json();
        alert(err.message || 'فشلت إضافة البند');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/claims/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus })
      });
      if (res.ok) {
        setStatusMsg(`تم الانتقال إلى حالة: ${targetStatus}`);
        await fetchClaimDetails();
      } else {
        const err = await res.json();
        alert(err.message || 'فشل تحديث الحالة');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/claims/${id}/certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certifiedBy: certSigner })
      });
      if (res.ok) {
        setShowCertModal(false);
        setStatusMsg('تم اعتماد وإصدار شهادة الدفع الرسمية للمستخلص');
        await fetchClaimDetails();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/claims/${id}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payLink)
      });
      if (res.ok) {
        setShowPayLinkModal(false);
        setStatusMsg('تمت إحالة المستخلص إلى الموازنة والبرنامج المالي بنجاح (دون الصرف التلقائي)');
        await fetchClaimDetails();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !claim) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium" dir="rtl">
        جاري تحميل مساحة عمل المستخلص والمطالبات المالية...
      </div>
    );
  }

  const tabs = [
    { id: 1, title: 'البيانات الأساسية', icon: FileText },
    { id: 2, title: 'بنود المستخلص', icon: Layers },
    { id: 3, title: 'القياسات الميدانية', icon: Calculator },
    { id: 4, title: 'الإنجاز الفعلي', icon: Percent },
    { id: 5, title: 'الحسابات المالية', icon: DollarSign },
    { id: 6, title: 'الخصومات', icon: AlertTriangle },
    { id: 7, title: 'محجوز الضمان', icon: ShieldCheck },
    { id: 8, title: 'استرداد السلفة', icon: Award },
    { id: 9, title: 'الوثائق والمرفقات', icon: FileCheck },
    { id: 10, title: 'شهادة الدفع', icon: CheckCircle2 },
    { id: 11, title: 'الربط المالي', icon: Share2 },
    { id: 12, title: 'سير العمل', icon: Send },
    { id: 13, title: 'السجل التاريخي', icon: History }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Top Breadcrumb & Status Alert */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/claims')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لسجل المستخلصات
        </button>

        {statusMsg && (
          <div className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold animate-pulse">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Main Claim Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              {claim.claimNumber}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
              {claim.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            مستخلص أعمال العقد: {claim.contract?.contractNumber} — {claim.contract?.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            المشروع: {claim.contract?.project?.name} | المقاول: {claim.contract?.contractorParty?.companyName || 'المقاول الرئيسي'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRecalculate}
            disabled={actionLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-xl transition"
          >
            إعادة احتساب المستخلص
          </button>

          {claim.status === 'Draft' && (
            <button
              onClick={() => handleStatusTransition('Submitted')}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
            >
              رفع المستخلص للتدقيق
            </button>
          )}

          {claim.status === 'Submitted' && (
            <button
              onClick={() => handleStatusTransition('TechnicalReview')}
              disabled={actionLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition"
            >
              بدء التدقيق الفني
            </button>
          )}

          {claim.status === 'TechnicalReview' && (
            <button
              onClick={() => handleStatusTransition('FinancialReview')}
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
            >
              بدء التدقيق المالي
            </button>
          )}

          {claim.status === 'FinancialReview' && (
            <button
              onClick={() => setShowCertModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
            >
              إصدار واعتماد شهادة الدفع
            </button>
          )}

          {claim.status === 'Certified' && (
            <button
              onClick={() => setShowPayLinkModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
            >
              إحالة المستخلص إلى الموازنة والصرف
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-semibold mb-1">قيمة الأعمال المنجزة (Gross)</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {claim.grossAmount?.toLocaleString('en-US', { minimumFractionDigits: 3 })} <span className="text-xs font-normal">د.أ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-semibold mb-1">إجمالي الخصومات والاحتجاز</div>
          <div className="text-xl font-bold text-rose-600">
            {claim.deductionAmount?.toLocaleString('en-US', { minimumFractionDigits: 3 })} <span className="text-xs font-normal">د.أ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-semibold mb-1">الصافي المستحق (Net)</div>
          <div className="text-xl font-bold text-emerald-600">
            {claim.netAmount?.toLocaleString('en-US', { minimumFractionDigits: 3 })} <span className="text-xs font-normal">د.أ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-semibold mb-1">سقف العقد الحالي المعتمد</div>
          <div className="text-xl font-bold text-indigo-600">
            {claim.contract?.currentContractValue?.toLocaleString('en-US', { minimumFractionDigits: 3 })} <span className="text-xs font-normal">د.أ</span>
          </div>
        </div>
      </div>

      {/* 13-Tab Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 overflow-x-auto flex items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.title}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        {activeTab === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">البيانات الأساسية وتفاصيل الفترة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">رقم العقد:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{claim.contract?.contractNumber}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">نوع المستخلص:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{claim.claimTypeCode}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">فترة المستخلص:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  من {new Date(claim.claimPeriodFrom).toLocaleDateString('ar-JO')} إلى {new Date(claim.claimPeriodTo).toLocaleDateString('ar-JO')}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">تاريخ التقديم الرسمي:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {claim.submissionDate ? new Date(claim.submissionDate).toLocaleDateString('ar-JO') : 'لم يرفع بعد'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">القيمة التعاقدية الأصلية:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{claim.contract?.originalValue?.toLocaleString()} د.أ (محفوظة وثابتة)</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-xs text-slate-500 block">المطالبات التراكمية السابقة:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{claim.previousCertifiedAmount?.toLocaleString()} د.أ</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">بنود المستخلص والكميات المنفذة</h3>
              <button
                onClick={() => setShowItemModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                + إضافة بند مستخلص
              </button>
            </div>

            {claim.items?.length === 0 ? (
              <div className="p-8 text-center text-slate-500">لا توجد بنود مضافة لهذا المستخلص بعد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">رمز ووصف البند</th>
                      <th className="p-3">الوحدة</th>
                      <th className="p-3">سعر الوحدة</th>
                      <th className="p-3">الكمية السابقة</th>
                      <th className="p-3">الكمية الحالية</th>
                      <th className="p-3">الكمية التراكمية</th>
                      <th className="p-3">القيمة الحالية (د.أ)</th>
                      <th className="p-3">القيمة التراكمية (د.أ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {claim.items?.map((it: any, idx: number) => (
                      <tr key={it.id}>
                        <td className="p-3">{idx + 1}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white">
                          <div>{it.contractItem?.itemCode}</div>
                          <div className="text-slate-500 text-[11px]">{it.contractItem?.description}</div>
                        </td>
                        <td className="p-3">{it.unit}</td>
                        <td className="p-3">{it.unitPrice}</td>
                        <td className="p-3">{it.previousQuantity}</td>
                        <td className="p-3 font-bold text-blue-600">{it.currentQuantity}</td>
                        <td className="p-3 font-semibold">{it.cumulativeQuantity}</td>
                        <td className="p-3 font-bold text-emerald-600">{it.currentAmount?.toLocaleString()}</td>
                        <td className="p-3 font-semibold">{it.cumulativeAmount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">سجلات القياس الميداني (Measurement Records)</h3>
            {claim.measurements?.length === 0 ? (
              <div className="p-8 text-center text-slate-500">لا توجد قياسات ميدانية مسجلة لهذا المستخلص بعد.</div>
            ) : (
              <div className="space-y-3">
                {claim.measurements?.map((m: any) => (
                  <div key={m.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-emerald-600">{m.measurementNumber}</span>
                      <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">{m.status}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      الموقع: {m.location} | المهندس: {m.engineer} | التاريخ: {new Date(m.measurementDate).toLocaleDateString('ar-JO')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 5 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">الحسابات والتفقيط المالي الرسمي</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
              <div className="flex justify-between text-sm py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-300">إجمالي الأعمال المنجزة المعتمدة (Gross):</span>
                <span className="font-bold text-slate-900 dark:text-white">{claim.grossAmount?.toLocaleString()} د.أ</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-rose-600">اقتطاع محجوز الضمان (Retention - 5%):</span>
                <span className="font-bold text-rose-600">{(claim.grossAmount * 0.05).toLocaleString()} د.أ</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-rose-600">استرداد سلفة الدفعة المقدمة (Advance Recovery - 10%):</span>
                <span className="font-bold text-rose-600">{(claim.grossAmount * 0.10).toLocaleString()} د.أ</span>
              </div>
              <div className="flex justify-between text-base font-bold py-2 text-emerald-600">
                <span>الصافي المعتمد المستحق للصرف (Net Certified):</span>
                <span>{claim.netAmount?.toLocaleString()} د.أ</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 10 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">شهادة الدفع المعتمدة (Payment Certificate)</h3>
            {claim.certificates?.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-3">
                <Clock className="w-10 h-10 text-slate-400 mx-auto" />
                <p>لم تصدر شهادة دفع رسمية بعد. يجب إكمال التدقيق المالي لإصدار الشهادة.</p>
              </div>
            ) : (
              <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-500/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    {claim.certificates[0].certificateNumber}
                  </div>
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold">
                    معتمدة رسمياً
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>المعتمد: <span className="font-bold">{claim.certificates[0].certifiedBy}</span></div>
                  <div>التاريخ: <span className="font-bold">{new Date(claim.certificates[0].certificateDate).toLocaleDateString('ar-JO')}</span></div>
                  <div>الصافي المعتمد: <span className="font-bold text-emerald-600">{claim.certificates[0].netCertified?.toLocaleString()} د.أ</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 11 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">الربط بالبرنامج المالي وإحالة الصرف (Payment Link)</h3>
            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> مبدأ الفصل المالي الصارم (Payment Separation):</div>
              <p>إحالة المستخلص إلى الموازنة والبرنامج المالي تسجل كـ "محال للصرف" فقط. لا يتم اعتبار المستخلص مدفوعاً أو مسدداً تلقائياً.</p>
            </div>

            {claim.paymentLinks?.length === 0 ? (
              <div className="p-8 text-center text-slate-500">لا توجد إحالات مالية مسجلة بعد.</div>
            ) : (
              <div className="space-y-3">
                {claim.paymentLinks?.map((pl: any) => (
                  <div key={pl.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-amber-600">{pl.reference}</span>
                      <div className="text-xs text-slate-500 mt-0.5">القيمة المحالة: {pl.amount?.toLocaleString()} د.أ</div>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                      {pl.paymentStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fallback for other tabs */}
        {[4, 6, 7, 8, 9, 12, 13].includes(activeTab) && (
          <div className="p-12 text-center text-slate-500">
            بيانات تبويب {tabs.find(t => t.id === activeTab)?.title} مسجلة ونشطة في المحرك المؤسسي.
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">إضافة كمية منجزة لبند العقد</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">اختر البند من جدول كميات العقد *</label>
                <select
                  value={newItem.contractItemId}
                  onChange={(e) => setNewItem({ ...newItem, contractItemId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  required
                >
                  <option value="">-- اختر البند --</option>
                  {claim.contract?.boq?.items?.map((bi: any) => (
                    <option key={bi.id} value={bi.id}>{bi.itemCode} - {bi.description} (الكمية العقدية: {bi.currentQuantity})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">الكمية المنفذة الحالية *</label>
                <input
                  type="number"
                  step="0.001"
                  value={newItem.currentQuantity}
                  onChange={(e) => setNewItem({ ...newItem, currentQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">سعر الوحدة (د.أ)</label>
                <input
                  type="number"
                  step="0.001"
                  value={newItem.unitPrice}
                  onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="اتركه فارغاً لاستخدام السعر التعاقدي"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                  حفظ البند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Certificate Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">اعتماد وإصدار شهادة الدفع الرسمية</h2>
            <form onSubmit={handleIssueCertificate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">اسم المعتمد / الجهة المشرفة</label>
                <input
                  type="text"
                  value={certSigner}
                  onChange={(e) => setCertSigner(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  required
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg">
                سيتم تجميد وتثبيت القيم المالية المصادق عليها في شهادة الدفع وإعطاؤها رقماً رسمياً متسلسلاً عبر محرك الترقيم.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                  تأكيد الاعتماد والإصدار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Link Modal */}
      {showPayLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">إحالة المستخلص إلى الموازنة والبرنامج المالي</h2>
            <form onSubmit={handleCreatePaymentLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">الرقم المرجعي للإحالة المالية</label>
                <input
                  type="text"
                  value={payLink.reference}
                  onChange={(e) => setPayLink({ ...payLink, reference: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات الإحالة المالية</label>
                <textarea
                  rows={2}
                  value={payLink.notes}
                  onChange={(e) => setPayLink({ ...payLink, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayLinkModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold"
                >
                  إحالة للصرف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClaimWorkspacePage;
