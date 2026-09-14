import { useRef, useState } from 'react';
import type { PaymentMethod, Settings } from '../../types';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useStore } from '../../store/store';
import { DEFAULT_SETTINGS } from '../../data/seed';
import { PAYMENT_LABEL } from '../../lib/status';
import { maskPhone, parseMoneyInput } from '../../lib/format';

export function SettingsAdmin() {
  const { settings, updateSettings, resetDatabase, products, orders, customers } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Settings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);

  const patch = (changes: Partial<Settings>) => setForm((prev) => ({ ...prev, ...changes }));

  const save = () => {
    if (form.storeName.trim().length < 2) { toast.error('Nome inválido', 'Informe o nome da confeitaria.'); return; }
    if (!Object.values(form.payments).some(Boolean)) { toast.error('Formas de pagamento', 'Mantenha ao menos uma forma de pagamento ativa.'); return; }
    updateSettings({ ...form, storeName: form.storeName.trim() });
    toast.success('Configurações salvas', 'As mudanças já valem para a loja e para o painel.');
  };

  const uploadLogo = (file: File) => {
    if (file.size > 800 * 1024) { toast.error('Imagem muito grande', 'Escolha um arquivo de até 800 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => patch({ logo: String(reader.result) });
    reader.onerror = () => toast.error('Falha ao carregar a logo');
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className="settings-grid">
        <section className="block">
          <div className="block__head"><div><h3>Identidade da confeitaria</h3><p>Exibida na loja e nos pedidos</p></div></div>
          <div className="block__body stack">
            <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
              <span className="logo-preview">{form.logo ? <img src={form.logo} alt="Logo" /> : <Icon name="cake" size={30} />}</span>
              <div className="stack" style={{ gap: '.4rem' }}>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.target.value = ''; }} />
                <button type="button" className="btn btn--soft btn--sm" onClick={() => fileRef.current?.click()}><Icon name="image" size={15} /> Enviar logo</button>
                {form.logo && <button type="button" className="btn btn--ghost btn--xs" onClick={() => patch({ logo: '' })}>Remover logo</button>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="st-nome">Nome da confeitaria</label>
              <input id="st-nome" className="input" value={form.storeName} onChange={(e) => patch({ storeName: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="st-slogan">Slogan</label>
              <input id="st-slogan" className="input" value={form.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="st-wpp">WhatsApp</label>
                <input id="st-wpp" className="input" value={form.whatsapp} onChange={(e) => patch({ whatsapp: maskPhone(e.target.value) })} inputMode="tel" />
              </div>
              <div className="field">
                <label htmlFor="st-fone">Telefone fixo</label>
                <input id="st-fone" className="input" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="st-end">Endereço</label>
              <input id="st-end" className="input" value={form.address} onChange={(e) => patch({ address: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="st-hor">Horário de funcionamento</label>
              <input id="st-hor" className="input" value={form.hours} onChange={(e) => patch({ hours: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block__head"><div><h3>Vendas e entrega</h3><p>Regras aplicadas no fechamento do pedido</p></div></div>
          <div className="block__body stack">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="st-taxa">Taxa de entrega</label>
                <input id="st-taxa" className="input" value={String(form.deliveryFee).replace('.', ',')} onChange={(e) => patch({ deliveryFee: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor="st-frete">Frete grátis a partir de</label>
                <input id="st-frete" className="input" value={String(form.freeDeliveryFrom).replace('.', ',')} onChange={(e) => patch({ freeDeliveryFrom: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor="st-min">Pedido mínimo</label>
                <input id="st-min" className="input" value={String(form.minOrder).replace('.', ',')} onChange={(e) => patch({ minOrder: parseMoneyInput(e.target.value) })} inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor="st-pix">Chave Pix</label>
                <input id="st-pix" className="input" value={form.pixKey} onChange={(e) => patch({ pixKey: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <span className="field-label">Formas de pagamento aceitas</span>
              <div className="row" style={{ gap: '1.2rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((method) => (
                  <label className="switch" key={method}>
                    <input type="checkbox" checked={form.payments[method]} onChange={(e) => patch({ payments: { ...form.payments, [method]: e.target.checked } })} />
                    <span className="switch__track" /> {PAYMENT_LABEL[method]}
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Cores do sistema</span>
              <div className="row" style={{ gap: '1.2rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                <span className="color-input">
                  <input type="color" value={form.primaryColor} onChange={(e) => patch({ primaryColor: e.target.value })} aria-label="Cor principal" />
                  <span className="text-sm">Cor principal</span>
                </span>
                <span className="color-input">
                  <input type="color" value={form.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} aria-label="Cor de destaque" />
                  <span className="text-sm">Cor de destaque</span>
                </span>
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => patch({ primaryColor: DEFAULT_SETTINGS.primaryColor, accentColor: DEFAULT_SETTINGS.accentColor })}>
                  Restaurar cores padrão
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="block">
        <div className="block__head">
          <div><h3>Dados do sistema</h3><p>Informações salvas neste navegador</p></div>
          <button type="button" className="btn btn--outline-danger btn--sm" onClick={() => setConfirmReset(true)}>
            <Icon name="alert" size={15} /> Restaurar dados de demonstração
          </button>
        </div>
        <div className="block__body">
          <div className="row" style={{ gap: '1.6rem', flexWrap: 'wrap' }}>
            <span className="text-sm muted"><strong>{products.length}</strong> produtos</span>
            <span className="text-sm muted"><strong>{orders.length}</strong> pedidos</span>
            <span className="text-sm muted"><strong>{customers.length}</strong> clientes</span>
          </div>
          <p className="text-xs muted" style={{ marginTop: '.8rem' }}>
            Os dados ficam salvos localmente no navegador e continuam disponíveis após atualizar a página.
            A camada de persistência é isolada, permitindo migrar para um servidor e banco de dados reais no futuro.
          </p>
        </div>
      </section>

      <div className="row" style={{ justifyContent: 'flex-end', gap: '.6rem' }}>
        <button type="button" className="btn btn--ghost" onClick={() => setForm(settings)}>Descartar alterações</button>
        <button type="button" className="btn btn--primary" onClick={save}><Icon name="check" size={16} /> Salvar configurações</button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Restaurar dados de demonstração?"
        message="Todos os produtos, pedidos, clientes, estoque e lançamentos atuais serão substituídos pelos dados iniciais. Esta ação não pode ser desfeita."
        confirmLabel="Restaurar tudo"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDatabase();
          setForm(DEFAULT_SETTINGS);
          setConfirmReset(false);
          toast.success('Dados restaurados', 'O sistema voltou ao estado inicial de demonstração.');
        }}
      />
    </>
  );
}
