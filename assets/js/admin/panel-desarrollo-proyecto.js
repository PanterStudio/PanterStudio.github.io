/* panel-desarrollo-proyecto.js – per-project workspace */
const FOUNDER_CEO_EMAIL        = 'pantergamey@gmail.com';
const PROJECT_TASKS_COLLECTION = 'development_project_tasks';
const MILESTONES_COLLECTION    = 'project_milestones';
const TEAM_COLLECTION          = 'project_team';
const NOTES_COLLECTION         = 'project_notes';
const PROJ_META_COLLECTION     = 'project_meta';
const ADMIN_EMAILS_LS_KEY      = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS     = ['pantergamey@gmail.com', 'panterstudiogamedev@gmail.com'];

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

const ROLE_ALIASES = {
    founder: 'founder_ceo', ceo: 'founder_ceo', fundador_ceo: 'founder_ceo', 'fundador / ceo': 'founder_ceo',
    admin: 'administrador', admin_general: 'administrador',
    developer: 'programador', modeler: 'modelador', viewer: 'usuario'
};
const ALLOWED_ROLES = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);

const STATUS_STAGES = { pendiente: 'Pendiente', en_curso: 'En curso', bloqueada: 'Bloqueada', lista_qa: 'Lista QA', terminada: 'Terminada' };
const DISCIPLINE_LABELS = {
    programacion: 'Programacion', modelado: 'Modelado', diseno_juego: 'Disenio de juego',
    ui_ux: 'UI/UX', qa_bugs: 'QA/Bugs', audio: 'Audio', narrativa: 'Narrativa'
};
const PRIORITY_BADGE = { alta: 'dev-badge-red', media: 'dev-badge-yellow', baja: 'dev-badge-green' };

// URL params
const urlParams    = new URLSearchParams(window.location.search);
const projectId    = String(urlParams.get('projectId')    || '').trim() || 'unknown';
const projectTitle = String(urlParams.get('projectTitle') || 'Proyecto sin nombre').trim();
const projectType  = String(urlParams.get('projectType')  || 'juego').trim();
const projectStatus= String(urlParams.get('projectStatus')|| 'development').trim();

// DOM refs
const gate        = document.getElementById('gameProjGate');
const gateMessage = document.getElementById('gameProjGateMessage');
const panel       = document.getElementById('gameProjPanel');

const sidebarToggle  = document.getElementById('projSidebarToggle');
const sidebar        = document.getElementById('projSidebar');
const sidebarName    = document.getElementById('sidebarProjName');
const sidebarType    = document.getElementById('sidebarProjType');

const titleEl     = document.getElementById('gameProjTitle');
const statusEl    = document.getElementById('gameProjStatus');
const typeBadgeEl = document.getElementById('gameProjTypeBadge');
const backBtn     = document.getElementById('gameProjBackBtn');
const reloadBtn   = document.getElementById('gameProjReloadBtn');
const logoutBtn   = document.getElementById('gameProjLogoutBtn');

const totalTasksEl = document.getElementById('gameProjTotalTasks');
const doneTasksEl  = document.getElementById('projDoneTasks');
const inProgEl     = document.getElementById('projInProgress');
const blockedEl    = document.getElementById('projBlocked');
const percentEl    = document.getElementById('projPercent');

const taskForm          = document.getElementById('gameProjTaskForm');
const taskIdInput       = document.getElementById('gameProjTaskId');
const taskTitleInput    = document.getElementById('gameProjTaskTitle');
const taskDisciplineIn  = document.getElementById('gameProjTaskDiscipline');
const taskStageIn       = document.getElementById('gameProjTaskStage');
const taskPriorityIn    = document.getElementById('gameProjTaskPriority');
const taskStatusIn      = document.getElementById('gameProjTaskStatus');
const taskDueDateIn     = document.getElementById('gameProjTaskDueDate');
const taskBuildIn       = document.getElementById('gameProjTaskBuild');
const taskDescIn        = document.getElementById('gameProjTaskDescription');
const taskResetBtn      = document.getElementById('gameProjTaskResetBtn');
const taskFormTitle     = document.getElementById('taskFormTitle');
const taskSearchIn      = document.getElementById('gameProjSearch');
const taskDisciplineF   = document.getElementById('gameProjDisciplineFilter');
const taskPriorityF     = document.getElementById('gameProjPriorityFilter');
const boardEl           = document.getElementById('gameProjBoard');
const taskMsg           = document.getElementById('gameProjMessage');

const projDescText      = document.getElementById('projDescText');
const projDescForm      = document.getElementById('projDescForm');
const projDescInput     = document.getElementById('projDescInput');
const projDescEditBtn   = document.getElementById('projDescEditBtn');
const projDescCancelBtn = document.getElementById('projDescCancelBtn');
const projDisciplineStats = document.getElementById('projDisciplineStats');
const projRecentTasks   = document.getElementById('projRecentTasks');
const infoType          = document.getElementById('infoType');
const infoStatus        = document.getElementById('infoStatus');
const infoBuild         = document.getElementById('infoBuild');
const infoStart         = document.getElementById('infoStart');
const infoTarget        = document.getElementById('infoTarget');

const milestoneForm  = document.getElementById('milestoneForm');
const msId           = document.getElementById('msId');
const msTitle        = document.getElementById('msTitle');
const msDesc         = document.getElementById('msDesc');
const msDate         = document.getElementById('msDate');
const msStatus       = document.getElementById('msStatus');
const msResetBtn     = document.getElementById('msResetBtn');
const msMsg          = document.getElementById('msMessage');
const milestoneTimeline = document.getElementById('milestoneTimeline');

const teamForm       = document.getElementById('teamForm');
const teamMemberId   = document.getElementById('teamMemberId');
const teamMemberName = document.getElementById('teamMemberName');
const teamMemberRole = document.getElementById('teamMemberRole');
const teamMemberAvatar = document.getElementById('teamMemberAvatar');
const teamMsg        = document.getElementById('teamMessage');
const teamList       = document.getElementById('teamList');

const addNoteBtn     = document.getElementById('addNoteBtn');
const noteForm       = document.getElementById('noteForm');
const noteId         = document.getElementById('noteId');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContent    = document.getElementById('noteContent');
const noteTag        = document.getElementById('noteTag');
const noteMsg        = document.getElementById('noteMessage');
const notesList      = document.getElementById('notesList');

// State
let tasks      = [];
let milestones = [];
let team       = [];
let notes      = [];
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;

// ======================================================
// Helpers
// ======================================================
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function normalizeRole(role) {
    const r = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[r] || r || 'usuario';
}

function getAdminEmails() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '[]');
        const arr = Array.isArray(stored) ? stored : String(stored).split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS, ...arr].map(e => String(e).trim().toLowerCase()).filter(Boolean))];
    } catch { return [...DEFAULT_ADMIN_EMAILS]; }
}

function setMsg(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || '';
    el.className = isError ? 'dev-msg error' : 'dev-msg';
}

function showGateError(text) {
    if (gateMessage) { gateMessage.textContent = text; gateMessage.className = 'dev-msg error'; }
    if (gate)  gate.hidden  = false;
    if (panel) panel.hidden = true;
}

function showPanel() {
    if (gate)  gate.hidden  = true;
    if (panel) panel.hidden = false;
}

function clearAccessTimeout() {
    if (accessTimeoutId) { clearTimeout(accessTimeoutId); accessTimeoutId = null; }
}

function startAccessTimeout() {
    clearAccessTimeout();
    accessTimeoutId = setTimeout(() => {
        if (accessResolved) return;
        if (window.auth?.currentUser) {
            handleAuthResolved(window.auth.currentUser).catch(() => redirectToList('Tiempo de validacion agotado.'));
            return;
        }
        redirectToList('No se detecto sesion tras 3 segundos.');
    }, 3000);
}

function redirectToList(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('pages/admin/panel-desarrollo.html')), 1300);
}

// ======================================================
// Tabs
// ======================================================
const TAB_PANEL_ID = {
    overview:   'tabOverview',
    tasks:      'tabTasks',
    milestones: 'tabMilestones',
    team:       'tabTeam',
    notes:      'tabNotes'
};

function switchTab(tabName) {
    if (!TAB_PANEL_ID[tabName]) return;
    document.querySelectorAll('[data-proj-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.projTab === tabName);
    });
    document.querySelectorAll('.dev-proj-tab-panel').forEach(p => {
        p.hidden = (p.id !== TAB_PANEL_ID[tabName]);
    });
}

function initTabs() {
    document.querySelectorAll('[data-proj-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.projTab));
    });
    document.querySelectorAll('[data-proj-tab-go]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.projTabGo));
    });
}

function initSidebar() {
    if (!sidebarToggle || !sidebar) return;
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== sidebarToggle)
            sidebar.classList.remove('open');
    });
}

// ======================================================
// Auth helpers
// ======================================================
async function resolveAccess(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return { canAccess: false };
    if (email === FOUNDER_CEO_EMAIL) return { canAccess: true };
    if (getAdminEmails().includes(email)) return { canAccess: true };
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() || {} : {};
        const role = normalizeRole(profile.role || 'usuario');
        if (profile.isAdmin === true || role === 'founder_ceo') return { canAccess: true };
        return { canAccess: ALLOWED_ROLES.has(role) };
    } catch { return { canAccess: false }; }
}

// ======================================================
// Header / KPIs
// ======================================================
function applyProjectHeader() {
    if (titleEl)     titleEl.textContent     = projectTitle;
    if (statusEl)    statusEl.textContent    = 'Estado: ' + projectStatus;
    if (typeBadgeEl) typeBadgeEl.textContent = projectType === 'aplicacion' ? 'Aplicacion' : 'Videojuego';
    if (sidebarName) sidebarName.textContent = projectTitle;
    if (sidebarType) sidebarType.textContent = projectType === 'aplicacion' ? 'Aplicacion' : 'Videojuego';
    document.title = projectTitle + ' - Panel Proyecto';
}

function renderKpis() {
    const total   = tasks.length;
    const done    = tasks.filter(t => t.status === 'terminada').length;
    const inProg  = tasks.filter(t => t.status === 'en_curso').length;
    const blocked = tasks.filter(t => t.status === 'bloqueada').length;
    const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (doneTasksEl)  doneTasksEl.textContent  = String(done);
    if (inProgEl)     inProgEl.textContent     = String(inProg);
    if (blockedEl)    blockedEl.textContent    = String(blocked);
    if (percentEl)    percentEl.textContent    = pct + '%';
}

// ======================================================
// Overview
// ======================================================
function renderOverview() {
    renderDisciplineStats();
    renderRecentTasks();
}

function renderDisciplineStats() {
    if (!projDisciplineStats) return;
    projDisciplineStats.innerHTML = Object.entries(DISCIPLINE_LABELS).map(([d, label]) => {
        const total = tasks.filter(t => t.discipline === d).length;
        if (total === 0) return '';
        const done = tasks.filter(t => t.discipline === d && t.status === 'terminada').length;
        const pct  = Math.round((done / total) * 100);
        return '<div class="dev-discipline-bar">' +
            '<div class="dev-discipline-bar-label"><span>' + escHtml(label) + '</span><span>' + done + '/' + total + '</span></div>' +
            '<div class="dev-discipline-bar-track"><div class="dev-discipline-bar-fill" style="width:' + pct + '%"></div></div>' +
            '</div>';
    }).join('');
}

function renderRecentTasks() {
    if (!projRecentTasks) return;
    const recent = [...tasks].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 8);
    if (!recent.length) { projRecentTasks.innerHTML = '<p class="dev-empty">Sin tareas aun.</p>'; return; }
    projRecentTasks.innerHTML = recent.map(t => {
        const pb = PRIORITY_BADGE[t.priority] || 'dev-badge-gray';
        const sb = t.status === 'terminada' ? 'dev-badge-green' : t.status === 'bloqueada' ? 'dev-badge-red' : 'dev-badge-gray';
        return '<div class="dev-recent-task">' +
            '<span class="dev-recent-task-title">' + escHtml(t.title) + '</span>' +
            '<span class="dev-badge ' + pb + '">' + escHtml(t.priority) + '</span>' +
            '<span class="dev-badge ' + sb + '">' + escHtml(t.status) + '</span>' +
            '<span class="dev-recent-task-meta">' + escHtml(t.dueDate || '-') + '</span>' +
            '</div>';
    }).join('');
}

// ======================================================
// Tasks / Kanban
// ======================================================
function getTaskDocId(id) { return projectId + '__' + id; }

function parseTask(docSnap) {
    const d = docSnap.data() || {};
    return {
        id:          String(d.id || docSnap.id),
        projectId:   String(d.projectId || projectId),
        title:       String(d.title || 'Sin titulo'),
        discipline:  String(d.discipline || 'programacion'),
        stage:       String(d.stage || 'produccion'),
        priority:    String(d.priority || 'media'),
        status:      String(d.status || 'pendiente'),
        dueDate:     String(d.dueDate || ''),
        build:       String(d.build || ''),
        description: String(d.description || ''),
        createdAt:   String(d.createdAt || ''),
        updatedAt:   String(d.updatedAt || ''),
        createdByUid:String(d.createdByUid || ''),
        updatedByUid:String(d.updatedByUid || '')
    };
}

async function loadTasks() {
    try {
        const snap = await window.getDocs(window.collection(window.db, PROJECT_TASKS_COLLECTION));
        tasks = snap.docs.map(parseTask).filter(t => t.projectId === projectId)
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        renderBoard();
        renderKpis();
        renderOverview();
    } catch (err) {
        console.error('Error cargando tareas:', err);
        setMsg(taskMsg, 'No se pudieron cargar las tareas.', true);
    }
}

function getFilteredTasks() {
    const text = String(taskSearchIn?.value || '').trim().toLowerCase();
    const disc = String(taskDisciplineF?.value || 'all');
    const prio = String(taskPriorityF?.value  || 'all');
    return tasks.filter(t => {
        if (disc !== 'all' && t.discipline !== disc) return false;
        if (prio !== 'all' && t.priority   !== prio) return false;
        if (!text) return true;
        return [t.title, t.description, t.build, t.stage, t.status, t.discipline].join(' ').toLowerCase().includes(text);
    });
}

function renderBoard() {
    if (!boardEl) return;
    const filtered = getFilteredTasks();
    const grouped = {};
    Object.keys(STATUS_STAGES).forEach(s => { grouped[s] = []; });
    filtered.forEach(t => { (grouped[t.status] || (grouped[t.status] = [])).push(t); });

    boardEl.innerHTML = Object.entries(STATUS_STAGES).map(function([status, label]) {
        const col = grouped[status] || [];
        const cards = col.map(t => {
            const pb = PRIORITY_BADGE[t.priority] || 'dev-badge-gray';
            const opts = Object.entries(STATUS_STAGES).map(function([v, l]) {
                return '<option value="' + v + '"' + (t.status === v ? ' selected' : '') + '>' + l + '</option>';
            }).join('');
            return '<article class="dev-task-card">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">' +
                '<h4 style="margin:0;font-size:.82rem;color:#c9e6ff;">' + escHtml(t.title) + '</h4>' +
                '<span class="dev-badge ' + pb + '" style="flex-shrink:0;">' + escHtml(t.priority) + '</span>' +
                '</div>' +
                '<p style="color:#5c9dc0;font-size:.74rem;margin:.2rem 0 .5rem;">' + escHtml(t.description || 'Sin detalle.') + '</p>' +
                '<div style="display:flex;flex-wrap:wrap;gap:4px;font-size:.72rem;color:#3a5e7a;margin-bottom:.5rem;">' +
                '<span>' + escHtml(DISCIPLINE_LABELS[t.discipline] || t.discipline) + '</span>' +
                (t.build   ? '<span>. ' + escHtml(t.build)   + '</span>' : '') +
                (t.dueDate ? '<span>. ' + escHtml(t.dueDate) + '</span>' : '') +
                '</div>' +
                '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
                '<select data-task-status="' + escHtml(t.id) + '" style="flex:1;min-width:90px;font-size:.72rem;padding:3px 5px;background:rgba(9,13,22,.9);border:1px solid rgba(30,112,200,.3);border-radius:6px;color:#c9e6ff;">' + opts + '</select>' +
                '<button class="dev-btn dev-btn-sm" data-task-edit="' + escHtml(t.id) + '">Editar</button>' +
                '<button class="dev-btn dev-btn-sm" style="color:#fca5a5;" data-task-delete="' + escHtml(t.id) + '">X</button>' +
                '</div></article>';
        }).join('');

        return '<section class="dev-kanban-col">' +
            '<div class="dev-kanban-col-header">' +
            '<span>' + label + '</span>' +
            '<span style="background:rgba(30,112,200,.2);border-radius:10px;padding:1px 8px;font-size:.7rem;">' + col.length + '</span>' +
            '</div>' +
            '<div class="dev-kanban-body">' + (cards || '<p class="dev-empty" style="padding:12px;font-size:.78rem;">Sin tareas</p>') + '</div>' +
            '</section>';
    }).join('');
}

function resetTaskForm() {
    if (!taskForm) return;
    taskForm.reset();
    if (taskIdInput)   taskIdInput.value   = '';
    if (taskPriorityIn)taskPriorityIn.value= 'media';
    if (taskStatusIn)  taskStatusIn.value  = 'pendiente';
    if (taskFormTitle) taskFormTitle.textContent = 'Nueva tarea';
    setMsg(taskMsg, '');
}

function fillTaskForm(task) {
    if (taskIdInput)    taskIdInput.value      = task.id;
    if (taskTitleInput) taskTitleInput.value   = task.title;
    if (taskDisciplineIn)taskDisciplineIn.value= task.discipline;
    if (taskStageIn)    taskStageIn.value      = task.stage;
    if (taskPriorityIn) taskPriorityIn.value   = task.priority;
    if (taskStatusIn)   taskStatusIn.value     = task.status;
    if (taskDueDateIn)  taskDueDateIn.value    = task.dueDate;
    if (taskBuildIn)    taskBuildIn.value      = task.build;
    if (taskDescIn)     taskDescIn.value       = task.description;
    if (taskFormTitle)  taskFormTitle.textContent = 'Editando tarea';
    switchTab('tasks');
}

async function saveTask() {
    const title = String(taskTitleInput?.value || '').trim();
    if (!title) { setMsg(taskMsg, 'Escribe un titulo de tarea.', true); return; }
    const id   = String(taskIdInput?.value || '').trim() || ('t_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    const prev = tasks.find(t => t.id === id);
    const now  = new Date().toISOString();
    const payload = {
        id, projectId, projectTitle, projectType,
        title,
        discipline: String(taskDisciplineIn?.value || 'programacion'),
        stage:      String(taskStageIn?.value      || 'produccion'),
        priority:   String(taskPriorityIn?.value   || 'media'),
        status:     String(taskStatusIn?.value     || 'pendiente'),
        dueDate:    String(taskDueDateIn?.value    || ''),
        build:      String(taskBuildIn?.value      || ''),
        description:String(taskDescIn?.value       || ''),
        createdAt:  prev?.createdAt || now,
        createdByUid: prev?.createdByUid || currentUser?.uid || '',
        updatedAt:  now,
        updatedByUid: currentUser?.uid || ''
    };
    try {
        await window.setDoc(window.fsDoc(window.db, PROJECT_TASKS_COLLECTION, getTaskDocId(id)), payload, { merge: true });
        const idx = tasks.findIndex(t => t.id === id);
        if (idx >= 0) tasks[idx] = payload; else tasks.push(payload);
        tasks.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        renderBoard(); renderKpis(); renderOverview();
        setMsg(taskMsg, 'Tarea guardada.');
        resetTaskForm();
    } catch (err) {
        console.error('Error guardando tarea:', err);
        setMsg(taskMsg, 'No se pudo guardar la tarea.', true);
    }
}

async function updateTaskStatus(taskId, nextStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = Object.assign({}, task, { status: nextStatus, updatedAt: new Date().toISOString(), updatedByUid: currentUser?.uid || '' });
    try {
        await window.setDoc(window.fsDoc(window.db, PROJECT_TASKS_COLLECTION, getTaskDocId(taskId)), updated, { merge: true });
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx >= 0) tasks[idx] = updated;
        renderBoard(); renderKpis(); renderOverview();
    } catch (err) {
        console.error('Error actualizando estado:', err);
        setMsg(taskMsg, 'No se pudo actualizar el estado.', true);
    }
}

async function deleteTask(taskId) {
    if (!window.confirm('Eliminar esta tarea?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, PROJECT_TASKS_COLLECTION, getTaskDocId(taskId)));
        tasks = tasks.filter(t => t.id !== taskId);
        renderBoard(); renderKpis(); renderOverview();
        setMsg(taskMsg, 'Tarea eliminada.');
    } catch (err) {
        console.error('Error eliminando tarea:', err);
        setMsg(taskMsg, 'No se pudo eliminar la tarea.', true);
    }
}

// ======================================================
// Milestones
// ======================================================
function getMsDocId(id) { return projectId + '__ms__' + id; }

function parseMilestone(d) {
    const data = d.data() || {};
    return {
        id:        String(data.id || d.id),
        title:     String(data.title || 'Sin nombre'),
        desc:      String(data.desc || ''),
        date:      String(data.date || ''),
        status:    String(data.status || 'pendiente'),
        createdAt: String(data.createdAt || ''),
        projectId: String(data.projectId || projectId)
    };
}

async function loadMilestones() {
    try {
        const snap = await window.getDocs(window.collection(window.db, MILESTONES_COLLECTION));
        milestones = snap.docs.map(parseMilestone).filter(m => m.projectId === projectId)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        renderMilestones();
    } catch (err) { console.warn('Milestones load failed:', err); }
}

function renderMilestones() {
    if (!milestoneTimeline) return;
    if (!milestones.length) { milestoneTimeline.innerHTML = '<p class="dev-empty">Sin hitos registrados.</p>'; return; }
    milestoneTimeline.innerHTML = milestones.map(m => {
        const dotClass = m.status === 'completado' ? 'done' : m.status === 'en_curso' ? 'active' : '';
        const badge = m.status === 'completado' ? 'dev-badge-green' : m.status === 'en_curso' ? 'dev-badge-blue' : 'dev-badge-gray';
        return '<div class="dev-timeline-item">' +
            '<div class="dev-timeline-dot ' + dotClass + '"></div>' +
            '<div class="dev-timeline-body">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<strong style="color:#c9e6ff;">' + escHtml(m.title) + '</strong>' +
            '<span class="dev-badge ' + badge + '">' + escHtml(m.status) + '</span>' +
            (m.date ? '<span class="dev-muted">' + escHtml(m.date) + '</span>' : '') +
            '</div>' +
            (m.desc ? '<p style="color:#5c9dc0;font-size:.78rem;margin:.3rem 0 0;">' + escHtml(m.desc) + '</p>' : '') +
            '<div style="margin-top:6px;display:flex;gap:5px;">' +
            '<button class="dev-btn dev-btn-sm" data-ms-edit="' + escHtml(m.id) + '">Editar</button>' +
            '<button class="dev-btn dev-btn-sm" style="color:#fca5a5;" data-ms-delete="' + escHtml(m.id) + '">X</button>' +
            '</div></div></div>';
    }).join('');
}

function resetMsForm() {
    if (!milestoneForm) return;
    milestoneForm.reset();
    if (msId) msId.value = '';
    setMsg(msMsg, '');
}

function fillMsForm(m) {
    if (msId)     msId.value     = m.id;
    if (msTitle)  msTitle.value  = m.title;
    if (msDesc)   msDesc.value   = m.desc;
    if (msDate)   msDate.value   = m.date;
    if (msStatus) msStatus.value = m.status;
}

async function saveMilestone() {
    const title = String(msTitle?.value || '').trim();
    if (!title) { setMsg(msMsg, 'Escribe el nombre del hito.', true); return; }
    const id   = String(msId?.value || '').trim() || ('ms_' + Date.now());
    const prev = milestones.find(m => m.id === id);
    const now  = new Date().toISOString();
    const payload = {
        id, projectId, title,
        desc:      String(msDesc?.value   || ''),
        date:      String(msDate?.value   || ''),
        status:    String(msStatus?.value || 'pendiente'),
        createdAt: prev?.createdAt || now
    };
    try {
        await window.setDoc(window.fsDoc(window.db, MILESTONES_COLLECTION, getMsDocId(id)), payload, { merge: true });
        const idx = milestones.findIndex(m => m.id === id);
        if (idx >= 0) milestones[idx] = payload; else milestones.push(payload);
        milestones.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        renderMilestones();
        setMsg(msMsg, 'Hito guardado.');
        resetMsForm();
    } catch (err) {
        console.error('Error guardando hito:', err);
        setMsg(msMsg, 'No se pudo guardar el hito.', true);
    }
}

async function deleteMilestone(id) {
    if (!window.confirm('Eliminar este hito?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, MILESTONES_COLLECTION, getMsDocId(id)));
        milestones = milestones.filter(m => m.id !== id);
        renderMilestones();
    } catch (err) {
        console.error('Error eliminando hito:', err);
        setMsg(msMsg, 'No se pudo eliminar el hito.', true);
    }
}

// ======================================================
// Team
// ======================================================
function getTeamDocId(id) { return projectId + '__team__' + id; }

function parseMember(d) {
    const data = d.data() || {};
    return {
        id:        String(data.id || d.id),
        name:      String(data.name || 'Miembro'),
        role:      String(data.role || 'programador'),
        avatar:    String(data.avatar || '?'),
        projectId: String(data.projectId || projectId)
    };
}

const ROLE_LABELS_TEAM = {
    programador: 'Programador', modelador: '3D Artist', disenador: 'Disenador',
    qa: 'QA Tester', audio: 'Audio', narrativa: 'Narrativa', lead: 'Lead / Director'
};

async function loadTeam() {
    try {
        const snap = await window.getDocs(window.collection(window.db, TEAM_COLLECTION));
        team = snap.docs.map(parseMember).filter(m => m.projectId === projectId);
        renderTeam();
    } catch (err) { console.warn('Team load failed:', err); }
}

function renderTeam() {
    if (!teamList) return;
    if (!team.length) { teamList.innerHTML = '<p class="dev-empty">Sin miembros registrados.</p>'; return; }
    teamList.innerHTML = team.map(m =>
        '<div class="dev-member-row">' +
        '<div class="dev-member-avatar">' + escHtml(m.avatar) + '</div>' +
        '<div><div class="dev-member-name">' + escHtml(m.name) + '</div>' +
        '<div class="dev-member-role">' + escHtml(ROLE_LABELS_TEAM[m.role] || m.role) + '</div></div>' +
        '<div class="dev-member-actions">' +
        '<button class="dev-btn dev-btn-sm" style="color:#fca5a5;" data-member-delete="' + escHtml(m.id) + '">X</button>' +
        '</div></div>'
    ).join('');
}

async function saveMember() {
    const name = String(teamMemberName?.value || '').trim();
    if (!name) { setMsg(teamMsg, 'Escribe el nombre del miembro.', true); return; }
    const id = String(teamMemberId?.value || '').trim() || ('mbr_' + Date.now());
    const payload = {
        id, projectId, name,
        role:   String(teamMemberRole?.value   || 'programador'),
        avatar: String(teamMemberAvatar?.value || '?') || '?'
    };
    try {
        await window.setDoc(window.fsDoc(window.db, TEAM_COLLECTION, getTeamDocId(id)), payload, { merge: true });
        const idx = team.findIndex(m => m.id === id);
        if (idx >= 0) team[idx] = payload; else team.push(payload);
        renderTeam();
        setMsg(teamMsg, 'Miembro guardado.');
        if (teamForm) teamForm.reset();
        if (teamMemberId) teamMemberId.value = '';
    } catch (err) {
        console.error('Error guardando miembro:', err);
        setMsg(teamMsg, 'No se pudo guardar el miembro.', true);
    }
}

async function deleteMember(id) {
    if (!window.confirm('Quitar este miembro?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, TEAM_COLLECTION, getTeamDocId(id)));
        team = team.filter(m => m.id !== id);
        renderTeam();
    } catch (err) { console.error('Error eliminando miembro:', err); }
}

// ======================================================
// Notes
// ======================================================
function getNoteDocId(id) { return projectId + '__note__' + id; }

function parseNote(d) {
    const data = d.data() || {};
    return {
        id:        String(data.id || d.id),
        title:     String(data.title || 'Sin titulo'),
        content:   String(data.content || ''),
        tag:       String(data.tag || 'general'),
        createdAt: String(data.createdAt || ''),
        updatedAt: String(data.updatedAt || ''),
        projectId: String(data.projectId || projectId)
    };
}

async function loadNotes() {
    try {
        const snap = await window.getDocs(window.collection(window.db, NOTES_COLLECTION));
        notes = snap.docs.map(parseNote).filter(n => n.projectId === projectId)
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        renderNotes();
    } catch (err) { console.warn('Notes load failed:', err); }
}

function renderNotes() {
    if (!notesList) return;
    if (!notes.length) { notesList.innerHTML = '<p class="dev-empty">Sin notas aun.</p>'; return; }
    notesList.innerHTML = notes.map(n =>
        '<div class="dev-note-card" data-note-open="' + escHtml(n.id) + '">' +
        '<div class="dev-note-card-header">' +
        '<span class="dev-note-card-title">' + escHtml(n.title) + '</span>' +
        '<span class="dev-badge dev-badge-gray" style="font-size:.7rem;">' + escHtml(n.tag) + '</span>' +
        '<button class="dev-btn dev-btn-sm" style="color:#fca5a5;flex-shrink:0;" data-note-delete="' + escHtml(n.id) + '">X</button>' +
        '</div>' +
        '<div class="dev-note-card-body">' + escHtml(n.content) + '</div>' +
        '</div>'
    ).join('');
}

function resetNoteForm() {
    if (!noteForm) return;
    noteForm.reset();
    if (noteId) noteId.value = '';
    setMsg(noteMsg, '');
}

function fillNoteForm(n) {
    if (noteId)         noteId.value         = n.id;
    if (noteTitleInput) noteTitleInput.value = n.title;
    if (noteContent)    noteContent.value    = n.content;
    if (noteTag)        noteTag.value        = n.tag;
}

async function saveNote() {
    const title   = String(noteTitleInput?.value || '').trim() || 'Nota sin titulo';
    const content = String(noteContent?.value    || '').trim();
    const id      = String(noteId?.value         || '').trim() || ('note_' + Date.now());
    const prev    = notes.find(n => n.id === id);
    const now     = new Date().toISOString();
    const payload = {
        id, projectId, title, content,
        tag:       String(noteTag?.value || 'general'),
        createdAt: prev?.createdAt || now,
        updatedAt: now
    };
    try {
        await window.setDoc(window.fsDoc(window.db, NOTES_COLLECTION, getNoteDocId(id)), payload, { merge: true });
        const idx = notes.findIndex(n => n.id === id);
        if (idx >= 0) notes[idx] = payload; else notes.unshift(payload);
        notes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        renderNotes();
        setMsg(noteMsg, 'Nota guardada.');
        resetNoteForm();
    } catch (err) {
        console.error('Error guardando nota:', err);
        setMsg(noteMsg, 'No se pudo guardar la nota.', true);
    }
}

async function deleteNote(id) {
    if (!window.confirm('Eliminar esta nota?')) return;
    try {
        await window.deleteDoc(window.fsDoc(window.db, NOTES_COLLECTION, getNoteDocId(id)));
        notes = notes.filter(n => n.id !== id);
        renderNotes();
    } catch (err) { console.error('Error eliminando nota:', err); }
}

// ======================================================
// Project meta (description, dates)
// ======================================================
async function loadProjectMeta() {
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, PROJ_META_COLLECTION, projectId));
        const data = snap.exists() ? snap.data() || {} : {};
        if (projDescText) projDescText.textContent = data.description || 'Sin descripcion.';
        if (infoType)   infoType.textContent   = projectType;
        if (infoStatus) infoStatus.textContent = data.devStatus || projectStatus;
        if (infoBuild)  infoBuild.textContent  = data.currentBuild || '-';
        if (infoStart)  infoStart.textContent  = data.startDate   || '-';
        if (infoTarget) infoTarget.textContent = data.targetDate  || '-';
    } catch (err) { console.warn('Project meta load failed:', err); }
}

async function saveProjectDesc(desc) {
    try {
        await window.setDoc(window.fsDoc(window.db, PROJ_META_COLLECTION, projectId), { description: desc, updatedAt: new Date().toISOString() }, { merge: true });
        if (projDescText) projDescText.textContent = desc || 'Sin descripcion.';
        return true;
    } catch (err) { console.error('Error guardando descripcion:', err); return false; }
}

// ======================================================
// Load all
// ======================================================
async function loadAll() {
    await Promise.all([loadTasks(), loadMilestones(), loadTeam(), loadNotes(), loadProjectMeta()]);
}

// ======================================================
// Events
// ======================================================
function bindBoardEvents() {
    if (!boardEl) return;
    boardEl.addEventListener('click', e => {
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (!target) return;
        const editId = target.getAttribute('data-task-edit');
        if (editId) { const t = tasks.find(t => t.id === editId); if (t) fillTaskForm(t); return; }
        const delId = target.getAttribute('data-task-delete');
        if (delId) deleteTask(delId);
    });
    boardEl.addEventListener('change', e => {
        const sel = e.target instanceof HTMLSelectElement ? e.target : null;
        if (!sel) return;
        const tid = sel.getAttribute('data-task-status');
        if (tid) updateTaskStatus(tid, sel.value);
    });
}

function bindEvents() {
    if (backBtn)   backBtn.addEventListener('click',   () => { window.location.href = toSitePath('pages/admin/panel-desarrollo.html'); });
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadAll());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { if (window.auth && window.signOut) await window.signOut(window.auth); } catch {}
            window.location.replace(toSitePath('index.html'));
        });
    }

    if (taskForm)        taskForm.addEventListener('submit', e => { e.preventDefault(); saveTask(); });
    if (taskResetBtn)    taskResetBtn.addEventListener('click', resetTaskForm);
    if (taskSearchIn)    taskSearchIn.addEventListener('input', renderBoard);
    if (taskDisciplineF) taskDisciplineF.addEventListener('change', renderBoard);
    if (taskPriorityF)   taskPriorityF.addEventListener('change',   renderBoard);
    bindBoardEvents();

    if (milestoneForm) milestoneForm.addEventListener('submit', e => { e.preventDefault(); saveMilestone(); });
    if (msResetBtn)    msResetBtn.addEventListener('click', resetMsForm);
    if (milestoneTimeline) {
        milestoneTimeline.addEventListener('click', e => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (!target) return;
            const editId = target.getAttribute('data-ms-edit');
            if (editId) { const m = milestones.find(m => m.id === editId); if (m) fillMsForm(m); return; }
            const delId = target.getAttribute('data-ms-delete');
            if (delId) deleteMilestone(delId);
        });
    }

    if (teamForm) teamForm.addEventListener('submit', e => { e.preventDefault(); saveMember(); });
    if (teamList) {
        teamList.addEventListener('click', e => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            const delId = target?.getAttribute('data-member-delete');
            if (delId) deleteMember(delId);
        });
    }

    if (addNoteBtn) addNoteBtn.addEventListener('click', resetNoteForm);
    if (noteForm)   noteForm.addEventListener('submit', e => { e.preventDefault(); saveNote(); });
    if (notesList) {
        notesList.addEventListener('click', e => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (!target) return;
            const delId = target.getAttribute('data-note-delete');
            if (delId) { e.stopPropagation(); deleteNote(delId); return; }
            const card  = target.closest('[data-note-open]');
            const openId = card ? card.getAttribute('data-note-open') : null;
            if (openId) { const n = notes.find(n => n.id === openId); if (n) fillNoteForm(n); }
        });
    }

    if (projDescEditBtn) {
        projDescEditBtn.addEventListener('click', () => {
            if (projDescForm) projDescForm.hidden = false;
            if (projDescInput) projDescInput.value = projDescText?.textContent || '';
        });
    }
    if (projDescCancelBtn) {
        projDescCancelBtn.addEventListener('click', () => { if (projDescForm) projDescForm.hidden = true; });
    }
    if (projDescForm) {
        projDescForm.addEventListener('submit', async e => {
            e.preventDefault();
            const ok = await saveProjectDesc(String(projDescInput?.value || '').trim());
            if (ok && projDescForm) projDescForm.hidden = true;
        });
    }
}

// ======================================================
// Auth flow
// ======================================================
async function handleAuthResolved(user) {
    currentUser = user;
    if (!user) {
        if (window.auth?.currentUser) return handleAuthResolved(window.auth.currentUser);
        redirectToList('No se detecto sesion activa.');
        return;
    }
    if (accessResolved) return;
    accessResolved = true;
    clearAccessTimeout();

    const access = await resolveAccess(user);
    if (!access.canAccess) { redirectToList('Tu rol no tiene acceso al panel de proyecto.'); return; }

    applyProjectHeader();
    showPanel();
    await loadAll();
}

function bootAuth() {
    if (!window.auth || !window.onAuthStateChanged) { showGateError('Inicializando autenticacion...'); return false; }
    window.onAuthStateChanged(window.auth, user => {
        handleAuthResolved(user).catch(err => {
            console.error('Auth error panel proyecto:', err);
            redirectToList('No se pudo validar la sesion.');
        });
    });
    if (window.auth.currentUser) handleAuthResolved(window.auth.currentUser).catch(() => {});
    return true;
}

async function init() {
    if (!projectId || projectId === 'unknown') {
        showGateError('URL invalida. Regresa al Dev Hub y abre un proyecto.');
        return;
    }
    initSidebar();
    initTabs();
    bindEvents();
    startAccessTimeout();
    if (bootAuth()) return;
    document.addEventListener('firebaseReady', () => { bootAuth(); }, { once: true });
    setTimeout(() => {
        bootAuth();
        if (!accessResolved && window.auth?.currentUser) handleAuthResolved(window.auth.currentUser).catch(() => {});
    }, 2200);
}

init();
