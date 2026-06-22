const NOTE_FREQS = (() => {
  const base = [
    261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99,
  ];
  return base;
})();

let audioCtx: AudioContext | null = null;
let resuming = false;

export function useNotePlayer() {
  async function playNote(index: number) {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;

    if (ctx.state === "suspended") {
      if (!resuming) {
        resuming = true;
        await ctx.resume();
        resuming = false;
      }
      return;
    }

    const freq = NOTE_FREQS[index % NOTE_FREQS.length];
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.005, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  return { playNote };
}
