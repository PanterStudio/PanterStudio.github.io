/**
 * vehiculos.js — Catálogo de vehículos conectado (Wiki + Panel Admin)
 *
 * · Fotos por enlace Imgur o URL directa.
 * · Nombre, descripción y CATEGORÍA manual (tú creas las categorías).
 * · Filtro por categoría generado dinámicamente.
 * · Se pueden eliminar TODOS los vehículos, incluidos los del catálogo base.
 * · Firestore `vehiculos` + copia local compartida → la Wiki y el panel
 *   admin ven exactamente los mismos datos, al instante.
 */
(function () {
    'use strict';

    const COLLECTION = 'vehiculos';
    const LOCAL_KEY = 'ps_vehiculos_local';
    const CAT_KEY = 'ps_vehiculos_categorias';
    const HIDDEN_SEEDS_KEY = 'ps_vehiculos_hidden_seeds';
    const HIDDEN_KEY = 'ps_vehiculos_hidden';
    const MANAGER_ROLES = new Set(['founder_ceo', 'director', 'administrador', 'moderador']);

    const DEFAULT_CATEGORIES = [
        { id: 'carga', label: 'Carga / Van' },
        { id: 'camiones', label: 'Camiones' },
        { id: 'motos', label: 'Motos' },
        { id: 'otros', label: 'Otros' }
    ];

    const SEED = [{
        id: 'seed-sprinter',
        nombre: 'Sprinter Van',
        categoria: 'carga',
        badge: 'Carga / Van',
        descripcion: 'Vehículo de carga tipo van usado específicamente en el trabajo de Mensajero. Ofrece excelente capacidad para almacenar paquetes y cajas, y una velocidad óptima para repartos rápidos.',
        url: '../../recursos/vehiculos/sprinter.png'
    }];

    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const R = () => window.PanterRoles || null;

    let items = [];
    let activeCategory = 'all';
    let canManage = false;
    let userRole = 'usuario';
    let currentUser = null;
    let unsub = null;
    let previousOverflow = '';
    let lastFocused = null;

    // ── Almacenamiento compartido ──────────────────────────────
    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value == null ? fallback : value;
        } catch (e) { return fallback; }
    }
    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* noop */ }
    }
    function slugify(value) {
        const base = String(value || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return base || `cat_${Date.now().toString(36)}`;
    }
    function readCategories() {
        const list = readJson(CAT_KEY, null);
        return Array.isArray(list) && list.length
            ? list.filter(c => c && c.id && c.label)
            : DEFAULT_CATEGORIES.slice();
    }
    function writeCategories(list) { writeJson(CAT_KEY, list); }
    function findCategory(id) { return readCategories().find(c => c.id === id) || null; }
    function categoryLabel(id) {
        const found = findCategory(id);
        return found ? found.label : (findCategory('otros')?.label || 'Otros');
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
        if (id === 'otros') return false;
        writeCategories(readCategories().filter(c => c.id !== id));
        writeJson(LOCAL_KEY, readLocal().map(item =>
            item.categoria === id ? Object.assign({}, item, { categoria: 'otros' }) : item
        ));
        if (activeCategory === id) activeCategory = 'all';
        return true;
    }
    function readLocal() {
        const list = readJson(LOCAL_KEY, []);
        return Array.isArray(list) ? list.filter(v => v && v.id && v.url) : [];
    }
    function writeLocal(list) { writeJson(LOCAL_KEY, list); }
    function upsertLocal(record) {
        writeLocal(readLocal().filter(v => v.id !== record.id).concat([record]));
    }
    function removeLocal(id) { writeLocal(readLocal().filter(v => v.id !== id)); }
    function readHiddenSeeds() {
        const list = readJson(HIDDEN_SEEDS_KEY, []);
        return new Set(Array.isArray(list) ? list.map(String) : []);
    }
    function hideSeed(id) {
        const set = readHiddenSeeds();
        set.add(String(id));
        writeJson(HIDDEN_SEEDS_KEY, Array.from(set));
    }
    function readHidden() {
        const list = readJson(HIDDEN_KEY, []);
        return new Set(Array.isArray(list) ? list.map(String) : []);
    }
    function hideItem(id) {
        const set = readHidden();
        set.add(String(id));
        writeJson(HIDDEN_KEY, Array.from(set));
    }

    // ── Imgur / URL directa ────────────────────────────────────
    function normalizeImageUrl(raw) {
        let url = String(raw || '').trim();
        if (!url) return { ok: false, error: 'Pega un enlace de imagen.' };
        if (/^(\.\.?\/|\/)/.test(url)) return { ok: true, url };
        if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'El enlace debe empezar por https://' };
        const page = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,12})\/?(?:[?#].*)?$/i);
        if (page) return { ok: true, url: `https://i.imgur.com/${page[1]}.jpg`, imgur: true };
        if (/^https?:\/\/(?:www\.)?imgur\.com\/(?:a|gallery|t)\//i.test(url)) {
            return { ok: false, error: 'Usa el enlace directo i.imgur.com/... (no álbumes).' };
        }
        return { ok: true, url };
    }
    function attachImageFallback(img, url) {
        if (!img || !/^https?:\/\/i\.imgur\.com\//i.test(url)) return;
        const base = url.replace(/\.(jpe?g|png|gif|webp)(\?.*)?$/i, '');
        const candidates = [url, `${base}.png`, `${base}.jpeg`, `${base}.webp`];
        let attempt = 0;
        img.addEventListener('error', () => {
            attempt += 1;
            if (attempt < candidates.length) img.src = candidates[attempt];
        });
    }

    // ── Permisos ───────────────────────────────────────────────
    async function computeAccess(user) {
        currentUser = user || null;
        if (!currentUser) { userRole = 'usuario'; canManage = false; updateAdminUI(); return; }
        const lib = R();
        const profile = { email: String(currentUser.email || '').trim().toLowerCase() };
        userRole = lib ? lib.resolveRole(currentUser, profile) : 'usuario';
        const rankOk = Boolean(lib && typeof lib.rank === 'function'
            && lib.rank(userRole) >= lib.rank('moderador'));
        canManage = MANAGER_ROLES.has(userRole) || rankOk;
        if (window.db && window.getDoc && window.fsDoc) {
            try {
                const snap = await window.getDoc(window.fsDoc(window.db, 'equipo', currentUser.uid));
                if (snap && snap.exists()) {
                    const team = snap.data() || {};
                    if (team.archivado !== true && team.role) profile.teamRole = team.role;
                    if (team.email) profile.email = String(team.email).trim().toLowerCase();
                    userRole = lib ? lib.resolveRole(currentUser, profile) : 'usuario';
                    canManage = MANAGER_ROLES.has(userRole) || Boolean(lib && lib.rank(userRole) >= lib.rank('moderador'));
                }
            } catch (e) { /* roster opcional */ }
        }
        updateAdminUI();
    }
    function updateAdminUI() {
        const bar = $('vehAdminBar');
        if (bar) bar.hidden = !canManage;
        const hint = $('vehAdminHint');
        if (hint) {
            const lib = R();
            hint.textContent = canManage
                ? `Puedes añadir y eliminar vehículos · Rango: ${lib ? lib.get(userRole).label : userRole}`
                : '';
        }
        document.body.classList.toggle('veh-can-manage', canManage);
        renderAll();
    }

    // ── Datos ──────────────────────────────────────────────────
    function collect(remote) {
        const map = new Map();
        const hidden = readHidden();
        const hiddenSeeds = readHiddenSeeds();
        (Array.isArray(remote) ? remote : []).forEach(v => {
            if (v && v.id && !hidden.has(String(v.id))) map.set(v.id, v);
        });
        readLocal().forEach(v => {
            if (!hidden.has(String(v.id))) map.set(v.id, Object.assign({}, map.get(v.id) || {}, v));
        });
        SEED.filter(v => !hiddenSeeds.has(String(v.id)) && !hidden.has(String(v.id)))
            .forEach(v => map.set(v.id, v));
        return Array.from(map.values()).sort((a, b) =>
            String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
    }
    function setItems(remote) { items = collect(remote); renderAll(); }

    async function load() {
        let remote = [];
        try {
            if (window.db && window.collection && window.getDocs) {
                const snap = await window.getDocs(window.collection(window.db, COLLECTION));
                remote = snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
            }
        } catch (e) {
            console.warn('[Vehículos] No se pudo leer la nube; se usa la copia local.', e);
        }
        setItems(remote);
    }
    function startRealtime() {
        if (unsub) return;
        if (!window.db || !window.collection || typeof window.onSnapshot !== 'function') return;
        try {
            unsub = window.onSnapshot(
                window.collection(window.db, COLLECTION),
                snap => setItems(snap.docs.map(d => Object.assign({ id: d.id }, d.data() || {}))),
                err => console.warn('[Vehículos] Suscripción no disponible:', err)
            );
            window.addEventListener('pagehide', () => {
                try { unsub && unsub(); } catch (e) { /* noop */ }
                unsub = null;
            }, { once: true });
        } catch (e) { /* noop */ }
    }

    // ── Render Wiki ────────────────────────────────────────────
    function renderFilters() {
        const container = $('vehFilters');
        if (!container) return;
        const html = ['<button type="button" class="veh-filter-btn' + (activeCategory === 'all' ? ' active' : '') + '" data-veh-filter="all">Todos</button>']
            .concat(readCategories().map(cat => `
                <span style="display:inline-flex;align-items:center;gap:0;">
                    <button type="button" class="veh-filter-btn${activeCategory === cat.id ? ' active' : ''}" data-veh-filter="${esc(cat.id)}">${esc(cat.label)}</button>
                    <button type="button" class="veh-cat-del" data-veh-cat-del="${esc(cat.id)}" title="Eliminar categoría" aria-label="Eliminar categoría"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </span>`)).join('');
        container.innerHTML = html;
    }
    function populateCategorySelect() {
        const select = $('vehCategory');
        if (!select) return;
        const previous = select.value;
        select.innerHTML = readCategories()
            .map(cat => `<option value="${esc(cat.id)}">${esc(cat.label)}</option>`).join('');
        if (previous && findCategory(previous)) select.value = previous;
    }
    function renderGrid() {
        const grid = $('vehicleGrid');
        if (!grid) return;
        const visible = activeCategory === 'all'
            ? items
            : items.filter(v => v.categoria === activeCategory);
        grid.innerHTML = visible.map(v => `
            <div class="vehicle-card" data-type="${esc(v.categoria || 'otros')}" data-veh-id="${esc(v.id)}">
                <button type="button" class="veh-del-btn" data-veh-del="${esc(v.id)}" title="Eliminar vehículo" aria-label="Eliminar vehículo"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                <div>
                    <img src="${esc(v.url)}" alt="${esc(v.nombre || '')}" class="vehicle-img" loading="lazy" decoding="async">
                    <div class="vehicle-type-badge">${esc(v.badge || categoryLabel(v.categoria))}</div>
                    <h4 class="vehicle-name">${esc(v.nombre || '')}</h4>
                    <p class="vehicle-desc">${esc(v.descripcion || '')}</p>
                </div>
            </div>`).join('');
        if (!visible.length) {
            grid.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No hay vehículos en esta categoría todavía.</p>';
        }
        grid.querySelectorAll('.vehicle-img').forEach(img => {
            const card = img.closest('[data-veh-id]');
            const item = items.find(v => v.id === card?.dataset.vehId);
            if (item) attachImageFallback(img, item.url);
        });
    }

    // ── Render Panel Admin (lista compacta, mismos datos) ──────
    function renderAdminGrid() {
        const grid = $('adminVehGrid');
        if (!grid) return;
        if (!items.length) {
            grid.innerHTML = '<p style="font-size:.78rem;color:var(--admin-text-muted);">Sin vehículos. Añádelos desde la Wiki.</p>';
            return;
        }
        grid.innerHTML = items.map(v => `
            <div style="border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.02);position:relative;">
                <img src="${esc(v.url)}" alt="${esc(v.nombre || '')}" style="width:100%;height:80px;object-fit:cover;display:block;" loading="lazy">
                <div style="padding:.5rem .6rem;">
                    <strong style="font-size:.76rem;display:block;">${esc(v.nombre || '')}</strong>
                    <small style="font-size:.68rem;color:var(--admin-text-muted);">${esc(v.badge || categoryLabel(v.categoria))}</small>
                </div>
                <button type="button" data-veh-del="${esc(v.id)}" title="Eliminar" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:1px solid rgba(239,68,68,.5);background:rgba(10,14,24,.9);color:#f87171;cursor:pointer;font-size:.65rem;"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>`).join('');
    }

    function renderAll() {
        renderFilters();
        populateCategorySelect();
        renderGrid();
        renderAdminGrid();
    }

    // ── Añadir / eliminar ──────────────────────────────────────
    function formMsg(text, tone) {
        const el = $('vehFormMsg');
        if (!el) return;
        el.textContent = text || '';
        el.style.color = tone === 'error' ? '#fca5a5' : '#86efac';
    }
    function setSaving(state) {
        const btn = $('vehSaveBtn');
        if (!btn) return;
        btn.disabled = state;
        btn.innerHTML = state
            ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Publicando...'
            : '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Publicar vehículo';
    }

    async function publish(event) {
        event.preventDefault();
        if (!canManage) { formMsg('Tu rango no permite añadir vehículos.', 'error'); return; }
        const norm = normalizeImageUrl($('vehUrl')?.value);
        if (!norm.ok) { formMsg(norm.error, 'error'); return; }
        const nombre = String($('vehName')?.value || '').trim().slice(0, 80);
        if (!nombre) { formMsg('Escribe el nombre del vehículo.', 'error'); return; }
        const catId = String($('vehCategory')?.value || 'otros');
        const cat = findCategory(catId) || findCategory('otros');
        const now = new Date().toISOString();
        const payload = {
            id: `veh_${Date.now().toString(36)}`,
            nombre,
            categoria: cat ? cat.id : 'otros',
            badge: cat ? cat.label : categoryLabel(catId),
            descripcion: String($('vehDesc')?.value || '').trim().slice(0, 400),
            url: norm.url,
            creadoEn: now,
            autorNombre: String(currentUser?.displayName || currentUser?.email || 'Equipo').slice(0, 80)
        };

        formMsg('Publicando...', 'info');
        setSaving(true);
        upsertLocal(payload);
        setItems(items);
        formMsg('Vehículo publicado y visible en la Wiki y el panel.', 'success');

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
            console.warn('[Vehículos] Guardado en copia local:', e && e.message);
        }
        setItems(items);
        formMsg('Vehículo publicado y visible en la Wiki y el panel.', 'success');
        $('vehForm')?.reset();
        setSaving(false);
        closeModal();
    }

    async function removeItem(id) {
        if (!canManage || !id) return;
        if (!window.confirm('¿Eliminar este vehículo del catálogo?')) return;
        const key = String(id);
        hideItem(key);
        if (key.startsWith('seed-')) {
            hideSeed(key);
        } else {
            removeLocal(key);
            if (window.db && window.fsDoc && window.deleteDoc && !key.startsWith('veh_')) {
                try { await window.deleteDoc(window.fsDoc(window.db, COLLECTION, key)); }
                catch (e) { console.warn('[Vehículos] Borrado aplicado en copia local:', e && e.message); }
            }
        }
        setItems(items.filter(v => v.id !== key));
        await load();
    }

    // ── Modal ──────────────────────────────────────────────────
    function openModal() {
        const modal = $('vehModal');
        if (!modal) return;
        lastFocused = document.activeElement;
        previousOverflow = document.body.style.overflow;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        formMsg('', 'info');
        populateCategorySelect();
        setTimeout(() => $('vehUrl')?.focus(), 30);
    }
    function closeModal() {
        const modal = $('vehModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousOverflow;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    // ── Eventos ────────────────────────────────────────────────
    function bindEvents() {
        $('vehAddBtn')?.addEventListener('click', openModal);
        $('vehModalClose')?.addEventListener('click', closeModal);
        $('vehCancelBtn')?.addEventListener('click', closeModal);
        $('vehForm')?.addEventListener('submit', publish);
        $('vehModal')?.addEventListener('click', (e) => { if (e.target === $('vehModal')) closeModal(); });

        $('vehAddCategoryBtn')?.addEventListener('click', () => {
            const input = $('vehNewCategory');
            const created = addCategory(input?.value);
            if (!created) { formMsg('Escribe un nombre para la categoría.', 'error'); return; }
            if (input) input.value = '';
            populateCategorySelect();
            const select = $('vehCategory');
            if (select) select.value = created.id;
            renderFilters();
            formMsg(`Categoría "${created.label}" creada.`, 'success');
        });

        $('vehFilters')?.addEventListener('click', (e) => {
            const del = e.target.closest('[data-veh-cat-del]');
            if (del) {
                if (!canManage) { formMsg('Tu rango no permite eliminar categorías.', 'error'); return; }
                if (!window.confirm('¿Eliminar esta categoría? Sus vehículos pasarán a Otros.')) return;
                if (removeCategory(del.getAttribute('data-veh-cat-del'))) { renderAll(); }
                return;
            }
            const btn = e.target.closest('[data-veh-filter]');
            if (btn) { activeCategory = btn.getAttribute('data-veh-filter') || 'all'; renderAll(); }
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-veh-del]');
            if (btn) { e.preventDefault(); e.stopPropagation(); removeItem(btn.getAttribute('data-veh-del')); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $('vehModal')?.classList.contains('active')) closeModal();
        });
        document.addEventListener('authStateChanged', (e) => computeAccess(e.detail?.user || null));
        window.addEventListener('storage', (e) => {
            if ([LOCAL_KEY, CAT_KEY, HIDDEN_SEEDS_KEY, HIDDEN_KEY].includes(e.key)) load();
        });
        document.addEventListener('firebaseReady', () => load().then(startRealtime));
    }

    function init() {
        bindEvents();
        const session = window.DiscordAuth && typeof window.DiscordAuth.getUser === 'function'
            ? window.DiscordAuth.getUser() : null;
        computeAccess(session || null);
        load().then(startRealtime);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
