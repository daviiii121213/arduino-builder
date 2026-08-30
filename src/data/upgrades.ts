import type { UpgradeDef } from './types';

export const UPGRADES: UpgradeDef[] = [
  {
    slot: 'motor', name: 'Motor',
    levels: [
      { level: 1, price: 1500, description: 'Filtro de ar esportivo', effects: { acceleration: 4, topSpeed: 4 } },
      { level: 2, price: 3500, description: 'Injeção eletrônica ajustada', effects: { acceleration: 8, topSpeed: 8 } },
      { level: 3, price: 7000, description: 'Bloco retrabalhado', effects: { acceleration: 13, topSpeed: 14 } },
    ],
  },
  {
    slot: 'turbo', name: 'Turbo',
    levels: [
      { level: 1, price: 2000, description: 'Turbo compacto', effects: { topSpeed: 6, acceleration: 3 } },
      { level: 2, price: 4500, description: 'Turbo de esteira dupla', effects: { topSpeed: 12, acceleration: 6 } },
      { level: 3, price: 9000, description: 'Turbo de competição', effects: { topSpeed: 20, acceleration: 10 } },
    ],
  },
  {
    slot: 'freios', name: 'Freios',
    levels: [
      { level: 1, price: 1200, description: 'Pastilhas esportivas', effects: { braking: 6 } },
      { level: 2, price: 2800, description: 'Discos ventilados', effects: { braking: 12 } },
      { level: 3, price: 5600, description: 'Freios cerâmicos', effects: { braking: 20 } },
    ],
  },
  {
    slot: 'pneus', name: 'Pneus',
    levels: [
      { level: 1, price: 1000, description: 'Composto médio', effects: { grip: 5, handling: 3 } },
      { level: 2, price: 2400, description: 'Composto macio', effects: { grip: 10, handling: 6 } },
      { level: 3, price: 4800, description: 'Composto de competição', effects: { grip: 16, handling: 10 } },
    ],
  },
  {
    slot: 'suspensao', name: 'Suspensão',
    levels: [
      { level: 1, price: 1300, description: 'Molas esportivas', effects: { handling: 6, grip: 3 } },
      { level: 2, price: 3000, description: 'Amortecedores ajustáveis', effects: { handling: 12, grip: 6 } },
      { level: 3, price: 6000, description: 'Suspensão de competição', effects: { handling: 18, grip: 10 } },
    ],
  },
  {
    slot: 'transmissao', name: 'Transmissão',
    levels: [
      { level: 1, price: 1500, description: 'Relação curta', effects: { acceleration: 5 } },
      { level: 2, price: 3200, description: 'Câmbio de dupla embreagem', effects: { acceleration: 9, braking: 2 } },
      { level: 3, price: 6400, description: 'Câmbio sequencial', effects: { acceleration: 14, braking: 4 } },
    ],
  },
  {
    slot: 'nitro', name: 'Nitro',
    levels: [
      { level: 1, price: 1800, description: 'Bico injetor extra', effects: { nitroCapacity: 15 } },
      { level: 2, price: 4000, description: 'Cilindro reforçado', effects: { nitroCapacity: 30 } },
      { level: 3, price: 8000, description: 'Sistema de nitro duplo', effects: { nitroCapacity: 50 } },
    ],
  },
];

export function getUpgrade(slot: string): UpgradeDef {
  const u = UPGRADES.find((u) => u.slot === slot);
  if (!u) throw new Error(`Upgrade desconhecido: ${slot}`);
  return u;
}
