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
const roadsHead = { id: 'U-003', username: 'eng_ahmad_karaz', role: 'head_of_roads', fullName: 'م. أحمد الكراز', department: 'قسم الطرق والبنية التحتية' };
const roadsEng = { id: 'U-005', username: 'eng_waad_ananbeh', role: 'roads_engineer', fullName: 'م. وعد العنانبة', department: 'قسم الطرق والبنية التحتية' };

async function run() {
  console.log('🚀 بدء اختبار المشروحات والتنسيبات الهندسية والاعتماد النهائي...');
  
  // 1. Create appeal/task
  const createRes = await api('/api/v4/operations-center', {
    method: 'POST',
    body: {
      title: 'طلب صيانة وتعبيد شارع البلدية الرئيسي',
      description: 'استدعاء من المواطن بخصوص وجود هبوط وتآكل في طبقة الإسفلت',
      task_type: 'appeal',
      priority: 'high',
      assigned_to: 'U-003',
      location_name: 'كفرنجة - الشارع العام',
      citizen_name: 'علي حسن العنانزة',
      citizen_phone: '0770000000',
      appeal_number: '2026/889'
    }
  }, director);

  const opId = createRes.data.id;
  console.log(`✅ تم إنشاء الاستدعاء برقم: ${createRes.data.task_number} (${opId})`);

  // 2. Head of Roads adds endorsement note and forwards to engineer
  const end1 = await api(`/api/v4/operations-center/${opId}/endorsement`, {
    method: 'POST',
    body: {
      noteText: 'يرجى من م. وعد إجراء الكشف الميداني وحساب مساحة التعبيد المطلوبة',
      recommendation: 'تنسيب بإجراء كشف ميداني ورفع قياسات',
      actionType: 'FORWARD',
      targetUserId: 'U-005'
    }
  }, roadsHead);
  console.log(`✅ تم تسجيل مشروحة رئيس قسم الطرق: ${end1.message}`);

  // 3. Roads Engineer adds field inspection endorsement
  const end2 = await api(`/api/v4/operations-center/${opId}/endorsement`, {
    method: 'POST',
    body: {
      noteText: 'تم الكشف الميداني، المساحة المتضررة 120 م2 وتحتاج إلى قشط وتعبيد بخلطة ساخنة',
      recommendation: 'تنسيب بالموافقة والتنفيذ ضمن عطاء الصيانة',
      actionType: 'SUBMIT',
      targetUserId: 'U-002'
    }
  }, roadsEng);
  console.log(`✅ تم تسجيل مشروحة المهندس الميداني: ${end2.message}`);

  // 4. Director finalizes and approves transaction
  const fin = await api(`/api/v4/operations-center/${opId}/finalize`, {
    method: 'POST',
    body: {
      decisionText: 'تمت الموافقة على التنسيبات الفنية، وتكليف ورشة الصيانة بالتنفيذ الفوري',
      decisionStatus: 'completed'
    }
  }, director);
  console.log(`✅ تم الاعتماد النهائي وتثبيت المعاملة: ${fin.message}`);

  // 5. Verify final state
  const getOp = await api(`/api/v4/operations-center/${opId}`, { method: 'GET' }, director);
  const op = getOp.data;
  console.log(`📊 حالة المعاملة: ${op.status} | عدد المشروحات: ${op.notes_and_endorsements.length}`);
  console.log(`🏆 نص القرار النهائي: ${op.final_decision.decisionText}`);

  console.log('\n🎉 اكتمل اختبار دورة المشروحات والتنسيبات والاعتماد النهائي بنجاح 100%!');
}

run().catch(err => {
  console.error('❌ خطأ في الاختبار:', err.message);
  process.exit(1);
});
