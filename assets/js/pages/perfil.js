/* perfil.js — Panter Studio */
(function () {
  'use strict';

  /* ── Constantes ── */
  const REFERRAL_STORAGE_KEY  = 'panterPendingReferralCode';
  const COINS_PER_EXCHANGE    = 50000;
  const EMERALDS_PER_EXCHANGE = 50;
  const MIN_REDEEM_COINS      = 50000;
  const REDEEM_COLLECTION     = 'coin_redemptions';

  const ROLE_LABELS = {
    founder_ceo: 'Fundador / CEO', director: 'Director', administrador: 'Administrador',
    programador: 'Programador',    modelador: 'Modelador',
    usuario: 'Miembro',            viewer: 'Miembro',
    vip: 'VIP',                    community_manager: 'Community Manager',
    support_ops: 'Soporte',        youtuber: 'Youtuber',
    streamer: 'Streamer'
  };
  const SPECIAL_ACCESS_ROLES = new Set(['founder_ceo','director','administrador','programador','modelador']);

  /* ── DOM ── */
  const $  = id  => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const authSection  = $('profileAuthSection');
  const dashboard    = $('profileDashboard');
  const loginForm    = $('loginForm');
  const registerForm = $('registerForm');
  const authMessage  = $('authMessage');
  const authTabs     = $$('.auth-tab');
  const forgotLink   = $('forgotPasswordLink');

  const profileAvatarLetter           = $('profileAvatarLetter');
  const editProfileImagePreview       = $('editProfileImagePreview');
  const editProfileImageInput         = $('editProfileImage');
  const removeProfileImageBtn         = $('removeProfileImageBtn');
  const profileDisplayName            = $('profileDisplayName');
  const profileEmail                  = $('profileEmail');
  const profileCoins                  = $('profileCoins');
  const profileCoinsDollars           = $('profileCoinsDollars');
  const profileLevel                  = $('profileLevel');
  const profileLevelText              = $('profileLevelText');
  const profileLevelBarFill           = $('profileLevelBarFill');
  const profileRole                   = $('profileRole');
  const profileRoleText               = $('profileRoleText');
  const profileJoinDate               = $('profileJoinDate');
  const profileBadges                 = $('profileBadges');
  const profileBadgesSidebar          = $('profileBadgesSidebar');
  const profileUid                    = $('profileUid');
  const profileStreak                 = $('profileStreak');
  const profileStreakText             = $('profileStreakText');
  const profileVerificationStatusSide = $('profileVerificationStatusSide');
  const profileProviderSide           = $('profileProviderSide');
  const profilePreregisterStatusSide  = $('profilePreregisterStatusSide');
  const profileAccessLevel            = $('profileAccessLevel');
  const profileCountry                = $('profileCountry');
  const profileFavoriteProject        = $('profileFavoriteProject');
  const profileBio                    = $('profileBio');
  const profileSupportTotal           = $('profileSupportTotal');
  const profileSupportCount           = $('profileSupportCount');
  const profileSponsorSummary         = $('profileSponsorSummary');
  const profileAdminTools             = $('profileAdminTools');
  const profileBetaTesterCard         = $('profileBetaTesterCard');
  const profileGamesPlayedToday       = $('profileGamesPlayedToday');
  const gameUsername                  = $('gameUsername');
  const gameConductorId               = $('gameConductorId');
  const gameCoins                     = $('gameCoins');
  const gameEmeralds                  = $('gameEmeralds');
  const gameLastSync                  = $('gameLastSync');

  const sponsorBadge     = $('sponsorBadge');
  const sponsorLevelName = $('sponsorLevelName');
  const sponsorLevelDesc = $('sponsorLevelDesc');

  const logoutBtn        = $('logoutBtn');
  const editProfileBtn   = $('editProfileBtn');
  const editProfileModal = $('editProfileModal');
  const editProfileForm  = $('editProfileForm');
  const activityList     = $('activityList');
  const projectUpdateFeed= $('projectUpdateFeed');

  const claimDailyBtn    = $('claimDailyBtn');
  const dailyBonusAmount = $('dailyBonusAmount');
  const dailyBonusMessage= $('dailyBonusMessage');
  const streakDays       = $$('.streak-day');

  const referralCode    = $('referralCode');
  const copyReferralBtn = $('copyReferralBtn');
  const referralCount   = $('referralCount');
  const referralCoins   = $('referralCoins');

  const redeemCoinsAvailable = $('redeemCoinsAvailable');
  const redeemDollars        = $('redeemDollars');
  const redeemTotalPaid      = $('redeemTotalPaid');
  const redeemTotalCount     = $('redeemTotalCount');
  const redeemAmountInput    = $('redeemAmount');
  const redeemBtn            = $('redeemBtn');
  const redeemMessage        = $('redeemMessage');
  const redeemHistory        = $('redeemHistory');
  const redeemHistoryList    = $('redeemHistoryList');

  /* ── Estado ── */
  let currentUser     = null;
  let currentUserData = null;
  let currentConductorData = null;
  let settings        = {};
  let supportSnapshot = { total: 0, count: 0, sponsor: null };
  let preregSnapshot  = { registered: false, data: null };

  /* ── Helpers básicos ── */
  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatDate(v) {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d) ? '-' : d.toLocaleDateString('es-ES', { year:'numeric', month:'short' });
  }
  function formatDateLong(v) {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d) ? '-' : d.toLocaleDateString('es-ES', { year:'numeric', month:'short', day:'2-digit' });
  }
  function coinsToEmeralds(c) { return Math.floor((Number(c || 0) / COINS_PER_EXCHANGE) * EMERALDS_PER_EXCHANGE); }
  function formatEmeralds(v)  { return `${Number(v || 0)} Esmeraldas`; }
  function roleLabel(r)       { return ROLE_LABELS[String(r || 'viewer').toLowerCase()] || 'Miembro'; }
  function providerLabel(u)   { const id = u?.providerData?.[0]?.providerId || 'password'; return id.includes('google') ? 'Google' : id.includes('password') ? 'Email' : id; }
  function generateReferralCode(uid) { return String(uid || '').slice(0, 6).toUpperCase(); }
  function normalizeCode(c)   { return String(c || '').replace(/\s+/g,'').trim().toUpperCase().slice(0, 32); }
  function getLevelName(l) {
    const m = { visitor:'Visitante', supporter:'Apoyo', bronze:'Bronce', silver:'Plata', gold:'Oro', platinum:'Platino', founder:'Fundador' };
    return m[String(l || '').toLowerCase()] || 'Visitante';
  }
  function isPermDenied(err) {
    const c = String(err?.code || ''), m = String(err?.message || '');
    return c.includes('permission-denied') || m.includes('permission-denied');
  }
  function countGamesPlayedToday(uid) {
    const today = new Date().toDateString(); let n = 0;
    ['game1','game2','game3'].forEach(id => {
      try { const k = `panterMG_${id}_${uid}`, s = localStorage.getItem(k); if (s && new Date(s).toDateString() === today) n++; } catch {}
    });
    return n;
  }

  /* ── Referral storage ── */
  function setPendingCode(c) {
    try { const n = normalizeCode(c); if (n) localStorage.setItem(REFERRAL_STORAGE_KEY, n); else localStorage.removeItem(REFERRAL_STORAGE_KEY); return n; } catch { return ''; }
  }
  function getPendingCode() {
    let url = '';
    try { const p = new URLSearchParams(window.location.search); url = normalizeCode(p.get('ref') || p.get('invite') || p.get('invitation') || p.get('codigo') || ''); } catch {}
    if (url) return setPendingCode(url);
    try { return normalizeCode(localStorage.getItem(REFERRAL_STORAGE_KEY) || ''); } catch { return ''; }
  }
  function prefillReferralField() {
    const inp = $('registerReferral'); if (!inp || inp.value.trim()) return;
    const c = getPendingCode(); if (c) inp.value = c;
  }

  /* ── Auth messages ── */
  function setAuthMessage(text, type) {
    if (!authMessage) return;
    authMessage.textContent = text || '';
    authMessage.className   = `auth-msg${type ? ' ' + type : ''}`;
  }
  function getAuthError(err) {
    const map = {
      'auth/user-not-found':       'No existe cuenta con ese correo.',
      'auth/wrong-password':       'Contraseña incorrecta.',
      'auth/invalid-credential':   'Credenciales inválidas.',
      'auth/invalid-email':        'Correo inválido.',
      'auth/email-already-in-use': 'Ese correo ya está registrado.',
      'auth/weak-password':        'Contraseña muy débil (mínimo 6 caracteres).',
      'auth/network-request-failed':'Error de red.',
      'auth/too-many-requests':    'Demasiados intentos. Espera un momento.'
    };
    return map[String(err?.code || '')] || err?.message || 'Error inesperado.';
  }

  /* ── Firebase wait ── */
  function waitForFirebase(timeout = 7000) {
    return new Promise(resolve => {
      const ok = () => window.db && window.auth && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.setDoc && window.updateDoc && window.addDoc && window.signInWithEmailAndPassword && window.createUserWithEmailAndPassword && window.signOut && window.updateProfile && window.sendPasswordResetEmail && window.onAuthStateChanged;
      if (ok()) return resolve(true);
      const start = Date.now();
      const t = setInterval(() => { if (ok()) { clearInterval(t); resolve(true); } else if (Date.now() - start > timeout) { clearInterval(t); resolve(false); } }, 100);
    });
  }

  /* ── Firestore helpers ── */
  async function loadSettings() {
    try {
      const [a, b] = await Promise.all([
        window.getDoc(window.fsDoc(window.db, 'settings', 'site')).catch(() => null),
        window.getDoc(window.fsDoc(window.db, 'settings', 'minigames')).catch(() => null)
      ]);
      return { ...(a && a.exists() ? a.data() || {} : {}), ...(b && b.exists() ? b.data() || {} : {}) };
    } catch { return {}; }
  }

  async function getUserData(uid) {
    try { const s = await window.getDoc(window.fsDoc(window.db, 'conductores', uid)); return s.exists() ? s.data() || null : null; } catch { return null; }
  }

  async function getConductorData(uid) {
    return getUserData(uid);
  }

  async function createUserDoc(user, extras = {}) {
    const now  = new Date().toISOString();
    const name = extras.displayName || user.displayName || user.email?.split('@')[0] || 'Miembro';
    const payload = {
      displayName: name, nombre_usuario: name, username: extras.username || name, email: user.email || '',
      avatar: '😊', bio: '', favoriteProject: 'Nuestra Tierra Job Simulator',
      country: 'Colombia', coins: 0, emeralds: 0, level: 'visitor',
      referralCode: generateReferralCode(user.uid), referredBy: null,
      referralCount: 0, referralCoins: 0, streak: 0, lastDaily: null,
      role: extras.role || 'viewer', createdAt: now, updatedAt: now
    };
    await window.setDoc(window.fsDoc(window.db, 'conductores', user.uid), payload, { merge: true });
    return payload;
  }

  async function updateUserData(uid, data) {
    await window.setDoc(window.fsDoc(window.db, 'conductores', uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  }

  async function addActivity(uid, type, description, coins = 0) {
    try { await window.addDoc(window.collection(window.db, 'conductores', uid, 'activity'), { type, description, coins, createdAt: new Date().toISOString() }); }
    catch (e) { console.warn('Activity:', e); }
  }

  async function getActivity(uid, limit = 8) {
    try {
      const s = await window.getDocs(window.collection(window.db, 'conductores', uid, 'activity'));
      return s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, limit);
    } catch { return []; }
  }

  async function isUsernameTaken(username, excludeUid = '') {
    if (!window.db || !window.getDocs || !window.query || !window.collection || !window.where) return false;
    const s = await window.getDocs(window.query(window.collection(window.db, 'conductores'), window.where('username', '==', username)));
    return s.docs.some(d => d.id !== excludeUid);
  }

  async function resolveUsername(username, excludeUid = '') {
    const desired = String(username || '').trim();
    if (!desired) return { username: desired, changed: false };
    try {
      if (!await isUsernameTaken(desired, excludeUid)) return { username: desired, changed: false };
      const sug = [desired + Math.floor(Math.random() * 900 + 100), desired + Math.floor(Math.random() * 900 + 100), desired + '_GG'];
      for (const s of sug) { if (!await isUsernameTaken(s, excludeUid)) return { username: s, changed: true }; }
    } catch (e) { console.warn('Username check:', e); }
    return { username: `${desired.slice(0, 18) || 'Jugador'}${Math.floor(Math.random() * 9000 + 1000)}`.slice(0, 24), changed: true };
  }

  async function processReferral(refCode, newUid) {
    if (!refCode) return { applied: false, reason: 'not-provided', reward: 0 };
    const n = normalizeCode(refCode); if (!n) return { applied: false, reason: 'not-provided', reward: 0 };
    try {
      const snap = await window.getDocs(window.collection(window.db, 'conductores'));
      const referrer = snap.docs.find(d => String(d.data()?.referralCode || '').toUpperCase() === n);
      if (!referrer) return { applied: false, reason: 'invalid', reward: 0 };
      if (referrer.id === newUid) return { applied: false, reason: 'self', reward: 0 };
      const reward = Number(settings.referralCoins || 50), d = referrer.data() || {};
      await updateUserData(referrer.id, { referralCount: Number(d.referralCount || 0) + 1, referralCoins: Number(d.referralCoins || 0) + reward, coins: Number(d.coins || 0) + reward });
      await updateUserData(newUid, { referredBy: n });
      await addActivity(referrer.id, 'referral', 'Nuevo referido registrado', reward);
      return { applied: true, reason: 'applied', reward };
    } catch (e) { console.warn('Referral:', e); return { applied: false, reason: 'error', reward: 0 }; }
  }

  async function loadSupportSnapshot(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return { total: 0, count: 0, sponsor: null };
    try {
      const [ds, ss] = await Promise.all([
        window.getDocs(window.collection(window.db, 'donations')).catch(() => null),
        window.getDocs(window.collection(window.db, 'sponsors')).catch(() => null)
      ]);
      const donations = (ds ? ds.docs.map(d => ({ id: d.id, ...d.data() })) : []).filter(i => String(i.email || i.userEmail || '').trim().toLowerCase() === email || String(i.uid || '') === user.uid);
      const sponsor   = (ss ? ss.docs.map(d => ({ id: d.id, ...d.data() })) : []).find(i => String(i.email || i.userEmail || '').trim().toLowerCase() === email || String(i.uid || '') === user.uid) || null;
      return { total: donations.reduce((a, i) => a + (Number(i.amount) || 0), 0), count: donations.length, sponsor };
    } catch { return { total: 0, count: 0, sponsor: null }; }
  }

  async function loadPreregSnapshot(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!email) return { registered: false, data: null };
    try {
      const d = await window.getDoc(window.fsDoc(window.db, 'preregistros', email)).catch(() => null);
      if (d && d.exists()) return { registered: true, data: d.data() || {} };
      const snap = await window.getDocs(window.collection(window.db, 'preregistros')).catch(() => null);
      if (!snap) return { registered: false, data: null };
      const f = snap.docs.find(doc => String(doc.data()?.email || '').trim().toLowerCase() === email);
      return f ? { registered: true, data: f.data() || {} } : { registered: false, data: null };
    } catch { return { registered: false, data: null }; }
  }

  async function loadProjectUpdates(limit = 4) {
    try {
      const snap = await window.getDocs(window.collection(window.db, 'project_updates'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.published !== false)
        .sort((a, b) => String(b.date || b.updatedAt || b.createdAt || '').localeCompare(String(a.date || a.updatedAt || a.createdAt || '')))
        .slice(0, limit);
    } catch { return []; }
  }

  async function loadRedemptionHistory(uid) {
    try {
      const snap = await window.getDocs(window.collection(window.db, REDEEM_COLLECTION));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.uid === uid)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    } catch { return []; }
  }

  async function submitRedemption(uid, coinsStr) {
    const coins = parseInt(coinsStr, 10);
    if (isNaN(coins) || coins < MIN_REDEEM_COINS) return { ok: false, msg: `Mínimo ${MIN_REDEEM_COINS} monedas.` };
    if (coins > Number(currentUserData?.coins || 0)) return { ok: false, msg: 'No tienes suficientes monedas.' };
    const emeralds = coinsToEmeralds(coins);
    if (emeralds <= 0) return { ok: false, msg: 'El monto no alcanza para convertir.' };
    try {
      await window.addDoc(window.collection(window.db, REDEEM_COLLECTION), { uid, email: currentUser?.email || '', username: currentUserData?.username || currentUserData?.displayName || '', coins, emeralds, status: 'completed', createdAt: new Date().toISOString() });
      const newCoins    = Number(currentUserData.coins || 0) - coins;
      const newEmeralds = Number(currentUserData.esmeraldas || 0) + emeralds;
      await updateUserData(uid, { coins: newCoins, esmeraldas: newEmeralds });
      await addActivity(uid, 'exchange', `Canje: ${coins} 🪙 → ${emeralds} Esmeraldas (Juego)`, -coins);
      currentUserData.coins      = newCoins;
      currentUserData.esmeraldas = newEmeralds;
      return { ok: true, msg: `Canje exitoso: +${emeralds} Esmeraldas` };
    } catch (e) { console.error('Redeem:', e); return { ok: false, msg: 'No se pudo completar el canje.' }; }
  }

  /* ── Mostrar / ocultar secciones ── */
  function showAuth() {
    if (authSection) authSection.style.display = 'flex';
    if (dashboard) { dashboard.style.display = 'none'; dashboard.classList.remove('active'); }
  }
  function showDashboard() {
    if (authSection) authSection.style.display = 'none';
    if (dashboard) { dashboard.style.display = 'block'; dashboard.classList.add('active'); }
  }

  /* ── Render helpers ── */
  function badge(label, tone) { return `<span class="bp${tone ? ' ' + tone : ''}">${esc(label)}</span>`; }

  function renderBadges(data, user) {
    const b = [];
    if (user?.emailVerified)                       b.push(badge('✓ Email', 'g'));
    if (data.betaTesterStatus === 'approved')      b.push(badge('Beta Tester', 'beta'));
    if (preregSnapshot.registered)                 b.push(badge('Pre-reg', 'b'));
    if (Number(data.referralCount || 0) > 0)       b.push(badge(data.referralCount + ' refs', 'pu'));
    if (supportSnapshot.total > 0)                 b.push(badge('Patroc.', 'go'));
    
    // Custom achievements logic
    const coins = Number(data.coins || 0);
    if (coins >= 100000) {
      b.push(badge('👑 Millonario', 'go'));
    } else if (coins >= 50000) {
      b.push(badge('💎 Adinerado', 'aqua'));
    }

    const streak = Number(data.streak || 0);
    if (streak >= 30) {
      b.push(badge('🔥 Fuego Puro', 'r'));
    } else if (streak >= 7) {
      b.push(badge('📅 Constante', 'g'));
    }

    const pet = data.pet || null;
    if (pet && Number(pet.level || 0) >= 5) {
      b.push(badge('🐾 Entrenador', 'pu'));
    }

    const r = String(data.role || '').toLowerCase();
    if (SPECIAL_ACCESS_ROLES.has(r)) {
      let tone = 'r'; // default red (Director/Founder)
      if (r === 'administrador') tone = 'aqua';
      if (r === 'programador' || r === 'modelador') tone = 'b';
      b.push(badge(roleLabel(data.role), tone));
    }
    const badgesHtml = b.join('');
    if (profileBadges) profileBadges.innerHTML = badgesHtml;
    if (profileBadgesSidebar) profileBadgesSidebar.innerHTML = badgesHtml;
  }

  function renderSponsorLevel(level) {
    const bm = { visitor:'👤', supporter:'💖', bronze:'🥉', silver:'🥈', gold:'🥇', platinum:'💎', founder:'🏆' };
    const dm = { visitor:'Haz una donación para subir de nivel.', supporter:'Gracias por apoyar.', bronze:'Miembro Bronce.', silver:'Acceso anticipado.', gold:'Extras exclusivos.', platinum:'Beneficios premium.', founder:'Fundador.' };
    const l  = String(level || 'visitor').toLowerCase();
    if (sponsorBadge)     sponsorBadge.textContent     = bm[l] || '👤';
    if (sponsorLevelName) sponsorLevelName.textContent = getLevelName(l);
    if (sponsorLevelDesc) sponsorLevelDesc.textContent = dm[l] || dm.visitor;
  }

  function renderStreakDays(streak) {
    const n = Number(streak || 0);
    streakDays.forEach(el => { const d = Number(el.dataset.day || 0); el.classList.toggle('completed', n > 0 && d <= (n % 7 || 7)); });
  }

  function checkDailyCooldown(lastDaily) {
    if (!lastDaily) { if (claimDailyBtn) claimDailyBtn.disabled = false; return; }
    const last = new Date(lastDaily), now = new Date();
    const ld   = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    const td   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (claimDailyBtn) claimDailyBtn.disabled = td.getTime() <= ld.getTime();
  }

  function renderProfile() {
    if (!currentUser || !currentUserData) return;
    const d    = currentUserData;
    const isFounder = String(currentUser?.email || '').trim().toLowerCase() === 'pantergamey@gmail.com';
    if (isFounder) {
      d.role = 'founder_ceo';
    }
    const name = String(d.nombre_usuario || d.displayName || d.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'Miembro');
    const role = String(d.role || 'viewer').toLowerCase();
    const set  = (el, v) => { if (el) el.textContent = v; };

    if (profileAvatarLetter) {
      if (d.avatarImg) {
        profileAvatarLetter.innerHTML = `<img src="${esc(d.avatarImg)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      } else {
        profileAvatarLetter.textContent = d.avatar || '😊';
      }
    }
    const levelStr = String(d.rango || d.nivel || getLevelName(d.level));
    set(profileDisplayName, name);
    set(profileEmail, currentUser.email || '');
    set(profileUid, 'ID Juego: ' + String(d.id_usuario || d.uid || currentUser.uid || '').slice(0, 12).toUpperCase());
    set(profileCoins, String(Number(d.coins || 0)));
    set(profileLevel, levelStr);
    set(profileLevelText, levelStr);
    set(profileRole, roleLabel(role));
    set(profileRoleText, roleLabel(role));
    set(profileJoinDate, formatDate(d.createdAt));
    set(profileStreak, String(Number(d.streak || 0)));
    set(profileStreakText, String(Number(d.streak || 0)));
    
    // Set level progress bar fill based on streak
    const streak = Number(d.streak || 0);
    const progressPercent = Math.min(100, Math.max(5, (streak % 7 || (streak > 0 ? 7 : 0)) / 7 * 100));
    if (profileLevelBarFill) {
      profileLevelBarFill.style.width = `${progressPercent}%`;
    }

    set(profileVerificationStatusSide, currentUser.emailVerified ? 'Sí' : 'No');
    set(profileProviderSide, providerLabel(currentUser));
    set(profilePreregisterStatusSide, preregSnapshot.registered ? 'Activo' : 'Pendiente');
    set(profileAccessLevel, SPECIAL_ACCESS_ROLES.has(role) ? 'Especial' : 'Miembro');
    set(profileCountry, d.country || 'No definido');
    set(profileFavoriteProject, d.favoriteProject || 'No definido');
    set(profileBio, d.bio || 'Sin descripción aún.');
    set(profileSupportTotal, `$${Number(supportSnapshot.total || 0).toFixed(2)}`);
    set(profileSupportCount, `${supportSnapshot.count} aportes`);
    set(profileSponsorSummary, supportSnapshot.total > 0 ? `$${Number(supportSnapshot.total || 0).toFixed(2)} aportados en ${supportSnapshot.count} movimiento(s).` : 'Sin aportes registrados.');
    set(referralCode, d.referralCode || generateReferralCode(currentUser.uid));
    set(referralCount, String(Number(d.referralCount || 0)));
    set(referralCoins, String(Number(d.referralCoins || 0)));
    set(redeemCoinsAvailable, String(Number(d.coins || 0)));
    if (redeemDollars) redeemDollars.textContent = formatEmeralds(coinsToEmeralds(d.coins || 0));
    const gp = countGamesPlayedToday(currentUser.uid);
    set(profileGamesPlayedToday, `${gp}/3`);

    // Sincronización de estadísticas del juego
    if (currentConductorData) {
      set(gameUsername, currentConductorData.nombre_usuario || '—');
      set(gameConductorId, currentConductorData.id_usuario || '—');
      set(gameCoins, currentConductorData.dinero !== undefined ? String(currentConductorData.dinero) : '—');
      set(gameEmeralds, currentConductorData.esmeraldas !== undefined ? String(currentConductorData.esmeraldas) : '—');
      if (currentConductorData.last_sync_unix) {
        const syncDate = new Date(currentConductorData.last_sync_unix * 1000);
        set(gameLastSync, syncDate.toLocaleString());
      } else {
        set(gameLastSync, '—');
      }
    } else {
      set(gameUsername, '—');
      set(gameConductorId, '—');
      set(gameCoins, '—');
      set(gameEmeralds, '—');
      set(gameLastSync, '—');
    }

    // Render de Mascota Panter
    const petWidget = $('profilePetWidget');
    if (petWidget) {
      if (false && d.pet) { // OCULTADO
        petWidget.style.display = 'block';
        const pet = d.pet;
        const petName = pet.name || 'Pantercito';
        const petLevel = pet.level || 1;
        const avatarId = pet.avatarId || 'classic';
        const PET_AVATARS = {
          classic: '🐈‍⬛',
          cyber: '🤖🐈‍⬛',
          astronaut: '👨‍🚀🐈‍⬛',
          detective: '🕵️🐈‍⬛',
          golden: '👑🐈‍⬛'
        };

        const hunger = Math.round(pet.hunger !== undefined ? pet.hunger : 100);
        const happiness = Math.round(pet.happiness !== undefined ? pet.happiness : 100);
        const energy = Math.round(pet.energy !== undefined ? pet.energy : 100);

        const petAvatar = $('profilePetAvatar');
        if (petAvatar) petAvatar.textContent = PET_AVATARS[avatarId] || '🐈‍⬛';

        const petNameEl = $('profilePetName');
        if (petNameEl) petNameEl.textContent = petName;

        const petLevelEl = $('profilePetLevel');
        if (petLevelEl) petLevelEl.textContent = petLevel;

        const petHungerEl = $('profilePetHunger');
        if (petHungerEl) petHungerEl.textContent = `🥩 ${hunger}%`;

        const petHappinessEl = $('profilePetHappiness');
        if (petHappinessEl) petHappinessEl.textContent = `🧶 ${happiness}%`;

        const petEnergyEl = $('profilePetEnergy');
        if (petEnergyEl) petEnergyEl.textContent = `⚡ ${energy}%`;

        // Render food/toy inventory
        const inv = d.inventory || {};
        const steakEl = $('invSteakCount');
        if (steakEl) steakEl.textContent = String(inv.steak || 0);
        const yarnEl = $('invYarnCount');
        if (yarnEl) yarnEl.textContent = String(inv.yarn || 0);

        // Mostrar campo para editar nombre de mascota
        const editPetNameGroup = $('editPetNameGroup');
        if (editPetNameGroup) {
          editPetNameGroup.style.display = 'block';
          const editPetNameInput = $('editPetName');
          if (editPetNameInput && !editPetNameInput.value) {
            editPetNameInput.value = petName;
          }
        }

        // Mostrar avatares exclusivos desbloqueados
        const petAvatarsSelectionGroup = $('petAvatarsSelectionGroup');
        const unlockedPetAvatarsGrid = $('unlockedPetAvatarsGrid');
        if (petAvatarsSelectionGroup && unlockedPetAvatarsGrid) {
          petAvatarsSelectionGroup.style.display = 'block';
          const unlocked = Array.isArray(pet.unlockedAvatars) ? pet.unlockedAvatars : ['classic'];
          
          let gridHtml = '';
          unlocked.forEach(avId => {
            const emoji = PET_AVATARS[avId];
            if (emoji) {
              const isSelected = d.avatar === emoji;
              gridHtml += `<button type="button" class="av-opt${isSelected ? ' selected' : ''}" data-avatar="${emoji}" role="radio" aria-checked="${isSelected ? 'true' : 'false'}" aria-label="Avatar de Mascota ${avId}">${emoji}</button>`;
            }
          });
          unlockedPetAvatarsGrid.innerHTML = gridHtml;

          // Asignar eventos a los nuevos botones
          unlockedPetAvatarsGrid.querySelectorAll('.av-opt').forEach(b => {
            b.addEventListener('click', () => {
              $$('.av-opt').forEach(x => x.classList.remove('selected'));
              b.classList.add('selected');
              $('editAvatarValue').value = b.dataset.avatar;
              if (editProfileImagePreview) editProfileImagePreview.innerHTML = b.dataset.avatar;
              if (editProfileImageInput) editProfileImageInput.value = '';
              if (removeProfileImageBtn) removeProfileImageBtn.style.display = 'none';
            });
          });
        }
      } else {
        petWidget.style.display = 'none';
        const editPetNameGroup = $('editPetNameGroup');
        if (editPetNameGroup) editPetNameGroup.style.display = 'none';
        const petAvatarsSelectionGroup = $('petAvatarsSelectionGroup');
        if (petAvatarsSelectionGroup) petAvatarsSelectionGroup.style.display = 'none';
      }
    }

    renderSponsorLevel(d.level);
    renderStreakDays(d.streak || 0);
    checkDailyCooldown(d.lastDaily);
     renderBadges(d, currentUser);
    if (profileAdminTools) profileAdminTools.hidden = !(SPECIAL_ACCESS_ROLES.has(role) || isFounder);
    if (profileBetaTesterCard) profileBetaTesterCard.hidden = (d.betaTesterStatus !== 'approved');

    // Control de visibilidad de la sección de reclamo de código de referido manual
    const manualRefBox = $('manualReferralBox');
    if (manualRefBox) {
      if (!d.referredBy) {
        manualRefBox.style.display = 'block';
      } else {
        manualRefBox.style.display = 'none';
      }
    }
  }

  function renderActivity(items) {
    if (!activityList) return;
    if (!items.length) {
      activityList.innerHTML = '<li class="act-item"><div class="act-txt"><div class="act-title" style="color:#2d5570">Sin actividad reciente</div></div></li>';
      return;
    }
    const icons = { register:'🎉', referral:'👥', spin:'🎰', daily:'📅', profile:'📝', exchange:'💎' };
    activityList.innerHTML = items.map(item => {
      const c = Number(item.coins || 0);
      return `<li class="act-item">
        <div class="act-ico">${icons[item.type] || '✨'}</div>
        <div class="act-txt">
          <div class="act-title">${esc(item.description || 'Actividad')}</div>
          <div class="act-time">${esc(formatDateLong(item.createdAt))}</div>
        </div>
        <div class="act-coins${c < 0 ? ' neg' : ''}">${c ? `${c > 0 ? '+' : ''}${c} 🪙` : ''}</div>
      </li>`;
    }).join('');
  }

  function renderProjectFeed(updates) {
    if (!projectUpdateFeed) return;
    if (!updates.length) { projectUpdateFeed.innerHTML = '<p style="color:#2d5570;font-size:.75rem">Sin novedades publicadas.</p>'; return; }
    projectUpdateFeed.innerHTML = updates.map(item => {
      const p    = new URLSearchParams({ projectId: String(item.projectId || ''), projectType: String(item.projectType || 'juego') });
      const href = item.projectId ? `proyecto.html?${p}` : 'actualizaciones.html';
      return `<a class="feed-link" href="${esc(href)}">
        <strong>${esc(item.title || 'Actualización')}</strong>
        <span>${esc(item.projectTitle || 'Proyecto')}</span>
        <small>${esc(formatDateLong(item.date || item.updatedAt || item.createdAt))}</small>
      </a>`;
    }).join('');
  }

  function renderRedemptionHistory(history) {
    if (!redeemHistoryList || !redeemHistory) return;
    if (!history.length) { redeemHistory.hidden = true; return; }
    redeemHistory.hidden = false;
    redeemHistoryList.innerHTML = history.map(item => `
      <div class="rdm-hist-item">
        <div>
          <strong>${esc(String(item.coins || 0))} 🪙 → ${esc(formatEmeralds(item.emeralds || coinsToEmeralds(item.coins || 0)))}</strong>
          <small>${esc(formatDateLong(item.createdAt))}</small>
        </div>
        <span class="rdm-status ${item.status || 'completed'}">${esc(item.status || 'completado')}</span>
      </div>`).join('');
    const totalEm = history.reduce((s, i) => s + Number(i.esmeraldas || i.emeralds || coinsToEmeralds(i.coins || 0)), 0);
    if (redeemTotalPaid)  redeemTotalPaid.textContent  = formatEmeralds(totalEm);
    if (redeemTotalCount) redeemTotalCount.textContent = String(history.length);
  }

  /* ── Cargar datos del dashboard ── */
  async function loadDashboardData() {
    if (!currentUser) return;
    const [activity, updates, redemptions] = await Promise.all([
      getActivity(currentUser.uid, 8),
      loadProjectUpdates(4),
      loadRedemptionHistory(currentUser.uid)
    ]);
    renderActivity(activity);
    renderProjectFeed(updates);
    renderRedemptionHistory(redemptions);
  }

  /* ── Auth state handler ── */
  async function handleAuthStateChange(user) {
    currentUser = user;
    if (!user) { currentUserData = null; currentConductorData = null; showAuth(); return; }
    currentUserData = await getUserData(user.uid);
    currentConductorData = await getConductorData(user.uid);
    if (!currentUserData) {
      try {
        currentUserData = await createUserDoc(user, { displayName: user.displayName || user.email?.split('@')[0] || 'Miembro' });
      } catch (err) {
        if (isPermDenied(err)) {
          currentUserData = { displayName: user.displayName || user.email?.split('@')[0] || 'Miembro', username: user.email?.split('@')[0] || 'Miembro', email: user.email || '', avatar: '😊', bio: '', favoriteProject: '', country: '', coins: 0, emeralds: 0, level: 'visitor', referralCode: generateReferralCode(user.uid), referredBy: null, referralCount: 0, referralCoins: 0, streak: 0, lastDaily: null, role: 'viewer', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          setAuthMessage('Firestore bloqueó el perfil (permission-denied). Ajusta reglas de "conductores".', 'error');
        } else throw err;
      }
    }
    supportSnapshot = await loadSupportSnapshot(user);
    preregSnapshot  = await loadPreregSnapshot(user);
    showDashboard();
    renderProfile();
    await loadDashboardData();
  }

  /* ══════════════════════════════════════
     EVENTOS
  ══════════════════════════════════════ */

  /* Auth tabs */
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      if (loginForm)    { loginForm.style.display    = isLogin ? 'flex' : 'none'; loginForm.classList.toggle('active', isLogin); }
      if (registerForm) { registerForm.style.display = isLogin ? 'none' : 'flex'; registerForm.classList.toggle('active', !isLogin); }
      setAuthMessage('');
    });
  });

  /* Login */
  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    setAuthMessage('Iniciando sesión...');
    try { await window.signInWithEmailAndPassword(window.auth, String($('loginEmail')?.value || '').trim(), String($('loginPassword')?.value || '')); }
    catch (err) { setAuthMessage(getAuthError(err), 'error'); }
  });

  /* Register */
  registerForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = String($('registerEmail')?.value    || '').trim();
    const password = String($('registerPassword')?.value || '');
    const referral = normalizeCode($('registerReferral')?.value || getPendingCode());
    if (!await waitForFirebase()) { setAuthMessage('Firebase no está listo. Recarga la página.', 'error'); return; }
    try {
      setAuthMessage('Creando cuenta...');
      const cred = await window.createUserWithEmailAndPassword(window.auth, email, password);
      const { username: finalName, changed } = await resolveUsername(email.split('@')[0] || 'Jugador', cred.user.uid);
      await window.updateProfile(cred.user, { displayName: finalName });
      try {
        await createUserDoc(cred.user, { displayName: finalName, username: finalName });
        if (referral) await processReferral(referral, cred.user.uid);
        await addActivity(cred.user.uid, 'register', 'Cuenta creada', 0);
        setPendingCode('');
        setAuthMessage(`¡Cuenta creada!${changed ? ' Usuario: ' + finalName : ''}`, 'success');
      } catch (pe) {
        if (isPermDenied(pe)) setAuthMessage('Cuenta creada en Auth, pero Firestore bloqueó el perfil.', 'error');
        else throw pe;
      }
      registerForm.reset();
    } catch (err) { setAuthMessage(getAuthError(err), 'error'); }
  });

  /* Recuperar contraseña */
  forgotLink?.addEventListener('click', async e => {
    e.preventDefault();
    const email = String($('loginEmail')?.value || '').trim();
    if (!email) { setAuthMessage('Ingresa tu correo primero.', 'error'); return; }
    try { await window.sendPasswordResetEmail(window.auth, email); setAuthMessage('Correo de recuperación enviado.', 'success'); }
    catch (err) { setAuthMessage(getAuthError(err), 'error'); }
  });

  /* Logout */
  logoutBtn?.addEventListener('click', async () => { try { await window.signOut(window.auth); } catch (e) { console.error(e); } });

  /* Google Auth */
  $('googleAuthBtn')?.addEventListener('click', async () => {
    if (!await waitForFirebase()) { setAuthMessage('Firebase no está listo. Recarga la página.', 'error'); return; }
    try {
      setAuthMessage('Conectando con Google...');
      const provider = new window.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      setAuthMessage('Iniciando sesión...');
      await window.signInWithPopup(window.auth, provider);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setAuthMessage(getAuthError(err), 'error');
    }
  });

  /* Bonus diario */
  claimDailyBtn?.addEventListener('click', async () => {
    if (!currentUser || !currentUserData || claimDailyBtn.disabled) return;
    claimDailyBtn.disabled = true;
    const baseRaw = Number(settings.dailyBonusCoins || 10);
    const mult = Number(currentUserData.dailyMultiplier || 1.0);
    const base = Math.round(baseRaw * mult);
    const now   = new Date();
    const last  = currentUserData.lastDaily ? new Date(currentUserData.lastDaily) : null;
    let streak  = 1;
    if (last) {
      const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const ld   = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      if (ld.getTime() === yest.getTime()) streak = Number(currentUserData.streak || 0) + 1;
    }
    const bonus    = base + (streak >= 7 ? base : 0);
    const newCoins = Number(currentUserData.coins || 0) + bonus;
    const nowIso   = now.toISOString();
    await updateUserData(currentUser.uid, { coins: newCoins, streak, lastDaily: nowIso });
    await addActivity(currentUser.uid, 'daily', `Bonus diario reclamado (Mult x${mult.toFixed(1)})`, bonus);
    currentUserData.coins    = newCoins;
    currentUserData.streak   = streak;
    currentUserData.lastDaily= nowIso;
    renderProfile();
    await loadDashboardData();
    if (dailyBonusMessage) {
      dailyBonusMessage.textContent = `+${bonus} 🪙${streak >= 7 ? ' + bonus de racha' : ''}!`;
      dailyBonusMessage.className   = 'success';
    }
  });

  /* Copiar código de referido (Enlace Completo) */
  copyReferralBtn?.addEventListener('click', async () => {
    const code = String(referralCode?.textContent || '').trim(); if (!code) return;
    const siteRoot = document.body?.dataset.siteRoot || '..';
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    let fullLink = baseUrl + '/' + siteRoot + '/index.html?ref=' + code;
    try {
      fullLink = new URL(fullLink).href;
    } catch(e) {}
    try {
      await navigator.clipboard.writeText(fullLink);
      copyReferralBtn.textContent = '¡Enlace Copiado!';
      setTimeout(() => copyReferralBtn.textContent = 'Copiar', 1800);
    } catch {}
  });

  /* Reclamar código de referido manual */
  $('manualReferralBtn')?.addEventListener('click', async () => {
    if (!currentUser || !currentUserData) return;
    const input = $('manualReferralInput');
    const msg = $('manualReferralMessage');
    const btn = $('manualReferralBtn');
    if (!input || !msg || !btn) return;

    const code = normalizeCode(input.value);
    if (!code) {
      msg.textContent = 'Ingresa un código de referido.';
      msg.className = 'error';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Procesando código...';
    msg.className = '';

    try {
      if (typeof window.applyReferralCode !== 'function') {
        throw new Error('Función global applyReferralCode no encontrada.');
      }
      const res = await window.applyReferralCode(code, currentUser.uid, currentUserData);
      if (res.applied) {
        msg.textContent = `¡Código canjeado con éxito! Recibes +${res.reward} monedas 🪙.`;
        msg.className = 'success';
        input.value = '';
        // Actualizar el perfil local
        currentUserData.referredBy = code;
        currentUserData.coins = Number(currentUserData.coins || 0) + res.reward;
        // Re-render
        renderProfile();
        await loadDashboardData();
        await addActivity(currentUser.uid, 'referral', 'Código de referido manual reclamado', res.reward);
      } else {
        const errors = {
          'self': 'No puedes usar tu propio código.',
          'already-linked': 'Ya has sido referido anteriormente.',
          'invalid': 'Código inválido o conductor no encontrado.',
          'not-provided': 'Ingresa un código de referido.'
        };
        msg.textContent = errors[res.reason] || 'Error al procesar el código.';
        msg.className = 'error';
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Error interno al procesar el código.';
      msg.className = 'error';
    } finally {
      btn.disabled = false;
    }
  });

  /* Canjear monedas */
  redeemBtn?.addEventListener('click', async () => {
    if (!currentUser || !currentUserData) return;
    redeemBtn.disabled = true;
    if (redeemMessage) { redeemMessage.textContent = 'Procesando...'; redeemMessage.className = ''; }
    const r = await submitRedemption(currentUser.uid, redeemAmountInput?.value || '0');
    if (redeemMessage) { redeemMessage.textContent = r.msg; redeemMessage.className = r.ok ? 'success' : 'error'; }
    if (r.ok) { if (redeemAmountInput) redeemAmountInput.value = ''; renderProfile(); await loadDashboardData(); }
    redeemBtn.disabled = false;
  });

  /* Transferencia de Fondos (PanterPay) */
  $('transferBtn')?.addEventListener('click', async () => {
    if (!currentUser) return;
    const btn = $('transferBtn');
    const msg = $('transferMessage');
    const destInput = $('transferDest');
    const amountInput = $('transferAmount');
    const currencySelect = $('transferCurrency');

    if (!btn || !msg || !destInput || !amountInput || !currencySelect) return;

    const dest = String(destInput.value).trim();
    const amount = parseInt(amountInput.value, 10);
    const currency = currencySelect.value;

    if (!dest) { msg.textContent = 'Ingresa el UID o Código de Conductor.'; msg.className = 'error'; return; }
    if (isNaN(amount) || amount <= 0) { msg.textContent = 'Ingresa una cantidad válida mayor a 0.'; msg.className = 'error'; return; }

    btn.disabled = true;
    const userCoins = Number(currentUserData?.coins || 0);
    msg.textContent = 'Buscando destinatario...';
    msg.className = '';

    try {
      let recipientUid = null;
      let recipientName = 'Otro Conductor';

      // 1. Comprobar si dest es UID completo en conductores
      if (dest.length > 15) {
        const rSnap = await window.getDoc(window.fsDoc(window.db, 'conductores', dest));
        if (rSnap.exists()) {
          recipientUid = dest;
          recipientName = rSnap.data().displayName || rSnap.data().username || 'Conductor';
        }
      }

      // 2. Si no se encuentra, buscar en conductores por id_usuario (Código corto)
      if (!recipientUid) {
        const q = window.query(window.collection(window.db, 'conductores'), window.where('id_usuario', '==', dest.toUpperCase()));
        const qSnap = await window.getDocs(q);
        if (!qSnap.empty) {
          const docData = qSnap.docs[0];
          recipientUid = docData.id;
          recipientName = docData.data().nombre_usuario || 'Conductor';
        }
      }

      if (!recipientUid) {
        msg.textContent = 'Destinatario no encontrado.';
        msg.className = 'error';
        btn.disabled = false;
        return;
      }

      if (recipientUid === currentUser.uid) {
        msg.textContent = 'No puedes transferirte fondos a ti mismo.';
        msg.className = 'error';
        btn.disabled = false;
        return;
      }

      // 3. Procesar Transferencia según moneda
      const senderName = currentUser.displayName || currentUser.email.split('@')[0] || 'Conductor';

      if (currency === 'coins') {
        // Transferencia de Monedas Web
        if (userCoins < amount) {
          msg.textContent = 'No tienes suficientes monedas web.';
          msg.className = 'error';
          btn.disabled = false;
          return;
        }

        // Realizar actualizaciones
        const senderDocRef = window.fsDoc(window.db, 'conductores', currentUser.uid);
        const recDocRef = window.fsDoc(window.db, 'conductores', recipientUid);

        // Descontar al emisor
        const newSenderCoins = userCoins - amount;
        await window.updateDoc(senderDocRef, { coins: newSenderCoins });

        // Sumar al receptor
        const recSnap = await window.getDoc(recDocRef);
        if (recSnap.exists()) {
          const currentRecCoins = recSnap.data().coins || 0;
          await window.updateDoc(recDocRef, { coins: currentRecCoins + amount });
        } else {
          // Si no tiene registro en la web aún
          await window.setDoc(recDocRef, {
            uid: recipientUid,
            displayName: recipientName,
            coins: amount,
            emeralds: 0
          });
        }

        // Historial emisor
        await addActivity(currentUser.uid, 'transfer_sent', `PanterPay: Envío de ${amount} 🪙 a ${recipientName}`, -amount);
        // Historial receptor
        await addActivity(recipientUid, 'transfer_received', `PanterPay: Recibiste ${amount} 🪙 de ${senderName}`, amount);

        msg.textContent = `¡Transferencia de ${amount} 🪙 a ${recipientName} realizada!`;
        msg.className = 'success';

      } else {
        msg.textContent = 'Moneda no permitida para transferencias.';
        msg.className = 'error';
        btn.disabled = false;
        return;
      }

      // Limpiar y Recargar datos
      destInput.value = '';
      amountInput.value = '';
      renderProfile();
      await loadDashboardData();

    } catch (err) {
      console.error(err);
      msg.textContent = 'Error al procesar la transferencia.';
      msg.className = 'error';
    }

    btn.disabled = false;
  });

  /* Editar perfil */
  editProfileBtn?.addEventListener('click', () => {
    if (!currentUserData || !editProfileModal) return;
    $('editDisplayName').value    = currentUserData.displayName || currentUser?.displayName || '';
    $('editBio').value            = currentUserData.bio || '';
    $('editFavoriteProject').value= currentUserData.favoriteProject || '';
    $('editCountry').value        = currentUserData.country || '';
    $('editAvatarValue').value    = currentUserData.avatar || '😊';
    $$('.av-opt').forEach(b => b.classList.toggle('selected', b.dataset.avatar === (currentUserData.avatar || '😊')));

    if (currentUserData.avatarImg) {
      editProfileImagePreview && (editProfileImagePreview.innerHTML = `<img src="${esc(currentUserData.avatarImg)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`);
      if (editProfileImageInput) editProfileImageInput.value = currentUserData.avatarImg;
      if (removeProfileImageBtn) removeProfileImageBtn.style.display = '';
    } else {
      editProfileImagePreview && (editProfileImagePreview.innerHTML = $('editAvatarValue')?.value || '😊');
      if (editProfileImageInput) editProfileImageInput.value = '';
      if (removeProfileImageBtn) removeProfileImageBtn.style.display = 'none';
    }

    editProfileModal.showModal();
  });

  $$('.av-opt').forEach(b => {
    b.addEventListener('click', () => {
      $$('.av-opt').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      $('editAvatarValue').value = b.dataset.avatar || '😊';
      if (editProfileImagePreview) editProfileImagePreview.innerHTML = b.dataset.avatar || '😊';
      if (editProfileImageInput) editProfileImageInput.value = '';
      if (removeProfileImageBtn) removeProfileImageBtn.style.display = 'none';
    });
  });

  if (editProfileImageInput) {
    editProfileImageInput.addEventListener('input', () => {
      const url = String(editProfileImageInput.value || '').trim();
      if (url) {
        editProfileImagePreview && (editProfileImagePreview.innerHTML = `<img src="${esc(url)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`);
        if (removeProfileImageBtn) removeProfileImageBtn.style.display = '';
        $('editAvatarValue').value = '';
        $$('.av-opt').forEach(x => x.classList.remove('selected'));
      } else {
        editProfileImagePreview && (editProfileImagePreview.innerHTML = $('editAvatarValue')?.value || '😊');
        if (removeProfileImageBtn) removeProfileImageBtn.style.display = 'none';
      }
    });
  }

  removeProfileImageBtn?.addEventListener('click', () => {
    if (editProfileImageInput) editProfileImageInput.value = '';
    if (editProfileImagePreview) editProfileImagePreview.innerHTML = $('editAvatarValue')?.value || '😊';
    if (removeProfileImageBtn) removeProfileImageBtn.style.display = 'none';
  });

  editProfileForm?.addEventListener('submit', async e => {
    e.preventDefault(); if (!currentUser) return;
    const avatarImgUrl = String(editProfileImageInput?.value || '').trim();
    const nameVal = String($('editDisplayName')?.value || '').trim();
    const p = {
      displayName:     nameVal,
      nombre_usuario:  nameVal,
      bio:             String($('editBio')?.value             || '').trim(),
      favoriteProject: String($('editFavoriteProject')?.value || '').trim(),
      country:         String($('editCountry')?.value         || '').trim(),
      avatar:          avatarImgUrl ? '' : String($('editAvatarValue')?.value || '😊'),
      avatarImg:       avatarImgUrl || ''
    };

    const petNameInput = $('editPetName');
    if (petNameInput && currentUserData && currentUserData.pet) {
      p.pet = {
        ...currentUserData.pet,
        name: petNameInput.value.trim() || currentUserData.pet.name || 'Pantercito'
      };
    }

    await updateUserData(currentUser.uid, p);
    await window.updateProfile(currentUser, { displayName: nameVal });
    await addActivity(currentUser.uid, 'profile', 'Perfil actualizado', 0);
    currentUserData = { ...currentUserData, ...p };
    renderProfile();
    await loadDashboardData();
    editProfileModal.close();
  });

  /* Cerrar modales */
  $$('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = $(btn.getAttribute('data-close-modal') || '');
      if (m && typeof m.close === 'function') m.close();
    });
  });

  // Aspecto de Mascota Modal Selector
  window.openPetAvatarSelectorModal = function() {
    const modal = $('petAvatarModal');
    const grid = $('petAvatarsSelectorGrid');
    if (!modal || !grid || !currentUserData || !currentUserData.pet) return;

    const pet = currentUserData.pet;
    const unlocked = Array.isArray(pet.unlockedAvatars) ? pet.unlockedAvatars : ['classic'];
    const active = pet.avatarId || 'classic';

    const PET_AVATARS = {
      classic: '🐈‍⬛',
      cyber: '🤖🐈‍⬛',
      astronaut: '👨‍🚀🐈‍⬛',
      detective: '🕵️🐈‍⬛',
      golden: '👑🐈‍⬛'
    };

    const PET_AVATAR_NAMES = {
      classic: 'Clásico',
      cyber: 'Cyber (Nvl 3)',
      astronaut: 'Astronauta',
      detective: 'Detective',
      golden: 'Dorado (Nvl 5)'
    };

    let html = '';
    Object.keys(PET_AVATARS).forEach(id => {
      const emoji = PET_AVATARS[id];
      const name = PET_AVATAR_NAMES[id];
      const isUnlocked = unlocked.includes(id);
      const isActive = active === id;

      html += `
        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid ${isActive ? '#00e676' : (isUnlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)')}; border-radius: 8px; width: 110px; opacity: ${isUnlocked ? 1 : 0.4};">
          <div style="font-size: 2.5rem; margin-bottom: 5px;">${emoji}</div>
          <div style="font-size: 0.75rem; color: #fff; margin-bottom: 8px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</div>
          ${isUnlocked ? 
            `<button class="pb sm ${isActive ? 'prim' : ''}" style="width: 100%; font-size: 0.7rem;" onclick="selectPetSkin('${id}')">${isActive ? 'Activo' : 'Usar'}</button>` : 
            `<button class="pb sm" style="width: 100%; font-size: 0.7rem; cursor: not-allowed;" disabled>Bloqueado</button>`
          }
        </div>
      `;
    });

    grid.innerHTML = html;
    modal.showModal();
  };

  window.selectPetSkin = async function(skinId) {
    if (!currentUser || !currentUserData || !currentUserData.pet) return;
    const pet = currentUserData.pet;
    const unlocked = Array.isArray(pet.unlockedAvatars) ? pet.unlockedAvatars : ['classic'];
    if (!unlocked.includes(skinId)) return;

    try {
      const updatedPet = { ...pet, avatarId: skinId };
      await updateUserData(currentUser.uid, { pet: updatedPet });
      currentUserData.pet = updatedPet;
      renderProfile();
      const modal = $('petAvatarModal');
      if (modal) modal.close();
    } catch(err) {
      console.error('Error changing pet skin:', err);
      alert('No se pudo cambiar el aspecto de la mascota.');
    }
  };

  window.usePetItem = async function(itemKey) {
    if (!currentUser || !currentUserData || !currentUserData.pet) return;
    const inv = currentUserData.inventory || {};
    const count = inv[itemKey] || 0;
    const msgEl = $('petItemMessage');

    if (count <= 0) {
      if (msgEl) {
        msgEl.textContent = '¡No tienes este artículo! Cómpralo en la Tienda.';
        msgEl.style.color = 'var(--color-red)';
        setTimeout(() => msgEl.textContent = '', 2500);
      }
      return;
    }

    const pet = currentUserData.pet;
    let hunger = pet.hunger !== undefined ? pet.hunger : 100;
    let happiness = pet.happiness !== undefined ? pet.happiness : 100;
    let exp = pet.exp !== undefined ? pet.exp : 0;
    let level = pet.level !== undefined ? pet.level : 1;

    if (itemKey === 'steak') {
      hunger = Math.min(100, hunger + 40);
      happiness = Math.min(100, happiness + 15);
      if (msgEl) msgEl.textContent = '¡Panter Pet comió un delicioso Filete! 🥩';
    } else if (itemKey === 'yarn') {
      happiness = Math.min(100, happiness + 50);
      exp += 20;
      if (msgEl) msgEl.textContent = '¡Panter Pet jugó felizmente con la Lana! 🧶';
    }

    // Level up check
    const reqExp = level * 100;
    if (exp >= reqExp) {
      exp -= reqExp;
      level += 1;
      if (msgEl) msgEl.textContent += ' ¡SUBIÓ DE NIVEL! 🎉';
    }

    try {
      inv[itemKey] = count - 1;
      const updatedPet = { ...pet, hunger, happiness, exp, level };
      await updateUserData(currentUser.uid, {
        inventory: inv,
        pet: updatedPet
      });

      currentUserData.inventory = inv;
      currentUserData.pet = updatedPet;
      renderProfile();

      if (msgEl) {
        msgEl.style.color = '#00e676';
        setTimeout(() => msgEl.textContent = '', 3000);
      }
    } catch(err) {
      console.error('Error feeding/playing with pet:', err);
      if (msgEl) {
        msgEl.textContent = 'Error al usar artículo.';
        msgEl.style.color = 'var(--color-red)';
      }
    }
  };

  /* ── Init ── */
  async function init() {
    if (!await waitForFirebase()) { setAuthMessage('No se pudo conectar con Firebase.', 'error'); return; }
    prefillReferralField();
    settings = await loadSettings();
    if (dailyBonusAmount) dailyBonusAmount.textContent = String(Number(settings.dailyBonusCoins || 10));
    window.onAuthStateChanged(window.auth, user => {
      handleAuthStateChange(user).catch(err => { console.error('Auth:', err); setAuthMessage('No se pudo cargar tu perfil.', 'error'); });
    });
  }

  init();
})();