// js/quizController.js

import { state } from './store.js';
import { 
    playClick, playSadSound, playHappySound, playPartySound, fireConfetti 
} from './audio.js';
import { formatTime, showToast } from './utils.js';
import { 
    checkAndUpdateStreak, saveScoreToLeaderboard, saveProgressToCloud 
} from './firebaseManager.js';
import { 
    generateQuizDataLocally, getQuestionScore, isQuestionCorrect, getAnsweredCount, getAnsweredCountForIndex 
} from './quizLogic.js';
import { renderCurrentQuestion } from './questionBuilder.js';
import { renderLeaderboard, carregarDisciplinaBase } from './dataLoader.js';

let radarChartInstance = null; // Guarda a instância do gráfico para o podermos destruir e recriar

export function renderTopicsFilter() {
    const container = document.getElementById('topicosList');
    if(!container) return;
    container.innerHTML = ''; 
    const temas = [...new Set(state.fullDatabase.map(p => p.macro_tema).filter(Boolean))];
    
    temas.forEach(tema => {
        const label = document.createElement('label'); 
        label.style.cssText = "display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--secondary); padding:8px 12px; border-radius:8px; border:1px solid var(--border);";
        const checkbox = document.createElement('input'); 
        checkbox.type = "checkbox"; 
        checkbox.className = "topic-checkbox"; 
        checkbox.value = tema; 
        checkbox.checked = true;
        const span = document.createElement('span'); 
        span.style.cssText = "font-size:0.85rem; font-weight:600;"; 
        span.textContent = tema.replace(/_/g, ' ').toUpperCase();
        
        label.appendChild(checkbox); 
        label.appendChild(span); 
        container.appendChild(label);
    });
}

export function toggleConfigPanel(isExamActive) {
    const configPanel = document.getElementById("configPanel");
    const activeExamPanel = document.getElementById("activeExamPanel");
    const topicosContainer = document.getElementById("topicosContainer");

    if (configPanel) configPanel.style.display = isExamActive ? 'none' : 'block';
    if (activeExamPanel) {
        activeExamPanel.style.display = isExamActive ? 'block' : 'none';
        activeExamPanel.classList.remove('hidden'); 
    }
    if (!isExamActive && topicosContainer) topicosContainer.style.display = 'none';
}

export function guardarEstadoAmeio() {
    if(!state.quizLoaded || state.quizSubmitted) return;
    if(!state.globalStorage[state.currentDisciplina]) state.globalStorage[state.currentDisciplina] = {};
    
    state.globalStorage[state.currentDisciplina].activeQuiz = { 
        quizData: state.quizData, 
        userAnswers: state.userAnswers, 
        currentQuestionIndex: state.currentQuestionIndex, 
        timeLeft: state.timeLeft 
    };
    localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
}

export async function iniciarTeste(mode = "normal") {
    try {
        const modoEstudo = document.getElementById("modoEstudo");
        const quizContainer = document.getElementById("quiz-container");
        const retomarQuizBtn = document.getElementById("retomarQuizBtn");

        state.isTreinoMode = modoEstudo?.value === "treino"; 
        state.verifiedQuestions = {}; 
        
        const resultBox = document.getElementById("resultado-final-box"); 
        if (resultBox) resultBox.style.display = "none";
        
        if(quizContainer) quizContainer.innerHTML = "<div class='glass-panel' style='text-align:center; padding: 40px;'><h3 class='mono-data' style='color:var(--primary);'>A processar dados...</h3></div>";
        
        if (!state.fullDatabase || state.fullDatabase.length === 0) await carregarDisciplinaBase();

        const selectedTopics = Array.from(document.querySelectorAll('.topic-checkbox:checked')).map(cb => cb.value);
        state.quizData = generateQuizDataLocally(selectedTopics, mode);
        
        if (state.quizData.length === 0) {
            if(quizContainer) {
                quizContainer.innerHTML = "";
                const wrap = document.createElement('div'); wrap.className = "glass-panel"; wrap.style.textAlign = "center";
                const icon = document.createElement('div'); icon.style.cssText = "font-size:3rem; margin-bottom:15px;"; icon.textContent = "⚠️";
                const title = document.createElement('h2'); title.textContent = "Sem dados";
                const p = document.createElement('p'); p.textContent = "Verifica os filtros de tópicos ou a tua lista de erros.";
                wrap.append(icon, title, p); quizContainer.appendChild(wrap);
            }
            return;
        }

        state.userAnswers = {}; 
        state.currentQuestionIndex = 0; 
        state.quizLoaded = true; 
        state.quizSubmitted = false;
        
        if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden");

        toggleConfigPanel(true); 
        renderQuestionNavigator(); 
        renderCurrentQuestion(); 
        updateTopIndicators(); 
        updateNavButtonsState(); 
        updateQuestionStateLabel();
        
        resetTimer(); 
        
        if (!state.isTreinoMode) { 
            startTimer(); 
        } else { 
            stopTimer(); 
            updateTimerUI(); 
        }
        
        guardarEstadoAmeio(); 
        playClick(); 
        showToast(`Sessão iniciada. Boa sorte!`, 'info');
        
        if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { 
        showToast("Erro ao processar o teste.", "error"); 
    }
}

export async function verificarRespostas(submissaoAutomatica = false) {
    if (!state.quizLoaded || state.quizSubmitted) return;
    state.quizSubmitted = true; 
    stopTimer(); 
    guardarResultadosNaMemoria();

    let pontuacaoPonderada = 0; 
    let errosComPenalizacao = 0; 
    let respondidas = 0;
    
    state.quizData.forEach((q, i) => { 
        if (getAnsweredCountForIndex(i)) {
            respondidas++; 
            const score = getQuestionScore(q, i); 
            pontuacaoPonderada += score; 
            if (score === 0) errosComPenalizacao++; 
        }
    });

    const valorPorPergunta = 20 / state.quizData.length;
    let notaCalculada = (pontuacaoPonderada * valorPorPergunta) - (errosComPenalizacao * valorPorPergunta * state.penalizacaoPorErro);
    if (notaCalculada < 0) notaCalculada = 0; 
    const notaMoodle = notaCalculada.toFixed(2);
    
    if (notaCalculada >= 19.99) { 
        playPartySound(); fireConfetti(); showToast("Nota Máxima! Excecional!", "success"); 
    } else if (notaCalculada >= 9.5) { 
        playHappySound(); showToast("Parabéns, tiveste nota positiva!", "success"); 
    } else { 
        playSadSound(); showToast("Abaixo da média. Continua a praticar!", "warning"); 
    }

    const resultBox = document.getElementById("resultado-final-box");
    if (resultBox) {
        resultBox.innerHTML = "";
        const holo = document.createElement('div'); holo.className = "hologram-result";
        
        const h2 = document.createElement('h2'); 
        h2.style.cssText = "text-transform: uppercase; font-size: 1.1rem; color: var(--text-muted); letter-spacing: 2px;"; 
        h2.textContent = submissaoAutomatica ? "Análise Abortada (Timeout)" : "Análise Concluída";
        
        const scoreDiv = document.createElement('div'); 
        scoreDiv.className = "score-display mono-data"; 
        scoreDiv.textContent = notaMoodle + " ";
        
        const scoreSpan = document.createElement('span'); 
        scoreSpan.style.cssText = "font-size: 2rem; color: var(--text-muted);"; 
        scoreSpan.textContent = "/ 20";
        scoreDiv.appendChild(scoreSpan);
        
        const pStats = document.createElement('p'); 
        pStats.style.cssText = "font-size: 1.1rem; color: var(--text-main);";
        pStats.innerHTML = `Precisão do modelo: <strong style="color:var(--primary);">${pontuacaoPonderada}</strong> acertos em ${state.quizData.length} blocos. Omissões: <strong style="color:var(--primary);">${state.quizData.length - respondidas}</strong>.`;
        
        holo.append(h2, scoreDiv, pStats);

        if (state.penalizacaoPorErro > 0) {
            const pAviso = document.createElement('p'); 
            pAviso.style.cssText = "font-size: 0.85rem; color: var(--warning); margin-top: 15px; background: rgba(217, 119, 6, 0.1); padding: 10px; border-radius: 8px;";
            pAviso.textContent = `Aviso: Desconto ativado de -${(state.penalizacaoPorErro * 100).toFixed(0)}% por erro total.`;
            holo.appendChild(pAviso);
        }
        resultBox.appendChild(holo); 
        resultBox.style.display = "block";
    }
    
    if (!state.isTreinoMode) { 
        await saveScoreToLeaderboard(state.currentDisciplina, notaMoodle); 
        renderLeaderboard(); 
    }
    
    toggleConfigPanel(false); 
    state.currentQuestionIndex = 0;
    renderQuestionNavigator(); 
    renderCurrentQuestion(); 
    updateQuestionStateLabel(); 
    scrollToTopSmooth();
}

export async function guardarResultadosNaMemoria() {
    if (!state.globalStorage[state.currentDisciplina]) state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
    const subjData = state.globalStorage[state.currentDisciplina];
    
    state.quizData.forEach((q, i) => {
        const isCorrect = isQuestionCorrect(q, i); 
        const pId = q.id || `q_${btoa(q.pergunta).substring(0,10)}`; 
        if (isCorrect) { 
            if (!subjData.correct.includes(pId)) subjData.correct.push(pId); 
            subjData.wrong = subjData.wrong.filter(id => id !== pId); 
        } else { 
            if (!subjData.wrong.includes(pId) && !subjData.correct.includes(pId)) subjData.wrong.push(pId); 
        }
    });
    
    localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
    updateGlobalProgressUI(); 
    
    const streakInfo = await checkAndUpdateStreak(true);
    const streakEl = document.getElementById('streakDays'); 
    if (streakEl) streakEl.textContent = streakInfo;
    
    try { 
        await saveProgressToCloud(state.currentDisciplina, subjData.correct, subjData.wrong); 
    } catch (error) {}
}

export function updateGlobalProgressUI() {
    const globalProgressText = document.getElementById("globalProgressText");
    const globalProgressBarFill = document.getElementById("globalProgressBarFill");
    const globalProgressPercent = document.getElementById("globalProgressPercent");
    const themeAnalyticsContainer = document.getElementById("themeAnalyticsContainer");

    if (!globalProgressText || !state.fullDatabase || !state.fullDatabase.length) return;
    
    const subjData = state.globalStorage[state.currentDisciplina] || { correct: [], wrong: [] };
    const totalQuestions = state.fullDatabase.length; 
    const correctCount = subjData.correct ? subjData.correct.length : 0;
    const percentage = Math.min(100, Math.round((correctCount / totalQuestions) * 100));
    
    globalProgressText.textContent = `${correctCount} / ${totalQuestions}`;
    if(globalProgressBarFill) globalProgressBarFill.style.width = `${percentage}%`;
    if(globalProgressPercent) globalProgressPercent.textContent = `${percentage}%`;

    if (themeAnalyticsContainer) {
        const temasEstatisticas = {};
        state.fullDatabase.forEach(p => {
            if(!p.macro_tema) return; 
            if(!temasEstatisticas[p.macro_tema]) temasEstatisticas[p.macro_tema] = { total: 0, certos: 0 };
            temasEstatisticas[p.macro_tema].total++; 
            if (subjData.correct && subjData.correct.includes(p.id)) temasEstatisticas[p.macro_tema].certos++;
        });
        
        const labels = Object.keys(temasEstatisticas).map(t => t.replace(/_/g, ' ')); 
        const dataValues = Object.values(temasEstatisticas).map(s => Math.round((s.certos / s.total) * 100));
        
        themeAnalyticsContainer.innerHTML = '<canvas id="radarChart"></canvas>'; 
        const ctx = document.getElementById('radarChart').getContext('2d');
        
        if (radarChartInstance) radarChartInstance.destroy(); 
        
        radarChartInstance = new Chart(ctx, { 
            type: 'radar', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Domínio (%)', 
                    data: dataValues, 
                    backgroundColor: 'rgba(225, 29, 72, 0.3)', 
                    borderColor: '#e11d48', 
                    pointBackgroundColor: '#10b981', 
                    borderWidth: 2 
                }] 
            }, 
            options: { 
                responsive: true, 
                scales: { r: { ticks: { display: false, min: 0, max: 100 } } }, 
                plugins: { legend: { display: false } } 
            } 
        });
    }
}

// TIMERS
export function stopTimer() { 
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } 
}

export function updateTimerUI() { 
    const timerElement = document.getElementById("timer");
    if (timerElement) timerElement.textContent = state.isTreinoMode ? "TREINO (∞)" : formatTime(state.timeLeft); 
}

export function resetTimer() { 
    stopTimer(); state.timeLeft = state.quizDurationSeconds; updateTimerUI(); 
}

export function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
        state.timeLeft -= 1; 
        if (state.timeLeft % 15 === 0) guardarEstadoAmeio(); 
        if (state.timeLeft <= 0) { 
            state.timeLeft = 0; updateTimerUI(); stopTimer(); 
            if (state.quizLoaded && !state.quizSubmitted) verificarRespostas(true); 
            return; 
        }
        updateTimerUI();
    }, 1000);
}

// NAVEGAÇÃO
export function scrollToTopSmooth() { 
    window.scrollTo({ top: 0, behavior: "smooth" }); 
}

export function goToQuestion(index) { 
    state.currentQuestionIndex = index; 
    renderCurrentQuestion(); 
    updateNavButtonsState(); 
    renderQuestionNavigator(); 
    guardarEstadoAmeio(); 
}

export function goToPreviousQuestion() { 
    if (state.currentQuestionIndex > 0) goToQuestion(state.currentQuestionIndex - 1); 
}

export function goToNextQuestion() { 
    if (state.currentQuestionIndex < state.quizData.length - 1) goToQuestion(state.currentQuestionIndex + 1); 
}

export function updateNavButtonsState() {
    const prevQuestionBtn = document.getElementById("prevQuestionBtn");
    const nextQuestionBtn = document.getElementById("nextQuestionBtn");
    if (!state.quizData.length) { 
        if(prevQuestionBtn) prevQuestionBtn.disabled = true; 
        if(nextQuestionBtn) nextQuestionBtn.disabled = true; 
        return; 
    }
    if(prevQuestionBtn) prevQuestionBtn.disabled = state.currentQuestionIndex === 0;
    if(nextQuestionBtn) nextQuestionBtn.disabled = state.currentQuestionIndex === state.quizData.length - 1;
}

export function updateQuestionStateLabel() {
    const quizStateText = document.getElementById("quizStateText");
    if (!quizStateText) return;
    if (!state.quizLoaded) return quizStateText.textContent = "Offline";
    if (state.quizSubmitted) return quizStateText.textContent = "Processado";
    const answered = getAnsweredCount();
    if (answered === 0) return quizStateText.textContent = "Online";
    if (answered === state.quizData.length) return quizStateText.textContent = "Pronto a Submeter";
    return quizStateText.textContent = "Em Execução";
}

export function updateTopIndicators() {
    const currentQuestionIndicator = document.getElementById("currentQuestionIndicator");
    const answeredCountElement = document.getElementById("answeredCount");
    const remainingCountElement = document.getElementById("remainingCount");
    
    const total = state.quizData.length || 0; 
    const answered = getAnsweredCount(); 
    const remaining = Math.max(total - answered, 0);
    
    if (currentQuestionIndicator) currentQuestionIndicator.textContent = state.quizLoaded ? `${state.currentQuestionIndex + 1}` : `0`;
    if (answeredCountElement) answeredCountElement.textContent = String(answered);
    if (remainingCountElement) remainingCountElement.textContent = String(remaining);
}

export function renderQuestionNavigator() {
    const questionNavigator = document.getElementById("questionNavigator");
    if (!questionNavigator) return;
    questionNavigator.innerHTML = ""; 
    if (!state.quizData.length) return;
    
    state.quizData.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.type = "button";
        let className = "nav-node";
        if (index === state.currentQuestionIndex) className += " is-active";
        if (getAnsweredCountForIndex(index) && !state.quizSubmitted) className += " is-answered";
        
        if (state.quizSubmitted || state.verifiedQuestions[index]) {
            const score = getQuestionScore(q, index);
            if (score === 1) className += " is-correct";
            else if (score === 0.5) className += " is-partial";
            else className += " is-incorrect";
        }
        btn.className = className;
        btn.dataset.questionIndex = index;
        btn.textContent = index + 1;
        btn.addEventListener("click", () => goToQuestion(Number(btn.dataset.questionIndex)));
        questionNavigator.appendChild(btn);
    });
}