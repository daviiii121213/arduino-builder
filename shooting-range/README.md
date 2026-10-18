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
- **Esc**: soltar o mouse

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

### Arma: AKM (AK-47)

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

## Versão web

A pasta `web/` tem o mesmo jogo em JavaScript (three.js), publicado como Artifact:
https://claude.ai/artifact/E6bcqKj5akxTfG5bdfCJ9N

- `web/index.html` e `web/game.js`: página e jogo (mesma mecânica da versão em C#)
- `web/assets/`: cenário compactado (`scene.bin.txt` + `scene.json`, gerados por
  `web/tools/export-scene.mjs`), texturas em 1024 px e os modelos dos braços e da arma.
  Os binários ficam em base64 dentro de `.txt` porque o Artifact só serve tipos conhecidos.

Para testar localmente: `cd web && python3 -m http.server` e abra http://localhost:8000.

## Bibliotecas

- [Silk.NET](https://github.com/dotnet/Silk.NET): janela, OpenGL, teclado e mouse
- Silk.NET.Assimp: leitura do arquivo FBX
- [StbImageSharp](https://github.com/StbSharp/StbImageSharp): leitura das imagens (jpg/png)

## Estrutura

- `Program.cs`: janela, controles, tiros, pontuação, desenho e HUD
- `Player.cs`: movimento estilo Source (atrito, aceleração, pulo, agachar)
- `Weapon.cs`: mecânica do AK (cadência, imprecisão, recuo, recarga, inspeção)
- `ViewmodelRig.cs`: lê `models/ak_viewmodel.json` e interpola poses e animações
- `Targets.cs`: alvos móveis e pontuação por região do papel
- `Booths.cs`: baias com pontuação (1, 4, 6 e 9) e o registro de cada passagem
- `Effects.cs`: furos de bala, estojos ejetados e clarão do disparo
- `Hud.cs`: texto e barras na tela (fonte bitmap própria)
- `SceneModel.cs`: carrega o FBX, as texturas e envia tudo para a GPU
- `CollisionWorld.cs`: colisão por raycast contra os triângulos do cenário
- `models/shooting_range.fbx`: o cenário
- `models/akm.glb`: o fuzil, em peças (body, mag, bolt, magrelease, selector)
- `models/ak_viewmodel.json`: posição da arma e dos braços, poses e animações
- `models/arms.fbx`: braços em primeira pessoa (desenhados por cima da cena, estilo CS);
  a textura deles é `models/tex/armColor.png` (manga camuflada, punho e luva)
- `models/tex/`: texturas. Cada material procura aqui um arquivo com o mesmo
  nome (`.jpg`, `.jpeg` ou `.png`, ex.: `Floor 01_C.jpeg`); se não achar, usa a
  textura embutida no FBX. Para trocar uma textura, basta substituir o arquivo.
