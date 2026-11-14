/**
 * staff-sync.js — Fuente ÚNICA y compartida de rangos manuales + sesión
 * ============================================================
 * Conecta el login (DiscordAuth), el Panel Admin → Personal (`equipo` +
 * `ps_staff_local`), el Centro de Soporte, el Perfil, el árbol de Personal
 * y el FORO para que TODOS vean el mismo rango y reaccionen al instante
 * cuando se cambia desde el panel.
 *
 *  · NO crea rangos nuevos: sólo usa los ids oficiales de `roles.js`.
 *  · NO asigna rangos por correo ni por Discord: el rango SIEMPRE sale
 *    de `equipo.role` (o de su copia local `ps_staff_local`).
 *  · El correo / nombre se usan únicamente para EMPAREJAR la sesión con
 *    su ficha de equipo, igual que ya hacía `soporte.js`.
 *
 * Expone window.PanterStaff y el evento `panter:staff-changed`.
 */
(function (global) {
    'use strict';

    const STAFF_KEY = 'ps_staff_local';
    const FENIX_FLAG = 'ps_staff_fenix_admin_v1';
    const FENIX_UID = 'team_fenix';
    const FENIX_NAME = 'Fénix';
    const FENIX_EMAIL = 'oliverosgutierezjhonier@gmail.com';
    const FENIX_ROLE = 'administrador';   // rango OFICIAL ya existente
    const CHANGE_EVENT = 'panter:staff-changed';

    const listeners = new Set();
    let remoteMembers = [];
    let localMembers = [];
    let unsub = null;
    let started = false;
    let bootDone = false;
    let readyPolls = 0;

    function R() { return global.PanterRoles || null; }

    function nameKey(value) {
        return String(value == null ? '' : value).trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function readLocal() {
        try {
            const list = JSON.parse(global.localStorage.getItem(STAFF_KEY) || '[]');
            return Array.isArray(list)
                ? list.filter(m => m && (m.uid || m.id) && m.archivado !== true)
                : [];
        } catch (e) { return []; }
    }
    function writeLocal(list) {
        try { global.localStorage.setItem(STAFF_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }
    function currentUser() {
        try {
            return global.DiscordAuth && typeof global.DiscordAuth.getUser === 'function'
                ? global.DiscordAuth.getUser() : null;
        } catch (e) { return null; }
    }

    function fenixRecord(uid, overrides) {
        return Object.assign({
            uid: String(uid || FENIX_UID),
            nombre: FENIX_NAME,
            email: FENIX_EMAIL,
            role: FENIX_ROLE,
            especialidad: 'Administración',
            avatarUrl: '',
            orden: 1,
            actualizadoEn: new Date().toISOString()
        }, overrides || {});
    }

    function isFenixRecord(m) {
        if (!m) return false;
        if (String(m.uid || m.id || '') === FENIX_UID) return true;
        if (String(m.email || '').trim().toLowerCase() === FENIX_EMAIL) return true;
        const nk = nameKey(m.nombre || m.displayName || m.username || m.nombre_usuario);
        return nk.length >= 3 && nk === nameKey(FENIX_NAME);
    }
    function isFenixUser(user) {
        if (!user) return false;
        if (String(user.email || '').trim().toLowerCase() === FENIX_EMAIL) return true;
        return nameKey(user.displayName || user.username || user.globalName) === nameKey(FENIX_NAME);
    }

    /**
     * `equipo` (nube) + `ps_staff_local` (mirror del panel).
     * Dedupe por uid Y por identidad (correo / nombre / aliases de sesión),
     * para que una misma persona con varios documentos (los antiguos
     * «3 Fénix») sea UNA SOLA ficha en toda la web. Gana la más reciente;
     * en empate, la ficha canónica.
     */
    function allMembers() {
        const byUid = new Map();
        remoteMembers.forEach(m => {
            if (!m || m.archivado === true) return;
            const k = String(m.uid || m.id || '');
            if (k) byUid.set(k, Object.assign({ uid: k, id: k }, m));
        });
        localMembers.forEach(m => {
            if (!m || m.archivado === true) return;
            const k = String(m.uid || m.id || '');
            if (!k) return;
            // El mirror local es el que escribe el Panel Admin cuando la nube
            // rechaza la escritura: tiene prioridad sobre el documento remoto.
            byUid.set(k, Object.assign({}, byUid.get(k) || {}, m, { uid: k, id: k }));
        });

        const result = [];
        const index = new Map();
        Array.from(byUid.values()).forEach(m => {
            const keys = identityKeys(m);
            const pos = keys.map(k => index.get(k)).find(v => v !== undefined);
            if (pos === undefined) {
                const i = result.length;
                result.push(Object.assign({}, m));
                identityKeys(result[i]).forEach(k => index.set(k, i));
                return;
            }
            const prev = result[pos];
            const tsA = new Date(prev.actualizadoEn || prev.creadoEn || 0).getTime() || 0;
            const tsB = new Date(m.actualizadoEn || m.creadoEn || 0).getTime() || 0;
            const canonA = String(prev.uid) === FENIX_UID;
            const canonB = String(m.uid) === FENIX_UID;
            const bWins = tsB > tsA || (tsB === tsA && canonB && !canonA);
            const winner = bWins ? m : prev;
            const other = bWins ? prev : m;
            const uids = Array.from(new Set([]
                .concat(Array.isArray(prev.uids) ? prev.uids : [])
                .concat(Array.isArray(m.uids) ? m.uids : [])
                .concat([String(prev.uid), String(m.uid)])
                .filter(Boolean)));
            const merged = Object.assign({}, other, winner, { uids: uids });
            result[pos] = merged;
            identityKeys(merged).forEach(k => index.set(k, pos));
        });
        return result;
    }

    function memberRole(m) {
        if (!m || m.archivado === true) return null;
        const raw = m.role || m.rol || m.roleEquipo || m.rango || m.roleName;
        if (!raw || typeof raw !== 'string') return null;
        const lib = R();
        return lib && typeof lib.normalize === 'function'
            ? lib.normalize(raw) : raw.trim().toLowerCase();
    }

    function identityKeys(m) {
        const keys = [];
        const ids = [m.uid, m.id, m.discordId, m.discord_id, m.discordUserId];
        // Aliases de sesión (p. ej. uids de Discord / Firebase de la misma
        // persona). Se guardan en la ficha ÚNICA para no duplicar miembros.
        if (Array.isArray(m.uids)) ids.push.apply(ids, m.uids);
        ids.forEach(id => {
            if (!id) return;
            const s = String(id);
            keys.push('id:' + s);
            if (s.indexOf('discord_') === 0) {
                const n = s.slice('discord_'.length);
                if (n) keys.push('id:' + n);
            } else if (/^\d{5,25}$/.test(s)) {
                keys.push('id:discord_' + s);
            }
        });
        if (m.email) keys.push('email:' + String(m.email).trim().toLowerCase());
        [m.nombre, m.displayName, m.username, m.nombre_usuario, m.name, m.discordUsername].forEach(n => {
            const k = nameKey(n);
            if (k && k.length >= 3) keys.push('name:' + k);
        });
        return keys;
    }

    /**
     * Prioridad: uid de sesión > correo > nombre normalizado.
     * Así, si el usuario se cambia el rango en el panel, su propia ficha
     * gana siempre y el cambio se refleja de inmediato en toda la web.
     */
    function findFor(identity) {
        const who = identity || {};
        const members = allMembers();
        const uid = String(who.uid || who.id || '').trim();
        const uidKeys = [];
        if (uid) {
            uidKeys.push('id:' + uid);
            if (uid.indexOf('discord_') === 0) {
                const n = uid.slice('discord_'.length);
                if (n) uidKeys.push('id:' + n);
            } else if (/^\d{5,25}$/.test(uid)) {
                uidKeys.push('id:discord_' + uid);
            }
        }
        const email = String(who.email || '').trim().toLowerCase();
        const nk = nameKey(who.nombre || who.displayName || who.username || who.name);

        if (uidKeys.length) {
            for (const m of members) {
                const keys = identityKeys(m);
                if (uidKeys.some(k => keys.indexOf(k) !== -1)) return m;
            }
        }
        if (email) {
            for (const m of members) {
                if (identityKeys(m).indexOf('email:' + email) !== -1) return m;
            }
        }
        if (nk && nk.length >= 3) {
            for (const m of members) {
                if (identityKeys(m).indexOf('name:' + nk) !== -1) return m;
            }
        }
        return null;
    }

    function resolveRoleFor(user) {
        const lib = R();
        const fallback = (lib && lib.DEFAULT_MEMBER_ROLE) || 'usuario';
        if (!user) return fallback;
        const m = findFor({
            uid: user.uid || user.id,
            email: user.email,
            nombre: user.displayName || user.username || user.globalName
        });
        const profile = { email: String(user.email || '').trim().toLowerCase() };
        const role = memberRole(m);
        if (role) profile.teamRole = role;
        if (lib && typeof lib.resolveRole === 'function') return lib.resolveRole(user, profile);
        return role || fallback;
    }

    /** Rol en vivo de un autor de post / mensaje (para repintar al cambiar). */
    function roleForAuthor(a) {
        return memberRole(findFor(a || {}));
    }

    function isAdmin(user) {
        const lib = R();
        const role = resolveRoleFor(user);
        return lib && typeof lib.canAccessAdminPanel === 'function'
            ? lib.canAccessAdminPanel(role) : false;
    }

    function notify() {
        const detail = { members: allMembers() };
        try { document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail })); } catch (e) { /* noop */ }
        try { global.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail })); } catch (e) { /* noop */ }
        listeners.forEach(fn => { try { fn(detail); } catch (e) { /* noop */ } });
        try {
            if (global.PanterRoleBadges && typeof global.PanterRoleBadges.refresh === 'function') {
                global.PanterRoleBadges.refresh();
            }
        } catch (e) { /* noop */ }
    }

    function onChange(cb) {
        if (typeof cb === 'function') listeners.add(cb);
        return () => listeners.delete(cb);
    }

    /* ── Ficha de Fénix = Administrador ─────────────────────────
       Se aplica UNA SOLA VEZ. Si el usuario cambia su rango después
       desde el Panel Admin, este bootstrap no vuelve a pisarlo. */
    function ensureFenixAdmin() {
        if (bootDone) return;
        bootDone = true;
        try { if (global.localStorage.getItem(FENIX_FLAG)) return; } catch (e) { return; }

        const list = readLocal();
        const fenixIdx = [];
        list.forEach((m, i) => { if (isFenixRecord(m)) fenixIdx.push(i); });
        if (!fenixIdx.length) {
            list.push(fenixRecord(FENIX_UID));
        } else {
            // Si ya había fichas antiguas de Fénix, se asegura el rango
            // pedido en la que ganará la deduplicación (la más reciente o
            // la canónica), SIN borrar ninguna y SIN tocar las demás.
            let target = fenixIdx[0];
            let bestTs = -1;
            fenixIdx.forEach(i => {
                const ts = new Date(list[i].actualizadoEn || list[i].creadoEn || 0).getTime() || 0;
                if (ts > bestTs || (ts === bestTs && String(list[i].uid) === FENIX_UID)) {
                    bestTs = ts; target = i;
                }
            });
            list[target].role = FENIX_ROLE;
            list[target].actualizadoEn = new Date().toISOString();
        }
        writeLocal(list);
        try { global.localStorage.setItem(FENIX_FLAG, new Date().toISOString()); } catch (e) { /* noop */ }
        localMembers = readLocal();
        notify();
        ensureRemoteFenix();
    }

    async function ensureRemoteFenix() {
        if (!global.db || !global.fsDoc || !global.getDoc || !global.setDoc) return;
        try {
            const ref = global.fsDoc(global.db, 'equipo', FENIX_UID);
            const snap = await global.getDoc(ref);
            if (snap && snap.exists()) return;   // se respeta lo ya existente
            await global.setDoc(ref, fenixRecord(FENIX_UID));
        } catch (e) {
            console.warn('[PanterStaff] Ficha de Fénix disponible en copia local:', e && e.message);
        }
    }

    /**
     * Registra el uid de la sesión como ALIAS de la ficha ÚNICA de Fénix,
     * en lugar de crear un segundo miembro (evita los «3 Fénix»).
     * NUNCA modifica `role`: si el usuario se cambia el rango en el panel,
     * se respeta. Los módulos que resuelven por uid exacto encuentran la
     * ficha gracias a estos aliases a través de PanterStaff.
     */
    async function syncSessionRole(user) {
        if (!isFenixUser(user) || !user.uid) return;
        const uid = String(user.uid);
        const shortUid = uid.indexOf('discord_') === 0 ? uid.slice('discord_'.length) : uid;
        const aliases = [uid, shortUid, 'discord_' + shortUid].filter(Boolean);

        const list = readLocal();
        let idx = list.findIndex(isFenixRecord);
        if (idx < 0) {
            list.push(fenixRecord(FENIX_UID));
            idx = list.length - 1;
        }
        const m = Object.assign({}, list[idx]);
        const uids = Array.isArray(m.uids) ? m.uids.slice() : [];
        let changed = false;
        aliases.forEach(a => { if (uids.indexOf(a) === -1) { uids.push(a); changed = true; } });
        if (!m.discordId) { m.discordId = shortUid; changed = true; }
        if (!m.email && user.email) { m.email = String(user.email); changed = true; }
        if (changed) {
            m.uids = uids;
            m.actualizadoEn = new Date().toISOString();
            list[idx] = m;
            writeLocal(list);
            localMembers = readLocal();
            notify();
        }

        // Nube: sólo añade aliases a la ficha canónica (merge), sin tocar
        // el rango asignado manualmente en Personal.
        if (!global.db || !global.fsDoc || !global.setDoc) return;
        try {
            await global.setDoc(
                global.fsDoc(global.db, 'equipo', FENIX_UID),
                { uids: uids, discordId: shortUid },
                { merge: true }
            );
        } catch (e) { /* la copia local ya está garantizada */ }
    }

    function startRealtime() {
        if (unsub || !global.db || !global.collection || !global.onSnapshot) return;
        try {
            unsub = global.onSnapshot(
                global.collection(global.db, 'equipo'),
                snap => {
                    remoteMembers = snap.docs.map(d =>
                        Object.assign({ uid: d.id, id: d.id }, d.data() || {}));
                    notify();
                },
                err => console.warn('[PanterStaff] Sincronización de personal no disponible:', err && err.message)
            );
        } catch (e) { /* noop */ }
    }

    function refresh() {
        localMembers = readLocal();
        startRealtime();
        notify();
    }

    function init() {
        if (started) return;
        started = true;
        localMembers = readLocal();
        ensureFenixAdmin();
        refresh();
        syncSessionRole(currentUser());

        const onSession = ev => {
            const u = ev && ev.detail ? ev.detail.user : currentUser();
            syncSessionRole(u);
            refresh();
        };
        document.addEventListener('authStateChanged', onSession);
        document.addEventListener('discordAuthChanged', onSession);
        document.addEventListener('firebaseReady', () => { ensureRemoteFenix(); startRealtime(); });
        document.addEventListener('panter:roles-config', refresh);

        // El panel (u otra vista) puede escribir `ps_staff_local` en ESTA
        // misma pestaña: `storage` no se dispara, así que se recarga la
        // caché con el evento compartido. Sin `notify()` para no crear
        // un bucle: quien emite el evento ya ha avisado a los demás.
        document.addEventListener(CHANGE_EVENT, () => {
            const fresh = readLocal();
            if (JSON.stringify(fresh) !== JSON.stringify(localMembers)) {
                localMembers = fresh;
            }
        });
        global.addEventListener('storage', ev => {
            if (ev.key === STAFF_KEY) { localMembers = readLocal(); notify(); }
        });

        // El SDK de Firestore se inicializa de forma asíncrona: se reintenta
        // de forma acotada hasta poder enganchar la suscripción en vivo.
        const poll = () => {
            if (unsub || readyPolls >= 40) return;
            readyPolls += 1;
            startRealtime();
            if (!unsub && readyPolls < 40) setTimeout(poll, 250);
        };
        setTimeout(poll, 250);
    }

    global.PanterStaff = {
        allMembers,
        findFor,
        memberRole,
        resolveRoleFor,
        roleForAuthor,
        isAdmin,
        ensureFenixAdmin,
        syncSessionRole,
        refresh,
        onChange,
        CHANGE_EVENT
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
            init();
        }
    }
})(typeof window !== 'undefined' ? window : this);
