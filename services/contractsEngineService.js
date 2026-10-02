/**
 * services/contractsEngineService.js
 * 📜 محرك إدارة العقود الإنشائية، الكفالات البنكية والأوامر التغييرية (CONTRACTS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v2.0 - Anti-Gravity Enterprise Contracts & Guarantees Patch
 *
 * المصدر القانوني والمعتمد الوحيد للعقود: public.contracts
 * الأوامر التغييرية الكنونية: public.contract_variation_orders
 * الكفالات البنكية الكنونية: public.bank_guarantees
 * البنود العقدية الكنونية: public.contract_clauses
 */

'use strict';

const crypto = require('crypto');
const { isPostgresActive, dbQuery, dbGet, dbRun, withTransaction, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const budgetEngineService = require('./budgetEngineService');
const { logInfo, logWarn, logError } = require('./loggerService');

class ContractsEngineService {
  constructor() {
    this.engineId = 'CONTRACTS_ENGINE';
    this.engineName = 'Enterprise Construction Contracts & Bank Guarantees Engine';
    this.version = '2.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'contracts_crud',
      'bank_guarantees_tracking',
      'variation_orders_management',
      'contract_clauses_management',
      'contract_lifecycle',
      'financial_budget_sync',
      'guarantee_alerts',
      'digital_signatures',
      'legal_limit_enforcement'
    ];
  }

  _roundCurrency(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  _getContractsCollection() {
    if (!memDb.contracts) {
      memDb.contracts = memDb.construction_contracts || [];
    }
    if (!memDb.construction_contracts) {
      memDb.construction_contracts = memDb.contracts;
    }
    return memDb.contracts;
  }

  /**
   * تحويل صفوف الجدول الكنوني public.contract_variation_orders إلى الشكل المتوافق مع المستهلكين (Backward Compatible)
   */
  _mapCanonicalVOs(rows) {
    return (rows || []).map(r => ({
      ...r,
      id: r.id,
      vo_number: r.order_number || r.vo_number,
      order_number: r.order_number,
      order_type: r.order_type,
      title: r.title || r.reason || '',
      amount: parseFloat(r.amount_change != null ? r.amount_change : r.amount) || 0,
      amount_change: r.amount_change,
      extensionDays: r.time_extension_days != null ? r.time_extension_days : (r.extensionDays || 0),
      extension_days: r.extension_days != null ? r.extension_days : r.time_extension_days,
      time_extension_days: r.time_extension_days,
      description: r.description || r.reason || '',
      reason: r.reason || r.description || '',
      status: r.status || 'APPROVED',
      isExceedingLimit: r.status === 'REQUIRES_MINISTRY_APPROVAL' || r.is_exceeding_limit === true || r.isExceedingLimit === true || false,
      createdAt: r.created_at
    }));
  }

  /**
   * وضع الملفات (non-PG): القراءة من mirror الجدول الكنوني في memDb فقط
   */
  _getMemCanonicalVOs(contractId) {
    const list = memDb.contract_variation_orders || [];
    return list.filter(v => String(v.contract_id) === String(contractId));
  }

  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء العقود والكفالات [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: 'العقود والاتفاقيات',
        entityId: String(entityId),
        details,
        ip
      });
    } catch (e) {
      logWarn('ContractsEngine', `Audit log failed: ${e.message}`);
    }
  }

  _formatContractOutput(row, canonicalVOs = null) {
    if (!row) return null;
    let guarantees = [];
    let variationOrders = [];
    try {
      guarantees = typeof row.bank_guarantees === 'string' 
        ? JSON.parse(row.bank_guarantees || '[]') 
        : (row.bank_guarantees || row.guarantees || row.guarantees_list || []);
    } catch (e) { guarantees = []; }

    try {
      if (Array.isArray(canonicalVOs)) {
        variationOrders = canonicalVOs;
      } else if (Array.isArray(row.variation_orders_list)) {
        variationOrders = row.variation_orders_list;
      } else if (Array.isArray(row.variationOrders)) {
        variationOrders = row.variationOrders;
      } else if (typeof row.variation_orders === 'string') {
        variationOrders = JSON.parse(row.variation_orders || '[]');
      } else if (Array.isArray(row.variation_orders)) {
        variationOrders = row.variation_orders;
      } else {
        variationOrders = [];
      }
    } catch (e) { variationOrders = []; }

    // التحقق من صلاحية الكفالات البنكية وتحديد التنبيهات
    const now = new Date();
    const evaluatedGuarantees = guarantees.map(g => {
      const expDate = g.expiryDate || g.expiry_date ? new Date(g.expiryDate || g.expiry_date) : null;
      let daysRemaining = null;
      let isExpired = false;
      let alertLevel = 'NORMAL';
      if (expDate) {
        const diffTime = expDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpired = daysRemaining < 0;
        if (isExpired) alertLevel = 'DANGER';
        else if (daysRemaining <= 30) alertLevel = 'CRITICAL';
        else if (daysRemaining <= 60) alertLevel = 'WARNING';
        else if (daysRemaining <= 90) alertLevel = 'INFO';
      }
      return { 
        ...g, 
        guaranteeNumber: g.guaranteeNumber || g.guarantee_number,
        guarantee_number: g.guarantee_number || g.guaranteeNumber,
        bankName: g.bankName || g.bank_name || g.issuing_bank,
        bank_name: g.bank_name || g.issuing_bank || g.bankName,
        issuing_bank: g.issuing_bank || g.bankName || g.bank_name,
        guaranteeType: g.guaranteeType || g.guarantee_type,
        guarantee_type: g.guarantee_type || g.guaranteeType,
        expiryDate: g.expiryDate || g.expiry_date,
        expiry_date: g.expiry_date || g.expiryDate,
        amount: this._roundCurrency(g.amount || 0),
        daysRemaining, 
        days_left: daysRemaining,
        isExpired,
        alertLevel,
        status: g.status || 'ACTIVE'
      };
    });

    const currentTotal = this._roundCurrency(row.total_value != null ? row.total_value : (row.contract_value || row.contractValue || 0));
    const voTotal = variationOrders.reduce((sum, vo) => sum + parseFloat(vo.amount || 0), 0);
    const originalValue = this._roundCurrency(row.original_contract_value != null ? row.original_contract_value : (currentTotal - voTotal));
    const finalContractValue = currentTotal;

    return {
      ...row,
      id: row.id,
      contractNumber: row.contract_number || row.contractNumber || row.id,
      contract_number: row.contract_number || row.contractNumber || row.id,
      title: row.title || 'عقد أشغال هندسية',
      contractorName: row.contractor_name || row.contractorName,
      contractor_name: row.contractor_name || row.contractorName,
      tenderId: row.tender_id || row.tenderId || null,
      tender_id: row.tender_id || row.tenderId || null,
      budgetLineId: row.budget_line_id || row.budgetLineId || null,
      budget_line_id: row.budget_line_id || row.budgetLineId || null,
      startDate: row.start_date || row.startDate,
      start_date: row.start_date || row.startDate,
      endDate: row.end_date || row.endDate,
      end_date: row.end_date || row.endDate,
      contractValue: originalValue,
      original_contract_value: originalValue,
      total_value: finalContractValue,
      contract_value: finalContractValue,
      variationOrdersTotal: this._roundCurrency(voTotal),
      finalContractValue,
      bankGuarantees: evaluatedGuarantees,
      guarantees_list: evaluatedGuarantees,
      variationOrders,
      variation_orders_list: variationOrders,
      variation_orders: variationOrders,
      status: row.status || 'ACTIVE'
    };
  }

  /**
   * استرجاع قائمة العقود الإنشائية مع الفلاتر والتصفح من الجدول الكنوني public.contracts
   */
  async getContracts(filters = {}) {
    const { status, contractorName, contractor, search, tenderId, tender_id, limit = 500, minVal, maxVal, engineer } = filters;
    const targetContractor = contractorName || contractor;
    const targetTenderId = tenderId || tender_id;

    if (isPostgresActive()) {
      let sql = `
        SELECT c.*,
               COALESCE((SELECT json_agg(bg.*) FROM public.bank_guarantees bg WHERE bg.contract_id = c.id), '[]'::json) as guarantees_list,
               COALESCE((SELECT json_agg(vo.*) FROM public.contract_variation_orders vo WHERE vo.contract_id = c.id), '[]'::json) as variation_orders_list
        FROM public.contracts c
        WHERE 1=1
      `;
      const params = [];

      if (status && status !== 'all') {
        params.push(status);
        sql += ` AND c.status = $${params.length}`;
      }
      if (targetContractor) {
        params.push(`%${targetContractor.trim()}%`);
        sql += ` AND c.contractor_name ILIKE $${params.length}`;
      }
      if (targetTenderId) {
        params.push(targetTenderId);
        sql += ` AND c.tender_id = $${params.length}`;
      }
      if (engineer) {
        params.push(`%${engineer.trim()}%`);
        sql += ` AND c.supervising_engineer ILIKE $${params.length}`;
      }
      if (minVal) {
        params.push(parseFloat(minVal));
        sql += ` AND COALESCE(c.total_value, c.contract_value, 0) >= $${params.length}`;
      }
      if (maxVal) {
        params.push(parseFloat(maxVal));
        sql += ` AND COALESCE(c.total_value, c.contract_value, 0) <= $${params.length}`;
      }
      if (search) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (c.title ILIKE $${params.length} OR c.contract_number ILIKE $${params.length} OR c.id ILIKE $${params.length} OR c.contractor_name ILIKE $${params.length})`;
      }

      sql += ` ORDER BY c.created_at DESC LIMIT ${Math.max(1, parseInt(limit, 10))}`;
      const rows = await dbQuery(sql, params) || [];
      return rows.map(r => this._formatContractOutput(r, this._mapCanonicalVOs(r.variation_orders_list)));
    } else {
      const list = this._getContractsCollection();
      const filtered = list.filter(c => {
        if (status && status !== 'all' && c.status !== status) return false;
        if (targetContractor && !(c.contractor_name || c.contractorName || '').toLowerCase().includes(targetContractor.toLowerCase())) return false;
        if (targetTenderId && (c.tender_id !== targetTenderId && c.tenderId !== targetTenderId)) return false;
        if (search) {
          const sTarget = `${c.title || ''} ${c.contract_number || c.contractNumber || ''} ${c.id || ''} ${c.contractor_name || c.contractorName || ''}`.toLowerCase();
          if (!sTarget.includes(search.toLowerCase())) return false;
        }
        return true;
      });

      return filtered.slice(0, parseInt(limit, 10)).map(c => this._formatContractOutput(c, this._mapCanonicalVOs(this._getMemCanonicalVOs(c.id))));
    }
  }

  /**
   * استرجاع عقد مفرد بالمعرف أو الرقم المرجعي
   */
  async getContractById(contractId) {
    if (!contractId) return null;
    let contract = null;

    if (isPostgresActive()) {
      contract = await dbGet('SELECT * FROM public.contracts WHERE id = $1 OR contract_number = $1', [contractId]);
      if (!contract) {
        try {
          contract = await dbGet('SELECT * FROM public.construction_contracts WHERE id = $1 OR contract_number = $1', [contractId]);
        } catch (e) {}
      }
      if (contract) {
        try {
          const bgs = await dbQuery('SELECT * FROM public.bank_guarantees WHERE contract_id = $1 ORDER BY expiry_date ASC', [contract.id]) || [];
          contract.bank_guarantees = bgs;
        } catch (e) {}
        try {
          const vos = await dbQuery('SELECT * FROM public.contract_variation_orders WHERE contract_id = $1 ORDER BY created_at DESC', [contract.id]) || [];
          contract.variation_orders_list = this._mapCanonicalVOs(vos);
        } catch (e) {
          contract.variation_orders_list = [];
        }
        try {
          const cls = await dbQuery('SELECT * FROM public.contract_clauses WHERE contract_id = $1 ORDER BY clause_number ASC', [contract.id]) || [];
          contract.clauses = cls;
        } catch (e) {
          contract.clauses = [];
        }
      }
    } else {
      const list = this._getContractsCollection();
      contract = list.find(c => String(c.id) === String(contractId) || String(c.contract_number || c.contractNumber) === String(contractId)) || null;
      if (contract) {
        contract.bank_guarantees = (memDb.bank_guarantees || []).filter(g => String(g.contract_id) === String(contract.id));
        contract.clauses = (memDb.contract_clauses || []).filter(c => String(c.contract_id) === String(contract.id));
      }
    }

    const canonicalVOs = contract ? (contract.variation_orders_list || this._mapCanonicalVOs(this._getMemCanonicalVOs(contract.id))) : null;
    return this._formatContractOutput(contract, canonicalVOs);
  }

  /**
   * توثيق عقد إنشائي جديد بالترقيم المؤسسي الموحد ومزامنة الموازنة
   */
  async createContract(contractData, user = null) {
    const {
      id: customId,
      title, tenderId, tender_id, procurement_type, procurement_id, contract_type_id,
      contractorName, contractor_name, contractor_id,
      contractValue, contract_value, totalValue, total_value,
      startDate, start_date,
      endDate, end_date,
      budgetLineId, budget_line_id,
      supervising_engineer, department, funding_source, execution_period_days,
      guarantee_value, bank_name, guarantee_number, guarantee_expiry_date,
      award_decision_number, award_date, handover_committee, guarantee_percentage,
      notes, clauses
    } = contractData;

    const cTitle = title || 'عقد أشغال هندسية';
    const cValue = this._roundCurrency(contractValue || contract_value || totalValue || total_value);
    const cName = contractorName || contractor_name;
    const tId = tenderId || tender_id || procurement_id || null;
    const bId = budgetLineId || budget_line_id || null;

    if (!cName || cValue <= 0) {
      throw new Error('اسم المقاول وقيمة العقد المالية الموجبة حقلان إلزاميان.');
    }

    // توليد المعرف بالترقيم الذري المركزي المعتمد
    const id = customId || await numberingEngine.generateNextId('contracts', { prefix: 'CNT' });
    const contractNumber = contractData.contract_number || contractData.contractNumber || id;
    const now = new Date().toISOString();
    const periodDays = parseInt(execution_period_days, 10) || 60;
    const startD = startDate || start_date || now.split('T')[0];
    const endD = endDate || end_date || new Date(Date.now() + periodDays * 86400000).toISOString().split('T')[0];

    // حجز المخصص المالي في الموازنة إن وجد بند
    if (bId) {
      try {
        await budgetEngineService.createAllocation({
          budget_line_id: bId,
          entity_type: 'CONTRACT',
          entity_id: id,
          entity_name: `عقد إنشائي: ${cTitle}`,
          amount: cValue,
          status: 'COMMITTED'
        });
      } catch (be) {
        throw new Error(`تعذر حفظ العقد لعدم توفر مخصص مالي كافٍ في البند: ${be.message}`);
      }
    }

    const hashContent = `${id}|${tId}|${cName}|${cValue}|${startD}|${endD}`;
    const sha256Hash = crypto.createHash('sha256').update(hashContent).digest('hex');

    let initialGuarantees = [];
    if (guarantee_value || guarantee_number) {
      const gAmt = this._roundCurrency(guarantee_value || (cValue * 0.10));
      initialGuarantees.push({
        id: `BG-${Date.now()}`,
        guaranteeNumber: guarantee_number || `BG-${Date.now()}`,
        bankName: bank_name || 'البنك الإسلامي الأردني',
        amount: gAmt,
        expiryDate: guarantee_expiry_date || null,
        guaranteeType: 'PERFORMANCE',
        purpose: 'كفالة حسن تنفيذ',
        status: 'ACTIVE',
        createdAt: now
      });
    }

    const record = {
      id,
      contract_number: contractNumber,
      title: cTitle,
      tender_id: tId,
      procurement_type: procurement_type || 'TENDER',
      procurement_id: tId,
      contract_type_id: contract_type_id || 'CT-WORKS',
      contractor_id: contractor_id || '',
      contractor_name: cName,
      contract_value: cValue,
      total_value: cValue,
      start_date: startD,
      end_date: endD,
      budget_line_id: bId,
      supervising_engineer: supervising_engineer || 'م. المشرف الهندسي',
      department: department || 'مديرية الأشغال الهندسية',
      funding_source: funding_source || 'موازنة البلدية',
      execution_period_days: periodDays,
      award_decision_number: award_decision_number || `DEC-${id}`,
      award_date: award_date || startD,
      handover_committee: handover_committee || [],
      guarantee_percentage: parseFloat(guarantee_percentage || 10),
      bank_name: bank_name || (initialGuarantees[0]?.bankName || ''),
      guarantee_number: guarantee_number || (initialGuarantees[0]?.guaranteeNumber || ''),
      guarantee_value: guarantee_value ? parseFloat(guarantee_value) : (initialGuarantees[0]?.amount || 0),
      guarantee_expiry_date: guarantee_expiry_date || (initialGuarantees[0]?.expiryDate || null),
      status: contractData.status || 'ACTIVE',
      approval_stage: contractData.approval_stage || 'PREPARED',
      bank_guarantees: initialGuarantees,
      workflow_history: [{ status: 'PREPARED', date: now, user: user?.username || 'SYSTEM', note: 'إنشاء وتوثيق العقد' }],
      digital_signatures: [],
      sha256_hash: sha256Hash,
      notes: notes || '',
      created_by: user?.id || user?.username || 'SYSTEM',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.run(`
          INSERT INTO public.contracts 
          (id, tender_id, procurement_type, procurement_id, contract_type_id, contract_number, award_decision_number,
           award_date, title, contractor_id, contractor_name, total_value, contract_value, execution_period_days,
           start_date, end_date, department, funding_source, supervising_engineer, handover_committee,
           guarantee_percentage, bank_name, guarantee_number, guarantee_value, guarantee_expiry_date,
           approval_stage, status, workflow_history, sha256_hash, notes, budget_line_id, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb,
                  $21, $22, $23, $24, $25, $26, $27, $28::jsonb, $29, $30, $31, $32, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            contractor_name = EXCLUDED.contractor_name,
            total_value = EXCLUDED.total_value,
            contract_value = EXCLUDED.contract_value,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          record.id, record.tender_id, record.procurement_type, record.procurement_id, record.contract_type_id,
          record.contract_number, record.award_decision_number, record.award_date, record.title, record.contractor_id,
          record.contractor_name, record.total_value, record.contract_value, record.execution_period_days,
          record.start_date, record.end_date, record.department, record.funding_source, record.supervising_engineer,
          JSON.stringify(record.handover_committee), record.guarantee_percentage, record.bank_name,
          record.guarantee_number, record.guarantee_value, record.guarantee_expiry_date, record.approval_stage,
          record.status, JSON.stringify(record.workflow_history), record.sha256_hash, record.notes,
          record.budget_line_id, record.created_by
        ]);

        if (initialGuarantees.length > 0) {
          for (const g of initialGuarantees) {
            await client.run(`
              INSERT INTO public.bank_guarantees
              (id, contract_id, guarantee_number, issuing_bank, amount, issue_date, expiry_date, guarantee_type, notes, status, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
              ON CONFLICT (id) DO NOTHING
            `, [g.id, record.id, g.guaranteeNumber, g.bankName, g.amount, g.issue_date || g.issueDate || record.start_date || now.split('T')[0], g.expiryDate, g.guaranteeType, g.purpose || '', g.status]);
          }
        }

        if (Array.isArray(clauses) && clauses.length > 0) {
          for (const cl of clauses) {
            const clId = `CLS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await client.run(`
              INSERT INTO public.contract_clauses (id, contract_id, clause_number, title, content, display_order, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
              ON CONFLICT (id) DO NOTHING
            `, [clId, record.id, parseInt(cl.clause_number || cl.order, 10) || 1, cl.title || 'بند عقدي', cl.content || '', cl.display_order || 1]);
          }
        }
      });
    } else {
      if (initialGuarantees.length > 0) {
        if (!memDb.bank_guarantees) memDb.bank_guarantees = [];
        initialGuarantees.forEach(g => {
          memDb.bank_guarantees.push({
            id: g.id,
            contract_id: record.id,
            guarantee_number: g.guaranteeNumber,
            bank_name: g.bankName,
            amount: g.amount,
            expiry_date: g.expiryDate,
            guarantee_type: g.guaranteeType,
            status: 'ACTIVE'
          });
        });
        saveMemTable('bank_guarantees');
      }

      if (Array.isArray(clauses) && clauses.length > 0) {
        if (!memDb.contract_clauses) memDb.contract_clauses = [];
        clauses.forEach((cl, idx) => {
          memDb.contract_clauses.push({
            id: `CLS-${record.id}-${idx + 1}`,
            contract_id: record.id,
            clause_number: parseInt(cl.clause_number || idx + 1, 10),
            title: cl.title || 'بند عقدي',
            content: cl.content || '',
            display_order: parseInt(cl.display_order || idx + 1, 10)
          });
        });
        saveMemTable('contract_clauses');
      }

      if (!memDb.contracts) memDb.contracts = [];
      memDb.contracts.unshift(record);
      saveMemTable('contracts');
      memDb.construction_contracts = memDb.contracts;
      saveMemTable('construction_contracts');
    }

    await this._recordAudit(user?.id, id, 'CONTRACT_CREATED', null, record);
    return this._formatContractOutput(record);
  }

  /**
   * تعديل عقد قائم
   */
  async updateContract(contractId, updates, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const now = new Date().toISOString();
    delete updates.variation_orders;
    delete updates.variationOrders;
    const updated = { ...existing, ...updates, updated_at: now };

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
        if (keys.length > 0) {
          const setClauses = [];
          const params = [contractId];
          keys.forEach((k, idx) => {
            let col = k;
            if (k === 'contractValue') col = 'total_value';
            else if (k === 'contractorName') col = 'contractor_name';
            else if (k === 'contractNumber') col = 'contract_number';
            else if (k === 'startDate') col = 'start_date';
            else if (k === 'endDate') col = 'end_date';
            else if (k === 'tenderId') col = 'tender_id';
            else if (k === 'budgetLineId') col = 'budget_line_id';
            setClauses.push(`"${col}" = $${idx + 2}`);
            params.push(updates[k]);
          });
          await client.run(`UPDATE public.contracts SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
        }
      });
    } else {
      const list = this._getContractsCollection();
      const idx = list.findIndex(r => String(r.id) === String(contractId));
      if (idx !== -1) {
        list[idx] = updated;
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }

    await this._recordAudit(user?.id, contractId, 'CONTRACT_UPDATED', existing, updated);
    return await this.getContractById(contractId);
  }

  /**
   * حذف عقد
   */
  async deleteContract(contractId, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        await client.run('DELETE FROM public.contract_clauses WHERE contract_id = $1', [contractId]);
        await client.run('DELETE FROM public.bank_guarantees WHERE contract_id = $1', [contractId]);
        await client.run('DELETE FROM public.contract_variation_orders WHERE contract_id = $1', [contractId]);
        await client.run('DELETE FROM public.contracts WHERE id = $1', [contractId]);
      });
    } else {
      if (memDb.contract_clauses) {
        memDb.contract_clauses = memDb.contract_clauses.filter(c => String(c.contract_id) !== String(contractId));
        saveMemTable('contract_clauses');
      }
      if (memDb.bank_guarantees) {
        memDb.bank_guarantees = memDb.bank_guarantees.filter(g => String(g.contract_id) !== String(contractId));
        saveMemTable('bank_guarantees');
      }
      if (memDb.contract_variation_orders) {
        memDb.contract_variation_orders = memDb.contract_variation_orders.filter(v => String(v.contract_id) !== String(contractId));
        saveMemTable('contract_variation_orders');
      }
      if (memDb.contracts) {
        memDb.contracts = memDb.contracts.filter(r => String(r.id) !== String(contractId));
        saveMemTable('contracts');
      }
      memDb.construction_contracts = memDb.contracts || [];
      saveMemTable('construction_contracts');
    }

    await this._recordAudit(user?.id, contractId, 'CONTRACT_DELETED', existing, null);
    return { success: true, message: 'تم حذف العقد وكافة بنوده وكفالاته نهائياً بنجاح.' };
  }

  /**
   * إضافة كفالة بنكية جديدة للعقد في جدول public.bank_guarantees
   */
  async addBankGuarantee(contractId, guaranteeData, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const { guaranteeType, guarantee_type, amount, bankName, bank_name, guaranteeNumber, guarantee_number, expiryDate, expiry_date, purpose, notes } = guaranteeData;
    const gType = guaranteeType || guarantee_type || 'PERFORMANCE_BOND';
    const gAmount = this._roundCurrency(amount);
    const bName = bankName || bank_name || 'البنك المعتمد';
    const gNum = guaranteeNumber || guarantee_number || `BG-${Date.now()}`;
    const expDate = expiryDate || expiry_date;

    if (gAmount <= 0 || !expDate) {
      throw new Error('مبلغ الكفالة وتاريخ انتهاء الصلاحية حقلان إلزاميان.');
    }

    const newGuarantee = {
      id: `BG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      contract_id: existing.id,
      guaranteeNumber: gNum,
      guarantee_number: gNum,
      bankName: bName,
      bank_name: bName,
      guaranteeType: gType,
      guarantee_type: gType,
      amount: gAmount,
      expiryDate: expDate,
      expiry_date: expDate,
      purpose: purpose || 'كفالة بنكية',
      notes: notes || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    if (isPostgresActive()) {
      const issueDate = guaranteeData.issueDate || guaranteeData.issue_date || new Date().toISOString().split('T')[0];
      await withTransaction(async (client) => {
        await client.run(`
          INSERT INTO public.bank_guarantees
          (id, contract_id, guarantee_number, issuing_bank, amount, issue_date, expiry_date, guarantee_type, notes, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `, [newGuarantee.id, existing.id, gNum, bName, gAmount, issueDate, expDate, gType, newGuarantee.purpose || newGuarantee.notes || '', 'ACTIVE']);

        await client.run(`
          UPDATE public.contracts
          SET bank_name = $1, guarantee_number = $2, guarantee_value = $3, guarantee_expiry_date = $4, updated_at = NOW()
          WHERE id = $5
        `, [bName, gNum, gAmount, expDate, existing.id]);
      });
    } else {
      if (!memDb.bank_guarantees) memDb.bank_guarantees = [];
      memDb.bank_guarantees.push(newGuarantee);
      saveMemTable('bank_guarantees');

      const list = this._getContractsCollection();
      const idx = list.findIndex(c => String(c.id) === String(existing.id));
      if (idx !== -1) {
        if (!list[idx].bank_guarantees) list[idx].bank_guarantees = [];
        list[idx].bank_guarantees.push(newGuarantee);
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'BANK_GUARANTEE_ADDED', null, newGuarantee);
    return await this.getContractById(existing.id);
  }

  /**
   * استرجاع كفالات عقد محدد
   */
  async getBankGuarantees(contractId) {
    if (isPostgresActive()) {
      return await dbQuery('SELECT * FROM public.bank_guarantees WHERE contract_id = $1 ORDER BY expiry_date ASC', [contractId]) || [];
    }
    const c = await this.getContractById(contractId);
    return c ? (c.bankGuarantees || []) : [];
  }

  /**
   * تمديد كفالة بنكية
   */
  async extendBankGuarantee(guaranteeId, extensionData, user = null) {
    const { new_expiry_date, newExpiryDate, notes } = extensionData;
    const expDate = new_expiry_date || newExpiryDate;
    if (!expDate) throw new Error('تاريخ الانتهاء الجديد مطلوب.');

    if (isPostgresActive()) {
      await dbRun('UPDATE public.bank_guarantees SET expiry_date = $1, status = $2 WHERE id = $3', [expDate, 'ACTIVE', guaranteeId]);
    } else {
      if (memDb.bank_guarantees) {
        const bg = memDb.bank_guarantees.find(g => String(g.id) === String(guaranteeId));
        if (bg) {
          bg.expiry_date = expDate;
          bg.status = 'ACTIVE';
          saveMemTable('bank_guarantees');
        }
      }
    }

    await this._recordAudit(user?.id, guaranteeId, 'BANK_GUARANTEE_EXTENDED', null, { expDate, notes });
    return { success: true, message: 'تم تمديد الكفالة البنكية بنجاح.' };
  }

  /**
   * الإفراج عن كفالة بنكية
   */
  async releaseBankGuarantee(guaranteeId, releaseData = {}, user = null) {
    if (isPostgresActive()) {
      await dbRun('UPDATE public.bank_guarantees SET status = $1 WHERE id = $2', ['RELEASED', guaranteeId]);
    } else {
      if (memDb.bank_guarantees) {
        const bg = memDb.bank_guarantees.find(g => String(g.id) === String(guaranteeId));
        if (bg) {
          bg.status = 'RELEASED';
          saveMemTable('bank_guarantees');
        }
      }
    }

    await this._recordAudit(user?.id, guaranteeId, 'BANK_GUARANTEE_RELEASED', null, releaseData);
    return { success: true, message: 'تم الإفراج عن الكفالة البنكية بنجاح.' };
  }

  /**
   * إضافة أمر تغييري (Variation Order) مع فحص السقف القانوني ومزامنة الموازنة
   */
  async addVariationOrder(contractId, voData, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const { title, amount, description, extensionDays, extension_days, vo_number, justification } = voData;
    const voAmount = this._roundCurrency(amount);
    if (!title || voAmount === 0) throw new Error('عنوان الأمر التغييري ومبلغ التعديل حقلان إلزاميان.');

    // فحص السقف القانوني للأوامر التغييرية التراكمية (25% كحد أقصى)
    const baseValue = parseFloat(existing.contractValue || existing.contract_value || existing.total_value || 0);
    const existingVOs = Array.isArray(existing.variationOrders) ? existing.variationOrders : [];
    const totalPreviousVO = existingVOs.reduce((sum, vo) => sum + (parseFloat(vo.amount) || 0), 0);
    const newTotalVO = totalPreviousVO + voAmount;
    const percentageOfContract = baseValue > 0 ? (newTotalVO / baseValue) * 100 : 0;
    const isExceedingLegalLimit = percentageOfContract > 25.0;

    const voId = await numberingEngine.generateNextId('variation_orders', { prefix: 'VO' });
    const orderNumber = vo_number || `VO-${existingVOs.length + 1}`;

    const finalReason = [title, description || justification].filter(Boolean).join(' - ') || title || 'أمر تغييري';
    const newVO = {
      id: voId,
      contract_id: existing.id,
      order_number: orderNumber,
      vo_number: orderNumber,
      title,
      reason: finalReason,
      amount: voAmount,
      extensionDays: parseInt(extensionDays || extension_days, 10) || 0,
      description: description || '',
      justification: justification || '',
      percentageOfContract: Math.round(percentageOfContract * 100) / 100,
      isExceedingLimit: isExceedingLegalLimit,
      status: isExceedingLegalLimit ? 'REQUIRES_MINISTRY_APPROVAL' : 'APPROVED',
      createdAt: new Date().toISOString()
    };

    // إن كان الأمر التغييري بزيادة في القيمة، نحجز مخصصاً إضافياً في الموازنة
    if (voAmount > 0 && existing.budget_line_id) {
      try {
        await budgetEngineService.createAllocation({
          budget_line_id: existing.budget_line_id,
          entity_type: 'VARIATION_ORDER',
          entity_id: newVO.id,
          entity_name: `أمر تغييري للعقد ${existing.contractNumber}: ${title}`,
          amount: voAmount,
          status: 'COMMITTED'
        });
      } catch (be) {
        throw new Error(`تعذر حفظ الأمر التغييري لعدم توفر مخصص إضافي بالبند المالي: ${be.message}`);
      }
    }

    if (isPostgresActive()) {
      const orderType = voAmount > 0 ? 'VALUE_INCREASE' : 'VALUE_DECREASE';
      await withTransaction(async (client) => {
        await client.run(`
          INSERT INTO public.contract_variation_orders
          (id, contract_id, order_number, order_type, amount_change, time_extension_days, reason, approved_by, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          newVO.id, existing.id, newVO.order_number, orderType, voAmount,
          newVO.extensionDays, newVO.reason,
          voData.approved_by || voData.approvedBy || user?.fullName || user?.username || 'CONTRACTS_ENGINE',
          newVO.status
        ]);

        await client.run(`
          UPDATE public.contracts
          SET total_value = COALESCE(total_value, 0) + $1,
              contract_value = COALESCE(contract_value, total_value, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [voAmount, existing.id]);
      });
    } else {
      if (!memDb.contract_variation_orders) memDb.contract_variation_orders = [];
      memDb.contract_variation_orders.push({
        id: newVO.id,
        contract_id: existing.id,
        order_number: newVO.order_number,
        order_type: voAmount > 0 ? 'VALUE_INCREASE' : 'VALUE_DECREASE',
        amount_change: voAmount,
        time_extension_days: newVO.extensionDays,
        reason: newVO.description,
        status: newVO.status,
        created_at: newVO.createdAt,
        vo_number: newVO.order_number,
        title: newVO.title,
        amount: voAmount,
        extension_days: newVO.extensionDays,
        description: newVO.description
      });
      saveMemTable('contract_variation_orders');

      const c = this._getContractsCollection().find(x => String(x.id) === String(existing.id));
      if (c) {
        c.total_value = (parseFloat(c.total_value || c.contract_value || 0) + voAmount);
        c.contract_value = c.total_value;
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }

    await this._recordAudit(user?.id, existing.id, 'VARIATION_ORDER_ADDED', null, newVO);
    return await this.getContractById(existing.id);
  }

  /**
   * استرجاع الأوامر التغييرية لعقد محدد من الجدول الكنوني
   */
  async getVariationOrders(contractId) {
    if (isPostgresActive()) {
      const rows = await dbQuery('SELECT * FROM public.contract_variation_orders WHERE contract_id = $1 ORDER BY created_at DESC', [contractId]) || [];
      return this._mapCanonicalVOs(rows);
    }
    const c = await this.getContractById(contractId);
    return c ? (c.variationOrders || []) : [];
  }

  /**
   * حذف أمر تغييري وتعديل قيمة العقد تلقائياً
   */
  async deleteVariationOrder(contractId, voId, user = null) {
    if (isPostgresActive()) {
      const vo = await dbGet('SELECT * FROM public.contract_variation_orders WHERE id = $1 AND contract_id = $2', [voId, contractId]);
      if (!vo) throw new Error('الأمر التغييري غير موجود.');

      const voAmt = parseFloat(vo.amount_change || 0);
      await withTransaction(async (client) => {
        await client.run('DELETE FROM public.contract_variation_orders WHERE id = $1', [voId]);
        await client.run(`
          UPDATE public.contracts 
          SET total_value = GREATEST(0, COALESCE(total_value, 0) - $1),
              contract_value = GREATEST(0, COALESCE(contract_value, total_value, 0) - $1),
              updated_at = NOW()
          WHERE id = $2
        `, [voAmt, contractId]);
      });
    } else {
      if (memDb.contract_variation_orders) {
        memDb.contract_variation_orders = memDb.contract_variation_orders.filter(v => !(String(v.id) === String(voId) && String(v.contract_id) === String(contractId)));
        saveMemTable('contract_variation_orders');
      }
    }

    await this._recordAudit(user?.id, contractId, 'VARIATION_ORDER_DELETED', voId, null);
    return { success: true, message: 'تم حذف الأمر التغييري وتعديل قيمة العقد بنجاح.' };
  }

  /**
   * استرجاع تنبيهات استحقاق وانتهاء الكفالات البنكية لجميع العقود
   */
  async getGuaranteesAlerts() {
    const alerts = {
      within_30_days: [],
      within_60_days: [],
      within_90_days: [],
      expired: []
    };

    let bgs = [];
    if (isPostgresActive()) {
      bgs = await dbQuery(`
        SELECT bg.*, c.contract_number, c.title as contract_title, c.contractor_name
        FROM public.bank_guarantees bg
        LEFT JOIN public.contracts c ON bg.contract_id = c.id
        WHERE bg.status = 'ACTIVE' AND bg.expiry_date IS NOT NULL
        ORDER BY bg.expiry_date ASC
      `) || [];
    } else {
      const list = memDb.bank_guarantees || [];
      const contracts = this._getContractsCollection();
      bgs = list.filter(g => g.status === 'ACTIVE' && (g.expiryDate || g.expiry_date)).map(g => {
        const c = contracts.find(x => String(x.id) === String(g.contract_id)) || {};
        return {
          ...g,
          contract_number: c.contract_number || c.contractNumber,
          contract_title: c.title,
          contractor_name: c.contractor_name || c.contractorName
        };
      });
    }

    const now = new Date();
    bgs.forEach(g => {
      const rawExp = g.expiry_date || g.expiryDate;
      if (!rawExp) return;
      const expDate = new Date(rawExp);
      const diffTime = expDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const gNum = g.guarantee_number || g.guaranteeNumber;
      const bName = g.issuing_bank || g.bankName || g.bank_name;
      const alertItem = {
        ...g,
        contractId: g.contract_id,
        contract_id: g.contract_id,
        contractNumber: g.contract_number,
        contract_number: g.contract_number,
        contractTitle: g.contract_title,
        contractorName: g.contractor_name,
        guaranteeNumber: gNum,
        guarantee_number: gNum,
        bankName: bName,
        issuing_bank: bName,
        expiryDate: rawExp,
        expiry_date: rawExp,
        daysRemaining,
        days_left: daysRemaining,
        isExpired: daysRemaining < 0
      };

      if (daysRemaining < 0) {
        alerts.expired.push({ ...alertItem, alertLevel: 'DANGER' });
      } else if (daysRemaining <= 30) {
        alerts.within_30_days.push({ ...alertItem, alertLevel: 'CRITICAL' });
      } else if (daysRemaining <= 60) {
        alerts.within_60_days.push({ ...alertItem, alertLevel: 'WARNING' });
      } else if (daysRemaining <= 90) {
        alerts.within_90_days.push({ ...alertItem, alertLevel: 'INFO' });
      }
    });

    return alerts;
  }

  /**
   * إدارة البنود العقدية (Contract Clauses)
   */
  async getClauses(contractId) {
    if (isPostgresActive()) {
      return await dbQuery('SELECT * FROM public.contract_clauses WHERE contract_id = $1 ORDER BY clause_number ASC', [contractId]) || [];
    }
    const list = memDb.contract_clauses || [];
    return list.filter(c => String(c.contract_id) === String(contractId));
  }

  async addClause(contractId, clauseData, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const { clause_number, title, content, display_order } = clauseData;
    const clauseId = `CLS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const cNum = parseInt(clause_number, 10) || 1;

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.contract_clauses (id, contract_id, clause_number, title, content, display_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [clauseId, existing.id, cNum, title || 'بند عقدي', content || '', display_order || cNum]);
    } else {
      if (!memDb.contract_clauses) memDb.contract_clauses = [];
      memDb.contract_clauses.push({
        id: clauseId, contract_id: existing.id, clause_number: cNum, title, content, display_order: cNum
      });
      saveMemTable('contract_clauses');
    }
    return { id: clauseId, contract_id: existing.id, clause_number: cNum, title, content };
  }

  async updateClause(contractId, clauseId, clauseData, user = null) {
    const { title, content, clause_number, display_order } = clauseData;
    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.contract_clauses 
        SET title = COALESCE($1, title), content = COALESCE($2, content),
            clause_number = COALESCE($3, clause_number), display_order = COALESCE($4, display_order)
        WHERE id = $5 AND contract_id = $6
      `, [title, content, clause_number, display_order, clauseId, contractId]);
    } else {
      const list = memDb.contract_clauses || [];
      const item = list.find(c => String(c.id) === String(clauseId) && String(c.contract_id) === String(contractId));
      if (item) {
        if (title !== undefined) item.title = title;
        if (content !== undefined) item.content = content;
        if (clause_number !== undefined) item.clause_number = clause_number;
        saveMemTable('contract_clauses');
      }
    }
    return { success: true };
  }

  async deleteClause(contractId, clauseId, user = null) {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM public.contract_clauses WHERE id = $1 AND contract_id = $2', [clauseId, contractId]);
    } else {
      if (memDb.contract_clauses) {
        memDb.contract_clauses = memDb.contract_clauses.filter(c => !(String(c.id) === String(clauseId) && String(c.contract_id) === String(contractId)));
        saveMemTable('contract_clauses');
      }
    }
    return { success: true };
  }

  async reorderClauses(contractId, clauseIds, user = null) {
    if (!Array.isArray(clauseIds)) throw new Error('ترتيب البنود غير صالح.');
    if (isPostgresActive()) {
      await withTransaction(async (client) => {
        for (let i = 0; i < clauseIds.length; i++) {
          await client.run(
            'UPDATE public.contract_clauses SET clause_number = $1, display_order = $1 WHERE id = $2 AND contract_id = $3',
            [i + 1, clauseIds[i], contractId]
          );
        }
      });
    } else {
      const list = memDb.contract_clauses || [];
      clauseIds.forEach((cId, idx) => {
        const item = list.find(c => String(c.id) === String(cId) && String(c.contract_id) === String(contractId));
        if (item) {
          item.clause_number = idx + 1;
          item.display_order = idx + 1;
        }
      });
      saveMemTable('contract_clauses');
    }
    return { success: true, message: 'تم إعادة ترتيب بنود العقد بنجاح' };
  }

  async duplicateClause(contractId, clauseId, user = null) {
    let target = null;
    let newNum = 1;
    if (isPostgresActive()) {
      target = await dbGet('SELECT * FROM public.contract_clauses WHERE id = $1 AND contract_id = $2', [clauseId, contractId]);
      if (!target) throw new Error('البند غير موجود.');
      const cntRes = await dbGet('SELECT COUNT(*) as cnt FROM public.contract_clauses WHERE contract_id = $1', [contractId]);
      newNum = parseInt(cntRes?.cnt || 0, 10) + 1;
    } else {
      const list = memDb.contract_clauses || [];
      target = list.find(c => String(c.id) === String(clauseId) && String(c.contract_id) === String(contractId));
      if (!target) throw new Error('البند غير موجود.');
      newNum = list.filter(c => String(c.contract_id) === String(contractId)).length + 1;
    }

    const newClauseId = `CLS-${contractId}-${Date.now()}`;
    const duplicatedObj = {
      ...target,
      id: newClauseId,
      contract_id: contractId,
      clause_number: newNum,
      clause_code: `C-${newNum}`,
      title: `${target.title} (نسخة مكررة)`,
      content: target.content,
      display_order: newNum,
      is_mandatory: target.is_mandatory !== false,
      is_optional: target.is_optional === true,
      show_in_print: target.show_in_print !== false,
      show_in_electronic: target.show_in_electronic !== false,
      created_at: new Date().toISOString()
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.contract_clauses 
        (id, contract_id, clause_number, clause_code, title, content, display_order, is_mandatory, is_optional, show_in_print, show_in_electronic, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [newClauseId, contractId, newNum, `C-${newNum}`, duplicatedObj.title, target.content, newNum,
          duplicatedObj.is_mandatory, duplicatedObj.is_optional, duplicatedObj.show_in_print, duplicatedObj.show_in_electronic]);
    } else {
      if (!memDb.contract_clauses) memDb.contract_clauses = [];
      memDb.contract_clauses.push(duplicatedObj);
      saveMemTable('contract_clauses');
    }
    return duplicatedObj;
  }

  async updateCustomTemplate(contractId, templateData, user = null) {
    const { title, firstPartyInfo, secondPartyInfo, notes } = templateData;
    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.contracts
        SET title = COALESCE($1, title),
            first_party_info = COALESCE($2::jsonb, first_party_info),
            second_party_info = COALESCE($3::jsonb, second_party_info),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5
      `, [title || null, firstPartyInfo ? JSON.stringify(firstPartyInfo) : null, secondPartyInfo ? JSON.stringify(secondPartyInfo) : null, notes !== undefined ? notes : null, contractId]);
    } else {
      const list = this._getContractsCollection();
      const item = list.find(c => String(c.id) === String(contractId));
      if (item) {
        if (title) item.title = title;
        if (firstPartyInfo) item.first_party_info = firstPartyInfo;
        if (secondPartyInfo) item.second_party_info = secondPartyInfo;
        if (notes !== undefined) item.notes = notes;
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }
    return { id: contractId, title: title || null, first_party_info: firstPartyInfo, second_party_info: secondPartyInfo, notes };
  }

  async updateBankGuaranteeAction(guaranteeId, action, data = {}, user = null) {
    const { newExpiryDate } = data;
    if (isPostgresActive()) {
      if (action === 'renew') {
        await dbRun('UPDATE public.bank_guarantees SET expiry_date = $1, status = $2, updated_at = NOW() WHERE id = $3', [newExpiryDate, 'ACTIVE', guaranteeId]);
      } else if (action === 'confiscate') {
        await dbRun('UPDATE public.bank_guarantees SET status = $1, updated_at = NOW() WHERE id = $2', ['CONFISCATED', guaranteeId]);
      } else if (action === 'release') {
        await dbRun('UPDATE public.bank_guarantees SET status = $1, updated_at = NOW() WHERE id = $2', ['RELEASED', guaranteeId]);
      } else {
        throw new Error(`إجراء غير معروف على الكفالة: [${action}]`);
      }
    } else {
      if (memDb.bank_guarantees) {
        const bg = memDb.bank_guarantees.find(g => String(g.id) === String(guaranteeId));
        if (bg) {
          if (action === 'renew') {
            bg.expiry_date = newExpiryDate;
            bg.status = 'ACTIVE';
          } else if (action === 'confiscate') {
            bg.status = 'CONFISCATED';
          } else if (action === 'release') {
            bg.status = 'RELEASED';
          }
          saveMemTable('bank_guarantees');
        }
      }
    }
    await this._recordAudit(user?.id, guaranteeId, `BANK_GUARANTEE_${action.toUpperCase()}`, null, { action, ...data });
    return { success: true, message: `تم تنفيذ إجراء (${action}) على الكفالة بنجاح` };
  }

  async extendContractGuarantee(contractId, extensionData, user = null) {
    const { newExpiryDate, bankLetterRef, notes } = extensionData;
    if (!newExpiryDate) throw new Error('تاريخ التمديد الجديد مطلوب');

    const extRecord = {
      id: `EXT-${Date.now()}`,
      extension_date: new Date().toISOString().split('T')[0],
      new_expiry_date: newExpiryDate,
      bank_letter_ref: bankLetterRef || '',
      extended_by: user ? (user.fullName || user.username) : 'SYSTEM',
      notes: notes || 'تمديد الكفالة البنكية بموجب كتاب البنك'
    };

    if (isPostgresActive()) {
      const existing = await dbGet('SELECT id FROM public.contracts WHERE id = $1', [contractId]);
      if (!existing) throw new Error('العقد غير موجود');

      await dbRun(`
        UPDATE public.contracts 
        SET guarantee_expiry_date = $1,
            guarantee_extensions = COALESCE(guarantee_extensions, '[]'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $3
      `, [newExpiryDate, JSON.stringify([extRecord]), contractId]);
    } else {
      const list = this._getContractsCollection();
      const item = list.find(c => String(c.id) === String(contractId));
      if (!item) throw new Error('العقد غير موجود');
      item.guarantee_expiry_date = newExpiryDate;
      if (!item.guarantee_extensions) item.guarantee_extensions = [];
      item.guarantee_extensions.push(extRecord);
      saveMemTable('contracts');
      saveMemTable('construction_contracts');
    }

    await this._recordAudit(user?.id, contractId, 'CONTRACT_GUARANTEE_EXTENDED', null, extRecord);
    return {
      success: true,
      message: `تم تمديد الكفالة البنكية بنجاح حتى تاريخ ${newExpiryDate}`,
      new_expiry_date: newExpiryDate,
      extension: extRecord
    };
  }

  async getContractTypes() {
    if (isPostgresActive()) {
      return await dbQuery('SELECT * FROM public.contract_types ORDER BY created_at ASC') || [];
    }
    return memDb.contract_types || [];
  }

  async getProcurements() {
    let procurements = [];
    if (isPostgresActive()) {
      try {
        const tenders = await dbQuery('SELECT * FROM public.tenders ORDER BY id DESC') || [];
        tenders.forEach(t => {
          procurements.push({
            procurement_type: 'TENDER',
            procurement_type_name: 'عطاء',
            procurement_id: t.id,
            project_name: t.name,
            tender_number: t.id,
            contractor_name: t.contractor || 'غير محدد',
            value: parseFloat(t.value || t.budget || 0),
            award_decision_number: `DEC-${t.id}`,
            award_date: t.openDate || new Date().toISOString().split('T')[0],
            execution_period_days: 60,
            department: 'قسم المشروعات والعطاءات',
            funding_source: 'موازنة البلدية الذاتية',
            supervising_engineer: 'م. أحمد الخشمان',
            handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي', 'رئيس القسم'],
            guarantee_percentage: 10,
            raw_data: t
          });
        });
      } catch (e) {}

      try {
        const purchases = await dbQuery('SELECT * FROM public.purchases ORDER BY id DESC') || [];
        purchases.forEach(p => {
          procurements.push({
            procurement_type: 'DIRECT_PURCHASE',
            procurement_type_name: 'شراء مباشر / أمر شراء',
            procurement_id: p.id,
            project_name: p.itemDescription || p.supplier,
            tender_number: p.id,
            contractor_name: p.supplier || 'غير محدد',
            value: parseFloat(p.amount || 0),
            award_decision_number: `PUR-DEC-${p.id}`,
            award_date: p.date || new Date().toISOString().split('T')[0],
            execution_period_days: 15,
            department: 'قسم المشتريات واللوازم',
            funding_source: 'موازنة البلدية الذاتية',
            supervising_engineer: 'م. سامر الفريحات',
            handover_committee: ['رئيس القسم', 'أمين المستودع'],
            guarantee_percentage: 5,
            raw_data: p
          });
        });
      } catch (e) {}
    } else {
      const tenders = memDb.tenders || [];
      tenders.forEach(t => {
        procurements.push({
          procurement_type: 'TENDER',
          procurement_type_name: 'عطاء',
          procurement_id: t.id,
          project_name: t.name,
          tender_number: t.id,
          contractor_name: t.contractor || 'غير محدد',
          value: parseFloat(t.value || t.budget || 0),
          award_decision_number: `DEC-${t.id}`,
          award_date: t.openDate || new Date().toISOString().split('T')[0],
          execution_period_days: 60,
          department: 'قسم المشروعات والعطاءات',
          funding_source: 'موازنة البلدية الذاتية',
          supervising_engineer: 'م. أحمد الخشمان',
          handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي', 'رئيس القسم'],
          guarantee_percentage: 10,
          raw_data: t
        });
      });
    }
    return procurements;
  }

  async getProcurementDetails(type, id) {
    let details = null;
    if (type === 'TENDER' || type === 'tenders') {
      if (isPostgresActive()) {
        try {
          const t = await dbGet('SELECT * FROM public.tenders WHERE id = $1', [id]);
          if (t) {
            details = {
              procurement_type: 'TENDER',
              procurement_id: t.id,
              project_name: t.name,
              tender_name: t.name,
              tender_number: t.id,
              award_decision_number: `DEC-${t.id}`,
              contractor_name: t.contractor || 'غير محدد',
              contractor_id: 'CTR-' + String(t.contractor || '001').replace(/\s+/g, ''),
              total_value: parseFloat(t.value || t.budget || 0),
              execution_period_days: 60,
              award_date: t.openDate || new Date().toISOString().split('T')[0],
              department: 'قسم المشروعات والعطاءات',
              funding_source: 'موازنة البلدية الذاتية',
              supervising_engineer: 'م. أحمد الخشمان',
              handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي', 'ممثل المالية'],
              guarantee_percentage: 10,
              required_guarantees: ['ضمان حسن التنفيذ (10%)', 'ضمان الصيانة (5%)'],
              attachments: t.attachments || []
            };
          }
        } catch (e) {}
      }
    }
    if (!details) {
      details = {
        procurement_type: type || 'TENDER',
        procurement_id: id,
        project_name: `مشروع العملية الشرائية ${id}`,
        tender_name: `عطاء رقم ${id}`,
        tender_number: id,
        award_decision_number: `DEC-${id}`,
        contractor_name: 'مؤسسة الخدمات العامة والمقاولات',
        contractor_id: 'CTR-9901',
        total_value: 50000,
        execution_period_days: 60,
        award_date: new Date().toISOString().split('T')[0],
        department: 'مديرية الأشغال والخدمات الهندسية',
        funding_source: 'موازنة البلدية',
        supervising_engineer: 'مهندس الأشغال المشرف',
        handover_committee: ['م. أحمد الخشمان', 'م. خالد الصمادي'],
        guarantee_percentage: 10,
        required_guarantees: ['ضمان حسن التنفيذ (10%)', 'ضمان الصيانة (5%)'],
        attachments: []
      };
    }
    return details;
  }

  /**
   * انتقال مسار العمل (Workflow Transition)
   */
  async transitionWorkflow(contractId, workflowData, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const { status, approval_stage, stage, notes } = workflowData;
    const targetStatus = status || existing.status;
    const targetStage = approval_stage || stage || existing.approval_stage || 'PREPARED';
    const transitionEntry = {
      status: targetStatus,
      stage: targetStage,
      date: new Date().toISOString(),
      user: user?.username || user?.fullName || 'SYSTEM',
      note: notes || ''
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.contracts
        SET status = $1,
            approval_stage = $2,
            workflow_history = COALESCE(workflow_history, '[]'::jsonb) || $3::jsonb,
            updated_at = NOW()
        WHERE id = $4
      `, [targetStatus, targetStage, JSON.stringify([transitionEntry]), existing.id]);
    } else {
      const list = this._getContractsCollection();
      const item = list.find(c => String(c.id) === String(existing.id));
      if (item) {
        item.status = targetStatus;
        item.approval_stage = targetStage;
        if (!item.workflow_history) item.workflow_history = [];
        item.workflow_history.push(transitionEntry);
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }
    await this._recordAudit(user?.id, existing.id, 'CONTRACT_WORKFLOW_TRANSITION', existing.status, targetStatus);
    return await this.getContractById(existing.id);
  }

  /**
   * التوقيع الرقمي الإلكتروني المعتمد للعقد
   */
  async signContract(contractId, signData, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const signerRole = signData.signer_role || 'SECOND_PARTY';
    const signerName = signData.signer_name || user?.fullName || user?.username || 'المفوض بالتوقيع';
    const signDate = new Date().toISOString();
    const signatureHash = crypto.createHash('sha256').update(`${contractId}|${signerRole}|${signerName}|${signDate}`).digest('hex');

    const signatureEntry = {
      signer_role: signerRole,
      signer_name: signerName,
      signed_at: signDate,
      signature_hash: signatureHash,
      ip: signData.ip || '127.0.0.1'
    };

    if (isPostgresActive()) {
      await dbRun(`
        UPDATE public.contracts
        SET digital_signatures = COALESCE(digital_signatures, '[]'::jsonb) || $1::jsonb,
            sha256_hash = $2,
            status = 'ELECTRONICALLY_SIGNED',
            updated_at = NOW()
        WHERE id = $3
      `, [JSON.stringify([signatureEntry]), signatureHash, existing.id]);
    } else {
      const list = this._getContractsCollection();
      const item = list.find(c => String(c.id) === String(existing.id));
      if (item) {
        if (!item.digital_signatures) item.digital_signatures = [];
        item.digital_signatures.push(signatureEntry);
        item.sha256_hash = signatureHash;
        item.status = 'ELECTRONICALLY_SIGNED';
        saveMemTable('contracts');
        saveMemTable('construction_contracts');
      }
    }
    await this._recordAudit(user?.id, existing.id, 'CONTRACT_DIGITALLY_SIGNED', null, signatureEntry);
    return await this.getContractById(existing.id);
  }

  /**
   * الإحصائيات التنفيذية
   */
  async getKpis() {
    let totalContracts = 0;
    let activeContracts = 0;
    let completedContracts = 0;
    let totalValueSum = 0;
    let totalGuaranteesCount = 0;

    if (isPostgresActive()) {
      const cRow = await dbGet(`
        SELECT COUNT(*) as count,
               COUNT(CASE WHEN status IN ('ACTIVE', 'ELECTRONICALLY_SIGNED') THEN 1 END) as active_count,
               COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_count,
               COALESCE(SUM(total_value), 0) as total_val
        FROM public.contracts
      `);
      totalContracts = parseInt(cRow?.count || 0, 10);
      activeContracts = parseInt(cRow?.active_count || 0, 10);
      completedContracts = parseInt(cRow?.completed_count || 0, 10);
      totalValueSum = parseFloat(cRow?.total_val || 0);

      const gRow = await dbGet("SELECT COUNT(*) as count FROM public.bank_guarantees");
      totalGuaranteesCount = parseInt(gRow?.count || 0, 10);
    } else {
      const list = this._getContractsCollection();
      totalContracts = list.length;
      activeContracts = list.filter(c => c.status === 'ACTIVE' || c.status === 'ELECTRONICALLY_SIGNED').length;
      completedContracts = list.filter(c => c.status === 'COMPLETED').length;
      totalValueSum = list.reduce((acc, curr) => acc + (parseFloat(curr.total_value || curr.contract_value || 0) || 0), 0);
      totalGuaranteesCount = (memDb.bank_guarantees || []).length;
    }

    return {
      total_contracts: totalContracts,
      active_contracts: activeContracts,
      completed_contracts: completedContracts,
      total_value_jod: this._roundCurrency(totalValueSum),
      total_guarantees_count: totalGuaranteesCount
    };
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalContracts = 0;
    let totalValue = 0;
    try {
      if (isPostgresActive()) {
        const res = await dbGet('SELECT COUNT(*) as count, COALESCE(SUM(total_value), 0) as total FROM public.contracts');
        totalContracts = parseInt(res?.count || 0, 10);
        totalValue = parseFloat(res?.total || 0);
      } else {
        const list = this._getContractsCollection();
        totalContracts = list.length;
        totalValue = list.reduce((sum, c) => sum + parseFloat(c.contract_value || c.contractValue || c.total_value || c.totalValue || 0), 0);
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        engineName: this.engineName,
        version: this.version,
        totalContractsCount: totalContracts,
        totalContractsValue: this._roundCurrency(totalValue),
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

module.exports = new ContractsEngineService();
