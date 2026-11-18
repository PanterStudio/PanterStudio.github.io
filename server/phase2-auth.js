/**
 * FASE 2 — Autenticación real (backend + Firebase Auth).
 *
 * Problema que resuelve: el flujo OAuth implícito de Discord (Fase 1) entrega
 * un token en el hash y NO crea `request.auth` en Firestore. Por eso las reglas
 * no pueden saber quién escribe y cualquier cliente podría asignarse un rango.
 *
 * Este módulo mueve el secreto de Discord al servidor y emite un CUSTOM TOKEN
 * de Firebase Auth. El cliente lo canjea con signInWithCustomToken y a partir
 * de ahí TODAS las escrituras llevan `request.auth.uid` verificado.
 *
 * Flujo:
 *   /api/auth/config            → ¿Fase 2 activa? (sin secretos)
 *   /api/auth/discord/start     → genera `state` y redirige a Discord (code)
 *   /api/auth/discord/callback  → canjea code con client_secret, crea sesión
 *                                 firmada (cookie httpOnly) y custom token
 *   /api/auth/me                → sesión + custom token vigente
 *   /api/auth/logout            → cierra sesión
 *
 * Variables de entorno (NUNCA en el cliente ni en el repo):
 *   DISCORD_CLIENT_ID              (por defecto el ID público actual)
 *   DISCORD_CLIENT_SECRET          ← obligatorio para activar Fase 2
 *   DISCORD_REDIRECT_URI           ← debe estar registrada en el Developer Portal
 *   FIREBASE_SERVICE_ACCOUNT_JSON  ← JSON de la cuenta de servicio, o
 *   GOOGLE_APPLICATION_CREDENTIALS ← ruta al JSON (ADC)
 *   FIREBASE_PROJECT_ID            (por defecto nuestratierra-2bb4a)
 *   SESSION_SECRET                 ← firma HMAC de la cookie de sesión
 *   PHASE2_COOKIE_SECURE           ('0' para HTTP local)
 *
 * Si falta el secreto o firebase-admin, Fase 2 queda APAGADA y el cliente
 * sigue usando la Fase 1 exactamente igual: la web nunca se rompe.
 */

import crypto from 'crypto';
import express from 'express';

const DEFAULT_CLIENT_ID = '1484918737093005494';
const DEFAULT_PROJECT_ID = 'nuestratierra-2bb4a';
const DEFAULT_SCOPES = 'identify email guilds guilds.members.read';
const OFFICIAL_GUILD_ID = '1391998991108935772';
const COOKIE_NAME = 'ps_phase2_session';
const COOKIE_MAX_AGE = 7 * 24 * 3600 * 1000; // 7 días
const DISCORD_API = 'https://discord.com/api/v10';

function env(name) {
    return String(process.env[name] || '').trim();
}

function fase2Disponible() {
    return Boolean(env('DISCORD_CLIENT_SECRET')) &&
        Boolean(env('FIREBASE_SERVICE_ACCOUNT_JSON') || env('GOOGLE_APPLICATION_CREDENTIALS'));
}

function sessionSecret() {
    return env('SESSION_SECRET') || env('DISCORD_CLIENT_SECRET') || 'ps-phase2-dev-only';
}

function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
    return `${body}.${mac}`;
}

function verify(token) {
    if (!token || typeof token !== 'string') return null;
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const esperado = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
    const a = Buffer.from(mac);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!data || !data.exp || Date.now() > Number(data.exp)) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function parseCookies(header) {
    const out = {};
    String(header || '').split(';').forEach(part => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    });
    return out;
}

function cookieOptions(req) {
    // En producción (HTTPS) la cookie es Secure; en local se puede forzar a 0.
    const secure = env('PHASE2_COOKIE_SECURE') === '0'
        ? false
        : (req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https'));
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE
    };
}

function setSessionCookie(res, req, payload) {
    const exp = Date.now() + COOKIE_MAX_AGE;
    const token = sign(Object.assign({}, payload, { exp }));
    res.cookie(COOKIE_NAME, token, cookieOptions(req));
}

function readSession(req) {
    return verify(parseCookies(req.headers.cookie)[COOKIE_NAME]);
}

/** firebase-admin se carga de forma dinámica: si no está, Fase 2 se apaga. */
let adminPromise = null;
async function getAdminAuth() {
    if (!adminPromise) {
        adminPromise = (async () => {
            const admin = await import('firebase-admin');
            const mod = admin.default || admin;
            const json = env('FIREBASE_SERVICE_ACCOUNT_JSON');
            const projectId = env('FIREBASE_PROJECT_ID') || DEFAULT_PROJECT_ID;
            let credential;
            if (json) {
                credential = mod.credential.cert(JSON.parse(json));
            } else {
                // ADC (GOOGLE_APPLICATION_CREDENTIALS / metadata del servidor).
                credential = mod.credential.applicationDefault();
            }
            if (!mod.apps || !mod.apps.length) {
                mod.initializeApp({ credential, projectId });
            }
            return mod.auth();
        })().catch(err => {
            adminPromise = null;
            throw err;
        });
    }
    return adminPromise;
}

async function createCustomToken(uid, claims) {
    const auth = await getAdminAuth();
    return auth.createCustomToken(uid, claims || {});
}

/** Perfil de Discord → objeto de sesión unificado (mismo shape que Fase 1). */
function normalizeUser(raw) {
    const id = String(raw.id || '');
    const email = String(raw.email || '').trim().toLowerCase();
    const username = String(raw.username || '');
    const avatar = raw.avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${raw.avatar}.${String(raw.avatar).startsWith('a_') ? 'gif' : 'png'}?size=256`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    return {
        uid: `discord_${id}`,
        id,
        discordId: id,
        username,
        displayName: raw.global_name || username,
        globalName: raw.global_name || null,
        email,
        emailVerified: Boolean(email) && Boolean(raw.verified),
        discordUsername: username,
        discordDisplayName: raw.global_name || username,
        discordAvatarUrl: avatar,
        photoURL: avatar,
        avatarUrl: avatar,
        providerId: 'discord.com',
        phase2: true
    };
}

function redirectUri(req) {
    const configured = env('DISCORD_REDIRECT_URI');
    if (configured) return configured;
    const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http'));
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
    return `${proto}://${host}/api/auth/discord/callback`;
}

function safeReturn(value) {
    // Sólo rutas internas relativas: evita open redirect.
    const v = String(value || '/');
    if (/^\/(?!\/)/.test(v) && !/[\r\n]/.test(v)) return v;
    return '/';
}

/** Orígenes autorizados para el handshake (local + los que configures). */
function allowedOrigins() {
    const extra = env('PHASE2_ALLOWED_ORIGINS')
        .split(',').map(s => s.trim()).filter(Boolean);
    return new Set([
        'http://localhost', 'http://127.0.0.1',
        'https://panterstudio.lat', 'https://panterstudio.github.io',
        ...extra
    ]);
}

function originPermitido(origin) {
    if (!origin) return true; // mismo origen: no aplica CORS
    try {
        const u = new URL(origin);
        return allowedOrigins().has(`${u.protocol}//${u.hostname}`) ||
            allowedOrigins().has(origin);
    } catch (e) { return false; }
}

export function phase2Router() {
    const router = express.Router();

    // CORS para el sondeo /api/auth/config y /api/auth/me cuando la web y el
    // backend no comparten origen (desarrollo local o backend separado).
    router.use((req, res, next) => {
        const origin = String(req.headers.origin || '');
        if (origin && originPermitido(origin)) {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Access-Control-Allow-Credentials', 'true');
            res.set('Vary', 'Origin');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        }
        if (req.method === 'OPTIONS' && req.path.startsWith('/api/auth/')) {
            return res.status(204).end();
        }
        next();
    });

    router.get('/api/auth/config', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({
            phase2: fase2Disponible(),
            clientId: env('DISCORD_CLIENT_ID') || DEFAULT_CLIENT_ID,
            scopes: DEFAULT_SCOPES,
            redirectUri: fase2Disponible() ? redirectUri(req) : null
        });
    });

    router.get('/api/auth/discord/start', (req, res) => {
        if (!fase2Disponible()) return res.status(404).json({ error: 'Fase 2 no configurada' });
        const state = crypto.randomBytes(24).toString('base64url');
        const uri = redirectUri(req);
        // El `state` se guarda en cookie httpOnly para validarlo en el callback.
        setSessionCookie(res, req, { pending: true, state, retorno: safeReturn(req.query.return) });
        const params = new URLSearchParams({
            client_id: env('DISCORD_CLIENT_ID') || DEFAULT_CLIENT_ID,
            redirect_uri: uri,
            response_type: 'code',
            scope: DEFAULT_SCOPES,
            state,
            prompt: 'consent'
        });
        res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    router.get('/api/auth/discord/callback', async (req, res) => {
        if (!fase2Disponible()) return res.redirect('/');
        const pendiente = readSession(req) || {};
        const state = String(req.query.state || '');
        const code = String(req.query.code || '');
        const retorno = safeReturn(pendiente.retorno);

        if (!pendiente.pending || !pendiente.state || !state ||
            state !== pendiente.state || !code) {
            return res.redirect('/?auth_error=invalid_state');
        }

        try {
            // 1) Canje del code (el secreto NUNCA sale del servidor).
            const body = new URLSearchParams({
                client_id: env('DISCORD_CLIENT_ID') || DEFAULT_CLIENT_ID,
                client_secret: env('DISCORD_CLIENT_SECRET'),
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri(req)
            });
            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            if (!tokenRes.ok) throw new Error('Discord rechazó el código');
            const tokenData = await tokenRes.json();

            // 2) Perfil verificado desde el servidor (no confiable en cliente).
            const meRes = await fetch(`${DISCORD_API}/users/@me`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            if (!meRes.ok) throw new Error('No se pudo leer el perfil de Discord');
            const raw = await meRes.json();
            if (!raw.id) throw new Error('Perfil de Discord incompleto');

            const user = normalizeUser(raw);

            // 3) Pertenencia al servidor oficial, verificada EN EL SERVIDOR
            //    (antes esto lo hacía el cliente con el token a la vista).
            try {
                const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` }
                });
                if (guildsRes.ok) {
                    const guilds = await guildsRes.json();
                    user.discordGuildMember = Array.isArray(guilds) &&
                        guilds.some(g => String(g.id) === OFFICIAL_GUILD_ID);
                    user.discordMembershipChecked = true;
                }
            } catch (e) { /* sin dato: el gate decidirá con tolerancia */ }

            // 4) Custom token de Firebase → request.auth real en Firestore.
            const customToken = await createCustomToken(user.uid, {
                discordId: user.discordId,
                provider: 'discord.com',
                email: user.email || null
            });

            setSessionCookie(res, req, { user, customToken });
            res.redirect(retorno);
        } catch (err) {
            console.error('[Fase2] Error en callback:', err.message);
            res.redirect('/?auth_error=exchange_failed');
        }
    });

    router.get('/api/auth/me', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const session = readSession(req);
        if (!session || session.pending || !session.user) {
            return res.json({ authenticated: false, phase2: fase2Disponible() });
        }
        try {
            // Se re-emite en cada lectura: barato (firma local) y siempre vigente.
            const customToken = await createCustomToken(session.user.uid, {
                discordId: session.user.discordId,
                provider: 'discord.com',
                email: session.user.email || null
            });
            res.json({
                authenticated: true,
                phase2: true,
                user: session.user,
                customToken
            });
        } catch (err) {
            res.json({ authenticated: false, phase2: false, error: 'admin_no_disponible' });
        }
    });

    router.post('/api/auth/logout', (req, res) => {
        res.clearCookie(COOKIE_NAME, { path: '/' });
        res.json({ ok: true });
    });

    return router;
}

export function phase2Status() {
    return {
        enabled: fase2Disponible(),
        clientId: env('DISCORD_CLIENT_ID') || DEFAULT_CLIENT_ID,
        reason: fase2Disponible() ? null : 'Faltan DISCORD_CLIENT_SECRET y/o credenciales de Firebase Admin'
    };
}
