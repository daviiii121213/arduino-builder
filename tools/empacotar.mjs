/**
 * Empacota o jogo numa única página HTML autossuficiente.
 *
 * Junta o HTML, o CSS e o bundle JavaScript num só arquivo, sem nenhuma
 * referência externa — o resultado abre com um duplo clique e é o formato
 * usado para publicar o jogo como Artifact.
 *
 * Uso:  npm run build && node tools/empacotar.mjs [saida.html]
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const saida = process.argv[2] ?? 'dist/cronos-jurassico.html';

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const ativos = path.join(dist, 'assets');
const arquivos = fs.readdirSync(ativos);
const js = arquivos.filter((f) => f.endsWith('.js'));
const css = arquivos.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`Esperava um único bundle JS, achei ${js.length}.`);

const codigo = fs.readFileSync(path.join(ativos, js[0]), 'utf8');
const estilo = css.map((f) => fs.readFileSync(path.join(ativos, f), 'utf8')).join('\n');

// o corpo da página, sem as tags de documento (o Artifact fornece a moldura)
const corpo = html
  .replace(/[\s\S]*?<body[^>]*>/i, '')
  .replace(/<\/body>[\s\S]*/i, '')
  .replace(/\s*<script[^>]*src="[^"]*"[^>]*><\/script>/gi, '')
  .trim();
const titulo = (html.match(/<title>([^<]*)<\/title>/i) ?? [, 'Cronos Jurássico'])[1];

if (codigo.includes('</script')) throw new Error('O bundle contem "</script": nao posso inserir em linha.');
if (/[^\x00-\x7F]/.test(codigo))
  throw new Error('O bundle tem caracteres nao-ASCII: configure esbuild.charset = "ascii".');

/** Converte acentos em entidades numéricas: a página fica 100% ASCII. */
const paraAscii = (txt) =>
  txt.replace(/[^\x00-\x7F]/g, (ch) => `&#${ch.codePointAt(0)};`);

const pagina = `<title>${paraAscii(titulo)}</title>
<style>
${paraAscii(estilo)}
</style>
${paraAscii(corpo)}
<script type="module">
${codigo}
</script>
`;

fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, pagina);
const kb = (Buffer.byteLength(pagina) / 1024).toFixed(0);
console.log(`Página única gerada: ${saida} (${kb} kB)`);
