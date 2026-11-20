import './style.css';
import { applyTheme } from './theme';
import { applyReminder } from './notify';
import { dayKey, exportJson, importJson, save, state, defaults } from './store';
import { examB1, examIT, practice, sessionTasks } from './plan';
import { startRunner } from './runner';
import { askAi, providerInfo } from './ai';
import { speak } from './tts';
import { examView, progressView, settingsView, studyView, tabs, todayView, tutorView, type Route } from './views';
import type { Provider, TaskWithStep } from './types';

const app = document.getElementById('app')!;
let route: Route = 'today';
let draft = '';
let busy = false;
let aiError = '';

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

function paint(keepScroll = false): void {
  const prev = document.querySelector<HTMLElement>('.screen')?.scrollTop ?? 0;
  const view = route === 'today' ? todayView() : route === 'study' ? studyView() : route === 'exam' ? examView()
    : route === 'progress' ? progressView() : route === 'settings' ? settingsView() : tutorView(draft, busy, aiError);
  const tab = route === 'settings' ? 'progress' : route;
  app.innerHTML = `<div class="screen">${view}</div><nav class="tabbar">${tabs.map((t) =>
    `<button class="tab ${t.id === tab ? 'on' : ''}" data-tab="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg>${t.label}</button>`).join('')}</nav>`;
  const sc = document.querySelector<HTMLElement>('.screen')!;
  if (keepScroll) sc.scrollTop = prev;
  if (route === 'tutor') { const c = document.getElementById('chat'); if (c) c.scrollTop = c.scrollHeight; }
}

function run(title: string, tasks: TaskWithStep[], kind: 'daily' | 'practice' | 'exam', extra: { startIdx?: number; examMode?: 'it' | 'b1' } = {}): void {
  if (!tasks.length) { toast('No hay nada que practicar aquí todavía'); return; }
  startRunner({
    title, tasks, kind, ...extra,
    onExit: () => paint(),
    onMore: kind === 'exam' ? undefined : () => startDaily(true),
    onAsk: (q) => { route = 'tutor'; draft = q; aiError = ''; paint(); },
  });
}
function startDaily(forceNew = false): void {
  const s = state.session;
  if (!forceNew && s && s.date === dayKey() && s.idx < s.tasks.length) { run('Sesión de hoy', s.tasks, 'daily', { startIdx: s.idx }); return; }
  const tasks = sessionTasks();
  state.session = { date: dayKey(), tasks, idx: 0 };
  save();
  run('Sesión de hoy', tasks, 'daily');
}

async function send(): Promise<void> {
  const ta = document.getElementById('tutor-in') as HTMLTextAreaElement | null;
  const text = (ta?.value ?? draft).trim();
  if (!text || busy) return;
  draft = ''; aiError = ''; busy = true;
  state.chat.push({ role: 'user', content: text });
  if (state.chat.length > 40) state.chat.splice(0, state.chat.length - 40);
  save(); paint();
  try {
    const reply = await askAi(state.chat.slice(-12));
    state.chat.push({ role: 'assistant', content: reply });
  } catch (e) {
    aiError = e instanceof Error ? e.message : 'Error desconocido';
    draft = text;
    state.chat.pop();
  }
  busy = false; save(); paint();
}

const actions: Record<string, (el: HTMLElement) => void> = {
  daily: () => startDaily(),
  practice: (el) => { const p = practice(el.dataset.arg!); run(p.title, p.tasks, 'practice'); },
  exam: (el) => {
    const mode = el.dataset.arg === 'b1' ? 'b1' : 'it';
    run(mode === 'it' ? 'English for IT' : 'Modelo B1', mode === 'it' ? examIT() : examB1(), 'exam', { examMode: mode });
  },
  goto: (el) => { route = el.dataset.arg as Route; paint(); },
  set: (el) => {
    const { key, val } = el.dataset as { key: string; val: string };
    (state.settings as unknown as Record<string, unknown>)[key] = val;
    save(); applyTheme(); paint(true);
  },
  provider: (el) => {
    const p = el.dataset.val as Provider;
    state.ai.provider = p;
    state.ai.model = providerInfo[p].model;
    save(); paint(true);
  },
  quick: (el) => { draft = el.dataset.arg ?? ''; paint(true); (document.getElementById('tutor-in') as HTMLTextAreaElement | null)?.focus(); },
  send: () => void send(),
  clearchat: () => { state.chat = []; save(); paint(); },
  copy: () => {
    void navigator.clipboard?.writeText(exportJson()).then(() => toast('Copia en el portapapeles'), () => toast('No se pudo copiar'));
  },
  download: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    a.download = `smr-english-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  import: () => {
    const v = (document.getElementById('import-text') as HTMLTextAreaElement).value.trim();
    if (importJson(v)) { applyTheme(); toast('Copia restaurada'); paint(); } else toast('Texto no válido');
  },
  reset: () => {
    if (!confirm('¿Borrar TODO tu progreso? No se puede deshacer.')) return;
    const key = state.ai.apiKey;
    Object.assign(state, structuredClone(defaults));
    state.ai.apiKey = key;
    save(); applyTheme(); paint();
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target as HTMLElement;
  if (document.querySelector('.runner')) {
    // Dentro de la sesión solo gestionamos audio y giro de tarjetas; el resto lo hace el runner.
    const sp = el.closest<HTMLElement>('[data-speak]');
    if (sp) { void speak(sp.dataset.speak!); return; }
    const fl = el.closest<HTMLElement>('[data-flip]');
    if (fl) fl.classList.toggle('flipped');
    return;
  }
  const tab = el.closest<HTMLElement>('[data-tab]');
  if (tab) { route = tab.dataset.tab as Route; paint(); return; }
  const sp = el.closest<HTMLElement>('[data-speak]');
  if (sp) { void speak(sp.dataset.speak!); return; }
  const a = el.closest<HTMLElement>('[data-act]');
  if (a) actions[a.dataset.act!]?.(a);
});
document.addEventListener('keydown', (ev) => {
  const el = ev.target as HTMLElement;
  if ((ev.key === 'Enter' || ev.key === ' ') && el.matches?.('[data-flip]')) { ev.preventDefault(); el.classList.toggle('flipped'); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.id === 'tutor-in') { draft = el.value; return; }
  if (el.dataset.set && el.type === 'range') {
    const out = document.querySelector<HTMLElement>(`[data-out="${el.dataset.set}"]`);
    if (out) out.textContent = el.dataset.set === 'rate' ? Number(el.value).toFixed(2) : el.value;
  }
  if (el.dataset.ai) { (state.ai as unknown as Record<string, string>)[el.dataset.ai] = el.value; save(); }
});
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.id === 'import-file' && el.files?.[0]) {
    void el.files[0].text().then((t) => { if (importJson(t)) { applyTheme(); toast('Copia restaurada'); paint(); } else toast('Archivo no válido'); });
    return;
  }
  const key = el.dataset.set;
  if (!key) return;
  const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
  (state.settings as unknown as Record<string, unknown>)[key] = v;
  save();
  if (key === 'reminderOn' || key === 'reminderTime') void applyReminder().then((okp) => { if (!okp) toast('Falta el permiso de notificaciones'); });
});

applyTheme();
paint();
if (state.settings.reminderOn) void applyReminder();
