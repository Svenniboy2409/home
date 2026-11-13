// Ambient space sound, generated live with the Web Audio API (no audio files).
// A slow, floating chord through a breathing low-pass filter, a soft "space
// wind" of filtered noise and a gentle echo. Plus two tiny effects: a whoosh
// for the warp and a sparkle for a caught shooting star.

let ctx = null;
let master = null;
let fx = null;
let enabled = false;

const CHORD = [73.42, 110, 146.83, 164.81, 220, 277.18]; // D2 A2 D3 E3 A3 C#4

function noiseBuffer(seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brown noise
    data[i] = last * 3.5;
  }
  return buf;
}

function lfo(freq, depth, target) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.value = depth;
  osc.connect(gain).connect(target);
  osc.start();
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // echo for a sense of space
  const delay = ctx.createDelay(2);
  delay.delayTime.value = 0.48;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const wetFilter = ctx.createBiquadFilter();
  wetFilter.type = 'lowpass';
  wetFilter.frequency.value = 1800;
  delay.connect(wetFilter).connect(feedback).connect(delay);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  wetFilter.connect(wet).connect(master);

  // the pad
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 820;
  padFilter.Q.value = 0.8;
  lfo(0.045, 420, padFilter.frequency);
  const pad = ctx.createGain();
  pad.gain.value = 0.9;
  padFilter.connect(pad);
  pad.connect(master);
  pad.connect(delay);

  CHORD.forEach((f, i) => {
    const voice = ctx.createGain();
    voice.gain.value = 0.035;
    lfo(0.05 + i * 0.023, 0.025, voice.gain); // each note swells on its own
    voice.connect(padFilter);
    [-7, 7].forEach((cents, j) => {
      const osc = ctx.createOscillator();
      osc.type = j === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = cents;
      osc.connect(voice);
      osc.start();
    });
  });

  // space wind
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer();
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 420;
  band.Q.value = 0.7;
  lfo(0.03, 260, band.frequency);
  const wind = ctx.createGain();
  wind.gain.value = 0.05;
  lfo(0.07, 0.03, wind.gain);
  noise.connect(band).connect(wind).connect(master);
  noise.start();

  // effects bus (bypasses the pad filter)
  fx = ctx.createGain();
  fx.gain.value = 0.9;
  fx.connect(ctx.destination);
  fx.connect(delay);
}

export function isEnabled() {
  return enabled;
}

export async function setEnabled(on) {
  enabled = on;
  if (on) {
    if (!ctx) build();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.42, t + 2.5);
  } else if (ctx) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => {
      if (!enabled) ctx.suspend().catch(() => {});
    }, 900);
  }
}

export function whoosh() {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.2);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.4;
  band.frequency.setValueAtTime(180, t);
  band.frequency.exponentialRampToValueAtTime(3200, t + 0.85);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  src.connect(band).connect(g).connect(fx);
  src.start(t);
  src.stop(t + 1.2);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.9);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.08, t + 0.5);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  osc.connect(og).connect(fx);
  osc.start(t);
  osc.stop(t + 1.05);
}

export function sparkle() {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  [1318.5, 1975.5, 2637].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ctx.createGain();
    const s = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.09, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.6);
    osc.connect(g).connect(fx);
    osc.start(s);
    osc.stop(s + 0.65);
  });
}
