document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // SISTEMA DE SEGURANÇA (PASSWORD)
  // ======================================================
  const PALAVRA_PASSE_SECRETA = "iscap2026"; // Muda esta password para o que quiseres!
  
  const securityLayer = document.getElementById("security-layer");
  const pwdInput = document.getElementById("app-password");
  const btnUnlock = document.getElementById("btn-unlock");
  const pwdError = document.getElementById("pwd-error");

  if (securityLayer && btnUnlock) {
      if (localStorage.getItem("app-unlocked") === "true") {
          securityLayer.style.display = "none";
      } else {
          btnUnlock.addEventListener("click", () => {
              if (pwdInput.value === PALAVRA_PASSE_SECRETA) {
                  localStorage.setItem("app-unlocked", "true"); // Guarda o login no telemóvel/PC
                  securityLayer.style.opacity = "0";
                  securityLayer.style.visibility = "hidden";
                  setTimeout(() => securityLayer.style.display = "none", 400);
              } else {
                  pwdError.style.display = "block";
                  pwdInput.value = "";
              }
          });
      }
  }

  // ======================================================
  // CONFIG & STATE
  // ======================================================
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
  const progressBarFill = document.getElementById("progressBarFill");
  const questionNavigator = document.getElementById("questionNavigator");
  const quizContainer = document.getElementById("quiz-container");
  const prevQuestionBtn = document.getElementById("prevQuestionBtn");
  const nextQuestionBtn = document.getElementById("nextQuestionBtn");
  const themeToggle = document.getElementById("themeToggle");
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
  let currentDisciplina = "";

  // VARIÁVEIS DINÂMICAS DO EXAME
  let quizDurationSeconds = 40 * 60; // Default 40 min
  let penalizacaoPorErro = 0;        // Default 0%
  let timeLeft = quizDurationSeconds;

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
        conf.style.backgroundColor = ['#9f1239', '#10b981', '#f59e0b', '#0ea5e9'][Math.floor(Math.random() * 4)];
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
          
          // LER REGRAS ESPECÍFICAS DA DISCIPLINA
          const regrasExame = data.opcoes_exame || {};
          quizDurationSeconds = (regrasExame.duracao_minutos || 40) * 60;
          penalizacaoPorErro = regrasExame.desconto_erro || 0;
          
          resetTimer(); 
          
          // Atualiza o texto da barra do Dicionário
          if (dictSearchInput && disciplinaSelect) {
              const nomeCadeira = disciplinaSelect.options[disciplinaSelect.selectedIndex].text;
              dictSearchInput.placeholder = `Pesquisar em ${nomeCadeira}...`;
          }

          // --- NOVIDADE: Atualiza o link do PDF ---
          const btnLerResumo = document.getElementById("btnLerResumo");
          if (btnLerResumo) {
              btnLerResumo.href = `pdfs/${currentDisciplina}.pdf`;
          }
          // ----------------------------------------

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
          
          // Calcula o total de perguntas normal do exame para o limite das fraquezas
          let totalNormal = Object.values(configTemas).reduce((a, b) => a + b, 0) || 24;
          if (testeFinal.length > totalNormal) testeFinal = shuffleArray(testeFinal).slice(0, totalNormal);
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
          if(quizContainer) quizContainer.innerHTML = "<p style='text-align:center; padding: 40px;'>A preparar o teu teste...</p>";

          if (!fullDatabase || fullDatabase.length === 0) {
              await carregarDisciplinaBase();
          }

          if (!fullDatabase || fullDatabase.length === 0) {
              throw new Error("O ficheiro JSON foi encontrado, mas não contém perguntas válidas.");
          }

          quizData = generateQuizDataLocally(mode);
          
          if (quizData.length === 0 && mode === "mistakes") {
              if(quizContainer) quizContainer.innerHTML = `<article class="question-card" style="text-align:center;"><div style="font-size:3rem;">🎉</div><h2 style="color:var(--success);">Tudo dominado!</h2><p>Não tens perguntas assinaladas como erradas nesta disciplina. Faz o modo normal!</p></article>`;
              return;
          }

          if (quizData.length === 0) throw new Error("O teste gerou 0 perguntas. Verifica as configurações.");

          userAnswers = {};
          currentQuestionIndex = 0;
          quizLoaded = true;
          quizSubmitted = false;

          renderQuestionNavigator();
          renderCurrentQuestion();
          updateTopIndicators();
          updateNavButtonsState();
          updateQuestionStateLabel();
          startTimer();

          if (submeterQuizBtn) {
            submeterQuizBtn.classList.remove("hidden");
            submeterQuizBtn.disabled = false;
          }
          if (finishLink) finishLink.classList.remove("hidden");
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

      } catch (err) {
          console.error(err);
          if(quizContainer) {
              quizContainer.innerHTML = `
                  <article class="question-card" style="border-left: 6px solid var(--error);">
                      <h2 style="color: var(--error);">⚠️ Ups! Ocorreu um problema a carregar.</h2>
                      <p>O teste parou de processar porque detetou um erro técnico:</p>
                      <pre style="background: var(--bg-body); padding: 10px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; color: var(--error);">${err.message}</pre>
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
                <div style="margin-bottom: 12px;">
                    <div style="display:flex; justify-content: space-between; font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom: 4px;">
                        <span>${escapeHtml(tema.replace(/_/g, ' '))}</span>
                        <span>${percTema}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${percTema}%; background: ${barColor}; transition: width 0.8s ease;"></div>
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
  // MODO DICIONÁRIO
  // ======================================================
  function procurarNoDicionario() {
      if(!dictSearchInput || !dictResultsContainer || !fullDatabase || !fullDatabase.length) return;
      
      const termo = dictSearchInput.value.toLowerCase().trim();
      if(termo === "") {
          dictResultsContainer.innerHTML = "";
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
          dictResultsContainer.innerHTML = "<p style='font-size:0.9rem; color:var(--error); font-weight:600;'>Nenhum conceito encontrado.</p>";
          return;
      }

      let htmlResultados = "";
      resultados.slice(0, 10).forEach((res) => {
          htmlResultados += `
              <div style="background: var(--bg-body); border-left: 4px solid var(--primary); padding: 15px; border-radius: 8px; margin-bottom: 12px; font-size: 0.95rem;">
                  <strong style="color:var(--text-main); display:block; margin-bottom:4px;">${escapeHtml((res.macro_tema || "TEMA").replace(/_/g, ' ').toUpperCase())}</strong>
                  <i style="color:var(--text-muted); display:block; margin-bottom:8px;">${escapeHtml(res.pergunta)}</i>
                  <div style="background: var(--bg-card); padding: 10px; border-radius: 6px; border: 1px solid var(--border);">
                      <p style="margin: 0 0 8px 0; color: var(--success); font-weight:700;">✅ ${escapeHtml(res.resposta_correta || "Pergunta de Arrastar e Largar")}</p>
                      <p style="margin: 0; font-size: 0.9rem; line-height: 1.4;">${escapeHtml(res.justificacao)}</p>
                  </div>
              </div>
          `;
      });

      if(resultados.length > 10) htmlResultados += `<p style='font-size:0.8rem; text-align:center; color: var(--text-muted);'>A mostrar 10 de ${resultados.length} resultados.</p>`;
      dictResultsContainer.innerHTML = htmlResultados;
  }

  // ======================================================
  // HELPERS & NAVEGAÇÃO
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

  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
  function updateTimerUI() { if (timerElement) timerElement.textContent = formatTime(timeLeft); }
  function resetTimer() { stopTimer(); timeLeft = quizDurationSeconds; updateTimerUI(); }
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

  function updateQuestionStateLabel() {
    if (!quizStateText) return;
    if (!quizLoaded) return quizStateText.textContent = "Em espera";
    if (quizSubmitted) return quizStateText.textContent = "Corrigido";
    const answered = getAnsweredCount();
    if (answered === 0) return quizStateText.textContent = "Em progresso";
    if (answered === quizData.length) return quizStateText.textContent = "Pronto a submeter";
    return quizStateText.textContent = "Em progresso";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("iscap-theme", theme);
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
    const total = quizData.length || 0;
    const answered = getAnsweredCount();
    const remaining = Math.max(total - answered, 0);

    if (expectedQuestionsElement) expectedQuestionsElement.textContent = String(total);
    if (currentQuestionIndicator) currentQuestionIndicator.textContent = quizLoaded ? `${currentQuestionIndex + 1}` : `0`;
    if (answeredCountElement) answeredCountElement.textContent = String(answered);
    if (remainingCountElement) remainingCountElement.textContent = String(remaining);
  }

  // ======================================================
  // RENDER QUESTION E DRAG & DROP
  // ======================================================
  function renderCurrentQuestion() {
    if (!quizData.length || !quizContainer) return;

    const question = quizData[currentQuestionIndex];
    const selectedAnswer = userAnswers[currentQuestionIndex];
    const isCorrect = quizSubmitted ? isQuestionCorrect(question, currentQuestionIndex) : null;

    let html = `
      <article class="question-card ${quizSubmitted && !isCorrect ? 'shake' : ''}" id="q-card-${currentQuestionIndex}">
        <div class="question-card__meta">
          <span class="question-card__badge">Q.${currentQuestionIndex + 1}</span>
          ${question.macro_tema ? `<span class="question-card__topic">${escapeHtml(question.macro_tema.replace(/_/g, ' ').toUpperCase())}</span>` : ""}
        </div>
        <h2 class="question-card__title">${escapeHtml(question.pergunta)}</h2>
    `;

    if (question.tipo === "drag_and_drop") html += renderDragAndDrop(question, selectedAnswer);
    else html += renderMultipleChoice(question, selectedAnswer || "");

    if (quizSubmitted) {
      html += `
          <div class="justification-box">
            <p class="feedback-status" style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">
              ${isCorrect ? "✅ Resposta Certa!" : "❌ Resposta Errada"}
            </p>
            ${question.tipo !== "drag_and_drop" ? `<p><strong>Correta:</strong> ${escapeHtml(question.resposta_correta)}</p>` : ''}
            <div style="margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 10px;">
                <p style="margin:0;"><strong>Justificação:</strong> ${escapeHtml(question.justificacao)}</p>
            </div>
          </div>
      `;
    }

    html += `</article>`;
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
               dndHtml += `<span class="dnd-correct-answer">Deveria ser: ${escapeHtml(p.conceito)}</span>`;
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
  // CORREÇÃO E CÁLCULO DE PENALIZAÇÃO
  // ======================================================
  function verificarRespostas(submissaoAutomatica = false) {
    if (!quizLoaded || quizSubmitted) return;

    quizSubmitted = true;
    stopTimer();

    guardarResultadosNaMemoria();

    let acertos = 0;
    let errosComPenalizacao = 0;
    let respondidas = 0;

    quizData.forEach((q, i) => { 
        const isCorrect = isQuestionCorrect(q, i);
        const ans = userAnswers[i];
        
        // Verifica se o aluno respondeu a esta pergunta (ou preencheu o drag and drop)
        const hasAnswer = ans !== undefined && ans !== null && ans !== "" && (typeof ans !== 'object' || Object.keys(ans).length > 0);

        if (isCorrect) {
            acertos++;
            respondidas++;
        } else if (hasAnswer) {
            errosComPenalizacao++; // Só penaliza se tentou responder e errou
            respondidas++;
        }
    });

    // CÁLCULO DE NOTA COM NEGATIVAS
    const valorPorPergunta = 20 / quizData.length;
    let notaCalculada = (acertos * valorPorPergunta) - (errosComPenalizacao * valorPorPergunta * penalizacaoPorErro);
    if (notaCalculada < 0) notaCalculada = 0; // A nota não pode ser abaixo de 0

    const notaMoodle = notaCalculada.toFixed(2);
    
    // Mostra confettis se nota final for 20!
    if (notaCalculada >= 19.99) fireConfetti();

    let msgPenalizacao = penalizacaoPorErro > 0 
        ? `<p style="font-size: 0.85rem; color: var(--error); margin-top: 5px;">(Sofreste penalização de ${(penalizacaoPorErro * 100).toFixed(0)}% por cada um dos teus ${errosComPenalizacao} erros)</p>` 
        : ``;

    let htmlResultado = `
      <div class="quiz-final-summary">
        <h2 style="margin-bottom: 5px;">${submissaoAutomatica ? "⏳ Tempo Esgotado" : "📊 Exame Concluído"}</h2>
        <p style="font-size: 1.5rem; font-weight: 800; margin-bottom: 5px; color: white;">Nota: ${notaMoodle} / 20</p>
        <p style="font-size: 1rem; margin-bottom: 0;">Acertaste <strong>${acertos}</strong>, erraste <strong>${errosComPenalizacao}</strong> e deixaste <strong>${quizData.length - respondidas}</strong> em branco.</p>
        ${msgPenalizacao}
      </div>
    `;

    if (quizContainer) {
        // Remover a pergunta atual do ecrã e mostrar os resultados no topo
        quizContainer.innerHTML = "";
        quizContainer.insertAdjacentHTML("afterbegin", htmlResultado);
    }

    if (submeterQuizBtn) submeterQuizBtn.classList.add("hidden");
    if (finishLink) finishLink.classList.add("hidden");

    // Forçamos a renderização na primeira pergunta para o aluno começar a rever os erros
    currentQuestionIndex = 0;
    renderQuestionNavigator(); 
    renderCurrentQuestion();   
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
  
  if (submeterQuizBtn) submeterQuizBtn.addEventListener("click", () => {
      if(confirm("Tens a certeza que queres submeter o exame?")) verificarRespostas(false);
  });
  
  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  
  if (dictSearchInput) {
      dictSearchInput.addEventListener("input", procurarNoDicionario);
  }

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", () => {
      if (confirm(`Queres mesmo apagar a memória de erros em ${currentDisciplina}?`)) {
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