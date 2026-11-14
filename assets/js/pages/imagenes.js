/**
 * imagenes.js — Galería dinámica de Panter Studio
 *
 * · Catálogo base siempre visible (6 capturas oficiales).
 * · Imágenes publicadas por el equipo en Firestore `gallery_images`,
 *   sincronizadas en vivo con onSnapshot para TODOS los visitantes.
 * · Sólo Fundador, Director, Administrador y Moderador pueden publicar
 *   o eliminar. El rango se resuelve con el diccionario global desde
 *   `equipo` / `ps_staff_local` (Panel Admin → Personal).
 * · Acepta enlaces públicos de Imgur y URLs directas de imagen.
 * · Copia local (`ps_gallery_local`) si Firestore rechaza la escritura,
 *   de modo que publicar y eliminar NUNCA bloquea al usuario.
 */
(function () {
    'use strict';

    const COLLECTION = 'gallery_images';
    const LOCAL_KEY = 'ps_gallery_local';
    const MANAGER_ROLES = new Set(['founder_ceo', 'director', 'administrador', 'moderador']);

    const CAT_KEY = 'ps_gallery_categories';
    const HIDDEN_SEEDS_KEY = 'ps_gallery_hidden_seeds';
    // Imágenes de la nube eliminadas localmente: si Firestore aún rechaza
    // el borrado (reglas sin publicar), no reaparecen al re-sincronizar.
    const HIDDEN_REMOTE_KEY = 'ps_gallery_hidden_remote';
    const DEFAULT_CATEGORIES = [
        { id: 'vehiculos', label: 'Vehículos' },
        { id: 'mapas', label: 'Mapas & Carreteras' },
        { id: 'garaje', label: 'Garaje & 3D' },
        { id: 'comunidad', label: 'Comunidad' }
    ];

    function slugify(value) {
        const base = String(value || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return base || `cat_${Date.now().toString(36)}`;
    }
    function readCategories() {
        try {
            const list = JSON.parse(localStorage.getItem(CAT_KEY) || 'null');
            if (Array.isArray(list) && list.length) {
                return list.filter(c => c && c.id && c.label);
            }
        } catch (e) { /* noop */ }
        return DEFAULT_CATEGORIES.slice();
    }
    function writeCategories(list) {
        try { localStorage.setItem(CAT_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }
    function findCategory(id) {
        return readCategories().find(c => c.id === id) || null;
    }
    function categoryLabel(key) {
        const found = findCategory(key);
        return found ? found.label : (findCategory('comunidad')?.label || 'Comunidad');
    }
    function addCategory(label) {
        const clean = String(label || '').trim().slice(0, 40);
        if (!clean) return null;
        const list = readCategories();
        const existing = list.find(c => c.label.toLowerCase() === clean.toLowerCase());
        if (existing) return existing;
        const created = { id: slugify(clean), label: clean };
        list.push(created);
        writeCategories(list);
        return created;
    }
    function removeCategory(id) {
        if (id === 'comunidad') return false;
        writeCategories(readCategories().filter(c => c.id !== id));
        // Las imágenes de esa categoría pasan a Comunidad para no perderse.
        const locals = readLocalImages().map(item =>
            item.categoria === id ? Object.assign({}, item, { categoria: 'comunidad' }) : item
        );
        writeLocalImages(locals);
        if (activeFilter === id) activeFilter = 'all';
        return true;
    }
    function readHiddenSeeds() {
        try {
            const list = JSON.parse(localStorage.getItem(HIDDEN_SEEDS_KEY) || '[]');
            return new Set(Array.isArray(list) ? list.map(String) : []);
        } catch (e) { return new Set(); }
    }
    function hideSeed(id) {
        const set = readHiddenSeeds();
        set.add(String(id));
        try { localStorage.setItem(HIDDEN_SEEDS_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* noop */ }
    }
    function readHiddenRemote() {
        try {
            const list = JSON.parse(localStorage.getItem(HIDDEN_REMOTE_KEY) || '[]');
            return new Set(Array.isArray(list) ? list.map(String) : []);
        } catch (e) { return new Set(); }
    }
    function writeHiddenRemote(set) {
        try { localStorage.setItem(HIDDEN_REMOTE_KEY, JSON.stringify(Array.from(set))); } catch (e) { /* noop */ }
    }
    function hideRemote(id) { const s = readHiddenRemote(); s.add(String(id)); writeHiddenRemote(s); }
    function unhideRemote(id) { const s = readHiddenRemote(); s.delete(String(id)); writeHiddenRemote(s); }

    // Catálogo base: garantiza que la página nunca quede vacía, incluso sin
    // conexión a Firestore. No se persiste en la BD.
    const SEED = [
        {
            id: 'seed-garaje', categoria: 'garaje', badge: 'Garaje & Taller',
            titulo: 'Taller de Personalización',
            descripcion: 'Personaliza suspensión, pintura, luces exploradoras, llantas y motores para rutas de montaña.',
            url: '../recursos/imagenes/garage.png'
        },
        {
            id: 'seed-sprinter', categoria: 'vehiculos', badge: 'Vehículo Express',
            titulo: 'Van Sprinter de Carga',
            descripcion: 'Modelo de alta fidelidad diseñado para misiones de mensajería urgente y paquetería urbana.',
            url: '../recursos/vehiculos/sprinter.png'
        },
        {
            id: 'seed-montana', categoria: 'mapas', badge: 'Rutas & Mapas',
            titulo: 'Carreteras de Montaña',
            descripcion: 'Curvas cerradas, peajes, vegetación tropical y desniveles con físicas auténticas de suspensión.',
            url: '../recursos/imagenes/mapa1.png'
        },
        {
            id: 'seed-fisicas', categoria: 'vehiculos', badge: 'Gameplay 3D',
            titulo: 'Físicas de Carga Pesada',
            descripcion: 'Control de inercia y tracción según el peso de la mercancía transportada en cada entrega.',
            url: '../recursos/imagenes/1.png'
        },
        {
            id: 'seed-clima', categoria: 'mapas', badge: 'Clima Dinámico',
            titulo: 'Ciclo Día / Noche y Lluvia',
            descripcion: 'Iluminación realista con niebla matutina, atardeceres y asfalto mojado en tiempo real.',
            url: '../recursos/imagenes/fondo.jpg'
        },
        {
            id: 'seed-cabina', categoria: 'garaje', badge: 'Interior & Cabina',
            titulo: 'Cabina y Tacómetro Activo',
            descripcion: 'Cámaras en primera persona con tacómetros funcionales, espejos retrovisores y volante interactivo.',
            url: '../recursos/imagenes/hero_banner.png'
        }
    ];

    const $ = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const roles = () => window.PanterRoles || null;

    // Copia local: si Firestore rechaza la escritura (reglas aún no
    // publicadas), la imagen se muestra igual y se sincroniza después.
    function readLocalImages() {
        try {
            const list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            return Array.isArray(list) ? list.filter(item => item && item.id && item.url) : [];
        } catch (e) { return []; }
    }
    function writeLocalImages(list) {
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }
    function upsertLocalImage(record) {
        const list = readLocalImages().filter(item => item.id !== record.id);
        list.push(record);
        writeLocalImages(list);
    }
    function removeLocalImage(id) {
        writeLocalImages(readLocalImages().filter(item => item.id !== id));
    }

    let currentUser = null;
    let userRole = 'usuario';
    let canManage = false;
    let published = [];
    let activeFilter = 'all';
    let galleryUnsub = null;
    let booted = false;
    let previousOverflow = '';
    let lastFocused = null;
    let toastTimer = null;

    // ── Permisos ───────────────────────────────────────────────
    let accessSeq = 0;

    function isManagerRole(role) {
        const R = roles();
        const rankOk = Boolean(R && typeof R.rank === 'function'
            && R.rank(role) >= R.rank('moderador'));
        return MANAGER_ROLES.has(role) || rankOk;
    }

    function applyAccess(role) {
        userRole = role;
        canManage = isManagerRole(role);
        updateAdminUI();
        render();
    }

    async function computeAccess(user) {
        const seq = ++accessSeq;
        currentUser = user || null;
        const R = roles();

        if (!currentUser) { applyAccess('usuario'); return; }

        // Fuente ÚNICA compartida (login + `equipo` + `ps_staff_local`):
        // un cambio de rango en Personal habilita o retira los controles
        // de la galería al instante, igual que en foro, soporte y vídeos.
        const S = window.PanterStaff;
        if (S && typeof S.resolveRoleFor === 'function') {
            applyAccess(S.resolveRoleFor(currentUser));
            return;
        }

        const profile = { email: String(currentUser.email || '').trim().toLowerCase() };
        // Resolución inmediata mientras se refina con `equipo`.
        applyAccess(R ? R.resolveRole(currentUser, profile) : 'usuario');

        // Después se refina con el rango manual de `equipo` (Personal).
        if (window.db && window.getDoc && window.fsDoc) {
            try {
                const snap = await window.getDoc(window.fsDoc(window.db, 'equipo', currentUser.uid));
                if (seq !== accessSeq) return; // cambió la sesión mientras leíamos
                if (snap && snap.exists()) {
                    const team = snap.data() || {};
                    if (team.archivado !== true && team.role) profile.teamRole = team.role;
                    if (team.email) profile.email = String(team.email).trim().toLowerCase();
                }
                applyAccess(R ? R.resolveRole(currentUser, profile) : 'usuario');
            } catch (e) { /* roster opcional */ }
        }
    }

    function updateAdminUI() {
        const bar = $('galleryAdminBar');
        const hint = $('galleryAdminHint');
        if (bar) bar.hidden = !canManage;
        if (hint) {
            hint.textContent = canManage
                ? `Puedes publicar y eliminar imágenes · Rango: ${(roles() && roles().get(userRole).label) || userRole}`
                : '';
        }
        const grid = $('galleryGrid');
        if (grid) grid.dataset.canManage = canManage ? 'true' : 'false';
        document.body.classList.toggle('gallery-can-manage', canManage);
    }

    // ── Normalización de enlaces Imgur / URLs directas ─────────
    function normalizeImageUrl(raw) {
        let url = String(raw || '').trim();
        if (!url) return { ok: false, error: 'Pega un enlace de imagen.' };

        // Rutas internas del catálogo base.
        if (/^(\.\.?\/|\/)/.test(url)) return { ok: true, url: url };

        if (!/^https?:\/\//i.test(url)) {
            return { ok: false, error: 'El enlace debe empezar por https://' };
        }

        // Página individual de Imgur → imagen directa.
        const page = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,12})\/?(?:[?#].*)?$/i);
        if (page) {
            return { ok: true, url: `https://i.imgur.com/${page[1]}.jpg`, imgur: true };
        }
        // Álbumes / galerías no se pueden incrustar sin la API de Imgur.
        if (/^https?:\/\/(?:www\.)?imgur\.com\/(?:a|gallery|t)\//i.test(url)) {
            return {
                ok: false,
                error: 'Los álbumes de Imgur no se pueden incrustar. Abre la imagen y copia el enlace i.imgur.com/...'
            };
        }
        return { ok: true, url: url };
    }

    // Imgur no siempre sirve .jpg: se prueban extensiones alternativas.
    function attachImageFallback(img, url) {
        if (!img || !/^https?:\/\/i\.imgur\.com\//i.test(url)) return;
        const base = url.replace(/\.(jpe?g|png|gif|webp)(\?.*)?$/i, '');
        const candidates = [url, `${base}.png`, `${base}.jpeg`, `${base}.webp`, `${base}.gif`];
        let attempt = 0;
        img.addEventListener('error', () => {
            attempt += 1;
            if (attempt < candidates.length) img.src = candidates[attempt];
            else img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="#0a0d14"/><text x="50%" y="50%" fill="#64748b" font-family="sans-serif" font-size="18" text-anchor="middle">Imagen no disponible</text></svg>'
            );
        });
    }

    // ── Render ─────────────────────────────────────────────────
    function buildCard(item) {
        const R = roles();
        const card = document.createElement('article');
        card.className = 'gallery-card';
        card.dataset.category = item.categoria || 'comunidad';
        card.dataset.imageId = item.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Ver ${item.titulo}`);

        const badgeText = item.badge || categoryLabel(item.categoria);
        const authorBadge = item._dynamic && R
            ? R.badgeHtml(R.normalize(item.autorRol || 'usuario'))
            : '';
        const authorLine = item._dynamic
            ? `<div class="gallery-card-author">${escapeHtml(item.autorNombre || 'Equipo')} ${authorBadge}</div>`
            : '';
        // Todas las imágenes se pueden eliminar, también las del catálogo base.
        const deleteBtn = canManage
            ? `<button type="button" class="gallery-delete-btn" data-delete-id="${escapeHtml(item.id)}" aria-label="Eliminar ${escapeHtml(item.titulo)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`
            : '';

        card.innerHTML = `
            <div class="gallery-thumb-wrap">
                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.titulo)}" class="gallery-thumb-img" loading="lazy" decoding="async">
                <span class="gallery-category-badge">${escapeHtml(badgeText)}</span>
                ${deleteBtn}
            </div>
            <div class="gallery-card-body">
                <h3 class="gallery-card-title">${escapeHtml(item.titulo)}</h3>
                <p class="gallery-card-desc">${escapeHtml(item.descripcion || '')}</p>
                ${authorLine}
            </div>`;

        const img = card.querySelector('.gallery-thumb-img');
        attachImageFallback(img, item.url);

        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-delete-id]')) return;
            openLightbox(item);
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item); }
        });
        return card;
    }

    function renderFilters() {
        const container = $('galleryFilters');
        if (!container) return;
        const categories = readCategories();
        const html = [
            `<button type="button" class="gallery-filter-btn${activeFilter === 'all' ? ' active' : ''}" data-filter="all" role="tab" aria-selected="${activeFilter === 'all'}">Todas las Imágenes</button>`
        ].concat(categories.map(cat => `
            <span class="gallery-filter-wrap">
                <button type="button" class="gallery-filter-btn${activeFilter === cat.id ? ' active' : ''}" data-filter="${escapeHtml(cat.id)}" role="tab" aria-selected="${activeFilter === cat.id}">${escapeHtml(cat.label)}</button>
                <button type="button" class="gallery-filter-remove" data-cat-remove="${escapeHtml(cat.id)}" title="Eliminar categoría" aria-label="Eliminar categoría ${escapeHtml(cat.label)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </span>`)).join('');
        container.innerHTML = html;
    }

    function populateCategorySelect() {
        const select = $('galleryCategory');
        if (!select) return;
        const previous = select.value;
        select.innerHTML = readCategories()
            .map(cat => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</option>`).join('');
        if (previous && findCategory(previous)) select.value = previous;
    }

    function render() {
        const grid = $('galleryGrid');
        if (!grid) return;

        const hiddenRemote = readHiddenRemote();
        const dynamic = published.concat(readLocalImages())
            .filter(doc => !hiddenRemote.has(String(doc.id)))
            .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')))
            .map(doc => Object.assign({}, doc, { _dynamic: true }));
        const hiddenSeeds = readHiddenSeeds();
        const seeds = SEED.filter(item => !hiddenSeeds.has(String(item.id)));
        const all = dynamic.concat(seeds);
        const visible = activeFilter === 'all'
            ? all
            : all.filter(item => item.categoria === activeFilter);

        grid.innerHTML = '';
        visible.forEach(item => grid.appendChild(buildCard(item)));

        renderFilters();
        populateCategorySelect();

        const status = $('galleryStatus');
        if (status) {
            const count = dynamic.length;
            status.textContent = count
                ? `${all.length} imágenes · ${count} publicadas por el equipo`
                : `${all.length} imágenes del catálogo oficial`;
        }
        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'gallery-empty';
            empty.innerHTML = '<i class="fa-regular fa-image" aria-hidden="true"></i><p>No hay imágenes en esta categoría todavía.</p>';
            grid.appendChild(empty);
        }
    }

    // ── Firestore en tiempo real ───────────────────────────────
    function waitForFirebase(timeout = 8000) {
        return new Promise((resolve) => {
            const ready = () => Boolean(window.db && window.collection
                && window.addDoc && window.deleteDoc && window.onSnapshot);
            if (ready()) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (ready()) { clearInterval(timer); resolve(true); }
                else if (Date.now() - start >= timeout) { clearInterval(timer); resolve(false); }
            }, 120);
        });
    }

    async function startLiveFeed() {
        const ok = await waitForFirebase();
        if (!ok) { setOfflineNotice(); return; }
        if (galleryUnsub) { try { galleryUnsub(); } catch (e) {} }
        try {
            // Sin orderBy: evita índices compuestos y no descarta documentos
            // antiguos que no tuvieran `creadoEn`.
            galleryUnsub = window.onSnapshot(
                window.collection(window.db, COLLECTION),
                snap => {
                    published = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
                    clearOfflineNotice();
                    render();
                },
                err => {
                    console.warn('[Galería] No se pudo sincronizar en vivo:', err);
                    setOfflineNotice();
                    render();
                }
            );
        } catch (err) {
            console.warn('[Galería] Suscripción no disponible:', err);
            setOfflineNotice();
        }
    }

    function setOfflineNotice() {
        const el = $('galleryStatus');
        if (el) el.textContent = 'Catálogo oficial · mostrando también las imágenes guardadas en este navegador';
    }
    function clearOfflineNotice() { /* render() ya actualiza el contador */ }

    // ── Publicar / eliminar ────────────────────────────────────
    function setSaving(state) {
        const btn = $('gallerySaveBtn');
        if (!btn) return;
        btn.disabled = state;
        btn.innerHTML = state
            ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Publicando...'
            : '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Publicar imagen';
    }

    function fieldError(message) {
        const el = $('galleryFormMsg');
        if (!el) return;
        el.textContent = message || '';
        el.style.color = message ? '#f87171' : '#4ade80';
    }

    async function publishImage(event) {
        event.preventDefault();
        if (!canManage) { toast('No tienes permisos para publicar.', 'error'); return; }

        const norm = normalizeImageUrl($('galleryUrl')?.value);
        if (!norm.ok) { fieldError(norm.error); return; }

        const titulo = String($('galleryTitle')?.value || '').trim().slice(0, 90);
        if (!titulo) { fieldError('Escribe un título.'); return; }

        const categoria = String($('galleryCategory')?.value || 'comunidad');
        const catDef = findCategory(categoria) || findCategory('comunidad');
        const descripcion = String($('galleryDesc')?.value || '').trim().slice(0, 400);
        const now = new Date().toISOString();
        const R = roles();

        const payload = {
            titulo: titulo,
            descripcion: descripcion,
            categoria: catDef ? catDef.id : 'comunidad',
            badge: catDef ? catDef.label : categoryLabel(categoria),
            url: norm.url,
            autorNombre: String(currentUser.displayName || currentUser.username || currentUser.email || 'Equipo').slice(0, 80),
            autorEmail: String(currentUser.email || '').trim().toLowerCase(),
            autorUid: String(currentUser.uid || ''),
            autorRol: R ? R.normalize(userRole) : userRole,
            creadoEn: now,
            actualizadoEn: now
        };

        fieldError('');
        setSaving(true);
        try {
            if (!window.db || !window.addDoc || !window.collection) {
                throw new Error('Firestore no disponible');
            }
            await window.addDoc(window.collection(window.db, COLLECTION), payload);
            closeAdminModal();
            toast('Imagen publicada. Ya es visible para todos.', 'success');
        } catch (err) {
            // Respaldo local: la imagen aparece de inmediato aunque las reglas
            // de Firestore aún no estén publicadas. Nunca bloquea al usuario.
            upsertLocalImage(Object.assign({ id: `local_${Date.now().toString(36)}` }, payload));
            render();
            closeAdminModal();
            toast('Imagen publicada (guardada en este navegador).', 'success');
            console.warn('[Galería] Publicación en copia local:', err && err.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteImage(id) {
        if (!canManage || !id) return;
        if (!window.confirm('¿Eliminar esta imagen de la galería?')) return;
        const key = String(id);
        const isSeed = key.startsWith('seed-');
        const isLocal = key.startsWith('local_');

        if (isSeed) {
            // Las imágenes del catálogo base se ocultan de forma persistente.
            hideSeed(key);
            render();
            toast('Imagen eliminada.', 'success');
            return;
        }

        // Intento en la nube (no bloquea el borrado local si falla).
        if (!isLocal && window.db && window.fsDoc && window.deleteDoc) {
            try {
                await window.deleteDoc(window.fsDoc(window.db, COLLECTION, key));
                unhideRemote(key);
            } catch (err) {
                // Si las reglas aún no permiten borrar, se oculta en este
                // navegador para que NO reaparezca en la siguiente sync.
                hideRemote(key);
                console.warn('[Galería] Borrado aplicado en copia local:', err && err.message);
            }
        }
        removeLocalImage(key);
        published = published.filter(item => item.id !== key);
        render();
        toast('Imagen eliminada.', 'success');
    }

    // ── Modales / lightbox ─────────────────────────────────────
    function openAdminModal() {
        const modal = $('galleryAdminModal');
        if (!modal) return;
        lastFocused = document.activeElement;
        previousOverflow = document.body.style.overflow;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        fieldError('');
        setTimeout(() => $('galleryUrl')?.focus(), 30);
    }

    function closeAdminModal() {
        const modal = $('galleryAdminModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousOverflow;
        const form = $('galleryForm');
        if (form) form.reset();
        fieldError('');
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function openLightbox(item) {
        const modal = $('lightboxModal');
        if (!modal || !item) return;
        lastFocused = document.activeElement;
        previousOverflow = document.body.style.overflow;
        const img = $('lightboxImg');
        if (img) {
            img.src = item.url;
            img.alt = item.titulo;
            attachImageFallback(img, item.url);
        }
        $('lightboxTitle').textContent = item.titulo;
        $('lightboxDesc').textContent = item.descripcion || '';
        $('lightboxBadge').textContent = item.badge || categoryLabel(item.categoria);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        $('lightboxCloseBtn')?.focus();
    }

    function closeLightbox() {
        const modal = $('lightboxModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousOverflow;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function toast(message, type) {
        const el = $('galleryToast');
        if (!el) return;
        el.textContent = message;
        el.className = `toast-notice ${type === 'error' ? 'is-error' : ''}`;
        el.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
    }

    // ── Eventos ────────────────────────────────────────────────
    function bindEvents() {
        // Filtros generados dinámicamente + borrado de categorías propias.
        $('galleryFilters')?.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-cat-remove]');
            if (removeBtn) {
                const id = removeBtn.getAttribute('data-cat-remove');
                if (!canManage) { toast('Tu rango no permite eliminar categorías.', 'error'); return; }
                if (!window.confirm('¿Eliminar esta categoría? Sus imágenes pasarán a Comunidad.')) return;
                if (removeCategory(id)) { render(); toast('Categoría eliminada.', 'success'); }
                return;
            }
            const btn = event.target.closest('[data-filter]');
            if (!btn) return;
            activeFilter = btn.dataset.filter || 'all';
            render();
        });

        $('galleryAddCategoryBtn')?.addEventListener('click', () => {
            const input = $('galleryNewCategory');
            const created = addCategory(input?.value);
            if (!created) { fieldError('Escribe un nombre para la categoría.'); return; }
            if (input) input.value = '';
            populateCategorySelect();
            const select = $('galleryCategory');
            if (select) select.value = created.id;
            renderFilters();
            fieldError('');
            toast(`Categoría "${created.label}" creada.`, 'success');
        });

        $('galleryAddBtn')?.addEventListener('click', openAdminModal);
        $('galleryAdminClose')?.addEventListener('click', closeAdminModal);
        $('galleryCancelBtn')?.addEventListener('click', closeAdminModal);
        $('galleryForm')?.addEventListener('submit', publishImage);

        $('galleryAdminModal')?.addEventListener('click', (e) => {
            if (e.target === $('galleryAdminModal')) closeAdminModal();
        });

        $('galleryGrid')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-delete-id]');
            if (btn) { e.preventDefault(); e.stopPropagation(); deleteImage(btn.dataset.deleteId); }
        });

        $('lightboxCloseBtn')?.addEventListener('click', closeLightbox);
        $('lightboxModal')?.addEventListener('click', (e) => {
            if (e.target === $('lightboxModal')) closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if ($('galleryAdminModal')?.classList.contains('active')) closeAdminModal();
            else if ($('lightboxModal')?.classList.contains('active')) closeLightbox();
        });

        // Sesión unificada: una sola fuente, válida para Discord OAuth y
        // para Firebase Auth (adoptFirebaseUser dispara este mismo evento).
        document.addEventListener('authStateChanged', (e) => {
            computeAccess(e.detail?.user || null);
        });
        // Repinta los permisos cuando cambia un rango en el panel.
        document.addEventListener('panter:staff-changed', () => {
            computeAccess((window.DiscordAuth && window.DiscordAuth.getUser) ? window.DiscordAuth.getUser() : currentUser);
        });
        window.addEventListener('storage', (e) => {
            if (e.key === LOCAL_KEY) render();
        });
    }

    /* Local-first: la galería, sus permisos y la publicación/eliminación
       funcionan SIEMPRE (copia en `ps_gallery_local`). La nube se engancha
       cuando el SDK está listo, sin bloquear ni ocultar controles. */
    let localBooted = false;

    function bootLocal() {
        if (localBooted) return;
        localBooted = true;
        bindEvents();
        render();
        const session = window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function'
            ? window.DiscordAuth.getUser()
            : null;
        computeAccess(session || null);
    }

    function bootCloud() {
        if (booted) return;
        if (!window.db || !window.collection) return;
        booted = true;
        startLiveFeed();
    }

    function boot() {
        bootLocal();
        bootCloud();
    }

    // `firebaseReady` puede dispararse antes o después de este script.
    document.addEventListener('firebaseReady', boot);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bootLocal();
            bootCloud();
            const poll = (n = 0) => {
                if (!booted && n < 40) { bootCloud(); setTimeout(() => poll(n + 1), 250); }
            };
            poll();
        }, { once: true });
    } else {
        bootLocal();
        bootCloud();
    }
})();
