import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { useAnalytics } from './useAnalytics';
import { PAYMENT_LABEL } from '../../lib/status';
import { addDays, formatDate, formatMoney, formatMoneyShort, parseMoneyInput, todayISO } from '../../lib/format';
import type { Expense } from '../../types';

const PERIODS = [
  { id: '7', label: 'Últimos 7 dias' },
  { id: '30', label: 'Últimos 30 dias' },
  { id: '90', label: 'Últimos 90 dias' },
  { id: 'todos', label: 'Todo o período' },
];

const CATEGORIES = ['Insumos', 'Embalagens', 'Fixas', 'Entregas', 'Marketing', 'Outros'];

export function FinanceAdmin() {
  const { orders, expenses, addExpense, deleteExpense } = useStore();
  const analytics = useAnalytics();
  const toast = useToast();
  const [period, setPeriod] = useState('30');
  const [modalOpen, setModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState({ description: '', category: 'Insumos', amount: '', date: todayISO() });

  const from = period === 'todos' ? '0000-01-01' : addDays(todayISO(), -Number(period));

  const data = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'entregue' && o.updatedAt.slice(0, 10) >= from);
    const scheduled = orders.filter((o) => !['entregue', 'cancelado'].includes(o.status) && o.date >= from);
    const periodExpenses = expenses.filter((e) => e.date >= from);
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const cost = periodExpenses.reduce((s, e) => s + e.amount, 0);
    return {
      paid,
      scheduled,
      periodExpenses,
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      forecast: scheduled.reduce((s, o) => s + o.total, 0),
      byPayment: (['pix', 'dinheiro', 'cartao'] as const).map((method) => ({
        method,
        total: paid.filter((o) => o.payment === method).reduce((s, o) => s + o.total, 0),
        count: paid.filter((o) => o.payment === method).length,
      })),
      byExpenseCategory: CATEGORIES.map((category) => ({
        category,
        total: periodExpenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0),
      })).filter((entry) => entry.total > 0),
    };
  }, [orders, expenses, from]);

  const submitExpense = () => {
    const amount = parseMoneyInput(form.amount);
    if (form.description.trim().length < 3) { toast.error('Descrição obrigatória', 'Informe do que se trata a despesa.'); return; }
    if (!(amount > 0)) { toast.error('Valor inválido', 'Informe um valor maior que zero.'); return; }
    addExpense({ description: form.description.trim(), category: form.category, amount, date: form.date });
    toast.success('Despesa registrada', `${form.description} — ${formatMoney(amount)}`);
    setForm({ description: '', category: 'Insumos', amount: '', date: todayISO() });
    setModalOpen(false);
  };

  const maxPayment = Math.max(1, ...data.byPayment.map((p) => p.total));

  return (
    <>
      <section className="block">
        <div className="block__head">
          <div className="filters-scroll">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" className={`chip ${period === item.id ? 'chip--active' : ''}`} onClick={() => setPeriod(item.id)}>{item.label}</button>
            ))}
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setModalOpen(true)}><Icon name="plus" size={16} /> Nova despesa</button>
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi kpi--ok"><div className="kpi__top"><span className="kpi__label">Faturamento</span><span className="kpi__icon"><Icon name="wallet" size={19} /></span></div><span className="kpi__value">{formatMoney(data.revenue)}</span><span className="kpi__foot">{data.paid.length} pedido(s) entregue(s)</span></div>
        <div className="kpi kpi--warn"><div className="kpi__top"><span className="kpi__label">Despesas</span><span className="kpi__icon"><Icon name="trendDown" size={19} /></span></div><span className="kpi__value">{formatMoney(data.cost)}</span><span className="kpi__foot">{data.periodExpenses.length} lançamento(s)</span></div>
        <div className="kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Lucro estimado</span><span className="kpi__icon"><Icon name="trendUp" size={19} /></span></div><span className="kpi__value">{formatMoney(data.profit)}</span><span className={`kpi__foot ${data.profit >= 0 ? 'trend-up' : 'trend-down'}`}>margem de {data.margin.toFixed(1).replace('.', ',')}%</span></div>
        <div className="kpi kpi--info"><div className="kpi__top"><span className="kpi__label">A receber</span><span className="kpi__icon"><Icon name="calendar" size={19} /></span></div><span className="kpi__value">{formatMoney(data.forecast)}</span><span className="kpi__foot">{data.scheduled.length} pedido(s) em aberto</span></div>
      </div>

      <div className="admin-grid-2">
        <section className="block">
          <div className="block__head"><div><h3>Faturamento x despesas</h3><p>Comparativo dos últimos 6 meses</p></div></div>
          <div className="block__body">
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.revenueByMonth} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#eee4dc" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#967f73' }} axisLine={false} tickLine={false} width={72} tickFormatter={(v) => formatMoneyShort(Number(v))} />
                  <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name === 'value' ? 'Faturamento' : 'Despesas']} contentStyle={{ borderRadius: 12, border: '1px solid #ece0d4', fontSize: 13 }} />
                  <Legend formatter={(value) => (value === 'value' ? 'Faturamento' : 'Despesas')} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill="#8c4a2f" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="expense" fill="#e0849c" radius={[8, 8, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head"><div><h3>Formas de pagamento</h3><p>Distribuição do faturamento no período</p></div></div>
          <div className="block__body">
            <div className="payment-bar">
              {data.byPayment.map((entry) => (
                <div className="payment-bar__row" key={entry.method}>
                  <div className="payment-bar__top">
                    <span>{PAYMENT_LABEL[entry.method]} <span className="muted text-xs">({entry.count} pedido(s))</span></span>
                    <strong>{formatMoney(entry.total)}</strong>
                  </div>
                  <div className="progress"><div className="progress__fill" style={{ width: `${Math.max(3, (entry.total / maxPayment) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            {data.byExpenseCategory.length > 0 && (
              <>
                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-mute)', marginTop: '1.4rem' }}>Despesas por categoria</h4>
                <div className="stack" style={{ gap: '.4rem', marginTop: '.6rem' }}>
                  {data.byExpenseCategory.map((entry) => (
                    <div className="review-line text-sm" key={entry.category}><span>{entry.category}</span><strong>{formatMoney(entry.total)}</strong></div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="admin-grid-2">
        <section className="block">
          <div className="block__head"><div><h3>Pedidos faturados</h3><p>Últimos pedidos entregues no período</p></div></div>
          {data.paid.length === 0 ? (
            <div className="empty"><span className="empty__icon"><Icon name="receipt" size={22} /></span><p>Nenhum pedido entregue neste período.</p></div>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data" style={{ minWidth: 440 }}>
                <thead><tr><th>Pedido</th><th>Cliente</th><th>Pagamento</th><th className="right">Valor</th></tr></thead>
                <tbody>
                  {data.paid.slice(0, 12).map((order) => (
                    <tr key={order.id}>
                      <td><strong className="text-sm">{order.code}</strong><span className="text-xs muted" style={{ display: 'block' }}>{formatDate(order.date)}</span></td>
                      <td className="text-sm">{order.customerName}</td>
                      <td><span className="badge">{PAYMENT_LABEL[order.payment]}</span></td>
                      <td className="right"><strong>{formatMoney(order.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="block">
          <div className="block__head"><div><h3>Despesas lançadas</h3><p>Controle de saídas do caixa</p></div></div>
          {data.periodExpenses.length === 0 ? (
            <div className="empty">
              <span className="empty__icon"><Icon name="wallet" size={22} /></span>
              <p>Nenhuma despesa registrada neste período.</p>
              <button type="button" className="btn btn--soft btn--sm" onClick={() => setModalOpen(true)}>Registrar despesa</button>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data" style={{ minWidth: 440 }}>
                <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th className="right">Valor</th><th /></tr></thead>
                <tbody>
                  {data.periodExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="text-sm"><strong>{expense.description}</strong></td>
                      <td><span className="badge">{expense.category}</span></td>
                      <td className="text-sm">{formatDate(expense.date)}</td>
                      <td className="right"><strong>{formatMoney(expense.amount)}</strong></td>
                      <td className="right">
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => setRemoveTarget(expense)} aria-label="Excluir despesa"><Icon name="trash" size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova despesa"
        subtitle="Lance as saídas para acompanhar o lucro real da confeitaria."
        size="sm"
        footer={<>
          <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={submitExpense}>Registrar</button>
        </>}
      >
        <div className="stack">
          <div className="field">
            <label htmlFor="dp-desc">Descrição</label>
            <input id="dp-desc" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Compra de chocolate" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="dp-cat">Categoria</label>
              <select id="dp-cat" className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dp-valor">Valor</label>
              <input id="dp-valor" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="field span-2">
              <label htmlFor="dp-data">Data</label>
              <input id="dp-data" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Excluir despesa?"
        message={removeTarget ? `"${removeTarget.description}" será removida do financeiro.` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          deleteExpense(removeTarget.id);
          toast.success('Despesa excluída');
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
