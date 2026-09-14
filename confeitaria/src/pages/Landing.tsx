import { useState } from 'react';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { ProductArt } from '../components/ProductArt';
import { useToast } from '../components/Toast';
import { useStore } from '../store/store';

const SELLER_CODE = '123';

export function Landing({ onEnterShop, onEnterAdmin }: { onEnterShop: () => void; onEnterAdmin: () => void }) {
  const { settings, products } = useStore();
  const toast = useToast();
  const [sellerOpen, setSellerOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('Digite o código de acesso.');
      return;
    }
    if (code.trim() !== SELLER_CODE) {
      setError('Código incorreto. Verifique e tente novamente.');
      toast.error('Acesso negado', 'O código informado não confere.');
      setCode('');
      return;
    }
    setError('');
    setSellerOpen(false);
    setCode('');
    toast.success('Bem-vindo de volta!', 'Painel do Vendedor liberado.');
    onEnterAdmin();
  };

  const closeSeller = () => {
    setSellerOpen(false);
    setCode('');
    setError('');
  };

  const highlights = products.filter((p) => p.featured).slice(0, 2);

  return (
    <div className="landing">
      <div className="container landing__top">
        <Brand settings={settings} />
        <button type="button" className="btn btn--soft btn--sm" onClick={onEnterShop}>
          Fazer um pedido <Icon name="chevronRight" size={16} />
        </button>
      </div>

      <div className="container landing__main">
        <div className="landing__copy">
          <span className="eyebrow"><Icon name="sparkles" size={14} /> {settings.tagline}</span>
          <h1>Doces que transformam <em>momentos</em> em memórias.</h1>
          <p className="lead">
            Bolos, tortas, docinhos e kits festa feitos à mão, com ingredientes selecionados e entrega no dia combinado.
            Monte o seu pedido em poucos minutos e acompanhe cada etapa da produção.
          </p>
          <div className="landing__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={onEnterShop}>
              <Icon name="bag" size={18} /> Entrar na loja
            </button>
            <a className="btn btn--ghost btn--lg" href="#/cardapio">Ver cardápio</a>
          </div>
          <div className="landing__facts">
            <div><strong>+2.400</strong><span>pedidos entregues</span></div>
            <div><strong>4,9★</strong><span>avaliação dos clientes</span></div>
            <div><strong>24h</strong><span>antecedência mínima</span></div>
          </div>
        </div>

        <div className="landing__art">
          <div className="landing__art-main"><ProductArt art="bolo-morango" /></div>
          <div className="landing__art-float"><ProductArt art="brigadeiro" /></div>
          <div className="landing__art-float"><ProductArt art="cupcake-chocolate" /></div>
          <div className="landing__badge">
            <span className="highlight__icon"><Icon name="truck" size={18} /></span>
            <span>
              <strong>Entrega hoje</strong>
              <span>Pedidos até às 14h</span>
            </span>
          </div>
        </div>
      </div>

      <div className="container landing__footer">
        <div className="row" style={{ gap: '1.4rem', flexWrap: 'wrap' }}>
          <span className="text-sm muted"><Icon name="mapPin" size={14} className="inline" /> {settings.address}</span>
          <span className="text-sm muted">{settings.hours}</span>
        </div>
        <button type="button" className="seller-link" onClick={() => setSellerOpen(true)}>
          <Icon name="lock" size={13} /> Vendedor
        </button>
      </div>

      <Modal
        open={sellerOpen}
        onClose={closeSeller}
        size="sm"
        title="Acesso do vendedor"
        subtitle="Informe o código interno para abrir o painel administrativo."
      >
        <form onSubmit={submitCode} className="stack">
          <div className="field">
            <label htmlFor="codigo-vendedor">Código de acesso</label>
            <input
              id="codigo-vendedor"
              className={`code-input ${error ? 'input--invalid' : ''}`}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="•••"
              aria-invalid={Boolean(error)}
            />
            {error ? <span className="error-text">{error}</span> : <span className="hint">O acesso é anônimo: não pedimos nome, e-mail nem senha.</span>}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: '.6rem' }}>
            <button type="button" className="btn btn--ghost" onClick={closeSeller}>Cancelar</button>
            <button type="submit" className="btn btn--primary">Entrar no painel</button>
          </div>
        </form>
        {highlights.length > 0 && (
          <p className="text-xs muted" style={{ marginTop: '1rem' }}>
            Hoje em destaque na loja: {highlights.map((p) => p.name).join(' e ')}.
          </p>
        )}
      </Modal>
    </div>
  );
}
