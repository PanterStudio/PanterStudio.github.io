/**
 * personal.js — Página Equipo / Personal dinámica
 * Panter Studio · Firestore + roles + badges
 *
 * Fuente de datos:
 *   1) colección `equipo` (editable desde el Panel Admin)
 *   2) perfiles de `conductores` con rol de staff
 *   3) fallback local con el equipo fundador (si Firestore no responde)
 */
(function () {
    'use strict';

    const TEAM_LEVELS = [
        { number: 1, title: 'Fundación y dirección', subtitle: 'Liderazgo del estudio', roles: ['admin_owner', 'founder_ceo', 'director'] },
        { number: 2, title: 'Administración', subtitle: 'Gestión y operaciones', roles: ['administrador'] },
        { number: 3, title: 'Moderación', subtitle: 'Cuidado de la comunidad', roles: ['moderador'] },
        { number: 4, title: 'Desarrollo y diseño', subtitle: 'Construcción de proyectos', roles: ['programador', 'modelador'] },
        { number: 5, title: 'Comunidad y soporte', subtitle: 'Atención, contenido y miembros', roles: ['soporte', 'creador_contenido', 'vip', 'usuario'] }
    ];

    const SEED_TEAM = [
        {
            uid: 'seed-pantergamey',
            nombre: 'PanterGameYT',
            username: 'PanterGameY',
            role: 'founder_ceo',
            especialidad: 'Dirección Creativa',
            descripcion: 'Fundador de Panter Studio y líder general. Responsable de la visión creativa, el diseño conceptual y la dirección ejecutiva de todos los proyectos.',
            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
            estado: 'online',
            orden: 1
        },
        {
            uid: 'seed-dayjho',
            nombre: 'Dayjho',
            username: 'Dayjho',
            role: 'director',
            especialidad: 'Supervisión Técnica',
            descripcion: 'Director principal del proyecto "Nuestra Tierra Job Simulator". Encargado del diseño de jugabilidad, mecánicas interactivas y supervisión del equipo.',
            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
            estado: 'online',
            orden: 2
        },
        {
            uid: 'seed-fenix',
            nombre: 'Fenix',
            username: 'Fenix',
            role: 'administrador',
            especialidad: 'Roles, Bots & Discord',
            descripcion: 'Administrador General de Panter Studio. Encargado de la infraestructura del servidor de Discord: bots, roles, integraciones automáticas y experiencia de comunidad.',
            avatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png',
            estado: 'online',
            orden: 3
        }
    ];

    let allMembers = [];
    let activeFilter = 'all';
    let currentUser = null;
    let currentProfile = null;
    let canEdit = false;
    let firestoreSubscriptions = [];
    let liveEquipoRows = null;
    let liveProfileRows = null;
    let liveFeedReady = { equipo: false, perfiles: false };
    let realtimeStarted = false;

    function getRoles() { return window.PanterRoles || null; }
    function esc(v) { const r = getRoles(); return r ? r.escapeHtml(v) : String(v == null ? '' : v); }

    function getDb() {
        return window.db && window.collection && window.getDocs ? window : null;
    }

    function waitForFirestore(timeout) {
        return new Promise(resolve => {
            const start = Date.now();
            const ready = () => Boolean(getDb());
            if (ready()) return resolve(true);
            const timer = setInterval(() => {
                if (ready()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - start >= (timeout || 6000)) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 150);
        });
    }

    function normalizeMember(raw, source, allowAnyRole) {
        if (raw && raw.archivado === true) return null;
        const R = getRoles();
        const role = R ? R.normalize(raw.role || raw.roleEquipo || raw.rango || 'usuario') : (raw.role || 'usuario');
        if (R && !allowAnyRole && !R.isTeamRole(role)) return null;

        const name = raw.nombre || raw.displayName || raw.nombre_usuario || raw.username || raw.name || 'Miembro del equipo';
        const avatarUrl = raw.avatarImg || raw.avatarUrl || raw.discordAvatarUrl || raw.photoURL || raw.foto || buildDiscordAvatar(raw) || '';
        const specialty = raw.especialidad || raw.staffSpecialty || raw.specialty || raw.staffTitle || 'Equipo Panter Studio';
        const description = raw.descripcion || raw.staffDescription || raw.descripcionEquipo || raw.bio || 'Miembro del equipo de Panter Studio.';
        const status = resolveStatus(raw);

        const secondary = Array.isArray(raw.insignias)
            ? raw.insignias
            : (raw.insignia ? [raw.insignia] : []);

        return {
            uid: raw.uid || raw.id || raw.discordId || `team_${String(name).toLowerCase().replace(/\s+/g, '_')}`,
            nombre: name,
            username: raw.username || '',
            role,
            roleDef: R ? R.get(role) : null,
            especialidad: specialty,
            descripcion: description,
            avatarUrl,
            status,
            insignias: secondary,
            orden: Number(raw.orden || raw.order || 999),
            source: source || 'conductores',
            raw
        };
    }

    function buildDiscordAvatar(raw) {
        const id = raw.discordId || raw.id || raw.discord_id;
        const hash = raw.discordAvatar || raw.avatar;
        if (!id) return '';
        if (/^\d{5,}$/.test(String(id)) && hash) {
            const ext = String(hash).startsWith('a_') ? 'gif' : 'png';
            return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=256`;
        }
        if (/^\d{5,}$/.test(String(id))) {
            try {
                const index = Number((BigInt(id) >> 22n) % 6n);
                return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
            } catch (e) { /* ignore */ }
        }
        return '';
    }

    function resolveStatus(member) {
        const raw = String(member.estado || member.status || member.presence || '').toLowerCase();
        if (['online', 'en linea', 'en línea', 'activo', 'active', 'conectado'].includes(raw)) return 'online';
        if (['offline', 'desconectado', 'inactivo', 'inactive', 'ausente'].includes(raw)) return 'offline';
        if (member.online === true || member.enLinea === true) return 'online';
        if (member.online === false || member.enLinea === false) return 'offline';
        const lastSeen = member.lastSeen || member.ultimaConexion || member.updatedAt;
        if (lastSeen) {
            const ts = new Date(lastSeen).getTime();
            if (!isNaN(ts) && Date.now() - ts < 5 * 60 * 1000) return 'online';
        }
        return 'offline';
    }

    async function fetchCollection(name) {
        if (!getDb() || !window.fsDoc) return [];
        try {
            const snap = await window.getDocs(window.collection(window.db, name));
            return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
        } catch (e) {
            console.warn(`[Personal] No se pudo leer ${name}:`, e.message);
            return [];
        }
    }

    async function loadFromFirestore() {
        // Roster explícito (`equipo`) + perfiles de staff (`conductores`).
        // El roster manda cuando un miembro existe en ambas colecciones.
        const [rosterRows, profileRows] = await Promise.all([
            fetchCollection('equipo'),
            fetchCollection('conductores')
        ]);
        return combineRosterAndProfiles(rosterRows, profileRows);
    }

    function avatarHtml(member) {
        if (member.avatarUrl) {
            return `<img src="${esc(member.avatarUrl)}" alt="Avatar de ${esc(member.nombre)}" loading="lazy" decoding="async" data-ps-avatar>`;
        }
        const R = getRoles();
        const icon = R ? R.get(member.role).icon : 'fa-solid fa-user';
        const initial = esc(String(member.nombre || 'P').trim().charAt(0).toUpperCase());
        return `<span class="ps-avatar-fallback" data-initial="${initial}"><i class="${icon}" aria-hidden="true"></i></span>`;
    }

    function buildCard(member, index) {
        const R = getRoles();
        const roleDef = R ? R.get(member.role) : { label: member.role, icon: 'fa-solid fa-user', color: '#0055ff' };
        const online = member.status === 'online';
        const statusText = online ? 'En línea' : 'Offline';
        const roleBadge = R ? R.badgeHtml(member.role, { className: 'ps-role-badge-team' }) : '';
        const cardStyle = `--ps-staff-color:${roleDef.color};--ps-staff-border:${roleDef.border || roleDef.color};--ps-staff-bg:${roleDef.bg || 'transparent'};--card-index:${index};`;

        return `
            <article class="staff-card ps-staff-card" style="${cardStyle}" data-role="${esc(member.role)}" data-uid="${esc(member.uid)}">
                <div class="avatar-frame ps-staff-avatar">
                    ${avatarHtml(member)}
                    <span class="ps-presence ${online ? 'online' : 'offline'}" title="${statusText}" aria-label="${statusText}" data-status="${member.status}"></span>
                </div>
                <div class="ps-staff-card-content">
                    <h2 class="staff-name">${esc(member.nombre)}</h2>
                    <div class="staff-title" title="${esc(member.especialidad)}">${esc(member.especialidad)}</div>
                </div>
                <div class="staff-badge-group" title="${esc(roleDef.label)}">
                    ${roleBadge}
                </div>
                ${canEdit ? `<button type="button" class="ps-staff-edit-btn" data-edit-staff="${esc(member.uid)}"><i class="fa-solid fa-pen-to-square"></i> Editar descripción</button>` : ''}
            </article>`;
    }

    function buildRoleBranch(roleId, members, index) {
        const R = getRoles();
        if (!R || !members.length) return '';
        const def = R.get(roleId);
        const countLabel = members.length === 1 ? '1 miembro' : `${members.length} miembros`;

        return `
            <section class="ps-role-branch" data-rank-role="${esc(def.id)}"
                style="--ps-branch-color:${def.color};--branch-index:${index};">
                <header class="ps-branch-heading">
                    <span class="ps-branch-icon" aria-hidden="true"><i class="${def.icon}"></i></span>
                    <span class="ps-branch-name">${esc(def.label)}</span>
                    <span class="ps-branch-count">${countLabel}</span>
                </header>
                <div class="ps-branch-members">
                    ${members.map((member, cardIndex) => buildCard(member, cardIndex)).join('')}
                </div>
            </section>`;
    }

    function render() {
        const grid = document.getElementById('staffGrid');
        if (!grid) return;

        const R = getRoles();
        const filtered = activeFilter === 'all'
            ? allMembers
            : allMembers.filter(m => m.role === activeFilter);

        if (!filtered.length) {
            grid.innerHTML = `
                <div class="ps-team-empty">
                    <i class="fa-solid fa-users-slash"></i>
                    <strong>No hay miembros en esta categoría.</strong>
                    <p>El equipo aparecerá aquí cuando un administrador asigne el rol correspondiente.</p>
                </div>`;
            return;
        }

        const groups = new Map();
        filtered.forEach(member => {
            if (!groups.has(member.role)) groups.set(member.role, []);
            groups.get(member.role).push(member);
        });

        const knownRoles = new Set(TEAM_LEVELS.flatMap(level => level.roles));
        const tiers = TEAM_LEVELS.map(level => {
            const orderedRoles = R
                ? R.orderedRoleIds(level.roles.filter(roleId => groups.has(roleId)))
                : level.roles.filter(roleId => groups.has(roleId));
            const levelMembers = orderedRoles.reduce((total, roleId) => total + groups.get(roleId).length, 0);
            if (!levelMembers) return '';

            const firstRole = orderedRoles[0];
            const levelColor = R && firstRole ? R.get(firstRole).color : '#00b0ff';
            const countLabel = levelMembers === 1 ? '1 miembro' : `${levelMembers} miembros`;
            return `
                <section class="ps-level" data-level="${level.number}" style="--ps-level-color:${levelColor};">
                    <header class="ps-level-heading">
                        <span class="ps-level-number">0${level.number}</span>
                        <span class="ps-level-title">
                            <strong>${esc(level.title)}</strong>
                            <small>${esc(level.subtitle)} · ${countLabel}</small>
                        </span>
                    </header>
                    <div class="ps-level-branches">
                        ${orderedRoles.map((roleId, index) => buildRoleBranch(roleId, groups.get(roleId), index)).join('')}
                    </div>
                </section>`;
        }).join('');

        const customRoles = R
            ? R.orderedRoleIds(Array.from(groups.keys()).filter(roleId => !knownRoles.has(roleId)))
            : Array.from(groups.keys()).filter(roleId => !knownRoles.has(roleId));
        const customTier = customRoles.length
            ? `<section class="ps-level" data-level="5"><header class="ps-level-heading"><span class="ps-level-number">05</span><span class="ps-level-title"><strong>Otros rangos</strong><small>Roles adicionales de la comunidad</small></span></header><div class="ps-level-branches">${customRoles.map((roleId, index) => buildRoleBranch(roleId, groups.get(roleId), index)).join('')}</div></section>`
            : '';

        grid.innerHTML = tiers + customTier;
    }

    function renderFilters() {
        const toolbar = document.getElementById('teamFilters');
        if (!toolbar) return;
        const R = getRoles();
        if (!R) return;

        const present = new Set(allMembers.map(m => m.role));
        const roles = R.orderedRoleIds(Array.from(present));

        const buttons = roles.map(role => {
            const def = R.get(role);
            const count = allMembers.filter(m => m.role === role).length;
            return `<button type="button" class="ps-team-filter${activeFilter === role ? ' active' : ''}" data-filter-role="${role}">
                <i class="${def.icon}" aria-hidden="true"></i> ${esc(def.label)}
                <span class="ps-team-count">${count}</span>
            </button>`;
        }).join('');

        toolbar.innerHTML = `
            <button type="button" class="ps-team-filter${activeFilter === 'all' ? ' active' : ''}" data-filter-role="all">
                <i class="fa-solid fa-users" aria-hidden="true"></i> Todos
                <span class="ps-team-count">${allMembers.length}</span>
            </button>
            ${buttons}`;

        toolbar.querySelectorAll('[data-filter-role]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilter = btn.dataset.filterRole;
                renderFilters();
                render();
            });
        });
    }

    function setLoading(isLoading) {
        const grid = document.getElementById('staffGrid');
        if (!grid) return;
        if (isLoading && !grid.dataset.loaded) {
            grid.innerHTML = `
                <div class="ps-team-empty">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    <strong>Cargando equipo…</strong>
                    <p>Sincronizando miembros y roles desde Firestore.</p>
                </div>`;
        }
    }

    async function resolveCanEdit() {
        if (!window.DiscordAuth) return false;
        currentUser = window.DiscordAuth.getUser();
        if (!currentUser) return false;
        const R = getRoles();
        if (R && (currentUser.discordAdmin || currentUser.isAdmin)) {
            // isAdmin puede venir de sesión antigua; se confirma con el perfil cuando sea posible.
            if (currentUser.discordAdmin) return true;
        }
        if (getDb() && window.fsDoc && window.getDoc) {
            try {
                const snap = await window.getDoc(window.fsDoc(window.db, 'conductores', currentUser.uid));
                if (snap && snap.exists()) currentProfile = snap.data();
            } catch (e) { console.warn('[Personal] No se pudo cargar el perfil del editor:', e.message); }
        }
        const role = R ? R.resolveRole(currentUser, currentProfile) : (currentUser.role || 'usuario');
        return R ? R.canManageTeam(role) : false;
    }

    function findMember(uid) {
        return allMembers.find(m => String(m.uid) === String(uid)) || null;
    }

    function showToast(message) {
        let el = document.getElementById('psTeamToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'psTeamToast';
            el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);z-index:9999;padding:11px 18px;border-radius:12px;background:rgba(9,13,23,.96);border:1px solid rgba(0,176,255,.35);color:#7dd3fc;font-size:.82rem;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,.5);opacity:0;transition:all .25s ease;pointer-events:none;max-width:90vw;text-align:center;';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2600);
    }

    function openEditor(card, member) {
        if (!card || !member) return;
        const existing = card.querySelector('.ps-staff-editor');
        if (existing) { existing.remove(); return; }

        const editor = document.createElement('div');
        editor.className = 'ps-staff-editor';
        editor.innerHTML = `
            <label>Especialidad
                <input type="text" data-edit-specialty maxlength="80" value="${esc(member.especialidad)}">
            </label>
            <label>Descripción
                <textarea data-edit-desc rows="4" maxlength="600">${esc(member.descripcion)}</textarea>
            </label>
            <div class="ps-staff-editor-actions">
                <button type="button" class="ps-btn-mini" data-edit-cancel>Cancelar</button>
                <button type="button" class="ps-btn-mini primary" data-edit-save><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
            </div>`;

        card.appendChild(editor);
        const input = editor.querySelector('[data-edit-specialty]');
        if (input) input.focus();

        editor.querySelector('[data-edit-cancel]').addEventListener('click', () => editor.remove());
        editor.querySelector('[data-edit-save]').addEventListener('click', async () => {
            const specialty = editor.querySelector('[data-edit-specialty]').value.trim();
            const description = editor.querySelector('[data-edit-desc]').value.trim();
            const saveBtn = editor.querySelector('[data-edit-save]');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando';

            try {
                if (!getDb() || !window.setDoc || !window.fsDoc) throw new Error('Firestore no disponible');
                const now = new Date().toISOString();
                const payload = {
                    uid: member.uid,
                    nombre: member.nombre,
                    username: member.username || null,
                    avatarUrl: member.avatarUrl || null,
                    role: member.role,
                    especialidad: specialty,
                    descripcion: description,
                    staffSpecialty: specialty,
                    staffDescription: description,
                    actualizadoEn: now,
                    actualizadoPor: currentUser ? currentUser.uid : null
                };
                await window.setDoc(window.fsDoc(window.db, 'equipo', member.uid), payload, { merge: true });
                // Reflejar también en el perfil del miembro (sin tocar otros campos).
                try {
                    await window.setDoc(window.fsDoc(window.db, 'conductores', member.uid), {
                        staffSpecialty: specialty,
                        staffDescription: description,
                        bio: description,
                        actualizadoEn: now
                    }, { merge: true });
                } catch (e) { console.warn('[Personal] No se pudo actualizar el perfil:', e.message); }

                member.especialidad = specialty;
                member.descripcion = description;
                render();
                showToast('Descripción del equipo actualizada');
            } catch (err) {
                console.error('[Personal] Error guardando miembro:', err);
                showToast('No se pudo guardar. Revisa los permisos de Firestore.');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
            }
        });
    }

    function bindGridEvents() {
        const grid = document.getElementById('staffGrid');
        if (!grid || grid.dataset.bound === 'true') return;
        grid.dataset.bound = 'true';
        grid.addEventListener('click', event => {
            const editBtn = event.target.closest('[data-edit-staff]');
            if (!editBtn || !canEdit) return;
            const card = editBtn.closest('.ps-staff-card');
            const member = findMember(editBtn.dataset.editStaff);
            openEditor(card, member);
        });
        grid.addEventListener('error', event => {
            const img = event.target;
            if (img && img.matches && img.matches('[data-ps-avatar]')) {
                const member = findMember(img.closest('.ps-staff-card')?.dataset.uid);
                const R = getRoles();
                const icon = R && member ? R.get(member.role).icon : 'fa-solid fa-user';
                const wrap = document.createElement('span');
                wrap.className = 'ps-avatar-fallback';
                wrap.innerHTML = `<i class="${icon}" aria-hidden="true"></i>`;
                img.replaceWith(wrap);
            }
        }, true);
    }

    function sortMembers(list) {
        const R = getRoles();
        return list.slice().sort((a, b) => {
            const ra = R ? R.rank(a.role) : 0;
            const rb = R ? R.rank(b.role) : 0;
            if (ra !== rb) return rb - ra;
            if (a.orden !== b.orden) return a.orden - b.orden;
            return String(a.nombre).localeCompare(String(b.nombre), 'es');
        });
    }

    function mergeProfilePresence(teamMember, profile) {
        if (!profile) return teamMember;
        const presenceKeys = ['estado', 'status', 'presence', 'online', 'enLinea', 'lastSeen', 'ultimaConexion'];
        const hasProfilePresence = presenceKeys.some(key => Object.prototype.hasOwnProperty.call(profile, key));
        return Object.assign({}, profile, teamMember, hasProfilePresence ? {
            estado: profile.estado,
            status: profile.status,
            presence: profile.presence,
            online: profile.online,
            enLinea: profile.enLinea,
            lastSeen: profile.lastSeen,
            ultimaConexion: profile.ultimaConexion
        } : {});
    }

    function profileIndex(rows) {
        const index = new Map();
        rows.forEach(row => {
            [row.uid, row.id, row.discordId, row.discord_id, row.discordUserId]
                .filter(Boolean)
                .forEach(id => index.set(String(id), row));
        });
        return index;
    }

    function rowIds(row) {
        return [row && row.uid, row && row.id, row && row.discordId, row && row.discord_id, row && row.discordUserId]
            .filter(Boolean)
            .map(id => String(id));
    }

    /**
     * Combina el roster explícito (`equipo`) con los perfiles de staff de
     * `conductores`. El roster tiene prioridad; las fichas archivadas ocultan
     * al miembro también en los perfiles para que una baja no reaparezca.
     */
    function combineRosterAndProfiles(rosterRows, profileRows) {
        const roster = Array.isArray(rosterRows) ? rosterRows : [];
        const profiles = Array.isArray(profileRows) ? profileRows : [];
        const profileById = profileIndex(profiles);
        const archivedIds = new Set();
        const seen = new Set();
        const members = [];

        roster.filter(row => row && row.archivado === true).forEach(row => {
            rowIds(row).forEach(id => archivedIds.add(id));
        });

        roster.filter(row => row && row.archivado !== true).forEach(row => {
            const ids = rowIds(row);
            const profile = ids.map(id => profileById.get(id)).find(Boolean);
            const member = normalizeMember(mergeProfilePresence(row, profile), 'equipo', true);
            if (!member) return;
            members.push(member);
            ids.forEach(id => seen.add(id));
        });

        const R = getRoles();
        profiles.forEach(row => {
            const ids = rowIds(row);
            if (ids.some(id => seen.has(id) || archivedIds.has(id))) return;
            const member = normalizeMember(row, 'conductores');
            if (!member) return;
            if (R && !R.isTeamRole(member.role)) return;
            members.push(member);
            ids.forEach(id => seen.add(id));
        });

        return members;
    }

    function applyRealtimeMembers() {
        if (!liveFeedReady.equipo || !liveFeedReady.perfiles) return;
        let members = combineRosterAndProfiles(liveEquipoRows || [], liveProfileRows || []);

        if (!members.length) {
            members = SEED_TEAM.map(member => normalizeMember(member, 'seed')).filter(Boolean);
            console.info('[Personal] Firestore no tiene miembros de equipo; se muestra el roster de respaldo.');
        }

        allMembers = sortMembers(members);
        const grid = document.getElementById('staffGrid');
        if (grid) grid.dataset.loaded = 'true';
        if (activeFilter !== 'all' && !allMembers.some(member => member.role === activeFilter)) activeFilter = 'all';
        renderFilters();
        render();
        bindGridEvents();
    }

    function startRealtimeSubscriptions() {
        if (realtimeStarted || !getDb() || typeof window.onSnapshot !== 'function') return false;
        realtimeStarted = true;
        setLoading(true);

        const subscribe = (collectionName, feedName, onRows) => {
            try {
                const unsubscribe = window.onSnapshot(
                    window.collection(window.db, collectionName),
                    snap => {
                        onRows(snap.docs.map(doc => Object.assign({ uid: doc.id }, doc.data())));
                        liveFeedReady[feedName] = true;
                        applyRealtimeMembers();
                    },
                    error => {
                        console.warn(`[Personal] Suscripción no disponible para ${collectionName}; se usará la colección alternativa cuando corresponda:`, error.message);
                        liveFeedReady[feedName] = true;
                        applyRealtimeMembers();
                    }
                );
                if (typeof unsubscribe === 'function') firestoreSubscriptions.push(unsubscribe);
            } catch (error) {
                console.error(`[Personal] No se pudo iniciar la suscripción de ${collectionName}:`, error);
                liveFeedReady[feedName] = true;
            }
        };

        subscribe('equipo', 'equipo', rows => { liveEquipoRows = rows; });
        subscribe('conductores', 'perfiles', rows => { liveProfileRows = rows; });
        return true;
    }

    async function init() {
        const grid = document.getElementById('staffGrid');
        if (!grid) return;
        setLoading(true);

        canEdit = await resolveCanEdit();
        const ready = await waitForFirestore();
        if (ready && startRealtimeSubscriptions()) {
            return;
        }
        if (realtimeStarted) return;
        if (!ready) console.warn('[Personal] Firestore no estuvo disponible antes del tiempo límite.');

        let members = [];
        if (ready) {
            try { members = await loadFromFirestore(); } catch (error) { console.error('[Personal] Error cargando miembros:', error); }
        }
        if (!members.length) members = SEED_TEAM.map(member => normalizeMember(member, 'seed')).filter(Boolean);
        allMembers = sortMembers(members);
        grid.dataset.loaded = 'true';
        renderFilters();
        render();
        bindGridEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    document.addEventListener('firebaseReady', async () => {
        canEdit = await resolveCanEdit();
        if (!startRealtimeSubscriptions()) init();
    }, { once: true });

    document.addEventListener('discordAuthChanged', async () => {
        canEdit = await resolveCanEdit();
        if (allMembers.length) render();
    });

    document.addEventListener('panter:roles-config', () => {
        const R = getRoles();
        if (!R || !allMembers.length) return;
        allMembers = sortMembers(
            allMembers.map(member => normalizeMember(
                member.raw || member,
                member.source,
                member.source === 'equipo'
            )).filter(Boolean)
        );
        if (activeFilter !== 'all' && !allMembers.some(member => member.role === activeFilter)) {
            activeFilter = 'all';
        }
        renderFilters();
        render();
    });
})();
