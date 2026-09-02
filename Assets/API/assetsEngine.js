/**
 * Assets/API/assetsEngine.js
 * موجه إدارة الأصول والأبنية والجدران الاستنادية والبنية التحتية والطاقة والإنارة وتصاريح الحفر
 * نظام إدارة الأشغال والخدمات الهندسية - بلدية كفرنجة الجديدة
 * المصدر الموحد للبيانات المكانية وقاعدة البيانات PostgreSQL / memDb
 */

const express = require('express');
const router = express.Router();
const rbacManager = require('../../middlewares/rbacManager');
const { dbQuery, isPostgresActive, getPool, memDb, saveMemTable } = require('../../utils/database');

function memInsert(table, item) {
  if (!memDb[table]) memDb[table] = [];
  memDb[table].unshift(item);
  saveMemTable(table);
  return item;
}

function memDelete(table, id) {
  if (!memDb[table]) return false;
  memDb[table] = memDb[table].filter(r => String(r.id) !== String(id));
  saveMemTable(table);
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// 0. ملخص الأصول البلدية الشامل (All Assets Summary)
// ══════════════════════════════════════════════════════════════════════
router.get('/', async (req, res, next) => {
  try {
    const structural = memDb.structural_assets || [];
    const infrastructure = memDb.infrastructure_networks || [];
    const energy = memDb.energy_assets || [];
    res.json({
      success: true,
      summary: {
        structuralCount: structural.length,
        infrastructureCount: infrastructure.length,
        energyCount: energy.length,
        totalAssets: structural.length + infrastructure.length + energy.length
      },
      structural,
      infrastructure,
      energy
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 1. الأبنية والجدران الاستنادية (Structural Assets & Retaining Walls)
// ══════════════════════════════════════════════════════════════════════
router.get('/structural', async (req, res, next) => {
  try {
    const { assetType } = req.query;
    let assets = [];
    const pool = getPool();

    if (isPostgresActive() && pool) {
      try {
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
        sql += ` ORDER BY created_at DESC, id DESC`;
        const result = await pool.query(sql, params);
        assets = result.rows;
      } catch (pgErr) {
        console.warn('⚠️ Fallback to memDb for structural assets:', pgErr.message);
      }
    }

    if (!assets.length && memDb.structural_assets) {
      assets = memDb.structural_assets;
      if (assetType && assetType !== 'ALL') {
        assets = assets.filter(a => a.asset_type === assetType || a.assetType === assetType);
      }
    }

    res.json({ success: true, count: assets.length, data: assets });
  } catch (err) {
    next(err);
  }
});

router.post('/structural', async (req, res, next) => {
  try {
    const { id, assetType, name, district, conditionIndex, heightMeters, floorsCount, lat, lng, geometry } = req.body;
    const assetId = id || `AST-${Date.now()}`;
    const latVal = parseFloat(lat || 0);
    const lngVal = parseFloat(lng || 0);
    const condVal = parseFloat(conditionIndex || 85);
    const heightVal = parseFloat(heightMeters || 0);
    const floorsVal = parseInt(floorsCount || 0);
    const now = new Date().toISOString();

    const assetObj = {
      id: assetId,
      asset_type: assetType || 'WALL',
      name: name || 'جدار / أصل إنشائي جديد',
      district: district || 'وسط البلد',
      condition_index: condVal,
      height_meters: heightVal,
      floors_count: floorsVal,
      lat: latVal,
      lng: lngVal,
      geojson: geometry || { type: 'Point', coordinates: [lngVal, latVal] },
      created_at: now,
      updated_at: now
    };

    memInsert('structural_assets', assetObj);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query(`
          INSERT INTO public.structural_assets 
            (id, asset_type, name, district, condition_index, height_meters, floors_count, lat, lng, geom, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            asset_type = EXCLUDED.asset_type,
            condition_index = EXCLUDED.condition_index,
            height_meters = EXCLUDED.height_meters,
            floors_count = EXCLUDED.floors_count,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            geom = EXCLUDED.geom,
            updated_at = NOW();
        `, [assetId, assetObj.asset_type, assetObj.name, assetObj.district, condVal, heightVal, floorsVal, latVal, lngVal]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL insert error for structural asset:', pgErr.message);
      }
    }

    res.status(201).json({ success: true, data: assetObj });
  } catch (err) {
    next(err);
  }
});

router.delete('/structural/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    memDelete('structural_assets', id);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query('DELETE FROM public.structural_assets WHERE id = $1', [id]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL delete error:', pgErr.message);
      }
    }
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2. شبكات البنية التحتية والمياه (Infrastructure Networks)
// ══════════════════════════════════════════════════════════════════════
router.get('/infrastructure', async (req, res, next) => {
  try {
    const { networkType } = req.query;
    let networks = [];
    const pool = getPool();

    if (isPostgresActive() && pool) {
      try {
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
        sql += ` ORDER BY created_at DESC, id DESC`;
        const result = await pool.query(sql, params);
        networks = result.rows;
      } catch (pgErr) {
        console.warn('⚠️ Fallback to memDb for infrastructure:', pgErr.message);
      }
    }

    if (!networks.length && memDb.infrastructure_networks) {
      networks = memDb.infrastructure_networks;
      if (networkType && networkType !== 'ALL') {
        networks = networks.filter(n => n.network_type === networkType || n.networkType === networkType);
      }
    }

    res.json({ success: true, count: networks.length, data: networks });
  } catch (err) {
    next(err);
  }
});

router.post('/infrastructure', async (req, res, next) => {
  try {
    const { id, networkType, code, material, diameterMm, status, coordinates, attributes, lat, lng } = req.body;
    const netId = id || `NET-${Date.now()}`;
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

    memInsert('infrastructure_networks', netObj);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        const geojsonStr = JSON.stringify(netObj.geometry);
        await pool.query(`
          INSERT INTO public.infrastructure_networks 
            (id, network_type, code, material, diameter_mm, status, lat, lng, geom, attributes, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromGeoJSON($9), 4326), $10::jsonb, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            network_type = EXCLUDED.network_type,
            material = EXCLUDED.material,
            diameter_mm = EXCLUDED.diameter_mm,
            status = EXCLUDED.status,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            geom = EXCLUDED.geom,
            updated_at = NOW();
        `, [netId, netObj.network_type, netObj.code, netObj.material, netObj.diameter_mm, netObj.status, latVal, lngVal, geojsonStr, JSON.stringify(netObj.attributes)]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL insert error for infrastructure:', pgErr.message);
      }
    }

    res.status(201).json({ success: true, data: netObj });
  } catch (err) {
    next(err);
  }
});

router.delete('/infrastructure/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    memDelete('infrastructure_networks', id);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query('DELETE FROM public.infrastructure_networks WHERE id = $1', [id]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL delete error:', pgErr.message);
      }
    }
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3. شبكات الإنارة والطاقة (Energy & Lighting)
// ══════════════════════════════════════════════════════════════════════
router.get('/energy', async (req, res, next) => {
  try {
    const { assetType } = req.query;
    let energyAssets = [];
    const pool = getPool();

    if (isPostgresActive() && pool) {
      try {
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
        sql += ` ORDER BY created_at DESC, id DESC`;
        const result = await pool.query(sql, params);
        energyAssets = result.rows;
      } catch (pgErr) {
        console.warn('⚠️ Fallback to memDb for energy assets:', pgErr.message);
      }
    }

    if (!energyAssets.length && memDb.energy_assets) {
      energyAssets = memDb.energy_assets;
      if (assetType && assetType !== 'ALL') {
        energyAssets = energyAssets.filter(e => e.asset_type === assetType || e.assetType === assetType);
      }
    }

    res.json({ success: true, count: energyAssets.length, data: energyAssets });
  } catch (err) {
    next(err);
  }
});

router.post('/energy', async (req, res, next) => {
  try {
    const { id, code, name, assetType, fixtureType, wattage, district, lat, lng, condition } = req.body;
    const energyId = id || `ENG-${Date.now()}`;
    const latVal = parseFloat(lat || 0);
    const lngVal = parseFloat(lng || 0);
    const wattVal = parseFloat(wattage || 150);
    const now = new Date().toISOString();

    const energyObj = {
      id: energyId,
      code: code || energyId,
      name: name || 'عمود إنارة / أصل طاقة',
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

    memInsert('energy_assets', energyObj);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query(`
          INSERT INTO public.energy_assets 
            (id, code, name, asset_type, fixture_type, wattage, district, lat, lng, geom, condition, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($9, $8), 4326), $10, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            fixture_type = EXCLUDED.fixture_type,
            wattage = EXCLUDED.wattage,
            district = EXCLUDED.district,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            geom = EXCLUDED.geom,
            condition = EXCLUDED.condition,
            updated_at = NOW();
        `, [energyId, energyObj.code, energyObj.name, energyObj.asset_type, energyObj.fixture_type, wattVal, energyObj.district, latVal, lngVal, energyObj.condition]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL insert error for energy asset:', pgErr.message);
      }
    }

    res.status(201).json({ success: true, data: energyObj });
  } catch (err) {
    next(err);
  }
});

router.delete('/energy/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    memDelete('energy_assets', id);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query('DELETE FROM public.energy_assets WHERE id = $1', [id]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL delete error:', pgErr.message);
      }
    }
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4. تصاريح الحفر وتزويد الخدمات (Excavation & Service Connection Permits)
// ══════════════════════════════════════════════════════════════════════
router.get('/permits', async (req, res, next) => {
  try {
    const { status, permitType } = req.query;
    let permits = [];
    const pool = getPool();

    if (isPostgresActive() && pool) {
      try {
        let sql = `
          SELECT id, 
                 COALESCE(code, permit_number, id) as code,
                 COALESCE(permit_number, code, id) as permit_number,
                 COALESCE(applicant, applicant_name, 'مواطن / شركة') as applicant,
                 COALESCE(contractor, applicant_name, 'مقاول معتمد') as contractor,
                 COALESCE(district, location_description, 'كفرنجة') as district,
                 COALESCE(purpose, location_description, 'تزويد وتمديد خدمات عامة') as purpose,
                 COALESCE(permit_type, entity_type, 'WATER_CONNECTION') as permit_type,
                 COALESCE(NULLIF(length_m, 0), excavation_length, 0) as length_m,
                 COALESCE(NULLIF(width_m, 0), excavation_width, 0) as width_m,
                 COALESCE(NULLIF(depth_m, 0), 1.0) as depth_m,
                 COALESCE(surface_type, 'ASPHALT') as surface_type,
                 COALESCE(NULLIF(insurance_amount, 0), insurance_amount, 0) as insurance_fee,
                 COALESCE(NULLIF(insurance_amount, 0), 0) as insurance_amount,
                 COALESCE(NULLIF(fee_amount, 0), 0) as fee_amount,
                 COALESCE(status, 'ACTIVE') as status,
                 COALESCE(reinstatement_status, 'PENDING') as reinstatement_status,
                 start_date, end_date,
                 COALESCE(lat, ST_Y(geom), 32.3301) as lat, 
                 COALESCE(lng, ST_X(geom), 35.7501) as lng, 
                 ST_AsGeoJSON(geom) as geojson,
                 ST_AsGeoJSON(geom) as geometry,
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
        if (conditions.length) {
          sql += ` WHERE ` + conditions.join(' AND ');
        }
        sql += ` ORDER BY created_at DESC, id DESC`;
        const result = await pool.query(sql, params);
        permits = result.rows;
      } catch (pgErr) {
        console.warn('⚠️ Fallback to memDb for excavation permits:', pgErr.message);
      }
    }

    if (!permits.length && memDb.excavation_permits) {
      permits = memDb.excavation_permits;
      if (status && status !== 'ALL') {
        permits = permits.filter(p => p.status === status);
      }
    }

    res.json({ success: true, count: permits.length, data: permits });
  } catch (err) {
    next(err);
  }
});

router.post('/permits', async (req, res, next) => {
  try {
    const { 
      id, code, permitNumber, applicant, contractor, district, purpose, 
      permitType, lengthM, widthM, depthM, surfaceType, insuranceFee, feeAmount, 
      startDate, endDate, status, reinstatementStatus, notes, attributes, coordinates, lat, lng 
    } = req.body;

    const permitId = id || `EPM-${Date.now()}`;
    const latVal = parseFloat(lat || (coordinates && coordinates[0] ? coordinates[0][1] : 32.3301));
    const lngVal = parseFloat(lng || (coordinates && coordinates[0] ? coordinates[0][0] : 35.7501));
    const now = new Date().toISOString();

    const geoData = coordinates && coordinates.length >= 2
      ? { type: 'LineString', coordinates: coordinates.map(c => [c[0], c[1]]) }
      : { type: 'Point', coordinates: [lngVal, latVal] };

    const attrObj = typeof attributes === 'object' && attributes !== null ? attributes : {};

    const permitObj = {
      id: permitId,
      code: code || permitId,
      permit_number: permitNumber || code || permitId,
      applicant: applicant || 'مواطن / جهة خدمية',
      applicant_name: applicant || 'مواطن / جهة خدمية',
      contractor: contractor || 'مقاول معتمد',
      district: district || 'كفرنجة',
      location_description: district || purpose || 'كفرنجة',
      purpose: purpose || 'تزويد خدمات مياه / كهرباء',
      permit_type: permitType || 'WATER_CONNECTION',
      entity_type: permitType || 'WATER_CONNECTION',
      length_m: parseFloat(lengthM || 0),
      excavation_length: parseFloat(lengthM || 0),
      width_m: parseFloat(widthM || 0),
      excavation_width: parseFloat(widthM || 0),
      depth_m: parseFloat(depthM || 1.0),
      surface_type: surfaceType || 'ASPHALT',
      insurance_fee: parseFloat(insuranceFee || 0),
      insurance_amount: parseFloat(insuranceFee || 0),
      fee_amount: parseFloat(feeAmount || 0),
      start_date: startDate || new Date().toISOString().slice(0, 10),
      end_date: endDate || new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
      status: status || 'ACTIVE',
      reinstatement_status: reinstatementStatus || 'PENDING',
      notes: notes || '',
      attributes: attrObj,
      lat: latVal,
      lng: lngVal,
      geojson: geoData,
      geometry: geoData,
      created_at: now,
      updated_at: now
    };

    memInsert('excavation_permits', permitObj);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        const geojsonStr = JSON.stringify(geoData);
        await pool.query(`
          INSERT INTO public.excavation_permits 
            (id, code, permit_number, applicant, applicant_name, contractor, district, location_description, purpose, permit_type, entity_type, length_m, excavation_length, width_m, excavation_width, depth_m, surface_type, insurance_amount, fee_amount, status, reinstatement_status, start_date, end_date, notes, attributes, lat, lng, geom, created_at, updated_at)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, ST_SetSRID(ST_GeomFromGeoJSON($28), 4326), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            applicant = EXCLUDED.applicant,
            applicant_name = EXCLUDED.applicant_name,
            contractor = EXCLUDED.contractor,
            district = EXCLUDED.district,
            location_description = EXCLUDED.location_description,
            purpose = EXCLUDED.purpose,
            permit_type = EXCLUDED.permit_type,
            entity_type = EXCLUDED.entity_type,
            length_m = EXCLUDED.length_m,
            excavation_length = EXCLUDED.excavation_length,
            width_m = EXCLUDED.width_m,
            excavation_width = EXCLUDED.excavation_width,
            depth_m = EXCLUDED.depth_m,
            surface_type = EXCLUDED.surface_type,
            insurance_amount = EXCLUDED.insurance_amount,
            fee_amount = EXCLUDED.fee_amount,
            status = EXCLUDED.status,
            reinstatement_status = EXCLUDED.reinstatement_status,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            notes = EXCLUDED.notes,
            attributes = EXCLUDED.attributes,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            geom = EXCLUDED.geom,
            updated_at = NOW();
        `, [
          permitObj.id, permitObj.code, permitObj.permit_number, permitObj.applicant, permitObj.applicant_name,
          permitObj.contractor, permitObj.district, permitObj.location_description, permitObj.purpose,
          permitObj.permit_type, permitObj.entity_type, permitObj.length_m, permitObj.excavation_length,
          permitObj.width_m, permitObj.excavation_width, permitObj.depth_m, permitObj.surface_type,
          permitObj.insurance_amount, permitObj.fee_amount, permitObj.status, permitObj.reinstatement_status,
          permitObj.start_date, permitObj.end_date, permitObj.notes, JSON.stringify(attrObj), latVal, lngVal, geojsonStr
        ]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL insert error for excavation permit:', pgErr.message);
      }
    }

    res.status(201).json({ success: true, data: permitObj });
  } catch (err) {
    next(err);
  }
});

// اعتماد ومصادقة إعادة أوضاع الحفريات والإفراج عن كفالة الحفر
router.post('/permits/:id/reinstate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inspectorName, inspectionNotes, asBuiltLength, asBuiltWidth, status } = req.body;
    const finalStatus = status || 'COMPLETED';

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query(`
          UPDATE public.excavation_permits
          SET reinstatement_status = 'PASSED',
              status = $1,
              notes = CONCAT(COALESCE(notes, ''), ' | مصادقة إعادة الأوضاع بواسطة: ', $2::text, ' - ', $3::text),
              updated_at = NOW()
          WHERE id = $4
        `, [finalStatus, inspectorName || 'مهندس الميدان', inspectionNotes || 'مطابق للمواصفة', id]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL reinstate error:', pgErr.message);
      }
    }

    const memItem = (memDb.excavation_permits || []).find(p => p.id === id);
    if (memItem) {
      memItem.reinstatement_status = 'PASSED';
      memItem.status = finalStatus;
      memItem.notes = (memItem.notes || '') + ` | تم استلام إعادة الأوضاع: ${inspectorName || 'مهندس الموقع'}`;
      saveMemTable('excavation_permits');
    }

    res.json({
      success: true,
      message: '✅ تمت المصادقة على إعادة أوضاع الحفرية بنجاح وجاهزية الإفراج عن التأمين',
      permit_id: id,
      reinstatement_status: 'PASSED'
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/permits/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    memDelete('excavation_permits', id);

    const pool = getPool();
    if (isPostgresActive() && pool) {
      try {
        await pool.query('DELETE FROM public.excavation_permits WHERE id = $1', [id]);
      } catch (pgErr) {
        console.warn('⚠️ PostgreSQL delete error:', pgErr.message);
      }
    }
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
