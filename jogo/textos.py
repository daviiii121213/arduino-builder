"""
Todos os textos do jogo: dialogos, quiz, dicas, loja, conquistas e creditos.
Em portugues do Brasil (sem acentos para funcionar com qualquer fonte).
"""

# ---------------------------------------------------------------------------
# Historia
# ---------------------------------------------------------------------------
INTRO = [
    "Em uma bancada de maker, entre fios, resistores e xicaras de cafe frio...",
    "...vivia BITINHO, um pequeno robo feito a partir de um Arduino Uno.",
    "Certa noite, um upload deu errado. Muito errado.",
    "Um BUG escapou da IDE e corrompeu o Bootloader de todas as placas!",
    "Agora Curto-Circuitos, Virus e Glitches se espalham pelos circuitos.",
    "So existe um jeito de consertar tudo: chegar a Nuvem IoT",
    "e fazer o upload do FIRMWARE ORIGINAL.",
    "Compile a coragem. Conecte o cabo USB. E boa sorte, Bitinho!",
]

FINAL = [
    "O Bootloader Sombrio se desfaz em milhares de bits.",
    "Bitinho conecta o cabo e inicia o upload do firmware original...",
    "Enviando... 25%... 50%... 75%... 100%!",
    "\"Upload concluido.\"",
    "Por toda a bancada, LEDs voltam a piscar no ritmo certo.",
    "O Blink voltou a ser apenas um Blink. E isso e lindo.",
    "Prof. Volt mede a tensao do heroi: 5.00V exatos. Perfeito.",
    "Mas la no fundo do Serial Monitor, uma linha solitaria aparece...",
    "> Novo dispositivo detectado: ESP32...",
    "FIM?  Obrigado por jogar, maker!",
]

# ---------------------------------------------------------------------------
# Dialogos do Prof. Volt (multimetro mentor). Chave = id do dialogo.
# ---------------------------------------------------------------------------
DIALOGOS = {
    "tutorial_1": [
        ("Prof. Volt", "Ola, Bitinho! Sou o Prof. Volt, multimetro de estimacao desta bancada."),
        ("Prof. Volt", "Medi sua tensao: 5 volts! Otimo, voce esta pronto para a aventura."),
        ("Prof. Volt", "Use as SETAS ou A/D para andar e ESPACO (ou Z) para pular."),
        ("Prof. Volt", "Segure o pulo para ir mais alto. Solte cedo para um pulinho."),
    ],
    "tutorial_2": [
        ("Prof. Volt", "Esses bichinhos roxos sao BUGS. Eles escaparam da IDE!"),
        ("Prof. Volt", "Pule em cima deles ou use o ferro de solda: tecla J ou X."),
        ("Prof. Volt", "Segure CIMA enquanto atira para mirar para o alto. Util contra voadores!"),
        ("Prof. Volt", "Cada inimigo derrotado solta BYTES. Guarde para a Loja do Maker!"),
    ],
    "tutorial_3": [
        ("Prof. Volt", "Esse terminal controla o portao de rele logo ali."),
        ("Prof. Volt", "Monte o circuito ligando os 5V ate o LED. Mas atencao:"),
        ("Prof. Volt", "LED sem resistor em serie QUEIMA. Nunca esqueca disso, jovem!"),
        ("Prof. Volt", "A corrente de um pino do Arduino deve ficar em torno de 20mA."),
    ],
    "tutorial_4": [
        ("Prof. Volt", "Postes com LED sao CHECKPOINTS. Se cair, voce volta para o ultimo aceso."),
        ("Prof. Volt", "E cuidado com os pinos de header dourados. Sao pontudos!"),
        ("Prof. Volt", "A porta USB no fim da fase faz o upload e conclui o nivel."),
        ("Prof. Volt", "Cada fase esconde 3 componentes secretos. Colecione todos!"),
    ],
    "mundo1": [
        ("Prof. Volt", "Bem-vindo ao Vale da Protoboard! Aqui tudo se conecta por furinhos."),
        ("Prof. Volt", "Dizem que um CURTO-CIRCUITO gigante tomou conta do barramento principal."),
        ("Prof. Volt", "Se precisar de upgrades, visite a Loja do Maker pelo mapa. Bytes compram tudo!"),
    ],
    "mundo1_2": [
        ("Prof. Volt", "As linhas vermelha e azul da protoboard sao os barramentos de alimentacao."),
        ("Prof. Volt", "Vermelho e positivo, azul e negativo (GND). Nao inverta, hein!"),
    ],
    "mundo1_chefe": [
        ("Prof. Volt", "Sinto uma corrente enorme a frente... e o CURTO-CIRCUITO!"),
        ("Prof. Volt", "Fique atento aos avisos vermelhos no chao: sao raios caindo!"),
    ],
    "mundo2": [
        ("Prof. Volt", "Cidade Placa-Mae! Trilhas de cobre para todo lado."),
        ("Prof. Volt", "Os virus daqui se dividem quando atingidos. Nao se assuste!"),
        ("Prof. Volt", "E os fios desencapados ficam eletrificados de tempos em tempos."),
    ],
    "mundo2_2": [
        ("Prof. Volt", "Sabia que as trilhas de uma placa sao feitas corroendo cobre?"),
        ("Prof. Volt", "O verde que voce ve e a mascara de solda, que protege o cobre."),
    ],
    "mundo2_chefe": [
        ("Prof. Volt", "Um presente de madeira gigante... Bitinho, NAO ABRA!"),
        ("Prof. Volt", "E um CAVALO DE TROIA! Ele investe contra as paredes. Desvie e ataque!"),
    ],
    "mundo3": [
        ("Prof. Volt", "Chegamos a Nuvem IoT. Aqui os dados voam pelo WiFi."),
        ("Prof. Volt", "O Bootloader Sombrio esta no servidor central. Estamos perto!"),
        ("Prof. Volt", "Os drones daqui soltam bombas de bits. Olhe para cima!"),
    ],
    "mundo3_2": [
        ("Prof. Volt", "Um ESP32 ja vem com WiFi e Bluetooth embutidos. Incrivel, nao?"),
        ("Prof. Volt", "Mas nada substitui o charme de um bom e velho Uno como voce."),
    ],
    "mundo3_chefe": [
        ("Prof. Volt", "E o BOOTLOADER SOMBRIO. O firmware corrompido que comecou tudo!"),
        ("Prof. Volt", "Desvie dos lasers e dos blocos de codigo. Mire no chip!"),
        ("Prof. Volt", "Bitinho... o mundo dos makers conta com voce. Faca o upload!"),
    ],
    "mundo1_3": [
        ("Prof. Volt", "Um divisor de tensao usa dois resistores para 'dividir' os volts."),
        ("Prof. Volt", "Vout = Vin x R2 / (R1 + R2). Guarde essa formula, vai precisar!"),
        ("Prof. Volt", "E cuidado: esta fase tem solda derretida. Queima que e uma beleza."),
    ],
    "mundo2_3": [
        ("Prof. Volt", "Estamos no nucleo do processador. Aqui cada ciclo de clock conta!"),
        ("Prof. Volt", "O ATmega328P faz 16 milhoes de ciclos por segundo. Seja rapido como ele."),
    ],
    "mundo3_3": [
        ("Prof. Volt", "O Servidor Central. Dizem que ninguem faz backup aqui desde 2009..."),
        ("Prof. Volt", "Depois deste setor, so resta o proprio Bootloader Sombrio."),
        ("Prof. Volt", "Se precisar, volte a Loja do Maker. Nenhum heroi vai sem upgrades!"),
    ],
    "segredo": [
        ("Prof. Volt", "Voce achou minha sala secreta! Aqui guardo meus resistores favoritos."),
        ("Prof. Volt", "Marrom, preto, vermelho: 1k ohm. Vermelho, vermelho, marrom: 220 ohm."),
        ("Prof. Volt", "Decore isso e voce sera um mestre dos resistores!"),
    ],
}

# ---------------------------------------------------------------------------
# Quiz do Arduino: texto, opcoes, indice da correta, explicacao
# ---------------------------------------------------------------------------
QUIZ = [
    {"texto": "Qual funcao do Arduino roda apenas UMA vez, quando a placa liga?",
     "opcoes": ["setup()", "loop()", "main()", "start()"], "correta": 0,
     "explicacao": "setup() roda uma vez ao ligar ou resetar. Depois, loop() repete para sempre."},
    {"texto": "Qual funcao repete infinitamente enquanto o Arduino esta ligado?",
     "opcoes": ["loop()", "setup()", "repeat()", "while()"], "correta": 0,
     "explicacao": "loop() e chamada de novo e de novo, sem parar."},
    {"texto": "Qual comando configura um pino como saida?",
     "opcoes": ["pinMode(13, OUTPUT)", "digitalWrite(13, OUTPUT)", "setPin(13, OUT)",
                "analogWrite(13, 1)"], "correta": 0,
     "explicacao": "pinMode() define se o pino e INPUT, OUTPUT ou INPUT_PULLUP."},
    {"texto": "Qual e a tensao de operacao do Arduino Uno?",
     "opcoes": ["5V", "3.3V", "12V", "220V"], "correta": 0,
     "explicacao": "O Uno trabalha com 5V. Placas como o ESP32 usam 3.3V."},
    {"texto": "Para que serve o resistor em serie com um LED?",
     "opcoes": ["Limitar a corrente", "Aumentar o brilho", "Mudar a cor", "Nada, e enfeite"],
     "correta": 0, "explicacao": "Sem resistor, a corrente dispara e o LED (ou o pino) queima."},
    {"texto": "Qual funcao le um valor de 0 a 1023 de um pino analogico?",
     "opcoes": ["analogRead()", "digitalRead()", "readAnalog()", "pulseIn()"], "correta": 0,
     "explicacao": "O conversor ADC do Uno tem 10 bits: 2^10 = 1024 valores (0 a 1023)."},
    {"texto": "Qual funcao pausa o programa por um tempo em milissegundos?",
     "opcoes": ["delay()", "sleep()", "wait()", "pause()"], "correta": 0,
     "explicacao": "delay(1000) pausa por 1 segundo. Para nao travar, use millis()!"},
    {"texto": "Em qual pino fica o LED embutido (LED_BUILTIN) do Arduino Uno?",
     "opcoes": ["13", "0", "7", "A0"], "correta": 0,
     "explicacao": "O famoso Blink pisca o LED do pino 13."},
    {"texto": "Qual comando inicia a comunicacao serial a 9600 baud?",
     "opcoes": ["Serial.begin(9600)", "Serial.start(9600)", "Serial.open(9600)", "begin(9600)"],
     "correta": 0, "explicacao": "Depois disso, use Serial.println() para enviar mensagens."},
    {"texto": "Qual microcontrolador equipa o Arduino Uno R3?",
     "opcoes": ["ATmega328P", "ESP8266", "STM32", "Z80"], "correta": 0,
     "explicacao": "O ATmega328P roda a 16MHz e tem 32KB de memoria flash."},
    {"texto": "analogWrite() gera um sinal do tipo:",
     "opcoes": ["PWM", "Analogico real", "Serial", "I2C"], "correta": 0,
     "explicacao": "PWM liga e desliga muito rapido, simulando uma tensao media."},
    {"texto": "Qual valor de analogWrite() corresponde a 100% de brilho?",
     "opcoes": ["255", "1023", "100", "5"], "correta": 0,
     "explicacao": "analogWrite usa 8 bits: de 0 (desligado) a 255 (ligado total)."},
    {"texto": "Qual e a lei que relaciona tensao, corrente e resistencia?",
     "opcoes": ["Lei de Ohm", "Lei de Newton", "Lei de Murphy", "Lei de Moore"], "correta": 0,
     "explicacao": "V = R x I. Com ela voce calcula o resistor ideal para um LED."},
    {"texto": "Qual protocolo usa os pinos SDA e SCL?",
     "opcoes": ["I2C", "SPI", "UART", "USB"], "correta": 0,
     "explicacao": "I2C usa so dois fios e permite varios dispositivos no mesmo barramento."},
    {"texto": "INPUT_PULLUP ativa um resistor interno que liga o pino ao:",
     "opcoes": ["VCC (5V)", "GND", "Pino 13", "Reset"], "correta": 0,
     "explicacao": "Assim o pino le HIGH quando o botao esta solto e LOW quando pressionado."},
    {"texto": "Qual extensao tem um arquivo de codigo (sketch) do Arduino?",
     "opcoes": [".ino", ".ard", ".exe", ".py"], "correta": 0,
     "explicacao": "Os sketches sao salvos como .ino e escritos em C/C++."},
    {"texto": "Que componente converte movimento do eixo em angulos precisos (0 a 180)?",
     "opcoes": ["Servo motor", "Buzzer", "LDR", "Relé"], "correta": 0,
     "explicacao": "Com a biblioteca Servo.h: meuServo.write(90) vai para 90 graus."},
    {"texto": "Qual sensor mede distancia com ondas sonoras?",
     "opcoes": ["HC-SR04", "DHT11", "LDR", "MPU6050"], "correta": 0,
     "explicacao": "O HC-SR04 emite ultrassom e mede o tempo do eco."},
    {"texto": "O que significa GND?",
     "opcoes": ["Terra / referencia 0V", "Gerador", "Grande", "Ganho digital"], "correta": 0,
     "explicacao": "GND (ground) e a referencia de 0V do circuito. Sempre conecte os GNDs!"},
    {"texto": "Qual funcao retorna os milissegundos desde que a placa ligou?",
     "opcoes": ["millis()", "time()", "clock()", "now()"], "correta": 0,
     "explicacao": "millis() permite fazer varias coisas 'ao mesmo tempo' sem usar delay()."},
    {"texto": "Qual componente mede luminosidade variando sua resistencia?",
     "opcoes": ["LDR", "Termistor", "Capacitor", "Diodo"], "correta": 0,
     "explicacao": "LDR = Light Dependent Resistor. Mais luz, menos resistencia."},
    {"texto": "Um diodo permite a corrente passar:",
     "opcoes": ["Em um so sentido", "Nos dois sentidos", "Nunca", "So em AC"], "correta": 0,
     "explicacao": "Por isso o LED (diodo emissor de luz) tem polaridade: perna longa e +."},
]

# ---------------------------------------------------------------------------
# Dicas mostradas na tela de carregamento / game over
# ---------------------------------------------------------------------------
DICAS = [
    "Segure o botao de pulo para pular mais alto.",
    "Voce pode descer de plataformas finas apertando BAIXO + PULO.",
    "Bytes soltos por inimigos somem depois de um tempo. Seja rapido!",
    "A Garra Jacare permite escalar paredes. Procure na Loja do Maker.",
    "O Diodo de Protecao absorve um golpe e se recarrega com o tempo.",
    "Blocos de chip rachados podem ser quebrados com tiros ou com dash.",
    "Todo LED precisa de um resistor em serie. No jogo e na vida real!",
    "Aperte TAB para abrir e fechar o Serial Monitor.",
    "Os componentes secretos ficam escondidos em lugares dificeis.",
    "Pular em cima de um inimigo te da um impulso extra.",
    "Segure CIMA e atire para mirar no alto. Na diagonal, segure CIMA + direcao.",
    "Fios desencapados eletrificados nao podem ser pisados!",
    "Torretas Tesla precisam de linha de visao para atirar.",
    "Virus se dividem em dois menores. Acabe com os pequenos rapido!",
    "Complete um nivel rapido e sem danos para ganhar rank S.",
    "No puzzle de circuito, aperte H para uma dica.",
    "A corrente sempre busca o caminho. Nao deixe um LED sem resistor!",
    "Dash e invencivel por alguns instantes. Use para atravessar ataques!",
]

MENSAGENS_MORTE = [
    "Brown-out detectado!",
    "Tensao abaixo do minimo!",
    "Watchdog reiniciou a placa!",
    "Stack overflow!",
    "Curto-circuito fatal!",
    "Erro: avrdude: stk500_recv(): programmer is not responding",
    "Kernel panic (mas voce nem tem kernel...)",
    "Fumaça magica escapou! (nunca deixe ela sair)",
]

# ---------------------------------------------------------------------------
# Loja do Maker: upgrades
# ---------------------------------------------------------------------------
UPGRADES = [
    {"id": "pulo_duplo", "nome": "Capacitor de Salto", "preco": 120, "max": 1,
     "desc": "Armazena energia para um segundo pulo no ar."},
    {"id": "dash", "nome": "Motor DC Turbo", "preco": 150, "max": 1,
     "desc": "Aperte K/C/Shift para um dash rapido e invencivel."},
    {"id": "garra", "nome": "Garra Jacare", "preco": 180, "max": 1,
     "desc": "Agarre paredes para deslizar e dar pulos de parede."},
    {"id": "bateria", "nome": "Bateria Extra", "preco": 100, "max": 3,
     "desc": "+1 celula de energia maxima. Acumula ate 3 vezes."},
    {"id": "solda_forte", "nome": "Ferro de Solda 60W", "preco": 160, "max": 1,
     "desc": "Tiros de solda maiores, mais rapidos e com dano dobrado."},
    {"id": "ima", "nome": "Ima de Neodimio", "preco": 90, "max": 1,
     "desc": "Atrai bytes proximos automaticamente."},
    {"id": "escudo", "nome": "Diodo de Protecao", "preco": 220, "max": 1,
     "desc": "Absorve um golpe. Recarrega apos 20 segundos."},
]

# ---------------------------------------------------------------------------
# Conquistas
# ---------------------------------------------------------------------------
CONQUISTAS = [
    {"id": "primeiro_passo", "nome": "Hello, World!", "desc": "Complete o tutorial."},
    {"id": "blink", "nome": "Blink", "desc": "Resolva seu primeiro puzzle de circuito."},
    {"id": "sem_fumaca", "nome": "Fumaca Magica Preservada",
     "desc": "Resolva um puzzle sem queimar nenhum LED."},
    {"id": "caca_bugs", "nome": "Debugger", "desc": "Elimine 50 inimigos no total."},
    {"id": "exterminador", "nome": "Antivirus Humano", "desc": "Elimine 200 inimigos no total."},
    {"id": "rico", "nome": "Kilobyte", "desc": "Junte 1024 bytes no total."},
    {"id": "colecionador", "nome": "Kit Iniciante", "desc": "Encontre 10 componentes secretos."},
    {"id": "mestre_componentes", "nome": "Almoxarifado Completo",
     "desc": "Encontre todos os componentes secretos."},
    {"id": "chefe1", "nome": "Fusivel Trocado", "desc": "Derrote o Curto-Circuito."},
    {"id": "chefe2", "nome": "Firewall", "desc": "Derrote o Cavalo de Troia."},
    {"id": "chefe3", "nome": "Upload Concluido", "desc": "Derrote o Bootloader Sombrio."},
    {"id": "intocavel", "nome": "Circuito Protegido", "desc": "Complete um nivel sem levar dano."},
    {"id": "rank_s", "nome": "Otimizado", "desc": "Consiga rank S em um nivel."},
    {"id": "quiz_mestre", "nome": "Datasheet Ambulante", "desc": "Acerte 10 perguntas do quiz."},
    {"id": "compras", "nome": "Cliente VIP", "desc": "Compre 5 upgrades na Loja do Maker."},
    {"id": "saltador", "nome": "Pula-Pula", "desc": "Pule 1000 vezes."},
    {"id": "sobrevivente", "nome": "Resiliente", "desc": "Morra 25 vezes e continue tentando."},
    {"id": "zerou", "nome": "Maker Lendario", "desc": "Termine o jogo."},
]

# ---------------------------------------------------------------------------
# Creditos
# ---------------------------------------------------------------------------
CREDITOS = [
    ("ARDUINO BUILDER", "titulo"),
    ("A Aventura do Bitinho", "sub"),
    ("", ""),
    ("Um jogo surpresa feito com carinho", "normal"),
    ("para um maker que gosta de Arduino", "normal"),
    ("", ""),
    ("PROGRAMACAO", "cabecalho"),
    ("Claude, com Python + Pygame", "normal"),
    ("", ""),
    ("GRAFICOS", "cabecalho"),
    ("100% procedurais: cada pixel desenhado em codigo", "normal"),
    ("", ""),
    ("AUDIO", "cabecalho"),
    ("Sintetizador chiptune caseiro", "normal"),
    ("(ondas quadradas, como um buzzer piezo!)", "normal"),
    ("", ""),
    ("ELENCO", "cabecalho"),
    ("Bitinho ............ Arduino Uno R3", "normal"),
    ("Prof. Volt ......... Multimetro digital", "normal"),
    ("Curto-Circuito ..... Ele mesmo", "normal"),
    ("Cavalo de Troia .... Virus de madeira", "normal"),
    ("Bootloader Sombrio . Firmware v6.66", "normal"),
    ("", ""),
    ("AGRADECIMENTOS", "cabecalho"),
    ("A todos os resistores de 220 ohms", "normal"),
    ("que deram a vida protegendo LEDs", "normal"),
    ("", ""),
    ("E a voce, por jogar!", "normal"),
    ("", ""),
    ("void loop() { continuarCriando(); }", "codigo"),
]

# ---------------------------------------------------------------------------
# Mensagens de boot (animacao de abertura estilo IDE do Arduino)
# ---------------------------------------------------------------------------
BOOT = [
    "Arduino Builder v1.0.0",
    "Verificando sketch 'bitinho.ino'...",
    "O sketch usa 31744 bytes (98%) do espaco de armazenamento.",
    "Variaveis globais usam 2012 bytes (98%) de memoria dinamica.",
    "Aviso: pouca memoria disponivel, problemas de estabilidade podem ocorrer.",
    "Carregando...",
    "avrdude: AVR device initialized and ready to accept instructions",
    "Reading | ################################################## | 100%",
    "avrdude: writing flash (31744 bytes):",
    "Writing | ################################################## | 100%",
    "avrdude: 31744 bytes of flash verified",
    "Carregado.",
]

NOMES_UPGRADE = {u["id"]: u["nome"] for u in UPGRADES}
