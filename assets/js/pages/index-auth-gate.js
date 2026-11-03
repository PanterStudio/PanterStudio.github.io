/**
 * index-auth-gate.js — Acceso obligatorio con Discord (solo portada)
 *
 * Responsabilidades:
 *   1. Mantener bloqueada la portada hasta validar la sesión de Discord.
 *   2. Validar membresía al servidor oficial y rango (Administrator / mapeo).
 *   3. Mostrar estados claros: invitado, verificando, no miembro, expirado.
 *
 * El overlay existe en el HTML desde el primer paint para evitar mostrar el
 * contenido antes de validar. Este script decide si se retira.
 */
(function () {
    'use strict';

    const gate = document.getElementById('psAuthGate');
    if (!gate) return;

    const card = gate.querySelector('.ps-auth-gate-card');
    const els = {
        title: document.getElementById('psAuthGateTitle'),
        text: document.getElementById('psAuthGateText'),
        profile: document.getElementById('psAuthGateProfile'),
        avatar: document.getElementById('psAuthGateAvatar'),
        name: document.getElementById('psAuthGateName'),
        role: document.getElementById('psAuthGateRole'),
        spinner: document.getElementById('psAuthGateSpinner'),
        login: document.getElementById('psAuthGateLogin'),
        loginLabel: document.getElementById('psAuthGateLoginLabel'),
        retry: document.getElementById('psAuthGateRetry'),
        invite: document.getElementById('psAuthGateInvite'),
        logout: document.getElementById('psAuthGateLogout'),
        status: document.getElementById('psAuthGateStatus')
    };

    const INVITE_FALLBACK = 'https://discord.gg/MukZeJmgky';
    const GUILD_NAME = 'Panter Studio Game Dev';
    const MESSAGES = {
        guestTitle: 'Bienvenido a Panter Studio',
        guestText: 'Para entrar al hub necesitas iniciar sesión con Discord y pertenecer al servidor oficial <strong>' + GUILD_NAME + '</strong>.',
        deniedTitle: 'Necesitas unirte al servidor',
        deniedText: 'Tu cuenta de Discord está verificada, pero no encontramos tu membresía en <strong>' + GUILD_NAME + '</strong>. Únete con la invitación y vuelve a intentarlo.',
        expiredTitle: 'Tu sesión de Discord expiró',
        expiredText: 'Por seguridad necesitamos validar de nuevo tu cuenta y tu rango. Inicia sesión otra vez con Discord para continuar.',
        notDiscordTitle: 'Inicia sesión con Discord',
        notDiscordText: 'La sesión actual no se creó con Discord. Para acceder a Panter Studio debes usar tu cuenta de Discord.'
    };

    let busy = false;

    function api() {
        return window.DiscordAuth || null;
    }

    function setState(state) {
        if (card) card.dataset.gateState = state;
        gate.dataset.gateState = state;
    }

    function lock() {
        gate.hidden = false;
        document.documentElement.classList.add('ps-auth-locked');
    }

    function unlock() {
        gate.hidden = true;
        document.documentElement.classList.remove('ps-auth-locked');
        window.__psAuthGateReady = true;
    }

    function setText(title, html) {
        if (els.title && title) els.title.textContent = title;
        if (els.text && html) els.text.innerHTML = html;
    }

    function setButtons(opts) {
        const o = opts || {};
        if (els.login) {
            els.login.hidden = !o.login;
            els.login.disabled = false;
        }
        if (els.loginLabel) {
            els.loginLabel.textContent = o.loginLabel || 'Iniciar sesión con Discord';
        }
        if (els.retry) els.retry.hidden = !o.retry;
        if (els.invite) els.invite.hidden = !o.invite;
        if (els.logout) els.logout.hidden = !o.logout;
        if (els.spinner) els.spinner.hidden = !o.spinner;
    }

    function setStatus(message) {
        if (els.status) els.status.textContent = message || '';
    }

    function avatarFor(user) {
        const auth = api();
        if (!user) return 'recursos/PSGD.png';
        if (user.photoURL || user.avatarUrl) return user.photoURL || user.avatarUrl;
        if (auth && typeof auth.getAvatarUrl === 'function') {
            try { return auth.getAvatarUrl(user.raw || user) || 'recursos/PSGD.png'; } catch (e) { /* ignore */ }
        }
        return 'recursos/PSGD.png';
    }

    function renderProfile(user) {
        if (!els.profile) return;
        if (!user) {
            els.profile.hidden = true;
            return;
        }

        els.profile.hidden = false;
        if (els.avatar) els.avatar.src = avatarFor(user);
        if (els.name) {
            els.name.textContent = user.displayName || user.globalName || user.username || 'Usuario de Discord';
        }
        if (els.role) {
            const R = window.PanterRoles;
            const role = user.discordAdmin ? 'admin_owner' : (user.role || 'usuario');
            if (R && typeof R.badgeHtml === 'function') {
                els.role.innerHTML = R.badgeHtml(role);
            } else {
                els.role.textContent = '';
            }
        }
    }

    function renderGuest(message) {
        lock();
        setState('guest');
        renderProfile(null);
        setText(MESSAGES.guestTitle, MESSAGES.guestText);
        setButtons({ login: true, retry: false, invite: false, logout: false, spinner: false });
        if (els.invite) els.invite.href = INVITE_FALLBACK;
        setStatus(message || '');
    }

    function renderVerifying(user) {
        lock();
        setState('verifying');
        renderProfile(user);
        setText('Comprobando tu acceso', 'Estamos validando tu cuenta de Discord y tu rango en <strong>' + GUILD_NAME + '</strong>.');
        setButtons({ login: false, retry: false, invite: false, logout: false, spinner: true });
        setStatus('Verificando membresía…');
    }

    function renderDenied(result) {
        const user = result && result.user ? result.user : null;
        lock();
        renderProfile(user);
        if (els.invite) els.invite.href = (result && result.inviteUrl) || INVITE_FALLBACK;

        if (result && result.state === 'expired') {
            setState('expired');
            setText(MESSAGES.expiredTitle, MESSAGES.expiredText);
            setButtons({ login: true, loginLabel: 'Volver a iniciar sesión', retry: false, invite: false, logout: true, spinner: false });
            setStatus('El token de Discord ya no es válido.');
            return;
        }

        if (result && result.state === 'not-discord') {
            setState('not-discord');
            setText(MESSAGES.notDiscordTitle, MESSAGES.notDiscordText);
            setButtons({ login: true, retry: false, invite: false, logout: true, spinner: false });
            setStatus('');
            return;
        }

        // not-member
        setState('denied');
        setText(MESSAGES.deniedTitle, MESSAGES.deniedText);
        setButtons({ login: false, retry: true, invite: true, logout: true, spinner: false });
        setStatus('No encontramos tu membresía en el servidor oficial.');
    }

    async function run(force, silent) {
        const auth = api();
        if (!auth || typeof auth.validateGuildAccess !== 'function') {
            // Nunca dejar al usuario encerrado si el motor de auth no cargó.
            console.warn('[AuthGate] DiscordAuth no disponible; se omite el bloqueo.');
            unlock();
            return;
        }
        if (busy) return;
        busy = true;

        const existingUser = auth.getUser ? auth.getUser() : null;
        const authError = typeof auth.consumeAuthError === 'function' ? auth.consumeAuthError() : null;
        // Si ya había una sesión válida, un "cancelar" no debe expulsar al usuario.
        const cancelled = Boolean(authError && authError.error === 'access_denied') && !existingUser;

        if (cancelled) {
            renderGuest('Cancelaste el inicio de sesión con Discord. Puedes intentarlo de nuevo.');
            busy = false;
            return;
        }

        const hashHasToken = /(?:^#|&)access_token=/.test(String(window.location.hash || ''));
        const hasStoredToken = Boolean(auth.getAccessToken && auth.getAccessToken());
        const shouldVerify = Boolean(existingUser) || hashHasToken || hasStoredToken;

        if (!silent) {
            if (shouldVerify) renderVerifying(existingUser);
            else renderGuest();
        }

        try {
            // El callback del hash ocurre dentro de discord-auth.js; esperarlo
            // garantiza que el gate evalúe la sesión recién creada.
            if (typeof auth.whenReady === 'function') {
                await auth.whenReady();
            }

            if (!shouldVerify && !(auth.getUser && auth.getUser())) {
                // Invitado sin callback: no hay nada que validar todavía.
                busy = false;
                return;
            }

            const result = await auth.validateGuildAccess({ force: Boolean(force) });

            if (result.state === 'member') {
                unlock();
                return;
            }

            if (result.state === 'error' || result.state === 'unverified') {
                // Fail-open: un fallo de red no debe bloquear la cuenta.
                console.warn('[AuthGate] Verificación no concluyente:', result.state, result.error || result.message || '');
                unlock();
                return;
            }

            if (result.state === 'no-session') {
                renderGuest();
                return;
            }

            renderDenied(result);
        } catch (err) {
            console.warn('[AuthGate] Error inesperado al validar:', err);
            unlock();
        } finally {
            busy = false;
        }
    }

    function bind() {
        window.__psAuthGateBound = true;
        // El motor de auth ya está activo: el failsafe inline de index.html no
        // debe retirar el overlay por su cuenta. Solo unlock() decide.
        window.__psAuthGateReady = true;

        if (els.avatar) {
            els.avatar.addEventListener('error', function () {
                this.src = 'recursos/PSGD.png';
            });
        }

        if (els.login) {
            els.login.addEventListener('click', function () {
                const auth = api();
                if (!auth || typeof auth.login !== 'function') return;
                setStatus('Redirigiendo a Discord…');
                els.login.disabled = true;
                Promise.resolve(auth.login()).catch(function () {
                    els.login.disabled = false;
                    setStatus('No se pudo abrir Discord. Intenta de nuevo.');
                });
            });
        }

        if (els.retry) {
            els.retry.addEventListener('click', function () {
                run(true, false);
            });
        }

        if (els.logout) {
            els.logout.addEventListener('click', async function () {
                const auth = api();
                if (auth && typeof auth.logout === 'function') {
                    try { await auth.logout(); } catch (e) { /* ignore */ }
                }
                renderGuest('Sesión cerrada. Inicia sesión con Discord para continuar.');
            });
        }

        document.addEventListener('discordAuthChanged', function (event) {
            const user = event && event.detail ? event.detail.user : null;

            if (!user) {
                if (!busy) renderGuest('Sesión cerrada. Inicia sesión con Discord para continuar.');
                return;
            }

            if (busy) return;
            // Si el gate ya estaba oculto, revalidar en silencio para no
            // interrumpir la navegación con un overlay innecesario.
            run(true, gate.hidden);
        });
    }

    bind();
    run(false, false);
})();
