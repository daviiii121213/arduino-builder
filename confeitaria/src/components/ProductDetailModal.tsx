import { useEffect, useMemo, useState } from 'react';
import type { CartSelection, Product } from '../types';
import { formatMoney } from '../lib/format';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { ProductImage } from './ProductArt';
import { categoryName } from '../data/categories';

interface Props {
  product: Product | null;
  onClose: () => void;
  onAdd: (payload: { product: Product; quantity: number; selections: CartSelection[]; notes: string; unitPrice: number }) => void;
}

export function ProductDetailModal({ product, onClose, onAdd }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return;
    setQuantity(1);
    setNotes('');
    setError('');
    const initial: Record<string, string[]> = {};
    product.optionGroups.forEach((group) => {
      initial[group.id] = group.type === 'single' && group.required ? [group.options[0]?.id].filter(Boolean) as string[] : [];
    });
    setChosen(initial);
  }, [product]);

  const basePrice = product ? product.promoPrice ?? product.price : 0;

  const selections = useMemo<CartSelection[]>(() => {
    if (!product) return [];
    return product.optionGroups.flatMap((group) =>
      (chosen[group.id] ?? []).flatMap((optionId) => {
        const option = group.options.find((o) => o.id === optionId);
        if (!option) return [];
        return [{ groupId: group.id, groupLabel: group.label, optionId: option.id, optionLabel: option.label, priceDelta: option.priceDelta }];
      }),
    );
  }, [product, chosen]);

  const unitPrice = basePrice + selections.reduce((sum, s) => sum + s.priceDelta, 0);

  if (!product) return null;

  const toggle = (groupId: string, optionId: string, type: 'single' | 'multi') => {
    setError('');
    setChosen((prev) => {
      const current = prev[groupId] ?? [];
      if (type === 'single') return { ...prev, [groupId]: current[0] === optionId ? [] : [optionId] };
      return { ...prev, [groupId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
    });
  };

  const handleAdd = () => {
    const missing = product.optionGroups.find((group) => group.required && !(chosen[group.id] ?? []).length);
    if (missing) {
      setError(`Escolha uma opção em "${missing.label}" para continuar.`);
      return;
    }
    if (!product.available) {
      setError('Este produto está indisponível no momento.');
      return;
    }
    onAdd({ product, quantity, selections, notes, unitPrice });
  };

  return (
    <Modal open={Boolean(product)} onClose={onClose} size="lg" variant="showcase">
      <div className="product-detail">
        <div className="product-detail__media">
          <ProductImage art={product.art} image={product.image} alt={product.name} />
        </div>
        <div className="product-detail__info">
          <div>
            <span className="eyebrow">{categoryName(product.category)}</span>
            <h2 style={{ marginTop: '.35rem' }}>{product.name}</h2>
          </div>
          <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
            <span className={`badge ${product.available ? 'badge--ok' : 'badge--danger'} badge--dot`}>
              {product.available ? 'Disponível' : 'Indisponível'}
            </span>
            <span className="badge"><Icon name="clock" size={12} /> {product.prepDays === 0 ? 'Pronta entrega' : `${product.prepDays} dia(s) de antecedência`}</span>
            {product.bestSeller && <span className="badge badge--accent"><Icon name="star" size={12} /> Mais vendido</span>}
          </div>
          <p className="soft">{product.details}</p>
          <div className="product-detail__price">
            {formatMoney(basePrice)} <small className="text-sm muted">/ {product.unitLabel}</small>
          </div>

          <div className="product-detail__group">
            <header><h4>Quantidade</h4></header>
            <div className="qty">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Diminuir quantidade">
                <Icon name="minus" size={16} />
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="Aumentar quantidade">
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          {product.optionGroups.map((group) => (
            <div className="product-detail__group" key={group.id}>
              <header>
                <h4>{group.label}</h4>
                <span className="text-xs muted">{group.required ? 'Obrigatório' : group.type === 'multi' ? 'Escolha quantos quiser' : 'Opcional'}</span>
              </header>
              <div className="option-grid">
                {group.options.map((option) => {
                  const active = (chosen[group.id] ?? []).includes(option.id);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={`option ${active ? 'option--active' : ''}`}
                      onClick={() => toggle(group.id, option.id, group.type)}
                      aria-pressed={active}
                    >
                      <span>{option.label}</span>
                      {option.priceDelta !== 0 && (
                        <span className="option__delta">{option.priceDelta > 0 ? '+' : '−'} {formatMoney(Math.abs(option.priceDelta))}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="field">
            <label htmlFor="obs-produto">Observações</label>
            <textarea
              id="obs-produto"
              className="textarea"
              placeholder="Digite aqui... (ex.: escrever “Parabéns, Maria!” no bolo)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="product-detail__total">
            <span>Total do item</span>
            <strong>{formatMoney(unitPrice * quantity)}</strong>
          </div>

          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={handleAdd} disabled={!product.available}>
            <Icon name="cart" size={18} /> {product.available ? 'Adicionar ao carrinho' : 'Produto indisponível'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
