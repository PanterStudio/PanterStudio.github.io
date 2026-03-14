(function () {
    const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
    const REFERRAL_STORAGE_KEY = 'panterPendingReferralCode';
    function toSitePath(path) {
        return `${SITE_ROOT}/${String(path || '').replace(/^\/+/, '')}`.replace(/\\/g, '/');
    }

    const ROLE_LABELS = {
        founder_ceo: 'Fundador / CEO',
        administrador: 'Administrador',
        programador: 'Programador',
        modelador: 'Modelador',
        usuario: 'Miembro',
        viewer: 'Miembro',
        vip: 'VIP',
        community_manager: 'Community Manager',
        support_ops: 'Soporte',
        youtuber: 'Youtuber',
        streamer: 'Streamer'
    };

    const SPECIAL_ACCESS_ROLES = new Set(['founder_ceo', 'administrador', 'programador', 'modelador']);
    const spinPrizes = [5, 10, 25, 50, 100, 5, 10, 25];

    const authSection = document.getElementById('profileAuthSection');
    const dashboard = document.getElementById('profileDashboard');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');
    const authTabs = document.querySelectorAll('.auth-tab');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    const profileAvatarLetter = document.getElementById('profileAvatarLetter');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileEmail = document.getElementById('profileEmail');
    const profileHeroSummary = document.getElementById('profileHeroSummary');
    const profileCoins = document.getElementById('profileCoins');
    const profileLevel = document.getElementById('profileLevel');
    const profileJoinDate = document.getElementById('profileJoinDate');
    const profileBadges = document.getElementById('profileBadges');
    const coinsDisplayLarge = document.getElementById('coinsDisplayLarge');
    const profileRole = document.getElementById('profileRole');
    const profileVerificationStatus = document.getElementById('profileVerificationStatus');
    const profileProvider = document.getElementById('profileProvider');
    const profilePreregisterStatus = document.getElementById('profilePreregisterStatus');
    const profilePreregisterStatusSide = document.getElementById('profilePreregisterStatusSide');
    const profileVerificationStatusSide = document.getElementById('profileVerificationStatusSide');
    const profileProviderSide = document.getElementById('profileProviderSide');
    const profileAccessLevel = document.getElementById('profileAccessLevel');
    const profileUid = document.getElementById('profileUid');
    const profileDetailName = document.getElementById('profileDetailName');
    const profileDetailRole = document.getElementById('profileDetailRole');
    const profileCountry = document.getElementById('profileCountry');
    const profileFavoriteProject = document.getElementById('profileFavoriteProject');
    const profileBio = document.getElementById('profileBio');
    const profileStreak = document.getElementById('profileStreak');
    const profileSupportTotal = document.getElementById('profileSupportTotal');
    const profileSupportCount = document.getElementById('profileSupportCount');

    const logoutBtn = document.getElementById('logoutBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const activityList = document.getElementById('activityList');
    const projectUpdateFeed = document.getElementById('projectUpdateFeed');
    const profileAdminTools = document.getElementById('profileAdminTools');

    const spinWheel = document.getElementById('spinWheel');
    const spinBtn = document.getElementById('spinBtn');
    const spinMessage = document.getElementById('spinMessage');
    const spinCooldown = document.getElementById('spinCooldown');

    const spinPointer = document.querySelector('.spin-pointer');
    // Feature flag: set to true to disable daily cooldown for testing
    const DISABLE_SPIN_COOLDOWN = true;
    const spinParticlesContainer = document.getElementById('spinParticles');
    const audioCtx = (function(){
        try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    })();

    function playClickSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(900, now);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.15, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now); o.stop(now + 0.3);
    }

    function playWinSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const o1 = audioCtx.createOscillator();
        const o2 = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o1.type = 'triangle'; o2.type = 'sine';
        o1.frequency.setValueAtTime(600, now);
        o2.frequency.setValueAtTime(980, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.25, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
        o1.start(now); o2.start(now); o1.stop(now + 0.8); o2.stop(now + 0.8);
    }

    const claimDailyBtn = document.getElementById('claimDailyBtn');
    const dailyBonusMessage = document.getElementById('dailyBonusMessage');
    const dailyBonusAmount = document.getElementById('dailyBonusAmount');
    const streakDays = document.querySelectorAll('.streak-day');

    const referralCode = document.getElementById('referralCode');
    const copyReferralBtn = document.getElementById('copyReferralBtn');
    const referralCount = document.getElementById('referralCount');
    const referralCountSide = document.getElementById('referralCountSide');
    const referralCoins = document.getElementById('referralCoins');
    const referralCoinsSide = document.getElementById('referralCoinsSide');

    const sponsorBadge = document.getElementById('sponsorBadge');
    const sponsorLevelName = document.getElementById('sponsorLevelName');
    const sponsorLevelNameSide = document.getElementById('sponsorLevelNameSide');
    const sponsorLevelDesc = document.getElementById('sponsorLevelDesc');
    const profileSponsorSummary = document.getElementById('profileSponsorSummary');

    const profileCoinsDollars   = document.getElementById('profileCoinsDollars');
    const redeemCoinsAvailable  = document.getElementById('redeemCoinsAvailable');
    const redeemDollars         = document.getElementById('redeemDollars');
    const redeemTotalPaid       = document.getElementById('redeemTotalPaid');
    const redeemTotalCount      = document.getElementById('redeemTotalCount');
    const redeemAmountInput     = document.getElementById('redeemAmount');
    const redeemBtn             = document.getElementById('redeemBtn');
    const redeemMessage         = document.getElementById('redeemMessage');
    const redeemHistory         = document.getElementById('redeemHistory');
    const redeemHistoryList     = document.getElementById('redeemHistoryList');
    const profileGamesPlayedToday = document.getElementById('profileGamesPlayedToday');

    const COINS_PER_EXCHANGE     = 5000;
    const EMERALDS_PER_EXCHANGE  = 50;
    const MIN_REDEEM_COINS       = 5000;
    const REDEEM_COLLECTION     = 'coin_redemptions';
    const USERNAME_ADJ          = ['Veloz', 'Feroz', 'Astuto', 'Brillante', 'Salvaje', 'Sombrio', 'Rapido', 'Fuerte', 'Oscuro', 'Agil', 'Fiero', 'Noble'];
    const USERNAME_NOUN         = ['Pantera', 'Lobo', 'Aguila', 'Zorro', 'Leon', 'Tigre', 'Cobra', 'Halcon', 'Jaguar', 'Oso', 'Linx', 'Condor'];

    let currentUser = null;
    let currentUserData = null;
    let settings = {};
    let supportSnapshot = { total: 0, count: 0, sponsor: null };
    let preregSnapshot = { registered: false, data: null };

    function esc(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
    }

    function formatDateLong(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: '2-digit' });
    }

    function formatCurrency(amount) {
        const value = Number(amount || 0);
        return `$${value.toFixed(2)}`;
    }

    function coinsToEmeralds(coins) {
        return Math.floor((Number(coins || 0) / COINS_PER_EXCHANGE) * EMERALDS_PER_EXCHANGE);
    }

    function formatEmeralds(value) {
        return `${Number(value || 0)} 💎`;
    }

    function isPermissionDeniedError(err) {
        const code = String(err?.code || '').toLowerCase();
        const message = String(err?.message || '').toLowerCase();
        return code.includes('permission-denied') || message.includes('permission-denied');
    }

    function generateSuggestions(base) {
        const clean = String(base || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) || 'Jugador';
        const results = [];
        const used = new Set([clean]);
        while (results.length < 4) {
            const n = Math.floor(Math.random() * 900) + 100;
            const candidate = clean + n;
            if (!used.has(candidate)) {
                used.add(candidate);
                results.push(candidate);
            }
        }
        results.push(clean + '_GG');
        return results;
    }

    async function isUsernameTaken(username, excludeUid = '') {
        if (!window.db || !window.getDocs || !window.query || !window.collection || !window.where) return false;
        const snap = await window.getDocs(
            window.query(window.collection(window.db, 'users'), window.where('username', '==', username))
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

    function countGamesPlayedToday(uid) {
        const today = new Date().toDateString();
        let count = 0;
        ['game1', 'game2', 'game3'].forEach(id => {
            try {
                const key = `panterMG_${id}_${uid}`;
                const stored = localStorage.getItem(key);
                if (stored && new Date(stored).toDateString() === today) count++;
            } catch {}
        });
        return count;
    }

    async function loadRedemptionHistory(uid) {
        try {
            const snap = await window.getDocs(window.collection(window.db, REDEEM_COLLECTION));
            return snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(item => item.uid === uid)
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        } catch { return []; }
    }

    function renderRedemptionHistory(history) {
        if (!redeemHistoryList || !redeemHistory) return;
        if (history.length === 0) { redeemHistory.hidden = true; return; }
        redeemHistory.hidden = false;

        redeemHistoryList.innerHTML = history.map(item => {
            const emeralds = Number(item.emeralds || coinsToEmeralds(item.coins || 0));
            return `<div class="redemption-history-item">
                <div>
                    <strong>${esc(String(item.coins || 0))} monedas</strong>
                    <small>${esc(formatEmeralds(emeralds))} · ${esc(formatDateLong(item.createdAt))}</small>
                </div>
            </div>`;
        }).join('');

        const totalEmeralds = history.reduce((sum, item) => sum + Number(item.emeralds || coinsToEmeralds(item.coins || 0)), 0);
        if (redeemTotalPaid) redeemTotalPaid.textContent = formatEmeralds(totalEmeralds);
        if (redeemTotalCount) redeemTotalCount.textContent = String(history.length);
    }

    async function submitRedemption(uid, coinsStr) {
        const coins = parseInt(coinsStr, 10);
        if (isNaN(coins) || coins < MIN_REDEEM_COINS) {
            return { ok: false, msg: `Minimo ${MIN_REDEEM_COINS} monedas para canjear.` };
        }
        if (coins > Number(currentUserData?.coins || 0)) {
            return { ok: false, msg: 'No tienes suficientes monedas.' };
        }

        const emeralds = coinsToEmeralds(coins);
        if (emeralds <= 0) {
            return { ok: false, msg: 'El monto no alcanza para convertir a esmeraldas.' };
        }

        const now = new Date().toISOString();
        try {
            await window.addDoc(window.collection(window.db, REDEEM_COLLECTION), {
                uid,
                email: currentUser?.email || '',
                username: currentUserData?.username || currentUserData?.displayName || '',
                coins,
                emeralds,
                status: 'completed',
                createdAt: now
            });

            const newCoins = Number(currentUserData.coins || 0) - coins;
            const newEmeralds = Number(currentUserData.emeralds || 0) + emeralds;
            await updateUserData(uid, { coins: newCoins, emeralds: newEmeralds });
            await addActivity(uid, 'exchange', `Canje completado: ${coins} monedas por ${emeralds} esmeraldas`, -coins);

            currentUserData.coins = newCoins;
            currentUserData.emeralds = newEmeralds;

            return { ok: true, msg: `Canje exitoso: +${emeralds} esmeraldas.` };
        } catch (err) {
            console.error('Error enviando solicitud de canje:', err);
            return { ok: false, msg: 'No se pudo completar el canje. Intenta de nuevo.' };
        }
    }

    function providerLabel(user) {
        const providerId = user?.providerData?.[0]?.providerId || 'password';
        if (providerId.includes('google')) return 'Google';
        if (providerId.includes('password')) return 'Email';
        return providerId;
    }

    function roleLabel(role) {
        return ROLE_LABELS[String(role || 'viewer').toLowerCase()] || 'Miembro';
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.auth && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.updateDoc && window.addDoc && window.signInWithEmailAndPassword && window.createUserWithEmailAndPassword && window.signOut && window.updateProfile && window.sendPasswordResetEmail && window.onAuthStateChanged) {
                return resolve(true);
            }
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.auth && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.updateDoc && window.addDoc && window.signInWithEmailAndPassword && window.createUserWithEmailAndPassword && window.signOut && window.updateProfile && window.sendPasswordResetEmail && window.onAuthStateChanged) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    function setAuthMessage(text, type) {
        if (!authMessage) return;
        authMessage.textContent = text || '';
        authMessage.className = `profile-auth-message${type ? ` ${type}` : ''}`;
    }

    function getAuthErrorMessage(err) {
        const code = String(err?.code || '');
        const map = {
            'auth/user-not-found': 'No existe una cuenta con ese correo.',
            'auth/wrong-password': 'La contrasena es incorrecta.',
            'auth/invalid-credential': 'Credenciales invalidas. Intenta nuevamente.',
            'auth/invalid-email': 'El correo no tiene un formato valido.',
            'auth/email-already-in-use': 'Ese correo ya esta registrado.',
            'auth/weak-password': 'La contrasena es muy debil. Usa al menos 6 caracteres.',
            'auth/network-request-failed': 'Error de red. Revisa tu conexion.',
            'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
            'permission-denied': 'Firestore rechazo la operacion. Revisa las reglas para la coleccion users y que el usuario autenticado pueda crear su propio perfil.'
        };
        return map[code] || err?.message || 'Ocurrio un error inesperado.';
    }

    function generateReferralCode(uid) {
        return String(uid || '').slice(0, 6).toUpperCase();
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

    function prefillReferralField() {
        const input = document.getElementById('registerReferral');
        if (!input || input.value.trim()) return;
        const pending = getPendingReferralCode();
        if (pending) input.value = pending;
    }

    async function loadSettings() {
        try {
            const [siteSnap, minigameSnap] = await Promise.all([
                window.getDoc(window.fsDoc(window.db, 'settings', 'site')).catch(() => null),
                window.getDoc(window.fsDoc(window.db, 'settings', 'minigames')).catch(() => null)
            ]);
            return {
                ...(siteSnap && siteSnap.exists() ? siteSnap.data() || {} : {}),
                ...(minigameSnap && minigameSnap.exists() ? minigameSnap.data() || {} : {})
            };
        } catch {
            return {};
        }
    }

    async function getUserData(uid) {
        try {
            const snapshot = await window.getDoc(window.fsDoc(window.db, 'users', uid));
            return snapshot.exists() ? snapshot.data() || null : null;
        } catch {
            return null;
        }
    }

    async function createUserDoc(user, extras = {}) {
        const now = new Date().toISOString();
        const baseName = extras.displayName || user.displayName || user.email?.split('@')[0] || 'Miembro';
        const payload = {
            displayName: baseName,
            username: extras.username || baseName,
            email: user.email || '',
            avatar: '😊',
            bio: '',
            favoriteProject: 'Nuestra Tierra Job Simulator',
            country: 'Colombia',
            coins: 0,
            emeralds: 0,
            level: 'visitor',
            referralCode: generateReferralCode(user.uid),
            referredBy: null,
            referralCount: 0,
            referralCoins: 0,
            streak: 0,
            lastDaily: null,
            lastSpin: null,
            role: extras.role || 'viewer',
            createdAt: now,
            updatedAt: now
        };
        await window.setDoc(window.fsDoc(window.db, 'users', user.uid), payload, { merge: true });
        return payload;
    }

    async function updateUserData(uid, data) {
        await window.setDoc(window.fsDoc(window.db, 'users', uid), {
            ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    async function addActivity(uid, type, description, coins = 0) {
        try {
            await window.addDoc(window.collection(window.db, 'users', uid, 'activity'), {
                type,
                description,
                coins,
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            console.warn('No se pudo registrar actividad:', err);
        }
    }

    async function getActivity(uid, limitCount = 10) {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'users', uid, 'activity'));
            return snap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                .slice(0, limitCount);
        } catch {
            return [];
        }
    }

    async function processReferral(refCode, newUserUid) {
        if (!refCode) return { applied: false, reason: 'not-provided', reward: 0 };
        const normalized = normalizeReferralCode(refCode);
        if (!normalized) return { applied: false, reason: 'not-provided', reward: 0 };
        try {
            const snap = await window.getDocs(window.collection(window.db, 'users'));
            const referrer = snap.docs.find((doc) => String(doc.data()?.referralCode || '').toUpperCase() === normalized);
            if (!referrer) return { applied: false, reason: 'invalid', reward: 0 };
            if (referrer.id === newUserUid) return { applied: false, reason: 'self', reward: 0 };
            const reward = Number(settings.referralCoins || 50);
            const data = referrer.data() || {};
            await updateUserData(referrer.id, {
                referralCount: Number(data.referralCount || 0) + 1,
                referralCoins: Number(data.referralCoins || 0) + reward,
                coins: Number(data.coins || 0) + reward
            });
            await updateUserData(newUserUid, { referredBy: normalized });
            await addActivity(referrer.id, 'referral', 'Nuevo referido registrado', reward);
            return { applied: true, reason: 'applied', reward };
        } catch (err) {
            console.warn('No se pudo procesar referido:', err);
            return { applied: false, reason: 'error', reward: 0 };
        }
    }

    async function loadSupportSnapshot(user) {
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) return { total: 0, count: 0, sponsor: null };
        try {
            const [donationsSnap, sponsorsSnap] = await Promise.all([
                window.getDocs(window.collection(window.db, 'donations')).catch(() => null),
                window.getDocs(window.collection(window.db, 'sponsors')).catch(() => null)
            ]);
            const donations = donationsSnap ? donationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
            const sponsors = sponsorsSnap ? sponsorsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];

            const userDonations = donations.filter((item) => {
                const donationEmail = String(item.email || item.userEmail || '').trim().toLowerCase();
                return donationEmail === email || String(item.uid || '') === user.uid;
            });

            const sponsor = sponsors.find((item) => {
                const sponsorEmail = String(item.email || item.userEmail || '').trim().toLowerCase();
                return sponsorEmail === email || String(item.uid || '') === user.uid;
            }) || null;

            return {
                total: userDonations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
                count: userDonations.length,
                sponsor
            };
        } catch {
            return { total: 0, count: 0, sponsor: null };
        }
    }

    async function loadPreregisterSnapshot(user) {
        const email = String(user?.email || '').trim().toLowerCase();
        if (!email) return { registered: false, data: null };
        try {
            const direct = await window.getDoc(window.fsDoc(window.db, 'preregistros', email)).catch(() => null);
            if (direct && direct.exists()) return { registered: true, data: direct.data() || {} };

            const snap = await window.getDocs(window.collection(window.db, 'preregistros')).catch(() => null);
            if (!snap) return { registered: false, data: null };
            const found = snap.docs.find((doc) => String(doc.data()?.email || '').trim().toLowerCase() === email);
            return found ? { registered: true, data: found.data() || {} } : { registered: false, data: null };
        } catch {
            return { registered: false, data: null };
        }
    }

    async function loadProjectUpdates(limitCount = 5) {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'project_updates'));
            return snap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((item) => item.published !== false)
                .sort((a, b) => String(b.date || b.updatedAt || b.createdAt || '').localeCompare(String(a.date || a.updatedAt || a.createdAt || '')))
                .slice(0, limitCount);
        } catch {
            return [];
        }
    }

    function getLevelName(level) {
        const levels = {
            visitor: 'Visitante',
            supporter: 'Apoyo',
            bronze: 'Bronce',
            silver: 'Plata',
            gold: 'Oro',
            platinum: 'Platino',
            founder: 'Fundador'
        };
        return levels[String(level || '').toLowerCase()] || 'Visitante';
    }

    function renderSponsorLevel(level) {
        const badgeMap = {
            visitor: '👤',
            supporter: '💖',
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            platinum: '💎',
            founder: '🏆'
        };
        const descMap = {
            visitor: 'Haz una donacion para subir de nivel y desbloquear beneficios.',
            supporter: 'Gracias por apoyar el proyecto.',
            bronze: 'Miembro Bronce con beneficios basicos activos.',
            silver: 'Miembro Plata con acceso anticipado.',
            gold: 'Miembro Oro con extras exclusivos.',
            platinum: 'Miembro Platino con beneficios premium.',
            founder: 'Fundador de la comunidad.'
        };
        const label = getLevelName(level);
        if (sponsorBadge) sponsorBadge.textContent = badgeMap[String(level || '').toLowerCase()] || '👤';
        if (sponsorLevelName) sponsorLevelName.textContent = label;
        if (sponsorLevelNameSide) sponsorLevelNameSide.textContent = label;
        if (sponsorLevelDesc) sponsorLevelDesc.textContent = descMap[String(level || '').toLowerCase()] || descMap.visitor;
    }

    function renderStreakDays(streak) {
        const normalized = Number(streak || 0);
        streakDays.forEach((el) => {
            const day = Number(el.dataset.day || 0);
            const completed = normalized > 0 && (day <= (normalized % 7 || 7));
            el.classList.toggle('completed', completed);
        });
    }

    function checkSpinCooldown(lastSpin) {
        if (DISABLE_SPIN_COOLDOWN) {
            if (spinBtn) spinBtn.disabled = false;
            if (spinCooldown) spinCooldown.textContent = '';
            return;
        }
        if (!lastSpin) {
            if (spinBtn) spinBtn.disabled = false;
            if (spinCooldown) spinCooldown.textContent = '';
            return;
        }
        const last = new Date(lastSpin);
        const now = new Date();
        const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
        const diff = next - now;
        if (diff <= 0) {
            if (spinBtn) spinBtn.disabled = false;
            if (spinCooldown) spinCooldown.textContent = '';
            return;
        }
        if (spinBtn) spinBtn.disabled = true;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (spinCooldown) spinCooldown.textContent = `Proximo giro en ${hours}h ${mins}m`;
    }

    function checkDailyCooldown(lastDaily) {
        if (!lastDaily) {
            if (claimDailyBtn) claimDailyBtn.disabled = false;
            return;
        }
        const last = new Date(lastDaily);
        const now = new Date();
        const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (claimDailyBtn) claimDailyBtn.disabled = today.getTime() <= lastDay.getTime();
    }

    function buildBadgeHtml(label, tone) {
        return `<span class="profile-badge-pill${tone ? ` ${tone}` : ''}">${esc(label)}</span>`;
    }

    function renderBadges(data, user) {
        if (!profileBadges) return;
        const badges = [];
        if (user?.emailVerified) badges.push(buildBadgeHtml('Correo verificado', 'is-green'));
        if (preregSnapshot.registered) badges.push(buildBadgeHtml('Preregistrado', 'is-blue'));
        if (Number(data.referralCount || 0) > 0) badges.push(buildBadgeHtml(`Referidos ${data.referralCount}`, 'is-purple'));
        if (supportSnapshot.total > 0) badges.push(buildBadgeHtml('Patrocinador', 'is-gold'));
        if (SPECIAL_ACCESS_ROLES.has(String(data.role || '').toLowerCase())) badges.push(buildBadgeHtml(roleLabel(data.role), 'is-red'));
        profileBadges.innerHTML = badges.join('');
    }

    // Build visual labels around the wheel (position each .spin-segment element)
    function buildSpinLabels() {
        if (!spinWheel) return;
        const segments = Array.from(spinWheel.querySelectorAll('.spin-segment'));
        const n = segments.length || 1;
        const angle = 360 / n;
        segments.forEach((el, i) => {
            const rot = i * angle;
            // place element rotated around center, then counter-rotate text so it's upright
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = `rotate(${rot}deg) translate(0, -44%) rotate(${ -rot }deg)`;
            el.style.transformOrigin = '50% 50%';
            el.style.textAlign = 'center';
            el.style.fontSize = '0.95rem';
            el.style.lineHeight = '1';
        });
    }

    window.addEventListener('resize', () => {
        buildSpinLabels();
    });

    function renderActivity(activities) {
        if (!activityList) return;
        if (!activities.length) {
            activityList.innerHTML = '<li class="activity-item"><div class="activity-info"><div class="activity-title">Sin actividad reciente</div><div class="activity-time">Tu historial aparecera aqui.</div></div></li>';
            return;
        }
        const iconMap = {
            register: '🎉',
            referral: '👥',
            spin: '🎰',
            daily: '📅',
            profile: '📝',
            exchange: '💎'
        };
        activityList.innerHTML = activities.map((item) => {
            const coins = Number(item.coins || 0);
            return `<li class="activity-item">
                <div class="activity-icon">${iconMap[item.type] || '✨'}</div>
                <div class="activity-info">
                    <div class="activity-title">${esc(item.description || 'Actividad')}</div>
                    <div class="activity-time">${esc(formatDateLong(item.createdAt))}</div>
                </div>
                <div class="activity-coins${coins < 0 ? ' negative' : ''}">${coins ? `${coins > 0 ? '+' : ''}${coins} 🪙` : ''}</div>
            </li>`;
        }).join('');
    }

    function renderProjectFeed(updates) {
        if (!projectUpdateFeed) return;
        if (!updates.length) {
            projectUpdateFeed.innerHTML = '<p>No hay novedades publicadas por ahora.</p>';
            return;
        }
        projectUpdateFeed.innerHTML = updates.map((item) => {
            const params = new URLSearchParams({
                projectId: String(item.projectId || ''),
                projectType: String(item.projectType || 'juego')
            });
            const href = item.projectId ? `proyecto.html?${params.toString()}` : 'actualizaciones.html';

            return `<a class="profile-update-link" href="${esc(href)}">
                <strong>${esc(item.title || 'Actualizacion')}</strong>
                <span>${esc(item.projectTitle || 'Proyecto')}</span>
                <small>${esc(formatDateLong(item.date || item.updatedAt || item.createdAt))}</small>
            </a>`;
        }).join('');
    }

    function showAuth() {
        if (authSection) authSection.hidden = false;
        if (dashboard) {
            dashboard.hidden = true;
            dashboard.classList.remove('active');
        }
    }

    function showDashboard() {
        if (authSection) authSection.hidden = true;
        if (dashboard) {
            dashboard.classList.add('active');
        }
    }

    function renderProfile() {
        if (!currentUser || !currentUserData) return;
        const data = currentUserData;
        const name = String(data.displayName || data.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'Miembro');
        const role = String(data.role || 'viewer').toLowerCase();
        const verifiedText = currentUser.emailVerified ? 'Correo verificado' : 'Correo sin verificar';
        const preregText = preregSnapshot.registered ? 'Preregistro activo' : 'Sin preregistro';
        const providerText = providerLabel(currentUser);
        const summaryBits = [
            data.favoriteProject ? `Proyecto favorito: ${data.favoriteProject}` : 'Aun no has elegido proyecto favorito.',
            settings.homePromoText || settings.announcement || 'Sigue tu progreso y actividad desde este panel.'
        ];

        if (profileAvatarLetter) profileAvatarLetter.textContent = String(data.avatar || '😊');
        if (profileDisplayName) profileDisplayName.textContent = name;
        if (profileEmail) profileEmail.textContent = String(currentUser.email || '');
        if (profileHeroSummary) profileHeroSummary.textContent = summaryBits.join(' ');
        if (profileCoins) profileCoins.textContent = String(Number(data.coins || 0));
        if (coinsDisplayLarge) coinsDisplayLarge.textContent = `${Number(data.coins || 0)} disponibles`;
        if (profileCoinsDollars) profileCoinsDollars.textContent = formatEmeralds(data.emeralds || 0);
        if (redeemCoinsAvailable) redeemCoinsAvailable.textContent = String(Number(data.coins || 0));
        if (redeemDollars) redeemDollars.textContent = formatEmeralds(coinsToEmeralds(data.coins || 0));
        const gamesPlayed = countGamesPlayedToday(currentUser.uid);
        if (profileGamesPlayedToday) profileGamesPlayedToday.textContent = `${gamesPlayed} de 3`;
        if (profileLevel) profileLevel.textContent = getLevelName(data.level);
        if (profileJoinDate) profileJoinDate.textContent = formatDate(data.createdAt);
        if (profileUid) profileUid.textContent = `UID: ${String(currentUser.uid || '').slice(0, 12)}`;
        if (profileRole) profileRole.textContent = roleLabel(role);
        if (profileVerificationStatus) profileVerificationStatus.textContent = verifiedText;
        if (profileVerificationStatusSide) profileVerificationStatusSide.textContent = currentUser.emailVerified ? 'Si' : 'No';
        if (profileProvider) profileProvider.textContent = providerText;
        if (profileProviderSide) profileProviderSide.textContent = providerText;
        if (profilePreregisterStatus) profilePreregisterStatus.textContent = preregText;
        if (profilePreregisterStatusSide) profilePreregisterStatusSide.textContent = preregSnapshot.registered ? 'Activo' : 'Pendiente';
        if (profileAccessLevel) profileAccessLevel.textContent = SPECIAL_ACCESS_ROLES.has(role) ? 'Especial' : 'Miembro';
        if (profileDetailName) profileDetailName.textContent = name;
        if (profileDetailRole) profileDetailRole.textContent = roleLabel(role);
        if (profileCountry) profileCountry.textContent = String(data.country || 'No definido');
        if (profileFavoriteProject) profileFavoriteProject.textContent = String(data.favoriteProject || 'No definido');
        if (profileBio) profileBio.textContent = String(data.bio || 'Todavia no has configurado una descripcion personal.');
        if (profileStreak) profileStreak.textContent = String(Number(data.streak || 0));
        if (referralCode) referralCode.textContent = String(data.referralCode || generateReferralCode(currentUser.uid));
        if (referralCount) referralCount.textContent = String(Number(data.referralCount || 0));
        if (referralCountSide) referralCountSide.textContent = String(Number(data.referralCount || 0));
        if (referralCoins) referralCoins.textContent = String(Number(data.referralCoins || 0));
        if (referralCoinsSide) referralCoinsSide.textContent = String(Number(data.referralCoins || 0));
        if (profileSupportTotal) profileSupportTotal.textContent = formatCurrency(supportSnapshot.total);
        if (profileSupportCount) profileSupportCount.textContent = `${supportSnapshot.count} aportes`;
        if (profileSponsorSummary) {
            profileSponsorSummary.textContent = supportSnapshot.total > 0
                ? `${formatCurrency(supportSnapshot.total)} aportados en ${supportSnapshot.count} movimiento(s).`
                : 'Sin aportes registrados por ahora.';
        }

        renderSponsorLevel(data.level);
        renderStreakDays(data.streak || 0);
        checkSpinCooldown(data.lastSpin);
        checkDailyCooldown(data.lastDaily);
        renderBadges(data, currentUser);

        if (profileAdminTools) profileAdminTools.hidden = !SPECIAL_ACCESS_ROLES.has(role);
    }

    async function loadDashboardData() {
        if (!currentUser) return;
        const [activity, updates, redemptions] = await Promise.all([
            getActivity(currentUser.uid, 8),
            loadProjectUpdates(5),
            loadRedemptionHistory(currentUser.uid)
        ]);
        renderActivity(activity);
        renderProjectFeed(updates);
        renderRedemptionHistory(redemptions);
    }

    authTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            authTabs.forEach((item) => item.classList.remove('active'));
            tab.classList.add('active');
            const loginActive = tab.dataset.tab === 'login';
            if (loginForm) loginForm.hidden = !loginActive;
            if (registerForm) registerForm.hidden = loginActive;
            setAuthMessage('');
        });
    });

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setAuthMessage('Iniciando sesion...');
        const email = String(document.getElementById('loginEmail')?.value || '').trim();
        const password = String(document.getElementById('loginPassword')?.value || '');
        try {
            await window.signInWithEmailAndPassword(window.auth, email, password);
        } catch (err) {
            setAuthMessage(getAuthErrorMessage(err), 'error');
        }
    });

    registerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = String(document.getElementById('registerEmail')?.value || '').trim();
        const password = String(document.getElementById('registerPassword')?.value || '');
        const referral = normalizeReferralCode(document.getElementById('registerReferral')?.value || getPendingReferralCode());

        const ready = await waitForFirebase();
        if (!ready) {
            setAuthMessage('Firebase aun no esta listo. Recarga la pagina e intenta nuevamente.', 'error');
            return;
        }

        try {
            setAuthMessage('Creando cuenta...');
            const credential = await window.createUserWithEmailAndPassword(window.auth, email, password);
            const baseUsername = String(email || '').split('@')[0] || 'Jugador';
            const usernameResolution = await resolveAvailableUsername(baseUsername, credential.user.uid);
            const finalUsername = usernameResolution.username || baseUsername;
            await window.updateProfile(credential.user, { displayName: finalUsername });
            const usernameNotice = usernameResolution.changed
                ? ` Tu nombre final es ${finalUsername}.`
                : '';

            try {
                await createUserDoc(credential.user, { displayName: finalUsername, username: finalUsername });
                const referralResult = referral ? await processReferral(referral, credential.user.uid) : { applied: false, reason: 'not-provided', reward: 0 };
                await addActivity(credential.user.uid, 'register', 'Cuenta creada', 0);
                setPendingReferralCode('');
                if (referralResult.reason === 'invalid') {
                    setAuthMessage(`Cuenta creada, pero el codigo de invitacion no existe.${usernameNotice}`, 'success');
                } else if (referralResult.reason === 'self') {
                    setAuthMessage(`Cuenta creada. No puedes usar tu propio codigo de invitacion.${usernameNotice}`, 'success');
                } else if (referralResult.applied) {
                    setAuthMessage(`Cuenta creada correctamente. Codigo aplicado: +${referralResult.reward} para quien te invito.${usernameNotice}`, 'success');
                } else {
                    setAuthMessage(`Cuenta creada correctamente.${usernameNotice}`, 'success');
                }
            } catch (profileErr) {
                if (isPermissionDeniedError(profileErr)) {
                    setAuthMessage('La cuenta SI se creo en Authentication, pero Firestore bloqueo crear el perfil (permission-denied). Inicia sesion y ajusta reglas de users.', 'error');
                } else {
                    throw profileErr;
                }
            }
            registerForm.reset();
        } catch (err) {
            setAuthMessage(getAuthErrorMessage(err), 'error');
        }
    });

    forgotPasswordLink?.addEventListener('click', async (event) => {
        event.preventDefault();
        const email = String(document.getElementById('loginEmail')?.value || '').trim();
        if (!email) {
            setAuthMessage('Ingresa tu correo primero.', 'error');
            return;
        }
        try {
            await window.sendPasswordResetEmail(window.auth, email);
            setAuthMessage('Correo de recuperacion enviado.', 'success');
        } catch (err) {
            setAuthMessage(getAuthErrorMessage(err), 'error');
        }
    });

    logoutBtn?.addEventListener('click', async () => {
        try {
            await window.signOut(window.auth);
        } catch (err) {
            console.error('Logout error:', err);
        }
    });

    spinBtn?.addEventListener('click', async () => {
        if (!currentUser || !currentUserData || spinBtn.disabled) return;
        spinBtn.disabled = true;
        if (spinMessage) spinMessage.textContent = '';
        playClickSound();
        const rotation = 1800 + Math.floor(Math.random() * 360);
        spinWheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        spinWheel.style.transform = `rotate(${rotation}deg)`;
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const segmentAngle = 360 / spinPrizes.length;
        const normalizedRotation = rotation % 360;
        const prizeIndex = Math.floor((360 - normalizedRotation + segmentAngle / 2) / segmentAngle) % spinPrizes.length;
        const prize = spinPrizes[prizeIndex];
        // Visual: mark winning label and animate pointer click
        try {
            const segments = Array.from(spinWheel.querySelectorAll('.spin-segment'));
            segments.forEach(s => s.classList.remove('winner'));
            const winnerEl = segments[prizeIndex];
            if (winnerEl) winnerEl.classList.add('winner');
            if (spinPointer) {
                playWinSound();
                try {
                    if (window.tsParticles && spinParticlesContainer) {
                        window.tsParticles.load(spinParticlesContainer.id, {
                            particles: {
                                number: { value: 0 },
                                move: { enable: true, gravity: { enable: true, acceleration: 9 }, speed: 10, outModes: { default: 'destroy' } },
                                size: { value: { min: 6, max: 12 } },
                                color: { value: ['#f97316', '#f0c419', '#4ade80', '#06b6d4', '#a855f7', '#ec4899'] },
                                shape: { type: ['circle', 'square'] }
                            },
                            emitters: [{
                                direction: 'top', life: { count: 1, duration: 0.4 }, rate: { quantity: 40, delay: 0 }, size: { width: 0, height: 0 }, position: { x: 50, y: 50 }
                            }]
                        });
                    }
                } catch (err) { /* ignore particles errors */ }
                spinPointer.classList.add('click');
                setTimeout(() => spinPointer.classList.remove('click'), 900);
            }
        } catch (err) { /* ignore visual errors */ }
        const newCoins = Number(currentUserData.coins || 0) + prize;
        const now = new Date().toISOString();

        await updateUserData(currentUser.uid, { coins: newCoins, lastSpin: now });
        await addActivity(currentUser.uid, 'spin', `Ruleta: ganaste ${prize} monedas`, prize);

        currentUserData.coins = newCoins;
        currentUserData.lastSpin = now;
        renderProfile();
        await loadDashboardData();

        if (spinMessage) {
            spinMessage.textContent = `Ganaste ${prize} monedas!`;
            spinMessage.className = 'spin-message success';
        }
        spinWheel.style.transition = 'none';
    });

    claimDailyBtn?.addEventListener('click', async () => {
        if (!currentUser || !currentUserData || claimDailyBtn.disabled) return;
        claimDailyBtn.disabled = true;

        const baseBonus = Number(settings.dailyBonusCoins || 10);
        const now = new Date();
        const lastDaily = currentUserData.lastDaily ? new Date(currentUserData.lastDaily) : null;
        let streak = 1;

        if (lastDaily) {
            const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const lastDay = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
            if (lastDay.getTime() === yesterday.getTime()) streak = Number(currentUserData.streak || 0) + 1;
        }

        const streakBonus = streak >= 7 ? baseBonus : 0;
        const totalBonus = baseBonus + streakBonus;
        const newCoins = Number(currentUserData.coins || 0) + totalBonus;
        const nowIso = now.toISOString();

        await updateUserData(currentUser.uid, {
            coins: newCoins,
            streak,
            lastDaily: nowIso
        });
        await addActivity(currentUser.uid, 'daily', 'Bonus diario reclamado', totalBonus);

        currentUserData.coins = newCoins;
        currentUserData.streak = streak;
        currentUserData.lastDaily = nowIso;
        renderProfile();
        await loadDashboardData();

        if (dailyBonusMessage) {
            dailyBonusMessage.textContent = `+${totalBonus} monedas${streakBonus ? ' con bonus de racha' : ''}`;
            dailyBonusMessage.className = 'spin-message success';
        }
    });

    copyReferralBtn?.addEventListener('click', async () => {
        const code = String(referralCode?.textContent || '').trim();
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            copyReferralBtn.textContent = 'Copiado!';
            setTimeout(() => { copyReferralBtn.textContent = 'Copiar'; }, 1800);
        } catch {}
    });

    redeemBtn?.addEventListener('click', async () => {
        if (!currentUser || !currentUserData) return;
        if (redeemBtn) redeemBtn.disabled = true;
        if (redeemMessage) { redeemMessage.textContent = 'Procesando...'; redeemMessage.className = 'mg-game-result'; }

        const result = await submitRedemption(
            currentUser.uid,
            redeemAmountInput?.value || '0'
        );

        if (redeemMessage) {
            redeemMessage.textContent = result.msg;
            redeemMessage.className = `mg-game-result ${result.ok ? 'success' : 'error'}`;
        }
        if (result.ok) {
            if (redeemAmountInput) redeemAmountInput.value = '';
            renderProfile();
            await loadDashboardData();
        }
        if (redeemBtn) redeemBtn.disabled = false;
    });

    editProfileBtn?.addEventListener('click', () => {
        if (!currentUserData || !editProfileModal) return;
        document.getElementById('editDisplayName').value = currentUserData.displayName || currentUser.displayName || '';
        document.getElementById('editBio').value = currentUserData.bio || '';
        document.getElementById('editFavoriteProject').value = currentUserData.favoriteProject || '';
        document.getElementById('editCountry').value = currentUserData.country || '';
        document.getElementById('editAvatarValue').value = currentUserData.avatar || '😊';
        document.querySelectorAll('.avatar-option').forEach((button) => {
            button.classList.toggle('selected', button.dataset.avatar === (currentUserData.avatar || '😊'));
        });
        editProfileModal.showModal();
    });

    document.querySelectorAll('.avatar-option').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach((item) => item.classList.remove('selected'));
            button.classList.add('selected');
            document.getElementById('editAvatarValue').value = button.dataset.avatar || '😊';
        });
    });

    editProfileForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentUser) return;
        const displayName = String(document.getElementById('editDisplayName')?.value || '').trim();
        const bio = String(document.getElementById('editBio')?.value || '').trim();
        const favoriteProject = String(document.getElementById('editFavoriteProject')?.value || '').trim();
        const country = String(document.getElementById('editCountry')?.value || '').trim();
        const avatar = String(document.getElementById('editAvatarValue')?.value || '😊');

        await updateUserData(currentUser.uid, { displayName, bio, favoriteProject, country, avatar });
        await window.updateProfile(currentUser, { displayName });
        await addActivity(currentUser.uid, 'profile', 'Perfil actualizado', 0);

        currentUserData = {
            ...currentUserData,
            displayName,
            bio,
            favoriteProject,
            country,
            avatar
        };

        renderProfile();
        await loadDashboardData();
        editProfileModal.close();
    });

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => {
            const modal = document.getElementById(button.getAttribute('data-close-modal') || '');
            if (modal && typeof modal.close === 'function') modal.close();
        });
    });

    async function handleAuthStateChange(user) {
        currentUser = user;
        if (!user) {
            currentUserData = null;
            showAuth();
            return;
        }

        currentUserData = await getUserData(user.uid);
        if (!currentUserData) {
            try {
                currentUserData = await createUserDoc(user, { displayName: user.displayName || user.email?.split('@')[0] || 'Miembro' });
            } catch (err) {
                if (isPermissionDeniedError(err)) {
                    currentUserData = {
                        displayName: user.displayName || user.email?.split('@')[0] || 'Miembro',
                        username: user.displayName || user.email?.split('@')[0] || 'Miembro',
                        email: user.email || '',
                        avatar: '😊',
                        bio: '',
                        favoriteProject: 'Nuestra Tierra Job Simulator',
                        country: 'No definido',
                        coins: 0,
                        emeralds: 0,
                        level: 'visitor',
                        referralCode: generateReferralCode(user.uid),
                        referredBy: null,
                        referralCount: 0,
                        referralCoins: 0,
                        streak: 0,
                        lastDaily: null,
                        lastSpin: null,
                        role: 'viewer',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    setAuthMessage('Tu cuenta existe, pero Firestore no permite guardar perfil. Ajusta reglas de users para habilitar monedas e historial.', 'error');
                } else {
                    throw err;
                }
            }
        }

        supportSnapshot = await loadSupportSnapshot(user);
        preregSnapshot = await loadPreregisterSnapshot(user);
        showDashboard();
        renderProfile();
        await loadDashboardData();
    }

    async function init() {
        const ready = await waitForFirebase();
        if (!ready) {
            setAuthMessage('No se pudo conectar con Firebase.', 'error');
            return;
        }
        prefillReferralField();
        settings = await loadSettings();
        if (dailyBonusAmount) dailyBonusAmount.textContent = String(Number(settings.dailyBonusCoins || 10));
        buildSpinLabels();
        window.onAuthStateChanged(window.auth, (user) => {
            handleAuthStateChange(user).catch((err) => {
                console.error('Perfil auth error:', err);
                setAuthMessage('No se pudo cargar tu perfil.', 'error');
            });
        });
    }

    init();
})();
