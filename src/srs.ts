import { addDays, dayKey, state } from './store';

// Cajas de Leitner: intervalo en días por caja. Un fallo vuelve a la caja 0 y se repite hoy mismo.
const INTERVALS = [0, 1, 2, 4, 8, 16, 32];

export function isDue(id: string): boolean {
  const c = state.cards[id];
  return !!c && c.due <= dayKey();
}
export function isKnown(id: string): boolean { return !!state.cards[id]; }

export function grade(id: string, ok: boolean): void {
  const today = dayKey();
  const c = (state.cards[id] ??= { box: 0, due: today, lapses: 0, seen: 0, last: today });
  c.seen++;
  c.last = today;
  if (ok) {
    c.box = Math.min(INTERVALS.length - 1, c.box + 1);
    c.due = addDays(today, INTERVALS[c.box]);
  } else {
    c.box = 0;
    c.lapses++;
    c.due = today;
  }
}
/** Primera vez que se ve una tarjeta nueva: se programa para mañana. */
export function introduce(id: string): void {
  if (state.cards[id]) return;
  const t = dayKey();
  state.cards[id] = { box: 1, due: addDays(t, 1), lapses: 0, seen: 1, last: t };
}
/** Tarjetas a repasar: primero las falladas hoy/ayer (más fallos), luego las más atrasadas. */
export function dueIds(limit: number): string[] {
  const t = dayKey();
  return Object.entries(state.cards)
    .filter(([, c]) => c.due <= t)
    .sort((a, b) => (a[1].box - b[1].box) || (b[1].lapses - a[1].lapses) || a[1].due.localeCompare(b[1].due))
    .slice(0, limit)
    .map(([id]) => id);
}
export function weakIds(limit: number): string[] {
  return Object.entries(state.cards)
    .filter(([, c]) => c.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || a[1].box - b[1].box)
    .slice(0, limit)
    .map(([id]) => id);
}
export function learnedCount(): number {
  return Object.values(state.cards).filter((c) => c.box >= 3).length;
}
