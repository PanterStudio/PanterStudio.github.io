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
    dashboard: { title: 'Resumen General', sub: 'Estadísticas y resumen del Hub de Panter Studio.' },
    betatesters: { title: 'Beta Testers', sub: 'Inscripciones para el equipo de pruebas en Android.' },
    accounts: { title: 'Gestión de Cuentas (CEO)', sub: 'Miembros del equipo y niveles de rol autorizados.' },
    support: { title: 'Soporte al Jugador', sub: 'Búsqueda de usuarios, edición de perfiles, saldos, mascotas y logs de canjes.' },
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
        } else if (tabName === 'accounts') {
            loadCeoUsers();
        } else if (tabName === 'support') {
            loadGlobalRedeemLogs();
        } else if (tabName === 'siteconfig') {
            loadSiteConfig();
        } else if (tabName === 'visibility') {
            loadSiteVisibilitySettings();
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

// Role visual config for account cards
const ROLE_CARD_STYLES = {
    founder_ceo:   { color: '#fbbf24', border: 'rgba(251,191,36,0.4)',   bg: 'rgba(251,191,36,0.08)',  icon: '👑' },
    director:      { color: '#f87171', border: 'rgba(248,113,113,0.4)', bg: 'rgba(248,113,113,0.08)', icon: '🔴' },
    administrador: { color: '#22d3ee', border: 'rgba(34,211,238,0.4)',  bg: 'rgba(34,211,238,0.08)',  icon: '🛡️' },
    programador:   { color: '#60a5fa', border: 'rgba(96,165,250,0.4)',  bg: 'rgba(96,165,250,0.08)',  icon: '💻' },
    modelador:     { color: '#a78bfa', border: 'rgba(167,139,250,0.4)', bg: 'rgba(167,139,250,0.08)', icon: '🎨' },
    vip:           { color: '#34d399', border: 'rgba(52,211,153,0.4)',  bg: 'rgba(52,211,153,0.08)',  icon: '⭐' },
    usuario:       { color: '#94a3b8', border: 'rgba(148,163,184,0.2)', bg: 'rgba(148,163,184,0.05)', icon: '👤' },
    viewer:        { color: '#64748b', border: 'rgba(100,116,139,0.2)', bg: 'rgba(100,116,139,0.05)', icon: '👁️' },
};

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
                <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔍</div>
                <div style="font-size:0.9rem; color:var(--admin-text-muted);">No se encontraron usuarios.</div>
            </div>`;
        return;
    }

    container.innerHTML = rows.map((user, index) => {
        const isFounder = isFounderEmail(user.email);
        const canAssignRole = Boolean(user.uid);
        const rowRole = isFounder ? 'founder_ceo' : normalizeRole(user.role);
        const style = ROLE_CARD_STYLES[rowRole] || ROLE_CARD_STYLES.usuario;
        const roleLabel = isFounder ? 'Fundador / CEO'
                        : (canAssignRole ? (getRoleLabel(rowRole)) : 'Sin cuenta');
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

            <!-- Role editor (disabled for founder / no account) -->
            <div class="account-card-bottom ${isFounder || !canAssignRole ? 'account-card-locked' : ''}">
                ${isFounder ? `
                    <div class="account-locked-msg">
                        👑 Cuenta fundadora — no modificable
                    </div>
                ` : !canAssignRole ? `
                    <div class="account-locked-msg">
                        ⚠️ Sin cuenta registrada — no se puede asignar rol
                    </div>
                ` : `
                    <div class="account-role-editor">
                        <label class="account-role-label">Asignar nuevo rol</label>
                        <div class="account-role-row">
                            <select class="account-role-select" data-role-select="${user.uid}">
                                ${createRoleOptions(rowRole)}
                            </select>
                            <button class="account-save-btn" data-role-save="${user.uid}">
                                💾 Guardar
                            </button>
                        </div>
                    </div>
                `}
            </div>
        </div>`;
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
    const container = document.getElementById('adminCeoUsersTableBody');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role-save]');
        if (!target) return;

        const saveUid = target.getAttribute('data-role-save');
        if (!saveUid) return;

        const selectEl = container.querySelector(`[data-role-select="${saveUid}"]`);
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
        msg.textContent = '⚠️ Introduce un nombre, apodo o correo válido.';
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
    document.getElementById('editSupportAvatar').value = user.avatar || '😊';
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

        actionMsg.textContent = '✅ Todos los cambios se guardaron exitosamente en la base de datos.';
        actionMsg.className = 'admin-message success';

        calculateStats();
    } catch (err) {
        console.error('Error guardando soporte:', err);
        actionMsg.textContent = '❌ No se pudieron guardar los cambios.';
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
        
        actionMsg.textContent = `✅ Cooldown de ${type === 'work' ? 'Trabajo 💼' : 'Riesgo ⚠️'} reiniciado con éxito.`;
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error(err);
        actionMsg.textContent = '❌ Error al reiniciar cooldown.';
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
            
            let statusBadge = '<span class="status-badge status-approved">Completado 🟢</span>';
            if (status === 'pending') statusBadge = '<span class="status-badge status-pending">Pendiente 🟡</span>';
            if (status === 'failed' || status === 'rejected') statusBadge = '<span class="status-badge status-rejected">Error 🔴</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td><strong>${player}</strong><br><small style="color:var(--admin-text-muted);">${data.email || ''}</small></td>
                    <td style="color:#fbbf24; font-weight:700;">🪙 ${coins}</td>
                    <td style="color:#00b0ff; font-weight:700;">💎 ${emeralds}</td>
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
            actionMsg.textContent = '❌ Error al cargar configuración de la base de datos.';
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

        actionMsg.textContent = '✅ Configuración guardada correctamente en Firestore.';
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error('Error guardando configuración:', err);
        actionMsg.textContent = '❌ No se pudo guardar la configuración.';
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
            actionMsg.textContent = '❌ Error al cargar configuración de visibilidad.';
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

        actionMsg.textContent = '✅ Visibilidad del sitio guardada exitosamente en Firestore.';
        actionMsg.className = 'admin-message success';
    } catch (err) {
        console.error('Error guardando visibilidad:', err);
        actionMsg.textContent = '❌ Error al guardar visibilidad del sitio.';
        actionMsg.className = 'admin-message error';
    }
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
