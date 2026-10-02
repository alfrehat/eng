/**
 * Assets/API/assetsEngine.js
 * 🏛️ محول واجهات الأصول البلدية والإنشائية وشبكات البنية التحتية والإنارة وتصاريح الحفر (ASSETS_API_ADAPTER)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Anti-Gravity Enterprise Canonical Assets API Adapter
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/authMiddleware');
const rbacManager = require('../../middlewares/rbacManager');
const assetsEngineService = require('../../services/assetsEngineService');
const specializedAssetsEngine = require('../../services/specializedAssetsEngine');
const { logError } = require('../../services/loggerService');

// فحص الصلاحيات المرن المتوافق مع مصفوفة RBAC المؤسسية
const checkPerm = (permCode) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'يرجى تسجيل الدخول أولاً للمتابعة.' });
  }
  const isPrivileged = req.user.role === 'admin' || req.user.id === 'U-001' || req.user.role === 'director_public_works';
  if (isPrivileged) return next();

  if (rbacManager && typeof rbacManager.hasPermission === 'function') {
    if (rbacManager.hasPermission(req.user, permCode) || rbacManager.hasPermission(req.user, 'ASSETS.*')) {
      return next();
    }
  }
  return res.status(403).json({
    success: false,
    error: `⛔ 403 Forbidden: ليس لديك صلاحية [${permCode}] المطلوبة لتنفيذ هذا الإجراء الأصولي.`
  });
};

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

// ══════════════════════════════════════════════════════════════════════
// 0. ملخص الأصول البلدية الشامل (All Assets Summary)
// ══════════════════════════════════════════════════════════════════════
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const summaryData = await specializedAssetsEngine.getAssetsSummary();
    res.json({
      success: true,
      ...summaryData
    });
  } catch (err) {
    logError('AssetsEngineAPI', `Summary fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 1. الأبنية والجدران الاستنادية (Structural Assets)
// ══════════════════════════════════════════════════════════════════════
router.get('/structural', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const assets = await specializedAssetsEngine.getStructuralAssets(req.query);
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    logError('AssetsEngineAPI', `Structural fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/structural', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const assetObj = await specializedAssetsEngine.createStructuralAsset(req.body, req.user, clientIp);
    res.status(201).json({ success: true, data: assetObj });
  } catch (err) {
    logError('AssetsEngineAPI', `Structural create error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/structural/:id', requireAuth, checkPerm('ASSETS.DELETE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const result = await specializedAssetsEngine.deleteStructuralAsset(req.params.id, req.user, clientIp);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Structural delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2. شبكات البنية التحتية والمياه (Infrastructure Networks)
// ══════════════════════════════════════════════════════════════════════
router.get('/infrastructure', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const networks = await specializedAssetsEngine.getInfrastructureNetworks(req.query);
    res.json({ success: true, count: networks.length, data: networks });
  } catch (err) {
    logError('AssetsEngineAPI', `Infrastructure fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/infrastructure', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const netObj = await specializedAssetsEngine.createInfrastructureNetwork(req.body, req.user, clientIp);
    res.status(201).json({ success: true, data: netObj });
  } catch (err) {
    logError('AssetsEngineAPI', `Infrastructure create error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/infrastructure/:id', requireAuth, checkPerm('ASSETS.DELETE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const result = await specializedAssetsEngine.deleteInfrastructureNetwork(req.params.id, req.user, clientIp);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Infrastructure delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3. شبكات الإنارة والطاقة (Energy & Lighting)
// ══════════════════════════════════════════════════════════════════════
router.get('/energy', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const energyAssets = await specializedAssetsEngine.getEnergyAssets(req.query);
    res.json({ success: true, count: energyAssets.length, data: energyAssets });
  } catch (err) {
    logError('AssetsEngineAPI', `Energy fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/energy', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const energyObj = await specializedAssetsEngine.createEnergyAsset(req.body, req.user, clientIp);
    res.status(201).json({ success: true, data: energyObj });
  } catch (err) {
    logError('AssetsEngineAPI', `Energy create error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/energy/:id', requireAuth, checkPerm('ASSETS.DELETE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const result = await specializedAssetsEngine.deleteEnergyAsset(req.params.id, req.user, clientIp);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Energy delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4. تصاريح الحفر وتزويد الخدمات (Excavation Permits)
// ══════════════════════════════════════════════════════════════════════
router.get('/permits', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const permits = await specializedAssetsEngine.getExcavationPermits(req.query);
    res.json({ success: true, count: permits.length, data: permits });
  } catch (err) {
    logError('AssetsEngineAPI', `Permits fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/permits', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const permitObj = await specializedAssetsEngine.createExcavationPermit(req.body, req.user, clientIp);
    res.status(201).json({ success: true, data: permitObj });
  } catch (err) {
    logError('AssetsEngineAPI', `Permit create error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.post('/permits/:id/reinstate', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const result = await specializedAssetsEngine.reinstateExcavationPermit(req.params.id, req.body, req.user, clientIp);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Permit reinstate error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/permits/:id', requireAuth, checkPerm('ASSETS.DELETE'), async (req, res, next) => {
  try {
    const clientIp = getClientIp(req);
    const result = await specializedAssetsEngine.deleteExcavationPermit(req.params.id, req.user, clientIp);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Permit delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 5. الأصول البلدية الرأسمالية والآليات (Municipal Capital Assets)
// ══════════════════════════════════════════════════════════════════════
router.get('/municipal', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const assets = await assetsEngineService.getAssets(req.query);
    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal assets fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/municipal/stats', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const stats = await assetsEngineService.getAssetsStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal assets stats error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/municipal/:id', requireAuth, checkPerm('ASSETS.VIEW'), async (req, res, next) => {
  try {
    const asset = await assetsEngineService.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, error: `الأصل [${req.params.id}] غير موجود.` });
    }
    res.json({ success: true, data: asset });
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal asset fetch error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/municipal', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const asset = await assetsEngineService.createAsset(req.body, req.user);
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal asset create error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.put('/municipal/:id', requireAuth, checkPerm('ASSETS.EDIT'), async (req, res, next) => {
  try {
    const updated = await assetsEngineService.updateAsset(req.params.id, req.body, req.user);
    res.json({ success: true, data: updated });
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal asset update error: ${err.message}`);
    res.status(err.message.includes('DATABASE_WRITE_FAILED') ? 500 : 400).json({ success: false, error: err.message });
  }
});

router.delete('/municipal/:id', requireAuth, checkPerm('ASSETS.DELETE'), async (req, res, next) => {
  try {
    const result = await assetsEngineService.deleteAsset(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Municipal asset delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/municipal/:id/maintenance', requireAuth, checkPerm('ASSETS.CREATE'), async (req, res, next) => {
  try {
    const result = await assetsEngineService.recordMaintenanceExpense(req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) {
    logError('AssetsEngineAPI', `Maintenance expense error: ${err.message}`);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
