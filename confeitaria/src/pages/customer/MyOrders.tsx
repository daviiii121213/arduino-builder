import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { OrderTimeline } from '../../components/OrderTimeline';
import { useStore } from '../../store/store';
import { FULFILLMENT_LABEL, PAYMENT_LABEL, STATUS_META } from '../../lib/status';
import { formatDateLong, formatMoney, maskPhone, onlyDigits, relativeTime } from '../../lib/format';
import { useToast } from '../../components/Toast';

export function MyOrders({ navigate }: { navigate: (path: string) => void }) {
  const { orders, currentCustomer, identifyCustomer, settings } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [filter, setFilter] = useState<'todos' | 'andamento' | 'concluidos'>('todos');

  const myOrders = useMemo(() => {
    if (!currentCustomer) return [];
    const list = orders.filter((order) => order.customerId === currentCustomer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === 'andamento') return list.filter((o) => !['entregue', 'cancelado'].includes(o.status));
    if (filter === 'concluidos') return list.filter((o) => ['entregue', 'cancelado'].includes(o.status));
    return list;
  }, [orders, currentCustomer, filter]);

  if (!currentCustomer) {
    return (
      <div className="container" style={{ marginTop: '2.4rem', maxWidth: '520px' }}>
        <div className="panel card--pad stack">
          <div>
            <span className="eyebrow">Meus pedidos</span>
            <h2>Acompanhe seus pedidos</h2>
            <p className="soft" style={{ marginTop: '.4rem' }}>Informe o nome e o WhatsApp usados no pedido para ver o andamento.</p>
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim().length < 3 || onlyDigits(phone).length < 10) {
                toast.error('Dados incompletos', 'Preencha nome e WhatsApp válidos.');
                return;
              }
              identifyCustomer(name.trim(), maskPhone(phone));
              toast.success('Tudo certo!', 'Seus pedidos foram carregados.');
            }}
          >
            <div className="field">
              <label htmlFor="mo-nome">Nome completo</label>
              <input id="mo-nome" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="field">
              <label htmlFor="mo-fone">WhatsApp</label>
              <input id="mo-fone" className="input" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
            </div>
            <button type="submit" className="btn btn--primary btn--block">Ver meus pedidos</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Meus pedidos</span>
          <h2>Olá, {currentCustomer.name.split(' ')[0]}!</h2>
          <p>Acompanhe em tempo real cada etapa da produção dos seus pedidos.</p>
        </div>
        <div className="chip-row">
          {([['todos', 'Todos'], ['andamento', 'Em andamento'], ['concluidos', 'Concluídos']] as const).map(([key, label]) => (
            <button key={key} type="button" className={`chip ${filter === key ? 'chip--active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {myOrders.length === 0 ? (
        <div className="empty panel">
          <span className="empty__icon"><Icon name="receipt" size={28} /></span>
          <h3>Nenhum pedido por aqui</h3>
          <p>Quando você fizer um pedido, ele aparece aqui com todo o acompanhamento da produção.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/cardapio')}>Fazer meu primeiro pedido</button>
        </div>
      ) : (
        <div className="stack" style={{ gap: '1.2rem' }}>
          {myOrders.map((order) => (
            <article className="panel order-card animate-up" key={order.id}>
              <div className="order-card__head">
                <div>
                  <span className="order-card__code">Pedido {order.code}</span>
                  <p className="text-xs muted">Feito {relativeTime(order.createdAt)}</p>
                </div>
                <span className="badge badge--dot" style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}>
                  {STATUS_META[order.status].label}
                </span>
              </div>

              <OrderTimeline order={order} />
              <p className="text-sm soft">{STATUS_META[order.status].description}</p>

              <div className="order-items">
                {order.items.map((item) => (
                  <div className="order-item-line" key={item.id}>
                    <span>
                      <span className="qty-tag">{item.quantity}x</span> {item.name}
                      {item.selections.length > 0 && <span className="text-xs muted" style={{ display: 'block' }}>{item.selections.map((s) => `${s.groupLabel}: ${s.optionLabel}`).join(' • ')}</span>}
                      {item.notes && <span className="text-xs muted" style={{ display: 'block' }}>Obs.: {item.notes}</span>}
                    </span>
                    <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              <div className="order-meta">
                <div><strong>{formatDateLong(order.date)}</strong>Data{order.fulfillment === 'entrega' ? ' da entrega' : ' da retirada'}</div>
                <div><strong>{order.time}</strong>Horário</div>
                <div><strong>{FULFILLMENT_LABEL[order.fulfillment]}</strong>Recebimento</div>
                <div><strong>{PAYMENT_LABEL[order.payment]}</strong>Pagamento</div>
                <div><strong>{formatMoney(order.total)}</strong>Total {order.deliveryFee > 0 ? `(inclui ${formatMoney(order.deliveryFee)} de entrega)` : ''}</div>
              </div>

              {order.fulfillment === 'entrega' && order.address && (
                <p className="text-sm soft"><Icon name="mapPin" size={14} /> {order.address}</p>
              )}
              {order.notes && <p className="text-sm soft"><Icon name="edit" size={14} /> {order.notes}</p>}
              <p className="text-xs muted">Dúvidas sobre este pedido? Fale com a gente pelo {settings.whatsapp}.</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
