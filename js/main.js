import { playDing, playClick, playSadSound, playHappySound, playPartySound, fireConfetti } from './audio.js';
import { escapeHtml, normalizeText, removeAcentos, formatTime, shuffleArray } from './utils.js';
import { initAuth } from './auth.js';

document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  // Elementos do DOM
  const disciplinaSelect = document.getElementById("disciplina");
  const carregarQuizBtn = document.getElementById("carregarQuiz");
  const carregarFraquezasBtn = document.getElementById("carregarFraquezas");
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

  const globalProgressText = document.getElementById("globalProgressText");
  const globalProgressBarFill = document.getElementById("globalProgressBarFill");
  const globalProgressPercent = document.getElementById("globalProgressPercent");
  const resetProgressBtn = document.getElementById("resetProgressBtn");
  const themeAnalyticsContainer = document.getElementById("themeAnalyticsContainer");

  const dictSearchInput = document.getElementById("dictSearchInput");
  const dictResultsContainer = document.getElementById("dictResultsContainer");

  // Estado do Sistema
  let fullDatabase = []; 
  let configDatabase = {}; 
  let quizData = [];
  let userAnswers = {};
  let currentQuestionIndex = 0;
  let quizLoaded = false;
  let quizSubmitted = false;
  let timerInterval = null;
  let currentDisciplina = "";
  let radarChartInstance = null; // Variável para o Gráfico Chart.js

  let quizDurationSeconds = 40 * 60;
  let penalizacaoPorErro = 0;
  let timeLeft = quizDurationSeconds;

  let globalStorage = JSON.parse(localStorage.getItem("moodle-iscap-storage")) || {};

  // ======================================================
  // CARREGAR DADOS E GERAR QUIZ
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
          
          const regrasExame = data.opcoes_exame || {};
          quizDurationSeconds = (regrasExame.duracao_minutos || 40) * 60;
          penalizacaoPorErro = regrasExame.desconto_erro || 0;
          
          resetTimer(); 
          
          if (dictSearchInput && disciplinaSelect) {
              const nomeCadeira = disciplinaSelect.options[disciplinaSelect.selectedIndex].text;
              dictSearchInput.placeholder = `Pesquisar em ${nomeCadeira}...`;
          }

          const btnLerResumo = document.getElementById("btnLerResumo");
          if (btnLerResumo) btnLerResumo.href = `pdfs/${currentDisciplina}.pdf`;
          
          const btnVerVideo = document.getElementById("btnVerVideo");
          if (btnVerVideo) btnVerVideo.href = `videos/${currentDisciplina}.mp4`;

          updateGlobalProgressUI();
          if(dictSearchInput) procurarNoDicionario();

      } catch (e) {
          console.error("Erro a carregar o JSON:", e);
      }
  }

  function generateQuizDataLocally(mode = "normal") {
      let todasPerguntas = [...fullDatabase];
      let configTemas = { ...configDatabase };
      let testeFinal = [];

      if (mode === "mistakes") {
          // ALGORITMO: Puxa os erros e baralha-os para garantir que não treinas na mesma ordem
          const wrongIds = globalStorage[currentDisciplina]?.wrong || [];
          testeFinal = todasPerguntas.filter(p => wrongIds.includes(p.id));
          if (testeFinal.length === 0) return []; 
          let totalNormal = Object.values(configTemas).reduce((a, b) => a + b, 0) || 24;
          if (testeFinal.length > totalNormal) testeFinal = shuffleArray(testeFinal).slice(0, totalNormal);
          else testeFinal = shuffleArray(testeFinal);
      } 
      else {
          const perguntasDnd = todasPerguntas.filter(p => p.tipo === "drag_and_drop");
          if (perguntasDnd.length > 0) {
              const perguntaObrigatoria = perguntasDnd[Math.floor(Math.random() * perguntasDnd.length)];
              testeFinal.push(perguntaObrigatoria);
              if (configTemas[perguntaObrigatoria.macro_tema] > 0) configTemas[perguntaObrigatoria.macro_tema] -= 1;
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
          const resultBox = document.getElementById("resultado-final-box");
          if (resultBox) resultBox.style.display = "none";
          if(quizContainer) quizContainer.innerHTML = "<div class='glass-panel' style='text-align:center; padding: 40px;'><h3 class='mono-data' style='color:var(--primary);'>A processar dados do simulador...</h3></div>";
          if (!fullDatabase || fullDatabase.length === 0) await carregarDisciplinaBase();

          quizData = generateQuizDataLocally(mode);
          if (quizData.length === 0 && mode === "mistakes") {
              if(quizContainer) quizContainer.innerHTML = `<div class="glass-panel" style="text-align:center;"><div style="font-size:3rem; margin-bottom:15px;">🚀</div><h2 style="color:var(--success);">Domínio Absoluto!</h2><p>Não há registo de falhas nesta UC. Inicia uma simulação normal.</p></div>`;
              return;
          }
          if (quizData.length === 0) throw new Error("0 perguntas geradas.");

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
          
          playClick(); 

          if (submeterQuizBtn) {
            submeterQuizBtn.classList.remove("hidden");
            submeterQuizBtn.disabled = false;
          }
          if (quizContainer) quizContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) { console.error(err); }
  }

  // ======================================================
  // PROGRESSO & ANALYTICS COM CHART.JS (Fase 4)
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

        // Limpa o contentor para injetar o Canvas do Chart.js
        themeAnalyticsContainer.innerHTML = '<canvas id="radarChart"></canvas>';
        const ctx = document.getElementById('radarChart').getContext('2d');

        if (radarChartInstance) radarChartInstance.destroy(); // Destrói o gráfico anterior ao mudar de disciplina

        radarChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Domínio do Tema (%)',
                    data: dataValues,
                    backgroundColor: 'rgba(225, 29, 72, 0.3)', // Cyber Red transparente
                    borderColor: '#e11d48',
                    pointBackgroundColor: '#10b981', // Verde no ponto
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#10b981',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(148, 163, 184, 0.2)' },
                        grid: { color: 'rgba(148, 163, 184, 0.2)' },
                        pointLabels: {
                            color: '#94a3b8',
                            font: { family: "'Outfit', sans-serif", size: 10, weight: '600' }
                        },
                        ticks: { display: false, min: 0, max: 100 } // Esconde os números do eixo
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: "'Outfit', sans-serif" },
                        bodyFont: { family: "'JetBrains Mono', monospace" }
                    }
                }
            }
        });
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
              subjData.wrong = subjData.wrong.filter(id => id !== q.id); // Se acertou agora, sai das fraquezas
          } else {
              todosCertos = false;
              if (!subjData.wrong.includes(q.id) && !subjData.correct.includes(q.id)) subjData.wrong.push(q.id);
          }
      });
      localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
      updateGlobalProgressUI();
      return todosCertos;
  }

  // ======================================================
  // GLOSSÁRIO
  // ======================================================
  function procurarNoDicionario() {
      if(!dictSearchInput || !dictResultsContainer || !fullDatabase || !fullDatabase.length) return;
      const termo = dictSearchInput.value.toLowerCase().trim();
      if(termo === "") { dictResultsContainer.innerHTML = ""; return; }

      const resultados = fullDatabase.filter(p => {
          const textoCompleto = ((p.pergunta || "") + " " + (p.justificacao || "") + " " + (p.opcoes ? p.opcoes.join(" ") : "") + " " + (p.pares ? p.pares.map(x=>x.conceito).join(" ") : "")).toLowerCase();
          return textoCompleto.includes(termo);
      });

      if(resultados.length === 0) {
          dictResultsContainer.innerHTML = "<p style='font-size:0.9rem; color:var(--error); font-weight:600;'>Nenhum registo encontrado na base de dados.</p>";
          return;
      }

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

  // ======================================================
  // HELPERS, CRONÓMETRO E NAVEGAÇÃO
  // ======================================================
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
    if (!quizLoaded) return quizStateText.textContent = "Offline";
    if (quizSubmitted) return quizStateText.textContent = "Processado";
    const answered = getAnsweredCount();
    if (answered === 0) return quizStateText.textContent = "Online";
    if (answered === quizData.length) return quizStateText.textContent = "Pronto a Submeter";
    return quizStateText.textContent = "Em Execução";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("iscap-theme", theme);
  }
  function initTheme() {
    const savedTheme = localStorage.getItem("iscap-theme") || "dark"; 
    applyTheme(savedTheme);
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
        // Força a atualização do gráfico para as cores certas se o tema mudar
        if(radarChartInstance) updateGlobalProgressUI();
      });
    }
  }

  function initScrollTopButton() {
    if (!scrollTopBtn) return;
    window.addEventListener("scroll", () => {
      if (window.scrollY > 250) scrollTopBtn.style.display = "flex";
      else scrollTopBtn.style.display = "none";
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
      let className = "nav-node";
      if (isActive) className += " is-active";
      if (isAnswered && !quizSubmitted) className += " is-answered";
      if (quizSubmitted) {
         const score = getQuestionScore(q, index);
         if (score === 1) className += " is-correct";
         else if (score === 0.5) className += " is-partial";
         else className += " is-incorrect";
      }
      return `<button type="button" class="${className}" data-question-index="${index}">${index + 1}</button>`;
    }).join("");
    questionNavigator.querySelectorAll(".nav-node").forEach((btn) => {
      btn.addEventListener("click", () => goToQuestion(Number(btn.dataset.questionIndex)));
    });
  }

  function getAnsweredCountForIndex(index) {
      const ans = userAnswers[index];
      if (!ans) return false;
      if (typeof ans === 'object') return Object.keys(ans).length > 0;
      return normalizeText(ans) !== "";
  }

  function getQuestionScore(question, index) {
      const selectedAnswer = userAnswers[index];
      if (selectedAnswer === undefined || selectedAnswer === null) return 0;
      if (question.tipo === "drag_and_drop") {
          if (typeof selectedAnswer !== 'object') return 0;
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
          if (gruposAtingidos >= 4) return 1;    
          if (gruposAtingidos >= 2) return 0.5;  
          return 0;                              
      } 
      else {
          return normalizeText(selectedAnswer) === normalizeText(question.resposta_correta) ? 1 : 0;
      }
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
      const score = quizSubmitted ? getQuestionScore(question, currentQuestionIndex) : null;
      const isCorrect = score === 1;
      const isPartial = score === 0.5;

      let html = `
        <div class="glass-panel question-card ${quizSubmitted && score === 0 ? 'shake' : ''}" id="q-card-${currentQuestionIndex}">
          <div class="q-meta">
            <span class="q-badge">Q.${currentQuestionIndex + 1}</span>
            ${question.macro_tema ? `<span class="q-topic">${escapeHtml(question.macro_tema.replace(/_/g, ' '))}</span>` : ""}
          </div>
          <h2 class="q-title">${escapeHtml(question.pergunta)}</h2>
      `;

      if (question.tipo === "drag_and_drop") html += renderDragAndDrop(question, selectedAnswer);
      else if (question.tipo === "open_ended") html += renderOpenEnded(question, selectedAnswer);
      else html += renderMultipleChoice(question, selectedAnswer || "");

      if (quizSubmitted) {
          let statusColor = isCorrect ? 'var(--success)' : (isPartial ? 'var(--warning)' : 'var(--error)');
          let statusText = isCorrect ? '✅ Resposta Validada' : (isPartial ? '⚠️ Resposta Incompleta' : '❌ Anomalia Detetada');
          html += `
            <div style="margin-top: 25px; padding: 20px; background: var(--bg-body); border-radius: var(--radius-sm); border: 1px solid ${statusColor}; border-left: 4px solid ${statusColor};">
              <p style="color: ${statusColor}; font-weight: 800; font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">${statusText}</p>
              ${question.tipo === "open_ended" ? `<p><strong>Referência:</strong> ${escapeHtml(question.resposta_referencia)}</p>` : ''}
              ${question.tipo === "multiple_choice" ? `<p><strong>Certa:</strong> ${escapeHtml(question.resposta_correta)}</p>` : ''}
              <div style="margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;">
                  <p style="margin:0; font-size: 0.95rem;"><strong>Justificação Técnica:</strong> ${escapeHtml(question.justificacao)}</p>
              </div>
            </div>
          `;
      }
      html += `</div>`;
      quizContainer.innerHTML = html;

      if (question.tipo === "drag_and_drop") {
          if (!quizSubmitted) setupDragAndDropEvents();
      } 
      else if (question.tipo === "open_ended") {
          if (!quizSubmitted) {
              const textarea = quizContainer.querySelector(`#open-ended-${currentQuestionIndex}`);
              if (textarea) {
                  textarea.addEventListener("input", (e) => {
                      userAnswers[currentQuestionIndex] = e.target.value;
                      updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel();
                  });
              }
          } else {
              const card = document.getElementById(`q-card-${currentQuestionIndex}`);
              if(card) {
                  if (isCorrect) card.classList.add("correct");
                  else if (isPartial) card.style.borderLeft = "4px solid var(--warning)";
                  else card.classList.add("incorrect");
              }
          }
      } 
      else {
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
                      playClick(); 
                      userAnswers[currentQuestionIndex] = e.target.value;
                      updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel();
                  });
              });
          }
      }
  }

  function renderOpenEnded(question, selectedAnswer) {
      return `<div class="open-ended-group"><textarea id="open-ended-${currentQuestionIndex}" class="form-input" placeholder="Escrever input manual de resposta..." rows="6" ${quizSubmitted ? "disabled" : ""}>${escapeHtml(selectedAnswer || "")}</textarea></div>`;
  }

  function renderMultipleChoice(question, selectedAnswer) {
      const options = Array.isArray(question.opcoes) ? question.opcoes : [];
      return `
        <div class="options-group">
          ${options.map((option, idx) => {
            const isChecked = normalizeText(selectedAnswer) === normalizeText(option);
            return `
              <label class="option-item ${isChecked ? 'selected' : ''}">
                <input type="radio" name="question-${currentQuestionIndex}" value="${escapeHtml(option)}" ${isChecked ? "checked" : ""} ${quizSubmitted ? "disabled" : ""}/>
                <div class="custom-radio"></div>
                <span style="font-weight: 800; color: var(--text-muted); margin-right: 10px; font-family: 'JetBrains Mono', monospace;">${String.fromCharCode(65 + idx)}.</span>
                <span style="font-size: 1rem; font-weight: 500;">${escapeHtml(option)}</span>
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

      let dndHtml = `<div class="dnd-container" style="display:flex; flex-direction:column; gap:15px;"><div class="dnd-bank" id="dnd-bank" style="display:flex; flex-wrap:wrap; gap:10px; padding:20px; background:var(--bg-body); border:2px dashed var(--border); border-radius:var(--radius-sm); min-height:80px;">`;
      bankConceitos.forEach((c, i) => { dndHtml += `<div class="dnd-item" draggable="${!quizSubmitted}" data-conceito="${escapeHtml(c)}" id="drag-bank-${currentQuestionIndex}-${i}" style="background:var(--secondary); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px 15px; border-radius:8px; cursor:grab; font-weight:600; font-size:0.9rem;">${escapeHtml(c)}</div>`; });
      dndHtml += `</div><div class="dnd-target-list" style="display:flex; flex-direction:column; gap:12px;">`;
      
      pares.forEach((p, i) => {
          const placedItem = placedObj[p.definicao];
          let dropzoneClass = "dnd-dropzone";
          let correctStyle = "";
          if (quizSubmitted) {
              if (placedItem === p.conceito) correctStyle = "background: var(--success-light); border-color: var(--success);";
              else correctStyle = "background: var(--error-light); border-color: var(--error);";
          }
          dndHtml += `<div class="dnd-row" style="display:flex; align-items:stretch; background:var(--secondary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;">
                        <div class="dnd-definition" style="flex:1; padding:16px; font-size:0.95rem; font-weight:500; border-right:1px solid var(--border);">${escapeHtml(p.definicao)}</div>
                        <div class="${dropzoneClass}" data-def="${escapeHtml(p.definicao)}" style="flex:0 0 240px; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; padding:10px; position:relative; ${correctStyle}">`;
          
          if (placedItem) dndHtml += `<div class="dnd-item" draggable="${!quizSubmitted}" data-conceito="${escapeHtml(placedItem)}" id="drag-placed-${currentQuestionIndex}-${i}" style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px; border-radius:8px; width:100%; text-align:center; cursor:grab;">${escapeHtml(placedItem)}</div>`;
          if (quizSubmitted && placedItem !== p.conceito) dndHtml += `<span style="display:block; font-size:0.75rem; color:var(--success); font-weight:800; margin-top:8px; text-align:center; width:100%;">Esperado: ${escapeHtml(p.conceito)}</span>`;
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
              setTimeout(() => item.style.opacity = '0.4', 0);
          });
          item.addEventListener('dragend', () => { item.style.opacity = '1'; });
      });

      const handleDragOver = (e) => { e.preventDefault(); e.currentTarget.style.boxShadow = 'inset 0 0 10px var(--primary-glow)'; };
      const handleDragLeave = (e) => { e.currentTarget.style.boxShadow = 'none'; };

      dropzones.forEach(zone => {
          zone.addEventListener('dragover', handleDragOver);
          zone.addEventListener('dragleave', handleDragLeave);
          zone.addEventListener('drop', (e) => {
              e.preventDefault();
              zone.style.boxShadow = 'none';
              const draggedId = e.dataTransfer.getData('text/plain');
              const draggedElement = document.getElementById(draggedId);
              if (draggedElement) {
                  const existingItem = zone.querySelector('.dnd-item');
                  if (existingItem && existingItem !== draggedElement && bank) bank.appendChild(existingItem);
                  zone.appendChild(draggedElement);
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
              bank.style.boxShadow = 'none';
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
      updateTopIndicators(); renderQuestionNavigator(); updateQuestionStateLabel();
  }

  function verificarRespostas(submissaoAutomatica = false) {
      if (!quizLoaded || quizSubmitted) return;
      quizSubmitted = true;
      stopTimer();
      guardarResultadosNaMemoria();

      let pontuacaoPonderada = 0;
      let errosComPenalizacao = 0;
      let respondidas = 0;

      quizData.forEach((q, i) => { 
          const ans = userAnswers[i];
          const hasAnswer = ans !== undefined && ans !== null && ans !== "" && (typeof ans !== 'object' || Object.keys(ans).length > 0);

          if (hasAnswer) {
              respondidas++;
              const score = getQuestionScore(q, i);
              pontuacaoPonderada += score;
              if (score === 0) errosComPenalizacao++; 
          }
      });

      const valorPorPergunta = 20 / quizData.length;
      let notaCalculada = (pontuacaoPonderada * valorPorPergunta) - (errosComPenalizacao * valorPorPergunta * penalizacaoPorErro);
      if (notaCalculada < 0) notaCalculada = 0; 
      const notaMoodle = notaCalculada.toFixed(2);
      
      if (notaCalculada >= 19.99) { playPartySound(); fireConfetti(); } 
      else if (notaCalculada >= 9.5) playHappySound();
      else playSadSound();

      let msgPenalizacao = penalizacaoPorErro > 0 
          ? `<p style="font-size: 0.85rem; color: var(--warning); margin-top: 15px; background: rgba(217, 119, 6, 0.1); padding: 10px; border-radius: 8px;">Aviso: Desconto ativado de -${(penalizacaoPorErro * 100).toFixed(0)}% por erro total. (${errosComPenalizacao} falhas críticas registadas).</p>` 
          : ``;

      let htmlResultado = `
        <div class="hologram-result">
          <h2 style="text-transform: uppercase; font-size: 1.1rem; color: var(--text-muted); letter-spacing: 2px;">${submissaoAutomatica ? "Análise Abortada (Timeout)" : "Análise Concluída"}</h2>
          <div class="score-display mono-data">${notaMoodle} <span style="font-size: 2rem; color: var(--text-muted);">/ 20</span></div>
          <p style="font-size: 1.1rem; color: var(--text-main);">Precisão do modelo: <strong style="color:var(--primary);">${pontuacaoPonderada}</strong> acertos em ${quizData.length} blocos de dados. Omissões: <strong style="color:var(--primary);">${quizData.length - respondidas}</strong>.</p>
          ${msgPenalizacao}
        </div>
      `;

      const resultBox = document.getElementById("resultado-final-box");
      if (resultBox) {
          resultBox.innerHTML = htmlResultado;
          resultBox.style.display = "block";
      }

      if (submeterQuizBtn) submeterQuizBtn.classList.add("hidden");

      currentQuestionIndex = 0;
      renderQuestionNavigator(); renderCurrentQuestion(); updateQuestionStateLabel(); scrollToTopSmooth();
  }

  // ======================================================
  // EVENT LISTENERS GLOBAIS
  // ======================================================
  if (disciplinaSelect) disciplinaSelect.addEventListener("change", carregarDisciplinaBase);
  if (carregarQuizBtn) carregarQuizBtn.addEventListener("click", () => iniciarTeste("normal"));
  if (carregarFraquezasBtn) carregarFraquezasBtn.addEventListener("click", () => iniciarTeste("mistakes"));
  if (submeterQuizBtn) submeterQuizBtn.addEventListener("click", () => {
      if(confirm("Iniciar processamento final de respostas?")) verificarRespostas(false);
  });
  if (prevQuestionBtn) prevQuestionBtn.addEventListener("click", goToPreviousQuestion);
  if (nextQuestionBtn) nextQuestionBtn.addEventListener("click", goToNextQuestion);
  if (dictSearchInput) dictSearchInput.addEventListener("input", procurarNoDicionario);

  if (resetProgressBtn) {
    resetProgressBtn.addEventListener("click", () => {
      if (confirm(`Atenção: Queres apagar a cache neural de erros em ${currentDisciplina}?`)) {
        globalStorage[currentDisciplina] = { correct: [], wrong: [] };
        localStorage.setItem("moodle-iscap-storage", JSON.stringify(globalStorage));
        updateGlobalProgressUI();
      }
    });
  }

  initTheme();
  initScrollTopButton();
  carregarDisciplinaBase();
});