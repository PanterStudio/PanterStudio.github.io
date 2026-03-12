// Admin Panel - Minimal Base (Auth + Role + Basic Profile)

const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

const ROLE_LABELS = {
    founder_ceo: 'Fundador / CEO',
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
    admin: 'Admin',
    youtuber: 'Youtuber',
    streamer: 'Streamer',
    usuario: 'Usuario',
    vip: 'VIP'
};

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
    const normalized = String(role || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROLE_LABELS, normalized) ? normalized : 'viewer';
}

function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.viewer;
}

function normalizeCeoRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CEO_ASSIGNABLE_ROLES, normalized) ? normalized : 'usuario';
}

function isFounderEmail(email) {
    return String(email || '').trim().toLowerCase() === FOUNDER_CEO_EMAIL;
}

function setCeoMessage(message, isError = false) {
    if (!ceoUsersMessageEl) return;
    ceoUsersMessageEl.textContent = message || '';
    ceoUsersMessageEl.className = isError ? 'admin-message error' : 'admin-message';
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
        return email.includes(searchText) || name.includes(searchText);
    });

    if (rows.length === 0) {
        ceoUsersTableBody.innerHTML = '<tr><td colspan="6">No se encontraron usuarios.</td></tr>';
        return;
    }

    ceoUsersTableBody.innerHTML = rows.map((user, index) => {
        const isFounder = isFounderEmail(user.email);
        const currentRoleLabel = isFounder ? 'Fundador / CEO' : (CEO_ASSIGNABLE_ROLES[normalizeCeoRole(user.role)] || 'Usuario');
        const rowRole = isFounder ? 'founder_ceo' : normalizeCeoRole(user.role);

        return `
            <tr data-user-id="${user.uid}">
                <td>${index + 1}</td>
                <td>${user.email || 'sin correo'}</td>
                <td>${user.name || 'Sin nombre'}</td>
                <td><span class="admin-role-pill">${currentRoleLabel}</span></td>
                <td>
                    <select class="admin-role-select" data-role-select="${user.uid}" ${isFounder ? 'disabled' : ''}>
                        ${createRoleOptions(rowRole)}
                    </select>
                </td>
                <td>
                    <button class="btn admin-role-save-btn" data-role-save="${user.uid}" ${isFounder ? 'disabled' : ''}>Guardar</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadCeoUsers() {
    if (!ceoUsersTableBody) return;

    if (!window.db || !window.collection || !window.getDocs) {
        setCeoMessage('Firebase aun no esta disponible para cargar usuarios.', true);
        ceoUsersTableBody.innerHTML = '<tr><td colspan="6">No se pudo cargar la lista.</td></tr>';
        return;
    }

    setCeoMessage('Cargando cuentas...');

    try {
        const snapshot = await window.getDocs(window.collection(window.db, 'users'));
        ceoUsersList = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            return {
                uid: docSnap.id,
                email: String(data.email || '').trim(),
                name: String(data.username || data.displayName || '').trim(),
                role: isFounderEmail(data.email) ? 'founder_ceo' : normalizeCeoRole(data.role),
                isAdmin: Boolean(data.isAdmin)
            };
        }).sort((a, b) => String(a.email).localeCompare(String(b.email), 'es'));

        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        setCeoMessage(`Usuarios cargados: ${ceoUsersList.length}`);
    } catch (err) {
        console.error('Error cargando usuarios del CEO:', err);
        setCeoMessage('Error cargando usuarios. Intenta nuevamente.', true);
        ceoUsersTableBody.innerHTML = '<tr><td colspan="6">Error al cargar.</td></tr>';
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
    if (isFounderEmail(userItem.email)) {
        setCeoMessage('La cuenta Fundador/CEO no puede ser modificada.', true);
        return;
    }

    try {
        await window.setDoc(window.fsDoc(window.db, 'users', uid), {
            role: normalizedRole,
            isAdmin: normalizedRole === 'admin',
            roleUpdatedAt: new Date().toISOString(),
            roleUpdatedBy: currentUser?.uid || ''
        }, { merge: true });

        userItem.role = normalizedRole;
        userItem.isAdmin = normalizedRole === 'admin';

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

    const isAdminByProfile = Boolean(profileData?.isAdmin);
    const isAdminByList = getAdminEmails().includes(email);
    const isAdmin = isAdminByProfile || isAdminByList;

    const role = normalizeRole(profileData?.role || (isAdmin ? 'admin_general' : 'viewer'));
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
