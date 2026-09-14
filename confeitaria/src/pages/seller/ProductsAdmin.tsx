import { useMemo, useRef, useState } from 'react';
import type { CategoryId, OptionGroup, Product } from '../../types';
import { CATEGORIES, categoryName } from '../../data/categories';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { ProductArt, ProductImage, artKeys } from '../../components/ProductArt';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { formatMoney, parseMoneyInput } from '../../lib/format';
import { uid } from '../../lib/id';

type Draft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  details: '',
  price: 0,
  category: 'bolos',
  art: 'bolo-chocolate',
  image: undefined,
  available: true,
  featured: false,
  bestSeller: false,
  promoPrice: null,
  unitLabel: 'unidade',
  prepDays: 1,
  stock: null,
  optionGroups: [],
});

export function ProductsAdmin() {
  const { products, createProduct, saveProduct, deleteProduct, toggleProductAvailability } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string>('todos');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== 'todos' && product.category !== category) return false;
      if (!normalized) return true;
      return `${product.name} ${product.description}`.toLowerCase().includes(normalized);
    });
  }, [products, term, category]);

  const patch = (changes: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...changes } : prev));

  const openNew = () => { setErrors({}); setDraft(emptyDraft()); };
  const openEdit = (product: Product) => { setErrors({}); setDraft({ ...product, optionGroups: product.optionGroups.map((g) => ({ ...g, options: g.options.map((o) => ({ ...o })) })) }); };

  const addGroup = () => {
    if (!draft) return;
    patch({
      optionGroups: [
        ...draft.optionGroups,
        { id: uid('grp'), label: 'Nova opção', type: 'single', required: false, options: [{ id: uid('opt'), label: 'Padrão', priceDelta: 0 }] },
      ],
    });
  };

  const updateGroup = (groupId: string, changes: Partial<OptionGroup>) => {
    if (!draft) return;
    patch({ optionGroups: draft.optionGroups.map((g) => (g.id === groupId ? { ...g, ...changes } : g)) });
  };

  const handleUpload = (file: File) => {
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('Imagem muito grande', 'Escolha um arquivo de até 1,5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ image: String(reader.result) });
    reader.onerror = () => toast.error('Falha ao carregar a imagem', 'Tente novamente com outro arquivo.');
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!draft) return;
    const next: Record<string, string> = {};
    if (draft.name.trim().length < 3) next.name = 'Informe o nome do produto.';
    if (draft.description.trim().length < 8) next.description = 'Escreva uma descrição curta para o cardápio.';
    if (!(draft.price > 0)) next.price = 'Informe um preço maior que zero.';
    if (draft.promoPrice != null && draft.promoPrice >= draft.price) next.promoPrice = 'O preço promocional deve ser menor que o preço normal.';
    const emptyGroup = draft.optionGroups.find((g) => g.options.length === 0);
    if (emptyGroup) next.options = `O grupo "${emptyGroup.label}" precisa de ao menos uma opção.`;
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Revise o formulário', 'Alguns campos precisam de atenção.');
      return;
    }

    if (draft.id) {
      saveProduct({ ...(draft as Product) });
      toast.success('Produto atualizado', `${draft.name} foi salvo e já aparece no cardápio.`);
    } else {
      const { id: _ignored, ...rest } = draft;
      createProduct(rest);
      toast.success('Produto criado', `${draft.name} já está disponível na loja.`);
    }
    setDraft(null);
  };

  return (
    <>
      <section className="block">
        <div className="block__head">
          <div className="toolbar">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input className="input" placeholder="Buscar produto" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <select className="select" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="todos">Todas as categorias</option>
              {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn--primary" onClick={openNew}>
            <Icon name="plus" size={17} /> Novo produto
          </button>
        </div>
        <div className="block__body">
          <div className="row" style={{ gap: '1.4rem', flexWrap: 'wrap' }}>
            <span className="text-sm muted"><strong>{products.length}</strong> produtos cadastrados</span>
            <span className="text-sm muted"><strong>{products.filter((p) => p.available).length}</strong> disponíveis</span>
            <span className="text-sm muted"><strong>{products.filter((p) => !p.available).length}</strong> indisponíveis</span>
            <span className="text-sm muted"><strong>{products.filter((p) => p.featured).length}</strong> em destaque</span>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="block empty">
          <span className="empty__icon"><Icon name="cake" size={26} /></span>
          <h3>Nenhum produto encontrado</h3>
          <p>Cadastre um novo produto ou limpe os filtros da busca.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={openNew}>Cadastrar produto</button>
        </div>
      ) : (
        <div className="admin-product-grid">
          {filtered.map((product) => (
            <article className="admin-product" key={product.id}>
              <div className="admin-product__media">
                <ProductImage art={product.art} image={product.image} alt={product.name} />
                <div className="product-card__tags">
                  {!product.available && <span className="badge badge--danger">Indisponível</span>}
                  {product.featured && <span className="badge badge--accent">Destaque</span>}
                </div>
              </div>
              <div className="admin-product__body">
                <h4>{product.name}</h4>
                <span className="admin-product__meta">{categoryName(product.category)} • {product.unitLabel}</span>
                <span className="admin-product__meta">{product.optionGroups.length} grupo(s) de personalização</span>
                <strong style={{ color: 'var(--choc-600)', fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
                  {formatMoney(product.promoPrice ?? product.price)}
                  {product.promoPrice != null && <small className="muted text-xs" style={{ textDecoration: 'line-through', marginLeft: '.4rem' }}>{formatMoney(product.price)}</small>}
                </strong>
              </div>
              <div className="admin-product__foot">
                <label className="switch" title="Disponível para venda">
                  <input type="checkbox" checked={product.available} onChange={() => { toggleProductAvailability(product.id); toast.notify('info', product.available ? 'Produto desativado' : 'Produto ativado', product.name); }} />
                  <span className="switch__track" />
                  <span className="text-xs">{product.available ? 'Disponível' : 'Indisponível'}</span>
                </label>
                <div className="row" style={{ gap: '.3rem' }}>
                  <button type="button" className="icon-btn" onClick={() => openEdit(product)} aria-label={`Editar ${product.name}`}><Icon name="edit" size={16} /></button>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => setRemoveTarget(product)} aria-label={`Excluir ${product.name}`}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar produto' : 'Novo produto'}
        subtitle="As alterações aparecem imediatamente no Painel do Cliente."
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>Cancelar</button>
            <button type="button" className="btn btn--primary" onClick={submit}>
              <Icon name="check" size={16} /> {draft?.id ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack" style={{ gap: '1.3rem' }}>
            <div className="form-grid">
              <div className="field span-2">
                <label htmlFor="pr-nome">Nome do produto *</label>
                <input id="pr-nome" className={`input ${errors.name ? 'input--invalid' : ''}`} value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Bolo de Chocolate" />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
              <div className="field span-2">
                <label htmlFor="pr-desc">Descrição curta (aparece no card) *</label>
                <input id="pr-desc" className={`input ${errors.description ? 'input--invalid' : ''}`} value={draft.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Uma frase que dá água na boca" />
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>
              <div className="field span-2">
                <label htmlFor="pr-det">Descrição completa</label>
                <textarea id="pr-det" className="textarea" value={draft.details} onChange={(e) => patch({ details: e.target.value })} placeholder="Detalhe ingredientes, tamanho, rendimento..." />
              </div>
              <div className="field">
                <label htmlFor="pr-preco">Preço *</label>
                <input id="pr-preco" className={`input ${errors.price ? 'input--invalid' : ''}`} value={draft.price ? String(draft.price).replace('.', ',') : ''} onChange={(e) => patch({ price: parseMoneyInput(e.target.value) })} placeholder="45,00" inputMode="decimal" />
                {errors.price && <span className="error-text">{errors.price}</span>}
              </div>
              <div className="field">
                <label htmlFor="pr-promo">Preço promocional</label>
                <input id="pr-promo" className={`input ${errors.promoPrice ? 'input--invalid' : ''}`} value={draft.promoPrice != null ? String(draft.promoPrice).replace('.', ',') : ''} onChange={(e) => { const value = parseMoneyInput(e.target.value); patch({ promoPrice: e.target.value.trim() === '' || value <= 0 ? null : value }); }} placeholder="Deixe vazio se não houver" inputMode="decimal" />
                {errors.promoPrice && <span className="error-text">{errors.promoPrice}</span>}
              </div>
              <div className="field">
                <label htmlFor="pr-cat">Categoria</label>
                <select id="pr-cat" className="select" value={draft.category} onChange={(e) => patch({ category: e.target.value as CategoryId })}>
                  {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="pr-unid">Unidade de venda</label>
                <input id="pr-unid" className="input" value={draft.unitLabel} onChange={(e) => patch({ unitLabel: e.target.value })} placeholder="unidade, cento, kit..." />
              </div>
              <div className="field">
                <label htmlFor="pr-prep">Antecedência (dias)</label>
                <input id="pr-prep" type="number" min={0} max={30} className="input" value={draft.prepDays} onChange={(e) => patch({ prepDays: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
              <div className="field">
                <label htmlFor="pr-estoque">Estoque disponível</label>
                <input id="pr-estoque" className="input" type="number" min={0} value={draft.stock ?? ''} onChange={(e) => patch({ stock: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })} placeholder="Vazio = sob encomenda" />
                <span className="hint">Deixe vazio para produtos feitos sob encomenda.</span>
              </div>
            </div>

            <div className="row" style={{ gap: '1.4rem', flexWrap: 'wrap' }}>
              <label className="switch">
                <input type="checkbox" checked={draft.available} onChange={(e) => patch({ available: e.target.checked })} />
                <span className="switch__track" /> Disponível para venda
              </label>
              <label className="switch">
                <input type="checkbox" checked={draft.featured} onChange={(e) => patch({ featured: e.target.checked })} />
                <span className="switch__track" /> Exibir em destaque
              </label>
              <label className="switch">
                <input type="checkbox" checked={draft.bestSeller} onChange={(e) => patch({ bestSeller: e.target.checked })} />
                <span className="switch__track" /> Marcar como mais vendido
              </label>
            </div>

            <div className="stack">
              <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.95rem' }}>Imagem do produto</h4>
              <div className="row" style={{ gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 150, height: 112, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <ProductImage art={draft.art} image={draft.image} alt="Pré-visualização" />
                </div>
                <div className="stack" style={{ flex: 1, minWidth: 240 }}>
                  <div className="field">
                    <label htmlFor="pr-img">Endereço da foto (URL)</label>
                    <input id="pr-img" className="input" value={draft.image ?? ''} onChange={(e) => patch({ image: e.target.value.trim() || undefined })} placeholder="https://..." />
                  </div>
                  <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = ''; }} />
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => fileRef.current?.click()}><Icon name="image" size={15} /> Enviar foto</button>
                    {draft.image && <button type="button" className="btn btn--ghost btn--sm" onClick={() => patch({ image: undefined })}>Usar ilustração</button>}
                  </div>
                </div>
              </div>
              {!draft.image && (
                <>
                  <span className="hint">Sem foto? Escolha uma das ilustrações da confeitaria:</span>
                  <div className="filters-scroll">
                    {artKeys.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => patch({ art: key })}
                        style={{
                          flex: 'none', width: 72, height: 56, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0,
                          border: draft.art === key ? '2.5px solid var(--choc-500)' : '1px solid var(--line)',
                        }}
                        aria-label={`Ilustração ${key}`}
                      >
                        <ProductArt art={key} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="stack">
              <div className="row-between">
                <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '.95rem' }}>Personalização (tamanhos, recheios, coberturas...)</h4>
                <button type="button" className="btn btn--soft btn--xs" onClick={addGroup}><Icon name="plus" size={13} /> Novo grupo</button>
              </div>
              {errors.options && <span className="error-text">{errors.options}</span>}
              {draft.optionGroups.length === 0 && <p className="text-sm muted">Nenhum grupo cadastrado. O produto será vendido sem opções adicionais.</p>}
              {draft.optionGroups.map((group) => (
                <div className="option-editor" key={group.id}>
                  <div className="form-grid--3 form-grid">
                    <div className="field">
                      <label>Nome do grupo</label>
                      <input className="input" value={group.label} onChange={(e) => updateGroup(group.id, { label: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Tipo de escolha</label>
                      <select className="select" value={group.type} onChange={(e) => updateGroup(group.id, { type: e.target.value as 'single' | 'multi' })}>
                        <option value="single">Escolha única</option>
                        <option value="multi">Múltipla escolha</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Obrigatório?</label>
                      <label className="switch" style={{ marginTop: '.4rem' }}>
                        <input type="checkbox" checked={group.required} onChange={(e) => updateGroup(group.id, { required: e.target.checked })} />
                        <span className="switch__track" /> {group.required ? 'Sim' : 'Não'}
                      </label>
                    </div>
                  </div>

                  {group.options.map((option) => (
                    <div className="option-editor__row" key={option.id}>
                      <input
                        className="input"
                        value={option.label}
                        placeholder="Nome da opção"
                        onChange={(e) => updateGroup(group.id, { options: group.options.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)) })}
                      />
                      <input
                        className="input"
                        value={option.priceDelta ? String(option.priceDelta).replace('.', ',') : ''}
                        placeholder="+ R$ 0,00"
                        inputMode="decimal"
                        onChange={(e) => updateGroup(group.id, { options: group.options.map((o) => (o.id === option.id ? { ...o, priceDelta: parseMoneyInput(e.target.value) } : o)) })}
                      />
                      <button type="button" className="icon-btn icon-btn--danger" aria-label="Remover opção"
                        onClick={() => updateGroup(group.id, { options: group.options.filter((o) => o.id !== option.id) })}>
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}

                  <div className="row" style={{ gap: '.5rem' }}>
                    <button type="button" className="btn btn--ghost btn--xs" onClick={() => updateGroup(group.id, { options: [...group.options, { id: uid('opt'), label: '', priceDelta: 0 }] })}>
                      <Icon name="plus" size={13} /> Adicionar opção
                    </button>
                    <button type="button" className="btn btn--outline-danger btn--xs" onClick={() => patch({ optionGroups: draft.optionGroups.filter((g) => g.id !== group.id) })}>
                      <Icon name="trash" size={13} /> Remover grupo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Excluir produto?"
        message={removeTarget ? `"${removeTarget.name}" será removido do cardápio. Pedidos antigos continuam registrados no histórico.` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          deleteProduct(removeTarget.id);
          toast.success('Produto excluído', `${removeTarget.name} saiu do cardápio.`);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
