// Firebase configuration - Replace with your own Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase (only if config is set)
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js").then(({ initializeApp }) => {
    import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js").then(({ getFirestore, collection, addDoc, getDocs }) => {
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      window.db = db;
      console.log("Firebase initialized");
    });
  });
}