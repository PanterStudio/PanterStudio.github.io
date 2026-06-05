// Admin Panel - Panter Studio Control Center

const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');

function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

const ROLE_LABELS = {
    founder_ceo: 'Fundador / CEO',
    director: 'Director',
    administrador: 'Administrador',
    programador: 'Programador',
    modelador: 'Modelador',
    usuario: 'Usuario',
    vip: 'VIP',
    viewer: 'Solo lectura'
};

const CEO_ASSIGNABLE_ROLES = {
    director: 'Director',
    administrador: 'Administrador',
    programador: 'Programador',
    modelador: 'Modelador',
    usuario: 'Usuario',
    vip: 'VIP'
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
    dashboard: { title: 'Resumen General', sub: 'Estadisticas y resumen del Hub de Panter Studio.' },
    betatesters: { title: 'Beta Testers', sub: 'Inscripciones para el equipo de pruebas en Android.' },
    accounts: { title: 'Gestion de Cuentas (CEO)', sub: 'Miembros del equipo y niveles de rol autorizados.' },
    support: { title: 'Soporte al Jugador', sub: 'Busqueda de usuarios y modificacion de saldo de monedas.' }
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
        } else if (tabName === 'accounts') {
            loadCeoUsers();
        }
    });
});

function normalizeRole(role) {
    const n = String(role || '').trim().toLowerCase();
    if (n === 'admin' || n === 'admin_general') return 'administrador';
    if (n === 'developer') return 'programador';
    if (n === 'modeler') return 'modelador';
    return Object.prototype.hasOwnProperty.call(ROLE_LABELS, n) ? n : 'usuario';
}

function getRoleLabel(role) {
    return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.usuario;
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
    const normalized = normalizeRole(selectedRole);
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
            : (canAssignRole ? (CEO_ASSIGNABLE_ROLES[normalizeRole(user.role)] || 'Usuario') : 'Sin cuenta');
        const rowRole = isFounder ? 'founder_ceo' : normalizeRole(user.role);
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
                    <button class="btn btn-sm admin-role-save-btn" data-role-save="${user.uid}" ${isFounder || !canAssignRole ? 'disabled' : ''}>${canAssignRole ? 'Guardar' : 'N/A'}</button>
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

        const usersSnapshot = await window.getDocs(window.collection(window.db, 'conductores'));
        usersSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const email = String(data.email || '').trim().toLowerCase();
            if (!isValidEmailValue(email)) return;

            addEmailToIndex(emailIndexMap, email, {
                uid: docSnap.id,
                name: String(data.username || data.displayName || '').trim(),
                role: isFounderEmail(email) ? 'founder_ceo' : normalizeRole(data.role),
                isAdmin: Boolean(data.isAdmin),
                sources: ['conductores']
            });
        });

        const extraCollections = EMAIL_ANALYSIS_COLLECTIONS.filter((name) => name !== 'conductores');
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

    const normalizedRole = normalizeRole(role);
    const userItem = ceoUsersList.find((item) => item.uid === uid);
    if (!userItem) return;
    if (!userItem.uid) {
        setCeoMessage('Este correo no tiene cuenta en conductores. No se puede asignar rol.', true);
        return;
    }
    if (isFounderEmail(userItem.email)) {
        setCeoMessage('La cuenta Fundador/CEO no puede ser modificada.', true);
        return;
    }

    try {
        await window.setDoc(window.fsDoc(window.db, 'conductores', uid), {
            role: normalizedRole,
            isAdmin: canRoleAccessPanel(normalizedRole),
            roleUpdatedAt: new Date().toISOString(),
            roleUpdatedBy: currentUser?.uid || ''
        }, { merge: true });

        userItem.role = normalizedRole;
        userItem.isAdmin = canRoleAccessPanel(normalizedRole);

        renderCeoUsersTable(ceoEmailSearchInput?.value || '');
        setCeoMessage(`Rol actualizado: ${userItem.email} -> ${ROLE_LABELS[normalizedRole]}`);
    } catch (err) {
        console.error('Error guardando rol CEO:', err);
        setCeoMessage('No se pudo guardar el rol. Revisa permisos.', true);
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
            let statusLabel = 'Pendiente 🟡';
            if (status === 'approved') statusLabel = 'Aprobado 🟢';
            if (status === 'rejected') statusLabel = 'Rechazado 🔴';

            const skills = [];
            if (app.betaTesterSkillBugs) skills.push('🐛 Reportar Bugs');
            if (app.betaTesterSkillHours) skills.push('⏰ +5 horas/sem');
            if (app.betaTesterSkillRecord) skills.push('📹 Grabar Pantalla');
            if (app.betaTesterSkillDiscord) skills.push('💬 Discord Activo');

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
                        <span class="spec-badge">📱 ${app.betaTesterDevice || 'Android'}</span>
                        <span class="spec-badge">💾 RAM: ${app.betaTesterRAM || 'N/A'}</span>
                        <span class="spec-badge">🤖 Version: ${app.betaTesterAndroidVersion || 'N/A'}</span>
                    </div>
                    <div class="beta-card-skills" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                        ${skillsHtml}
                    </div>
                    <div class="beta-card-motivation">
                        <strong>Motivacion:</strong><br>
                        ${app.betaTesterWhy || 'Sin respuesta.'}
                    </div>
                    <div class="beta-card-actions">
                        <button class="btn btn-sm btn-block" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #a7f3d0;" onclick="setBetaStatus('${app.uid}', 'approved')">Aprobar 🟢</button>
                        <button class="btn btn-sm btn-block btn-danger" onclick="setBetaStatus('${app.uid}', 'rejected')">Rechazar 🔴</button>
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
            let label = 'Pendiente 🟡';
            if (status === 'approved') label = 'Aprobado 🟢';
            if (status === 'rejected') label = 'Rechazado 🔴';
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
        if (tc) tc.textContent = `${totalCoins.toLocaleString('es-ES')} 🪙`;
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
        msg.textContent = '⚠️ Introduce un nombre, apodo o correo valido.';
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
                
                if (email === query || username.includes(query) || displayName.includes(query)) {
                    foundUsers.push({
                        uid: docSnap.id,
                        ...data
                    });
                }
            }
        });

        if (foundUsers.length === 0) {
            msg.textContent = '❌ Jugador no encontrado.';
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
                btn.textContent = `${u.username || u.displayName || 'Sin Nombre'} (${u.email})`;
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
        msg.textContent = 'Error al realizar la busqueda.';
    }
}

function displaySelectedSupportUser(user) {
    activeSupportUserUid = user.uid;
    document.getElementById('supportUserTitle').textContent = user.username || user.displayName || 'Sin Nombre';
    document.getElementById('supportUserEmailLabel').textContent = user.email || 'Sin correo';
    document.getElementById('supportUserCurrentCoins').textContent = `${(user.saldo || 0).toLocaleString('es-ES')} 🪙`;
    document.getElementById('supportUserCard').hidden = false;
}

async function saveSupportCoins() {
    const amountInput = document.getElementById('supportCoinsAmount');
    const actionMsg = document.getElementById('supportActionMessage');
    if (!activeSupportUserUid || !amountInput || !actionMsg) return;

    const diff = parseFloat(amountInput.value);
    if (Number.isNaN(diff) || diff === 0) {
        actionMsg.textContent = '⚠️ Especifica una cantidad distinta de 0.';
        return;
    }

    actionMsg.textContent = 'Guardando saldo...';

    try {
        const userDocRef = window.fsDoc(window.db, 'conductores', activeSupportUserUid);
        const snap = await window.getDoc(userDocRef);

        if (snap.exists()) {
            const currentVal = parseFloat(snap.data().saldo || 0) || 0;
            const newVal = Math.max(0, currentVal + diff);

            await window.setDoc(userDocRef, {
                saldo: newVal,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            document.getElementById('supportUserCurrentCoins').textContent = `${newVal.toLocaleString('es-ES')} 🪙`;
            actionMsg.textContent = `✅ Saldo actualizado exitosamente a ${newVal} 🪙.`;
            amountInput.value = '';

            calculateStats();
        }
    } catch (err) {
        console.error('Error guardando saldo en soporte:', err);
        actionMsg.textContent = 'No se pudo guardar el saldo.';
    }
}

// ---------- General Setup & Gate Helpers ----------
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
        window.location.replace(toSitePath('index.html'));
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

    welcomeTimer = setTimeout(() => {
        hideWelcomeOverlay();
        welcomeTimer = null;
    }, 3000);
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
            const profileRef = window.fsDoc(window.db, 'conductores', user.uid);
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

function setupCeoTools(user, role) {
    const isCeo = isFounderEmail(user?.email) || normalizeRole(role) === 'founder_ceo';
    if (sidebarAccountsTab) {
        sidebarAccountsTab.hidden = !isCeo;
    }
}

async function handleAuthStateChange(user) {
    currentUser = user;
    const loginBtn = document.getElementById('adminLoginBtn');

    if (!user) {
        if (gateMessage) {
            gateMessage.textContent = 'Inicia sesión con tu cuenta de administrador de Google.';
        }
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
        return;
    }

    if (loginBtn) {
        loginBtn.style.display = 'none';
    }

    const { isAdmin, role } = await resolveUserAccess(user);

    if (!isAdmin) {
        if (gateMessage) {
            gateMessage.textContent = '❌ Tu cuenta (' + user.email + ') no tiene permisos de administrador.';
            gateMessage.style.color = 'red';
        }
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
        return;
    }

    if (gateMessage) {
        gateMessage.textContent = '';
    }

    updateProfileUI(user, role);
    showPanel();
    playWelcomeAnimation(user, role);
    setupCeoTools(user, role);

    // Initial load statistics & active beta testers tab checks
    calculateStats();
    loadBetaTesters();
}

async function handleLogout() {
    try {
        if (window.auth && window.signOut) {
            await window.signOut(window.auth);
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
    const saveSupportCoinsBtn = document.getElementById('supportSaveCoinsBtn');
    if (saveSupportCoinsBtn) {
        saveSupportCoinsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveSupportCoins();
        });
    }

    bindCeoRoleActions();
}

function bootAuthListener() {
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn && !adminLoginBtn.dataset.bound) {
        adminLoginBtn.dataset.bound = "true";
        adminLoginBtn.addEventListener('click', async () => {
            try {
                if (window.auth && window.GoogleAuthProvider && window.signInWithPopup) {
                    const provider = new window.GoogleAuthProvider();
                    await window.signInWithPopup(window.auth, provider);
                } else {
                    alert('El servicio de autenticación de Firebase no está listo. Reintenta.');
                }
            } catch (err) {
                console.error(err);
                alert('Error al iniciar sesión: ' + err.message);
            }
        });
    }

    if (!window.auth || !window.onAuthStateChanged) {
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

function initAdminPanel() {
    bindEvents();

    setTimeout(() => {
        hideWelcomeOverlay();
    }, 3000);

    if (bootAuthListener()) return;

    document.addEventListener('firebaseReady', () => {
        bootAuthListener();
    }, { once: true });

    setTimeout(() => {
        bootAuthListener();
    }, 2200);
}

initAdminPanel();
