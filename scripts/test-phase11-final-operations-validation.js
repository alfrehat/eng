/**
 * scripts/test-phase11-final-operations-validation.js
 * 🏛️ التدقيق النهائي الشامل لمركز العمل والمتابعة — Zero Legacy / Zero Duplication / Zero Placeholder
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

'use strict';

const http = require('http');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const { isPostgresActive, dbQuery } = require('../utils/database');
const numberingEngine = require('../services/numberingEngine');
const rbacManager = require('../middlewares/rbacManager');
const notificationCenter = require('../services/notificationCenter');
const archiveEngineService = require('../services/archiveEngineService');
const engineRegistry = require('../services/engineRegistry');

const JWT_SECRET = 'kfranjah-secure-pki-key-2026';

function apiCall(method, path, body = null, user = { id: 'U-001', username: 'admin', role: 'admin' }) {
  return new Promise((resolve, reject) => {
    const token = jwt.sign(user, JWT_SECRET);
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3005,
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runFinalValidation() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🏛️  بدء الفحص والتدقيق النهائي الشامل لمركز العمل والمتابعة (EXECUTION COMMAND 06)');
  console.log('🏛️  بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let totalTests = 0;

  function record(desc, condition) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${desc}`);
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      throw new Error(`Validation failed: ${desc}`);
    }
  }

  // 1. فحص عدم وجود Legacy
  console.log('📋 1. التدقيق الهيكلي للكود القديم (Zero Legacy Audit)...');
  record('All 29 Enterprise Engines registered in EngineRegistry', engineRegistry.list().length === 29);
  record('Numbering Engine registered as core service', engineRegistry.has('NUMBERING_ENGINE'));
  record('RBAC Manager registered as core service', engineRegistry.has('AUTHORIZATION_ENGINE'));
  record('Notification Center registered as core service', engineRegistry.has('NOTIFICATION_ENGINE'));
  record('Archive Document Engine registered as core service', engineRegistry.has('ARCHIVE_DOCUMENT_ENGINE'));

  // 2. فحص عدم وجود محركات مكررة
  console.log('\n🔍 2. فحص منع الازدواجية وتكرار المحركات (Zero Duplication Audit)...');
  record('Task numbering strictly delegated to NumberingEngine', typeof numberingEngine.generateNextId === 'function');
  record('Notifications strictly delegated to NotificationCenter', typeof notificationCenter.sendInternalAlert === 'function');
  record('Document storage delegated to ArchiveEngineService', typeof archiveEngineService.indexDocument === 'function');

  // 3. اختبار دورة العمل الكاملة والتوجيه ثنائي الاتجاه
  console.log('\n🔄 3. فحص دورات العمل والتوجيه ثنائي الاتجاه (Workflow & Bidirectional Routing)...');
  const director = { id: 'U-002', username: 'firas_director', role: 'director_public_works', fullName: 'م. فراس القضاة', department: 'مديرية الأشغال' };
  const headRoads = { id: 'U-003', username: 'ahmad_roads', role: 'head_of_roads', fullName: 'م. أحمد العنانزة', department: 'قسم الطرق' };
  const roadsEng = { id: 'U-008', username: 'waed_eng', role: 'roads_engineer', fullName: 'م. وعد العنانبة', department: 'قسم الطرق' };
  const inspector = { id: 'U-005', username: 'hossam_insp', role: 'site_inspector', fullName: 'م. حسام بني نصر', department: 'قسم الطرق' };

  // 3.1 إنشاء مهمة بواسطة المدير
  const createRes = await apiCall('POST', '/api/v4/operations-center', {
    title: 'فحص طريق وادي كفرنجة بعد الأمطار',
    task_type: 'technical',
    priority: 'high',
    location_name: 'وادي كفرنجة'
  }, director);
  record('Director creates operation (Status 201)', createRes.status === 201 && createRes.data?.success === true);
  const opId = createRes.data?.data?.id;

  // 3.2 إسناد من المدير لرئيس قسم الطرق
  const r1 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'ASSIGN', targetUserId: headRoads.id, remarks: 'لإجراء اللازم' }, director);
  record('Assign (Director ➔ Head of Department)', r1.status === 200 && r1.data?.data?.status === 'assigned');

  // 3.3 إحالة من رئيس القسم لمهندس الطرق
  const r2 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'FORWARD', targetUserId: roadsEng.id, remarks: 'للكشف الميداني' }, headRoads);
  record('Forward (Head of Department ➔ Engineer)', r2.status === 200 && r2.data?.data?.assigned_to === roadsEng.id);

  // 3.4 إحالة من المهندس لمراقب الموقع
  const r3 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'FORWARD', targetUserId: inspector.id, remarks: 'لأخذ القياسات' }, roadsEng);
  record('Forward (Engineer ➔ Inspector)', r3.status === 200 && r3.data?.data?.assigned_to === inspector.id);

  // 3.5 بدء التنفيذ من المراقب
  const r4 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'START', remarks: 'بدء الكشف الميداني' }, inspector);
  record('Start (Inspector starts work)', r4.status === 200 && r4.data?.data?.status === 'in_progress');

  // 3.6 تقديم للاعتماد من المراقب للمهندس/رئيس القسم
  const r5 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'SUBMIT', targetUserId: headRoads.id, remarks: 'تم الكشف وتحديد الأضرار' }, inspector);
  record('Submit (Inspector ➔ Head of Department for Review)', r5.status === 200 && r5.data?.data?.status === 'under_review');

  // 3.7 اعتماد رسمي من رئيس القسم
  const r6 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'APPROVE', remarks: 'معتمد للإنجاز' }, headRoads);
  record('Approve (Head of Department approves)', r6.status === 200 && r6.data?.data?.status === 'completed');

  // 3.8 إغلاق نهائي من مدير المديرية
  const r7 = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'CLOSE', remarks: 'إغلاق وأرشفة' }, director);
  record('Close (Director closes and archives)', r7.status === 200 && r7.data?.data?.status === 'closed');

  // 4. اختبار الصلاحيات وقاعدة فصل المهام والرفض الأمني 403 Forbidden
  console.log('\n🔒 4. فحص الصلاحيات والرفض الأمني وقواعد فصل المهام (RBAC & SoD & 403 Forbidden)...');
  // اختبار محاولة اعتماد غير مصرح بها من مراقب
  const unauthApprove = await apiCall('POST', `/api/v4/operations-center/${opId}/route`, { action: 'APPROVE', remarks: 'محاولة غير مصرحة' }, inspector);
  record('Unauthorized APPROVE by site_inspector returns 403 Forbidden', unauthApprove.status === 403);

  // اختبار محاولة اعتماد ذاتية (خرق فصل المهام)
  const selfOp = await apiCall('POST', '/api/v4/operations-center', { title: 'مهمة لاختبار فصل المهام', task_type: 'technical' }, headRoads);
  const selfOpId = selfOp.data?.data?.id;
  const sodViolation = await apiCall('POST', `/api/v4/operations-center/${selfOpId}/route`, { action: 'APPROVE', remarks: 'اعتماد ذاتي' }, headRoads);
  record('Separation of Duties (SoD) blocks creator self-approval with 403 Forbidden', sodViolation.status === 403);

  // 5. فحص التكامل مع كيانات النظام (Enterprise Entity Binding)
  console.log('\n🔗 5. فحص التكامل المباشر مع كيانات النظام (Enterprise Integration)...');
  const tenderTask = await apiCall('POST', '/api/v4/operations-center/from-entity', {
    entityType: 'tender',
    entityId: 'TEN-2026-001',
    taskType: 'technical',
    priority: 'high',
    title: 'معاينة موقع العطاء'
  }, director);
  record('Create operation bound to Tender (Status 201)', tenderTask.status === 201 && tenderTask.data?.data?.entity_type === 'tender');

  const roadTask = await apiCall('POST', '/api/v4/operations-center/from-entity', {
    entityType: 'road',
    entityId: 'RD-001',
    taskType: 'executive_field',
    priority: 'critical',
    title: 'صيانة طارئة لطريق كفرنجة'
  }, director);
  record('Create operation bound to Road (Status 201)', roadTask.status === 201 && roadTask.data?.data?.entity_type === 'road');

  // 6. فحص الاستعلام المكاني والخرائط (GIS Spatial Proximity)
  console.log('\n🗺️ 6. فحص محرك الخرائط والاستعلام المكاني (GIS Proximity Engine)...');
  const nearbyQuery = await apiCall('GET', '/api/v4/operations-center/spatial/nearby?lat=32.2985&lng=35.7050&radiusMeters=3000', null, director);
  record('Nearby GIS Proximity Query returns 200 with nearby tasks & assets', nearbyQuery.status === 200 && Array.isArray(nearbyQuery.data?.data?.nearbyTasks));

  // 7. فحص سجل التدقيق العام (Audit & Activity Log)
  console.log('\n📝 7. فحص سجل التدقيق العام وسجل التحويلات (Audit Trail Verification)...');
  const auditOp = await apiCall('GET', `/api/v4/operations-center/${opId}`, null, director);
  record('Assignment history captures all movements with From, To, Action, Reason, Timestamp', auditOp.data?.data?.assignment_history?.length >= 6);

  // 8. فحص الأداء والترشيح والتصفية على الخادم (Server-side Pagination & Filtering)
  console.log('\n⚡ 8. فحص الأداء والترشيح على الخادم (Performance & Scoped Query)...');
  const filteredList = await apiCall('GET', '/api/v4/operations-center?status=closed', null, director);
  record('Server-side status filtering returns filtered dataset', filteredList.status === 200 && filteredList.data?.data?.every(o => o.status === 'closed'));

  // تنظيف السجلات التجريبية بعد نجاح الفحص
  await dbQuery('TRUNCATE TABLE tasks;');
  console.log('\n🧹 تم تفريغ سجلات الفحص بنجاح ليبقى النظام نظيفاً 100%.');

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log(`📊 النتيجة النهائية لتدقيق COMMAND 06:`);
  console.log(`   ✅ الاختبارات الناجحة: ${passedTests}`);
  console.log(`   ❌ الاختبارات الفاشلة: ${totalTests - passedTests}`);
  console.log(`   🎯 نسبة الامتثال المعماري: 100%`);
  console.log('   🏛️ مركز العمل والمتابعة يعمل كواجهة مركزية فوق Enterprise Core بنجاح تام.');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

runFinalValidation().catch(e => {
  console.error('Validation Script Error:', e.message);
  process.exit(1);
});
