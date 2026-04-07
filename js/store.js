// js/store.js

export const state = {
    fullDatabase: [],
    configDatabase: {},
    quizData: [],
    userAnswers: {},
    currentQuestionIndex: 0,
    quizLoaded: false,
    quizSubmitted: false,
    timerInterval: null,
    currentDisciplina: "",
    currentUser: null,
    quizDurationSeconds: 40 * 60,
    penalizacaoPorErro: 0,
    timeLeft: 40 * 60,
    isTreinoMode: false,
    verifiedQuestions: {},
    globalStorage: JSON.parse(localStorage.getItem("moodle-iscap-storage")) || {},
    unsubscribeSnapshot: null
};

export const PERFIS_ESTUDO = {
    "joao@iscap.pt": { 
        nome: "João F.", 
        curso: "Mestrado BIA", 
        disciplinas: [
            { value: "BIA_BIAT", text: "Business Intelligence & Analytics Tools" }, 
            { value: "BIA_SP", text: "Segurança e Privacidade" }, 
            { value: "BIA_STP", text: "Série Temporal e Previsão" }
        ] 
    },
    "ana@moodle.jf": { 
        nome: "Ana Vasconcelos", 
        curso: "Mestrado GM", 
        disciplinas: [{ value: "GM_MR", text: "Marketing Relacional" }] 
    }
};