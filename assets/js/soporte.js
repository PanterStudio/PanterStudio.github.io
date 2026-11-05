/**
 * soporte.js — Motor de Sistema de Tickets para panterstudio.lat
 * Usa Firebase Firestore como backend + Discord Webhook para notificaciones
 */

// ============================================================
// CONFIGURACIÓN
// ============================================================
const SOPORTE_COLLECTION = 'soporte_tickets';
const COMENTARIOS_COLLECTION = 'soporte_comentarios';

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

const STAFF_ROLES = new Set(['admin_owner', 'founder_ceo', 'director', 'administrador', 'support_ops', 'soporte', 'moderador', 'programador']);


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
    admin_owner:       { label: 'Admin / Owner',        color: '#f1c40f', icon: 'fa-solid fa-crown' },
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

function normalizarRol(valor) {
    if (window.PanterRoles && typeof window.PanterRoles.normalize === 'function') {
        return window.PanterRoles.normalize(valor);
    }
    const clave = String(valor || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\s-]+/g, '_');
    const mapa = {
        admin_owner: 'admin_owner', owner: 'admin_owner',
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

async function cargarEquipoRoles() {
    const ahora = Date.now();
    if (equipoRolesPromise && (ahora - equipoRolesAt) < EQUIPO_ROLES_TTL) return equipoRolesPromise;
    equipoRolesAt = ahora;
    if (!window.db || !window.collection || !window.getDocs) {
        equipoRolesPromise = Promise.resolve([]);
        return equipoRolesPromise;
    }
    equipoRolesPromise = window.getDocs(window.collection(window.db, 'equipo'))
        .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
        .catch(err => {
            console.warn('[SoporteJS] No se pudo leer la colección equipo:', err?.message || err);
            return [];
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
 * Resuelve el rol global de un autor de comentario.
 * Prioridad: `equipo` (rango asignado manualmente en Panel Admin → Personal)
 * → correo oficial del Director → `usuario`.
 *
 * `conductores.role` y los datos de Discord ya NO otorgan rango.
 */
async function resolverRolUsuario(autorId, autorNombre, esStaff, autorRol, autorEmail) {
    const clave = String(autorId || autorNombre || autorEmail || 'anonimo').trim();
    const cache = rolesUsuarioCache.get(clave);
    if (cache && (Date.now() - cache.at) < ROLES_USUARIO_TTL) return cache.role;

    const ids = clavesUsuario(autorId);
    let rol = null;
    let definitivo = false;
    let email = String(autorEmail || '').trim().toLowerCase();

    try {
        const equipo = await cargarEquipoRoles();
        const miembro = buscarMiembroEquipo(equipo, ids, autorNombre, email);
        if (miembro) {
            rol = extraerRolDocumento(miembro);
            if (!email && miembro.email) email = String(miembro.email).trim().toLowerCase();
            if (rol) definitivo = true;
        }
    } catch (e) { /* lectura opcional */ }

    // Política por correo: sólo el Director recibe rango automático.
    if (!rol && email && window.PanterRoles && typeof window.PanterRoles.roleForEmail === 'function') {
        rol = window.PanterRoles.roleForEmail(email);
        definitivo = true;
    }

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
        const rol = await resolverRolUsuario(c.autorId, c.autor, Boolean(c.esStaff), c.autorRol, c.autorEmail);
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

async function suscribirCambiosRoles(comentarios, onChange, onError) {
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
        if (active && typeof onChange === 'function') onChange();
    };

    equipoUnsub = window.onSnapshot(
        window.collection(window.db, 'equipo'),
        snap => {
            equipoActual = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            notificarCambio();
        },
        error => {
            console.error('[SoporteJS] Error observando roles del equipo:', error);
            if (typeof onError === 'function') onError(error);
        }
    );
    // Un cambio de color/etiqueta en el Gestor de Roles repinta los badges.
    document.addEventListener('panter:roles-config', notificarCambio);
    // La suscripción a `equipo` es global: cualquier cambio de rango repinta.
    const updateAuthors = () => {};

    const unsubscribe = () => {
        active = false;
        if (equipoUnsub) equipoUnsub();
        equipoUnsub = null;
        document.removeEventListener('panter:roles-config', notificarCambio);
    };
    unsubscribe.update = updateAuthors;
    return unsubscribe;
}

if (typeof document !== 'undefined') {
    document.addEventListener('panter:roles-config', limpiarCacheRoles);
}

async function cerrarTicket(ticketId, staffName) {
    await actualizarTicket(ticketId, {
        estado: 'Cerrado',
        cerradoPor: staffName || 'Staff',
        cerradoEn: new Date().toISOString()
    });
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
        console.error('[SoporteJS] Error creando ticket en Firestore:', err);
        
        // If Firestore write fails (e.g., permission denied), 
        // still send the webhook so the ticket reaches Discord
        const fallbackTicket = { id: 'local-' + Date.now(), ...docData };
        
        enviarNotificacionDiscordWebhook(fallbackTicket).catch(e => {
            console.warn('[SoporteJS] Error enviando webhook fallback:', e);
        });

        // Re-throw with a better error message
        if (String(err?.code || '').includes('permission-denied') || String(err?.message || '').includes('permission')) {
            throw new Error('Permiso denegado por Firestore. El ticket fue enviado a Discord como notificación, pero no se guardó en la base de datos. Contacta al administrador para verificar las reglas de seguridad.');
        }
        throw err;
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

    return Array.from(encontrados.values())
        .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
}

async function getTicketById(ticketId) {
    await ensureFirestore();

    const snap = await window.getDoc(window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId));
    return snap.exists() ? normalizarTicket({ id: snap.id, ...snap.data() }) : null;
}

async function buscarPorCodigo(codigo) {
    await ensureFirestore();

    const q = window.query(
        window.collection(window.db, SOPORTE_COLLECTION),
        window.where('codigo', '==', codigo.toUpperCase().trim())
    );
    const snap = await window.getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return normalizarTicket({ id: d.id, ...d.data() });
}

async function getTodosLosTickets() {
    await ensureFirestore();

    const q = window.query(
        window.collection(window.db, SOPORTE_COLLECTION),
        window.orderBy('creadoEn', 'desc')
    );
    const snap = await window.getDocs(q);
    return snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() }));
}

/**
 * Actualiza un ticket en Firestore.
 * Escribe `estado` y `status` en paralelo (compatibilidad con tickets
 * antiguos) y `actualizadoEn` + `updatedAt`. Lanza un Error con un
 * mensaje legible si Firestore rechaza la escritura.
 */
async function actualizarTicket(ticketId, updates = {}) {
    await ensureFirestore();

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

    try {
        await window.setDoc(
            window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
            payload,
            { merge: true }
        );
    } catch (err) {
        console.error('[SoporteJS] Error actualizando ticket:', err);
        throw new Error(traducirErrorFirestore(err));
    }

    return { id: ticketId, ...payload };
}

async function agregarComentario(ticketId, texto, autor, autorId, esStaff = false, autorRol = null, autorEmail = null) {
    await ensureFirestore();

    const now = new Date().toISOString();
    const comentarioRef = window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios');
    const comentario = {
        texto,
        autor,
        autorId,
        esStaff: Boolean(esStaff),
        creadoEn: now
    };
    if (autorRol) comentario.autorRol = normalizarRol(autorRol);
    if (autorEmail) comentario.autorEmail = String(autorEmail).trim().toLowerCase();

    try {
        await window.addDoc(comentarioRef, comentario);
    } catch (err) {
        console.error('[SoporteJS] Error agregando comentario:', err);
        throw new Error(traducirErrorFirestore(err));
    }

    // El contador es informativo: si falla, el comentario ya quedó guardado.
    try {
        let contador = null;
        if (window.increment) {
            contador = window.increment(1);
        } else {
            const snap = await window.getDoc(window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId));
            contador = Number(snap.data()?.comentariosCount || 0) + 1;
        }

        await window.setDoc(
            window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
            {
                actualizadoEn: now,
                comentariosCount: contador
            },
            { merge: true }
        );
    } catch (counterErr) {
        console.warn('[SoporteJS] El comentario se guardó, pero no se pudo actualizar el contador:', counterErr);
    }
}

async function getComentarios(ticketId) {
    await ensureFirestore();

    const q = window.query(
        window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios'),
        window.orderBy('creadoEn', 'asc')
    );
    const snap = await window.getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================================
// SUSCRIPCIONES EN TIEMPO REAL (onSnapshot)
// ============================================================

async function suscribirTickets(onData, onError) {
    await ensureFirestore();
    if (!window.onSnapshot) throw new Error('Firestore no expone onSnapshot.');

    const q = window.query(
        window.collection(window.db, SOPORTE_COLLECTION),
        window.orderBy('creadoEn', 'desc')
    );
    return window.onSnapshot(q, snap => {
        if (typeof onData === 'function') {
            onData(snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() })));
        }
    }, err => {
        console.error('[SoporteJS] onSnapshot tickets:', err);
        if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
    });
}

async function suscribirTicket(ticketId, onData, onError) {
    await ensureFirestore();
    if (!window.onSnapshot) throw new Error('Firestore no expone onSnapshot.');

    return window.onSnapshot(
        window.fsDoc(window.db, SOPORTE_COLLECTION, ticketId),
        snap => {
            if (typeof onData === 'function') {
                onData(snap.exists() ? normalizarTicket({ id: snap.id, ...snap.data() }) : null);
            }
        },
        err => {
            console.error('[SoporteJS] onSnapshot ticket:', err);
            if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
        }
    );
}

async function suscribirMisTickets(userId, userEmail, onData, onError) {
    await ensureFirestore();
    if (!window.onSnapshot) throw new Error('Firestore no expone onSnapshot.');

    const ids = variantesUsuario(userId);
    const email = String(userEmail || '').trim().toLowerCase();
    const buckets = new Map();
    const unsubs = [];

    const emit = () => {
        if (typeof onData !== 'function') return;
        const encontrados = new Map();
        buckets.forEach(list => list.forEach(t => encontrados.set(t.id, t)));
        onData(Array.from(encontrados.values())
            .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''))));
    };

    const attach = (key, q) => {
        unsubs.push(window.onSnapshot(q, snap => {
            buckets.set(key, snap.docs.map(d => normalizarTicket({ id: d.id, ...d.data() })));
            emit();
        }, err => {
            console.error('[SoporteJS] onSnapshot mis tickets:', err);
            if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
        }));
    };

    // Consultas acotadas al usuario (no se lee la colección completa).
    if (ids.length) {
        attach('ids', window.query(
            window.collection(window.db, SOPORTE_COLLECTION),
            window.where('usuarioId', 'in', ids)
        ));
    }
    if (email) {
        attach('email', window.query(
            window.collection(window.db, SOPORTE_COLLECTION),
            window.where('usuarioEmail', '==', email)
        ));
    }

    if (!unsubs.length) {
        if (typeof onData === 'function') onData([]);
    }

    return () => {
        unsubs.forEach(unsubscribe => {
            try { unsubscribe(); } catch (e) { /* noop */ }
        });
    };
}

async function suscribirComentarios(ticketId, onData, onError) {
    await ensureFirestore();
    if (!window.onSnapshot) throw new Error('Firestore no expone onSnapshot.');

    const q = window.query(
        window.collection(window.db, SOPORTE_COLLECTION, ticketId, 'comentarios'),
        window.orderBy('creadoEn', 'asc')
    );
    return window.onSnapshot(q, snap => {
        if (typeof onData === 'function') {
            onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
    }, err => {
        console.error('[SoporteJS] onSnapshot comentarios:', err);
        if (typeof onError === 'function') onError(new Error(traducirErrorFirestore(err)));
    });
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
