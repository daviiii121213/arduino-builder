import { useState } from 'react';
import { ConfirmDialog } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { ProductImage } from '../../components/ProductArt';
import { useToast } from '../../components/Toast';
import { useCart } from '../../store/cart';
import { useStore } from '../../store/store';
import { formatMoney } from '../../lib/format';

export function Cart({ navigate }: { navigate: (path: string) => void }) {
  const cart = useCart();
  const { settings, products } = useStore();
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const unavailable = cart.items.filter((item) => {
    const product = products.find((p) => p.id === item.productId);
    return !product || !product.available;
  });

  const freeDelivery = settings.freeDeliveryFrom > 0 && cart.subtotal >= settings.freeDeliveryFrom;
  const missingForFree = Math.max(0, settings.freeDeliveryFrom - cart.subtotal);

  const goToCheckout = () => {
    if (!cart.items.length) {
      toast.error('Carrinho vazio', 'Adicione pelo menos um produto para continuar.');
      return;
    }
    if (unavailable.length) {
      toast.error('Item indisponível', `Remova "${unavailable[0].name}" para continuar: o produto saiu do cardápio.`);
      return;
    }
    if (cart.subtotal < settings.minOrder) {
      toast.warn('Pedido mínimo', `O valor mínimo para pedidos é de ${formatMoney(settings.minOrder)}.`);
      return;
    }
    navigate('/checkout');
  };

  if (!cart.items.length) {
    return (
      <div className="container" style={{ marginTop: '2.4rem' }}>
        <div className="empty panel">
          <span className="empty__icon"><Icon name="cart" size={28} /></span>
          <h3>Seu carrinho está vazio</h3>
          <p>Que tal começar por um bolo recheado ou um cento de brigadeiros? Escolha seus favoritos no cardápio.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/cardapio')}>
            <Icon name="grid" size={17} /> Ver cardápio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Carrinho</span>
          <h2>Seu carrinho</h2>
          <p>{cart.count} {cart.count === 1 ? 'item' : 'itens'} selecionados. Revise as quantidades antes de finalizar.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmClear(true)}>
          <Icon name="trash" size={15} /> Esvaziar carrinho
        </button>
      </div>

      <div className="cart-layout">
        <div className="panel">
          {cart.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            const isUnavailable = !product || !product.available;
            return (
              <div className="cart-item" key={item.id}>
                <div className="cart-item__media"><ProductImage art={item.art} image={item.image} alt={item.name} /></div>
                <div className="cart-item__info">
                  <h4>{item.name}</h4>
                  {item.selections.length > 0 && (
                    <p className="cart-item__opts">
                      {item.selections.map((s) => `${s.groupLabel}: ${s.optionLabel}`).join(' • ')}
                    </p>
                  )}
                  {item.notes && <p className="cart-item__opts"><em>Obs.: {item.notes}</em></p>}
                  <p className="text-xs muted">{formatMoney(item.unitPrice)} por unidade</p>
                  {isUnavailable && <span className="badge badge--danger">Indisponível — remova para continuar</span>}
                </div>
                <div className="cart-item__side">
                  <div className="qty">
                    <button type="button" onClick={() => cart.setQuantity(item.id, item.quantity - 1)} aria-label="Diminuir">
                      <Icon name="minus" size={15} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => cart.setQuantity(item.id, item.quantity + 1)} aria-label="Aumentar">
                      <Icon name="plus" size={15} />
                    </button>
                  </div>
                  <div className="cart-item__price"><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => { cart.removeItem(item.id); toast.notify('info', 'Item removido', item.name); }} aria-label={`Remover ${item.name}`}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="panel summary">
          <h3>Resumo</h3>
          <div className="summary__line"><span>Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
          <div className="summary__line">
            <span>Taxa de entrega</span>
            <span>{freeDelivery ? 'Grátis' : `${formatMoney(settings.deliveryFee)} (se for entrega)`}</span>
          </div>
          {!freeDelivery && settings.freeDeliveryFrom > 0 && (
            <p className="text-xs muted">Faltam {formatMoney(missingForFree)} para ganhar frete grátis.</p>
          )}
          <div className="summary__total">
            <span>Total estimado</span>
            <strong>{formatMoney(cart.subtotal + (freeDelivery ? 0 : settings.deliveryFee))}</strong>
          </div>
          <p className="text-xs muted">O valor final é confirmado na próxima etapa, de acordo com entrega ou retirada.</p>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={goToCheckout}>
            Finalizar pedido <Icon name="chevronRight" size={17} />
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate('/cardapio')}>
            Continuar comprando
          </button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Esvaziar o carrinho?"
        message="Todos os itens selecionados serão removidos. Essa ação não pode ser desfeita."
        confirmLabel="Esvaziar"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { cart.clear(); setConfirmClear(false); toast.notify('info', 'Carrinho esvaziado'); }}
      />
    </div>
  );
}
