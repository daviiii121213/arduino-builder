# Cronos Jurássico

RPG 2D **top-down** em **pixel art**, feito em **TypeScript + HTML5 Canvas**, todo em
**português do Brasil**.

Téo entra no galpão fechado do avô, encontra uma máquina do tempo escondida debaixo
de um pano e, ao mexer no painel, é jogado mais de **100 milhões de anos** para trás —
direto na era dos dinossauros.

> **Toda a arte é original e gerada pelo próprio jogo.** Não existe nenhuma imagem,
> fonte ou som externo no projeto: sprites, terreno, casa, criaturas, interface,
> a fonte de bitmap e até os efeitos sonoros são desenhados/sintetizados em código.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento (Vite)
npm run build    # gera dist/ pronto para publicar
npm run preview  # serve o dist/
```

Precisa apenas de um navegador moderno. Requer teclado e mouse.

## Jogar em uma única página

```bash
npm run pacote   # gera dist/cronos-jurassico.html
```

O arquivo resultante contém HTML, CSS e JavaScript em linha, sem nenhuma
referência externa e apenas com caracteres ASCII (os acentos viram entidades),
então abre com um duplo clique e também funciona embutido em um quadro
(`iframe`) que não declare codificação.

## Controles

| Ação | Tecla |
| --- | --- |
| Andar | `W` `A` `S` `D` (setas também) |
| **Correr** | **`Shift`** (com barra de resistência) |
| Usar a ferramenta escolhida | **botão esquerdo do mouse** |
| Golpe em área com a lança | **botão direito do mouse** |
| Interagir (porta, cama, baú, máquina, pessoas) | `E` |
| Escolher o item da barra (aparece na mão) | `1` … `9`, `0` |
| Mochila completa e bestiário | `Tab` |
| Diário do avô (missões) | `J` |
| Mochila → aba `COLEÇÃO` (arqueologia) | `Tab` e depois `Q` |
| Ligar/desligar som | `M` |
| Pausar | `Esc` |
| Painel de atalhos (só no modo teste) | `F1` |

O ataque não tem mira: acerta tudo dentro de um círculo em volta do jogador, e o
círculo aparece na tela no momento do golpe.

## O que já existe nesta versão

- **Cinemática de abertura** em cinco atos: o galpão, a máquina sob o pano, a
  ativação, a falha do estabilizador e o túnel do tempo. Pode ser pulada.
- **Traço compacto**: gente e dinossauros têm proporções baixas e largas (o
  protagonista tem 18x16 pixels, com a cabeça ocupando quase metade do corpo), e a
  casa (64x56) e a cabana (76x62) são pequenas e cheias em vez de grandes e vazias.
- **Movimento** com aceleração, atrito por terreno e **corrida no `Shift`**, com
  barra de resistência, poeira nos pés e passo mais rápido.
- **Equipamento na mão**: o item escolhido na barra aparece sempre na mão — lança,
  machado, picareta, pá ou enxada — com pose de repouso, de uso e de golpe.
- **Lança de pedra** como arma permanente: nunca sai do inventário, tem desenho
  próprio (cabo com amarração e ponta de pedra), animação de giro, som e dano maior
  que bater com uma ferramenta.
- **Dez corações**, invulnerabilidade curta e regeneração de 1 coração a cada 3
  segundos (parada quando houver fome).
- **Armaduras compradas com dinheiro** na cabana: couro, placas de osso e casca de
  cristal. Cada uma tem camada própria sobre o corpo (capacete + peitoral em três
  vistas), ícone, absorção de dano e peso — e aparece no personagem na hora.
- **Quatro ferramentas** com três níveis (pedra, ferro, cristal), animação de batida
  e função própria: machado (árvores), picareta (pedras e veios), pá (montinhos de
  terra) e enxada (ara a terra e colhe capim).
- **Dinheiro** com trinta e cinco recursos (fibras, minérios, gemas e peças de
  arqueologia) e a **máquina de venda** ao lado da cabana.
- **Duas cavernas com dez andares cada**, com a boca à vista da porta de casa —
  uma de cada lado do quintal, a poucos passos:
  - **Gruta de Cristal** — fria e azulada. Prata, ametista, diamante e, no
    fundo, **astralita**. Mora ali o **Cristalodonte**.
  - **Abismo Ígneo** — quente, com lava intransponível. Ouro, obsidiana, rubi e,
    no fundo, **núcleo ígneo**. Mora ali o **Ignívoro**.
- **Andares sempre diferentes**: cinco traçados (galerias, cavernoso, fenda,
  labirinto e salão) montados com as mesmas peças — paredes, corredores, salas,
  pilares, estalagmites, formações e escadas —, com semente derivada da caverna
  e do número do andar. Nenhum andar é cópia de outro, mas todos parecem a mesma
  caverna.
- **Dificuldade que cresce pelo desenho, não pela vida**: corredores mais
  estreitos, mais poças/lava bloqueando, mapas maiores, mais bichos e criaturas
  mais perigosas conforme desce. A tabela de minérios e a de criaturas mudam a
  cada faixa de andares.
- **Guincho**: cada andar tem uma plataforma que sobe direto para o vale, e a
  do primeiro andar desce direto para o andar mais fundo já alcançado — ninguém
  precisa refazer os dez andares. Chegar a um andar inédito rende moedas.
- **Chefes do décimo andar**, um por caverna, com arte própria (bem maiores que
  qualquer dinossauro), arena de tochas, barra de vida com as fases no alto da
  tela, três fases (mais rápido, recarga mais curta e ajuda chamada a partir da
  segunda) e um ataque especial próprio — anel de lascas de cristal e chuva de
  brasa. Combate sem sangue e sem cena forte.
- **Recompensas diferentes em cada caverna**: as duas dão 900 moedas, minérios
  raros e o **esqueleto completo**; a Gruta ainda dá a **Lanterna de Cristal**
  (dobra o alcance da luz nas cavernas) e o Abismo a **Armadura de Escamas
  Ígneas** (a melhor do jogo, e não está à venda em lugar nenhum).
- **Mineração com peso**: cada tipo de rocha responde de um jeito — madeira
  abafa, rocha estala, veio de minério solta faísca de metal com um tinido
  agudo e tremida maior. O achado sai com lascas na cor do minério, e a primeira
  gema rara de cada tipo é comemorada na tela.
- **Escuridão de caverna**: uma camada escura com furos de luz no jogador, nas
  tochas, no guincho e nos veios — nada de interface extra, a leitura vem da
  luz. Fica mais escuro a cada andar, e a Lanterna de Cristal abre o alcance.
- **Arqueologia**: onze peças fósseis desenhadas à mão, com raridade (comum a
  lendária) e origem própria — algumas só saem de um bioma, outras só do fundo
  das cavernas. Saem da pá, nos montinhos, nas turfeiras, na areia vitrificada e
  nos sítios de escavação das galerias, com animação de descoberta na cor da
  raridade. A aba **COLEÇÃO** do `Tab` é a vitrine: o que falta aparece como
  silhueta, com a dica de onde procurar.
- **Inventário 10 / 20 / 30**: começa com 10 espaços de acesso rápido na barra
  inferior e cresce para 20 e 30 com as melhorias — os espaços extras ficam no menu
  do `Tab`, junto com o bestiário e o espaço de armadura.
- **HUD enxuto**: corações, barra de corrida, moeda e relógio, barra de itens e um
  aviso por vez. O alvo da ferramenta é marcado com cantoneiras no próprio objeto,
  sem texto sobre o mundo.
- **Casa interativa**: cama (dorme e adianta o dia), baú (guarda e devolve, e abre
  visivelmente), porta, lareira, estante e janela.
- **Cinco biomas** com identidade própria — terreno, vegetação, recursos, tinta de
  ar, partículas, som de fundo e criaturas nativas —, separados por fronteiras
  orgânicas (Voronoi deformado por ruído) em que os dois lados se misturam tile a
  tile, sem emenda reta:
  - **Vale dos Gigantes** — campo aberto, lagos rasos, araucárias. É onde fica a casa.
  - **Clareira Encantada** — grama azul, veios de cristal, árvores de cristal,
    faíscas no ar e um zumbido baixo. Dá **cristal** e **essência arcana**.
  - **Pântano das Raízes** — água parada, turfa e lama funda (que segura o passo),
    ciprestes e árvores mortas. Dá **turfa**, argila e fósseis.
  - **Floresta Fechada** — copas altas e escuras, folhagem no chão, samambaias
    gigantes e arbustos de baga. Dá **madeira** em quantidade e **resina**.
  - **Campo de Lava** — cinza no ar, pedra negra, fumarolas acesas e rios de lava
    intransponíveis. Dá **obsidiana** e **enxofre**.
  - **Deserto de Vidro** — dunas claras, solo rachado, cactos, arenito e oásis com
    palmeiras. Dá **vidro do deserto**, pedra e fósseis.
- **Trinta e três dinossauros** (25 na superfície e 8 nas cavernas), todos desenhados à mão e compactos, com
  **dificuldade de 1 a 5** que muda vida, dano, velocidade de corrida, raio de
  percepção, paciência na caçada e comportamento — não só a barra de vida:
  - **Vale** — Raptornoz, Dentesangue, Folhalonga, Tricornis, Casconte, Pedrapata.
  - **Clareira Encantada** — Luminassauro, Etherodonte, **Arcanoraptor** (3/5),
    **Cristalossauro** (4/5), **Lumidraco** (5/5).
  - **Pântano** — Nadalonga, Escamarela, **Pântanossauro** (2/5), **Crocossauro**
    (3/5), **Venomossauro** (5/5, deixa veneno que tira vida por alguns segundos —
    sem sangue e sem cena forte).
  - **Floresta** — **Silvassauro** (1/5), **Espinosselva** (3/5), **Feroxossauro** (4/5).
  - **Campo de Lava** — **Magmossauro** (3/5), **Ignissauro** (4/5, cospe fogo à
    distância), **Vulcanor** (5/5).
  - **Deserto** — **Arenossauro** (2/5), **Dunassauro** (3/5), **Tempestossauro** (5/5).
  - **Gruta de Cristal** — **Pedrolito** (1/5), **Cavernossauro** (2/5),
    **Geodonte** (3/5), **Espectrossauro** (4/5) e o chefe **Cristalodonte**.
  - **Abismo Ígneo** — **Escaldossauro** (3/5), **Brasadonte** (4/5) e o chefe
    **Ignívoro**.
- **Animação por estilo de andar**: passos pesados, saltos, rastejar colado no chão,
  ondular e flutuar — cada estilo tem cadência, balanço e rastro próprios, e o aviso
  de golpe pulsa na cor da própria criatura.
- **Bestiário com as 33 criaturas** (`Tab` → `BESTIÁRIO`): lista agrupada por bioma,
  bolinhas de dificuldade, ficha com bioma e categoria, e o que ainda não foi
  encontrado aparece só como silhueta. Basta chegar perto de uma criatura para
  anotá-la. As duas cavernas entram como regiões próprias, depois dos biomas.
- **Missões pelo diário do avô** (`J`): as páginas chegam sozinhas conforme o jogo
  avança (até três abertas por vez), com barra de progresso, recompensa em moedas e
  o mapa das regiões já conhecidas. A corrente de missões leva o jogador do quintal
  até cada um dos cinco biomas.
- **Perseguição com fim**: cada espécie tem raio de percepção, raio de território e
  paciência. Se o jogador escapa, se o bicho se afasta demais da própria área ou se
  a caçada se arrasta, ele desiste, volta caminhando para casa e ignora o jogador
  por alguns segundos.
- **Ciclo de dia e noite** rodando, com relógio e tinta ambiente.
- **Modo teste** separado do jogo normal: selo na tela, dinheiro e recursos
  infinitos, tudo liberado e um **painel de atalhos (`F1`)** com uma entrada para
  cada sistema (entrar nos prédios, vender, melhorias, baú, dormir, trocar armadura,
  zerar melhorias para testar compras, trazer um dinossauro, levar dano).
- **Áudio procedural** (Web Audio, sem arquivos).

## Estrutura do código

```
src/
  core/       laço do jogo, tela, entrada, câmera, matemática e ruído
  gfx/        motor de pixel art, paleta, fonte de bitmap e todos os sprites
    sprites/  jogador, dinossauros, terreno, cenário, casa, galpão, interface, efeitos
  world/      terreno, biomas, cavernas, nível, geração do mundo, interiores e nós
  entities/   jogador, dinossauros (IA), fichas das espécies, projéteis, NPCs
  systems/    vida, fome, colisão, partículas, dia/noite, itens, recursos,
              ferramentas, colheita, dinheiro, progresso, missões e arqueologia
  ui/         HUD, janelas (venda, melhorias, baú, testes, mochila, diário) e widgets
  scenes/     menu, cinemática e jogo
  audio/      síntese dos efeitos sonoros
tools/        teste de fumaça automatizado (opcional, usa Playwright)
```

### Como estender

- **Novo dinossauro**: desenhe a arte em `src/gfx/sprites/dinos.ts` (corpo + quadros de
  pernas + cores), acrescente a ficha em `src/entities/dinoTypes.ts` e inclua a espécie
  na lista de nascimentos em `src/world/worldgen.ts`. Toda a IA, a barra de vida, o
  bestiário e o dano funcionam sozinhos a partir da ficha.
- **Novo bioma**: uma ficha em `src/world/biomes.ts` (nome, função de terreno, tinta,
  partículas, som, recursos e espécies nativas), um centro em `CENTROS`, as texturas
  de chão em `src/gfx/sprites/terrain.ts` e um `case` na vegetação, em
  `src/world/worldgen.ts`. O mapa, as fronteiras, o bestiário, o diário e a
  atmosfera passam a considerá-lo sozinhos.
- **Nova caverna**: uma ficha em `src/world/caveDefs.ts` (nome, cor, escuridão,
  som, tabelas de minério e de criaturas por andar, chefe e recompensa) mais as
  texturas de piso/parede. O gerador de andares, o guincho, o bestiário, o
  diário e a escuridão passam a atendê-la sem mudança.
- **Novo andar ou traçado**: um `case` novo em `gerarAndar`, em
  `src/world/caves.ts` — as peças (salas, corredores, decoração, minérios,
  criaturas) já vêm prontas.
- **Novo chefe**: a arte em `dinos.ts`, a ficha em `dinoTypes.ts` com o campo
  `chefe` (fases, especial, quem ele invoca) e o id na caverna. A barra do alto
  da tela, as fases e o baú de recompensa funcionam a partir da ficha.
- **Novo fóssil**: uma linha em `FOSSEIS`, em `src/systems/fossils.ts` (nome,
  valor, raridade e origem), mais o desenho em `gfx/sprites/tools.ts`. O
  sorteio, a coleção, a venda e as missões já o consideram.
- **Novo minério**: uma linha em `resources.ts`, o veio em `world/nodes.ts`, a
  cor do bloco em `gfx/sprites/cave.ts` e o peso na tabela da caverna.
- **Nova missão**: uma linha em `CATALOGO_MISSOES`, em `src/systems/missions.ts`, com
  o objetivo, a recompensa e as missões que ela exige antes.
- **Novo mapa**: crie um `Nivel`, preencha os tiles, adicione objetos com `colocar()` e
  ligue-o por um `Portal`. Registre-o no mapa de níveis em `src/scenes/play.ts`.
- **Novo objeto de cenário**: desenhe em `src/gfx/sprites/props.ts` e posicione com
  `colocar(nivel, sprite, x, y, { colisao, sombra, balanca })`.
- **Novo recurso**: uma linha em `src/systems/resources.ts` (nome e valor) e o ícone
  em `src/gfx/sprites/tools.ts`.
- **Novo nó de recurso**: uma entrada em `src/world/nodes.ts` (vida, quedas, tempo de
  volta e sprite de esgotado) e um `plantarNo(...)` na geração do mundo.
- **Nova ferramenta**: desenho em `src/gfx/sprites/tools.ts` e ficha em
  `src/systems/tools.ts` (o alvo é um tipo de nó; a animação e a mira já funcionam).
- **Nova melhoria**: um objeto em `CATALOGO`, em `src/systems/progression.ts`, com
  custo, vendedor e o que muda no progresso.
- **Nova armadura**: uma paleta em `src/gfx/sprites/armor.ts` e uma ficha em
  `src/systems/armor.ts` — a camada sobre o corpo, o ícone e a venda saem prontos.
- **Novo objeto interativo**: acrescente um `Interativo` ao nível e trate a ação em
  `executarInterativo`, na cena de jogo.
- **Novo efeito**: acrescente os quadros em `src/gfx/sprites/effects.ts` e dispare com
  `particulas.animacao(...)`, `particulas.jato(...)` ou `particulas.leque(...)`.

## Preparado para as próximas versões

- **Fome** — `src/systems/hunger.ts`. Basta `fome.ativa = true`: a barra aparece no HUD
  e a regeneração de vida para quando o personagem está com fome.
- **Cavernas e novos mapas** — um `Nivel` novo, ligado por um `Portal`, já entra sem
  mexer no núcleo; os nós de recurso funcionam igual lá dentro.
- **Plantio** — a enxada já deixa a terra arada (`Tile.TerraArada`) e as sementes já
  são um recurso guardável.
- Sem sistema de criação de itens, sem evolução de personagem, sem construção e sem
  chefes — por decisão de projeto.

## Teste de fumaça (opcional)

```bash
npm run build
npx playwright install chromium
npm run smoke
```

O script abre o jogo num navegador controlado, passa pelo menu, pela cinemática, luta
com os dinossauros, entra na casa, morre, renasce, e ao final informa o FPS médio e
qualquer erro de console. As capturas ficam em `tools/capturas/`.

```bash
npm run biomas
```

Faz o passeio pelos cinco biomas usando o painel de teste e salva uma captura de
cada um, mais o diário e o bestiário, em `tools/capturas-biomas/`.

```bash
npm run cavernas
```

Entra nas duas cavernas, desce até a arena do chefe, abre o bestiário, a coleção
de arqueologia e o diário, e salva tudo em `tools/capturas-cavernas/`.
