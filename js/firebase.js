// Firebase web config is public by design; access is enforced by firestore.rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBdfuRzZY3j2zxOtUxaeGwMYCZuWETUX0Q",
  authDomain: "haj-portfolio.firebaseapp.com",
  projectId: "haj-portfolio",
  storageBucket: "haj-portfolio.firebasestorage.app",
  messagingSenderId: "391230316341",
  appId: "1:391230316341:web:0c7f14b1947d2f0a2e767c",
  measurementId: "G-8BEBKPSMJK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
