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
- **Botão de som** no alto, à direita, e ao lado dele o **botão de interface**, que
  troca o analógico por um teclado de setas (◀ ▶ para as curvas, ▲ acelera,
  ▼ freia) e aumenta os botões de NITRO e FREIO. Dá para alternar a qualquer
  momento, inclusive no meio da corrida.
- **Tocar na dificuldade já começa a corrida** — no celular não existe um segundo
  botão para confirmar. No computador o clique só seleciona, e o **Jogar** (ou
  ENTER) inicia.
- As telas de idioma e de fim de jogo também têm botões — nada depende do teclado.
- HUD, telas e textos se reorganizam em retrato e paisagem: abaixo de 470 px os
  rótulos viram abreviações, abaixo de 560 px a marcha sai do HUD (segue no painel
  da moto) e abaixo de 380 px o tempo também sai (aparece no resumo final). No
  celular a resolução, as sombras e os retrovisores rodam num modo mais leve.

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

## Profundidade e horizonte

- **Perspectiva atmosférica em camadas**: duas serras (a de fundo mais alta, a
  ~3,7 km, e a da frente a ~2,4 km), uma faixa de mata a 300–1300 m, o skyline
  da cidade e as colinas próximas. Cada camada tem a própria dose de bruma, e a
  cor é remisturada por quadro com a cor do horizonte do momento — de manhã
  ficam azuladas, no pôr do sol alaranjadas, à noite quase pretas.
- **Asfalto**: textura de 1024x2048 cobrindo 36 m (era 24 m), com variação de
  tom em grande escala, agregado fino e grãos expostos, estrias no sentido da
  pista, faixas de recapeamento com borda esfumaçada e costura serpenteante,
  juntas transversais, trilhas de rodagem, óleo pingado no eixo das faixas,
  trincas ramificadas, panelas rasas, terra soprada no acostamento e tinta com
  desgaste e lascas.

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

Tudo sintetizado na Web Audio API (sem arquivos). A tecla **S** liga e desliga o som.

**Da moto**: motor com giro e carga (o tom acompanha o RPM da marcha), vento pela
velocidade, pneus na pista, guincho de freio, estouro da batida, blip da troca de
marcha e o rugido do nitro.

**Do trânsito**: cada veículo próximo ganha um motor próprio — são seis vozes
sintetizadas emprestadas aos veículos mais perto do jogador, com:

- **timbre por classe**: um compacto gira em ~78 Hz com serra e onda quadrada
  brilhante; um sedã e um SUV descem para 68 e 62 Hz; van e picape ficam em ~52 Hz;
  ônibus, caminhão e carreta viram diesel grave (40, 36 e 32 Hz) com muito clatter
  e filtro fechado; a moto sobe para 132 Hz, aguda e limpa;
- **giro real**: a frequência acompanha a velocidade do veículo dentro da faixa da
  classe, então um caminhão em subida soa diferente de um em cruzeiro;
- **efeito Doppler**: o tom sobe enquanto o veículo se aproxima e cai assim que
  passa, calculado pela taxa de afastamento;
- **panorâmica e distância**: o som vem do lado da pista em que o veículo está e cai
  com a distância (some por volta de 110 m);
- **guincho de freio** quando alguém freia perto — e nos pesados vem junto o escape
  do freio a ar;
- **whoosh de ultrapassagem** com peso por classe: curto e agudo na moto, longo e
  grave na carreta.

## Cockpit em primeira pessoa

- **Retrovisores limpos**: cada espelho renderiza a pista atrás de verdade, em
  alvo de 384x232, com aro de borracha, filete cromado e um risco de luz no
  vidro. A carcaça é girada 0,4 rad, então tudo que vai na frente dela é
  deslocado ao longo da **normal da face** — deslocar só em Z fazia o meio da
  carcaça furar o vidro e virar uma mancha escura no reflexo.
- **A moto e o piloto ficam numa camada só do cockpit**, que as câmeras dos
  espelhos não desenham: o vidro mostra a estrada, nunca o próprio piloto.
  O farol continua na camada da pista, para iluminar o asfalto à noite.
- **Mãos com anatomia**: dorso, palma, punho de couro com velcro, quatro dedos
  em duas falanges cada, nós salientes com capa rígida, juntas arredondadas e
  polegar passando por baixo. Índice e médio pousam sobre o manete (freio à
  direita, embreagem à esquerda) e os outros dois fecham no punho.
- **Sombra de contato** onde a mão aperta a borracha e onde a palma encosta,
  para a mão não parecer flutuando em volta do punho.
- **Braços**: ombreira, manga com costura, cotoveleira rígida, punho da jaqueta
  e antebraço de pele saindo por dentro da manga.
- **Comandos completos**: perch com pivô e regulador, lâmina do manete, cilindro
  mestre com reservatório, tampa, visor e mangueira de freio trançada à direita;
  regulador e coifa da embreagem à esquerda; caixa de comandos em duas metades
  com seta, buzina, comutador de farol, chave de emergência, botão de partida e
  alerta; cabos com abraçadeira; contrapeso e ponteira de guidão.
- **Três leituras de metal**: alumínio acetinado, anodizado escuro e cromo, com
  `envMapIntensity` baixo — o mapa de ambiente é o céu claro, e valores altos
  deixavam guidão e manetes brancos.
- **Painel integrado**: textura de 1024x512 (o dobro), números maiores,
  marcações no conta-giros, moldura interna, reflexo de vidro e vinheta. O pod
  ganhou bezel de borracha com quatro parafusos e um suporte em L que sai da
  mesa — o painel deixou de flutuar na frente do piloto.

## A moto vista do piloto

Detalhamento no nível de uma moto de produção, com a construção montada na
ordem certa (fundido -> coxim -> carcaça -> moldura -> tela -> lente):

- **Punho** de revolução de verdade (flange interna, cintura onde a mão fecha,
  ressalto na ponta), com textura de borracha: nervuras longitudinais, faixa de
  losangos no miolo e brilho de desgaste onde a palma encosta. Ao lado, o tubo
  do acelerador, ponteira, anel cromado, contrapeso e o parafuso de fixação.
- **Manete** com lâmina afinando para fora, ponta enrolada, nervura de reforço
  por baixo e o braço até o pivô. O perch é um corpo fundido com meia-lua de
  aperto e dois parafusos, pivô com porca, regulador com dial sextavado e
  oclusão no encaixe.
- **Freio e embreagem separados**: à direita o cilindro-mestre com reservatório,
  tampa, visor e mangueira trançada descendo para a pinça; à esquerda o
  regulador e a coifa do cabo.
- **Caixa de comandos** em duas metades com costura visível e parafuso por
  baixo: seta, buzina e comutador de farol à esquerda; chave de emergência,
  botão de partida e alerta à direita. De cada uma saem dois cabos presos ao
  tubo por abraçadeiras, com engate no fim.
- **Coluna de direção**: mesa, tampas dos garfos com anel de vedação e
  regulador sextavado, parafusos de aperto, porca da coluna, capa pintada na
  cor da moto, ignição com aro cromado, chave e argola.
- **Painel** com carcaça emborrachada, costas nervuradas, conector do chicote,
  moldura com quatro parafusos, pestana com lábio de borracha, lente de
  acrílico com risco de luz e um suporte fundido com orelhas, coxins e
  parafusos saindo da mesa. O chicote desce por trás pela coluna.
- **Retrovisores** com casca convexa, anel de espessura, aro de borracha e
  filete cromado; haste em dois trechos com dobra, base rosqueada e
  contraporca.
- **Mãos**: dorso e canhão em couro costurado (textura com grão e pesponto),
  dedos em duas falanges com nós salientes sob capa rígida, juntas
  arredondadas, polegar por baixo e sombra de contato na borracha.
- **Separação de material**: alumínio escovado, anodizado escuro, cromo,
  parafuso, plástico, borracha, couro, pele e pintura — os metais usam mapa de
  rugosidade escovado e a pintura do tanque ganhou riscos finos, nuvens de
  verniz e mapa de rugosidade próprio.
- **Custo controlado**: o cockpit está sempre na tela, então as peças que não
  se mexem e dividem material são juntadas numa malha só na inicialização
  (ficam de fora rodas, direção, luzes, piscas, a tela e os vidros dos
  espelhos). Isso devolveu ~280 chamadas de desenho das ~300 que o
  detalhamento custou.

## Polimento visual

- **Freio a disco em todas as rodas**: disco embutido dentro do aro e pinça do lado
  de fora, no eixo certo de cada roda.
- **Frentes com profundidade**: a grade é recuada de verdade (fundo escuro, ripas e
  batentes laterais) e o farol é uma moldura escura embutida na carroceria com a
  lente recuada dentro dela, em vez de uma placa lisa.
- **Cabines de perfil extrudado**: em compacto, sedã, SUV e picape o contorno lateral
  (capô, para-brisa, teto, vigia) é uma peça só, então o para-brisa inclinado é uma
  face da própria carroceria — não uma cunha solta apoiada sobre o capô — com o vidro
  assentado por cima e as colunas pintadas aparecendo nas bordas.
- **Cada veículo com identidade própria**: neblinas e ponteiras de escape no compacto,
  moldura cromada e escape duplo no sedã, protetor de cárter e borrachão dos
  para-lamas no SUV, caçamba com nervuras, santantônio e engate na picape, faixa de
  frota e escada traseira na van, duas faixas salientes, letreiro de destino aceso e
  portas do bagageiro no ônibus, quebra-sol, buzinas de ar, degraus e refletores
  laterais no caminhão e na carreta, fila de refletores e para-barro no semirreboque.
- **Moto do trânsito refeita**: chassi treliçado, motor com aletas e coletor, tanque,
  carenagem lateral, garfo com mesa e bengalas, balança, corrente e coroa, ponteira
  subindo sob a rabeta, farol duplo, discos de freio e piloto de verdade (quadril
  atrás, joelhos no tanque, botas nas pedaleiras, tronco sobre o tanque).
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
- **LOD em dois níveis**: frisos, ripas e refletores somem depois de ~62 m e as peças
  miúdas depois de ~130 m, então o detalhe todo só é desenhado onde dá para ver.
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
