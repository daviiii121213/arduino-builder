# Arduino Builder — A Aventura do Bitinho

Jogo de plataforma 2D feito em **Python + Pygame**. O herói é o Bitinho, um robozinho feito de um Arduino Uno.
Nenhum arquivo externo é usado: todos os gráficos e sons são gerados por código.

## Como rodar

```bash
pip install pygame
python main.py
```

## Controles

| Ação | Teclas |
|---|---|
| Andar | Setas / A D |
| Pular (segure para ir mais alto) | Espaço / Z |
| Atirar solda | J / X (segure ↑ para mirar para cima) |
| Dash (upgrade) | K / C / Shift |
| Interagir | E / ↓ |
| Serial Monitor | Tab |
| Pausa | Esc / P |
| Tela cheia | F11 |

## O que tem no jogo

- 13 fases em 4 mundos: Bancada do Maker, Vale da Protoboard, Cidade Placa-Mãe e Nuvem IoT
- 3 chefes: Curto-Circuito, Cavalo de Troia e Bootloader Sombrio
- 7 tipos de inimigos: bugs, glitches, torretas Tesla, capacitores saltadores, drones, vírus e fios desencapados
- Puzzle de circuitos: gire os fios para levar os 5V até os LEDs; LED sem resistor queima!
- Quiz sobre Arduino com 22 perguntas
- Loja do Maker com 7 upgrades (pulo duplo, dash, garra jacaré, escudo...)
- 18 conquistas, ranks S/A/B/C, componentes secretos e save automático
- Música chiptune e efeitos sonoros sintetizados na hora

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `main.py` | Loop principal e troca de cenas |
| `jogo.py` | Cena de gameplay |
| `jogador.py` | Física e habilidades do Bitinho |
| `inimigos.py` / `chefes.py` | Inimigos, chefes e ataques |
| `itens.py` | Coletáveis e objetos do cenário |
| `mundo.py` | Tiles, colisão e fundos com parallax |
| `niveis.py` | Fases montadas com blocos ASCII |
| `puzzle.py` | Puzzle de circuito e quiz |
| `telas.py` | Menus, mapa, loja, créditos |
| `hud.py` | HUD, Serial Monitor e diálogos |
| `sprites.py` / `audio.py` / `particulas.py` | Gráficos, som e efeitos procedurais |
| `save.py` / `textos.py` / `config.py` / `util.py` | Save, textos, constantes e utilitários |
