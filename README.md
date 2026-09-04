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
| **Usar a ferramenta escolhida** | **botão esquerdo do mouse** |
| **Golpe em área, em volta do corpo** | **botão direito do mouse** |
| Interagir (porta, cama, baú, máquina, pessoas) | `E` |
| Escolher espaço do inventário | `1` … `9`, `0` |
| Espaço anterior | `Q` |
| Bestiário | `Tab` |
| Diário (em breve) | `J` |
| Ligar/desligar som | `M` |
| Pausar | `Esc` |
| Painel de atalhos (só no modo teste) | `F1` |

O ataque não tem mira: ele acerta tudo dentro de um círculo em volta do jogador, e
o círculo aparece na tela no momento do golpe.

## O que já existe nesta versão

- **Cinemática de abertura** em cinco atos: o galpão, a descoberta da máquina sob o
  pano, a ativação, a falha do estabilizador e a queda pelo túnel do tempo (com
  contador de anos). Pode ser pulada.
- **Movimento livre e suave** com aceleração, atrito por terreno (areia, lama, água
  rasa) e colisão top-down resolvida eixo por eixo.
- **Combate em área**: o golpe do botão direito atinge tudo num raio de 38 pixels,
  com círculo desenhado no chão, lança girando, faíscas, números de dano, empurrão
  e tremor de câmera.
- **Dez corações** (com meio coração de granularidade), invulnerabilidade curta após
  o dano e **regeneração de 1 coração a cada 3 segundos** — que só funciona quando o
  personagem **não está com fome**.
- **Quatro ferramentas**, cada uma com desenho, animação de batida e função própria:
  - **machado** derruba araucárias e cicadáceas (madeira, fibra, semente);
  - **picareta** quebra pedras e veios (pedra, minério de ferro, cristal);
  - **pá** cava os montinhos de terra fofa (argila, osso, semente, fóssil);
  - **enxada** ara a terra boa e colhe o capim alto (fibra, semente).
  Cada nó de recurso tem vida, barrinha de progresso, lascas voando e volta a
  crescer depois de um tempo.
- **Dinheiro**: nove recursos com valor próprio e uma **máquina de venda** ao lado da
  cabana, com lista de recursos, quantidade, valor unitário, total por linha e ganho
  da visita (vender 1, vender a pilha ou vender tudo).
- **Cabana de melhorias** ao lado da casa, com exterior, interior, oficina e duas
  pessoas: **Bruna** melhora as quatro ferramentas (pedra → ferro → cristal, e o
  desenho muda na mão do jogador) e **Nilo** melhora a bolsa (6 → 8 → 10 espaços e
  20 → 50 → 99 por espaço), o baú (12 → 24) e a casa (cama macia, telhado novo com
  cata-vento visível no mundo).
- **Casa interativa**: a cama faz dormir e adianta o ciclo do dia, o baú guarda e
  devolve itens (com o baú aberto aparecendo no cenário), a porta leva para dentro e
  para fora, e a lareira, a estante e a janela respondem com falas.
- **Inventário de 10 espaços** na base da tela, com espaços trancados até serem
  comprados, empilhamento, ferramentas que não empilham e troca com o baú.
- **Ciclo de dia e noite** rodando, com relógio na interface e tinta ambiente.
- **Dez dinossauros**, dois de cada categoria, cada um com arte, animação, ficha e
  comportamento próprios:
  - **Mágicos** — Luminassauro, Etherodonte: flutuam, atiram orbes e se teleportam ao levar dano.
  - **Carnívoros** — Raptornoz, Dentesangue: percebem o jogador, caçam e mordem.
  - **Herbívoros** — Folhalonga, Tricornis: pastam em paz e fogem quando feridos (o Tricornis revida se você insistir).
  - **Terrestres** — Casconte, Pedrapata: lentos, resistentes e territoriais.
  - **Aquáticos** — Nadalonga, Escamarela: nunca saem da água e atacam quem entra nela.
- **Mundo gerado por ruído determinístico** (mesma semente, mesmo vale): lagos,
  praias, lama, afloramentos de rocha, campos de flores, capim alto, araucárias,
  cicadáceas, montinhos de terra, troncos caídos, ossadas e cristais mágicos.
- **Modo teste**, separado do jogo normal: selo permanente na tela, dinheiro e
  recursos infinitos, todas as ferramentas e melhorias liberadas, inventário cheio e
  um **painel de atalhos (F1)** com uma entrada para cada sistema — entrar na casa e
  na cabana, abrir a venda, as melhorias e o baú, dormir, adiantar o relógio, encher
  ou zerar a bolsa, zerar as melhorias para testar as compras de novo, trazer um
  dinossauro para o lado e levar dano.
- **Interface**: corações em duas fileiras, dinheiro, relógio, avisos, título do
  local, dica de interação, dica da ferramenta em foco, bestiário com as dez fichas,
  menu principal com pôr do sol animado, pausa e tela de fim de jogo.
- **Áudio procedural** (Web Audio, sem arquivos): golpe, acerto, dano, rugidos,
  passos, cura, magia, portal, trovão e a máquina do tempo.

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
