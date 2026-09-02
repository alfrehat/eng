/**
 * Administration/API/usersEngine.js
 * محرك إدارة المستخدمين والأدوار والوحدات التنظيمية وسجل العمليات (RBAC & Audit)
 * بلدية كفرنجة الجديدة - الإصدار الموحد v4.0
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');
const rbacManager = require('../../middlewares/rbacManager');
const {
  dbQuery,
  dbGet,
  dbRun,
  isPostgresActive,
  memDb,
  saveMemTable
} = require('../../utils/database');

function memGet(table, id) {
  if (!memDb[table]) return null;
  return memDb[table].find(r => String(r.id) === String(id)) || null;
}

function memInsert(table, item) {
  if (!memDb[table]) memDb[table] = [];
  memDb[table].unshift(item);
  saveMemTable(table);
  return item;
}

function memUpdate(table, id, updates) {
  if (!memDb[table]) return null;
  const idx = memDb[table].findIndex(r => String(r.id) === String(id) || (table === 'roles' && String(r.name) === String(id)));
  if (idx !== -1) {
    memDb[table][idx] = { ...memDb[table][idx], ...updates, updatedAt: new Date().toISOString() };
    saveMemTable(table);
    return memDb[table][idx];
  }
  return null;
}

function memDelete(table, id) {
  if (!memDb[table]) return false;
  memDb[table] = memDb[table].filter(r => String(r.id) !== String(id) && (table !== 'roles' || String(r.name) !== String(id)));
  saveMemTable(table);
  return true;
}

// 1. سجل العمليات والرقابة (Activity Log)
router.get('/activity', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    let logs;
    if (isPostgresActive()) {
      logs = await dbQuery(
        `SELECT a.*, u."fullName" as "userName" FROM activity_log a LEFT JOIN users u ON a."userId" = u.id ORDER BY a."createdAt" DESC LIMIT $1`,
        [limit]
      );
    } else {
      logs = (memDb.activity_log || []).slice().reverse().slice(0, limit).map(a => ({
        ...a,
        userName: (memDb.users || []).find(u => u.id === a.userId)?.fullName || a.userId
      }));
    }
    res.json(logs || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. استرجاع قائمة الصلاحيات المعرفة في النظام
router.get('/permissions', requireAuth, (req, res) => {
  const perms = (rbacManager.PERMISSION_INVENTORY || []).map(p => ({
    id: p.permissionCode,
    key: p.permissionCode,
    name: `${p.icon ? p.icon + ' ' : ''}${p.name}`,
    category: p.group === 'screens' ? 'التبويبات والشاشات' : 'العمليات والأزرار'
  }));
  res.json(perms);
});

// 2.1 جرد الصلاحيات المؤسسية الكامل (Canonical Permission Inventory)
router.get('/permissions/inventory', requireAuth, (req, res) => {
  res.json({
    success: true,
    count: rbacManager.PERMISSION_INVENTORY.length,
    inventory: rbacManager.PERMISSION_INVENTORY
  });
});

// 2.2 الصلاحيات الفعالة للمستخدم الحالي (My Effective Permissions)
router.get('/auth/my-permissions', requireAuth, async (req, res) => {
  try {
    const details = await rbacManager.getEffectiveUserPermissions(req.user);
    res.json({
      success: true,
      ...details
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2.3 الصلاحيات الفعالة لأي مستخدم مع بيان المصدر (لشاشة إدارة النظام)
router.get('/auth/effective-permissions/:id', requireAdmin, async (req, res) => {
  try {
    const details = await rbacManager.getEffectiveUserPermissions(req.params.id);
    if (details.error) {
      return res.status(404).json({ error: details.error });
    }
    res.json({
      success: true,
      ...details
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. استرجاع قائمة المستخدمين
router.get('/users', requireAuth, async (req, res) => {
  try {
    let rows;
    if (isPostgresActive()) {
      rows = await dbQuery(
        'SELECT id, username, "fullName", role, email, phone, avatar, department, job_title, two_factor_enabled, permissions, "createdAt", "updatedAt" FROM users ORDER BY id ASC'
      );
    } else {
      rows = (memDb.users || []).map(({ password, ...u }) => u).sort((a, b) => a.id.localeCompare(b.id));
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3.1 دمج حسابين ونقل الصلاحيات والمهام (Merge Users)
router.post('/users/merge', requireAdmin, async (req, res) => {
  const { sourceUserId, targetUserId, action } = req.body;
  if (!sourceUserId || !targetUserId) {
    return res.status(400).json({ error: 'يرجى تحديد الحساب المصدر والحساب الهدف لإتمام عملية الدمج' });
  }
  if (sourceUserId === targetUserId) {
    return res.status(400).json({ error: 'لا يمكن دمج الحساب مع نفسه' });
  }
  if (sourceUserId === 'U-001') {
    return res.status(400).json({ error: 'لا يمكن دمج أو إلغاء حساب مدير النظام الرئيسي' });
  }

  try {
    let sourceUser, targetUser;
    if (isPostgresActive()) {
      sourceUser = await dbGet('SELECT * FROM users WHERE id = $1', [sourceUserId]);
      targetUser = await dbGet('SELECT * FROM users WHERE id = $1', [targetUserId]);
    } else {
      sourceUser = memGet('users', sourceUserId);
      targetUser = memGet('users', targetUserId);
    }

    if (!sourceUser || !targetUser) {
      return res.status(404).json({ error: 'أحد الحسابين المحددين غير موجود في النظام' });
    }

    // نقل المهام
    if (isPostgresActive()) {
      try {
        await dbRun('UPDATE tasks SET "assignedTo" = $1 WHERE "assignedTo" = $2 OR "assignedTo" = $3', [targetUser.fullName, sourceUser.fullName, sourceUserId]);
      } catch (e) {}
      // دمج الصلاحيات
      const sPerms = rbacManager.parseUserPermissions(sourceUser);
      const tPerms = rbacManager.parseUserPermissions(targetUser);
      const mergedPerms = Array.from(new Set([...tPerms, ...sPerms]));
      await dbRun('UPDATE users SET permissions = $1 WHERE id = $2', [mergedPerms.join(','), targetUserId]);
      // حذف الحساب المصدر
      await dbRun('DELETE FROM users WHERE id = $1', [sourceUserId]);
    } else {
      if (memDb.tasks) {
        memDb.tasks.forEach(t => {
          if (t.assignedTo === sourceUser.fullName || t.assignedTo === sourceUserId) {
            t.assignedTo = targetUser.fullName;
          }
        });
        saveMemTable('tasks');
      }
      const sPerms = rbacManager.parseUserPermissions(sourceUser);
      const tPerms = rbacManager.parseUserPermissions(targetUser);
      const mergedPerms = Array.from(new Set([...tPerms, ...sPerms]));
      memUpdate('users', targetUserId, { permissions: mergedPerms.join(',') });
      memDelete('users', sourceUserId);
    }

    res.json({
      success: true,
      message: `تم دمج حساب (${sourceUser.fullName}) في حساب (${targetUser.fullName}) ونقل كافة المهام والصلاحيات بنجاح.`
    });
  } catch (e) {
    res.status(500).json({ error: 'فشل إتمام عملية الدمج: ' + e.message });
  }
});

// 3.2 استرجاع صلاحيات مستخدم محدد (User Permissions)
router.get('/users/:id/permissions', requireAuth, async (req, res) => {
  try {
    let user;
    if (isPostgresActive()) {
      user = await dbGet('SELECT id, username, "fullName", role, permissions FROM users WHERE id = $1', [req.params.id]);
    } else {
      user = memGet('users', req.params.id);
    }
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const perms = rbacManager.parseUserPermissions(user);
    res.json({ userId: user.id, role: user.role, permissions: perms });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3.3 تحديث صلاحيات مستخدم محدد (Set Custom User Permissions)
router.put('/users/:id/permissions', requireAdmin, async (req, res) => {
  const { permissions } = req.body;
  const permsVal = Array.isArray(permissions) ? permissions.join(',') : (permissions || '');
  try {
    if (isPostgresActive()) {
      await dbRun('UPDATE users SET permissions = $1, "updatedAt" = NOW() WHERE id = $2', [permsVal, req.params.id]);
    } else {
      memUpdate('users', req.params.id, { permissions: permsVal });
    }
    res.json({ success: true, message: 'تم تحديث صلاحيات المستخدم بنجاح' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. استرجاع مستخدم محدد
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    let user;
    if (isPostgresActive()) {
      user = await dbGet(
        'SELECT id, username, "fullName", role, email, phone, avatar, department, job_title, two_factor_enabled, permissions FROM users WHERE id = $1',
        [req.params.id]
      );
    } else {
      const u = memGet('users', req.params.id);
      if (u) {
        const { password, ...rest } = u;
        user = rest;
      }
    }
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. إنشاء مستخدم جديد
router.post('/users', requireAdmin, async (req, res) => {
  const { username, password, fullName, role, email, phone, avatar, department, job_title, two_factor_enabled, permissions } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'اسم المستخدم مطلوب' });
  if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'الاسم الكامل مطلوب' });
  if (!password || !password.trim()) return res.status(400).json({ error: 'كلمة المرور مطلوبة لإنشاء حساب جديد' });

  const trimmedUsername = username.trim();
  try {
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const permsVal = Array.isArray(permissions) ? permissions.join(',') : (permissions || '');

    if (isPostgresActive()) {
      const dup = await dbGet('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [trimmedUsername]);
      if (dup) {
        return res.status(400).json({ error: `اسم المستخدم "${trimmedUsername}" مسجل مسبقاً في النظام` });
      }

      const maxIdRes = await dbGet("SELECT id FROM users WHERE id ~ '^U-[0-9]+$' ORDER BY CAST(SUBSTRING(id FROM 3) AS INTEGER) DESC LIMIT 1");
      let nextNum = 6;
      if (maxIdRes && maxIdRes.id) {
        const lastNum = parseInt(maxIdRes.id.replace('U-', ''), 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const id = `U-${String(nextNum).padStart(3, '0')}`;

      await dbRun(`
        INSERT INTO users (id, username, password, "fullName", role, email, phone, avatar, department, job_title, two_factor_enabled, permissions, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [id, trimmedUsername, hashedPassword, fullName.trim(), role || 'engineer', email || '', phone || '', avatar || '', department || '', job_title || '', !!two_factor_enabled, permsVal]);

      const now = new Date().toISOString();
      memInsert('users', {
        id, username: trimmedUsername, password: hashedPassword, fullName: fullName.trim(),
        role: role || 'engineer', email: email || '', phone: phone || '', avatar: avatar || '',
        department: department || '', job_title: job_title || '', two_factor_enabled: !!two_factor_enabled,
        permissions: permsVal, createdAt: now, updatedAt: now
      });

      return res.status(201).json({ id, message: 'تمت إضافة المستخدم بنجاح', success: true });
    } else {
      if ((memDb.users || []).find(u => u.username && u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
        return res.status(400).json({ error: `اسم المستخدم "${trimmedUsername}" مسجل مسبقاً` });
      }
      const id = 'U-' + String((memDb.users || []).length + 1).padStart(3, '0');
      const now = new Date().toISOString();
      memInsert('users', {
        id, username: trimmedUsername, password: hashedPassword, fullName: fullName.trim(),
        role: role || 'engineer', email: email || '', phone: phone || '', avatar: avatar || '',
        department: department || '', job_title: job_title || '', two_factor_enabled: !!two_factor_enabled,
        permissions: permsVal, createdAt: now, updatedAt: now
      });
      return res.status(201).json({ id, message: 'تمت إضافة المستخدم بنجاح', success: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'فشل حفظ المستخدم: ' + e.message });
  }
});

// 6. تعديل مستخدم
router.put('/users/:id', requireAuth, async (req, res) => {
  const { username, password, fullName, role, email, phone, avatar, department, job_title, two_factor_enabled, permissions } = req.body;
  const currentUserId = req.user ? req.user.id : null;
  const isSuperAdmin = req.user && (req.user.role === 'admin' || req.user.id === 'U-001');

  if (!isSuperAdmin && currentUserId !== req.params.id) {
    return res.status(403).json({ error: 'غير مصرح لك بتعديل بيانات مستخدم آخر' });
  }

  try {
    const permsVal = Array.isArray(permissions) ? permissions.join(',') : (permissions !== undefined ? permissions : null);
    let hashedPassword = null;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    if (isPostgresActive()) {
      if (hashedPassword) {
        await dbRun(`
          UPDATE users 
          SET "fullName" = COALESCE($1, "fullName"), 
              password = $2,
              role = COALESCE($3, role), 
              email = COALESCE($4, email), 
              phone = COALESCE($5, phone),
              department = COALESCE($6, department),
              job_title = COALESCE($7, job_title),
              permissions = COALESCE($8, permissions),
              "updatedAt" = NOW()
          WHERE id = $9
        `, [
          fullName ? fullName.trim() : null,
          hashedPassword,
          isSuperAdmin ? role : null,
          email !== undefined ? email : null,
          phone !== undefined ? phone : null,
          department !== undefined ? department : null,
          job_title !== undefined ? job_title : null,
          isSuperAdmin ? permsVal : null,
          req.params.id
        ]);
      } else {
        await dbRun(`
          UPDATE users 
          SET "fullName" = COALESCE($1, "fullName"), 
              role = COALESCE($2, role), 
              email = COALESCE($3, email), 
              phone = COALESCE($4, phone),
              department = COALESCE($5, department),
              job_title = COALESCE($6, job_title),
              permissions = COALESCE($7, permissions),
              "updatedAt" = NOW()
          WHERE id = $8
        `, [
          fullName ? fullName.trim() : null,
          isSuperAdmin ? role : null,
          email !== undefined ? email : null,
          phone !== undefined ? phone : null,
          department !== undefined ? department : null,
          job_title !== undefined ? job_title : null,
          isSuperAdmin ? permsVal : null,
          req.params.id
        ]);
      }
    }

    const updates = {};
    if (fullName) updates.fullName = fullName.trim();
    if (hashedPassword) updates.password = hashedPassword;
    if (isSuperAdmin && role) updates.role = role;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;
    if (job_title !== undefined) updates.job_title = job_title;
    if (isSuperAdmin && permsVal !== null) updates.permissions = permsVal;
    if (two_factor_enabled !== undefined) updates.two_factor_enabled = !!two_factor_enabled;
    const updatedRecord = memUpdate('users', req.params.id, updates);

    res.json({ message: 'تم تحديث بيانات المستخدم بنجاح', success: true, data: updatedRecord });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. حذف مستخدم
router.delete('/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === 'U-001') {
    return res.status(400).json({ error: 'لا يمكن حذف الحساب الجذري لمدير النظام' });
  }
  try {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM users WHERE id = $1', [req.params.id]);
    }
    memDelete('users', req.params.id);
    res.json({ message: 'تم حذف المستخدم بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. إدارة الأدوار (Roles)
router.get('/roles', requireAuth, async (req, res) => {
  try {
    let rows;
    if (isPostgresActive()) {
      try {
        await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS label VARCHAR(255)');
        rows = await dbQuery('SELECT id, name, label, description FROM roles ORDER BY id ASC');
      } catch (e) {
        try {
          rows = await dbQuery('SELECT id, name, description FROM roles ORDER BY id ASC');
        } catch (e2) {
          rows = memDb.roles || [];
        }
      }
    }
    if (!rows || rows.length === 0) {
      rows = memDb.roles || [];
    }

    const mapped = (rows || []).map(r => ({
      id: r.id || r.name,
      name: r.name,
      label: (r.label && String(r.label).trim()) ? r.label : r.name,
      description: r.description !== undefined && r.description !== null ? r.description : ''
    }));
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/roles', requireAdmin, async (req, res) => {
  const { name, label, description } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم الدور مطلوب' });
  try {
    const id = `R-${Date.now().toString().slice(-4)}`;
    const finalLabel = (label && String(label).trim()) ? label.trim() : name;
    const roleObj = { id, name, label: finalLabel, description: description || '' };
    if (isPostgresActive()) {
      try {
        await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS label VARCHAR(255)');
        await dbRun('INSERT INTO roles (id, name, label, description) VALUES ($1, $2, $3, $4)', [id, name, finalLabel, description || '']);
      } catch (dbE) {
        console.warn('⚠️ [Roles API] Postgres insert role error:', dbE.message);
      }
    }
    memInsert('roles', roleObj);
    await rbacManager.reloadDynamicPermissions();
    res.status(201).json({ id, message: 'تم حفظ الدور بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/roles/:id', requireAdmin, async (req, res) => {
  const { name, label, description } = req.body;
  const targetId = req.params.id;
  try {
    const finalName = name || targetId;
    const finalLabel = (label && String(label).trim()) ? label.trim() : finalName;
    const finalDesc = description !== undefined ? description : '';

    if (isPostgresActive()) {
      try {
        await dbRun('ALTER TABLE roles ADD COLUMN IF NOT EXISTS label VARCHAR(255)');
        await dbRun('UPDATE roles SET name = $1, label = $2, description = $3 WHERE id = $4 OR name = $4',
          [finalName, finalLabel, finalDesc, targetId]);
      } catch (dbE) {
        console.warn('⚠️ [Roles API] Postgres update role error:', dbE.message);
      }
    }
    
    // Always update memory DB and write to disk
    const updated = memUpdate('roles', targetId, { name: finalName, label: finalLabel, description: finalDesc });
    if (!updated && memDb.roles) {
      const existing = memDb.roles.find(r => String(r.id) === String(targetId) || String(r.name) === String(targetId));
      if (existing) {
        Object.assign(existing, { name: finalName, label: finalLabel, description: finalDesc, updatedAt: new Date().toISOString() });
      } else {
        memDb.roles.push({ id: targetId, name: finalName, label: finalLabel, description: finalDesc, updatedAt: new Date().toISOString() });
      }
      saveMemTable('roles');
    }

    await rbacManager.reloadDynamicPermissions();
    res.json({ message: 'تم تحديث الدور بنجاح', success: true, data: { id: targetId, name: finalName, label: finalLabel, description: finalDesc } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/roles/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === 'R-001' || targetId === 'admin') {
    return res.status(400).json({ error: 'لا يمكن حذف دور مدير النظام الرئيسي' });
  }
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM roles WHERE id = $1 OR name = $1', [targetId]);
        await dbRun('DELETE FROM role_permissions WHERE "roleId" = $1 OR role_id = $1', [targetId]);
      } catch (e) {
        console.warn('⚠️ [Roles API] Postgres delete role error:', e.message);
      }
    }
    memDelete('roles', targetId);
    if (memDb.role_permissions) {
      memDb.role_permissions = memDb.role_permissions.filter(rp => rp.roleId !== targetId && rp.role_id !== targetId);
      saveMemTable('role_permissions');
    }
    await rbacManager.reloadDynamicPermissions();
    res.json({ message: 'تم حذف الدور بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 9. إدارة الصلاحيات المسندة للأدوار (Role Permissions)
router.get('/role-permissions/:roleId', requireAuth, async (req, res) => {
  try {
    let rows = [];
    if (isPostgresActive()) {
      try {
        const dbRows = await dbQuery('SELECT COALESCE(permission_id, "permissionId") as permission_id FROM role_permissions WHERE role_id = $1 OR "roleId" = $1', [req.params.roleId]);
        rows = dbRows.map(r => r.permission_id);
      } catch (e) {
        rows = (memDb.role_permissions || []).filter(rp => rp.roleId === req.params.roleId).map(rp => rp.permissionId);
      }
    } else {
      rows = (memDb.role_permissions || []).filter(rp => rp.roleId === req.params.roleId).map(rp => rp.permissionId);
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/role-permissions/:roleId', requireAdmin, async (req, res) => {
  const { permissions } = req.body;
  const roleId = req.params.roleId;
  const permsList = Array.isArray(permissions) ? permissions : [];
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM role_permissions WHERE role_id = $1 OR "roleId" = $1', [roleId]);
        for (const perm of permsList) {
          try {
            await dbRun('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, perm]);
          } catch (e1) {
            await dbRun('INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)', [roleId, perm]);
          }
        }
      } catch (e) {
        console.warn('⚠️ [RBAC] Postgres role_permissions update error:', e.message);
      }
    }
    
    // Always keep memory db in sync for high performance lookup
    if (!memDb.role_permissions) memDb.role_permissions = [];
    memDb.role_permissions = memDb.role_permissions.filter(rp => rp.roleId !== roleId);
    permsList.forEach(perm => {
      memDb.role_permissions.push({ id: `RP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, roleId, permissionId: perm });
    });
    saveMemTable('role_permissions');

    await rbacManager.reloadDynamicPermissions();
    res.json({ message: 'تم تحديث مصفوفة الصلاحيات وتفعيلها لحظياً بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 10. الوحدات التنظيمية (Org Units)
router.get('/org-units', requireAuth, async (req, res) => {
  try {
    let rows = [];
    if (isPostgresActive()) {
      try {
        rows = await dbQuery('SELECT id, name, "parentId", type, description FROM org_units ORDER BY id ASC');
      } catch (e) {
        rows = memDb.org_units || [];
      }
    } else {
      rows = memDb.org_units || [];
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/org-units', requireAdmin, async (req, res) => {
  const { name, parentId, type, description } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم الوحدة / القسم مطلوب' });
  try {
    const id = `OU-${Date.now().toString().slice(-4)}`;
    const pid = (!parentId || parentId === 'NULL' || parentId === 'null') ? null : parentId;
    if (isPostgresActive()) {
      try {
        await dbRun(
          'INSERT INTO org_units (id, name, "parentId", type, description) VALUES ($1, $2, $3, $4, $5)',
          [id, name, pid, type || 'department', description || '']
        );
      } catch (e) {
        memInsert('org_units', { id, name, parentId: pid, type: type || 'department', description: description || '' });
      }
    } else {
      memInsert('org_units', { id, name, parentId: pid, type: type || 'department', description: description || '' });
    }
    res.status(201).json({ id, message: 'تم حفظ الوحدة التنظيمية بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/org-units/:id', requireAdmin, async (req, res) => {
  const { name, parentId, type, description } = req.body;
  try {
    const pid = (!parentId || parentId === 'NULL' || parentId === 'null') ? null : parentId;
    if (isPostgresActive()) {
      try {
        await dbRun(
          'UPDATE org_units SET name = COALESCE($1, name), "parentId" = $2, type = COALESCE($3, type), description = COALESCE($4, description) WHERE id = $5',
          [name, pid, type, description, req.params.id]
        );
      } catch (e) {
        memUpdate('org_units', req.params.id, { name, parentId: pid, type, description });
      }
    } else {
      memUpdate('org_units', req.params.id, { name, parentId: pid, type, description });
    }
    res.json({ message: 'تم تحديث الوحدة التنظيمية بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/org-units/:id', requireAdmin, async (req, res) => {
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM org_units WHERE id = $1', [req.params.id]);
      } catch (e) {
        memDelete('org_units', req.params.id);
      }
    } else {
      memDelete('org_units', req.params.id);
    }
    res.json({ message: 'تم حذف الوحدة التنظيمية بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 11. إسناد الموظفين للوحدات والأدوار (User Org Units)
router.get('/user-org-units', requireAuth, async (req, res) => {
  try {
    let rows;
    if (isPostgresActive()) {
      rows = await dbQuery(`
        SELECT uou.id, uou."userId", uou."orgUnitId", uou."roleId",
               u."fullName" as "userName", ou.name as "orgUnitName", r.name as "roleName"
        FROM user_org_units uou
        LEFT JOIN users u ON uou."userId" = u.id
        LEFT JOIN org_units ou ON uou."orgUnitId" = ou.id
        LEFT JOIN roles r ON uou."roleId" = r.id
        ORDER BY uou.id ASC
      `);
    } else {
      rows = (memDb.user_org_units || []).map(uou => {
        const user = (memDb.users || []).find(u => u.id === uou.userId);
        const org = (memDb.org_units || []).find(o => o.id === uou.orgUnitId);
        const role = (memDb.roles || []).find(r => r.id === uou.roleId);
        return {
          ...uou,
          userName: user ? user.fullName : uou.userId,
          orgUnitName: org ? org.name : uou.orgUnitId,
          roleName: role ? role.name : uou.roleId
        };
      });
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/user-org-units', requireAdmin, async (req, res) => {
  const { userId, orgUnitId, roleId } = req.body;
  if (!userId || !orgUnitId || !roleId) return res.status(400).json({ error: 'كافة الحقول مطلوبة' });
  try {
    const id = `uou-${Date.now().toString().slice(-6)}`;
    if (isPostgresActive()) {
      await dbRun(
        'INSERT INTO user_org_units (id, "userId", "orgUnitId", "roleId", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
        [id, userId, orgUnitId, roleId]
      );
    } else {
      memInsert('user_org_units', { id, userId, orgUnitId, roleId });
    }
    res.status(201).json({ id, message: 'تم إسناد الموظف بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/user-org-units/:id', requireAdmin, async (req, res) => {
  try {
    if (isPostgresActive()) {
      await dbRun('DELETE FROM user_org_units WHERE id = $1', [req.params.id]);
    } else {
      memDelete('user_org_units', req.params.id);
    }
    res.json({ message: 'تم إلغاء الإسناد بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 12. جداول الترميز والخيارات العامة (Lookups)
router.get('/lookups', requireAuth, async (req, res) => {
  try {
    let rows = null;
    if (isPostgresActive()) {
      try {
        const pgRows = await dbQuery('SELECT * FROM lookups ORDER BY "sortOrder" ASC, id ASC');
        if (pgRows && pgRows.length > 0) rows = pgRows;
      } catch (e) {}
    }
    if (!rows || rows.length === 0) {
      rows = memDb.lookups || [];
      if (!rows.length) {
        const p = require('path').join(__dirname, '../../database/lookups.json');
        const fs = require('fs');
        if (fs.existsSync(p)) {
          try {
            rows = JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
            memDb.lookups = rows;
          } catch (e) {}
        }
      }
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/lookups', requireAdmin, async (req, res) => {
  const { group, code, valueAr, sortOrder, isActive } = req.body;
  if (!group || !code || !valueAr) return res.status(400).json({ error: 'المجموعة والرمز والقيمة مطلوبة' });
  try {
    const id = `LKP-${Date.now().toString().slice(-4)}`;
    const item = { id, group, code, valueAr, sortOrder: parseInt(sortOrder || '1', 10), isActive: isActive !== false };
    if (isPostgresActive()) {
      try {
        await dbRun('INSERT INTO lookups (id, "group", code, "valueAr", "sortOrder", "isActive") VALUES ($1, $2, $3, $4, $5, $6)',
          [id, group, code, valueAr, item.sortOrder, item.isActive]);
      } catch (e) {
        memInsert('lookups', item);
      }
    } else {
      memInsert('lookups', item);
    }
    res.status(201).json({ id, message: 'تمت إضافة الترميز بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/lookups/:id', requireAdmin, async (req, res) => {
  const { group, code, valueAr, sortOrder, isActive } = req.body;
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('UPDATE lookups SET "group" = COALESCE($1, "group"), code = COALESCE($2, code), "valueAr" = COALESCE($3, "valueAr"), "sortOrder" = COALESCE($4, "sortOrder"), "isActive" = COALESCE($5, "isActive") WHERE id = $6',
          [group, code, valueAr, sortOrder ? parseInt(sortOrder, 10) : null, isActive !== undefined ? isActive : null, req.params.id]);
      } catch (e) {
        memUpdate('lookups', req.params.id, { group, code, valueAr, sortOrder: parseInt(sortOrder || '1', 10), isActive: isActive !== false });
      }
    } else {
      memUpdate('lookups', req.params.id, { group, code, valueAr, sortOrder: parseInt(sortOrder || '1', 10), isActive: isActive !== false });
    }
    res.json({ message: 'تم تحديث الترميز بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/lookups/:id', requireAdmin, async (req, res) => {
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM lookups WHERE id = $1', [req.params.id]);
      } catch (e) {
        memDelete('lookups', req.params.id);
      }
    } else {
      memDelete('lookups', req.params.id);
    }
    res.json({ message: 'تم حذف الترميز بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 13. مسارات العمل وسلاسل الاعتماد (Workflows)
router.get('/workflows', requireAuth, async (req, res) => {
  try {
    let rows = null;
    if (isPostgresActive()) {
      try {
        const pgRows = await dbQuery('SELECT * FROM workflows ORDER BY id ASC');
        if (pgRows && pgRows.length > 0) rows = pgRows;
      } catch (e) {}
    }
    if (!rows || rows.length === 0) {
      rows = memDb.workflows || [];
      if (!rows.length) {
        const p = require('path').join(__dirname, '../../database/workflows.json');
        const fs = require('fs');
        if (fs.existsSync(p)) {
          try {
            rows = JSON.parse(fs.readFileSync(p, 'utf8') || '[]');
            memDb.workflows = rows;
          } catch (e) {}
        }
      }
    }
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workflows', requireAdmin, async (req, res) => {
  const { name, entityType, description, stepsJson } = req.body;
  if (!name || !entityType) return res.status(400).json({ error: 'اسم المسار ونوع الكيان مطلوبان' });
  try {
    const id = `WF-${Date.now().toString().slice(-4)}`;
    const item = { id, name, entityType, description: description || '', stepsJson: typeof stepsJson === 'string' ? stepsJson : JSON.stringify(stepsJson || []) };
    if (isPostgresActive()) {
      try {
        await dbRun('INSERT INTO workflows (id, name, "entityType", description, "stepsJson") VALUES ($1, $2, $3, $4, $5)',
          [id, name, entityType, item.description, item.stepsJson]);
      } catch (e) {
        memInsert('workflows', item);
      }
    } else {
      memInsert('workflows', item);
    }
    res.status(201).json({ id, message: 'تم حفظ مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/workflows/:id', requireAdmin, async (req, res) => {
  const { name, entityType, description, stepsJson } = req.body;
  try {
    const stepsStr = typeof stepsJson === 'string' ? stepsJson : (stepsJson ? JSON.stringify(stepsJson) : null);
    if (isPostgresActive()) {
      try {
        await dbRun('UPDATE workflows SET name = COALESCE($1, name), "entityType" = COALESCE($2, "entityType"), description = COALESCE($3, description), "stepsJson" = COALESCE($4, "stepsJson") WHERE id = $5',
          [name, entityType, description, stepsStr, req.params.id]);
      } catch (e) {
        memUpdate('workflows', req.params.id, { name, entityType, description, stepsJson: stepsStr });
      }
    } else {
      memUpdate('workflows', req.params.id, { name, entityType, description, stepsJson: stepsStr });
    }
    res.json({ message: 'تم تحديث مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/workflows/:id', requireAdmin, async (req, res) => {
  try {
    if (isPostgresActive()) {
      try {
        await dbRun('DELETE FROM workflows WHERE id = $1', [req.params.id]);
      } catch (e) {
        memDelete('workflows', req.params.id);
      }
    } else {
      memDelete('workflows', req.params.id);
    }
    res.json({ message: 'تم حذف مسار العمل بنجاح', success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

