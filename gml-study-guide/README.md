# GML Study Guide — 3 folhas A4

Guia de estudo de **GML (GameMaker Language)** em português do Brasil, em três folhas A4 retrato,
tons de cinza, pronto para impressão.

| Folha | Conteúdo | Arquivo |
|---|---|---|
| 1 | Fundamentos: variáveis, operadores, condições, laços, funções, matemática, macros/enums, organização, erros comuns | `output/GML-Folha-1-Fundamentos.png` |
| 2 | Gameplay: eventos, entrada, movimento, colisão, plataforma, sprites, instâncias, rooms, câmera, jogador, timers, dados, áudio, partículas, sistemas prontos | `output/GML-Folha-2-Gameplay.png` |
| 3 | Avançado + referência: structs, arrays, ds_*, enums, máquina de estados, funções, save/load, buffers, surfaces, layers, pathfinding, depuração, desempenho, erros, referência rápida, 10 desafios | `output/GML-Folha-3-Avancado-Referencia.png` |

- PNG: 2480 × 3508 px (A4 a 300 dpi, com metadado de DPI).
- PDF com as 3 páginas: `output/GML-Study-Guide-3-folhas-A4.pdf` (texto vetorial, fontes embutidas).
- Sintaxe de referência: GML 2.3+ / runtime atual do GameMaker. Recursos marcados **2024+** exigem uma versão recente.

## Editar e gerar novamente

Fonte em `src/` (`page1.html`, `page2.html`, `page3.html`, `style.css`, `hl.js`, fontes em `src/fonts/`).

```bash
npm install          # playwright-core
CHROMIUM_PATH=/caminho/para/chromium npm run build     # gera src/index.html, output/*.png e o PDF
npm run measure      # só informa sobra/excesso de espaço (mm) por folha e coluna
```

Fontes: Source Serif 4, IBM Plex Sans Condensed e JetBrains Mono (SIL Open Font License).
