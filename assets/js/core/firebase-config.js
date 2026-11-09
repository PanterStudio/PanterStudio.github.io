// Firebase configuration (Sincronizado con el juego - Web App)
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
      setDoc, doc, deleteDoc, updateDoc, orderBy, limit, increment
    } = firestore;
    const {
      getAuth,
      signInWithEmailAndPassword, createUserWithEmailAndPassword,
      sendPasswordResetEmail, updateProfile, signOut,
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
