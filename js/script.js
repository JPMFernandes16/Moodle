document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // CONFIG & STATE
  // ======================================================
  const QUIZ_DURATION_SECONDS = 40 * 60;

  const disciplinaSelect = document.getElementById("disciplina");
  const carregarQuizBtn = document.getElementById("carregarQuiz");
  const carregarFraquezasBtn = document.getElementById("carregarFraquezas");
  const submeterQuizBtn = document.getElementById("submeterQuiz");
  const finishLink = document.getElementById("finishLink");
  const timerElement = document.getElementById("timer");
  const expectedQuestionsElement = document.getElementById("expectedQuestions");
  const currentQuestionIndicator = document.getElementById("currentQuestionIndicator");
  const answeredCountElement = document.getElementById("answeredCount");
  const remainingCountElement = document.getElementById("remainingCount");
  const quizStateText = document.getElementById("quizStateText");
  const progressPercentage = document.getElementById("progressPercentage");
  const progressBarFill = document.getElementById("progressBarFill");
  const questionNavigator = document.getElementById("questionNavigator");
  const quizContainer = document.getElementById("quiz-container");
  const resultadoFinal = document.getElementById("resultado-final"); // O culpado estava aqui!
  const prevQuestionBtn = document.getElementById("prevQuestionBtn");
  const nextQuestionBtn = document.getElementById("nextQuestionBtn");
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");
  const scrollTopBtn = document.getElementById("scrollTopBtn");

  const globalProgressText = document.getElementById("globalProgressText");
  const globalProgressBarFill = document.getElementById("globalProgressBarFill");
  const globalProgressPercent = document.getElementById("globalProgressPercent");
  const resetProgressBtn = document.getElementById("resetProgressBtn");
  const themeAnalyticsContainer = document.getElementById("themeAnalyticsContainer");

  const dictSearchInput = document.getElementById("dictSearchInput");
  const dictResultsContainer = document.getElementById("dictResultsContainer");

  let fullDatabase = []; 
  let configDatabase = {}; 
  let quizData = [];
  let userAnswers = {};
  let currentQuestionIndex = 0;
  let quizLoaded = false;
  let quizSubmitted = false;
  let timerInterval = null;
  let timeLeft = QUIZ_DURATION_SECONDS;
  let currentDisciplina = "";

  let globalStorage = JSON.parse(localStorage.getItem("moodle-iscap-storage")) || {};

  // ======================================================
  // ANIMAÇÕES & MICRO-INTERAÇÕES
  // ======================================================
  function playDing() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) { console.log("Áudio não suportado neste browser."); }
  }

  function fireConfetti() {
    for (let i = 0; i < 70; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = ['#8a1538', '#198754', '#ffc107', '#0dcaf0'][Math.floor(Math.random() * 4)];
        conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
        conf.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 5000);
    }
  }

  // ======================================================
  // INICIALIZAÇÃO DA DISCIPLINA COM FALLBACK INTELIGENTE
  // ======================================================
  async function carregarDisciplinaBase() {
      currentDisciplina = disciplinaSelect?.value || "BIA_BIAT";

      try {
          let response = await fetch(`data/${currentDisciplina}.json`);
          if (!response.ok) response = await fetch(`${currentDisciplina}.json`);
          if (!response.ok) throw new Error(`Ficheiro JSON não encontrado.`);

          const data = await response.json();
          fullDatabase = data.perguntas || [];
          configDatabase = data.configuracao_teste || {};
          
          if (!globalStorage[currentDisciplina]) {
              globalStorage[currentDisciplina] = { correct: [], wrong: [] };
          }
          
          updateGlobalProgressUI();
          if(dictSearchInput) procurarNoDicionario();

      } catch (e) {
          console.error("Erro a carregar o JSON:", e);
          throw e; 
      }
  }

  // ======================================================
  // O "MOTOR" DE GERAÇÃO DE TESTES
  // ======================================================
  function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
  }

  function generateQuizDataLocally(mode = "normal") {
      let todasPerguntas = [...fullDatabase];
      let configTemas = { ...configDatabase };
      let testeFinal = [];

      if (mode === "mistakes") {
          const wrongIds = globalStorage[currentDisciplina]?.wrong || [];
          testeFinal = todasPerguntas.filter(p => wrongIds.includes(p.id));
          if (testeFinal.length === 0) return []; 
          if (testeFinal.length > 24) testeFinal = shuffleArray(testeFinal).slice(0, 24);
          else testeFinal = shuffleArray(testeFinal);
      } 
      else {
          const perguntasDnd = todasPerguntas.filter(p => p.tipo === "drag_and_drop");
          if (perguntasDnd.length > 0) {
              const perguntaObrigatoria = perguntasDnd[Math.floor(Math.random() * perguntasDnd.length)];
              testeFinal.push(perguntaObrigatoria);
              if (configTemas[perguntaObrigatoria.macro_tema] > 0) {
                  configTemas[perguntaObrigatoria.macro_tema] -= 1;
              }
              todasPerguntas = todasPerguntas.filter(p => p.id !== perguntaObrigatoria.id);
          }

          for (const [macroTema, quantidade] of Object.entries(configTemas)) {
              if (quantidade <= 0) continue;
              const perguntasDoTema = todasPerguntas.filter(p => p.macro_tema === macroTema);
              const selecionadas = shuffleArray([...perguntasDoTema]).slice(0, Math.min(quantidade, perguntasDoTema.length));
              testeFinal.push(...selecionadas);
          }
          testeFinal = shuffleArray(testeFinal);
      }

      testeFinal.forEach(p => {
          if (p.tipo === "multiple_choice" && p.opcoes) p.opcoes = shuffleArray([...p.opcoes]);
          else if (p.tipo === "drag_and_drop" && p.pares) p.pares = shuffleArray([...p.pares]);
      });

      return testeFinal;
  }

  async function iniciarTeste(mode = "normal") {
      try {
          if(quizContainer) quizContainer.innerHTML = "<p>A preparar o teu teste...</p>";

          if (!fullDatabase || fullDatabase.length === 0) {
              await carregarDisciplinaBase();
          }

          if (!fullDatabase || fullDatabase.length === 0) {
              throw new Error("O ficheiro JSON foi encontrado, mas não contém perguntas válidas (verifica a formatação).");
          }

          quizData = generateQuizDataLocally(mode);
          
          if (quizData.length === 0 && mode === "mistakes") {
              if(quizContainer) quizContainer.innerHTML = `<article class="question-card"><h2 style="color:var(--success);">Tudo dominado! 🎉</h2><p>Não tens perguntas assinaladas como erradas nesta disciplina. Faz o modo normal!</p></article>`;
              return;
          }

          if (quizData.length === 0) {
              throw new Error("O teste gerou 0 perguntas. Verifica se os nomes dos temas na 'configuracao_teste' coincidem com os temas das perguntas.");
          }

          userAnswers = {};
          currentQuestionIndex = 0;
          quizLoaded = true;
          quizSubmitted = false;

          clearTopMessage();
          renderQuestionNavigator();
          renderCurrentQuestion();
          updateTopIndicators();
          updateNavButtonsState();
          updateQuestionStateLabel();
          startTimer();

          if (submeterQuizBtn) {
            submeterQuizBtn.classList.remove("hidden");
            submeterQuizBtn.disabled = false;
            submeterQuizBtn.textContent = "Submeter tudo e terminar";
          }
          if (finishLink) finishLink.style.display = "block";
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

      } catch (err) {
          console.error(err);
          if(quizContainer) {
              quizContainer.innerHTML = `
                  <article class="question-card" style="border-left: 6px solid var(--error);">
                      <h2 style="color: var(--error);">⚠️ Ups! Ocorreu um problema a carregar.</h2>
                      <p>O teste parou de processar porque detetou um erro técnico:</p>
                      <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; color: #dc3545;">${err.message}</pre>
                      <p><strong>Dicas de resolução:</strong></p>
                      <ul style="font-size: 0.9rem;">
                          <li>Confirma se tens o <strong style="color:var(--primary);">Live Server</strong> ligado no VS Code.</li>
                          <li>Confirma se tens alguma vírgula esquecida no ficheiro <code>${disciplinaSelect?.value || 'BIA_BIAT'}.json</code> que possa estar a quebrar o código.</li>
                      </ul>
                  </article>
              `;
          }
      }
  }

  // ======================================================
  // PROGRESSO GLOBAL & ANALYTICS
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

    if (percentage === 100 && globalProgressBarFill) globalProgressBarFill.style.backgroundColor = "var(--success)";
    else if(globalProgressBarFill) globalProgressBarFill.style.backgroundColor = "var(--primary)";

    if (themeAnalyticsContainer) {
        const temasEstatisticas = {};
        fullDatabase.forEach(p => {
            if(!p.macro_tema) return; 
            if(!temasEstatisticas[p.macro_tema]) temasEstatisticas[p.macro_tema] = { total: 0, certos: 0 };
            temasEstatisticas[p.macro_tema].total++;
            if (subjData.correct && subjData.correct.includes(p.id)) temasEstatisticas[p.macro_tema].certos++;
        });

        let htmlRadar = "";
        for (const [tema, stats] of Object.entries(temasEstatisticas)) {
            const percTema = Math.round((stats.certos / stats.total) * 100);
            let barColor = "var(--error)";
            if (percTema >= 50) barColor = "var(--warning)";
            if (percTema >= 80) barColor = "var(--success)";

            htmlRadar += `
                <div style="margin-bottom: 10px;">
                    <div style="display:flex; justify-content: space-between; font-size:0.75rem; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">
                        <span>${escapeHtml(tema.replace(/_/g, ' '))}</span>
                        <span>${percTema}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top:3px;">
                        <div style="height: 100%; width: ${percTema}%; background: ${barColor}; transition: 0.5s;"></div>
                    </div>
                </div>
            `;
        }
        themeAnalyticsContainer.innerHTML = htmlRadar;
    }
  }

  function guardarResultadosNaMemoria() {
      const subjData = globalStorage[currentDisciplina];
      if(!subjData) return false;

      let todosCertos = true;

      quizData.forEach((q, i) => {
          const isCorrect = isQuestionCorrect(q, i);
          if (isCorrect) {
              if (!subjData.correct.includes(q.id)) subjData.correct.push(q.id);
              subjData.wrong = subjData.wrong.filter(id => id !== q.id);
          } else {
              todosCertos = false;
              if (!subjData.wrong.includes(q.id) && !subjData.correct.includes(q.id)) {
                  subjData.wrong.push(q.id);
              }
          }
      });

      localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
      updateGlobalProgressUI();
      return todosCertos;
  }

  // ======================================================
  // MODO DICIONÁRIO / CÁBULA
  // ======================================================
  function procurarNoDicionario() {
      if(!dictSearchInput || !dictResultsContainer || !fullDatabase || !fullDatabase.length) return;
      
      const termo = dictSearchInput.value.toLowerCase().trim();
      if(termo === "") {
          dictResultsContainer.innerHTML = "<p style='font-size:0.85rem; color:var(--text-muted);'>Escreve um termo acima para pesquisar na base de dados.</p>";
          return;
      }

      const resultados = fullDatabase.filter(p => {
          const textoCompleto = (
              (p.pergunta || "") + " " + 
              (p.justificacao || "") + " " + 
              (p.opcoes ? p.opcoes.join(" ") : "") + " " + 
              (p.pares ? p.pares.map(x=>x.conceito).join(" ") : "")
          ).toLowerCase();
          return textoCompleto.includes(termo);
      });

      if(resultados.length === 0) {
          dictResultsContainer.innerHTML = "<p style='font-size:0.85rem; color:var(--error);'>Nenhum conceito encontrado.</p>";
          return;
      }

      let htmlResultados = "";
      resultados.slice(0, 10).forEach((res) => {
          htmlResultados += `
              <div style="border-left: 3px solid var(--primary); padding-left: 10px; margin-bottom: 15px; font-size: 0.85rem;">
                  <strong style="color:var(--text-main);">${escapeHtml((res.macro_tema || "TEMA").replace(/_/g, ' ').toUpperCase())}</strong><br>
                  <i style="color:var(--text-muted);">${escapeHtml(res.pergunta)}</i>
                  <p style="margin-top: 5px; color: var(--success); font-weight:600;">${escapeHtml(res.resposta_correta || "Pergunta de Arrastar e Largar")}</p>
                  <p style="margin-top: 5px; background:var(--bg-body); padding:5px; border-radius:3px;">${escapeHtml(res.justificacao)}</p>
              </div>
          `;
      });

      if(resultados.length > 10) htmlResultados += `<p style='font-size:0.8rem; text-align:center;'>A mostrar 10 de ${resultados.length} resultados. Refina a pesquisa.</p>`;
      dictResultsContainer.innerHTML = htmlResultados;
  }

  // ======================================================
  // HELPERS BÁSICOS E NAVEGAÇÃO
  // ======================================================
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function normalizeText(value) { return value === null || value === undefined ? "" : String(value).trim(); }
  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function scrollToTopSmooth() { window.scrollTo({ top: 0, behavior: "smooth" }); }

  function getAnsweredCount() {
    return Object.values(userAnswers).filter((answer) => {
      if (typeof answer === 'object' && answer !== null) return Object.keys(answer).length > 0;
      return normalizeText(answer) !== "";
    }).length;
  }
  function getProgressPercentage() {
    if (!quizData.length) return 0;
    return Math.round((getAnsweredCount() / quizData.length) * 100);
  }

  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
  function updateTimerUI() { if (timerElement) timerElement.textContent = formatTime(timeLeft); }
  function resetTimer() { stopTimer(); timeLeft = QUIZ_DURATION_SECONDS; updateTimerUI(); }
  function startTimer() {
    resetTimer();
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0; updateTimerUI(); stopTimer();
        if (quizLoaded && !quizSubmitted) verificarRespostas(true);
        return;
      }
      updateTimerUI();
    }, 1000);
  }

  function setQuizState(text) { if (quizStateText) quizStateText.textContent = text; }
  function updateQuestionStateLabel() {
    if (!quizLoaded) return setQuizState("Aguardando início");
    if (quizSubmitted) return setQuizState("Corrigido");
    const answered = getAnsweredCount();
    if (answered === 0) return setQuizState("Não iniciado");
    if (answered === quizData.length) return setQuizState("Pronto a submeter");
    return setQuizState("Em progresso");
  }

  function clearTopMessage() { 
      if (resultadoFinal) resultadoFinal.innerHTML = ""; // Proteção adicionada
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("iscap-theme", theme);
    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    if (themeText) themeText.textContent = theme === "dark" ? "Modo claro" : "Modo escuro";
  }
  function initTheme() {
    const savedTheme = localStorage.getItem("iscap-theme");
    applyTheme(savedTheme === "dark" ? "dark" : "light");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    }
  }

  function initScrollTopButton() {
    if (!scrollTopBtn) return;
    window.addEventListener("scroll", () => {
      if (window.scrollY > 250) scrollTopBtn.classList.add("show");
      else scrollTopBtn.classList.remove("show");
    });
    scrollTopBtn.addEventListener("click", scrollToTopSmooth);
  }

  function goToQuestion(index) {
    currentQuestionIndex = index;
    renderCurrentQuestion();
    updateNavButtonsState();
    renderQuestionNavigator();
  }
  function goToPreviousQuestion() { if (currentQuestionIndex > 0) goToQuestion(currentQuestionIndex - 1); }
  function goToNextQuestion() { if (currentQuestionIndex < quizData.length - 1) goToQuestion(currentQuestionIndex + 1); }

  function updateNavButtonsState() {
    if (!quizData.length) {
      if (prevQuestionBtn) prevQuestionBtn.disabled = true;
      if (nextQuestionBtn) nextQuestionBtn.disabled = true;
      return;
    }
    if (prevQuestionBtn) prevQuestionBtn.disabled = currentQuestionIndex === 0;
    if (nextQuestionBtn) nextQuestionBtn.disabled = currentQuestionIndex === quizData.length - 1;
  }

  function renderQuestionNavigator() {
    if (!questionNavigator) return;
    if (!quizData.length) { questionNavigator.innerHTML = ""; return; }

    questionNavigator.innerHTML = quizData.map((q, index) => {
      const isActive = index === currentQuestionIndex;
      const isAnswered = getAnsweredCountForIndex(index);
      let className = "question-nav-item";
      if (isActive) className += " is-active";
      if (isAnswered && !quizSubmitted) className += " is-answered";
      
      if (quizSubmitted) {
         className += " is-locked";
         if (isQuestionCorrect(q, index)) className += " is-correct";
         else className += " is-incorrect";
      }
      return `<button type="button" class="${className}" data-question-index="${index}">${index + 1}</button>`;
    }).join("");

    questionNavigator.querySelectorAll(".question-nav-item").forEach((btn) => {
      btn.addEventListener("click", () => goToQuestion(Number(btn.dataset.questionIndex)));
    });
  }

  function getAnsweredCountForIndex(index) {
      const ans = userAnswers[index];
      if (!ans) return false;
      if (typeof ans === 'object') return Object.keys(ans).length > 0;
      return normalizeText(ans) !== "";
  }

  function isQuestionCorrect(question, index) {
      const selectedAnswer = userAnswers[index];
      if (!selectedAnswer) return false;
      if (question.tipo === "drag_and_drop") {
          if (typeof selectedAnswer !== 'object') return false;
          for (let p of question.pares) {
              if (selectedAnswer[p.definicao] !== p.conceito) return false;
          }
          return true;
      } else {
          return normalizeText(selectedAnswer) === normalizeText(question.resposta_correta);
      }
  }

  function updateTopIndicators() {
    const total = quizData.length || 24;
    const answered = getAnsweredCount();
    const remaining = Math.max(total - answered, 0);
    const progress = quizData.length ? getProgressPercentage() : 0;

    if (expectedQuestionsElement) expectedQuestionsElement.textContent = String(total);
    if (currentQuestionIndicator) currentQuestionIndicator.textContent = quizLoaded ? `${currentQuestionIndex + 1} / ${total}` : `0 / ${total}`;
    if (answeredCountElement) answeredCountElement.textContent = String(answered);
    if (remainingCountElement) remainingCountElement.textContent = String(remaining);
    if (progressPercentage) progressPercentage.textContent = `${progress}%`;
    if (progressBarFill) progressBarFill.style.width = `${progress}%`;
  }

  // ======================================================
  // RENDER QUESTION E DRAG & DROP
  // ======================================================
  function renderCurrentQuestion() {
    if (!quizData.length || !quizContainer) return; // Proteção

    const question = quizData[currentQuestionIndex];
    const selectedAnswer = userAnswers[currentQuestionIndex];
    const isCorrect = quizSubmitted ? isQuestionCorrect(question, currentQuestionIndex) : null;

    let html = `
      <article class="question-card ${quizSubmitted && !isCorrect ? 'shake' : ''}" id="q-card-${currentQuestionIndex}">
        <header class="question-card__header">
          <div class="question-card__meta">
            <span class="question-card__badge">Pergunta ${currentQuestionIndex + 1}</span>
            ${question.macro_tema ? `<span class="question-card__topic">${escapeHtml(question.macro_tema.replace(/_/g, ' ').toUpperCase())}</span>` : ""}
          </div>
          ${question.tema ? `<p class="question-card__subtopic">${escapeHtml(question.tema.replace(/_/g, ' ').toUpperCase())}</p>` : ""}
          <h2 class="question-card__title">${escapeHtml(question.pergunta)}</h2>
        </header>
        <div class="question-card__body">
    `;

    if (question.tipo === "drag_and_drop") html += renderDragAndDrop(question, selectedAnswer);
    else html += renderMultipleChoice(question, selectedAnswer || "");

    if (quizSubmitted) {
      html += `
          <div class="justification-box">
            <p class="feedback-status" style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">
              ${isCorrect ? "✅ Correto!" : "❌ Incorreto."}
            </p>
            ${question.tipo !== "drag_and_drop" ? `<p><strong>A resposta correta é:</strong> ${escapeHtml(question.resposta_correta)}</p>` : ''}
            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;">
            <p><strong>Justificação:</strong> ${escapeHtml(question.justificacao)}</p>
          </div>
      `;
    }

    html += `</div></article>`;
    quizContainer.innerHTML = html;

    if (question.tipo === "drag_and_drop") {
        if (!quizSubmitted) setupDragAndDropEvents();
    } else {
        if (quizSubmitted) {
            const card = document.getElementById(`q-card-${currentQuestionIndex}`);
            if(card) {
                card.classList.add(isCorrect ? "correct" : "incorrect");
                card.querySelectorAll(".option-item").forEach(label => {
                    const radioVal = normalizeText(label.querySelector('input').value);
                    if (radioVal === normalizeText(question.resposta_correta)) label.classList.add("option-correct");
                    else if (radioVal === normalizeText(selectedAnswer) && !isCorrect) label.classList.add("option-selected-wrong");
                });
            }
        } else {
            quizContainer.querySelectorAll(`input[type="radio"]`).forEach(radio => {
                radio.addEventListener("change", (e) => {
                    userAnswers[currentQuestionIndex] = e.target.value;
                    updateTopIndicators();
                    renderQuestionNavigator();
                    updateQuestionStateLabel();
                });
            });
        }
    }
  }

  function renderMultipleChoice(question, selectedAnswer) {
      const options = Array.isArray(question.opcoes) ? question.opcoes : [];
      return `
        <div class="options-group">
          ${options.map((option, idx) => {
            const isChecked = normalizeText(selectedAnswer) === normalizeText(option);
            return `
              <label class="option-item">
                <input type="radio" name="question-${currentQuestionIndex}" value="${escapeHtml(option)}" ${isChecked ? "checked" : ""} ${quizSubmitted ? "disabled" : ""}/>
                <span class="option-letter">${String.fromCharCode(65 + idx)}.</span>
                <span class="option-text">${escapeHtml(option)}</span>
              </label>
            `;
          }).join("")}
        </div>
      `;
  }

  function renderDragAndDrop(question, selectedAnswer) {
      const pares = question.pares || [];
      const allConceitos = pares.map(p => p.conceito);
      
      const placedObj = (typeof selectedAnswer === 'object' && selectedAnswer !== null) ? selectedAnswer : {};
      const placedConceitos = Object.values(placedObj);
      const bankConceitos = allConceitos.filter(c => !placedConceitos.includes(c)).sort();

      let dndHtml = `<div class="dnd-container"><div class="dnd-bank" id="dnd-bank">`;
      bankConceitos.forEach((c, i) => {
          dndHtml += `<div class="dnd-item" draggable="${!quizSubmitted}" data-conceito="${escapeHtml(c)}" id="drag-bank-${currentQuestionIndex}-${i}">${escapeHtml(c)}</div>`;
      });
      dndHtml += `</div><div class="dnd-target-list">`;
      pares.forEach((p, i) => {
          const placedItem = placedObj[p.definicao];
          let dropzoneClass = "dnd-dropzone";
          
          if (quizSubmitted) {
              const isRowCorrect = placedItem === p.conceito;
              dropzoneClass += isRowCorrect ? " correct" : " incorrect";
          }
          if (placedItem) dropzoneClass += " has-item";

          dndHtml += `
            <div class="dnd-row">
              <div class="dnd-definition">${escapeHtml(p.definicao)}</div>
              <div class="${dropzoneClass}" data-def="${escapeHtml(p.definicao)}">
          `;
          
          if (placedItem) {
              dndHtml += `<div class="dnd-item" draggable="${!quizSubmitted}" data-conceito="${escapeHtml(placedItem)}" id="drag-placed-${currentQuestionIndex}-${i}">${escapeHtml(placedItem)}</div>`;
          }

          if (quizSubmitted && placedItem !== p.conceito) {
               dndHtml += `<span class="dnd-correct-answer">Correto: ${escapeHtml(p.conceito)}</span>`;
          }
          dndHtml += `</div></div>`;
      });
      dndHtml += `</div></div>`;
      return dndHtml;
  }

  function setupDragAndDropEvents() {
      if(!quizContainer) return;
      const items = quizContainer.querySelectorAll('.dnd-item');
      const dropzones = quizContainer.querySelectorAll('.dnd-dropzone');
      const bank = quizContainer.querySelector('#dnd-bank');

      items.forEach(item => {
          item.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text/plain', item.id);
              setTimeout(() => item.classList.add('dragging'), 0);
          });
          item.addEventListener('dragend', () => { item.classList.remove('dragging'); });
      });

      const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
      const handleDragLeave = (e) => { e.currentTarget.classList.remove('drag-over'); };

      dropzones.forEach(zone => {
          zone.addEventListener('dragover', handleDragOver);
          zone.addEventListener('dragleave', handleDragLeave);
          zone.addEventListener('drop', (e) => {
              e.preventDefault();
              zone.classList.remove('drag-over');
              const draggedId = e.dataTransfer.getData('text/plain');
              const draggedElement = document.getElementById(draggedId);
              
              if (draggedElement) {
                  const existingItem = zone.querySelector('.dnd-item');
                  if (existingItem && existingItem !== draggedElement && bank) bank.appendChild(existingItem);
                  zone.appendChild(draggedElement);
                  zone.classList.add('has-item');
                  playDing(); 
                  saveDragAndDropState();
              }
          });
      });

      if (bank) {
          bank.addEventListener('dragover', handleDragOver);
          bank.addEventListener('dragleave', handleDragLeave);
          bank.addEventListener('drop', (e) => {
              e.preventDefault();
              bank.classList.remove('drag-over');
              const draggedId = e.dataTransfer.getData('text/plain');
              const draggedElement = document.getElementById(draggedId);
              
              if (draggedElement) {
                  bank.appendChild(draggedElement);
                  saveDragAndDropState();
              }
          });
      }
  }

  function saveDragAndDropState() {
      if(!quizContainer) return;
      const dropzones = quizContainer.querySelectorAll('.dnd-dropzone');
      let currentAnswers = {};
      dropzones.forEach(zone => {
          const def = zone.getAttribute('data-def');
          const item = zone.querySelector('.dnd-item');
          if (item) currentAnswers[def] = item.getAttribute('data-conceito');
      });
      userAnswers[currentQuestionIndex] = currentAnswers;
      
      dropzones.forEach(zone => {
          if (!zone.querySelector('.dnd-item')) zone.classList.remove('has-item');
      });

      updateTopIndicators();
      renderQuestionNavigator();
      updateQuestionStateLabel();
  }

  // ======================================================
  // CORRECTION AND SUBMIT
  // ======================================================
  function verificarRespostas(submissaoAutomatica = false) {
    if (!quizLoaded || quizSubmitted) return;

    quizSubmitted = true;
    stopTimer();

    const todosCertos = guardarResultadosNaMemoria();

    let score = 0;
    quizData.forEach((q, i) => { if (isQuestionCorrect(q, i)) score++; });

    const percentage = ((score / quizData.length) * 100).toFixed(0);
    const notaMoodle = ((score / quizData.length) * 20).toFixed(2);
    
    if (percentage == 100) fireConfetti();

    // Como o HTML do Utilizador não tem a secção "resultado-final", vamos desenhar isto diretamente dentro do quizContainer!
    let htmlResultado = `
      <article class="question-card" style="border-left: 6px solid var(--primary); text-align: center;">
        <h2 style="color: var(--primary);">${submissaoAutomatica ? "⏳ Tempo Esgotado" : "📊 Teste Concluído"}</h2>
        <p style="font-size: 1.2rem; margin-bottom: 5px;">Nota Moodle: <strong>${notaMoodle}</strong> / 20,00</p>
        <p>Acertaste <strong>${score}</strong> de <strong>${quizData.length}</strong> perguntas (<strong>${percentage}%</strong>).</p>
        <p style="color: var(--text-muted); font-size: 0.9em; margin-top: 15px;">
          Navega pelas perguntas usando o menu lateral para rever as tuas respostas. <br>
          As perguntas que erraste foram guardadas no modo <strong>Foco nas Fraquezas</strong>.
        </p>
      </article>
    `;

    // Se o resultado-final existir, usamos. Se não, metemos no topo do quiz-container!
    if (resultadoFinal) {
        resultadoFinal.innerHTML = htmlResultado;
    } else if (quizContainer) {
        quizContainer.insertAdjacentHTML("afterbegin", htmlResultado);
    }

    if (submeterQuizBtn) submeterQuizBtn.classList.add("hidden");
    if (finishLink) finishLink.style.display = "none";

    renderQuestionNavigator(); 
    renderCurrentQuestion();   
    updateTopIndicators();
    updateQuestionStateLabel();
    scrollToTopSmooth();
  }

  // ======================================================
  // EVENT LISTENERS & INITS
  // ======================================================
  if (disciplinaSelect) {
      disciplinaSelect.addEventListener("change", carregarDisciplinaBase);
  }
  
  if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", () => iniciarTeste("normal"));
  if (carregarFraquezasBtn) carregarFraquezasBtn.addEventListener("click", () => iniciarTeste("mistakes"));
  
  if (submeterQuizBtn) submeterQuizBtn.addEventListener("click", () => verificarRespostas(false));
  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  
  if (dictSearchInput) {
      dictSearchInput.addEventListener("input", procurarNoDicionario);
  }

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", () => {
      if (confirm(`Queres mesmo apagar o teu progresso em ${currentDisciplina}? Terás de voltar a dominar a matéria do zero.`)) {
        globalStorage[currentDisciplina] = { correct: [], wrong: [] };
        localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
        updateGlobalProgressUI();
      }
    });
  }

  // INICIAR
  initTheme();
  initScrollTopButton();
  carregarDisciplinaBase();
});