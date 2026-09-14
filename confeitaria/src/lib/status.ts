import type { Fulfillment, OrderStatus, PaymentMethod } from '../types';

export const STATUS_FLOW: OrderStatus[] = ['novo', 'confirmado', 'producao', 'pronto', 'entregue'];

export const STATUS_META: Record<OrderStatus, { label: string; short: string; color: string; bg: string; description: string }> = {
  novo: { label: 'Novo', short: 'Pedido recebido', color: '#1d5fb4', bg: '#e4eefc', description: 'Recebemos o seu pedido e já estamos analisando.' },
  confirmado: { label: 'Confirmado', short: 'Confirmado', color: '#7a4bbd', bg: '#efe7fb', description: 'Pedido confirmado pela confeitaria.' },
  producao: { label: 'Em produção', short: 'Em produção', color: '#b8761a', bg: '#fbefd9', description: 'Seu pedido está sendo preparado com carinho.' },
  pronto: { label: 'Pronto', short: 'Pronto', color: '#16795d', bg: '#dff3ec', description: 'Tudo pronto! Aguardando entrega ou retirada.' },
  entregue: { label: 'Entregue', short: 'Entregue', color: '#3f7a2f', bg: '#e5f3df', description: 'Pedido finalizado. Bom apetite!' },
  cancelado: { label: 'Cancelado', short: 'Cancelado', color: '#b3323f', bg: '#fbe3e5', description: 'Este pedido foi cancelado.' },
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
};

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  entrega: 'Entrega',
  retirada: 'Retirada na loja',
};

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  if (index < 0 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

export const NEXT_STATUS_ACTION: Record<OrderStatus, string> = {
  novo: 'Confirmar pedido',
  confirmado: 'Iniciar produção',
  producao: 'Marcar como pronto',
  pronto: 'Marcar como entregue',
  entregue: 'Pedido finalizado',
  cancelado: 'Pedido cancelado',
};

export const OPEN_STATUSES: OrderStatus[] = ['novo', 'confirmado', 'producao', 'pronto'];
