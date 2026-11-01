# Architect Studio Ultra

Editor de plantas arquitetônicas 2D com visualização 3D sincronizada, feito para rodar como **Claude Artifact** (um único arquivo HTML).

- `src/` — código-fonte (JS modular, CSS e template HTML)
- `build.js` — monta `dist/index.html` (arquivo publicado)
- `tests/geometry.test.js` — testes unitários de geometria, cômodos, histórico, serialização e gerador (`node tests/geometry.test.js`)
- `tests/recognizer.e2e.js` — teste do leitor automático com os PDFs de `tests/fixtures/` (gerados por `tests/make-fixtures.js`) e suas versões em imagem
- `tests/smoke.e2e.js` — teste de ponta a ponta com Playwright (desenho, edição, 3D, gerador, importação de PDF, exportação)

## Pilha técnica

| Parte | Implementação |
|---|---|
| 2D | Canvas 2D próprio (paredes com junções, aberturas, cotas, rótulos, mobiliário) |
| 3D | Three.js r128 (cdnjs), câmera orbital própria, texturas procedurais em canvas, sombras |
| PDF | pdf.js 3.11 (cdnjs): miniaturas, análise vetor/raster, extração de textos, renderização em alta resolução |
| Exportação PDF | jsPDF 2.5 (cdnjs) |
| Armazenamento | capacidade `db` do Artifact (privado por usuário) + `localStorage`; exportação/importação JSON |
| Downloads | capacidade `downloads` do Artifact (com confirmação do usuário) |

Unidade interna: centímetros. Cômodos são detectados como faces mínimas do grafo planar das paredes (com divisão em cruzamentos e junções em T); a área útil desconta meia espessura de cada parede do contorno.

## Build

```bash
node build.js
```

## Testes

```bash
node tests/geometry.test.js
```

```bash
LIBS=/caminho/para/node_modules TEST_PDF=/caminho/planta.pdf node tests/smoke.e2e.js
```

`LIBS` precisa conter `three@0.128.0`, `pdfjs-dist@3.11.174` e `jspdf@2.5.1` (o teste serve as bibliotecas localmente no lugar da CDN).

## Leitor automático de plantas (`src/js/07b-recognizer.js`)

1. **PDF vetorial:** percorre os operadores do PDF (pdf.js), aplicando as matrizes de transformação, e extrai segmentos, preenchimentos, curvas e textos.
2. **Imagem / PDF digitalizado:** varre faixas escuras horizontais e verticais. Faixas grossas viram paredes; linhas finas seguem para o detector de pares.
3. **Escala:** casa cada texto de cota (“3,50”, “350”) com a linha de cota paralela mais próxima e usa o valor com mais concordância; se não houver, usa o texto “1:N”.
4. **Paredes:** pares de linhas paralelas a 5–45 cm de distância (paredes preenchidas ou em contorno) e traços grossos; depois funde colineares, remove linhas internas e segmentos isolados e junta cantos em L e T.
5. **Aberturas:** um vão entre paredes colineares vira porta (arco com dobradiça na ponta e raio igual à largura), janela (linhas finas paralelas dentro do vão) ou vão livre.
6. **Cômodos:** os cômodos fechados são detectados, os nomes vêm dos textos do PDF e as paredes na fronteira com o exterior viram externas.
7. **Prévia e aplicação:** o resultado aparece como prévia e, ao aplicar, entra como paredes, aberturas e cômodos normais, em uma única operação desfazível.
