// Validador de /content/*.json
// - Tarjetas de vocabulario: campos vacíos, ids duplicados, RA válidos, imagen inexistente, textos repetidos.
// - Lecturas (rd-), listenings (ls-), diálogos (dl-), ejercicios (ex-), gramática (gr-), writing (wr-): estructura y respuestas.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'content');
const validRA = ['RA1', 'RA2', 'RA3', 'RA4', 'RA5'];
const errors = [];
const warns = [];
const ids = new Map();
const ens = new Map();
const counts = {};
const empty = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const words = (s) => (s.match(/[A-Za-z0-9'’-]+/g) || []).length;

function need(where, o, keys) {
  for (const k of keys) if (empty(o[k])) errors.push(`${where}: campo vacío o ausente "${k}"`);
}
function checkRA(where, o) {
  if (!Array.isArray(o.ra) || o.ra.some((r) => !validRA.includes(r))) errors.push(`${where}: RA no válido`);
}
function checkRegex(where, p) {
  try { new RegExp(p, 'i'); } catch { errors.push(`${where}: regex no válida ${p}`); }
}

const kinds = {
  vocab(w, it, f) {
    need(w, it, ['id', 'ra', 'topic', 'en', 'es', 'pos', 'example_en', 'example_es', 'difficulty', 'source']);
    checkRA(w, it);
    if (typeof it.difficulty === 'number' && (it.difficulty < 1 || it.difficulty > 5)) errors.push(`${w}: difficulty debe ser 1-5`);
    if (it.image && !existsSync(join(root, 'public', it.image))) warns.push(`${w}: no existe public/${it.image}`);
    const key = (it.en ?? '').toLowerCase().trim();
    if (key) { if (ens.has(key)) warns.push(`${w}: "${it.en}" repetido (también en ${ens.get(key)})`); else ens.set(key, f); }
  },
  rd(w, it) {
    need(w, it, ['id', 'ra', 'title', 'paragraphs', 'tf', 'open', 'synonyms', 'source']);
    checkRA(w, it);
    const text = (it.paragraphs || []).join(' ').toLowerCase();
    (it.tf || []).forEach((t, i) => {
      need(`${w}.tf[${i}]`, t, ['q', 'a', 'why']);
      if (!['T', 'F', 'NM'].includes(t.a)) errors.push(`${w}.tf[${i}]: a debe ser T, F o NM`);
    });
    const tally = (it.tf || []).reduce((m, t) => ((m[t.a] = (m[t.a] || 0) + 1), m), {});
    if ((it.tf || []).length >= 4 && Object.keys(tally).length < 2) warns.push(`${w}: todas las T/F son iguales (${JSON.stringify(tally)})`);
    (it.open || []).forEach((t, i) => need(`${w}.open[${i}]`, t, ['q', 'model']));
    (it.synonyms || []).forEach((s, i) => {
      need(`${w}.synonyms[${i}]`, s, ['def', 'answer']);
      if (s.answer && !text.includes(s.answer.toLowerCase())) warns.push(`${w}.synonyms[${i}]: "${s.answer}" no aparece en el texto`);
    });
  },
  ls(w, it) {
    need(w, it, ['id', 'ra', 'title', 'script', 'tf', 'ideas', 'mc']);
    checkRA(w, it);
    (it.script || []).forEach((l, i) => need(`${w}.script[${i}]`, l, ['who', 'text']));
    (it.tf || []).forEach((t, i) => { need(`${w}.tf[${i}]`, t, ['q', 'a', 'why']); if (!['T', 'F'].includes(t.a)) errors.push(`${w}.tf[${i}]: a debe ser T o F`); });
    if (!(it.tf || []).some((t) => t.a === 'F')) warns.push(`${w}: no hay ninguna F (se puede acertar contestando todo True)`);
    (it.ideas || []).forEach((t, i) => { need(`${w}.ideas[${i}]`, t, ['text']); if (typeof t.mentioned !== 'boolean') errors.push(`${w}.ideas[${i}]: mentioned debe ser true/false`); });
    (it.mc || []).forEach((t, i) => { need(`${w}.mc[${i}]`, t, ['q', 'options']); if (!(t.answer >= 0 && t.answer < (t.options || []).length)) errors.push(`${w}.mc[${i}]: answer fuera de rango`); });
  },
  dl(w, it) {
    need(w, it, ['id', 'ra', 'title', 'situation', 'lines']);
    checkRA(w, it);
    (it.lines || []).forEach((l, i) => need(`${w}.lines[${i}]`, l, ['who', 'en', 'es']));
  },
  ex(w, it) {
    need(w, it, ['id', 'ra', 'kind', 'title', 'source']);
    checkRA(w, it);
    if (it.kind === 'match') (it.pairs || []).forEach((p, i) => need(`${w}.pairs[${i}]`, p, ['term', 'def']));
    else if (it.kind === 'wordbank' || it.kind === 'gapbank') {
      need(w, it, ['bank', 'items']);
      (it.items || []).forEach((p, i) => {
        need(`${w}.items[${i}]`, p, ['text', 'answer']);
        if (!(it.bank || []).includes(p.answer)) errors.push(`${w}.items[${i}]: la respuesta "${p.answer}" no está en el banco`);
      });
    } else errors.push(`${w}: kind desconocido`);
  },
  gr(w, it) {
    need(w, it, ['id', 'ra', 'title', 'rule', 'examples', 'exercises']);
    checkRA(w, it);
    (it.exercises || []).forEach((e, i) => {
      const ww = `${w}.exercises[${i}]`;
      if (e.t === 'choice') { need(ww, e, ['q', 'options']); if (!(e.a >= 0 && e.a < (e.options || []).length)) errors.push(`${ww}: a fuera de rango`); }
      else if (e.t === 'gap') need(ww, e, ['q', 'a']);
      else if (e.t === 'order') { need(ww, e, ['words', 'a']); const a = (e.a || '').replace(/\s*\?$/, '').split(/\s+/).filter(Boolean).sort().join('|').toLowerCase(); const b = (e.words || []).map((x) => x.replace('?', '')).filter(Boolean).sort().join('|').toLowerCase(); if (a !== b) errors.push(`${ww}: las palabras no forman la respuesta`); }
      else errors.push(`${ww}: tipo desconocido`);
    });
  },
  wr(w, it) {
    need(w, it, ['id', 'ra', 'kind', 'title', 'prompt', 'source']);
    checkRA(w, it);
    const must = it.must || (it.parts || []).flatMap((p) => p.must || []);
    must.forEach((m) => { need(`${w}.must`, m, ['id', 'label']); if (m.pattern) checkRegex(w, m.pattern); });
    (it.forbid || []).forEach((m) => checkRegex(w, m.pattern));
    if (it.kind === 'composition' || it.kind === 'email') {
      const n = words(it.model || '');
      if (n < it.min || n > it.max) errors.push(`${w}: la respuesta modelo tiene ${n} palabras (debe estar entre ${it.min} y ${it.max})`);
    }
    // el modelo debe cumplir su propia checklist
    const check = (txt, ms, label) => ms.forEach((m) => {
      if (m.pattern) {
        const hits = (txt.match(new RegExp(m.pattern, 'gi')) || []).length;
        if (hits < (m.min || 1)) warns.push(`${w}${label}: el modelo no cumple «${m.label}»`);
      }
    });
    if (it.must) check(it.model || '', it.must, '');
    (it.parts || []).forEach((p) => check(p.model || '', p.must || [], `[${p.id}]`));
  },
};

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  let data;
  try { data = JSON.parse(readFileSync(join(dir, f), 'utf8')); }
  catch (e) { errors.push(`${f}: JSON no válido (${e.message})`); continue; }
  if (!Array.isArray(data)) { errors.push(`${f}: debe ser una lista []`); continue; }
  data.forEach((it, i) => {
    const w = `${f}[${i}]${it.id ? ' ' + it.id : ''}`;
    const prefix = (it.id || '').split('-')[0];
    const kind = kinds[prefix] ? prefix : 'vocab';
    counts[kind] = (counts[kind] || 0) + 1;
    if (it.id) { if (ids.has(it.id)) errors.push(`${w}: id duplicado (también en ${ids.get(it.id)})`); else ids.set(it.id, f); }
    kinds[kind](w, it, f);
  });
}
console.log('Contenido:', JSON.stringify(counts));
warns.forEach((w) => console.log('AVISO ', w));
errors.forEach((e) => console.log('ERROR ', e));
if (errors.length) process.exit(1);
console.log('Contenido válido ✓');
