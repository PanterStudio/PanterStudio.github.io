// Admin Panel - Panter Studio Control Center

// Política de rangos: SIN rango automático por correo. Toda cuenta nace
// como `usuario`; TODOS los rangos se asignan manualmente en
// Panel Admin → Personal (colección `equipo`) y se reflejan al instante.
const SESSION_STORAGE_KEY = 'panterAdminSession';

function getStoredSession() {
    try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

function saveStoredSession(userSession) {
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userSession));
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userSession));
    } catch (e) {
        console.warn('No se pudo guardar la sesión:', e);
    }
}

function clearStoredSession() {
    try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
        console.warn('Error al limpiar la sesión:', e);
    }
}

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');

function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

const ROLE_LABELS = {
    founder_ceo: 'Fundador / CEO',
    director: 'Director',
    administrador: 'Administrador',
    soporte: 'Personal de Soporte',
    programador: 'Programador',
    modelador: 'Modelador',
    moderador: 'Moderador',
    creador_contenido: 'Creador de Contenido',
    usuario: 'Usuario',
    vip: 'VIP',
    viewer: 'Solo lectura'
};

const PANEL_ACCESS_ROLES = new Set(['founder_ceo', 'director', 'administrador', 'programador', 'modelador']);
const EMAIL_ANALYSIS_COLLECTIONS = ['conductores', 'preregistros'];

const gate = document.getElementById('adminGate');
const panel = document.getElementById('adminPanel');
const gateMessage = document.getElementById('adminGateMessage');

const currentUserEl = document.getElementById('adminCurrentUser');
const currentEmailEl = document.getElementById('adminCurrentEmail');
const currentRoleLabelEl = document.getElementById('adminCurrentRoleLabel');

const ceoToolsSection = document.getElementById('tab-accounts');
const sidebarAccountsTab = document.getElementById('sidebarAccountsTab');
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

// TAB Switching
const tabButtons = document.querySelectorAll('.sidebar-tab');
const tabPanes = document.querySelectorAll('.tab-pane');
const sectionTitle = document.getElementById('sectionTitle');
const sectionSub = document.getElementById('sectionSub');

const tabInfo = {
    dashboard: { title: 'Resumen General', sub: 'Estadísticas y resumen del Hub de Panter Studio.' },
    betatesters: { title: 'Beta Testers', sub: 'Inscripciones para el equipo de pruebas en Android.' },
    accounts: { title: 'Gestión de Cuentas (CEO)', sub: 'Miembros del equipo y niveles de rol autorizados.' },
    support: { title: 'Soporte al Jugador', sub: 'Búsqueda de usuarios, edición de perfiles, saldos, mascotas y logs de canjes.' },
    announcements: { title: 'Anuncios', sub: 'Publicación de novedades para la comunidad.' },
    staff: { title: 'Personal del Estudio', sub: 'Equipo visible en la web y rangos asignados manualmente.' },
    siteconfig: { title: 'Configuración Global', sub: 'Modificación de parámetros de la web, donaciones y bonos en Firestore.' },
    visibility: { title: 'Visibilidad del Sitio', sub: 'Gestión del modo de mantenimiento global y accesos por página.' }
};

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        tabPanes.forEach(pane => pane.classList.remove('active'));
        const activePane = document.getElementById(`tab-${tabName}`);
        if (activePane) activePane.classList.add('active');
        
        if (tabInfo[tabName]) {
            if (sectionTitle) sectionTitle.textContent = tabInfo[tabName].title;
            if (sectionSub) sectionSub.textContent = tabInfo[tabName].sub;
        }
        
        if (tabName === 'betatesters') {
            loadBetaTesters();
        } else if (tabName === 'support') {
            loadGlobalRedeemLogs();
        } else if (tabName === 'siteconfig') {
            loadSiteConfig();
        } else if (tabName === 'staff') {
            refreshAssignment();
            loadDiscordRoleMapping();
            if (window.PanterRoles) {
                window.PanterRoles.loadRoleConfig(true)
                    .then(() => refreshRoleUI())
                    .catch(() => {});
            }
        } else if (tabName === 'visibility') {
            loadSiteVisibilitySettings();
        }
    });
});

function normalizeRole(role) {
    if (window.PanterRoles) return window.PanterRoles.normalize(role);
    const n = String(role || '').trim().toLowerCase();
    if (n === 'admin' || n === 'admin_general') return 'administrador';
    if (n === 'support' || n === 'support_ops' || n === 'soporte_ops') return 'soporte';
    if (n === 'developer') return 'programador';
    if (n === 'modeler') return 'modelador';
    return Object.prototype.hasOwnProperty.call(ROLE_LABELS, n) ? n : 'usuario';
}

function getRoleLabel(role) {
    if (window.PanterRoles) return window.PanterRoles.get(role).label;
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.usuario;
}

function canRoleAccessPanel(role) {
    if (window.PanterRoles) return window.PanterRoles.canAccessAdminPanel(role);
    return PANEL_ACCESS_ROLES.has(normalizeRole(role));
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

function addEmailToIndex(indexMap, email, patch = {}) {
    if (!isValidEmailValue(email)) return;
    const normalizedEmail = String(email).trim().toLowerCase();
    const current = indexMap.get(normalizedEmail) || {
        uid: '',
        email: normalizedEmail,
        name: '',
        username: '',
        avatarUrl: '',
        role: 'usuario',
        isAdmin: false,
        sources: new Set()
    };

    if (patch.uid) current.uid = patch.uid;
    if (patch.name) current.name = patch.name;
    if (patch.username) current.username = patch.username;
    if (patch.avatarUrl) current.avatarUrl = patch.avatarUrl;
    if (patch.role) current.role = patch.role;
    if (typeof patch.isAdmin === 'boolean') current.isAdmin = patch.isAdmin;
    if (Array.isArray(patch.sources)) {
        patch.sources.forEach((source) => current.sources.add(source));
    }

    indexMap.set(normalizedEmail, current);
}

// Role visual config for account cards (espejo de roles.js / paleta oficial)
const ROLE_CARD_FALLBACK = {
    founder_ceo:   { color: '#f1c40f', border: 'rgba(241,196,15,0.4)',   bg: 'rgba(241,196,15,0.08)',  icon: '<i class="fa-solid fa-crown" aria-hidden="true"></i>' },
    director:      { color: '#ff0000', border: 'rgba(255,0,0,0.4)',      bg: 'rgba(255,0,0,0.08)',     icon: '<i class="fa-solid fa-user-tie" aria-hidden="true"></i>' },
    administrador: { color: '#f1c40f', border: 'rgba(241,196,15,0.4)',   bg: 'rgba(241,196,15,0.08)',  icon: '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>' },
    soporte:       { color: '#00a715', border: 'rgba(0,167,21,0.4)',     bg: 'rgba(0,167,21,0.08)',    icon: '<i class="fa-solid fa-headset" aria-hidden="true"></i>' },
    programador:   { color: '#ffbc00', border: 'rgba(255,188,0,0.4)',    bg: 'rgba(255,188,0,0.08)',   icon: '<i class="fa-solid fa-code" aria-hidden="true"></i>' },
    modelador:     { color: '#6f5cff', border: 'rgba(111,92,255,0.4)',   bg: 'rgba(111,92,255,0.08)',  icon: '<i class="fa-solid fa-cube" aria-hidden="true"></i>' },
    moderador:     { color: '#e67e22', border: 'rgba(230,126,34,0.4)',   bg: 'rgba(230,126,34,0.08)',  icon: '<i class="fa-solid fa-gavel" aria-hidden="true"></i>' },
    creador_contenido: { color: '#9d00ff', border: 'rgba(157,0,255,0.4)', bg: 'rgba(157,0,255,0.08)', icon: '<i class="fa-solid fa-photo-film" aria-hidden="true"></i>' },
    vip:           { color: '#ff7ddf', border: 'rgba(255,125,223,0.4)',  bg: 'rgba(255,125,223,0.08)', icon: '<i class="fa-solid fa-star" aria-hidden="true"></i>' },
    usuario:       { color: '#0055ff', border: 'rgba(0,85,255,0.3)',     bg: 'rgba(0,85,255,0.06)',    icon: '<i class="fa-solid fa-user" aria-hidden="true"></i>' },
    viewer:        { color: '#0055ff', border: 'rgba(0,85,255,0.3)',     bg: 'rgba(0,85,255,0.06)',    icon: '<i class="fa-solid fa-user" aria-hidden="true"></i>' },
};

const ROLE_CARD_STYLES = (function buildRoleCardStyles() {
    const R = window.PanterRoles || null;
    if (!R || !R.ROLE_DEFS) return ROLE_CARD_FALLBACK;
    const out = Object.assign({}, ROLE_CARD_FALLBACK);
    Object.values(R.ROLE_DEFS).forEach(def => {
        if (!def || !def.id) return;
        out[def.id] = {
            color: def.color,
            border: def.border,
            bg: def.bg,
            icon: `<i class="${def.icon}" aria-hidden="true"></i>`
        };
    });
    return out;
})();

function getInitials(name, email) {
    if (name && name.trim()) {
        return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase()).slice(0,2).join('');
    }
    return (email || '?')[0].toUpperCase();
}

function renderCeoUsersTable(filterText = '') {
    const container = document.getElementById('adminCeoUsersTableBody');
    const countBadge = document.getElementById('accountsCountBadge');
    if (!container) return;

    const searchText = String(filterText || '').trim().toLowerCase();
    const rows = ceoUsersList.filter((item) => {
        if (!searchText) return true;
        const email = String(item.email || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const sources = Array.from(item.sources || []).join(' ').toLowerCase();
        return email.includes(searchText) || name.includes(searchText) || sources.includes(searchText);
    });

    if (countBadge) countBadge.textContent = `${rows.length} usuario${rows.length !== 1 ? 's' : ''}`;

    if (rows.length === 0) {
        container.innerHTML = `
            <div class="accounts-empty">
                <div style="font-size:2.5rem; margin-bottom:0.75rem;"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></div>
                <div style="font-size:0.9rem; color:var(--admin-text-muted);">No se encontraron usuarios.</div>
            </div>`;
        return;
    }

    container.innerHTML = rows.map((user, index) => {
        const isDirector = false;
        const canAssignRole = Boolean(user.uid);
        const rowRole = normalizeRole(user.role);
        const roleDef = window.PanterRoles ? window.PanterRoles.get(rowRole) : null;
        const style = roleDef
            ? { color: roleDef.color, border: roleDef.border, bg: roleDef.bg, icon: `<i class="${roleDef.icon}" aria-hidden="true"></i>` }
            : (ROLE_CARD_STYLES[rowRole] || ROLE_CARD_STYLES.usuario);
        const roleLabel = canAssignRole ? getRoleLabel(rowRole) : 'Sin cuenta';
        const sources = Array.from(user.sources || []);
        const initials = getInitials(user.name, user.email);
        const displayName = user.name || 'Sin nombre';

        return `
        <div class="account-card" data-user-id="${user.uid}">
            <!-- Avatar + identity -->
            <div class="account-card-top">
                <div class="account-avatar" style="border-color:${style.border}; background:${style.bg}; color:${style.color};">
                    ${initials}
                </div>
                <div class="account-identity">
                    <div class="account-name">${displayName}</div>
                    <div class="account-email" title="${user.email}">${user.email || 'Sin correo'}</div>
                    <div class="account-sources">
                        ${sources.map(s => `<span class="account-source-pill">${s}</span>`).join('')}
                    </div>
                </div>
                <span class="account-role-badge" style="color:${style.color}; border-color:${style.border}; background:${style.bg};">
                    ${style.icon} ${roleLabel}
                </span>
            </div>

            <!-- Acciones del directorio -->
            <div class="account-card-bottom ${isDirector ? 'account-card-locked' : ''}">
                ${isDirector ? `
                    <div class="account-locked-msg">
                        <i class="fa-solid fa-crown" aria-hidden="true"></i> Cuenta fundadora — directorio de solo lectura
                    </div>
                ` : `
                    <div class="account-card-actions">
                        <button type="button" class="account-manage-btn" data-manage-staff="${user.uid}"
                            ${canAssignRole ? '' : 'disabled title="Este correo no tiene una cuenta registrada."'}>
                            <i class="fa-solid fa-user-gear" aria-hidden="true"></i> Gestionar en Personal
                        </button>
                        <button type="button" class="account-delete-btn" data-user-delete="${user.uid}" title="Eliminar este usuario de Firestore">
                            <i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar usuario
                        </button>
                    </div>
                `}
            </div>
        </div>`;
    }).join('');
}

/** Lee una colección con timeout: el directorio nunca se queda colgado. */
async function readCollectionSafe(name, timeoutMs = 8000) {
    try {
        const snap = await Promise.race([
            window.getDocs(window.collection(window.db, name)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
        ]);
        return snap && Array.isArray(snap.docs) ? snap.docs : [];
    } catch (error) {
        console.warn(`[Admin] No se pudo leer ${name}:`, error && error.message);
        return [];
    }
}

async function loadCeoUsers() {
    if (!ceoUsersTableBody) return;

    if (!window.db || !window.collection || !window.getDocs) {
        setCeoMessage('Firebase aún no está disponible. Pulsa «Actualizar» en unos segundos.', true);
        ceoUsersTableBody.innerHTML = '<div class="accounts-empty">No se pudo cargar la lista todavía.</div>';
        return;
    }

    setCeoMessage('Analizando correos en toda la base...');

    try {
        const emailIndexMap = new Map();

        const userDocs = await readCollectionSafe('conductores');
        userDocs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (data.eliminado === true) return;
            const email = String(data.email || '').trim().toLowerCase();
            if (!isValidEmailValue(email)) return;

            addEmailToIndex(emailIndexMap, email, {
                uid: docSnap.id,
                name: String(data.username || data.displayName || '').trim(),
                username: String(data.username || '').trim(),
                avatarUrl: String(data.avatarUrl || data.photoURL || data.avatarImg || '').trim(),
                role: normalizeRole(data.role),
                isAdmin: Boolean(data.isAdmin),
                sources: ['conductores']
            });
        });

        // El rango vigente vive en `equipo` (Panel Admin → Personal).
        try {
            const teamDocs = await readCollectionSafe('equipo');
            teamDocs.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.archivado === true) return;
                const email = String(data.email || '').trim().toLowerCase();
                if (!isValidEmailValue(email)) return;
                addEmailToIndex(emailIndexMap, email, {
                    uid: docSnap.id,
                    name: String(data.nombre || data.displayName || data.username || '').trim(),
                    avatarUrl: String(data.avatarUrl || '').trim(),
                    role: normalizeRole(data.role),
                    isAdmin: canRoleAccessPanel(data.role),
                    sources: ['equipo']
                });
            });
        } catch (error) {
            console.warn('No se pudo leer la colección equipo:', error);
        }

        const extraCollections = EMAIL_ANALYSIS_COLLECTIONS.filter((name) => name !== 'conductores');
        const extraSnapshots = await Promise.all(
            extraCollections.map(async (collectionName) => ({
                collectionName,
                docs: await readCollectionSafe(collectionName)
            }))
        );

        extraSnapshots.forEach(({ collectionName, docs }) => {
            docs.forEach((docSnap) => {
                const data = docSnap.data() || {};
                if (data.eliminado === true) return;
                const email = String(data.email || '').trim().toLowerCase();
                if (isValidEmailValue(email)) {
                    addEmailToIndex(emailIndexMap, email, { sources: [collectionName] });
                }
            });
        });

        ceoUsersList = Array.from(emailIndexMap.values())
            .sort((a, b) => String(a.email).localeCompare(String(b.email), 'es'));

        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        setCeoMessage(`Correos unicos analizados: ${ceoUsersList.length}`);
    } catch (err) {
        console.error('Error cargando el directorio de cuentas:', err);
        setCeoMessage('No se pudo leer el directorio ahora mismo. Pulsa «Actualizar» para reintentar.', true);
        ceoUsersTableBody.innerHTML = '<div class="accounts-empty">Sin conexión con la base de datos. Reintenta en unos segundos.</div>';
    }
}

function describeFirestoreFailure(error) {
    const code = String(error && error.code || '').toLowerCase();
    const raw = String(error && error.message || error || '');
    const message = raw.toLowerCase();

    if (code.includes('permission-denied') || message.includes('missing or insufficient permissions')) {
        return {
            kind: 'permission',
            text: 'La base de datos no aceptó la escritura; se usa la copia local.'
        };
    }
    if (code.includes('unavailable') || message.includes('unavailable') || message.includes('failed to get document') || message.includes('network')) {
        return {
            kind: 'network',
            text: 'No se pudo conectar con Firestore (unavailable). Revisa la conexión e inténtalo de nuevo.'
        };
    }
    if (code.includes('unauthenticated') || message.includes('unauthenticated')) {
        return {
            kind: 'auth',
            text: 'La sesión no está autenticada en Firebase (unauthenticated). Inicia sesión de nuevo.'
        };
    }
    return {
        kind: 'error',
        text: `Error de Firestore (${code || 'desconocido'}): ${raw.slice(0, 160) || 'sin detalle'}`
    };
}

async function removeCeoUserDocument(uid) {
    if (!window.db || !window.fsDoc) {
        throw new Error('Firestore no disponible');
    }

    let deleteError = null;
    if (typeof window.deleteDoc === 'function') {
        try {
            await window.deleteDoc(window.fsDoc(window.db, 'conductores', uid));
            return { mode: 'deleted', error: null };
        } catch (error) {
            deleteError = error;
            console.warn('No se pudo borrar el documento; se intenta borrado lógico:', error);
        }
    }

    if (typeof window.setDoc === 'function') {
        try {
            await window.setDoc(window.fsDoc(window.db, 'conductores', uid), {
                eliminado: true,
                eliminadoEn: new Date().toISOString(),
                eliminadoPor: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
            }, { merge: true });
            return { mode: 'soft', error: deleteError };
        } catch (error) {
            throw error || deleteError;
        }
    }

    throw deleteError || new Error('No hay un método de borrado disponible');
}

function findCeoUser(uid) {
    return ceoUsersList.find((item) => String(item.uid) === String(uid)) || null;
}

function isProtectedCeoUser(item) {
    if (!item) return true;
    return normalizeRole(item.role) === 'founder_ceo';
}

function setCeoDeleteMessage(text, isError = false) {
    const el = document.getElementById('ceoDeleteUserMsg');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#fca5a5' : '#fbbf24';
}

let pendingCeoDeleteUid = null;

function openCeoDeleteModal(uid) {
    const item = findCeoUser(uid);
    if (!item || !item.uid) {
        setCeoMessage('No se pudo identificar la cuenta a eliminar.', true);
        return;
    }
    if (isProtectedCeoUser(item)) {
        setCeoMessage('La cuenta Fundador/CEO está protegida y no puede eliminarse.', true);
        return;
    }

    pendingCeoDeleteUid = String(item.uid);

    const nameEl = document.getElementById('ceoDeleteUserName');
    const detailEl = document.getElementById('ceoDeleteUserDetail');
    if (nameEl) nameEl.textContent = item.name || item.email || item.uid;
    if (detailEl) detailEl.textContent = [item.email || 'Sin correo', item.uid].filter(Boolean).join(' · ');

    setCeoDeleteMessage('');

    const confirmBtn = document.getElementById('ceoDeleteConfirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar usuario';
    }

    const modal = document.getElementById('ceoDeleteUserModal');
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    confirmBtn?.focus();
}

function closeCeoDeleteModal() {
    pendingCeoDeleteUid = null;
    const modal = document.getElementById('ceoDeleteUserModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    setCeoDeleteMessage('');
}

function isCurrentSessionUser(item) {
    if (!item) return false;
    const targetUid = String(item.uid || '');
    const targetEmail = String(item.email || '').trim().toLowerCase();

    const sessionUid = currentUser ? String(currentUser.uid || '') : '';
    const sessionEmail = currentUser ? String(currentUser.email || '').trim().toLowerCase() : '';
    if ((sessionUid && targetUid && sessionUid === targetUid) || (sessionEmail && targetEmail && sessionEmail === targetEmail)) {
        return true;
    }

    try {
        const discordUser = window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function'
            ? window.DiscordAuth.getUser()
            : null;
        if (discordUser) {
            const discordUid = String(discordUser.uid || '');
            const discordEmail = String(discordUser.email || '').trim().toLowerCase();
            if ((discordUid && targetUid && discordUid === targetUid) || (discordEmail && targetEmail && discordEmail === targetEmail)) {
                return true;
            }
        }
    } catch (e) { /* sesión de Discord no disponible */ }

    return false;
}

function clearSessionAfterUserDeletion() {
    try {
        localStorage.removeItem('discord_user_session');
        localStorage.removeItem('discord_access_token_store');
        localStorage.removeItem('ps_local_profile');
        sessionStorage.removeItem('discord_access_token');
        sessionStorage.removeItem('panterDiscordGuildContext');
    } catch (e) {
        console.warn('No se pudo limpiar la sesión local:', e);
    }
    clearStoredSession();
    try {
        if (window.DiscordAuth && typeof window.DiscordAuth.logout === 'function') {
            window.DiscordAuth.logout();
        }
    } catch (e) { /* ignore */ }
    currentUser = null;
}

async function confirmCeoUserDeletion() {
    const uid = pendingCeoDeleteUid;
    if (!uid) return;

    const item = findCeoUser(uid);
    if (!item) {
        closeCeoDeleteModal();
        setCeoMessage('La cuenta ya no está en la lista.', true);
        return;
    }
    if (isProtectedCeoUser(item)) {
        closeCeoDeleteModal();
        setCeoMessage('La cuenta Fundador/CEO está protegida y no puede eliminarse.', true);
        return;
    }

    const confirmBtn = document.getElementById('ceoDeleteConfirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Eliminando...';
    }
    setCeoDeleteMessage('');

    const closesCurrentSession = isCurrentSessionUser(item);

    try {
        const result = await removeCeoUserDocument(uid);
        ceoUsersList = ceoUsersList.filter((entry) => String(entry.uid) !== String(uid));
        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        closeCeoDeleteModal();
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar usuario';
        }

        if (result.mode === 'soft') {
            const detail = describeFirestoreFailure(result.error);
            setCeoMessage(`Cuenta marcada como eliminada (borrado lógico). ${detail.text}`.trim(), true);
        } else {
            setCeoMessage(`Cuenta eliminada: ${item.email || uid}`);
        }

        if (closesCurrentSession) {
            clearSessionAfterUserDeletion();
            setCeoMessage('Tu propia cuenta fue eliminada. Cerrando sesión...', true);
            window.setTimeout(() => {
                window.location.href = toSitePath('index.html');
            }, 1400);
        }
    } catch (error) {
        console.error('No se pudo eliminar la cuenta:', error);
        const detail = describeFirestoreFailure(error);
        setCeoDeleteMessage(detail.text, true);
        setCeoMessage(`No se pudo eliminar la cuenta: ${detail.text}`, true);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i> Reintentar';
        }
    }
}

function bindCeoRoleActions() {
    const container = document.getElementById('adminCeoUsersTableBody');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const manageBtn = event.target.closest('[data-manage-staff]');
        if (manageBtn) {
            event.preventDefault();
            manageCeoUserInStaff(manageBtn.getAttribute('data-manage-staff'));
            return;
        }

        const deleteBtn = event.target.closest('[data-user-delete]');
        if (deleteBtn) {
            event.preventDefault();
            openCeoDeleteModal(deleteBtn.getAttribute('data-user-delete'));
        }
    });

    document.getElementById('ceoDeleteCancelBtn')?.addEventListener('click', closeCeoDeleteModal);
    document.getElementById('ceoDeleteConfirmBtn')?.addEventListener('click', confirmCeoUserDeletion);
    document.getElementById('ceoDeleteUserModal')?.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'ceoDeleteUserModal') {
            closeCeoDeleteModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const modal = document.getElementById('ceoDeleteUserModal');
        if (modal && modal.classList.contains('open')) {
            closeCeoDeleteModal();
        }
    });
}

/**
 * Lleva una cuenta del directorio CEO al módulo Personal, cargando sus datos
 * en el formulario integrado del equipo.
 */
function manageCeoUserInStaff(uid) {
    const item = findCeoUser(uid);
    if (!item || !item.uid) {
        setCeoMessage('No se pudo identificar la cuenta para gestionarla.', true);
        return;
    }

    const staffTab = document.querySelector('.sidebar-tab[data-tab="staff"]');
    if (staffTab instanceof HTMLElement) staffTab.click();

    const member = {
        uid: item.uid,
        nombre: item.name || item.username || item.email || 'Miembro',
        username: item.username || '',
        avatarUrl: item.avatarUrl || '',
        role: normalizeRole(item.role),
        estado: 'online',
        orden: 999,
        especialidad: '',
        descripcion: ''
    };

    window.setTimeout(() => {
        fillStaffForm(member);
        staffSetMessage('Completa el rango, la especialidad y guarda para añadirlo al equipo.', 'info');
    }, 80);
}

// ---------- Beta Testers Management ----------
async function loadBetaTesters() {
    const listContainer = document.getElementById('adminBetasList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="color: var(--admin-text-secondary);">Cargando postulaciones...</div>';

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        let applicants = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data && data.betaTesterRequest) {
                applicants.push({
                    uid: docSnap.id,
                    ...data
                });
            }
        });

        if (applicants.length === 0) {
            listContainer.innerHTML = '<div style="color: var(--admin-text-secondary);">No hay postulaciones registradas.</div>';
            return;
        }

        applicants.sort((a,b) => String(b.betaTesterTimestamp || '').localeCompare(String(a.betaTesterTimestamp || '')));

        listContainer.innerHTML = applicants.map((app) => {
            const status = app.betaTesterStatus || 'pending';
            let statusLabel = 'Pendiente <i class="fa-solid fa-circle" style="color:#facc15" aria-hidden="true"></i>';
            if (status === 'approved') statusLabel = 'Aprobado <i class="fa-solid fa-circle" style="color:#22c55e" aria-hidden="true"></i>';
            if (status === 'rejected') statusLabel = 'Rechazado <i class="fa-solid fa-circle" style="color:#ef4444" aria-hidden="true"></i>';

            const skills = [];
            if (app.betaTesterSkillBugs) skills.push('<i class="fa-solid fa-bug" aria-hidden="true"></i> Reportar Bugs');
            if (app.betaTesterSkillHours) skills.push('<i class="fa-solid fa-clock" aria-hidden="true"></i> +5 horas/sem');
            if (app.betaTesterSkillRecord) skills.push('<i class="fa-solid fa-video" aria-hidden="true"></i> Grabar Pantalla');
            if (app.betaTesterSkillDiscord) skills.push('<i class="fa-solid fa-comment-dots" aria-hidden="true"></i> Discord Activo');

            const skillsHtml = skills.length
                ? skills.map(s => `<span class="admin-role-pill" style="font-size:0.75rem;">${s}</span>`).join(' ')
                : '<span class="admin-role-pill" style="opacity:0.5;">Sin habilidades declaradas</span>';

            return `
                <div class="beta-card" data-beta-uid="${app.uid}">
                    <div class="beta-card-header">
                        <div>
                            <div class="beta-card-name">${app.username || app.displayName || 'Sin Nombre'}</div>
                            <div class="beta-card-discord">Discord: ${app.betaTesterDiscord || 'No especificado'}</div>
                        </div>
                        <span id="status-badge-${app.uid}"><span class="status-badge status-${status}">${statusLabel}</span></span>
                    </div>
                    <div class="beta-card-specs">
                        <span class="spec-badge"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> ${app.betaTesterDevice || 'Android'}</span>
                        <span class="spec-badge"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> RAM: ${app.betaTesterRAM || 'N/A'}</span>
                        <span class="spec-badge"><i class="fa-solid fa-robot" aria-hidden="true"></i> Version: ${app.betaTesterAndroidVersion || 'N/A'}</span>
                    </div>
                    <div class="beta-card-skills" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                        ${skillsHtml}
                    </div>
                    <div class="beta-card-motivation">
                        <strong>Motivacion:</strong><br>
                        ${app.betaTesterWhy || 'Sin respuesta.'}
                    </div>
                    <div class="beta-card-actions">
                        <button class="btn btn-sm btn-block" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #a7f3d0;" onclick="setBetaStatus('${app.uid}', 'approved')">Aprobar <i class="fa-solid fa-circle" style="color:#22c55e" aria-hidden="true"></i></button>
                        <button class="btn btn-sm btn-block btn-danger" onclick="setBetaStatus('${app.uid}', 'rejected')">Rechazar <i class="fa-solid fa-circle" style="color:#ef4444" aria-hidden="true"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error cargando beta testers:', err);
        listContainer.innerHTML = '<div style="color:var(--admin-danger);">Error al cargar postulaciones.</div>';
    }
}

window.setBetaStatus = async function(uid, status) {
    if (!window.db || !window.fsDoc || !window.setDoc) return;
    try {
        const docRef = window.fsDoc(window.db, 'conductores', uid);
        await window.setDoc(docRef, {
            betaTesterStatus: status,
            betaTesterStatusUpdatedAt: new Date().toISOString()
        }, { merge: true });

        const badge = document.getElementById(`status-badge-${uid}`);
        if (badge) {
            let label = 'Pendiente <i class="fa-solid fa-circle" style="color:#facc15" aria-hidden="true"></i>';
            if (status === 'approved') label = 'Aprobado <i class="fa-solid fa-circle" style="color:#22c55e" aria-hidden="true"></i>';
            if (status === 'rejected') label = 'Rechazado <i class="fa-solid fa-circle" style="color:#ef4444" aria-hidden="true"></i>';
            badge.innerHTML = `<span class="status-badge status-${status}">${label}</span>`;
        }

        calculateStats();
    } catch (err) {
        console.error('Error actualizando estado beta:', err);
        alert('No se pudo actualizar el estado.');
    }
};

// ---------- Dynamic Dashboard Stats ----------
async function calculateStats() {
    if (!window.db || !window.collection || !window.getDocs) return;
    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        let totalUsers = 0;
        let totalBetas = 0;
        let approvedBetas = 0;
        let totalCoins = 0;

        snap.forEach(docSnap => {
            totalUsers++;
            const data = docSnap.data();
            if (data) {
                if (data.betaTesterRequest) {
                    totalBetas++;
                    if (data.betaTesterStatus === 'approved') {
                        approvedBetas++;
                    }
                }
                totalCoins += (parseFloat(data.saldo || data.monedas) || 0);
            }
        });

        const tu = document.getElementById('statTotalUsers');
        const tb = document.getElementById('statTotalBetas');
        const ab = document.getElementById('statApprovedBetas');
        const tc = document.getElementById('statTotalCoins');

        if (tu) tu.textContent = totalUsers;
        if (tb) tb.textContent = totalBetas;
        if (ab) ab.textContent = approvedBetas;
        if (tc) tc.innerHTML = `${totalCoins.toLocaleString('es-ES')} <i class="fa-solid fa-coins" aria-hidden="true"></i>`;
    } catch (err) {
        console.warn('Error calculando estadisticas:', err);
    }
}

// ---------- Support & Coins Editor ----------
let activeSupportUserUid = null;

async function searchSupportUser() {
    const searchInput = document.getElementById('supportSearchEmail');
    const msg = document.getElementById('supportSearchMessage');
    const card = document.getElementById('supportUserCard');

    if (!searchInput || !msg || !card) return;

    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
        msg.textContent = ' Introduce un nombre, apodo o correo válido.';
        card.hidden = true;
        return;
    }

    msg.textContent = 'Buscando jugador...';
    card.hidden = true;
    activeSupportUserUid = null;

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        let foundUsers = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data) {
                const email = String(data.email || '').toLowerCase();
                const username = String(data.username || '').toLowerCase();
                const displayName = String(data.displayName || '').toLowerCase();
                const conductorId = String(data.id_usuario || '').toLowerCase();
                const uid = String(docSnap.id).toLowerCase();
                
                if (email === query || username.includes(query) || displayName.includes(query) || conductorId === query || uid === query) {
                    foundUsers.push({
                        uid: docSnap.id,
                        ...data
                    });
                }
            }
        });

        if (foundUsers.length === 0) {
            msg.textContent = ' Jugador no encontrado.';
            return;
        }

        if (foundUsers.length > 1) {
            msg.textContent = '';
            const selectContainer = document.createElement('div');
            selectContainer.style.cssText = 'margin-top: 10px; display: flex; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';
            selectContainer.innerHTML = '<span style="font-size:0.85rem; color:var(--admin-text-secondary); margin-bottom: 4px;">Se encontraron varios jugadores. Elige uno:</span>';
            
            foundUsers.forEach(u => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm';
                btn.style.cssText = 'text-align: left; display: block; width: 100%; margin-bottom: 4px;';
                btn.textContent = `${u.username || u.displayName || 'Sin Nombre'} (${u.email || 'Sin Correo'})`;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    displaySelectedSupportUser(u);
                    selectContainer.remove();
                });
                selectContainer.appendChild(btn);
            });
            msg.appendChild(selectContainer);
            return;
        }

        displaySelectedSupportUser(foundUsers[0]);
        msg.textContent = '';
    } catch (err) {
        console.error('Error buscando jugador de soporte:', err);
        msg.textContent = 'Error al realizar la búsqueda.';
    }
}

function displaySelectedSupportUser(user) {
    activeSupportUserUid = user.uid;
    document.getElementById('supportUserTitle').textContent = user.displayName || user.username || 'Sin Nombre';
    document.getElementById('supportUserEmailLabel').textContent = user.email || 'Sin correo';

    // Set fields
    document.getElementById('editSupportDisplayName').value = user.displayName || '';
    document.getElementById('editSupportUsername').value = user.username || '';
    document.getElementById('editSupportAvatar').value = user.avatar || '';
    document.getElementById('editSupportAvatarImg').value = user.avatarImg || '';
    document.getElementById('editSupportCountry').value = user.country || '';

    // Economics
    document.getElementById('editSupportCoins').value = user.saldo !== undefined ? user.saldo : (user.coins !== undefined ? user.coins : 0);
    document.getElementById('editSupportEsmeraldas').value = user.esmeraldas || 0;
    document.getElementById('editSupportDinero').value = user.dinero || 0;
    document.getElementById('editSupportInsurances').value = user.riskInsurance || 0;

    // Permissions/Status
    document.getElementById('editSupportRole').value = user.role || 'usuario';
    document.getElementById('editSupportLevel').value = user.level || 'visitor';
    document.getElementById('editSupportBetaTesterStatus').value = user.betaTesterStatus || '';
    document.getElementById('editSupportStreak').value = user.streak || 0;
    document.getElementById('editSupportInterested').checked = !!user.interested;

    // Pet
    const pet = user.pet || {};
    document.getElementById('editSupportPetName').value = pet.name || '';
    document.getElementById('editSupportPetLevel').value = pet.level || 0;
    document.getElementById('editSupportPetXP').value = pet.xp || 0;
    document.getElementById('editSupportPetHunger').value = pet.hunger !== undefined ? pet.hunger : 100;
    document.getElementById('editSupportPetEnergy').value = pet.energy !== undefined ? pet.energy : 100;
    document.getElementById('editSupportPetCleanliness').value = pet.cleanliness !== undefined ? pet.cleanliness : 100;

    document.getElementById('supportUserCard').hidden = false;
    document.getElementById('supportActionMessage').textContent = '';
}

async function saveSupportUserChanges() {
    const actionMsg = document.getElementById('supportActionMessage');
    if (!activeSupportUserUid || !actionMsg) return;

    actionMsg.textContent = 'Guardando todos los cambios...';
    actionMsg.className = 'admin-message';

    try {
        const userDocRef = window.fsDoc(window.db, 'conductores', activeSupportUserUid);
        const coinsVal = parseFloat(document.getElementById('editSupportCoins').value) || 0;
        
        const updateData = {
            displayName: document.getElementById('editSupportDisplayName').value.trim(),
            username: document.getElementById('editSupportUsername').value.trim(),
            avatar: document.getElementById('editSupportAvatar').value.trim(),
            avatarImg: document.getElementById('editSupportAvatarImg').value.trim(),
            country: document.getElementById('editSupportCountry').value.trim(),
            
            // Sync coins and saldo
            saldo: coinsVal,
            coins: coinsVal,
            
            esmeraldas: parseInt(document.getElementById('editSupportEsmeraldas').value, 10) || 0,
            dinero: parseFloat(document.getElementById('editSupportDinero').value) || 0,
            riskInsurance: parseInt(document.getElementById('editSupportInsurances').value, 10) || 0,
            
            role: document.getElementById('editSupportRole').value,
            level: document.getElementById('editSupportLevel').value,
            betaTesterStatus: document.getElementById('editSupportBetaTesterStatus').value,
            streak: parseInt(document.getElementById('editSupportStreak').value, 10) || 0,
            interested: document.getElementById('editSupportInterested').checked,
            
            updatedAt: new Date().toISOString()
        };

        if (updateData.betaTesterStatus) {
            updateData.betaTesterStatusUpdatedAt = new Date().toISOString();
        }

        // Pet structure
        const petName = document.getElementById('editSupportPetName').value.trim();
        if (petName || document.getElementById('editSupportPetLevel').value) {
            updateData.pet = {
                name: petName,
                level: parseInt(document.getElementById('editSupportPetLevel').value, 10) || 0,
                xp: parseInt(document.getElementById('editSupportPetXP').value, 10) || 0,
                hunger: parseInt(document.getElementById('editSupportPetHunger').value, 10) || 0,
                energy: parseInt(document.getElementById('editSupportPetEnergy').value, 10) || 0,
                cleanliness: parseInt(document.getElementById('editSupportPetCleanliness').value, 10) || 0
            };
        }

        await window.setDoc(userDocRef, updateData, { merge: true });

        actionMsg.textContent = ' Todos los cambios se guardaron exitosamente en la base de datos.';
        actionMsg.className = 'admin-message success';

        calculateStats();
    } catch (err) {
        console.error('Error guardando soporte:', err);
        actionMsg.textContent = ' No se pudieron guardar los cambios.';
        actionMsg.className = 'admin-message error';
    }
}

async function resetCooldown(type) {
    const actionMsg = document.getElementById('supportActionMessage');
    if (!activeSupportUserUid || !actionMsg) return;

    actionMsg.textContent = `Reiniciando cooldown de ${type === 'work' ? 'trabajo' : 'riesgo'}...`;
    actionMsg.className = 'admin-message';

    try {
        const userDocRef = window.fsDoc(window.db, 'conductores', activeSupportUserUid);
        const updateField = {};
        if (type === 'work') {
            updateField.cooldownWork = 0;
        } else if (type === 'risk') {
            updateField.cooldownRisk = 0;
        }
        await window.setDoc(userDocRef, updateField, { merge: true });
        
        actionMsg.textContent = ` Cooldown de ${type === 'work' ? 'Trabajo ' : 'Riesgo '} reiniciado con éxito.`;
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error(err);
        actionMsg.textContent = ' Error al reiniciar cooldown.';
        actionMsg.className = 'admin-message error';
    }
}

async function loadGlobalRedeemLogs() {
    const tbody = document.getElementById('redeemLogsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--admin-text-secondary);">Cargando logs de canjes...</td></tr>';

    try {
        if (!window.db || !window.collection || !window.getDocs || !window.query || !window.orderBy || !window.limit) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--admin-danger);">Firebase no inicializado aún.</td></tr>';
            return;
        }

        const q = window.query(
            window.collection(window.db, 'redenciones'),
            window.orderBy('createdAt', 'desc'),
            window.limit(20)
        );

        const snap = await window.getDocs(q);
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--admin-text-secondary);">No se registraron canjes aún.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const date = data.createdAt ? new Date(data.createdAt).toLocaleString('es-CO') : '—';
            const player = data.username || data.email || 'Anónimo';
            const coins = data.coins ? data.coins.toLocaleString() : '0';
            const emeralds = data.esmeraldas || data.emeralds || 0;
            const status = data.status || 'completed';
            
            let statusBadge = '<span class="status-badge status-approved">Completado <i class="fa-solid fa-circle" style="color:#22c55e" aria-hidden="true"></i></span>';
            if (status === 'pending') statusBadge = '<span class="status-badge status-pending">Pendiente <i class="fa-solid fa-circle" style="color:#facc15" aria-hidden="true"></i></span>';
            if (status === 'failed' || status === 'rejected') statusBadge = '<span class="status-badge status-rejected">Error <i class="fa-solid fa-circle" style="color:#ef4444" aria-hidden="true"></i></span>';

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td><strong>${player}</strong><br><small style="color:var(--admin-text-muted);">${data.email || ''}</small></td>
                    <td style="color:#fbbf24; font-weight:700;"><i class="fa-solid fa-coins" aria-hidden="true"></i> ${coins}</td>
                    <td style="color:#00b0ff; font-weight:700;"><i class="fa-solid fa-gem" aria-hidden="true"></i> ${emeralds}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error('Error cargando canjes:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--admin-danger);">Error al leer registros de redenciones.</td></tr>';
    }
}

// ---------- General Setup & Gate Helpers ----------
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
        window.location.replace(toSitePath('index.html'));
    }, 1400);
}

function showPanel() {
    if (gate) gate.hidden = true;
    if (panel) panel.hidden = false;
}

function hidePanel() {
    if (panel) panel.hidden = true;
    if (gate) gate.hidden = false;
}

/**
 * Espera a que el SDK de Firestore exponga las funciones necesarias para
 * validar el rango manual (`equipo`). Devuelve `false` si no llegó a tiempo.
 */
function waitForAdminFirestore(timeoutMs = 4000) {
    const ready = () => Boolean(window.db && window.fsDoc && window.getDoc);
    if (ready()) return Promise.resolve(true);

    return new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            document.removeEventListener('firebaseReady', onReady);
            resolve(ok);
        };
        const onReady = () => finish(ready());
        document.addEventListener('firebaseReady', onReady, { once: true });

        const started = Date.now();
        const tick = () => {
            if (ready()) return finish(true);
            if (Date.now() - started >= timeoutMs) return finish(false);
            setTimeout(tick, 200);
        };
        tick();
    });
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

    welcomeTimer = setTimeout(() => {
        hideWelcomeOverlay();
        welcomeTimer = null;
    }, 3000);
}

async function resolveUserAccess(user) {
    if (!user) return { isAdmin: false, role: 'usuario' };

    // Asegura que la jerarquía y los permisos personalizados estén cargados
    // antes de decidir si la cuenta puede entrar al panel.
    if (window.PanterRoles && typeof window.PanterRoles.loadRoleConfig === 'function') {
        try { await window.PanterRoles.loadRoleConfig(true); } catch (e) { /* sin conexión */ }
    }

    const R = window.PanterRoles;

    // Perfil base (conductores) sólo para enriquecer datos; NO otorga rango.
    let profileData = null;
    if (window.db && window.fsDoc && window.getDoc) {
        try {
            const profileSnap = await window.getDoc(window.fsDoc(window.db, 'conductores', user.uid));
            if (profileSnap.exists()) profileData = profileSnap.data() || null;
        } catch (err) {
            console.error('No se pudo leer el perfil de usuario:', err);
        }
    }

    // Rango manual vigente en `equipo` (Panel Admin → Personal).
    let teamMember = null;
    if (window.db && window.fsDoc && window.getDoc) {
        try {
            const teamSnap = await window.getDoc(window.fsDoc(window.db, 'equipo', user.uid));
            if (teamSnap.exists()) teamMember = teamSnap.data() || null;
        } catch (err) {
            console.error('No se pudo leer el rango del equipo:', err);
        }
    }

    const effectiveProfile = Object.assign({}, profileData || {});
    if (teamMember && teamMember.archivado !== true && teamMember.role) {
        effectiveProfile.teamRole = teamMember.role;
    }
    if (!effectiveProfile.email) {
        effectiveProfile.email = (teamMember && teamMember.email) || user.email || '';
    }

    const role = R
        ? R.resolveRole(user, effectiveProfile)
        : 'usuario';

    return { isAdmin: canRoleAccessPanel(role), role };
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

function setupCeoTools(user, role) {
    // La sección de cuentas la ven los rangos con acceso al panel.
    const isManager = canRoleAccessPanel(role);
    if (sidebarAccountsTab) {
        sidebarAccountsTab.hidden = !isManager;
    }
}

async function handleEmailPasswordLogin(emailInput, passwordInput) {
    const email = String(emailInput || '').trim().toLowerCase();
    const password = String(passwordInput || '').trim();

    if (!email || !password) {
        if (gateMessage) {
            gateMessage.textContent = ' Por favor ingresa tu correo y contraseña.';
            gateMessage.className = 'admin-message error';
        }
        return;
    }

    if (gateMessage) {
        gateMessage.textContent = 'Verificando credenciales...';
        gateMessage.className = 'admin-message';
    }

    // Autenticación exclusiva con Firebase Email/Password.
    if (window.firebaseAuth && window.signInWithEmailAndPassword) {
        try {
            const userCredential = await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
            const user = userCredential.user;
            await handleAuthStateChange(user);
            return;
        } catch (err) {
            console.warn('Firebase signInWithEmailAndPassword error:', err);
        }
    }

    if (gateMessage) {
        gateMessage.textContent = ' Correo o contraseña no válidos para el panel.';
        gateMessage.className = 'admin-message error';
    }
}

async function applyStoredSession(storedSession) {
    if (!storedSession || !storedSession.isAdmin) return false;

    // Sin Firestore no es posible revalidar el rango: no invalidamos la sesión
    // todavía, se reintentará cuando el SDK esté listo.
    if (!window.db || !window.fsDoc || !window.getDoc) return false;

    // Revalida el rango guardado contra `equipo` (única fuente de rangos).
    // Una sesión antigua no puede conservar ADMIN/OWNER automáticamente.
    const access = await resolveUserAccess({
        uid: storedSession.uid,
        email: storedSession.email,
        displayName: storedSession.displayName,
        username: storedSession.username
    });
    if (!access.isAdmin) {
        clearStoredSession();
        return false;
    }

    const sessionUser = Object.assign({}, storedSession, {
        role: access.role,
        isAdmin: true
    });
    saveStoredSession(sessionUser);
    currentUser = sessionUser;
    updateProfileUI(sessionUser, access.role);
    showPanel();
    setupCeoTools(sessionUser, access.role);
    calculateStats();
    loadBetaTesters();
    if (gateMessage) gateMessage.textContent = '';
    return true;
}

async function handleAuthStateChange(user) {
    currentUser = user;
    const loginBtn = document.getElementById('adminLoginBtn');

    if (!user) {
        const storedSession = getStoredSession();
        if (storedSession && storedSession.isAdmin) {
            if (await applyStoredSession(storedSession)) return;
        }

        hidePanel();
        if (gateMessage) {
            gateMessage.textContent = 'Ingresa tus credenciales de administrador';
            gateMessage.className = 'admin-message';
        }
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
        return;
    }

    if (loginBtn) {
        loginBtn.style.display = 'none';
    }

    // El rango manual se lee de Firestore: espera breve para no negar el
    // acceso a un miembro del equipo mientras carga el SDK.
    const firestoreReady = await waitForAdminFirestore();
    const { isAdmin, role } = await resolveUserAccess(user);

    if (!isAdmin) {
        if (!firestoreReady) {
            if (gateMessage) {
                gateMessage.textContent = 'No se pudo validar tu rango todavía. Recarga la página en unos segundos.';
                gateMessage.className = 'admin-message error';
            }
            if (loginBtn) loginBtn.style.display = 'block';
            return;
        }
        clearStoredSession();
        hidePanel();
        if (gateMessage) {
            gateMessage.textContent = ' Tu cuenta (' + user.email + ') no tiene permisos de administrador.';
            gateMessage.className = 'admin-message error';
        }
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
        return;
    }

    if (gateMessage) {
        gateMessage.textContent = '';
    }

    saveStoredSession({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email,
        role,
        isAdmin: true
    });

    updateProfileUI(user, role);
    showPanel();
    playWelcomeAnimation(user, role);
    setupCeoTools(user, role);

    calculateStats();
    loadBetaTesters();
}

async function handleLogout() {
    clearStoredSession();
    try {
        if (typeof window.signOut === 'function') {
            await window.signOut(window.firebaseAuth);
        }
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
    } finally {
        window.location.replace(toSitePath('index.html'));
    }
}

function bindEvents() {
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (goHomeBtn) {
        goHomeBtn.addEventListener('click', () => {
            window.location.replace(toSitePath('index.html'));
        });
    }

    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('adminEmailInput')?.value;
            const passwordInput = document.getElementById('adminPasswordInput')?.value;
            handleEmailPasswordLogin(emailInput, passwordInput);
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

    const refreshBetasBtn = document.getElementById('adminRefreshBetasBtn');
    if (refreshBetasBtn) {
        refreshBetasBtn.addEventListener('click', () => {
            loadBetaTesters();
        });
    }

    // Support trigger attachments
    const searchSupportBtn = document.getElementById('supportSearchBtn');
    if (searchSupportBtn) {
        searchSupportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchSupportUser();
        });
    }
    const saveChangesBtn = document.getElementById('supportSaveChangesBtn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveSupportUserChanges();
        });
    }
    const resetWorkBtn = document.getElementById('btnResetWorkCooldown');
    if (resetWorkBtn) {
        resetWorkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetCooldown('work');
        });
    }
    const resetRiskBtn = document.getElementById('btnResetRiskCooldown');
    if (resetRiskBtn) {
        resetRiskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetCooldown('risk');
        });
    }
    const refreshRedeemsBtn = document.getElementById('btnRefreshRedeemLogs');
    if (refreshRedeemsBtn) {
        refreshRedeemsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadGlobalRedeemLogs();
        });
    }

    const btnSaveSiteConfig = document.getElementById('btnSaveSiteConfig');
    if (btnSaveSiteConfig) {
        btnSaveSiteConfig.addEventListener('click', (e) => {
            e.preventDefault();
            saveSiteConfig();
        });
    }

    const btnSaveVisibility = document.getElementById('btnSaveVisibility');
    if (btnSaveVisibility) {
        btnSaveVisibility.addEventListener('click', (e) => {
            e.preventDefault();
            saveSiteVisibilitySettings();
        });
    }

    // Personal del Estudio + mapeo Discord
    populateStaffRoleSelect();
    document.getElementById('staffRefreshBtn')?.addEventListener('click', () => {
        loadStaffDirectory(true);
        refreshAssignment();
        loadDiscordRoleMapping();
        if (window.PanterRoles) {
            window.PanterRoles.loadRoleConfig(true)
                .then(() => refreshRoleUI())
                .catch(() => {});
        }
    });
    document.getElementById('staffSaveBtn')?.addEventListener('click', saveStaffFromForm);
    document.getElementById('staffResetBtn')?.addEventListener('click', () => resetStaffForm());
    document.getElementById('staffUserPickBtn')?.addEventListener('click', () => {
        const uid = document.getElementById('staffUserPicker')?.value || '';
        if (!uid) {
            staffSetMessage('Selecciona un usuario registrado o deja el formulario vacío para crear un miembro manual.', 'info');
            return;
        }
        loadDirectoryUserIntoForm(uid);
    });
    document.getElementById('staffUserPicker')?.addEventListener('change', (event) => {
        const uid = event.target instanceof HTMLSelectElement ? event.target.value : '';
        if (uid) loadDirectoryUserIntoForm(uid);
    });
    document.getElementById('staffAdminList')?.addEventListener('click', (event) => {
        handleStaffListClick(event).catch((error) => {
            console.error(error);
            staffSetMessage('Ocurrió un error al procesar la acción.', true);
        });
    });
    document.getElementById('creatorCodeSaveBtn')?.addEventListener('click', () => {
        saveCreatorReferralCode().catch(error => creatorCodeSetMessage(error?.message || 'No se pudo guardar el código.', 'error'));
    });
    document.getElementById('creatorCodeResetBtn')?.addEventListener('click', () => {
        resetCreatorReferralCode().catch(error => creatorCodeSetMessage(error?.message || 'No se pudo generar el código.', 'error'));
    });
    document.getElementById('creatorCodeUser')?.addEventListener('change', (event) => {
        loadCreatorCodePreview(event.target?.value || '').catch(() => {});
    });
    document.getElementById('discordMapSaveBtn')?.addEventListener('click', saveDiscordRoleMapping);
    document.getElementById('discordMapReloadBtn')?.addEventListener('click', loadDiscordRoleMapping);
    bindRoleManager();
    bindRoleAssignment();

    bindCeoRoleActions();
}

// ---------- Configuración del Sitio (siteconfig) & Visibilidad (visibility) ----------

async function loadSiteConfig() {
    const actionMsg = document.getElementById('siteConfigActionMessage');
    if (actionMsg) {
        actionMsg.textContent = 'Cargando configuración...';
        actionMsg.className = 'admin-message';
    }

    try {
        if (!window.db || !window.fsDoc || !window.getDoc) return;

        const [siteSnap, donationSnap] = await Promise.all([
            window.getDoc(window.fsDoc(window.db, 'settings', 'site')).catch(() => null),
            window.getDoc(window.fsDoc(window.db, 'settings', 'donations')).catch(() => null)
        ]);

        if (siteSnap && siteSnap.exists()) {
            const siteData = siteSnap.data();
            document.getElementById('cfgReferralCoins').value = siteData.referralCoins || '';
            const creatorCoinsField = document.getElementById('cfgCreatorReferralCoins');
            if (creatorCoinsField) creatorCoinsField.value = siteData.creatorReferralCoins || '';
            document.getElementById('cfgDailyCoins').value = siteData.dailyBonusCoins || '';
            document.getElementById('cfgEnableNewsPage').checked = siteData.enableNewsPage !== false;
            document.getElementById('cfgAnnouncementText').value = siteData.announcement || '';
        }

        if (donationSnap && donationSnap.exists()) {
            const donData = donationSnap.data();
            document.getElementById('cfgDonationGoal').value = donData.donationGoal || '';
            document.getElementById('cfgPaypalLink').value = donData.paypalLink || '';
            document.getElementById('cfgPatreonLink').value = donData.patreonLink || '';
            document.getElementById('cfgNequiLink').value = donData.nequiLink || '';
            document.getElementById('cfgBreveLink').value = donData.breveLink || '';
        }

        if (actionMsg) actionMsg.textContent = '';
    } catch (err) {
        console.error('Error cargando configuración:', err);
        if (actionMsg) {
            actionMsg.textContent = ' Error al cargar configuración de la base de datos.';
            actionMsg.className = 'admin-message error';
        }
    }
}

async function saveSiteConfig() {
    const actionMsg = document.getElementById('siteConfigActionMessage');
    if (!actionMsg) return;

    actionMsg.textContent = 'Guardando configuración...';
    actionMsg.className = 'admin-message';

    try {
        if (!window.db || !window.fsDoc || !window.setDoc) return;

        const referralCoins = parseInt(document.getElementById('cfgReferralCoins').value, 10) || 0;
        const creatorReferralCoinsRaw = parseInt(document.getElementById('cfgCreatorReferralCoins')?.value, 10);
        // El código de creador siempre debe dar, como mínimo, la recompensa normal.
        const creatorReferralCoins = Number.isFinite(creatorReferralCoinsRaw) && creatorReferralCoinsRaw >= 0
            ? Math.max(creatorReferralCoinsRaw, referralCoins)
            : Math.max(100, referralCoins);
        const dailyBonusCoins = parseInt(document.getElementById('cfgDailyCoins').value, 10) || 0;
        const enableNewsPage = document.getElementById('cfgEnableNewsPage').checked;
        const announcement = document.getElementById('cfgAnnouncementText').value.trim();

        const donationGoal = parseFloat(document.getElementById('cfgDonationGoal').value) || 0;
        const paypalLink = document.getElementById('cfgPaypalLink').value.trim();
        const patreonLink = document.getElementById('cfgPatreonLink').value.trim();
        const nequiLink = document.getElementById('cfgNequiLink').value.trim();
        const breveLink = document.getElementById('cfgBreveLink').value.trim();

        await Promise.all([
            window.setDoc(window.fsDoc(window.db, 'settings', 'site'), {
                referralCoins,
                creatorReferralCoins,
                dailyBonusCoins,
                enableNewsPage,
                announcement,
                updatedAt: new Date().toISOString()
            }, { merge: true }),
            window.setDoc(window.fsDoc(window.db, 'settings', 'donations'), {
                donationGoal,
                paypalLink,
                patreonLink,
                nequiLink,
                breveLink,
                updatedAt: new Date().toISOString()
            }, { merge: true })
        ]);

        actionMsg.textContent = ' Configuración guardada correctamente en Firestore.';
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error('Error guardando configuración:', err);
        actionMsg.textContent = ' No se pudo guardar la configuración.';
        actionMsg.className = 'admin-message error';
    }
}

async function loadSiteVisibilitySettings() {
    const actionMsg = document.getElementById('visibilityActionMessage');
    if (actionMsg) {
        actionMsg.textContent = 'Cargando accesos de visibilidad...';
        actionMsg.className = 'admin-message';
    }

    try {
        if (!window.db || !window.fsDoc || !window.getDoc) return;

        const snap = await window.getDoc(window.fsDoc(window.db, 'admin', 'siteVisibility'));
        if (snap && snap.exists()) {
            const data = snap.data() || {};
            document.getElementById('cfgGlobalMaintenance').checked = !!data.globalMaintenance;

            const pages = ['perfil', 'donaciones', 'personal', 'actualizaciones'];
            pages.forEach(p => {
                const cfg = data.pages && data.pages[p] ? data.pages[p] : {};
                document.getElementById(`cfgMaint_${p}`).checked = !!cfg.maintenance;
                document.getElementById(`cfgEmails_${p}`).value = Array.isArray(cfg.allowedEmails) ? cfg.allowedEmails.join(', ') : '';
            });
        }

        if (actionMsg) actionMsg.textContent = '';
    } catch (err) {
        console.error('Error cargando visibilidad:', err);
        if (actionMsg) {
            actionMsg.textContent = ' Error al cargar configuración de visibilidad.';
            actionMsg.className = 'admin-message error';
        }
    }
}

async function saveSiteVisibilitySettings() {
    const actionMsg = document.getElementById('visibilityActionMessage');
    if (!actionMsg) return;

    actionMsg.textContent = 'Guardando configuración de visibilidad...';
    actionMsg.className = 'admin-message';

    try {
        if (!window.db || !window.fsDoc || !window.setDoc) return;

        const globalMaintenance = document.getElementById('cfgGlobalMaintenance').checked;
        const pagesObj = {};

        const pagesList = ['perfil', 'donaciones', 'personal', 'actualizaciones'];
        pagesList.forEach(p => {
            const maintenance = document.getElementById(`cfgMaint_${p}`).checked;
            const emailsText = document.getElementById(`cfgEmails_${p}`).value;
            const allowedEmails = emailsText.split(',')
                .map(email => email.trim().toLowerCase())
                .filter(email => email.length > 0 && email.includes('@'));

            pagesObj[p] = {
                maintenance,
                allowedEmails
            };
        });

        await window.setDoc(window.fsDoc(window.db, 'admin', 'siteVisibility'), {
            globalMaintenance,
            pages: pagesObj,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        actionMsg.textContent = ' Visibilidad del sitio guardada exitosamente en Firestore.';
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error('Error guardando visibilidad:', err);
        actionMsg.textContent = ' Error al guardar visibilidad del sitio.';
        actionMsg.className = 'admin-message error';
    }
}

// ---------- Personal del Estudio (colección equipo) ----------

const STAFF_COLLECTION = 'equipo';
const STAFF_FALLBACK_ROLES = ['founder_ceo', 'director', 'administrador', 'programador', 'modelador', 'moderador', 'soporte', 'creador_contenido', 'vip', 'usuario'];

let staffMembersCache = [];
let staffDirectoryCache = [];
let staffDirectoryLoaded = false;
let editingStaffUid = null;

function staffEscape(value) {
    if (window.PanterRoles) return window.PanterRoles.escapeHtml(value);
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function staffSetMessage(text, tone = 'info') {
    const el = document.getElementById('staffFormMsg');
    if (!el) return;
    let kind = tone;
    if (tone === true) kind = 'error';
    if (tone === false) kind = 'info';
    if (!['info', 'success', 'warning', 'error'].includes(kind)) kind = 'info';
    const colors = { info: '#7dd3fc', success: '#86efac', warning: '#fbbf24', error: '#fca5a5' };
    el.textContent = text || '';
    el.style.color = colors[kind];
    el.dataset.tone = kind;
}

function staffDiscordSetMessage(text, isError) {
    const el = document.getElementById('discordMapMsg');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#fca5a5' : '#7dd3fc';
}

function staffRoleLabel(role) {
    return window.PanterRoles ? window.PanterRoles.get(role).label : (ROLE_LABELS[role] || role);
}

function staffRoleOptions(selected) {
    const R = window.PanterRoles;
    const normalized = R ? R.normalize(selected) : (selected || 'usuario');
    // `normalize()` ya convierte el legado ADMIN / OWNER a Fundador / CEO.
    const ids = R ? R.orderedRoleIds() : STAFF_FALLBACK_ROLES.slice();
    if (R && !ids.includes(normalized) && R.ROLE_DEFS[normalized]) ids.push(normalized);
    return ids.map(id => {
        const def = R ? R.get(id) : null;
        const label = def ? def.label : (ROLE_LABELS[id] || id);
        return `<option value="${id}"${id === normalized ? ' selected' : ''}>${staffEscape(label)}</option>`;
    }).join('');
}

function populateStaffRoleSelect(selected) {
    const select = document.getElementById('staffFieldRole');
    if (!select) return;
    const value = selected || select.value || 'usuario';
    select.innerHTML = staffRoleOptions(value);
    select.value = window.PanterRoles ? window.PanterRoles.normalize(value) : value;
}

function staffAvatar(member) {
    return member.avatarUrl || member.avatarImg || member.discordAvatarUrl || member.photoURL || 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function renderStaffAdminList() {
    const list = document.getElementById('staffAdminList');
    if (!list) return;

    if (!staffMembersCache.length) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-state-icon"><i class="fa-solid fa-users" aria-hidden="true"></i></div>
                <div class="empty-state-text">Aún no hay miembros en la colección <code>equipo</code>. Selecciona un usuario o crea el primero con el formulario de arriba.</div>
            </div>`;
        return;
    }

    list.innerHTML = staffMembersCache.map(member => {
        const R = window.PanterRoles;
        const role = R ? R.normalize(member.role) : (member.role || 'usuario');
        const roleDef = R ? R.get(role) : null;
        const badge = R ? R.badgeHtml(role) : staffEscape(staffRoleLabel(role));
        const name = member.nombre || member.displayName || member.username || 'Miembro';
        const username = member.username ? `@${member.username}` : (member.discordId ? `ID ${member.discordId}` : (member.email || roleDef?.label || role));
        const specialty = member.especialidad || member.staffSpecialty || 'Sin especialidad';

        return `
        <div class="ps-admin-staff-card" data-staff-row="${staffEscape(member.uid)}" data-local="${member.localOnly ? 'true' : 'false'}">
            <div class="ps-admin-staff-head">
                <img src="${staffEscape(staffAvatar(member))}" alt="Avatar de ${staffEscape(name)}" loading="lazy" onerror="this.style.visibility='hidden'">
                <div>
                    <strong>${staffEscape(name)}</strong>
                    <small>${staffEscape(username)}</small>
                </div>
            </div>
            <div>
                ${badge}
                ${member.localOnly ? '<span class="ps-admin-local-pill"><i class="fa-solid fa-hard-drive" aria-hidden="true"></i> Local</span>' : ''}
            </div>
            <div class="ps-staff-card-meta">
                <small><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i> ${staffEscape(specialty)}</small>
                <small><i class="fa-solid fa-ranking-star" aria-hidden="true"></i> Orden ${Number(member.orden || 999)}</small>
            </div>
            <div class="ps-admin-staff-actions">
                <button type="button" class="btn" data-staff-action="edit"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button>
                <button type="button" class="btn" data-staff-action="delete"><i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar</button>
            </div>
        </div>`;
    }).join('');
}

function staffMemberDirectoryLabel(item) {
    const name = item.nombre || item.username || item.email || item.uid;
    const detail = item.email || item.username || (item.discordId ? `ID ${item.discordId}` : '');
    return detail && detail !== name ? `${name} — ${detail}` : String(name || item.uid);
}

function populateStaffUserPicker() {
    const select = document.getElementById('staffUserPicker');
    if (!select) return;
    const current = select.value;
    const rows = staffDirectoryCache.slice().sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
    );
    const options = ['<option value="">— Nuevo miembro manual —</option>'];
    rows.forEach(item => {
        const inTeam = staffMembersCache.some(member => String(member.uid) === String(item.uid));
        options.push(`<option value="${staffEscape(item.uid)}">${staffEscape(staffMemberDirectoryLabel(item))}${inTeam ? ' · En equipo' : ''}</option>`);
    });
    select.innerHTML = options.join('');
    if (current && rows.some(item => String(item.uid) === String(current))) {
        select.value = current;
    }
}

async function loadStaffDirectory(force) {
    if (staffDirectoryLoaded && !force) {
        populateStaffUserPicker();
        return staffDirectoryCache;
    }
    if (!window.db || !window.collection || !window.getDocs) return staffDirectoryCache;

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        staffDirectoryCache = snap.docs.map(docSnap => {
            const data = docSnap.data() || {};
            if (data.eliminado === true) return null;
            const uid = docSnap.id;
            const discordId = String(
                data.discordId || data.discord_id || (String(uid).startsWith('discord_') ? String(uid).slice(8) : '')
            ).replace(/\D/g, '');
            return {
                uid,
                discordId,
                nombre: String(data.nombre || data.displayName || data.username || data.nombre_usuario || data.email || uid),
                username: String(data.username || ''),
                email: String(data.email || '').trim().toLowerCase(),
                avatarUrl: String(data.avatarUrl || data.photoURL || data.avatarImg || ''),
                role: normalizeRole(data.role),
                estado: String(data.estado || 'online')
            };
        }).filter(Boolean);
        staffDirectoryLoaded = true;
        populateStaffUserPicker();
    } catch (error) {
        console.warn('No se pudo cargar el directorio de usuarios:', error);
    }

    return staffDirectoryCache;
}

function loadDirectoryUserIntoForm(uid) {
    const item = staffDirectoryCache.find(entry => String(entry.uid) === String(uid));
    if (!item) {
        staffSetMessage('No se encontró el usuario seleccionado. Actualiza el directorio.', 'warning');
        return;
    }
    fillStaffForm({
        uid: item.uid,
        nombre: item.nombre,
        username: item.username,
        avatarUrl: item.avatarUrl,
        role: item.role,
        estado: item.estado,
        orden: 999,
        especialidad: '',
        descripcion: ''
    });
    staffSetMessage(`Usuario cargado: ${item.nombre}. Completa el rango y guarda.`, 'info');
}

async function loadStaffMembers() {
    const list = document.getElementById('staffAdminList');
    populateStaffRoleSelect();
    if (!list) return;

    list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon"><i class="fa-solid fa-circle-notch fa-spin"></i></div><div class="empty-state-text">Cargando personal...</div></div>`;

    const hidden = staffReadHidden();
    const localMembers = staffReadLocal().filter((member) => !hidden.has(String(member.uid)));
    let remoteMembers = [];
    let remoteError = null;

    await loadStaffDirectory();

    if (window.db && window.collection && window.getDocs) {
        try {
            const snap = await window.getDocs(window.collection(window.db, STAFF_COLLECTION));
            remoteMembers = snap.docs
                .map(docSnap => Object.assign({ uid: docSnap.id }, docSnap.data() || {}))
                .filter(member => member && !member.archivado && (member.nombre || member.displayName || member.username))
                .filter(member => !hidden.has(String(member.uid)));
        } catch (error) {
            remoteError = error;
        }
    } else {
        remoteError = new Error('Firestore no disponible');
    }

    const merged = new Map();
    remoteMembers.forEach((member) => merged.set(String(member.uid), member));
    localMembers.forEach((member) => merged.set(String(member.uid), Object.assign({}, member)));

    staffMembersCache = Array.from(merged.values()).sort((a, b) => {
        const rankA = window.PanterRoles ? window.PanterRoles.rank(a.role) : 0;
        const rankB = window.PanterRoles ? window.PanterRoles.rank(b.role) : 0;
        if (rankA !== rankB) return rankB - rankA;
        return Number(a.orden || 999) - Number(b.orden || 999);
    });

    // El rango lo dicta la fuente ÚNICA compartida. Si existen fichas
    // duplicadas antiguas de la misma persona, todas muestran el MISMO
    // rango que ven foro, soporte, perfil y personal (no se borra nada).
    if (window.PanterStaff && typeof window.PanterStaff.findFor === 'function') {
        staffMembersCache.forEach(member => {
            const shared = window.PanterStaff.findFor({
                uid: member.uid, email: member.email,
                nombre: member.nombre || member.displayName || member.username
            });
            const role = window.PanterStaff.memberRole(shared);
            if (role) member.role = role;
        });
    }

    renderStaffAdminList();
    populateStaffUserPicker();

    if (remoteError && localMembers.length) {
        staffSetMessage(`Mostrando ${localMembers.length} miembro${localMembers.length === 1 ? '' : 's'} guardado${localMembers.length === 1 ? '' : 's'} en este navegador.`, 'info');
    }
}

function fillStaffForm(member) {
    if (!member) return;
    editingStaffUid = member.uid;
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) el.value = value;
    };
    const uidInput = document.getElementById('staffFieldUid');
    if (uidInput) {
        const discordId = String(
            member.discordId || (String(member.uid || '').startsWith('discord_') ? String(member.uid).slice(8) : member.uid || '')
        ).trim();
        uidInput.value = discordId;
        uidInput.readOnly = true;
    }
    setValue('staffFieldNombre', member.nombre || member.displayName || '');
    setValue('staffFieldUsername', member.username || '');
    setValue('staffFieldAvatar', staffAvatar(member));
    const roleValue = window.PanterRoles ? window.PanterRoles.normalize(member.role) : (member.role || 'usuario');
    populateStaffRoleSelect(roleValue);
    setValue('staffFieldRole', roleValue);
    setValue('staffFieldEspecialidad', member.especialidad || member.staffSpecialty || '');
    setValue('staffFieldDescripcion', member.descripcion || member.staffDescription || '');
    setValue('staffFieldEstado', ['online', 'idle', 'dnd', 'offline'].includes(member.estado) ? member.estado : 'online');
    setValue('staffFieldOrden', member.orden || '');
    const picker = document.getElementById('staffUserPicker');
    if (picker && member.uid) picker.value = member.uid;
    staffSetMessage(`Editando a ${member.nombre || member.displayName || member.uid}.`, false);
    document.getElementById('staffForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetStaffForm(clearMessage = true) {
    editingStaffUid = null;
    const form = document.getElementById('staffForm');
    if (form) form.reset();
    const uidInput = document.getElementById('staffFieldUid');
    if (uidInput) uidInput.readOnly = false;
    populateStaffRoleSelect('usuario');
    const roleSelect = document.getElementById('staffFieldRole');
    if (roleSelect) roleSelect.value = 'usuario';
    const estado = document.getElementById('staffFieldEstado');
    if (estado) estado.value = 'online';
    const picker = document.getElementById('staffUserPicker');
    if (picker) picker.value = '';
    if (clearMessage) staffSetMessage('', false);
}

function staffSlug(value) {
    const base = String(value || '').trim().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return base || `miembro_${Date.now()}`;
}

const STAFF_LOCAL_KEY = 'ps_staff_local';
const STAFF_HIDDEN_KEY = 'ps_staff_hidden';

function staffReadLocal() {
    try {
        const raw = localStorage.getItem(STAFF_LOCAL_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter((item) => item && item.uid) : [];
    } catch (e) {
        return [];
    }
}

function staffWriteLocal(list) {
    try {
        localStorage.setItem(STAFF_LOCAL_KEY, JSON.stringify(Array.isArray(list) ? list : []));
        // Avisa a la fuente compartida: el evento `storage` NO se dispara
        // en la misma pestaña, así que sin esto el foro / soporte / navbar
        // no se enterarían de un cambio de rango hecho aquí mismo.
        document.dispatchEvent(new CustomEvent('panter:staff-changed'));
    } catch (e) {
        console.warn('No se pudo guardar el personal local:', e);
    }
}

function staffUpsertLocal(record) {
    if (!record || !record.uid) return;
    const list = staffReadLocal().filter((item) => String(item.uid) !== String(record.uid));
    list.push(Object.assign({}, record, { localOnly: true, pendienteSincronizar: true }));
    staffWriteLocal(list);
    staffUnhideUid(record.uid);
}

function staffRemoveLocal(uid) {
    const list = staffReadLocal().filter((item) => String(item.uid) !== String(uid));
    staffWriteLocal(list);
}

function staffReadHidden() {
    try {
        const raw = localStorage.getItem(STAFF_HIDDEN_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(list) ? list.map(String) : []);
    } catch (e) {
        return new Set();
    }
}

function staffHideUid(uid) {
    const hidden = staffReadHidden();
    hidden.add(String(uid));
    try {
        localStorage.setItem(STAFF_HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
    } catch (e) {
        console.warn('No se pudo registrar el borrado local:', e);
    }
}

function staffUnhideUid(uid) {
    const hidden = staffReadHidden();
    if (!hidden.has(String(uid))) return;
    hidden.delete(String(uid));
    try {
        localStorage.setItem(STAFF_HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
    } catch (e) { /* ignore */ }
}

function staffNormalizeRoleValue(value) {
    const raw = String(value || '').trim().toLowerCase();
    const normalized = window.PanterRoles ? window.PanterRoles.normalize(raw) : raw;
    if (window.PanterRoles) {
        return window.PanterRoles.ROLE_DEFS[normalized] ? normalized : 'usuario';
    }
    return STAFF_FALLBACK_ROLES.includes(normalized) ? normalized : 'usuario';
}

/**
 * Normaliza los datos del formulario a un esquema tipado y sin `undefined`.
 * `nombre` es obligatorio (1..80) y `role` pertenece a la lista cerrada de
 * la regla de Firestore. Los campos opcionales vacíos se omiten.
 */
function buildStaffPayload(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const nombre = String(source.nombre == null ? '' : source.nombre).trim().replace(/\s+/g, ' ').slice(0, 80);
    const role = staffNormalizeRoleValue(source.role || source.rol || 'usuario');

    const rawOrder = source.orden;
    const orderNumber = (rawOrder === '' || rawOrder === null || rawOrder === undefined) ? NaN : Number(rawOrder);
    const orden = Number.isFinite(orderNumber) ? Math.min(9999, Math.max(0, Math.trunc(orderNumber))) : 999;

    const payload = {
        nombre,
        role,
        rol: role,
        estado: ['online', 'idle', 'dnd', 'offline'].includes(source.estado) ? source.estado : 'online',
        orden
    };

    const username = String(source.username == null ? '' : source.username).trim().slice(0, 60);
    if (username) payload.username = username;

    const especialidad = String(source.especialidad == null ? '' : source.especialidad).trim().slice(0, 80);
    if (especialidad) payload.especialidad = especialidad;

    const descripcion = String(source.descripcion == null ? '' : source.descripcion).trim().slice(0, 1200);
    if (descripcion) payload.descripcion = descripcion;

    const avatarUrl = String(source.avatarUrl == null ? '' : source.avatarUrl).trim().slice(0, 500);
    if (/^https?:\/\//i.test(avatarUrl)) payload.avatarUrl = avatarUrl;

    const rawUid = String(source.uid == null ? '' : source.uid).trim();
    const explicitDiscord = String(source.discordId == null ? '' : source.discordId).trim();
    let discordId = '';
    if (/^\d{5,25}$/.test(explicitDiscord)) {
        discordId = explicitDiscord;
    } else if (rawUid.startsWith('discord_')) {
        const derived = rawUid.slice('discord_'.length);
        if (/^\d{5,25}$/.test(derived)) discordId = derived;
    }
    if (discordId) payload.discordId = discordId;

    return payload;
}

async function persistStaffMember(uid, payload) {
    const now = new Date().toISOString();
    const record = Object.assign({ uid }, payload, {
        actualizadoEn: now,
        actualizadoPor: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
    });

    // Espejo local SIEMPRE: así la página pública `personal.html` ve el
    // cambio al instante, incluso si las reglas de Firestore aún no están
    // publicadas o la nube rechaza la escritura.
    mirrorStaffLocal(record);
    staffUnhideUid(uid);

    if (!window.db || !window.fsDoc || !window.setDoc) {
        return { record, local: true, error: new Error('Firestore no disponible') };
    }

    try {
        await window.setDoc(window.fsDoc(window.db, STAFF_COLLECTION, uid), record, { merge: true });
    } catch (error) {
        console.warn('[Personal] Guardado en copia local (Firestore rechazó):', error);
        return { record, local: true, error };
    }

    // Refleja los rangos del equipo en perfiles existentes, sin crear perfiles parciales.
    if (window.getDoc && window.setDoc && payload.role) {
        try {
            const profileRef = window.fsDoc(window.db, 'conductores', uid);
            const profileSnap = await window.getDoc(profileRef);
            if (profileSnap.exists()) {
                const profileUpdate = {
                    role: payload.role,
                    roleEquipo: payload.role,
                    actualizadoEn: now
                };
                if (String(uid).startsWith('discord_')) {
                    profileUpdate.staffSpecialty = payload.especialidad || '';
                    profileUpdate.staffDescription = payload.descripcion || '';
                }
                await window.setDoc(profileRef, profileUpdate, { merge: true });
            }
        } catch (error) {
            console.warn('No se pudo reflejar el rango en el perfil del miembro:', error);
        }
    }

    return { record, local: false, error: null };
}

function staffUidFromInput(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (/^\d{5,25}$/.test(raw)) return `discord_${raw}`;
    return raw;
}

async function saveStaffFromForm() {
    const nombreInput = document.getElementById('staffFieldNombre');
    const nombreRaw = String(nombreInput?.value || '').trim();
    const uidInput = document.getElementById('staffFieldUid');

    let uid = String(editingStaffUid || '').trim();
    if (!uid) uid = staffUidFromInput(uidInput?.value);
    if (uid && (uid.includes('/') || uid.length > 120)) {
        staffSetMessage('El UID no es válido: no puede contener "/" ni superar 120 caracteres.', 'error');
        uidInput?.focus();
        return;
    }
    if (!uid) {
        const base = `team_${staffSlug(nombreRaw || 'miembro')}`;
        const alreadyExists = staffMembersCache.some((item) => String(item.uid) === base)
            || staffReadLocal().some((item) => String(item.uid) === base);
        uid = alreadyExists ? `${base}_${Date.now().toString(36).slice(-4)}` : base;
    }

    const payload = buildStaffPayload({
        uid,
        nombre: nombreRaw,
        username: document.getElementById('staffFieldUsername')?.value || '',
        avatarUrl: document.getElementById('staffFieldAvatar')?.value || '',
        role: document.getElementById('staffFieldRole')?.value || 'usuario',
        especialidad: document.getElementById('staffFieldEspecialidad')?.value || '',
        descripcion: document.getElementById('staffFieldDescripcion')?.value || '',
        estado: document.getElementById('staffFieldEstado')?.value || 'online',
        orden: document.getElementById('staffFieldOrden')?.value
    });

    if (!payload.nombre) {
        staffSetMessage('El nombre visible es obligatorio.', 'error');
        nombreInput?.focus();
        return;
    }

    const saveBtn = document.getElementById('staffSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Guardando...';
    }

    try {
        const result = await persistStaffMember(uid, payload);
        resetStaffForm(false);
        await loadStaffMembers();
        if (result.local) {
            staffSetMessage(`"${payload.nombre}" guardado en este navegador. Ya aparece en la página Personal.`, 'success');
        } else {
            staffSetMessage(`Miembro "${payload.nombre}" guardado correctamente.`, 'success');
        }
    } catch (error) {
        console.error('No se pudo guardar el miembro:', error);
        const detail = describeFirestoreFailure(error);
        staffSetMessage(`No se pudo guardar. ${detail.text}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar';
        }
    }
}

async function deleteStaffMember(uid) {
    let remoteError = null;

    if (window.db && window.fsDoc && window.setDoc) {
        try {
            // Borrado lógico: conserva el documento para auditoría y evita
            // depender de permisos de delete desde sesiones Discord.
            await window.setDoc(window.fsDoc(window.db, STAFF_COLLECTION, uid), {
                archivado: true,
                actualizadoEn: new Date().toISOString(),
                actualizadoPor: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
            }, { merge: true });
            staffRemoveLocal(uid);
            staffUnhideUid(uid);
            return { local: false, error: null };
        } catch (error) {
            remoteError = error;
        }
    } else {
        remoteError = new Error('Firestore no disponible');
    }

    // Firestore rechazó el borrado: se oculta y elimina del almacenamiento local
    // para que la acción tenga efecto en este navegador.
    staffRemoveLocal(uid);
    staffHideUid(uid);
    return { local: true, error: remoteError };
}

async function handleStaffListClick(event) {
    const actionBtn = event.target.closest('[data-staff-action]');
    const card = event.target.closest('[data-staff-row]');
    if (!card) return;
    const uid = card.dataset.staffRow;
    const member = staffMembersCache.find(item => String(item.uid) === String(uid));
    if (!member) return;

    if (!actionBtn) return;
    const action = actionBtn.dataset.staffAction;

    if (action === 'edit') {
        fillStaffForm(member);
        return;
    }

    if (action === 'delete') {
        if (!window.confirm(`¿Eliminar a ${member.nombre || member.displayName || uid} del equipo?`)) return;
        actionBtn.disabled = true;
        try {
            const result = await deleteStaffMember(uid);
            await loadStaffMembers();
            if (result.local) {
                const detail = describeFirestoreFailure(result.error);
                staffSetMessage(`Miembro oculto en este navegador. ${detail.text}`, 'warning');
            } else {
                staffSetMessage('Miembro eliminado del equipo.', 'success');
            }
        } catch (error) {
            console.error('No se pudo eliminar el miembro:', error);
            const detail = describeFirestoreFailure(error);
            staffSetMessage(`No se pudo eliminar. ${detail.text}`, 'error');
        } finally {
            actionBtn.disabled = false;
        }
    }
}

// ---------- Gestor de roles y colores ----------

const ROLE_PERMISSION_LABELS = {
    team: 'Personal',
    ticketStaff: 'Tickets',
    adminPanel: 'Panel admin',
    manageTeam: 'Gestionar equipo'
};

function roleContrastColor(hex) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return '#ffffff';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const luz = 0.299 * r + 0.587 * g + 0.114 * b;
    return luz > 165 ? '#0b0f17' : '#ffffff';
}

function roleManagerSetMessage(text, tone = 'info') {
    const el = document.getElementById('roleEditorMsg');
    if (!el) return;
    const colors = { info: '#7dd3fc', success: '#86efac', warning: '#fbbf24', error: '#fca5a5' };
    el.textContent = text || '';
    el.style.color = colors[tone] || colors.info;
}

function getRoleManagerRoles() {
    const R = window.PanterRoles;
    if (!R) return [];
    const config = R.getRoleConfig();
    return (config.roles || []).slice().sort((a, b) => {
        const byRank = Number(b.rank || 0) - Number(a.rank || 0);
        if (byRank !== 0) return byRank;
        return String(a.label || a.id).localeCompare(String(b.label || b.id), 'es');
    });
}

function renderRoleManagerList() {
    const list = document.getElementById('roleManagerList');
    if (!list) return;
    const R = window.PanterRoles;
    if (!R) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">El módulo de roles no está disponible.</div></div>';
        return;
    }

    const roles = getRoleManagerRoles();
    if (!roles.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-text">No hay roles configurados.</div></div>';
        return;
    }

    list.innerHTML = roles.map(role => {
        const permissions = R.rolePermissions(role);
        const activePerms = Object.keys(ROLE_PERMISSION_LABELS)
            .filter(key => permissions[key] === true)
            .map(key => `<span class="ps-role-perm active">${ROLE_PERMISSION_LABELS[key]}</span>`)
            .join('');
        const noPerms = '<span class="ps-role-perm">Sin permisos</span>';
        const usedBy = staffMembersCache.filter(member => R.normalize(member.role) === role.id).length;

        return `
        <div class="ps-role-item${role.custom ? ' is-custom' : ''}" data-role-id="${staffEscape(role.id)}" style="--ps-role-item-color:${staffEscape(role.color)};">
            <span class="ps-role-swatch" style="background:${staffEscape(role.color)};color:${roleContrastColor(role.color)};">
                <i class="${staffEscape(role.icon || 'fa-solid fa-user')}" aria-hidden="true"></i>
            </span>
            <div class="ps-role-item-info">
                <strong>
                    ${staffEscape(role.label || role.id)}
                    <span class="ps-role-item-rank">prioridad ${Number(role.rank || 0)}</span>
                    ${role.custom ? '<span class="ps-role-custom-pill">Personalizado</span>' : ''}
                </strong>
                <small>${staffEscape(role.description || role.id)}${usedBy ? ` · ${usedBy} miembro${usedBy === 1 ? '' : 's'}` : ''}</small>
                <div class="ps-role-item-perms">${activePerms || noPerms}</div>
            </div>
            <div class="ps-role-item-actions">
                <button type="button" class="btn" data-role-edit="${staffEscape(role.id)}">
                    <i class="fa-solid fa-pen" aria-hidden="true"></i> Editar
                </button>
                <button type="button" class="btn" data-role-duplicate="${staffEscape(role.id)}">
                    <i class="fa-solid fa-clone" aria-hidden="true"></i> Duplicar
                </button>
            </div>
        </div>`;
    }).join('');
}

function setRoleEditorField(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value == null ? '' : value;
}

function openRoleEditor(roleId, template) {
    const R = window.PanterRoles;
    if (!R) return;
    const roles = getRoleManagerRoles();
    const role = roleId ? (roles.find(item => item.id === roleId) || R.ROLE_DEFS[roleId]) : null;
    const source = role || template || null;
    const isEditing = Boolean(role);
    const isDuplicate = !isEditing && Boolean(template);

    const id = isEditing ? String(role.id) : '';
    const label = source
        ? (isDuplicate ? `${source.label} (copia)` : source.label)
        : '';
    const shortLabel = source ? (isDuplicate ? `${source.shortLabel || source.label} copia` : (source.shortLabel || '')) : '';
    let keyId = '';
    if (isEditing) {
        keyId = String(role.id);
    } else if (isDuplicate) {
        const baseKey = R.roleSlug(`${source.id}_copia`) || 'rol_copia';
        keyId = baseKey;
        let suffix = 2;
        while (R.ROLE_DEFS[keyId]) {
            keyId = `${baseKey.slice(0, 36)}_${suffix}`;
            suffix += 1;
        }
    }
    const color = (source && source.color) || '#0055ff';
    const fixedColor = Boolean(isEditing && !role.custom);
    const permissions = source
        ? R.rolePermissions(source)
        : { team: true, ticketStaff: false, adminPanel: false, manageTeam: false };

    setRoleEditorField('roleEditorId', id);
    setRoleEditorField('roleEditorLabel', label);
    setRoleEditorField('roleEditorShort', shortLabel);
    setRoleEditorField('roleEditorKey', keyId);
    setRoleEditorField('roleEditorColor', color);
    setRoleEditorField('roleEditorColorHex', color);
    const colorPicker = document.getElementById('roleEditorColor');
    const colorHex = document.getElementById('roleEditorColorHex');
    if (colorPicker) colorPicker.disabled = fixedColor;
    if (colorHex) colorHex.disabled = fixedColor;
    const rankInput = document.getElementById('roleEditorRank');
    if (rankInput) rankInput.disabled = fixedColor;
    setRoleEditorField('roleEditorIcon', (source && source.icon) || 'fa-solid fa-user');
    setRoleEditorField('roleEditorRank', source ? Number(source.rank || 20) : 20);
    setRoleEditorField('roleEditorDescription', (source && source.description) || '');
    setRoleEditorField('rolePermTeam', permissions.team);
    setRoleEditorField('rolePermTicketStaff', permissions.ticketStaff);
    setRoleEditorField('rolePermAdminPanel', permissions.adminPanel);
    setRoleEditorField('rolePermManageTeam', permissions.manageTeam);

    const keyInput = document.getElementById('roleEditorKey');
    if (keyInput) keyInput.disabled = isEditing || isDuplicate;

    const deleteBtn = document.getElementById('roleEditorDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = !isEditing || !role.custom;
        deleteBtn.title = isEditing && !role.custom
            ? 'Los roles base solo se pueden editar; crea uno personalizado si necesitas otro rango.'
            : '';
    }

    const saveBtn = document.getElementById('roleEditorSaveBtn');
    if (saveBtn) {
        saveBtn.innerHTML = isEditing
            ? '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar cambios'
            : '<i class="fa-solid fa-plus" aria-hidden="true"></i> Crear rol';
    }

    const heading = isEditing
        ? `Editando “${role.label}”.${fixedColor ? ' Su color y posición jerárquica son fijos.' : ''}`
        : (isDuplicate ? 'Duplicando rol. Ajusta los datos y crea el nuevo rango.' : 'Nuevo rol. Define nombre, color y permisos.');
    roleManagerSetMessage(heading, 'info');
    const pane = document.getElementById('tab-staff');
    if (pane && pane.classList.contains('active')) {
        document.getElementById('roleEditorForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function collectRoleDraft() {
    const R = window.PanterRoles;
    if (!R) throw new Error('Módulo de roles no disponible.');

    const label = String(document.getElementById('roleEditorLabel')?.value || '').trim().slice(0, 48);
    if (!label) throw new Error('El nombre visible del rol es obligatorio.');

    const shortLabel = String(document.getElementById('roleEditorShort')?.value || '').trim().slice(0, 24) || label;
    const keyValue = String(document.getElementById('roleEditorKey')?.value || '').trim();
    const editId = String(document.getElementById('roleEditorId')?.value || '').trim();
    const id = R.roleSlug(editId || keyValue || label);
    if (!id) throw new Error('El identificador del rol no es válido.');

    if (!editId && R.ROLE_DEFS[id]) {
        throw new Error(`Ya existe un rol con el identificador “${id}”. Elige otro.`);
    }

    const color = R.ROLE_COLORS[id]
        || R.normalizeHexColor(document.getElementById('roleEditorColorHex')?.value)
        || R.normalizeHexColor(document.getElementById('roleEditorColor')?.value)
        || '#94a3b8';

    const rankValue = Number(document.getElementById('roleEditorRank')?.value);
    const rank = Number.isFinite(rankValue) ? Math.max(0, Math.min(1000, Math.trunc(rankValue))) : 20;

    return {
        id,
        label,
        shortLabel,
        rank,
        color,
        icon: String(document.getElementById('roleEditorIcon')?.value || 'fa-solid fa-user').trim().slice(0, 80),
        description: String(document.getElementById('roleEditorDescription')?.value || '').trim().slice(0, 240),
        permissions: {
            team: Boolean(document.getElementById('rolePermTeam')?.checked),
            ticketStaff: Boolean(document.getElementById('rolePermTicketStaff')?.checked),
            adminPanel: Boolean(document.getElementById('rolePermAdminPanel')?.checked),
            manageTeam: Boolean(document.getElementById('rolePermManageTeam')?.checked)
        }
    };
}

async function saveRoleFromEditor() {
    const R = window.PanterRoles;
    if (!R) {
        roleManagerSetMessage('El módulo de roles no está disponible.', 'error');
        return;
    }

    let draft;
    try {
        draft = collectRoleDraft();
    } catch (error) {
        roleManagerSetMessage(error.message, 'error');
        return;
    }

    const saveBtn = document.getElementById('roleEditorSaveBtn');
    if (saveBtn) saveBtn.disabled = true;
    roleManagerSetMessage('Guardando rol y sincronizando Discord…', 'info');

    try {
        const config = R.getRoleConfig();
        const roles = (config.roles || []).slice();
        const index = roles.findIndex(role => role.id === draft.id);
        if (index >= 0) roles[index] = draft;
        else roles.push(draft);

        let syncWarning = '';
        try {
            await R.saveRoleConfig({
                roles,
                updatedBy: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
            });
        } catch (error) {
            console.error('No se pudo guardar roles_config en Firestore:', error);
            syncWarning = ' El cambio quedó aplicado en este navegador, pero Firestore lo rechazó. Revisa las reglas de roles_config.';
        }

        refreshRoleUI();
        openRoleEditor(draft.id);
        roleManagerSetMessage(
            `Rol “${draft.label}” guardado. La página Personal y las insignias de tickets usarán este color.${syncWarning}`,
            syncWarning ? 'warning' : 'success'
        );
    } catch (error) {
        console.error('No se pudo guardar el rol:', error);
        roleManagerSetMessage(`No se pudo guardar el rol. ${describeFirestoreFailure(error).text}`, 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function deleteRoleFromEditor() {
    const R = window.PanterRoles;
    if (!R) return;
    const id = String(document.getElementById('roleEditorId')?.value || '').trim();
    if (!id) {
        roleManagerSetMessage('Selecciona un rol personalizado para eliminarlo.', 'warning');
        return;
    }
    const role = R.ROLE_DEFS[id];
    if (!role || !role.custom) {
        roleManagerSetMessage('Los roles base no se pueden eliminar. Puedes editar su color, nombre o permisos.', 'warning');
        return;
    }
    if (!window.confirm(`¿Eliminar el rol “${role.label}”? Los miembros que lo tengan pasarán a Usuario.`)) return;

    const deleteBtn = document.getElementById('roleEditorDeleteBtn');
    if (deleteBtn) deleteBtn.disabled = true;

    try {
        const config = R.getRoleConfig();
        const roles = (config.roles || []).filter(item => item.id !== id);
        let syncWarning = '';
        try {
            await R.saveRoleConfig({
                roles,
                updatedBy: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
            });
        } catch (error) {
            console.error('No se pudo eliminar el rol de Firestore:', error);
            syncWarning = ' Firestore lo rechazó; el cambio solo se aplicó en este navegador.';
        }
        refreshRoleUI();
        openRoleEditor(null);
        roleManagerSetMessage(`Rol eliminado.${syncWarning}`, syncWarning ? 'warning' : 'success');
    } catch (error) {
        console.error('No se pudo eliminar el rol:', error);
        roleManagerSetMessage(`No se pudo eliminar el rol. ${describeFirestoreFailure(error).text}`, 'error');
    } finally {
        if (deleteBtn) deleteBtn.disabled = false;
    }
}

async function restoreOfficialRolePalette() {
    const R = window.PanterRoles;
    if (!R) return;
    if (!window.confirm('¿Restaurar los colores oficiales de los rangos base? Los roles personalizados conservarán su color.')) return;

    const btn = document.getElementById('roleManagerResetBtn');
    if (btn) btn.disabled = true;
    try {
        const config = R.getRoleConfig();
        const roles = (config.roles || []).map(role => {
            const official = R.OFFICIAL_ROLE_COLORS[role.id];
            if (!official) return role;
            return Object.assign({}, role, {
                color: official,
                bg: R.hexToRgba(official, 0.12),
                border: R.hexToRgba(official, 0.35)
            });
        });

        let syncWarning = '';
        try {
            await R.saveRoleConfig({
                roles,
                updatedBy: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
            });
        } catch (error) {
            console.error('No se pudo restaurar la paleta en Firestore:', error);
            syncWarning = ' Firestore lo rechazó; la paleta solo se aplicó en este navegador.';
        }

        refreshRoleUI();
        openRoleEditor(null);
        roleManagerSetMessage(`Paleta oficial restaurada.${syncWarning}`, syncWarning ? 'warning' : 'success');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function refreshRoleUI() {
    const currentRole = document.getElementById('staffFieldRole')?.value || 'usuario';
    populateStaffRoleSelect(currentRole);
    renderStaffAdminList();
    renderRoleManagerList();
}

function bindRoleManager() {
    const R = window.PanterRoles;
    if (!R) return;

    document.getElementById('roleManagerList')?.addEventListener('click', (event) => {
        const editBtn = event.target.closest('[data-role-edit]');
        if (editBtn) {
            openRoleEditor(editBtn.getAttribute('data-role-edit'));
            return;
        }
        const duplicateBtn = event.target.closest('[data-role-duplicate]');
        if (duplicateBtn) {
            const id = duplicateBtn.getAttribute('data-role-duplicate');
            const source = R.ROLE_DEFS[id];
            if (source) openRoleEditor(null, source);
        }
    });

    document.getElementById('roleEditorSaveBtn')?.addEventListener('click', saveRoleFromEditor);
    document.getElementById('roleEditorDeleteBtn')?.addEventListener('click', deleteRoleFromEditor);
    document.getElementById('roleEditorNewBtn')?.addEventListener('click', () => openRoleEditor(null));
    document.getElementById('roleManagerResetBtn')?.addEventListener('click', restoreOfficialRolePalette);

    const colorInput = document.getElementById('roleEditorColor');
    const hexInput = document.getElementById('roleEditorColorHex');
    colorInput?.addEventListener('input', () => {
        if (hexInput) hexInput.value = String(colorInput.value || '').toLowerCase();
    });
    hexInput?.addEventListener('input', () => {
        const color = R.normalizeHexColor(hexInput.value);
        if (color && colorInput) colorInput.value = color;
    });

    document.addEventListener('panter:roles-config', () => {
        if (!document.getElementById('roleManagerList')) return;
        renderRoleManagerList();
        const roleValue = document.getElementById('staffFieldRole')?.value || 'usuario';
        populateStaffRoleSelect(roleValue);
        const R = window.PanterRoles;
        staffMembersCache.sort((a, b) => {
            const rankA = R ? R.rank(a.role) : 0;
            const rankB = R ? R.rank(b.role) : 0;
            if (rankA !== rankB) return rankB - rankA;
            return Number(a.orden || 999) - Number(b.orden || 999);
        });
        renderStaffAdminList();
    });

    renderRoleManagerList();
    openRoleEditor(null);
}

// ---------- Servidor oficial de Discord (sólo compuerta de acceso) ----------
// El mapeo Discord → rangos web quedó eliminado: aquí sólo se configura el
// guild contra el que se valida la membresía.

async function loadDiscordRoleMapping() {
    if (!window.PanterRoles) {
        staffDiscordSetMessage('El módulo de roles aún no está disponible.', true);
        return;
    }

    staffDiscordSetMessage('Cargando servidor...', false);
    try {
        const cfg = await window.PanterRoles.loadDiscordConfig(true);
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        setValue('discordGuildId', cfg.guildId || '');
        setValue('discordGuildName', cfg.guildName || '');
        staffDiscordSetMessage('Servidor cargado. Los rangos se gestionan en Personal.', false);
    } catch (error) {
        console.error('No se pudo cargar la configuración del guild:', error);
        staffDiscordSetMessage('No se pudo cargar el servidor desde Firestore.', true);
    }
}

async function saveDiscordRoleMapping() {
    if (!window.PanterRoles) {
        staffDiscordSetMessage('El módulo de roles aún no está disponible.', true);
        return;
    }

    const guildId = String(document.getElementById('discordGuildId')?.value || '').trim();
    const guildName = String(document.getElementById('discordGuildName')?.value || '').trim() || 'Panter Studio';

    const btn = document.getElementById('discordMapSaveBtn');
    if (btn) btn.disabled = true;
    staffDiscordSetMessage('Guardando servidor...', false);

    try {
        await window.PanterRoles.saveDiscordConfig({ guildId, guildName });
        staffDiscordSetMessage('Servidor guardado. Discord no asigna rangos web.', false);
    } catch (error) {
        console.error('No se pudo guardar la configuración del guild:', error);
        staffDiscordSetMessage('No se pudo guardar el servidor. Revisa las reglas de Firestore.', true);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function bootAuthListener() {
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn && !adminLoginBtn.dataset.bound) {
        adminLoginBtn.dataset.bound = "true";
        adminLoginBtn.addEventListener('click', async () => {
            try {
                if (window.firebaseAuth && window.GoogleAuthProvider && window.signInWithPopup) {
                    const provider = new window.GoogleAuthProvider();
                    await window.signInWithPopup(window.firebaseAuth, provider);
                } else {
                    alert('El servicio de autenticación de Firebase no está listo. Reintenta.');
                }
            } catch (err) {
                console.error(err);
                alert('Error al iniciar sesión: ' + err.message);
            }
        });
    }

    if (!window.firebaseAuth || !window.onAuthStateChanged) {
        showGateError('Inicializando autenticación...');
        return false;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        handleAuthStateChange(user).catch((err) => {
            console.error('Error validando acceso admin:', err);
            if (gateMessage) {
                gateMessage.textContent = 'No se pudo validar tu acceso al panel.';
                gateMessage.style.color = 'red';
            }
        });
    });

    return true;
}

// ═══════════════════════════════════════════════════════════
// ASIGNACIÓN DE PERSONAL POR RANGO
// Un único sitio: cada rango muestra su desplegable de usuarios y
// las personas ya asignadas. Todo se refleja en `personal.html`.
// ═══════════════════════════════════════════════════════════
let assignmentAccounts = [];
let assignmentAccountsBuffer = [];
let assignmentMembers = [];
let assignmentUnsub = null;

/** Escribe SIEMPRE una copia limpia en el espejo local del equipo. */
function mirrorStaffLocal(record) {
    if (!record || !record.uid) return;
    const clean = Object.assign({}, record);
    delete clean.localOnly;
    delete clean.pendienteSincronizar;
    const list = staffReadLocal().filter(item => String(item.uid) !== String(record.uid));
    list.push(clean);
    staffWriteLocal(list);
}

function assignSetMessage(text, tone = 'info') {
    const el = document.getElementById('staffAssignMsg');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = tone === 'error' ? '#fca5a5'
        : tone === 'success' ? '#86efac' : '#7dd3fc';
}

/** Normaliza un nombre para detectar duplicados («Fénix» = «Fenix»). */
function assignmentNameKey(value) {
    return String(value || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Unifica las cuentas por CORREO y por NOMBRE: una misma persona con varios
 * documentos (típicamente 3 «Fénix» con uids distintos) aparece UNA sola vez
 * en el desplegable. Se conserva el registro con más datos (avatar/nombre).
 */
async function loadAssignmentAccounts() {
    const byKey = new Map();

    const addAccount = (uid, nombre, email, avatarUrl) => {
        const cleanUid = String(uid || '').trim();
        const cleanNombre = String(nombre || '').trim() || cleanUid;
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanAvatar = String(avatarUrl || '').trim();
        if (!cleanUid && !cleanEmail) return;

        const candidate = { uid: cleanUid || cleanEmail, nombre: cleanNombre, email: cleanEmail, avatarUrl: cleanAvatar };
        const keys = [];
        if (cleanEmail) keys.push('email:' + cleanEmail);
        const nameKey = assignmentNameKey(cleanNombre);
        if (nameKey) keys.push('name:' + nameKey);
        if (cleanUid) keys.push('uid:' + cleanUid);

        const existingIndex = keys.map(key => byKey.get(key)).find(value => value !== undefined);
        if (existingIndex === undefined) {
            const index = assignmentAccountsBuffer.length;
            assignmentAccountsBuffer.push(candidate);
            keys.forEach(key => byKey.set(key, index));
            return;
        }
        const previous = assignmentAccountsBuffer[existingIndex];
        // Mezcla: conserva el nombre con acentos y el avatar si lo hay.
        if (!previous.avatarUrl && candidate.avatarUrl) previous.avatarUrl = candidate.avatarUrl;
        if (!previous.email && candidate.email) previous.email = candidate.email;
        if (candidate.nombre.length > previous.nombre.length) previous.nombre = candidate.nombre;
        keys.forEach(key => byKey.set(key, existingIndex));
    };

    assignmentAccountsBuffer = [];
    try {
        const docs = await readCollectionSafe('conductores');
        docs.forEach(docSnap => {
            const d = docSnap.data() || {};
            if (d.eliminado === true) return;
            const email = String(d.email || '').trim().toLowerCase();
            const nombre = String(
                d.nombre || d.displayName || d.username || d.nombre_usuario ||
                (email ? email.split('@')[0] : docSnap.id)
            ).trim();
            addAccount(docSnap.id, nombre, email,
                d.avatarUrl || d.avatarImg || d.photoURL || '');
        });
    } catch (e) {
        console.warn('[Personal] No se pudo leer el listado de usuarios:', e);
    }
    // Incluye a quienes ya tienen ficha de equipo aunque no tengan cuenta.
    assignmentMembers.forEach(member => addAccount(
        member.uid,
        member.nombre || member.displayName || member.username || member.uid,
        member.email || '',
        member.avatarUrl || ''
    ));

    assignmentAccounts = assignmentAccountsBuffer.slice()
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

function renderRoleAssignment() {
    const container = document.getElementById('roleAssignmentList');
    if (!container) return;
    const R = window.PanterRoles;
    if (!R) {
        container.innerHTML = '<div class="empty-state">Cargando rangos...</div>';
        return;
    }
    const options = ['<option value="">— Elegir usuario —</option>']
        .concat(assignmentAccounts.map(account =>
            `<option value="${staffEscape(account.uid)}">${staffEscape(account.nombre)}${account.email ? ' · ' + staffEscape(account.email) : ''}</option>`
        )).join('');

    container.innerHTML = R.orderedRoleIds().map(roleId => {
        const def = R.get(roleId);
        const people = assignmentMembers.filter(member => R.normalize(member.role) === roleId);
        const chips = people.length
            ? people.map(member => `
                <span class="ps-assign-chip">
                    ${staffEscape(member.nombre || member.displayName || member.username || member.uid)}
                    <button type="button" data-assign-remove="${staffEscape(member.uid)}" title="Quitar del rango" aria-label="Quitar">×</button>
                </span>`).join('')
            : '<span class="ps-assign-empty">Sin personas asignadas todavía</span>';
        return `
            <section class="ps-assign-role" style="--ps-role-color:${staffEscape(def.color)};">
                <div class="ps-assign-head">
                    <span class="ps-assign-icon"><i class="${staffEscape(def.icon || 'fa-solid fa-user')}" aria-hidden="true"></i></span>
                    <div>
                        <strong>${staffEscape(def.label)}</strong>
                        <small>prioridad ${Number(def.rank || 0)} · ${people.length} persona${people.length === 1 ? '' : 's'}</small>
                    </div>
                </div>
                <div class="ps-assign-controls">
                    <select data-assign-select="${staffEscape(roleId)}" aria-label="Usuarios para ${staffEscape(def.label)}">${options}</select>
                    <button type="button" data-assign-add="${staffEscape(roleId)}">Agregar</button>
                </div>
                <div class="ps-assign-people">${chips}</div>
            </section>`;
    }).join('');
}

async function refreshAssignment() {
    await loadStaffDirectory();
    await loadStaffMembers();

    // Deduplica los miembros por correo/nombre (evita 3 «Fénix» con uids
    // distintos). Se conserva el de mayor rango y el que tenga avatar.
    const seen = new Set();
    const deduped = [];
    staffMembersCache.slice().sort((a, b) => {
        const R = window.PanterRoles;
        const ra = R ? R.rank(a.role) : 0;
        const rb = R ? R.rank(b.role) : 0;
        return rb - ra;
    }).forEach(member => {
        const keys = [];
        const email = String(member.email || '').trim().toLowerCase();
        if (email) keys.push('email:' + email);
        const nameKey = assignmentNameKey(member.nombre || member.displayName || member.username);
        if (nameKey) keys.push('name:' + nameKey);
        if (keys.length && keys.some(key => seen.has(key))) return;
        keys.forEach(key => seen.add(key));
        deduped.push(member);
    });
    assignmentMembers = deduped;

    await loadAssignmentAccounts();
    renderRoleAssignment();
    loadCreatorCodePanel().catch(error => {
        console.warn('[Personal] No se pudo cargar el panel de códigos de creador:', error);
    });
    startAssignmentRealtime();
}

/* ── Códigos de referido de Creadores de Contenido ─────────────
   SÓLO el staff puede crear o cambiar estos códigos. Se guardan en
   `conductores/{uid}` con `referralCodeKind: 'creator'`, que activa
   la recompensa mayor por invitación (Configuración → Economía Web).
   Los usuarios normales reciben un código aleatorio de 8 letras A-Z. */
const CREATOR_CODE_PATTERN = /^(?=.*[A-Z])[A-Z0-9_-]{3,16}$/;
const CREATOR_CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let creatorCodeSettings = { referralCoins: 50, creatorReferralCoins: 100 };

function creatorCodeNormalize(value) {
    return String(value == null ? '' : value).replace(/\s+/g, '').trim().toUpperCase().slice(0, 16);
}

function creatorCodeSetMessage(text, tone = 'info') {
    const el = document.getElementById('creatorCodeMsg');
    if (!el) return;
    const colors = { info: '#7dd3fc', success: '#86efac', warning: '#fbbf24', error: '#fca5a5' };
    el.textContent = text || '';
    el.style.color = colors[tone] || colors.info;
}

function creatorCodeRoleOf(account) {
    const who = {
        uid: account?.uid,
        email: account?.email,
        nombre: account?.nombre || account?.displayName || account?.username
    };
    // Fuente única de rangos: `equipo` (vía PanterStaff). El rol guardado en
    // `conductores` NO otorga rango y no sirve para habilitar este beneficio.
    if (window.PanterStaff && typeof window.PanterStaff.roleForAuthor === 'function') {
        const resolved = window.PanterStaff.roleForAuthor(who);
        if (resolved && resolved !== 'usuario') return resolved;
    }
    // `fromTeam` significa que la ficha viene de la colección `equipo`,
    // la única fuente legítima de rangos.
    return account?.fromTeam ? normalizeRole(account.role || 'usuario') : 'usuario';
}

function creatorCodeIdentityKeys(account) {
    const keys = [];
    const email = String(account?.email || '').trim().toLowerCase();
    if (email) keys.push('email:' + email);
    const nameKey = assignmentNameKey(account?.nombre || account?.displayName || account?.username || '');
    if (nameKey) keys.push('name:' + nameKey);
    if (!keys.length) keys.push('uid:' + String(account?.uid || ''));
    return keys;
}

/**
 * Personas con rango «Creador de Contenido», sin duplicados.
 * Prefiere la cuenta de `conductores` (la que el creador usa al entrar),
 * porque ahí es donde se guarda y se lee su código de referido.
 */
function creatorCodeCandidates() {
    const byKey = new Map();
    const result = [];

    const add = (account) => {
        if (!account || !account.uid) return;
        const keys = creatorCodeIdentityKeys(account);
        const existing = keys.map(key => byKey.get(key)).find(value => value !== undefined);
        if (existing === undefined) {
            const index = result.length;
            result.push(Object.assign({}, account));
            keys.forEach(key => byKey.set(key, index));
            return;
        }
        const previous = result[existing];
        if (!previous.avatarUrl && account.avatarUrl) previous.avatarUrl = account.avatarUrl;
        if (!previous.email && account.email) previous.email = account.email;
        if (!previous.role && account.role) previous.role = account.role;
        if (account.fromTeam) previous.fromTeam = true;
        keys.forEach(key => byKey.set(key, existing));
    };

    assignmentAccounts.forEach(add);
    assignmentMembers.forEach(member => add({
        uid: String(member.uid || ''),
        nombre: member.nombre || member.displayName || member.username || member.uid,
        email: member.email || '',
        avatarUrl: staffAvatar(member),
        role: member.role,
        fromTeam: true
    }));

    return result
        .filter(account => creatorCodeRoleOf(account) === 'creador_contenido')
        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

function creatorCodeRandomLetters(length = 8) {
    let out = '';
    const cryptoObj = window.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const bytes = new Uint32Array(length);
        cryptoObj.getRandomValues(bytes);
        for (let i = 0; i < length; i++) out += CREATOR_CODE_LETTERS[bytes[i] % 26];
        return out;
    }
    for (let i = 0; i < length; i++) {
        out += CREATOR_CODE_LETTERS[Math.floor(Math.random() * CREATOR_CODE_LETTERS.length)];
    }
    return out;
}

async function creatorCodeIsTaken(code, excludeUid = '') {
    const normalized = creatorCodeNormalize(code);
    if (!normalized || !window.db || !window.getDocs || !window.collection) return false;

    try {
        if (window.query && window.where) {
            const [currentSnap, legacySnap] = await Promise.all([
                window.getDocs(window.query(
                    window.collection(window.db, 'conductores'),
                    window.where('referralCode', '==', normalized)
                )).catch(() => null),
                window.getDocs(window.query(
                    window.collection(window.db, 'conductores'),
                    window.where('referralCodeLegacy', 'array-contains', normalized)
                )).catch(() => null)
            ]);
            const docs = []
                .concat(currentSnap ? currentSnap.docs : [])
                .concat(legacySnap ? legacySnap.docs : []);
            if (docs.length) return docs.some(doc => String(doc.id) !== String(excludeUid));
            if (currentSnap || legacySnap) return false;
        }
    } catch (error) {
        console.warn('[Referidos] Consulta de unicidad no disponible:', error);
    }

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        return snap.docs.some(doc => {
            if (String(doc.id) === String(excludeUid)) return false;
            const data = doc.data() || {};
            if (creatorCodeNormalize(data.referralCode) === normalized) return true;
            return Array.isArray(data.referralCodeLegacy)
                && data.referralCodeLegacy.some(legacy => creatorCodeNormalize(legacy) === normalized);
        });
    } catch (error) {
        console.warn('[Referidos] No se pudo comprobar el código:', error);
        return false;
    }
}

async function loadCreatorCodeSettings() {
    try {
        if (!window.db || !window.fsDoc || !window.getDoc) return;
        const snap = await window.getDoc(window.fsDoc(window.db, 'settings', 'site')).catch(() => null);
        if (!snap || !snap.exists()) return;
        const data = snap.data() || {};
        const regular = parseInt(data.referralCoins, 10);
        const creator = parseInt(data.creatorReferralCoins, 10);
        if (!isNaN(regular) && regular >= 0) creatorCodeSettings.referralCoins = regular;
        if (!isNaN(creator) && creator >= 0) creatorCodeSettings.creatorReferralCoins = creator;
    } catch (error) { /* se usan los valores por defecto */ }
}

let creatorCodeAccountCache = [];

/**
 * Una misma persona puede tener más de un documento en `conductores`
 * (cuentas antiguas con uids distintos). Se elige la ficha que realmente
 * usa: la que ya tiene código de creador, luego la que tenga cualquier
 * código, y por último la más reciente.
 */
async function resolveCreatorCodeAccount(account) {
    const direct = String(account?.uid || '');
    const email = String(account?.email || '').trim().toLowerCase();
    const name = assignmentNameKey(account?.nombre || account?.displayName || account?.username || '');
    if ((!email && !name) || !window.db || !window.getDocs || !window.collection) return account;

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        const matches = snap.docs.filter(doc => {
            if (String(doc.id) === direct) return true;
            const d = doc.data() || {};
            const docEmail = String(d.email || '').trim().toLowerCase();
            const docName = assignmentNameKey(d.nombre || d.displayName || d.username || d.nombre_usuario || '');
            return (email && docEmail === email) || (name && docName === name);
        });
        if (!matches.length) return account;

        const score = (doc) => {
            const d = doc.data() || {};
            const hasCode = String(d.referralCode || '').trim() ? 2 : 0;
            const isCreator = String(d.referralCodeKind || '').toLowerCase() === 'creator' ? 4 : 0;
            const ts = new Date(d.updatedAt || d.actualizadoEn || 0).getTime() || 0;
            return isCreator + hasCode + ts / 1e13;
        };
        matches.sort((a, b) => score(b) - score(a));
        const best = matches[0];
        return Object.assign({}, account, {
            uid: String(best.id),
            email: String((best.data() || {}).email || account.email || '')
        });
    } catch (error) {
        return account;
    }
}

async function loadCreatorCodePanel() {
    const select = document.getElementById('creatorCodeUser');
    if (!select) return;

    await loadCreatorCodeSettings();
    const base = creatorCodeCandidates();
    const current = String(select.value || '');
    const candidates = await Promise.all(base.map(resolveCreatorCodeAccount));
    creatorCodeAccountCache = candidates;

    select.innerHTML = candidates.length
        ? ['<option value="">— Elegir creador —</option>'].concat(candidates.map(account =>
            `<option value="${staffEscape(account.uid)}">${staffEscape(account.nombre || account.uid)}${account.email ? ' · ' + staffEscape(account.email) : ''}</option>`
        )).join('')
        : '<option value="">— No hay Creadores de Contenido —</option>';

    if (current && candidates.some(account => String(account.uid) === current)) {
        select.value = current;
    }

    const saveBtn = document.getElementById('creatorCodeSaveBtn');
    const resetBtn = document.getElementById('creatorCodeResetBtn');
    const input = document.getElementById('creatorCodeInput');
    if (saveBtn) saveBtn.disabled = !candidates.length;
    if (resetBtn) resetBtn.disabled = !candidates.length;
    if (input) input.disabled = !candidates.length;

    if (!candidates.length) {
        creatorCodeSetMessage('Asigna primero el rango «Creador de Contenido» en la lista de rangos de arriba.', 'info');
        if (input) input.value = '';
        return;
    }

    // Con un solo creador (o sin selección previa) se elige el primero para
    // mostrar su código actual sin pasos extra.
    if (!select.value || !candidates.some(account => String(account.uid) === String(select.value))) {
        select.value = String(candidates[0].uid);
    }

    creatorCodeSetMessage(candidates.length === 1
        ? 'Creador detectado. Escribe su código personalizado o genera uno aleatorio.'
        : `Elige un creador para ver o cambiar su código (${candidates.length} disponibles).`, 'info');
    await loadCreatorCodePreview(select.value);
}

async function loadCreatorCodePreview(uid) {
    const input = document.getElementById('creatorCodeInput');
    const safeUid = String(uid || '');
    if (!safeUid) {
        if (input) input.value = '';
        creatorCodeSetMessage('Selecciona un Creador de Contenido para ver o cambiar su código.', 'info');
        return;
    }
    if (!window.db || !window.fsDoc || !window.getDoc) {
        creatorCodeSetMessage('Firestore no está disponible ahora mismo.', 'warning');
        return;
    }
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'conductores', safeUid));
        const data = snap.exists() ? (snap.data() || {}) : {};
        if (input) input.value = data.referralCode || '';
        const isCreator = String(data.referralCodeKind || '').toLowerCase() === 'creator';
        const benefit = Number(creatorCodeSettings.creatorReferralCoins || 100);
        creatorCodeSetMessage(
            isCreator
                ? `Código de creador activo. Recompensa: ${benefit} monedas por invitación.`
                : `Este usuario aún tiene un código automático de usuario. Guarda un código de creador para activar la recompensa de ${benefit} monedas.`,
            isCreator ? 'success' : 'info'
        );
    } catch (error) {
        creatorCodeSetMessage('No se pudo leer el código actual del creador.', 'error');
    }
}

async function saveCreatorReferralCode() {
    const select = document.getElementById('creatorCodeUser');
    const input = document.getElementById('creatorCodeInput');
    const uid = String(select?.value || '');
    if (!uid) {
        creatorCodeSetMessage('Elige un Creador de Contenido.', 'error');
        return;
    }

    const account = creatorCodeAccountCache.find(item => String(item.uid) === uid);
    if (!account || creatorCodeRoleOf(account) !== 'creador_contenido') {
        creatorCodeSetMessage('Sólo los usuarios con rango «Creador de Contenido» pueden tener un código personalizado.', 'error');
        return;
    }

    const code = creatorCodeNormalize(input?.value);
    if (!CREATOR_CODE_PATTERN.test(code)) {
        creatorCodeSetMessage('El código debe tener de 3 a 16 caracteres: letras A-Z, números, guion o guion bajo, e incluir al menos una letra.', 'error');
        input?.focus();
        return;
    }

    if (!window.db || !window.fsDoc || !window.setDoc) {
        creatorCodeSetMessage('Firestore no está disponible ahora mismo.', 'error');
        return;
    }

    const saveBtn = document.getElementById('creatorCodeSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Guardando...';
    }

    try {
        if (await creatorCodeIsTaken(code, uid)) {
            creatorCodeSetMessage(`El código «${code}» ya está en uso por otro usuario.`, 'error');
            return;
        }

        const ref = window.fsDoc(window.db, 'conductores', uid);
        const snap = await window.getDoc(ref).catch(() => null);
        const data = snap && snap.exists() ? (snap.data() || {}) : {};
        const previous = creatorCodeNormalize(data.referralCode);
        const now = new Date().toISOString();
        const patch = {
            referralCode: code,
            referralCodeKind: 'creator',
            referralCodeSetBy: currentUser ? (currentUser.uid || currentUser.email || 'staff') : 'staff',
            referralCodeSetAt: now,
            updatedAt: now
        };
        if (previous && previous !== code) {
            const legacy = Array.isArray(data.referralCodeLegacy) ? data.referralCodeLegacy.slice() : [];
            if (!legacy.includes(previous)) legacy.push(previous);
            patch.referralCodeLegacy = legacy.slice(-10);
        }

        await window.setDoc(ref, patch, { merge: true });
        if (input) input.value = code;
        creatorCodeSetMessage(`Código «${code}» guardado. Recompensa de creador: ${Number(creatorCodeSettings.creatorReferralCoins || 100)} monedas por invitación.`, 'success');
    } catch (error) {
        console.error('[Referidos] No se pudo guardar el código de creador:', error);
        creatorCodeSetMessage('No se pudo guardar el código. Revisa la conexión e intenta de nuevo.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar código';
        }
    }
}

async function resetCreatorReferralCode() {
    const select = document.getElementById('creatorCodeUser');
    const uid = String(select?.value || '');
    if (!uid) {
        creatorCodeSetMessage('Elige un Creador de Contenido.', 'error');
        return;
    }
    const account = creatorCodeAccountCache.find(item => String(item.uid) === uid);
    if (!account || creatorCodeRoleOf(account) !== 'creador_contenido') {
        creatorCodeSetMessage('Sólo los usuarios con rango «Creador de Contenido» pueden tener un código personalizado.', 'error');
        return;
    }
    if (!window.db || !window.fsDoc || !window.setDoc) {
        creatorCodeSetMessage('Firestore no está disponible ahora mismo.', 'error');
        return;
    }
    try {
        if (typeof window.confirm === 'function' && !window.confirm('¿Generar un código aleatorio nuevo para este creador? El código anterior seguirá funcionando en los enlaces ya compartidos.')) {
            return;
        }
    } catch (error) { /* continúa */ }

    const resetBtn = document.getElementById('creatorCodeResetBtn');
    if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Generando...';
    }

    try {
        let code = '';
        for (let attempt = 0; attempt < 25; attempt++) {
            const candidate = creatorCodeRandomLetters(8);
            if (!(await creatorCodeIsTaken(candidate, uid))) { code = candidate; break; }
        }
        if (!code) {
            creatorCodeSetMessage('No se pudo generar un código único. Intenta de nuevo.', 'error');
            return;
        }

        const ref = window.fsDoc(window.db, 'conductores', uid);
        const snap = await window.getDoc(ref).catch(() => null);
        const data = snap && snap.exists() ? (snap.data() || {}) : {};
        const previous = creatorCodeNormalize(data.referralCode);
        const now = new Date().toISOString();
        const patch = {
            referralCode: code,
            referralCodeKind: 'creator',
            referralCodeSetBy: currentUser ? (currentUser.uid || currentUser.email || 'staff') : 'staff',
            referralCodeSetAt: now,
            updatedAt: now
        };
        if (previous && previous !== code) {
            const legacy = Array.isArray(data.referralCodeLegacy) ? data.referralCodeLegacy.slice() : [];
            if (!legacy.includes(previous)) legacy.push(previous);
            patch.referralCodeLegacy = legacy.slice(-10);
        }

        await window.setDoc(ref, patch, { merge: true });
        const input = document.getElementById('creatorCodeInput');
        if (input) input.value = code;
        creatorCodeSetMessage(`Código aleatorio «${code}» generado para este creador.`, 'success');
    } catch (error) {
        console.error('[Referidos] No se pudo generar el código de creador:', error);
        creatorCodeSetMessage('No se pudo generar el código. Revisa la conexión e intenta de nuevo.', 'error');
    } finally {
        if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.innerHTML = '<i class="fa-solid fa-dice" aria-hidden="true"></i> Aleatorio';
        }
    }
}

async function assignPerson(uid, role) {
    if (!uid || !role) return;
    const R = window.PanterRoles;
    const account = assignmentAccounts.find(item => String(item.uid) === String(uid)) || {};
    const nombre = String(account.nombre || uid).trim();
    const roleId = R ? R.normalize(role) : role;
    const record = {
        uid: String(uid),
        nombre,
        role: roleId,
        email: account.email || '',
        avatarUrl: account.avatarUrl || '',
        especialidad: '',
        orden: 999,
        estado: 'online',
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: currentUser ? (currentUser.uid || currentUser.email || 'admin') : 'admin'
    };

    mirrorStaffLocal(record);
    staffUnhideUid(String(uid));
    try {
        if (window.db && window.fsDoc && window.setDoc) {
            await window.setDoc(window.fsDoc(window.db, STAFF_COLLECTION, String(uid)), record, { merge: true });
        }
    } catch (e) {
        console.warn('[Personal] Asignación guardada en copia local:', e);
    }
    assignSetMessage(`"${nombre}" ahora figura en ${R ? R.get(roleId).label : roleId}.`, 'success');
    await refreshAssignment();
}

async function removeAssignedPerson(uid) {
    if (!uid) return;
    staffWriteLocal(staffReadLocal().filter(item => String(item.uid) !== String(uid)));
    staffHideUid(String(uid));
    try {
        if (window.db && window.fsDoc && window.setDoc) {
            await window.setDoc(window.fsDoc(window.db, STAFF_COLLECTION, String(uid)), {
                archivado: true,
                actualizadoEn: new Date().toISOString()
            }, { merge: true });
        }
    } catch (e) {
        console.warn('[Personal] Baja aplicada en copia local:', e);
    }
    assignSetMessage('Persona retirada del rango.', 'success');
    await refreshAssignment();
}

function startAssignmentRealtime() {
    if (assignmentUnsub || !window.db || !window.collection || typeof window.onSnapshot !== 'function') return;
    try {
        assignmentUnsub = window.onSnapshot(
            window.collection(window.db, STAFF_COLLECTION),
            () => refreshAssignment(),
            err => console.warn('[Personal] Suscripción de equipo no disponible:', err)
        );
        window.addEventListener('pagehide', () => {
            try { assignmentUnsub && assignmentUnsub(); } catch (e) { /* noop */ }
            assignmentUnsub = null;
        }, { once: true });
    } catch (e) {
        console.warn('[Personal] No se pudo iniciar la suscripción:', e);
    }
}

function bindRoleAssignment() {
    const container = document.getElementById('roleAssignmentList');
    if (!container || container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';
    container.addEventListener('click', async (event) => {
        const addBtn = event.target.closest('[data-assign-add]');
        if (addBtn) {
            const role = addBtn.getAttribute('data-assign-add');
            const select = container.querySelector(`[data-assign-select="${role}"]`);
            const uid = select?.value || '';
            if (!uid) { assignSetMessage('Elige un usuario del desplegable.', 'error'); return; }
            addBtn.disabled = true;
            try { await assignPerson(uid, role); }
            catch (e) { assignSetMessage('No se pudo asignar: ' + (e?.message || e), 'error'); }
            finally { addBtn.disabled = false; }
            return;
        }
        const removeBtn = event.target.closest('[data-assign-remove]');
        if (removeBtn) {
            removeBtn.disabled = true;
            try { await removeAssignedPerson(removeBtn.getAttribute('data-assign-remove')); }
            catch (e) { assignSetMessage('No se pudo retirar: ' + (e?.message || e), 'error'); }
        }
    });
    window.addEventListener('storage', (event) => {
        if (event.key === STAFF_LOCAL_KEY || event.key === STAFF_HIDDEN_KEY) refreshAssignment();
    });
    document.addEventListener('panter:roles-config', () => renderRoleAssignment());
    document.addEventListener('firebaseReady', () => refreshAssignment());
    // Fuente compartida: cualquier cambio de rango hecho en otra vista
    // (o en otra pestaña) se refleja aquí sin recargar.
    let staffRefreshTimer = null;
    document.addEventListener('panter:staff-changed', () => {
        clearTimeout(staffRefreshTimer);
        staffRefreshTimer = setTimeout(() => {
            refreshAssignment().catch(e => console.warn('[Personal] No se pudo refrescar:', e));
        }, 120);
    });
}

function initAdminPanel() {
    bindEvents();

    setTimeout(() => {
        hideWelcomeOverlay();
    }, 3000);

    // Las sesiones guardadas se revalidan contra `equipo` (Personal),
    // la única fuente de rangos. No se crean sesiones desde Discord.
    const storedSession = getStoredSession();
    if (storedSession && storedSession.isAdmin) {
        const tryRestore = (attempt = 0) => {
            const ready = Boolean(window.db && window.fsDoc && window.getDoc);
            if (!ready && attempt < 20) {
                setTimeout(() => tryRestore(attempt + 1), 400);
                return;
            }
            applyStoredSession(storedSession).catch((error) => {
                console.warn('No se pudo revalidar la sesión guardada:', error);
            });
        };
        tryRestore();
    }

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => {
        bootAuthListener();
    }, { once: true });

    setTimeout(() => {
        bootAuthListener();
    }, 2200);
}

initAdminPanel();
