import type { ReactNode } from 'react';
import { Brand } from '../../components/Brand';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useCart } from '../../store/cart';
import { useStore } from '../../store/store';

export type ShopTab = 'inicio' | 'cardapio' | 'carrinho' | 'pedidos' | 'conta';

const TABS: { id: ShopTab; label: string; short: string; icon: IconName; path: string }[] = [
  { id: 'inicio', label: 'Início', short: 'Início', icon: 'home', path: '/loja' },
  { id: 'cardapio', label: 'Cardápio', short: 'Cardápio', icon: 'grid', path: '/cardapio' },
  { id: 'carrinho', label: 'Carrinho', short: 'Carrinho', icon: 'cart', path: '/carrinho' },
  { id: 'pedidos', label: 'Meus pedidos', short: 'Pedidos', icon: 'receipt', path: '/pedidos' },
  { id: 'conta', label: 'Minha conta', short: 'Conta', icon: 'user', path: '/conta' },
];

interface Props {
  active: ShopTab;
  navigate: (path: string) => void;
  children: ReactNode;
}

export function ShopLayout({ active, navigate, children }: Props) {
  const { settings, currentCustomer, orders } = useStore();
  const cart = useCart();
  const openOrders = currentCustomer
    ? orders.filter((o) => o.customerId === currentCustomer.id && !['entregue', 'cancelado'].includes(o.status)).length
    : 0;

  return (
    <div className="shop">
      <header className="shop-header">
        <div className="container shop-header__inner">
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => navigate('/loja')} aria-label="Ir para o início">
            <Brand settings={settings} />
          </button>

          <nav className="shop-nav" aria-label="Navegação principal">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={active === tab.id ? 'is-active' : ''}
                onClick={() => navigate(tab.path)}
              >
                <Icon name={tab.icon} size={17} /> {tab.label}
                {tab.id === 'pedidos' && openOrders > 0 && <span className="badge badge--accent" style={{ padding: '.05rem .4rem' }}>{openOrders}</span>}
              </button>
            ))}
          </nav>

          <div className="shop-header__actions">
            <button type="button" className="icon-btn cart-button" onClick={() => navigate('/carrinho')} aria-label={`Carrinho com ${cart.count} item(ns)`}>
              <Icon name="cart" size={18} />
              {cart.count > 0 && <span className="cart-button__count">{cart.count}</span>}
            </button>
            <button type="button" className="btn btn--soft btn--sm" onClick={() => navigate('/conta')}>
              <Icon name="user" size={16} />
              <span className="nowrap">{currentCustomer ? currentCustomer.name.split(' ')[0] : 'Entrar'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shop-main">{children}</main>

      <footer style={{ background: '#2c150c', color: 'rgba(243,231,221,.75)', padding: '2.4rem 0 2rem', marginTop: '3rem' }}>
        <div className="container" style={{ display: 'grid', gap: '1.4rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#fff', display: 'block' }}>{settings.storeName}</strong>
            <p className="text-sm" style={{ marginTop: '.4rem' }}>{settings.tagline}</p>
          </div>
          <div className="text-sm stack" style={{ gap: '.35rem' }}>
            <strong style={{ color: '#fff' }}>Atendimento</strong>
            <span><Icon name="phone" size={13} /> {settings.whatsapp}</span>
            <span>{settings.hours}</span>
          </div>
          <div className="text-sm stack" style={{ gap: '.35rem' }}>
            <strong style={{ color: '#fff' }}>Onde estamos</strong>
            <span>{settings.address}</span>
          </div>
          <div className="text-sm stack" style={{ gap: '.35rem' }}>
            <strong style={{ color: '#fff' }}>Entrega</strong>
            <span>Taxa de entrega: {settings.deliveryFee > 0 ? `R$ ${settings.deliveryFee.toFixed(2).replace('.', ',')}` : 'grátis'}</span>
            {settings.freeDeliveryFrom > 0 && <span>Frete grátis acima de R$ {settings.freeDeliveryFrom.toFixed(2).replace('.', ',')}</span>}
          </div>
        </div>
        <div className="container text-xs" style={{ marginTop: '1.6rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          © {new Date().getFullYear()} {settings.storeName}. Todos os direitos reservados.
        </div>
      </footer>

      <nav className="mobile-tabs" aria-label="Navegação">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={active === tab.id ? 'is-active' : ''} onClick={() => navigate(tab.path)}>
            <Icon name={tab.icon} size={19} />
            {tab.short}
          </button>
        ))}
      </nav>
    </div>
  );
}
