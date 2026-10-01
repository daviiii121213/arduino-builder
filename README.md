# Made In Juá — site

Site estático (HTML, CSS e JavaScript puro, sem dependências) da Made In Juá, marcenaria artesanal em madeira maciça e resina epóxi — Aracruz, ES.

## Páginas
- `index.html` — Início
- `pecas.html` — Peças (catálogo com filtros por categoria; `pecas.html#mesas` abre já filtrado)
- `galeria.html` — Galeria (fotos, processo, antes e depois, Instagram)
- `404.html`

## Antes de publicar
1. **Fotos:** todas as imagens em `assets/img/fotos/` são **provisórias** (marcadas "FOTO PROVISÓRIA · SUBSTITUIR"). Substitua pelas fotos reais mantendo o mesmo nome de arquivo e largura (ex.: `peca-mesa-600.webp`, `peca-mesa-1000.webp`, `peca-mesa-1400.webp`), ou ajuste os `src/srcset` no HTML.
2. **Peças:** o catálogo tem uma peça por categoria com nome e texto genéricos. Troque pelos produtos reais em `pecas.html` (cada `<article class="product">`). O botão "Tenho interesse" usa `data-wa-piece="Nome da peça"` para montar a mensagem do WhatsApp automaticamente.
3. Remova o aviso `<p class="notice">` de `pecas.html` quando as fotos reais estiverem no lugar.
4. Se o domínio final não for `madeinjua.netlify.app`, atualize `canonical`/`og:url` nas páginas, `robots.txt` e `sitemap.xml`.

## Configuração
- WhatsApp: `WA_NUMBER` em `assets/js/main.js` (5527981174334).
- Instagram: https://www.instagram.com/madeinjua/

## Publicação
Basta enviar a pasta inteira para qualquer hospedagem estática (Netlify, GitHub Pages etc.).
