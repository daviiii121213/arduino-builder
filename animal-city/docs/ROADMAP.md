# Roteiro

Cada marco só começa quando o anterior passa nos critérios de aceite. Os itens marcados ✅ em [PROJECT_STATUS.md](PROJECT_STATUS.md) já foram verificados por teste automatizado.

## M1 — Protótipo jogável (atual)

Critérios de aceite:

- [x] O jogo abre na cena principal sem erros (headless).
- [x] O jogador anda, corre e pula; pulo não se repete no ar.
- [x] Colisão com chão e obstáculos; o personagem não atravessa o chão.
- [x] Câmera de terceira pessoa segue o personagem; V alterna para primeira pessoa e volta.
- [x] Interação com objetos próximos, com prompt; alcance e linha de visão limitados.
- [x] Coleta de itens; um objeto coletado não reaparece após respawn.
- [x] Vida no HUD; dano por perigo; respawn no ponto de controle com vida cheia.
- [x] Menu principal e pausa funcionam; voltar ao menu permite nova partida.
- [ ] Mouse real: captura, rotação e liberação do cursor verificadas manualmente.
- [ ] Desempenho medido no notebook-alvo (sem medição ainda).

## M2 — Validação visual e de desempenho

- Revisar a iluminação diurna e noturna em tela; ajustar sombras e exposição.
- Medir tempo de quadro no notebook-alvo nas três qualidades de sombra; registrar resultados em `PROJECT_STATUS.md`.
- Corrigir a câmera de primeira pessoa perto de paredes.
- Permitir subir pequenos degraus (ou manter o nível das calçadas e documentar a regra).

## M3 — Fase 5: NPC e combate básico

- Cena de NPC animal com diálogo em texto e duas escolhas em um teste de conversa.
- Uma tarefa oferecida pelo NPC, com estado (não iniciada, em andamento, concluída) e recompensa em dinheiro.
- Animal hostil simples: detecta o jogador por alcance, ataca com cooldown, recebe dano e volta ao estado de patrulha.
- Gastar dinheiro (um item ou uma loja mínima) só depois que o inventário estiver estável.

## M4 — Mundo

- Relógio já existe; adicionar clima visual (chuva ou neblina leve) somente se o desempenho permitir.
- Centralizar textos em um arquivo de localização pt-BR.
- Configurações de textura e volume, somente quando realmente alterarem algo.
- Salvamento em disco do progresso (dinheiro, inventário, coletados, ponto de controle), com validação ao carregar.

## M5 — Expansão

- Geração procedural da cidade a partir de módulos reutilizáveis (ruas, cruzamentos, prédios) com semente determinística.
- Streaming de chunks: carregar e liberar setores perto do jogador.
- Interiores acessíveis, em pequeno número.
- Espécies adicionais com parâmetros de movimento próprios.
- Parkour, natação e veículos, nessa ordem de dependência.

Os itens do M5 dependem de M1 a M4 estarem estáveis.
