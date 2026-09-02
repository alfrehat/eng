/**
 * knm-enterprise-v2/backend/tests/foundation.test.js
 * Comprehensive Test Suite for Foundation Core Engines in knm-enterprise-v2
 */

require('dotenv').config({ path: '../../.env' });
const path = require('path');
const { databaseEngine, UnitOfWork } = require('../src/engines/foundation/DatabaseEngine');
const { spatialGisEngine, KAFRANJAH_BOUNDS } = require('../src/engines/foundation/SpatialGisEngine');
const { verificationEngine } = require('../src/engines/foundation/VerificationEngine');
const { EnterpriseEventBus } = require('../src/core/EnterpriseEventBus');
const DomainEvent = require('../src/core/DomainEvent');
const BaseRepository = require('../src/core/BaseRepository');
const AppError = require('../src/core/AppError');

async function runFoundationTests() {
  console.log('====================================================');
  console.log('🏛️  KNM-ENTERPRISE-V2 FOUNDATION ENGINES TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`✅ PASS: ${message}`);
      passed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // 1. DATABASE_ENGINE & PERSISTENCE BOUNDARY
    // -----------------------------------------------------------------
    console.log('[SECTION 1: DATABASE_ENGINE & PERSISTENCE]');
    const health = await databaseEngine.checkHealth();
    assert(health.healthy === true, 'DatabaseEngine reports healthy status');
    assert(health.database === 'kafr_inja_engineering', 'Database connected to kafr_inja_engineering');

    // UnitOfWork & Transactional isolation
    await databaseEngine.query(`
      CREATE TABLE IF NOT EXISTS public.v2_test_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100),
        updated_at TIMESTAMP,
        updated_by VARCHAR(100),
        version INT DEFAULT 1
      )
    `);
    await databaseEngine.query('TRUNCATE TABLE public.v2_test_items');

    const testBus = new EnterpriseEventBus();
    let eventReceived = false;
    testBus.subscribe('V2ItemCreated', () => { eventReceived = true; });

    const uowItem = await databaseEngine.withTransaction(async (uow) => {
      const res = await uow.query('INSERT INTO public.v2_test_items (name, created_by) VALUES ($1, $2) RETURNING *', [
        'مشروع تصريف مياه الأمطار حي نمر', 'MUNICIPAL_ENGINEER'
      ]);
      uow.registerDomainEvent(new DomainEvent('V2ItemCreated', res.rows[0].id, 'Project', { name: res.rows[0].name }));
      return res.rows[0];
    });

    assert(uowItem.name === 'مشروع تصريف مياه الأمطار حي نمر', 'Committed item must match inserted name');

    // BaseRepository CRUD & Optimistic Locking
    const repo = new BaseRepository('v2_test_items', 'id');
    const inserted = await repo.insert({ name: 'تأهيل مدخل كفرنجة الغربي' }, 'DIRECTOR');
    assert(inserted.version === 1, 'BaseRepository sets initial version to 1');
    assert(inserted.created_by === 'DIRECTOR', 'BaseRepository records creator');

    const updated = await repo.update(inserted.id, { name: 'تأهيل مدخل كفرنجة الغربي - مرحلة 2' }, 1, 'ENGINEER_1');
    assert(updated.version === 2, 'Version increments on update');

    let conflictCaught = false;
    try {
      await repo.update(inserted.id, { name: 'محاولة متزامنة متعارضة' }, 1, 'ENGINEER_2');
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 409) conflictCaught = true;
    }
    assert(conflictCaught === true, 'Stale update correctly caught with 409 Conflict');

    // Rollback test
    let rollbackThrew = false;
    try {
      await databaseEngine.withTransaction(async (uow) => {
        await uow.query('INSERT INTO public.v2_test_items (name) VALUES ($1)', ['سجل سيتم التراجع عنه']);
        throw new Error('Forced Rollback');
      });
    } catch (e) {
      rollbackThrew = true;
    }
    assert(rollbackThrew === true, 'withTransaction properly re-threw rollback error');
    const rolledBackRows = await repo.find({ name: 'سجل سيتم التراجع عنه' });
    assert(rolledBackRows.length === 0, 'Rolled-back record must not exist in database');

    console.log('');

    // -----------------------------------------------------------------
    // 2. SPATIAL_GIS_ENGINE (SINGLE UNIFIED GIS ENGINE)
    // -----------------------------------------------------------------
    console.log('[SECTION 2: SPATIAL_GIS_ENGINE]');
    
    // Kafranjah Bounds Check
    const inBounds = spatialGisEngine.isWithinKafranjahBounds(KAFRANJAH_BOUNDS.center.lon, KAFRANJAH_BOUNDS.center.lat);
    assert(inBounds === true, 'Center coordinate must be within Kafranjah bounds');

    const outBounds = spatialGisEngine.isWithinKafranjahBounds(36.5, 31.5);
    assert(outBounds === false, 'External coordinate must be outside Kafranjah bounds');

    // GeoJSON validation & WKT Conversion
    const pointGeoJson = { type: 'Point', coordinates: [35.7058, 32.2986] };
    const wktPoint = spatialGisEngine.geoJsonToWkt(pointGeoJson);
    assert(wktPoint === 'POINT(35.7058 32.2986)', 'Point GeoJSON converts to standard WKT');

    const lineGeoJson = {
      type: 'LineString',
      coordinates: [[35.7050, 32.2980], [35.7060, 32.2990]]
    };
    const wktLine = spatialGisEngine.geoJsonToWkt(lineGeoJson);
    assert(wktLine === 'LINESTRING(35.705 32.298, 35.706 32.299)', 'LineString converts to standard WKT');

    // Haversine Distance (approx 140 meters)
    const distanceMeters = spatialGisEngine.calculateHaversineDistance(35.7050, 32.2980, 35.7060, 32.2990);
    assert(distanceMeters > 100 && distanceMeters < 200, `Calculated distance is reasonable (${distanceMeters}m)`);

    // Bounding Box
    const bboxResult = spatialGisEngine.calculateBoundingBox(lineGeoJson.coordinates);
    assert(bboxResult !== null, 'Bounding box calculated successfully');
    assert(bboxResult.bbox[0] === 35.7050 && bboxResult.bbox[2] === 35.7060, 'BBox longitude extent matches');

    console.log('');

    // -----------------------------------------------------------------
    // 3. VERIFICATION_ENGINE (CRYPTOGRAPHIC & DIGITAL SEALS)
    // -----------------------------------------------------------------
    console.log('[SECTION 3: VERIFICATION_ENGINE]');
    
    // Create Seal
    const seal = verificationEngine.createSeal('TND-2026-0042', 'TenderAward', { amount: 154000, contractor: 'شركة المقاولات الأردنية' }, 'CHIEF_ENGINEER');
    assert(seal.referenceNumber === 'TND-2026-0042', 'Seal reference matches input');
    assert(typeof seal.signature === 'string' && seal.signature.length === 64, 'HMAC-SHA256 signature generated');
    assert(typeof seal.verificationToken === 'string', 'Verification token generated');

    // Verify Untampered
    const verifyClean = verificationEngine.verifyIntegrity(
      'TND-2026-0042',
      'TenderAward',
      { amount: 154000, contractor: 'شركة المقاولات الأردنية' },
      seal.timestamp,
      seal.issuedBy,
      seal.signature
    );
    assert(verifyClean.verified === true, 'Untampered payload verified successfully');
    assert(verifyClean.tampered === false, 'Tampered flag is false for clean payload');

    // Detect Tampering (altered contract amount from 154000 to 200000)
    const verifyTampered = verificationEngine.verifyIntegrity(
      'TND-2026-0042',
      'TenderAward',
      { amount: 200000, contractor: 'شركة المقاولات الأردنية' },
      seal.timestamp,
      seal.issuedBy,
      seal.signature
    );
    assert(verifyTampered.verified === false, 'Altered payload must fail verification');
    assert(verifyTampered.tampered === true, 'Altered payload must be flagged as tampered');

    // Decode Token
    const decoded = verificationEngine.decodeToken(seal.verificationToken);
    assert(decoded.valid === true, 'Verification token successfully decoded');
    assert(decoded.referenceNumber === 'TND-2026-0042', 'Decoded reference matches');

    // Hash File
    const fileHash = verificationEngine.hashFile(Buffer.from('مواصفات عطاء خلطة إسفلتية ساخنة'));
    assert(typeof fileHash === 'string' && fileHash.length === 64, 'Document SHA-256 fingerprint generated');

    console.log('');

  } catch (err) {
    console.error('💥 Test execution failed:', err.message);
  } finally {
    try {
      await databaseEngine.query('DROP TABLE IF EXISTS public.v2_test_items');
    } catch (e) {}
    await databaseEngine.close();
  }

  console.log('====================================================');
  console.log(`FOUNDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFoundationTests();
