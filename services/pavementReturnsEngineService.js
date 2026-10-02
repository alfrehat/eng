/**
 * services/pavementReturnsEngineService.js
 * 🏗️ محرك حساب وتحصيل عوائد التعبيد والتحققات البلدية (PAVEMENT_RETURNS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v4.0 - Enterprise Canonical Pavement Returns Engine
 */

'use strict';

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  withTransaction,
  memDb,
  saveMemTable
} = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class PavementReturnsEngineService {
  constructor() {
    this.engineId = 'PAVEMENT_RETURNS_ENGINE';
    this.engineName = 'Enterprise Pavement Returns & Municipal Revenue Engine';
    this.version = '4.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'paving_returns_calculation',
      'returns_crud',
      'revenue_collection',
      'basin_parcel_tracking',
      'financial_reconciliation',
      'payment_installments_history',
      'workflow_approval_lifecycle',
      'spatial_gis_mapping'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي الموحد
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء عوائد التعبيد [${action}] على المعاملة [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      if (typeof recordFn === 'function') {
        await recordFn({
          userId: userId || 'SYSTEM',
          action,
          entity: 'عوائد التعبيد والتحققات',
          entityId: String(entityId),
          details,
          ip
        });
      }
    } catch (e) {
      logWarn('PavementReturnsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ خوارزمية احتساب عوائد التعبيد القانونية (Calculation Algorithm)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * احتساب قيمة عوائد التعبيد للقطعة وفق قانون البلديات (مع احتساب نصف العرض للواجهة)
   */
  calculatePavingReturn(frontageLength, pavingWidth, pricePerMeterSquare = 4.5, impositionRate = 1.0, isHalfWidth = true) {
    const l = Math.max(0, parseFloat(frontageLength || 0));
    const totalW = Math.max(0, parseFloat(pavingWidth || 0));
    
    // احتساب نصف عرض الشارع المحاذي للواجهة قانونياً ما لم يحدد خلاف ذلك
    const effectiveWidth = isHalfWidth ? (totalW / 2.0) : totalW;
    const p = Math.max(0, parseFloat(pricePerMeterSquare !== undefined ? pricePerMeterSquare : 4.5));
    
    let r = parseFloat(impositionRate !== undefined ? impositionRate : 1.0);
    if (isNaN(r) || r < 0) r = 0;
    if (r > 1) r = r / 100.0;

    const areaSquareMeters = Math.round(l * effectiveWidth * 100) / 100;
    const requiredAmount = Math.round(areaSquareMeters * p * r * 1000) / 1000;

    return {
      frontageLength: l,
      totalPavingWidth: totalW,
      effectivePavingWidth: effectiveWidth,
      isHalfWidthApplied: isHalfWidth,
      areaSquareMeters,
      pricePerMeterSquare: p,
      impositionRate: r,
      isExempt: r === 0,
      requiredAmount
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة سجلات عوائد التعبيد والاستعلامات المكانية (CRUD & Spatial Queries)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة عوائد التعبيد مع الفلاتر والارتباط المكاني PostGIS
   */
  async getPavingReturns(filters = {}, user = null) {
    const {
      tenderId, search, pieceNumber, basinNumber, district, paymentStatus,
      approvalStatus, startDate, endDate, page, limit
    } = filters;

    if (isPostgresActive()) {
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
        params.push(`%${pieceNumber.trim()}%`);
        sql += ` AND pr.piece_number ILIKE $${params.length}`;
      }
      if (basinNumber) {
        params.push(`%${basinNumber.trim()}%`);
        sql += ` AND pr.basin_number ILIKE $${params.length}`;
      }
      if (district && district !== 'all') {
        params.push(`%${district.trim()}%`);
        sql += ` AND pr.district ILIKE $${params.length}`;
      }
      if (paymentStatus && paymentStatus !== 'ALL') {
        params.push(paymentStatus);
        sql += ` AND pr.payment_status = $${params.length}`;
      }
      if (approvalStatus && approvalStatus !== 'ALL') {
        params.push(approvalStatus);
        sql += ` AND pr.approval_status = $${params.length}`;
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
        params.push(`%${search.trim()}%`);
        sql += ` AND (pr.piece_number ILIKE $${params.length} 
                   OR pr.basin_number ILIKE $${params.length} 
                   OR pr.district ILIKE $${params.length} 
                   OR pr.owner_name ILIKE $${params.length} 
                   OR pr.street_name ILIKE $${params.length} 
                   OR pr.id ILIKE $${params.length} 
                   OR t.name ILIKE $${params.length})`;
      }

      sql += ' ORDER BY pr.created_at DESC, pr.id DESC';

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        sql += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      }

      const rows = await dbQuery(sql, params) || [];
      return rows.map(r => this._formatReturnOutput(r));
    } else {
      let rows = (memDb.paving_returns || []).filter(r => {
        const sTarget = `${r.owner_name || ''} ${r.national_id || ''} ${r.street_name || ''} ${r.id || ''} ${r.piece_number || ''} ${r.basin_number || ''}`.toLowerCase();
        if (search && !sTarget.includes(search.toLowerCase())) return false;
        if (tenderId && tenderId !== 'all' && r.tender_id !== tenderId) return false;
        if (pieceNumber && !String(r.piece_number || '').includes(pieceNumber)) return false;
        if (basinNumber && !String(r.basin_number || '').includes(basinNumber)) return false;
        if (district && district !== 'all' && r.district !== district) return false;
        if (paymentStatus && paymentStatus !== 'ALL' && r.payment_status !== paymentStatus) return false;
        if (approvalStatus && approvalStatus !== 'ALL' && r.approval_status !== approvalStatus) return false;
        return true;
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      if (limit) {
        const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;
        rows = rows.slice(offset, offset + parsedLimit);
      }
      return rows.map(r => this._formatReturnOutput(r));
    }
  }

  /**
   * استرجاع تفاصيل سجل عوائد تعبيد محدد بالمعرف
   */
  async getPavingReturnById(returnId) {
    if (!returnId) return null;
    let record = null;
    if (isPostgresActive()) {
      record = await dbGet(`
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
        WHERE pr.id = $1
      `, [returnId]);
    } else {
      record = (memDb.paving_returns || []).find(r => String(r.id) === String(returnId)) || null;
    }
    return this._formatReturnOutput(record);
  }

  /**
   * تنسيق وتطهير المخرجات وضمان مطابقة الأنواع وهياكل الـ JSON
   */
  _formatReturnOutput(record) {
    if (!record) return null;

    let pieces = [];
    let attachments = [];
    let approvalHistory = [];
    let history = [];
    let geojson = null;

    try {
      if (typeof record.pieces === 'string') pieces = JSON.parse(record.pieces || '[]');
      else if (Array.isArray(record.pieces)) pieces = record.pieces;
    } catch (e) { pieces = []; }

    try {
      if (typeof record.attachments === 'string') attachments = JSON.parse(record.attachments || '[]');
      else if (Array.isArray(record.attachments)) attachments = record.attachments;
    } catch (e) { attachments = []; }

    try {
      if (typeof record.approval_history === 'string') approvalHistory = JSON.parse(record.approval_history || '[]');
      else if (Array.isArray(record.approval_history)) approvalHistory = record.approval_history;
    } catch (e) { approvalHistory = []; }

    try {
      if (typeof record.history === 'string') history = JSON.parse(record.history || '[]');
      else if (Array.isArray(record.history)) history = record.history;
    } catch (e) { history = []; }

    try {
      if (typeof record.geojson === 'string') geojson = JSON.parse(record.geojson);
      else if (typeof record.geojson === 'object') geojson = record.geojson;
      else if (record.lat && record.lng) geojson = { type: 'Point', coordinates: [record.lng, record.lat] };
    } catch (e) {
      if (record.lat && record.lng) geojson = { type: 'Point', coordinates: [record.lng, record.lat] };
    }

    const required = parseFloat(record.required_amount || 0);
    const paid = parseFloat(record.paid_amount || 0);
    const remaining = Math.max(0, Math.round((required - paid) * 1000) / 1000);

    return {
      ...record,
      frontage_length: parseFloat(record.frontage_length || 0),
      paving_width: parseFloat(record.paving_width || 0),
      price_per_meter: parseFloat(record.price_per_meter || 0),
      imposition_rate: parseFloat(record.imposition_rate || 1.0),
      required_amount: required,
      paid_amount: paid,
      remaining_amount: remaining,
      lat: parseFloat(record.lat || 32.3301),
      lng: parseFloat(record.lng || 35.7501),
      pieces,
      attachments,
      approval_history: approvalHistory,
      history,
      geojson,
      geometry: geojson
    };
  }

  /**
   * إنشاء وتوثيق قيد عوائد تعبيد جديد بالترقيم الموحد مع PostGIS
   */
  async createPavingReturn(returnData, user = null) {
    const {
      id, tenderId, tender_id, pieceNumber, piece_number, basinNumber, basin_number,
      district, streetName, street_name, ownerName, owner_name, nationalId, national_id,
      frontageLength, frontage_length, pavingWidth, paving_width, pricePerMeter, price_per_meter,
      pricePerSqm, price_per_sqm, impositionRate, imposition_rate, notes, pieces, attachments,
      paidAmount, paid_amount, paymentStatus, payment_status, receiptNumber, receipt_number,
      paymentDate, payment_date, coordinates, lat, lng, approvalStatus, approval_status,
      currentStage, current_stage
    } = returnData;

    let parsedPieces = [];
    if (Array.isArray(pieces) && pieces.length > 0) {
      parsedPieces = pieces.map(p => {
        const pLen = parseFloat(p.frontageLength || p.frontage_length || 0);
        const pWid = parseFloat(p.pavingWidth || p.paving_width || 0);
        const pPrc = parseFloat(p.pricePerMeter || p.price_per_meter || p.pricePerSqm || p.price_per_sqm || 4.5);
        const pRat = parseFloat(p.impositionRate !== undefined ? p.impositionRate : (p.imposition_rate !== undefined ? p.imposition_rate : 1.0));
        const calc = this.calculatePavingReturn(pLen, pWid, pPrc, pRat);
        return {
          pieceNumber: String(p.pieceNumber || p.piece_number || pieceNumber || piece_number || '1').trim(),
          basinNumber: String(p.basinNumber || p.basin_number || basinNumber || basin_number || '1').trim(),
          district: p.district || district || 'كفرنجة',
          ownerName: p.ownerName || p.owner_name || ownerName || owner_name || 'مواطن / مكلف',
          nationalId: p.nationalId || p.national_id || nationalId || national_id || '',
          frontageLength: pLen,
          pavingWidth: pWid,
          pricePerMeter: pPrc,
          impositionRate: pRat,
          requiredAmount: calc.requiredAmount,
          notes: p.notes || ''
        };
      });
    } else {
      const pLen = parseFloat(frontageLength || frontage_length || 0);
      const pWid = parseFloat(pavingWidth || paving_width || 6);
      const pPrc = parseFloat(pricePerMeter || price_per_meter || pricePerSqm || price_per_sqm || 4.5);
      const pRat = parseFloat(impositionRate !== undefined ? impositionRate : (imposition_rate !== undefined ? imposition_rate : 1.0));
      const calc = this.calculatePavingReturn(pLen, pWid, pPrc, pRat);
      parsedPieces.push({
        pieceNumber: String(pieceNumber || piece_number || '1').trim(),
        basinNumber: String(basinNumber || basin_number || '1').trim(),
        district: district || 'كفرنجة',
        ownerName: ownerName || owner_name || 'مواطن / مكلف',
        nationalId: nationalId || national_id || '',
        frontageLength: pLen,
        pavingWidth: pWid,
        pricePerMeter: pPrc,
        impositionRate: pRat,
        requiredAmount: calc.requiredAmount,
        notes: notes || ''
      });
    }

    let totalAmount = 0;
    let totalLength = 0;
    parsedPieces.forEach(p => {
      totalAmount += (parseFloat(p.requiredAmount) || 0);
      totalLength += (parseFloat(p.frontageLength) || 0);
    });

    const firstPiece = parsedPieces[0] || {};
    const tId = tenderId || tender_id || null;
    const pNumber = firstPiece.pieceNumber || String(pieceNumber || piece_number || '1').trim();
    const bNumber = firstPiece.basinNumber || String(basinNumber || basin_number || '1').trim();
    const dist = district || firstPiece.district || 'كفرنجة';

    // التحقق من المعرف المؤسسي الموحد
    let recordId = id;
    if (!recordId) {
      recordId = await numberingEngine.generateNextId('paving_returns');
    }

    const latVal = parseFloat(lat || (coordinates && coordinates[0] ? coordinates[0][1] : 32.3301));
    const lngVal = parseFloat(lng || (coordinates && coordinates[0] ? coordinates[0][0] : 35.7501));
    const createdBy = user ? (user.username || user.fullName || user.id) : 'SYSTEM';
    const initialApproval = approvalStatus || approval_status || 'DRAFT';
    const initialStage = parseInt(currentStage || current_stage || 1, 10);
    const initialStatus = initialApproval === 'APPROVED' ? 'معتمد ومدرج بالسجلات' : 'قيد التدقيق والاعتماد';

    const approvalHist = [
      {
        stage: 'إعداد وتنظيم المعاملة',
        role: user?.role || 'المهندس',
        action: 'SUBMITTED',
        by: createdBy,
        date: new Date().toISOString(),
        notes: notes || 'تم إدخال وتنظيم المعاملة وحساب الأطوال والمبالغ المفروضة'
      }
    ];

    const recordObj = {
      id: recordId,
      tender_id: tId,
      piece_number: pNumber,
      basin_number: bNumber,
      district: dist,
      street_name: streetName || street_name || 'الشارع الرئيسي',
      owner_name: ownerName || owner_name || firstPiece.ownerName || 'مواطن / مكلف',
      national_id: nationalId || national_id || firstPiece.nationalId || '',
      frontage_length: totalLength,
      paving_width: parseFloat(pavingWidth || paving_width || firstPiece.pavingWidth || 6),
      price_per_meter: parseFloat(pricePerMeter || price_per_meter || pricePerSqm || price_per_sqm || firstPiece.pricePerMeter || 4.5),
      imposition_rate: parseFloat(impositionRate !== undefined ? impositionRate : (imposition_rate !== undefined ? imposition_rate : 1.0)),
      required_amount: Number(totalAmount.toFixed(3)),
      paid_amount: parseFloat(paidAmount || paid_amount || 0),
      payment_status: paymentStatus || payment_status || (parseFloat(paidAmount || paid_amount || 0) >= totalAmount ? 'PAID' : (parseFloat(paidAmount || paid_amount || 0) > 0 ? 'PARTIAL' : 'UNPAID')),
      receipt_number: receiptNumber || receipt_number || null,
      payment_date: paymentDate || payment_date || null,
      pieces: parsedPieces,
      attachments: attachments || [],
      notes: notes || '',
      status: initialStatus,
      created_by: createdBy,
      lat: latVal,
      lng: lngVal,
      approval_status: initialApproval,
      current_stage: initialStage,
      approval_history: approvalHist,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.query(`
          INSERT INTO public.paving_returns (
            id, tender_id, piece_number, basin_number, district, street_name, owner_name, national_id,
            frontage_length, paving_width, price_per_meter, imposition_rate, required_amount, paid_amount,
            payment_status, receipt_number, payment_date, pieces, attachments, notes, status, created_by,
            lat, lng, geom, approval_status, current_stage, approval_history, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18::jsonb, $19::jsonb, $20, $21, $22, $23, $24,
            ST_SetSRID(ST_MakePoint($24, $23), 4326),
            $25, $26, $27::jsonb, NOW(), NOW()
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
            attachments = EXCLUDED.attachments,
            notes = EXCLUDED.notes,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            geom = EXCLUDED.geom,
            approval_status = EXCLUDED.approval_status,
            current_stage = EXCLUDED.current_stage,
            approval_history = EXCLUDED.approval_history,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          recordObj.id, recordObj.tender_id, recordObj.piece_number, recordObj.basin_number, recordObj.district,
          recordObj.street_name, recordObj.owner_name, recordObj.national_id, recordObj.frontage_length,
          recordObj.paving_width, recordObj.price_per_meter, recordObj.imposition_rate, recordObj.required_amount,
          recordObj.paid_amount, recordObj.payment_status, recordObj.receipt_number, recordObj.payment_date,
          JSON.stringify(recordObj.pieces), JSON.stringify(recordObj.attachments), recordObj.notes, recordObj.status,
          recordObj.created_by, latVal, lngVal, recordObj.approval_status, recordObj.current_stage, JSON.stringify(recordObj.approval_history)
        ]);
      });
    } else {
      if (!memDb.paving_returns) memDb.paving_returns = [];
      const idx = memDb.paving_returns.findIndex(r => r.id === recordObj.id);
      if (idx !== -1) memDb.paving_returns[idx] = recordObj;
      else memDb.paving_returns.unshift(recordObj);
      saveMemTable('paving_returns');
    }

    await this._recordAudit(user?.id, recordObj.id, 'PAVING_RETURN_CREATED', null, recordObj);
    return await this.getPavingReturnById(recordObj.id);
  }

  /**
   * تعديل وتحديث بيانات قيد عوائد تعبيد
   */
  async updatePavingReturn(returnId, updates, user = null) {
    const existing = await this.getPavingReturnById(returnId);
    if (!existing) throw new Error(`سجل عوائد التعبيد [${returnId}] غير موجود.`);

    const frontage = updates.frontage_length !== undefined ? updates.frontage_length : (updates.frontageLength !== undefined ? updates.frontageLength : existing.frontage_length);
    const width = updates.paving_width !== undefined ? updates.paving_width : (updates.pavingWidth !== undefined ? updates.pavingWidth : existing.paving_width);
    const price = updates.price_per_meter !== undefined ? updates.price_per_meter : (updates.pricePerMeter !== undefined ? updates.pricePerMeter : existing.price_per_meter);
    const rate = updates.imposition_rate !== undefined ? updates.imposition_rate : (updates.impositionRate !== undefined ? updates.impositionRate : existing.imposition_rate);
    const calc = this.calculatePavingReturn(frontage, width, price, rate, true);

    const latVal = updates.lat !== undefined ? parseFloat(updates.lat) : existing.lat;
    const lngVal = updates.lng !== undefined ? parseFloat(updates.lng) : existing.lng;

    const updated = {
      ...existing,
      ...updates,
      frontage_length: calc.frontageLength,
      paving_width: calc.effectivePavingWidth,
      price_per_meter: calc.pricePerMeterSquare,
      imposition_rate: calc.impositionRate,
      required_amount: updates.required_amount !== undefined ? parseFloat(updates.required_amount) : calc.requiredAmount,
      lat: latVal,
      lng: lngVal,
      updated_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.query(`
          UPDATE public.paving_returns
          SET tender_id = $1, piece_number = $2, basin_number = $3, district = $4,
              street_name = $5, owner_name = $6, national_id = $7, frontage_length = $8,
              paving_width = $9, price_per_meter = $10, imposition_rate = $11, required_amount = $12,
              notes = $13, lat = $14, lng = $15, geom = ST_SetSRID(ST_MakePoint($15, $14), 4326),
              updated_at = NOW()
          WHERE id = $16
        `, [
          updated.tender_id, updated.piece_number, updated.basin_number, updated.district,
          updated.street_name, updated.owner_name, updated.national_id, updated.frontage_length,
          updated.paving_width, updated.price_per_meter, updated.imposition_rate, updated.required_amount,
          updated.notes, latVal, lngVal, existing.id
        ]);
      });
    } else {
      const idx = (memDb.paving_returns || []).findIndex(r => String(r.id) === String(existing.id));
      if (idx !== -1) {
        memDb.paving_returns[idx] = updated;
        saveMemTable('paving_returns');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PAVING_RETURN_UPDATED', existing, updated);
    return await this.getPavingReturnById(existing.id);
  }

  /**
   * ترقية وتمرير مسار اعتماد المعاملة الرسمية مع حظر الموافقة الذاتية (SoD)
   */
  async advanceApproval(returnId, payload = {}, user = null) {
    const existing = await this.getPavingReturnById(returnId);
    if (!existing) throw new Error(`سجل عوائد التعبيد [${returnId}] غير موجود.`);

    const { action, notes, approverName, approverRole } = payload;
    const callerId = user ? (user.username || user.fullName || user.id) : (approverName || 'المعتمد');
    const callerRole = user ? (user.role || '').toLowerCase() : (approverRole || 'engineer').toLowerCase();

    // 🛡️ فحص قواعد فصل المهام (Separation of Duties)
    if (action === 'FINAL_APPROVE') {
      const isPrivileged = callerRole === 'admin' || callerRole === 'super_admin' || callerRole === 'director_public_works';
      if (!isPrivileged && existing.created_by && existing.created_by === callerId) {
        throw new Error('⛔ عذراً: تمنع قواعد فصل المهام (Separation of Duties) المستخدم من اعتماد أو مصادقة معاملة قام بإنشائها بنفسه.');
      }
    }

    let history = Array.isArray(existing.approval_history) ? existing.approval_history : [];
    let newStatus = existing.approval_status || 'DRAFT';
    let newStage = parseInt(existing.current_stage || 1, 10);
    let statusLabel = existing.status || 'مسودة';

    if (action === 'SUBMIT') {
      newStatus = 'UNDER_REVIEW';
      newStage = 2;
      statusLabel = 'قيد التدقيق الهندسي';
      history.push({
        stage: 'إعداد وتنظيم المعاملة',
        role: approverRole || 'المهندس المنظم',
        action: 'SUBMITTED',
        by: callerId,
        date: new Date().toISOString(),
        notes: notes || 'تم تجهيز السجل وإحالته للتدقيق الميداني'
      });
    } else if (action === 'REVIEW_APPROVE') {
      newStatus = 'PENDING_DIRECTOR';
      newStage = 3;
      statusLabel = 'بانتظار مصادقة مدير الأشغال';
      history.push({
        stage: 'التدقيق الهندسي الميداني',
        role: approverRole || 'رئيس القسم',
        action: 'REVIEWED',
        by: callerId,
        date: new Date().toISOString(),
        notes: notes || 'تمت المطابقة الميدانية والتدقيق الحسابي أصولاً'
      });
    } else if (action === 'FINAL_APPROVE') {
      newStatus = 'APPROVED';
      newStage = 3;
      statusLabel = 'معتمد ومدرج في السجلات الرسمية';
      history.push({
        stage: 'الاعتماد والمصادقة الفنية',
        role: approverRole || 'مدير الأشغال والخدمات الهندسية',
        action: 'APPROVED',
        by: callerId,
        date: new Date().toISOString(),
        notes: notes || 'تم الاعتماد والمصادقة النهائية والإدراج في سجلات التحقق والتحصيل'
      });
    } else if (action === 'REJECT_RETURN') {
      newStatus = 'RETURNED';
      newStage = 1;
      statusLabel = 'معادة للتعديل الفني';
      history.push({
        stage: 'إعادة المعاملة',
        role: approverRole || 'المدقق',
        action: 'REJECTED',
        by: callerId,
        date: new Date().toISOString(),
        notes: notes || 'تمت إعادة المعاملة للتعديل واستكمال النواقص'
      });
    } else {
      throw new Error(`إجراء الترقية غير معروف: [${action}]`);
    }

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.query(`
          UPDATE public.paving_returns 
          SET approval_status = $1, current_stage = $2, approval_history = $3::jsonb, status = $4, updated_at = NOW()
          WHERE id = $5
        `, [newStatus, newStage, JSON.stringify(history), statusLabel, existing.id]);
      });
    } else {
      const idx = (memDb.paving_returns || []).findIndex(r => String(r.id) === String(existing.id));
      if (idx !== -1) {
        memDb.paving_returns[idx].approval_status = newStatus;
        memDb.paving_returns[idx].current_stage = newStage;
        memDb.paving_returns[idx].approval_history = history;
        memDb.paving_returns[idx].status = statusLabel;
        memDb.paving_returns[idx].updated_at = new Date().toISOString();
        saveMemTable('paving_returns');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PAVING_RETURN_APPROVAL_ADVANCED', { previousStatus: existing.approval_status }, { newStatus, action, notes });

    const updated = await this.getPavingReturnById(existing.id);
    return {
      success: true,
      message: 'تم تحديث مسار الاعتماد بنجاح',
      approval_status: newStatus,
      current_stage: newStage,
      status: statusLabel,
      approval_history: history,
      data: updated
    };
  }

  /**
   * قيد دفعة مالية وسند قبض (مع حظر التحصيل للمعاملات غير المعتمدة نهائياً)
   */
  async recordPayment(returnId, paymentData = {}, user = null) {
    const existing = await this.getPavingReturnById(returnId);
    if (!existing) throw new Error(`سجل عوائد التعبيد [${returnId}] غير موجود.`);

    // 🛡️ الحظر المالي: لا يمكن تحصيل مبالغ مالية إلا بعد المصادقة النهائية
    if (existing.approval_status && existing.approval_status !== 'APPROVED' && existing.approval_status !== 'معتمد') {
      throw new Error('⚠️ لا يمكن تسجيل سند قبض أو تحصيل مالي لمعاملة لم تستكمل سلسلة الاعتمادات والمصادقة النهائية من مدير الأشغال.');
    }

    const { amountPaid, paidAmount, receiptNumber, paymentDate, notes } = paymentData;
    const paidVal = parseFloat(paidAmount !== undefined ? paidAmount : (amountPaid !== undefined ? amountPaid : 0));
    if (isNaN(paidVal) || paidVal <= 0) {
      throw new Error('مبلغ سند القبض يجب أن يكون قيمة موجبة أكبر من الصفر.');
    }

    const currentPaid = parseFloat(existing.paid_amount || 0);
    const newPaidTotal = Math.round((currentPaid + paidVal) * 1000) / 1000;
    const required = parseFloat(existing.required_amount || 0);

    let status = 'PARTIAL';
    if (newPaidTotal >= required && required > 0) {
      status = 'PAID';
    }

    const receipt = receiptNumber || `REC-${Date.now()}`;
    const pDate = paymentDate || new Date().toISOString().split('T')[0];

    let history = Array.isArray(existing.history) ? existing.history : [];
    const paymentEntry = {
      receiptNumber: receipt,
      amount: paidVal,
      paymentDate: pDate,
      collectorId: user?.id || 'SYSTEM',
      collectorName: user?.fullName || user?.username || 'محصل الصندوق',
      notes: notes || '',
      recordedAt: new Date().toISOString()
    };
    history.push(paymentEntry);

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.query(`
          UPDATE public.paving_returns 
          SET paid_amount = $1, payment_status = $2, receipt_number = $3, payment_date = $4,
              history = $5::jsonb, updated_at = NOW() 
          WHERE id = $6
        `, [newPaidTotal, status, receipt, pDate, JSON.stringify(history), existing.id]);
      });
    } else {
      const idx = (memDb.paving_returns || []).findIndex(r => String(r.id) === String(existing.id));
      if (idx !== -1) {
        memDb.paving_returns[idx].paid_amount = newPaidTotal;
        memDb.paving_returns[idx].payment_status = status;
        memDb.paving_returns[idx].receipt_number = receipt;
        memDb.paving_returns[idx].payment_date = pDate;
        memDb.paving_returns[idx].history = history;
        memDb.paving_returns[idx].updated_at = new Date().toISOString();
        saveMemTable('paving_returns');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'PAVING_RETURN_PAID', { previousPaid: currentPaid }, { newPaidTotal, paymentEntry });

    const updated = await this.getPavingReturnById(existing.id);
    return {
      success: true,
      message: 'تم قيد الدفعة وسند القبض بنجاح',
      paid_amount: newPaidTotal,
      payment_status: status,
      data: updated
    };
  }

  /**
   * حذف قيد عوائد تعبيد (مع حظر محاسبي قطعي للقيود المسدد جزء منها أو كلياً)
   */
  async deletePavingReturn(returnId, user = null) {
    const existing = await this.getPavingReturnById(returnId);
    if (!existing) throw new Error(`سجل عوائد التعبيد [${returnId}] غير موجود.`);

    // 🛡️ حظر محاسبي مؤسسي
    if (parseFloat(existing.paid_amount || 0) > 0) {
      throw new Error('حظر محاسبي: لا يمكن حذف قيد عوائد تعبيد تم تحصيل مبالغ مالية وسندات قبض عليه.');
    }

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.query('DELETE FROM public.paving_returns WHERE id = $1', [existing.id]);
      });
    } else {
      memDb.paving_returns = (memDb.paving_returns || []).filter(r => String(r.id) !== String(existing.id));
      saveMemTable('paving_returns');
    }

    await this._recordAudit(user?.id, existing.id, 'PAVING_RETURN_DELETED', existing, null);
    return { success: true, message: 'تم حذف سجل عوائد التعبيد بنجاح.' };
  }

  /**
   * استخراج الإحصائيات المالية والتنفيذية الشاملة
   */
  async getReturnsStats(filters = {}, user = null) {
    const all = await this.getPavingReturns(filters, user);
    let totalRequired = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let exemptCount = 0;
    let approvedCount = 0;

    all.forEach(r => {
      const req = parseFloat(r.required_amount || 0);
      const paid = parseFloat(r.paid_amount || 0);
      totalRequired += req;
      totalCollected += paid;

      if (r.payment_status === 'PAID') paidCount++;
      else if (r.payment_status === 'PARTIAL') partialCount++;
      else if (r.payment_status === 'EXEMPT') exemptCount++;
      else unpaidCount++;

      if (r.approval_status === 'APPROVED' || r.approval_status === 'معتمد') approvedCount++;
    });

    const totalUnpaid = Math.max(0, Math.round((totalRequired - totalCollected) * 100) / 100);
    const collectionRate = totalRequired > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0;

    return {
      totalRecords: all.length,
      totalRequiredAmount: Math.round(totalRequired * 100) / 100,
      totalCollectedAmount: Math.round(totalCollected * 100) / 100,
      totalUnpaidAmount: totalUnpaid,
      collectionPercentage: collectionRate,
      paidParcelsCount: paidCount,
      unpaidParcelsCount: unpaidCount,
      partialParcelsCount: partialCount,
      exemptParcelsCount: exemptCount,
      approvedCount
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalCount = 0;
    let totalRevenue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count, COALESCE(SUM(paid_amount), 0) as total_paid FROM public.paving_returns');
        totalCount = parseInt(res?.count || 0, 10);
        totalRevenue = parseFloat(res?.total_paid || 0);
      } else {
        totalCount = (memDb.paving_returns || []).length;
        totalRevenue = (memDb.paving_returns || []).reduce((sum, r) => sum + (parseFloat(r.paid_amount || 0)), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        engineName: this.engineName,
        totalCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return {
        healthy: false,
        status: 'FAILED',
        engineId: this.engineId,
        error: e.message
      };
    }
  }
}

const pavementReturnsEngineService = new PavementReturnsEngineService();
module.exports = pavementReturnsEngineService;
