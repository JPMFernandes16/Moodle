// =========================================================
// GESTÃO DO AUDIO CONTEXT (SINGLETON)
// =========================================================
let audioCtx = null;

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

// =========================================================
// EFEITOS SONOROS MODERNOS (SINTETIZADOR NATIVO OTIMIZADO)
// =========================================================

export function playClick() {
    // Som: "Pop" orgânico, muito curto e subtil. Estilo UI moderno.
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        // Queda muito rápida de frequência simula um "clique" físico
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.04);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.01); // Soft attack para evitar clipping
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.05);
    } catch(e) {}
}

export function playDing() {
    // Som: Uma notificação de "vidro" ou "bolha" (perfeito para drag & drop)
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        
        // Camada 1: Corpo do som
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(784, t); // Nota G5
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        
        // Camada 2: Brilho (Harmónico)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1568, t); // Nota G6
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.03, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc1.connect(gain1); gain1.connect(ctx.destination);
        osc2.connect(gain2); gain2.connect(ctx.destination);
        
        osc1.start(t); osc1.stop(t + 0.35);
        osc2.start(t); osc2.stop(t + 0.25);
    } catch(e) { console.warn("Audio bloqueado pelo browser", e); }
}

export function playWarningSound() {
    // Som: Mudo, estilo "thud" suave de erro/aviso. Evita ser agressivo.
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;

        const playThud = (time, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'triangle'; // Mais redondo que o square original
            osc.frequency.setValueAtTime(freq, time);
            
            // Lowpass filter para tirar a estridência (abafar o som)
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            
            osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + 0.2);
        };

        playThud(t, 220);         // Primeiro tom
        playThud(t + 0.12, 180);  // Segundo tom mais baixo
    } catch(e) {}
}

export function playSadSound() {
    // Som: Uma descida suave e melancólica ("bloop" dececionado), muito mais simpático que o sawtooth original.
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.6); // Desliza para baixo
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.65);
    } catch(e) {}
}

export function playHappySound() {
    // Som: Um acorde rápido e etéreo (sino digital). Reflete uma vitória suave.
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
        // Acorde Maior espalhado rápido (C5, E5, G5)
        playChime(523.25, t);       
        playChime(659.25, t + 0.08); 
        playChime(783.99, t + 0.16); 
    } catch(e) {}
}

export function playPartySound() {
    // Som: Vitória máxima. Fanfarra sintetizada misturada com acordes ricos.
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
        
        const playSynth = (freq, time, dur) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator(); // Segunda camada para engordar o som
            const gain = ctx.createGain();
            
            osc1.type = 'triangle';
            osc2.type = 'sine';
            
            osc1.frequency.setValueAtTime(freq, time);
            osc2.frequency.setValueAtTime(freq * 1.5, time); // Harmónico
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.06, time + 0.02);
            gain.gain.setValueAtTime(0.06, time + dur - 0.05);
            gain.gain.linearRampToValueAtTime(0.001, time + dur);
            
            osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
            osc1.start(time); osc1.stop(time + dur + 0.1);
            osc2.start(time); osc2.stop(time + dur + 0.1);
        };
        
        let t = ctx.currentTime;
        // Melodia de subida rápida culminando num acorde sustentado
        playSynth(440.00, t, 0.12); t += 0.12; // A4
        playSynth(554.37, t, 0.12); t += 0.12; // C#5
        playSynth(659.25, t, 0.12); t += 0.12; // E5
        playSynth(880.00, t, 0.50);            // A5 (Vitória)
    } catch(e) {}
}

// =========================================================
// EFEITOS VISUAIS
// =========================================================

export function fireConfetti() {
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