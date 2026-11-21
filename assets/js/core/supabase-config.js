/**
 * supabase-config.js — Compatibilidad con la migración (e4746eb)
 *
 * La capa de datos real vive ahora en `firebase-config.js`, que se carga en
 * TODAS las páginas y expone de forma síncrona la API compatible con Firestore
 * sobre Supabase REST (sin CDN, sin import dinámico y sin carreras de inicio).
 *
 * Este archivo se conserva sólo como referencia histórica. No es cargado por
 * ninguna página y no debe crear un segundo cliente: hacerlo duplicaría los
 * eventos `supabaseReady`/`firebaseReady` y las suscripciones en vivo.
 *
 * Si necesitas comprobar la conexión:
 *     const estado = await window.PanterRules.check({ write: true });
 */
(function () {
    'use strict';
    if (typeof window !== 'undefined' && !window.__psDataLayerReady) {
        console.warn('[Supabase] supabase-config.js ya no inicializa la capa de datos. Carga firebase-config.js antes.');
    }
})();
