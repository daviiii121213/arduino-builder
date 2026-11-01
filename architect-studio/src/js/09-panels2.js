/* ==========================================================================
   09 — Painéis de Importação (PDF) e Geração automática
   ========================================================================== */

AS.importUI = {
  result: null, page: 1, candidates: null,
  render(el) {
    const fl = AS.floor(), bg = fl.bg, imp = AS.importer, r = this.result;
    const dimRe = /^(\d{1,2}[.,]\d{2}|\d{2,4})$/;
    const roomRe = new RegExp('^(' + ['sala', 'estar', 'jantar', 'cozinha', 'copa', 'quarto', 'dormit', 'suite', 'suíte', 'banho', 'banheiro', 'wc', 'lavabo', 'lavand', 'área de serviço', 'a\\. serv', 'garagem', 'abrigo', 'circula', 'hall', 'corredor', 'varanda', 'sacada', 'terraço', 'escrit', 'depósito', 'despensa', 'closet', 'escada', 'gourmet', 'churrasq'].join('|') + ')', 'i');
    let html = `<div class="sec callout ${S.project.meta?.source === 'pdf' ? 'ok' : 'warn'}">${icon(S.project.meta?.source === 'pdf' ? 'check' : 'warn')}<div><b>PDF da sua casa</b><br>${S.project.meta?.source === 'pdf' ? 'Reconstrução em andamento a partir de: ' + esc(S.project.meta.file || 'PDF importado') : 'Não foi recebido nenhum PDF nesta conversa, então a casa ainda não foi reconstruída. Carregue o arquivo aqui para importar a planta.'}</div></div>
      <div class="sec"><label class="drop" id="impDrop"><input type="file" id="impFile" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" hidden>${icon('import', 'lg')}<b>Escolher PDF ou imagem da planta</b><span>ou arraste o arquivo para cá · PDF, PNG, JPG, WEBP</span></label></div>`;
    if (r) {
      html += `<div class="sec"><h4>Análise de “${esc(imp.fileName)}”</h4>`;
      if (r.kind === 'pdf') {
        html += `<p class="mtext">${r.numPages} página(s)${r.numPages > 30 ? ' (analisadas as 30 primeiras)' : ''}. Clique na página que contém a planta baixa.</p><div class="pages">${r.pages.map(p => {
          const kind = p.images === 0 ? (p.paths > 0 ? 'Vetorial' : 'Sem desenho') : p.paths < 20 ? 'Imagem (raster)' : 'Misto (vetor + imagem)';
          const dims = (p.text || []).filter(t => dimRe.test(t.str.trim())).length;
          return `<button class="pg ${this.page === p.n ? 'on' : ''}" data-n="${p.n}"><img src="${p.thumb}" alt="Página ${p.n}"><span>Pág. ${p.n} · ${kind}</span><small>${(p.text || []).length} textos · ${dims} cotas · ${p.paths} traços</small></button>`;
        }).join('')}</div>`;
        const pg = r.pages.find(p => p.n === this.page);
        if (pg?.text?.length) {
          const rooms = pg.text.filter(t => roomRe.test(t.str.trim())), dims = pg.text.filter(t => dimRe.test(t.str.trim()));
          html += `<details class="txt-found" ${rooms.length ? 'open' : ''}><summary>Textos encontrados na página ${pg.n}: ${rooms.length} nomes de cômodos, ${dims.length} possíveis cotas</summary>
            <p class="muted">Nomes: ${rooms.map(t => esc(t.str)).join(' · ') || '—'}</p><p class="muted mono">Cotas: ${dims.slice(0, 80).map(t => esc(t.str)).join(' · ') || '—'}</p></details>`;
        } else if (pg) html += `<p class="muted">Nenhum texto selecionável nesta página (provavelmente uma imagem digitalizada). As cotas precisarão ser lidas visualmente.</p>`;
      } else html += `<div class="pages"><button class="pg on"><img src="${r.pages[0].thumb}" alt="Imagem"><span>${r.pages[0].w} × ${r.pages[0].h} px</span></button></div>`;
      html += `<button class="btn primary block" id="impUse">${icon('check')} Usar ${r.kind === 'pdf' ? 'página ' + this.page : 'imagem'} como referência no pavimento “${esc(fl.name)}”</button></div>`;
    }
    if (bg) {
      const cmpx = bg.scale;
      html += `<div class="sec"><h4>Referência no pavimento</h4>
        <div class="kv"><span>Escala</span><b class="mono">${cmpx.toFixed(3)} cm/px ${bg.calibrated ? '<em class="okc">calibrada</em>' : '<em class="unc">não calibrada</em>'}</b><span>Tamanho no terreno</span><b class="mono">${AS.units.fmt(bg.w * cmpx)} × ${AS.units.fmt(bg.h * cmpx)}</b></div>
        <label class="fld wide"><span class="fl">Opacidade</span><input type="range" id="bgOp" min="0.05" max="1" step="0.05" value="${bg.opacity}"></label>
        <div class="chks">${UI.f.check('bgVis', 'Visível', bg.visible !== false)}</div>
        <div class="btnrow"><button class="btn sm ${S.tool === 'calibrate' ? 'on' : ''}" id="bgCal">${icon('measure')} Calibrar com cota conhecida</button><button class="btn sm" id="bgScale">Escala do desenho 1:N</button><button class="btn sm ${S.tool === 'bgmove' ? 'on' : ''}" id="bgMove">${icon('pan')} Posicionar</button><button class="btn sm" id="bgRot">↻ Girar 90°</button><button class="btn sm danger" id="bgDel">${icon('trash')} Remover</button></div></div>
        <div class="sec"><h4>Reconstruir sobre a referência</h4>
        <ol class="steps sm"><li>Calibre a escala: clique em <b>Calibrar</b>, marque as duas pontas de uma cota legível e digite o valor real.</li><li>Desenhe as paredes externas com <kbd>W</kbd> por cima do desenho (os snaps conectam os cantos), depois as internas.</li><li>Insira portas <kbd>D</kbd> e janelas <kbd>J</kbd> onde aparecem no PDF; ajuste larguras pelas cotas.</li><li>Nomeie os cômodos e marque como “medidas estimadas” os que não tiverem cota legível.</li></ol>
        <div class="btnrow"><button class="btn sm" id="trWall">${icon('wall')} Decalcar paredes</button>${bg.text?.length ? `<button class="btn sm" id="trLabels">Criar rótulos a partir dos textos</button>` : ''}</div></div>
        <div class="sec" id="lrSec"><h4>Leitor de linhas da imagem</h4>
        <p class="mtext">Mapeia <b>todas as linhas</b> da imagem, em qualquer direção (inclusive diagonais), e transforma cada uma em uma <b>parede editável</b>. Funciona com foto, desenho escaneado, PNG/JPG ou página de PDF.</p>
        <div class="grid2">${UI.f.sel('lrThr', 'Limiar de escuro', [{ v: 'auto', l: 'Automático' }, ...[70, 90, 110, 130, 150, 170, 190].map(v => ({ v, l: String(v) }))], 'auto')}${UI.f.len('lrMin', 'Comprimento mínimo da linha', 30)}
        ${UI.f.sel('lrTm', 'Espessura da parede', [{ v: 'auto', l: 'Pela largura do traço' }, { v: 'fixo', l: 'Valor fixo' }], 'auto')}${UI.f.len('lrT', 'Espessura fixa / mínima', 12)}</div>
        <div class="chks">${UI.f.check('lrStr', 'Endireitar linhas quase retas', true)}${UI.f.check('lrTxt', 'Ignorar textos e detalhes pequenos', true)}${UI.f.check('lrDbl', 'Unir linhas duplas em uma parede', false, 'Paredes desenhadas com duas linhas paralelas viram uma parede só')}${UI.f.check('lrGap', 'Transformar vãos em portas (fecha os cômodos)', true)}${UI.f.check('lrArc', 'Ignorar arcos de abertura de porta', true)}${UI.f.check('lrLoose', 'Ignorar linhas soltas (cotas)', false)}</div>
        ${UI.f.check('lrReplace', 'Substituir paredes já existentes neste pavimento', fl.walls.length > 0)}
        <button class="btn primary block" id="lrRun">${icon('wall')} Mapear linhas como paredes</button><div id="lrOut"></div></div>
        <div class="sec" id="rgSec"><h4>Leitor automático da planta</h4>
        <p class="mtext">Lê o desenho ${AS.importer.doc && bg.source === AS.importer.fileName ? 'vetorial do PDF' : 'da imagem'} e reconhece <b>paredes, portas, janelas, vãos e nomes de cômodos</b>. A escala é deduzida das cotas do PDF quando possível. O resultado entra no projeto como paredes normais, editáveis e desfazíveis.</p>
        <div class="grid2">${UI.f.len('rgTmin', 'Espessura mínima de parede', 5)}${UI.f.len('rgTmax', 'Espessura máxima de parede', 45)}${UI.f.len('rgMin', 'Comprimento mínimo', 40)}${AS.importer.doc && bg.source === AS.importer.fileName ? '' : UI.f.num('rgThr', 'Limiar de escuro (imagem)', 110, '0–255', 5)}</div>
        ${UI.f.check('rgReplace', 'Substituir paredes, aberturas e cômodos já existentes neste pavimento', fl.walls.length > 0)}
        <button class="btn primary block" id="rgRun">${icon('generate')} Ler planta e reconhecer paredes</button><div id="rgOut"></div></div>`;
    }
    el.innerHTML = html;
    const fileIn = el.querySelector('#impFile'), drop = el.querySelector('#impDrop');
    fileIn.onchange = () => fileIn.files[0] && this.load(fileIn.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) this.load(f); };
    el.querySelectorAll('.pg[data-n]').forEach(b => b.onclick = () => { this.page = +b.dataset.n; this.render(el); });
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    on('impUse', () => this.useCurrent());
    if (bg) {
      el.querySelector('#bgOp').oninput = (e) => { bg.opacity = +e.target.value; R2.req(); };
      el.querySelector('#bgVis').onchange = (e) => { bg.visible = e.target.checked; R2.req(); };
      on('bgCal', () => { AS.editor.setTool('calibrate'); if (S.viewMode === '3d') UI.setViewMode('split'); this.render(el); });
      on('bgMove', () => { AS.editor.setTool(S.tool === 'bgmove' ? 'select' : 'bgmove'); this.render(el); });
      on('bgRot', () => AS.history.run('Girar referência', () => { bg.rot = ((bg.rot || 0) + 90) % 360; }));
      on('bgDel', () => UI.confirm('Remover referência', 'Remover a imagem de referência deste pavimento? As paredes desenhadas permanecem.', 'Remover', () => { AS.history.run('Remover referência', () => { delete S.project.assets[bg.asset]; fl.bg = null; }); UI.refreshPanel(); }));
      on('bgScale', () => this.scaleDialog());
      on('trWall', () => { AS.editor.setTool('wall'); if (S.viewMode === '3d') UI.setViewMode('split'); });
      on('trLabels', () => this.labelsFromText());
      on('rgRun', () => this.recognize(el));
      on('lrRun', () => this.readLines(el));
      if (AS.recognizer.preview) this.showRecognition(el, AS.recognizer.preview.report.mode === 'linhas da imagem' ? 'lr' : 'rg');
    }
  },
  async load(file) {
    const el = $('#panelBody');
    try {
      AS.toast('Lendo ' + file.name + '…');
      this.result = await AS.importer.loadFile(file); this.page = 1;
      // escolhe automaticamente a página com mais traços vetoriais / textos de cômodos
      if (this.result.kind === 'pdf' && this.result.pages.length > 1) { const best = [...this.result.pages].sort((a, b) => (b.paths + b.text.length * 3) - (a.paths + a.text.length * 3))[0]; this.page = best.n; }
      AS.toast('Arquivo analisado: ' + (this.result.pages.length) + ' página(s)', 'ok');
    } catch (e) { console.error(e); AS.toast(e.message || 'Falha ao ler o arquivo', 'err'); }
    if (UI.panel === 'import') this.render(el);
  },
  async useCurrent() {
    try {
      const r = await AS.importer.renderPage(this.page);
      const pg = AS.importer.pages.find(p => p.n === this.page);
      const text = (pg.text || []).map(t => ({ str: t.str, x: t.x * r.ptScale, y: t.y * r.ptScale }));
      AS.importer.setReference(r.url, r.w, r.h, { source: AS.importer.fileName, page: this.page, text, ptScale: r.ptScale });
      if (S.project.meta?.source !== 'pdf') { S.project.meta = { ...(S.project.meta || {}), source: 'pdf', file: AS.importer.fileName }; }
      UI.setViewMode('split'); UI.refreshPanel();
      AS.toast('Referência importada. Use o Leitor automático ou calibre a escala com uma cota conhecida.', 'ok');
    } catch (e) { AS.toast(e.message, 'err'); }
  },
  scaleDialog() {
    const bg = AS.floor().bg; if (!bg) return;
    UI.modal('Escala do desenho', `<p class="mtext">Para PDFs vetoriais impressos em escala (ex.: 1:50, 1:100). Use somente se a escala estiver indicada na prancha e o PDF não tiver sido redimensionado.</p>${UI.f.num('scN', 'Escala 1 :', 100, '', 1)}`,
      [{ label: 'Cancelar' }, { label: 'Aplicar', kind: 'primary', fn: () => {
        const N = parseFloat($('#scN').value); if (!(N > 0)) return false;
        // 1 pt = 0,035278 cm no papel; px = pt * ptScale
        const cmPerPx = 0.0352778 * N / (bg.ptScale || 1);
        AS.history.run('Escala do desenho', () => { bg.scale = cmPerPx; bg.calibrated = true; }); R2.fit(); UI.refreshPanel();
        AS.toast(`Escala 1:${N} aplicada (${cmPerPx.toFixed(3)} cm/px). Confira com uma cota!`);
      } }]);
  },
  labelsFromText() {
    const fl = AS.floor(), bg = fl.bg; if (!bg?.text?.length) return;
    const types = [['suíte|suite', 'suite'], ['quarto|dormit', 'quarto'], ['banh|wc|lavabo|sanit', 'banheiro'], ['cozinha|copa', 'cozinha'], ['jantar', 'jantar'], ['sala|estar|living', 'sala'], ['lavand|serviço|a\\. serv', 'lavanderia'], ['garag|abrigo', 'garagem'], ['circula|hall|corredor', 'circulacao'], ['varanda|sacada|terraço|gourmet', 'varanda'], ['escrit', 'escritorio'], ['depós|despensa|closet', 'deposito'], ['escada', 'escada']];
    const toPlan = (t) => { let x = t.x * bg.scale, y = t.y * bg.scale; if (bg.rot) { const q = AS.geo.rot({ x, y }, AS.rad(bg.rot)); x = q.x; y = q.y; } return { x: bg.x + x, y: bg.y + y }; };
    let n = 0;
    AS.history.run('Rótulos a partir do PDF', () => {
      for (const t of bg.text) {
        const s = t.str.trim(); const ty = types.find(([re]) => new RegExp('^(' + re + ')', 'i').test(s)); if (!ty) continue;
        const p = toPlan(t);
        if (fl.roomMeta.some(m => AS.geo.dist(m.anchor, p) < 50)) continue;
        AS.addRoomMeta(p, s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), ty[1], fl, { note: 'Nome lido do PDF' }); n++;
      }
    });
    AS.toast(n ? `${n} rótulo(s) de cômodo criados nas posições do PDF` : 'Nenhum nome de cômodo reconhecido nos textos', n ? 'ok' : '');
  },
  async readLines(el) {
    const out = el.querySelector('#lrOut'); out.innerHTML = '<p class="muted">Mapeando linhas…</p>';
    AS.recognizer.discard();
    await new Promise(r => setTimeout(r, 30));
    try {
      const v = (id) => el.querySelector('#' + id);
      const tm = v('lrTm').value, t = AS.units.parse(v('lrT').value), minLen = AS.units.parse(v('lrMin').value);
      if (!(t > 0 && minLen > 0)) throw new Error('Verifique a espessura e o comprimento mínimo.');
      const res = await AS.lineReader.read({ threshold: v('lrThr').value, minLen, thickMode: tm, thick: t, minThick: tm === 'auto' ? t : 4, straighten: v('lrStr').checked, ignoreText: v('lrTxt').checked, mergeDouble: v('lrDbl').checked, fillGaps: v('lrGap').checked, ignoreArcs: v('lrArc').checked, ignoreLoose: v('lrLoose').checked });
      AS.recognizer.showPreview(res);
      if (S.viewMode === '3d') UI.setViewMode('split');
      const pts = res.floor.walls.flatMap(w => [w.a, w.b]); R2.fit(AS.floor(), 60, pts.length ? pts : null);
      this.showRecognition(el, 'lr');
      el.querySelector('#lrOut')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) { console.error(e); out.innerHTML = `<p class="err-line">${esc(e.message)}</p>`; }
  },
  async recognize(el) {
    const out = el.querySelector('#rgOut'); out.innerHTML = '<p class="muted">Lendo a planta…</p>';
    AS.recognizer.discard();
    try {
      const opts = { minT: AS.units.parse(el.querySelector('#rgTmin').value), maxT: AS.units.parse(el.querySelector('#rgTmax').value), minLen: AS.units.parse(el.querySelector('#rgMin').value) };
      const thr = el.querySelector('#rgThr'); if (thr) opts.threshold = +thr.value;
      if (!(opts.minT > 0 && opts.maxT > opts.minT && opts.minLen > 0)) throw new Error('Verifique as espessuras e o comprimento mínimo.');
      const res = await AS.recognizer.recognize(opts);
      AS.recognizer.showPreview(res);
      if (S.viewMode === '3d') UI.setViewMode('split');
      const pts = res.floor.walls.flatMap(w => [w.a, w.b]);
      R2.fit(AS.floor(), 60, pts.length ? pts : null);
      this.showRecognition(el);
      el.querySelector('#rgOut')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (e) { console.error(e); out.innerHTML = `<p class="err-line">${esc(e.message)}</p>`; }
  },
  showRecognition(el, which = 'rg') {
    const pv = AS.recognizer.preview, out = el.querySelector(which === 'lr' ? '#lrOut' : '#rgOut'); if (!pv || !out) return;
    const r = pv.report, c = r.counts;
    out.innerHTML = `<div class="rg-res"><div class="kv">
      <span>Método</span><b>${esc(r.mode)}</b>
      <span>Escala</span><b class="mono">${r.scale.toFixed(3)} cm/px</b><span></span><b class="rg-src">${esc(r.scaleSource)}</b>
      <span>Paredes</span><b class="mono">${c.walls} (típica ${c.typical} cm)</b>
      ${r.extra ? `<span>Linhas diagonais</span><b class="mono">${r.extra.angled}</b><span>Limiar usado</span><b class="mono">${r.extra.threshold}</b><span>Textos/ruído ignorados</span><b class="mono">${r.extra.removed}</b><span>Arcos de porta ignorados</span><b class="mono">${r.extra.arcs}</b>${r.extra.loose ? `<span>Linhas soltas ignoradas</span><b class="mono">${r.extra.loose}</b>` : ''}<span>Vãos → portas / passagens</span><b class="mono">${c.doors} / ${c.passages}</b>${r.extra.paired ? `<span>Linhas duplas unidas</span><b class="mono">${r.extra.paired}</b>` : ''}<span>Tempo</span><b class="mono">${(r.extra.ms / 1000).toFixed(1)} s</b>` : `<span>Portas</span><b class="mono">${c.doors}</b><span>Janelas</span><b class="mono">${c.windows}</b><span>Vãos livres</span><b class="mono">${c.passages}</b>`}
      <span>Cômodos fechados</span><b class="mono">${c.rooms}${r.extra ? '' : ` (${c.named} com nome do PDF)`}</b></div>
      ${r.warnings.length ? `<ul class="issues">${r.warnings.map(w => `<li class="lv-aviso">${esc(w)}</li>`).join('')}</ul>` : ''}
      <p class="muted">Prévia na planta: paredes externas em laranja, internas em azul, cômodos em verde. Nada foi adicionado ainda.</p>
      <div class="btnrow"><button class="btn primary sm" id="rgApply" ${c.walls ? '' : 'disabled'}>${icon('check')} Aplicar ao projeto</button><button class="btn sm" id="rgDiscard">Descartar</button></div></div>`;
    out.querySelector('#rgApply').onclick = () => { const rep = el.querySelector(which === 'lr' ? '#lrReplace' : '#rgReplace')?.checked; AS.recognizer.apply(!!rep); UI.refreshPanel(); R2.fit(); V3.frame(); V3.invalidate(); };
    out.querySelector('#rgDiscard').onclick = () => { AS.recognizer.discard(); out.innerHTML = ''; };
  },
  async detect(el) {
    const out = el.querySelector('#dtOut'); out.innerHTML = '<p class="muted">Analisando imagem…</p>';
    try {
      const cand = await AS.importer.detectWalls({ threshold: +el.querySelector('#dtThr').value, minLenCm: AS.units.parse(el.querySelector('#dtMin').value), minThickCm: AS.units.parse(el.querySelector('#dtTmin').value), maxThickCm: AS.units.parse(el.querySelector('#dtTmax').value) });
      this.candidates = cand;
      if (!cand.length) { out.innerHTML = '<p class="muted">Nenhuma parede encontrada com esses parâmetros. Tente aumentar o limiar ou calibrar a escala.</p>'; return; }
      out.innerHTML = `<p class="mtext">${cand.length} segmento(s) candidato(s). Espessuras: ${[...new Set(cand.map(c => c.thickness))].sort((a, b) => a - b).slice(0, 8).join(', ')} cm.</p><div class="btnrow"><button class="btn sm primary" id="dtAdd">Adicionar ${cand.length} paredes</button></div>`;
      el.querySelector('#dtAdd').onclick = () => {
        AS.history.run('Paredes detectadas', () => {
          for (const c of cand) AS.addWall(c.a, c.b, { thickness: c.thickness, type: c.thickness >= 18 ? 'exterior' : 'interior', note: 'Detectada automaticamente' });
          AS.autoFix(); AS.splitAtIntersections();
        });
        AS.toast(`${cand.length} paredes adicionadas — revise e corrija onde necessário`, 'ok');
      };
    } catch (e) { out.innerHTML = `<p class="err-line">${esc(e.message)}</p>`; }
  },
};

/* Calibração: pede a distância real depois que o usuário marca 2 pontos */
AS.bus.on('calibrate', (pts) => {
  const d = AS.geo.dist(pts[0], pts[1]);
  UI.modal('Calibrar escala', `<p class="mtext">Distância marcada na referência: <b class="mono">${AS.units.fmt(d)}</b> (escala atual). Digite a medida real dessa cota, como está escrita no PDF.</p>${UI.f.len('calV', 'Medida real', d)}`,
    [{ label: 'Cancelar', fn: () => { AS.editor.setTool('calibrate'); } }, { label: 'Calibrar', kind: 'primary', fn: () => {
      const v = AS.units.parse($('#calV').value); if (!(v > 0)) { AS.toast('Medida inválida', 'err'); return false; }
      AS.importer.calibrate(pts[0], pts[1], v); AS.editor.setTool('select'); UI.refreshPanel();
      AS.toast(`Escala calibrada: ${AS.floor().bg.scale.toFixed(3)} cm/px. Confira com outra cota.`, 'ok');
    } }]);
});

AS.genUI = {
  req: { ...AS.GEN_DEFAULTS }, alts: null,
  render(el) {
    const q = this.req, F2 = UI.f;
    el.innerHTML = `<div class="sec"><p class="mtext">Gera plantas preliminares editáveis a partir do programa de necessidades. Cada alternativa tem paredes, portas, janelas e cômodos reais. <b>Não é projeto certificado.</b></p></div>
      <form class="sec" id="genForm"><div class="grid2">${F2.num('gA', 'Área desejada', q.area, 'm²', 5)}${F2.num('gF', 'Pavimentos', q.floors, '', 1)}${F2.num('gB', 'Quartos', q.bedrooms, '', 1)}${F2.num('gW', 'Banheiros', q.bathrooms, '', 1)}
      ${F2.sel('gK', 'Cozinha', [{ v: 'p', l: 'Compacta' }, { v: 'm', l: 'Média' }, { v: 'g', l: 'Ampla' }], q.kitchen)}${F2.sel('gL', 'Sala', [{ v: 'p', l: 'Compacta' }, { v: 'm', l: 'Média' }, { v: 'g', l: 'Ampla' }], q.living)}
      ${F2.sel('gG', 'Garagem', [{ v: 0, l: 'Sem garagem' }, { v: 1, l: '1 vaga' }, { v: 2, l: '2 vagas' }], q.garage)}${F2.sel('gS', 'Estilo', [{ v: 'contemporaneo', l: 'Contemporâneo (integrado)' }, { v: 'classico', l: 'Clássico (ambientes separados)' }, { v: 'compacto', l: 'Compacto (paredes finas)' }], q.style)}</div>
      <div class="chks">${F2.check('gSu', 'Suíte (com 2+ banheiros)', q.suite)}${F2.check('gLa', 'Lavanderia', q.laundry)}${F2.check('gBa', 'Varanda / sacada', q.balcony)}${F2.check('gAc', 'Acessibilidade', q.accessible)}</div>
      <label class="fld wide"><span class="fl">Instruções especiais</span><textarea id="gN" class="inp" rows="2" placeholder="Ex.: cozinha voltada para os fundos">${esc(q.notes)}</textarea></label>
      <button class="btn primary block" type="submit">${icon('generate')} Gerar 3 alternativas</button></form>
      <div id="genAlts"></div>`;
    el.querySelector('#genForm').onsubmit = (e) => { e.preventDefault(); this.read(el); this.generate(el); };
    if (this.alts) this.showAlts(el);
  },
  read(el) {
    const v = (id) => el.querySelector('#' + id);
    Object.assign(this.req, { area: AS.clamp(+v('gA').value || 120, 30, 800), floors: AS.clamp(+v('gF').value || 1, 1, 2), bedrooms: AS.clamp(+v('gB').value | 0, 0, 6), bathrooms: AS.clamp(+v('gW').value || 1, 1, 5), kitchen: v('gK').value, living: v('gL').value, garage: +v('gG').value, style: v('gS').value, suite: v('gSu').checked, laundry: v('gLa').checked, balcony: v('gBa').checked, accessible: v('gAc').checked, notes: v('gN').value });
  },
  generate(el) {
    try { this.alts = [0, 1, 2].map(i => AS.generatePlan(this.req, i)); }
    catch (e) { console.error(e); AS.toast('Não foi possível gerar: ' + e.message, 'err'); return; }
    this.showAlts(el);
  },
  showAlts(el) {
    const box = el.querySelector('#genAlts'); if (!box) return;
    const cur = S.project;
    box.innerHTML = `<div class="sec"><h4>Alternativas</h4><div class="alts">${this.alts.map((p, i) => {
      S.project = p; AS.changed(true);
      const ms = p.floors.map(f => AS.metrics(f)); const util = ms.reduce((s, m) => s + m.util, 0), built = ms.reduce((s, m) => s + m.built, 0), n = ms.reduce((s, m) => s + m.rooms, 0);
      return `<div class="alt"><canvas width="300" height="200" data-i="${i}"></canvas><b>Opção ${i + 1}</b><small class="mono">${AS.units.fmtArea(built)} constr. · ${AS.units.fmtArea(util)} útil · ${n} cômodos${p.floors.length > 1 ? ' · 2 pav.' : ''}</small><button class="btn sm" data-use="${i}">Abrir esta opção</button></div>`;
    }).join('')}</div></div>`;
    box.querySelectorAll('canvas[data-i]').forEach(cv => {
      const p = this.alts[+cv.dataset.i]; S.project = p; AS.changed(true);
      const fl = p.floors[0], pts = fl.walls.flatMap(w => [w.a, w.b]), b = AS.geo.bbox(pts), s = Math.min(280 / b.w, 180 / b.h);
      const ctx = cv.getContext('2d'); const sv = p.settings.showDims; p.settings.showDims = false; const sg = p.settings.showGrid; p.settings.showGrid = false;
      R2._center = { x: b.x0 + b.w / 2, y: b.y0 + b.h / 2 };
      R2.drawPlan(ctx, { view: { s, ox: 150 - (b.x0 + b.w / 2) * s, oy: 100 - (b.y0 + b.h / 2) * s }, w: 300, h: 200, export: true, floor: fl });
      p.settings.showDims = sv; p.settings.showGrid = sg;
    });
    S.project = cur; AS.changed(true);
    box.querySelectorAll('[data-use]').forEach(b => b.onclick = async () => {
      const p = AS.clone(this.alts[+b.dataset.use]); p.id = AS.uid('prj');
      if (AS.history.undo.length) await AS.storage.saveCurrent();
      AS.loadProject(AS.normalizeProject(p)); AS.toast('Alternativa aberta como novo projeto. O anterior foi salvo.', 'ok');
    });
  },
};
