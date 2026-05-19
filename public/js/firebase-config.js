import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAew7PORaordNGG6ZyCruucTyLABLrzuwg",
  authDomain: "gen-lang-client-0833313210.firebaseapp.com",
  projectId: "gen-lang-client-0833313210",
  storageBucket: "gen-lang-client-0833313210.firebasestorage.app",
  messagingSenderId: "572872706700",
  appId: "1:572872706700:web:1f403ff60244b6892f09a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
