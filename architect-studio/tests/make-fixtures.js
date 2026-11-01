// Gera PDFs de teste de uma planta fictícia (NÃO é a casa de ninguém) com pdf-lib.
// Uso: NODE_PATH=<node_modules com pdf-lib> node tests/make-fixtures.js
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const fs = require('fs'), path = require('path');
const M = 28.3465; // pt por metro em 1:100
// Planta 10 x 8 m: SALA (0-4 x 0-8), QUARTO (4-10 x 0-4), COZINHA (4-10 x 4-8)
const EXT = 0.20, INT = 0.12;
const walls = [ // [x0,y0,x1,y1,t, gaps[[s,e,kind,hingeAtStart,sideSign]]]  s/e em metros ao longo da parede
  [0, 0, 10, 0, EXT, [[6.0, 7.5, 'win']]],                 // topo (janela do quarto)
  [10, 0, 10, 8, EXT, [[5.5, 6.7, 'win']]],                // direita (janela da cozinha)
  [0, 8, 10, 8, EXT, [[1.0, 1.9, 'door', true, -1], [2.4, 3.6, 'win']]], // fundo/frente (porta de entrada + janela da sala)
  [0, 0, 0, 8, EXT, []],
  [4, 0, 4, 8, INT, [[1.0, 1.8, 'door', true, -1], [5.0, 5.8, 'door', false, -1]]], // sala|quarto e sala|cozinha
  [4, 4, 10, 4, INT, []],
];
const texts = [['SALA', 1.4, 4.2], ['QUARTO', 6.4, 2.2], ['COZINHA', 6.3, 6.2]];
async function make(file, style) {
  const doc = await PDFDocument.create(), page = doc.addPage([842, 595]), font = await doc.embedFont(StandardFonts.Helvetica);
  const ox = 120, oy = 520; const X = x => ox + x * M, Y = y => oy - y * M; // plano (y p/ baixo) -> PDF
  const black = rgb(0, 0, 0);
  for (const [x0, y0, x1, y1, t, gaps] of walls) {
    const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, nx = -dy, ny = dx;
    const cuts = [[-t / 2, ...[]]]; let pos = -t / 2; const pieces = [];
    for (const [s, e] of gaps) { pieces.push([pos, s]); pos = e; } pieces.push([pos, L + t / 2]);
    for (const [s, e] of pieces) {
      const P = (u, v) => [X(x0 + dx * u + nx * v), Y(y0 + dy * u + ny * v)];
      const pts = [P(s, -t / 2), P(e, -t / 2), P(e, t / 2), P(s, t / 2)];
      if (style === 'fill') page.drawSvgPath(`M${pts.map(p => p[0] + ' ' + (595 - p[1])).join(' L')} Z`, { x: 0, y: 595, color: black, borderWidth: 0 });
      else { // contorno: só as faces longas + tampas
        const ln = (a, b) => page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: 0.7, color: black });
        ln(pts[0], pts[1]); ln(pts[3], pts[2]);
      }
    }
    for (const [s, e, kind, hingeStart, side] of gaps) {
      const P = (u, v) => [X(x0 + dx * u + nx * v), Y(y0 + dy * u + ny * v)];
      if (kind === 'win') { for (const v of [-t / 2, 0, t / 2]) page.drawLine({ start: { x: P(s, v)[0], y: P(s, v)[1] }, end: { x: P(e, v)[0], y: P(e, v)[1] }, thickness: 0.4, color: black }); }
      else {
        const w = e - s, h = hingeStart ? s : e, other = hingeStart ? e : s, sg = side;
        const H = P(h, sg * t / 2), O = P(other, sg * t / 2), T = P(h, sg * (t / 2 + w)); // folha aberta perpendicular
        page.drawLine({ start: { x: H[0], y: H[1] }, end: { x: T[0], y: T[1] }, thickness: 0.8, color: black });
        const k = 0.5523, c1 = P(h + (other - h) * k, sg * (t / 2 + w)), c2 = P(other, sg * (t / 2 + w * k));
        const sv = (p) => `${p[0]} ${595 - p[1]}`;
        page.drawSvgPath(`M${sv(T)} C${sv(c1)} ${sv(c2)} ${sv(O)}`, { x: 0, y: 595, borderColor: black, borderWidth: 0.4 });
      }
    }
  }
  // cotas externas com texto
  const dim = (x0, y0, x1, y1, label, rot) => {
    page.drawLine({ start: { x: X(x0), y: Y(y0) }, end: { x: X(x1), y: Y(y1) }, thickness: 0.3, color: black });
    for (const [x, y] of [[x0, y0], [x1, y1]]) page.drawLine({ start: { x: X(x) - 3, y: Y(y) - 3 }, end: { x: X(x) + 3, y: Y(y) + 3 }, thickness: 0.3, color: black });
    const w = font.widthOfTextAtSize(label, 7), mx = X((x0 + x1) / 2), my = Y((y0 + y1) / 2);
    if (rot) page.drawText(label, { x: mx - 2, y: my - w / 2, size: 7, font, rotate: degrees(90) }); else page.drawText(label, { x: mx - w / 2, y: my + 2, size: 7, font });
  };
  dim(0, -0.7, 10, -0.7, '10,00'); dim(0, -0.7 + 0, 4, -0.7, ''); dim(10.7, 0, 10.7, 8, '8,00', true); dim(10.7, 0, 10.7, 4, '4,00', true);
  dim(0, 8.7, 4, 8.7, '4,00'); dim(4, 8.7, 10, 8.7, '6,00');
  for (const [s, x, y] of texts) page.drawText(s, { x: X(x), y: Y(y), size: 9, font });
  page.drawText('PLANTA BAIXA - TESTE (fictícia)'.normalize('NFD').replace(/[̀-ͯ]/g, ''), { x: 120, y: 40, size: 10, font });
  fs.writeFileSync(file, await doc.save());
}
(async () => {
  const dir = path.join(__dirname, 'fixtures');
  await make(path.join(dir, 'planta-teste-preenchida.pdf'), 'fill');
  await make(path.join(dir, 'planta-teste-contorno.pdf'), 'outline');
  console.log('fixtures ok');
})();
