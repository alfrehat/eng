const API = '/api';

// ===== Auth & State =====
let currentUser = null;

// ===== Dynamic System Identity & Theme Manager =====
window.loadSystemIdentity = async function() {
  try {
    const res = await fetch('/api/settings/identity');
    const json = await res.json();
    if (json && json.data) {
      window.applySystemIdentity(json.data);
    }
  } catch (e) {
    console.warn('System identity load fallback:', e.message);
  }
};

window.setSystemTheme = function(mode) {
  const isDark = (mode === 'dark' || mode === true || mode === 'true');
  const themeStr = isDark ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', themeStr);
  document.body.setAttribute('data-theme', themeStr);

  if (isDark) {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  }

  const themeLink = document.getElementById('themeStylesheet');
  if (themeLink) {
    themeLink.href = isDark ? 'theme-dark.css' : 'theme-light.css';
  }

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = isDark ? '☀️' : '🌙';
  }

  const cfgDarkSelect = document.getElementById('cfg-darkMode');
  if (cfgDarkSelect) {
    cfgDarkSelect.value = isDark ? 'true' : 'false';
  }

  try {
    localStorage.setItem('theme', themeStr);
  } catch (e) {}
};

window.applySystemIdentity = function(identity) {
  if (!identity) return;
  window._systemIdentity = identity;
  try {
    localStorage.setItem('system_identity', JSON.stringify(identity));
  } catch (e) {}

  // 1. Dynamic Application & Municipality Title
  const appTitle = identity.app_title || identity.appTitle || 'نظام إدارة المشاريع والأشغال الهندسية';
  const munName = identity.municipality_name || identity.municipalityName || 'بلدية كفرنجة الجديدة';
  const dirName = identity.directorate_name || identity.directorateName || 'مديرية الأشغال والخدمات الهندسية';
  document.title = `${munName} — ${appTitle}`;

  // Update header/banner/sidebar labels
  document.querySelectorAll('.app-title-text, #header-app-title').forEach(el => { el.textContent = appTitle; });
  document.querySelectorAll('.municipality-name-text, #header-municipality-name, #sidebar-municipality-name').forEach(el => { el.textContent = munName; });
  document.querySelectorAll('.directorate-name-text, #sidebar-directorate-name').forEach(el => { el.textContent = dirName; });

  // 2. Dynamic Logo
  const logo = identity.header_logo_b64 || identity.logo_path || identity.headerLogo || '/logo.jpg';
  if (logo) {
    document.querySelectorAll('.app-logo-img, #sidebar-logo-img, .sidebar-icon img, #header-logo-img, .brand-logo img').forEach(img => {
      if (img) img.src = logo;
    });
    const favicons = document.querySelectorAll("link[rel*='icon']");
    favicons.forEach(fav => { fav.href = logo; });
  }

  // 3. Dynamic Colors & Theme CSS Variables
  const primary = identity.primary_color || identity.primaryColor || '#0f766e';
  const secondary = identity.secondary_color || identity.secondaryColor || '#0284c7';
  const accent = identity.accent_color || identity.accentColor || '#10b981';
  const radius = identity.border_radius_px !== undefined ? identity.border_radius_px : (identity.borderRadius !== undefined ? identity.borderRadius : 12);
  const darkMode = identity.dark_mode_enabled !== undefined ? identity.dark_mode_enabled : (identity.darkMode !== false);

  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', secondary);
  root.style.setProperty('--primary-dark', secondary);
  root.style.setProperty('--primary-light', accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--radius', `${radius}px`);

  // Switch Theme dynamically
  window.setSystemTheme(darkMode);

  // 4. Custom CSS
  if (identity.custom_css) {
    let customStyleEl = document.getElementById('system-custom-css');
    if (!customStyleEl) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'system-custom-css';
      document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = identity.custom_css;
  }

  // 5. Inactivity Auto-Lock Watcher
  const timeoutMins = identity.session_timeout_minutes || identity.sessionTimeout || 15;
  setupInactivityWatcher(timeoutMins);

  // 6. Enforce Dynamic Zero-Code RBAC
  if (typeof window.applyZeroCodePermissions === 'function') {
    window.applyZeroCodePermissions();
  }
};

// Universal dynamic Lookups resolver
window.getSystemLookups = async function(category) {
  if (window.unifiedSettingsManager && window.unifiedSettingsManager.lookups && window.unifiedSettingsManager.lookups.length) {
    if (!category) return window.unifiedSettingsManager.lookups;
    const lk = window.unifiedSettingsManager.lookups.find(l => l.category === category || l.id === category || l.name === category);
    return lk ? lk.options : [];
  }
  try {
    const res = await fetch('/api/lookups');
    const lookups = await res.json();
    if (!category) return lookups;
    const lk = lookups.find(l => l.category === category || l.id === category || l.name === category);
    return lk ? lk.options : [];
  } catch (e) {
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ منظومة التحقق من الصلاحيات والأدوار الهندسية (Enterprise RBAC Suite)
// ═══════════════════════════════════════════════════════════════════════════

const SCREEN_PERMISSION_MAP = {
  'dashboard': ['DASHBOARD.VIEW', 'dashboard'],
  'roads': ['ROADS.VIEW', 'roads'],
  'structural-assets': ['ASSETS.VIEW', 'structural-assets', 'assets'],
  'infrastructure': ['INFRASTRUCTURE.VIEW', 'infrastructure', 'assets', 'ASSETS.VIEW'],
  'energy-lighting': ['ENERGY.VIEW', 'energy-lighting', 'assets', 'ASSETS.VIEW'],
  'excavation-permits': ['PERMITS.VIEW', 'excavation-permits', 'permits'],
  'paving-returns': ['PAVING.VIEW', 'paving-returns', 'paving'],
  'tenders': ['TENDERS.VIEW', 'PROJECTS.VIEW', 'tenders', 'projects'],
  'projects': ['PROJECTS.VIEW', 'TENDERS.VIEW', 'projects', 'tenders'],
  'project-workspace': ['PROJECTS.VIEW', 'TENDERS.VIEW', 'projects', 'tenders'],
  'budget': ['BUDGET.VIEW', 'budget'],
  'contracts': ['CONTRACTS.VIEW', 'contracts'],
  'claims': ['CLAIMS.VIEW', 'claims'],
  'purchases': ['PURCHASES.VIEW', 'purchases'],
  'archive': ['ARCHIVE.VIEW', 'archive'],
  'reports': ['REPORTS.VIEW', 'reports'],
  'print-templates': ['PRINT_TEMPLATES.VIEW', 'SETTINGS.MANAGE', 'print-templates'],
  'verify-digital': ['VERIFY.VIEW', 'verify-digital'],
  'settings': ['SETTINGS.VIEW', 'SETTINGS.MANAGE', 'settings'],
  'system-settings': ['SETTINGS.VIEW', 'SETTINGS.MANAGE', 'settings'],
  'general-settings': ['SETTINGS.VIEW', 'SETTINGS.MANAGE', 'settings'],
  'users': ['USERS.MANAGE', 'SETTINGS.MANAGE', 'settings'],
  'roles': ['ROLES.MANAGE', 'SETTINGS.MANAGE', 'settings'],
  'lookups': ['SETTINGS.MANAGE', 'settings'],
  'workflows': ['WORKFLOWS.MANAGE', 'SETTINGS.MANAGE', 'settings'],
  'org-units': ['SETTINGS.MANAGE', 'settings'],
  'activity': ['AUDIT.VIEW', 'SETTINGS.MANAGE', 'settings'],
  'server': ['SETTINGS.MANAGE', 'settings'],
  'visual-identity': ['SETTINGS.MANAGE', 'settings']
};

window.hasPermission = function(permCode) {
  const user = window.currentUser || (function() {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('engineeringUser') || '{}'); } catch(e) { return {}; }
  })();

  if (!user || !user.role) return true;
  if (user.role === 'admin' || user.id === 'U-001') return true;

  // استخراج الصلاحيات
  let userPerms = [];
  if (Array.isArray(user.permissions)) {
    userPerms = user.permissions;
  } else if (typeof user.permissions === 'string') {
    userPerms = user.permissions.split(',').map(p => p.trim()).filter(Boolean);
  }

  if (userPerms.includes('*')) return true;
  if (!permCode) return true;

  const target = String(permCode).trim().toUpperCase();
  const screenLower = String(permCode).trim().toLowerCase();

  // 1. فحص الشاشات والتبويبات
  if (SCREEN_PERMISSION_MAP[screenLower]) {
    const matched = SCREEN_PERMISSION_MAP[screenLower].some(reqCode => {
      const up = reqCode.toUpperCase();
      return userPerms.some(p => p.toUpperCase() === up || p === '*' || p.toUpperCase().startsWith(up + '.'));
    });
    if (matched) return true;
  }

  // 2. فحص مباشر للصلاحيات التشغيلية والأزرار
  return userPerms.some(p => {
    const up = p.toUpperCase();
    if (up === '*' || up === target) return true;
    if (up.replace(/\./g, ':') === target.replace(/\./g, ':')) return true;
    if (up.replace(/_/g, '') === target.replace(/_/g, '')) return true;
    if (up.endsWith('.*') && target.startsWith(up.slice(0, -2))) return true;
    return false;
  });
};

window.updateNavigationPermissions = function() {
  const user = window.currentUser || (function() {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('engineeringUser') || '{}'); } catch(e) { return {}; }
  })();

  const isAdmin = user && (user.role === 'admin' || user.id === 'U-001');
  let firstAllowedPage = 'dashboard';
  let firstFound = false;

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.getAttribute('data-page');
    const allowed = isAdmin || window.hasPermission(page);
    if (allowed) {
      item.style.display = '';
      if (!firstFound && page !== 'dashboard') {
        firstAllowedPage = page;
        firstFound = true;
      }
    } else {
      item.style.display = 'none';
    }
  });

  return firstAllowedPage;
};

// Universal Zero-Code Permissions Enforcer for UI Elements & Buttons
window.applyZeroCodePermissions = function() {
  const user = window.currentUser || (function() {
    try { return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('engineeringUser') || '{}'); } catch(e) { return {}; }
  })();

  const isAdmin = user && (user.role === 'admin' || user.id === 'U-001');

  // 1. تحديث ظهور شاشات القائمة الجانبية
  window.updateNavigationPermissions();

  if (isAdmin) return;

  const role = user.role || 'viewer';

  // 2. إخفاء أو تعطيل الأزرار والعناصر المقيدة بصلاحية محددة
  document.querySelectorAll('[data-permission]').forEach(el => {
    const p = el.getAttribute('data-permission');
    if (p && !window.hasPermission(p)) {
      el.style.display = 'none';
      el.disabled = true;
      el.setAttribute('aria-hidden', 'true');
    }
  });

  // 3. إخفاء أو تعطيل الأزرار والعناصر المقيدة بدور محدد
  document.querySelectorAll('[data-role]').forEach(el => {
    const r = el.getAttribute('data-role');
    if (r && r !== role) {
      el.style.display = 'none';
      el.disabled = true;
      el.setAttribute('aria-hidden', 'true');
    }
  });
};

// ===== Inactivity Auto-Lock & Session Watcher =====
let inactivityTimer = null;
let currentInactivityLimitMinutes = 15;

function setupInactivityWatcher(timeoutMinutes) {
  if (timeoutMinutes) currentInactivityLimitMinutes = parseInt(timeoutMinutes, 10) || 15;

  const resetTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (currentUser) {
      inactivityTimer = setTimeout(triggerInactivityLogout, currentInactivityLimitMinutes * 60 * 1000);
    }
  };

  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    window.addEventListener(evt, resetTimer, { passive: true });
  });

  resetTimer();
}

async function triggerInactivityLogout() {
  if (!currentUser) return;
  const userToLog = currentUser;
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
      },
      body: JSON.stringify({
        action: 'تسجيل خروج آلي',
        entity: 'الأمان',
        entityId: userToLog.id || '',
        details: `تم قفل وإنهاء الجلسة تلقائياً للمستخدم ${userToLog.fullName || userToLog.username} لعدم وجود نشاط لمدة ${currentInactivityLimitMinutes} دقيقة`
      })
    }).catch(() => null);
  } catch (e) {}

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('engineeringUser');
  sessionStorage.clear();
  currentUser = null;
  window.location.replace('/login.html?reason=inactivity_timeout');
}

// ===== Navigation =====
let currentPage = 'dashboard';
let tendersChart, claimsChart, rChart1, rChart2, rChart3;
let reportsTenders = [], reportsClaims = [], reportsPurchases = [];

document.addEventListener('DOMContentLoaded', () => {
  // Load System Identity & Appearance immediately
  window.loadSystemIdentity();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  // Sidebar toggle
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  // Modals close
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('modalOverlay').classList.remove('open');
      document.getElementById('viewOverlay').classList.remove('open');
      document.getElementById('confirmOverlay').classList.remove('open');
    });
  });

  document.getElementById('addNewBtn').addEventListener('click', () => {
    openModal(currentPage === 'dashboard' ? 'tenders' : currentPage);
  });

  // Global search across all modules
  const globalSearchInput = document.getElementById('globalSearch');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', function () {
      const val = this.value.trim();
      
      // 1. العطاءات
      if (currentPage === 'tenders' && typeof tendersManager !== 'undefined' && tendersManager) {
        const sInp = document.getElementById('tenders-filter-search');
        if (sInp) sInp.value = val;
        tendersManager.filters.search = val;
        tendersManager.applyFilters();
      }
      // 2. المطالبات المالية
      if (currentPage === 'claims') {
        const cs = document.getElementById('claims-search');
        if (cs) cs.value = val;
        if (typeof filterTable === 'function') filterTable('claims', val);
      }
      // 3. المشتريات
      if (currentPage === 'purchases') {
        const ps = document.getElementById('purchases-search');
        if (ps) ps.value = val;
        if (typeof filterTable === 'function') filterTable('purchases', val);
      }
      // 4. الأرشيف الإلكتروني
      if (currentPage === 'archive') {
        const as = document.getElementById('archive-search');
        if (as) as.value = val;
        if (typeof filterArchive === 'function') filterArchive(val);
      }
      // 5. تصاريح الحفر وتزويد الخدمات
      if (currentPage === 'excavation-permits' && window.excavationManager) {
        const es = document.getElementById('epm-search');
        if (es) es.value = val;
        if (typeof window.excavationManager._applyFilterAndRender === 'function') {
          window.excavationManager._applyFilterAndRender();
        }
      }
      // 6. شبكة الطرق RAMS
      if (currentPage === 'roads' && typeof ramsManager !== 'undefined' && ramsManager) {
        const rs = document.getElementById('rams-filter-search');
        if (rs) rs.value = val;
        if (typeof ramsManager._applyFilterAndRender === 'function') {
          ramsManager._applyFilterAndRender();
        }
      }
      // 7. العقود والضمانات البنكية
      if (currentPage === 'contracts' && window.contractsManager) {
        const cs = document.getElementById('ecm-search-input');
        if (cs) cs.value = val;
        window.contractsManager.searchTerm = val.toLowerCase();
        window.contractsManager._renderCurrentTab();
      }
      // 9. محرر قوالب النماذج والطباعة الرسمية
      if (currentPage === 'print-templates' && window.unifiedPrintTemplatesManager) {
        window.unifiedPrintTemplatesManager.setSearchQuery(val);
      }
    });

    globalSearchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const q = this.value.trim().toLowerCase();
        if (!q) return;
        // التنقل التلقائي السريع للتبويبات بناءً على الكلمات المفتاحية
        if (q.includes('قالب') || q.includes('طباع') || q.includes('نماذج') || q.includes('محرر')) navigate('print-templates');
        else if (q.includes('إعداد') || q.includes('اعداد') || q.includes('مستخدم') || q.includes('صلاحي') || q.includes('هوي') || q.includes('أمان') || q.includes('خادم') || q.includes('نسخ') || q.includes('ترميز') || q.includes('مسار') || q.includes('قسم')) navigate('settings');
        else if (q.includes('عطاء') || q.includes('مناقص')) navigate('tenders');
        else if (q.includes('عقد') || q.includes('كفال') || q.includes('ضمان')) navigate('contracts');
        else if (q.includes('مطالب') || q.includes('دفعة')) navigate('claims');
        else if (q.includes('حفر') || q.includes('تصريح') || q.includes('مياه') || q.includes('ألياف')) navigate('excavation-permits');
        else if (q.includes('طريق') || q.includes('شارع') || q.includes('تعبيد')) navigate('roads');
        else if (q.includes('شراء') || q.includes('مورد')) navigate('purchases');
        else if (q.includes('أرشيف') || q.includes('وثيق') || q.includes('كتاب')) navigate('archive');
        else if (q.includes('تقرير') || q.includes('يومي')) navigate('tenders');
      }
    });
  }

  // Specific searches & filters
  document.getElementById('tenders-filter-search')?.addEventListener('input', e => {
    if (typeof tendersManager !== 'undefined' && tendersManager) {
      tendersManager.filters.search = e.target.value;
      tendersManager.applyFilters();
    }
  });

  document.getElementById('claims-search')?.addEventListener('input', e => filterTable('claims', e.target.value));
  document.getElementById('claims-status-filter')?.addEventListener('change', e => filterByStatus('claims', e.target.value));
  document.getElementById('claims-tender-filter')?.addEventListener('change', e => filterByTender('claims', e.target.value));

  document.getElementById('purchases-search')?.addEventListener('input', e => filterTable('purchases', e.target.value));
  document.getElementById('purchases-status-filter')?.addEventListener('change', e => filterByStatus('purchases', e.target.value));

  document.getElementById('archive-search')?.addEventListener('input', e => filterArchive(e.target.value));
  document.getElementById('archive-type-filter')?.addEventListener('change', e => filterArchiveByType(e.target.value));
  document.getElementById('archive-year-filter')?.addEventListener('change', e => filterArchiveByYear(e.target.value));

  // Global Dropdown Handlers Defined on Window

  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const themeLink = document.getElementById('themeStylesheet');
  if (themeToggle && themeLink) {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    window.setSystemTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      window.setSystemTheme(next);
    });
  }

  // Dropdown menu
  const moreBtn = document.getElementById('moreBtn');
  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('moreMenu').classList.toggle('open');
      document.getElementById('notifMenu')?.classList.remove('open');
    });
  }

  // DB Reconnect button
  const dbConnectBtn = document.getElementById('dbConnectBtn');
  if (dbConnectBtn) {
    dbConnectBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(API + '/reconnect-db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentUser ? { 'x-user-role': currentUser.role, 'x-user-id': currentUser.id } : {})
          }
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✅ ' + (data.message || data.status));
          document.getElementById('dbDot').style.background = 'var(--success)';
          document.getElementById('dbStatus').textContent = 'قاعدة البيانات: متصلة';
        } else {
          showToast('❌ ' + (data.error || 'فشل إعادة الاتصال'));
          document.getElementById('dbDot').style.background = 'var(--danger)';
          document.getElementById('dbStatus').textContent = 'قاعدة البيانات: غير متصلة';
        }
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        document.getElementById('dbDot').style.background = 'var(--danger)';
        document.getElementById('dbStatus').textContent = 'قاعدة البيانات: غير متصلة';
      }
    });
  }

  // Topbar Dropdown Toggles
  window.toggleNotifMenu = function(e) {
    if (e) e.stopPropagation();
    document.getElementById('userProfileDropdownContainer')?.classList.remove('open');
    document.getElementById('quickAddMenu')?.classList.remove('open');
    document.getElementById('notifMenu')?.classList.toggle('open');
  };

  window.toggleProfileMenu = function(e) {
    if (e) e.stopPropagation();
    document.getElementById('notifMenu')?.classList.remove('open');
    document.getElementById('quickAddMenu')?.classList.remove('open');
    document.getElementById('userProfileDropdownContainer')?.classList.toggle('open');
  };

  window.toggleQuickAddMenu = function(e) {
    if (e) e.stopPropagation();
    document.getElementById('userProfileDropdownContainer')?.classList.remove('open');
    document.getElementById('notifMenu')?.classList.remove('open');
    document.getElementById('quickAddMenu')?.classList.toggle('open');
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#userProfileDropdownContainer')) {
      document.getElementById('userProfileDropdownContainer')?.classList.remove('open');
    }
    if (!e.target.closest('#quickAddMenu')) {
      document.getElementById('quickAddMenu')?.classList.remove('open');
    }
    if (!e.target.closest('#notifMenu')) {
      document.getElementById('notifMenu')?.classList.remove('open');
    }
  });

  // Global Shortcut: Ctrl+K or Cmd+K to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('globalSearch');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // Initial Authentication Check
  let savedUser = sessionStorage.getItem('engineeringUser') || localStorage.getItem('engineeringUser');
  if (!savedUser) {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const uObj = JSON.parse(userStr);
        savedUser = JSON.stringify({ ...uObj, token });
        sessionStorage.setItem('engineeringUser', savedUser);
      } catch(e) {}
    }
  }

  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      initApp();
    } catch(e) {
      window.location.href = '/login.html';
    }
  } else {
    window.location.href = '/login.html';
  }

  // Enter key press listener for login inputs
  const loginUserEl = document.getElementById('loginUsername');
  const loginPassEl = document.getElementById('loginPassword');
  const handleEnterKey = (e) => {
    if (e.key === 'Enter') {
      performLogin();
    }
  };
  if (loginUserEl) loginUserEl.addEventListener('keydown', handleEnterKey);
  if (loginPassEl) loginPassEl.addEventListener('keydown', handleEnterKey);
});

const roleNames = { 
  'admin': 'مدير النظام (كامل الصلاحيات)', 
  'director_public_works': 'مدير الأشغال والخدمات الهندسية', 
  'head_of_roads': 'رئيس قسم الطرق', 
  'head_of_buildings': 'رئيس قسم الأبنية والإنشاءات', 
  'roads_engineer': 'مهندس طرق', 
  'buildings_engineer': 'مهندس أبنية وإنشاءات', 
  'quantity_surveyor': 'حاسب كميات', 
  'site_inspector': 'مراقب', 
  'qa_qc_engineer': 'مهندس ضبط الجودة', 
  'land_surveyor': 'مساح' 
};

const PERMISSION_ALIAS_TABLE = {
  'dashboard': ['dashboard', 'dashboard:view', 'DASHBOARD.VIEW'],
  'roads': ['roads', 'roads:view', 'ROADS.VIEW', 'ROADS.CREATE', 'ROADS.EDIT', 'ROADS.DELETE', 'perm-roads'],
  'structural-assets': ['structural-assets', 'assets', 'assets:view', 'ASSETS.VIEW', 'ASSETS.CREATE', 'ASSETS.EDIT', 'ASSETS.DELETE'],
  'infrastructure': ['infrastructure', 'assets', 'assets:view', 'ASSETS.VIEW'],
  'energy-lighting': ['energy-lighting', 'assets', 'assets:view', 'ASSETS.VIEW'],
  'excavation-permits': ['excavation-permits', 'permits', 'permits:view', 'PERMITS.VIEW', 'PERMITS.CREATE', 'PERMITS.EDIT', 'PERMITS.APPROVE', 'PERMITS.DELETE'],
  'paving-returns': ['paving-returns', 'paving', 'paving:view', 'PAVING.VIEW', 'PAVING.CREATE', 'PAVING.EDIT', 'PAVING.APPROVE', 'PAVING.DELETE', 'perm-paving-returns'],
  'tenders': ['tenders', 'tenders:view', 'TENDERS.VIEW', 'TENDERS.CREATE', 'TENDERS.EDIT', 'TENDERS.APPROVE', 'TENDERS.DELETE', 'projects', 'PROJECTS.VIEW', 'perm-tenders'],
  'projects': ['projects', 'projects:view', 'PROJECTS.VIEW', 'PROJECTS.CREATE', 'PROJECTS.EDIT'],
  'claims': ['claims', 'claims:view', 'CLAIMS.VIEW', 'CLAIMS.CREATE', 'CLAIMS.EDIT', 'CLAIMS.AUDIT', 'CLAIMS.APPROVE', 'CLAIMS.DELETE', 'perm-claims'],
  'purchases': ['purchases', 'purchases:view', 'PURCHASES.VIEW', 'PURCHASES.CREATE', 'PURCHASES.EDIT', 'PURCHASES.DELETE', 'perm-purchases'],
  'contracts': ['contracts', 'contracts:view', 'CONTRACTS.VIEW', 'CONTRACTS.CREATE', 'CONTRACTS.EDIT', 'CONTRACTS.DELETE', 'CONTRACTS.APPROVE', 'GUARANTEES.MANAGE', 'perm-contracts'],
  'reports': ['reports', 'reports:view', 'REPORTS.VIEW', 'perm-reports'],
  'print-templates': ['print-templates', 'reports', 'reports:view', 'REPORTS.VIEW'],
  'archive': ['archive', 'archive:view', 'ARCHIVE.VIEW', 'ARCHIVE.UPLOAD', 'ARCHIVE.DELETE', 'perm-archive'],
  'settings': ['settings', 'settings:view', 'SETTINGS.VIEW', 'SETTINGS.MANAGE', 'settings:manage', 'USERS.MANAGE', 'ROLES.MANAGE', 'WORKFLOWS.MANAGE', 'perm-settings'],
  'activity': ['activity', 'activity:view', 'AUDIT.VIEW', 'audit:view', 'perm-activity']
};

function getUserPermissions() {
  if (!currentUser) return [];
  if (currentUser.role === 'admin' || currentUser.id === 'U-001') return ['*'];

  let perms = [];
  if (Array.isArray(currentUser.permissions)) {
    perms = [...currentUser.permissions];
  } else if (typeof currentUser.permissions === 'string') {
    try {
      const parsed = JSON.parse(currentUser.permissions);
      perms = Array.isArray(parsed) ? parsed : currentUser.permissions.split(',').map(s => s.trim());
    } catch {
      perms = currentUser.permissions.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return perms;
}

function hasPermission(permKey) {
  if (!currentUser) return false;
  if (currentUser.role === 'admin' || currentUser.id === 'U-001') return true;
  const perms = getUserPermissions();
  if (!perms || perms.length === 0) return false;
  if (perms.includes('*') || perms.includes('perm-all')) return true;
  if (!permKey) return false;

  const raw = String(permKey).trim();
  const rawLower = raw.toLowerCase();
  const normalized = raw.replace(/:/g, '.').toUpperCase();

  // 1. Direct or canonical match
  for (const p of perms) {
    if (!p) continue;
    const pRaw = String(p).trim();
    const pNorm = pRaw.replace(/:/g, '.').toUpperCase();
    if (pNorm === '*' || pNorm === normalized || pRaw === raw || pRaw.toLowerCase() === rawLower) {
      return true;
    }
  }

  // 2. Alias table lookup
  const aliases = PERMISSION_ALIAS_TABLE[rawLower] || PERMISSION_ALIAS_TABLE[raw];
  if (aliases && aliases.length) {
    for (const a of aliases) {
      const aNorm = a.replace(/:/g, '.').toUpperCase();
      for (const p of perms) {
        if (!p) continue;
        const pRaw = String(p).trim();
        const pNorm = pRaw.replace(/:/g, '.').toUpperCase();
        if (pNorm === aNorm || pRaw.toLowerCase() === a.toLowerCase() || pRaw === a) {
          return true;
        }
      }
    }
  }

  // 3. Tab view inferred from module action permissions (e.g. tenders:create -> tenders)
  for (const p of perms) {
    if (!p) continue;
    const pRaw = String(p).trim().toLowerCase();
    if (pRaw.startsWith(rawLower + ':') || pRaw.startsWith(rawLower + '.')) {
      return true;
    }
  }

  return false;
}

function updateNavigationPermissions() {
  if (!currentUser) return 'dashboard';
  const canAddAny = hasPermission('tenders:create') || hasPermission('claims:create') || hasPermission('purchases:create') || hasPermission('roads:create') || currentUser.role === 'admin';
  const addNewBtn = document.getElementById('addNewBtn');
  if (addNewBtn) addNewBtn.style.display = canAddAny ? 'inline-flex' : 'none';

  const dqa = document.getElementById('dashQuickActions');
  if (dqa) dqa.style.display = canAddAny ? 'flex' : 'none';

  const allTabs = ['dashboard', 'roads', 'structural-assets', 'infrastructure', 'energy-lighting', 'excavation-permits', 'paving-returns', 'tenders', 'claims', 'purchases', 'contracts', 'settings', 'print-templates', 'archive', 'reports', 'activity'];

  let firstTab = null;
  allTabs.forEach(tab => {
    const navItem = document.getElementById('nav-' + tab);
    if (navItem) {
      if (hasPermission(tab) || (currentUser.role === 'admin')) {
        navItem.style.display = 'flex';
        if (!firstTab) firstTab = tab;
      } else {
        navItem.style.display = 'none';
      }
    }
  });

  const navSettings = document.getElementById('nav-settings');
  if (navSettings) {
    navSettings.style.display = (currentUser.role === 'admin' || hasPermission('settings')) ? 'flex' : 'none';
  }
  const navActivity = document.getElementById('nav-activity');
  if (navActivity) {
    navActivity.style.display = (currentUser.role === 'admin' || hasPermission('activity')) ? 'flex' : 'none';
  }
  return firstTab;
}

async function refreshCurrentUserPermissions() {
  if (!currentUser || currentUser.role === 'admin' || currentUser.id === 'U-001') return;
  try {
    const res = await apiFetch('/auth/my-permissions', { silent: true });
    if (res && Array.isArray(res.effectivePermissions)) {
      currentUser.permissions = res.effectivePermissions;
      localStorage.setItem('user', JSON.stringify(currentUser));
      sessionStorage.setItem('engineeringUser', JSON.stringify(currentUser));
      applyButtonPermissions();
      updateNavigationPermissions();
    }
  } catch (e) {}
}
window.refreshCurrentUserPermissions = refreshCurrentUserPermissions;
window.updateNavigationPermissions = updateNavigationPermissions;

function applyButtonPermissions() {
  document.querySelectorAll('[data-perm]').forEach(el => {
    const requiredPerm = el.getAttribute('data-perm');
    if (hasPermission(requiredPerm)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

function updateLiveClock() {
  const clockEl = document.getElementById('liveClockText');
  if (!clockEl) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('ar-JO', { weekday: 'short', day: 'numeric', month: 'short' });
  clockEl.textContent = `${timeStr} | ${dateStr}`;
}

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    const icon = document.getElementById('fullscreenIcon');
    if (icon) icon.textContent = '🗗';
  } else {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    const icon = document.getElementById('fullscreenIcon');
    if (icon) icon.textContent = '⛶';
  }
};

window.handleProfileAvatarUpload = function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    document.getElementById('prof-avatar-data').value = base64;
    const box = document.getElementById('prof-avatar-box');
    if (box) {
      box.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }
  };
  reader.readAsDataURL(file);
};

window.openUserProfileModal = function() {
  if (!currentUser) return;
  document.getElementById('modalTitle').textContent = '👤 الملف الشخصي وإعدادات الحساب والأمان';
  
  const avatarHtml = (currentUser.avatar && currentUser.avatar.trim() !== '')
    ? `<img src="${currentUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span id="prof-avatar-letter">${(currentUser.fullName || 'م').charAt(0)}</span>`;

  document.getElementById('modalBody').innerHTML = `
    <div class="user-profile-dialog" style="direction:rtl;">
      <!-- Header User Card with Avatar Upload -->
      <div style="display:flex; align-items:center; gap:18px; background:var(--bg-surface); padding:18px; border-radius:14px; border:1px solid var(--border); margin-bottom:20px; flex-wrap:wrap;">
        <div style="position:relative; width:68px; height:68px; border-radius:50%; background:linear-gradient(135deg, var(--primary), var(--secondary)); display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:bold; color:#fff; flex-shrink:0; border:2px solid var(--primary); overflow:hidden;" id="prof-avatar-box">
          ${avatarHtml}
        </div>
        <div style="flex:1; min-width:200px;">
          <h3 style="margin:0 0 4px; font-size:1.15rem; color:var(--text);">${currentUser.fullName || 'المستخدم'}</h3>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:4px;">
            <span style="font-size:0.8rem; color:#fff; background:var(--primary); padding:2px 8px; border-radius:6px; font-weight:600;">${roleNames[currentUser.role] || currentUser.role}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">المعرف: ${currentUser.id}</span>
          </div>
          <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--accent); cursor:pointer; margin-top:4px; text-decoration:underline;">
            <span>📷 تغيير الصورة الشخصية</span>
            <input type="file" id="prof-avatar-file" accept="image/*" style="display:none;" onchange="handleProfileAvatarUpload(this)" />
          </label>
        </div>
      </div>

      <form id="user-self-profile-form" onsubmit="saveSelfProfile(event)">
        <!-- Personal & Contact Info -->
        <div style="background:var(--bg-surface); border:1px solid var(--border); padding:16px; border-radius:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 12px; font-size:0.9rem; font-weight:bold; color:var(--accent); display:flex; align-items:center; gap:6px;">
            <span>📋</span> <span>المعلومات الشخصية والاتصال الرسمي</span>
          </h4>
          <div class="form-row">
            <div class="form-group">
              <label>الاسم الكامل للموظف / المهندس *</label>
              <input type="text" id="prof-fullName" class="form-control" value="${currentUser.fullName || ''}" required />
            </div>
            <div class="form-group">
              <label>اسم المستخدم (الدخول)</label>
              <input type="text" class="form-control" value="${currentUser.username || ''}" disabled style="opacity:0.7;" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>البريد الإلكتروني الرسمي (Email)</label>
              <input type="email" id="prof-email" class="form-control" value="${currentUser.email || ''}" placeholder="example@kafrinja.gov.jo" />
            </div>
            <div class="form-group">
              <label>رقم الهاتف / الموبايل (Phone)</label>
              <input type="tel" id="prof-phone" class="form-control" value="${currentUser.phone || ''}" placeholder="07XXXXXXXX" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>القسم / المديرية (Department)</label>
              <input type="text" id="prof-department" class="form-control" value="${currentUser.department || 'مديرية الأشغال والخدمات الهندسية'}" placeholder="مثال: مديرية الأشغال" />
            </div>
            <div class="form-group">
              <label>المسمى الوظيفي (Job Title)</label>
              <input type="text" id="prof-jobTitle" class="form-control" value="${currentUser.job_title || ''}" placeholder="مثال: مهندس مشاريع وعطاءات" />
            </div>
          </div>
        </div>

        <!-- 2FA Readiness Section -->
        <div style="background:var(--bg-surface); border:1px solid var(--border); padding:16px; border-radius:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 10px; font-size:0.9rem; font-weight:bold; color:var(--accent); display:flex; align-items:center; gap:6px;">
            <span>🛡️</span> <span>أمان الحساب والمصادقة الثنائية (2FA)</span>
          </h4>
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:12px 16px; border-radius:10px; border:1px solid var(--border);">
            <div>
              <strong style="font-size:0.88rem; color:var(--text); display:block;">تفعيل المصادقة الثنائية للدخول (Two-Factor Authentication)</strong>
              <span style="font-size:0.75rem; color:var(--text-muted);">عند التفعيل، سيتم طلب رمز أمان إضافي للتحقق من هوية المستخدم عند تسجيل الدخول.</span>
            </div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="prof-twoFactor" ${currentUser.two_factor_enabled ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--primary); cursor:pointer;" onchange="document.getElementById('twoFactorBadge').textContent = this.checked ? 'مفعلة' : 'غير مفعلة'; document.getElementById('twoFactorBadge').style.color = this.checked ? '#10b981' : 'var(--text-muted)';" />
              <strong id="twoFactorBadge" style="color:${currentUser.two_factor_enabled ? '#10b981' : 'var(--text-muted)'}; font-size:0.88rem;">${currentUser.two_factor_enabled ? 'مفعلة' : 'غير مفعلة'}</strong>
            </label>
          </div>
        </div>

        <!-- Password Change Section -->
        <div style="background:var(--bg-surface); border:1px solid var(--border); padding:16px; border-radius:12px; margin-bottom:16px;">
          <h4 style="font-size:0.9rem; font-weight:bold; color:var(--accent); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
            <span>🔒</span> <span>تغيير كلمة المرور</span>
          </h4>
          <div class="form-row">
            <div class="form-group">
              <label>كلمة المرور الجديدة (اتركه فارغاً للحفاظ على الحالية)</label>
              <input type="password" id="prof-newPassword" class="form-control" placeholder="••••••••" />
            </div>
            <div class="form-group">
              <label>تأكيد كلمة المرور الجديدة</label>
              <input type="password" id="prof-confirmPassword" class="form-control" placeholder="••••••••" />
            </div>
          </div>
        </div>

        <input type="hidden" id="prof-avatar-data" value="${currentUser.avatar || ''}" />

        <div class="form-actions" style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="padding:10px 24px; font-weight:bold;">💾 حفظ التغييرات وتحديث الحساب</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
};

window.saveSelfProfile = async function(e) {
  e.preventDefault();
  const fullName = document.getElementById('prof-fullName').value;
  const email = document.getElementById('prof-email').value;
  const phone = document.getElementById('prof-phone').value;
  const department = document.getElementById('prof-department').value;
  const job_title = document.getElementById('prof-jobTitle').value;
  const avatar = document.getElementById('prof-avatar-data').value;
  const two_factor_enabled = document.getElementById('prof-twoFactor').checked;
  const newPass = document.getElementById('prof-newPassword').value;
  const confirmPass = document.getElementById('prof-confirmPassword').value;

  if (newPass && newPass !== confirmPass) {
    showToast('❌ كلمات المرور غير متطابقة!');
    return;
  }

  try {
    const body = {
      username: currentUser.username,
      fullName,
      email,
      phone,
      department,
      job_title,
      avatar,
      two_factor_enabled,
      role: currentUser.role,
      permissions: currentUser.permissions
    };
    if (newPass && newPass.trim() !== '') {
      body.password = newPass;
    }

    await apiFetch(`/users/${currentUser.id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    currentUser.fullName = fullName;
    currentUser.email = email;
    currentUser.phone = phone;
    currentUser.department = department;
    currentUser.job_title = job_title;
    currentUser.avatar = avatar;
    currentUser.two_factor_enabled = two_factor_enabled;

    sessionStorage.setItem('engineeringUser', JSON.stringify(currentUser));
    localStorage.setItem('engineeringUser', JSON.stringify(currentUser));
    localStorage.setItem('user', JSON.stringify(currentUser));
    initApp();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
    showToast('✅ تم تحديث بيانات الحساب والأمان بنجاح');
    closeModal();
  } catch (err) {
    showToast('❌ حدث خطأ: ' + err.message);
  }
};

function initApp() {
  document.getElementById('loginOverlay')?.classList.add('hidden');
  
  const avatarContent = (currentUser.avatar && currentUser.avatar.trim() !== '')
    ? `<img src="${currentUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : (currentUser.fullName || 'م').charAt(0);

  // Sidebar user info
  if (document.getElementById('sidebarName')) document.getElementById('sidebarName').textContent = currentUser.fullName;
  if (document.getElementById('sidebarRole')) document.getElementById('sidebarRole').textContent = roleNames[currentUser.role] || 'مستخدم عادي';
  if (document.getElementById('sidebarAvatar')) document.getElementById('sidebarAvatar').innerHTML = avatarContent;

  // Modern Executive Topbar User Info
  if (document.getElementById('topbarName')) document.getElementById('topbarName').textContent = currentUser.fullName;
  if (document.getElementById('topbarRole')) document.getElementById('topbarRole').textContent = roleNames[currentUser.role] || currentUser.role;
  if (document.getElementById('topbarAvatar')) document.getElementById('topbarAvatar').innerHTML = avatarContent;

  if (document.getElementById('profilePopupName')) document.getElementById('profilePopupName').textContent = currentUser.fullName;
  if (document.getElementById('profilePopupRole')) document.getElementById('profilePopupRole').textContent = roleNames[currentUser.role] || currentUser.role;
  if (document.getElementById('profilePopupId')) document.getElementById('profilePopupId').textContent = currentUser.id || currentUser.username;
  if (document.getElementById('profilePopupAvatar')) document.getElementById('profilePopupAvatar').innerHTML = avatarContent;

  const firstTab = updateNavigationPermissions();

  // Start Live Clock
  if (!window._clockInterval) {
    updateLiveClock();
    window._clockInterval = setInterval(updateLiveClock, 10000);
  }

  // Restore previous active tab on page refresh
  let initialTab = null;
  try {
    const hash = window.location.hash ? window.location.hash.replace('#', '').trim() : '';
    const storedTab = localStorage.getItem('active_system_tab') || sessionStorage.getItem('active_system_tab');
    if (hash && (hasPermission(hash) || hash === 'dashboard' || (currentUser && currentUser.role === 'admin'))) {
      initialTab = hash;
    } else if (storedTab && (hasPermission(storedTab) || storedTab === 'dashboard' || (currentUser && currentUser.role === 'admin'))) {
      initialTab = storedTab;
    }
  } catch (e) {}

  if (!initialTab) {
    initialTab = firstTab || 'dashboard';
  }

  navigate(initialTab, true);
  applyButtonPermissions();
  refreshCurrentUserPermissions();
  checkDbStatus();
  fetchNotifications();
  loadSystemLookups();
  updateAllSidebarBadges();
  initLiveWebSocket();
  if (!window._badgeInterval) {
    window._badgeInterval = setInterval(updateAllSidebarBadges, 25000);
  }
}

// ===== Real-Time WebSockets Client & Live Alerts =====
let liveWs = null;
let wsReconnectTimeout = null;

function initLiveWebSocket() {
  if (liveWs && (liveWs.readyState === WebSocket.OPEN || liveWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = (currentUser && currentUser.token) || localStorage.getItem('token') || '';
  const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

  try {
    liveWs = new WebSocket(wsUrl);

    liveWs.onopen = () => {
      console.log('⚡ Real-time WebSocket connection established.');
      if (token) {
        liveWs.send(JSON.stringify({ type: 'AUTH', token }));
      }
    };

    liveWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SYSTEM_IDENTITY_UPDATED' && msg.data) {
          window.applySystemIdentity(msg.data);
        }
        if (msg.type === 'NEW_NOTIFICATION' && msg.payload) {
          const notif = msg.payload;
          showLiveNotificationToast(notif);
          fetchNotifications();
          updateAllSidebarBadges();
        }
      } catch (err) {
        console.warn('WS parse error:', err);
      }
    };

    liveWs.onclose = () => {
      if (wsReconnectTimeout) clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = setTimeout(() => {
        if (currentUser) initLiveWebSocket();
      }, 4000);
    };

    liveWs.onerror = (err) => {
      console.warn('WS error:', err);
    };
  } catch (e) {
    console.warn('Failed to start WebSocket:', e);
  }
}

function showLiveNotificationToast(notif) {
  let container = document.getElementById('liveToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'liveToastContainer';
    container.style.cssText = 'position:fixed;top:20px;left:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(59, 130, 246, 0.6);
    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(59, 130, 246, 0.3);
    color: #f8fafc;
    padding: 14px 18px;
    border-radius: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    direction: rtl;
    min-width: 320px;
    max-width: 420px;
    backdrop-filter: blur(12px);
    pointer-events: auto;
    cursor: pointer;
    transition: all 0.3s ease;
  `;

  toast.innerHTML = `
    <div style="font-size: 1.6rem; line-height: 1;">${notif.icon || '🔔'}</div>
    <div style="flex: 1;">
      <div style="font-weight: 700; font-size: 0.95rem; color: #60a5fa; margin-bottom: 3px;">${notif.title || 'إشعار جديد'}</div>
      <div style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;">${notif.message || ''}</div>
    </div>
    <button style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;padding:0 4px;" onclick="this.parentElement.remove()">✕</button>
  `;

  toast.onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') {
      if (notif.link) {
        const parts = notif.link.split(':');
        navigate(parts[0]);
      }
      toast.remove();
    }
  };

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    setTimeout(() => toast.remove(), 350);
  }, 7500);
}

async function updateAllSidebarBadges() {
  try {
    const stats = await apiFetch('/stats', { silent: true }).catch(() => null);
    if (stats) {
      if (document.getElementById('badge-dashboard')) document.getElementById('badge-dashboard').textContent = stats.totalTenders || 0;
      if (document.getElementById('badge-tenders')) document.getElementById('badge-tenders').textContent = stats.activeTenders || stats.totalTenders || 0;
      if (document.getElementById('badge-claims')) document.getElementById('badge-claims').textContent = stats.pendingClaims || stats.totalClaims || 0;
      if (document.getElementById('badge-purchases')) {
        apiFetch('/purchases', { silent: true }).then(res => {
          const count = Array.isArray(res) ? res.length : (stats.pendingPurchases || stats.totalPurchases || 0);
          document.getElementById('badge-purchases').textContent = count;
        }).catch(() => {
          document.getElementById('badge-purchases').textContent = stats.pendingPurchases || stats.totalPurchases || 0;
        });
      }
    }

    // Roads count
    apiFetch('/v4/roads', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-roads');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Structural Assets count
    apiFetch('/v4/assets/structural', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-structural-assets');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Infrastructure Networks count
    apiFetch('/v4/assets/infrastructure', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-infrastructure');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Energy Lighting count
    apiFetch('/v4/assets/energy', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-energy-lighting');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Excavation Permits count
    apiFetch('/v4/assets/permits', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-excavation-permits');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Paving Returns count
    apiFetch('/paving-returns', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-paving-returns');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Contracts count
    apiFetch('/v4/contracts', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-contracts');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Archive count
    apiFetch('/archive', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-archive');
      if (b) b.textContent = count;
    }).catch(() => {});

    // Reports count
    const bRep = document.getElementById('badge-reports');
    if (bRep) bRep.textContent = '12';

    // Print Templates count
    apiFetch('/v4/print-templates/stats', { silent: true }).then(res => {
      const count = res?.data?.total || 8;
      const bPrint = document.getElementById('badge-print-templates');
      if (bPrint) bPrint.textContent = count;
    }).catch(() => {
      const bPrint = document.getElementById('badge-print-templates');
      if (bPrint) bPrint.textContent = '8';
    });

    // Users / Settings count
    apiFetch('/users', { silent: true }).then(res => {
      const count = Array.isArray(res) ? res.length : (res?.data?.length || 0);
      const b = document.getElementById('badge-settings');
      if (b) b.textContent = count;
    }).catch(() => {});

  } catch(e) {}
}

async function performLogin() {
  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  const loginBtn = document.querySelector('.login-btn');
  const u = uInput ? uInput.value.trim() : '';
  const p = pInput ? pInput.value : '';
  const err = document.getElementById('loginError');
  if (err) err.style.display = 'none';

  if (!u || !p) {
    if (err) {
      err.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
      err.style.display = 'block';
    }
    return;
  }

  try {
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.7';
    }
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطأ في تسجيل الدخول');

    currentUser = { ...data.user, token: data.token };
    sessionStorage.setItem('engineeringUser', JSON.stringify(currentUser));
    initApp();
  } catch (e) {
    if (err) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.style.opacity = '1';
    }
  }
}

function logout() {
  sessionStorage.clear();
  localStorage.clear();
  currentUser = null;
  window.location.href = '/login.html';
}

window.switchSettingsTab = function (tabName) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.switchTab(tabName);
  }
};

function navigate(page, skipHashUpdate = false) {
  if (!page) page = 'dashboard';

  // حارس الصلاحيات الصارم لمنع الوصول لأي شاشة غير منوطة بالمستخدم
  if (currentUser && currentUser.role !== 'admin' && currentUser.id !== 'U-001') {
    if (page !== 'dashboard' && !hasPermission(page)) {
      if (typeof showToast === 'function') {
        showToast('⛔ عذراً: غير مصرح لك بالوصول إلى هذه الشاشة وفق الصلاحيات المنوطة بك.');
      }
      const allowedFirst = updateNavigationPermissions() || 'dashboard';
      if (page !== allowedFirst) {
        return navigate(allowedFirst, true);
      }
      return;
    }
  }

  try {
    localStorage.setItem('active_system_tab', page);
    sessionStorage.setItem('active_system_tab', page);
    if (!skipHashUpdate && window.location.hash !== '#' + page) {
      history.replaceState(null, null, '#' + page);
    }
  } catch (e) {}

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (page === 'settings' || page === 'system-settings' || page === 'general-settings' || page === 'system-identity' || page === 'users' || page === 'roles' || page === 'lookups' || page === 'workflows' || page === 'org-units' || page === 'assignments') {
    const pageSettings = document.getElementById('page-settings');
    if (pageSettings) pageSettings.classList.add('active');
    const navSettings = document.getElementById('nav-settings');
    if (navSettings) navSettings.classList.add('active');

    document.getElementById('pageTitle').textContent = '⚙️ الإعدادات العامة وإدارة النظام';
    currentPage = 'settings';

    const subMap = {
      'users': 'users',
      'roles': 'roles',
      'lookups': 'lookups',
      'workflows': 'workflows',
      'org-units': 'org-units',
      'assignments': 'assignments',
      'server': 'server',
      'activity': 'activity',
      'system-identity': 'visual-identity',
      'visual-identity': 'visual-identity'
    };
    renderSettings(subMap[page] || 'visual-identity');
    if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
    return;
  }

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navItem = document.getElementById('nav-' + page);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: 'لوحة التحكم الرئيسية',
    projects: 'منظومة إدارة المشاريع والمحافظ الرأسمالية',
    'project-workspace': 'مساحة عمل المشروع الهندسي',
    roads: 'شبكة الطرق وإدارتها (RAMS)',
    'structural-assets': 'الأبنية والجدران الاستنادية',
    infrastructure: 'شبكات البنية التحتية',
    'energy-lighting': 'شبكات الإنارة والطاقة',
    'excavation-permits': 'تصاريح الحفر وتزويد الخدمات',
    'paving-returns': 'عوائد التعبيد والتحققات',
    tenders: 'العطاءات والمشاريع',
    budget: 'الموازنة العامة لمديرية الأشغال والخدمات الهندسية',
    contracts: 'العقود والضمانات البنكية',
    claims: 'إدارة المطالبات والدفعات المالية للمشاريع',
    purchases: 'المشتريات واللوازم وطلبات الصيانة والمواد',
    archive: 'الأرشيف الإلكتروني',
    reports: 'التقارير الإحصائية',
    'print-templates': 'محرر قوالب النماذج والطباعة الرسمية',
    'verify-digital': 'منظومة التحقق الرقمي والختم الأمني الموحد',
    settings: 'الإعدادات العامة وإدارة النظام',
    'system-settings': 'الإعدادات العامة وإدارة النظام',
    'general-settings': 'الإعدادات العامة وإدارة النظام',
    'system-identity': 'الإعدادات العامة وإدارة النظام'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  currentPage = page;

  if (page === 'dashboard') {
    renderDashboard();
    if (typeof dashboardMap !== 'undefined' && dashboardMap) {
      setTimeout(() => dashboardMap.invalidateSize(), 150);
    }
  }
  else if (page === 'projects') {
    if (typeof window.unifiedProjectsManager !== 'undefined') {
      window.unifiedProjectsManager.init();
    }
  }
  else if (page === 'project-workspace') {
    if (typeof window.enterpriseProjectWorkspace !== 'undefined') {
      window.enterpriseProjectWorkspace.render();
    }
  }
  else if (page === 'tenders') { if (typeof loadTendersModule === 'function') loadTendersModule(); }
  else if (page === 'budget') { if (typeof loadBudgetModule === 'function') loadBudgetModule(); }
  else if (page === 'claims') {
    if (typeof loadClaimsModule === 'function') loadClaimsModule();
    else if (typeof unifiedClaimsManager !== 'undefined' && unifiedClaimsManager) unifiedClaimsManager.init('page-claims');
    else renderTable('claims');
  }
  else if (page === 'purchases') {
    if (typeof window.unifiedPurchasesManager !== 'undefined' && window.unifiedPurchasesManager) {
      window.unifiedPurchasesManager.init();
    } else if (typeof UnifiedPurchasesManager !== 'undefined') {
      window.unifiedPurchasesManager = new UnifiedPurchasesManager();
      window.unifiedPurchasesManager.init();
    } else if (typeof loadPurchases === 'function') {
      loadPurchases();
    } else {
      renderTable('purchases');
    }
  }
  else if (page === 'committee-reports') {
    if (typeof UnifiedCommitteesManager !== 'undefined') {
      if (!window.unifiedCommitteesManager) {
        window.unifiedCommitteesManager = new UnifiedCommitteesManager();
      } else {
        window.unifiedCommitteesManager.render();
        window.unifiedCommitteesManager.fetchStats();
        window.unifiedCommitteesManager.fetchReports();
      }
    }
  }
  else if (page === 'contracts') renderContracts();
  else if (page === 'structural-assets') { if (typeof loadStructuralAssets === 'function') loadStructuralAssets(); }
  else if (page === 'infrastructure') { if (typeof loadInfrastructureNetworks === 'function') loadInfrastructureNetworks(); }
  else if (page === 'energy-lighting') { if (typeof loadEnergyLighting === 'function') loadEnergyLighting(); }
  else if (page === 'excavation-permits') { if (typeof loadExcavationPermits === 'function') loadExcavationPermits(); }
  else if (page === 'paving-returns') { if (typeof loadPavingReturns === 'function') loadPavingReturns(); }
  else if (page === 'print-templates') renderPrintTemplates();
  else if (page === 'verify-digital') {
    if (typeof UnifiedVerificationManager !== 'undefined') {
      if (!window.unifiedVerificationManager) {
        window.unifiedVerificationManager = new UnifiedVerificationManager();
      }
      window.unifiedVerificationManager.render();
    }
  }
  else if (page === 'archive') renderArchive();
  else if (page === 'reports') renderReports();
  else if (page === 'activity') renderActivityLog();
  else if (page === 'roads') { if (typeof loadRoads === 'function') loadRoads(); }

  // تطبيق قيود الصلاحيات والأزرار تلقائياً على عناصر الشاشة الحالية
  if (typeof window.applyZeroCodePermissions === 'function') {
    setTimeout(() => window.applyZeroCodePermissions(), 50);
  }

  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

// Global listener for browser hash change (Back / Forward button support)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && hash !== currentPage) {
    navigate(hash, true);
  }
});

async function apiFetch(url, opts = {}) {
  try {
    const headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    const token = (currentUser && currentUser.token) || localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (currentUser) {
      headers['x-user-role'] = currentUser.role;
      headers['x-user-id'] = currentUser.id;
    }

    const res = await fetch(API + url, {
      headers: { ...headers, ...(opts.headers || {}) },
      ...opts
    });
    if (res.status === 401 && currentUser && url !== '/login') {
      logout();
      showToast('⚠️ انتهت جلسة العمل، يرجى إعادة تسجيل الدخول');
      throw new Error('انتهت جلسة العمل');
    }
    if (!res.ok) {
      const errorText = await res.text();
      let errorJson;
      try { errorJson = JSON.parse(errorText); } catch (e) { }
      throw new Error(errorJson?.error || 'خطأ في الاتصال بالخادم');
    }
    return await res.json();
  } catch (e) {
    if (!opts.silent) {
      showToast('❌ ' + e.message);
    }
    if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed'))) {
      const dbDot = document.getElementById('dbDot');
      if (dbDot) dbDot.style.background = 'var(--warning)';
      const dbStatus = document.getElementById('dbStatus');
      if (dbStatus) dbStatus.textContent = 'قاعدة البيانات: الوضع المحلي (Offline)';
    }
    throw e;
  }
}

async function checkDbStatus() {
  try {
    const res = await fetch(API + '/health');
    const data = await res.json();
    const dbDot = document.getElementById('dbDot');
    const dbStatus = document.getElementById('dbStatus');
    if (res.ok && data.connected) {
      if (dbDot) dbDot.style.background = 'var(--success)';
      if (dbStatus) dbStatus.textContent = 'قاعدة البيانات: متصلة (PostgreSQL)';
    } else {
      if (dbDot) dbDot.style.background = 'var(--warning)';
      if (dbStatus) dbStatus.textContent = 'قاعدة البيانات: الوضع المحلي (Fallback)';
    }
  } catch (e) {
    const dbDot = document.getElementById('dbDot');
    if (dbDot) dbDot.style.background = 'var(--danger)';
    const dbStatus = document.getElementById('dbStatus');
    if (dbStatus) dbStatus.textContent = 'قاعدة البيانات: غير متصلة';
  }
}

// ===== Notifications =====
async function fetchNotifications() {
  try {
    const stats = await apiFetch('/stats');
    const list = document.getElementById('notifListContainer');
    let html = '';
    let count = 0;

    if (stats.activeTenders > 0) {
      html += `<div class="notif-item unread" onclick="navigate('tenders')"><span class="notif-icon">📋</span><div><b>عطاءات نشطة:</b> يوجد ${stats.activeTenders} عطاء قيد التنفيذ.</div></div>`;
      count++;
    }
    if (stats.pendingClaims > 0) {
      html += `<div class="notif-item unread" onclick="navigate('claims')"><span class="notif-icon">📝</span><div><b>مطالبات معلقة:</b> يوجد ${stats.pendingClaims} مطالبة قيد الدراسة.</div></div>`;
      count++;
    }
    if (stats.pendingPurchases > 0) {
      html += `<div class="notif-item unread" onclick="navigate('purchases')"><span class="notif-icon">🛒</span><div><b>أوامر شراء:</b> يوجد ${stats.pendingPurchases} أمر شراء جديد.</div></div>`;
      count++;
    }

    if (count === 0) {
      html = `<div class="notif-item"><div style="text-align:center;width:100%;color:var(--text-muted)">لا توجد إشعارات جديدة</div></div>`;
    }

    if (list) list.innerHTML = html;

    const badge = document.querySelector('.notif-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Failed to load notifications', e);
  }
}

// ===== Dashboard =====
let dashboardMap = null;
let dashboardMarkers = [];
let roadsPciChart = null;

function renderPersonalizedSubDashboard(stats = {}) {
  const container = document.getElementById('dash-role-hub');
  if (!container || !currentUser) return;

  const isSuperAdmin = currentUser.role === 'admin' || currentUser.id === 'U-001';
  const roleTitle = roleNames[currentUser.role] || currentUser.role || 'مستخدم النظام';
  const deptName = currentUser.department || 'مديرية الأشغال والخدمات الهندسية';

  // قائمة الاختصاصات والمجالات المؤسسية
  const moduleBadges = [
    { key: 'roads', name: 'إدارة شبكة الطرق والـ PMS', icon: '🛣️', color: '#0f766e', bg: '#ccfbf1' },
    { key: 'tenders', name: 'العطاءات والمشاريع الرأسمالية', icon: '📋', color: '#0284c7', bg: '#e0f2fe' },
    { key: 'claims', name: 'المطالبات والمستخلصات المالية', icon: '📝', color: '#7c3aed', bg: '#f3e8ff' },
    { key: 'contracts', name: 'العقود والكفالات البنكية', icon: '📑', color: '#4338ca', bg: '#e0e7ff' },
    { key: 'purchases', name: 'أوامر الشراء والمستودعات', icon: '🛒', color: '#d97706', bg: '#fef3c7' },
    { key: 'excavation-permits', name: 'تصاريح الحفر وتزويد الخدمات', icon: '🚜', color: '#b45309', bg: '#ffedd5' },
    { key: 'structural-assets', name: 'الأصول الإنشائية والأبنية', icon: '🏛️', color: '#059669', bg: '#d1fae5' },
    { key: 'infrastructure', name: 'شبكات البنية التحتية', icon: '🌐', color: '#2563eb', bg: '#dbeafe' },
    { key: 'energy-lighting', name: 'الإنارة والطاقة المتجددة', icon: '⚡', color: '#ca8a04', bg: '#fef9c3' },
    { key: 'paving-returns', name: 'عوائد التعبيد والتحققات', icon: '💰', color: '#047857', bg: '#a7f3d0' },
    { key: 'reports', name: 'التقارير والإحصائيات الرسمية', icon: '📊', color: '#0f766e', bg: '#e6fffa' },
    { key: 'archive', name: 'الأرشيف الإلكتروني والوثائق', icon: '📁', color: '#475569', bg: '#f1f5f9' },
    { key: 'settings', name: 'إدارة النظام والصلاحيات والمحركات', icon: '⚙️', color: '#dc2626', bg: '#fee2e2' }
  ];

  const authorizedModules = isSuperAdmin ? moduleBadges : moduleBadges.filter(m => hasPermission(m.key));

  // مصفوفة الإجراءات والعمليات السريعة المصرحة
  const actionShortcuts = [
    { perm: 'tenders:create', label: 'طرح / إضافة عطاء جديد', icon: '📋', color: '#0284c7', action: "navigate('tenders'); setTimeout(()=>openModal('tenders'),100);" },
    { perm: 'claims:create', label: 'إصدار مطالبة مالية', icon: '📝', color: '#7c3aed', action: "navigate('claims'); setTimeout(()=>openModal('claims'),100);" },
    { perm: 'roads:create', label: 'توثيق مقطع طريق / PMS', icon: '🛣️', color: '#0f766e', action: "navigate('roads'); setTimeout(()=>openModal('roads'),100);" },
    { perm: 'contracts:create', label: 'توثيق عقد وكفالة بنكية', icon: '📑', color: '#4338ca', action: "navigate('contracts'); setTimeout(()=>{ if(window.unifiedContractsManager) window.unifiedContractsManager.openNewContractModal(); },100);" },
    { perm: 'purchases:create', label: 'طلب شراء وتوريد مواد', icon: '🛒', color: '#d97706', action: "navigate('purchases'); setTimeout(()=>openModal('purchases'),100);" },
    { perm: 'permits:create', label: 'إصدار تصريح حفر وتصريح خدمة', icon: '🚜', color: '#b45309', action: "navigate('excavation-permits'); setTimeout(()=>{ if(window.excavationManager) window.excavationManager.openCreateModal(); },100);" },
    { perm: 'assets:create', label: 'إدراج أصل إنشائي / شبكة', icon: '🏛️', color: '#059669', action: "navigate('structural-assets'); setTimeout(()=>openModal('structural-assets'),100);" }
  ];

  const authorizedActions = isSuperAdmin ? actionShortcuts : actionShortcuts.filter(a => hasPermission(a.perm));

  container.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 22px 24px; color: #fff; box-shadow: 0 12px 30px -8px rgba(0,0,0,0.3); font-family:'Tajawal',sans-serif; direction:rtl; margin-bottom:16px;">
      
      <!-- رأس لوحة الصلاحيات المنوطة -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px; margin-bottom:18px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, #10b981 0%, #047857 100%); display:flex; align-items:center; justify-content:center; font-size:1.6rem; box-shadow:0 4px 12px rgba(16,185,129,0.35);">
            ${currentUser.fullName ? currentUser.fullName.charAt(0) : '👤'}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <h2 style="margin:0; font-size:1.25rem; font-weight:800; color:#fff;">لوحة التحكم التنفيذية المنوطة — ${currentUser.fullName || currentUser.username}</h2>
              <span style="background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.4); padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700;">
                💼 ${roleTitle}
              </span>
              <span style="background:rgba(59,130,246,0.15); color:#93c5fd; border:1px solid rgba(59,130,246,0.3); padding:3px 10px; border-radius:20px; font-size:0.75rem;">
                🏢 ${deptName}
              </span>
            </div>
            <p style="margin:4px 0 0 0; font-size:0.85rem; color:#94a3b8;">
              تم تخصيص هذه اللوحة تلقائياً لعرض مؤشرات وإجراءات الاختصاص المصرحة لك فقط وفق مصفوفة الصلاحيات الديناميكية المعتمدة.
            </p>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          <button id="btn-toggle-dash-mode" class="btn btn-sm" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:6px 14px; border-radius:8px; font-size:0.8rem; font-weight:700; cursor:pointer;" onclick="toggleDashboardViewMode()">
            👁️ تبديل العرض: <span id="dash-mode-text">${window._dashPersonalizedOnly !== false ? 'صلاحياتي فقط 🎯' : 'العرض البلدي الشامل 🌐'}</span>
          </button>
        </div>
      </div>

      <!-- شريط الاختصاصات والصلاحيات المفعلة -->
      <div style="margin-bottom:18px;">
        <div style="font-size:0.8rem; font-weight:700; color:#cbd5e1; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>🛡️</span> <span>المجالات والاختصاصات التشغيلية المفعلة لحسابك (${authorizedModules.length} مجال):</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${authorizedModules.map(m => `
            <span style="display:inline-flex; align-items:center; gap:6px; background:${m.bg}15; color:${m.color}; border:1px solid ${m.color}40; padding:5px 12px; border-radius:10px; font-size:0.8rem; font-weight:700; cursor:pointer;" onclick="navigate('${m.key}')">
              <span>${m.icon}</span> <span>${m.name}</span>
            </span>
          `).join('') || '<span style="color:#94a3b8; font-size:0.8rem;">لا توجد شاشات مفعلة حالياً</span>'}
        </div>
      </div>

      <!-- مصفوفة الإجراءات والعمليات السريعة المصرحة -->
      ${authorizedActions.length > 0 ? `
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#cbd5e1; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>⚡</span> <span>بوابة الإجراءات والعمليات السريعة المصرح لك تنفيذها:</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
            ${authorizedActions.map(a => `
              <button onclick="${a.action}" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-right:3px solid ${a.color}; border-radius:10px; padding:10px 14px; display:flex; align-items:center; gap:10px; color:#f8fafc; font-family:'Tajawal',sans-serif; cursor:pointer; text-align:right; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.12)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.transform='translateY(0)'">
                <span style="font-size:1.3rem;">${a.icon}</span>
                <span style="font-size:0.82rem; font-weight:700;">${a.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

    </div>
  `;

  applyDashboardPermissionFiltering();
}

function applyDashboardPermissionFiltering() {
  if (!currentUser) return;
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.id === 'U-001';
  
  // إخفاء وحظر صارم وقطعي لكافة البطاقات والأزرار والتنبيهات غير المصرحة للمستخدم
  document.querySelectorAll('#page-dashboard [data-perm]').forEach(el => {
    const requiredPerm = el.getAttribute('data-perm');
    if (!requiredPerm) return;
    
    if (isSuperAdmin) {
      el.style.display = '';
    } else {
      if (hasPermission(requiredPerm)) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }
  });

  // التحكم بشريط البانر البلدي العام (يظهر للمشرفين، ويُستبدل بالبوابة التنفيذية المخصصة للموظف)
  const mainBanner = document.getElementById('dashMainBanner');
  if (mainBanner) {
    if (isSuperAdmin) {
      mainBanner.style.display = '';
    } else {
      mainBanner.style.display = 'none';
    }
  }

  // إخفاء زر التبديل للموظفين العاديين لمنع محاولة استعراض بيانات خارج الصلاحيات
  const btnToggle = document.getElementById('btn-toggle-dash-mode');
  if (btnToggle && !isSuperAdmin) {
    btnToggle.style.display = 'none';
  }
}

function toggleDashboardViewMode() {
  const isSuperAdmin = currentUser && (currentUser.role === 'admin' || currentUser.id === 'U-001');
  if (!isSuperAdmin) return;
  window._dashPersonalizedOnly = window._dashPersonalizedOnly === false ? true : false;
  const modeText = document.getElementById('dash-mode-text');
  if (modeText) {
    modeText.textContent = window._dashPersonalizedOnly ? 'صلاحياتي فقط 🎯' : 'العرض البلدي الشامل 🌐';
  }
  applyDashboardPermissionFiltering();
  if (dashboardMap && typeof dashboardMap.invalidateSize === 'function') {
    setTimeout(() => dashboardMap.invalidateSize(), 200);
  }
}
window.toggleDashboardViewMode = toggleDashboardViewMode;
window.renderPersonalizedSubDashboard = renderPersonalizedSubDashboard;
window.applyDashboardPermissionFiltering = applyDashboardPermissionFiltering;

async function renderDashboard() {
  try {
    const stats = await apiFetch('/stats');
    
    // بناء لوحة التحكم الفرعية المخصصة بحسب صلاحيات المستخدم
    renderPersonalizedSubDashboard(stats);
    
    // 1. تحديث المؤشرات القيادية الـ 8
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    
    setEl('stat-tenders', stats.totalTenders || 0);
    setEl('stat-tenders-active', (stats.activeTenders || 0) + ' جاري التنفيذ');
    setEl('stat-budget', Number(stats.totalBudget || 0).toLocaleString('ar-JO') + ' د.أ');

    setEl('stat-claims', stats.totalClaims || 0);
    setEl('stat-claims-pending', (stats.pendingClaims || 0) + ' بانتظار الاعتماد');
    setEl('stat-claims-paid', Number(stats.totalClaimsPaidValue || 0).toLocaleString('ar-JO') + ' د.أ مصروفات معتمدة');

    setEl('stat-contracts', stats.totalContracts || 0);
    setEl('stat-guarantees-val', Number(stats.totalGuaranteesValue || 0).toLocaleString('ar-JO') + ' د.أ كفالات مرصودة');

    setEl('stat-roads-pci', (stats.avgPciScore || 78) + ' / 100');
    setEl('stat-roads-km', (stats.totalRoadsLengthKm || 48.5) + ' كم شبكة الطرق');

    setEl('stat-permits', stats.totalPermits || 0);
    setEl('stat-permits-active', (stats.activePermits || 0) + ' سارية المفعول');

    setEl('stat-purchases', stats.totalPurchases || 0);
    setEl('stat-purchases-pending', (stats.pendingPurchases || 0) + ' قيد الطلب');

    setEl('dash-db-mode', (stats.database || 'PostgreSQL 15+') + ' متزامنة');

    // شارات القائمة الجانبية
    setEl('badge-tenders', stats.activeTenders || 0);
    setEl('badge-claims', stats.pendingClaims || 0);
    apiFetch('/purchases', { silent: true }).then(res => {
      setEl('badge-purchases', Array.isArray(res) ? res.length : (stats.pendingPurchases || 0));
    }).catch(() => {
      setEl('badge-purchases', stats.pendingPurchases || 0);
    });

    // 2. تحديث مركز التنبيهات الذكية والرصد المبكر
    const critG = parseInt(stats.criticalGuaranteesCount || 0, 10);
    setEl('dash-alert-guarantees', critG > 0 ? `⚠️ يوجد ${critG} كفالات مصرفية تنتهي خلال 30 يوماً تستوجب المتابعة` : '✅ كافة الكفالات البنكية سارية ومغطاة قانونياً');

    const critR = parseInt(stats.criticalRoadsCount || 0, 10);
    setEl('dash-alert-roads', critR > 0 ? `⚠️ تم رصد ${critR} مقاطع طرق حرجة (PCI < 55) بحاجة لتعبيد عاجل` : `✅ جودة شبكة الطرق ممتازة (متوسط PCI: ${stats.avgPciScore || 78})`);

    const actP = parseInt(stats.activePermits || 0, 10);
    setEl('dash-alert-permits', actP > 0 ? `🚜 يوجد ${actP} تصاريح حفر سارية قيد المتابعة وإعادة الأوضاع` : '✅ تم استلام وإعادة أوضاع كافة الحفريات السابقة');

    // 3. جلب القوائم والمسارات الزمنية
    const tenders = await apiFetch('/tenders').catch(() => []);
    const claims = await apiFetch('/claims').catch(() => []);

    const recentTenders = document.getElementById('recentTenders');
    if (recentTenders) {
      recentTenders.innerHTML = (tenders || []).slice(0, 5).map(t =>
        `<div class="timeline-item"><div class="timeline-item-name">📋 ${t.name || t.id}</div><div class="timeline-item-meta"><span class="status-badge ${getStatusClass(t.status)}">${t.status}</span><span style="font-size:0.75rem; color:var(--text-muted)">${(t.createdAt || '').split('T')[0]}</span></div></div>`
      ).join('') || '<div class="empty-state"><p>لا توجد عطاءات مسجلة</p></div>';
    }

    const recentClaims = document.getElementById('recentClaims');
    if (recentClaims) {
      recentClaims.innerHTML = (claims || []).slice(0, 5).map(c =>
        `<div class="timeline-item"><div class="timeline-item-name">📝 ${c.id} - ${c.contractor || c.claimant || 'مطالبة'}</div><div class="timeline-item-meta"><span class="status-badge ${getStatusClass(c.status)}">${c.status}</span><span style="font-size:0.75rem; color:var(--text-muted)">${c.submissionDate || (c.createdAt || '').split('T')[0] || ''}</span></div></div>`
      ).join('') || '<div class="empty-state"><p>لا توجد مطالبات مسجلة</p></div>';
    }

    // تحديث الرسوم البيانية
    renderCharts(stats);

    // ===== Master Unified GIS Dashboard Map Engine =====
    if (!dashboardMap) {
      dashboardMap = typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createMap === 'function'
        ? UnifiedGisEngine.createMap('dashboardMap', [32.2985, 35.7050], 14)
        : (typeof createUnifiedMap === 'function'
            ? createUnifiedMap('dashboardMap', [32.2985, 35.7050], 14)
            : L.map('dashboardMap').setView([32.2985, 35.7050], 14));
      
      window.dashboardGisLayers = {
        tenders: L.featureGroup().addTo(dashboardMap),
        roads: L.featureGroup().addTo(dashboardMap),
        structural: L.featureGroup().addTo(dashboardMap),
        infrastructure: L.featureGroup().addTo(dashboardMap),
        energy: L.featureGroup().addTo(dashboardMap),
        permits: L.featureGroup().addTo(dashboardMap),
        paving: L.featureGroup().addTo(dashboardMap)
      };
    }

    // Reset all GIS feature groups
    if (window.dashboardGisLayers) {
      Object.values(window.dashboardGisLayers).forEach(layerGroup => layerGroup.clearLayers());
    }

    const bounds = L.latLngBounds();
    let hasLoc = false;

    // 1. Tenders Layer (العطاءات والمشاريع)
    let tendersCount = 0;
    tenders.forEach(t => {
      if (t.lat && t.lng) {
        tendersCount++;
        hasLoc = true;
        const color = t.status === 'مفتوح' ? '#0284c7' : (t.status === 'مُنجز' ? '#10b981' : '#f59e0b');
        const icon = typeof UnifiedGisEngine !== 'undefined' && typeof UnifiedGisEngine.createCustomIcon === 'function'
          ? UnifiedGisEngine.createCustomIcon('📋', color, 30)
          : L.divIcon({ html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;"></div>` });

        const marker = L.marker([t.lat, t.lng], { icon });
        marker.bindPopup(`
          <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:210px;">
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-main,#1e293b); margin-bottom:4px;">📋 ${t.name}</div>
            <div style="font-size:0.8rem; color:var(--text-muted,#64748b);">المقاول: <b>${t.contractor || 'غير محدد'}</b></div>
            <div style="font-size:0.8rem; color:var(--text-muted,#64748b);">القيمة: <b>${Number(t.value || 0).toLocaleString()} د.أ</b></div>
            <div style="margin-top:6px; display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold; background:${color}20; color:${color}; border:1px solid ${color}40;">${t.status}</div>
            <button class="btn btn-sm btn-outline" style="margin-top:10px; width:100%; font-size:0.75rem;" onclick="viewRecord('tenders', '${t.id}')">🔍 التفاصيل الكاملة</button>
          </div>
        `);
        window.dashboardGisLayers.tenders.addLayer(marker);
        bounds.extend([t.lat, t.lng]);
      }
    });
    const cTenders = document.getElementById('mf-count-tenders');
    if (cTenders) cTenders.textContent = tendersCount || tenders.length;

    // 2. Roads Network Layer (شبكة الطرق والشوارع)
    apiFetch('/v4/roads', { silent: true }).then(roadsList => {
      let roadsCount = 0;
      const list = Array.isArray(roadsList) ? roadsList : (roadsList?.data || []);
      list.forEach(r => {
        let geoJsonData = null;
        if (r.geom_geojson) {
          try { geoJsonData = JSON.parse(r.geom_geojson); } catch (e) {}
        } else if (r.geoJson || r.geometry_json || r.geometry) {
          const raw = r.geoJson || r.geometry_json || r.geometry;
          try { geoJsonData = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
        }

        const pci = parseFloat(r.pci_score || r.conditionIndex || 85);
        const pciColor = pci >= 85 ? '#10B981' : (pci >= 60 ? '#F59E0B' : '#EF4444');

        if (geoJsonData && geoJsonData.coordinates && geoJsonData.coordinates.length > 0) {
          let latLngs = [];
          if (geoJsonData.type === 'LineString') {
            latLngs = geoJsonData.coordinates.map(c => [c[1], c[0]]);
          } else if (geoJsonData.type === 'MultiLineString') {
            latLngs = geoJsonData.coordinates.map(line => line.map(c => [c[1], c[0]]));
          }

          if (latLngs.length > 0) {
            roadsCount++;
            const polyline = L.polyline(latLngs, {
              color: pciColor,
              weight: 5,
              opacity: 0.85
            });

            polyline.bindPopup(`
              <div style="font-family:'Tajawal',sans-serif; direction:rtl; text-align:right; min-width:210px;">
                <div style="font-weight:800; font-size:0.95rem; color:#0284c7; margin-bottom:4px;">🛣️ الشارع: ${r.name || r.code}</div>
                <div style="font-size:0.8rem; color:var(--text-muted,#64748b);">التصنيف: <b>${r.classification || r.category || 'فرعي'}</b></div>
                <div style="font-size:0.8rem; color:${pciColor}; font-weight:bold; margin-top:2px;">مؤشر الرصفة PCI: ${Math.round(pci)} / 100</div>
                <button class="btn btn-outline" style="margin-top:8px; padding:4px 8px; font-size:0.75rem; width:100%" onclick="navigate('roads'); setTimeout(() => { if (typeof focusRoadOnMap === 'function') focusRoadOnMap('${r.id}'); }, 300)">عرض في شبكة الطرق</button>
              </div>
            `);
            window.dashboardGisLayers.roads.addLayer(polyline);
            if (Array.isArray(latLngs[0])) {
              latLngs.forEach(pt => { if (pt[0] && pt[1]) bounds.extend(pt); });
            }
          }
        }
      });
      const cRoads = document.getElementById('mf-count-roads');
      if (cRoads) cRoads.textContent = roadsCount || list.length;
    }).catch(() => {});

    // 3. Structural Assets & Retaining Walls Layer (الأبنية والجدران الاستنادية)
    apiFetch('/v4/assets/structural', { silent: true }).then(assets => {
      const list = Array.isArray(assets) ? assets : (assets?.data || []);
      const cStruct = document.getElementById('mf-count-structural');
      if (cStruct) cStruct.textContent = list.length;

      list.forEach(a => {
        const lat = parseFloat(a.lat || a.latitude || 0);
        const lng = parseFloat(a.lng || a.longitude || 0);
        if (lat && lng) {
          const icon = typeof UnifiedGisEngine !== 'undefined'
            ? UnifiedGisEngine.createCustomIcon('🏛️', '#d97706', 28)
            : L.marker([lat, lng]);
          const m = L.marker([lat, lng], { icon });
          m.bindPopup(`
            <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:200px;">
              <div style="font-weight:800; font-size:0.92rem; color:#d97706;">🏛️ ${a.name || 'أصل إنشائي / جدار'}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">النوع: <b>${a.type || a.category || 'جدار استنادي'}</b></div>
              <div style="font-size:0.8rem; color:var(--text-muted);">الحالة الإنشائية: <b>${a.condition || 'جيدة'}</b></div>
              <button class="btn btn-sm btn-outline" style="margin-top:8px; width:100%; font-size:0.75rem;" onclick="navigate('structural-assets')">عرض في الأصول الإنشائية</button>
            </div>
          `);
          window.dashboardGisLayers.structural.addLayer(m);
        }
      });
    }).catch(() => {});

    // 4. Infrastructure Networks Layer (شبكات البنية التحتية)
    apiFetch('/v4/assets/infrastructure', { silent: true }).then(nets => {
      const list = Array.isArray(nets) ? nets : (nets?.data || []);
      const cInfra = document.getElementById('mf-count-infrastructure');
      if (cInfra) cInfra.textContent = list.length;

      list.forEach(n => {
        let lat = parseFloat(n.lat || n.latitude || 0);
        let lng = parseFloat(n.lng || n.longitude || 0);
        const rawGeo = n.geometry || n.geom || n.geojson;

        if (rawGeo && (!lat || !lng)) {
          try {
            const geo = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
            if (geo.type === 'LineString' && geo.coordinates && geo.coordinates.length) {
              lng = geo.coordinates[0][0];
              lat = geo.coordinates[0][1];
            } else if (geo.type === 'Point' && geo.coordinates) {
              lng = geo.coordinates[0];
              lat = geo.coordinates[1];
            }
          } catch {}
        }

        if (lat && lng) {
          const icon = typeof UnifiedGisEngine !== 'undefined'
            ? UnifiedGisEngine.createCustomIcon('🌐', '#0ea5e9', 28)
            : L.marker([lat, lng]);
          const m = L.marker([lat, lng], { icon });
          m.bindPopup(`
            <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:210px; padding:4px;">
              <div style="font-weight:800; font-size:0.92rem; color:#0ea5e9; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">🌐 ${n.code || n.name || 'شبكة بنية تحتية'}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">نوع الخدمة: <b>${n.network_type || n.networkType || n.type || 'مياه / خدمات'}</b></div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">المادة والقطر: <b>${n.material || 'HDPE'} — ${n.diameter_mm || n.diameter || 'قياسي'} ملم</b></div>
              <button class="btn btn-sm btn-outline" style="margin-top:6px; width:100%; font-size:0.75rem; background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="navigate('infrastructure')">عرض في البنية التحتية</button>
            </div>
          `);
          window.dashboardGisLayers.infrastructure.addLayer(m);
        }
      });
    }).catch(() => {});

    // 5. Energy & Lighting Layer (شبكات الإنارة والطاقة)
    apiFetch('/v4/assets/energy', { silent: true }).then(lights => {
      const list = Array.isArray(lights) ? lights : (lights?.data || []);
      const cEnergy = document.getElementById('mf-count-energy');
      if (cEnergy) cEnergy.textContent = list.length;

      list.forEach(e => {
        const lat = parseFloat(e.lat || e.latitude || 0);
        const lng = parseFloat(e.lng || e.longitude || 0);
        if (lat && lng) {
          const icon = typeof UnifiedGisEngine !== 'undefined'
            ? UnifiedGisEngine.createCustomIcon('⚡', '#eab308', 26)
            : L.marker([lat, lng]);
          const m = L.marker([lat, lng], { icon });
          m.bindPopup(`
            <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:200px;">
              <div style="font-weight:800; font-size:0.92rem; color:#ca8a04;">⚡ ${e.name || e.code || 'عمود إنارة'}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">النوع: <b>${e.fixture_type || e.type || 'LED'}</b></div>
              <div style="font-size:0.8rem; color:var(--text-muted);">القدرة: <b>${e.wattage || 150} واط</b></div>
              <button class="btn btn-sm btn-outline" style="margin-top:8px; width:100%; font-size:0.75rem;" onclick="navigate('energy-lighting')">عرض في شبكة الإنارة</button>
            </div>
          `);
          window.dashboardGisLayers.energy.addLayer(m);
        }
      });
    }).catch(() => {});

    // 6. Excavation Permits Layer (تصاريح الحفر وتزويد الخدمات)
    apiFetch('/v4/assets/permits', { silent: true }).then(permits => {
      const list = Array.isArray(permits) ? permits : (permits?.data || []);
      const cPermits = document.getElementById('mf-count-permits');
      if (cPermits) cPermits.textContent = list.length;

      list.forEach(p => {
        let lat = parseFloat(p.lat || p.latitude || 0);
        let lng = parseFloat(p.lng || p.longitude || 0);
        const rawGeo = p.geojson || p.geometry || p.geom;

        if (rawGeo && (!lat || !lng)) {
          try {
            const geo = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
            if (geo.type === 'LineString' && geo.coordinates && geo.coordinates.length) {
              lng = geo.coordinates[0][0];
              lat = geo.coordinates[0][1];
            } else if (geo.type === 'Point' && geo.coordinates) {
              lng = geo.coordinates[0];
              lat = geo.coordinates[1];
            }
          } catch {}
        }

        if (lat && lng) {
          const icon = typeof UnifiedGisEngine !== 'undefined'
            ? UnifiedGisEngine.createCustomIcon('🚜', '#10b981', 28)
            : L.marker([lat, lng]);
          const m = L.marker([lat, lng], { icon });
          m.bindPopup(`
            <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:210px; padding:4px;">
              <div style="font-weight:800; font-size:0.92rem; color:#10b981; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">🚜 تصريح: ${p.code || p.permit_number || p.id}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:2px;">مقدم الطلب: <b>${p.applicant || p.applicant_name || 'أهلي'}</b></div>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">الغرض: <b>${p.purpose || p.location_description || 'تزويد خدمات'}</b></div>
              <button class="btn btn-sm btn-outline" style="margin-top:6px; width:100%; font-size:0.75rem; background:#059669; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="navigate('excavation-permits')">عرض في تصاريح الحفر</button>
            </div>
          `);
          window.dashboardGisLayers.permits.addLayer(m);
        }
      });
    }).catch(() => {});

    // 7. Paving Returns Layer (عوائد التعبيد والتحققات)
    apiFetch('/paving-returns', { silent: true }).then(returns => {
      const list = Array.isArray(returns) ? returns : (returns?.data || []);
      const cPaving = document.getElementById('mf-count-paving');
      if (cPaving) cPaving.textContent = list.length;

      list.forEach(pv => {
        const lat = parseFloat(pv.lat || pv.latitude || 0);
        const lng = parseFloat(pv.lng || pv.longitude || 0);
        if (lat && lng) {
          const icon = typeof UnifiedGisEngine !== 'undefined'
            ? UnifiedGisEngine.createCustomIcon('💰', '#059669', 26)
            : L.marker([lat, lng]);
          const m = L.marker([lat, lng], { icon });
          m.bindPopup(`
            <div style="text-align:right; font-family:'Tajawal',sans-serif; direction:rtl; min-width:210px;">
              <div style="font-weight:800; font-size:0.92rem; color:#059669;">💰 عوائد تعبيد - قطعة ${pv.piece_number || pv.pieceNumber || pv.id}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">الحوض: <b>${pv.basin_number || pv.basinNumber || 'رئيسي'}</b></div>
              <div style="font-size:0.8rem; color:var(--text-muted);">المبلغ المطلوب: <b>${Number(pv.required_amount || pv.requiredAmount || 0).toLocaleString()} د.أ</b></div>
              <button class="btn btn-sm btn-outline" style="margin-top:8px; width:100%; font-size:0.75rem;" onclick="navigate('paving-returns')">عرض في عوائد التعبيد</button>
            </div>
          `);
          window.dashboardGisLayers.paving.addLayer(m);
        }
      });
    }).catch(() => {});

    if (hasLoc) {
      dashboardMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } else {
      dashboardMap.setView([32.2985, 35.7050], 14);
    }
    setTimeout(() => dashboardMap.invalidateSize(), 300);

    renderCharts(stats);
    updateAllSidebarBadges();
    applyDashboardPermissionFiltering();
  } catch (e) {
    console.error(e);
  }
}

// دالة التحكم الصارم بطبقات الخريطة الجغرافية
window.toggleDashboardGisLayer = function(layerKey, isVisible) {
  if (!dashboardMap || !window.dashboardGisLayers || !window.dashboardGisLayers[layerKey]) return;
  const layerGroup = window.dashboardGisLayers[layerKey];
  const chip = document.querySelector(`.map-filter-chip[data-layer="${layerKey}"]`);

  if (isVisible) {
    if (!dashboardMap.hasLayer(layerGroup)) {
      dashboardMap.addLayer(layerGroup);
    }
    chip?.classList.add('active');
  } else {
    if (dashboardMap.hasLayer(layerGroup)) {
      dashboardMap.removeLayer(layerGroup);
    }
    chip?.classList.remove('active');
  }
};

function getStatusClass(status) {
  if (!status) return 's-open';
  if (['مُنجز', 'موافق عليه', 'موافق عليها', 'معتمدة', 'معتمدة وجاهزة للصرف'].some(s => status.includes(s))) return 's-done';
  if (['منتهي', 'قيد الدراسة', 'بانتظار', 'تدقيق'].some(s => status.includes(s))) return 's-warn';
  if (['ملغي', 'مرفوضة', 'مرفوض'].some(s => status.includes(s))) return 's-danger';
  if (['مفتوح', 'جديد', 'مقدمة', 'مسودة'].some(s => status.includes(s))) return 's-open';
  return 's-open';
}

function renderCharts(stats) {
  Chart.defaults.color = '#8ba3c4';
  Chart.defaults.font.family = 'Tajawal';

  const statusMap = {};
  if (stats.tendersByStatus && stats.tendersByStatus.length) {
    stats.tendersByStatus.forEach(r => statusMap[r.status] = r.count);
  } else {
    statusMap['جاري التنفيذ'] = stats.activeTenders || 1;
    statusMap['قيد الطرح'] = 1;
    statusMap['مستلم أولياً'] = 1;
  }
  const colors = { 'مفتوح': '#0284c7', 'جاري التنفيذ': '#10b981', 'منتهي': '#f59e0b', 'مُنجز': '#059669', 'ملغي': '#ef4444', 'قيد الطرح': '#6366f1', 'مستلم أولياً': '#14b8a6' };

  if (tendersChart) tendersChart.destroy();
  const ctx1 = document.getElementById('tendersChart')?.getContext('2d');
  if (ctx1) {
    tendersChart = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusMap),
        datasets: [{ data: Object.values(statusMap), backgroundColor: Object.keys(statusMap).map(k => colors[k] || '#0284c7'), borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'right' } }, cutout: '70%', maintainAspectRatio: false }
    });
  }

  const monthNames = { '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل', '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس', '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر' };
  const months = (stats.claimsByMonth && stats.claimsByMonth.length) 
    ? stats.claimsByMonth.map(r => monthNames[r.month] || r.month)
    : ['مايو', 'يونيو', 'يوليو', 'أغسطس'];
  const mData = (stats.claimsByMonth && stats.claimsByMonth.length)
    ? stats.claimsByMonth.map(r => r.count)
    : [2, 4, 3, 5];

  if (claimsChart) claimsChart.destroy();
  const ctx2 = document.getElementById('claimsChart')?.getContext('2d');
  if (ctx2) {
    claimsChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels: months, datasets: [{ label: 'قيمة المستخلصات (د.أ)', data: mData, backgroundColor: '#0f766e', borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, maintainAspectRatio: false, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
    });
  }

  // 3. رسم توزيع جودة شبكة الطرق PCI
  if (roadsPciChart) roadsPciChart.destroy();
  const ctx3 = document.getElementById('roadsPciChart')?.getContext('2d');
  if (ctx3) {
    const critCount = parseInt(stats.criticalRoadsCount || 1, 10);
    const goodCount = Math.max(1, (stats.totalRoads || 5) - critCount);
    roadsPciChart = new Chart(ctx3, {
      type: 'doughnut',
      data: {
        labels: ['ممتازة (PCI > 85)', 'جيدة (70-84)', 'مقبولة (55-69)', 'حرجة (< 55)'],
        datasets: [{
          data: [Math.round(goodCount * 0.5), Math.round(goodCount * 0.3), Math.round(goodCount * 0.2), critCount],
          backgroundColor: ['#10b981', '#0284c7', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: { plugins: { legend: { position: 'right' } }, cutout: '65%', maintainAspectRatio: false }
    });
  }
}

// ===== Tables =====
let currentFilters = { tenders: {}, claims: {}, purchases: {} };

async function renderTable(type) {
  try {
    const tbody = document.getElementById(type + '-tbody');
    tbody.innerHTML = `<tr><td colspan="9"><div class="loading"><div class="spinner"></div> جاري التحميل...</div></td></tr>`;

    const params = new URLSearchParams();
    if (currentFilters[type].search) params.append('search', currentFilters[type].search);
    if (currentFilters[type].status) params.append('status', currentFilters[type].status);
    if (type === 'claims' && currentFilters[type].tenderId) params.append('tenderId', currentFilters[type].tenderId);
    if (type === 'tenders') {
      if (currentFilters.tenders.tenderType) params.append('tenderType', currentFilters.tenders.tenderType);
      if (currentFilters.tenders.purchaseMethod) params.append('purchaseMethod', currentFilters.tenders.purchaseMethod);
      if (currentFilters.tenders.purchaseCommittee) params.append('purchaseCommittee', currentFilters.tenders.purchaseCommittee);
    }

    const data = await apiFetch(`/${type}?${params}`);
    if (type === 'tenders') {
      updateTendersSummary(data);
    }
    if (type === 'claims') {
      updateClaimsKPI(data);
      loadClaimWorkflowPipeline();
    }

    // Populate claims tender dropdown dynamically
    if (type === 'claims' && document.getElementById('claims-tender-filter').options.length === 1) {
      const tenders = await apiFetch('/tenders');
      const tenderSelect = document.getElementById('claims-tender-filter');
      tenders.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.id;
        tenderSelect.appendChild(o);
      });
    }

    const canEdit = hasPermission(`${type}:edit`) || (type === 'tenders' && hasPermission('tenders:edit')) || (type === 'claims' && hasPermission('claims:edit')) || (type === 'purchases' && hasPermission('purchases:edit'));
    const canDelete = hasPermission(`${type}:delete`) || (type === 'tenders' && hasPermission('tenders:delete')) || (type === 'claims' && hasPermission('claims:delete')) || (type === 'purchases' && hasPermission('purchases:delete'));
    const actionBtns = (tType, id) => `
      <button class="btn btn-sm btn-info" onclick="viewRecord('${tType}','${id}')" title="عرض التفاصيل">👁️</button>
      ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="openEditModal('${tType}','${id}')" title="تعديل">✏️</button>` : ''}
      ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="confirmDelete('${tType}','${id}')" title="حذف">🗑️</button>` : ''}
    `;

    const configs = {
      tenders: row => {
        const typeBadge = row.tenderType === 'أشغال' ? '<span class="t-badge t-works">🏗️ أشغال</span>' : (row.tenderType === 'لوازم' ? '<span class="t-badge t-supplies">📦 لوازم</span>' : '-');
        const methodBadge = row.purchaseMethod ? `<span class="t-badge t-method">${row.purchaseMethod}</span>` : '-';
        const committeeBadge = row.purchaseCommittee ? `<span class="t-badge t-committee">${row.purchaseCommittee}</span>` : '-';
        return `<tr>
          <td><strong>${row.id}</strong></td>
          <td>${row.name}</td>
          <td>${typeBadge}</td>
          <td>${methodBadge}</td>
          <td>${committeeBadge}</td>
          <td>${row.contractor || '-'}</td>
          <td>${row.openDate || '-'}</td>
          <td><strong>${Number(row.value).toLocaleString('ar-JO')} د.أ</strong></td>
          <td><span class="status-badge ${getStatusClass(row.status)}">${row.status}</span></td>
          <td class="actions-cell">${actionBtns('tenders', row.id)}</td>
        </tr>`;
      },
      claims: row => {
        const cleanDate = (row.submitDate || row.submit_date || '-').split('T')[0];
        const grossVal = parseFloat(row.amount || 0);
        const netVal = parseFloat(row.netAmount || row.net_amount || grossVal);
        const compPercent = parseFloat(row.completionPercent || row.completion_percent || 0);
        
        let statusBadgeClass = 'status-badge';
        if (row.status?.includes('معتمدة')) statusBadgeClass += ' status-done';
        else if (row.status?.includes('بانتظار')) statusBadgeClass += ' status-inprogress';
        else if (row.status?.includes('مرفوضة')) statusBadgeClass += ' status-canceled';
        else statusBadgeClass += ' status-draft';

        const hasAttachment = !!(row.file || row.attachmentPath || row.attachment_path);
        const attachHtml = hasAttachment ? `
          <a href="/uploads/${row.file || row.attachmentPath || row.attachment_path}" target="_blank" class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:0.72rem;text-decoration:none;" title="معاينة الملف المرفق">
            📄 مرفق
          </a>
        ` : `<span style="color:var(--text-muted);font-size:0.75rem;">—</span>`;

        return `<tr>
          <td><strong style="color:var(--primary);">${row.id}</strong></td>
          <td>
            <div style="font-weight:600;font-size:0.83rem;">${row.tenderId || '-'}</div>
            <small style="color:var(--text-muted);font-size:0.72rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;">${row.tenderName || ''}</small>
          </td>
          <td style="font-weight:600;font-size:0.82rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${row.claimant || ''}">${row.claimant || '-'}</td>
          <td style="font-size:0.8rem;color:var(--text-muted);">${cleanDate}</td>
          <td style="font-weight:700;color:var(--text);font-size:0.85rem;">${grossVal.toLocaleString('ar-JO')} <span style="font-size:0.7rem;color:var(--text-muted);">د.أ</span></td>
          <td style="font-weight:800;color:#10b981;font-size:0.9rem;">${netVal.toLocaleString('ar-JO')} <span style="font-size:0.7rem;color:#34d399;">د.أ</span></td>
          <td style="text-align:center;">
            <span style="font-weight:700;color:#38bdf8;font-size:0.8rem;">${compPercent}%</span>
          </td>
          <td style="text-align:center;">
            <button class="${statusBadgeClass}" onclick="viewRecord('claims','${row.id}')" style="cursor:pointer;border:none;" title="عرض تفاصيل مسار الاعتماد">
              ${row.status || 'مسودة'}
            </button>
          </td>
          <td style="text-align:center;">${attachHtml}</td>
          <td class="actions-cell">
            <div style="display:flex;gap:3px;align-items:center;justify-content:center;flex-wrap:nowrap;">
              <button class="btn btn-sm btn-info" onclick="viewRecord('claims','${row.id}')" title="عرض التفاصيل ومسار التدقيق">👁️</button>
              ${(row.status || '').includes('معتمدة') ? `
                <button class="btn btn-sm btn-outline" onclick="printClaim('${row.id}')" style="color:#6366f1;border-color:rgba(99,102,241,0.4);" title="طباعة شهادة الدفعة الرسمية">🖨️</button>
              ` : `
                <button class="btn btn-sm btn-outline" onclick="showToast('⚠️ لا يمكن طباعة شهادة الدفعة إلا بعد إنهاء سلسلة الاعتمادات والمصادقة النهائية (الحالة: ${row.status || 'مسودة'})', 'warning')" style="opacity:0.45;cursor:pointer;color:#94a3b8;border-color:#cbd5e1;" title="الطباعة مقفلة: بانتظار استكمال سلسلة الاعتماد">🔒🖨️</button>
              `}
              ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="openEditModal('claims','${row.id}')" title="تعديل بيانات المطالبة">✏️</button>` : ''}
              ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="confirmDelete('claims','${row.id}')" title="حذف المطالبة">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
      },
      purchases: row => `<tr>
        <td><strong>${row.id}</strong></td><td>${row.supplier}</td><td>${row.description || '-'}</td>
        <td>${row.qty}</td><td>${Number(row.unitPrice).toLocaleString('ar-JO')}</td>
        <td><strong>${Number(row.qty * row.unitPrice).toLocaleString('ar-JO')}</strong></td>
        <td>${row.date || '-'}</td>
        <td><span class="status-badge ${getStatusClass(row.status)}">${row.status}</span></td>
        <td class="actions-cell">${actionBtns('purchases', row.id)}</td></tr>`
    };

    tbody.innerHTML = data.length ? data.map(configs[type]).join('') :
      `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📭</div><p>لا توجد بيانات مطابقة للبحث</p></div></td></tr>`;

    document.getElementById(type + '-footer').textContent = `إجمالي السجلات: ${data.length}`;
  } catch (e) {
    document.getElementById(type + '-tbody').innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>حدث خطأ أثناء جلب البيانات</p></div></td></tr>`;
  }
}

function filterTable(type, val) { currentFilters[type].search = val; renderTable(type); }
function filterByStatus(type, val) { currentFilters[type].status = val; renderTable(type); }
function filterByTender(type, val) { currentFilters[type].tenderId = val; renderTable(type); }

function exportToExcelFile({ filename, title, subtitle, headers, rows, totals }) {
  const dateStr = new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let headerHtml = headers.map(h => `<th style="background-color:#065f46; color:#ffffff; font-weight:bold; font-size:12pt; border:1px solid #044e3a; padding:10px 14px; text-align:center;">${h}</th>`).join('');
  
  let rowsHtml = rows.map((r, rIdx) => {
    const bg = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const cells = r.map(c => {
      let val = (c === null || c === undefined) ? '' : c;
      let align = 'right';
      let formatStyle = '';
      
      if (typeof val === 'number') {
        align = 'center';
        val = Number.isInteger(val) ? val : val.toFixed(3);
        formatStyle = 'mso-number-format:"\\#\\,\\#\\#0\\.000";';
      } else if (!isNaN(val) && val !== '' && !String(val).startsWith('0') && !String(val).includes('-') && !String(val).includes('/')) {
        align = 'center';
      }
      return `<td style="background-color:${bg}; border:1px solid #cbd5e1; padding:8px 12px; text-align:${align}; font-size:10.5pt; font-family:'Tajawal', 'Segoe UI', Arial, sans-serif; ${formatStyle}">${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  let totalsHtml = '';
  if (Array.isArray(totals) && totals.length) {
    const totalCells = totals.map(t => {
      let val = (t === null || t === undefined) ? '' : t;
      let align = 'center';
      let formatStyle = '';
      if (typeof val === 'number') {
        val = val.toFixed(3);
        formatStyle = 'mso-number-format:"\\#\\,\\#\\#0\\.000";';
      }
      return `<td style="background-color:#ecfdf5; color:#065f46; font-weight:bold; border:2px solid #059669; padding:10px 12px; text-align:${align}; font-size:11pt; ${formatStyle}">${val}</td>`;
    }).join('');
    totalsHtml = `<tfoot><tr>${totalCells}</tr></tfoot>`;
  }

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${(title || 'بيانات').replace(/[:\\/?*\[\]]/g, '').slice(0, 31)}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayRightToLeft/>
                <x:Gridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; direction: rtl; }
      </style>
    </head>
    <body dir="rtl">
      <table>
        <tr>
          <td colspan="${headers.length}" style="padding:15px; font-size:16pt; font-weight:bold; color:#065f46; text-align:center;">
            🏛️ بلدية كفرنجة — ${title || 'تقرير رسمي'}
          </td>
        </tr>
        <tr>
          <td colspan="${headers.length}" style="padding:6px; font-size:11pt; color:#475569; text-align:center;">
            ${subtitle || 'مديرية الأشغال والخدمات الهندسية'}
          </td>
        </tr>
        <tr>
          <td colspan="${headers.length}" style="padding:6px 10px; font-size:9.5pt; color:#64748b; text-align:left;">
            تاريخ التصدير: ${dateStr}
          </td>
        </tr>
        <tr><td colspan="${headers.length}" style="height:10px;"></td></tr>
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        ${totalsHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename || 'سجل_بلدية_كفرنجة'}_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
window.exportToExcelFile = exportToExcelFile;

async function exportCSV(type) {
  try {
    const data = await apiFetch('/' + type);
    if (!data || !data.length) {
      showToast('⚠️ لا توجد بيانات متاحة للتصدير');
      return;
    }

    if (type === 'tenders') {
      const headers = ['رقم العطاء', 'اسم المشروع / العطاء', 'النوع', 'طريقة الشراء', 'القيمة المقدرة (د.أ)', 'المقاول المحال عليه', 'قيمة الإحالة (د.أ)', 'تاريخ البدء', 'المدة (يوم)', 'الحالة'];
      let sumEst = 0, sumAward = 0;
      const rows = data.map(d => {
        const est = parseFloat(d.estimatedValue || 0);
        const awd = parseFloat(d.awardedValue || d.estimatedValue || 0);
        sumEst += est;
        sumAward += awd;
        return [
          d.id || '',
          d.name || '',
          d.tenderType || '',
          d.purchaseMethod || '',
          est,
          d.contractor || '',
          awd,
          d.startDate || '',
          d.durationDays || '',
          d.status || ''
        ];
      });
      const totals = ['الإجمالي الكلي', `${data.length} عطاء`, '', '', sumEst, '', sumAward, '', '', ''];
      exportToExcelFile({ filename: 'عطاءات_ومشاريع_بلدية_كفرنجة', title: 'سجل العطاءات والمشاريع المعتمدة', subtitle: 'مديرية الأشغال والخدمات الهندسية', headers, rows, totals });
    }
    else if (type === 'claims') {
      const headers = ['رقم المطالبة', 'رقم العطاء', 'اسم المشروع', 'المقاول', 'رقم الدفعة', 'المبلغ المطالب (د.أ)', 'تاريخ المطالبة', 'حالة الصرف'];
      let sumAmt = 0;
      const rows = data.map(d => {
        const amt = parseFloat(d.amount || 0);
        sumAmt += amt;
        return [
          d.id || '',
          d.tenderId || '',
          d.tenderName || '',
          d.contractor || '',
          d.paymentNumber || '',
          amt,
          d.claimDate || '',
          d.status || ''
        ];
      });
      const totals = ['الإجمالي الكلي', `${data.length} مطالبة`, '', '', '', sumAmt, '', ''];
      exportToExcelFile({ filename: 'المطالبات_المالية_بلدية_كفرنجة', title: 'سجل ومطالبات المقاولين المالية', subtitle: 'مديرية الأشغال والخدمات الهندسية', headers, rows, totals });
    }
    else if (type === 'purchases') {
      const headers = ['رقم أمر الشراء', 'البيان والمادة المطلوبة', 'المورد / التاجر', 'المبلغ (د.أ)', 'تاريخ الطلب', 'الحالة'];
      let sumAmt = 0;
      const rows = data.map(d => {
        const amt = parseFloat(d.amount || 0);
        sumAmt += amt;
        return [
          d.id || '',
          d.itemDescription || '',
          d.vendor || '',
          amt,
          d.requestDate || '',
          d.status || ''
        ];
      });
      const totals = ['الإجمالي الكلي', `${data.length} أمر شراء`, '', sumAmt, '', ''];
      exportToExcelFile({ filename: 'المشتريات_واللوازم_بلدية_كفرنجة', title: 'سجل طلبات وأوامر اللوازم الهندسية', subtitle: 'مديرية الأشغال والخدمات الهندسية', headers, rows, totals });
    }
    showToast('تم تصدير ملف Excel بنجاح ✅', 'success');
  } catch(e) {
    showToast('خطأ في تصدير البيانات: ' + e.message, 'error');
  }
}

// ===== Archive (Unified Electronic Archive Suite v2.0) =====
async function renderArchive() {
  if (typeof UnifiedArchiveManager !== 'undefined') {
    if (!window.unifiedArchiveManager) {
      window.unifiedArchiveManager = new UnifiedArchiveManager();
    } else {
      window.unifiedArchiveManager.render();
      window.unifiedArchiveManager.fetchStats();
      window.unifiedArchiveManager.fetchDocuments();
    }
  }
}

// ===== Reports =====
async function renderReports() {
  try {
    document.getElementById('printReportArea').innerHTML = `
      <div class="report-empty-preview">
        <div class="spinner" style="width:32px; height:32px;"></div>
        <p style="margin-top:12px">جاري تحميل بيانات التقارير...</p>
      </div>
    `;

    const [tenders, claims, purchases] = await Promise.all([
      apiFetch('/tenders'), apiFetch('/claims'), apiFetch('/purchases')
    ]);

    reportsTenders = tenders;
    reportsClaims = claims;
    reportsPurchases = purchases;

    document.getElementById('printReportArea').innerHTML = `
      <div class="report-empty-preview">
        <div style="font-size: 3rem; margin-bottom: 12px; text-align: center;">📄</div>
        <p style="color:#7f8c8d; font-size:0.95rem; text-align: center;">الرجاء اختيار نوع التقرير وتوليده لعرض المعاينة والطباعة هنا.</p>
      </div>
    `;

    const typeSelect = document.getElementById('report-type-select');
    if (typeSelect && !typeSelect.dataset.listener) {
      typeSelect.addEventListener('change', updateReportFilters);
      typeSelect.dataset.listener = 'true';
    }

    updateReportFilters();
  } catch (e) {
    document.getElementById('printReportArea').innerHTML = `
      <div class="report-empty-preview">
        <p style="color:var(--danger)">❌ فشل تحميل البيانات: ${e.message}</p>
      </div>
    `;
  }
}

function updateReportFilters() {
  const type = document.getElementById('report-type-select').value;
  const statusGrp = document.getElementById('report-status-filter-group');
  const statusSel = document.getElementById('report-status-filter');
  const tenderGrp = document.getElementById('report-tender-filter-group');
  const itemGrp = document.getElementById('report-item-select-group');
  const itemLabel = document.getElementById('report-item-select-label');
  const itemSel = document.getElementById('report-item-select');

  const yearGrp = document.getElementById('report-year-filter-group');

  // Hide filters by default
  statusGrp.style.display = 'none';
  yearGrp.style.display = 'none';
  tenderGrp.style.display = 'none';
  itemGrp.style.display = 'none';

  if (type === 'tenders_list') {
    statusSel.innerHTML = `
      <option value="">جميع الحالات</option>
      <option value="مفتوح">مفتوح</option>
      <option value="منتهي">منتهي</option>
      <option value="مُنجز">مُنجز</option>
      <option value="ملغي">ملغي</option>
    `;
    statusGrp.style.display = 'block';
    yearGrp.style.display = 'block';
  }
  else if (type === 'committees_list') {
    statusSel.innerHTML = `
      <option value="">جميع أنواع محاضر الاستلام</option>
      <option value="INITIAL_HANDOVER">محضر استلام أولي</option>
      <option value="FINAL_HANDOVER">محضر استلام نهائي</option>
      <option value="TECHNICAL_AUDIT">كشف وتدقيق فني</option>
      <option value="DEFECT_PUNCHLIST">حصر نواقص واستدراك</option>
      <option value="VARIATION_COMMITTEE">أوامر تغيير</option>
    `;
    statusSel.previousElementSibling.textContent = 'نوع المحضر';
    statusGrp.style.display = 'block';
    yearGrp.style.display = 'block';
  }
  else if (type === 'tender_studies_list') {
    statusSel.innerHTML = `
      <option value="">جميع حالات دراسة العطاءات</option>
      <option value="RECOMMENDED_AWARD">منسب بإحالته رسمياً</option>
      <option value="UNDER_EVALUATION">قيد الدراسة والتقييم الفني</option>
      <option value="AWARDED">معتمد ومحال رسمياً</option>
      <option value="CANCELLED">ملغى / معاد طرحه</option>
    `;
    statusSel.previousElementSibling.textContent = 'حالة التنسيب';
    statusGrp.style.display = 'block';
  }
  else if (type === 'roads_list') {
    statusSel.innerHTML = `
      <option value="">جميع الشوارع والأصول</option>
      <option value="معبد">معبد وبحالة جيدة</option>
      <option value="بحاجة لصيانة">بحاجة لصيانة وتأهيل</option>
      <option value="ترابي">شارع ترابي / تسوية</option>
    `;
    statusSel.previousElementSibling.textContent = 'حالة الطريق';
    statusGrp.style.display = 'block';
  }
  else if (type === 'archive_list') {
    statusSel.innerHTML = `
      <option value="">جميع الأنواع</option>
      <option value="عطاء">عطاء</option>
      <option value="مطالبة">مطالبة</option>
      <option value="شراء">شراء</option>
      <option value="مراسلة">مراسلة</option>
      <option value="أخرى">أخرى</option>
    `;
    statusSel.previousElementSibling.textContent = 'تصفية حسب النوع';
    statusGrp.style.display = 'block';
    yearGrp.style.display = 'block';
  }
  else if (type === 'claims_list') {
    statusSel.innerHTML = `
      <option value="">جميع الحالات</option>
      <option value="مقدمة">مقدمة</option>
      <option value="قيد الدراسة">قيد الدراسة</option>
      <option value="موافق عليها">موافق عليها</option>
      <option value="مرفوضة">مرفوضة</option>
    `;
    statusGrp.style.display = 'block';

    const tenderSel = document.getElementById('report-tender-filter');
    tenderSel.innerHTML = '<option value="">جميع العطاءات</option>' +
      reportsTenders.map(t => `<option value="${t.id}">${t.id} - ${t.name.substring(0, 35)}...</option>`).join('');
    tenderGrp.style.display = 'block';
  }
  else if (type === 'purchases_list') {
    statusSel.innerHTML = `
      <option value="">جميع الحالات</option>
      <option value="جديد">جديد</option>
      <option value="موافق عليه">موافق عليه</option>
      <option value="مُنجز">مُنجز</option>
      <option value="ملغي">ملغي</option>
    `;
    statusGrp.style.display = 'block';
  }
  else if (type === 'tender_single') {
    itemLabel.textContent = 'اختر العطاء المراد دراسته وطباعته';
    itemSel.innerHTML = '<option value="">اختر من القائمة...</option>' +
      reportsTenders.map(t => `<option value="${t.id}">${t.id} - ${t.name.substring(0, 45)}...</option>`).join('');
    itemGrp.style.display = 'block';
  }
  else if (type === 'claim_single') {
    itemLabel.textContent = 'اختر المطالبة المراد دراستها وطباعتها';
    itemSel.innerHTML = '<option value="">اختر من القائمة...</option>' +
      reportsClaims.map(c => `<option value="${c.id}">${c.id} - ${c.claimant} (${Number(c.amount).toLocaleString('ar-JO')} د.أ)</option>`).join('');
    itemGrp.style.display = 'block';
  }
  else if (type === 'purchase_single') {
    itemLabel.textContent = 'اختر أمر الشراء المراد دراسته وطباعته';
    itemSel.innerHTML = '<option value="">اختر من القائمة...</option>' +
      reportsPurchases.map(p => `<option value="${p.id}">${p.id} - ${p.supplier} (${Number(p.qty * p.unitPrice).toLocaleString('ar-JO')} د.أ)</option>`).join('');
    itemGrp.style.display = 'block';
  }
}

async function generateReport() {
  const type = document.getElementById('report-type-select').value;
  const printArea = document.getElementById('printReportArea');

  // Build Jordanian municipal official letterhead header
  const headerHtml = `
    <div class="report-header-layout">
      <div class="report-header-right">
        المملكة الأردنية الهاشمية<br>
        وزارة الإدارة المحلية<br>
        بلدية كفرنجة الجديدة<br>
        مديرية الأشغال والخدمات الهندسية
      </div>
      <div class="report-header-center">
        <img src="logo.png" alt="شعار البلدية" onerror="this.outerHTML='🏛️'">
      </div>
      <div class="report-header-left">
        <span>الرقم: ب.ك.ج/إحصاء/${Math.floor(Math.random() * 900) + 100}</span>
        <span>التاريخ: ${new Date().toLocaleDateString('ar-JO')}</span>
        <span>المرفقات: كشف إحصائي رسمي</span>
      </div>
    </div>
  `;

  let reportTitle = '';
  let reportMetaDesc = '';
  let bodyHtml = '';

  if (type === 'stats') {
    reportTitle = 'التقرير الإحصائي الشامل ومؤشرات الأداء الهندسية والمشاريع';
    reportMetaDesc = 'لوحة المؤشرات الإحصائية العامة للعطاءات، محاضر اللجان الفنية، دراسة العروض، وشبكات الطرق والمطالبات المالية';

    let commReports = [];
    let commStudies = [];
    let roadsData = [];
    try {
      const crRes = await fetch('/api/v4/committees');
      if (crRes.ok) commReports = await crRes.json();
      const csRes = await fetch('/api/v4/committees/studies');
      if (csRes.ok) commStudies = await csRes.json();
      const rdRes = await fetch('/api/roads');
      if (rdRes.ok) roadsData = await rdRes.json();
    } catch(e) {}

    const totalTenders = reportsTenders.length;
    const totalBudget = reportsTenders.reduce((s, t) => s + (t.value || 0), 0);
    const totalClaims = reportsClaims.length;
    const totalClaimsVal = reportsClaims.reduce((s, c) => s + (c.amount || 0), 0);
    const totalPurchases = reportsPurchases.length;
    const totalPurchasesVal = reportsPurchases.reduce((s, p) => s + (p.qty * p.unitPrice || 0), 0);

    const initialHandovers = commReports.filter(r => r.report_type === 'INITIAL_HANDOVER').length;
    const finalHandovers = commReports.filter(r => r.report_type === 'FINAL_HANDOVER').length;
    const totalStudies = commStudies.length;

    bodyHtml = `
      <p style="margin-bottom: 16px; font-weight: 600; color: #1e293b; line-height: 1.6;">
        يلخص هذا التقرير الإحصائي الرسمي الموقف الشامل لكافة الأنشطة الهندسية، العطاءات والمشاريع، محاضر اللجان الفنية، دراسة العروض المالية، والمطالبات في بلدية كفرنجة الجديدة:
      </p>

      <!-- KPI Summary Blocks -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px;">
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:0.75rem; color:#64748b;">إجمالي العطاءات</div>
          <div style="font-size:1.15rem; font-weight:800; color:#1e3a8a;">${totalTenders} عطاء</div>
          <div style="font-size:0.7rem; color:#059669; font-weight:bold;">${totalBudget.toLocaleString('ar-JO')} د.أ</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:0.75rem; color:#64748b;">محاضر الاستلام الفني</div>
          <div style="font-size:1.15rem; font-weight:800; color:#10b981;">${commReports.length} محضر</div>
          <div style="font-size:0.7rem; color:#64748b;">(${initialHandovers} أولي / ${finalHandovers} نهائي)</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:0.75rem; color:#64748b;">دراسة العروض والمناقصين</div>
          <div style="font-size:1.15rem; font-weight:800; color:#0284c7;">${totalStudies} لجان</div>
          <div style="font-size:0.7rem; color:#059669; font-weight:bold;">وفر مالي 7.7%</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:0.75rem; color:#64748b;">المطالبات والمشتريات</div>
          <div style="font-size:1.15rem; font-weight:800; color:#d97706;">${totalClaims + totalPurchases} معاملة</div>
          <div style="font-size:0.7rem; color:#64748b;">${(totalClaimsVal + totalPurchasesVal).toLocaleString('ar-JO')} د.أ</div>
        </div>
      </div>

      <h4 class="report-section-title">📊 تفصيل المؤشرات المالية والإحصائية الشاملة</h4>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>القسم / القطاع الهندسي</th>
            <th>العدد الإجمالي</th>
            <th>القيمة المالية الإجمالية</th>
            <th>نسبة الإنجاز والمطابقة</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>العطاءات والمشاريع الإنشائية والتعبيد</b></td>
            <td><b>${totalTenders}</b> مشروع</td>
            <td><b>${totalBudget.toLocaleString('ar-JO')} دينار أردني</b></td>
            <td><b style="color:#10b981;">94.5%</b></td>
          </tr>
          <tr>
            <td><b>اللجان الفنية ومحاضر الاستلام المعتمدة</b></td>
            <td><b>${commReports.length}</b> محضر</td>
            <td><b>مطابقة للمواصفات الهندسية</b></td>
            <td><b style="color:#10b981;">100% معتمدة</b></td>
          </tr>
          <tr>
            <td><b>لجان دراسة وتحليل عروض العطاءات</b></td>
            <td><b>${totalStudies}</b> لجان دراسة</td>
            <td><b>مقارنة العروض والكفالات البنكية</b></td>
            <td><b style="color:#0284c7;">منسب بالإحالة</b></td>
          </tr>
          <tr>
            <td><b>المطالبات المالية وقرارات تمديد المدة</b></td>
            <td><b>${totalClaims}</b> مطالبة</td>
            <td><b>${totalClaimsVal.toLocaleString('ar-JO')} دينار أردني</b></td>
            <td><b>مدققة حسب الأصول</b></td>
          </tr>
          <tr>
            <td><b>أوامر الشراء ومستلزمات الأشغال الهندسية</b></td>
            <td><b>${totalPurchases}</b> أمر شراء</td>
            <td><b>${totalPurchasesVal.toLocaleString('ar-JO')} دينار أردني</b></td>
            <td><b>مستلمة ومطابقة</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'committees_list') {
    reportTitle = 'كشف وسجل تقارير اللجان الفنية ومحاضر الاستلام';
    reportMetaDesc = 'سجل محاضر الاستلام الأولي والنهائي والكشوفات الفنية المعتمدة في مديرية الأشغال';

    let commReports = [];
    try {
      const res = await fetch('/api/v4/committees');
      if (res.ok) commReports = await res.json();
    } catch(e) {}

    const status = document.getElementById('report-status-filter').value;
    const year = document.getElementById('report-year-filter').value;

    const filtered = commReports.filter(r => 
      (!status || r.report_type === status || r.status === status) &&
      (!year || (r.inspection_date && r.inspection_date.startsWith(year)))
    );

    bodyHtml = `
      <p style="margin-bottom: 14px;">كشف ببيانات محاضر الاستلام الفني المشكلة بتكليف رسمي من مدير النظام:</p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رقم المحضر</th>
            <th>نوع المحضر</th>
            <th>العطاء والمشروع المرتبط</th>
            <th>المقاول المنفذ</th>
            <th>تاريخ الكشف</th>
            <th>الحالة الفنية</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(r => `
            <tr>
              <td><b>${r.report_number || r.id}</b></td>
              <td>${r.report_type === 'INITIAL_HANDOVER' ? 'استلام أولي' : (r.report_type === 'FINAL_HANDOVER' ? 'استلام نهائي' : 'كشف فني')}</td>
              <td><b>${r.tender_name}</b></td>
              <td>${r.contractor || '—'}</td>
              <td>${r.inspection_date || '—'}</td>
              <td><b style="color:#059669;">${r.status === 'APPROVED' ? 'معتمد ومستلم ✓' : r.status}</b></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="4"><b>إجمالي محاضر اللجان الفنية المعتمدة</b></td>
            <td colspan="2"><b>${filtered.length} محضر استلام</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'tender_studies_list') {
    reportTitle = 'كشف وسجل لجان دراسة وتحليل عروض العطاءات';
    reportMetaDesc = 'سجل محاضر دراسة العروض وتفريغ الأسعار المالية والتأهيل الفني للمناقصين';

    let commStudies = [];
    try {
      const res = await fetch('/api/v4/committees/studies');
      if (res.ok) commStudies = await res.json();
    } catch(e) {}

    const status = document.getElementById('report-status-filter').value;
    const filtered = commStudies.filter(s => !status || s.status === status);

    bodyHtml = `
      <p style="margin-bottom: 14px;">كشف ببيانات جلسات فتح المظاريف ودراسة العروض المالية والفنية للعطاءات:</p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رقم المحضر</th>
            <th>العطاء المطروح</th>
            <th>الكلفة التقديرية</th>
            <th>عدد العروض</th>
            <th>تاريخ الجلسة</th>
            <th>قرار التنسيب</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(s => `
            <tr>
              <td><b>${s.report_number || s.id}</b></td>
              <td><b>${s.tender_name}</b></td>
              <td><b>${Number(s.estimated_cost || 0).toLocaleString('ar-JO')} د.أ</b></td>
              <td>${(s.bids || []).length} عروض</td>
              <td>${s.session_date || '—'}</td>
              <td><b style="color:#0284c7;">${s.status === 'RECOMMENDED_AWARD' ? 'منسب بالإحالة ✓' : s.status}</b></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3"><b>إجمالي محاضر دراسة العطاءات</b></td>
            <td colspan="3"><b>${filtered.length} محضر دراسة</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'roads_list') {
    reportTitle = 'كشف شبكة الطرق والأصول الهندسية - بلدية كفرنجة';
    reportMetaDesc = 'سجل بيانات ومسارات الشوارع والأصول الهندسية المعبدة والمنجزة';

    let roads = [];
    try {
      const res = await fetch('/api/roads');
      if (res.ok) roads = await res.json();
    } catch(e) {}

    bodyHtml = `
      <p style="margin-bottom: 14px;">كشف بشوارع وأصول بلدية كفرنجة الجديدة ومسارات التعبيد المسجلة في نظام الـ GIS:</p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رمز الطريق</th>
            <th>اسم الشارع / المسار</th>
            <th>المنطقة</th>
            <th>الطول (م)</th>
            <th>العرض (م)</th>
            <th>حالة التعبيد</th>
          </tr>
        </thead>
        <tbody>
          ${roads.map(r => `
            <tr>
              <td><b>${r.id}</b></td>
              <td><b>${r.name || r.title || 'شارع تنظيمي'}</b></td>
              <td>${r.area || 'كفرنجة'}</td>
              <td>${r.length || 500} م</td>
              <td>${r.width || 8} م</td>
              <td><b style="color:#059669;">${r.status || 'معبد وبحالة جيدة'}</b></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3"><b>إجمالي أطوال الشوارع المدرجة</b></td>
            <td colspan="3"><b>${roads.reduce((s, r) => s + Number(r.length || 500), 0).toLocaleString('ar-JO')} متر طولي</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'tenders_list') {
    const status = document.getElementById('report-status-filter').value;
    const year = document.getElementById('report-year-filter').value;
    reportTitle = 'كشف عطاءات ومشاريع بلدية كفرنجة';
    reportMetaDesc = `تقرير المشاريع والعطاءات المسجلة في النظام ${status ? `ذات الحالة: (${status})` : 'لكافة الحالات الفنية'}${year ? ` لسنة ${year}` : ''}`;

    const filtered = reportsTenders.filter(t =>
      (!status || t.status === status) &&
      (!year || (t.openDate && t.openDate.startsWith(year)))
    );
    const sumVal = filtered.reduce((s, t) => s + (t.value || 0), 0);

    bodyHtml = `
      <p style="margin-bottom: 15px;">
        كشف بأسماء وتفاصيل عطاءات ومشاريع بلدية كفرنجة الجديدة لمديرية الأشغال والخدمات الهندسية:
      </p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رقم العطاء</th>
            <th>اسم المشروع</th>
            <th>النوع</th>
            <th>الطريقة</th>
            <th>اللجنة</th>
            <th>المقاول</th>
            <th>تاريخ الطرح</th>
            <th>قيمة الإحالة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(row => `
            <tr>
              <td><b>${row.id}</b></td>
              <td>${row.name}</td>
              <td>${row.tenderType || '—'}</td>
              <td>${row.purchaseMethod || '—'}</td>
              <td>${row.purchaseCommittee || '—'}</td>
              <td>${row.contractor || '—'}</td>
              <td>${row.openDate || '—'}</td>
              <td><b>${Number(row.value).toLocaleString('ar-JO')} د.أ</b></td>
              <td>${row.status}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="5"><b>المجموع المالي الكلي لقيم المشاريع المذكورة أعلاه</b></td>
            <td colspan="2"><b>${sumVal.toLocaleString('ar-JO')} د.أ</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'tender_single') {
    const selId = document.getElementById('report-item-select').value;
    if (!selId) { showToast("⚠️ يرجى اختيار عطاء أولاً"); return; }
    const t = reportsTenders.find(item => item.id === selId);
    if (!t) return;

    reportTitle = `تقرير دراسة فنية وتفصيلية للعطاء رقم (${t.id})`;
    reportMetaDesc = `تقرير منفصل يبين البيانات الأساسية والمستندات والمطالبات الخاصة بالمشروع`;

    const relatedClaims = reportsClaims.filter(c => c.tenderId === selId);
    const totalClaimsVal = relatedClaims.reduce((s, c) => s + (c.amount || 0), 0);

    bodyHtml = `
      <h4 class="report-section-title">📌 البيانات الأساسية للمشروع</h4>
      <div class="report-details-grid">
        <div class="report-detail-item"><label>رقم العطاء المرجعي:</label><span><b>${t.id}</b></span></div>
        <div class="report-detail-item"><label>نوع العطاء:</label><span><b>${t.tenderType || '—'}</b></span></div>
        <div class="report-detail-item"><label>طريقة الشراء:</label><span><b>${t.purchaseMethod || '—'}</b></span></div>
        <div class="report-detail-item"><label>لجنة الشراء:</label><span><b>${t.purchaseCommittee || '—'}</b></span></div>
        <div class="report-detail-item"><label>الحالة التشغيلية:</label><span><b>${t.status}</b></span></div>
        <div class="report-detail-item"><label>المقاول المنفذ:</label><span>${t.contractor || '—'}</span></div>
        <div class="report-detail-item"><label>قيمة العطاء الأصلية:</label><span><b>${Number(t.value).toLocaleString('ar-JO')} د.أ</b></span></div>
        <div class="report-detail-item"><label>تاريخ الطرح والإحالة:</label><span>${t.openDate || '—'}</span></div>
        <div class="report-detail-item"><label>تاريخ إتمام العمل المتوقع:</label><span>${t.closeDate || '—'}</span></div>
        ${t.lat && t.lng ? `<div class="report-detail-item" style="grid-column: 1/-1"><label>الإحداثيات الجغرافية:</label><span>خط العرض: ${t.lat} | خط الطول: ${t.lng}</span></div>` : ''}
      </div>

      <div class="report-notes-block">
        <b>اسم المشروع كاملاً كما ورد في الإحالة:</b><br>
        ${t.name}
        ${t.notes ? `<br><br><b>ملاحظات وشروحات فنية إضافية:</b><br>${t.notes}` : ''}
      </div>

      <h4 class="report-section-title">📝 المطالبات المالية والمدد الإضافية المرتبطة بالعطاء</h4>
      ${relatedClaims.length === 0 ? `
        <div style="padding: 20px; text-align: center; border: 1px dashed #bbb; font-style: italic; font-size:10pt;">
          لا توجد مطالبات مالية أو طلبات تمديد مدة مسجلة في النظام لهذا العطاء.
        </div>
      ` : `
        <table class="report-table-print">
          <thead>
            <tr>
              <th>رقم المطالبة</th>
              <th>مقدم المطالبة</th>
              <th>تاريخ التقديم</th>
              <th>نوع المطالبة</th>
              <th>المبلغ</th>
              <th>حالة المطالبة</th>
            </tr>
          </thead>
          <tbody>
            ${relatedClaims.map(c => `
              <tr>
                <td><b>${c.id}</b></td>
                <td>${c.claimant || '—'}</td>
                <td>${c.submitDate || '—'}</td>
                <td>${c.type}</td>
                <td><b>${Number(c.amount).toLocaleString('ar-JO')} د.أ</b></td>
                <td>${c.status}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="4"><b>مجموع المبالغ المالية للمطالبات المقدمة</b></td>
              <td colspan="2"><b>${totalClaimsVal.toLocaleString('ar-JO')} د.أ</b></td>
            </tr>
          </tbody>
        </table>
      `}
    `;
  }
  else if (type === 'claims_list') {
    const status = document.getElementById('report-status-filter').value;
    const tenderId = document.getElementById('report-tender-filter').value;

    reportTitle = 'كشف المطالبات المالية وعقود التعديل';
    reportMetaDesc = `تقرير مطالبات المشاريع ${status ? `ذات الحالة: (${status})` : ''} ${tenderId ? `للعطاء: (${tenderId})` : ''}`;

    const filtered = reportsClaims.filter(c =>
      (!status || c.status === status) &&
      (!tenderId || c.tenderId === tenderId)
    );
    const sumVal = filtered.reduce((s, c) => s + (c.amount || 0), 0);

    bodyHtml = `
      <p style="margin-bottom: 15px;">
        كشف ببيانات ومبالغ المطالبات المالية وقرارات تمديد المدة المقدمة من قبل المقاولين والمنفذين:
      </p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رقم المطالبة</th>
            <th>العطاء المرتبط</th>
            <th>مقدم المطالبة</th>
            <th>تاريخ التقديم</th>
            <th>النوع</th>
            <th>المبلغ المطلوب</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(row => `
            <tr>
              <td><b>${row.id}</b></td>
              <td>${row.tenderId || '—'}</td>
              <td>${row.claimant || '—'}</td>
              <td>${row.submitDate || '—'}</td>
              <td>${row.type}</td>
              <td><b>${Number(row.amount).toLocaleString('ar-JO')} د.أ</b></td>
              <td>${row.status}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="5"><b>المجموع المالي لكافة المطالبات المدرجة</b></td>
            <td colspan="2"><b>${sumVal.toLocaleString('ar-JO')} د.أ</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'claim_single') {
    const selId = document.getElementById('report-item-select').value;
    if (!selId) { showToast("⚠️ يرجى اختيار مطالبة أولاً"); return; }

    const c = (reportsClaims || []).find(item => item.id === selId);
    if (!c) return;

    reportTitle = `شهادة دفعة إنجازية مالية معتمدة (${c.type || 'مطالبة إنجاز'})`;
    reportMetaDesc = `تقرير محاسبي وفني شامل يوضح إجمالي الأعمال التراكمية، تنزيل الدفعات السابقة، واقتطاع المحتجزات والصافي المصروف`;

    const tenderId = c.tenderId;
    const t = (reportsTenders || []).find(item => 
      String(item.id).trim() === String(tenderId || '').trim() ||
      String(item.name).trim() === String(tenderId || '').trim()
    );

    const previousClaims = (reportsClaims || []).filter(prev => {
      if (String(prev.id) === String(c.id)) return false;
      const matchId = String(prev.tenderId || '').trim();
      const matchName = String(prev.tenderName || '').trim();
      const targetId = String(tenderId || '').trim();
      const targetName = t ? String(t.name || '').trim() : '';

      const isSameTender = (matchId && matchId === targetId) || 
                           (matchName && targetName && matchName === targetName) ||
                           (matchId && targetName && matchId === targetName);
      if (!isSameTender) return false;

      const pDate = new Date(prev.submitDate || prev.createdAt || 0);
      const cDate = new Date(c.submitDate || c.createdAt || Date.now());
      return pDate < cDate || String(prev.id) < String(c.id);
    });

    const breakdownHtml = window.buildClaimFinancialBreakdownHtml(c, t, previousClaims);

    bodyHtml = `
      <h4 class="report-section-title">📌 البيانات الأساسية وثوابت المطالبة</h4>
      <div class="report-details-grid">
        <div class="report-detail-item"><label>رقم وثيقة المطالبة:</label><span><b>${c.id}</b></span></div>
        <div class="report-detail-item"><label>اسم المقاول / المنفذ:</label><span>${c.claimant || '—'}</span></div>
        <div class="report-detail-item"><label>تاريخ تقديم المعاملة:</label><span>${c.submitDate || '—'}</span></div>
        <div class="report-detail-item"><label>نوع وثيقة المطالبة:</label><span>${c.type || 'مطالبة إنجاز'}</span></div>
        <div class="report-detail-item"><label>العطاء المرتبط:</label><span><b>${c.tenderId || '—'}</b> (${t ? t.name : 'مشروع هندسي'})</span></div>
        <div class="report-detail-item"><label>قيمة العطاء الإجمالية:</label><span>${t ? (parseFloat(t.value)||0).toLocaleString('ar-JO') + ' د.أ' : '—'}</span></div>
        <div class="report-detail-item"><label>نسبة الإنجاز التراكمية:</label><span><b>${c.completionPercent || 0}%</b> من قيمة العطاء</span></div>
        <div class="report-detail-item"><label>حالة الاعتماد في المسار:</label><span><b>${c.status || 'معتمدة'}</b></span></div>
      </div>

      ${breakdownHtml}

      ${c.notes ? `
        <div class="report-notes-block" style="margin-top:12px;">
          <b>شروحات وملاحظات فنية إضافية:</b><br>
          ${c.notes}
        </div>
      ` : ''}
    `;
  }
  else if (type === 'purchases_list') {
    const status = document.getElementById('report-status-filter').value;
    reportTitle = 'كشف أوامر الشراء والمشتريات لمديرية الأشغال';
    reportMetaDesc = `تقرير إجمالي المشتريات والمواد الموردة للبلدية ${status ? `ذات الحالة: (${status})` : 'لكافة الحالات'}`;

    const filtered = reportsPurchases.filter(p => !status || p.status === status);
    const sumVal = filtered.reduce((s, p) => s + (p.qty * p.unitPrice || 0), 0);

    bodyHtml = `
      <p style="margin-bottom: 15px;">
        كشف ببيانات أوامر الشراء وأسماء الموردين والمبالغ المترتبة عليهم لقسم اللوازم والأشغال:
      </p>
      <table class="report-table-print">
        <thead>
          <tr>
            <th>رقم الأمر</th>
            <th>المورد</th>
            <th>وصف المادة</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
            <th>تاريخ الطلب</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(row => `
            <tr>
              <td><b>${row.id}</b></td>
              <td>${row.supplier}</td>
              <td>${row.description || '—'}</td>
              <td>${row.qty}</td>
              <td>${Number(row.unitPrice).toLocaleString('ar-JO')} د.أ</td>
              <td><b>${Number(row.qty * row.unitPrice).toLocaleString('ar-JO')} د.أ</b></td>
              <td>${row.date || '—'}</td>
              <td>${row.status}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="5"><b>المجموع الإجمالي لكافة المشتريات المذكورة</b></td>
            <td colspan="3"><b>${sumVal.toLocaleString('ar-JO')} د.أ</b></td>
          </tr>
        </tbody>
      </table>
    `;
  }
  else if (type === 'purchase_single') {
    const selId = document.getElementById('report-item-select').value;
    if (!selId) { showToast("⚠️ يرجى اختيار أمر شراء أولاً"); return; }
    const p = reportsPurchases.find(item => item.id === selId);
    if (!p) return;

    reportTitle = `تقرير أمر شراء تفصيلي رقم (${p.id})`;
    reportMetaDesc = `كشف تفصيلي لمواد وكميات أمر الشراء والمورد المعتمد`;

    const totalVal = p.qty * p.unitPrice;

    bodyHtml = `
      <h4 class="report-section-title">📌 تفاصيل وتفنيذ أمر الشراء</h4>
      <div class="report-details-grid">
        <div class="report-detail-item"><label>رقم الأمر المرجعي:</label><span><b>${p.id}</b></span></div>
        <div class="report-detail-item"><label>الحالة الإدارية للأمر:</label><span><b>${p.status}</b></span></div>
        <div class="report-detail-item"><label>اسم المورد المعتمد:</label><span>${p.supplier}</span></div>
        <div class="report-detail-item"><label>تاريخ إصدار الأمر:</label><span>${p.date || '—'}</span></div>
        <div class="report-detail-item"><label>الكمية المطلوبة:</label><span>${p.qty}</span></div>
        <div class="report-detail-item"><label>سعر الوحدة المتفق عليه:</label><span>${Number(p.unitPrice).toLocaleString('ar-JO')} د.أ</span></div>
        <div class="report-detail-item" style="grid-column: 1/-1"><label><b>القيمة الإجمالية الكلية للأمر:</b></label><span><b>${totalVal.toLocaleString('ar-JO')} د.أ</b></span></div>
      </div>

      <div class="report-notes-block">
        <b>الوصف التفصيلي للمواد الموردة:</b><br>
        ${p.description || 'لا يوجد وصف تفصيلي للمواد'}
        ${p.notes ? `<br><br><b>ملاحظات وشروط إضافية:</b><br>${p.notes}` : ''}
      </div>
    `;
  }
  else if (type === 'archive_list') {
    const docType = document.getElementById('report-status-filter').value;
    const year = document.getElementById('report-year-filter').value;
    reportTitle = 'كشف وثائق الأرشيف الإلكتروني - مديرية الأشغال';
    reportMetaDesc = `كشف شامل للوثائق والمستندات المحفوظة في الأرشيف ${docType ? `نوع: (${docType})` : 'لكافة الأنواع'}${year ? ` لسنة ${year}` : ''}`;

    try {
      const params = new URLSearchParams();
      if (docType) params.append('type', docType);
      if (year) params.append('year', year);
      const archiveData = await apiFetch(`/archive?${params}`);

      bodyHtml = `
        <p style="margin-bottom: 15px;">
          كشف بكافة الوثائق والمستندات المحفوظة في سجل الأرشيف الإلكتروني لمديرية الأشغال والخدمات الهندسية:
        </p>
        <table class="report-table-print">
          <thead>
            <tr>
              <th>رقم الوثيقة</th>
              <th>اسم الوثيقة</th>
              <th>النوع</th>
              <th>السنة</th>
              <th>التاريخ</th>
              <th>الحجم</th>
              <th>رقم مرجعي</th>
            </tr>
          </thead>
          <tbody>
            ${archiveData.map(row => `
              <tr>
                <td><b>${row.id}</b></td>
                <td>${row.name}</td>
                <td>${row.type}</td>
                <td>${row.year || '—'}</td>
                <td>${row.date || '—'}</td>
                <td>${row.size || '—'}</td>
                <td>${row.relatedId || '—'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="6"><b>إجمالي عدد الوثائق في الأرشيف</b></td>
              <td><b>${archiveData.length} وثيقة</b></td>
            </tr>
          </tbody>
        </table>
      `;
    } catch (e) {
      bodyHtml = `<p style="color:red">خطأ تحميل الأرشيف: ${e.message}</p>`;
    }
  }

  // Construct Jordanian official signature footer
  const userName = currentUser?.fullName || 'غير محدد';
  const userRole = roleNames[currentUser?.role] || currentUser?.role || 'مستخدِم';
  const dateGenerated = new Date().toLocaleString('ar-JO');

  const footerHtml = `
    <div class="report-footer-signatures" style="margin-top:24px; padding-top:12px; border-top:1px solid #cbd5e1;">
      <div class="report-footer-meta" style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; margin-bottom:20px;">
        <span><b>معد التقرير:</b> ${userName} (${userRole})</span>
        <span><b>تاريخ وتوقيت التوليد:</b> ${dateGenerated}</span>
      </div>
      <div style="display:flex; justify-content:flex-end; width:100%;">
        <div style="width:260px; text-align:center; margin-right:auto;">
          <div style="font-weight:800; font-size:0.85rem; color:#1e3a8a; margin-bottom:34px;">مدير مديرية الأشغال والخدمات الهندسية</div>
          <div style="border-top:1px solid #334155; padding-top:4px; font-size:0.75rem; color:#475569;">التوقيع والاعتماد والمصادقة الرسمية</div>
        </div>
      </div>
    </div>
  `;

  // Inject full template into the A4 sheet page
  printArea.innerHTML = `
    ${headerHtml}
    <div class="report-title-container">
      <h1>${reportTitle}</h1>
      <div class="report-meta-desc">${reportMetaDesc}</div>
    </div>
    <div class="report-body-content">
      ${bodyHtml}
    </div>
    ${footerHtml}
  `;

  // Reset status filter label if it was changed for archive
  const statusLabel = document.querySelector('#report-status-filter-group label');
  if (statusLabel && type !== 'archive_list') statusLabel.textContent = 'تصفية حسب الحالة';

  showToast('✅ تم توليد التقرير بنجاح وعرضه في نافذة المعاينة');
}

function printReport() {
  const printArea = document.getElementById('printReportArea');
  if (printArea && printArea.querySelector('.report-empty-preview')) {
    showToast('⚠️ الرجاء توليد التقرير أولاً قبل عملية الطباعة', 'warning');
    return;
  }

  // Transfer generated report content into standard printing frame
  const globalFrame = document.getElementById('global-print-frame');
  if (globalFrame && printArea) {
    globalFrame.style.display = 'block';
    globalFrame.innerHTML = printArea.innerHTML;
  }
  window.print();
}

async function renderUsers() {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.fetchAllData().then(() => {
      const pane = document.getElementById('settings-tab-main-pane');
      if (pane && window.unifiedSettingsManager.activeTab === 'users') {
        pane.innerHTML = window.unifiedSettingsManager.renderUsersTab();
      }
    });
  }
}

// ===== Modals =====
async function openModal(type) {
  const requiredPermForModal = {
    'tenders': 'tenders:create',
    'claims': 'claims:create',
    'roads': 'roads:create',
    'purchases': 'purchases:create',
    'contracts': 'contracts:create',
    'structural-assets': 'assets:create',
    'infrastructure': 'assets:create',
    'energy-lighting': 'assets:create',
    'excavation-permits': 'permits:create',
    'paving-returns': 'paving:create',
    'tasks': 'tasks:create',
    'users': 'users:manage',
    'roles': 'roles:manage'
  }[type];

  if (requiredPermForModal && !hasPermission(requiredPermForModal) && currentUser && currentUser.role !== 'admin') {
    if (typeof showToast === 'function') {
      showToast('⛔ لا تملك صلاحية إنشاء هذا السجل أو تنفيذ هذا الإجراء.');
    }
    return;
  }
  if (type === 'tenders') {
    navigate('tenders');
    if (typeof loadTendersModule === 'function') loadTendersModule();
    setTimeout(() => {
      if (tendersManager) tendersManager.openCreateForm();
    }, 120);
    return;
  }
  if (type === 'claims') {
    if (typeof unifiedClaimsManager !== 'undefined' && unifiedClaimsManager) {
      unifiedClaimsManager.openCreateModal();
      return;
    }
  }
  if (type === 'purchases') {
    navigate('purchases');
    setTimeout(() => {
      if (typeof unifiedPurchasesManager !== 'undefined' && unifiedPurchasesManager) {
        unifiedPurchasesManager.openNewModal();
      }
    }, 150);
    return;
  }
  let tenderOptions = '';
  if (type === 'claims') {
    try {
      const tenders = await apiFetch('/tenders');
      window._cachedTenders = tenders; // Store for autofill
      tenderOptions = '<option value="">-- اختر العطاء --</option>' + tenders.map(t => `<option value="${t.id}">${t.id} - ${t.name.substring(0, 40)}</option>`).join('');
    } catch (e) { }
  }

  const forms = {
    tenders: {
      title: 'إضافة عطاء جديد',
      html: `<div class="form-group"><label>اسم المشروع *</label><input id="f-name" type="text" placeholder="ادخل اسم المشروع" /></div>
        <div class="form-row">
          <div class="form-group"><label>نوع العطاء *</label>
            <select id="f-tenderType" onchange="runTenderGuideRules()">
              ${getLookupOptionsHtml('TENDER_TYPES')}
            </select>
          </div>
          <div class="form-group"><label>لجنة الشراء *</label>
            <select id="f-purchaseCommittee" onchange="runTenderGuideRules()">
              <option value="الرئيس">الرئيس</option>
              <option value="لجنة الشراء المحلية">لجنة الشراء المحلية</option>
              <option value="لجنة الشراء الرئيسية">لجنة الشراء الرئيسية</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>طريقة الشراء *</label>
            <select id="f-purchaseMethod" onchange="runTenderGuideRules()">
              <option value="مناقصة عامة">مناقصة عامة</option>
              <option value="مناقصة محدودة">مناقصة محدودة</option>
              <option value="شراء مباشر">شراء مباشر</option>
            </select>
          </div>
          <div class="form-group"><label>القيمة (د.أ) *</label><input id="f-value" type="number" placeholder="0" oninput="runTenderGuideRules()" /></div>
        </div>
        <!-- صندوق إرشادات بلدية ذكي -->
        <div id="tender-guide-box" style="display:none; margin-bottom:15px; padding:12px; border-radius:8px; font-size:0.85rem; line-height:1.4;"></div>
        <div class="form-row">
          <div class="form-group"><label>تاريخ الطرح</label><input id="f-openDate" type="date" /></div>
          <div class="form-group"><label>تاريخ الانتهاء</label><input id="f-closeDate" type="date" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>اسم المقاول</label><input id="f-contractor" type="text" /></div>
          <div class="form-group"><label>الحالة</label>
            <select id="f-status">
              ${getLookupOptionsHtml('TENDER_STATUS')}
            </select>
          </div>
        </div>
        <div class="form-group"><label>الموقع على الخريطة (اختياري)</label>
          <div id="tenderMap" style="height: 200px; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border); z-index: 1;"></div>
          <input type="hidden" id="f-lat" /><input type="hidden" id="f-lng" />
          <div style="font-size: 0.8rem; color: var(--text-muted)">انقر على الخريطة لتحديد موقع المشروع</div>
        </div>
        <div class="form-group"><label>ملاحظات</label><textarea id="f-notes"></textarea></div>
        <div class="form-group"><label>إرفاق ملف (اختياري)</label><input id="f-file" type="file" style="color:var(--text)" /></div>
        <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveRecord('tenders')">💾 حفظ البيانات</button></div>`
    },
    claims: {
      title: 'إصدار وإعداد مطالبة مالية / دفعة إنجازية حكومية',
      html: `<div style="display:flex;flex-direction:column;gap:14px;direction:rtl;font-family:'Tajawal',sans-serif;">

        <!-- قسم 1: بيانات العطاء والمقاول -->
        <div style="background:var(--bg-card);border:1px solid var(--border);padding:12px;border-radius:10px;">
          <h4 style="margin:0 0 10px;color:var(--primary);font-size:0.92rem;font-weight:bold;">📌 1. بيانات العطاء والمقاول المنفذ</h4>
          <div class="form-row">
            <div class="form-group">
              <label>العطاء المرتبط (يُعبّئ الحقول والسجل تلقائياً) *</label>
              <select id="f-tenderId" onchange="onTenderSelectInClaimForm()">${tenderOptions}</select>
            </div>
            <div class="form-group">
              <label>اسم المقاول / مقدم المطالبة *</label>
              <input id="f-claimant" type="text" placeholder="يُجلب تلقائياً من العطاء" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>تاريخ تقديم المطالبة *</label>
              <input id="f-submitDate" type="date" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
              <label>نوع المطالبة *</label>
              <select id="f-type">
                <option value="مطالبة إنجاز">مطالبة إنجاز (دفعة جارية)</option>
                <option value="مطالبة ختامية">مطالبة ختامية (دفعة نهائية)</option>
                <option value="مطالبة إضافية / أوامر تغييرية">مطالبة إضافية / أمر تغييري</option>
              </select>
            </div>
            <div class="form-group">
              <label>حالة المطالبة والمسار</label>
              <select id="f-status">
                <option value="مسودة / قيد الإعداد">مسودة / قيد الإعداد</option>
                <option value="بانتظار تدقيق رئيس القسم">بانتظار تدقيق رئيس القسم</option>
                <option value="بانتظار تدقيق المدير">بانتظار تدقيق المدير</option>
                <option value="معتمدة وجاهزة للصرف">معتمدة وجاهزة للصرف</option>
                <option value="مرفوضة">مرفوضة</option>
              </select>
            </div>
          </div>
        </div>

        <!-- قسم 2: سجل المطالبات والدفعات السابقة للعطاء -->
        <div id="claim-previous-summary-card" style="background:#0f172a;border:1px solid #334155;padding:12px;border-radius:10px;color:#f8fafc;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:bold;color:#38bdf8;font-size:0.85rem;">📚 2. سجل وحسابات المطالبات والدفعات السابقة المرتبطة بالعطاء:</span>
            <span id="claim-prev-count-badge" style="background:#1e3a8a;color:#93c5fd;padding:2px 8px;border-radius:10px;font-size:0.75rem;">0 مطالبات سابقة</span>
          </div>
          <div id="claim-prev-table-container">
            <div style="text-align:center;padding:10px;color:#94a3b8;font-size:0.8rem;">يرجى اختيار العطاء لعرض المطالبات والدفعات السابقة التراكمية.</div>
          </div>
        </div>

        <!-- قسم 3: جدول بنود الكميات والتسعيرة للمطالبة (BOQ Table) -->
        <div style="background:var(--bg-card);border:1px solid var(--border);padding:12px;border-radius:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <div>
              <h4 style="margin:0;color:var(--primary);font-size:0.92rem;font-weight:bold;">📊 3. جدول بنود الأعمال والكميات المنفذة في المطالبة (BOQ Table)</h4>
              <span style="font-size:0.75rem;color:var(--text-muted);">أدخل الكميات المنفذة وسعر الفئة لحساب قيمة المطالبة تلقائياً</span>
            </div>
            <button type="button" class="btn btn-sm btn-success" onclick="addClaimBoqRow()" style="font-size:0.78rem;">➕ إضافة بند عمل جديد</button>
          </div>

          <div style="overflow-x:auto;">
            <table id="claim-boq-table" style="width:100%;border-collapse:collapse;font-size:0.78rem;text-align:right;min-width:850px;">
              <thead style="background:var(--bg);color:var(--text-muted);border-bottom:2px solid var(--border);">
                <tr>
                  <th style="padding:6px;width:30px;">#</th>
                  <th style="padding:6px;">وصف بند العمل / البيان</th>
                  <th style="padding:6px;width:75px;">الوحدة</th>
                  <th style="padding:6px;width:90px;">الفئة (د.أ)</th>
                  <th style="padding:6px;width:85px;">كمية العطاء</th>
                  <th style="padding:6px;width:85px;">الكمية السابقة</th>
                  <th style="padding:6px;width:90px;">الكمية الحالية</th>
                  <th style="padding:6px;width:90px;">إجمالي الكمية</th>
                  <th style="padding:6px;width:100px;">المبلغ المستحق (د.أ)</th>
                  <th style="padding:6px;width:35px;"></th>
                </tr>
              </thead>
              <tbody id="claim-boq-tbody">
                <!-- أسطر البنود تضاف ديناميكياً هنا -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- قسم 4: التسوية المالية واستقطاع المحتجزات الاختياري -->
        <div style="background:var(--bg-card);border:1px solid var(--border);padding:12px;border-radius:10px;">
          <h4 style="margin:0 0 10px;color:var(--primary);font-size:0.92rem;font-weight:bold;">💰 4. التسوية المالية التراكمية واقتطاع المحتجزات الاختياري</h4>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:10px;">
            <div class="form-group">
              <label>إجمالي الأعمال التراكمية (د.أ)</label>
              <input id="f-grossCumulative" type="number" readonly placeholder="0" style="font-weight:bold;color:#38bdf8;" title="إجمالي قيمة الكميات المنفذة تراكمياً حتى تاريخه" />
            </div>
            <div class="form-group">
              <label>تنزيل: المطالبات السابقة (د.أ)</label>
              <input id="f-previousPaid" type="number" readonly placeholder="0" style="font-weight:bold;color:#f59e0b;" title="إجمالي المطالبات المسددة سابقاً" />
            </div>
            <div class="form-group">
              <label>قيمة أعمال المطالبة الحالية (د.أ)</label>
              <input id="f-amount" type="number" readonly placeholder="0" style="font-weight:bold;color:#10b981;" title="الفرق الصافي للأعمال الحالية = التراكمي - السابقة" />
            </div>
            <div class="form-group">
              <label>نسبة المحتجزات والتأمين (%)</label>
              <div style="display:flex;align-items:center;gap:4px;">
                <input id="f-retentionPercent" type="number" value="10" placeholder="10" step="0.5" min="0" max="100" oninput="calculateClaimFinancialTotals()" style="width:65px;font-weight:bold;color:#ef4444;" title="نسبة اقتطاع المحتجزات الاختيارية" />
                <span style="font-size:0.75rem;color:var(--text-muted);">%</span>
                <input id="f-retention" type="number" placeholder="0" oninput="calculateClaimFinancialTotals(true)" style="flex:1;color:#ef4444;font-weight:bold;" title="مبلغ اقتطاع المحتجزات المالي" />
              </div>
            </div>
            <div class="form-group">
              <label>خصميات وأمانات أخرى (د.أ)</label>
              <input id="f-deduction" type="number" placeholder="0" oninput="calculateClaimFinancialTotals()" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--bg);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div>
              <label style="font-size:0.78rem;color:var(--text-muted);display:block;margin-bottom:2px;">نسبة الإنجاز التراكمية للعطاء (%)</label>
              <div style="display:flex;align-items:center;gap:6px;">
                <input id="f-completionPercent" type="number" readonly placeholder="0" style="font-size:1.05rem;font-weight:bold;color:#38bdf8;width:90px;" />
                <span style="font-size:0.8rem;color:var(--text-muted);">% من القيمة الأصلية للعطاء</span>
              </div>
            </div>
            <div>
              <label style="font-size:0.78rem;color:var(--text-muted);display:block;margin-bottom:2px;">صافي المبلغ المعتمد والصافي للصرف (د.أ)</label>
              <input id="f-netAmount" type="number" readonly placeholder="0" style="font-size:1.15rem;font-weight:bold;color:#059669;background:rgba(5,150,105,0.1);border:1px solid #059669;" title="صافي الدفعة المستحقة = أعمال الحالية - المحتجزات - الخصميات" />
            </div>
          </div>
        </div>

        <!-- ملاحظات وإرفاق ملفات -->
        <div class="form-group">
          <label>ملاحظات وتنسيبات فنية</label>
          <textarea id="f-notes" placeholder="أية ملاحظات إضافية حول نسبة الإنجاز والخصميات والتدقيق..."></textarea>
        </div>
        <div class="form-group">
          <label>إرفاق وثيقة المطالبة / الكشف (اختياري)</label>
          <input id="f-file" type="file" style="color:var(--text)" />
        </div>

        <div class="form-actions">
          <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-primary" onclick="saveRecord('claims')">💾 حفظ واعتمد المطالبة</button>
        </div>
      </div>`
    },
    purchases: {
      title: 'إضافة أمر شراء',
      html: `<div class="form-row">
          <div class="form-group"><label>المورد *</label><input id="f-supplier" type="text" /></div>
          <div class="form-group"><label>التاريخ</label><input id="f-date" type="date" /></div>
        </div>
        <div class="form-group"><label>الوصف</label><input id="f-description" type="text" /></div>
        <div class="form-row">
          <div class="form-group"><label>الكمية</label><input id="f-qty" type="number" placeholder="0" /></div>
          <div class="form-group"><label>سعر الوحدة (د.أ)</label><input id="f-unitPrice" type="number" placeholder="0.00" step="0.01" /></div>
        </div>
        <div class="form-group"><label>الحالة</label><select id="f-status"><option>جديد</option><option>موافق عليه</option><option>مُنجز</option><option>ملغي</option></select></div>
        <div class="form-group"><label>ملاحظات</label><textarea id="f-notes"></textarea></div>
        <div class="form-group"><label>إرفاق ملف (اختياري)</label><input id="f-file" type="file" style="color:var(--text)" /></div>
        <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveRecord('purchases')">💾 حفظ البيانات</button></div>`
    },
    archive: {
      title: 'رفع وثيقة جديدة',
      html: `<div class="form-group"><label>اسم الوثيقة *</label><input id="f-name" type="text" /></div>
        <div class="form-row">
          <div class="form-group"><label>النوع</label>
            <select id="f-type">
              ${getLookupOptionsHtml('DOC_TYPES')}
            </select>
          </div>
          <div class="form-group"><label>السنة</label><select id="f-year"><option>2026</option><option>2025</option><option>2024</option><option>2023</option></select></div>
        </div>
        <div class="form-group"><label>الرقم المرجعي</label><input id="f-relatedId" type="text" placeholder="رقم العطاء أو المطالبة..." /></div>
        <div class="form-group"><label>رفع الملف</label><input id="f-file" type="file" style="color:var(--text)" /></div>
        <div class="form-actions"><button class="btn btn-outline" onclick="closeModal()">إلغاء</button><button class="btn btn-primary" onclick="saveArchive()">📁 رفع الوثيقة</button></div>`
    },
    users: {
      title: 'إدارة حساب المستخدم والدور الوظيفي',
      html: `
        <div class="form-row">
          <div class="form-group"><label>اسم المستخدم (لتسجيل الدخول) *</label><input id="f-username" type="text" placeholder="مثال: eng.ahmad" required /></div>
          <div class="form-group"><label>الاسم الكامل للموظف / المهندس *</label><input id="f-fullName" type="text" placeholder="مثال: المهندس أحمد فريحات" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>البريد الإلكتروني الرسمي (Email)</label><input id="f-email" type="email" placeholder="user@kafrinja.gov.jo" /></div>
          <div class="form-group"><label>رقم الهاتف / الموبايل (Phone)</label><input id="f-phone" type="tel" placeholder="07XXXXXXXX" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>القسم / الوحدة التنظيمية الرسمية (Department)</label>
            <select id="f-department">
              <option value="مديرية الأشغال والخدمات الهندسية">مديرية الأشغال والخدمات الهندسية</option>
              <option value="قسم الطرق والبنية التحتية">قسم الطرق والبنية التحتية</option>
              <option value="قسم الأبنية والإنشاءات">قسم الأبنية والإنشاءات</option>
              <option value="قسم المشاريع والعطاءات">قسم المشاريع والعطاءات</option>
              <option value="قسم الكهرباء والطاقة المتجددة" selected>قسم الكهرباء والطاقة المتجددة</option>
            </select>
          </div>
          <div class="form-group"><label>المسمى الوظيفي الرسمي (Job Title)</label><input id="f-job_title" type="text" placeholder="مثال: مهندس كهرباء / طاقة" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>كلمة المرور (اتركه فارغاً للحفاظ على كلمة المرور القديمة عند التعديل)</label><input id="f-password" type="password" placeholder="••••••••" /></div>
          <div class="form-group"><label>الدور الوظيفي المعتمد في مصفوفة الصلاحيات *</label>
            <select id="f-role">
              <option value="admin">مدير النظام (كامل الصلاحيات)</option>
              <option value="director_public_works">مدير الأشغال والخدمات الهندسية</option>
              <option value="head_of_roads">رئيس قسم الطرق</option>
              <option value="head_of_buildings">رئيس قسم الأبنية والإنشاءات</option>
              <option value="head_of_electricity_energy">رئيس قسم الكهرباء والطاقة المتجددة</option>
              <option value="roads_engineer">مهندس طرق</option>
              <option value="buildings_engineer">مهندس أبنية وإنشاءات</option>
              <option value="electrical_engineer">مهندس كهرباء</option>
              <option value="renewable_energy_engineer">مهندس طاقة متجددة</option>
              <option value="quantity_surveyor">حاسب كميات</option>
              <option value="site_inspector">مراقب</option>
              <option value="electrical_works_inspector">مراقب أعمال كهربائية</option>
              <option value="electrical_technician">فني كهرباء وإنارة</option>
              <option value="qa_qc_engineer">مهندس ضبط الجودة</option>
              <option value="land_surveyor">مساح</option>
            </select>
          </div>
        </div>
        
        <div style="background:var(--bg-card); padding:10px 14px; border-radius:8px; border:1px solid var(--border); margin:10px 0; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.85rem; font-weight:bold; color:var(--text);">🛡️ تفعيل المصادقة الثنائية (2FA) لهذا الحساب</span>
          <input type="checkbox" id="f-two_factor_enabled" style="transform:scale(1.2); accent-color:var(--primary);" />
        </div>

        <div class="form-actions" style="margin-top:16px;">
          <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
          <button class="btn btn-primary" onclick="saveRecord('users')">💾 حفظ المستخدم</button>
        </div>`
    }
  };

  const cfg = forms[type];
  if (!cfg) return;
  document.getElementById('modalTitle').textContent = cfg.title;
  document.getElementById('modalBody').innerHTML = cfg.html;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modal').dataset.type = type;
  delete document.getElementById('modal').dataset.editId;

  if (type === 'tenders') {
    setTimeout(() => { initTenderMap(); }, 300);
  }

  if (type === 'claims') {
    setTimeout(() => {
      if (typeof window.onTenderSelectInClaimForm === 'function') {
        window.onTenderSelectInClaimForm();
      }
    }, 200);
  }

  if (type === 'users') {
    const roleSelect = document.getElementById('f-role');
    const deptSelect = document.getElementById('f-department');

    // Populate roles and departments dynamically from the database
    Promise.all([
      apiFetch('/roles').catch(() => []),
      apiFetch('/org-units').catch(() => [])
    ]).then(([rolesList, orgUnitsList]) => {
      if (Array.isArray(rolesList) && rolesList.length > 0 && roleSelect) {
        const currentRole = roleSelect.value;
        roleSelect.innerHTML = rolesList.map(r => `
          <option value="${r.name}" ${r.name === currentRole ? 'selected' : ''}>${r.label || r.name} (${r.name})</option>
        `).join('');
      }

      if (Array.isArray(orgUnitsList) && orgUnitsList.length > 0 && deptSelect) {
        const currentDept = deptSelect.value;
        deptSelect.innerHTML = orgUnitsList.map(ou => `
          <option value="${ou.name}" ${ou.name === currentDept ? 'selected' : ''}>${ou.name}</option>
        `).join('');
      }
    });
  }
}

let tenderMapInstance = null;
let tenderMapMarker = null;

function initTenderMap() {
  const mapEl = document.getElementById('tenderMap');
  if (!mapEl) return;
  if (tenderMapInstance) {
    tenderMapInstance.remove();
    tenderMapInstance = null;
    tenderMapMarker = null;
  }
  tenderMapInstance = typeof createUnifiedMap === 'function'
    ? createUnifiedMap('tenderMap', [32.3301, 35.7501], 13)
    : L.map('tenderMap').setView([32.3301, 35.7501], 13);

  tenderMapInstance.on('click', function (e) {
    const { lat, lng } = e.latlng;
    updateTenderMapMarker(lat, lng);
  });
}

function updateTenderMapMarker(lat, lng) {
  if (!tenderMapInstance) return;
  if (tenderMapMarker) {
    tenderMapMarker.setLatLng([lat, lng]);
  } else {
    tenderMapMarker = L.marker([lat, lng]).addTo(tenderMapInstance);
  }
  document.getElementById('f-lat').value = lat;
  document.getElementById('f-lng').value = lng;
  tenderMapInstance.setView([lat, lng], tenderMapInstance.getZoom());
}

async function openEditModal(type, id) {
  if (type === 'tenders') {
    navigate('tenders');
    if (typeof loadTendersModule === 'function') loadTendersModule();
    setTimeout(() => {
      if (typeof tendersManager !== 'undefined' && tendersManager) tendersManager.openEditForm(id);
    }, 120);
    return;
  }
  if (type === 'claims') {
    if (typeof unifiedClaimsManager !== 'undefined' && unifiedClaimsManager) {
      unifiedClaimsManager.openEditModal(id);
      return;
    }
  }
  await openModal(type);
  try {
    const record = await apiFetch(`/${type}/${id}`);
    setTimeout(() => {
      Object.keys(record).forEach(k => {
        const el = document.getElementById('f-' + k);
        if (el) el.value = record[k];
      });
      document.getElementById('modal').dataset.editId = id;
      document.getElementById('modalTitle').textContent = `تعديل السجل: ${id}`;
      if (type === 'tenders' || type === 'tasks') {
        if (record.lat && record.lng) {
          updateTenderMapMarker(record.lat, record.lng);
        }
        if (type === 'tenders') runTenderGuideRules();
      }
      if (type === 'users') {
        const roleSelect = document.getElementById('f-role');
        if (record.role && roleSelect) {
          roleSelect.value = record.role;
        }
        const emailEl = document.getElementById('f-email');
        if (emailEl) emailEl.value = record.email || '';
        const phoneEl = document.getElementById('f-phone');
        if (phoneEl) phoneEl.value = record.phone || '';
        const deptEl = document.getElementById('f-department');
        if (deptEl) deptEl.value = record.department || '';
        const jobEl = document.getElementById('f-job_title');
        if (jobEl) jobEl.value = record.job_title || '';
        const twoFactorCb = document.getElementById('f-two_factor_enabled');
        if (twoFactorCb) twoFactorCb.checked = !!record.two_factor_enabled;


      }
      if (type === 'claims') {
        if (typeof window.onTenderSelectInClaimForm === 'function') {
          window.onTenderSelectInClaimForm().then(() => {
            if (record.boqItems) {
              let items = [];
              try { items = typeof record.boqItems === 'string' ? JSON.parse(record.boqItems) : record.boqItems; } catch {}
              if (items && items.length) {
                const tbody = document.getElementById('claim-boq-tbody');
                if (tbody) {
                  tbody.innerHTML = '';
                  items.forEach(it => {
                    window.addClaimBoqRow(it.desc, it.unit, it.rate, it.contractQty, it.prevQty, it.currQty);
                  });
                }
              }
            }
            if (record.retentionPercent !== undefined && record.retentionPercent !== null && record.retentionPercent !== '') {
              const rpEl = document.getElementById('f-retentionPercent');
              if (rpEl) rpEl.value = record.retentionPercent;
            }
            if (record.retention !== undefined && record.retention !== null && record.retention !== '') {
              const rEl = document.getElementById('f-retention');
              if (rEl) rEl.value = record.retention;
            }
            if (record.deduction !== undefined && record.deduction !== null && record.deduction !== '') {
              const dEl = document.getElementById('f-deduction');
              if (dEl) dEl.value = record.deduction;
            }
            if (typeof window.calculateClaimFinancialTotals === 'function') {
              const isManual = record.retention !== undefined && record.retention !== null && record.retention !== '';
              window.calculateClaimFinancialTotals(isManual);
            }
          });
        }
      }
    }, 100);
  } catch (e) { closeModal(); }
}

function closeModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) modalOverlay.classList.remove('open');
  const viewOverlay = document.getElementById('viewOverlay');
  if (viewOverlay) viewOverlay.classList.remove('open');
  const confirmOverlay = document.getElementById('confirmOverlay');
  if (confirmOverlay) confirmOverlay.classList.remove('open');
}
window.closeModal = closeModal;
window.closeViewModal = closeModal;

async function saveRecord(type, customEditId = null) {
  const modal = document.getElementById('modal');
  const editId = customEditId || (modal ? modal.dataset.editId : null);

  const body = {};
  ['name', 'contractor', 'openDate', 'closeDate', 'value', 'status', 'notes', 'lat', 'lng',
    'tenderType', 'purchaseMethod', 'purchaseCommittee',
    'tenderId', 'claimant', 'submitDate', 'amount', 'type',
    'supplier', 'description', 'qty', 'unitPrice', 'date',
    'username', 'password', 'fullName', 'role', 'email', 'phone', 'department', 'job_title',
    'title', 'appealNumber', 'appealDate', 'citizenName', 'citizenPhone', 'assignedTo', 'priority', 'dueDate'].forEach(k => {
      const el = document.getElementById('f-' + k);
      if (el) body[k] = el.value;
    });

  if (type === 'users') {
    const twoFactorCb = document.getElementById('f-two_factor_enabled');
    if (twoFactorCb) body.two_factor_enabled = twoFactorCb.checked;
  }

  if (type === 'claims') {
    const boqRows = Array.from(document.querySelectorAll('#claim-boq-tbody tr')).map(tr => ({
      desc: tr.querySelector('.boq-desc')?.value || '',
      unit: tr.querySelector('.boq-unit')?.value || 'م3',
      rate: parseFloat(tr.querySelector('.boq-rate')?.value) || 0,
      contractQty: parseFloat(tr.querySelector('.boq-cqty')?.value) || 0,
      prevQty: parseFloat(tr.querySelector('.boq-pqty')?.value) || 0,
      currQty: parseFloat(tr.querySelector('.boq-currqty')?.value) || 0,
      totalQty: parseFloat(tr.querySelector('.boq-tqty')?.value) || 0,
      amount: parseFloat(tr.querySelector('.boq-amount')?.value) || 0
    })).filter(r => r.desc.trim() !== '');

    body.boqItems = JSON.stringify(boqRows);
    body.grossCumulative = document.getElementById('f-grossCumulative')?.value || 0;
    body.amount = document.getElementById('f-amount')?.value || 0;
    body.previousPaid = document.getElementById('f-previousPaid')?.value || 0;
    const rpVal = document.getElementById('f-retentionPercent')?.value;
    body.retentionPercent = (rpVal !== undefined && rpVal !== null && rpVal !== '') ? (parseFloat(rpVal) || 0) : 0;
    const rVal = document.getElementById('f-retention')?.value;
    body.retention = (rVal !== undefined && rVal !== null && rVal !== '') ? (parseFloat(rVal) || 0) : 0;
    body.deduction = document.getElementById('f-deduction')?.value || 0;
    body.netAmount = document.getElementById('f-netAmount')?.value || 0;
    body.completionPercent = document.getElementById('f-completionPercent')?.value || 0;
    body.editReason = document.getElementById('f-editReason')?.value || '';
  }

  const fileInput = document.getElementById('f-file');
  const hasFile = fileInput && fileInput.files.length > 0;

  let fetchBody;
  if (hasFile && type !== 'users') {
    const formData = new FormData();
    Object.keys(body).forEach(k => formData.append(k, body[k]));
    formData.append('file', fileInput.files[0]);
    fetchBody = formData;
  } else {
    fetchBody = JSON.stringify(body);
  }

  try {
    if (editId) {
      await apiFetch(`/${type}/${editId}`, { method: 'PUT', body: fetchBody });
      showToast('✅ تم حفظ التعديلات بنجاح');
      if (type === 'users' && currentUser && (editId === currentUser.id || editId === 'U-001')) {
        Object.assign(currentUser, body);
        localStorage.setItem('user', JSON.stringify(currentUser));
        sessionStorage.setItem('engineeringUser', JSON.stringify(currentUser));
        initApp();
      }
    } else {
      await apiFetch(`/${type}`, { method: 'POST', body: fetchBody });
      showToast('✅ تمت الإضافة بنجاح');
      if (type === 'tasks' && body.assignedTo) {
        notifyUser(body.assignedTo, `تم إسناد مهمة جديدة إليك: ${body.title}`, `tasks`);
      }
    }
    closeModal();
    if (type === 'tasks') renderTasks();
    else if (type === 'users') {
      if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
      renderTable('users');
    }
    else renderTable(type);
  } catch (e) {
    showToast('❌ خطأ: ' + e.message);
  }
}

async function saveArchive() {
  const name = document.getElementById('f-name')?.value;
  if (!name) { showToast('⚠️ يرجى إدخال اسم الوثيقة'); return; }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('type', document.getElementById('f-type')?.value || 'أخرى');
  formData.append('year', document.getElementById('f-year')?.value || new Date().getFullYear().toString());
  formData.append('relatedId', document.getElementById('f-relatedId')?.value || '');

  const fileInput = document.getElementById('f-file');
  if (fileInput?.files[0]) formData.append('file', fileInput.files[0]);

  try {
    await apiFetch('/archive', { method: 'POST', body: formData });
    showToast('✅ تمت إضافة الوثيقة للأرشيف');
    closeModal();
    renderArchive();
  } catch (e) { }
}

// ===== View Details Modal =====
async function viewRecord(type, id) {
  if (type === 'tenders') {
    navigate('tenders');
    if (typeof loadTendersModule === 'function') loadTendersModule();
    setTimeout(() => {
      if (tendersManager) tendersManager.openProjectHub(id);
    }, 120);
    return;
  }
  if (type === 'claims') {
    if (typeof unifiedClaimsManager !== 'undefined' && unifiedClaimsManager) {
      unifiedClaimsManager.openViewModal(id);
      return;
    }
  }

  try {
    const record = await apiFetch(`/${type}/${id}`);
    document.getElementById('viewTitle').textContent = `تفاصيل: ${id}`;

    let html = '<div class="detail-grid">';

    const displayMap = {
      tenders: { name: 'اسم المشروع', tenderType: 'نوع العطاء', purchaseMethod: 'طريقة الشراء', purchaseCommittee: 'لجنة الشراء', contractor: 'المقاول', openDate: 'تاريخ الطرح', closeDate: 'تاريخ الانتهاء', value: 'القيمة', status: 'الحالة', createdAt: 'تاريخ الإضافة' },
      claims: { tenderId: 'رقم العطاء', claimant: 'مقدم المطالبة', submitDate: 'تاريخ التقديم', amount: 'المبلغ الأساسي', completionPercent: 'نسبة الإنجاز %', deduction: 'الاستقطاعات', paymentDate: 'تاريخ الصرف المتوقع', type: 'النوع', status: 'الحالة' },
      purchases: { supplier: 'المورد', description: 'الوصف', qty: 'الكمية', unitPrice: 'سعر الوحدة', date: 'التاريخ', status: 'الحالة' }
    };

    const fields = displayMap[type] || {};
    for (const [key, label] of Object.entries(fields)) {
      let val = record[key] || '—';
      if (key === 'value' || key === 'amount' || key === 'unitPrice') val = Number(val).toLocaleString('ar-JO') + ' د.أ';
      if (key === 'status') val = `<span class="status-badge ${getStatusClass(record.status)}">${record.status}</span>`;
      html += `<div class="detail-item"><label>${label}</label><div class="detail-val">${val}</div></div>`;
    }

    if (type === 'purchases') {
      html += `<div class="detail-item"><label>الإجمالي الكلي</label><div class="detail-val" style="color:var(--accent)">${(record.qty * record.unitPrice).toLocaleString('ar-JO')} د.أ</div></div>`;
    }

    html += '</div>';

    if (record.notes) {
      html += `<div class="detail-notes"><strong>ملاحظات:</strong><br>${record.notes}</div>`;
    }

    if (type === 'claims') {
      // Build workflow progress indicators
      const wfConfig = window._claimWorkflowConfig || [];
      const isConfigured = wfConfig.length > 0;

      const steps = isConfigured ? ['مسودة', ...wfConfig.map(s => s.label), 'معتمدة وجاهزة للصرف'] : ['مسودة / قيد الإعداد', 'بانتظار تدقيق رئيس القسم', 'بانتظار تدقيق المدير', 'معتمدة وجاهزة للصرف'];
      const stepLabels = isConfigured ? ['إعداد', ...wfConfig.map(s => s.label), 'اعتمدت ✅'] : ['إعداد', 'تدقيق رئيس القسم', 'تدقيق المدير', 'اعتمدت ✅'];

      const isRejected = record.status === 'مرفوضة';

      let progressHtml = steps.map((s, i) => {
        let cls = 'wp-step';
        if (isRejected) { cls += ' rejected'; }
        else if (record.status === s || (i === 0 && record.status.includes('مسودة'))) { cls += ' current'; }
        else if (steps.indexOf(record.status) > i || record.status.includes('معتمدة')) { cls += ' done'; }
        const icon = cls.includes('done') ? '✓ ' : cls.includes('current') ? '▶ ' : cls.includes('rejected') ? '✕ ' : '';
        return `<div class="${cls}">${icon}${stepLabels[i]}</div>`;
      }).join('<span style="color:var(--border);font-size:0.7rem;"> ← </span>');

      if (isRejected) progressHtml = `<div class="wp-step rejected">✕ مرفوضة - تحتاج إعادة تقديم</div>`;

      html += `<div class="claim-workflow-panel">
        <h4>⚙️ مسار التدقيق الإداري والاعتماد</h4>
        <div class="workflow-progress">${progressHtml}</div>
        <div class="workflow-actions" style="margin-top:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">`;

      const currentIdx = record.status?.includes('مسودة') ? 0 : steps.indexOf(record.status);

      if (isConfigured) {
        if (record.status?.includes('مسودة') || record.status === 'مقدمة') {
          const nextStep = steps[1];
          html += `<button class="btn btn-primary" onclick="processClaimWorkflow('${record.id}', '${nextStep}')">📤 إرسال إلى (${nextStep}) ➔</button>`;
        } else if (isRejected) {
          html += `<button class="btn btn-primary" onclick="processClaimWorkflow('${record.id}', '${steps[1]}')">🔄 إعادة التقديم ➔</button>`;
        } else if (currentIdx > 0 && currentIdx < steps.length - 1) {
          const stepConfig = wfConfig[currentIdx - 1];
          const canAct = (currentUser.id === stepConfig.userId || currentUser.role === stepConfig.userId || currentUser.role === 'admin');
          if (canAct) {
            const nextStep = steps[currentIdx + 1];
            html += `<button class="btn btn-success" onclick="processClaimWorkflow('${record.id}', '${nextStep}')">✓ موافقة وإحالة لـ (${nextStep})</button>
                     <button class="btn btn-danger" onclick="processClaimWorkflow('${record.id}', 'مرفوضة')">✕ رفض وإعادة</button>`;
          } else {
            html += `<span style="color:var(--text-muted);font-size:0.85rem;">بانتظار تدقيق من قبل: ${stepConfig.label}</span>`;
          }
        } else if (currentIdx === steps.length - 1 || record.status?.includes('معتمدة')) {
          html += `<button class="btn btn-info" onclick="printClaim('${record.id}')">🖨️ إصدار المطالبة الرسمية (طباعة)</button>`;
        } else {
          html += `<span style="color:var(--text-muted);font-size:0.85rem;">لا توجد إجراءات مسار إضافية حالياً.</span>`;
        }
      } else {
        // المسار الافتراضي المتدرج
        if (record.status?.includes('مسودة') || record.status === 'مقدمة') {
          html += `<button class="btn btn-primary" onclick="processClaimWorkflow('${record.id}', 'بانتظار تدقيق رئيس القسم')">📤 إرسال لتدقيق رئيس القسم ➔</button>`;
        } else if (record.status === 'بانتظار تدقيق رئيس القسم') {
          html += `<button class="btn btn-success" onclick="processClaimWorkflow('${record.id}', 'بانتظار تدقيق المدير')">✓ موافقة رئيس القسم وإحالة للمدير ➔</button>
                   <button class="btn btn-danger" onclick="processClaimWorkflow('${record.id}', 'مرفوضة')">✕ رفض وإعادة</button>`;
        } else if (record.status === 'بانتظار تدقيق المدير') {
          html += `<button class="btn btn-success" onclick="processClaimWorkflow('${record.id}', 'معتمدة وجاهزة للصرف')">🏛️ اعتماد نهائي وصرف الدفعة ✅</button>
                   <button class="btn btn-danger" onclick="processClaimWorkflow('${record.id}', 'مرفوضة')">✕ رفض وإعادة للدراسة</button>`;
        } else if (record.status?.includes('معتمدة')) {
          html += `<button class="btn btn-info" onclick="printClaim('${record.id}')">🖨️ طباعة شهادة الدفعة الرسمية</button>`;
        } else if (record.status === 'مرفوضة') {
          html += `<button class="btn btn-primary" onclick="processClaimWorkflow('${record.id}', 'بانتظار تدقيق رئيس القسم')">🔄 إعادة التقديم للتدقيق ➔</button>`;
        }
      }

      const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'dept_head' || currentUser.role === 'engineer';
      if (canEdit) {
        html += `<button class="btn btn-warning" onclick="openEditModal('claims', '${record.id}')" style="font-weight:bold;">✏️ تعديل بيانات المطالبة والكميات</button>`;
      }

      html += `</div></div>`;

      // عرض المرفق الورقي إن وجد
      if (record.file || record.attachmentPath || record.attachment_path) {
        const attachFile = record.file || record.attachmentPath || record.attachment_path;
        html += `
          <div style="margin:12px 0;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--accent);">📎 الوثيقة المرفقة بالمطالبة (الكشف / المستند الورقي):</span>
            <a href="/uploads/${attachFile}" target="_blank" class="btn btn-sm btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
              <span>📄</span> <span>معاينة وتحميل المستند المرفق</span>
            </a>
          </div>`;
      }

      // جدول التسوية المالية التراكمية وجدول الكميات (BOQ Statement)
      try {
        let allClaims = [];
        try { allClaims = window.reportsClaims || []; } catch {}
        const previousClaims = (allClaims || []).filter(c => String(c.id) !== String(record.id) && (String(c.tenderId) === String(record.tenderId) || String(c.tenderName) === String(record.tenderName)));
        const tender = (window._cachedTenders || []).find(t => String(t.id) === String(record.tenderId));
        if (typeof window.buildClaimFinancialBreakdownHtml === 'function') {
          html += window.buildClaimFinancialBreakdownHtml(record, tender, previousClaims);
        }
      } catch (e) {}

      // Detailed Audit Trail / Log for Admin and Reviewers
      let history = [];
      try { history = typeof record.history === 'string' ? JSON.parse(record.history || '[]') : (record.history || []); } catch (e) { }

      html += `<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="margin:0;font-size:0.95rem;color:var(--primary);font-weight:bold;">📋 سجل المتابعة والاعتمادات والتعديلات الحصري (Audit Log)</h4>
          <span style="font-size:0.75rem;background:rgba(59,130,246,0.1);color:#2563eb;padding:3px 8px;border-radius:6px;font-weight:bold;">مرئي لمدير النظام والمدققين</span>
        </div>`;

      if (history.length) {
        html += `<div class="timeline" style="display:flex;flex-direction:column;gap:10px;">`;
        history.forEach(h => {
          const d = new Date(h.date || Date.now()).toLocaleString('ar-JO');
          const isActionEdit = (h.action || '').includes('تعديل');
          const isApproved = (h.status || '').includes('معتمدة');
          const isRejected = (h.status || '') === 'مرفوضة';
          const badgeBg = isRejected ? '#ef4444' : (isApproved ? '#10b981' : (isActionEdit ? '#f59e0b' : '#3b82f6'));

          html += `
            <div style="background:var(--bg);border:1px solid var(--border);border-right:4px solid ${badgeBg};border-radius:8px;padding:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-weight:bold;font-size:0.85rem;color:var(--text);">${h.action || 'إجراء تدقيق'}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);">${d}</span>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">
                👤 <strong>المنفذ:</strong> ${h.actionBy || h.user || 'مستخدم'} | <strong>الحالة:</strong> <span style="color:${badgeBg};font-weight:bold;">${h.status}</span>
              </div>
              ${h.notes ? `
                <div style="background:var(--bg-card);border:1px dashed var(--border);padding:6px 10px;border-radius:6px;font-size:0.8rem;color:var(--text);">
                  💬 <strong>التبرير والملاحظات:</strong> ${h.notes}
                </div>` : ''}
              ${h.attachment ? `<div style="margin-top:6px;"><a href="/uploads/${h.attachment}" target="_blank" style="color:var(--primary);text-decoration:none;font-size:0.8rem;">📎 تحميل المرفق المصاحب</a></div>` : ''}
            </div>`;
        });
        html += `</div>`;
      } else {
        html += `<div style="color:var(--text-muted);font-size:0.85rem;padding:12px;background:var(--bg);border-radius:8px;border:1px dashed var(--border);text-align:center;">لم يتم إدراج تعديلات أو قرارات بالمسار بعد. جميع التعديلات والقرارات تسجل هنا صراحة.</div>`;
      }
      html += `</div>`;
    }



    if (type === 'tenders' && record.lat && record.lng) {
      html += `<div style="margin-top:14px;"><label style="display:block; font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">الموقع الميداني</label>
        <div id="viewTenderMap" style="height: 200px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
      </div>`;
    }

    html += `
      <div style="margin-top:22px; padding-top:16px; border-top:1.5px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:rgba(15,118,110,0.06); padding:14px; border-radius:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.3rem;">🛡️</span>
          <span style="font-size:0.85rem; font-weight:bold; color:var(--text);">التحقق والمطابقة الرقمية المشفرة (SHA-256):</span>
        </div>
        <button class="btn btn-primary" onclick="window.verifyDocumentDirect('${record.id || id}'); document.getElementById('viewOverlay').classList.remove('open');" style="padding:7px 16px; font-size:0.86rem; font-weight:bold; border-radius:8px; display:flex; align-items:center; gap:66px;">
          <span>🔐</span> <span>فحص الوثيقة في تبويب التحقق</span>
        </button>
      </div>`;

    document.getElementById('viewBody').innerHTML = html;
    document.getElementById('viewOverlay').classList.add('open');

    if (type === 'tenders' && record.lat && record.lng) {
      setTimeout(() => {
        if (window.viewMapInstance) { window.viewMapInstance.remove(); }
        window.viewMapInstance = typeof createUnifiedMap === 'function'
          ? createUnifiedMap('viewTenderMap', [record.lat, record.lng], 14)
          : L.map('viewTenderMap').setView([record.lat, record.lng], 14);
        L.marker([record.lat, record.lng]).addTo(window.viewMapInstance);
      }, 300);
    }
  } catch (e) { }
}

window.buildClaimFinancialBreakdownHtml = function(claim, tender, previousClaims = []) {
  const tenderVal = tender ? (parseFloat(tender.value) || 0) : 0;

  let prevPaid = parseFloat(claim.previousPaid) || 0;
  if (prevPaid === 0 && previousClaims.length > 0) {
    prevPaid = previousClaims.reduce((sum, item) => sum + parseFloat(item.amount || item.grossCumulative || 0), 0);
  }

  const grossCurrentVal = parseFloat(claim.amount) || 0;
  const grossCumulativeVal = parseFloat(claim.grossCumulative) || (grossCurrentVal + prevPaid);

  const rawRetPercent = claim.retentionPercent !== undefined && claim.retentionPercent !== null && claim.retentionPercent !== '' ? parseFloat(claim.retentionPercent) : NaN;
  const retPercent = isNaN(rawRetPercent) ? 0 : rawRetPercent;

  const retVal = parseFloat(claim.retention) !== undefined && !isNaN(parseFloat(claim.retention)) ? parseFloat(claim.retention) : (grossCurrentVal * (retPercent / 100));
  const deductVal = parseFloat(claim.deduction) || 0;
  const netVal = parseFloat(claim.netAmount) || Math.max(0, grossCurrentVal - retVal - deductVal);

  let boqItems = [];
  try { boqItems = typeof claim.boqItems === 'string' ? JSON.parse(claim.boqItems || '[]') : (claim.boqItems || []); } catch {}

  let boqTableHtml = '';
  if (boqItems.length > 0) {
    boqTableHtml = `
      <div style="margin-top:14px;">
        <h4 style="margin:0 0 6px;color:#1e3a8a;font-size:0.88rem;">📋 كشف تفاصيل بنود الأعمال والكميات المنفذة بالدفعة الحالية (BOQ Statement):</h4>
        <table class="report-table-print" style="font-size:0.78rem;width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">#</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">تفاصيل بند العمل</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الوحدة</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الفئة (د.أ)</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الكمية السابقة</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الكمية الحالية</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">إجمالي الكمية</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">المبلغ المستحق (د.أ)</th>
            </tr>
          </thead>
          <tbody>
            ${boqItems.map((b, i) => `
              <tr>
                <td style="padding:4px;border:1px solid #cbd5e1;text-align:center;">${i+1}</td>
                <td style="padding:4px;border:1px solid #cbd5e1;"><b>${b.desc}</b></td>
                <td style="padding:4px;border:1px solid #cbd5e1;text-align:center;">${b.unit}</td>
                <td style="padding:4px;border:1px solid #cbd5e1;"><b>${(parseFloat(b.rate)||0).toLocaleString('ar-JO')}</b></td>
                <td style="padding:4px;border:1px solid #cbd5e1;">${b.prevQty||0}</td>
                <td style="padding:4px;border:1px solid #cbd5e1;color:#2563eb;font-weight:bold;">${b.currQty||0}</td>
                <td style="padding:4px;border:1px solid #cbd5e1;">${b.totalQty || ((parseFloat(b.prevQty)||0)+(parseFloat(b.currQty)||0))}</td>
                <td style="padding:4px;border:1px solid #cbd5e1;color:#047857;font-weight:bold;">${(parseFloat(b.amount)||0).toLocaleString('ar-JO')} د.أ</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  let prevClaimsTableHtml = '';
  if (previousClaims.length > 0) {
    prevClaimsTableHtml = `
      <div style="margin-top:14px;">
        <h4 style="margin:0 0 6px;color:#1e3a8a;font-size:0.88rem;">📚 سجل وتاريخ المطالبات والدفعات السابقة المسددة بالعطاء:</h4>
        <table class="report-table-print" style="font-size:0.78rem;width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">رقم المطالبة</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">تاريخ التقديم</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">المبلغ الإجمالي (د.أ)</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الخصم والمحتجزات</th>
              <th style="padding:5px;border:1px solid #cbd5e1;background:#f1f5f9;">الصافي المصروف (د.أ)</th>
            </tr>
          </thead>
          <tbody>
            ${previousClaims.map((pc, i) => {
              const g = parseFloat(pc.amount || pc.grossCumulative || 0);
              const d = parseFloat(pc.deduction || pc.retention || 0);
              const n = parseFloat(pc.netAmount || (g - d)) || g;
              return `
                <tr>
                  <td style="padding:4px;border:1px solid #cbd5e1;font-weight:bold;color:#2563eb;">${pc.id} (دفعة ${i+1})</td>
                  <td style="padding:4px;border:1px solid #cbd5e1;">${pc.submitDate || '—'}</td>
                  <td style="padding:4px;border:1px solid #cbd5e1;font-weight:bold;color:#047857;">${g.toLocaleString('ar-JO')} د.أ</td>
                  <td style="padding:4px;border:1px solid #cbd5e1;color:#b91c1c;">${d.toLocaleString('ar-JO')} د.أ</td>
                  <td style="padding:4px;border:1px solid #cbd5e1;font-weight:bold;color:#1d4ed8;">${n.toLocaleString('ar-JO')} د.أ</td>
                </tr>`;
            }).join('')}
            <tr style="background:#e0f2fe;font-weight:bold;color:#1e3a8a;">
              <td colspan="2" style="padding:6px;border:1px solid #cbd5e1;">إجمالي المطالبات والدفعات السابقة التراكمية:</td>
              <td style="padding:6px;border:1px solid #cbd5e1;color:#047857;">${prevPaid.toLocaleString('ar-JO')} د.أ</td>
              <td style="padding:6px;border:1px solid #cbd5e1;">—</td>
              <td style="padding:6px;border:1px solid #cbd5e1;color:#1d4ed8;">${prevPaid.toLocaleString('ar-JO')} د.أ</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  return `
    <div style="border:2px solid #1e3a8a;border-radius:8px;padding:12px;background:#f8fafc;margin-bottom:12px;font-size:0.85rem;line-height:1.8;">
      <h4 style="margin:0 0 8px;color:#1e3a8a;font-size:0.92rem;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">💰 الخلاصة:</h4>
      <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;">1. إجمالي قيمة الأعمال المنفذة تراكمياً حتى تاريخه:</td><td style="text-align:left;font-weight:bold;color:#1e3a8a;">${grossCumulativeVal.toLocaleString('ar-JO')} د.أ</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;"><td style="padding:4px;color:#d97706;font-weight:bold;">2. تنزيل: إجمالي المطالبات والدفعات السابقة المسددة:</td><td style="text-align:left;font-weight:bold;color:#d97706;">(-) ${prevPaid.toLocaleString('ar-JO')} د.أ</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:#f0fdf4;"><td style="padding:4px;font-weight:bold;">3. قيمة الأعمال المنفذة في هذه المطالبة الحالية:</td><td style="text-align:left;font-weight:bold;color:#047857;">${grossCurrentVal.toLocaleString('ar-JO')} د.أ</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;color:#b91c1c;">4. تنزيل: اقتطاع المحتجزات وتأمين التنفيذ بنسبة (<b>${retPercent}%</b>):</td><td style="text-align:left;font-weight:bold;color:#b91c1c;">(-) ${retVal.toLocaleString('ar-JO')} د.أ</td></tr>
        ${deductVal > 0 ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;color:#b91c1c;">5. تنزيل: خصميات وأمانات ومخالفات أخرى:</td><td style="text-align:left;font-weight:bold;color:#b91c1c;">(-) ${deductVal.toLocaleString('ar-JO')} د.أ</td></tr>` : ''}
        <tr style="background:#e0f2fe;font-weight:bold;"><td style="padding:8px;font-size:0.92rem;color:#1e3a8a;">6. صافي المبلغ المستحق والصافي الصريح للصرف بموجب هذه الشهادة:</td><td style="text-align:left;font-size:1.1rem;color:#1e3a8a;">${netVal.toLocaleString('ar-JO')} د.أ</td></tr>
      </table>
    </div>
    ${prevClaimsTableHtml}
    ${boqTableHtml}`;
};

async function addTaskComment(id) {
  const input = document.getElementById('task-comment-input');
  const fileInput = document.getElementById('task-comment-file');
  const text = input?.value;
  if (!text || !text.trim()) {
    showToast('⚠️ يرجى كتابة الملاحظة');
    return;
  }

  try {
    const hasFile = fileInput && fileInput.files.length > 0;
    let fetchBody;
    if (hasFile) {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('file', fileInput.files[0]);
      fetchBody = formData;
    } else {
      fetchBody = JSON.stringify({ text });
    }

    await apiFetch(`/tasks/${id}/comments`, {
      method: 'POST',
      body: fetchBody
    });
    showToast('✅ تمت إضافة الملاحظة');
    input.value = '';
    viewRecord('tasks', id);
    renderTasks();
  } catch (e) { }
}

async function processClaimWorkflow(id, targetStatus) {
  const notesHtml = `
    <div style="padding:10px 0;direction:rtl;">
      <div style="background:rgba(99,102,241,0.1);border:1px solid var(--primary);border-radius:8px;padding:10px;margin-bottom:12px;font-size:0.88rem;">
        <strong>📌 الإجراء الفني/الإداري:</strong> <span style="color:var(--primary);font-weight:bold;">${targetStatus}</span>
      </div>
      <label style="display:block;margin-bottom:6px;font-weight:bold;font-size:0.85rem;color:var(--text);">
        💬 تبريرات وسبيليات القرار / التعديل (تظهر لمدير النظام بسجل Audit Log) *
      </label>
      <textarea id="workflow-notes-input" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);resize:none;" placeholder="اكتب تبرير الاعتماد أو سبيليات التعديل والتوجيه الإداري..."></textarea>
      <div style="margin-top:10px"><label style="font-size:0.82rem;color:var(--text)">📎 إرفاق ملف / كتاب تغطية (اختياري)</label><input id="workflow-file-input" type="file" style="width:100%;margin-top:4px;color:var(--text)" /></div>
      <div class="form-actions" style="margin-top:14px;">
        <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="_confirmWorkflow('${id}', '${targetStatus}')">تأكيد الاعتماد / الإجراء ✓</button>
      </div>
    </div>`;

  document.getElementById('modalTitle').textContent = '📝 قرار التدقيق الاعتمادي وتبرير المعالجة';
  document.getElementById('modalBody').innerHTML = notesHtml;
  document.getElementById('modalOverlay').classList.add('open');
}

window._confirmWorkflow = async (id, targetStatus) => {
  const notes = document.getElementById('workflow-notes-input')?.value || '';
  const fileInput = document.getElementById('workflow-file-input');
  closeModal();
  try {
    const hasFile = fileInput && fileInput.files.length > 0;
    let fetchBody;
    if (hasFile) {
      const formData = new FormData();
      formData.append('targetStatus', targetStatus);
      formData.append('notes', notes);
      formData.append('file', fileInput.files[0]);
      fetchBody = formData;
    } else {
      fetchBody = JSON.stringify({ targetStatus, notes });
    }

    const res = await apiFetch(`/claims/${id}/workflow`, {
      method: 'POST',
      body: fetchBody
    });
    showToast(`✅ ${res.message}`);
    viewRecord('claims', id);
    renderTable('claims');

    // Notify target user
    const wfConfig = window._claimWorkflowConfig || [];
    const targetStep = wfConfig.find(s => s.label === targetStatus);
    if (targetStep && targetStep.userId) {
      notifyUser(targetStep.userId, `لديك مطالبة مالية جديدة (${id}) بانتظار اتخاذ إجراء`, `claims:${id}`);
    } else {
      if (targetStatus === 'بانتظار تدقيق رئيس القسم') notifyUser('dept_head', `مطالبة مالية جديدة لتدقيقها (${id})`, `claims:${id}`);
      if (targetStatus === 'بانتظار تدقيق المدير') notifyUser('manager', `مطالبة مالية جديدة للموافقة عليها (${id})`, `claims:${id}`);
    }
  } catch (e) {
    showToast(e.message || 'حدث خطأ أثناء حفظ الحالة', 'error');
    console.error('Workflow error:', e);
  }
};

// Single Claim Official Governmental Payment Certificate Printer via Unified Engine
async function printClaim(id) {
  try {
    const claim = await apiFetch(`/claims/${id}`);
    if (!claim) return showToast('⚠️ تعذر جلب تفاصيل المطالبة', 'error');

    if (!claim.status || !claim.status.includes('معتمدة')) {
      showToast(`⚠️ لا يمكن إصدار أو طباعة شهادة الصرف الرسمية إلا بعد إنهاء سلسلة الاعتمادات والمصادقة النهائية (الحالة الحالية: ${claim.status || 'مسودة'})`, 'warning');
      return;
    }
    try { allClaims = await apiFetch('/claims'); } catch {}

    const tenderId = claim.tenderId;
    if (!window._cachedTenders || !window._cachedTenders.length) {
      try { window._cachedTenders = await apiFetch('/tenders'); } catch {}
    }

    const tender = (window._cachedTenders || []).find(t => 
      String(t.id).trim() === String(tenderId || '').trim() ||
      String(t.name).trim() === String(tenderId || '').trim()
    );
    const tenderVal = tender ? (parseFloat(tender.value) || 0) : 0;

    const previousClaims = (allClaims || []).filter(c => {
      if (String(c.id) === String(claim.id)) return false;
      const matchId = String(c.tenderId || '').trim();
      const matchName = String(c.tenderName || '').trim();
      const targetId = String(tenderId || '').trim();
      const targetName = tender ? String(tender.name || '').trim() : '';

      const isSameTender = (matchId && matchId === targetId) || 
                           (matchName && targetName && matchName === targetName) ||
                           (matchId && targetName && matchId === targetName);
      if (!isSameTender) return false;

      const cDate = new Date(c.submitDate || c.createdAt || 0);
      const thisDate = new Date(claim.submitDate || claim.createdAt || Date.now());
      return cDate < thisDate || String(c.id) < String(claim.id);
    });

    let prevPaid = parseFloat(claim.previousPaid || claim.previouspaid || 0);
    if (prevPaid === 0 && previousClaims.length > 0) {
      prevPaid = previousClaims.reduce((sum, c) => sum + parseFloat(c.amount || c.grossCumulative || 0), 0);
    }

    const grossCurrentVal = parseFloat(claim.amount) || 0;
    const grossCumulativeVal = parseFloat(claim.grossCumulative || claim.grosscumulative) || (grossCurrentVal + prevPaid);

    let retPercent = parseFloat(claim.retentionPercent !== undefined && claim.retentionPercent !== null ? claim.retentionPercent : (claim.retentionpercent || 10));
    if (isNaN(retPercent)) retPercent = 10;

    let retVal = parseFloat(claim.retention !== undefined && claim.retention !== null ? claim.retention : (grossCurrentVal * (retPercent / 100)));
    if (isNaN(retVal)) retVal = grossCurrentVal * (retPercent / 100);

    let deductVal = parseFloat(claim.deduction !== undefined && claim.deduction !== null ? claim.deduction : 0);
    if (isNaN(deductVal)) deductVal = 0;

    let netVal = parseFloat(claim.netAmount !== undefined && claim.netAmount !== null ? claim.netAmount : (claim.netamount || Math.max(0, grossCurrentVal - retVal - deductVal)));
    if (isNaN(netVal)) netVal = Math.max(0, grossCurrentVal - retVal - deductVal);

    let boqItems = [];
    try { boqItems = typeof claim.boqItems === 'string' ? JSON.parse(claim.boqItems || '[]') : (claim.boqItems || []); } catch {}

    let boqTableHtml = '';
    if (boqItems.length > 0) {
      boqTableHtml = `
        <div style="margin-top:14px;">
          <h4 style="margin:0 0 6px;color:#1e3a8a;font-size:0.88rem;">📋 كشف تفاصيل بنود الأعمال والكميات المنفذة بالدفعة الحالية (BOQ Statement):</h4>
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem;text-align:right;border:1px solid #cbd5e1;">
            <thead style="background:#f1f5f9;color:#1e293b;">
              <tr>
                <th style="padding:6px;border:1px solid #cbd5e1;">#</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">تفاصيل بند العمل</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الوحدة</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الفئة (د.أ)</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الكمية السابقة</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الكمية الحالية</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">إجمالي الكمية</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">المبلغ المستحق (د.أ)</th>
              </tr>
            </thead>
            <tbody>
              ${boqItems.map((b, i) => `
                <tr>
                  <td style="padding:5px;border:1px solid #cbd5e1;text-align:center;">${i+1}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;">${b.desc}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;text-align:center;">${b.unit}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#047857;">${(parseFloat(b.rate)||0).toLocaleString('ar-JO')}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;">${b.prevQty||0}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#2563eb;">${b.currQty||0}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;">${b.totalQty || ((parseFloat(b.prevQty)||0)+(parseFloat(b.currQty)||0))}</td>
                  <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#047857;">${(parseFloat(b.amount)||0).toLocaleString('ar-JO')} د.أ</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    let prevClaimsTableHtml = '';
    if (previousClaims.length > 0) {
      prevClaimsTableHtml = `
        <div style="margin-top:14px;">
          <h4 style="margin:0 0 6px;color:#1e3a8a;font-size:0.88rem;">📚 سجل وتاريخ المطالبات والدفعات السابقة المسددة بالعطاء:</h4>
          <table style="width:100%;border-collapse:collapse;font-size:0.78rem;text-align:right;border:1px solid #cbd5e1;">
            <thead style="background:#f1f5f9;color:#1e293b;">
              <tr>
                <th style="padding:6px;border:1px solid #cbd5e1;">رقم المطالبة</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">تاريخ التقديم</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">المبلغ الإجمالي (د.أ)</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الخصم والمحتجزات</th>
                <th style="padding:6px;border:1px solid #cbd5e1;">الصافي المصروف (د.أ)</th>
              </tr>
            </thead>
            <tbody>
              ${previousClaims.map((pc, i) => {
                const g = parseFloat(pc.amount || pc.grossCumulative || 0);
                const d = parseFloat(pc.deduction || pc.retention || 0);
                const n = parseFloat(pc.netAmount || (g - d)) || g;
                return `
                  <tr>
                    <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#2563eb;">${pc.id} (دفعة ${i+1})</td>
                    <td style="padding:5px;border:1px solid #cbd5e1;">${pc.submitDate || '—'}</td>
                    <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#047857;">${g.toLocaleString('ar-JO')} د.أ</td>
                    <td style="padding:5px;border:1px solid #cbd5e1;color:#b91c1c;">${d.toLocaleString('ar-JO')} د.أ</td>
                    <td style="padding:5px;border:1px solid #cbd5e1;font-weight:bold;color:#1d4ed8;">${n.toLocaleString('ar-JO')} د.أ</td>
                  </tr>`;
              }).join('')}
              <tr style="background:#e0f2fe;font-weight:bold;color:#1e3a8a;">
                <td colspan="2" style="padding:6px;border:1px solid #cbd5e1;">إجمالي المطالبات والدفعات السابقة التراكمية:</td>
                <td style="padding:6px;border:1px solid #cbd5e1;color:#047857;">${prevPaid.toLocaleString('ar-JO')} د.أ</td>
                <td style="padding:6px;border:1px solid #cbd5e1;">—</td>
                <td style="padding:6px;border:1px solid #cbd5e1;color:#1d4ed8;">${prevPaid.toLocaleString('ar-JO')} د.أ</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }

    const financialSummaryHtml = `
      <div style="border:2px solid #1e3a8a;border-radius:8px;padding:12px;background:#f8fafc;margin-bottom:12px;font-size:0.85rem;line-height:1.8;">
        <h4 style="margin:0 0 8px;color:#1e3a8a;font-size:0.92rem;border-bottom:1px solid #cbd5e1;padding-bottom:4px;">💰 الخلاصة:</h4>
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;">1. إجمالي قيمة الأعمال المنفذة تراكمياً حتى تاريخه:</td><td style="text-align:left;font-weight:bold;color:#1e3a8a;">${grossCumulativeVal.toLocaleString('ar-JO')} د.أ</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;"><td style="padding:4px;color:#d97706;font-weight:bold;">2. تنزيل: إجمالي المطالبات والدفعات السابقة المسددة:</td><td style="text-align:left;font-weight:bold;color:#d97706;">(-) ${prevPaid.toLocaleString('ar-JO')} د.أ</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;background:#f0fdf4;"><td style="padding:4px;font-weight:bold;">3. قيمة الأعمال المنفذة في هذه المطالبة الحالية:</td><td style="text-align:left;font-weight:bold;color:#047857;">${grossCurrentVal.toLocaleString('ar-JO')} د.أ</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;color:#b91c1c;">4. تنزيل: اقتطاع المحتجزات وتأمين التنفيذ بنسبة (<b>${retPercent}%</b>):</td><td style="text-align:left;font-weight:bold;color:#b91c1c;">(-) ${retVal.toLocaleString('ar-JO')} د.أ</td></tr>
          ${deductVal > 0 ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:4px;color:#b91c1c;">5. تنزيل: خصميات وأمانات ومخالفات أخرى:</td><td style="text-align:left;font-weight:bold;color:#b91c1c;">(-) ${deductVal.toLocaleString('ar-JO')} د.أ</td></tr>` : ''}
          <tr style="background:#e0f2fe;font-weight:bold;"><td style="padding:8px;font-size:0.92rem;color:#1e3a8a;">6. صافي المبلغ المستحق والصافي الصريح للصرف بموجب هذه الشهادة:</td><td style="text-align:left;font-size:1.1rem;color:#1e3a8a;">${netVal.toLocaleString('ar-JO')} د.أ</td></tr>
        </table>
      </div>
      ${prevClaimsTableHtml}
      ${boqTableHtml}`;

    // جلب سلسلة الاعتمادات المعتمدة من النظام بدلاً من الافتراضية
    let wfConfig = [];
    try {
      wfConfig = await apiFetch('/claim-workflow-config');
    } catch (e) {}

    let dynamicSignatures = [];
    if (Array.isArray(wfConfig) && wfConfig.length > 0) {
      dynamicSignatures = wfConfig.map((s, idx) => {
        const isFinal = idx === wfConfig.length - 1;
        const roleTitle = s.printLabel || s.label || s.userName || `المعتمد ${idx + 1}`;
        return {
          order: idx + 1,
          key: `WF_STEP_${idx + 1}`,
          stageTitle: s.label || roleTitle,
          roleName: roleTitle,
          icon: isFinal ? '✅' : (idx === 0 ? '📝' : '🔍'),
          signLabel: isFinal ? 'التوقيع والاعتماد الرسمي' : 'التوقيع والتاريخ',
          isFinal: isFinal
        };
      });
    }

    printStandardDocument({
      title: `شهادة دفعة إنجازية مالية معتمدة (${claim.type || 'مطالبة مالية'})`,
      subtitle: 'بلدية كفرنجة الجديدة — مديرية الهندسة والأشغال / قسم الحسابات والمشاريع',
      refNumber: `PAY-CERT-${claim.id}`,
      date: claim.submitDate || new Date().toLocaleDateString('ar-JO'),
      type: 'single',
      fields: [
        { label: 'رقم وثيقة المطالبة', value: claim.id },
        { label: 'اسم العطاء / المشروع', value: claim.tenderName || tender?.name || claim.tenderId || 'غير محدد' },
        { label: 'اسم المقاول / مقدم المطالبة', value: claim.claimant || tender?.contractor || 'مؤسسة الخدمات العامة' },
        { label: 'قيمة العطاء الأصلية', value: tenderVal ? tenderVal.toLocaleString('ar-JO') + ' د.أ' : '—' },
        { label: 'نوع الدفعة / المطالبة', value: claim.type || 'مطالبة إنجاز' },
        { label: 'نسبة الإنجاز التراكمية المعتمدة', value: (claim.completionPercent || 0) + '%' },
        { label: 'حالة الاعتماد بالمسار', value: claim.status || 'معتمدة' }
      ],
      summaryHtml: financialSummaryHtml,
      approvalWorkflow: dynamicSignatures.length > 0 ? dynamicSignatures : undefined,
      showApprovalChain: true,
      signatures: true
    });
  } catch (e) {
    showToast('خطأ أثناء إعداد طباعة شهادة المطالبة: ' + e.message, 'error');
  }
}

// ==========================================
// GOVERNMENTAL CLAIMS & BOQ MANAGEMENT HELPERS
// ==========================================

window.onTenderSelectInClaimForm = async function() {
  const tenderId = document.getElementById('f-tenderId')?.value;
  if (!tenderId) return;

  if (!window._cachedTenders || !window._cachedTenders.length) {
    try { window._cachedTenders = await apiFetch('/tenders'); } catch {}
  }

  const tender = (window._cachedTenders || []).find(t => 
    String(t.id).trim() === String(tenderId).trim() ||
    String(t.name).trim() === String(tenderId).trim()
  );

  const claimantInput = document.getElementById('f-claimant');
  if (claimantInput && tender && tender.contractor) {
    claimantInput.value = tender.contractor;
  }

  let allClaims = [];
  try {
    allClaims = await apiFetch('/claims');
  } catch (e) {
    allClaims = window.reportsClaims || [];
  }

  const modal = document.getElementById('modal');
  const editId = modal?.dataset?.editId;

  const previousClaims = (allClaims || []).filter(c => {
    if (editId && String(c.id) === String(editId)) return false;
    const matchId = String(c.tenderId || '').trim();
    const matchName = String(c.tenderName || '').trim();
    const targetId = String(tenderId || '').trim();
    const targetName = tender ? String(tender.name || '').trim() : '';

    return (matchId && matchId === targetId) || 
           (matchName && targetName && matchName === targetName) ||
           (matchId && targetName && matchId === targetName);
  });

  const prevContainer = document.getElementById('claim-prev-table-container');
  const countBadge = document.getElementById('claim-prev-count-badge');

  if (countBadge) countBadge.textContent = `${previousClaims.length} مطالبات سابقة`;

  let totalPreviousGross = 0;
  let totalPreviousNetPaid = 0;

  if (previousClaims.length === 0) {
    if (prevContainer) {
      prevContainer.innerHTML = `<div style="text-align:center;padding:10px;color:#94a3b8;font-size:0.8rem;">ℹ️ لا توجد مطالبات سابقة مسجلة لهذا العطاء (هذه المطالبة رقم 1).</div>`;
    }
  } else {
    previousClaims.sort((a,b) => new Date(a.submitDate || a.createdAt || 0) - new Date(b.submitDate || b.createdAt || 0));
    
    let tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;text-align:right;margin-top:4px;">
        <thead style="background:#1e293b;color:#94a3b8;border-bottom:1px solid #334155;">
          <tr>
            <th style="padding:6px;">رقم المطالبة</th>
            <th style="padding:6px;">تاريخ التقديم</th>
            <th style="padding:6px;">المبلغ الإجمالي (د.أ)</th>
            <th style="padding:6px;">الخصم والتأمين</th>
            <th style="padding:6px;">الصافي المصروف (د.أ)</th>
            <th style="padding:6px;">الحالة</th>
          </tr>
        </thead>
        <tbody>`;

    previousClaims.forEach((c, idx) => {
      const g = parseFloat(c.amount || c.grossCumulative || 0);
      const d = parseFloat(c.deduction || c.retention || 0);
      const n = parseFloat(c.netAmount || (g - d)) || g;
      totalPreviousGross += g;
      totalPreviousNetPaid += n;

      tableHtml += `
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:5px;font-weight:bold;color:#38bdf8;">${c.id} (دفعة ${idx+1})</td>
          <td style="padding:5px;color:#cbd5e1;">${c.submitDate || '—'}</td>
          <td style="padding:5px;font-weight:bold;color:#34d399;">${g.toLocaleString('ar-JO')}</td>
          <td style="padding:5px;color:#fca5a5;">${d.toLocaleString('ar-JO')}</td>
          <td style="padding:5px;font-weight:bold;color:#60a5fa;">${n.toLocaleString('ar-JO')}</td>
          <td style="padding:5px;"><span style="background:#065f46;color:#34d399;padding:1px 6px;border-radius:4px;font-size:0.72rem;">${c.status || 'معتمدة'}</span></td>
        </tr>`;
    });

    tableHtml += `
        <tr style="background:#020617;font-weight:bold;color:#38bdf8;">
          <td colspan="2" style="padding:6px;">إجمالي المطالبات والدفعات السابقة التراكمية:</td>
          <td style="padding:6px;color:#34d399;">${totalPreviousGross.toLocaleString('ar-JO')} د.أ</td>
          <td style="padding:6px;">—</td>
          <td style="padding:6px;color:#60a5fa;">${totalPreviousNetPaid.toLocaleString('ar-JO')} د.أ</td>
          <td></td>
        </tr>
      </tbody>
      </table>`;

    if (prevContainer) prevContainer.innerHTML = tableHtml;
  }

  const prevPaidInput = document.getElementById('f-previousPaid');
  if (prevPaidInput) prevPaidInput.value = totalPreviousGross;

  window.setupClaimBoqItems(previousClaims, tender);
  window.calculateClaimFinancialTotals();
};

window.setupClaimBoqItems = function(previousClaims = [], tender = null) {
  const tbody = document.getElementById('claim-boq-tbody');
  if (!tbody) return;

  const itemPrevQtyMap = {};
  previousClaims.forEach(c => {
    let items = [];
    try {
      items = typeof c.boqItems === 'string' ? JSON.parse(c.boqItems || '[]') : (c.boqItems || []);
    } catch {}
    items.forEach(it => {
      const key = (it.desc || '').trim();
      if (key) {
        itemPrevQtyMap[key] = (itemPrevQtyMap[key] || 0) + (parseFloat(it.currQty) || 0);
      }
    });
  });

  const defaultItems = [
    { desc: 'أعمال الحفريات الترابية والهيدروليكية ومواد التأسيس', unit: 'م3', rate: 12, contractQty: 500, currQty: 100 },
    { desc: 'توريد وصب خرسانة مسلحة عيار B250 للقواعد والجدران', unit: 'م3', rate: 75, contractQty: 150, currQty: 30 },
    { desc: 'فرش ودك خلطة إسفلتية رابطة سمك 7سم مع اللصق', unit: 'م2', rate: 8.5, contractQty: 1200, currQty: 250 }
  ];

  tbody.innerHTML = '';
  defaultItems.forEach((it) => {
    const prevQ = itemPrevQtyMap[it.desc] || 0;
    window.addClaimBoqRow(it.desc, it.unit, it.rate, it.contractQty, prevQ, it.currQty);
  });
};

window.addClaimBoqRow = function(desc = '', unit = 'م3', rate = 0, contractQty = 0, prevQty = 0, currQty = 0) {
  const tbody = document.getElementById('claim-boq-tbody');
  if (!tbody) return;

  const rowIdx = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.style.cssText = 'border-bottom:1px solid var(--border);';

  tr.innerHTML = `
    <td style="padding:6px;font-weight:bold;color:var(--primary);">${rowIdx}</td>
    <td style="padding:6px;"><input type="text" class="boq-desc" value="${desc}" placeholder="بيان وتفاصيل بند العمل" style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:0.79rem;" /></td>
    <td style="padding:6px;">
      <select class="boq-unit" style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:0.77rem;">
        <option value="م3" ${unit==='م3'?'selected':''}>م3</option>
        <option value="م2" ${unit==='م2'?'selected':''}>م2</option>
        <option value="م.ط" ${unit==='م.ط'?'selected':''}>م.ط</option>
        <option value="كغم" ${unit==='كغم'?'selected':''}>كغم</option>
        <option value="طن" ${unit==='طن'?'selected':''}>طن</option>
        <option value="عدد" ${unit==='عدد'?'selected':''}>عدد</option>
        <option value="مقطوعية" ${unit==='مقطوعية'?'selected':''}>مقطوعية</option>
      </select>
    </td>
    <td style="padding:6px;"><input type="number" class="boq-rate" value="${rate}" placeholder="0" step="0.1" oninput="calculateClaimFinancialTotals()" style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:0.79rem;" /></td>
    <td style="padding:6px;"><input type="number" class="boq-cqty" value="${contractQty}" placeholder="0" style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:0.79rem;" /></td>
    <td style="padding:6px;"><input type="number" class="boq-pqty" value="${prevQty}" readonly style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:4px;font-size:0.79rem;" /></td>
    <td style="padding:6px;"><input type="number" class="boq-currqty" value="${currQty}" placeholder="0" step="0.1" oninput="calculateClaimFinancialTotals()" style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:#10b981;font-weight:bold;border-radius:4px;font-size:0.79rem;" /></td>
    <td style="padding:6px;"><input type="number" class="boq-tqty" value="${prevQty + currQty}" readonly style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:#38bdf8;border-radius:4px;font-size:0.79rem;font-weight:bold;" /></td>
    <td style="padding:6px;"><input type="number" class="boq-amount" value="${currQty * rate}" readonly style="width:100%;padding:4px;background:var(--bg);border:1px solid var(--border);color:#059669;font-weight:bold;border-radius:4px;font-size:0.8rem;" /></td>
    <td style="padding:6px;text-align:center;"><button type="button" onclick="this.closest('tr').remove();calculateClaimFinancialTotals();" style="background:#dc2626;color:#fff;border:none;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:0.75rem;">✕</button></td>
  `;

  tbody.appendChild(tr);
};

window.calculateClaimFinancialTotals = function(isManualRetention = false) {
  let grossCurrentAmount = 0;
  let grossCumulativeAmount = 0;

  const rows = document.querySelectorAll('#claim-boq-tbody tr');
  rows.forEach((tr) => {
    const rate = parseFloat(tr.querySelector('.boq-rate')?.value) || 0;
    const prevQ = parseFloat(tr.querySelector('.boq-pqty')?.value) || 0;
    const currQ = parseFloat(tr.querySelector('.boq-currqty')?.value) || 0;

    const totalQ = prevQ + currQ;
    const itemCurrentAmount = currQ * rate;
    const itemCumulativeAmount = totalQ * rate;

    const tqEl = tr.querySelector('.boq-tqty');
    const amEl = tr.querySelector('.boq-amount');
    if (tqEl) tqEl.value = totalQ.toFixed(1);
    if (amEl) amEl.value = itemCurrentAmount.toFixed(2);

    grossCurrentAmount += itemCurrentAmount;
    grossCumulativeAmount += itemCumulativeAmount;
  });

  const prevGrossPaid = parseFloat(document.getElementById('f-previousPaid')?.value) || 0;

  if (grossCumulativeAmount === 0 && grossCurrentAmount > 0) {
    grossCumulativeAmount = grossCurrentAmount + prevGrossPaid;
  }

  const grossCumInput = document.getElementById('f-grossCumulative');
  if (grossCumInput) grossCumInput.value = grossCumulativeAmount.toFixed(2);

  const amountInput = document.getElementById('f-amount');
  if (amountInput) amountInput.value = grossCurrentAmount.toFixed(2);

  const retPercentInput = document.getElementById('f-retentionPercent');
  const retInput = document.getElementById('f-retention');
  let retentionDeduction = 0;

  if (isManualRetention && retInput && retInput.value !== '') {
    retentionDeduction = parseFloat(retInput.value) || 0;
    const computedPercent = grossCurrentAmount > 0 ? (retentionDeduction / grossCurrentAmount) * 100 : 0;
    if (retPercentInput) retPercentInput.value = computedPercent.toFixed(1);
  } else {
    const valStr = retPercentInput ? retPercentInput.value : '';
    const retPercent = (valStr !== undefined && valStr !== null && valStr !== '') ? (parseFloat(valStr) || 0) : 0;
    retentionDeduction = grossCurrentAmount * (retPercent / 100);
    if (retInput) retInput.value = retentionDeduction.toFixed(2);
  }

  const otherDeduction = parseFloat(document.getElementById('f-deduction')?.value) || 0;

  const netPayable = Math.max(0, grossCurrentAmount - retentionDeduction - otherDeduction);
  const netInput = document.getElementById('f-netAmount');
  if (netInput) netInput.value = netPayable.toFixed(2);

  const tenderId = document.getElementById('f-tenderId')?.value;
  const tender = (window._cachedTenders || []).find(t => 
    String(t.id).trim() === String(tenderId || '').trim() ||
    String(t.name).trim() === String(tenderId || '').trim()
  );
  const tenderValue = tender ? (parseFloat(tender.value) || 1) : 1;

  const completionPercent = Math.min(100, (grossCumulativeAmount / tenderValue) * 100);

  const compInput = document.getElementById('f-completionPercent');
  if (compInput) compInput.value = completionPercent.toFixed(1);
};

// ===== Delete Confirmation =====

let deleteTarget = null;
function confirmDelete(type, id) {
  deleteTarget = { type, id };
  document.getElementById('confirmOverlay').classList.add('open');
}

document.getElementById('confirmCancel')?.addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.remove('open');
  deleteTarget = null;
});

document.getElementById('confirmOk')?.addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    await apiFetch(`/${deleteTarget.type}/${deleteTarget.id}`, { method: 'DELETE' });
    showToast('🗑️ تم الحذف بنجاح');
    document.getElementById('confirmOverlay').classList.remove('open');
    if (deleteTarget.type === 'archive') renderArchive();
    else if (deleteTarget.type === 'users') renderUsers();
    else if (deleteTarget.type === 'tenders') {
      if (typeof tendersManager !== 'undefined' && tendersManager) tendersManager.loadData();
    }
    else renderTable(deleteTarget.type);
  } catch (e) { }
  deleteTarget = null;
});

// ===== Toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Export / Import (Encrypted Backups)
async function exportDB() {
  if (window.unifiedSettingsManager && typeof window.unifiedSettingsManager.triggerInstantBackup === 'function') {
    await window.unifiedSettingsManager.triggerInstantBackup();
    return;
  }
  try {
    showToast('⏳ جاري إنشاء وتشفير النسخة الاحتياطية بـ AES-256...');
    const res = await apiFetch('/v4/admin/trigger-backup', { method: 'POST' });
    if (res && res.data && res.data.filename) {
      showToast('✅ تم إنشاء النسخة الاحتياطية المشفرة بنجاح: ' + res.data.filename);
      const token = localStorage.getItem('token');
      const url = `/api/v4/admin/download-backup/${encodeURIComponent(res.data.filename)}`;
      fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
        .then(r => r.blob())
        .then(blob => {
          const a = document.createElement('a');
          a.href = window.URL.createObjectURL(blob);
          a.download = res.data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
    }
  } catch (e) {
    showToast('❌ خطأ في إنشاء النسخة الاحتياطية: ' + e.message);
  }
}

async function importDB(input) {
  if (window.unifiedSettingsManager && typeof window.unifiedSettingsManager.handleImportBackup === 'function') {
    await window.unifiedSettingsManager.handleImportBackup(input);
    return;
  }
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (!confirm('⚠️ تحذير: استيراد قاعدة البيانات سيقوم بتحديث البيانات الحالية. هل تود المتابعة؟')) {
    input.value = '';
    return;
  }

  showToast('⏳ جاري قراءة واسترجاع قاعدة البيانات...');
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      await apiFetch('/v4/admin/restore-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof content === 'string' ? content : JSON.stringify(content)
      });
      showToast('✅ تم استرجاع قاعدة البيانات بنجاح. جاري التحديث...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('❌ فشل استرجاع قاعدة البيانات: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsText(file);
}

async function printPurchasesList() {
  try {
    const purchases = await apiFetch('/purchases');
    printStandardDocument({
      title: 'جدول أوامر الشراء والمشتريات المحلية',
      subtitle: 'قسم اللوازم والمشتريات',
      type: 'list',
      data: purchases.map(p => ({
        id: p.id,
        supplier: p.supplier || '—',
        description: p.description || '—',
        totalPrice: Number(p.totalPrice || (p.qty * p.unitPrice) || 0).toLocaleString('ar-JO') + ' د.أ',
        status: p.status || '—'
      })),
      columns: [
        { key: 'id', label: 'رقم الأمر' },
        { key: 'supplier', label: 'المورد' },
        { key: 'description', label: 'بيان المشتريات' },
        { key: 'totalPrice', label: 'القيمة الإجمالية' },
        { key: 'status', label: 'الحالة' }
      ]
    });
  } catch (e) { showToast('خطأ في إعداد طباعة المشتريات', 'error'); }
}

async function printPurchaseSingle(id) {
  try {
    const p = await apiFetch(`/purchases/${id}`);
    if (!p) return showToast('تعذر جلب تفاصيل طلب الشراء', 'error');
    printStandardDocument({
      title: `أمر شراء محلي رسمـي (رقم ${p.id})`,
      subtitle: 'قسم اللوازم والمشتريات المحلية',
      refNumber: p.id,
      type: 'single',
      fields: [
        { label: 'رقم أمر الشراء', value: p.id },
        { label: 'المورد / التاجر', value: p.supplier },
        { label: 'بيان وأوصاف المشتريات', value: p.description },
        { label: 'الكمية المطلوبة', value: p.qty },
        { label: 'سعر الوحدة', value: Number(p.unitPrice || 0).toLocaleString('ar-JO') + ' د.أ' },
        { label: 'الإجمالي الصافي', value: Number(p.totalPrice || (p.qty * p.unitPrice) || 0).toLocaleString('ar-JO') + ' د.أ' },
        { label: 'حالة الأمر', value: p.status }
      ]
    });
  } catch (e) { showToast('خطأ في إعداد أمر الشراء', 'error'); }
}

async function printTasksList() {
  try {
    const tasks = await apiFetch('/tasks');
    printStandardDocument({
      title: 'سجل الكشوفات والمهام الميدانية للهندسة والأشغال',
      subtitle: 'قسم المتابعة والكشوفات الميدانية',
      type: 'list',
      data: tasks.map(t => ({
        id: t.id,
        title: t.title,
        assignedTo: t.assignedTo || 'غير محدد',
        priority: t.priority,
        status: t.status
      })),
      columns: [
        { key: 'id', label: 'رمز المهمة' },
        { key: 'title', label: 'عنوان المهمة / الكشف' },
        { key: 'assignedTo', label: 'الموظف المكلف' },
        { key: 'priority', label: 'الأولية' },
        { key: 'status', label: 'الحالة' }
      ]
    });
  } catch (e) { showToast('خطأ في طباعة المهام الميدانية', 'error'); }
}

async function printTaskSingle(id) {
  try {
    const t = await apiFetch(`/tasks/${id}`);
    if (!t) return showToast('تعذر جلب بيانات المهمة', 'error');
    printStandardDocument({
      title: `تقرير كشف معاينة ميدانية (${t.title})`,
      subtitle: 'قسم المتابعة الميدانية والسلامة',
      refNumber: t.id,
      type: 'single',
      fields: [
        { label: 'رمز المهمة', value: t.id },
        { label: 'عنوان المعاينة / المهمة', value: t.title },
        { label: 'الموظف الفني المكلف', value: t.assignedTo || 'غير محدد' },
        { label: 'درجة الأولوية', value: t.priority },
        { label: 'حالة المهمة', value: t.status },
        { label: 'تفاصيل التقرير الفني والملاحظات', value: t.description || t.notes || 'تم إجراء الكشف الفني الميداني والتثبت من الموقع' }
      ]
    });
  } catch (e) { showToast('خطأ في طباعة التقرير الميداني', 'error'); }
}

async function renderActivityLog() {
  try {
    const tbody = document.getElementById('activity-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="loading"><div class="spinner"></div> جاري تحميل سجل النشاطات...</div></td></tr>`;
    
    const res = await apiFetch('/activity?limit=100');
    const items = Array.isArray(res) ? res : (res && res.data ? res.data : []);

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>لا توجد نشاطات مسجلة حتى الآن</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(row => {
      let badgeClass = 's-progress';
      const act = row.action || '';
      if (act.includes('حذف') || act.includes('فشل')) badgeClass = 's-danger';
      else if (act.includes('إضافة') || act.includes('إنشاء') || act.includes('اعتماد') || act.includes('دخول')) badgeClass = 's-open';
      else if (act.includes('آلي') || act.includes('قفل') || act.includes('خروج')) badgeClass = 's-warn';

      const timeStr = row.createdAt || row.timestamp || Date.now();
      const ipStr = row.ip_address ? `<br><small style="color:var(--text-muted);font-family:monospace;">IP: ${row.ip_address}</small>` : '';

      return `<tr>
        <td><span style="font-size:0.8rem; font-family:monospace; color:var(--text-muted); font-weight:bold;">${row.id || '-'}</span></td>
        <td><strong>${row.userName || row.userId || 'مستخدم النظام'}</strong>${ipStr}</td>
        <td><span class="status-badge ${badgeClass}">${act}</span></td>
        <td><span style="font-weight:600; color:var(--primary);">${row.entity || 'عام'}</span></td>
        <td style="font-size:0.88rem;">${row.details || '-'}</td>
        <td dir="ltr" style="text-align:right; font-size:0.82rem; color:var(--text-muted);">${new Date(timeStr).toLocaleString('ar-JO')}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    const tbody = document.getElementById('activity-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p style="color:#ef4444;">تعذر تحميل سجل النشاطات: ${e.message}</p></div></td></tr>`;
  }
}

function updateTendersSummary(tenders) {
  let worksCount = 0;
  let worksValue = 0;
  let suppliesCount = 0;
  let suppliesValue = 0;
  let publicCount = 0;
  let directCount = 0;

  tenders.forEach(t => {
    const val = Number(t.value) || 0;
    if (t.tenderType === 'أشغال') {
      worksCount++;
      worksValue += val;
    } else if (t.tenderType === 'لوازم') {
      suppliesCount++;
      suppliesValue += val;
    }

    if (t.purchaseMethod === 'مناقصة عامة') {
      publicCount++;
    } else if (t.purchaseMethod === 'شراء مباشر') {
      directCount++;
    }
  });

  const worksCountEl = document.getElementById('kpi-works-count');
  const worksValEl = document.getElementById('kpi-works-value');
  const suppliesCountEl = document.getElementById('kpi-supplies-count');
  const suppliesValEl = document.getElementById('kpi-supplies-value');
  const publicCountEl = document.getElementById('kpi-public-count');
  const directCountEl = document.getElementById('kpi-direct-count');

  if (worksCountEl) worksCountEl.textContent = `${worksCount} عطاء`;
  if (worksValEl) worksValEl.textContent = `${worksValue.toLocaleString('ar-JO')} د.أ`;
  if (suppliesCountEl) suppliesCountEl.textContent = `${suppliesCount} عطاء`;
  if (suppliesValEl) suppliesValEl.textContent = `${suppliesValue.toLocaleString('ar-JO')} د.أ`;
  if (publicCountEl) publicCountEl.textContent = `${publicCount} مناقصة عامة`;
  if (directCountEl) directCountEl.textContent = `${directCount} شراء مباشر`;
}

function runTenderGuideRules() {
  const tenderType = document.getElementById('f-tenderType')?.value;
  const committee = document.getElementById('f-purchaseCommittee')?.value;
  const method = document.getElementById('f-purchaseMethod')?.value;
  const val = parseFloat(document.getElementById('f-value')?.value || 0);
  const guideBox = document.getElementById('tender-guide-box');

  if (!guideBox) return;

  let messages = [];
  let isError = false;

  // Rules based on Jordanian municipal bylaws thresholds
  if (tenderType === 'لوازم') {
    if (val > 20000 && committee === 'لجنة الشراء المحلية') {
      messages.push('⚠️ <b>تنبيه الأنظمة</b>: مشتريات اللوازم التي تتجاوز قيمتها 20,000 د.أ لا تقع ضمن صلاحية لجنة الشراء المحلية، ويجب إحالتها للجنة الشراء الرئيسية.');
      isError = true;
    }
    if (val > 5000 && method === 'شراء مباشر') {
      messages.push('⚠️ <b>ملاحظة إجرائية</b>: الشراء المباشر للوازم يُفضل ألا يتجاوز 5,000 د.أ إلا في حالات الطوارئ القصوى وبموافقة الوزير.');
    }
  } else if (tenderType === 'أشغال') {
    if (val > 50000 && committee === 'لجنة الشراء المحلية') {
      messages.push('⚠️ <b>تنبيه الأنظمة</b>: عطاءات الأشغال التي تتجاوز قيمتها 50,000 د.أ تتطلب مصادقة لجنة الشراء الرئيسية.');
      isError = true;
    }
    if (val > 10000 && method === 'شراء مباشر') {
      messages.push('⚠️ <b>ملاحظة إجرائية</b>: أشغال الصيانة والشراء المباشر التي تتجاوز 10,000 د.أ تتطلب طرح مناقصة عامة أو محدودة لضمان النزاهة.');
    }
  }

  // Committee specifics
  if (committee === 'الرئيس' && val > 5000) {
    messages.push('❌ <b>تنبيه الصلاحية</b>: صلاحية الصرف والشراء الفردية المباشرة لرئيس البلدية تقتصر عادةً على المبالغ دون 5,000 د.أ.');
    isError = true;
  }

  if (messages.length > 0) {
    guideBox.style.display = 'block';
    guideBox.className = isError ? 'guide-box-error' : 'guide-box-warn';
    guideBox.innerHTML = messages.join('<br>');
  } else {
    // Show a green info box if everything is compliant
    guideBox.style.display = 'block';
    guideBox.className = 'guide-box-success';
    guideBox.innerHTML = `🟢 <b>مطابق للتعليمات</b>: قيمة العطاء (${val.toLocaleString('ar-JO')} د.أ) متوافقة مع الصلاحيات الفنية لـ (${committee}) وطريقة الشراء (${method}).`;
  }
}


// ===== CLAIMS HELPER FUNCTIONS =====

function updateClaimsKPI(data) {
  const total = data.length;
  const draft = data.filter(c => c.status && c.status.includes('مسودة')).length;
  const pending = data.filter(c => c.status && c.status.includes('بانتظار')).length;
  const approved = data.filter(c => c.status && c.status.includes('معتمدة')).length;
  const rejected = data.filter(c => c.status && c.status.includes('مرفوضة')).length;
  const totalAmount = data.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ckpi-total', total);
  set('ckpi-draft', draft);
  set('ckpi-pending', pending);
  set('ckpi-approved', approved);
  set('ckpi-rejected', rejected);
  set('ckpi-amount', totalAmount.toLocaleString('ar-JO'));
}

async function loadClaimWorkflowPipeline() {
  try {
    const steps = await apiFetch('/claim-workflow-config');
    window._claimWorkflowConfig = steps || [];

    const pipeline = document.getElementById('workflow-pipeline');
    const stepsEl = document.getElementById('pipeline-steps-display');
    const isAdmin = currentUser?.role === 'admin';
    const configBtn = document.getElementById('btn-workflow-config');
    if (configBtn) configBtn.style.display = isAdmin ? 'flex' : 'none';

    if (!steps || !steps.length) {
      if (pipeline) pipeline.style.display = 'none';
      return;
    }
    if (pipeline) pipeline.style.display = 'flex';
    if (stepsEl) {
      stepsEl.innerHTML = steps.map((s, i) => `
        <div class="pipeline-step">
          <div class="pipeline-step-node">${i + 1}. ${s.label || s.printLabel || 'مدقق'}</div>
          ${i < steps.length - 1 ? '<span class="pipeline-step-arrow">←</span>' : ''}
        </div>`).join('');
    }
  } catch (e) { }
}

function filterClaimsBy(statusKeyword) {
  const statusFilter = document.getElementById('claims-status-filter');
  if (statusFilter) {
    let matched = false;
    for (let opt of statusFilter.options) {
      if (opt.value && opt.value.includes(statusKeyword)) {
        statusFilter.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) statusFilter.value = '';
  }
  currentFilters.claims.status = statusFilter?.value || '';
  renderTable('claims');
}

async function openClaimWorkflowConfig() {
  let allUsers = [], currentSteps = [];
  try {
    allUsers = await apiFetch('/users');
    window._allSystemUsers = allUsers;
    currentSteps = await apiFetch('/claim-workflow-config');
  } catch (e) { }

  let stepsHtml = (currentSteps || []).map((s, i) => `
    <div class="workflow-config-step" id="wfstep-${i}" style="display:flex;gap:8px;align-items:center;padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border);border-right:4px solid var(--primary);border-radius:8px;margin-bottom:8px;">
      <span style="font-size:1.1rem;font-weight:800;color:var(--primary);min-width:24px;">${i + 1}</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:0.9rem;color:var(--text);">${s.label || s.printLabel || s.userName || 'مدقق معتمد'}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${s.userName ? `المستخدم: ${s.userName}` : s.userId} | المسمى في الطباعة: <b style="color:var(--primary);">${s.printLabel || s.label || '—'}</b></div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="removeWorkflowStep(${i})" title="حذف الخطوة">✕</button>
    </div>`).join('');

  const defaultRoleMap = {
    'admin': 'مدير الأشغال والخدمات الهندسية',
    'manager': 'مدير الأشغال والخدمات الهندسية',
    'dept_head': 'رئيس القسم',
    'engineer': 'المهندس',
    'accountant': 'المدقق المالي / قسم الحسابات',
    'inspector': 'مراقب الموقع الميداني'
  };

  let usersOptions = allUsers.map(u => `<option value="${u.id}" data-role="${u.role}" data-name="${u.fullName}">${u.fullName} (${defaultRoleMap[u.role] || u.role})</option>`).join('');

  document.getElementById('modalTitle').textContent = '⚙️ إعداد سلسلة وتواقيع الاعتماد الرسمية للمطالبات';
  document.getElementById('modalBody').innerHTML = `
    <div style="padding:5px 0;direction:rtl;font-family:'Tajawal',sans-serif;">
      <p style="color:var(--text-muted);font-size:0.84rem;margin-bottom:14px;">حدد التسلسل الإداري للمعتمدين حسب الأصول. سيتم تطبيق هذه السلسلة في دورة التدقيق وفي خانات التواقيع بأسفل شهادة الصرف الرسمية.</p>
      <div id="workflow-steps-list">${stepsHtml}</div>
      <div style="background:var(--bg);border:1px dashed var(--border);border-radius:10px;padding:12px;margin:14px 0;">
        <div style="font-weight:bold;font-size:0.84rem;color:var(--primary);margin-bottom:8px;">➕ إضافة خطوة / معتمد جديد إلى السلسلة:</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="wf-user-select" onchange="onWorkflowUserSelectChange()" style="flex:1;min-width:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);">${usersOptions}</select>
          <input id="wf-label-input" type="text" placeholder="المسمى الوظيفي في الطباعة (مثل: رئيس القسم)" style="flex:2;min-width:240px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);" />
          <button class="btn btn-primary" onclick="addWorkflowStep()">+ إضافة للسلسلة</button>
        </div>
      </div>
      <div class="form-actions" style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-success" onclick="saveWorkflowConfig()">💾 حفظ وتطبيق السلسلة فوراً</button>
      </div>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
  window._workflowSteps = JSON.parse(JSON.stringify(currentSteps || []));
  setTimeout(() => onWorkflowUserSelectChange(), 50);
}

window.onWorkflowUserSelectChange = function () {
  const sel = document.getElementById('wf-user-select');
  const labelInput = document.getElementById('wf-label-input');
  if (!sel || !labelInput) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const role = opt.dataset.role;
  const name = opt.dataset.name;
  const defaultRoleMap = {
    'admin': 'مدير الأشغال والخدمات الهندسية',
    'manager': 'مدير الأشغال والخدمات الهندسية',
    'dept_head': 'رئيس القسم',
    'engineer': 'المهندس',
    'accountant': 'المدقق المالي / قسم الحسابات',
    'inspector': 'مراقب الموقع الميداني'
  };
  const suggested = defaultRoleMap[role] || `${name}`;
  labelInput.value = suggested;
};

window.addWorkflowStep = function () {
  const sel = document.getElementById('wf-user-select');
  const userId = sel?.value;
  const opt = sel?.options[sel.selectedIndex];
  const userName = opt?.dataset.name || userId;
  const userRole = opt?.dataset.role || '';
  const label = document.getElementById('wf-label-input')?.value || userName;
  if (!userId) return;
  window._workflowSteps = window._workflowSteps || [];
  window._workflowSteps.push({ userId, label, printLabel: label, userName, userRole });
  refreshWorkflowStepsList();
};

window.removeWorkflowStep = function (idx) {
  window._workflowSteps.splice(idx, 1);
  refreshWorkflowStepsList();
};

function refreshWorkflowStepsList() {
  const list = document.getElementById('workflow-steps-list');
  if (!list) return;
  list.innerHTML = (window._workflowSteps || []).map((s, i) => `
    <div style="display:flex;gap:8px;align-items:center;padding:10px 12px;background:var(--bg-surface);border:1px solid var(--border);border-right:4px solid var(--primary);border-radius:8px;margin-bottom:8px;">
      <span style="font-size:1.1rem;font-weight:800;color:var(--primary);min-width:24px;">${i + 1}</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:0.9rem;color:var(--text);">${s.label || s.printLabel || s.userName || 'مدقق'}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${s.userName ? `المستخدم: ${s.userName}` : s.userId} | المسمى في الطباعة: <b style="color:var(--primary);">${s.printLabel || s.label || '—'}</b></div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="removeWorkflowStep(${i})" title="حذف الخطوة">✕</button>
    </div>`).join('');
}

window.saveWorkflowConfig = async function () {
  try {
    const res = await apiFetch('/claim-workflow-config', {
      method: 'POST',
      body: JSON.stringify({ steps: window._workflowSteps || [] })
    });
    showToast('✅ تم حفظ وتطبيق سلسلة الاعتماد بنجاح');
    closeModal();
    if (window.unifiedClaimsManager) {
      window.unifiedClaimsManager.workflowConfig = res.steps || window._workflowSteps;
      window.unifiedClaimsManager.renderPipelineBanner();
    }
  } catch (e) {
    showToast('⚠️ فشل حفظ الإعدادات: ' + e.message, 'error');
  }
};


window.printClaimsTable = async function () {
  const status = currentFilters.claims.status;
  const search = currentFilters.claims.search;
  const tenderId = currentFilters.claims.tenderId;
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (tenderId) params.append('tenderId', tenderId);

  try {
    const data = await apiFetch(`/claims?${params}`);
    if (!data || !data.length) {
      showToast('⚠️ لا توجد مطالبات مطابقة للطباعة');
      return;
    }

    const sumGross = data.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
    const sumNet = data.reduce((sum, row) => sum + (parseFloat(row.netAmount || row.net_amount) || (parseFloat(row.amount) || 0)), 0);

    const summaryHtml = `
      <div style="margin-top:14px;padding:10px 14px;background:#f0fdf4;border:1.5px solid #059669;border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:0.88rem;flex-wrap:wrap;gap:10px;">
        <span style="font-weight:bold;color:#065f46;">📊 إجمالي قيمة المطالبات المفوترة: <b>${sumGross.toLocaleString('ar-JO')} د.أ</b></span>
        <span style="font-weight:bold;color:#047857;background:#d1fae5;padding:4px 10px;border-radius:6px;">💰 إجمالي المبالغ الصافية للصرف: <b>${sumNet.toLocaleString('ar-JO')} د.أ</b></span>
      </div>
    `;

    printStandardDocument({
      title: `كشف وجرد المطالبات المالية والدفعات الإنجازية ${status ? `(${status})` : ''}`,
      subtitle: 'بلدية كفرنجة الجديدة — مديرية الهندسة والأشغال / قسم الحسابات ومشاريع العطاءات',
      refNumber: `CLM-REP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('ar-JO'),
      type: 'table',
      columns: [
        { key: 'id', label: 'رقم المطالبة' },
        { key: 'tenderName', label: 'المشروع / العطاء' },
        { key: 'claimant', label: 'المقاول / مقدم المطالبة' },
        { key: 'submitDate', label: 'تاريخ التقديم' },
        { key: 'type', label: 'نوع الدفعة' },
        { key: 'amount', label: 'المبلغ الإجمالي' },
        { key: 'netAmount', label: 'الصافي للصرف' },
        { key: 'completionPercent', label: 'الإنجاز' },
        { key: 'status', label: 'حالة الاعتماد' }
      ],
      data: data.map(r => ({
        ...r,
        tenderName: r.tenderName || r.tenderId || '—',
        submitDate: (r.submitDate || r.submit_date || '-').split('T')[0],
        amount: (parseFloat(r.amount) || 0).toLocaleString('ar-JO') + ' د.أ',
        netAmount: (parseFloat(r.netAmount || r.net_amount) || (parseFloat(r.amount) || 0)).toLocaleString('ar-JO') + ' د.أ',
        completionPercent: (r.completionPercent || 0) + '%'
      })),
      summaryHtml: summaryHtml,
      signatures: true
    });
  } catch (e) {
    showToast('⚠️ تعذر جلب المطالبات للطباعة: ' + e.message, 'error');
  }
};

window.autofillClaimForm = function () {
  const tenderId = document.getElementById('f-tenderId')?.value;
  const pStr = document.getElementById('f-completionPercent')?.value;
  const p = parseFloat(pStr || 0);

  if (!tenderId || !window._cachedTenders) return;
  const t = window._cachedTenders.find(x => x.id === tenderId);
  if (!t) return;

  // Auto-fill contractor name
  const claimantInput = document.getElementById('f-claimant');
  if (claimantInput && t.contractor) {
    claimantInput.value = t.contractor;
  }

  // Auto-calculate amount
  const amountInput = document.getElementById('f-amount');
  if (amountInput && t.value && pStr !== '') {
    const calculatedAmount = parseFloat(t.value) * (p / 100);
    amountInput.value = calculatedAmount.toFixed(0);
  }
};


// ==========================================
// OFFICIAL MUNICIPAL PRINT & EXCEL SUITE (v5.0)
// ==========================================
window.printOfficialDocument = function (module, id, title) {
  const mod = module || 'general';
  const docId = id || `DOC-${Date.now().toString().slice(-6)}`;
  const t = encodeURIComponent(title || 'تقرير رسمي موحد');
  const url = `/api/reports/generate-official?module=${mod}&id=${docId}&title=${t}`;
  const win = window.open(url, '_blank');
  if (win) {
    win.focus();
  } else {
    window.location.href = url;
  }
};

window.exportModuleExcel = function (module) {
  const mod = module || 'summary';
  const url = `/api/reports/export-excel?module=${mod}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `kafr_inja_${mod}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✅ جاري تصدير وتنزيل ملف Excel المعتمد (UTF-8 BOM)...');
};

window.verifyDocumentOnline = function (id) {
  const docId = id || prompt('أدخل الرقم المرجعي أو كود الوثيقة للتحقق:');
  if (!docId) return;
  window.open(`/verify.html?id=${encodeURIComponent(docId.trim())}`, '_blank');
};

// ==========================================
// NOTIFICATIONS & MY WORK FEATURE
// ==========================================

async function fetchNotifications() {
  if (!currentUser) return;
  try {
    const notifs = await apiFetch('/notifications', { silent: true }).catch(() => []);
    const notifBtn = document.getElementById('notifBtn');
    const badge = notifBtn?.querySelector('.notif-badge');
    const container = document.getElementById('notifListContainer');

    if (!container) return;

    const unreadCount = notifs.filter(n => !n.isRead).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!notifs || notifs.length === 0) {
      container.innerHTML = `
        <div style="padding:28px 16px; text-align:center; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:6px;">🔕</div>
          <div style="font-weight:600; font-size:0.9rem;">لا توجد إشعارات جديدة حالياً</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">ستظهر التنبيهات الفنية وتحديثات المشاريع هنا فور حدوثها.</div>
        </div>
      `;
    } else {
      container.innerHTML = notifs.map(n => {
        const timeAgo = formatTimeAgo(n.timestamp || Date.now());
        const icon = n.icon || '🔔';
        return `
          <div class="notif-item ${!n.isRead ? 'unread' : ''}" onclick="readNotification('${n.id}', '${n.link || ''}')">
            <div class="notif-icon">${icon}</div>
            <div style="flex:1; min-width:0;">
              <b style="font-size:0.86rem; color:var(--text);">${n.title || 'تنبيه نظام'}</b>
              <div style="font-size:0.8rem; color:var(--text); line-height:1.4; word-break:break-word;">${n.message || ''}</div>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">⏱️ ${timeAgo}</div>
            </div>
            ${!n.isRead ? '<span style="width:8px; height:8px; border-radius:50%; background:#ef4444; flex-shrink:0; margin-top:6px;"></span>' : ''}
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Failed to fetch notifications', e);
  }
}

function formatTimeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return new Date(timestamp).toLocaleDateString('ar-JO');
}

async function readNotification(id, link) {
  try {
    await apiFetch(`/notifications/read/${id}`, { method: 'POST', silent: true });
    fetchNotifications();
    if (link && link.trim() !== '') {
      const [type, recId] = link.split(':');
      if (type) {
        navigate(type);
        if (recId) {
          setTimeout(() => {
            if (typeof viewRecord === 'function') viewRecord(type, recId);
          }, 300);
        }
      }
    }
  } catch (e) { }
}

async function markAllNotificationsRead() {
  try {
    await apiFetch('/notifications/read-all', { method: 'POST', silent: true });
    fetchNotifications();
    showToast('✅ تم تحديد جميع الإشعارات كمقروءة');
  } catch (e) {}
}

async function notifyUser(userId, message, link, type = 'info', title = '') {
  try {
    await apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({ userId, message, link, type, title }),
      silent: true
    });
    fetchNotifications();
  } catch (e) { }
}

// Unified My Work & Tasks Manager Bridge
window.refreshMyWork = function () {
  if (typeof unifiedMyWorkManager !== 'undefined' && unifiedMyWorkManager) {
    unifiedMyWorkManager.loadAllData();
  }
};

window.switchMyWorkTab = function (tabName) {
  if (typeof unifiedMyWorkManager !== 'undefined' && unifiedMyWorkManager) {
    unifiedMyWorkManager.switchTab(tabName);
  }
};

window.sendReminder = async function (userId, message) {
  if (!userId) return;
  try {
    await apiFetch('/notifications', {
      method: 'POST',
      body: JSON.stringify({ userId, message: message || 'تذكير بمتابعة إجراء', link: 'my-work', type: 'tasks', title: '🔔 تذكير متابعة' }),
      silent: true
    });
    showToast('🔔 تم إرسال تذكير للموظف بنجاح');
  } catch (e) {
    showToast('🔔 تم تسجيل التذكير بنجاح');
  }
};

// ===== UNIFIED SETTINGS DELEGATION =====
window.switchUserTab = function (tab) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.switchTab(tab);
  }
};

window.openOrgUnitModal = async function (id = null) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.openOrgUnitModal(id);
  }
};

window.openRoleModal = async function (id = null) {
  if (window.unifiedSettingsManager) {
    if (id) {
      window.unifiedSettingsManager.openEditRoleModal(id);
    } else {
      window.unifiedSettingsManager.openCreateRoleModal();
    }
  }
};

window.deleteRole = async function (id) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.deleteRole(id);
  } else {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return;
    try {
      await apiFetch(`/roles/${id}`, { method: 'DELETE' });
      showToast('🗑️ تم حذف الدور بنجاح');
    } catch (e) {
      showToast('❌ فشل الحذف: ' + e.message);
    }
  }
};

window.openOrgUnitModal = async function(id = null) {
  let unit = null;
  if (id) {
    try {
      const units = await apiFetch('/org-units');
      unit = units.find(u => u.id === id);
    } catch (e) {}
  }

  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  if (!modalTitle || !modalBody) return;

  modalTitle.textContent = unit ? `✏️ تعديل الوحدة التنظيمية / القسم: ${unit.name}` : '🏛️ إضافة وحدة تنظيمية / قسم هندسي جديد';
  modalBody.innerHTML = `
    <form onsubmit="saveOrgUnit(event, ${unit ? `'${unit.id}'` : 'null'})" style="display:flex; flex-direction:column; gap:14px; direction:rtl; font-family:'Tajawal',sans-serif;">
      <div class="form-group">
        <label style="font-size:0.85rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">اسم القسم / الوحدة التنظيمية *</label>
        <input type="text" id="ou-name" class="form-control" required value="${unit ? unit.name : ''}" placeholder="مثال: قسم صيانة الطرق والآليات" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text);" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label style="font-size:0.85rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">المستوى / النوع الإداري *</label>
          <select id="ou-type" class="form-control" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text);">
            <option value="مديرية" ${unit?.type === 'مديرية' ? 'selected' : ''}>مديرية (Directorate)</option>
            <option value="دائرة" ${unit?.type === 'دائرة' ? 'selected' : ''}>دائرة (Department)</option>
            <option value="قسم" ${!unit || unit?.type === 'قسم' ? 'selected' : ''}>قسم (Section)</option>
            <option value="شعبة" ${unit?.type === 'شعبة' ? 'selected' : ''}>شعبة (Division)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label style="font-size:0.85rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">الوصف والمهام والاختصاص</label>
        <textarea id="ou-description" class="form-control" style="width:100%; height:60px; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text);" placeholder="اكتب مهام واختصاصات هذا القسم">${unit ? (unit.description || '') : ''}</textarea>
      </div>

      <div class="form-actions" style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary" style="font-weight:bold; padding:8px 20px;">💾 حفظ الوحدة التنظيمية</button>
      </div>
    </form>
  `;

  document.getElementById('modalOverlay')?.classList.add('open');
};

window.saveOrgUnit = async function(e, id) {
  e.preventDefault();
  const name = document.getElementById('ou-name')?.value;
  const type = document.getElementById('ou-type')?.value;
  const description = document.getElementById('ou-description')?.value;

  if (!name || !name.trim()) {
    showToast('⚠️ اسم الوحدة التنظيمية مطلوب');
    return;
  }

  try {
    const url = id ? `/org-units/${id}` : '/org-units';
    const method = id ? 'PUT' : 'POST';
    await apiFetch(url, {
      method,
      body: JSON.stringify({ name: name.trim(), type, description })
    });
    showToast('✅ تم حفظ بيانات الوحدة التنظيمية بنجاح');
    closeModal();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (err) {
    showToast('❌ خطأ أثناء الحفظ: ' + err.message);
  }
};

window.deleteOrgUnit = async function(id) {
  if (id === 'OU-01') {
    showToast('⚠️ لا يمكن حذف المديرية الرئيسية للنظام!');
    return;
  }
  if (!confirm('هل أنت متأكد من حذف هذا القسم / الوحدة التنظيمية؟')) return;
  try {
    await apiFetch(`/org-units/${id}`, { method: 'DELETE' });
    showToast('🗑️ تم حذف الوحدة التنظيمية بنجاح');
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (e) {
    showToast('❌ فشل الحذف: ' + e.message);
  }
};

/* ── محرك ومصمم مسارات العمل وسلاسل الاعتماد التفاعلي (Zero-Code Dynamic Workflow Designer) ── */
window.currentWorkflowEditingSteps = [];

window.openWorkflowModal = async function(id = null) {
  let wf = null;
  let allRoles = [];
  try {
    const [workflows, roles] = await Promise.all([
      apiFetch('/workflows'),
      apiFetch('/roles')
    ]);
    allRoles = roles || [];
    if (id) {
      wf = (workflows || []).find(w => w.id === id);
    }
  } catch (e) {
    showToast('❌ خطأ في تحميل بيانات مسار العمل: ' + e.message);
    return;
  }

  // Parse or initialize steps
  if (wf && wf.stepsJson) {
    try {
      window.currentWorkflowEditingSteps = typeof wf.stepsJson === 'string' ? JSON.parse(wf.stepsJson) : wf.stepsJson;
    } catch (e) {
      window.currentWorkflowEditingSteps = [];
    }
  } else {
    window.currentWorkflowEditingSteps = [
      { stepIndex: 1, label: 'تدقيق وتنسيب مهندس الإشراف', targetRole: 'R-004', allowReject: false },
      { stepIndex: 2, label: 'مراجعة وتأكيد رئيس قسم المشاريع', targetRole: 'R-003', allowReject: true },
      { stepIndex: 3, label: 'المصادقة والاعتماد النهائي للمدير', targetRole: 'R-002', allowReject: true }
    ];
  }

  window.workflowAvailableRoles = allRoles;

  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalDialog = document.getElementById('modalDialog');
  if (!modalTitle || !modalBody) return;

  if (modalDialog) {
    modalDialog.style.maxWidth = '850px';
    modalDialog.style.width = '95%';
  }

  modalTitle.textContent = wf ? `⚙️ مصمم مسارات العمل وسلاسل الاعتماد: ${wf.name}` : '⛓️ تصميم مسار عمل وسلسلة اعتماد جديدة (Zero-Code)';
  modalBody.innerHTML = `
    <form onsubmit="saveWorkflow(event, ${wf ? `'${wf.id}'` : 'null'})" style="display:flex; flex-direction:column; gap:16px; direction:rtl; font-family:'Tajawal',sans-serif;">
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; background:var(--bg-surface, #f8fafc); border:1px solid var(--border, #cbd5e1); border-radius:10px; padding:14px;">
        <div class="form-group" style="margin:0;">
          <label style="font-size:0.83rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">معرف المسار (ID)</label>
          <input type="text" id="wf-id-display" class="form-control" value="${wf ? wf.id : 'تلقائي (WF-AUTO)'}" disabled style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; font-family:monospace; color:var(--text-muted);" />
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:0.83rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">اسم مسار العمل الرسمي *</label>
          <input type="text" id="wf-name" class="form-control" required value="${wf ? wf.name : ''}" placeholder="مثال: مسار تدقيق واعتماد المطالبات المالية" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; font-weight:600; color:var(--text);" />
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-size:0.83rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">نوع المعاملة / الكيان المرتبط *</label>
          <select id="wf-entity" class="form-control" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; font-weight:600; color:var(--text);">
            <option value="purchases" ${wf?.entityType === 'purchases' ? 'selected' : ''}>المشتريات واللوازم والتوريدات (purchases)</option>
            <option value="claims" ${wf?.entityType === 'claims' ? 'selected' : ''}>المطالبات المالية والمستخلصات (claims)</option>
            <option value="excavation_permits" ${wf?.entityType === 'excavation_permits' ? 'selected' : ''}>تصاريح الحفر وتنسيق الخدمات (excavation_permits)</option>
            <option value="paving_returns" ${wf?.entityType === 'paving_returns' ? 'selected' : ''}>عوائد التعبيد والإنشاء (paving_returns)</option>
            <option value="tasks" ${wf?.entityType === 'tasks' ? 'selected' : ''}>الكشوفات والتكليفات الميدانية (tasks)</option>
            <option value="variation_orders" ${wf?.entityType === 'variation_orders' ? 'selected' : ''}>أوامر التغيير الهندسية (variation_orders)</option>
            <option value="tenders" ${wf?.entityType === 'tenders' ? 'selected' : ''}>المشاريع والعطاءات (tenders)</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin:0;">
        <label style="font-size:0.83rem; font-weight:bold; color:var(--text); margin-bottom:4px; display:block;">الوصف الإداري وضوابط الإجراء</label>
        <input type="text" id="wf-desc" class="form-control" value="${wf ? (wf.description || '') : ''}" placeholder="وصف موجز للمسار وأهدافه والضوابط الإجرائية المتبعة" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text);" />
      </div>

      <!-- منشئ الخطوات وسلاسل الاعتماد المرئي -->
      <div style="background:var(--bg-card, #fff); border:1px solid var(--border, #cbd5e1); border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:10px;">
          <div>
            <div style="font-weight:bold; font-size:0.95rem; color:#1e3a8a; display:flex; align-items:center; gap:8px;">
              <span>📋</span> <span>سلسلة خطوات ومراحل الاعتماد والتوقيع بالترتيب</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">قم بتحديد مسمى كل مرحلة والدور الوظيفي المخول بالتوقيع والاعتماد</div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addWorkflowStepRow()" style="font-weight:bold; font-size:0.82rem; padding:6px 14px; border-radius:8px;">
            + إضافة مرحلة اعتماد جديدة
          </button>
        </div>

        <div id="wf-steps-container" style="display:flex; flex-direction:column; gap:10px; max-height:42vh; overflow-y:auto; padding:2px;">
          ${renderWorkflowStepsHtml()}
        </div>
      </div>

      <div class="form-actions" style="margin-top:8px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border, #e2e8f0); padding-top:12px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()" style="padding:8px 20px;">إلغاء</button>
        <button type="submit" class="btn btn-primary" style="font-weight:bold; padding:8px 26px; border-radius:8px;">💾 حفظ وتعميم مسار العمل</button>
      </div>
    </form>
  `;

  document.getElementById('modalOverlay')?.classList.add('open');
};

function renderWorkflowStepsHtml() {
  const steps = window.currentWorkflowEditingSteps || [];
  const roles = window.workflowAvailableRoles || [];

  if (!steps.length) {
    return `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.85rem; border:2px dashed var(--border); border-radius:8px;">لا توجد خطوات مضافة في هذا المسار. اضغط "+ إضافة مرحلة اعتماد جديدة" للبدء</div>`;
  }

  return steps.map((stg, idx) => `
    <div style="background:var(--bg-surface, #f8fafc); border:1px solid var(--border, #cbd5e1); border-right:4px solid #1e3a8a; border-radius:8px; padding:12px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
      
      <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
        <span style="width:28px; height:28px; border-radius:50%; background:#1e3a8a; color:#fff; font-weight:bold; font-size:0.85rem; display:flex; align-items:center; justify-content:center;">
          ${idx + 1}
        </span>
        <span style="font-weight:bold; font-size:0.82rem; color:#1e3a8a;">مرحلة #${idx + 1}</span>
      </div>

      <div style="flex:2; min-width:200px;">
        <label style="font-size:0.75rem; color:var(--text-muted); font-weight:bold; display:block; margin-bottom:2px;">مسمى الخطوة / الإجراء *</label>
        <input type="text" class="form-control" value="${stg.label || stg.title || ''}" placeholder="مثال: تدقيق المهندس المشرف" style="width:100%; padding:6px 10px; font-size:0.83rem; font-weight:600; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; color:var(--text);" oninput="window.updateWfStepField(${idx}, 'label', this.value)" required />
      </div>

      <div style="flex:2; min-width:180px;">
        <label style="font-size:0.75rem; color:var(--text-muted); font-weight:bold; display:block; margin-bottom:2px;">الدور الوظيفي المسؤول *</label>
        <select class="form-control" style="width:100%; padding:6px 10px; font-size:0.83rem; font-weight:600; background:var(--bg, #fff); border:1px solid var(--border, #cbd5e1); border-radius:6px; color:var(--text);" onchange="window.updateWfStepField(${idx}, 'targetRole', this.value)">
          ${roles.map(r => `<option value="${r.id}" ${(stg.targetRole === r.id || stg.targetRole === r.name || stg.role === r.id) ? 'selected' : ''}>${r.label || r.name} [${r.name}]</option>`).join('')}
        </select>
      </div>

      <div style="flex-shrink:0; display:flex; align-items:center; gap:6px; padding-top:14px;">
        <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; color:var(--text); font-weight:600;">
          <input type="checkbox" ${stg.allowReject !== false ? 'checked' : ''} onchange="window.updateWfStepField(${idx}, 'allowReject', this.checked)" style="accent-color:#1e3a8a; width:16px; height:16px;" />
          <span>يسمح بالرفض والإعادة</span>
        </label>
      </div>

      <div style="display:flex; gap:6px; margin-right:auto; flex-shrink:0; padding-top:14px;">
        ${idx > 0 ? `<button type="button" class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="window.moveWfStep(${idx}, -1)" title="تحريك لأعلى">▲</button>` : ''}
        ${idx < steps.length - 1 ? `<button type="button" class="btn btn-sm btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="window.moveWfStep(${idx}, 1)" title="تحريك لأسفل">▼</button>` : ''}
        ${steps.length > 1 ? `<button type="button" class="btn btn-sm btn-outline" style="color:#dc2626; border-color:rgba(220,38,38,0.3); padding:4px 8px; font-size:0.8rem;" onclick="window.removeWfStep(${idx})" title="حذف هذه الخطوة">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}

window.updateWfStepField = function(idx, field, val) {
  if (window.currentWorkflowEditingSteps[idx]) {
    window.currentWorkflowEditingSteps[idx][field] = val;
  }
};

window.addWorkflowStepRow = function() {
  const defaultRole = (window.workflowAvailableRoles && window.workflowAvailableRoles[0]) ? window.workflowAvailableRoles[0].id : 'R-004';
  window.currentWorkflowEditingSteps.push({
    stepIndex: window.currentWorkflowEditingSteps.length + 1,
    label: `مرحلة اعتماد رقم ${window.currentWorkflowEditingSteps.length + 1}`,
    targetRole: defaultRole,
    allowReject: true
  });
  const container = document.getElementById('wf-steps-container');
  if (container) container.innerHTML = renderWorkflowStepsHtml();
};

window.removeWfStep = function(idx) {
  window.currentWorkflowEditingSteps.splice(idx, 1);
  window.currentWorkflowEditingSteps.forEach((s, i) => s.stepIndex = i + 1);
  const container = document.getElementById('wf-steps-container');
  if (container) container.innerHTML = renderWorkflowStepsHtml();
};

window.moveWfStep = function(idx, dir) {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= window.currentWorkflowEditingSteps.length) return;
  const temp = window.currentWorkflowEditingSteps[idx];
  window.currentWorkflowEditingSteps[idx] = window.currentWorkflowEditingSteps[targetIdx];
  window.currentWorkflowEditingSteps[targetIdx] = temp;
  window.currentWorkflowEditingSteps.forEach((s, i) => s.stepIndex = i + 1);
  const container = document.getElementById('wf-steps-container');
  if (container) container.innerHTML = renderWorkflowStepsHtml();
};

window.saveWorkflow = async function(e, id) {
  e.preventDefault();
  const name = document.getElementById('wf-name')?.value;
  const entityType = document.getElementById('wf-entity')?.value;
  const description = document.getElementById('wf-desc')?.value;
  const steps = window.currentWorkflowEditingSteps;

  if (!name || !name.trim()) {
    showToast('⚠️ اسم مسار العمل مطلوب');
    return;
  }
  if (!steps || !steps.length) {
    showToast('⚠️ يجب إضافة خطوة واحدة على الأقل في مسار العمل');
    return;
  }

  try {
    const url = id ? `/workflows/${id}` : '/workflows';
    const method = id ? 'PUT' : 'POST';
    await apiFetch(url, {
      method,
      body: JSON.stringify({
        name: name.trim(),
        entityType,
        description: description || '',
        stepsJson: steps
      })
    });
    showToast('✅ تم حفظ وتعميم مسار العمل بنجاح');
    closeModal();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (err) {
    showToast('❌ خطأ أثناء حفظ مسار العمل: ' + err.message);
  }
};

window.deleteWorkflow = async function(id) {
  if (!confirm('هل أنت متأكد من حذف مسار العمل هذا؟')) return;
  try {
    await apiFetch(`/workflows/${id}`, { method: 'DELETE' });
    showToast('🗑️ تم حذف مسار العمل بنجاح');
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (e) {
    showToast('❌ فشل حذف مسار العمل: ' + e.message);
  }
};

window.openAssignmentModal = async function () {
  let allUsers = [], allUnits = [], allRoles = [];
  try {
    allUsers = await apiFetch('/users');
    allUnits = await apiFetch('/org-units');
    allRoles = await apiFetch('/roles');
  } catch (e) { }

  const userOpts = allUsers.map(u => `<option value="${u.id}">${u.fullName} (${u.username})</option>`).join('');
  const unitOpts = allUnits.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  const roleOpts = allRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  document.getElementById('modalTitle').textContent = '👥 إسناد موظف لقسم ودور وظيفي';
  document.getElementById('modalBody').innerHTML = `
    <form id="assignment-form" onsubmit="saveAssignment(event)" style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>اختر الموظف / الحساب</label>
        <select id="asm-userId" class="form-control" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text);" required>
          ${userOpts}
        </select>
      </div>
      <div class="form-group">
        <label>القسم / الدائرة التنظيمية</label>
        <select id="asm-orgUnitId" class="form-control" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text);" required>
          ${unitOpts}
        </select>
      </div>
      <div class="form-group">
        <label>الدور الوظيفي داخل القسم</label>
        <select id="asm-roleId" class="form-control" style="width:100%; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text);" required>
          ${roleOpts}
        </select>
      </div>
      <div class="form-actions" style="margin-top:14px; display:flex; gap:8px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary">💾 تثبيت التعيين والإسناد</button>
      </div>
    </form>
  `;
  document.getElementById('modalOverlay').classList.add('open');
};

window.saveAssignment = async function (e) {
  e.preventDefault();
  const userId = document.getElementById('asm-userId').value;
  const orgUnitId = document.getElementById('asm-orgUnitId').value;
  const roleId = document.getElementById('asm-roleId').value;

  try {
    await apiFetch('/user-org-units', {
      method: 'POST',
      body: JSON.stringify({ userId, orgUnitId, roleId })
    });
    showToast('✅ تم إسناد الموظف بنجاح');
    closeModal();
    renderAssignments();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (err) {
    showToast('❌ خطأ: ' + err.message);
  }
};

window.deleteAssignment = async function (id) {
  if (!confirm('هل أنت متأكد من إلغاء تعيين الموظف هذا للقسم المحدد؟')) return;
  try {
    await apiFetch(`/user-org-units/${id}`, { method: 'DELETE' });
    showToast('🗑️ تم إلغاء الإسناد بنجاح');
    renderAssignments();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (e) {
    showToast('❌ فشل الإجراء: ' + e.message);
  }
};

// ===== SYSTEM LOOKUPS & WORKFLOWS HANDLERS =====

let systemLookups = [];

async function loadSystemLookups() {
  try {
    systemLookups = await apiFetch('/lookups');
  } catch (e) {
    console.error('Failed to load lookups:', e);
  }
}

function getLookupOptionsHtml(group, defaultValue = '') {
  const groupLookups = systemLookups.filter(l => l.group === group);
  if (!groupLookups.length) {
    if (group === 'TENDER_TYPES') return '<option value="أشغال">🏗️ أشغال</option><option value="لوازم">📦 لوازم</option>';
    if (group === 'TENDER_STATUS') return '<option value="مفتوح">مفتوح</option><option value="منتهي">منتهي</option><option value="مُنجز">مُنجز</option><option value="ملغي">ملغي</option>';
    if (group === 'TASK_PRIORITIES') return '<option value="عالية">عالية</option><option value="متوسطة" selected>متوسطة</option><option value="عادية">عادية</option>';
    if (group === 'DOC_TYPES') return '<option value="عطاء">عطاء</option><option value="مطالبة">مطالبة</option><option value="شراء">شراء</option><option value="مراسلة">مراسلة</option><option value="أخرى">أخرى</option>';
    return '';
  }
  return groupLookups.map(l => `<option value="${l.valueAr}" ${l.valueAr === defaultValue ? 'selected' : ''}>${l.valueAr}</option>`).join('');
}

// ===== LOOKUPS & WORKFLOWS DELEGATION =====
window.openLookupModal = async function (id = null) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.openLookupModal(id);
  }
};

window.deleteLookup = async function (id) {
  if (window.unifiedSettingsManager) {
    window.unifiedSettingsManager.deleteLookup(id);
  }
};



// ==========================================
// MAC v4.0 Enterprise Frontend Render Modules
// ==========================================

// 1. Contracts & Guarantees Module (Enterprise Contract Management Engine)
window.renderContracts = async function () {
  const el = document.getElementById('page-contracts');
  if (window.contractsManager && el) {
    window.contractsManager.init(el);
    return;
  }
  if (typeof window.initContractManagementUI === 'function') {
    await window.initContractManagementUI();
    return;
  }
  const tbody = document.getElementById('contracts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">جاري تحميل بيانات العقود...</td></tr>';
  try {
    const res = await apiFetch('/v4/contracts');
    const contracts = res.data || [];
    if (contracts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">لا توجد عقود مسجلة حالياً</td></tr>';
      return;
    }
    tbody.innerHTML = contracts.map(c => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td>${c.title}</td>
        <td>${c.tender_id || 'عام'}</td>
        <td><strong>${Number(c.total_value || 0).toLocaleString()} د.أ</strong></td>
        <td>${c.start_date || '-'}</td>
        <td>${c.end_date || '-'}</td>
        <td><span class="status-pill status-${(c.status || 'ACTIVE').toLowerCase()}">${c.status || 'نشط'}</span></td>
        <td>${Array.isArray(c.guarantees) ? c.guarantees.length : 0} كفالة مصدقة</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewContractDetails('${c.id}')">👁️ عرض</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);">خطأ: ${err.message}</td></tr>`;
  }
};

window.openNewContractModal = function () {
  document.getElementById('modalTitle').textContent = '📜 إضافة عقد وكفالة هندسية جديدة';
  document.getElementById('modalBody').innerHTML = `
    <form onsubmit="saveNewContract(event)" style="display:flex; flex-direction:column; gap:12px;">
      <div class="form-group">
        <label>عنوان العقد المشروع</label>
        <input type="text" id="cnt-title" class="form-control" required placeholder="مثال: عقد مشروع تعبيد شوارع كفرنجة" />
      </div>
      <div class="form-group">
        <label>العطاء المرتبط (Tender ID)</label>
        <input type="text" id="cnt-tenderId" class="form-control" placeholder="T-2026-001" />
      </div>
      <div class="form-group">
        <label>القيمة الإجمالية للعقد (دينار أردني)</label>
        <input type="number" id="cnt-totalValue" class="form-control" required placeholder="50000" />
      </div>
      <div style="display:flex; gap:12px;">
        <div class="form-group" style="flex:1;">
          <label>تاريخ المباشرة/البدء</label>
          <input type="date" id="cnt-startDate" class="form-control" required />
        </div>
        <div class="form-group" style="flex:1;">
          <label>تاريخ الانتهاء</label>
          <input type="date" id="cnt-endDate" class="form-control" required />
        </div>
      </div>
      <div class="form-actions" style="margin-top:14px; display:flex; gap:8px;">
        <button type="button" class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button type="submit" class="btn btn-primary">💾 حفظ العقد</button>
      </div>
    </form>
  `;
  document.getElementById('modalOverlay').classList.add('open');
};

window.saveNewContract = async function (e) {
  e.preventDefault();
  const title = document.getElementById('cnt-title').value;
  const tenderId = document.getElementById('cnt-tenderId').value;
  const totalValue = document.getElementById('cnt-totalValue').value;
  const startDate = document.getElementById('cnt-startDate').value;
  const endDate = document.getElementById('cnt-endDate').value;

  try {
    await apiFetch('/v4/assets/contracts', {
      method: 'POST',
      body: JSON.stringify({ title, tenderId, totalValue, startDate, endDate })
    });
    showToast('✅ تم إضافة العقد والضمان البنكي بنجاح');
    closeModal();
    renderContracts();
  } catch (err) {
    showToast('❌ خطأ: ' + err.message);
  }
};

// 2. Structural Assets (Buildings & Retaining Walls) Forwarder
window.renderStructuralAssets = function () {
  if (typeof loadStructuralAssets === 'function') loadStructuralAssets();
};

// 3. Infrastructure Networks Module Forwarder
window.renderInfrastructure = function () {
  if (typeof loadInfrastructureNetworks === 'function') loadInfrastructureNetworks();
};

// 4. System Settings & Identity Module (Unified Enterprise Suite)
window.renderSettings = async function (subTab = null) {
  if (typeof UnifiedSettingsManager !== 'undefined') {
    if (!window.unifiedSettingsManager) {
      window.unifiedSettingsManager = new UnifiedSettingsManager('settings-tab-container');
    } else {
      window.unifiedSettingsManager.render();
    }
    if (subTab) {
      window.unifiedSettingsManager.switchTab(subTab);
    }
  }
};

window.renderSystemIdentity = async function () {
  window.renderSettings('visual-identity');
};

window.openEditUserModal = async function(id) {
  try {
    const users = await apiFetch('/users');
    const user = users.find(u => u.id === id);
    if (user) {
      await openModal('users');
      const modal = document.getElementById('modal');
      if (modal) modal.dataset.editId = id;

      setTimeout(() => {
        const titleEl = document.getElementById('modalTitle');
        if (titleEl) titleEl.textContent = `✏️ تعديل بيانات حساب المستخدم: ${user.fullName}`;
        const uField = document.getElementById('f-username');
        const fField = document.getElementById('f-fullName');
        const rField = document.getElementById('f-role');
        const eField = document.getElementById('f-email');
        const pField = document.getElementById('f-phone');
        const dField = document.getElementById('f-department');
        const jField = document.getElementById('f-job_title');
        const pwField = document.getElementById('f-password');
        const twoFaField = document.getElementById('f-two_factor_enabled');

        if (uField) { uField.value = user.username || ''; uField.disabled = true; }
        if (fField) fField.value = user.fullName || '';
        if (rField) rField.value = user.role || 'engineer';
        if (eField) eField.value = user.email || '';
        if (pField) pField.value = user.phone || '';
        if (dField) dField.value = user.department || '';
        if (jField) jField.value = user.job_title || '';
        if (pwField) pwField.value = '';
        if (twoFaField) twoFaField.checked = !!user.two_factor_enabled;

        const saveBtn = document.querySelector('#modalBody .btn-primary');
        if (saveBtn) {
          saveBtn.textContent = '💾 حفظ بيانات الحساب';
          saveBtn.onclick = () => saveRecord('users', id);
        }
      }, 100);
    }
  } catch (e) {
    showToast('❌ خطأ: ' + e.message);
  }
};

window.deleteUserAccount = async function(id) {
  if (id === 'U-001') {
    showToast('⚠️ لا يمكن حذف الحساب الإداري الرئيسي للنظام!');
    return;
  }
  if (!confirm('هل أنت متأكد من حذف حساب هذا المستخدم نهائياً؟')) return;
  try {
    await apiFetch(`/users/${id}`, { method: 'DELETE' });
    showToast('🗑️ تم حذف حساب المستخدم بنجاح');
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (e) {
    showToast('❌ خطأ أثناء الحذف: ' + e.message);
  }
};

window.openMergeUserModal = async function() {
  try {
    const users = await apiFetch('/users');
    const eligibleSources = users.filter(u => u.id !== 'U-001');
    const eligibleTargets = users;

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!modalTitle || !modalBody) return;

    modalTitle.textContent = '🔀 دمج حسابات المستخدمين ونقل الصلاحيات والمهام';
    modalBody.innerHTML = `
      <div style="background:var(--bg-card); padding:16px; border-radius:10px; border:1px solid var(--border); margin-bottom:14px;">
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0 0 12px 0;">
          💡 تتيح هذه الوظيفة نقل كافة المهام والكشوفات الفنية والصلاحيات المسندة لمستخدم معين (المصدر) إلى مستخدم آخر (الهدف)، مع إلغاء الحساب المصدر تلقائياً لتوحيد السجلات.
        </p>

        <div class="form-row">
          <div class="form-group">
            <label style="font-weight:bold; color:#dc2626;">الحساب المصدر (سيتم نقله وحذفه) *</label>
            <select id="merge-source-user" class="form-control" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
              <option value="">-- اختر الحساب المصدر --</option>
              ${eligibleSources.map(u => `<option value="${u.id}">${u.fullName} (${u.username}) - ${u.role}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label style="font-weight:bold; color:#16a34a;">الحساب الهدف (سيتلقى المهام والصلاحيات) *</label>
            <select id="merge-target-user" class="form-control" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
              <option value="">-- اختر الحساب الهدف --</option>
              ${eligibleTargets.map(u => `<option value="${u.id}">${u.fullName} (${u.username}) - ${u.role}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="window.executeUserMerge()" style="background:#dc2626; border-color:#dc2626;">🔀 تنفيذ عملية الدمج الفوري</button>
      </div>
    `;

    document.getElementById('modalOverlay')?.classList.add('open');
  } catch (e) {
    showToast('❌ خطأ في فتح نافذة الدمج: ' + e.message);
  }
};

window.executeUserMerge = async function() {
  const sourceUserId = document.getElementById('merge-source-user')?.value;
  const targetUserId = document.getElementById('merge-target-user')?.value;

  if (!sourceUserId || !targetUserId) {
    showToast('⚠️ يرجى اختيار الحساب المصدر والحساب الهدف');
    return;
  }
  if (sourceUserId === targetUserId) {
    showToast('⚠️ لا يمكن دمج الحساب مع نفسه!');
    return;
  }

  if (!confirm('⚠️ تحذير: سيتم نقل كافة المهام والكشوفات والصلاحيات إلى الحساب الهدف وحذف الحساب المصدر نهائياً. هل ترغب بالاستمرار؟')) {
    return;
  }

  try {
    const res = await apiFetch('/users/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceUserId, targetUserId, action: 'MERGE' })
    });
    showToast(res.message || '✅ تم دمج الحسابين بنجاح');
    closeModal();
    if (window.unifiedSettingsManager) window.unifiedSettingsManager.init();
  } catch (e) {
    showToast('❌ فشل عملية الدمج: ' + e.message);
  }
};

// 5. Print Templates Editor Module (Unified Official Print Templates Suite)
window.renderPrintTemplates = async function () {
  if (typeof UnifiedPrintTemplatesManager !== 'undefined') {
    if (!window.unifiedPrintTemplatesManager) {
      window.unifiedPrintTemplatesManager = new UnifiedPrintTemplatesManager('print-templates-tab-container');
    } else {
      window.unifiedPrintTemplatesManager.render();
      window.unifiedPrintTemplatesManager.fetchTemplates();
    }
  }
};

window.openNewPrintTemplateModal = function (templateId = null) {
  if (window.unifiedPrintTemplatesManager) {
    window.unifiedPrintTemplatesManager.openTemplateModal(templateId);
  } else if (typeof UnifiedPrintTemplatesManager !== 'undefined') {
    window.unifiedPrintTemplatesManager = new UnifiedPrintTemplatesManager('print-templates-tab-container');
    window.unifiedPrintTemplatesManager.openTemplateModal(templateId);
  }
};

// ===== 1. حذف التبويب المنفصل من القائمة فور تحميل النظام =====
document.addEventListener('DOMContentLoaded', () => {
  const oldInspectionsNav = document.getElementById('nav-road-inspections');
  if (oldInspectionsNav) {
    oldInspectionsNav.remove(); // حذف العنصر نهائياً من الشريط الجانبي
  }
});

// ===== 2. الواجهة المدمجة المحدثة لإدارة الطرق وفحوصات الرصفة =====
window.renderIntegratedRoadsModule = async function() {
  const container = document.getElementById('page-roads');
  if (!container) return;

  const canWrite = ['admin', 'manager', 'dept_head', 'engineer'].includes(currentUser?.role);
  const isAdmin = currentUser?.role === 'admin';

  container.innerHTML = `
    <div class="roads-module-wrapper bg-slate-900 text-white p-4 rounded-xl shadow-2xl dir-rtl">
      
      <!-- شريط التبويبات الفرعية المدمجة داخل إدارة الطرق -->
      <div class="subtabs-bar flex border-b border-slate-700 mb-4 gap-2 bg-slate-800 p-2 rounded-t-lg">
        <button class="subtab-btn active bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold" onclick="switchRoadsSubtab('inventory')">
          🛣️ حصر وطبقات شبكة الطرق (GIS)
        </button>
        <button class="subtab-btn hover:bg-slate-700 text-slate-300 px-4 py-2 rounded text-xs font-bold" onclick="switchRoadsSubtab('pms-inspections')">
          🧪 سجل فحوصات الطرق ونظام الرصفات (PMS)
        </button>
      </div>

      <!-- التبويب الفرعي 1: شبكة الطرق والخرائط -->
      <div id="roads-subtab-inventory" class="subtab-content">
        <div id="unified-roads-map" class="w-full h-[450px] rounded bg-slate-950 border border-slate-700 mb-4"></div>
      </div>

      <!-- التبويب الفرعي 2: سجل فحوصات الطرق ونظام إدارة الرصفات (المدمج) -->
      <div id="roads-subtab-pms-inspections" class="subtab-content hidden">
        <div class="flex justify-between items-center mb-4 bg-slate-800 p-3 rounded border border-slate-700">
          <div>
            <h3 class="text-sm font-bold text-blue-400">📊 سجل فحوصات الرصفة وتقييم العيوب الميدانية (PCI)</h3>
            <p class="text-xs text-slate-400">إدارة وشاشات الفحص طبقاً لصلاحيات المستخدم المصرح بها</p>
          </div>
          <div class="flex gap-2">
            <button class="btn bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded" onclick="printPavementInspectionsLog()">
              🖨️ طباعة سجل الفحوصات
            </button>
            ${canWrite ? `
              <button class="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded font-bold" onclick="openPavementInspectionModal()">
                ➕ إضافة فحص ميداني جديد
              </button>
            ` : ''}
          </div>
        </div>

        <!-- جدول البيانات الشامل المدمج -->
        <div class="overflow-x-auto bg-slate-800 rounded-lg border border-slate-700">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-950 text-slate-300 border-b border-slate-700">
              <tr>
                <th class="p-3">رقم الفحص</th>
                <th class="p-3">اسم الشارع</th>
                <th class="p-3">تاريخ الفحص</th>
                <th class="p-3">مؤشر الرصفة (PCI)</th>
                <th class="p-3">حالة الشارع والعيوب</th>
                <th class="p-3">التوصية الهندسية</th>
                <th class="p-3">المراقب/المهندس</th>
                <th class="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody id="pms-inspections-tbody" class="divide-y divide-slate-700">
              <tr><td colspan="8" class="text-center py-4 text-slate-400">جاري تحميل سجلات الفحوصات...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  loadPavementInspectionsData();
};

// التنقل بين التبويبات الفرعية
window.switchRoadsSubtab = function(tabId) {
  document.querySelectorAll('.subtab-btn').forEach(b => {
    b.classList.remove('active', 'bg-blue-600', 'text-white');
    b.classList.add('hover:bg-slate-700', 'text-slate-300');
  });
  document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));

  const btn = event ? event.currentTarget : document.querySelector(`[onclick*="${tabId}"]`);
  if (btn) {
    btn.classList.add('active', 'bg-blue-600', 'text-white');
    btn.classList.remove('hover:bg-slate-700', 'text-slate-300');
  }

  const target = document.getElementById(`roads-subtab-${tabId}`);
  if (target) target.classList.remove('hidden');
};

// تحميل وعرض بيانات الفحوصات بجدول ديناميكي حسّاس للصلاحيات
async function loadPavementInspectionsData() {
  const tbody = document.getElementById('pms-inspections-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/v4/roads/inspections');
    const inspections = res.data || [];

    const canWrite = ['admin', 'manager', 'dept_head', 'engineer'].includes(currentUser?.role);
    const isAdmin = currentUser?.role === 'admin';

    if (inspections.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400">لا توجد فحوصات مسجلة حالياً.</td></tr>';
      return;
    }

    tbody.innerHTML = inspections.map(item => `
      <tr class="hover:bg-slate-750">
        <td class="p-3 font-bold">${item.id}</td>
        <td class="p-3">${item.road_name || item.road_id || '-'}</td>
        <td class="p-3">${item.inspection_date || item.inspectionDate || '-'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded font-bold ${(item.pci_score || item.pci || 80) >= 85 ? 'bg-emerald-900 text-emerald-300' : ((item.pci_score || item.pci || 80) >= 60 ? 'bg-amber-900 text-amber-300' : 'bg-rose-900 text-rose-300')}">
            ${item.pci_score || item.pci || 80} / 100
          </span>
        </td>
        <td class="p-3">${item.distress_type || item.defects || 'شقوق طفيفة'}</td>
        <td class="p-3 font-semibold">${item.recommendation || 'صيانة وقائية'}</td>
        <td class="p-3">${item.inspector_name || item.inspectorName || 'مهندس الموقع'}</td>
        <td class="p-3 text-center space-x-1 space-x-reverse">
          <button class="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white" onclick="viewPavementInspectionDetails('${item.id}')">👁️ عرض</button>
          ${canWrite ? `<button class="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white" onclick="openPavementInspectionModal('${item.id}')">✏️ تعديل</button>` : ''}
          ${isAdmin ? `<button class="px-2 py-1 bg-rose-600 hover:bg-rose-700 rounded text-white" onclick="deletePavementInspection('${item.id}')">🗑️ حذف</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-rose-400">فشل جلب البيانات: ${err.message}</td></tr>`;
  }
}




