// ideas.js — Board de desarrollo de videojuegos (canvas infinito)
// Guarda y carga en Firebase Firestore

'use strict';

// Estado global
let nodes = [];
let connections = [];
let selectedNodeId = null;
let connectMode = false;
let connectingFrom = null;
let boardId = 'dev_board';
let boardName = 'Desarrollo Videojuego';
let currentUser = null;

// Tipos de nodos para desarrollo de videojuegos
const NODE_TYPES = [
  { type: 'idea', label: 'Idea', color: '#1e70c8', icon: '💡', fields: [{key:'desc',label:'Descripción',type:'text'}] },
  { type: 'task', label: 'Tarea', color: '#636e72', icon: '✅', fields: [{key:'status',label:'Estado',type:'text',placeholder:'pendiente, hecho'}] },
  { type: 'bug', label: 'Bug', color: '#d63031', icon: '🐞', fields: [{key:'severity',label:'Severidad',type:'text',placeholder:'alta, media, baja'}] },
  { type: 'mechanic', label: 'Mecánica', color: '#fdcb6e', icon: '🎮', fields: [{key:'goal',label:'Objetivo',type:'text'}] },
  { type: 'art', label: 'Arte', color: '#0984e3', icon: '🎨', fields: [{key:'asset',label:'Recurso',type:'text'}] },
  { type: 'sound', label: 'Sonido', color: '#6c5ce7', icon: '🔊', fields: [{key:'clip',label:'Clip',type:'text'}] },
  { type: 'feedback', label: 'Feedback', color: '#00b894', icon: '💬', fields: [{key:'from',label:'De',type:'text'}] },
  { type: 'milestone', label: 'Hito', color: '#00b894', icon: '🏁', fields: [{key:'date',label:'Fecha',type:'date'}] },
  { type: 'doc', label: 'Doc', color: '#b2bec3', icon: '📄', fields: [{key:'url',label:'URL',type:'text'}] },
  { type: 'script', label: 'Script', color: '#16a085', icon: '💻', fields: [{key:'lang',label:'Lenguaje',type:'text'}] },
  { type: 'asset', label: 'Asset', color: '#2980b9', icon: '📦', fields: [{key:'path',label:'Ruta',type:'text'}] },
  { type: 'test', label: 'Test/QA', color: '#636e72', icon: '🧪', fields: [{key:'result',label:'Resultado',type:'text'}] },
  { type: 'custom', label: 'Personalizado', color: '#d35400', icon: '📝', fields: [] }
];

// --- Firebase helpers ---
function getFirestore() { return window.firebase?.firestore?.(); }
function boardDoc() { return getFirestore().collection('idea_boards').doc(boardId); }

async function saveToFirestore() {
  if (!currentUser) return;
  await boardDoc().set({
    boardName,
    nodes,
    connections,
    updatedAt: new Date().toISOString(),
    updatedByUid: currentUser.uid,
  }, { merge: true });
}

async function loadFromFirestore() {
  const snap = await boardDoc().get();
  if (snap.exists) {
    const data = snap.data();
    nodes = Array.isArray(data.nodes) ? data.nodes : [];
    connections = Array.isArray(data.connections) ? data.connections : [];
    boardName = data.boardName || boardId;
  } else {
    nodes = [];
    connections = [];
  }
  renderAll();
}

// --- Render y lógica de nodos (simplificado, expandible) ---
// --- Renderizado y lógica de nodos ---
function renderAll() {
  const nodeContainer = document.getElementById('ideaNodeContainer');
  const svg = document.getElementById('ideaSvg');
  if (!nodeContainer || !svg) return;
  nodeContainer.innerHTML = '';
  svg.innerHTML = '';

  // Renderizar conexiones
  connections.forEach(conn => {
    const from = nodes.find(n => n.id === conn.from);
    const to = nodes.find(n => n.id === conn.to);
    if (from && to) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x + from.width/2);
      line.setAttribute('y1', from.y + from.height/2);
      line.setAttribute('x2', to.x + to.width/2);
      line.setAttribute('y2', to.y + to.height/2);
      line.setAttribute('stroke', '#6cb2f7');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }
  });

  // Renderizar nodos
  nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = 'idea-node';
    el.style.position = 'absolute';
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.style.background = node.color || '#232b3a';
    el.style.color = '#fff';
    el.style.borderRadius = '10px';
    el.style.padding = '12px 18px';
    el.style.minWidth = '120px';
    el.style.boxShadow = '0 2px 8px #0006';
    el.style.cursor = 'grab';
    el.style.userSelect = 'none';
    el.style.zIndex = node.id === selectedNodeId ? 20 : 10;
    el.innerHTML = `<span style="font-size:1.3em;">${node.icon||'💡'}</span> <b>${node.title||node.type}</b>`;
    el.dataset.id = node.id;
    // Drag events
    el.onmousedown = e => startDragNode(e, node.id);
    el.onclick = e => selectNode(node.id);
    nodeContainer.appendChild(el);
    node.width = el.offsetWidth;
    node.height = el.offsetHeight;
  });

  // Actualizar status bar
  const statusBar = document.getElementById('ideaStatusBar');
  if (statusBar) {
    statusBar.textContent = `Nodos: ${nodes.length} | Conexiones: ${connections.length}`;
  }
}


// --- Drag, selección y conexión ---
let dragNodeId = null, dragOffset = {x:0, y:0};

function startDragNode(e, nodeId) {
  if (connectMode) {
    handleConnectClick(nodeId);
    return;
  }
  dragNodeId = nodeId;
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  dragOffset.x = e.clientX - node.x;
  dragOffset.y = e.clientY - node.y;
  document.onmousemove = onDragNode;
  document.onmouseup = stopDragNode;
}
function onDragNode(e) {
  if (!dragNodeId) return;
  const node = nodes.find(n => n.id === dragNodeId);
  if (!node) return;
  node.x = e.clientX - dragOffset.x;
  node.y = e.clientY - dragOffset.y;
  renderAll();
}
function stopDragNode() {
  dragNodeId = null;
  document.onmousemove = null;
  document.onmouseup = null;
  saveToFirestore();
}
function selectNode(nodeId) {
  selectedNodeId = nodeId;
  renderAll();
  showEditPanel(nodeId);
}

// --- Modo conexión ---
function handleConnectClick(nodeId) {
  if (!connectingFrom) {
    connectingFrom = nodeId;
    showConnHint(true);
  } else if (connectingFrom && connectingFrom !== nodeId) {
    // Crear conexión si no existe
    if (!connections.some(c => (c.from === connectingFrom && c.to === nodeId))) {
      connections.push({from: connectingFrom, to: nodeId});
      saveToFirestore();
    }
    connectingFrom = null;
    showConnHint(false);
    renderAll();
  } else {
    connectingFrom = null;
    showConnHint(false);
  }
}
function showConnHint(show) {
  const hint = document.getElementById('ideaConnHint');
  if (hint) hint.style.display = show ? 'block' : 'none';
}

// --- Panel de edición de nodos ---
function showEditPanel(nodeId) {
  const panel = document.getElementById('ideaEditPanel');
  if (!panel) return;
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  panel.classList.remove('hidden');
  document.getElementById('ideaEditTitle').value = node.title || '';
  document.getElementById('ideaEditBody').value = node.body || '';
  // Colores
  const picker = document.getElementById('ideaColorPicker');
  if (picker) {
    picker.innerHTML = '';
    const colors = NODE_TYPES.map(t => t.color).filter((v,i,a)=>a.indexOf(v)===i);
    colors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'idea-color-swatch'+(node.color===color?' active':'');
      swatch.style.background = color;
      swatch.onclick = () => {
        node.color = color;
        renderAll();
        showEditPanel(nodeId);
      };
      picker.appendChild(swatch);
    });
  }
}

function hideEditPanel() {
  const panel = document.getElementById('ideaEditPanel');
  if (panel) panel.classList.add('hidden');
  selectedNodeId = null;
  renderAll();
}

// --- Inicialización ---
// --- Inicialización y eventos de UI ---
async function initIdeasBoard(user) {
  currentUser = user;
  await loadFromFirestore();
  // Botón agregar nodo
  const addBtn = document.getElementById('ideaAddNodeBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      const type = NODE_TYPES[0];
      const newNode = {
        id: 'n'+Date.now(),
        type: type.type,
        title: type.label,
        icon: type.icon,
        color: type.color,
        x: 100 + Math.random()*200,
        y: 100 + Math.random()*200,
        width: 120,
        height: 60,
        body: ''
      };
      nodes.push(newNode);
      saveToFirestore();
      renderAll();
    };
  }
  // Limpiar todo
  const clearBtn = document.getElementById('ideaClearBtn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('¿Seguro que quieres borrar todos los nodos y conexiones?')) {
        nodes = [];
        connections = [];
        saveToFirestore();
        renderAll();
        hideEditPanel();
      }
    };
  }
  // Panel edición: cerrar
  const closeBtn = document.getElementById('ideaEditPanelClose');
  if (closeBtn) closeBtn.onclick = hideEditPanel;
  // Panel edición: aplicar cambios
  const applyBtn = document.getElementById('ideaEditApplyBtn');
  if (applyBtn) applyBtn.onclick = () => {
    if (!selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    node.title = document.getElementById('ideaEditTitle').value;
    node.body = document.getElementById('ideaEditBody').value;
    saveToFirestore();
    renderAll();
    hideEditPanel();
  };
  // Panel edición: eliminar nodo
  const delBtn = document.getElementById('ideaEditDeleteBtn');
  if (delBtn) delBtn.onclick = () => {
    if (!selectedNodeId) return;
    nodes = nodes.filter(n => n.id !== selectedNodeId);
    connections = connections.filter(c => c.from !== selectedNodeId && c.to !== selectedNodeId);
    saveToFirestore();
    renderAll();
    hideEditPanel();
  };
  // Botón modo conexión
  const connBtn = document.getElementById('ideaConnectModeBtn');
  if (connBtn) {
    connBtn.onclick = () => {
      connectMode = !connectMode;
      connectingFrom = null;
      connBtn.classList.toggle('active', connectMode);
      showConnHint(connectMode);
    };
  }
  // Esc para salir de modo conexión
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && connectMode) {
      connectMode = false;
      connectingFrom = null;
      showConnHint(false);
      const connBtn = document.getElementById('ideaConnectModeBtn');
      if (connBtn) connBtn.classList.remove('active');
    }
  });
  renderAll();
}

// Exportar funciones principales si se usa como módulo
window.ideasBoard = { initIdeasBoard, saveToFirestore, loadFromFirestore, NODE_TYPES };
