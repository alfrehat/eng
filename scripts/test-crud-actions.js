const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'kfranjah-secure-pki-key-2026';
const BASE_URL = 'http://localhost:3005';

function getToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

async function api(url, options = {}, user) {
  const token = getToken(user);
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE_URL}${url}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`[${res.status}] ` + (data.error || JSON.stringify(data)));
  }
  return data;
}

const director = { id: 'U-002', username: 'eng_mohammad_director', role: 'director_public_works', fullName: 'م. محمد الفريحات', department: 'الإدارة العامة والمديرية' };

async function run() {
  console.log('🚀 اختبار إنشاء وتعديل وحذف العمليات...');

  // 1. Create
  const c = await api('/api/v4/operations-center', {
    method: 'POST',
    body: {
      title: 'معاملة تجريبية لفحص الأزرار',
      task_type: 'technical',
      priority: 'high',
      location_name: 'كفرنجة - الحي الغربي'
    }
  }, director);
  const opId = c.data.id;
  console.log(`✅ تم الإنشاء برقم: ${c.data.task_number} (${opId})`);

  // 2. Update
  const u = await api(`/api/v4/operations-center/${opId}`, {
    method: 'PUT',
    body: {
      title: 'معاملة معدلة - فحص أزرار التعديل',
      priority: 'critical'
    }
  }, director);
  console.log(`✅ تم التعديل: ${u.data.title} | أولوية: ${u.data.priority}`);

  // 3. Delete
  const d = await api(`/api/v4/operations-center/${opId}`, {
    method: 'DELETE'
  }, director);
  console.log(`✅ تم الحذف: ${d.message}`);

  console.log('🎉 كافة الإجراءات تعمل بنجاح 100%!');
}

run().catch(console.error);
