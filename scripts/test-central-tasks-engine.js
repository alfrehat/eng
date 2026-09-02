/**
 * scripts/test-central-tasks-engine.js
 * 🧪 اختبار شامل لمنظومة ومحرك المهام والاستدعيات والأعمال الميدانية المركزية
 * مديرية الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
 */

const { initializeDatabase, isPostgresActive, memDb } = require('../utils/database');
const tasksEngineService = require('../services/tasksEngineService');

async function runTests() {
  console.log('🚀 بدء الفحص الشامل لمنظومة المهام والاستدعيات المركزية (TASKS_ENGINE)...');
  await initializeDatabase();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion Failed: ${message}`);
    }
  }

  try {
    // 1. فحص إنشاء مهمة جديدة والتوليد التلقائي للترقيم
    console.log('\n📌 1. اختبار إنشاء مهمة جديدة وترقيمها:');
    const user = { id: 'U-001', fullName: 'م. فراس القضاة', role: 'director_public_works' };
    const newTask = await tasksEngineService.createTask({
      title: 'كشف موقعي على هبوط إسفلتي شارع مستشفى الإيمان',
      description: 'معاينة الهبوط وتحديد الكميات اللازمة للترقيع وفحص خط تصريف المياه',
      task_type: 'executive_field',
      priority: 'high',
      assigned_to: 'U-002',
      location_name: 'شارع مستشفى الإيمان',
      lat: 32.2985,
      lng: 35.7061,
      entity_type: 'roads',
      entity_id: 'RD-001',
      entity_name: 'شارع مستشفى الإيمان الرئيسي'
    }, user);

    assert(newTask && newTask.id, 'تم إنشاء المهمة بنجاح واسترجاع المعرف');
    assert(newTask.task_number && newTask.task_number.startsWith('TSK-'), `الترقيم التلقائي يعمل بنجاح (${newTask.task_number})`);
    assert(newTask.status === 'assigned', 'تم تعيين الحالة تلقائياً إلى مسندة لوجود مكلف');

    // 2. فحص انتقال الحالات عبر Workflow
    console.log('\n🔄 2. اختبار دورة حياة المهمة وانتقالات الـ Workflow:');
    const started = await tasksEngineService.transitionStatus(newTask.id, 'in_progress', { id: 'U-002', fullName: 'م. أحمد العنانزة', role: 'head_of_roads' }, 'تم التحرك للموقع وبدء المعاينة');
    assert(started.status === 'in_progress', 'تم بدء تنفيذ المهمة وتغيير الحالة إلى in_progress');
    assert(started.approvals && started.approvals.length > 0, 'تم توثيق خطوة الانتقال في سجل الموافقات والتدقيق');

    // 3. فحص المهام الفرعية (Subtasks)
    console.log('\n☑️ 3. اختبار إدارة المهام الفرعية:');
    const withSubs = await tasksEngineService.updateSubtasks(newTask.id, [
      { title: 'مسح الموقع وقياس المساحة', completed: true },
      { title: 'حصر كميات الخلطة الإسفلتية', completed: true },
      { title: 'تنفيذ أعمال القشط والتعبيد', completed: false }
    ], user);
    assert(withSubs.subtasks.length === 3, 'تمت إضافة 3 مهام فرعية');
    assert(withSubs.subtasks[0].completed === true, 'تم تحديث حالة المهمة الفرعية الأولى إلى مكتملة');

    // 4. فحص رفع التقرير الميداني
    console.log('\n📝 4. اختبار التقرير الميداني والقياسات:');
    const withReport = await tasksEngineService.saveFieldReport(newTask.id, {
      completionPercentage: 100,
      laborAndMachinery: 'لودر، جيك همر، 4 عمال',
      materialsAndQuantities: 'خلطة إسفلتية ساخنة 35م2',
      fieldNotes: 'تمت معالجة الهبوط ودك الطبقات وفق المواصفات الهندسية'
    }, { id: 'U-002', fullName: 'م. أحمد العنانزة' });

    assert(withReport.field_report && withReport.field_report.completionPercentage === 100, 'تم تثبيت التقرير الميداني بنسبة إنجاز 100%');
    assert(withReport.status === 'under_review', 'تحولت المهمة تلقائياً إلى under_review بعد اكتمال التقرير');

    // 5. فحص الاعتماد والإغلاق النهائي من المدير
    console.log('\n🔒 5. اختبار اعتماد وإغلاق المهمة:');
    const closed = await tasksEngineService.transitionStatus(newTask.id, 'completed', user, 'تم التدقيق والمصادقة على الإنجاز');
    assert(closed.status === 'completed', 'تم اعتماد المهمة رسمياً وإكمالها');
    assert(closed.completed_at, 'تم تسجيل تاريخ وتوقيت الإنجاز الدقيق');

    // 6. فحص كاشف منع التكرار الذكي (Anti-Duplication Guard)
    console.log('\n🛡️ 6. اختبار منع التكرار الذكي:');
    // سننشئ مهمة أخرى مفتوحة أولاً
    const task2 = await tasksEngineService.createTask({
      title: 'إصلاح عطل إنارة حي نمر',
      task_type: 'emergency',
      priority: 'critical',
      location_name: 'حي نمر',
      lat: 32.2990,
      lng: 35.7070
    }, user);

    const dupCheck = await tasksEngineService.checkDuplicateTasks({
      location_name: 'حي نمر',
      lat: 32.2990,
      lng: 35.7070,
      task_type: 'emergency'
    });
    assert(dupCheck.hasDuplicates === true, 'تم كشف المهمة المشابهة في نفس الموقع بنجاح');

    // 7. فحص إحصائيات لوحة القيادة وحزمة Daily Board
    console.log('\n📊 7. اختبار إحصائيات لوحة القيادة والـ Daily Board:');
    const stats = await tasksEngineService.getStats();
    assert(stats.total > 0, `إجمالي المهام المحتسبة (${stats.total})`);
    assert(stats.onTimeRate !== undefined, `نسبة الالتزام بالـ SLA محتسبة بنجاح (${stats.onTimeRate}%)`);

    const board = await tasksEngineService.getDailyBoard();
    assert(board && Array.isArray(board.today), 'حزمة Daily Board تم تجميعها بنجاح');

    console.log(`\n🎉 اكتمل الفحص بنجاح تام: ${passedTests}/${totalTests} اختبارات ناجحة!`);
    process.exit(0);
  } catch (err) {
    console.error('\n💥 فشل الاختبار:', err.message);
    process.exit(1);
  }
}

runTests();
