// js/quizLogic.js

import { state } from './store.js';
import { shuffleArray, normalizeText, removeAcentos } from './utils.js';

export function generateQuizDataLocally(selectedTopics, mode = "normal") {
    let basePerguntas = state.fullDatabase;
    if (selectedTopics.length > 0) {
        basePerguntas = state.fullDatabase.filter(p => selectedTopics.includes(p.macro_tema));
    }

    let configTemas = { ...state.configDatabase };
    let testeFinal = [];

    if (mode === "mistakes") {
        const wrongIds = state.globalStorage[state.currentDisciplina]?.wrong || [];
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
            // Remove a pergunta obrigatória da base para não ser duplicada
            basePerguntas = basePerguntas.filter(p => p.id !== perguntaObrigatoria.id);
        }
        
        // Verifica se existe uma configuração de teste definida no JSON
        const temConfiguracao = Object.keys(configTemas).length > 0;

        if (temConfiguracao) {
            // Segue estritamente a configuração do JSON
            for (const [macroTema, quantidade] of Object.entries(configTemas)) {
                if (quantidade <= 0) continue;
                
                const idsJaSelecionados = testeFinal.map(p => p.id);
                // Filtra pelo tema e garante que não repete perguntas já selecionadas
                const perguntasDoTema = basePerguntas.filter(p => 
                    p.macro_tema === macroTema && !idsJaSelecionados.includes(p.id)
                );
                
                const selecionadas = shuffleArray([...perguntasDoTema]).slice(0, Math.min(quantidade, perguntasDoTema.length));
                testeFinal.push(...selecionadas);
            }
        } else {
            // Fallback apenas se o JSON não tiver a secção "configuracao_teste" ou se estiver vazia
            const idsJaSelecionados = testeFinal.map(p => p.id);
            const perguntasRestantes = basePerguntas.filter(p => !idsJaSelecionados.includes(p.id));
            
            if(testeFinal.length < 10 && perguntasRestantes.length > 0) {
                // Tenta preencher até um máximo de 10
                const numFaltam = 10 - testeFinal.length;
                testeFinal.push(...shuffleArray(perguntasRestantes).slice(0, numFaltam));
            }
        }

        testeFinal = shuffleArray(testeFinal);
    }

    testeFinal.forEach(p => {
        if ((p.tipo === "multiple_choice" || p.tipo === "multiple_select") && p.opcoes) {
            // Verifica se é um Array (formato antigo) para poder baralhar.
            // Se for um Objeto (formato novo "A", "B", "C", "D"), mantém a ordem intata.
            if (Array.isArray(p.opcoes)) {
                p.opcoes = shuffleArray([...p.opcoes]);
            }
        } else if (p.tipo === "drag_and_drop" && p.pares) {
            p.pares = shuffleArray([...p.pares]);
        }
    });
    return testeFinal;
}

export function getQuestionScore(question, index) {
    const selectedAnswer = state.userAnswers[index];
    if (selectedAnswer === undefined || selectedAnswer === null) return 0;
    
    if (question.tipo === "drag_and_drop") {
        if (typeof selectedAnswer !== 'object' || Array.isArray(selectedAnswer)) return 0;
        for (let p of question.pares) { if (selectedAnswer[p.definicao] !== p.conceito) return 0; }
        return 1;
    } 
    else if (question.tipo === "open_ended") {
        const text = removeAcentos(normalizeText(selectedAnswer).toLowerCase());
        if (text === "") return 0;
        
        let palavrasEncontradas = 0;
        
        for (let word of question.palavras_chave) {
            // --- CÓDIGO TOLERANTE (Suporta Novo e Antigo formato JSON) ---
            if (typeof word === 'string') {
                if (text.includes(removeAcentos(word.toLowerCase()))) {
                    palavrasEncontradas++;
                }
            } else if (Array.isArray(word)) {
                const hasMatch = word.some(w => text.includes(removeAcentos(w.toLowerCase())));
                if (hasMatch) palavrasEncontradas++;
            }
        }
        
        // Ajuste dinâmico da percentagem de acerto
        const totalChaves = question.palavras_chave.length;
        const percentagem = totalChaves > 0 ? (palavrasEncontradas / totalChaves) : 0;
        
        if (percentagem >= 0.35 || palavrasEncontradas >= 4) return 1; // 100% dos pontos
        if (percentagem >= 0.15 || palavrasEncontradas >= 2) return 0.5; // 50% dos pontos
        return 0;                              
    } 
    else if (question.tipo === "multiple_select") {
        const userArr = Array.isArray(selectedAnswer) ? selectedAnswer : [];
        const correctArr = Array.isArray(question.resposta_correta) ? question.resposta_correta : [];
        if (userArr.length === 0 || userArr.length !== correctArr.length) return 0;
        const isAllCorrect = userArr.every(ans => 
            correctArr.some(c => normalizeText(c) === normalizeText(ans) || (question.opcoes && typeof question.opcoes === 'object' && !Array.isArray(question.opcoes) && normalizeText(question.opcoes[ans]) === normalizeText(c)))
        );
        return isAllCorrect ? 1 : 0;
    }
    else { 
        // 1ª Tentativa: Avaliar se a Letra "B" bate certo com a resposta_correta "B"
        const isDirectMatch = normalizeText(selectedAnswer) === normalizeText(question.resposta_correta);
        if (isDirectMatch) return 1;

        // 2ª Tentativa (Fallback): O JSON diz que a resposta certa é o "Texto Longo" mas tu submeteste o ID "B"
        if (typeof question.opcoes === 'object' && !Array.isArray(question.opcoes) && question.opcoes !== null) {
            const textOfSelected = question.opcoes[selectedAnswer];
            if (textOfSelected && normalizeText(textOfSelected) === normalizeText(question.resposta_correta)) {
                return 1;
            }
        }
        return 0; 
    }
}

export function isQuestionCorrect(question, index) { 
    return getQuestionScore(question, index) === 1; 
}

export function getAnsweredCount() {
    return Object.values(state.userAnswers).filter((answer) => {
        if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) return Object.keys(answer).length > 0;
        if (Array.isArray(answer)) return answer.length > 0;
        return normalizeText(answer) !== "";
    }).length;
}

export function getAnsweredCountForIndex(index) {
    const ans = state.userAnswers[index];
    if (ans === undefined || ans === null) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === 'object') return Object.keys(ans).length > 0;
    return normalizeText(ans) !== "";
}