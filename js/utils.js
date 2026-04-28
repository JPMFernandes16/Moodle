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

// =========================================================
// UI & NOTIFICAÇÕES (TOAST)
// =========================================================

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    
    const iconSpan = document.createElement('span'); iconSpan.textContent = icon;
    const msgSpan = document.createElement('span'); msgSpan.textContent = message;
    
    toast.appendChild(iconSpan); toast.appendChild(msgSpan);
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}