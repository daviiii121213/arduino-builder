/**
 * Paleta mestra do jogo.
 * Uma única paleta limitada mantém o estilo coeso, como num RPG indie clássico.
 */
export const P = {
  // Preto / contornos
  contorno: '#161320',
  contornoSuave: '#241f33',
  sombra: '#00000055',
  sombraForte: '#0000008c',

  // Pele e roupas do protagonista
  pele: '#f0c090',
  peleSombra: '#c98f63',
  cabelo: '#4a2f1c',
  cabeloLuz: '#6b4527',
  camisa: '#3f7fd6',
  camisaSombra: '#2b5798',
  calca: '#6b4a2b',
  calcaSombra: '#4a3119',
  bota: '#3a2a1e',
  cachecol: '#c4453f',

  // Terreno
  grama: '#4f9b3f',
  gramaClara: '#63b34c',
  gramaEscura: '#3d7c33',
  gramaSeca: '#b9a35c',
  terra: '#7c5636',
  terraClara: '#96693f',
  terraEscura: '#5c3e26',
  areia: '#dcc48c',
  areiaEscura: '#bda067',
  aguaRasa: '#3f95ad',
  aguaFunda: '#215d80',
  aguaEspuma: '#a8dde8',
  pedra: '#8a8b99',
  pedraClara: '#a9aab8',
  pedraEscura: '#5f6070',
  lama: '#6a5136',

  // Vegetação
  folha: '#3f7f36',
  folhaClara: '#57a544',
  folhaEscura: '#2c5c28',
  tronco: '#5c3d24',
  troncoLuz: '#7a5231',
  samambaia: '#4a9a55',
  flor: '#e9628d',
  florAmarela: '#f7d148',

  // Madeira / casa
  madeira: '#8d6437',
  madeiraClara: '#a97f4b',
  madeiraEscura: '#5a3c20',
  telhado: '#a3423a',
  telhadoEscuro: '#7a2e2a',
  telhadoLuz: '#c4574c',
  vidro: '#8fd8e8',
  vidroLuz: '#d6f4fb',
  metal: '#9aa0ad',
  metalEscuro: '#666c78',
  tijolo: '#96543f',

  // Interface
  osso: '#f2e3c2',
  ossoEscuro: '#c9b48c',
  ambar: '#ffc75a',
  ambarEscuro: '#b97d1f',
  coracao: '#e0403f',
  coracaoLuz: '#ff7a72',
  coracaoVazio: '#4a2b31',
  fome: '#e08b3a',
  painel: '#241d2e',
  painelClaro: '#3a2f49',

  // Efeitos
  brilho: '#fff6d0',
  magia: '#a56bff',
  magiaClara: '#d7b4ff',
  magiaEscura: '#6a34c0',
  sangue: '#b8322f',
  fogo: '#ff8a3c',
  fogoClaro: '#ffd76b',
  fumaca: '#b9b3c9',
  raio: '#9fe8ff',
} as const;
