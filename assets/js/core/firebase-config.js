// Puente de compatibilidad hacia Supabase (Firebase/Firestore eliminado)
// Todas las páginas que cargan firebase-config.js inician automáticamente Supabase.
(function () {
  'use strict';
  if (window.__supabaseConfigLoaded) return;
  window.__supabaseConfigLoaded = true;

  const baseSrc = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src
    : `${window.location.origin}/assets/js/core/firebase-config.js`;
  const targetUrl = new URL('supabase-config.js', baseSrc).href;

  import(targetUrl).catch((err) => {
    console.error('[Supabase] No se pudo cargar supabase-config.js:', err);
  });
})();
