// One shared colour language keeps the whole game visually cohesive:
// warm rusted industrial oranges against cold blue-grey steel, on desaturated earth.

export const P = {
  // steel / machine bodies
  steelHi: '#b9c2cb', steel: '#7d8792', steelMid: '#636d78', steelLo: '#434b55', steelDark: '#2c323a',
  iron: '#6e6a66', ironLo: '#4a4744', ironDark: '#2a2826',
  // painted industrial surfaces
  paintOrange: '#d4762a', paintOrangeHi: '#f0a352', paintOrangeLo: '#8c4616',
  paintYellow: '#e0b53c', paintYellowHi: '#f6d878', paintYellowLo: '#8f6c12',
  paintGreen: '#4f8b5a', paintGreenHi: '#7cb986', paintGreenLo: '#2c5433',
  paintBlue: '#3c6c96', paintBlueHi: '#6a9cc4', paintBlueLo: '#20415e',
  paintRed: '#a63a2e', paintRedHi: '#d46354', paintRedLo: '#5e1d16',
  // materials
  copper: '#c47a3d', copperHi: '#e8a76a', copperLo: '#7d4519',
  brass: '#c9a544', gold: '#e8c25a',
  rust: '#8a4a22', rustLo: '#5a2d12',
  glass: '#8fd4e8', glassLo: '#2f6b7d',
  rubber: '#2b2b30', rubberHi: '#45454d',
  concrete: '#8e8a80', concreteHi: '#a9a59a', concreteLo: '#5d5a53',
  // world
  grass: '#5d7a3c', grassHi: '#78964d', grassLo: '#41582a',
  dirt: '#7a6144', dirtHi: '#93764f', dirtLo: '#54412c',
  rock: '#6b6a68', rockHi: '#8a8886', rockLo: '#45443f',
  sand: '#c2a973', water: '#2e5d78', waterHi: '#4d87a3', waterDeep: '#1b3b52',
  tree: '#3c6136', treeHi: '#54803f', treeLo: '#24401f',
  road: '#4a4844', roadHi: '#5e5b56', roadLine: '#d8c56a',
  // light & fx
  glowWarm: '#ffbb55', glowHot: '#ff6a1e', glowCold: '#8fdcff',
  spark: '#ffe9a8', smoke: '#7a7671', steam: '#cfd8dd',
  // ui
  uiBg: '#191d22', uiBg2: '#23282f', uiPanel: '#2b313a', uiEdge: '#0d0f12',
  uiTrim: '#c08a3a', uiTrimHi: '#e8b661', uiText: '#e8e2d4', uiDim: '#98917f',
  uiGood: '#7cc07a', uiWarn: '#e0b53c', uiBad: '#d4604e',
};

export const SHADOW = 'rgba(8,10,14,0.38)';

/** Blend two hex colours. */
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

export function shade(hex, amt) { return mix(hex, amt < 0 ? '#000000' : '#ffffff', Math.abs(amt)); }

export function rgba(hex, a) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}
