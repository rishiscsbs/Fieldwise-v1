import { LANGUAGES } from '@fieldwise/shared';

/** Reads text aloud with the browser's speech engine, in the UI language. Returns false if unavailable. */
export function speak(text: string, lang: string, onEnd?: () => void): boolean {
  const ss = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!ss) return false;
  ss.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGUAGES.find((l) => l.code === lang)?.speech ?? 'en-IN';
  u.rate = 0.95;
  const voice = ss.getVoices().find((v) => v.lang === u.lang);
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  ss.speak(u);
  return true;
}

export const stopSpeaking = () => window.speechSynthesis?.cancel();
