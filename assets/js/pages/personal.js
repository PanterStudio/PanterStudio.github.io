/**
 * personal.js — Árbol organizacional de Panter Studio
 *
 * · Cúspide: PanterGameY (Fundador / CEO) junto al Director (Fénix).
 * · Debajo, TODAS las personas con rango asignado, agrupadas por rango
 *   en orden jerárquico oficial.
 * · Fuentes conectadas: `equipo` (Firestore), `ps_staff_local` (copia
 *   local del Panel Admin cuando Firestore no acepta la escritura) y
 *   `conductores` (sólo para enriquecer avatar/nombre).
 * · Deduplicación por uid, correo y nombre sin acentos (evita "Fenix"
 *   y "Fénix" por duplicado).
 * · Sincronización en vivo con onSnapshot + evento `storage` para
 *   reflejar al instante lo que se guarda desde el panel en otra pestaña.
 */
(function () {
    'use strict';

    const DIRECTOR_EMAIL = 'oliverosgutierezjhonier@gmail.com';
    const LOCAL_KEY = 'ps_staff_local';
    const HIDDEN_KEY = 'ps_staff_hidden';

    const FOUNDER = {
        uid: 'founder_pantergamey',
        nombre: 'PanterGameY',
        email: '',
        role: 'founder_ceo',
        especialidad: 'Fundador y CEO',
        avatarUrl: '../recursos/PSGD.png',
        orden: 0,
        _fixed: true
    };

    let allMembers = [];
    let liveEquipoRows = null;
    let liveProfileRows = null;
    let liveFeedReady = { equipo: false, perfiles: false };
    let subscriptions = [];
    let started = false;

    const $ = (id) => document.getElementById(id);
    const R = () => window.PanterRoles || null;
    const esc = (value) => {
        const lib = R();
        return lib ? lib.escapeHtml(value) : String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };

    /** Normaliza un nombre: minúsculas, sin acentos, sin puntuación. */
    function nameKey(value) {
        return String(value || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function readLocal() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            return Array.isArray(list) ? list.filter(item => item && item.uid) : [];
        } catch (e) { return []; }
    }

    function readHidden() {
        try {
            const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
            return new Set(Array.isArray(list) ? list.map(String) : []);
        } catch (e) { return new Set(); }
    }

    function memberKeys(member) {
        const keys = [];
        [member.uid, member.id, member.discordId, member.discord_id, member.discordUserId]
            .forEach(id => { if (id) keys.push('id:' + String(id)); });
        if (member.email) keys.push('email:' + String(member.email).trim().toLowerCase());
        const nk = nameKey(member.nombre || member.displayName || member.username || member.name);
        if (nk) keys.push('name:' + nk);
        return keys;
    }

    function normalizeMember(raw) {
        if (!raw || raw.archivado === true) return null;
        const lib = R();
        let role = lib ? lib.normalize(raw.role || raw.roleEquipo || raw.rango || 'usuario') : 'usuario';
        const email = String(raw.email || '').trim().toLowerCase();
        if (lib && typeof lib.roleForEmail === 'function' && lib.roleForEmail(email) === 'director') {
            role = 'director';
        }
        const nombre = String(raw.nombre || raw.displayName || raw.nombre_usuario || raw.username || raw.name || 'Miembro').trim();
        return {
            uid: String(raw.uid || raw.id || raw.discordId || `team_${nameKey(nombre) || 'miembro'}`),
            nombre,
            email,
            role,
            especialidad: String(raw.especialidad || raw.staffSpecialty || raw.specialty || '').trim(),
            avatarUrl: String(raw.avatarUrl || raw.avatarImg || raw.photoURL || raw.avatar || raw.foto || '').trim(),
            orden: Number(raw.orden || raw.order || 999),
            _source: raw._source || '',
            _fixed: Boolean(raw._fixed)
        };
    }

    /** Índice de perfiles `conductores` para completar avatar / nombre. */
    function buildProfileIndex(rows) {
        const index = new Map();
        (rows || []).forEach(profile => {
            if (!profile) return;
            [profile.uid, profile.id, profile.discordId, profile.discord_id]
                .forEach(id => { if (id) index.set('id:' + String(id), profile); });
            if (profile.email) index.set('email:' + String(profile.email).trim().toLowerCase(), profile);
            const nk = nameKey(profile.nombre_usuario || profile.displayName || profile.username || profile.nombre);
            if (nk) index.set('name:' + nk, profile);
        });
        return index;
    }

    function enrichWithProfile(member, index) {
        const keys = [
            'id:' + String(member.uid || ''),
            'email:' + String(member.email || '').toLowerCase(),
            'name:' + nameKey(member.nombre)
        ];
        let profile = null;
        for (const key of keys) {
            if (index.has(key)) { profile = index.get(key); break; }
        }
        if (!profile) return member;
        return Object.assign({}, profile, member, {
            avatarUrl: member.avatarUrl || profile.avatarUrl || profile.avatarImg || profile.photoURL || '',
            nombre: member.nombre || profile.nombre_usuario || profile.displayName || profile.username || 'Miembro'
        });
    }

    /** Combina todas las fuentes y elimina duplicados por identidad. */
    function collectMembers(rosterRows, profileRows) {
        const hidden = readHidden();
        const rawRows = [];

        (rosterRows || []).forEach(row => {
            if (!row || row.archivado === true) return;
            const uid = String(row.uid || row.id || '');
            if (uid && hidden.has(uid)) return;
            rawRows.push(Object.assign({}, row, { uid, _source: 'equipo' }));
        });

        // Lo guardado en el panel admin cuando Firestore rechazó la escritura.
        readLocal().forEach(row => {
            if (!row || hidden.has(String(row.uid))) return;
            rawRows.push(Object.assign({}, row, { _source: 'local' }));
        });

        const profileIndex = buildProfileIndex(profileRows);
        const index = new Map();
        const result = [];

        rawRows.forEach(raw => {
            const member = normalizeMember(enrichWithProfile(raw, profileIndex));
            if (!member) return;
            const keys = memberKeys(member);
            const existing = keys.map(key => index.get(key)).find(value => value !== undefined);
            if (existing !== undefined) {
                const previous = result[existing];
                const incoming = Object.assign({}, member);
                // Conserva la grafía original (con acentos) de la misma persona.
                if (nameKey(previous.nombre) === nameKey(incoming.nombre)) {
                    incoming.nombre = previous.nombre;
                }
                if (!previous.avatarUrl && incoming.avatarUrl) previous.avatarUrl = incoming.avatarUrl;
                if (incoming._source === 'local') {
                    result[existing] = Object.assign(previous, incoming);
                }
                keys.forEach(key => index.set(key, existing));
                return;
            }
            const position = result.length;
            result.push(member);
            keys.forEach(key => index.set(key, position));
        });

        return result;
    }

    /** Cúspide fija: Fundador/CEO y Director, sin duplicarlos en las ramas. */
    function leadership() {
        const lib = R();
        const founder = Object.assign({}, FOUNDER);

        const match = allMembers.find(member =>
            member.email === DIRECTOR_EMAIL || nameKey(member.nombre) === 'fenix'
        );
        const director = match
            ? Object.assign({}, match, { role: 'director' })
            : {
                uid: 'director_fenix', nombre: 'Fénix', email: DIRECTOR_EMAIL,
                role: 'director', especialidad: 'Director', avatarUrl: '',
                orden: 0, _fixed: true
            };

        const topKeys = new Set(memberKeys(founder).concat(memberKeys(director)));
        const branches = allMembers.filter(member =>
            !memberKeys(member).some(key => topKeys.has(key))
        );
        return { founder, director, branches };
    }

    function sortByRole(list) {
        const lib = R();
        return list.slice().sort((a, b) => {
            const ra = lib ? lib.rank(a.role) : 0;
            const rb = lib ? lib.rank(b.role) : 0;
            if (ra !== rb) return rb - ra;
            if (a.orden !== b.orden) return a.orden - b.orden;
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
        });
    }

    function personNode(member, big) {
        const lib = R();
        const def = lib ? lib.get(member.role) : null;
        const color = def ? def.color : '#0055ff';
        const label = def ? def.label : member.role;
        const initial = String(member.nombre || '?').charAt(0).toUpperCase();
        const avatar = member.avatarUrl
            ? `<img src="${esc(member.avatarUrl)}" alt="${esc(member.nombre)}" loading="lazy" decoding="async" data-ps-avatar>`
            : '';
        return `
            <div class="ps-org-person${big ? ' is-big' : ''}" style="--ps-org-color:${color}">
                <div class="ps-org-avatar">
                    ${avatar}
                    <span class="ps-org-initial" style="display:${member.avatarUrl ? 'none' : 'flex'}">${esc(initial)}</span>
                </div>
                <div class="ps-org-name">${esc(member.nombre)}</div>
                <div class="ps-org-role">${esc(label)}</div>
                ${member.especialidad ? `<div class="ps-org-specialty">${esc(member.especialidad)}</div>` : ''}
                ${lib ? `<div class="ps-org-badge">${lib.badgeHtml(member.role)}</div>` : ''}
            </div>`;
    }

    function render() {
        const grid = $('staffGrid');
        if (!grid) return;
        const lib = R();
        const { founder, director, branches } = leadership();

        // Agrupar por rango en orden jerárquico oficial.
        const groups = new Map();
        sortByRole(branches).forEach(member => {
            if (!groups.has(member.role)) groups.set(member.role, []);
            groups.get(member.role).push(member);
        });
        const order = lib
            ? lib.orderedRoleIds(Array.from(groups.keys()))
            : Array.from(groups.keys()).sort();

        const branchHtml = order.map(roleId => {
            const def = lib ? lib.get(roleId) : null;
            const list = groups.get(roleId) || [];
            if (!list.length) return '';
            return `
                <section class="ps-org-branch" style="--ps-org-color:${def ? def.color : '#0055ff'}">
                    <div class="ps-org-branch-label">
                        ${def ? `<i class="${def.icon}" aria-hidden="true"></i>` : ''}
                        ${esc(def ? def.label : roleId)}
                        <span>${list.length}</span>
                    </div>
                    <div class="ps-org-branch-people">
                        ${list.map(member => personNode(member, false)).join('')}
                    </div>
                </section>`;
        }).join('');

        const totalCount = branches.length + 2;
        const summary = $('teamFilters');
        if (summary) {
            summary.innerHTML = `<span class="ps-team-summary"><i class="fa-solid fa-sitemap" aria-hidden="true"></i> ${totalCount} personas · ${order.length} rangos activos · actualización en vivo</span>`;
        }

        grid.innerHTML = `
            <div class="ps-org">
                <h2 class="ps-org-title">Árbol del Equipo</h2>
                <p class="ps-org-sub">Fundación, dirección y todas las personas con rango asignado, en orden jerárquico.</p>
                <div class="ps-org-top">
                    ${personNode(founder, true)}
                    <span class="ps-org-couple" aria-hidden="true"></span>
                    ${personNode(director, true)}
                </div>
                <div class="ps-org-stem" aria-hidden="true"></div>
                <div class="ps-org-branches">
                    ${branchHtml || '<p class="ps-org-empty">Aún no hay más miembros asignados. Agrégalos desde Panel Admin → Personal.</p>'}
                </div>
            </div>`;
        grid.dataset.loaded = 'true';
        bindAvatarFallback(grid);
    }

    function bindAvatarFallback(grid) {
        if (grid.dataset.avatarBound === 'true') return;
        grid.dataset.avatarBound = 'true';
        grid.addEventListener('error', event => {
            const img = event.target;
            if (!img || !img.matches || !img.matches('[data-ps-avatar]')) return;
            img.style.display = 'none';
            const fallback = img.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
        }, true);
    }

    // ── Carga y sincronización ─────────────────────────────────
    function applyRows() {
        if (!liveFeedReady.equipo || !liveFeedReady.perfiles) return;
        allMembers = collectMembers(liveEquipoRows || [], liveProfileRows || []);
        render();
    }

    async function fetchCollection(name) {
        if (!window.db || !window.collection || !window.getDocs) return [];
        try {
            const snap = await window.getDocs(window.collection(window.db, name));
            return snap.docs.map(d => Object.assign({ uid: d.id }, d.data() || {}));
        } catch (e) {
            console.warn(`[Personal] No se pudo leer ${name}:`, e && e.message);
            return [];
        }
    }

    function stopSubscriptions() {
        subscriptions.forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
        subscriptions = [];
        started = false;
    }

    function startRealtime() {
        if (started) return true;
        if (!window.db || !window.collection || typeof window.onSnapshot !== 'function') return false;
        let attached = 0;

        const subscribe = (name, feed, onRows) => {
            try {
                const unsubscribe = window.onSnapshot(
                    window.collection(window.db, name),
                    snap => {
                        onRows(snap.docs.map(d => Object.assign({ uid: d.id }, d.data() || {})));
                        liveFeedReady[feed] = true;
                        applyRows();
                    },
                    error => {
                        console.warn(`[Personal] Suscripción no disponible para ${name}:`, error && error.message);
                        liveFeedReady[feed] = true;
                        applyRows();
                    }
                );
                if (typeof unsubscribe === 'function') { subscriptions.push(unsubscribe); attached++; }
            } catch (e) {
                console.warn(`[Personal] No se pudo suscribir a ${name}:`, e);
                liveFeedReady[feed] = true;
            }
        };

        subscribe('equipo', 'equipo', rows => { liveEquipoRows = rows; });
        subscribe('conductores', 'perfiles', rows => { liveProfileRows = rows; });
        if (!attached) return false;
        started = true;
        window.addEventListener('pagehide', stopSubscriptions, { once: true });
        return true;
    }

    async function loadOnce() {
        const [roster, profiles] = await Promise.all([
            fetchCollection('equipo'),
            fetchCollection('conductores')
        ]);
        liveEquipoRows = roster;
        liveProfileRows = profiles;
        liveFeedReady = { equipo: true, perfiles: true };
        allMembers = collectMembers(roster, profiles);
        render();
    }

    async function boot() {
        if (started || $('staffGrid')?.dataset.loaded === 'true') {
            // Ya arrancó: sólo refresca la copia local del panel.
            allMembers = collectMembers(liveEquipoRows || [], liveProfileRows || []);
            render();
            return;
        }
        if (!startRealtime()) await loadOnce();
    }

    // Cambios hechos desde el Panel Admin en otra pestaña.
    window.addEventListener('storage', event => {
        if (event.key === LOCAL_KEY || event.key === HIDDEN_KEY) {
            allMembers = collectMembers(liveEquipoRows || [], liveProfileRows || []);
            render();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            allMembers = collectMembers(liveEquipoRows || [], liveProfileRows || []);
            render();
        }
    });
    document.addEventListener('panter:roles-config', () => render());
    document.addEventListener('firebaseReady', boot);

    function init() {
        render(); // pinta el árbol base de inmediato, sin esperar red
        boot();
        // Reintenta hasta que el SDK de Firestore esté listo.
        let attempts = 0;
        const poll = () => {
            if (started || attempts >= 40) return;
            attempts++;
            boot();
            if (!started) setTimeout(poll, 250);
        };
        setTimeout(poll, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
