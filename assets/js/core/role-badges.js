/**
 * role-badges.js — Render dinámico de badges de rol (estilo GTAHUB)
 * Panter Studio · Depende de roles.js
 *
 * Expone window.PanterRoleBadges
 */
(function (global) {
    'use strict';

    let lastUser = null;
    let lastProfile = null;
    let renderTimer = null;
    let requestSeq = 0;
    let profileUnsubscribe = null;
    let teamUnsubscribe = null;
    let profileSubscriptionUid = null;
    let currentConductorProfile = null;
    let currentTeamMember = null;

    function roles() {
        return global.PanterRoles || null;
    }

    function esc(value) {
        const R = roles();
        if (R && R.escapeHtml) return R.escapeHtml(value);
        return String(value == null ? '' : value);
    }

    function getSessionUser() {
        try {
            if (global.DiscordAuth && typeof global.DiscordAuth.getUser === 'function') {
                return global.DiscordAuth.getUser();
            }
            const raw = global.localStorage.getItem('discord_user_session');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function fetchProfile(user) {
        if (!user || !user.uid) return null;
        if (!global.db || !global.fsDoc || !global.getDoc) return null;
        try {
            const snap = await global.getDoc(global.fsDoc(global.db, 'conductores', user.uid));
            if (snap && snap.exists()) return snap.data() || null;
        } catch (e) { /* perfil aún no disponible */ }
        return null;
    }

    async function fetchTeamMember(user) {
        if (!user || !user.uid) return null;
        if (!global.db || !global.fsDoc || !global.getDoc) return null;
        try {
            const snap = await global.getDoc(global.fsDoc(global.db, 'equipo', user.uid));
            if (snap && snap.exists()) return snap.data() || null;
        } catch (e) { /* roster aún no disponible */ }
        return null;
    }

    /**
     * El rango asignado en el Panel Admin (`equipo.role`) tiene prioridad
     * sobre el rol guardado en el perfil. Así un cambio de rango se refleja
     * en navbar, perfil y tickets sin recargar la página.
     */
    function mergeProfileWithTeam(profile, teamMember) {
        const out = Object.assign({}, profile || {});
        if (teamMember && teamMember.archivado !== true && teamMember.role) {
            out.teamRole = teamMember.role;
        }
        return out;
    }

    function setBadgeElement(el, roleId, options) {
        const R = roles();
        if (!el || !R) return;
        const def = R.get(roleId);
        if (!def) {
            el.hidden = true;
            return;
        }
        const opts = Object.assign({}, options || {});
        el.innerHTML = R.badgeHtml(roleId, opts);
        el.hidden = false;
        el.classList.add('ps-role-badge-host');
        el.dataset.role = def.id;
    }

    function stopProfileSubscription() {
        if (profileUnsubscribe) profileUnsubscribe();
        if (teamUnsubscribe) teamUnsubscribe();
        profileUnsubscribe = null;
        teamUnsubscribe = null;
        profileSubscriptionUid = null;
        currentConductorProfile = null;
        currentTeamMember = null;
    }

    function publishProfile(user) {
        if (!user || profileSubscriptionUid !== user.uid) return;
        const profile = mergeProfileWithTeam(currentConductorProfile, currentTeamMember);
        requestSeq += 1;
        lastUser = user;
        lastProfile = profile;
        applyToDom(user, profile);
        const detail = { user, profile };
        global.dispatchEvent(new CustomEvent('panter:user-profile', { detail }));
        document.dispatchEvent(new CustomEvent('panter:user-profile', { detail }));
    }

    function subscribeProfile(user) {
        if (!user || !user.uid || !global.db || !global.fsDoc || !global.onSnapshot) {
            stopProfileSubscription();
            return;
        }
        if (profileSubscriptionUid === user.uid) return;
        stopProfileSubscription();
        profileSubscriptionUid = user.uid;
        profileUnsubscribe = global.onSnapshot(
            global.fsDoc(global.db, 'conductores', user.uid),
            snap => {
                if (profileSubscriptionUid !== user.uid) return;
                currentConductorProfile = snap.exists() ? snap.data() || {} : null;
                publishProfile(user);
            },
            error => console.error('[PanterRoleBadges] Error observando el perfil:', error)
        );
        teamUnsubscribe = global.onSnapshot(
            global.fsDoc(global.db, 'equipo', user.uid),
            snap => {
                if (profileSubscriptionUid !== user.uid) return;
                currentTeamMember = snap.exists() ? snap.data() || {} : null;
                publishProfile(user);
            },
            error => console.error('[PanterRoleBadges] Error observando el roster del equipo:', error)
        );
    }

    function applyToDom(user, profile) {
        const R = roles();
        if (!R) return;
        const navBadge = document.getElementById('navUserRoleBadge');
        const genericBadges = document.querySelectorAll('[data-ps-role-badge], [data-auth-role-badge]');

        if (!user) {
            if (navBadge) navBadge.hidden = true;
            genericBadges.forEach(el => { el.hidden = true; });
            return;
        }

        const role = R.resolveRole(user, profile);
        const isAdmin = R.canAccessAdminPanel(role) || user.isAdmin === true || R.isDiscordAdmin(user);

        if (navBadge) {
            navBadge.className = 'auth-role-badge ps-role-badge-host';
            setBadgeElement(navBadge, role, { className: 'ps-role-badge-nav' });
            navBadge.hidden = false;
        }

        genericBadges.forEach(el => {
            if (el === navBadge) return;
            if (el.hasAttribute('data-ps-role-badge-optional') && !isAdmin && role === 'usuario') {
                el.hidden = true;
                return;
            }
            setBadgeElement(el, role);
        });

        // Contenedores que sólo deben existir cuando hay un rol especial.
        document.querySelectorAll('[data-ps-admin-only]').forEach(el => {
            el.hidden = !isAdmin;
        });
    }

    async function render(user, options) {
        const R = roles();
        if (!R) return;
        const opts = options || {};
        const seq = ++requestSeq;

        if (!user) {
            stopProfileSubscription();
            lastUser = null;
            lastProfile = null;
            applyToDom(null, null);
            return;
        }

        lastUser = user;
        subscribeProfile(user);
        const baseProfile = opts.profile !== undefined ? opts.profile : await fetchProfile(user);
        const teamMember = opts.teamMember !== undefined ? opts.teamMember : await fetchTeamMember(user);
        if (seq !== requestSeq) return; // una sesión más reciente ganó
        const profile = mergeProfileWithTeam(baseProfile, teamMember);
        lastProfile = profile;
        applyToDom(user, profile);
    }

    function schedule(user, options) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => {
            render(user, options).catch(err => console.warn('[PanterRoleBadges]', err));
        }, 60);
    }

    function refresh() {
        schedule(getSessionUser());
    }

    function init() {
        if (!roles()) {
            setTimeout(init, 150);
            return;
        }
        refresh();

        document.addEventListener('authStateChanged', ev => schedule(ev && ev.detail ? ev.detail.user : getSessionUser()));
        document.addEventListener('discordAuthChanged', ev => schedule(ev && ev.detail ? ev.detail.user : getSessionUser()));
        document.addEventListener('firebaseReady', refresh);
        document.addEventListener('panter:discord-config', refresh);
        document.addEventListener('panter:roles-config', refresh);

        // Algunos flujos actualizan el DOM justo después del login.
        setInterval(() => {
            const user = getSessionUser();
            const current = lastUser;
            const changed = (user && user.uid) !== (current && current.uid);
            const profileListenerMissing = user && user.uid && !profileSubscriptionUid && global.db && global.onSnapshot;
            if (changed || profileListenerMissing) refresh();
        }, 4000);
    }

    global.PanterRoleBadges = {
        init,
        refresh,
        render,
        applyToDom,
        getSessionUser,
        fetchProfile,
        fetchTeamMember,
        get lastUser() { return lastUser; },
        get lastProfile() { return lastProfile; }
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init, { once: true });
        } else {
            init();
        }
    }
})(typeof window !== 'undefined' ? window : this);
