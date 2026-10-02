/**
 * Projects/API/portfolioEngine.js
 * 📁 واجهات برمجة التطبيقات للمحافظ والخطط الهندسية (Project Portfolio & Planning REST API)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const express = require('express');
const projectPortfolioEngineService = require('../../services/projectPortfolioEngineService');
const rbacManager = require('../../middlewares/rbacManager');
const { requireAuth } = require('../../middlewares/authMiddleware');

const portfoliosRouter = express.Router();
const plansRouter = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ مسارات المحافظ الاستثمارية الرأسمالية (Portfolios API)
// ═══════════════════════════════════════════════════════════════════════════

// نقطة فحص الجاهزية التشغيلية (Health Probe)
portfoliosRouter.get('/health', async (req, res) => {
  const health = await projectPortfolioEngineService.healthCheck();
  res.status(health.healthy ? 200 : 503).json(health);
});

// استرجاع قائمة المحافظ
portfoliosRouter.get('/', requireAuth, rbacManager.requirePermission('PORTFOLIO.VIEW'), async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      departmentId: req.query.departmentId,
      search: req.query.search
    };
    const list = await projectPortfolioEngineService.getPortfolios(filters, req.user);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع مؤشرات الأداء المتكاملة لكافة المحافظ والخطط (Integrated Portfolio KPIs)
portfoliosRouter.get('/kpis/summary', requireAuth, rbacManager.requirePermission('PORTFOLIO.VIEW'), async (req, res) => {
  try {
    const filters = {
      departmentId: req.query.departmentId,
      status: req.query.status
    };
    const kpis = await projectPortfolioEngineService.getIntegratedPortfolioKPIs(filters);
    res.json({ success: true, data: kpis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع مؤشرات أداء محفظة محددة
portfoliosRouter.get('/:id/kpis', requireAuth, rbacManager.requirePermission('PORTFOLIO.VIEW'), async (req, res) => {
  try {
    const kpis = await projectPortfolioEngineService.getPortfolioKPIs(req.params.id);
    res.json({ success: true, data: kpis });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// استرجاع تفاصيل محفظة مع مشاريعها
portfoliosRouter.get('/:id', requireAuth, rbacManager.requirePermission('PORTFOLIO.VIEW'), async (req, res) => {
  try {
    const item = await projectPortfolioEngineService.getPortfolioById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'المحفظة غير موجودة.' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء محفظة جديدة
portfoliosRouter.post('/', requireAuth, rbacManager.requirePermission('PORTFOLIO.CREATE'), async (req, res) => {
  try {
    const created = await projectPortfolioEngineService.createPortfolio(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء المحفظة الرأسمالية بنجاح.',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تعديل محفظة
portfoliosRouter.put('/:id', requireAuth, rbacManager.requirePermission('PORTFOLIO.EDIT'), async (req, res) => {
  try {
    const updated = await projectPortfolioEngineService.updatePortfolio(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات المحفظة بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف محفظة
portfoliosRouter.delete('/:id', requireAuth, rbacManager.requirePermission('PORTFOLIO.DELETE'), async (req, res) => {
  try {
    const result = await projectPortfolioEngineService.deletePortfolio(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ربط مشروع بمحفظة
portfoliosRouter.post('/:id/projects', requireAuth, rbacManager.requirePermission(['PORTFOLIO.MANAGE', 'PORTFOLIO.EDIT']), async (req, res) => {
  try {
    const projectId = req.body.projectId || req.body.id;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'يجب تحديد معرف المشروع المراد ربطه.' });
    }
    const result = await projectPortfolioEngineService.addProjectToPortfolio(req.params.id, projectId, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إزالة مشروع من محفظة
portfoliosRouter.delete('/:id/projects/:projectId', requireAuth, rbacManager.requirePermission(['PORTFOLIO.MANAGE', 'PORTFOLIO.EDIT']), async (req, res) => {
  try {
    const result = await projectPortfolioEngineService.removeProjectFromPortfolio(req.params.id, req.params.projectId, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ مسارات الخطط الهندسية والسنوية (Plans API)
// ═══════════════════════════════════════════════════════════════════════════

// نقطة فحص الجاهزية التشغيلية (Health Probe)
plansRouter.get('/health', (req, res) => {
  res.json({ healthy: true, status: 'READY', engineId: 'PROJECT_PLANS' });
});

// استرجاع قائمة الخطط
plansRouter.get('/', requireAuth, rbacManager.requirePermission('PLAN.VIEW'), async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      planType: req.query.planType,
      year: req.query.year,
      search: req.query.search
    };
    const list = await projectPortfolioEngineService.getPlans(filters, req.user);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استرجاع تفاصيل خطة مع مشاريعها
plansRouter.get('/:id', requireAuth, rbacManager.requirePermission('PLAN.VIEW'), async (req, res) => {
  try {
    const item = await projectPortfolioEngineService.getPlanById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'الخطة غير موجودة.' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء خطة جديدة
plansRouter.post('/', requireAuth, rbacManager.requirePermission('PLAN.CREATE'), async (req, res) => {
  try {
    const created = await projectPortfolioEngineService.createPlan(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'تم إعداد وتوثيق الخطة بنجاح.',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تعديل خطة
plansRouter.put('/:id', requireAuth, rbacManager.requirePermission('PLAN.EDIT'), async (req, res) => {
  try {
    const updated = await projectPortfolioEngineService.updatePlan(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'تم تحديث بيانات الخطة بنجاح.',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف خطة
plansRouter.delete('/:id', requireAuth, rbacManager.requirePermission('PLAN.DELETE'), async (req, res) => {
  try {
    const result = await projectPortfolioEngineService.deletePlan(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة مشروع لخطة
plansRouter.post('/:id/projects', requireAuth, rbacManager.requirePermission(['PLAN.MANAGE', 'PLAN.EDIT']), async (req, res) => {
  try {
    const projectId = req.body.projectId || req.body.id;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'يجب تحديد معرف المشروع المراد ربطه بالخطة.' });
    }
    const result = await projectPortfolioEngineService.addProjectToPlan(req.params.id, projectId, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إزالة مشروع من خطة
plansRouter.delete('/:id/projects/:projectId', requireAuth, rbacManager.requirePermission(['PLAN.MANAGE', 'PLAN.EDIT']), async (req, res) => {
  try {
    const result = await projectPortfolioEngineService.removeProjectFromPlan(req.params.id, req.params.projectId, req.user);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = {
  portfoliosRouter,
  plansRouter
};
