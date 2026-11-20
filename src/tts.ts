import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { state } from './store';

let cancelled = false;

/** Lee un texto en inglés (plugin nativo y, si falla, Web Speech API). Devuelve al terminar. */
export async function speak(text: string, pitch = 1): Promise<void> {
  const { voice, rate } = state.settings;
  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.stop();
      await TextToSpeech.speak({ text, lang: voice, rate, pitch, volume: 1, category: 'playback' });
      return;
    } catch { /* cae a Web Speech */ }
  }
  if (!('speechSynthesis' in window)) return;
  await new Promise<void>((resolve) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice; u.rate = rate; u.pitch = pitch;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

/** Lee un guion con varias voces (agudo = mujer, grave = hombre). */
export async function speakScript(lines: { who: string; text: string }[], voices: Record<string, 'm' | 'f'>): Promise<void> {
  cancelled = false;
  for (const l of lines) {
    if (cancelled) break;
    await speak(l.text, voices[l.who] === 'f' ? 1.25 : 0.8);
    if (cancelled) break;
    await new Promise((r) => setTimeout(r, 350));
  }
}
export function stopSpeaking(): void {
  cancelled = true;
  try { if (Capacitor.isNativePlatform()) void TextToSpeech.stop(); } catch { /* nada */ }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
