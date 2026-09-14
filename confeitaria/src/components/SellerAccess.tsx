import { useState } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';

export const SELLER_CODE = '123';

interface Props {
  onUnlock: () => void;
  /** "destaque" no rodapé da tela inicial, "cartao" dentro da Minha conta. */
  variant?: 'destaque' | 'cartao';
}

/** Botão de acesso do vendedor + diálogo do código interno. */
export function SellerAccess({ onUnlock, variant = 'destaque' }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const close = () => {
    setOpen(false);
    setCode('');
    setError('');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('Digite o código de acesso.');
      return;
    }
    if (code.trim() !== SELLER_CODE) {
      setError('Código incorreto. Verifique e tente novamente.');
      toast.error('Acesso negado', 'O código informado não confere.');
      setCode('');
      return;
    }
    close();
    toast.success('Bem-vindo de volta!', 'Painel do Vendedor liberado.');
    onUnlock();
  };

  return (
    <>
      {variant === 'destaque' ? (
        <button type="button" className="btn btn--ghost seller-access" onClick={() => setOpen(true)}>
          <Icon name="lock" size={16} /> Sou vendedor
        </button>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={() => setOpen(true)}>
          <Icon name="lock" size={16} /> Entrar no Painel do Vendedor
        </button>
      )}

      <Modal
        open={open}
        onClose={close}
        size="sm"
        title="Acesso do vendedor"
        subtitle="Informe o código interno para abrir o painel administrativo."
      >
        <form onSubmit={submit} className="stack">
          <div className="field">
            <label htmlFor="codigo-vendedor">Código de acesso</label>
            <input
              id="codigo-vendedor"
              className={`code-input ${error ? 'input--invalid' : ''}`}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="•••"
              aria-invalid={Boolean(error)}
            />
            {error ? <span className="error-text">{error}</span> : <span className="hint">O acesso é anônimo: não pedimos nome, e-mail nem senha.</span>}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: '.6rem' }}>
            <button type="button" className="btn btn--ghost" onClick={close}>Cancelar</button>
            <button type="submit" className="btn btn--primary">Entrar no painel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
