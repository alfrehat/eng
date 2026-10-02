/**
 * Contracts/API/contractManagementEngine.js
 * محرك وحدة إدارة العقود والضمانات البنكية المؤسسية (Enterprise Contract Management Engine)
 * API Adapter -> Primary Contract Engine (services/contractsEngineService.js) -> utils/database.js -> Canonical PostgreSQL Tables
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة v4.0 Enterprise
 *
 * المصدر القانوني والمعتمد الوحيد للعقود: public.contracts
 * الأوامر التغييرية الكنونية: public.contract_variation_orders
 * الكفالات البنكية الكنونية: public.bank_guarantees
 * البنود العقدية الكنونية: public.contract_clauses
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const rbacManager = require('../../middlewares/rbacManager');
const contractsEngineService = require('../../services/contractsEngineService');
const { generateOfficialContractHTML } = require('../../services/contractTemplateEngine');

const CONTRACT_UPLOADS_DIR = path.join(__dirname, '../../uploads/contracts');
if (!fs.existsSync(CONTRACT_UPLOADS_DIR)) {
  fs.mkdirSync(CONTRACT_UPLOADS_DIR, { recursive: true });
}

const contractStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CONTRACT_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'guarantee-' + uniqueSuffix + ext);
  }
});

const contractUpload = multer({
  storage: contractStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ==========================================
// 0. مسار رفع وثائق الكفالات والعقود الرسمية
// ==========================================
router.post('/upload', contractUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم استلام أي ملف' });
    }
    const fileUrl = `/uploads/contracts/${req.file.filename}`;
    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype,
        url: fileUrl,
        date: new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 1. العمليات الشرائية والبحث الذكي للتعبئة التلقائية (Procurement Auto-Populate)
// ==========================================

// 1.1 استعلام جميع العمليات الشرائية المتاحة
router.get('/procurements', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const procurements = await contractsEngineService.getProcurements();
    res.json({ success: true, count: procurements.length, data: procurements });
  } catch (err) { next(err); }
});

// 1.2 سحب التفاصيل الكاملة لعملية شرائية لتعبئة العقد إلكترونياً بالكامل
router.get('/procurement-details/:type/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { type, id } = req.params;
  try {
    const details = await contractsEngineService.getProcurementDetails(type, id);
    res.json({ success: true, data: details });
  } catch (err) { next(err); }
});

// ==========================================
// 2. إدارة أنواع العقود وقوالب النظام (Contract Types & Templates)
// ==========================================

router.get('/contract-types', async (req, res, next) => {
  try {
    const types = await contractsEngineService.getContractTypes();
    res.json({ success: true, count: types.length, data: types });
  } catch (err) { next(err); }
});

// ==========================================
// 2.5 مسارات ثابتة تُسجَّل قبل /:id لمنع الالتباس (Fixed Routes BEFORE /:id)
// ==========================================

// تنبيهات الكفالات البنكية (يجب أن تُسجَّل قبل /:id)
router.get('/guarantees/alerts', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const alerts = await contractsEngineService.getGuaranteesAlerts();
    res.json({ success: true, alerts });
  } catch (err) { next(err); }
});

// الإحصائيات التنفيذية (يجب أن تُسجَّل قبل /:id)
router.get('/analytics/kpis', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const kpis = await contractsEngineService.getKpis();
    res.json({ success: true, data: kpis });
  } catch (err) { next(err); }
});

// ==========================================
// 3. إدارة العقود الرئيسية (Contracts Main CRUD & Smart Search)
// ==========================================

// 3.1 البحث المتقدم والفلترة الشاملة لسجل العقود
router.get('/', rbacManager.verifyToken, async (req, res, next) => {
  try {
    const contracts = await contractsEngineService.getContracts(req.query);
    res.json({ success: true, count: contracts.length, data: contracts });
  } catch (err) { next(err); }
});

// 3.2 استعلام بيانات عقد محدد بالتفصيل
router.get('/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const contract = await contractsEngineService.getContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'العقد المطلوب غير موجود.' });
    }
    const clauses = await contractsEngineService.getClauses(contract.id);
    const guarantees = contract.bankGuarantees || contract.bank_guarantees || contract.guarantees_list || [];
    const variationOrders = contract.variationOrders || contract.variation_orders || contract.variation_orders_list || [];

    res.json({
      success: true,
      data: {
        ...contract,
        clauses,
        guarantees,
        variation_orders: variationOrders
      }
    });
  } catch (err) { next(err); }
});

// 3.3 حذف عقد نهائياً من النظام (خاص بمدير النظام وصاحب الصلاحية)
router.delete('/:id', rbacManager.verifyToken, rbacManager.requirePermission('CONTRACTS.DELETE'), async (req, res, next) => {
  const { id } = req.params;
  try {
    await contractsEngineService.deleteContract(id, req.user);
    res.json({ success: true, message: 'تم حذف العقد وكافة بنوده وكفالاته نهائياً من النظام بنجاح' });
  } catch (err) { next(err); }
});

// 3.4 إنشاء وتوثيق عقد جديد وحفظه في قاعدة البيانات
router.post('/', rbacManager.verifyToken, rbacManager.requirePermission('CONTRACTS.CREATE'), async (req, res, next) => {
  try {
    const contractObj = await contractsEngineService.createContract(req.body, req.user);
    res.status(201).json({ success: true, message: 'تم حفظ وتوثيق العقد في قاعدة البيانات بنجاح', data: contractObj });
  } catch (err) { next(err); }
});

// 3.5 تحديث بيانات العقد والكفالات المرفقة
router.put('/:id', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const updated = await contractsEngineService.updateContract(id, req.body, req.user);
    res.json({ success: true, message: 'تم تحديث بيانات العقد والكفالات بنجاح', data: updated });
  } catch (err) { next(err); }
});

// ==========================================
// 4. إدارة بنود العقد الحرة (Contract Clauses Editor & Reordering)
// ==========================================

router.get('/:id/clauses', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const clauses = await contractsEngineService.getClauses(id);
    res.json({ success: true, count: clauses.length, data: clauses });
  } catch (err) { next(err); }
});

router.post('/:id/clauses', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const clauseObj = await contractsEngineService.addClause(id, req.body, req.user);
    res.status(201).json({ success: true, data: clauseObj });
  } catch (err) { next(err); }
});

router.post('/:id/clauses/reorder', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await contractsEngineService.reorderClauses(id, req.body.clauseIds, req.user);
    res.json(result);
  } catch (err) { next(err); }
});

router.put('/:id/clauses/:clauseId', rbacManager.verifyToken, async (req, res, next) => {
  const { id, clauseId } = req.params;
  try {
    await contractsEngineService.updateClause(id, clauseId, req.body, req.user);
    const clauses = await contractsEngineService.getClauses(id);
    const updatedClause = clauses.find(c => String(c.id) === String(clauseId)) || null;
    res.json({ success: true, message: 'تم تحديث بيانات البند بنجاح', data: updatedClause });
  } catch (err) { next(err); }
});

router.post('/:id/clauses/:clauseId/duplicate', rbacManager.verifyToken, async (req, res, next) => {
  const { id, clauseId } = req.params;
  try {
    const duplicated = await contractsEngineService.duplicateClause(id, clauseId, req.user);
    res.json({ success: true, message: 'تم تكرار بند العقد بنجاح', data: duplicated });
  } catch (err) { next(err); }
});

router.delete('/:id/clauses/:clauseId', rbacManager.verifyToken, async (req, res, next) => {
  const { id, clauseId } = req.params;
  try {
    await contractsEngineService.deleteClause(id, clauseId, req.user);
    res.json({ success: true, message: 'تم حذف بند العقد بنجاح' });
  } catch (err) { next(err); }
});

// 4.5 تعديل نموذج العقد المخصص قبل الطباعة حسب الصلاحية الممنوحة
router.put('/:id/custom-template', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const allowedRoles = ['admin', 'director_public_works', 'head_of_roads', 'head_of_buildings', 'roads_engineer', 'buildings_engineer', 'quantity_surveyor'];
  const userRole = req.user && req.user.role ? String(req.user.role).toLowerCase() : 'admin';

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ success: false, error: 'غير مصرح لك بتعديل نموذج العقد قبل الطباعة. هذه الصلاحية مقتصرة على مديري الأشغال والمهندسين.' });
  }

  try {
    const responseData = await contractsEngineService.updateCustomTemplate(id, req.body, req.user);
    res.json({ success: true, message: 'تم حفظ وتخصيص نموذج العقد قبل الطباعة بنجاح', data: responseData });
  } catch (err) { next(err); }
});

// ==========================================
// 5. إدارة الكفالات البنكية (Bank Guarantees)
// ==========================================

router.post('/:id/guarantees', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const updatedContract = await contractsEngineService.addBankGuarantee(id, req.body, req.user);
    const bgs = updatedContract.bankGuarantees || updatedContract.bank_guarantees || [];
    const newG = bgs[bgs.length - 1] || req.body;
    res.status(201).json({ success: true, message: 'تم إضافة الكفالة البنكية بنجاح وتوليد رموز التحقق QR والباركود', data: newG });
  } catch (err) { next(err); }
});

router.post('/guarantees/:guaranteeId/:action', rbacManager.verifyToken, async (req, res, next) => {
  const { guaranteeId, action } = req.params;
  try {
    const result = await contractsEngineService.updateBankGuaranteeAction(guaranteeId, action, req.body, req.user);
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// 6. دورة حياة العقد والتوقيع التشفيري (Workflow & SHA-256 E-Signature)
// ==========================================

router.post('/:id/workflow', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { nextStatus, notes } = req.body;

  const ALLOWED_STAGES = [
    'DRAFT', 'REVIEW', 'LEGAL_AUDIT', 'MANAGER_APPROVAL',
    'PRESIDENT_APPROVAL', 'ELECTRONICALLY_SIGNED', 'ACTIVE',
    'AMENDMENT', 'EXTENSION', 'COMPLETED', 'RESCINDED', 'ARCHIVED'
  ];

  if (!ALLOWED_STAGES.includes(nextStatus)) {
    return res.status(400).json({ success: false, error: 'مرحلة الاعتماد غير معرفة داخل المحرك.' });
  }

  try {
    await contractsEngineService.transitionWorkflow(id, {
      status: nextStatus,
      approval_stage: nextStatus,
      notes: notes || ''
    }, req.user);
    res.json({ success: true, message: `تم تحديث حالة العقد إلى (${nextStatus}) بنجاح`, newStatus: nextStatus });
  } catch (err) { next(err); }
});

router.post('/:id/sign', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { party, signerName, signatureImage, sealImage } = req.body;

  try {
    const contract = await contractsEngineService.getContractById(id);
    if (!contract) {
      return res.status(404).json({ success: false, error: 'العقد غير موجود.' });
    }

    const dataToHash = `${contract.id}|${contract.total_value}|${contract.contractor_name}|${new Date().toISOString()}`;
    const signatureHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    let existingSignatures = {};
    try {
      existingSignatures = typeof contract.digital_signatures === 'string'
        ? JSON.parse(contract.digital_signatures || '{}')
        : (contract.digital_signatures || {});
    } catch (e) {}

    existingSignatures[party || 'first_party'] = {
      signer_name: signerName || (party === 'first_party' ? 'رئيس بلدية كفرنجة الجديدة' : contract.contractor_name),
      signature_image: signatureImage || '',
      seal_image: sealImage || '',
      hash: signatureHash,
      signed_at: new Date().toISOString()
    };

    await contractsEngineService.updateContract(id, {
      digital_signatures: existingSignatures,
      sha256_hash: signatureHash,
      status: 'ELECTRONICALLY_SIGNED'
    }, req.user);

    res.json({
      success: true,
      message: 'تم إتمام التوقيع الإلكتروني والتثبيت التشفيري للعقد بنجاح',
      sha256_hash: signatureHash,
      signatures: existingSignatures
    });
  } catch (err) { next(err); }
});

// تمديد الكفالة البنكية وتحديث تاريخ الانتهاء
router.post('/:id/guarantee/extend', rbacManager.verifyToken, rbacManager.requirePermission(['GUARANTEES.MANAGE', 'CONTRACTS.EDIT']), async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await contractsEngineService.extendContractGuarantee(id, req.body, req.user);
    res.json(result);
  } catch (err) { next(err); }
});

// ==========================================
// 7. أوامر التغيير والتعديل المالي والزمني (Variation Orders Engine with 25% Legal Cap)
// ==========================================

router.get('/:id/variation-orders', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const contract = await contractsEngineService.getContractById(id);
    const orders = await contractsEngineService.getVariationOrders(id);

    const contractVal = parseFloat(contract?.total_value || contract?.contract_value || 100000);
    const totalIncrease = orders.filter(o => o.order_type === 'VALUE_INCREASE').reduce((s, o) => s + parseFloat(o.amount || o.amount_change || 0), 0);
    const totalDecrease = orders.filter(o => o.order_type === 'VALUE_DECREASE').reduce((s, o) => s + parseFloat(o.amount || o.amount_change || 0), 0);
    const netVariation = totalIncrease - totalDecrease;
    const variationPercentage = contractVal > 0 ? (netVariation / contractVal) * 100 : 0;

    res.json({
      success: true,
      count: orders.length,
      original_contract_value: contractVal,
      net_variation_value: netVariation,
      variation_percentage: Math.round(variationPercentage * 100) / 100,
      legal_cap_percentage: 25,
      is_within_legal_cap: variationPercentage <= 25,
      data: orders
    });
  } catch (err) { next(err); }
});

router.post('/:id/variation-orders', rbacManager.verifyToken, rbacManager.requirePermission(['CONTRACTS.EDIT', 'CONTRACTS.CREATE']), async (req, res, next) => {
  const { id } = req.params;
  const { orderType, amountChange, timeExtensionDays, reason, approvedBy } = req.body;

  try {
    const amt = parseFloat(amountChange || 0);
    const days = parseInt(timeExtensionDays || 0);

    const updated = await contractsEngineService.addVariationOrder(id, {
      title: reason || 'أمر تغييري',
      amount: amt,
      orderType: orderType || (amt >= 0 ? 'VALUE_INCREASE' : 'VALUE_DECREASE'),
      extensionDays: days,
      description: reason || '',
      approved_by: approvedBy
    }, req.user);

    const vos = updated?.variationOrders || updated?.variation_orders || [];
    const voObj = vos[vos.length - 1] || {};
    const exceedsLegalCap = voObj.isExceedingLimit || false;

    res.status(201).json({
      success: true,
      message: exceedsLegalCap 
        ? '⚠️ تم تسجيل أمر التغيير بنجاح (مع تسجيل تنبيه لتجاوز السقف القانوني 25%)'
        : '✅ تم حفظ أمر التغيير وتحديث القيمة التعاقدية ومدة التنفيذ بنجاح',
      data: voObj
    });
  } catch (err) { next(err); }
});

// ==========================================
// 8. محرك الطباعة والتصدير لاتفاقية تنفيذ الأعمال (Print & Export Engine)
// ==========================================

router.get('/:id/print', rbacManager.verifyToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const contract = await contractsEngineService.getContractById(id);
    if (!contract) {
      return res.status(404).send('<h2 style="text-align:center;font-family:sans-serif;">العقد غير موجود</h2>');
    }
    const clauses = await contractsEngineService.getClauses(contract.id);

    const marginTop = parseFloat(req.query.mt || '1.0');
    const marginBottom = parseFloat(req.query.mb || '0.7');
    const marginRight = parseFloat(req.query.mr || '0.7');
    const marginLeft = parseFloat(req.query.ml || '0.7');

    const htmlContent = generateOfficialContractHTML(contract, clauses, { municipality_name: 'بلدية كفرنجة الجديدة', logo_path: '/logo.jpg' });

    const fullPrintHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>طباعة اتفاقية تنفيذ أعمال - ${contract.contract_number || contract.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style id="page-margins-style">
          @page {
            size: A4 portrait;
            margin: ${marginTop}cm ${marginRight}cm ${marginBottom}cm ${marginLeft}cm;
          }
        </style>
        <style>
          * { box-sizing: border-box; }
          body {
            background: #cbd5e1;
            padding: 20px 0;
            margin: 0;
            font-family: 'Cairo', 'Tajawal', 'Amiri', serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-contract-document {
            max-width: 820px;
            margin: 0 auto;
            background: white;
            display: block;
            visibility: visible;
            opacity: 1;
          }
          @media print {
            html, body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              font-size: 12pt !important;
            }
            .no-print {
              display: none !important;
            }
            .official-contract-document,
            .official-contract-document * {
              visibility: visible !important;
              display: revert !important;
              opacity: 1 !important;
            }
            .official-contract-document {
              display: block !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 10px !important;
              width: 100% !important;
              max-width: 100% !important;
              border-radius: 0 !important;
              position: static !important;
              overflow: visible !important;
            }
            .legal-clause-block { page-break-inside: avoid; break-inside: avoid; }
            .legal-signatures-block { page-break-inside: avoid; break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="max-width:850px; margin:0 auto 16px auto; background:linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color:white; padding:16px 22px; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:'Cairo',sans-serif; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <strong style="font-size:1.1rem;">📜 معاينة وإعدادات طباعة الاتفاقية الرسمية</strong>
              <p style="margin:2px 0 0 0; font-size:0.83rem; opacity:0.88;">الهوامش القياسية المعتمَدة: الأعلى ${marginTop} سم، اليمين واليسار والأسفل ${marginBottom} سم (قابلة للتعديل)</p>
            </div>
            <button type="button" onclick="triggerPrintNow()" style="background:#0d9488; color:white; border:none; padding:10px 22px; border-radius:6px; font-weight:bold; cursor:pointer; font-family:'Cairo',sans-serif; display:flex; align-items:center; gap:6px; font-size:0.95rem;">
              <span>🖨️ طباعة المستند الآن (A4)</span>
            </button>
          </div>

          <div style="display:flex; gap:14px; align-items:center; background:rgba(255,255,255,0.12); padding:10px 14px; border-radius:8px; flex-wrap:wrap; font-size:0.88rem;">
            <span style="font-weight:bold; color:#fef3c7;">⚙️ التحكم التفاعلي بهوامش الصفحة (سم):</span>
            <label style="display:flex; align-items:center; gap:4px;">الأعلى: <input type="number" id="m-top" value="${marginTop}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">الأسفل: <input type="number" id="m-bottom" value="${marginBottom}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">اليمين: <input type="number" id="m-right" value="${marginRight}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <label style="display:flex; align-items:center; gap:4px;">اليسار: <input type="number" id="m-left" value="${marginLeft}" step="0.1" min="0" style="width:58px; padding:4px; border-radius:4px; border:none; text-align:center; font-weight:bold;" onchange="updateMarginsLive()" /></label>
            <button type="button" onclick="resetDefaultMargins()" style="background:rgba(255,255,255,0.22); color:white; border:none; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-family:'Cairo',sans-serif;">🔄 اعادة الهوامش القياسية (1.0 / 0.7)</button>
          </div>
        </div>

        ${htmlContent}

        <script>
          function triggerPrintNow() {
            window.focus();
            setTimeout(function() { window.print(); }, 100);
          }

          function applyMargins(top, bottom, right, left) {
            var styleEl = document.getElementById('page-margins-style');
            if (styleEl) {
              styleEl.textContent = '@page { size: A4 portrait; margin: ' + top + 'cm ' + right + 'cm ' + bottom + 'cm ' + left + 'cm; }';
            }
          }

          function updateMarginsLive() {
            var top = document.getElementById('m-top').value || '1.0';
            var bottom = document.getElementById('m-bottom').value || '0.7';
            var right = document.getElementById('m-right').value || '0.7';
            var left = document.getElementById('m-left').value || '0.7';
            applyMargins(top, bottom, right, left);
          }
        </script>
      </body>
      </html>
    `;

    res.send(fullPrintHtml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
