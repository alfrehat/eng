/**
 * services/committeesEngineService.js
 * 🏛️ محرك اللجان الفنية ولجان دراسة العطاءات والاستلام الأولي والنهائي (COMMITTEES_ENGINE — Phase 10-B)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 */

const {
  isPostgresActive,
  dbQuery,
  dbGet,
  dbRun,
  memDb,
  saveMemTable
} = require('../utils/database');
const { logInfo, logWarn } = require('./loggerService');

class CommitteesEngineService {
  constructor() {
    this.engineId = 'COMMITTEES_ENGINE';
    this.engineName = 'Enterprise Technical Committees & Handover Minutes Engine';
    this.version = '4.1.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'committee_minutes',
      'preliminary_handover',
      'final_handover',
      'tender_studies_evaluation',
      'voting_decisions'
    ];
  }

  async getReports(filters = {}) {
    if (isPostgresActive()) {
      try {
        return await dbQuery('SELECT * FROM committee_reports ORDER BY created_at DESC') || [];
      } catch (e) {
        return memDb.committee_reports || [];
      }
    }
    return memDb.committee_reports || [];
  }

  async createReport(reportData, user = null) {
    const { committeeType, title, tenderId, projectId, members, decision, recommendations, notes } = reportData;
    const id = `COMM-${Date.now()}`;
    const record = {
      id,
      committeeType: committeeType || 'لجنة استلام أولي',
      title: title || 'محضر اجتماع لجنة فنية',
      tenderId: tenderId || null,
      projectId: projectId || null,
      members: members || [],
      decision: decision || 'APPROVED',
      recommendations: recommendations || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    if (!memDb.committee_reports) memDb.committee_reports = [];
    memDb.committee_reports.unshift(record);
    saveMemTable('committee_reports');

    return record;
  }

  async healthCheck() {
    const list = memDb.committee_reports || [];
    return {
      healthy: true,
      status: 'READY',
      engineId: this.engineId,
      totalReports: list.length,
      timestamp: new Date().toISOString()
    };
  }
}

const committeesEngineService = new CommitteesEngineService();
module.exports = committeesEngineService;
