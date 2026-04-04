// =========================================================
// GESTÃO DO AUDIO CONTEXT (SINGLETON)
// =========================================================
let audioCtx = null;

export const getAudioContext = () => {
    // 1. Criar apenas uma vez
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioCtx = new AudioContext();
    }
    // 2. Acordar o contexto se o browser o tiver suspendido por inatividade
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

// =========================================================
// EFEITOS SONOROS (SINTETIZADOR NATIVO)
// =========================================================

export function playDing() {
  try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
  } catch(e) { console.warn("Audio bloqueado pelo browser", e); }
}

export function playClick() {
  try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
  } catch(e) {}
}

export function playWarningSound() {
    // Novo som: Dois beeps graves rápidos para avisos (Popups de confirmação)
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const playTone = (time, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.05, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.1);
        };
        playTone(ctx.currentTime, 250);
        playTone(ctx.currentTime + 0.15, 200);
    } catch(e) {}
}

export function playSadSound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 1.0);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 1.0);
    } catch(e) {}
}

export function playHappySound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const playNote = (freq, time) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.3);
        };
        // Arpejo ascendente feliz
        playNote(440, ctx.currentTime);       
        playNote(554.37, ctx.currentTime + 0.1); 
        playNote(659.25, ctx.currentTime + 0.2); 
    } catch(e) {}
}

export function playPartySound() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const playNote = (freq, time, dur) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.08, time);
            gain.gain.setValueAtTime(0.08, time + dur - 0.05);
            gain.gain.linearRampToValueAtTime(0.001, time + dur);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + dur);
        };
        // Toque de fanfarra (Nota 20!)
        let t = ctx.currentTime;
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(659.25, t, 0.4);             
    } catch(e) {}
}

// =========================================================
// EFEITOS VISUAIS
// =========================================================

export function fireConfetti() {
  for (let i = 0; i < 80; i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      
      // Variações para tornar mais realista
      const size = Math.random() * 6 + 4; // Tamanhos entre 4px e 10px
      const isCircle = Math.random() > 0.5; // Alguns são círculos, outros quadrados
      
      conf.style.width = `${size}px`;
      conf.style.height = `${isCircle ? size : size * 2}px`;
      if (isCircle) conf.style.borderRadius = '50%';
      
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.backgroundColor = ['#e11d48', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6'][Math.floor(Math.random() * 5)];
      
      // Animações aleatórias
      conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
      conf.style.animationDelay = (Math.random() * 0.5) + 's';
      conf.style.boxShadow = '0 0 8px currentColor'; 
      
      // Rotação inicial aleatória
      conf.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      document.body.appendChild(conf);
      
      // Limpeza automática para não pesar no DOM
      setTimeout(() => conf.remove(), 5000);
  }
}