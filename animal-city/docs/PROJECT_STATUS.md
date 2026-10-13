# Status do projeto

Milestone atual: **M1 — protótipo jogável com movimento, câmera, interação, vida e respawn** (fases 1 a 3 do roteiro, com um distrito de teste da fase 4).

Legenda: ✅ implementado e coberto por teste automatizado · 🟡 implementado sem teste automatizado · ⬜ não implementado

## Verificação realizada

- Teste automatizado de jogabilidade (`tests/test_gameplay.gd`, executado headless sobre as cenas reais): **45 verificações aprovadas, 0 falhas** (Godot 4.4.1, Linux, sem renderização).
- Inicialização da cena principal em modo headless: sem erros nem avisos.

## Não verificado

- Aparência visual, iluminação e sombras (o modo headless não renderiza).
- Desempenho em hardware-alvo (notebook Intel Core i3-1005G1, gráficos integrados): **nenhuma medição feita**. Não há números de FPS, memória ou tempo de carregamento.
- Entrada real de mouse (captura, rotação da câmera com movimento de mouse). Os testes injetam ações de teclado, não eventos de mouse.
- Janela perdendo o foco (o jogo não pausa automaticamente).

## Sistemas

| Sistema | Estado | Observações |
| --- | --- | --- |
| Projeto Godot e configuração | ✅ | Renderizador *Mobile*, interpolação de física, ações de entrada em `project.godot` |
| Menu principal (Jogar, Configurações, Sair) | ✅ | Erro informativo se a cena do mundo não carregar |
| Configurações | ✅ | Sensibilidade do mouse (aplicada na câmera) e qualidade das sombras (atlas 1024/2048/4096). Salvas em `user://settings.cfg` |
| Menu de pausa (Esc) | ✅ | Continuar, voltar ao menu, sair; volta ao menu sem deixar estado inválido |
| Movimento: andar, correr, pular, gravidade, colisão | ✅ | Andar 4 m/s, correr 7 m/s, pulo de ~1,2 m; pulo só do chão; buffer de 0,12 s |
| Estados do personagem | ✅ | IDLE, WALKING, RUNNING, JUMPING, FALLING, INTERACTING, DEFEATED (sinal `state_changed`) |
| Câmera de terceira pessoa | ✅ | Colisão por SpringArm3D; inclinação limitada |
| Câmera de primeira pessoa (V) | ✅ | Modelo oculto; volta à terceira pessoa corretamente |
| Olhar com o mouse | 🟡 | Implementado; não testado com mouse real |
| Interação (alcance, cone de visão, linha de visão) | ✅ | Alcance 2,2 m; cone de ±66°; bloqueado por paredes |
| Prompt de interação | ✅ | Mostra a tecla atual pelo InputMap |
| Coleta de itens e moedas | ✅ | Coletados não reaparecem após respawn |
| Segredo escondido | ✅ | Beco cercado; R$ 50 |
| Inventário simples | ✅ | 8 espaços, limite de empilhamento por item (`ItemCatalog`). Sem uso de itens além da chave |
| Porta/portão com trava | ✅ | Trancado até ter a chave; animação de rotação |
| Dinheiro | ✅ | Ganho por moedas; não há gasto (não há loja) |
| Vida, barra no HUD | ✅ | 100 pontos |
| Dano por perigo | ✅ | Vidro quebrado, 15 por segundo |
| Ponto de controle e respawn | ✅ | Salvo ao entrar na área; respawn 2 s após a derrota, com vida cheia e velocidade zerada; sem respawn duplicado |
| Relógio e ciclo dia/noite | ✅ | Um dia dura 24 minutos reais; sol e luz ambiente mudam |
| Clima visual | ⬜ | Planejado |
| Distrito de teste | ✅ | Ruas, calçadas, 7 volumes de prédios, cercas, caixas, barreira, postes |
| Geração procedural da cidade | ⬜ | Planejado; o distrito atual é montado à mão a partir de dados de layout |
| Streaming de chunks | ⬜ | Planejado |
| HUD com inventário e dinheiro | ✅ | Minimalista |
| Textos em pt-BR | ✅ | Strings escritas diretamente no código; não centralizadas |
| Áudio | ⬜ | Nenhum som; trilha original planejada |
| Diálogo de NPC, tarefas, missões | ⬜ | Fase 5 |
| Animais hostis, ataque, combate | ⬜ | Fase 5 |
| Chefes, aliados com IA | ⬜ | Futuro |
| Veículos, combustível, dano de veículo | ⬜ | Futuro |
| Salvamento em disco (progresso entre sessões) | ⬜ | Só o estado em memória durante a sessão; o ponto de controle não é salvo em arquivo |
| Configurações de textura e volume | ⬜ | Não implementadas porque ainda não alteram nada em tempo de execução |
| Espécies jogáveis além do animal de teste | ⬜ | A arquitetura permite; nenhuma outra espécie existe |

## Problemas conhecidos

- O personagem não sobe degraus: as calçadas estão no mesmo nível da rua. Um meio-fio alto bloqueia o movimento.
- A câmera de primeira pessoa pode atravessar paredes quando o personagem encosta nelas, pois não tem colisão própria.
- Interações ficam bloqueadas por 0,25 s depois de cada uso (`interaction_lock_time`), para evitar disparos repetidos.
- A interface é criada por código (`ui/*.gd`), não por cenas `.tscn`. É uma escolha temporária para acelerar o protótipo.

## Próximo marco recomendado

Ver [ROADMAP.md](ROADMAP.md): primeiro validar aparência e desempenho no hardware-alvo, depois começar a fase 5 (NPC com diálogo e uma tarefa, e um animal hostil simples).
