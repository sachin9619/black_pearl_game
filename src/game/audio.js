// Procedural audio using Web Audio API - no external files needed
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function resumeAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

export function playCannonFire() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    // Noise burst for cannon boom
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.3);
    
    // Low frequency thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.15);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch (e) {}
}

export function playHit() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    // Wood crack sound
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.Q.setValueAtTime(5, t);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.15);
  } catch (e) {}
}

export function playExplosion() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const bufferSize = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + 0.5);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.6);
    
    // Low boom
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(15, t + 0.4);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch (e) {}
}

export function playWaveCleared() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.12 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.4);
    });
  } catch (e) {}
}

export function playBossWarning() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t + i * 0.4);
      osc.frequency.linearRampToValueAtTime(80, t + i * 0.4 + 0.3);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + i * 0.4);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.4 + 0.05);
      gain.gain.linearRampToValueAtTime(0.3, t + i * 0.4 + 0.15);
      gain.gain.linearRampToValueAtTime(0, t + i * 0.4 + 0.35);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.4);
      osc.stop(t + i * 0.4 + 0.35);
    }
  } catch (e) {}
}

export function playVictory() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    
    const melody = [
      [523.25, 0], [659.25, 0.15], [783.99, 0.3], [1046.5, 0.45],
      [783.99, 0.7], [1046.5, 0.85], [1318.5, 1.0]
    ];
    
    melody.forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + offset);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.3);
    });
  } catch (e) {}
}
