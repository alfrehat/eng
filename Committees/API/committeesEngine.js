/**
 * Committees/API/committeesEngine.js
 * محرك تقارير اللجان الفنية ومحاضر الاستلام ودراسة العطاءات
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');
const { dbQuery, dbGet, dbRun, isPostgresActive, getPool, memDb } = require('../../utils/database');

const jsonPath = path.join(__dirname, '../../database/committee_reports.json');
const studiesJsonPath = path.join(__dirname, '../../database/tender_studies.json');

function getLocalReports() {
  try {
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error reading committee_reports.json:', e);
  }
  return [];
}

function saveLocalReports(list) {
  try {
    const dir = path.dirname(jsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2), 'utf8');
    if (memDb) memDb['committee_reports'] = list;
    return true;
  } catch (e) {
    console.error('Error saving committee_reports.json:', e);
    return false;
  }
}

function getLocalStudies() {
  try {
    if (fs.existsSync(studiesJsonPath)) {
      const data = fs.readFileSync(studiesJsonPath, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error reading tender_studies.json:', e);
  }
  return [];
}

function saveLocalStudies(list) {
  try {
    const dir = path.dirname(studiesJsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(studiesJsonPath, JSON.stringify(list, null, 2), 'utf8');
    if (memDb) memDb['tender_studies'] = list;
    return true;
  } catch (e) {
    console.error('Error saving tender_studies.json:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /stats - Analytics & Committee KPIs
// ─────────────────────────────────────────────────────────────────────────────
router.get(['/stats', '/analytics'], async (req, res) => {
  try {
    const reports = getLocalReports();
    const studies = getLocalStudies();
    const total = reports.length;

    let initialHandover = 0;
    let finalHandover = 0;
    let technicalAudits = 0;
    let punchListCount = 0;
    let approvedCount = 0;
    let membersAssignedSet = new Set();

    reports.forEach(r => {
      if (r.report_type === 'INITIAL_HANDOVER') initialHandover++;
      else if (r.report_type === 'FINAL_HANDOVER') finalHandover++;
      else technicalAudits++;

      if (r.status === 'APPROVED') approvedCount++;
      if (Array.isArray(r.punch_list) && r.punch_list.some(p => p.status !== 'COMPLETED')) {
        punchListCount++;
      }

      if (Array.isArray(r.committee_members)) {
        r.committee_members.forEach(m => {
          if (m.name) membersAssignedSet.add(m.name);
        });
      }
    });

    let totalBidsCount = 0;
    let awardedStudies = 0;
    studies.forEach(s => {
      if (s.status === 'RECOMMENDED_AWARD' || s.status === 'AWARDED') awardedStudies++;
      if (Array.isArray(s.bids)) totalBidsCount += s.bids.length;
      if (Array.isArray(s.committee_members)) {
        s.committee_members.forEach(m => {
          if (m.name) membersAssignedSet.add(m.name);
        });
      }
    });

    res.json({
      success: true,
      stats: {
        total,
        initialHandover,
        finalHandover,
        technicalAudits,
        punchListCount,
        approvedCount,
        totalMembersAssigned: membersAssignedSet.size,
        totalStudies: studies.length,
        awardedStudies,
        totalBidsCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب إحصائيات اللجان', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /users-list - Available Staff & Engineers for Committee Assignment
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users-list', async (req, res) => {
  try {
    let users = [];
    try {
      const dbUsers = await dbQuery('SELECT id, username, "fullName", role FROM users');
      if (dbUsers && dbUsers.length > 0) {
        users = dbUsers.map(u => ({
          id: u.id,
          name: u.fullName || u.username,
          role: u.role === 'admin' ? 'مدير النظام' : (u.role === 'engineer' ? 'مهندس مشاريع' : 'موظف فني'),
          department: 'مديرية الأشغال والخدمات الهندسية'
        }));
      }
    } catch (e) {}

    if (!users.length) {
      const usersJson = path.join(__dirname, '../../database/users.json');
      if (fs.existsSync(usersJson)) {
        const local = JSON.parse(fs.readFileSync(usersJson, 'utf8') || '[]');
        users = local.map(u => ({
          id: u.id,
          name: u.fullName || u.name || u.username,
          role: u.role || 'عضو لجنة',
          department: 'مديرية الأشغال والخدمات الهندسية'
        }));
      }
    }

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TENDER STUDIES ENDPOINTS (لجان دراسة العطاءات وتقييم العروض)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/studies', async (req, res) => {
  try {
    const { search, status, tenderId } = req.query;
    let list = getLocalStudies();

    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => 
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.report_number && s.report_number.toLowerCase().includes(q)) ||
        (s.tender_name && s.tender_name.toLowerCase().includes(q)) ||
        (s.formation_order_number && s.formation_order_number.toLowerCase().includes(q)) ||
        (Array.isArray(s.bids) && s.bids.some(b => b.contractor && b.contractor.toLowerCase().includes(q))) ||
        (Array.isArray(s.committee_members) && s.committee_members.some(m => m.name && m.name.toLowerCase().includes(q)))
      );
    }

    if (status) {
      list = list.filter(s => s.status === status);
    }

    if (tenderId) {
      list = list.filter(s => s.tender_id === tenderId);
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب محاضر دراسة العطاءات', details: err.message });
  }
});

router.get('/studies/:id', async (req, res) => {
  try {
    const list = getLocalStudies();
    const item = list.find(s => String(s.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'المحضر غير موجود' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/studies', async (req, res) => {
  try {
    const list = getLocalStudies();
    const body = req.body;
    const year = new Date().getFullYear();
    const nextNum = list.length + 1;
    const id = `TS-${year}-${String(nextNum).padStart(3, '0')}`;
    const report_number = body.report_number || `ع/در/${year}/${String(nextNum).padStart(2, '0')}`;

    let tender_name = body.tender_name || '';
    let estimated_cost = body.estimated_cost || 0;

    if (body.tender_id && !tender_name) {
      try {
        const tender = await dbGet(`SELECT * FROM tenders WHERE id = '${body.tender_id}'`);
        if (tender) {
          tender_name = tender.name || tender.title || tender_name;
          estimated_cost = tender.value || tender.budget || estimated_cost;
        }
      } catch (e) {}
    }

    const newStudy = {
      id,
      report_number,
      title: body.title || `محضر دراسة وتقييم عروض - ${tender_name || id}`,
      tender_id: body.tender_id || '',
      tender_name: tender_name || 'عطاء مشاريع هندسية',
      estimated_cost: Number(estimated_cost) || 0,
      formation_order_number: body.formation_order_number || `ت/أش/${year}/${nextNum + 100}`,
      formation_order_date: body.formation_order_date || new Date().toISOString().split('T')[0],
      session_date: body.session_date || new Date().toISOString().split('T')[0],
      opening_session_number: body.opening_session_number || `ج/ف/${year}/${nextNum}`,
      status: body.status || 'RECOMMENDED_AWARD',
      bids: Array.isArray(body.bids) ? body.bids : [],
      recommendation: body.recommendation || 'قررت اللجنة التنسيب بإحالة العطاء على العرض الأنسب والأقل سعراً المطابق للشروط والمواصفات.',
      committee_members: Array.isArray(body.committee_members) ? body.committee_members : [],
      created_by: req.user?.fullName || 'مدير النظام',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    list.unshift(newStudy);
    saveLocalStudies(list);

    res.status(201).json({
      success: true,
      message: 'تم حفظ محضر دراسة وتقييم عروض العطاء بنجاح',
      study: newStudy
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل حفظ محضر الدراسة', details: err.message });
  }
});

router.put('/studies/:id', async (req, res) => {
  try {
    const list = getLocalStudies();
    const idx = list.findIndex(s => String(s.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'المحضر غير موجود' });

    const current = list[idx];
    const b = req.body;

    list[idx] = {
      ...current,
      title: b.title || current.title,
      report_number: b.report_number || current.report_number,
      tender_id: b.tender_id !== undefined ? b.tender_id : current.tender_id,
      tender_name: b.tender_name || current.tender_name,
      estimated_cost: b.estimated_cost !== undefined ? Number(b.estimated_cost) : current.estimated_cost,
      formation_order_number: b.formation_order_number || current.formation_order_number,
      formation_order_date: b.formation_order_date || current.formation_order_date,
      session_date: b.session_date || current.session_date,
      opening_session_number: b.opening_session_number || current.opening_session_number,
      status: b.status || current.status,
      bids: Array.isArray(b.bids) ? b.bids : current.bids,
      recommendation: b.recommendation || current.recommendation,
      committee_members: Array.isArray(b.committee_members) ? b.committee_members : current.committee_members,
      updated_at: new Date().toISOString()
    };

    saveLocalStudies(list);

    res.json({
      success: true,
      message: 'تم تحديث محضر دراسة العطاء بنجاح',
      study: list[idx]
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل التحديث', details: err.message });
  }
});

router.delete('/studies/:id', async (req, res) => {
  try {
    let list = getLocalStudies();
    const exists = list.some(s => String(s.id) === String(req.params.id));
    if (!exists) return res.status(404).json({ error: 'المحضر غير موجود' });

    list = list.filter(s => String(s.id) !== String(req.params.id));
    saveLocalStudies(list);

    res.json({ success: true, message: 'تم حذف محضر دراسة العطاء بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل الحذف', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. HANDOVER REPORTS ENDPOINTS (محاضر الاستلام الفني)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, type, status, tenderId, year } = req.query;
    let list = getLocalReports();

    if (search) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => 
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.report_number && r.report_number.toLowerCase().includes(q)) ||
        (r.tender_name && r.tender_name.toLowerCase().includes(q)) ||
        (r.contractor && r.contractor.toLowerCase().includes(q)) ||
        (r.formation_order_number && r.formation_order_number.toLowerCase().includes(q)) ||
        (Array.isArray(r.committee_members) && r.committee_members.some(m => m.name && m.name.toLowerCase().includes(q)))
      );
    }

    if (type) {
      list = list.filter(r => r.report_type === type);
    }

    if (status) {
      list = list.filter(r => r.status === status);
    }

    if (tenderId) {
      list = list.filter(r => r.tender_id === tenderId);
    }

    if (year) {
      list = list.filter(r => (r.inspection_date && r.inspection_date.startsWith(year)) || (r.created_at && r.created_at.startsWith(year)));
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب تقارير اللجان', details: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const list = getLocalReports();
    const report = list.find(r => String(r.id) === String(req.params.id));
    if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const list = getLocalReports();
    const body = req.body;
    const year = new Date().getFullYear();
    const nextNum = list.length + 1;
    const id = `COM-${year}-${String(nextNum).padStart(3, '0')}`;
    const report_number = body.report_number || `لج/${year}/${String(nextNum).padStart(2, '0')}`;

    let tender_name = body.tender_name || '';
    let contractor = body.contractor || '';
    let project_cost = body.project_cost || 0;

    if (body.tender_id && (!tender_name || !contractor)) {
      try {
        const tender = await dbGet(`SELECT * FROM tenders WHERE id = '${body.tender_id}'`);
        if (tender) {
          tender_name = tender.name || tender.title || tender_name;
          contractor = tender.contractor || contractor;
          project_cost = tender.value || tender.budget || project_cost;
        }
      } catch (e) {}
    }

    const newReport = {
      id,
      report_number,
      title: body.title || `محضر استلام لجنة فنية - ${tender_name || id}`,
      report_type: body.report_type || 'INITIAL_HANDOVER',
      tender_id: body.tender_id || '',
      tender_name: tender_name || 'عطاء مشاريع هندسية',
      contractor: contractor || 'المقاول المعتمد',
      project_cost: Number(project_cost) || 0,
      formation_order_number: body.formation_order_number || `ت/أش/${year}/${nextNum + 100}`,
      formation_order_date: body.formation_order_date || new Date().toISOString().split('T')[0],
      inspection_date: body.inspection_date || new Date().toISOString().split('T')[0],
      status: body.status || 'APPROVED',
      completion_percentage: Number(body.completion_percentage) || 100,
      recommendation: body.recommendation || 'قررت اللجنة الفنية الاستلام والمطابقة الفنية للأعمال المنجزة وفق الشروط والمواصفات.',
      committee_members: Array.isArray(body.committee_members) ? body.committee_members : [],
      punch_list: Array.isArray(body.punch_list) ? body.punch_list : [],
      lab_tests: body.lab_tests || 'فحوصات وضبط جودة معتمدة ومطابقة للكود الأردني',
      guarantee_period_months: Number(body.guarantee_period_months) || 12,
      guarantee_end_date: body.guarantee_end_date || '',
      notes: body.notes || '',
      created_by: req.user?.fullName || 'مدير النظام',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    list.unshift(newReport);
    saveLocalReports(list);

    res.status(201).json({
      success: true,
      message: 'تم تنظيم واعتماد تقرير اللجنة الفنية ومحضر الاستلام بنجاح',
      report: newReport
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل حفظ تقرير اللجنة', details: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const list = getLocalReports();
    const idx = list.findIndex(r => String(r.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'التقرير غير موجود' });

    const current = list[idx];
    const b = req.body;

    list[idx] = {
      ...current,
      title: b.title || current.title,
      report_number: b.report_number || current.report_number,
      report_type: b.report_type || current.report_type,
      tender_id: b.tender_id !== undefined ? b.tender_id : current.tender_id,
      tender_name: b.tender_name || current.tender_name,
      contractor: b.contractor || current.contractor,
      project_cost: b.project_cost !== undefined ? Number(b.project_cost) : current.project_cost,
      formation_order_number: b.formation_order_number || current.formation_order_number,
      formation_order_date: b.formation_order_date || current.formation_order_date,
      inspection_date: b.inspection_date || current.inspection_date,
      status: b.status || current.status,
      completion_percentage: b.completion_percentage !== undefined ? Number(b.completion_percentage) : current.completion_percentage,
      recommendation: b.recommendation || current.recommendation,
      committee_members: Array.isArray(b.committee_members) ? b.committee_members : current.committee_members,
      punch_list: Array.isArray(b.punch_list) ? b.punch_list : current.punch_list,
      lab_tests: b.lab_tests !== undefined ? b.lab_tests : current.lab_tests,
      guarantee_period_months: b.guarantee_period_months !== undefined ? Number(b.guarantee_period_months) : current.guarantee_period_months,
      guarantee_end_date: b.guarantee_end_date || current.guarantee_end_date,
      notes: b.notes !== undefined ? b.notes : current.notes,
      updated_at: new Date().toISOString()
    };

    saveLocalReports(list);

    res.json({
      success: true,
      message: 'تم تحديث بيانات ومحضر اللجنة بنجاح',
      report: list[idx]
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل التعديل', details: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    let list = getLocalReports();
    const exists = list.some(r => String(r.id) === String(req.params.id));
    if (!exists) return res.status(404).json({ error: 'التقرير غير موجود' });

    list = list.filter(r => String(r.id) !== String(req.params.id));
    saveLocalReports(list);

    res.json({ success: true, message: 'تم حذف تقرير اللجنة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل الحذف', details: err.message });
  }
});

module.exports = router;
