import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { formatDate, formatMoney, initials, maskPhone, onlyDigits } from '../../lib/format';
import { STATUS_META } from '../../lib/status';
import { uid } from '../../lib/id';

export function Account({ navigate }: { navigate: (path: string) => void }) {
  const { currentCustomer, identifyCustomer, updateCustomer, signOut, orders } = useStore();
  const toast = useToast();
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentCustomer?.name ?? '');
  const [phone, setPhone] = useState(currentCustomer?.phone ?? '');
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('Casa');

  const myOrders = useMemo(
    () => (currentCustomer ? orders.filter((o) => o.customerId === currentCustomer.id) : []),
    [orders, currentCustomer],
  );
  const totalSpent = myOrders.filter((o) => o.status !== 'cancelado').reduce((sum, o) => sum + o.total, 0);

  if (!currentCustomer) {
    return (
      <div className="container" style={{ marginTop: '2.4rem', maxWidth: '520px' }}>
        <div className="panel card--pad stack">
          <div>
            <span className="eyebrow">Minha conta</span>
            <h2>Entre com seus dados</h2>
            <p className="soft" style={{ marginTop: '.4rem' }}>
              Sem senha, sem burocracia: o WhatsApp identifica você e reúne todo o seu histórico de pedidos.
            </p>
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (loginName.trim().length < 3) { toast.error('Nome inválido', 'Digite seu nome completo.'); return; }
              if (onlyDigits(loginPhone).length < 10) { toast.error('WhatsApp inválido', 'Informe o número com DDD.'); return; }
              const customer = identifyCustomer(loginName.trim(), maskPhone(loginPhone));
              setName(customer.name);
              setPhone(customer.phone);
              toast.success('Bem-vindo(a)!', 'Sua conta está pronta.');
            }}
          >
            <div className="field">
              <label htmlFor="ac-nome">Nome completo</label>
              <input id="ac-nome" className="input" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="field">
              <label htmlFor="ac-fone">WhatsApp</label>
              <input id="ac-fone" className="input" value={loginPhone} onChange={(e) => setLoginPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
            </div>
            <button type="submit" className="btn btn--primary btn--block">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  const saveProfile = () => {
    if (name.trim().length < 3) { toast.error('Nome inválido', 'Digite seu nome completo.'); return; }
    if (onlyDigits(phone).length < 10) { toast.error('WhatsApp inválido', 'Informe o número com DDD.'); return; }
    updateCustomer({ ...currentCustomer, name: name.trim(), phone: maskPhone(phone) });
    setEditing(false);
    toast.success('Dados atualizados', 'Suas informações foram salvas.');
  };

  const addAddress = () => {
    if (newAddress.trim().length < 8) { toast.error('Endereço incompleto', 'Informe rua, número e bairro.'); return; }
    updateCustomer({
      ...currentCustomer,
      addresses: [...currentCustomer.addresses, { id: uid('end'), label: newLabel.trim() || 'Endereço', value: newAddress.trim() }],
    });
    setNewAddress('');
    toast.success('Endereço salvo');
  };

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Minha conta</span>
          <h2>Seus dados</h2>
          <p>Gerencie suas informações, endereços e veja o histórico completo de pedidos.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { signOut(); toast.notify('info', 'Você saiu da conta'); }}>
          <Icon name="logout" size={15} /> Sair
        </button>
      </div>

      <div className="account-grid">
        <div className="stack" style={{ gap: '1.2rem' }}>
          <div className="panel account-hero">
            <span className="avatar">{initials(currentCustomer.name)}</span>
            <div>
              <h3>{currentCustomer.name}</h3>
              <p className="text-sm muted">{currentCustomer.phone}</p>
              <p className="text-xs muted">Cliente desde {formatDate(currentCustomer.createdAt.slice(0, 10))}</p>
            </div>
          </div>

          <div className="row" style={{ gap: '.8rem', flexWrap: 'wrap' }}>
            <div className="stat-mini" style={{ flex: 1 }}><strong>{myOrders.length}</strong><span>pedidos feitos</span></div>
            <div className="stat-mini" style={{ flex: 1 }}><strong>{formatMoney(totalSpent)}</strong><span>total investido em doces</span></div>
          </div>

          <div className="panel card--pad stack">
            <div className="row-between">
              <h3>Dados do cliente</h3>
              {!editing && (
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setEditing(true)}>
                  <Icon name="edit" size={13} /> Editar
                </button>
              )}
            </div>
            {editing ? (
              <>
                <div className="field">
                  <label htmlFor="pf-nome">Nome</label>
                  <input id="pf-nome" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="pf-fone">WhatsApp</label>
                  <input id="pf-fone" className="input" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: '.5rem' }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditing(false); setName(currentCustomer.name); setPhone(currentCustomer.phone); }}>Cancelar</button>
                  <button type="button" className="btn btn--primary btn--sm" onClick={saveProfile}>Salvar</button>
                </div>
              </>
            ) : (
              <div className="stack" style={{ gap: '.5rem' }}>
                <div className="review-line"><span className="muted">Nome</span><strong>{currentCustomer.name}</strong></div>
                <div className="review-line"><span className="muted">WhatsApp</span><strong>{currentCustomer.phone}</strong></div>
              </div>
            )}
          </div>

          <div className="panel card--pad stack">
            <h3>Endereços</h3>
            {currentCustomer.addresses.length === 0 && <p className="text-sm muted">Nenhum endereço salvo ainda.</p>}
            {currentCustomer.addresses.map((address) => (
              <div className="address-item" key={address.id}>
                <span>
                  <strong className="text-sm">{address.label}</strong>
                  <span className="text-sm muted" style={{ display: 'block' }}>{address.value}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label="Remover endereço"
                  onClick={() => {
                    updateCustomer({ ...currentCustomer, addresses: currentCustomer.addresses.filter((a) => a.id !== address.id) });
                    toast.notify('info', 'Endereço removido');
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
            <div className="form-grid" style={{ gridTemplateColumns: '120px 1fr' }}>
              <div className="field">
                <label htmlFor="ad-label">Apelido</label>
                <input id="ad-label" className="input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Casa" />
              </div>
              <div className="field">
                <label htmlFor="ad-valor">Novo endereço</label>
                <input id="ad-valor" className="input" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" />
              </div>
            </div>
            <button type="button" className="btn btn--soft btn--sm" onClick={addAddress}><Icon name="plus" size={14} /> Adicionar endereço</button>
          </div>
        </div>

        <div className="panel card--pad stack">
          <div className="row-between">
            <h3>Histórico de pedidos</h3>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => navigate('/pedidos')}>Acompanhar <Icon name="chevronRight" size={13} /></button>
          </div>
          {myOrders.length === 0 ? (
            <div className="empty">
              <span className="empty__icon"><Icon name="receipt" size={24} /></span>
              <h3>Sem pedidos ainda</h3>
              <p>Escolha seus doces favoritos no cardápio e faça o primeiro pedido.</p>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate('/cardapio')}>Ver cardápio</button>
            </div>
          ) : (
            <div className="stack" style={{ gap: '.6rem' }}>
              {myOrders.map((order) => (
                <div className="address-item" key={order.id} style={{ alignItems: 'flex-start' }}>
                  <span>
                    <strong className="text-sm">{order.code} — {formatDate(order.date)}</strong>
                    <span className="text-xs muted" style={{ display: 'block' }}>
                      {order.items.reduce((sum, i) => sum + i.quantity, 0)} itens • {formatMoney(order.total)}
                    </span>
                    <span className="text-xs muted">{order.items.map((i) => i.name).join(', ')}</span>
                  </span>
                  <span className="badge" style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}>
                    {STATUS_META[order.status].label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
