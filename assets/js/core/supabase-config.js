/**
 * supabase-config.js — Cliente unificado de Supabase para Panter Studio Web
 * Conectado al mismo proyecto Supabase del juego Nuestra Tierra:
 *   URL: https://hndlwmvezampajbmpqae.supabase.co
 *
 * - `conductores` se sincroniza bidireccionalmente con `public.perfiles` (tabla del juego)
 *   y usa `public.web_colecciones` como respaldo para cuentas web sin fila aún en `perfiles`.
 * - El resto de colecciones (`soporte_tickets`, `equipo`, `announcements`, `devlogs`, etc.)
 *   se almacenan en `public.web_colecciones`.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://hndlwmvezampajbmpqae.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Cw95N8YDQNhc4zDGTE__Yg_C_Xj0IP4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false // DiscordAuth maneja el hash OAuth de Discord
  }
});

window.supabaseClient = supabase;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

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

function splitWebPayloadForPerfil(payload, existingRow = null) {
  const prevWeb = (existingRow?.web_data && typeof existingRow.web_data === 'object') ? existingRow.web_data : {};
  const webData = { ...prevWeb, ...payload };
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
  if (!existingRow?.nombre && (payload.displayName || payload.nombre_usuario || payload.username)) {
    patch.nombre = String(payload.displayName || payload.nombre_usuario || payload.username);
  }
  if (payload.role != null) patch.role = String(payload.role);
  if (payload.avatarUrl != null || payload.avatarImg != null || payload.photoURL != null) {
    patch.avatar_url = String(payload.avatarUrl || payload.avatarImg || payload.photoURL);
  }
  if (payload.betaTesterStatus != null) patch.beta_tester_status = String(payload.betaTesterStatus);

  // Solo actualizar monedas/esmeraldas si se enviaron explícitamente (p. ej. admin/recompensas)
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

async function findPerfilRow(id, hints = {}) {
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
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .or(filters.join(','))
    .limit(1);

  if (error || !Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

function makeDocRef(collectionName, id) {
  return {
    __type: 'doc',
    collection: collectionName,
    id: id || genId(),
    path: `${collectionName}/${id || ''}`
  };
}

function makeSnapshot(docRef, data) {
  const existsFlag = data !== null && data !== undefined;
  return {
    id: docRef.id,
    ref: docRef,
    exists: () => existsFlag,
    data: () => (existsFlag ? { ...data } : undefined)
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
  if (c.__type !== 'where') return true;
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

function applyConstraints(items, constraints = []) {
  let result = items.slice();
  const wheres = constraints.filter((c) => c.__type === 'where');
  if (wheres.length) {
    result = result.filter((item) => wheres.every((w) => matchesConstraint(item, w)));
  }
  const orders = constraints.filter((c) => c.__type === 'orderBy');
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
  const lim = constraints.find((c) => c.__type === 'limit');
  if (lim && Number.isFinite(lim.n)) {
    result = result.slice(0, lim.n);
  }
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
        const obj = { ...(r.datos || {}), id: r.id, uid: r.id };
        byKey.set(r.id, obj);
      }
    }
    if (!perfilesRes.error && Array.isArray(perfilesRes.data)) {
      for (const row of perfilesRes.data) {
        const mapped = mapPerfilRowToWeb(row);
        const existing = byKey.get(mapped.id) || {};
        byKey.set(mapped.id, { ...existing, ...mapped });
      }
    }
    return [...byKey.values()];
  }

  const { data, error } = await supabase
    .from('web_colecciones')
    .select('*')
    .eq('coleccion', collectionName);

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
    const { data: webRow } = await supabase
      .from('web_colecciones')
      .select('*')
      .eq('coleccion', 'conductores')
      .eq('id', id)
      .maybeSingle();

    if (perfil) {
      const merged = { ...(webRow?.datos || {}), ...mapPerfilRowToWeb(perfil) };
      return makeSnapshot(docRef, merged);
    }
    if (webRow) {
      return makeSnapshot(docRef, { ...(webRow.datos || {}), id: webRow.id, uid: webRow.id });
    }
    return makeSnapshot(docRef, null);
  }

  const { data, error } = await supabase
    .from('web_colecciones')
    .select('*')
    .eq('coleccion', col)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return makeSnapshot(docRef, null);
  return makeSnapshot(docRef, { ...(data.datos || {}), id: data.id });
}

async function setDocImpl(docRef, data, options = {}) {
  const col = docRef.collection;
  const id = docRef.id;
  const merge = Boolean(options && options.merge);
  let nextData = { ...(data || {}) };

  if (col === 'conductores') {
    const perfil = await findPerfilRow(id, nextData);
    if (perfil) {
      const patch = splitWebPayloadForPerfil(nextData, perfil);
      const { error } = await supabase.from('perfiles').update(patch).eq('id', perfil.id);
      if (!error) return;
    }
  }

  if (merge) {
    const { data: existing } = await supabase
      .from('web_colecciones')
      .select('datos')
      .eq('coleccion', col)
      .eq('id', id)
      .maybeSingle();
    if (existing?.datos) {
      nextData = { ...existing.datos, ...nextData };
    }
  }

  const { error } = await supabase.from('web_colecciones').upsert({
    coleccion: col,
    id,
    datos: nextData,
    actualizado_en: new Date().toISOString()
  }, { onConflict: 'coleccion,id' });

  if (error) throw new Error(error.message);
}

async function updateDocImpl(docRef, updates) {
  const col = docRef.collection;
  const id = docRef.id;

  if (col === 'conductores') {
    const perfil = await findPerfilRow(id, updates);
    if (perfil) {
      const merged = applyDotUpdates(perfil.web_data || {}, updates);
      const patch = splitWebPayloadForPerfil(merged, perfil);
      const { error } = await supabase.from('perfiles').update(patch).eq('id', perfil.id);
      if (!error) return;
    }
  }

  const { data: existing } = await supabase
    .from('web_colecciones')
    .select('datos')
    .eq('coleccion', col)
    .eq('id', id)
    .maybeSingle();

  const merged = applyDotUpdates(existing?.datos || {}, updates);
  const { error } = await supabase.from('web_colecciones').upsert({
    coleccion: col,
    id,
    datos: merged,
    actualizado_en: new Date().toISOString()
  }, { onConflict: 'coleccion,id' });

  if (error) throw new Error(error.message);
}

async function addDocImpl(colRef, data) {
  const id = genId();
  const docRef = makeDocRef(colRef.name, id);
  await setDocImpl(docRef, { ...(data || {}), id }, { merge: false });
  return docRef;
}

async function deleteDocImpl(docRef) {
  const { error } = await supabase
    .from('web_colecciones')
    .delete()
    .eq('coleccion', docRef.collection)
    .eq('id', docRef.id);
  if (error) throw new Error(error.message);
}

async function getDocsImpl(target) {
  const isQuery = target && target.__type === 'query';
  const colName = isQuery ? target.collection : target.name;
  const constraints = isQuery ? target.constraints : [];
  const items = await fetchCollectionItems(colName);
  const filtered = applyConstraints(items, constraints);
  return makeQuerySnapshot(filtered, colName);
}

function onSnapshotImpl(target, onNext, onError) {
  let active = true;
  let timer = null;

  const emit = async () => {
    if (!active) return;
    try {
      if (target.__type === 'doc') {
        const snap = await getDocImpl(target);
        if (active && typeof onNext === 'function') onNext(snap);
      } else {
        const snap = await getDocsImpl(target);
        if (active && typeof onNext === 'function') onNext(snap);
      }
    } catch (err) {
      if (active && typeof onError === 'function') onError(err);
    }
  };

  const scheduleEmit = () => {
    if (!active) return;
    clearTimeout(timer);
    timer = setTimeout(emit, 250);
  };

  emit();

  const colName = target.__type === 'doc'
    ? target.collection
    : (target.__type === 'query' ? target.collection : target.name);

  const channel = supabase
    .channel(`rt_${colName}_${genId()}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'web_colecciones',
      filter: `coleccion=eq.${colName}`
    }, scheduleEmit);

  if (colName === 'conductores') {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'perfiles'
    }, scheduleEmit);
  }

  channel.subscribe();

  return () => {
    active = false;
    clearTimeout(timer);
    try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
  };
}

// ── API compatible en window.* ──────────────────────────────────────────────
window.db = { __isSupabase: true, client: supabase, url: SUPABASE_URL };
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
window.orderBy = (field, dir = 'asc') => ({ __type: 'orderBy', field, dir });
window.limit = (n) => ({ __type: 'limit', n });
window.query = (colRef, ...constraints) => ({
  __type: 'query',
  collection: colRef.name,
  constraints
});
window.getDocs = getDocsImpl;
window.getDoc = getDocImpl;
window.setDoc = setDocImpl;
window.updateDoc = updateDocImpl;
window.addDoc = addDocImpl;
window.deleteDoc = deleteDocImpl;
window.onSnapshot = onSnapshotImpl;

// Auth unificado (DiscordAuth + Supabase Auth OAuth)
if (!Object.getOwnPropertyDescriptor(window, 'auth')) {
  Object.defineProperty(window, 'auth', {
    get: () => (window.DiscordAuth ? window.DiscordAuth.getUser() : null),
    configurable: true
  });
}

window.signOut = () => (window.DiscordAuth ? window.DiscordAuth.logout() : supabase.auth.signOut());
window.onAuthStateChanged = (_authObj, callback) => {
  const cb = typeof _authObj === 'function' ? _authObj : callback;
  if (window.DiscordAuth && typeof cb === 'function') {
    return window.DiscordAuth.onAuthStateChanged(cb);
  }
  return () => {};
};

window.SupabaseAuthHelper = {
  signInWithOAuth: async (provider) => {
    if (provider === 'discord' && window.DiscordAuth && window.DiscordAuth.login) {
      return window.DiscordAuth.login();
    }
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href }
    });
  }
};

// Compatibilidad de Auth para módulos que esperan helpers en window.* (ejecutando sobre Supabase Auth)
window.firebaseAuth = {
  get currentUser() {
    return (window.DiscordAuth && window.DiscordAuth.getUser()) || null;
  }
};

window.signInWithEmailAndPassword = async (_authObj, email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user ? { ...data.user, uid: data.user.id } : null };
};

window.createUserWithEmailAndPassword = async (_authObj, email, password) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: data.user ? { ...data.user, uid: data.user.id } : null };
};

window.sendPasswordResetEmail = async (_authObj, email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href
  });
  if (error) throw error;
};

window.updateProfile = async (_userObj, updates) => {
  const { error } = await supabase.auth.updateUser({ data: updates || {} });
  if (error) throw error;
};

window.GoogleAuthProvider = class {
  constructor() { this.provider = 'google'; }
  setCustomParameters() {}
};

window.OAuthProvider = class {
  constructor(id) { this.provider = String(id || 'discord').replace('.com', ''); }
};

window.signInWithPopup = async (_authObj, providerObj) => {
  const prov = (providerObj && providerObj.provider) ? providerObj.provider : 'google';
  return window.SupabaseAuthHelper.signInWithOAuth(prov);
};

console.log('[Supabase] Conectado a Nuestra Tierra:', SUPABASE_URL);
document.dispatchEvent(new Event('supabaseReady'));
document.dispatchEvent(new Event('firebaseReady'));
