export type RA = 'RA1' | 'RA2' | 'RA3' | 'RA4' | 'RA5';

export interface Item {
  id: string;
  ra: RA[];
  topic: string;
  en: string;
  es: string;
  pos: string;
  def_en?: string;
  example_en: string;
  example_es: string;
  image?: string;
  difficulty: number;
  source: string;
}
export interface TF { q: string; a: 'T' | 'F' | 'NM'; why: string }
export interface Reading {
  id: string; ra: RA[]; title: string; level: string; module: string; note?: string;
  paragraphs: string[]; tf: TF[];
  open: { q: string; model: string }[];
  synonyms: { def: string; answer: string }[];
  rephrase?: { orig: string; start: string; gap: string; answers: string[]; hint: string }[];
}
export interface Listening {
  id: string; ra: RA[]; title: string; level: string; voices: Record<string, 'm' | 'f'>;
  script: { who: string; text: string }[];
  tf: { q: string; a: 'T' | 'F'; why: string }[];
  ideas_title: string; ideas: { text: string; mentioned: boolean }[];
  mc: { q: string; options: string[]; answer: number }[];
}
export interface Dialogue {
  id: string; ra: RA[]; title: string; situation: string;
  lines: { who: string; en: string; es: string }[];
}
export interface ExSet {
  id: string; kind: 'match' | 'wordbank' | 'gapbank'; ra: RA[]; title: string;
  pairs?: { term: string; def: string }[];
  bank?: string[]; items?: { text: string; answer: string }[];
}
export type GEx =
  | { t: 'choice'; q: string; options: string[]; a: number; why: string }
  | { t: 'gap'; q: string; a: string[]; why: string }
  | { t: 'order'; words: string[]; a: string; why: string };
export interface Lesson {
  id: string; ra: RA[]; title: string; rule: string[]; examples: { en: string; es: string }[]; exercises: GEx[];
}
export interface Must { id: string; label: string; pattern?: string; min?: number; count?: string }
export interface WritingTask {
  id: string; ra: RA[]; kind: 'composition' | 'dialogue' | 'directions' | 'email'; title: string; prompt: string;
  bullets: string[]; min?: number; max?: number; minLines?: number; maxLines?: number; plan?: string;
  must?: Must[]; forbid?: { pattern: string; msg: string }[]; model?: string;
  parts?: { id: string; label: string; must: Must[]; model: string }[];
}

export type Task =
  | { k: 'card'; id: string; mode: 'new' | 'review' }
  | { k: 'def'; id: string; opts: string[] }
  | { k: 'es2en'; id: string; opts: string[] }
  | { k: 'spell'; id: string }
  | { k: 'read'; rid: string }
  | { k: 'tf'; rid: string; i: number }
  | { k: 'syn'; rid: string; i: number }
  | { k: 'open'; rid: string; i: number }
  | { k: 'rephrase'; rid: string; i: number }
  | { k: 'listen'; lid: string }
  | { k: 'ltf'; lid: string; i: number }
  | { k: 'lideas'; lid: string }
  | { k: 'lmc'; lid: string; i: number }
  | { k: 'set'; eid: string }
  | { k: 'lesson'; gid: string }
  | { k: 'gex'; gid: string; i: number }
  | { k: 'time'; h: number; m: number; opts: string[] }
  | { k: 'dialogue'; did: string }
  | { k: 'write'; wid: string };

export type TaskWithStep = Task & { step?: string };

export interface Result { c: number; t: number; fb: string; ask?: string; picked?: number; correct?: number; skipStats?: boolean }

export interface Rendered {
  html: string;
  /** Comprueba lo escrito. Devuelve null si aún no ha terminado (p. ej. fase 1 de una pregunta abierta). */
  check?: (root: HTMLElement) => Result | null;
  /** Respuesta de opción múltiple. */
  pick?: (i: number) => Result;
  /** Tarea informativa (texto, lección…): solo 'Continuar'. */
  info?: boolean;
  mount?: (root: HTMLElement) => void;
  checkLabel?: string;
}

export type ThemePref = 'auto' | 'light' | 'dark' | 'black';
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'custom';

export interface Settings {
  theme: ThemePref;
  accent: 'blue' | 'green';
  voice: 'en-GB' | 'en-US';
  rate: number;
  endDate: string;
  reminderTime: string;
  reminderOn: boolean;
  goalMin: number;
  newPerDay: number;
}
export interface AiSettings {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
}
