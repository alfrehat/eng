import React, { useEffect, useState } from 'react';
import { Sliders, Plus, Save } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { LoadingState, ErrorState, EmptyState } from '../components/UIStates';

interface SystemSetting {
  id: string;
  category: string;
  key: string;
  value: string;
  description?: string;
  dataType: string;
}

export const AdminFoundationPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Setting Form State
  const [category, setCategory] = useState('ORGANIZATION');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSettings = () => {
    setLoading(true);
    apiClient.get<SystemSetting[]>('/api/v1/settings')
      .then(res => {
        if (res.success && res.data) {
          setSettings(res.data);
        }
      })
      .catch(err => setError(err.errorMessage || 'فشل جلب الإعدادات'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim()) return;

    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/settings', {
        category,
        key: key.trim(),
        value: value.trim(),
        description: description.trim(),
        dataType: 'STRING',
      });
      setKey('');
      setValue('');
      setDescription('');
      fetchSettings();
    } catch (err: unknown) {
      const apiErr = err as { errorMessage?: string };
      alert(apiErr.errorMessage || 'فشل حفظ الإعداد');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
          أساس الإعدادات المركزية (Configuration Foundation)
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
          إدارة إعدادات المنظومة من داخل النظام وتخزينها في قاعدة البيانات دون Hard-Coding.
        </p>
      </div>

      {/* Add Setting Card */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus style={{ width: '18px', height: '18px', color: '#2563eb' }} />
          إضافة أو تحديث إعداد جديد
        </h3>

        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>الفئة (Category)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="ORGANIZATION">ORGANIZATION (بيانات البلدية)</option>
              <option value="NUMBERING">NUMBERING (المعرفات والتسلسل)</option>
              <option value="LOCALIZATION">LOCALIZATION (اللغة والتقويم)</option>
              <option value="SECURITY">SECURITY (سياسات الأمان)</option>
              <option value="STORAGE">STORAGE (إعدادات التخزين)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>مفتاح الإعداد (Key)</label>
            <input
              type="text"
              placeholder="e.g. MUNICIPALITY_NAME"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>القيمة (Value)</label>
            <input
              type="text"
              placeholder="e.g. بلدية كفرنجة الجديدة"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>الوصف</label>
            <input
              type="text"
              placeholder="وصف مختصر للإعداد"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ height: '38px', justifyContent: 'center' }}
          >
            <Save style={{ width: '16px', height: '16px' }} />
            {submitting ? 'جاري الحفظ...' : 'حفظ الإعداد'}
          </button>
        </form>
      </div>

      {/* Settings List */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders style={{ width: '18px', height: '18px', color: '#475569' }} />
          الإعدادات المسجلة في قاعدة البيانات (`system_settings`)
        </h3>

        {loading && <LoadingState message="جاري تحميل الإعدادات..." />}
        {error && <ErrorState message={error} onRetry={fetchSettings} />}
        {!loading && !error && settings.length === 0 && (
          <EmptyState
            title="لا توجد إعدادات مسجلة بعد"
            message="يمكنك إضافة أول إعداد للنظام باستخدام النموذج أعلاه."
          />
        )}

        {!loading && !error && settings.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '8px 12px' }}>الفئة</th>
                  <th style={{ padding: '8px 12px' }}>المفتاح (Key)</th>
                  <th style={{ padding: '8px 12px' }}>القيمة (Value)</th>
                  <th style={{ padding: '8px 12px' }}>الوصف</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e40af' }}>{s.category}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{s.key}</td>
                    <td style={{ padding: '10px 12px', color: '#0f172a' }}>{s.value}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
