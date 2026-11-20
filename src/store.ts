import type { AiSettings, Settings, TaskWithStep } from './types';

const KEY = 'smr-english:v2';

export interface CardState { box: number; due: string; lapses: number; seen: number; last: string }
export interface DayLog { seconds: number; done: number; correct: number; total: number }
export interface Session { date: string; tasks: TaskWithStep[]; idx: number }
export interface ExamRecord { date: string; mode: 'it' | 'b1'; grades: Record<string, number>; avg: number }

export interface State {
  settings: Settings;
  ai: AiSettings;
  cards: Record<string, CardState>;
  history: Record<string, DayLog>;
  stats: Record<string, [number, number][]>; // por RA: últimos resultados [aciertos, total]
  readCount: Record<string, number>;
  session: Session | null;
  exams: ExamRecord[];
  chat: { role: 'user' | 'assistant'; content: string }[];
}

export const defaults: State = {
  settings: {
    theme: 'auto', accent: 'blue', voice: 'en-GB', rate: 0.9,
    endDate: '2027-04-15', reminderTime: '17:00', reminderOn: false, goalMin: 30, newPerDay: 6,
  },
  ai: { provider: 'anthropic', apiKey: '', model: 'claude-haiku-5-5', baseUrl: '' },
  cards: {}, history: {}, stats: {}, readCount: {}, session: null, exams: [], chat: [],
};

function load(): State {
  const base = structuredClone(defaults);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<State>;
    return {
      settings: { ...base.settings, ...(p.settings ?? {}) },
      ai: { ...base.ai, ...(p.ai ?? {}) },
      cards: p.cards ?? {}, history: p.history ?? {}, stats: p.stats ?? {},
      readCount: p.readCount ?? {}, session: p.session ?? null, exams: p.exams ?? [], chat: p.chat ?? [],
    };
  } catch { return base; }
}
export const state: State = load();

export function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* lleno o bloqueado */ }
}

/** Copia de seguridad: NO incluye la clave de la API. */
export function exportJson(): string {
  const { ai, chat, ...rest } = state;
  void chat;
  return JSON.stringify({ app: 'smr-english', version: 2, data: { ...rest, ai: { ...ai, apiKey: '' } } }, null, 2);
}
export function importJson(text: string): boolean {
  try {
    const p = JSON.parse(text);
    if (p?.app !== 'smr-english' || !p.data) return false;
    const d = p.data as Partial<State>;
    const keepKey = state.ai.apiKey;
    state.settings = { ...defaults.settings, ...(d.settings ?? {}) };
    state.ai = { ...defaults.ai, ...(d.ai ?? {}), apiKey: keepKey };
    state.cards = d.cards ?? {}; state.history = d.history ?? {};
    state.stats = d.stats ?? {}; state.readCount = d.readCount ?? {}; state.exams = d.exams ?? [];
    state.session = null;
    save();
    return true;
  } catch { return false; }
}

export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function addDays(key: string, n: number): string {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function today(): DayLog {
  const k = dayKey();
  return (state.history[k] ??= { seconds: 0, done: 0, correct: 0, total: 0 });
}
export function daysLeft(): number {
  const end = new Date(state.settings.endDate + 'T23:59:59');
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
}
/** Racha suave: días seguidos con algo de estudio. Hoy sin estudiar todavía no la rompe. */
export function streak(): number {
  let n = 0;
  let k = dayKey();
  if (!(state.history[k]?.done > 0)) k = addDays(k, -1);
  while (state.history[k]?.done > 0) { n++; k = addDays(k, -1); }
  return n;
}
export function addStat(ra: string, c: number, t: number): void {
  const a = (state.stats[ra] ??= []);
  a.push([c, t]);
  if (a.length > 80) a.shift();
}
/** Nota estimada sobre 10 (últimos resultados) o null si no hay datos. */
export function raGrade(ra: string): number | null {
  const a = state.stats[ra];
  if (!a?.length) return null;
  let c = 0, t = 0;
  for (const [x, y] of a) { c += x; t += y; }
  return t ? Math.round((c / t) * 100) / 10 : null;
}
