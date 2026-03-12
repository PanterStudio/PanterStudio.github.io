/* ideas.js — Infinite canvas ideas board
 * Collections: idea_boards (each doc = one board's full state)
 * Doc ID: boardId  (URL param ?boardId=xxx, default "global")
 */

'use strict';

// ── Auth / user roles ─────────────────────────────────────────────────────────
const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const IDEA_BOARDS_COLLECTION = 'idea_boards';
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const DEFAULT_ADMIN_EMAILS = ['pantergamey@gmail.com', 'panterstudiogamedev@gmail.com'];
const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
function toSitePath(p) { return (SITE_ROOT + '/' + String(p || '').replace(/^\/+/, '')).replace(/\\/g, '/'); }

const ROLE_ALIASES = {
    founder:'founder_ceo', ceo:'founder_ceo', fundador_ceo:'founder_ceo', 'fundador / ceo':'founder_ceo',
    admin:'administrador', admin_general:'administrador', developer:'programador', modeler:'modelador',
    artist:'artista', artista_3d:'artista', viewer:'usuario'
};
const ALLOWED = new Set(['founder_ceo', 'administrador', 'programador', 'modelador', 'artista']);

// ── Colour palette for nodes ──────────────────────────────────────────────────
const NODE_COLORS = [
    '#1e70c8', '#27ae60', '#e74c3c', '#f39c12',
    '#8e44ad', '#16a085', '#2980b9', '#d35400',
];

// ── State ─────────────────────────────────────────────────────────────────────
let db, auth;
let currentUser = null;
let boardId      = 'global';
let boardName    = 'Global';
let accessResolved = false;
let accessTimeoutId = null;

let nodes       = [];   // { id, title, body, color, x, y }
let connections = [];   // { id, from, to }
let viewport    = { x: 0, y: 0, scale: 1 };

let selectedNodeId  = null;
let connectMode     = false;
let connectingFrom  = null;   // nodeId of first node chosen for a connection

// Drag state
let dragState = null;  // { nodeId, startX, startY, origX, origY }
// Pan state
let panState  = null;  // { startX, startY, origVx, origVy }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Filled after DOMContentLoaded
let gateEl, gateMsg, panelEl;
let userLabel, logoutBtn, sidebarToggle, sidebar;
let canvasWrap, viewport_el, svgEl, nodeContainer;
let connPreviewLine;
let statusBar, connHint;
let addNodeBtn, connectModeBtn, zoomInBtn, zoomOutBtn, resetViewBtn;
let saveBtnEl, clearBtnEl;
let editPanel, editTitle, editBody, colorPickerEl, editApplyBtn, editDeleteBtn, editCloseBtn;
let boardSelect, newBoardBtn, boardTitleEl;

// ── Firestore helpers ─────────────────────────────────────────────────────────
function boardDoc() {
    return window.fsDoc(window.db, IDEA_BOARDS_COLLECTION, boardId);
}

// ── Persistence ───────────────────────────────────────────────────────────────
function localKey() { return 'panterIdeas__' + boardId; }

function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return ROLE_ALIASES[value] || value || 'usuario';
}

function getAdminEmails() {
    try {
        const stored = JSON.parse(localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '[]');
        const list = Array.isArray(stored) ? stored : String(stored).split(',');
        return [...new Set([...DEFAULT_ADMIN_EMAILS, ...list].map(email => String(email).trim().toLowerCase()).filter(Boolean))];
    } catch {
        return [...DEFAULT_ADMIN_EMAILS];
    }
}

function showGateError(text) {
    if (gateMsg) {
        gateMsg.textContent = text;
        gateMsg.className = 'dev-msg error';
    }
    if (gateEl) gateEl.hidden = false;
    if (panelEl) panelEl.hidden = true;
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
            handleAuth(window.auth.currentUser).catch(() => redirectHome('Tiempo agotado.'));
            return;
        }
        redirectHome('No se detecto sesion tras 3 segundos.');
    }, 3000);
}

function redirectHome(msg) {
    showGateError(msg);
    setTimeout(() => window.location.replace(toSitePath('index.html')), 1400);
}

function saveLocal() {
    try {
        localStorage.setItem(localKey(), JSON.stringify({ nodes, connections }));
    } catch (_) { /* quota exceeded — ignore */ }
}

async function saveToFirestore() {
    if (!currentUser) return;
    try {
        const now = new Date().toISOString();
        await window.setDoc(boardDoc(), {
            boardName,
            nodes,
            connections,
            updatedAt: now,
            updatedByUid: currentUser.uid,
        }, { merge: true });
        flashStatus('✓ Guardado');
    } catch (e) {
        console.error('saveToFirestore:', e);
        flashStatus('Error al guardar');
    }
}

function autoSave() {
    saveLocal();
    // Debounce Firestore write to avoid hammering on every drag
    clearTimeout(autoSave._t);
    autoSave._t = setTimeout(saveToFirestore, 2500);
}

async function loadBoard() {
    // Try Firestore first
    try {
        const snap = await window.getDoc(boardDoc());
        if (snap.exists()) {
            const data = snap.data();
            nodes       = Array.isArray(data.nodes)       ? data.nodes       : [];
            connections = Array.isArray(data.connections) ? data.connections : [];
            boardName   = data.boardName || boardId;
            renderAll();
            updateStatusBar();
            return;
        }
    } catch (e) {
        console.warn('Firestore load failed, falling back to localStorage:', e);
    }
    // Fallback to localStorage
    try {
        const raw = localStorage.getItem(localKey());
        if (raw) {
            const data = JSON.parse(raw);
            nodes       = Array.isArray(data.nodes)       ? data.nodes       : [];
            connections = Array.isArray(data.connections) ? data.connections : [];
            renderAll();
            updateStatusBar();
        }
    } catch (_) { /* corrupt cache — start fresh */ }
}

// ── Board list ────────────────────────────────────────────────────────────────
async function loadBoardList() {
    try {
        const snap = await window.getDocs(window.collection(window.db, IDEA_BOARDS_COLLECTION));
        boardSelect.innerHTML = '';
        const ids = [];
        const docs = snap.docs
            .map(doc => ({ id: doc.id, data: doc.data() || {} }))
            .sort((a, b) => String(b.data.updatedAt || '').localeCompare(String(a.data.updatedAt || '')))
            .slice(0, 30);
        docs.forEach(doc => {
            ids.push(doc.id);
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = doc.data.boardName || doc.id;
            if (doc.id === boardId) opt.selected = true;
            boardSelect.appendChild(opt);
        });
        // Ensure current board is in list even if freshly created
        if (!ids.includes(boardId)) {
            const opt = document.createElement('option');
            opt.value = boardId;
            opt.textContent = boardName;
            opt.selected = true;
            boardSelect.insertBefore(opt, boardSelect.firstChild);
        }
    } catch (_) {
        // Quiet fail — board list is non-critical
    }
}

function switchBoard(newId, newName) {
    boardId   = newId;
    boardName = newName || newId;
    nodes       = [];
    connections = [];
    selectedNodeId = null;
    connectMode    = false;
    connectingFrom = null;
    closeEditPanel();
    renderAll();
    applyViewport();
    boardTitleEl.textContent = 'Ideas Board — ' + boardName;
    updateStatusBar();
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('boardId', boardId);
    window.history.replaceState({}, '', url.toString());
    loadBoard().catch(err => console.error('loadBoard switch:', err));
}

// ── Unique ID ─────────────────────────────────────────────────────────────────
function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Viewport ──────────────────────────────────────────────────────────────────
function applyViewport() {
    viewport_el.style.transform =
        `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
}

function clampScale(s) {
    return Math.min(3, Math.max(0.15, s));
}

function zoomAt(cx, cy, delta) {
    const newScale = clampScale(viewport.scale * delta);
    const factor   = newScale / viewport.scale;
    viewport.x = cx - factor * (cx - viewport.x);
    viewport.y = cy - factor * (cy - viewport.y);
    viewport.scale = newScale;
    applyViewport();
    updateStatusBar();
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
/** Convert canvas-wrap client coords → canvas world coords */
function clientToWorld(cx, cy) {
    const rect = canvasWrap.getBoundingClientRect();
    return {
        x: (cx - rect.left - viewport.x) / viewport.scale,
        y: (cy - rect.top  - viewport.y) / viewport.scale,
    };
}

/** Return center of a node element in wrap-relative coords (for SVG lines) */
function nodeCenterWrap(nodeEl) {
    const wrapRect = canvasWrap.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();
    return {
        x: nodeRect.left + nodeRect.width  / 2 - wrapRect.left,
        y: nodeRect.top  + nodeRect.height / 2 - wrapRect.top,
    };
}

// ── Node rendering ────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function createNodeEl(node) {
    const el = document.createElement('div');
    el.className = 'dev-idea-node';
    el.dataset.nodeId = node.id;
    el.style.left = node.x + 'px';
    el.style.top  = node.y + 'px';
    if (node.color) el.style.borderColor = node.color + 'aa';

    el.innerHTML = `
        <div class="dev-idea-node-header">
            <span class="dev-idea-node-title">${escHtml(node.title || 'Nodo')}</span>
        </div>
        ${node.body ? `<div class="dev-idea-node-body">${escHtml(node.body)}</div>` : ''}
        <div class="dev-idea-node-footer">
            <button class="dev-idea-node-btn connect-btn" title="Conectar">⇢</button>
            <button class="dev-idea-node-btn edit-btn"    title="Editar">✎</button>
            <button class="dev-idea-node-btn delete-btn"  title="Eliminar">✕</button>
        </div>`;

    if (node.color) {
        el.style.setProperty('--node-accent', node.color);
        el.querySelector('.dev-idea-node-title').style.color = lightenColor(node.color, 0.7);
    }

    // ── Drag ──────────────────────────────────────────────────────────────────
    el.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        if (connectMode) {
            handleConnectClick(node.id);
            return;
        }
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        const world = clientToWorld(e.clientX, e.clientY);
        dragState = {
            nodeId: node.id,
            startX: world.x,
            startY: world.y,
            origX:  node.x,
            origY:  node.y,
        };
        el.style.cursor = 'grabbing';
        el.style.zIndex = 10;
    });

    // ── Connect button ─────────────────────────────────────────────────────────
    el.querySelector('.connect-btn').addEventListener('click', e => {
        e.stopPropagation();
        handleConnectClick(node.id);
    });

    // ── Edit button ────────────────────────────────────────────────────────────
    el.querySelector('.edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        openEditPanel(node.id);
    });

    // ── Delete button ──────────────────────────────────────────────────────────
    el.querySelector('.delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        deleteNode(node.id);
    });

    return el;
}

function renderNodes() {
    nodeContainer.innerHTML = '';
    nodes.forEach(n => nodeContainer.appendChild(createNodeEl(n)));
}

// ── SVG lines ─────────────────────────────────────────────────────────────────
function renderLines() {
    svgEl.innerHTML = '';
    connections.forEach(conn => {
        const fromEl = nodeContainer.querySelector(`[data-node-id="${conn.from}"]`);
        const toEl   = nodeContainer.querySelector(`[data-node-id="${conn.to}"]`);
        if (!fromEl || !toEl) return;
        const line = buildLine(conn, fromEl, toEl);
        svgEl.appendChild(line);
    });
}

function buildLine(conn, fromEl, toEl) {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode   = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return document.createElementNS('http://www.w3.org/2000/svg','line');

    // SVG lives inside the transformed viewport, so lines must use world coords.
    const x1 = fromNode.x + (fromEl.offsetWidth || 0) / 2;
    const y1 = fromNode.y + (fromEl.offsetHeight || 0) / 2;
    const x2 = toNode.x + (toEl.offsetWidth || 0) / 2;
    const y2 = toNode.y + (toEl.offsetHeight || 0) / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.classList.add('conn-line');
    line.dataset.connId = conn.id;
    line.title = 'Clic para eliminar conexión';

    line.addEventListener('click', () => {
        if (confirm('¿Eliminar esta conexión?')) {
            connections = connections.filter(c => c.id !== conn.id);
            renderLines();
            autoSave();
        }
    });
    return line;
}

function renderAll() {
    renderNodes();
    renderLines();
}

function updateLinesForNode(nodeId) {
    // Re-render only lines that involve this node (cheaper than full re-render)
    svgEl.querySelectorAll('.conn-line').forEach(ln => {
        const conn = connections.find(c => c.id === ln.dataset.connId);
        if (!conn) { ln.remove(); return; }
        if (conn.from !== nodeId && conn.to !== nodeId) return;
        const fromEl = nodeContainer.querySelector(`[data-node-id="${conn.from}"]`);
        const toEl   = nodeContainer.querySelector(`[data-node-id="${conn.to}"]`);
        if (!fromEl || !toEl) { ln.remove(); return; }
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode   = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) { ln.remove(); return; }
        ln.setAttribute('x1', fromNode.x + (fromEl.offsetWidth || 0) / 2);
        ln.setAttribute('y1', fromNode.y + (fromEl.offsetHeight || 0) / 2);
        ln.setAttribute('x2', toNode.x + (toEl.offsetWidth || 0) / 2);
        ln.setAttribute('y2', toNode.y + (toEl.offsetHeight || 0) / 2);
    });
}

// ── Status bar ────────────────────────────────────────────────────────────────
function updateStatusBar() {
    statusBar.innerHTML =
        `Nodos: ${nodes.length} &nbsp;|&nbsp; Conexiones: ${connections.length} &nbsp;|&nbsp; Zoom: ${Math.round(viewport.scale * 100)}%`;
}

function flashStatus(msg) {
    const prev = statusBar.innerHTML;
    statusBar.textContent = msg;
    setTimeout(() => { statusBar.innerHTML = prev; updateStatusBar(); }, 2000);
}

// ── Connect mode ──────────────────────────────────────────────────────────────
function setConnectMode(on) {
    connectMode = on;
    connectModeBtn.classList.toggle('active', on);
    connHint.style.display = on ? 'block' : 'none';
    canvasWrap.style.cursor = on ? 'crosshair' : 'default';
    if (!on) {
        connectingFrom = null;
        connPreviewLine.setAttribute('display', 'none');
        // Remove connecting highlight
        nodeContainer.querySelectorAll('.dev-idea-node.connecting').forEach(el => el.classList.remove('connecting'));
    }
}

function handleConnectClick(nodeId) {
    if (!connectMode) {
        setConnectMode(true);
    }
    if (connectingFrom === null) {
        connectingFrom = nodeId;
        const el = nodeContainer.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) el.classList.add('connecting');
        return;
    }
    if (connectingFrom === nodeId) {
        // Same node — cancel
        setConnectMode(false);
        return;
    }
    // Check duplicate
    const exists = connections.some(
        c => (c.from === connectingFrom && c.to === nodeId) ||
             (c.from === nodeId && c.to === connectingFrom)
    );
    if (!exists) {
        connections.push({ id: uid(), from: connectingFrom, to: nodeId });
        renderLines();
        autoSave();
        updateStatusBar();
    }
    setConnectMode(false);
}

// ── Add node ──────────────────────────────────────────────────────────────────
function addNode(options = {}) {
    // Default position: center of the visible viewport
    const rect   = canvasWrap.getBoundingClientRect();
    const cx     = rect.width  / 2;
    const cy     = rect.height / 2;
    const worldC = clientToWorld(rect.left + cx, rect.top + cy);

    const node = {
        id:    uid(),
        title: options.title || 'Nueva idea',
        body:  options.body  || '',
        color: options.color || NODE_COLORS[nodes.length % NODE_COLORS.length],
        x:     options.x !== undefined ? options.x : worldC.x - 80,
        y:     options.y !== undefined ? options.y : worldC.y - 40,
    };
    nodes.push(node);
    nodeContainer.appendChild(createNodeEl(node));
    updateStatusBar();
    autoSave();
    // Open edit panel for new node
    openEditPanel(node.id);
    return node;
}

// ── Delete node ───────────────────────────────────────────────────────────────
function deleteNode(nodeId) {
    nodes       = nodes.filter(n => n.id !== nodeId);
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    if (selectedNodeId === nodeId) closeEditPanel();
    nodeContainer.querySelector(`[data-node-id="${nodeId}"]`)?.remove();
    renderLines();
    updateStatusBar();
    autoSave();
}

// ── Edit panel ────────────────────────────────────────────────────────────────
function buildColorPicker(node) {
    colorPickerEl.innerHTML = '';
    NODE_COLORS.forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'idea-color-swatch';
        dot.style.background = c;
        if (node.color === c) dot.classList.add('active');
        dot.dataset.color = c;
        dot.addEventListener('click', () => {
            colorPickerEl.querySelectorAll('.idea-color-swatch').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
        colorPickerEl.appendChild(dot);
    });
}

function openEditPanel(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    selectedNodeId = nodeId;

    // Highlight selected node
    nodeContainer.querySelectorAll('.dev-idea-node').forEach(el => el.classList.remove('selected'));
    nodeContainer.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('selected');

    editTitle.value = node.title || '';
    editBody.value  = node.body  || '';
    buildColorPicker(node);
    editPanel.classList.remove('hidden');
}

function applyEditPanel() {
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    node.title = editTitle.value.trim() || 'Nodo';
    node.body  = editBody.value.trim();
    const activeDot = colorPickerEl.querySelector('.idea-color-swatch.active');
    if (activeDot) node.color = activeDot.dataset.color;

    // Update rendered node
    const el = nodeContainer.querySelector(`[data-node-id="${node.id}"]`);
    if (el) {
        el.querySelector('.dev-idea-node-title').textContent = node.title;
        const bodyEl = el.querySelector('.dev-idea-node-body');
        if (node.body) {
            if (bodyEl) { bodyEl.textContent = node.body; }
            else {
                const newBody = document.createElement('div');
                newBody.className = 'dev-idea-node-body';
                newBody.textContent = node.body;
                el.querySelector('.dev-idea-node-header').after(newBody);
            }
        } else {
            bodyEl?.remove();
        }
        if (node.color) {
            el.style.borderColor = node.color + 'aa';
            el.querySelector('.dev-idea-node-title').style.color = lightenColor(node.color, 0.7);
        }
        // Body/title changes can resize the card and shift the center points.
        updateLinesForNode(node.id);
    }
    autoSave();
}

function closeEditPanel() {
    selectedNodeId = null;
    editPanel.classList.add('hidden');
    nodeContainer.querySelectorAll('.dev-idea-node').forEach(el => el.classList.remove('selected'));
}

// ── Color utility ─────────────────────────────────────────────────────────────
function lightenColor(hex, amount) {
    // Very simple: parse hex, blend toward white
    const n = parseInt(hex.replace('#', ''), 16);
    const r = (n >> 16) & 0xff;
    const g = (n >>  8) & 0xff;
    const b =  n        & 0xff;
    const lr = Math.min(255, Math.round(r + (255 - r) * amount));
    const lg = Math.min(255, Math.round(g + (255 - g) * amount));
    const lb = Math.min(255, Math.round(b + (255 - b) * amount));
    return `rgb(${lr},${lg},${lb})`;
}

// ── Clear all ─────────────────────────────────────────────────────────────────
function clearAll() {
    if (!confirm(`¿Eliminar todos los nodos y conexiones del tablero "${boardName}"? Esta acción no se puede deshacer.`)) return;
    nodes       = [];
    connections = [];
    selectedNodeId = null;
    closeEditPanel();
    setConnectMode(false);
    renderAll();
    updateStatusBar();
    autoSave();
}

// ── Canvas pointer events (pan + drag) ───────────────────────────────────────
function onCanvasPointerDown(e) {
    // Only pan if clicking directly on the wrap or viewport background
    if (e.target !== canvasWrap && e.target !== viewport_el && e.target !== svgEl && e.target !== nodeContainer) return;
    if (connectMode) return;
    panState = { startX: e.clientX, startY: e.clientY, origVx: viewport.x, origVy: viewport.y };
    canvasWrap.setPointerCapture(e.pointerId);
    canvasWrap.style.cursor = 'grabbing';
}

function onCanvasPointerMove(e) {
    // ── Node drag ──────────────────────────────────────────────────────────────
    if (dragState) {
        const world = clientToWorld(e.clientX, e.clientY);
        const node  = nodes.find(n => n.id === dragState.nodeId);
        if (!node) { dragState = null; return; }
        node.x = dragState.origX + (world.x - dragState.startX);
        node.y = dragState.origY + (world.y - dragState.startY);
        const el = nodeContainer.querySelector(`[data-node-id="${node.id}"]`);
        if (el) {
            el.style.left = node.x + 'px';
            el.style.top  = node.y + 'px';
            updateLinesForNode(node.id);
        }
        return;
    }
    // ── Canvas pan ────────────────────────────────────────────────────────────
    if (panState) {
        viewport.x = panState.origVx + (e.clientX - panState.startX);
        viewport.y = panState.origVy + (e.clientY - panState.startY);
        applyViewport();
        return;
    }
    // ── Connect mode preview line ─────────────────────────────────────────────
    if (connectMode && connectingFrom) {
        const fromEl = nodeContainer.querySelector(`[data-node-id="${connectingFrom}"]`);
        if (fromEl) {
            const wrapRect = canvasWrap.getBoundingClientRect();
            const c = nodeCenterWrap(fromEl);
            connPreviewLine.setAttribute('x1', c.x);
            connPreviewLine.setAttribute('y1', c.y);
            connPreviewLine.setAttribute('x2', e.clientX - wrapRect.left);
            connPreviewLine.setAttribute('y2', e.clientY - wrapRect.top);
            connPreviewLine.setAttribute('display', 'block');
        }
    }
}

function onCanvasPointerUp(e) {
    if (dragState) {
        const el = nodeContainer.querySelector(`[data-node-id="${dragState.nodeId}"]`);
        if (el) { el.style.cursor = 'grab'; el.style.zIndex = ''; }
        autoSave();
        dragState = null;
    }
    if (panState) {
        canvasWrap.style.cursor = connectMode ? 'crosshair' : 'default';
        panState = null;
    }
}

// ── Wheel zoom ────────────────────────────────────────────────────────────────
function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    zoomAt(e.clientX, e.clientY, delta);
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
function onKeyDown(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    switch (e.key) {
        case 'n': case 'N': addNode(); break;
        case 'c': case 'C': setConnectMode(!connectMode); break;
        case 'Escape':
            if (connectMode) setConnectMode(false);
            else if (selectedNodeId) closeEditPanel();
            break;
        case '+': case '=': zoomAt(canvasWrap.getBoundingClientRect().width / 2, canvasWrap.getBoundingClientRect().height / 2, 1.1); break;
        case '-': zoomAt(canvasWrap.getBoundingClientRect().width / 2, canvasWrap.getBoundingClientRect().height / 2, 0.9); break;
        case '0': viewport = { x: 0, y: 0, scale: 1 }; applyViewport(); updateStatusBar(); break;
        case 'Delete': case 'Backspace':
            if (selectedNodeId) deleteNode(selectedNodeId);
            break;
    }
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function showGate(msg) {
    gateEl.hidden = false;
    gateEl.style.display = 'flex';
    panelEl.hidden = true;
    gateMsg.textContent = msg;
    gateMsg.className = 'dev-msg';
}

function showPanel() {
    gateEl.hidden = true;
    gateEl.style.display = 'none';
    panelEl.hidden = false;
}

async function checkAccess(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return false;
    if (email === FOUNDER_CEO_EMAIL || getAdminEmails().includes(email)) return true;
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'users', user.uid));
        const profile = snap.exists() ? snap.data() || {} : {};
        const role = normalizeRole(profile.role || 'usuario');
        if (profile.isAdmin === true || role === 'founder_ceo') return true;
        return ALLOWED.has(role);
    } catch (_) { return false; }
}

async function handleAuth(user) {
    currentUser = user;
    if (!user) {
        if (window.auth?.currentUser) return handleAuth(window.auth.currentUser);
        redirectHome('No se detecto sesion activa.');
        return;
    }
    if (accessResolved) return;
    accessResolved = true;
    clearAccessTimeout();

    const ok = await checkAccess(user);
    if (!ok) {
        redirectHome('Tu rol no tiene acceso a esta seccion.');
        return;
    }

    if (userLabel) userLabel.textContent = user.displayName || user.email || 'Usuario';
    if (boardTitleEl) boardTitleEl.textContent = 'Ideas Board — ' + boardName;
    showPanel();
    await loadBoardList();
    await loadBoard();
}

function bootAuth() {
    if (!window.auth || !window.onAuthStateChanged || !window.db || !window.getDoc || !window.setDoc || !window.collection || !window.getDocs || !window.fsDoc) {
        showGateError('Inicializando autenticacion...');
        return false;
    }
    db = window.db;
    auth = window.auth;
    window.onAuthStateChanged(window.auth, user => {
        handleAuth(user).catch(err => {
            console.error('Auth error ideas:', err);
            redirectHome('Error de sesion.');
        });
    });
    if (window.auth.currentUser) handleAuth(window.auth.currentUser).catch(() => {});
    return true;
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('boardId')) boardId = params.get('boardId');
    boardName = params.get('boardName') || boardId;

    // DOM refs
    gateEl  = $('ideaGate');
    gateMsg = $('ideaGateMessage');
    panelEl = $('ideaPanel');

    userLabel     = $('ideaUserLabel');
    logoutBtn     = $('ideaLogoutBtn');
    sidebarToggle = $('ideaSidebarToggle');
    sidebar       = $('ideaSidebar');

    canvasWrap   = $('ideaCanvasWrap');
    viewport_el  = $('ideaViewport');
    svgEl        = $('ideaSvg');
    nodeContainer= $('ideaNodeContainer');
    connPreviewLine = $('ideaConnPreviewLine');
    statusBar    = $('ideaStatusBar');
    connHint     = $('ideaConnHint');

    addNodeBtn      = $('ideaAddNodeBtn');
    connectModeBtn  = $('ideaConnectModeBtn');
    zoomInBtn       = $('ideaZoomInBtn');
    zoomOutBtn      = $('ideaZoomOutBtn');
    resetViewBtn    = $('ideaResetViewBtn');
    saveBtnEl       = $('ideaSaveBtn');
    clearBtnEl      = $('ideaClearBtn');
    boardTitleEl    = $('ideaBoardTitle');

    editPanel      = $('ideaEditPanel');
    editTitle      = $('ideaEditTitle');
    editBody       = $('ideaEditBody');
    colorPickerEl  = $('ideaColorPicker');
    editApplyBtn   = $('ideaEditApplyBtn');
    editDeleteBtn  = $('ideaEditDeleteBtn');
    editCloseBtn   = $('ideaEditPanelClose');

    boardSelect = $('boardSelect');
    newBoardBtn = $('newBoardBtn');

    // ── Sidebar toggle ────────────────────────────────────────────────────────
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', e => {
        if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
            sidebar.classList.remove('open');
        }
    });

    // ── Logout ─────────────────────────────────────────────────────────────────
    logoutBtn.addEventListener('click', async () => {
        try { if (window.auth && window.signOut) await window.signOut(window.auth); } catch {}
        window.location.replace(toSitePath('index.html'));
    });

    // ── Toolbar buttons ────────────────────────────────────────────────────────
    addNodeBtn.addEventListener('click',     () => addNode());
    connectModeBtn.addEventListener('click', () => setConnectMode(!connectMode));
    zoomInBtn.addEventListener('click',  () => { zoomAt(canvasWrap.getBoundingClientRect().width / 2, canvasWrap.getBoundingClientRect().height / 2, 1.15); });
    zoomOutBtn.addEventListener('click', () => { zoomAt(canvasWrap.getBoundingClientRect().width / 2, canvasWrap.getBoundingClientRect().height / 2, 1 / 1.15); });
    resetViewBtn.addEventListener('click',   () => { viewport = { x: 0, y: 0, scale: 1 }; applyViewport(); updateStatusBar(); });
    saveBtnEl.addEventListener('click',  saveToFirestore);
    clearBtnEl.addEventListener('click', clearAll);

    // ── Edit panel ─────────────────────────────────────────────────────────────
    editApplyBtn.addEventListener('click',  applyEditPanel);
    editDeleteBtn.addEventListener('click', () => { if (selectedNodeId) deleteNode(selectedNodeId); });
    editCloseBtn.addEventListener('click',  closeEditPanel);
    editTitle.addEventListener('input', applyEditPanel);
    editBody.addEventListener('input',  applyEditPanel);

    // ── Board selector ─────────────────────────────────────────────────────────
    boardSelect.addEventListener('change', () => {
        const opt = boardSelect.options[boardSelect.selectedIndex];
        switchBoard(boardSelect.value, opt.textContent);
    });
    newBoardBtn.addEventListener('click', () => {
        const name = prompt('Nombre del nuevo tablero:');
        if (!name || !name.trim()) return;
        const newId = 'board_' + uid();
        switchBoard(newId, name.trim());
        loadBoardList();
    });

    // ── Canvas events ──────────────────────────────────────────────────────────
    canvasWrap.addEventListener('pointerdown', onCanvasPointerDown);
    canvasWrap.addEventListener('pointermove', onCanvasPointerMove);
    canvasWrap.addEventListener('pointerup',   onCanvasPointerUp);
    canvasWrap.addEventListener('pointercancel', () => { dragState = null; panState = null; });
    canvasWrap.addEventListener('wheel', onWheel, { passive: false });

    // ── Keyboard ───────────────────────────────────────────────────────────────
    document.addEventListener('keydown', onKeyDown);

    // ── Window resize → re-render lines ───────────────────────────────────────
    window.addEventListener('resize', renderLines);

    startAccessTimeout();
    if (bootAuth()) return;
    document.addEventListener('firebaseReady', () => { bootAuth(); }, { once: true });
    setTimeout(() => {
        bootAuth();
        if (!accessResolved && window.auth?.currentUser) handleAuth(window.auth.currentUser).catch(() => {});
    }, 2200);
}

document.addEventListener('DOMContentLoaded', init);
