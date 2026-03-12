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

const STATUS_STAGES = {
    pendiente: 'Pendiente',
    en_curso: 'En curso',
    bloqueada: 'Bloqueada',
    lista_qa: 'Lista para QA',
    terminada: 'Terminada'
};

const DISCIPLINE_LABELS = {
    programacion: 'Programacion',
    modelado: 'Modelado',
    diseno_juego: 'Diseño de juego',
    ui_ux: 'UI/UX',
    qa_bugs: 'QA/Bugs',
    audio: 'Audio'
};

const gate = document.getElementById('gameProjGate');
const gateMessage = document.getElementById('gameProjGateMessage');
const panel = document.getElementById('gameProjPanel');

const typeBadgeEl = document.getElementById('gameProjTypeBadge');
const titleEl = document.getElementById('gameProjTitle');
const statusEl = document.getElementById('gameProjStatus');

const totalTasksEl = document.getElementById('gameProjTotalTasks');
const codeTasksEl = document.getElementById('gameProjCodeTasks');
const artTasksEl = document.getElementById('gameProjArtTasks');
const qaTasksEl = document.getElementById('gameProjQaTasks');

const backBtn = document.getElementById('gameProjBackBtn');
const reloadBtn = document.getElementById('gameProjReloadBtn');
const logoutBtn = document.getElementById('gameProjLogoutBtn');

const taskForm = document.getElementById('gameProjTaskForm');
const taskResetBtn = document.getElementById('gameProjTaskResetBtn');

const taskIdInput = document.getElementById('gameProjTaskId');
const taskTitleInput = document.getElementById('gameProjTaskTitle');
const taskDisciplineInput = document.getElementById('gameProjTaskDiscipline');
const taskStageInput = document.getElementById('gameProjTaskStage');
const taskPriorityInput = document.getElementById('gameProjTaskPriority');
const taskStatusInput = document.getElementById('gameProjTaskStatus');
const taskDueDateInput = document.getElementById('gameProjTaskDueDate');
const taskBuildInput = document.getElementById('gameProjTaskBuild');
const taskDescriptionInput = document.getElementById('gameProjTaskDescription');

const searchInput = document.getElementById('gameProjSearch');
const disciplineFilter = document.getElementById('gameProjDisciplineFilter');
const messageEl = document.getElementById('gameProjMessage');
const boardEl = document.getElementById('gameProjBoard');

const params = new URLSearchParams(window.location.search);
const projectId = String(params.get('projectId') || '').trim();
const projectTitle = String(params.get('projectTitle') || 'Proyecto sin nombre').trim();
const projectType = String(params.get('projectType') || 'juego').trim();
const projectStatus = String(params.get('projectStatus') || 'development').trim();

let tasks = [];
let currentUser = null;
let accessResolved = false;
let accessTimeoutId = null;

function normalizeRole(role) {
    const normalizedRaw = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[normalizedRaw] || normalizedRaw || 'usuario';
}

function canAccess(role) {
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
            handleAuthResolved(window.auth.currentUser).catch((err) => {
                console.error('Error resolviendo acceso al proyecto por fallback:', err);
                redirectToList('No se pudo validar tu rol para el proyecto.');
            });
            return;
        }

        redirectToList('No se detecto una sesion valida tras 3 segundos.');
    }, 3000);
}

function redirectToList(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('pages/admin/panel-desarrollo.html')), 1300);
}

async function waitForFirebaseReady(timeout = 5000) {
    return new Promise((resolve) => {
        if (window.db && window.collection && window.getDocs && window.fsDoc && window.getDoc && window.setDoc && window.auth && window.onAuthStateChanged) {
            resolve(true);
            return;
        }

        const start = Date.now();
        const timer = setInterval(() => {
            if (window.db && window.collection && window.getDocs && window.fsDoc && window.getDoc && window.setDoc && window.auth && window.onAuthStateChanged) {
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
        console.error('No se pudo leer perfil en panel proyecto:', err);
    }

    return { canAccess: canAccess(role), role };
}

function applyProjectHeader() {
    if (typeBadgeEl) typeBadgeEl.textContent = projectType === 'aplicacion' ? 'Aplicacion en desarrollo' : 'Videojuego en desarrollo';
    if (titleEl) titleEl.textContent = projectTitle;
    if (statusEl) statusEl.textContent = `Estado: ${projectStatus}`;
}

function getTaskDocId(taskId) {
    return `${projectId}__${taskId}`;
}

function parseDocTask(docSnap) {
    const data = docSnap.data() || {};
    return {
        id: String(data.id || docSnap.id),
        projectId: String(data.projectId || projectId),
        title: String(data.title || 'Sin titulo'),
        discipline: String(data.discipline || 'programacion'),
        stage: String(data.stage || 'produccion'),
        priority: String(data.priority || 'media'),
        status: String(data.status || 'pendiente'),
        dueDate: String(data.dueDate || ''),
        build: String(data.build || ''),
        description: String(data.description || ''),
        updatedAt: String(data.updatedAt || ''),
        createdAt: String(data.createdAt || '')
    };
}

async function loadTasks() {
    try {
        const snapshot = await window.getDocs(window.collection(window.db, PROJECT_TASKS_COLLECTION));
        tasks = snapshot.docs
            .map(parseDocTask)
            .filter((task) => task.projectId === projectId)
            .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

        renderBoard();
        renderKpis();
        setMessage(`Tareas cargadas: ${tasks.length}`);
    } catch (err) {
        console.error('Error cargando tareas del proyecto:', err);
        setMessage('No se pudieron cargar tareas del proyecto.', true);
    }
}

function getFilteredTasks() {
    const text = String(searchInput?.value || '').trim().toLowerCase();
    const discipline = String(disciplineFilter?.value || 'all');

    return tasks.filter((task) => {
        if (discipline !== 'all' && task.discipline !== discipline) return false;
        if (!text) return true;

        const haystack = [task.title, task.description, task.build, task.stage, task.status, task.discipline]
            .join(' ')
            .toLowerCase();
        return haystack.includes(text);
    });
}

function renderKpis() {
    const total = tasks.length;
    const code = tasks.filter((t) => t.discipline === 'programacion').length;
    const art = tasks.filter((t) => t.discipline === 'modelado').length;
    const qa = tasks.filter((t) => t.discipline === 'qa_bugs').length;

    if (totalTasksEl) totalTasksEl.textContent = String(total);
    if (codeTasksEl) codeTasksEl.textContent = String(code);
    if (artTasksEl) artTasksEl.textContent = String(art);
    if (qaTasksEl) qaTasksEl.textContent = String(qa);
}

function renderBoard() {
    if (!boardEl) return;

    const filtered = getFilteredTasks();
    const grouped = {
        pendiente: [],
        en_curso: [],
        bloqueada: [],
        lista_qa: [],
        terminada: []
    };

    filtered.forEach((task) => {
        if (!grouped[task.status]) grouped[task.status] = [];
        grouped[task.status].push(task);
    });

    boardEl.innerHTML = Object.keys(STATUS_STAGES).map((status) => {
        const columnTasks = grouped[status] || [];

        const cards = columnTasks.map((task) => `
            <article class="gameproj-task-card">
                <header>
                    <h4>${task.title}</h4>
                    <span class="dev-priority dev-priority-${task.priority}">${task.priority}</span>
                </header>
                <p>${task.description || 'Sin detalle tecnico.'}</p>
                <div class="gameproj-meta">
                    <span>Disciplina: ${DISCIPLINE_LABELS[task.discipline] || task.discipline}</span>
                    <span>Etapa: ${task.stage}</span>
                    <span>Build: ${task.build || '-'}</span>
                    <span>Fecha: ${task.dueDate || '-'}</span>
                </div>
                <div class="gameproj-actions">
                    <select data-task-status="${task.id}">
                        ${Object.entries(STATUS_STAGES).map(([value, label]) => `<option value="${value}"${task.status === value ? ' selected' : ''}>${label}</option>`).join('')}
                    </select>
                    <button class="btn" data-task-edit="${task.id}">Editar</button>
                    <button class="btn" data-task-delete="${task.id}">Eliminar</button>
                </div>
            </article>
        `).join('');

        return `
            <section class="gameproj-column">
                <header>
                    <h3>${STATUS_STAGES[status]}</h3>
                    <span>${columnTasks.length}</span>
                </header>
                <div class="gameproj-column-body">${cards || '<p class="dev-empty-col">Sin tareas</p>'}</div>
            </section>
        `;
    }).join('');
}

function resetForm() {
    if (!taskForm) return;
    taskForm.reset();
    if (taskIdInput) taskIdInput.value = '';
    if (taskPriorityInput) taskPriorityInput.value = 'media';
    if (taskStatusInput) taskStatusInput.value = 'pendiente';
}

function fillForm(task) {
    taskIdInput.value = task.id;
    taskTitleInput.value = task.title;
    taskDisciplineInput.value = task.discipline;
    taskStageInput.value = task.stage;
    taskPriorityInput.value = task.priority;
    taskStatusInput.value = task.status;
    taskDueDateInput.value = task.dueDate;
    taskBuildInput.value = task.build;
    taskDescriptionInput.value = task.description;
}

async function upsertTask(task) {
    await window.setDoc(window.fsDoc(window.db, PROJECT_TASKS_COLLECTION, getTaskDocId(task.id)), task, { merge: true });
}

async function saveTask() {
    const title = String(taskTitleInput?.value || '').trim();
    if (!title) {
        setMessage('Debes escribir un titulo de tarea.', true);
        return;
    }

    const id = String(taskIdInput?.value || '').trim() || `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previous = tasks.find((t) => t.id === id);
    const now = new Date().toISOString();

    const payload = {
        id,
        projectId,
        projectTitle,
        projectType,
        title,
        discipline: String(taskDisciplineInput?.value || 'programacion'),
        stage: String(taskStageInput?.value || 'produccion'),
        priority: String(taskPriorityInput?.value || 'media'),
        status: String(taskStatusInput?.value || 'pendiente'),
        dueDate: String(taskDueDateInput?.value || ''),
        build: String(taskBuildInput?.value || ''),
        description: String(taskDescriptionInput?.value || ''),
        createdAt: previous?.createdAt || now,
        createdByUid: previous?.createdByUid || currentUser?.uid || '',
        updatedAt: now,
        updatedByUid: currentUser?.uid || ''
    };

    try {
        await upsertTask(payload);
        const idx = tasks.findIndex((t) => t.id === payload.id);
        if (idx >= 0) tasks[idx] = payload;
        else tasks.push(payload);

        tasks.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        renderBoard();
        renderKpis();
        setMessage('Tarea guardada.');
        resetForm();
    } catch (err) {
        console.error('Error guardando tarea de proyecto:', err);
        setMessage('No se pudo guardar la tarea.', true);
    }
}

async function updateTaskStatus(taskId, nextStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updated = { ...task, status: nextStatus, updatedAt: new Date().toISOString(), updatedByUid: currentUser?.uid || '' };
    try {
        await upsertTask(updated);
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx >= 0) tasks[idx] = updated;
        renderBoard();
    } catch (err) {
        console.error('Error actualizando estado de tarea:', err);
        setMessage('No se pudo actualizar el estado.', true);
    }
}

async function deleteTask(taskId) {
    if (!window.confirm('¿Eliminar esta tarea del proyecto?')) return;

    try {
        if (window.deleteDoc) {
            await window.deleteDoc(window.fsDoc(window.db, PROJECT_TASKS_COLLECTION, getTaskDocId(taskId)));
        } else {
            throw new Error('deleteDoc no disponible');
        }

        tasks = tasks.filter((t) => t.id !== taskId);
        renderBoard();
        renderKpis();
        setMessage('Tarea eliminada.');
    } catch (err) {
        console.error('Error eliminando tarea:', err);
        setMessage('No se pudo eliminar la tarea.', true);
    }
}

function bindBoardEvents() {
    if (!boardEl) return;

    boardEl.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const editId = target.getAttribute('data-task-edit');
        if (editId) {
            const task = tasks.find((t) => t.id === editId);
            if (task) fillForm(task);
            return;
        }

        const deleteId = target.getAttribute('data-task-delete');
        if (deleteId) {
            deleteTask(deleteId);
        }
    });

    boardEl.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        const taskId = target.getAttribute('data-task-status');
        if (!taskId) return;
        updateTaskStatus(taskId, target.value);
    });
}

function bindEvents() {
    if (backBtn) backBtn.addEventListener('click', () => window.location.href = toSitePath('pages/admin/panel-desarrollo.html'));
    if (reloadBtn) reloadBtn.addEventListener('click', () => loadTasks());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (window.auth && window.signOut) await window.signOut(window.auth);
            } catch (err) {
                console.error('Error al cerrar sesion:', err);
            } finally {
                window.location.replace(toSitePath('index.html'));
            }
        });
    }

    if (taskForm) {
        taskForm.addEventListener('submit', (event) => {
            event.preventDefault();
            saveTask();
        });
    }

    if (taskResetBtn) taskResetBtn.addEventListener('click', resetForm);

    if (searchInput) searchInput.addEventListener('input', renderBoard);
    if (disciplineFilter) disciplineFilter.addEventListener('change', renderBoard);

    bindBoardEvents();
}

async function handleAuthResolved(user) {
    currentUser = user;
    if (!user) {
        if (window.auth?.currentUser) {
            return handleAuthResolved(window.auth.currentUser);
        }
        return;
    }

    if (accessResolved) return;
    accessResolved = true;
    clearAccessTimeout();

    const access = await resolveUserAccess(user);
    if (!access.canAccess) {
        redirectToList('Tu rol no tiene acceso a paneles de proyecto.');
        return;
    }

    if (!projectId) {
        redirectToList('Proyecto no especificado.');
        return;
    }

    showPanel();
    applyProjectHeader();
    await loadTasks();
}

function bootAuthListener() {
    if (!window.auth || !window.onAuthStateChanged) {
        showGateError('Inicializando autenticacion...');
        return false;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        handleAuthResolved(user).catch((err) => {
            console.error('Error iniciando panel de proyecto:', err);
            redirectToList('No se pudo validar acceso al proyecto.');
        });
    });

    if (window.auth.currentUser) {
        handleAuthResolved(window.auth.currentUser).catch((err) => {
            console.error('Error usando currentUser en panel de proyecto:', err);
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
            handleAuthResolved(window.auth.currentUser).catch((err) => {
                console.error('Error resolviendo currentUser del proyecto por fallback:', err);
            });
        }
    }, 2200);
}

init();
