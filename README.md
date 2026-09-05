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
| `A` | Faz a curva para a esquerda |
| `D` | Faz a curva para a direita |
| `E` | Sobe a marcha |
| `Q` | Reduz a marcha |
| `R` | Reinicia a corrida após o fim de jogo |

## O que o jogo tem

- **Visão em primeira pessoa** com câmera dinâmica: ela acompanha o movimento da
  moto, inclina para a esquerda e para a direita junto com a pilotagem e ainda
  reage à curvatura da pista, à velocidade (campo de visão) e ao balanço do motor.
- **Pilotagem com curva de verdade**: a moto ganha ângulo em relação à pista e o
  deslocamento vem desse ângulo, em vez de andar de lado. Parada, a moto não vira.
- **Câmbio de 6 marchas** com giro, limitador e freio-motor: cada marcha tem sua
  velocidade máxima, o torque cai fora da faixa de giro e a redução é recusada
  quando o giro está alto demais. O HUD mostra a marcha, a barra de giro e o
  aviso "Reduza a marcha".
- **Rodovia infinita de três faixas**, gerada proceduralmente com trechos retos,
  curvas abertas, curvas fechadas e desvios em "S". Não existe linha de chegada.
- **Trânsito** com carros, caminhões e outras motos ocupando as três faixas em
  velocidades diferentes, para o jogador ultrapassar trocando de faixa.
- **Cones de obra** que bloqueiam uma faixa de tempos em tempos e obrigam o desvio.
- **Sistema de colisão**: cada batida é contada. São permitidas duas batidas; na
  terceira, a corrida termina.
- **HUD no topo da tela** com distância percorrida (km), tempo da corrida,
  velocidade atual em km/h e o contador de batidas.
- **Cenário de rodovia**: defensas metálicas dos dois lados, campo com árvores e
  moitas, postes de iluminação, céu com nuvens e a silhueta de uma cidade no horizonte.
- Sair do asfalto faz a moto perder velocidade (não conta como batida).
- Os veículos são sólidos: a moto é bloqueada por eles em vez de atravessá-los.

## Estrutura

```
index.html            jogo completo (HTML + CSS + JavaScript)
vendor/three.min.js   biblioteca three.js r128 (MIT)
```
