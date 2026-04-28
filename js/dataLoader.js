// js/dataLoader.js

import { state } from './store.js';
import { db } from './firebase-config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { fetchLeaderboardData } from './firebaseManager.js';
import { timeAgo, showToast } from './utils.js';
import { renderTopicsFilter, updateGlobalProgressUI, resetTimer } from './quizController.js';

export async function carregarDisciplinaBase() {
    const disciplinaSelect = document.getElementById("disciplina");
    const dictSearchInput = document.getElementById("dictSearchInput");
    const btnLerResumo = document.getElementById("btnLerResumo");
    const btnVerVideo = document.getElementById("btnVerVideo");

    state.currentDisciplina = disciplinaSelect?.value || "BIA_BIAT";
    
    try {
        let response = await fetch(`data/${state.currentDisciplina}.json`);
        if (!response.ok) response = await fetch(`${state.currentDisciplina}.json`);
        if (!response.ok) throw new Error(`Ficheiro não encontrado.`);

        const data = await response.json();
        
        let perguntasCarregadas = [];

        // =========================================================
        // ADAPTER: NORMALIZADOR UNIVERSAL DE JSON
        // Compatibiliza formatos antigos, novos, grupos e flat arrays
        // =========================================================
        const normalizarPergunta = (p) => {
            let q = { ...p }; // Clonamos para não mutar a base
            
            // 1. Mapeamento de Chaves Base
            if (!q.pergunta && q.texto_pergunta) q.pergunta = q.texto_pergunta;
            if (!q.macro_tema && q.tema) q.macro_tema = q.tema; 

            // --- NOVO: INFERÊNCIA INTELIGENTE DE TIPO ---
            // Se te esqueceres de colocar o "tipo" no JSON, o sistema adivinha!
            if (!q.tipo) {
                if (q.palavras_chave || q.resposta_referencia) {
                    q.tipo = "open_ended"; // É de desenvolvimento
                } else if (q.pares) {
                    q.tipo = "drag_and_drop"; // É de arrastar
                } else {
                    q.tipo = "multiple_choice"; // Omissão: Múltipla Escolha
                }
            }
            // --------------------------------------------

            // 2. Normalizar Verdadeiro ou Falso (Converte para Múltipla Escolha internamente)
            if (q.tipo === "true_false") {
                q.tipo = "multiple_choice";
                q.opcoes = ["Verdadeiro", "Falso"];
                q.resposta_correta = q.resposta_correta === true ? "Verdadeiro" : "Falso";
            }

            // 3. Normalizar Drag & Drop ("item/correspondencia" -> "conceito/definicao")
            if (q.tipo === "drag_and_drop" && q.pares) {
                q.pares = q.pares.map(par => {
                    if (par.item !== undefined && par.correspondencia !== undefined) {
                        return { conceito: par.item, definicao: par.correspondencia };
                    }
                    return par; 
                });
            }

            // 4. Normalizar Múltipla Escolha ("A) Texto", resposta_correta: "A")
            if ((q.tipo === "multiple_choice" || q.tipo === "multiple_select") && Array.isArray(q.opcoes)) {
                const formatoComLetras = q.opcoes.every(opt => /^[a-zA-Z][\)\-\.]\s/.test(opt));
                if (formatoComLetras) {
                    let novasOpcoes = {};
                    q.opcoes.forEach(opt => {
                        const letra = opt.charAt(0).toUpperCase(); 
                        const textoLimpo = opt.replace(/^[a-zA-Z][\)\-\.]\s*/, '').trim(); 
                        novasOpcoes[letra] = textoLimpo;
                    });
                    q.opcoes = novasOpcoes; 
                }
            }
            
            if (!q.id) q.id = `q_${btoa(q.pergunta || "").substring(0,10)}`;

            return q;
        };

        // =========================================================
        // CARREGAMENTO HIERÁRQUICO
        // =========================================================
        if (data.grupos) {
            // Formato de Exame (com Grupos e Contexto)
            data.grupos.forEach(grupo => {
                if (grupo.perguntas) {
                    grupo.perguntas.forEach(p => {
                        let normP = normalizarPergunta(p);
                        // Injeta a informação superior do grupo para dentro da pergunta
                        if (!normP.macro_tema) normP.macro_tema = grupo.titulo;
                        normP.contexto = grupo.contexto;
                        if (p.cotacao_pergunta) normP.cotacao = p.cotacao_pergunta;
                        perguntasCarregadas.push(normP);
                    });
                }
            });
        } else if (data.perguntas) {
            // Formato Plano / Prep (Flat Array de perguntas)
            data.perguntas.forEach(p => {
                perguntasCarregadas.push(normalizarPergunta(p));
            });
        }
        
        state.fullDatabase = perguntasCarregadas;
        state.configDatabase = data.configuracao_teste || {};
        
        const regrasExame = data.opcoes_exame || {};
        state.quizDurationSeconds = (regrasExame.duracao_minutos || 40) * 60;
        state.penalizacaoPorErro = regrasExame.desconto_erro || 0;
        
        resetTimer(); 
        renderTopicsFilter(); 
        renderLeaderboard();   
        
        if (dictSearchInput && disciplinaSelect) {
            dictSearchInput.placeholder = `Pesquisar em ${disciplinaSelect.options[disciplinaSelect.selectedIndex].text}...`;
        }

        if (btnLerResumo) { btnLerResumo.removeAttribute("href"); btnLerResumo.removeAttribute("target"); }
        if (btnVerVideo) { btnVerVideo.removeAttribute("href"); btnVerVideo.removeAttribute("target"); }
        
        window.dispatchEvent(new CustomEvent('dadosCarregados'));
        updateGlobalProgressUI();

    } catch (e) { 
        console.error(e);
        showToast(`Erro ao carregar ficheiro da cadeira.`, 'error'); 
    }
}

export function carregarProgressoDaCloud(user) {
    if (!user || !state.currentDisciplina) return;
    if (state.unsubscribeSnapshot) state.unsubscribeSnapshot();
    
    const lastUpdateText = document.getElementById("lastUpdateText");
    const retomarQuizBtn = document.getElementById("retomarQuizBtn");

    state.unsubscribeSnapshot = onSnapshot(doc(db, "users", user.uid, "progress", state.currentDisciplina), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            state.globalStorage[state.currentDisciplina] = data;
            if (lastUpdateText) lastUpdateText.textContent = data.lastUpdate ? `Última revisão: ${timeAgo(data.lastUpdate)}` : "Ainda não há dados.";
            
            if (data.activeQuiz && data.activeQuiz.quizData && data.activeQuiz.quizData.length > 0 && !state.quizLoaded) {
                if (retomarQuizBtn) retomarQuizBtn.classList.remove("hidden");
            } else { 
                if (retomarQuizBtn) retomarQuizBtn.classList.add("hidden"); 
            }
        } else {
            state.globalStorage[state.currentDisciplina] = { correct: [], wrong: [], notes: {}, nextReview: {} };
            if (lastUpdateText) lastUpdateText.textContent = "Ainda não há dados.";
        }
        localStorage.setItem("moodle-iscap-storage", JSON.stringify(state.globalStorage));
        updateGlobalProgressUI();
    }, (error) => { 
        showToast("A sincronizar localmente...", "warning"); 
    });
}

export async function renderLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    if(!container) return;
    container.textContent = 'A carregar ranking do servidor...'; 
    container.style.cssText = "text-align:center; color:var(--text-muted); font-size:0.85rem; padding:10px;";
    
    try {
        const results = await fetchLeaderboardData(state.currentDisciplina);
        container.textContent = ''; 
        container.style.cssText = ""; 
        
        if(results.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'Ainda não há resultados. Sê o primeiro!';
            p.style.cssText = "text-align:center; font-size:0.85rem; color:var(--text-muted);";
            container.appendChild(p); return;
        }
        
        results.forEach((data, idx) => {
            let medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🏅'));
            const row = document.createElement('div'); 
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--secondary); border:1px solid var(--border); border-radius:8px;";
            
            const leftDiv = document.createElement('div'); 
            leftDiv.style.cssText = "display:flex; align-items:center; gap:10px;";
            
            const medalSpan = document.createElement('span'); 
            medalSpan.style.fontSize = "1.2rem"; medalSpan.textContent = medal;
            const nameSpan = document.createElement('span'); 
            nameSpan.style.cssText = "font-weight:700; font-size:0.9rem;"; nameSpan.textContent = data.nome;
            
            leftDiv.appendChild(medalSpan); 
            leftDiv.appendChild(nameSpan);
            
            const scoreSpan = document.createElement('span'); 
            scoreSpan.className = "mono-data"; 
            scoreSpan.style.cssText = "color:var(--primary); font-weight:800;"; 
            scoreSpan.textContent = data.score.toFixed(2);
            
            row.appendChild(leftDiv); 
            row.appendChild(scoreSpan); 
            container.appendChild(row);
        });
    } catch(e) { 
        container.textContent = 'Erro ao carregar ranking.'; 
        container.style.color = 'var(--error)'; 
    }
}