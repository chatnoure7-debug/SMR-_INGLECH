import type { Must, WritingTask } from './types';
import { dictionary, items } from './content';
import { esc, lev } from './util';

export const wordCount = (s: string): number => (s.match(/[A-Za-z0-9'’-]+/g) ?? []).length;

export interface MustResult { label: string; ok: boolean }

export function evalMust(text: string, must: Must[]): MustResult[] {
  return must.map((m) => {
    let ok: boolean;
    if (m.count) ok = text.split(m.count).length - 1 >= (m.min ?? 1);
    else ok = (text.match(new RegExp(m.pattern!, 'gi')) ?? []).length >= (m.min ?? 1);
    return { label: m.label, ok };
  });
}

/** Errores típicos que aparecen en tus exámenes. */
const COMMON: { re: RegExp; msg: string }[] = [
  { re: /\bI have \d+/i, msg: "La edad se dice con 'be': I am 20 (no 'I have 20')." },
  { re: /\b(he|she) (like|work|study|use|do|go|prefer|want|need|live|play|love|think|know|check|fix|install|learn) /i, msg: 'Con he / she el verbo lleva -s: he works, she studies, he goes.' },
  { re: /\b(he|she) have\b/i, msg: "Con he / she se dice 'has': she has a laptop." },
  { re: /\bmore (faster|bigger|cheaper|lighter|better|slower|smaller|larger|quicker|brighter|heavier)\b/i, msg: "Comparativo doble: es 'faster', no 'more faster'." },
  { re: /\bmost (fastest|biggest|cheapest|best|worst|lightest)\b/i, msg: "Superlativo doble: es 'the fastest', no 'the most fastest'." },
  { re: /\bmore (fast|big|cheap|light|small|slow|large|quick|bright|heavy)\b(?! than ?(a|an|the)? ?\w+er)/i, msg: "Con adjetivos cortos se usa -er: faster, brighter (no 'more fast')." },
  { re: /\ba (?!u[snt]|uni|eu|one)[aeio]\w+/i, msg: "Delante de sonido vocal se usa 'an': an optical mouse, an IT technician." },
  { re: /\b(i|he|she) (am|is) agree\b/i, msg: "'Estar de acuerdo' es 'I agree' (sin 'am')." },
  { re: /\bdon't (has|works|likes)\b/i, msg: "Tras don't / doesn't el verbo va en forma base." },
  { re: /\bdoesn't (works|likes|has|uses|studies)\b/i, msg: "Tras doesn't el verbo va sin -s: she doesn't like." },
];

export function grammarHints(text: string, forbid: { pattern: string; msg: string }[] = []): string[] {
  const out: string[] = [];
  for (const { re, msg } of COMMON) if (re.test(text)) out.push(msg);
  for (const f of forbid) if (new RegExp(f.pattern, 'i').test(text)) out.push(f.msg);
  return out;
}

let tech: string[] | null = null;
/** Palabras desconocidas muy parecidas a una conocida → "¿querías escribir …?" */
export function spellingHints(text: string): { wrong: string; right: string }[] {
  const dict = dictionary();
  if (!tech) tech = [...new Set(items.flatMap((i) => i.en.toLowerCase().match(/[a-z]{5,}/g) ?? []))];
  const seen = new Set<string>();
  const out: { wrong: string; right: string }[] = [];
  for (const w of text.toLowerCase().match(/[a-z]{5,}/g) ?? []) {
    if (dict.has(w) || seen.has(w)) continue;
    seen.add(w);
    const max = w.length >= 8 ? 2 : 1;
    let best: string | null = null, bd = 99;
    for (const t of tech) {
      if (Math.abs(t.length - w.length) > max || t[0] !== w[0]) continue;
      const d = lev(w, t);
      if (d <= max && d < bd) { best = t; bd = d; }
    }
    if (best) out.push({ wrong: w, right: best });
  }
  return out;
}

export function feedbackHtml(task: WritingTask, texts: Record<string, string>): { c: number; t: number; html: string } {
  const all = Object.values(texts).join('\n');
  let c = 0, t = 0;
  const rows: string[] = [];
  const add = (label: string, ok: boolean) => { t++; if (ok) c++; rows.push(`<li class="${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✗'} ${esc(label)}</li>`); };
  if (task.parts) {
    for (const p of task.parts) {
      rows.push(`<li class="head">${esc(p.label)}</li>`);
      evalMust(texts[p.id] ?? '', p.must).forEach((r) => add(r.label, r.ok));
    }
  } else {
    const n = wordCount(all);
    if (task.min) add(`${task.min}–${task.max} palabras (llevas ${n})`, n >= task.min && n <= task.max!);
    if (task.minLines) {
      const lines = all.split('\n').filter((l) => l.trim()).length;
      add(`${task.minLines}–${task.maxLines} líneas (llevas ${lines})`, lines >= task.minLines && lines <= task.maxLines!);
    }
    evalMust(all, task.must ?? []).forEach((r) => add(r.label, r.ok));
  }
  const hints = grammarHints(all, task.forbid);
  const sp = spellingHints(all);
  let html = `<ul class="check">${rows.join('')}</ul>`;
  if (hints.length) html += `<div class="hint-box"><b>Ojo con la gramática</b><ul>${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>`;
  if (sp.length) html += `<div class="hint-box"><b>Ortografía</b><ul>${sp.map((s) => `<li>«${esc(s.wrong)}» → ¿<b>${esc(s.right)}</b>?</li>`).join('')}</ul></div>`;
  return { c, t, html };
}
