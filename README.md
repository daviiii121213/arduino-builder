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
- **Dinheiro** com nove recursos e a **máquina de venda** ao lado da cabana.
- **Inventário 10 / 20 / 30**: começa com 10 espaços de acesso rápido na barra
  inferior e cresce para 20 e 30 com as melhorias — os espaços extras ficam no menu
  do `Tab`, junto com o bestiário e o espaço de armadura.
- **HUD enxuto**: corações, barra de corrida, moeda e relógio, barra de itens e um
  aviso por vez. O alvo da ferramenta é marcado com cantoneiras no próprio objeto,
  sem texto sobre o mundo.
- **Casa interativa**: cama (dorme e adianta o dia), baú (guarda e devolve, e abre
  visivelmente), porta, lareira, estante e janela.
- **Dez dinossauros**, dois de cada categoria, todos redesenhados compactos:
  - **Mágicos** — Luminassauro, Etherodonte: flutuam, atiram orbes e se teleportam.
  - **Carnívoros** — Raptornoz, Dentesangue: caçam e mordem.
  - **Herbívoros** — Folhalonga, Tricornis: pastam e fogem quando feridos.
  - **Terrestres** — Casconte, Pedrapata: lentos, resistentes e territoriais.
  - **Aquáticos** — Nadalonga, Escamarela: não saem da água.
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
  world/      terreno, nível, geração do mundo, interiores, nós de recurso e desenho
  entities/   jogador, dinossauros (IA), fichas das espécies, projéteis, NPCs
  systems/    vida, fome, colisão, partículas, dia/noite, itens, recursos,
              ferramentas, colheita, dinheiro e progresso
  ui/         HUD, janelas (venda, melhorias, baú, testes), diálogo e widgets
  scenes/     menu, cinemática e jogo
  audio/      síntese dos efeitos sonoros
tools/        teste de fumaça automatizado (opcional, usa Playwright)
```

### Como estender

- **Novo dinossauro**: desenhe a arte em `src/gfx/sprites/dinos.ts` (corpo + quadros de
  pernas + cores), acrescente a ficha em `src/entities/dinoTypes.ts` e inclua a espécie
  na lista de nascimentos em `src/world/worldgen.ts`. Toda a IA, a barra de vida, o
  bestiário e o dano funcionam sozinhos a partir da ficha.
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
- **Missões pelo diário** — a tecla `J` já existe e o diário está no inventário; falta
  a lista de missões e a entrega periódica.
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
