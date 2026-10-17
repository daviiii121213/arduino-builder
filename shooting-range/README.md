# Shooting Range

Cenário 3D (FBX) com movimentação em primeira pessoa usando Three.js.

## Controles

- **W A S D**: mover
- **Mouse**: olhar em volta (clique na tela para capturar o mouse)
- **Shift**: correr
- **Esc**: soltar o mouse

## Como rodar

O navegador não carrega o modelo abrindo o `index.html` direto (`file://`),
então é preciso um servidor local. Dentro desta pasta:

```sh
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Estrutura

- `index.html` / `style.css`: página e tela inicial
- `main.js`: carregamento do modelo, luzes, controles e colisão
- `models/shooting_range.fbx`: o cenário (as texturas já vêm embutidas no FBX)
- `models/tex/`: opcional; texturas que não estiverem embutidas no FBX são
  procuradas aqui pelo nome do arquivo (ex.: `Floor 01_C.jpg`)
