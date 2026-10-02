/**
 * services/specializedAssetsEngine.js
 * ⚡🏗️ محرك الأصول التخصصية وشبكات البنية التحتية والإنارة وتصاريح الحفر (SPECIALIZED_ASSETS_ENGINE)
 * بلدية كفرنجة الجديدة - مديرية الأشغال والخدمات الهندسية
 * v3.0 - Anti-Gravity Enterprise Specialized Municipal Assets & Infrastructure Engine
 */

'use strict';

const { isPostgresActive, getPool, memDb, saveMemTable } = require('../utils/database');
const numberingEngine = require('./numberingEngine');
const { logInfo, logWarn, logError } = require('./loggerService');

class SpecializedAssetsEngineService {
  constructor() {
    this.engineId = 'SPECIALIZED_ASSETS_ENGINE';
    this.engineName = 'Enterprise Specialized Municipal Assets & Networks Engine';
    this.version = '3.0.0';
    this.category = 'DOMAIN_ENGINE';
    this.status = 'READY';
    this.capabilities = [
      'lighting_networks_management',
      'infrastructure_assets_tracking',
      'structural_buildings_audit',
      'excavation_permits_lifecycle',
      'postgis_spatial_integration',
      'specialized_numbering_integration',
      'asset_condition_monitoring'
    ];
    this._ensureCollections();
  }

  _ensureCollections() {
    if (!memDb.specialized_assets) memDb.specialized_assets = [];
    if (!memDb.structural_assets) memDb.structural_assets = [];
    if (!memDb.infrastructure_networks) memDb.infrastructure_networks = [];
    if (!memDb.energy_assets) memDb.energy_assets = [];
    if (!memDb.excavation_permits) memDb.excavation_permits = [];
  }

  async _recordAudit(userId, entityId, entityType, action, details, clientIp = '127.0.0.1') {
    try {
      const detailsText = typeof details === 'object' ? JSON.stringify(details) : String(details);
      const recordFn = global.recordActivity || require('../Administration/API/activityEngine').recordActivity;
      await recordFn({
        id: typeof logId !== 'undefined' ? logId : undefined,
        userId: userId || 'SYSTEM',
        action,
        entity: entityType || 'أصول متخصصة',
        entityId: String(entityId),
        details: detailsText,
      });
    } catch (e) {
      logWarn('SpecializedAssetsEngine', `Audit log failed: ${e.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 0. ملخص الأصول التخصصية (All Assets Summary)
  // ══════════════════════════════════════════════════════════════════════
  async getAssetsSummary() {
    let structuralCount = 0, infrastructureCount = 0, energyCount = 0;
    let structural = [], infrastructure = [], energy = [];

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const sRes = await pool.query('SELECT COUNT(*) as count FROM public.structural_assets');
        const iRes = await pool.query('SELECT COUNT(*) as count FROM public.infrastructure_networks');
        const eRes = await pool.query('SELECT COUNT(*) as count FROM public.energy_assets');

        structuralCount = parseInt(sRes?.rows[0]?.count || 0, 10);
        infrastructureCount = parseInt(iRes?.rows[0]?.count || 0, 10);
        energyCount = parseInt(eRes?.rows[0]?.count || 0, 10);

        const sList = await pool.query('SELECT * FROM public.structural_assets ORDER BY created_at DESC LIMIT 50');
        const iList = await pool.query('SELECT * FROM public.infrastructure_networks ORDER BY created_at DESC LIMIT 50');
        const eList = await pool.query('SELECT * FROM public.energy_assets ORDER BY created_at DESC LIMIT 50');

        structural = sList.rows || [];
        infrastructure = iList.rows || [];
        energy = eList.rows || [];

        return {
          summary: {
            structuralCount,
            infrastructureCount,
            energyCount,
            totalAssets: structuralCount + infrastructureCount + energyCount
          },
          structural,
          infrastructure,
          energy
        };
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL summary query failed: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    // In-Memory Fallback
    this._ensureCollections();
    structuralCount = memDb.structural_assets.length;
    infrastructureCount = memDb.infrastructure_networks.length;
    energyCount = memDb.energy_assets.length;

    return {
      summary: {
        structuralCount,
        infrastructureCount,
        energyCount,
        totalAssets: structuralCount + infrastructureCount + energyCount
      },
      structural: memDb.structural_assets.slice(0, 50),
      infrastructure: memDb.infrastructure_networks.slice(0, 50),
      energy: memDb.energy_assets.slice(0, 50)
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. الأبنية والجدران الاستنادية (Structural Assets)
  // ══════════════════════════════════════════════════════════════════════
  async getStructuralAssets(filters = {}) {
    const { assetType } = filters || {};

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = `
          SELECT id, asset_type, name, district, condition_index, height_meters, floors_count, 
                 COALESCE(lat, ST_Y(geom)) as lat, 
                 COALESCE(lng, ST_X(geom)) as lng, 
                 ST_AsGeoJSON(geom) as geojson, created_at, updated_at
          FROM public.structural_assets
        `;
        const params = [];
        if (assetType && assetType !== 'ALL') {
          params.push(assetType);
          sql += ` WHERE asset_type = $1`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT 500`;

        const res = await pool.query(sql, params);
        return res.rows || [];
      } catch (err) {
        logError('SpecializedAssetsEngine', `Structural query error: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    let assets = memDb.structural_assets || [];
    if (assetType && assetType !== 'ALL') {
      assets = assets.filter(a => a.asset_type === assetType || a.assetType === assetType);
    }
    return assets;
  }

  async createStructuralAsset(data, user = null, clientIp = '127.0.0.1') {
    const { id, assetType, name, district, conditionIndex, heightMeters, floorsCount, lat, lng, geometry } = data || {};

    if (!name) {
      throw new Error('اسم الأصل الإنشائي حقل إلزامي.');
    }

    const assetId = id || await numberingEngine.generateNextId('structural_assets', { prefix: 'STR' });
    const latVal = parseFloat(lat || 0);
    const lngVal = parseFloat(lng || 0);
    const condVal = parseFloat(conditionIndex || 85);
    const heightVal = parseFloat(heightMeters || 0);
    const floorsVal = parseInt(floorsCount || 0, 10);
    const now = new Date().toISOString();

    const assetObj = {
      id: assetId,
      asset_type: assetType || 'WALL',
      name: name || 'أصل إنشائي جديد',
      district: district || 'كفرنجة',
      condition_index: condVal,
      height_meters: heightVal,
      floors_count: floorsVal,
      lat: latVal,
      lng: lngVal,
      geojson: geometry || { type: 'Point', coordinates: [lngVal, latVal] },
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(`
          INSERT INTO public.structural_assets 
            (id, asset_type, name, district, condition_index, height_meters, floors_count, lat, lng, geom, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, asset_type = EXCLUDED.asset_type,
            condition_index = EXCLUDED.condition_index, height_meters = EXCLUDED.height_meters,
            floors_count = EXCLUDED.floors_count, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
            geom = EXCLUDED.geom, updated_at = NOW()
        `, [assetId, assetObj.asset_type, assetObj.name, assetObj.district, condVal, heightVal, floorsVal, latVal, lngVal]);
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL structural insert failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    // مزامنة الذاكرة فقط بعد نجاح قاعدة البيانات
    this._ensureCollections();
    const existingIdx = memDb.structural_assets.findIndex(a => a.id === assetId);
    if (existingIdx >= 0) memDb.structural_assets[existingIdx] = assetObj;
    else memDb.structural_assets.unshift(assetObj);
    saveMemTable('structural_assets');

    await this._recordAudit(user?.id, assetId, 'الأصول الإنشائية', 'CREATE_STRUCTURAL_ASSET', `تسجيل أصل إنشائي [${assetObj.name}] بحالة سلامة [${condVal}%]`, clientIp);
    return assetObj;
  }

  async deleteStructuralAsset(id, user = null, clientIp = '127.0.0.1') {
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('DELETE FROM public.structural_assets WHERE id = $1', [id]);
        if (res.rowCount === 0) {
          throw new Error(`الأصل الإنشائي [${id}] غير موجود في قاعدة البيانات.`);
        }
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL structural delete failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    memDb.structural_assets = (memDb.structural_assets || []).filter(r => String(r.id) !== String(id));
    saveMemTable('structural_assets');

    await this._recordAudit(user?.id, id, 'الأصول الإنشائية', 'DELETE_STRUCTURAL_ASSET', `حذف الأصل الإنشائي رقم [${id}]`, clientIp);
    return { success: true, message: 'تم حذف الأصل الإنشائي بنجاح.' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. شبكات البنية التحتية والمياه (Infrastructure Networks)
  // ══════════════════════════════════════════════════════════════════════
  async getInfrastructureNetworks(filters = {}) {
    const { networkType } = filters || {};

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = `
          SELECT id, network_type, code, material, diameter_mm, status, 
                 COALESCE(lat, ST_Y(geom)) as lat, 
                 COALESCE(lng, ST_X(geom)) as lng, 
                 ST_AsGeoJSON(geom) as geometry, attributes, created_at, updated_at
          FROM public.infrastructure_networks
        `;
        const params = [];
        if (networkType && networkType !== 'ALL') {
          params.push(networkType);
          sql += ` WHERE network_type = $1`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT 500`;

        const res = await pool.query(sql, params);
        return res.rows || [];
      } catch (err) {
        logError('SpecializedAssetsEngine', `Infrastructure query error: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    let networks = memDb.infrastructure_networks || [];
    if (networkType && networkType !== 'ALL') {
      networks = networks.filter(n => n.network_type === networkType || n.networkType === networkType);
    }
    return networks;
  }

  async createInfrastructureNetwork(data, user = null, clientIp = '127.0.0.1') {
    const { id, networkType, code, material, diameterMm, status, coordinates, attributes, lat, lng } = data || {};

    const netId = id || await numberingEngine.generateNextId('infrastructure_networks', { prefix: 'INF' });
    const latVal = parseFloat(lat || (coordinates && coordinates[0] ? coordinates[0][1] : 0));
    const lngVal = parseFloat(lng || (coordinates && coordinates[0] ? coordinates[0][0] : 0));
    const now = new Date().toISOString();

    const netObj = {
      id: netId,
      network_type: networkType || 'WATER_MAIN',
      code: code || netId,
      material: material || 'HDPE',
      diameter_mm: parseFloat(diameterMm || 0),
      status: status || 'OPERATIONAL',
      attributes: attributes || {},
      lat: latVal,
      lng: lngVal,
      geometry: { type: 'LineString', coordinates: coordinates || [[lngVal, latVal]] },
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const geojsonStr = JSON.stringify(netObj.geometry);
        await pool.query(`
          INSERT INTO public.infrastructure_networks 
            (id, network_type, code, material, diameter_mm, status, lat, lng, geom, attributes, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326), $10::jsonb, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            network_type = EXCLUDED.network_type, material = EXCLUDED.material,
            diameter_mm = EXCLUDED.diameter_mm, status = EXCLUDED.status,
            lat = EXCLUDED.lat, lng = EXCLUDED.lng, geom = EXCLUDED.geom, updated_at = NOW()
        `, [netId, netObj.network_type, netObj.code, netObj.material, netObj.diameter_mm, netObj.status, latVal, lngVal, geojsonStr, JSON.stringify(netObj.attributes)]);
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL infrastructure insert failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    const existingIdx = memDb.infrastructure_networks.findIndex(n => n.id === netId);
    if (existingIdx >= 0) memDb.infrastructure_networks[existingIdx] = netObj;
    else memDb.infrastructure_networks.unshift(netObj);
    saveMemTable('infrastructure_networks');

    await this._recordAudit(user?.id, netId, 'شبكات البنية التحتية', 'CREATE_INFRASTRUCTURE', `توثيق مسار شبكة [${netObj.network_type}] بقطر [${netObj.diameter_mm}mm]`, clientIp);
    return netObj;
  }

  async deleteInfrastructureNetwork(id, user = null, clientIp = '127.0.0.1') {
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('DELETE FROM public.infrastructure_networks WHERE id = $1', [id]);
        if (res.rowCount === 0) {
          throw new Error(`خط الشبكة [${id}] غير موجود.`);
        }
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL infrastructure delete failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    memDb.infrastructure_networks = (memDb.infrastructure_networks || []).filter(r => String(r.id) !== String(id));
    saveMemTable('infrastructure_networks');

    await this._recordAudit(user?.id, id, 'شبكات البنية التحتية', 'DELETE_INFRASTRUCTURE', `حذف خط الشبكة رقم [${id}]`, clientIp);
    return { success: true, message: 'تم حذف خط الشبكة بنجاح.' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. شبكات الإنارة والطاقة (Energy & Lighting)
  // ══════════════════════════════════════════════════════════════════════
  async getEnergyAssets(filters = {}) {
    const { assetType } = filters || {};

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = `
          SELECT id, code, name, asset_type, fixture_type, wattage, district, 
                 COALESCE(lat, ST_Y(geom)) as lat, 
                 COALESCE(lng, ST_X(geom)) as lng, 
                 condition, ST_AsGeoJSON(geom) as geojson, created_at, updated_at
          FROM public.energy_assets
        `;
        const params = [];
        if (assetType && assetType !== 'ALL') {
          params.push(assetType);
          sql += ` WHERE asset_type = $1`;
        }
        sql += ` ORDER BY created_at DESC, id DESC LIMIT 500`;

        const res = await pool.query(sql, params);
        return res.rows || [];
      } catch (err) {
        logError('SpecializedAssetsEngine', `Energy query error: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    let energyAssets = memDb.energy_assets || [];
    if (assetType && assetType !== 'ALL') {
      energyAssets = energyAssets.filter(e => e.asset_type === assetType || e.assetType === assetType);
    }
    return energyAssets;
  }

  async createEnergyAsset(data, user = null, clientIp = '127.0.0.1') {
    const { id, code, name, assetType, fixtureType, wattage, district, lat, lng, condition } = data || {};

    const energyId = id || await numberingEngine.generateNextId('energy_assets', { prefix: 'LGT' });
    const latVal = parseFloat(lat || 0);
    const lngVal = parseFloat(lng || 0);
    const wattVal = parseFloat(wattage || 150);
    const now = new Date().toISOString();

    const energyObj = {
      id: energyId,
      code: code || energyId,
      name: name || 'أصل طاقة وإنارة',
      asset_type: assetType || 'LIGHTING',
      fixture_type: fixtureType || 'LED',
      wattage: wattVal,
      district: district || 'كفرنجة',
      condition: condition || 'GOOD',
      lat: latVal,
      lng: lngVal,
      geojson: { type: 'Point', coordinates: [lngVal, latVal] },
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(`
          INSERT INTO public.energy_assets 
            (id, code, name, asset_type, fixture_type, wattage, district, lat, lng, geom, condition, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326), $10, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, fixture_type = EXCLUDED.fixture_type,
            wattage = EXCLUDED.wattage, district = EXCLUDED.district,
            lat = EXCLUDED.lat, lng = EXCLUDED.lng, geom = EXCLUDED.geom,
            condition = EXCLUDED.condition, updated_at = NOW()
        `, [energyId, energyObj.code, energyObj.name, energyObj.asset_type, energyObj.fixture_type, wattVal, energyObj.district, latVal, lngVal, energyObj.condition]);
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL energy insert failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    const existingIdx = memDb.energy_assets.findIndex(e => e.id === energyId);
    if (existingIdx >= 0) memDb.energy_assets[existingIdx] = energyObj;
    else memDb.energy_assets.unshift(energyObj);
    saveMemTable('energy_assets');

    await this._recordAudit(user?.id, energyId, 'أصول الطاقة والإنارة', 'CREATE_ENERGY_ASSET', `تسجيل أصل إنارة وطاقة [${energyObj.name}] بقدرة [${wattVal}W]`, clientIp);
    return energyObj;
  }

  async deleteEnergyAsset(id, user = null, clientIp = '127.0.0.1') {
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('DELETE FROM public.energy_assets WHERE id = $1', [id]);
        if (res.rowCount === 0) {
          throw new Error(`أصل الطاقة والإنارة [${id}] غير موجود.`);
        }
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL energy delete failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    memDb.energy_assets = (memDb.energy_assets || []).filter(r => String(r.id) !== String(id));
    saveMemTable('energy_assets');

    await this._recordAudit(user?.id, id, 'أصول الطاقة والإنارة', 'DELETE_ENERGY_ASSET', `حذف أصل الطاقة رقم [${id}]`, clientIp);
    return { success: true, message: 'تم حذف أصل الطاقة والإنارة بنجاح.' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. تصاريح الحفر وتزويد الخدمات (Excavation & Service Permits)
  // ══════════════════════════════════════════════════════════════════════
  async getExcavationPermits(filters = {}) {
    const { status, permitType } = filters || {};

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = `
          SELECT id, 
                 COALESCE(code, permit_number, id) as code,
                 COALESCE(permit_number, code, id) as permit_number,
                 COALESCE(applicant, applicant_name, 'مواطن / شركة') as applicant,
                 COALESCE(contractor, 'مقاول معتمد') as contractor,
                 COALESCE(district, location_description, 'كفرنجة') as district,
                 COALESCE(purpose, 'تزويد وتمديد خدمات عامة') as purpose,
                 COALESCE(permit_type, entity_type, 'WATER_CONNECTION') as permit_type,
                 COALESCE(NULLIF(length_m, 0), excavation_length, 0) as length_m,
                 COALESCE(NULLIF(width_m, 0), excavation_width, 0) as width_m,
                 COALESCE(NULLIF(depth_m, 0), 1.0) as depth_m,
                 COALESCE(surface_type, 'ASPHALT') as surface_type,
                 COALESCE(NULLIF(insurance_amount, 0), 0) as insurance_fee,
                 COALESCE(NULLIF(insurance_amount, 0), 0) as insurance_amount,
                 COALESCE(status, 'ACTIVE') as status,
                 COALESCE(reinstatement_status, 'PENDING') as reinstatement_status,
                 start_date, end_date,
                 COALESCE(lat, ST_Y(geom), 32.3301) as lat, 
                 COALESCE(lng, ST_X(geom), 35.7501) as lng, 
                 ST_AsGeoJSON(geom) as geojson,
                 COALESCE(attributes, '{}'::jsonb) as attributes,
                 COALESCE(notes, '') as notes,
                 created_at, updated_at
          FROM public.excavation_permits
        `;
        const params = [];
        const conditions = [];
        if (status && status !== 'ALL') {
          params.push(status);
          conditions.push(`status = $${params.length}`);
        }
        if (permitType && permitType !== 'ALL') {
          params.push(permitType);
          conditions.push(`(permit_type = $${params.length} OR entity_type = $${params.length})`);
        }
        if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
        sql += ` ORDER BY created_at DESC, id DESC LIMIT 500`;

        const res = await pool.query(sql, params);
        return res.rows || [];
      } catch (err) {
        logError('SpecializedAssetsEngine', `Permits query error: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    let permits = memDb.excavation_permits || [];
    if (status && status !== 'ALL') permits = permits.filter(p => p.status === status);
    if (permitType && permitType !== 'ALL') permits = permits.filter(p => p.permit_type === permitType || p.entity_type === permitType);
    return permits;
  }

  async createExcavationPermit(data, user = null, clientIp = '127.0.0.1') {
    const { 
      id, code, permitNumber, applicant, contractor, district, purpose, 
      permitType, lengthM, widthM, depthM, surfaceType, insuranceFee, 
      startDate, endDate, status, reinstatementStatus, notes, attributes, coordinates, lat, lng 
    } = data || {};

    const permitId = id || await numberingEngine.generateNextId('excavation_permits', { prefix: 'PERM' });
    const latVal = parseFloat(lat || (coordinates && coordinates[0] ? coordinates[0][1] : 32.3301));
    const lngVal = parseFloat(lng || (coordinates && coordinates[0] ? coordinates[0][0] : 35.7501));
    const now = new Date().toISOString();

    const geoData = coordinates && coordinates.length >= 2
      ? { type: 'LineString', coordinates: coordinates.map(c => [c[0], c[1]]) }
      : { type: 'Point', coordinates: [lngVal, latVal] };

    const permitObj = {
      id: permitId,
      code: code || permitId,
      permit_number: permitNumber || code || permitId,
      applicant: applicant || 'مواطن / جهة خدمية',
      applicant_name: applicant || 'مواطن / جهة خدمية',
      contractor: contractor || 'مقاول معتمد',
      district: district || 'كفرنجة',
      location_description: district || 'كفرنجة',
      purpose: purpose || 'تزويد خدمات عامة',
      permit_type: permitType || 'WATER_CONNECTION',
      entity_type: permitType || 'WATER_CONNECTION',
      length_m: parseFloat(lengthM || 0),
      width_m: parseFloat(widthM || 0),
      depth_m: parseFloat(depthM || 1.0),
      surface_type: surfaceType || 'ASPHALT',
      insurance_amount: parseFloat(insuranceFee || 0),
      insurance_fee: parseFloat(insuranceFee || 0),
      start_date: startDate || now.slice(0, 10),
      end_date: endDate || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
      status: status || 'ACTIVE',
      reinstatement_status: reinstatementStatus || 'PENDING',
      notes: notes || '',
      attributes: typeof attributes === 'object' && attributes !== null ? attributes : {},
      lat: latVal,
      lng: lngVal,
      geojson: geoData,
      created_at: now,
      updated_at: now
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const geojsonStr = JSON.stringify(geoData);
        await pool.query(`
          INSERT INTO public.excavation_permits 
            (id, code, permit_number, applicant, applicant_name, contractor, district, location_description, purpose, permit_type, entity_type, length_m, width_m, depth_m, surface_type, insurance_amount, status, reinstatement_status, start_date, end_date, notes, attributes, lat, lng, geom, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23, $24, ST_SetSRID(ST_GeomFromGeoJSON($25), 4326), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            applicant = EXCLUDED.applicant, applicant_name = EXCLUDED.applicant_name,
            contractor = EXCLUDED.contractor, district = EXCLUDED.district,
            purpose = EXCLUDED.purpose, permit_type = EXCLUDED.permit_type,
            length_m = EXCLUDED.length_m, width_m = EXCLUDED.width_m, depth_m = EXCLUDED.depth_m,
            surface_type = EXCLUDED.surface_type, insurance_amount = EXCLUDED.insurance_amount,
            status = EXCLUDED.status, reinstatement_status = EXCLUDED.reinstatement_status,
            start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
            notes = EXCLUDED.notes, attributes = EXCLUDED.attributes,
            lat = EXCLUDED.lat, lng = EXCLUDED.lng, geom = EXCLUDED.geom, updated_at = NOW()
        `, [
          permitObj.id, permitObj.code, permitObj.permit_number, permitObj.applicant, permitObj.applicant_name,
          permitObj.contractor, permitObj.district, permitObj.location_description,
          permitObj.purpose, permitObj.permit_type, permitObj.entity_type, permitObj.length_m, permitObj.width_m,
          permitObj.depth_m, permitObj.surface_type, permitObj.insurance_amount,
          permitObj.status, permitObj.reinstatement_status, permitObj.start_date,
          permitObj.end_date, permitObj.notes, JSON.stringify(permitObj.attributes),
          latVal, lngVal, geojsonStr
        ]);
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL permit insert failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    const existingIdx = memDb.excavation_permits.findIndex(p => p.id === permitId);
    if (existingIdx >= 0) memDb.excavation_permits[existingIdx] = permitObj;
    else memDb.excavation_permits.unshift(permitObj);
    saveMemTable('excavation_permits');

    await this._recordAudit(user?.id, permitId, 'تصاريح الحفر', 'CREATE_EXCAVATION_PERMIT', `إصدار تصريح حفر [${permitId}] لصالح [${permitObj.applicant}] بكفالة [${permitObj.insurance_amount} د.أ]`, clientIp);
    return permitObj;
  }

  async reinstateExcavationPermit(id, data = {}, user = null, clientIp = '127.0.0.1') {
    const { inspectorName, inspectionNotes, status } = data || {};
    const finalStatus = status || 'COMPLETED';

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query(`
          UPDATE public.excavation_permits
          SET reinstatement_status = 'PASSED',
              status = $1,
              notes = CONCAT(COALESCE(notes, ''), ' | مصادقة إعادة الأوضاع: ', $2::text, ' - ', $3::text),
              updated_at = NOW()
          WHERE id = $4
        `, [finalStatus, inspectorName || user?.fullName || 'مهندس الميدان', inspectionNotes || 'مطابق للمواصفة الفنية', id]);

        if (res.rowCount === 0) {
          throw new Error(`تصريح الحفر [${id}] غير موجود.`);
        }
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL permit reinstate failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    const memItem = (memDb.excavation_permits || []).find(p => p.id === id);
    if (memItem) {
      memItem.reinstatement_status = 'PASSED';
      memItem.status = finalStatus;
      memItem.notes = (memItem.notes || '') + ` | تم استلام إعادة التعبيد: ${inspectorName || 'المهندس المشرف'}`;
      saveMemTable('excavation_permits');
    }

    await this._recordAudit(user?.id, id, 'تصاريح الحفر', 'REINSTATE_PERMIT', `المصادقة على إعادة التعبيد وتجهيز الإفراج عن كفالة التصريح [${id}]`, clientIp);
    return {
      success: true,
      message: '✅ تمت المصادقة على إعادة أوضاع الحفرية بنجاح وجاهزية الإفراج عن التأمين.',
      permit_id: id,
      reinstatement_status: 'PASSED'
    };
  }

  async deleteExcavationPermit(id, user = null, clientIp = '127.0.0.1') {
    if (isPostgresActive()) {
      try {
        const pool = getPool();
        const res = await pool.query('DELETE FROM public.excavation_permits WHERE id = $1', [id]);
        if (res.rowCount === 0) {
          throw new Error(`تصريح الحفر [${id}] غير موجود.`);
        }
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL permit delete failed: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    memDb.excavation_permits = (memDb.excavation_permits || []).filter(r => String(r.id) !== String(id));
    saveMemTable('excavation_permits');

    await this._recordAudit(user?.id, id, 'تصاريح الحفر', 'DELETE_PERMIT', `حذف تصريح الحفر رقم [${id}]`, clientIp);
    return { success: true, message: 'تم حذف تصريح الحفر بنجاح.' };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. سجل الأصول التخصصية العام (Specialized Assets Registry)
  // ══════════════════════════════════════════════════════════════════════
  async registerSpecializedAsset(assetData, user = null) {
    const { assetCategory, name, district, operationalStatus, specs, notes } = assetData || {};
    const category = assetCategory || 'LIGHTING';
    
    if (!name) {
      throw new Error('اسم الأصل التخصصي حقل إلزامي.');
    }

    const prefixMap = { LIGHTING: 'LGT', INFRASTRUCTURE: 'INF', STRUCTURAL: 'STR' };
    const prefix = prefixMap[category] || 'AST';

    const assetId = await numberingEngine.generateNextId('general', { prefix });
    const timestamp = new Date().toISOString();

    const record = {
      id: assetId,
      asset_number: assetId,
      asset_category: category,
      name,
      district: district || 'منطقة كفرنجة المركزية',
      operational_status: operationalStatus || 'ACTIVE',
      specs: specs ? (typeof specs === 'string' ? specs : JSON.stringify(specs)) : '{}',
      notes: notes || '',
      created_at: timestamp,
      updated_at: timestamp
    };

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        await pool.query(`
          INSERT INTO public.specialized_assets
          (id, asset_number, asset_category, name, district, operational_status, specs, notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, district = EXCLUDED.district,
            operational_status = EXCLUDED.operational_status, specs = EXCLUDED.specs,
            notes = EXCLUDED.notes, updated_at = NOW()
        `, [
          record.id, record.asset_number, record.asset_category, record.name,
          record.district, record.operational_status, record.specs, record.notes
        ]);
      } catch (err) {
        logError('SpecializedAssetsEngine', `Postgres insert error: ${err.message}`);
        throw new Error(`DATABASE_WRITE_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    const existingIdx = memDb.specialized_assets.findIndex(s => s.id === assetId);
    const memItem = { ...record, specs: typeof specs === 'object' ? specs : (record.specs.startsWith('{') ? JSON.parse(record.specs) : {}) };
    if (existingIdx >= 0) memDb.specialized_assets[existingIdx] = memItem;
    else memDb.specialized_assets.unshift(memItem);
    saveMemTable('specialized_assets');

    await this._recordAudit(user?.id, assetId, category, 'SPECIALIZED_ASSET_REGISTERED', `تم تسجيل أصل تخصصي جديد [${category}]: ${name}`);
    logInfo('SpecializedAssetsEngine', `⚡ تم تسجيل الأصل التخصصي بنجاح [${assetId}]`);

    return memItem;
  }

  async getSpecializedAssets(filters = {}) {
    const { category, district, status, limit = 50 } = filters || {};

    if (isPostgresActive()) {
      try {
        const pool = getPool();
        let sql = 'SELECT * FROM public.specialized_assets WHERE 1=1';
        const params = [];

        if (category && category !== 'all') {
          params.push(category);
          sql += ` AND asset_category = $${params.length}`;
        }
        if (district && district !== 'all') {
          params.push(district);
          sql += ` AND district = $${params.length}`;
        }
        if (status && status !== 'all') {
          params.push(status);
          sql += ` AND operational_status = $${params.length}`;
        }

        sql += ` ORDER BY created_at DESC LIMIT ${Math.max(1, parseInt(limit, 10))}`;
        const res = await pool.query(sql, params);
        return res.rows || [];
      } catch (err) {
        logError('SpecializedAssetsEngine', `PostgreSQL query error: ${err.message}`);
        throw new Error(`DATABASE_READ_FAILED: ${err.message}`);
      }
    }

    this._ensureCollections();
    let list = memDb.specialized_assets || [];
    if (category && category !== 'all') list = list.filter(a => a.asset_category === category);
    if (district && district !== 'all') list = list.filter(a => a.district === district);
    if (status && status !== 'all') list = list.filter(a => a.operational_status === status);
    return list.slice(0, parseInt(limit, 10));
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. فحص الصحة والجاهزية التشغيلية (HealthCheck)
  // ══════════════════════════════════════════════════════════════════════
  async healthCheck() {
    let totalCount = 0;
    try {
      if (isPostgresActive()) {
        const pool = getPool();
        const res = await pool.query('SELECT COUNT(*) as count FROM public.specialized_assets');
        totalCount = parseInt(res?.rows[0]?.count || 0, 10);
      } else {
        totalCount = (memDb.specialized_assets || []).length;
      }

      return {
        healthy: true,
        status: 'READY',
        engineId: this.engineId,
        engineName: this.engineName,
        version: this.version,
        specializedAssetsCount: totalCount,
        activeMode: isPostgresActive() ? 'PostgreSQL' : 'In-Memory',
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      logError('SpecializedAssetsEngine', `HealthCheck failure: ${e.message}`);
      return {
        healthy: false,
        status: 'DEGRADED',
        engineId: this.engineId,
        error: `DATABASE_UNAVAILABLE: ${e.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const specializedAssetsEngineInstance = new SpecializedAssetsEngineService();
specializedAssetsEngineInstance.SpecializedAssetsEngineService = SpecializedAssetsEngineService;

module.exports = specializedAssetsEngineInstance;
module.exports.SpecializedAssetsEngineService = SpecializedAssetsEngineService;
