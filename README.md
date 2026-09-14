# MoviArt Studio de Dança — Landing Page

Landing page de conversão (PT-BR) para o **MoviArt Studio de Dança**, em Uberlândia (MG),
com foco em gerar leads qualificados via WhatsApp.

## Como publicar

O site é estático e sem dependências de build. Basta servir a pasta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Para produção, publique os arquivos em qualquer host estático (GitHub Pages, Netlify, Vercel,
Cloudflare Pages, hospedagem tradicional).

## Estrutura

```
index.html                  # página completa, HTML semântico + JSON-LD
assets/css/styles.css       # design system (tokens, componentes, responsivo)
assets/js/main.js           # menu, scrollspy, animações, lightbox, form → WhatsApp
assets/img/og-moviart.svg   # imagem Open Graph
```

## Integração com WhatsApp

O formulário **não usa backend**. Ao enviar, o JavaScript valida os campos, monta uma mensagem
em português natural e abre `https://wa.me/5534992381047?text=...` — funciona no app mobile e no
WhatsApp Web/Desktop. O número está centralizado na constante `WHATSAPP` em `assets/js/main.js`
e nos links `wa.me` do `index.html`.

## Informações reais utilizadas

Todo o conteúdo factual vem de fontes públicas oficiais do negócio:

| Dado | Valor |
| --- | --- |
| Nome | MoviArt Studio de Dança |
| Endereço | Av. Indaiá, 799 — Planalto, Uberlândia/MG, CEP 38413-111 |
| Referência | Próximo ao Cemitério Bom Pastor |
| WhatsApp / telefone | (34) 99238-1047 |
| Instagram | [@studiomoviart](https://www.instagram.com/studiomoviart/) |
| Modalidades | Jazz, Ballet, Bolero, Dança de Salão, Forró, Zouk, Estilo Livre |
| Funcionamento | Participação mediante agendamento prévio |
| Parceria | Studio parceiro Wellhub |

Fonte: ficha pública do studio na Wellhub (Gympass) e perfil oficial no Instagram.

**Não há** no site preços, depoimentos, número de alunos, anos de mercado, notas de avaliação
ou qualquer outra afirmação que não tenha sido verificada — conforme solicitado.

## Sobre as imagens da galeria

O perfil do Instagram está bloqueado pelo proxy de rede deste ambiente, então **nenhuma foto real
do studio pôde ser baixada**. Em vez de usar imagens genéricas de banco (que passariam a impressão
errada sobre o espaço), a galeria usa **arte gráfica autoral em SVG** — leve, nítida em qualquer
tela e alinhada à paleta da marca — com link direto para o Instagram oficial, onde estão as fotos
e vídeos reais das aulas.

### Como substituir pelas fotos reais

Em `index.html`, dentro de `#gallery`, troque cada `<svg class="tile-art">…</svg>` por:

```html
<img class="tile-art" src="assets/img/jazz.webp" width="1080" height="1350" loading="lazy"
     decoding="async" alt="Turma de jazz durante a aula no MoviArt Studio de Dança">
```

e ajuste o lightbox em `assets/js/main.js` (função `render`) para usar `src`/`alt` no lugar de
`lbUse.setAttribute('href', ...)`. Formato recomendado: WebP, largura máxima 1200px.

## Acessibilidade e performance

- HTML semântico com hierarquia `h1` → `h2` → `h3` e skip link.
- Alvos de toque de no mínimo 48px, foco visível, erros de formulário com `role="alert"`.
- Sem bibliotecas externas: apenas 1 CSS, 1 JS (`defer`) e 2 famílias de fonte.
- Toda a arte é SVG vetorial (sem requisições de imagem raster).
- `prefers-reduced-motion` respeitado em todas as animações.
