/**
 * PavementReturns/API/pavingReturns.js
 * موجه محرك عوائد التعبيد والتحصيل المالي والتحققات البلدية (Paving Returns Engine v4.5)
 * مديرية الأشغال والخدمات الهندسية — بلدية كفرنجة الجديدة
 */

const express = require('express');
const router = express.Router();
const rbacManager = require('../../middlewares/rbacManager');
const { getPool, isPostgresActive, memDb, saveMemTable } = require('../../utils/database');

/**
 * دالة احتساب عوائد التعبيد للقطعة الواحدة تلقائياً وفق القانون البلدي:
 * المبلغ = طول الواجهة (م) × عرض التعبيد (م) × سعر المتر المربع (د.أ) × نسبة التحقق المفروضة
 */
function calculateRequiredAmount(length, width, price, rate) {
  const l = parseFloat(length) || 0;
  const w = parseFloat(width) || 0;
  const p = parseFloat(price) || 0;
  let r = parseFloat(rate) || 0;
  if (r > 1) r = r / 100;
  if (r <= 0) r = 1;
  return Number((l * w * p * r).toFixed(3));
}

// 1. استرجاع قائمة عوائد التعبيد مع التصفية والبحث الشامل
router.get('/', async (req, res, next) => {
  const { tenderId, search, pieceNumber, basinNumber, district, paymentStatus, startDate, endDate } = req.query;
  const pool = getPool();

  try {
    let rows = [];

    if (isPostgresActive() && pool) {
      try {
        let sql = `
          SELECT pr.*, 
                 COALESCE(pr.owner_name, 'مواطن / مكلف') as owner_name,
                 COALESCE(pr.street_name, 'شارع معبد') as street_name,
                 COALESCE(pr.national_id, '—') as national_id,
                 COALESCE(pr.paid_amount, 0) as paid_amount,
                 COALESCE(pr.payment_status, 'UNPAID') as payment_status,
                 COALESCE(pr.lat, ST_Y(pr.geom), 32.3301) as lat,
                 COALESCE(pr.lng, ST_X(pr.geom), 35.7501) as lng,
                 ST_AsGeoJSON(pr.geom) as geojson,
                 ST_AsGeoJSON(pr.geom) as geometry,
                 t.name as "tenderName", 
                 t.contractor as "tenderContractor"
          FROM public.paving_returns pr
          LEFT JOIN public.tenders t ON pr.tender_id = t.id
          WHERE 1=1
        `;
        const params = [];

        if (tenderId && tenderId !== 'all') {
          params.push(tenderId);
          sql += ` AND pr.tender_id = $${params.length}`;
        }
        if (pieceNumber) {
          params.push(`%${pieceNumber}%`);
          sql += ` AND pr.piece_number ILIKE $${params.length}`;
        }
        if (basinNumber) {
          params.push(`%${basinNumber}%`);
          sql += ` AND pr.basin_number ILIKE $${params.length}`;
        }
        if (district) {
          params.push(`%${district}%`);
          sql += ` AND pr.district ILIKE $${params.length}`;
        }
        if (paymentStatus && paymentStatus !== 'ALL') {
          params.push(paymentStatus);
          sql += ` AND pr.payment_status = $${params.length}`;
        }
        if (startDate) {
          params.push(startDate);
          sql += ` AND pr.created_at >= $${params.length}::timestamp`;
        }
        if (endDate) {
          params.push(`${endDate} 23:59:59`);
          sql += ` AND pr.created_at <= $${params.length}::timestamp`;
        }
        if (search) {
          params.push(`%${search}%`);
          sql += ` AND (pr.piece_number ILIKE $${params.length} 
                     OR pr.basin_number ILIKE $${params.length} 
                     OR pr.district ILIKE $${params.length} 
                     OR pr.owner_name ILIKE $${params.length} 
                     OR pr.id ILIKE $${params.length} 
                     OR t.name ILIKE $${params.length})`;
        }

        sql += ' ORDER BY pr.created_at DESC, pr.id DESC';
        const result = await pool.query(sql, params);
        rows = result.rows;
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL query failed, using memDb fallback:', pgErr.message);
      }
    }

    if (!rows.length && memDb.paving_returns) {
      rows = memDb.paving_returns;
    }

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. استرجاع سجل عوائد تعبيد محدد
router.get('/:id', async (req, res, next) => {
  const pool = getPool();

  try {
    let item = null;
    if (isPostgresActive() && pool) {
      try {
        const result = await pool.query(`
          SELECT pr.*, 
                 COALESCE(pr.lat, ST_Y(pr.geom), 32.3301) as lat,
                 COALESCE(pr.lng, ST_X(pr.geom), 35.7501) as lng,
                 ST_AsGeoJSON(pr.geom) as geojson,
                 ST_AsGeoJSON(pr.geom) as geometry,
                 t.name as "tenderName", 
                 t.contractor as "tenderContractor"
          FROM public.paving_returns pr
          LEFT JOIN public.tenders t ON pr.tender_id = t.id
          WHERE pr.id = $1
        `, [req.params.id]);
        item = result.rows[0];
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL get failed:', pgErr.message);
      }
    }

    if (!item && memDb.paving_returns) {
      item = memDb.paving_returns.find(r => String(r.id) === String(req.params.id));
    }

    if (!item) return res.status(404).json({ success: false, error: 'سجل عوائد التعبيد غير موجود' });
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// 3. إضافة سجل عوائد تعبيد جديد
router.post('/', async (req, res, next) => {
  const { 
    id, tenderId, pieceNumber, basinNumber, district, streetName, ownerName, nationalId,
    frontageLength, pavingWidth, pricePerMeter, impositionRate, notes, pieces, attachments,
    paidAmount, paymentStatus, receiptNumber, paymentDate, coordinates, lat, lng 
  } = req.body;

  let parsedPieces = [];
  if (Array.isArray(pieces) && pieces.length > 0) {
    parsedPieces = pieces.map(p => {
      const pLen = parseFloat(p.frontageLength || 0);
      const pWid = parseFloat(p.pavingWidth || 0);
      const pPrc = parseFloat(p.pricePerMeter || 0);
      const pRat = parseFloat(p.impositionRate || 1);
      const pAmt = calculateRequiredAmount(pLen, pWid, pPrc, pRat);
      return {
        pieceNumber: p.pieceNumber || pieceNumber || '',
        basinNumber: p.basinNumber || basinNumber || '',
        district: p.district || district || '',
        ownerName: p.ownerName || ownerName || '',
        nationalId: p.nationalId || nationalId || '',
        frontageLength: pLen,
        pavingWidth: pWid,
        pricePerMeter: pPrc,
        impositionRate: pRat,
        requiredAmount: pAmt,
        notes: p.notes || ''
      };
    });
  } else {
    const pLen = parseFloat(frontageLength || 0);
    const pWid = parseFloat(pavingWidth || 0);
    const pPrc = parseFloat(pricePerMeter || 0);
    const pRat = parseFloat(impositionRate || 1);
    const pAmt = calculateRequiredAmount(pLen, pWid, pPrc, pRat);
    parsedPieces.push({
      pieceNumber: pieceNumber || '1',
      basinNumber: basinNumber || '1',
      district: district || 'كفرنجة',
      ownerName: ownerName || 'مواطن / مكلف',
      nationalId: nationalId || '',
      frontageLength: pLen,
      pavingWidth: pWid,
      pricePerMeter: pPrc,
      impositionRate: pRat,
      requiredAmount: pAmt,
      notes: notes || ''
    });
  }

  let totalAmount = 0;
  let totalLength = 0;
  parsedPieces.forEach(p => {
    totalAmount += p.requiredAmount;
    totalLength += p.frontageLength;
  });

  const year = new Date().getFullYear();
  const recordId = id || `PR-${year}-${String(Date.now()).slice(-5)}`;
  const firstPiece = parsedPieces[0] || {};
  const latVal = parseFloat(lat || (coordinates && coordinates[0] ? coordinates[0][1] : 32.3301));
  const lngVal = parseFloat(lng || (coordinates && coordinates[0] ? coordinates[0][0] : 35.7501));
  const createdBy = req.user ? req.user.username || req.user.id : 'المستخدم';

  // ضمان وجود أعمدة الاعتمادات في جدول عوائد التعبيد
  const pool = getPool();
  if (isPostgresActive() && pool) {
    try {
      await pool.query(`
        ALTER TABLE public.paving_returns 
        ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS current_stage INT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS approval_history JSONB DEFAULT '[]'::jsonb;
      `);
    } catch (e) {}
  }

  const recordObj = {
    id: recordId,
    tender_id: tenderId || 'T-2026-001',
    piece_number: pieceNumber || firstPiece.pieceNumber || '',
    basin_number: basinNumber || firstPiece.basinNumber || '',
    district: district || firstPiece.district || 'كفرنجة',
    street_name: streetName || 'الشارع الرئيسي',
    owner_name: ownerName || firstPiece.ownerName || 'مواطن / مكلف',
    national_id: nationalId || firstPiece.nationalId || '',
    frontage_length: totalLength,
    paving_width: parseFloat(pavingWidth || firstPiece.pavingWidth || 6),
    price_per_meter: parseFloat(pricePerMeter || firstPiece.pricePerMeter || 4.5),
    imposition_rate: parseFloat(impositionRate || firstPiece.impositionRate || 0.5),
    required_amount: Number(totalAmount.toFixed(3)),
    paid_amount: parseFloat(paidAmount || 0),
    payment_status: paymentStatus || (parseFloat(paidAmount || 0) >= totalAmount ? 'PAID' : (parseFloat(paidAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID')),
    receipt_number: receiptNumber || null,
    payment_date: paymentDate || null,
    pieces: parsedPieces,
    attachments: attachments || [],
    lat: latVal,
    lng: lngVal,
    geojson: { type: 'Point', coordinates: [lngVal, latVal] },
    notes: notes || '',
    approval_status: req.body.approvalStatus || 'DRAFT',
    current_stage: parseInt(req.body.currentStage || 1, 10),
    approval_history: req.body.approvalHistory || [
      {
        stage: 'إعداد وتنظيم المعاملة',
        role: 'المهندس',
        action: 'SUBMITTED',
        by: createdBy,
        date: new Date().toISOString(),
        notes: notes || 'تم إدخال وتنظيم المعاملة وحساب الأطوال والمبالغ المفروضة'
      }
    ],
    status: req.body.approvalStatus === 'APPROVED' ? 'معتمد ومدرج بالسجلات' : 'قيد التدقيق والاعتماد',
    created_by: createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isPostgresActive() && pool) {
    try {
      await pool.query(`
        INSERT INTO public.paving_returns (
          id, tender_id, piece_number, basin_number, district, street_name, owner_name, national_id,
          frontage_length, paving_width, price_per_meter, imposition_rate, required_amount, paid_amount,
          payment_status, receipt_number, payment_date, pieces, attachments, notes, status, created_by,
          lat, lng, geom, approval_status, current_stage, approval_history, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20, $21, $22,
          $23, $24, ST_SetSRID(ST_MakePoint($24, $23), 4326), $25, $26, $27::jsonb, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          tender_id = EXCLUDED.tender_id,
          piece_number = EXCLUDED.piece_number,
          basin_number = EXCLUDED.basin_number,
          district = EXCLUDED.district,
          street_name = EXCLUDED.street_name,
          owner_name = EXCLUDED.owner_name,
          national_id = EXCLUDED.national_id,
          frontage_length = EXCLUDED.frontage_length,
          paving_width = EXCLUDED.paving_width,
          price_per_meter = EXCLUDED.price_per_meter,
          imposition_rate = EXCLUDED.imposition_rate,
          required_amount = EXCLUDED.required_amount,
          paid_amount = EXCLUDED.paid_amount,
          payment_status = EXCLUDED.payment_status,
          receipt_number = EXCLUDED.receipt_number,
          payment_date = EXCLUDED.payment_date,
          pieces = EXCLUDED.pieces,
          notes = EXCLUDED.notes,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          geom = EXCLUDED.geom,
          approval_status = EXCLUDED.approval_status,
          current_stage = EXCLUDED.current_stage,
          approval_history = EXCLUDED.approval_history,
          status = EXCLUDED.status,
          updated_at = NOW();
      `, [
        recordObj.id, recordObj.tender_id, recordObj.piece_number, recordObj.basin_number, recordObj.district,
        recordObj.street_name, recordObj.owner_name, recordObj.national_id, recordObj.frontage_length,
        recordObj.paving_width, recordObj.price_per_meter, recordObj.imposition_rate, recordObj.required_amount,
        recordObj.paid_amount, recordObj.payment_status, recordObj.receipt_number, recordObj.payment_date,
        JSON.stringify(recordObj.pieces), JSON.stringify(recordObj.attachments), recordObj.notes, recordObj.status,
        recordObj.created_by, latVal, lngVal, recordObj.approval_status, recordObj.current_stage, JSON.stringify(recordObj.approval_history)
      ]);
    } catch (pgErr) {
      console.warn('⚠️ PostgreSQL insert error in pavingReturns:', pgErr.message);
    }
  }

  res.status(201).json({ success: true, message: 'تم حفظ سجل عوائد التعبيد بنجاح', data: recordObj });
});

// 4. ترقية وتمرير المعاملة عبر مسار وسلسلة الاعتمادات (Workflow Approval Action)
router.post('/:id/advance-approval', async (req, res, next) => {
  const { id } = req.params;
  const { action, notes, approverName, approverRole } = req.body;
  const pool = getPool();

  try {
    if (isPostgresActive() && pool) {
      const getRes = await pool.query('SELECT * FROM public.paving_returns WHERE id = $1', [id]);
      if (!getRes.rows.length) return res.status(404).json({ success: false, error: 'المعاملة غير موجودة' });

      const row = getRes.rows[0];
      let history = Array.isArray(row.approval_history) ? row.approval_history : [];
      let newStatus = row.approval_status || 'DRAFT';
      let newStage = parseInt(row.current_stage || 1, 10);
      let statusLabel = row.status || 'مسودة';

      if (action === 'SUBMIT') {
        // المهندس يرسل إلى رئيس القسم
        newStatus = 'UNDER_REVIEW';
        newStage = 2;
        statusLabel = 'قيد التدقيق الهندسي';
        history.push({
          stage: 'إعداد وتنظيم المعاملة',
          role: 'المهندس',
          action: 'SUBMITTED',
          by: approverName || 'المهندس المنظم',
          date: new Date().toISOString(),
          notes: notes || 'تم تجهيز السجل وإحالته للتدقيق الميداني'
        });
      } else if (action === 'REVIEW_APPROVE') {
        // رئيس القسم يوافق ويحيل لمدير الأشغال
        newStatus = 'PENDING_DIRECTOR';
        newStage = 3;
        statusLabel = 'بانتظار مصادقة مدير الأشغال';
        history.push({
          stage: 'التدقيق الهندسي الميداني',
          role: 'رئيس القسم',
          action: 'REVIEWED',
          by: approverName || 'رئيس القسم',
          date: new Date().toISOString(),
          notes: notes || 'تمت المطابقة الميدانية والتدقيق الحسابي أصولاً'
        });
      } else if (action === 'FINAL_APPROVE') {
        // مدير الأشغال والخدمات الهندسية يعتمد نهائياً ويدرج في السجلات
        newStatus = 'APPROVED';
        newStage = 3;
        statusLabel = 'معتمد ومدرج في السجلات الرسمية';
        history.push({
          stage: 'الاعتماد والمصادقة الفنية',
          role: 'مدير الأشغال والخدمات الهندسية',
          action: 'APPROVED',
          by: approverName || 'مدير الأشغال والخدمات الهندسية',
          date: new Date().toISOString(),
          notes: notes || 'تم الاعتماد والمصادقة النهائية والإدراج في سجلات التحقق والتحصيل'
        });
      } else if (action === 'REJECT_RETURN') {
        // إعادة للتعديل
        newStatus = 'RETURNED';
        newStage = 1;
        statusLabel = 'معادة للتعديل الفني';
        history.push({
          stage: 'إعادة المعاملة',
          role: approverRole || 'المدقق',
          action: 'REJECTED',
          by: approverName || 'المدقق',
          date: new Date().toISOString(),
          notes: notes || 'تمت إعادة المعاملة للتعديل واستكمال النواقص'
        });
      }

      await pool.query(`
        UPDATE public.paving_returns 
        SET approval_status = $1, current_stage = $2, approval_history = $3::jsonb, status = $4, updated_at = NOW()
        WHERE id = $5
      `, [newStatus, newStage, JSON.stringify(history), statusLabel, id]);

      return res.json({
        success: true,
        message: 'تم تحديث مسار الاعتماد بنجاح',
        approval_status: newStatus,
        current_stage: newStage,
        status: statusLabel,
        approval_history: history
      });
    }
    res.json({ success: true, message: 'تم تحديث مسار الاعتماد' });
  } catch (err) {
    next(err);
  }
});

// 5. تسجيل دفعة مالية وسند قبض (فقط للمعاملات المعتمدة نهائياً)
router.post('/:id/payment', async (req, res, next) => {
  const { id } = req.params;
  const { paidAmount, receiptNumber, paymentDate } = req.body;
  const pAmt = parseFloat(paidAmount || 0);
  const pool = getPool();

  try {
    if (isPostgresActive() && pool) {
      const getRes = await pool.query('SELECT * FROM public.paving_returns WHERE id = $1', [id]);
      if (!getRes.rows.length) return res.status(404).json({ success: false, error: 'السجل غير موجود' });
      
      const row = getRes.rows[0];
      if (row.approval_status && row.approval_status !== 'APPROVED' && row.approval_status !== 'معتمد') {
        return res.status(400).json({
          success: false,
          error: '⚠️ لا يمكن تسجيل سند قبض أو تحصيل مالي لمعاملة لم تستكمل سلسلة الاعتمادات والمصادقة النهائية من مدير الأشغال.'
        });
      }

      const newPaid = (row.paid_amount || 0) + pAmt;
      const newStatus = newPaid >= (row.required_amount || 0) ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

      await pool.query(`
        UPDATE public.paving_returns 
        SET paid_amount = $1, payment_status = $2, receipt_number = $3, payment_date = $4, updated_at = NOW()
        WHERE id = $5
      `, [newPaid, newStatus, receiptNumber || `REC-${Date.now().toString().slice(-4)}`, paymentDate || new Date(), id]);

      return res.json({ success: true, message: 'تم قيد الدفعة وسند القبض بنجاح', paid_amount: newPaid, payment_status: newStatus });
    }
    res.json({ success: true, message: 'تم التحديث' });
  } catch (err) {
    next(err);
  }
});

// 6. حذف سجل عوائد تعبيد
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;
  const pool = getPool();

  try {
    if (isPostgresActive() && pool) {
      await pool.query('DELETE FROM public.paving_returns WHERE id = $1', [id]);
    }
    res.json({ success: true, message: 'تم حذف سجل عوائد التعبيد بنجاح' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
