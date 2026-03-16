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
let boardZoom = 1;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.15;

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

// --- Firebase y Local helpers ---
function getFirestore() { return window.firebase?.firestore?.(); }
function boardDoc() { return getFirestore().collection('idea_boards').doc(boardId); }

function saveLocal() {
  localStorage.setItem('ideasBoardNodes', JSON.stringify(nodes));
  localStorage.setItem('ideasBoardConnections', JSON.stringify(connections));
}
function loadLocal() {
  try {
    nodes = JSON.parse(localStorage.getItem('ideasBoardNodes')) || [];
    connections = JSON.parse(localStorage.getItem('ideasBoardConnections')) || [];
  } catch { nodes = []; connections = []; }
}

async function saveToFirestore() {
  if (!currentUser) {
    saveLocal();
    return;
  }
  await boardDoc().set({
    boardName,
    nodes,
    connections,
    updatedAt: new Date().toISOString(),
    updatedByUid: currentUser.uid,
  }, { merge: true });
}

async function loadFromFirestore() {
  if (!currentUser) {
    loadLocal();
    renderAll();
    return;
  }
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
  // Aplicar zoom
  const viewport = document.getElementById('ideaViewport');
  if (viewport) {
    viewport.style.transform = `scale(${boardZoom})`;
    viewport.style.transformOrigin = '0 0';
  }

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
    // Fondo con gradiente sutil
    const baseColor = node.color || '#232b3a';
    el.style.background = `linear-gradient(135deg, ${baseColor} 85%, #232b3a 100%)`;
    // Contraste de texto
    function getContrastYIQ(hexcolor) {
      hexcolor = hexcolor.replace('#','');
      if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(x=>x+x).join('');
      const r = parseInt(hexcolor.substr(0,2),16);
      const g = parseInt(hexcolor.substr(2,2),16);
      const b = parseInt(hexcolor.substr(4,2),16);
      const yiq = ((r*299)+(g*587)+(b*114))/1000;
      return (yiq >= 140) ? '#222' : '#fff';
    }
    const textColor = getContrastYIQ(baseColor);
    el.style.color = textColor;
    el.style.borderRadius = '16px';
    el.style.padding = '0';
    // Responsive sizing
    if (window.innerWidth < 700) {
      el.style.width = '92vw';
      el.style.minWidth = '60vw';
      el.style.maxWidth = '98vw';
      el.style.height = 'auto';
      el.style.minHeight = '48px';
      el.style.maxHeight = 'none';
      el.style.fontSize = '1em';
    } else {
      el.style.width = 'min(90vw, 220px)';
      el.style.height = 'auto';
      el.style.minWidth = '120px';
      el.style.maxWidth = '98vw';
      el.style.minHeight = '48px';
      el.style.maxHeight = 'none';
    }
    el.style.boxShadow = '0 1.5px 0 0 #fff1 inset'; // Solo un sutil borde superior
    el.style.border = `2.5px solid transparent`;
    el.style.transition = 'box-shadow .18s, border .18s, background .18s, width .18s, height .18s, filter .18s';
    el.style.borderImage = `linear-gradient(135deg, ${textColor}33 0%, ${baseColor} 100%) 1`;
    el.onmouseenter = () => { el.style.filter = 'brightness(1.08) drop-shadow(0 2px 8px #6cb2f7aa)'; };
    el.onmouseleave = () => { el.style.filter = 'none'; };
    el.style.cursor = 'grab';
    el.style.userSelect = 'none';
    el.style.zIndex = node.id === selectedNodeId ? 20 : 10;
    el.style.marginBottom = '10px';
    el.style.marginRight = '10px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.overflow = 'hidden';
    const typeDef = NODE_TYPES.find(t => t.type === node.type);
    const typeLabel = typeDef ? typeDef.label : (node.type || 'Nodo');
    el.innerHTML = `
      <div style="
        background:rgba(30,32,40,0.72);backdrop-filter:blur(2.5px);
        padding:7px 12px 4px 12px;
        border-radius:14px 14px 0 0;
        font-size:.98em;font-weight:700;letter-spacing:.7px;
        color:${textColor};line-height:1.1;
        display:flex;align-items:center;gap:8px;
        text-transform:uppercase;
        border-bottom:1.5px solid ${textColor}22;">
        <span style='font-size:1.2em;line-height:1;'>${node.icon||'💡'}</span> ${typeLabel}
      </div>
      <div style="
        flex:1;display:flex;flex-direction:column;justify-content:center;
        padding:7px 12px 6px 12px;
        background:rgba(255,255,255,0.03);border-radius:0 0 14px 14px;">
        <div style="font-size:.98em;font-weight:500;color:${textColor};opacity:.92;word-break:break-word;">${node.title||''}</div>
        ${(node.type==='task') ? `<button class="task-status-btn" style="margin-top:8px;padding:6px 12px;border-radius:7px;border:none;font-weight:600;font-size:.97em;cursor:pointer;background:${node.status==='hecho'?'#27ae60':'#b2bec3'};color:${node.status==='hecho'?'#fff':'#232b3a'};transition:background .18s;">${node.status==='hecho'?'✔ Hecho':'Pendiente'}</button>` : ''}
      </div>
    `;
    // Si es tarea, agregar evento al botón
    if(node.type==='task') {
      const btn = el.querySelector('.task-status-btn');
      if(btn) {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          node.status = node.status==='hecho' ? 'pendiente' : 'hecho';
          saveToFirestore();
          renderAll();
        };
      }
    }
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
    statusBar.textContent = `Nodos: ${nodes.length} | Conexiones: ${connections.length} | Zoom: ${Math.round(boardZoom*100)}%`;
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
  // Selector de tipo
  const typeSelect = document.getElementById('ideaEditType');
  if (typeSelect) {
    typeSelect.innerHTML = '';
    NODE_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.type;
      opt.textContent = `${t.icon} ${t.label}`;
      if (node.type === t.type) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.onchange = () => {
      const t = NODE_TYPES.find(nt => nt.type === typeSelect.value);
      if (t) {
        node.type = t.type;
        node.icon = t.icon;
        node.color = t.color;
        // Limpiar campos personalizados al cambiar tipo
        if (t.fields && t.fields.length) {
          t.fields.forEach(f => { node[f.key] = ''; });
        }
        renderAll();
        showEditPanel(nodeId);
      }
    };
  }
  // Campos personalizados
  const customFieldsDiv = document.getElementById('ideaCustomFields');
  if (customFieldsDiv) {
    customFieldsDiv.innerHTML = '';
    const typeDef = NODE_TYPES.find(t => t.type === node.type);
    if (typeDef && typeDef.fields && typeDef.fields.length) {
      typeDef.fields.forEach(field => {
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = field.label;
        fieldLabel.style.marginTop = '8px';
        let input;
        if (field.type === 'text') {
          input = document.createElement('input');
          input.type = 'text';
          input.value = node[field.key] || '';
          input.placeholder = field.placeholder || '';
        } else if (field.type === 'date') {
          input = document.createElement('input');
          input.type = 'date';
          input.value = node[field.key] || '';
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = node[field.key] || '';
        }
        input.style.width = '100%';
        input.oninput = () => {
          node[field.key] = input.value;
        };
        customFieldsDiv.appendChild(fieldLabel);
        customFieldsDiv.appendChild(input);
      });
    }
  }
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
          // Ocultar el gate si existe
          const gate = document.getElementById('ideaGate');
          if (gate) gate.style.display = 'none';
        // Zoom dinámico: rueda del mouse y gesto de pinza
        if (viewport) {
          // Zoom con rueda del mouse
          viewport.addEventListener('wheel', (e) => {
            if (e.ctrlKey) return; // Evitar conflicto con zoom del navegador
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - panOrigin.x) / boardZoom;
            const mouseY = (e.clientY - rect.top - panOrigin.y) / boardZoom;
            let delta = e.deltaY < 0 ? 1 : -1;
            let prevZoom = boardZoom;
            boardZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, boardZoom + delta * ZOOM_STEP));
            // Mantener el punto bajo el cursor fijo
            panOrigin.x -= (boardZoom - prevZoom) * mouseX;
            panOrigin.y -= (boardZoom - prevZoom) * mouseY;
            renderAll();
          }, { passive: false });

          // Zoom con gesto de pinza en móvil
          let lastDist = null;
          let pinchCenter = null;
          viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              lastDist = Math.sqrt(dx*dx + dy*dy);
              const rect = viewport.getBoundingClientRect();
              pinchCenter = {
                x: ((e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left - panOrigin.x) / boardZoom,
                y: ((e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top - panOrigin.y) / boardZoom
              };
            }
          });
          viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && lastDist !== null && pinchCenter) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const newDist = Math.sqrt(dx*dx + dy*dy);
              let scaleDelta = (newDist - lastDist) / 180; // Sensibilidad
              let prevZoom = boardZoom;
              boardZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, boardZoom + scaleDelta));
              panOrigin.x -= (boardZoom - prevZoom) * pinchCenter.x;
              panOrigin.y -= (boardZoom - prevZoom) * pinchCenter.y;
              lastDist = newDist;
              renderAll();
            }
          }, { passive: false });
          viewport.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
              lastDist = null;
              pinchCenter = null;
            }
          });
        }
      const zoomInBtn = document.getElementById('ideaZoomInBtn');
      if (zoomInBtn) {
        zoomInBtn.onclick = () => {
          boardZoom = Math.min(MAX_ZOOM, boardZoom + ZOOM_STEP);
          renderAll();
        };
      }
      const zoomOutBtn = document.getElementById('ideaZoomOutBtn');
      if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
          boardZoom = Math.max(MIN_ZOOM, boardZoom - ZOOM_STEP);
          renderAll();
        };
      }
      const resetBtn = document.getElementById('ideaResetViewBtn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          boardZoom = 1;
          renderAll();
        };
      }
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

// Inicializar automáticamente para todos los usuarios
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.ideasBoard !== 'undefined') {
    window.ideasBoard.initIdeasBoard(null);
  }
});
