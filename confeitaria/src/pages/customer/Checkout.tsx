import { useMemo, useState } from 'react';
import type { Fulfillment, PaymentMethod } from '../../types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useCart } from '../../store/cart';
import { useStore } from '../../store/store';
import { PAYMENT_LABEL } from '../../lib/status';
import { addDays, formatDateLong, formatMoney, maskPhone, onlyDigits, todayISO } from '../../lib/format';

const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

type Errors = Partial<Record<'name' | 'phone' | 'address' | 'date' | 'time', string>>;

export function Checkout({ navigate }: { navigate: (path: string) => void }) {
  const cart = useCart();
  const { settings, currentCustomer, createOrder, products } = useStore();
  const toast = useToast();

  const maxPrepDays = useMemo(() => {
    return cart.items.reduce((max, item) => {
      const product = products.find((p) => p.id === item.productId);
      return Math.max(max, product?.prepDays ?? 1);
    }, 0);
  }, [cart.items, products]);

  const minDate = addDays(todayISO(), maxPrepDays);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(currentCustomer?.name ?? '');
  const [phone, setPhone] = useState(currentCustomer?.phone ?? '');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('entrega');
  const [address, setAddress] = useState(currentCustomer?.addresses[0]?.value ?? '');
  const [date, setDate] = useState(minDate);
  const [time, setTime] = useState('14:00');
  const [payment, setPayment] = useState<PaymentMethod>(
    (Object.keys(settings.payments) as PaymentMethod[]).find((key) => settings.payments[key]) ?? 'pix',
  );
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const freeDelivery = settings.freeDeliveryFrom > 0 && cart.subtotal >= settings.freeDeliveryFrom;
  const deliveryFee = fulfillment === 'entrega' ? (freeDelivery ? 0 : settings.deliveryFee) : 0;
  const total = cart.subtotal + deliveryFee;

  if (!cart.items.length) {
    return (
      <div className="container" style={{ marginTop: '2.4rem' }}>
        <div className="empty panel">
          <span className="empty__icon"><Icon name="cart" size={28} /></span>
          <h3>Não há itens para finalizar</h3>
          <p>Seu carrinho está vazio. Adicione produtos ao carrinho para concluir um pedido.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/cardapio')}>Ir para o cardápio</button>
        </div>
      </div>
    );
  }

  const validate = (): boolean => {
    const next: Errors = {};
    if (name.trim().length < 3) next.name = 'Informe seu nome completo.';
    if (onlyDigits(phone).length < 10) next.phone = 'Informe um WhatsApp válido com DDD.';
    if (fulfillment === 'entrega' && address.trim().length < 8) next.address = 'Informe o endereço completo para a entrega.';
    if (!date) next.date = 'Escolha a data desejada.';
    else if (date < minDate) next.date = `Precisamos de ${maxPrepDays} dia(s) de antecedência. A data mínima é ${formatDateLong(minDate)}.`;
    if (!time) next.time = 'Escolha o horário desejado.';
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Confira os dados', 'Existem campos obrigatórios para preencher.');
      return false;
    }
    return true;
  };

  const goToReview = () => {
    if (!validate()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmOrder = () => {
    if (!validate()) { setStep(1); return; }
    const outOfStock = cart.items.find((item) => {
      const product = products.find((p) => p.id === item.productId);
      return !product || !product.available;
    });
    if (outOfStock) {
      toast.error('Não foi possível criar o pedido', `O produto "${outOfStock.name}" não está mais disponível.`);
      navigate('/carrinho');
      return;
    }
    setSubmitting(true);
    try {
      const order = createOrder({
        customerName: name.trim(),
        customerPhone: maskPhone(phone),
        address: address.trim(),
        fulfillment,
        payment,
        date,
        time,
        notes,
        items: cart.items,
        deliveryFee: freeDelivery ? 0 : settings.deliveryFee,
      });
      cart.clear();
      toast.success('Pedido criado com sucesso!', `Pedido ${order.code} enviado para a confeitaria.`);
      navigate('/pedidos');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao criar o pedido', 'Tente novamente em alguns instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Finalizar pedido</span>
          <h2>Quase lá!</h2>
          <p>Preencha seus dados, escolha a data e revise tudo antes de confirmar.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/carrinho')}>
          <Icon name="arrowLeft" size={15} /> Voltar ao carrinho
        </button>
      </div>

      <div className="checkout-steps">
        <span className={`checkout-step ${step === 1 ? 'is-active' : 'is-done'}`}>
          <span className="checkout-step__num">{step === 1 ? '1' : <Icon name="check" size={14} />}</span> Dados do pedido
        </span>
        <span className="checkout-divider" />
        <span className={`checkout-step ${step === 2 ? 'is-active' : ''}`}>
          <span className="checkout-step__num">2</span> Revisão e confirmação
        </span>
      </div>

      <div className="checkout-layout">
        <div className="panel card--pad stack" style={{ gap: '1.4rem' }}>
          {step === 1 ? (
            <>
              <div className="stack">
                <h3>Seus dados</h3>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="ck-nome">Nome completo *</label>
                    <input id="ck-nome" className={`input ${errors.name ? 'input--invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devemos te chamar?" />
                    {errors.name && <span className="error-text">{errors.name}</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="ck-fone">WhatsApp / Telefone *</label>
                    <input id="ck-fone" className={`input ${errors.phone ? 'input--invalid' : ''}`} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
                    {errors.phone && <span className="error-text">{errors.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="stack">
                <h3>Entrega ou retirada</h3>
                <div className="option-grid">
                  {(['entrega', 'retirada'] as Fulfillment[]).map((option) => (
                    <button type="button" key={option} className={`option ${fulfillment === option ? 'option--active' : ''}`} onClick={() => setFulfillment(option)}>
                      <span className="row" style={{ gap: '.5rem' }}>
                        <Icon name={option === 'entrega' ? 'truck' : 'store'} size={17} />
                        {option === 'entrega' ? 'Entrega' : 'Retirada na loja'}
                      </span>
                      <span className="option__delta">{option === 'entrega' ? (freeDelivery ? 'Grátis' : formatMoney(settings.deliveryFee)) : 'Sem taxa'}</span>
                    </button>
                  ))}
                </div>
                {fulfillment === 'entrega' ? (
                  <div className="field">
                    <label htmlFor="ck-end">Endereço completo *</label>
                    <textarea id="ck-end" className={`textarea ${errors.address ? 'textarea--invalid' : ''}`} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, complemento, bairro e cidade" style={{ minHeight: '80px' }} />
                    {errors.address && <span className="error-text">{errors.address}</span>}
                    {currentCustomer && currentCustomer.addresses.length > 0 && (
                      <div className="chip-row" style={{ marginTop: '.3rem' }}>
                        {currentCustomer.addresses.map((item) => (
                          <button type="button" key={item.id} className="chip" onClick={() => setAddress(item.value)}>
                            <Icon name="mapPin" size={13} /> {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm soft"><Icon name="mapPin" size={14} /> Retirada em: {settings.address} — {settings.hours}</p>
                )}
              </div>

              <div className="stack">
                <h3>Data e horário</h3>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="ck-data">Data desejada *</label>
                    <input id="ck-data" type="date" className={`input ${errors.date ? 'input--invalid' : ''}`} value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
                    {errors.date ? <span className="error-text">{errors.date}</span> : <span className="hint">Precisamos de {maxPrepDays === 0 ? 'nenhuma' : `${maxPrepDays} dia(s) de`} antecedência para este pedido.</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="ck-hora">Horário desejado *</label>
                    <select id="ck-hora" className={`select ${errors.time ? 'select--invalid' : ''}`} value={time} onChange={(e) => setTime(e.target.value)}>
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {errors.time && <span className="error-text">{errors.time}</span>}
                  </div>
                </div>
              </div>

              <div className="stack">
                <h3>Forma de pagamento</h3>
                <div className="option-grid">
                  {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).filter((key) => settings.payments[key]).map((key) => (
                    <button type="button" key={key} className={`option ${payment === key ? 'option--active' : ''}`} onClick={() => setPayment(key)}>
                      <span className="row" style={{ gap: '.5rem' }}><Icon name="wallet" size={17} /> {PAYMENT_LABEL[key]}</span>
                    </button>
                  ))}
                </div>
                {payment === 'pix' && <p className="text-sm soft">Chave Pix: <strong>{settings.pixKey}</strong>. O pagamento é confirmado pelo WhatsApp.</p>}
              </div>

              <div className="field">
                <label htmlFor="ck-obs">Observações do pedido</label>
                <textarea id="ck-obs" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma preferência, restrição alimentar ou recado para a confeitaria?" />
              </div>

              <button type="button" className="btn btn--primary btn--lg" onClick={goToReview}>
                Revisar pedido <Icon name="chevronRight" size={17} />
              </button>
            </>
          ) : (
            <>
              <div className="row-between">
                <h3>Confira todos os detalhes</h3>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStep(1)}>
                  <Icon name="edit" size={14} /> Editar dados
                </button>
              </div>

              <div className="review-block">
                <h4>Produtos</h4>
                {cart.items.map((item) => (
                  <div key={item.id} className="stack" style={{ gap: '.15rem', paddingBottom: '.5rem', borderBottom: '1px dashed var(--line)' }}>
                    <div className="review-line">
                      <span><strong>{item.quantity}x</strong> {item.name}</span>
                      <strong>{formatMoney(item.unitPrice * item.quantity)}</strong>
                    </div>
                    {item.selections.length > 0 && (
                      <span className="text-xs muted">{item.selections.map((s) => `${s.groupLabel}: ${s.optionLabel}`).join(' • ')}</span>
                    )}
                    {item.notes && <span className="text-xs muted">Obs.: {item.notes}</span>}
                  </div>
                ))}
                <div className="review-line"><span>Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
                <div className="review-line"><span>Taxa de entrega</span><span>{deliveryFee > 0 ? formatMoney(deliveryFee) : 'Grátis'}</span></div>
                <div className="review-line" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--choc-700)' }}>
                  <span>Total</span><span>{formatMoney(total)}</span>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-item"><span>Cliente</span><strong>{name}</strong></div>
                <div className="detail-item"><span>WhatsApp</span><strong>{phone}</strong></div>
                <div className="detail-item"><span>Tipo de recebimento</span><strong>{fulfillment === 'entrega' ? 'Entrega' : 'Retirada na loja'}</strong></div>
                <div className="detail-item"><span>Endereço</span><strong>{fulfillment === 'entrega' ? address : settings.address}</strong></div>
                <div className="detail-item"><span>Data</span><strong>{formatDateLong(date)}</strong></div>
                <div className="detail-item"><span>Horário</span><strong>{time}</strong></div>
                <div className="detail-item"><span>Forma de pagamento</span><strong>{PAYMENT_LABEL[payment]}</strong></div>
                <div className="detail-item"><span>Observações</span><strong>{notes.trim() || 'Nenhuma'}</strong></div>
              </div>

              <div className="row" style={{ gap: '.7rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>Voltar</button>
                <button type="button" className="btn btn--primary btn--lg" onClick={confirmOrder} disabled={submitting} style={{ flex: 1 }}>
                  <Icon name="check" size={18} /> {submitting ? 'Enviando pedido...' : 'Confirmar pedido'}
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="panel summary">
          <h3>Resumo do pedido</h3>
          {cart.items.map((item) => (
            <div className="summary__line" key={item.id}>
              <span>{item.quantity}x {item.name}</span>
              <span>{formatMoney(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
          <div className="summary__line"><span>Subtotal</span><span>{formatMoney(cart.subtotal)}</span></div>
          <div className="summary__line"><span>Taxa de entrega</span><span>{deliveryFee > 0 ? formatMoney(deliveryFee) : 'Grátis'}</span></div>
          <div className="summary__total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
          <p className="text-xs muted">
            {fulfillment === 'entrega' ? 'Entrega' : 'Retirada'} em {formatDateLong(date)} às {time}.
          </p>
        </aside>
      </div>
    </div>
  );
}
