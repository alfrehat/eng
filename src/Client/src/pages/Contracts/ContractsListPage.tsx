import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileCheck2, Search, Plus, 
  CheckCircle2, Clock,
  ChevronLeft, FileText, User
} from 'lucide-react';

interface ContractItem {
  id: string;
  contractNumber: string;
  title: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  tenderId: string;
  tenderNumber: string;
  contractorName: string | null;
  contractTypeCode: string;
  contractStatus: number;
  statusName: string;
  originalValue: number;
  currentContractValue: number;
  currency: string;
  contractDate: string;
  originalCompletionDate: string;
  currentCompletionDate: string;
  variationsCount: number;
  extensionsCount: number;
}

interface ProjectOption {
  id: string;
  projectNumber: string;
  name: string;
}

interface TenderOption {
  id: string;
  tenderNumber: string;
  title: string;
  projectId: string;
  estimatedValue: number;
}

interface BidderOption {
  id: string;
  name: string;
  commercialRegisterNumber: string;
}

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: 'مسودة', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  1: { label: 'قيد التدقيق والمراجعة', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  2: { label: 'معتمد للتوقيع', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  3: { label: 'بانتظار التوقيع', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  4: { label: 'موقع رسمياً', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  5: { label: 'ساري المفعول (قيد التنفيذ)', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  6: { label: 'موقوف مؤقتاً', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  7: { label: 'طلب تمديد مدة', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  8: { label: 'طلب تعديل نطاق', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  9: { label: 'طلب أمر تغييري', color: 'bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  10: { label: 'مكتمل الأعمال', color: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  11: { label: 'مغلق نهائياً', color: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' },
  12: { label: 'منهى تعاقدياً', color: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
  13: { label: 'ملغى', color: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
};

export const ContractsListPage: React.FC = () => {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [tenders, setTenders] = useState<TenderOption[]>([]);
  const [bidders, setBidders] = useState<BidderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tenderId, setTenderId] = useState('');
  const [bidderId, setBidderId] = useState('');
  const [contractType, setContractType] = useState('WORKS');
  const [originalValue, setOriginalValue] = useState(0);
  const [durationDays, setDurationDays] = useState(60);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchContracts();
    fetchPrerequisites();
  }, [search, statusFilter]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      let url = `/api/contracts?page=1&pageSize=30`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setContracts(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load contracts', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const pRes = await fetch('/api/projects?page=1&pageSize=50');
      if (pRes.ok) {
        const json = await pRes.json();
        setProjects(json.data.items || []);
      }

      const tRes = await fetch('/api/tenders?page=1&pageSize=50');
      if (tRes.ok) {
        const json = await tRes.json();
        setTenders(json.data.items || []);
      }

      const bRes = await fetch('/api/bids/bidders');
      if (bRes.ok) {
        const json = await bRes.json();
        setBidders(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId || !tenderId) return;

    try {
      setFormSubmitting(true);
      const payload = {
        title,
        projectId,
        tenderId,
        bidderId: bidderId || null,
        contractTypeCode: contractType,
        originalValue: Number(originalValue),
        durationDays: Number(durationDays),
        currency: 'JOD'
      };

      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setTitle('');
        setOriginalValue(0);
        await fetchContracts();
      }
    } catch (err) {
      console.error('Failed to create contract', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-500/30">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>محرك العقود الهندسية والمشتريات (Phase 05)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">سجل العقود والاتفاقيات البلدية</h1>
            <p className="text-blue-200/80 text-sm mt-1 max-w-2xl">
              إدارة العقود التنفيذية لبلدية كفرنجة: ربط العطاءات والمشاريع، قرارات الإحالة، جداول الكميات المعتمدة، التمديدات الزمنية، والأوامر التغييرية.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-medium shadow-lg hover:shadow-blue-500/25 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>إبرام عقد تنفيذي جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي العقود</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{contracts.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">عقود سارية قيد التنفيذ</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {contracts.filter(c => c.contractStatus === 5).length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">بانتظار التوقيع والمصادقة</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {contracts.filter(c => c.contractStatus >= 1 && c.contractStatus <= 3).length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">عقود مكتملة الأعمال</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {contracts.filter(c => c.contractStatus === 10).length}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم العقد أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="0">مسودة</option>
            <option value="4">موقع رسمياً</option>
            <option value="5">ساري المفعول</option>
            <option value="7">طلب تمديد</option>
            <option value="9">طلب أمر تغييري</option>
            <option value="10">مكتمل</option>
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-medium">
              <tr>
                <th className="px-4 py-3">رقم العقد</th>
                <th className="px-4 py-3">عنوان العقد</th>
                <th className="px-4 py-3">المشروع / العطاء</th>
                <th className="px-4 py-3">المقاول / المنفذ</th>
                <th className="px-4 py-3">القيمة الأصلية</th>
                <th className="px-4 py-3">القيمة الحالية</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    جاري تحميل سجل العقود...
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد عقود مسجلة في النظام حالياً.
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-blue-700 dark:text-blue-400 font-mono">
                      {contract.contractNumber}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      {contract.title}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-mono text-slate-600 dark:text-slate-300">{contract.projectNumber}</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">{contract.tenderNumber}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{contract.contractorName || 'غير مسند'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                      {contract.originalValue.toLocaleString()} {contract.currency}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {contract.currentContractValue.toLocaleString()} {contract.currency}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusMap[contract.contractStatus]?.color || 'bg-slate-100 text-slate-700'}`}>
                        {statusMap[contract.contractStatus]?.label || contract.statusName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
                      >
                        <span>مساحة العمل</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">إبرام عقد تنفيذي جديد</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              سيتم استدعاء Numbering Engine لتوليد رقم العقد (CON-YYYY-XXXX) والتحقق من سلسلة التعاقد.
            </p>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">عنوان العقد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عقد تنفيذ أعمال الخلطة الإسفلتية الساخنة 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المشروع الهندسي *</label>
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر المشروع --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.projectNumber} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">العطاء المرتبط *</label>
                  <select
                    required
                    value={tenderId}
                    onChange={(e) => {
                      setTenderId(e.target.value);
                      const t = tenders.find(x => x.id === e.target.value);
                      if (t && t.estimatedValue > 0) setOriginalValue(t.estimatedValue);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر العطاء --</option>
                    {tenders.map(t => (
                      <option key={t.id} value={t.id}>{t.tenderNumber} - {t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المقاول / المنفذ</label>
                  <select
                    value={bidderId}
                    onChange={(e) => setBidderId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر المقاول --</option>
                    {bidders.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.commercialRegisterNumber})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نوع العقد</label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="WORKS">عقد أشغال هندسية (WORKS)</option>
                    <option value="SUPPLY">عقد توريد ولوازم (SUPPLY)</option>
                    <option value="SERVICES">عقد خدمات فنية (SERVICES)</option>
                    <option value="CONSULTANCY">عقد استشارات هندسية (CONSULTANCY)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">القيمة الأصلية (د.أ)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={originalValue}
                    onChange={(e) => setOriginalValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المدة العقدية (أيام)</label>
                  <input
                    type="number"
                    min="15"
                    max="720"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ العقد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
