import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js"; // <-- NOVA IMPORTAÇÃO

const firebaseConfig = {
  apiKey: "AIzaSyBCnazL-xlrFOai3mdZ1Q1i0rMr7_BUshk",
  authDomain: "moodle-37392.firebaseapp.com",
  projectId: "moodle-37392",
  storageBucket: "moodle-37392.firebasestorage.app",
  messagingSenderId: "345802059351",
  appId: "1:345802059351:web:a9a9e65696d7cef6ac7d12"
  // Nota: Se o Firebase te deu um "measurementId: 'G-XXXXXXX'", podes colá-lo aqui também!
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app); // <-- ATIVA O GOOGLE ANALYTICS

// Ativa a Base de Dados Offline no Telemóvel
enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Modo offline poderá não funcionar neste browser:", err);
});