(function () {
    const listEl = document.getElementById('catalogProjectsList');
    if (!listEl) return;

    const pageType = String(document.body?.dataset.catalogType || '').toLowerCase();
    const isGames = pageType === 'juego';

    function esc(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function toArrayTags(tags) {
        if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
        return String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
    }

    function projectFromDoc(docId, data, type) {
        return {
            id: String(data?.id || docId || ''),
            title: String(data?.title || data?.name || 'Proyecto sin nombre'),
            summary: String(data?.summary || data?.description || ''),
            image: String(data?.image || data?.cover || ''),
            status: String(data?.status || 'development'),
            platform: String(data?.platform || ''),
            progress: Number(data?.progress || 0),
            preregisterUrl: String(data?.preregisterUrl || ''),
            externalUrl: String(data?.externalUrl || data?.downloadUrl || ''),
            discordUrl: String(data?.discordUrl || ''),
            tags: toArrayTags(data?.tags),
            published: data?.published !== false,
            featuredPublic: data?.featuredPublic === true,
            createdAt: String(data?.createdAt || ''),
            updatedAt: String(data?.updatedAt || ''),
            type
        };
    }

    async function loadSiteSettings() {
        try {
            const snap = await window.getDoc(window.fsDoc(window.db, 'settings', 'site'));
            return snap.exists() ? snap.data() || {} : {};
        } catch {
            return {};
        }
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start >= timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 120);
        });
    }

    function statusLabel(status) {
        const map = {
            development: 'EN DESARROLLO',
            planning: 'PLANEACION',
            testing: 'TESTING',
            production: 'PRODUCCION'
        };
        return map[String(status || '').toLowerCase()] || String(status || 'ACTIVO').toUpperCase();
    }

    function renderFallback() {
        if (isGames) {
            listEl.innerHTML = `
                <article class="juego-featured-card">
                    <div class="juego-featured-media">
                        <img src="https://i.imgur.com/tWQ3svn.jpeg" alt="Vista previa Nuestra Tierra Job Simulator" loading="lazy">
                        <span class="juego-status-badge">EN DESARROLLO</span>
                    </div>
                    <div class="juego-featured-body">
                        <h3>Nuestra Tierra Job Simulator</h3>
                        <p>Simulacion colombiana para movil donde exploras trabajos tradicionales y modernos.</p>
                        <div class="juego-actions">
                            <a href="preregistro.html" class="btn">Entrar al pre-registro</a>
                            <a href="proyecto.html?projectId=nuestra-tierra-job-simulator&projectType=juego" class="btn btn-ghost">Ver pagina del proyecto</a>
                        </div>
                    </div>
                </article>
            `;
            return;
        }
        listEl.innerHTML = '<p>No hay aplicaciones publicadas por ahora.</p>';
    }

    function render(projects, settings = {}) {
        if (!projects.length) {
            renderFallback();
            return;
        }

        const featuredId = String(settings.featuredProjectId || '');
        const sortedProjects = [...projects].sort((a, b) => {
            if (settings.showFeaturedFirst !== false) {
                const aFeatured = a.id === featuredId || a.featuredPublic;
                const bFeatured = b.id === featuredId || b.featuredPublic;
                if (aFeatured && !bFeatured) return -1;
                if (!aFeatured && bFeatured) return 1;
            }
            return 0;
        });

        listEl.innerHTML = sortedProjects.map((project) => {
            const params = new URLSearchParams({
                projectId: project.id,
                projectType: project.type
            });
            const projectHref = `proyecto.html?${params.toString()}`;
            const preButton = project.preregisterUrl
                ? `<a href="${esc(project.preregisterUrl)}" class="btn">Pre-registro</a>`
                : '';
            const badgeItems = [
                project.platform ? `<span class="juego-tag">${esc(project.platform)}</span>` : '',
                project.progress ? `<span class="juego-tag">${esc(project.progress)}% completado</span>` : '',
                (project.id === featuredId || project.featuredPublic) ? '<span class="juego-tag">Destacado</span>' : '',
                ...project.tags.slice(0, 5).map(tag => `<span class="juego-tag">${esc(tag)}</span>`)
            ].filter(Boolean).join('');
            const extraButtons = [
                project.externalUrl ? `<a href="${esc(project.externalUrl)}" class="btn" target="_blank" rel="noopener">Abrir enlace</a>` : '',
                project.discordUrl ? `<a href="${esc(project.discordUrl)}" class="btn btn-ghost" target="_blank" rel="noopener">Comunidad</a>` : ''
            ].filter(Boolean).join('');

            return `
                <article class="juego-featured-card" style="margin-top:14px;${(project.id === featuredId || project.featuredPublic) ? 'box-shadow:0 0 0 1px rgba(255,215,0,.35),0 16px 40px rgba(255,215,0,.12);' : ''}">
                    <div class="juego-featured-media">
                        <img src="${esc(project.image || 'https://i.imgur.com/GYjAGS7.png')}" alt="${esc(project.title)}" loading="lazy">
                        <span class="juego-status-badge">${esc(statusLabel(project.status))}</span>
                    </div>
                    <div class="juego-featured-body">
                        <h3>${esc(project.title)}</h3>
                        <p>${esc(project.summary || 'Sin descripcion disponible.')}</p>
                        ${badgeItems ? `<div class="juego-tags">${badgeItems}</div>` : ''}
                        <div class="juego-actions">
                            ${preButton}
                            ${extraButtons}
                            <a href="${esc(projectHref)}" class="btn btn-ghost">Ver proyecto</a>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    async function loadCatalog() {
        const ready = await waitForFirebase();
        if (!ready) {
            renderFallback();
            return;
        }

        try {
            const reads = isGames
                ? [window.getDocs(window.collection(window.db, 'games'))]
                : [
                    window.getDocs(window.collection(window.db, 'applications')).catch(() => ({ docs: [] })),
                    window.getDocs(window.collection(window.db, 'apps')).catch(() => ({ docs: [] }))
                ];

            const snaps = await Promise.all(reads);
            const docs = snaps.flatMap(snap => Array.isArray(snap.docs) ? snap.docs : []);
            const type = isGames ? 'juego' : 'aplicacion';
            const [settings, projects] = await Promise.all([
                loadSiteSettings(),
                Promise.resolve(docs
                .map(doc => projectFromDoc(doc.id, doc.data() || {}, type))
                .filter(project => project.published)
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')) || a.title.localeCompare(b.title, 'es')))
            ]);

            render(projects, settings);
        } catch (err) {
            console.warn('No se pudo cargar el catalogo:', err);
            renderFallback();
        }
    }

    loadCatalog();
})();
