import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { OrderTimeline } from '../../components/OrderTimeline';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { FULFILLMENT_LABEL, NEXT_STATUS_ACTION, PAYMENT_LABEL, STATUS_META, nextStatus } from '../../lib/status';
import { formatDate, formatDateTime, formatMoney, onlyDigits, relativeTime } from '../../lib/format';

const FILTERS: { id: 'todos' | OrderStatus; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'novo', label: 'Novos' },
  { id: 'confirmado', label: 'Confirmados' },
  { id: 'producao', label: 'Em produção' },
  { id: 'pronto', label: 'Prontos' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
];

export function OrdersAdmin() {
  const { orders, setOrderStatus } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<'todos' | OrderStatus>('todos');
  const [term, setTerm] = useState('');
  const [view, setView] = useState<'lista' | 'quadro'>('lista');
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    const digits = onlyDigits(term);
    return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((order) => {
      if (filter !== 'todos' && order.status !== filter) return false;
      if (!normalized) return true;
      return (
        order.code.toLowerCase().includes(normalized) ||
        order.customerName.toLowerCase().includes(normalized) ||
        (digits.length > 2 && onlyDigits(order.customerPhone).includes(digits)) ||
        order.items.some((item) => item.name.toLowerCase().includes(normalized))
      );
    });
  }, [orders, filter, term]);

  const current = openOrder ? orders.find((o) => o.id === openOrder.id) ?? null : null;

  const advance = (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setOrderStatus(order.id, next);
    toast.success('Status atualizado', `${order.code} agora está em "${STATUS_META[next].label}".`);
  };

  const changeStatus = (order: Order, status: OrderStatus) => {
    if (status === 'cancelado') { setCancelTarget(order); return; }
    setOrderStatus(order.id, status);
    toast.success('Status atualizado', `${order.code}: ${STATUS_META[status].label}.`);
  };

  const columns: OrderStatus[] = ['novo', 'confirmado', 'producao', 'pronto'];

  return (
    <>
      <section className="block">
        <div className="block__head">
          <div className="toolbar">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input className="input" placeholder="Buscar por código, cliente, telefone ou produto" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: '.4rem' }}>
            <button type="button" className={`chip ${view === 'lista' ? 'chip--active' : ''}`} onClick={() => setView('lista')}>Lista</button>
            <button type="button" className={`chip ${view === 'quadro' ? 'chip--active' : ''}`} onClick={() => setView('quadro')}>Quadro</button>
          </div>
        </div>
        <div className="block__body" style={{ paddingBottom: '.6rem' }}>
          <div className="filters-scroll">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${filter === item.id ? 'chip--active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label} ({item.id === 'todos' ? orders.length : orders.filter((o) => o.status === item.id).length})
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="block empty">
          <span className="empty__icon"><Icon name="receipt" size={26} /></span>
          <h3>Nenhum pedido encontrado</h3>
          <p>Ajuste a busca ou os filtros para ver outros pedidos.</p>
        </div>
      ) : view === 'lista' ? (
        <section className="block">
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Entrega / Retirada</th>
                  <th>Itens</th>
                  <th className="right">Total</th>
                  <th>Status</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="order-row__code">{order.code}</span>
                      <span className="text-xs muted" style={{ display: 'block' }}>{relativeTime(order.createdAt)}</span>
                    </td>
                    <td>
                      <strong className="text-sm">{order.customerName}</strong>
                      <span className="text-xs muted" style={{ display: 'block' }}>{order.customerPhone}</span>
                    </td>
                    <td>
                      <span className="text-sm">{formatDate(order.date)} às {order.time}</span>
                      <span className="text-xs muted" style={{ display: 'block' }}>{FULFILLMENT_LABEL[order.fulfillment]}</span>
                    </td>
                    <td className="text-sm">{order.items.reduce((s, i) => s + i.quantity, 0)} item(ns)</td>
                    <td className="right"><strong>{formatMoney(order.total)}</strong></td>
                    <td>
                      <select
                        className="select status-select"
                        style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}
                        value={order.status}
                        onChange={(e) => changeStatus(order, e.target.value as OrderStatus)}
                        aria-label={`Status do pedido ${order.code}`}
                      >
                        {(Object.keys(STATUS_META) as OrderStatus[]).map((status) => (
                          <option key={status} value={status}>{STATUS_META[status].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="right">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: '.35rem' }}>
                        {nextStatus(order.status) && order.status !== 'cancelado' && (
                          <button type="button" className="btn btn--soft btn--xs" onClick={() => advance(order)}>
                            {NEXT_STATUS_ACTION[order.status]}
                          </button>
                        )}
                        <button type="button" className="icon-btn" onClick={() => setOpenOrder(order)} aria-label="Ver detalhes">
                          <Icon name="eye" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="kanban">
          {columns.map((status) => {
            const items = filtered.filter((o) => o.status === status);
            return (
              <div className="kanban__col" key={status}>
                <header>
                  <span className="badge" style={{ background: STATUS_META[status].bg, color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
                  <span>{items.length}</span>
                </header>
                {items.length === 0 && <p className="text-xs muted">Nenhum pedido aqui.</p>}
                {items.map((order) => (
                  <button type="button" className="kanban__card" key={order.id} onClick={() => setOpenOrder(order)}>
                    <strong>{order.code} — {order.customerName}</strong>
                    <span>{formatDate(order.date)} às {order.time} • {formatMoney(order.total)}</span>
                    <span>{order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(current)}
        onClose={() => setOpenOrder(null)}
        title={current ? `Pedido ${current.code}` : ''}
        subtitle={current ? `Recebido em ${formatDateTime(current.createdAt)}` : ''}
        size="lg"
        footer={
          current && (
            <>
              {current.status !== 'cancelado' && current.status !== 'entregue' && (
                <button type="button" className="btn btn--outline-danger" onClick={() => setCancelTarget(current)}>
                  <Icon name="close" size={15} /> Cancelar pedido
                </button>
              )}
              {nextStatus(current.status) && current.status !== 'cancelado' && (
                <button type="button" className="btn btn--primary" onClick={() => advance(current)}>
                  <Icon name="check" size={16} /> {NEXT_STATUS_ACTION[current.status]}
                </button>
              )}
            </>
          )
        }
      >
        {current && (
          <div className="stack" style={{ gap: '1.2rem' }}>
            <OrderTimeline order={current} />

            <div className="detail-grid">
              <div className="detail-item"><span>Cliente</span><strong>{current.customerName}</strong></div>
              <div className="detail-item"><span>WhatsApp</span><strong>{current.customerPhone}</strong></div>
              <div className="detail-item"><span>Recebimento</span><strong>{FULFILLMENT_LABEL[current.fulfillment]}</strong></div>
              <div className="detail-item"><span>Data e horário</span><strong>{formatDate(current.date)} às {current.time}</strong></div>
              <div className="detail-item"><span>Pagamento</span><strong>{PAYMENT_LABEL[current.payment]}</strong></div>
              <div className="detail-item"><span>Endereço</span><strong>{current.address || 'Retirada na loja'}</strong></div>
            </div>

            <div className="stack" style={{ gap: '.5rem' }}>
              <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-mute)' }}>Itens do pedido</h4>
              {current.items.map((item) => (
                <div className="order-item-line" key={item.id}>
                  <span>
                    <span className="qty-tag">{item.quantity}x</span> {item.name}
                    {item.selections.length > 0 && (
                      <span className="text-xs muted" style={{ display: 'block' }}>{item.selections.map((s) => `${s.groupLabel}: ${s.optionLabel}`).join(' • ')}</span>
                    )}
                    {item.notes && <span className="text-xs muted" style={{ display: 'block' }}>Obs.: {item.notes}</span>}
                  </span>
                  <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                </div>
              ))}
              <div className="review-line"><span>Subtotal</span><span>{formatMoney(current.subtotal)}</span></div>
              <div className="review-line"><span>Taxa de entrega</span><span>{current.deliveryFee > 0 ? formatMoney(current.deliveryFee) : 'Grátis'}</span></div>
              <div className="review-line" style={{ fontWeight: 700, color: 'var(--choc-700)', fontSize: '1.05rem' }}>
                <span>Total</span><span>{formatMoney(current.total)}</span>
              </div>
            </div>

            {current.notes && (
              <div className="review-block">
                <h4>Observações do cliente</h4>
                <p className="text-sm">{current.notes}</p>
              </div>
            )}

            <div className="review-block">
              <h4>Histórico do pedido</h4>
              {current.history.map((event, index) => (
                <div className="review-line text-sm" key={`${event.status}-${index}`}>
                  <span>{STATUS_META[event.status].label}</span>
                  <span className="muted">{formatDateTime(event.at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar este pedido?"
        message={cancelTarget ? `O pedido ${cancelTarget.code} de ${cancelTarget.customerName} será cancelado e o cliente verá essa informação no acompanhamento.` : ''}
        confirmLabel="Cancelar pedido"
        cancelLabel="Voltar"
        danger
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          setOrderStatus(cancelTarget.id, 'cancelado');
          toast.notify('aviso', 'Pedido cancelado', `${cancelTarget.code} foi cancelado.`);
          setCancelTarget(null);
        }}
      />
    </>
  );
}
