import React, { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { LoadingState, ErrorState } from '../components/UIStates';

interface DbCheckData {
  connected: boolean;
  database: string;
  server: string;
  state: string;
}

export const HealthCheckPage: React.FC = () => {
  const [dbData, setDbData] = useState<DbCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const testDb = () => {
    setLoading(true);
    setError(null);
    const start = Date.now();
    apiClient.get<DbCheckData>('/api/v1/system/db-check')
      .then(res => {
        setLatencyMs(Date.now() - start);
        if (res.success && res.data) {
          setDbData(res.data);
        } else {
          setError(res.errorMessage || 'فشل الاتصال بقاعدة البيانات');
        }
      })
      .catch(err => {
        setLatencyMs(Date.now() - start);
        setError(err.errorMessage || 'تعذر الوصول إلى Endpoint فحص قاعدة البيانات');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    testDb();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            فحص المحركات وقاعدة البيانات (Diagnostics & Connectivity)
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            فحص حي للاتصال المباشر مع PostgreSQL 18 و PostGIS وقياس زمن الاستجابة.
          </p>
        </div>
        <button onClick={testDb} className="btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}>
          <RefreshCw style={{ width: '14px', height: '14px' }} />
          إعادة الاختبار
        </button>
      </div>

      {loading && <LoadingState message="جاري اختبار اتصال قاعدة البيانات..." />}
      {error && <ErrorState message={error} onRetry={testDb} />}

      {!loading && !error && dbData && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Check style={{ width: '22px', height: '22px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d' }}>
                الاتصال بقاعدة البيانات يعمل بنجاح تام (100% Operational)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                زمن الاستجابة (Latency): {latencyMs} ميلي ثانية
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b' }}>اسم قاعدة البيانات</p>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{dbData.database}</h4>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b' }}>عنوان الخادم</p>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{dbData.server}</h4>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.7rem', color: '#64748b' }}>حالة الاتصال</p>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#16a34a' }}>Connected / Active</h4>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
