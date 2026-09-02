import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  FileText, Building2, Layers, Clock, 
  Users, Award, Shield, FileCheck,
  Plus, RefreshCw, ChevronRight, Lock
} from 'lucide-react';

interface TenderDetails {
  id: string;
  tenderNumber: string;
  title: string;
  description: string;
  projectId: string;
  project: {
    id: string;
    projectNumber: string;
    name: string;
    status: number;
    estimatedCost: number;
    contractValue: number;
  };
  tenderTypeCode: string;
  tenderMethodCode: string;
  categoryCode: string;
  status: number;
  statusName: string;
  estimatedValue: number;
  currency: string;
  publicationDate: string | null;
  closingDate: string | null;
  openingDate: string | null;
  responsibleEngineer: string | null;
  organizationName: string | null;
  boqs: Array<{
    id: string;
    title: string;
    subTotal: number;
    taxRatePercent: number;
    taxAmount: number;
    grandTotal: number;
    items: Array<{
      id: string;
      itemNumber: number;
      description: string;
      unit: string;
      quantity: number;
      estimatedUnitPrice: number;
      estimatedTotal: number;
    }>;
  }>;
  bids: Array<{
    id: string;
    bidderId: string;
    bidderName: string;
    bidderRegister: string;
    offeredAmount: number;
    submissionDate: string;
    status: string;
    guarantees: Array<{
      id: string;
      guaranteeTypeCode: string;
      guaranteeNumber: string;
      bankName: string;
      amount: number;
      status: string;
      expiryDate: string;
    }>;
  }>;
  openings: Array<{
    id: string;
    openingDate: string;
    conductedBy: string;
    isLocked: boolean;
  }>;
  evaluationCommittees: Array<{
    id: string;
    committeeName: string;
    headOfCommittee: string;
    membersCount: number;
  }>;
  awardRecommendations: Array<{
    id: string;
    selectedBidId: string;
    recommendedAmount: number;
    recommendationDate: string;
    status: string;
    justification: string;
    decisions: Array<{
      id: string;
      councilDecisionNumber: string;
      decisionDate: string;
      decisionStatus: string;
      finalAwardedAmount: number;
    }>;
  }>;
}

export const TenderWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<TenderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'project' | 'boq' | 'documents' | 'bids' | 'openings' | 'evaluation' | 'award' | 'workflow' | 'audit'
  >('overview');

  // BOQ Form State
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [boqDesc, setBoqDesc] = useState('');
  const [boqUnit, setBoqUnit] = useState('م2');
  const [boqQty, setBoqQty] = useState(100);
  const [boqPrice, setBoqPrice] = useState(15);
  const [boqSubmitting, setBoqSubmitting] = useState(false);

  useEffect(() => {
    if (id) fetchTenderDetails();
  }, [id]);

  const fetchTenderDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenders/${id}`);
      if (res.ok) {
        const json = await res.json();
        setTender(json.data);
      }
    } catch (err) {
      console.error('Failed to load tender details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBoqItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tender || !tender.boqs.length) return;

    try {
      setBoqSubmitting(true);
      const boqId = tender.boqs[0].id;
      const res = await fetch(`/api/tenders/${tender.id}/tenderboqs/${boqId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: boqDesc,
          unit: boqUnit,
          quantity: Number(boqQty),
          estimatedUnitPrice: Number(boqPrice)
        })
      });

      if (res.ok) {
        setShowBoqModal(false);
        setBoqDesc('');
        await fetchTenderDetails();
      }
    } catch (err) {
      console.error('Failed to add BOQ item', err);
    } finally {
      setBoqSubmitting(false);
    }
  };

  const handleTransitionStatus = async (newStatus: number) => {
    if (!tender) return;
    try {
      const res = await fetch(`/api/tenders/${tender.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus })
      });
      if (res.ok) {
        await fetchTenderDetails();
      }
    } catch (err) {
      console.error('Failed to change tender status', err);
    }
  };

  if (loading || !tender) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">جاري تحميل مساحة عمل العطاء...</p>
      </div>
    );
  }

  const primaryBoq = tender.boqs?.[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/tenders" className="hover:text-emerald-600 transition-colors">سجل العطاءات</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{tender.tenderNumber}</span>
      </div>

      {/* Hero Gradient Header */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold text-xs border border-emerald-500/30">
                {tender.tenderNumber}
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
                {tender.tenderTypeCode} / {tender.tenderMethodCode}
              </span>
              <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs border border-teal-500/30 font-semibold">
                الحالة: {tender.statusName}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{tender.title}</h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              {tender.description || 'عطاء هندسي صادر عن مديرية الشؤون الهندسية لبلدية كفرنجة.'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-6 min-w-[280px]">
            <div>
              <p className="text-xs text-emerald-200">القيمة التقديرية للعطاء</p>
              <p className="text-2xl font-bold font-mono text-white mt-0.5">
                {tender.estimatedValue?.toLocaleString()} {tender.currency}
              </p>
              <p className="text-[11px] text-slate-300 mt-1">
                إجمالي الـ BOQ: {primaryBoq?.grandTotal?.toLocaleString() || '0'} {tender.currency}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (10 Sections) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
        <div className="flex border-b border-slate-200 dark:border-slate-700 p-1 min-w-max">
          {[
            { id: 'overview', label: 'البيانات الأساسية', icon: FileText },
            { id: 'project', label: 'المشروع المرتبط', icon: Building2 },
            { id: 'boq', label: `جدول الكميات (${primaryBoq?.items?.length || 0})`, icon: Layers },
            { id: 'documents', label: 'الوثائق والاشتراطات', icon: FileCheck },
            { id: 'bids', label: `المناقصون والعروض (${tender.bids?.length || 0})`, icon: Users },
            { id: 'openings', label: 'فتح المظاريف', icon: Clock },
            { id: 'evaluation', label: 'لجنة التقييم', icon: Shield },
            { id: 'award', label: 'قرار الإحالة', icon: Award },
            { id: 'workflow', label: 'سير العمل', icon: RefreshCw },
            { id: 'audit', label: 'سجل العمليات', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  active
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">المعلومات الإدارية والفنية</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">النوع والتصنيف</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{tender.tenderTypeCode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">طريقة الطرح</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{tender.tenderMethodCode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">المهندس المسؤول</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{tender.responsibleEngineer || 'م. رئيس قسم المشاريع'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ النشر</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {tender.publicationDate ? new Date(tender.publicationDate).toLocaleDateString('ar-JO') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ الإغلاق</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {tender.closingDate ? new Date(tender.closingDate).toLocaleDateString('ar-JO') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ فتح المظاريف</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {tender.openingDate ? new Date(tender.openingDate).toLocaleDateString('ar-JO') : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">ملخص جدول الكميات الإجمالي (BOQ)</h2>
              {primaryBoq ? (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500">المجموع الفرعي (SubTotal)</p>
                    <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {primaryBoq.subTotal.toLocaleString()} د.أ
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500">ضريبة المبيعات ({primaryBoq.taxRatePercent}%)</p>
                    <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {primaryBoq.taxAmount.toLocaleString()} د.أ
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">المجموع الكلي (Grand Total)</p>
                    <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                      {primaryBoq.grandTotal.toLocaleString()} د.أ
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">لم يتم إنشاء جدول كميات بعد.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">المشروع الهندسي</h2>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                    {tender.project.projectNumber}
                  </span>
                  <Link
                    to={`/projects/${tender.project.id}`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>فتح المشروع</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{tender.project.name}</p>
                <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/40 text-xs text-slate-600 dark:text-slate-300 flex justify-between">
                  <span>الكلفة المقدرة:</span>
                  <span className="font-mono font-semibold">{tender.project.estimatedCost?.toLocaleString()} د.أ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Project Link */}
      {activeTab === 'project' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">المشروع الهندسي المعتمد في الموازنة</h2>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border border-blue-200 dark:border-blue-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-mono text-xs font-bold">
                {tender.project.projectNumber}
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{tender.project.name}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                الكلفة التقديرية المعتمدة للمشروع: {tender.project.estimatedCost?.toLocaleString()} د.أ
              </p>
            </div>
            <Link
              to={`/projects/${tender.project.id}`}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-md transition-all text-center"
            >
              الانتقال إلى مساحة عمل المشروع ومخطط غانت
            </Link>
          </div>
        </div>
      )}

      {/* Tab 3: BOQ */}
      {activeTab === 'boq' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">جدول الكميات والمواصفات (BOQ)</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  احتساب أسعار البنود تلقائياً وضريبة المبيعات 16% بموجب معادلات النظام المؤسسي.
                </p>
              </div>
              <button
                onClick={() => setShowBoqModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة بند كميات</span>
              </button>
            </div>

            {primaryBoq && primaryBoq.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">وصف البند والأشغال</th>
                      <th className="px-4 py-3">الوحدة</th>
                      <th className="px-4 py-3">الكمية</th>
                      <th className="px-4 py-3">سعر الوحدة التقديري</th>
                      <th className="px-4 py-3">المجموع التقديري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono text-xs">
                    {primaryBoq.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                        <td className="px-4 py-3 font-semibold text-slate-400">{item.itemNumber}</td>
                        <td className="px-4 py-3 font-sans text-slate-900 dark:text-white font-medium">{item.description}</td>
                        <td className="px-4 py-3">{item.unit}</td>
                        <td className="px-4 py-3">{item.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3">{item.estimatedUnitPrice.toLocaleString()} د.أ</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {item.estimatedTotal.toLocaleString()} د.أ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 text-sm font-semibold">
                    <tr>
                      <td colSpan={5} className="px-4 py-2.5 text-slate-600 dark:text-slate-300">المجموع الفرعي (SubTotal):</td>
                      <td className="px-4 py-2.5 font-mono text-slate-900 dark:text-white">{primaryBoq.subTotal.toLocaleString()} د.أ</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-slate-600 dark:text-slate-300">ضريبة المبيعات ({primaryBoq.taxRatePercent}%):</td>
                      <td className="px-4 py-2 font-mono text-slate-900 dark:text-white">{primaryBoq.taxAmount.toLocaleString()} د.أ</td>
                    </tr>
                    <tr className="text-base text-emerald-700 dark:text-emerald-400">
                      <td colSpan={5} className="px-4 py-3 font-bold">المجموع الإجمالي (Grand Total):</td>
                      <td className="px-4 py-3 font-mono font-bold">{primaryBoq.grandTotal.toLocaleString()} د.أ</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                لا توجد بنود كميات مسجلة. اضغط على "إضافة بند كميات" للبدء.
              </div>
            )}
          </div>

          {/* Add BOQ Item Modal */}
          {showBoqModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">إضافة بند إلى جدول الكميات</h3>
                <form onSubmit={handleAddBoqItem} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">وصف البند *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="مثال: حفريات وتسوية مسار الشارع وإزالة الأنقاض..."
                      value={boqDesc}
                      onChange={(e) => setBoqDesc(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">الوحدة</label>
                      <input
                        type="text"
                        value={boqUnit}
                        onChange={(e) => setBoqUnit(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">الكمية</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={boqQty}
                        onChange={(e) => setBoqQty(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">سعر الوحدة (د.أ)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={boqPrice}
                        onChange={(e) => setBoqPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs flex justify-between font-mono font-semibold">
                    <span>إجمالي البند التقديري:</span>
                    <span>{(Number(boqQty) * Number(boqPrice)).toLocaleString()} د.أ</span>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowBoqModal(false)}
                      className="px-4 py-2 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={boqSubmitting}
                      className="px-5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                    >
                      {boqSubmitting ? 'جاري الحفظ...' : 'حفظ البند'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Bidders & Bids */}
      {activeTab === 'bids' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">سجل المناقصين والعروض المالية والضمانات</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
              إجمالي العروض: {tender.bids?.length || 0}
            </span>
          </div>

          {tender.bids && tender.bids.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {tender.bids.map((bid) => (
                <div key={bid.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{bid.bidderName}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">سجل تجاري: {bid.bidderRegister}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {bid.guarantees.map((g) => (
                        <span key={g.id} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                          <Shield className="w-3 h-3" />
                          <span>ضمان بنكي: {g.bankName} ({g.amount.toLocaleString()} د.أ)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {bid.offeredAmount.toLocaleString()} د.أ
                    </p>
                    <span className="text-xs text-slate-400">
                      تاريخ التقديم: {new Date(bid.submissionDate).toLocaleDateString('ar-JO')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد عروض مقدمة على هذا العطاء بعد.</p>
          )}
        </div>
      )}

      {/* Tab 8: Award Recommendation & Decision */}
      {activeTab === 'award' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">توصية وقرار إحالة العطاء</h2>
          {tender.awardRecommendations && tender.awardRecommendations.length > 0 ? (
            <div className="space-y-4">
              {tender.awardRecommendations.map((ar) => (
                <div key={ar.id} className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white">
                      توصية إحالة معتمدة
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {ar.recommendedAmount.toLocaleString()} د.أ
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <strong>مبررات الإحالة:</strong> {ar.justification}
                  </p>
                  {ar.decisions.map((d) => (
                    <div key={d.id} className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        قرار المجلس البلدي رقم: {d.councilDecisionNumber} ({d.decisionStatus})
                      </span>
                      <span className="font-mono text-emerald-600 font-bold">
                        القيمة المحالة النهائية: {d.finalAwardedAmount.toLocaleString()} د.أ
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm">
              لم تصدر توصية إحالة رسمية لهذا العطاء حتى الآن.
            </div>
          )}
        </div>
      )}

      {/* Tab 9: Workflow Lifecycle */}
      {activeTab === 'workflow' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">دورة حياة العطاء وسير العمل المؤسسي (Workflow)</h2>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { status: 0, label: 'مسودة' },
              { status: 3, label: 'اعتماد للنشر' },
              { status: 4, label: 'منشور رسمياً' },
              { status: 5, label: 'استقبال العروض' },
              { status: 7, label: 'فتح المظاريف' },
              { status: 8, label: 'التقييم الفني' },
              { status: 9, label: 'توصية بالإحالة' },
              { status: 10, label: 'تمت الإحالة' }
            ].map((step) => {
              const isCurrent = tender.status === step.status;
              const isPast = tender.status > step.status;
              return (
                <button
                  key={step.status}
                  onClick={() => handleTransitionStatus(step.status)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
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
