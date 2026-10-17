# Shooting Range

Cenário 3D (FBX) com movimentação em primeira pessoa, feito em C# (.NET 8) com
OpenGL, sem engine.

## Controles

- **W A S D**: mover
- **Mouse**: olhar em volta (clique na janela para capturar o mouse)
- **Botão esquerdo**: atirar
- **Botão direito**: alternar semiautomático / rajada de 3
- **R**: recarregar
- **Espaço**: pular
- **Ctrl**: agachar
- **Shift**: correr
- **Esc**: soltar o mouse

## Jogo

Cada alvo pontua conforme o lugar atingido: centro vermelho (X) = 10, anéis 9, 8 e 7,
o resto da silhueta = 5 e o papel branco = 0. As três miras redondas (cabeça e laterais)
valem 10 / 9 / 8. Quando um alvo é acertado, ele corre no trilho para outra distância.
Os pontos ficam no canto superior direito.

### Mecânica da arma (baseada no CS2)

Valores da Glock-18 no CS2 (fonte: csdb.gg) e padrões da Source:

- 400 disparos por minuto (0,15 s entre tiros), pente de 20, reserva de 120, recarga em 2,17 s
- Imprecisão: parado 0,0056 rad, agachado 0,0042, andando +0,010 (só acima de 34% da
  velocidade máxima, o que permite o "counter-strafe"), no ar +0,15
- Cada tiro soma 0,056 de imprecisão, que cai a 10% em 0,20 s
- Espalhamento do CS: um círculo aleatório da imprecisão somado a um do spread fixo (0,002)
- Recuo ("aim punch") com variação de ±20° na direção; a câmera mostra só 45% do recuo
  (`view_recoil_tracking`), mas a bala usa o recuo inteiro
- Rajada de 3 com 0,05 s entre balas e imprecisão maior
- Balas atravessam vidro
- Movimento da Source: atrito 5,2, aceleração 5,5, controle no ar limitado, gravidade 800,
  pulo de 301,99 u/s; agachado anda a 34% da velocidade

## Como rodar

Precisa do [.NET 8 SDK](https://dotnet.microsoft.com/download). Dentro desta pasta:

```sh
dotnet run -c Release
```

O carregamento do cenário leva alguns segundos (as texturas são grandes).

## Bibliotecas

- [Silk.NET](https://github.com/dotnet/Silk.NET): janela, OpenGL, teclado e mouse
- Silk.NET.Assimp: leitura do arquivo FBX
- [StbImageSharp](https://github.com/StbSharp/StbImageSharp): leitura das imagens (jpg/png)

## Estrutura

- `Program.cs`: janela, controles, tiros, pontuação, desenho e HUD
- `Player.cs`: movimento estilo Source (atrito, aceleração, pulo, agachar)
- `Weapon.cs`: mecânica da Glock (cadência, imprecisão, recuo, rajada, recarga)
- `Targets.cs`: alvos móveis e pontuação por região do papel
- `ArmPose.cs`: pose dos braços segurando a pistola
- `Effects.cs`: furos de bala e clarão do disparo
- `Hud.cs`: texto e barras na tela (fonte bitmap própria)
- `SceneModel.cs`: carrega o FBX, as texturas e envia tudo para a GPU
- `CollisionWorld.cs`: colisão por raycast contra os triângulos do cenário
- `models/shooting_range.fbx`: o cenário
- `models/glock.glb`: a pistola (convertida do STL, simplificada para ~50 mil triângulos)
- `models/arms.fbx`: braços em primeira pessoa (desenhados por cima da cena, estilo CS);
  a textura deles é `models/tex/armColor.png` (manga camuflada, punho e luva)
- `models/tex/`: texturas. Cada material procura aqui um arquivo com o mesmo
  nome (`.jpg`, `.jpeg` ou `.png`, ex.: `Floor 01_C.jpeg`); se não achar, usa a
  textura embutida no FBX. Para trocar uma textura, basta substituir o arquivo.
