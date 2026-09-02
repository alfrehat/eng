/**
 * services/dataReconciliationService.js
 * خدمة إعادة المزامنة والربط اللاحق (Data Reconciliation Service)
 * 
 * الوظيفة: العمل التلقائي فور عودة اتصال PostgreSQL لمعالجة وسحب البيانات التي أُضيفت أثناء الانقطاع الطارئ وحل التعارضات.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logInfo, logError, logWarn } = require('./loggerService');

class DataReconciliationService {
  constructor(pool) {
    this.pool = pool;
    this.fallbackLogPath = path.join(__dirname, '../logs/offline-transactions.json');
  }

  async reconcileOfflineData() {
    if (!fs.existsSync(this.fallbackLogPath)) return;

    console.log('🔄 جاري المزامنة اللاحقة للبيانات المُدخلة أثناء انقطاع PostgreSQL...');
    if (!this.pool) return;
    
    let client;
    try {
      client = await this.pool.connect();
      const rawData = fs.readFileSync(this.fallbackLogPath, 'utf-8');
      const offlineQueue = JSON.parse(rawData || '[]');

      if (!Array.isArray(offlineQueue) || offlineQueue.length === 0) return;

      await client.query('BEGIN');

      for (const tx of offlineQueue) {
        if (tx.entity === 'claims' && tx.data) {
          await client.query(`
            INSERT INTO public.claims (id, tender_id, claimant, amount, status, history)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              amount = EXCLUDED.amount,
              history = public.claims.history || EXCLUDED.history;
          `, [tx.data.id, tx.data.tenderId, tx.data.claimant, tx.data.amount, tx.data.status, JSON.stringify(tx.data.history || [])]);
        }
      }

      await client.query('COMMIT');
      fs.writeFileSync(this.fallbackLogPath, '[]', 'utf-8');
      console.log('✅ تمت المزامنة اللاحقة وتصفية سجلات الانقطاع بنجاح.');
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      console.error('❌ خطأ أثناء مزامنة بيانات الانقطاع:', err.message);
    } finally {
      if (client) client.release();
    }
  }
}

async function reconcileLocalDataWithPostgres(pgPool, memDb = {}) {
  const service = new DataReconciliationService(pgPool);
  await service.reconcileOfflineData();
  return { success: true };
}

module.exports = DataReconciliationService;
module.exports.reconcileLocalDataWithPostgres = reconcileLocalDataWithPostgres;
