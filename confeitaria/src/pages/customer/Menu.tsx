import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import { CATEGORIES } from '../../data/categories';
import { Icon } from '../../components/Icon';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailModal } from '../../components/ProductDetailModal';
import { useStore } from '../../store/store';
import { useAddToCart } from './useAddToCart';

type SortKey = 'destaques' | 'preco-asc' | 'preco-desc' | 'nome';

export function Menu({ initialCategory }: { initialCategory?: string }) {
  const { products } = useStore();
  const addToCart = useAddToCart();
  const [category, setCategory] = useState<string>(initialCategory ?? 'todos');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<SortKey>('destaques');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const list = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (category !== 'todos' && product.category !== category) return false;
      if (onlyAvailable && !product.available) return false;
      if (!normalized) return true;
      return `${product.name} ${product.description} ${product.details}`.toLowerCase().includes(normalized);
    });
    const sorted = [...filtered];
    if (sort === 'preco-asc') sorted.sort((a, b) => (a.promoPrice ?? a.price) - (b.promoPrice ?? b.price));
    else if (sort === 'preco-desc') sorted.sort((a, b) => (b.promoPrice ?? b.price) - (a.promoPrice ?? a.price));
    else if (sort === 'nome') sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else sorted.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.available) - Number(a.available));
    return sorted;
  }, [products, category, term, sort, onlyAvailable]);

  const groups = useMemo(() => {
    if (category !== 'todos' || term.trim()) return null;
    return CATEGORIES.map((cat) => ({ cat, items: list.filter((p) => p.category === cat.id) })).filter((g) => g.items.length > 0);
  }, [category, term, list]);

  const quickAdd = (product: Product) =>
    addToCart({ product, quantity: 1, selections: [], notes: '', unitPrice: product.promoPrice ?? product.price });

  return (
    <div className="container">
      <div className="section-head" style={{ marginTop: '2rem' }}>
        <div>
          <span className="eyebrow">Cardápio</span>
          <h2>Nosso cardápio completo</h2>
          <p>Tudo o que sai da nossa cozinha, sempre fresquinho. Use os filtros para achar rapidinho o que você quer.</p>
        </div>
      </div>

      <div className="menu-toolbar">
        <div className="menu-toolbar__row">
          <div className="search-box">
            <Icon name="search" size={17} />
            <input
              className="input"
              placeholder="Buscar por nome ou ingrediente..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Buscar produtos"
            />
          </div>
          <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar">
            <option value="destaques">Ordenar: destaques</option>
            <option value="preco-asc">Menor preço</option>
            <option value="preco-desc">Maior preço</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
          <label className="switch">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            <span className="switch__track" />
            Só disponíveis
          </label>
        </div>
        <div className="filters-scroll" style={{ marginTop: '.8rem' }}>
          <button type="button" className={`chip ${category === 'todos' ? 'chip--active' : ''}`} onClick={() => setCategory('todos')}>
            Todos ({products.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" className={`chip ${category === cat.id ? 'chip--active' : ''}`} onClick={() => setCategory(cat.id)}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty panel">
          <span className="empty__icon"><Icon name="search" size={26} /></span>
          <h3>Nenhum produto encontrado</h3>
          <p>Não encontramos itens com esses filtros. Tente outra busca ou veja todas as categorias.</p>
          <button type="button" className="btn btn--soft btn--sm" onClick={() => { setTerm(''); setCategory('todos'); setOnlyAvailable(false); }}>
            Limpar filtros
          </button>
        </div>
      ) : groups ? (
        groups.map(({ cat, items }) => (
          <section className="section" key={cat.id} style={{ marginTop: '2.4rem' }}>
            <div className="section-head">
              <div>
                <h3 style={{ fontSize: '1.5rem' }}>{cat.name}</h3>
                <p className="text-sm">{cat.description}</p>
              </div>
              <span className="badge">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
            </div>
            <div className="product-grid">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={setSelected} onQuickAdd={quickAdd} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="product-grid">
          {list.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={setSelected} onQuickAdd={quickAdd} />
          ))}
        </div>
      )}

      <ProductDetailModal
        product={selected}
        onClose={() => setSelected(null)}
        onAdd={(payload) => { if (addToCart(payload)) setSelected(null); }}
      />
    </div>
  );
}
