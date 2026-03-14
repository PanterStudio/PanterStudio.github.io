const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = ['pantergamey@gmail.com', 'panterstudiogamedev@gmail.com'];

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
const DEV_STATUSES = new Set(['development', 'planning', 'testing', 'production', 'prototipo', 'in_progress']);

const gate = document.getElementById('devHubGate');
const gateMessage = document.getElementById('devHubGateMessage');
const panel = document.getElementById('devHubPanel');

const userLabelEl = document.getElementById('devHubUserLabel');
const goAdminBtn = document.getElementById('devHubGoAdminBtn');
const reloadBtn = document.getElementById('devHubReloadBtn');
const logoutBtn = document.getElementById('devHubLogoutBtn');
const sidebarToggleBtn = document.getElementById('devSidebarToggle');
const sidebar = document.getElementById('devSidebar');

const totalProjectsEl = document.getElementById('devHubTotalProjects');
const gamesCountEl = document.getElementById('devHubGamesCount');
const appsCountEl = document.getElementById('devHubAppsCount');
const openTasksEl = document.getElementById('devHubOpenTasks');
const openBugsEl = document.getElementById('devHubOpenBugs');

const messageEl = document.getElementById('devHubMessage');
const searchInput = document.getElementById('devHubSearch');
const typeFilter = document.getElementById('devHubTypeFilter');
const projectsGrid = document.getElementById('devHubProjectsGrid');
const activityList = document.getElementById('devHubActivityList');

const createProjectTypeEl = document.getElementById('devCreateProjectType');
const createProjectStatusEl = document.getElementById('devCreateProjectStatus');
const createProjectTitleEl = document.getElementById('devCreateProjectTitle');
const createProjectSummaryEl = document.getElementById('devCreateProjectSummary');
const createProjectImageEl = document.getElementById('devCreateProjectImage');
const createProjectPlatformEl = document.getElementById('devCreateProjectPlatform');
const createProjectProgressEl = document.getElementById('devCreateProjectProgress');
const createProjectPreregUrlEl = document.getElementById('devCreateProjectPreregUrl');
const createProjectExternalUrlEl = document.getElementById('devCreateProjectExternalUrl');
const createProjectDiscordUrlEl = document.getElementById('devCreateProjectDiscordUrl');
const createProjectTagsEl = document.getElementById('devCreateProjectTags');
const createProjectFeaturedEl = document.getElementById('devCreateProjectFeatured');
const createProjectPublishedEl = document.getElementById('devCreateProjectPublished');
const createProjectBtn = document.getElementById('devCreateProjectBtn');
const createProjectMsgEl = document.getElementById('devCreateProjectMsg');

const createUpdateProjectEl = document.getElementById('devCreateUpdateProject');
const createUpdateTitleEl = document.getElementById('devCreateUpdateTitle');
const createUpdateSummaryEl = document.getElementById('devCreateUpdateSummary');
const createUpdateContentEl = document.getElementById('devCreateUpdateContent');
const createUpdateImageEl = document.getElementById('devCreateUpdateImage');
const createUpdatePublishedEl = document.getElementById('devCreateUpdatePublished');
const createUpdateBtn = document.getElementById('devCreateUpdateBtn');
const createUpdateMsgEl = document.getElementById('devCreateUpdateMsg');

const createAdvanceProjectEl = document.getElementById('devAdvanceProject');
const createAdvanceTitleEl = document.getElementById('devAdvanceTitle');
const createAdvanceSummaryEl = document.getElementById('devAdvanceSummary');
const createAdvanceParamsEl = document.getElementById('devAdvanceParams');
const createAdvanceDateEl = document.getElementById('devAdvanceDate');
const createAdvancePublishedEl = document.getElementById('devAdvancePublished');
const createAdvanceBtn = document.getElementById('devCreateAdvanceBtn');
const refreshAdvancesBtn = document.getElementById('devRefreshAdvancesBtn');
const createAdvanceMsgEl = document.getElementById('devCreateAdvanceMsg');
const advancesListEl = document.getElementById('devAdvancesList');
const advCalendarEl = document.getElementById('advCalendar');
const advCalMonthLabel = document.getElementById('advCalMonthLabel');
const advCalPrev = document.getElementById('advCalPrev');
const advCalNext = document.getElementById('advCalNext');
const advDayEntriesEl = document.getElementById('advDayEntries');

// Modal controls
const devAdvancesModal = document.getElementById('devAdvancesModal');
const devAdvancesBackdrop = document.getElementById('devAdvancesBackdrop');
const devOpenAdvancesBtn = document.getElementById('devOpenAdvancesBtn');
const devAdvancesModalCloseBtn = document.getElementById('devAdvancesModalClose');

let advances = [];
let advCurrentMonth = new Date();

const siteAnnouncementEl = document.getElementById('devSiteAnnouncement');
const featuredProjectEl = document.getElementById('devFeaturedProject');
const enableNewsPageEl = document.getElementById('devEnableNewsPage');
const showFeaturedFirstEl = document.getElementById('devShowFeaturedFirst');
const homePromoTextEl = document.getElementById('devHomePromoText');
const saveSiteConfigBtn = document.getElementById('devSaveSiteConfigBtn');
const saveSiteConfigMsgEl = document.getElementById('devSaveSiteConfigMsg');

let projects = [];
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;
let siteSettings = {};

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80) || `proyecto-${Date.now()}`;
}

function normalizeRole(role) {
    const raw = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[raw] || raw || 'usuario';
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

function setMessage(text, isError = false) {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.className = isError ? 'dev-msg error' : 'dev-msg';
}

function setInlineMessage(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'dev-msg error' : 'dev-msg';
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

function clearAccessTimeout() {
    if (!accessTimeoutId) return;
    clearTimeout(accessTimeoutId);
    accessTimeoutId = null;
}

function startAccessTimeout() {
    clearAccessTimeout();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;
        if (window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch(() => redirectToHome('Tiempo agotado.'));
            return;
        }
        redirectToHome('No se detecto sesion valida tras 3 segundos.');
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
    } catch (err) {
        console.warn('No se pudo leer perfil en dev hub:', err);
    }

    return { canAccess: ALLOWED_PANEL_ROLES.has(role), role };
}

async function readCollectionSafe(name) {
    try {
        const snap = await window.getDocs(window.collection(window.db, name));
        return snap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    } catch (err) {
        console.warn(`No se pudo leer ${name}:`, err);
        return [];
    }
}

function toProject(item, type, collectionName) {
    const status = String(item?.status || 'development').toLowerCase();
    const tags = Array.isArray(item?.tags)
        ? item.tags.map(tag => String(tag).trim()).filter(Boolean)
        : String(item?.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);

    return {
        id: String(item?.id || item?.uid || item?.docId || `auto_${Math.random().toString(36).slice(2, 9)}`),
        title: String(item?.title || item?.name || 'Proyecto sin nombre'),
        type,
        collection: collectionName,
        status,
        published: item?.published !== false,
        featuredPublic: item?.featuredPublic === true,
        description: String(item?.description || item?.summary || ''),
        image: String(item?.image || item?.cover || ''),
        platform: String(item?.platform || ''),
        progress: Number(item?.progress || 0),
        preregisterUrl: String(item?.preregisterUrl || ''),
        externalUrl: String(item?.externalUrl || item?.downloadUrl || ''),
        discordUrl: String(item?.discordUrl || ''),
        tags,
        isInDevelopment: DEV_STATUSES.has(status)
    };
}

async function loadSiteSettings() {
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'settings', 'site'));
        siteSettings = snap.exists() ? snap.data() || {} : {};
    } catch (err) {
        console.warn('No se pudo leer settings/site:', err);
        siteSettings = {};
    }

    if (siteAnnouncementEl) siteAnnouncementEl.value = String(siteSettings.announcement || '');
    if (enableNewsPageEl) enableNewsPageEl.checked = siteSettings.enableNewsPage !== false;
    if (showFeaturedFirstEl) showFeaturedFirstEl.checked = siteSettings.showFeaturedFirst !== false;
    if (homePromoTextEl) homePromoTextEl.value = String(siteSettings.homePromoText || '');
}

async function ensureNuestraTierraSeed() {
    const docRef = window.fsDoc(window.db, 'games', 'nuestra-tierra-job-simulator');
    const docSnap = await window.getDoc(docRef);
    if (docSnap.exists()) return;

    const now = new Date().toISOString();
    await window.setDoc(docRef, {
        id: 'nuestra-tierra-job-simulator',
        title: 'Nuestra Tierra Job Simulator',
        name: 'Nuestra Tierra Job Simulator',
        summary: 'Simulador colombiano de oficios con progresion por habilidades y economia local.',
        description: 'Simulador colombiano de oficios con progresion por habilidades y economia local.',
        image: 'https://i.imgur.com/tWQ3svn.jpeg',
        tags: ['simulacion', 'movil', 'narrativa', 'comunidad'],
        platform: 'Movil',
        progress: 35,
        type: 'juego',
        status: 'development',
        published: true,
        featuredPublic: true,
        preregisterUrl: toSitePath('pages/preregistro.html'),
        createdAt: now,
        updatedAt: now,
        createdByUid: currentUser?.uid || ''
    }, { merge: true });
}

function renderStats(items) {
    const games = items.filter(item => item.type === 'juego').length;
    const apps = items.filter(item => item.type === 'aplicacion').length;
    if (totalProjectsEl) totalProjectsEl.textContent = String(items.length);
    if (gamesCountEl) gamesCountEl.textContent = String(games);
    if (appsCountEl) appsCountEl.textContent = String(apps);
}

function getFilteredProjects() {
    const search = String(searchInput?.value || '').trim().toLowerCase();
    const type = String(typeFilter?.value || 'all');
    return projects.filter(project => {
        if (type !== 'all' && project.type !== type) return false;
        if (!search) return true;
        return [project.title, project.description, project.status, project.tags.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(search);
    });
}

function renderProjects() {
    if (!projectsGrid) return;
    const items = getFilteredProjects();
    if (!items.length) {
        projectsGrid.innerHTML = '<p class="dev-empty">No hay coincidencias con ese filtro.</p>';
        return;
    }

    projectsGrid.innerHTML = items.map(project => {
        const panelParams = new URLSearchParams({
            projectId: project.id,
            projectTitle: project.title,
            projectType: project.type,
            projectStatus: project.status
        });
        const publicParams = new URLSearchParams({
            projectId: project.id,
            projectType: project.type
        });

        const statusBadge = {
            development: 'dev-badge-blue',
            planning: 'dev-badge-yellow',
            testing: 'dev-badge-purple',
            production: 'dev-badge-green'
        }[project.status] || 'dev-badge-gray';

        const typeLabel = project.type === 'juego' ? 'Videojuego' : 'Aplicacion';
        const tags = project.tags.length
            ? project.tags.map(tag => `<span class="dev-badge dev-badge-blue">${escHtml(tag)}</span>`).join('')
            : '';

        return `<article class="dev-project-card">
            <div class="dev-project-card-head">
                <h3 class="dev-project-title">${escHtml(project.title)}</h3>
                <span class="dev-project-type-tag">${typeLabel}</span>
            </div>
            <p style="color:#7fbfd8;font-size:.82rem;margin:.3rem 0 .6rem;">${escHtml(project.description || 'Sin descripcion')}</p>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:.6rem;">
                <span class="dev-badge ${statusBadge}">${escHtml(project.status)}</span>
                ${project.published ? '<span class="dev-badge dev-badge-green">publico</span>' : '<span class="dev-badge dev-badge-gray">oculto</span>'}
                ${project.featuredPublic ? '<span class="dev-badge dev-badge-yellow">destacado</span>' : ''}
                ${project.platform ? `<span class="dev-badge dev-badge-purple">${escHtml(project.platform)}</span>` : ''}
                ${project.progress ? `<span class="dev-badge dev-badge-green">${escHtml(project.progress)}%</span>` : ''}
                ${tags}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
                <a class="dev-btn dev-btn-primary dev-btn-sm" href="${escHtml(toSitePath(`pages/admin/panel-desarrollo-proyecto.html?${panelParams.toString()}`))}">Abrir panel</a>
                <a class="dev-btn dev-btn-sm" href="${escHtml(toSitePath(`pages/proyecto.html?${publicParams.toString()}`))}" target="_blank" rel="noopener">Ver pagina publica</a>
            </div>
        </article>`;
    }).join('');
}

function populateProjectSelect() {
    if (!createUpdateProjectEl) return;
    const previous = createUpdateProjectEl.value;
    const options = projects
        .map(project => {
            const value = `${project.collection}::${project.id}`;
            return `<option value="${escHtml(value)}" data-title="${escHtml(project.title)}" data-type="${escHtml(project.type)}">${escHtml(project.title)} (${project.type})</option>`;
        })
        .join('');

    createUpdateProjectEl.innerHTML = '<option value="">Selecciona un proyecto...</option>' + options;
    if (previous && Array.from(createUpdateProjectEl.options).some(option => option.value === previous)) {
        createUpdateProjectEl.value = previous;
    }

    if (featuredProjectEl) {
        const featuredPrevious = featuredProjectEl.value;
        featuredProjectEl.innerHTML = '<option value="">Ninguno</option>' + projects.map(project =>
            `<option value="${escHtml(project.id)}">${escHtml(project.title)} (${escHtml(project.type)})</option>`
        ).join('');
        const preferredValue = String(siteSettings.featuredProjectId || '');
        const nextValue = Array.from(featuredProjectEl.options).some(option => option.value === preferredValue)
            ? preferredValue
            : featuredPrevious;
        if (nextValue && Array.from(featuredProjectEl.options).some(option => option.value === nextValue)) {
            featuredProjectEl.value = nextValue;
        }
    }
}

async function loadGlobalKpis() {
    try {
        const [tasksSnap, bugsSnap] = await Promise.all([
            window.getDocs(window.collection(window.db, 'development_project_tasks')).catch(() => null),
            window.getDocs(window.collection(window.db, 'bugs')).catch(() => null)
        ]);

        const openTasks = tasksSnap
            ? tasksSnap.docs.filter(doc => String(doc.data()?.status || '') !== 'terminada').length
            : '—';
        const openBugs = bugsSnap
            ? bugsSnap.docs.filter(doc => {
                const status = String(doc.data()?.status || '');
                return status !== 'resuelto' && status !== 'verificado' && status !== 'no_reproducible';
            }).length
            : '—';

        if (openTasksEl) openTasksEl.textContent = String(openTasks);
        if (openBugsEl) openBugsEl.textContent = String(openBugs);
    } catch (err) {
        console.warn('No se pudieron cargar KPIs globales:', err);
    }
}

async function loadRecentActivity() {
    if (!activityList) return;
    try {
        const [tasksSnap, updatesSnap] = await Promise.all([
            window.getDocs(window.collection(window.db, 'development_project_tasks')).catch(() => null),
            window.getDocs(window.collection(window.db, 'project_updates')).catch(() => null)
        ]);

        const taskItems = tasksSnap
            ? tasksSnap.docs.map(doc => {
                const data = doc.data() || {};
                return {
                    label: `Tarea: ${String(data.title || 'Sin titulo')}`,
                    date: String(data.updatedAt || data.createdAt || ''),
                    badge: String(data.status || 'pendiente')
                };
            })
            : [];

        const updateItems = updatesSnap
            ? updatesSnap.docs.map(doc => {
                const data = doc.data() || {};
                return {
                    label: `Actualizacion: ${String(data.title || 'Sin titulo')}`,
                    date: String(data.updatedAt || data.createdAt || ''),
                    badge: 'actualizacion'
                };
            })
            : [];

        const recent = [...taskItems, ...updateItems]
            .filter(item => item.date)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .slice(0, 20);

        if (!recent.length) {
            activityList.innerHTML = '<p class="dev-empty">Sin actividad reciente.</p>';
            return;
        }

        activityList.innerHTML = recent.map(item => {
            const badgeMap = {
                terminada: 'dev-badge-green',
                en_curso: 'dev-badge-blue',
                bloqueada: 'dev-badge-red',
                lista_qa: 'dev-badge-purple',
                pendiente: 'dev-badge-gray',
                actualizacion: 'dev-badge-yellow'
            };
            const badgeClass = badgeMap[item.badge] || 'dev-badge-gray';
            const dateLabel = item.date ? new Date(item.date).toLocaleDateString('es', { day: '2-digit', month: 'short' }) : '—';
            return `<div class="dev-recent-task">
                <span class="dev-recent-task-title">${escHtml(item.label)}</span>
                <span class="dev-badge ${badgeClass}">${escHtml(item.badge)}</span>
                <span class="dev-recent-task-meta" style="min-width:60px;text-align:right">${escHtml(dateLabel)}</span>
            </div>`;
        }).join('');
    } catch (err) {
        console.warn('No se pudo cargar actividad reciente:', err);
        activityList.innerHTML = '<p class="dev-empty">No se pudo cargar la actividad.</p>';
    }
}

async function loadProjects() {
    setMessage('Cargando proyectos...');

    try {
        await ensureNuestraTierraSeed();
    } catch (err) {
        console.warn('No se pudo sembrar Nuestra Tierra automaticamente:', err);
    }

    const [games, apps, applications] = await Promise.all([
        readCollectionSafe('games'),
        readCollectionSafe('apps'),
        readCollectionSafe('applications')
    ]);

    const gameProjects = games.map(item => toProject(item, 'juego', 'games')).filter(item => item.isInDevelopment);
    const appProjects = [...apps.map(item => toProject(item, 'aplicacion', 'apps')), ...applications.map(item => toProject(item, 'aplicacion', 'applications'))]
        .filter(item => item.isInDevelopment);

    const dedupeMap = new Map();
    [...gameProjects, ...appProjects].forEach(project => {
        if (!dedupeMap.has(project.id)) dedupeMap.set(project.id, project);
    });

    projects = [...dedupeMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'es'));

    renderStats(projects);
    renderProjects();
    populateProjectSelect();
    await Promise.all([loadSiteSettings(), loadGlobalKpis(), loadRecentActivity()]);
    populateProjectSelect();
    try { await loadAdvances(); } catch {};
    setMessage(projects.length ? `${projects.length} proyectos en desarrollo` : 'No hay proyectos en desarrollo por ahora.');
}

async function createProject() {
    const type = String(createProjectTypeEl?.value || 'juego');
    const status = String(createProjectStatusEl?.value || 'development');
    const title = String(createProjectTitleEl?.value || '').trim();
    const summary = String(createProjectSummaryEl?.value || '').trim();
    const image = String(createProjectImageEl?.value || '').trim();
    const platform = String(createProjectPlatformEl?.value || '').trim();
    const progress = Math.max(0, Math.min(100, Number(createProjectProgressEl?.value || 0) || 0));
    const preregisterUrl = String(createProjectPreregUrlEl?.value || '').trim();
    const externalUrl = String(createProjectExternalUrlEl?.value || '').trim();
    const discordUrl = String(createProjectDiscordUrlEl?.value || '').trim();
    const tags = String(createProjectTagsEl?.value || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
    const featuredPublic = Boolean(createProjectFeaturedEl?.checked);
    const published = Boolean(createProjectPublishedEl?.checked);

    if (!title) {
        setInlineMessage(createProjectMsgEl, 'El nombre del proyecto es obligatorio.', true);
        return;
    }

    if (image && !/^https?:\/\//i.test(image)) {
        setInlineMessage(createProjectMsgEl, 'La imagen debe empezar por http:// o https://', true);
        return;
    }
    const urlChecks = [
        { value: preregisterUrl, label: 'La URL de pre-registro' },
        { value: externalUrl, label: 'La URL externa' },
        { value: discordUrl, label: 'La URL de Discord' }
    ];
    for (const check of urlChecks) {
        if (check.value && !/^(https?:\/\/|\.\.\/|\.\/|\/)/i.test(check.value)) {
            setInlineMessage(createProjectMsgEl, `${check.label} debe ser valida.`, true);
            return;
        }
    }

    const collectionName = type === 'juego' ? 'games' : 'applications';
    const id = slugify(title);
    const now = new Date().toISOString();

    const payload = {
        id,
        title,
        name: title,
        type,
        status,
        published,
        featuredPublic,
        summary,
        description: summary,
        image,
        platform,
        progress,
        preregisterUrl,
        externalUrl,
        discordUrl,
        tags,
        createdAt: now,
        updatedAt: now,
        createdByUid: currentUser?.uid || ''
    };

    try {
        setInlineMessage(createProjectMsgEl, 'Guardando proyecto...');
        await window.setDoc(window.fsDoc(window.db, collectionName, id), payload, { merge: true });
        setInlineMessage(createProjectMsgEl, 'Proyecto guardado correctamente.');

        if (createProjectTitleEl) createProjectTitleEl.value = '';
        if (createProjectSummaryEl) createProjectSummaryEl.value = '';
        if (createProjectImageEl) createProjectImageEl.value = '';
        if (createProjectPlatformEl) createProjectPlatformEl.value = '';
        if (createProjectProgressEl) createProjectProgressEl.value = '';
        if (createProjectPreregUrlEl) createProjectPreregUrlEl.value = '';
        if (createProjectExternalUrlEl) createProjectExternalUrlEl.value = '';
        if (createProjectDiscordUrlEl) createProjectDiscordUrlEl.value = '';
        if (createProjectTagsEl) createProjectTagsEl.value = '';
        if (createProjectFeaturedEl) createProjectFeaturedEl.checked = false;

        await loadProjects();
    } catch (err) {
        console.error('Error creando proyecto:', err);
        setInlineMessage(createProjectMsgEl, 'No se pudo guardar el proyecto.', true);
    }
}

async function saveSiteConfig() {
    const payload = {
        announcement: String(siteAnnouncementEl?.value || '').trim(),
        featuredProjectId: String(featuredProjectEl?.value || '').trim(),
        enableNewsPage: Boolean(enableNewsPageEl?.checked),
        showFeaturedFirst: Boolean(showFeaturedFirstEl?.checked),
        homePromoText: String(homePromoTextEl?.value || '').trim(),
        updatedAt: new Date().toISOString(),
        updatedByUid: currentUser?.uid || ''
    };

    try {
        setInlineMessage(saveSiteConfigMsgEl, 'Guardando configuracion...');
        await window.setDoc(window.fsDoc(window.db, 'settings', 'site'), payload, { merge: true });
        siteSettings = { ...siteSettings, ...payload };
        setInlineMessage(saveSiteConfigMsgEl, 'Configuracion guardada.');
    } catch (err) {
        console.error('Error guardando settings/site:', err);
        setInlineMessage(saveSiteConfigMsgEl, 'No se pudo guardar la configuracion.', true);
    }
}

async function createProjectUpdate() {
    const selected = String(createUpdateProjectEl?.value || '');
    const title = String(createUpdateTitleEl?.value || '').trim();
    const summary = String(createUpdateSummaryEl?.value || '').trim();
    const content = String(createUpdateContentEl?.value || '').trim();
    const image = String(createUpdateImageEl?.value || '').trim();
    const published = Boolean(createUpdatePublishedEl?.checked);

    if (!selected) {
        setInlineMessage(createUpdateMsgEl, 'Debes seleccionar un proyecto.', true);
        return;
    }
    if (!title) {
        setInlineMessage(createUpdateMsgEl, 'El titulo es obligatorio.', true);
        return;
    }
    if (!content) {
        setInlineMessage(createUpdateMsgEl, 'El detalle de la actualizacion es obligatorio.', true);
        return;
    }
    if (image && !/^https?:\/\//i.test(image)) {
        setInlineMessage(createUpdateMsgEl, 'La imagen debe empezar por http:// o https://', true);
        return;
    }

    const [collectionName, projectId] = selected.split('::');
    const project = projects.find(item => item.id === projectId && item.collection === collectionName) || projects.find(item => item.id === projectId);
    if (!project) {
        setInlineMessage(createUpdateMsgEl, 'No se encontro el proyecto seleccionado.', true);
        return;
    }

    const now = new Date().toISOString();
    const updateId = `upd_${Date.now()}`;

    const payload = {
        id: updateId,
        projectId: project.id,
        projectType: project.type,
        projectTitle: project.title,
        title,
        summary,
        content,
        image,
        published,
        date: now,
        createdAt: now,
        updatedAt: now,
        createdByUid: currentUser?.uid || ''
    };

    try {
        setInlineMessage(createUpdateMsgEl, 'Publicando actualizacion...');
        await window.setDoc(window.fsDoc(window.db, 'project_updates', updateId), payload, { merge: true });

        await window.setDoc(window.fsDoc(window.db, project.collection, project.id), {
            updatedAt: now,
            lastUpdateAt: now
        }, { merge: true });

        setInlineMessage(createUpdateMsgEl, 'Actualizacion publicada.');

        if (createUpdateTitleEl) createUpdateTitleEl.value = '';
        if (createUpdateSummaryEl) createUpdateSummaryEl.value = '';
        if (createUpdateContentEl) createUpdateContentEl.value = '';
        if (createUpdateImageEl) createUpdateImageEl.value = '';

        await loadRecentActivity();
    } catch (err) {
        console.error('Error publicando actualizacion:', err);
        setInlineMessage(createUpdateMsgEl, 'No se pudo publicar la actualizacion.', true);
    }
}

function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('[data-tab]').forEach(tabBtn => tabBtn.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.dev-tab-panel').forEach(panelEl => {
                panelEl.hidden = panelEl.dataset.tabPanel !== target;
            });
        });
    });
}

function initSidebar() {
    if (!sidebarToggleBtn || !sidebar) return;
    sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', event => {
        if (!sidebar.classList.contains('open')) return;
        if (sidebar.contains(event.target) || event.target === sidebarToggleBtn) return;
        sidebar.classList.remove('open');
    });
}

function bindEvents() {
    goAdminBtn?.addEventListener('click', () => { window.location.href = toSitePath('pages/admin/admin.html'); });
    reloadBtn?.addEventListener('click', () => { loadProjects().catch(() => setMessage('No se pudieron recargar proyectos.', true)); });

    logoutBtn?.addEventListener('click', async () => {
        try { if (window.auth && window.signOut) await window.signOut(window.auth); } catch {}
        window.location.replace(toSitePath('index.html'));
    });

    searchInput?.addEventListener('input', renderProjects);
    typeFilter?.addEventListener('change', renderProjects);

    createProjectBtn?.addEventListener('click', createProject);
    createUpdateBtn?.addEventListener('click', createProjectUpdate);
    saveSiteConfigBtn?.addEventListener('click', saveSiteConfig);
    // Avances events
    createAdvanceBtn?.addEventListener('click', createAdvance);
    refreshAdvancesBtn?.addEventListener('click', () => { loadAdvances().catch(() => {}); });
    advCalPrev?.addEventListener('click', () => { advCurrentMonth = new Date(advCurrentMonth.getFullYear(), advCurrentMonth.getMonth() - 1, 1); buildAdvCalendar(); });
    advCalNext?.addEventListener('click', () => { advCurrentMonth = new Date(advCurrentMonth.getFullYear(), advCurrentMonth.getMonth() + 1, 1); buildAdvCalendar(); });

    // Modal open/close handlers
    devOpenAdvancesBtn?.addEventListener('click', () => {
        if (!devAdvancesModal) return;
        devAdvancesModal.hidden = false;
        document.body.classList.add('modal-open');
        // set default date to now
        if (createAdvanceDateEl && !createAdvanceDateEl.value) {
            const now = new Date();
            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
            createAdvanceDateEl.value = local;
        }
        advCurrentMonth = new Date();
        loadAdvances().catch(() => {});
    });

    devAdvancesModalCloseBtn?.addEventListener('click', () => {
        if (!devAdvancesModal) return;
        devAdvancesModal.hidden = true;
        document.body.classList.remove('modal-open');
    });
    devAdvancesBackdrop?.addEventListener('click', () => { devAdvancesModal.hidden = true; document.body.classList.remove('modal-open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && devAdvancesModal && !devAdvancesModal.hidden) { devAdvancesModal.hidden = true; document.body.classList.remove('modal-open'); } });
}

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
    if (!window.auth || !window.onAuthStateChanged || !window.db || !window.getDoc || !window.getDocs || !window.collection || !window.fsDoc || !window.setDoc) {
        showGateError('Inicializando autenticacion...');
        return false;
    }

    window.onAuthStateChanged(window.auth, user => {
        onAuthStateResolved(user).catch(err => {
            console.error('Error validando panel desarrollo:', err);
            redirectToHome('No se pudo validar la sesion en Panel Desarrollo.');
        });
    });

    if (window.auth.currentUser) {
        onAuthStateResolved(window.auth.currentUser).catch(err => {
            console.error('Error usando currentUser dev hub:', err);
        });
    }

    return true;
}

function init() {
    initSidebar();
    initTabs();
    bindEvents();
    startAccessTimeout();

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => { bootAuthListener(); }, { once: true });
    setTimeout(() => {
        bootAuthListener();
        if (!accessResolved && window.auth?.currentUser) {
            onAuthStateResolved(window.auth.currentUser).catch(() => {});
        }
    }, 2200);
}

init();
