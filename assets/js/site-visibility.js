// site-visibility.js
// Controls runtime visibility of site sections/pages based on admin settings.
(function(){
  'use strict';
  console.log('[site-visibility] init');
  // Re-enabled site visibility checks
  const SITE_VISIBILITY_DISABLED = false;
  const PAGES = {
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
    return '';
  }

  // Real-time listener for site settings
  let activeListener = null;

  function subscribeToSettings(onUpdate) {
    if (activeListener) return;
    try {
      if (window.db && window.fsDoc && window.onSnapshot) {
        const docRef = window.fsDoc(window.db, 'admin', 'siteVisibility');
        activeListener = window.onSnapshot(docRef, (doc) => {
          if (doc && doc.exists()) {
            const data = doc.data() || {};
            saveLocal(data);
            onUpdate(Object.assign({}, DEFAULT, data));
          } else {
            onUpdate(DEFAULT);
          }
        }, (err) => {
          console.warn('Realtime visibility settings error:', err);
        });
      }
    } catch(e) {
      console.warn('Could not subscribe to visibility settings:', e);
    }
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
    o.style.background='radial-gradient(circle at center, rgba(20, 10, 10, 0.97) 0%, rgba(6, 4, 4, 0.99) 100%)';
    o.style.backdropFilter='blur(16px)';
    o.style.padding='24px';
    
    const card = document.createElement('div');
    card.style.background='rgba(24, 16, 16, 0.8)';
    card.style.border='2px solid rgba(239, 68, 68, 0.4)';
    card.style.boxShadow='0 0 50px rgba(239, 68, 68, 0.2), inset 0 0 25px rgba(239, 68, 68, 0.05)';
    card.style.padding='50px 40px';
    card.style.borderRadius='32px';
    card.style.color='#f3f4f6';
    card.style.maxWidth='480px';
    card.style.width='100%';
    card.style.textAlign='center';
    card.style.backdropFilter='blur(12px)';
    card.style.position='relative';
    card.style.overflow='hidden';
    card.style.animation='overlayPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards, borderGlow 4s infinite ease-in-out';

    // Inject custom animation styles in head
    if (!document.getElementById('maintOverlayStyle')) {
      const s = document.createElement('style');
      s.id = 'maintOverlayStyle';
      s.textContent = `
        @keyframes overlayPop {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes warningPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.6)); transform: translateY(0) scale(1); }
          50% { filter: drop-shadow(0 0 25px rgba(251, 191, 36, 0.9)); transform: translateY(-6px) scale(1.06); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(239, 68, 68, 0.45); box-shadow: 0 0 40px rgba(239, 68, 68, 0.25), inset 0 0 20px rgba(239, 68, 68, 0.05); }
          50% { border-color: rgba(251, 191, 36, 0.6); box-shadow: 0 0 50px rgba(251, 191, 36, 0.35), inset 0 0 25px rgba(251, 191, 36, 0.1); }
        }
      `;
      document.head.appendChild(s);
    }

    const siteRoot = (document.body && document.body.dataset && document.body.dataset.siteRoot) ? document.body.dataset.siteRoot : '';
    const homeHref = siteRoot ? siteRoot.replace(/\/$/, '') + '/index.html' : 'index.html';

    // Text cleaned of any accents (tildes)
    const cleanedMessage = (message || 'Esta seccion del portal oficial de Panter Studio se encuentra bajo mantenimiento programado.')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents dynamically just in case

    card.innerHTML = `
      <div style="font-size: 4.5rem; margin-bottom: 25px; animation: warningPulse 3s infinite ease-in-out; display: inline-block;">⚠️</div>
      <h2 style="margin: 0 0 15px 0; font-family: 'Outfit', sans-serif; font-size: 1.8rem; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(120deg, #ef4444, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Acceso Restringido</h2>
      <p style="opacity: 0.9; font-size: 1rem; line-height: 1.6; margin-bottom: 35px; color: #e5e7eb; font-family: 'Inter', sans-serif;">${cleanedMessage}</p>
      <div>
        <a id="mvHomeBtn" href="${homeHref}" style="display: inline-block; background: linear-gradient(135deg, #ef4444, #f59e0b); color: #ffffff; font-weight: 800; font-family: 'Outfit', sans-serif; font-size: 0.9rem; letter-spacing: 0.5px; padding: 12px 32px; border-radius: 100px; text-decoration: none; box-shadow: 0 8px 25px rgba(239, 68, 68, 0.35); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);">Volver al Inicio</a>
      </div>
    `;

    o.appendChild(card);
    document.body.appendChild(o);

    // Button interactions
    try {
      const btn = card.querySelector('#mvHomeBtn');
      if (btn) {
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'translateY(-3px) scale(1.03)';
          btn.style.boxShadow = '0 12px 30px rgba(251, 191, 36, 0.5)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'translateY(0) scale(1)';
          btn.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.35)';
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = homeHref;
        });
      }
    } catch(e){}
  }

  function removeMaintenanceOverlay() {
    const el = document.getElementById('siteMaintenanceOverlay');
    if (el) el.remove();
  }

  function enforceVisibilityRules(settings) {
    if (SITE_VISIBILITY_DISABLED) return;
    try { if (localStorage.getItem('siteVisibilityForceAll') === 'true') return; } catch(e){}

    const email = getCurrentEmail();
    const currentPage = (window.location.pathname||'').split('/').pop() || '';
    
    // Global maintenance checks
    if (settings && settings.globalMaintenance) {
      const ADMIN_EMAIL = 'pantergamey@gmail.com';
      if (!email || String(email).toLowerCase() !== ADMIN_EMAIL) {
        showMaintenanceOverlay('El sitio esta en modo mantenimiento. Volvera a estar disponible cuando se desactive.');
        return;
      } else {
        console.log('[site-visibility] CEO logged in — bypassing global maintenance');
        removeMaintenanceOverlay();
      }
    } else {
      // Clear global maintenance if disabled
      if (settings && !settings.globalMaintenance) {
        removeMaintenanceOverlay();
      }
    }

    // Page-specific checks
    let hasBlockedPage = false;
    Object.keys(PAGES).forEach(k => {
      const cfg = settings.pages && settings.pages[k];
      if (!cfg) return;

      const emails = (cfg.allowedEmails||[]).map(s=>String(s||'').toLowerCase());
      const isPublic = emails.length === 0;
      const allowed = isPublic || (email && emails.includes(email));

      if (!allowed) {
        hideLinksForPage(k);
      }

      if (currentPage === PAGES[k].split('/').pop()) {
        if (cfg.maintenance) {
          showMaintenanceOverlay('Esta pagina se encuentra en mantenimiento.');
          hasBlockedPage = true;
        } else if (!allowed) {
          showMaintenanceOverlay('No tienes acceso a esta pagina.');
          hasBlockedPage = true;
        }
      }
    });

    if (!hasBlockedPage && (!settings || !settings.globalMaintenance)) {
      removeMaintenanceOverlay();
    }
  }

  function apply() {
    // Try rendering with local cache settings immediately
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) {
        enforceVisibilityRules(JSON.parse(cached));
      }
    } catch(e){}

    // Subscribe to live Firestore updates
    if (window.db && window.fsDoc && window.onSnapshot) {
      subscribeToSettings((freshSettings) => {
        enforceVisibilityRules(freshSettings);
      });
    }
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // Re-run apply on Firebase status and auth changes
  try {
    if (window.onAuthStateChanged && window.auth) {
      window.onAuthStateChanged(window.auth, (u) => {
        apply();
      });
    } else {
      document.addEventListener('firebaseReady', () => {
        apply();
        if (window.onAuthStateChanged && window.auth) {
          window.onAuthStateChanged(window.auth, (u) => {
            apply();
          });
        }
      }, { once: true });
    }
  } catch(e) {
    console.warn('site-visibility: auth listener setup failed', e);
  }

})();
