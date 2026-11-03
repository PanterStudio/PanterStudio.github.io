/* script.js - Lógica y efectos para Panter Studio Game Dev */

/* ===== CONFIGURACIÓN EMAILJS ===================================
   1. Crea tu cuenta gratis en https://www.emailjs.com
   2. Conecta tu servicio de correo (Gmail, Outlook, etc.)
   3. Crea una plantilla de correo (ver instrucciones abajo)
   4. Reemplaza los tres valores de abajo con tus credenciales
================================================================ */
const EMAILJS_PUBLIC_KEY  = 'iMeAQSEDDe8WDiiWV';
const EMAILJS_SERVICE_ID  = 'service_h9jiigs';
const EMAILJS_TEMPLATE_ID = 'template_2uro1hc';

/* Envía el correo de confirmación al usuario que se registró.
   Variables disponibles en tu plantilla EmailJS:
     {{to_email}}  → correo del usuario
     {{game_name}} → nombre del juego
     {{user_pos}}  → número de posición en la lista */
async function sendConfirmationEmail(userEmail, position) {
    if (typeof emailjs === 'undefined') return false;
    if (EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY') return false;
    try {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                to_email: userEmail,
                game_name: 'Nuestra Tierra Job Simulator',
                user_pos: position,
            }
        );
        return true;
    } catch (err) {
        console.warn('EmailJS error:', err);
        return false;
    }
}

function speakPreregistroSuccess(name = 'jugador') {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
        return;
    }

    const message = `Excelente, ${name}. Tu pre registro fue exitoso. Bienvenido a Panter Studio.`;
    const utterance = new window.SpeechSynthesisUtterance(message);
    utterance.lang = 'es-ES';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Cancela cualquier locucion anterior para evitar solapamiento.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

/* ===== MODAL PROMOCIONAL PRE-REGISTRO ===== */

const MAX_PREREGISTROS = 1000;
let preregistrosActuales = 0;
const ADMIN_EMAILS_LS_KEY = 'panterAdminEmails';
const FOUNDER_CEO_EMAIL = 'pantergamey@gmail.com';
const REFERRAL_STORAGE_KEY = 'panterPendingReferralCode';
const DEFAULT_REFERRAL_REWARD = 50;
const DEFAULT_ADMIN_EMAILS = [
    'pantergamey@gmail.com',
    'panterstudiogamedev@gmail.com'
];

function isCeoIdentifier(str) {
    if (!str) return false;
    const clean = String(str).trim().toLowerCase();
    return clean === 'pantergamey' || 
           clean === 'pantergameyt' || 
           clean === 'pantergamey@gmail.com' || 
           clean === 'ceo@panterstudio.lat' ||
           clean === 'admin@psgd.me';
}

function isCeoAccount(user, profile = null) {
    if (!user && !profile) return false;
    return isCeoIdentifier(user?.username) ||
           isCeoIdentifier(user?.displayName) ||
           isCeoIdentifier(user?.globalName) ||
           isCeoIdentifier(user?.global_name) ||
           isCeoIdentifier(user?.email) ||
           isCeoIdentifier(profile?.username) ||
           isCeoIdentifier(profile?.nombre_usuario) ||
           isCeoIdentifier(profile?.displayName) ||
           isCeoIdentifier(profile?.email) ||
           user?.role === 'founder_ceo' ||
           profile?.role === 'founder_ceo';
}

const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');

function toSitePath(path) {
    return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
}

function getRouteFilename(path) {
    return String(path || '').split('/').pop();
}

/* ===== SISTEMA DE NOMBRE DE USUARIO ===== */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;
const USERNAME_ADJ  = ['Veloz','Feroz','Astuto','Brillante','Salvaje','Sombrio','Rapido','Fuerte','Oscuro','Agil','Fiero','Noble'];
const USERNAME_NOUN = ['Pantera','Lobo','Aguila','Zorro','Leon','Tigre','Cobra','Halcon','Jaguar','Oso','Linx','Condor'];
let usernameModalShown = false;

function generateRandomUsername() {
    const adj  = USERNAME_ADJ[Math.floor(Math.random() * USERNAME_ADJ.length)];
    const noun = USERNAME_NOUN[Math.floor(Math.random() * USERNAME_NOUN.length)];
    const num  = Math.floor(Math.random() * 9000) + 1000;
    return adj + noun + num;
}

function generateSuggestions(base) {
    const clean = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) || 'Jugador';
    const results = [];
    const used = new Set([clean]);
    while (results.length < 4) {
        const n = Math.floor(Math.random() * 900) + 100;
        const c = clean + n;
        if (!used.has(c)) { used.add(c); results.push(c); }
    }
    results.push(clean + '_GG');
    return results;
}

async function isUsernameTaken(username, excludeUid = '') {
    if (!window.db || !window.getDocs || !window.query || !window.collection || !window.where) return false;
    const snap = await window.getDocs(
        window.query(window.collection(window.db, 'conductores'), window.where('username', '==', username))
    );
    return snap.docs.some((doc) => doc.id !== excludeUid);
}

async function resolveAvailableUsername(username, excludeUid = '') {
    const desired = String(username || '').trim();
    if (!desired) return { username: desired, changed: false };

    try {
        const taken = await isUsernameTaken(desired, excludeUid);
        if (!taken) return { username: desired, changed: false };

        const suggestions = generateSuggestions(desired);
        for (const suggestion of suggestions) {
            const suggestionTaken = await isUsernameTaken(suggestion, excludeUid);
            if (!suggestionTaken) {
                return { username: suggestion, changed: true };
            }
        }
    } catch (err) {
        console.warn('No se pudo verificar disponibilidad del nombre de usuario:', err);
    }

    const fallback = `${desired.slice(0, 18) || 'Jugador'}${Math.floor(Math.random() * 9000) + 1000}`.slice(0, 24);
    return { username: fallback, changed: fallback !== desired };
}

function normalizeReferralCode(code) {
    return String(code || '').replace(/\s+/g, '').trim().toUpperCase().slice(0, 32);
}

function setPendingReferralCode(code) {
    try {
        const normalized = normalizeReferralCode(code);
        if (normalized) {
            localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
            return normalized;
        }
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {}
    return '';
}

function getPendingReferralCode() {
    let urlCode = '';
    try {
        const params = new URLSearchParams(window.location.search);
        urlCode = normalizeReferralCode(
            params.get('ref') || params.get('invite') || params.get('invitation') || params.get('codigo') || ''
        );
    } catch {}

    if (urlCode) return setPendingReferralCode(urlCode);

    try {
        return normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY) || '');
    } catch {
        return '';
    }
}

function generateReferralCode(uid) {
    return String(uid || '').slice(0, 6).toUpperCase();
}

function isPermissionDeniedError(err) {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return code.includes('permission-denied') || message.includes('permission-denied');
}

async function findReferrerByCode(refCode) {
    const normalized = normalizeReferralCode(refCode);
    if (!normalized || !window.db || !window.getDocs || !window.collection) return null;

    try {
        const snap = await window.getDocs(window.collection(window.db, 'conductores'));
        const referrer = snap.docs.find((doc) => normalizeReferralCode(doc.data()?.referralCode) === normalized);
        return referrer || null;
    } catch (err) {
        console.warn('No se pudo validar el codigo de invitacion:', err);
        return null;
    }
}

async function applyReferralCode(refCode, newUserUid, currentProfile = null) {
    const normalized = normalizeReferralCode(refCode);
    if (!normalized) return { applied: false, reason: 'not-provided', reward: 0 };
    if (normalizeReferralCode(currentProfile?.referralCode) === normalized) {
        return { applied: false, reason: 'self', reward: 0 };
    }
    if (currentProfile?.referredBy) {
        return { applied: false, reason: 'already-linked', reward: 0 };
    }

    const referrer = await findReferrerByCode(normalized);
    if (!referrer) return { applied: false, reason: 'invalid', reward: 0 };
    if (referrer.id === newUserUid) return { applied: false, reason: 'self', reward: 0 };

    let reward = DEFAULT_REFERRAL_REWARD;
    try {
        if (window.db && window.fsDoc && window.getDoc) {
            const settingsSnap = await window.getDoc(window.fsDoc(window.db, 'settings', 'site'));
            if (settingsSnap.exists()) {
                const val = parseInt(settingsSnap.data().referralCoins, 10);
                if (!isNaN(val) && val > 0) reward = val;
            }
        }
    } catch(e) {
        console.warn('Could not load referralCoins setting:', e);
    }

    const referrerData = referrer.data() || {};
    await window.setDoc(window.fsDoc(window.db, 'conductores', referrer.id), {
        referralCount: Number(referrerData.referralCount || 0) + 1,
        referralCoins: Number(referrerData.referralCoins || 0) + reward,
        coins: Number(referrerData.coins || 0) + reward,
        saldo: Number(referrerData.saldo || referrerData.coins || 0) + reward,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // Try reading current profile coin balance to award the new user correctly
    const currentCoins = currentProfile ? (currentProfile.coins !== undefined ? currentProfile.coins : (currentProfile.saldo !== undefined ? currentProfile.saldo : 0)) : 0;
    await window.setDoc(window.fsDoc(window.db, 'conductores', newUserUid), {
        referredBy: normalized,
        coins: Number(currentCoins) + reward,
        saldo: Number(currentCoins) + reward,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    return { applied: true, reason: 'applied', reward };
}

/* ===== PERFIL LOCAL (respaldo cuando Firestore no está disponible) ===== */
const LOCAL_PROFILE_KEY = 'ps_local_profile';

function readLocalProfile() {
    try {
        const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : null;
    } catch (e) {
        return null;
    }
}

function writeLocalProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    try {
        localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.warn('[Username] No se pudo guardar el perfil local:', e);
    }
    return profile;
}

/**
 * Construye un usuario local por defecto para que el onboarding pueda
 * completarse aunque Firebase/Discord no expongan un usuario válido.
 */
function buildDefaultLocalUser(seed) {
    const stored = readLocalProfile();
    const authUser = (window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function')
        ? window.DiscordAuth.getUser()
        : null;
    const source = seed || authUser || stored || {};
    const fallbackId = `local_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const uid = String(source.uid || source.id || stored?.uid || fallbackId);
    const username = source.username || source.displayName || stored?.username || 'Jugador';
    return {
        uid,
        id: source.id || source.discordId || uid,
        username,
        displayName: source.displayName || source.globalName || username,
        email: source.email || stored?.email || '',
        photoURL: source.photoURL || source.avatarUrl || stored?.photoURL || 'recursos/PSGD.png',
        avatarUrl: source.avatarUrl || source.photoURL || stored?.avatarUrl || 'recursos/PSGD.png',
        role: source.role || stored?.role || 'viewer',
        isAdmin: Boolean(source.isAdmin || stored?.isAdmin),
        providerId: source.providerId || stored?.providerId || 'local',
        isLocalProfile: true
    };
}

/**
 * Usuario sobre el que se guarda el nombre elegido. Prioriza la sesión real
 * (Discord/Firebase) y cae a un objeto local por defecto si no hay ninguna.
 */
function resolveOnboardingUser() {
    const candidates = [];
    try { if (window.auth) candidates.push(window.auth.currentUser || window.auth); } catch (e) { /* ignore */ }
    try { if (window.firebaseAuth?.currentUser) candidates.push(window.firebaseAuth.currentUser); } catch (e) { /* ignore */ }
    try {
        if (window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function') {
            candidates.push(window.DiscordAuth.getUser());
        }
    } catch (e) { /* ignore */ }

    const stored = readLocalProfile();
    if (stored && (stored.uid || stored.username)) candidates.push(stored);

    const found = candidates.find((u) => u && (u.uid || u.id || u.discordId));
    if (found) {
        if (!found.uid) {
            found.uid = found.id ? String(found.id) : `discord_${found.discordId}`;
        }
        return found;
    }
    return buildDefaultLocalUser(null);
}

async function saveUserProfile(user, username, options = {}) {
    const safeUser = (user && (user.uid || user.id || user.discordId)) ? user : buildDefaultLocalUser(user);
    if (!safeUser.uid) {
        safeUser.uid = safeUser.id ? String(safeUser.id) : `discord_${safeUser.discordId}`;
    }

    const existingProfile = await getUserProfile(safeUser.uid, safeUser);
    const localProfile = readLocalProfile();
    const baseProfile = existingProfile
        || (localProfile && String(localProfile.uid) === String(safeUser.uid) ? localProfile : null);
    const email = String(safeUser.email || '').toLowerCase();
    const isFounder = isCeoAccount(safeUser, baseProfile) || isCeoIdentifier(username) || isCeoIdentifier(email);
    const now = new Date().toISOString();
    const pendingReferral = normalizeReferralCode(options.referralCode || getPendingReferralCode());
    const usernameResolution = await resolveAvailableUsername(
        username || baseProfile?.username || safeUser.displayName || safeUser.email?.split('@')[0] || 'Miembro',
        safeUser.uid
    );
    const finalUsername = isFounder && (isCeoIdentifier(username) || isCeoIdentifier(safeUser.displayName) || isCeoIdentifier(baseProfile?.username))
        ? (username || baseProfile?.username || safeUser.displayName || 'PanterGameY')
        : (usernameResolution.username || username);

    const profilePayload = {
        username: finalUsername,
        displayName: finalUsername,
        nombre_usuario: finalUsername,
        email: safeUser.email || baseProfile?.email || '',
        role: isFounder ? 'founder_ceo' : (baseProfile?.role || 'viewer'),
        isAdmin: isFounder ? true : (typeof baseProfile?.isAdmin === 'boolean' ? baseProfile.isAdmin : Boolean(safeUser.isAdmin)),
        referralCode: baseProfile?.referralCode || generateReferralCode(safeUser.uid),
        referredBy: baseProfile?.referredBy || null,
        coins: baseProfile?.coins !== undefined ? baseProfile.coins : 0,
        emeralds: baseProfile?.emeralds !== undefined ? baseProfile.emeralds : 0,
        level: baseProfile?.level || 'visitor',
        streak: baseProfile?.streak || 0,
        betaTesterRequest: baseProfile?.betaTesterRequest || false,
        createdAt: baseProfile?.createdAt || now,
        updatedAt: now
    };

    let persistedRemotely = false;
    if (window.db && window.fsDoc && window.setDoc) {
        try {
            await window.setDoc(
                window.fsDoc(window.db, 'conductores', safeUser.uid),
                profilePayload,
                { merge: true }
            );
            persistedRemotely = true;
        } catch (err) {
            console.warn('[Username] No se pudo guardar en Firestore; se usa respaldo local:', err);
        }
    } else {
        console.warn('[Username] Firestore no está disponible; se guarda el perfil en localStorage.');
    }

    // Respaldo local: garantiza que la sesión y el nombre persistan aunque
    // Firestore falle (permisos, red, modo offline).
    writeLocalProfile(Object.assign({
        uid: safeUser.uid,
        providerId: safeUser.providerId || 'local',
        pendingSync: !persistedRemotely
    }, profilePayload));

    if (window.updateProfile) {
        try {
            await window.updateProfile(safeUser, { displayName: finalUsername });
        } catch (e) { /* el usuario puede no ser de Firebase Auth */ }
    }

    let referralResult = { applied: false, reason: 'not-provided', reward: 0 };
    if (pendingReferral && !baseProfile?.referredBy) {
        try {
            referralResult = await applyReferralCode(pendingReferral, safeUser.uid, baseProfile);
        } catch (err) {
            console.warn('[Username] No se pudo aplicar el código de invitación:', err);
        }
    }
    if (pendingReferral) setPendingReferralCode('');
    return {
        ...referralResult,
        username: finalUsername,
        usernameChanged: finalUsername !== username,
        persistedRemotely
    };
}

async function getUserProfile(uid, userObj = null) {
    const storedProfile = readLocalProfile();
    const hasLocalProfile = Boolean(storedProfile && String(storedProfile.uid) === String(uid) && storedProfile.username);
    if (!window.db || !window.getDoc || !window.fsDoc || !uid) {
        return hasLocalProfile ? storedProfile : null;
    }
    try {
        const snap = await window.getDoc(window.fsDoc(window.db, 'conductores', uid));
        if (snap.exists()) return snap.data();

        // Reconciliación automática para cuentas previas de Google o Email
        const targetUser = userObj || (window.DiscordAuth ? window.DiscordAuth.getUser() : null);
        const email = targetUser?.email ? targetUser.email.toLowerCase().trim() : null;
        const discordTag = targetUser?.username ? targetUser.username.trim() : null;

        if (window.collection && window.getDocs && window.query && window.where) {
            // 1. Coincidencia por correo
            if (email && !email.endsWith('@discord.local')) {
                const qEmail = window.query(
                    window.collection(window.db, 'conductores'),
                    window.where('email', '==', email)
                );
                const snapEmail = await window.getDocs(qEmail);
                if (!snapEmail.empty) {
                    const legacyData = snapEmail.docs[0].data();
                    console.log('Cuenta previa vinculada por email:', snapEmail.docs[0].id);
                    await window.setDoc(window.fsDoc(window.db, 'conductores', uid), {
                        ...legacyData,
                        linkedLegacyUid: snapEmail.docs[0].id,
                        migratedAt: new Date().toISOString()
                    }, { merge: true });
                    return legacyData;
                }
            }

            // 2. Coincidencia por Discord Tag previo en postulaciones
            if (discordTag) {
                const qTag = window.query(
                    window.collection(window.db, 'conductores'),
                    window.where('betaTesterDiscord', '==', discordTag)
                );
                const snapTag = await window.getDocs(qTag);
                if (!snapTag.empty) {
                    const legacyData = snapTag.docs[0].data();
                    console.log('Cuenta previa vinculada por tag Discord:', snapTag.docs[0].id);
                    await window.setDoc(window.fsDoc(window.db, 'conductores', uid), {
                        ...legacyData,
                        linkedLegacyUid: snapTag.docs[0].id,
                        migratedAt: new Date().toISOString()
                    }, { merge: true });
                    return legacyData;
                }
            }
        }
    } catch (e) {
        console.warn('Error en getUserProfile:', e);
    }
    return hasLocalProfile ? storedProfile : null;
}



// Función para cerrar el modal promocional
function closePromoModal() {
    const modal = document.getElementById('preregistroModal');
    if (modal) {
        modal.classList.remove('active');
        modal.hidden = true;
        if (!document.getElementById('authModal')?.hidden || !document.getElementById('usernameModal')?.hidden) {
            return;
        }
        document.body.style.overflow = 'auto';
    }
}

// Función para ir a pre-registro
function goToPreregistro() {
    closePromoModal();
    window.location.href = toSitePath('pages/preregistro.html');
}

// Actualiza el bloque visual del modal usando cupos reales.
function updatePromoCapacityDisplay(totalRegistros) {
    const total = Math.max(0, Number(totalRegistros) || 0);
    const disponibles = Math.max(MAX_PREREGISTROS - total, 0);

    const registradosEl = document.getElementById('promoRegistrados');
    const cupoEl = document.getElementById('promoCupoTotal');
    const disponiblesEl = document.getElementById('promoDisponibles');
    const registrosElement = document.getElementById('promoRegistros');

    if (registradosEl) {
        registradosEl.textContent = String(total);
    }
    if (cupoEl) {
        cupoEl.textContent = String(MAX_PREREGISTROS);
    }
    if (disponiblesEl) {
        disponiblesEl.textContent = String(disponibles);
    }
    if (registrosElement) {
        registrosElement.textContent = String(total);
    }
}

/* ===== BASE DE DATOS LOCAL (localStorage) ===== */
// Cambiar a false para usar solo localStorage
const USE_FIREBASE = true;

const LS_KEY = 'panterRegistros';

function getRegistrosLS() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveRegistroLS(email) {
    const registros = getRegistrosLS();
    const emailNorm = email.trim().toLowerCase();
    if (registros.some(r => r.email === emailNorm)) {
        throw new Error('Email duplicado');
    }
    registros.push({ email: emailNorm, date: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(registros));
}

/* ===== CÓDIGO ORIGINAL ===== */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Panter Studio System: Online");
    try { getPendingReferralCode(); } catch(e) {}
    let userAuthInitialized = false;

    function getConfiguredAdminEmails() {
        const fromStorage = localStorage.getItem(ADMIN_EMAILS_LS_KEY) || '';
        const storageEmails = fromStorage
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);

        const defaultEmails = DEFAULT_ADMIN_EMAILS
            .map((email) => String(email || '').trim().toLowerCase())
            .filter(Boolean);

        return Array.from(new Set([...defaultEmails, ...storageEmails]));
    }

    function isAdminEmail(email) {
        if (!email) return false;
        const admins = getConfiguredAdminEmails();
        return admins.includes(String(email).toLowerCase());
    }

    function getRoleLabel(role) {
        if (window.PanterRoles) return window.PanterRoles.get(role).label;
        const labels = {
            founder_ceo: 'Fundador/CEO',
            administrador: 'Administrador',
            programador: 'Programador',
            modelador: 'Modelador',
            admin_general: 'Administrador',
            developer: 'Programador',
            modeler: 'Modelador',
            community_manager: 'Community',
            support_ops: 'Operaciones',
            youtuber: 'Youtuber',
            streamer: 'Streamer',
            vip: 'VIP',
            usuario: 'Usuario',
            viewer: 'Miembro'
        };
        return labels[role] || labels.viewer;
    }

    function normalizeAdminRole(role) {
        if (window.PanterRoles) return window.PanterRoles.normalize(role);
        const normalized = String(role || '').trim().toLowerCase();
        const aliases = {
            admin: 'administrador',
            admin_general: 'administrador',
            developer: 'programador',
            modeler: 'modelador',
            viewer: 'usuario'
        };
        return aliases[normalized] || normalized || 'usuario';
    }

    function canAccessAdminPanel(role) {
        if (window.PanterRoles) return window.PanterRoles.canAccessAdminPanel(role);
        const allowed = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);
        return allowed.has(normalizeAdminRole(role));
    }

    async function resolveAdminAccess(user) {
        if (!user) return { isAdmin: false, role: 'viewer' };

        if (window.PanterRoles) {
            if (user.discordAdmin || window.PanterRoles.isDiscordAdmin(user)) {
                return { isAdmin: true, role: 'admin_owner' };
            }
            const sessionRole = window.PanterRoles.normalize(user.role);
            if (window.PanterRoles.canAccessAdminPanel(sessionRole)) {
                return { isAdmin: true, role: sessionRole };
            }
        }

        if (isCeoAccount(user)) return { isAdmin: true, role: 'founder_ceo' };
        const email = String(user?.email || '').toLowerCase();

        try {
            const profile = await getUserProfile(user.uid, user);
            // El rango asignado en el Panel Admin (colección `equipo`) manda.
            let teamMember = null;
            if (window.db && window.fsDoc && window.getDoc) {
                try {
                    const teamSnap = await window.getDoc(window.fsDoc(window.db, 'equipo', user.uid));
                    if (teamSnap.exists()) teamMember = teamSnap.data() || null;
                } catch (e) { /* roster no disponible */ }
            }
            const effectiveProfile = teamMember && teamMember.archivado !== true && teamMember.role
                ? { ...profile, teamRole: teamMember.role }
                : profile;
            if (isCeoAccount(user, effectiveProfile)) return { isAdmin: true, role: 'founder_ceo' };
            let role = window.PanterRoles
                ? window.PanterRoles.resolveRole(user, effectiveProfile)
                : normalizeAdminRole(profile?.role || (isAdminEmail(email) ? 'administrador' : 'usuario'));

            if (window.PanterRoles) {
                if (window.PanterRoles.hasAdminPermission) {
                    if (window.PanterRoles.hasAdminPermission(user)) role = 'admin_owner';
                }
                if (profile?.isAdmin === true && role === 'usuario') role = 'administrador';
                if (isAdminEmail(email) && !window.PanterRoles.canAccessAdminPanel(role)) role = 'administrador';
                return { isAdmin: window.PanterRoles.canAccessAdminPanel(role), role };
            }

            if (profile?.isAdmin === true && (!profile?.role || role === 'usuario')) {
                role = 'administrador';
            }
            if (isAdminEmail(email) && !canAccessAdminPanel(role)) {
                role = 'administrador';
            }
            const isAdmin = canAccessAdminPanel(role);
            return { isAdmin, role };
        } catch {
            const role = isAdminEmail(email) ? 'administrador' : 'usuario';
            return { isAdmin: canAccessAdminPanel(role), role };
        }
    }

    function getAuthErrorMessage(err) {
        const code = err?.code || '';
        const map = {
            'auth/operation-not-allowed': 'Esta accion no esta habilitada en Firebase. Activa el metodo correspondiente (Google o Email/Password).',
            'auth/unauthorized-domain': 'Este dominio no esta autorizado en Firebase Authentication.',
            'auth/popup-blocked': 'El navegador bloqueo la ventana emergente. Permite popups para este sitio.',
            'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar el acceso.',
            'auth/invalid-credential': 'Credenciales invalidas. Intenta nuevamente.',
            'auth/user-not-found': 'No existe una cuenta con ese correo.',
            'auth/wrong-password': 'Contrasena incorrecta.',
            'auth/invalid-email': 'El correo no tiene un formato valido.',
            'auth/email-already-in-use': 'Este correo ya esta registrado.',
            'auth/weak-password': 'La contrasena es muy debil. Usa al menos 6 caracteres.',
            'auth/network-request-failed': 'Error de red. Revisa tu conexion e intenta de nuevo.',
            'permission-denied': 'Firestore rechazo la operacion. Revisa las reglas para la coleccion conductores y que el usuario autenticado pueda crear su propio perfil.'
        };

        const message = map[code] || 'No fue posible completar la autenticacion.';
        return code ? `${message} (${code})` : message;
    }

    async function waitForFirebaseAuth(timeout = 8000) {
        return new Promise((resolve) => {
            const isReady = () => Boolean(window.auth)
                && typeof window.onAuthStateChanged === 'function'
                && typeof window.getRedirectResult === 'function';
            if (isReady()) {
                return resolve(true);
            }
            const start = Date.now();
            const timer = setInterval(() => {
                if (isReady()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(timer);
                    resolve(Boolean(window.auth) && typeof window.onAuthStateChanged === 'function');
                }
            }, 100);
        });
    }

    function setupUnifiedNavRight() {
        const nav = document.querySelector('nav');
        if (!nav) return;

        const navLeft = nav.querySelector('.nav-left');
        if (navLeft && !navLeft.querySelector('#navBrandAvatarLink')) {
            const perfilPath = toSitePath('pages/perfil.html');
            const avatarLink = document.createElement('a');
            avatarLink.href = perfilPath;
            avatarLink.id = 'navBrandAvatarLink';
            avatarLink.className = 'nav-brand-avatar-link';
            avatarLink.title = 'Mi Perfil';
            avatarLink.style.display = 'none';
            avatarLink.setAttribute('aria-label', 'Acceder a Mi Perfil');
            avatarLink.innerHTML = `<img id="navBrandAvatarImg" src="https://cdn.discordapp.com/embed/avatars/0.png" alt="Mi Perfil" class="nav-brand-avatar-img">`;
            navLeft.appendChild(avatarLink);
        }

        let navRight = nav.querySelector('.nav-right');
        if (!navRight) {
            navRight = document.createElement('div');
            navRight.className = 'nav-right';
            const hamburger = nav.querySelector('.nav-hamburger');
            if (hamburger) nav.insertBefore(navRight, hamburger);
            else nav.appendChild(navRight);
        }

        if (!navRight.querySelector('#navUserDropdown') && !navRight.querySelector('#navLoginBtn')) {
            const perfilPath = toSitePath('pages/perfil.html');
            const soportePath = toSitePath('pages/soporte.html');
            const adminPath = toSitePath('pages/admin/admin.html');

            navRight.innerHTML = `
                <button type="button" class="btn-nav-login" id="navLoginBtn" data-open-auth-modal="true">
                    <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a74.77,74.77,0,0,0,64.3,0c.87.69,1.76,1.37,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c2.82-27.28-7.3-51-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>
                    <span>Ingresar</span>
                </button>
                <div class="nav-user-dropdown" id="navUserDropdown" style="display:none;">
                    <button type="button" class="nav-user-pill" id="navUserPillBtn" aria-haspopup="true">
                        <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="Avatar" class="nav-user-avatar" id="navUserAvatar">
                        <span class="nav-user-name" id="navUserName" data-auth-user-label="true">Usuario</span>
                        <span class="auth-role-badge" id="navUserRoleBadge" data-auth-role-badge="true" hidden>ADMIN</span>
                        <span class="nav-user-chevron">▼</span>
                    </button>
                    <div class="nav-user-menu" id="navUserMenu">
                        <div class="nav-user-menu-header">
                            <div class="menu-uname" id="navMenuUname">Usuario</div>
                            <div class="menu-uemail" id="navMenuUemail">Conectado con Discord</div>
                        </div>
                        <a href="${perfilPath}"><i class="fa-solid fa-user" aria-hidden="true"></i> Mi Perfil</a>
                        <a href="${soportePath}"><i class="fa-solid fa-ticket" aria-hidden="true"></i> Mis Tickets</a>
                        <a href="${adminPath}" id="navMenuAdminLink" style="display:none;"><i class="fa-solid fa-gear" aria-hidden="true"></i> Panel Admin</a>
                        <button type="button" class="btn-logout-link" data-auth-logout="true"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cerrar Sesión</button>
                    </div>
                </div>
            `;

            const pillBtn = navRight.querySelector('#navUserPillBtn');
            const dropdown = navRight.querySelector('#navUserDropdown');
            if (pillBtn && dropdown) {
                pillBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('open');
                });
            }

            document.addEventListener('click', (e) => {
                if (dropdown && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('open');
                }
            });
        }
    }

    async function updateAuthUi(user) {
        setupUnifiedNavRight();

        const email = user?.email || '';
        const displayName = user?.displayName || user?.username || (email ? email.split('@')[0] : '');
        const avatarUrl = user?.photoURL || user?.avatarUrl || (user?.id ? (window.DiscordAuth ? window.DiscordAuth.getAvatarUrl(user) : '') : 'https://cdn.discordapp.com/embed/avatars/0.png');
        const { isAdmin, role } = user ? await resolveAdminAccess(user) : { isAdmin: false, role: 'viewer' };

        const navLoginBtn = document.getElementById('navLoginBtn');
        const navUserDropdown = document.getElementById('navUserDropdown');
        const navUserAvatar = document.getElementById('navUserAvatar');
        const navUserName = document.getElementById('navUserName');
        const navMenuUname = document.getElementById('navMenuUname');
        const navMenuUemail = document.getElementById('navMenuUemail');
        const navUserRoleBadge = document.getElementById('navUserRoleBadge');
        const navMenuAdminLink = document.getElementById('navMenuAdminLink');
        const adminNavLink = document.getElementById('adminNavLink');
        const adminSideLink = document.getElementById('adminPanelSideLink');
        const navBrandAvatarLink = document.getElementById('navBrandAvatarLink');
        const navBrandAvatarImg = document.getElementById('navBrandAvatarImg');

        if (user) {
            const authText = displayName || 'Usuario Discord';
            if (navBrandAvatarLink) {
                navBrandAvatarLink.style.display = 'inline-flex';
                navBrandAvatarLink.title = `Mi Perfil (${authText})`;
            }
            if (navBrandAvatarImg && avatarUrl) {
                navBrandAvatarImg.src = avatarUrl;
            }
            if (navLoginBtn) navLoginBtn.style.display = 'none';
            if (navUserDropdown) navUserDropdown.style.display = 'inline-block';
            if (navUserAvatar && avatarUrl) navUserAvatar.src = avatarUrl;
            if (navUserName) navUserName.textContent = authText;
            if (navMenuUname) navMenuUname.textContent = authText;
            if (navMenuUemail) navMenuUemail.textContent = email || 'Sesión activa';

            if (navUserRoleBadge) {
                navUserRoleBadge.hidden = false;
                navUserRoleBadge.className = 'auth-role-badge ps-role-badge-host';
                navUserRoleBadge.innerHTML = window.PanterRoles
                    ? window.PanterRoles.badgeHtml(role, { className: 'ps-role-badge-nav' })
                    : getRoleLabel(role).toUpperCase();
            }
            if (navMenuAdminLink) {
                navMenuAdminLink.style.display = isAdmin ? 'flex' : 'none';
            }

            document.querySelectorAll('[data-auth-user-label]').forEach(label => {
                if (label !== navUserName) label.textContent = authText;
            });
            document.querySelectorAll('[data-open-auth-modal]').forEach(b => {
                if (b !== navLoginBtn) b.hidden = true;
            });
            document.querySelectorAll('[data-auth-logout]').forEach(b => {
                b.hidden = false;
            });
            document.querySelectorAll('[data-auth-signal-dot]').forEach(dot => {
                dot.classList.remove('auth-signal-guest', 'auth-signal-online', 'auth-signal-admin', 'auth-signal-logged');
                dot.classList.add(isAdmin ? 'auth-signal-admin' : 'auth-signal-online');
            });
            document.querySelectorAll('[data-auth-signal-text]').forEach(label => {
                label.textContent = isAdmin ? 'Conectado (Admin)' : 'Conectado';
            });
            document.querySelectorAll('[data-auth-role-badge]').forEach(badge => {
                if (badge !== navUserRoleBadge) {
                    badge.hidden = false;
                    badge.className = 'auth-role-badge ps-role-badge-host';
                    badge.innerHTML = window.PanterRoles
                        ? window.PanterRoles.badgeHtml(role)
                        : getRoleLabel(role).toUpperCase();
                }
            });
        } else {
            if (navBrandAvatarLink) {
                navBrandAvatarLink.style.display = 'none';
            }
            if (navLoginBtn) navLoginBtn.style.display = 'inline-flex';
            if (navUserDropdown) {
                navUserDropdown.style.display = 'none';
                navUserDropdown.classList.remove('open');
            }
            document.querySelectorAll('[data-auth-user-label]').forEach(label => {
                label.textContent = 'Invitado';
            });
            document.querySelectorAll('[data-open-auth-modal]').forEach(b => {
                if (b !== navLoginBtn) { b.hidden = false; b.disabled = false; }
            });
            document.querySelectorAll('[data-auth-logout]').forEach(b => {
                b.hidden = true;
            });
            document.querySelectorAll('[data-auth-signal-dot]').forEach(dot => {
                dot.classList.remove('auth-signal-online', 'auth-signal-admin', 'auth-signal-logged');
                dot.classList.add('auth-signal-guest');
            });
            document.querySelectorAll('[data-auth-signal-text]').forEach(label => {
                label.textContent = 'Invitado';
            });
            document.querySelectorAll('[data-auth-role-badge]').forEach(badge => {
                badge.hidden = true;
            });
        }

        if (adminNavLink) adminNavLink.hidden = !isAdmin;
        if (adminSideLink) adminSideLink.hidden = !isAdmin;
    }

    function setupAuthModal() {
        const modal = document.getElementById('authModal');
        const closeBtn = document.getElementById('authModalCloseBtn');
        const loginOpenBtns = Array.from(document.querySelectorAll('[data-open-auth-modal]'));
        const tabRegister = document.getElementById('authTabRegister');
        const tabLogin = document.getElementById('authTabLogin');
        const registerForm = document.getElementById('authRegisterForm');
        const loginForm = document.getElementById('authLoginForm');
        const message = document.getElementById('authModalMessage');

        if (!modal || !loginOpenBtns.length || !tabRegister || !tabLogin || !registerForm || !loginForm || !message) return;

        function setMode(mode) {
            const isRegister = mode === 'register';
            tabRegister.classList.toggle('active', isRegister);
            tabLogin.classList.toggle('active', !isRegister);
            registerForm.hidden = !isRegister;
            loginForm.hidden = isRegister;
            message.textContent = '';
        }

        function openModal() {
            setMode('login');
            message.textContent = '';
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            modal.hidden = true;
            if (!document.getElementById('preregistroModal')?.classList.contains('active')) {
                document.body.style.overflow = 'auto';
            }
        }

        loginOpenBtns.forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                openModal();
            });
        });
        tabRegister.addEventListener('click', () => setMode('register'));
        tabLogin.addEventListener('click', () => setMode('login'));

        modal.addEventListener('click', (event) => {
            const closeByOverlay = event.target instanceof HTMLElement && event.target.dataset.authClose === 'true';
            if (closeByOverlay) closeModal();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        modal.dataset.closeAuthModal = 'true';
    }

    async function setupUserAuth() {
        if (userAuthInitialized) return;
        userAuthInitialized = true;
        const modal = document.getElementById('authModal');
        const registerForm = document.getElementById('authRegisterForm');
        const loginForm = document.getElementById('authLoginForm');
        const message = document.getElementById('authModalMessage');
        const googleBtn = document.getElementById('googleAuthModalBtn');
        const discordBtn = document.getElementById('discordAuthModalBtn');
        const logoutBtns = Array.from(document.querySelectorAll('[data-auth-logout]'));
        let authObserverBound = false;

        const ensureAuthReady = async (showUserHint = false) => {
            const authReady = await waitForFirebaseAuth();
            if (!authReady) {
                const hint = 'Firebase Auth aun no esta listo. Recarga la pagina e intenta nuevamente.';
                if (showUserHint) {
                    message.textContent = hint;
                }
                return false;
            }

            if (!authObserverBound) {
                if (typeof window.getRedirectResult === 'function') {
                    try {
                        await window.getRedirectResult(window.auth);
                    } catch (err) {
                        console.error('Error recuperando redirect de Google:', err);
                    }
                } else {
                    console.warn('getRedirectResult aún no está disponible; se omite.');
                }

                if (typeof window.onAuthStateChanged !== 'function') {
                    console.warn('Firebase Auth aún no está listo para observar el estado.');
                    return false;
                }

                window.onAuthStateChanged(window.auth, async (user) => {
                    updateAuthUi(user || null);
                    if (user) {
                        try {
                            const profile = await getUserProfile(user.uid);
                            if (!profile?.username) {
                                await showUsernameModal(user);
                            }
                        } catch (e) {
                            console.warn('No se pudo verificar perfil:', e);
                        }
                    } else {
                        usernameModalShown = false;
                    }
                });
                authObserverBound = true;
            }

            return true;
        };

        ensureAuthReady(false);

        registerForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!(await ensureAuthReady(true))) return;
            const emailInput = document.getElementById('authRegisterEmail');
            const passInput = document.getElementById('authRegisterPassword');
            const referralInput = document.getElementById('authRegisterReferral');
            const email = emailInput?.value.trim() || '';
            const password = passInput?.value || '';
            const referralCode = normalizeReferralCode(referralInput?.value || getPendingReferralCode());

            try {
                message.textContent = 'Creando cuenta...';
                const credential = await window.createUserWithEmailAndPassword(window.auth, email, password);
                let canCloseModal = true;
                if (credential?.user) {
                    const generatedUsername = String(email || '').split('@')[0] || 'Jugador';
                    try {
                        const referralResult = await saveUserProfile(credential.user, generatedUsername, { referralCode });
                        const usernameNotice = referralResult.usernameChanged
                            ? ` Tu nombre final es ${referralResult.username}.`
                            : '';
                        if (referralResult.reason === 'invalid') {
                            message.textContent = `Cuenta creada. El codigo de invitacion no existe, asi que no se aplico.${usernameNotice}`;
                        } else if (referralResult.reason === 'self') {
                            message.textContent = `Cuenta creada. No puedes usar tu propio codigo de invitacion.${usernameNotice}`;
                        } else if (referralResult.applied) {
                            message.textContent = `¡Cuenta creada! Codigo aplicado correctamente. +${referralResult.reward} para quien te invito.${usernameNotice}`;
                        } else {
                            message.textContent = `¡Cuenta creada! Bienvenido.${usernameNotice}`;
                        }
                    } catch (profileErr) {
                        if (isPermissionDeniedError(profileErr)) {
                            canCloseModal = false;
                            message.textContent = 'La cuenta SI se creo en Authentication, pero Firestore bloqueo crear el perfil (permission-denied). Inicia sesion y ajusta reglas de la coleccion conductores.';
                        } else {
                            throw profileErr;
                        }
                    }
                }
                registerForm.reset();
                if (canCloseModal) {
                    if (modal) modal.hidden = true;
                    document.body.style.overflow = 'auto';
                }
            } catch (err) {
                console.error('Error en registro:', err);
                message.textContent = `Error: ${getAuthErrorMessage(err)}`;
            }
        });

        loginForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!(await ensureAuthReady(true))) return;
            const emailInput = document.getElementById('authLoginEmail');
            const passInput = document.getElementById('authLoginPassword');
            const email = emailInput?.value.trim() || '';
            const password = passInput?.value || '';

            if (isCeoIdentifier(email) && window.DiscordAuth?.loginWithEmail) {
                try {
                    message.textContent = 'Iniciando sesión como CEO...';
                    const u = await window.DiscordAuth.loginWithEmail(email, password);
                    message.textContent = `¡Bienvenido CEO ${u.displayName}!`;
                    loginForm.reset();
                    if (modal) {
                        setTimeout(() => { modal.hidden = true; document.body.style.overflow = 'auto'; }, 600);
                    }
                    return;
                } catch(e) {
                    console.warn('Error en login CEO:', e);
                }
            }

            try {
                message.textContent = 'Ingresando...';
                await window.signInWithEmailAndPassword(window.auth, email, password);
                message.textContent = 'Sesion iniciada.';
                loginForm.reset();
                if (modal) modal.hidden = true;
                document.body.style.overflow = 'auto';
            } catch (err) {
                console.error('Error en login:', err);
                if (isCeoIdentifier(email) && window.DiscordAuth?.loginWithEmail) {
                    const u = await window.DiscordAuth.loginWithEmail(email, password);
                    message.textContent = `¡Bienvenido CEO ${u.displayName}!`;
                    loginForm.reset();
                    if (modal) {
                        setTimeout(() => { modal.hidden = true; document.body.style.overflow = 'auto'; }, 600);
                    }
                    return;
                }
                message.textContent = `Error: ${getAuthErrorMessage(err)}`;
            }
        });

        const startGoogleSignIn = async (useModalMessage = false) => {
            if (!(await ensureAuthReady(useModalMessage))) {
                if (!useModalMessage) alert('Firebase Auth aun no esta listo. Recarga la pagina e intenta nuevamente.');
                return;
            }
            try {
                if (useModalMessage) message.textContent = 'Conectando con Google...';
                const provider = new window.GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                if (useModalMessage) message.textContent = 'Iniciando sesión...';
                await window.signInWithPopup(window.auth, provider);
            } catch (err) {
                console.error('Error en login con Google:', err);
                if (useModalMessage) message.textContent = `Error: ${getAuthErrorMessage(err)}`;
                else alert(getAuthErrorMessage(err));
            }
        };

        const startDiscordSignIn = async (useModalMessage = false) => {
            if (!(await ensureAuthReady(useModalMessage))) {
                if (!useModalMessage) alert('Firebase Auth aún no está listo. Recarga la página e intenta nuevamente.');
                return;
            }
            try {
                if (useModalMessage) message.textContent = 'Conectando con Discord...';
                let provider;
                if (window.OAuthProvider) {
                    provider = new window.OAuthProvider('discord.com');
                } else {
                    provider = new window.GoogleAuthProvider();
                }
                if (useModalMessage) message.textContent = 'Iniciando sesión con Discord...';
                await window.signInWithPopup(window.auth, provider);
            } catch (err) {
                console.error('Error en login con Discord:', err);
                // Fallback to Google auth if custom OAuth provider is not configured in Firebase console yet
                if (err?.code === 'auth/operation-not-allowed' || err?.code === 'auth/invalid-provider-id') {
                    if (useModalMessage) message.textContent = 'Iniciando con cuenta de Google/Discord...';
                    const googleProv = new window.GoogleAuthProvider();
                    await window.signInWithPopup(window.auth, googleProv);
                } else {
                    if (useModalMessage) message.textContent = `Error: ${getAuthErrorMessage(err)}`;
                    else alert(getAuthErrorMessage(err));
                }
            }
        };

        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                await startGoogleSignIn(true);
            });
        }

        if (discordBtn) {
            discordBtn.addEventListener('click', async () => {
                await startDiscordSignIn(true);
            });
        }

        logoutBtns.forEach((button) => {
            button.addEventListener('click', async () => {
                if (!(await ensureAuthReady(false))) return;
                try {
                    await window.signOut(window.auth);
                } catch (err) {
                    console.error('Error al cerrar sesion:', err);
                }
            });
        });
    }

    window.fillLoginCredentials = function(email, password) {
        const emailInputs = Array.from(document.querySelectorAll('#authLoginEmail, #perfilLoginEmail, #loginEmail'));
        const passInputs = Array.from(document.querySelectorAll('#authLoginPassword, #perfilLoginPassword, #loginPassword'));
        emailInputs.forEach(el => { el.value = email; });
        passInputs.forEach(el => { el.value = password; });
    };

    document.addEventListener('submit', async (e) => {
        const form = e.target.closest('#authLoginForm, #perfilLoginForm');
        if (!form) return;
        e.preventDefault();
        const emailEl = form.querySelector('input[type="email"], input[type="text"]');
        const passEl = form.querySelector('input[type="password"]');
        const email = emailEl?.value || '';
        const password = passEl?.value || '';
        const msgEl = document.getElementById('authModalMessage') || document.getElementById('authMessage');

        try {
            if (msgEl) msgEl.textContent = 'Iniciando sesión...';
            if (window.DiscordAuth?.loginWithEmail) {
                const user = await window.DiscordAuth.loginWithEmail(email, password);
                if (msgEl) msgEl.textContent = `¡Bienvenido, ${user.displayName}!`;
                const modal = document.getElementById('authModal');
                if (modal) {
                    setTimeout(() => { modal.hidden = true; document.body.style.overflow = 'auto'; }, 600);
                }
            }
        } catch(err) {
            console.error('Error al iniciar sesión:', err);
            if (msgEl) msgEl.textContent = `Error: ${err.message || 'No se pudo iniciar sesión'}`;
        }
    });
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#discordAuthModalBtn, #discordAuthBtn, [data-auth-discord]');
        if (!btn) return;
        e.preventDefault();
        const msgEl = document.getElementById('authModalMessage') || document.getElementById('authMessage');
        try {
            if (msgEl) msgEl.textContent = 'Conectando con Discord...';
            if (!window.DiscordAuth) {
                if (msgEl) msgEl.textContent = 'Sistema de autenticación cargando... Reintenta.';
                return;
            }
            if (msgEl) msgEl.textContent = 'Redirigiendo a Discord OAuth 2.0...';
            user = await window.DiscordAuth.login();
            if (user) {
                if (msgEl) msgEl.textContent = `¡Bienvenido, ${user.displayName || user.username || 'Usuario'}!`;
                const modal = document.getElementById('authModal');
                if (modal) {
                    setTimeout(() => { modal.hidden = true; document.body.style.overflow = 'auto'; }, 800);
                }
            }
        } catch (err) {
            console.error('Error en login con Discord:', err);
            if (msgEl) msgEl.textContent = `Error: ${err.message || 'No se pudo completar el login'}`;
        }
    });

    function setupUsernameModal() {
        const modal = document.getElementById('usernameModal');
        if (!modal) return;
        const input      = document.getElementById('usernameInput');
        const randomBtn  = document.getElementById('usernameRandomBtn');
        const confirmBtn = document.getElementById('usernameConfirmBtn');
        const statusEl   = document.getElementById('usernameStatus');
        const suggBox    = document.getElementById('usernameSuggestions');
        const suggRow    = document.getElementById('usernameSuggestionsRow');
        if (!input || !randomBtn || !confirmBtn || !statusEl || !suggBox || !suggRow) return;

        let checkTimer  = null;
        let lastChecked = '';
        let isAvailable = false;

        function setStatus(text, type) {
            statusEl.innerHTML = text;
            statusEl.className   = 'username-status' + (type ? ' username-status--' + type : '');
        }

        function renderSuggestions(names) {
            suggRow.innerHTML = '';
            if (!names || names.length === 0) { suggBox.hidden = true; return; }
            names.forEach(name => {
                const chip = document.createElement('button');
                chip.type      = 'button';
                chip.className = 'username-suggest-chip';
                chip.textContent = name;
                chip.addEventListener('click', () => {
                    input.value = name;
                    suggBox.hidden = true;
                    clearTimeout(checkTimer);
                    triggerCheck(name);
                });
                suggRow.appendChild(chip);
            });
            suggBox.hidden = false;
        }

        async function triggerCheck(value) {
            const clean = value.trim();
            lastChecked  = clean;
            confirmBtn.disabled = true;
            isAvailable  = false;
            if (!clean) { setStatus('', ''); suggBox.hidden = true; return; }
            if (!USERNAME_REGEX.test(clean)) {
                setStatus('Solo letras, números y guión bajo (3–24 caracteres).', 'error');
                suggBox.hidden = true;
                return;
            }
            setStatus('Verificando...', 'checking');
            try {
                const taken = await isUsernameTaken(clean);
                if (lastChecked !== clean) return;
                if (taken) {
                    setStatus('"' + clean + '" ya está en uso.', 'error');
                    renderSuggestions(generateSuggestions(clean));
                } else {
                    setStatus('¡Disponible! <i class="fa-solid fa-check" aria-hidden="true"></i>', 'ok');
                    suggBox.hidden = true;
                    confirmBtn.disabled = false;
                    isAvailable = true;
                }
            } catch {
                setStatus('No se pudo verificar. Intenta de nuevo.', 'error');
            }
        }

        input.addEventListener('input', () => {
            clearTimeout(checkTimer);
            confirmBtn.disabled = true;
            isAvailable = false;
            const v = input.value;
            if (!v.trim()) { setStatus('', ''); suggBox.hidden = true; return; }
            setStatus('Verificando...', 'checking');
            checkTimer = setTimeout(() => triggerCheck(v), 600);
        });

        randomBtn.addEventListener('click', () => {
            const name = generateRandomUsername();
            input.value = name;
            clearTimeout(checkTimer);
            checkTimer = setTimeout(() => triggerCheck(name), 300);
        });

        confirmBtn.addEventListener('click', async () => {
            if (!isAvailable || !lastChecked) return;
            if (confirmBtn.dataset.saving === 'true') return;
            confirmBtn.dataset.saving = 'true';
            confirmBtn.disabled = true;
            setStatus('Guardando...', 'checking');

            const user = resolveOnboardingUser();
            let finalName = lastChecked;
            let persistedRemotely = false;

            try {
                const result = await saveUserProfile(user, lastChecked);
                if (result && result.username) finalName = result.username;
                persistedRemotely = Boolean(result && result.persistedRemotely);
            } catch (err) {
                // Respaldo final: el nombre queda guardado en localStorage para
                // que la sesión continúe aunque Firestore falle.
                console.warn('[Username] Error al guardar el perfil; se usa respaldo local:', err);
                writeLocalProfile({
                    uid: user.uid,
                    username: lastChecked,
                    displayName: lastChecked,
                    nombre_usuario: lastChecked,
                    email: user.email || '',
                    role: user.role || 'viewer',
                    isAdmin: Boolean(user.isAdmin),
                    providerId: user.providerId || 'local',
                    coins: 0,
                    emeralds: 0,
                    level: 'visitor',
                    streak: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    pendingSync: true
                });
            }

            // Cerrar el onboarding siempre: el usuario pasa a la vista principal
            // sin quedarse congelado esperando a la red.
            usernameModalShown = true;
            modal.hidden = true;
            document.body.style.overflow = 'auto';
            setStatus('', '');
            delete confirmBtn.dataset.saving;

            if (window.PanterRoles && typeof window.PanterRoles.refresh === 'function') {
                try { window.PanterRoles.refresh(); } catch (e) { /* ignore */ }
            }

            // Refleja el nombre elegido en la barra de sesión aunque el usuario
            // de Discord conserve su displayName original.
            const displayUser = Object.assign({}, user, {
                displayName: finalName,
                username: user.username || finalName
            });

            try {
                await updateAuthUi(displayUser);
            } catch (err) {
                console.warn('[Username] No se pudo refrescar la barra de sesión:', err);
            }

            document.dispatchEvent(new CustomEvent('ps:username-confirmed', {
                detail: { user: displayUser, username: finalName, persistedRemotely }
            }));
        });
    }

    async function showUsernameModal(user) {
        if (usernameModalShown) return;
        usernameModalShown = true;
        closePromoModal();
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.hidden = true;
        const modal      = document.getElementById('usernameModal');
        if (!modal) return;
        const input      = document.getElementById('usernameInput');
        const statusEl   = document.getElementById('usernameStatus');
        const confirmBtn = document.getElementById('usernameConfirmBtn');
        const suggBox    = document.getElementById('usernameSuggestions');
        if (input)      input.value = '';
        if (statusEl)   { statusEl.textContent = ''; statusEl.className = 'username-status'; }
        if (confirmBtn) confirmBtn.disabled = true;
        if (suggBox)    suggBox.hidden = true;
        if (input && user?.displayName) {
            const cleaned = user.displayName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
            if (cleaned.length >= 3) {
                input.value = cleaned;
                setTimeout(() => input.dispatchEvent(new Event('input')), 400);
            }
        }
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        if (input) setTimeout(() => input.focus(), 100);
    }

    function waitForFirebase(timeout = 6000) {
        return new Promise((resolve) => {
            if (window.db && window.addDoc) return resolve(true);
            const start = Date.now();
            const interval = setInterval(() => {
                if (window.db && window.addDoc) {
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function saveRegistro(email) {
        const emailNorm = email.trim().toLowerCase();
        if (USE_FIREBASE) {
            const ready = await waitForFirebase();
            if (ready) {
                try {
                        // Verificacion explicita para no sobrescribir registros existentes.
                        const docRef = window.fsDoc(window.db, 'preregistros', emailNorm);
                        const existing = await window.getDoc(docRef);
                        if (existing.exists()) {
                            const err = new Error('EMAIL_EXISTS');
                            err.code = 'email-already-registered';
                            throw err;
                        }
                        await window.setDoc(docRef, {
                            email: emailNorm,
                            date: new Date().toISOString()
                        }, { merge: false });
                        return;
                } catch (e) {
                    console.error('Firebase error al guardar:', e);
                        if (e.code === 'permission-denied' || e.code === 'already-exists' || e.code === 'email-already-registered') throw e;
                    // Sino cae a local
                }
            }
        }
        saveRegistroLS(emailNorm);
    }

        async function isEmailAlreadyRegistered(email) {
            const emailNorm = email.trim().toLowerCase();

            if (USE_FIREBASE) {
                const ready = await waitForFirebase(3000);
                if (ready && window.db && window.fsDoc && window.getDoc) {
                    try {
                        const docRef = window.fsDoc(window.db, 'preregistros', emailNorm);
                        const existing = await window.getDoc(docRef);
                        if (existing.exists()) return true;
                    } catch (e) {
                        console.warn('No se pudo verificar duplicado en Firebase, se revisa local:', e);
                    }
                }
            }

            return getRegistrosLS().some((r) => String(r?.email || '').toLowerCase() === emailNorm);
        }

    async function getRegistros(callback) {
        if (USE_FIREBASE) {
            const ready = await waitForFirebase(3000);
            if (ready) {
                try {
                    const snapshot = await window.getDocs(window.collection(window.db, 'preregistros'));
                    return callback(snapshot.docs.map(d => d.data()));
                } catch (e) {
                    console.warn('Firebase error al leer, usando local:', e);
                }
            }
        }
        callback(getRegistrosLS());
    }

    async function updateCounter() {
        getRegistros((registros) => {
            const totalRegistros = registros.length;
            preregistrosActuales = totalRegistros;
            const disponibles = Math.max(MAX_PREREGISTROS - totalRegistros, 0);
            const porcentaje = Math.min((totalRegistros / MAX_PREREGISTROS) * 100, 100);

            const countElement = document.getElementById('registro-count');
            if (countElement) {
                countElement.textContent = `Pre-registros totales: ${totalRegistros}/${MAX_PREREGISTROS}`;
            }

            const disponiblesElement = document.getElementById('registro-disponibles');
            if (disponiblesElement) {
                disponiblesElement.textContent = `Cupos disponibles: ${disponibles}`;
            }

            const porcentajeElement = document.getElementById('registro-porcentaje');
            if (porcentajeElement) {
                porcentajeElement.textContent = `${porcentaje.toFixed(1)}%`;
            }

            const progressFill = document.getElementById('registro-progress-fill');
            if (progressFill) {
                progressFill.style.width = `${porcentaje}%`;
            }

            const statusElement = document.getElementById('registro-status');
            if (statusElement) {
                statusElement.textContent = totalRegistros >= MAX_PREREGISTROS
                    ? 'Cupo completo: lista de espera cerrada por ahora.'
                    : 'Meta comunitaria en marcha';
            }

            const hubRegistros = document.getElementById('hubRegistros');
            if (hubRegistros) {
                hubRegistros.textContent = String(totalRegistros);
            }

            updatePromoCapacityDisplay(totalRegistros);
            updatePreregistroButtonState(totalRegistros);
        });
    }

    function updatePreregistroButtonState(totalRegistros) {
        const preregistroBtn = document.getElementById('preregistro-btn');
        const emailInput = document.getElementById('email');
        const messageElement = document.getElementById('message');
        const cupoLleno = totalRegistros >= MAX_PREREGISTROS;

        if (preregistroBtn) {
            preregistroBtn.disabled = cupoLleno;
            preregistroBtn.textContent = cupoLleno ? 'Cupo lleno' : 'Pre-registrarme';
            preregistroBtn.style.opacity = cupoLleno ? '0.6' : '1';
            preregistroBtn.style.cursor = cupoLleno ? 'not-allowed' : 'pointer';
        }

        if (emailInput) {
            emailInput.disabled = cupoLleno;
        }

        if (messageElement && cupoLleno) {
            messageElement.textContent = 'Se alcanzo el limite de 1000 pre-registros.';
        }
    }

    // Particles container
    let particlesContainer;

    // 3. Funcionalidad para todos los botones ".btn" EXCEPTO pre-registro
    const botones = document.querySelectorAll('.btn:not(#preregistro-btn)');

    botones.forEach(boton => {
        boton.addEventListener('click', (e) => {
            // Si el botón es solo un enlace '#' (demo), prevenimos la acción y mostramos alerta
            const destino = boton.getAttribute('href');
            
            if (boton.tagName === 'A' && (!destino || destino === '#')) {
                e.preventDefault();
                alert(" ¡Esta función estará disponible próximamente en Panter Studio!");
            } 
            // Si es un botón de "Descargar", confirmamos la acción
            else if (boton.textContent.includes('Descargar')) {
                const confirmacion = confirm("¿Estás listo para descargar Mystery Panter?");
                if (!confirmacion) {
                    e.preventDefault(); // Cancela si el usuario dice "No"
                } else {
                    alert("Iniciando descarga... (Simulación)");
                }
            }

            // Emit particles on button click
            if (particlesContainer) {
                const rect = e.target.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                for (let i = 0; i < 5; i++) {
                    particlesContainer.particles.addParticle({
                        position: { x: centerX, y: centerY },
                        color: { value: "#1e70c8" },
                        size: { value: 3 },
                        opacity: { value: 0.8 },
                        move: { speed: 2, direction: "none", outModes: { default: "destroy" } },
                        life: { duration: { value: 2 } }
                    });
                }
            }
        });
    });

    // 4. Efecto especial para el Logo: Pequeño rebote al hacer clic
    const logo = document.querySelector('.logo-img');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            logo.style.transform = 'scale(0.95)';
            setTimeout(() => {
                logo.style.transform = 'scale(1)';
            }, 150);
            console.log("Click en el logo detectado.");
        });
    }

    // 5. Detectar en qué página estamos para resaltar el menú (Fallback)
    // Aunque ya lo hicimos manualmente en el HTML con class="active", esto asegura que funcione
    // si agregas más páginas en el futuro.
    const rutaActual = getRouteFilename(window.location.pathname);
    const enlacesNav = document.querySelectorAll('nav > a');

    enlacesNav.forEach(enlace => {
        const rutaEnlace = getRouteFilename(enlace.getAttribute('href'));
        if (rutaEnlace === rutaActual) {
            enlace.classList.add('active');
            enlace.style.borderBottom = "2px solid white"; // Extra visual
        }
    });

    const appRoutes = ['actualizaciones.html', 'imagenes.html', 'videos.html', 'meinteresa.html'];
    const navDropdowns = document.querySelectorAll('.nav-dropdown');

    navDropdowns.forEach((dropdown) => {
        const toggle = dropdown.querySelector('.nav-dropdown-toggle');
        const menuLinks = dropdown.querySelectorAll('.nav-dropdown-menu a');
        if (!toggle) return;

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const isOpen = dropdown.classList.contains('open');
            navDropdowns.forEach((item) => {
                item.classList.remove('open');
                const itemToggle = item.querySelector('.nav-dropdown-toggle');
                if (itemToggle) itemToggle.setAttribute('aria-expanded', 'false');
            });
            if (!isOpen) {
                dropdown.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });

        if (appRoutes.includes(rutaActual)) {
            toggle.classList.add('active');
            menuLinks.forEach((link) => {
                if (getRouteFilename(link.getAttribute('href')) === rutaActual) {
                    link.classList.add('active');
                }
            });
        }
    });

    document.addEventListener('click', (event) => {
        navDropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('open');
                const toggle = dropdown.querySelector('.nav-dropdown-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        const body = document.body;

        const isDarkMode = localStorage.getItem('darkMode') !== 'false'; // Default to true if not set
        if (isDarkMode) {
            body.setAttribute('data-theme', 'dark');
            body.classList.add('dark-mode');
            darkModeToggle.innerHTML = '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
            darkModeToggle.setAttribute('aria-label', 'Cambiar a modo claro');
        } else {
            body.setAttribute('data-theme', 'light');
            body.classList.remove('dark-mode');
            darkModeToggle.innerHTML = '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
            darkModeToggle.setAttribute('aria-label', 'Cambiar a modo oscuro');
        }

        darkModeToggle.addEventListener('click', () => {
            const hasDark = body.getAttribute('data-theme') === 'dark';
            if (hasDark) {
                body.setAttribute('data-theme', 'light');
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'false');
                darkModeToggle.innerHTML = '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
                darkModeToggle.setAttribute('aria-label', 'Cambiar a modo oscuro');
            } else {
                body.setAttribute('data-theme', 'dark');
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'true');
                darkModeToggle.innerHTML = '<i class="fa-solid fa-sun" aria-hidden="true"></i>';
                darkModeToggle.setAttribute('aria-label', 'Cambiar a modo claro');
            }
        });
    }

    // Particles effect
    if (window.tsParticles && typeof window.tsParticles.load === 'function' && document.getElementById('tsparticles')) {
    tsParticles.load("tsparticles", {
        background: {
            color: {
                value: "transparent",
            },
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onClick: {
                    enable: false,  // Disabled global click, now handled per button
                },
                onHover: {
                    enable: true,
                    mode: "repulse",
                },
                resize: true,
            },
            modes: {
                push: {
                    quantity: 4,
                },
                repulse: {
                    distance: 200,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: "#1e70c8",
            },
            links: {
                color: "#1e70c8",
                distance: 150,
                enable: true,
                opacity: 0.5,
                width: 1,
            },
            collisions: {
                enable: true,
            },
            move: {
                direction: "none",
                enable: true,
                outModes: {
                    default: "bounce",
                },
                random: false,
                speed: 2,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                    area: 800,
                },
                value: 80,
            },
            opacity: {
                value: 0.5,
            },
            shape: {
                type: "circle",
            },
            size: {
                value: { min: 1, max: 5 },
            },
        },
        detectRetina: true,
    }).then(container => {
        particlesContainer = container;
    }).catch((error) => {
        console.warn('No se pudo iniciar el efecto de partículas:', error);
    });
    }

    // Pre-registro form
    const preregistroForm = document.getElementById('preregistro-form');
    if (preregistroForm) {
        preregistroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (preregistrosActuales >= MAX_PREREGISTROS) {
                document.getElementById('message').textContent = 'Se alcanzo el limite de 1000 pre-registros.';
                return;
            }

            const email = document.getElementById('email').value;
            const emailNorm = email.trim().toLowerCase();
            const msgEl = document.getElementById('message');

            if (await isEmailAlreadyRegistered(emailNorm)) {
                if (msgEl) {
                    msgEl.textContent = 'Este correo ya esta registrado. Usa otro correo o inicia sesion.';
                }
                alert('Ese correo ya existe en el pre-registro.');
                return;
            }

            try {
                await saveRegistro(emailNorm);
                preregistrosActuales++;
                updateCounter();
                const position = preregistrosActuales;
                msgEl.textContent = '¡Pre-registro exitoso! Enviando correo de confirmación...';
                preregistroForm.reset();
                const emailSent = await sendConfirmationEmail(emailNorm, position);
                msgEl.textContent = emailSent
                    ? '¡Listo! Revisa tu correo, te enviamos la confirmación.'
                    : '¡Pre-registro exitoso! (Correo de confirmación no disponible en este momento)';

                const voiceName = emailNorm.split('@')[0] || 'jugador';
                speakPreregistroSuccess(voiceName);
            } catch (error) {
                if (msgEl) {
                    msgEl.textContent = 'Este correo ya esta registrado. No se envio ningun correo.';
                }
            }
        });
    }

    updateCounter();

    // Cuando Firebase termine de cargar, refrescar el contador con datos reales
    document.addEventListener('firebaseReady', () => {
        updateCounter();
        setupUserAuth();
    });

    setupAuthModal();
    setupUserAuth();
    setupUsernameModal();
});

/* ===== FUNCIONES PARA VENTANAS LATERALES ===== */

// Función para abrir/cerrar paneles
function togglePanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    
    if (panel.classList.contains('active')) {
        closePanel(side);
    } else {
        openPanel(side);
    }
}

// Función para abrir panel
function openPanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    panel.classList.add('active');
    
    // Efecto de sonido simulado (opcional)
    console.log(`Panel ${side} abierto con efecto de garras de pantera `);
}

// Función para cerrar panel
function closePanel(side) {
    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    panel.classList.remove('active');
    
    console.log(`Panel ${side} cerrado`);
}

// Cerrar paneles al hacer clic fuera de ellos
document.addEventListener('click', (e) => {
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    const leftTrigger = document.querySelector('.left-trigger');
    const rightTrigger = document.querySelector('.right-trigger');
    
    // Cerrar panel izquierdo si se hace clic fuera
    if (leftPanel && leftPanel.classList.contains('active')) {
        if (!leftPanel.contains(e.target) && !leftTrigger.contains(e.target)) {
            closePanel('left');
        }
    }
    
    // Cerrar panel derecho si se hace clic fuera
    if (rightPanel && rightPanel.classList.contains('active')) {
        if (!rightPanel.contains(e.target) && !rightTrigger.contains(e.target)) {
            closePanel('right');
        }
    }
});

// Cerrar paneles con tecla ESC (solo si el modal no está abierto)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Prioridad al modal promocional
        const modal = document.getElementById('preregistroModal');
        if (modal && modal.classList.contains('active')) {
            closePromoModal();
            return;
        }
        
        // Si no hay modal, cerrar paneles
        const leftPanel = document.getElementById('leftPanel');
        const rightPanel = document.getElementById('rightPanel');
        
        if (leftPanel && leftPanel.classList.contains('active')) {
            closePanel('left');
        }
        if (rightPanel && rightPanel.classList.contains('active')) {
            closePanel('right');
        }
    }
});

// NO abrir paneles automáticamente (el modal promocional tiene prioridad)
// Los paneles están disponibles a través de los botones flotantes

// Prevenir scroll cuando los paneles están abiertos (opcional para móviles)
function preventScroll(side, isOpen) {
    if (window.innerWidth <= 768) {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            const leftPanel = document.getElementById('leftPanel');
            const rightPanel = document.getElementById('rightPanel');
            const modal = document.getElementById('preregistroModal');
            
            // Solo permitir scroll si todo está cerrado
            if (!leftPanel.classList.contains('active') && 
                !rightPanel.classList.contains('active') &&
                (!modal || !modal.classList.contains('active'))) {
                document.body.style.overflow = 'auto';
            }
        }
    }
}

/* ========================================
   HAMBURGER MENU — Mobile Nav Toggle
   ======================================== */
(function() {
    function initHamburger() {
        const nav = document.querySelector('nav');
        const btn = document.querySelector('.nav-hamburger');
        if (!nav || !btn) return;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            nav.classList.toggle('nav-open');
            const isOpen = nav.classList.contains('nav-open');
            btn.setAttribute('aria-expanded', isOpen);
            // Bloquear scroll body mientras el menú está abierto
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Cerrar al hacer clic fuera del nav
        document.addEventListener('click', function(e) {
            if (!nav.contains(e.target)) {
                nav.classList.remove('nav-open');
                btn.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            }
        });

        // Cerrar al pulsar un link del menú móvil
        const mobileLinks = nav.querySelectorAll('.nav-mobile-menu a');
        mobileLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                nav.classList.remove('nav-open');
                btn.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });

        // Cerrar con Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && nav.classList.contains('nav-open')) {
                nav.classList.remove('nav-open');
                btn.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHamburger);
    } else {
        initHamburger();
    }
})();

/* ========================================
   GLOBAL AUTH SYNC & ANIMATED STATS
   ======================================== */
(function() {
    function initStatsCounters() {
        const counterCards = document.querySelectorAll('.stat-card-number, #counterPlayers');
        if (!counterCards.length) return;

        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const text = el.textContent.trim();
                    const numMatch = text.match(/[\d,.]+/);
                    if (numMatch && !el.dataset.animated) {
                        el.dataset.animated = 'true';
                        const rawNumStr = numMatch[0].replace(/,/g, '');
                        const targetNum = parseFloat(rawNumStr);
                        if (isNaN(targetNum)) return;
                        const suffix = text.replace(numMatch[0], '');
                        const duration = 1200;
                        const start = performance.now();

                        function updateCount(now) {
                            const elapsed = now - start;
                            const progress = Math.min(elapsed / duration, 1);
                            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                            const current = targetNum * ease;
                            if (targetNum >= 1000) {
                                el.textContent = Math.floor(current).toLocaleString('en-US') + suffix;
                            } else if (targetNum % 1 !== 0) {
                                el.textContent = current.toFixed(1) + suffix;
                            } else {
                                el.textContent = Math.floor(current) + suffix;
                            }
                            if (progress < 1) requestAnimationFrame(updateCount);
                        }
                        requestAnimationFrame(updateCount);
                    }
                }
            });
        }, { threshold: 0.15 });

        counterCards.forEach(c => observer.observe(c));
    }

    function initLiveBetaTestersCount() {
        const els = document.querySelectorAll('#indexBetaCountNum, #betaTestersCount');
        if (!els.length) return;

        const cached = localStorage.getItem('ps_beta_testers_count') || '29';
        els.forEach(el => el.textContent = cached);

        const fetchCount = async () => {
            if (!window.db || !window.collection || !window.getDocs || !window.query || !window.where) return;
            try {
                const q = window.query(
                    window.collection(window.db, 'conductores'),
                    window.where('betaTesterRequest', '==', true)
                );
                const snap = await window.getDocs(q);
                if (snap && typeof snap.size === 'number' && snap.size > 0) {
                    localStorage.setItem('ps_beta_testers_count', snap.size);
                    els.forEach(el => el.textContent = snap.size);
                }
            } catch (err) {
                console.warn('Error fetching beta testers count:', err);
            }
        };

        if (window.db) {
            fetchCount();
        } else {
            document.addEventListener('firebaseReady', fetchCount, { once: true });
        }
    }

    function initGlobalAuthAndNav() {
        if (typeof setupUnifiedNavRight === 'function') {
            setupUnifiedNavRight();
        }
        const currentUser = (window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function')
            ? window.DiscordAuth.getUser()
            : null;
        if (typeof updateAuthUi === 'function') {
            updateAuthUi(currentUser);
        }
        initStatsCounters();
        initLiveBetaTestersCount();
        if (currentUser) {
            if (window.db) checkUserBetaStatus(currentUser);
            else document.addEventListener('firebaseReady', () => checkUserBetaStatus(currentUser), { once: true });
        }
    }

    async function checkUserBetaStatus(user) {
        if (!user || !window.db || !window.fsDoc || !window.getDoc) return;
        try {
            const snap = await window.getDoc(window.fsDoc(window.db, 'conductores', user.uid));
            if (snap.exists() && snap.data().betaTesterRequest) {
                const betaBtns = document.querySelectorAll('.btn-beta-action');
                betaBtns.forEach(btn => {
                    btn.innerHTML = '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Pase Activo (Ver Estado) <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
                    btn.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(0, 176, 255, 0.8))';
                    btn.style.borderColor = '#10b981';
                });
            }
        } catch (e) {
            console.warn('Error checking user beta status:', e);
        }
    }

    // Global Logout Handler
    document.addEventListener('click', async (e) => {
        const logoutBtn = e.target.closest('[data-auth-logout]');
        if (!logoutBtn) return;
        e.preventDefault();
        try {
            if (window.DiscordAuth && typeof window.DiscordAuth.logout === 'function') {
                await window.DiscordAuth.logout();
            }
            if (window.signOut && window.auth) {
                await window.signOut(window.auth);
            }
        } catch (err) {
            console.warn('Error during logout:', err);
        }
        if (typeof updateAuthUi === 'function') {
            updateAuthUi(null);
        }
        window.location.reload();
    });

    // Global modal trigger for any [data-open-auth-modal]
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-auth-modal]');
        if (!trigger) return;
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
        } else if (window.DiscordAuth && typeof window.DiscordAuth.login === 'function') {
            window.DiscordAuth.login();
        }
    });

    document.addEventListener('discordAuthChanged', (e) => {
        if (typeof updateAuthUi === 'function') {
            updateAuthUi(e.detail?.user || null);
        }
        if (e.detail?.user) {
            checkUserBetaStatus(e.detail.user);
        }
    });

    document.addEventListener('authStateChanged', (e) => {
        if (typeof updateAuthUi === 'function') {
            updateAuthUi(e.detail?.user || null);
        }
        if (e.detail?.user) {
            checkUserBetaStatus(e.detail.user);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalAuthAndNav);
    } else {
        initGlobalAuthAndNav();
    }
})();


