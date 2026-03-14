// visibility-admin.js — simple admin UI to manage site visibility
(function(){
  'use strict';
  console.log('[visibility-admin] loaded');
  const ALLOWED_CEO = 'pantergamey@gmail.com';
  const grid = document.getElementById('visibilityGrid');
  const panel = document.getElementById('visibilityPanel');
  const gateMsg = document.getElementById('adminGateMessage');
  const backBtn = document.getElementById('visBackBtn');
  const saveBtn = document.getElementById('saveVisibilityBtn');

  const PAGES = {
    minijuegos: 'Minijuegos',
    perfil: 'Perfil',
    donaciones: 'Apóyanos',
    personal: 'Personal',
    actualizaciones: 'Actualizaciones'
  };

  const LS_KEY = 'siteVisibilitySettings_v1';

  function defaultSettings(){
    const d = { pages: {} };
    Object.keys(PAGES).forEach(k=> d.pages[k] = { public: true, allowedEmails: [], allowedRoles: [], maintenance:false });
    return d;
  }

  async function loadSettings(){
    try{
      if (window.db && window.getDoc && window.fsDoc){
        const doc = await window.getDoc(window.fsDoc(window.db,'admin','siteVisibility'));
        if (doc && doc.exists && doc.exists()) return doc.data();
      }
    }catch(e){ console.warn('visibility-admin: firestore read failed', e); }
    try{ const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); }catch(e){}
    return defaultSettings();
  }

  async function saveSettings(settings){
    try{
      if (window.db && window.setDoc && window.fsDoc){
        await window.setDoc(window.fsDoc(window.db,'admin','siteVisibility'), settings, { merge: true });
      }else{
        localStorage.setItem(LS_KEY, JSON.stringify(settings));
      }
      return true;
    }catch(e){ console.warn('visibility-admin save failed', e); try{ localStorage.setItem(LS_KEY, JSON.stringify(settings)); return true;}catch(e2){return false;} }
  }

  function createCard(key, cfg){
    const card = document.createElement('div'); card.className='visibility-card';
    const title = document.createElement('h3'); title.textContent = PAGES[key] || key; card.appendChild(title);
    const publicLabel = document.createElement('label'); publicLabel.textContent='Público'; publicLabel.style.display='inline-flex'; publicLabel.style.alignItems='center'; publicLabel.style.gap='8px';
    const publicChk = document.createElement('input'); publicChk.type='checkbox'; publicChk.checked = (cfg && typeof cfg.public !== 'undefined') ? !!cfg.public : true;
    publicLabel.insertBefore(publicChk, publicLabel.firstChild);
    card.appendChild(publicLabel);
    const emailsLabel = document.createElement('label'); emailsLabel.textContent='Emails permitidos (coma separado)'; card.appendChild(emailsLabel);
    const emailsInp = document.createElement('textarea'); emailsInp.rows=2; emailsInp.value=(cfg.allowedEmails||[]).join(', '); card.appendChild(emailsInp);
    const rolesLabel = document.createElement('label'); rolesLabel.textContent='Roles permitidos (coma separado)'; card.appendChild(rolesLabel);
    const rolesInp = document.createElement('input'); rolesInp.type='text'; rolesInp.value=(cfg.allowedRoles||[]).join(', '); card.appendChild(rolesInp);
    const maintLabel = document.createElement('label'); maintLabel.textContent='Poner en mantenimiento'; card.appendChild(maintLabel);
    const maintChk = document.createElement('input'); maintChk.type='checkbox'; maintChk.checked = !!cfg.maintenance; card.appendChild(maintChk);
    card.dataset.pageKey = key;
    card.getValues = () => ({ public: !!publicChk.checked, allowedEmails: emailsInp.value.split(',').map(s=>s.trim()).filter(Boolean), allowedRoles: rolesInp.value.split(',').map(s=>s.trim()).filter(Boolean), maintenance: !!maintChk.checked });
    return card;
  }

  function showPanel(){ panel.hidden=false; document.getElementById('adminGate').hidden=true; }

  async function init(){
    // auth gate: only CEO email allowed
    function bootAuth(){
      if (!window.auth || !window.onAuthStateChanged) {
        gateMsg.textContent='Autenticación no disponible (esperando Firebase)...';
        // If firebase-config loads later it will dispatch 'firebaseReady'
        document.addEventListener('firebaseReady', () => {
          gateMsg.textContent = 'Firebase listo, verificando sesión...';
          bootAuth();
        }, { once: true });
        return;
      }
      window.onAuthStateChanged(window.auth, async (user)=>{
        if (!user){ gateMsg.textContent='Debes iniciar sesión como administrador'; return; }
        const email = (user.email||'').toLowerCase();
        if (email !== ALLOWED_CEO){ gateMsg.textContent='Acceso restringido: CEO necesario.'; return; }
        gateMsg.textContent = 'Acceso concedido';
        showPanel();
        const settings = await loadSettings();
        // populate global maintenance checkbox
        try{ const gm = document.getElementById('globalMaintenanceChk'); if (gm) gm.checked = !!(settings.globalMaintenance); }catch(e){}
        Object.keys(PAGES).forEach(k=> grid.appendChild(createCard(k, settings.pages&&settings.pages[k] ? settings.pages[k] : {public:true, allowedEmails:[], allowedRoles:[], maintenance:false})) );
      });
      if (window.auth && window.auth.currentUser) window.onAuthStateChanged(window.auth, user=>{});
    }
    bootAuth();
  }

  backBtn.addEventListener('click', ()=>{ window.location.href='admin.html'; });
  saveBtn.addEventListener('click', async ()=>{
    const cards = Array.from(grid.querySelectorAll('.visibility-card'));
    const settings = { pages: {} };
    cards.forEach(c=>{ const k = c.dataset.pageKey; settings.pages[k] = c.getValues(); });
    // include global maintenance flag
    try{ const gm = document.getElementById('globalMaintenanceChk'); settings.globalMaintenance = !!(gm && gm.checked); }catch(e){ settings.globalMaintenance = false; }
    const ok = await saveSettings(settings);
    if (ok) alert('Guardado correctamente'); else alert('Error al guardar');
  });

  // Developer override buttons (localStorage)
  document.addEventListener('DOMContentLoaded', ()=>{
    const forceBtn = document.getElementById('devForceAllowBtn');
    const clearBtn = document.getElementById('devClearOverrideBtn');
    const status = document.getElementById('devOverrideStatus');
    function refreshStatus(){ status.textContent = localStorage.getItem('siteVisibilityForceAll') === 'true' ? 'Override activo: todas las páginas permitidas (local)' : 'Override inactivo'; }
    if (forceBtn) forceBtn.addEventListener('click', ()=>{ localStorage.setItem('siteVisibilityForceAll','true'); refreshStatus(); alert('Override local activado: todas las páginas permitidas'); });
    if (clearBtn) clearBtn.addEventListener('click', ()=>{ localStorage.removeItem('siteVisibilityForceAll'); refreshStatus(); alert('Override local eliminado'); });
    refreshStatus();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
