// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC96wxMCMOmkU_0K4H1DtmXn64iMIdhWf0",
  authDomain: "panterweb-a9112.firebaseapp.com",
  projectId: "panterweb-a9112",
  storageBucket: "panterweb-a9112.firebasestorage.app",
  messagingSenderId: "301865974545",
  appId: "1:301865974545:web:1912eaa7d2a95b615caab0",
  measurementId: "G-98S29GR5Q8"
};

import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js").then(({ initializeApp }) => {
  Promise.all([
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js")
  ]).then(([{ getFirestore, collection, addDoc, getDocs, query, where, setDoc, doc }, { getAnalytics }]) => {
    const app = initializeApp(firebaseConfig);
    window.db         = getFirestore(app);
    window.collection = collection;
    window.addDoc     = addDoc;
    window.getDocs    = getDocs;
    window.query      = query;
    window.where      = where;
    window.setDoc     = setDoc;
    window.fsDoc      = doc;
    getAnalytics(app);
    console.log("Firebase Firestore listo");
    // Disparar evento para que script.js actualice el contador
    document.dispatchEvent(new Event('firebaseReady'));
  });
});