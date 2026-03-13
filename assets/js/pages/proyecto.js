(function () {
    const titleEl = document.getElementById('projectTitle');
    const summaryEl = document.getElementById('projectSummary');
    const typeTagEl = document.getElementById('projectTypeTag');
    const statusEl = document.getElementById('projectStatus');
    const progressEl = document.getElementById('projectProgress');
    const platformEl = document.getElementById('projectPlatform');
    const updatesCountEl = document.getElementById('projectUpdatesCount');
    const lastUpdateEl = document.getElementById('projectLastUpdate');
    const actionAreaEl = document.getElementById('projectActionArea');
    const metaTagsEl = document.getElementById('projectMetaTags');
    const heroCardEl = document.getElementById('projectHeroCard');
    const updatesListEl = document.getElementById('projectUpdatesList');

    function esc(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            projectId: String(params.get('projectId') || '').trim(),
            projectType: String(params.get('projectType') || '').trim().toLowerCase()
        };
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    function asArrayTags(tags) {
        if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
        return String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
    }

    function formatDate(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    function renderProject(project) {
        titleEl.textContent = project.title;
        summaryEl.textContent = project.summary || 'Sin resumen disponible.';
        typeTagEl.textContent = project.type === 'juego' ? 'VIDEOJUEGO' : 'APLICACION';
        statusEl.textContent = String(project.status || 'development').toUpperCase();
        progressEl.textContent = `${Math.max(0, Math.min(100, Number(project.progress || 0) || 0))}%`;
        platformEl.textContent = String(project.platform || 'General');

        const tags = asArrayTags(project.tags)
            .map(tag => `<span class="juego-tag">${esc(tag)}</span>`)
            .join('');
        const metaTags = [
            project.platform ? `<span class="juego-tag">${esc(project.platform)}</span>` : '',
            project.featuredPublic ? '<span class="juego-tag">Destacado</span>' : '',
            project.externalUrl ? '<span class="juego-tag">Enlace externo</span>' : '',
            project.discordUrl ? '<span class="juego-tag">Comunidad</span>' : '',
            tags
        ].filter(Boolean).join('');

        heroCardEl.innerHTML = `
            <article class="juego-featured-card">
                <div class="juego-featured-media">
                    <img src="${esc(project.image || 'https://i.imgur.com/GYjAGS7.png')}" alt="${esc(project.title)}" loading="lazy">
                    <span class="juego-status-badge">${esc(String(project.status || 'activo').toUpperCase())}</span>
                </div>
                <div class="juego-featured-body">
                    <h3>${esc(project.title)}</h3>
                    <p>${esc(project.description || project.summary || 'Sin descripcion disponible.')}</p>
                    ${tags ? `<div class="juego-tags">${tags}</div>` : ''}
                </div>
            </article>
        `;

        const actions = [];
        if (project.preregisterUrl) {
            actions.push(`<a href="${esc(project.preregisterUrl)}" class="btn">Pre-registro</a>`);
        }
        if (project.externalUrl) {
            actions.push(`<a href="${esc(project.externalUrl)}" class="btn" target="_blank" rel="noopener">Abrir enlace</a>`);
        }
        if (project.discordUrl) {
            actions.push(`<a href="${esc(project.discordUrl)}" class="btn btn-ghost" target="_blank" rel="noopener">Comunidad</a>`);
        }
        actions.push('<a href="actualizaciones.html" class="btn btn-ghost">Ver todas las novedades</a>');
        actionAreaEl.innerHTML = actions.join('');
        if (metaTagsEl) metaTagsEl.innerHTML = metaTags;
    }

    function renderUpdates(updates) {
        updatesCountEl.textContent = String(updates.length);
        lastUpdateEl.textContent = updates.length ? formatDate(updates[0].date || updates[0].updatedAt || updates[0].createdAt) : '—';

        if (!updates.length) {
            updatesListEl.innerHTML = '<p>No hay actualizaciones publicadas para este proyecto.</p>';
            return;
        }

        updatesListEl.innerHTML = updates.map((update) => `
            <article class="card" style="margin-top:12px;border-left:4px solid #1e70c8;">
                <h4 style="margin:0 0 .4rem;">${esc(update.title || 'Actualizacion')}</h4>
                <p style="margin:0 0 .5rem;"><em>Fecha: ${esc(formatDate(update.date || update.updatedAt || update.createdAt))}</em></p>
                ${update.summary ? `<p><strong>${esc(update.summary)}</strong></p>` : ''}
                ${update.image ? `<img src="${esc(update.image)}" alt="${esc(update.title || 'Imagen actualizacion')}" style="max-width:100%;border-radius:8px;margin:8px 0;">` : ''}
                <p style="white-space:pre-line;">${esc(update.content || '')}</p>
            </article>
        `).join('');
    }

    async function findProject(projectId, projectType) {
        const searches = [];
        if (projectType === 'juego') searches.push({ collection: 'games' });
        if (projectType === 'aplicacion') searches.push({ collection: 'applications' }, { collection: 'apps' });
        if (!searches.length) searches.push({ collection: 'games' }, { collection: 'applications' }, { collection: 'apps' });

        for (const search of searches) {
            const ref = window.fsDoc(window.db, search.collection, projectId);
            const snap = await window.getDoc(ref).catch(() => null);
            if (snap && snap.exists()) {
                return {
                    id: projectId,
                    collection: search.collection,
                    ...snap.data(),
                    type: search.collection === 'games' ? 'juego' : 'aplicacion'
                };
            }
        }

        for (const search of searches) {
            const snap = await window.getDocs(window.collection(window.db, search.collection)).catch(() => null);
            if (!snap) continue;
            const doc = snap.docs.find(d => {
                const data = d.data() || {};
                return String(data.id || d.id) === projectId;
            });
            if (doc) {
                return {
                    id: String(doc.data()?.id || doc.id),
                    collection: search.collection,
                    ...doc.data(),
                    type: search.collection === 'games' ? 'juego' : 'aplicacion'
                };
            }
        }

        return null;
    }

    async function loadProjectUpdates(projectId) {
        const snap = await window.getDocs(window.collection(window.db, 'project_updates')).catch(() => null);
        if (!snap) return [];
        return snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.published !== false && String(item.projectId || '') === projectId)
            .sort((a, b) => String(b.date || b.updatedAt || b.createdAt || '').localeCompare(String(a.date || a.updatedAt || a.createdAt || '')));
    }

    async function init() {
        const { projectId, projectType } = getParams();
        if (!projectId) {
            titleEl.textContent = 'Proyecto no especificado';
            summaryEl.textContent = 'Abre esta pagina desde la lista de Juegos o Aplicaciones.';
            updatesListEl.innerHTML = '<p>No se encontro projectId en la URL.</p>';
            return;
        }

        const ready = await waitForFirebase();
        if (!ready) {
            titleEl.textContent = 'No se pudo conectar';
            summaryEl.textContent = 'Firebase no esta disponible por ahora.';
            updatesListEl.innerHTML = '<p>Intenta recargar la pagina.</p>';
            return;
        }

        const [project, updates] = await Promise.all([
            findProject(projectId, projectType),
            loadProjectUpdates(projectId)
        ]);

        if (!project) {
            titleEl.textContent = 'Proyecto no encontrado';
            summaryEl.textContent = 'Este proyecto no existe o fue removido.';
            updatesListEl.innerHTML = '<p>No hay informacion disponible para este proyecto.</p>';
            return;
        }

        renderProject(project);
        renderUpdates(updates);
    }

    init();
})();
