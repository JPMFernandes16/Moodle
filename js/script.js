document.addEventListener("DOMContentLoaded", () => {
  // ======================================================
  // CONFIG & STATE
  // ======================================================
  const QUIZ_DURATION_SECONDS = 40 * 60;
  const TOTAL_QUESTIONS_DB = 115; 

  // DOM Elements
  const disciplinaSelect = document.getElementById("disciplina");
  const carregarQuizBtn = document.getElementById("carregarQuiz");
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
  const resultadoFinal = document.getElementById("resultado-final");
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

  // State Variables
  let quizData = [];
  let userAnswers = {};
  let currentQuestionIndex = 0;
  let quizLoaded = false;
  let quizSubmitted = false;
  let timerInterval = null;
  let timeLeft = QUIZ_DURATION_SECONDS;
  let globalCorrectIds = JSON.parse(localStorage.getItem("iscap-global-progress")) || [];

  // ======================================================
  // O "MOTOR" DO TESTE (Substitui o Python)
  // ======================================================
  
  // Função para baralhar arrays de forma verdadeiramente aleatória (Fisher-Yates Shuffle)
  function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
  }

  async function generateQuizDataLocally(disciplina) {
      // 1. Vai buscar o JSON diretamente à pasta local
      const response = await fetch(`data/${disciplina}.json`);
      if (!response.ok) throw new Error("Ficheiro JSON da disciplina não encontrado.");
      const data = await response.json();

      let todasPerguntas = [...data.perguntas];
      let configTemas = { ...data.configuracao_teste };
      let testeFinal = [];

      // 2. Garantir 1 pergunta de Arrastar e Largar
      const perguntasDnd = todasPerguntas.filter(p => p.tipo === "drag_and_drop");
      if (perguntasDnd.length > 0) {
          const perguntaObrigatoria = perguntasDnd[Math.floor(Math.random() * perguntasDnd.length)];
          testeFinal.push(perguntaObrigatoria);
          
          // Desconta na configuração do tema para não passarmos das 24
          if (configTemas[perguntaObrigatoria.macro_tema] > 0) {
              configTemas[perguntaObrigatoria.macro_tema] -= 1;
          }
          // Remove da pool global para não sair repetida
          todasPerguntas = todasPerguntas.filter(p => p.id !== perguntaObrigatoria.id);
      }

      // 3. Selecionar o resto das perguntas com base na configuração
      for (const [macroTema, quantidade] of Object.entries(configTemas)) {
          if (quantidade <= 0) continue;
          
          const perguntasDoTema = todasPerguntas.filter(p => p.macro_tema === macroTema);
          const perguntasBaralhadas = shuffleArray([...perguntasDoTema]);
          
          const selecionadas = perguntasBaralhadas.slice(0, Math.min(quantidade, perguntasDoTema.length));
          testeFinal.push(...selecionadas);
      }

      // 4. Baralhar a ordem final do teste e as alíneas
      testeFinal = shuffleArray(testeFinal);

      testeFinal.forEach(p => {
          if (p.tipo === "multiple_choice" && p.opcoes) {
              p.opcoes = shuffleArray([...p.opcoes]);
          } else if (p.tipo === "drag_and_drop" && p.pares) {
              p.pares = shuffleArray([...p.pares]);
          }
      });

      return {
          disciplina: data.disciplina,
          total_perguntas: testeFinal.length,
          perguntas: testeFinal
      };
  }

  // ======================================================
  // CARREGAR O QUIZ (Evento do Botão)
  // ======================================================
  async function carregarQuiz() {
    const disciplina = disciplinaSelect?.value;
    if (!disciplina) return alert("Seleciona uma disciplina.");

    try {
      quizContainer.innerHTML = "<p>A processar as perguntas...</p>";
      
      // Chamamos a nossa nova função 100% JavaScript (Sem Backend)
      const data = await generateQuizDataLocally(disciplina);

      quizData = data.perguntas;
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

    } catch (error) {
      console.error(error);
      alert("Erro ao carregar o quiz. Verifica se a pasta 'data' tem o ficheiro BIA_BIAT.json e se estás a usar um Live Server.");
    }
  }


  // ======================================================
  // HELPERS DE SISTEMA (Inalterados)
  // ======================================================
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function normalizeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
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

  // ======================================================
  // TIMER
  // ======================================================
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

  // ======================================================
  // UI UPDATES (STATE & GLOBAL PROGRESS)
  // ======================================================
  function setQuizState(text) { if (quizStateText) quizStateText.textContent = text; }
  function updateQuestionStateLabel() {
    if (!quizLoaded) return setQuizState("Aguardando início");
    if (quizSubmitted) return setQuizState("Corrigido");
    const answered = getAnsweredCount();
    if (answered === 0) return setQuizState("Não iniciado");
    if (answered === quizData.length) return setQuizState("Pronto a submeter");
    return setQuizState("Em progresso");
  }

  function updateGlobalProgressUI() {
    if (!globalProgressText || !globalProgressBarFill || !globalProgressPercent) return;
    const correctCount = globalCorrectIds.length;
    const percentage = Math.min(100, Math.round((correctCount / TOTAL_QUESTIONS_DB) * 100));
    globalProgressText.textContent = `${correctCount} / ${TOTAL_QUESTIONS_DB}`;
    globalProgressBarFill.style.width = `${percentage}%`;
    globalProgressPercent.textContent = `${percentage}%`;
    if (percentage === 100) globalProgressBarFill.style.backgroundColor = "var(--success)";
    else globalProgressBarFill.style.backgroundColor = "var(--primary)";
  }

  function clearTopMessage() { resultadoFinal.innerHTML = ""; }

  // ======================================================
  // THEME & SCROLL
  // ======================================================
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
        const currentTheme = document.documentElement.getAttribute("data-theme");
        applyTheme(currentTheme === "dark" ? "light" : "dark");
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

  // ======================================================
  // NAVIGATION LOGIC
  // ======================================================
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
  // RENDER QUESTION
  // ======================================================
  function renderCurrentQuestion() {
    if (!quizData.length) return;

    const question = quizData[currentQuestionIndex];
    const selectedAnswer = userAnswers[currentQuestionIndex];

    let html = `
      <article class="question-card" id="q-card-${currentQuestionIndex}">
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
      const isCorrect = isQuestionCorrect(question, currentQuestionIndex);
      html += `
          <div class="justification-box">
            <p class="feedback-status" style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">
              ${isCorrect ? "✅ Correto!" : "❌ Incorreto."}
            </p>
            ${question.tipo === "multiple_choice" ? `<p><strong>A resposta correta é:</strong> ${escapeHtml(question.resposta_correta)}</p>` : ''}
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
            const isCorrect = isQuestionCorrect(question, currentQuestionIndex);
            card.classList.add(isCorrect ? "correct" : "incorrect");

            card.querySelectorAll(".option-item").forEach(label => {
                const radioVal = normalizeText(label.querySelector('input').value);
                if (radioVal === normalizeText(question.resposta_correta)) label.classList.add("option-correct");
                else if (radioVal === normalizeText(selectedAnswer) && !isCorrect) label.classList.add("option-selected-wrong");
            });
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
                  if (existingItem && existingItem !== draggedElement) bank.appendChild(existingItem);
                  zone.appendChild(draggedElement);
                  zone.classList.add('has-item');
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

    let score = 0;
    quizData.forEach((q, i) => {
      if (isQuestionCorrect(q, i)) {
        score++;
        if (q.id && !globalCorrectIds.includes(q.id)) {
            globalCorrectIds.push(q.id);
        }
      }
    });

    localStorage.setItem("iscap-global-progress", JSON.stringify(globalCorrectIds));
    updateGlobalProgressUI();

    const percentage = ((score / quizData.length) * 100).toFixed(0);
    const notaMoodle = ((score / quizData.length) * 20).toFixed(2);
    
    resultadoFinal.innerHTML = `
      <div class="quiz-final-summary">
        <h2 style="color: var(--primary);">${submissaoAutomatica ? "⏳ Tempo Esgotado" : "📊 Teste Concluído"}</h2>
        <p style="font-size: 1.2rem; margin-bottom: 5px;">Nota Moodle: <strong>${notaMoodle}</strong> / 20,00</p>
        <p>Acertaste <strong>${score}</strong> de <strong>${quizData.length}</strong> perguntas (<strong>${percentage}%</strong>).</p>
        <p style="color: var(--text-muted); font-size: 0.9em; margin-top: 15px;">
          Navega pelas perguntas usando o menu lateral para rever as tuas respostas e ler as justificações do professor.
        </p>
      </div>
    `;

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
  if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", carregarQuiz);
  if (submeterQuizBtn) submeterQuizBtn.addEventListener("click", () => verificarRespostas(false));
  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  
  if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", () => {
      if (confirm("Tens a certeza que queres apagar todo o teu progresso? Terás de acertar nas 115 perguntas novamente.")) {
        localStorage.removeItem("iscap-global-progress");
        globalCorrectIds = [];
        updateGlobalProgressUI();
      }
    });
  }

  // INICIAR
  initTheme();
  initScrollTopButton();
  updateGlobalProgressUI();
});