// js/utils.js

// =========================================================
// TRATAMENTO DE TEXTO E SEGURANÇA
// =========================================================

export function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function normalizeText(value) { 
    return value === null || value === undefined ? "" : String(value).trim(); 
}

export function removeAcentos(str) { 
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
}

// =========================================================
// MATEMÁTICA E ARRAYS
// =========================================================

export function shuffleArray(array) {
    let newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// =========================================================
// FORMATAÇÃO DE TEMPO E DATAS
// =========================================================

export function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// NOVO: Transforma datas normais em texto amigável (ex: "Há 5 minutos", "Ontem")
export function timeAgo(dateString) {
    if (!dateString) return "Nunca";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Agora mesmo";
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return hours === 1 ? "Há 1 hora" : `Há ${hours} horas`;
    }
    if (diffInSeconds < 172800) return "Ontem";
    
    return date.toLocaleDateString('pt-PT');
}

// =========================================================
// PERFORMANCE (OTIMIZAÇÃO)
// =========================================================

// NOVO: Evita que funções pesadas (como a pesquisa) corram dezenas de vezes por segundo
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}