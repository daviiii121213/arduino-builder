import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { CATEGORIES } from '../../data/categories';
import { Icon } from '../../components/Icon';
import { ProductArt } from '../../components/ProductArt';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailModal } from '../../components/ProductDetailModal';
import { useStore } from '../../store/store';
import { useAddToCart } from './useAddToCart';
import { formatMoney } from '../../lib/format';

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const { products, orders, settings } = useStore();
  const addToCart = useAddToCart();
  const [selected, setSelected] = useState<Product | null>(null);

  const featured = useMemo(() => products.filter((p) => p.featured && p.available).slice(0, 4), [products]);

  const bestSellers = useMemo(() => {
    const sold = new Map<string, number>();
    orders.filter((o) => o.status !== 'cancelado').forEach((order) => {
      order.items.forEach((item) => sold.set(item.productId, (sold.get(item.productId) ?? 0) + item.quantity));
    });
    return [...products]
      .filter((p) => p.available)
      .sort((a, b) => (sold.get(b.id) ?? (b.bestSeller ? 5 : 0)) - (sold.get(a.id) ?? (a.bestSeller ? 5 : 0)))
      .slice(0, 4);
  }, [products, orders]);

  const promo = useMemo(() => products.find((p) => typeof p.promoPrice === 'number' && p.available) ?? null, [products]);

  const goToCategory = (category: string) => navigate(`/cardapio?categoria=${category}`);

  return (
    <div className="container">
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow"><Icon name="sparkles" size={14} /> {settings.tagline}</span>
          <h1>Feito na hora, <em>com muito carinho</em></h1>
          <p>
            Escolha entre bolos recheados, docinhos gourmet, tortas e kits completos para a sua festa.
            Personalize do jeito que você quiser e receba em casa ou retire na loja.
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--accent btn--lg" onClick={() => navigate('/cardapio')}>
              <Icon name="grid" size={18} /> Ver cardápio completo
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => goToCategory('personalizados')}>
              Encomenda personalizada
            </button>
          </div>
        </div>
        <div className="hero__art"><div><ProductArt art="bolo-chocolate" /></div></div>
      </section>

      <div className="highlights">
        {[
          { icon: 'truck' as const, title: 'Entrega no dia combinado', text: 'Escolha a data e o horário no fechamento do pedido.' },
          { icon: 'cake' as const, title: 'Produção artesanal', text: 'Nada é feito com antecedência: tudo fresquinho.' },
          { icon: 'heart' as const, title: 'Personalize tudo', text: 'Tamanho, recheio, cobertura e mensagem especial.' },
          { icon: 'phone' as const, title: 'Atendimento próximo', text: `Fale com a gente pelo ${settings.whatsapp}.` },
        ].map((item) => (
          <div className="card highlight" key={item.title}>
            <span className="highlight__icon"><Icon name={item.icon} size={20} /></span>
            <span>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Categorias</span>
            <h2>O que você procura hoje?</h2>
            <p>Navegue pelas categorias da confeitaria e encontre o doce perfeito para o seu momento.</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/cardapio')}>
            Ver tudo <Icon name="chevronRight" size={15} />
          </button>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((category) => (
            <button type="button" className="category-card" key={category.id} onClick={() => goToCategory(category.id)}>
              <span className="category-card__art"><ProductArt art={category.art} /></span>
              <span className="category-card__body">
                <strong>{category.name}</strong>
                <span>{(() => { const total = products.filter((p) => p.category === category.id && p.available).length; return `${total} ${total === 1 ? 'item' : 'itens'}`; })()}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Destaques da casa</span>
              <h2>Escolhas da confeiteira</h2>
              <p>Receitas que saem todos os dias da nossa cozinha e conquistam qualquer paladar.</p>
            </div>
          </div>
          <div className="product-grid">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={setSelected}
                onQuickAdd={(p) => addToCart({ product: p, quantity: 1, selections: [], notes: '', unitPrice: p.promoPrice ?? p.price })}
              />
            ))}
          </div>
        </section>
      )}

      <section className="promo">
        <div>
          <span className="eyebrow">Kit festa</span>
          <h2>Sua festa resolvida em um só pedido</h2>
          <p>
            Bolo, cem docinhos, cem salgados e decoração de mesa. Monte o kit no tamanho da sua comemoração e receba tudo pronto no dia.
            {promo && ` Aproveite também ${promo.name} por ${formatMoney(promo.promoPrice ?? promo.price)}.`}
          </p>
        </div>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => goToCategory('kits')}>
          <Icon name="bag" size={18} /> Montar meu kit
        </button>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Mais pedidos</span>
            <h2>Os campeões de venda</h2>
            <p>Os produtos que nossos clientes mais pedem — baseado nos pedidos reais da confeitaria.</p>
          </div>
        </div>
        <div className="product-grid">
          {bestSellers.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={setSelected}
              onQuickAdd={(p) => addToCart({ product: p, quantity: 1, selections: [], notes: '', unitPrice: p.promoPrice ?? p.price })}
            />
          ))}
        </div>
      </section>

      <ProductDetailModal
        product={selected}
        onClose={() => setSelected(null)}
        onAdd={(payload) => { if (addToCart(payload)) setSelected(null); }}
      />
    </div>
  );
}
