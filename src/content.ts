import type { Dialogue, ExSet, Item, Lesson, Listening, Reading, WritingTask } from './types';

// Todo el contenido vive en /content/*.json. Añadir un archivo nuevo basta: la app lo detecta sola.
const files = import.meta.glob('../content/*.json', { eager: true, import: 'default' }) as Record<string, any[]>;
const all = Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).flatMap(([, v]) => v);
const pre = (p: string) => all.filter((x) => typeof x.id === 'string' && x.id.startsWith(p + '-'));

export const items: Item[] = all.filter((x) => typeof x.en === 'string') as Item[];
export const readings = pre('rd') as Reading[];
export const listenings = pre('ls') as Listening[];
export const dialogues = pre('dl') as Dialogue[];
export const exSets = pre('ex') as ExSet[];
export const lessons = pre('gr') as Lesson[];
export const writings = pre('wr') as WritingTask[];

export const byId = new Map<string, Item>(items.map((i) => [i.id, i]));
export const item = (id: string): Item => byId.get(id)!;
export const reading = (id: string) => readings.find((r) => r.id === id)!;
export const listening = (id: string) => listenings.find((r) => r.id === id)!;
export const dialogue = (id: string) => dialogues.find((r) => r.id === id)!;
export const exSet = (id: string) => exSets.find((r) => r.id === id)!;
export const lesson = (id: string) => lessons.find((r) => r.id === id)!;
export const writing = (id: string) => writings.find((r) => r.id === id)!;

export const topicNames: Record<string, string> = {
  hardware: 'Hardware', network: 'Redes', 'software-web': 'Software, seguridad y web',
  'assembly-verbs': 'Verbos de montaje y soporte', 'modules-jobs': 'Módulos y puestos',
  'places-directions': 'La oficina y direcciones', 'daily-intro': 'Presentarse y datos personales',
  'daily-time': 'La hora', 'daily-directions': 'Pedir y dar direcciones',
  'daily-support': 'Atender a un cliente / soporte', 'email-job': 'Email y búsqueda de empleo',
};
/** Temas "técnicos" vs "día a día": el plan mezcla ambos cada jornada. */
export const techTopics = ['hardware', 'assembly-verbs', 'modules-jobs', 'network', 'software-web'];
export const dailyTopics = ['daily-intro', 'places-directions', 'daily-time', 'daily-directions', 'daily-support', 'email-job'];

export function topics(): { id: string; name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.topic, (map.get(it.topic) ?? 0) + 1);
  return [...map.entries()].map(([id, count]) => ({ id, name: topicNames[id] ?? id, count }));
}
export const raInfo: Record<string, { name: string; color: string }> = {
  RA1: { name: 'Listening', color: 'var(--ra1)' },
  RA2: { name: 'Reading y vocabulario', color: 'var(--ra2)' },
  RA3: { name: 'Comunicación oral', color: 'var(--ra3)' },
  RA4: { name: 'Writing y gramática', color: 'var(--ra4)' },
  RA5: { name: 'Cultura y entorno profesional', color: 'var(--ra5)' },
};

/** Diccionario de palabras inglesas conocidas (todo el texto de la app) para el corrector de spelling. */
let dict: Set<string> | null = null;
export function dictionary(): Set<string> {
  if (dict) return dict;
  const text: string[] = [];
  for (const i of items) text.push(i.en, i.example_en, i.def_en ?? '');
  for (const r of readings) text.push(...r.paragraphs, r.title);
  for (const l of listenings) l.script.forEach((s) => text.push(s.text));
  for (const d of dialogues) d.lines.forEach((s) => text.push(s.en));
  for (const g of lessons) g.examples.forEach((s) => text.push(s.en));
  const set = new Set<string>();
  for (const w of text.join(' ').toLowerCase().match(/[a-z']+/g) ?? []) {
    set.add(w);
    for (const suf of ['s', 'es', 'ed', 'd', 'ing', 'er', 'est', 'ly']) set.add(w + suf);
    if (w.endsWith('y')) { set.add(w.slice(0, -1) + 'ies'); set.add(w.slice(0, -1) + 'ier'); set.add(w.slice(0, -1) + 'iest'); }
    if (w.endsWith('s')) set.add(w.slice(0, -1));
    if (w.endsWith('ed')) set.add(w.slice(0, -2));
    if (w.endsWith('ing')) set.add(w.slice(0, -3));
  }
  dict = set;
  return set;
}
