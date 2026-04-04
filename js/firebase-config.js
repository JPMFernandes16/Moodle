// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCnazL-xlrFOai3mdZ1Q1i0rMr7_BUshk",
  authDomain: "moodle-37392.firebaseapp.com",
  projectId: "moodle-37392",
  storageBucket: "moodle-37392.firebasestorage.app",
  messagingSenderId: "345802059351",
  appId: "1:345802059351:web:a9a9e65696d7cef6ac7d12"
  // measurementId: "G-XXXXXXX" // (Opcional) Adiciona aqui o ID se quiseres estatísticas super detalhadas
};

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);

// 2. Exportar os serviços principais
export const auth = getAuth(app);
export const db = getFirestore(app);

// 3. Inicializar o Analytics de forma segura (só se o browser suportar/não tiver adblockers extremos)
export let analytics = null;
isSupported().then((supported) => {
    if (supported) {
        analytics = getAnalytics(app);
        console.log("Google Analytics ativado com segurança.");
    }
});

// 4. Ativar a Base de Dados Offline no Telemóvel
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Aviso: Múltiplos separadores abertos. A persistência offline só funciona num separador de cada vez.");
    } else if (err.code == 'unimplemented') {
        console.warn("Aviso: O browser atual não suporta persistência offline (pode estar em Modo Privado/Incógnito).");
    } else {
        console.error("Erro ao ativar modo offline:", err);
    }
});