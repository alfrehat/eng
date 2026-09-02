import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, Trash2, Printer, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { LoadingState, ErrorState, EmptyState } from '../UIStates';
import { DynamicFormModal } from './DynamicFormModal';
import { FieldMeta } from './DynamicFieldInput';

interface ScreenMeta {
  id: string;
  code: string;
  title: string;
  fields: FieldMeta[];
  actions: { id: string; actionType: string; label: string; icon?: string }[];
}

interface DynamicRecordItem {
  id: string;
  referenceNumber?: string;
  data: Record<string, any>;
  createdAt: string;
}

export const DynamicScreenRenderer: React.FC = () => {
  const { screenCode } = useParams<{ screenCode: string }>();

  const [screen, setScreen] = useState<ScreenMeta | null>(null);
  const [records, setRecords] = useState<DynamicRecordItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchScreenAndData = () => {
    if (!screenCode) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.get<ScreenMeta>(`/api/system/metadata/screens/${screenCode}`),
      apiClient.get<any>(`/api/system/data/${screenCode}?page=${page}&pageSize=15&search=${encodeURIComponent(search)}`)
    ])
      .then(([screenRes, dataRes]) => {
        if (screenRes.success && screenRes.data) {
          setScreen(screenRes.data);
        } else {
          setError(screenRes.errorMessage || 'فشل جلب إعدادات الشاشة');
          return;
        }

        if (dataRes.success && dataRes.data) {
          setRecords(dataRes.data.items || []);
          setTotalCount(dataRes.data.totalCount || 0);
        }
      })
      .catch(err => {
        setError(err.errorMessage || 'تعذر تحميل بيانات الشاشة الديناميكية');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    fetchScreenAndData();
  }, [screenCode]);

  useEffect(() => {
    fetchScreenAndData();
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا السجل؟')) return;
    try {
      await apiClient.delete(`/api/system/data/${screenCode}/${id}`);
      fetchScreenAndData();
    } catch (err: any) {
      alert(err.errorMessage || 'فشل حذف السجل');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !screen) return <LoadingState message="جاري قراءة الـ Metadata وتوليد الشاشة..." />;
  if (error) return <ErrorState title="خطأ في عرض الشاشة" message={error} onRetry={fetchScreenAndData} />;
  if (!screen) return null;

  const canCreate = screen.actions.some(a => a.actionType.toLowerCase() === 'create');
  const canDelete = screen.actions.some(a => a.actionType.toLowerCase() === 'delete');
  const canPrint = screen.actions.some(a => a.actionType.toLowerCase() === 'print');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Screen Title & Top Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
            شاشة مولدة ديناميكيًا ({screen.code})
          </span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {screen.title}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {canPrint && (
            <button onClick={handlePrint} className="glass-panel" style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <Printer style={{ width: '16px', height: '16px' }} />
              طباعة
            </button>
          )}

          <button onClick={fetchScreenAndData} className="glass-panel" style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            تحديث
          </button>

          {canCreate && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              <Plus style={{ width: '18px', height: '18px' }} />
              إضافة سجل جديد
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search style={{ position: 'absolute', right: '10px', top: '10px', width: '16px', height: '16px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="بحث في السجلات..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchScreenAndData()}
            style={{ width: '100%', padding: '0.45rem 2.25rem 0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
          />
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          إجمالي السجلات: <strong>{totalCount}</strong>
        </span>
      </div>

      {/* Dynamic Data Table */}
      <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden' }}>
        {records.length === 0 ? (
          <EmptyState
            title="لا توجد سجلات بعد"
            message={`لم يتم إدخال أي سجلات في شاشة ${screen.title}.`}
            actionText={canCreate ? 'إضافة أول سجل' : undefined}
            onAction={canCreate ? () => setIsModalOpen(true) : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 14px' }}>#</th>
                  {screen.fields.map(f => (
                    <th key={f.fieldName} style={{ padding: '10px 14px' }}>{f.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px' }}>تاريخ الإنشاء</th>
                  {canDelete && <th style={{ padding: '10px 14px', width: '60px' }}>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e40af' }}>
                      {r.referenceNumber || (page - 1) * 15 + idx + 1}
                    </td>
                    {screen.fields.map(f => {
                      const val = r.data ? r.data[f.fieldName] : null;
                      return (
                        <td key={f.fieldName} style={{ padding: '12px 14px', color: '#0f172a' }}>
                          {val === null || val === undefined ? '—' : val.toString()}
                        </td>
                      );
                    })}
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(r.createdAt).toLocaleDateString('ar-JO')}
                    </td>
                    {canDelete && (
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                          title="حذف السجل"
                        >
                          <Trash2 style={{ width: '16px', height: '16px' }} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Form Modal for creating records */}
      <DynamicFormModal
        screenCode={screen.code}
        screenTitle={screen.title}
        fields={screen.fields}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchScreenAndData}
      />
    </div>
  );
};
