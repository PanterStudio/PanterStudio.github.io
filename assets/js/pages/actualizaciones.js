(function () {
    const listEl = document.getElementById('actualizacionesList');
    const announcementEl = document.getElementById('newsPageAnnouncement');

    if (!listEl) return;

    function esc(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return esc(value);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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

    function toParagraphs(content) {
        return String(content || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => `<p>${esc(line)}</p>`)
            .join('');
    }

    function renderFallback() {
        listEl.innerHTML = `
            <article class="card" style="margin-top: 16px;">
                <h3>Actualizacion de Desarrollo - Nuestra Tierra Job Simulator</h3>
                <p><em>Fecha: 7 de marzo, 2026</em></p>
                <p>Compartimos imagenes de modelos jugables dentro del juego.</p>
                <p>El mapa, los graficos y algunos botones son temporales porque seguimos en desarrollo y pruebas.</p>
            </article>
        `;
    }

    async function loadSettings() {
        try {
            const docRef = window.fsDoc(window.db, 'settings', 'site');
            const snapshot = await window.getDoc(docRef);
            if (!snapshot.exists()) return {};
            return snapshot.data() || {};
        } catch (err) {
            console.warn('No se pudo leer settings para noticias', err);
            return {};
        }
    }

    async function loadNews() {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'news'));
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn('No se pudieron leer noticias', err);
            return [];
        }
    }

    function renderNews(newsList) {
        if (!newsList.length) {
            listEl.innerHTML = '<p>No hay novedades publicadas por ahora.</p>';
            return;
        }

        const sorted = newsList
            .filter((item) => item.published === true)
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0);
            });

        if (!sorted.length) {
            listEl.innerHTML = '<p>No hay novedades publicadas por ahora.</p>';
            return;
        }

        listEl.innerHTML = sorted
            .map((item) => {
                const tags = String(item.tags || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => `<span class="feature-badge">${esc(t)}</span>`)
                    .join('');

                return `
                    <article class="card" style="margin-top: 16px; border-left: 4px solid #1e70c8;">
                        <h3>${esc(item.title || 'Novedad')}</h3>
                        <p><em>Fecha: ${formatDate(item.date || item.updatedAt || item.createdAt)}</em></p>
                        ${item.summary ? `<p><strong>${esc(item.summary)}</strong></p>` : ''}
                        ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title || 'Imagen novedad')}" style="max-width: 100%; border-radius: 8px; margin: 8px 0;">` : ''}
                        ${toParagraphs(item.content)}
                        ${tags ? `<div class="promo-features" style="margin-top: 12px;">${tags}</div>` : ''}
                    </article>
                `;
            })
            .join('');
    }

    async function init() {
        const ready = await waitForFirebase();
        if (!ready) {
            renderFallback();
            return;
        }

        const [settings, news] = await Promise.all([loadSettings(), loadNews()]);

        if (settings.enableNewsPage === false) {
            listEl.innerHTML = '<p>La seccion de actualizaciones esta desactivada temporalmente.</p>';
            return;
        }

        if (settings.announcement && announcementEl) {
            announcementEl.textContent = settings.announcement;
        }

        renderNews(news);
    }

    init();
})();
