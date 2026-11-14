(function () {
    // Varios ids históricos (projectTypeTag, projectStatus,
    // projectProgress, projectPlatform, projectHeroCard) YA NO EXISTEN en
    // proyecto.html. Se resuelven de forma tolerante y se reutilizan los
    // elementos reales del hero para que la página nunca lance un
    // "Cannot set properties of null".
    const el = (id) => document.getElementById(id);
    const setText = (node, value) => { if (node) node.textContent = value; };
    const titleEl = el('projectTitle');
    const summaryEl = el('projectSummary');
    const updatesCountEl = el('projectUpdatesCount');
    const lastUpdateEl = el('projectLastUpdate');
    const actionAreaEl = el('projectActionArea');
    const metaTagsEl = el('projectMetaTags');
    const heroTitleEl = el('projectHeroTitle');
    const heroDescEl = el('projectHeroDesc');
    const heroImageEl = el('projectHeroImage');
    const extraInfoEl = el('projectExtraInfo');
    const updatesListEl = el('projectUpdatesList');

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
        setText(titleEl, project.title || 'Proyecto');
        setText(summaryEl, project.summary || project.description || 'Sin resumen disponible.');

        const tags = asArrayTags(project.tags)
            .map(tag => `<span class="juego-tag">${esc(tag)}</span>`)
            .join('');
        const metaTags = [
            `<span class="juego-tag">${esc(project.type === 'juego' ? 'VIDEOJUEGO' : 'APLICACIÓN')}</span>`,
            `<span class="juego-tag">${esc(String(project.status || 'development').toUpperCase())}</span>`,
            `<span class="juego-tag">${esc(Math.max(0, Math.min(100, Number(project.progress || 0) || 0)) + '%')}</span>`,
            project.platform ? `<span class="juego-tag">${esc(project.platform)}</span>` : '',
            project.featuredPublic ? '<span class="juego-tag">Destacado</span>' : '',
            project.externalUrl ? '<span class="juego-tag">Enlace externo</span>' : '',
            project.discordUrl ? '<span class="juego-tag">Comunidad</span>' : '',
            tags
        ].filter(Boolean).join('');

        // Se pintan los contenedores que SÍ existen en proyecto.html.
        setText(heroTitleEl, project.title || 'Proyecto');
        setText(heroDescEl, project.description || project.summary || 'Sin descripción disponible.');
        if (heroImageEl && project.image) heroImageEl.src = project.image;
        if (extraInfoEl && project.description) extraInfoEl.textContent = project.description;

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
        if (actionAreaEl) actionAreaEl.innerHTML = actions.join('');
        if (metaTagsEl) metaTagsEl.innerHTML = metaTags;
    }

    function renderUpdates(updates) {
        setText(updatesCountEl, String(updates.length));
        setText(lastUpdateEl, updates.length ? formatDate(updates[0].date || updates[0].updatedAt || updates[0].createdAt) : '—');

        if (!updatesListEl) return;
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
        const setFallback = (title, summary, listMsg) => {
            setText(titleEl, title);
            setText(summaryEl, summary);
            if (updatesListEl) updatesListEl.innerHTML = `<p>${esc(listMsg)}</p>`;
        };

        if (!projectId) {
            setFallback('Proyecto no especificado',
                'Abre esta página desde la lista de Juegos o Aplicaciones.',
                'No se encontró projectId en la URL.');
            return;
        }

        const ready = await waitForFirebase();
        if (!ready) {
            setFallback('Sin conexión', 'Firebase no está disponible por ahora.', 'Intenta recargar la página.');
            return;
        }

        let project = await findProject(projectId, projectType);
        if (!project) {
            // Las colecciones games / applications / apps pueden no existir:
            // se reconstruye una ficha mínima desde project_updates para que
            // la página siga siendo útil en lugar de quedar vacía.
            const updates = await loadProjectUpdates(projectId);
            if (updates.length) {
                project = {
                    id: projectId,
                    title: String(updates[0].projectTitle || updates[0].title || projectId),
                    summary: 'Actualizaciones publicadas para este proyecto.',
                    type: projectType === 'aplicacion' ? 'aplicacion' : 'juego'
                };
            }
        }
        if (!project) {
            setFallback('Proyecto no encontrado',
                'Este proyecto no existe o fue removido.',
                'No hay información disponible para este proyecto.');
            return;
        }

        // Load updates using the resolved project.id to avoid mismatches
        const resolvedProjectId = String(project.id || projectId || '').trim();
        const updates = await loadProjectUpdates(resolvedProjectId);

        renderProject(project);
        renderUpdates(updates);
    }

    init();
})();
