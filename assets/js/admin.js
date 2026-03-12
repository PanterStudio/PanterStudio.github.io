// Admin Panel - Minimal Base (Auth + Role + Basic Profile)

const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

const ROLE_LABELS = {
    founder_ceo: 'Fundador / CEO',
    administrador: 'Administrador',
    programador: 'Programador',
    modelador: 'Modelador',
    admin_general: 'Admin General',
    developer: 'Desarrollador',
    modeler: 'Modelador',
    community_manager: 'Community Manager',
    support_ops: 'Soporte / Operaciones',
    admin: 'Admin',
    youtuber: 'Youtuber',
    streamer: 'Streamer',
    usuario: 'Usuario',
    vip: 'VIP',
    viewer: 'Solo lectura'
};

const CEO_ASSIGNABLE_ROLES = {
    administrador: 'Administrador',
    programador: 'Programador',
    modelador: 'Modelador',
    youtuber: 'Youtuber',
    streamer: 'Streamer',
    usuario: 'Usuario',
    vip: 'VIP'
};

const ROLE_ALIASES = {
    admin: 'administrador',
    admin_general: 'administrador',
    developer: 'programador',
    modeler: 'modelador',
    viewer: 'usuario'
};

const PANEL_ACCESS_ROLES = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);

const EMAIL_ANALYSIS_COLLECTIONS = ['users', 'preregistros', 'donations', 'sponsors'];

const gate = document.getElementById('adminGate');
const panel = document.getElementById('adminPanel');
const gateMessage = document.getElementById('adminGateMessage');

const currentUserEl = document.getElementById('adminCurrentUser');
const currentEmailEl = document.getElementById('adminCurrentEmail');
const currentRoleLabelEl = document.getElementById('adminCurrentRoleLabel');
const ceoToolsSection = document.getElementById('adminCeoTools');
const ceoUsersMessageEl = document.getElementById('adminCeoUsersMessage');
const ceoUsersTableBody = document.getElementById('adminCeoUsersTableBody');
const ceoEmailSearchInput = document.getElementById('adminCeoEmailSearch');
const ceoRefreshUsersBtn = document.getElementById('adminCeoRefreshUsersBtn');

const logoutBtn = document.getElementById('adminLogoutBtn');
const goHomeBtn = document.getElementById('adminGoHomeBtn');

const welcomeOverlay = document.getElementById('adminWelcome');
const welcomeTitleEl = document.getElementById('adminWelcomeTitle');
const welcomeSubtitleEl = document.getElementById('adminWelcomeSubtitle');

let welcomeTimer = null;
let hasPlayedWelcome = false;
let ceoUsersList = [];
let currentUser = null;

function normalizeRole(role) {
    const normalizedRaw = String(role || '').trim().toLowerCase();
    const normalized = ROLE_ALIASES[normalizedRaw] || normalizedRaw;
    return Object.prototype.hasOwnProperty.call(ROLE_LABELS, normalized) ? normalized : 'viewer';
}

function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.viewer;
}

function normalizeCeoRole(role) {
    const normalizedRaw = String(role || '').trim().toLowerCase();
    const normalized = ROLE_ALIASES[normalizedRaw] || normalizedRaw;
    return Object.prototype.hasOwnProperty.call(CEO_ASSIGNABLE_ROLES, normalized) ? normalized : 'usuario';
}

function canRoleAccessPanel(role) {
    return PANEL_ACCESS_ROLES.has(normalizeRole(role));
}

function isFounderEmail(email) {
    return String(email || '').trim().toLowerCase() === FOUNDER_CEO_EMAIL;
}

function setCeoMessage(message, isError = false) {
    if (!ceoUsersMessageEl) return;
    ceoUsersMessageEl.textContent = message || '';
    ceoUsersMessageEl.className = isError ? 'admin-message error' : 'admin-message';
}

function isValidEmailValue(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed.length > 160) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function collectEmailsFromUnknownData(data, bag, depth = 0) {
    if (!data || depth > 3) return;

    if (typeof data === 'string') {
        if (isValidEmailValue(data)) {
            bag.add(data.trim().toLowerCase());
        }
        return;
    }

    if (Array.isArray(data)) {
        data.forEach((item) => collectEmailsFromUnknownData(item, bag, depth + 1));
        return;
    }

    if (typeof data === 'object') {
        Object.values(data).forEach((value) => collectEmailsFromUnknownData(value, bag, depth + 1));
    }
}

function extractEmailsFromDoc(data, docId = '') {
    const bag = new Set();
    const knownKeys = ['email', 'userEmail', 'donorEmail', 'contactEmail', 'ownerEmail', 'sponsorEmail'];

    if (isValidEmailValue(docId)) {
        bag.add(String(docId).trim().toLowerCase());
    }

    knownKeys.forEach((key) => {
        if (isValidEmailValue(data?.[key])) {
            bag.add(String(data[key]).trim().toLowerCase());
        }
    });

    collectEmailsFromUnknownData(data, bag);
    return [...bag];
}

function addEmailToIndex(indexMap, email, patch = {}) {
    if (!isValidEmailValue(email)) return;

    const normalizedEmail = String(email).trim().toLowerCase();
    const current = indexMap.get(normalizedEmail) || {
        uid: '',
        email: normalizedEmail,
        name: '',
        role: 'usuario',
        isAdmin: false,
        sources: new Set()
    };

    if (patch.uid) current.uid = patch.uid;
    if (patch.name) current.name = patch.name;
    if (patch.role) current.role = patch.role;
    if (typeof patch.isAdmin === 'boolean') current.isAdmin = patch.isAdmin;
    if (Array.isArray(patch.sources)) {
        patch.sources.forEach((source) => current.sources.add(source));
    }

    if (isFounderEmail(normalizedEmail)) {
        current.role = 'founder_ceo';
        current.isAdmin = true;
    }

    indexMap.set(normalizedEmail, current);
}

function createRoleOptions(selectedRole) {
    const normalized = normalizeCeoRole(selectedRole);
    return Object.entries(CEO_ASSIGNABLE_ROLES)
        .map(([value, label]) => `<option value="${value}"${value === normalized ? ' selected' : ''}>${label}</option>`)
        .join('');
}

function renderCeoUsersTable(filterText = '') {
    if (!ceoUsersTableBody) return;

    const searchText = String(filterText || '').trim().toLowerCase();
    const rows = ceoUsersList.filter((item) => {
        if (!searchText) return true;
        const email = String(item.email || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const sources = Array.from(item.sources || []).join(' ').toLowerCase();
        return email.includes(searchText) || name.includes(searchText) || sources.includes(searchText);
    });

    if (rows.length === 0) {
        ceoUsersTableBody.innerHTML = '<tr><td colspan="7">No se encontraron correos.</td></tr>';
        return;
    }

    ceoUsersTableBody.innerHTML = rows.map((user, index) => {
        const isFounder = isFounderEmail(user.email);
        const canAssignRole = Boolean(user.uid);
        const currentRoleLabel = isFounder
            ? 'Fundador / CEO'
            : (canAssignRole ? (CEO_ASSIGNABLE_ROLES[normalizeCeoRole(user.role)] || 'Usuario') : 'Sin cuenta');
        const rowRole = isFounder ? 'founder_ceo' : normalizeCeoRole(user.role);
        const sources = Array.from(user.sources || []);
        const sourceHtml = sources.length
            ? sources.map((source) => `<span class="admin-role-pill">${source}</span>`).join(' ')
            : '<span class="admin-role-pill">desconocido</span>';

        return `
            <tr data-user-id="${user.uid}">
                <td data-label="#">${index + 1}</td>
                <td data-label="Correo">${user.email || 'sin correo'}</td>
                <td data-label="Nombre">${user.name || 'Sin nombre'}</td>
                <td data-label="Rol actual"><span class="admin-role-pill">${currentRoleLabel}</span></td>
                <td data-label="Fuente">${sourceHtml}</td>
                <td data-label="Nuevo rol">
                    <select class="admin-role-select" data-role-select="${user.uid}" ${isFounder || !canAssignRole ? 'disabled' : ''}>
                        ${createRoleOptions(rowRole)}
                    </select>
                </td>
                <td data-label="Accion">
                    <button class="btn admin-role-save-btn" data-role-save="${user.uid}" ${isFounder || !canAssignRole ? 'disabled' : ''}>${canAssignRole ? 'Guardar' : 'N/A'}</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadCeoUsers() {
    if (!ceoUsersTableBody) return;

    if (!window.db || !window.collection || !window.getDocs) {
        setCeoMessage('Firebase aun no esta disponible para cargar usuarios.', true);
        ceoUsersTableBody.innerHTML = '<tr><td colspan="7">No se pudo cargar la lista.</td></tr>';
        return;
    }

    setCeoMessage('Analizando correos en toda la base...');

    try {
        const emailIndexMap = new Map();

        const usersSnapshot = await window.getDocs(window.collection(window.db, 'users'));
        usersSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const email = String(data.email || '').trim().toLowerCase();
            if (!isValidEmailValue(email)) return;

            addEmailToIndex(emailIndexMap, email, {
                uid: docSnap.id,
                name: String(data.username || data.displayName || '').trim(),
                role: isFounderEmail(email) ? 'founder_ceo' : normalizeCeoRole(data.role),
                isAdmin: Boolean(data.isAdmin),
                sources: ['users']
            });
        });

        const extraCollections = EMAIL_ANALYSIS_COLLECTIONS.filter((name) => name !== 'users');
        const extraSnapshots = await Promise.all(
            extraCollections.map(async (collectionName) => {
                try {
                    const snap = await window.getDocs(window.collection(window.db, collectionName));
                    return { collectionName, snap, error: null };
                } catch (error) {
                    console.warn(`No se pudo leer la coleccion ${collectionName}:`, error);
                    return { collectionName, snap: null, error };
                }
            })
        );

        extraSnapshots.forEach(({ collectionName, snap }) => {
            if (!snap) return;
            snap.docs.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const emails = extractEmailsFromDoc(data, docSnap.id);
                emails.forEach((email) => {
                    addEmailToIndex(emailIndexMap, email, { sources: [collectionName] });
                });
            });
        });

        ceoUsersList = Array.from(emailIndexMap.values())
            .sort((a, b) => String(a.email).localeCompare(String(b.email), 'es'));

        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        setCeoMessage(`Correos unicos analizados: ${ceoUsersList.length} (fuentes: ${EMAIL_ANALYSIS_COLLECTIONS.join(', ')})`);
    } catch (err) {
        console.error('Error cargando usuarios del CEO:', err);
        setCeoMessage('Error analizando correos de la base. Intenta nuevamente.', true);
        ceoUsersTableBody.innerHTML = '<tr><td colspan="7">Error al cargar.</td></tr>';
    }
}

async function saveCeoUserRole(uid, role) {
    if (!window.db || !window.fsDoc || !window.setDoc) {
        setCeoMessage('No se pudo actualizar el rol: Firebase no esta listo.', true);
        return;
    }

    const normalizedRole = normalizeCeoRole(role);
    const userItem = ceoUsersList.find((item) => item.uid === uid);
    if (!userItem) return;
    if (!userItem.uid) {
        setCeoMessage('Este correo no tiene cuenta en users. No se puede asignar rol aun.', true);
        return;
    }
    if (isFounderEmail(userItem.email)) {
        setCeoMessage('La cuenta Fundador/CEO no puede ser modificada.', true);
        return;
    }

    try {
        await window.setDoc(window.fsDoc(window.db, 'users', uid), {
            role: normalizedRole,
            isAdmin: canRoleAccessPanel(normalizedRole),
            roleUpdatedAt: new Date().toISOString(),
            roleUpdatedBy: currentUser?.uid || ''
        }, { merge: true });

        userItem.role = normalizedRole;
        userItem.isAdmin = canRoleAccessPanel(normalizedRole);

        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        setCeoMessage(`Rol actualizado: ${userItem.email} -> ${CEO_ASSIGNABLE_ROLES[normalizedRole]}`);
    } catch (err) {
        console.error('Error guardando rol CEO:', err);
        setCeoMessage('No se pudo guardar el rol. Revisa permisos de Firestore.', true);
    }
}

function bindCeoRoleActions() {
    if (!ceoUsersTableBody) return;

    ceoUsersTableBody.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const saveUid = target.getAttribute('data-role-save');
        if (!saveUid) return;

        const selectEl = ceoUsersTableBody.querySelector(`[data-role-select="${saveUid}"]`);
        if (!(selectEl instanceof HTMLSelectElement)) return;
        saveCeoUserRole(saveUid, selectEl.value);
    });
}

function setupCeoTools(user, role) {
    const isCeo = isFounderEmail(user?.email) || normalizeRole(role) === 'founder_ceo';

    if (!ceoToolsSection) return;

    if (!isCeo) {
        ceoToolsSection.hidden = true;
        return;
    }

    ceoToolsSection.hidden = false;
    loadCeoUsers();
}

function getAdminEmails() {
    try {
        const parsed = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '[]');
        if (!Array.isArray(parsed)) return [...DEFAULT_ADMIN_EMAILS];

        const merged = [...DEFAULT_ADMIN_EMAILS, ...parsed]
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean);

        return [...new Set(merged)];
    } catch {
        return [...DEFAULT_ADMIN_EMAILS];
    }
}

function showGateError(message) {
    if (gateMessage) {
        gateMessage.textContent = message;
        gateMessage.className = 'admin-message error';
    }
    if (gate) gate.hidden = false;
    if (panel) panel.hidden = true;
    if (welcomeOverlay) welcomeOverlay.hidden = true;
}

function redirectToHome(message) {
    showGateError(message);
    setTimeout(() => {
        window.location.replace('index.html');
    }, 1400);
}

function showPanel() {
    if (gate) gate.hidden = true;
    if (panel) panel.hidden = false;
}

function hideWelcomeOverlay() {
    if (!welcomeOverlay) return;
    welcomeOverlay.hidden = true;
}

function playWelcomeAnimation(user, role) {
    if (!welcomeOverlay || hasPlayedWelcome) return;
    hasPlayedWelcome = true;

    if (welcomeTimer) {
        clearTimeout(welcomeTimer);
        welcomeTimer = null;
    }

    const userName = user?.displayName || user?.email || 'equipo Panter Studio';
    const roleLabel = getRoleLabel(role);
    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Bienvenido, ${userName}`;
    }
    if (welcomeSubtitleEl) {
        welcomeSubtitleEl.textContent = `Acceso activo como ${roleLabel}.`;
    }

    welcomeOverlay.hidden = false;

    const duration = 3000;
    welcomeTimer = setTimeout(() => {
        hideWelcomeOverlay();
        welcomeTimer = null;
    }, duration);
}

async function resolveUserAccess(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    const isFounder = email === FOUNDER_CEO_EMAIL;

    if (isFounder) {
        return { isAdmin: true, role: 'founder_ceo' };
    }

    let profileData = null;

    if (window.db && window.fsDoc && window.getDoc) {
        try {
            const profileRef = window.fsDoc(window.db, 'users', user.uid);
            const profileSnap = await window.getDoc(profileRef);
            if (profileSnap.exists()) {
                profileData = profileSnap.data() || null;
            }
        } catch (err) {
            console.error('No se pudo leer perfil de usuario para rol admin:', err);
        }
    }

    const isAdminByList = getAdminEmails().includes(email);
    let role = normalizeRole(profileData?.role || (isAdminByList ? 'administrador' : 'usuario'));

    // Compatibilidad con cuentas antiguas que tenian isAdmin pero sin rol definido.
    if (Boolean(profileData?.isAdmin) && (!profileData?.role || role === 'usuario' || role === 'viewer')) {
        role = 'administrador';
    }

    if (isAdminByList && !canRoleAccessPanel(role)) {
        role = 'administrador';
    }

    const isAdmin = canRoleAccessPanel(role);
    return { isAdmin, role };
}

function updateProfileUI(user, role) {
    if (currentUserEl) {
        currentUserEl.textContent = user.displayName || 'Sin nombre';
    }
    if (currentEmailEl) {
        currentEmailEl.textContent = user.email || 'Sin correo';
    }
    if (currentRoleLabelEl) {
        currentRoleLabelEl.textContent = getRoleLabel(role);
    }
}

async function handleAuthStateChange(user) {
    currentUser = user;
    if (!user) {
        redirectToHome('Debes iniciar sesión con una cuenta admin para acceder al panel.');
        return;
    }

    const { isAdmin, role } = await resolveUserAccess(user);

    if (!isAdmin) {
        redirectToHome('Tu cuenta no tiene permisos de administrador.');
        return;
    }

    if (gateMessage) {
        gateMessage.textContent = '';
        gateMessage.className = 'admin-message';
    }

    updateProfileUI(user, role);
    showPanel();
    playWelcomeAnimation(user, role);
    setupCeoTools(user, role);
}

async function handleLogout() {
    try {
        if (window.auth && window.signOut) {
            await window.signOut(window.auth);
        }
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
    } finally {
        window.location.replace('index.html');
    }
}

function bindEvents() {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (goHomeBtn) {
        goHomeBtn.addEventListener('click', () => {
            window.location.replace('index.html');
        });
    }

    if (ceoEmailSearchInput) {
        ceoEmailSearchInput.addEventListener('input', (event) => {
            const value = event.target instanceof HTMLInputElement ? event.target.value : '';
            renderCeoUsersTable(value);
        });
    }

    if (ceoRefreshUsersBtn) {
        ceoRefreshUsersBtn.addEventListener('click', () => {
            loadCeoUsers();
        });
    }

    bindCeoRoleActions();
}

function bootAuthListener() {
    if (!window.auth || !window.onAuthStateChanged) {
        showGateError('Inicializando autenticación...');
        return false;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        handleAuthStateChange(user).catch((err) => {
            console.error('Error validando acceso admin:', err);
            redirectToHome('No se pudo validar tu acceso al panel.');
        });
    });

    return true;
}

function initAdminPanel() {
    bindEvents();

    // Failsafe: si por cualquier motivo la capa quedó visible, se cierra sola a los 3 segundos.
    setTimeout(() => {
        hideWelcomeOverlay();
    }, 3000);

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => {
        bootAuthListener();
    }, { once: true });

    // Fallback de seguridad por si firebaseReady no llega por algun bloqueo.
    setTimeout(() => {
        bootAuthListener();
    }, 2200);
}

initAdminPanel();
