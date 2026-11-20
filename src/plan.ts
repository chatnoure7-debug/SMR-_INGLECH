import type { Item, Task, TaskWithStep } from './types';
import {
  dailyTopics, dialogues, exSets, item, items, lessons, listenings, readings, techTopics, writings,
} from './content';
import { dueIds, isKnown, weakIds } from './srs';
import { state } from './store';
import { pick, shuffle, timeWords } from './util';

const dayIndex = (): number => Object.keys(state.history).length;

// ---------- distractores ----------
export function options(id: string, n = 4): string[] {
  const it = item(id);
  const same = shuffle(items.filter((x) => x.id !== id && x.topic === it.topic));
  const rest = shuffle(items.filter((x) => x.id !== id && x.topic !== it.topic && x.pos === it.pos));
  const others = [...same, ...rest].slice(0, n - 1).map((x) => x.id);
  return shuffle([id, ...others]);
}
export function quiz(id: string, prefer?: 'def' | 'es2en' | 'spell'): Task {
  const it = item(id);
  const words = it.en.split(/\s+/).length;
  const canSpell = words <= 3 && it.pos !== 'phrase';
  let k: 'def' | 'es2en' | 'spell' = prefer ?? (pick(['def', 'es2en', 'spell'], 1)[0] as 'def' | 'es2en' | 'spell');
  if (k === 'def' && !it.def_en) k = 'es2en';
  if (k === 'spell' && !canSpell) k = it.def_en ? 'def' : 'es2en';
  if (k === 'spell') return { k: 'spell', id };
  return { k, id, opts: options(id) } as Task;
}
export function timeTask(): Task {
  const h = 1 + Math.floor(Math.random() * 12);
  const m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], 1)[0];
  const right = timeWords(h, m);
  const wrong = new Set<string>();
  for (const [hh, mm] of [[h, m === 0 ? 30 : (60 - m) % 60], [h + 1, m], [h - 1 || 12, m], [h, (m + 10) % 60], [h, (m + 20) % 60]]) {
    const w = timeWords(((hh - 1 + 12) % 12) + 1, mm);
    if (w !== right) wrong.add(w);
  }
  return { k: 'time', h, m, opts: shuffle([right, ...[...wrong].slice(0, 3)]) };
}

// ---------- bloques ----------
export function readingTasks(rid: string, full = false): Task[] {
  const r = readings.find((x) => x.id === rid)!;
  const out: Task[] = [{ k: 'read', rid }];
  r.tf.forEach((_, i) => out.push({ k: 'tf', rid, i }));
  const opens = full ? r.open.length : Math.min(2, r.open.length);
  pick([...r.open.keys()], opens).sort().forEach((i) => out.push({ k: 'open', rid, i }));
  const syns = full ? r.synonyms.length : Math.min(2, r.synonyms.length);
  pick([...r.synonyms.keys()], syns).sort().forEach((i) => out.push({ k: 'syn', rid, i }));
  if (full && r.rephrase) r.rephrase.forEach((_, i) => out.push({ k: 'rephrase', rid, i }));
  return out;
}
export function listeningTasks(lid: string): Task[] {
  const l = listenings.find((x) => x.id === lid)!;
  return [
    { k: 'listen', lid },
    ...l.tf.map((_, i) => ({ k: 'ltf', lid, i }) as Task),
    { k: 'lideas', lid },
    ...l.mc.map((_, i) => ({ k: 'lmc', lid, i }) as Task),
  ];
}
export function lessonTasks(gid: string, n = 99): Task[] {
  const g = lessons.find((x) => x.id === gid)!;
  const idx = pick([...g.exercises.keys()], Math.min(n, g.exercises.length));
  return [{ k: 'lesson', gid }, ...(n >= 99 ? [...g.exercises.keys()] : idx).map((i) => ({ k: 'gex', gid, i }) as Task)];
}
function nextReading(): string {
  const base = readings.filter((r) => r.level !== 'C1');
  const sorted = [...base].sort((a, b) => (state.readCount[a.id] ?? 0) - (state.readCount[b.id] ?? 0) || a.id.localeCompare(b.id));
  return sorted[0].id;
}
const rotate = <T,>(a: T[], n = 0): T => a[(dayIndex() + n) % a.length];

export function newItems(n: number): Item[] {
  const fresh = (topics: string[]) => items.filter((i) => topics.includes(i.topic) && !isKnown(i.id));
  const tech = fresh(techTopics);
  const daily = fresh(dailyTopics);
  const nd = Math.min(daily.length, Math.max(2, Math.round(n * 0.45)));
  const nt = Math.min(tech.length, n - nd);
  const out = [...tech.slice(0, nt), ...daily.slice(0, nd)];
  if (out.length < n) out.push(...[...tech.slice(nt), ...daily.slice(nd)].slice(0, n - out.length));
  return out;
}
export function newItemsLeft(): number { return items.filter((i) => !isKnown(i.id)).length; }

// ---------- sesión diaria (30 min orientativos, ampliable) ----------
export function sessionTasks(): TaskWithStep[] {
  const s = (step: string, ts: Task[]): TaskWithStep[] => ts.map((t) => ({ ...t, step }) as TaskWithStep);
  const out: TaskWithStep[] = [];
  const due = dueIds(15);
  out.push(...s('Repaso', due.map((id) => ({ k: 'card', id, mode: 'review' }) as Task)));
  const fresh = newItems(state.settings.newPerDay);
  out.push(...s('Palabras nuevas', fresh.map((i) => ({ k: 'card', id: i.id, mode: 'new' }) as Task)));
  out.push(...s('Pon a prueba lo nuevo', pick(fresh, Math.min(4, fresh.length)).map((i) => quiz(i.id))));
  out.push(...s('Lectura', readingTasks(nextReading())));
  out.push(...s('Listening', listeningTasks(rotate(listenings).id)));
  out.push(...s('Inglés del día a día', [
    { k: 'dialogue', did: rotate(dialogues).id },
    ...lessonTasks(rotate(lessons).id, 4),
    timeTask(),
  ]));
  if (dayIndex() % 3 === 0) out.push(...s('Writing', [{ k: 'write', wid: rotate(writings).id }]));
  const pool = [...fresh.map((i) => i.id), ...due];
  const test: Task[] = pool.length ? pick(pool, Math.min(4, pool.length)).map((id) => quiz(id)) : [];
  test.push(timeTask());
  const L = rotate(lessons, 3);
  pick([...L.exercises.keys()], 2).forEach((i) => test.push({ k: 'gex', gid: L.id, i }));
  out.push(...s('Mini-test final', test));
  return out;
}

// ---------- práctica libre ----------
export function practice(spec: string): { title: string; tasks: Task[] } {
  const [kind, arg] = spec.split(':');
  const cards = (ids: string[]): Task[] => ids.map((id) => ({ k: 'card', id, mode: 'review' }) as Task);
  switch (kind) {
    case 'topic': {
      const list = shuffle(arg === '*' ? items : items.filter((i) => i.topic === arg));
      return { title: arg === '*' ? 'Todo mezclado' : (list[0]?.topic ?? arg), tasks: cards(list.map((i) => i.id)) };
    }
    case 'weak': {
      const ids = weakIds(20);
      return { title: 'Mis fallos', tasks: [...cards(ids), ...ids.slice(0, 8).map((id) => quiz(id))] };
    }
    case 'due': return { title: 'Repaso de hoy', tasks: cards(dueIds(40)) };
    case 'spell': {
      const pool = items.filter((i) => i.en.split(/\s+/).length <= 3 && i.pos !== 'phrase');
      return { title: 'Spelling', tasks: pick(pool, 10).map((i) => ({ k: 'spell', id: i.id }) as Task) };
    }
    case 'defs': {
      const pool = items.filter((i) => i.def_en);
      return { title: 'Definición → término', tasks: pick(pool, 10).map((i) => quiz(i.id, 'def')) };
    }
    case 'es2en': return { title: 'Español → inglés', tasks: pick(items, 12).map((i) => quiz(i.id, 'es2en')) };
    case 'time': return { title: 'La hora', tasks: Array.from({ length: 8 }, timeTask) };
    case 'reading': return { title: 'Lectura', tasks: readingTasks(arg, true) };
    case 'listening': return { title: 'Listening', tasks: listeningTasks(arg) };
    case 'lesson': return { title: 'Gramática', tasks: lessonTasks(arg) };
    case 'dialogue': return { title: 'Diálogo', tasks: [{ k: 'dialogue', did: arg }] };
    case 'set': return { title: 'Ejercicio', tasks: [{ k: 'set', eid: arg }] };
    case 'write': return { title: 'Writing', tasks: [{ k: 'write', wid: arg }] };
    default: return { title: 'Práctica', tasks: [] };
  }
}

// ---------- modo examen ----------
const A = (ids: string[]) => pick(ids, 1)[0];
export function examIT(): TaskWithStep[] {
  const s = (step: string, ts: Task[]): TaskWithStep[] => ts.map((t) => ({ ...t, step }) as TaskWithStep);
  const lid = A(listenings.map((l) => l.id));
  const rid = A(readings.filter((r) => ['rd-0001', 'rd-0002', 'rd-0003', 'rd-0004', 'rd-0005', 'rd-0006'].includes(r.id)).map((r) => r.id));
  const r = readings.find((x) => x.id === rid)!;
  const comp = lessons.filter((l) => l.id === 'gr-0008' || l.id === 'gr-0009');
  const gaps: Task[] = [];
  for (const l of comp) {
    const idx = l.exercises.map((e, i) => [e, i] as const).filter(([e]) => e.t === 'gap').map(([, i]) => i);
    pick(idx, 2).forEach((i) => gaps.push({ k: 'gex', gid: l.id, i }));
  }
  return [
    ...s('Section 1 · Listening (RA1)', [{ k: 'listen', lid }, ...listeningTasks(lid).slice(1, -1).filter((t) => t.k !== 'lmc')]),
    ...s('Section 2 · Reading (RA2)', [{ k: 'read', rid }, ...r.tf.slice(0, 4).map((_, i) => ({ k: 'tf', rid, i }) as Task), ...[0, 1].filter((i) => r.open[i]).map((i) => ({ k: 'open', rid, i }) as Task)]),
    ...s('Section 3 · Use of Vocabulary', [{ k: 'set', eid: A(['ex-0005', 'ex-0006', 'ex-0007']) }, ...gaps]),
    ...s('Section 4 · Writing (RA4/RA5)', [{ k: 'write', wid: A(['wr-0001', 'wr-0002', 'wr-0003']) }]),
  ];
}
export function examB1(): TaskWithStep[] {
  const s = (step: string, ts: Task[]): TaskWithStep[] => ts.map((t) => ({ ...t, step }) as TaskWithStep);
  const rid = A(['rd-0007', 'rd-0008', 'rd-0009']);
  const r = readings.find((x) => x.id === rid)!;
  const lid = A(listenings.map((l) => l.id));
  return [
    ...s('Part 1 · Reading', [{ k: 'read', rid }, ...r.tf.map((_, i) => ({ k: 'tf', rid, i }) as Task), ...r.open.map((_, i) => ({ k: 'open', rid, i }) as Task), ...r.synonyms.map((_, i) => ({ k: 'syn', rid, i }) as Task)]),
    ...s('Part 2 · Vocabulary use', [{ k: 'set', eid: A(['ex-0001', 'ex-0002', 'ex-0003']) }, { k: 'set', eid: A(['ex-0008', 'ex-0009', 'ex-0010']) }]),
    ...s('Part 3 · Communicative situations', [{ k: 'write', wid: A(['wr-0004', 'wr-0005', 'wr-0006']) }, { k: 'write', wid: A(['wr-0007', 'wr-0008', 'wr-0009']) }]),
    ...s('Part 4 · Listening', listeningTasks(lid).filter((t) => t.k !== 'lmc' || true)),
  ];
}
export const setCount = exSets.length;
