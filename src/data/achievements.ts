export interface AchievementDef {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeira_vitoria', name: 'Primeira Vitória', description: 'Vença sua primeira corrida.' },
  { id: 'vitoria_sem_colisao', name: 'Pilotagem Limpa', description: 'Vença uma corrida sem nenhuma colisão.' },
  { id: 'drift_mestre', name: 'Mestre do Drift', description: 'Acumule 1000 pontos de drift em uma única corrida.' },
  { id: 'vitoria_tempestade', name: 'Fúria da Tempestade', description: 'Vença uma corrida durante uma tempestade.' },
  { id: 'colecionador_50k', name: 'Bolso Cheio', description: 'Acumule R$ 50.000.' },
  { id: 'todos_carros_interior', name: 'Garagem do Interior', description: 'Possua todos os carros iniciais disponíveis.' },
  { id: 'recorde_volta', name: 'Novo Recorde', description: 'Estabeleça um novo recorde de melhor volta em uma pista.' },
];
