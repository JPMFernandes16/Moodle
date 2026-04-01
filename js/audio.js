export const getAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    return new AudioContext();
};

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
  } catch(e) {}
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
        let t = ctx.currentTime;
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(523.25, t, 0.15); t += 0.15; 
        playNote(659.25, t, 0.4);             
    } catch(e) {}
}

export function fireConfetti() {
  for (let i = 0; i < 80; i++) {
      const conf = document.createElement('div');
      conf.className = 'confetti';
      conf.style.left = Math.random() * 100 + 'vw';
      conf.style.backgroundColor = ['#e11d48', '#10b981', '#f59e0b', '#0ea5e9'][Math.floor(Math.random() * 4)];
      conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
      conf.style.animationDelay = (Math.random() * 0.5) + 's';
      conf.style.boxShadow = '0 0 10px currentColor'; 
      document.body.appendChild(conf);
      setTimeout(() => conf.remove(), 5000);
  }
}