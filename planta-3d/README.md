# Planta 3D – importador de PDF

Implementação do `IMPORTADOR-PDF-especificacao.md`: botão **Importar PDF** no Planta 3D que transforma uma planta
vetorial em PDF num projeto editável (mesmo formato `.json` do app: paredes `a→b`, espessura `t`, altura `h`, aberturas `ops[]`).

## Arquivos

| Arquivo | O que é |
|---|---|
| `planta-3d.html` | App online (bibliotecas via CDN; é o conteúdo do artefato “Planta 3D da Casa”). **Gerado.** |
| `planta-3d-offline.html` | Mesmo app com todas as bibliotecas embutidas, inclusive o pdf.js. **Gerado.** |
| `src/planta-3d.base.html` | App original, sem o importador. |
| `src/pdf-import-core.js` | Núcleo sem interface: lê vetores com pdf.js, detecta paredes/aberturas, escala, alinhamento, comparação. Roda no navegador e no Node. |
| `src/pdf-import-ui.js`, `.html`, `.css` | Tela de revisão, leitura com o Claude e criação do projeto. |
| `src/home-ui.js`, `.html`, `.css` | Menu inicial: **Importar** (projeto novo a partir de PDF ou .json), **Continuar** (último projeto aberto) e **Carregar** (todos os projetos, com busca). Abre ao entrar e pelo botão **Início**. |
| `build.py` | Monta os dois apps a partir de `src/`. |
| `test/menu.js` | Teste do menu no Chromium (importar, recarregar, continuar, carregar, busca, celular). |
| `test/aceite.js` | Teste de aceite (Node) contra o gabarito `test/segs0-gabarito.json` (= `SEGS0`). |
| `test/navegador.js` | Teste ponta a ponta no Chromium (importa o PDF pela interface e confere o projeto criado). |
| `test/casa-1-50.pdf` | PDF da casa usado como teste. |

## Como funciona

1. **pdf.js 3.11** (cdnjs, carregado só quando se clica em *Importar PDF*) lê `getOperatorList()`: caminhos
   (moveTo/lineTo/rect/curvas) com cor de preenchimento/traço, espessura e tracejado, e `getTextContent()`.
2. **Escala**: texto “Escala 1:N” da página; sem ele, a escala que faz mais cotas numéricas coincidirem com as medidas;
   ou o usuário digita a escala / calibra pelo comprimento real de uma parede; ou o Claude lê a cota total.
3. **Paredes**: o grupo de cor com mais faixas finas preenchidas é o das paredes. Cada faixa vira retângulo orientado;
   faixas colineares de mesma espessura e vãos com símbolo de esquadria entre elas formam uma parede (eixo `a→b`, `t`).
   Pilares (peças “gordas”) e chanfros (peças curtas coladas a polígonos não retangulares) ficam como peças fixas.
4. **Aberturas**: retângulo de traço com a espessura da parede = janela (2 trilhos = correr, 1 linha = basculante,
   linha de soleira = porta-janela); arco tracejado + folha = porta de abrir (dobradiça, lado e ângulo lidos do desenho;
   ≥ 110 cm = pivotante); traço grosso + tracejado paralelo = porta de correr. Rótulos “largura · altura/peitoril” dão altura e peitoril.
5. **Claude (opcional)**: com a capacidade `sample` (imagens), a página renderizada vai para o Claude, que devolve em JSON
   pavimento, escala/cotas totais, cômodos, código/tipo/altura/peitoril de cada abertura e escada.
6. **Revisão**: planta 2D sobre a imagem do PDF, listas de paredes e aberturas com confiança, tudo editável.
7. **Projeto**: “Importado – nome do arquivo”, aberto no editor. A origem do PDF é arbitrária, então o importador alinha
   cada pavimento à planta aberta (votação pelas faces das paredes) quando é a mesma casa, ou ao outro pavimento importado,
   ou cria nova origem (face externa esquerda em x=0, face inferior em z=0).

## Testes

```bash
npm i --prefix planta-3d/.lib three@0.147.0 fflate@0.8.2 jspdf@2.5.1 pdfjs-dist@3.11.174
ln -s ../.lib/node_modules planta-3d/test/node_modules
node planta-3d/test/aceite.js          # critério de aceite (Node)
node planta-3d/test/navegador.js offline   # ponta a ponta no Chromium (requer playwright)
node planta-3d/test/menu.js                # menu inicial no Chromium
python3 planta-3d/build.py             # reconstrói planta-3d.html e planta-3d-offline.html
```

Resultado com `test/casa-1-50.pdf`: **29/29 paredes e 28/28 aberturas, erro máximo 0,05 cm**; tipo, altura, peitoril
e sentido de abertura das portas iguais ao gabarito.
