import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useStore } from './store/store';
import { Landing } from './pages/Landing';
import { ShopLayout } from './pages/customer/ShopLayout';
import type { ShopTab } from './pages/customer/ShopLayout';
import { Home } from './pages/customer/Home';
import { Menu } from './pages/customer/Menu';
import { Cart } from './pages/customer/Cart';
import { Checkout } from './pages/customer/Checkout';
import { MyOrders } from './pages/customer/MyOrders';
import { Account } from './pages/customer/Account';
import { AdminApp } from './pages/seller/AdminApp';

const SELLER_KEY = 'doce-encanto:vendedor';

/** O armazenamento pode estar bloqueado (janela anônima, cookies desativados). */
const sellerSession = {
  isUnlocked(): boolean {
    try {
      return sessionStorage.getItem(SELLER_KEY) === 'ok';
    } catch {
      return memoryUnlocked;
    }
  },
  unlock() {
    memoryUnlocked = true;
    try { sessionStorage.setItem(SELLER_KEY, 'ok'); } catch { /* mantém apenas em memória */ }
  },
  lock() {
    memoryUnlocked = false;
    try { sessionStorage.removeItem(SELLER_KEY); } catch { /* nada a limpar */ }
  },
};

let memoryUnlocked = false;

export default function App() {
  const [route, navigate] = useRoute();
  const { ready, settings } = useStore();
  const [path, query] = route.split('?');
  const params = new URLSearchParams(query ?? '');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand', settings.primaryColor);
    root.style.setProperty('--choc-500', settings.primaryColor);
    root.style.setProperty('--accent', settings.accentColor);
    root.style.setProperty('--pink-400', settings.accentColor);
  }, [settings.primaryColor, settings.accentColor]);

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p className="muted">Preparando a confeitaria...</p>
      </div>
    );
  }

  const unlockSeller = () => {
    sellerSession.unlock();
    navigate('/vendedor');
  };

  if (path.startsWith('/vendedor')) {
    if (!sellerSession.isUnlocked()) {
      return <Landing onEnterShop={() => navigate('/loja')} onEnterAdmin={unlockSeller} />;
    }
    return (
      <AdminApp
        section={path.replace('/vendedor', '').replace('/', '') || 'dashboard'}
        navigate={navigate}
        onExit={() => { sellerSession.lock(); navigate('/'); }}
      />
    );
  }

  if (path === '/' || path === '') {
    return <Landing onEnterShop={() => navigate('/loja')} onEnterAdmin={unlockSeller} />;
  }

  const tabByPath: Record<string, ShopTab> = {
    '/loja': 'inicio',
    '/cardapio': 'cardapio',
    '/carrinho': 'carrinho',
    '/checkout': 'carrinho',
    '/pedidos': 'pedidos',
    '/conta': 'conta',
  };

  const active = tabByPath[path] ?? 'inicio';

  const content = (() => {
    switch (path) {
      case '/cardapio': return <Menu initialCategory={params.get('categoria') ?? undefined} />;
      case '/carrinho': return <Cart navigate={navigate} />;
      case '/checkout': return <Checkout navigate={navigate} />;
      case '/pedidos': return <MyOrders navigate={navigate} />;
      case '/conta': return <Account navigate={navigate} />;
      case '/loja': return <Home navigate={navigate} />;
      default:
        return (
          <div className="container" style={{ marginTop: '3rem' }}>
            <div className="empty panel">
              <h3>Página não encontrada</h3>
              <p>O endereço acessado não existe. Volte para a loja e continue navegando.</p>
              <button type="button" className="btn btn--primary" onClick={() => navigate('/loja')}>Voltar para a loja</button>
            </div>
          </div>
        );
    }
  })();

  return <ShopLayout active={active} navigate={navigate}>{content}</ShopLayout>;
}
