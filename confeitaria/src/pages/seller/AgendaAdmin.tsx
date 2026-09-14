import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useStore } from '../../store/store';
import { FULFILLMENT_LABEL, STATUS_META } from '../../lib/status';
import { capitalizeFirst, formatDateLong, formatMoney, formatWeekday, toISODate, todayISO } from '../../lib/format';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function AgendaAdmin() {
  const { orders } = useStore();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const map = new Map<string, typeof orders>();
    orders.filter((o) => o.status !== 'cancelado').forEach((order) => {
      map.set(order.date, [...(map.get(order.date) ?? []), order]);
    });
    map.forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [orders]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { iso: toISODate(date), day: date.getDate(), outside: date.getMonth() !== month };
    });
  }, [cursor]);

  const dayOrders = byDate.get(selected) ?? [];
  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const monthOrders = orders.filter((o) => o.status !== 'cancelado' && o.date.startsWith(toISODate(cursor).slice(0, 7)));

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi__top"><span className="kpi__label">Compromissos do mês</span><span className="kpi__icon"><Icon name="calendar" size={19} /></span></div><span className="kpi__value">{monthOrders.length}</span><span className="kpi__foot">entregas e retiradas agendadas</span></div>
        <div className="kpi kpi--info"><div className="kpi__top"><span className="kpi__label">Entregas</span><span className="kpi__icon"><Icon name="truck" size={19} /></span></div><span className="kpi__value">{monthOrders.filter((o) => o.fulfillment === 'entrega').length}</span><span className="kpi__foot">no mês selecionado</span></div>
        <div className="kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Retiradas</span><span className="kpi__icon"><Icon name="store" size={19} /></span></div><span className="kpi__value">{monthOrders.filter((o) => o.fulfillment === 'retirada').length}</span><span className="kpi__foot">no mês selecionado</span></div>
        <div className="kpi kpi--ok"><div className="kpi__top"><span className="kpi__label">Valor agendado</span><span className="kpi__icon"><Icon name="wallet" size={19} /></span></div><span className="kpi__value">{formatMoney(monthOrders.reduce((s, o) => s + o.total, 0))}</span><span className="kpi__foot">em pedidos do mês</span></div>
      </div>

      <div className="admin-grid-2">
        <section className="block">
          <div className="block__head">
            <div>
              <h3>{capitalizeFirst(monthLabel)}</h3>
              <p>Clique em um dia para ver os pedidos</p>
            </div>
            <div className="row" style={{ gap: '.3rem' }}>
              <button type="button" className="icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mês anterior"><Icon name="chevronLeft" size={16} /></button>
              <button type="button" className="btn btn--ghost btn--xs" onClick={() => { setCursor(new Date()); setSelected(today); }}>Hoje</button>
              <button type="button" className="icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Próximo mês"><Icon name="chevronRight" size={16} /></button>
            </div>
          </div>
          <div className="block__body">
            <div className="calendar">
              {DOW.map((label) => <span className="calendar__dow" key={label}>{label}</span>)}
              {days.map((day) => {
                const list = byDate.get(day.iso) ?? [];
                return (
                  <button
                    type="button"
                    key={day.iso}
                    className={`calendar__day ${day.outside ? 'is-outside' : ''} ${day.iso === today ? 'is-today' : ''} ${day.iso === selected ? 'is-selected' : ''}`}
                    onClick={() => setSelected(day.iso)}
                  >
                    <span className="calendar__daynum">{day.day}</span>
                    {list.slice(0, 2).map((order) => (
                      <span className={`calendar__tag ${order.fulfillment === 'retirada' ? 'calendar__tag--pickup' : ''}`} key={order.id}>
                        {order.time} {order.customerName.split(' ')[0]}
                      </span>
                    ))}
                    {list.length > 2 && <span className="text-xs muted">+{list.length - 2} pedido(s)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <div>
              <h3>{capitalizeFirst(formatWeekday(selected))}</h3>
              <p>{formatDateLong(selected)}</p>
            </div>
            <span className="badge">{dayOrders.length} pedido(s)</span>
          </div>
          <div className="block__body">
            {dayOrders.length === 0 ? (
              <div className="empty" style={{ padding: '1.6rem 0' }}>
                <span className="empty__icon"><Icon name="calendar" size={22} /></span>
                <h3>Dia livre</h3>
                <p>Nenhuma entrega ou retirada agendada para esta data.</p>
              </div>
            ) : (
              <div className="agenda-list">
                {dayOrders.map((order) => (
                  <div className="agenda-item" key={order.id}>
                    <span className="agenda-item__time">{order.time}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong className="text-sm">{order.customerName} — {order.code}</strong>
                      <span className="text-xs muted" style={{ display: 'block' }}>
                        {FULFILLMENT_LABEL[order.fulfillment]} • {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </span>
                      {order.address && <span className="text-xs muted">{order.address}</span>}
                      {order.notes && <span className="text-xs muted" style={{ display: 'block' }}>Obs.: {order.notes}</span>}
                    </span>
                    <span className="stack" style={{ gap: '.3rem', justifyItems: 'end' }}>
                      <span className="badge" style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}>{STATUS_META[order.status].label}</span>
                      <strong className="text-sm">{formatMoney(order.total)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
