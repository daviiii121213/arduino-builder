# Corrida Turbo — Arcade Racing (pt-BR)

Jogo de corrida arcade 2D top-down, em português brasileiro, feito em
TypeScript + HTML5 Canvas + CSS3, sem frameworks de jogo externos. Todo o
material visual é pixel-art original gerado por código (sem placeholders,
emojis ou imagens externas).

## Rodando localmente

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (geralmente `http://localhost:5173`).

Para gerar a build de produção:

```bash
npm run build
npm run preview
```

## Estado atual (fatia vertical jogável)

- **Menu Principal** com Carreira, Corrida Rápida, Garagem, Mapa do Mundo e Ajustes.
- **Pista rural original "Vale Verde"**: fazendas, celeiro, silo, ponte de
  madeira sobre trecho de terra, arquibancada, boxes/pits, posto de
  gasolina, placas de aviso e cercas — totalmente jogável com 3 adversários
  controlados por IA.
- **Física arcade real**: aceleração, frenagem, aderência, inércia, derrapagem
  controlável, diferentes pesos/handling por carro, efeito de superfícies
  (asfalto/terra/poça) e clima na aderência.
- **Limite oficial de pista** (faixa branca e vermelha): ao sair da pista um
  cronômetro de 3 segundos começa; se o jogador não retornar a tempo, o carro
  é reposicionado no último ponto seguro, já orientado na direção da pista.
- **Voltas e checkpoints em ordem**, posição de corrida por progresso real,
  detecção de chegada, resultados com pódio, prêmios e reputação.
- **Economia dinâmica**: taxa de entrada e prêmio variam com dificuldade,
  clima, período do dia e terreno (multiplicadores exibidos antes de cada
  evento de Carreira).
- **Garagem**: compra de carros (12 modelos + 1 especial), upgrades reais
  (motor, turbo, freios, pneus, suspensão, transmissão, nitro), reparo de
  dano e troca de pneus (normal/corrida/chuva/off-road).
- **Clima e período do dia** afetando aderência, visibilidade e iluminação
  noturna, com poças geradas em pistas de asfalto durante chuva/tempestade.
- **HUD em português**: posição, volta, cronômetro, velocímetro, nitro,
  condição, combustível, minimapa e aviso de fora de pista — com o painel de
  controles no canto inferior esquerdo, como pedido.
- **Controles remapeáveis**, com detecção de conflitos, e **direção
  invertida por padrão** (A = direita, D = esquerda) — ajustável em Ajustes.
  Suporte a controle (analógico + gatilhos).
- **Progresso salvo em `localStorage`**: dinheiro, carros, upgrades,
  reputação, região desbloqueada, recordes e conquistas.

As outras 9 regiões, pistas e eventos de Carreira já existem na camada de
dados (`src/data/regions.ts`) e aparecem no Mapa do Mundo como bloqueadas —
a geometria completa de cada pista será implementada nas próximas etapas,
conforme a arquitetura modular já preparada em `src/track`, `src/ai`,
`src/systems` e `src/render`.

## Arquitetura

```
src/
  data/       definições (carros, upgrades, regiões/pistas, conquistas, tipos)
  track/      spline da pista, geometria, checkpoints, decorações
  physics/    modelo de física arcade
  entities/   carro (física + consumíveis + progresso de corrida)
  ai/         piloto de IA (linha de corrida, freada em curva, ultrapassagem)
  systems/    colisão, fora-de-pista, clima, economia, drift/nitro/combustível/pneus, voltas
  race/       orquestração da corrida (grid, contagem, resultados)
  render/     pixel-art procedural, câmera, renderizador, partículas, minimapa
  audio/      áudio sintetizado via WebAudio (sem arquivos externos)
  input/      controles remapeáveis (teclado + controle)
  core/       estado do jogo e save/load
  ui/         telas de menu/carreira/garagem/mapa/ajustes
```
