const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';

const ROLE_ALIASES = {
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

function normalizeRole(role) {
    const normalizedRaw = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[normalizedRaw] || normalizedRaw || 'usuario';
}

function canAccessDevPanel(role) {
    return ALLOWED_PANEL_ROLES.has(normalizeRole(role));
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

function redirectToHome(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace('index.html'), 1400);
}

function redirectToAdmin(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace('admin.html'), 1400);
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

    let role = 'usuario';
    try {
        const profileSnap = await window.getDoc(window.fsDoc(window.db, 'users', user.uid));
        const profile = profileSnap.exists() ? profileSnap.data() || {} : {};
        role = normalizeRole(profile.role || 'usuario');
        if (profile.isAdmin === true && role === 'usuario') role = 'administrador';
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
                    <a class="btn" href="panel-desarrollo-proyecto.html?${params.toString()}">Abrir panel del proyecto</a>
                </div>
            </article>
        `;
    }).join('');
}

function bindEvents() {
    if (goAdminBtn) goAdminBtn.addEventListener('click', () => window.location.href = 'admin.html');
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadProjects());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (window.auth && window.signOut) await window.signOut(window.auth);
            } catch (err) {
                console.error('Error cerrando sesion:', err);
            } finally {
                window.location.replace('index.html');
            }
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderProjects);
    if (typeFilter) typeFilter.addEventListener('change', renderProjects);
}

async function onAuthStateChanged(user) {
    if (!user) {
        redirectToHome('Debes iniciar sesion para acceder al Panel Desarrollo.');
        return;
    }

    const access = await resolveUserAccess(user);
    if (!access.canAccess) {
        redirectToAdmin('Tu rol no tiene acceso al Panel Desarrollo.');
        return;
    }

    showPanel();
    await loadProjects();
}

async function init() {
    bindEvents();

    const ready = await waitForFirebaseReady();
    if (!ready) {
        showGateError('Firebase no cargo a tiempo. Recarga la pagina.');
        return;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        onAuthStateChanged(user).catch((err) => {
            console.error('Error validando panel desarrollo:', err);
            redirectToHome('No se pudo validar la sesion en Panel Desarrollo.');
        });
    });
}

init();
