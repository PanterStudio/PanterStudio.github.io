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
            preregisterUrl: String(data?.preregisterUrl || ''),
            tags: toArrayTags(data?.tags),
            published: data?.published !== false,
            createdAt: String(data?.createdAt || ''),
            updatedAt: String(data?.updatedAt || ''),
            type
        };
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.collection && window.getDocs) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.collection && window.getDocs) {
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

    function render(projects) {
        if (!projects.length) {
            renderFallback();
            return;
        }

        listEl.innerHTML = projects.map((project) => {
            const params = new URLSearchParams({
                projectId: project.id,
                projectType: project.type
            });
            const projectHref = `proyecto.html?${params.toString()}`;
            const preButton = project.preregisterUrl
                ? `<a href="${esc(project.preregisterUrl)}" class="btn">Pre-registro</a>`
                : '';
            const tags = project.tags.length
                ? `<div class="juego-tags">${project.tags.slice(0, 5).map(tag => `<span class="juego-tag">${esc(tag)}</span>`).join('')}</div>`
                : '';

            return `
                <article class="juego-featured-card" style="margin-top:14px;">
                    <div class="juego-featured-media">
                        <img src="${esc(project.image || 'https://i.imgur.com/GYjAGS7.png')}" alt="${esc(project.title)}" loading="lazy">
                        <span class="juego-status-badge">${esc(statusLabel(project.status))}</span>
                    </div>
                    <div class="juego-featured-body">
                        <h3>${esc(project.title)}</h3>
                        <p>${esc(project.summary || 'Sin descripcion disponible.')}</p>
                        ${tags}
                        <div class="juego-actions">
                            ${preButton}
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
            const projects = docs
                .map(doc => projectFromDoc(doc.id, doc.data() || {}, type))
                .filter(project => project.published)
                .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')) || a.title.localeCompare(b.title, 'es'));

            render(projects);
        } catch (err) {
            console.warn('No se pudo cargar el catalogo:', err);
            renderFallback();
        }
    }

    loadCatalog();
})();
