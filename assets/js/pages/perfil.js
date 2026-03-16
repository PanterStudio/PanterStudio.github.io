/* perfil.js — Panter Studio */
(function () {
  'use strict';

  const REFERRAL_STORAGE_KEY  = 'panterPendingReferralCode';
  const COINS_PER_EXCHANGE    = 5000;
  const EMERALDS_PER_EXCHANGE = 50;
  const MIN_REDEEM_COINS      = 5000;
  const REDEEM_COLLECTION     = 'coin_redemptions';


  const ROLE_LABELS = {
    founder_ceo:'Fundador / CEO', administrador:'Administrador',
    programador:'Programador', modelador:'Modelador', usuario:'Miembro',
    viewer:'Miembro', vip:'VIP', community_manager:'Community Manager',
    support_ops:'Soporte', youtuber:'Youtuber', streamer:'Streamer'
  };
  const SPECIAL_ACCESS_ROLES = new Set(['founder_ceo','administrador','programador','modelador']);

  /* ── DOM ── */
  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  const authSection  = $('profileAuthSection');
  const dashboard    = $('profileDashboard');
  const loginForm    = $('loginForm');
  const registerForm = $('registerForm');
  const authMessage  = $('authMessage');
  const authTabs     = $$('.auth-tab');
  const forgotLink   = $('forgotPasswordLink');

  const profileAvatarLetter  = $('profileAvatarLetter');
  const profileDisplayName   = $('profileDisplayName');
  const profileEmail         = $('profileEmail');
  const profileCoins         = $('profileCoins');
  const profileCoinsDollars  = $('profileCoinsDollars');
  const profileLevel         = $('profileLevel');
  const profileRole          = $('profileRole');
  const profileJoinDate      = $('profileJoinDate');
  const profileBadges        = $('profileBadges');
  const profileUid           = $('profileUid');
  const profileStreak        = $('profileStreak');
  const profileVerificationStatusSide = $('profileVerificationStatusSide');
  const profileProviderSide  = $('profileProviderSide');
  const profilePreregisterStatusSide  = $('profilePreregisterStatusSide');
  const profileAccessLevel   = $('profileAccessLevel');
  const profileCountry       = $('profileCountry');
  const profileFavoriteProject = $('profileFavoriteProject');
  const profileBio           = $('profileBio');
  const profileSupportTotal  = $('profileSupportTotal');
  const profileSupportCount  = $('profileSupportCount');
  const profileSponsorSummary= $('profileSponsorSummary');
  const profileAdminTools    = $('profileAdminTools');
  const profileGamesPlayedToday = $('profileGamesPlayedToday');

  const sponsorBadge     = $('sponsorBadge');
  const sponsorLevelName = $('sponsorLevelName');
  const sponsorLevelDesc = $('sponsorLevelDesc');

  const logoutBtn       = $('logoutBtn');
  const editProfileBtn  = $('editProfileBtn');
  const editProfileModal= $('editProfileModal');
  const editProfileForm = $('editProfileForm');
  const activityList    = $('activityList');
  const projectUpdateFeed = $('projectUpdateFeed');



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

  /* ── State ── */
  let currentUser     = null;
  let currentUserData = null;
  let settings        = {};
  let supportSnapshot = { total:0, count:0, sponsor:null };
  let preregSnapshot  = { registered:false, data:null };

  /* ── Audio ── */
  const audioCtx = (function(){
    try{ return new (window.AudioContext || window.webkitAudioContext)(); }catch{ return null; }
  })();
  function playClickSound(){
    if(!audioCtx) return;
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(900,now);
    g.gain.setValueAtTime(0,now);
    g.gain.linearRampToValueAtTime(0.15,now+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now+0.3);
  }
  function playWinSound(){
    if(!audioCtx) return;
    const now=audioCtx.currentTime;
    const o1=audioCtx.createOscillator(), o2=audioCtx.createOscillator(), g=audioCtx.createGain();
    o1.type='triangle'; o2.type='sine';
    o1.frequency.setValueAtTime(600,now); o2.frequency.setValueAtTime(980,now);
    g.gain.setValueAtTime(0.001,now);
    g.gain.linearRampToValueAtTime(0.25,now+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,now+0.7);
    o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
    o1.start(now); o2.start(now); o1.stop(now+0.8); o2.stop(now+0.8);
  }

  /* ── Helpers ── */
  function esc(v){ return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function formatDate(v){ if(!v) return '-'; const d=new Date(v); return isNaN(d)?'-':d.toLocaleDateString('es-ES',{year:'numeric',month:'short'}); }
  function formatDateLong(v){ if(!v) return '-'; const d=new Date(v); return isNaN(d)?'-':d.toLocaleDateString('es-ES',{year:'numeric',month:'short',day:'2-digit'}); }
  function coinsToEmeralds(c){ return Math.floor((Number(c||0)/COINS_PER_EXCHANGE)*EMERALDS_PER_EXCHANGE); }
  function formatEmeralds(v){ return `${Number(v||0)} 💎`; }
  function roleLabel(r){ return ROLE_LABELS[String(r||'viewer').toLowerCase()]||'Miembro'; }
  function providerLabel(u){ const id=u?.providerData?.[0]?.providerId||'password'; return id.includes('google')?'Google':id.includes('password')?'Email':id; }
  function generateReferralCode(uid){ return String(uid||'').slice(0,6).toUpperCase(); }
  function normalizeCode(c){ return String(c||'').replace(/\s+/g,'').trim().toUpperCase().slice(0,32); }
  function getLevelName(l){ const m={visitor:'Visitante',supporter:'Apoyo',bronze:'Bronce',silver:'Plata',gold:'Oro',platinum:'Platino',founder:'Fundador'}; return m[String(l||'').toLowerCase()]||'Visitante'; }
  function isPermDenied(err){ const c=String(err?.code||''), m=String(err?.message||''); return c.includes('permission-denied')||m.includes('permission-denied'); }

  function countGamesPlayedToday(uid){
    const today=new Date().toDateString(); let n=0;
    ['game1','game2','game3'].forEach(id=>{
      try{ const k=`panterMG_${id}_${uid}`, s=localStorage.getItem(k); if(s&&new Date(s).toDateString()===today) n++; }catch{}
    });
    return n;
  }

  function setPendingCode(c){ try{ const n=normalizeCode(c); if(n) localStorage.setItem(REFERRAL_STORAGE_KEY,n); else localStorage.removeItem(REFERRAL_STORAGE_KEY); return n; }catch{ return ''; } }
  function getPendingCode(){
    let url='';
    try{ const p=new URLSearchParams(window.location.search); url=normalizeCode(p.get('ref')||p.get('invite')||p.get('invitation')||p.get('codigo')||''); }catch{}
    if(url) return setPendingCode(url);
    try{ return normalizeCode(localStorage.getItem(REFERRAL_STORAGE_KEY)||''); }catch{ return ''; }
  }
  function prefillReferralField(){
    const inp=$('registerReferral'); if(!inp||inp.value.trim()) return;
    const c=getPendingCode(); if(c) inp.value=c;
  }

  /* ── Auth messages ── */
  function setAuthMessage(text, type){
    if(!authMessage) return;
    authMessage.textContent = text||'';
    authMessage.className = `auth-msg${type?' '+type:''}`;
  }
  function getAuthError(err){
    const map={
      'auth/user-not-found':'No existe cuenta con ese correo.',
      'auth/wrong-password':'Contraseña incorrecta.',
      'auth/invalid-credential':'Credenciales inválidas.',
      'auth/invalid-email':'Correo inválido.',
      'auth/email-already-in-use':'Ese correo ya está registrado.',
      'auth/weak-password':'Contraseña muy débil (mínimo 6).',
      'auth/network-request-failed':'Error de red.',
      'auth/too-many-requests':'Demasiados intentos. Espera.'
    };
    return map[String(err?.code||'')]||err?.message||'Error inesperado.';
  }

  /* ── Firebase wait ── */
  function waitForFirebase(timeout=7000){
    return new Promise(resolve=>{
      const ok=()=>window.db&&window.auth&&window.collection&&window.getDocs&&window.getDoc&&window.fsDoc&&window.setDoc&&window.updateDoc&&window.addDoc&&window.signInWithEmailAndPassword&&window.createUserWithEmailAndPassword&&window.signOut&&window.updateProfile&&window.sendPasswordResetEmail&&window.onAuthStateChanged;
      if(ok()) return resolve(true);
      const start=Date.now();
      const t=setInterval(()=>{ if(ok()){clearInterval(t);resolve(true);} else if(Date.now()-start>timeout){clearInterval(t);resolve(false);} },100);
    });
  }

  /* ── Firestore helpers ── */
  async function loadSettings(){
    try{
      const [a,b]=await Promise.all([
        window.getDoc(window.fsDoc(window.db,'settings','site')).catch(()=>null),
        window.getDoc(window.fsDoc(window.db,'settings','minigames')).catch(()=>null)
      ]);
      return {...(a&&a.exists()?a.data()||{}:{}),...(b&&b.exists()?b.data()||{}:{})};
    }catch{ return {}; }
  }
  async function getUserData(uid){
    try{ const s=await window.getDoc(window.fsDoc(window.db,'users',uid)); return s.exists()?s.data()||null:null; }catch{ return null; }
  }
  async function createUserDoc(user, extras={}){
    const now=new Date().toISOString();
    const name=extras.displayName||user.displayName||user.email?.split('@')[0]||'Miembro';
    const payload={
      displayName:name, username:extras.username||name, email:user.email||'',
      avatar:'😊', bio:'', favoriteProject:'Nuestra Tierra Job Simulator',
      country:'Colombia', coins:0, emeralds:0, level:'visitor',
      referralCode:generateReferralCode(user.uid), referredBy:null,
      referralCount:0, referralCoins:0, streak:0, lastDaily:null,
      role:extras.role||'viewer', createdAt:now, updatedAt:now
    };
    await window.setDoc(window.fsDoc(window.db,'users',user.uid),payload,{merge:true});
    return payload;
  }
  async function updateUserData(uid, data){
    await window.setDoc(window.fsDoc(window.db,'users',uid),{...data,updatedAt:new Date().toISOString()},{merge:true});
  }
  async function addActivity(uid, type, description, coins=0){
    try{ await window.addDoc(window.collection(window.db,'users',uid,'activity'),{type,description,coins,createdAt:new Date().toISOString()}); }
    catch(e){ console.warn('Activity:',e); }
  }
  async function getActivity(uid, limit=8){
    try{
      const s=await window.getDocs(window.collection(window.db,'users',uid,'activity'));
      return s.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
        .slice(0,limit);
    }catch{ return []; }
  }
  async function isUsernameTaken(username, excludeUid=''){
    if(!window.db||!window.getDocs||!window.query||!window.collection||!window.where) return false;
    const s=await window.getDocs(window.query(window.collection(window.db,'users'),window.where('username','==',username)));
    return s.docs.some(d=>d.id!==excludeUid);
  }
  async function resolveUsername(username, excludeUid=''){
    const desired=String(username||'').trim();
    if(!desired) return{username:desired,changed:false};
    try{
      if(!await isUsernameTaken(desired,excludeUid)) return{username:desired,changed:false};
      const sug=[desired+Math.floor(Math.random()*900+100),desired+Math.floor(Math.random()*900+100),desired+'_GG'];
      for(const s of sug){ if(!await isUsernameTaken(s,excludeUid)) return{username:s,changed:true}; }
    }catch(e){ console.warn('Username:',e); }
    return{username:`${desired.slice(0,18)||'Jugador'}${Math.floor(Math.random()*9000+1000)}`.slice(0,24),changed:true};
  }
  async function processReferral(refCode, newUid){
    if(!refCode) return{applied:false,reason:'not-provided',reward:0};
    const n=normalizeCode(refCode); if(!n) return{applied:false,reason:'not-provided',reward:0};
    try{
      const snap=await window.getDocs(window.collection(window.db,'users'));
      const referrer=snap.docs.find(d=>String(d.data()?.referralCode||'').toUpperCase()===n);
      if(!referrer) return{applied:false,reason:'invalid',reward:0};
      if(referrer.id===newUid) return{applied:false,reason:'self',reward:0};
      const reward=Number(settings.referralCoins||50), d=referrer.data()||{};
      await updateUserData(referrer.id,{referralCount:Number(d.referralCount||0)+1,referralCoins:Number(d.referralCoins||0)+reward,coins:Number(d.coins||0)+reward});
      await updateUserData(newUid,{referredBy:n});
      await addActivity(referrer.id,'referral','Nuevo referido registrado',reward);
      return{applied:true,reason:'applied',reward};
    }catch(e){ console.warn('Referral:',e); return{applied:false,reason:'error',reward:0}; }
  }
  async function loadSupportSnapshot(user){
    const email=String(user?.email||'').trim().toLowerCase();
    if(!email) return{total:0,count:0,sponsor:null};
    try{
      const [ds,ss]=await Promise.all([
        window.getDocs(window.collection(window.db,'donations')).catch(()=>null),
        window.getDocs(window.collection(window.db,'sponsors')).catch(()=>null)
      ]);
      const donations=(ds?ds.docs.map(d=>({id:d.id,...d.data()})):[]).filter(i=>String(i.email||i.userEmail||'').trim().toLowerCase()===email||String(i.uid||'')===user.uid);
      const sponsor=(ss?ss.docs.map(d=>({id:d.id,...d.data()})):[]).find(i=>String(i.email||i.userEmail||'').trim().toLowerCase()===email||String(i.uid||'')===user.uid)||null;
      return{total:donations.reduce((a,i)=>a+(Number(i.amount)||0),0),count:donations.length,sponsor};
    }catch{ return{total:0,count:0,sponsor:null}; }
  }
  async function loadPreregSnapshot(user){
    const email=String(user?.email||'').trim().toLowerCase();
    if(!email) return{registered:false,data:null};
    try{
      const d=await window.getDoc(window.fsDoc(window.db,'preregistros',email)).catch(()=>null);
      if(d&&d.exists()) return{registered:true,data:d.data()||{}};
      const snap=await window.getDocs(window.collection(window.db,'preregistros')).catch(()=>null);
      if(!snap) return{registered:false,data:null};
      const f=snap.docs.find(doc=>String(doc.data()?.email||'').trim().toLowerCase()===email);
      return f?{registered:true,data:f.data()||{}}:{registered:false,data:null};
    }catch{ return{registered:false,data:null}; }
  }
  async function loadProjectUpdates(limit=4){
    try{
      const snap=await window.getDocs(window.collection(window.db,'project_updates'));
      return snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(i=>i.published!==false)
        .sort((a,b)=>String(b.date||b.updatedAt||b.createdAt||'').localeCompare(String(a.date||a.updatedAt||a.createdAt||'')))
        .slice(0,limit);
    }catch{ return[]; }
  }
  async function loadRedemptionHistory(uid){
    try{
      const snap=await window.getDocs(window.collection(window.db,REDEEM_COLLECTION));
      return snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(i=>i.uid===uid)
        .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    }catch{ return[]; }
  }
  async function submitRedemption(uid, coinsStr){
    const coins=parseInt(coinsStr,10);
    if(isNaN(coins)||coins<MIN_REDEEM_COINS) return{ok:false,msg:`Mínimo ${MIN_REDEEM_COINS} monedas.`};
    if(coins>Number(currentUserData?.coins||0)) return{ok:false,msg:'No tienes suficientes monedas.'};
    const emeralds=coinsToEmeralds(coins);
    if(emeralds<=0) return{ok:false,msg:'El monto no alcanza.'};
    try{
      await window.addDoc(window.collection(window.db,REDEEM_COLLECTION),{uid,email:currentUser?.email||'',username:currentUserData?.username||currentUserData?.displayName||'',coins,emeralds,status:'completed',createdAt:new Date().toISOString()});
      const newCoins=Number(currentUserData.coins||0)-coins, newEmeralds=Number(currentUserData.emeralds||0)+emeralds;
      await updateUserData(uid,{coins:newCoins,emeralds:newEmeralds});
      await addActivity(uid,'exchange',`Canje: ${coins}🪙 → ${emeralds}💎`,-coins);
      currentUserData.coins=newCoins; currentUserData.emeralds=newEmeralds;
      return{ok:true,msg:`Canje exitoso: +${emeralds} 💎`};
    }catch(e){ console.error('Redeem:',e); return{ok:false,msg:'No se pudo completar el canje.'}; }
  }

  /* ── Show/hide ── */
  function showAuth(){
    if(authSection) authSection.style.display='flex';
    if(dashboard){ dashboard.style.display='none'; dashboard.classList.remove('active'); }
  }
  function showDashboard(){
    if(authSection) authSection.style.display='none';
    if(dashboard){ dashboard.style.display='block'; dashboard.classList.add('active'); }
  }

  /* ── Render helpers ── */
  function badge(label, tone){ return `<span class="bp${tone?' '+tone:''}">${esc(label)}</span>`; }

  function renderBadges(data, user){
    if(!profileBadges) return;
    const b=[];
    if(user?.emailVerified) b.push(badge('✓ Email','g'));
    if(preregSnapshot.registered) b.push(badge('Pre-reg','b'));
    if(Number(data.referralCount||0)>0) b.push(badge(data.referralCount+' refs','pu'));
    if(supportSnapshot.total>0) b.push(badge('Patroc.','go'));
    if(SPECIAL_ACCESS_ROLES.has(String(data.role||'').toLowerCase())) b.push(badge(roleLabel(data.role),'r'));
    profileBadges.innerHTML=b.join('');
  }

  function renderSponsorLevel(level){
    const bm={visitor:'👤',supporter:'💖',bronze:'🥉',silver:'🥈',gold:'🥇',platinum:'💎',founder:'🏆'};
    const dm={visitor:'Haz una donación para subir de nivel.',supporter:'Gracias por apoyar.',bronze:'Miembro Bronce.',silver:'Acceso anticipado.',gold:'Extras exclusivos.',platinum:'Beneficios premium.',founder:'Fundador.'};
    const l=String(level||'visitor').toLowerCase();
    if(sponsorBadge) sponsorBadge.textContent=bm[l]||'👤';
    if(sponsorLevelName) sponsorLevelName.textContent=getLevelName(l);
    if(sponsorLevelDesc) sponsorLevelDesc.textContent=dm[l]||dm.visitor;
  }

  function renderStreakDays(streak){
    const n=Number(streak||0);
    streakDays.forEach(el=>{ const d=Number(el.dataset.day||0); el.classList.toggle('completed',n>0&&d<=(n%7||7)); });
  }



  function checkDailyCooldown(lastDaily){
    if(!lastDaily){ if(claimDailyBtn) claimDailyBtn.disabled=false; return; }
    const last=new Date(lastDaily), now=new Date();
    const ld=new Date(last.getFullYear(),last.getMonth(),last.getDate());
    const td=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(claimDailyBtn) claimDailyBtn.disabled=td.getTime()<=ld.getTime();
  }

  function renderProfile(){
    if(!currentUser||!currentUserData) return;
    const d=currentUserData;
    const name=String(d.displayName||d.username||currentUser.displayName||currentUser.email?.split('@')[0]||'Miembro');
    const role=String(d.role||'viewer').toLowerCase();
    const set=(el,v)=>{ if(el) el.textContent=v; };

    set(profileAvatarLetter, d.avatar||'😊');
    set(profileDisplayName, name);
    set(profileEmail, currentUser.email||'');
    set(profileUid, 'UID: '+String(currentUser.uid||'').slice(0,12));
    set(profileCoins, String(Number(d.coins||0)));
    if(profileCoinsDollars) profileCoinsDollars.textContent=formatEmeralds(d.emeralds||0);
    set(profileLevel, getLevelName(d.level));
    set(profileRole, roleLabel(role));
    set(profileJoinDate, formatDate(d.createdAt));
    set(profileStreak, String(Number(d.streak||0)));
    set(profileVerificationStatusSide, currentUser.emailVerified?'Sí':'No');
    set(profileProviderSide, providerLabel(currentUser));
    set(profilePreregisterStatusSide, preregSnapshot.registered?'Activo':'Pendiente');
    set(profileAccessLevel, SPECIAL_ACCESS_ROLES.has(role)?'Especial':'Miembro');
    set(profileCountry, d.country||'No definido');
    set(profileFavoriteProject, d.favoriteProject||'No definido');
    set(profileBio, d.bio||'Sin descripción aún.');
    set(profileSupportTotal, `$${Number(supportSnapshot.total||0).toFixed(2)}`);
    set(profileSupportCount, `${supportSnapshot.count} aportes`);
    set(profileSponsorSummary, supportSnapshot.total>0?`$${Number(supportSnapshot.total||0).toFixed(2)} en ${supportSnapshot.count} mov.`:'Sin aportes registrados.');
    set(referralCode, d.referralCode||generateReferralCode(currentUser.uid));
    set(referralCount, String(Number(d.referralCount||0)));
    set(referralCoins, String(Number(d.referralCoins||0)));
    set(redeemCoinsAvailable, String(Number(d.coins||0)));
    if(redeemDollars) redeemDollars.textContent=formatEmeralds(coinsToEmeralds(d.coins||0));
    const gp=countGamesPlayedToday(currentUser.uid);
    set(profileGamesPlayedToday, `${gp}/3`);

    renderSponsorLevel(d.level);
    renderStreakDays(d.streak||0);
    checkDailyCooldown(d.lastDaily);
    renderBadges(d, currentUser);
    if(profileAdminTools) profileAdminTools.hidden=!SPECIAL_ACCESS_ROLES.has(role);
  }

  function renderActivity(items){
    if(!activityList) return;
    if(!items.length){
      activityList.innerHTML='<li class="act-item"><div class="act-txt"><div class="act-title" style="color:#2d5570">Sin actividad reciente</div></div></li>';
      return;
    }
    const icons={register:'🎉',referral:'👥',daily:'📅',profile:'📝',exchange:'💎'};
    activityList.innerHTML=items.map(item=>{
      const c=Number(item.coins||0);
      return`<li class="act-item">
        <div class="act-ico">${icons[item.type]||'✨'}</div>
        <div class="act-txt">
          <div class="act-title">${esc(item.description||'Actividad')}</div>
          <div class="act-time">${esc(formatDateLong(item.createdAt))}</div>
        </div>
        <div class="act-coins${c<0?' neg':''}">${c?`${c>0?'+':''}${c}🪙`:''}</div>
      </li>`;
    }).join('');
  }

  function renderProjectFeed(updates){
    if(!projectUpdateFeed) return;
    if(!updates.length){ projectUpdateFeed.innerHTML='<p style="color:#2d5570;font-size:.72rem">Sin novedades.</p>'; return; }
    projectUpdateFeed.innerHTML=updates.map(item=>{
      const p=new URLSearchParams({projectId:String(item.projectId||''),projectType:String(item.projectType||'juego')});
      const href=item.projectId?`proyecto.html?${p}`:'actualizaciones.html';
      return`<a class="feed-link" href="${esc(href)}">
        <strong>${esc(item.title||'Actualización')}</strong>
        <span>${esc(item.projectTitle||'Proyecto')}</span>
        <small>${esc(formatDateLong(item.date||item.updatedAt||item.createdAt))}</small>
      </a>`;
    }).join('');
  }

  function renderRedemptionHistory(history){
    if(!redeemHistoryList||!redeemHistory) return;
    if(!history.length){ redeemHistory.hidden=true; return; }
    redeemHistory.hidden=false;
    redeemHistoryList.innerHTML=history.map(item=>`
      <div class="rdm-hist-item">
        <div>
          <strong>${esc(String(item.coins||0))}🪙 → ${esc(formatEmeralds(item.emeralds||coinsToEmeralds(item.coins||0)))}</strong>
          <small>${esc(formatDateLong(item.createdAt))}</small>
        </div>
        <span class="rdm-status ${item.status||'completed'}">${esc(item.status||'completado')}</span>
      </div>`).join('');
    const totalEm=history.reduce((s,i)=>s+Number(i.emeralds||coinsToEmeralds(i.coins||0)),0);
    if(redeemTotalPaid) redeemTotalPaid.textContent=formatEmeralds(totalEm);
    if(redeemTotalCount) redeemTotalCount.textContent=String(history.length);
  }


    _spinning = true;
    const startTime = performance.now();
    const delta = angleEnd - angleStart;

    function frame(now) {
      const elapsed = now - startTime;
      const t       = Math.min(elapsed / durationMs, 1);
      const current = angleStart + delta * easeOut(t);
      drawWheelAt(current % 360);
      if (t < 1) {
        _rafId = requestAnimationFrame(frame);
      } else {
        _spinning = false;
        _rafId    = null;
        drawWheelAt(angleEnd % 360);
        if (onComplete) onComplete(angleEnd % 360);
      }
    }
    _rafId = requestAnimationFrame(frame);
  }

  /* Dibuja la rueda estática (estado inicial / reset) */
  function buildSpinLabels() { drawWheelAt(0); }

  /* ── Load dashboard data ── */
  async function loadDashboardData(){
    if(!currentUser) return;
    const [activity, updates, redemptions]=await Promise.all([
      getActivity(currentUser.uid,8),
      loadProjectUpdates(4),
      loadRedemptionHistory(currentUser.uid)
    ]);
    renderActivity(activity);
    renderProjectFeed(updates);
    renderRedemptionHistory(redemptions);
  }

  /* ── Auth state ── */
  async function handleAuthStateChange(user){
    currentUser=user;
    if(!user){ currentUserData=null; showAuth(); return; }
    currentUserData=await getUserData(user.uid);
    if(!currentUserData){
      try{ currentUserData=await createUserDoc(user,{displayName:user.displayName||user.email?.split('@')[0]||'Miembro'}); }
      catch(err){
        if(isPermDenied(err)){
          currentUserData={displayName:user.displayName||user.email?.split('@')[0]||'Miembro',username:user.email?.split('@')[0]||'Miembro',email:user.email||'',avatar:'😊',bio:'',favoriteProject:'',country:'',coins:0,emeralds:0,level:'visitor',referralCode:generateReferralCode(user.uid),referredBy:null,referralCount:0,referralCoins:0,streak:0,lastDaily:null,lastSpin:null,role:'viewer',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
          setAuthMessage('Firestore bloqueó el perfil (permission-denied). Ajusta reglas de "users".','error');
        }else throw err;
      }
    }
    supportSnapshot=await loadSupportSnapshot(user);
    preregSnapshot=await loadPreregSnapshot(user);
    showDashboard();
    renderProfile();
    await loadDashboardData();
  }

  /* ════════════════════════════
     EVENTS
  ════════════════════════════ */

  authTabs.forEach(tab=>{
    tab.addEventListener('click',()=>{
      authTabs.forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin=tab.dataset.tab==='login';
      if(loginForm){ loginForm.style.display=isLogin?'flex':'none'; loginForm.classList.toggle('active',isLogin); }
      if(registerForm){ registerForm.style.display=isLogin?'none':'flex'; registerForm.classList.toggle('active',!isLogin); }
      setAuthMessage('');
    });
  });

  loginForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    setAuthMessage('Iniciando sesión...');
    try{ await window.signInWithEmailAndPassword(window.auth,String($('loginEmail')?.value||'').trim(),String($('loginPassword')?.value||'')); }
    catch(err){ setAuthMessage(getAuthError(err),'error'); }
  });

  registerForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=String($('registerEmail')?.value||'').trim();
    const password=String($('registerPassword')?.value||'');
    const referral=normalizeCode($('registerReferral')?.value||getPendingCode());
    if(!await waitForFirebase()){ setAuthMessage('Firebase no está listo. Recarga la página.','error'); return; }
    try{
      setAuthMessage('Creando cuenta...');
      const cred=await window.createUserWithEmailAndPassword(window.auth,email,password);
      const {username:finalName,changed}=await resolveUsername(email.split('@')[0]||'Jugador',cred.user.uid);
      await window.updateProfile(cred.user,{displayName:finalName});
      try{
        await createUserDoc(cred.user,{displayName:finalName,username:finalName});
        if(referral) await processReferral(referral,cred.user.uid);
        await addActivity(cred.user.uid,'register','Cuenta creada',0);
        setPendingCode('');
        setAuthMessage(`¡Cuenta creada!${changed?' Usuario: '+finalName:''}`, 'success');
      }catch(pe){
        if(isPermDenied(pe)) setAuthMessage('Cuenta creada en Auth, pero Firestore bloqueó el perfil.','error');
        else throw pe;
      }
      registerForm.reset();
    }catch(err){ setAuthMessage(getAuthError(err),'error'); }
  });

  forgotLink?.addEventListener('click',async e=>{
    e.preventDefault();
    const email=String($('loginEmail')?.value||'').trim();
    if(!email){ setAuthMessage('Ingresa tu correo primero.','error'); return; }
    try{ await window.sendPasswordResetEmail(window.auth,email); setAuthMessage('Correo de recuperación enviado.','success'); }
    catch(err){ setAuthMessage(getAuthError(err),'error'); }
  });

  logoutBtn?.addEventListener('click',async()=>{ try{ await window.signOut(window.auth); }catch(e){ console.error(e); } });

  spinBtn?.addEventListener('click', async () => {
    if (!currentUser || !currentUserData || spinBtn.disabled || _spinning) return;
    spinBtn.disabled = true;
    if (spinMessage) { spinMessage.textContent = ''; spinMessage.className = ''; }
    playClickSound();

    /* Ángulo de destino: mínimo 5 vueltas completas + aleatorio */
    const extraSpins  = 5 + Math.floor(Math.random() * 4);   // 5–8 vueltas
    const extraAngle  = Math.floor(Math.random() * 360);
    const totalAngle  = extraSpins * 360 + extraAngle;        // grados totales
    const finalAngle  = totalAngle % 360;                     // ángulo final normalizado

    /* El puntero apunta hacia arriba (270° = -90°).
       El segmento 0 empieza en -90° (arriba).
       Con finalAngle grados de rotación, el segmento que
       queda bajo el puntero es: */
    const n        = spinPrizes.length;
    const degPerSeg= 360 / n;
    /* Offset: cuántos grados ha rotado la rueda desde su posición inicial */
    /* El segmento i ocupa [i*degPerSeg, (i+1)*degPerSeg] en la rueda sin rotar.
       Después de rotar `finalAngle` grados, el puntero (que está fijo en la parte superior)
       apunta al ángulo (360 - finalAngle) % 360 de la rueda original. */
    const pointerAt = (360 - finalAngle % 360 + 360) % 360;
    const idx       = Math.floor(pointerAt / degPerSeg) % n;
    const prize     = spinPrizes[idx];

    /* Animar */
    animateSpin(0, totalAngle, 4000, async (endAngle) => {
      /* Resaltar ganador */
      drawWheelAt(endAngle, idx);
      playWinSound();

      if (spinPointer) {
        spinPointer.classList.add('click');
        setTimeout(() => spinPointer.classList.remove('click'), 900);
      }

      /* Guardar en Firebase */
      const newCoins = Number(currentUserData.coins || 0) + prize;
      const now      = new Date().toISOString();
      await updateUserData(currentUser.uid, { coins: newCoins, lastSpin: now });
      await addActivity(currentUser.uid, 'spin', `Ruleta: ganaste ${prize} monedas`, prize);
      currentUserData.coins    = newCoins;
      currentUserData.lastSpin = now;
      renderProfile();
      await loadDashboardData();

      if (spinMessage) {
        spinMessage.textContent = `¡+${prize} monedas! 🎉`;
        spinMessage.className   = 'success';
      }

      /* 3 segundos después, reset visual */
      setTimeout(() => {
        drawWheelAt(0);
      }, 3000);
    });
  });

  claimDailyBtn?.addEventListener('click',async()=>{
    if(!currentUser||!currentUserData||claimDailyBtn.disabled) return;
    claimDailyBtn.disabled=true;
    const base=Number(settings.dailyBonusCoins||10);
    const now=new Date(), last=currentUserData.lastDaily?new Date(currentUserData.lastDaily):null;
    let streak=1;
    if(last){ const y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1), ld=new Date(last.getFullYear(),last.getMonth(),last.getDate()); if(ld.getTime()===y.getTime()) streak=Number(currentUserData.streak||0)+1; }
    const bonus=base+(streak>=7?base:0), newCoins=Number(currentUserData.coins||0)+bonus, nowIso=now.toISOString();
    await updateUserData(currentUser.uid,{coins:newCoins,streak,lastDaily:nowIso});
    await addActivity(currentUser.uid,'daily','Bonus diario reclamado',bonus);
    currentUserData.coins=newCoins; currentUserData.streak=streak; currentUserData.lastDaily=nowIso;
    renderProfile(); await loadDashboardData();
    if(dailyBonusMessage){ dailyBonusMessage.textContent=`+${bonus}🪙${streak>=7?' + racha':''}!`; dailyBonusMessage.className='success'; }
  });

  copyReferralBtn?.addEventListener('click',async()=>{
    const code=String(referralCode?.textContent||'').trim(); if(!code) return;
    try{ await navigator.clipboard.writeText(code); copyReferralBtn.textContent='Copiado!'; setTimeout(()=>copyReferralBtn.textContent='Copiar',1800); }catch{}
  });

  redeemBtn?.addEventListener('click',async()=>{
    if(!currentUser||!currentUserData) return;
    redeemBtn.disabled=true;
    if(redeemMessage){ redeemMessage.textContent='Procesando...'; redeemMessage.className=''; }
    const r=await submitRedemption(currentUser.uid,redeemAmountInput?.value||'0');
    if(redeemMessage){ redeemMessage.textContent=r.msg; redeemMessage.className=r.ok?'success':'error'; }
    if(r.ok){ if(redeemAmountInput) redeemAmountInput.value=''; renderProfile(); await loadDashboardData(); }
    redeemBtn.disabled=false;
  });

  editProfileBtn?.addEventListener('click',()=>{
    if(!currentUserData||!editProfileModal) return;
    $('editDisplayName').value=currentUserData.displayName||currentUser?.displayName||'';
    $('editBio').value=currentUserData.bio||'';
    $('editFavoriteProject').value=currentUserData.favoriteProject||'';
    $('editCountry').value=currentUserData.country||'';
    $('editAvatarValue').value=currentUserData.avatar||'😊';
    $$('.av-opt').forEach(b=>b.classList.toggle('selected',b.dataset.avatar===(currentUserData.avatar||'😊')));
    editProfileModal.showModal();
  });

  $$('.av-opt').forEach(b=>{
    b.addEventListener('click',()=>{ $$('.av-opt').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); $('editAvatarValue').value=b.dataset.avatar||'😊'; });
  });

  editProfileForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!currentUser) return;
    const p={displayName:String($('editDisplayName')?.value||'').trim(),bio:String($('editBio')?.value||'').trim(),favoriteProject:String($('editFavoriteProject')?.value||'').trim(),country:String($('editCountry')?.value||'').trim(),avatar:String($('editAvatarValue')?.value||'😊')};
    await updateUserData(currentUser.uid,p);
    await window.updateProfile(currentUser,{displayName:p.displayName});
    await addActivity(currentUser.uid,'profile','Perfil actualizado',0);
    currentUserData={...currentUserData,...p};
    renderProfile(); await loadDashboardData();
    editProfileModal.close();
  });

  $$('[data-close-modal]').forEach(btn=>{
    btn.addEventListener('click',()=>{ const m=$(btn.getAttribute('data-close-modal')||''); if(m&&typeof m.close==='function') m.close(); });
  });

  /* ── Init ── */
  async function init(){
    if(!await waitForFirebase()){ setAuthMessage('No se pudo conectar con Firebase.','error'); return; }
    prefillReferralField();
    settings=await loadSettings();
    if(dailyBonusAmount) dailyBonusAmount.textContent=String(Number(settings.dailyBonusCoins||10));
    buildSpinLabels();
    window.onAuthStateChanged(window.auth, user=>{
      handleAuthStateChange(user).catch(err=>{ console.error('Auth:',err); setAuthMessage('No se pudo cargar tu perfil.','error'); });
    });
  }

  init();
})();