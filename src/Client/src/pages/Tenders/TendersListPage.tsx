import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Search, Plus, 
  CheckCircle2, Clock, Building2,
  ChevronLeft, Award
} from 'lucide-react';

interface TenderItem {
  id: string;
  tenderNumber: string;
  title: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  tenderTypeCode: string;
  tenderMethodCode: string;
  categoryCode: string;
  status: number;
  statusName: string;
  estimatedValue: number;
  currency: string;
  publicationDate: string | null;
  closingDate: string | null;
  bidsCount: number;
}

interface ProjectOption {
  id: string;
  projectNumber: string;
  name: string;
  estimatedCost: number;
}

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: 'مسودة', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  1: { label: 'قيد الإعداد', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  2: { label: 'قيد المراجعة', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  3: { label: 'معتمد للنشر', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  4: { label: 'منشور رسمياً', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  5: { label: 'استقبال العروض', color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  6: { label: 'مغلق للعروض', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  7: { label: 'فتح المظاريف', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  8: { label: 'قيد التقييم', color: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
  9: { label: 'توصية بالإحالة', color: 'bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  10: { label: 'تمت الإحالة', color: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  11: { label: 'ملغى', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  12: { label: 'مغلق نهائياً', color: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' },
};

export const TendersListPage: React.FC = () => {
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  // New Tender Form State
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tenderType, setTenderType] = useState('WORKS');
  const [tenderMethod, setTenderMethod] = useState('OPEN');
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [closingDays, setClosingDays] = useState(21);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchTenders();
    fetchProjects();
  }, [search, statusFilter]);

  const fetchTenders = async () => {
    try {
      setLoading(true);
      let url = `/api/tenders?page=1&pageSize=30`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setTenders(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load tenders', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects?page=1&pageSize=50');
      if (res.ok) {
        const json = await res.json();
        setProjects(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId) return;

    try {
      setFormSubmitting(true);
      const pubDate = new Date();
      const closeDate = new Date();
      closeDate.setDate(pubDate.getDate() + Number(closingDays));
      const openDate = new Date(closeDate);
      openDate.setDate(openDate.getDate() + 1);

      const payload = {
        title,
        projectId,
        tenderTypeCode: tenderType,
        tenderMethodCode: tenderMethod,
        categoryCode: 'ROADS',
        estimatedValue: Number(estimatedValue),
        currency: 'JOD',
        publicationDate: pubDate.toISOString(),
        closingDate: closeDate.toISOString(),
        openingDate: openDate.toISOString()
      };

      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setTitle('');
        setEstimatedValue(0);
        await fetchTenders();
      }
    } catch (err) {
      console.error('Failed to create tender', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
              <Award className="w-3.5 h-3.5" />
              <span>محرك العطاءات والمشتريات الهندسية (Phase 04)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">سجل العطاءات والمناقصات البلدية</h1>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-2xl">
              إدارة عطاءات بلدية كفرنجة الجديدة: ربط المشاريع الهندسية، جداول الكميات الذكية (BOQ)، استقبال وتقييم العروض والضمانات، وإجراءات الإحالة.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>طرح عطاء هندسي جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي العطاءات</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{tenders.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">قيد الطرح واستقبال العروض</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {tenders.filter(t => t.status >= 4 && t.status <= 5).length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">قيد التقييم والإحالة</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {tenders.filter(t => t.status >= 7 && t.status <= 9).length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">العطاءات المحالة</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {tenders.filter(t => t.status === 10).length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم أو اسم العطاء..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="0">مسودة</option>
            <option value="4">منشور</option>
            <option value="5">استقبال العروض</option>
            <option value="7">فتح المظاريف</option>
            <option value="8">قيد التقييم</option>
            <option value="10">تمت الإحالة</option>
          </select>
        </div>
      </div>

      {/* Tenders Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-medium">
              <tr>
                <th className="px-4 py-3">رقم العطاء</th>
                <th className="px-4 py-3">عنوان العطاء</th>
                <th className="px-4 py-3">المشروع المرتبط</th>
                <th className="px-4 py-3">طريقة الطرح / النوع</th>
                <th className="px-4 py-3">القيمة التقديرية</th>
                <th className="px-4 py-3">العروض</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    جاري تحميل سجل العطاءات...
                  </td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد عطاءات مطابقة في النظام حالياً.
                  </td>
                </tr>
              ) : (
                tenders.map((tender) => (
                  <tr key={tender.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                      {tender.tenderNumber}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      {tender.title}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link 
                        to={`/projects/${tender.projectId}`}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{tender.projectNumber}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                        {tender.tenderTypeCode} / {tender.tenderMethodCode}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-slate-900 dark:text-white">
                      {tender.estimatedValue.toLocaleString()} {tender.currency}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {tender.bidsCount} عروض
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusMap[tender.status]?.color || 'bg-slate-100 text-slate-700'}`}>
                        {statusMap[tender.status]?.label || tender.statusName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        to={`/tenders/${tender.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors"
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

      {/* Create Tender Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">طرح عطاء بلدي جديد</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              سيتم توليد رقم العطاء تلقائياً عبر Numbering Engine وربطه بالمشروع الهندسي المعتمد.
            </p>

            <form onSubmit={handleCreateTender} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">عنوان العطاء *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عطاء إعادة تأهيل وتعبيد شوارع كفرنجة لعام 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">المشروع الهندسي المرتبط *</label>
                <select
                  required
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    const sel = projects.find(p => p.id === e.target.value);
                    if (sel && sel.estimatedCost > 0) setEstimatedValue(sel.estimatedCost);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- اختر المشروع الهندسي --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.projectNumber} - {p.name} ({p.estimatedCost?.toLocaleString()} د.أ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">نوع العطاء</label>
                  <select
                    value={tenderType}
                    onChange={(e) => setTenderType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="WORKS">أشغال هندسية (WORKS)</option>
                    <option value="SUPPLIES">لوازم ومواد (SUPPLIES)</option>
                    <option value="SERVICES">خدمات فنية (SERVICES)</option>
                    <option value="CONSULTING">استشارات ودراسات (CONSULTING)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">طريقة الطرح</label>
                  <select
                    value={tenderMethod}
                    onChange={(e) => setTenderMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="OPEN">عطاء مفتوح علني (OPEN)</option>
                    <option value="RESTRICTED">عطاء محدود (RESTRICTED)</option>
                    <option value="DIRECT_PURCHASE">شراء مباشر / استدراج عروض</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">القيمة التقديرية (د.أ)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">مدة استقبال العروض (أيام)</label>
                  <input
                    type="number"
                    min="7"
                    max="90"
                    value={closingDays}
                    onChange={(e) => setClosingDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors disabled:opacity-50"
                >
                  {formSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ العطاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
