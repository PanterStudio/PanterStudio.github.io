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

import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js").then(({ initializeApp }) => {
  Promise.all([
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js")
  ]).then(([{ getFirestore, collection, addDoc, getDocs, getDoc, onSnapshot, query, where, setDoc, doc, deleteDoc, updateDoc, orderBy, limit }, { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult }, { getAnalytics }]) => {
    const app = initializeApp(firebaseConfig);
    window.db         = getFirestore(app);
    window.auth       = getAuth(app);
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
    window.signInWithEmailAndPassword = signInWithEmailAndPassword;
    window.signOut    = signOut;
    window.onAuthStateChanged = onAuthStateChanged;
    window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
    window.sendPasswordResetEmail = sendPasswordResetEmail;
    window.updateProfile = updateProfile;
    window.GoogleAuthProvider = GoogleAuthProvider;
    window.signInWithPopup = signInWithPopup;
    window.signInWithRedirect = signInWithRedirect;
    window.getRedirectResult = getRedirectResult;
    getAnalytics(app);
    console.log("Firebase Firestore + Auth listos");
    document.dispatchEvent(new Event('firebaseReady'));
  });
});