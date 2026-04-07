import { playDing, playClick, playSadSound, playHappySound, playPartySound, fireConfetti, playWarningSound } from './audio.js';
import { escapeHtml, normalizeText, removeAcentos, formatTime, shuffleArray, timeAgo, debounce } from './utils.js';
import { initAuth } from './auth.js';

// --- INTEGRAÇÃO FIREBASE CLOUD ---
import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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
  
  // Elementos Novos (Filtros e Painéis)
  const configPanel = document.getElementById("configPanel");
  const activeExamPanel = document.getElementById("activeExamPanel");
  const btnToggleFiltros = document.getElementById("btnToggleFiltros");
  const topicosContainer = document.getElementById("topicosContainer");
  const modoEstudo = document.getElementById("modoEstudo");

  // ======================================================
  // ESTADO DO SISTEMA & PERFIS
  // ======================================================
  let fullDatabase = []; 
  let configDatabase = {}; 
  let quizData = [];
  let userAnswers = {};
  let currentQuestionIndex = 0;
  let quizLoaded = false;
  let quizSubmitted = false;
  let timerInterval = null;
  let currentDisciplina = "";
  let radarChartInstance = null;
  let currentUser = null; 
  let unsubscribeSnapshot = null; 

  let quizDurationSeconds = 40 * 60;
  let penalizacaoPorErro = 0;
  let timeLeft = quizDurationSeconds;

  let isTreinoMode = false;
  let verifiedQuestions = {}; 

  let globalStorage = JSON.parse(localStorage.getItem("moodle-iscap-storage")) || {};

  const PERFIS_ESTUDO = {
      "joao@iscap.pt": { nome: "João F.", curso: "Mestrado BIA", disciplinas: [{ value: "BIA_BIAT", text: "Business Intelligence & Analytics Tools" }, { value: "BIA_SP", text: "Segurança e Privacidade" }, { value: "BIA_STP", text: "Série Temporal e Previsão" }] },
      "ana@moodle.jf": { nome: "Ana Vasconcelos", curso: "Mestrado GM", disciplinas: [{ value: "GM_MR", text: "Marketing Relacional" }] }
  };

  // ======================================================
  // AUTENTICAÇÃO E CARREGAMENTO DA CLOUD
  // ======================================================
  onAuthStateChanged(auth, async (user) => {
      if (user) {
          currentUser = user;
          await carregarTemaDaCloud(user);
          configurarUniverso(user.email);
          currentDisciplina = disciplinaSelect.value;
          
          checkAndUpdateStreak(false);
          await carregarDisciplinaBase();
          carregarProgressoDaCloud(user);
      } else {
          currentUser = null;
          quizData = []; fullDatabase = []; globalStorage = {};
          if (unsubscribeSnapshot) unsubscribeSnapshot();
          if (quizContainer) quizContainer.innerHTML = "";
          updateGlobalProgressUI();
      }
  });

  async function carregarTemaDaCloud(user) {
      const prefsRef = doc(db, "users", user.uid, "settings", "preferences");
      const snap = await getDoc(prefsRef);
      let theme = "dark";
      if (snap.exists() && snap.data().theme) theme = snap.data().theme;
      applyTheme(theme);
  }

  async function guardarTemaNaCloud(theme) {
      if (!currentUser) return;
      await setDoc(doc(db, "users", currentUser.uid, "settings", "preferences"), { theme: theme }, { merge: true });
  }

  function configurarUniverso(email) {
      const perfil = PERFIS_ESTUDO[email] || { nome: email.split('@')[0], curso: "Estudante", disciplinas: [{ value: "BIA_BIAT", text: "Business Intelligence & Analytics Tools" }] };
      const nameEl = document.querySelector('.student-name');
      const courseEl = document.querySelector('.student-course');
      const avatarEl = document.querySelector('.user-avatar');
      
      if(nameEl) nameEl.textContent = perfil.nome;
      if(courseEl) courseEl.textContent = perfil.curso;
      if(avatarEl) avatarEl.textContent = perfil.nome.charAt(0).toUpperCase();

      if (disciplinaSelect) {
          disciplinaSelect.innerHTML = "";
          perfil.disciplinas.forEach((d, index) => {
              const opt = document.createElement('option');
              opt.value = d.value; opt.textContent = d.text;
              if(index === 0) opt.selected = true;
              disciplinaSelect.appendChild(opt);
          });
      }
  }

  // ======================================================
  // 🔥 SISTEMA DE STREAKS E 🏆 LEADERBOARD
  // ======================================================
  async function checkAndUpdateStreak(didStudy = false) {
      if (!currentUser) return;
      const ref = doc(db, "users", currentUser.uid, "settings", "streak");
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
      
      const streakEl = document.getElementById('streakDays');
      if (streakEl) streakEl.textContent = streak;
  }

  async function fetchLeaderboard() {
      const container = document.getElementById('leaderboardContainer');
      if(!container) return;
      container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:10px;">A carregar ranking do servidor...</p>';
      
      try {
          const q = query(collection(db, "leaderboards", currentDisciplina, "rankings"), orderBy("score", "desc"), limit(10));
          const snap = await getDocs(q);
          
          if(snap.empty) {
              container.innerHTML = '<p style="text-align:center; font-size:0.85rem; color:var(--text-muted);">Ainda não há resultados. Sê o primeiro!</p>';
              return;
          }
          
          let html = '';
          snap.forEach((doc, idx) => {
              const data = doc.data();
              let medal = '🏅';
              if(idx === 0) medal = '🥇'; if(idx === 1) medal = '🥈'; if(idx === 2) medal = '🥉';
              
              html += `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--secondary); border:1px solid var(--border); border-radius:8px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                          <span style="font-size:1.2rem;">${medal}</span>
                          <span style="font-weight:700; font-size:0.9rem;">${escapeHtml(data.nome)}</span>
                      </div>
                      <span class="mono-data" style="color:var(--primary); font-weight:800;">${data.score.toFixed(2)}</span>
                  </div>
              `;
          });
          container.innerHTML = html;
      } catch(e) {
          container.innerHTML = '<p style="text-align:center; font-size:0.85rem; color:var(--error);">Erro ao carregar ranking.</p>';
      }
  }

  // ======================================================
  // ⚙️ ESTUDO FOCADO (FILTROS) E CARREGAMENTO
  // ======================================================
  function renderTopicsFilter() {
      const container = document.getElementById('topicosList');
      if(!container) return;
      const temas = [...new Set(fullDatabase.map(p => p.macro_tema).filter(Boolean))];
      
      container.innerHTML = temas.map(tema => `
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--secondary); padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
              <input type="checkbox" class="topic-checkbox" value="${escapeHtml(tema)}" checked>
              <span style="font-size:0.85rem; font-weight:600;">${escapeHtml(tema.replace(/_/g, ' ').toUpperCase())}</span>
          </label>
      `).join('');
  }

  // CORREÇÃO: Fazer o botão de Tópicos abrir e fechar corretamente
  if (btnToggleFiltros) {
      btnToggleFiltros.addEventListener('click', (e) => {
          e.preventDefault(); // Evita bugs de salto
          const isHidden = topicosContainer.style.display === 'none' || topicosContainer.style.display === '';
          topicosContainer.style.display = isHidden ? 'block' : 'none';
      });
  }

  function carregarProgressoDaCloud(user) {
      if (!user || !currentDisciplina) return;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      const docRef = doc(db, "users", user.uid, "progress", currentDisciplina);
      
      unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              globalStorage[currentDisciplina] = data;
              if (lastUpdateText) lastUpdateText.textContent = data.lastUpdate ? `Última revisão: ${timeAgo(data.lastUpdate)}` : "Ainda não há dados de revisão.";
              if (data.activeQuiz && data.activeQuiz.quizData && data.activeQuiz.quizData.length > 0 && !quizLoaded) {
                  if (retomarQuizBtn) retomarQuizBtn.classList.remove("hidden");
              } else { if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden"); }
          } else {
              globalStorage[currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
              if (lastUpdateText) lastUpdateText.textContent = "Ainda não há dados de revisão.";
          }
          localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
          updateGlobalProgressUI();
      });
  }

  async function carregarDisciplinaBase() {
      currentDisciplina = disciplinaSelect?.value || "BIA_BIAT";
      try {
          let response = await fetch(`data/${currentDisciplina}.json`);
          if (!response.ok) response = await fetch(`${currentDisciplina}.json`);
          if (!response.ok) throw new Error(`Ficheiro JSON não encontrado.`);

          const data = await response.json();
          fullDatabase = data.perguntas || [];
          configDatabase = data.configuracao_teste || {};
          
          const regrasExame = data.opcoes_exame || {};
          quizDurationSeconds = (regrasExame.duracao_minutos || 40) * 60;
          penalizacaoPorErro = regrasExame.desconto_erro || 0;
          
          resetTimer(); 
          renderTopicsFilter(); 
          fetchLeaderboard();   
          
          if (dictSearchInput && disciplinaSelect) dictSearchInput.placeholder = `Pesquisar em ${disciplinaSelect.options[disciplinaSelect.selectedIndex].text}...`;

          const btnLerResumo = document.getElementById("btnLerResumo");
          if (btnLerResumo) { btnLerResumo.href = `pdfs/${currentDisciplina}.pdf`; btnLerResumo.removeAttribute("download"); btnLerResumo.setAttribute("target", "_blank"); }
          
          const btnVerVideo = document.getElementById("btnVerVideo");
          if (btnVerVideo) { btnVerVideo.href = `videos/${currentDisciplina}.mp4`; btnVerVideo.removeAttribute("download"); btnVerVideo.setAttribute("target", "_blank"); }

          if(dictSearchInput) procurarNoDicionario();
          updateGlobalProgressUI();
      } catch (e) { console.error("Erro a carregar o JSON:", e); }
  }

  function generateQuizDataLocally(mode = "normal") {
      const selectedTopics = Array.from(document.querySelectorAll('.topic-checkbox:checked')).map(cb => cb.value);
      let basePerguntas = fullDatabase;
      if (selectedTopics.length > 0) {
          basePerguntas = fullDatabase.filter(p => selectedTopics.includes(p.macro_tema));
      }

      let configTemas = { ...configDatabase };
      let testeFinal = [];

      if (mode === "mistakes") {
          const wrongIds = globalStorage[currentDisciplina]?.wrong || [];
          testeFinal = basePerguntas.filter(p => wrongIds.includes(p.id));
          if (testeFinal.length === 0) return []; 
          let totalNormal = Object.values(configTemas).reduce((a, b) => a + b, 0) || 24;
          if (testeFinal.length > totalNormal) testeFinal = shuffleArray(testeFinal).slice(0, totalNormal);
          else testeFinal = shuffleArray(testeFinal);
      } 
      else {
          const perguntasDnd = basePerguntas.filter(p => p.tipo === "drag_and_drop");
          if (perguntasDnd.length > 0) {
              const perguntaObrigatoria = perguntasDnd[Math.floor(Math.random() * perguntasDnd.length)];
              testeFinal.push(perguntaObrigatoria);
              if (configTemas[perguntaObrigatoria.macro_tema] > 0) configTemas[perguntaObrigatoria.macro_tema] -= 1;
              basePerguntas = basePerguntas.filter(p => p.id !== perguntaObrigatoria.id);
          }
          for (const [macroTema, quantidade] of Object.entries(configTemas)) {
              if (quantidade <= 0) continue;
              const perguntasDoTema = basePerguntas.filter(p => p.macro_tema === macroTema);
              const selecionadas = shuffleArray([...perguntasDoTema]).slice(0, Math.min(quantidade, perguntasDoTema.length));
              testeFinal.push(...selecionadas);
          }
          if(testeFinal.length < 10 && basePerguntas.length > 0) {
              testeFinal.push(...shuffleArray(basePerguntas).slice(0, 10));
          }
          testeFinal = shuffleArray(testeFinal);
      }

      testeFinal.forEach(p => {
          if ((p.tipo === "multiple_choice" || p.tipo === "multiple_select") && p.opcoes) p.opcoes = shuffleArray([...p.opcoes]);
          else if (p.tipo === "drag_and_drop" && p.pares) p.pares = shuffleArray([...p.pares]);
      });
      return testeFinal;
  }

  // ======================================================
  // 🧹 LIMPEZA DINÂMICA DE ECRÃ (UX DE ACESSIBILIDADE)
  // ======================================================
  // CORREÇÃO: Usar os novos IDs dos painéis do HTML
  function toggleConfigPanel(isExamActive) {
      if (configPanel) {
          configPanel.style.display = isExamActive ? 'none' : 'block';
      }
      if (activeExamPanel) {
          activeExamPanel.style.display = isExamActive ? 'block' : 'none';
          activeExamPanel.classList.remove('hidden'); 
      }
      if (!isExamActive && topicosContainer) {
          topicosContainer.style.display = 'none';
      }
  }

  async function iniciarTeste(mode = "normal") {
      try {
          isTreinoMode = modoEstudo?.value === "treino"; 
          verifiedQuestions = {}; 

          const resultBox = document.getElementById("resultado-final-box");
          if (resultBox) resultBox.style.display = "none";
          if(quizContainer) quizContainer.innerHTML = "<div class='glass-panel' style='text-align:center; padding: 40px;'><h3 class='mono-data' style='color:var(--primary);'>A processar dados...</h3></div>";
          if (!fullDatabase || fullDatabase.length === 0) await carregarDisciplinaBase();

          quizData = generateQuizDataLocally(mode);
          if (quizData.length === 0) {
              if(quizContainer) quizContainer.innerHTML = `<div class="glass-panel" style="text-align:center;"><div style="font-size:3rem; margin-bottom:15px;">⚠️</div><h2>Sem dados</h2><p>Verifica os filtros de tópicos ou a tua lista de erros.</p></div>`;
              return;
          }

          userAnswers = {};
          currentQuestionIndex = 0;
          quizLoaded = true;
          quizSubmitted = false;
          
          if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden");

          // 🔥 MAGIA DO ESPAÇO: Esconder o configPanel e mostrar o activeExamPanel
          toggleConfigPanel(true);

          renderQuestionNavigator();
          renderCurrentQuestion();
          updateTopIndicators();
          updateNavButtonsState();
          updateQuestionStateLabel();
          
          if (!isTreinoMode) { startTimer(); } 
          else { stopTimer(); updateTimerUI(); }
          
          guardarEstadoAmeio();
          playClick(); 

          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { console.error(err); }
  }

  // ======================================================
  // PROGRESSO & RESULTADOS
  // ======================================================
  function updateGlobalProgressUI() {
    if (!globalProgressText || !fullDatabase || !fullDatabase.length) return;
    const subjData = globalStorage[currentDisciplina] || { correct: [], wrong: [] };
    const totalQuestions = fullDatabase.length;
    const correctCount = subjData.correct ? subjData.correct.length : 0;
    const percentage = Math.min(100, Math.round((correctCount / totalQuestions) * 100));
    
    globalProgressText.textContent = `${correctCount} / ${totalQuestions}`;
    if(globalProgressBarFill) globalProgressBarFill.style.width = `${percentage}%`;
    if(globalProgressPercent) globalProgressPercent.textContent = `${percentage}%`;

    if (themeAnalyticsContainer) {
        const temasEstatisticas = {};
        fullDatabase.forEach(p => {
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
        radarChartInstance = new Chart(ctx, { type: 'radar', data: { labels: labels, datasets: [{ label: 'Domínio do Tema (%)', data: dataValues, backgroundColor: 'rgba(225, 29, 72, 0.3)', borderColor: '#e11d48', pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#10b981', borderWidth: 2, }] }, options: { responsive: true, scales: { r: { angleLines: { color: 'rgba(148, 163, 184, 0.2)' }, grid: { color: 'rgba(148, 163, 184, 0.2)' }, pointLabels: { color: '#94a3b8', font: { family: "'Outfit', sans-serif", size: 10, weight: '600' } }, ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleFont: { family: "'Outfit', sans-serif" }, bodyFont: { family: "'JetBrains Mono', monospace" } } } } });
    }
  }

  async function guardarResultadosNaMemoria() {
    if (!globalStorage[currentDisciplina]) globalStorage[currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
    const subjData = globalStorage[currentDisciplina];
    
    quizData.forEach((q, i) => {
        const isCorrect = isQuestionCorrect(q, i);
        const pId = q.id || `q_${btoa(q.pergunta).substring(0,10)}`; 
        if (isCorrect) {
            if (!subjData.correct.includes(pId)) subjData.correct.push(pId);
            subjData.wrong = subjData.wrong.filter(id => id !== pId); 
        } else {
            if (!subjData.wrong.includes(pId) && !subjData.correct.includes(pId)) subjData.wrong.push(pId);
        }
    });
      
    localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
    updateGlobalProgressUI();
    checkAndUpdateStreak(true); 
      
    if (currentUser) {
        try {
            await setDoc(doc(db, "users", currentUser.uid, "progress", currentDisciplina), {
                correct: subjData.correct, wrong: subjData.wrong, lastUpdate: new Date().toISOString(), activeQuiz: null
            }, { merge: true });
        } catch (error) { console.error("Erro a guardar no Firebase:", error); }
    }
  }

  // ======================================================
  // HELPERS & NAVEGAÇÃO
  // ======================================================
  function scrollToTopSmooth() { window.scrollTo({ top: 0, behavior: "smooth" }); }

  function getAnsweredCount() {
    return Object.values(userAnswers).filter((answer) => {
      if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) return Object.keys(answer).length > 0;
      if (Array.isArray(answer)) return answer.length > 0;
      return normalizeText(answer) !== "";
    }).length;
  }

  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
  function updateTimerUI() { 
      if (timerElement) timerElement.textContent = isTreinoMode ? "TREINO (∞)" : formatTime(timeLeft); 
  }
  function resetTimer() { stopTimer(); timeLeft = quizDurationSeconds; updateTimerUI(); }
  function startTimer() {
    stopTimer();
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft % 15 === 0) guardarEstadoAmeio(); 
      if (timeLeft <= 0) { timeLeft = 0; updateTimerUI(); stopTimer(); if (quizLoaded && !quizSubmitted) verificarRespostas(true); return; }
      updateTimerUI();
    }, 1000);
  }

  function updateQuestionStateLabel() {
    if (!quizStateText) return;
    if (!quizLoaded) return quizStateText.textContent = "Offline";
    if (quizSubmitted) return quizStateText.textContent = "Processado";
    const answered = getAnsweredCount();
    if (answered === 0) return quizStateText.textContent = "Online";
    if (answered === quizData.length) return quizStateText.textContent = "Pronto a Submeter";
    return quizStateText.textContent = "Em Execução";
  }

  function applyTheme(theme) { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("iscap-theme", theme); }
  function initTheme() {
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const novoTema = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(novoTema); guardarTemaNaCloud(novoTema); if(radarChartInstance) updateGlobalProgressUI();
      });
    }
  }

  function initScrollTopButton() {
    if (!scrollTopBtn) return;
    window.addEventListener("scroll", () => { scrollTopBtn.style.display = window.scrollY > 250 ? "flex" : "none"; });
    scrollTopBtn.addEventListener("click", scrollToTopSmooth);
  }

  function goToQuestion(index) { currentQuestionIndex = index; renderCurrentQuestion(); updateNavButtonsState(); renderQuestionNavigator(); guardarEstadoAmeio(); }
  function goToPreviousQuestion() { if (currentQuestionIndex > 0) goToQuestion(currentQuestionIndex - 1); }
  function goToNextQuestion() { if (currentQuestionIndex < quizData.length - 1) goToQuestion(currentQuestionIndex + 1); }

  function updateNavButtonsState() {
    if (!quizData.length) { if(prevQuestionBtn) prevQuestionBtn.disabled = true; if(nextQuestionBtn) nextQuestionBtn.disabled = true; return; }
    if(prevQuestionBtn) prevQuestionBtn.disabled = currentQuestionIndex === 0;
    if(nextQuestionBtn) nextQuestionBtn.disabled = currentQuestionIndex === quizData.length - 1;
  }

  function renderQuestionNavigator() {
    if (!questionNavigator) return;
    if (!quizData.length) { questionNavigator.innerHTML = ""; return; }
    questionNavigator.innerHTML = quizData.map((q, index) => {
      const isActive = index === currentQuestionIndex;
      const isAnswered = getAnsweredCountForIndex(index);
      let className = "nav-node";
      if (isActive) className += " is-active";
      if (isAnswered && !quizSubmitted) className += " is-answered";
      
      if (quizSubmitted || verifiedQuestions[index]) {
         const score = getQuestionScore(q, index);
         if (score === 1) className += " is-correct";
         else if (score === 0.5) className += " is-partial";
         else className += " is-incorrect";
      }
      return `<button type="button" class="${className}" data-question-index="${index}">${index + 1}</button>`;
    }).join("");
    questionNavigator.querySelectorAll(".nav-node").forEach((btn) => { btn.addEventListener("click", () => goToQuestion(Number(btn.dataset.questionIndex))); });
  }

  function getAnsweredCountForIndex(index) {
      const ans = userAnswers[index];
      if (ans === undefined || ans === null) return false;
      if (Array.isArray(ans)) return ans.length > 0;
      if (typeof ans === 'object') return Object.keys(ans).length > 0;
      return normalizeText(ans) !== "";
  }

  function getQuestionScore(question, index) {
      const selectedAnswer = userAnswers[index];
      if (selectedAnswer === undefined || selectedAnswer === null) return 0;
      
      if (question.tipo === "drag_and_drop") {
          if (typeof selectedAnswer !== 'object' || Array.isArray(selectedAnswer)) return 0;
          for (let p of question.pares) { if (selectedAnswer[p.definicao] !== p.conceito) return 0; }
          return 1;
      } 
      else if (question.tipo === "open_ended") {
          const text = removeAcentos(normalizeText(selectedAnswer).toLowerCase());
          if (text === "") return 0;
          let gruposAtingidos = 0;
          for (let group of question.palavras_chave) {
              const hasMatch = group.some(word => text.includes(removeAcentos(word.toLowerCase())));
              if (hasMatch) gruposAtingidos++;
          }
          if (gruposAtingidos >= 4) return 1; if (gruposAtingidos >= 2) return 0.5; return 0;                              
      } 
      else if (question.tipo === "multiple_select") {
          const userArr = Array.isArray(selectedAnswer) ? selectedAnswer : [];
          const correctArr = Array.isArray(question.resposta_correta) ? question.resposta_correta : [];
          if (userArr.length === 0 || userArr.length !== correctArr.length) return 0;
          const isAllCorrect = userArr.every(ans => correctArr.map(normalizeText).includes(normalizeText(ans)));
          return isAllCorrect ? 1 : 0;
      }
      else { return normalizeText(selectedAnswer) === normalizeText(question.resposta_correta) ? 1 : 0; }
  }

  function isQuestionCorrect(question, index) { return getQuestionScore(question, index) === 1; }

  function updateTopIndicators() {
    const total = quizData.length || 0;
    const answered = getAnsweredCount();
    const remaining = Math.max(total - answered, 0);
    if (currentQuestionIndicator) currentQuestionIndicator.textContent = quizLoaded ? `${currentQuestionIndex + 1}` : `0`;
    if (answeredCountElement) answeredCountElement.textContent = String(answered);
    if (remainingCountElement) remainingCountElement.textContent = String(remaining);
  }

  // ======================================================
  // RENDERIZAÇÃO DA INTERFACE (UI) DAS PERGUNTAS
  // ======================================================
  function renderCurrentQuestion() {
      if (!quizData.length || !quizContainer) return;
      const question = quizData[currentQuestionIndex];
      const selectedAnswer = userAnswers[currentQuestionIndex];
      
      const showResult = quizSubmitted || verifiedQuestions[currentQuestionIndex];
      const score = showResult ? getQuestionScore(question, currentQuestionIndex) : null;
      const isCorrect = score === 1;
      const isPartial = score === 0.5;

      let html = `
        <div class="glass-panel question-card ${showResult && score === 0 ? 'shake' : ''}" id="q-card-${currentQuestionIndex}">
          <div class="q-meta" style="display:flex; justify-content:space-between;">
            <div style="display:flex; gap:10px; align-items:center;">
                <span class="q-badge">Q.${currentQuestionIndex + 1}</span>
                ${question.macro_tema ? `<span class="q-topic">${escapeHtml(question.macro_tema.replace(/_/g, ' '))}</span>` : ""}
            </div>
            <button id="btnReportQ" title="Reportar erro nesta pergunta ao professor" style="background:none; border:none; font-size:1.2rem; cursor:pointer; opacity:0.6; transition:0.2s;">🚩</button>
          </div>
          <h2 class="q-title">${escapeHtml(question.pergunta)}</h2>
      `;

      if (question.tipo === "drag_and_drop") html += renderDragAndDrop(question, selectedAnswer, showResult);
      else if (question.tipo === "open_ended") html += renderOpenEnded(question, selectedAnswer, showResult);
      else html += renderMultipleChoice(question, selectedAnswer, showResult);

      if (showResult) {
          let statusColor = isCorrect ? 'var(--success)' : (isPartial ? 'var(--warning)' : 'var(--error)');
          let statusText = isCorrect ? '✅ Resposta Validada' : (isPartial ? '⚠️ Resposta Incompleta' : '❌ Anomalia Detetada');
          let correctTextHtml = '';
          if (question.tipo === "open_ended") correctTextHtml = `<p><strong>Referência:</strong> ${escapeHtml(question.resposta_referencia)}</p>`;
          else if (question.tipo === "multiple_choice" || question.tipo === "multiple_select" || question.tipo === "true_false") {
             const cText = Array.isArray(question.resposta_correta) ? question.resposta_correta.join(" | ") : question.resposta_correta;
             correctTextHtml = `<p><strong>Certa(s):</strong> ${escapeHtml(cText)}</p>`;
          }

          html += `
            <div style="margin-top: 25px; padding: 20px; background: var(--bg-body); border-radius: var(--radius-sm); border: 1px solid ${statusColor}; border-left: 4px solid ${statusColor};">
              <p style="color: ${statusColor}; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">${statusText}</p>
              ${correctTextHtml}
              <div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;">
                  <p style="margin:0; font-size: 0.95rem;"><strong>Justificação Técnica:</strong> ${escapeHtml(question.justificacao)}</p>
              </div>
            </div>
          `;
      } 
      else if (isTreinoMode) {
          html += `<button id="btnVerificarTreino" class="btn btn--primary" style="margin-top: 20px; width: 100%; border-radius:8px;">🧘 Verificar Resposta Imediata</button>`;
      }

      html += `</div>`;
      quizContainer.innerHTML = html;

      setupQuestionListeners(question, showResult, isCorrect, isPartial, selectedAnswer);
  }

  function setupQuestionListeners(question, showResult, isCorrect, isPartial, selectedAnswer) {
      const btnReport = document.getElementById('btnReportQ');
      if (btnReport) {
          btnReport.addEventListener('click', async (e) => {
              e.target.style.opacity = '1'; e.target.style.transform = 'scale(1.2)'; playClick();
              try {
                  const qId = question.id || `q_${btoa(question.pergunta).substring(0,10)}`;
                  await setDoc(doc(db, "reports", qId), { disciplina: currentDisciplina, pergunta: question.pergunta, user: currentUser?.email || "anon", date: new Date().toISOString() });
                  showCustomConfirm("Obrigado! O teu alerta sobre esta pergunta foi enviado com sucesso.");
              } catch(err) { console.error(err); }
          });
      }

      // CORREÇÃO: Modo Treino (Verificar resposta a meio do teste)
      const btnVerificar = document.getElementById("btnVerificarTreino");
      if (btnVerificar) {
          btnVerificar.addEventListener("click", () => {
              if (!getAnsweredCountForIndex(currentQuestionIndex)) { showCustomConfirm("Por favor, seleciona uma resposta antes de verificar."); return; }
              verifiedQuestions[currentQuestionIndex] = true; // Marca como validada
              playClick(); 
              renderCurrentQuestion(); 
              renderQuestionNavigator(); // Para pintar o número na navegação lateral
          });
      }

      if (question.tipo === "drag_and_drop") {
          if (!showResult) setupDragAndDropEvents();
      } 
      else if (question.tipo === "open_ended") {
          const textarea = quizContainer.querySelector(`#open-ended-${currentQuestionIndex}`);
          if (!showResult) {
              if (textarea) {
                  setTimeout(() => textarea.focus(), 100);
                  textarea.addEventListener("input", (e) => { userAnswers[currentQuestionIndex] = e.target.value; updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio(); });
              }
          } else {
              const card = document.getElementById(`q-card-${currentQuestionIndex}`);
              if(card) { if(isCorrect) card.classList.add("correct"); else if(isPartial) card.style.borderLeft = "4px solid var(--warning)"; else card.classList.add("incorrect"); }
          }
      } 
      else {
          if (showResult) {
              const card = document.getElementById(`q-card-${currentQuestionIndex}`);
              if(card) {
                  card.classList.add(isCorrect ? "correct" : "incorrect");
                  const isMulti = question.tipo === "multiple_select";
                  const correctArr = isMulti ? (Array.isArray(question.resposta_correta) ? question.resposta_correta : []) : [question.resposta_correta];
                  const userArr = isMulti ? (Array.isArray(selectedAnswer) ? selectedAnswer : []) : (selectedAnswer ? [selectedAnswer] : []);

                  card.querySelectorAll(".option-item").forEach(label => {
                      const inputVal = normalizeText(label.querySelector('input').value);
                      const isCorrectOption = correctArr.map(normalizeText).includes(inputVal);
                      const isSelectedByUser = userArr.map(normalizeText).includes(inputVal);
                      if (isCorrectOption) label.classList.add("option-correct");
                      else if (isSelectedByUser && !isCorrectOption) label.classList.add("option-selected-wrong");
                  });
              }
          } else {
              quizContainer.querySelectorAll(`input[type="radio"], input[type="checkbox"]`).forEach(input => {
                  input.addEventListener("change", (e) => {
                      playClick(); 
                      if (question.tipo === "multiple_select") {
                          const checkedBoxes = Array.from(quizContainer.querySelectorAll(`input[type="checkbox"]:checked`));
                          userAnswers[currentQuestionIndex] = checkedBoxes.map(cb => cb.value);
                      } else { userAnswers[currentQuestionIndex] = e.target.value; }
                      updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio();
                  });
              });
          }
      }
  }

  function renderOpenEnded(question, selectedAnswer, disabled) { return `<div class="open-ended-group"><textarea id="open-ended-${currentQuestionIndex}" class="form-input" placeholder="Escrever input manual de resposta..." rows="6" ${disabled ? "disabled" : ""}>${escapeHtml(selectedAnswer || "")}</textarea></div>`; }
  
  function renderMultipleChoice(question, selectedAnswer, disabled) {
      const options = Array.isArray(question.opcoes) ? question.opcoes : [];
      const isMulti = question.tipo === "multiple_select"; 
      const userAnsArray = Array.isArray(selectedAnswer) ? selectedAnswer : (selectedAnswer ? [selectedAnswer] : []);

      return `<div class="options-group">
          ${options.map((option, idx) => {
            const isChecked = userAnsArray.map(normalizeText).includes(normalizeText(option));
            return `
              <label class="option-item ${isChecked ? 'selected' : ''}">
                <input type="${isMulti ? 'checkbox' : 'radio'}" name="question-${currentQuestionIndex}" value="${escapeHtml(option)}" ${isChecked ? "checked" : ""} ${disabled ? "disabled" : ""}/>
                <div class="${isMulti ? 'custom-checkbox' : 'custom-radio'}"></div>
                <span style="font-weight: 800; color: var(--text-muted); margin-right: 10px; font-family: 'JetBrains Mono', monospace;">${String.fromCharCode(65 + idx)}.</span>
                <span style="font-size: 1rem; font-weight: 500;">${escapeHtml(option)}</span>
              </label>
            `;
          }).join("")}
        </div>`;
  }

  function renderDragAndDrop(question, selectedAnswer, disabled) {
      const pares = question.pares || []; const allConceitos = pares.map(p => p.conceito);
      const placedObj = (typeof selectedAnswer === 'object' && selectedAnswer !== null) ? selectedAnswer : {};
      const placedConceitos = Object.values(placedObj); const bankConceitos = allConceitos.filter(c => !placedConceitos.includes(c)).sort();
      let dndHtml = `<div class="dnd-container" style="display:flex; flex-direction:column; gap:15px;"><div class="dnd-bank" id="dnd-bank" style="display:flex; flex-wrap:wrap; gap:10px; padding:20px; background:var(--bg-body); border:2px dashed var(--border); border-radius:var(--radius-sm); min-height:80px;">`;
      bankConceitos.forEach((c, i) => { dndHtml += `<div class="dnd-item" draggable="${!disabled}" data-conceito="${escapeHtml(c)}" id="drag-bank-${currentQuestionIndex}-${i}" style="background:var(--secondary); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px 15px; border-radius:8px; cursor:grab; font-weight:600; font-size:0.9rem;">${escapeHtml(c)}</div>`; });
      dndHtml += `</div><div class="dnd-target-list" style="display:flex; flex-direction:column; gap:12px;">`;
      pares.forEach((p, i) => {
          const placedItem = placedObj[p.definicao]; let correctStyle = "";
          if (disabled) { if (placedItem === p.conceito) correctStyle = "background: var(--success-light); border-color: var(--success);"; else correctStyle = "background: var(--error-light); border-color: var(--error);"; }
          dndHtml += `<div class="dnd-row" style="display:flex; align-items:stretch; background:var(--secondary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;"><div class="dnd-definition" style="flex:1; padding:16px; font-size:0.95rem; font-weight:500; border-right:1px solid var(--border);">${escapeHtml(p.definicao)}</div><div class="dnd-dropzone" data-def="${escapeHtml(p.definicao)}" style="flex:0 0 240px; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; padding:10px; position:relative; ${correctStyle}">`;
          if (placedItem) dndHtml += `<div class="dnd-item" draggable="${!disabled}" data-conceito="${escapeHtml(placedItem)}" id="drag-placed-${currentQuestionIndex}-${i}" style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px; border-radius:8px; width:100%; text-align:center; cursor:grab;">${escapeHtml(placedItem)}</div>`;
          if (disabled && placedItem !== p.conceito) dndHtml += `<span style="display:block; font-size:0.75rem; color:var(--success); font-weight:800; margin-top:8px; text-align:center; width:100%;">Esperado: ${escapeHtml(p.conceito)}</span>`;
          dndHtml += `</div></div>`;
      });
      dndHtml += `</div></div>`; return dndHtml;
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
      userAnswers[currentQuestionIndex] = currentAnswers; updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel(); guardarEstadoAmeio();
  }

  // ======================================================
  // VERIFICAR RESPOSTAS & FINALIZAR
  // ======================================================
  async function verificarRespostas(submissaoAutomatica = false) {
      if (!quizLoaded || quizSubmitted) return;
      quizSubmitted = true; stopTimer(); guardarResultadosNaMemoria();

      let pontuacaoPonderada = 0; let errosComPenalizacao = 0; let respondidas = 0;
      quizData.forEach((q, i) => { 
          const ans = userAnswers[i]; let hasAnswer = false;
          if (ans !== undefined && ans !== null && ans !== "") {
              if (Array.isArray(ans)) { hasAnswer = ans.length > 0; } 
              else if (typeof ans === 'object') { hasAnswer = Object.keys(ans).length > 0; } 
              else { hasAnswer = true; }
          }
          if (hasAnswer) { respondidas++; const score = getQuestionScore(q, i); pontuacaoPonderada += score; if (score === 0) errosComPenalizacao++; }
      });

      const valorPorPergunta = 20 / quizData.length;
      let notaCalculada = (pontuacaoPonderada * valorPorPergunta) - (errosComPenalizacao * valorPorPergunta * penalizacaoPorErro);
      if (notaCalculada < 0) notaCalculada = 0; const notaMoodle = notaCalculada.toFixed(2);
      
      if (notaCalculada >= 19.99) { playPartySound(); fireConfetti(); } else if (notaCalculada >= 9.5) playHappySound(); else playSadSound();

      let msgPenalizacao = penalizacaoPorErro > 0 ? `<p style="font-size: 0.85rem; color: var(--warning); margin-top: 15px; background: rgba(217, 119, 6, 0.1); padding: 10px; border-radius: 8px;">Aviso: Desconto ativado de -${(penalizacaoPorErro * 100).toFixed(0)}% por erro total.</p>` : ``;

      let htmlResultado = `
        <div class="hologram-result">
          <h2 style="text-transform: uppercase; font-size: 1.1rem; color: var(--text-muted); letter-spacing: 2px;">${submissaoAutomatica ? "Análise Abortada (Timeout)" : "Análise Concluída"}</h2>
          <div class="score-display mono-data">${notaMoodle} <span style="font-size: 2rem; color: var(--text-muted);">/ 20</span></div>
          <p style="font-size: 1.1rem; color: var(--text-main);">Precisão do modelo: <strong style="color:var(--primary);">${pontuacaoPonderada}</strong> acertos em ${quizData.length} blocos de dados. Omissões: <strong style="color:var(--primary);">${quizData.length - respondidas}</strong>.</p>
          ${msgPenalizacao}
        </div>
      `;

      const resultBox = document.getElementById("resultado-final-box");
      if (resultBox) { resultBox.innerHTML = htmlResultado; resultBox.style.display = "block"; }
      
      if (!isTreinoMode && currentUser) {
          try {
              const ref = doc(db, "leaderboards", currentDisciplina, "rankings", currentUser.uid);
              const snap = await getDoc(ref);
              if(!snap.exists() || snap.data().score < parseFloat(notaMoodle)) {
                  await setDoc(ref, {
                      nome: PERFIS_ESTUDO[currentUser.email]?.nome || currentUser.email.split('@')[0],
                      score: parseFloat(notaMoodle),
                      date: new Date().toISOString()
                  });
                  fetchLeaderboard(); 
              }
          } catch(e) { console.error("Erro a atualizar Leaderboard", e); }
      }

      // 🔥 MOSTRA O MENU DE NOVO NO FIM DO EXAME
      toggleConfigPanel(false);

      currentQuestionIndex = 0;
      renderQuestionNavigator(); renderCurrentQuestion(); updateQuestionStateLabel(); scrollToTopSmooth();
  }

  // ======================================================
  // POPUP & EVENTOS GLOBAIS
  // ======================================================
  function showCustomConfirm(message) {
      return new Promise((resolve) => {
          const overlay = document.getElementById('customConfirmOverlay'); const msgEl = document.getElementById('customConfirmMsg'); const btnYes = document.getElementById('customConfirmYes'); const btnNo = document.getElementById('customConfirmNo');
          msgEl.textContent = message; overlay.style.display = 'flex'; playWarningSound(); setTimeout(() => overlay.classList.add('show'), 10);
          const cleanup = () => { overlay.classList.remove('show'); setTimeout(() => overlay.style.display = 'none', 300); btnYes.removeEventListener('click', onYes); btnNo.removeEventListener('click', onNo); };
          const onYes = () => { cleanup(); playClick(); resolve(true); }; const onNo = () => { cleanup(); resolve(false); };
          btnYes.addEventListener('click', onYes); btnNo.addEventListener('click', onNo);
      });
  }

  if (disciplinaSelect) { disciplinaSelect.addEventListener("change", () => { carregarDisciplinaBase(); if (currentUser) carregarProgressoDaCloud(currentUser); }); }
  if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", () => iniciarTeste("normal"));
  if (carregarFraquezasBtn) carregarFraquezasBtn.addEventListener("click", () => iniciarTeste("mistakes"));
  
  if (retomarQuizBtn) {
      retomarQuizBtn.addEventListener("click", () => {
          const data = globalStorage[currentDisciplina]?.activeQuiz; if (!data) return;
          quizData = data.quizData; userAnswers = data.userAnswers || {}; currentQuestionIndex = data.currentQuestionIndex || 0; timeLeft = data.timeLeft || quizDurationSeconds;
          quizLoaded = true; quizSubmitted = false; isTreinoMode = false; 
          
          const resultBox = document.getElementById("resultado-final-box"); if (resultBox) resultBox.style.display = "none";
          
          // 🔥 ESCONDE O MENU AO RETOMAR
          toggleConfigPanel(true);

          renderQuestionNavigator(); renderCurrentQuestion(); updateTopIndicators(); updateNavButtonsState(); updateQuestionStateLabel(); startTimer();
          retomarQuizBtn.classList.add("hidden"); 
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
  }

  const btnSubmeterExameGlobal = document.getElementById("submeterQuiz");
  if (btnSubmeterExameGlobal) {
      btnSubmeterExameGlobal.addEventListener("click", async () => { 
          const confirmado = await showCustomConfirm("Iniciar processamento final de respostas?"); 
          if(confirmado) verificarRespostas(false); 
      });
  }

  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  if (dictSearchInput) dictSearchInput.addEventListener("input", debounce(procurarNoDicionario, 300));
  if (resetProgressBtn) { resetProgressBtn.addEventListener("click", async () => { const confirmado = await showCustomConfirm(`Atenção: Queres apagar a cache neural de erros em ${currentDisciplina}?`); if (confirmado) { globalStorage[currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} }; localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage)); if (currentUser) { await setDoc(doc(db, "users", currentUser.uid, "progress", currentDisciplina), globalStorage[currentDisciplina]); } updateGlobalProgressUI(); } }); }

  window.addEventListener('beforeunload', (e) => { if (quizLoaded && !quizSubmitted) { e.preventDefault(); e.returnValue = ''; } });

  let deferredPrompt; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (installAppBtn) installAppBtn.classList.remove('hidden'); });
  if (installAppBtn) { installAppBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome === 'accepted') { installAppBtn.classList.add('hidden'); } deferredPrompt = null; } }); }

  document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!quizLoaded || quizSubmitted) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); if(prevQuestionBtn && !prevQuestionBtn.disabled) goToPreviousQuestion(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); if(nextQuestionBtn && !nextQuestionBtn.disabled) goToNextQuestion(); }
      if (e.key === 'Enter') { e.preventDefault(); if (btnSubmeterExameGlobal && !activeExamPanel.classList.contains('hidden')) { btnSubmeterExameGlobal.click(); } }
      const keyMap = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 }; const optionIndex = keyMap[e.key.toLowerCase()];
      if (optionIndex !== undefined) {
          const currentQ = quizData[currentQuestionIndex];
          if (currentQ && currentQ.tipo !== 'drag_and_drop' && currentQ.tipo !== 'open_ended') {
              const options = quizContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
              if (options[optionIndex]) options[optionIndex].click();
          }
      }
  });

  function procurarNoDicionario() {
      if(!dictSearchInput || !dictResultsContainer || !fullDatabase || !fullDatabase.length) return;
      const termo = dictSearchInput.value.toLowerCase().trim();
      if(termo === "") { dictResultsContainer.innerHTML = ""; return; }
      const resultados = fullDatabase.filter(p => {
          const textoCompleto = ((p.pergunta || "") + " " + (p.justificacao || "") + " " + (p.opcoes ? p.opcoes.join(" ") : "") + " " + (p.pares ? p.pares.map(x=>x.conceito).join(" ") : "")).toLowerCase();
          return textoCompleto.includes(termo);
      });
      if(resultados.length === 0) { dictResultsContainer.innerHTML = "<p style='font-size:0.9rem; color:var(--error); font-weight:600;'>Nenhum registo encontrado na base de dados.</p>"; return; }
      let htmlResultados = "";
      resultados.slice(0, 10).forEach((res) => {
          htmlResultados += `
              <div class="glass-panel" style="margin-bottom: 12px; padding: 15px; border-left: 4px solid var(--primary);">
                  <strong style="color:var(--text-main); display:block; margin-bottom:4px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">${escapeHtml((res.macro_tema || "TEMA").replace(/_/g, ' '))}</strong>
                  <i style="color:var(--text-muted); display:block; margin-bottom:8px; font-size:0.9rem;">${escapeHtml(res.pergunta)}</i>
                  <div style="background: var(--bg-body); padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                      <p style="margin: 0 0 8px 0; color: var(--success); font-weight:700;">✅ ${escapeHtml(res.resposta_correta || res.resposta_referencia || "Questão Estrutural (Drag & Drop)")}</p>
                      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">${escapeHtml(res.justificacao)}</p>
                  </div>
              </div>
          `;
      });
      if(resultados.length > 10) htmlResultados += `<p style='font-size:0.8rem; text-align:center; color: var(--text-muted);'>[ A mostrar 10 de ${resultados.length} registos ]</p>`;
      dictResultsContainer.innerHTML = htmlResultados;
  }
  
  initTheme(); initScrollTopButton();
});