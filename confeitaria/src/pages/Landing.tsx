import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { ProductArt } from '../components/ProductArt';
import { SellerAccess } from '../components/SellerAccess';
import { useStore } from '../store/store';

export function Landing({ onEnterShop, onEnterAdmin }: { onEnterShop: () => void; onEnterAdmin: () => void }) {
  const { settings } = useStore();

  return (
    <div className="landing">
      <div className="container landing__top">
        <Brand settings={settings} />
        <div className="row" style={{ gap: '.6rem' }}>
          <SellerAccess onUnlock={onEnterAdmin} />
          <button type="button" className="btn btn--soft btn--sm" onClick={onEnterShop}>
            Fazer um pedido <Icon name="chevronRight" size={16} />
          </button>
        </div>
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
          <span className="text-sm muted"><Icon name="mapPin" size={14} /> {settings.address}</span>
          <span className="text-sm muted">{settings.hours}</span>
        </div>
        <SellerAccess onUnlock={onEnterAdmin} />
      </div>
    </div>
  );
}
