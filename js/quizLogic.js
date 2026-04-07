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