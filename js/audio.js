// js/audio.js

// =========================================================
// GESTÃO DO AUDIO CONTEXT & CONFIGURAÇÕES (SINGLETON)
// =========================================================
let audioCtx = null;
let isMuted = localStorage.getItem("iscap-muted") === "true"; // Guarda a preferência do utilizador

export const getAudioContext = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

// Nova função para alternar o som (Podes ligar a um botão no menu no futuro)
export const toggleMute = () => {
    isMuted = !isMuted;
    localStorage.setItem("iscap-muted", isMuted);
    return isMuted;
};

export const getMuteState = () => isMuted;

// =========================================================
// EFEITOS SONOROS MODERNOS (SINTETIZADOR NATIVO OTIMIZADO)
// =========================================================

export function playClick() {
    if (isMuted) return; // Aborta se estiver silenciado
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.05);
    } catch(e) {}
}

export function playDing() {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(784, t); 
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1568, t); 
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.03, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc1.connect(gain1); gain1.connect(ctx.destination);
        osc2.connect(gain2); gain2.connect(ctx.destination);
        
        osc1.start(t); osc1.stop(t + 0.35);
        osc2.start(t); osc2.stop(t + 0.25);
    } catch(e) {}
}

export function playWarningSound() {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;

        const playThud = (time, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            
            osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.2);
        };

        playThud(t, 220);         
        playThud(t + 0.12, 180);  
    } catch(e) {}
}

export function playSadSound() {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.6); 
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.65);
    } catch(e) {}
}

export function playHappySound() {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const playChime = (freq, time) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.06, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
            
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.45);
        };
        
        const t = ctx.currentTime;
        playChime(523.25, t);       
        playChime(659.25, t + 0.08); 
        playChime(783.99, t + 0.16); 
    } catch(e) {}
}

export function playPartySound() {
    if (isMuted) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const playSynth = (freq, time, dur) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator(); 
            const gain = ctx.createGain();
            
            osc1.type = 'triangle';
            osc2.type = 'sine';
            
            osc1.frequency.setValueAtTime(freq, time);
            osc2.frequency.setValueAtTime(freq * 1.5, time); 
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.06, time + 0.02);
            gain.gain.setValueAtTime(0.06, time + dur - 0.05);
            gain.gain.linearRampToValueAtTime(0.001, time + dur);
            
            osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
            osc1.start(time); osc1.stop(time + dur + 0.1);
            osc2.start(time); osc2.stop(time + dur + 0.1);
        };
        
        let t = ctx.currentTime;
        playSynth(440.00, t, 0.12); t += 0.12; 
        playSynth(554.37, t, 0.12); t += 0.12; 
        playSynth(659.25, t, 0.12); t += 0.12; 
        playSynth(880.00, t, 0.50);            
    } catch(e) {}
}

// =========================================================
// EFEITOS VISUAIS
// =========================================================

export function fireConfetti() {
    // Mantemos aqui por facilidade de importação noutros ficheiros, mas atua no DOM
    for (let i = 0; i < 80; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        
        const size = Math.random() * 6 + 4;
        const isCircle = Math.random() > 0.5;
        
        conf.style.width = `${size}px`;
        conf.style.height = `${isCircle ? size : size * 2}px`;
        if (isCircle) conf.style.borderRadius = '50%';
        
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.backgroundColor = ['#e11d48', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6'][Math.floor(Math.random() * 5)];
        
        conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
        conf.style.animationDelay = (Math.random() * 0.5) + 's';
        conf.style.boxShadow = '0 0 8px currentColor'; 
        
        conf.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        document.body.appendChild(conf);
        setTimeout(() => conf.remove(), 5000);
    }
}