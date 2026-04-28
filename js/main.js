// js/main.js

import { state } from './store.js';
import { initAuth } from './auth.js';
import { playClick, playWarningSound } from './audio.js';
import { debounce, showToast } from './utils.js';

// --- FIREBASE IMPORTS ---
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { 
    carregarTemaDaCloud, 
    guardarTemaNaCloud, 
    fetchUserProfile, 
    checkAndUpdateStreak, 
    saveProgressToCloud 
} from './firebaseManager.js';

// --- MÓDULOS DA APLICAÇÃO ---
import { carregarDisciplinaBase, carregarProgressoDaCloud } from './dataLoader.js';
import { openMediaModal, initMediaViewerListeners } from './mediaViewer.js';
import { renderCurrentQuestion } from './questionBuilder.js';
import { 
    iniciarTeste, verificarRespostas, updateGlobalProgressUI, 
    toggleConfigPanel, renderQuestionNavigator, updateTopIndicators, 
    updateNavButtonsState, updateQuestionStateLabel, startTimer, 
    goToPreviousQuestion, goToNextQuestion, scrollToTopSmooth
} from './quizController.js';

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initMediaViewerListeners();

    // ======================================================
    // ELEMENTOS DO DOM
    // ======================================================
    const disciplinaSelect = document.getElementById("disciplina");
    const carregarQuizBtn = document.getElementById("carregarQuiz");
    const carregarFraquezasBtn = document.getElementById("carregarFraquezas");
    const retomarQuizBtn = document.getElementById("retomarQuizBtn"); 
    const submeterQuizBtn = document.getElementById("submeterQuiz");
    const prevQuestionBtn = document.getElementById("prevQuestionBtn");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    const resetProgressBtn = document.getElementById("resetProgressBtn");
    const themeToggle = document.getElementById("themeToggle");
    const scrollTopBtn = document.getElementById("scrollTopBtn");
    const installAppBtn = document.getElementById("installAppBtn");
    const dictSearchInput = document.getElementById("dictSearchInput");
    const dictResultsContainer = document.getElementById("dictResultsContainer");
    const btnToggleFiltros = document.getElementById("btnToggleFiltros");
    const topicosContainer = document.getElementById("topicosContainer");
    
    // Botões de Mídia
    const btnLerResumo = document.getElementById("btnLerResumo");
    const btnVerVideo = document.getElementById("btnVerVideo");

    // Elementos do Menu Lateral Mobile (Drawer)
    const btnMobileSidebar = document.getElementById('btnMobileSidebar');
    const btnCloseSidebar = document.getElementById('btnCloseSidebar');
    const mobileSidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const quizContainer = document.getElementById("quiz-container");

    // ======================================================
    // AUTENTICAÇÃO E INICIALIZAÇÃO GERAL
    // ======================================================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            const theme = await carregarTemaDaCloud(user);
            applyTheme(theme);
            
            state.userProfile = await fetchUserProfile(user);
            configurarUniverso(); 
            
            showToast(`Bem-vindo de volta, ${state.userProfile.nome || 'Estudante'}!`, 'success');
            state.currentDisciplina = disciplinaSelect.value;
            
            const streakInfo = await checkAndUpdateStreak(false);
            const streakEl = document.getElementById('streakDays');
            if (streakEl) streakEl.textContent = streakInfo;

            await carregarDisciplinaBase();
            carregarProgressoDaCloud(user);
        } else {
            state.currentUser = null; 
            state.userProfile = null;
            state.quizData = []; 
            state.fullDatabase = []; 
            state.globalStorage = {};
            if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
            if (quizContainer) quizContainer.innerHTML = "";
            updateGlobalProgressUI();
        }
    });

    function configurarUniverso() {
        const perfil = state.userProfile; 
        if (!perfil) return;
        
        const nameEl = document.querySelector('.student-name');
        const courseEl = document.querySelector('.student-course');
        const avatarEl = document.querySelector('.user-avatar');
        
        if(nameEl) nameEl.textContent = perfil.nome || "Estudante";
        if(courseEl) courseEl.textContent = perfil.curso || "Curso BIA";
        if(avatarEl && perfil.nome) avatarEl.textContent = perfil.nome.charAt(0).toUpperCase();

        if (disciplinaSelect && perfil.disciplinas) {
            disciplinaSelect.innerHTML = "";
            if (Array.isArray(perfil.disciplinas)) {
                perfil.disciplinas.forEach((d, index) => {
                    const opt = document.createElement('option');
                    opt.value = d.value; opt.textContent = d.text;
                    if(index === 0) opt.selected = true;
                    disciplinaSelect.appendChild(opt);
                });
            } else {
                let index = 0;
                for (const [val, text] of Object.entries(perfil.disciplinas)) {
                    const opt = document.createElement('option');
                    opt.value = val; opt.textContent = text;
                    if(index === 0) opt.selected = true;
                    disciplinaSelect.appendChild(opt);
                    index++;
                }
            }
        }
    }

    // ======================================================
    // COMPONENTES DE UI E EVENTOS GLOBAIS
    // ======================================================
    
    // Tema
    function applyTheme(theme) { 
        document.documentElement.setAttribute("data-theme", theme); 
        localStorage.setItem("iscap-theme", theme); 
    }
    
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const novoTema = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            applyTheme(novoTema); 
            guardarTemaNaCloud(novoTema); 
            updateGlobalProgressUI(); // Para atualizar as cores do gráfico
        });
    }

    // Menu Mobile
    function toggleSidebar() {
        if (!mobileSidebar) return;
        const isOpen = mobileSidebar.classList.contains('is-open');
        if (isOpen) {
            mobileSidebar.classList.remove('is-open');
            if(sidebarOverlay) sidebarOverlay.classList.remove('show');
            document.body.style.overflow = ''; 
        } else {
            mobileSidebar.classList.add('is-open');
            if(sidebarOverlay) sidebarOverlay.classList.add('show');
            document.body.style.overflow = 'hidden'; 
        }
    }

    if (btnMobileSidebar) btnMobileSidebar.addEventListener('click', toggleSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

    // Modal de Confirmação Personalizado
    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('customConfirmOverlay'); 
            const msgEl = document.getElementById('customConfirmMsg'); 
            const btnYes = document.getElementById('customConfirmYes'); 
            const btnNo = document.getElementById('customConfirmNo');
            
            msgEl.textContent = message; 
            overlay.style.display = 'flex'; 
            playWarningSound(); 
            setTimeout(() => overlay.classList.add('show'), 10);
            
            const cleanup = () => { 
                overlay.classList.remove('show'); 
                setTimeout(() => overlay.style.display = 'none', 300); 
                btnYes.removeEventListener('click', onYes); 
                btnNo.removeEventListener('click', onNo); 
            };
            const onYes = () => { cleanup(); playClick(); resolve(true); }; 
            const onNo = () => { cleanup(); resolve(false); };
            
            btnYes.addEventListener('click', onYes); 
            btnNo.addEventListener('click', onNo);
        });
    }

    // ======================================================
    // WIRING DOS BOTÕES DE ESTUDO
    // ======================================================
    
    if (disciplinaSelect) {
        disciplinaSelect.addEventListener("change", () => { 
            carregarDisciplinaBase(); 
            if (state.currentUser) carregarProgressoDaCloud(state.currentUser); 
        });
    }
    
    if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", () => iniciarTeste("normal"));
    if (carregarFraquezasBtn) carregarFraquezasBtn.addEventListener("click", () => iniciarTeste("mistakes"));
    
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', (e) => { 
            e.preventDefault(); 
            const isHidden = topicosContainer.style.display === 'none' || topicosContainer.style.display === ''; 
            topicosContainer.style.display = isHidden ? 'block' : 'none'; 
        });
    }

    // Retomar Quiz a meio
    if (retomarQuizBtn) {
        retomarQuizBtn.addEventListener("click", () => {
            const data = state.globalStorage[state.currentDisciplina]?.activeQuiz; 
            if (!data) return;
            
            state.quizData = data.quizData; 
            state.userAnswers = data.userAnswers || {}; 
            state.currentQuestionIndex = data.currentQuestionIndex || 0; 
            state.timeLeft = data.timeLeft || state.quizDurationSeconds;
            state.quizLoaded = true; 
            state.quizSubmitted = false; 
            state.isTreinoMode = false; 
            
            const resultBox = document.getElementById("resultado-final-box"); 
            if (resultBox) resultBox.style.display = "none";
            
            toggleConfigPanel(true);
            renderQuestionNavigator(); 
            renderCurrentQuestion(); 
            updateTopIndicators(); 
            updateNavButtonsState(); 
            updateQuestionStateLabel(); 
            startTimer();
            
            retomarQuizBtn.classList.add("hidden"); 
            showToast("Sessão retomada.", "info");
            
            if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    if (submeterQuizBtn) { 
        submeterQuizBtn.addEventListener("click", async () => { 
            const confirmado = await showCustomConfirm("Processar as respostas?"); 
            if(confirmado) verificarRespostas(false); 
        }); 
    }

    // Mídia
    if (btnLerResumo) btnLerResumo.addEventListener("click", (e) => { e.preventDefault(); openMediaModal('pdf'); });
    if (btnVerVideo) btnVerVideo.addEventListener("click", (e) => { e.preventDefault(); openMediaModal('video'); });

    // Navegação
    if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
    if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
    if (scrollTopBtn) { 
        window.addEventListener("scroll", () => { scrollTopBtn.style.display = window.scrollY > 250 ? "flex" : "none"; }); 
        scrollTopBtn.addEventListener("click", scrollToTopSmooth); 
    }

    // Reset Progresso
    if (resetProgressBtn) { 
        resetProgressBtn.addEventListener("click", async () => { 
            const confirmado = await showCustomConfirm(`Apagar cache neural em ${state.currentDisciplina}?`); 
            if (confirmado) { 
                state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} }; 
                localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage)); 
                await saveProgressToCloud(state.currentDisciplina, [], []); 
                updateGlobalProgressUI(); 
                showToast("Memória limpa.", "success");
            } 
        }); 
    }

    // ======================================================
    // DICIONÁRIO / PESQUISA INTERATIVA
    // ======================================================
    function procurarNoDicionario() {
        if(!dictSearchInput || !dictResultsContainer || !state.fullDatabase || !state.fullDatabase.length) return;
        const termo = dictSearchInput.value.toLowerCase().trim();
        dictResultsContainer.innerHTML = ""; 
        if(termo === "") return;
        
        const resultados = state.fullDatabase.filter(p => {
            let opcoesText = "";
            if (p.opcoes) {
                opcoesText = Array.isArray(p.opcoes) ? p.opcoes.join(" ") : Object.values(p.opcoes).join(" ");
            }
            const textoCompleto = ((p.pergunta || "") + " " + (p.contexto || "") + " " + (p.justificacao || "") + " " + opcoesText + " " + (p.pares ? p.pares.map(x=>x.conceito).join(" ") : "")).toLowerCase();
            return textoCompleto.includes(termo);
        });
        
        if(resultados.length === 0) { 
            const p = document.createElement('p'); 
            p.style.cssText = "font-size:0.9rem; color:var(--error); font-weight:600;"; 
            p.textContent = "Nenhum registo encontrado."; 
            dictResultsContainer.appendChild(p); 
            return; 
        }
        
        resultados.slice(0, 10).forEach((res) => {
            const card = document.createElement('div'); 
            card.className = "glass-panel"; 
            card.style.cssText = "margin-bottom: 12px; padding: 15px; border-left: 4px solid var(--primary);";
            
            const tema = document.createElement('strong'); 
            tema.style.cssText = "color:var(--text-main); display:block; margin-bottom:4px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;"; 
            tema.textContent = (res.macro_tema || "TEMA").replace(/_/g, ' ');
            
            const pergunta = document.createElement('i'); 
            pergunta.style.cssText = "color:var(--text-muted); display:block; margin-bottom:8px; font-size:0.9rem;"; 
            pergunta.textContent = res.pergunta;
            
            const answerBox = document.createElement('div'); 
            answerBox.style.cssText = "background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border);";
            
            const respCorreta = document.createElement('p'); 
            respCorreta.style.cssText = "margin: 0 0 8px 0; color: var(--success); font-weight:700;"; 
            respCorreta.textContent = `✅ ${res.resposta_correta || res.resposta_referencia || "Questão (Drag & Drop)"}`;
            
            const justificacao = document.createElement('p'); 
            justificacao.style.cssText = "margin: 0; font-size: 0.85rem; line-height: 1.4;"; 
            justificacao.textContent = res.justificacao || "";
            
            answerBox.append(respCorreta, justificacao); 
            card.append(tema, pergunta, answerBox); 
            dictResultsContainer.appendChild(card);
        });
        
        if(resultados.length > 10) {
            const footer = document.createElement('p'); 
            footer.style.cssText = "font-size:0.8rem; text-align:center; color: var(--text-muted);"; 
            footer.textContent = `[ A mostrar 10 de ${resultados.length} registos ]`; 
            dictResultsContainer.appendChild(footer);
        }
    }

    if (dictSearchInput) dictSearchInput.addEventListener("input", debounce(procurarNoDicionario, 300));
    window.addEventListener('dadosCarregados', () => procurarNoDicionario());

    // ======================================================
    // PWA & ATALHOS DE TECLADO
    // ======================================================
    window.addEventListener('beforeunload', (e) => { 
        if (state.quizLoaded && !state.quizSubmitted) { e.preventDefault(); e.returnValue = ''; } 
    });
    
    let deferredPrompt; 
    window.addEventListener('beforeinstallprompt', (e) => { 
        e.preventDefault(); deferredPrompt = e; 
        if (installAppBtn) installAppBtn.classList.remove('hidden'); 
    });
    
    if (installAppBtn) { 
        installAppBtn.addEventListener('click', async () => { 
            if (deferredPrompt) { 
                deferredPrompt.prompt(); 
                const { outcome } = await deferredPrompt.userChoice; 
                if (outcome === 'accepted') { installAppBtn.classList.add('hidden'); showToast("App instalada!", "success"); } 
                deferredPrompt = null; 
            } 
        }); 
    }

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!state.quizLoaded || state.quizSubmitted) return;
        
        if (e.key === 'ArrowLeft') { e.preventDefault(); if(prevQuestionBtn && !prevQuestionBtn.disabled) goToPreviousQuestion(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); if(nextQuestionBtn && !nextQuestionBtn.disabled) goToNextQuestion(); }
        
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            const activePanel = document.getElementById("activeExamPanel");
            if (submeterQuizBtn && activePanel && !activePanel.classList.contains('hidden')) { submeterQuizBtn.click(); } 
        }
        
        const keyMap = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 }; 
        const optionIndex = keyMap[e.key.toLowerCase()];
        
        if (optionIndex !== undefined) {
            const currentQ = state.quizData[state.currentQuestionIndex];
            if (currentQ && currentQ.tipo !== 'drag_and_drop' && currentQ.tipo !== 'open_ended') {
                const options = quizContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                if (options[optionIndex]) options[optionIndex].click();
            }
        }
    });

    // Inicializa o tema caso haja valor por defeito no localStorage antes do Firebase o ler
    const localTheme = localStorage.getItem("iscap-theme");
    if (localTheme) applyTheme(localTheme);
});