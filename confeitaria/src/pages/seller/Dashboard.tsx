import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../../components/Icon';
import { ProductImage } from '../../components/ProductArt';
import { useStore } from '../../store/store';
import { useAnalytics } from './useAnalytics';
import { formatDate, formatMoney, formatMoneyShort, formatNumber } from '../../lib/format';
import { FULFILLMENT_LABEL, STATUS_META } from '../../lib/status';
import { categoryName } from '../../data/categories';

const PIE_COLORS = ['#8c4a2f', '#e0849c', '#cfae8c', '#b8761a', '#3f7a2f', '#1d5fb4', '#7a4bbd', '#c9637f'];

export function Dashboard({ go }: { go: (id: string) => void }) {
  const a = useAnalytics();
  const { orders, settings } = useStore();

  const kpis = [
    { label: 'Faturamento do dia', value: formatMoney(a.revenueToday), icon: 'wallet' as const, tone: 'kpi--ok', foot: `${a.ordersToday} pedido(s) recebido(s) hoje` },
    { label: 'Faturamento do mês', value: formatMoney(a.revenueMonth), icon: 'trendUp' as const, tone: 'kpi--accent', foot: a.monthGrowth === null ? 'Primeiro mês de vendas' : `${a.monthGrowth >= 0 ? '▲' : '▼'} ${formatNumber(Math.abs(a.monthGrowth))}% vs. mês anterior` },
    { label: 'Previsão do mês', value: formatMoney(a.forecastMonth), icon: 'calendar' as const, tone: 'kpi--info', foot: 'Inclui pedidos agendados' },
    { label: 'Ticket médio', value: formatMoney(a.averageTicket), icon: 'chart' as const, tone: '', foot: `${a.ordersCount} ${a.ordersCount === 1 ? 'pedido' : 'pedidos'} no total` },
  ];

  const statusCards = [
    { key: 'novo', label: 'Pedidos pendentes', count: a.counts.novo },
    { key: 'confirmado', label: 'Confirmados', count: a.counts.confirmado },
    { key: 'producao', label: 'Em produção', count: a.counts.producao },
    { key: 'pronto', label: 'Prontos', count: a.counts.pronto },
  ] as const;

  return (
    <>
      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div className={`kpi ${kpi.tone}`} key={kpi.label}>
            <div className="kpi__top">
              <span className="kpi__label">{kpi.label}</span>
              <span className="kpi__icon"><Icon name={kpi.icon} size={19} /></span>
            </div>
            <span className="kpi__value">{kpi.value}</span>
            <span className="kpi__foot">{kpi.foot}</span>
          </div>
        ))}
      </div>

      <div className="kpi-grid">
        {statusCards.map((card) => (
          <button
            type="button"
            key={card.key}
            className="kpi"
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => go('pedidos')}
          >
            <div className="kpi__top">
              <span className="kpi__label">{card.label}</span>
              <span className="kpi__icon" style={{ background: STATUS_META[card.key].bg, color: STATUS_META[card.key].color }}>
                <Icon name="receipt" size={18} />
              </span>
            </div>
            <span className="kpi__value">{card.count}</span>
            <span className="kpi__foot">Ver na lista de pedidos <Icon name="chevronRight" size={13} /></span>
          </button>
        ))}
      </div>

      <div className="admin-grid-2">
        <section className="block">
          <div className="block__head">
            <div>
              <h3>Faturamento dos últimos 14 dias</h3>
              <p>Valores de pedidos já entregues</p>
            </div>
            <span className="badge badge--ok">{formatMoney(a.revenueByDay.reduce((s, d) => s + d.value, 0))}</span>
          </div>
          <div className="block__body">
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.revenueByDay} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8c4a2f" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#8c4a2f" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" stroke="#eee4dc" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => formatMoneyShort(Number(v))} />
                  <Tooltip
                    formatter={(value) => [formatMoney(Number(value)), 'Faturamento']}
                    labelFormatter={(label) => `Dia ${label}`}
                    contentStyle={{ borderRadius: 12, border: '1px solid #ece0d4', fontSize: 13 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#8c4a2f" strokeWidth={2.5} fill="url(#fillRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <div>
              <h3>Próximas entregas</h3>
              <p>Pedidos agendados a partir de hoje</p>
            </div>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => go('agenda')}>Abrir agenda</button>
          </div>
          <div className="block__body">
            {a.upcoming.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem 0' }}>
                <span className="empty__icon"><Icon name="calendar" size={22} /></span>
                <p>Nenhuma entrega agendada no momento.</p>
              </div>
            ) : (
              <div className="agenda-list">
                {a.upcoming.map((order) => (
                  <div className="agenda-item" key={order.id}>
                    <span className="agenda-item__time">{order.time}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong className="text-sm">{order.customerName}</strong>
                      <span className="text-xs muted" style={{ display: 'block' }}>
                        {formatDate(order.date)} • {FULFILLMENT_LABEL[order.fulfillment]} • {order.code}
                      </span>
                    </span>
                    <span className="badge" style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}>
                      {STATUS_META[order.status].label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="admin-grid-3">
        <section className="block">
          <div className="block__head"><div><h3>Produtos mais vendidos</h3><p>Por quantidade pedida</p></div></div>
          <div className="block__body">
            {a.topProducts.length === 0 ? (
              <p className="text-sm muted">Ainda não há vendas registradas.</p>
            ) : (
              a.topProducts.map((entry, index) => (
                <div className="rank-row" key={entry.product!.id}>
                  <span className="rank-row__pos">{index + 1}</span>
                  <span className="rank-row__media"><ProductImage art={entry.product!.art} image={entry.product!.image} alt={entry.product!.name} /></span>
                  <span className="rank-row__info">
                    <strong>{entry.product!.name}</strong>
                    <span>{entry.quantity} vendidos • {categoryName(entry.product!.category)}</span>
                  </span>
                  <span className="rank-row__value">{formatMoney(entry.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="block">
          <div className="block__head">
            <div><h3>Alertas de estoque</h3><p>Itens no limite mínimo</p></div>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => go('estoque')}>Repor</button>
          </div>
          <div className="block__body">
            {a.lowStock.length === 0 ? (
              <div className="empty" style={{ padding: '1.4rem 0' }}>
                <span className="empty__icon" style={{ background: 'var(--green-100)', color: 'var(--green-500)' }}><Icon name="check" size={22} /></span>
                <p>Estoque em dia! Nenhum ingrediente abaixo do mínimo.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: '.9rem' }}>
                {a.lowStock.map((item) => {
                  const ratio = item.minQuantity > 0 ? Math.min(100, (item.quantity / item.minQuantity) * 100) : 100;
                  return (
                    <div key={item.id} className="stack" style={{ gap: '.35rem' }}>
                      <div className="row-between" style={{ gap: '.5rem' }}>
                        <strong className="text-sm">{item.name}</strong>
                        <span className="text-xs muted">{formatNumber(item.quantity)} / mín. {formatNumber(item.minQuantity)} {item.unit}</span>
                      </div>
                      <div className="progress"><div className={`progress__fill ${ratio < 60 ? 'progress__fill--danger' : 'progress__fill--warn'}`} style={{ width: `${Math.max(6, ratio)}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="block">
          <div className="block__head"><div><h3>Vendas por categoria</h3><p>Participação no faturamento</p></div></div>
          <div className="block__body">
            {a.categorySplit.length === 0 ? (
              <p className="text-sm muted">Sem dados suficientes.</p>
            ) : (
              <div className="chart-wrap chart-wrap--sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={a.categorySplit} dataKey="total" nameKey="category" innerRadius={52} outerRadius={82} paddingAngle={3} isAnimationActive={false}>
                      {a.categorySplit.map((entry, index) => <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => [formatMoney(Number(value)), categoryName(String((item as { payload?: { category?: string } })?.payload?.category ?? ''))]}
                      contentStyle={{ borderRadius: 12, border: '1px solid #ece0d4', fontSize: 13 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="stack" style={{ gap: '.3rem', marginTop: '.6rem' }}>
              {a.categorySplit.slice(0, 4).map((entry, index) => (
                <div className="row-between text-xs" key={entry.category}>
                  <span className="row" style={{ gap: '.4rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[index % PIE_COLORS.length] }} />
                    {categoryName(entry.category)}
                  </span>
                  <strong>{formatMoney(entry.total)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="block">
        <div className="block__head">
          <div><h3>Pedidos por dia</h3><p>Volume de pedidos recebidos nas últimas duas semanas</p></div>
          <span className="badge">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} no sistema</span>
        </div>
        <div className="block__body">
          <div className="chart-wrap chart-wrap--sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.revenueByDay} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="#eee4dc" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${Number(value)} pedido(s)`, 'Pedidos']} contentStyle={{ borderRadius: 12, border: '1px solid #ece0d4', fontSize: 13 }} />
                <Bar dataKey="orders" fill="#e0849c" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs muted" style={{ marginTop: '.8rem' }}>
            Taxa de entrega atual: {formatMoney(settings.deliveryFee)} • Frete grátis acima de {formatMoney(settings.freeDeliveryFrom)}
            {settings.minOrder > 0 ? ` • Pedido mínimo ${formatMoney(settings.minOrder)}` : ' • Sem pedido mínimo'}
          </p>
        </div>
      </section>
    </>
  );
}
