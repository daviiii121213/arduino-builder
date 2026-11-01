/* ==========================================================================
   01 — Bibliotecas: materiais, tipos de cômodo, mobiliário
   ========================================================================== */

AS.ROOM_TYPES = [
  { id: 'sala', name: 'Sala de estar', color: '#e9dcc6', floor: 'porc_bege' },
  { id: 'jantar', name: 'Sala de jantar', color: '#e6d6bd', floor: 'porc_bege' },
  { id: 'cozinha', name: 'Cozinha', color: '#d9e4dc', floor: 'ceram_branca' },
  { id: 'quarto', name: 'Quarto', color: '#dfe2ee', floor: 'mad_carvalho' },
  { id: 'suite', name: 'Suíte', color: '#d9dcef', floor: 'mad_carvalho' },
  { id: 'banheiro', name: 'Banheiro', color: '#d4e6ec', floor: 'ceram_cinza' },
  { id: 'lavanderia', name: 'Lavanderia', color: '#dde8e3', floor: 'ceram_cinza' },
  { id: 'garagem', name: 'Garagem', color: '#dedcd8', floor: 'concreto' },
  { id: 'circulacao', name: 'Circulação', color: '#ece6dc', floor: 'porc_bege' },
  { id: 'varanda', name: 'Varanda', color: '#e7e1cf', floor: 'pedra_ard' },
  { id: 'escritorio', name: 'Escritório', color: '#e2e6dc', floor: 'mad_carvalho' },
  { id: 'deposito', name: 'Depósito', color: '#e3e0da', floor: 'concreto' },
  { id: 'escada', name: 'Escada', color: '#e4e0d6', floor: 'pedra_ard' },
  { id: 'outro', name: 'Outro', color: '#e8e5e0', floor: 'porc_bege' },
];
AS.roomType = (id) => AS.ROOM_TYPES.find(t => t.id === id) || AS.ROOM_TYPES[AS.ROOM_TYPES.length - 1];

/* pattern: none | wood | tile | concrete | marble | stone | brick | glass | metal */
AS.DEFAULT_MATERIALS = [
  { id: 'pint_branca', name: 'Pintura branca', cat: 'Pintura', color: '#f2f0eb', rough: 0.9, metal: 0, pattern: 'none' },
  { id: 'pint_gelo', name: 'Pintura gelo', cat: 'Pintura', color: '#e8e4dc', rough: 0.9, metal: 0, pattern: 'none' },
  { id: 'pint_cinza', name: 'Pintura cinza', cat: 'Pintura', color: '#b9bcbf', rough: 0.9, metal: 0, pattern: 'none' },
  { id: 'pint_verde', name: 'Pintura verde sálvia', cat: 'Pintura', color: '#a9b8a0', rough: 0.9, metal: 0, pattern: 'none' },
  { id: 'pint_terra', name: 'Pintura terracota', cat: 'Pintura', color: '#c98c6c', rough: 0.9, metal: 0, pattern: 'none' },
  { id: 'textura_ext', name: 'Textura externa areia', cat: 'Pintura', color: '#d8cdb8', rough: 1, metal: 0, pattern: 'concrete' },
  { id: 'ceram_branca', name: 'Cerâmica branca 30×30', cat: 'Cerâmica', color: '#eeeeea', rough: 0.5, metal: 0, pattern: 'tile', tile: 30 },
  { id: 'ceram_cinza', name: 'Cerâmica cinza 45×45', cat: 'Cerâmica', color: '#c4c6c6', rough: 0.5, metal: 0, pattern: 'tile', tile: 45 },
  { id: 'ceram_metro', name: 'Revestimento metrô', cat: 'Cerâmica', color: '#f4f4f0', rough: 0.3, metal: 0, pattern: 'brick', tile: 15 },
  { id: 'porc_bege', name: 'Porcelanato bege 60×60', cat: 'Porcelanato', color: '#ddd3c2', rough: 0.35, metal: 0, pattern: 'tile', tile: 60 },
  { id: 'porc_cimenticio', name: 'Porcelanato cimentício 90×90', cat: 'Porcelanato', color: '#b8b5ae', rough: 0.45, metal: 0, pattern: 'tile', tile: 90 },
  { id: 'mad_carvalho', name: 'Madeira carvalho', cat: 'Madeira', color: '#b48a5e', rough: 0.6, metal: 0, pattern: 'wood' },
  { id: 'mad_freijo', name: 'Madeira freijó', cat: 'Madeira', color: '#a77b4f', rough: 0.6, metal: 0, pattern: 'wood' },
  { id: 'mad_escura', name: 'Madeira imbuia', cat: 'Madeira', color: '#6b4a33', rough: 0.55, metal: 0, pattern: 'wood' },
  { id: 'mdf_branco', name: 'MDF branco', cat: 'Madeira', color: '#efefec', rough: 0.4, metal: 0, pattern: 'none' },
  { id: 'concreto', name: 'Concreto aparente', cat: 'Concreto', color: '#a8a7a2', rough: 0.95, metal: 0, pattern: 'concrete' },
  { id: 'cimento_queim', name: 'Cimento queimado', cat: 'Concreto', color: '#9b9a95', rough: 0.6, metal: 0, pattern: 'concrete' },
  { id: 'vidro', name: 'Vidro incolor', cat: 'Vidro', color: '#bcd6dc', rough: 0.05, metal: 0, pattern: 'glass', opacity: 0.35 },
  { id: 'vidro_fume', name: 'Vidro fumê', cat: 'Vidro', color: '#5f6b6e', rough: 0.05, metal: 0, pattern: 'glass', opacity: 0.5 },
  { id: 'aluminio', name: 'Alumínio natural', cat: 'Metal', color: '#c7c9cb', rough: 0.35, metal: 0.8, pattern: 'metal' },
  { id: 'aluminio_preto', name: 'Alumínio preto', cat: 'Metal', color: '#2d2e30', rough: 0.4, metal: 0.6, pattern: 'metal' },
  { id: 'inox', name: 'Aço inox', cat: 'Metal', color: '#d3d5d6', rough: 0.25, metal: 0.9, pattern: 'metal' },
  { id: 'pedra_ard', name: 'Pedra ardósia', cat: 'Pedra', color: '#6f7472', rough: 0.8, metal: 0, pattern: 'stone' },
  { id: 'pedra_miracema', name: 'Pedra miracema', cat: 'Pedra', color: '#a49d8f', rough: 0.85, metal: 0, pattern: 'stone' },
  { id: 'granito_preto', name: 'Granito preto', cat: 'Pedra', color: '#262626', rough: 0.2, metal: 0, pattern: 'stone' },
  { id: 'marmore_carrara', name: 'Mármore carrara', cat: 'Mármore', color: '#eceae6', rough: 0.15, metal: 0, pattern: 'marble' },
  { id: 'marmore_travert', name: 'Travertino', cat: 'Mármore', color: '#dcccb0', rough: 0.3, metal: 0, pattern: 'marble' },
  { id: 'tecido_cinza', name: 'Tecido cinza', cat: 'Tecido', color: '#8d9094', rough: 1, metal: 0, pattern: 'none' },
  { id: 'tecido_areia', name: 'Tecido areia', cat: 'Tecido', color: '#cdbfa7', rough: 1, metal: 0, pattern: 'none' },
  { id: 'tecido_azul', name: 'Tecido azul', cat: 'Tecido', color: '#56708f', rough: 1, metal: 0, pattern: 'none' },
  { id: 'loucas', name: 'Louça branca', cat: 'Cerâmica', color: '#fafafa', rough: 0.15, metal: 0, pattern: 'none' },
  { id: 'tijolo', name: 'Tijolo aparente', cat: 'Pedra', color: '#a5583f', rough: 0.9, metal: 0, pattern: 'brick', tile: 22 },
];

/* Catálogo de mobiliário — dimensões em cm (w = largura, d = profundidade, h = altura) */
AS.FURNITURE = [
  { type: 'cama_casal', name: 'Cama casal', cat: 'Camas', w: 158, d: 198, h: 50, mat: 'tecido_areia' },
  { type: 'cama_queen', name: 'Cama queen', cat: 'Camas', w: 168, d: 208, h: 52, mat: 'tecido_areia' },
  { type: 'cama_solteiro', name: 'Cama solteiro', cat: 'Camas', w: 98, d: 198, h: 48, mat: 'tecido_azul' },
  { type: 'criado', name: 'Criado-mudo', cat: 'Camas', w: 45, d: 40, h: 55, mat: 'mad_freijo' },
  { type: 'sofa3', name: 'Sofá 3 lugares', cat: 'Sofás', w: 210, d: 90, h: 85, mat: 'tecido_cinza' },
  { type: 'sofa2', name: 'Sofá 2 lugares', cat: 'Sofás', w: 160, d: 88, h: 85, mat: 'tecido_cinza' },
  { type: 'poltrona', name: 'Poltrona', cat: 'Sofás', w: 80, d: 82, h: 85, mat: 'tecido_azul' },
  { type: 'mesa_jantar4', name: 'Mesa de jantar 4 lugares', cat: 'Mesas', w: 120, d: 80, h: 76, mat: 'mad_freijo' },
  { type: 'mesa_jantar6', name: 'Mesa de jantar 6 lugares', cat: 'Mesas', w: 180, d: 90, h: 76, mat: 'mad_freijo' },
  { type: 'mesa_redonda', name: 'Mesa redonda', cat: 'Mesas', w: 100, d: 100, h: 76, mat: 'mad_carvalho' },
  { type: 'mesa_centro', name: 'Mesa de centro', cat: 'Mesas', w: 100, d: 55, h: 40, mat: 'mad_escura' },
  { type: 'cadeira', name: 'Cadeira', cat: 'Cadeiras', w: 45, d: 50, h: 85, mat: 'mad_carvalho' },
  { type: 'banqueta', name: 'Banqueta', cat: 'Cadeiras', w: 38, d: 38, h: 75, mat: 'aluminio_preto' },
  { type: 'guarda_roupa', name: 'Guarda-roupa', cat: 'Guarda-roupas', w: 200, d: 60, h: 230, mat: 'mdf_branco' },
  { type: 'armario_coz', name: 'Armário de cozinha (balcão)', cat: 'Armários de cozinha', w: 120, d: 60, h: 90, mat: 'mdf_branco' },
  { type: 'armario_alto', name: 'Armário alto / torre', cat: 'Armários de cozinha', w: 60, d: 60, h: 220, mat: 'mdf_branco' },
  { type: 'geladeira', name: 'Geladeira', cat: 'Geladeiras', w: 70, d: 72, h: 180, mat: 'inox' },
  { type: 'fogao', name: 'Fogão 4 bocas', cat: 'Fogões', w: 55, d: 60, h: 90, mat: 'inox' },
  { type: 'cooktop', name: 'Cooktop (no balcão)', cat: 'Fogões', w: 60, d: 52, h: 92, mat: 'granito_preto' },
  { type: 'pia_coz', name: 'Pia de cozinha', cat: 'Pias', w: 120, d: 60, h: 90, mat: 'granito_preto' },
  { type: 'lavatorio', name: 'Lavatório (bancada)', cat: 'Pias', w: 80, d: 50, h: 85, mat: 'marmore_carrara' },
  { type: 'tanque', name: 'Tanque', cat: 'Pias', w: 60, d: 55, h: 85, mat: 'loucas' },
  { type: 'maq_lavar', name: 'Máquina de lavar', cat: 'Pias', w: 60, d: 65, h: 100, mat: 'loucas' },
  { type: 'box', name: 'Box de chuveiro', cat: 'Chuveiros', w: 90, d: 90, h: 200, mat: 'vidro' },
  { type: 'vaso', name: 'Vaso sanitário', cat: 'Vasos sanitários', w: 38, d: 65, h: 40, mat: 'loucas' },
  { type: 'banheira', name: 'Banheira', cat: 'Banheiras', w: 170, d: 75, h: 55, mat: 'loucas' },
  { type: 'escrivaninha', name: 'Escrivaninha', cat: 'Escrivaninhas', w: 120, d: 60, h: 75, mat: 'mad_carvalho' },
  { type: 'estante', name: 'Estante', cat: 'Estantes', w: 100, d: 35, h: 190, mat: 'mad_freijo' },
  { type: 'rack', name: 'Rack de TV', cat: 'Estantes', w: 180, d: 45, h: 50, mat: 'mad_escura' },
  { type: 'planta', name: 'Vaso com planta', cat: 'Decoração', w: 45, d: 45, h: 120, mat: 'pint_verde' },
  { type: 'tapete', name: 'Tapete', cat: 'Decoração', w: 200, d: 140, h: 1, mat: 'tecido_areia' },
  { type: 'carro', name: 'Carro (referência)', cat: 'Decoração', w: 180, d: 450, h: 150, mat: 'pint_cinza' },
  { type: 'escada_reta', name: 'Escada reta', cat: 'Elementos', w: 100, d: 300, h: 290, mat: 'concreto' },
];
AS.furnDef = (type) => AS.FURNITURE.find(f => f.type === type) || AS.FURNITURE[0];

AS.DOOR_TYPES = [
  { id: 'giro', name: 'De giro' }, { id: 'dupla', name: 'De giro dupla' },
  { id: 'correr', name: 'De correr' }, { id: 'passagem', name: 'Vão livre (sem folha)' },
];
AS.WINDOW_TYPES = [
  { id: 'correr', name: 'De correr' }, { id: 'basculante', name: 'Basculante' },
  { id: 'maximar', name: 'Maxim-ar' }, { id: 'fixa', name: 'Fixa' },
];
