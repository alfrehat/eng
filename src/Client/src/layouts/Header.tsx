import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, User as UserIcon } from 'lucide-react';
import { apiClient } from '../api/apiClient';

interface SystemHealth {
  status: string;
  database: string;
  postgis: string;
}

export const Header: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    apiClient.get<SystemHealth>('/health')
      .then(res => {
        if (res.success && res.data) {
          setHealth(res.data);
        }
      })
      .catch(() => {
        setHealth({ status: 'Degraded', database: 'Offline', postgis: 'N/A' });
      });
  }, []);

  return (
    <header className="glass-header" style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.75rem', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            مديرية الأشغال والخدمات الهندسية
          </h1>
          <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
            بلدية كفرنجة الجديدة — المنصة المعمارية المؤسسية v2.0
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Live System Health Badge */}
        <div className={`badge-status ${health?.status === 'Healthy' ? 'badge-success' : 'badge-info'}`}>
          <ShieldCheck style={{ width: '14px', height: '14px' }} />
          <span>{health?.status === 'Healthy' ? 'المنظومة متصلة (PostgreSQL + PostGIS)' : 'جاري الفحص...'}</span>
        </div>

        {/* Notifications Area */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ position: 'relative', background: 'none', border: '1px solid #e2e8f0', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
            title="الإشعارات المركزية"
          >
            <Bell style={{ width: '18px', height: '18px' }} />
            <span style={{ position: 'absolute', top: '7px', right: '7px', width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%' }}></span>
          </button>

          {showNotifications && (
            <div className="glass-panel" style={{ position: 'absolute', left: 0, top: '48px', width: '300px', borderRadius: '12px', padding: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', zIndex: 50 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>الإشعارات المؤسسية</h4>
              <p style={{ fontSize: '0.75rem', color: '#64748b' }}>أساس محرك الإشعارات جاهز لاستقبال رسائل المحركات.</p>
            </div>
          )}
        </div>

        {/* User Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
            <UserIcon style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>المهندس المسؤول</p>
            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>مديرية الأشغال الهندسية</p>
          </div>
        </div>
      </div>
    </header>
  );
};
