// Perfil de Usuario - Panter Studio
(function () {
    // DOM Elements - Auth
    const authSection = document.getElementById('profileAuthSection');
    const dashboard = document.getElementById('profileDashboard');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');
    const authTabs = document.querySelectorAll('.auth-tab');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // DOM Elements - Profile
    const profileAvatar = document.getElementById('profileAvatar');
    const profileAvatarLetter = document.getElementById('profileAvatarLetter');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileEmail = document.getElementById('profileEmail');
    const profileCoins = document.getElementById('profileCoins');
    const profileLevel = document.getElementById('profileLevel');
    const profileJoinDate = document.getElementById('profileJoinDate');
    const profileBadges = document.getElementById('profileBadges');
    const coinsDisplayLarge = document.getElementById('coinsDisplayLarge');
    const logoutBtn = document.getElementById('logoutBtn');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const activityList = document.getElementById('activityList');

    // DOM Elements - Spin
    const spinWheel = document.getElementById('spinWheel');
    const spinBtn = document.getElementById('spinBtn');
    const spinMessage = document.getElementById('spinMessage');
    const spinCooldown = document.getElementById('spinCooldown');

    // DOM Elements - Daily Bonus
    const claimDailyBtn = document.getElementById('claimDailyBtn');
    const dailyBonusMessage = document.getElementById('dailyBonusMessage');
    const dailyBonusAmount = document.getElementById('dailyBonusAmount');
    const profileStreak = document.getElementById('profileStreak');
    const streakDays = document.querySelectorAll('.streak-day');

    // DOM Elements - Referrals
    const referralCode = document.getElementById('referralCode');
    const copyReferralBtn = document.getElementById('copyReferralBtn');
    const referralCount = document.getElementById('referralCount');
    const referralCoins = document.getElementById('referralCoins');

    // DOM Elements - Sponsor
    const sponsorBadge = document.getElementById('sponsorBadge');
    const sponsorLevelName = document.getElementById('sponsorLevelName');
    const sponsorLevelDesc = document.getElementById('sponsorLevelDesc');

    let currentUser = null;
    let currentUserData = null;
    let spinPrizes = [5, 10, 25, 50, 100, 5, 10, 25];
    let settings = {};

    function esc(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
    }

    function generateReferralCode(uid) {
        return uid.slice(0, 6).toUpperCase();
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.auth && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.updateDoc) {
                return resolve(true);
            }
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.auth && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.updateDoc) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function loadSettings() {
        try {
            const docRef = window.fsDoc(window.db, 'settings', 'site');
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return {};
            return snapshot.data() || {};
        } catch (err) {
            return {};
        }
    }

    async function loadMinigameSettings() {
        try {
            const docRef = window.fsDoc(window.db, 'settings', 'minigames');
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return {};
            return snapshot.data() || {};
        } catch (err) {
            return {};
        }
    }

    async function getUserData(uid) {
        try {
            const docRef = window.fsDoc(window.db, 'users', uid);
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return null;
            return snapshot.data();
        } catch (err) {
            console.warn('Error getting user data:', err);
            return null;
        }
    }

    async function createUserDoc(uid, data) {
        try {
            const docRef = window.fsDoc(window.db, 'users', uid);
            await window.setDoc(docRef, {
                displayName: data.displayName || '',
                email: data.email || '',
                avatar: '😊',
                coins: 0,
                level: 'visitor',
                referralCode: generateReferralCode(uid),
                referredBy: data.referredBy || null,
                referralCount: 0,
                referralCoins: 0,
                streak: 0,
                lastDaily: null,
                lastSpin: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (err) {
            console.error('Error creating user doc:', err);
            return false;
        }
    }

    async function updateUserData(uid, data) {
        try {
            const docRef = window.fsDoc(window.db, 'users', uid);
            await window.updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (err) {
            console.error('Error updating user data:', err);
            return false;
        }
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
            console.warn('Error adding activity:', err);
        }
    }

    async function getActivity(uid, limit = 10) {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'users', uid, 'activity'));
            const activities = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            return activities
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, limit);
        } catch (err) {
            return [];
        }
    }

    async function processReferral(referralCode, newUserUid) {
        if (!referralCode) return;
        try {
            const snap = await window.getDocs(window.collection(window.db, 'users'));
            const referrer = snap.docs.find((doc) => doc.data().referralCode === referralCode.toUpperCase());
            if (!referrer || referrer.id === newUserUid) return;

            const referrerData = referrer.data();
            const referralCoinsReward = settings.referralCoins || 50;

            await window.updateDoc(window.fsDoc(window.db, 'users', referrer.id), {
                referralCount: (referrerData.referralCount || 0) + 1,
                referralCoins: (referrerData.referralCoins || 0) + referralCoinsReward,
                coins: (referrerData.coins || 0) + referralCoinsReward,
                updatedAt: new Date().toISOString()
            });

            await addActivity(referrer.id, 'referral', `Nuevo referido registrado`, referralCoinsReward);
        } catch (err) {
            console.warn('Error processing referral:', err);
        }
    }

    function showAuth() {
        authSection.hidden = false;
        dashboard.hidden = true;
    }

    function showDashboard() {
        authSection.hidden = true;
        dashboard.hidden = false;
    }

    function renderProfile() {
        if (!currentUser || !currentUserData) return;

        const data = currentUserData;
        const avatar = data.avatar || '😊';
        const name = data.displayName || currentUser.email.split('@')[0];

        if (profileAvatarLetter) profileAvatarLetter.textContent = avatar;
        if (profileDisplayName) profileDisplayName.textContent = esc(name);
        if (profileEmail) profileEmail.textContent = esc(currentUser.email);
        if (profileCoins) profileCoins.textContent = String(data.coins || 0);
        if (coinsDisplayLarge) coinsDisplayLarge.textContent = String(data.coins || 0);
        if (profileLevel) profileLevel.textContent = esc(getLevelName(data.level));
        if (profileJoinDate) profileJoinDate.textContent = formatDate(data.createdAt);
        if (referralCode) referralCode.textContent = data.referralCode || generateReferralCode(currentUser.uid);
        if (referralCount) referralCount.textContent = String(data.referralCount || 0);
        if (referralCoins) referralCoins.textContent = String(data.referralCoins || 0);
        if (profileStreak) profileStreak.textContent = String(data.streak || 0);

        renderStreakDays(data.streak || 0);
        renderSponsorLevel(data.level);
        checkSpinCooldown(data.lastSpin);
        checkDailyCooldown(data.lastDaily);
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
        return levels[level] || 'Visitante';
    }

    function renderStreakDays(streak) {
        streakDays.forEach((el) => {
            const day = parseInt(el.dataset.day, 10);
            if (day <= streak % 7 || (streak >= 7 && day === 7)) {
                el.classList.add('completed');
            } else {
                el.classList.remove('completed');
            }
        });
    }

    function renderSponsorLevel(level) {
        const badges = {
            visitor: '👤',
            supporter: '💖',
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            platinum: '💎',
            founder: '🏆'
        };
        const descriptions = {
            visitor: 'Haz una donacion para subir de nivel.',
            supporter: 'Gracias por tu apoyo!',
            bronze: 'Miembro Bronce - Beneficios basicos activos.',
            silver: 'Miembro Plata - Acceso anticipado incluido.',
            gold: 'Miembro Oro - Contenido exclusivo desbloqueado.',
            platinum: 'Miembro Platino - Todos los beneficios activos.',
            founder: 'Fundador - Leyenda de la comunidad.'
        };

        if (sponsorBadge) sponsorBadge.textContent = badges[level] || '👤';
        if (sponsorLevelName) sponsorLevelName.textContent = getLevelName(level);
        if (sponsorLevelDesc) sponsorLevelDesc.textContent = descriptions[level] || '';
    }

    function checkSpinCooldown(lastSpin) {
        if (!lastSpin) {
            if (spinBtn) spinBtn.disabled = false;
            if (spinCooldown) spinCooldown.textContent = '';
            return;
        }

        const last = new Date(lastSpin);
        const now = new Date();
        const nextSpin = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
        const diff = nextSpin - now;

        if (diff <= 0) {
            if (spinBtn) spinBtn.disabled = false;
            if (spinCooldown) spinCooldown.textContent = '';
        } else {
            if (spinBtn) spinBtn.disabled = true;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (spinCooldown) spinCooldown.textContent = `Proximo giro en ${hours}h ${mins}m`;
        }
    }

    function checkDailyCooldown(lastDaily) {
        if (!lastDaily) {
            if (claimDailyBtn) claimDailyBtn.disabled = false;
            return;
        }

        const last = new Date(lastDaily);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());

        if (today > lastDay) {
            if (claimDailyBtn) claimDailyBtn.disabled = false;
        } else {
            if (claimDailyBtn) claimDailyBtn.disabled = true;
        }
    }

    async function loadActivity() {
        if (!currentUser) return;
        const activities = await getActivity(currentUser.uid, 5);

        if (!activities.length) {
            activityList.innerHTML = '<li>Sin actividad reciente</li>';
            return;
        }

        activityList.innerHTML = activities
            .map((a) => {
                const coinsStr = a.coins ? ` (+${a.coins} 🪙)` : '';
                return `<li>${esc(a.description)}${coinsStr}</li>`;
            })
            .join('');
    }

    // Auth Tab Switching
    authTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            authTabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'login') {
                loginForm.hidden = false;
                registerForm.hidden = true;
            } else {
                loginForm.hidden = true;
                registerForm.hidden = false;
            }
            authMessage.textContent = '';
        });
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authMessage.textContent = 'Iniciando sesion...';
        authMessage.className = 'profile-auth-message';

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            await window.signInWithEmailAndPassword(window.auth, email, password);
        } catch (err) {
            authMessage.textContent = `Error: ${err.message}`;
            authMessage.className = 'profile-auth-message error';
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authMessage.textContent = 'Creando cuenta...';
        authMessage.className = 'profile-auth-message';

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const referral = document.getElementById('registerReferral').value.trim();

        try {
            const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
            const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
            const user = userCredential.user;

            await createUserDoc(user.uid, {
                displayName: name,
                email: email,
                referredBy: referral || null
            });

            if (referral) {
                await processReferral(referral, user.uid);
            }

            await addActivity(user.uid, 'register', 'Cuenta creada', 0);
        } catch (err) {
            authMessage.textContent = `Error: ${err.message}`;
            authMessage.className = 'profile-auth-message error';
        }
    });

    // Forgot Password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            if (!email) {
                authMessage.textContent = 'Ingresa tu correo primero';
                return;
            }

            try {
                const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
                await sendPasswordResetEmail(window.auth, email);
                authMessage.textContent = 'Correo de recuperacion enviado!';
                authMessage.className = 'profile-auth-message success';
            } catch (err) {
                authMessage.textContent = `Error: ${err.message}`;
                authMessage.className = 'profile-auth-message error';
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await window.signOut(window.auth);
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }

    // Spin Wheel
    if (spinBtn) {
        spinBtn.addEventListener('click', async () => {
            if (!currentUser || !currentUserData) return;
            spinBtn.disabled = true;
            spinMessage.textContent = '';

            // Animate
            const rotation = 1800 + Math.floor(Math.random() * 360);
            spinWheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
            spinWheel.style.transform = `rotate(${rotation}deg)`;

            await new Promise((r) => setTimeout(r, 4000));

            // Calculate prize
            const segmentAngle = 360 / spinPrizes.length;
            const normalizedRotation = rotation % 360;
            const prizeIndex = Math.floor((360 - normalizedRotation + segmentAngle / 2) / segmentAngle) % spinPrizes.length;
            const prize = spinPrizes[prizeIndex];

            const newCoins = (currentUserData.coins || 0) + prize;
            await updateUserData(currentUser.uid, {
                coins: newCoins,
                lastSpin: new Date().toISOString()
            });

            await addActivity(currentUser.uid, 'spin', `Ruleta: ganaste ${prize} monedas`, prize);

            currentUserData.coins = newCoins;
            currentUserData.lastSpin = new Date().toISOString();
            renderProfile();
            spinMessage.textContent = `Ganaste ${prize} monedas!`;
            spinMessage.className = 'spin-message success';
            spinWheel.style.transition = 'none';
        });
    }

    // Daily Bonus
    if (claimDailyBtn) {
        claimDailyBtn.addEventListener('click', async () => {
            if (!currentUser || !currentUserData) return;
            claimDailyBtn.disabled = true;

            const bonusCoins = settings.dailyBonusCoins || 10;
            const lastDaily = currentUserData.lastDaily ? new Date(currentUserData.lastDaily) : null;
            const now = new Date();
            let newStreak = 1;

            if (lastDaily) {
                const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                const lastDailyDay = new Date(lastDaily.getFullYear(), lastDaily.getMonth(), lastDaily.getDate());
                if (lastDailyDay.getTime() === yesterday.getTime()) {
                    newStreak = (currentUserData.streak || 0) + 1;
                }
            }

            const streakBonus = newStreak >= 7 ? bonusCoins : 0;
            const totalBonus = bonusCoins + streakBonus;
            const newCoins = (currentUserData.coins || 0) + totalBonus;

            await updateUserData(currentUser.uid, {
                coins: newCoins,
                streak: newStreak,
                lastDaily: new Date().toISOString()
            });

            await addActivity(currentUser.uid, 'daily', `Bonus diario reclamado`, totalBonus);

            currentUserData.coins = newCoins;
            currentUserData.streak = newStreak;
            currentUserData.lastDaily = new Date().toISOString();
            renderProfile();

            dailyBonusMessage.textContent = `+${totalBonus} monedas${streakBonus ? ' (incluye bonus de racha!)' : ''}`;
            dailyBonusMessage.className = 'spin-message success';
        });
    }

    // Copy Referral
    if (copyReferralBtn) {
        copyReferralBtn.addEventListener('click', () => {
            const code = referralCode.textContent;
            navigator.clipboard.writeText(code).then(() => {
                copyReferralBtn.textContent = 'Copiado!';
                setTimeout(() => (copyReferralBtn.textContent = 'Copiar'), 2000);
            });
        });
    }

    // Edit Profile
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            document.getElementById('editDisplayName').value = currentUserData?.displayName || '';
            document.getElementById('editAvatarValue').value = currentUserData?.avatar || '😊';
            editProfileModal.showModal();
        });
    }

    // Avatar Picker
    document.querySelectorAll('.avatar-option').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('editAvatarValue').value = btn.dataset.avatar;
        });
    });

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const newName = document.getElementById('editDisplayName').value.trim();
            const newAvatar = document.getElementById('editAvatarValue').value || '😊';

            await updateUserData(currentUser.uid, {
                displayName: newName,
                avatar: newAvatar
            });

            currentUserData.displayName = newName;
            currentUserData.avatar = newAvatar;
            renderProfile();
            editProfileModal.close();
        });
    }

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close-modal');
            const modal = document.getElementById(modalId);
            if (modal && typeof modal.close === 'function') modal.close();
        });
    });

    // Auth State
    async function handleAuthStateChange(user) {
        currentUser = user;
        if (user) {
            currentUserData = await getUserData(user.uid);
            if (!currentUserData) {
                await createUserDoc(user.uid, { email: user.email });
                currentUserData = await getUserData(user.uid);
            }
            showDashboard();
            renderProfile();
            loadActivity();
        } else {
            currentUserData = null;
            showAuth();
        }
    }

    async function init() {
        const ready = await waitForFirebase();
        if (!ready) {
            authMessage.textContent = 'Error: No se pudo conectar con Firebase';
            authMessage.className = 'profile-auth-message error';
            return;
        }

        settings = await loadSettings();
        const minigameSettings = await loadMinigameSettings();
        settings = { ...settings, ...minigameSettings };

        if (dailyBonusAmount) dailyBonusAmount.textContent = String(settings.dailyBonusCoins || 10);

        window.onAuthStateChanged(window.auth, handleAuthStateChange);
    }

    init();
})();
