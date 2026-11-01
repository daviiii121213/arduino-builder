// Monta dist/index.html (arquivo único publicado como Artifact): node build.js
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
const js = fs.readdirSync(path.join(src, 'js')).filter(f => f.endsWith('.js')).sort()
  .map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(src, 'js', f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
let html = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
