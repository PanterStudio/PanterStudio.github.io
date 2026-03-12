/* bugs.js – bug tracker for Panter Studio dev panel */
const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const BUGS_COLLECTION   = 'bugs';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = ['pantergamey@gmail.com', 'panterstudiogamedev@gmail.com'];

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
function toSitePath(p) { return (SITE_ROOT + '/' + String(p||'').replace(/^\/+/,'')).replace(/\\/g,'/'); }

const ROLE_ALIASES = {
    founder:'founder_ceo', ceo:'founder_ceo', fundador_ceo:'founder_ceo', 'fundador / ceo':'founder_ceo',
    admin:'administrador', admin_general:'administrador', developer:'programador', modeler:'modelador', viewer:'usuario'
};
const ALLOWED = new Set(['founder_ceo','administrador','programador','modelador']);

const OPEN_STATUSES = new Set(['nuevo','en_progreso']);

// DOM
const gate        = document.getElementById('bugGate');
const gateMessage = document.getElementById('bugGateMessage');
const panel       = document.getElementById('bugPanel');
const userLabelEl = document.getElementById('bugUserLabel');
const sidebarToggle = document.getElementById('bugSidebarToggle');
const sidebar     = document.getElementById('bugSidebar');
const reloadBtn   = document.getElementById('bugReloadBtn');
const logoutBtn   = document.getElementById('bugLogoutBtn');

const bugTotalEl    = document.getElementById('bugTotal');
const bugCriticalEl = document.getElementById('bugCritical');
const bugInProgEl   = document.getElementById('bugInProgress');
const bugResolvedEl = document.getElementById('bugResolved');

const bugForm        = document.getElementById('bugForm');
const bugIdInput     = document.getElementById('bugId');
const bugTitleInput  = document.getElementById('bugTitle');
const bugProject     = document.getElementById('bugProject');
const bugBuild       = document.getElementById('bugBuild');
const bugPriority    = document.getElementById('bugPriority');
const bugStatus      = document.getElementById('bugStatus');
const bugCategory    = document.getElementById('bugCategory');
const bugPlatform    = document.getElementById('bugPlatform');
const bugDescription = document.getElementById('bugDescription');
const bugSteps       = document.getElementById('bugSteps');
const bugExpected    = document.getElementById('bugExpected');
const bugAssignee    = document.getElementById('bugAssignee');
const bugResetBtn    = document.getElementById('bugResetBtn');
const bugFormTitle   = document.getElementById('bugFormTitle');
const bugMessage     = document.getElementById('bugMessage');

const bugSearch         = document.getElementById('bugSearch');
const bugPriorityFilter = document.getElementById('bugPriorityFilter');
const bugStatusFilter   = document.getElementById('bugStatusFilter');
const bugProjectFilter  = document.getElementById('bugProjectFilter');
const bugList           = document.getElementById('bugList');

let bugs = [];
let bugCounter = 1;
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;

// ---- Helpers ----
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function normalizeRole(r) { const s=String(r||'').trim().toLowerCase(); return ROLE_ALIASES[s]||s||'usuario'; }
function getAdminEmails() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY)||'[]');
        const arr = Array.isArray(stored) ? stored : String(stored).split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS,...arr].map(e=>String(e).trim().toLowerCase()).filter(Boolean))];
    } catch { return [...DEFAULT_ADMIN_EMAILS]; }
}

function setMsg(text, isError=false) {
    if (!bugMessage) return;
    bugMessage.textContent = text||'';
    bugMessage.className   = isError ? 'dev-msg error' : 'dev-msg';
}
function showGateError(text) {
    if (gateMessage) { gateMessage.textContent=text; gateMessage.className='dev-msg error'; }
    if (gate)  gate.hidden  = false;
    if (panel) panel.hidden = true;
}
function showPanel() { if (gate) gate.hidden=true; if (panel) panel.hidden=false; }
function clearTO() { if (accessTimeoutId) { clearTimeout(accessTimeoutId); accessTimeoutId=null; } }
function startTO() {
    clearTO();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;
        if (window.auth?.currentUser) { handleAuth(window.auth.currentUser).catch(()=>redirectHome('Tiempo agotado.')); return; }
        redirectHome('No se detecto sesion tras 3 segundos.');
    }, 3000);
}
function redirectHome(msg) { showGateError(msg); setTimeout(()=>window.location.replace(toSitePath('index.html')), 1400); }

// ---- Access ----
async function resolveAccess(user) {
    const email = String(user?.email||'').trim().toLowerCase();
    if (!email) return false;
    if (email===FOUNDER_CEO_EMAIL || getAdminEmails().includes(email)) return true;
    try {
        const snap = await window.getDoc(window.fsDoc(window.db,'users',user.uid));
        const profile = snap.exists() ? snap.data()||{} : {};
        const role = normalizeRole(profile.role||'usuario');
        if (profile.isAdmin===true || role==='founder_ceo') return true;
        return ALLOWED.has(role);
    } catch { return false; }
}

// ---- Data ----
function parseBug(d) {
    const data = d.data()||{};
    return {
        id:          String(data.id||d.id),
        bugNum:      Number(data.bugNum||0),
        project:     String(data.project||'Sin proyecto'),
        title:       String(data.title||'Sin titulo'),
        build:       String(data.build||''),
        priority:    String(data.priority||'media'),
        status:      String(data.status||'nuevo'),
        category:    String(data.category||'otro'),
        platform:    String(data.platform||''),
        description: String(data.description||''),
        steps:       String(data.steps||''),
        expected:    String(data.expected||''),
        assignee:    String(data.assignee||''),
        createdAt:   String(data.createdAt||''),
        updatedAt:   String(data.updatedAt||''),
        createdByUid:String(data.createdByUid||'')
    };
}

async function loadBugs() {
    try {
        const snap = await window.getDocs(window.collection(window.db, BUGS_COLLECTION));
        bugs = snap.docs.map(parseBug)
            .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const maxNum = bugs.reduce((max,b) => Math.max(max, b.bugNum||0), 0);
        bugCounter = maxNum + 1;
        renderKpis();
        populateProjectFilter();
        renderBugList();
        setMsg('');
    } catch (err) {
        console.error('Error cargando bugs:', err);
        setMsg('No se pudieron cargar los bugs.', true);
    }
}

function renderKpis() {
    if (bugTotalEl)    bugTotalEl.textContent    = String(bugs.length);
    if (bugCriticalEl) bugCriticalEl.textContent = String(bugs.filter(b=>b.priority==='critica').length);
    if (bugInProgEl)   bugInProgEl.textContent   = String(bugs.filter(b=>OPEN_STATUSES.has(b.status)).length);
    if (bugResolvedEl) bugResolvedEl.textContent = String(bugs.filter(b=>b.status==='resuelto'||b.status==='verificado').length);
}

function populateProjectFilter() {
    if (!bugProjectFilter) return;
    const projects = [...new Set(bugs.map(b=>b.project))].sort();
    const current  = bugProjectFilter.value;
    bugProjectFilter.innerHTML = '<option value="all">Todos los proyectos</option>' +
        projects.map(p=>`<option value="${escHtml(p)}"${p===current?' selected':''}>${escHtml(p)}</option>`).join('');
}

function getFiltered() {
    const text    = String(bugSearch?.value||'').trim().toLowerCase();
    const prio    = String(bugPriorityFilter?.value||'all');
    const status  = String(bugStatusFilter?.value||'all');
    const project = String(bugProjectFilter?.value||'all');
    return bugs.filter(b => {
        if (prio    !== 'all' && b.priority !== prio)    return false;
        if (project !== 'all' && b.project  !== project) return false;
        if (status === 'open')  return OPEN_STATUSES.has(b.status);
        if (status !== 'all')   return b.status === status;
        if (!text) return true;
        return [b.title,b.project,b.description,b.assignee,b.category].join(' ').toLowerCase().includes(text);
    });
}

const PRIORITY_BADGE = { critica:'dev-badge-red', alta:'dev-badge-red', media:'dev-badge-yellow', baja:'dev-badge-green' };
const STATUS_BADGE = {
    nuevo:'dev-badge-blue', en_progreso:'dev-badge-yellow', resuelto:'dev-badge-green',
    verificado:'dev-badge-green', no_reproducible:'dev-badge-gray', rechazado:'dev-badge-gray'
};

function renderBugList() {
    if (!bugList) return;
    const filtered = getFiltered();
    if (!filtered.length) { bugList.innerHTML = '<p class="dev-empty">Sin bugs para este filtro.</p>'; return; }

    bugList.innerHTML = filtered.map(b => {
        const pb = PRIORITY_BADGE[b.priority] || 'dev-badge-gray';
        const sb = STATUS_BADGE[b.status]     || 'dev-badge-gray';
        const num = b.bugNum ? `#${b.bugNum}` : '';
        return `<div class="dev-bug-row">
            <div class="dev-bug-id">${escHtml(num)}</div>
            <div class="dev-bug-body">
                <div class="dev-bug-title">
                    ${escHtml(b.title)}
                    <span class="dev-badge ${pb}">${escHtml(b.priority)}</span>
                    <span class="dev-badge ${sb}">${escHtml(b.status)}</span>
                    ${b.category ? `<span class="dev-badge dev-badge-gray">${escHtml(b.category)}</span>` : ''}
                </div>
                <div style="font-size:.76rem;color:#5c9dc0;display:flex;gap:10px;flex-wrap:wrap;margin-top:3px;">
                    <span>${escHtml(b.project)}${b.build ? ' · '+escHtml(b.build) : ''}</span>
                    ${b.platform ? `<span>Plataforma: ${escHtml(b.platform)}</span>` : ''}
                    ${b.assignee ? `<span>Asignado: ${escHtml(b.assignee)}</span>` : ''}
                </div>
                ${b.description ? `<p style="font-size:.78rem;color:#4a8cb0;margin:.4rem 0 0;">${escHtml(b.description)}</p>` : ''}
                ${b.steps ? `<details style="margin-top:6px;"><summary style="font-size:.75rem;color:#3a7098;cursor:pointer;">Pasos para reproducir</summary><p style="font-size:.75rem;color:#4a8cb0;white-space:pre-wrap;margin:.4rem 0 0;">${escHtml(b.steps)}</p></details>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-self:flex-start;">
                <select data-bug-status="${escHtml(b.id)}" style="font-size:.72rem;padding:3px 5px;background:rgba(9,13,22,.9);border:1px solid rgba(30,112,200,.3);border-radius:6px;color:#c9e6ff;width:120px;">
                    ${['nuevo','en_progreso','resuelto','verificado','no_reproducible','rechazado']
                        .map(s=>`<option value="${s}"${b.status===s?' selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
                </select>
                <button class="dev-btn dev-btn-sm" data-bug-edit="${escHtml(b.id)}">Editar</button>
                <button class="dev-btn dev-btn-sm" style="color:#fca5a5;" data-bug-delete="${escHtml(b.id)}">✕</button>
            </div>
        </div>`;
    }).join('');
}

// ---- CRUD ----
function resetForm() {
    if (!bugForm) return;
    bugForm.reset();
    if (bugIdInput)   bugIdInput.value   = '';
    if (bugFormTitle) bugFormTitle.textContent = 'Reportar bug';
    setMsg('');
}

function fillForm(bug) {
    if (bugIdInput)     bugIdInput.value     = bug.id;
    if (bugTitleInput)  bugTitleInput.value  = bug.title;
    if (bugProject)     bugProject.value     = bug.project;
    if (bugBuild)       bugBuild.value       = bug.build;
    if (bugPriority)    bugPriority.value    = bug.priority;
    if (bugStatus)      bugStatus.value      = bug.status;
    if (bugCategory)    bugCategory.value    = bug.category;
    if (bugPlatform)    bugPlatform.value    = bug.platform;
    if (bugDescription) bugDescription.value = bug.description;
    if (bugSteps)       bugSteps.value       = bug.steps;
    if (bugExpected)    bugExpected.value    = bug.expected;
    if (bugAssignee)    bugAssignee.value    = bug.assignee;
    if (bugFormTitle)   bugFormTitle.textContent = 'Editando bug';
}

async function saveBug() {
    const title   = String(bugTitleInput?.value||'').trim();
    const project = String(bugProject?.value||'').trim();
    if (!title || !project) { setMsg('Titulo y proyecto son obligatorios.', true); return; }

    const id   = String(bugIdInput?.value||'').trim() || ('bug_' + Date.now());
    const prev = bugs.find(b=>b.id===id);
    const now  = new Date().toISOString();
    const payload = {
        id,
        bugNum:      prev?.bugNum || bugCounter++,
        project, title,
        build:       String(bugBuild?.value||''),
        priority:    String(bugPriority?.value||'media'),
        status:      String(bugStatus?.value||'nuevo'),
        category:    String(bugCategory?.value||'otro'),
        platform:    String(bugPlatform?.value||''),
        description: String(bugDescription?.value||''),
        steps:       String(bugSteps?.value||''),
        expected:    String(bugExpected?.value||''),
        assignee:    String(bugAssignee?.value||''),
        createdAt:   prev?.createdAt || now,
        createdByUid:prev?.createdByUid || currentUser?.uid || '',
        updatedAt:   now,
        updatedByUid:currentUser?.uid || ''
    };
    try {
        await window.setDoc(window.fsDoc(window.db, BUGS_COLLECTION, id), payload, { merge: true });
        const idx = bugs.findIndex(b=>b.id===id);
        if (idx>=0) bugs[idx]=payload; else bugs.unshift(payload);
        renderKpis(); populateProjectFilter(); renderBugList();
        setMsg('Bug guardado.');
        resetForm();
    } catch (err) {
        console.error('Error guardando bug:', err);
        setMsg('No se pudo guardar el bug.', true);
    }
}

async function updateBugStatus(bugId, nextStatus) {
    const bug = bugs.find(b=>b.id===bugId);
    if (!bug) return;
    const updated = Object.assign({}, bug, { status: nextStatus, updatedAt: new Date().toISOString(), updatedByUid: currentUser?.uid||'' });
    try {
        await window.setDoc(window.fsDoc(window.db, BUGS_COLLECTION, bugId), updated, { merge: true });
        const idx = bugs.findIndex(b=>b.id===bugId);
        if (idx>=0) bugs[idx]=updated;
        renderKpis(); renderBugList();
    } catch (err) {
        console.error('Error actualizando estado de bug:', err);
        setMsg('No se pudo actualizar el estado.', true);
    }
}

async function deleteBug(id) {
    if (!window.confirm('Eliminar este bug?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, BUGS_COLLECTION, id));
        bugs = bugs.filter(b=>b.id!==id);
        renderKpis(); populateProjectFilter(); renderBugList();
    } catch (err) {
        console.error('Error eliminando bug:', err);
        setMsg('No se pudo eliminar el bug.', true);
    }
}

// ---- Sidebar ----
function initSidebar() {
    if (!sidebarToggle||!sidebar) return;
    sidebarToggle.addEventListener('click', ()=>sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target!==sidebarToggle)
            sidebar.classList.remove('open');
    });
}

// ---- Events ----
function bindEvents() {
    if (reloadBtn)  reloadBtn.addEventListener('click',  loadBugs);
    if (bugResetBtn)bugResetBtn.addEventListener('click', resetForm);
    if (bugForm)    bugForm.addEventListener('submit', e => { e.preventDefault(); saveBug(); });

    if (bugSearch)         bugSearch.addEventListener('input',   renderBugList);
    if (bugPriorityFilter) bugPriorityFilter.addEventListener('change', renderBugList);
    if (bugStatusFilter)   bugStatusFilter.addEventListener('change',   renderBugList);
    if (bugProjectFilter)  bugProjectFilter.addEventListener('change',  renderBugList);

    if (bugList) {
        bugList.addEventListener('click', e => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (!target) return;
            const editId = target.getAttribute('data-bug-edit');
            if (editId) { const b = bugs.find(b=>b.id===editId); if (b) fillForm(b); return; }
            const delId = target.getAttribute('data-bug-delete');
            if (delId) deleteBug(delId);
        });
        bugList.addEventListener('change', e => {
            const sel = e.target instanceof HTMLSelectElement ? e.target : null;
            if (!sel) return;
            const bid = sel.getAttribute('data-bug-status');
            if (bid) updateBugStatus(bid, sel.value);
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
    clearTO();

    const canAccess = await resolveAccess(user);
    if (!canAccess) { redirectHome('Tu rol no tiene acceso a esta seccion.'); return; }

    if (userLabelEl) userLabelEl.textContent = user.displayName || user.email || 'Usuario';
    showPanel();
    await loadBugs();
}

function bootAuth() {
    if (!window.auth||!window.onAuthStateChanged) { showGateError('Inicializando autenticacion...'); return false; }
    window.onAuthStateChanged(window.auth, user => {
        handleAuth(user).catch(err=>{ console.error('Auth error bugs:', err); redirectHome('Error de sesion.'); });
    });
    if (window.auth.currentUser) handleAuth(window.auth.currentUser).catch(()=>{});
    return true;
}

function init() {
    initSidebar();
    bindEvents();
    startTO();
    if (bootAuth()) return;
    document.addEventListener('firebaseReady', ()=>{ bootAuth(); }, { once: true });
    setTimeout(()=>{
        bootAuth();
        if (!accessResolved && window.auth?.currentUser) handleAuth(window.auth.currentUser).catch(()=>{});
    }, 2200);
}

init();
