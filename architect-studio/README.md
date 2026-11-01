# Architect Studio Ultra

Editor de plantas arquitetônicas 2D com visualização 3D sincronizada, feito para rodar como **Claude Artifact** (um único arquivo HTML).

- `src/` — código-fonte (JS modular, CSS e template HTML)
- `build.js` — monta `dist/index.html` (arquivo publicado)
- `tests/geometry.test.js` — testes unitários de geometria, cômodos, histórico, serialização e gerador (`node tests/geometry.test.js`)
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
