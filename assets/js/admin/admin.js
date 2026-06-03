// Admin Panel - Minimal Base (Auth + Role + Basic Profile)

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

const EMAIL_ANALYSIS_COLLECTIONS = ['conductores', 'preregistros', 'donations', 'sponsors'];

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
const founderAddAmountInput = document.getElementById('founderAddAmount');
const founderAddNoteInput = document.getElementById('founderAddNote');
const founderAddBtn = document.getElementById('founderAddBtn');
const founderAddMessage = document.getElementById('founderAddMessage');
const founderRemoveAmountInput = document.getElementById('founderRemoveAmount');
const founderRemoveNoteInput = document.getElementById('founderRemoveNote');
const founderRemoveBtn = document.getElementById('founderRemoveBtn');
const founderRemoveMessage = document.getElementById('founderRemoveMessage');
const adminToggleDonationsConfigBtn = document.getElementById('adminToggleDonationsConfigBtn');
const adminDonationsConfigContainer = document.getElementById('adminDonationsConfigContainer');
const donConfigGoalInput = document.getElementById('donConfigGoal');
const donConfigPaypalInput = document.getElementById('donConfigPaypal');
const donConfigNequiInput = document.getElementById('donConfigNequi');
const donConfigBreveInput = document.getElementById('donConfigBreve');
const donConfigPatreonInput = document.getElementById('donConfigPatreon');
const donConfigPublicMessageInput = document.getElementById('donConfigPublicMessage');
const donConfigSaveBtn = document.getElementById('donConfigSaveBtn');
const donConfigResetBtn = document.getElementById('donConfigResetBtn');
const donConfigMessage = document.getElementById('donConfigMessage');
const previewProgressFill = document.getElementById('previewProgressFill');
const previewPercent = document.getElementById('previewPercent');
const previewGoalText = document.getElementById('previewGoalText');
const previewCurrentText = document.getElementById('previewCurrentText');
const previewPaypalBtn = document.getElementById('previewPaypalBtn');
const previewNequiBtn = document.getElementById('previewNequiBtn');
const previewBreveBtn = document.getElementById('previewBreveBtn');

const logoutBtn = document.getElementById('adminLogoutBtn');
const goHomeBtn = document.getElementById('adminGoHomeBtn');

const welcomeOverlay = document.getElementById('adminWelcome');
const welcomeTitleEl = document.getElementById('adminWelcomeTitle');
const welcomeSubtitleEl = document.getElementById('adminWelcomeSubtitle');

let welcomeTimer = null;
let hasPlayedWelcome = false;
let ceoUsersList = [];
let currentUser = null;

// Create updates UI refs (admin)
const adminCreateUpdateForm = document.getElementById('adminCreateUpdateForm');
const adminCreateUpdateProject = document.getElementById('adminCreateUpdateProject');
const adminCreateUpdateTitle = document.getElementById('adminCreateUpdateTitle');
const adminCreateUpdateSummary = document.getElementById('adminCreateUpdateSummary');
const adminCreateUpdateContent = document.getElementById('adminCreateUpdateContent');
const adminCreateUpdateImage = document.getElementById('adminCreateUpdateImage');
const adminCreateUpdatePublished = document.getElementById('adminCreateUpdatePublished');
const adminCreateUpdateReset = document.getElementById('adminCreateUpdateReset');
const adminCreateUpdateMsg = document.getElementById('adminCreateUpdateMsg');

let adminProjectsCache = [];

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

        const usersSnapshot = await window.getDocs(window.collection(window.db, 'conductores'));
        usersSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const email = String(data.email || '').trim().toLowerCase();
            if (!isValidEmailValue(email)) return;

            addEmailToIndex(emailIndexMap, email, {
                uid: docSnap.id,
                name: String(data.username || data.displayName || '').trim(),
                role: isFounderEmail(email) ? 'founder_ceo' : normalizeCeoRole(data.role),
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
        setCeoMessage('Este correo no tiene cuenta en conductores. No se puede asignar rol aun.', true);
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

// ---------- Admin updates helpers ----------
async function loadAdminProjects() {
    if (!window.db || !window.collection || !window.getDocs) return [];
    try {
        const cols = ['games', 'applications', 'apps'];
        const results = [];
        for (const c of cols) {
            try {
                const snap = await window.getDocs(window.collection(window.db, c));
                if (!snap) continue;
                snap.docs.forEach(d => {
                    const data = d.data() || {};
                    results.push({ collection: c, id: String(d.id), title: String(data.title || data.name || data.id || d.id), type: c === 'games' ? 'juego' : 'aplicacion' });
                });
            } catch (err) { /* ignore individual collection errors */ }
        }
        adminProjectsCache = results;
        if (adminCreateUpdateProject) {
            const opts = ['<option value="">(Selecciona un proyecto...)</option>'].concat(results.map(p => `<option value="${p.collection}::${p.id}">${p.title} (${p.type})</option>`));
            adminCreateUpdateProject.innerHTML = opts.join('');
        }
        return results;
    } catch (err) { console.warn('Error cargando proyectos para admin:', err); return []; }
}

function setAdminCreateUpdateMessage(text, isError = false) {
    if (!adminCreateUpdateMsg) return;
    adminCreateUpdateMsg.textContent = text || '';
    adminCreateUpdateMsg.className = isError ? 'admin-message error' : 'admin-message';
}

async function handleAdminCreateUpdate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const projVal = String(adminCreateUpdateProject?.value || '').trim();
    const title = String(adminCreateUpdateTitle?.value || '').trim();
    const summary = String(adminCreateUpdateSummary?.value || '').trim();
    const content = String(adminCreateUpdateContent?.value || '').trim();
    const image = String(adminCreateUpdateImage?.value || '').trim();
    const published = Boolean(adminCreateUpdatePublished?.checked);

    if (!title) return setAdminCreateUpdateMessage('El título es obligatorio.', true);
    if (!content) return setAdminCreateUpdateMessage('El contenido es obligatorio.', true);
    if (image && !/^https?:\/\//i.test(image)) return setAdminCreateUpdateMessage('La imagen debe ser una URL válida (http/https).', true);

    const now = new Date().toISOString();
    const updateId = `upd_${Date.now()}`;

    let projectId = '';
    let projectType = '';
    let projectTitle = '';
    if (projVal) {
        const [col, id] = projVal.split('::');
        projectId = id || '';
        const found = adminProjectsCache.find(p => p.collection === col && p.id === id);
        projectType = found ? found.type : (col === 'games' ? 'juego' : 'aplicacion');
        projectTitle = found ? found.title : '';
    }

    const payload = {
        id: updateId,
        projectId,
        projectType,
        projectTitle,
        title,
        summary,
        content,
        image,
        published,
        date: now,
        createdAt: now,
        updatedAt: now,
        createdByUid: currentUser?.uid || ''
    };

    try {
        setAdminCreateUpdateMessage('Publicando actualización...');
        await window.setDoc(window.fsDoc(window.db, 'project_updates', updateId), payload, { merge: true });
        if (projectId) {
            const col = projVal.split('::')[0];
            try { await window.setDoc(window.fsDoc(window.db, col, projectId), { updatedAt: now, lastUpdateAt: now }, { merge: true }); } catch (err) { /* ignore */ }
        }

        setAdminCreateUpdateMessage('Actualización publicada.');
        if (adminCreateUpdateForm) adminCreateUpdateForm.reset();
    } catch (err) {
        console.error('Error creando actualización desde admin:', err);
        setAdminCreateUpdateMessage('No se pudo publicar la actualización.', true);
    }
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
    // bind founder funds action if UI present
    if (founderAddBtn) {
        founderAddBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleFounderAddFunds();
        });
    }
    if (founderRemoveBtn) {
        founderRemoveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleFounderRemoveFunds();
        });
    }
    // Donations config toggle and bindings (only for founder)
    if (adminToggleDonationsConfigBtn && adminDonationsConfigContainer) {
        adminToggleDonationsConfigBtn.addEventListener('click', () => {
            try {
                const isHidden = adminDonationsConfigContainer.hasAttribute('hidden');
                if (isHidden) {
                    // show immediately for better UX
                    adminDonationsConfigContainer.removeAttribute('hidden');
                    if (donConfigMessage) donConfigMessage.textContent = 'Cargando...';
                    // load settings asynchronously, but don't block the UI
                    loadDonationsAdminSettings().catch((err) => {
                        console.warn('Error cargando settings donations:', err);
                        if (donConfigMessage) donConfigMessage.textContent = 'No se pudo cargar configuración (ver consola).';
                        updateDonationsPreview();
                    });
                } else {
                    adminDonationsConfigContainer.setAttribute('hidden', '');
                }
            } catch (err) {
                console.error('Error toggling donations config container:', err);
            }
        });
    }
    if (donConfigSaveBtn) {
        donConfigSaveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveDonationsAdminSettings();
            updateDonationsPreview();
        });
    }
    if (donConfigResetBtn) {
        donConfigResetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fillDonationsConfigUI(getDefaultDonationsConfig());
            updateDonationsPreview();
        });
    }

    // Live preview updates when inputs change
    [donConfigGoalInput, donConfigPaypalInput, donConfigNequiInput, donConfigBreveInput, donConfigPatreonInput].forEach((el) => {
        if (!el) return;
        el.addEventListener('input', () => {
            updateDonationsPreview();
        });
    });
}

async function handleFounderAddFunds() {
    if (!founderAddAmountInput || !founderAddBtn) return;
    const raw = founderAddAmountInput.value;
    const note = String(founderAddNoteInput?.value || '').trim();
    const amount = parseFloat(String(raw).replace(',', '.'));
    const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
    if (Number.isNaN(rounded) || rounded <= 0) {
        if (founderAddMessage) founderAddMessage.textContent = 'Ingresa un monto valido mayor que 0.';
        return;
    }

    if (founderAddBtn) founderAddBtn.disabled = true;
    if (founderAddMessage) founderAddMessage.textContent = 'Procesando...';

    // Preferred: add a donation document to 'donations' collection so progress sums include it
    try {
        if (window.db && window.collection && window.addDoc) {
            const payload = {
                amount: rounded,
                donorEmail: currentUser?.email || FOUNDER_CEO_EMAIL,
                note: note || 'Fondos agregados manualmente por founder',
                createdAt: new Date().toISOString(),
                source: 'founder_manual'
            };
            const docRef = await window.addDoc(window.collection(window.db, 'donations'), payload);
            if (founderAddMessage) founderAddMessage.textContent = 'Fondos agregados correctamente (Firestore).';
            founderAddAmountInput.value = '';
            if (founderAddNoteInput) founderAddNoteInput.value = '';
            // dispatch event with doc id and payload so listeners can refresh
            try { document.dispatchEvent(new CustomEvent('donationAdded', { detail: { id: docRef.id, ...payload } })); } catch(e){}
            return;
        }

        // Fallback: persist to localStorage for offline/dev
        const key = 'donations_local_pending_v1';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const payloadLocal = { amount: rounded, donorEmail: currentUser?.email || FOUNDER_CEO_EMAIL, note, createdAt: new Date().toISOString(), source: 'founder_local' };
        existing.push(payloadLocal);
        localStorage.setItem(key, JSON.stringify(existing));
        if (founderAddMessage) founderAddMessage.textContent = 'Fondos guardados localmente (offline).';
        founderAddAmountInput.value = '';
        if (founderAddNoteInput) founderAddNoteInput.value = '';
        try { document.dispatchEvent(new CustomEvent('donationAddedLocal', { detail: payloadLocal })); } catch(e){}
    } catch (err) {
        console.error('Error agregando fondos founder:', err);
        if (founderAddMessage) founderAddMessage.textContent = 'Error al agregar fondos. Revisa la consola.';
    } finally {
        if (founderAddBtn) founderAddBtn.disabled = false;
    }
}

async function handleFounderRemoveFunds() {
    if (!founderRemoveAmountInput || !founderRemoveBtn) return;
    const raw = founderRemoveAmountInput.value;
    const note = String(founderRemoveNoteInput?.value || '').trim();
    const amount = parseFloat(String(raw).replace(',', '.'));
    const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
    if (Number.isNaN(rounded) || rounded <= 0) {
        if (founderRemoveMessage) founderRemoveMessage.textContent = 'Ingresa un monto valido mayor que 0.';
        return;
    }

    if (founderRemoveBtn) founderRemoveBtn.disabled = true;
    if (founderRemoveMessage) founderRemoveMessage.textContent = 'Procesando eliminación...';

    try {
        if (window.db && window.collection && window.addDoc) {
            const payload = {
                amount: -rounded,
                donorEmail: currentUser?.email || FOUNDER_CEO_EMAIL,
                note: note || 'Fondos eliminados manualmente por founder',
                createdAt: new Date().toISOString(),
                source: 'founder_manual_remove'
            };
            const docRef = await window.addDoc(window.collection(window.db, 'donations'), payload);
            if (founderRemoveMessage) founderRemoveMessage.textContent = 'Saldo eliminado correctamente (Firestore).';
            founderRemoveAmountInput.value = '';
            if (founderRemoveNoteInput) founderRemoveNoteInput.value = '';
            try { document.dispatchEvent(new CustomEvent('donationAdded', { detail: { id: docRef.id, ...payload } })); } catch(e){}
            return;
        }

        // Fallback local
        const key = 'donations_local_pending_v1';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const payloadLocal = { amount: -rounded, donorEmail: currentUser?.email || FOUNDER_CEO_EMAIL, note, createdAt: new Date().toISOString(), source: 'founder_local_remove' };
        existing.push(payloadLocal);
        localStorage.setItem(key, JSON.stringify(existing));
        if (founderRemoveMessage) founderRemoveMessage.textContent = 'Cambio guardado localmente (offline).';
        founderRemoveAmountInput.value = '';
        if (founderRemoveNoteInput) founderRemoveNoteInput.value = '';
        try { document.dispatchEvent(new CustomEvent('donationAddedLocal', { detail: payloadLocal })); } catch(e){}
    } catch (err) {
        console.error('Error eliminando fondos founder:', err);
        if (founderRemoveMessage) founderRemoveMessage.textContent = 'Error al eliminar saldo. Revisa la consola.';
    } finally {
        if (founderRemoveBtn) founderRemoveBtn.disabled = false;
    }
}

function getDefaultDonationsConfig() {
    return {
        donationGoal: 500,
        paypalLink: 'https://www.paypal.com/donate/?hosted_button_id=9LJTEL67CKJP4',
        nequiLink: 'tel:+573102987151',
        breveLink: '',
        patreonLink: '',
        
        publicMessage: 'Gracias por tu apoyo. Cada aporte impulsa el desarrollo.'
    };
}

function fillDonationsConfigUI(obj) {
    if (!obj) obj = getDefaultDonationsConfig();
    if (donConfigGoalInput) donConfigGoalInput.value = Number(obj.donationGoal || 0);
    if (donConfigPaypalInput) donConfigPaypalInput.value = obj.paypalLink || '';
    if (donConfigNequiInput) donConfigNequiInput.value = obj.nequiLink || '';
    if (donConfigBreveInput) donConfigBreveInput.value = obj.breveLink || '';
    if (donConfigPatreonInput) donConfigPatreonInput.value = obj.patreonLink || '';
    if (donConfigPublicMessageInput) donConfigPublicMessageInput.value = obj.publicMessage || '';
}

function updateDonationsPreview() {
    try {
        const goal = Number(donConfigGoalInput?.value || 500);
        const current = Math.round((goal || 0) * 0.4 * 100) / 100; // sample preview at 40%
        const percent = goal ? Math.min(Math.round((current / goal) * 100), 100) : 0;
        if (previewProgressFill) {
            previewProgressFill.style.setProperty('--progress', `${percent}%`);
            previewProgressFill.setAttribute('aria-valuenow', String(percent));
            try {
                previewProgressFill.setAttribute('data-animate', 'false');
                // force reflow to restart animation
                // eslint-disable-next-line no-unused-expressions
                previewProgressFill.offsetWidth;
                previewProgressFill.setAttribute('data-animate', 'true');
            } catch (e) { /* ignore */ }
        }
        if (previewPercent) previewPercent.textContent = `${percent}%`;
        if (previewGoalText) previewGoalText.textContent = `Meta: $${goal}`;
        if (previewCurrentText) previewCurrentText.textContent = `Recaudado: $${current.toFixed(2)}`;

        // Buttons
        if (previewPaypalBtn) {
            const href = String(donConfigPaypalInput?.value || previewPaypalBtn.getAttribute('href') || '#').trim();
            if (href) previewPaypalBtn.href = href;
        }
        if (previewNequiBtn) {
            const href = String(donConfigNequiInput?.value || previewNequiBtn.getAttribute('href') || '#').trim();
            if (href) previewNequiBtn.href = href;
        }
        if (previewBreveBtn) {
            const href = String(donConfigBreveInput?.value || previewBreveBtn.getAttribute('href') || '#').trim();
            if (href) previewBreveBtn.href = href;
        }
    } catch (err) {
        console.warn('Error actualizando preview donations:', err);
    }
}

async function loadDonationsAdminSettings() {
    // Try Firestore first
    try {
        if (window.db && window.fsDoc && window.getDoc) {
            const docRef = window.fsDoc(window.db, 'settings', 'donations');
            const snap = await window.getDoc(docRef);
            if (snap && snap.exists && snap.exists()) {
                const data = snap.data() || {};
                fillDonationsConfigUI(data);
                if (donConfigMessage) donConfigMessage.textContent = 'Configuración cargada (Firestore).';
                updateDonationsPreview();
                return;
            }
        }
    } catch (err) {
        console.warn('No se pudo leer settings donations desde Firestore:', err);
    }

    // Fallback localStorage
    try {
        const key = 'donations_settings_v1';
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            fillDonationsConfigUI(parsed);
            if (donConfigMessage) donConfigMessage.textContent = 'Configuración cargada (local).';
            return;
        }
    } catch (err) {
        console.warn('No se pudo leer configuración local donations:', err);
    }

    // Default
    fillDonationsConfigUI(getDefaultDonationsConfig());
    if (donConfigMessage) donConfigMessage.textContent = 'Usando configuración por defecto.';
}

async function saveDonationsAdminSettings() {
    if (donConfigSaveBtn) donConfigSaveBtn.disabled = true;
    if (donConfigMessage) donConfigMessage.textContent = 'Guardando...';

    const payload = {
        donationGoal: Number(donConfigGoalInput?.value || 0),
        paypalLink: String(donConfigPaypalInput?.value || '').trim(),
        nequiLink: String(donConfigNequiInput?.value || '').trim(),
        breveLink: String(donConfigBreveInput?.value || '').trim(),
        patreonLink: String(donConfigPatreonInput?.value || '').trim(),
        
        publicMessage: String(donConfigPublicMessageInput?.value || '').trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.uid || ''
    };

    try {
        if (window.db && window.fsDoc && window.setDoc) {
            await window.setDoc(window.fsDoc(window.db, 'settings', 'donations'), payload, { merge: true });
            if (donConfigMessage) donConfigMessage.textContent = 'Configuración guardada en Firestore.';
            // notify listeners that donations config changed
            try { document.dispatchEvent(new CustomEvent('donationsConfigSaved', { detail: payload })); } catch(e){}
            updateDonationsPreview();
            return;
        }
    } catch (err) {
        console.error('Error guardando configuración donations en Firestore:', err);
        if (donConfigMessage) donConfigMessage.textContent = 'Error guardando en Firestore. Se intentará guardar localmente.';
    }

    // Fallback localStorage
    try {
        const key = 'donations_settings_v1';
        localStorage.setItem(key, JSON.stringify(payload));
        if (donConfigMessage) donConfigMessage.textContent = 'Configuración guardada localmente.';
        try { document.dispatchEvent(new CustomEvent('donationsConfigSaved', { detail: payload })); } catch(e){}
        updateDonationsPreview();
    } catch (err) {
        console.error('No se pudo guardar configuración donations localmente:', err);
        if (donConfigMessage) donConfigMessage.textContent = 'Error guardando configuración.';
    } finally {
        if (donConfigSaveBtn) donConfigSaveBtn.disabled = false;
    }
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
    const loginBtn = document.getElementById('adminLoginBtn');
    
    if (!user) {
        if (gateMessage) {
            gateMessage.textContent = 'Inicia sesión con tu cuenta de administrador de Google para poder guardar cambios en la base de datos.';
            gateMessage.style.color = 'var(--admin-text-secondary)';
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
            gateMessage.textContent = '❌ Tu cuenta (' + user.email + ') no tiene permisos de administrador en este panel.';
            gateMessage.style.color = 'red';
        }
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
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
    // Load projects for admin create-update UI
    try { loadAdminProjects().catch(()=>{}); } catch(e) {}
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
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (goHomeBtn) {
        goHomeBtn.addEventListener('click', () => {
            window.location.replace(toSitePath('index.html'));
        });
    }

    // Dev panel removed — no handler

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
    // Admin create-update bindings
    if (adminCreateUpdateForm) adminCreateUpdateForm.addEventListener('submit', handleAdminCreateUpdate);
    if (adminCreateUpdateReset) adminCreateUpdateReset.addEventListener('click', () => { if (adminCreateUpdateForm) adminCreateUpdateForm.reset(); setAdminCreateUpdateMessage(''); });

    // Video updates module (YouTube search)
    const ytApiKeyInput = document.getElementById('youtubeApiKey');
    const searchYtBtn = document.getElementById('adminSearchYtBtn');
    const resultsContainer = document.getElementById('ytResultsContainer');
    const resultsList = document.getElementById('ytResultsList');
    const importVidsBtn = document.getElementById('adminImportVidsBtn');
    const videosMsg = document.getElementById('adminVideosMsg');

    // Load saved API key
    if (ytApiKeyInput) {
        const savedKey = localStorage.getItem('panterYtApiKey') || '';
        ytApiKeyInput.value = savedKey;
    }

    let foundVideos = [];

    if (searchYtBtn) {
        searchYtBtn.addEventListener('click', async () => {
            const key = ytApiKeyInput.value.trim();
            if (!key) {
                videosMsg.textContent = '❌ Por favor ingresa una API Key válida.';
                videosMsg.style.color = 'var(--color-primary-light)';
                return;
            }
            localStorage.setItem('panterYtApiKey', key);
            videosMsg.textContent = '🔍 Buscando videos en YouTube...';
            videosMsg.style.color = '';

            try {
                // Search query
                const queryStr = encodeURIComponent('Nuestra Tierra Job Simulator');
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${queryStr}&type=video&key=${key}`;
                
                const res = await fetch(url);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error?.message || 'Error en la petición a YouTube');
                }
                const data = await res.json();
                
                foundVideos = data.items || [];
                if (foundVideos.length === 0) {
                    videosMsg.textContent = '⚠️ No se encontraron videos relacionados.';
                    resultsContainer.style.display = 'none';
                    return;
                }

                // Check existing videos in Firestore to avoid duplicate imports
                let existingIds = new Set();
                try {
                    const snap = await window.getDocs(window.collection(window.db, 'videos'));
                    snap.forEach(doc => {
                        const vidData = doc.data();
                        const m = vidData.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
                        if (m) existingIds.add(m[1]);
                    });
                } catch (dbErr) {
                    console.warn('No se pudieron precargar videos existentes para filtrar:', dbErr);
                }

                resultsList.innerHTML = '';
                let displayedCount = 0;

                foundVideos.forEach((item, index) => {
                    const videoId = item.id.videoId;
                    if (!videoId) return;

                    const title = item.snippet.title;
                    const channel = item.snippet.channelTitle;
                    const thumb = item.snippet.thumbnails?.default?.url || '';
                    const isAlreadyImported = existingIds.has(videoId);

                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);border-radius:6px;';
                    div.innerHTML = `
                        <input type="checkbox" id="yt_check_${index}" value="${index}" ${isAlreadyImported ? 'disabled' : 'checked'} style="width:18px;height:18px;cursor:pointer;">
                        <img src="${thumb}" style="width:70px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:0.85rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary);">${title}</div>
                            <div style="font-size:0.75rem;color:var(--color-secondary);">${channel}</div>
                        </div>
                        ${isAlreadyImported ? '<span style="font-size:0.7rem;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;">Ya agregado</span>' : ''}
                    `;
                    resultsList.appendChild(div);
                    displayedCount++;
                });

                if (displayedCount > 0) {
                    resultsContainer.style.display = 'block';
                    videosMsg.textContent = `✅ Búsqueda completada. Se encontraron ${displayedCount} videos.`;
                    videosMsg.style.color = '#10b981';
                } else {
                    videosMsg.textContent = '⚠️ No se encontraron nuevos videos que no estén ya importados.';
                    resultsContainer.style.display = 'none';
                }

            } catch (err) {
                console.error(err);
                videosMsg.textContent = `❌ Error: ${err.message}`;
                videosMsg.style.color = 'red';
                resultsContainer.style.display = 'none';
            }
        });
    }

    if (importVidsBtn) {
        importVidsBtn.addEventListener('click', async () => {
            const checkboxes = resultsList.querySelectorAll('input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                videosMsg.textContent = '⚠️ Selecciona al menos un video para importar.';
                videosMsg.style.color = 'var(--color-primary-light)';
                return;
            }

            videosMsg.textContent = `📥 Importando ${checkboxes.length} videos...`;
            videosMsg.style.color = '';

            try {
                // Get the current max order to append videos properly at the end
                let maxOrder = 0;
                try {
                    const snap = await window.getDocs(window.collection(window.db, 'videos'));
                    snap.forEach(doc => {
                        const d = doc.data();
                        if (d.orden > maxOrder) maxOrder = d.orden;
                    });
                } catch(e) {}

                let importedCount = 0;
                for (const cb of checkboxes) {
                    const idx = parseInt(cb.value);
                    const item = foundVideos[idx];
                    const videoId = item.id.videoId;
                    if (!videoId) continue;

                    maxOrder++;
                    await window.addDoc(window.collection(window.db, 'videos'), {
                        title: item.snippet.title,
                        channel: item.snippet.channelTitle,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
                        duration: '', // default empty
                        orden: maxOrder
                    });
                    importedCount++;
                }

                videosMsg.textContent = `🎉 ¡Éxito! Se importaron ${importedCount} videos correctamente.`;
                videosMsg.style.color = '#10b981';
                resultsContainer.style.display = 'none';

            } catch (err) {
                console.error(err);
                videosMsg.textContent = `❌ Error al importar: ${err.message}`;
                videosMsg.style.color = 'red';
            }
        });
    }
}

function bootAuthListener() {
    // Bind global login button click event
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn && !adminLoginBtn.dataset.bound) {
        adminLoginBtn.dataset.bound = "true";
        adminLoginBtn.addEventListener('click', async () => {
            try {
                if (window.auth && window.GoogleAuthProvider && window.signInWithPopup) {
                    const provider = new window.GoogleAuthProvider();
                    await window.signInWithPopup(window.auth, provider);
                } else {
                    alert('El servicio de autenticación de Firebase no está listo. Inténtalo de nuevo en unos segundos.');
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
