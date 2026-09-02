import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sliders, Activity, Layers, LogIn, FileText, Wrench } from 'lucide-react';
import { apiClient } from '../api/apiClient';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [dynamicModules, setDynamicModules] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get<any[]>('/api/system/metadata/menus')
      .then(res => {
        if (res.success && res.data) {
          setDynamicModules(res.data);
        }
      })
      .catch(() => {});
  }, [location.pathname]);

  const coreNavItems = [
    { label: 'لوحة المؤشرات', path: '/', icon: LayoutDashboard },
    { label: 'استوديو الإدارة (Zero-Code)', path: '/admin/studio', icon: Wrench },
    { label: 'إعدادات المنظومة', path: '/admin', icon: Sliders },
    { label: 'فحص المحركات والاتصال', path: '/health-check', icon: Activity },
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
            Zero-Code Engine v2.0
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, padding: '0.2rem 0.5rem' }}>
          القوائم الأساسية
        </div>
        {coreNavItems.map((item) => {
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
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#ffffff' : '#94a3b8',
                background: isActive ? '#1d4ed8' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon style={{ width: '17px', height: '17px', color: isActive ? '#ffffff' : '#64748b' }} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Dynamic Screens Menu Section */}
        {dynamicModules.some(m => m.sections?.some((s: any) => s.screens?.length > 0)) && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #1e293b' }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, padding: '0.2rem 0.5rem', marginBottom: '0.35rem' }}>
              الشاشات المولدة ديناميكيًا
            </div>
            {dynamicModules.map(mod => (
              <div key={mod.id} style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', padding: '0.2rem 0.5rem', display: 'block', fontWeight: 600 }}>
                  {mod.name}
                </span>
                {mod.sections?.flatMap((s: any) => s.screens || []).map((screen: any) => {
                  const path = `/dynamic/${screen.code.toLowerCase()}`;
                  const isActive = location.pathname === path;
                  return (
                    <Link
                      key={screen.id}
                      to={path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#ffffff' : '#cbd5e1',
                        background: isActive ? '#2563eb' : 'transparent',
                        textDecoration: 'none',
                        marginRight: '0.5rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <FileText style={{ width: '15px', height: '15px', color: isActive ? '#ffffff' : '#64748b' }} />
                      <span>{screen.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer Info */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid #1e293b', fontSize: '0.68rem', color: '#64748b', textAlign: 'center' }}>
        <p>Zero-Code Management Enabled</p>
      </div>
    </aside>
  );
};
