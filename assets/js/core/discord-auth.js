/**
 * discord-auth.js — Sistema de Autenticación Discord OAuth 2.0 para Panter Studio
 * Usa Client ID de la App de Discord (1484918737093005494 - Sincronizado con SoporteSaaS)
 *
 * Scopes solicitados:
 *   identify              → perfil básico
 *   email                 → correo
 *   guilds                → lista de servidores (comprobación de membresía)
 *   guilds.members.read   → confirmar que el usuario pertenece al servidor
 *
 * El rango web NO se deduce de Discord: sólo el correo oficial del Director
 * recibe `director` automáticamente y el resto de rangos se asignan desde
 * Panel Admin → Personal (`equipo`). Discord se usa únicamente para validar
 * la membresía al servidor oficial.
 */

(function() {
    'use strict';

    const DISCORD_CLIENT_ID = '1484918737093005494';
    // Redirección OAuth: vuelve a la raíz del sitio, donde el token se
    // captura desde el hash sin depender de una página intermedia.
    // Debe coincidir exactamente con una Redirect URI del Developer Portal.
    const PRODUCTION_REDIRECT_URI = 'https://panterstudio.github.io/index.html';
    const OFFICIAL_GUILD_ID = '1391998991108935772';
    const OFFICIAL_GUILD_NAME = 'Panter Studio Game Dev';
    const INVITE_URL = 'https://discord.gg/MukZeJmgky';
    const STORAGE_KEY = 'discord_user_session';
    const TOKEN_KEY = 'discord_access_token';
    const TOKEN_STORE_KEY = 'discord_access_token_store';
    const AUTH_ERROR_KEY = 'discord_auth_error';
    const GUILD_CACHE_KEY = 'panterDiscordGuildContext';
    const SCOPES = 'identify email guilds guilds.members.read';
    const API_BASE = 'https://discord.com/api/v10';

    const listeners = new Set();
    let hashCallbackPromise = Promise.resolve(false);

    function rolesLib() {
        return window.PanterRoles || null;
    }

    function getPrimaryRedirectUri() {
        const loc = window.location;
        const host = String(loc.hostname || '');
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

        // En desarrollo local se mantiene el origen actual para no perder la sesión.
        if (isLocal) {
            return `${loc.origin}/index.html`;
        }

        // GitHub Pages (y cualquier otro dominio publicado) usa siempre la
        // Redirect URI exacta registrada en el portal de Discord.
        return PRODUCTION_REDIRECT_URI;
    }

    function getAvatarUrl(discordUser) {
        if (!discordUser) return 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (discordUser.avatar) {
            const ext = String(discordUser.avatar).startsWith('a_') ? 'gif' : 'png';
            return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=256`;
        }
        try {
            const index = (BigInt(discordUser.id) >> 22n) % 6n;
            return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
        } catch (e) {
            return 'https://cdn.discordapp.com/embed/avatars/0.png';
        }
    }

    /**
     * @deprecated Ya no hay rango automático por correo. Los rangos se
     * asignan manualmente en Panel Admin → Personal (`equipo`).
     */
    function isDirectorEmail(str) {
        return false;
    }

    function saveAccessToken(token, expiresIn) {
        if (!token) return;
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignore */ }

        // La sesión "guardada" del requisito vive en localStorage. El token se
        // conserva con su caducidad (implicit grant) para poder revalidar la
        // membresía al volver a abrir la web.
        try {
            const seconds = Number(expiresIn);
            const expiresAt = Number.isFinite(seconds) && seconds > 0
                ? Date.now() + (seconds * 1000)
                : 0;
            localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify({ token, expiresAt }));
        } catch (e) { /* storage no disponible */ }
    }

    function readStoredToken() {
        try {
            const raw = localStorage.getItem(TOKEN_STORE_KEY);
            if (!raw) return '';
            const data = JSON.parse(raw);
            if (!data || !data.token) return '';
            if (data.expiresAt && Date.now() >= Number(data.expiresAt)) {
                localStorage.removeItem(TOKEN_STORE_KEY);
                return '';
            }
            return String(data.token);
        } catch (e) {
            return '';
        }
    }

    function getAccessToken() {
        try {
            const sessionToken = sessionStorage.getItem(TOKEN_KEY);
            if (sessionToken) return sessionToken;
        } catch (e) { /* ignore */ }

        const stored = readStoredToken();
        if (stored) {
            try { sessionStorage.setItem(TOKEN_KEY, stored); } catch (e) { /* ignore */ }
        }
        return stored;
    }

    function clearAccessToken() {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        try { localStorage.removeItem(TOKEN_STORE_KEY); } catch (e) { /* ignore */ }
    }

    function isDiscordSession(user) {
        if (!user) return false;
        return user.providerId === 'discord.com' ||
            Boolean(user.discordId) ||
            String(user.uid || '').startsWith('discord_');
    }

    function formatDiscordUser(rawUser, extras) {
        const extra = extras || {};
        const avatarUrl = getAvatarUrl(rawUser);
        const displayName = rawUser.global_name || rawUser.username;

        const R = rolesLib();
        const email = rawUser.email || `${rawUser.id}@discord.local`;
        // Sin rango automático por correo: el rango real se resuelve en vivo
        // desde `equipo` mediante PanterRoles.resolveRole().
        const sessionRole = 'usuario';

        return {
            uid: `discord_${rawUser.id}`,
            id: rawUser.id,
            discordId: rawUser.id,
            username: rawUser.username,
            displayName: displayName,
            globalName: rawUser.global_name,
            email: email,
            photoURL: avatarUrl,
            avatarUrl: avatarUrl,
            avatar: rawUser.avatar,
            discriminator: rawUser.discriminator,
            emailVerified: true,
            providerId: 'discord.com',
            role: R ? R.toLegacyRole(sessionRole) : sessionRole,
            isAdmin: false,
            discordAdmin: false,
            adminOwner: false,
            discordGuildId: extra.guildId || null,
            discordGuildName: extra.guildName || null,
            discordGuildMember: extra.isMember === true,
            discordMembershipChecked: extra.membershipChecked === true,
            raw: rawUser
        };
    }

    function applySessionRole(user) {
        if (!user) return user;
        const R = rolesLib();
        if (!R) return user;

        // El rango de sesión es siempre el base; el rango manual asignado en
        // Personal (`equipo`) se resuelve en vivo con PanterRoles.resolveRole()
        // en badges, perfil, panel y tickets.
        const sessionRole = 'usuario';
        user.role = R.toLegacyRole(sessionRole);
        user.isAdmin = R.canAccessAdminPanel(sessionRole);
        user.discordAdmin = false;
        user.adminOwner = false;
        return user;
    }

    function getCurrentSession() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;
            let user = JSON.parse(data);
            user = applySessionRole(user);
            return user;
        } catch (e) {
            return null;
        }
    }

    function saveSession(user) {
        try {
            user = applySessionRole(user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
            notifyListeners(user);
        } catch (e) {
            console.error('[DiscordAuth] Error guardando sesión:', e);
        }
    }

    /**
     * Adopta un usuario de Firebase Auth (email/password o Google) como
     * sesión unificada de la web. Sin rango automático por correo: el rango
     * se asigna manualmente en `equipo` (Panel Admin → Personal) y se
     * resuelve en vivo con PanterRoles.resolveRole().
     */
    function adoptFirebaseUser(fbUser) {
        if (!fbUser || !fbUser.uid) return null;
        const R = rolesLib();
        const email = String(fbUser.email || '').trim().toLowerCase();
        const role = 'usuario';
        const name = String(fbUser.displayName || (email.split('@')[0] || 'Usuario')).trim();
        const avatar = fbUser.photoURL || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const providerId = (fbUser.providerData && fbUser.providerData[0] && fbUser.providerData[0].providerId)
            || 'password';

        const user = {
            uid: fbUser.uid,
            id: fbUser.uid,
            username: name,
            displayName: name,
            globalName: name,
            email: email,
            photoURL: avatar,
            avatarUrl: avatar,
            emailVerified: Boolean(fbUser.emailVerified),
            providerId: providerId,
            role: R ? R.toLegacyRole(role) : role,
            isAdmin: R ? R.canAccessAdminPanel(role) : false,
            discordAdmin: false,
            adminOwner: false,
            discordMembershipChecked: false
        };
        saveSession(user);
        syncProfile(user).catch(() => {});
        return user;
    }

    function clearSession() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            clearAccessToken();
            sessionStorage.removeItem(GUILD_CACHE_KEY);
            notifyListeners(null);
        } catch (e) {
            console.error('[DiscordAuth] Error borrando sesión:', e);
        }
    }

    function notifyListeners(user) {
        listeners.forEach(cb => {
            try { cb(user); } catch (err) { console.error(err); }
        });
        document.dispatchEvent(new CustomEvent('discordAuthChanged', { detail: { user } }));
        document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
    }

    function discordFetch(endpoint, accessToken, options) {
        const opts = options || {};
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutMs = Number(opts.timeout) > 0 ? Number(opts.timeout) : 8000;
        const timer = controller
            ? setTimeout(() => { try { controller.abort(); } catch (e) { /* ignore */ } }, timeoutMs)
            : null;

        return fetch(`${API_BASE}${endpoint}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller ? controller.signal : undefined
        }).then(async res => {
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                const err = new Error(`Discord API ${res.status} ${endpoint} ${text}`.trim());
                err.status = res.status;
                throw err;
            }
            return res.json();
        }).finally(() => {
            if (timer) clearTimeout(timer);
        });
    }

    /**
     * Consulta servidores, permisos y roles del usuario.
     * `overrides.guildId` permite forzar un servidor concreto (por ejemplo el
     * oficial en el gate de acceso).
     * No lanza si el usuario no está en el guild o falta configuración.
     */
    async function fetchDiscordGuildContext(accessToken, overrides) {
        const R = rolesLib();
        const cfg = R ? R.getDiscordConfig() : { guildId: '', guildName: '' };
        const override = overrides || {};
        const guildId = override.guildId || cfg.guildId || OFFICIAL_GUILD_ID;
        const context = {
            guildId: guildId || null,
            guildName: override.guildName || cfg.guildName || OFFICIAL_GUILD_NAME,
            guilds: [],
            isMember: false,
            membershipChecked: false,
            configured: Boolean(guildId)
        };

        // Discord se consulta únicamente para comprobar la pertenencia al
        // servidor oficial. No se leen permisos ni roles del guild: ningún
        // metadato externo puede asignar rangos o acceso de administrador.
        if (!accessToken) return context;
        if (!guildId) {
            try { context.guilds = await discordFetch('/users/@me/guilds', accessToken); } catch (e) {}
            return context;
        }

        let guild = null;
        try {
            const guilds = await discordFetch('/users/@me/guilds', accessToken);
            context.guilds = Array.isArray(guilds) ? guilds : [];
            context.membershipChecked = true;
            guild = context.guilds.find(g => String(g.id) === String(guildId)) || null;
            context.isMember = Boolean(guild);
        } catch (e) {
            context.error = e.message;
            context.tokenInvalid = e.status === 401;
            console.warn('[DiscordAuth] No se pudieron leer los servidores:', e.message);
        }

        if (guild) {
            context.guildName = guild.name || context.guildName;
        }

        let member = null;
        try {
            member = await discordFetch(`/users/@me/guilds/${guildId}/member`, accessToken);
            if (member) {
                context.isMember = true;
                context.membershipChecked = true;
            }
        } catch (e) {
            // El usuario no pertenece al guild o el scope no fue concedido.
            if (e.status === 401) {
                context.tokenInvalid = true;
                context.error = e.message;
            } else if (e.status !== 404 && e.status !== 403) {
                context.error = context.error || e.message;
                console.warn('[DiscordAuth] No se pudo leer el miembro del guild:', e.message);
            }
        }

        if (member) {
            if (member.nick) context.nick = member.nick;
            if (member.avatar) context.memberAvatar = member.avatar;
            if (member.joined_at) context.joinedAt = member.joined_at;
        }

        try {
            if (!context.tokenInvalid) {
                sessionStorage.setItem(GUILD_CACHE_KEY, JSON.stringify(context));
            }
        } catch (e) { /* ignore */ }

        return context;
    }

    async function fetchDiscordUserProfile(accessToken, guildContext) {
        const rawUser = await discordFetch('/users/@me', accessToken);
        let context = guildContext;
        if (!context) {
            context = await fetchDiscordGuildContext(accessToken);
        }
        return formatDiscordUser(rawUser, {
            guildId: context.guildId,
            guildName: context.guildName,
            isMember: context.isMember,
            membershipChecked: context.membershipChecked
        });
    }

    /* ─────────────────────────────────────────────────────────────
       Sincronización con Firestore
       ───────────────────────────────────────────────────────────── */
    function waitForFirestore(timeout) {
        return new Promise(resolve => {
            const started = Date.now();
            const ready = () => window.db && window.fsDoc && window.setDoc;
            if (ready()) return resolve(true);
            const timer = setInterval(() => {
                if (ready()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - started >= (timeout || 8000)) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 200);
        });
    }

    async function syncProfile(user) {
        if (!user) return false;
        const ok = await waitForFirestore();
        if (!ok) return false;
        const R = rolesLib();
        // `conductores.role` se sincroniza con la política por correo. El rango
        // manual vive en `equipo.role` y se resuelve en vivo, nunca se pisa aquí.
        const emailRole = R ? R.roleForEmail(user.email) : 'usuario';
        const payload = {
            uid: user.uid,
            discordId: user.discordId || user.id || null,
            username: user.username || null,
            displayName: user.displayName || user.username || null,
            nombre_usuario: user.displayName || user.username || null,
            email: user.email || null,
            avatarUrl: user.avatarUrl || user.photoURL || null,
            avatarImg: user.avatarImg || user.avatarUrl || user.photoURL || null,
            photoURL: user.photoURL || user.avatarUrl || null,
            role: R ? R.toLegacyRole(emailRole) : emailRole,
            isAdmin: R ? R.canAccessAdminPanel(emailRole) : false,
            discordAdmin: false,
            discordGuildId: user.discordGuildId || null,
            discordGuildName: user.discordGuildName || null,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        try {
            await window.setDoc(window.fsDoc(window.db, 'conductores', user.uid), payload, { merge: true });
            // El roster `equipo` sólo se gestiona manualmente desde el panel.
            return true;
        } catch (e) {
            console.warn('[DiscordAuth] No se pudo sincronizar el perfil en Firestore:', e.message);
            return false;
        }
    }

    function enrichUserWithGuild(user, context) {
        if (!user || !context) return user;
        // Sólo se conserva la pertenencia al guild. Los roles y permisos de
        // Discord ya no se leen ni se guardan en la sesión.
        delete user.discordPermissions;
        delete user.discordRoleIds;
        delete user.discordRoleNames;
        delete user.discordRole;
        user.discordGuildId = context.guildId || user.discordGuildId || null;
        user.discordGuildName = context.guildName || user.discordGuildName || null;
        user.discordGuildMember = context.membershipChecked
            ? Boolean(context.isMember)
            : Boolean(user.discordGuildMember);
        user.discordMembershipChecked = Boolean(context.membershipChecked) || Boolean(user.discordMembershipChecked);
        user.discordAdmin = false;
        user.adminOwner = false;
        return applySessionRole(user);
    }

    async function refreshGuildMembership() {
        const user = getCurrentSession();
        if (!user) return null;
        const token = getAccessToken();
        if (!token) return user;
        try {
            const context = await fetchDiscordGuildContext(token);
            if (context.tokenInvalid) {
                clearAccessToken();
                return user;
            }
            const updated = enrichUserWithGuild(Object.assign({}, user), context);
            saveSession(updated);
            syncProfile(updated).catch(() => {});
            return updated;
        } catch (e) {
            console.warn('[DiscordAuth] No se pudo revalidar la membresía:', e.message);
            return user;
        }
    }

    // Discord puede devolver un error directamente en el hash (por ejemplo si
    // el usuario cancela). Se limpia la URL y se guarda el motivo para el gate.
    function handleAuthErrorHash() {
        const hash = window.location.hash;
        if (!hash || hash.indexOf('error=') === -1) return null;

        const params = new URLSearchParams(hash.substring(1));
        const error = params.get('error');
        if (!error) return null;

        const description = params.get('error_description') || '';
        try {
            sessionStorage.setItem(AUTH_ERROR_KEY, JSON.stringify({
                error,
                description,
                at: Date.now()
            }));
        } catch (e) { /* ignore */ }

        history.replaceState(null, document.title, window.location.pathname + window.location.search);
        return { error, description };
    }

    function consumeAuthError() {
        try {
            const raw = sessionStorage.getItem(AUTH_ERROR_KEY);
            sessionStorage.removeItem(AUTH_ERROR_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            // Errores de hace más de 10 minutos ya no son relevantes.
            if (!data || (data.at && Date.now() - data.at > 600000)) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    // Maneja callback en la misma página si hay token en el hash
    async function handleHashCallback() {
        const hash = window.location.hash;
        if (!hash) return false;

        if (hash.indexOf('error=') !== -1) {
            handleAuthErrorHash();
            return false;
        }

        if (hash.indexOf('access_token=') === -1) return false;

        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        if (!accessToken) return false;

        history.replaceState(null, document.title, window.location.pathname + window.location.search);
        saveAccessToken(accessToken, params.get('expires_in'));

        try {
            const context = await fetchDiscordGuildContext(accessToken);
            const user = await fetchDiscordUserProfile(accessToken, context);
            saveSession(user);
            syncProfile(user).catch(() => {});

            if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'DISCORD_AUTH_SUCCESS', user }, '*');
                window.close();
            }
            return true;
        } catch (err) {
            console.error('[DiscordAuth] Callback error:', err);
            if (window.opener && window.opener !== window) {
                window.opener.postMessage({ type: 'DISCORD_AUTH_ERROR', error: err.message }, '*');
                window.close();
            }
            return false;
        }
    }

    /**
     * Valida la sesión guardada y la pertenencia al servidor oficial.
     * Devuelve un resultado estable para que el gate de index.html decida.
     *
     * states: member | no-session | not-discord | not-member | expired | unverified | error
     */
    async function validateGuildAccess(options) {
        const opts = options || {};
        try { await hashCallbackPromise; } catch (e) { /* ignore */ }

        const user = getCurrentSession();
        const base = {
            inviteUrl: INVITE_URL,
            guildId: OFFICIAL_GUILD_ID,
            guildName: OFFICIAL_GUILD_NAME,
            checked: false,
            isMember: false,
            isAdmin: false,
            user: user || null,
            context: null
        };

        if (!user) {
            return Object.assign(base, { allowed: false, state: 'no-session' });
        }

        if (!isDiscordSession(user)) {
            return Object.assign(base, { allowed: false, state: 'not-discord' });
        }

        const token = getAccessToken();
        if (!token) {
            // No hay forma de revalidar sin token: no se bloquea para no dejar
            // al usuario fuera de su propia cuenta.
            return Object.assign(base, {
                allowed: true,
                state: 'unverified',
                message: 'Sesión sin token de Discord; membresía no revalidada.'
            });
        }

        let context;
        try {
            // El acceso web siempre se valida contra el servidor oficial.
            context = await fetchDiscordGuildContext(token, {
                guildId: OFFICIAL_GUILD_ID,
                guildName: OFFICIAL_GUILD_NAME
            });
        } catch (e) {
            return Object.assign(base, {
                allowed: true,
                state: 'error',
                error: e.message
            });
        }

        base.context = context;
        base.checked = Boolean(context.membershipChecked);
        base.isMember = Boolean(context.isMember);
        base.guildName = context.guildName || base.guildName;
        {
            const R = rolesLib();
            const sessionRole = user && R ? R.roleForEmail(user.email) : 'usuario';
            base.isAdmin = Boolean(R && R.canAccessAdminPanel(sessionRole));
        }

        if (context.tokenInvalid) {
            clearAccessToken();
            return Object.assign(base, { allowed: false, state: 'expired' });
        }

        if (context.membershipChecked && !context.isMember) {
            return Object.assign(base, { allowed: false, state: 'not-member' });
        }

        if (!context.membershipChecked) {
            return Object.assign(base, {
                allowed: true,
                state: 'error',
                error: context.error || 'No se pudo verificar la membresía.'
            });
        }

        const updated = enrichUserWithGuild(Object.assign({}, user), context);
        if (!opts.skipPersist) {
            saveSession(updated);
            syncProfile(updated).catch(() => {});
        }

        return Object.assign(base, {
            allowed: true,
            state: 'member',
            user: updated,
            isMember: true,
            isAdmin: Boolean(updated.isAdmin)
        });
    }

    async function login(customRedirectUri) {
        try {
            sessionStorage.setItem('auth_return_url', window.location.href);
        } catch (e) {}
        const redirectUri = customRedirectUri || getPrimaryRedirectUri();
        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(SCOPES)}`;
        window.location.href = authUrl;
    }

    async function checkSession() {
        try {
            const backendBase = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:5000'
                : '';
            const res = await fetch(`${backendBase}/api/auth/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.user) {
                    saveSession(data.user);
                    return data.user;
                }
            }
        } catch (e) {}
        return getCurrentSession();
    }

    function logout() {
        clearSession();
        return Promise.resolve();
    }

    function onAuthStateChanged(callback) {
        listeners.add(callback);
        const current = getCurrentSession();
        callback(current);

        // Sólo se revalida la pertenencia al guild; los rangos NUNCA vienen
        // de Discord. La cadena va protegida para no dejar rechazos sin tratar.
        checkSession().then(user => {
            if (user) {
                callback(user);
                refreshGuildMembership().catch(() => {});
            }
        }).catch(() => {});
        return () => listeners.delete(callback);
    }

    function loginWithEmail(email, password) {
        return new Promise((resolve) => {
            const rawInput = String(email || '').trim();
            const cleanEmail = rawInput.toLowerCase();
            const R = rolesLib();
            // Asignación exclusiva por correo: Director o Usuario.
            const role = R ? R.roleForEmail(cleanEmail) : 'usuario';
            const finalEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@panterstudio.lat`;
            const name = rawInput.split('@')[0] || 'Usuario';
            const user = {
                uid: `email_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
                id: cleanEmail,
                username: name,
                displayName: name,
                email: finalEmail,
                photoURL: 'https://cdn.discordapp.com/embed/avatars/1.png',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
                role: R ? R.toLegacyRole(role) : role,
                isAdmin: R ? R.canAccessAdminPanel(role) : false,
                discordAdmin: false,
                adminOwner: false,
                providerId: 'password'
            };

            saveSession(user);
            resolve(user);
        });
    }

    hashCallbackPromise = handleHashCallback();

    window.DiscordAuth = {
        CLIENT_ID: DISCORD_CLIENT_ID,
        SCOPES,
        INVITE_URL,
        OFFICIAL_GUILD_ID,
        OFFICIAL_GUILD_NAME,
        login,
        loginWithEmail,
        logout,
        getUser: getCurrentSession,
        onAuthStateChanged,
        getAvatarUrl,
        getPrimaryRedirectUri,
        getAccessToken,
        isDiscordSession,
        isDirectorEmail,
        adoptFirebaseUser,
        fetchDiscordGuildContext,
        validateGuildAccess,
        consumeAuthError,
        whenReady: function() { return hashCallbackPromise; },
        refreshRoles: refreshGuildMembership,
        syncProfile
    };

    console.log('[DiscordAuth] Motor nativo Discord OAuth 2.0 listo (Client ID:', DISCORD_CLIENT_ID, ')');
})();
