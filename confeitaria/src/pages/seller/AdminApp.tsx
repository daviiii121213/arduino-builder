import { useState } from 'react';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useStore } from '../../store/store';
import { Dashboard } from './Dashboard';
import { OrdersAdmin } from './OrdersAdmin';
import { ProductsAdmin } from './ProductsAdmin';
import { StockAdmin } from './StockAdmin';
import { CustomersAdmin } from './CustomersAdmin';
import { AgendaAdmin } from './AgendaAdmin';
import { FinanceAdmin } from './FinanceAdmin';
import { SettingsAdmin } from './SettingsAdmin';

interface NavItem { id: string; label: string; icon: IconName; title: string; subtitle: string }

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'chart', title: 'Dashboard', subtitle: 'Visão geral da confeitaria em tempo real' },
  { id: 'pedidos', label: 'Pedidos', icon: 'receipt', title: 'Pedidos', subtitle: 'Acompanhe e atualize o status de cada pedido' },
  { id: 'produtos', label: 'Produtos', icon: 'cake', title: 'Produtos', subtitle: 'Gerencie o cardápio exibido para os clientes' },
  { id: 'estoque', label: 'Estoque', icon: 'box', title: 'Estoque', subtitle: 'Controle de ingredientes e movimentações' },
  { id: 'clientes', label: 'Clientes', icon: 'users', title: 'Clientes', subtitle: 'Histórico e relacionamento com os clientes' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', title: 'Agenda', subtitle: 'Entregas e retiradas organizadas por data' },
  { id: 'financeiro', label: 'Financeiro', icon: 'wallet', title: 'Financeiro', subtitle: 'Faturamento, despesas e lucro estimado' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings', title: 'Configurações', subtitle: 'Dados da confeitaria e regras de atendimento' },
];

interface Props {
  section: string;
  navigate: (path: string) => void;
  onExit: () => void;
}

export function AdminApp({ section, navigate, onExit }: Props) {
  const { settings, orders, ingredients } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = NAV.find((item) => item.id === section) ?? NAV[0];
  const pendingOrders = orders.filter((o) => o.status === 'novo').length;
  const lowStock = ingredients.filter((i) => i.quantity <= i.minQuantity).length;

  const go = (id: string) => {
    navigate(`/vendedor/${id}`);
    setMenuOpen(false);
  };

  return (
    <div className={`admin ${menuOpen ? 'is-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="brand__mark"><Icon name="cake" size={24} /></span>
          <span>
            <strong>{settings.storeName}</strong>
            <span>Painel do Vendedor</span>
          </span>
        </div>
        <nav className="admin-nav">
          <span className="admin-nav__label">Operação</span>
          {NAV.slice(0, 4).map((item) => (
            <button key={item.id} type="button" className={current.id === item.id ? 'is-active' : ''} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} /> {item.label}
              {item.id === 'pedidos' && pendingOrders > 0 && <span className="pill">{pendingOrders}</span>}
              {item.id === 'estoque' && lowStock > 0 && <span className="pill">{lowStock}</span>}
            </button>
          ))}
          <span className="admin-nav__label">Gestão</span>
          {NAV.slice(4).map((item) => (
            <button key={item.id} type="button" className={current.id === item.id ? 'is-active' : ''} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__foot">
          <button type="button" className="admin-nav-exit" onClick={() => navigate('/loja')} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem .8rem', borderRadius: 12, cursor: 'pointer', color: 'rgba(243,231,221,.8)', fontSize: '.88rem' }}>
            <Icon name="store" size={17} /> Ver a loja
          </button>
          <button type="button" onClick={onExit} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.6rem .8rem', borderRadius: 12, cursor: 'pointer', color: 'rgba(243,231,221,.8)', fontSize: '.88rem' }}>
            <Icon name="logout" size={17} /> Sair do painel
          </button>
        </div>
      </aside>

      {menuOpen && <div className="admin-backdrop" onClick={() => setMenuOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="row" style={{ gap: '.8rem' }}>
            <button type="button" className="icon-btn admin-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menu">
              <Icon name="menu" size={18} />
            </button>
            <div>
              <h1>{current.title}</h1>
              <p>{current.subtitle}</p>
            </div>
          </div>
          <div className="row" style={{ gap: '.5rem' }}>
            {pendingOrders > 0 && (
              <button type="button" className="badge badge--accent" style={{ border: 'none', cursor: 'pointer' }} onClick={() => go('pedidos')}>
                <Icon name="bell" size={13} /> {pendingOrders} novo(s) pedido(s)
              </button>
            )}
            {lowStock > 0 && (
              <button type="button" className="badge badge--warn" style={{ border: 'none', cursor: 'pointer' }} onClick={() => go('estoque')}>
                <Icon name="alert" size={13} /> {lowStock} item(ns) em falta
              </button>
            )}
          </div>
        </header>

        <div className="admin-content">
          {current.id === 'dashboard' && <Dashboard go={go} />}
          {current.id === 'pedidos' && <OrdersAdmin />}
          {current.id === 'produtos' && <ProductsAdmin />}
          {current.id === 'estoque' && <StockAdmin />}
          {current.id === 'clientes' && <CustomersAdmin />}
          {current.id === 'agenda' && <AgendaAdmin />}
          {current.id === 'financeiro' && <FinanceAdmin />}
          {current.id === 'configuracoes' && <SettingsAdmin />}
        </div>
      </div>
    </div>
  );
}
