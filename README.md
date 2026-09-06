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
| `M` | Alterna câmbio automático / manual |
| `E` | Sobe a marcha (no manual) |
| `Q` | Reduz a marcha (no manual) |
| `R` | Reinicia a corrida após o fim de jogo |

## Visual

Renderização em three.js com materiais PBR, tone mapping ACES, sombras do sol,
mapa de ambiente para os reflexos dos metais e névoa atmosférica no horizonte.

- **Cockpit detalhado**: tanque azul com faixas e tampa de combustível parafusada,
  guidão tubular com mesa e presilhas, manetes de freio e embreagem, punhos com
  nervuras, comandos com botões, cabos, ignição com chave, garfo cromado, disco de
  freio com pinça, paralama, farol — além dos braços do piloto com luvas nos punhos.
- **Retrovisores de verdade**: cada espelho tem vidro elíptico encaixado na carcaça,
  câmera própria e mostra ao vivo o piloto (capacete, ombros e jaqueta) e a pista atrás.
- **Painel digital** desenhado a cada quadro: velocímetro em km/h, barra de giro com
  zona vermelha, marcha e modo do câmbio, nível de combustível, hodômetro e
  temperatura do motor.
- **Asfalto** com agregado, remendos, trincas, marcas de pneu nas trilhas de rodagem,
  faixas contínuas nas bordas e tracejadas entre as três faixas, mais acostamento e
  talude de terra.
- **Cenário** com defensas metálicas de perfil W e postes, árvores variadas, moitas,
  tufos de capim com flores, colinas, postes de iluminação, céu com nuvens e a
  silhueta de uma cidade no horizonte.
- **Trânsito** com sedãs, SUVs, vans, caminhões e motos — carrocerias arredondadas,
  vidros, faróis, lanternas e rodas que giram conforme a velocidade.
- **Trânsito que ultrapassa**: cada veículo tem uma velocidade desejada, acompanha
  quem está à frente, troca de faixa para ultrapassar quando há espaço (sem cortar
  o jogador) e volta para a direita quando a faixa libera.

## O que o jogo tem

- **Visão em primeira pessoa** com câmera dinâmica: ela acompanha o movimento da
  moto, inclina para a esquerda e para a direita junto com a pilotagem e ainda
  reage à curvatura da pista, à velocidade (campo de visão) e ao balanço do motor.
- **Pilotagem com curva de verdade**: a moto ganha ângulo em relação à pista e o
  deslocamento vem desse ângulo, em vez de andar de lado. Parada, a moto não vira.
- **Câmbio de 6 marchas, automático por padrão**: sobe e reduz sozinho conforme o
  giro (inclusive reduzindo até a 1ª ao frear). A tecla `M` passa para o manual,
  com `Q`/`E` — e no manual **não há limitador**: a moto continua ganhando
  velocidade sem teto. O HUD mostra a marcha, o modo, a barra de giro e o aviso
  "Reduza a marcha".
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
- Parado, basta apertar **W** para a moto arrancar de novo (a 1ª marcha tem ajuda
  de embreagem na saída).
- Sair do asfalto faz a moto perder velocidade (não conta como batida).
- Os veículos são sólidos: a moto é bloqueada por eles em vez de atravessá-los.

## Estrutura

```
index.html            jogo completo (HTML + CSS + JavaScript)
vendor/three.min.js   biblioteca three.js r128 (MIT)
```
