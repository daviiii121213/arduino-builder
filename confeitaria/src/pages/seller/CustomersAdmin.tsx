import { useMemo, useState } from 'react';
import type { Customer } from '../../types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { formatDate, formatMoney, initials, maskPhone, onlyDigits } from '../../lib/format';
import { STATUS_META } from '../../lib/status';

export function CustomersAdmin() {
  const { customers, orders, updateCustomer } = useStore();
  const toast = useToast();
  const [term, setTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const rows = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    const digits = onlyDigits(term);
    return customers
      .map((customer) => {
        const list = orders.filter((o) => o.customerId === customer.id);
        const valid = list.filter((o) => o.status !== 'cancelado');
        return {
          customer,
          orders: list,
          count: list.length,
          total: valid.reduce((sum, o) => sum + o.total, 0),
          last: list[0]?.date ?? null,
        };
      })
      .filter((row) => {
        if (!normalized) return true;
        return row.customer.name.toLowerCase().includes(normalized) || (digits.length > 2 && onlyDigits(row.customer.phone).includes(digits));
      })
      .sort((a, b) => b.total - a.total);
  }, [customers, orders, term]);

  const open = rows.find((row) => row.customer.id === openId) ?? null;

  const saveNotes = (customer: Customer) => {
    updateCustomer({ ...customer, notes });
    toast.success('Observações salvas', customer.name);
  };

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi__top"><span className="kpi__label">Clientes</span><span className="kpi__icon"><Icon name="users" size={19} /></span></div><span className="kpi__value">{customers.length}</span><span className="kpi__foot">cadastrados na base</span></div>
        <div className="kpi kpi--ok"><div className="kpi__top"><span className="kpi__label">Clientes recorrentes</span><span className="kpi__icon"><Icon name="heart" size={19} /></span></div><span className="kpi__value">{rows.filter((r) => r.count > 1).length}</span><span className="kpi__foot">com mais de um pedido</span></div>
        <div className="kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Maior cliente</span><span className="kpi__icon"><Icon name="star" size={19} /></span></div><span className="kpi__value">{rows[0] ? formatMoney(rows[0].total) : formatMoney(0)}</span><span className="kpi__foot">{rows[0]?.customer.name ?? 'Nenhum pedido ainda'}</span></div>
      </div>

      <section className="block">
        <div className="block__head">
          <div className="toolbar">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input className="input" placeholder="Buscar por nome ou telefone" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
          </div>
          <span className="badge">{rows.length} resultado(s)</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">
            <span className="empty__icon"><Icon name="users" size={24} /></span>
            <h3>Nenhum cliente encontrado</h3>
            <p>Os clientes são cadastrados automaticamente quando fazem o primeiro pedido.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Pedidos</th><th className="right">Total gasto</th><th>Último pedido</th><th className="right">Ações</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.customer.id}>
                    <td>
                      <div className="row" style={{ gap: '.6rem' }}>
                        <span className="avatar" style={{ width: 36, height: 36, fontSize: '.85rem' }}>{initials(row.customer.name)}</span>
                        <span>
                          <strong className="text-sm">{row.customer.name}</strong>
                          <span className="text-xs muted" style={{ display: 'block' }}>Cliente desde {formatDate(row.customer.createdAt.slice(0, 10))}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-sm">{maskPhone(row.customer.phone)}</td>
                    <td className="text-sm">{row.count}</td>
                    <td className="right"><strong>{formatMoney(row.total)}</strong></td>
                    <td className="text-sm">{row.last ? formatDate(row.last) : '—'}</td>
                    <td className="right">
                      <button type="button" className="btn btn--soft btn--xs" onClick={() => { setOpenId(row.customer.id); setNotes(row.customer.notes); }}>
                        <Icon name="eye" size={13} /> Ver ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.customer.name}
        subtitle={open ? `${open.count} pedido(s) • ${formatMoney(open.total)} em compras` : ''}
        size="lg"
        footer={open && <button type="button" className="btn btn--primary" onClick={() => saveNotes(open.customer)}>Salvar observações</button>}
      >
        {open && (
          <div className="stack" style={{ gap: '1.2rem' }}>
            <div className="detail-grid">
              <div className="detail-item"><span>WhatsApp / telefone</span><strong>{maskPhone(open.customer.phone)}</strong></div>
              <div className="detail-item"><span>Cliente desde</span><strong>{formatDate(open.customer.createdAt.slice(0, 10))}</strong></div>
              <div className="detail-item"><span>Ticket médio</span><strong>{formatMoney(open.count ? open.total / open.count : 0)}</strong></div>
            </div>

            <div className="stack" style={{ gap: '.5rem' }}>
              <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-mute)' }}>Endereços</h4>
              {open.customer.addresses.length === 0 && <p className="text-sm muted">Nenhum endereço cadastrado.</p>}
              {open.customer.addresses.map((address) => (
                <p className="text-sm" key={address.id}><Icon name="mapPin" size={14} /> <strong>{address.label}:</strong> {address.value}</p>
              ))}
            </div>

            <div className="field">
              <label htmlFor="cli-obs">Observações internas</label>
              <textarea id="cli-obs" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências, restrições alimentares, combinados especiais..." />
            </div>

            <div className="stack" style={{ gap: '.5rem' }}>
              <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ink-mute)' }}>Histórico de pedidos</h4>
              {open.orders.length === 0 && <p className="text-sm muted">Este cliente ainda não fez pedidos.</p>}
              {open.orders.map((order) => (
                <div className="order-item-line" key={order.id}>
                  <span>
                    <strong>{order.code}</strong> — {formatDate(order.date)} às {order.time}
                    <span className="text-xs muted" style={{ display: 'block' }}>{order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</span>
                  </span>
                  <span className="row" style={{ gap: '.5rem' }}>
                    <span className="badge" style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}>{STATUS_META[order.status].label}</span>
                    <strong>{formatMoney(order.total)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
