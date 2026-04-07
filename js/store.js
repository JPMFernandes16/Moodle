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
    userProfile: null, 
    quizDurationSeconds: 40 * 60,
    penalizacaoPorErro: 0,
    timeLeft: 40 * 60,
    isTreinoMode: false,
    verifiedQuestions: {},
    globalStorage: JSON.parse(localStorage.getItem("moodle-iscap-storage")) || {},
    unsubscribeSnapshot: null
};
