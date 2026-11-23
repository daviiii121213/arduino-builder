/*
 * ============================================================================
 *  ROBÔ FOFO  —  Mascote virtual para ESP32 DevKit + OLED SSD1306 128x64 (I2C)
 * ============================================================================
 *
 *  CONEXÕES
 *    OLED  GND -> GND      | VCC -> 3V3 | SCL -> GPIO 22 | SDA -> GPIO 21
 *    Botão: um terminal -> GPIO 18, outro -> GND (INPUT_PULLUP, sem resistor)
 *
 *  BIBLIOTECAS
 *    Adafruit GFX Library, Adafruit SSD1306, Wire (já vem com o core ESP32)
 *
 *  INTERAÇÃO
 *    Toque rápido (< 0,6 s) ........ acorda (somente se estiver dormindo)
 *    Pressionar 1,2 s a 1,7 s ....... carinho
 *    Pressionar 2,0 s ou mais ....... super carinho
 *    30 s sem interação ............. cochila e dorme
 *
 *  Todo o controle de tempo usa millis(); não existe delay() no loop.
 *  O rosto é desenhado proceduralmente (pixel art gerada por código) a partir
 *  de um conjunto de parâmetros ("Face"). Cada estado define um rosto-alvo e
 *  o rosto atual se aproxima dele suavemente a cada quadro, o que gera
 *  transições reais entre todas as expressões.
 * ============================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

// ----------------------------------------------------------------------------
//  Hardware
// ----------------------------------------------------------------------------
#define SCREEN_W   128
#define SCREEN_H   64
#define OLED_ADDR  0x3C
#define PIN_SDA    21
#define PIN_SCL    22
#define PIN_BTN    18

#ifndef WHITE
#define WHITE SSD1306_WHITE
#endif
#ifndef BLACK
#define BLACK SSD1306_BLACK
#endif

Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1, 400000UL, 400000UL);

// ----------------------------------------------------------------------------
//  Tempos (ms)
// ----------------------------------------------------------------------------
const uint32_t DEBOUNCE_MS      = 25;
const uint32_t TAP_MAX_MS       = 600;    // toque rápido
const uint32_t PET_MIN_MS       = 1200;   // carinho
const uint32_t PET_MAX_MS       = 1700;
const uint32_t SUPER_MIN_MS     = 2000;   // super carinho
const uint32_t HOLD_FEEDBACK_MS = 300;    // começa a reagir enquanto segura
const uint32_t SLEEP_TIMEOUT_MS = 30000;  // 30 s sem interação -> dormir
const uint32_t FRAME_MS         = 30;     // ~33 quadros por segundo

// Duração das animações (s)
const float WAKE_DUR   = 2.8f;
const float DROWSY_DUR = 3.6f;
const float PET_DUR    = 3.8f;
const float SUPER_DUR  = 5.8f;

// ----------------------------------------------------------------------------
//  Geometria do rosto
// ----------------------------------------------------------------------------
const int L_EYE_X   = 36;
const int R_EYE_X   = 92;
const int EYE_Y     = 26;
const float EYE_RX  = 13.0f;
const float EYE_RY  = 15.0f;
const float PUPIL_R = 9.5f;
const int MOUTH_X   = 64;
const int MOUTH_Y   = 50;
const int CHEEK_L_X = 20;
const int CHEEK_R_X = 108;
const int CHEEK_Y   = 46;

const float FAST_SPEED = 18.0f;           // velocidade do olhar / deslocamentos

// ----------------------------------------------------------------------------
//  Parâmetros do rosto
// ----------------------------------------------------------------------------
struct Face {
  float open;        // abertura das pálpebras 0..1
  float happy;       // olhos de "lua" felizes (^ ^) 0..1
  float scale;       // tamanho dos olhos
  float pupil;       // tamanho da pupila
  float lookX;       // direção do olhar -1..1
  float lookY;
  float shine;       // brilho estrelado nas pupilas 0..1
  float blush;       // bochechas 0..1
  float smile;       // curvatura da boca -1..1
  float mouthOpen;   // abertura da boca 0..1
  float mouthRound;  // 0 = boca em "D", 1 = boca em "o"
  float mouthW;      // meia-largura da boca (px)
  float brow;        // sobrancelhas de surpresa 0..1
  float ox;          // deslocamento do rosto inteiro
  float oy;
};

Face faceNormal() {
  Face f;
  f.open = 1;  f.happy = 0;  f.scale = 1;  f.pupil = 1;
  f.lookX = 0; f.lookY = 0;  f.shine = 0;  f.blush = 0;
  f.smile = 0.8f; f.mouthOpen = 0; f.mouthRound = 0; f.mouthW = 6;
  f.brow = 0;  f.ox = 0;  f.oy = 0;
  return f;
}

Face faceSleep() {
  Face f = faceNormal();
  f.open = 0;
  f.smile = 0;
  f.mouthOpen = 0.3f;
  f.mouthRound = 1;
  f.mouthW = 3;
  return f;
}

Face cur;                 // rosto exibido
Face tgt;                 // rosto-alvo
float faceSpeed = 8.0f;   // velocidade da transição atual

// ----------------------------------------------------------------------------
//  Máquina de estados
// ----------------------------------------------------------------------------
enum RobotState : uint8_t {
  ST_SLEEPING,
  ST_WAKING,
  ST_AWAKE,
  ST_DROWSY,
  ST_PETTING,
  ST_SUPER
};

const char* STATE_NAMES[] = { "DORMINDO", "ACORDANDO", "ACORDADO",
                              "COCHILANDO", "CARINHO", "SUPER CARINHO" };

RobotState state = ST_SLEEPING;
uint32_t stateStart = 0;
uint8_t  stageFlags = 0;       // marcadores de eventos únicos dentro de um estado
uint32_t lastInteraction = 0;

// ----------------------------------------------------------------------------
//  Botão
// ----------------------------------------------------------------------------
bool     btnRaw = false;
bool     btnStable = false;    // true = pressionado
uint32_t btnLastChange = 0;
uint32_t pressStart = 0;

// ----------------------------------------------------------------------------
//  Piscar e comportamento ocioso
// ----------------------------------------------------------------------------
bool     blinking = false;
uint32_t blinkStart = 0;
uint32_t nextBlinkAt = 0;
bool     doubleBlinkQueued = false;
const uint32_t BLINK_CLOSE_MS = 80, BLINK_HOLD_MS = 40, BLINK_OPEN_MS = 120;

float    gazeX = 0, gazeY = 0;
uint32_t nextGazeAt = 0;
uint8_t  microType = 0;
uint32_t microStart = 0, microUntil = 0, nextMicroAt = 0;

// ----------------------------------------------------------------------------
//  Efeitos: corações, "Zzz", notas musicais, brilhos, exclamação
// ----------------------------------------------------------------------------
struct Heart {
  bool active;
  float x0, y, vy, age, amp, freq, phase;
  uint8_t size;               // 0 = pequeno, 1 = médio, 2 = grande
};
const int MAX_HEARTS = 22;
Heart hearts[MAX_HEARTS];
uint32_t nextHeartAt = 0;

enum FloatyType : uint8_t { FL_Z, FL_NOTE };
struct Floaty {
  bool active;
  uint8_t type;
  float x, y, age, life;
};
const int MAX_FLOATIES = 6;
Floaty floaties[MAX_FLOATIES];
uint32_t nextZAt = 0;

float sparkleLevel = 0, sparkleTarget = 0;
const int8_t SPARKLES[][2] = {
  {6, 6}, {122, 7}, {4, 31}, {124, 30}, {9, 58}, {119, 57}, {64, 4}, {42, 60}, {86, 60}
};
const int NUM_SPARKLES = sizeof(SPARKLES) / sizeof(SPARKLES[0]);

bool     exclaimOn = false;
uint32_t exclaimStart = 0;

float animClock = 0;          // relógio contínuo para oscilações (s)

// Bitmaps dos corações (bit mais significativo = pixel da esquerda)
const uint16_t HEART_S[] = { 0b01010, 0b11111, 0b01110, 0b00100 };
const uint16_t HEART_M[] = { 0b0110110, 0b1111111, 0b1111111,
                             0b0111110, 0b0011100, 0b0001000 };
const uint16_t HEART_L[] = { 0b011101110, 0b111111111, 0b111111111, 0b111111111,
                             0b011111110, 0b001111100, 0b000111000, 0b000010000 };

// ============================================================================
//  Utilidades
// ============================================================================
static inline float clamp01(float v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
static inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
static inline float smooth01(float t) { t = clamp01(t); return t * t * (3 - 2 * t); }
static inline bool reached(uint32_t now, uint32_t at) { return (int32_t)(now - at) >= 0; }
static inline int iround(float v) { return (int)lroundf(v); }
static inline float frand(float a, float b) { return a + (b - a) * (random(10001) / 10000.0f); }

bool isHeld() { return btnStable; }
uint32_t holdMs(uint32_t now) { return btnStable ? (now - pressStart) : 0; }

// ============================================================================
//  Primitivas de desenho
// ============================================================================

// Elipse preenchida simétrica em torno de um centro inteiro.
void fillEllipseI(int cx, int cy, float rx, float ry, uint16_t c) {
  if (rx < 0.6f || ry < 0.6f) { display.drawPixel(cx, cy, c); return; }
  int R = (int)ry;
  for (int dy = -R; dy <= R; dy++) {
    float t = dy / (ry + 0.5f);
    float w = rx * sqrtf(fmaxf(0.0f, 1.0f - t * t));
    int hw = (int)(w + 0.45f);      // 0.45 evita "dentes" quando o raio é x,5
    display.drawFastHLine(cx - hw, cy + dy, 2 * hw + 1, c);
  }
}

// Curva parabólica simétrica: y = y0 + depth * (1 - u²), u em [-1, 1].
// depth > 0 -> "‿" (meio para baixo); depth < 0 -> "⌒" (meio para cima).
void drawCurve(int cx, int y0, float halfW, float depth, int thick, uint16_t c) {
  int hw = (int)(halfW + 0.5f);
  if (hw < 1) { for (int k = 0; k < thick; k++) display.drawPixel(cx, y0 + iround(depth) + k, c); return; }
  int px = 0, py = 0;
  for (int x = -hw; x <= hw; x++) {
    float u = (float)x / hw;
    int y = y0 + iround(depth * (1 - u * u));
    for (int k = 0; k < thick; k++) {
      if (x == -hw) display.drawPixel(cx + x, y + k, c);
      else          display.drawLine(cx + px, py + k, cx + x, y + k, c);
    }
    px = x; py = y;
  }
}

// Brilho em forma de estrela de 4 pontas.
void drawStar(int x, int y, int arm, uint16_t c) {
  display.drawPixel(x, y, c);
  for (int i = 1; i <= arm; i++) {
    display.drawPixel(x + i, y, c); display.drawPixel(x - i, y, c);
    display.drawPixel(x, y + i, c); display.drawPixel(x, y - i, c);
  }
}

void drawRows(int x, int y, const uint16_t* rows, int w, int h, uint16_t c) {
  for (int r = 0; r < h; r++)
    for (int col = 0; col < w; col++)
      if (rows[r] & (1u << (w - 1 - col))) display.drawPixel(x + col, y + r, c);
}

// Coração com contorno preto (fica visível mesmo sobre os olhos brancos).
void drawHeartShape(int cx, int cy, uint8_t size) {
  const uint16_t* rows; int w, h;
  if (size == 0)      { rows = HEART_S; w = 5; h = 4; }
  else if (size == 1) { rows = HEART_M; w = 7; h = 6; }
  else                { rows = HEART_L; w = 9; h = 8; }
  int x = cx - w / 2, y = cy - h / 2;
  drawRows(x - 1, y, rows, w, h, BLACK);
  drawRows(x + 1, y, rows, w, h, BLACK);
  drawRows(x, y - 1, rows, w, h, BLACK);
  drawRows(x, y + 1, rows, w, h, BLACK);
  drawRows(x, y, rows, w, h, WHITE);
  if (size == 2) display.drawPixel(x + 2, y + 2, BLACK);   // reflexo fofo
}

// ============================================================================
//  Partes do rosto
// ============================================================================

bool insideEllipse(int x, int y, int cx, int cy, float rx, float ry) {
  float t = (y - cy) / (ry + 0.5f);
  if (t <= -1 || t >= 1) return false;
  return fabsf((float)(x - cx)) <= rx * sqrtf(1 - t * t) + 0.5f;
}

void drawClosedEye(int cx, int cy, float rx, float ry, int side) {
  int y0 = cy + iround(ry * 0.55f);
  drawCurve(cx, y0, rx - 1, 3.0f, 2, WHITE);              // "‿"
  int hw = (int)(rx - 1 + 0.5f);
  int xe = cx + side * hw;                                // canto externo
  display.drawLine(xe, y0, xe + side * 2, y0 - 2, WHITE); // cílio
}

void drawEye(int cx, int cy, const Face& f, float openEff, int side) {
  float rx = EYE_RX * f.scale, ry = EYE_RY * f.scale;
  float happy = clamp01(f.happy);
  float lid = fmaxf(clamp01(openEff), happy);

  if (lid < 0.08f) { drawClosedEye(cx, cy, rx, ry, side); return; }

  // Globo do olho
  fillEllipseI(cx, cy, rx, ry, WHITE);

  // Pupila + reflexos (a pupila some quando o olho vira "lua feliz")
  float pr = PUPIL_R * f.scale * f.pupil * clamp01(1 - happy * 2.0f);
  if (pr > rx - 3) pr = rx - 3;
  bool hasPupil = pr >= 1.5f;
  int px = cx, py = cy, hx = cx, hy = cy;
  if (hasPupil) {
    float mdx = fmaxf(0, rx - pr - 2.5f);
    float mdy = fmaxf(0, ry - pr * 1.1f - 2.5f);
    px = cx + iround(f.lookX * mdx);
    py = cy + 1 + iround(f.lookY * mdy);
    fillEllipseI(px, py, pr, pr * 1.1f, BLACK);

    int hr = (int)(pr * 0.36f + 0.5f); if (hr < 1) hr = 1;
    hx = px - iround(pr * 0.36f);
    hy = py - iround(pr * 0.42f);
    display.fillCircle(hx, hy, hr, WHITE);                       // brilho principal
    if (pr >= 5) display.fillCircle(px + iround(pr * 0.4f), py + iround(pr * 0.42f),
                                    pr >= 9 ? 1 : 0, WHITE);     // brilho secundário
    if (f.shine > 0.05f) {
      int arm = (int)(f.shine * (hr + 2 + 1.5f * sinf(animClock * 9.0f)) + 0.5f);
      if (arm > 0) drawStar(hx, hy, arm, WHITE);                 // cintilar
    }
  }

  // Pálpebra superior: desce de cima. A borda é um arco (pálpebra pesada)
  // quando entreaberto e vira "‿" perto de fechar, encaixando no olho fechado.
  if (lid < 0.999f) {
    float drop = (1 - lid) * 1.55f * ry;
    float a = (lid < 0.5f) ? lerpf(2.0f, -3.0f, lid / 0.5f)
                           : lerpf(-3.0f, 0.0f, (lid - 0.5f) / 0.5f);
    int topY = cy - (int)ry - 2;
    for (int x = cx - (int)rx - 2; x <= cx + (int)rx + 2; x++) {
      float u = (float)(x - cx) / (rx + 1);
      float uu = fminf(u * u, 1.0f);
      int yt = iround(cy - ry + drop + a * (1 - uu));
      if (yt > topY) display.drawFastVLine(x, topY, yt - topY, BLACK);
      // contorno da pálpebra (2 px), somente dentro do olho
      if (insideEllipse(x, yt, cx, cy, rx, ry)) display.drawPixel(x, yt, WHITE);
      if (insideEllipse(x, yt + 1, cx, cy, rx, ry)) display.drawPixel(x, yt + 1, WHITE);
    }
    // Mantém um brilhinho visível logo abaixo da pálpebra (olhar vivo)
    if (hasPupil && lid > 0.2f) {
      int lidY = iround(cy - ry + drop + a) + 4;
      if (hy < lidY && lidY <= cy + (int)ry - 4)
        display.fillCircle(hx, lidY, lid > 0.45f ? 1 : 0, WHITE);
    }
  }

  // Olhos felizes: uma elipse preta sobe por baixo e deixa uma "lua" (^ ^)
  if (happy > 0.01f) {
    fillEllipseI(cx, cy + iround(ry * (2.3f - 1.65f * happy)), rx * 1.3f, ry * 1.2f, BLACK);
  }
}

void drawBrows(int ox, int oy, const Face& f) {
  if (f.brow < 0.3f) return;
  float rx = EYE_RX * f.scale, ry = EYE_RY * f.scale;
  int by = EYE_Y + oy - (int)ry - 2 - iround(f.brow * 4);
  float bw = rx * 0.55f * (0.5f + 0.5f * clamp01(f.brow));
  drawCurve(L_EYE_X + ox, by, bw, -1.5f, 2, WHITE);
  drawCurve(R_EYE_X + ox, by, bw, -1.5f, 2, WHITE);
}

// Bochechas em traços diagonais (///  \\\), espelhadas.
void drawCheek(int cx, int cy, float b, int dir) {
  if (b < 0.15f) return;
  static const int8_t OFF1[] = {0}, OFF2[] = {-2, 2}, OFF3[] = {-3, 0, 3};
  const int8_t* off; int n;
  if (b < 0.35f)      { off = OFF1; n = 1; }
  else if (b < 0.7f)  { off = OFF2; n = 2; }
  else                { off = OFF3; n = 3; }
  int k = 1 + (int)(b * 2.0f + 0.5f);       // comprimento - 1  (1..3)
  int a = k / 2, bb = k - a;
  for (int i = 0; i < n; i++) {
    int lx1 = off[i] - a, ly1 = bb;
    int lx2 = off[i] + bb, ly2 = -a;
    display.drawLine(cx + dir * lx1, cy + ly1, cx + dir * lx2, cy + ly2, WHITE);
  }
}

void drawMouth(int mx, int my, const Face& f) {
  const float D = 3.0f;   // profundidade do sorriso
  const float H = 9.0f;   // altura máxima da boca aberta
  float w = fmaxf(1.5f, f.mouthW);
  int hw = (int)(w + 0.5f);
  if (hw > 12) hw = 12;
  float oh = clamp01(f.mouthOpen) * H;

  if (oh < 1.2f) {                         // boca fechada: só a curva
    drawCurve(mx, my, w, f.smile * D, 2, WHITE);
    return;
  }

  float R = clamp01(f.mouthRound);
  int bots[25];
  for (int x = -hw; x <= hw; x++) {
    float u = (float)x / (hw + 0.5f);
    float s = sqrtf(fmaxf(0, 1 - u * u));
    float base = my + f.smile * D * (1 - u * u);
    int yt = iround(base - oh * R * 0.5f * s);
    int yb = iround(base + oh * (1 - 0.5f * R) * s);
    if (yb < yt) yb = yt;
    bots[x + hw] = yb;
    display.drawFastVLine(mx + x, yt, yb - yt + 1, WHITE);
    if (yb - yt >= 4 && abs(x) < hw - 1)
      display.drawFastVLine(mx + x, yt + 2, yb - yt - 2, BLACK);   // interior
  }

  // Linguinha
  if (oh > 5.5f && R < 0.4f && w >= 7) {
    float tw = w * 0.42f;
    int thw = (int)(tw + 0.5f);
    for (int x = -thw; x <= thw; x++) {
      float ut = x / (tw + 0.5f);
      int th = (int)(oh * 0.32f * sqrtf(fmaxf(0, 1 - ut * ut)) + 0.5f);
      if (th > 0) display.drawFastVLine(mx + x, bots[x + hw] - th, th, WHITE);
    }
  }
}

// ============================================================================
//  Efeitos
// ============================================================================

void spawnHeart(float x, float y, float vy, uint8_t size, float amp) {
  for (int i = 0; i < MAX_HEARTS; i++) {
    if (!hearts[i].active) {
      Heart& h = hearts[i];
      h.active = true; h.x0 = x; h.y = y; h.vy = vy; h.age = 0;
      h.amp = amp; h.freq = frand(2.0f, 3.5f); h.phase = frand(0, 6.28f);
      h.size = size;
      return;
    }
  }
}

void spawnPetHeart() {
  bool left = random(2) == 0;
  float x = left ? frand(7, 25) : frand(103, 121);
  spawnHeart(x, 68, frand(14, 21), random(4) == 0 ? 0 : 1, frand(1.5f, 3.0f));
}

void spawnSuperHeart() {
  int r = random(10);
  uint8_t size = r < 3 ? 0 : (r < 7 ? 1 : 2);
  spawnHeart(frand(5, 123), 68 + frand(0, 6), frand(22, 38), size, frand(2.0f, 5.0f));
}

void updateHearts(float dt) {
  for (int i = 0; i < MAX_HEARTS; i++) {
    Heart& h = hearts[i];
    if (!h.active) continue;
    h.age += dt;
    h.vy += 3.0f * dt;          // leve aceleração
    h.y -= h.vy * dt;
    if (h.y < -12) h.active = false;
  }
}

void drawHearts() {
  for (int i = 0; i < MAX_HEARTS; i++) {
    Heart& h = hearts[i];
    if (!h.active) continue;
    int x = iround(h.x0 + sinf(h.phase + h.age * h.freq) * h.amp);
    int y = iround(h.y);
    int s = h.size;
    if (h.age < 0.18f) s = 0;                                  // nasce pequeno
    else if (s == 2 && fmodf(h.age, 0.55f) < 0.1f) s = 1;      // "batimento"
    if (y < 6 && s > 0) s--;                                   // encolhe ao sair
    drawHeartShape(x, y, s);
  }
}

void spawnFloaty(uint8_t type, float x, float y, float life) {
  for (int i = 0; i < MAX_FLOATIES; i++) {
    if (!floaties[i].active) {
      floaties[i].active = true; floaties[i].type = type;
      floaties[i].x = x; floaties[i].y = y; floaties[i].age = 0; floaties[i].life = life;
      return;
    }
  }
}

void clearFloaties() { for (int i = 0; i < MAX_FLOATIES; i++) floaties[i].active = false; }

void updateFloaties(float dt) {
  for (int i = 0; i < MAX_FLOATIES; i++) {
    if (!floaties[i].active) continue;
    floaties[i].age += dt;
    if (floaties[i].age >= floaties[i].life) floaties[i].active = false;
  }
}

void drawFloaties() {
  for (int i = 0; i < MAX_FLOATIES; i++) {
    Floaty& f = floaties[i];
    if (!f.active) continue;
    float p = f.age / f.life;
    if (f.type == FL_Z) {
      int s = 3 + (int)(p * 4);
      int x = iround(f.x + f.age * 7 + sinf(f.age * 3) * 2);
      int y = iround(f.y - f.age * 7);
      display.drawLine(x, y, x + s, y, WHITE);
      display.drawLine(x + s, y, x, y + s, WHITE);
      display.drawLine(x, y + s, x + s, y + s, WHITE);
    } else {  // nota musical
      int x = iround(f.x + sinf(f.age * 4) * 2);
      int y = iround(f.y - f.age * 9);
      display.fillCircle(x, y + 5, 1, WHITE);
      display.drawFastVLine(x + 1, y, 5, WHITE);
      display.drawLine(x + 1, y, x + 3, y + 2, WHITE);
    }
  }
}

void drawSparkles() {
  if (sparkleLevel < 0.05f) return;
  for (int i = 0; i < NUM_SPARKLES; i++) {
    float tw = 0.5f + 0.5f * sinf(animClock * 6.0f + i * 1.7f);
    int arm = (int)(sparkleLevel * tw * 3.0f + 0.3f);
    if (arm >= 1) drawStar(SPARKLES[i][0], SPARKLES[i][1], arm, WHITE);
  }
}

void drawExclaim(uint32_t now) {
  if (!exclaimOn) return;
  uint32_t e = now - exclaimStart;
  if (e > 900) { exclaimOn = false; return; }
  int x = 118, y = (e < 120) ? 0 : 2;
  display.fillRoundRect(x - 1, y, 4, 9, 1, WHITE);
  display.fillRect(x - 1, y + 11, 4, 3, WHITE);
  if (e < 500) {                                   // tracinhos de susto
    display.drawLine(110, 2, 112, 5, WHITE);
    display.drawLine(108, 9, 111, 9, WHITE);
    display.drawLine(110, 16, 112, 13, WHITE);
  }
}

// ============================================================================
//  Piscar
// ============================================================================

void scheduleNextBlink(uint32_t now) {
  if (doubleBlinkQueued) {
    doubleBlinkQueued = false;
    nextBlinkAt = now + random(1800, 5200);
  } else if (random(100) < 22) {
    doubleBlinkQueued = true;                      // piscadinha dupla
    nextBlinkAt = now + 330;
  } else {
    nextBlinkAt = now + random(1800, 5200);
  }
}

void startBlink(uint32_t now) {
  blinking = true;
  blinkStart = now;
  scheduleNextBlink(now);
}

void updateBlink(uint32_t now) {
  if (blinking && now - blinkStart >= BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS)
    blinking = false;
  // Novas piscadas só acordado, sem o botão pressionado e sem olhos felizes.
  if (!blinking && state == ST_AWAKE && !isHeld() && cur.happy < 0.3f &&
      reached(now, nextBlinkAt)) {
    startBlink(now);
  }
}

float blinkFactor(uint32_t now) {
  if (!blinking) return 1.0f;
  uint32_t e = now - blinkStart;
  if (e < BLINK_CLOSE_MS) return 1.0f - smooth01((float)e / BLINK_CLOSE_MS);
  e -= BLINK_CLOSE_MS;
  if (e < BLINK_HOLD_MS) return 0.0f;
  e -= BLINK_HOLD_MS;
  if (e < BLINK_OPEN_MS) return smooth01((float)e / BLINK_OPEN_MS);
  return 1.0f;
}

// ============================================================================
//  Máquina de estados
// ============================================================================

void setState(RobotState s) {
  uint32_t now = millis();
  state = s;
  stateStart = now;
  stageFlags = 0;
  Serial.printf("[robo] estado -> %s\n", STATE_NAMES[s]);

  switch (s) {
    case ST_SLEEPING:
      nextZAt = now + 600;
      break;
    case ST_AWAKE:
      lastInteraction = now;
      nextBlinkAt = now + random(700, 2200);
      doubleBlinkQueued = false;
      nextGazeAt = now + random(800, 2500);
      nextMicroAt = now + random(8000, 15000);
      microUntil = now;
      gazeX = gazeY = 0;
      break;
    case ST_PETTING:
      nextHeartAt = now + 250;
      break;
    case ST_SUPER:
      clearFloaties();
      for (int i = 0; i < 7; i++) spawnSuperHeart();       // explosão inicial
      nextHeartAt = now + 120;
      break;
    default:
      break;
  }
}

// ---------- DORMINDO ----------
void updateSleeping(uint32_t now, float t) {
  tgt = faceSleep();
  faceSpeed = 2.5f;
  float breath = sinf(t * 6.2832f / 4.0f);           // respiração de 4 s
  tgt.mouthOpen = 0.28f + 0.12f * breath;
  tgt.oy = breath * 1.2f;

  if (reached(now, nextZAt)) {
    spawnFloaty(FL_Z, 100, 18, 2.6f);
    nextZAt = now + 1400;
  }

  // Segurando o botão enquanto dorme: sonha sorrindo e corado.
  uint32_t h = holdMs(now);
  if (isHeld() && h > HOLD_FEEDBACK_MS) {
    float p = clamp01((h - HOLD_FEEDBACK_MS) / 900.0f);
    tgt.blush = p;
    tgt.smile = p;
    tgt.mouthOpen = lerpf(tgt.mouthOpen, 0, p);
    tgt.mouthW = lerpf(3, 6, p);
    tgt.mouthRound = 1 - p;
    faceSpeed = 5;
  }
}

// ---------- ACORDANDO ("Opa! Acordei!") ----------
void updateWaking(uint32_t now, float t) {
  tgt = faceSleep();
  tgt.mouthOpen = 0; tgt.mouthRound = 0; tgt.smile = 0.2f; tgt.mouthW = 4;
  faceSpeed = 6;

  if (t < 0.35f) {                                   // "hm?" ainda de olhos fechados
    tgt.open = 0;
    if (t > 0.1f) tgt.ox = sinf(t * 30) * 1.2f;
  } else if (t < 0.9f) {                             // abre devagar, sonolento
    tgt.open = 0.4f; tgt.lookY = 0.35f;
    faceSpeed = 4;
  } else if (t < 1.1f) {                             // pesca de sono...
    tgt.open = 0.04f; tgt.lookY = 0.35f;
    faceSpeed = 10;
  } else if (t < 2.0f) {                             // SUSTO! olhos arregalados
    tgt = faceNormal();
    tgt.scale = 1.22f; tgt.pupil = 0.6f; tgt.brow = 1;
    tgt.smile = 0; tgt.mouthOpen = 0.75f; tgt.mouthRound = 1; tgt.mouthW = 4;
    tgt.oy = (t < 1.3f) ? -3 : 0;
    if (t < 1.45f) tgt.ox = sinf(t * 45) * 1.2f;
    faceSpeed = 16;
    if (!(stageFlags & 1)) {
      stageFlags |= 1;
      exclaimOn = true; exclaimStart = now;
      clearFloaties();                               // os "Zzz" somem no susto
    }
  } else if (t < WAKE_DUR) {                         // relaxa e sorri: "oi!"
    tgt = faceNormal();
    tgt.smile = 1; tgt.blush = 0.35f; tgt.mouthOpen = 0.2f; tgt.mouthW = 7;
    faceSpeed = 5;
  } else {
    setState(ST_AWAKE);
  }
}

// ---------- ACORDADO ----------
void applyAwakeHoldFeedback(uint32_t now, float t) {
  uint32_t h = holdMs(now);
  if (!isHeld() || h <= HOLD_FEEDBACK_MS) return;
  microUntil = now;                                  // cancela micro-expressões
  float p = clamp01((h - HOLD_FEEDBACK_MS) / 900.0f);
  tgt.lookX = 0; tgt.lookY = 0;
  tgt.oy = 0;
  if (h < SUPER_MIN_MS) {                            // vai ficando derretido
    tgt.blush = p; tgt.happy = 0.65f * p; tgt.smile = 1;
    tgt.mouthOpen = 0.15f * p; tgt.mouthW = 6 + p;
  } else {                                           // "vai ser super!" ansioso
    tgt.blush = 1; tgt.happy = 0; tgt.scale = 1.15f; tgt.pupil = 1.05f;
    tgt.shine = 1; tgt.smile = 1; tgt.mouthOpen = 0.5f; tgt.mouthW = 8;
    tgt.ox = sinf(t * 40) * 1.0f;
    sparkleTarget = 0.6f;
  }
  faceSpeed = 7;
}

void updateAwake(uint32_t now, float t) {
  tgt = faceNormal();
  faceSpeed = 7;

  // Olhar curioso pelo ambiente
  if (reached(now, nextGazeAt)) {
    if (random(100) < 35) { gazeX = 0; gazeY = 0; }
    else { gazeX = random(-80, 81) / 100.0f; gazeY = random(-50, 51) / 100.0f; }
    nextGazeAt = now + random(1200, 4200);
    if (!blinking && !isHeld() && random(100) < 30) startBlink(now);   // pisca ao mudar o olhar
  }
  tgt.lookX = gazeX; tgt.lookY = gazeY;

  // Respiração sutil
  tgt.oy = sinf(t * 6.2832f / 3.5f) * 0.9f;

  // Micro-expressões de personalidade
  if (!isHeld() && reached(now, nextMicroAt)) {
    microType = random(3);
    microStart = now;
    microUntil = now + 1600;
    nextMicroAt = now + random(10000, 20000);
    if (microType == 0) spawnFloaty(FL_NOTE, 113, 32, 1.8f);
  }
  if (!reached(now, microUntil)) {
    float mt = (now - microStart) / 1000.0f;
    switch (microType) {
      case 0:   // cantarolando, contente
        tgt.happy = 0.6f; tgt.blush = 0.6f; tgt.smile = 1; tgt.mouthW = 7;
        tgt.lookX = 0; tgt.lookY = 0;
        break;
      case 1:   // pulinhos animados
        if (mt < 0.8f) tgt.oy = -fabsf(sinf(mt * 3.1416f * 2.5f)) * 3;
        tgt.smile = 1; tgt.mouthOpen = 0.3f; tgt.mouthW = 6;
        break;
      default:  // curioso, olha para cima
        tgt.scale = 1.08f; tgt.lookY = -0.6f; tgt.lookX = 0.5f * sinf(mt * 3);
        tgt.smile = 0; tgt.mouthOpen = 0.3f; tgt.mouthRound = 1; tgt.mouthW = 3;
        tgt.brow = 0.5f;
        break;
    }
  }

  applyAwakeHoldFeedback(now, t);

  if (isHeld()) lastInteraction = now;
  else if (now - lastInteraction >= SLEEP_TIMEOUT_MS) setState(ST_DROWSY);
}

// ---------- COCHILANDO (transição para dormir) ----------
void updateDrowsy(uint32_t now, float t) {
  (void)now;
  tgt = faceNormal();
  faceSpeed = 3;
  if (t < 0.9f) {                                    // pálpebras pesadas
    tgt.open = 0.55f; tgt.lookY = 0.4f; tgt.smile = 0.4f;
  } else if (t < 2.0f) {                             // bocejo
    tgt.open = 0; tgt.mouthOpen = 1; tgt.mouthRound = 1; tgt.mouthW = 5;
    tgt.smile = 0; tgt.oy = -1;
    faceSpeed = 4;
  } else if (t < 2.6f) {                             // última olhadinha
    tgt.open = 0.35f; tgt.lookY = 0.3f; tgt.smile = 0.3f;
    faceSpeed = 4;
  } else if (t < DROWSY_DUR) {                       // adormece
    tgt = faceSleep();
    faceSpeed = 2;
  } else {
    setState(ST_SLEEPING);
  }
}

// ---------- CARINHO ----------
void updatePetting(uint32_t now, float t) {
  tgt = faceNormal();
  if (t < 2.9f) {
    tgt.happy = 1; tgt.blush = 1; tgt.smile = 1;
    tgt.mouthOpen = 0.35f; tgt.mouthW = 7;
    faceSpeed = 5;                                   // olhos fecham suavemente
    if (t > 0.4f) {                                  // se aconchega na mão
      float ph = (t - 0.4f) * 2.8f;
      tgt.ox = sinf(ph) * 2.5f;
      tgt.oy = -fabsf(sinf(ph)) * 1.0f;
    }
    if (t > 0.25f && t < 2.6f && reached(now, nextHeartAt)) {
      spawnPetHeart();
      nextHeartAt = now + random(260, 420);
    }
  } else if (t < PET_DUR) {
    faceSpeed = 3;                                   // volta suave ao normal
  } else {
    setState(ST_AWAKE);
  }
}

// ---------- SUPER CARINHO ----------
void updateSuper(uint32_t now, float t) {
  tgt = faceNormal();
  if (t < 4.6f) {
    tgt.scale = 1.28f; tgt.pupil = 1.05f; tgt.shine = 1; tgt.blush = 1;
    tgt.smile = 1; tgt.mouthOpen = 1; tgt.mouthRound = 0; tgt.mouthW = 10;
    sparkleTarget = 1;

    if (t < 0.35f) {                                 // "!!!" olhos brilham
      tgt.brow = 0.6f; tgt.oy = -2;
      faceSpeed = 14;
    } else {
      faceSpeed = 7;
      float ph = t - 0.35f;
      tgt.oy = -fabsf(sinf(ph * 3.1416f * 2.2f)) * 5;   // pulinhos
      tgt.ox = sinf(ph * 3.1416f * 1.1f) * 3;           // balança
    }
    if (t >= 2.0f && t < 2.8f) {                     // gritinho de alegria ^^
      tgt.happy = 1; tgt.mouthW = 11;
      tgt.oy = -fabsf(sinf(t * 3.1416f * 4)) * 2;
      tgt.ox = sinf(t * 3.1416f * 8) * 1.5f;
    }
    if (t < 4.2f && reached(now, nextHeartAt)) {
      spawnSuperHeart();
      nextHeartAt = now + random(70, 140);
    }
  } else if (t < SUPER_DUR) {
    faceSpeed = 3;
  } else {
    setState(ST_AWAKE);
  }
}

void updateState(uint32_t now) {
  float t = (now - stateStart) / 1000.0f;
  sparkleTarget = 0;
  switch (state) {
    case ST_SLEEPING: updateSleeping(now, t); break;
    case ST_WAKING:   updateWaking(now, t);   break;
    case ST_AWAKE:    updateAwake(now, t);    break;
    case ST_DROWSY:   updateDrowsy(now, t);   break;
    case ST_PETTING:  updatePetting(now, t);  break;
    case ST_SUPER:    updateSuper(now, t);    break;
  }
}

// Aproxima o rosto atual do alvo (suavização exponencial independente do FPS).
void updateFace(float dt) {
  float k  = 1.0f - expf(-faceSpeed * dt);
  float kf = 1.0f - expf(-FAST_SPEED * dt);
  cur.open       += (tgt.open       - cur.open)       * k;
  cur.happy      += (tgt.happy      - cur.happy)      * k;
  cur.scale      += (tgt.scale      - cur.scale)      * k;
  cur.pupil      += (tgt.pupil      - cur.pupil)      * k;
  cur.shine      += (tgt.shine      - cur.shine)      * k;
  cur.blush      += (tgt.blush      - cur.blush)      * k;
  cur.smile      += (tgt.smile      - cur.smile)      * k;
  cur.mouthOpen  += (tgt.mouthOpen  - cur.mouthOpen)  * k;
  cur.mouthRound += (tgt.mouthRound - cur.mouthRound) * k;
  cur.mouthW     += (tgt.mouthW     - cur.mouthW)     * k;
  cur.brow       += (tgt.brow       - cur.brow)       * k;
  cur.lookX      += (tgt.lookX      - cur.lookX)      * kf;
  cur.lookY      += (tgt.lookY      - cur.lookY)      * kf;
  cur.ox         += (tgt.ox         - cur.ox)         * kf;
  cur.oy         += (tgt.oy         - cur.oy)         * kf;

  float ks = 1.0f - expf(-5.0f * dt);
  sparkleLevel += (sparkleTarget - sparkleLevel) * ks;
}

// ============================================================================
//  Botão (debounce + classificação pelo tempo pressionado)
// ============================================================================

void onPress(uint32_t now) {
  lastInteraction = now;
}

void onRelease(uint32_t dur) {
  lastInteraction = millis();
  Serial.printf("[robo] botao solto apos %lu ms\n", (unsigned long)dur);

  if (dur < TAP_MAX_MS) {
    // Toque rápido só acorda quem está dormindo (ou pegando no sono).
    if (state == ST_SLEEPING || state == ST_DROWSY) setState(ST_WAKING);
  } else if (dur >= SUPER_MIN_MS) {
    setState(ST_SUPER);
  } else if (dur >= PET_MIN_MS && dur <= PET_MAX_MS) {
    setState(ST_PETTING);
  }
  // Outras durações (0,6–1,2 s e 1,7–2,0 s) são ignoradas.
}

void readButton(uint32_t now) {
  bool raw = (digitalRead(PIN_BTN) == LOW);
  if (raw != btnRaw) { btnRaw = raw; btnLastChange = now; }
  if (raw != btnStable && now - btnLastChange >= DEBOUNCE_MS) {
    btnStable = raw;
    if (btnStable) { pressStart = btnLastChange; onPress(now); }
    else           { onRelease(btnLastChange - pressStart); }
  }
}

// ============================================================================
//  Renderização
// ============================================================================

void renderFrame(uint32_t now) {
  display.clearDisplay();
  int ox = iround(cur.ox), oy = iround(cur.oy);
  float openEff = cur.open * blinkFactor(now);

  drawEye(L_EYE_X + ox, EYE_Y + oy, cur, openEff, -1);
  drawEye(R_EYE_X + ox, EYE_Y + oy, cur, openEff, +1);
  drawBrows(ox, oy, cur);
  drawCheek(CHEEK_L_X + ox, CHEEK_Y + oy, cur.blush, +1);
  drawCheek(CHEEK_R_X + ox, CHEEK_Y + oy, cur.blush, -1);
  drawMouth(MOUTH_X + ox, MOUTH_Y + oy, cur);

  drawSparkles();
  drawFloaties();
  drawHearts();
  drawExclaim(now);

  display.display();
}

// ============================================================================
//  Setup / Loop
// ============================================================================

uint32_t lastFrame = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BTN, INPUT_PULLUP);

  Wire.begin(PIN_SDA, PIN_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR, true, false)) {
    Serial.println("[robo] ERRO: OLED SSD1306 nao encontrado em 0x3C");
    for (;;) { delay(1000); }   // sem display não há o que animar
  }
  display.clearDisplay();
  display.display();

  for (int i = 0; i < MAX_HEARTS; i++) hearts[i].active = false;
  clearFloaties();

  cur = faceSleep();
  tgt = cur;
  lastFrame = millis();
  setState(ST_WAKING);          // ao ligar, o robô acorda
}

void loop() {
  uint32_t now = millis();
  readButton(now);

  if (now - lastFrame >= FRAME_MS) {
    float dt = (now - lastFrame) / 1000.0f;
    if (dt > 0.1f) dt = 0.1f;
    lastFrame = now;

    animClock += dt;
    if (animClock > 3600.0f) animClock -= 3600.0f;

    updateState(now);
    updateBlink(now);
    updateFace(dt);
    updateHearts(dt);
    updateFloaties(dt);
    renderFrame(now);
  }
}
