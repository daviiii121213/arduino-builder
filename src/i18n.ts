/**
 * Every string the game shows lives here, in both languages. The pixel font
 * carries the accented capitals Portuguese needs, so nothing falls back to a
 * system typeface.
 */

export type Language = 'en' | 'pt';

export const LANGUAGES: Array<{ id: Language; label: string }> = [
  { id: 'en', label: 'ENGLISH' },
  { id: 'pt', label: 'PORTUGUÊS (BR)' },
];

const STRINGS = {
  // menu chrome
  play: ['PLAY', 'JOGAR'],
  settings: ['SETTINGS', 'AJUSTES'],
  back: ['BACK', 'VOLTAR'],
  controls: ['CONTROLS', 'CONTROLES'],
  sound: ['SOUND', 'SOM'],
  howTo: ['HOW TO PLAY', 'COMO JOGAR'],
  language: ['LANGUAGE', 'IDIOMA'],
  selectCar: ['SELECT CAR', 'ESCOLHA O CARRO'],
  selectTrack: ['SELECT CIRCUIT', 'ESCOLHA O CIRCUITO'],
  selectWeather: ['SELECT CONDITIONS', 'ESCOLHA O CLIMA'],
  raceSetup: ['RACE SETUP', 'AJUSTE DA CORRIDA'],
  opponents: ['OPPONENTS', 'ADVERSÁRIOS'],
  difficulty2: ['AI DIFFICULTY', 'DIFICULDADE DA IA'],
  easy: ['EASY', 'FÁCIL'],
  normal: ['NORMAL', 'NORMAL'],
  hard: ['HARD', 'DIFÍCIL'],
  startRace: ['START RACE', 'COMEÇAR'],
  gridPreview: ['ON THE GRID', 'NO GRID'],
  easyBlurb: [
    'Rivals hold back and wander off line. Room to learn the circuit.',
    'Os rivais seguram o ritmo e saem do traçado. Espaço para aprender a pista.',
  ],
  normalBlurb: [
    'Rivals race their own line at a fair pace. The default fight.',
    'Os rivais correm no ritmo justo. A briga padrão.',
  ],
  hardBlurb: [
    'Rivals carry more speed, hold a tight line and spend nitro early.',
    'Os rivais carregam mais velocidade, seguram o traçado e gastam nitro cedo.',
  ],
  tagline: ['6 CARS   3 CIRCUITS   3 LAPS', '6 CARROS   3 CIRCUITOS   3 VOLTAS'],

  // footers
  footMain: ['ARROWS MOVE   ENTER SELECT', 'SETAS MOVEM   ENTER SELECIONA'],
  footPick: ['ARROWS MOVE   ENTER NEXT   ESC BACK', 'SETAS MOVEM   ENTER AVANÇA   ESC VOLTA'],
  footStart: [
    'UP DOWN PICK   LEFT RIGHT ADJUST   ENTER START   ESC BACK',
    'CIMA BAIXO ESCOLHE   ESQ DIR AJUSTA   ENTER COMEÇA   ESC VOLTA',
  ],
  footSelect: ['ARROWS MOVE   ENTER SELECT   ESC BACK', 'SETAS MOVEM   ENTER SELECIONA   ESC VOLTA'],
  footBack: ['ESC BACK', 'ESC VOLTA'],
  footSound: [
    'UP DOWN PICK   LEFT RIGHT ADJUST   ESC BACK',
    'CIMA BAIXO ESCOLHE   ESQ DIR AJUSTA   ESC VOLTA',
  ],
  footPause: ['ARROWS MOVE   ENTER SELECT   ESC RESUME', 'SETAS MOVEM   ENTER SELECIONA   ESC VOLTA'],

  // sound settings
  master: ['MASTER', 'GERAL'],
  effects: ['EFFECTS', 'EFEITOS'],
  engine: ['ENGINE', 'MOTOR'],
  mute: ['MUTE', 'MUDO'],
  on: ['ON', 'LIG'],
  off: ['OFF', 'DES'],

  // car stats
  speed: ['SPEED', 'VELOC'],
  accel: ['ACCEL', 'ACELER'],
  grip: ['GRIP', 'ADERÊNCIA'],
  nitro: ['NITRO', 'NITRO'],
  tank: ['TANK', 'TANQUE'],
  boost: ['BOOST', 'IMPULSO'],

  // track facts
  surface: ['SURFACE', 'PISO'],
  length: ['LENGTH', 'EXTENSÃO'],
  corners: ['CORNERS', 'CURVAS'],
  width: ['WIDTH', 'LARGURA'],
  difficulty: ['DIFFICULTY', 'DIFICULDADE'],
  asphalt: ['ASPHALT', 'ASFALTO'],
  dirt: ['DIRT', 'TERRA'],
  visibility: ['VISIBILITY', 'VISIBILIDADE'],

  // pause menu
  paused: ['PAUSED', 'PAUSADO'],
  resume: ['CONTINUE', 'CONTINUAR'],
  toMenu: ['RETURN TO MAIN MENU', 'VOLTAR AO MENU'],

  // race hud and messages
  lap: ['LAP', 'VOLTA'],
  pos: ['POS', 'POS'],
  kmh: ['KM/H', 'KM/H'],
  go: ['GO!', 'VAI!'],
  recovering: ['RECOVERING', 'RETORNANDO'],
  finished: ['FINISHED', 'CHEGOU EM'],
  results: ['RESULTS', 'RESULTADO'],
  resultsHint: ['ENTER MENU    R RESTART', 'ENTER MENU    R REINICIA'],
  skipHint: ['ENTER TO CONTINUE', 'ENTER PARA SEGUIR'],

  // victory
  champion: ['CHAMPION', 'CAMPEÃO'],
  secondPlace: ['SECOND PLACE', 'SEGUNDO LUGAR'],
  thirdPlace: ['THIRD PLACE', 'TERCEIRO LUGAR'],
  trophy: ['TROPHY', 'TROFÉU'],
  silverMedal: ['SILVER MEDAL', 'MEDALHA DE PRATA'],
  bronzeMedal: ['BRONZE MEDAL', 'MEDALHA DE BRONZE'],

  // controls page
  keyAccelerate: ['ACCELERATE', 'ACELERAR'],
  keyBrake: ['BRAKE / REVERSE', 'FREAR / RÉ'],
  keyLeft: ['STEER LEFT', 'VIRAR ESQUERDA'],
  keyRight: ['STEER RIGHT', 'VIRAR DIREITA'],
  keyNitro: ['NITRO BOOST', 'IMPULSO DE NITRO'],
  keyDrift: ['HANDBRAKE DRIFT', 'FREIO DE MÃO'],
  keyRestart: ['RESTART RACE', 'REINICIAR CORRIDA'],
  keyPause: ['PAUSE MENU', 'MENU DE PAUSA'],
} as const;

export type StringKey = keyof typeof STRINGS;

/** Multi-line pages, kept apart because they are wrapped as blocks. */
const PAGES: Record<'howTo', [string[], string[]]> = {
  howTo: [
    [
      'THREE LAPS AGAINST FIVE RIVALS. FIRST TO THE',
      'CHEQUERED LINE WINS.',
      '',
      'GRASS IS SLOW: KEEP TWO WHEELS ON THE ROAD. STAY',
      'OFF IT FOR THREE SECONDS AND THE MARSHALS PUT',
      'YOU BACK, WITH LESS POWER FOR A MOMENT.',
      '',
      'DIRT AND RAIN CUT YOUR GRIP, SO BRAKE EARLIER',
      'AND LET THE CAR ROTATE BEFORE THE THROTTLE.',
      '',
      'HOLD SHIFT TO BURN NITRO. THE BAR BOTTOM LEFT IS',
      'YOUR TANK; IT REFILLS WHEN YOU LET GO.',
      '',
      'TAP SPACE MID-CORNER TO SWING THE BACK OUT.',
      'AT NIGHT YOU ONLY SEE WHAT THE HEADLIGHTS DO.',
    ],
    [
      'TRÊS VOLTAS CONTRA CINCO RIVAIS. QUEM CRUZAR A',
      'BANDEIRADA PRIMEIRO VENCE.',
      '',
      'A GRAMA SEGURA O CARRO: FIQUE NA PISTA. TRÊS',
      'SEGUNDOS FORA E OS FISCAIS DEVOLVEM VOCÊ AO',
      'TRAÇADO, COM MENOS FORÇA POR UM INSTANTE.',
      '',
      'TERRA E CHUVA TIRAM ADERÊNCIA: FREIE ANTES E',
      'DEIXE O CARRO GIRAR ANTES DE ACELERAR.',
      '',
      'SEGURE SHIFT PARA USAR O NITRO. A BARRA NO CANTO',
      'MOSTRA O TANQUE; ELE ENCHE QUANDO VOCÊ SOLTA.',
      '',
      'TOQUE ESPAÇO NA CURVA PARA JOGAR A TRASEIRA.',
      'À NOITE VOCÊ SÓ VÊ O QUE O FAROL ALCANÇA.',
    ],
  ],
};

let current: Language = 'en';

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

/** Looks up a string in the active language. */
export function t(key: StringKey): string {
  const pair = STRINGS[key];
  return current === 'pt' ? pair[1] : pair[0];
}

export function page(key: keyof typeof PAGES): string[] {
  return PAGES[key][current === 'pt' ? 1 : 0];
}

/** Car and circuit blurbs live with their data, so they are translated here. */
export function pick(en: string, pt: string): string {
  return current === 'pt' ? pt : en;
}

export const ALL_KEYS = Object.keys(STRINGS) as StringKey[];
export const RAW_STRINGS = STRINGS;
