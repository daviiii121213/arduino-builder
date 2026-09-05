/**
 * Vegetação e formações de cada bioma.
 *
 * São os objetos que dão identidade visual a cada região: cristais na clareira
 * encantada, ciprestes mortos no pântano, copas fechadas na floresta, pedra
 * negra no campo de lava e cactos no deserto de vidro. Um bioma novo entra
 * acrescentando os desenhos aqui e citando-os na geração do mundo.
 */

import { pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  // ---- clareira encantada
  m: P.magia,
  M: P.magiaClara,
  C: '#b8fff2',
  v: '#5b47b0',
  V: '#8b6fe0',
  w: '#e6ffff',
  W: P.osso,
  // ---- pântano das raízes
  s: '#3f5a34',
  S: '#5f7d4a',
  b: '#241c1c',
  l: '#4a3a24',
  L: '#6b5436',
  // ---- floresta fechada
  f: P.folha,
  F: P.folhaClara,
  d: P.folhaEscura,
  t: P.tronco,
  T: P.troncoLuz,
  // ---- campo de lava
  n: '#2f2626',
  N: '#4a3f3c',
  o: '#ff6a2a',
  O: '#ffb14a',
  x: '#d8c23a',
  X: '#fff08a',
  // ---- deserto de vidro
  a: '#c9a45a',
  A: '#e8c88a',
  g: '#3f6b2f',
  G: '#5f9a44',
  p: P.pedra,
  P: P.pedraClara,
};

const ARVORECRISTAL = [
  '........kMk.......',
  '.......kMCMk......',
  '......kMCCCMk.....',
  '.....kMCCCCCMk....',
  '....kkMCCCCCMkk...',
  '.......kMCMk......',
  '......kMCCCMk.....',
  '.....kMCCCCCMk....',
  '....kMCCCCCCCMk...',
  '...kkMCCCCCCCMkk..',
  '......kMCCCMk.....',
  '.....kMCCCCCMk....',
  '....kMCCCCCCCMk...',
  '...kMCCCCCCCCCMk..',
  '..kkMCCCCCCCCCMkk.',
  '.....kMCCCCCMk....',
  '...kMCCCCCCCCCMk..',
  '..kMCCCCCCCCCCCMk.',
  '.kkMCCCCCCCCCCCMkk',
  '........kvVvk.....',
  '........kvVvk.....',
  '........kvVvk.....',
  '.......kkvVvkk....',
  '......kvvVVVvvk...',
  '.....kkvvkkkvvkk..',
];

const CRISTALDUPLO = [
  '....kk......',
  '...kMMk..kk.',
  '..kMCCk.kMk.',
  '..kCCCk.kCMk',
  '.kMCCCCkkCCk',
  '.kCCCCCCkCCk',
  '.kCCCCCCCCCk',
  '..kCCCCCCCk.',
  '..kkCCCCkk..',
  '....kkkk....',
];

const COGUMELOMAGICO = [
  '..kkkk..',
  '.kMCCMk.',
  'kMCCCCMk',
  'kCCmmCCk',
  '.kkmmkk.',
  '..kwwk..',
  '..kwwk..',
  '..kkkk..',
];

const FLORESTRELA = [
  '..k.k.k.',
  '.kMkMkMk',
  '..kCCCk.',
  '.kMCmCMk',
  '..kCCCk.',
  '...kfk..',
  '...kfk..',
  '...kk...',
];

const CIPRESTE = [
  '........kk.......',
  '.......ksSk......',
  '......ksSSsk.....',
  '.....ksSSSSsk....',
  '....kksSSSSskk...',
  '......ksSSsk.....',
  '.....ksSSSSsk....',
  '....ksSSSSSSsk...',
  '...kksSSSSSSskk..',
  '.....ksSSSSsk....',
  '....ksSSSSSSsk...',
  '...ksSSSSSSSSsk..',
  '..kksSSSSSSSSskk.',
  '....ksSSSSSSsk...',
  '..ksSSSSSSSSSSsk.',
  '.kksSSSSSSSSSSskk',
  '.......kbLbk.....',
  '.......kbLbk.....',
  '.......kbLbk.....',
  '......kkbLbkk....',
  '.....kbbLLLbbk...',
  '....kkbbkkkbbkk..',
];

const ARVOREMORTA = [
  '.k....k...',
  'kLk..kLk..',
  '.kLkkLk.k.',
  '..kLLLkkLk',
  '...kLLLLk.',
  '....kLLk..',
  '....kbLk..',
  '....kbLk..',
  '...kkbLkk.',
  '..kbbLLbk.',
  '.kkbbkkbbk',
];

const MOITAPANTANO = [
  '.k..k..k..k',
  'ksk.ksk.ksk',
  'kSk.kSk.kSk',
  'kSkkkSkkkSk',
  '.kSSsSSsSk.',
  '..kssSssk..',
  '...kkkkk...',
];

const BOLHALAMA = [
  '...kk..',
  '..kbbk.',
  '.kbLLbk',
  '.kbLLbk',
  '..kbbk.',
  '...kk..',
];

const ARVOREALTA = [
  '.........kkkkkk.........',
  '.......kkdffffdkk.......',
  '.....kkdfFFFFFFfdkk.....',
  '....kdfFFFFFFFFFFfdk....',
  '...kdfFFFFFFFFFFFFfdk...',
  '..kdfFFFFFFFFFFFFFFfdk..',
  '..kdfFFFFFFFFFFFFFFfdk..',
  '...kdfFFFFFFFFFFFFfdk...',
  '..kkdfFFFFFFFFFFFFfdkk..',
  '.kdffFFFFFFFFFFFFFFffdk.',
  'kdfFFFFFFFFFFFFFFFFFFfdk',
  'kdfFFFFFFFFFFFFFFFFFFfdk',
  '.kdffFFFFFFFFFFFFFFffdk.',
  '..kkdffFFFFFFFFFFffdkk..',
  '....kkdffFFFFFFffdkk....',
  '......kkdffffffdkk......',
  '.........kkTtkk.........',
  '..........kTtk..........',
  '..........kTtk..........',
  '..........kTtk..........',
  '.........kkTtkk.........',
  '........kTTttTtk........',
  '.......kTtkkkkTtk.......',
  '......kkkk....kkkk......',
];

const ARBUSTOBAGA = [
  '...kkkkk...',
  '.kkdfFfdkk.',
  'kdfFCfFCfdk',
  'kfFffffffFk',
  'kdfCfFfCffk',
  '.kdffffffk.',
  '..kkddffk..',
  '....kkkk...',
];

const SAMAMBAIAGIGANTE = [
  '.k...k...k..',
  'ksk.ksk.ksk.',
  'kssk.sk.kssk',
  '.kssksskssk.',
  '..kssssssk..',
  '...ksssssk..',
  '....kssk....',
  '....kkk.....',
];

const COGUMELODUPLO = [
  '.kkk..kkkk..',
  'kdffk.kdffdk',
  'kffFk.kfFFfk',
  '.kkk..kkffk.',
  '.kWk...kkkk.',
  '.kWk...kWk..',
  '.kkk...kWk..',
  '.......kkk..',
];

const ARVORECARBONIZADA = [
  '.k...k....',
  'knk.knk...',
  '.knkknk.k.',
  '..knnnkknk',
  '...knnnnk.',
  '....knnk..',
  '....knOk..',
  '....knnk..',
  '...kknOkk.',
  '..knnoonk.',
  '.kknnkknnk',
];

const ROCHAOBSIDIANA = [
  '....kkk....',
  '...kNbbk...',
  '..kNbbbbk..',
  '.kNbbbbbbk.',
  'kNbbbobbbbk',
  'kbbbbbbbbbk',
  'kbbobbbbobk',
  '.kbbbbbbbk.',
  '..kkbbbkk..',
  '....kkk....',
];

const FUMAROLA = [
  '..k..k..',
  '.kOk.kOk',
  '..kok...',
  '.kNNNk..',
  'kNnnnNk.',
  'kNnonnNk',
  'kNnnnnNk',
  '.kNnnNk.',
  '..kkkk..',
];

const CRISTALENXOFRE = [
  '...kk......',
  '..kXXk..kk.',
  '.kXxxXk.kXk',
  '.kxxxxkkXxk',
  'kXxxxxxxxxk',
  'kxxxxxxxxxk',
  '.kxxxxxxxk.',
  '..kkxxxkk..',
  '....kkk....',
];

const CACTO = [
  '....kk.......',
  '.k..kGk..k...',
  'kGk.kGk.kGk..',
  'kGkkkGkkkGk..',
  'kGgkkGkkkgGk.',
  'kGgk.kGk.kgGk',
  '.kkk.kGgk.kkk',
  '.....kGgk....',
  '.....kGgk....',
  '....kkGgkk...',
  '...kGGggGk...',
  '...kkkkkkk...',
];

const CACTOPEQUENO = [
  '..kk',
  '.kGk',
  'kGgk',
  'kGgk',
  'kGgk',
  'kkkk',
];

const ARBUSTOSECO = [
  '.k..k...k..',
  'kLk.kLk.kLk',
  '.kLkkLkkLk.',
  '..kLLLLLk..',
  '...kLLLk...',
  '....kkk....',
];

const ARENITO = [
  '...kkkk...',
  '..kAaaAk..',
  '.kAaaaaak.',
  'kAaaPaaaak',
  'kaaaaaaaak',
  'kaaaaPaaak',
  '.kaaaaaak.',
  '..kkaakk..',
  '....kk....',
];

const PALMEIRA = [
  '..k...k..k..',
  '.kFk.kFk.kFk',
  'kFfkkFfkkFfk',
  '.kkffFffkk..',
  '....kTtk....',
  '....kTtk....',
  '....kTtk....',
  '...kkTtkk...',
  '..kTTttTtk..',
  '..kkkkkkkk..',
];

export interface ArteBiomas {
  arvoreCristal: Sprite;
  cristalDuplo: Sprite;
  cogumeloMagico: Sprite;
  florEstrela: Sprite;
  cipreste: Sprite;
  arvoreMorta: Sprite;
  moitaPantano: Sprite;
  bolhaLama: Sprite;
  arvoreAlta: Sprite;
  arbustoBaga: Sprite;
  samambaiaGigante: Sprite;
  cogumeloDuplo: Sprite;
  arvoreCarbonizada: Sprite;
  rochaObsidiana: Sprite;
  fumarola: Sprite;
  cristalEnxofre: Sprite;
  cacto: Sprite;
  cactoPequeno: Sprite;
  arbustoSeco: Sprite;
  arenito: Sprite;
  palmeira: Sprite;
}

export function criarBiomas(): ArteBiomas {
  return {
    arvoreCristal: pintar(ARVORECRISTAL, PAL),
    cristalDuplo: pintar(CRISTALDUPLO, PAL),
    cogumeloMagico: pintar(COGUMELOMAGICO, PAL),
    florEstrela: pintar(FLORESTRELA, PAL),
    cipreste: pintar(CIPRESTE, PAL),
    arvoreMorta: pintar(ARVOREMORTA, PAL),
    moitaPantano: pintar(MOITAPANTANO, PAL),
    bolhaLama: pintar(BOLHALAMA, PAL),
    arvoreAlta: pintar(ARVOREALTA, PAL),
    arbustoBaga: pintar(ARBUSTOBAGA, PAL),
    samambaiaGigante: pintar(SAMAMBAIAGIGANTE, PAL),
    cogumeloDuplo: pintar(COGUMELODUPLO, PAL),
    arvoreCarbonizada: pintar(ARVORECARBONIZADA, PAL),
    rochaObsidiana: pintar(ROCHAOBSIDIANA, PAL),
    fumarola: pintar(FUMAROLA, PAL),
    cristalEnxofre: pintar(CRISTALENXOFRE, PAL),
    cacto: pintar(CACTO, PAL),
    cactoPequeno: pintar(CACTOPEQUENO, PAL),
    arbustoSeco: pintar(ARBUSTOSECO, PAL),
    arenito: pintar(ARENITO, PAL),
    palmeira: pintar(PALMEIRA, PAL),
  };
}
