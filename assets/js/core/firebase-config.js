// Firebase configuration (Sincronizado con el juego - Web App)

/* ─────────────────────────────────────────────────────────────────────
   AVISO DE REGLAS (Fase 1): mientras `firestore.rules` no esté publicado
   en Firebase Console, Firestore rechaza lecturas/escrituras con
   `permission-denied`. La web ya degrada a copias locales, pero eso
   generaba ~12 mensajes rojos por carga. Aquí se COLAPSAN en un único
   aviso accionable por sesión (no se ocultan: se agrupan y se cuenta).

   Para ver todos los mensajes originales: window.PANTER_RULES_VERBOSE = true
   ───────────────────────────────────────────────────────────────────── */
(function () {
    const RE_PERMISOS = /permission-denied|missing or insufficient permissions|insufficient permissions/i;
    let avisado = false;
    let colapsados = 0;
    const warnOrig = console.warn.bind(console);
    const errorOrig = console.error.bind(console);

    const esPermiso = (args) => args.some(a => {
        const v = a && typeof a === 'object' ? (a.message || a.code || '') : a;
        return RE_PERMISOS.test(String(v == null ? '' : v));
    });

    const envolver = (original) => function (...args) {
        if (window.PANTER_RULES_VERBOSE || !esPermiso(args)) return original(...args);
        colapsados += 1;
        if (!avisado) {
            avisado = true;
            warnOrig('%c[Panter] Reglas de Firestore NO publicadas: se usan copias locales. '
                + 'Publica firestore.rules en Firebase Console → Reglas para activar la '
                + 'sincronización en tiempo real. Ejecuta window.PanterRules.check() para verificar.',
                'color:#fbbf24;font-weight:bold');
        }
        window.PanterRules = window.PanterRules || {};
        window.PanterRules.avisosColapsados = colapsados;
        return undefined;
    };

    console.warn = envolver(warnOrig);
    console.error = envolver(errorOrig);

    /** Autodiagnóstico: comprueba si las reglas ya permiten create/update/delete. */
    window.PanterRules = {
        avisosColapsados: 0,
        async check() {
            const resultado = { create: false, update: false, delete: false, detalle: {} };
            if (!window.db || !window.fsDoc || !window.setDoc || !window.deleteDoc) {
                resultado.error = 'Firestore no disponible todavía';
                return resultado;
            }
            const ref = window.fsDoc(window.db, 'soporte_tickets', 'ps_rules_check_' + Date.now());
            const probar = async (nombre, fn) => {
                try { await fn(); resultado[nombre] = true; }
                catch (e) { resultado.detalle[nombre] = String(e && e.code || e && e.message || e); }
            };
            await probar('create', () => window.setDoc(ref, { probe: true }));
            await probar('update', () => window.setDoc(ref, { probe2: true }, { merge: true }));
            await probar('delete', () => window.deleteDoc(ref));
            resultado.publicadas = resultado.create && resultado.update && resultado.delete;
            return resultado;
        }
    };
})();

const firebaseConfig = {
  apiKey: "AIzaSyBzrbcb2CVkURpbjp8biki9lg7G9uscecA",
  authDomain: "nuestratierra-2bb4a.firebaseapp.com",
  projectId: "nuestratierra-2bb4a",
  storageBucket: "nuestratierra-2bb4a.firebasestorage.app",
  messagingSenderId: "507313127250",
  appId: "1:507313127250:web:3b43fd414ce810d391c48b",
  measurementId: "G-9M0QRJNWMT"
};

import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js")
  .then(({ initializeApp }) => Promise.all([
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js")
  ]).then(([firestore, auth, analytics]) => ({ initializeApp, firestore, auth, analytics })))
  .then(({ initializeApp, firestore, auth, analytics }) => {
    const {
      getFirestore, collection, addDoc, getDocs, getDoc, onSnapshot, query, where,
      setDoc, doc, deleteDoc, updateDoc, orderBy, limit, increment, deleteField
    } = firestore;
    const {
      getAuth,
      signInWithEmailAndPassword, createUserWithEmailAndPassword,
      sendPasswordResetEmail, updateProfile, signOut, signInWithCustomToken,
      onAuthStateChanged: firebaseOnAuthStateChanged,
      GoogleAuthProvider, OAuthProvider, signInWithPopup,
      signInWithRedirect, getRedirectResult
    } = auth;

    const app = initializeApp(firebaseConfig);

    // ── Firestore ──────────────────────────────────────────────
    window.db         = getFirestore(app);
    window.collection = collection;
    window.addDoc     = addDoc;
    window.getDocs    = getDocs;
    window.getDoc     = getDoc;
    window.onSnapshot = onSnapshot;
    window.query      = query;
    window.where      = where;
    window.setDoc     = setDoc;
    window.fsDoc      = doc;
    window.deleteDoc  = deleteDoc;
    window.updateDoc  = updateDoc;
    window.orderBy    = orderBy;
    window.limit      = limit;
    window.increment  = increment;
    window.deleteField = deleteField;

    // ── Firebase Auth (real) ───────────────────────────────────
    window.firebaseAuth               = getAuth(app);
    window.OAuthProvider              = OAuthProvider;
    window.GoogleAuthProvider         = GoogleAuthProvider;
    window.firebaseOnAuthStateChanged = firebaseOnAuthStateChanged;

    // Toda la web usa `window.auth` como sesión UNIFICADA (DiscordAuth),
    // que NO es un objeto Auth de Firebase. Los adaptadores below ignoran
    // ese primer argumento y usan el Auth real, además de sincronizar la
    // sesión unificada con la política de rangos por correo.
    const adoptUser = (cred) => {
      try {
        const user = cred && (cred.user || cred);
        if (user && window.DiscordAuth && typeof window.DiscordAuth.adoptFirebaseUser === 'function') {
          window.DiscordAuth.adoptFirebaseUser(user);
        }
      } catch (e) { /* la sesión unificada es opcional */ }
      return cred;
    };
    const withRealAuth = (fn, sync) => async (legacyAuth, ...args) => {
      const result = await fn(window.firebaseAuth, ...args);
      return sync ? adoptUser(result) : result;
    };

    window.signInWithEmailAndPassword     = withRealAuth(signInWithEmailAndPassword, true);
    window.createUserWithEmailAndPassword = withRealAuth(createUserWithEmailAndPassword, true);
    window.signInWithPopup                = withRealAuth(signInWithPopup, true);
    window.signInWithRedirect             = withRealAuth(signInWithRedirect, false);
    window.getRedirectResult              = withRealAuth(getRedirectResult, true);
    window.sendPasswordResetEmail         = withRealAuth(sendPasswordResetEmail, false);

    window.updateProfile = async (user, profile) => {
      const result = await updateProfile(user, profile);
      adoptUser(user);
      return result;
    };

    Object.defineProperty(window, 'auth', {
        get: () => (window.DiscordAuth ? window.DiscordAuth.getUser() : null),
        configurable: true
    });

    window.signOut = () => (window.DiscordAuth ? window.DiscordAuth.logout() : Promise.resolve());

    // FASE 2: canje del custom token emitido por el backend. A partir de aquí
    // Firebase Auth tiene un usuario real y Firestore recibe `request.auth`.
    // Se exponen con nombres propios para no chocar con los adaptadores
    // legacy de arriba (que envuelven el primer argumento `auth`).
    window.firebaseSignInWithCustomToken = (token) => signInWithCustomToken(window.firebaseAuth, token);
    window.firebaseAuthSignOut = () => signOut(window.firebaseAuth);
    window.firebaseCurrentUser = () => window.firebaseAuth.currentUser;

    // Observador dual: con `firebaseAuth` usa Firebase real; con la sesión
    // unificada (o sin argumentos) usa el bus de DiscordAuth.
    window.onAuthStateChanged = (authObj, callback) => {
        const cb = typeof authObj === 'function' ? authObj : callback;
        if (authObj === window.firebaseAuth && typeof cb === 'function') {
            return firebaseOnAuthStateChanged(window.firebaseAuth, cb);
        }
        if (window.DiscordAuth && typeof cb === 'function') {
            return window.DiscordAuth.onAuthStateChanged(cb);
        }
        return () => {};
    };

    try { analytics.getAnalytics(app); } catch (e) { /* Analytics opcional */ }

    console.log("Firebase Firestore + Firebase Auth listo");
    document.dispatchEvent(new Event('firebaseReady'));
  })
  .catch(err => console.error('[Firebase] No se pudo inicializar el SDK:', err));
