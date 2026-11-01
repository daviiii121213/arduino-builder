/* ================= Menu inicial: Importar (novo a partir de arquivo) · Continuar (último projeto) · Carregar (todos) ================= */
const HM={open:false,view:'main'};
const hmSorted=()=>[...PROJ.list].sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
// último projeto em que a pessoa esteve (lembrado entre visitas); sem ele, o alterado mais recentemente
const hmLast=()=>pjActive()||hmSorted()[0]||null;
function hmMsg(t){ $('hm-msg').textContent=t||''; }
function hmStats(p){ const e=p.edit||{}; const W=e.walls||SEGS0; const nW=(W.G||[]).length+(W.U||[]).length, nO=['G','U'].reduce((s,fk)=>s+(W[fk]||[]).reduce((t,w)=>t+(w.ops||[]).length,0),0);
  const ch=Object.keys(e.mods||{}).length+(e.added||[]).length; return nW+' paredes · '+nO+' aberturas'+(ch? ' · '+ch+' ite'+(ch>1?'ns':'m')+' editado'+(ch>1?'s':'') : ''); }
function hmRender(){ if(!HM.open) return; const list=hmSorted(), last=hmLast();
  $('hm-continue').disabled=!last; $('hm-cont-sub').textContent= last? '“'+last.name+'” · '+hhmm(last.updated) : 'Nenhum projeto ainda. Importe um arquivo ou edite a planta original.';
  $('hm-load').disabled=!list.length; $('hm-load-sub').textContent= list.length? list.length+' projeto'+(list.length>1?'s':'')+' salvo'+(list.length>1?'s':'')+'. Escolha qual abrir.' : 'Nenhum projeto salvo ainda.';
  $('hm-where').textContent= PROJ.cloud? 'Projetos sincronizados com a sua conta Claude.' : 'Projetos salvos neste navegador.';
  $('hm-main').hidden=HM.view!=='main'; $('hm-list-view').hidden=HM.view!=='list'; if(HM.view==='list') hmRenderList(); }
function hmRenderList(){ const ul=$('hm-list'); ul.replaceChildren(); const q=($('hm-q').value||'').trim().toLowerCase();
  const list=hmSorted().filter(p=>!q||p.name.toLowerCase().includes(q)); $('hm-empty').hidden=!!PROJ.list.length;
  for(const p of list){ const li=document.createElement('li'); if(p.id===PROJ.active) li.className='cur';
    const nm=document.createElement('div'); nm.className='nm'; nm.textContent=p.name; if(p.edit&&p.edit.import){ const t=document.createElement('span'); t.className='tag'; t.textContent='do PDF'; nm.appendChild(t); } if(p.id===PROJ.active){ const t=document.createElement('span'); t.className='tag'; t.textContent='aberto'; nm.appendChild(t); }
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent='Atualizado '+hhmm(p.updated)+' · '+hmStats(p);
    const bt=document.createElement('button'); bt.textContent='Abrir'; bt.setAttribute('aria-label','Abrir '+p.name); bt.addEventListener('click',()=>hmOpenProject(p.id));
    li.append(nm,bt,meta); ul.appendChild(li); }
  if(PROJ.list.length&&!list.length){ const li=document.createElement('li'); li.textContent='Nenhum projeto com esse nome.'; li.style.color='var(--muted)'; ul.appendChild(li); } }
function homeOpen(view){ HM.open=true; HM.view=view||'main'; $('home').hidden=false; document.body.classList.add('home'); hmMsg(''); hmRender(); setTimeout(()=>{ const b=HM.view==='list'? $('hm-q') : (!$('hm-continue').disabled? $('hm-continue') : $('hm-import')); b&&b.focus(); },0); }
function homeClose(){ if(!HM.open) return; HM.open=false; $('home').hidden=true; document.body.classList.remove('home'); }
function hmOpenProject(id){ const p=PROJ.list.find(x=>x.id===id); if(!p) return; homeClose(); openProject(id); setMode('both'); msg('Projeto "'+p.name+'" aberto.'); }
// Importar: PDF vai para o importador; .json vira projeto novo
$('hm-import').addEventListener('click',()=>$('hm-file').click());
$('hm-file').addEventListener('change',e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
  if(/\.pdf$/i.test(f.name)||f.type==='application/pdf'){ homeClose(); piOpenFile(f); return; }
  f.text().then(t=>{ let d; try{ d=JSON.parse(t); }catch(err){ d=null; }
    if(!d||typeof d!=='object'||!d.mods||!Array.isArray(d.added)) return hmMsg('“'+f.name+'” não é um PDF nem um projeto .json exportado por este editor.');
    const p=pjMake(f.name.replace(/\.json$/i,'').slice(0,60)||'Projeto importado',d); PROJ.list.push(p); localWrite(); cloudWrite(p); hmOpenProject(p.id); pjStatus('Projeto "'+p.name+'" importado do arquivo .json.'); }); });
$('hm-continue').addEventListener('click',()=>{ const last=hmLast(); if(last) hmOpenProject(last.id); });
$('hm-load').addEventListener('click',()=>{ HM.view='list'; $('hm-q').value=''; hmRender(); $('hm-q').focus(); });
$('hm-back').addEventListener('click',()=>{ HM.view='main'; hmRender(); $('hm-load').focus(); });
$('hm-q').addEventListener('input',hmRenderList);
$('hm-orig').addEventListener('click',()=>{ homeClose(); openProject(null); setMode('both'); });
$('hm-close').addEventListener('click',homeClose);
$('home').addEventListener('click',e=>{ if(e.target===$('home')) homeClose(); });
addEventListener('keydown',e=>{ if(HM.open&&e.key==='Escape'){ if(HM.view==='list'){ HM.view='main'; hmRender(); } else homeClose(); } });
bind('v-home',()=>{ exitWalk(); if(photo) setPhoto(false); homeOpen(); });
// a lista se atualiza quando os projetos mudam (ex.: chegam da conta Claude depois de abrir o menu)
renderProjects=(function(base){ return function(){ base(); hmRender(); }; })(renderProjects);
if(!location.hash) homeOpen();
window.__home={open:homeOpen,close:homeClose,get state(){ return {open:HM.open,view:HM.view}; }};
