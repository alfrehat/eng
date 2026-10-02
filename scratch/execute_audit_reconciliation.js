const fs = require('fs');
const path = require('path');

const updates = [
  {
    file: 'services/archiveEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, 'الأرشيف الإلكتروني والوثائق', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: logId,
          userId: userId || 'SYSTEM',
          action,
          entity: 'الأرشيف الإلكتروني والوثائق',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأرشيف الإلكتروني والوثائق',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/assetsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO public.activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, 'الأصول البلدية', String(entityId), details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: logId,
          userId: userId || 'SYSTEM',
          action,
          entity: 'الأصول البلدية',
          entityId: String(entityId),
          details,
          ip: '127.0.0.1',
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأصول البلدية',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'services/authorizationEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [actorId, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY_AUDIT', String(targetEntity || 'SYSTEM'), details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-SEC-' + Date.now(),
          userId: actorId,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          entity: 'SECURITY_AUDIT',
          entityId: String(targetEntity || 'SYSTEM'),
          details,
          ip: '127.0.0.1',
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: actorId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entity: 'SECURITY_AUDIT',
        entityId: String(targetEntity || 'SYSTEM'),
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'services/budgetEngineService.js',
    from: `      if (isPostgresActive()) {
        const pool = getPool();
        await pool.query(
          'INSERT INTO public.activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, 'الموازنة والبنود المالية', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: logId,
          userId: userId || 'SYSTEM',
          action,
          entity: 'الموازنة والبنود المالية',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الموازنة والبنود المالية',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/claimsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'المطالبات المالية', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-CLM-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'المطالبات المالية',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المطالبات المالية',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/committeesEngineService.js',
    from: `      if (isPostgresActive()) {
        const pool = getPool();
        await pool.query(
          'INSERT INTO public.activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, 'اللجان الفنية ودراسات العطاءات', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: logId,
          userId: userId || 'SYSTEM',
          action,
          entity: 'اللجان الفنية ودراسات العطاءات',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'اللجان الفنية ودراسات العطاءات',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/contractsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, 'العقود والاتفاقيات', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: logId,
          userId: userId || 'SYSTEM',
          action,
          entity: 'العقود والاتفاقيات',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'العقود والاتفاقيات',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/contractTemplateEngine.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'نماذج العقود', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-TMPL-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'نماذج العقود',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'نماذج العقود',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/cryptoSignatureService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          ['SYSTEM', action, 'التحقق الرقمي', String(entityId), details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-CRYPTO-' + Date.now(),
          userId: 'SYSTEM',
          action,
          entity: 'التحقق الرقمي',
          entityId: String(entityId),
          details,
          ip: '127.0.0.1',
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity: 'التحقق الرقمي',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'services/dataReconciliationService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          ['SYSTEM', action, entity, 'RECONCILIATION_CORE', details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-RECON-' + Date.now(),
          userId: 'SYSTEM',
          action,
          entity,
          entityId: 'RECONCILIATION_CORE',
          details,
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity,
        entityId: 'RECONCILIATION_CORE',
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'services/g2gGatewayEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'بوابة الربط الحكومي G2G', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-G2G-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'بوابة الربط الحكومي G2G',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'بوابة الربط الحكومي G2G',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/pavementReturnsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'عوائد التعبيد والتحققات', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PAV-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'عوائد التعبيد والتحققات',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'عوائد التعبيد والتحققات',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectDependencyEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'اعتماديات المشاريع', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PDEP-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'اعتماديات المشاريع',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'اعتماديات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectFinancialProgrammingEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'البرمجة المالية للمشاريع', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PFIN-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'البرمجة المالية للمشاريع',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'البرمجة المالية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectPortfolioEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'المحافظ والخطط الاستثمارية', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PORT-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'المحافظ والخطط الاستثمارية',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المحافظ والخطط الاستثمارية',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectPrioritizationEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'أولويات المشاريع', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PPRI-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'أولويات المشاريع',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أولويات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectSchedulingEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'الجدولة الزمنية للمشاريع', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PSCH-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'الجدولة الزمنية للمشاريع',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'الجدولة الزمنية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/projectsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'المشاريع الهندسية', String(projectId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PRJ-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'المشاريع الهندسية',
          entityId: String(projectId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المشاريع الهندسية',
        entityId: String(projectId),
        details,
        ip
      });`
  },
  {
    file: 'services/purchasesEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'أوامر الشراء والتوريد', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-PUR-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'أوامر الشراء والتوريد',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أوامر الشراء والتوريد',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/reportsEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', 'REPORT_EXPORTED', 'التقارير والمحرر الذكي', String(reportId), details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-REP-' + Date.now(),
          userId: userId || 'SYSTEM',
          action: 'REPORT_EXPORTED',
          entity: 'التقارير والمحرر الذكي',
          entityId: String(reportId),
          details,
          ip: '127.0.0.1',
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action: 'REPORT_EXPORTED',
        entity: 'التقارير والمحرر الذكي',
        entityId: String(reportId),
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'services/rulesEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'قواعد الأعمال والتحقق', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-RULE-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'قواعد الأعمال والتحقق',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'قواعد الأعمال والتحقق',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'services/specializedAssetsEngine.js',
    from: `      if (isPostgresActive()) {
        const pool = getPool();
        const logId = 'LOG-SA-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        await pool.query(
          'INSERT INTO public.activity_log (id, "userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
          [logId, userId || 'SYSTEM', action, entityType || 'أصول متخصصة', String(entityId), detailsText, clientIp]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-SA-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          userId: userId || 'SYSTEM',
          action,
          entity: entityType || 'أصول متخصصة',
          entityId: String(entityId),
          details: detailsText,
          ip: clientIp,
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const logId = 'LOG-SA-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: entityType || 'أصول متخصصة',
        entityId: String(entityId),
        details: detailsText,
        ip: clientIp
      });`
  },
  {
    file: 'services/tendersEngineService.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', action, 'العطاءات والمناقصات', String(entityId), details, ip]
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-TND-' + Date.now(),
          userId: userId || 'SYSTEM',
          action,
          entity: 'العطاءات والمناقصات',
          entityId: String(entityId),
          details,
          ip,
          createdAt: new Date().toISOString()
        });
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'العطاءات والمناقصات',
        entityId: String(entityId),
        details,
        ip
      });`
  },
  {
    file: 'middlewares/rbacManager.js',
    from: `    if (isPostgresActive()) {
      await dbRun(
        'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
        [user.id || 'ANONYMOUS', action, 'الأمان والصلاحيات', permissionRequired, details, ip]
      );
    } else if (memDb && memDb.activity_log) {
      memDb.activity_log.push({
        id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: user.id || 'ANONYMOUS',
        userName: user.fullName || user.username || user.id,
        action,
        entity: 'الأمان والصلاحيات',
        entityId: permissionRequired,
        details,
        ip,
        createdAt: new Date().toISOString()
      });
    }`,
    to: `    const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
    await recordFn({
      userId: user.id || 'ANONYMOUS',
      userName: user.fullName || user.username || user.id,
      action,
      entity: 'الأمان والصلاحيات',
      entityId: permissionRequired,
      details,
      ip
    });`
  },
  {
    file: 'Roads/Reports/ramsAnalyticsEngine.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          ['SYSTEM', action, 'تحليلات الرصفة RAMS', String(entityId), details, '127.0.0.1']
        );
      } else if (memDb && memDb.activity_log) {
        memDb.activity_log.push({
          id: 'LOG-RAMS-' + Date.now(),
          userId: 'SYSTEM',
          action,
          entity: 'تحليلات الرصفة RAMS',
          entityId: String(entityId),
          details,
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity: 'تحليلات الرصفة RAMS',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });`
  },
  {
    file: 'routes/workflowRouter.js',
    from: `      if (isPostgresActive()) {
        await dbRun(
          'INSERT INTO activity_log ("userId", action, entity, "entityId", details, ip, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [userId || 'SYSTEM', 'WORKFLOW_STATE_TRANSITION', entityType, String(entityId), details, clientIp]
        );
      } else if (memDb && memDb.activity_log) {
        const uniqueId = 'LOG-WF-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        memDb.activity_log.push({
          id: uniqueId,
          userId: userId || 'SYSTEM',
          action: 'WORKFLOW_STATE_TRANSITION',
          entity: entityType,
          entityId: String(entityId),
          details,
          ip: clientIp,
          createdAt: new Date().toISOString()
        });
        saveMemTable('activity_log');
      }`,
    to: `      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action: 'WORKFLOW_STATE_TRANSITION',
        entity: entityType,
        entityId: String(entityId),
        details,
        ip: clientIp
      });`
  }
];

const root = path.resolve(__dirname, '..');
let count = 0;

updates.forEach(u => {
  const full = path.join(root, u.file);
  if (!fs.existsSync(full)) {
    console.error(`File not found: ${u.file}`);
    return;
  }
  let content = fs.readFileSync(full, 'utf8');
  if (content.includes(u.from)) {
    content = content.replace(u.from, u.to);
    fs.writeFileSync(full, content, 'utf8');
    console.log(`✅ Reconciled: ${u.file}`);
    count++;
  } else {
    console.warn(`⚠️ Target block not found in: ${u.file}`);
  }
});

console.log(`\nReconciliation completed for ${count} files.`);
