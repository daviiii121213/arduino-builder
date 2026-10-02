# AT/TUDE Barbearia — landing page

Landing page estática (HTML + CSS + JS, sem dependências) da Atitude Barbearia, Uberlândia – MG.

```
index.html     estrutura, conteúdo, SEO e dados estruturados (BarberShop)
style.css      estilos (mobile-first, prefers-reduced-motion)
script.js      menu, seção ativa, hero animado, lightbox, WhatsApp
assets/        favicon e fotos (ver assets/img/README.md)
```

Para visualizar: `python3 -m http.server` e abra http://localhost:8000.

## Dados usados e fontes

| Dado | Valor | Fonte |
|------|-------|-------|
| Endereço | Av. Continental, 58 — Laranjeiras, Uberlândia – MG, 38410-314 | Site oficial/Facebook, registro do CNPJ 26.222.704/0001-00 |
| WhatsApp | (34) 99152-3214 | Resultados públicos do Instagram/Facebook — **confirmar com o cliente** |
| Serviços | Visagismo, corte na tesoura, selamento de barba com navalha, sobrancelha com navalha, hidratação capilar | atitudebarbearia.com.br |
| Duas unidades | Endereço da 2ª unidade não confirmado | Facebook oficial |

**Não encontrados (não exibidos):** preços, durações, horários de funcionamento,
endereço da segunda unidade, avaliações, biografia do Junior.

## Pendências do cliente

1. Fotos em alta resolução, foto para a seção Sobre e foto do Junior → `assets/img/` (ver lista).
2. Preços/duração → atributos `data-price` / `data-duration` de cada serviço.
3. Horários → seção Localização.
4. Cor da marca: `--brand` em `style.css` foi extraída da faixa do logo (#455da7).
5. Confirmar o número do WhatsApp → `CONFIG.whatsapp` em `script.js` (e links `wa.me` no HTML).
