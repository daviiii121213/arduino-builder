// Testes de geometria/modelo em Node (sem DOM). Uso: node tests/geometry.test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {}, console, performance: { now: () => Date.now() }, setTimeout, clearTimeout };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['00-util.js', '01-data.js', '02-model.js', '06-generator.js'])
  if (fs.existsSync(path.join(__dirname, '../src/js', f))) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', f), 'utf8'), ctx, { filename: f });
const AS = ctx.AS; AS.toast = () => {};
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } };
const eq = (a, b, tol = 1e-6, m = '') => { if (Math.abs(a - b) > tol) throw new Error(`${m} esperado ${b}, obtido ${a}`); };
const fresh = () => { AS.state.project = AS.newProject('t'); AS.changed(true); return AS.floor(); };
const rect = (x, y, w, h, th = 10) => { AS.addWall({x,y},{x:x+w,y},{thickness:th}); AS.addWall({x:x+w,y},{x:x+w,y:y+h},{thickness:th}); AS.addWall({x:x+w,y:y+h},{x,y:y+h},{thickness:th}); AS.addWall({x,y:y+h},{x,y},{thickness:th}); };

t('unidades: parse/format', () => {
  eq(AS.units.parse('3,5', 'm'), 350); eq(AS.units.parse('350cm'), 350); eq(AS.units.parse('3500 mm'), 350); eq(AS.units.parse('3m50'), 350); eq(AS.units.parse('1.234,5', 'cm'), 1234.5);
  if (AS.units.fmt(350, 'm', 2) !== '3,50 m') throw new Error(AS.units.fmt(350, 'm', 2));
});
t('cria parede e mede comprimento', () => { const fl = fresh(); const w = AS.addWall({x:0,y:0},{x:300,y:400}); eq(AS.wallLen(w), 500); eq(fl.walls.length, 1); });
t('cômodo fechado: 1 cômodo, área útil descontando meia parede', () => {
  fresh(); rect(0, 0, 400, 300, 10); AS.changed(true);
  const { rooms } = AS.rooms(); eq(rooms.length, 1, 0, 'n');
  eq(rooms[0].areaAxis, 120000, 1); eq(rooms[0].area, 390 * 290, 1, 'útil'); eq(rooms[0].perimeter, 2 * (390 + 290), 1);
});
t('parede interna em T divide em 2 cômodos', () => {
  fresh(); rect(0, 0, 600, 300, 10); AS.addWall({x:250,y:0},{x:250,y:300},{thickness:10}); AS.changed(true);
  const { rooms } = AS.rooms(); eq(rooms.length, 2, 0, 'n');
  const areas = rooms.map(r => Math.round(r.areaAxis)).sort((a,b)=>a-b); eq(areas[0], 75000, 1); eq(areas[1], 105000, 1);
});
t('cruzamento sem junção explícita gera 4 cômodos', () => {
  fresh(); rect(0, 0, 400, 400); AS.addWall({x:200,y:0},{x:200,y:400}); AS.addWall({x:0,y:200},{x:400,y:200}); AS.changed(true);
  eq(AS.rooms().rooms.length, 4);
});
t('parede solta (pendente) não cria cômodo', () => {
  fresh(); rect(0, 0, 400, 400); AS.addWall({x:100,y:100},{x:200,y:150}); AS.changed(true); eq(AS.rooms().rooms.length, 1);
});
t('metadado de cômodo segue a âncora após mover parede', () => {
  const fl = fresh(); rect(0, 0, 400, 300); AS.changed(true);
  const r = AS.rooms().rooms[0]; const m = AS.ensureRoomMeta(r); m.name = 'Sala';
  // move a parede direita
  const w = fl.walls[1]; w.a.x = 500; w.b.x = 500; fl.walls[0].b.x = 500; fl.walls[2].a.x = 500; AS.changed(true);
  const r2 = AS.rooms().rooms[0]; if (r2.meta?.name !== 'Sala') throw new Error('perdeu metadado'); eq(r2.areaAxis, 150000, 1);
});
t('dividir e unir paredes preserva aberturas', () => {
  const fl = fresh(); const w = AS.addWall({x:0,y:0},{x:600,y:0}); const o = AS.addOpening('door', w, 450);
  const w2 = AS.splitWall(w, 300); eq(fl.walls.length, 2); if (o.wallId !== w2.id) throw new Error('porta não migrou'); eq(o.t, 150);
  AS.mergeWalls(w, w2); eq(fl.walls.length, 1); eq(AS.wallLen(fl.walls[0]), 600); eq(o.t, 450, 0.01);
});
t('abertura limitada ao comprimento da parede', () => { fresh(); const w = AS.addWall({x:0,y:0},{x:100,y:0}); const o = AS.addOpening('window', w, 95); if (o.t + o.width/2 > 100.001) throw new Error('excede'); });
t('validação detecta sobreposição e parede nula, autoFix corrige', () => {
  const fl = fresh(); AS.addWall({x:0,y:0},{x:300,y:0}); AS.addWall({x:100,y:0},{x:400,y:0}); fl.walls.push({ ...AS.clone(fl.walls[0]), id: 'z', b: { x: 0.5, y: 0 } });
  const iss = AS.validate(); if (!iss.some(i => i.code === 'overlap')) throw new Error('sem overlap'); if (!iss.some(i => i.code === 'zero')) throw new Error('sem zero');
  AS.autoFix(); if (fl.walls.some(w => AS.wallLen(w) < 2)) throw new Error('não removeu nula');
});
t('dividir nas interseções', () => { const fl = fresh(); AS.addWall({x:0,y:0},{x:400,y:0}); AS.addWall({x:200,y:-100},{x:200,y:100}); const n = AS.splitAtIntersections(); eq(fl.walls.length, 4); });
t('histórico: desfazer/refazer altera dados reais', () => {
  const fl = fresh(); AS.history.clear();
  AS.history.run('parede', () => AS.addWall({x:0,y:0},{x:100,y:0})); eq(AS.floor().walls.length, 1);
  AS.history.doUndo(); eq(AS.floor().walls.length, 0); AS.history.doRedo(); eq(AS.floor().walls.length, 1);
});
t('serialização + normalização (export/import JSON)', () => {
  fresh(); rect(0,0,300,300); AS.changed(true); const j = JSON.stringify(AS.serialize());
  const p = JSON.parse(j); if (AS.validateProjectData(p).length) throw new Error('inválido'); const n = AS.normalizeProject(p);
  eq(n.floors[0].walls.length, 4); if (p.computed.floors[0].rooms.length !== 1) throw new Error('computed');
});
if (AS.generatePlan) {
  for (const req of [{ area: 90, bedrooms: 2, bathrooms: 1, floors: 1, garage: 1, laundry: true, balcony: false }, { area: 160, bedrooms: 3, bathrooms: 2, suite: true, floors: 1, garage: 2, laundry: true, balcony: true }, { area: 180, bedrooms: 3, bathrooms: 2, floors: 2, garage: 1, laundry: true, balcony: true }]) {
    for (let v = 0; v < 3; v++) t(`gerador ${req.area}m² ${req.bedrooms}q ${req.floors}pav variação ${v}`, () => {
      const p = AS.generatePlan(req, v); AS.state.project = p; AS.changed(true);
      for (const fl of p.floors) {
        const { rooms, orphanMeta } = AS.rooms(fl);
        if (orphanMeta.length) throw new Error(`${fl.name}: ${orphanMeta.length} metadados sem cômodo: ` + orphanMeta.map(m=>m.name).join(','));
        const errs = AS.validate(fl).filter(i => i.level === 'erro'); if (errs.length) throw new Error(errs.map(e => e.msg).join('; '));
        const named = rooms.filter(r => r.meta); if (named.length !== rooms.length) throw new Error(`${fl.name}: ${rooms.length - named.length} cômodos sem nome`);
      }
      const doors = p.floors.flatMap(f => f.openings).filter(o => o.kind === 'door').length; if (doors < req.bedrooms + 1) throw new Error('poucas portas ' + doors);
    });
  }
}
console.log(`\n${pass} passaram, ${fail} falharam`); process.exit(fail ? 1 : 0);
