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
| `F` | entrar no carro (perto da porta) |
| `H` | mostrar/ocultar a ajuda |

| No carro | |
|---|---|
| `W` | acelerar |
| `S` | frear; parado, dá ré |
| `A` / `D` | direção |
| `Espaço` | freio de mão |
| `F` | sair (abaixo de ~18 km/h) |

## O que está implementado

- **Cidade**: grade de 3×3 quarteirões dentro de um anel viário, fechada por uma fileira contínua de prédios.
  Ruas com faixas, faixas de pedestre, linhas de parada e semáforos que alternam; calçadas elevadas com meio-fio;
  quarteirões de prédios com pátios internos e becos; praça central com fonte, gramados, quiosque e um terraço
  com rampa e escada; praça cívica com torre de escritórios; estacionamento com loja e rampa de acesso.
  Os prédios são gerados com térreo comercial (vitrines, toldos, letreiros), fachadas por andar, cornijas,
  platibandas e equipamentos no telhado. Silhuetas distantes sugerem que a cidade continua além do mapa.
- **Iluminação**: céu físico de fim de tarde, sol com sombras que acompanham o jogador, luz ambiente do céu,
  reflexos (environment map) e neblina de distância.
- **Jogador**: controlador de personagem cinemático do Rapier (degraus/meio-fio por autostep, rampas,
  encaixe no chão), aceleração e desaceleração suaves, giro natural, gravidade, pulo com tolerância
  (coyote time e buffer). Animação procedural de andar, correr, pular, mirar e recarregar, com IK de dois
  ossos para as mãos segurarem a arma.
- **Câmera**: terceira pessoa com braço de mola que não atravessa paredes, modos a pé, armado, mirando e
  dirigindo, com transições suaves; câmera de perseguição que volta para trás do carro.
- **Armas**: pistola e fuzil com modelos próprios visíveis nas mãos (a arma não equipada fica no coldre ou
  nas costas), tiro hitscan (raio da câmera + raio do ombro, então não se atira através de paredes),
  dispersão, recuo de câmera e da arma, clarão de disparo com luz, traçante, faíscas, poeira e marcas de bala,
  munição no pente e de reserva, recarga manual e automática.
- **NPCs**: 18 civis com aparência variada caminhando por calçadas, pela praça e pelo terraço. Têm colisão
  e vida; ao ouvir tiros fogem, ao serem atingidos cambaleiam (com um flash de impacto, sem sangue), e
  podem ser derrubados pelo carro. Depois de "mortos" desaparecem e reaparecem longe do jogador.
- **Carro**: hatch original com chassi dinâmico e veículo de raycast do Rapier (suspensão, tração traseira,
  freio, freio de mão, direção sensível à velocidade, downforce). Entrar/sair com escolha de lugar livre
  para descer, motorista visível sentado e recuperação automática se o carro ficar capotado parado.
- **Áudio**: tiros com eco urbano, recarga, troca de arma, passos, pulo/aterrissagem, impactos, portas,
  motor com marchas simuladas, chiado de pneu, batidas e ambiente da cidade (trânsito distante, vento,
  pássaros, buzinas ao longe).
- **HUD** mínimo: mira (abre com a dispersão), marcador de acerto, arma e munição, aviso de interação,
  velocímetro e um lembrete de controles.

Fora do escopo desta fase, conforme pedido: menus, inventário, missões, dinheiro, lojas, polícia/procurado,
multiplayer, customização, história e rádio.

## Estrutura do código

```
src/
  core/        Game (loop com física em passo fixo + interpolação), Physics (Rapier, grupos de colisão),
               Input, AudioSystem (sons sintetizados), math
  world/       City, CityLayout, BlockBuilders (conteúdo de cada tipo de quarteirão), BuildingFactory,
               PropFactory, TrafficLights, Environment (céu/luz), Materials, Textures (canvas),
               GeometryBatcher (junta geometria estática por material)
  characters/  CharacterRig (humanoide procedural, uma SkinnedMesh por personagem)
  player/      Player (controlador a pé)
  camera/      ThirdPersonCamera (configurações em CAMERA_SETTINGS, incl. sensibilidade do mouse)
  weapons/     WeaponDefinitions (stats), WeaponModels, WeaponSystem, Effects
  npc/         NPC, NPCManager
  vehicle/     CarModel, Car (física/afinação em TUNING), VehicleInteraction (entrar/sair)
  ui/          HUD
```

Valores ajustáveis ficam no topo dos módulos: `MOVE` (Player), `CAMERA_SETTINGS` (câmera), `WEAPONS`
(armas) e `TUNING` (carro).

## Desempenho

A geometria estática da cidade é unida por material (algumas dezenas de draw calls), cada personagem é
uma única malha com esqueleto, os efeitos usam pools e as marcas de bala são instanciadas. A física roda
a 60 Hz fixos e a renderização é interpolada.
