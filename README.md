# PROJECT_CITY

Protótipo jogável de um jogo de ação em mundo aberto 3D, em terceira pessoa, que roda no navegador.
Tudo é original e gerado por código: cidade, prédios, personagens, armas, carro, texturas (pintadas em
canvas) e sons (sintetizados com Web Audio). O projeto não usa nenhum asset de terceiros.

## Como rodar

Requisitos: Node.js 18+ e um navegador com WebGL2 (Chrome, Edge ou Firefox recentes).

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Build de produção:

```bash
npm run build      # gera dist/
npm run preview    # serve o build localmente
```

Clique na tela para começar: o mouse fica preso à janela e o áudio é liberado. `Esc` solta o mouse.

## Controles

| A pé | |
|---|---|
| `W` `A` `S` `D` | mover (relativo à câmera) |
| `Shift` | correr |
| `Espaço` | pular |
| Mouse | olhar ao redor |
| `1` / `2` | pistola / fuzil (apertar de novo guarda a arma) |
| Botão esquerdo | atirar (pistola semiautomática, fuzil automático) |
| Botão direito | mirar (câmera sobre o ombro, menos dispersão) |
| `R` | recarregar |
| `F` | entrar num carro estacionado ou roubar um carro do trânsito (perto da porta) |
| `H` | mostrar/ocultar a ajuda |

| No carro | |
|---|---|
| `W` | acelerar |
| `S` | frear; parado, dá ré |
| `A` / `D` | direção |
| `Espaço` | freio de mão |
| `H` | buzina |
| `F` | sair (abaixo de ~18 km/h) |

## O que está implementado

- **Cidade**: grade de 3×3 quarteirões dentro de um anel viário, fechada por uma fileira contínua de prédios.
  Ruas de mão dupla com faixa de estacionamento junto ao meio-fio, faixas de pedestre, linhas de parada e
  semáforos que alternam; calçadas elevadas com meio-fio, postes, árvores, bancos, lixeiras, hidrantes,
  balizadores e pontos de ônibus; quarteirões de prédios com pátios internos e becos; praça central com fonte,
  quiosque e um terraço com rampa e escada; praça cívica com torre de escritórios; estacionamento com loja.
- **Personagens**: estilo próprio, pequeno e em blocos (cabeça quadrada com olhos, tronco compacto, membros
  curtos), com variações de pele, roupa, cabelo/boné e proporções. Animação procedural de parado, andar,
  correr, pular, mirar, atirar (recuo), recarregar, entrar/sair do carro, sentar ao volante e reação a dano.
- **Jogador e câmera**: controlador cinemático do Rapier (meio-fio e degraus, rampas, gravidade, pulo com
  tolerância); câmera em terceira pessoa com braço de mola, modos a pé, armado, mirando e dirigindo.
- **Armas**: pistola e fuzil visíveis nas mãos (a outra fica no coldre ou nas costas), hitscan pelo centro da
  tela, dispersão, recuo, clarão, traçante, faíscas, marcas de bala, munição e recarga.
- **Pedestres**: 20 civis andando por rotas nas calçadas, praça e terraço; param às vezes, têm colisão e vida;
  fogem de tiros, de carros vindo na direção deles e de roubos; cambaleiam ao serem atingidos (sem sangue).
- **Veículos**: cinco modelos originais em low-poly (compacto, sedã, SUV, esportivo e picape utilitária) em
  várias cores. Carros estacionados no estacionamento e junto ao meio-fio podem ser usados; carros parados
  ficam "congelados" (sem custo de física) até serem tocados ou usados.
- **Trânsito**: carros com motorista seguem as faixas, escolhem caminhos nos cruzamentos, respeitam semáforos,
  reservam o cruzamento para não se cruzarem, mantêm distância, param para pedestres e para o jogador e
  buzinam se bloqueados. A quantidade é configurável em `src/config.js`.
- **Roubo de veículos**: carro estacionado: aproximar, "Pressione F para entrar no veículo". Carro ocupado:
  "Pressione F para roubar o veículo"; o carro freia, o motorista é tirado e foge a pé, pedestres por perto
  correm, e o jogador assume o volante. A saída procura um lugar livre (paredes, carros e pessoas são
  verificados). Bater num carro do trânsito faz o motorista abandoná-lo.
- **Dia e noite**: o sol percorre o céu, cor e intensidade da luz, neblina e exposição mudam aos poucos; à noite
  há lua, céu estrelado, janelas acesas, postes com luz no chão e faróis nos carros dirigidos.
- **Áudio**: passos, pulo, tiros, recarga, motor com marchas, pneus, freio, buzina, portas, batidas, ruído do
  trânsito próximo, gritos curtos e murmúrio de pedestres, ambiente da cidade.

Fora do escopo desta fase, conforme pedido: menus, inventário, missões, dinheiro, lojas, polícia/procurado,
multiplayer, customização, história e rádio.

## Estrutura do código

```
src/
  core/        Game (loop com física em passo fixo + interpolação), Physics (Rapier, grupos de colisão),
               Input, AudioSystem (sons sintetizados), math
  config.js    quantidades de pedestres, trânsito e carros estacionados; duração do dia
  world/       City, CityLayout, DayNight, BlockBuilders (conteúdo de cada tipo de quarteirão), BuildingFactory,
               PropFactory, TrafficLights, Environment (céu/luz), Materials, Textures (canvas),
               GeometryBatcher (junta geometria estática por material)
  characters/  CharacterRig (humanoide procedural, uma SkinnedMesh por personagem)
  player/      Player (controlador a pé)
  camera/      ThirdPersonCamera (configurações em CAMERA_SETTINGS, incl. sensibilidade do mouse)
  weapons/     WeaponDefinitions (stats), WeaponModels, WeaponSystem, Effects
  npc/         NPC (comportamento), NPCHealth (vida), NPCManager
  vehicle/     VehicleDefinitions (modelos), VehicleModels, Vehicle (física e modos), VehicleManager,
               VehicleInteraction (entrar, sair e roubar)
  traffic/     RoadNetwork (faixas e curvas), TrafficDriver (IA de um carro), TrafficManager (população)
  ui/          HUD
```

Valores ajustáveis: `GameConfig` (`src/config.js`), `MOVE` (Player), `CAMERA_SETTINGS` (câmera), `WEAPONS`
(armas) e `VEHICLE_TYPES` (carros).

## Desempenho

A geometria estática da cidade é unida por material (algumas dezenas de draw calls), cada personagem é
uma única malha com esqueleto, todas as rodas de todos os carros são um único desenho instanciado, os
carros do trânsito são cinemáticos (sem física pesada), carros parados não são simulados, personagens
distantes animam em taxa reduzida, e à noite só alguns postes têm luz real (os demais usam halos). A física
roda a 60 Hz fixos e a renderização é interpolada.
