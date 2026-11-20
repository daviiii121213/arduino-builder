# arduino-builder

## MINI ARCADE ESP32

Console de jogos com **DINO RUN** e **PONG** para ESP32 + OLED SSD1306 128x64 + joystick KY-023.

Código completo: [`MiniArcadeESP32/MiniArcadeESP32.ino`](MiniArcadeESP32/MiniArcadeESP32.ino)

### Ligações

| Componente | Pino  | ESP32   |
|------------|-------|---------|
| OLED       | GND   | GND     |
| OLED       | VCC   | 3V3     |
| OLED       | SDA   | GPIO 21 |
| OLED       | SCL   | GPIO 22 |
| Joystick   | GND   | GND     |
| Joystick   | +5V   | **3V3** |
| Joystick   | VRx   | GPIO 34 |
| Joystick   | VRy   | GPIO 35 |
| Joystick   | SW    | GPIO 18 |

### Instalação

1. Arduino IDE 2.x → *Arquivo > Preferências* → em "URLs adicionais" coloque
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. *Gerenciador de Placas* → instale **esp32 by Espressif Systems**.
3. *Gerenciar Bibliotecas* → instale **Adafruit SSD1306** e **Adafruit GFX Library** (aceite as dependências).
   `Wire` e `Preferences` já vêm com o core ESP32.
4. Abra `MiniArcadeESP32/MiniArcadeESP32.ino`, selecione a placa **ESP32 Dev Module** e a porta, e clique em **Carregar**
   (se ficar em "Connecting...", segure o botão BOOT).

### Controles

| Onde      | Ação |
|-----------|------|
| Menu      | Cima/Baixo navega, clique seleciona |
| DINO RUN  | Clique (ou Cima) pula; segure para pular mais alto; Baixo abaixa / acelera a queda |
| PONG      | Cima/Baixo move a raquete (velocidade proporcional à inclinação) |
| Jogos     | Segure ESQUERDA por 1 s para voltar ao menu (nas telas de início/fim basta tocar para a esquerda) |

Se os eixos estiverem invertidos, ajuste `JOY_INVERT_X`, `JOY_INVERT_Y` ou `JOY_SWAP_XY` no início do código.
Recordes (Dino, vitórias/derrotas e maior rally do Pong) ficam salvos na memória NVS.
