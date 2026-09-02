import React, { useEffect, useState } from 'react';
import { Database, Server, CheckCircle2, ShieldAlert, Cpu, Globe2 } from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { LoadingState, ErrorState } from '../components/UIStates';

interface HealthData {
  status: string;
  system: string;
  version: string;
  architecture: string;
  database: string;
  postgis: string;
  timestamp: string;
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = () => {
    setLoading(true);
    setError(null);
    apiClient.get<HealthData>('/health')
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.errorMessage || 'فشل قراءة حالة النظام');
        }
      })
      .catch((err) => {
        setError(err.errorMessage || 'تعذر الاتصال بخادم ASP.NET Core على المنفذ 5050');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) return <LoadingState message="جاري الاتصال بالنواة المعمارية الجديدة (ASP.NET Core 8)..." />;
  if (error) return <ErrorState title="حالة الاتصال بالخادم" message={error} onRetry={fetchHealth} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', background: 'linear-gradient(135deg, #1e3a8a, #0f172a)', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.3)', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600 }}>
              المرحلة 01: اكتمال تأسيس النظام الجديد (Foundation Complete)
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.6rem' }}>
              {data?.system}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '0.3rem' }}>
              البيئة المعمارية: {data?.architecture} — الإصدار {data?.version}
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
            <CheckCircle2 style={{ width: '32px', height: '32px', color: '#4ade80', margin: '0 auto 4px' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>النواة جاهزة للمحركات</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Server style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>الخادم الأساسي (Host)</p>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>ASP.NET Core 8</h4>
            <p style={{ fontSize: '0.72rem', color: '#16a34a' }}>منفذ التشغيل: 5050 (HTTP)</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <Database style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>قاعدة البيانات (Persistence)</p>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{data?.database}</h4>
            <p style={{ fontSize: '0.72rem', color: '#64748b' }}>قاعدة البيانات: kafr_inja_v2</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
            <Globe2 style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>المحرك الجغرافي (PostGIS)</p>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{data?.postgis}</h4>
            <p style={{ fontSize: '0.72rem', color: '#16a34a' }}>مفعل وجاهز لربط الخرائط</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <Cpu style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>الواجهة الأمامية (Client)</p>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>React 18 + TS + Vite</h4>
            <p style={{ fontSize: '0.72rem', color: '#16a34a' }}>منفذ الواجهة: 5173</p>
          </div>
        </div>
      </div>

      {/* Foundation Security & Audit Status */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert style={{ width: '20px', height: '20px', color: '#2563eb' }} />
          جاهزية الركائز الأساسية للمرحلة القادمة
        </h3>
        <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', color: '#334155' }}>
          <li style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            ✅ <strong>نواة الهوية (Identity Foundation):</strong> Users, Roles, Permissions مهيأة ومهاجرة.
          </li>
          <li style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            ✅ <strong>سجل التدقيق (Audit Foundation):</strong> جدول `audit_logs` جاهز مع تتبع Correlation ID.
          </li>
          <li style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            ✅ <strong>إدارة الملفات (File Storage):</strong> حفظ الملفات وحساب تجزئة SHA-256 محليًا مع حفظ Metadata في DB.
          </li>
          <li style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            ✅ <strong>الإعدادات المركزية (Settings Foundation):</strong> جدول `system_settings` جاهز للتهيئة.
          </li>
        </ul>
      </div>
    </div>
  );
};
