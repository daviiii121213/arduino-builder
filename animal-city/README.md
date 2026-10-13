# Animal City (título provisório)

Protótipo jogável em 3D de exploração de animais numa cidade moderna, feito em **Godot 4.4.1** com **GDScript**.
O projeto está nesta pasta (`animal-city/`) dentro do repositório; o restante do repositório não foi alterado.

Status detalhado: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) · Arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Roteiro: [docs/ROADMAP.md](docs/ROADMAP.md) · Decisões: [docs/TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md)

## Requisitos

- Godot **4.4.1** (ou 4.4.x compatível). Não é necessário nenhum plugin nem download na inicialização.
- Windows, Linux ou macOS. O alvo inicial é PC com hardware modesto (renderizador *Mobile*).

## Como abrir e executar

Pelo editor: abra o Godot, escolha *Importar* e selecione `animal-city/project.godot`; depois aperte **F5**.

Pela linha de comando:

```bash
godot --path animal-city            # executa o jogo
godot --headless --path animal-city --import   # importa recursos (primeira vez)
godot --headless --path animal-city res://tests/test_runner.tscn   # testes de jogabilidade
```

## Controles

| Ação | Tecla |
| --- | --- |
| Andar | W A S D |
| Correr | Shift (segurando, com movimento) |
| Pular | Espaço |
| Interagir | E |
| Alternar câmera (terceira / primeira pessoa) | V |
| Olhar ao redor | Mouse (capturado durante o jogo) |
| Pausar / retomar | Esc |

As teclas estão definidas em `project.godot` (seção `[input]`) como ações do InputMap, então podem ser remapeadas no editor.

## O que existe no protótipo

- Menu principal: **Jogar**, **Configurações** (sensibilidade do mouse e qualidade das sombras) e **Sair**.
- Menu de pausa: **Continuar**, **Voltar ao menu** e **Sair do jogo**.
- Animal de teste com movimento, pulo, gravidade e colisão; estados explícitos (parado, andando, correndo, pulando, caindo, interagindo, derrotado).
- Câmera de terceira pessoa com colisão contra paredes e câmera de primeira pessoa, alternadas com V.
- Interação com objetos próximos: chave, moedas, osso, segredo escondido e portão trancado.
- Vida com barra no HUD, perigo (vidro quebrado) e respawn no último ponto de controle.
- Relógio do jogo com ciclo visual de dia e noite.
- Distrito de teste pequeno com ruas, calçadas, prédios, obstáculos e um beco cercado com segredo.

Lista completa, limitações e o que ainda não existe: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Estrutura

```
main/            fluxo principal (menu → jogo → pausa)
core/            serviços globais: Settings (configurações), PlayerState (dinheiro, inventário, coletados), ItemCatalog
characters/      animal jogável, câmera, componente de vida
interactions/    base de interação, componente de alcance, pickups, portas
world/           distrito de teste (layout + construtor), ponto de controle, perigo, ciclo dia/noite
ui/              HUD, menu principal, menu de pausa
tests/           testes headless de jogabilidade
docs/            documentação do projeto
```

## Assets e licenças

Todo o visual é **primitivo e temporário**: caixas, esferas e cilindros coloridos. Não há modelos, texturas ou sons importados.
Nenhum recurso externo foi incluído, portanto não há licenças de terceiros a registrar. O ícone (`icon.svg`) foi criado para este projeto.

## Limitações conhecidas

- Não há áudio: nenhum som foi adicionado porque ainda não há arquivos com licença verificada.
- Os testes rodam sem renderização (modo headless). Aparência, desempenho e comportamento com mouse real ainda não foram verificados.
- Ver a lista completa em [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).
