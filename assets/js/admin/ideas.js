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


// ── Node types and palette (Godot-style) ──
const NODE_TYPES = [
    { type: 'logic', label: 'Lógica', icon:'🔀', color: '#1e70c8', desc: 'Nodo de lógica/flujo (if, switch, etc.)', fields: [{key:'cond',label:'Condición',type:'text',placeholder:'Ej: vida < 50'}] },
    { type: 'system', label: 'Sistema', icon:'🛠️', color: '#00b894', desc: 'Nodo de sistema (input, render, audio, etc.)', fields: [{key:'subsystem',label:'Subsistema',type:'text',placeholder:'Ej: render, audio'}] },
    { type: 'mechanic', label: 'Mecánica', icon:'🎮', color: '#fdcb6e', desc: 'Nodo de mecánica de juego', fields: [{key:'goal',label:'Objetivo',type:'text',placeholder:'Ej: saltar, disparar'}] },
    { type: 'physics', label: 'Física', icon:'⚙️', color: '#e74c3c', desc: 'Nodo de física/colisión', fields: [{key:'shape',label:'Forma',type:'text',placeholder:'Ej: caja, círculo'}] },
    { type: 'light', label: 'Luz', icon:'💡', color: '#ffe066', desc: 'Nodo de luz/iluminación', fields: [{key:'intensity',label:'Intensidad',type:'number',placeholder:'Ej: 1.0'}] },
    { type: 'graphics', label: 'Gráficos', icon:'🖼️', color: '#0984e3', desc: 'Nodo de gráficos/visual', fields: [{key:'asset',label:'Recurso',type:'text',placeholder:'sprite, modelo'}] },
    { type: 'audio', label: 'Audio', icon:'🔊', color: '#6c5ce7', desc: 'Nodo de audio/sonido', fields: [{key:'clip',label:'Clip',type:'text',placeholder:'nombre.mp3'}] },
    { type: 'ai', label: 'IA', icon:'🤖', color: '#00cec9', desc: 'Nodo de inteligencia artificial', fields: [{key:'behavior',label:'Comportamiento',type:'text',placeholder:'patrullar, seguir'}] },
    { type: 'animation', label: 'Animación', icon:'🎬', color: '#e17055', desc: 'Nodo de animación', fields: [{key:'anim',label:'Animación',type:'text',placeholder:'idle, run'}] },
    { type: 'ui', label: 'UI', icon:'🖱️', color: '#f39c12', desc: 'Nodo de interfaz/visual', fields: [{key:'element',label:'Elemento',type:'text',placeholder:'botón, panel'}] },
    { type: 'signal', label: 'Señal', icon:'📶', color: '#8e44ad', desc: 'Nodo de señal/evento', fields: [{key:'event',label:'Evento',type:'text',placeholder:'onHit, onClick'}] },
    { type: 'script', label: 'Script', icon:'💻', color: '#16a085', desc: 'Nodo de código/script', fields: [{key:'lang',label:'Lenguaje',type:'text',placeholder:'GDScript, JS'}] },
    { type: 'resource', label: 'Recurso', icon:'📦', color: '#2980b9', desc: 'Nodo de recurso/asset', fields: [{key:'path',label:'Ruta',type:'text',placeholder:'res://...'}] },
    { type: 'camera', label: 'Cámara', icon:'📷', color: '#6ab04c', desc: 'Nodo de cámara/viewport', fields: [{key:'mode',label:'Modo',type:'text',placeholder:'perspectiva, ortográfica'}] },
    { type: 'particles', label: 'Partículas', icon:'✨', color: '#f6e58d', desc: 'Nodo de sistema de partículas', fields: [{key:'effect',label:'Efecto',type:'text',placeholder:'fuego, polvo'}] },
    { type: 'network', label: 'Red', icon:'🌐', color: '#00b894', desc: 'Nodo de red/multiplayer', fields: [{key:'role',label:'Rol',type:'text',placeholder:'servidor, cliente'}] },
    { type: 'inventory', label: 'Inventario', icon:'🎒', color: '#b2bec3', desc: 'Nodo de inventario', fields: [{key:'slots',label:'Slots',type:'number',placeholder:'20'}] },
    { type: 'economy', label: 'Economía', icon:'💰', color: '#fdcb6e', desc: 'Nodo de economía/moneda', fields: [{key:'currency',label:'Moneda',type:'text',placeholder:'oro, gemas'}] },
    { type: 'progress', label: 'Progreso', icon:'📈', color: '#00b894', desc: 'Nodo de progreso/XP', fields: [{key:'level',label:'Nivel',type:'number',placeholder:'1'}] },
    { type: 'narrative', label: 'Narrativa', icon:'📖', color: '#e17055', desc: 'Nodo de narrativa/diálogo', fields: [{key:'line',label:'Línea',type:'text',placeholder:'Texto...'}] },
    { type: 'cinematic', label: 'Cinemática', icon:'🎥', color: '#636e72', desc: 'Nodo de cinemática', fields: [{key:'scene',label:'Escena',type:'text',placeholder:'intro, final'}] },
    { type: 'touch', label: 'Input Touch', icon:'🤚', color: '#fab1a0', desc: 'Nodo de entrada táctil', fields: [{key:'gesture',label:'Gesto',type:'text',placeholder:'swipe, tap'}] },
    { type: 'vr', label: 'VR/AR', icon:'🕶️', color: '#00b894', desc: 'Nodo de VR/AR', fields: [{key:'device',label:'Dispositivo',type:'text',placeholder:'Oculus, ARKit'}] },
    { type: 'test', label: 'Test', icon:'🧪', color: '#636e72', desc: 'Nodo de test/QA', fields: [{key:'result',label:'Resultado',type:'text',placeholder:'ok, fail'}] },
    { type: 'doc', label: 'Doc', icon:'📄', color: '#b2bec3', desc: 'Nodo de documentación', fields: [{key:'url',label:'URL',type:'text',placeholder:'https://...'}] },
    { type: 'milestone', label: 'Milestone', icon:'🏁', color: '#00b894', desc: 'Nodo de hito/entrega', fields: [{key:'date',label:'Fecha',type:'date',placeholder:''}] },
    { type: 'feedback', label: 'Feedback', icon:'💬', color: '#00b894', desc: 'Nodo de feedback/retro', fields: [{key:'from',label:'De',type:'text',placeholder:'QA, usuario'}] },
    { type: 'opt', label: 'Optimización', icon:'⚡', color: '#fdcb6e', desc: 'Nodo de optimización', fields: [{key:'target',label:'Objetivo',type:'text',placeholder:'fps, memoria'}] },
    { type: 'shader', label: 'Shader', icon:'🎨', color: '#6c5ce7', desc: 'Nodo de shader', fields: [{key:'type',label:'Tipo',type:'text',placeholder:'vertex, fragment'}] },
    { type: 'plugin', label: 'Plugin', icon:'🔌', color: '#636e72', desc: 'Nodo de plugin/extensión', fields: [{key:'name',label:'Nombre',type:'text',placeholder:'nombre'}] },
    { type: 'integration', label: 'Integración', icon:'🔗', color: '#00b894', desc: 'Nodo de integración externa', fields: [{key:'api',label:'API',type:'text',placeholder:'Discord, Steam'}] },
    { type: 'build', label: 'Build', icon:'🏗️', color: '#636e72', desc: 'Nodo de build/compilación', fields: [{key:'platform',label:'Plataforma',type:'text',placeholder:'Windows, Web'}] },
    { type: 'deploy', label: 'Deploy', icon:'🚀', color: '#00b894', desc: 'Nodo de despliegue', fields: [{key:'env',label:'Entorno',type:'text',placeholder:'prod, staging'}] },
    { type: 'task', label: 'Tarea', icon:'✅', color: '#636e72', desc: 'Nodo de tarea/pendiente', fields: [{key:'status',label:'Estado',type:'text',placeholder:'pendiente, hecho'}] },
    { type: 'bug', label: 'Bug', icon:'🐞', color: '#d63031', desc: 'Nodo de bug/error', fields: [{key:'severity',label:'Severidad',type:'text',placeholder:'alta, baja'}] },
    { type: 'custom', label: 'Personalizado', icon:'📝', color: '#d35400', desc: 'Nodo libre', fields: [] },
];
// Búsqueda y filtro de nodos
let nodeSearchTerm = '';
function filterNodes() {
    const term = nodeSearchTerm.trim().toLowerCase();
    nodeContainer.querySelectorAll('.dev-idea-node').forEach(el => {
        const title = (el.querySelector('.dev-idea-node-title')?.textContent||'').toLowerCase();
        const type = (el.querySelector('.dev-idea-node-type')?.textContent||'').toLowerCase();
        el.style.display = (!term || title.includes(term) || type.includes(term)) ? '' : 'none';
    });
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
    if (!currentUser) {
        flashStatus('No autenticado. Guardado solo local.');
        saveLocal();
        return;
    }
    try {
        const now = new Date().toISOString();
        await window.setDoc(boardDoc(), {
            boardName,
            nodes,
            connections,
            updatedAt: now,
            updatedByUid: currentUser.uid,
        }, { merge: true });
        flashStatus('✓ Guardado en la nube');
    } catch (e) {
        console.error('saveToFirestore:', e);
        saveLocal();
        flashStatus('Error al guardar en la nube. Guardado local.');
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
    // Fondo según tipo
    el.style.background = `linear-gradient(180deg,${node.color}22,rgba(0,0,0,0.7))`;

    // Show type, icon and fields summary
    let typeObj = NODE_TYPES.find(t=>t.type===node.type)||{};
    let typeLabel = typeObj.label||'Personalizado';
    let icon = typeObj.icon||'📝';
    let fieldsSummary = '';
    const t = typeObj;
    if (t && t.fields && node.fields) {
        fieldsSummary = Object.entries(node.fields).filter(([k,v])=>v).map(([k,v])=>{
            const f = t.fields.find(f=>f.key===k);
            return f?`<div style='font-size:.75em;color:#bfe4fb;'><b>${f.label}:</b> ${escHtml(v)}</div>`:'';
        }).join('');
    }

    el.innerHTML = `
        <div class="dev-idea-node-header">
            <span class="dev-idea-node-type" style="font-size:1.2em;margin-right:6px;">${icon}</span>
            <span class="dev-idea-node-title">${escHtml(node.title || 'Nodo')}</span>
            <span class="dev-idea-node-type" style="font-size:.7em;color:${lightenColor(node.color||'#1e70c8',0.5)};margin-left:8px;">${escHtml(typeLabel)}</span>
        </div>
        ${fieldsSummary}
        ${node.body ? `<div class="dev-idea-node-body">${escHtml(node.body)}</div>` : ''}
        <div class="dev-idea-node-footer">
            <button class="dev-idea-node-btn connect-btn" title="Conectar">⇢</button>
            <button class="dev-idea-node-btn edit-btn"    title="Editar">✎</button>
            <button class="dev-idea-node-btn delete-btn"  title="Eliminar">✕</button>
            <button class="dev-idea-node-btn copy-btn" title="Duplicar">⧉</button>
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

    // ── Copy/duplicate button ─────────────────────────────────────────────────
    el.querySelector('.copy-btn').addEventListener('click', e => {
        e.stopPropagation();
        const copy = JSON.parse(JSON.stringify(node));
        copy.id = uid();
        copy.x += 40; copy.y += 40;
        nodes.push(copy);
        nodeContainer.appendChild(createNodeEl(copy));
        updateStatusBar();
        autoSave();
    });

    return el;
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

    // Node type
    let type = options.type || 'logic';
    if (!NODE_TYPES.some(n=>n.type===type)) type = 'custom';
    const typeObj = NODE_TYPES.find(n=>n.type===type) || NODE_TYPES[NODE_TYPES.length-1];

    const node = {
        id:    uid(),
        title: options.title || typeObj.label,
        body:  options.body  || '',
        color: options.color || typeObj.color,
        type,
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
    // Node type selector
    const typeSel = document.createElement('select');
    typeSel.style.marginBottom = '8px';
    NODE_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.type;
        opt.textContent = t.label + ' — ' + t.desc;
        if (node.type === t.type) opt.selected = true;
        typeSel.appendChild(opt);
    });
    typeSel.addEventListener('change', () => {
        node.type = typeSel.value;
        const t = NODE_TYPES.find(n=>n.type===node.type) || NODE_TYPES[NODE_TYPES.length-1];
        node.color = t.color;
        // reset fields for new type
        if (!node.fields) node.fields = {};
        for (const k in node.fields) delete node.fields[k];
        buildColorPicker(node);
        applyEditPanel();
    });
    colorPickerEl.appendChild(typeSel);
    // Color swatches
    NODE_COLORS.forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'idea-color-swatch';
        dot.style.background = c;
        if (node.color === c) dot.classList.add('active');
        dot.dataset.color = c;
        dot.addEventListener('click', () => {
            colorPickerEl.querySelectorAll('.idea-color-swatch').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            node.color = c;
            applyEditPanel();
        });
        colorPickerEl.appendChild(dot);
    });

    // Dynamic fields for node type
    const t = NODE_TYPES.find(n=>n.type===node.type);
    if (t && t.fields && t.fields.length) {
        const fieldsDiv = document.createElement('div');
        fieldsDiv.style.marginTop = '10px';
        if (!node.fields) node.fields = {};
        t.fields.forEach(f => {
            const label = document.createElement('label');
            label.textContent = f.label;
            const input = document.createElement('input');
            input.type = f.type;
            input.placeholder = f.placeholder||'';
            input.value = node.fields[f.key]||'';
            input.addEventListener('input',()=>{
                node.fields[f.key]=input.value;
                applyEditPanel();
            });
            fieldsDiv.appendChild(label);
            fieldsDiv.appendChild(input);
        });
        colorPickerEl.appendChild(fieldsDiv);
    }
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
        const newEl = createNodeEl(node);
        el.replaceWith(newEl);
    }
    renderLines();
    updateStatusBar();
    autoSave();
}

// ── Canvas events ──────────────────────────────────────────────────────────
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
