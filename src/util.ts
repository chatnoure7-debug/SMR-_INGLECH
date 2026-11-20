export const esc = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
export const pick = <T,>(a: T[], n: number): T[] => shuffle(a).slice(0, n);

/** Normaliza para comparar respuestas: minúsculas, sin puntuación, espacios simples. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

const H = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const M: Record<number, string> = { 5: 'five', 10: 'ten', 20: 'twenty', 25: 'twenty-five' };
/** 10:45 → "a quarter to eleven" */
export function timeWords(h: number, m: number): string {
  const hh = h % 12;
  const next = (hh + 1) % 12;
  if (m === 0) return `${H[hh]} o'clock`;
  if (m === 15) return `a quarter past ${H[hh]}`;
  if (m === 30) return `half past ${H[hh]}`;
  if (m === 45) return `a quarter to ${H[next]}`;
  if (m < 30) return `${M[m]} past ${H[hh]}`;
  return `${M[60 - m]} to ${H[next]}`;
}
export const fmtTime = (h: number, m: number): string => `${h}:${String(m).padStart(2, '0')}`;
export const fmtMin = (s: number): string => `${Math.floor(s / 60)} min`;
