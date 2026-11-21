/**
 * firebase-config.js — Capa de compatibilidad Firestore → Supabase
 * ─────────────────────────────────────────────────────────────────────────────
 * Todas las páginas cargan este archivo. Expone, de forma SINCRÓNICA y sin
 * dependencias externas (ni CDN, ni import dinámico), la misma API que usaban
 * los módulos construidos sobre Firestore:
 *
 *   db, collection, fsDoc, query, where, orderBy, limit,
 *   getDocs, getDoc, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot,
 *   deleteField, increment, serverTimestamp, arrayUnion, arrayRemove,
 *   writeBatch, PanterRules, firebaseAuth y helpers de Auth.
 *
 * Datos: `public.web_colecciones` (tickets, foro, equipo, presencia, ...)
 *        `public.perfiles` (conductores de Nuestra Tierra, espejo del juego).
 *
 * La sincronización en vivo se hace por polling ligero (4 s) en onSnapshot,
 * de modo que no depende de la publication de Realtime ni de WebSockets.
 */
(function () {
    'use strict';

    if (window.__psDataLayerReady) return;
    window.__psDataLayerReady = true;

    const SUPABASE_URL = 'https://hndlwmvezampajbmpqae.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Cw95N8YDQNhc4zDGTE__Yg_C_Xj0IP4';
    const REST = SUPABASE_URL + '/rest/v1';
    const AUTH = SUPABASE_URL + '/auth/v1';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;

    /* ── Utilidades ────────────────────────────────────────────────────────── */

    function genId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function baseHeaders(extra) {
        const h = {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json'
        };
        return Object.assign(h, extra || {});
    }

    /* Control de concurrencia: varias suscripciones en vivo pueden pedir el
       mismo documento en el mismo tick. Se deduplican peticiones idénticas
       en vuelo y se limita el número de fetches simultáneos para evitar
       ERR_INSUFFICIENT_RESOURCES y la cascada de reintentos. */
    const MAX_REST_CONCURRENCY = 6;
    let restActive = 0;
    const restQueue = [];
    const inflightRest = new Map();

    function acquireRestSlot() {
        if (restActive < MAX_REST_CONCURRENCY) {
            restActive++;
            return Promise.resolve();
        }
        return new Promise(resolve => { restQueue.push(resolve); });
    }
    function releaseRestSlot() {
        if (restQueue.length) {
            const next = restQueue.shift();
            next();
            return;
        }
        restActive = Math.max(0, restActive - 1);
    }

    async function restRequestRaw(method, url, body, prefer) {
        const headers = baseHeaders(prefer ? { 'Prefer': prefer } : null);
        const payload = (body !== undefined && body !== null && method !== 'GET')
            ? JSON.stringify(body)
            : undefined;

        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
            const init = {
                method: method,
                headers: headers,
                mode: 'cors',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            };
            if (payload !== undefined) init.body = payload;
            try {
                try {
                    const res = await fetch(url, init);
                    if (!res.ok) {
                        let detail = '';
                        try { detail = await res.text(); } catch (e) { /* ignore */ }
                        try {
                            const j = JSON.parse(detail);
                            detail = j.message || j.msg || j.error_description || j.error || detail;
                        } catch (e) { /* ignore */ }
                        const err = new Error(detail || ('Supabase HTTP ' + res.status));
                        err.status = res.status;
                        // Los errores 4xx (RLS, validación) no se reintentan.
                        if (res.status >= 400 && res.status < 500) throw err;
                        lastError = err;
                        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                        continue;
                    }
                    if (res.status === 204) return null;
                    const text = await res.text();
                    if (!text) return null;
                    try { return JSON.parse(text); } catch (e) { return text; }
                } catch (e) {
                    if (e && e.status >= 400 && e.status < 500) throw e;
                    lastError = e;
                    if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        }
        const err = new Error('Supabase no disponible: ' + (lastError && lastError.message ? lastError.message : 'sin conexión'));
        err.offline = true;
        throw err;
    }

    async function restRequest(method, url, body, prefer) {
        const key = [method, url, body === undefined ? '' : JSON.stringify(body), prefer || ''].join('|');
        if (inflightRest.has(key)) return inflightRest.get(key);
        const promise = (async () => {
            await acquireRestSlot();
            try {
                return await restRequestRaw(method, url, body, prefer);
            } finally {
                releaseRestSlot();
            }
        })().finally(() => { inflightRest.delete(key); });
        inflightRest.set(key, promise);
        return promise;
    }

    /* ── Mini cliente Supabase (REST + polling) ────────────────────────────── */

    class RestQuery {
        constructor(table, method) {
            this.table = table;
            this.method = method || 'GET';
            this.params = [];
            this.body = undefined;
            this.prefer = 'return=representation';
            this.single = false;
            this._promise = null;
        }
        select(cols) { this.method = 'GET'; this.params.push('select=' + encodeURIComponent(cols || '*')); return this; }
        eq(field, value) { this.params.push(field + '=eq.' + encodeURIComponent(String(value))); return this; }
        neq(field, value) { this.params.push(field + '=neq.' + encodeURIComponent(String(value))); return this; }
        gt(field, value) { this.params.push(field + '=gt.' + encodeURIComponent(String(value))); return this; }
        gte(field, value) { this.params.push(field + '=gte.' + encodeURIComponent(String(value))); return this; }
        lt(field, value) { this.params.push(field + '=lt.' + encodeURIComponent(String(value))); return this; }
        lte(field, value) { this.params.push(field + '=lte.' + encodeURIComponent(String(value))); return this; }
        or(expr) { this.params.push('or=' + encodeURIComponent('(' + expr + ')')); return this; }
        in(field, values) { this.params.push(field + '=in.(' + (values || []).map(v => encodeURIComponent(String(v))).join(',') + ')'); return this; }
        order(field, opts) {
            const dir = opts && opts.ascending === false ? 'desc' : 'asc';
            this.params.push('order=' + encodeURIComponent(field + '.' + dir));
            return this;
        }
        limit(n) { this.params.push('limit=' + Number(n)); return this; }
        maybeSingle() { this.single = true; return this; }
        single() { this.single = true; return this; }
        update(body) { this.method = 'PATCH'; this.body = body; return this; }
        insert(body) { this.method = 'POST'; this.body = body; return this; }
        upsert(body, opts) {
            this.method = 'POST';
            this.body = body;
            if (opts && opts.onConflict) this.params.push('on_conflict=' + encodeURIComponent(opts.onConflict));
            this.prefer = 'resolution=merge-duplicates,return=representation';
            return this;
        }
        delete() { this.method = 'DELETE'; this.prefer = 'return=minimal'; return this; }
        then(resolve, reject) { return this.execute().then(resolve, reject); }
        catch(fn) { return this.execute().catch(fn); }
        finally(fn) { return this.execute().finally(fn); }
        execute() {
            if (this._promise) return this._promise;
            const qs = this.params.length ? '?' + this.params.join('&') : '';
            const url = REST + '/' + encodeURIComponent(this.table) + qs;
            this._promise = restRequest(this.method, url, this.body, this.prefer)
                .then((data) => {
                    if (this.single) {
                        const row = Array.isArray(data) ? (data[0] || null) : (data || null);
                        return { data: row, error: null };
                    }
                    return { data: data === null ? [] : data, error: null };
                })
                .catch((err) => ({ data: null, error: err }));
            return this._promise;
        }
    }

    // Un único ticker para todos los canales: una sola fuente de sondeo.
    // Las emisiones se escalonan para que todas las suscripciones NO consulten
    // Supabase en el mismo instante (eso era lo que saturaba la web y hacía
    // que los tickets tardaran en crearse o que la pestaña se colgara).
    const channels = new Set();
    let channelTimer = null;
    let channelCursor = 0;
    function startChannelTicker() {
        if (channelTimer) return;
        channelTimer = setInterval(() => {
            const active = Array.from(channels).filter((ch) => ch.active);
            if (!active.length) return;
            const batch = Math.max(1, Math.ceil(active.length / 4));
            const payload = { eventType: '*', new: {}, old: {} };
            for (let i = 0; i < batch; i++) {
                const ch = active[(channelCursor + i) % active.length];
                ch.callbacks.forEach((cb) => { try { cb(payload); } catch (e) { /* ignore */ } });
            }
            channelCursor = (channelCursor + batch) % active.length;
        }, 1000);
    }

    class RestChannel {
        constructor(name) {
            this.name = name;
            this.callbacks = [];
            this.active = false;
        }
        on(type, filter, cb) {
            if (typeof filter === 'function') { cb = filter; }
            if (typeof cb === 'function') this.callbacks.push(cb);
            return this;
        }
        subscribe() {
            this.active = true;
            channels.add(this);
            startChannelTicker();
            return this;
        }
        unsubscribe() {
            this.active = false;
            channels.delete(this);
            return this;
        }
    }

    const authClient = {
        async signOut() {
            try { await restRequest('POST', AUTH + '/logout', {}, null); } catch (e) { /* ignore */ }
            return { error: null };
        },
        async signInWithOAuth(options) {
            const provider = options && options.provider ? options.provider : 'discord';
            if (provider === 'discord' && window.DiscordAuth && window.DiscordAuth.login) {
                return window.DiscordAuth.login();
            }
            return { error: new Error('Proveedor no disponible') };
        },
        async signInWithPassword(credentials) {
            return restRequest('POST', AUTH + '/token?grant_type=password', credentials, null)
                .then((data) => ({ data: { user: data && data.user ? data.user : null, session: data }, error: null }))
                .catch((error) => ({ data: null, error }));
        },
        async signUp(credentials) {
            return restRequest('POST', AUTH + '/signup', credentials, null)
                .then((data) => ({ data: { user: data && data.user ? data.user : null }, error: null }))
                .catch((error) => ({ data: null, error }));
        },
        async resetPasswordForEmail(email) {
            return restRequest('POST', AUTH + '/recover', { email: email }, null)
                .then(() => ({ error: null }))
                .catch((error) => ({ error }));
        },
        async updateUser(options) {
            return restRequest('PUT', AUTH + '/user', (options && options.data) || {}, null)
                .then((data) => ({ data: { user: data }, error: null }))
                .catch((error) => ({ data: null, error }));
        },
        async getUser() {
            return restRequest('GET', AUTH + '/user', null, null)
                .then((data) => ({ data: { user: data }, error: null }))
                .catch((error) => ({ data: null, error }));
        },
        onAuthStateChange() {
            return { data: { subscription: { unsubscribe() {} } } };
        }
    };

    const supabase = {
        from(table) { return new RestQuery(table, 'GET'); },
        channel(name) { return new RestChannel(name || genId()); },
        removeChannel(channel) { if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe(); },
        auth: authClient
    };

    window.supabaseClient = supabase;

    /* ── Mapeo perfiles (juego) ↔ conductores (web) ───────────────────────── */

    function getNestedValue(obj, path) {
        if (!obj || !path) return undefined;
        const parts = String(path).split('.');
        let cur = obj;
        for (const p of parts) {
            if (cur == null || typeof cur !== 'object') return undefined;
            cur = cur[p];
        }
        return cur;
    }

    function applyDotUpdates(base, updates) {
        const out = { ...(base || {}) };
        for (const [k, v] of Object.entries(updates || {})) {
            if (k.includes('.')) {
                const parts = k.split('.');
                let cur = out;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
                    else cur[parts[i]] = { ...cur[parts[i]] };
                    cur = cur[parts[i]];
                }
                cur[parts[parts.length - 1]] = v;
            } else {
                out[k] = v;
            }
        }
        return out;
    }

    // Resuelve marcadores compatibles con Firestore antes de escribir en JSON.
    function resolveValue(value, current) {
        if (value && value.__sentinel === 'deleteField') return DELETE_FIELD;
        if (value && value.__sentinel === 'increment') {
            const prev = Number(current);
            return (Number.isFinite(prev) ? prev : 0) + Number(value.amount || 0);
        }
        if (value && value.__sentinel === 'serverTimestamp') return new Date().toISOString();
        if (value && value.__sentinel === 'arrayUnion') {
            const arr = Array.isArray(current) ? current.slice() : [];
            (value.values || []).forEach(v => { if (!arr.some(x => JSON.stringify(x) === JSON.stringify(v))) arr.push(v); });
            return arr;
        }
        if (value && value.__sentinel === 'arrayRemove') {
            const arr = Array.isArray(current) ? current.slice() : [];
            return arr.filter(x => !(value.values || []).some(v => JSON.stringify(x) === JSON.stringify(v)));
        }
        return value;
    }

    // Devuelve un objeto sin las claves marcadas para borrado.
    function cleanForWrite(data, existing) {
        const out = {};
        for (const [k, v] of Object.entries(data || {})) {
            if (v && v.__sentinel === 'deleteField') continue;
            out[k] = resolveValue(v, existing ? existing[k] : undefined);
        }
        return out;
    }

    function mapPerfilRowToWeb(row) {
        if (!row) return null;
        const webData = (row.web_data && typeof row.web_data === 'object') ? row.web_data : {};
        const id = row.web_uid || row.id;
        const nombre = row.nombre || webData.nombre_usuario || webData.username || webData.displayName || row.discord_usuario || '';
        const avatarUrl = row.avatar_url || webData.avatarUrl || webData.avatarImg || webData.photoURL || '';
        return {
            ...webData,
            id,
            uid: id,
            supabaseId: row.id,
            numero_id: Number(row.numero_id || 0),
            nombre_usuario: nombre,
            username: webData.username || row.discord_usuario || nombre,
            displayName: webData.displayName || nombre,
            email: row.correo || webData.email || '',
            correo: row.correo || webData.email || '',
            discord_usuario: row.discord_usuario || webData.discord_usuario || '',
            discordUsername: row.discord_usuario || webData.discordUsername || '',
            discordId: row.discord_id || webData.discordId || null,
            proveedor: row.proveedor || webData.proveedor || '',
            coins: Number(row.monedas ?? webData.coins ?? 0),
            saldo: Number(row.monedas ?? webData.saldo ?? 0),
            dinero: Number(row.monedas ?? webData.dinero ?? 0),
            esmeraldas: Number(row.esmeraldas ?? webData.esmeraldas ?? 0),
            emeralds: Number(row.esmeraldas ?? webData.emeralds ?? 0),
            nivel: Number(row.nivel ?? webData.nivel ?? 0),
            experiencia: Number(row.experiencia ?? webData.experiencia ?? 0),
            pase_elite_activo: Boolean(row.pase_elite_activo ?? webData.pase_elite_activo),
            pase_elite_desde: row.pase_elite_desde || webData.pase_elite_desde || '',
            pase_elite_ultimo_reclamo: row.pase_elite_ultimo_reclamo || webData.pase_elite_ultimo_reclamo || '',
            pase_elite_dias_reclamados: Number(row.pase_elite_dias_reclamados ?? webData.pase_elite_dias_reclamados ?? 0),
            vehiculos_comprados: row.vehiculos_comprados || webData.vehiculos_comprados || {},
            vehiculos_personalizados: row.vehiculos_personalizados || webData.vehiculos_personalizados || {},
            licencias: row.licencias || webData.licencias || {},
            role: row.role || webData.role || 'usuario',
            avatar: webData.avatar || '😊',
            avatarUrl,
            avatarImg: avatarUrl,
            photoURL: avatarUrl,
            betaTesterStatus: row.beta_tester_status || webData.betaTesterStatus || '',
            updatedAt: row.actualizado_en || webData.updatedAt || '',
            _source: 'perfiles'
        };
    }

    function splitWebPayloadForPerfil(payload, existingRow) {
        const prevWeb = (existingRow && existingRow.web_data && typeof existingRow.web_data === 'object') ? existingRow.web_data : {};
        const webData = { ...prevWeb, ...payload };
        delete webData.uid;
        delete webData.discordId;
        delete webData.avatarUrl;
        delete webData.avatarImg;
        delete webData.photoURL;
        const patch = {
        actualizado_en: new Date().toISOString(),
        web_data: webData
    };

        if (payload.uid && !UUID_RE.test(payload.uid)) patch.web_uid = String(payload.uid);
        if (payload.discordId != null) patch.discord_id = String(payload.discordId);
        if (payload.email != null || payload.correo != null) patch.correo = String(payload.email || payload.correo);
        if (payload.discord_usuario != null || payload.discordUsername != null || payload.username != null) {
            const du = payload.discord_usuario ?? payload.discordUsername ?? payload.username;
            if (du) patch.discord_usuario = String(du);
        }
        if (!existingRow || !existingRow.nombre) {
            const n = payload.displayName || payload.nombre_usuario || payload.username;
            if (n) patch.nombre = String(n);
        }
        if (payload.role != null) patch.role = String(payload.role);
        if (payload.avatarUrl != null || payload.avatarImg != null || payload.photoURL != null) {
            patch.avatar_url = String(payload.avatarUrl || payload.avatarImg || payload.photoURL);
        }
        if (payload.betaTesterStatus != null) patch.beta_tester_status = String(payload.betaTesterStatus);
        if (payload.coins !== undefined || payload.monedas !== undefined || payload.saldo !== undefined) {
            const val = Number(payload.monedas ?? payload.coins ?? payload.saldo);
            if (Number.isFinite(val)) patch.monedas = Math.trunc(val);
        }
        if (payload.esmeraldas !== undefined || payload.emeralds !== undefined) {
            const val = Number(payload.esmeraldas ?? payload.emeralds);
            if (Number.isFinite(val)) patch.esmeraldas = Math.trunc(val);
        }
        return patch;
    }

    async function findPerfilRow(id, hints) {
        hints = hints || {};
        const filters = [];
        if (id && UUID_RE.test(id)) filters.push(`id.eq.${id}`);
        if (id) filters.push(`web_uid.eq.${id}`);
        const dId = hints.discordId || (String(id || '').startsWith('discord_') ? String(id).slice(8) : null);
        if (dId) filters.push(`discord_id.eq.${dId}`);
        const email = hints.email || hints.correo;
        if (email) filters.push(`correo.ilike.${email}`);
        const dUser = hints.discord_usuario || hints.discordUsername || hints.username;
        if (dUser) filters.push(`discord_usuario.ilike.${dUser}`);

        if (filters.length === 0) return null;
        const { data, error } = await supabase.from('perfiles').select('*').or(filters.join(',')).limit(1);
        if (error || !Array.isArray(data) || data.length === 0) return null;
        return data[0];
    }

    /* ── Referencias y snapshots compatibles ───────────────────────────────── */

    function makeDocRef(collectionName, id) {
        return {
            __type: 'doc',
            collection: collectionName,
            id: id || genId(),
            path: `${collectionName}/${id || ''}`
        };
    }

    function makeSnapshot(docRef, data) {
        const exists = data !== null && data !== undefined;
        return {
            id: docRef.id,
            ref: docRef,
            exists: () => exists,
            data: () => (exists ? { ...data } : undefined)
        };
    }

    function makeQuerySnapshot(items, collectionName) {
        const docs = items.map((item) => {
            const ref = makeDocRef(collectionName, item.id);
            const payload = { ...item };
            return {
                id: item.id,
                ref,
                exists: () => true,
                data: () => ({ ...payload })
            };
        });
        return {
            docs,
            empty: docs.length === 0,
            size: docs.length,
            forEach: (cb) => docs.forEach((d) => cb(d))
        };
    }

    function matchesConstraint(item, c) {
        if (!c || c.__type !== 'where') return true;
        const val = getNestedValue(item, c.field);
        switch (c.op) {
            case '==': return val === c.value;
            case '!=': return val !== c.value;
            case '<': return val < c.value;
            case '<=': return val <= c.value;
            case '>': return val > c.value;
            case '>=': return val >= c.value;
            case 'in': return Array.isArray(c.value) && c.value.includes(val);
            case 'array-contains': return Array.isArray(val) && val.includes(c.value);
            case 'array-contains-any': return Array.isArray(val) && Array.isArray(c.value) && c.value.some((v) => val.includes(v));
            default: return true;
        }
    }

    function applyConstraints(items, constraints) {
        let result = items.slice();
        const wheres = constraints.filter((c) => c && c.__type === 'where');
        if (wheres.length) result = result.filter((item) => wheres.every((w) => matchesConstraint(item, w)));
        const orders = constraints.filter((c) => c && c.__type === 'orderBy');
        if (orders.length) {
            result.sort((a, b) => {
                for (const o of orders) {
                    const va = getNestedValue(a, o.field);
                    const vb = getNestedValue(b, o.field);
                    if (va === vb) continue;
                    if (va == null) return o.dir === 'desc' ? 1 : -1;
                    if (vb == null) return o.dir === 'desc' ? -1 : 1;
                    const cmp = va < vb ? -1 : 1;
                    return o.dir === 'desc' ? -cmp : cmp;
                }
                return 0;
            });
        }
        const lim = constraints.find((c) => c && c.__type === 'limit');
        if (lim && Number.isFinite(lim.n)) result = result.slice(0, lim.n);
        return result;
    }

    async function fetchCollectionItems(collectionName) {
        const byKey = new Map();

        if (collectionName === 'conductores') {
            const [perfilesRes, webRes] = await Promise.all([
                supabase.from('perfiles').select('*'),
                supabase.from('web_colecciones').select('*').eq('coleccion', 'conductores')
            ]);

            if (!webRes.error && Array.isArray(webRes.data)) {
                for (const r of webRes.data) {
                    byKey.set(r.id, { ...(r.datos || {}), id: r.id, uid: r.id });
                }
            }
            if (!perfilesRes.error && Array.isArray(perfilesRes.data)) {
                for (const row of perfilesRes.data) {
                    const mapped = mapPerfilRowToWeb(row);
                    const existing = byKey.get(mapped.id) || {};
                    byKey.set(mapped.id, { ...existing, ...mapped });
                }
            }
            if (webRes.error && perfilesRes.error) {
                console.warn('[Supabase] No se pudo leer conductores:', webRes.error.message || perfilesRes.error.message);
            }
            return [...byKey.values()];
        }

        const { data, error } = await supabase.from('web_colecciones').select('*').eq('coleccion', collectionName);
        if (error) {
            console.warn(`[Supabase] Error leyendo colección "${collectionName}":`, error.message);
            return [];
        }
        return (data || []).map((r) => ({ ...(r.datos || {}), id: r.id }));
    }

    async function getDocImpl(docRef) {
        if (!docRef || docRef.__type !== 'doc') return makeSnapshot({ id: '' }, null);
        const col = docRef.collection;
        const id = docRef.id;

        if (col === 'conductores') {
            const perfil = await findPerfilRow(id);
            const { data: webRow } = await supabase.from('web_colecciones').select('*')
                .eq('coleccion', 'conductores').eq('id', id).maybeSingle();
            if (perfil) {
                const merged = { ...((webRow && webRow.datos) || {}), ...mapPerfilRowToWeb(perfil) };
                return makeSnapshot(docRef, merged);
            }
            if (webRow) return makeSnapshot(docRef, { ...(webRow.datos || {}), id: webRow.id, uid: webRow.id });
            return makeSnapshot(docRef, null);
        }

        const { data, error } = await supabase.from('web_colecciones').select('*')
            .eq('coleccion', col).eq('id', id).maybeSingle();
        if (error || !data) return makeSnapshot(docRef, null);
        return makeSnapshot(docRef, { ...(data.datos || {}), id: data.id });
    }

    async function setDocImpl(docRef, data, options) {
        if (!docRef || docRef.__type !== 'doc') throw new Error('Referencia de documento inválida');
        const col = docRef.collection;
        const id = docRef.id;
        const merge = Boolean(options && options.merge);
        let nextData = cleanForWrite(data || {}, null);

        if (col === 'conductores') {
            const perfil = await findPerfilRow(id, nextData);
            if (perfil) {
                const patch = splitWebPayloadForPerfil(nextData, perfil);
                const { error } = await supabase.from('perfiles').update(patch).eq('id', perfil.id);
                if (!error) return;
            }
        }

        if (merge) {
            const { data: existing } = await supabase.from('web_colecciones').select('datos')
                .eq('coleccion', col).eq('id', id).maybeSingle();
            if (existing && existing.datos) {
                const base = { ...existing.datos };
                Object.keys(data || {}).forEach((k) => {
                    if (data[k] && data[k].__sentinel === 'deleteField') delete base[k];
                });
                nextData = cleanForWrite({ ...base, ...nextData }, existing.datos);
            }
        }

        const { error } = await supabase.from('web_colecciones').upsert({
            coleccion: col,
            id: id,
            datos: nextData,
            actualizado_en: new Date().toISOString()
        }, { onConflict: 'coleccion,id' });

        if (error) throw new Error(error.message);
    }

    async function updateDocImpl(docRef, updates) {
        if (!docRef || docRef.__type !== 'doc') throw new Error('Referencia de documento inválida');
        const col = docRef.collection;
        const id = docRef.id;

        let base = {};
        if (col === 'conductores') {
            const perfil = await findPerfilRow(id, updates);
            if (perfil) {
                const resolved = cleanForWrite(updates || {}, perfil.web_data || {});
                const merged = applyDotUpdates(perfil.web_data || {}, resolved);
                const patch = splitWebPayloadForPerfil(merged, perfil);
                const { error } = await supabase.from('perfiles').update(patch).eq('id', perfil.id);
                if (!error) return;
            }
        }

        const { data: existingRow } = await supabase.from('web_colecciones').select('datos')
            .eq('coleccion', col).eq('id', id).maybeSingle();
        base = (existingRow && existingRow.datos) || {};
        Object.keys(updates || {}).forEach((k) => {
            if (updates[k] && updates[k].__sentinel === 'deleteField') delete base[k];
        });
        const resolved = cleanForWrite(updates || {}, base);
        const merged = applyDotUpdates(base, resolved);

        const { error } = await supabase.from('web_colecciones').upsert({
            coleccion: col,
            id: id,
            datos: merged,
            actualizado_en: new Date().toISOString()
        }, { onConflict: 'coleccion,id' });
        if (error) throw new Error(error.message);
    }

    async function addDocImpl(colRef, data) {
        const id = genId();
        const ref = makeDocRef(colRef.name, id);
        await setDocImpl(ref, { ...(data || {}), id }, { merge: false });
        return ref;
    }

    async function deleteDocImpl(docRef) {
        const { error } = await supabase.from('web_colecciones').delete()
            .eq('coleccion', docRef.collection).eq('id', docRef.id);
        if (error) throw new Error(error.message);
    }

    async function getDocsImpl(target) {
        const isQuery = target && target.__type === 'query';
        const colName = isQuery ? target.collection : (target && target.name);
        if (!colName) return makeQuerySnapshot([], '');
        const constraints = isQuery ? target.constraints : [];
        const items = await fetchCollectionItems(colName);
        return makeQuerySnapshot(applyConstraints(items, constraints), colName);
    }

    function onSnapshotImpl(target, onNext, onError) {
        let active = true;
        let timer = null;
        const emit = async () => {
            if (!active) return;
            try {
                const snap = (target && target.__type === 'doc')
                    ? await getDocImpl(target)
                    : await getDocsImpl(target);
                if (active && typeof onNext === 'function') onNext(snap);
            } catch (err) {
                if (active && typeof onError === 'function') onError(err);
            }
        };
        const scheduleEmit = () => {
            if (!active) return;
            clearTimeout(timer);
            timer = setTimeout(emit, 180);
        };
        emit();
        const colName = target && target.__type === 'doc'
            ? target.collection
            : (target && target.__type === 'query' ? target.collection : target && target.name);
        const channel = supabase.channel('rt_' + colName + '_' + genId());
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'web_colecciones' }, scheduleEmit);
        if (colName === 'conductores') {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, scheduleEmit);
        }
        channel.subscribe();
        return () => {
            active = false;
            clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }

    /* ── Marcadores compatibles con Firestore ──────────────────────────────── */

    const DELETE_FIELD = { __sentinel: 'deleteField' };
    const deleteField = () => ({ __sentinel: 'deleteField' });
    const increment = (n) => ({ __sentinel: 'increment', amount: Number(n || 0) });
    const serverTimestamp = () => ({ __sentinel: 'serverTimestamp' });
    const arrayUnion = (...values) => ({ __sentinel: 'arrayUnion', values });
    const arrayRemove = (...values) => ({ __sentinel: 'arrayRemove', values });

    function writeBatch() {
        const ops = [];
        return {
            set(ref, data, opts) { ops.push(() => setDocImpl(ref, data, opts)); return this; },
            update(ref, data) { ops.push(() => updateDocImpl(ref, data)); return this; },
            delete(ref) { ops.push(() => deleteDocImpl(ref)); return this; },
            async commit() {
                const results = [];
                for (const op of ops) {
                    try { results.push(await op()); }
                    catch (e) { results.push(e); }
                }
                return results;
            }
        };
    }

    /* ── API global (API compatible con Firestore) ─────────────────────────── */

    window.db = { __isSupabase: true, __isRest: true, client: supabase, url: SUPABASE_URL };
    window.collection = (_db, ...segments) => ({ __type: 'collection', name: segments.join('/') });
    window.fsDoc = (dbOrCol, ...segments) => {
        if (dbOrCol && dbOrCol.__type === 'collection') {
            return makeDocRef(dbOrCol.name, segments[0] || genId());
        }
        const col = segments.slice(0, -1).join('/');
        const id = segments[segments.length - 1] || genId();
        return makeDocRef(col, id);
    };
    window.where = (field, op, value) => ({ __type: 'where', field, op, value });
    window.orderBy = (field, dir) => ({ __type: 'orderBy', field, dir: dir || 'asc' });
    window.limit = (n) => ({ __type: 'limit', n });
    window.query = (colRef, ...constraints) => ({
        __type: 'query',
        collection: colRef && colRef.name,
        constraints
    });

    window.getDocs = getDocsImpl;
    window.getDoc = getDocImpl;
    window.setDoc = setDocImpl;
    window.updateDoc = updateDocImpl;
    window.addDoc = addDocImpl;
    window.deleteDoc = deleteDocImpl;
    window.onSnapshot = onSnapshotImpl;

    window.deleteField = deleteField;
    window.increment = increment;
    window.serverTimestamp = serverTimestamp;
    window.arrayUnion = arrayUnion;
    window.arrayRemove = arrayRemove;
    window.writeBatch = writeBatch;

    window.PanterRules = {
        async check(options) {
            const result = { ok: false, colecciones: {}, perfiles: false, error: null, modo: 'rest' };
            try {
                const [web, perf] = await Promise.all([
                    supabase.from('web_colecciones').select('id').limit(1),
                    supabase.from('perfiles').select('id').limit(1)
                ]);
                result.colecciones = { ok: !web.error, error: web.error ? web.error.message : null };
                result.perfiles = !perf.error;
                result.ok = !web.error && !perf.error;
                if (options && options.write) {
                    const testId = '__diag_' + genId();
                    const { error } = await supabase.from('web_colecciones').upsert({
                        coleccion: '__diag__', id: testId, datos: { ok: true }
                    }, { onConflict: 'coleccion,id' });
                    result.escritura = !error;
                    if (!error) await supabase.from('web_colecciones').delete().eq('coleccion', '__diag__').eq('id', testId);
                    result.ok = result.ok && result.escritura;
                }
            } catch (e) {
                result.error = e && e.message ? e.message : String(e);
            }
            return result;
        },
        describe() {
            return {
                backend: 'Supabase REST',
                url: SUPABASE_URL,
                colecciones: 'web_colecciones',
                conductores: 'perfiles',
                realtime: 'polling 4s'
            };
        }
    };

    /* ── Compatibilidad de Auth (Discord es la fuente principal) ───────────── */

    if (!Object.getOwnPropertyDescriptor(window, 'auth')) {
        Object.defineProperty(window, 'auth', {
            get: () => (window.DiscordAuth ? window.DiscordAuth.getUser() : null),
            configurable: true
        });
    }

    window.signOut = (...args) => {
        if (window.DiscordAuth && window.DiscordAuth.logout) return window.DiscordAuth.logout();
        return authClient.signOut(...args);
    };
    window.onAuthStateChanged = (_authObj, callback) => {
        const cb = typeof _authObj === 'function' ? _authObj : callback;
        if (window.DiscordAuth && typeof window.DiscordAuth.onAuthStateChanged === 'function') {
            return window.DiscordAuth.onAuthStateChanged(cb);
        }
        return () => {};
    };

    window.SupabaseAuthHelper = {
        signInWithOAuth: (provider) => authClient.signInWithOAuth({ provider })
    };

    window.firebaseAuth = {
        get currentUser() {
            return (window.DiscordAuth && window.DiscordAuth.getUser && window.DiscordAuth.getUser()) || null;
        }
    };

    window.signInWithEmailAndPassword = async (_auth, email, password) => {
        const { data, error } = await authClient.signInWithPassword({ email, password });
        if (error) throw error;
        return { user: data && data.user ? { ...data.user, uid: data.user.id } : null };
    };
    window.createUserWithEmailAndPassword = async (_auth, email, password) => {
        const { data, error } = await authClient.signUp({ email, password });
        if (error) throw error;
        return { user: data && data.user ? { ...data.user, uid: data.user.id } : null };
    };
    window.sendPasswordResetEmail = async (_auth, email) => {
        const { error } = await authClient.resetPasswordForEmail(email);
        if (error) throw error;
    };
    window.updateProfile = async (_user, updates) => {
        const { error } = await authClient.updateUser({ data: updates || {} });
        if (error) throw error;
    };
    window.GoogleAuthProvider = class { constructor() { this.provider = 'google'; } setCustomParameters() {} };
    window.OAuthProvider = class { constructor(id) { this.provider = String(id || 'discord').replace('.com', ''); } };
    window.signInWithPopup = async (_auth, providerObj) => {
        const prov = providerObj && providerObj.provider ? providerObj.provider : 'google';
        return authClient.signInWithOAuth({ provider: prov });
    };

    // Los globals ya están disponibles de forma síncrona para quien los
    // consulte directamente. Los eventos se difieren a DOMContentLoaded para
    // que los módulos cargados en <body> puedan registrar sus listeners
    // (varios sistemas dependen de `firebaseReady` para arrancar).
    function fireReady() {
        document.dispatchEvent(new Event('supabaseReady'));
        document.dispatchEvent(new Event('firebaseReady'));
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fireReady, { once: true });
    } else {
        setTimeout(fireReady, 0);
    }

    console.log('[Supabase] Capa de datos lista (REST, sin dependencias):', SUPABASE_URL);
})();
