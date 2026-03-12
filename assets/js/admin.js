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
    viewer: 'Solo lectura'
};

const gate = document.getElementById('adminGate');
const panel = document.getElementById('adminPanel');
const gateMessage = document.getElementById('adminGateMessage');

const currentUserEl = document.getElementById('adminCurrentUser');
const currentEmailEl = document.getElementById('adminCurrentEmail');
const currentRoleLabelEl = document.getElementById('adminCurrentRoleLabel');

const logoutBtn = document.getElementById('adminLogoutBtn');
const goHomeBtn = document.getElementById('adminGoHomeBtn');

const welcomeOverlay = document.getElementById('adminWelcome');
const welcomeTitleEl = document.getElementById('adminWelcomeTitle');
const welcomeSubtitleEl = document.getElementById('adminWelcomeSubtitle');

let welcomeTimer = null;

function normalizeRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROLE_LABELS, normalized) ? normalized : 'viewer';
}

function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.viewer;
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

function playWelcomeAnimation(user, role) {
    if (!welcomeOverlay) return;

    if (welcomeTimer) {
        clearTimeout(welcomeTimer);
        welcomeTimer = null;
    }

    const userName = user?.displayName || user?.email || 'equipo Panter Studio';
    const roleLabel = getRoleLabel(role);
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Bienvenido, ${userName}`;
    }
    if (welcomeSubtitleEl) {
        welcomeSubtitleEl.textContent = `Acceso activo como ${roleLabel}.`;
    }

    welcomeOverlay.hidden = false;

    const duration = prefersReducedMotion ? 650 : 1600;
    welcomeTimer = setTimeout(() => {
        welcomeOverlay.hidden = true;
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
