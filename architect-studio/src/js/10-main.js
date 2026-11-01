/* ==========================================================================
   10 — Inicialização
   ========================================================================== */
AS.loadProject = (p) => {
  S.project = p; S.sel = [];
  AS.units.mode = p.units || 'm'; AS.units.precision = p.precision ?? 2;
  AS.history.clear(); AS.editor.setTool('select'); AS.changed(true);
  AS.importUI.result = null;
  UI.refreshAll(); UI.syncFloors();
  requestAnimationFrame(() => { R2.resize(); R2.fit(); V3.frame(); V3.invalidate(); });
  AS.bus.emit('project');
};

AS.sampleProject = () => {
  const p = AS.generatePlan({ area: 120, bedrooms: 3, bathrooms: 2, suite: true, floors: 1, garage: 1, laundry: true, balcony: true, style: 'contemporaneo' }, 0);
  p.name = 'Exemplo — casa térrea 3 quartos (gerada)';
  p.meta.source = 'sample';
  p.meta.assumptions.unshift('Projeto de EXEMPLO gerado automaticamente. Não representa a sua casa: o PDF ainda não foi importado.');
  return p;
};

UI.autosave = true;
AS.boot = async () => {
  // tema
  UI.themePref = AS.storage.ls('asu.theme') || 'auto';
  UI.autosave = AS.storage.ls('asu.autosave') !== '0';
  // rail + ferramentas
  $('#rail').innerHTML = Object.entries(UI.PANELS).map(([id, p]) => `<button data-panel="${id}" title="${esc(p.name)}" aria-label="${esc(p.name)}" aria-pressed="false">${icon(p.icon)}<span>${esc(p.name)}</span></button>`).join('');
  $$('#rail button').forEach(b => b.onclick = () => UI.openPanel(b.dataset.panel));
  const tools = ['select', 'wall', 'room', 'door', 'window', 'furniture', 'measure', 'split', 'pan'];
  $('#toolbar').innerHTML = tools.map(t => `<button data-tool="${t}" title="${esc(AS.editor.TOOLS[t].name)}${AS.editor.TOOLS[t].key ? ' (' + AS.editor.TOOLS[t].key + ')' : ''}" aria-label="${esc(AS.editor.TOOLS[t].name)}">${icon(t)}<kbd>${AS.editor.TOOLS[t].key}</kbd></button>`).join('')
    + `<span class="tsep"></span><button id="tbUndo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">${icon('undo')}</button><button id="tbRedo" title="Refazer (Ctrl+Y)" aria-label="Refazer">${icon('redo')}</button>`;
  $$('#toolbar [data-tool]').forEach(b => b.onclick = () => { if (b.dataset.tool === 'furniture') { UI.openPanel('furniture'); return; } AS.editor.setTool(b.dataset.tool); });
  $('#tbUndo').onclick = () => AS.history.doUndo(); $('#tbRedo').onclick = () => AS.history.doRedo();
  $('#btnUndo').innerHTML = icon('undo'); $('#btnRedo').innerHTML = icon('redo');
  $('#btnUndo').onclick = () => AS.history.doUndo(); $('#btnRedo').onclick = () => AS.history.doRedo();
  $('#btnSave').innerHTML = icon('save') + '<span>Salvar</span>'; $('#btnSave').onclick = () => AS.storage.saveCurrent(true);
  $('#btnExport').innerHTML = icon('export') + '<span>Exportar</span>'; $('#btnExport').onclick = () => UI.openPanel('export');
  $('#btnHelp').innerHTML = icon('help'); $('#btnHelp').onclick = UI.showShortcuts;
  $('#btnTheme').onclick = () => UI.setTheme(document.documentElement.dataset.resolvedTheme === 'dark' ? 'light' : 'dark');
  $('#btnProps').innerHTML = icon('settings'); $('#btnProps').onclick = () => document.body.classList.toggle('props-open');
  $$('.vm button').forEach(b => b.onclick = () => UI.setViewMode(b.dataset.vm));
  $('#panelClose').innerHTML = icon('close'); $('#panelClose').onclick = () => { UI.panel = null; $('#leftPanel').hidden = true; UI.syncRail(); setTimeout(() => { R2.resize(); V3.resize(); }, 10); };
  $('#propsClose').innerHTML = icon('close'); $('#propsClose').onclick = () => document.body.classList.remove('props-open');
  $('#modalClose').innerHTML = icon('close'); $('#modalClose').onclick = UI.closeModal;
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') UI.closeModal(); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#ctxmenu')) UI.hideCtx(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.hideCtx(); });
  $('#projName').addEventListener('change', (e) => { const v = e.target.value.trim(); if (v) AS.history.run('Renomear projeto', () => S.project.name = v); else e.target.value = S.project.name; });
  $('#projName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  // zoom flutuante
  $('#zoomCtl').innerHTML = `<button id="zIn" title="Aproximar (+)" aria-label="Aproximar">${icon('zoomin')}</button><button id="zOut" title="Afastar (−)" aria-label="Afastar">${icon('zoomout')}</button><button id="zFit" title="Enquadrar (F)" aria-label="Enquadrar">${icon('fit')}</button>`;
  $('#zIn').onclick = () => R2.zoomAt(1.25, R2.w / 2, R2.h / 2); $('#zOut').onclick = () => R2.zoomAt(0.8, R2.w / 2, R2.h / 2); $('#zFit').onclick = () => R2.fit();
  // 3D toolbar
  $('#v3bar').innerHTML = `<div class="seg"><button data-v="persp" class="on" title="Perspectiva orbital">Perspectiva</button><button data-v="top" title="Vista de cima">Topo</button><button data-v="eye" title="Altura dos olhos">Olhos</button></div>
    <button id="v3fit" title="Enquadrar casa">${icon('fit')}</button>
    <label class="tg" title="Cortar paredes a 1,20 m para ver o interior"><input type="checkbox" id="v3cut"><span>Corte</span></label>
    <label class="tg" title="Mostrar forros/tetos"><input type="checkbox" id="v3ceil"><span>Tetos</span></label>
    <label class="tg" title="Mostrar todos os pavimentos empilhados"><input type="checkbox" id="v3all" checked><span>Todos pav.</span></label>
    <label class="tg" title="Sombras projetadas"><input type="checkbox" id="v3sh" checked><span>Sombras</span></label>
    <button id="v3png" title="Exportar vista 3D (PNG)">PNG</button>`;
  $$('#v3bar [data-v]').forEach(b => b.onclick = () => { $$('#v3bar [data-v]').forEach(x => x.classList.toggle('on', x === b)); V3.setView(b.dataset.v); });
  $('#v3fit').onclick = () => V3.frame();
  const v3t = (id, k) => { const el = $('#' + id); el.checked = !!S.project.view3d[k]; el.onchange = () => { S.project.view3d[k] = el.checked; V3.invalidate(); }; };
  const syncV3 = () => { v3t('v3cut', 'cutaway'); v3t('v3ceil', 'ceilings'); v3t('v3all', 'allFloors'); v3t('v3sh', 'shadows'); };
  AS.bus.on('project', syncV3); AS.bus.on('history', syncV3);
  $('#v3png').onclick = () => AS.exporter.png3d().catch(e => AS.toast(e.message, 'err'));
  // snaps (status)
  $('#snapToggles').innerHTML = [['snapGrid', 'Grade'], ['snapCorner', 'Vértice'], ['snapWall', 'Parede'], ['snapAlign', 'Alinhar'], ['angleSnap', '45°']].map(([k, l]) => `<button data-snap="${k}" title="Snap: ${l}">${l}</button>`).join('');
  $$('#snapToggles button').forEach(b => b.onclick = () => { S.project.settings[b.dataset.snap] = !S.project.settings[b.dataset.snap]; UI.syncStatus(); });
  $('#numInputField').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); AS.editor.applyNumInput(); } if (e.key === 'Escape') AS.editor.hideNumInput(); });
  $('#numInputOk').onclick = () => AS.editor.applyNumInput();

  // motores
  R2.init($('#plan')); AS.editor.bind($('#plan'));
  V3.init($('#v3'));
  UI.setTheme(UI.themePref);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (UI.themePref === 'auto') UI.setTheme('auto'); });

  // eventos
  const refreshUI = AS.debounce(() => { UI.renderProps(); UI.refreshPanel(); UI.syncStatus(); }, 60);
  AS.bus.on('changed', (geom) => { R2.req(); if (geom) V3.invalidate(); refreshUI(); UI.syncTop(); });
  AS.bus.on('selection', () => { UI.renderProps(); V3.highlight(); if (['rooms', 'openings', 'measures', 'materials'].includes(UI.panel)) UI.refreshPanel(); if (S.sel.length && innerWidth < 900) document.body.classList.add('props-open'); });
  AS.bus.on('history', () => { UI.syncTop(); UI.markDirty(); if (UI.panel === 'history') UI.refreshPanel(); });
  AS.bus.on('floor', () => { UI.syncFloors(); UI.refreshAll(); V3.invalidate(); });
  AS.bus.on('tool', (t) => { $$('#toolbar [data-tool]').forEach(b => { b.classList.toggle('on', b.dataset.tool === t); b.setAttribute('aria-pressed', b.dataset.tool === t); }); $('#stTool').textContent = AS.editor.TOOLS[t]?.name || ''; });
  AS.bus.on('pointer', AS.throttle((p) => { $('#stPos').textContent = `X ${AS.units.fmt(p.x)} · Y ${AS.units.fmt(p.y)}`; }, 50));
  AS.bus.on('view', AS.throttle(UI.syncStatus, 100));
  AS.bus.on('saved', (where) => { const c = $('#saveState'); if (where) { c.textContent = 'Salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); c.title = 'Salvo em: ' + where.join(' + '); c.className = 'chip ok'; } else { c.textContent = 'Não salvo'; c.className = 'chip warn'; c.title = 'O armazenamento falhou. Exporte o JSON.'; } });
  AS.bus.on('storage', () => { if (UI.panel === 'projects' || UI.panel === 'settings') UI.refreshPanel(); });
  UI.markDirty = () => { const c = $('#saveState'); c.textContent = 'Alterações não salvas'; c.className = 'chip'; c.title = 'Ctrl+S para salvar'; if (UI.autosave) UI.autosaveSoon(); };
  UI.autosaveSoon = AS.debounce(() => AS.storage.saveCurrent(false), 2500);
  window.addEventListener('resize', AS.throttle(() => { R2.resize(); V3.resize(); }, 100));

  // projeto inicial: último aberto (se houver) ou exemplo
  let p = null;
  const lastId = AS.storage.ls('asu.last');
  if (lastId) { try { p = AS.normalizeProject(await AS.storage.load(lastId)); } catch (e) { p = null; } }
  AS.loadProject(p || AS.sampleProject());
  AS.bus.on('project', () => AS.storage.ls('asu.last', S.project.id));
  AS.bus.on('saved', (w) => { if (w) AS.storage.ls('asu.last', S.project.id); });
  UI.setViewMode(innerWidth < 900 ? 'plan' : 'split');
  UI.openPanel(innerWidth < 900 ? null : (p ? 'projects' : 'import'));
  if (!p) { $('#saveState').textContent = 'Exemplo (não salvo)'; $('#saveState').className = 'chip'; }
  if (!AS.storage.ls('asu.welcomed')) setTimeout(UI.showWelcome, 300);
  AS.storage.init();
  window.__AS_READY = true;
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', AS.boot); else AS.boot();
