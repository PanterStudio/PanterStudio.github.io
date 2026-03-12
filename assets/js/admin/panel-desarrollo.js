const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');

function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

const ROLE_ALIASES = {
    founder: 'founder_ceo',
    ceo: 'founder_ceo',
    fundador_ceo: 'founder_ceo',
    'fundador / ceo': 'founder_ceo',
    admin: 'administrador',
    admin_general: 'administrador',
    developer: 'programador',
    modeler: 'modelador',
    viewer: 'usuario'
};

const ALLOWED_PANEL_ROLES = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);

// ---- DOM refs ----
const gate        = document.getElementById('devHubGate');
const gateMessage = document.getElementById('devHubGateMessage');
const panel       = document.getElementById('devHubPanel');

const userLabelEl       = document.getElementById('devHubUserLabel');
const goAdminBtn        = document.getElementById('devHubGoAdminBtn');
const reloadBtn         = document.getElementById('devHubReloadBtn');
const logoutBtn         = document.getElementById('devHubLogoutBtn');
const sidebarToggleBtn  = document.getElementById('devSidebarToggle');
const sidebar           = document.getElementById('devSidebar');

const totalProjectsEl   = document.getElementById('devHubTotalProjects');
const gamesCountEl      = document.getElementById('devHubGamesCount');
const appsCountEl       = document.getElementById('devHubAppsCount');
const openTasksEl       = document.getElementById('devHubOpenTasks');
const openBugsEl        = document.getElementById('devHubOpenBugs');

const messageEl         = document.getElementById('devHubMessage');
const searchInput       = document.getElementById('devHubSearch');
const typeFilter        = document.getElementById('devHubTypeFilter');
const projectsGrid      = document.getElementById('devHubProjectsGrid');
const activityList      = document.getElementById('devHubActivityList');

let projects = [];
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;

// ---- Role helpers ----
function normalizeRole(role) {
    const raw = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[raw] || raw || 'usuario';
}

function canAccessDevPanel(role) {
    return ALLOWED_PANEL_ROLES.has(normalizeRole(role));
}

function getConfiguredAdminEmails() {
    try {
        const fromStorage = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '[]');
        const storageEmails = Array.isArray(fromStorage) ? fromStorage : String(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '').split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS, ...storageEmails]
            .map(e => String(e || '').trim().toLowerCase())
            .filter(Boolean))];
    } catch {
        return [...DEFAULT_ADMIN_EMAILS];
    }
}

// ---- UI helpers ----
function setMessage(text, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'dev-msg error' : 'dev-msg';
}

function showGateError(text) {
    if (gateMessage) {
        gateMessage.textContent = text;
        gateMessage.className = 'dev-msg error';
    }
    if (gate) gate.hidden = false;
    if (panel) panel.hidden = true;
}

function showPanel() {
    if (gate) gate.hidden = true;
    if (panel) panel.hidden = false;
}

// ---- Timeout helpers ----
function clearAccessTimeout() {
    if (accessTimeoutId) { clearTimeout(accessTimeoutId); accessTimeoutId = null; }
}

function startAccessTimeout() {
    clearAccessTimeout();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;
        if (window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch(err => {
                console.error('Fallback dev hub auth failed:', err);
                redirectToHome('No se pudo validar el rol en el tiempo esperado.');
            });
            return;
        }
        redirectToHome('No se detectó una sesión válida tras 3 segundos.');
    }, 3000);
}

function redirectToHome(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('index.html')), 1400);
}

function redirectToAdmin(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('pages/admin/admin.html')), 1400);
}

// ---- Firebase ready ----
async function waitForFirebaseReady(timeout = 5000) {
    return new Promise(resolve => {
        if (window.db && window.auth && window.onAuthStateChanged && window.getDocs && window.collection && window.fsDoc && window.getDoc) {
            resolve(true); return;
        }
        const start = Date.now();
        const t = setInterval(() => {
            if (window.db && window.auth && window.onAuthStateChanged && window.getDocs && window.collection && window.fsDoc && window.getDoc) {
                clearInterval(t); resolve(true);
            } else if (Date.now() - start >= timeout) {
                clearInterval(t); resolve(false);
            }
        }, 120);
    });
}

// ---- Access resolution ----
async function resolveUserAccess(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return { canAccess: false, role: 'usuario' };
    if (email === FOUNDER_CEO_EMAIL) return { canAccess: true, role: 'founder_ceo' };
    if (getConfiguredAdminEmails().includes(email)) return { canAccess: true, role: 'administrador' };

    let role = 'usuario';
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() || {} : {};
        role = normalizeRole(profile.role || 'usuario');
        if (profile.isAdmin === true && role === 'usuario') role = 'administrador';
        if (role === 'founder_ceo') return { canAccess: true, role };
    } catch (err) {
        console.error('No se pudo leer perfil dev hub:', err);
    }
    return { canAccess: canAccessDevPanel(role), role };
}

// ---- Firestore helpers ----
async function readCollectionSafe(name) {
    try {
        const snap = await window.getDocs(window.collection(window.db, name));
        return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    } catch (err) {
        console.warn(`No se pudo leer ${name}:`, err);
        return [];
    }
}

function toProject(item, type) {
    const rawStatus = String(item?.status || '').toLowerCase();
    const inDev = ['development', 'in_progress', 'testing', 'planning', 'dev', 'prototipo', 'production'];
    return {
        id: String(item?.id || item?.uid || item?.docId || `auto_${Math.random().toString(36).slice(2, 9)}`),
        title: String(item?.title || item?.name || 'Proyecto sin nombre'),
        status: rawStatus || 'development',
        type,
        description: String(item?.description || item?.summary || ''),
        tags: String(item?.tags || '').split(',').map(t => t.trim()).filter(Boolean),
        isInDevelopment: inDev.some(s => rawStatus.includes(s))
    };
}

// ---- Load data ----
async function loadProjects() {
    setMessage('Cargando proyectos...');

    const [games, apps, applications] = await Promise.all([
        readCollectionSafe('games'),
        readCollectionSafe('apps'),
        readCollectionSafe('applications')
    ]);

    const gameProjects = games.map(g => toProject(g, 'juego')).filter(p => p.isInDevelopment);
    const appProjects  = [...apps, ...applications].map(a => toProject(a, 'aplicacion')).filter(p => p.isInDevelopment);

    if (appProjects.length === 0) {
        appProjects.push({
            id: 'panter-hub-companion',
            title: 'Panter Hub Companion App',
            status: 'planning',
            type: 'aplicacion',
            description: 'Aplicación de soporte para comunidad, eventos y seguimiento de progreso.',
            tags: ['companion', 'mobile'],
            isInDevelopment: true
        });
    }

    projects = [...gameProjects, ...appProjects].sort((a, b) => a.title.localeCompare(b.title, 'es'));
    renderStats(projects);
    renderProjects();
    loadGlobalKpis();
    loadRecentActivity();
    setMessage(projects.length ? `${projects.length} proyectos en desarrollo` : 'No hay proyectos en desarrollo por ahora.');
}

async function loadGlobalKpis() {
    try {
        const [tasksSnap, bugsSnap] = await Promise.all([
            window.getDocs(window.collection(window.db, 'development_project_tasks')).catch(() => null),
            window.getDocs(window.collection(window.db, 'bugs')).catch(() => null)
        ]);
        const openTasks = tasksSnap ? tasksSnap.docs.filter(d => {
            const s = String(d.data()?.status || '');
            return s !== 'terminada';
        }).length : '—';
        const openBugs = bugsSnap ? bugsSnap.docs.filter(d => {
            const s = String(d.data()?.status || '');
            return s !== 'resuelto' && s !== 'verificado' && s !== 'no_reproducible';
        }).length : '—';
        if (openTasksEl) openTasksEl.textContent = String(openTasks);
        if (openBugsEl)  openBugsEl.textContent  = String(openBugs);
    } catch (err) {
        console.warn('KPI global load failed:', err);
    }
}

async function loadRecentActivity() {
    if (!activityList) return;
    try {
        const snap = await window.getDocs(window.collection(window.db, 'development_project_tasks')).catch(() => null);
        if (!snap) { activityList.innerHTML = '<p class="dev-empty">Sin actividad reciente.</p>'; return; }

        const recent = snap.docs
            .map(d => d.data())
            .filter(t => t.updatedAt)
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
            .slice(0, 20);

        if (!recent.length) { activityList.innerHTML = '<p class="dev-empty">Sin actividad reciente.</p>'; return; }

        activityList.innerHTML = recent.map(t => {
            const date = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : '—';
            const statusBadge = {
                terminada:  'dev-badge-green',
                en_curso:   'dev-badge-blue',
                bloqueada:  'dev-badge-red',
                lista_qa:   'dev-badge-purple',
                pendiente:  'dev-badge-gray'
            }[String(t.status)] || 'dev-badge-gray';
            return `<div class="dev-recent-task">
                <span class="dev-recent-task-title">${escHtml(String(t.title || 'Sin título'))}</span>
                <span class="dev-badge ${statusBadge}">${escHtml(String(t.status || ''))}</span>
                <span class="dev-recent-task-meta" style="min-width:60px;text-align:right">${date}</span>
            </div>`;
        }).join('');
    } catch (err) {
        console.warn('Activity load failed:', err);
        activityList.innerHTML = '<p class="dev-empty">No se pudo cargar la actividad.</p>';
    }
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Render ----
function renderStats(items) {
    const games = items.filter(p => p.type === 'juego').length;
    const apps  = items.filter(p => p.type === 'aplicacion').length;
    if (totalProjectsEl) totalProjectsEl.textContent = String(items.length);
    if (gamesCountEl)    gamesCountEl.textContent    = String(games);
    if (appsCountEl)     appsCountEl.textContent     = String(apps);
}

function getFilteredProjects() {
    const text = String(searchInput?.value || '').trim().toLowerCase();
    const type = String(typeFilter?.value || 'all');
    return projects.filter(p => {
        if (type !== 'all' && p.type !== type) return false;
        if (!text) return true;
        return [p.title, p.description, p.status, p.type, p.tags.join(' ')].join(' ').toLowerCase().includes(text);
    });
}

function renderProjects() {
    if (!projectsGrid) return;
    const filtered = getFilteredProjects();

    if (!filtered.length) {
        projectsGrid.innerHTML = '<p class="dev-empty">No hay coincidencias con ese filtro.</p>';
        return;
    }

    projectsGrid.innerHTML = filtered.map(project => {
        const params = new URLSearchParams({
            projectId:     project.id,
            projectTitle:  project.title,
            projectType:   project.type,
            projectStatus: project.status
        });
        const typeLabel = project.type === 'juego' ? 'Videojuego' : 'Aplicación';
        const tags = project.tags.length
            ? project.tags.map(t => `<span class="dev-badge dev-badge-blue">${escHtml(t)}</span>`).join('')
            : '';
        const statusBadge = {
            development: 'dev-badge-blue',
            production:  'dev-badge-green',
            testing:     'dev-badge-purple',
            planning:    'dev-badge-yellow',
            prototipo:   'dev-badge-yellow'
        }[project.status] || 'dev-badge-gray';

        return `<article class="dev-project-card">
            <div class="dev-project-card-head">
                <h3 class="dev-project-title">${escHtml(project.title)}</h3>
                <span class="dev-project-type-tag">${typeLabel}</span>
            </div>
            <p style="color:#7fbfd8;font-size:.82rem;margin:.3rem 0 .6rem;">${escHtml(project.description || 'Sin descripción.')}</p>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:.6rem;">
                <span class="dev-badge ${statusBadge}">${escHtml(project.status)}</span>
                ${tags}
            </div>
            <a class="dev-btn dev-btn-primary dev-btn-sm" href="${escHtml(toSitePath(`pages/admin/panel-desarrollo-proyecto.html?${params.toString()}`))}">Abrir panel</a>
        </article>`;
    }).join('');
}

// ---- Tab system ----
function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.dev-tab-panel').forEach(p => {
                p.hidden = (p.dataset.tabPanel !== target);
            });
        });
    });
}

// ---- Sidebar toggle ----
function initSidebar() {
    if (!sidebarToggleBtn || !sidebar) return;
    sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (sidebar.classList.contains('open')
            && !sidebar.contains(e.target)
            && e.target !== sidebarToggleBtn) {
            sidebar.classList.remove('open');
        }
    });
}

// ---- Events ----
function bindEvents() {
    if (goAdminBtn) goAdminBtn.addEventListener('click', () => { window.location.href = toSitePath('pages/admin/admin.html'); });
    if (reloadBtn)  reloadBtn.addEventListener('click', () => loadProjects());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { if (window.auth && window.signOut) await window.signOut(window.auth); } catch {}
            window.location.replace(toSitePath('index.html'));
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderProjects);
    if (typeFilter)  typeFilter.addEventListener('change', renderProjects);

    // Quick-access link tabs click inside panel (data-tab-go)
    document.querySelectorAll('[data-tab-go]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tabGo;
            const tabBtn = document.querySelector(`[data-tab="${target}"]`);
            if (tabBtn) tabBtn.click();
        });
    });
}

// ---- Auth flow ----
async function onAuthStateResolved(user) {
    if (!user) {
        if (window.auth?.currentUser) return onAuthStateResolved(window.auth.currentUser);
        return;
    }
    if (accessResolved) return;
    accessResolved = true;
    clearAccessTimeout();

    const access = await resolveUserAccess(user);
    if (!access.canAccess) {
        redirectToAdmin('Tu rol no tiene acceso al Panel Desarrollo.');
        return;
    }

    currentUser = user;
    if (userLabelEl) userLabelEl.textContent = user.displayName || user.email || 'Usuario';
    showPanel();
    await loadProjects();
}

function bootAuthListener() {
    if (!window.auth || !window.onAuthStateChanged) { showGateError('Inicializando autenticación...'); return false; }

    window.onAuthStateChanged(window.auth, user => {
        onAuthStateResolved(user).catch(err => {
            console.error('Error validando panel desarrollo:', err);
            redirectToHome('No se pudo validar la sesión en Panel Desarrollo.');
        });
    });

    if (window.auth.currentUser) {
        onAuthStateResolved(window.auth.currentUser).catch(err => {
            console.error('Error usando currentUser dev hub:', err);
        });
    }
    return true;
}

async function init() {
    initSidebar();
    initTabs();
    bindEvents();
    startAccessTimeout();

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => { bootAuthListener(); }, { once: true });

    setTimeout(() => {
        bootAuthListener();
        if (!accessResolved && window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch(err => {
                console.error('Fallback dev hub init failed:', err);
            });
        }
    }, 2200);
}

init();


const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');

function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

const ROLE_ALIASES = {
    founder: 'founder_ceo',
    ceo: 'founder_ceo',
    fundador_ceo: 'founder_ceo',
    'fundador / ceo': 'founder_ceo',
    admin: 'administrador',
    admin_general: 'administrador',
    developer: 'programador',
    modeler: 'modelador',
    viewer: 'usuario'
};

const ALLOWED_PANEL_ROLES = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);

const gate = document.getElementById('devHubGate');
const gateMessage = document.getElementById('devHubGateMessage');
const panel = document.getElementById('devHubPanel');

const goAdminBtn = document.getElementById('devHubGoAdminBtn');
const reloadBtn = document.getElementById('devHubReloadBtn');
const logoutBtn = document.getElementById('devHubLogoutBtn');

const totalProjectsEl = document.getElementById('devHubTotalProjects');
const gamesCountEl = document.getElementById('devHubGamesCount');
const appsCountEl = document.getElementById('devHubAppsCount');
const messageEl = document.getElementById('devHubMessage');
const searchInput = document.getElementById('devHubSearch');
const typeFilter = document.getElementById('devHubTypeFilter');
const projectsGrid = document.getElementById('devHubProjectsGrid');

let projects = [];
let accessResolved = false;
let accessTimeoutId = null;

function normalizeRole(role) {
    const normalizedRaw = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[normalizedRaw] || normalizedRaw || 'usuario';
}

function canAccessDevPanel(role) {
    return ALLOWED_PANEL_ROLES.has(normalizeRole(role));
}

function getConfiguredAdminEmails() {
    try {
        const fromStorage = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '[]');
        const storageEmails = Array.isArray(fromStorage) ? fromStorage : String(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '').split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS, ...storageEmails]
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean))];
    } catch {
        return [...DEFAULT_ADMIN_EMAILS];
    }
}

function setMessage(text, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'dev-message error' : 'dev-message';
}

function showGateError(text) {
    if (gateMessage) {
        gateMessage.textContent = text;
        gateMessage.className = 'dev-message error';
    }
    if (gate) gate.hidden = false;
    if (panel) panel.hidden = true;
}

function showPanel() {
    if (gate) gate.hidden = true;
    if (panel) panel.hidden = false;
}

function clearAccessTimeout() {
    if (accessTimeoutId) {
        clearTimeout(accessTimeoutId);
        accessTimeoutId = null;
    }
}

function startAccessTimeout() {
    clearAccessTimeout();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;

        if (window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch((err) => {
                console.error('Error resolviendo acceso por fallback:', err);
                redirectToHome('No se pudo validar tu rol en el tiempo esperado.');
            });
            return;
        }

        redirectToHome('No se detecto una sesion valida tras 3 segundos.');
    }, 3000);
}

function redirectToHome(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('index.html')), 1400);
}

function redirectToAdmin(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('pages/admin/admin.html')), 1400);
}

async function waitForFirebaseReady(timeout = 5000) {
    return new Promise((resolve) => {
        if (window.db && window.collection && window.getDocs && window.fsDoc && window.getDoc && window.auth && window.onAuthStateChanged) {
            resolve(true);
            return;
        }

        const start = Date.now();
        const timer = setInterval(() => {
            if (window.db && window.collection && window.getDocs && window.fsDoc && window.getDoc && window.auth && window.onAuthStateChanged) {
                clearInterval(timer);
                resolve(true);
            } else if (Date.now() - start >= timeout) {
                clearInterval(timer);
                resolve(false);
            }
        }, 120);
    });
}

async function resolveUserAccess(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return { canAccess: false, role: 'usuario' };
    if (email === FOUNDER_CEO_EMAIL) return { canAccess: true, role: 'founder_ceo' };
    if (getConfiguredAdminEmails().includes(email)) return { canAccess: true, role: 'administrador' };

    let role = 'usuario';
    try {
        const profileSnap = await window.getDoc(window.fsDoc(window.db, 'users', user.uid));
        const profile = profileSnap.exists() ? profileSnap.data() || {} : {};
        role = normalizeRole(profile.role || 'usuario');
        if (profile.isAdmin === true && role === 'usuario') role = 'administrador';
        if (role === 'founder_ceo') return { canAccess: true, role };
    } catch (err) {
        console.error('No se pudo resolver el rol para panel desarrollo:', err);
    }

    return { canAccess: canAccessDevPanel(role), role };
}

function toProject(item, type) {
    const rawStatus = String(item?.status || '').toLowerCase();
    const inDevStatuses = ['development', 'in_progress', 'testing', 'planning', 'dev', 'prototipo', 'production'];
    const isInDevelopment = inDevStatuses.some((tag) => rawStatus.includes(tag));

    return {
        id: String(item?.id || item?.uid || item?.docId || `auto_${Math.random().toString(36).slice(2, 9)}`),
        title: String(item?.title || item?.name || 'Proyecto sin nombre'),
        status: rawStatus || 'development',
        type,
        description: String(item?.description || item?.summary || ''),
        tags: String(item?.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        isInDevelopment
    };
}

async function readCollectionSafe(name) {
    try {
        const snap = await window.getDocs(window.collection(window.db, name));
        return snap.docs.map((docSnap) => ({ docId: docSnap.id, ...(docSnap.data() || {}) }));
    } catch (err) {
        console.warn(`No se pudo leer ${name}:`, err);
        return [];
    }
}

async function loadProjects() {
    setMessage('Cargando proyectos...');

    const [games, apps, applications] = await Promise.all([
        readCollectionSafe('games'),
        readCollectionSafe('apps'),
        readCollectionSafe('applications')
    ]);

    const gameProjects = games.map((g) => toProject(g, 'juego')).filter((g) => g.isInDevelopment);
    const appProjects = [...apps, ...applications].map((a) => toProject(a, 'aplicacion')).filter((a) => a.isInDevelopment);

    // Fallback minimo para que el panel no quede vacio en proyectos iniciales.
    if (appProjects.length === 0) {
        appProjects.push({
            id: 'panter-hub-companion',
            title: 'Panter Hub Companion App',
            status: 'planning',
            type: 'aplicacion',
            description: 'Aplicacion de soporte para comunidad, eventos y seguimiento de progreso.',
            tags: ['companion', 'mobile'],
            isInDevelopment: true
        });
    }

    projects = [...gameProjects, ...appProjects].sort((a, b) => a.title.localeCompare(b.title, 'es'));

    renderStats(projects);
    renderProjects();
    setMessage(projects.length ? `Proyectos detectados: ${projects.length}` : 'No hay proyectos en desarrollo por ahora.');
}

function renderStats(items) {
    const games = items.filter((p) => p.type === 'juego').length;
    const apps = items.filter((p) => p.type === 'aplicacion').length;

    if (totalProjectsEl) totalProjectsEl.textContent = String(items.length);
    if (gamesCountEl) gamesCountEl.textContent = String(games);
    if (appsCountEl) appsCountEl.textContent = String(apps);
}

function getFilteredProjects() {
    const text = String(searchInput?.value || '').trim().toLowerCase();
    const type = String(typeFilter?.value || 'all');

    return projects.filter((project) => {
        if (type !== 'all' && project.type !== type) return false;
        if (!text) return true;

        const haystack = [
            project.title,
            project.description,
            project.status,
            project.type,
            project.tags.join(' ')
        ].join(' ').toLowerCase();

        return haystack.includes(text);
    });
}

function renderProjects() {
    if (!projectsGrid) return;

    const filtered = getFilteredProjects();
    if (!filtered.length) {
        projectsGrid.innerHTML = '<p class="devhub-empty">No hay coincidencias con ese filtro.</p>';
        return;
    }

    projectsGrid.innerHTML = filtered.map((project) => {
        const params = new URLSearchParams({
            projectId: project.id,
            projectTitle: project.title,
            projectType: project.type,
            projectStatus: project.status
        });

        const tags = project.tags.length
            ? project.tags.map((tag) => `<span class="devhub-tag">${tag}</span>`).join('')
            : '<span class="devhub-tag">sin etiquetas</span>';

        return `
            <article class="devhub-project-card">
                <p class="devhub-type">${project.type === 'juego' ? 'Juego' : 'Aplicacion'}</p>
                <h3>${project.title}</h3>
                <p class="devhub-description">${project.description || 'Proyecto en etapa activa de desarrollo.'}</p>
                <div class="devhub-tags-row">${tags}</div>
                <div class="devhub-footer">
                    <span class="devhub-status">Estado: ${project.status}</span>
                    <a class="btn" href="${toSitePath(`pages/admin/panel-desarrollo-proyecto.html?${params.toString()}`)}">Abrir panel del proyecto</a>
                </div>
            </article>
        `;
    }).join('');
}

function bindEvents() {
    if (goAdminBtn) goAdminBtn.addEventListener('click', () => window.location.href = toSitePath('pages/admin/admin.html'));
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadProjects());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (window.auth && window.signOut) await window.signOut(window.auth);
            } catch (err) {
                console.error('Error cerrando sesion:', err);
            } finally {
                window.location.replace(toSitePath('index.html'));
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderProjects);
    if (typeFilter) typeFilter.addEventListener('change', renderProjects);
}

async function onAuthStateResolved(user) {
    if (!user) {
        if (window.auth?.currentUser) {
            return onAuthStateResolved(window.auth.currentUser);
        }
        return;
    }

    if (accessResolved) return;
    accessResolved = true;
    clearAccessTimeout();

    const access = await resolveUserAccess(user);
    if (!access.canAccess) {
        redirectToAdmin('Tu rol no tiene acceso al Panel Desarrollo.');
        return;
    }

    showPanel();
    await loadProjects();
}

function bootAuthListener() {
    if (!window.auth || !window.onAuthStateChanged) {
        showGateError('Inicializando autenticacion...');
        return false;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        onAuthStateResolved(user).catch((err) => {
            console.error('Error validando panel desarrollo:', err);
            redirectToHome('No se pudo validar la sesion en Panel Desarrollo.');
        });
    });

    if (window.auth.currentUser) {
        onAuthStateResolved(window.auth.currentUser).catch((err) => {
            console.error('Error usando currentUser en panel desarrollo:', err);
        });
    }

    return true;
}

async function init() {
    bindEvents();
    startAccessTimeout();

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => {
        bootAuthListener();
    }, { once: true });

    setTimeout(() => {
        bootAuthListener();
        if (!accessResolved && window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch((err) => {
                console.error('Error resolviendo currentUser por fallback:', err);
            });
        }
    }, 2200);
}

init();
