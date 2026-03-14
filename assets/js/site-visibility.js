// site-visibility.js
// Controls runtime visibility of site sections/pages based on admin settings.
(function(){
  'use strict';
  console.log('[site-visibility] init');
  // Temporarily disable visibility enforcement during testing/development.
  // Set this to `false` to re-enable the admin visibility checks.
  const SITE_VISIBILITY_DISABLED = true;
  const PAGES = {
    minijuegos: 'pages/minijuegos.html',
    perfil: 'pages/perfil.html',
    donaciones: 'pages/donaciones.html',
    personal: 'pages/personal.html',
    actualizaciones: 'pages/actualizaciones.html'
  };

  const LS_KEY = 'siteVisibilitySettings_v1';

  const DEFAULT = { pages: {} };
  Object.keys(PAGES).forEach(k => { DEFAULT.pages[k] = { allowedEmails: [], allowedRoles: [], maintenance: false }; });

  function getCurrentEmail(){
    try{
      if (window.auth && window.auth.currentUser && window.auth.currentUser.email) return String(window.auth.currentUser.email).toLowerCase();
    }catch(e){}
    // No fallback — visibility decisions come only from admin settings and authenticated email when available
    return '';
  }

  async function loadSettings(){
    // Try Firestore first
    try{
      if (window.db && window.getDoc && window.fsDoc){
        const doc = await window.getDoc(window.fsDoc(window.db, 'admin', 'siteVisibility'));
        if (doc && doc.exists && doc.exists()){
          const data = doc.data();
          return Object.assign({}, DEFAULT, data);
        }
      }
    }catch(e){ console.warn('site-visibility: firestore read failed', e); }

    try{ const raw = localStorage.getItem(LS_KEY); if (raw) return Object.assign({}, DEFAULT, JSON.parse(raw)); } catch(e){}
    return DEFAULT;
  }

  function saveLocal(settings){ try{ localStorage.setItem(LS_KEY, JSON.stringify(settings)); }catch(e){console.warn(e);} }

  function hideLinksForPage(pageKey){
    const href = PAGES[pageKey];
    if (!href) return;
    // Hide nav and any anchor references
    document.querySelectorAll(`a[href$="${href}"]`).forEach(a=>{
      a.style.display = 'none';
    });
    // Also hide buttons that link to it
    document.querySelectorAll(`a[href*="/${href}"]`).forEach(a=>{ a.style.display='none'; });
  }

  function showMaintenanceOverlay(message){
    if (document.getElementById('siteMaintenanceOverlay')) return;
    const o = document.createElement('div');
    o.id = 'siteMaintenanceOverlay';
    o.style.position='fixed'; o.style.inset='0'; o.style.zIndex='99999'; o.style.display='flex'; o.style.alignItems='center'; o.style.justifyContent='center';
    o.style.background='linear-gradient(180deg, rgba(4,8,20,0.6), rgba(4,8,20,0.8))';
    const card = document.createElement('div');
    card.style.background='linear-gradient(180deg,#0b1220,#071226)'; card.style.padding='28px'; card.style.borderRadius='12px'; card.style.color='#e6f4ff'; card.style.maxWidth='720px';
    const siteRoot = (document.body && document.body.dataset && document.body.dataset.siteRoot) ? document.body.dataset.siteRoot : '';
    const homeHref = siteRoot ? siteRoot.replace(/\/$/, '') + '/index.html' : 'index.html';
    card.innerHTML = `<h2 style="margin-top:0">Página en mantenimiento</h2><p style="opacity:.9">${message||'Esta sección está en mantenimiento temporalmente.'}</p><div style="margin-top:18px;text-align:right"><a id="mvHomeBtn" href="${homeHref}" class="btn">Volver al inicio</a></div>`;
    o.appendChild(card); document.body.appendChild(o);
    try{
      const btn = card.querySelector('#mvHomeBtn');
      if (btn){ btn.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href = homeHref; }); }
    }catch(e){}
  }

  async function apply(){
    if (SITE_VISIBILITY_DISABLED){ console.log('[site-visibility] DISABLED — visibility enforcement skipped'); return; }
    const settings = await loadSettings();
    // Developer override: if set, allow everything locally (useful when Firebase unavailable)
    try{ if (localStorage.getItem('siteVisibilityForceAll') === 'true'){ console.log('[site-visibility] developer override active: allowing all pages'); return; } }catch(e){}
    const email = getCurrentEmail();
    const currentPage = (window.location.pathname||'').split('/').pop() || '';
    console.log('[site-visibility] settings loaded', settings, 'email=', email, 'currentPage=', currentPage);
    // Global maintenance: if set in admin settings, show overlay on all pages (CEO bypasses)
    try{
      if (settings && settings.globalMaintenance){
        const ADMIN_EMAIL = 'pantergamey@gmail.com';
        if (!email || String(email).toLowerCase() !== ADMIN_EMAIL){
          showMaintenanceOverlay('El sitio está en modo mantenimiento. Volverá a estar disponible cuando se desactive.');
          return;
        } else {
          console.log('[site-visibility] global maintenance active, CEO logged in — bypassing overlay');
        }
      }
    }catch(e){console.warn('site-visibility: checking globalMaintenance failed', e);}
    // enforce per-page
    Object.keys(PAGES).forEach(k => {
      const cfg = settings.pages && settings.pages[k];
      if (!cfg) return;
      // Determine visibility solely from admin settings:
      // - If allowedEmails is empty => page is public
      // - If allowedEmails contains entries => only those emails (when authenticated) can view
      const emails = (cfg.allowedEmails||[]).map(s=>String(s||'').toLowerCase());
      const isPublic = emails.length === 0;
      const allowed = isPublic || (email && emails.includes(email));
      if (!allowed){
        hideLinksForPage(k);
      }
      // if current page matches and not allowed -> overlay (maintenance shows maintenance message to all)
      if (currentPage === PAGES[k].split('/').pop()){
        if (cfg.maintenance){
          showMaintenanceOverlay('Esta página se encuentra en mantenimiento.');
        } else if (!allowed){
          showMaintenanceOverlay('No tienes acceso a esta página.');
        }
      }
    });
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // If Firebase auth becomes available later, re-run apply when ready or on auth state changes
  try{
    if (window.onAuthStateChanged && window.auth){
      window.onAuthStateChanged(window.auth, (u)=>{ console.log('[site-visibility] auth state changed', u && u.email); apply(); });
    } else {
      document.addEventListener('firebaseReady', ()=>{ console.log('[site-visibility] firebaseReady fired — reapplying visibility'); apply(); if (window.onAuthStateChanged && window.auth){ window.onAuthStateChanged(window.auth, (u)=>{ console.log('[site-visibility] auth state changed (post-ready)', u && u.email); apply(); }); } }, { once:true });
    }
  }catch(e){ console.warn('site-visibility: auth listener setup failed', e); }

})();
