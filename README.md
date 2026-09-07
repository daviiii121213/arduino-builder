# Infinyt Cycle

Jogo 3D de moto em **primeira pessoa**, jogado direto no navegador. Todo o jogo
(HUD, mensagens e instruções) está em **português do Brasil**.

## Idioma e dificuldade

Ao abrir, o jogo pergunta o idioma — **Selecione o idioma / Select the language** —
com Português (BR) e English (clique ou teclas 1 e 2). Toda a interface, o painel da
moto e as mensagens seguem a escolha.

Na tela seguinte escolhe-se a dificuldade:

| Nível | Como fica |
| ----- | --------- |
| **Fácil** | O jogo como era: trânsito tranquilo e pista com curvas moderadas. |
| **Médio** | ~47% mais veículos por trecho, frota maior (26 no lugar de 20), muito mais trocas de faixa e ultrapassagens, freadas imprevisíveis do trânsito e pista com ~40% mais curvatura. |

## No celular

O jogo é responsivo e ganha controles de toque automaticamente em telas sensíveis:

- **Analógico** no canto inferior esquerdo: para os lados faz a curva, para cima
  acelera e para baixo freia.
- **NITRO** e **FREIO** em botões redondos à direita.
- **Botão de som** no alto, à direita.
- Nas telas de idioma, dificuldade e fim de jogo há botões (**Jogar**, **Pilotar
  de novo**) — nada depende do teclado.
- HUD, telas e textos se reorganizam em retrato e paisagem; no celular a
  resolução, as sombras e os retrovisores rodam num modo mais leve.

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
| `SHIFT` | Nitro |
| `S` | Liga / desliga o som |
| `R` | Reinicia a corrida após o fim de jogo |

## Mundo vivo

- **Ciclo de dia e noite completo** (~7 min por volta): madrugada, amanhecer, manhã,
  tarde, pôr do sol e noite. O sol percorre o céu mudando de cor, intensidade e
  direção das sombras; à noite acendem o farol da moto (luz real projetada na
  pista), os faróis e lanternas do trânsito, os postes, as tachas refletivas e
  aparecem as estrelas.
- **Clima dinâmico**: céu limpo, nublado e neblina, alternando sozinhos.
- **Relevo**: a rodovia sobe e desce em rampas longas; pista, defensas, terreno,
  trânsito e moto acompanham a inclinação.
- **Infraestrutura**: placas de velocidade, direção e advertência, tachas refletivas,
  viadutos cruzando a pista, posto de combustível iluminado, outdoors, linhas de
  energia com fios, cercas, celeiros e galpões, montanhas no horizonte.

## Som

Tudo sintetizado na Web Audio API (sem arquivos): motor com giro e carga (o tom
acompanha o RPM da marcha), vento pela velocidade, pneus na pista, guincho de freio,
estouro da batida, blip da troca de marcha e o "whoosh" de cada veículo que passa
perto. A tecla **S** liga e desliga o som.

## Polimento visual

- **Rodas com volume real**: o pneu é torneado (perfil com flanco arredondado, ombro
  e parede interna), o aro fica **dentro** do pneu, com cubo central e face de raios;
  cada classe usa seu tamanho e as geometrias são compartilhadas entre veículos.
- **Rodas dianteiras esterçam**: o eixo da frente do trânsito gira na troca de faixa e
  a moto do jogador tem garfo, roda e paralama num conjunto de direção que acompanha
  o comando — e mergulha na freada.
- **Sombras de contato** sob cada veículo, o semirreboque e a moto, para nada parecer
  flutuando.
- **Regiões de paisagem**: campo aberto, floresta, fazenda, industrial, serra e
  subúrbio se alternam a cada ~1,6 km, mudando quais elementos aparecem e a que
  distância da pista; o espaçamento tem folga aleatória, sem fila perfeita.
- **Vegetação balançando** de leve com o vento.
- **Túnel** a cada 4,2 km: teto e paredes em fitas que acompanham a curva, lâmpadas
  no teto, sol cortado e farol aceso lá dentro.
- **Evento de pista**: veículo parado no acostamento com pisca-alerta ligado.
- **Sensação de velocidade em faixas**: vento a partir de ~80 km/h, campo de visão
  abrindo até 96°, e borrão periférico só acima de ~173 km/h — o centro da tela
  continua limpo.

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
- **Frota com dez silhuetas distintas**: compacto (hatch curto), sedã (três volumes),
  SUV (alto, com longarinas), picape (cabine + caçamba de paredes e tampa), van
  (teto alto e porta corrediça), ônibus rodoviário (bagageiro, janelas panorâmicas,
  rodado duplo), caminhão (cabine avançada e baú com ripas), carreta (cavalo
  mecânico + semirreboque articulado), moto do trânsito (esportiva carenada) e a
  moto do jogador. Todos com paralamas, vidros, faróis e lanternas em par, luz de
  freio, piscas, retrovisores, vincos de porta, placa e rodas que giram.
- **Comportamento por classe**: cada categoria tem faixa de velocidade, aceleração,
  frenagem e agilidade de troca de faixa próprias — pesados demoram a ganhar e a
  perder velocidade e mudam de faixa devagar; motos aceleram e circulam mais rápido.
  A carroceria mergulha ao frear e senta ao acelerar, e o semirreboque articula
  atrás do cavalo nas curvas.
- **LOD**: peças miúdas (retrovisores, vincos, placas, frisos) desligam nos veículos
  distantes, segurando o custo de render em ~1,1 mil draw calls.
- **Trânsito que ultrapassa**: cada veículo tem uma velocidade desejada, acompanha
  quem está à frente, troca de faixa para ultrapassar quando há espaço (sem cortar
  o jogador) e volta para a direita quando a faixa libera.

## Sensação de velocidade

Campo de visão que abre com a velocidade, rastros de vento passando ao lado, borrão
suave só na periferia da tela, vibração do motor na câmera, reação a acelerar e
frear e tremor na batida.

## O que o jogo tem

- **Visão em primeira pessoa** com câmera dinâmica: ela acompanha o movimento da
  moto, inclina para a esquerda e para a direita junto com a pilotagem e ainda
  reage à curvatura da pista, à velocidade (campo de visão) e ao balanço do motor.
- **Pilotagem com curva de verdade**: a moto ganha ângulo em relação à pista e o
  deslocamento vem desse ângulo, em vez de andar de lado. Parada, a moto não vira.
  A inclinação vem só do comando do jogador — não há inclinação automática nas curvas.
- **Câmbio automático de 6 marchas**: sobe e reduz sozinho conforme o giro
  (inclusive reduzindo até a 1ª ao frear).
- **Nitro** (`SHIFT` ou o botão no celular): passa do limitador e chega a
  270 km/h. O tanque gasta em ~3,5 s de uso e recarrega sozinho — mais devagar
  se você continuar acelerando. Tem barra no HUD e no painel da moto, além de
  som e empurrão na câmera.
- **Rodovia infinita de três faixas**, gerada proceduralmente com trechos retos,
  curvas abertas, curvas fechadas e desvios em "S". Não existe linha de chegada.
- **Trânsito** com carros, caminhões e outras motos ocupando as três faixas em
  velocidades diferentes, para o jogador ultrapassar trocando de faixa.
- **Cones de obra** que bloqueiam uma faixa de tempos em tempos e obrigam o desvio.
- **Sistema de colisão**: cada batida é contada. São permitidas duas batidas; na
  terceira, a corrida termina.
- **HUD no topo da tela** com distância percorrida (km), tempo da corrida,
  velocidade em km/h (com transição suave), marcha e modo do câmbio, contador de
  batidas, além da faixa com horário, fase do dia e clima. Avisa quando você está
  fechando em cima de um veículo e quando alguém se aproxima por trás.
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
