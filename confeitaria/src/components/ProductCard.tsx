import type { Product } from '../types';
import { formatMoney } from '../lib/format';
import { Icon } from './Icon';
import { ProductImage } from './ProductArt';

interface Props {
  product: Product;
  onOpen: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export function ProductCard({ product, onOpen, onQuickAdd }: Props) {
  const price = product.promoPrice ?? product.price;
  const hasPromo = typeof product.promoPrice === 'number' && product.promoPrice < product.price;

  return (
    <article className="product-card">
      <div className="product-card__media" onClick={() => onOpen(product)} role="button" tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(product)}
        aria-label={`Ver ${product.name}`}>
        <ProductImage art={product.art} image={product.image} alt={product.name} />
        <div className="product-card__tags">
          {product.bestSeller && <span className="badge badge--accent"><Icon name="star" size={12} /> Mais vendido</span>}
          {hasPromo && <span className="badge badge--danger">Oferta</span>}
          {product.featured && !product.bestSeller && !hasPromo && <span className="badge">Destaque</span>}
        </div>
        {!product.available && <div className="product-card__unavailable">Indisponível</div>}
      </div>
      <div className="product-card__body">
        <h3>{product.name}</h3>
        <p className="product-card__desc">{product.description}</p>
        <div className="product-card__price">
          <strong>{formatMoney(price)}</strong>
          {hasPromo && <small style={{ textDecoration: 'line-through' }}>{formatMoney(product.price)}</small>}
          <small>/ {product.unitLabel}</small>
        </div>
        <div className="product-card__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onOpen(product)}>Ver produto</button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!product.available}
            onClick={() => (product.optionGroups.length ? onOpen(product) : onQuickAdd(product))}
          >
            <Icon name="cart" size={15} /> {product.available ? 'Adicionar' : 'Esgotado'}
          </button>
        </div>
      </div>
    </article>
  );
}
