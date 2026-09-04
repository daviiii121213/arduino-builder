# Made in Jua — landing page

Landing page estática (HTML5 + CSS3 + JavaScript, sem dependências de build)
para a marca **Made in Jua** — Instagram: [@madeinjua](https://www.instagram.com/madeinjua/).

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Não há etapa de build. Basta publicar os arquivos em qualquer hospedagem estática.

## Estrutura

```
index.html            Marcação semântica de todas as seções
assets/css/styles.css Estilos (tokens → base → layout → seções → responsivo)
assets/js/main.js     Menu mobile, revelação no scroll, link ativo, ano do rodapé
assets/img/*.svg      Espaços reservados de imagem (substituir)
```

## ⚠️ Conteúdo pendente de verificação

O perfil do Instagram não pôde ser acessado no ambiente em que a página foi
construída, e não há fontes públicas confiáveis sobre a marca. Por isso **nada
foi inventado**: nomes de produtos, depoimentos, números, endereço, e-mail e
telefone não aparecem como se fossem fatos. O único canal afirmado é o
Instagram, informado pelo próprio briefing.

Antes de publicar, substitua:

| Onde | O quê |
| --- | --- |
| `assets/img/hero.svg` | Foto principal da marca (paisagem, ~1600×1100) |
| `assets/img/sobre.svg` | Foto de processo/bastidores (retrato 4:5) |
| `assets/img/produto-0{1..3}.svg` | Fotos das peças reais (retrato 4:5) |
| `assets/img/galeria-0{1..6}.svg` | Registros do Instagram (quadrado 1:1; itens `--wide` em 2:1) |
| `assets/img/og-cover.svg` | Capa de compartilhamento — trocar por **JPG/PNG 1200×630** e ajustar as metatags `og:image` / `twitter:image` |
| Seção *Coleção* | Título e descrição de cada peça |
| Seção *Contato* | Itens marcados `is-placeholder` (e-mail, WhatsApp, cidade) — apague os que a marca não usa |
| `<link rel="canonical">` e `og:url` | Domínio real do site |

As legendas “substituir” são a classe `.ph-chip`; remova o `<figcaption>`
correspondente ao trocar cada imagem.

Não há seção de depoimentos: sem avaliações reais verificáveis, ela seria
fabricada. Adicione-a apenas com depoimentos autênticos.

## Decisões técnicas

- **Tipografia:** Fraunces (display) + Inter (texto), via Google Fonts com
  `preconnect` e `display=swap`; pilha de fallback definida em CSS.
- **Imagens:** SVG leve (todo o diretório tem ~50 KB), `width`/`height`
  declarados para evitar CLS, `loading="lazy"` fora do hero e
  `fetchpriority="high"` no hero.
- **JavaScript:** ~3 KB, sem bibliotecas. `IntersectionObserver` para revelação
  e link ativo; nada bloqueia a renderização (`defer`).
- **Acessibilidade:** skip link, `aria-expanded`/`aria-controls` no menu,
  fechamento por `Esc` e por clique fora, foco visível, hierarquia de títulos
  `h1 → h2 → h3`, textos alternativos descritivos e respeito a
  `prefers-reduced-motion`.
- **SEO:** title e meta description, Open Graph, Twitter Card, canonical,
  JSON-LD (`Brand`) e HTML semântico (`header`/`main`/`section`/`footer`).

## Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `--paper` | `#FAF7F2` | Fundo padrão |
| `--paper-alt` | `#F3EEE5` | Fundo de seções alternadas |
| `--ink` | `#191512` | Títulos e rodapé |
| `--clay` | `#A6522C` | Acento, botões, links |
| `--sage` | `#37453A` | Bloco de CTA |

A paleta é uma proposta de direção de arte (tons terrosos brasileiros), não uma
extração verificada da identidade oficial. Ajuste os tokens no topo de
`assets/css/styles.css` quando as cores oficiais estiverem disponíveis — todo o
resto do CSS deriva deles.
