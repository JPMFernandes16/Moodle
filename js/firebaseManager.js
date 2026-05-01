// js/firebaseManager.js
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { state } from './store.js'; // 🔥 CORREÇÃO: Removido o PERFIS_ESTUDO daqui!

export async function carregarTemaDaCloud(user) {
    const prefsRef = doc(db, "users", user.uid, "settings", "preferences");
    const snap = await getDoc(prefsRef);
    return (snap.exists() && snap.data().theme) ? snap.data().theme : "dark";
}

export async function guardarTemaNaCloud(theme) {
    if (!state.currentUser) return;
    await setDoc(doc(db, "users", state.currentUser.uid, "settings", "preferences"), { theme: theme }, { merge: true });
}

export async function checkAndUpdateStreak(didStudy = false) {
    if (!state.currentUser) return 0;
    const ref = doc(db, "users", state.currentUser.uid, "settings", "streak");
    const snap = await getDoc(ref);
    let streak = 0; let lastDate = null;
    const today = new Date().toISOString().split('T')[0];

    if (snap.exists()) {
        streak = snap.data().count || 0;
        lastDate = snap.data().lastDate;
    }

    if (didStudy) {
        if (lastDate !== today) {
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toISOString().split('T')[0]) { streak++; } 
            else { streak = 1; }
            lastDate = today;
            await setDoc(ref, { count: streak, lastDate: today }, { merge: true });
        }
    } else if (lastDate && lastDate !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        if (lastDate < yesterday.toISOString().split('T')[0]) {
            streak = 0; await setDoc(ref, { count: 0, lastDate: lastDate }, { merge: true });
        }
    }
    return streak;
}

export async function fetchLeaderboardData(disciplina) {
    const q = query(collection(db, "leaderboards", disciplina, "rankings"), orderBy("score", "desc"), limit(10));
    const snap = await getDocs(q);
    let results = [];
    snap.forEach(doc => results.push(doc.data()));
    return results;
}

export async function saveScoreToLeaderboard(disciplina, score) {
    if (!state.currentUser) return;
    const ref = doc(db, "leaderboards", disciplina, "rankings", state.currentUser.uid);
    const snap = await getDoc(ref);
    if(!snap.exists() || snap.data().score < parseFloat(score)) {
        await setDoc(ref, {
            // 🔥 CORREÇÃO: Agora usa o nome dinâmico da base de dados!
            nome: state.userProfile?.nome || state.currentUser.email.split('@')[0],
            score: parseFloat(score),
            date: new Date().toISOString()
        });
    }
}

export async function reportQuestionToCloud(qId, disciplina, pergunta) {
    await setDoc(doc(db, "reports", qId), { 
        disciplina, 
        pergunta, 
        user: state.currentUser?.email || "anon", 
        date: new Date().toISOString() 
    });
}

export async function saveProgressToCloud(disciplina, correctIds, wrongIds) {
    if (!state.currentUser) return;
    await setDoc(doc(db, "users", state.currentUser.uid, "progress", disciplina), {
        correct: correctIds, 
        wrong: wrongIds, 
        lastUpdate: new Date().toISOString(), 
        activeQuiz: null
    }, { merge: true });
}

export async function fetchUserProfile(user) {
    const docRef = doc(db, "users", user.uid);
    const snap = await getDoc(docRef);
    
    if (snap.exists() && snap.data().disciplinas) {
        return snap.data();
    } else {
        const defaultProfile = {
            nome: user.email.split('@')[0], 
            curso: "Estudante",
            disciplinas: [{ value: "BIA_STP", text: "Séries Temporais e Previsão" }]
        };
        await setDoc(docRef, defaultProfile, { merge: true });
        return defaultProfile;
    }
}