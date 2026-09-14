import type { Database, Ingredient, OptionGroup, Product, Settings } from '../types';

const now = new Date().toISOString();

const g = (id: string, label: string, type: 'single' | 'multi', required: boolean, options: [string, number][]): OptionGroup => ({
  id,
  label,
  type,
  required,
  options: options.map(([lbl, delta], i) => ({ id: `${id}-${i}`, label: lbl, priceDelta: delta })),
});

const TAMANHO_BOLO = (): OptionGroup =>
  g('tamanho', 'Tamanho', 'single', true, [
    ['Pequeno — 12 fatias (1,5 kg)', 0],
    ['Médio — 20 fatias (2,5 kg)', 28],
    ['Grande — 30 fatias (3,5 kg)', 55],
  ]);

const RECHEIO = (extra: [string, number][] = []): OptionGroup =>
  g('recheio', 'Recheio', 'single', true, [
    ['Brigadeiro cremoso', 0],
    ['Creme de ninho', 6],
    ['Morango com chantilly', 8],
    ['Doce de leite', 5],
    ...extra,
  ]);

const COBERTURA = (): OptionGroup =>
  g('cobertura', 'Cobertura', 'single', false, [
    ['Ganache de chocolate', 0],
    ['Chantilly', 4],
    ['Chocolate branco', 6],
    ['Frutas frescas', 12],
  ]);

const ADICIONAIS = (): OptionGroup =>
  g('adicionais', 'Adicionais', 'multi', false, [
    ['Vela numérica', 5],
    ['Topo personalizado', 18],
    ['Embalagem para presente', 9],
    ['Mensagem escrita no bolo', 7],
  ]);

const product = (p: Partial<Product> & Pick<Product, 'id' | 'name' | 'description' | 'details' | 'price' | 'category' | 'art'>): Product => ({
  available: true,
  featured: false,
  bestSeller: false,
  promoPrice: null,
  unitLabel: 'unidade',
  prepDays: 1,
  stock: null,
  optionGroups: [],
  image: undefined,
  createdAt: now,
  updatedAt: now,
  ...p,
});

export const SEED_PRODUCTS: Product[] = [
  product({
    id: 'prod-bolo-chocolate',
    name: 'Bolo de Chocolate',
    description: 'Massa fofinha de chocolate belga com recheio cremoso e ganache.',
    details:
      'Nosso clássico mais pedido: três camadas de massa de chocolate belga, recheio cremoso à sua escolha e cobertura de ganache com raspas artesanais. Feito sob encomenda, no dia da entrega.',
    price: 45,
    category: 'bolos',
    art: 'bolo-chocolate',
    featured: true,
    bestSeller: true,
    prepDays: 1,
    optionGroups: [TAMANHO_BOLO(), RECHEIO([['Nutella', 14]]), COBERTURA(), ADICIONAIS()],
  }),
  product({
    id: 'prod-bolo-morango',
    name: 'Bolo de Morango',
    description: 'Massa branca, chantilly e morangos frescos selecionados.',
    details:
      'Massa branca leve intercalada com chantilly batido na hora e morangos frescos selecionados pela manhã. Leve, delicado e perfeito para aniversários.',
    price: 52,
    category: 'bolos',
    art: 'bolo-morango',
    featured: true,
    bestSeller: true,
    optionGroups: [TAMANHO_BOLO(), RECHEIO([['Morango com ninho', 10]]), COBERTURA(), ADICIONAIS()],
  }),
  product({
    id: 'prod-bolo-ninho',
    name: 'Bolo de Ninho com Nutella',
    description: 'Creme de leite ninho com generosas camadas de Nutella.',
    details:
      'Massa branca amanteigada, recheio generoso de creme de leite ninho e Nutella, finalizado com cobertura aveludada e confeitos de chocolate.',
    price: 62,
    category: 'bolos',
    art: 'bolo-ninho',
    featured: true,
    optionGroups: [TAMANHO_BOLO(), RECHEIO([['Ninho com Nutella', 12]]), COBERTURA(), ADICIONAIS()],
  }),
  product({
    id: 'prod-bolo-redvelvet',
    name: 'Bolo Red Velvet',
    description: 'Massa aveludada vermelha com cream cheese artesanal.',
    details: 'A massa aveludada tradicional americana com recheio de cream cheese levemente adocicado e cobertura lisa impecável.',
    price: 68,
    category: 'bolos',
    art: 'bolo-redvelvet',
    prepDays: 2,
    optionGroups: [TAMANHO_BOLO(), g('recheio', 'Recheio', 'single', true, [['Cream cheese', 0], ['Cream cheese com frutas vermelhas', 10]]), ADICIONAIS()],
  }),
  product({
    id: 'prod-naked-cake',
    name: 'Naked Cake de Frutas Vermelhas',
    description: 'Camadas à mostra, chantilly e frutas vermelhas.',
    details: 'Tendência das festas rústicas: camadas de massa à mostra, chantilly artesanal e frutas vermelhas frescas por cima.',
    price: 89,
    category: 'bolos',
    art: 'naked-cake',
    prepDays: 2,
    optionGroups: [TAMANHO_BOLO(), RECHEIO(), ADICIONAIS()],
  }),
  product({
    id: 'prod-brigadeiro',
    name: 'Brigadeiro Gourmet',
    description: 'Feito com chocolate nobre e granulado belga. Cento fechado.',
    details:
      'Brigadeiro cremoso preparado com chocolate nobre 53% e finalizado com granulado belga. Vendido em cento, embalado em forminhas de papel rígido.',
    price: 89.9,
    category: 'doces',
    art: 'brigadeiro',
    unitLabel: 'cento',
    bestSeller: true,
    featured: true,
    optionGroups: [
      g('quantidade-doce', 'Quantidade', 'single', true, [['50 unidades', -40], ['100 unidades (cento)', 0], ['150 unidades', 42]]),
      g('forminha', 'Forminha', 'single', false, [['Papel branco', 0], ['Papel colorido', 6], ['Forminha luxo', 14]]),
    ],
  }),
  product({
    id: 'prod-beijinho',
    name: 'Beijinho de Coco',
    description: 'Coco fresco, leite condensado e cravo. Cento fechado.',
    details: 'Beijinho tradicional com coco fresco ralado na hora e leite condensado cozido no ponto certo. Vendido em cento.',
    price: 84.9,
    category: 'doces',
    art: 'beijinho',
    unitLabel: 'cento',
    optionGroups: [
      g('quantidade-doce', 'Quantidade', 'single', true, [['50 unidades', -38], ['100 unidades (cento)', 0], ['150 unidades', 40]]),
      g('forminha', 'Forminha', 'single', false, [['Papel branco', 0], ['Papel colorido', 6], ['Forminha luxo', 14]]),
    ],
  }),
  product({
    id: 'prod-docinhos-gourmet',
    name: 'Bandeja de Docinhos Gourmet',
    description: 'Seleção com sete sabores especiais da casa.',
    details: 'Bandeja com 40 docinhos gourmet: brigadeiro belga, ninho com Nutella, maracujá, pistache, churros, limão siciliano e beijinho.',
    price: 74.9,
    category: 'doces',
    art: 'docinhos-gourmet',
    unitLabel: 'bandeja',
    optionGroups: [g('sabores', 'Sabores preferidos', 'multi', false, [['Brigadeiro belga', 0], ['Ninho com Nutella', 0], ['Maracujá', 0], ['Pistache', 8], ['Churros', 0], ['Limão siciliano', 0]])],
  }),
  product({
    id: 'prod-pao-de-mel',
    name: 'Pão de Mel Recheado',
    description: 'Massa de mel e especiarias banhada em chocolate.',
    details: 'Massa macia de mel e especiarias, recheada com doce de leite e banhada em chocolate meio amargo. Caixa com 6 unidades.',
    price: 39.9,
    category: 'doces',
    art: 'pao-de-mel',
    unitLabel: 'caixa com 6',
    optionGroups: [g('recheio-pm', 'Recheio', 'single', true, [['Doce de leite', 0], ['Brigadeiro', 0], ['Ninho', 4]])],
  }),
  product({
    id: 'prod-cupcake-chocolate',
    name: 'Cupcake de Chocolate',
    description: 'Cupcake de chocolate com buttercream e cereja.',
    details: 'Cupcake de chocolate meio amargo com cobertura de buttercream aveludado, granulado crocante e cereja no topo.',
    price: 9.5,
    category: 'cupcakes',
    art: 'cupcake-chocolate',
    bestSeller: true,
    optionGroups: [
      g('quantidade-cup', 'Embalagem', 'single', true, [['Unidade', 0], ['Caixa com 6', 48], ['Caixa com 12', 92]]),
      g('cobertura-cup', 'Cobertura', 'single', false, [['Buttercream de chocolate', 0], ['Ganache', 2], ['Chantilly', 1.5]]),
    ],
  }),
  product({
    id: 'prod-cupcake-baunilha',
    name: 'Cupcake de Baunilha',
    description: 'Massa de baunilha Bourbon com cobertura rosé.',
    details: 'Massa leve de baunilha Bourbon com cobertura rosé de cream cheese e morango fresco. Ideal para chás e festas infantis.',
    price: 9.5,
    category: 'cupcakes',
    art: 'cupcake-baunilha',
    optionGroups: [
      g('quantidade-cup', 'Embalagem', 'single', true, [['Unidade', 0], ['Caixa com 6', 48], ['Caixa com 12', 92]]),
      g('cobertura-cup', 'Cobertura', 'single', false, [['Cream cheese rosé', 0], ['Chantilly', 1], ['Chocolate branco', 2]]),
    ],
  }),
  product({
    id: 'prod-torta-morango',
    name: 'Torta de Morango',
    description: 'Massa amanteigada, creme belga e morangos frescos.',
    details: 'Massa amanteigada crocante, creme belga aveludado e uma camada generosa de morangos frescos com brilho de geleia.',
    price: 78,
    category: 'tortas',
    art: 'torta-morango',
    featured: true,
    prepDays: 1,
    optionGroups: [g('tamanho-torta', 'Tamanho', 'single', true, [['Média — 8 fatias', 0], ['Grande — 14 fatias', 36]])],
  }),
  product({
    id: 'prod-torta-chocolate',
    name: 'Torta de Chocolate',
    description: 'Mousse de chocolate intenso sobre base crocante.',
    details: 'Mousse de chocolate 70% sobre base crocante de cacau, finalizada com ganache espelhada e raspas artesanais.',
    price: 82,
    category: 'tortas',
    art: 'torta-chocolate',
    bestSeller: true,
    optionGroups: [g('tamanho-torta', 'Tamanho', 'single', true, [['Média — 8 fatias', 0], ['Grande — 14 fatias', 38]])],
  }),
  product({
    id: 'prod-kit-festa',
    name: 'Kit Festa Completo',
    description: 'Bolo + 100 doces + 100 salgados para 25 pessoas.',
    details:
      'O kit que resolve a sua festa: 1 bolo médio recheado, 100 docinhos variados, 100 salgados fritos na hora e decoração simples de mesa. Atende cerca de 25 pessoas.',
    price: 389,
    category: 'kits',
    art: 'kit-festa',
    featured: true,
    bestSeller: true,
    prepDays: 3,
    unitLabel: 'kit',
    optionGroups: [
      g('kit-tamanho', 'Tamanho do kit', 'single', true, [['25 pessoas', 0], ['40 pessoas', 180], ['60 pessoas', 340]]),
      g('kit-tema', 'Tema da decoração', 'single', false, [['Clássico', 0], ['Infantil', 40], ['Rústico', 35], ['Sem decoração', -30]]),
      ADICIONAIS(),
    ],
  }),
  product({
    id: 'prod-caixa-doces',
    name: 'Caixa de Doces Presente',
    description: 'Caixa rígida com 12 doces finos e laço de cetim.',
    details: 'Presente pronto: caixa rígida com 12 doces finos variados, laço de cetim e cartão com mensagem personalizada.',
    price: 58,
    category: 'kits',
    art: 'caixa-doces',
    featured: true,
    optionGroups: [
      g('caixa-tamanho', 'Tamanho da caixa', 'single', true, [['12 doces', 0], ['20 doces', 34], ['30 doces', 62]]),
      g('caixa-mensagem', 'Cartão', 'single', false, [['Sem cartão', 0], ['Cartão com mensagem', 6]]),
    ],
  }),
  product({
    id: 'prod-salgados',
    name: 'Salgadinhos para Festa',
    description: 'Coxinha, risoles, bolinha de queijo e empadinha. Cento.',
    details: 'Cento de salgadinhos fritos na hora: coxinha de frango com catupiry, risoles de carne, bolinha de queijo e empadinha de palmito.',
    price: 94.9,
    category: 'salgados',
    art: 'salgados',
    unitLabel: 'cento',
    bestSeller: true,
    optionGroups: [
      g('salgado-preparo', 'Preparo', 'single', true, [['Fritos e prontos', 0], ['Congelados para fritar', -12]]),
      g('salgado-sabores', 'Sabores', 'multi', false, [['Coxinha de frango', 0], ['Risoles de carne', 0], ['Bolinha de queijo', 0], ['Empadinha de palmito', 0], ['Kibe', 0]]),
    ],
  }),
  product({
    id: 'prod-suco',
    name: 'Suco Natural 1L',
    description: 'Suco da fruta batido na hora, sem conservantes.',
    details: 'Garrafa de 1 litro de suco natural batido no dia da entrega, sem conservantes e com açúcar opcional.',
    price: 14.9,
    category: 'bebidas',
    art: 'bebidas',
    prepDays: 0,
    optionGroups: [
      g('sabor-suco', 'Sabor', 'single', true, [['Laranja', 0], ['Maracujá', 2], ['Abacaxi com hortelã', 2], ['Morango', 4]]),
      g('acucar', 'Açúcar', 'single', false, [['Com açúcar', 0], ['Sem açúcar', 0]]),
    ],
  }),
  product({
    id: 'prod-bolo-personalizado',
    name: 'Bolo Personalizado',
    description: 'Criamos o bolo dos seus sonhos com tema exclusivo.',
    details:
      'Conte a sua ideia e criamos um bolo exclusivo: tema, cores, topo, flores e acabamento sob medida. O orçamento final é confirmado pelo nosso atendimento em até 24 horas.',
    price: 180,
    category: 'personalizados',
    art: 'personalizados',
    prepDays: 5,
    featured: true,
    optionGroups: [
      g('pers-andares', 'Andares', 'single', true, [['1 andar', 0], ['2 andares', 120], ['3 andares', 260]]),
      g('pers-acabamento', 'Acabamento', 'single', true, [['Chantilly', 0], ['Pasta americana', 60], ['Buttercream texturizado', 40]]),
      g('pers-extra', 'Extras', 'multi', false, [['Flores naturais', 45], ['Topo 3D modelado', 80], ['Letreiro personalizado', 30], ['Efeito dourado', 55]]),
    ],
  }),
];

export const SEED_INGREDIENTS: Ingredient[] = [
  { id: 'ing-farinha', name: 'Farinha de trigo', unit: 'kg', quantity: 25, minQuantity: 10, cost: 5.4, updatedAt: now },
  { id: 'ing-acucar', name: 'Açúcar refinado', unit: 'kg', quantity: 18, minQuantity: 8, cost: 4.2, updatedAt: now },
  { id: 'ing-chocolate', name: 'Chocolate nobre 53%', unit: 'kg', quantity: 6, minQuantity: 8, cost: 48.9, updatedAt: now },
  { id: 'ing-leitecond', name: 'Leite condensado', unit: 'un', quantity: 40, minQuantity: 20, cost: 6.8, updatedAt: now },
  { id: 'ing-creme', name: 'Creme de leite', unit: 'un', quantity: 32, minQuantity: 15, cost: 4.9, updatedAt: now },
  { id: 'ing-morango', name: 'Morango fresco', unit: 'kg', quantity: 3, minQuantity: 4, cost: 22.5, updatedAt: now },
  { id: 'ing-manteiga', name: 'Manteiga sem sal', unit: 'kg', quantity: 7, minQuantity: 3, cost: 42, updatedAt: now },
  { id: 'ing-ovos', name: 'Ovos', unit: 'un', quantity: 180, minQuantity: 60, cost: 0.75, updatedAt: now },
  { id: 'ing-ninho', name: 'Leite em pó ninho', unit: 'kg', quantity: 4, minQuantity: 2, cost: 58, updatedAt: now },
  { id: 'ing-forminha', name: 'Forminhas de papel', unit: 'pct', quantity: 12, minQuantity: 6, cost: 9.9, updatedAt: now },
  { id: 'ing-embalagem', name: 'Caixas para bolo', unit: 'un', quantity: 22, minQuantity: 10, cost: 3.4, updatedAt: now },
];

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Doce Encanto',
  tagline: 'Confeitaria artesanal desde 2016',
  logo: '',
  whatsapp: '(11) 98876-4321',
  phone: '(11) 3456-7890',
  address: 'Rua das Acácias, 245 — Vila Madalena, São Paulo/SP',
  hours: 'Segunda a sábado, das 9h às 19h',
  deliveryFee: 12,
  freeDeliveryFrom: 200,
  minOrder: 25,
  pixKey: 'contato@doceencanto.com.br',
  payments: { pix: true, dinheiro: true, cartao: true },
  primaryColor: '#8c4a2f',
  accentColor: '#e0849c',
};

export function buildSeedDatabase(version: number): Database {
  return {
    version,
    products: SEED_PRODUCTS,
    orders: [],
    customers: [],
    ingredients: SEED_INGREDIENTS,
    stockMoves: [],
    expenses: [],
    settings: DEFAULT_SETTINGS,
    session: { customerId: null },
    counter: 1000,
  };
}
