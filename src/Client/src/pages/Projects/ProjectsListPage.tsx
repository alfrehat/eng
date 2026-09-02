import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, ChevronLeft, MapPin } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { LoadingState, ErrorState, EmptyState } from '../../components/UIStates';

interface ProjectListItem {
  id: string;
  projectNumber: string;
  name: string;
  projectTypeCode: string;
  categoryCode: string;
  status: number;
  statusName: string;
  priorityLevel: string;
  organizationName?: string;
  responsibleEngineer?: string;
  startDate?: string;
  plannedEndDate?: string;
  estimatedCost: number;
  contractValue: number;
  actualExpenditure: number;
  progressPercentage: number;
  primaryFundingSource?: string;
  latitude?: number;
  longitude?: number;
}

export const ProjectsListPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Project Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('ROADS');
  const [newCost, setNewCost] = useState<number>(50000);
  const [newEngineer, setNewEngineer] = useState('م. أحمد العنانزة');
  const [newFunding, setNewFunding] = useState('موازنة البلدية الذاتية');
  const [newLat, setNewLat] = useState<number>(32.2982); // Kafranjah Lat
  const [newLng, setNewLng] = useState<number>(35.6985); // Kafranjah Lng
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = () => {
    setLoading(true);
    setError(null);
    let url = `/api/projects?search=${encodeURIComponent(search)}`;
    if (statusFilter !== '') url += `&status=${statusFilter}`;

    apiClient.get<any>(url)
      .then(res => {
        if (res.success && res.data) {
          setProjects(res.data.items || []);
        } else {
          setError(res.errorMessage || 'فشل جلب قائمة المشاريع');
        }
      })
      .catch(err => setError(err.errorMessage || 'تعذر الاتصال بخادم المشاريع'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post<any>('/api/projects', {
        name: newName.trim(),
        projectTypeCode: newType,
        estimatedCost: Number(newCost),
        responsibleEngineer: newEngineer,
        primaryFundingSource: newFunding,
        latitude: Number(newLat),
        longitude: Number(newLng),
        locationDescription: 'بلدية كفرنجة الجديدة - محافظة عجلون'
      });

      if (res.success) {
        setIsCreateModalOpen(false);
        setNewName('');
        fetchProjects();
      } else {
        alert(res.errorMessage || 'فشل إنشاء المشروع');
      }
    } catch (err: any) {
      alert(err.errorMessage || 'حدث خطأ أثناء إنشاء المشروع');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (statusName: string) => {
    switch (statusName) {
      case 'Active':
        return <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>قيد التنفيذ (Active)</span>;
      case 'Approved':
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>معتمد (Approved)</span>;
      case 'Completed':
        return <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>مكتمل (Completed)</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>مسودة (Draft)</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
            مديرية الأشغال والخدمات الهندسية
          </span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            سجل المشاريع الهندسية والتخطيط (Projects Engine)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={fetchProjects} className="glass-panel" style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <RefreshCw style={{ width: '15px', height: '15px' }} />
            تحديث
          </button>

          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <Plus style={{ width: '18px', height: '18px' }} />
            مشروع هندسي جديد
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '500px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', right: '10px', top: '10px', width: '16px', height: '16px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="البحث برقم المشروع أو اسمه..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchProjects()}
              style={{ width: '100%', padding: '0.45rem 2.25rem 0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter style={{ width: '15px', height: '15px', color: '#64748b' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="">جميع الحالات</option>
              <option value="0">مسودة (Draft)</option>
              <option value="1">تخطيط (Planning)</option>
              <option value="2">معتمد (Approved)</option>
              <option value="3">قيد التنفيذ (Active)</option>
              <option value="5">مكتمل (Completed)</option>
            </select>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          إجمالي المشاريع: <strong>{projects.length}</strong>
        </span>
      </div>

      {/* Projects Table */}
      <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
        {loading && <LoadingState message="جاري تحميل المشاريع الهندسية..." />}
        {error && <ErrorState message={error} onRetry={fetchProjects} />}

        {!loading && !error && projects.length === 0 && (
          <EmptyState
            title="لا توجد مشاريع مسجلة بعد"
            message="يمكنك البدء بإضافة أول مشروع هندسي في بلدية كفرنجة."
            actionText="إضافة مشروع هندسي"
            onAction={() => setIsCreateModalOpen(true)}
          />
        )}

        {!loading && !error && projects.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>رقم المشروع</th>
                  <th style={{ padding: '10px 14px' }}>اسم المشروع</th>
                  <th style={{ padding: '10px 14px' }}>النوع</th>
                  <th style={{ padding: '10px 14px' }}>الحالة</th>
                  <th style={{ padding: '10px 14px' }}>الكلفة التقديرية</th>
                  <th style={{ padding: '10px 14px' }}>المصروف الفعلي</th>
                  <th style={{ padding: '10px 14px' }}>نسبة الإنجاز</th>
                  <th style={{ padding: '10px 14px' }}>الموقع الجغرافي</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>مساحة العمل</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#1e40af', fontFamily: 'monospace' }}>
                      {p.projectNumber}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none', color: '#0f172a' }}>
                        {p.name}
                      </Link>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 400 }}>
                        {p.responsibleEngineer || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{p.projectTypeCode}</td>
                    <td style={{ padding: '12px 14px' }}>{getStatusBadge(p.statusName)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.estimatedCost.toLocaleString()} د.أ</td>
                    <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 600 }}>{p.actualExpenditure.toLocaleString()} د.أ</td>
                    <td style={{ padding: '12px 14px', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, p.progressPercentage)}%`, height: '100%', background: '#2563eb' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{p.progressPercentage}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: '#64748b' }}>
                      {p.latitude && p.longitude ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#2563eb' }}>
                          <MapPin style={{ width: '13px', height: '13px' }} />
                          PostGIS ({p.latitude.toFixed(3)}, {p.longitude.toFixed(3)})
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Link
                        to={`/projects/${p.id}`}
                        className="glass-panel"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', color: '#1d4ed8' }}
                      >
                        <span>فتح</span>
                        <ChevronLeft style={{ width: '14px', height: '14px' }} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Project */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '18px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>إنشاء مشروع هندسي جديد</h3>
                <p style={{ fontSize: '0.72rem', color: '#64748b' }}>سيتم توليد رقم المشروع آلياً بواسطة Numbering Engine</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <form onSubmit={handleCreateProject} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>اسم المشروع *</label>
                <input
                  type="text"
                  placeholder="e.g. مشروع صيانة وتعبيد شوارع كفرنجة - الحزمة الأولى"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>نوع المشروع</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                  <option value="ROADS">طرق وأشغال (ROADS)</option>
                  <option value="BUILDINGS">مباني وإنشاءات (BUILDINGS)</option>
                  <option value="INFRASTRUCTURE">بنية تحتية وتصريف مياه (INFRASTRUCTURE)</option>
                  <option value="LIGHTING">إنارة وطاقة (LIGHTING)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>الكلفة التقديرية (د.أ)</label>
                <input
                  type="number"
                  value={newCost}
                  onChange={e => setNewCost(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>المهندس المسؤول</label>
                <input
                  type="text"
                  value={newEngineer}
                  onChange={e => setNewEngineer(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>مصدر التمويل</label>
                <input
                  type="text"
                  value={newFunding}
                  onChange={e => setNewFunding(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>خط العرض (Latitude)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newLat}
                  onChange={e => setNewLat(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>خط الطول (Longitude)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newLng}
                  onChange={e => setNewLng(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.82rem', cursor: 'pointer' }}>
                  إلغاء
                </button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.55rem 1.25rem' }}>
                  {submitting ? 'جاري الإنشاء...' : 'حفظ وإنشاء المشروع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
