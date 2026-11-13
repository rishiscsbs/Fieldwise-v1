// A gentle two-note chime for an officer's reply, made with WebAudio (no sound file to download or cache).
// Off by default; the "Sounds" switch in the menu turns it on. Browsers only allow audio after the person has
// interacted with the page, which is always true by the time a reply arrives.
import { useUi } from '../stores/ui';

let ctx: AudioContext | null = null;

function note(ac: AudioContext, freq: number, start: number, length: number, peak: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Soft attack and a long exponential tail, like a small bell.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

export function chime() {
  if (!useUi.getState().sound) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    void ctx.resume();
    const t = ctx.currentTime + 0.01;
    note(ctx, 659.25, t, 0.9, 0.12); // E5
    note(ctx, 987.77, t + 0.14, 1.2, 0.09); // B5
  } catch {
    // Audio is a nicety; never let it break a live update.
  }
}
