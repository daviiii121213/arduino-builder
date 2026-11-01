/* ==========================================================================
   08 — Interface: painéis, propriedades, barras, modais, toasts, menus
   ========================================================================== */
const UI = AS.ui = { panel: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = AS.esc;

/* ---------- ícones (traço 1.6, 20×20) ---------- */
const IC = {
  select: '<path d="M5 3l10 6-4.5 1.2L13 15l-2 1-2.3-4.7L5 14z"/>',
  wall: '<path d="M3 15V5h4v6h10v4z"/>',
  room: '<rect x="3.5" y="4.5" width="13" height="11" rx="1"/><path d="M3.5 9h5V4.5"/>',
  door: '<path d="M4 16h12M6 16V4h6v12"/><path d="M12 4a8 8 0 0 1 0 12" stroke-dasharray="2 2"/>',
  window: '<rect x="3" y="6" width="14" height="8"/><path d="M10 6v8M3 10h14"/>',
  furniture: '<path d="M3 11h14v4H3zM5 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4M4 15v2M16 15v2"/>',
  measure: '<path d="M3 13l10-10 4 4-10 10z"/><path d="M6 10l1.5 1.5M8.5 7.5l1.5 1.5M11 5l1.5 1.5"/>',
  split: '<path d="M3 10h14"/><path d="M10 4v12" stroke-dasharray="2 2"/><circle cx="10" cy="10" r="2"/>',
  pan: '<path d="M10 3v14M3 10h14M10 3l-2 2M10 3l2 2M10 17l-2-2M10 17l2-2M3 10l2-2M3 10l2 2M17 10l-2-2M17 10l-2 2"/>',
  undo: '<path d="M7 7H13a4 4 0 0 1 0 8H8"/><path d="M9 4L6 7l3 3"/>',
  redo: '<path d="M13 7H7a4 4 0 0 0 0 8h5"/><path d="M11 4l3 3-3 3"/>',
  projects: '<path d="M3 6h5l2 2h7v8H3z"/>',
  plan: '<rect x="3" y="3" width="14" height="14"/><path d="M3 10h7v7M10 3v4"/>',
  cube: '<path d="M10 2.5l7 4v7l-7 4-7-4v-7z"/><path d="M3 6.5l7 4 7-4M10 10.5v7"/>',
  rooms: '<path d="M3 3h14v14H3z"/><path d="M3 9h6v8M9 9h8"/>',
  openings: '<rect x="4" y="3" width="12" height="14"/><path d="M4 10h12"/>',
  materials: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/>',
  measures: '<path d="M3 17L17 3"/><path d="M3 13v4h4M13 3h4v4"/>',
  import: '<path d="M10 3v9M6 8l4 4 4-4"/><path d="M4 14v3h12v-3"/>',
  generate: '<path d="M10 2l1.8 4.2L16 8l-4.2 1.8L10 14l-1.8-4.2L4 8l4.2-1.8z"/><path d="M15 13l.8 1.7 1.7.8-1.7.8L15 18l-.8-1.7-1.7-.8 1.7-.8z"/>',
  export: '<path d="M10 13V4M6 8l4-4 4 4"/><path d="M4 14v3h12v-3"/>',
  settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1"/>',
  history: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
  sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"/>',
  moon: '<path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z"/>',
  help: '<circle cx="10" cy="10" r="7.5"/><path d="M7.8 7.8a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.6M10 14.2v.1"/>',
  plus: '<path d="M10 4v12M4 10h12"/>', trash: '<path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/>', copy: '<rect x="7" y="7" width="9" height="9" rx="1"/><path d="M4 13V4h9"/>',
  fit: '<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/>', zoomin: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M9 6.5v5M6.5 9h5"/>', zoomout: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M6.5 9h5"/>',
  save: '<path d="M4 4h10l2 2v10H4z"/><path d="M7 4v4h6V4M7 16v-5h6v5"/>', lock: '<rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/>', eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>', check: '<path d="M4 10.5l4 4 8-9"/>', warn: '<path d="M10 3l8 14H2z"/><path d="M10 8v4M10 14.5v.1"/>', layers: '<path d="M10 3l8 4-8 4-8-4z"/><path d="M2 11l8 4 8-4"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 20 20" aria-hidden="true">${IC[n] || ''}</svg>`;
UI.icon = icon;

/* ---------- toasts / dicas ---------- */
AS.toast = (msg, kind = '') => {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.setAttribute('role', 'status'); el.textContent = msg;
  box.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, kind === 'err' ? 5200 : 2600);
  while (box.children.length > 4) box.firstChild.remove();
};
AS.hint = (t) => { const h = $('#hint'); if (h) h.textContent = t; };

/* ---------- modal ---------- */
UI.modal = (title, html, actions = [], opts = {}) => {
  const m = $('#modal'); m.hidden = false; m.className = 'modal ' + (opts.wide ? 'wide' : '');
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
  const foot = $('#modalFoot'); foot.innerHTML = '';
  for (const a of actions) { const b = document.createElement('button'); b.className = 'btn ' + (a.kind || ''); b.textContent = a.label; b.onclick = async () => { const r = await a.fn?.(); if (r !== false) UI.closeModal(); }; foot.appendChild(b); }
  setTimeout(() => ($('#modalBody input, #modalBody select, #modalBody textarea') || foot.querySelector('.primary') || foot.lastChild)?.focus(), 30);
};
UI.closeModal = () => { $('#modal').hidden = true; };
UI.confirm = (title, msg, okLabel, fn, danger = true) => UI.modal(title, `<p class="mtext">${msg}</p>`, [{ label: 'Cancelar' }, { label: okLabel, kind: danger ? 'danger' : 'primary', fn }]);

/* ---------- menu de contexto ---------- */
UI.contextMenu = (x, y, items) => {
  const m = $('#ctxmenu'); m.innerHTML = '';
  for (const it of items) {
    if (it.sep) { if (m.lastChild && !m.lastChild.classList.contains('sep')) m.insertAdjacentHTML('beforeend', '<div class="sep" role="separator"></div>'); continue; }
    const b = document.createElement('button'); b.className = 'ctx-item' + (it.danger ? ' danger' : ''); b.setAttribute('role', 'menuitem');
    b.innerHTML = `<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}`;
    b.onclick = () => { UI.hideCtx(); it.fn(); }; m.appendChild(b);
  }
  if (m.lastChild?.classList.contains('sep')) m.lastChild.remove();
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.querySelector('button')?.focus();
};
UI.hideCtx = () => { $('#ctxmenu').hidden = true; };

/* ---------- campos de formulário ---------- */
let fid = 0;
const F = UI.f = {
  wrap: (label, inner, cls = '', tip = '') => `<label class="fld ${cls}" ${tip ? `title="${esc(tip)}"` : ''}><span class="fl">${esc(label)}</span>${inner}</label>`,
  len: (id, label, cm, tip = '') => F.wrap(label, `<span class="inp-u"><input id="${id}" class="inp mono" inputmode="decimal" value="${AS.units.fmtNum(cm)}" data-len="1"><i>${AS.units.mode}</i></span>`, '', tip),
  num: (id, label, v, unit = '', step = 1, tip = '') => F.wrap(label, `<span class="inp-u"><input id="${id}" class="inp mono" type="number" step="${step}" value="${+(+v).toFixed(2)}"><i>${unit}</i></span>`, '', tip),
  txt: (id, label, v, ph = '') => F.wrap(label, `<input id="${id}" class="inp" value="${esc(v ?? '')}" placeholder="${esc(ph)}">`, 'wide'),
  sel: (id, label, opts, v, cls = '') => F.wrap(label, `<select id="${id}" class="inp">${opts.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`, cls),
  mat: (id, label, v, cats) => {
    const mats = S.project.materials.filter(m => !cats || cats.includes(m.cat));
    const cur = AS.mat(v);
    return F.wrap(label, `<span class="mat-sel"><i class="sw" style="background:${cur.color}"></i><select id="${id}" class="inp">${mats.map(m => `<option value="${m.id}" ${m.id === v ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}${!v ? '<option value="" selected>Padrão do tipo</option>' : ''}</select></span>`, 'wide');
  },
  color: (id, label, v) => F.wrap(label, `<input id="${id}" type="color" class="inp color" value="${v || '#e8e5e0'}">`),
  check: (id, label, v, tip = '') => `<label class="chk" ${tip ? `title="${esc(tip)}"` : ''}><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><span>${esc(label)}</span></label>`,
  ro: (label, v) => `<div class="fld ro"><span class="fl">${esc(label)}</span><span class="val mono">${v}</span></div>`,
};
/** Liga inputs: map id -> fn(valor). Comprimentos são convertidos para cm. */
UI.bind = (root, map) => {
  for (const [id, fn] of Object.entries(map)) {
    const el = root.querySelector('#' + id); if (!el) continue;
    const ev = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'change';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.len) { v = AS.units.parse(v); if (!isFinite(v) || v <= 0) { AS.toast('Valor inválido. Exemplos: 3,5 · 350cm · 3m50', 'err'); UI.renderProps(); return; } }
      else if (el.type === 'number') { v = parseFloat(v); if (!isFinite(v)) { UI.renderProps(); return; } }
      fn(v, el);
    });
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
  }
};

/* ---------- painel de propriedades ---------- */
UI.renderProps = () => {
  const box = $('#propsBody'); if (!box || !S.project) return;
  const sel = AS.editor.selected();
  const fl = AS.floor();
  let html = '', map = {}, title = 'Propriedades';
  const run = (label, fn) => () => AS.history.run(label, fn);
  if (!sel.length) {
    title = 'Pavimento e projeto';
    const m = AS.metrics(fl);
    html += `<div class="sec"><h4>Pavimento</h4><div class="grid2">${F.txt('pFlName', 'Nome', fl.name)}${F.len('pFlElev', 'Elevação (nível)', fl.elevation || 0.0001, 'Altura do piso deste pavimento em relação ao térreo')}${F.len('pFlH', 'Pé-direito padrão', fl.height)}</div></div>`;
    html += `<div class="sec"><h4>Resumo</h4><div class="kv">
      <span>Área útil</span><b class="mono">${AS.units.fmtArea(m.util)}</b>
      <span>Área pelos eixos</span><b class="mono">${AS.units.fmtArea(m.axis)}</b>
      <span>Construída (aprox.)</span><b class="mono">${AS.units.fmtArea(m.built)}</b>
      <span>Cômodos</span><b class="mono">${m.rooms}</b><span>Paredes</span><b class="mono">${m.walls} · ${AS.units.fmt(m.wallLen)}</b>
      <span>Portas / janelas</span><b class="mono">${m.doors} / ${m.windows}</b><span>Móveis</span><b class="mono">${m.furniture}</b></div></div>`;
    const src = S.project.meta;
    if (src?.assumptions?.length) html += `<div class="sec"><h4>Premissas desta planta</h4><ul class="notes">${src.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`;
    if (src?.source === 'sample') html += `<div class="sec callout warn">${icon('warn')}<div><b>Projeto de exemplo.</b> Não é a sua casa. Importe o PDF da planta em <a href="#" data-open="import">Importar PDF</a>.</div></div>`;
    html += `<div class="sec"><button class="btn block" id="pValidate">${icon('check')} Verificar geometria</button><div id="valOut"></div></div>`;
    html += `<p class="empty-tip">Selecione uma parede, cômodo, porta, janela ou móvel para editar. Dica: use <kbd>W</kbd> para desenhar paredes e <kbd>R</kbd> para cômodos.</p>`;
    map = {
      pFlName: (v) => AS.history.run('Renomear pavimento', () => { fl.name = v || fl.name; }),
      pFlElev: (v) => AS.history.run('Elevação do pavimento', () => { fl.elevation = v < 0.01 ? 0 : v; }),
      pFlH: (v) => AS.history.run('Pé-direito', () => { const old = fl.height; fl.height = v; fl.walls.forEach(w => { if (w.height === old) w.height = v; }); }),
    };
  } else if (sel.length > 1) {
    title = `${sel.length} objetos`;
    const walls = sel.filter(s => s.kind === 'wall');
    const counts = {}; sel.forEach(s => counts[s.kind] = (counts[s.kind] || 0) + 1);
    const nm = { wall: 'paredes', furniture: 'móveis', opening: 'aberturas', room: 'cômodos', dim: 'cotas' };
    html += `<div class="sec"><p class="mtext">${Object.entries(counts).map(([k, n]) => `${n} ${nm[k]}`).join(' · ')}</p></div>`;
    if (walls.length) {
      const w0 = walls[0].o;
      html += `<div class="sec"><h4>Editar ${walls.length} paredes</h4><div class="grid2">${F.len('mT', 'Espessura', w0.thickness)}${F.len('mH', 'Altura', w0.height)}${F.sel('mType', 'Tipo', [{ v: 'interior', l: 'Interna' }, { v: 'exterior', l: 'Externa' }], w0.type)}</div>${F.mat('mMat', 'Material (face interna)', w0.material)}</div>`;
      map.mT = (v) => AS.history.run('Espessura', () => walls.forEach(s => s.o.thickness = v));
      map.mH = (v) => AS.history.run('Altura', () => walls.forEach(s => s.o.height = v));
      map.mType = (v) => AS.history.run('Tipo de parede', () => walls.forEach(s => s.o.type = v));
      map.mMat = (v) => AS.history.run('Material', () => walls.forEach(s => s.o.material = v));
    }
    html += UI.selActions(sel);
  } else {
    const { kind, o } = sel[0];
    if (kind === 'wall') {
      title = 'Parede';
      const L = AS.wallLen(o), ang = ((AS.deg(Math.atan2(-(o.b.y - o.a.y), o.b.x - o.a.x)) % 360) + 360) % 360;
      html += `<div class="sec"><div class="grid2">${F.len('wL', 'Comprimento', L, 'Altera a extremidade final mantendo a direção; paredes conectadas acompanham')}${F.num('wAng', 'Ângulo', ang.toFixed(1), '°', 0.5)}${F.len('wT', 'Espessura', o.thickness)}${F.len('wH', 'Altura', o.height)}</div>
        ${F.sel('wType', 'Tipo', [{ v: 'interior', l: 'Interna' }, { v: 'exterior', l: 'Externa' }], o.type, 'wide')}
        ${F.mat('wMat', 'Material — face interna', o.material)}${o.type === 'exterior' ? F.mat('wMatE', 'Material — face externa', o.materialExt || o.material) : ''}</div>
        <div class="sec"><h4>Posição (início → fim)</h4><div class="grid2">${F.len('wAx', 'Início X', o.a.x || 0.0001)}${F.len('wAy', 'Início Y', o.a.y || 0.0001)}${F.len('wBx', 'Fim X', o.b.x || 0.0001)}${F.len('wBy', 'Fim Y', o.b.y || 0.0001)}</div></div>
        ${o.note ? `<div class="sec"><p class="mtext">Nota: ${esc(o.note)}</p></div>` : ''}
        <div class="sec btnrow"><button class="btn sm" id="wDoor">${icon('door')} Porta no meio</button><button class="btn sm" id="wWin">${icon('window')} Janela no meio</button><button class="btn sm" id="wSplit">${icon('split')} Dividir ao meio</button></div>`;
      const setLen = (v) => AS.history.run('Comprimento da parede', () => { const d = AS.wallDir(o), nb = AS.geo.add(o.a, AS.geo.mul(d, v)); const joined = AS.wallsAt(o.b, fl, 1, o.id); o.b = nb; joined.forEach(j => j.w[j.end] = { ...nb }); AS.fixOpenings(); });
      const setPt = (end, ax) => (v) => AS.history.run('Mover extremidade', () => { const old = { ...o[end] }; const joined = AS.wallsAt(old, fl, 1, o.id); o[end][ax] = v < 0.01 && v > 0 ? 0 : v; joined.forEach(j => j.w[j.end] = { ...o[end] }); AS.fixOpenings(); });
      map = {
        wL: setLen, wT: (v) => run('Espessura', () => o.thickness = v)(), wH: (v) => run('Altura da parede', () => o.height = v)(),
        wAng: (v) => AS.history.run('Ângulo da parede', () => { const L2 = AS.wallLen(o), r = -AS.rad(v); const nb = { x: o.a.x + Math.cos(r) * L2, y: o.a.y + Math.sin(r) * L2 }; const joined = AS.wallsAt(o.b, fl, 1, o.id); o.b = nb; joined.forEach(j => j.w[j.end] = { ...nb }); }),
        wType: (v) => run('Tipo de parede', () => { o.type = v; if (v === 'exterior' && !o.materialExt) o.materialExt = 'textura_ext'; })(),
        wMat: (v) => run('Material da parede', () => o.material = v)(), wMatE: (v) => run('Material externo', () => o.materialExt = v)(),
        wAx: setPt('a', 'x'), wAy: setPt('a', 'y'), wBx: setPt('b', 'x'), wBy: setPt('b', 'y'),
      };
    } else if (kind === 'opening') {
      const w = fl.walls.find(x => x.id === o.wallId), L = w ? AS.wallLen(w) : 0, isDoor = o.kind === 'door';
      title = isDoor ? 'Porta' : 'Janela';
      html += `<div class="sec">${F.sel('oType', 'Tipo', (isDoor ? AS.DOOR_TYPES : AS.WINDOW_TYPES).map(t => ({ v: t.id, l: t.name })), o.type, 'wide')}
        <div class="grid2">${F.len('oW', 'Largura', o.width)}${F.len('oH', 'Altura', o.height)}${!isDoor ? F.len('oS', 'Peitoril', o.sill || 0.0001) : ''}${F.len('oPos', 'Distância do início da parede', o.t - o.width / 2 || 0.0001, 'Do início da parede até a borda da abertura')}</div>
        ${F.mat('oMat', isDoor ? 'Material da folha' : 'Vidro', o.material)}${F.mat('oFrame', 'Marco / caixilho', o.frame)}</div>
        <div class="sec btnrow"><button class="btn sm" id="oFlip">Inverter abertura <kbd>F</kbd></button><button class="btn sm" id="oSide">Trocar lado</button></div>
        <div class="sec">${F.ro('Parede (comprimento)', AS.units.fmt(L))}${F.ro('Vão livre', AS.units.fmt(o.width) + ' × ' + AS.units.fmt(o.height))}</div>`;
      map = {
        oType: (v) => run('Tipo de abertura', () => o.type = v)(), oW: (v) => run('Largura da abertura', () => { o.width = v; AS.fixOpenings(); })(),
        oH: (v) => run('Altura da abertura', () => o.height = v)(), oS: (v) => run('Peitoril', () => o.sill = v < 0.01 ? 0 : v)(),
        oPos: (v) => run('Posição da abertura', () => { o.t = (v < 0.01 ? 0 : v) + o.width / 2; AS.fixOpenings(); })(),
        oMat: (v) => run('Material da abertura', () => o.material = v)(), oFrame: (v) => run('Material do marco', () => o.frame = v)(),
      };
    } else if (kind === 'furniture') {
      title = 'Móvel';
      html += `<div class="sec">${F.txt('fName', 'Nome', o.name)}<div class="grid2">${F.len('fW', 'Largura', o.w)}${F.len('fD', 'Profundidade', o.d)}${F.len('fH', 'Altura', o.h)}${F.num('fR', 'Rotação', o.rot || 0, '°', 15)}${F.len('fX', 'Centro X', o.x || 0.0001)}${F.len('fY', 'Centro Y', o.y || 0.0001)}${F.len('fE', 'Elevação', o.elev || 0.0001)}</div>
        ${F.mat('fMat', 'Material', o.material)}</div>`;
      map = {
        fName: (v) => run('Renomear móvel', () => o.name = v)(), fW: (v) => run('Largura do móvel', () => o.w = v)(), fD: (v) => run('Profundidade do móvel', () => o.d = v)(), fH: (v) => run('Altura do móvel', () => o.h = v)(),
        fR: (v) => run('Girar móvel', () => o.rot = ((v % 360) + 360) % 360)(), fX: (v) => run('Mover móvel', () => o.x = v < 0.01 && v > 0 ? 0 : v)(), fY: (v) => run('Mover móvel', () => o.y = v < 0.01 && v > 0 ? 0 : v)(),
        fE: (v) => run('Elevação do móvel', () => o.elev = v < 0.01 ? 0 : v)(), fMat: (v) => run('Material do móvel', () => o.material = v)(),
      };
    } else if (kind === 'room') {
      title = 'Cômodo';
      const r = AS.roomById(o.id);
      const t = AS.roomType(o.type);
      html += `<div class="sec">${F.txt('rName', 'Nome', o.name)}${F.sel('rType', 'Tipo', AS.ROOM_TYPES.map(t => ({ v: t.id, l: t.name })), o.type, 'wide')}
        <div class="grid2">${F.color('rColor', 'Cor na planta', o.color || t.color)}<div class="fld"><span class="fl">&nbsp;</span><button class="btn sm" id="rColorReset">Cor do tipo</button></div></div>
        ${F.mat('rFloor', 'Piso', o.floorMaterial || t.floor)}${F.check('rCeil', 'Mostrar forro/teto no 3D', o.ceiling !== false)}</div>`;
      if (r) html += `<div class="sec"><h4>Medidas</h4><div class="kv"><span>Área útil</span><b class="mono">${AS.units.fmtArea(r.area)}</b><span>Área pelos eixos</span><b class="mono">${AS.units.fmtArea(r.areaAxis)}</b><span>Perímetro útil</span><b class="mono">${AS.units.fmt(r.perimeter)}</b><span>Largura × comprimento</span><b class="mono">${AS.units.fmt(r.width)} × ${AS.units.fmt(r.length)}</b><span>Paredes</span><b class="mono">${r.wallIds.length}</b></div></div>`;
      else html += `<div class="sec callout warn">${icon('warn')}<div>Este rótulo não está dentro de um cômodo fechado. Feche o contorno com paredes ou arraste o rótulo para dentro de um cômodo.</div></div>`;
      html += `<div class="sec">${F.check('rUnc', 'Medidas estimadas (marcar como incertas)', !!o.uncertain)}${F.txt('rNote', 'Observação', o.note || '', 'Ex.: cota ilegível no PDF')}</div>`;
      map = {
        rName: (v) => run('Renomear cômodo', () => o.name = v || 'Cômodo')(),
        rType: (v) => run('Tipo do cômodo', () => { const old = AS.roomType(o.type); if (!o.name || o.name === old.name || o.name === 'Cômodo') o.name = AS.roomType(v).name; o.type = v; })(),
        rColor: (v) => run('Cor do cômodo', () => o.color = v)(), rFloor: (v) => run('Piso do cômodo', () => o.floorMaterial = v)(), rCeil: (v) => run('Forro', () => o.ceiling = v)(),
        rUnc: (v) => run('Marcar incerteza', () => o.uncertain = v)(), rNote: (v) => run('Observação', () => o.note = v)(),
      };
    } else if (kind === 'dim') {
      title = 'Cota';
      html += `<div class="sec">${F.ro('Distância', AS.units.fmt(AS.geo.dist(o.a, o.b)))}${F.ro('ΔX / ΔY', AS.units.fmt(Math.abs(o.b.x - o.a.x)) + ' / ' + AS.units.fmt(Math.abs(o.b.y - o.a.y)))}</div>`;
    }
    html += UI.selActions(sel);
  }
  $('#propsTitle').textContent = title;
  box.innerHTML = html;
  UI.bind(box, map);
  // botões específicos
  const on = (id, fn) => { const b = box.querySelector('#' + id); if (b) b.onclick = fn; };
  on('pValidate', () => UI.showValidation());
  on('wDoor', () => { const o = sel[0].o; let op; AS.history.run('Adicionar porta', () => op = AS.addOpening('door', o, AS.wallLen(o) / 2)); AS.editor.select([{ kind: 'opening', id: op.id }]); });
  on('wWin', () => { const o = sel[0].o; let op; AS.history.run('Adicionar janela', () => op = AS.addOpening('window', o, AS.wallLen(o) / 2)); AS.editor.select([{ kind: 'opening', id: op.id }]); });
  on('wSplit', AS.editor.ops.splitMid);
  on('oFlip', AS.editor.ops.flip);
  on('oSide', () => { const o = sel[0].o; AS.history.run('Trocar lado', () => o.side = -(o.side || 1)); });
  on('rColorReset', () => { const o = sel[0].o; AS.history.run('Cor do tipo', () => o.color = null); });
  on('sDel', AS.editor.ops.delete); on('sDup', AS.editor.ops.duplicate); on('sLock', AS.editor.ops.lock); on('sHide', AS.editor.ops.hide); on('sRot', AS.editor.ops.rotate90);
  $$('[data-open]', box).forEach(a => a.onclick = (e) => { e.preventDefault(); UI.openPanel(a.dataset.open); });
};
UI.selActions = (sel) => {
  const lockedAll = sel.every(s => s.o.locked);
  const canDup = sel.some(s => s.kind !== 'room');
  return `<div class="sec btnrow sel-actions">
    ${canDup ? `<button class="btn sm" id="sDup" title="Duplicar (Ctrl+D)">${icon('copy')} Duplicar</button>` : ''}
    ${sel.some(s => s.kind === 'wall' || s.kind === 'furniture') ? `<button class="btn sm" id="sRot" title="Girar 90° (R)">↻ 90°</button>` : ''}
    <button class="btn sm" id="sLock" title="Bloquear (Ctrl+L)">${icon('lock')} ${lockedAll ? 'Desbloquear' : 'Bloquear'}</button>
    <button class="btn sm" id="sHide" title="Ocultar (Shift+H)">${icon('eye')} Ocultar</button>
    <button class="btn sm danger" id="sDel" title="Excluir (Delete)">${icon('trash')} Excluir</button></div>`;
};

UI.showValidation = () => {
  const iss = AS.validate();
  const out = $('#valOut'); if (!out) return;
  if (!iss.length) { out.innerHTML = `<p class="ok-line">${icon('check')} Nenhum problema encontrado.</p>`; return; }
  const lv = { erro: 'Erro', aviso: 'Aviso', info: 'Info' };
  out.innerHTML = `<ul class="issues">${iss.slice(0, 40).map((i, k) => `<li class="lv-${i.level}"><button class="link" data-k="${k}">${lv[i.level]}: ${esc(i.msg)}</button></li>`).join('')}</ul>
    <div class="btnrow"><button class="btn sm" id="vFix">Corrigir automaticamente</button><button class="btn sm" id="vSplit">Dividir nas interseções</button></div>`;
  $$('button[data-k]', out).forEach(b => b.onclick = () => { const i = iss[+b.dataset.k]; AS.editor.select(i.ids.map(id => ({ kind: AS.find('wall', id) ? 'wall' : AS.find('opening', id) ? 'opening' : 'wall', id })).filter(s => AS.find(s.kind, s.id))); });
  $('#vFix').onclick = () => { let n; AS.history.run('Corrigir geometria', () => n = AS.autoFix()); AS.toast(`${n} correção(ões) aplicada(s)`); UI.renderProps(); setTimeout(UI.showValidation, 50); };
  $('#vSplit').onclick = () => { let n; AS.history.run('Dividir nas interseções', () => n = AS.splitAtIntersections()); AS.toast(`${n} divisão(ões)`); };
};

/* ---------- painel lateral (navegação principal) ---------- */
UI.PANELS = {
  projects: { name: 'Projetos', icon: 'projects' },
  plan: { name: 'Planta baixa', icon: 'plan', view: 'plan' },
  view3d: { name: 'Vista 3D', icon: 'cube', view: '3d' },
  rooms: { name: 'Cômodos', icon: 'rooms' },
  openings: { name: 'Portas e janelas', icon: 'openings' },
  furniture: { name: 'Mobiliário', icon: 'furniture' },
  materials: { name: 'Materiais', icon: 'materials' },
  measures: { name: 'Medidas', icon: 'measures' },
  import: { name: 'Importar PDF', icon: 'import' },
  generate: { name: 'Gerar planta', icon: 'generate' },
  export: { name: 'Exportar', icon: 'export' },
  history: { name: 'Histórico', icon: 'history' },
  settings: { name: 'Configurações', icon: 'settings' },
};
UI.openPanel = (id) => {
  const P = UI.PANELS[id];
  if (P?.view) { UI.setViewMode(P.view); if (UI.panel === id) return; }
  if (UI.panel === id && !P?.view) { UI.panel = null; $('#leftPanel').hidden = true; UI.syncRail(); setTimeout(() => { R2.resize(); V3.resize(); }, 10); return; }
  UI.panel = id; const lp = $('#leftPanel'); lp.hidden = !!P?.view && !UI.PANEL_RENDER[id];
  if (UI.PANEL_RENDER[id]) { lp.hidden = false; $('#panelTitle').textContent = P.name; UI.PANEL_RENDER[id]($('#panelBody')); }
  UI.syncRail();
  setTimeout(() => { R2.resize(); V3.resize(); }, 10);
};
UI.refreshPanel = () => { if (UI.panel && UI.PANEL_RENDER[UI.panel] && !$('#leftPanel').hidden) { const b = $('#panelBody'); const st = b.scrollTop; UI.PANEL_RENDER[UI.panel](b); b.scrollTop = st; } };
UI.syncRail = () => { $$('.rail button[data-panel]').forEach(b => { const id = b.dataset.panel, P = UI.PANELS[id]; b.classList.toggle('on', P.view ? (P.view === '3d' ? S.viewMode === '3d' : S.viewMode === 'plan') : UI.panel === id && !$('#leftPanel').hidden); b.setAttribute('aria-pressed', b.classList.contains('on')); }); };

UI.PANEL_RENDER = {
  async projects(el) {
    el.innerHTML = `<div class="sec btnrow"><button class="btn primary sm" id="pjNew">${icon('plus')} Novo</button><button class="btn sm" id="pjSave">${icon('save')} Salvar</button><button class="btn sm" id="pjDup">${icon('copy')} Duplicar</button><label class="btn sm file">${icon('import')} Abrir JSON<input type="file" id="pjImport" accept=".json,application/json" hidden></label></div>
      <div class="sec"><div class="kv"><span>Projeto atual</span><b>${esc(S.project.name)}</b><span>Criado</span><b class="mono">${AS.fmtDate(S.project.created)}</b><span>Modificado</span><b class="mono">${AS.fmtDate(S.project.modified)}</b><span>Pavimentos</span><b class="mono">${S.project.floors.length}</b><span>Armazenamento</span><b>${AS.storage.mode === 'db' ? 'Conta (nuvem do Artifact) + navegador' : 'Somente este navegador'}</b></div></div>
      <div class="sec"><h4>Projetos salvos</h4><div id="pjList" class="list"><p class="muted">Carregando…</p></div></div>`;
    $('#pjNew').onclick = () => UI.newProjectDialog();
    $('#pjSave').onclick = () => AS.storage.saveCurrent(true).then(() => UI.refreshPanel());
    $('#pjDup').onclick = () => { const p = AS.normalizeProject(AS.clone(S.project)); p.id = AS.uid('prj'); p.name = S.project.name + ' (cópia)'; p.created = p.modified = Date.now(); AS.loadProject(p); AS.storage.saveCurrent(true).then(() => UI.refreshPanel()); };
    $('#pjImport').onchange = (e) => UI.importJsonFile(e.target.files[0]);
    const list = await AS.storage.list();
    const L = $('#pjList'); if (!L) return;
    if (!list.length) { L.innerHTML = '<p class="muted">Nenhum projeto salvo ainda. Use <b>Salvar</b> (Ctrl+S).</p>'; return; }
    L.innerHTML = list.map(p => `<div class="li ${p.id === S.project.id ? 'cur' : ''}"><div class="li-main"><b>${esc(p.name)}</b><small class="mono">${AS.fmtDate(p.modified)} · ${p.where}</small></div>
      <div class="li-act"><button class="ibtn" data-open="${p.id}" title="Abrir">Abrir</button><button class="ibtn" data-ren="${p.id}" title="Renomear">Renomear</button><button class="ibtn danger" data-del="${p.id}" title="Excluir">${icon('trash')}</button></div></div>`).join('');
    $$('[data-open]', L).forEach(b => b.onclick = async () => { try { const d = await AS.storage.load(b.dataset.open); AS.loadProject(AS.normalizeProject(d)); AS.toast('Projeto aberto: ' + S.project.name); } catch (e) { AS.toast(e.message, 'err'); } });
    $$('[data-ren]', L).forEach(b => b.onclick = () => { const p = list.find(x => x.id === b.dataset.ren); UI.modal('Renomear projeto', F.txt('mRen', 'Nome', p.name), [{ label: 'Cancelar' }, { label: 'Renomear', kind: 'primary', fn: async () => { const v = $('#mRen').value.trim(); if (!v) return false; if (p.id === S.project.id) { AS.history.run('Renomear projeto', () => S.project.name = v); await AS.storage.saveCurrent(); } else { const d = await AS.storage.load(p.id); d.name = v; const cur = S.project; S.project = AS.normalizeProject(d); await AS.storage.save(S.project); S.project = cur; } UI.refreshPanel(); UI.syncTop(); } }]); });
    $$('[data-del]', L).forEach(b => b.onclick = () => { const p = list.find(x => x.id === b.dataset.del); UI.confirm('Excluir projeto', `Excluir <b>${esc(p.name)}</b> do armazenamento? Esta ação não pode ser desfeita.`, 'Excluir', async () => { await AS.storage.remove(p.id); AS.toast('Projeto excluído'); UI.refreshPanel(); }); });
  },
  rooms(el) {
    const fl = AS.floor(), { rooms, orphanMeta } = AS.rooms(fl);
    const tot = rooms.reduce((s, r) => s + r.area, 0);
    el.innerHTML = `<div class="sec"><p class="mtext">Cômodos são detectados automaticamente a partir de paredes fechadas. Clique para selecionar; edite nome, tipo, cor e piso no painel da direita.</p>
      <button class="btn sm" id="rmDraw">${icon('room')} Desenhar cômodo <kbd>R</kbd></button></div>
      <div class="sec"><table class="tbl"><thead><tr><th>Cômodo</th><th class="r">Área útil</th><th class="r">Perímetro</th></tr></thead><tbody>
      ${rooms.map((r, i) => `<tr data-i="${i}" class="${r.meta && S.sel.some(s => s.id === r.meta.id) ? 'cur' : ''}"><td><i class="sw" style="background:${r.meta?.color || AS.roomType(r.meta?.type).color}"></i>${esc(AS.roomName(r))}${r.meta?.uncertain ? ' <em class="unc" title="Medidas estimadas">≈</em>' : ''}</td><td class="r mono">${AS.units.fmtArea(r.area)}</td><td class="r mono">${AS.units.fmt(r.perimeter)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nenhum cômodo fechado neste pavimento.</td></tr>'}
      </tbody><tfoot><tr><td>Total (${rooms.length})</td><td class="r mono">${AS.units.fmtArea(tot)}</td><td></td></tr></tfoot></table></div>
      ${orphanMeta.length ? `<div class="sec callout warn">${icon('warn')}<div>${orphanMeta.length} rótulo(s) fora de cômodos fechados: ${orphanMeta.map(m => esc(m.name)).join(', ')}.</div></div>` : ''}`;
    $('#rmDraw').onclick = () => AS.editor.setTool('room');
    $$('tr[data-i]', el).forEach(tr => tr.onclick = () => { const r = rooms[+tr.dataset.i]; AS.editor.select([{ kind: 'room', id: AS.ensureRoomMetaLazy(r) }]); });
  },
  openings(el) {
    const fl = AS.floor();
    const row = (o) => { const w = fl.walls.find(x => x.id === o.wallId); return `<tr data-id="${o.id}" class="${S.sel.some(s => s.id === o.id) ? 'cur' : ''}"><td>${o.kind === 'door' ? 'Porta' : 'Janela'} · ${esc((o.kind === 'door' ? AS.DOOR_TYPES : AS.WINDOW_TYPES).find(t => t.id === o.type)?.name || o.type)}</td><td class="r mono">${AS.units.fmt(o.width)} × ${AS.units.fmt(o.height)}</td><td class="r mono">${o.kind === 'window' ? AS.units.fmt(o.sill) : '—'}</td></tr>`; };
    el.innerHTML = `<div class="sec btnrow"><button class="btn sm" id="opDoor">${icon('door')} Porta <kbd>D</kbd></button><button class="btn sm" id="opWin">${icon('window')} Janela <kbd>J</kbd></button></div>
      <div class="sec"><p class="mtext">Portas e janelas ficam presas às paredes. Arraste para deslizar ao longo da parede (ou para outra parede); arraste as alças para mudar a largura; <kbd>F</kbd> inverte a abertura.</p></div>
      <div class="sec"><table class="tbl"><thead><tr><th>Abertura</th><th class="r">L × A</th><th class="r">Peitoril</th></tr></thead><tbody>${fl.openings.map(row).join('') || '<tr><td colspan="3" class="muted">Nenhuma abertura neste pavimento.</td></tr>'}</tbody></table></div>`;
    $('#opDoor').onclick = () => AS.editor.setTool('door'); $('#opWin').onclick = () => AS.editor.setTool('window');
    $$('tr[data-id]', el).forEach(tr => tr.onclick = () => AS.editor.select([{ kind: 'opening', id: tr.dataset.id }]));
  },
  furniture(el) {
    const cats = [...new Set(AS.FURNITURE.map(f => f.cat))];
    el.innerHTML = `<div class="sec"><input class="inp" id="fuSearch" placeholder="Buscar móvel…" aria-label="Buscar móvel"></div>
      <div class="sec"><p class="mtext">Clique em um item e depois na planta para posicionar. <kbd>R</kbd> gira antes de soltar. Modelos procedurais simples (sem arquivos externos).</p></div>
      <div id="fuList">${cats.map(c => `<div class="sec fu-cat" data-cat="${esc(c)}"><h4>${esc(c)}</h4><div class="fu-grid">${AS.FURNITURE.filter(f => f.cat === c).map(f => `<button class="fu" data-type="${f.type}" title="${esc(f.name)} — ${AS.units.fmt(f.w)} × ${AS.units.fmt(f.d)}"><canvas width="64" height="48" data-type="${f.type}"></canvas><span>${esc(f.name)}</span><small class="mono">${f.w}×${f.d}</small></button>`).join('')}</div></div>`).join('')}</div>`;
    const C = R2.colors();
    $$('canvas[data-type]', el).forEach(cv => {
      const d = AS.furnDef(cv.dataset.type), ctx = cv.getContext('2d'), s = Math.min(54 / d.w, 40 / d.d);
      ctx.clearRect(0, 0, 64, 48); R2._furnFill = null;
      R2.drawFurniture(ctx, { ...d, x: 0, y: 0, rot: 0 }, { s, ox: 32, oy: 24 }, C, false, false);
    });
    $$('.fu', el).forEach(b => b.onclick = () => { AS.editor.setTool('furniture', b.dataset.type); if (S.viewMode === '3d') UI.setViewMode('split'); AS.toast('Clique na planta para posicionar: ' + AS.furnDef(b.dataset.type).name); });
    $('#fuSearch').oninput = (e) => { const q = e.target.value.toLowerCase(); $$('.fu', el).forEach(b => b.hidden = q && !b.title.toLowerCase().includes(q)); $$('.fu-cat', el).forEach(c => c.hidden = !$$('.fu', c).some(b => !b.hidden)); };
  },
  materials(el) {
    const cats = [...new Set(S.project.materials.map(m => m.cat))];
    const sel = AS.editor.selected();
    const target = sel.length ? `${sel.length} objeto(s) selecionado(s)` : 'nada selecionado';
    el.innerHTML = `<div class="sec"><p class="mtext">Clique em um material para aplicá-lo à seleção (${target}): paredes, pisos de cômodos, móveis, portas e janelas. Edite cor e rugosidade abaixo — o 3D atualiza na hora.</p></div>
      ${cats.map(c => `<div class="sec"><h4>${esc(c)}</h4><div class="mat-grid">${S.project.materials.filter(m => m.cat === c).map(m => `<button class="mat" data-id="${m.id}" title="${esc(m.name)}"><i style="background:${m.color}" class="sw-lg pat-${m.pattern}"></i><span>${esc(m.name)}</span></button>`).join('')}</div></div>`).join('')}
      <div class="sec" id="matEdit"></div>`;
    $$('.mat', el).forEach(b => {
      b.onclick = () => UI.applyMaterial(b.dataset.id);
      b.oncontextmenu = (e) => { e.preventDefault(); UI.editMaterial(b.dataset.id); };
      b.ondblclick = () => UI.editMaterial(b.dataset.id);
    });
    $('#matEdit').innerHTML = '<p class="muted">Duplo clique em um material para editar cor e rugosidade.</p>';
  },
  measures(el) {
    const fl = AS.floor(), m = AS.metrics(fl), { rooms } = AS.rooms(fl);
    const allM = S.project.floors.map(f => ({ f, m: AS.metrics(f) }));
    el.innerHTML = `<div class="sec btnrow"><button class="btn sm" id="msTool">${icon('measure')} Medir / cotar <kbd>T</kbd></button><label class="chk"><input type="checkbox" id="msDims" ${S.project.settings.showDims ? 'checked' : ''}><span>Cotas das paredes</span></label></div>
      <div class="sec"><h4>Edificação</h4><div class="kv">${allM.map(x => `<span>${esc(x.f.name)}</span><b class="mono">${AS.units.fmtArea(x.m.util)} útil · ${AS.units.fmtArea(x.m.built)} constr.</b>`).join('')}<span>Total construída (aprox.)</span><b class="mono">${AS.units.fmtArea(allM.reduce((s, x) => s + x.m.built, 0))}</b></div></div>
      <div class="sec"><h4>Pavimento: ${esc(fl.name)}</h4><div class="kv"><span>Área de piso (útil)</span><b class="mono">${AS.units.fmtArea(m.util)}</b><span>Comprimento de paredes</span><b class="mono">${AS.units.fmt(m.wallLen)}</b><span>Paredes externas</span><b class="mono">${AS.units.fmt(fl.walls.filter(w => w.type === 'exterior').reduce((s, w) => s + AS.wallLen(w), 0))}</b></div></div>
      <div class="sec"><h4>Paredes</h4><table class="tbl"><thead><tr><th>#</th><th class="r">Compr.</th><th class="r">Esp.</th><th class="r">Alt.</th></tr></thead><tbody>${fl.walls.map((w, i) => `<tr data-id="${w.id}" class="${S.sel.some(s => s.id === w.id) ? 'cur' : ''}"><td>${i + 1} · ${w.type === 'exterior' ? 'ext.' : 'int.'}</td><td class="r mono">${AS.units.fmt(AS.wallLen(w))}</td><td class="r mono">${AS.units.fmt(w.thickness)}</td><td class="r mono">${AS.units.fmt(w.height)}</td></tr>`).join('')}</tbody></table></div>
      <div class="sec"><h4>Cotas manuais</h4>${fl.dims.length ? `<table class="tbl"><tbody>${fl.dims.map(d => `<tr data-dim="${d.id}"><td>Cota</td><td class="r mono">${AS.units.fmt(AS.geo.dist(d.a, d.b))}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhuma. Use a ferramenta Medir.</p>'}</div>`;
    $('#msTool').onclick = () => AS.editor.setTool('measure');
    $('#msDims').onchange = (e) => { S.project.settings.showDims = e.target.checked; R2.req(); };
    $$('tr[data-id]', el).forEach(tr => tr.onclick = () => AS.editor.select([{ kind: 'wall', id: tr.dataset.id }]));
    $$('tr[data-dim]', el).forEach(tr => tr.onclick = () => AS.editor.select([{ kind: 'dim', id: tr.dataset.dim }]));
  },
  import(el) { AS.importUI.render(el); },
  generate(el) { AS.genUI.render(el); },
  export(el) {
    el.innerHTML = `<div class="sec"><p class="mtext">Os arquivos são gerados a partir dos dados reais do projeto. No visualizador do Claude, cada download pede sua confirmação.</p></div>
      <div class="sec exp-list">
        <button class="exp" data-x="json"><b>Projeto (JSON)</b><span>Todos os dados editáveis: pavimentos, paredes, aberturas, cômodos, móveis, materiais e imagens de referência. Reabra com “Abrir JSON”.</span></button>
        <button class="exp" data-x="jsonlean"><b>Projeto (JSON, sem imagens)</b><span>Arquivo menor, sem o PDF/imagem de referência.</span></button>
        <button class="exp" data-x="png"><b>Planta 2D (PNG)</b><span>Pavimento ativo com cotas, rótulos e áreas, fundo branco, escala gráfica.</span></button>
        <button class="exp" data-x="svg"><b>Planta 2D (SVG vetorial)</b><span>1 unidade = 1 cm. Paredes, cômodos, aberturas, cotas e rótulos em camadas.</span></button>
        <button class="exp" data-x="pdf"><b>Prancha (PDF A3)</b><span>Uma folha por pavimento com carimbo e quadro de áreas, mais a vista 3D.</span></button>
        <button class="exp" data-x="png3d"><b>Vista 3D (PNG)</b><span>Imagem da câmera 3D atual.</span></button>
      </div>`;
    $$('.exp', el).forEach(b => b.onclick = async () => {
      b.classList.add('busy');
      try { const x = b.dataset.x; if (x === 'json') await AS.exporter.json(true); else if (x === 'jsonlean') await AS.exporter.json(false); else await AS.exporter[x](); }
      catch (e) { AS.toast(e.message || String(e), 'err'); }
      b.classList.remove('busy');
    });
  },
  history(el) {
    const H = AS.history;
    el.innerHTML = `<div class="sec btnrow"><button class="btn sm" id="hU">${icon('undo')} Desfazer</button><button class="btn sm" id="hR">${icon('redo')} Refazer</button></div>
      <div class="sec"><p class="mtext">Clique em uma etapa para voltar ao estado anterior a ela. Cada etapa guarda os dados reais do projeto.</p><ol class="hist">${H.undo.map((e, i) => `<li><button class="link" data-i="${i}">${esc(e.label)}</button><small class="mono">${new Date(e.ts).toLocaleTimeString('pt-BR')}</small></li>`).reverse().join('') || '<li class="muted">Sem alterações nesta sessão.</li>'}</ol>
      ${H.redo.length ? `<h4>Refazer disponível</h4><ol class="hist redo">${H.redo.map(e => `<li>${esc(e.label)}</li>`).reverse().join('')}</ol>` : ''}</div>`;
    $('#hU').onclick = () => H.doUndo(); $('#hR').onclick = () => H.doRedo();
    $$('button[data-i]', el).forEach(b => b.onclick = () => H.jump(+b.dataset.i));
  },
  settings(el) {
    const st = S.project.settings;
    el.innerHTML = `<div class="sec"><h4>Unidades</h4><div class="grid2">${F.sel('stU', 'Unidade de exibição', [{ v: 'm', l: 'Metros' }, { v: 'cm', l: 'Centímetros' }, { v: 'mm', l: 'Milímetros' }], AS.units.mode)}${F.sel('stP', 'Precisão (m)', [{ v: 1, l: '0,0' }, { v: 2, l: '0,00' }, { v: 3, l: '0,000' }], AS.units.precision)}</div><p class="muted">Internamente tudo é guardado em centímetros; a troca de unidade não altera a geometria.</p></div>
      <div class="sec"><h4>Padrões de desenho</h4><div class="grid2">${F.len('stWT', 'Espessura parede interna', st.wallThickness)}${F.len('stET', 'Espessura parede externa', st.extThickness)}${F.len('stWH', 'Altura padrão', st.wallHeight)}${F.len('stG', 'Passo da grade', st.grid)}</div></div>
      <div class="sec"><h4>Snaps</h4><div class="chks">${F.check('snG', 'Grade', st.snapGrid)}${F.check('snC', 'Vértices', st.snapCorner)}${F.check('snW', 'Paredes', st.snapWall)}${F.check('snA', 'Alinhamento', st.snapAlign)}${F.check('snAng', 'Ângulos de 45°', st.angleSnap)}</div></div>
      <div class="sec"><h4>Exibição</h4><div class="chks">${F.check('shG', 'Grade', st.showGrid)}${F.check('shD', 'Cotas das paredes', st.showDims)}${F.check('shF', 'Mobiliário', st.showFurniture)}${F.check('shL', 'Pavimento inferior (fantasma)', st.showLower)}</div>
      ${F.sel('stArea', 'Área exibida nos cômodos', [{ v: 'util', l: 'Área útil (descontando paredes)' }, { v: 'eixo', l: 'Área pelos eixos das paredes' }], st.roomAreaMode, 'wide')}</div>
      <div class="sec"><h4>Tema</h4>${F.sel('stTheme', 'Aparência', [{ v: 'auto', l: 'Automático (sistema)' }, { v: 'light', l: 'Claro' }, { v: 'dark', l: 'Escuro' }], UI.themePref)}</div>
      <div class="sec"><h4>Armazenamento</h4><p class="mtext">${AS.storage.mode === 'db' ? 'Projetos são salvos na sua conta (armazenamento privado deste Artifact) e também no navegador.' : 'Armazenamento da conta indisponível nesta visualização; projetos ficam apenas neste navegador. Use Exportar → JSON como cópia de segurança.'}</p>${F.check('stAuto', 'Salvar automaticamente a cada alteração', UI.autosave)}</div>
      <div class="sec"><button class="btn sm" id="stKeys">Atalhos de teclado</button> <button class="btn sm" id="stTour">Rever introdução</button></div>`;
    const set = (k) => (v) => { st[k] = v; AS.changed(true); R2.req(); };
    UI.bind(el, {
      stU: (v) => { AS.units.mode = v; S.project.units = v; UI.refreshAll(); }, stP: (v) => { AS.units.precision = +v; S.project.precision = +v; UI.refreshAll(); },
      stWT: set('wallThickness'), stET: set('extThickness'), stWH: set('wallHeight'), stG: set('grid'),
      snG: set('snapGrid'), snC: set('snapCorner'), snW: set('snapWall'), snA: set('snapAlign'), snAng: set('angleSnap'),
      shG: set('showGrid'), shD: set('showDims'), shF: (v) => { st.showFurniture = v; AS.changed(true); V3.invalidate(); }, shL: set('showLower'), stArea: set('roomAreaMode'),
      stTheme: (v) => UI.setTheme(v), stAuto: (v) => { UI.autosave = v; AS.storage.ls('asu.autosave', v ? '1' : '0'); },
    });
    $('#stKeys').onclick = UI.showShortcuts; $('#stTour').onclick = UI.showWelcome;
  },
};

UI.applyMaterial = (id) => {
  const sel = AS.editor.selected(); if (!sel.length) return AS.toast('Selecione paredes, cômodos, móveis ou aberturas para aplicar o material');
  AS.history.run('Aplicar material', () => {
    for (const s of sel) {
      if (s.kind === 'wall') s.o.material = id;
      if (s.kind === 'room') s.o.floorMaterial = id;
      if (s.kind === 'furniture') s.o.material = id;
      if (s.kind === 'opening') { if (AS.mat(id).cat === 'Vidro' || AS.mat(id).cat === 'Madeira') s.o.material = id; else s.o.frame = id; }
    }
  });
  AS.toast(`${AS.mat(id).name} aplicado a ${sel.length} objeto(s)`);
};
UI.editMaterial = (id) => {
  const m = S.project.materials.find(x => x.id === id); const box = $('#matEdit'); if (!m || !box) return;
  box.innerHTML = `<h4>Editar: ${esc(m.name)}</h4><div class="grid2">${F.color('meC', 'Cor', m.color)}${F.num('meR', 'Rugosidade', m.rough, '0–1', 0.05)}${F.num('meM', 'Metal', m.metal || 0, '0–1', 0.05)}${F.sel('meP', 'Padrão', ['none', 'wood', 'tile', 'brick', 'concrete', 'stone', 'marble', 'glass', 'metal'].map(v => ({ v, l: { none: 'Liso', wood: 'Madeira', tile: 'Placas', brick: 'Tijolo/metrô', concrete: 'Concreto', stone: 'Pedra', marble: 'Mármore', glass: 'Vidro', metal: 'Metal' }[v] })), m.pattern)}</div>${F.txt('meN', 'Nome', m.name)}`;
  const upd = (fn) => (v) => { AS.history.run('Editar material', () => fn(v)); V3.matCache = {}; V3.texCache = {}; V3.invalidate(); UI.PANEL_RENDER.materials($('#panelBody')); UI.editMaterial(id); };
  UI.bind(box, { meC: upd(v => m.color = v), meR: upd(v => m.rough = AS.clamp(v, 0, 1)), meM: upd(v => m.metal = AS.clamp(v, 0, 1)), meP: upd(v => m.pattern = v), meN: upd(v => m.name = v || m.name) });
  box.scrollIntoView({ block: 'nearest' });
};

/* ---------- topo / status ---------- */
UI.syncTop = () => {
  const n = $('#projName'); if (document.activeElement !== n) n.value = S.project.name;
  $('#btnUndo').disabled = !AS.history.undo.length; $('#btnRedo').disabled = !AS.history.redo.length;
  $('#btnUndo').title = AS.history.undo.length ? 'Desfazer: ' + AS.history.undo.at(-1).label + ' (Ctrl+Z)' : 'Nada para desfazer';
  $('#btnRedo').title = AS.history.redo.length ? 'Refazer: ' + AS.history.redo.at(-1).label + ' (Ctrl+Y)' : 'Nada para refazer';
};
UI.syncFloors = () => {
  const box = $('#floorTabs');
  box.innerHTML = S.project.floors.map(f => `<button class="ftab ${f.id === S.project.activeFloor ? 'on' : ''}" data-f="${f.id}" title="${esc(f.name)} — nível ${AS.units.fmt(f.elevation || 0)}">${esc(f.name)}</button>`).join('') + `<button class="ftab add" id="flMenu" title="Pavimentos: adicionar, duplicar, excluir">${icon('layers')}<span>Pavimentos</span></button>`;
  $$('.ftab[data-f]', box).forEach(b => b.onclick = () => { S.project.activeFloor = b.dataset.f; S.sel = []; AS.changed(false); AS.bus.emit('floor'); R2.fit(); });
  $('#flMenu').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), fl = AS.floor();
    UI.contextMenu(r.left, r.top - 10, [
      { label: 'Adicionar pavimento superior', fn: () => UI.addFloor('up') },
      { label: 'Adicionar subsolo', fn: () => UI.addFloor('down') },
      { label: 'Duplicar pavimento atual', fn: () => UI.addFloor('dup') },
      { label: 'Renomear pavimento atual', fn: () => UI.modal('Renomear pavimento', F.txt('mFl', 'Nome', fl.name), [{ label: 'Cancelar' }, { label: 'Renomear', kind: 'primary', fn: () => { const v = $('#mFl').value.trim(); if (!v) return false; AS.history.run('Renomear pavimento', () => fl.name = v); } }]) },
      { label: S.project.settings.showLower ? 'Ocultar pavimento inferior' : 'Mostrar pavimento inferior (alinhar)', fn: () => { S.project.settings.showLower = !S.project.settings.showLower; R2.req(); } },
      S.project.floors.length > 1 && { sep: true },
      S.project.floors.length > 1 && { label: 'Excluir pavimento atual', danger: true, fn: () => UI.confirm('Excluir pavimento', `Excluir <b>${esc(fl.name)}</b> e todo o seu conteúdo? Você pode desfazer com Ctrl+Z.`, 'Excluir', () => { AS.history.run('Excluir pavimento', () => { S.project.floors = S.project.floors.filter(f => f !== fl); S.project.activeFloor = S.project.floors[0].id; }); AS.bus.emit('floor'); }) },
    ].filter(Boolean));
  };
};
UI.addFloor = (mode) => {
  const p = S.project, cur = AS.floor();
  AS.history.run('Adicionar pavimento', () => {
    let f;
    if (mode === 'dup') { f = AS.clone(cur); f.id = AS.uid('fl'); f.name = cur.name + ' (cópia)'; const map = {}; f.walls.forEach(w => { const n = AS.uid('w'); map[w.id] = n; w.id = n; }); f.openings.forEach(o => { o.id = AS.uid('op'); o.wallId = map[o.wallId]; }); f.furniture.forEach(x => x.id = AS.uid('fu')); f.roomMeta.forEach(x => x.id = AS.uid('rm')); f.dims.forEach(x => x.id = AS.uid('dm')); const top = Math.max(...p.floors.map(x => x.elevation || 0)); f.elevation = top + (cur.height || 280) + (cur.slab || 12); p.floors.push(f); }
    else if (mode === 'up') { const top = p.floors.reduce((a, b) => (b.elevation || 0) > (a.elevation || 0) ? b : a, p.floors[0]); f = AS.newFloor(p.floors.length === 1 ? 'Pavimento superior' : `Pavimento ${p.floors.length + 1}`, (top.elevation || 0) + (top.height || 280) + (top.slab || 12)); p.floors.push(f); }
    else { const low = Math.min(...p.floors.map(x => x.elevation || 0)); f = AS.newFloor('Subsolo', low - 292); p.floors.unshift(f); }
    p.activeFloor = f.id; if (mode !== 'dup') S.project.settings.showLower = true;
  });
  AS.bus.emit('floor'); AS.toast('Pavimento adicionado: ' + AS.floor().name);
};

UI.setViewMode = (m) => {
  S.viewMode = m; document.body.dataset.view = m;
  $$('.vm button').forEach(b => { b.classList.toggle('on', b.dataset.vm === m); b.setAttribute('aria-pressed', b.dataset.vm === m); });
  UI.syncRail();
  setTimeout(() => { R2.resize(); V3.resize(); V3.invalidate(); }, 20);
};

UI.themePref = 'auto';
UI.setTheme = (pref) => {
  UI.themePref = pref; AS.storage.ls('asu.theme', pref);
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = pref;
  const dark = pref === 'dark' || pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.resolvedTheme = dark ? 'dark' : 'light';
  $('#btnTheme').innerHTML = icon(dark ? 'sun' : 'moon'); $('#btnTheme').title = dark ? 'Tema claro' : 'Tema escuro';
  R2.req(); V3.applyTheme(); UI.refreshPanel();
};

UI.refreshAll = () => { UI.renderProps(); UI.refreshPanel(); UI.syncTop(); UI.syncFloors(); R2.req(); };

UI.showShortcuts = () => UI.modal('Atalhos de teclado', `<div class="keys">
  ${[['V', 'Selecionar / mover'], ['W', 'Desenhar parede'], ['R', 'Desenhar cômodo (ou girar seleção)'], ['D', 'Porta'], ['J', 'Janela'], ['M', 'Biblioteca de móveis'], ['T', 'Medir / cotar'], ['X', 'Dividir parede'], ['H / Espaço', 'Mover vista'], ['F', 'Enquadrar / inverter abertura'],
     ['0–9 (desenhando)', 'Digitar comprimento exato'], ['Shift', 'Desliga snaps / soma à seleção'], ['Setas', 'Mover seleção 1 cm (Shift: 10 cm)'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / V / D', 'Copiar / colar / duplicar'],
     ['Ctrl+G / Ctrl+Shift+G', 'Agrupar / desagrupar'], ['Ctrl+L', 'Bloquear'], ['Shift+H', 'Ocultar'], ['Delete', 'Excluir'], ['Ctrl+S', 'Salvar'], ['1 / 2 / 3', 'Planta / dividida / 3D'], ['3D: arrastar · Shift/botão direito · roda · WASD', 'Orbitar · deslocar · zoom · andar']]
    .map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`).join('')}</div>`, [{ label: 'Fechar', kind: 'primary' }], { wide: true });

UI.showWelcome = () => UI.modal('Bem-vindo ao Architect Studio Ultra', `<div class="welcome">
  <p class="mtext">Editor de plantas 2D com visualização 3D sincronizada. Tudo o que você desenha é geometria editável.</p>
  <ol class="steps"><li><b>Importar PDF</b> — carregue a planta da sua casa, calibre a escala com uma cota conhecida e decalque as paredes (ou use a detecção automática experimental).</li>
  <li><b>Desenhar</b> — <kbd>W</kbd> paredes, <kbd>R</kbd> cômodos, <kbd>D</kbd>/<kbd>J</kbd> portas e janelas. Cômodos fechados são detectados e medidos automaticamente.</li>
  <li><b>Gerar planta</b> — informe área, quartos e banheiros e compare 3 alternativas editáveis.</li>
  <li><b>3D e exportação</b> — o 3D acompanha cada alteração; exporte JSON, PNG, SVG ou PDF.</li></ol>
  <p class="callout warn">${icon('warn')}<span>O projeto aberto agora é um <b>exemplo gerado</b>. O PDF da sua casa ainda não foi recebido; importe-o em <b>Importar PDF</b>.</span></p></div>`,
  [{ label: 'Ver atalhos', fn: () => { setTimeout(UI.showShortcuts, 10); } }, { label: 'Importar PDF', fn: () => setTimeout(() => UI.openPanel('import'), 10) }, { label: 'Começar', kind: 'primary', fn: () => AS.storage.ls('asu.welcomed', '1') }], { wide: true });

UI.newProjectDialog = () => UI.modal('Novo projeto', `${F.txt('npName', 'Nome do projeto', 'Novo projeto')}<div class="np-opts">
  <label class="np"><input type="radio" name="np" value="blank" checked><span><b>Em branco</b><small>Comece desenhando paredes e cômodos.</small></span></label>
  <label class="np"><input type="radio" name="np" value="pdf"><span><b>A partir de PDF ou imagem</b><small>Importe uma planta existente como referência para decalque.</small></span></label>
  <label class="np"><input type="radio" name="np" value="gen"><span><b>Gerar automaticamente</b><small>Defina o programa e escolha entre alternativas.</small></span></label></div>`,
  [{ label: 'Cancelar' }, { label: 'Criar', kind: 'primary', fn: () => {
    const name = $('#npName').value.trim() || 'Novo projeto', mode = $('input[name=np]:checked').value;
    AS.loadProject(AS.newProject(name));
    if (mode === 'pdf') setTimeout(() => UI.openPanel('import'), 20); else if (mode === 'gen') setTimeout(() => UI.openPanel('generate'), 20); else AS.editor.setTool('wall');
    AS.toast('Projeto criado: ' + name);
  } }]);

UI.importJsonFile = async (file) => {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text()), errs = AS.validateProjectData(d);
    if (errs.length) throw new Error('Arquivo inválido: ' + errs.slice(0, 3).join('; '));
    const p = AS.normalizeProject(d);
    if (S.project.id === p.id) p.id = AS.uid('prj');
    AS.loadProject(p); AS.toast('Projeto importado: ' + p.name, 'ok');
  } catch (e) { AS.toast(e.message.startsWith('Arquivo') ? e.message : 'Não foi possível ler o JSON: ' + e.message, 'err'); }
};

UI.showExportFallback = (filename, url, mime, text) => {
  const isImg = /^image\//.test(mime || '');
  UI.modal('Exportar ' + filename, `<p class="mtext">O download direto não está disponível nesta visualização. ${isImg ? 'Clique com o botão direito na imagem e escolha “Salvar imagem como…”.' : text ? 'Copie o conteúdo abaixo e salve num arquivo com esse nome.' : 'Tente o link abaixo.'}</p>
    ${isImg ? `<img src="${url}" alt="Prévia de ${esc(filename)}" class="exp-prev">` : text ? `<textarea class="inp mono exp-txt" readonly>${esc(text.length > 400000 ? text.slice(0, 400000) + '\n… (conteúdo truncado na prévia)' : text)}</textarea>` : ''}
    <p><a href="${url}" download="${esc(filename)}" class="btn sm">Baixar ${esc(filename)}</a></p>`,
    [text ? { label: 'Copiar', fn: async () => { try { await navigator.clipboard.writeText(text); AS.toast('Copiado'); } catch (e) { $('.exp-txt')?.select(); AS.toast('Selecione e copie com Ctrl+C'); } return false; } } : null, { label: 'Fechar', kind: 'primary' }].filter(Boolean), { wide: true });
};

/* ---------- status bar ---------- */
UI.syncStatus = () => {
  const m = AS.metrics(); $('#stMetrics').textContent = `${m.rooms} cômodos · ${AS.units.fmtArea(m.util)} úteis · ${m.walls} paredes`;
  $('#stZoom').textContent = Math.round(R2.view.s * 100 / 0.5) + '%';
  $$('#snapToggles button').forEach(b => b.classList.toggle('on', !!S.project.settings[b.dataset.snap]));
};
