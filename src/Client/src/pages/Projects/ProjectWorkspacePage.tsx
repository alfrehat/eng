import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowRight, LayoutDashboard, Calendar, BarChart2, DollarSign, Award, 
  MapPin, CheckCircle, Play, Plus, RefreshCw, AlertTriangle
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { LoadingState, ErrorState } from '../../components/UIStates';

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<any | null>(null);
  const [schedule, setSchedule] = useState<any | null>(null);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [priorityModels, setPriorityModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'gantt' | 'financial' | 'priority'>('dashboard');

  // New Activity Form State
  const [actCode, setActCode] = useState('');
  const [actName, setActName] = useState('');
  const [actDuration, setActDuration] = useState(5);
  const [isActModalOpen, setIsActModalOpen] = useState(false);

  // New Expenditure State
  const [expAmount, setExpAmount] = useState(1000);
  const [expVoucher, setExpVoucher] = useState('VCH-2026-001');
  const [expPayee, setExpPayee] = useState('شركة المقاولات الإنشائية');

  const fetchProjectData = () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.get<any>(`/api/projects/${id}`),
      apiClient.get<any>(`/api/projects/${id}/dashboard`),
      apiClient.get<any>(`/api/project-schedules/project/${id}`).catch(() => ({ success: false, data: null })),
      apiClient.get<any>('/api/priorities/models').catch(() => ({ success: false, data: [] }))
    ])
      .then(([projRes, dashRes, schedRes, prioRes]) => {
        if (projRes.success && projRes.data) {
          setProject(projRes.data);
        } else {
          setError(projRes.errorMessage || 'فشل تحميل بيانات المشروع');
        }

        if (dashRes.success && dashRes.data) {
          setDashboard(dashRes.data);
        }

        if (schedRes.success && schedRes.data) {
          setSchedule(schedRes.data);
        }

        if (prioRes.success && prioRes.data) {
          setPriorityModels(prioRes.data);
        }
      })
      .catch(err => setError(err.errorMessage || 'حدث خطأ أثناء تحميل تفاصيل المشروع'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const handleStatusChange = async (newStatus: number) => {
    try {
      await apiClient.post(`/api/projects/${id}/status`, { newStatus });
      fetchProjectData();
    } catch (err: any) {
      alert(err.errorMessage || 'فشل تحديث حالة المشروع');
    }
  };

  const handleCreateSchedule = async () => {
    try {
      const res = await apiClient.post<any>('/api/project-schedules', { projectId: id });
      if (res.success) {
        setSchedule(res.data);
        fetchProjectData();
      }
    } catch (err: any) {
      alert(err.errorMessage || 'فشل إنشاء الجدول الزمني');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule || !actCode || !actName) return;

    try {
      await apiClient.post(`/api/project-schedules/${schedule.id}/activities`, {
        activityCode: actCode.trim(),
        name: actName.trim(),
        durationDays: Number(actDuration)
      });
      setIsActModalOpen(false);
      setActCode('');
      setActName('');
      fetchProjectData();
    } catch (err: any) {
      alert(err.errorMessage || 'فشل إضافة النشاط');
    }
  };

  const handleCalculateCpm = async () => {
    if (!schedule) return;
    try {
      const res = await apiClient.post<any>(`/api/project-schedules/${schedule.id}/calculate-cpm`);
      if (res.success) {
        alert('تم حساب المسار الحرج (CPM) والتواريخ المبكرة والمتأخرة بنجاح!');
        fetchProjectData();
      } else {
        alert(res.errorMessage || 'فشل حساب CPM');
      }
    } catch (err: any) {
      alert(err.errorMessage || 'حدث خطأ أثناء حساب المسار الحرج');
    }
  };

  const handleAddExpenditure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/financial-programs/projects/${id}/expenditures`, {
        amount: Number(expAmount),
        voucherNumber: expVoucher,
        payee: expPayee,
        description: 'دفعة مستحقة بموجب مستند صرف رسمي'
      });
      alert('تم تسجيل سند الصرف بنجاح');
      fetchProjectData();
    } catch (err: any) {
      alert(err.errorMessage || 'فشل إضافة سند الصرف');
    }
  };

  if (loading) return <LoadingState message="جاري فتح مساحة عمل المشروع ومحركات التخطيط..." />;
  if (error) return <ErrorState message={error} onRetry={fetchProjectData} />;
  if (!project) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Back Link & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
          <ArrowRight style={{ width: '16px', height: '16px' }} />
          <span>العودة إلى قائمة المشاريع</span>
        </Link>

        {/* Lifecycle Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {project.status === 0 && (
            <button onClick={() => handleStatusChange(1)} className="glass-panel" style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
              تحويل إلى التخطيط
            </button>
          )}
          {project.status === 1 && (
            <button onClick={() => handleStatusChange(2)} className="btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
              <CheckCircle style={{ width: '14px', height: '14px' }} />
              اعتماد المشروع (Approve)
            </button>
          )}
          {project.status === 2 && (
            <button onClick={() => handleStatusChange(3)} className="btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#16a34a' }}>
              <Play style={{ width: '14px', height: '14px' }} />
              بدء التنفيذ (Activate)
            </button>
          )}
          {project.status === 3 && (
            <button onClick={() => handleStatusChange(5)} className="btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem', background: '#9333ea' }}>
              إتمام المشروع (Complete)
            </button>
          )}
        </div>
      </div>

      {/* Master Project Banner */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'linear-gradient(135deg, #0f172a, #1e3a8a)', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.4)', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 700 }}>
                {project.projectNumber}
              </span>
              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                {project.statusName}
              </span>
              <span style={{ fontSize: '0.72rem', background: '#fef08a', color: '#854d0e', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                الأولوية: {project.priorityLevel}
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.5rem' }}>{project.name}</h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              الجهة المالكة: {project.ownerAgency || 'بلدية كفرنجة الجديدة'} | المهندس: {project.responsibleEngineer || '—'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>الكلفة التقديرية</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800 }}>{project.estimatedCost?.toLocaleString()} د.أ</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>المصروف الفعلي</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4ade80' }}>{project.actualExpenditure?.toLocaleString()} د.أ</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>نسبة الإنجاز</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>{project.progressPercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: activeTab === 'dashboard' ? '#2563eb' : '#f1f5f9', color: activeTab === 'dashboard' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <LayoutDashboard style={{ width: '15px', height: '15px' }} />
          لوحة المؤشرات
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: activeTab === 'schedule' ? '#2563eb' : '#f1f5f9', color: activeTab === 'schedule' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Calendar style={{ width: '15px', height: '15px' }} />
          الجدولة والمسار الحرج (CPM)
        </button>

        <button
          onClick={() => setActiveTab('gantt')}
          style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: activeTab === 'gantt' ? '#2563eb' : '#f1f5f9', color: activeTab === 'gantt' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <BarChart2 style={{ width: '15px', height: '15px' }} />
          مخطط غانت (Gantt Chart)
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: activeTab === 'financial' ? '#2563eb' : '#f1f5f9', color: activeTab === 'financial' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <DollarSign style={{ width: '15px', height: '15px' }} />
          البرمجة المالية
        </button>

        <button
          onClick={() => setActiveTab('priority')}
          style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: activeTab === 'priority' ? '#2563eb' : '#f1f5f9', color: activeTab === 'priority' ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Award style={{ width: '15px', height: '15px' }} />
          تقييم الأولوية
        </button>
      </div>

      {/* Tab 1: Dashboard */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>المخصص المالي الإجمالي</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px' }}>{dashboard?.financials?.totalAllocated?.toLocaleString() || 0} د.أ</h3>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>إجمالي المصروفات</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{dashboard?.financials?.totalExpended?.toLocaleString() || 0} د.أ</h3>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>الرصيد المالي المتبقي</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{dashboard?.financials?.remainingBudget?.toLocaleString() || 0} د.أ</h3>
            </div>
            <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>الأنشطة الحرجة (Critical Path)</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{dashboard?.schedule?.criticalActivitiesCount || 0} أنشطة</h3>
            </div>
          </div>

          {/* Location details */}
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin style={{ width: '16px', height: '16px', color: '#2563eb' }} />
              الموقع المكاني للمشروع (PostGIS GIS Foundation)
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#475569' }}>
              {project.latitude && project.longitude ? (
                <>الإحداثيات الجغرافية المسجلة: <strong>{project.latitude.toFixed(4)} N, {project.longitude.toFixed(4)} E</strong> — كفرنجة، محافظة عجلون.</>
              ) : 'لم يتم تحديد موقع مكاني بعد.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Schedule & CPM */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>الجدول الزمني وحساب المسار الحرج (CPM Engine)</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                مدة الجدول الكلية: <strong>{schedule?.totalDurationDays || 0} يوم</strong> | يبدأ: {schedule?.calculatedStartDate ? new Date(schedule.calculatedStartDate).toLocaleDateString('ar-JO') : '—'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {schedule ? (
                <>
                  <button onClick={() => setIsActModalOpen(true)} className="glass-panel" style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus style={{ width: '14px', height: '14px' }} />
                    إضافة نشاط
                  </button>
                  <button onClick={handleCalculateCpm} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}>
                    <RefreshCw style={{ width: '14px', height: '14px' }} />
                    تشغيل حساب المسار الحرج (CPM)
                  </button>
                </>
              ) : (
                <button onClick={handleCreateSchedule} className="btn-primary">
                  إنشاء جدول زمني للمشروع
                </button>
              )}
            </div>
          </div>

          {schedule?.activities?.length > 0 ? (
            <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '8px 12px' }}>الكود</th>
                    <th style={{ padding: '8px 12px' }}>النشاط</th>
                    <th style={{ padding: '8px 12px' }}>المدة (أيام)</th>
                    <th style={{ padding: '8px 12px' }}>البداية المبكرة (ES)</th>
                    <th style={{ padding: '8px 12px' }}>النهاية المبكرة (EF)</th>
                    <th style={{ padding: '8px 12px' }}>البداية المتأخرة (LS)</th>
                    <th style={{ padding: '8px 12px' }}>النهاية المتأخرة (LF)</th>
                    <th style={{ padding: '8px 12px' }}>الفائض (Float)</th>
                    <th style={{ padding: '8px 12px' }}>المسار الحرج</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.activities.map((act: any) => (
                    <tr key={act.id} style={{ borderBottom: '1px solid #f1f5f9', background: act.isCritical ? 'rgba(254, 226, 226, 0.3)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{act.activityCode}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{act.name}</td>
                      <td style={{ padding: '10px 12px' }}>{act.durationDays}</td>
                      <td style={{ padding: '10px 12px' }}>اليوم {act.earlyStartDay}</td>
                      <td style={{ padding: '10px 12px' }}>اليوم {act.earlyFinishDay}</td>
                      <td style={{ padding: '10px 12px' }}>اليوم {act.lateStartDay}</td>
                      <td style={{ padding: '10px 12px' }}>اليوم {act.lateFinishDay}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: act.totalFloat === 0 ? '#dc2626' : '#2563eb' }}>
                        {act.totalFloat}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {act.isCritical ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                            <AlertTriangle style={{ width: '12px', height: '12px' }} />
                            حرج (Critical)
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>عادي</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', borderRadius: '12px', color: '#64748b' }}>
              لا توجد أنشطة مضافة بعد في هذا الجدول الزمني.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Interactive Gantt Chart */}
      {activeTab === 'gantt' && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>مخطط غانت التفاعلي (Interactive Gantt View)</h3>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
                مسار حرج (Critical Activity)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }} />
                نشاط قياسي
              </span>
            </div>
          </div>

          {schedule?.activities?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {schedule.activities.map((act: any) => {
                const totalDuration = Math.max(1, schedule.totalDurationDays || 30);
                const leftPercent = ((act.earlyStartDay || 0) / totalDuration) * 100;
                const widthPercent = Math.max(3, (act.durationDays / totalDuration) * 100);

                return (
                  <div key={act.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.activityCode}: {act.name}
                    </div>
                    <div style={{ background: '#f1f5f9', height: '24px', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
                      <div
                        style={{
                          position: 'absolute',
                          right: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          height: '100%',
                          background: act.isCritical ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 700
                        }}
                      >
                        {act.durationDays} يوم
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>لا توجد أنشطة لعرضها في المخطط.</p>
          )}
        </div>
      )}

      {/* Tab 4: Financial Programming */}
      {activeTab === 'financial' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
          <form onSubmit={handleAddExpenditure} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>تسجيل سند صرف جديد</h4>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>المبلغ (د.أ)</label>
              <input type="number" value={expAmount} onChange={e => setExpAmount(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>رقم المستند / السند</label>
              <input type="text" value={expVoucher} onChange={e => setExpVoucher(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600 }}>الجهة المصروف لها (المستفيد)</label>
              <input type="text" value={expPayee} onChange={e => setExpPayee(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
              حفظ وتوثيق الصرف
            </button>
          </form>

          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>سجل المصروفات المعتمدة للمشروع</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 10px' }}>رقم السند</th>
                  <th style={{ padding: '8px 10px' }}>المبلغ</th>
                  <th style={{ padding: '8px 10px' }}>المستفيد</th>
                  <th style={{ padding: '8px 10px' }}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {project.expenditures?.map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 700, fontFamily: 'monospace' }}>{e.voucherNumber}</td>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#16a34a' }}>{e.amount.toLocaleString()} د.أ</td>
                    <td style={{ padding: '10px' }}>{e.payee || '—'}</td>
                    <td style={{ padding: '10px', color: '#64748b' }}>{new Date(e.disbursementDate).toLocaleDateString('ar-JO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Priority Scoring */}
      {activeTab === 'priority' && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>محرك ترتيب الأولويات (Prioritization Engine)</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
            الدرجة المحسوبة الحالية للمشروع: <strong>{project.priorityLevel}</strong>. يتم حسابها رياضياً بناءً على أوزان المعايير المعتمدة.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {priorityModels[0]?.criteria?.map((c: any) => (
              <div key={c.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.name}</p>
                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>الوزن النسبي: {c.weightPercentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Activity */}
      {isActModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>إضافة نشاط للجدول الزمني</h3>
            <form onSubmit={handleAddActivity} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>رمز النشاط (e.g. ACT-01)</label>
                <input value={actCode} onChange={e => setActCode(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>اسم النشاط</label>
                <input value={actName} onChange={e => setActName(e.target.value)} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>المدة (أيام)</label>
                <input type="number" min={1} value={actDuration} onChange={e => setActDuration(Number(e.target.value))} style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsActModalOpen(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.78rem', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.78rem' }}>حفظ النشاط</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
