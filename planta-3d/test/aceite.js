// Teste de aceite do importador de PDF: node planta-3d/test/aceite.js [arquivo.pdf]
// Requer pdfjs-dist@3.11.174 (npm i --no-save pdfjs-dist@3.11.174).
const fs = require('fs'), path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const IMP = require('../src/pdf-import-core.js');
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'segs0-gabarito.json'), 'utf8'));
(async () => {
  const file = process.argv.slice(2).find(a => !a.startsWith('-')) || path.join(__dirname, 'casa-1-50.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const floors = {}; let ok = true; const verbose = process.argv.includes('-v');
  for (let i = 1; i <= doc.numPages; i++) {
    const prims = await IMP.extractPage(await doc.getPage(i), pdfjs.OPS);
    const all = prims.texts.map(t => t.str).join(' ');
    const fk = /T[ÉE]RREO/i.test(all) ? 'G' : /SUPERIOR/i.test(all) ? 'U' : null;
    const den = IMP.scaleFromText(prims.texts); const guess = IMP.guessScale(prims);
    const r = IMP.detect(prims, den || guess || 50);
    console.log(`página ${i}: pavimento ${fk || '-'} · escala 1:${den} (automática sem texto: 1:${guess}) ·`, JSON.stringify(r.stats), r.warnings.join(' '));
    if (fk && r.walls.length) floors[fk] = r.walls;
  }
  let tw = 0, to = 0, rw = 0, ro = 0;
  for (const fk of ['G', 'U']) {
    const ref = REF[fk], got0 = floors[fk] || [];
    const d = IMP.alignOffset(got0, ref); const got = IMP.translate(got0, d);
    const c = IMP.compare(got, ref);
    tw += c.walls; to += c.openings; rw += c.refWalls; ro += c.refOpenings;
    console.log(`\n${fk}: deslocamento de origem (${d[0].toFixed(2)}, ${d[1].toFixed(2)}) cm`);
    console.log(`  paredes ${c.walls}/${c.refWalls} (detectadas ${c.gotWalls}) · erro máx. extremidades ${c.maxWall.toFixed(2)} cm · espessura ${c.maxT.toFixed(2)} cm`);
    console.log(`  aberturas ${c.openings}/${c.refOpenings} (sobrando ${c.opExtra}) · erro máx. bordas ${c.maxOp.toFixed(2)} cm · tipo/altura/peitoril divergentes: ${c.kindMismatch.length}`);
    c.missing.forEach(w => console.log('  FALTA parede', w.id, JSON.stringify(w.a), JSON.stringify(w.b)));
    c.extra.forEach(w => console.log('  SOBRA parede', JSON.stringify(w.a), JSON.stringify(w.b), w.t));
    c.opMissing.forEach(m => console.log('  FALTA abertura', m.wall, JSON.stringify(m.op)));
    c.kindMismatch.forEach(m => console.log('  TIPO', JSON.stringify(m)));
    if (verbose) got.forEach(w => console.log('   ', JSON.stringify(w)));
    if (c.walls !== c.refWalls || c.gotWalls !== c.refWalls || c.maxWall >= 2 || c.maxT >= 2 || c.openings !== c.refOpenings || c.opExtra || c.maxOp >= 2 || c.kindMismatch.length) ok = false;
  }
  // alinhamento entre pavimentos: superior alinhado ao térreo (já alinhado ao gabarito), sem usar o gabarito do superior
  if (floors.G && floors.U) {
    const G1 = IMP.translate(floors.G, IMP.alignOffset(floors.G, REF.G));
    const U1 = IMP.translate(floors.U, IMP.alignOffset(floors.U, G1));
    const c = IMP.compare(U1, REF.U);
    console.log(`\nSuperior alinhado pelo térreo: paredes ${c.walls}/${c.refWalls} · erro máx. ${c.maxWall.toFixed(2)} cm`);
    if (c.walls !== c.refWalls || c.maxWall >= 2) ok = false;
  }
  console.log(`\nTOTAL: paredes ${tw}/${rw} · aberturas ${to}/${ro} → ${ok ? 'APROVADO (erro < 2 cm)' : 'REPROVADO'}`);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
