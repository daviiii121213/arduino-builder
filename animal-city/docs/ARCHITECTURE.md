# Arquitetura

## Visão geral

O jogo é uma cena principal (`main/main.tscn`) que controla o fluxo entre menu, partida e pausa. A partida é a cena `world/test_city.tscn`, que contém o personagem, a iluminação e os objetos do mundo. O HUD e o menu de pausa são criados pelo fluxo principal e removidos quando a partida termina.

```
main/main.tscn  (Main: fluxo menu → jogo → pausa)
├── MainMenu        (criado por código)
├── TestCity        world/test_city.tscn
│   ├── Geometry    (blocos gerados de TestDistrictLayout)
│   ├── Sun, WorldEnvironment, DayNight
│   ├── Player      characters/player_animal.tscn
│   ├── Interactables  (PickupItem, Door)
│   ├── Checkpoints (Checkpoint)
│   └── Hazards     (HazardZone)
├── GameHud         (criado por código)
└── PauseMenu       (criado por código)
```

## Autoloads

| Nome | Arquivo | Responsabilidade |
| --- | --- | --- |
| `Settings` | `core/settings.gd` | Configurações persistidas; emite `changed` ao alterar |
| `PlayerState` | `core/player_state.gd` | Dinheiro, inventário e lista de coletados; sobrevive a respawns. Emite `changed` e `notice_posted` (mensagens para o HUD) |

Os autoloads são usados só para esses dois serviços globais. A vida, a posição e o estado do personagem pertencem ao personagem.

## Personagem

- `PlayerController` (`characters/player_controller.gd`): `CharacterBody3D`. Faz movimento, pulo, gravidade, estado e morte/respawn. Lê entrada apenas pelas ações do InputMap.
- `HealthComponent`: vida reutilizável. Emite `health_changed` e `died` uma vez por morte.
- `CameraController` (`CameraRig`): controla terceira e primeira pessoa com `mode` explícito. Fica em `top_level` para não girar com o corpo.
- `InteractionComponent`: escolhe o alvo mais próximo (alcance, cone de visão e linha de visão) e chama `interact()`.

Comunicação: o personagem emite `defeated`, `respawned` e `state_changed`; a câmera emite `mode_changed`; o HUD se conecta a esses sinais em `bind()`.

## Interação

`Interactable` (`StaticBody3D`) é a base. Ela entra no grupo `interactable` e define:

- `can_interact(actor)`, `get_prompt(actor)`, `get_interaction_point()` e `interact(actor)`.

Subclasses atuais:

- `PickupItem`: item e/ou dinheiro. Registra `pickup_id` em `PlayerState` para não reaparecer.
- `Door`: rotação animada com `Tween`; pode exigir um item para destravar.

Para um objeto novo, basta herdar de `Interactable` e sobrescrever os métodos. Nenhum código do personagem precisa mudar.

## Mundo

- `TestDistrictLayout` contém só dados (posições, tamanhos e materiais). Não cria nós.
- `TestDistrictBuilder` converte esses dados em malhas e colisões em tempo de execução.
- `DayNightController` recebe o sol e o ambiente de `TestCity` em `setup()`; não depende de caminhos de nós.
- `Checkpoint` e `HazardZone` são cenas `Area3D` reutilizáveis.

## Ciclo de vida de uma partida

1. `Main.start_new_game()` chama `PlayerState.reset()` e instancia `TestCity`.
2. O HUD é vinculado ao personagem e ao relógio com `bind()`.
3. Esc pausa (`get_tree().paused`); o menu de pausa e o fluxo principal continuam processando (`PROCESS_MODE_ALWAYS`), e o mundo usa `PROCESS_MODE_PAUSABLE`.
4. "Voltar ao menu" despausa e libera o mundo, o HUD e o menu de pausa.

## Testes

`tests/test_gameplay.gd` roda como cena (`tests/test_runner.tscn`), não com `-s`. Motivo: scripts carregados com `-s` não enxergam os autoloads na compilação. O teste injeta `InputEventAction` e verifica o estado do jogo.

## Convenções

- Arquivos e funções em `snake_case`; classes em `PascalCase`; ações de entrada em `snake_case`.
- Textos de interface em português do Brasil.
- Comentários explicam decisões não óbvias; não repetem o código.
