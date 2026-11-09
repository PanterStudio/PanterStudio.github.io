/**
 * roles.js — Jerarquía de roles, badges y configuración del guild
 * Panter Studio · Módulo compartido (sin dependencias)
 *
 * Los rangos web se asignan por correo (Director) o manualmente desde
 * Panel Admin → Personal (`equipo`). Ningún rol/permiso de Discord otorga
 * rangos ni acceso de administrador; Discord sólo valida la membresía.
 *
 * Expone window.PanterRoles
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'panterDiscordRoleConfig';
    const COLLECTION = 'discord_role_mappings';
    const DOC_ID = 'global';
    const ROLE_STORAGE_KEY = 'panterRoleConfig';
    const ROLE_COLLECTION = 'roles_config';
    const ROLE_DOC_ID = 'global';
    const ROLE_CONFIG_VERSION = 3;

    /* ─────────────────────────────────────────────────────────────
       Política de asignación automática por correo
       ─────────────────────────────────────────────────────────────
       Sólo el correo oficial del Director recibe un rango de forma
       automática. Cualquier otra cuenta nace como `usuario` y los
       rangos superiores se asignan manualmente desde el Panel Admin
       (sección Personal → colección `equipo`).
    */
    const DIRECTOR_EMAIL = 'oliverosgutierezjhonier@gmail.com';
    const DEFAULT_MEMBER_ROLE = 'usuario';

    /* ─────────────────────────────────────────────────────────────
       Jerarquía oficial (mayor rank = mayor prioridad)
       ───────────────────────────────────────────────────────────── */
    const ROLE_DEFS = {
        founder_ceo: {
            id: 'founder_ceo',
            label: 'Fundador / CEO',
            shortLabel: 'CEO',
            rank: 95,
            color: '#f1c40f',
            bg: 'rgba(241, 196, 15, 0.12)',
            border: 'rgba(241, 196, 15, 0.35)',
            icon: 'fa-solid fa-crown',
            description: 'Fundador y máxima autoridad del estudio.',
            aliases: ['founder', 'ceo', 'fundador', 'fundador_ceo', 'founder_ceo', 'propietario']
        },
        director: {
            id: 'director',
            label: 'Director',
            shortLabel: 'Director',
            rank: 90,
            color: '#ff0000',
            bg: 'rgba(255, 0, 0, 0.12)',
            border: 'rgba(255, 0, 0, 0.35)',
            icon: 'fa-solid fa-user-tie',
            description: 'Dirección de proyectos y supervisión general.',
            aliases: ['director', 'directora', 'project_director']
        },
        administrador: {
            id: 'administrador',
            label: 'Administrador',
            shortLabel: 'Admin',
            rank: 80,
            color: '#f1c40f',
            bg: 'rgba(241, 196, 15, 0.12)',
            border: 'rgba(241, 196, 15, 0.35)',
            icon: 'fa-solid fa-shield-halved',
            description: 'Gestión de la plataforma, contenido y comunidad.',
            aliases: ['admin', 'administrador', 'administrator', 'admin_general', 'owner_admin']
        },
        programador: {
            id: 'programador',
            label: 'Programador',
            shortLabel: 'Dev',
            rank: 60,
            color: '#ffbc00',
            bg: 'rgba(255, 188, 0, 0.12)',
            border: 'rgba(255, 188, 0, 0.35)',
            icon: 'fa-solid fa-code',
            description: 'Desarrollo técnico, web y sistemas del estudio.',
            aliases: ['programador', 'developer', 'dev', 'programmer', 'engineer', 'desarrollador']
        },
        modelador: {
            id: 'modelador',
            label: 'Modelador',
            shortLabel: '3D',
            rank: 55,
            color: '#6f5cff',
            bg: 'rgba(111, 92, 255, 0.12)',
            border: 'rgba(111, 92, 255, 0.35)',
            icon: 'fa-solid fa-cube',
            description: 'Modelado, arte técnico y assets del juego.',
            aliases: ['modelador', 'modeler', 'modeler_3d', 'artist']
        },
        moderador: {
            id: 'moderador',
            label: 'Moderador',
            shortLabel: 'Mod',
            rank: 70,
            color: '#e67e22',
            bg: 'rgba(230, 126, 34, 0.12)',
            border: 'rgba(230, 126, 34, 0.35)',
            icon: 'fa-solid fa-gavel',
            description: 'Moderación de la comunidad y cumplimiento de normas.',
            aliases: ['moderador', 'moderator', 'mod', 'moderacion']
        },
        soporte: {
            id: 'soporte',
            label: 'Soporte',
            shortLabel: 'Support',
            rank: 50,
            color: '#00a715',
            bg: 'rgba(0, 167, 21, 0.12)',
            border: 'rgba(0, 167, 21, 0.35)',
            icon: 'fa-solid fa-headset',
            description: 'Atención de tickets y ayuda a la comunidad.',
            aliases: ['soporte', 'support', 'support_ops', 'soporte_tecnico', 'agent', 'agente']
        },
        creador_contenido: {
            id: 'creador_contenido',
            label: 'Creador de Contenido',
            shortLabel: 'Creator',
            rank: 40,
            color: '#9d00ff',
            bg: 'rgba(157, 0, 255, 0.12)',
            border: 'rgba(157, 0, 255, 0.35)',
            icon: 'fa-solid fa-photo-film',
            description: 'Contenido, streamings, videos y difusión.',
            aliases: ['creador_contenido', 'content_creator', 'creator', 'creador', 'creador_de_contenido', 'streamer', 'youtuber', 'community_manager']
        },
        vip: {
            id: 'vip',
            label: 'VIP',
            shortLabel: 'VIP',
            rank: 30,
            color: '#ff7ddf',
            bg: 'rgba(255, 125, 223, 0.12)',
            border: 'rgba(255, 125, 223, 0.35)',
            icon: 'fa-solid fa-star',
            description: 'Miembro destacado de la comunidad.',
            aliases: ['vip', 'premium', 'supporter']
        },
        usuario: {
            id: 'usuario',
            label: 'Usuario',
            shortLabel: 'Member',
            rank: 10,
            color: '#0055ff',
            bg: 'rgba(0, 85, 255, 0.12)',
            border: 'rgba(0, 85, 255, 0.3)',
            icon: 'fa-solid fa-user',
            description: 'Miembro de la comunidad Panter Studio.',
            aliases: ['usuario', 'user', 'member', 'miembro', 'viewer', 'player', 'jugador']
        }
    };

    /* ─────────────────────────────────────────────────────────────
       Paleta oficial inmutable para los roles base
       ───────────────────────────────────────────────────────────── */
    const OFFICIAL_ROLE_COLORS = Object.freeze({
        founder_ceo:       '#f1c40f',
        director:          '#ff0000',
        administrador:     '#f1c40f',
        programador:       '#ffbc00',
        modelador:         '#6f5cff',
        moderador:         '#e67e22',
        soporte:           '#00a715',
        creador_contenido: '#9d00ff',
        vip:               '#ff7ddf',
        usuario:           '#0055ff'
    });

    Object.keys(OFFICIAL_ROLE_COLORS).forEach(id => {
        const def = ROLE_DEFS[id];
        if (!def) return;
        def.color = OFFICIAL_ROLE_COLORS[id];
        def.bg = hexToRgba(def.color, 0.12);
        def.border = hexToRgba(def.color, 0.35);
    });

    const ROLE_ORDER = Object.values(ROLE_DEFS)
        .sort((a, b) => b.rank - a.rank)
        .map(r => r.id);

    /**
     * Jerarquía oficial del equipo (de mayor a menor).
     * Se usa para seccionar Personal aunque una configuración antigua
     * conserve rangos distintos en Firestore.
     */
    const ROLE_HIERARCHY = [
        'founder_ceo',
        'director',
        'administrador',
        'moderador',
        'programador',
        'modelador',
        'soporte',
        'creador_contenido',
        'vip',
        'usuario'
    ];

    // Valores heredados de versiones anteriores. El rango ADMIN / OWNER ya
    // no existe: cualquier registro antiguo se normaliza a Fundador / CEO.
    const LEGACY_ALIASES = {
        admin_owner: 'founder_ceo',
        administrator_owner: 'founder_ceo',
        owner: 'founder_ceo'
    };

    function addLegacyAliases(map) {
        Object.keys(LEGACY_ALIASES).forEach(key => {
            map[aliasKey(key)] = LEGACY_ALIASES[key];
        });
        return map;
    }

    const ALIAS_TO_ROLE = addLegacyAliases((function buildAliases() {
        const map = {};
        Object.values(ROLE_DEFS).forEach(def => {
            map[aliasKey(def.id)] = def.id;
            map[aliasKey(def.label)] = def.id;
            (def.aliases || []).forEach(a => { map[aliasKey(a)] = def.id; });
        });
        return map;
    })());

    /* ─────────────────────────────────────────────────────────────
       Configuración dinámica de roles y colores
       ───────────────────────────────────────────────────────────── */

    // Copia inmutable de fábrica (para poder restaurar al recargar).
    const BASE_ROLE_DEFS = JSON.parse(JSON.stringify(ROLE_DEFS));
    const BASE_ROLE_IDS = new Set(Object.keys(BASE_ROLE_DEFS));

    const DEFAULT_ROLE_PERMISSIONS = {
        founder_ceo:       { team: true,  ticketStaff: true,  adminPanel: true,  manageTeam: true  },
        director:          { team: true,  ticketStaff: true,  adminPanel: true,  manageTeam: true  },
        administrador:     { team: true,  ticketStaff: true,  adminPanel: true,  manageTeam: true  },
        programador:       { team: true,  ticketStaff: true,  adminPanel: true,  manageTeam: false },
        modelador:         { team: true,  ticketStaff: false, adminPanel: true,  manageTeam: false },
        moderador:         { team: true,  ticketStaff: true,  adminPanel: false, manageTeam: false },
        soporte:           { team: true,  ticketStaff: true,  adminPanel: false, manageTeam: false },
        creador_contenido: { team: true,  ticketStaff: false, adminPanel: false, manageTeam: false },
        vip:               { team: false, ticketStaff: false, adminPanel: false, manageTeam: false },
        usuario:           { team: false, ticketStaff: false, adminPanel: false, manageTeam: false }
    };

    const EMPTY_PERMISSIONS = { team: false, ticketStaff: false, adminPanel: false, manageTeam: false };
    let cachedRoleConfig = null;
    let roleConfigLoaded = false;

    function roleSlug(value) {
        return String(value == null ? '' : value)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40);
    }

    function normalizeHexColor(value) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        if (/^#[0-9a-f]{3}$/i.test(raw)) {
            return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
        }
        if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
        if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
        return '';
    }

    function hexToRgba(hex, alpha) {
        const clean = normalizeHexColor(hex).replace('#', '');
        if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function cloneRoleDef(def) {
        return JSON.parse(JSON.stringify(def || {}));
    }

    function rolePermissions(roleOrDef) {
        const def = roleOrDef && typeof roleOrDef === 'object'
            ? roleOrDef
            : ROLE_DEFS[normalize(roleOrDef)];
        if (!def) return Object.assign({}, EMPTY_PERMISSIONS);
        const base = DEFAULT_ROLE_PERMISSIONS[def.id] || EMPTY_PERMISSIONS;
        return Object.assign({}, EMPTY_PERMISSIONS, base, def.permissions || {});
    }

    function recomputeRoleIndex() {
        ROLE_ORDER.length = 0;
        Object.values(ROLE_DEFS)
            .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0))
            .forEach(def => ROLE_ORDER.push(def.id));

        Object.keys(ALIAS_TO_ROLE).forEach(key => { delete ALIAS_TO_ROLE[key]; });
        Object.values(ROLE_DEFS).forEach(def => {
            ALIAS_TO_ROLE[aliasKey(def.id)] = def.id;
            ALIAS_TO_ROLE[aliasKey(def.label)] = def.id;
            ALIAS_TO_ROLE[aliasKey(def.shortLabel)] = def.id;
            (def.aliases || []).forEach(alias => {
                if (alias) ALIAS_TO_ROLE[aliasKey(alias)] = def.id;
            });
        });
        addLegacyAliases(ALIAS_TO_ROLE);

        refreshPermissionSets();
    }

    function sanitizeRoleDefinition(raw, fallbackId) {
        const source = raw && typeof raw === 'object' ? raw : {};
        let id = roleSlug(source.id || fallbackId || source.label);
        // Un documento de configuración antiguo no puede resurrectar el rango
        // ADMIN / OWNER: se normaliza al rango superior vigente.
        if (LEGACY_ALIASES[id]) id = LEGACY_ALIASES[id];
        if (!id) return null;
        const base = BASE_ROLE_DEFS[id] || {};
        const color = OFFICIAL_ROLE_COLORS[id]
            || normalizeHexColor(source.color)
            || normalizeHexColor(base.color)
            || '#94a3b8';
        const rankValue = Number(source.rank);
        const rank = BASE_ROLE_IDS.has(id)
            ? Number(base.rank || 20)
            : (Number.isFinite(rankValue) ? Math.max(0, Math.min(1000, Math.trunc(rankValue))) : Number(base.rank || 20));
        return {
            id,
            label: String(source.label || base.label || id).trim().slice(0, 48) || id,
            shortLabel: String(source.shortLabel || base.shortLabel || source.label || id).trim().slice(0, 24) || id,
            rank,
            color,
            bg: hexToRgba(color, 0.12),
            border: hexToRgba(color, 0.35),
            icon: String(source.icon || base.icon || 'fa-solid fa-user').trim().slice(0, 80),
            description: String(source.description || base.description || '').trim().slice(0, 240),
            aliases: Array.from(new Set([]
                .concat(base.aliases || [])
                .concat(Array.isArray(source.aliases) ? source.aliases : [])
                .map(alias => String(alias || '').trim().toLowerCase())
                .filter(Boolean))),
            permissions: Object.assign({}, EMPTY_PERMISSIONS,
                DEFAULT_ROLE_PERMISSIONS[id] || {},
                source.permissions && typeof source.permissions === 'object' ? source.permissions : {}),
            custom: !BASE_ROLE_IDS.has(id),
            updatedAt: String(source.updatedAt || '')
        };
    }

    function defaultRoleConfig() {
        return {
            version: ROLE_CONFIG_VERSION,
            updatedAt: '',
            updatedBy: '',
            roles: Object.values(BASE_ROLE_DEFS)
                .sort((a, b) => b.rank - a.rank)
                .map(def => sanitizeRoleDefinition(def))
                .filter(Boolean)
        };
    }

    /**
     * Migra configuraciones antiguas para que los roles base respeten la
     * jerarquía oficial actual sin perder colores, iconos ni roles custom.
     */
    function migrateRoleConfig(config) {
        const source = config && typeof config === 'object' ? config : {};
        if (Number(source.version || 0) >= ROLE_CONFIG_VERSION) return source;

        return Object.assign({}, source, {
            version: ROLE_CONFIG_VERSION,
            roles: (Array.isArray(source.roles) ? source.roles : []).map(raw => {
                const id = roleSlug(raw && raw.id);
                const base = BASE_ROLE_DEFS[id];
                return base ? Object.assign({}, raw, { rank: base.rank }) : raw;
            })
        });
    }

    /**
     * Aplica una configuración de roles sobre la jerarquía activa.
     * Las definiciones ausentes vuelven a los valores de fábrica.
     */
    function applyRoleConfig(config) {
        const source = config && typeof config === 'object' ? config : {};
        const roles = Array.isArray(source.roles) ? source.roles : [];

        // Restaurar fábrica y limpiar roles personalizados previos.
        BASE_ROLE_IDS.forEach(id => { ROLE_DEFS[id] = cloneRoleDef(BASE_ROLE_DEFS[id]); });
        Object.keys(ROLE_DEFS).forEach(id => {
            if (!BASE_ROLE_IDS.has(id)) delete ROLE_DEFS[id];
        });

        roles.forEach(raw => {
            const def = sanitizeRoleDefinition(raw, raw && raw.id);
            if (!def) return;
            ROLE_DEFS[def.id] = def;
        });

        recomputeRoleIndex();

        cachedRoleConfig = {
            version: Number(source.version || ROLE_CONFIG_VERSION),
            updatedAt: String(source.updatedAt || ''),
            updatedBy: String(source.updatedBy || ''),
            roles: Object.values(ROLE_DEFS)
                .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0))
                .map(cloneRoleDef)
        };

        try {
            global.dispatchEvent(new CustomEvent('panter:roles-config', { detail: cachedRoleConfig }));
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('panter:roles-config', { detail: cachedRoleConfig }));
            }
        } catch (e) { /* ignore */ }

        return cachedRoleConfig;
    }

    function getRoleConfig() {
        if (!cachedRoleConfig) applyRoleConfig(defaultRoleConfig());
        return cachedRoleConfig;
    }

    function readStoredRoleConfig() {
        try {
            const raw = global.localStorage.getItem(ROLE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function loadRoleConfig(force) {
        if (!force && roleConfigLoaded) return cachedRoleConfig;

        let config = readStoredRoleConfig();
        if (global.db && global.fsDoc && global.getDoc) {
            try {
                const snap = await global.getDoc(global.fsDoc(global.db, ROLE_COLLECTION, ROLE_DOC_ID));
                if (snap && snap.exists()) config = snap.data() || config;
            } catch (e) {
                console.warn('[PanterRoles] No se pudo cargar roles_config:', e && e.message ? e.message : e);
            }
        }

        roleConfigLoaded = true;
        return applyRoleConfig(migrateRoleConfig(config || defaultRoleConfig()));
    }

    async function saveRoleConfig(config) {
        const incoming = Array.isArray(config) ? { roles: config } : (config || {});
        const applied = applyRoleConfig({
            version: ROLE_CONFIG_VERSION,
            roles: Array.isArray(incoming.roles) ? incoming.roles : getRoleConfig().roles,
            updatedAt: new Date().toISOString(),
            updatedBy: incoming.updatedBy || ''
        });
        roleConfigLoaded = true;

        try {
            global.localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(applied));
        } catch (e) { /* storage no disponible */ }

        if (global.db && global.fsDoc && global.setDoc) {
            await global.setDoc(
                global.fsDoc(global.db, ROLE_COLLECTION, ROLE_DOC_ID),
                Object.assign({}, applied, { version: ROLE_CONFIG_VERSION }),
                { merge: true }
            );
        }

        return applied;
    }

    let roleConfigUnsubscribe = null;
    let discordConfigUnsubscribe = null;

    function startRealtimeConfigSync() {
        if (!global.db || !global.fsDoc || !global.onSnapshot) return false;
        if (!roleConfigUnsubscribe) {
            roleConfigUnsubscribe = global.onSnapshot(
                global.fsDoc(global.db, ROLE_COLLECTION, ROLE_DOC_ID),
                snap => {
                    const config = snap.exists() ? snap.data() : defaultRoleConfig();
                    const applied = applyRoleConfig(migrateRoleConfig(config));
                    roleConfigLoaded = true;
                    try {
                        global.localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(applied));
                    } catch (error) {
                        console.warn('[PanterRoles] No se pudo guardar la configuración local:', error);
                    }
                },
                error => console.error('[PanterRoles] Error observando configuración de roles:', error)
            );
        }
        if (!discordConfigUnsubscribe) {
            discordConfigUnsubscribe = global.onSnapshot(
                global.fsDoc(global.db, COLLECTION, DOC_ID),
                snap => {
                    setDiscordConfig(snap.exists() ? snap.data() : defaultConfig(), false);
                },
                error => console.error('[PanterRoles] Error observando la configuración del guild:', error)
            );
        }
        return true;
    }

    // Sets derivados de los permisos. Se recalculan al aplicar la configuración.
    const TICKET_STAFF_ROLES = new Set();
    const ADMIN_PANEL_ROLES = new Set();
    const TEAM_ROLES = new Set();
    const MANAGE_TEAM_ROLES = new Set();

    function rolesWithPermission(permission) {
        const key = String(permission || '').trim();
        return Object.values(ROLE_DEFS)
            .filter(def => rolePermissions(def)[key] === true)
            .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0))
            .map(def => def.id);
    }

    function refreshPermissionSets() {
        TICKET_STAFF_ROLES.clear();
        ADMIN_PANEL_ROLES.clear();
        TEAM_ROLES.clear();
        MANAGE_TEAM_ROLES.clear();
        Object.values(ROLE_DEFS).forEach(def => {
            const perms = rolePermissions(def);
            if (perms.ticketStaff === true) TICKET_STAFF_ROLES.add(def.id);
            if (perms.adminPanel === true) ADMIN_PANEL_ROLES.add(def.id);
            if (perms.team === true) TEAM_ROLES.add(def.id);
            if (perms.manageTeam === true) MANAGE_TEAM_ROLES.add(def.id);
        });
    }

    /* ─────────────────────────────────────────────────────────────
       Helpers
       ───────────────────────────────────────────────────────────── */
    function aliasKey(value) {
        return String(value == null ? '' : value)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[_\s-]+/g, '_');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalize(role) {
        if (!role) return 'usuario';
        if (typeof role === 'object') return resolveRole(role);
        const key = aliasKey(role);
        return ALIAS_TO_ROLE[key] || 'usuario';
    }

    function get(roleOrUser) {
        const id = typeof roleOrUser === 'object'
            ? resolveRole(roleOrUser)
            : normalize(roleOrUser);
        return ROLE_DEFS[id] || ROLE_DEFS.usuario;
    }

    /**
     * Devuelve los ids de rol en orden jerárquico oficial.
     * Si se pasa una lista, sólo se incluyen esos roles (normalizados).
     * Los roles personalizados se añaden al final ordenados por prioridad.
     */
    function orderedRoleIds(roleIds) {
        const filter = Array.isArray(roleIds)
            ? new Set(roleIds.map(id => normalize(id)))
            : null;

        const out = [];
        ROLE_HIERARCHY.forEach(id => {
            if (!ROLE_DEFS[id]) return;
            if (filter && !filter.has(id)) return;
            out.push(id);
        });

        Object.values(ROLE_DEFS)
            .filter(def => !ROLE_HIERARCHY.includes(def.id))
            .filter(def => !filter || filter.has(def.id))
            .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0))
            .forEach(def => out.push(def.id));

        return out;
    }

    function rank(role) {
        return get(role).rank;
    }

    function isStaff(role) {
        return isTicketStaff(role);
    }

    function isTicketStaff(role) {
        return rolePermissions(normalize(role)).ticketStaff === true;
    }

    function isTeamRole(role) {
        return rolePermissions(normalize(role)).team === true;
    }

    function canAccessAdminPanel(role) {
        return rolePermissions(normalize(role)).adminPanel === true;
    }

    function canManageTeam(role) {
        return rolePermissions(normalize(role)).manageTeam === true;
    }

    /**
     * Compatibilidad con roles heredados. `director` se conserva para que
     * `conductores.role` y la sesión reflejen exactamente el rango mostrado.
     */
    function toLegacyRole(role) {
        return normalize(role);
    }

    /**
     * @deprecated La detección automática de administradores por permisos,
     * IDs o roles de Discord quedó deshabilitada. Los permisos se derivan
     * únicamente del rango asignado manualmente en Personal (`equipo`) o
     * del correo oficial del Director.
     */
    function isDiscordAdmin() {
        return false;
    }

    function normalizeEmail(value) {
        return String(value == null ? '' : value).trim().toLowerCase();
    }

    /**
     * Rango automático según el correo. Sólo el correo del Director recibe
     * un rango; cualquier otra cuenta es `usuario` por defecto.
     */
    function roleForEmail(email) {
        return normalizeEmail(email) === DIRECTOR_EMAIL ? 'director' : DEFAULT_MEMBER_ROLE;
    }

    /**
     * Resuelve el rango efectivo de una cuenta:
     *   1. Correo oficial del Director → `director`.
     *   2. Rango asignado manualmente en el Panel Admin → Personal (`equipo`).
     *   3. Cualquier otra cuenta → `usuario`.
     *
     * Ya NO se leen roles/permisos de Discord ni `conductores.role`, para
     * evitar que sesiones antiguas conserven un ADMIN/OWNER automático.
     */
    function resolveRole(user, profile) {
        if (!user && !profile) return DEFAULT_MEMBER_ROLE;

        // 1) Correo oficial del Director: siempre `director`.
        const email = normalizeEmail(
            (profile && (profile.email || profile.correo)) ||
            (user && (user.email || user.correo))
        );
        if (email === DIRECTOR_EMAIL) return 'director';

        // 2) Rango manual desde la sección Personal del panel (equipo.role).
        const teamRoleRaw = profile && (profile.teamRole || profile.equipoRole || profile.team_role);
        if (teamRoleRaw) {
            const teamRole = normalize(teamRoleRaw);
            if (teamRole) return teamRole;
        }

        // 3) Cualquier otra cuenta: Usuario.
        return DEFAULT_MEMBER_ROLE;
    }

    /* ─────────────────────────────────────────────────────────────
       Badges HTML
       ───────────────────────────────────────────────────────────── */
    function badgeHtml(roleOrUser, options) {
        const opts = options || {};
        const def = get(roleOrUser);
        if (!def) return '';
        const label = opts.label || def.label;
        const cls = [
            'ps-role-badge',
            `ps-role-${def.id}`,
            opts.className || ''
        ].filter(Boolean).join(' ');
        const iconOnly = Boolean(opts.iconOnly);
        const title = opts.title || `${def.label} · Rango ${def.rank}`;
        const icon = `<i class="${def.icon}" aria-hidden="true"></i>`;
        const text = iconOnly ? '' : `<span class="ps-role-badge-text">${escapeHtml(label)}</span>`;
        return `<span class="${cls}" data-role="${def.id}" title="${escapeHtml(title)}" style="--ps-role-color:${def.color};--ps-role-bg:${def.bg};--ps-role-border:${def.border};">${icon}${text}</span>`;
    }

    function renderBadge(container, roleOrUser, options) {
        if (!container) return null;
        container.innerHTML = badgeHtml(roleOrUser, options);
        container.hidden = false;
        return container.firstElementChild;
    }

    /* ─────────────────────────────────────────────────────────────
       Servidor oficial de Discord (Firestore: discord_role_mappings/global)
       Sólo se usa para validar la pertenencia al guild. Ningún rol, ID o
       permiso de Discord asigna rangos web ni acceso de administrador.
       ───────────────────────────────────────────────────────────── */
    function defaultConfig() {
        return {
            guildId: '1391998991108935772',
            guildName: 'Panter Studio Game Dev'
        };
    }

    let cachedConfig = null;

    function readStoredConfig() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getDiscordConfig() {
        if (cachedConfig) return cachedConfig;
        const base = defaultConfig();
        const stored = readStoredConfig();
        cachedConfig = mergeConfig(base, stored || {});
        return cachedConfig;
    }

    function mergeConfig(base, patch) {
        // Se ignoran deliberadamente `roles` y `adminRoleIds` de documentos
        // antiguos: el mapeo Discord → rangos web quedó eliminado.
        return {
            guildId: String((patch && patch.guildId) || base.guildId || ''),
            guildName: String((patch && patch.guildName) || base.guildName || 'Panter Studio')
        };
    }

    function setDiscordConfig(config, persist) {
        cachedConfig = mergeConfig(defaultConfig(), config || {});
        if (persist !== false) {
            try {
                global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedConfig));
            } catch (e) { /* storage no disponible */ }
        }
        try {
            global.dispatchEvent(new CustomEvent('panter:discord-config', { detail: cachedConfig }));
            document.dispatchEvent(new CustomEvent('panter:discord-config', { detail: cachedConfig }));
        } catch (e) { /* ignore */ }
        return cachedConfig;
    }

    async function loadDiscordConfig(force) {
        if (!force && cachedConfig) return cachedConfig;
        const cfg = getDiscordConfig();
        if (!global.db || !global.fsDoc || !global.getDoc) return cfg;
        try {
            const snap = await global.getDoc(global.fsDoc(global.db, COLLECTION, DOC_ID));
            if (snap && snap.exists()) {
                return setDiscordConfig(Object.assign({}, cfg, snap.data() || {}));
            }
        } catch (e) {
            console.warn('[PanterRoles] No se pudo cargar la configuración del guild:', e);
        }
        return cfg;
    }

    async function saveDiscordConfig(config) {
        const merged = setDiscordConfig(config);
        if (global.db && global.fsDoc && global.setDoc) {
            // Sin `merge`: así se limpian de una vez los campos heredados
            // (`roles`, `adminRoleIds`) del mapeo Discord → rangos eliminado.
            await global.setDoc(
                global.fsDoc(global.db, COLLECTION, DOC_ID),
                Object.assign({}, merged, { updatedAt: new Date().toISOString() })
            );
        }
        return merged;
    }

    /* ─────────────────────────────────────────────────────────────
       API pública
       ───────────────────────────────────────────────────────────── */
    const api = {
        ROLE_DEFS,
        ROLE_COLORS: OFFICIAL_ROLE_COLORS,
        ROLE_ORDER,
        ROLE_HIERARCHY,
        orderedRoleIds,
        TICKET_STAFF_ROLES,
        ADMIN_PANEL_ROLES,
        TEAM_ROLES,
        MANAGE_TEAM_ROLES,
        normalize,
        get,
        rank,
        isStaff,
        isTicketStaff,
        isTeamRole,
        canAccessAdminPanel,
        canManageTeam,
        toLegacyRole,
        resolveRole,
        roleForEmail,
        normalizeEmail,
        DIRECTOR_EMAIL,
        DEFAULT_MEMBER_ROLE,
        isDiscordAdmin,
        hasAdminPermission: isDiscordAdmin,
        rolePermissions,
        rolesWithPermission,
        badgeHtml,
        renderBadge,
        escapeHtml,
        getDiscordConfig,
        setDiscordConfig,
        loadDiscordConfig,
        saveDiscordConfig,
        // Configuración dinámica de roles y colores
        ROLE_STORAGE_KEY,
        ROLE_COLLECTION,
        ROLE_DOC_ID,
        ROLE_CONFIG_VERSION,
        BASE_ROLE_DEFS,
        OFFICIAL_ROLE_COLORS,
        DEFAULT_ROLE_PERMISSIONS,
        roleSlug,
        normalizeHexColor,
        hexToRgba,
        sanitizeRoleDefinition,
        migrateRoleConfig,
        defaultRoleConfig,
        applyRoleConfig,
        getRoleConfig,
        loadRoleConfig,
        saveRoleConfig,
        startRealtimeConfigSync
    };

    global.PanterRoles = api;

    // Carga perezosa del mapeo guardado en Firestore.
    if (typeof document !== 'undefined') {
        const boot = () => {
            loadDiscordConfig().catch(() => {});
            loadRoleConfig().catch(() => {});
            if (!startRealtimeConfigSync()) {
                document.addEventListener('firebaseReady', () => {
                    loadDiscordConfig(true).catch(() => {});
                    loadRoleConfig(true).catch(() => {});
                    startRealtimeConfigSync();
                }, { once: true });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot, { once: true });
        } else {
            setTimeout(boot, 0);
        }
    }
})(typeof window !== 'undefined' ? window : this);
