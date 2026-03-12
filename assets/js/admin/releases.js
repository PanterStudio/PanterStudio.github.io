/* releases.js – releases tracker for Panter Studio dev panel */
const FOUNDER_CEO_EMAIL   = 'pantergamey@gmail.com';
const RELEASES_COLLECTION = 'releases';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS= ['pantergamey@gmail.com', 'panterstudiogamedev@gmail.com'];

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
function toSitePath(p) { return (SITE_ROOT + '/' + String(p || '').replace(/^\/+/, '')).replace(/\\/g, '/'); }

const ROLE_ALIASES = {
    founder:'founder_ceo', ceo:'founder_ceo', fundador_ceo:'founder_ceo', 'fundador / ceo':'founder_ceo',
    admin:'administrador', admin_general:'administrador', developer:'programador', modeler:'modelador', viewer:'usuario'
};
const ALLOWED = new Set(['founder_ceo','administrador','programador','modelador']);

const gate        = document.getElementById('relGate');
const gateMessage = document.getElementById('relGateMessage');
const panel       = document.getElementById('relPanel');
const userLabelEl = document.getElementById('relUserLabel');
const sidebarToggle = document.getElementById('relSidebarToggle');
const sidebar     = document.getElementById('relSidebar');
const reloadBtn   = document.getElementById('relReloadBtn');
const logoutBtn   = document.getElementById('relLogoutBtn');

const relTotalEl  = document.getElementById('relTotal');
const relPublicEl = document.getElementById('relPublic');
const relBetaEl   = document.getElementById('relBeta');
const relAlphaEl  = document.getElementById('relAlpha');

const relForm        = document.getElementById('relForm');
const relIdInput     = document.getElementById('relId');
const relProject     = document.getElementById('relProject');
const relVersion     = document.getElementById('relVersion');
const relType        = document.getElementById('relType');
const relPlatform    = document.getElementById('relPlatform');
const relDownloadUrl = document.getElementById('relDownloadUrl');
const relSize        = document.getElementById('relSize');
const relDate        = document.getElementById('relDate');
const relNotes       = document.getElementById('relNotes');
const relResetBtn    = document.getElementById('relResetBtn');
const relFormTitle   = document.getElementById('relFormTitle');
const relMessage     = document.getElementById('relMessage');

const relSearch        = document.getElementById('relSearch');
const relTypeFilter    = document.getElementById('relTypeFilter');
const relProjectFilter = document.getElementById('relProjectFilter');
const relList          = document.getElementById('relList');

let releases = [];
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;

// ---- Helpers ----
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalizeRole(r) { const s = String(r||'').trim().toLowerCase(); return ROLE_ALIASES[s]||s||'usuario'; }

function getAdminEmails() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY)||'[]');
        const arr = Array.isArray(stored) ? stored : String(stored).split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS,...arr].map(e=>String(e).trim().toLowerCase()).filter(Boolean))];
    } catch { return [...DEFAULT_ADMIN_EMAILS]; }
}

function setMsg(text, isError=false) {
    if (!relMessage) return;
    relMessage.textContent = text||'';
    relMessage.className   = isError ? 'dev-msg error' : 'dev-msg';
}

function showGateError(text) {
    if (gateMessage) { gateMessage.textContent = text; gateMessage.className='dev-msg error'; }
    if (gate)  gate.hidden  = false;
    if (panel) panel.hidden = true;
}

function showPanel() { if (gate) gate.hidden=true; if (panel) panel.hidden=false; }

function clearTimeout_() { if (accessTimeoutId) { clearTimeout(accessTimeoutId); accessTimeoutId=null; } }

function startTimeout() {
    clearTimeout_();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;
        if (window.auth?.currentUser) { handleAuth(window.auth.currentUser).catch(()=>redirectHome('Tiempo agotado.')); return; }
        redirectHome('No se detecto sesion tras 3 segundos.');
    }, 3000);
}

function redirectHome(msg) { showGateError(msg); setTimeout(()=>window.location.replace(toSitePath('index.html')), 1400); }

// ---- Access resolution ----
async function resolveAccess(user) {
    const email = String(user?.email||'').trim().toLowerCase();
    if (!email) return false;
    if (email === FOUNDER_CEO_EMAIL || getAdminEmails().includes(email)) return true;
    try {
        const snap = await window.getDoc(window.fsDoc(window.db,'users',user.uid));
        const profile = snap.exists() ? snap.data()||{} : {};
        const role = normalizeRole(profile.role||'usuario');
        if (profile.isAdmin===true || role==='founder_ceo') return true;
        return ALLOWED.has(role);
    } catch { return false; }
}

// ---- Data ----
function parseRelease(d) {
    const data = d.data()||{};
    return {
        id:          String(data.id||d.id),
        project:     String(data.project||'Sin proyecto'),
        version:     String(data.version||'v?'),
        type:        String(data.type||'interna'),
        platform:    String(data.platform||''),
        downloadUrl: String(data.downloadUrl||''),
        size:        String(data.size||''),
        date:        String(data.date||''),
        notes:       String(data.notes||''),
        createdAt:   String(data.createdAt||''),
        updatedAt:   String(data.updatedAt||''),
        createdByUid:String(data.createdByUid||'')
    };
}

async function loadReleases() {
    try {
        const snap = await window.getDocs(window.collection(window.db, RELEASES_COLLECTION));
        releases = snap.docs.map(parseRelease)
            .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        renderKpis();
        populateProjectFilter();
        renderList();
        setMsg('');
    } catch (err) {
        console.error('Error cargando releases:', err);
        setMsg('No se pudieron cargar los releases.', true);
    }
}

function renderKpis() {
    if (relTotalEl)  relTotalEl.textContent  = String(releases.length);
    if (relPublicEl) relPublicEl.textContent = String(releases.filter(r=>r.type==='publica').length);
    if (relBetaEl)   relBetaEl.textContent   = String(releases.filter(r=>r.type==='beta').length);
    if (relAlphaEl)  relAlphaEl.textContent  = String(releases.filter(r=>r.type==='alpha'||r.type==='interna').length);
}

function populateProjectFilter() {
    if (!relProjectFilter) return;
    const projects = [...new Set(releases.map(r=>r.project))].sort();
    const current  = relProjectFilter.value;
    relProjectFilter.innerHTML = '<option value="all">Todos los proyectos</option>' +
        projects.map(p=>`<option value="${escHtml(p)}"${p===current?' selected':''}>${escHtml(p)}</option>`).join('');
}

function getFiltered() {
    const text    = String(relSearch?.value||'').trim().toLowerCase();
    const type    = String(relTypeFilter?.value||'all');
    const project = String(relProjectFilter?.value||'all');
    return releases.filter(r => {
        if (type    !== 'all' && r.type    !== type)    return false;
        if (project !== 'all' && r.project !== project) return false;
        if (!text) return true;
        return [r.project,r.version,r.type,r.platform,r.notes].join(' ').toLowerCase().includes(text);
    });
}

const TYPE_BADGE = {
    publica:  'dev-badge-green',
    beta:     'dev-badge-blue',
    alpha:    'dev-badge-yellow',
    interna:  'dev-badge-yellow',
    hotfix:   'dev-badge-red'
};

function renderList() {
    if (!relList) return;
    const filtered = getFiltered();
    if (!filtered.length) { relList.innerHTML = '<p class="dev-empty">Sin releases para este filtro.</p>'; return; }

    relList.innerHTML = filtered.map(r => {
        const badge  = TYPE_BADGE[r.type] || 'dev-badge-gray';
        const dlLink = r.downloadUrl
            ? `<a href="${escHtml(r.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="dev-btn dev-btn-sm dev-btn-primary" style="text-decoration:none;">Descargar</a>`
            : '';
        const noteLines = r.notes ? r.notes.split('\n').map(l=>`<li>${escHtml(l)}</li>`).join('') : '';
        return `<div class="dev-release-card">
            <div class="dev-release-header">
                <div>
                    <div class="dev-release-version">
                        ${escHtml(r.project)} &nbsp;
                        <span class="dev-release-version-tag">${escHtml(r.version)}</span>
                        <span class="dev-badge ${badge}">${escHtml(r.type)}</span>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.76rem;color:#5c9dc0;margin-top:3px;">
                        ${r.platform ? `<span>Plataforma: ${escHtml(r.platform)}</span>` : ''}
                        ${r.size     ? `<span>Peso: ${escHtml(r.size)}</span>` : ''}
                        ${r.date     ? `<span>Fecha: ${escHtml(r.date)}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:6px;align-items:flex-start;flex-shrink:0;">
                    ${dlLink}
                    <button class="dev-btn dev-btn-sm" data-rel-edit="${escHtml(r.id)}">Editar</button>
                    <button class="dev-btn dev-btn-sm" style="color:#fca5a5;" data-rel-delete="${escHtml(r.id)}">✕</button>
                </div>
            </div>
            ${noteLines ? `<div class="dev-release-notes"><ul style="margin:0;padding-left:18px;color:#5c9dc0;font-size:.78rem;">${noteLines}</ul></div>` : ''}
        </div>`;
    }).join('');
}

// ---- CRUD ----
function resetForm() {
    if (!relForm) return;
    relForm.reset();
    if (relIdInput) relIdInput.value = '';
    if (relFormTitle) relFormTitle.textContent = 'Subir release';
    setMsg('');
}

function fillForm(rel) {
    if (relIdInput)     relIdInput.value     = rel.id;
    if (relProject)     relProject.value     = rel.project;
    if (relVersion)     relVersion.value     = rel.version;
    if (relType)        relType.value        = rel.type;
    if (relPlatform)    relPlatform.value    = rel.platform;
    if (relDownloadUrl) relDownloadUrl.value = rel.downloadUrl;
    if (relSize)        relSize.value        = rel.size;
    if (relDate)        relDate.value        = rel.date;
    if (relNotes)       relNotes.value       = rel.notes;
    if (relFormTitle)   relFormTitle.textContent = 'Editando release';
}

async function saveRelease() {
    const project = String(relProject?.value||'').trim();
    const version = String(relVersion?.value||'').trim();
    if (!project || !version) { setMsg('Proyecto y version son obligatorios.', true); return; }

    const dlUrl = String(relDownloadUrl?.value||'').trim();
    if (dlUrl && !dlUrl.startsWith('https://') && !dlUrl.startsWith('http://')) {
        setMsg('El enlace de descarga debe comenzar con https://', true); return;
    }

    const id   = String(relIdInput?.value||'').trim() || ('rel_' + Date.now());
    const prev = releases.find(r=>r.id===id);
    const now  = new Date().toISOString();
    const payload = {
        id, project, version,
        type:        String(relType?.value||'interna'),
        platform:    String(relPlatform?.value||''),
        downloadUrl: dlUrl,
        size:        String(relSize?.value||''),
        date:        String(relDate?.value||''),
        notes:       String(relNotes?.value||''),
        createdAt:   prev?.createdAt || now,
        createdByUid:prev?.createdByUid || currentUser?.uid || '',
        updatedAt:   now,
        updatedByUid:currentUser?.uid || ''
    };

    try {
        await window.setDoc(window.fsDoc(window.db, RELEASES_COLLECTION, id), payload, { merge: true });
        const idx = releases.findIndex(r=>r.id===id);
        if (idx>=0) releases[idx]=payload; else releases.unshift(payload);
        renderKpis(); populateProjectFilter(); renderList();
        setMsg('Release guardado.');
        resetForm();
    } catch (err) {
        console.error('Error guardando release:', err);
        setMsg('No se pudo guardar el release.', true);
    }
}

async function deleteRelease(id) {
    if (!window.confirm('Eliminar este release?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, RELEASES_COLLECTION, id));
        releases = releases.filter(r=>r.id!==id);
        renderKpis(); populateProjectFilter(); renderList();
    } catch (err) {
        console.error('Error eliminando release:', err);
        setMsg('No se pudo eliminar el release.', true);
    }
}

// ---- Sidebar ----
function initSidebar() {
    if (!sidebarToggle||!sidebar) return;
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target!==sidebarToggle)
            sidebar.classList.remove('open');
    });
}

// ---- Events ----
function bindEvents() {
    if (reloadBtn) reloadBtn.addEventListener('click', loadReleases);
    if (relResetBtn) relResetBtn.addEventListener('click', resetForm);
    if (relForm) relForm.addEventListener('submit', e => { e.preventDefault(); saveRelease(); });

    if (relSearch)        relSearch.addEventListener('input',   renderList);
    if (relTypeFilter)    relTypeFilter.addEventListener('change',   renderList);
    if (relProjectFilter) relProjectFilter.addEventListener('change', renderList);

    if (relList) {
        relList.addEventListener('click', e => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (!target) return;
            const editId = target.getAttribute('data-rel-edit');
            if (editId) { const r = releases.find(r=>r.id===editId); if (r) fillForm(r); return; }
            const delId = target.getAttribute('data-rel-delete');
            if (delId) deleteRelease(delId);
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { if (window.auth&&window.signOut) await window.signOut(window.auth); } catch {}
            window.location.replace(toSitePath('index.html'));
        });
    }
}

// ---- Auth ----
async function handleAuth(user) {
    currentUser = user;
    if (!user) {
        if (window.auth?.currentUser) return handleAuth(window.auth.currentUser);
        redirectHome('No se detecto sesion activa.');
        return;
    }
    if (accessResolved) return;
    accessResolved = true;
    clearTimeout_();

    const canAccess = await resolveAccess(user);
    if (!canAccess) { redirectHome('Tu rol no tiene acceso a esta seccion.'); return; }

    if (userLabelEl) userLabelEl.textContent = user.displayName || user.email || 'Usuario';
    showPanel();
    await loadReleases();
}

function bootAuth() {
    if (!window.auth||!window.onAuthStateChanged) { showGateError('Inicializando autenticacion...'); return false; }
    window.onAuthStateChanged(window.auth, user => {
        handleAuth(user).catch(err => { console.error('Auth error releases:', err); redirectHome('Error de sesion.'); });
    });
    if (window.auth.currentUser) handleAuth(window.auth.currentUser).catch(()=>{});
    return true;
}

function init() {
    initSidebar();
    bindEvents();
    startTimeout();
    if (bootAuth()) return;
    document.addEventListener('firebaseReady', ()=>{ bootAuth(); }, { once: true });
    setTimeout(()=>{
        bootAuth();
        if (!accessResolved && window.auth?.currentUser) handleAuth(window.auth.currentUser).catch(()=>{});
    }, 2200);
}

init();
