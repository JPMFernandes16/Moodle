// js/main.js
import { playDing, playClick, playSadSound, playHappySound, playPartySound, fireConfetti, playWarningSound } from './audio.js';
import { escapeHtml, normalizeText, removeAcentos, formatTime, timeAgo, debounce } from './utils.js';
import { initAuth } from './auth.js';

// --- FIREBASE IMPORTS ---
import { auth, db } from './firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// --- MÓDULOS DE ARQUITETURA ---
import { state } from './store.js';
import { 
    carregarTemaDaCloud, 
    guardarTemaNaCloud, 
    checkAndUpdateStreak, 
    fetchLeaderboardData, 
    saveScoreToLeaderboard, 
    reportQuestionToCloud, 
    saveProgressToCloud,
    fetchUserProfile 
} from './firebaseManager.js';
import { generateQuizDataLocally, getQuestionScore, isQuestionCorrect, getAnsweredCount, getAnsweredCountForIndex } from './quizLogic.js';

document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  // ======================================================
  // ELEMENTOS DO DOM
  // ======================================================
  const disciplinaSelect = document.getElementById("disciplina");
  const carregarQuizBtn = document.getElementById("carregarQuiz");
  const carregarFraquezasBtn = document.getElementById("carregarFraquezas");
  const retomarQuizBtn = document.getElementById("retomarQuizBtn"); 
  const submeterQuizBtn = document.getElementById("submeterQuiz");
  const timerElement = document.getElementById("timer");
  const currentQuestionIndicator = document.getElementById("currentQuestionIndicator");
  const answeredCountElement = document.getElementById("answeredCount");
  const remainingCountElement = document.getElementById("remainingCount");
  const quizStateText = document.getElementById("quizStateText");
  const questionNavigator = document.getElementById("questionNavigator");
  const quizContainer = document.getElementById("quiz-container");
  const prevQuestionBtn = document.getElementById("prevQuestionBtn");
  const nextQuestionBtn = document.getElementById("nextQuestionBtn");
  const themeToggle = document.getElementById("themeToggle");
  const scrollTopBtn = document.getElementById("scrollTopBtn");
  const installAppBtn = document.getElementById("installAppBtn");
  const lastUpdateText = document.getElementById("lastUpdateText"); 

  const globalProgressText = document.getElementById("globalProgressText");
  const globalProgressBarFill = document.getElementById("globalProgressBarFill");
  const globalProgressPercent = document.getElementById("globalProgressPercent");
  const resetProgressBtn = document.getElementById("resetProgressBtn");
  const themeAnalyticsContainer = document.getElementById("themeAnalyticsContainer");

  const dictSearchInput = document.getElementById("dictSearchInput");
  const dictResultsContainer = document.getElementById("dictResultsContainer");
  
  const configPanel = document.getElementById("configPanel");
  const activeExamPanel = document.getElementById("activeExamPanel");
  const btnToggleFiltros = document.getElementById("btnToggleFiltros");
  const topicosContainer = document.getElementById("topicosContainer");
  const modoEstudo = document.getElementById("modoEstudo");

  // Elementos do Menu Lateral Mobile (Drawer)
  const btnMobileSidebar = document.getElementById('btnMobileSidebar');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
  const mobileSidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  let radarChartInstance = null;

  // ======================================================
  // SISTEMA DE NOTIFICAÇÕES (TOASTS)
  // ======================================================
  function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      let icon = 'ℹ️';
      if(type === 'success') icon = '✅';
      if(type === 'error') icon = '❌';
      if(type === 'warning') icon = '⚠️';
      
      const iconSpan = document.createElement('span'); iconSpan.textContent = icon;
      const msgSpan = document.createElement('span'); msgSpan.textContent = message;
      
      toast.appendChild(iconSpan); toast.appendChild(msgSpan);
      container.appendChild(toast);
      
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 400); 
      }, 3500);
  }

  // ======================================================
  // AUTENTICAÇÃO E INICIALIZAÇÃO
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
          state.currentUser = null; state.userProfile = null;
          state.quizData = []; state.fullDatabase = []; state.globalStorage = {};
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
  // CARREGAMENTO DE DADOS (BASE E PROGRESSO)
  // ======================================================
  async function carregarDisciplinaBase() {
      state.currentDisciplina = disciplinaSelect?.value || "BIA_BIAT";
      try {
          let response = await fetch(`data/${state.currentDisciplina}.json`);
          if (!response.ok) response = await fetch(`${state.currentDisciplina}.json`);
          if (!response.ok) throw new Error(`Ficheiro não encontrado.`);

          const data = await response.json();
          state.fullDatabase = data.perguntas || [];
          state.configDatabase = data.configuracao_teste || {};
          
          const regrasExame = data.opcoes_exame || {};
          state.quizDurationSeconds = (regrasExame.duracao_minutos || 40) * 60;
          state.penalizacaoPorErro = regrasExame.desconto_erro || 0;
          
          resetTimer(); renderTopicsFilter(); renderLeaderboard();   
          
          if (dictSearchInput && disciplinaSelect) dictSearchInput.placeholder = `Pesquisar em ${disciplinaSelect.options[disciplinaSelect.selectedIndex].text}...`;

          const btnLerResumo = document.getElementById("btnLerResumo");
          if (btnLerResumo) { btnLerResumo.href = `pdfs/${state.currentDisciplina}.pdf`; btnLerResumo.removeAttribute("download"); btnLerResumo.setAttribute("target", "_blank"); }
          
          if(dictSearchInput) procurarNoDicionario();
          updateGlobalProgressUI();
      } catch (e) { showToast(`Erro ao carregar ficheiro da cadeira.`, 'error'); }
  }

  function carregarProgressoDaCloud(user) {
      if (!user || !state.currentDisciplina) return;
      if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
      
      state.unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid, "progress", state.currentDisciplina), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              state.globalStorage[state.currentDisciplina] = data;
              if (lastUpdateText) lastUpdateText.textContent = data.lastUpdate ? `Última revisão: ${timeAgo(data.lastUpdate)}` : "Ainda não há dados.";
              if (data.activeQuiz && data.activeQuiz.quizData && data.activeQuiz.quizData.length > 0 && !state.quizLoaded) {
                  if (retomarQuizBtn) retomarQuizBtn.classList.remove("hidden");
              } else { if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden"); }
          } else {
              state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
              if (lastUpdateText) lastUpdateText.textContent = "Ainda não há dados.";
          }
          localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
          updateGlobalProgressUI();
      }, (error) => { showToast("A sincronizar localmente...", "warning"); });
  }

  async function renderLeaderboard() {
      const container = document.getElementById('leaderboardContainer');
      if(!container) return;
      container.textContent = 'A carregar ranking do servidor...'; 
      container.style.cssText = "text-align:center; color:var(--text-muted); font-size:0.85rem; padding:10px;";
      
      try {
          const results = await fetchLeaderboardData(state.currentDisciplina);
          container.textContent = ''; container.style.cssText = ""; 
          
          if(results.length === 0) {
              const p = document.createElement('p');
              p.textContent = 'Ainda não há resultados. Sê o primeiro!';
              p.style.cssText = "text-align:center; font-size:0.85rem; color:var(--text-muted);";
              container.appendChild(p); return;
          }
          
          results.forEach((data, idx) => {
              let medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🏅'));
              const row = document.createElement('div'); row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--secondary); border:1px solid var(--border); border-radius:8px;";
              const leftDiv = document.createElement('div'); leftDiv.style.cssText = "display:flex; align-items:center; gap:10px;";
              
              const medalSpan = document.createElement('span'); medalSpan.style.fontSize = "1.2rem"; medalSpan.textContent = medal;
              const nameSpan = document.createElement('span'); nameSpan.style.cssText = "font-weight:700; font-size:0.9rem;"; nameSpan.textContent = data.nome;
              leftDiv.appendChild(medalSpan); leftDiv.appendChild(nameSpan);
              
              const scoreSpan = document.createElement('span'); scoreSpan.className = "mono-data"; scoreSpan.style.cssText = "color:var(--primary); font-weight:800;"; scoreSpan.textContent = data.score.toFixed(2);
              
              row.appendChild(leftDiv); row.appendChild(scoreSpan); container.appendChild(row);
          });
      } catch(e) { container.textContent = 'Erro ao carregar ranking.'; container.style.color = 'var(--error)'; }
  }

  // ======================================================
  // ESTUDO E QUIZ
  // ======================================================
  function renderTopicsFilter() {
      const container = document.getElementById('topicosList');
      if(!container) return;
      container.innerHTML = ''; 
      const temas = [...new Set(state.fullDatabase.map(p => p.macro_tema).filter(Boolean))];
      
      temas.forEach(tema => {
          const label = document.createElement('label'); label.style.cssText = "display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--secondary); padding:8px 12px; border-radius:8px; border:1px solid var(--border);";
          const checkbox = document.createElement('input'); checkbox.type = "checkbox"; checkbox.className = "topic-checkbox"; checkbox.value = tema; checkbox.checked = true;
          const span = document.createElement('span'); span.style.cssText = "font-size:0.85rem; font-weight:600;"; span.textContent = tema.replace(/_/g, ' ').toUpperCase();
          label.appendChild(checkbox); label.appendChild(span); container.appendChild(label);
      });
  }

  function toggleConfigPanel(isExamActive) {
      if (configPanel) configPanel.style.display = isExamActive ? 'none' : 'block';
      if (activeExamPanel) {
          activeExamPanel.style.display = isExamActive ? 'block' : 'none';
          activeExamPanel.classList.remove('hidden'); 
      }
      if (!isExamActive && topicosContainer) topicosContainer.style.display = 'none';
  }

  function guardarEstadoAmeio() {
      if(!state.quizLoaded || state.quizSubmitted) return;
      if(!state.globalStorage[state.currentDisciplina]) state.globalStorage[state.currentDisciplina] = {};
      state.globalStorage[state.currentDisciplina].activeQuiz = { quizData: state.quizData, userAnswers: state.userAnswers, currentQuestionIndex: state.currentQuestionIndex, timeLeft: state.timeLeft };
      localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
  }

  async function iniciarTeste(mode = "normal") {
      try {
          state.isTreinoMode = modoEstudo?.value === "treino"; state.verifiedQuestions = {}; 
          const resultBox = document.getElementById("resultado-final-box"); if (resultBox) resultBox.style.display = "none";
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

          state.userAnswers = {}; state.currentQuestionIndex = 0; state.quizLoaded = true; state.quizSubmitted = false;
          if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden");

          toggleConfigPanel(true); renderQuestionNavigator(); renderCurrentQuestion(); updateTopIndicators(); updateNavButtonsState(); updateQuestionStateLabel();
          if (!state.isTreinoMode) { startTimer(); } else { stopTimer(); updateTimerUI(); }
          
          guardarEstadoAmeio(); playClick(); showToast(`Sessão iniciada. Boa sorte!`, 'info');
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { showToast("Erro ao processar o teste.", "error"); }
  }

  // ======================================================
  // PROCESSAMENTO E RENDERIZAÇÃO DO RESULTADO
  // ======================================================
  async function verificarRespostas(submissaoAutomatica = false) {
      if (!state.quizLoaded || state.quizSubmitted) return;
      state.quizSubmitted = true; stopTimer(); guardarResultadosNaMemoria();

      let pontuacaoPonderada = 0; let errosComPenalizacao = 0; let respondidas = 0;
      state.quizData.forEach((q, i) => { 
          if (getAnsweredCountForIndex(i)) {
              respondidas++; const score = getQuestionScore(q, i); 
              pontuacaoPonderada += score; if (score === 0) errosComPenalizacao++; 
          }
      });

      const valorPorPergunta = 20 / state.quizData.length;
      let notaCalculada = (pontuacaoPonderada * valorPorPergunta) - (errosComPenalizacao * valorPorPergunta * state.penalizacaoPorErro);
      if (notaCalculada < 0) notaCalculada = 0; const notaMoodle = notaCalculada.toFixed(2);
      
      if (notaCalculada >= 19.99) { playPartySound(); fireConfetti(); showToast("Nota Máxima! Excecional!", "success"); } 
      else if (notaCalculada >= 9.5) { playHappySound(); showToast("Parabéns, tiveste nota positiva!", "success"); } 
      else { playSadSound(); showToast("Abaixo da média. Continua a praticar!", "warning"); }

      const resultBox = document.getElementById("resultado-final-box");
      if (resultBox) {
          resultBox.innerHTML = "";
          const holo = document.createElement('div'); holo.className = "hologram-result";
          const h2 = document.createElement('h2'); h2.style.cssText = "text-transform: uppercase; font-size: 1.1rem; color: var(--text-muted); letter-spacing: 2px;"; h2.textContent = submissaoAutomatica ? "Análise Abortada (Timeout)" : "Análise Concluída";
          const scoreDiv = document.createElement('div'); scoreDiv.className = "score-display mono-data"; scoreDiv.textContent = notaMoodle + " ";
          const scoreSpan = document.createElement('span'); scoreSpan.style.cssText = "font-size: 2rem; color: var(--text-muted);"; scoreSpan.textContent = "/ 20";
          scoreDiv.appendChild(scoreSpan);
          
          const pStats = document.createElement('p'); pStats.style.cssText = "font-size: 1.1rem; color: var(--text-main);";
          pStats.innerHTML = `Precisão do modelo: <strong style="color:var(--primary);">${pontuacaoPonderada}</strong> acertos em ${state.quizData.length} blocos. Omissões: <strong style="color:var(--primary);">${state.quizData.length - respondidas}</strong>.`;
          
          holo.append(h2, scoreDiv, pStats);

          if (state.penalizacaoPorErro > 0) {
              const pAviso = document.createElement('p'); pAviso.style.cssText = "font-size: 0.85rem; color: var(--warning); margin-top: 15px; background: rgba(217, 119, 6, 0.1); padding: 10px; border-radius: 8px;";
              pAviso.textContent = `Aviso: Desconto ativado de -${(state.penalizacaoPorErro * 100).toFixed(0)}% por erro total.`;
              holo.appendChild(pAviso);
          }
          resultBox.appendChild(holo); resultBox.style.display = "block";
      }
      
      if (!state.isTreinoMode) { await saveScoreToLeaderboard(state.currentDisciplina, notaMoodle); renderLeaderboard(); }
      toggleConfigPanel(false); state.currentQuestionIndex = 0;
      renderQuestionNavigator(); renderCurrentQuestion(); updateQuestionStateLabel(); scrollToTopSmooth();
  }

  async function guardarResultadosNaMemoria() {
      if (!state.globalStorage[state.currentDisciplina]) state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
      const subjData = state.globalStorage[state.currentDisciplina];
      state.quizData.forEach((q, i) => {
          const isCorrect = isQuestionCorrect(q, i); const pId = q.id || `q_${btoa(q.pergunta).substring(0,10)}`; 
          if (isCorrect) { if (!subjData.correct.includes(pId)) subjData.correct.push(pId); subjData.wrong = subjData.wrong.filter(id => id !== pId); } 
          else { if (!subjData.wrong.includes(pId) && !subjData.correct.includes(pId)) subjData.wrong.push(pId); }
      });
      localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
      updateGlobalProgressUI(); const streakInfo = await checkAndUpdateStreak(true);
      const streakEl = document.getElementById('streakDays'); if (streakEl) streakEl.textContent = streakInfo;
      try { await saveProgressToCloud(state.currentDisciplina, subjData.correct, subjData.wrong); } catch (error) {}
  }

  function updateGlobalProgressUI() {
    if (!globalProgressText || !state.fullDatabase || !state.fullDatabase.length) return;
    const subjData = state.globalStorage[state.currentDisciplina] || { correct: [], wrong: [] };
    const totalQuestions = state.fullDatabase.length; const correctCount = subjData.correct ? subjData.correct.length : 0;
    const percentage = Math.min(100, Math.round((correctCount / totalQuestions) * 100));
    globalProgressText.textContent = `${correctCount} / ${totalQuestions}`;
    if(globalProgressBarFill) globalProgressBarFill.style.width = `${percentage}%`;
    if(globalProgressPercent) globalProgressPercent.textContent = `${percentage}%`;

    if (themeAnalyticsContainer) {
        const temasEstatisticas = {};
        state.fullDatabase.forEach(p => {
            if(!p.macro_tema) return; 
            if(!temasEstatisticas[p.macro_tema]) temasEstatisticas[p.macro_tema] = { total: 0, certos: 0 };
            temasEstatisticas[p.macro_tema].total++; if (subjData.correct && subjData.correct.includes(p.id)) temasEstatisticas[p.macro_tema].certos++;
        });
        const labels = Object.keys(temasEstatisticas).map(t => t.replace(/_/g, ' ')); const dataValues = Object.values(temasEstatisticas).map(s => Math.round((s.certos / s.total) * 100));
        themeAnalyticsContainer.innerHTML = '<canvas id="radarChart"></canvas>'; const ctx = document.getElementById('radarChart').getContext('2d');
        if (radarChartInstance) radarChartInstance.destroy(); 
        radarChartInstance = new Chart(ctx, { type: 'radar', data: { labels: labels, datasets: [{ label: 'Domínio (%)', data: dataValues, backgroundColor: 'rgba(225, 29, 72, 0.3)', borderColor: '#e11d48', pointBackgroundColor: '#10b981', borderWidth: 2 }] }, options: { responsive: true, scales: { r: { ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false } } } });
    }
  }

  function stopTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }
  function updateTimerUI() { if (timerElement) timerElement.textContent = state.isTreinoMode ? "TREINO (∞)" : formatTime(state.timeLeft); }
  function resetTimer() { stopTimer(); state.timeLeft = state.quizDurationSeconds; updateTimerUI(); }
  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      state.timeLeft -= 1; if (state.timeLeft % 15 === 0) guardarEstadoAmeio(); 
      if (state.timeLeft <= 0) { state.timeLeft = 0; updateTimerUI(); stopTimer(); if (state.quizLoaded && !state.quizSubmitted) verificarRespostas(true); return; }
      updateTimerUI();
    }, 1000);
  }

  function scrollToTopSmooth() { window.scrollTo({ top: 0, behavior: "smooth" }); }
  function goToQuestion(index) { state.currentQuestionIndex = index; renderCurrentQuestion(); updateNavButtonsState(); renderQuestionNavigator(); guardarEstadoAmeio(); }
  function goToPreviousQuestion() { if (state.currentQuestionIndex > 0) goToQuestion(state.currentQuestionIndex - 1); }
  function goToNextQuestion() { if (state.currentQuestionIndex < state.quizData.length - 1) goToQuestion(state.currentQuestionIndex + 1); }

  function updateNavButtonsState() {
    if (!state.quizData.length) { if(prevQuestionBtn) prevQuestionBtn.disabled = true; if(nextQuestionBtn) nextQuestionBtn.disabled = true; return; }
    if(prevQuestionBtn) prevQuestionBtn.disabled = state.currentQuestionIndex === 0;
    if(nextQuestionBtn) nextQuestionBtn.disabled = state.currentQuestionIndex === state.quizData.length - 1;
  }

  function updateQuestionStateLabel() {
    if (!quizStateText) return;
    if (!state.quizLoaded) return quizStateText.textContent = "Offline";
    if (state.quizSubmitted) return quizStateText.textContent = "Processado";
    const answered = getAnsweredCount();
    if (answered === 0) return quizStateText.textContent = "Online";
    if (answered === state.quizData.length) return quizStateText.textContent = "Pronto a Submeter";
    return quizStateText.textContent = "Em Execução";
  }

  function updateTopIndicators() {
    const total = state.quizData.length || 0; const answered = getAnsweredCount(); const remaining = Math.max(total - answered, 0);
    if (currentQuestionIndicator) currentQuestionIndicator.textContent = state.quizLoaded ? `${state.currentQuestionIndex + 1}` : `0`;
    if (answeredCountElement) answeredCountElement.textContent = String(answered);
    if (remainingCountElement) remainingCountElement.textContent = String(remaining);
  }

  function renderQuestionNavigator() {
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

  // ======================================================
  // CONSTRUÇÃO BLINDADA DO QUIZ (SEM XSS)
  // ======================================================
  function renderCurrentQuestion() {
      if (!state.quizData.length || !quizContainer) return;
      quizContainer.innerHTML = ""; 
      
      const question = state.quizData[state.currentQuestionIndex];
      const selectedAnswer = state.userAnswers[state.currentQuestionIndex];
      const showResult = state.quizSubmitted || state.verifiedQuestions[state.currentQuestionIndex];
      const score = showResult ? getQuestionScore(question, state.currentQuestionIndex) : null;
      const isCorrect = score === 1; const isPartial = score === 0.5;

      const card = document.createElement('div');
      card.className = `glass-panel question-card ${showResult && score === 0 ? 'shake' : ''}`;
      if(showResult) { card.classList.add(isCorrect ? "correct" : (isPartial ? "" : "incorrect")); if(isPartial) card.style.borderLeft = "4px solid var(--warning)"; }
      card.id = `q-card-${state.currentQuestionIndex}`;

      const qMeta = document.createElement('div'); qMeta.className = "q-meta";
      const metaLeft = document.createElement('div'); metaLeft.style.cssText = "display:flex; gap:10px; align-items:center;";
      const badge = document.createElement('span'); badge.className = "q-badge"; badge.textContent = `Q.${state.currentQuestionIndex + 1}`; metaLeft.appendChild(badge);
      if (question.macro_tema) { const topic = document.createElement('span'); topic.className = "q-topic"; topic.textContent = question.macro_tema.replace(/_/g, ' '); metaLeft.appendChild(topic); }
      
      const btnReport = document.createElement('button'); btnReport.id = "btnReportQ"; btnReport.title = "Reportar erro"; btnReport.style.cssText = "background:none; border:none; font-size:1.2rem; cursor:pointer; opacity:0.6;"; btnReport.textContent = "🚩";
      qMeta.append(metaLeft, btnReport); card.appendChild(qMeta);

      const title = document.createElement('h2'); title.className = "q-title"; title.textContent = question.pergunta; card.appendChild(title);

      if (question.tipo === "drag_and_drop") card.appendChild(buildDragAndDrop(question, selectedAnswer, showResult));
      else if (question.tipo === "open_ended") card.appendChild(buildOpenEnded(question, selectedAnswer, showResult));
      else card.appendChild(buildMultipleChoice(question, selectedAnswer, showResult));

      if (showResult) {
          const statusColor = isCorrect ? 'var(--success)' : (isPartial ? 'var(--warning)' : 'var(--error)');
          const statusText = isCorrect ? '✅ Resposta Validada' : (isPartial ? '⚠️ Resposta Incompleta' : '❌ Anomalia Detetada');
          
          const resultBox = document.createElement('div'); resultBox.style.cssText = `margin-top: 25px; padding: 20px; background: var(--bg-body); border-radius: var(--radius-sm); border: 1px solid ${statusColor}; border-left: 4px solid ${statusColor};`;
          const pStatus = document.createElement('p'); pStatus.style.cssText = `color: ${statusColor}; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px;`; pStatus.textContent = statusText; resultBox.appendChild(pStatus);
          
          if (question.tipo === "open_ended") { const pRef = document.createElement('p'); pRef.innerHTML = `<strong>Referência:</strong> ${escapeHtml(question.resposta_referencia)}`; resultBox.appendChild(pRef); }
          else if (question.tipo === "multiple_choice" || question.tipo === "multiple_select" || question.tipo === "true_false") {
             const cText = Array.isArray(question.resposta_correta) ? question.resposta_correta.join(" | ") : question.resposta_correta;
             const pCerta = document.createElement('p'); pCerta.innerHTML = `<strong>Certa(s):</strong> ${escapeHtml(cText)}`; resultBox.appendChild(pCerta);
          }
          
          const justBox = document.createElement('div'); justBox.style.cssText = "margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;";
          const pJust = document.createElement('p'); pJust.style.cssText = "margin:0; font-size: 0.95rem;"; pJust.innerHTML = `<strong>Justificação:</strong> ${escapeHtml(question.justificacao)}`;
          justBox.appendChild(pJust); resultBox.appendChild(justBox); card.appendChild(resultBox);
      } 
      else if (state.isTreinoMode) {
          const btnVerif = document.createElement('button'); btnVerif.id = "btnVerificarTreino"; btnVerif.className = "btn btn--primary"; btnVerif.style.cssText = "margin-top: 20px; width: 100%; border-radius:8px;"; btnVerif.textContent = "🧘 Verificar Resposta Imediata";
          card.appendChild(btnVerif);
      }

      quizContainer.appendChild(card);
      setupQuestionListeners(question, showResult);
  }

  function buildOpenEnded(question, selectedAnswer, disabled) {
      const group = document.createElement('div'); group.className = "open-ended-group";
      const textarea = document.createElement('textarea'); textarea.id = `open-ended-${state.currentQuestionIndex}`; textarea.className = "form-input"; textarea.placeholder = "Escrever resposta..."; textarea.rows = 6;
      if (disabled) textarea.disabled = true; textarea.value = selectedAnswer || "";
      group.appendChild(textarea); return group;
  }

  function buildMultipleChoice(question, selectedAnswer, disabled) {
      const group = document.createElement('div'); group.className = "options-group";
      const options = Array.isArray(question.opcoes) ? question.opcoes : [];
      const isMulti = question.tipo === "multiple_select"; 
      const correctArr = isMulti ? (Array.isArray(question.resposta_correta) ? question.resposta_correta : []) : [question.resposta_correta];
      const userAnsArray = Array.isArray(selectedAnswer) ? selectedAnswer : (selectedAnswer ? [selectedAnswer] : []);

      options.forEach((option, idx) => {
          const isChecked = userAnsArray.map(normalizeText).includes(normalizeText(option));
          const isCorrectOption = correctArr.map(normalizeText).includes(normalizeText(option));
          
          const label = document.createElement('label'); label.className = `option-item ${isChecked ? 'selected' : ''}`;
          if (disabled) { if (isCorrectOption) label.classList.add("option-correct"); else if (isChecked && !isCorrectOption) label.classList.add("option-selected-wrong"); }

          const input = document.createElement('input'); input.type = isMulti ? 'checkbox' : 'radio'; input.name = `question-${state.currentQuestionIndex}`; input.value = option; input.checked = isChecked; if (disabled) input.disabled = true;
          const customDiv = document.createElement('div'); customDiv.className = isMulti ? 'custom-checkbox' : 'custom-radio';
          const letterSpan = document.createElement('span'); letterSpan.style.cssText = "font-weight: 800; color: var(--text-muted); margin-right: 10px; font-family: 'JetBrains Mono', monospace;"; letterSpan.textContent = `${String.fromCharCode(65 + idx)}.`;
          const textSpan = document.createElement('span'); textSpan.style.cssText = "font-size: 1rem; font-weight: 500;"; textSpan.textContent = option;
          
          label.append(input, customDiv, letterSpan, textSpan); group.appendChild(label);
      });
      return group;
  }

  function buildDragAndDrop(question, selectedAnswer, disabled) {
      const container = document.createElement('div'); container.className = "dnd-container"; container.style.cssText = "display:flex; flex-direction:column; gap:15px;";
      const pares = question.pares || []; const allConceitos = pares.map(p => p.conceito);
      const placedObj = (typeof selectedAnswer === 'object' && selectedAnswer !== null) ? selectedAnswer : {};
      const placedConceitos = Object.values(placedObj); const bankConceitos = allConceitos.filter(c => !placedConceitos.includes(c)).sort();

      const bank = document.createElement('div'); bank.className = "dnd-bank"; bank.id = "dnd-bank"; bank.style.cssText = "display:flex; flex-wrap:wrap; gap:10px; padding:20px; background:var(--bg-body); border:2px dashed var(--border); border-radius:var(--radius-sm); min-height:80px;";
      bankConceitos.forEach((c, i) => {
          const item = document.createElement('div'); item.className = "dnd-item"; item.draggable = !disabled; item.setAttribute('data-conceito', c); item.id = `drag-bank-${state.currentQuestionIndex}-${i}`;
          item.style.cssText = "background:var(--secondary); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px 15px; border-radius:8px; cursor:grab; font-weight:600; font-size:0.9rem;"; item.textContent = c; bank.appendChild(item);
      });
      container.appendChild(bank);

      const targetList = document.createElement('div'); targetList.className = "dnd-target-list"; targetList.style.cssText = "display:flex; flex-direction:column; gap:12px;";
      pares.forEach((p, i) => {
          const placedItem = placedObj[p.definicao]; let correctStyle = "";
          if (disabled) { if (placedItem === p.conceito) correctStyle = "background: var(--success-light); border-color: var(--success);"; else correctStyle = "background: var(--error-light); border-color: var(--error);"; }

          const row = document.createElement('div'); row.className = "dnd-row"; row.style.cssText = "display:flex; align-items:stretch; background:var(--secondary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;";
          const defDiv = document.createElement('div'); defDiv.className = "dnd-definition"; defDiv.style.cssText = "flex:1; padding:16px; font-size:0.95rem; font-weight:500; border-right:1px solid var(--border);"; defDiv.textContent = p.definicao;
          
          const dropzone = document.createElement('div'); dropzone.className = "dnd-dropzone"; dropzone.setAttribute('data-def', p.definicao); dropzone.style.cssText = `flex:0 0 240px; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; padding:10px; position:relative; flex-direction:column; ${correctStyle}`;
          
          if (placedItem) {
              const item = document.createElement('div'); item.className = "dnd-item"; item.draggable = !disabled; item.setAttribute('data-conceito', placedItem); item.id = `drag-placed-${state.currentQuestionIndex}-${i}`;
              item.style.cssText = "background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px; border-radius:8px; width:100%; text-align:center; cursor:grab;"; item.textContent = placedItem; dropzone.appendChild(item);
          }
          if (disabled && placedItem !== p.conceito) {
              const expected = document.createElement('span'); expected.style.cssText = "display:block; font-size:0.75rem; color:var(--success); font-weight:800; margin-top:8px; text-align:center; width:100%;"; expected.textContent = `Esperado: ${p.conceito}`; dropzone.appendChild(expected);
          }
          row.append(defDiv, dropzone); targetList.appendChild(row);
      });
      container.appendChild(targetList); return container;
  }

  function setupQuestionListeners(question, showResult) {
      const btnReport = document.getElementById('btnReportQ');
      if (btnReport) {
          btnReport.addEventListener('click', async (e) => {
              e.target.style.opacity = '1'; e.target.style.transform = 'scale(1.2)'; playClick();
              try {
                  const qId = question.id || `q_${btoa(question.pergunta).substring(0,10)}`;
                  await reportQuestionToCloud(qId, state.currentDisciplina, question.pergunta);
                  showToast("Reporte enviado ao professor.", "success");
              } catch(err) { showToast("Erro ao reportar.", "error"); }
          });
      }

      const btnVerificar = document.getElementById("btnVerificarTreino");
      if (btnVerificar) {
          btnVerificar.addEventListener("click", () => {
              if (!getAnsweredCountForIndex(state.currentQuestionIndex)) { showToast("Seleciona uma resposta.", "warning"); return; }
              state.verifiedQuestions[state.currentQuestionIndex] = true; playClick(); renderCurrentQuestion(); renderQuestionNavigator(); 
          });
      }

      if (question.tipo === "drag_and_drop" && !showResult) setupDragAndDropEvents();
      else if (question.tipo === "open_ended" && !showResult) {
          const textarea = quizContainer.querySelector(`#open-ended-${state.currentQuestionIndex}`);
          if (textarea) { setTimeout(() => textarea.focus(), 100); textarea.addEventListener("input", (e) => { state.userAnswers[state.currentQuestionIndex] = e.target.value; updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio(); }); }
      } 
      else if (!showResult) {
          quizContainer.querySelectorAll(`input[type="radio"], input[type="checkbox"]`).forEach(input => {
              input.addEventListener("change", (e) => {
                  playClick(); 
                  if (question.tipo === "multiple_select") {
                      const checkedBoxes = Array.from(quizContainer.querySelectorAll(`input[type="checkbox"]:checked`));
                      state.userAnswers[state.currentQuestionIndex] = checkedBoxes.map(cb => cb.value);
                  } else { state.userAnswers[state.currentQuestionIndex] = e.target.value; }
                  updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio();
              });
          });
      }
  }

  function setupDragAndDropEvents() {
      if(!quizContainer) return;
      const items = quizContainer.querySelectorAll('.dnd-item'); const dropzones = quizContainer.querySelectorAll('.dnd-dropzone'); const bank = quizContainer.querySelector('#dnd-bank');
      items.forEach(item => { item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', item.id); setTimeout(() => item.style.opacity = '0.4', 0); }); item.addEventListener('dragend', () => { item.style.opacity = '1'; }); });
      const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.style.boxShadow = 'inset 0 0 10px var(--primary-glow)'; };
      const handleDragLeave = (e) => { e.currentTarget.style.boxShadow = 'none'; };
      dropzones.forEach(zone => { zone.addEventListener('dragover', handleDragOver); zone.addEventListener('dragleave', handleDragLeave); zone.addEventListener('drop', (e) => { e.preventDefault(); zone.style.boxShadow = 'none'; const draggedId = e.dataTransfer.getData('text/plain'); const draggedElement = document.getElementById(draggedId); if (draggedElement) { const existingItem = zone.querySelector('.dnd-item'); if (existingItem && existingItem !== draggedElement && bank) bank.appendChild(existingItem); zone.appendChild(draggedElement); playDing(); saveDragAndDropState(); } }); });
      if (bank) { bank.addEventListener('dragover', handleDragOver); bank.addEventListener('dragleave', handleDragLeave); bank.addEventListener('drop', (e) => { e.preventDefault(); bank.style.boxShadow = 'none'; const draggedId = e.dataTransfer.getData('text/plain'); const draggedElement = document.getElementById(draggedId); if (draggedElement) { bank.appendChild(draggedElement); saveDragAndDropState(); } }); }
  }
  function saveDragAndDropState() {
      if(!quizContainer) return; const dropzones = quizContainer.querySelectorAll('.dnd-dropzone'); let currentAnswers = {};
      dropzones.forEach(zone => { const def = zone.getAttribute('data-def'); const item = zone.querySelector('.dnd-item'); if (item) currentAnswers[def] = item.getAttribute('data-conceito'); });
      state.userAnswers[state.currentQuestionIndex] = currentAnswers; updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio();
  }

  // ======================================================
  // EVENTOS E LÓGICA DE INTERFACE EXTRA
  // ======================================================
  function applyTheme(theme) { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("iscap-theme", theme); }
  function initTheme() {
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const novoTema = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(novoTema); guardarTemaNaCloud(novoTema); if(radarChartInstance) updateGlobalProgressUI();
      });
    }
  }

  function showCustomConfirm(message) {
      return new Promise((resolve) => {
          const overlay = document.getElementById('customConfirmOverlay'); const msgEl = document.getElementById('customConfirmMsg'); const btnYes = document.getElementById('customConfirmYes'); const btnNo = document.getElementById('customConfirmNo');
          msgEl.textContent = message; overlay.style.display = 'flex'; playWarningSound(); setTimeout(() => overlay.classList.add('show'), 10);
          const cleanup = () => { overlay.classList.remove('show'); setTimeout(() => overlay.style.display = 'none', 300); btnYes.removeEventListener('click', onYes); btnNo.removeEventListener('click', onNo); };
          const onYes = () => { cleanup(); playClick(); resolve(true); }; const onNo = () => { cleanup(); resolve(false); };
          btnYes.addEventListener('click', onYes); btnNo.addEventListener('click', onNo);
      });
  }

  // ======================================================
  // MENU LATERAL MOBILE (DRAWER)
  // ======================================================
  function toggleSidebar() {
      if (!mobileSidebar) return;
      const isOpen = mobileSidebar.classList.contains('is-open');
      if (isOpen) {
          mobileSidebar.classList.remove('is-open');
          if(sidebarOverlay) sidebarOverlay.classList.remove('show');
          document.body.style.overflow = ''; // Devolve o scroll normal ao fundo
      } else {
          mobileSidebar.classList.add('is-open');
          if(sidebarOverlay) sidebarOverlay.classList.add('show');
          document.body.style.overflow = 'hidden'; // Tranca o ecrã de trás para não mexer
      }
  }

  if (btnMobileSidebar) btnMobileSidebar.addEventListener('click', toggleSidebar);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', toggleSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

  // Restantes Eventos da UI
  if (disciplinaSelect) disciplinaSelect.addEventListener("change", () => { carregarDisciplinaBase(); if (state.currentUser) carregarProgressoDaCloud(state.currentUser); });
  if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", () => iniciarTeste("normal"));
  if (carregarFraquezasBtn) carregarFraquezasBtn.addEventListener("click", () => iniciarTeste("mistakes"));
  if (btnToggleFiltros) btnToggleFiltros.addEventListener('click', (e) => { e.preventDefault(); const isHidden = topicosContainer.style.display === 'none' || topicosContainer.style.display === ''; topicosContainer.style.display = isHidden ? 'block' : 'none'; });

  if (retomarQuizBtn) {
      retomarQuizBtn.addEventListener("click", () => {
          const data = state.globalStorage[state.currentDisciplina]?.activeQuiz; if (!data) return;
          state.quizData = data.quizData; state.userAnswers = data.userAnswers || {}; state.currentQuestionIndex = data.currentQuestionIndex || 0; state.timeLeft = data.timeLeft || state.quizDurationSeconds;
          state.quizLoaded = true; state.quizSubmitted = false; state.isTreinoMode = false; 
          
          const resultBox = document.getElementById("resultado-final-box"); if (resultBox) resultBox.style.display = "none";
          toggleConfigPanel(true);
          renderQuestionNavigator(); renderCurrentQuestion(); updateTopIndicators(); updateNavButtonsState(); updateQuestionStateLabel(); startTimer();
          retomarQuizBtn.classList.add("hidden"); 
          showToast("Sessão retomada.", "info");
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
  }

  const btnSubmeterExameGlobal = document.getElementById("submeterQuiz");
  if (btnSubmeterExameGlobal) { btnSubmeterExameGlobal.addEventListener("click", async () => { const confirmado = await showCustomConfirm("Processar as respostas?"); if(confirmado) verificarRespostas(false); }); }

  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  if (dictSearchInput) dictSearchInput.addEventListener("input", debounce(procurarNoDicionario, 300));
  
  if (resetProgressBtn) { 
      resetProgressBtn.addEventListener("click", async () => { 
          const confirmado = await showCustomConfirm(`Apagar cache neural em ${state.currentDisciplina}?`); 
          if (confirmado) { 
              state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} }; 
              localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage)); 
              await saveProgressToCloud(state.currentDisciplina, [], []); 
              updateGlobalProgressUI(); showToast("Memória limpa.", "success");
          } 
      }); 
  }

  window.addEventListener('beforeunload', (e) => { if (state.quizLoaded && !state.quizSubmitted) { e.preventDefault(); e.returnValue = ''; } });
  let deferredPrompt; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (installAppBtn) installAppBtn.classList.remove('hidden'); });
  if (installAppBtn) { installAppBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { installAppBtn.classList.add('hidden'); showToast("App instalada!", "success"); } deferredPrompt = null; } }); }

  document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!state.quizLoaded || state.quizSubmitted) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); if(prevQuestionBtn && !prevQuestionBtn.disabled) goToPreviousQuestion(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if(nextQuestionBtn && !nextQuestionBtn.disabled) goToNextQuestion(); }
      if (e.key === 'Enter') { e.preventDefault(); if (btnSubmeterExameGlobal && !activeExamPanel.classList.contains('hidden')) { btnSubmeterExameGlobal.click(); } }
      const keyMap = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 }; const optionIndex = keyMap[e.key.toLowerCase()];
      if (optionIndex !== undefined) {
          const currentQ = state.quizData[state.currentQuestionIndex];
          if (currentQ && currentQ.tipo !== 'drag_and_drop' && currentQ.tipo !== 'open_ended') {
              const options = quizContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
              if (options[optionIndex]) options[optionIndex].click();
          }
      }
  });

  function procurarNoDicionario() {
      if(!dictSearchInput || !dictResultsContainer || !state.fullDatabase || !state.fullDatabase.length) return;
      const termo = dictSearchInput.value.toLowerCase().trim();
      dictResultsContainer.innerHTML = ""; 
      if(termo === "") return;
      
      const resultados = state.fullDatabase.filter(p => {
          const textoCompleto = ((p.pergunta || "") + " " + (p.justificacao || "") + " " + (p.opcoes ? p.opcoes.join(" ") : "") + " " + (p.pares ? p.pares.map(x=>x.conceito).join(" ") : "")).toLowerCase();
          return textoCompleto.includes(termo);
      });
      
      if(resultados.length === 0) { 
          const p = document.createElement('p'); p.style.cssText = "font-size:0.9rem; color:var(--error); font-weight:600;"; p.textContent = "Nenhum registo encontrado."; dictResultsContainer.appendChild(p); return; 
      }
      
      resultados.slice(0, 10).forEach((res) => {
          const card = document.createElement('div'); card.className = "glass-panel"; card.style.cssText = "margin-bottom: 12px; padding: 15px; border-left: 4px solid var(--primary);";
          const tema = document.createElement('strong'); tema.style.cssText = "color:var(--text-main); display:block; margin-bottom:4px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;"; tema.textContent = (res.macro_tema || "TEMA").replace(/_/g, ' ');
          const pergunta = document.createElement('i'); pergunta.style.cssText = "color:var(--text-muted); display:block; margin-bottom:8px; font-size:0.9rem;"; pergunta.textContent = res.pergunta;
          
          const answerBox = document.createElement('div'); answerBox.style.cssText = "background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border);";
          const respCorreta = document.createElement('p'); respCorreta.style.cssText = "margin: 0 0 8px 0; color: var(--success); font-weight:700;"; respCorreta.textContent = `✅ ${res.resposta_correta || res.resposta_referencia || "Questão (Drag & Drop)"}`;
          const justificacao = document.createElement('p'); justificacao.style.cssText = "margin: 0; font-size: 0.85rem; line-height: 1.4;"; justificacao.textContent = res.justificacao || "";
          
          answerBox.append(respCorreta, justificacao); card.append(tema, pergunta, answerBox); dictResultsContainer.appendChild(card);
      });
      
      if(resultados.length > 10) {
          const footer = document.createElement('p'); footer.style.cssText = "font-size:0.8rem; text-align:center; color: var(--text-muted);"; footer.textContent = `[ A mostrar 10 de ${resultados.length} registos ]`; dictResultsContainer.appendChild(footer);
      }
  }
  
  initTheme();
  if (scrollTopBtn) { window.addEventListener("scroll", () => { scrollTopBtn.style.display = window.scrollY > 250 ? "flex" : "none"; }); scrollTopBtn.addEventListener("click", scrollToTopSmooth); }
});