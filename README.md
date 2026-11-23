# arduino-builder

## RoboFofo — mascote virtual para ESP32 + OLED SSD1306

Sketch: [`RoboFofo/RoboFofo.ino`](RoboFofo/RoboFofo.ino)

### Bibliotecas (Gerenciador de Bibliotecas da Arduino IDE)
- **Adafruit SSD1306** (instale também as dependências quando a IDE perguntar)
- **Adafruit GFX Library**
- **Wire** — já vem com o core ESP32 (não precisa instalar)

Placa: instale o core **esp32 by Espressif Systems** e selecione **ESP32 Dev Module**.

### Conexões
| Componente | Pino | ESP32 |
|---|---|---|
| OLED | GND | GND |
| OLED | VCC | 3V3 |
| OLED | SCL | GPIO 22 |
| OLED | SDA | GPIO 21 |
| Botão | terminal 1 | GPIO 18 |
| Botão | terminal 2 | GND |

O botão usa `INPUT_PULLUP` (sem resistor externo): solto = HIGH, pressionado = LOW.
Endereço I2C do OLED: `0x3C` (altere `OLED_ADDR` se o seu for `0x3D`).

### Interação
| Ação | Resultado |
|---|---|
| Toque rápido (< 0,6 s) com o robô dormindo | Animação de despertar |
| Toque rápido com o robô acordado | Ignorado |
| Pressionar 1,2–1,7 s | Carinho |
| Pressionar ≥ 2,0 s | Super carinho |
| 30 s sem interação | Cochila e dorme |
