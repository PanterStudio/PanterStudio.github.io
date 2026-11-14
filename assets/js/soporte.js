/**
 * soporte.js — Motor de Sistema de Tickets para panterstudio.lat
 * Usa Firebase Firestore como backend + Discord Webhook para notificaciones
 */

// ============================================================
// CONFIGURACIÓN
// ============================================================
const SOPORTE_COLLECTION = 'soporte_tickets';
const COMENTARIOS_COLLECTION = 'soporte_comentarios';

// Mensajes de sistema del chat (icono vectorial + texto exacto).
const SYSTEM_ICON_HTML = '<i class="fa-solid fa-user-shield"></i>';
const SYSTEM_MSG_TOMADO = 'SOPORTE PANTER STUDIO HA TOMADO EL TICKET';
const SYSTEM_MSG_CERRADO = 'SOPORTE PANTER STUDIO HA CERRADO EL TICKET';

const CATEGORIAS = [
    { id: 'bug',        label: 'Bug / Error',      icon: '<i class="fa-solid fa-bug" aria-hidden="true"></i>',              faIcon: 'fa-solid fa-bug', color: '#ef4444' },
    { id: 'cuenta',     label: 'Mi Cuenta',        icon: '<i class="fa-solid fa-circle-user" aria-hidden="true"></i>',      faIcon: 'fa-solid fa-circle-user', color: '#00b0ff' },
    { id: 'tecnico',    label: 'Problema Técnico', icon: '<i class="fa-solid fa-gears" aria-hidden="true"></i>',            faIcon: 'fa-solid fa-gears', color: '#f59e0b' },
    { id: 'sugerencia', label: 'Sugerencia',       icon: '<i class="fa-solid fa-lightbulb" aria-hidden="true"></i>',        faIcon: 'fa-solid fa-lightbulb', color: '#a855f7' },
    { id: 'pago',       label: 'Pagos / Donación', icon: '<i class="fa-solid fa-credit-card" aria-hidden="true"></i>',      faIcon: 'fa-solid fa-credit-card', color: '#22c55e' },
    { id: 'minijuegos', label: 'Panter Core',      icon: '<i class="fa-solid fa-gamepad" aria-hidden="true"></i>',          faIcon: 'fa-solid fa-gamepad', color: '#0ea5e9' },
    { id: 'otro',       label: 'Otro',             icon: '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>',   faIcon: 'fa-solid fa-clipboard-list', color: '#64748b' }
];

const PRIORIDADES = [
    { id: 'baja',    label: 'Baja',    color: '#64748b', bg: 'rgba(100,116,139,0.15)', faIcon: 'fa-solid fa-arrow-down' },
    { id: 'normal',  label: 'Normal',  color: '#00b0ff', bg: 'rgba(0,176,255,0.12)',   faIcon: 'fa-solid fa-minus' },
    { id: 'alta',    label: 'Alta',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  faIcon: 'fa-solid fa-arrow-up' },
    { id: 'urgente', label: 'Urgente', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   faIcon: 'fa-solid fa-triangle-exclamation' }
];

const ESTADOS = {
    'Abierto':    { label: 'Abierto',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   faIcon: 'fa-solid fa-circle-dot' },
    'En Proceso': { label: 'En Proceso', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  faIcon: 'fa-solid fa-spinner' },
    'Resuelto':   { label: 'Resuelto',   color: '#00b0ff', bg: 'rgba(0,176,255,0.12)',   faIcon: 'fa-solid fa-circle-check' },
    'Cerrado':    { label: 'Cerrado',    color: '#64748b', bg: 'rgba(100,116,139,0.12)', faIcon: 'fa-solid fa-lock' }
};

const STAFF_ROLES = new Set(['founder_ceo', 'director', 'administrador', 'programador', 'moderador', 'soporte']);

// ============================================================
// PERSISTENCIA LOCAL — el soporte SIEMPRE funciona
// Si Firestore rechaza una escritura (reglas aún no publicadas, sin
// conexión, etc.), el cambio se guarda aquí, se refleja al instante
// en la UI y se fusiona con la nube en cuanto esté disponible.
// ============================================================
const LOCAL_TICKETS_KEY = 'ps_soporte_tickets_local';
const LOCAL_COMMENTS_KEY = 'ps_soporte_comentarios_local';
const LOCAL_EVENT = 'psSoporteLocal';

function readJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value == null ? fallback : value;
    } catch (e) { return fallback; }
}
function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
}
function notifyLocalChange() {
    try {
        document.dispatchEvent(new CustomEvent(LOCAL_EVENT));
        window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
    } catch (e) { /* noop */ }
}
function onLocalChange(callback) {
    if (typeof document === 'undefined') return () => {};
    document.addEventListener(LOCAL_EVENT, callback);
    return () => document.removeEventListener(LOCAL_EVENT, callback);
}

function localTickets() {
    const data = readJson(LOCAL_TICKETS_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}
function saveLocalTicket(ticket) {
    if (!ticket || !ticket.id) return;
    const all = localTickets();
    all[ticket.id] = Object.assign({}, all[ticket.id] || {}, ticket);
    writeJson(LOCAL_TICKETS_KEY, all);
    notifyLocalChange();
}
function patchLocalTicket(id, patch) {
    if (!id) return null;
    const all = localTickets();
    const merged = Object.assign({}, all[id] || { id }, patch, { id });
    all[id] = merged;
    writeJson(LOCAL_TICKETS_KEY, all);
    notifyLocalChange();
    return merged;
}
function mergeTickets(remote) {
    const map = new Map();
    (Array.isArray(remote) ? remote : []).forEach(t => { if (t && t.id) map.set(t.id, t); });
    Object.values(localTickets()).forEach(t => {
        if (!t || !t.id) return;
        map.set(t.id, Object.assign({}, map.get(t.id) || {}, t));
    });
    return Array.from(map.values())
        .map(t => normalizarTicket(t))
        .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
}

function localComments() {
    const data = readJson(LOCAL_COMMENTS_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}
function appendLocalComment(ticketId, comment) {
    if (!ticketId || !comment) return;
    const all = localComments();
    const list = Array.isArray(all[ticketId]) ? all[ticketId] : [];
    list.push(comment);
    all[ticketId] = list;
    writeJson(LOCAL_COMMENTS_KEY, all);
    notifyLocalChange();
}
function mergeComments(ticketId, remote) {
    const stored = localComments()[ticketId];
    const local = Array.isArray(stored) ? stored : [];
    const map = new Map();
    (Array.isArray(remote) ? remote : []).forEach(c => { if (c && c.id) map.set(c.id, c); });
    local.forEach(c => { if (c && c.id) map.set(c.id, c); });
    return Array.from(map.values())
        .sort((a, b) => String(a.creadoEn || '').localeCompare(String(b.creadoEn || '')));
}


// ============================================================
// HELPERS
// ============================================================

/**
 * Wait for Firebase Firestore globals to be ready.
 * Only checks for Firestore (db, collection, addDoc, etc.), NOT for auth user.
 * Auth user is a separate concern handled by DiscordAuth.
 */
function waitForFirebase(timeout = 12000) {
    return new Promise(resolve => {
        const isReady = () => window.db && window.collection && window.addDoc && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.query && window.where && window.orderBy;
        if (isReady()) return resolve(true);

        // Also listen for the firebaseReady event dispatched by firebase-config.js
        let resolved = false;
        const onReady = () => {
            if (resolved) return;
            if (isReady()) {
                resolved = true;
                clearInterval(t);
                document.removeEventListener('firebaseReady', onReady);
                resolve(true);
            }
        };
        document.addEventListener('firebaseReady', onReady);

        const start = Date.now();
        const t = setInterval(() => {
            if (isReady()) {
                resolved = true;
                clearInterval(t);
                document.removeEventListener('firebaseReady', onReady);
                resolve(true);
            } else if (Date.now() - start > timeout) {
                resolved = true;
                clearInterval(t);
                document.removeEventListener('firebaseReady', onReady);
                console.error('[SoporteJS] Firebase no se inicializó en', timeout, 'ms');
                resolve(false);
            }
        }, 150);
    });
}

function generateTicketCode() {
    const rand = Math.floor(Math.random() * 90000) + 10000;
    return `TKT-${rand}`;
}

function formatDate(isoStr) {
    if (!isoStr) return '—';
    let d;
    if (typeof isoStr === 'object') {
        if (typeof isoStr.toDate === 'function') d = isoStr.toDate();
        else if (typeof isoStr.seconds === 'number') d = new Date(isoStr.seconds * 1000);
        else d = new Date(isoStr);
    } else {
        d = new Date(isoStr);
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Normaliza el estado de un ticket. Los tickets antiguos pueden guardar
 * `status` (open/closed/...) en vez de `estado` ("Abierto"/"Cerrado").
 */
function normalizarEstado(valor) {
    const raw = String(valor || '').trim();
    if (ESTADOS[raw]) return raw;
    const clave = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const mapa = {
        'abierto': 'Abierto', 'open': 'Abierto', 'pendiente': 'Abierto', 'nuevo': 'Abierto', 'new': 'Abierto', 'activo': 'Abierto',
        'en proceso': 'En Proceso', 'en progreso': 'En Proceso', 'proceso': 'En Proceso', 'in progress': 'En Proceso', 'progress': 'En Proceso', 'pending': 'En Proceso',
        'resuelto': 'Resuelto', 'resolved': 'Resuelto', 'solucionado': 'Resuelto', 'done': 'Resuelto',
        'cerrado': 'Cerrado', 'closed': 'Cerrado', 'finalizado': 'Cerrado', 'cancelado': 'Cerrado'
    };
    return mapa[clave] || 'Abierto';
}

/**
 * Unifica el esquema de un ticket leído de Firestore:
 * - estado (preferente) o status
 * - actualizadoEn (preferente) o updatedAt
 */
function normalizarTicket(data) {
    if (!data) return null;
    return {
        ...data,
        estado: normalizarEstado(data.estado || data.status),
        actualizadoEn: data.actualizadoEn || data.updatedAt || data.creadoEn || null
    };
}

/**
 * Traduce errores de Firestore a mensajes entendibles para el usuario.
 */
function traducirErrorFirestore(err) {
    const code = String(err?.code || '').toLowerCase();
    const msg = String(err?.message || err || '');
    if (code.includes('permission-denied') || /permission|insufficient/i.test(msg)) {
        return 'Permiso denegado por Firestore. Publica las reglas actualizadas del proyecto para permitir actualizar tickets.';
    }
    if (code.includes('unavailable') || /offline|network|failed to get/i.test(msg)) {
        return 'Sin conexión con Firestore. Revisa tu red e inténtalo de nuevo.';
    }
    if (code.includes('unauthenticated')) {
        return 'La sesión no es válida. Vuelve a iniciar sesión.';
    }
    if (code.includes('not-found')) {
        return 'El ticket ya no existe.';
    }
    return msg || 'Error desconocido al contactar Firestore.';
}

function getCategoria(id) {
    return CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
}

function getPrioridad(id) {
    return PRIORIDADES.find(p => p.id === id) || PRIORIDADES[1];
}

function getEstado(name) {
    return ESTADOS[name] || ESTADOS['Abierto'];
}

function estadoBadge(estado) {
    const e = getEstado(estado);
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:0.72rem;font-weight:700;background:${e.bg};color:${e.color};border:1px solid ${e.color}40;"><i class="${e.faIcon}" aria-hidden="true"></i>${e.label}</span>`;
}

function prioridadBadge(prio) {
    const p = getPrioridad(prio);
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:100px;font-size:0.72rem;font-weight:700;background:${p.bg};color:${p.color};"><i class="${p.faIcon}" aria-hidden="true"></i>${p.label}</span>`;
}

function isStaff(role) {
    if (window.PanterRoles) {
        return window.PanterRoles.isTicketStaff(role);
    }
    return STAFF_ROLES.has(String(role || '').toLowerCase());
}

function puedeVerTicket(ticket, user, role) {
    if (!ticket) return false;
    if (isStaff(role)) return true;
    if (!user) return false;
    return String(ticket.usuarioId || '') === String(user.uid || '');
}

// ============================================================
// ROLES GLOBALES EN COMENTARIOS (badges dinámicos)
// ============================================================

/**
 * Espejo de la paleta oficial de roles.js.
 * `obtenerRolBadge()` consulta PanterRoles en vivo; este mapa sólo actúa
 * como respaldo si el módulo central no está disponible.
 */
const ROLE_BADGE_FALLBACK = {
    founder_ceo:       { label: 'Fundador',             color: '#f1c40f', icon: 'fa-solid fa-crown' },
    director:          { label: 'Director',             color: '#ff0000', icon: 'fa-solid fa-user-tie' },
    administrador:     { label: 'Administrador',        color: '#f1c40f', icon: 'fa-solid fa-shield-halved' },
    programador:       { label: 'Programador',          color: '#ffbc00', icon: 'fa-solid fa-code' },
    modelador:         { label: 'Modelador',            color: '#6f5cff', icon: 'fa-solid fa-cube' },
    moderador:         { label: 'Moderador',            color: '#e67e22', icon: 'fa-solid fa-gavel' },
    soporte:           { label: 'Soporte',              color: '#00a715', icon: 'fa-solid fa-headset' },
    creador_contenido: { label: 'Creador de Contenido', color: '#9d00ff', icon: 'fa-solid fa-photo-film' },
    vip:               { label: 'VIP',                  color: '#ff7ddf', icon: 'fa-solid fa-star' },
    usuario:           { label: 'Usuario',              color: '#0055ff', icon: 'fa-solid fa-user' }
};

function buildRoleBadgeDefs() {
    const R = window.PanterRoles || null;
    if (!R || !R.ROLE_DEFS) return Object.assign({}, ROLE_BADGE_FALLBACK);
    const out = {};
    Object.values(R.ROLE_DEFS).forEach(def => {
        if (!def || !def.id) return;
        out[def.id] = {
            label: def.label || def.id,
            color: def.color || '#94a3b8',
            icon: def.icon || 'fa-solid fa-user'
        };
    });
    return out;
}

const ROLE_BADGE_DEFS = buildRoleBadgeDefs();

function refreshRoleBadgeDefs() {
    const live = buildRoleBadgeDefs();
    Object.keys(ROLE_BADGE_DEFS).forEach(key => { delete ROLE_BADGE_DEFS[key]; });
    Object.assign(ROLE_BADGE_DEFS, live);
}

const ROLES_USUARIO_TTL = 3 * 60 * 1000;
const EQUIPO_ROLES_TTL = 5 * 60 * 1000;
const rolesUsuarioCache = new Map();
let equipoRolesPromise = null;
let equipoRolesAt = 0;

function escapeHtmlSoporte(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Convierte una URL de Imgur (página individual) en enlace directo de imagen. */
function normalizarUrlImagen(raw) {
    let url = String(raw || '').trim();
    if (!/^https?:\/\//i.test(url)) return null;
    const pagina = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,12})\/?(?:[?#].*)?$/i);
    if (pagina) return `https://i.imgur.com/${pagina[1]}.jpg`;
    if (/^https?:\/\/(?:www\.)?imgur\.com\/(?:a|gallery|t)\//i.test(url)) return null;
    // URL directa de imagen (con o sin extensión / query).
    if (/^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|bmp|avif)(?:\?[^\s]*)?$/i.test(url)) return url;
    if (/^https?:\/\/i\.imgur\.com\//i.test(url)) return url;
    return null;
}

/**
 * Construye el HTML del cuerpo de un comentario.
 *  · Mensaje de sistema: icono user-shield + texto exacto, con estilo propio.
 *  · Mensaje normal: texto escapado + previsualización de imágenes Imgur/URL
 *    directa pegadas en el mensaje.
 */
function renderTextoComentario(comentario) {
    if (!comentario) return '';
    if (comentario.esSistema) {
        // Contenido constante generado por el motor (nunca input del usuario).
        return `<div class="sp-system-msg">${comentario.texto}</div>`;
    }

    const texto = String(comentario.texto || '');
    const partes = texto.split(/(\bhttps?:\/\/[^\s<>"']+)/gi);
    let html = '';
    let imagenes = '';

    partes.forEach(parte => {
        if (!parte) return;
        const imagen = /^https?:\/\//i.test(parte) ? normalizarUrlImagen(parte.replace(/[.,;:!?)]+$/, '')) : null;
        if (imagen) {
            imagenes += `<a href="${escapeHtmlSoporte(parte)}" target="_blank" rel="noopener" class="sp-chat-img-link">`
                + `<img src="${escapeHtmlSoporte(imagen)}" alt="Imagen adjunta" class="sp-chat-img" loading="lazy" decoding="async"></a>`;
            html += `<a href="${escapeHtmlSoporte(parte)}" target="_blank" rel="noopener" class="sp-chat-link">${escapeHtmlSoporte(parte)}</a>`;
        } else {
            html += escapeHtmlSoporte(parte);
        }
    });

    return `<div class="sp-chat-texto">${html}</div>${imagenes ? `<div class="sp-chat-imagenes">${imagenes}</div>` : ''}`;
}

function normalizarRol(valor) {
    if (window.PanterRoles && typeof window.PanterRoles.normalize === 'function') {
        return window.PanterRoles.normalize(valor);
    }
    const clave = String(valor || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\s-]+/g, '_');
    const mapa = {
        admin_owner: 'founder_ceo', owner: 'founder_ceo', administrator_owner: 'founder_ceo',
        founder_ceo: 'founder_ceo', founder: 'founder_ceo', ceo: 'founder_ceo', fundador: 'founder_ceo',
        director: 'director', administrador: 'administrador', admin: 'administrador', administrator: 'administrador',
        programador: 'programador', developer: 'programador', dev: 'programador',
        modelador: 'modelador', moderador: 'moderador', mod: 'moderador',
        soporte: 'soporte', support: 'soporte',
        creador_contenido: 'creador_contenido', creador: 'creador_contenido', creator: 'creador_contenido',
        vip: 'vip', usuario: 'usuario', user: 'usuario', member: 'usuario'
    };
    return mapa[clave] || 'usuario';
}

function obtenerRolBadge(rol) {
    const id = normalizarRol(rol);
    if (window.PanterRoles && typeof window.PanterRoles.get === 'function') {
        const def = window.PanterRoles.get(id);
        if (def && def.id) {
            return {
                id: def.id,
                label: def.label || def.id,
                color: def.color || '#94a3b8',
                icon: def.icon || 'fa-solid fa-user'
            };
        }
    }
    const def = ROLE_BADGE_DEFS[id] || ROLE_BADGE_DEFS.usuario;
    return { id, ...def };
}

function colorTextoContraste(hex) {
    const limpio = String(hex || '').replace('#', '');
    if (limpio.length !== 6) return '#ffffff';
    const r = parseInt(limpio.slice(0, 2), 16);
    const g = parseInt(limpio.slice(2, 4), 16);
    const b = parseInt(limpio.slice(4, 6), 16);
    const luz = 0.299 * r + 0.587 * g + 0.114 * b;
    return luz > 165 ? '#0b0f17' : '#ffffff';
}

/**
 * Devuelve el HTML de la insignia de rol con la paleta oficial.
 * @param {string} rol id o alias del rol (soporte, moderador, founder_ceo...)
 */
function rolBadgeHtml(rol) {
    const def = obtenerRolBadge(rol);
    const texto = colorTextoContraste(def.color);
    return `<span class="ps-ticket-role-badge" data-role="${def.id}" title="Rol: ${escapeHtmlSoporte(def.label)}" style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:100px;font-size:0.62rem;font-weight:800;letter-spacing:.35px;text-transform:uppercase;line-height:1.5;color:${texto};background:${def.color};border:1px solid ${def.color};"><i class="${def.icon}" aria-hidden="true"></i><span>${escapeHtmlSoporte(def.label)}</span></span>`;
}

function claveAutorComentario(comentario) {
    if (!comentario) return 'anonimo';
    return String(comentario.autorId || comentario.autor || 'anonimo');
}

function clavesUsuario(autorId) {
    const claves = new Set();
    const raw = String(autorId || '').trim();
    if (!raw) return [];
    claves.add(raw);
    if (raw.startsWith('discord_')) {
        const numeric = raw.slice('discord_'.length);
        if (numeric) claves.add(numeric);
    } else if (/^\d{5,25}$/.test(raw)) {
        claves.add(`discord_${raw}`);
    }
    return Array.from(claves);
}

function normalizarNombreClave(valor) {
    return String(valor || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function extraerRolDocumento(data) {
    if (!data) return null;
    const candidatos = [data.role, data.rol, data.roleEquipo, data.rango, data.roleName];
    for (const valor of candidatos) {
        if (typeof valor === 'string' && valor.trim()) return valor;
    }
    return null;
}

/** Copia local que escribe el Panel Admin → Personal cuando la nube
 *  aún no está disponible. Es la MISMA fuente que usa Personal y el foro. */
function leerEquipoLocal() {
    try {
        const lista = JSON.parse(localStorage.getItem('ps_staff_local') || '[]');
        return Array.isArray(lista)
            ? lista.filter(m => m && (m.uid || m.id) && m.archivado !== true)
                   .map(m => Object.assign({ id: String(m.uid || m.id) }, m))
            : [];
    } catch (e) { return []; }
}

function mezclarEquipo(remotos, locales) {
    const mapa = new Map();
    (Array.isArray(remotos) ? remotos : []).forEach(m => {
        if (m) mapa.set(String(m.id || m.uid), m);
    });
    (Array.isArray(locales) ? locales : []).forEach(m => {
        const k = String(m.id || m.uid);
        mapa.set(k, Object.assign({}, mapa.get(k) || {}, m, { id: k }));
    });
    return Array.from(mapa.values());
}

async function cargarEquipoRoles() {
    const ahora = Date.now();
    if (equipoRolesPromise && (ahora - equipoRolesAt) < EQUIPO_ROLES_TTL) return equipoRolesPromise;
    equipoRolesAt = ahora;
    const locales = (window.PanterStaff && typeof window.PanterStaff.allMembers === 'function')
        ? window.PanterStaff.allMembers()
        : leerEquipoLocal();
    if (!window.db || !window.collection || !window.getDocs) {
        equipoRolesPromise = Promise.resolve(locales);
        return equipoRolesPromise;
    }
    equipoRolesPromise = window.getDocs(window.collection(window.db, 'equipo'))
        .then(snap => mezclarEquipo(snap.docs.map(d => ({ id: d.id, ...d.data() })), locales))
        .catch(err => {
            console.warn('[SoporteJS] No se pudo leer la colección equipo:', err?.message || err);
            return locales;
        });
    return equipoRolesPromise;
}

function buscarMiembroEquipo(equipo, claves, autorNombre, autorEmail) {
    if (!Array.isArray(equipo) || !equipo.length) return null;
    const ids = new Set((claves || []).map(String));
    const email = String(autorEmail || '').trim().toLowerCase();

    for (const doc of equipo) {
        if (!doc || doc.archivado === true) continue;
        const docIds = [doc.id, doc.uid, doc.discordId, doc.discord_id]
            .filter(Boolean).map(String);
        if (docIds.some(id => ids.has(id))) return doc;
        if (email && String(doc.email || '').trim().toLowerCase() === email) return doc;
    }

    // Respaldo para documentos de equipo creados manualmente sin UID de Discord.
    const claveNombre = normalizarNombreClave(autorNombre);
    if (!claveNombre || claveNombre.length < 3) return null;
    for (const doc of equipo) {
        if (!doc || doc.archivado === true) continue;
        const nombres = [doc.nombre, doc.displayName, doc.username, doc.nombre_usuario, doc.discordUsername]
            .filter(Boolean).map(normalizarNombreClave);
        if (nombres.includes(claveNombre)) return doc;
    }
    return null;
}

/**
 * Resuelve el rol global de un autor de comentario con la MISMA política
 * que `PanterRoles.resolveRole`:
 *   1. Rango manual asignado en Panel Admin → Personal (`equipo`).
 *   2. Cualquier otra cuenta → `usuario`.
 *
 * No hay rango automático por correo. `conductores.role`, `esStaff` y
 * los datos de Discord NO otorgan rango.
 */
async function resolverRolUsuario(autorId, autorNombre, autorEmail) {
    const emailInicial = String(autorEmail || '').trim().toLowerCase();
    const clave = String(autorId || autorNombre || emailInicial || 'anonimo').trim();

    // Fuente compartida (equipo + ps_staff_local + sesión): siempre fresca,
    // de modo que un cambio de rango en Personal se vea en el chat al
    // instante, incluso en mensajes ya publicados.
    if (window.PanterStaff && typeof window.PanterStaff.roleForAuthor === 'function') {
        const directo = window.PanterStaff.roleForAuthor({
            uid: autorId, email: autorEmail, nombre: autorNombre
        });
        if (directo) return normalizarRol(directo);
    }

    const cache = rolesUsuarioCache.get(clave);
    if (cache && (Date.now() - cache.at) < ROLES_USUARIO_TTL) return cache.role;

    const ids = clavesUsuario(autorId);
    const R = window.PanterRoles;
    let rol = null;
    let definitivo = false;

    // Única fuente: rango manual en `equipo` (por uid o por correo).
    // No hay rango automático por correo ni por Discord.
    try {
        const equipo = await cargarEquipoRoles();
        const miembro = buscarMiembroEquipo(equipo, ids, autorNombre, emailInicial);
        if (miembro) {
            rol = extraerRolDocumento(miembro);
            if (rol) definitivo = true;
        }
    } catch (e) { /* lectura opcional */ }

    if (!rol) rol = 'usuario';

    const normalizado = normalizarRol(rol);
    if (definitivo) rolesUsuarioCache.set(clave, { role: normalizado, at: Date.now() });
    return normalizado;
}

/**
 * Resuelve en lote los roles de todos los comentarios.
 * @returns {Promise<Map<string,string>>} claveAutorComentario → rol
 */
async function resolverRolesComentarios(comentarios) {
    const mapa = new Map();
    const lista = Array.isArray(comentarios) ? comentarios : [];
    const unicos = new Map();
    lista.forEach(c => {
        if (!c) return;
        const clave = claveAutorComentario(c);
        if (!unicos.has(clave)) unicos.set(clave, c);
    });

    await Promise.all(Array.from(unicos.values()).map(async c => {
        const rol = await resolverRolUsuario(c.autorId, c.autor, c.autorEmail);
        mapa.set(claveAutorComentario(c), rol);
    }));
    return mapa;
}

function limpiarCacheRoles() {
    refreshRoleBadgeDefs();
    rolesUsuarioCache.clear();
    equipoRolesPromise = null;
    equipoRolesAt = 0;
}

/**
 * Observa `equipo` y la configuración de roles para repintar las insignias
 * del chat en vivo. No necesita la lista de comentarios: la caché de roles
 * se invalida globalmente y el render vuelve a resolver cada autor.
 */
async function suscribirCambiosRoles(onChange, onError) {
    await ensureFirestore();
    if (!window.onSnapshot) throw new Error('Firestore no expone onSnapshot.');

    let active = true;
    let equipoActual = [];
    let equipoUnsub = null;

    const notificarCambio = () => {
        if (!active) return;
        rolesUsuarioCache.clear();
        equipoRolesPromise = Promise.resolve(equipoActual);
        equipoRolesAt = Date.now();
        if (typeof onChange === 'function') onChange();
    };

    equipoUnsub = window.onSnapshot(
        window.collection(window.db, 'equipo'),
        snap => {
            const locales = (window.PanterStaff && typeof window.PanterStaff.allMembers === 'function')
                ? window.PanterStaff.allMembers() : leerEquipoLocal();
            equipoActual = mezclarEquipo(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })), locales);
            notificarCambio();
        },
        error => {
            console.error('[SoporteJS] Error observando roles del equipo:', error);
            if (typeof onError === 'function') onError(error);
        }
    );
    document.addEventListener('panter:roles-config', notificarCambio);
    document.addEventListener('panter:staff-changed', notificarCambio);

    return () => {
        active = false;
        if (equipoUnsub) equipoUnsub();
        equipoUnsub = null;
        document.removeEventListener('panter:roles-config', notificarCambio);
        document.removeEventListener('panter:staff-changed', notificarCambio);
    };
}

if (typeof document !== 'undefined') {
    document.addEventListener('panter:roles-config', limpiarCacheRoles);
    document.addEventListener('panter:staff-changed', limpiarCacheRoles);
}

/** Mensaje de sistema reutilizable (icono user-shield + texto exacto). */
async function agregarMensajeSistema(ticketId, mensaje) {
    return agregarComentario(
        ticketId,
        `${SYSTEM_ICON_HTML} ${mensaje}`,
        'Sistema', 'sistema', true, null, null, true
    );
}

/** El staff toma el ticket: pasa a En Proceso e inyecta el aviso en el chat. */
async function tomarTicket(ticketId, staffName, staffUid) {
    const actualizado = await actualizarTicket(ticketId, {
        estado: 'En Proceso',
        staffAsignadoId: staffUid || null,
        staffNombre: staffName || 'Staff'
    });
    await agregarMensajeSistema(ticketId, SYSTEM_MSG_TOMADO);
    return actualizado;
}

async function cerrarTicket(ticketId, staffName) {
    await actualizarTicket(ticketId, {
        estado: 'Cerrado',
        cerradoPor: staffName || 'Staff',
        cerradoEn: new Date().toISOString()
    });
    await agregarMensajeSistema(ticketId, SYSTEM_MSG_CERRADO);
}

async function reabrirTicket(ticketId) {
    await actualizarTicket(ticketId, {
        estado: 'Abierto',
        cerradoPor: null,
        cerradoEn: null
    });
}


// ============================================================
// DISCORD WEBHOOK — Notificación profesional de nuevo ticket
// ============================================================
async function enviarNotificacionDiscordWebhook(ticket) {
    const WEBHOOK_URL = 'https://discord.com/api/webhooks/1520119576006754517/D8sHMslbxELINUyBb-nJjrcEiFuyi90OiiHXRNoTyya1sVTKdN5vRvtzc3KTv6MLbpi_';
    
    const prioColor = {
        'baja': 0x64748b,
        'normal': 0x00b0ff,
        'alta': 0xf59e0b,
        'urgente': 0xef4444
    };

    const catEmoji = {
        'bug': '🐛 Bug / Error',
        'cuenta': '👤 Mi Cuenta',
        'tecnico': '⚙️ Técnico',
        'sugerencia': '💡 Sugerencia',
        'pago': '💳 Pago',
        'minijuegos': '🎮 Minijuegos',
        'otro': '📋 Consulta General'
    };

    const userName = ticket.usuarioNombre || 'Usuario Discord';
    const userEmail = ticket.usuarioEmail ? `\`${ticket.usuarioEmail}\`` : 'No especificado';
    const isDiscordUid = String(ticket.usuarioId || '').startsWith('discord_');
    const discordMention = isDiscordUid ? `<@${String(ticket.usuarioId).replace('discord_', '')}>` : userName;

    const payload = {
        username: 'Panter Studio Support Bot',
        avatar_url: 'https://panterstudio.lat/recursos/PSGD.png',
        content: `🚨 **Nuevo Ticket de Soporte Registrado** — ${discordMention}`,
        embeds: [
            {
                title: `🎟️ Ticket ${ticket.codigo}: ${ticket.titulo}`,
                description: `**Descripción del Caso:**\n\`\`\`text\n${ticket.descripcion}\n\`\`\``,
                color: prioColor[ticket.prioridad] || 0x00b0ff,
                fields: [
                    { name: '👤 Usuario / Autor', value: `${userName}\n(${userEmail})`, inline: true },
                    { name: '🏷️ Categoría', value: catEmoji[ticket.categoria] || ticket.categoria.toUpperCase(), inline: true },
                    { name: '⚡ Prioridad', value: String(ticket.prioridad).toUpperCase(), inline: true },
                    { name: '🆔 ID de Referencia', value: `\`${ticket.codigo}\``, inline: true },
                    { name: '📌 Estado Inicial', value: '🟢 Abierto / Pendiente', inline: true },
                    { name: '🌐 Origen', value: 'Plataforma Web Official', inline: true }
                ],
                footer: {
                    text: 'Panter Studio Game Dev · Sistema de Atención al Cliente',
                    icon_url: 'https://panterstudio.lat/recursos/PSGD.png'
                },
                timestamp: new Date().toISOString()
            }
        ]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.warn('[SoporteJS] Webhook response status:', response.status);
        } else {
            console.log('[SoporteJS] Notificación Discord enviada correctamente');
        }
    } catch(err) {
        console.warn('[SoporteJS] Webhook notification warning:', err);
    }
}

// ============================================================
// FIRESTORE CRUD
// ============================================================

/**
 * Ensures Firestore is ready before performing any CRUD operation.
 * Throws a clear error if Firebase isn't available.
 */
async function ensureFirestore() {
    if (window.db && window.collection && window.addDoc) return true;
    const ready = await waitForFirebase();
    if (!ready) {
        throw new Error('No se pudo conectar con el servidor de soporte. Firebase Firestore no está disponible. Recarga la página e intenta de nuevo.');
    }
    return true;
}

async function crearTicket(data) {
    await ensureFirestore();

    const codigo = generateTicketCode();
    const now = new Date().toISOString();
    const docData = {
        codigo,
        titulo: data.titulo,
        descripcion: data.descripcion,
        categoria: data.categoria,
        prioridad: data.prioridad || 'normal',
        estado: 'Abierto',
        status: 'Abierto',
        usuarioId: data.usuarioId,
        usuarioNombre: data.usuarioNombre,
        usuarioEmail: data.usuarioEmail,
        creadoEn: now,
        actualizadoEn: now,
        updatedAt: now,
        staffAsignadoId: null,
        staffNombre: null,
        rolMinimoRequerido: 'Soporte',
        comentariosCount: 0
    };

    try {
        const ref = await window.addDoc(window.collection(window.db, SOPORTE_COLLECTION), docData);
        const createdTicket = { id: ref.id, ...docData };
        console.log('[SoporteJS] Ticket creado en Firestore:', createdTicket.codigo);

        // Send Discord webhook (non-blocking)
        enviarNotificacionDiscordWebhook(createdTicket).catch(e => {
            console.warn('[SoporteJS] Error enviando webhook (no bloqueante):', e);
        });

        return createdTicket;
    } catch (err) {
        console.warn('[SoporteJS] Firestore rechazó el alta; se guarda en copia local:', err);

        // El ticket se crea IGUAL: aparece al instante para el usuario y para
        // el staff, y se sincronizará cuando la base de datos lo permita.
        const fallbackTicket = { id: 'local-' + Date.now(), ...docData };
        saveLocalTicket(fallbackTicket);

        enviarNotificacionDiscordWebhook(fallbackTicket).catch(e => {
            console.warn('[SoporteJS] Error enviando webhook fallback:', e);
        });

        return fallbackTicket;
    }
}

function variantesUsuario(userId) {
    const raw = String(userId || '').trim();
    if (!raw) return [];
    const ids = new Set([raw]);
    if (raw.startsWith('discord_')) {
        const numeric = raw.slice('discord_'.length);
        if (numeric) ids.add(numeric);
    } else if (/^\d{5,25}$/.test(raw)) {
        ids.add(`discord_${raw}`);
    }
    return Array.from(ids);
}

async function getMisTickets(userId, userEmail = '') {
    await ensureFirestore();

    const encontrados = new Map();
    const ids = variantesUsuario(userId);
    const email = String(userEmail || '').trim().toLowerCase();

    for (const id of ids) {
        const q = window.query(
            window.collection(window.db, SOPORTE_COLLECTION),
            window.where('usuarioId', '==', id)
        );
        const snap = await window.getDocs(q);
        snap.docs.forEach(d => encontrados.set(d.id, normalizarTicket({ id: d.id, ...d.data() })));
    }

    if (email) {
        const q = window.query(
            window.collection(window.db, SOPORTE_COLLECTION),
            window.where('usuarioEmail', '==', email)
        );
        const snap = await window.getDocs(q);
        snap.docs.forEach(d => encontrados.set(d.id, normalizarTicket({ id: d.id, ...d.data() })));
    }

    // Copia local del propio usuario (tickets creados o actualizados sin nube).
    Object.values(localTickets()).forEach(t => {
        if (!t || !t.id) return;
        const matchesId = ids.some(id => String(t.usuarioId || '') === id);
        const matchesEmail = Boolean(email && String(t.usuarioEmail || '').trim().toLowerCase() === email);
        if (matchesId || matchesEmail) {
            encontrados.set(t.id, Object.assign({}, encontrados.get(t.id) || {}, t));
        }
    });

    return Array.from(encontrados.values())
        .map(t => normalizarTicket(t))
        .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
}

async function getTicketById(ticketId) {
    const local = localTickets()[ticketId];
    let remote = null;
    try {
        await ensureFirestore();
        const snap = await window.getDoc(window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId));
        if (snap.exists()) remote = normalizarTicket({ id: snap.id, ...snap.data() });
    } catch (e) { /* nube no disponible */ }
    if (!remote && !local) return null;
    return normalizarTicket(Object.assign({}, remote || {}, local || {}, { id: ticketId }));
}

async function buscarPorCodigo(codigo) {
    const code = String(codigo || '').toUpperCase().trim();
    const localMatch = Object.values(localTickets())
        .find(t => String(t.codigo || '').toUpperCase() === code);
    try {
        await ensureFirestore();
        const q = window.query(
            window.collection(window.db, SOPORTE_COLLECTION),
            window.where('codigo', '==', code)
        );
        const snap = await window.getDocs(q);
        if (!snap.empty) {
            const d = snap.docs[0];
            return normalizarTicket(Object.assign(
                {}, { id: d.id, ...d.data() }, localTickets()[d.id] || {}
            ));
        }
    } catch (e) { /* nube no disponible */ }
    return localMatch ? normalizarTicket(localMatch) : null;
}

async function getTodosLosTickets() {
    let remote = [];
    try {
        await ensureFirestore();
        // Sin orderBy: no se pierden tickets antiguos sin `creadoEn` y no
        // se exige un índice compuesto. El orden se aplica en cliente.
        const snap = await window.getDocs(window.collection(window.db, SOPORTE_COLLECTION));
        remote = snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('[SoporteJS] No se pudo leer la nube; se usa la copia local.', e);
    }
    return mergeTickets(remote);
}

/**
 * Actualiza un ticket. El cambio SIEMPRE se aplica: primero en la copia
 * local (respuesta inmediata en la UI) y después en Firestore. Si la nube
 * rechaza la escritura, no se lanza error: el ticket queda actualizado
 * localmente y se sincronizará cuando sea posible.
 */
async function actualizarTicket(ticketId, updates = {}) {
    const now = new Date().toISOString();
    const payload = { ...updates };

    let estado = null;
    if (payload.estado != null) estado = normalizarEstado(payload.estado);
    else if (payload.status != null) estado = normalizarEstado(payload.status);
    if (estado) {
        payload.estado = estado;
        payload.status = estado;
    }

    payload.actualizadoEn = now;
    payload.updatedAt = now;

    const merged = patchLocalTicket(ticketId, payload);

    try {
        await ensureFirestore();
        await window.setDoc(
            window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
            payload,
            { merge: true }
        );
    } catch (err) {
        console.warn('[SoporteJS] Cambio aplicado en copia local (Firestore rechazó):', err);
    }

    return { id: ticketId, ...(merged || payload) };
}

async function agregarComentario(ticketId, texto, autor, autorId, esStaff = false, autorRol = null, autorEmail = null, esSistema = false) {
    const now = new Date().toISOString();
    const comentario = {
        texto, autor, autorId,
        esStaff: Boolean(esStaff),
        esSistema: Boolean(esSistema),
        creadoEn: now
    };
    if (autorRol) comentario.autorRol = normalizarRol(autorRol);
    if (autorEmail) comentario.autorEmail = String(autorEmail).trim().toLowerCase();

    // El comentario SIEMPRE se guarda (nube si puede, copia local si no).
    let savedId = `local_${Date.now().toString(36)}`;
    try {
        await ensureFirestore();
        const ref = await window.addDoc(
            window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios'),
            comentario
        );
        savedId = ref.id;
    } catch (err) {
        console.warn('[SoporteJS] Comentario guardado en copia local:', err);
    }
    appendLocalComment(ticketId, Object.assign({ id: savedId }, comentario));

    // El contador es informativo: si falla, el comentario ya quedó guardado.
    try {
        if (!window.db || !window.fsDoc || !window.setDoc) return;
        let contador = null;
        if (window.increment) {
            contador = window.increment(1);
        } else {
            const snap = await window.getDoc(window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId));
            contador = Number(snap.data()?.comentariosCount || 0) + 1;
        }
        await window.setDoc(
            window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
            { actualizadoEn: now, comentariosCount: contador },
            { merge: true }
        );
    } catch (counterErr) {
        console.warn('[SoporteJS] El comentario se guardó, pero no se pudo actualizar el contador:', counterErr);
    }
    return { id: savedId, ...comentario };
}

async function getComentarios(ticketId) {
    let remote = [];
    try {
        await ensureFirestore();
        const q = window.query(
            window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios'),
            window.orderBy('creadoEn', 'asc')
        );
        const snap = await window.getDocs(q);
        remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { /* nube no disponible */ }
    return mergeComments(ticketId, remote);
}

// ============================================================
// SUSCRIPCIONES EN TIEMPO REAL (onSnapshot + copia local)
// Cada suscripción emite la mezcla de la nube y lo guardado en este
// navegador, y se refresca sola cuando cambia la copia local.
// ============================================================

async function suscribirTickets(onData, onError) {
    let remote = [];
    let unsub = null;
    const emit = () => { if (typeof onData === 'function') onData(mergeTickets(remote)); };

    try {
        await ensureFirestore();
        if (typeof window.onSnapshot === 'function') {
            unsub = window.onSnapshot(
                window.collection(window.db, SOPORTE_COLLECTION),
                snap => {
                    remote = snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() }));
                    emit();
                },
                err => {
                    console.warn('[SoporteJS] onSnapshot tickets:', err);
                    if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
                }
            );
        }
    } catch (e) {
        console.warn('[SoporteJS] Suscripción de tickets no disponible; se usa copia local.', e);
    }

    emit();
    const stopLocal = onLocalChange(emit);
    return () => {
        stopLocal();
        if (unsub) { try { unsub(); } catch (e) { /* noop */ } }
    };
}

async function suscribirTicket(ticketId, onData, onError) {
    let remote = null;
    let unsub = null;
    const emit = () => {
        if (typeof onData !== 'function') return;
        const local = localTickets()[ticketId];
        if (!remote && !local) return onData(null);
        onData(normalizarTicket(Object.assign({}, remote || {}, local || {}, { id: ticketId })));
    };

    try {
        await ensureFirestore();
        if (typeof window.onSnapshot === 'function') {
            unsub = window.onSnapshot(
                window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
                snap => {
                    remote = snap.exists() ? normalizarTicket({ id: snap.id, ...snap.data() }) : null;
                    emit();
                },
                err => {
                    console.warn('[SoporteJS] onSnapshot ticket:', err);
                    if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
                }
            );
        }
    } catch (e) {
        console.warn('[SoporteJS] Suscripción del ticket no disponible.', e);
    }

    emit();
    const stopLocal = onLocalChange(emit);
    return () => {
        stopLocal();
        if (unsub) { try { unsub(); } catch (e) { /* noop */ } }
    };
}

async function suscribirMisTickets(userId, userEmail, onData, onError) {
    const ids = variantesUsuario(userId);
    const email = String(userEmail || '').trim().toLowerCase();
    const buckets = new Map();
    const unsubs = [];

    const emit = () => {
        if (typeof onData !== 'function') return;
        const encontrados = new Map();
        buckets.forEach(list => list.forEach(t => { if (t && t.id) encontrados.set(t.id, t); }));
        Object.values(localTickets()).forEach(t => {
            if (!t || !t.id) return;
            const matchesId = ids.some(id => String(t.usuarioId || '') === id);
            const matchesEmail = Boolean(email && String(t.usuarioEmail || '').trim().toLowerCase() === email);
            if (matchesId || matchesEmail) {
                encontrados.set(t.id, Object.assign({}, encontrados.get(t.id) || {}, t));
            }
        });
        onData(Array.from(encontrados.values())
            .map(t => normalizarTicket(t))
            .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''))));
    };

    try {
        await ensureFirestore();
        if (typeof window.onSnapshot === 'function') {
            const attach = (key, q) => {
                unsubs.push(window.onSnapshot(q, snap => {
                    buckets.set(key, snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() })));
                    emit();
                }, err => {
                    console.warn('[SoporteJS] onSnapshot mis tickets:', err);
                    if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
                }));
            };
            if (ids.length) attach('ids', window.query(
                window.collection(window.db, SOPORTE_COLLECTION),
                window.where('usuarioId', 'in', ids)
            ));
            if (email) attach('email', window.query(
                window.collection(window.db, SOPORTE_COLLECTION),
                window.where('usuarioEmail', '==', email)
            ));
        }
    } catch (e) {
        console.warn('[SoporteJS] Suscripción de mis tickets no disponible.', e);
    }

    emit();
    const stopLocal = onLocalChange(emit);
    return () => {
        stopLocal();
        unsubs.forEach(unsubscribe => { try { unsubscribe(); } catch (e) { /* noop */ } });
    };
}

async function suscribirComentarios(ticketId, onData, onError) {
    let remote = [];
    let unsub = null;
    const emit = () => {
        if (typeof onData === 'function') onData(mergeComments(ticketId, remote));
    };

    try {
        await ensureFirestore();
        if (typeof window.onSnapshot === 'function') {
            const q = window.query(
                window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios'),
                window.orderBy('creadoEn', 'asc')
            );
            unsub = window.onSnapshot(q, snap => {
                remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                emit();
            }, err => {
                console.warn('[SoporteJS] onSnapshot comentarios:', err);
                if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
            });
        }
    } catch (e) {
        console.warn('[SoporteJS] Suscripción de comentarios no disponible.', e);
    }

    emit();
    const stopLocal = onLocalChange(emit);
    return () => {
        stopLocal();
        if (unsub) { try { unsub(); } catch (e) { /* noop */ } }
    };
}

// ============================================================
// EXPORTAR API PÚBLICA
// ============================================================
window.SoporteJS = {
    CATEGORIAS,
    PRIORIDADES,
    ESTADOS,
    waitForFirebase,
    ensureFirestore,
    crearTicket,
    getMisTickets,
    getTicketById,
    buscarPorCodigo,
    getTodosLosTickets,
    actualizarTicket,
    agregarComentario,
    getComentarios,
    suscribirTickets,
    suscribirTicket,
    suscribirMisTickets,
    suscribirComentarios,
    formatDate,
    normalizarEstado,
    normalizarTicket,
    traducirErrorFirestore,
    getCategoria,
    getPrioridad,
    getEstado,
    estadoBadge,
    prioridadBadge,
    isStaff,
    puedeVerTicket,
    cerrarTicket,
    reabrirTicket,
    tomarTicket,
    agregarMensajeSistema,
    renderTextoComentario,
    generateTicketCode,
    // Roles globales / insignias dinámicas
    ROLE_BADGE_DEFS,
    normalizarRol,
    obtenerRolBadge,
    refreshRoleBadgeDefs,
    rolBadgeHtml,
    resolverRolUsuario,
    resolverRolesComentarios,
    claveAutorComentario,
    limpiarCacheRoles,
    suscribirCambiosRoles
};

console.log('[SoporteJS] Motor de tickets de soporte inicializado');
