import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, Search, Filter, CheckCircle2, Clock, 
  AlertCircle, ChevronRight, DollarSign, Calendar, Building2 
} from 'lucide-react';

interface ClaimSummary {
  id: string;
  claimNumber: string;
  contractId: string;
  contractNumber: string;
  contractTitle: string;
  projectId: string;
  projectName: string;
  claimTypeCode: string;
  claimPeriodFrom: string;
  claimPeriodTo: string;
  status: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  currentCertifiedAmount: number;
  createdAt: string;
}

interface ContractOption {
  id: string;
  contractNumber: string;
  title: string;
}

export const ClaimsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newClaim, setNewClaim] = useState({
    contractId: '',
    claimTypeCode: 'INTERIM_PAYMENT',
    claimPeriodFrom: new Date().toISOString().substring(0, 10),
    claimPeriodTo: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    notes: ''
  });

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/claims?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.data?.items || []);
      }
    } catch (e) {
      console.error('Failed to fetch claims', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/contracts');
      if (res.ok) {
        const data = await res.json();
        setContracts(data.data?.items || []);
        if (data.data?.items?.length > 0) {
          setNewClaim(prev => ({ ...prev, contractId: data.data.items[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to fetch contracts', e);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchContracts();
  }, [search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setModalLoading(true);
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClaim)
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        navigate(`/claims/${data.data.id}`);
      } else {
        setErrorMsg(data.message || 'فشل إنشاء المستخلص');
      }
    } catch (e) {
      setErrorMsg('حدث خطأ في الاتصال بالخادم');
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Draft':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"><Clock className="w-3.5 h-3.5" /> مسودة</span>;
      case 'Submitted':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"><Clock className="w-3.5 h-3.5" /> مرفوع للتدقيق</span>;
      case 'Certified':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> معتمد بشهادة دفع</span>;
      case 'PaymentReferred':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><DollarSign className="w-3.5 h-3.5" /> محال للصرف المالي</span>;
      case 'Paid':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"><CheckCircle2 className="w-3.5 h-3.5" /> تم الصرف</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{st}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">سجل المستخلصات والمطالبات المالية</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">إدارة القياسات الميدانية، شهادات الدفع المعتمدة، والربط بالبرامج المالية</p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          إنشاء مستخلص جديد
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم المستخلص، رقم العقد، اسم المشروع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">جميع الحالات</option>
            <option value="Draft">مسودة</option>
            <option value="Submitted">مرفوع للتدقيق</option>
            <option value="Certified">معتمد بشهادة دفع</option>
            <option value="PaymentReferred">محال للصرف المالي</option>
            <option value="Paid">تم الصرف</option>
          </select>
        </div>
      </div>

      {/* Claims List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">جاري تحميل المستخلصات...</div>
        ) : claims.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">لا توجد مستخلصات مسجلة حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4">رقم المستخلص</th>
                  <th className="p-4">العقد والمشروع</th>
                  <th className="p-4">الفترة الزمنية</th>
                  <th className="p-4">الإجمالي (د.أ)</th>
                  <th className="p-4">الخصومات (د.أ)</th>
                  <th className="p-4">الصافي المعتمد (د.أ)</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {claims.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => navigate(`/claims/${c.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.claimNumber}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.contractNumber}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {c.projectName}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {new Date(c.claimPeriodFrom).toLocaleDateString('ar-JO')}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">إلى {new Date(c.claimPeriodTo).toLocaleDateString('ar-JO')}</div>
                    </td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">{c.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                    <td className="p-4 text-rose-600 font-semibold">{c.deductionAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                    <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{c.netAmount.toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                    <td className="p-4">{getStatusBadge(c.status)}</td>
                    <td className="p-4 text-center">
                      <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">إصدار مستخلص أعمال جديد</h2>
            
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 text-sm font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">اختر العقد التنفيذي *</label>
                <select
                  value={newClaim.contractId}
                  onChange={(e) => setNewClaim({ ...newClaim, contractId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  required
                >
                  {contracts.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.contractNumber} — {ct.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نوع المستخلص</label>
                <select
                  value={newClaim.claimTypeCode}
                  onChange={(e) => setNewClaim({ ...newClaim, claimTypeCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="INTERIM_PAYMENT">مستخلص جاري (Interim Payment)</option>
                  <option value="FINAL_PAYMENT">مستخلص ختامي (Final Payment)</option>
                  <option value="ADVANCE_PAYMENT">دفعة مقدمة (Advance Payment)</option>
                  <option value="RETENTION_RELEASE">رد محجوز ضمان (Retention Release)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">بداية الفترة *</label>
                  <input
                    type="date"
                    value={newClaim.claimPeriodFrom}
                    onChange={(e) => setNewClaim({ ...newClaim, claimPeriodFrom: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نهاية الفترة *</label>
                  <input
                    type="date"
                    value={newClaim.claimPeriodTo}
                    onChange={(e) => setNewClaim({ ...newClaim, claimPeriodTo: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات المستخلص</label>
                <textarea
                  rows={3}
                  value={newClaim.notes}
                  onChange={(e) => setNewClaim({ ...newClaim, notes: e.target.value })}
                  placeholder="بيانات موقع الأعمال، أو أي إيضاحات إضافية..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {modalLoading ? 'جاري الإصدار...' : 'إصدار المستخلص'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ClaimsListPage;
