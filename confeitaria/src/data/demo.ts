import type { CartItem, Customer, Expense, Order, OrderStatus, Product, StockMove } from '../types';
import { addDays, toISODate, todayISO } from '../lib/format';

/** Gera histórico de demonstração para que os painéis não comecem vazios. */

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cli-ana',
    name: 'Ana Beatriz Lima',
    phone: '(11) 99812-4477',
    addresses: [{ id: 'end-ana', label: 'Casa', value: 'Rua Harmonia, 512 — Vila Madalena, São Paulo/SP' }],
    notes: 'Prefere entregas no período da tarde.',
    createdAt: new Date(Date.now() - 86400000 * 48).toISOString(),
  },
  {
    id: 'cli-carlos',
    name: 'Carlos Eduardo Ramos',
    phone: '(11) 99145-3320',
    addresses: [{ id: 'end-carlos', label: 'Trabalho', value: 'Av. Paulista, 1800 — Bela Vista, São Paulo/SP' }],
    notes: 'Cliente corporativo, pede sempre para reuniões.',
    createdAt: new Date(Date.now() - 86400000 * 35).toISOString(),
  },
  {
    id: 'cli-juliana',
    name: 'Juliana Prado',
    phone: '(11) 98770-1122',
    addresses: [{ id: 'end-ju', label: 'Casa', value: 'Rua dos Pinheiros, 77 — Pinheiros, São Paulo/SP' }],
    notes: '',
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'cli-marcos',
    name: 'Marcos Antônio Silva',
    phone: '(11) 99633-8080',
    addresses: [{ id: 'end-marcos', label: 'Casa', value: 'Rua Girassol, 90 — Vila Madalena, São Paulo/SP' }],
    notes: 'Alergia a castanhas na família.',
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

type DemoSpec = {
  customer: string;
  daysAgo: number;
  deliveryOffset: number;
  status: OrderStatus;
  fulfillment: 'entrega' | 'retirada';
  payment: 'pix' | 'dinheiro' | 'cartao';
  time: string;
  notes: string;
  lines: { productId: string; qty: number; options?: number[] }[];
};

const SPECS: DemoSpec[] = [
  { customer: 'cli-ana', daysAgo: 26, deliveryOffset: 1, status: 'entregue', fulfillment: 'entrega', payment: 'pix', time: '15:00', notes: 'Escrever "Parabéns, Lucas!"', lines: [{ productId: 'prod-bolo-chocolate', qty: 1, options: [1, 0, 0] }, { productId: 'prod-brigadeiro', qty: 1 }] },
  { customer: 'cli-carlos', daysAgo: 22, deliveryOffset: 1, status: 'entregue', fulfillment: 'entrega', payment: 'cartao', time: '09:30', notes: 'Reunião da diretoria.', lines: [{ productId: 'prod-salgados', qty: 2 }, { productId: 'prod-suco', qty: 4 }] },
  { customer: 'cli-juliana', daysAgo: 18, deliveryOffset: 2, status: 'entregue', fulfillment: 'retirada', payment: 'dinheiro', time: '11:00', notes: '', lines: [{ productId: 'prod-torta-morango', qty: 1 }] },
  { customer: 'cli-ana', daysAgo: 15, deliveryOffset: 1, status: 'entregue', fulfillment: 'entrega', payment: 'pix', time: '16:30', notes: '', lines: [{ productId: 'prod-cupcake-chocolate', qty: 12 }] },
  { customer: 'cli-marcos', daysAgo: 12, deliveryOffset: 3, status: 'entregue', fulfillment: 'entrega', payment: 'pix', time: '14:00', notes: 'Festa infantil tema circo.', lines: [{ productId: 'prod-kit-festa', qty: 1, options: [1, 1] }] },
  { customer: 'cli-carlos', daysAgo: 9, deliveryOffset: 1, status: 'entregue', fulfillment: 'retirada', payment: 'cartao', time: '10:00', notes: '', lines: [{ productId: 'prod-caixa-doces', qty: 3 }] },
  { customer: 'cli-juliana', daysAgo: 6, deliveryOffset: 1, status: 'entregue', fulfillment: 'entrega', payment: 'pix', time: '18:00', notes: '', lines: [{ productId: 'prod-bolo-ninho', qty: 1, options: [2, 1] }, { productId: 'prod-beijinho', qty: 1 }] },
  { customer: 'cli-ana', daysAgo: 4, deliveryOffset: 2, status: 'entregue', fulfillment: 'entrega', payment: 'dinheiro', time: '13:00', notes: '', lines: [{ productId: 'prod-torta-chocolate', qty: 1, options: [1] }] },
  { customer: 'cli-marcos', daysAgo: 2, deliveryOffset: 1, status: 'pronto', fulfillment: 'retirada', payment: 'pix', time: '17:00', notes: 'Retira às 17h em ponto.', lines: [{ productId: 'prod-bolo-morango', qty: 1, options: [1, 2, 1] }] },
  { customer: 'cli-carlos', daysAgo: 1, deliveryOffset: 1, status: 'producao', fulfillment: 'entrega', payment: 'cartao', time: '11:30', notes: 'Entregar na recepção.', lines: [{ productId: 'prod-salgados', qty: 1 }, { productId: 'prod-docinhos-gourmet', qty: 2 }] },
  { customer: 'cli-juliana', daysAgo: 1, deliveryOffset: 2, status: 'confirmado', fulfillment: 'entrega', payment: 'pix', time: '15:30', notes: 'Sem lactose se possível.', lines: [{ productId: 'prod-bolo-redvelvet', qty: 1, options: [1, 0] }] },
  { customer: 'cli-ana', daysAgo: 0, deliveryOffset: 3, status: 'novo', fulfillment: 'entrega', payment: 'pix', time: '14:30', notes: 'Aniversário de 40 anos.', lines: [{ productId: 'prod-bolo-personalizado', qty: 1, options: [1, 1, 0] }, { productId: 'prod-brigadeiro', qty: 2 }] },
  { customer: 'cli-marcos', daysAgo: 0, deliveryOffset: 1, status: 'novo', fulfillment: 'retirada', payment: 'dinheiro', time: '10:30', notes: '', lines: [{ productId: 'prod-pao-de-mel', qty: 2 }, { productId: 'prod-suco', qty: 2, options: [1, 0] }] },
];

const STATUS_FLOW: OrderStatus[] = ['novo', 'confirmado', 'producao', 'pronto', 'entregue'];

function buildItems(spec: DemoSpec, products: Product[]): CartItem[] {
  return spec.lines.flatMap((line, index) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) return [];
    const selections = product.optionGroups
      .filter((grp) => grp.type === 'single')
      .map((grp, gi) => {
        const optIndex = line.options?.[gi] ?? 0;
        const option = grp.options[Math.min(optIndex, grp.options.length - 1)];
        return { groupId: grp.id, groupLabel: grp.label, optionId: option.id, optionLabel: option.label, priceDelta: option.priceDelta };
      });
    const unitPrice = product.price + selections.reduce((sum, s) => sum + s.priceDelta, 0);
    return [{
      id: `demo-item-${spec.customer}-${spec.daysAgo}-${index}`,
      productId: product.id,
      name: product.name,
      art: product.art,
      image: product.image,
      basePrice: product.price,
      unitPrice,
      quantity: line.qty,
      selections,
      notes: '',
    }];
  });
}

export function buildDemoData(products: Product[], deliveryFee: number, startCounter: number) {
  const orders: Order[] = [];
  let counter = startCounter;

  SPECS.forEach((spec) => {
    const customer = DEMO_CUSTOMERS.find((c) => c.id === spec.customer)!;
    const items = buildItems(spec, products);
    if (!items.length) return;
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const fee = spec.fulfillment === 'entrega' ? deliveryFee : 0;
    const createdAt = new Date(Date.now() - spec.daysAgo * 86400000 - 3600000 * 5);
    const statusIndex = STATUS_FLOW.indexOf(spec.status);
    const history = STATUS_FLOW.slice(0, statusIndex + 1).map((status, i) => ({
      status,
      at: new Date(createdAt.getTime() + i * 5400000).toISOString(),
    }));
    counter += 1;
    orders.push({
      id: `ped-demo-${counter}`,
      code: `#${counter}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      address: spec.fulfillment === 'entrega' ? customer.addresses[0]?.value ?? '' : '',
      fulfillment: spec.fulfillment,
      payment: spec.payment,
      date: addDays(toISODate(createdAt), spec.deliveryOffset),
      time: spec.time,
      notes: spec.notes,
      items,
      subtotal,
      deliveryFee: fee,
      total: subtotal + fee,
      status: spec.status,
      history,
      createdAt: createdAt.toISOString(),
      updatedAt: history[history.length - 1].at,
    });
  });

  const expenses: Expense[] = [
    { id: 'desp-1', description: 'Compra de insumos — atacado', category: 'Insumos', amount: 820.4, date: addDays(todayISO(), -24), createdAt: new Date().toISOString() },
    { id: 'desp-2', description: 'Embalagens e forminhas', category: 'Embalagens', amount: 236.9, date: addDays(todayISO(), -18), createdAt: new Date().toISOString() },
    { id: 'desp-3', description: 'Conta de energia', category: 'Fixas', amount: 412.15, date: addDays(todayISO(), -10), createdAt: new Date().toISOString() },
    { id: 'desp-4', description: 'Combustível das entregas', category: 'Entregas', amount: 180, date: addDays(todayISO(), -6), createdAt: new Date().toISOString() },
    { id: 'desp-5', description: 'Chocolate nobre e leite condensado', category: 'Insumos', amount: 567.3, date: addDays(todayISO(), -3), createdAt: new Date().toISOString() },
  ];

  const stockMoves: StockMove[] = [
    { id: 'mov-1', ingredientId: 'ing-farinha', ingredientName: 'Farinha de trigo', type: 'entrada', quantity: 25, unit: 'kg', reason: 'Compra no atacado', at: new Date(Date.now() - 86400000 * 9).toISOString() },
    { id: 'mov-2', ingredientId: 'ing-chocolate', ingredientName: 'Chocolate nobre 53%', type: 'saida', quantity: 4, unit: 'kg', reason: 'Produção de bolos', at: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'mov-3', ingredientId: 'ing-morango', ingredientName: 'Morango fresco', type: 'saida', quantity: 5, unit: 'kg', reason: 'Tortas e bolos de morango', at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'mov-4', ingredientId: 'ing-ovos', ingredientName: 'Ovos', type: 'entrada', quantity: 180, unit: 'un', reason: 'Reposição semanal', at: new Date(Date.now() - 86400000).toISOString() },
  ];

  return { customers: DEMO_CUSTOMERS, orders, expenses, stockMoves, counter };
}
