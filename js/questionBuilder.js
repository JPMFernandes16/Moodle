// js/questionBuilder.js

import { state } from './store.js';
import { playClick, playDing } from './audio.js';
import { normalizeText, showToast } from './utils.js';
import { reportQuestionToCloud } from './firebaseManager.js';
import { getQuestionScore, getAnsweredCountForIndex } from './quizLogic.js';

// Importamos funções do controlador (que vamos criar a seguir no quizController.js)
import { 
    updateTopIndicators, 
    renderQuestionNavigator, 
    updateQuestionStateLabel, 
    guardarEstadoAmeio 
} from './quizController.js';

export function renderCurrentQuestion() {
    const quizContainer = document.getElementById("quiz-container");
    if (!state.quizData.length || !quizContainer) return;
    quizContainer.innerHTML = ""; 
    
    const question = state.quizData[state.currentQuestionIndex];
    const selectedAnswer = state.userAnswers[state.currentQuestionIndex];
    const showResult = state.quizSubmitted || state.verifiedQuestions[state.currentQuestionIndex];
    const score = showResult ? getQuestionScore(question, state.currentQuestionIndex) : null;
    const isCorrect = score === 1; 
    const isPartial = score === 0.5;

    const card = document.createElement('div');
    card.className = `glass-panel question-card ${showResult && score === 0 ? 'shake' : ''}`;
    if (showResult) { 
        card.classList.add(isCorrect ? "correct" : (isPartial ? "" : "incorrect")); 
        if (isPartial) card.style.borderLeft = "4px solid var(--warning)"; 
    }
    card.id = `q-card-${state.currentQuestionIndex}`;

    const qMeta = document.createElement('div'); 
    qMeta.className = "q-meta";
    
    const metaLeft = document.createElement('div'); 
    metaLeft.style.cssText = "display:flex; gap:10px; align-items:center;";
    
    const badge = document.createElement('span'); 
    badge.className = "q-badge"; 
    badge.textContent = `Q.${state.currentQuestionIndex + 1}`; 
    metaLeft.appendChild(badge);
    
    if (question.macro_tema) { 
        const topic = document.createElement('span'); 
        topic.className = "q-topic"; 
        topic.textContent = question.macro_tema.replace(/_/g, ' '); 
        metaLeft.appendChild(topic); 
    }
    
    const btnReport = document.createElement('button'); 
    btnReport.id = "btnReportQ"; 
    btnReport.title = "Reportar erro"; 
    btnReport.style.cssText = "background:none; border:none; font-size:1.2rem; cursor:pointer; opacity:0.6;"; 
    btnReport.textContent = "🚩";
    
    qMeta.append(metaLeft, btnReport); 
    card.appendChild(qMeta);

    // --- CAIXA DE CONTEXTO (Para o Novo Formato JSON) ---
    if (question.contexto) {
        const contextoBox = document.createElement('div');
        contextoBox.style.cssText = "background: var(--bg-body); padding: 15px; border-radius: var(--radius-sm); border-left: 4px solid var(--text-muted); margin-bottom: 15px;";
        
        const labelContexto = document.createElement('strong');
        labelContexto.style.cssText = "display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;";
        labelContexto.textContent = "Contexto";
        
        const textoContexto = document.createElement('p');
        textoContexto.style.cssText = "margin: 0; font-size: 0.95rem; font-style: italic; line-height: 1.5;";
        textoContexto.textContent = question.contexto;
        
        contextoBox.appendChild(labelContexto);
        contextoBox.appendChild(textoContexto);
        card.appendChild(contextoBox);
    }

    const title = document.createElement('h2'); 
    title.className = "q-title"; 
    title.style.cssText = "margin-bottom: 20px;"; 

    if (question.contexto) {
        const labelTarefa = document.createElement('span');
        labelTarefa.style.cssText = "display: block; font-size: 0.85rem; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 800;";
        labelTarefa.textContent = "Pergunta";
        title.appendChild(labelTarefa);
    }
    
    const textoPergunta = document.createElement('span');
    textoPergunta.textContent = question.pergunta;
    title.appendChild(textoPergunta);
    card.appendChild(title);

    // Renderiza o tipo de questão correto
    if (question.tipo === "drag_and_drop") {
        card.appendChild(buildDragAndDrop(question, selectedAnswer, showResult));
    } else if (question.tipo === "open_ended") {
        card.appendChild(buildOpenEnded(question, selectedAnswer, showResult));
    } else {
        card.appendChild(buildMultipleChoice(question, selectedAnswer, showResult));
    }

    quizContainer.appendChild(card);
    setupQuestionListeners(question, showResult);
}

function buildOpenEnded(question, selectedAnswer, disabled) {
    const group = document.createElement('div'); 
    group.className = "open-ended-group";
    
    const textarea = document.createElement('textarea'); 
    textarea.id = `open-ended-${state.currentQuestionIndex}`; 
    textarea.className = "form-input"; 
    textarea.placeholder = "Escrever resposta..."; 
    textarea.rows = 6;
    
    if (disabled) textarea.disabled = true; 
    textarea.value = selectedAnswer || "";
    
    group.appendChild(textarea); 
    
    // --- RESPOSTA DE REFERÊNCIA (Novo Formato JSON) ---
    // Só é apresentada quando a pergunta está bloqueada (disabled), ou seja, após submissão ou verificação
    if (disabled && question.resposta_referencia) {
        const refBox = document.createElement('div');
        refBox.style.cssText = "margin-top: 15px; padding: 15px; background: var(--success-light); border-left: 4px solid var(--success); border-radius: var(--radius-sm);";
        refBox.innerHTML = `<strong style="color: var(--success); font-size: 0.85rem; text-transform: uppercase;">Resposta de Referência:</strong><p style="margin: 8px 0 0 0; font-size: 0.95rem; color: var(--text-main);">${question.resposta_referencia}</p>`;
        group.appendChild(refBox);
    }
    
    return group;
}

function buildMultipleChoice(question, selectedAnswer, disabled) {
    const group = document.createElement('div'); 
    group.className = "options-group";
    
    const isMulti = question.tipo === "multiple_select"; 
    const correctArr = isMulti ? (Array.isArray(question.resposta_correta) ? question.resposta_correta : []) : [question.resposta_correta];
    const userAnsArray = Array.isArray(selectedAnswer) ? selectedAnswer : (selectedAnswer ? [selectedAnswer] : []);

    let optionsList = [];

    if (Array.isArray(question.opcoes)) {
        optionsList = question.opcoes.map((texto, index) => {
            return { id: texto, text: texto, letter: String.fromCharCode(65 + index) };
        });
    } else if (typeof question.opcoes === 'object' && question.opcoes !== null) {
        optionsList = Object.entries(question.opcoes).map(([key, texto]) => {
            return { id: key, text: texto, letter: key };
        });
    }

    optionsList.forEach((opt) => {
        const isChecked = userAnsArray.some(ans => normalizeText(ans) === normalizeText(opt.id) || normalizeText(ans) === normalizeText(opt.text));
        const isCorrectOption = correctArr.some(correctVal => 
            normalizeText(correctVal) === normalizeText(opt.id) || normalizeText(correctVal) === normalizeText(opt.text)
        );
        
        const label = document.createElement('label'); 
        label.className = `option-item ${isChecked ? 'selected' : ''}`;
        
        if (disabled) { 
            if (isCorrectOption) label.classList.add("option-correct"); 
            else if (isChecked && !isCorrectOption) label.classList.add("option-selected-wrong"); 
        }

        const input = document.createElement('input'); 
        input.type = isMulti ? 'checkbox' : 'radio'; 
        input.name = `question-${state.currentQuestionIndex}`; 
        input.value = opt.id; 
        input.checked = isChecked; 
        if (disabled) input.disabled = true;
        
        const customDiv = document.createElement('div'); 
        customDiv.className = isMulti ? 'custom-checkbox' : 'custom-radio';
        
        const letterSpan = document.createElement('span'); 
        letterSpan.style.cssText = "font-weight: 800; color: var(--text-muted); margin-right: 10px; font-family: 'JetBrains Mono', monospace;"; 
        letterSpan.textContent = `${opt.letter}.`;
        
        const textSpan = document.createElement('span'); 
        textSpan.style.cssText = "font-size: 1rem; font-weight: 500;"; 
        textSpan.textContent = opt.text;
        
        label.append(input, customDiv, letterSpan, textSpan); 
        group.appendChild(label);
    });
    return group;
}

function buildDragAndDrop(question, selectedAnswer, disabled) {
    const container = document.createElement('div'); 
    container.className = "dnd-container"; 
    container.style.cssText = "display:flex; flex-direction:column; gap:15px;";
    
    const pares = question.pares || []; 
    const allConceitos = pares.map(p => p.conceito);
    const placedObj = (typeof selectedAnswer === 'object' && selectedAnswer !== null) ? selectedAnswer : {};
    const placedConceitos = Object.values(placedObj); 
    const bankConceitos = allConceitos.filter(c => !placedConceitos.includes(c)).sort();

    const bank = document.createElement('div'); 
    bank.className = "dnd-bank"; 
    bank.id = "dnd-bank"; 
    bank.style.cssText = "display:flex; flex-wrap:wrap; gap:10px; padding:20px; background:var(--bg-body); border:2px dashed var(--border); border-radius:var(--radius-sm); min-height:80px;";
    
    bankConceitos.forEach((c, i) => {
        const item = document.createElement('div'); 
        item.className = "dnd-item"; 
        item.draggable = !disabled; 
        item.setAttribute('data-conceito', c); 
        item.id = `drag-bank-${state.currentQuestionIndex}-${i}`;
        item.style.cssText = "background:var(--secondary); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px 15px; border-radius:8px; cursor:grab; font-weight:600; font-size:0.9rem;"; 
        item.textContent = c; 
        bank.appendChild(item);
    });
    container.appendChild(bank);

    const targetList = document.createElement('div'); 
    targetList.className = "dnd-target-list"; 
    targetList.style.cssText = "display:flex; flex-direction:column; gap:12px;";
    
    pares.forEach((p, i) => {
        const placedItem = placedObj[p.definicao]; 
        let correctStyle = "";
        
        if (disabled) { 
            if (placedItem === p.conceito) correctStyle = "background: var(--success-light); border-color: var(--success);"; 
            else correctStyle = "background: var(--error-light); border-color: var(--error);"; 
        }

        const row = document.createElement('div'); 
        row.className = "dnd-row"; 
        row.style.cssText = "display:flex; align-items:stretch; background:var(--secondary); border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;";
        
        const defDiv = document.createElement('div'); 
        defDiv.className = "dnd-definition"; 
        defDiv.style.cssText = "flex:1; padding:16px; font-size:0.95rem; font-weight:500; border-right:1px solid var(--border);"; 
        defDiv.textContent = p.definicao;
        
        const dropzone = document.createElement('div'); 
        dropzone.className = "dnd-dropzone"; 
        dropzone.setAttribute('data-def', p.definicao); 
        dropzone.style.cssText = `flex:0 0 240px; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; padding:10px; position:relative; flex-direction:column; ${correctStyle}`;
        
        if (placedItem) {
            const item = document.createElement('div'); 
            item.className = "dnd-item"; 
            item.draggable = !disabled; 
            item.setAttribute('data-conceito', placedItem); 
            item.id = `drag-placed-${state.currentQuestionIndex}-${i}`;
            item.style.cssText = "background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--primary); padding:10px; border-radius:8px; width:100%; text-align:center; cursor:grab;"; 
            item.textContent = placedItem; 
            dropzone.appendChild(item);
        }
        if (disabled && placedItem !== p.conceito) {
            const expected = document.createElement('span'); 
            expected.style.cssText = "display:block; font-size:0.75rem; color:var(--success); font-weight:800; margin-top:8px; text-align:center; width:100%;"; 
            expected.textContent = `Esperado: ${p.conceito}`; 
            dropzone.appendChild(expected);
        }
        row.append(defDiv, dropzone); 
        targetList.appendChild(row);
    });
    container.appendChild(targetList); 
    return container;
}

function setupQuestionListeners(question, showResult) {
    const quizContainer = document.getElementById("quiz-container");
    
    const btnReport = document.getElementById('btnReportQ');
    if (btnReport) {
        btnReport.addEventListener('click', async (e) => {
            e.target.style.opacity = '1'; 
            e.target.style.transform = 'scale(1.2)'; 
            playClick();
            try {
                const qId = question.id || `q_${btoa(question.pergunta).substring(0,10)}`;
                await reportQuestionToCloud(qId, state.currentDisciplina, question.pergunta);
                showToast("Reporte enviado ao professor.", "success");
            } catch(err) { 
                showToast("Erro ao reportar.", "error"); 
            }
        });
    }

    const btnVerificar = document.getElementById("btnVerificarTreino");
    if (btnVerificar) {
        btnVerificar.addEventListener("click", () => {
            if (!getAnsweredCountForIndex(state.currentQuestionIndex)) { 
                showToast("Seleciona uma resposta.", "warning"); 
                return; 
            }
            state.verifiedQuestions[state.currentQuestionIndex] = true; 
            playClick(); 
            renderCurrentQuestion(); 
            renderQuestionNavigator(); 
        });
    }

    if (question.tipo === "drag_and_drop" && !showResult) {
        setupDragAndDropEvents();
    } else if (question.tipo === "open_ended" && !showResult) {
        const textarea = quizContainer.querySelector(`#open-ended-${state.currentQuestionIndex}`);
        if (textarea) { 
            setTimeout(() => textarea.focus(), 100); 
            textarea.addEventListener("input", (e) => { 
                state.userAnswers[state.currentQuestionIndex] = e.target.value; 
                updateTopIndicators(); 
                renderQuestionNavigator(); 
                updateQuestionStateLabel(); 
                guardarEstadoAmeio(); 
            }); 
        }
    } else if (!showResult) {
        quizContainer.querySelectorAll(`input[type="radio"], input[type="checkbox"]`).forEach(input => {
            input.addEventListener("change", (e) => {
                playClick(); 
                if (question.tipo === "multiple_select") {
                    const checkedBoxes = Array.from(quizContainer.querySelectorAll(`input[type="checkbox"]:checked`));
                    state.userAnswers[state.currentQuestionIndex] = checkedBoxes.map(cb => cb.value);
                } else { 
                    state.userAnswers[state.currentQuestionIndex] = e.target.value; 
                }
                updateTopIndicators(); 
                renderQuestionNavigator(); 
                updateQuestionStateLabel(); 
                guardarEstadoAmeio();
            });
        });
    }
}

function setupDragAndDropEvents() {
    const quizContainer = document.getElementById("quiz-container");
    if(!quizContainer) return;
    
    const items = quizContainer.querySelectorAll('.dnd-item'); 
    const dropzones = quizContainer.querySelectorAll('.dnd-dropzone'); 
    const bank = quizContainer.querySelector('#dnd-bank');
    
    items.forEach(item => { 
        item.addEventListener('dragstart', (e) => { 
            e.dataTransfer.setData('text/plain', item.id); 
            setTimeout(() => item.style.opacity = '0.4', 0); 
        }); 
        item.addEventListener('dragend', () => { 
            item.style.opacity = '1'; 
        }); 
    });
    
    const handleDragOver = (e) => { 
        e.preventDefault(); 
        e.currentTarget.style.boxShadow = 'inset 0 0 10px var(--primary-glow)'; 
    };
    const handleDragLeave = (e) => { 
        e.currentTarget.style.boxShadow = 'none'; 
    };
    
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
                if (existingItem && existingItem !== draggedElement && bank) {
                    bank.appendChild(existingItem); 
                }
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
    const quizContainer = document.getElementById("quiz-container");
    if(!quizContainer) return; 
    
    const dropzones = quizContainer.querySelectorAll('.dnd-dropzone'); 
    let currentAnswers = {};
    
    dropzones.forEach(zone => { 
        const def = zone.getAttribute('data-def'); 
        const item = zone.querySelector('.dnd-item'); 
        if (item) currentAnswers[def] = item.getAttribute('data-conceito'); 
    });
    
    state.userAnswers[state.currentQuestionIndex] = currentAnswers; 
    
    updateTopIndicators(); 
    renderQuestionNavigator(); 
    updateQuestionStateLabel(); 
    guardarEstadoAmeio();
}