// ──────────────────────────────────────────────────────────────────
// Admin Panel - Panter Studio (Firebase Auth + Games Management)
// ──────────────────────────────────────────────────────────────────

const LS_KEY = 'panterRegistros';
const MAX_PREREGISTROS = 1000;

let currentUser = null;
let currentGames = [];

// ──────────────────────────────────────────────────────────────────
// DOM Elements
// ──────────────────────────────────────────────────────────────────

const loginCard = document.getElementById('adminLoginCard');
const panel = document.getElementById('adminPanel');
const loginForm = document.getElementById('adminLoginForm');
const loginMessage = document.getElementById('adminLoginMessage');
const totalEl = document.getElementById('adminTotalRegistros');
const disponiblesEl = document.getElementById('adminDisponibles');
const dataSourceEl = document.getElementById('adminDataSource');
const tableBody = document.getElementById('adminTableBody');
const refreshBtn = document.getElementById('adminRefreshBtn');
const exportBtn = document.getElementById('adminExportBtn');
const logoutBtn = document.getElementById('adminLogoutBtn');

const gamesGrid = document.getElementById('adminGamesGrid');
const addGameBtn = document.getElementById('adminAddGameBtn');
const gameModal = document.getElementById('adminGameModal');
const gameForm = document.getElementById('adminGameForm');
const modalTitle = document.getElementById('adminModalTitle');

// ──────────────────────────────────────────────────────────────────
// Firebase Auth Real
// ──────────────────────────────────────────────────────────────────

async function waitForFirebaseAuth(timeout = 7000) {
  const start = Date.now();
  while (!window.auth || !window.signInWithEmailAndPassword) {
    if (Date.now() - start > timeout) {
      throw new Error('Firebase Auth no cargó a tiempo');
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

function isAuthenticated() {
  return currentUser !== null;
}

function handleAuthStateChange(user) {
  currentUser = user;
  if (user) {
    showPanel();
  } else {
    showLogin();
  }
}

// ──────────────────────────────────────────────────────────────────
// Pre-registros
// ──────────────────────────────────────────────────────────────────

function getLocalRegistros() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
        return [];
    }
}

async function waitForFirebase(timeout = 7000) {
    return new Promise((resolve) => {
        if (window.db && window.getDocs && window.collection) return resolve(true);
        const start = Date.now();
        const timer = setInterval(() => {
            if (window.db && window.getDocs && window.collection) {
                clearInterval(timer);
                resolve(true);
            } else if (Date.now() - start > timeout) {
                clearInterval(timer);
                resolve(false);
            }
        }, 100);
    });
}

async function getRegistros() {
    const firebaseReady = await waitForFirebase();
    if (firebaseReady) {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'preregistros'));
            const rows = snap.docs.map((doc) => {
                const data = doc.data() || {};
                return {
                    email: data.email || doc.id || 'sin-email',
                    date: data.date || '',
                };
            });
            return { rows, source: 'Firebase' };
        } catch {
            const rows = getLocalRegistros();
            return { rows, source: 'localStorage (fallback)' };
        }
    }

    return { rows: getLocalRegistros(), source: 'localStorage' };
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
    const safeLocal = localPart.length <= 2
        ? `${localPart[0] || '*'}*`
        : `${localPart.slice(0, 2)}***`;
    const domainSegments = domainPart.split('.');
    const domainName = domainSegments[0] || '';
    const domainTld = domainSegments.slice(1).join('.') || '';
    const safeDomainName = domainName.length <= 2
        ? `${domainName[0] || '*'}*`
        : `${domainName.slice(0, 2)}***`;
    return `${safeLocal}@${safeDomainName}${domainTld ? `.${domainTld}` : ''}`;
}

function renderTable(registros) {
    if (!registros.length) {
        tableBody.innerHTML = '<tr><td colspan="3">No hay registros todavia.</td></tr>';
        return;
    }

    const sorted = [...registros].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 200);

    tableBody.innerHTML = recent
        .map((row, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${maskEmail(row.email)}</td>
                <td>${formatDate(row.date)}</td>
            </tr>
        `)
        .join('');
}

function renderStats(total, source) {
    totalEl.textContent = String(total);
    disponiblesEl.textContent = String(Math.max(MAX_PREREGISTROS - total, 0));
    dataSourceEl.textContent = `Fuente de datos: ${source}`;
}

async function loadRegistros() {
    const result = await getRegistros();
    const registros = result.rows || [];
    renderStats(registros.length, result.source);
    renderTable(registros);
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

// ──────────────────────────────────────────────────────────────────
// Gestion de Juegos (CRUD)
// ──────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
    planning: 'Planificación',
    development: 'En Desarrollo',
    testing: 'En Pruebas',
    released: 'Lanzado',
    paused: 'Pausado'
};

async function getGames() {
    const ready = await waitForFirebase();
    if (!ready) {
        gamesGrid.innerHTML = '<p class="error">Firebase no disponible</p>';
        return [];
    }

    try {
        const snap = await window.getDocs(window.collection(window.db, 'games'));
        return snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (err) {
        console.error('Error al cargar juegos:', err);
        gamesGrid.innerHTML = `<p class="error">Error: ${err.message}</p>`;
        return [];
    }
}

async function loadGames() {
    currentGames = await getGames();
    renderGames();
}

function renderGames() {
    if (!currentGames.length) {
        gamesGrid.innerHTML = '<p>No hay juegos creados. Agrega uno nuevo.</p>';
        return;
    }

    gamesGrid.innerHTML = currentGames
        .map((game) => {
            const tags = game.tags ? game.tags.split(',').map(t => `<span class="game-tag">${t.trim()}</span>`).join('') : '';
            const releaseDate = game.releaseDate ? `<small>Lanzamiento: ${game.releaseDate}</small>` : '';
            const statusLabel = STATUS_LABELS[game.status] || game.status;

            return `
                <article class="game-card" data-id="${game.id}">
                    ${game.image ? `<img src="${game.image}" alt="${game.title}" class="game-card-image">` : ''}
                    <div class="game-card-body">
                        <h4>${game.title}</h4>
                        <p class="game-status status-${game.status}">${statusLabel}</p>
                        <p>${game.description || ''}</p>
                        ${releaseDate}
                        <div class="game-tags">${tags}</div>
                    </div>
                    <div class="game-card-actions">
                        <button onclick="editGame('${game.id}')" class="btn-small">Editar</button>
                        <button onclick="deleteGame('${game.id}')" class="btn-small btn-danger">Eliminar</button>
                    </div>
                </article>
            `;
        })
        .join('');
}

async function saveGame(gameData) {
    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    try {
        if (gameData.id) {
            // Actualizar existente
            const docRef = window.fsDoc(window.db, 'games', gameData.id);
            await window.updateDoc(docRef, gameData);
        } else {
            // Crear nuevo
            delete gameData.id;
            gameData.createdAt = new Date().toISOString();
            await window.addDoc(window.collection(window.db, 'games'), gameData);
        }
        await loadGames();
        gameModal.close();
    } catch (err) {
        console.error('Error al guardar juego:', err);
        alert('Error al guardar: ' + err.message);
    }
}

window.editGame = async function(gameId) {
    const game = currentGames.find(g => g.id === gameId);
    if (!game) return;

    modalTitle.textContent = 'Editar Juego';
    document.getElementById('gameId').value = game.id;
    document.getElementById('gameTitle').value = game.title || '';
    document.getElementById('gameDescription').value = game.description || '';
    document.getElementById('gameImage').value = game.image || '';
    document.getElementById('gameStatus').value = game.status || 'planning';
    document.getElementById('gameReleaseDate').value = game.releaseDate || '';
    document.getElementById('gameTags').value = game.tags || '';

    gameModal.showModal();
};

window.deleteGame = async function(gameId) {
    if (!confirm('¿Eliminar este juego permanentemente?')) return;

    const ready = await waitForFirebase();
    if (!ready) {
        alert('Firebase no disponible');
        return;
    }

    try {
        await window.deleteDoc(window.fsDoc(window.db, 'games', gameId));
        await loadGames();
    } catch (err) {
        console.error('Error al eliminar juego:', err);
        alert('Error al eliminar: ' + err.message);
    }
};

// ──────────────────────────────────────────────────────────────────
// UI Control
// ──────────────────────────────────────────────────────────────────

function showPanel() {
    loginCard.hidden = true;
    panel.hidden = false;
    loadRegistros();
    loadGames();
}

function showLogin() {
    loginCard.hidden = false;
    panel.hidden = true;
}

async function handleLogout() {
    try {
        await window.signOut(window.auth);
    } catch (err) {
        console.error('Error logout:', err);
    }
}

// ──────────────────────────────────────────────────────────────────
// Event Listeners
// ──────────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;

    loginMessage.textContent = 'Autenticando...';
    loginMessage.className = '';

    try {
        await waitForFirebaseAuth();
        await window.signInWithEmailAndPassword(window.auth, email, password);
        // Auth state change will handle the rest
    } catch (err) {
        console.error('Login error:', err);
        loginMessage.textContent = 'Error: ' + (err.message || 'Credenciales incorrectas');
        loginMessage.className = 'error';
    }
});

refreshBtn.addEventListener('click', () => {
    loadRegistros();
    loadGames();
});

exportBtn.addEventListener('click', exportCSV);

logoutBtn.addEventListener('click', handleLogout);

addGameBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Nuevo Juego';
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
        tags: document.getElementById('gameTags').value.trim(),
        updatedAt: new Date().toISOString()
    };

    saveGame(gameData);
});

// ──────────────────────────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────────────────────────

(async function init() {
    try {
        await waitForFirebaseAuth();
        window.onAuthStateChanged(window.auth, handleAuthStateChange);
    } catch (err) {
        console.error('Error inicializando auth:', err);
        loginMessage.textContent = 'Error: Firebase no cargó correctamente';
        loginMessage.className = 'error';
    }
})();
