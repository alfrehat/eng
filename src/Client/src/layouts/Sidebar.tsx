import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sliders, Activity, Layers, LogIn } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { label: 'لوحة المؤشرات', path: '/', icon: LayoutDashboard },
    { label: 'إعدادات المنظومة', path: '/admin', icon: Sliders },
    { label: 'فحص المحركات وقاعدة البيانات', path: '/health-check', icon: Activity },
    { label: 'بوابة تسجيل الدخول', path: '/login', icon: LogIn },
  ];

  return (
    <aside className="sidebar-container">
      {/* Brand Section */}
      <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
          <Layers style={{ width: '22px', height: '22px' }} />
        </div>
        <div>
          <h2 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>بلدية كفرنجة</h2>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
            Enterprise v2.0
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#ffffff' : '#94a3b8',
                background: isActive ? '#1d4ed8' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon style={{ width: '18px', height: '18px', color: isActive ? '#ffffff' : '#64748b' }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div style={{ padding: '1rem', borderTop: '1px solid #1e293b', fontSize: '0.68rem', color: '#64748b', textAlign: 'center' }}>
        <p>مبني على .NET 8 + PostGIS + React</p>
        <p style={{ marginTop: '3px' }}>كافة الحقوق محفوظة © 2026</p>
      </div>
    </aside>
  );
};
