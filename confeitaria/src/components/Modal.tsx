import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'showcase';
}

export function Modal({ open, title, subtitle, onClose, children, footer, size = 'md', variant = 'default' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal--${size} ${variant === 'showcase' ? 'modal--showcase' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
          <Icon name="close" size={18} />
        </button>
        {title && (
          <header className="modal__header">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  );
}
