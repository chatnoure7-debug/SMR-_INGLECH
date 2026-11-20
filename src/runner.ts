import type { Rendered, Result, Task, TaskWithStep } from './types';
import { raOf, render } from './tasks';
import { addStat, dayKey, save, state, today, type ExamRecord } from './store';
import { grade, introduce } from './srs';
import { esc, fmtMin } from './util';
import { listening, raInfo } from './content';
import { speakScript, stopSpeaking } from './tts';

export interface RunOpts {
  title: string;
  tasks: TaskWithStep[];
  kind: 'daily' | 'practice' | 'exam';
  examMode?: 'it' | 'b1';
  startIdx?: number;
  onExit: () => void;
  onMore?: () => void;
  onAsk: (q: string) => void;
}

interface Logged { ra: string[]; c: number; t: number; step: string; fb: string }

const IDLE_MS = 120000; // pasado este tiempo sin tocar la pantalla, el reloj se para

export function startRunner(o: RunOpts): void {
  const app = document.getElementById('app')!;
  const exam = o.kind === 'exam';
  const tasks: TaskWithStep[] = [...o.tasks];
  let idx = o.startIdx ?? 0;
  let cur: Rendered | null = null;
  let answered = false;
  let lastAsk = '';
  let lastActive = Date.now();
  let finished = false;
  const log: Logged[] = [];
  const requeued = new Set<string>();
  const sec0 = today().seconds;
  let ok = 0, tot = 0;

  app.innerHTML = `<div class="runner">
    <header class="r-head"><button class="btn ghost" data-r="exit" aria-label="Salir">✕</button>
      <div class="r-title" id="r-title"></div><div class="deck-count" id="r-count"></div></header>
    <div class="bar"><i id="r-bar"></i></div>
    <main class="r-body" id="r-body"></main>
    <div class="r-fb" id="r-fb" aria-live="polite"></div>
    <footer class="r-foot"><button class="btn primary big" id="r-main" data-r="main"></button></footer></div>`;
  const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
  const body = $('r-body'), fbEl = $('r-fb'), mainBtn = $<HTMLButtonElement>('r-main');

  const touch = (): void => { lastActive = Date.now(); };
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastActive < IDLE_MS) {
      today().seconds++;
      if (today().seconds % 10 === 0) save();
    }
  }, 1000);
  app.addEventListener('pointerdown', touch);
  app.addEventListener('keydown', touch);
  app.addEventListener('input', touch);

  function persist(): void {
    if (o.kind === 'daily') { state.session = { date: dayKey(), tasks, idx }; }
    save();
  }
  function requeue(t: Task & { id?: string }): void {
    const id = (t as { id?: string }).id;
    if (!id || requeued.has(id)) return;
    requeued.add(id);
    tasks.splice(Math.min(idx + 4, tasks.length), 0, { k: 'card', id, mode: 'review', step: 'Repetir fallo' } as TaskWithStep);
  }

  function show(): void {
    if (idx >= tasks.length) { finish(); return; }
    const t = tasks[idx];
    cur = render(t, exam);
    answered = false;
    fbEl.innerHTML = '';
    body.innerHTML = cur.html;
    body.scrollTop = 0;
    $('r-title').textContent = t.step ?? o.title;
    $('r-count').textContent = `${idx + 1}/${tasks.length}`;
    $('r-bar').style.width = `${(idx / tasks.length) * 100}%`;
    mainBtn.hidden = false;
    if (cur.info) mainBtn.textContent = 'Continuar';
    else if (cur.check) mainBtn.textContent = cur.checkLabel ?? 'Comprobar';
    else mainBtn.hidden = true;
    cur.mount?.(body);
  }

  function lock(): void {
    body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input.text, textarea').forEach((e) => { e.readOnly = true; });
    body.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('.opt, [data-w], select, input[type=checkbox]').forEach((b) => { b.disabled = true; });
  }

  function handle(res: Result): void {
    const t = tasks[idx];
    answered = true;
    const ras = raOf(t);
    if (!res.skipStats) {
      ras.forEach((ra) => addStat(ra, res.c, res.t));
      ok += res.c; tot += res.t;
    }
    const d = today();
    d.done++;
    if (!res.skipStats) { d.correct += res.c; d.total += res.t; }
    if (t.k === 'def' || t.k === 'es2en' || t.k === 'spell') {
      grade(t.id, res.c === res.t);
      if (res.c < res.t) requeue(t);
    }
    log.push({ ra: ras, c: res.c, t: res.t, step: t.step ?? o.title, fb: res.fb });
    lock();
    if (exam) {
      fbEl.innerHTML = '<div class="fb-line">Respuesta guardada. Verás todo al final.</div>';
    } else {
      const ask = state.ai.apiKey && res.ask
        ? `<button class="btn ghost" data-r="ask">🤖 Preguntar al tutor</button>` : '';
      lastAsk = res.ask ?? '';
      fbEl.innerHTML = `<div class="fb">${res.fb}${ask}</div>`;
    }
    mainBtn.hidden = false;
    mainBtn.textContent = 'Siguiente';
    persist();
    fbEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function next(): void {
    stopSpeaking();
    idx++;
    persist();
    show();
  }

  function finishInfo(t: Task): void {
    const d = today();
    d.done++;
    const id = t.k === 'read' ? t.rid : t.k === 'listen' ? t.lid : t.k === 'dialogue' ? t.did : t.k === 'lesson' ? t.gid : '';
    if (id) state.readCount[id] = (state.readCount[id] ?? 0) + 1;
  }

  function onClick(ev: Event): void {
    const el = ev.target as HTMLElement;
    const pickBtn = el.closest<HTMLElement>('[data-pick]');
    if (pickBtn && cur?.pick && !answered) {
      const res = cur.pick(Number(pickBtn.dataset.pick));
      const opts = body.querySelectorAll<HTMLElement>('.opt');
      if (res.correct !== undefined) opts[res.correct]?.classList.add('right');
      if (res.picked !== undefined && res.picked !== res.correct) opts[res.picked]?.classList.add('wrong');
      handle(res);
      return;
    }
    const done = el.closest<HTMLElement>('[data-done]');
    if (done && !answered) {
      const t = tasks[idx];
      if (t.k !== 'card') return;
      const v = done.dataset.done;
      answered = true;
      today().done++;
      if (t.mode === 'new') introduce(t.id);
      else if (v === '0') { grade(t.id, false); requeue(t); }
      else if (v === '1') grade(t.id, true);
      log.push({ ra: raOf(t), c: 0, t: 0, step: t.step ?? o.title, fb: '' });
      next();
      return;
    }
    const rep = el.closest<HTMLElement>('[data-replay]');
    if (rep) {
      const l = listening(rep.dataset.replay!);
      void speakScript(l.script, l.voices);
      return;
    }
    const act = el.closest<HTMLElement>('[data-r]')?.dataset.r;
    if (act === 'exit') { exit(); return; }
    if (act === 'ask') { const q = lastAsk; exit(); o.onAsk(q); return; }
    if (act === 'main' && cur) {
      if (answered || cur.info) {
        if (!answered && cur.info) finishInfo(tasks[idx]);
        next();
      } else if (cur.check) {
        const res = cur.check(body);
        if (res) handle(res);
      }
      return;
    }
    if (act === 'more') { teardown(); o.onMore?.(); return; }
    if (act === 'home') { teardown(); o.onExit(); }
  }
  app.addEventListener('click', onClick);

  function teardown(): void {
    window.clearInterval(timer);
    app.removeEventListener('click', onClick);
    app.removeEventListener('pointerdown', touch);
    app.removeEventListener('keydown', touch);
    app.removeEventListener('input', touch);
    stopSpeaking();
    save();
  }
  function exit(): void { teardown(); o.onExit(); }

  function finish(): void {
    if (finished) return;
    finished = true;
    window.clearInterval(timer);
    stopSpeaking();
    if (o.kind === 'daily') state.session = null;
    const mins = Math.round((today().seconds - sec0) / 60);
    const dayMin = Math.round(today().seconds / 60);
    const pct = tot ? Math.round((ok / tot) * 100) : null;
    let html: string;
    if (exam) {
      const by: Record<string, [number, number]> = {};
      for (const l of log) for (const ra of l.ra) { const a = (by[ra] ??= [0, 0]); a[0] += l.c; a[1] += l.t; }
      const grades: Record<string, number> = {};
      Object.entries(by).forEach(([ra, [c, t]]) => { if (t) grades[ra] = Math.round((c / t) * 100) / 10; });
      const vals = Object.values(grades);
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
      const rec: ExamRecord = { date: dayKey(), mode: o.examMode ?? 'it', grades, avg };
      state.exams.push(rec);
      if (state.exams.length > 20) state.exams.shift();
      const rows = Object.keys(raInfo).filter((ra) => ra in grades).map((ra) => {
        const g = grades[ra];
        return `<div class="ra"><span class="chip" style="--c:${raInfo[ra].color}">${ra}</span><span>${esc(raInfo[ra].name)}</span>
          <em class="${g >= 5 ? 'pass' : 'fail'}">${g.toFixed(1)} · ${g >= 5 ? 'Aprobado' : 'Suspenso'}</em></div>`;
      }).join('');
      const bad = log.filter((l) => l.t > 0 && l.c < l.t).slice(0, 12)
        .map((l) => `<div class="mistake"><b>${esc(l.step)}</b>${l.fb}</div>`).join('');
      html = `<h1>Resultado del examen</h1><p class="sub">Como el boletín: cada RA debe llegar a 5.</p>
        <div class="panel">${rows || '<p>No hay resultados.</p>'}</div>
        <div class="panel big-grade"><b>${avg.toFixed(1)}</b><span>nota media</span></div>
        ${bad ? `<h2>Para repasar</h2><div class="panel">${bad}</div>` : '<p class="note">Sin fallos. ¡Muy bien!</p>'}`;
    } else {
      html = `<div class="done-emoji" aria-hidden="true">🎉</div><h1>${o.kind === 'daily' ? '¡Sesión terminada!' : '¡Práctica terminada!'}</h1>
        <div class="stats"><div class="stat"><b>${log.length}</b><span>tareas</span></div>
        <div class="stat"><b>${pct === null ? '–' : pct + '%'}</b><span>aciertos</span></div>
        <div class="stat"><b>${fmtMin(Math.max(0, mins) * 60)}</b><span>esta tanda</span></div></div>
        <p class="sub center">Hoy llevas ${dayMin} min de ${state.settings.goalMin}. ${dayMin >= state.settings.goalMin ? '¡Objetivo cumplido!' : 'Si quieres, sigue; si no, lo de hoy ya cuenta.'}</p>`;
    }
    save();
    app.innerHTML = `<div class="runner"><main class="r-body done">${html}</main>
      <footer class="r-foot">${o.onMore ? '<button class="btn big" data-r="more">Seguir estudiando</button>' : ''}
      <button class="btn primary big" data-r="home">Volver</button></footer></div>`;
  }

  show();
}
