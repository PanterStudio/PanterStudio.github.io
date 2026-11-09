// dev-tools.js — Panter Studio Admin Panel: Development Tools
// All data stored in localStorage (browser only)

/* ═══════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════ */
const LS = {
    get: (key, fallback = []) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch { return fallback; }
    },
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    genId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
};

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// Close modals on overlay click
document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
    });
});

/* ═══════════════════════════════════════════════════════
   1. KANBAN ROADMAP
═══════════════════════════════════════════════════════ */
const KANBAN_KEY = 'ps_kanban_cards';
const KANBAN_COLS = ['ideas', 'progress', 'done', 'discarded'];
const TAG_ICONS = { gameplay:'<i class="fa-solid fa-gamepad" aria-hidden="true"></i>', ui:'<i class="fa-solid fa-display" aria-hidden="true"></i>', economia:'<i class="fa-solid fa-sack-dollar" aria-hidden="true"></i>', arte:'<i class="fa-solid fa-palette" aria-hidden="true"></i>', audio:'<i class="fa-solid fa-music" aria-hidden="true"></i>', tecnico:'<i class="fa-solid fa-gears" aria-hidden="true"></i>' };
const PRIO_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

function getKanbanCards() { return LS.get(KANBAN_KEY, []); }
function saveKanbanCards(cards) { LS.set(KANBAN_KEY, cards); }

function openKanbanForm(col) {
    document.getElementById(`form-${col}`)?.classList.add('open');
}
function closeKanbanForm(col) {
    const form = document.getElementById(`form-${col}`);
    if (form) form.classList.remove('open');
    ['title', 'desc'].forEach(f => {
        const el = document.getElementById(`kanban-${f}-${col}`);
        if (el) el.value = '';
    });
}

function saveKanbanCard(col) {
    const title = document.getElementById(`kanban-title-${col}`)?.value.trim();
    const desc = document.getElementById(`kanban-desc-${col}`)?.value.trim();
    const tag = document.getElementById(`kanban-tag-${col}`)?.value || 'gameplay';
    const prio = document.getElementById(`kanban-prio-${col}`)?.value || 'medium';

    if (!title) { alert('El título es obligatorio.'); return; }

    const cards = getKanbanCards();
    cards.push({ id: LS.genId(), col, title, desc, tag, prio, createdAt: new Date().toISOString() });
    saveKanbanCards(cards);
    closeKanbanForm(col);
    renderKanban();
}

function moveKanbanCard(id, direction) {
    const cards = getKanbanCards();
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const order = ['ideas', 'progress', 'done', 'discarded'];
    const idx = order.indexOf(card.col);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    card.col = order[newIdx];
    saveKanbanCards(cards);
    renderKanban();
}

function deleteKanbanCard(id) {
    const cards = getKanbanCards().filter(c => c.id !== id);
    saveKanbanCards(cards);
    renderKanban();
}

function renderKanbanCard(card) {
    const colOrder = ['ideas', 'progress', 'done', 'discarded'];
    const colIdx = colOrder.indexOf(card.col);
    const canLeft = colIdx > 0;
    const canRight = colIdx < colOrder.length - 1;
    const prioClass = `prio-${card.prio}`;
    const tagClass = `tag-${card.tag}`;
    const tagIcon = TAG_ICONS[card.tag] || '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
    const prioLabel = PRIO_LABELS[card.prio] || card.prio;

    return `
    <div class="kanban-card" data-id="${card.id}">
        <button class="kanban-card-delete" onclick="deleteKanbanCard('${card.id}')" title="Eliminar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <div class="kanban-card-title">${card.title}</div>
        ${card.desc ? `<div class="kanban-card-desc">${card.desc}</div>` : ''}
        <div class="kanban-card-footer">
            <div style="display:flex; gap:4px; align-items:center;">
                <span class="kanban-tag ${tagClass}">${tagIcon} ${card.tag}</span>
                <span class="priority-badge ${prioClass}">${prioLabel}</span>
            </div>
            <div class="kanban-move-btns">
                ${canLeft ? `<button class="kanban-move-btn" onclick="moveKanbanCard('${card.id}', -1)" title="Retroceder"><i class="fa-solid fa-backward-step" aria-hidden="true"></i></button>` : ''}
                ${canRight ? `<button class="kanban-move-btn" onclick="moveKanbanCard('${card.id}', 1)" title="Avanzar"><i class="fa-solid fa-play" aria-hidden="true"></i></button>` : ''}
            </div>
        </div>
    </div>`;
}

function renderKanban() {
    const cards = getKanbanCards();
    KANBAN_COLS.forEach(col => {
        const container = document.getElementById(`cards-${col}`);
        const countEl = document.getElementById(`count-${col}`);
        if (!container) return;
        const colCards = cards.filter(c => c.col === col);
        container.innerHTML = colCards.length
            ? colCards.map(renderKanbanCard).join('')
            : `<div class="empty-state" style="padding:1.5rem 1rem;"><div style="font-size:1.5rem; margin-bottom:4px;"><i class="fa-solid fa-inbox" aria-hidden="true"></i></div><div style="font-size:0.75rem;">Sin tarjetas</div></div>`;
        if (countEl) countEl.textContent = colCards.length;
    });
}

function exportKanban() {
    const cards = getKanbanCards();
    const lines = KANBAN_COLS.map(col => {
        const colCards = cards.filter(c => c.col === col);
        const header = `## ${col.toUpperCase()} (${colCards.length})`;
        const items = colCards.map(c => `- [${c.prio}] ${c.title}${c.desc ? ': ' + c.desc : ''}`).join('\n');
        return header + '\n' + (items || '(vacío)');
    }).join('\n\n');

    const blob = new Blob([`# Roadmap — Nuestra Tierra: Job Simulator\n\n${lines}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'roadmap.txt'; a.click();
    URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════
   2. BANCO DE IDEAS
═══════════════════════════════════════════════════════ */
const IDEAS_KEY = 'ps_ideas';
const CAT_ICONS = { mecanica:'<i class="fa-solid fa-gamepad" aria-hidden="true"></i>', historia:'<i class="fa-solid fa-book-open" aria-hidden="true"></i>', arte:'<i class="fa-solid fa-palette" aria-hidden="true"></i>', musica:'<i class="fa-solid fa-music" aria-hidden="true"></i>', monetizacion:'<i class="fa-solid fa-sack-dollar" aria-hidden="true"></i>', comunidad:'<i class="fa-solid fa-globe" aria-hidden="true"></i>', otro:'<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>' };

function getIdeas() { return LS.get(IDEAS_KEY, []); }
function saveIdeas(ideas) { LS.set(IDEAS_KEY, ideas); }

function saveIdea() {
    const title = document.getElementById('ideaTitle')?.value.trim();
    const body = document.getElementById('ideaBody')?.value.trim();
    const category = document.getElementById('ideaCategory')?.value || 'otro';

    if (!title) { alert('El título es obligatorio.'); return; }

    const ideas = getIdeas();
    ideas.unshift({ id: LS.genId(), title, body, category, liked: false, discarded: false, createdAt: new Date().toISOString() });
    saveIdeas(ideas);

    document.getElementById('ideaTitle').value = '';
    document.getElementById('ideaBody').value = '';
    renderIdeas();
}

function toggleIdeaLike(id) {
    const ideas = getIdeas();
    const idea = ideas.find(i => i.id === id);
    if (idea) { idea.liked = !idea.liked; idea.discarded = false; }
    saveIdeas(ideas);
    renderIdeas();
}

function toggleIdeaDiscard(id) {
    const ideas = getIdeas();
    const idea = ideas.find(i => i.id === id);
    if (idea) { idea.discarded = !idea.discarded; idea.liked = false; }
    saveIdeas(ideas);
    renderIdeas();
}

function deleteIdea(id) {
    if (!confirm('¿Eliminar esta idea?')) return;
    saveIdeas(getIdeas().filter(i => i.id !== id));
    renderIdeas();
}

function renderIdeas() {
    const container = document.getElementById('ideasList');
    if (!container) return;

    const search = (document.getElementById('ideasSearch')?.value || '').toLowerCase();
    const filter = document.getElementById('ideasFilter')?.value || '';

    let ideas = getIdeas();
    if (filter) ideas = ideas.filter(i => i.category === filter);
    if (search) ideas = ideas.filter(i => i.title.toLowerCase().includes(search) || (i.body || '').toLowerCase().includes(search));

    if (!ideas.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i></div><div class="empty-state-text">No hay ideas que coincidan.</div></div>`;
        return;
    }

    container.innerHTML = ideas.map(idea => {
        const icon = CAT_ICONS[idea.category] || '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
        const date = new Date(idea.createdAt).toLocaleDateString('es');
        return `
        <div class="idea-item${idea.discarded ? ' discarded' : ''}">
            <div style="font-size:1.5rem; flex-shrink:0;">${icon}</div>
            <div class="idea-content">
                <div class="idea-title">${idea.title}</div>
                ${idea.body ? `<div class="idea-body">${idea.body}</div>` : ''}
                <div class="idea-meta">
                    <span class="kanban-tag" style="font-size:0.65rem; padding:2px 7px; border-radius:100px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:var(--admin-text-secondary);">${icon} ${idea.category}</span>
                    <span style="font-size:0.7rem; color:var(--admin-text-muted);">${date}</span>
                    ${idea.liked ? '<span style="font-size:0.7rem; color:#f472b6;"><i class="fa-solid fa-heart" style="color:#ef4444" aria-hidden="true"></i> Me gusta</span>' : ''}
                    ${idea.discarded ? '<span style="font-size:0.7rem; color:#64748b;"><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Descartada</span>' : ''}
                </div>
            </div>
            <div class="idea-actions">
                <button class="idea-act-btn" onclick="toggleIdeaLike('${idea.id}')" title="${idea.liked ? 'Quitar me gusta' : 'Me gusta'}">${idea.liked ? '<i class="fa-solid fa-heart-crack" aria-hidden="true"></i>' : '<i class="fa-solid fa-heart" style="color:#ef4444" aria-hidden="true"></i>'}</button>
                <button class="idea-act-btn" onclick="toggleIdeaDiscard('${idea.id}')" title="${idea.discarded ? 'Restaurar' : 'Descartar'}">${idea.discarded ? '<i class="fa-solid fa-recycle" aria-hidden="true"></i>' : '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>'}</button>
                <button class="idea-act-btn del" onclick="deleteIdea('${idea.id}')" title="Eliminar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   3. CHANGELOG INTERNO
═══════════════════════════════════════════════════════ */
const CHANGELOG_KEY = 'ps_changelog';
const CL_TYPE_ICONS = { feat:'<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>', fix:'<i class="fa-solid fa-bug" aria-hidden="true"></i>', balance:'<i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>', content:'<i class="fa-solid fa-box" aria-hidden="true"></i>' };
const CL_TYPE_LABELS = { feat:'Feature', fix:'Fix', balance:'Balance', content:'Contenido' };

function getChangelogs() { return LS.get(CHANGELOG_KEY, []); }
function saveChangelogs(cl) { LS.set(CHANGELOG_KEY, cl); }

function openChangelogModal() { openModal('changelogModal'); }

function saveChangelog() {
    const version = document.getElementById('clVersion')?.value.trim();
    const type = document.getElementById('clType')?.value || 'feat';
    const desc = document.getElementById('clDesc')?.value.trim();

    if (!version || !desc) { alert('Versión y descripción son obligatorios.'); return; }

    const cl = getChangelogs();
    cl.unshift({ id: LS.genId(), version, type, desc, createdAt: new Date().toISOString() });
    saveChangelogs(cl);
    closeModal('changelogModal');

    ['clVersion', 'clDesc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderChangelog();
}

function deleteChangelog(id) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    saveChangelogs(getChangelogs().filter(c => c.id !== id));
    renderChangelog();
}

function copyChangelog(id) {
    const cl = getChangelogs().find(c => c.id === id);
    if (!cl) return;
    const text = ` ${cl.version} — ${new Date(cl.createdAt).toLocaleDateString('es')}\n[${cl.type.toUpperCase()}] ${cl.desc}`;
    navigator.clipboard.writeText(text).then(() => alert('¡Copiado al portapapeles!'));
}

function renderChangelog() {
    const container = document.getElementById('changelogList');
    if (!container) return;
    const cl = getChangelogs();

    if (!cl.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i></div><div class="empty-state-text">No hay entradas en el changelog aún.</div></div>`;
        return;
    }

    container.innerHTML = cl.map(entry => {
        const icon = CL_TYPE_ICONS[entry.type] || '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
        const typeClass = `type-${entry.type}`;
        const dotClass = entry.type;
        const date = new Date(entry.createdAt).toLocaleDateString('es');
        return `
        <div class="changelog-entry">
            <div class="changelog-dot ${dotClass}">${icon}</div>
            <div class="changelog-body">
                <div class="changelog-version-row">
                    <span class="changelog-version">${entry.version}</span>
                    <span class="changelog-type-badge ${typeClass}">${CL_TYPE_LABELS[entry.type] || entry.type}</span>
                    <span class="changelog-date">${date}</span>
                </div>
                <div class="changelog-desc">${entry.desc}</div>
                <div class="changelog-entry-actions">
                    <button class="idea-act-btn" onclick="copyChangelog('${entry.id}')" title="Copiar"> Copiar</button>
                    <button class="idea-act-btn del" onclick="deleteChangelog('${entry.id}')" title="Eliminar"><i class="fa-solid fa-xmark" aria-hidden="true"></i> Eliminar</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   4. BUG TRACKER
═══════════════════════════════════════════════════════ */
const BUGS_KEY = 'ps_bugs';
let bugFilter = 'all';

function getBugs() { return LS.get(BUGS_KEY, []); }
function saveBugs(bugs) { LS.set(BUGS_KEY, bugs); }

function openBugModal() { openModal('bugModal'); }

function saveBug() {
    const title = document.getElementById('bugTitle')?.value.trim();
    const desc = document.getElementById('bugDesc')?.value.trim();
    const priority = document.getElementById('bugPriority')?.value || 'medio';
    const platform = document.getElementById('bugPlatform')?.value || 'android';
    const assigned = document.getElementById('bugAssigned')?.value.trim() || 'Sin asignar';

    if (!title) { alert('El título es obligatorio.'); return; }

    const bugs = getBugs();
    bugs.unshift({ id: LS.genId(), title, desc, priority, platform, assigned, status: 'new', createdAt: new Date().toISOString() });
    saveBugs(bugs);
    closeModal('bugModal');

    ['bugTitle', 'bugDesc', 'bugAssigned'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderBugs();
}

function updateBugStatus(id, status) {
    const bugs = getBugs();
    const bug = bugs.find(b => b.id === id);
    if (bug) bug.status = status;
    saveBugs(bugs);
    renderBugs();
}

function deleteBug(id) {
    if (!confirm('¿Eliminar este bug?')) return;
    saveBugs(getBugs().filter(b => b.id !== id));
    renderBugs();
}

function filterBugs(filter, btn) {
    bugFilter = filter;
    document.querySelectorAll('.bug-filter-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    renderBugs();
}

function renderBugs() {
    const container = document.getElementById('bugsList');
    if (!container) return;

    let bugs = getBugs();
    if (bugFilter !== 'all') bugs = bugs.filter(b => b.status === bugFilter);

    if (!bugs.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-bug" aria-hidden="true"></i></div><div class="empty-state-text">${bugFilter === 'all' ? 'No hay bugs registrados.' : 'No hay bugs con este estado.'}</div></div>`;
        return;
    }

    const PLAT_LABELS = { android:'<i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> Android', web:'<i class="fa-solid fa-globe" aria-hidden="true"></i> Web', ambas:'<i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i><i class="fa-solid fa-globe" aria-hidden="true"></i> Ambas' };

    container.innerHTML = bugs.map(bug => {
        const date = new Date(bug.createdAt).toLocaleDateString('es');
        return `
        <div class="bug-item">
            <div class="bug-status-dot ${bug.status}"></div>
            <div class="bug-content">
                <div class="bug-title">${bug.title}</div>
                ${bug.desc ? `<div class="bug-desc">${bug.desc}</div>` : ''}
                <div class="bug-meta">
                    <span class="bug-prio-badge prio-${bug.priority}"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${bug.priority}</span>
                    <span class="bug-plat-badge">${PLAT_LABELS[bug.platform] || bug.platform}</span>
                    <span style="font-size:0.7rem; color:var(--admin-text-muted);"><i class="fa-solid fa-user" aria-hidden="true"></i> ${bug.assigned}</span>
                    <span style="font-size:0.7rem; color:var(--admin-text-muted);">${date}</span>
                </div>
            </div>
            <div class="bug-actions">
                <select class="bug-status-sel" onchange="updateBugStatus('${bug.id}', this.value)">
                    <option value="new" ${bug.status==='new'?'selected':''}> Nuevo</option>
                    <option value="review" ${bug.status==='review'?'selected':''}> Revisión</option>
                    <option value="resolved" ${bug.status==='resolved'?'selected':''}> Resuelto</option>
                </select>
                <button class="idea-act-btn del" onclick="deleteBug('${bug.id}')"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   5. INVENTARIO DE ASSETS
═══════════════════════════════════════════════════════ */
const ASSETS_KEY = 'ps_assets';
const ASSET_TYPE_ICONS = { sprite:'<i class="fa-solid fa-image" aria-hidden="true"></i>', audio:'<i class="fa-solid fa-music" aria-hidden="true"></i>', ui:'<i class="fa-solid fa-display" aria-hidden="true"></i>', mapa:'<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>', otro:'<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>' };
const ASSET_STATUS_CLASSES = { listo:'astatus-listo', progreso:'astatus-progreso', pendiente:'astatus-pendiente' };
const ASSET_STATUS_LABELS = { listo:'<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Listo', progreso:'<i class="fa-solid fa-wrench" aria-hidden="true"></i> En progreso', pendiente:'<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i> Pendiente' };

function getAssets() { return LS.get(ASSETS_KEY, []); }
function saveAssets(assets) { LS.set(ASSETS_KEY, assets); }

function openAssetModal() { openModal('assetModal'); }

function saveAsset() {
    const name = document.getElementById('assetName')?.value.trim();
    const type = document.getElementById('assetType')?.value || 'sprite';
    const status = document.getElementById('assetStatus')?.value || 'pendiente';
    const link = document.getElementById('assetLink')?.value.trim();
    const note = document.getElementById('assetNote')?.value.trim();

    if (!name) { alert('El nombre es obligatorio.'); return; }

    const assets = getAssets();
    assets.unshift({ id: LS.genId(), name, type, status, link, note, createdAt: new Date().toISOString() });
    saveAssets(assets);
    closeModal('assetModal');

    ['assetName', 'assetLink', 'assetNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderAssets();
}

function updateAssetStatus(id, status) {
    const assets = getAssets();
    const asset = assets.find(a => a.id === id);
    if (asset) asset.status = status;
    saveAssets(assets);
    renderAssets();
}

function deleteAsset(id) {
    if (!confirm('¿Eliminar este asset?')) return;
    saveAssets(getAssets().filter(a => a.id !== id));
    renderAssets();
}

function renderAssets() {
    const container = document.getElementById('assetsList');
    if (!container) return;

    const search = (document.getElementById('assetsSearch')?.value || '').toLowerCase();
    const filter = document.getElementById('assetsFilter')?.value || '';

    let assets = getAssets();
    if (filter) assets = assets.filter(a => a.type === filter);
    if (search) assets = assets.filter(a => a.name.toLowerCase().includes(search) || (a.note || '').toLowerCase().includes(search));

    if (!assets.length) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon"><i class="fa-solid fa-box" aria-hidden="true"></i></div><div class="empty-state-text">No hay assets registrados.</div></div>`;
        return;
    }

    container.innerHTML = assets.map(asset => {
        const icon = ASSET_TYPE_ICONS[asset.type] || '<i class="fa-solid fa-thumbtack" aria-hidden="true"></i>';
        const statusClass = ASSET_STATUS_CLASSES[asset.status] || 'astatus-pendiente';
        const statusLabel = ASSET_STATUS_LABELS[asset.status] || asset.status;
        const typeClass = `atype-${asset.type}`;
        return `
        <div class="asset-item">
            <div class="asset-icon">${icon}</div>
            <div class="asset-name">${asset.name}</div>
            <span class="asset-type-badge ${typeClass}">${icon} ${asset.type}</span>
            <span class="asset-status-badge ${statusClass}">${statusLabel}</span>
            ${asset.note ? `<div class="asset-note">${asset.note}</div>` : ''}
            ${asset.link ? `<a href="${asset.link}" class="asset-link" target="_blank" rel="noopener"><i class="fa-solid fa-link" aria-hidden="true"></i> ${asset.link}</a>` : ''}
            <div class="asset-actions">
                <select class="bug-status-sel" onchange="updateAssetStatus('${asset.id}', this.value)" style="font-size:0.7rem; padding:2px 6px;">
                    <option value="listo" ${asset.status==='listo'?'selected':''}> Listo</option>
                    <option value="progreso" ${asset.status==='progreso'?'selected':''}> Progreso</option>
                    <option value="pendiente" ${asset.status==='pendiente'?'selected':''}> Pendiente</option>
                </select>
                <button class="idea-act-btn del" onclick="deleteAsset('${asset.id}')" style="font-size:0.72rem; padding:3px 8px;"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   6. PIZARRÓN (Notepad)
═══════════════════════════════════════════════════════ */
const NOTEPAD_KEY = 'ps_notepad_pages';
const NOTEPAD_ACTIVE_KEY = 'ps_notepad_active';
let notepadSaveTimer = null;

function getNotepadPages() {
    const pages = LS.get(NOTEPAD_KEY, null);
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
        return [{ id: 'main', name: '<i class="fa-solid fa-book" aria-hidden="true"></i> Principal', content: '' }];
    }
    return pages;
}

function saveNotepadPages(pages) { LS.set(NOTEPAD_KEY, pages); }
function getActivePageId() { return localStorage.getItem(NOTEPAD_ACTIVE_KEY) || 'main'; }
function setActivePageId(id) { localStorage.setItem(NOTEPAD_ACTIVE_KEY, id); }

function getNotepadEditor() { return document.getElementById('notepadEditor'); }

function addNotepadPage() {
    const name = prompt('Nombre de la nueva página:', `Página ${getNotepadPages().length + 1}`);
    if (!name) return;
    const pages = getNotepadPages();
    const id = LS.genId();
    pages.push({ id, name: name.trim(), content: '' });
    saveNotepadPages(pages);
    setActivePageId(id);
    renderNotepadPages();
    loadNotepadPage(id);
}

function renderNotepadPages() {
    const container = document.getElementById('notepadPages');
    if (!container) return;
    const pages = getNotepadPages();
    const activeId = getActivePageId();
    container.innerHTML = pages.map(p => `
        <button class="notepad-page-btn ${p.id === activeId ? 'active' : ''}"
            onclick="switchNotepadPage('${p.id}')">${p.name}</button>
    `).join('') + `<button class="notepad-page-btn" onclick="addNotepadPage()" style="opacity:0.6;">+ Nueva</button>`;
}

function switchNotepadPage(id) {
    saveCurrentNotepadPage();
    setActivePageId(id);
    renderNotepadPages();
    loadNotepadPage(id);
}

function loadNotepadPage(id) {
    const pages = getNotepadPages();
    const page = pages.find(p => p.id === id) || pages[0];
    const editor = getNotepadEditor();
    if (!editor) return;
    editor.innerHTML = page?.content || '';
    updateNotepadWordCount();
    const nameEl = document.getElementById('notepadPageName');
    if (nameEl) nameEl.textContent = page?.name || '';
}

function saveCurrentNotepadPage() {
    const editor = getNotepadEditor();
    if (!editor) return;
    const pages = getNotepadPages();
    const activeId = getActivePageId();
    const page = pages.find(p => p.id === activeId);
    if (page) { page.content = editor.innerHTML; saveNotepadPages(pages); }
    const indicator = document.getElementById('notepadSavedIndicator');
    if (indicator) { indicator.textContent = ' Guardado'; indicator.style.color = '#34d399'; }
}

function updateNotepadWordCount() {
    const editor = getNotepadEditor();
    const wc = document.getElementById('notepadWordCount');
    if (!editor || !wc) return;
    const text = editor.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    wc.textContent = `${words} palabra${words !== 1 ? 's' : ''}`;
}

function execNoteCmd(cmd) {
    getNotepadEditor()?.focus();
    document.execCommand(cmd, false, null);
    scheduleNotepadSave();
}

function insertNoteHeading() {
    getNotepadEditor()?.focus();
    document.execCommand('formatBlock', false, 'h2');
    scheduleNotepadSave();
}

function scheduleNotepadSave() {
    const indicator = document.getElementById('notepadSavedIndicator');
    if (indicator) { indicator.textContent = '● Editando...'; indicator.style.color = '#fbbf24'; }
    clearTimeout(notepadSaveTimer);
    notepadSaveTimer = setTimeout(() => { saveCurrentNotepadPage(); updateNotepadWordCount(); }, 2000);
}

function clearNotepad() {
    if (!confirm('¿Borrar el contenido de esta página?')) return;
    const editor = getNotepadEditor();
    if (editor) { editor.innerHTML = ''; saveCurrentNotepadPage(); }
}

function exportNotepad() {
    saveCurrentNotepadPage();
    const pages = getNotepadPages();
    const text = pages.map(p => {
        const div = document.createElement('div');
        div.innerHTML = p.content;
        return `# ${p.name}\n\n${div.innerText || '(vacío)'}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pizarron-panterstudio.txt'; a.click();
    URL.revokeObjectURL(url);
}

function initNotepad() {
    const editor = getNotepadEditor();
    if (!editor) return;
    const activeId = getActivePageId();
    renderNotepadPages();
    loadNotepadPage(activeId);
    editor.addEventListener('input', scheduleNotepadSave);
}

/* ═══════════════════════════════════════════════════════
   7. ANUNCIOS — híbrido localStorage + Firestore
   • Si Firebase está listo → lee/escribe en Firestore y cachea en LS
   • Si Firebase NO está (localhost sin red, etc.) → usa solo LS
═══════════════════════════════════════════════════════ */
const ANN_LS_KEY = 'ps_announcements_cache';
const TYPE_ICONS_ANN = { general:'<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>', evento:'<i class="fa-solid fa-champagne-glasses" aria-hidden="true"></i>', update:'<i class="fa-solid fa-rocket" aria-hidden="true"></i>', urgente:'<i class="fa-solid fa-bell" aria-hidden="true"></i>' };

function isFirebaseReady() {
    return !!(window.db && window.collection && window.getDocs && window.addDoc && window.deleteDoc);
}

// ── localStorage helpers ──
function getLocalAnnouncements() { return LS.get(ANN_LS_KEY, []); }
function saveLocalAnnouncements(list) { LS.set(ANN_LS_KEY, list); }

// ── UI helpers ──
function setAnnMode(mode) {
    // mode: 'cloud' | 'local'
    const badge = document.getElementById('annModeBadge');
    if (!badge) return;
    if (mode === 'cloud') {
        badge.textContent = ' Firestore (en vivo)';
        badge.style.cssText = 'background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);color:#34d399;font-size:0.7rem;font-weight:800;padding:3px 10px;border-radius:100px;';
    } else {
        badge.textContent = ' Local (localhost)';
        badge.style.cssText = 'background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;font-size:0.7rem;font-weight:800;padding:3px 10px;border-radius:100px;';
    }
}

function renderAnnouncementItems(items, source) {
    const container = document.getElementById('announcementsList');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-inbox" aria-hidden="true"></i></div><div class="empty-state-text">No hay anuncios publicados.</div></div>`;
        return;
    }
    container.innerHTML = items.map(d => {
        const icon = TYPE_ICONS_ANN[d.type] || '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>';
        const date = d.createdAt ? new Date(d.createdAt).toLocaleString('es') : '';
        return `
        <div class="announcement-item">
            <button class="announcement-delete-btn" onclick="deleteAnnouncement('${d.id}','${source}')" title="Eliminar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            <span class="announcement-item-type atype-${d.type}">${icon} ${d.type || 'general'}</span>
            <div class="announcement-title">${d.title}</div>
            <div class="announcement-body">${d.body}</div>
            <div class="announcement-meta">Por ${d.createdBy || 'admin'} · ${date}</div>
        </div>`;
    }).join('');
}

function openAnnouncementModal() { openModal('announcementModal'); }

async function saveAnnouncement() {
    const type  = document.getElementById('annType')?.value || 'general';
    const title = document.getElementById('annTitle')?.value.trim();
    const body  = document.getElementById('annBody')?.value.trim();
    if (!title || !body) { alert('Título y mensaje son obligatorios.'); return; }

    const entry = {
        id: LS.genId(),
        type, title, body,
        createdAt: new Date().toISOString(),
        createdBy: window._currentAdminUser?.email || 'admin'
    };

    if (isFirebaseReady()) {
        // Guardar en Firestore
        try {
            const ref = await window.addDoc(window.collection(window.db, 'announcements'), entry);
            entry.id = ref.id; // usa el ID de Firestore
        } catch (err) {
            console.warn('Firestore falló, guardando localmente:', err);
            // Caída silenciosa → guardar localmente
            const local = getLocalAnnouncements();
            local.unshift(entry);
            saveLocalAnnouncements(local);
            closeModal('announcementModal');
            ['annTitle','annBody'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            loadAnnouncements();
            return;
        }
        // También actualizar caché local
        const local = getLocalAnnouncements();
        local.unshift(entry);
        saveLocalAnnouncements(local);
    } else {
        // Solo local
        const local = getLocalAnnouncements();
        local.unshift(entry);
        saveLocalAnnouncements(local);
    }

    closeModal('announcementModal');
    ['annTitle','annBody'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadAnnouncements();
}

async function deleteAnnouncement(id, source) {
    if (!confirm('¿Eliminar este anuncio?')) return;

    if (source === 'cloud' && isFirebaseReady()) {
        try {
            await window.deleteDoc(window.fsDoc(window.db, 'announcements', id));
        } catch (err) {
            console.warn('No se pudo eliminar de Firestore:', err);
        }
    }

    // Siempre limpiar del caché local también
    saveLocalAnnouncements(getLocalAnnouncements().filter(a => a.id !== id));
    loadAnnouncements();
}

async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    if (!container) return;
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></div><div class="empty-state-text">Cargando...</div></div>`;

    if (!isFirebaseReady()) {
        // Modo local
        setAnnMode('local');
        const local = getLocalAnnouncements();
        renderAnnouncementItems(local, 'local');
        return;
    }

    // Modo Firestore
    setAnnMode('cloud');
    try {
        const snap = await window.getDocs(window.collection(window.db, 'announcements'));
        const docs = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Actualizar caché local con datos de Firestore
        saveLocalAnnouncements(docs);
        renderAnnouncementItems(docs, 'cloud');
    } catch (err) {
        console.warn('Error leyendo Firestore, usando caché local:', err);
        setAnnMode('local');
        const local = getLocalAnnouncements();
        renderAnnouncementItems(local, 'local');
    }
}

/* ═══════════════════════════════════════════════════════
   8. PERSONAL (Firestore — todos con rol staff)
═══════════════════════════════════════════════════════ */
const ROLE_COLORS = {
    founder_ceo:   { bg: 'rgba(241,196,15,0.12)',  border: 'rgba(241,196,15,0.4)',  color: '#f1c40f' },
    director:      { bg: 'rgba(255,0,0,0.1)',      border: 'rgba(255,0,0,0.4)',     color: '#ff0000' },
    administrador: { bg: 'rgba(241,196,15,0.1)',   border: 'rgba(241,196,15,0.4)',  color: '#f1c40f' },
    moderador:     { bg: 'rgba(230,126,34,0.1)',   border: 'rgba(230,126,34,0.4)',  color: '#e67e22' },
    programador:   { bg: 'rgba(255,188,0,0.1)',    border: 'rgba(255,188,0,0.4)',   color: '#ffbc00' },
    modelador:     { bg: 'rgba(111,92,255,0.1)',   border: 'rgba(111,92,255,0.4)',  color: '#6f5cff' },
    soporte:       { bg: 'rgba(0,167,21,0.1)',     border: 'rgba(0,167,21,0.4)',    color: '#00a715' },
    creador_contenido: { bg: 'rgba(157,0,255,0.1)', border: 'rgba(157,0,255,0.4)', color: '#9d00ff' },
    vip:           { bg: 'rgba(255,125,223,0.1)',  border: 'rgba(255,125,223,0.4)', color: '#ff7ddf' },
    usuario:       { bg: 'rgba(0,85,255,0.08)',    border: 'rgba(0,85,255,0.3)',    color: '#0055ff' },
};
const ROLE_LABELS_DEV = {
    founder_ceo:'<i class="fa-solid fa-crown" aria-hidden="true"></i> Fundador / CEO', director:'<i class="fa-solid fa-user-tie" aria-hidden="true"></i> Director', administrador:'<i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Administrador',
    moderador:'<i class="fa-solid fa-gavel" aria-hidden="true"></i> Moderador', programador:'<i class="fa-solid fa-code" aria-hidden="true"></i> Programador', modelador:'<i class="fa-solid fa-cube" aria-hidden="true"></i> Modelador',
    soporte:'<i class="fa-solid fa-headset" aria-hidden="true"></i> Soporte', creador_contenido:'<i class="fa-solid fa-photo-film" aria-hidden="true"></i> Creador de Contenido',
    vip:'<i class="fa-solid fa-star" aria-hidden="true"></i> VIP', usuario:'<i class="fa-solid fa-user" aria-hidden="true"></i> Usuario'
};

async function loadStaffList() {
    const container = document.getElementById('staffAdminList');
    if (!container) return;
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></div><div class="empty-state-text">Cargando personal...</div></div>`;

    if (!window.db || !window.collection || !window.getDocs) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div><div class="empty-state-text">Firebase no disponible.</div></div>`;
        return;
    }

    const R = window.PanterRoles || null;
    const rowIds = row => [row && row.uid, row && row.id, row && row.discordId, row && row.discord_id, row && row.discordUserId]
        .filter(Boolean)
        .map(id => String(id));

    try {
        // El roster `equipo` (Panel Admin → Personal) manda sobre el perfil.
        const [equipoSnap, conductoresSnap] = await Promise.all([
            window.getDocs(window.collection(window.db, 'equipo')),
            window.getDocs(window.collection(window.db, 'conductores'))
        ]);
        const roster = equipoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const profiles = conductoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const archived = new Set();
        const seen = new Set();
        const members = [];

        roster.filter(row => row.archivado === true).forEach(row => {
            rowIds(row).forEach(id => archived.add(id));
        });

        roster.filter(row => row.archivado !== true).forEach(row => {
            const normalized = R ? R.normalize(row.role) : String(row.role || '').trim().toLowerCase();
            members.push({
                id: row.uid || row.id,
                name: row.nombre || row.username || row.displayName || 'Sin nombre',
                email: row.email || '',
                role: normalized,
                avatar: row.avatarUrl || row.avatar || ''
            });
            rowIds(row).forEach(id => seen.add(id));
        });

        profiles.forEach(row => {
            const ids = rowIds(row);
            if (ids.some(id => seen.has(id) || archived.has(id))) return;
            // `conductores.role` ya no otorga rango. Sólo se lista un perfil sin
            // ficha en `equipo` cuando pertenece al correo oficial del Director.
            const isDirector = Boolean(
                R && typeof R.roleForEmail === 'function' &&
                R.roleForEmail(row.email) === 'director'
            );
            if (!isDirector) return;
            members.push({
                id: row.id,
                name: row.username || row.displayName || row.nombre || 'Sin nombre',
                email: row.email || '',
                role: 'director',
                avatar: row.avatar || row.avatarUrl || ''
            });
            ids.forEach(id => seen.add(id));
        });

        members.sort((a, b) => {
            const ra = R ? R.rank(a.role) : 0;
            const rb = R ? R.rank(b.role) : 0;
            if (ra !== rb) return rb - ra;
            return String(a.name).localeCompare(String(b.name), 'es');
        });

        if (!members.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-users" aria-hidden="true"></i></div><div class="empty-state-text">No hay miembros de staff en la base de datos.</div></div>`;
            return;
        }

        container.innerHTML = members.map(m => {
            const roleDef = R ? R.get(m.role) : null;
            const rc = roleDef
                ? { bg: roleDef.bg, border: roleDef.border, color: roleDef.color }
                : (ROLE_COLORS[m.role] || { bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.1)', color:'#94a3b8' });
            const rl = roleDef ? roleDef.label : (ROLE_LABELS_DEV[m.role] || m.role);
            const initials = m.name.split(' ').map(w => w[0]?.toUpperCase()).slice(0,2).join('');
            return `
            <div class="staff-admin-row">
                <div class="staff-admin-avatar">${m.avatar || initials || '<i class="fa-solid fa-user" aria-hidden="true"></i>'}</div>
                <div class="staff-admin-info">
                    <div class="staff-admin-name">${m.name}</div>
                    <div class="staff-admin-email">${m.email}</div>
                </div>
                <span class="staff-admin-role-badge" style="background:${rc.bg}; border-color:${rc.border}; color:${rc.color};">${rl}</span>
            </div>`;
        }).join('');
    } catch (err) {
        console.error('Error cargando personal:', err);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i></div><div class="empty-state-text">Error al cargar personal.</div></div>`;
    }
}

/* ═══════════════════════════════════════════════════════
   TAB HOOKS — extender el sistema de tabs existente
═══════════════════════════════════════════════════════ */
// Hook into tab switch
document.querySelectorAll('.sidebar-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        // Trigger dev-tools renders on first open
        if (tab === 'roadmap') renderKanban();
        if (tab === 'ideas') renderIdeas();
        if (tab === 'changelog') renderChangelog();
        if (tab === 'bugs') renderBugs();
        if (tab === 'assets') renderAssets();
        if (tab === 'notepad') initNotepad();
        if (tab === 'announcements') loadAnnouncements();
        // La pestaña Personal la gestiona por completo admin.js.
    });
});

// Store current user for Firestore writes
window._currentAdminUser = null;
document.addEventListener('psAdminUserReady', e => { window._currentAdminUser = e.detail; });
