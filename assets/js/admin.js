// Admin Panel - Panter Studio (Auth + Pre-registros + Juegos + Novedades + Config)

const LS_KEY = 'panterRegistros';
const SETTINGS_DOC_PATH = ['settings', 'site'];
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

const DEFAULT_SETTINGS = {
    siteName: 'Panter Studio',
    contactEmail: '',
    preregistroCap: 1000,
    featuredNewsId: '',
    announcement: '',
    maintenanceMessage: '',
    maintenanceMode: false,
    enableNewsPage: true,
    updatedAt: ''
};

const STATUS_LABELS = {
    planning: 'Planificacion',
    development: 'En Desarrollo',
    testing: 'En Pruebas',
    released: 'Lanzado',
    paused: 'Pausado'
};

let currentUser = null;
let currentGames = [];
let currentNews = [];
let currentRegistros = [];
let currentSettings = { ...DEFAULT_SETTINGS };
let currentUsers = [];
let currentTiers = [];
let currentDonations = [];
let currentSponsors = [];

// DOM
const loginCard = document.getElementById('adminLoginCard');
const panel = document.getElementById('adminPanel');
const loginMessage = document.getElementById('adminLoginMessage');

const totalEl = document.getElementById('adminTotalRegistros');
const disponiblesEl = document.getElementById('adminDisponibles');
const capacidadEl = document.getElementById('adminCapacidad');
const totalNewsEl = document.getElementById('adminTotalNews');
const totalGamesEl = document.getElementById('adminTotalGames');
const lastSyncEl = document.getElementById('adminLastSync');
const dataSourceEl = document.getElementById('adminDataSource');
const statusTextEl = document.getElementById('adminSiteStatusText');

const tableBody = document.getElementById('adminTableBody');
const refreshBtn = document.getElementById('adminRefreshBtn');
const exportBtn = document.getElementById('adminExportBtn');
const backupBtn = document.getElementById('adminBackupBtn');
const logoutBtn = document.getElementById('adminLogoutBtn');

const gamesGrid = document.getElementById('adminGamesGrid');
const addGameBtn = document.getElementById('adminAddGameBtn');
const gameModal = document.getElementById('adminGameModal');
const gameForm = document.getElementById('adminGameForm');
const gameModalTitle = document.getElementById('adminModalTitle');

const newsGrid = document.getElementById('adminNewsGrid');
const addNewsBtn = document.getElementById('adminAddNewsBtn');
const newsModal = document.getElementById('adminNewsModal');
const newsForm = document.getElementById('adminNewsForm');
const newsModalTitle = document.getElementById('adminNewsModalTitle');
const newsSearch = document.getElementById('adminNewsSearch');
const newsStatusFilter = document.getElementById('adminNewsStatusFilter');

const settingsForm = document.getElementById('adminSettingsForm');
const settingsResetBtn = document.getElementById('adminSettingsResetBtn');
const settingsMessage = document.getElementById('adminSettingsMessage');

// DOM - Donations
const totalUsersEl = document.getElementById('adminTotalUsers');
const totalDonationsEl = document.getElementById('adminTotalDonations');
const totalCoinsEl = document.getElementById('adminTotalCoins');
const donationTotalEl = document.getElementById('adminDonationTotal');
const donorCountEl = document.getElementById('adminDonorCount');
const sponsorCountEl = document.getElementById('adminSponsorCount');
const tiersGrid = document.getElementById('adminTiersGrid');
const addTierBtn = document.getElementById('adminAddDonationTierBtn');
const tierModal = document.getElementById('adminTierModal');
const tierForm = document.getElementById('adminTierForm');
const tierModalTitle = document.getElementById('adminTierModalTitle');
const donationsTableBody = document.getElementById('adminDonationsTableBody');
const paymentLinksForm = document.getElementById('adminPaymentLinksForm');

// DOM - Users
const usersTableBody = document.getElementById('adminUsersTableBody');
const usersSearch = document.getElementById('adminUsersSearch');
const usersFilter = document.getElementById('adminUsersFilter');
const usersTotalEl = document.getElementById('adminUsersTotal');
const usersWithCoinsEl = document.getElementById('adminUsersWithCoins');
const usersVerifiedEl = document.getElementById('adminUsersVerified');
const addCoinsBtn = document.getElementById('adminAddCoinsBtn');
const coinsModal = document.getElementById('adminCoinsModal');
const coinsForm = document.getElementById('adminCoinsForm');
const exportUsersBtn = document.getElementById('adminExportUsersBtn');
const userDetailModal = document.getElementById('adminUserDetailModal');
const userDetailContent = document.getElementById('adminUserDetailContent');

// DOM - Minigames
const minigamesForm = document.getElementById('adminMinigamesForm');
const minigamesMessage = document.getElementById('adminMinigamesMessage');

function esc(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeTags(raw) {
    if (!raw) return '';
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .join(', ');
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('es-ES');
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return 'oculto';
    const [localPart, domainPart] = email.split('@');
    const safeLocal = localPart.length <= 2 ? `${localPart[0] || '*'}*` : `${localPart.slice(0, 2)}***`;
    const domainSegments = domainPart.split('.');
    const domainName = domainSegments[0] || '';
    const domainTld = domainSegments.slice(1).join('.') || '';
    const safeDomainName = domainName.length <= 2 ? `${domainName[0] || '*'}*` : `${domainName.slice(0, 2)}***`;
    return `${safeLocal}@${safeDomainName}${domainTld ? `.${domainTld}` : ''}`;
}

function getLocalRegistros() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
        return [];
    }
}

function getConfiguredAdminEmails() {
    const fromStorage = localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '';
    const storageEmails = fromStorage
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    const defaultEmails = DEFAULT_ADMIN_EMAILS
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean);

    return Array.from(new Set([...defaultEmails, ...storageEmails]));
}

function isAdminEmail(email) {
    if (!email) return false;
    return getConfiguredAdminEmails().includes(String(email).trim().toLowerCase());
}

async function waitForFirebase(timeout = 7000) {
    return new Promise((resolve) => {
        if (window.db && window.getDocs && window.collection && window.fsDoc) return resolve(true);
        const start = Date.now();
        const timer = setInterval(() => {
            if (window.db && window.getDocs && window.collection && window.fsDoc) {
                clearInterval(timer);
                resolve(true);
            } else if (Date.now() - start > timeout) {
                clearInterval(timer);
                resolve(false);
            }
        }, 100);
    });
}

async function waitForFirebaseAuth(timeout = 7000) {
    const start = Date.now();
    while (!window.auth || !window.onAuthStateChanged || !window.signOut) {
        if (Date.now() - start > timeout) {
            throw new Error('Firebase Auth no cargo a tiempo');
        }
        await new Promise((r) => setTimeout(r, 100));
    }
}

async function getRegistros() {
    const firebaseReady = await waitForFirebase();
    if (firebaseReady) {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'preregistros'));
            const rows = snap.docs.map((doc) => {
                const data = doc.data() || {};
                return { email: data.email || doc.id || 'sin-email', date: data.date || '' };
            });
            return { rows, source: 'Firebase' };
        } catch (err) {
            console.warn('Error leyendo preregistros desde Firebase, fallback localStorage', err);
            return { rows: getLocalRegistros(), source: 'localStorage (fallback)' };
        }
    }
    return { rows: getLocalRegistros(), source: 'localStorage' };
}

async function getGames() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'games'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar juegos:', err);
        return [];
    }
}

async function getNews() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'news'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar novedades:', err);
        return [];
    }
}

async function getSettings() {
    const ready = await waitForFirebase();
    if (!ready) return { ...DEFAULT_SETTINGS };
    try {
        const settingsDoc = await window.getDoc(window.fsDoc(window.db, SETTINGS_DOC_PATH[0], SETTINGS_DOC_PATH[1]));
        if (!settingsDoc.exists()) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...settingsDoc.data() };
    } catch (err) {
        console.warn('No se pudo cargar settings, usando valores por defecto', err);
        return { ...DEFAULT_SETTINGS };
    }
}

async function getUsers() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'users'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar usuarios:', err);
        return [];
    }
}

async function getTiers() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'donation_tiers'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar tiers:', err);
        return [];
    }
}

async function getDonations() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'donations'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar donaciones:', err);
        return [];
    }
}

async function getSponsors() {
    const ready = await waitForFirebase();
    if (!ready) return [];
    try {
        const snap = await window.getDocs(window.collection(window.db, 'sponsors'));
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error al cargar sponsors:', err);
        return [];
    }
}

async function getDonationSettings() {
    const ready = await waitForFirebase();
    if (!ready) return {};
    try {
        const docRef = window.fsDoc(window.db, 'settings', 'donations');
        const snapshot = await window.getDoc(docRef);
        if (!snapshot.exists()) return {};
        return snapshot.data() || {};
    } catch (err) {
        return {};
    }
}

async function getMinigameSettings() {
    const ready = await waitForFirebase();
    if (!ready) return {};
    try {
        const docRef = window.fsDoc(window.db, 'settings', 'minigames');
        const snapshot = await window.getDoc(docRef);
        if (!snapshot.exists()) return {};
        return snapshot.data() || {};
    } catch (err) {
        return {};
    }
}

function renderTable(registros) {
    if (!registros.length) {
        tableBody.innerHTML = '<tr><td colspan="3">No hay registros todavia.</td></tr>';
        return;
    }

    const sorted = [...registros].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 200);

    tableBody.innerHTML = recent
        .map((row, idx) => {
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${esc(maskEmail(row.email))}</td>
                    <td>${esc(formatDate(row.date))}</td>
                </tr>
            `;
        })
        .join('');
}

function renderGames() {
    if (!currentGames.length) {
        gamesGrid.innerHTML = '<p>No hay juegos creados. Agrega uno nuevo.</p>';
        return;
    }

    gamesGrid.innerHTML = currentGames
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map((game) => {
            const tags = normalizeTags(game.tags)
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => `<span class="game-tag">${esc(t)}</span>`)
                .join('');
            const releaseDate = game.releaseDate ? `<small>Lanzamiento: ${esc(game.releaseDate)}</small>` : '';
            const statusLabel = STATUS_LABELS[game.status] || game.status || 'Sin estado';

            return `
                <article class="game-card" data-id="${esc(game.id)}">
                    ${game.image ? `<img src="${esc(game.image)}" alt="${esc(game.title)}" class="game-card-image">` : ''}
                    <div class="game-card-body">
                        <h4>${esc(game.title)}</h4>
                        <p class="game-status status-${esc(game.status || 'planning')}">${esc(statusLabel)}</p>
                        <p>${esc(game.description || '')}</p>
                        ${releaseDate}
                        <div class="game-tags">${tags}</div>
                    </div>
                    <div class="game-card-actions">
                        <button data-edit-game="${esc(game.id)}" class="btn-small">Editar</button>
                        <button data-delete-game="${esc(game.id)}" class="btn-small btn-danger">Eliminar</button>
                    </div>
                </article>
            `;
        })
        .join('');
}

function renderNews() {
    const status = newsStatusFilter.value;
    const query = newsSearch.value.trim().toLowerCase();

    const filtered = currentNews
        .filter((item) => {
            if (status === 'published') return item.published === true;
            if (status === 'draft') return item.published !== true;
            return true;
        })
        .filter((item) => {
            if (!query) return true;
            const haystack = `${item.title || ''} ${item.tags || ''} ${item.category || ''}`.toLowerCase();
            return haystack.includes(query);
        })
        .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0);
        });

    if (!filtered.length) {
        newsGrid.innerHTML = '<p>No hay novedades que coincidan con el filtro.</p>';
        return;
    }

    newsGrid.innerHTML = filtered
        .map((item) => {
            const tags = normalizeTags(item.tags)
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => `<span class="admin-chip">${esc(t)}</span>`)
                .join('');

            return `
                <article class="admin-news-card" data-id="${esc(item.id)}">
                    ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" class="admin-news-image">` : ''}
                    <div class="admin-news-body">
                        <div class="admin-news-top-row">
                            <h4>${esc(item.title || 'Sin titulo')}</h4>
                            <span class="admin-news-state ${item.published ? 'is-published' : 'is-draft'}">${item.published ? 'Publicado' : 'Borrador'}</span>
                        </div>
                        <p>${esc(item.summary || '')}</p>
                        <small>${esc(formatDate(item.date || item.updatedAt || item.createdAt))}</small>
                        <div class="admin-chip-row">${tags}${item.pinned ? '<span class="admin-chip pin-chip">Fijado</span>' : ''}</div>
                    </div>
                    <div class="game-card-actions">
                        <button data-edit-news="${esc(item.id)}" class="btn-small">Editar</button>
                        <button data-delete-news="${esc(item.id)}" class="btn-small btn-danger">Eliminar</button>
                    </div>
                </article>
            `;
        })
        .join('');
}

function renderSettingsForm() {
    document.getElementById('settingSiteName').value = currentSettings.siteName || '';
    document.getElementById('settingContactEmail').value = currentSettings.contactEmail || '';
    document.getElementById('settingPreregCap').value = String(currentSettings.preregistroCap || 1000);
    document.getElementById('settingFeaturedNewsId').value = currentSettings.featuredNewsId || '';
    document.getElementById('settingAnnouncement').value = currentSettings.announcement || '';
    document.getElementById('settingMaintenanceMessage').value = currentSettings.maintenanceMessage || '';
    document.getElementById('settingMaintenanceMode').checked = currentSettings.maintenanceMode === true;
    document.getElementById('settingEnableNewsPage').checked = currentSettings.enableNewsPage !== false;
}

function renderMetaStats(source) {
    const cap = Number(currentSettings.preregistroCap) > 0 ? Number(currentSettings.preregistroCap) : 1000;
    const total = currentRegistros.length;

    totalEl.textContent = String(total);
    capacidadEl.textContent = String(cap);
    disponiblesEl.textContent = String(Math.max(cap - total, 0));
    totalNewsEl.textContent = String(currentNews.filter((n) => n.published).length);
    totalGamesEl.textContent = String(currentGames.length);
    dataSourceEl.textContent = `Fuente de datos: ${source}`;
    lastSyncEl.textContent = formatDate(new Date().toISOString());
    statusTextEl.textContent = currentSettings.maintenanceMode
        ? `Mantenimiento activo: ${currentSettings.maintenanceMessage || 'sin mensaje'}`
        : 'Sitio activo para visitantes';

    // New stats
    if (totalUsersEl) totalUsersEl.textContent = String(currentUsers.length);
    const totalDonated = currentDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    if (totalDonationsEl) totalDonationsEl.textContent = `$${totalDonated.toFixed(2)}`;
    const totalCoins = currentUsers.reduce((sum, u) => sum + (Number(u.coins) || 0), 0);
    if (totalCoinsEl) totalCoinsEl.textContent = String(totalCoins);
}

function renderTiers() {
    if (!tiersGrid) return;
    if (!currentTiers.length) {
        tiersGrid.innerHTML = '<p>No hay niveles de donacion creados.</p>';
        return;
    }

    const sorted = currentTiers.sort((a, b) => (a.amount || 0) - (b.amount || 0));
    tiersGrid.innerHTML = sorted
        .map((tier) => {
            const badgeStyle = tier.color ? `background: ${tier.color};` : '';
            return `
                <article class="admin-tier-card ${tier.featured ? 'tier-featured' : ''}" data-id="${esc(tier.id)}">
                    <div class="tier-header">
                        <span class="tier-badge-admin" style="${badgeStyle}">${esc(tier.badge || '⭐')}</span>
                        <h4>${esc(tier.name)}</h4>
                        <span class="tier-amount-admin">$${Number(tier.amount || 0).toFixed(2)}</span>
                    </div>
                    <p>${esc(tier.description || '').slice(0, 100)}</p>
                    <div class="admin-chip-row">
                        <span class="admin-chip">+${tier.coins || 0} monedas</span>
                        ${tier.active !== false ? '<span class="admin-chip">Activo</span>' : '<span class="admin-chip">Inactivo</span>'}
                    </div>
                    <div class="game-card-actions">
                        <button data-edit-tier="${esc(tier.id)}" class="btn-small">Editar</button>
                        <button data-delete-tier="${esc(tier.id)}" class="btn-small btn-danger">Eliminar</button>
                    </div>
                </article>
            `;
        })
        .join('');
}

function renderDonationsTable() {
    if (!donationsTableBody) return;
    if (!currentDonations.length) {
        donationsTableBody.innerHTML = '<tr><td colspan="6">Sin donaciones registradas</td></tr>';
        return;
    }

    const sorted = [...currentDonations].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    donationsTableBody.innerHTML = sorted.slice(0, 50)
        .map((d, idx) => {
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${esc(d.userEmail || d.userId || 'Anonimo')}</td>
                    <td>$${Number(d.amount || 0).toFixed(2)}</td>
                    <td>${esc(d.tierName || '-')}</td>
                    <td>${esc(formatDate(d.createdAt))}</td>
                    <td><span class="admin-chip ${d.status === 'completed' ? 'is-published' : ''}">${esc(d.status || 'pending')}</span></td>
                </tr>
            `;
        })
        .join('');
}

function renderDonationsSummary() {
    const totalDonated = currentDonations.filter(d => d.status === 'completed').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const uniqueDonors = new Set(currentDonations.map(d => d.userId || d.userEmail)).size;
    const activeSponsors = currentSponsors.filter(s => s.visible !== false).length;

    if (donationTotalEl) donationTotalEl.textContent = `$${totalDonated.toFixed(2)}`;
    if (donorCountEl) donorCountEl.textContent = String(uniqueDonors);
    if (sponsorCountEl) sponsorCountEl.textContent = String(activeSponsors);
}

function renderUsers() {
    if (!usersTableBody) return;
    const filter = usersFilter ? usersFilter.value : 'all';
    const query = usersSearch ? usersSearch.value.trim().toLowerCase() : '';

    let filtered = currentUsers
        .filter((u) => {
            if (filter === 'donors') return (u.totalDonated || 0) > 0;
            if (filter === 'sponsors') return u.level && u.level !== 'visitor';
            if (filter === 'active') {
                const lastActive = new Date(u.updatedAt || u.createdAt || 0);
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return lastActive > sevenDaysAgo;
            }
            return true;
        })
        .filter((u) => {
            if (!query) return true;
            const haystack = `${u.email || ''} ${u.displayName || ''}`.toLowerCase();
            return haystack.includes(query);
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (usersTotalEl) usersTotalEl.textContent = String(filtered.length);
    if (usersWithCoinsEl) usersWithCoinsEl.textContent = String(filtered.filter(u => (u.coins || 0) > 0).length);
    if (usersVerifiedEl) usersVerifiedEl.textContent = String(filtered.filter(u => u.emailVerified).length);

    if (!filtered.length) {
        usersTableBody.innerHTML = '<tr><td colspan="8">No hay usuarios que coincidan</td></tr>';
        return;
    }

    usersTableBody.innerHTML = filtered.slice(0, 100)
        .map((u, idx) => {
            const levelBadge = getLevelBadge(u.level);
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td><span class="user-avatar-mini">${esc(u.avatar || '👤')}</span></td>
                    <td>${esc(u.displayName || '-')}</td>
                    <td>${esc(maskEmail(u.email))}</td>
                    <td>${u.coins || 0} 🪙</td>
                    <td><span class="admin-chip">${levelBadge}</span></td>
                    <td>${esc(formatDate(u.createdAt))}</td>
                    <td>
                        <button data-view-user="${esc(u.id)}" class="btn-small">Ver</button>
                        <button data-add-coins-user="${esc(u.id)}" class="btn-small">+🪙</button>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function getLevelBadge(level) {
    const badges = {
        visitor: '👤 Visitante',
        supporter: '💖 Apoyo',
        bronze: '🥉 Bronce',
        silver: '🥈 Plata',
        gold: '🥇 Oro',
        platinum: '💎 Platino',
        founder: '🏆 Fundador'
    };
    return badges[level] || '👤 Visitante';
}

function renderPaymentLinksForm(donationSettings) {
    if (!paymentLinksForm) return;
    const paypalEl = document.getElementById('settingPaypalLink');
    const kofiEl = document.getElementById('settingKofiLink');
    const patreonEl = document.getElementById('settingPatreonLink');
    const mercadopagoEl = document.getElementById('settingMercadoPagoLink');

    if (paypalEl) paypalEl.value = donationSettings.paypalLink || '';
    if (kofiEl) kofiEl.value = donationSettings.kofiLink || '';
    if (patreonEl) patreonEl.value = donationSettings.patreonLink || '';
    if (mercadopagoEl) mercadopagoEl.value = donationSettings.mercadopagoLink || '';
}

function renderMinigamesForm(minigameSettings) {
    if (!minigamesForm) return;
    const dailySpinEnabled = document.getElementById('settingDailySpinEnabled');
    const dailySpinMax = document.getElementById('settingDailySpinMax');
    const dailyBonusCoins = document.getElementById('settingDailyBonusCoins');
    const referralCoins = document.getElementById('settingReferralCoins');

    if (dailySpinEnabled) dailySpinEnabled.checked = minigameSettings.dailySpinEnabled !== false;
    if (dailySpinMax) dailySpinMax.value = String(minigameSettings.dailySpinMax || 100);
    if (dailyBonusCoins) dailyBonusCoins.value = String(minigameSettings.dailyBonusCoins || 10);
    if (referralCoins) referralCoins.value = String(minigameSettings.referralCoins || 50);
}

async function saveGame(gameData) {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    try {
        if (gameData.id) {
            const id = gameData.id;
            delete gameData.id;
            const docRef = window.fsDoc(window.db, 'games', id);
            await window.updateDoc(docRef, gameData);
        } else {
            delete gameData.id;
            gameData.createdAt = new Date().toISOString();
            await window.addDoc(window.collection(window.db, 'games'), gameData);
        }
        currentGames = await getGames();
        renderGames();
        renderMetaStats('Firebase');
        gameModal.close();
    } catch (err) {
        console.error('Error al guardar juego:', err);
        alert(`Error al guardar juego: ${err.message}`);
    }
}

async function saveNews(newsData) {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    try {
        if (newsData.id) {
            const id = newsData.id;
            delete newsData.id;
            await window.updateDoc(window.fsDoc(window.db, 'news', id), newsData);
        } else {
            delete newsData.id;
            newsData.createdAt = new Date().toISOString();
            await window.addDoc(window.collection(window.db, 'news'), newsData);
        }
        currentNews = await getNews();
        renderNews();
        renderMetaStats('Firebase');
        newsModal.close();
    } catch (err) {
        console.error('Error al guardar novedad:', err);
        alert(`Error al guardar novedad: ${err.message}`);
    }
}

async function deleteGame(gameId) {
    if (!confirm('Eliminar este juego permanentemente?')) return;
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }
    try {
        await window.deleteDoc(window.fsDoc(window.db, 'games', gameId));
        currentGames = currentGames.filter((g) => g.id !== gameId);
        renderGames();
        renderMetaStats('Firebase');
    } catch (err) {
        alert(`No se pudo eliminar: ${err.message}`);
    }
}

async function deleteNews(newsId) {
    if (!confirm('Eliminar esta novedad permanentemente?')) return;
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }
    try {
        await window.deleteDoc(window.fsDoc(window.db, 'news', newsId));
        currentNews = currentNews.filter((n) => n.id !== newsId);
        renderNews();
        renderMetaStats('Firebase');
    } catch (err) {
        alert(`No se pudo eliminar: ${err.message}`);
    }
}

// ===== TIER CRUD =====
async function saveTier(tierData) {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    try {
        if (tierData.id) {
            const id = tierData.id;
            delete tierData.id;
            await window.updateDoc(window.fsDoc(window.db, 'donation_tiers', id), tierData);
        } else {
            delete tierData.id;
            tierData.createdAt = new Date().toISOString();
            await window.addDoc(window.collection(window.db, 'donation_tiers'), tierData);
        }
        currentTiers = await getTiers();
        renderTiers();
        renderMetaStats('Firebase');
        if (tierModal) tierModal.close();
    } catch (err) {
        console.error('Error al guardar tier:', err);
        alert(`Error al guardar nivel de donacion: ${err.message}`);
    }
}

async function deleteTier(tierId) {
    if (!confirm('Eliminar este nivel de donacion permanentemente?')) return;
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }
    try {
        await window.deleteDoc(window.fsDoc(window.db, 'donation_tiers', tierId));
        currentTiers = currentTiers.filter((t) => t.id !== tierId);
        renderTiers();
        renderMetaStats('Firebase');
    } catch (err) {
        alert(`No se pudo eliminar: ${err.message}`);
    }
}

function openEditTier(tierId) {
    const tier = currentTiers.find((t) => t.id === tierId);
    if (!tier || !tierModal) return;

    const titleEl = document.getElementById('tierModalTitle');
    if (titleEl) titleEl.textContent = 'Editar Nivel';
    document.getElementById('tierId').value = tier.id;
    document.getElementById('tierName').value = tier.name || '';
    document.getElementById('tierAmount').value = tier.amount || 0;
    document.getElementById('tierCoins').value = tier.coins || 0;
    document.getElementById('tierBadge').value = tier.badge || '';
    document.getElementById('tierColor').value = tier.color || '#ff0066';
    document.getElementById('tierDescription').value = tier.description || '';
    const benefits = document.getElementById('tierBenefits');
    if (benefits) benefits.value = (tier.benefits || []).join('\n');
    const featuredEl = document.getElementById('tierFeatured');
    if (featuredEl) featuredEl.checked = tier.featured === true;
    const activeEl = document.getElementById('tierActive');
    if (activeEl) activeEl.checked = tier.active !== false;
    tierModal.showModal();
}

// ===== USER COINS =====
let selectedUserForCoins = null;

function openAddCoinsModal(userId) {
    const user = currentUsers.find((u) => u.id === userId);
    if (!user || !coinsModal) return;
    selectedUserForCoins = user;

    const userInfoEl = document.getElementById('coinsUserInfo');
    if (userInfoEl) {
        userInfoEl.textContent = `${user.displayName || 'Usuario'} (${maskEmail(user.email)}) - Actual: ${user.coins || 0} 🪙`;
    }
    document.getElementById('coinsAmount').value = '';
    document.getElementById('coinsReason').value = '';
    coinsModal.showModal();
}

async function addCoinsToUser(userId, amount, reason) {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    const user = currentUsers.find((u) => u.id === userId);
    if (!user) {
        alert('Usuario no encontrado');
        return;
    }

    const newCoins = Math.max(0, (user.coins || 0) + amount);
    try {
        await window.updateDoc(window.fsDoc(window.db, 'users', userId), {
            coins: newCoins,
            updatedAt: new Date().toISOString()
        });
        // Log the coin transaction
        await window.addDoc(window.collection(window.db, 'users', userId, 'activity'), {
            type: amount > 0 ? 'coins_added' : 'coins_removed',
            amount: amount,
            reason: reason || 'Admin adjustment',
            adminAction: true,
            createdAt: new Date().toISOString()
        });
        user.coins = newCoins;
        renderUsers();
        renderMetaStats('Firebase');
        if (coinsModal) coinsModal.close();
        alert(`Monedas actualizadas. Nuevo balance: ${newCoins} 🪙`);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// ===== DONATION SETTINGS =====
async function savePaymentLinks() {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    const paymentData = {
        paypalLink: document.getElementById('settingPaypalLink')?.value.trim() || '',
        kofiLink: document.getElementById('settingKofiLink')?.value.trim() || '',
        patreonLink: document.getElementById('settingPatreonLink')?.value.trim() || '',
        mercadopagoLink: document.getElementById('settingMercadoPagoLink')?.value.trim() || '',
        updatedAt: new Date().toISOString()
    };

    try {
        await window.setDoc(window.fsDoc(window.db, 'settings', 'donations'), paymentData, { merge: true });
        alert('Enlaces de pago guardados.');
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

async function saveMinigamesSettings() {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    const minigamesData = {
        dailySpinEnabled: document.getElementById('settingDailySpinEnabled')?.checked ?? true,
        dailySpinMax: Number(document.getElementById('settingDailySpinMax')?.value) || 100,
        dailyBonusCoins: Number(document.getElementById('settingDailyBonusCoins')?.value) || 10,
        referralCoins: Number(document.getElementById('settingReferralCoins')?.value) || 50,
        updatedAt: new Date().toISOString()
    };

    try {
        await window.setDoc(window.fsDoc(window.db, 'settings', 'minigames'), minigamesData, { merge: true });
        alert('Configuracion de minijuegos guardada.');
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

function openEditGame(gameId) {
    const game = currentGames.find((g) => g.id === gameId);
    if (!game) return;

    gameModalTitle.textContent = 'Editar Juego';
    document.getElementById('gameId').value = game.id;
    document.getElementById('gameTitle').value = game.title || '';
    document.getElementById('gameDescription').value = game.description || '';
    document.getElementById('gameImage').value = game.image || '';
    document.getElementById('gameStatus').value = game.status || 'planning';
    document.getElementById('gameReleaseDate').value = game.releaseDate || '';
    document.getElementById('gameTags').value = game.tags || '';
    gameModal.showModal();
}

function openEditNews(newsId) {
    const item = currentNews.find((n) => n.id === newsId);
    if (!item) return;

    newsModalTitle.textContent = 'Editar Novedad';
    document.getElementById('newsId').value = item.id;
    document.getElementById('newsTitle').value = item.title || '';
    document.getElementById('newsSummary').value = item.summary || '';
    document.getElementById('newsContent').value = item.content || '';
    document.getElementById('newsImage').value = item.image || '';
    document.getElementById('newsCategory').value = item.category || '';
    document.getElementById('newsTags').value = item.tags || '';
    document.getElementById('newsDate').value = item.date ? String(item.date).slice(0, 10) : '';
    document.getElementById('newsPublished').checked = item.published === true;
    document.getElementById('newsPinned').checked = item.pinned === true;
    newsModal.showModal();
}

function toCSV(rows) {
    const header = 'email_masked,date';
    const lines = rows.map((r) => {
        const email = maskEmail(r.email || '').replaceAll('"', '""');
        const date = (r.date || '').replaceAll('"', '""');
        return `"${email}","${date}"`;
    });
    return [header, ...lines].join('\n');
}

async function exportCSV() {
    const result = await getRegistros();
    const csv = toCSV(result.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'preregistros-panterstudio.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function exportBackupJSON() {
    const payload = {
        exportedAt: new Date().toISOString(),
        preregistros: currentRegistros,
        games: currentGames,
        news: currentNews,
        settings: currentSettings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'panter-admin-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function loadAllDashboardData() {
    const [regResult, games, news, settings, users, tiers, donations, sponsors, donationSettings, minigameSettings] = await Promise.all([
        getRegistros(),
        getGames(),
        getNews(),
        getSettings(),
        getUsers(),
        getTiers(),
        getDonations(),
        getSponsors(),
        getDonationSettings(),
        getMinigameSettings()
    ]);

    currentRegistros = regResult.rows || [];
    currentGames = games || [];
    currentNews = news || [];
    currentSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    currentUsers = users || [];
    currentTiers = tiers || [];
    currentDonations = donations || [];
    currentSponsors = sponsors || [];

    renderTable(currentRegistros);
    renderGames();
    renderNews();
    renderSettingsForm();
    renderMetaStats(regResult.source);

    // New sections
    renderTiers();
    renderDonationsTable();
    renderDonationsSummary();
    renderUsers();
    renderPaymentLinksForm(donationSettings || {});
    renderMinigamesForm(minigameSettings || {});
}

function showPanel() {
    loginCard.hidden = true;
    panel.hidden = false;
    loadAllDashboardData();
}

function showLogin() {
    loginCard.hidden = false;
    panel.hidden = true;
}

function redirectToHome(message) {
    loginMessage.textContent = message;
    loginMessage.className = 'admin-message error';
    showLogin();
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1400);
}

function handleAuthStateChange(user) {
    currentUser = user;
    if (!user) {
        redirectToHome('Debes iniciar sesión con una cuenta admin para acceder al panel.');
        return;
    }

    if (!isAdminEmail(user.email || '')) {
        redirectToHome('Tu cuenta no tiene permisos de administrador.');
        return;
    }

    loginMessage.textContent = '';
    loginMessage.className = 'admin-message';
    showPanel();
}

async function handleLogout() {
    try {
        await window.signOut(window.auth);
    } catch (err) {
        console.error('Error logout:', err);
    }
}

// Events
refreshBtn.addEventListener('click', loadAllDashboardData);
exportBtn.addEventListener('click', exportCSV);
backupBtn.addEventListener('click', exportBackupJSON);
logoutBtn.addEventListener('click', handleLogout);

addGameBtn.addEventListener('click', () => {
    gameModalTitle.textContent = 'Nuevo Juego';
    gameForm.reset();
    document.getElementById('gameId').value = '';
    gameModal.showModal();
});

gameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const gameData = {
        id: document.getElementById('gameId').value || null,
        title: document.getElementById('gameTitle').value.trim(),
        description: document.getElementById('gameDescription').value.trim(),
        image: document.getElementById('gameImage').value.trim(),
        status: document.getElementById('gameStatus').value,
        releaseDate: document.getElementById('gameReleaseDate').value,
        tags: normalizeTags(document.getElementById('gameTags').value),
        updatedAt: new Date().toISOString()
    };
    saveGame(gameData);
});

gamesGrid.addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit-game]');
    const deleteBtn = event.target.closest('[data-delete-game]');
    if (editBtn) openEditGame(editBtn.dataset.editGame);
    if (deleteBtn) deleteGame(deleteBtn.dataset.deleteGame);
});

addNewsBtn.addEventListener('click', () => {
    newsModalTitle.textContent = 'Nueva Novedad';
    newsForm.reset();
    document.getElementById('newsId').value = '';
    document.getElementById('newsPublished').checked = true;
    newsModal.showModal();
});

newsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const newsData = {
        id: document.getElementById('newsId').value || null,
        title: document.getElementById('newsTitle').value.trim(),
        summary: document.getElementById('newsSummary').value.trim(),
        content: document.getElementById('newsContent').value.trim(),
        image: document.getElementById('newsImage').value.trim(),
        category: document.getElementById('newsCategory').value.trim(),
        tags: normalizeTags(document.getElementById('newsTags').value),
        date: document.getElementById('newsDate').value || now,
        published: document.getElementById('newsPublished').checked,
        pinned: document.getElementById('newsPinned').checked,
        updatedAt: now
    };
    saveNews(newsData);
});

newsGrid.addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit-news]');
    const deleteBtn = event.target.closest('[data-delete-news]');
    if (editBtn) openEditNews(editBtn.dataset.editNews);
    if (deleteBtn) deleteNews(deleteBtn.dataset.deleteNews);
});

newsSearch.addEventListener('input', renderNews);
newsStatusFilter.addEventListener('change', renderNews);

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ready = await waitForFirebase();
    if (!ready) {
        settingsMessage.textContent = 'Firebase no disponible. No se guardo configuracion.';
        settingsMessage.className = 'admin-message error';
        return;
    }

    const nextSettings = {
        siteName: document.getElementById('settingSiteName').value.trim(),
        contactEmail: document.getElementById('settingContactEmail').value.trim(),
        preregistroCap: Math.max(1, Number(document.getElementById('settingPreregCap').value) || 1000),
        featuredNewsId: document.getElementById('settingFeaturedNewsId').value.trim(),
        announcement: document.getElementById('settingAnnouncement').value.trim(),
        maintenanceMessage: document.getElementById('settingMaintenanceMessage').value.trim(),
        maintenanceMode: document.getElementById('settingMaintenanceMode').checked,
        enableNewsPage: document.getElementById('settingEnableNewsPage').checked,
        updatedAt: new Date().toISOString()
    };

    try {
        await window.setDoc(window.fsDoc(window.db, SETTINGS_DOC_PATH[0], SETTINGS_DOC_PATH[1]), nextSettings, { merge: true });
        currentSettings = { ...DEFAULT_SETTINGS, ...nextSettings };
        renderMetaStats('Firebase');
        settingsMessage.textContent = 'Configuracion guardada correctamente.';
        settingsMessage.className = 'admin-message';
    } catch (err) {
        settingsMessage.textContent = `Error guardando configuracion: ${err.message}`;
        settingsMessage.className = 'admin-message error';
    }
});

settingsResetBtn.addEventListener('click', () => {
    renderSettingsForm();
    settingsMessage.textContent = '';
});

// ===== TIER EVENTS =====
const addTierBtn = document.getElementById('addTierBtn');
const tierForm = document.getElementById('tierForm');

if (addTierBtn) {
    addTierBtn.addEventListener('click', () => {
        const titleEl = document.getElementById('tierModalTitle');
        if (titleEl) titleEl.textContent = 'Nuevo Nivel de Donacion';
        if (tierForm) tierForm.reset();
        document.getElementById('tierId').value = '';
        document.getElementById('tierColor').value = '#ff0066';
        document.getElementById('tierActive').checked = true;
        if (tierModal) tierModal.showModal();
    });
}

if (tierForm) {
    tierForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const benefitsRaw = document.getElementById('tierBenefits')?.value || '';
        const benefits = benefitsRaw.split('\n').map(b => b.trim()).filter(Boolean);

        const tierData = {
            id: document.getElementById('tierId').value || null,
            name: document.getElementById('tierName').value.trim(),
            amount: Number(document.getElementById('tierAmount').value) || 0,
            coins: Number(document.getElementById('tierCoins').value) || 0,
            badge: document.getElementById('tierBadge').value.trim() || '⭐',
            color: document.getElementById('tierColor').value || '#ff0066',
            description: document.getElementById('tierDescription').value.trim(),
            benefits: benefits,
            featured: document.getElementById('tierFeatured')?.checked || false,
            active: document.getElementById('tierActive')?.checked !== false,
            updatedAt: new Date().toISOString()
        };
        saveTier(tierData);
    });
}

if (tiersGrid) {
    tiersGrid.addEventListener('click', (event) => {
        const editBtn = event.target.closest('[data-edit-tier]');
        const deleteBtn = event.target.closest('[data-delete-tier]');
        if (editBtn) openEditTier(editBtn.dataset.editTier);
        if (deleteBtn) deleteTier(deleteBtn.dataset.deleteTier);
    });
}

// ===== USERS EVENTS =====
if (usersSearch) {
    usersSearch.addEventListener('input', renderUsers);
}

if (usersFilter) {
    usersFilter.addEventListener('change', renderUsers);
}

if (usersTableBody) {
    usersTableBody.addEventListener('click', (event) => {
        const addCoinsBtn = event.target.closest('[data-add-coins-user]');
        const viewBtn = event.target.closest('[data-view-user]');
        if (addCoinsBtn) openAddCoinsModal(addCoinsBtn.dataset.addCoinsUser);
        if (viewBtn) {
            const user = currentUsers.find(u => u.id === viewBtn.dataset.viewUser);
            if (user) alert(`Usuario: ${user.displayName || '-'}\nEmail: ${user.email}\nMonedas: ${user.coins || 0}\nNivel: ${getLevelBadge(user.level)}\nRegistrado: ${formatDate(user.createdAt)}`);
        }
    });
}

const coinsForm = document.getElementById('coinsForm');
if (coinsForm) {
    coinsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedUserForCoins) return;
        const amount = Number(document.getElementById('coinsAmount').value) || 0;
        const reason = document.getElementById('coinsReason').value.trim();
        if (amount === 0) {
            alert('Ingresa una cantidad diferente de 0');
            return;
        }
        addCoinsToUser(selectedUserForCoins.id, amount, reason);
    });
}

// ===== PAYMENT LINKS EVENTS =====
if (paymentLinksForm) {
    paymentLinksForm.addEventListener('submit', (e) => {
        e.preventDefault();
        savePaymentLinks();
    });
}

// ===== MINIGAMES EVENTS =====
if (minigamesForm) {
    minigamesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMinigamesSettings();
    });
}

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        const modal = document.getElementById(modalId);
        if (modal && typeof modal.close === 'function') modal.close();
    });
});

(async function init() {
    try {
        await waitForFirebaseAuth();
        window.onAuthStateChanged(window.auth, handleAuthStateChange);
    } catch (err) {
        console.error('Error inicializando auth:', err);
        loginMessage.textContent = 'Error: Firebase no cargo correctamente';
        loginMessage.className = 'error';
    }
})();
