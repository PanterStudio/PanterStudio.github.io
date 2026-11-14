/**
 * videos.js — Vídeos de la comunidad con alta manual desde YouTube
 *
 * · Mantiene EXACTAMENTE el mismo reproductor y la misma lista compacta
 *   (.vid-list-item / .vid-list-thumb / ...).
 * · Fundador / CEO, Director, Administrador y Moderador pueden añadir
 *   vídeos pegando un enlace de YouTube y eliminar los existentes.
 * · Firestore `videos` + copia local para que SIEMPRE funcione, con
 *   sincronización en vivo para todos los visitantes.
 */
(function () {
    'use strict';

    const COLLECTION = 'videos';
    const LOCAL_KEY = 'ps_videos_local';
    const MANAGER_ROLES = new Set(['founder_ceo', 'director', 'administrador', 'moderador']);

    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const R = () => window.PanterRoles || null;

    let videos = [];
    let activeIndex = -1;
    let canManage = false;
    let userRole = 'usuario';
    let currentUser = null;
    let videoUnsub = null;
    let booted = false;
    let previousOverflow = '';
    let lastFocused = null;

    // ── YouTube helpers ───────────────────────────────────────
    function getYtId(url) {
        const raw = String(url || '').trim();
        if (!raw) return null;
        // ID suelto de 11 caracteres
        if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
        const m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|v\/|live\/))([A-Za-z0-9_-]{11})/i);
        return m ? m[1] : null;
    }
    function getYtThumb(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
    function buildEmbedUrl(url) {
        const id = getYtId(url);
        if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&color=white`;
        return '';
    }
    function getPlatform(url) {
        if (/youtube|youtu\.be/i.test(url)) return 'youtube';
        if (/tiktok/i.test(url)) return 'tiktok';
        if (/instagram/i.test(url)) return 'ig';
        return 'youtube';
    }
    function platformLabel(p) {
        return ({ youtube: 'YouTube', tiktok: 'TikTok', ig: 'Instagram' })[p] || p;
    }

    // ── Copia local ───────────────────────────────────────────
    function readLocal() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            return Array.isArray(list) ? list.filter(v => v && v.id && v.url) : [];
        } catch (e) { return []; }
    }
    function writeLocal(list) {
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }
    function upsertLocal(record) {
        writeLocal(readLocal().filter(v => v.id !== record.id).concat([record]));
    }
    function removeLocal(id) {
        writeLocal(readLocal().filter(v => v.id !== id));
    }

    // ── Permisos ──────────────────────────────────────────────
    async function computeAccess(user) {
        currentUser = user || null;
        if (!currentUser) { userRole = 'usuario'; canManage = false; updateAdminUI(); return; }

        const lib = R();
        // Fuente ÚNICA compartida de rangos (Panel Admin → Personal).
        const S = window.PanterStaff;
        if (S && typeof S.resolveRoleFor === 'function') {
            userRole = S.resolveRoleFor(currentUser);
            const rankOk = Boolean(lib && typeof lib.rank === 'function'
                && lib.rank(userRole) >= lib.rank('moderador'));
            canManage = MANAGER_ROLES.has(userRole) || rankOk;
            updateAdminUI();
            return;
        }

        const profile = { email: String(currentUser.email || '').trim().toLowerCase() };
        if (window.db && window.getDoc && window.fsDoc) {
            try {
                const snap = await window.getDoc(window.fsDoc(window.db, 'equipo', currentUser.uid));
                if (snap && snap.exists()) {
                    const team = snap.data() || {};
                    if (team.archivado !== true && team.role) profile.teamRole = team.role;
                    if (team.email) profile.email = String(team.email).trim().toLowerCase();
                }
            } catch (e) { /* roster opcional */ }
        }
        userRole = lib ? lib.resolveRole(currentUser, profile) : 'usuario';
        const rankOk = Boolean(lib && typeof lib.rank === 'function'
            && lib.rank(userRole) >= lib.rank('moderador'));
        canManage = MANAGER_ROLES.has(userRole) || rankOk;
        updateAdminUI();
    }

    function updateAdminUI() {
        const bar = $('vidAdminBar');
        if (bar) bar.hidden = !canManage;
        const hint = $('vidAdminHint');
        if (hint) {
            const lib = R();
            hint.textContent = canManage
                ? `Puedes añadir y eliminar vídeos · Rango: ${lib ? lib.get(userRole).label : userRole}`
                : '';
        }
        document.body.classList.toggle('vid-can-manage', canManage);
        renderList();
    }

    // ── Render (idéntico al diseño original) ──────────────────
    function renderList() {
        const list = $('vidList');
        const badge = $('vidCountBadge');
        const emptyState = $('vidEmptyState');
        const layout = $('vidLayout');
        if (!list) return;

        if (badge) badge.textContent = videos.length;
        if (!videos.length) {
            if (layout) layout.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            list.innerHTML = '';
            activeIndex = -1;
            return;
        }
        if (layout) layout.style.display = '';
        if (emptyState) emptyState.style.display = 'none';

        list.innerHTML = '';
        videos.forEach((v, i) => {
            const ytId = getYtId(v.url || '');
            const thumb = v.thumbnail || (ytId ? getYtThumb(ytId) : '');
            const platform = getPlatform(v.url || '');
            const item = document.createElement('div');
            item.className = 'vid-list-item';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
            item.setAttribute('aria-label', `Reproducir: ${v.title || ''}`);
            item.innerHTML = `
                <img class="vid-list-thumb" src="${esc(thumb)}" alt="${esc(v.title || '')}" onerror="this.src='https://i.imgur.com/1IRRyFY.jpeg'">
                <div class="vid-list-info">
                    <div class="vid-list-title">${esc(v.title || '')}</div>
                    <div class="vid-list-channel">${esc(v.channel || '')}</div>
                    <div class="vid-list-dur">${esc(platformLabel(platform))}${v.duration ? ' · ' + esc(v.duration) : ''}</div>
                </div>
                <button type="button" class="vid-list-del" data-vid-del="${esc(v.id)}" title="Eliminar vídeo" aria-label="Eliminar vídeo"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-vid-del]')) return;
                playVideo(i);
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playVideo(i); }
            });
            list.appendChild(item);
        });

        // No reinicia el reproductor si ya hay uno activo (evita saltos al añadir).
        if (activeIndex < 0 || activeIndex >= videos.length) playVideo(0);
        else document.querySelectorAll('.vid-list-item').forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    }

    function playVideo(idx) {
        if (idx < 0 || idx >= videos.length) return;
        activeIndex = idx;
        const v = videos[idx];
        const wrap = $('featuredPlayerWrap');
        const placeholder = $('playerPlaceholder');
        const bar = $('nowPlayingBar');
        if (!wrap) return;

        const embed = buildEmbedUrl(v.url || '');
        const existing = wrap.querySelector('iframe');
        if (existing) existing.remove();
        if (placeholder) placeholder.style.display = embed ? 'none' : '';

        if (embed) {
            const iframe = document.createElement('iframe');
            iframe.src = embed;
            iframe.allowFullscreen = true;
            iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
            iframe.title = v.title || 'Vídeo';
            iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;position:absolute;inset:0;';
            wrap.appendChild(iframe);
        }

        if (bar) {
            bar.innerHTML = `
                <span class="now-playing-dot"></span>
                <div class="now-playing-info">
                    <div class="now-playing-label">Reproduciendo ahora</div>
                    <div class="now-playing-title">${esc(v.title || '')}</div>
                    <div class="now-playing-channel">${esc(v.channel || '')}</div>
                </div>
                ${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0;" title="Abrir en YouTube"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Abrir</a>` : ''}`;
        }
        document.querySelectorAll('.vid-list-item').forEach((el, i) => el.classList.toggle('active', i === idx));
    }

    window.playFirst = function () { if (videos.length) playVideo(0); };

    // ── Carga y sincronización ────────────────────────────────
    function mergeVideos(remote) {
        const map = new Map();
        (Array.isArray(remote) ? remote : []).forEach(v => { if (v && v.id) map.set(v.id, v); });
        readLocal().forEach(v => map.set(v.id, Object.assign({}, map.get(v.id) || {}, v)));
        return Array.from(map.values()).sort((a, b) => {
            const oa = Number(a.orden || 9999);
            const ob = Number(b.orden || 9999);
            if (oa !== ob) return oa - ob;
            return String(b.creadoEn || '').localeCompare(String(a.creadoEn || ''));
        });
    }

    function applyVideos(remote) {
        videos = mergeVideos(remote);
        renderList();
    }

    async function loadVideos() {
        let remote = [];
        try {
            if (window.db && window.collection && window.getDocs) {
                // Sin orderBy: no se pierden documentos sin `orden`.
                const snap = await window.getDocs(window.collection(window.db, COLLECTION));
                remote = snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
            }
        } catch (e) {
            console.warn('[Vídeos] No se pudo leer la nube; se usa la copia local.', e);
        }
        applyVideos(remote);
    }

    function startRealtime() {
        if (videoUnsub || !window.db || !window.collection || typeof window.onSnapshot !== 'function') return;
        try {
            videoUnsub = window.onSnapshot(
                window.collection(window.db, COLLECTION),
                snap => applyVideos(snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}))),
                err => console.warn('[Vídeos] Suscripción no disponible:', err)
            );
            window.addEventListener('pagehide', () => {
                try { videoUnsub && videoUnsub(); } catch (e) { /* noop */ }
                videoUnsub = null;
            }, { once: true });
        } catch (e) {
            console.warn('[Vídeos] No se pudo iniciar la suscripción:', e);
        }
    }

    // ── Añadir / eliminar ─────────────────────────────────────
    function setSaving(state) {
        const btn = $('vidSaveBtn');
        if (!btn) return;
        btn.disabled = state;
        btn.innerHTML = state
            ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Publicando...'
            : '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Publicar vídeo';
    }
    function formMsg(text, tone) {
        const el = $('vidFormMsg');
        if (!el) return;
        el.textContent = text || '';
        el.style.color = tone === 'error' ? '#fca5a5' : '#86efac';
    }

    async function publishVideo(event) {
        event.preventDefault();
        if (!canManage) { formMsg('Tu rango no permite añadir vídeos.', 'error'); return; }

        const rawUrl = String($('vidUrl')?.value || '').trim();
        const ytId = getYtId(rawUrl);
        if (!ytId) { formMsg('Pega un enlace válido de YouTube (o el ID de 11 caracteres).', 'error'); return; }
        const title = String($('vidTitle')?.value || '').trim().slice(0, 120);
        if (!title) { formMsg('Escribe un título.', 'error'); return; }

        const channel = String($('vidChannel')?.value || '').trim().slice(0, 80) || 'Comunidad';
        const duration = String($('vidDuration')?.value || '').trim().slice(0, 20);
        const now = new Date().toISOString();
        const payload = {
            id: `local_${Date.now().toString(36)}`,
            url: `https://www.youtube.com/watch?v=${ytId}`,
            title,
            channel,
            duration,
            thumbnail: getYtThumb(ytId),
            // Orden negativo → el vídeo nuevo aparece al principio de la lista.
            orden: -1 - videos.length,
            creadoEn: now,
            autorNombre: String(currentUser?.displayName || currentUser?.email || 'Equipo').slice(0, 80),
            autorRol: userRole
        };

        formMsg('Publicando...', 'info');
        setSaving(true);
        // 1) Copia local inmediata → aparece al instante con confirmación.
        upsertLocal(payload);
        applyVideos([]);
        formMsg('Vídeo publicado y visible para todos.', 'success');

        // 2) Intento de sincronización (no bloquea si falla).
        try {
            if (window.db && window.collection && window.addDoc) {
                const remote = Object.assign({}, payload);
                delete remote.id;
                const ref = await Promise.race([
                    window.addDoc(window.collection(window.db, COLLECTION), remote),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);
                removeLocal(payload.id);
                upsertLocal(Object.assign({}, payload, { id: ref.id }));
            }
        } catch (e) {
            console.warn('[Vídeos] Guardado en copia local:', e && e.message);
        }

        $('vidForm')?.reset();
        setSaving(false);
        closeModal();
        await loadVideos();
    }

    async function deleteVideo(id) {
        if (!canManage || !id) return;
        if (!window.confirm('¿Eliminar este vídeo de la lista?')) return;
        removeLocal(id);
        videos = videos.filter(v => v.id !== id);
        activeIndex = -1;
        renderList();
        try {
            if (window.db && window.fsDoc && window.deleteDoc && !String(id).startsWith('local_')) {
                await window.deleteDoc(window.fsDoc(window.db, COLLECTION, id));
            }
        } catch (e) {
            console.warn('[Vídeos] No se pudo eliminar de la nube:', e && e.message);
        }
        await loadVideos();
    }

    // ── Modal ─────────────────────────────────────────────────
    function openModal() {
        const modal = $('vidModal');
        if (!modal) return;
        lastFocused = document.activeElement;
        previousOverflow = document.body.style.overflow;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        formMsg('', 'info');
        setTimeout(() => $('vidUrl')?.focus(), 30);
    }
    function closeModal() {
        const modal = $('vidModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousOverflow;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function bindEvents() {
        $('vidAddBtn')?.addEventListener('click', openModal);
        $('vidModalClose')?.addEventListener('click', closeModal);
        $('vidCancelBtn')?.addEventListener('click', closeModal);
        $('vidForm')?.addEventListener('submit', publishVideo);
        $('vidModal')?.addEventListener('click', (e) => { if (e.target === $('vidModal')) closeModal(); });
        $('vidList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-vid-del]');
            if (!btn) return;
            e.preventDefault(); e.stopPropagation();
            deleteVideo(btn.getAttribute('data-vid-del'));
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $('vidModal')?.classList.contains('active')) closeModal();
        });
        document.addEventListener('authStateChanged', (e) => computeAccess(e.detail?.user || null));
        document.addEventListener('panter:staff-changed', () => computeAccess(
            (window.DiscordAuth && window.DiscordAuth.getUser) ? window.DiscordAuth.getUser() : currentUser));
        window.addEventListener('storage', (e) => { if (e.key === LOCAL_KEY) loadVideos(); });
    }

    function boot() {
        if (booted) return;
        booted = true;
        bindEvents();
        const session = window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function'
            ? window.DiscordAuth.getUser() : null;
        computeAccess(session || null);
        loadVideos().then(startRealtime);
    }

    document.addEventListener('firebaseReady', boot);
    function init() {
        renderList();
        boot();
        let attempts = 0;
        const poll = () => {
            if (booted || attempts >= 40) return;
            attempts++;
            boot();
            if (!booted) setTimeout(poll, 250);
        };
        setTimeout(poll, 250);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
