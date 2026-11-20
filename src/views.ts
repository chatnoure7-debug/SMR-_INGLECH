import { dayKey, addDays, daysLeft, raGrade, state, streak, today } from './store';
import { dialogues, exSets, items, lessons, listenings, raInfo, readings, topics, writings, item } from './content';
import { dueIds, learnedCount, weakIds } from './srs';
import { newItemsLeft } from './plan';
import { providerInfo } from './ai';
import { esc } from './util';

export type Route = 'today' | 'study' | 'exam' | 'progress' | 'tutor' | 'settings';

const card = (act: string, arg: string, title: string, sub: string): string =>
  `<button class="row-card" data-act="${act}" data-arg="${esc(arg)}"><div><b>${esc(title)}</b><span>${esc(sub)}</span></div><i>›</i></button>`;

function ring(pct: number, mins: number, goal: number): string {
  const r = 52, c = 2 * Math.PI * r;
  return `<div class="ring" role="img" aria-label="${mins} minutos de ${goal}">
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" class="ring-bg"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.min(1, pct))).toFixed(1)}" transform="rotate(-90 60 60)"/></svg>
    <div class="ring-txt"><b>${mins}</b><span>de ${goal} min</span></div></div>`;
}

export function todayView(): string {
  const log = today();
  const goal = state.settings.goalMin;
  const mins = Math.floor(log.seconds / 60);
  const sess = state.session && state.session.date === dayKey() ? state.session : null;
  const due = dueIds(999).length;
  const left = newItemsLeft();
  const dl = daysLeft();
  const covered = Math.ceil(left / Math.max(1, state.settings.newPerDay));
  const pace = dl > 0 ? Math.max(1, Math.ceil(left / dl)) : left;
  const msg = mins >= goal ? '¡Objetivo del día cumplido! Lo que hagas ahora es extra.'
    : mins > 0 ? `Llevas ${mins} min. Es un objetivo orientativo: si hoy no llegas, no pasa nada.`
      : 'Hoy aún no has estudiado. Con unos minutos ya cuenta para tu racha.';
  const btn = sess ? `Continuar sesión (${sess.idx}/${sess.tasks.length})` : log.done > 0 ? 'Otra sesión' : 'Empezar sesión';
  return `<h1>Hoy</h1><p class="sub">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div class="panel goal">${ring(log.seconds / (goal * 60), mins, goal)}<p>${msg}</p></div>
    <button class="btn primary big" data-act="daily">${btn}</button>
    <p class="note">Puedes parar cuando quieras: el progreso se guarda.</p>
    <div class="stats">
      <div class="stat"><b>${streak()}</b><span>días de racha</span></div>
      <div class="stat"><b>${dl}</b><span>días hasta el final</span></div>
      <div class="stat"><b>${learnedCount()}</b><span>palabras dominadas</span></div></div>
    <div class="panel"><b>Plan hasta el final</b>
      <p class="small">Te quedan <b>${left}</b> palabras nuevas. Ritmo recomendado: <b>${pace}</b> al día. Con ${state.settings.newPerDay} al día tienes contenido para ${covered} días${covered < dl ? ' (hay que añadir más material en la Fase 5)' : ''}.</p>
      <p class="small">${due} tarjetas para repasar hoy.</p></div>
    <div class="row"><button class="btn wide" data-act="practice" data-arg="weak">Mis fallos</button>
      <button class="btn wide" data-act="practice" data-arg="spell">Spelling</button></div>`;
}

export function studyView(): string {
  const tops = topics().map((t) => card('practice', `topic:${t.id}`, t.name, `${t.count} palabras`)).join('');
  const ex = [
    card('practice', 'due', 'Repaso de hoy', `${dueIds(999).length} tarjetas`),
    card('practice', 'weak', 'Mis fallos', `${weakIds(99).length} palabras`),
    card('practice', 'spell', 'Spelling', 'Escucha y escribe'),
    card('practice', 'defs', 'Definición → término', 'Como el examen'),
    card('practice', 'es2en', 'Español → inglés', '12 preguntas'),
    card('practice', 'time', 'La hora', '8 relojes'),
    card('practice', 'topic:*', 'Todo mezclado', `${items.length} palabras`),
  ].join('');
  return `<h1>Estudiar</h1><p class="sub">Todo lo que quieras, sin límite de tiempo.</p>
    <h2>Práctica rápida</h2>${ex}
    <details class="acc"><summary>Vocabulario por tema</summary>${tops}</details>
    <details class="acc"><summary>Lecturas (${readings.length})</summary>${readings.map((r) => card('practice', `reading:${r.id}`, r.title, `${r.level} · ${r.module}`)).join('')}</details>
    <details class="acc"><summary>Listening (${listenings.length})</summary>${listenings.map((l) => card('practice', `listening:${l.id}`, l.title, l.level)).join('')}</details>
    <details class="acc"><summary>Gramática (${lessons.length})</summary>${lessons.map((g) => card('practice', `lesson:${g.id}`, g.title, `${g.exercises.length} ejercicios`)).join('')}</details>
    <details class="acc"><summary>Diálogos (${dialogues.length})</summary>${dialogues.map((d) => card('practice', `dialogue:${d.id}`, d.title, d.situation)).join('')}</details>
    <details class="acc"><summary>Ejercicios tipo examen (${exSets.length})</summary>${exSets.map((e) => card('practice', `set:${e.id}`, e.title, e.kind === 'match' ? 'Emparejar' : e.kind === 'wordbank' ? 'Word bank' : 'Rellenar huecos')).join('')}</details>
    <details class="acc"><summary>Writing (${writings.length})</summary>${writings.map((w) => card('practice', `write:${w.id}`, w.title, w.kind)).join('')}</details>`;
}

export function examView(): string {
  const hist = state.exams.slice(-5).reverse().map((e) =>
    `<div class="ra"><span>${e.date}</span><span>${e.mode === 'it' ? 'English for IT' : 'B1 profesora'}</span><em class="${e.avg >= 5 ? 'pass' : 'fail'}">${e.avg.toFixed(1)}</em></div>`).join('');
  return `<h1>Examen</h1><p class="sub">Simulacro con el formato real. No ves las soluciones hasta el final.</p>
    ${card('exam', 'it', 'English for IT', 'Listening · Reading · Vocabulary · Writing')}
    ${card('exam', 'b1', 'Modelo B1 (profesora)', 'Reading · Vocabulary · Situaciones · Listening')}
    <h2>Últimos resultados</h2><div class="panel">${hist || '<p class="small">Aún no has hecho ningún examen.</p>'}</div>`;
}

export function progressView(): string {
  const days = Array.from({ length: 7 }, (_, i) => addDays(dayKey(), i - 6));
  const mins = days.map((d) => Math.round((state.history[d]?.seconds ?? 0) / 60));
  const max = Math.max(state.settings.goalMin, ...mins);
  const bars = days.map((d, i) => `<div class="wk"><i style="height:${Math.max(3, (mins[i] / max) * 100)}%"></i><span>${mins[i]}</span><small>${new Date(d + 'T12:00').toLocaleDateString('es-ES', { weekday: 'narrow' })}</small></div>`).join('');
  const total = Object.values(state.history).reduce((a, h) => a + h.seconds, 0);
  const ras = Object.entries(raInfo).map(([ra, v]) => {
    const g = raGrade(ra);
    return `<div class="ra"><span class="chip" style="--c:${v.color}">${ra}</span><span>${esc(v.name)}</span>
      <em class="${g === null ? '' : g >= 5 ? 'pass' : 'fail'}">${g === null ? 'sin datos' : g.toFixed(1)}</em></div>`;
  }).join('');
  const weak = weakIds(8).map((id) => `<div class="ra"><span>${esc(item(id).en)}</span><em>${esc(item(id).es)}</em></div>`).join('');
  return `<h1>Progreso</h1>
    <div class="stats"><div class="stat"><b>${streak()}</b><span>racha</span></div>
      <div class="stat"><b>${(total / 3600).toFixed(1)}</b><span>horas en total</span></div>
      <div class="stat"><b>${Object.keys(state.cards).length}</b><span>palabras vistas</span></div></div>
    <h2>Últimos 7 días (minutos)</h2><div class="panel weeks">${bars}</div>
    <h2>Nota estimada por RA</h2><div class="panel">${ras}<p class="note left">Para aprobar, cada RA debe llegar a 5. Se calcula con tus últimos resultados.</p></div>
    <h2>Palabras que más fallas</h2><div class="panel">${weak || '<p class="small">Todavía no hay fallos registrados.</p>'}</div>
    <button class="btn big" data-act="goto" data-arg="settings">⚙ Ajustes y copia de seguridad</button>`;
}

const seg = (key: string, val: string, label: string, cur: string): string =>
  `<button class="seg ${cur === val ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${val}">${label}</button>`;

export function settingsView(): string {
  const s = state.settings;
  return `<button class="btn ghost" data-act="goto" data-arg="progress">‹ Progreso</button><h1>Ajustes</h1>
    <label>Tema</label><div class="segs">${seg('theme', 'auto', 'Auto', s.theme)}${seg('theme', 'light', 'Claro', s.theme)}${seg('theme', 'dark', 'Oscuro', s.theme)}${seg('theme', 'black', 'Negro', s.theme)}</div>
    <label>Color</label><div class="segs">${seg('accent', 'blue', 'Azul', s.accent)}${seg('accent', 'green', 'Verde', s.accent)}</div>
    <label>Voz</label><div class="segs">${seg('voice', 'en-GB', 'Británico', s.voice)}${seg('voice', 'en-US', 'Americano', s.voice)}</div>
    <label>Velocidad de la voz: <b data-out="rate">${s.rate.toFixed(2)}</b></label>
    <input type="range" min="0.5" max="1.2" step="0.05" value="${s.rate}" data-set="rate" />
    <label>Objetivo diario orientativo: <b data-out="goalMin">${s.goalMin}</b> min (no es obligatorio)</label>
    <input type="range" min="10" max="120" step="5" value="${s.goalMin}" data-set="goalMin" />
    <label>Palabras nuevas por sesión: <b data-out="newPerDay">${s.newPerDay}</b></label>
    <input type="range" min="3" max="15" step="1" value="${s.newPerDay}" data-set="newPerDay" />
    <label>Fin de curso</label><input type="date" value="${s.endDate}" data-set="endDate" />
    <label>Recordatorio diario</label>
    <div class="row"><label class="chk inline"><input type="checkbox" data-set="reminderOn" ${s.reminderOn ? 'checked' : ''} /> Activado</label>
      <input type="time" value="${s.reminderTime}" data-set="reminderTime" /></div>
    <h2 style="margin-top:24px">Copia de seguridad</h2>
    <p class="small">No incluye tu clave de la IA.</p>
    <div class="row"><button class="btn wide" data-act="copy">Copiar</button><button class="btn wide" data-act="download">Descargar</button></div>
    <label>Restaurar (pega el texto o elige el archivo)</label>
    <textarea class="text area" id="import-text" rows="3" placeholder="Pega aquí la copia…"></textarea>
    <div class="row"><button class="btn wide" data-act="import">Restaurar</button>
      <label class="btn wide filebtn">Archivo…<input type="file" id="import-file" accept=".json,application/json" hidden /></label></div>
    <button class="btn big danger" data-act="reset" style="margin-top:24px">Borrar todo mi progreso</button>`;
}

function md(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}

export function tutorView(draft: string, busy: boolean, error: string): string {
  const ai = state.ai;
  const has = !!ai.apiKey.trim();
  const cfg = `<details class="acc" ${has ? '' : 'open'}><summary>Configuración de la IA</summary><div class="panel">
    <p class="small">Pega tu propia clave de API. Se guarda solo en este móvil, no va a GitHub ni a las copias de seguridad. Cada pregunta la paga tu cuenta del proveedor.</p>
    <label>Proveedor</label><div class="segs wrap">${(['anthropic', 'openai', 'gemini', 'custom'] as const).map((p) => `<button class="seg ${ai.provider === p ? 'on' : ''}" data-act="provider" data-val="${p}">${providerInfo[p].name}</button>`).join('')}</div>
    <label>Clave de API <small>${esc(providerInfo[ai.provider].hint)}</small></label>
    <input class="text" type="password" autocomplete="off" data-ai="apiKey" value="${esc(ai.apiKey)}" placeholder="Pega la clave aquí" />
    <label>Modelo</label><input class="text" data-ai="model" value="${esc(ai.model)}" placeholder="${esc(providerInfo[ai.provider].model)}" />
    ${ai.provider === 'custom' ? `<label>URL base (…/v1)</label><input class="text" data-ai="baseUrl" value="${esc(ai.baseUrl)}" placeholder="https://…/v1" />` : ''}
    </div></details>`;
  const quick = ['Corrige esta frase: ', 'Explícame la diferencia entre ', 'Dame 5 frases con ', '¿Cómo se dice en inglés: '];
  const msgs = state.chat.map((m) => `<div class="bubble ${m.role}">${md(m.content)}</div>`).join('');
  return `<h1>Tutor IA</h1><p class="sub">Pregúntale lo que quieras sobre inglés técnico y gramática.</p>${cfg}
    ${has ? `<div class="chat" id="chat">${msgs || '<p class="note">Escribe una duda o pulsa un atajo.</p>'}${busy ? '<div class="bubble assistant">…</div>' : ''}</div>
    ${error ? `<div class="hint-box">${esc(error)}</div>` : ''}
    <div class="quick">${quick.map((q) => `<button class="chip2 btn" data-act="quick" data-arg="${esc(q)}">${esc(q.trim())}</button>`).join('')}</div>
    <textarea class="text area" id="tutor-in" rows="3" placeholder="Escribe aquí (en español o inglés)…">${esc(draft)}</textarea>
    <div class="row"><button class="btn primary wide" data-act="send" ${busy ? 'disabled' : ''}>Enviar</button>
      <button class="btn" data-act="clearchat">Borrar chat</button></div>`
      : '<p class="note">Añade tu clave para activar el tutor. El resto de la app funciona sin ella y sin internet.</p>'}`;
}

export const tabs: { id: Route; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoy', icon: '<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>' },
  { id: 'study', label: 'Estudiar', icon: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>' },
  { id: 'exam', label: 'Examen', icon: '<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>' },
  { id: 'progress', label: 'Progreso', icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  { id: 'tutor', label: 'Tutor', icon: '<path d="M4 5h16v11H9l-5 4z"/>' },
];
