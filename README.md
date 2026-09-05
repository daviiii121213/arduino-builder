# Moto Infinita 3D — Rodovia Sem Fim

Jogo 3D de moto em **primeira pessoa**, jogado direto no navegador. Todo o jogo
(HUD, mensagens e instruções) está em **português do Brasil**.

## Como jogar

Abra o arquivo `index.html` no navegador (basta clicar duas vezes — a biblioteca
three.js está incluída na pasta `vendor/`, então funciona sem internet) e
pressione **ENTER** para começar.

| Tecla | Ação |
| ----- | ---- |
| `W` | Acelera a moto |
| `ESPAÇO` | Freia / desacelera (**nunca dá ré**) |
| `A` | Move a moto para a esquerda |
| `D` | Move a moto para a direita |
| `R` | Reinicia a corrida após o fim de jogo |

## O que o jogo tem

- **Visão em primeira pessoa** com câmera dinâmica: ela acompanha o movimento da
  moto, inclina para a esquerda e para a direita junto com a pilotagem e ainda
  reage à curvatura da pista, à velocidade (campo de visão) e ao balanço do motor.
- **Rodovia infinita de três faixas**, gerada proceduralmente com trechos retos,
  curvas abertas, curvas fechadas e desvios em "S". Não existe linha de chegada.
- **Trânsito** com carros, caminhões e outras motos ocupando as três faixas em
  velocidades diferentes, para o jogador ultrapassar trocando de faixa.
- **Cones de obra** que bloqueiam uma faixa de tempos em tempos e obrigam o desvio.
- **Sistema de colisão**: cada batida é contada. São permitidas duas batidas; na
  terceira, a corrida termina.
- **HUD no topo da tela** com distância percorrida (km), tempo da corrida,
  velocidade atual em km/h e o contador de batidas.
- Sair do asfalto faz a moto perder velocidade (não conta como batida).
- Os veículos são sólidos: a moto é bloqueada por eles em vez de atravessá-los.

## Estrutura

```
index.html            jogo completo (HTML + CSS + JavaScript)
vendor/three.min.js   biblioteca three.js r128 (MIT)
```
