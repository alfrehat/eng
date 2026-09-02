import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Layers, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('********');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Foundation Authentication Simulation
    localStorage.setItem('knm_auth_token', 'demo_jwt_token_phase01');
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb, #0284c7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', marginBottom: '1rem' }}>
            <Layers style={{ width: '30px', height: '30px' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            تسجيل الدخول المؤسسي
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            مديرية الأشغال والخدمات الهندسية — بلدية كفرنجة الجديدة
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.9rem' }}
          >
            <LogIn style={{ width: '18px', height: '18px' }} />
            دخول المنصة
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
          <ShieldCheck style={{ width: '16px', height: '16px', color: '#16a34a' }} />
          <span>محمي بواسطة Identity & RBAC Foundation</span>
        </div>
      </div>
    </div>
  );
};
