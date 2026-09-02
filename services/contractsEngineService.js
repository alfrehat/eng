/**
 * services/contractsEngineService.js
 * 📜 محرك إدارة العقود الإنشائية، الكفالات البنكية والأوامر التغييرية (CONTRACTS_ENGINE — Phase 05-B)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * 
 * المبادئ المعمارية والتنظيمية:
 * 1. إدارة دورة حياة العقود الهندسية والإنشائية والربط مع العطاءات والمشاريع.
 * 2. إدارة وتتبع الكفالات البنكية (حسن تنفيذ، دخول، صيانة، دفعة مقدمة) والتمديد والتسييل والإفراج.
 * 3. إدارة الأوامر التغييرية مع التحقق الصارم من السقف القانوني (25%) ومطابقة الموازنات.
 * 4. رصد تواريخ استحقاق الكفالات وتوليد التنبيهات الاستباقية للبلدية.
 * 5. التكامل المؤسسي مع سجل التدقيق والمحركات عبر EngineOrchestrator.
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable,
  generateSequenceId
} = require('../utils/database');
const { logInfo, logWarn, logError } = require('./loggerService');

class ContractsEngineService {
  constructor() {
    this.engineId = 'CONTRACTS_ENGINE';
    this.engineName = 'Enterprise Contract Management & Bank Guarantees Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'contract_crud',
      'bank_guarantees_tracking',
      'variation_orders_management',
      'guarantee_alerts',
      'legal_limit_enforcement'
    ];
  }

  /**
   * تسجيل حركة في سجل التدقيق المؤسسي
   */
  async _recordAudit(userId, entityId, action, oldValue, newValue, ip = '127.0.0.1') {
    try {
      const details = `إجراء العقود [${action}] على المعرف [${entityId}]: ${JSON.stringify({ old: oldValue, new: newValue })}`;
      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'العقود والضمانات البنكية', entityId, details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-CNT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: 'العقود والضمانات البنكية',
          entityId,
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      logWarn('ContractsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ إدارة العقود (Contracts CRUD & Smart Search)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * استرجاع قائمة العقود مع الفلاتر والبحث
   */
  async getContracts(filters = {}) {
    const { search, status, contractor, tenderId } = filters;
    if (isPostgresActive()) {
      let query = `
        SELECT c.*, 
               ct.name as contract_type_name,
               COALESCE((SELECT json_agg(bg.*) FROM public.bank_guarantees bg WHERE bg.contract_id = c.id), '[]'::json) as guarantees_list,
               COALESCE((SELECT json_agg(vo.*) FROM public.contract_variation_orders vo WHERE vo.contract_id = c.id), '[]'::json) as variation_orders_list
        FROM public.contracts c
        LEFT JOIN public.contract_types ct ON c.contract_type_id = ct.id
        WHERE 1=1
      `;
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (c.id ILIKE $${params.length} OR c.title ILIKE $${params.length} OR c.contract_number ILIKE $${params.length} OR c.contractor_name ILIKE $${params.length})`;
      }
      if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }
      if (contractor) {
        params.push(`%${contractor}%`);
        query += ` AND c.contractor_name ILIKE $${params.length}`;
      }
      if (tenderId) {
        params.push(tenderId);
        query += ` AND c.tender_id = $${params.length}`;
      }
      query += ' ORDER BY c.created_at DESC';
      return await dbQuery(query, params) || [];
    } else {
      let rows = (memDb.contracts || []).filter(c => {
        if (search && !(`${c.id} ${c.title || ''} ${c.contract_number || ''} ${c.contractor_name || ''}`).toLowerCase().includes(search.toLowerCase())) return false;
        if (status && c.status !== status) return false;
        if (contractor && !String(c.contractor_name || '').toLowerCase().includes(contractor.toLowerCase())) return false;
        if (tenderId && c.tender_id !== tenderId) return false;
        return true;
      }).sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));

      return rows.map(c => ({
        ...c,
        guarantees_list: (memDb.bank_guarantees || []).filter(g => g.contract_id === c.id),
        variation_orders_list: (memDb.contract_variation_orders || []).filter(v => v.contract_id === c.id)
      }));
    }
  }

  /**
   * استرجاع تفاصيل عقد محدد
   */
  async getContractById(contractId) {
    if (!contractId) return null;
    if (isPostgresActive()) {
      const contract = await dbGet(`
        SELECT c.*, ct.name as contract_type_name
        FROM public.contracts c
        LEFT JOIN public.contract_types ct ON c.contract_type_id = ct.id
        WHERE c.id = $1
      `, [contractId]);
      if (!contract) return null;
      const bgs = await dbQuery('SELECT * FROM public.bank_guarantees WHERE contract_id = $1', [contractId]);
      const vos = await dbQuery('SELECT * FROM public.contract_variation_orders WHERE contract_id = $1', [contractId]);
      return { ...contract, guarantees_list: bgs || [], variation_orders_list: vos || [] };
    } else {
      const c = (memDb.contracts || []).find(r => r.id === contractId);
      if (!c) return null;
      return {
        ...c,
        guarantees_list: (memDb.bank_guarantees || []).filter(g => g.contract_id === contractId),
        variation_orders_list: (memDb.contract_variation_orders || []).filter(v => v.contract_id === contractId)
      };
    }
  }

  /**
   * إنشاء عقد جديد
   */
  async createContract(contractData, user = null) {
    const {
      title, tender_id, tenderId, contract_number, contractNumber, contractor_name, contractorName,
      total_value, totalValue, start_date, startDate, end_date, endDate, supervising_engineer,
      department, funding_source, execution_period_days, guarantee_value, bank_name, guarantee_number,
      guarantee_expiry_date
    } = contractData;

    const id = `CNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const actualTitle = title || `عقد تنفيذ ${contractor_name || contractorName || 'مشروع هندسي'}`;
    const actualContractNumber = contract_number || contractNumber || id;
    const actualContractor = contractor_name || contractorName || 'مقاول محلي';
    const actualValue = parseFloat(total_value || totalValue || 0);
    const now = new Date().toISOString();

    const contractRecord = {
      id,
      tender_id: tender_id || tenderId || null,
      contract_number: actualContractNumber,
      title: actualTitle,
      contractor_name: actualContractor,
      total_value: actualValue,
      start_date: start_date || startDate || now.split('T')[0],
      end_date: end_date || endDate || null,
      supervising_engineer: supervising_engineer || 'م. المشرف الهندسي',
      department: department || 'مديرية الأشغال الهندسية',
      funding_source: funding_source || 'موازنة البلدية',
      execution_period_days: parseInt(execution_period_days, 10) || 60,
      status: 'ACTIVE',
      created_by: user?.id || 'SYSTEM',
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.contracts 
        (id, tender_id, contract_number, title, contractor_name, total_value, start_date, end_date, supervising_engineer, department, funding_source, execution_period_days, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      `, [
        id, contractRecord.tender_id, contractRecord.contract_number, contractRecord.title,
        contractRecord.contractor_name, contractRecord.total_value, contractRecord.start_date,
        contractRecord.end_date, contractRecord.supervising_engineer, contractRecord.department,
        contractRecord.funding_source, contractRecord.execution_period_days, contractRecord.status,
        contractRecord.created_by
      ]);
    } else {
      if (!memDb.contracts) memDb.contracts = [];
      memDb.contracts.unshift(contractRecord);
      saveMemTable('contracts');
    }

    // إضافة الكفالة المرفقة إن وجدت
    if (guarantee_value || guarantee_number) {
      await this.addBankGuarantee(id, {
        guarantee_number: guarantee_number || `BG-${Date.now()}`,
        bank_name: bank_name || 'البنك الإسلامي الأردني',
        amount: parseFloat(guarantee_value) || (actualValue * 0.10),
        expiry_date: guarantee_expiry_date || null,
        guarantee_type: 'PERFORMANCE',
        purpose: 'كفالة حسن تنفيذ'
      }, user);
    }

    await this._recordAudit(user?.id, id, 'CONTRACT_CREATED', null, contractRecord);
    return await this.getContractById(id);
  }

  /**
   * تعديل عقد
   */
  async updateContract(contractId, updates, user = null) {
    const existing = await this.getContractById(contractId);
    if (!existing) throw new Error(`العقد [${contractId}] غير موجود.`);

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: now };

    if (isPostgresActive()) {
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        let setClauses = [];
        const params = [contractId];
        keys.forEach((k, idx) => {
          setClauses.push(`"${k}" = $${idx + 2}`);
          params.push(updates[k]);
        });
        await dbRun(`UPDATE public.contracts SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
      }
    } else {
      const idx = (memDb.contracts || []).findIndex(r => r.id === contractId);
      if (idx !== -1) {
        memDb.contracts[idx] = updated;
        saveMemTable('contracts');
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
      await dbRun('DELETE FROM public.contracts WHERE id = $1', [contractId]);
    } else {
      memDb.contracts = (memDb.contracts || []).filter(r => r.id !== contractId);
      saveMemTable('contracts');
    }

    await this._recordAudit(user?.id, contractId, 'CONTRACT_DELETED', existing, null);
    return { success: true, message: 'تم حذف العقد بنجاح.' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ إدارة الأوامر التغييرية (Variation Orders & Legal 25% Limit)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إضافة وتوثيق أمر تغييري لعقد
   */
  async addVariationOrder(contractId, voData, user = null) {
    const contract = await this.getContractById(contractId);
    if (!contract) throw new Error(`العقد [${contractId}] غير موجود.`);

    const { vo_number, title, amount, extension_days, description, justification } = voData;
    const voAmount = parseFloat(amount || 0);

    // التحقق من السقف القانوني للأوامر التغييرية التراكمية (الحد الأقصى 25% من قيمة العقد الأصلية)
    const existingVOs = await this.getVariationOrders(contractId);
    const totalPreviousVOAmount = existingVOs.reduce((sum, vo) => sum + (parseFloat(vo.amount) || 0), 0);
    const newTotalVOAmount = totalPreviousVOAmount + voAmount;
    const contractBaseValue = parseFloat(contract.total_value || 0);

    const percentageOfContract = contractBaseValue > 0 ? (newTotalVOAmount / contractBaseValue) * 100 : 0;
    const isExceedingLegalLimit = percentageOfContract > 25.0;

    const voId = `VO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const record = {
      id: voId,
      contract_id: contractId,
      vo_number: vo_number || `VO-${existingVOs.length + 1}`,
      title: title || `أمر تغييري رقم ${existingVOs.length + 1}`,
      amount: voAmount,
      extension_days: parseInt(extension_days, 10) || 0,
      description: description || '',
      justification: justification || '',
      percentage_of_contract: Math.round(percentageOfContract * 100) / 100,
      is_exceeding_limit: isExceedingLegalLimit,
      status: isExceedingLegalLimit ? 'REQUIRES_MINISTRY_APPROVAL' : 'APPROVED',
      created_by: user?.id || 'SYSTEM',
      created_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.contract_variation_orders
        (id, contract_id, vo_number, title, amount, extension_days, description, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [voId, contractId, record.vo_number, record.title, voAmount, record.extension_days, record.description, record.status]);
    } else {
      if (!memDb.contract_variation_orders) memDb.contract_variation_orders = [];
      memDb.contract_variation_orders.push(record);
      saveMemTable('contract_variation_orders');
    }

    await this._recordAudit(user?.id, voId, 'VARIATION_ORDER_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع الأوامر التغييرية لعقد
   */
  async getVariationOrders(contractId) {
    if (isPostgresActive()) {
      return await dbQuery('SELECT * FROM public.contract_variation_orders WHERE contract_id = $1 ORDER BY created_at ASC', [contractId]) || [];
    } else {
      return (memDb.contract_variation_orders || []).filter(v => v.contract_id === contractId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ إدارة الكفالات البنكية (Bank Guarantees & Expiry Alerts)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * إضافة كفالة بنكية لعقد
   */
  async addBankGuarantee(contractId, bgData, user = null) {
    const { guarantee_number, bank_name, amount, expiry_date, guarantee_type, purpose, notes } = bgData;
    const bgId = `BG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const record = {
      id: bgId,
      contract_id: contractId,
      guarantee_number: guarantee_number || `BG-${Date.now()}`,
      bank_name: bank_name || 'البنك الإسلامي الأردني',
      amount: parseFloat(amount || 0),
      expiry_date: expiry_date || null,
      guarantee_type: guarantee_type || 'PERFORMANCE',
      purpose: purpose || 'كفالة حسن تنفيذ',
      status: 'ACTIVE',
      notes: notes || '',
      created_by: user?.id || 'SYSTEM',
      created_at: now
    };

    if (isPostgresActive()) {
      await dbRun(`
        INSERT INTO public.bank_guarantees
        (id, contract_id, guarantee_number, bank_name, amount, expiry_date, guarantee_type, purpose, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [bgId, contractId, record.guarantee_number, record.bank_name, record.amount, record.expiry_date, record.guarantee_type, record.purpose, record.status]);
    } else {
      if (!memDb.bank_guarantees) memDb.bank_guarantees = [];
      memDb.bank_guarantees.push(record);
      saveMemTable('bank_guarantees');
    }

    await this._recordAudit(user?.id, bgId, 'BANK_GUARANTEE_CREATED', null, record);
    return record;
  }

  /**
   * استرجاع كفالات عقد
   */
  async getBankGuarantees(contractId) {
    if (isPostgresActive()) {
      return await dbQuery('SELECT * FROM public.bank_guarantees WHERE contract_id = $1 ORDER BY expiry_date ASC', [contractId]) || [];
    } else {
      return (memDb.bank_guarantees || []).filter(g => g.contract_id === contractId);
    }
  }

  /**
   * تمديد كفالة بنكية
   */
  async extendBankGuarantee(guaranteeId, extensionData, user = null) {
    const { new_expiry_date, notes } = extensionData;
    if (!new_expiry_date) throw new Error('تاريخ الانتهاء الجديد مطلوب.');

    if (isPostgresActive()) {
      await dbRun('UPDATE public.bank_guarantees SET expiry_date = $1, status = $2 WHERE id = $3', [new_expiry_date, 'ACTIVE', guaranteeId]);
    } else {
      const idx = (memDb.bank_guarantees || []).findIndex(g => g.id === guaranteeId);
      if (idx !== -1) {
        memDb.bank_guarantees[idx].expiry_date = new_expiry_date;
        memDb.bank_guarantees[idx].status = 'ACTIVE';
        saveMemTable('bank_guarantees');
      }
    }

    await this._recordAudit(user?.id, guaranteeId, 'BANK_GUARANTEE_EXTENDED', null, { new_expiry_date, notes });
    return { success: true, message: 'تم تمديد الكفالة البنكية بنجاح.' };
  }

  /**
   * الإفراج عن كفالة بنكية
   */
  async releaseBankGuarantee(guaranteeId, releaseData = {}, user = null) {
    if (isPostgresActive()) {
      await dbRun('UPDATE public.bank_guarantees SET status = $1 WHERE id = $2', ['RELEASED', guaranteeId]);
    } else {
      const idx = (memDb.bank_guarantees || []).findIndex(g => g.id === guaranteeId);
      if (idx !== -1) {
        memDb.bank_guarantees[idx].status = 'RELEASED';
        saveMemTable('bank_guarantees');
      }
    }

    await this._recordAudit(user?.id, guaranteeId, 'BANK_GUARANTEE_RELEASED', null, releaseData);
    return { success: true, message: 'تم الإفراج عن الكفالة البنكية بنجاح.' };
  }

  /**
   * استرجاع تنبيهات استحقاق وانتهاء الكفالات البنكية
   */
  async getGuaranteesAlerts() {
    let list = [];
    if (isPostgresActive()) {
      list = await dbQuery(`
        SELECT bg.*, c.title as contract_title, c.contractor_name, c.contract_number
        FROM public.bank_guarantees bg
        LEFT JOIN public.contracts c ON bg.contract_id = c.id
        WHERE bg.status = 'ACTIVE'
        ORDER BY bg.expiry_date ASC
      `) || [];
    } else {
      list = (memDb.bank_guarantees || []).filter(g => g.status === 'ACTIVE').map(g => {
        const c = (memDb.contracts || []).find(cnt => cnt.id === g.contract_id) || {};
        return { ...g, contract_title: c.title, contractor_name: c.contractor_name, contract_number: c.contract_number };
      });
    }

    const now = new Date();
    const alerts = {
      within_30_days: [],
      within_60_days: [],
      within_90_days: [],
      expired: []
    };

    list.forEach(g => {
      if (!g.expiry_date) return;
      const expiry = new Date(g.expiry_date);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        alerts.expired.push({ ...g, days_left: diffDays, alert_level: 'DANGER' });
      } else if (diffDays <= 30) {
        alerts.within_30_days.push({ ...g, days_left: diffDays, alert_level: 'CRITICAL' });
      } else if (diffDays <= 60) {
        alerts.within_60_days.push({ ...g, days_left: diffDays, alert_level: 'WARNING' });
      } else if (diffDays <= 90) {
        alerts.within_90_days.push({ ...g, days_left: diffDays, alert_level: 'INFO' });
      }
    });

    return alerts;
  }

  /**
   * فحص الصحة والمؤشرات التشغيلية للمحرك
   */
  async healthCheck() {
    let totalContracts = 0;
    let totalGuarantees = 0;
    try {
      if (isPostgresActive()) {
        const cRes = await dbGet('SELECT COUNT(*) as count FROM public.contracts');
        const gRes = await dbGet('SELECT COUNT(*) as count FROM public.bank_guarantees');
        totalContracts = parseInt(cRes?.count || 0, 10);
        totalGuarantees = parseInt(gRes?.count || 0, 10);
      } else {
        totalContracts = (memDb.contracts || []).length;
        totalGuarantees = (memDb.bank_guarantees || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        totalContracts,
        totalGuarantees,
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

const contractsEngineService = new ContractsEngineService();
module.exports = contractsEngineService;
