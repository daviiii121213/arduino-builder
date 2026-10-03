# AT/TUDE Barbearia — landing page

Landing page estática (HTML + CSS + JavaScript puro, sem dependências) da AT/TUDE Barbearia, Uberlândia – MG.

```
index.html   estrutura, conteúdo, SEO e dados estruturados (BarberShop)
style.css    identidade visual, layout responsivo e sistema de animações
script.js    abertura, cursor, parallax, revelações, menu, lightbox, WhatsApp
assets/      logo oficial, favicon e fotos otimizadas (ver assets/img/README.md)
```

Para visualizar: `python3 -m http.server` e abra http://localhost:8000.

## Seções

Hero (fachada) · faixa de serviços · Serviços · Experiência (Sobre) · Galeria
· Profissionais · Diferenciais · Localização · Agendamento · Instagram · Rodapé.

Avaliações não foram incluídas: nenhuma avaliação pública pôde ser verificada.

## Movimento

Cada seção usa uma linguagem própria (atributo `data-reveal`):
`lines` (títulos palavra por palavra), `clip-left` (serviços), `mask` (galeria),
`blur` (textos da experiência), `clip-right` (foto da equipe), `scale` (cartão
do profissional), `clip-up` (mapa), `bar` (faixa do logo no agendamento),
além de parallax (`data-parallax`) e deslocamento horizontal (`data-scroll-x`).
Tudo respeita `prefers-reduced-motion`.

## Dados usados e fontes

| Dado | Valor | Fonte |
|------|-------|-------|
| Endereço | Av. Continental, 58 — Laranjeiras, Uberlândia – MG, 38410-314 | Site oficial/Facebook, registro do CNPJ 26.222.704/0001-00 |
| WhatsApp | (34) 99152-3214 | Resultados públicos do Instagram/Facebook — **confirmar com o cliente** |
| Serviços | Visagismo, corte na tesoura, selamento de barba com navalha, sobrancelha com navalha, hidratação capilar | atitudebarbearia.com.br |
| Duas unidades | Endereço da 2ª unidade não confirmado | Facebook oficial |
| Profissional | Junior — @junioratitude_ | Informado pelo cliente |

**Não encontrados (não exibidos):** preços, durações, horários, endereço da
segunda unidade, avaliações, outros profissionais.

## Pendências do cliente

1. Fotos originais em alta resolução (as recebidas têm ~290 px de largura).
2. Preços/duração → atributos `data-price` / `data-duration` de cada serviço.
3. Horários → seção Localização.
4. Foto e especialidade do Junior; outros profissionais.
5. Confirmar o número do WhatsApp → `CONFIG.whatsapp` em `script.js` (e links `wa.me` no HTML).
