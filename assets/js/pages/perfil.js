(function () {
    const SITE_ROOT = (document.body?.dataset.siteRoot || '.').replace(/\/$/, '');
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
            'auth/too-many-requests': 'Demasiados intentos. Espera un momento.'
        };
        return map[code] || err?.message || 'Ocurrio un error inesperado.';
    }

    function generateReferralCode(uid) {
        return String(uid || '').slice(0, 6).toUpperCase();
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
            level: 'visitor',
            referralCode: generateReferralCode(user.uid),
            referredBy: extras.referredBy || null,
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
        if (!refCode) return;
        const normalized = String(refCode).trim().toUpperCase();
        if (!normalized) return;
        try {
            const snap = await window.getDocs(window.collection(window.db, 'users'));
            const referrer = snap.docs.find((doc) => String(doc.data()?.referralCode || '').toUpperCase() === normalized);
            if (!referrer || referrer.id === newUserUid) return;
            const reward = Number(settings.referralCoins || 50);
            const data = referrer.data() || {};
            await updateUserData(referrer.id, {
                referralCount: Number(data.referralCount || 0) + 1,
                referralCoins: Number(data.referralCoins || 0) + reward,
                coins: Number(data.coins || 0) + reward
            });
            await addActivity(referrer.id, 'referral', 'Nuevo referido registrado', reward);
        } catch (err) {
            console.warn('No se pudo procesar referido:', err);
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
            profile: '📝'
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
            dashboard.hidden = false;
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
        const [activity, updates] = await Promise.all([
            getActivity(currentUser.uid, 8),
            loadProjectUpdates(5)
        ]);
        renderActivity(activity);
        renderProjectFeed(updates);
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
        setAuthMessage('Creando cuenta...');
        const name = String(document.getElementById('registerName')?.value || '').trim();
        const email = String(document.getElementById('registerEmail')?.value || '').trim();
        const password = String(document.getElementById('registerPassword')?.value || '');
        const referral = String(document.getElementById('registerReferral')?.value || '').trim();
        try {
            const credential = await window.createUserWithEmailAndPassword(window.auth, email, password);
            await window.updateProfile(credential.user, { displayName: name });
            await createUserDoc(credential.user, { displayName: name, username: name, referredBy: referral || null });
            if (referral) await processReferral(referral, credential.user.uid);
            await addActivity(credential.user.uid, 'register', 'Cuenta creada', 0);
            setAuthMessage('Cuenta creada correctamente.', 'success');
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
        const rotation = 1800 + Math.floor(Math.random() * 360);
        spinWheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        spinWheel.style.transform = `rotate(${rotation}deg)`;
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const segmentAngle = 360 / spinPrizes.length;
        const normalizedRotation = rotation % 360;
        const prizeIndex = Math.floor((360 - normalizedRotation + segmentAngle / 2) / segmentAngle) % spinPrizes.length;
        const prize = spinPrizes[prizeIndex];
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
            currentUserData = await createUserDoc(user, { displayName: user.displayName || user.email?.split('@')[0] || 'Miembro' });
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
        settings = await loadSettings();
        if (dailyBonusAmount) dailyBonusAmount.textContent = String(Number(settings.dailyBonusCoins || 10));
        window.onAuthStateChanged(window.auth, (user) => {
            handleAuthStateChange(user).catch((err) => {
                console.error('Perfil auth error:', err);
                setAuthMessage('No se pudo cargar tu perfil.', 'error');
            });
        });
    }

    init();
})();
