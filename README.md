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
| Atacar na direção do cursor | **botão direito do mouse** |
| Interagir (entrar/sair de casa) | `E` |
| Escolher espaço do inventário | `1` … `9`, `0` |
| Bestiário | `Tab` |
| Diário (em breve) | `J` |
| Ligar/desligar som | `M` |
| Pausar | `Esc` |
| Pular a cinemática | `Esc` |

## O que já existe nesta primeira versão

- **Cinemática de abertura** em cinco atos: o galpão, a descoberta da máquina sob o
  pano, a ativação, a falha do estabilizador e a queda pelo túnel do tempo (com
  contador de anos). Pode ser pulada.
- **Movimento livre e suave** com aceleração, atrito por terreno (areia, lama, água
  rasa) e colisão top-down resolvida eixo por eixo.
- **Combate no botão direito**: o golpe sai na direção do cursor, com preparação,
  alcance, arco de acerto, recarga, dano, empurrão, arco luminoso, faíscas, números
  de dano e tremor de câmera.
- **Vida em corações** (5 corações, meio coração de granularidade), invulnerabilidade
  curta após o dano e **regeneração de 1 coração a cada 3 segundos** — que só funciona
  quando o personagem **não está com fome**.
- **Dez dinossauros**, dois de cada categoria, cada um com arte, animação, ficha e
  comportamento próprios:
  - **Mágicos** — Luminassauro, Etherodonte: flutuam, atiram orbes e se teleportam ao levar dano.
  - **Carnívoros** — Raptornoz, Dentesangue: percebem o jogador, caçam e mordem.
  - **Herbívoros** — Folhalonga, Tricornis: pastam em paz e fogem quando feridos (o Tricornis revida se você insistir).
  - **Terrestres** — Casconte, Pedrapata: lentos, resistentes e territoriais.
  - **Aquáticos** — Nadalonga, Escamarela: nunca saem da água e atacam quem entra nela.
- **Casa do jogador** em pixel art completa: telhado de telhas, paredes de tábuas,
  alicerce de pedra, chaminé, porta, janelas com vidro, lampião aceso, quintal com
  cerca, horta, barril e placa — com colisão de verdade e **interior mobiliado**
  (cama, armário, estante, lareira acesa, mesa com cadeiras e lampião, baú, banco,
  barris, quadro, janela, plantas e tapete).
- **Mundo gerado por ruído determinístico** (mesma semente, mesmo vale): lagos,
  praias, lama, afloramentos de rocha, campos de flores, capim seco, araucárias,
  cicadáceas, arbustos, samambaias, troncos caídos, ossadas, cogumelos, juncos e
  cristais mágicos.
- **Câmera** com seguimento suave, limites de mapa e tremor de impacto.
- **Interface**: corações com pulso, barra de regeneração, **inventário de 10 espaços**
  na base da tela, avisos, título do local, dica de interação, cursor de mira,
  bestiário com as dez fichas, menu principal com pôr do sol animado, pausa e tela de
  fim de jogo com renascimento na porta de casa.
- **Áudio procedural** (Web Audio, sem arquivos): golpe, acerto, dano, rugidos,
  passos, cura, magia, portal, trovão e a máquina do tempo.

## Estrutura do código

```
src/
  core/       laço do jogo, tela, entrada, câmera, matemática e ruído
  gfx/        motor de pixel art, paleta, fonte de bitmap e todos os sprites
    sprites/  jogador, dinossauros, terreno, cenário, casa, galpão, interface, efeitos
  world/      tipos de terreno, nível, geração do mundo, interior e renderização
  entities/   jogador, dinossauros (IA), fichas das espécies, projéteis
  systems/    vida, fome, colisão, partículas, ciclo dia/noite
  ui/         HUD, inventário, caixa de diálogo, botões e texto ampliado
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
- **Novo efeito**: acrescente os quadros em `src/gfx/sprites/effects.ts` e dispare com
  `particulas.animacao(...)`, `particulas.jato(...)` ou `particulas.leque(...)`.

## Preparado para as próximas versões

Estes sistemas já têm o lugar e o encaixe prontos, mas ainda não estão ligados:

- **Fome** — `src/systems/hunger.ts`. Basta `fome.ativa = true`: a barra aparece no HUD
  e a regeneração de vida para quando o personagem está com fome.
- **Ciclo de dia e noite** — `src/systems/daynight.ts`. `tempoDoDia.ativo = true` já
  aplica a tinta de amanhecer, tarde e noite sobre o mundo.
- **Inventário de 10 espaços** — `src/ui/inventory.ts` com `guardar`, `remover` e
  seleção; hoje mostra o equipamento inicial (lança de pedra e diário).
- **Missões pelo diário**, **NPCs humanos** com equipamentos e melhorias, **recursos**
  de cavernas e do chão: entram como novos níveis, objetos e itens, sem mexer no núcleo.
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
