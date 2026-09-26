// Monta src/index.html a partir das 3 folhas e renderiza PNG (A4 @ 300 dpi) + PDF.
// Uso: node build.js [--measure]
// Requer: playwright-core e um Chromium (CHROMIUM_PATH ou /opt/pw-browsers/chromium).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "output");
const pages = ["page1.html", "page2.html", "page3.html"].filter(f => fs.existsSync(path.join(SRC, f)));

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GML Study Guide</title>
<link rel="stylesheet" href="style.css"></head>
<body>
${pages.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n")}
<script src="hl.js"></script>
</body></html>`;
fs.writeFileSync(path.join(SRC, "index.html"), html);

// Grava o chunk pHYs (DPI) logo após o IHDR, para impressão no tamanho A4 correto
function setDpi(file, dpi) {
  const zlib = require("zlib");
  const png = fs.readFileSync(file);
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9); data.writeUInt32BE(ppm, 0); data.writeUInt32BE(ppm, 4); data[8] = 1;
  const type = Buffer.from("pHYs");
  const len = Buffer.alloc(4); len.writeUInt32BE(9);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0);
  const ihdrEnd = 8 + 25;
  fs.writeFileSync(file, Buffer.concat([png.subarray(0, ihdrEnd), len, type, data, crc, png.subarray(ihdrEnd)]));
}

(async () => {
  const exe = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ deviceScaleFactor: 2480 / 794, viewport: { width: 900, height: 1200 } });
  const page = await ctx.newPage();
  await page.goto("file://" + path.join(SRC, "index.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // Relatório de encaixe: excesso/sobra por folha e por coluna
  const report = await page.evaluate(() => {
    const px2mm = v => (v * 25.4 / 96).toFixed(1);
    return [...document.querySelectorAll(".page")].map(p => {
      const body = p.querySelector(".body");
      const kids = [...body.children];
      const used = kids.reduce((s, k) => s + k.getBoundingClientRect().height, 0) +
        parseFloat(getComputedStyle(body).rowGap || 0) * (kids.length - 1);
      const cols = [...p.querySelectorAll(".col")].map(c => {
        const ch = [...c.children];
        const g = parseFloat(getComputedStyle(c).rowGap || 0);
        const u = ch.reduce((s, k) => s + k.getBoundingClientRect().height, 0) + g * (ch.length - 1);
        return px2mm(c.getBoundingClientRect().height - u);
      });
      const over = [...p.querySelectorAll("pre, td, span, div")].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === "hidden").length;
      return { id: p.id, free_mm: px2mm(body.getBoundingClientRect().height - used), cols_free_mm: cols.join(" | "), clipped: over };
    });
  });
  console.table(report);
  if (process.argv.includes("--measure")) { await browser.close(); return; }

  fs.mkdirSync(OUT, { recursive: true });
  const els = await page.$$(".page");
  const names = ["GML-Folha-1-Fundamentos", "GML-Folha-2-Gameplay", "GML-Folha-3-Avancado-Referencia"];
  await page.emulateMedia({ media: "print" });
  // A4 a 300 dpi = 2480 × 3508 px exatos: mostra uma folha por vez e recorta no canto
  for (let i = 0; i < els.length; i++) {
    await page.evaluate(n => document.querySelectorAll(".page").forEach((p, j) => { p.style.display = j === n ? "" : "none"; }), i);
    await page.screenshot({ path: path.join(OUT, `${names[i]}.png`), clip: { x: 0, y: 0, width: 794, height: 1123 } });
    setDpi(path.join(OUT, `${names[i]}.png`), 300);
    console.log("PNG:", names[i]);
  }
  await page.evaluate(() => document.querySelectorAll(".page").forEach(p => { p.style.display = ""; }));
  await page.pdf({ path: path.join(OUT, "GML-Study-Guide-3-folhas-A4.pdf"), preferCSSPageSize: true, printBackground: true });
  console.log("PDF ok");
  await browser.close();
})();
