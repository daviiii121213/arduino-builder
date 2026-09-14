import type { Order } from '../types';
import { STATUS_FLOW, STATUS_META } from '../lib/status';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const STEP_ICON: Record<string, IconName> = {
  novo: 'receipt',
  confirmado: 'check',
  producao: 'cake',
  pronto: 'bag',
  entregue: 'truck',
};

const STEP_LABEL: Record<string, string> = {
  novo: 'Pedido recebido',
  confirmado: 'Confirmado',
  producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
};

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelado') {
    const at = order.history.find((h) => h.status === 'cancelado')?.at;
    return (
      <div className="timeline--cancelled">
        <Icon name="close" size={15} /> Pedido cancelado{at ? ` em ${new Date(at).toLocaleDateString('pt-BR')}` : ''}.
        {' '}Fale com a confeitaria se precisar de ajuda.
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="timeline">
      {STATUS_FLOW.map((status, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <div key={status} className={`timeline__step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
            <span className="timeline__dot">
              <Icon name={done ? 'check' : STEP_ICON[status]} size={15} />
            </span>
            <span className="timeline__label">
              {STEP_LABEL[status]}
              {current && <span style={{ display: 'block', color: STATUS_META[status].color }}>agora</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
