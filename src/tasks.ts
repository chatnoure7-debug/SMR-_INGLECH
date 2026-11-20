import type { Rendered, RA, Result, Task } from './types';
import {
  dialogue, exSet, item, lesson, listening, raInfo, reading, writing,
} from './content';
import { esc, fmtTime, norm, shuffle, timeWords } from './util';
import { speak, speakScript, stopSpeaking } from './tts';
import { feedbackHtml, grammarHints, spellingHints, wordCount } from './writing';

const ok = (msg = 'Correcto'): string => `<div class="fb-line ok">✓ ${esc(msg)}</div>`;
const ko = (msg: string): string => `<div class="fb-line ko">✗ ${msg}</div>`;
const why = (w: string): string => (w ? `<p class="why">${esc(w)}</p>` : '');
const speakBtn = (text: string, label = '🔊'): string =>
  `<button class="btn round" data-speak="${esc(text)}" aria-label="Escuchar">${label}</button>`;

/** RA a los que cuenta cada tarea (para las notas por RA). */
export function raOf(t: Task): RA[] {
  switch (t.k) {
    case 'card': case 'def': case 'es2en': case 'spell': return item(t.id).ra;
    case 'read': case 'tf': case 'syn': case 'open': case 'rephrase': return reading(t.rid).ra;
    case 'listen': case 'ltf': case 'lideas': case 'lmc': return listening(t.lid).ra;
    case 'set': return exSet(t.eid).ra;
    case 'lesson': case 'gex': return lesson(t.gid).ra;
    case 'time': return ['RA3', 'RA4'];
    case 'dialogue': return dialogue(t.did).ra;
    case 'write': return writing(t.wid).ra;
  }
}
export const isInfo = (t: Task): boolean => ['read', 'listen', 'lesson', 'dialogue'].includes(t.k);

function optionsHtml(opts: string[]): string {
  return `<div class="opts">${opts.map((o, i) => `<button class="opt" data-pick="${i}">${esc(o)}</button>`).join('')}</div>`;
}
function passage(rid: string, open = false): string {
  const r = reading(rid);
  return `<details class="passage" ${open ? 'open' : ''}><summary>Ver el texto: ${esc(r.title)}</summary>${r.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</details>`;
}
function replayBtn(lid: string): string {
  return `<button class="btn" data-replay="${lid}">▶ Escuchar el audio</button>`;
}

function acceptedSpellings(en: string): string[] {
  const set = new Set<string>([norm(en)]);
  const noParen = en.replace(/\(.*?\)/g, ' ');
  set.add(norm(noParen));
  for (const m of en.matchAll(/\(([^)]+)\)/g)) set.add(norm(m[1]));
  for (const part of en.split('/')) { set.add(norm(part)); set.add(norm(part.replace(/\(.*?\)/g, ' '))); }
  set.delete('');
  return [...set];
}

export function render(t: Task, exam: boolean): Rendered {
  switch (t.k) {
    // ---------- vocabulario ----------
    case 'card': {
      const it = item(t.id);
      const img = it.image ? `<img class="card-img" src="${it.image}" alt="Dibujo de ${esc(it.es)}" />` : '';
      const rating = t.mode === 'review'
        ? `<div class="row rate"><button class="btn wide ko" data-done="0">Fallé</button><button class="btn wide primary" data-done="1">La sabía</button></div>`
        : `<div class="row"><button class="btn wide primary" data-done="skip">Siguiente</button></div>`;
      return {
        html: `<p class="kicker">${t.mode === 'new' ? 'Palabra nueva' : 'Repaso'}</p>
        <div class="flip" data-flip role="button" tabindex="0" aria-label="Tocar para ver la traducción">
          <div class="flip-inner">
            <div class="face front">${img}<div class="en">${esc(it.en)}</div>
              ${speakBtn(it.en)}<div class="hint">Toca la tarjeta para ver la traducción</div></div>
            <div class="face back"><div class="en small">${esc(it.en)}</div><div class="es big">${esc(it.es)}</div>
              ${it.def_en ? `<p class="def">${esc(it.def_en)}</p>` : ''}
              <div class="ex"><p>${esc(it.example_en)}</p><p class="es">${esc(it.example_es)}</p>${speakBtn(it.example_en)}</div></div>
          </div>
        </div>${rating}`,
        mount: (root) => { if (t.mode === 'new') void speak(it.en); void root; },
      };
    }
    case 'def': {
      const it = item(t.id);
      const opts = t.opts.map((id) => item(id).en);
      return {
        html: `<p class="kicker">Definición → término</p><p class="q">${esc(it.def_en!)}</p>${optionsHtml(opts)}`,
        pick: (i) => {
          const good = t.opts.indexOf(t.id);
          const right = i === good;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: good,
            fb: (right ? ok() : ko(`Es <b>${esc(it.en)}</b> (${esc(it.es)})`)) + `<p class="why">${esc(it.example_en)}</p>`,
            ask: `Explícame la palabra «${it.en}» y cómo se escribe.` };
        },
      };
    }
    case 'es2en': {
      const it = item(t.id);
      const opts = t.opts.map((id) => item(id).en);
      return {
        html: `<p class="kicker">¿Cómo se dice en inglés?</p><p class="q">${esc(it.es)}</p>${optionsHtml(opts)}`,
        pick: (i) => {
          const good = t.opts.indexOf(t.id);
          const right = i === good;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: good,
            fb: (right ? ok() : ko(`Es <b>${esc(it.en)}</b>`)) + `<p class="why">${esc(it.example_en)}</p>`, ask: `¿Cómo se usa «${it.en}»?` };
        },
        mount: () => { /* nada */ },
      };
    }
    case 'spell': {
      const it = item(t.id);
      return {
        html: `<p class="kicker">Spelling: escucha y escribe</p>
        <div class="center">${speakBtn(it.en, '🔊 Escuchar')}</div>
        <p class="hint center" data-reveal>Pista: toca para ver el significado</p>
        <input class="text" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Escribe lo que oyes" />`,
        mount: (root) => {
          void speak(it.en);
          const h = root.querySelector<HTMLElement>('[data-reveal]')!;
          h.onclick = () => { h.textContent = it.es; };
        },
        check: (root) => {
          const v = norm(root.querySelector<HTMLInputElement>('input')!.value);
          const right = acceptedSpellings(it.en).includes(v);
          return { c: right ? 1 : 0, t: 1,
            fb: right ? ok() : ko(`Se escribe <b>${esc(it.en)}</b>${v ? ` (tú: ${esc(v)})` : ''}`), ask: `Ayúdame a recordar la ortografía de «${it.en}».` };
        },
      };
    }
    // ---------- lectura ----------
    case 'read': {
      const r = reading(t.rid);
      return {
        info: true,
        html: `<p class="kicker">Lectura · ${esc(r.level)} · ${esc(r.module)}</p><h2 class="title">${esc(r.title)}</h2>
        ${r.note ? `<p class="note left">${esc(r.note)}</p>` : ''}
        <div class="text-block">${r.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="center">${speakBtn(r.paragraphs.join(' '), '🔊 Escuchar el texto')}</div>`,
      };
    }
    case 'tf': {
      const r = reading(t.rid);
      const q = r.tf[t.i];
      const labels: ['T' | 'F' | 'NM', string][] = [['T', 'True'], ['F', 'False'], ['NM', 'Not mentioned']];
      return {
        html: `<p class="kicker">True / False / Not mentioned</p>${passage(t.rid, t.i === 0)}<p class="q">${esc(q.q)}</p>${optionsHtml(labels.map((l) => l[1]))}`,
        pick: (i) => {
          const good = labels.findIndex((l) => l[0] === q.a);
          const right = i === good;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: good,
            fb: (right ? ok() : ko(`Era <b>${labels[good][1]}</b>`)) + `<p class="why"><b>Justificación:</b> ${esc(q.why)}</p>`,
            ask: `En el texto «${r.title}», la frase "${q.q}" es ${labels[good][1]}. ¿Por qué?` };
        },
      };
    }
    case 'syn': {
      const r = reading(t.rid);
      const s = r.synonyms[t.i];
      return {
        html: `<p class="kicker">Busca en el texto una palabra que signifique…</p>${passage(t.rid)}<p class="q">${esc(s.def)}</p>
        <input class="text" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Escribe la palabra del texto" />`,
        check: (root) => {
          const v = norm(root.querySelector<HTMLInputElement>('input')!.value);
          const a = norm(s.answer);
          const right = v === a || v === a + 's' || v + 's' === a;
          return { c: right ? 1 : 0, t: 1, fb: right ? ok() : ko(`La palabra es <b>${esc(s.answer)}</b>`), ask: `¿Qué significa «${s.answer}» y cómo se usa?` };
        },
      };
    }
    case 'open': {
      const r = reading(t.rid);
      const q = r.open[t.i];
      return {
        checkLabel: 'Ver respuesta modelo',
        html: `<p class="kicker">Pregunta abierta · responde con una frase completa</p>${passage(t.rid)}<p class="q">${esc(q.q)}</p>
        <textarea class="text area" rows="3" placeholder="Escribe una frase completa (sujeto + verbo)…"></textarea>
        <div class="self" hidden>
          <div class="model"><b>Respuesta modelo</b><p>${esc(q.model)}</p></div>
          <div class="auto-hints"></div>
          <p class="note left">Compara y marca lo que cumpliste:</p>
          <label class="chk"><input type="checkbox" /> Escribí una frase completa (sujeto + verbo)</label>
          <label class="chk"><input type="checkbox" /> Mi respuesta dice lo mismo que el modelo</label>
          <label class="chk"><input type="checkbox" /> La ortografía es correcta</label>
        </div>`,
        check: (root) => {
          const self = root.querySelector<HTMLElement>('.self')!;
          const ta = root.querySelector<HTMLTextAreaElement>('textarea')!;
          if (self.hidden) {
            self.hidden = false;
            ta.readOnly = true;
            const h = [...grammarHints(ta.value), ...spellingHints(ta.value).map((s) => `«${s.wrong}» → ¿${s.right}?`)];
            root.querySelector('.auto-hints')!.innerHTML = h.length ? `<div class="hint-box"><b>Revisa</b><ul>${h.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
            const btn = root.querySelector<HTMLButtonElement>('[data-check]');
            if (btn) btn.textContent = 'Evaluar';
            return null;
          }
          const c = root.querySelectorAll<HTMLInputElement>('.self input:checked').length;
          return { c, t: 3, fb: c === 3 ? ok('Muy bien') : `<div class="fb-line ko">Repasa el modelo y vuelve a intentarlo otro día.</div>`, ask: `Corrige mi respuesta a "${q.q}": ${ta.value}` };
        },
      };
    }
    case 'rephrase': {
      const r = reading(t.rid);
      const q = r.rephrase![t.i];
      return {
        html: `<p class="kicker">Rephrasing (nivel avanzado)</p><p class="q">${esc(q.orig)}</p>
        <p class="note left">${esc(q.hint)}</p><p class="q">${esc(q.start)} …</p>
        <input class="text" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Completa la frase" />`,
        check: (root) => {
          const v = norm(root.querySelector<HTMLInputElement>('input')!.value);
          const right = q.answers.some((a) => v.includes(norm(a)));
          return { c: right ? 1 : 0, t: 1, fb: right ? ok() : ko(`Modelo: <b>${esc(q.start)} ${esc(q.gap)}</b>`), ask: `Explícame esta transformación: ${q.orig}` };
        },
      };
    }
    // ---------- listening ----------
    case 'listen': {
      const l = listening(t.lid);
      return {
        info: true,
        html: `<p class="kicker">Listening · ${esc(l.level)}</p><h2 class="title">${esc(l.title)}</h2>
        <p class="note left">Escucha el audio las veces que necesites. No mires el guion hasta terminar. Ojo: no todo es True.</p>
        <div class="center"><button class="btn big primary" data-play="${l.id}">▶ Escuchar</button>
        <button class="btn" data-stop>■ Parar</button></div>
        <details class="passage"><summary>Ver transcripción (después de contestar)</summary>${l.script.map((s) => `<p><b>${esc(s.who)}:</b> ${esc(s.text)}</p>`).join('')}</details>`,
        mount: (root) => {
          root.querySelector<HTMLElement>('[data-play]')!.onclick = () => void speakScript(l.script, l.voices);
          root.querySelector<HTMLElement>('[data-stop]')!.onclick = () => stopSpeaking();
        },
      };
    }
    case 'ltf': {
      const l = listening(t.lid);
      const q = l.tf[t.i];
      return {
        html: `<p class="kicker">Listening · True or False</p>${replayBtn(l.id)}<p class="q">${esc(q.q)}</p>${optionsHtml(['True', 'False'])}`,
        pick: (i) => {
          const good = q.a === 'T' ? 0 : 1;
          const right = i === good;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: good,
            fb: (right ? ok() : ko(`Era <b>${good === 0 ? 'True' : 'False'}</b>`)) + `<p class="why"><b>Justificación:</b> ${esc(q.why)}</p>`, ask: `En el audio "${l.title}", ¿por qué "${q.q}" es ${q.a}?` };
        },
      };
    }
    case 'lmc': {
      const l = listening(t.lid);
      const q = l.mc[t.i];
      return {
        html: `<p class="kicker">Listening · elige la opción correcta</p>${replayBtn(l.id)}<p class="q">${esc(q.q)}</p>${optionsHtml(q.options)}`,
        pick: (i) => {
          const right = i === q.answer;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: q.answer, fb: right ? ok() : ko(`Era <b>${esc(q.options[q.answer])}</b>`) };
        },
      };
    }
    case 'lideas': {
      const l = listening(t.lid);
      return {
        checkLabel: 'Comprobar',
        html: `<p class="kicker">Listening · marca solo lo que se menciona</p>${replayBtn(l.id)}
        <p class="q">${esc(l.ideas_title)}</p>
        ${l.ideas.map((x, i) => `<label class="chk"><input type="checkbox" data-i="${i}" /> ${esc(x.text)}</label>`).join('')}
        <p class="note left">Marca ✓ solo las ideas que se dicen en el audio.</p>`,
        check: (root) => {
          let c = 0;
          const wrong: string[] = [];
          l.ideas.forEach((x, i) => {
            const on = root.querySelector<HTMLInputElement>(`input[data-i="${i}"]`)!.checked;
            if (on === x.mentioned) c++; else wrong.push(`${x.mentioned ? '✓ Sí se menciona' : '✗ No se menciona'}: ${x.text}`);
          });
          return { c, t: l.ideas.length, fb: wrong.length ? ko('Revisa:') + `<ul class="why">${wrong.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ok() };
        },
      };
    }
    // ---------- emparejar / word bank ----------
    case 'set': {
      const s = exSet(t.eid);
      const rows = s.kind === 'match'
        ? s.pairs!.map((p) => ({ text: p.def, answer: p.term }))
        : s.items!;
      const bank = s.kind === 'match' ? shuffle(s.pairs!.map((p) => p.term)) : s.bank!;
      const extra = bank.length - rows.length;
      const label = s.kind === 'match' ? 'Une cada función con su puesto' : s.kind === 'wordbank' ? 'Escribe el término correcto del word bank' : 'Completa con el módulo o lugar correcto';
      return {
        checkLabel: 'Comprobar',
        html: `<p class="kicker">${label}</p><h2 class="title sm">${esc(s.title)}</h2>
        <div class="bank">${bank.map((b) => `<span class="chip2">${esc(b)}</span>`).join('')}</div>
        ${extra > 0 ? `<p class="note left">Hay ${extra} término${extra > 1 ? 's' : ''} de sobra.</p>` : ''}
        ${rows.map((r, i) => `<div class="set-row"><p>${i + 1}. ${esc(r.text)}</p>
          <select data-i="${i}"><option value="">Elige…</option>${bank.map((b) => `<option>${esc(b)}</option>`).join('')}</select></div>`).join('')}`,
        check: (root) => {
          let c = 0;
          const wrong: string[] = [];
          rows.forEach((r, i) => {
            const sel = root.querySelector<HTMLSelectElement>(`select[data-i="${i}"]`)!;
            const right = sel.value === r.answer;
            sel.classList.toggle('good', right);
            sel.classList.toggle('bad', !right);
            if (right) c++; else wrong.push(`${i + 1}. ${r.answer}`);
          });
          return { c, t: rows.length, fb: wrong.length ? ko('Respuestas correctas de los fallos:') + `<ul class="why">${wrong.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ok() };
        },
      };
    }
    // ---------- gramática ----------
    case 'lesson': {
      const g = lesson(t.gid);
      return {
        info: true,
        html: `<p class="kicker">Gramática</p><h2 class="title">${esc(g.title)}</h2>
        <div class="rule">${g.rule.map((r) => `<p>${esc(r)}</p>`).join('')}</div>
        ${g.examples.map((e) => `<div class="ex-row"><div><b>${esc(e.en)}</b><span class="es">${esc(e.es)}</span></div>${speakBtn(e.en)}</div>`).join('')}`,
      };
    }
    case 'gex': {
      const g = lesson(t.gid);
      const e = g.exercises[t.i];
      if (e.t === 'choice') {
        return {
          html: `<p class="kicker">${esc(g.title)}</p><p class="q">${esc(e.q)}</p>${optionsHtml(e.options)}`,
          pick: (i) => {
            const right = i === e.a;
            return { c: right ? 1 : 0, t: 1, picked: i, correct: e.a, fb: (right ? ok() : ko(`Es <b>${esc(e.options[e.a])}</b>`)) + why(e.why), ask: `${e.q} (respuesta: ${e.options[e.a]}). Explícamelo.` };
          },
        };
      }
      if (e.t === 'gap') {
        return {
          html: `<p class="kicker">${esc(g.title)}</p><p class="q">${esc(e.q)}</p>
          <input class="text" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Escribe la respuesta" />`,
          check: (root) => {
            const v = norm(root.querySelector<HTMLInputElement>('input')!.value);
            const right = e.a.some((a) => norm(a) === v);
            return { c: right ? 1 : 0, t: 1, fb: (right ? ok() : ko(`Es <b>${esc(e.a[0])}</b>`)) + why(e.why), ask: `${e.q} (respuesta: ${e.a[0]}). Explícamelo.` };
          },
        };
      }
      const words = shuffle(e.words);
      return {
        html: `<p class="kicker">Ordena la frase</p><div class="answer-line" data-line></div>
        <div class="chips-bank" data-bank>${words.map((w, i) => `<button class="chip2 btn" data-w="${i}">${esc(w)}</button>`).join('')}</div>`,
        mount: (root) => {
          const line = root.querySelector<HTMLElement>('[data-line]')!;
          const bank = root.querySelector<HTMLElement>('[data-bank]')!;
          root.addEventListener('click', (ev) => {
            const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-w]');
            if (!b) return;
            (b.parentElement === line ? bank : line).appendChild(b);
          });
        },
        check: (root) => {
          const got = [...root.querySelectorAll<HTMLElement>('[data-line] [data-w]')].map((b) => b.textContent!).join(' ');
          const right = norm(got) === norm(e.a);
          return { c: right ? 1 : 0, t: 1, fb: (right ? ok() : ko(`Es: <b>${esc(e.a)}</b>`)) + why(e.why) };
        },
      };
    }
    case 'time': {
      return {
        html: `<p class="kicker">La hora en inglés</p><p class="clock">${fmtTime(t.h, t.m)}</p>${optionsHtml(t.opts)}`,
        pick: (i) => {
          const good = t.opts.indexOf(timeWords(t.h, t.m));
          const right = i === good;
          return { c: right ? 1 : 0, t: 1, picked: i, correct: good, fb: right ? ok() : ko(`${fmtTime(t.h, t.m)} = <b>${esc(timeWords(t.h, t.m))}</b>`) };
        },
        mount: () => { /* nada */ },
      };
    }
    case 'dialogue': {
      const d = dialogue(t.did);
      return {
        info: true,
        html: `<p class="kicker">Diálogo</p><h2 class="title">${esc(d.title)}</h2><p class="note left">${esc(d.situation)}</p>
        <div class="center"><button class="btn primary" data-play-dialogue="${d.id}">▶ Escuchar el diálogo</button></div>
        ${d.lines.map((l) => `<div class="dline"><b>${esc(l.who)}</b>
          <div class="tap" data-tr><span class="enl">${esc(l.en)}</span><span class="esl" hidden>${esc(l.es)}</span></div>${speakBtn(l.en)}</div>`).join('')}
        <p class="note">Toca una frase para ver la traducción.</p>`,
        mount: (root) => {
          root.querySelector<HTMLElement>('[data-play-dialogue]')!.onclick = () => void speakScript(d.lines.map((l) => ({ who: l.who, text: l.en })), Object.fromEntries([...new Set(d.lines.map((l) => l.who))].map((w, i) => [w, i % 2 ? 'f' : 'm'])));
          root.querySelectorAll<HTMLElement>('[data-tr]').forEach((el) => {
            el.onclick = () => { const e = el.querySelector<HTMLElement>('.esl')!; e.hidden = !e.hidden; };
          });
        },
      };
    }
    // ---------- writing ----------
    case 'write': {
      const w = writing(t.wid);
      const parts = w.parts ?? [{ id: 'main', label: '', must: w.must ?? [], model: w.model ?? '' }];
      const ph = w.kind === 'dialogue' ? 'Receptionist: …\nCandidate: …' : 'Escribe aquí en inglés…';
      return {
        checkLabel: 'Terminar y revisar',
        html: `<p class="kicker">Writing · ${esc(raInfo[w.ra[0]].name)}</p><h2 class="title sm">${esc(w.title)}</h2>
        <p class="q small">${esc(w.prompt)}</p>
        ${w.plan ? `<details class="passage"><summary>Ver plano del edificio</summary><p>${esc(w.plan)}</p></details>` : ''}
        <ul class="bul">${w.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        ${parts.map((p) => `${p.label ? `<p class="q small"><b>${esc(p.label)}</b></p>` : ''}
          <textarea class="text area big" data-part="${p.id}" rows="${w.kind === 'composition' || w.kind === 'email' ? 9 : 7}" placeholder="${esc(ph)}"></textarea>`).join('')}
        <div class="counter" data-counter></div>
        <div class="live" data-live></div>
        <div class="model" data-model hidden></div>`,
        mount: (root) => {
          const texts = () => Object.fromEntries([...root.querySelectorAll<HTMLTextAreaElement>('textarea')].map((a) => [a.dataset.part!, a.value]));
          const update = () => {
            const tx = texts();
            const all = Object.values(tx).join('\n');
            const n = wordCount(all);
            const lines = all.split('\n').filter((l) => l.trim()).length;
            const c = root.querySelector<HTMLElement>('[data-counter]')!;
            c.textContent = w.min ? `${n} palabras (objetivo ${w.min}–${w.max})` : w.minLines ? `${lines} líneas (objetivo ${w.minLines}–${w.maxLines})` : `${n} palabras`;
            c.className = 'counter ' + ((w.min && n >= w.min && n <= w.max!) || (w.minLines && lines >= w.minLines && lines <= w.maxLines!) ? 'good' : '');
            root.querySelector<HTMLElement>('[data-live]')!.innerHTML = feedbackHtml(w, tx).html;
          };
          root.addEventListener('input', update);
          update();
        },
        check: (root) => {
          const tx = Object.fromEntries([...root.querySelectorAll<HTMLTextAreaElement>('textarea')].map((a) => [a.dataset.part!, a.value]));
          const res = feedbackHtml(w, tx);
          const m = root.querySelector<HTMLElement>('[data-model]')!;
          if (!exam) {
            m.hidden = false;
            m.innerHTML = '<b>Respuesta modelo</b>' + parts.map((p) => `${p.label ? `<p><b>${esc(p.label)}</b></p>` : ''}<p class="pre">${esc(p.model)}</p>`).join('');
          }
          const all = Object.values(tx).join('\n');
          return { c: res.c, t: res.t, fb: `<div class="fb-line ${res.c === res.t ? 'ok' : 'ko'}">${res.c}/${res.t} puntos del checklist</div>`, ask: `Corrige mi redacción (${w.title}) y explícame los errores en español:\n\n${all}` };
        },
      };
    }
  }
}
