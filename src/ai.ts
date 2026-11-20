import { state } from './store';
import { item } from './content';
import { weakIds } from './srs';
import { raGrade } from './store';
import { raInfo } from './content';

export const providerInfo: Record<string, { name: string; model: string; hint: string }> = {
  anthropic: { name: 'Claude (Anthropic)', model: 'claude-haiku-5-5', hint: 'Clave que empieza por sk-ant-…' },
  openai: { name: 'OpenAI', model: 'gpt-4o-mini', hint: 'Clave que empieza por sk-…' },
  gemini: { name: 'Google Gemini', model: 'gemini-2.0-flash', hint: 'Clave de Google AI Studio (AIza…)' },
  custom: { name: 'Otro (compatible con OpenAI)', model: '', hint: 'Necesitas la URL base y el modelo' },
};

const OPENAI_BASE: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

export function systemPrompt(): string {
  const weak = weakIds(12).map((id) => item(id)?.en).filter(Boolean).join(', ') || 'todavía ninguna';
  const grades = ['RA1', 'RA2', 'RA3', 'RA4', 'RA5']
    .map((r) => `${r} ${raInfo[r].name}: ${raGrade(r) ?? 'sin datos'}`).join('; ');
  return [
    'Eres el tutor de inglés de Nour Eddin, alumno de CFGM SMR (Sistemas Microinformáticos y Redes). Su lengua materna es francés/español y su nivel real está entre A1 y B1.',
    'Responde SIEMPRE en español sencillo, con ejemplos en inglés (nivel A2-B1) y su traducción al español. No traduzcas al francés.',
    'Sé breve (máximo 150 palabras salvo que pida más). Si te manda una frase en inglés, corrígela: muestra la versión correcta y explica el error en una línea.',
    'Errores típicos suyos: ortografía de términos técnicos, "I have 20" en vez de "I am 20", la -s de he/she/it, has/have, artículos, orden de la frase, comparativos y superlativos.',
    'Su examen: Listening, Reading (T/F y preguntas abiertas), vocabulario (definiciones y comparativos/superlativos) y Writing de 60-80 palabras en 3.ª persona.',
    `Palabras que más falla: ${weak}.`,
    `Notas estimadas (sobre 10): ${grades}.`,
  ].join('\n');
}

export async function askAi(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const ai = state.ai;
  if (!ai.apiKey.trim()) throw new Error('Falta la clave de la API. Añádela en Tutor → Configuración.');
  const model = ai.model.trim() || providerInfo[ai.provider].model;
  if (!model) throw new Error('Escribe el nombre del modelo.');
  const system = systemPrompt();
  let res: Response;
  try {
    if (ai.provider === 'anthropic') {
      res = await fetch(ai.baseUrl.trim() || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ai.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 900, system, messages }),
      });
    } else {
      const base = (ai.provider === 'custom' ? ai.baseUrl.trim() : OPENAI_BASE[ai.provider]).replace(/\/+$/, '');
      if (!base) throw new Error('Escribe la URL base de la API.');
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ai.apiKey.trim()}` },
        body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: system }, ...messages] }),
      });
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Escribe')) throw e;
    throw new Error('No hay conexión con la IA. Comprueba internet (el resto de la app funciona sin conexión).');
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('La clave no es válida o no tiene permiso.');
    if (res.status === 404) throw new Error('Modelo o URL no encontrados. Revisa el nombre del modelo.');
    if (res.status === 429) throw new Error('Demasiadas peticiones o sin saldo. Inténtalo más tarde.');
    throw new Error(`Error de la IA (${res.status}).`);
  }
  const data = await res.json();
  const text = ai.provider === 'anthropic'
    ? (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
    : data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('La IA no devolvió respuesta.');
  return text;
}
