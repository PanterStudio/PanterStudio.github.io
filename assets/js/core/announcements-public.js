/**
 * announcements-public.js — Muestra en la web pública los anuncios creados
 * desde el Panel Admin → Anuncios.
 *
 * Fuentes: Firestore `announcements` + `ps_announcements_cache` (la copia
 * que guarda el panel cuando la nube no está disponible). Se mezclan por
 * id, se deduplican y se ordenan por fecha descendente.
 * Se monta automáticamente en cualquier página que tenga
 * #publicAnnouncements o #comunidadAnnouncements.
 */
(function () {
    'use strict';

    const LS_KEY = 'ps_announcements_cache';
    const TYPE_LABELS = {
        general: 'General',
        general_: 'General',
        update: 'Actualización',
        evento: 'Evento',
        event: 'Evento',
        urgente: 'Urgente',
        alert: 'Urgente',
        maintenance: 'Mantenimiento'
    };
    const TYPE_CLASS = {
        general: 'general', general_: 'general',
        update: 'update',
        evento: 'event', event: 'event',
        urgente: 'alert', alert: 'alert',
        maintenance: 'maintenance'
    };

    function esc(value) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(value == null ? '' : value)));
        return d.innerHTML;
    }
    function readLocal() {
        try {
            const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
            return Array.isArray(list) ? list.filter(a => a && a.id && a.title) : [];
        } catch (e) { return []; }
    }
    function container() {
        return document.getElementById('publicAnnouncements')
            || document.getElementById('comunidadAnnouncements');
    }
    function normalizeType(type) {
        return TYPE_CLASS[String(type || 'general').toLowerCase()] || 'general';
    }
    function typeLabel(type) {
        return TYPE_LABELS[String(type || 'general').toLowerCase()]
            || String(type || 'General');
    }

    let stylesInjected = false;
    function injectStyles() {
        if (stylesInjected || document.getElementById('ps-public-ann-styles')) return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'ps-public-ann-styles';
        style.textContent = `
            #publicAnnouncements.comunidad-announcements-banner { max-width: 1180px; margin: 0 auto 1.5rem; }
            .ann-banner-header h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #f8fafc; display: inline-flex; align-items: center; gap: 9px; }
            .ann-banner-header h3 i { color: #38bdf8; }
            .ann-banner-item { text-align: left; }
            .ann-banner-title, .ann-banner-body { white-space: pre-wrap; word-break: break-word; }
            @media (max-width: 640px) {
                .ann-banner-header { flex-direction: column; align-items: flex-start; gap: 6px; }
            }`;
        document.head.appendChild(style);
    }

    function render(items) {
        const el = container();
        if (!el) return;
        injectStyles();
        el.classList.add('comunidad-announcements-banner');
        if (!items.length) {
            el.style.display = 'none';
            el.innerHTML = '';
            return;
        }
        el.style.display = '';
        const cards = items.slice(0, 6).map(a => {
            const kind = normalizeType(a.type);
            const date = a.createdAt
                ? new Date(a.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
                : '';
            return `
                <article class="ann-banner-item type-${kind}">
                    <span class="ann-banner-badge">${esc(typeLabel(a.type))}</span>
                    <div class="ann-banner-title">${esc(a.title)}</div>
                    <div class="ann-banner-body">${esc(a.body || '')}</div>
                    <div class="ann-banner-meta">${esc(a.createdBy || 'Panter Studio')}${date ? ' · ' + esc(date) : ''}</div>
                </article>`;
        }).join('');

        const here = String(location.pathname || '');
        const onUpdates = /actualizaciones\.html/i.test(here);
        const link = onUpdates ? '' : `
            <a class="ann-banner-view-all" href="pages/actualizaciones.html">Ver novedades <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`;
        el.innerHTML = `
            <div class="ann-banner-header">
                <h3><i class="fa-solid fa-bullhorn" aria-hidden="true"></i> Anuncios de la Comunidad</h3>
                ${link}
            </div>
            <div class="ann-banner-grid">${cards}</div>`;
    }

    function merge(remote) {
        const map = new Map();
        (Array.isArray(remote) ? remote : []).forEach(a => { if (a && a.id) map.set(a.id, a); });
        readLocal().forEach(a => map.set(a.id, Object.assign({}, map.get(a.id) || {}, a)));
        return Array.from(map.values())
            .filter(a => a && a.title)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    async function load() {
        let remote = [];
        try {
            if (window.db && window.collection && window.getDocs) {
                const snap = await Promise.race([
                    window.getDocs(window.collection(window.db, 'announcements')),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
                ]);
                remote = snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
            }
        } catch (e) {
            console.warn('[Anuncios] Lectura de la nube no disponible; se usa la copia local.', e);
        }
        render(merge(remote));
    }

    let unsub = null;
    function startRealtime() {
        if (unsub || !window.db || !window.collection || typeof window.onSnapshot !== 'function') return;
        try {
            unsub = window.onSnapshot(
                window.collection(window.db, 'announcements'),
                snap => render(merge(snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {})))),
                err => console.warn('[Anuncios] Suscripción no disponible:', err)
            );
        } catch (e) { /* noop */ }
    }

    function boot() {
        if (!container()) return;
        render(merge([])); // pinta la copia local de inmediato
        load().then(startRealtime);
        window.addEventListener('storage', (e) => {
            if (e.key === LS_KEY) render(merge([]));
        });
    }

    document.addEventListener('firebaseReady', boot);
    function init() {
        boot();
        let tries = 0;
        const poll = () => {
            if (!container() || tries >= 30) return;
            tries++;
            load();
            if (tries < 30) setTimeout(poll, 400);
        };
        setTimeout(poll, 400);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
