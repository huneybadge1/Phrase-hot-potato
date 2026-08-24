// Web Audio synthesis: no bundled audio files. Must be unlocked by a user
// gesture (Start round tap) before iOS Safari will allow sound.
const GameAudio = (() => {
  let ctx = null;

  function unlock() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    // Play a silent blip so iOS fully commits to the unlocked state.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
    return ctx;
  }

  function tone({ freq = 880, duration = 0.09, type = "sine", volume = 0.35, startAt = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + startAt;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function beep() {
    tone({ freq: 900, duration: 0.1, type: "square", volume: 0.3 });
  }

  // Short, pleasant two-note "ding" cue for a correct guess — distinct
  // from the harsher square-wave beep and sawtooth buzzer.
  function correct() {
    tone({ freq: 880, duration: 0.12, type: "sine", volume: 0.3, startAt: 0 });
    tone({ freq: 1318.5, duration: 0.18, type: "sine", volume: 0.3, startAt: 0.1 });
  }

  function buzzer() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.linearRampToValueAtTime(90, t0 + 0.9);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
    gain.gain.setValueAtTime(0.5, t0 + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 1.05);
  }

  return { unlock, beep, buzzer, correct };
})();
