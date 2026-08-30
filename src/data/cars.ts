import type { CarDef } from './types';

// 12 cars originais (arquitetura suporta até 15). Preços em Reais (R$).
export const CARS: CarDef[] = [
  {
    id: 'compact', name: 'Pequira Compacto', category: 'Compacto', price: 0,
    color: '#c9c9c9', colorDark: '#8a8a8a', colorAccent: '#5b7',
    stats: { topSpeed: 148, acceleration: 38, braking: 55, grip: 50, handling: 62, driftFactor: 30, weight: 980, durability: 60, fuelCapacity: 40, nitroCapacity: 80 },
  },
  {
    id: 'street', name: 'Vanta Rua', category: 'Rua', price: 4000,
    color: '#3d7dd8', colorDark: '#26508f', colorAccent: '#eee',
    stats: { topSpeed: 168, acceleration: 46, braking: 58, grip: 55, handling: 64, driftFactor: 34, weight: 1050, durability: 62, fuelCapacity: 42, nitroCapacity: 85 },
  },
  {
    id: 'sport', name: 'Faísca Esporte', category: 'Esportivo', price: 8000,
    color: '#e8442f', colorDark: '#9c2a1c', colorAccent: '#fff',
    stats: { topSpeed: 188, acceleration: 55, braking: 62, grip: 60, handling: 68, driftFactor: 40, weight: 1120, durability: 58, fuelCapacity: 44, nitroCapacity: 90 },
  },
  {
    id: 'gt', name: 'Aurora GT', category: 'GT', price: 13000,
    color: '#f2b90f', colorDark: '#a37c07', colorAccent: '#222',
    stats: { topSpeed: 205, acceleration: 60, braking: 66, grip: 64, handling: 66, driftFactor: 42, weight: 1250, durability: 66, fuelCapacity: 50, nitroCapacity: 95 },
  },
  {
    id: 'rally', name: 'Trilha Rally', category: 'Rally', price: 18000,
    color: '#3a8f4a', colorDark: '#255c30', colorAccent: '#e8d24a',
    stats: { topSpeed: 195, acceleration: 58, braking: 64, grip: 74, handling: 78, driftFactor: 58, weight: 1300, durability: 78, fuelCapacity: 55, nitroCapacity: 90 },
  },
  {
    id: 'muscle', name: 'Fúria Muscle', category: 'Muscle', price: 25000,
    color: '#8b1e1e', colorDark: '#4f0f0f', colorAccent: '#ffb400',
    stats: { topSpeed: 218, acceleration: 68, braking: 58, grip: 58, handling: 52, driftFactor: 62, weight: 1520, durability: 82, fuelCapacity: 60, nitroCapacity: 100 },
  },
  {
    id: 'turbo', name: 'Ciclone Turbo', category: 'Turbo', price: 35000,
    color: '#1fa7a7', colorDark: '#0f6666', colorAccent: '#dff',
    stats: { topSpeed: 235, acceleration: 72, braking: 70, grip: 68, handling: 70, driftFactor: 50, weight: 1180, durability: 60, fuelCapacity: 48, nitroCapacity: 105 },
  },
  {
    id: 'super', name: 'Zephyr Super', category: 'Super', price: 50000,
    color: '#7a2fd0', colorDark: '#481a80', colorAccent: '#f0e5ff',
    stats: { topSpeed: 252, acceleration: 78, braking: 74, grip: 76, handling: 76, driftFactor: 46, weight: 1200, durability: 62, fuelCapacity: 52, nitroCapacity: 110 },
  },
  {
    id: 'track', name: 'Ápice Track', category: 'Track', price: 70000,
    color: '#e8e8e8', colorDark: '#a3a3a3', colorAccent: '#ff2d2d',
    stats: { topSpeed: 262, acceleration: 80, braking: 82, grip: 86, handling: 84, driftFactor: 40, weight: 1080, durability: 55, fuelCapacity: 46, nitroCapacity: 100 },
  },
  {
    id: 'hyper', name: 'Nébula Hyper', category: 'Hyper', price: 100000,
    color: '#101820', colorDark: '#000', colorAccent: '#3ce6ff',
    stats: { topSpeed: 278, acceleration: 86, braking: 84, grip: 82, handling: 80, driftFactor: 44, weight: 1150, durability: 58, fuelCapacity: 50, nitroCapacity: 115 },
  },
  {
    id: 'legend', name: 'Titã Lenda', category: 'Lenda', price: 150000,
    color: '#b8860b', colorDark: '#6b4d05', colorAccent: '#111',
    stats: { topSpeed: 292, acceleration: 90, braking: 88, grip: 88, handling: 86, driftFactor: 48, weight: 1200, durability: 68, fuelCapacity: 55, nitroCapacity: 120 },
  },
  {
    id: 'ultimate', name: 'Ômega Ultimate', category: 'Ultimate', price: 250000,
    color: '#ff2d55', colorDark: '#7a0f28', colorAccent: '#fff',
    stats: { topSpeed: 310, acceleration: 96, braking: 92, grip: 92, handling: 90, driftFactor: 50, weight: 1220, durability: 70, fuelCapacity: 58, nitroCapacity: 130 },
  },
  // carro especial, desbloqueado por conquista/rival, não comprável
  {
    id: 'special_phantom', name: 'Fantasma Noturno', category: 'Especial', price: 0, special: true,
    color: '#181818', colorDark: '#000', colorAccent: '#8f3cff',
    stats: { topSpeed: 300, acceleration: 92, braking: 90, grip: 90, handling: 88, driftFactor: 70, weight: 1100, durability: 65, fuelCapacity: 50, nitroCapacity: 140 },
  },
];

export function getCarDef(id: string): CarDef {
  const c = CARS.find((c) => c.id === id);
  if (!c) throw new Error(`Carro desconhecido: ${id}`);
  return c;
}
