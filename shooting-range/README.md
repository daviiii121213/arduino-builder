# Shooting Range

Cenário 3D (FBX) com movimentação em primeira pessoa, feito em C# (.NET 8) com
OpenGL, sem engine.

## Controles

- **W A S D**: mover
- **Mouse**: olhar em volta (clique na janela para capturar o mouse)
- **Shift**: correr
- **Esc**: soltar o mouse

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

- `Program.cs`: janela, câmera, controles, movimentação e desenho
- `SceneModel.cs`: carrega o FBX, as texturas e envia tudo para a GPU
- `CollisionWorld.cs`: colisão por raycast contra os triângulos do cenário
- `models/shooting_range.fbx`: o cenário
- `models/arms.fbx`: braços em primeira pessoa (desenhados por cima da cena, estilo CS);
  a textura deles é `models/tex/armColor.png` (manga camuflada, punho e luva)
- `models/tex/`: texturas. Cada material procura aqui um arquivo com o mesmo
  nome (`.jpg`, `.jpeg` ou `.png`, ex.: `Floor 01_C.jpeg`); se não achar, usa a
  textura embutida no FBX. Para trocar uma textura, basta substituir o arquivo.
