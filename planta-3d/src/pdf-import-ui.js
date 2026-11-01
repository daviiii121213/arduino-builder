/* ================= Importar PDF (planta vetorial → projeto editável) ================= */
const IMPS={file:'',pages:[],cur:-1,selW:-1,selO:null,view:null,sample:undefined,abort:null};
const PDFJS_BASE='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function piLoadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=()=>res(); s.onerror=()=>rej(new Error('Falha ao carregar '+src)); document.head.appendChild(s); }); }
// pdf.js roda na própria página (pdfjsWorker global = "fake worker"), sem precisar de Worker de outra origem
async function piPdfJs(){ if(!window.pdfjsLib) await piLoadScript(PDFJS_BASE+'pdf.min.js'); if(!window.pdfjsWorker) await piLoadScript(PDFJS_BASE+'pdf.worker.min.js'); return window.pdfjsLib; }
const piMsg=t=>{ $('pi-msg').textContent=t; };
const KIND_OPTS=[['slide','Janela de correr'],['pj','Porta-janela'],['bascula','Basculante'],['door','Porta de abrir'],['pivot','Porta pivotante'],['slide-door','Porta de correr']];
const kindVal=o=> o.kind==='slide'&&(o.sill||0)===0? 'pj' : o.kind;
function setKind(o,v){ if(v==='pj'){ o.kind='slide'; o.sill=0; o.n=2; if(!o.h||o.h<180) o.h=210; }
  else if(v==='slide'){ o.kind='slide'; o.n=2; if(!(o.sill>0)) { o.sill=110; o.h=100; } }
  else if(v==='bascula'){ o.kind='bascula'; delete o.n; if(!(o.sill>0)) { o.sill=160; o.h=50; } }
  else { o.kind=v; o.sill=0; o.h=210; delete o.n; if(v!=='slide-door'){ o.door=Object.assign({hinge:'a',side:1,ang:90,leaf:o.w-8},o.door||{}); if(v==='pivot') Object.assign(o.door,{mat:'entry',th:5}); else { delete o.door.mat; delete o.door.th; } } else delete o.door; }
  o.conf='alta'; }
function floorOfText(txt){ if(/T[ÉE]RREO|PAV(?:IMENTO)?\.?\s*T[ÉE]RREO/i.test(txt)) return 'G'; if(/SUPERIOR|1[ºo°]\s*PAV|PAVIMENTO\s+1\b/i.test(txt)) return 'U'; return ''; }
function piConf(det){ const ts={}; det.walls.forEach(w=>{ const k=Math.round(w.t); ts[k]=(ts[k]||0)+1; }); const modeT=+Object.keys(ts).sort((a,b)=>ts[b]-ts[a])[0];
  det.walls.forEach(w=>{ const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]); w.on=true; w.conf= Math.abs(w.t-modeT)<=1.5&&L>=2*w.t? 'alta':'media';
    w.ops.forEach(o=>{ o.conf= (o.kind==='slide'||o.kind==='bascula')? (o._lab?'alta':'media') : 'alta'; }); }); }
function piDetect(pg){ pg.det= pg.den? PDFIMP.detect(pg.prims,pg.den,{wallH:+$('pi-h').value||300}) : null; if(pg.det) piConf(pg.det); if(pg.det&&pg.det.walls.length===0) pg.det=null; if(!pg.det) pg.on=false; IMPS.selW=-1; IMPS.selO=null; }
async function piOpenFile(file){ $('pdfimp').hidden=false; document.body.classList.add('pdfimp'); $('pi-file').textContent='Lendo '+file.name+'…'; $('pi-pages').replaceChildren(); $('pi-walls').replaceChildren(); $('pi-ops').replaceChildren(); $('pi-svg').replaceChildren(); piMsg('');
  IMPS.file=file.name.replace(/\.pdf$/i,''); IMPS.pages=[]; IMPS.cur=-1; $('pi-rtitle').hidden=true; $('pi-rooms').hidden=true; $('pi-claude-msg').hidden=true;
  let lib; try{ lib=await piPdfJs(); }catch(e){ $('pi-file').textContent='Não foi possível carregar o leitor de PDF (pdf.js). Verifique a conexão.'; return; }
  let doc; try{ doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise; }catch(e){ $('pi-file').textContent='Esse arquivo não pôde ser lido como PDF'+(e&&e.name==='PasswordException'?' (protegido por senha).':'.'); return; }
  const used=new Set();
  for(let i=1;i<=doc.numPages;i++){ $('pi-file').textContent='Analisando página '+i+' de '+doc.numPages+'…';
    const page=await doc.getPage(i); const prims=await PDFIMP.extractPage(page,lib.OPS); const txt=prims.texts.map(t=>t.str).join(' ');
    const den0=PDFIMP.scaleFromText(prims.texts); const den= den0||PDFIMP.guessScale(prims);
    // imagem da página (fundo da revisão e entrada para o Claude)
    const vp1=page.getViewport({scale:1}), k=Math.min(3,2000/Math.max(vp1.width,vp1.height)), vp=page.getViewport({scale:k});
    const cv=document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height); const cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height);
    try{ await page.render({canvasContext:cx,viewport:vp}).promise; }catch(e){}
    const pg={n:i,prims,den,denSrc: den0? 'lida no PDF ("Escala 1:'+den0+'")' : den? 'estimada pelas cotas' : '', canvas:cv, url:cv.toDataURL('image/png'), W:prims.W, H:prims.H, fk:floorOfText(txt), on:false};
    piDetect(pg); if(!pg.det) pg.fk=''; if(pg.det){ if(!pg.fk||used.has(pg.fk)) pg.fk= used.has('G')? (used.has('U')?'':'U') : 'G'; if(pg.fk){ used.add(pg.fk); pg.on=true; } }
    IMPS.pages.push(pg); }
  const n=IMPS.pages.filter(p=>p.det).length;
  $('pi-file').textContent=file.name+' · '+doc.numPages+' página(s), '+n+' com planta vetorial.'+(n? '' : ' Nenhuma parede encontrada: o PDF precisa ser vetorial (exportado do CAD), não escaneado.');
  piSample(); piPick(Math.max(0,IMPS.pages.findIndex(p=>p.det))); }
function piPick(i){ IMPS.cur=i; IMPS.view=null; IMPS.selW=-1; IMPS.selO=null; piRender(); }
function piRenderPages(){ const box=$('pi-pages'); box.replaceChildren();
  IMPS.pages.forEach((pg,i)=>{ const d=document.createElement('div'); d.className='pi-page'+(i===IMPS.cur?' cur':''); d.addEventListener('click',e=>{ if(e.target.closest('input,select')) return; piPick(i); });
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=pg.on; cb.disabled=!pg.det; cb.setAttribute('aria-label','Importar página '+pg.n); cb.addEventListener('change',()=>{ pg.on=cb.checked; piRenderSummary(); });
    const t=document.createElement('span'); t.textContent='Página '+pg.n;
    const sel=document.createElement('select'); sel.setAttribute('aria-label','Pavimento da página '+pg.n); [['','—'],['G','Térreo'],['U','Superior']].forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; sel.appendChild(o); }); sel.value=pg.fk; sel.disabled=!pg.det;
    sel.addEventListener('change',()=>{ pg.fk=sel.value; IMPS.pages.forEach(q=>{ if(q!==pg&&q.fk===pg.fk&&pg.fk){ q.fk=''; q.on=false; } }); if(!pg.fk) pg.on=false; piRenderPages(); });
    const sm=document.createElement('small'); sm.textContent= pg.det? pg.det.walls.length+' paredes · '+pg.det.walls.reduce((s,w)=>s+w.ops.length,0)+' aberturas · escala 1:'+pg.den : (pg.den? 'sem paredes vetoriais' : 'sem paredes vetoriais ou escala');
    d.append(cb,t,sel,sm); box.appendChild(d); }); }
function piRenderSummary(){ const n=IMPS.pages.filter(p=>p.on&&p.fk&&p.det); $('pi-ok').disabled=!n.length; $('pi-ok').textContent=n.length? 'Criar projeto “Importado – '+IMPS.file+'”' : 'Selecione uma página com planta';
  piMsg(n.length? n.map(p=>(p.fk==='G'?'Térreo':'Superior')+': '+p.det.walls.filter(w=>w.on).length+' paredes, '+p.det.walls.filter(w=>w.on).reduce((s,w)=>s+w.ops.length,0)+' aberturas').join(' · ') : ''); }
function piRender(){ piRenderPages(); const pg=IMPS.pages[IMPS.cur]; $('pi-den').value= pg&&pg.den? pg.den : ''; $('pi-densrc').textContent= pg? (pg.denSrc||'informe a escala ou calibre por uma cota') : '';
  piRenderSvg(); piRenderLists(); piRenderSummary(); }
const SVGN='http://www.w3.org/2000/svg';
function piWallPoly(w){ const dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, nx=-uz, nz=ux, h=w.t/2; return [[w.a[0]+nx*h,w.a[1]+nz*h],[w.b[0]+nx*h,w.b[1]+nz*h],[w.b[0]-nx*h,w.b[1]-nz*h],[w.a[0]-nx*h,w.a[1]-nz*h]]; }
function piOpPoly(w,o){ const dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, nx=-uz, nz=ux, h=w.t/2+1.5, s0=o.c-o.w/2, s1=o.c+o.w/2; const P=(s,c)=>[w.a[0]+ux*s+nx*c,w.a[1]+uz*s+nz*c]; return [P(s0,h),P(s1,h),P(s1,-h),P(s0,-h)]; }
function piRenderSvg(){ const svg=$('pi-svg'); svg.replaceChildren(); const pg=IMPS.pages[IMPS.cur]; if(!pg) return;
  const s= pg.den? PDFIMP.ptPerCm(pg.den) : 1, Wc=pg.W/s, Hc=pg.H/s;   // coordenadas em cm da página
  if(!IMPS.view){ const r=svg.getBoundingClientRect(), panel= innerWidth>700? $('pi-panel').getBoundingClientRect().width+40 : 0, ph= innerWidth>700? 0 : innerHeight*0.52; let box=[0,0,Wc,Hc];
    if(pg.det){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; pg.det.walls.forEach(w=>[w.a,w.b].forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); })); box=[x0-120,z0-120,x1-x0+240,z1-z0+240]; }
    const aw=Math.max(200,r.width-panel), ah=Math.max(200,r.height-ph), sc=Math.max(box[2]/aw,box[3]/ah); IMPS.view={x:box[0]-(aw*sc-box[2])/2,y:box[1]-(ah*sc-box[3])/2,w:r.width*sc,h:r.height*sc}; }
  svg.setAttribute('viewBox',`${IMPS.view.x} ${IMPS.view.y} ${IMPS.view.w} ${IMPS.view.h}`); svg.setAttribute('preserveAspectRatio','xMinYMin meet');
  const el=(n,a,par)=>{ const e=document.createElementNS(SVGN,n); for(const k in a) e.setAttribute(k,a[k]); (par||svg).appendChild(e); return e; };
  el('image',{href:pg.url,x:0,y:0,width:Wc,height:Hc,opacity:.55,preserveAspectRatio:'none'});
  if(!pg.det) return; const pts=p=>p.map(q=>q[0].toFixed(2)+','+q[1].toFixed(2)).join(' ');
  pg.det.extras.forEach(x=>el('polygon',{points:pts(x),class:'x'}));
  pg.det.walls.forEach((w,i)=>{ const e=el('polygon',{points:pts(piWallPoly(w)),class:'w'+(w.on?'':' off')+(i===IMPS.selW?' sel':'')}); e.addEventListener('click',ev=>{ ev.stopPropagation(); piSelect(i,null); });
    const t=document.createElementNS(SVGN,'title'); t.textContent='Parede '+(i+1)+' · '+Math.round(Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]))+' × '+w.t+' cm'; e.appendChild(t); });
  pg.det.walls.forEach((w,i)=>{ if(!w.on) return; w.ops.forEach((o,j)=>{ const e=el('polygon',{points:pts(piOpPoly(w,o)),class:'o'+(/door|pivot/.test(o.kind)?' door':'')+(IMPS.selO&&IMPS.selO[0]===i&&IMPS.selO[1]===j?' sel':'')}); e.addEventListener('click',ev=>{ ev.stopPropagation(); piSelect(i,j); });
    const t=document.createElementNS(SVGN,'title'); t.textContent=(o.name||'')+' '+(KIND_OPTS.find(k=>k[0]===kindVal(o))||['',''])[1]+' · '+Math.round(o.w)+' cm'; e.appendChild(t); }); });
  pg.det.walls.forEach((w,i)=>{ const m=[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2]; const t=el('text',{x:m[0],y:m[1]+3,'text-anchor':'middle'}); t.textContent=String(i+1); }); }
function piSelect(i,j){ IMPS.selW=i; IMPS.selO= j==null? null : [i,j]; piRenderSvg(); piRenderLists(); const row=document.querySelector(j==null? `#pi-walls tr[data-i="${i}"]` : `#pi-ops tr[data-k="${i}:${j}"]`); if(row) row.scrollIntoView({block:'nearest'}); }
function piRenderLists(){ const pg=IMPS.pages[IMPS.cur]; const wb=$('pi-walls'), ob=$('pi-ops'); wb.replaceChildren(); ob.replaceChildren(); if(!pg||!pg.det){ $('pi-wtitle').textContent='Paredes'; $('pi-otitle').textContent='Aberturas'; return; }
  const W=pg.det.walls; $('pi-wtitle').textContent='Paredes ('+W.filter(w=>w.on).length+' de '+W.length+')';
  const wt=document.createElement('table'); const h=wt.insertRow(); ['','#','Compr.','Esp.','Vãos','Confiança'].forEach(x=>{ const th=document.createElement('th'); th.textContent=x; h.appendChild(th); });
  W.forEach((w,i)=>{ const tr=wt.insertRow(); tr.dataset.i=i; if(i===IMPS.selW&&!IMPS.selO) tr.className='sel'; tr.addEventListener('click',e=>{ if(e.target.closest('input')) return; piSelect(i,null); });
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=w.on; cb.setAttribute('aria-label','Incluir parede '+(i+1)); cb.addEventListener('change',()=>{ w.on=cb.checked; piRenderSvg(); piRenderSummary(); $('pi-wtitle').textContent='Paredes ('+W.filter(x=>x.on).length+' de '+W.length+')'; }); tr.insertCell().appendChild(cb);
    tr.insertCell().textContent=i+1; tr.insertCell().textContent=Math.round(Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]))+' cm'; tr.insertCell().textContent=w.t; tr.insertCell().textContent=w.ops.length;
    const c=document.createElement('span'); c.className='pi-conf '+w.conf; c.textContent=w.conf==='alta'?'alta':'média'; tr.insertCell().appendChild(c); });
  wb.appendChild(wt);
  const ops=[]; W.forEach((w,i)=>{ if(w.on) w.ops.forEach((o,j)=>ops.push([i,j,o])); }); $('pi-otitle').textContent='Aberturas ('+ops.length+')';
  const ot=document.createElement('table'); const h2=ot.insertRow(); ['Cód.','Tipo','Larg.','Alt.','Peit.','Conf.'].forEach(x=>{ const th=document.createElement('th'); th.textContent=x; h2.appendChild(th); });
  for(const [i,j,o] of ops){ const tr=ot.insertRow(); tr.dataset.k=i+':'+j; if(IMPS.selO&&IMPS.selO[0]===i&&IMPS.selO[1]===j) tr.className='sel'; tr.addEventListener('click',e=>{ if(e.target.closest('input,select')) return; piSelect(i,j); });
    const nm=document.createElement('input'); nm.type='text'; nm.value=o.name||''; nm.placeholder='auto'; nm.maxLength=8; nm.style.cssText='width:42px;font:11px var(--f-mono);border:1px solid var(--line);border-radius:3px;background:var(--bg);color:var(--ink);padding:3px'; nm.setAttribute('aria-label','Código da abertura'); nm.addEventListener('change',()=>{ o.name=nm.value.trim().slice(0,8)||undefined; }); tr.insertCell().appendChild(nm);
    const sel=document.createElement('select'); sel.setAttribute('aria-label','Tipo da abertura'); KIND_OPTS.forEach(([v,l])=>{ const op=document.createElement('option'); op.value=v; op.textContent=l; sel.appendChild(op); }); sel.value=kindVal(o); sel.addEventListener('change',()=>{ setKind(o,sel.value); piRenderSvg(); piRenderLists(); }); tr.insertCell().appendChild(sel);
    tr.insertCell().textContent=Math.round(o.w);
    for(const key of ['h','sill']){ const inp=document.createElement('input'); inp.type='number'; inp.min='0'; inp.step='1'; inp.value=Math.round(o[key]||0); inp.setAttribute('aria-label',key==='h'?'Altura (cm)':'Peitoril (cm)'); inp.addEventListener('change',()=>{ o[key]=Math.max(0,+inp.value||0); o.conf='alta'; if(key==='sill'&&o.kind==='slide') sel.value=kindVal(o); }); tr.insertCell().appendChild(inp); }
    const c=document.createElement('span'); c.className='pi-conf '+o.conf; c.textContent=o.conf==='alta'?'alta':'média'; c.title= o._lab? 'Rótulo lido no PDF: '+o._lab : (/door|pivot/.test(o.kind)? 'Folha e arco de giro desenhados no PDF' : 'Sem rótulo de altura/peitoril: valores padrão'); tr.insertCell().appendChild(c); }
  ob.appendChild(ot); }
// escala e calibração
$('pi-den').addEventListener('change',()=>{ const pg=IMPS.pages[IMPS.cur]; if(!pg) return; const v=+$('pi-den').value; if(!(v>0)) return; pg.den=v; pg.denSrc='informada por você'; piDetect(pg); if(pg.det&&pg.fk) pg.on=true; IMPS.view=null; piRender(); });
$('pi-calok').addEventListener('click',()=>{ const pg=IMPS.pages[IMPS.cur]; const real=+$('pi-cal').value; if(!pg||!pg.det||IMPS.selW<0) return piMsg('Clique numa parede da planta e digite o comprimento real dela (cota).'); if(!(real>0)) return piMsg('Digite o comprimento real em cm.');
  const w=pg.det.walls[IMPS.selW], L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]); pg.den=+(pg.den*real/L).toFixed(3); pg.denSrc='calibrada pela parede '+(IMPS.selW+1)+' = '+real+' cm'; piDetect(pg); IMPS.view=null; piRender(); });
$('pi-h').addEventListener('change',()=>{ const h=Math.max(200,+$('pi-h').value||300); IMPS.pages.forEach(p=>p.det&&p.det.walls.forEach(w=>w.h=h)); });
$('pi-close').addEventListener('click',piClose);
function piClose(){ if(IMPS.abort) IMPS.abort.abort(); $('pdfimp').hidden=true; document.body.classList.remove('pdfimp'); IMPS.pages=[]; }
addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('pdfimp').hidden&&!/INPUT|SELECT/.test((document.activeElement||{}).tagName||'')) piClose(); });
// pan + zoom da revisão
(function(){ const svg=$('pi-svg'); let drag=null, moved=false;
  svg.addEventListener('wheel',e=>{ if(!IMPS.view) return; e.preventDefault(); const r=svg.getBoundingClientRect(), sc=Math.max(IMPS.view.w/r.width,IMPS.view.h/r.height), k=e.deltaY>0?1.12:1/1.12; const mx=IMPS.view.x+(e.clientX-r.left)*sc, my=IMPS.view.y+(e.clientY-r.top)*sc;
    IMPS.view.x=mx-(mx-IMPS.view.x)*k; IMPS.view.y=my-(my-IMPS.view.y)*k; IMPS.view.w*=k; IMPS.view.h*=k; svg.setAttribute('viewBox',`${IMPS.view.x} ${IMPS.view.y} ${IMPS.view.w} ${IMPS.view.h}`); },{passive:false});
  svg.addEventListener('pointerdown',e=>{ if(e.target.tagName==='polygon') return; drag=[e.clientX,e.clientY]; moved=false; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove',e=>{ if(!drag||!IMPS.view) return; const r=svg.getBoundingClientRect(), sc=Math.max(IMPS.view.w/r.width,IMPS.view.h/r.height); IMPS.view.x-=(e.clientX-drag[0])*sc; IMPS.view.y-=(e.clientY-drag[1])*sc; if(Math.abs(e.clientX-drag[0])+Math.abs(e.clientY-drag[1])>2) moved=true; drag=[e.clientX,e.clientY]; svg.setAttribute('viewBox',`${IMPS.view.x} ${IMPS.view.y} ${IMPS.view.w} ${IMPS.view.h}`); });
  svg.addEventListener('pointerup',()=>{ if(drag&&!moved&&IMPS.selW>=0){ IMPS.selW=-1; IMPS.selO=null; piRenderSvg(); piRenderLists(); } drag=null; }); })();
/* ---- leitura semântica com o Claude (capacidade "sample" com imagem) ---- */
async function piSample(){ const row=$('pi-claude-row'); row.hidden=true; if(IMPS.sample===false) return;
  if(IMPS.sample===undefined){ try{ IMPS.sample= window.claude&&window.claude.use? await window.claude.use('sample') : null; }catch(e){ IMPS.sample=null; } if(!IMPS.sample){ IMPS.sample=false; return; } }
  try{ const lim=await IMPS.sample.limits(); if(!lim||!lim.images) return; }catch(e){ return; } row.hidden=false; }
function piBlob(cv){ return new Promise(res=>{ const max=1568, k=Math.min(1,max/Math.max(cv.width,cv.height)); let c=cv; if(k<1){ c=document.createElement('canvas'); c.width=Math.round(cv.width*k); c.height=Math.round(cv.height*k); c.getContext('2d').drawImage(cv,0,0,c.width,c.height); } c.toBlob(b=>res(b),'image/png'); }); }
$('pi-claude').addEventListener('click',async()=>{ const pg=IMPS.pages[IMPS.cur]; const out=$('pi-claude-msg'); if(!pg||!IMPS.sample) return; out.hidden=false;
  const s= pg.den? PDFIMP.ptPerCm(pg.den) : 1; const fx=x=>+(x*s/pg.W).toFixed(4), fy=y=>+(y*s/pg.H).toFixed(4);
  const ops=[]; if(pg.det) pg.det.walls.forEach((w,i)=>w.ops.forEach((o,j)=>{ const dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], L=Math.hypot(dx,dz)||1; ops.push({id:i+':'+j,x:fx(w.a[0]+dx/L*o.c),y:fy(w.a[1]+dz/L*o.c),largura_cm:Math.round(o.w),tipo_detectado:kindVal(o)}); }));
  let wx0=1e9,wx1=-1e9,wy0=1e9,wy1=-1e9; if(pg.det) pg.det.walls.forEach(w=>piWallPoly(w).forEach(p=>{ wx0=Math.min(wx0,p[0]); wx1=Math.max(wx1,p[0]); wy0=Math.min(wy0,p[1]); wy1=Math.max(wy1,p[1]); }));
  const prompt=`Você é um leitor de plantas baixas de arquitetura (Brasil). A imagem é uma página de PDF. As posições abaixo são frações da largura (x) e altura (y) da página, com origem no canto superior esquerdo.
Aberturas detectadas automaticamente nas paredes (id, posição do centro, largura medida, tipo provável):
${JSON.stringify(ops)}
Caixa externa das paredes detectadas: x de ${fx(wx0)} a ${fx(wx1)}, y de ${fy(wy0)} a ${fy(wy1)}.
Tarefas: (1) leia a escala e as cotas totais (somas das cadeias de cotas externas) em cm; (2) nomes e posições dos cômodos; (3) quadro de esquadrias e o código/tipo/altura/peitoril de cada abertura detectada (use rótulos como "200 · 210/0" = largura · altura/peitoril, e o desenho: arco = porta de abrir; folha deslizante = correr; basculante = uma linha central); (4) escada, se houver.
Responda SOMENTE com JSON válido neste formato:
{"pavimento":"terreo"|"superior"|null,"escala_denominador":number|null,"cota_total_horizontal_cm":number|null,"cota_total_vertical_cm":number|null,
"comodos":[{"nome":string,"x":number,"y":number}],
"aberturas":[{"id":string,"codigo":string|null,"tipo":"porta"|"pivotante"|"porta de correr"|"janela"|"porta-janela"|"basculante","altura_cm":number|null,"peitoril_cm":number|null,"abre_para":string|null}],
"escada":{"x":number,"y":number,"sobe":string|null}|null,"observacoes":string}`;
  $('pi-claude').disabled=true; $('pi-claude-stop').hidden=false; out.textContent='Pensando… (o Claude está lendo a página)'; IMPS.abort=new AbortController();
  try{ const img=await piBlob(pg.canvas); const r=await IMPS.sample.json(prompt,{images:[img],modelTier:'default',signal:IMPS.abort.signal,onText:({text})=>{ out.textContent='Recebendo resposta… '+text.length+' caracteres'; }});
    piApplyClaude(pg,r||{}); }
  catch(e){ out.textContent= e&&e.code==='not_granted'? 'Leitura pelo Claude não autorizada nesta visualização.' : e&&e.code==='rate_limited'? 'Muitas leituras seguidas; tente de novo em alguns instantes.' : e&&e.code==='cancelled'? 'Leitura interrompida.' : 'Não foi possível ler com o Claude agora ('+((e&&e.code)||'erro')+'). A importação funciona sem ele.'; if(e&&e.code==='not_granted') $('pi-claude-row').hidden=true; }
  finally{ $('pi-claude').disabled=false; $('pi-claude-stop').hidden=true; IMPS.abort=null; } });
$('pi-claude-stop').addEventListener('click',()=>{ if(IMPS.abort) IMPS.abort.abort(); });
function piApplyClaude(pg,r){ const out=$('pi-claude-msg'), notes=[];
  if(r.pavimento==='terreo'&&!pg.fk) pg.fk='G'; if(r.pavimento==='superior'&&!pg.fk) pg.fk='U';
  // escala: só substitui se a página não trazia "Escala 1:N"; a cota total confere o resultado
  if(pg.det&&(r.cota_total_horizontal_cm>0||r.cota_total_vertical_cm>0)){ let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; pg.det.walls.forEach(w=>piWallPoly(w).forEach(p=>{ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); }));
    const est= r.cota_total_horizontal_cm>0? pg.den*r.cota_total_horizontal_cm/(x1-x0) : pg.den*r.cota_total_vertical_cm/(y1-y0);
    if(Math.abs(est/pg.den-1)<0.02) notes.push('cotas totais conferem com a escala 1:'+pg.den);
    else if(!/lida no PDF/.test(pg.denSrc)){ pg.den=+est.toFixed(3); pg.denSrc='calculada pela cota total lida pelo Claude'; const keep=r; piDetect(pg); notes.push('escala ajustada para 1:'+pg.den); r=keep; }
    else notes.push('atenção: a cota lida pelo Claude indica 1:'+est.toFixed(1)+', diferente da escala do PDF'); }
  else if(r.escala_denominador>0&&!pg.den){ pg.den=r.escala_denominador; pg.denSrc='lida pelo Claude'; piDetect(pg); }
  const map={'porta':'door','pivotante':'pivot','porta de correr':'slide-door','janela':'slide','porta-janela':'pj','basculante':'bascula'}; let n=0;
  if(pg.det&&Array.isArray(r.aberturas)) for(const a of r.aberturas){ const [i,j]=String(a.id||'').split(':').map(Number); const w=pg.det.walls[i], o=w&&w.ops[j]; if(!o) continue; n++;
    if(a.codigo) o.name=String(a.codigo).slice(0,8); const k=map[a.tipo]; if(k&&k!==kindVal(o)&&o.conf!=='alta') setKind(o,k);
    if(o.conf!=='alta'){ if(a.altura_cm>0) o.h=+a.altura_cm; if(a.peitoril_cm>=0&&a.peitoril_cm!=null) o.sill=+a.peitoril_cm; o.conf='alta'; } }
  if(n) notes.push(n+' aberturas com código/tipo conferidos');
  pg.rooms= Array.isArray(r.comodos)? r.comodos.filter(c=>c&&c.nome).map(c=>({nome:String(c.nome).slice(0,40),x:+c.x*pg.W/(pg.den?PDFIMP.ptPerCm(pg.den):1),z:+c.y*pg.H/(pg.den?PDFIMP.ptPerCm(pg.den):1)})) : [];
  if(pg.rooms.length){ $('pi-rtitle').hidden=false; $('pi-rooms').hidden=false; $('pi-rooms').textContent=pg.rooms.map(c=>c.nome).join(' · '); }
  if(r.escada) notes.push('escada identificada'); if(r.observacoes) notes.push(String(r.observacoes).slice(0,200));
  out.textContent='Claude: '+(notes.join('; ')||'nada a corrigir')+'.'; piRender(); }
/* ---- gerar o projeto ---- */
function piAlignTo(W,ref){ if(!ref||!ref.length) return null; const d=PDFIMP.alignOffset(W,ref), T=PDFIMP.translate(W,d), c=PDFIMP.compare(T,ref); return {d,T,hit:c.walls,of:W.length}; }
$('pi-ok').addEventListener('click',()=>{ const sel=IMPS.pages.filter(p=>p.on&&p.fk&&p.det); if(!sel.length) return; const mode=$('pi-align').value, cur=wallsModel(), H=Math.max(200,+$('pi-h').value||300);
  const clean=W=>W.filter(w=>w.on).map(w=>({a:w.a.slice(),b:w.b.slice(),t:w.t,h:H,ops:w.ops.map(o=>{ const q=Object.assign({},o); delete q._lab; delete q.conf; if(q.door) q.door=Object.assign({},q.door); return q; })}));
  const out={}, notes=[]; let placed=null;
  sel.sort((a,b)=>a.fk.localeCompare(b.fk));
  for(const pg of sel){ let W=clean(pg.det.walls); if(!W.length) continue; let done=false;
    if(mode!=='origin'){ const a=piAlignTo(W,cur[pg.fk]); if(a&&(mode==='model'||a.hit>=0.6*a.of)){ W=a.T; done=true; notes.push((pg.fk==='G'?'Térreo':'Superior')+' alinhado à planta aberta ('+a.hit+' de '+a.of+' paredes coincidem)'); } }
    if(!done&&placed){ W=PDFIMP.translate(W,PDFIMP.alignOffset(W,placed)); done=true; notes.push((pg.fk==='G'?'Térreo':'Superior')+' alinhado ao outro pavimento'); }
    if(!done) W=PDFIMP.normalizeOrigin(W);
    out[pg.fk]=W; placed=W; }
  const walls={}; for(const fk of ['G','U']){ walls[fk]= out[fk] || ($('pi-keep').checked? JSON.parse(JSON.stringify(cur[fk]||[])) : []); }
  PDFIMP.nameOpenings(['G','U'].map(fk=>out[fk]||[]));
  for(const fk of ['G','U']) walls[fk].forEach((w,i)=>{ if(out[fk]) w.id=fk.toLowerCase()+i; });
  const rooms={}; sel.forEach(pg=>{ if(pg.rooms&&pg.rooms.length) rooms[pg.fk]=pg.rooms; });
  const edit={v:2,mods:{},added:[],walls,import:{file:IMPS.file+'.pdf',date:now(),pages:sel.map(p=>({page:p.n,floor:p.fk,scale:p.den})),rooms}};
  const p=pjMake(('Importado – '+IMPS.file).slice(0,60),edit); PROJ.list.push(p); localWrite(); cloudWrite(p); piClose(); openProject(p.id);
  const nW=Object.values(out).reduce((s,W)=>s+W.length,0), nO=Object.values(out).reduce((s,W)=>s+W.reduce((t,w)=>t+w.ops.length,0),0);
  enterEdit(); setEdFloor(out.G?'g':'u'); msg('Projeto "'+p.name+'" criado: '+nW+' paredes e '+nO+' aberturas'+(notes.length?' · '+notes.join(' · '):'')+'.'); pjStatus('Projeto "'+p.name+'" importado do PDF e salvo '+where()+'.'); });
$('pi-input').addEventListener('change',e=>{ const f=e.target.files[0]; e.target.value=''; if(f) piOpenFile(f); });
window.__pdfimp={open:piOpenFile,get state(){ return IMPS; },commit:()=>$('pi-ok').click()};
