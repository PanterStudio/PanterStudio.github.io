(function () {
    const listEl = document.getElementById('actualizacionesList');
    const announcementEl = document.getElementById('newsPageAnnouncement');

    if (!listEl) return;

    let currentUser = null;

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

    function formatDateLong(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return esc(value);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function waitForFirebase(timeout = 7000) {
        return new Promise((resolve) => {
            if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.addDoc && window.auth && window.onAuthStateChanged) return resolve(true);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.db && window.collection && window.getDocs && window.getDoc && window.fsDoc && window.addDoc && window.auth && window.onAuthStateChanged) {
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

    async function loadProjectUpdates() {
        try {
            const snap = await window.getDocs(window.collection(window.db, 'project_updates'));
            return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
            console.warn('No se pudieron leer actualizaciones por proyecto', err);
            return [];
        }
    }

    function projectLink(update) {
        const id = String(update?.projectId || '').trim();
        const type = String(update?.projectType || '').trim();
        if (!id) return '';
        const params = new URLSearchParams({ projectId: id, projectType: type || 'juego' });
        return `<p><a href="proyecto.html?${esc(params.toString())}">Ver pagina del proyecto</a></p>`;
    }

    // ─── LÓGICA DE COMENTARIOS Y REACCIONES ───
    async function loadComments(collectionName, docId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        try {
            const commentsRef = window.collection(window.db, collectionName, docId, 'comments');
            const snap = await window.getDocs(commentsRef);
            const list = snap.docs.map(doc => doc.data())
                .sort((a,b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

            if (!list.length) {
                container.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; margin:10px 0;">Sin comentarios aún. ¡Sé el primero!</p>`;
                return;
            }

            container.innerHTML = list.map(c => `
                <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; margin-bottom:8px; font-size:0.85rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:#00b0ff;">${esc(c.username || 'Usuario')}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${formatDateLong(c.createdAt)}</span>
                    </div>
                    <p style="margin:0; color:var(--text-secondary);">${esc(c.content)}</p>
                </div>
            `).join('');
        } catch(e) {
            console.warn('Error al cargar comentarios:', e);
        }
    }

    window.submitComment = async function(collectionName, docId, inputId, containerId) {
        if (!currentUser) {
            alert('Debes iniciar sesión para comentar.');
            return;
        }
        const input = document.getElementById(inputId);
        if (!input || !input.value.trim()) return;

        const content = input.value.trim();
        input.value = '';

        try {
            const commentsRef = window.collection(window.db, collectionName, docId, 'comments');
            let username = currentUser.displayName || currentUser.email.split('@')[0] || 'Miembro';

            // Get user's actual username from profile
            try {
                const pSnap = await window.getDoc(window.fsDoc(window.db, 'conductores', currentUser.uid));
                if (pSnap.exists()) {
                    username = pSnap.data().nombre_usuario || pSnap.data().displayName || username;
                }
            } catch(err) {}

            await window.addDoc(commentsRef, {
                uid: currentUser.uid,
                username: username,
                content: content,
                createdAt: new Date().toISOString()
            });

            await loadComments(collectionName, docId, containerId);
        } catch(e) {
            console.error('Error comentando:', e);
            alert('No se pudo enviar el comentario.');
        }
    };

    window.toggleReaction = async function(collectionName, docId, emoji, counterId) {
        if (!currentUser) {
            alert('Debes iniciar sesión para reaccionar.');
            return;
        }
        try {
            const docRef = window.fsDoc(window.db, collectionName, docId);
            const docSnap = await window.getDoc(docRef);
            if (!docSnap.exists()) return;

            const data = docSnap.data() || {};
            const reactions = data.reactions || {};
            const userReacts = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];

            let nextReacts;
            if (userReacts.includes(currentUser.uid)) {
                nextReacts = userReacts.filter(uid => uid !== currentUser.uid);
            } else {
                nextReacts = [...userReacts, currentUser.uid];
            }

            const updatedReactions = { ...reactions, [emoji]: nextReacts };
            await window.setDoc(docRef, { reactions: updatedReactions }, { merge: true });

            // Update counter UI
            const countEl = document.getElementById(counterId);
            if (countEl) countEl.textContent = String(nextReacts.length);

            const btn = countEl.parentElement;
            if (btn) {
                btn.style.background = nextReacts.includes(currentUser.uid) ? 'rgba(0,176,255,0.15)' : 'rgba(255,255,255,0.03)';
                btn.style.borderColor = nextReacts.includes(currentUser.uid) ? '#00b0ff' : 'rgba(255,255,255,0.05)';
            }
        } catch(e) {
            console.error('Error al reaccionar:', e);
        }
    };

    function renderNews(newsList, projectUpdates) {
        const sortedNews = newsList
            .filter((item) => item.published === true)
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0);
            });

        const sortedProjectUpdates = projectUpdates
            .filter((item) => item.published !== false)
            .sort((a, b) => new Date(b.date || b.updatedAt || 0) - new Date(a.date || a.updatedAt || 0));

        if (!sortedNews.length && !sortedProjectUpdates.length) {
            listEl.innerHTML = '<p>No hay novedades publicadas por ahora.</p>';
            return;
        }

        const buildArticleHtml = (item, collectionName) => {
            const tags = String(item.tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => `<span class="feature-badge">${esc(t)}</span>`)
                .join('');

            const reactions = item.reactions || {};
            const thumbsUpList = Array.isArray(reactions['👍']) ? reactions['👍'] : [];
            const heartList = Array.isArray(reactions['❤️']) ? reactions['❤️'] : [];
            const fireList = Array.isArray(reactions['🔥']) ? reactions['🔥'] : [];

            const isThumbsUp = currentUser ? thumbsUpList.includes(currentUser.uid) : false;
            const isHeart = currentUser ? heartList.includes(currentUser.uid) : false;
            const isFire = currentUser ? fireList.includes(currentUser.uid) : false;

            const safeId = item.id.replace(/[^a-zA-Z0-9]/g, '_');
            const commentsContainerId = `comments_${safeId}`;
            const commentsInputId = `input_${safeId}`;

            setTimeout(() => {
                loadComments(collectionName, item.id, commentsContainerId);
            }, 100);

            return `
                <article class="card" style="margin-top: 16px; border-left: 4px solid ${collectionName === 'news' ? '#1e70c8' : '#3cb371'};">
                    <h3>${esc(item.title || 'Novedad')}</h3>
                    <p><em>Fecha: ${formatDate(item.date || item.updatedAt || item.createdAt)}</em></p>
                    ${item.summary ? `<p><strong>${esc(item.summary)}</strong></p>` : ''}
                    ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title || 'Imagen novedad')}" style="max-width: 100%; border-radius: 8px; margin: 8px 0;">` : ''}
                    ${toParagraphs(item.content)}
                    ${tags ? `<div class="promo-features" style="margin-top: 12px; margin-bottom:12px;">${tags}</div>` : ''}
                    ${collectionName === 'project_updates' ? projectLink(item) : ''}
                    
                    <!-- ══ REACCIONES ══ -->
                    <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
                        <button class="pb sm" onclick="toggleReaction('${collectionName}', '${item.id}', '👍', 'count_up_${safeId}')" style="background:${isThumbsUp ? 'rgba(0,176,255,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isThumbsUp ? '#00b0ff' : 'rgba(255,255,255,0.05)'}; padding:4px 10px; border-radius:20px; cursor:pointer; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; color:#fff;">
                            👍 <span id="count_up_${safeId}">${thumbsUpList.length}</span>
                        </button>
                        <button class="pb sm" onclick="toggleReaction('${collectionName}', '${item.id}', '❤️', 'count_heart_${safeId}')" style="background:${isHeart ? 'rgba(0,176,255,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isHeart ? '#00b0ff' : 'rgba(255,255,255,0.05)'}; padding:4px 10px; border-radius:20px; cursor:pointer; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; color:#fff;">
                            ❤️ <span id="count_heart_${safeId}">${heartList.length}</span>
                        </button>
                        <button class="pb sm" onclick="toggleReaction('${collectionName}', '${item.id}', '🔥', 'count_fire_${safeId}')" style="background:${isFire ? 'rgba(0,176,255,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isFire ? '#00b0ff' : 'rgba(255,255,255,0.05)'}; padding:4px 10px; border-radius:20px; cursor:pointer; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px; color:#fff;">
                            🔥 <span id="count_fire_${safeId}">${fireList.length}</span>
                        </button>
                    </div>

                    <!-- ══ SECCIÓN COMENTARIOS ══ -->
                    <div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
                        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;">Comentarios</h4>
                        <div id="${commentsContainerId}">Cargando comentarios...</div>
                        
                        <!-- Formulario comentario -->
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <input type="text" id="${commentsInputId}" placeholder="${currentUser ? 'Escribe un comentario...' : 'Inicia sesión para comentar'}" style="flex:1; padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); color:#fff; font-size:0.85rem;" ${currentUser ? '' : 'disabled'}>
                            <button class="pb prim sm" onclick="submitComment('${collectionName}', '${item.id}', '${commentsInputId}', '${commentsContainerId}')" style="padding:6px 12px; font-size:0.8rem; min-height:36px; border-radius:6px;" ${currentUser ? '' : 'disabled'}>Enviar</button>
                        </div>
                    </div>
                </article>
            `;
        };

        const htmlProjectUpdates = sortedProjectUpdates
            .map((item) => buildArticleHtml(item, 'project_updates'))
            .join('');

        const htmlNews = sortedNews
            .map((item) => buildArticleHtml(item, 'news'))
            .join('');

        listEl.innerHTML = `
            ${htmlProjectUpdates ? `<h3 style="margin-top:16px;">Actualizaciones por proyecto</h3>${htmlProjectUpdates}` : ''}
            ${htmlNews ? `<h3 style="margin-top:16px;">Noticias generales</h3>${htmlNews}` : ''}
        `;
    }

    async function init() {
        const ready = await waitForFirebase();
        if (!ready) {
            renderFallback();
            return;
        }

        window.onAuthStateChanged(window.auth, (user) => {
            currentUser = user;
            // Re-render once we know user login state
            loadSettings().then(settings => {
                if (settings.enableNewsPage === false) {
                    listEl.innerHTML = '<p>La seccion de actualizaciones esta desactivada temporalmente.</p>';
                    return;
                }
                if (settings.announcement && announcementEl) {
                    announcementEl.textContent = settings.announcement;
                }
                Promise.all([loadNews(), loadProjectUpdates()]).then(([news, projectUpdates]) => {
                    renderNews(news, projectUpdates);
                });
            });
        });
    }

    init();
})();
