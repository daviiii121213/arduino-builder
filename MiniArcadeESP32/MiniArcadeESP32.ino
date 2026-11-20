/*
  ============================================================================
                         MINI ARCADE ESP32  -  v1.0
        Console de jogos com DINO RUN e PONG em um OLED 0.96" 128x64
  ============================================================================

  ---------------------------------------------------------------------------
   HARDWARE
  ---------------------------------------------------------------------------
   - Placa ...........: ESP32 DevKit (ESP32-WROOM-32)
   - Display .........: OLED SSD1306 I2C 128x64 (endereco 0x3C)
   - Joystick ........: KY-023 (analogico 2 eixos + botao)

  ---------------------------------------------------------------------------
   LIGACOES
  ---------------------------------------------------------------------------
     OLED SSD1306          ESP32
     ------------          -----
     GND  ---------------> GND
     VCC  ---------------> 3V3
     SDA  ---------------> GPIO 21
     SCL  ---------------> GPIO 22

     JOYSTICK KY-023       ESP32
     ---------------       -----
     GND  ---------------> GND
     +5V (VCC) ----------> 3V3   (IMPORTANTE: use 3V3, nunca 5V, pois o ADC
                                   do ESP32 suporta no maximo 3.3V)
     VRx  ---------------> GPIO 34
     VRy  ---------------> GPIO 35
     SW   ---------------> GPIO 18

  ---------------------------------------------------------------------------
   BIBLIOTECAS NECESSARIAS
  ---------------------------------------------------------------------------
   - Wire ............: ja vem com o core ESP32
   - Preferences .....: ja vem com o core ESP32
   - Adafruit GFX Library   (Gerenciador de Bibliotecas)
   - Adafruit SSD1306       (Gerenciador de Bibliotecas)
     (aceite instalar tambem a dependencia "Adafruit BusIO")

  ---------------------------------------------------------------------------
   INSTALACAO NA ARDUINO IDE
  ---------------------------------------------------------------------------
   1. Instale a Arduino IDE 2.x (https://www.arduino.cc/en/software).
   2. Arquivo > Preferencias > "URLs adicionais para Gerenciadores de Placas":
        https://espressif.github.io/arduino-esp32/package_esp32_index.json
   3. Ferramentas > Placa > Gerenciador de Placas: procure "esp32" e instale
      "esp32 by Espressif Systems" (versao 2.x ou 3.x).
   4. Ferramentas > Gerenciar Bibliotecas: instale "Adafruit SSD1306" e
      "Adafruit GFX Library" (confirme "Install all" para as dependencias).

  ---------------------------------------------------------------------------
   COMO CARREGAR NO ESP32
  ---------------------------------------------------------------------------
   1. Conecte o ESP32 ao PC com um cabo USB de DADOS.
   2. Ferramentas > Placa > esp32 > "ESP32 Dev Module".
   3. Ferramentas > Porta: selecione a COM/ttyUSB do ESP32
      (se nao aparecer, instale o driver CP210x ou CH340 da sua placa).
   4. Clique em "Carregar" (seta ->). Se aparecer "Connecting....", segure o
      botao BOOT da placa ate o upload comecar.
   5. Abra o Monitor Serial em 115200 baud para ver mensagens de diagnostico.

  ---------------------------------------------------------------------------
   CONTROLES
  ---------------------------------------------------------------------------
   MENU ......: Cima/Baixo navega   |  Clique seleciona o jogo
   DINO RUN ..: Clique (ou Cima) pula - segure para pular mais alto
                Baixo abaixa (desvia dos passaros) / acelera a queda no ar
   PONG ......: Cima/Baixo move a raquete (velocidade proporcional)
   QUALQUER JOGO: segure o joystick para a ESQUERDA por 1s = voltar ao menu
                  (nas telas de inicio / fim basta empurrar para a esquerda)

  ---------------------------------------------------------------------------
   AJUSTES
  ---------------------------------------------------------------------------
   Se os eixos estiverem invertidos/trocados no seu modulo, altere
   JOY_INVERT_X, JOY_INVERT_Y e JOY_SWAP_XY logo abaixo.
   O centro do joystick e calibrado automaticamente ao ligar
   (nao toque no joystick durante a tela de abertura).
  ============================================================================
*/

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>
#include <math.h>

// ============================================================================
//  CONFIGURACAO
// ============================================================================
#define SCREEN_W        128
#define SCREEN_H        64
#define OLED_ADDR       0x3C
#define OLED_RESET      -1

#define PIN_SDA         21
#define PIN_SCL         22
#define PIN_VRX         34
#define PIN_VRY         35
#define PIN_SW          18

#define JOY_INVERT_X    false
#define JOY_INVERT_Y    false
#define JOY_SWAP_XY     false
#define JOY_DEADZONE    18      // zona morta em % (0..100)
#define JOY_DIGITAL     50      // limiar para considerar direcao digital

#define FRAME_MS        33      // ~30 FPS (passo fixo de fisica)
#define EXIT_HOLD_MS    1000    // tempo segurando ESQUERDA para sair

#define C_WHITE   SSD1306_WHITE
#define C_BLACK   SSD1306_BLACK
#define C_INV     SSD1306_INVERSE

Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, OLED_RESET);
Preferences prefs;

// ============================================================================
//  SPRITES (pixel art 1-bit, MSB primeiro, linhas alinhadas em bytes)
// ============================================================================
// DINO_RUN1 (20x19)
const uint8_t DINO_RUN1[] PROGMEM = {
  0x00, 0x1F, 0xE0, 0x00, 0x37, 0xF0,
  0x00, 0x3F, 0xF0, 0x00, 0x3F, 0xF0,
  0x00, 0x3E, 0x00, 0x00, 0x3F, 0xC0,
  0x80, 0x7C, 0x00, 0x80, 0xFE, 0x00,
  0xC1, 0xFF, 0x00, 0xE3, 0xF9, 0x00,
  0xFF, 0xF0, 0x00, 0x7F, 0xF0, 0x00,
  0x3F, 0xF0, 0x00, 0x1F, 0xE0, 0x00,
  0x0F, 0xC0, 0x00, 0x06, 0x60, 0x00,
  0x04, 0x30, 0x00, 0x04, 0x00, 0x00,
  0x06, 0x00, 0x00,
};
#define DINO_RUN1_W 20
#define DINO_RUN1_H 19

// DINO_RUN2 (20x19)
const uint8_t DINO_RUN2[] PROGMEM = {
  0x00, 0x1F, 0xE0, 0x00, 0x37, 0xF0,
  0x00, 0x3F, 0xF0, 0x00, 0x3F, 0xF0,
  0x00, 0x3E, 0x00, 0x00, 0x3F, 0xC0,
  0x80, 0x7C, 0x00, 0x80, 0xFE, 0x00,
  0xC1, 0xFF, 0x00, 0xE3, 0xF9, 0x00,
  0xFF, 0xF0, 0x00, 0x7F, 0xF0, 0x00,
  0x3F, 0xF0, 0x00, 0x1F, 0xE0, 0x00,
  0x0F, 0xC0, 0x00, 0x06, 0x60, 0x00,
  0x0C, 0x20, 0x00, 0x00, 0x20, 0x00,
  0x00, 0x30, 0x00,
};
#define DINO_RUN2_W 20
#define DINO_RUN2_H 19

// DINO_JUMP (20x19)
const uint8_t DINO_JUMP[] PROGMEM = {
  0x00, 0x1F, 0xE0, 0x00, 0x37, 0xF0,
  0x00, 0x3F, 0xF0, 0x00, 0x3F, 0xF0,
  0x00, 0x3E, 0x00, 0x00, 0x3F, 0xC0,
  0x80, 0x7C, 0x00, 0x80, 0xFE, 0x00,
  0xC1, 0xFF, 0x00, 0xE3, 0xF9, 0x00,
  0xFF, 0xF0, 0x00, 0x7F, 0xF0, 0x00,
  0x3F, 0xF0, 0x00, 0x1F, 0xE0, 0x00,
  0x0F, 0xC0, 0x00, 0x06, 0x60, 0x00,
  0x04, 0x20, 0x00, 0x04, 0x20, 0x00,
  0x06, 0x30, 0x00,
};
#define DINO_JUMP_W 20
#define DINO_JUMP_H 19

// DINO_DEAD (20x19)
const uint8_t DINO_DEAD[] PROGMEM = {
  0x00, 0x1F, 0xE0, 0x00, 0x2B, 0xF0,
  0x00, 0x37, 0xF0, 0x00, 0x2B, 0xF0,
  0x00, 0x3F, 0xF0, 0x00, 0x3E, 0x00,
  0x80, 0x7F, 0x00, 0x80, 0xFE, 0x00,
  0xC1, 0xFF, 0x00, 0xE3, 0xF9, 0x00,
  0xFF, 0xF0, 0x00, 0x7F, 0xF0, 0x00,
  0x3F, 0xF0, 0x00, 0x1F, 0xE0, 0x00,
  0x0F, 0xC0, 0x00, 0x06, 0x60, 0x00,
  0x04, 0x20, 0x00, 0x04, 0x20, 0x00,
  0x06, 0x30, 0x00,
};
#define DINO_DEAD_W 20
#define DINO_DEAD_H 19

// DINO_BLINK (20x19)
const uint8_t DINO_BLINK[] PROGMEM = {
  0x00, 0x1F, 0xE0, 0x00, 0x3F, 0xF0,
  0x00, 0x3F, 0xF0, 0x00, 0x3F, 0xF0,
  0x00, 0x3E, 0x00, 0x00, 0x3F, 0xC0,
  0x80, 0x7C, 0x00, 0x80, 0xFE, 0x00,
  0xC1, 0xFF, 0x00, 0xE3, 0xF9, 0x00,
  0xFF, 0xF0, 0x00, 0x7F, 0xF0, 0x00,
  0x3F, 0xF0, 0x00, 0x1F, 0xE0, 0x00,
  0x0F, 0xC0, 0x00, 0x06, 0x60, 0x00,
  0x04, 0x20, 0x00, 0x04, 0x20, 0x00,
  0x06, 0x30, 0x00,
};
#define DINO_BLINK_W 20
#define DINO_BLINK_H 19

// DINO_DUCK1 (26x10)
const uint8_t DINO_DUCK1[] PROGMEM = {
  0x80, 0x00, 0x3F, 0xC0,
  0xC0, 0x00, 0x6F, 0xC0,
  0xE0, 0xFF, 0xFD, 0xC0,
  0xFF, 0xFF, 0xFD, 0xC0,
  0x7F, 0xFF, 0xFC, 0x00,
  0x3F, 0xFF, 0xEE, 0x00,
  0x1F, 0xFF, 0x80, 0x00,
  0x0E, 0xE0, 0x00, 0x00,
  0x08, 0x60, 0x00, 0x00,
  0x0C, 0x00, 0x00, 0x00,
};
#define DINO_DUCK1_W 26
#define DINO_DUCK1_H 10

// DINO_DUCK2 (26x10)
const uint8_t DINO_DUCK2[] PROGMEM = {
  0x80, 0x00, 0x3F, 0xC0,
  0xC0, 0x00, 0x6F, 0xC0,
  0xE0, 0xFF, 0xFD, 0xC0,
  0xFF, 0xFF, 0xFD, 0xC0,
  0x7F, 0xFF, 0xFC, 0x00,
  0x3F, 0xFF, 0xEE, 0x00,
  0x1F, 0xFF, 0x80, 0x00,
  0x0E, 0xE0, 0x00, 0x00,
  0x06, 0x20, 0x00, 0x00,
  0x00, 0x30, 0x00, 0x00,
};
#define DINO_DUCK2_W 26
#define DINO_DUCK2_H 10

// CACTUS_S (8x13)
const uint8_t CACTUS_S[] PROGMEM = {
  0x18, 0x3C,
  0x3C, 0xBC,
  0xBD, 0xBD,
  0xBD, 0xFD,
  0x3F, 0x3C,
  0x3C, 0x3C,
  0x3C,
};
#define CACTUS_S_W 8
#define CACTUS_S_H 13

// CACTUS_L (11x19)
const uint8_t CACTUS_L[] PROGMEM = {
  0x0E, 0x00, 0x1F, 0x00,
  0x1F, 0x00, 0x1F, 0x00,
  0x5F, 0x00, 0xEF, 0x00,
  0xEF, 0x60, 0xEF, 0x60,
  0xEF, 0xA0, 0xEF, 0xA0,
  0xF7, 0xA0, 0x7F, 0x60,
  0x1F, 0xE0, 0x1F, 0x00,
  0x1F, 0x00, 0x1F, 0x00,
  0x1F, 0x00, 0x1F, 0x00,
  0x1F, 0x00,
};
#define CACTUS_L_W 11
#define CACTUS_L_H 19

// BIRD1 (22x10)
const uint8_t BIRD1[] PROGMEM = {
  0x08, 0x00, 0x00, 0x0C, 0x00, 0x00,
  0x0E, 0x00, 0x00, 0x1E, 0x00, 0x00,
  0x37, 0x80, 0x00, 0x7F, 0xFC, 0x00,
  0xFF, 0xFF, 0xFC, 0x1F, 0xE0, 0x00,
  0x03, 0xF0, 0x00, 0x00, 0x00, 0x00,
};
#define BIRD1_W 22
#define BIRD1_H 10

// BIRD2 (22x12)
const uint8_t BIRD2[] PROGMEM = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x10, 0x00, 0x00,
  0x37, 0x00, 0x00, 0x7F, 0xFC, 0x00,
  0xFF, 0xFF, 0xFC, 0x1F, 0xF0, 0x00,
  0x07, 0x80, 0x00, 0x07, 0x00, 0x00,
  0x06, 0x00, 0x00, 0x04, 0x00, 0x00,
};
#define BIRD2_W 22
#define BIRD2_H 12

// CLOUD (18x6)
const uint8_t CLOUD[] PROGMEM = {
  0x01, 0xE0, 0x00, 0x06, 0x18, 0x00,
  0x18, 0x04, 0x00, 0x60, 0x03, 0x80,
  0x80, 0x00, 0x40, 0x7F, 0xFF, 0x80,
};
#define CLOUD_W 18
#define CLOUD_H 6

// TROPHY (24x19)
const uint8_t TROPHY[] PROGMEM = {
  0x1F, 0xFF, 0xF8, 0x10, 0x00, 0x08,
  0x77, 0xFF, 0x0E, 0x97, 0xFF, 0x09,
  0x93, 0xFF, 0x09, 0x93, 0xFF, 0x11,
  0x53, 0xFF, 0x14, 0x31, 0xFE, 0x18,
  0x18, 0xFC, 0x30, 0x04, 0x78, 0x40,
  0x03, 0x31, 0x80, 0x00, 0xCE, 0x00,
  0x00, 0x30, 0x00, 0x00, 0x30, 0x00,
  0x00, 0x78, 0x00, 0x00, 0xFC, 0x00,
  0x03, 0xFF, 0x00, 0x02, 0x01, 0x00,
  0x03, 0xFF, 0x00,
};
#define TROPHY_W 24
#define TROPHY_H 19

// SKULL (16x13)
const uint8_t SKULL[] PROGMEM = {
  0x07, 0xE0, 0x1F, 0xF8,
  0x3F, 0xFC, 0x7F, 0xFE,
  0x7F, 0xFE, 0x71, 0x8E,
  0x71, 0x8E, 0x71, 0x8E,
  0x3F, 0x7E, 0x1E, 0x3C,
  0x0F, 0xFC, 0x0A, 0xA8,
  0x0F, 0xFC,
};
#define SKULL_W 16
#define SKULL_H 13

// ============================================================================
//  ESTADOS GERAIS
// ============================================================================
enum AppState : uint8_t { ST_SPLASH, ST_MENU, ST_DINO, ST_PONG };
AppState appState = ST_SPLASH;
uint32_t stateStartMs = 0;
uint32_t lastFrameMs = 0;
uint32_t frameCount = 0;

// ---------------------------------------------------------------------------
//  Entrada
// ---------------------------------------------------------------------------
struct JoyState {
  int8_t  x, y;                         // -100..100 (y < 0 = cima)
  bool    up, down, left, right;        // direcao digital atual
  bool    upEv, downEv, leftEv, rightEv;// evento (borda + auto-repeticao)
  bool    btn, btnPressed, btnReleased; // botao
  uint32_t btnSinceMs;
  bool    leftHolding;
  uint32_t leftSinceMs;
};
JoyState joy;
int joyCenterX = 2048;
int joyCenterY = 2048;

// ---------------------------------------------------------------------------
//  Recordes (NVS)
// ---------------------------------------------------------------------------
uint32_t dinoHi        = 0;
uint16_t pongWins      = 0;
uint16_t pongLosses    = 0;
uint16_t pongBestRally = 0;

// ---------------------------------------------------------------------------
//  Particulas (compartilhadas pelos jogos)
// ---------------------------------------------------------------------------
#define MAX_PARTICLES 28
struct Particle {
  float x, y, vx, vy;
  uint8_t life;
};
Particle particles[MAX_PARTICLES];

// ---------------------------------------------------------------------------
//  Menu
// ---------------------------------------------------------------------------
uint8_t menuSel = 0;
float   menuSelY = 14;

// ---------------------------------------------------------------------------
//  DINO RUN
// ---------------------------------------------------------------------------
#define GROUND_LINE   60
#define DINO_X        8
#define DINO_GRAVITY  0.34f
#define DINO_JUMP_V   4.6f
#define MAX_OBST      4
#define MAX_CLOUDS    3
#define MAX_PEBBLES   12

enum DinoState : uint8_t { D_READY, D_PLAY, D_OVER };
enum ObstType  : uint8_t { OB_CS, OB_CL, OB_CS2, OB_CL2, OB_CS3, OB_BIRD };

struct Obstacle {
  float   x;
  int8_t  y;        // so para passaros
  uint8_t type;
  uint8_t w;
  bool    active;
};
struct Cloud  { float x; int8_t y; };
struct Pebble { float x; int8_t y; uint8_t len; uint8_t kind; };

DinoState dState;
float    dDy, dVy;            // altura acima do chao e velocidade vertical
bool     dDucking, dOnGround;
float    dSpeed;
float    dDistance;
uint32_t dScore;
uint8_t  dJumpBuffer;
bool     dNewRecord;
bool     dNight;
uint32_t dOverMs;
uint8_t  dFlash;
uint8_t  dShake;
uint16_t dMilestoneFrames;
float    dNextSpawn;
Obstacle obst[MAX_OBST];
Cloud    clouds[MAX_CLOUDS];
Pebble   pebbles[MAX_PEBBLES];

// Grupos de cactos: deslocamento X e tipo (0 = pequeno, 1 = grande)
const int8_t  CACTUS_OFF[5][3]  = { {0,-1,-1}, {0,-1,-1}, {0,9,-1}, {0,12,-1}, {0,9,18} };
const uint8_t CACTUS_KIND[5][3] = { {0,0,0},   {1,0,0},   {0,0,0},  {1,0,0},   {0,0,0}  };
const uint8_t CACTUS_GW[5]      = { 8, 11, 17, 20, 26 };

// ---------------------------------------------------------------------------
//  PONG
// ---------------------------------------------------------------------------
#define PADDLE_H      14
#define PADDLE_W      3
#define P1_X          3
#define P2_X          122
#define BALL_S        3
#define BALL_MIN_Y    1
#define BALL_MAX_Y    (63 - BALL_S)
#define WIN_SCORE     7
#define PLAYER_SPEED  3.6f
#define BALL_MAX_SPD  5.6f
#define TRAIL_LEN     5

enum PongState : uint8_t { P_READY, P_SERVE, P_PLAY, P_POINT, P_WIN, P_LOSE };

PongState pState;
float    p1y, p2y, p1v, p2v;
float    bx, by, bvx, bvy, bSpeed;
uint8_t  s1, s2;
uint8_t  pLevel;
uint16_t pRally, pMatchBestRally;
int8_t   pServeDir;
uint32_t pStateMs;
float    aiOffset;
uint8_t  p1Flash, p2Flash;
uint8_t  pShake;
uint8_t  pPop1, pPop2;
bool     pLastPointPlayer;
bool     pLevelUp;
int16_t  trailX[TRAIL_LEN], trailY[TRAIL_LEN];
uint8_t  trailHead;
float    demoBx, demoBy, demoVx, demoVy;

// ============================================================================
//  PROTOTIPOS
// ============================================================================
void readJoystick();
void calibrateJoystick();
void loadRecords();
void saveRecords();
void changeState(AppState s);
void splash();
void drawSplash();
void menu();
void drawMenu();
void dinoInit();
void dinoGame();
void drawDino();
void pongInit();
void pongGame();
void drawPong();
// Funcoes com argumentos padrao (declaradas aqui para a IDE nao duplicar)
void printAt(int16_t x, int16_t y, const char *s, uint8_t size = 1, uint16_t color = C_WHITE);
int16_t textWidth(const char *s, uint8_t size = 1);
void printCentered(int16_t y, const char *s, uint8_t size = 1, uint16_t color = C_WHITE);
void drawParticles(int8_t ox = 0, int8_t oy = 0, bool big = false);

// ============================================================================
//  UTILITARIOS
// ============================================================================
static inline bool rectOverlap(int ax, int ay, int aw, int ah,
                               int bx_, int by_, int bw, int bh) {
  return ax < bx_ + bw && ax + aw > bx_ && ay < by_ + bh && ay + ah > by_;
}

static inline float frand(float a, float b) {
  return a + (b - a) * (float)random(0, 10001) / 10000.0f;
}

void printAt(int16_t x, int16_t y, const char *s, uint8_t size, uint16_t color) {
  display.setTextSize(size);
  display.setTextColor(color);
  display.setCursor(x, y);
  display.print(s);
}

int16_t textWidth(const char *s, uint8_t size) {
  int16_t n = (int16_t)strlen(s);
  return n > 0 ? n * 6 * size - size : 0;
}

void printCentered(int16_t y, const char *s, uint8_t size, uint16_t color) {
  printAt((SCREEN_W - textWidth(s, size)) / 2, y, s, size, color);
}

bool blink(uint16_t periodMs) {
  return (millis() / periodMs) % 2 == 0;
}

// ---------------------------------------------------------------------------
//  Particulas
// ---------------------------------------------------------------------------
void clearParticles() {
  for (uint8_t i = 0; i < MAX_PARTICLES; i++) particles[i].life = 0;
}

void spawnParticle(float x, float y, float vx, float vy, uint8_t life) {
  for (uint8_t i = 0; i < MAX_PARTICLES; i++) {
    if (particles[i].life == 0) {
      particles[i].x = x;  particles[i].y = y;
      particles[i].vx = vx; particles[i].vy = vy;
      particles[i].life = life;
      return;
    }
  }
}

void updateParticles(float gravity) {
  for (uint8_t i = 0; i < MAX_PARTICLES; i++) {
    Particle &p = particles[i];
    if (p.life == 0) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += gravity;
    p.life--;
    if (p.x < -4 || p.x > SCREEN_W + 4 || p.y > SCREEN_H + 4) p.life = 0;
  }
}

void drawParticles(int8_t ox, int8_t oy, bool big) {
  for (uint8_t i = 0; i < MAX_PARTICLES; i++) {
    const Particle &p = particles[i];
    if (p.life == 0) continue;
    int16_t x = (int16_t)p.x + ox, y = (int16_t)p.y + oy;
    if (big && p.life > 6) display.fillRect(x, y, 2, 2, C_WHITE);
    else display.drawPixel(x, y, C_WHITE);
  }
}

// ---------------------------------------------------------------------------
//  Saida para o menu segurando ESQUERDA
// ---------------------------------------------------------------------------
bool exitHoldTriggered() {
  return joy.leftHolding && (millis() - joy.leftSinceMs >= EXIT_HOLD_MS);
}

void drawExitBar() {
  if (!joy.leftHolding) return;
  uint32_t el = millis() - joy.leftSinceMs;
  if (el < 150) return;
  int16_t w = (int16_t)((uint32_t)SCREEN_W * min(el, (uint32_t)EXIT_HOLD_MS) / EXIT_HOLD_MS);
  display.fillRect(0, 0, w, 2, C_INV);
  display.fillRect(34, 26, 60, 12, C_BLACK);
  display.drawRect(34, 26, 60, 12, C_WHITE);
  printCentered(28, "< MENU");
}

// ============================================================================
//  JOYSTICK
// ============================================================================
static int8_t normAxis(int raw, int center) {
  int d = raw - center;
  int span = (d > 0) ? (4095 - center) : center;
  if (span < 1) span = 1;
  long v = (long)d * 100L / span;
  if (v > 100) v = 100;
  if (v < -100) v = -100;
  if (labs(v) < JOY_DEADZONE) return 0;
  if (v > 0) v = (v - JOY_DEADZONE) * 100L / (100 - JOY_DEADZONE);
  else       v = (v + JOY_DEADZONE) * 100L / (100 - JOY_DEADZONE);
  return (int8_t)v;
}

void calibrateJoystick() {
  long sx = 0, sy = 0;
  for (uint8_t i = 0; i < 32; i++) {
    sx += analogRead(PIN_VRX);
    sy += analogRead(PIN_VRY);
    delay(2);
  }
  joyCenterX = sx / 32;
  joyCenterY = sy / 32;
  // Se o joystick estava deslocado no boot (ou desconectado) usa o centro ideal
  if (joyCenterX < 1200 || joyCenterX > 2900) joyCenterX = 2048;
  if (joyCenterY < 1200 || joyCenterY > 2900) joyCenterY = 2048;
  Serial.printf("[JOY] centro X=%d Y=%d\n", joyCenterX, joyCenterY);
}

void readJoystick() {
  uint32_t now = millis();

  // Media de 4 leituras para reduzir ruido do ADC
  int rx = 0, ry = 0;
  for (uint8_t i = 0; i < 4; i++) {
    rx += analogRead(PIN_VRX);
    ry += analogRead(PIN_VRY);
  }
  rx >>= 2; ry >>= 2;

  int8_t nx = normAxis(rx, joyCenterX);
  int8_t ny = normAxis(ry, joyCenterY);
  if (JOY_SWAP_XY) { int8_t t = nx; nx = ny; ny = t; }
  if (JOY_INVERT_X) nx = -nx;
  if (JOY_INVERT_Y) ny = -ny;
  joy.x = nx;
  joy.y = ny;

  joy.up    = ny < -JOY_DIGITAL;
  joy.down  = ny >  JOY_DIGITAL;
  joy.left  = nx < -JOY_DIGITAL;
  joy.right = nx >  JOY_DIGITAL;

  // Eventos digitais com auto-repeticao (para navegacao)
  static bool     prevDir[4] = { false, false, false, false };
  static uint32_t repeatAt[4] = { 0, 0, 0, 0 };
  bool cur[4] = { joy.up, joy.down, joy.left, joy.right };
  bool ev[4];
  for (uint8_t i = 0; i < 4; i++) {
    ev[i] = false;
    if (cur[i] && !prevDir[i]) { ev[i] = true; repeatAt[i] = now + 380; }
    else if (cur[i] && (int32_t)(now - repeatAt[i]) >= 0) { ev[i] = true; repeatAt[i] = now + 150; }
    prevDir[i] = cur[i];
  }
  joy.upEv = ev[0]; joy.downEv = ev[1]; joy.leftEv = ev[2]; joy.rightEv = ev[3];

  if (joy.left) {
    if (!joy.leftHolding) { joy.leftHolding = true; joy.leftSinceMs = now; }
  } else {
    joy.leftHolding = false;
  }

  // Botao com debounce (ativo em LOW, pull-up interno)
  static bool     rawPrev = false;
  static uint32_t rawChangeMs = 0;
  bool raw = (digitalRead(PIN_SW) == LOW);
  if (raw != rawPrev) { rawPrev = raw; rawChangeMs = now; }
  joy.btnPressed = false;
  joy.btnReleased = false;
  if ((now - rawChangeMs) >= 20 && raw != joy.btn) {
    joy.btn = raw;
    if (raw) { joy.btnPressed = true; joy.btnSinceMs = now; }
    else     { joy.btnReleased = true; }
  }
}

// ============================================================================
//  RECORDES (NVS / Preferences)
// ============================================================================
void loadRecords() {
  prefs.begin("arcade", false);
  dinoHi        = prefs.getUInt("dinoHi", 0);
  pongWins      = prefs.getUShort("pongWins", 0);
  pongLosses    = prefs.getUShort("pongLoss", 0);
  pongBestRally = prefs.getUShort("pongRally", 0);
  prefs.end();
  Serial.printf("[NVS] dinoHi=%lu pongWins=%u pongLoss=%u rally=%u\n",
                (unsigned long)dinoHi, pongWins, pongLosses, pongBestRally);
}

void saveRecords() {
  // Chamado somente no fim de cada partida (evita desgaste da flash)
  prefs.begin("arcade", false);
  prefs.putUInt("dinoHi", dinoHi);
  prefs.putUShort("pongWins", pongWins);
  prefs.putUShort("pongLoss", pongLosses);
  prefs.putUShort("pongRally", pongBestRally);
  prefs.end();
  Serial.println("[NVS] recordes salvos");
}

// ============================================================================
//  MAQUINA DE ESTADOS PRINCIPAL
// ============================================================================
void changeState(AppState s) {
  appState = s;
  stateStartMs = millis();
  clearParticles();
  display.invertDisplay(false);
  if (s == ST_DINO) dinoInit();
  if (s == ST_PONG) pongInit();
  if (s == ST_MENU) menuSelY = 14 + menuSel * 22;
}

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println();
  Serial.println("=== MINI ARCADE ESP32 ===");

  pinMode(PIN_SW, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // faixa completa 0..3.3V

  Wire.begin(PIN_SDA, PIN_SCL);
  while (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[ERRO] SSD1306 nao encontrado em 0x3C. Verifique SDA=21 SCL=22.");
    delay(1000);
  }
  display.setTextWrap(false);
  display.cp437(true);
  display.clearDisplay();
  display.display();

  calibrateJoystick();
  loadRecords();
  memset(&joy, 0, sizeof(joy));
  clearParticles();
  changeState(ST_SPLASH);
  lastFrameMs = millis();
}

void loop() {
  uint32_t now = millis();
  if (now - lastFrameMs < FRAME_MS) {
    delay(1);               // libera a CPU (evita watchdog) sem travar o jogo
    return;
  }
  // Mantem o ritmo fixo, mas sem tentar "recuperar" quadros perdidos
  lastFrameMs = (now - lastFrameMs > FRAME_MS * 3) ? now : lastFrameMs + FRAME_MS;

  readJoystick();

  switch (appState) {
    case ST_SPLASH: splash();    break;
    case ST_MENU:   menu();      break;
    case ST_DINO:   dinoGame();  break;
    case ST_PONG:   pongGame();  break;
  }
  frameCount++;
}

// ============================================================================
//  TELA DE ABERTURA
// ============================================================================
void splash() {
  uint32_t t = millis() - stateStartMs;
  if (t > 600 && (joy.btnPressed || joy.upEv || joy.downEv)) { changeState(ST_MENU); return; }
  if (t > 3200) { changeState(ST_MENU); return; }
  drawSplash();
}

void drawSplash() {
  uint32_t t = millis() - stateStartMs;
  display.clearDisplay();

  // Estrelas ao fundo (posicoes pseudo-aleatorias fixas)
  for (uint8_t i = 0; i < 14; i++) {
    int16_t sx = (i * 37 + 11) % SCREEN_W;
    int16_t sy = (i * 23 + 5) % SCREEN_H;
    if (((t / 120) + i) % 5) display.drawPixel(sx, sy, C_WHITE);
  }

  // "MINI": cada letra cai do topo com pequeno quique
  const char *mini = "MINI";
  for (uint8_t i = 0; i < 4; i++) {
    int32_t lt = (int32_t)t - 150 * i;
    int16_t y;
    if (lt < 0) continue;
    if (lt < 300)      y = -16 + (int16_t)(lt * 26 / 300);     // queda
    else if (lt < 420) y = 10 - (int16_t)((lt - 300) * 4 / 120);// quique
    else if (lt < 540) y = 6 + (int16_t)((lt - 420) * 4 / 120);
    else               y = 10;
    char c[2] = { mini[i], 0 };
    printAt(40 + i * 12, y, c, 2);
  }

  // "ARCADE": desliza da direita
  if (t > 700) {
    int32_t lt = t - 700;
    int16_t x = 28;
    if (lt < 400) x = 28 + (int16_t)((400 - lt) * 100 / 400);
    printAt(x, 30, "ARCADE", 2);
  }

  // Brilho passando sobre o titulo
  if (t > 1200 && t < 1800) {
    int16_t sx = (int16_t)((t - 1200) * 150 / 600) - 10;
    for (uint8_t k = 0; k < 6; k++)
      display.drawLine(sx + k, 8, sx + k - 10, 46, C_INV);
  }

  // Moldura que se desenha
  if (t > 1100) {
    int16_t w = (int16_t)min((uint32_t)SCREEN_W, (t - 1100) * SCREEN_W / 400);
    display.drawFastHLine(0, 0, w, C_WHITE);
    display.drawFastHLine(SCREEN_W - w, 50, w, C_WHITE);
  }
  if (t > 1600) printCentered(54, "ESP32  EDITION");
  display.display();
}

// ============================================================================
//  MENU
// ============================================================================
void menu() {
  if (joy.upEv || joy.downEv) menuSel ^= 1;  // apenas 2 opcoes: alterna
  if (joy.btnPressed) {
    changeState(menuSel == 0 ? ST_DINO : ST_PONG);
    return;
  }
  // Animacao suave do seletor
  float target = 14 + menuSel * 22;
  menuSelY += (target - menuSelY) * 0.35f;
  if (fabsf(target - menuSelY) < 0.3f) menuSelY = target;
  drawMenu();
}

void drawMenuPongIcon(int16_t x, int16_t y) {
  // Mini campo animado 22x17
  display.drawRect(x, y, 22, 17, C_INV);
  for (int16_t yy = y + 2; yy < y + 15; yy += 3) display.drawPixel(x + 11, yy, C_INV);
  float ph = frameCount * 0.12f;
  int16_t bxI = x + 3 + (int16_t)((sinf(ph) * 0.5f + 0.5f) * 14);
  int16_t byI = y + 2 + (int16_t)((sinf(ph * 1.7f) * 0.5f + 0.5f) * 11);
  int16_t lp  = constrain(byI - 3, y + 1, y + 10);
  int16_t rp  = constrain(byI - 2, y + 1, y + 10);
  display.fillRect(x + 2, lp, 1, 6, C_INV);
  display.fillRect(x + 19, rp, 1, 6, C_INV);
  display.fillRect(bxI, byI, 2, 2, C_INV);
}

void drawMenu() {
  char buf[22];
  display.clearDisplay();

  // Cabecalho
  display.fillRect(0, 0, SCREEN_W, 11, C_WHITE);
  printCentered(2, "MINI ARCADE", 1, C_BLACK);
  // Estrelinhas piscando nas laterais
  for (uint8_t s = 0; s < 2; s++) {
    int16_t sx = s ? SCREEN_W - 12 : 9;
    bool big = ((frameCount / 8) + s) % 2;
    display.drawPixel(sx, 5, C_BLACK);
    if (big) {
      display.drawPixel(sx - 1, 5, C_BLACK); display.drawPixel(sx + 1, 5, C_BLACK);
      display.drawPixel(sx, 4, C_BLACK);     display.drawPixel(sx, 6, C_BLACK);
    }
  }

  // Seletor (desenhado antes, os itens usam cor INVERSA por cima)
  int16_t sy = (int16_t)(menuSelY + 0.5f);
  display.fillRoundRect(2, sy, SCREEN_W - 4, 21, 4, C_WHITE);

  // Item 0: DINO RUN
  int16_t y0 = 14;
  const uint8_t *dino = ((frameCount / 4) % 2) ? DINO_RUN1 : DINO_RUN2;
  display.drawBitmap(8, y0 + 1, dino, DINO_RUN1_W, DINO_RUN1_H, C_INV);
  printAt(34, y0 + 3, "DINO RUN", 1, C_INV);
  snprintf(buf, sizeof(buf), "RECORDE %05lu", (unsigned long)dinoHi);
  printAt(34, y0 + 12, buf, 1, C_INV);

  // Item 1: PONG
  int16_t y1 = 36;
  drawMenuPongIcon(7, y1 + 2);
  printAt(34, y1 + 3, "PONG", 1, C_INV);
  snprintf(buf, sizeof(buf), "VIT %u RALLY %u", pongWins, pongBestRally);
  printAt(34, y1 + 12, buf, 1, C_INV);

  // Seta animada indicando a opcao atual
  int16_t ay = 14 + menuSel * 22 + 7;
  int16_t ax = 119 + ((frameCount / 5) % 2);
  display.fillTriangle(ax, ay, ax, ay + 6, ax + 3, ay + 3, C_INV);

  // Rodape
  if (blink(600)) printCentered(57, "CLIQUE PARA JOGAR");
  else            printCentered(57, "CIMA/BAIXO: ESCOLHA");
  display.display();
}

// ============================================================================
//  DINO RUN
// ============================================================================
void dinoResetWorld() {
  for (uint8_t i = 0; i < MAX_OBST; i++) obst[i].active = false;
  for (uint8_t i = 0; i < MAX_CLOUDS; i++) {
    clouds[i].x = 20 + i * 48 + random(0, 20);
    clouds[i].y = 10 + random(0, 18);
  }
  for (uint8_t i = 0; i < MAX_PEBBLES; i++) {
    pebbles[i].x = random(0, SCREEN_W);
    pebbles[i].y = GROUND_LINE + 2 + random(0, 3);
    pebbles[i].len = 1 + random(0, 3);
    pebbles[i].kind = random(0, 5) == 0 ? 1 : 0;
  }
  dDy = 0; dVy = 0;
  dOnGround = true;
  dDucking = false;
  dSpeed = 2.8f;
  dDistance = 0;
  dScore = 0;
  dJumpBuffer = 0;
  dNewRecord = false;
  dNight = false;
  dFlash = 0;
  dShake = 0;
  dMilestoneFrames = 0;
  dNextSpawn = 60;
  display.invertDisplay(false);
}

void dinoInit() {
  dState = D_READY;
  dinoResetWorld();
}

static inline void setRect(int16_t *r, int x, int y, int w, int h) {
  r[0] = (int16_t)x; r[1] = (int16_t)y; r[2] = (int16_t)w; r[3] = (int16_t)h;
}

// Retorna os retangulos de colisao do dinossauro (ate 3)
uint8_t dinoHitboxes(int16_t r[][4]) {
  if (dDucking) {
    int16_t top = GROUND_LINE - DINO_DUCK1_H;
    setRect(r[0], DINO_X + 1,  top + 1, 20, 6);   // corpo
    setRect(r[1], DINO_X + 18, top,     7,  4);   // cabeca
    setRect(r[2], DINO_X + 4,  top + 7, 6,  3);   // pernas
  } else {
    int16_t top = GROUND_LINE - DINO_RUN1_H - (int16_t)dDy;
    setRect(r[0], DINO_X + 12, top + 1,  7,  4);  // cabeca
    setRect(r[1], DINO_X + 2,  top + 7,  12, 7);  // corpo
    setRect(r[2], DINO_X + 5,  top + 14, 6,  4);  // pernas
  }
  return 3;
}

// Retorna os retangulos de colisao de um obstaculo (ate 3)
uint8_t obstacleHitboxes(const Obstacle &o, int16_t r[][4]) {
  int16_t ox = (int16_t)o.x;
  if (o.type == OB_BIRD) {
    r[0][0] = ox + 2; r[0][1] = o.y + 4; r[0][2] = 18; r[0][3] = 4;
    return 1;
  }
  uint8_t n = 0;
  for (uint8_t k = 0; k < 3; k++) {
    int8_t off = CACTUS_OFF[o.type][k];
    if (off < 0) break;
    if (CACTUS_KIND[o.type][k] == 0) {
      r[n][0] = ox + off + 1; r[n][1] = GROUND_LINE - CACTUS_S_H + 2;
      r[n][2] = 6;            r[n][3] = CACTUS_S_H - 1;
    } else {
      r[n][0] = ox + off + 1; r[n][1] = GROUND_LINE - CACTUS_L_H + 2;
      r[n][2] = 9;            r[n][3] = CACTUS_L_H - 1;
    }
    n++;
  }
  return n;
}

void dinoSpawnObstacle() {
  int8_t slot = -1;
  for (uint8_t i = 0; i < MAX_OBST; i++) if (!obst[i].active) { slot = i; break; }
  if (slot < 0) return;
  Obstacle &o = obst[slot];

  // Variedade aumenta com a pontuacao
  uint8_t pool[8]; uint8_t n = 0;
  pool[n++] = OB_CS; pool[n++] = OB_CL;
  if (dScore > 80)  { pool[n++] = OB_CS2; }
  if (dScore > 200) { pool[n++] = OB_CL2; pool[n++] = OB_BIRD; }
  if (dScore > 450) { pool[n++] = OB_CS3; pool[n++] = OB_BIRD; }
  o.type = pool[random(0, n)];
  o.x = SCREEN_W + 2;
  o.active = true;
  if (o.type == OB_BIRD) {
    o.w = BIRD1_W;
    uint8_t h = random(0, dScore > 450 ? 3 : 2);
    o.y = (h == 0) ? 45 : (h == 1 ? 36 : 22);   // baixo / medio / alto
  } else {
    o.w = CACTUS_GW[o.type];
    o.y = 0;
  }
  // Espaco ate o proximo obstaculo depende da velocidade (sempre e possivel pular)
  dNextSpawn = o.w + dSpeed * 30.0f + 22.0f + random(0, (long)(dSpeed * 22.0f));
}

void dinoGameOver() {
  dState = D_OVER;
  dOverMs = millis();
  dFlash = 3;
  dShake = 8;
  for (uint8_t i = 0; i < 10; i++)
    spawnParticle(DINO_X + 14, GROUND_LINE - 12 - dDy, frand(-1.5f, 1.5f), frand(-2.5f, -0.5f), 18);
  if (dScore > dinoHi) {
    dinoHi = dScore;
    dNewRecord = true;
    saveRecords();
  }
}

void dinoUpdatePlay() {
  // ---------------- Entrada ----------------
  if (joy.btnPressed || (joy.up && joy.upEv)) dJumpBuffer = 5;  // buffer de pulo
  bool wantDuck = joy.down;

  // ---------------- Fisica do dinossauro ----------------
  if (dOnGround) {
    dDucking = wantDuck;
    if (dJumpBuffer > 0 && !dDucking) {
      dVy = DINO_JUMP_V;
      dOnGround = false;
      dJumpBuffer = 0;
      for (uint8_t i = 0; i < 3; i++)
        spawnParticle(DINO_X + 6, GROUND_LINE - 1, frand(-1.2f, -0.3f), frand(-0.8f, -0.2f), 8);
    }
  } else {
    dDucking = false;
  }
  if (dJumpBuffer > 0) dJumpBuffer--;

  if (!dOnGround) {
    dDy += dVy;
    dVy -= DINO_GRAVITY;
    // Pulo variavel: soltar cedo = pulo mais baixo
    if (!joy.btn && !joy.up && dVy > 2.0f) dVy = 2.0f;
    // Queda rapida segurando para baixo
    if (wantDuck) dVy -= 0.8f;
    if (dDy <= 0) {
      dDy = 0; dVy = 0;
      dOnGround = true;
      for (uint8_t i = 0; i < 4; i++)
        spawnParticle(DINO_X + 4 + random(0, 12), GROUND_LINE - 1, frand(-1.5f, 0.5f), frand(-1.0f, -0.3f), 7);
    }
  }

  // ---------------- Mundo ----------------
  dSpeed = 2.8f + min(dScore, (uint32_t)1500) * 0.0025f;
  dDistance += dSpeed;
  uint32_t newScore = (uint32_t)(dDistance / 6.0f);
  if (newScore / 100 != dScore / 100 && newScore > 0) dMilestoneFrames = 45;
  dScore = newScore;
  if (dMilestoneFrames) dMilestoneFrames--;

  // Ciclo dia/noite: a cada 500 pontos alterna
  bool night = ((dScore / 500) % 2) == 1;
  if (night != dNight) { dNight = night; display.invertDisplay(dNight); }

  for (uint8_t i = 0; i < MAX_CLOUDS; i++) {
    clouds[i].x -= dSpeed * 0.25f;
    if (clouds[i].x < -CLOUD_W) {
      clouds[i].x = SCREEN_W + random(0, 40);
      clouds[i].y = 10 + random(0, 18);
    }
  }
  for (uint8_t i = 0; i < MAX_PEBBLES; i++) {
    pebbles[i].x -= dSpeed;
    if (pebbles[i].x < -4) {
      pebbles[i].x = SCREEN_W + random(0, 20);
      pebbles[i].y = GROUND_LINE + 2 + random(0, 3);
      pebbles[i].len = 1 + random(0, 3);
      pebbles[i].kind = random(0, 5) == 0 ? 1 : 0;
    }
  }

  dNextSpawn -= dSpeed;
  if (dNextSpawn <= 0) dinoSpawnObstacle();

  // ---------------- Obstaculos + colisao ----------------
  int16_t dr[3][4];
  uint8_t dn = dinoHitboxes(dr);
  for (uint8_t i = 0; i < MAX_OBST; i++) {
    Obstacle &o = obst[i];
    if (!o.active) continue;
    o.x -= (o.type == OB_BIRD) ? dSpeed + 0.6f : dSpeed;
    if (o.x + o.w < 0) { o.active = false; continue; }
    int16_t orr[3][4];
    uint8_t on = obstacleHitboxes(o, orr);
    for (uint8_t a = 0; a < dn; a++)
      for (uint8_t b = 0; b < on; b++)
        if (rectOverlap(dr[a][0], dr[a][1], dr[a][2], dr[a][3],
                        orr[b][0], orr[b][1], orr[b][2], orr[b][3])) {
          dinoGameOver();
          return;
        }
  }
  updateParticles(0.15f);
}

void dinoGame() {
  uint32_t now = millis();
  switch (dState) {
    case D_READY:
      if (joy.leftEv) { changeState(ST_MENU); return; }
      if (joy.btnPressed || joy.upEv) {
        dinoResetWorld();
        dState = D_PLAY;
        dJumpBuffer = 5;  // ja comeca pulando
      }
      updateParticles(0.15f);
      break;

    case D_PLAY:
      if (exitHoldTriggered()) { changeState(ST_MENU); return; }
      dinoUpdatePlay();
      break;

    case D_OVER:
      updateParticles(0.15f);
      if (now - dOverMs > 500) {
        if (joy.leftEv) { changeState(ST_MENU); return; }
        if (joy.btnPressed || joy.upEv) {
          dinoResetWorld();
          clearParticles();
          dState = D_PLAY;
          dJumpBuffer = 5;
        }
      }
      break;
  }
  drawDino();
}

void drawDinoSprite(int16_t ox, int16_t oy) {
  const uint8_t *bmp;
  if (dState == D_OVER) {
    int16_t top = GROUND_LINE - DINO_DEAD_H - (int16_t)dDy;
    display.drawBitmap(DINO_X + ox, top + oy, DINO_DEAD, DINO_DEAD_W, DINO_DEAD_H, C_WHITE);
    return;
  }
  if (dState == D_READY) {
    // Parado, piscando os olhos de vez em quando
    bool blinkEye = (frameCount % 90) < 4;
    bmp = blinkEye ? DINO_BLINK : DINO_JUMP;
    display.drawBitmap(DINO_X + ox, GROUND_LINE - DINO_RUN1_H + oy, bmp, DINO_RUN1_W, DINO_RUN1_H, C_WHITE);
    return;
  }
  uint8_t stepDiv = (uint8_t)max(2, 5 - (int)(dSpeed / 2.0f));
  bool alt = (frameCount / stepDiv) % 2;
  if (dDucking) {
    bmp = alt ? DINO_DUCK1 : DINO_DUCK2;
    display.drawBitmap(DINO_X + ox, GROUND_LINE - DINO_DUCK1_H + oy, bmp, DINO_DUCK1_W, DINO_DUCK1_H, C_WHITE);
  } else {
    bmp = dOnGround ? (alt ? DINO_RUN1 : DINO_RUN2) : DINO_JUMP;
    int16_t top = GROUND_LINE - DINO_RUN1_H - (int16_t)dDy;
    display.drawBitmap(DINO_X + ox, top + oy, bmp, DINO_RUN1_W, DINO_RUN1_H, C_WHITE);
  }
}

void drawObstacle(const Obstacle &o, int16_t ox, int16_t oy) {
  int16_t x = (int16_t)o.x + ox;
  if (o.type == OB_BIRD) {
    bool up = (frameCount / 7) % 2;
    if (up) display.drawBitmap(x, o.y + oy, BIRD1, BIRD1_W, BIRD1_H, C_WHITE);
    else    display.drawBitmap(x, o.y + oy, BIRD2, BIRD2_W, BIRD2_H, C_WHITE);
    return;
  }
  for (uint8_t k = 0; k < 3; k++) {
    int8_t off = CACTUS_OFF[o.type][k];
    if (off < 0) break;
    if (CACTUS_KIND[o.type][k] == 0)
      display.drawBitmap(x + off, GROUND_LINE - CACTUS_S_H + 1 + oy, CACTUS_S, CACTUS_S_W, CACTUS_S_H, C_WHITE);
    else
      display.drawBitmap(x + off, GROUND_LINE - CACTUS_L_H + 1 + oy, CACTUS_L, CACTUS_L_W, CACTUS_L_H, C_WHITE);
  }
}

void drawDino() {
  char buf[24];
  int8_t ox = 0, oy = 0;
  if (dShake) { ox = random(-2, 3); oy = random(-1, 2); dShake--; }

  display.clearDisplay();

  // Lua e estrelas a noite
  if (dNight) {
    display.fillCircle(16 + ox, 12 + oy, 6, C_WHITE);
    display.fillCircle(19 + ox, 10 + oy, 5, C_BLACK);
    for (uint8_t i = 0; i < 6; i++) {
      int16_t sx = (int16_t)(i * 23 + 40 - (dDistance * 0.05f)) % SCREEN_W;
      if (sx < 0) sx += SCREEN_W;
      display.drawPixel(sx, 12 + (i * 7) % 20, C_WHITE);
    }
  }

  // Nuvens (parallax) - ocultas na tela inicial para nao cobrir o texto
  if (dState != D_READY) for (uint8_t i = 0; i < MAX_CLOUDS; i++)
    display.drawBitmap((int16_t)clouds[i].x + ox, clouds[i].y + oy, CLOUD, CLOUD_W, CLOUD_H, C_WHITE);

  // Chao com textura
  display.drawFastHLine(0, GROUND_LINE + oy, SCREEN_W, C_WHITE);
  for (uint8_t i = 0; i < MAX_PEBBLES; i++) {
    int16_t px = (int16_t)pebbles[i].x + ox;
    if (pebbles[i].kind == 1) {
      // pequena saliencia na linha do chao
      display.drawFastHLine(px, GROUND_LINE + oy, 3, C_BLACK);
      display.drawFastHLine(px, GROUND_LINE - 1 + oy, 3, C_WHITE);
    } else {
      display.drawFastHLine(px, pebbles[i].y + oy, pebbles[i].len, C_WHITE);
    }
  }

  for (uint8_t i = 0; i < MAX_OBST; i++)
    if (obst[i].active) drawObstacle(obst[i], ox, oy);

  drawParticles(ox, oy);
  drawDinoSprite(ox, oy);

  // HUD
  if (dState != D_READY) {
    bool showScore = !dMilestoneFrames || ((dMilestoneFrames / 5) % 2 == 0);
    snprintf(buf, sizeof(buf), "HI %05lu", (unsigned long)dinoHi);
    printAt(SCREEN_W - 6 * 15, 0, buf);
    if (showScore) {
      snprintf(buf, sizeof(buf), "%05lu", (unsigned long)dScore);
      printAt(SCREEN_W - 6 * 5 + 1, 0, buf);
    }
  }

  if (dState == D_READY) {
    printCentered(3, "DINO RUN", 2);
    snprintf(buf, sizeof(buf), "RECORDE %05lu", (unsigned long)dinoHi);
    printCentered(21, buf);
    if (blink(1500)) {
      if (blink(300)) printAt(34, 34, "CLIQUE P/ PULAR");
    } else {
      printAt(34, 34, "BAIXO: ABAIXAR");
    }
    printAt(34, 46, "< MENU");
  }

  if (dState == D_OVER) {
    display.fillRect(10, 11, 108, 38, C_BLACK);
    display.drawRect(10, 11, 108, 38, C_WHITE);
    display.drawRect(12, 13, 104, 34, C_WHITE);
    printCentered(16, "GAME OVER", 2);
    if (dNewRecord && blink(250)) {
      printCentered(33, "NOVO RECORDE!");
    } else if (!dNewRecord) {
      snprintf(buf, sizeof(buf), "PONTOS %05lu", (unsigned long)dScore);
      printCentered(33, buf);
    }
    if (millis() - dOverMs > 500) {
      // Icone de "jogar de novo" e dica de menu
      display.fillRect(14, 50, 100, 9, C_BLACK);
      printCentered(51, blink(700) ? "CLIQUE: DE NOVO" : "ESQUERDA: MENU");
    }
  }

  if (dFlash) { display.fillRect(0, 0, SCREEN_W, SCREEN_H, C_INV); dFlash--; }
  drawExitBar();
  display.display();
}

// ============================================================================
//  PONG
// ============================================================================
void pongResetBall() {
  bx = (SCREEN_W - BALL_S) / 2.0f;
  by = (SCREEN_H - BALL_S) / 2.0f;
  bvx = bvy = 0;
  for (uint8_t i = 0; i < TRAIL_LEN; i++) { trailX[i] = -10; trailY[i] = -10; }
  trailHead = 0;
}

void pongNewMatch() {
  s1 = s2 = 0;
  pLevel = 1;
  pRally = 0;
  pMatchBestRally = 0;
  p1y = p2y = (SCREEN_H - PADDLE_H) / 2.0f;
  p1v = p2v = 0;
  aiOffset = 0;
  p1Flash = p2Flash = 0;
  pShake = 0;
  pPop1 = pPop2 = 0;
  pLevelUp = false;
  pServeDir = (random(0, 2) == 0) ? -1 : 1;
  pongResetBall();
  clearParticles();
}

void pongInit() {
  pongNewMatch();
  pState = P_READY;
  pStateMs = millis();
  demoBx = 40; demoBy = 30; demoVx = 1.6f; demoVy = 1.1f;
}

void pongSetState(PongState s) {
  pState = s;
  pStateMs = millis();
}

float pongPredictY() {
  // Preve onde a bola chegara na raquete da IA, considerando os quiques
  if (bvx <= 0.01f) return SCREEN_H / 2.0f;
  float t = ((P2_X - BALL_S) - bx) / bvx;
  float y = by + bvy * t - BALL_MIN_Y;
  float range = (float)(BALL_MAX_Y - BALL_MIN_Y);
  float m = fmodf(y, 2 * range);
  if (m < 0) m += 2 * range;
  if (m > range) m = 2 * range - m;
  return m + BALL_MIN_Y + BALL_S / 2.0f;
}

void pongPaddleHit(bool player) {
  float py   = player ? p1y : p2y;
  float pv   = player ? p1v : p2v;
  float rel  = ((by + BALL_S / 2.0f) - (py + PADDLE_H / 2.0f)) / (PADDLE_H / 2.0f + 1);
  rel = constrain(rel, -1.0f, 1.0f);
  float ang  = rel * 1.05f;                       // ate ~60 graus
  bSpeed = min(bSpeed * 1.06f, BALL_MAX_SPD);
  float dir = player ? 1.0f : -1.0f;
  bvx = dir * bSpeed * cosf(ang);
  bvy = bSpeed * sinf(ang) + pv * 0.2f;
  if (fabsf(bvx) < 1.3f) bvx = dir * 1.3f;

  // Efeitos
  float cx = player ? (P1_X + PADDLE_W) : (P2_X - 1);
  for (uint8_t i = 0; i < 6; i++)
    spawnParticle(cx, by + 1, dir * frand(0.5f, 2.2f), frand(-1.6f, 1.6f), 10 + random(0, 6));
  if (player) { p1Flash = 4; pRally++; } else { p2Flash = 4; }
  if (pRally > pMatchBestRally) pMatchBestRally = pRally;

  // Erro da IA para a proxima defesa: diminui com o nivel
  if (player) {
    float err = max(2.0f, 15.0f - pLevel * 2.0f);
    aiOffset = frand(-err, err);
  }
}

void pongScore(bool playerScored) {
  if (playerScored) { s1++; pPop1 = 10; } else { s2++; pPop2 = 10; }
  pLastPointPlayer = playerScored;
  pShake = 10;
  pRally = 0;
  // Explosao de particulas onde a bola saiu
  float ex = playerScored ? SCREEN_W - 2 : 1;
  for (uint8_t i = 0; i < 14; i++)
    spawnParticle(ex, by + 1, (playerScored ? -1 : 1) * frand(0.3f, 2.8f), frand(-2.2f, 2.2f), 14 + random(0, 10));
  uint8_t newLevel = min(7, 1 + (s1 + s2) / 2);
  pLevelUp = newLevel > pLevel;
  pLevel = newLevel;
  pServeDir = playerScored ? 1 : -1;  // saca em direcao a quem perdeu o ponto
  pongResetBall();
  pongSetState(P_POINT);
}

void pongFinishMatch(bool playerWon) {
  if (playerWon) pongWins++; else pongLosses++;
  if (pMatchBestRally > pongBestRally) pongBestRally = pMatchBestRally;
  saveRecords();
  clearParticles();
  pongSetState(playerWon ? P_WIN : P_LOSE);
}

void pongUpdatePlayer() {
  float target = (joy.y / 100.0f) * PLAYER_SPEED;
  p1v = p1v * 0.35f + target * 0.65f;
  p1y += p1v;
  if (p1y < 1) { p1y = 1; p1v = 0; }
  if (p1y > SCREEN_H - 1 - PADDLE_H) { p1y = SCREEN_H - 1 - PADDLE_H; p1v = 0; }
}

void pongUpdateAI() {
  float aiSpeed = 1.3f + pLevel * 0.3f;
  float reactX  = 70.0f - pLevel * 8.0f;
  float target;
  if (bvx > 0 && bx > reactX) target = pongPredictY() + aiOffset - PADDLE_H / 2.0f;
  else                        target = (SCREEN_H - PADDLE_H) / 2.0f;
  float diff = target - p2y;
  float mv = constrain(diff, -aiSpeed, aiSpeed);
  if (fabsf(diff) < 1.0f) mv = 0;
  p2v = mv;
  p2y += mv;
  if (p2y < 1) p2y = 1;
  if (p2y > SCREEN_H - 1 - PADDLE_H) p2y = SCREEN_H - 1 - PADDLE_H;
}

void pongUpdateBall() {
  // Sub-passos evitam que a bola "atravesse" as raquetes em alta velocidade
  float m = max(fabsf(bvx), fabsf(bvy));
  uint8_t steps = (uint8_t)ceilf(m / 1.5f);
  if (steps < 1) steps = 1;
  float sx = bvx / steps, sy = bvy / steps;
  for (uint8_t i = 0; i < steps; i++) {
    bx += sx; by += sy;
    if (by < BALL_MIN_Y) { by = BALL_MIN_Y; bvy = fabsf(bvy); sy = fabsf(sy); }
    if (by > BALL_MAX_Y) { by = BALL_MAX_Y; bvy = -fabsf(bvy); sy = -fabsf(sy); }

    // Raquete do jogador (esquerda)
    if (bvx < 0 && bx <= P1_X + PADDLE_W && bx >= P1_X - 2 &&
        by + BALL_S > p1y && by < p1y + PADDLE_H) {
      bx = P1_X + PADDLE_W;
      pongPaddleHit(true);
      sx = bvx / steps; sy = bvy / steps;
    }
    // Raquete da IA (direita)
    if (bvx > 0 && bx + BALL_S >= P2_X && bx + BALL_S <= P2_X + PADDLE_W + 2 &&
        by + BALL_S > p2y && by < p2y + PADDLE_H) {
      bx = P2_X - BALL_S;
      pongPaddleHit(false);
      sx = bvx / steps; sy = bvy / steps;
    }
    if (bx < -BALL_S - 2)  { pongScore(false); return; }
    if (bx > SCREEN_W + 2) { pongScore(true);  return; }
  }
  trailX[trailHead] = (int16_t)bx + 1;
  trailY[trailHead] = (int16_t)by + 1;
  trailHead = (trailHead + 1) % TRAIL_LEN;
}

void pongGame() {
  uint32_t el = millis() - pStateMs;
  if (p1Flash) p1Flash--;
  if (p2Flash) p2Flash--;
  if (pPop1) pPop1--;
  if (pPop2) pPop2--;

  switch (pState) {
    case P_READY:
      if (joy.leftEv) { changeState(ST_MENU); return; }
      // Bola de demonstracao no fundo
      demoBx += demoVx; demoBy += demoVy;
      if (demoBx < 6 || demoBx > SCREEN_W - 9) demoVx = -demoVx;
      if (demoBy < 1 || demoBy > SCREEN_H - 4) demoVy = -demoVy;
      if (el > 300 && joy.btnPressed) { pongNewMatch(); pongSetState(P_SERVE); }
      break;

    case P_SERVE:
      if (exitHoldTriggered()) { changeState(ST_MENU); return; }
      pongUpdatePlayer();
      pongUpdateAI();
      if (el >= 1500) {
        bSpeed = 1.9f + pLevel * 0.2f;
        float ang = frand(-0.5f, 0.5f);
        bvx = pServeDir * bSpeed * cosf(ang);
        bvy = bSpeed * sinf(ang);
        pongSetState(P_PLAY);
      }
      break;

    case P_PLAY:
      if (exitHoldTriggered()) { changeState(ST_MENU); return; }
      pongUpdatePlayer();
      pongUpdateAI();
      pongUpdateBall();
      break;

    case P_POINT:
      if (exitHoldTriggered()) { changeState(ST_MENU); return; }
      pongUpdatePlayer();
      pongUpdateAI();
      if (el >= 1300) {
        if (s1 >= WIN_SCORE)      pongFinishMatch(true);
        else if (s2 >= WIN_SCORE) pongFinishMatch(false);
        else                      pongSetState(P_SERVE);
      }
      break;

    case P_WIN:
    case P_LOSE:
      if (pState == P_WIN && random(0, 3) == 0)   // confete caindo
        spawnParticle(random(0, SCREEN_W), -2, frand(-0.4f, 0.4f), frand(0.4f, 1.2f), 60);
      if (el > 900) {
        if (joy.leftEv) { changeState(ST_MENU); return; }
        if (joy.btnPressed) { pongNewMatch(); pongSetState(P_SERVE); }
      }
      break;
  }
  updateParticles(pState == P_WIN ? 0.02f : 0.0f);
  drawPong();
}

void drawScoreDigit(uint8_t v, int16_t cx, int16_t y, uint8_t pop) {
  char b[4];
  snprintf(b, sizeof(b), "%u", v);
  uint8_t size = pop > 4 ? 3 : 2;
  int16_t w = textWidth(b, size);
  printAt(cx - w / 2, y - (size == 3 ? 2 : 0), b, size);
}

void drawPaddle(int16_t x, float y, uint8_t flash, int8_t ox, int8_t oy) {
  int16_t yy = (int16_t)(y + 0.5f) + oy;
  display.fillRect(x + ox, yy, PADDLE_W, PADDLE_H, C_WHITE);
  if (flash) display.drawRect(x - 1 + ox, yy - 1, PADDLE_W + 2, PADDLE_H + 2, C_WHITE);
}

void drawPongField(int8_t ox, int8_t oy) {
  display.drawFastHLine(0, 0 + oy, SCREEN_W, C_WHITE);
  display.drawFastHLine(0, SCREEN_H - 1 + oy, SCREEN_W, C_WHITE);
  for (int16_t y = 3; y < SCREEN_H - 2; y += 5)
    display.drawFastVLine(63 + ox, y + oy, 3, C_WHITE);
}

void drawPong() {
  char buf[24];
  uint32_t el = millis() - pStateMs;
  int8_t ox = 0, oy = 0;
  if (pShake) { ox = random(-2, 3); oy = random(-2, 3); pShake--; }

  display.clearDisplay();

  if (pState == P_READY) {
    // Fundo animado: raquetes acompanhando a bola demo
    drawPongField(0, 0);
    int16_t py = constrain((int16_t)demoBy - PADDLE_H / 2, 1, SCREEN_H - 1 - PADDLE_H);
    display.fillRect(P1_X, py, PADDLE_W, PADDLE_H, C_WHITE);
    display.fillRect(P2_X, py, PADDLE_W, PADDLE_H, C_WHITE);
    display.fillRect((int16_t)demoBx, (int16_t)demoBy, BALL_S, BALL_S, C_WHITE);
    // Painel do titulo
    display.fillRoundRect(14, 4, 100, 56, 4, C_BLACK);
    display.drawRoundRect(14, 4, 100, 56, 4, C_WHITE);
    printCentered(8, "PONG", 3);
    printCentered(33, "PRIMEIRO A 7");
    if (blink(1500)) { if (blink(300)) printCentered(43, "CLIQUE P/ JOGAR"); }
    else printCentered(43, "ESQUERDA: MENU");
    snprintf(buf, sizeof(buf), "VIT %u  DER %u", pongWins, pongLosses);
    printCentered(51, buf);
    display.display();
    return;
  }

  if (pState == P_WIN || pState == P_LOSE) {
    bool win = (pState == P_WIN);
    if (win) {
      printCentered(2, "VITORIA!", 2);
      int16_t ty = 22 + (int16_t)(sinf(frameCount * 0.25f) * 2.0f);
      display.drawBitmap(8, ty, TROPHY, TROPHY_W, TROPHY_H, C_WHITE);
      // brilhos ao redor do trofeu
      if ((frameCount / 4) % 2) { display.drawPixel(5, 24, C_WHITE); display.drawPixel(34, 30, C_WHITE); }
      else                      { display.drawPixel(33, 20, C_WHITE); display.drawPixel(6, 36, C_WHITE); }
    } else {
      int8_t gx = (el < 800 && (frameCount % 3 == 0)) ? random(-2, 3) : 0;
      printCentered(2, "DERROTA", 2);
      if (gx) display.fillRect(0, 4 + random(0, 10), SCREEN_W, 2, C_INV);   // glitch
      bool eyes = (frameCount % 40) < 34;
      display.drawBitmap(12 + gx, 24, SKULL, SKULL_W, SKULL_H, C_WHITE);
      if (eyes) {   // olhos acesos piscando
        display.drawPixel(17 + gx, 30, C_WHITE);
        display.drawPixel(22 + gx, 30, C_WHITE);
      }
    }
    snprintf(buf, sizeof(buf), "%u x %u", s1, s2);
    printAt(44, 21, buf, 2);
    snprintf(buf, sizeof(buf), "RALLY %u", pMatchBestRally);
    printAt(44, 39, buf);
    drawParticles();
    if (el > 900) {
      display.fillRect(0, 54, SCREEN_W, 10, C_BLACK);
      printCentered(55, blink(700) ? "CLIQUE: REVANCHE" : "ESQUERDA: MENU");
    }
    display.display();
    return;
  }

  // Campo de jogo
  drawPongField(ox, oy);
  drawScoreDigit(s1, 50 + ox, 4 + oy, pPop1);
  drawScoreDigit(s2, 77 + ox, 4 + oy, pPop2);
  drawPaddle(P1_X, p1y, p1Flash, ox, oy);
  drawPaddle(P2_X, p2y, p2Flash, ox, oy);

  if (pState == P_PLAY) {
    // Rastro da bola
    for (uint8_t i = 0; i < TRAIL_LEN - 1; i++) {
      uint8_t idx = (trailHead + i) % TRAIL_LEN;
      if (trailX[idx] >= 0 && (i % 2 == 1 || bSpeed > 3.5f))
        display.drawPixel(trailX[idx] + ox, trailY[idx] + oy, C_WHITE);
    }
    display.fillRect((int16_t)bx + ox, (int16_t)by + oy, BALL_S, BALL_S, C_WHITE);
    if (pRally >= 5) {
      snprintf(buf, sizeof(buf), "x%u", pRally);
      printAt(64 - textWidth(buf) / 2, 55, buf, 1, C_INV);
    }
  }

  drawParticles(ox, oy, true);

  if (pState == P_SERVE) {
    // Contagem regressiva 3-2-1
    uint8_t n = 3 - min((uint32_t)2, el / 500);
    snprintf(buf, sizeof(buf), "%u", n);
    uint32_t phase = el % 500;
    uint8_t size = phase < 120 ? 3 : 2;
    display.fillRect(52, 24, 25, 24, C_BLACK);
    printAt(64 - textWidth(buf, size) / 2, 36 - 4 * size, buf, size);
    snprintf(buf, sizeof(buf), "NIVEL %u", pLevel);
    printCentered(52, buf, 1, C_INV);
    // Bola piscando no centro, ja apontando a direcao do saque
    if (blink(150)) display.fillRect((int16_t)bx + pServeDir * 18, (int16_t)by, BALL_S, BALL_S, C_WHITE);
  }

  if (pState == P_POINT) {
    const char *msg = pLastPointPlayer ? "PONTO SEU!" : "PONTO CPU";
    int16_t w = textWidth(msg) + 8;
    display.fillRect((SCREEN_W - w) / 2, 24, w, 12, C_BLACK);
    display.drawRect((SCREEN_W - w) / 2, 24, w, 12, C_WHITE);
    printCentered(26, msg);
    if (pLevelUp && el > 500 && blink(200)) {
      snprintf(buf, sizeof(buf), "NIVEL %u!", pLevel);
      printCentered(40, buf, 1, C_INV);
    }
  }

  drawExitBar();
  display.display();
}
