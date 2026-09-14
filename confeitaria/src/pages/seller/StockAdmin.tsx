import { useMemo, useState } from 'react';
import type { Ingredient, StockUnit } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { formatDateTime, formatMoney, formatNumber, parseMoneyInput } from '../../lib/format';

const UNITS: StockUnit[] = ['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'];

type Draft = Omit<Ingredient, 'id' | 'updatedAt'> & { id?: string };

const emptyDraft = (): Draft => ({ name: '', unit: 'kg', quantity: 0, minQuantity: 0, cost: 0 });

export function StockAdmin() {
  const { ingredients, stockMoves, createIngredient, saveIngredient, deleteIngredient, registerStockMove } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Ingredient | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ ingredient: Ingredient; type: 'entrada' | 'saida' } | null>(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [term, setTerm] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    return ingredients.filter((item) => {
      if (onlyLow && item.quantity > item.minQuantity) return false;
      return !normalized || item.name.toLowerCase().includes(normalized);
    });
  }, [ingredients, term, onlyLow]);

  const lowCount = ingredients.filter((i) => i.quantity <= i.minQuantity).length;
  const stockValue = ingredients.reduce((sum, i) => sum + i.quantity * i.cost, 0);

  const submitDraft = () => {
    if (!draft) return;
    if (draft.name.trim().length < 2) { toast.error('Nome inválido', 'Informe o nome do ingrediente.'); return; }
    if (draft.quantity < 0 || draft.minQuantity < 0) { toast.error('Valores inválidos', 'As quantidades não podem ser negativas.'); return; }
    if (draft.id) {
      saveIngredient({ ...(draft as Ingredient) });
      toast.success('Ingrediente atualizado', draft.name);
    } else {
      const { id: _ignored, ...rest } = draft;
      createIngredient(rest);
      toast.success('Ingrediente cadastrado', draft.name);
    }
    setDraft(null);
  };

  const submitMove = () => {
    if (!moveTarget) return;
    const quantity = parseMoneyInput(moveQty);
    if (!(quantity > 0)) { toast.error('Quantidade inválida', 'Informe um valor maior que zero.'); return; }
    if (moveTarget.type === 'saida' && quantity > moveTarget.ingredient.quantity) {
      toast.error('Estoque insuficiente', `Há apenas ${formatNumber(moveTarget.ingredient.quantity)} ${moveTarget.ingredient.unit} disponíveis.`);
      return;
    }
    registerStockMove({ ingredientId: moveTarget.ingredient.id, type: moveTarget.type, quantity, reason: moveReason });
    toast.success(moveTarget.type === 'entrada' ? 'Entrada registrada' : 'Saída registrada', `${formatNumber(quantity)} ${moveTarget.ingredient.unit} de ${moveTarget.ingredient.name}.`);
    setMoveTarget(null);
    setMoveQty('');
    setMoveReason('');
  };

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi__top"><span className="kpi__label">Ingredientes</span><span className="kpi__icon"><Icon name="box" size={19} /></span></div><span className="kpi__value">{ingredients.length}</span><span className="kpi__foot">itens cadastrados</span></div>
        <div className={`kpi ${lowCount ? 'kpi--warn' : 'kpi--ok'}`}><div className="kpi__top"><span className="kpi__label">Estoque baixo</span><span className="kpi__icon"><Icon name="alert" size={19} /></span></div><span className="kpi__value">{lowCount}</span><span className="kpi__foot">{lowCount ? 'precisam de reposição' : 'tudo em dia'}</span></div>
        <div className="kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Valor em estoque</span><span className="kpi__icon"><Icon name="wallet" size={19} /></span></div><span className="kpi__value">{formatMoney(stockValue)}</span><span className="kpi__foot">custo estimado dos insumos</span></div>
        <div className="kpi kpi--info"><div className="kpi__top"><span className="kpi__label">Movimentações</span><span className="kpi__icon"><Icon name="trendUp" size={19} /></span></div><span className="kpi__value">{stockMoves.length}</span><span className="kpi__foot">registros no histórico</span></div>
      </div>

      <section className="block">
        <div className="block__head">
          <div className="toolbar">
            <div className="search-box">
              <Icon name="search" size={17} />
              <input className="input" placeholder="Buscar ingrediente" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <label className="switch">
              <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
              <span className="switch__track" /> Só estoque baixo
            </label>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setDraft(emptyDraft())}><Icon name="plus" size={17} /> Novo ingrediente</button>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">
            <span className="empty__icon"><Icon name="box" size={24} /></span>
            <h3>Nenhum ingrediente encontrado</h3>
            <p>Cadastre insumos para controlar entradas, saídas e alertas de reposição.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Ingrediente</th><th>Quantidade</th><th>Estoque mínimo</th><th className="right">Custo unitário</th><th>Situação</th><th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const low = item.quantity <= item.minQuantity;
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong className="text-sm">{item.name}</strong>
                        <span className="text-xs muted" style={{ display: 'block' }}>Atualizado em {formatDateTime(item.updatedAt)}</span>
                      </td>
                      <td><strong>{formatNumber(item.quantity)}</strong> {item.unit}</td>
                      <td>{formatNumber(item.minQuantity)} {item.unit}</td>
                      <td className="right">{formatMoney(item.cost)}</td>
                      <td><span className={`badge ${low ? 'badge--warn' : 'badge--ok'} badge--dot`}>{low ? 'Repor' : 'Em dia'}</span></td>
                      <td className="right">
                        <div className="row" style={{ justifyContent: 'flex-end', gap: '.3rem' }}>
                          <button type="button" className="btn btn--soft btn--xs" onClick={() => { setMoveTarget({ ingredient: item, type: 'entrada' }); setMoveQty(''); setMoveReason(''); }}>Entrada</button>
                          <button type="button" className="btn btn--ghost btn--xs" onClick={() => { setMoveTarget({ ingredient: item, type: 'saida' }); setMoveQty(''); setMoveReason(''); }}>Saída</button>
                          <button type="button" className="icon-btn" onClick={() => setDraft({ ...item })} aria-label="Editar"><Icon name="edit" size={15} /></button>
                          <button type="button" className="icon-btn icon-btn--danger" onClick={() => setRemoveTarget(item)} aria-label="Excluir"><Icon name="trash" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="block">
        <div className="block__head"><div><h3>Histórico de movimentações</h3><p>Todas as entradas e saídas registradas</p></div></div>
        {stockMoves.length === 0 ? (
          <div className="empty"><span className="empty__icon"><Icon name="trendUp" size={22} /></span><p>Nenhuma movimentação registrada até agora.</p></div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="data">
              <thead><tr><th>Data</th><th>Ingrediente</th><th>Tipo</th><th>Quantidade</th><th>Motivo</th></tr></thead>
              <tbody>
                {stockMoves.slice(0, 40).map((move) => (
                  <tr key={move.id}>
                    <td className="text-sm">{formatDateTime(move.at)}</td>
                    <td className="text-sm"><strong>{move.ingredientName}</strong></td>
                    <td><span className={`badge ${move.type === 'entrada' ? 'badge--ok' : 'badge--info'}`}>{move.type === 'entrada' ? 'Entrada' : 'Saída'}</span></td>
                    <td className="text-sm">{formatNumber(move.quantity)} {move.unit}</td>
                    <td className="text-sm muted">{move.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar ingrediente' : 'Novo ingrediente'}
        size="sm"
        footer={<>
          <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={submitDraft}>Salvar</button>
        </>}
      >
        {draft && (
          <div className="stack">
            <div className="field">
              <label htmlFor="ing-nome">Nome</label>
              <input id="ing-nome" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Chocolate nobre" />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="ing-qtd">Quantidade atual</label>
                <input id="ing-qtd" className="input" value={String(draft.quantity).replace('.', ',')} onChange={(e) => setDraft({ ...draft, quantity: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor="ing-un">Unidade</label>
                <select id="ing-un" className="select" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as StockUnit })}>
                  {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ing-min">Estoque mínimo</label>
                <input id="ing-min" className="input" value={String(draft.minQuantity).replace('.', ',')} onChange={(e) => setDraft({ ...draft, minQuantity: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor="ing-custo">Custo por unidade</label>
                <input id="ing-custo" className="input" value={String(draft.cost).replace('.', ',')} onChange={(e) => setDraft({ ...draft, cost: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title={moveTarget?.type === 'entrada' ? 'Registrar entrada' : 'Registrar saída'}
        subtitle={moveTarget ? `${moveTarget.ingredient.name} — disponível: ${formatNumber(moveTarget.ingredient.quantity)} ${moveTarget.ingredient.unit}` : ''}
        size="sm"
        footer={<>
          <button type="button" className="btn btn--ghost" onClick={() => setMoveTarget(null)}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={submitMove}>Registrar</button>
        </>}
      >
        <div className="stack">
          <div className="field">
            <label htmlFor="mv-qtd">Quantidade ({moveTarget?.ingredient.unit})</label>
            <input id="mv-qtd" className="input" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="mv-motivo">Motivo</label>
            <input id="mv-motivo" className="input" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder={moveTarget?.type === 'entrada' ? 'Compra no fornecedor' : 'Produção do dia'} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Excluir ingrediente?"
        message={removeTarget ? `"${removeTarget.name}" será removido do estoque. O histórico de movimentações é mantido.` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          deleteIngredient(removeTarget.id);
          toast.success('Ingrediente excluído', removeTarget.name);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
