# Decisões técnicas

Registro das decisões relevantes, com as alternativas consideradas.

## D1 — Godot 4.4.1 com GDScript

- **Decisão:** Godot 4.4.1 (versão estável oficial), GDScript.
- **Motivo:** o motor e a linguagem foram definidos na especificação. A versão 4.4.1 foi baixada do repositório oficial para testes, fora do projeto.
- **Não feito:** não foi escolhida uma versão mais nova, porque a instalação da 4.4.1 já foi validada.

## D2 — Localização do projeto

- **Decisão:** o projeto fica em `animal-city/`, uma subpasta do repositório.
- **Motivo:** o repositório já tinha um `README.md` não relacionado. Colocar `project.godot` na raiz misturaria os arquivos. O `README.md` da raiz não foi alterado.

## D3 — Renderizador *Mobile*

- **Decisão:** `rendering/renderer/rendering_method = "mobile"`.
- **Motivo:** a especificação prioriza desempenho em gráficos integrados. O *Forward+* usa mais recursos de GPU.
- **Consequência:** efeitos avançados do *Forward+* não estão disponíveis. Aceitável para o protótipo.
- **Não medido:** o desempenho real ainda não foi comparado.

## D4 — Interpolação de física

- **Decisão:** `physics/common/physics_interpolation = true`.
- **Motivo:** reduzir trepidação da câmera e do personagem quando a taxa de quadros é diferente da física (60 Hz).

## D5 — Entradas no InputMap com teclas físicas

- **Decisão:** ações de movimento definidas em `project.godot` com `physical_keycode` (W/A/S/D não dependem do layout do teclado).
- **Motivo:** a especificação pede remapeamento futuro e nenhum atalho fixo no código.

## D6 — Interação por varredura de grupo, não por Area3D

- **Decisão:** `InteractionComponent` percorre o grupo `interactable` a cada quadro físico e filtra por distância, cone de visão e linha de visão.
- **Motivo:** o número de objetos próximos é pequeno. Um `Area3D` por personagem exigiria sincronização de sinais de entrada e saída.
- **Alternativa rejeitada:** `Area3D` de alcance. Revisitar se houver centenas de objetos interativos.

## D7 — Linha de visão até o ponto de interação

- **Decisão:** o raio vai até `get_interaction_point()` de cada objeto, não até a origem do nó.
- **Motivo:** a dobradiça de uma porta encosta em um poste; o raio da origem ficava bloqueado pelo poste, e a porta não era detectada.

## D8 — Respawn e estado persistente

- **Decisão:** `PlayerState` guarda dinheiro, inventário e a lista de coletados. A vida e a posição ficam no personagem.
- **Motivo:** a especificação exige que coletados não voltem após respawn. A vida deve ser reposta a cada respawn.
- **Limite:** o estado não é gravado em disco; fecha-se com o jogo.

## D9 — Geometria do distrito gerada em tempo de execução

- **Decisão:** `TestDistrictLayout` (dados) e `TestDistrictBuilder` (construção). O distrito não é salvo como dezenas de sub-recursos `.tscn`.
- **Motivo:** separar dados de layout da renderização, como a especificação pede, e facilitar a geração procedural futura.
- **Custo:** o layout não aparece no editor de cenas; é preciso abrir o script para alterá-lo.

## D10 — Interface criada por código

- **Decisão:** HUD, menu principal e menu de pausa são construídos por código.
- **Motivo:** velocidade de desenvolvimento durante o protótipo, sem arquivos `.tscn` extras.
- **Revisar:** migrar para cenas quando a interface tiver arte final.

## D11 — Testes como cena

- **Decisão:** `tests/test_runner.tscn` executa `tests/test_gameplay.gd`.
- **Motivo:** com `godot -s`, os autoloads (`Settings`, `PlayerState`) não existem na compilação dos scripts do jogo, e a execução falha.

## D12 — Sombras por tamanho de atlas

- **Decisão:** qualidade de sombras controla o tamanho do atlas direcional (1024, 2048, 4096) via `RenderingServer`.
- **Motivo:** `Viewport` não expõe uma propriedade de tamanho de sombra direcional no Godot 4.4.1.
- **Limite:** a API não permite ler o valor de volta. O teste verifica o valor aplicado pelo próprio código, não o estado da GPU.

## D13 — Sem áudio

- **Decisão:** nenhum som foi adicionado.
- **Motivo:** a especificação exige que sons tenham licença verificada e que não sejam inventados. Nenhum arquivo foi escolhido.

## D14 — Modelo do animal primitivo

- **Decisão:** o animal é um conjunto de caixas, uma esfera e um cilindro, com colisão de cápsula.
- **Motivo:** a especificação permite um substituto temporário identificado, sem modelo com licença verificada.
- **Substituição:** trocar o nó `Visual` por uma cena importada; a colisão e o controlador não mudam.

## D15 — Sem degraus automáticos

- **Decisão:** calçadas no mesmo nível da rua; o personagem não sobe pequenos degraus.
- **Motivo:** o `CharacterBody3D` do Godot não tem subida automática de degraus. Implementar uma solução própria agora não compensa.
- **Revisar:** no M2.
