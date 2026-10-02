const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.resolve(__dirname, '../services');

const replacements = {
  'archiveEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: logId,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأرشيف الإلكتروني والوثائق',
        entityId: String(entityId),
        details,
        ip
      });`,

  'assetsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: 'الأصول البلدية',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });`,

  'claimsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المطالبات المالية',
        entityId: String(entityId),
        details,
        ip
      });`,

  'committeesEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: 'اللجان الفنية ودراسات العطاءات',
        entityId: String(entityId),
        details,
        ip
      });`,

  'contractsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: 'العقود والاتفاقيات',
        entityId: String(entityId),
        details,
        ip
      });`,

  'contractTemplateEngine.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'نماذج العقود',
        entityId: String(entityId),
        details,
        ip
      });`,

  'cryptoSignatureService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity: 'التحقق الرقمي',
        entityId: String(entityId),
        details,
        ip: '127.0.0.1'
      });`,

  'dataReconciliationService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: 'SYSTEM',
        action,
        entity,
        entityId: 'RECONCILIATION_CORE',
        details,
        ip: '127.0.0.1'
      });`,

  'g2gGatewayEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'بوابة الربط الحكومي G2G',
        entityId: String(entityId),
        details,
        ip
      });`,

  'pavementReturnsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'عوائد التعبيد والتحققات',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectDependencyEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'اعتماديات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectFinancialProgrammingEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'البرمجة المالية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectPortfolioEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المحافظ والخطط الاستثمارية',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectPrioritizationEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أولويات المشاريع',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectSchedulingEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'الجدولة الزمنية للمشاريع',
        entityId: String(entityId),
        details,
        ip
      });`,

  'projectsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'المشاريع الهندسية',
        entityId: String(projectId),
        details,
        ip
      });`,

  'purchasesEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'أوامر الشراء والتوريد',
        entityId: String(entityId),
        details,
        ip
      });`,

  'reportsEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action: 'REPORT_EXPORTED',
        entity: 'التقارير والمحرر الذكي',
        entityId: String(reportId),
        details,
        ip: '127.0.0.1'
      });`,

  'rulesEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'قواعد الأعمال والتحقق',
        entityId: String(entityId),
        details,
        ip
      });`,

  'specializedAssetsEngine.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: entityType || 'أصول متخصصة',
        entityId: String(entityId),
        details: detailsText,
        ip: clientIp
      });`,

  'tendersEngineService.js': `const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        userId: userId || 'SYSTEM',
        action,
        entity: 'العطاءات والمناقصات',
        entityId: String(entityId),
        details,
        ip
      });`
};

const regex = /if\s*\(isPostgresActive\(\)\)\s*\{[\s\S]*?INSERT\s+INTO\s+(?:public\.)?activity_log[\s\S]*?\}\s*else\s*if\s*\((?:memDb[\s\S]*?|isMemDbActive[\s\S]*?)\)\s*\{[\s\S]*?\}(?:\s*saveMemTable\('activity_log'\);)?/;

let count = 0;
for (const [file, replacement] of Object.entries(replacements)) {
  const full = path.join(servicesDir, file);
  if (!fs.existsSync(full)) {
    console.error(`Not found: ${file}`);
    continue;
  }
  let content = fs.readFileSync(full, 'utf8');
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(full, content, 'utf8');
    try {
      execSync(`node -c "${full}"`);
      console.log(`✅ Successfully reconciled and verified: ${file}`);
      count++;
    } catch (err) {
      console.error(`❌ Syntax error in ${file}:`, err.message);
    }
  } else {
    console.warn(`⚠️ Pattern not found in: ${file}`);
  }
}

console.log(`\nReconciliation finished for ${count} files.`);
