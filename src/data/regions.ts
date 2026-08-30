import type { CareerEventDef, RegionDef, RivalDef, TrackDef } from './types';

// 10 regiões planejadas para a Carreira. Somente a primeira região (Interior)
// possui uma pista totalmente construída e jogável nesta versão (fatia vertical).
// As demais já existem na arquitetura de dados para a progressão de Carreira,
// Mapa do Mundo e economia, e serão implementadas com pistas completas nas
// próximas atualizações.
export const REGIONS: RegionDef[] = [
  { id: 'interior', name: 'Interior', description: 'Fazendas, estradas de terra e pontes de madeira.', unlockCost: 0, unlocked: true, environment: 'campo', trackIds: ['campo-1'] },
  { id: 'cidade', name: 'Cidade', description: 'Ruas estreitas e tráfego intenso.', unlockCost: 15000, unlocked: false, environment: 'urbano', trackIds: ['cidade-1'] },
  { id: 'deserto', name: 'Deserto', description: 'Dunas, calor e longas retas.', unlockCost: 22000, unlocked: false, environment: 'deserto', trackIds: ['deserto-1'] },
  { id: 'litoral', name: 'Litoral', description: 'Estradas costeiras e curvas rápidas.', unlockCost: 30000, unlocked: false, environment: 'litoral', trackIds: ['litoral-1'] },
  { id: 'montanha', name: 'Montanhas Nevadas', description: 'Neve, gelo e precipícios.', unlockCost: 40000, unlocked: false, environment: 'neve', trackIds: ['montanha-1'] },
  { id: 'industrial', name: 'Zona Industrial', description: 'Fábricas, contêineres e atalhos arriscados.', unlockCost: 55000, unlocked: false, environment: 'industrial', trackIds: ['industrial-1'] },
  { id: 'floresta', name: 'Floresta', description: 'Trilhas sinuosas entre árvores densas.', unlockCost: 70000, unlocked: false, environment: 'floresta', trackIds: ['floresta-1'] },
  { id: 'cidade-noturna', name: 'Cidade Noturna', description: 'Neon, chuva e perseguições policiais.', unlockCost: 90000, unlocked: false, environment: 'noturno', trackIds: ['noturna-1'] },
  { id: 'circuito-pro', name: 'Circuito Profissional', description: 'Traçado técnico de nível mundial.', unlockCost: 120000, unlocked: false, environment: 'circuito', trackIds: ['circuito-1'] },
  { id: 'ilha', name: 'Ilha', description: 'Pontes, praias e o Grande Final.', unlockCost: 160000, unlocked: false, environment: 'ilha', trackIds: ['ilha-1'] },
];

export const TRACKS: TrackDef[] = [
  {
    id: 'campo-1', regionId: 'interior', name: 'Vale Verde',
    description: 'Circuito rural original com fazendas, ponte de madeira e trecho de terra.',
    lengthMeters: 1840, laps: 3, terrain: 'terra',
    eventTypes: ['circuito', 'contrarrelogio', 'melhor_volta', 'drift', 'sprint', 'eliminacao', 'destruicao', 'duelo_rival'],
  },
  // Definições futuras (arquitetura pronta, geometria a implementar):
  { id: 'cidade-1', regionId: 'cidade', name: 'Distrito Central', description: 'Em breve.', lengthMeters: 2100, laps: 3, terrain: 'cidade', eventTypes: ['circuito', 'sprint'] },
  { id: 'deserto-1', regionId: 'deserto', name: 'Rota das Dunas', description: 'Em breve.', lengthMeters: 2600, laps: 3, terrain: 'asfalto', eventTypes: ['circuito', 'contrarrelogio'] },
  { id: 'litoral-1', regionId: 'litoral', name: 'Baía Azul', description: 'Em breve.', lengthMeters: 2300, laps: 3, terrain: 'asfalto', eventTypes: ['circuito', 'drift'] },
  { id: 'montanha-1', regionId: 'montanha', name: 'Passo Gelado', description: 'Em breve.', lengthMeters: 2400, laps: 3, terrain: 'montanha', eventTypes: ['circuito', 'contrarrelogio'] },
  { id: 'industrial-1', regionId: 'industrial', name: 'Complexo Cinza', description: 'Em breve.', lengthMeters: 2000, laps: 3, terrain: 'extremo', eventTypes: ['circuito', 'destruicao'] },
  { id: 'floresta-1', regionId: 'floresta', name: 'Trilha Sombria', description: 'Em breve.', lengthMeters: 2200, laps: 3, terrain: 'terra', eventTypes: ['circuito', 'melhor_volta'] },
  { id: 'noturna-1', regionId: 'cidade-noturna', name: 'Neon Boulevard', description: 'Em breve.', lengthMeters: 2500, laps: 3, terrain: 'cidade', eventTypes: ['circuito', 'duelo_rival'] },
  { id: 'circuito-1', regionId: 'circuito-pro', name: 'Autódromo Nacional', description: 'Em breve.', lengthMeters: 3200, laps: 4, terrain: 'asfalto', eventTypes: ['circuito', 'contrarrelogio', 'melhor_volta'] },
  { id: 'ilha-1', regionId: 'ilha', name: 'Grande Final', description: 'Em breve.', lengthMeters: 3600, laps: 4, terrain: 'extremo', eventTypes: ['circuito', 'duelo_rival'] },
];

export function getTrack(id: string): TrackDef {
  const t = TRACKS.find((t) => t.id === id);
  if (!t) throw new Error(`Pista desconhecida: ${id}`);
  return t;
}

export function tracksForRegion(regionId: string): TrackDef[] {
  return TRACKS.filter((t) => t.regionId === regionId);
}

export const RIVALS: RivalDef[] = [
  { id: 'rival_interior', name: 'Zeca "Poeira"', style: 'agressivo', carId: 'street', regionId: 'interior' },
];

export const CAREER_EVENTS: CareerEventDef[] = [
  { id: 'ev_campo_1', trackId: 'campo-1', eventType: 'circuito', difficulty: 'facil', weather: 'sunny', time: 'day', laps: 2, unlockedByDefault: true },
  { id: 'ev_campo_2', trackId: 'campo-1', eventType: 'sprint', difficulty: 'facil', weather: 'sunny', time: 'day', laps: 1, unlockedByDefault: true },
  { id: 'ev_campo_3', trackId: 'campo-1', eventType: 'contrarrelogio', difficulty: 'normal', weather: 'cloudy', time: 'day', laps: 3 },
  { id: 'ev_campo_4', trackId: 'campo-1', eventType: 'circuito', difficulty: 'normal', weather: 'rain', time: 'evening', laps: 3 },
  { id: 'ev_campo_5', trackId: 'campo-1', eventType: 'drift', difficulty: 'normal', weather: 'sunny', time: 'day', laps: 2 },
  { id: 'ev_campo_6', trackId: 'campo-1', eventType: 'eliminacao', difficulty: 'dificil', weather: 'cloudy', time: 'night', laps: 4 },
  { id: 'ev_campo_7', trackId: 'campo-1', eventType: 'destruicao', difficulty: 'dificil', weather: 'storm', time: 'night', laps: 3 },
  { id: 'ev_campo_8', trackId: 'campo-1', eventType: 'duelo_rival', difficulty: 'profissional', weather: 'storm', time: 'night', laps: 3, rivalId: 'rival_interior' },
];

export function eventsForTrack(trackId: string): CareerEventDef[] {
  return CAREER_EVENTS.filter((e) => e.trackId === trackId);
}
