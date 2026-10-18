# Shooting Range

Cenário 3D (FBX) com movimentação em primeira pessoa, feito em C# (.NET 8) com
OpenGL, sem engine.

## Controles

- **W A S D**: mover
- **Mouse**: mirar (clique na janela para capturar o mouse)
- **Botão esquerdo**: atirar (um tiro por clique; segurando, no modo automático)
- **R**: recarregar
- **F**: inspecionar a arma
- **Espaço**: pular
- **Ctrl**: agachar
- **Shift**: correr
- **Tab** ou **Esc**: pausar e abrir as melhorias
- **E** (olhando para uma arma da bancada): trocar pela arma da mão
- **Botão direito**: luneta do Mosin (3,5x) ou, com a melhoria "Mira ótica", zoom 2x

## Jogo

Cada alvo pontua conforme o lugar atingido: centro vermelho (X) = 10, anéis 9, 8 e 7,
o resto da silhueta = 5 e o papel branco = 0. As três miras redondas (cabeça e laterais)
valem 10 / 9 / 8. Quando um alvo é acertado, ele corre no trilho para outra distância.
Os pontos ficam no canto superior direito. Tiros que erram deixam marca na parede.

A mira (verde, como a do CS) abre e fecha conforme a imprecisão do momento: abre ao andar,
pular ou atirar rápido e fecha parado. A câmera acompanha o recuo inteiro, então a bala sai sempre
no centro da mira (menos o espalhamento).

No menu (tela de início/pausa) há a opção **Arma automática: ativado / desativado**. Ativado,
segurar o botão atira a 600 disparos por minuto.

### Baias com pontuação

As baias são numeradas como as placas do estande (1 a 10). Nas baias **1, 4, 6 e 9**, ao entrar
os pontos zeram; ao sair, uma tela separada mostra o total, tiros, acertos, erros e quantos pontos
o jogador tinha antes do 1º erro, do 2º erro e assim por diante (e quantos fez desde o erro anterior).
Erro é qualquer tiro que não pontua (parede, papel branco ou suporte do alvo). As baias 2, 3, 5, 7,
8 e 10 não têm sessão: lá a pontuação continua como treino.

### Melhorias

Ao sair de uma baia com pontuação, os pontos feitos nela viram **créditos**. Com o jogo pausado
(Tab ou Esc), os cartões no canto superior esquerdo mostram as melhorias; clicar num cartão compra o
próximo nível (o preço sobe a cada nível). Entrar numa baia com pontuação também enche o pente e a reserva.

| Melhoria | Por nível |
|---|---|
| Controle de recuo | -15% de recuo (até 5 níveis) |
| Estabilidade | -10% de imprecisão parado e agachado (5) |
| Tiro em movimento | -15% de imprecisão andando (5) |
| Recarga rápida | recarga 10% mais rápida (5) |
| Carregador estendido | +5 balas no pente, até 50 (4) |
| Munição de reserva | +30 balas de reserva (5) |
| Recuperação | a mira volta ao centro 25% mais rápido (5) |
| Mira ótica | segurar o botão direito aproxima 2x (1) |

Nomes e preços ficam em `models/upgrades.json` (usado pelas duas versões). O progresso fica salvo em
`~/.config/ShootingRange/progress.json` na versão C# e no navegador na versão web; o botão
"Zerar progresso" (dois cliques) começa de novo.

### Armas

O jogo começa com o **AK-47** na mão. As outras armas ficam deitadas na **bancada** (o balcão da parede
do fundo do saguão): **Mosin-Nagant PU**, **escopeta calibre 12**, **Walther P38**, **FN Five-seveN** e
**Colt M1911A1**. Olhando para uma delas de perto aparece **"E Pegar ..."**: a arma da bancada vem para a
mão e a da mão fica no lugar dela, deitada do mesmo jeito. Cada arma guarda a própria munição. Não há mais
troca de arma no menu.

Os números, o modelo, as poses e as animações de cada arma ficam no JSON dela (`models/*_viewmodel.json`),
usados pelas duas versões. Os modelos das quatro armas novas são os mesmos que antes eram só decoração
(Poly Haven e Quaternius, CC0), preparados por `tools/bench-guns.py` no Blender: peças móveis separadas
(ferrolho, carregador, telha, gatilho), escala real e o punho alinhado ao da Five-seveN (pistolas) ou do
AK (armas longas), para as poses dos braços encaixarem. As poses novas foram calculadas por IK (CCD).

| Arma | Calibre | Pente | Cadência | Recuo | Observações |
|---|---|---|---|---|---|
| AK-47 | 7,62×39 | 30/90 | 600/min | 5x | automático opcional |
| Mosin-Nagant M91/30 PU | 7,62×54R | 5/25 | 1,25 s por tiro | 3x | ferrolho a cada tiro, luneta PU 3,5x, carga cartucho a cartucho |
| Escopeta 12 (tipo Remington 870) | 12 | 8/32 | 0,88 s por tiro | 1x (recuo 143 da Nova) | 9 chumbos, bombeia a cada tiro, carga cartucho a cartucho |
| Walther P38 | 9×19 | 8/24 | 400/min | 3,5x | ferrolho trava aberto, estojo sai para a esquerda |
| FN Five-seveN | 5,7×28 | 20/100 | 400/min | 3,5x | ferrolho trava aberto |
| Colt M1911A1 | .45 ACP | 7/21 | 352/min | 3,5x | ferrolho trava aberto |

#### Mosin-Nagant M91/30 PU

Fuzil de ferrolho russo de 7,62×54R: 123 cm, 4 kg, depósito de 5 cartuchos (IMFDB), com a luneta PU de
3,5x (Forgotten Weapons). Como a luneta fica em cima da janela da culatra, o pente de 5 não entra: os
cartuchos vão um a um com o ferrolho aberto.

- **Como segurar**: mão direita no delgado da coronha, mão de apoio embaixo da coronha à frente do depósito.
- **Ferrolho** (Outdoor Life, "How to Cycle a Bolt Properly"): depois de cada tiro a mão direita levanta a
  alavanca (o ferrolho gira 85°), puxa para trás (o estojo sai), empurra para a frente e abaixa num
  movimento só, com a arma um pouco girada para fora e o rosto na coronha.
- **Recarga**: abre o ferrolho, coloca um cartucho de cada vez e fecha. Atirar durante a recarga termina
  depois do cartucho atual (como no CS2).
- **Luneta**: botão direito mostra a retícula PU (poste central vindo de baixo e dois postes laterais);
  com ela a imprecisão parado cai de 0,03 para 0,0025. Números do jogo baseados na SSG 08 do CS2.

#### Escopeta calibre 12

Espingarda de bombeamento no estilo da Remington 870, com os números da Nova do CS2: 9 chumbos por tiro,
68 disparos por minuto, 8/32, 0,5 s por cartucho, imprecisão 7 parado e 36,75 andando, recuo 143
(csdb.gg, SteamAnalyst).

- **Como segurar** ("push-pull", Shooting Illustrated e Mossberg): a mão direita puxa a coronha contra o
  ombro e a de apoio empurra a telha para a frente.
- **Bombear**: depois de cada tiro a mão de apoio puxa a telha para trás (o estojo sai) e devolve.
- **Recarga**: com a arma girada, a mão de apoio coloca os cartuchos um a um pela janela embaixo da
  caixa da culatra; se estava vazia, bombeia no fim para pôr um cartucho na câmara.
- Os chumbos de um tiro somam os pontos num tiro só; um tiro que não acerta nenhum chumbo é um erro.

#### Walther P38

Pistola alemã de 9×19 mm: 216 mm, carregador de 8, ferrolho que trava aberto depois do último tiro e
retém do carregador no calcanhar do punho (Wikipedia, Athlon Outdoors). Usa a empunhadura "thumbs forward"
da Five-seveN; na recarga a mão de apoio puxa o carregador pelo fundo do punho. O estojo sai para cima e
para a esquerda. Números baseados na P250 do CS2.

#### Colt M1911A1

Pistola americana de .45 ACP: 216 mm, 1,1 kg, carregador de 7 (Wikipedia). Pegada alta com o polegar da mão
forte em cima da trava manual ("ride the safety", Shooting Illustrated), que na "thumbs forward" fica
onde o polegar já está. Números baseados na USP-S do CS2. O modelo não tinha carregador separado: um foi
criado dentro do punho, acima da base.

#### FN Five-seveN

Pistola belga de 5,7×28 mm (Wikipedia, IMFDB): 208 mm, armação de polímero, carregador de 20, trava
ambidestra e retém do carregador logo atrás do guarda-mato. Modelo `models/fiveseven.glb`, exportado do
`.blend` recebido com o Blender por `tools/fiveseven-parts.py` (+ `tools/parts-glb.py`): ferrolho,
gatilho e retém separados para animar, e um carregador criado dentro do punho (o original não tinha).

- CS2 (csdb.gg, gamingpromax): 400 disparos por minuto, 20/100 balas, velocidade 240, recuperação 0,2 s,
  recarga ~2,2 s. Imprecisões e recuo são estimativas (as fontes não trazem esses números)
- Recuo 3,5 vezes o calibrado (o AK continua 5x); só semiautomática
- **Empunhadura "thumbs forward"** (Have Gun Will Train, Julie Golob): mão forte alta no punho, mão de
  apoio por cima dos dedos dela, polegares para a frente no lado esquerdo da armação e o indicador no
  gatilho. Cada dedo foi posicionado por IK no ponto certo do punho
- O ferrolho corre a cada tiro e **fica travado atrás quando o pente esvazia**
- Recarga: o retém solta o carregador, a mão de apoio busca outro embaixo e empurra no punho; com o pente
  vazio, ainda puxa o ferrolho por cima ("overhand rack", Lucky Gunner / Pistol-Training)

#### AKM (AK-47)

Modelo `models/akm.glb`, gerado do `AKM.fbx` recebido por `tools/akm-parts.mjs` e `tools/akm-glb.py`:
o modelo vinha com ossos (carregador, ferrolho, retém, seletor) e sem cores, então foi separado em
peças rígidas por osso e pintado como um AKM real (madeira laminada, punho de baquelite, aço preto,
porta-ferrolho em aço nu).

Valores do AK-47 no CS2 (csdb.gg, profilerr.net):

- 600 disparos por minuto (0,1 s entre tiros), aqui um tiro por clique
- Pente de 30, reserva de 90; recarga em 2,43 s (3,1 s com o pente vazio, por causa da alavanca de manejo)
- Imprecisão: parado 0,00641 rad, agachado 0,00481, andando +0,175 (só acima de 34% da velocidade
  máxima, o que permite o "counter-strafe"), no ar +0,4 (estimativa)
- Cada tiro soma 0,0078 de imprecisão (valor do CS:GO), que cai a 10% em 0,368 s
- Recuo ("aim punch") 30 com variação de ±70° na direção, aqui 5 vezes mais forte (o primeiro tiro
  sobe ~25°). No CS2 a câmera mostra 45% do recuo; aqui mostra 100%, para a bala seguir a mira
- Velocidade máxima 215; balas atravessam vidro
- Movimento da Source: atrito 5,2, aceleração 5,5, controle no ar limitado, gravidade 800,
  pulo de 301,99 u/s; agachado anda a 34% da velocidade

### Como segurar e animações

Baseado em guias de tiro com AK (Crate Club, Shooting Illustrated) e nas animações do CS2:

- **Empunhadura**: mão direita alta no punho, mão de apoio bem à frente no guarda-mão (não no
  carregador). As poses dos braços foram calculadas por IK (CCD) para cada mão alcançar o ponto certo.
- **Tiro**: o porta-ferrolho corre para trás e volta, o estojo sai pela janela da direita e a arma recua.
- **Recarga ("rock and lock")**: a arma inclina, a mão de apoio vai ao carregador, o polegar aperta o
  retém atrás dele, o carregador balança para a frente e sai; o novo entra enganchando a frente e é
  "balançado" para trás até travar.
- **Recarga com pente vazio**: o AK não trava o ferrolho aberto, então depois de trocar o carregador
  a mão de apoio passa por cima da caixa da culatra e puxa a alavanca de manejo (lado direito).
- **Inspecionar (F)** e **sacar a arma** (na primeira vez que o jogo começa), como no CS2.

Poses e trilhas de animação ficam em `models/ak_viewmodel.json`, usado pelas duas versões (C# e web).

### Decorações

O saguão atrás das baias tem objetos ligados a tiro e armas, todos de domínio público (CC0), achados no
GitHub no espelho [Papyszoo/CC0-Public-Domain-Models](https://github.com/Papyszoo/CC0-Public-Domain-Models):

- **Poly Haven** (modelos realistas): caixa de munição ("200 cartridges 7.62 mm"), pistolas com
  carregadores, binóculo, granadas de cabo, lanterna de sinalização, caixa de primeiros socorros, caixa e
  baú de ferramentas, galões, extintor, caixotes militares, estante de aço e prateleira de metal.
- **Quaternius** (Ultimate Gun Pack): submetralhadora exposta na estante.
- O fuzil de ferrolho e uma das pistolas da Poly Haven, e a pistola e a espingarda da Quaternius,
  viraram armas de verdade na bancada.

Onde ficam:

- **Balcão da parede do fundo**: à esquerda, a bancada com as armas trocáveis (ver "Armas"); no resto,
  caixas de munição empilhadas, binóculos, granadas, lanterna, caixa de primeiros socorros e caixa de ferramentas.
- **Embaixo do balcão (no chão)**: caixotes militares empilhados no canto, baú de ferramentas,
  galões e o extintor ao lado da porta.
- **Estante de aço** (parede da direita) e **prateleira de metal** (parede da esquerda), com munição,
  armas e equipamentos nas tábuas.
- **Balcão de cada baia**: uma caixa de munição ao lado.

Tudo fica em `models/decor.glb`, montado pelo `tools/decor-build.py` no Blender: importa cada modelo,
ajusta a escala para cm, reduz para no máximo 6000 triângulos e texturas de 512 px (só a cor base) e
coloca cada objeto na posição. Para mudar algo de lugar, edite a lista `PLACEMENTS` do script e rode
`blender -b -P tools/decor-build.py -- <pasta com os .glb originais> models/decor.glb`.
As decorações têm colisão: o jogador esbarra nelas e os tiros deixam marca.

## Versão web

A pasta `web/` tem o mesmo jogo em JavaScript (three.js), publicado como Artifact:
https://claude.ai/artifact/E6bcqKj5akxTfG5bdfCJ9N

- `web/index.html` e `web/game.js`: página e jogo (mesma mecânica da versão em C#)
- `web/assets/`: cenário compactado (`scene.bin.txt` + `scene.json`, gerados por
  `web/tools/export-scene.mjs`), texturas em 1024 px e os modelos dos braços, das armas e das
  decorações (`decor.glb.txt`).
  Os binários ficam em base64 dentro de `.txt` porque o Artifact só serve tipos conhecidos.

Para testar localmente: `cd web && python3 -m http.server` e abra http://localhost:8000.

## Bibliotecas

- [Silk.NET](https://github.com/dotnet/Silk.NET): janela, OpenGL, teclado e mouse
- Silk.NET.Assimp: leitura do arquivo FBX
- [StbImageSharp](https://github.com/StbSharp/StbImageSharp): leitura das imagens (jpg/png)

## Estrutura

- `Program.cs`: janela, controles, tiros, pontuação, desenho e HUD
- `Player.cs`: movimento estilo Source (atrito, aceleração, pulo, agachar)
- `Weapon.cs`: mecânica das armas (cadência, imprecisão, recuo, recarga, inspeção, ação manual,
  chumbos, recarga cartucho por cartucho)
- `ViewmodelRig.cs`: lê o JSON de cada arma (números, poses e animações) e interpola as animações
- `Targets.cs`: alvos móveis e pontuação por região do papel
- `Booths.cs`: baias com pontuação (1, 4, 6 e 9) e o registro de cada passagem
- `Upgrades.cs`: créditos, níveis e efeitos das melhorias, e o progresso salvo
- `Effects.cs`: furos de bala, estojos ejetados e clarão do disparo
- `Hud.cs`: texto e barras na tela (fonte bitmap própria)
- `SceneModel.cs`: carrega o FBX, as texturas e envia tudo para a GPU
- `CollisionWorld.cs`: colisão por raycast contra os triângulos do cenário
- `models/shooting_range.fbx`: o cenário
- `models/akm.glb`: o fuzil, em peças (body, mag, bolt, magrelease, selector)
- `models/ak_viewmodel.json`: números do AK, posição da arma e dos braços, poses e animações
- `models/fiveseven.glb` e `models/fiveseven_viewmodel.json`: a pistola, em peças, e o JSON dela
- `models/p38.glb`, `models/m1911.glb`, `models/mosin.glb`, `models/shotgun.glb` e os JSONs delas: as
  armas da bancada (gerados por `tools/bench-guns.py`)
- `models/decor.glb`: decorações já posicionadas (ver "Decorações"; gerado por `tools/decor-build.py`)
- `models/arms.fbx`: braços em primeira pessoa (desenhados por cima da cena, estilo CS);
  a textura deles é `models/tex/armColor.png` (manga camuflada, punho e luva)
- `models/tex/`: texturas. Cada material procura aqui um arquivo com o mesmo
  nome (`.jpg`, `.jpeg` ou `.png`, ex.: `Floor 01_C.jpeg`); se não achar, usa a
  textura embutida no FBX. Para trocar uma textura, basta substituir o arquivo.
