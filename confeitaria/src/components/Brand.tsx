import { Icon } from './Icon';
import type { Settings } from '../types';

export function Brand({ settings, compact }: { settings: Settings; compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand__mark">
        {settings.logo ? <img src={settings.logo} alt={settings.storeName} /> : <Icon name="cake" size={24} />}
      </span>
      <span>
        <span className="brand__name">{settings.storeName}</span>
        {!compact && <span className="brand__tag">{settings.tagline}</span>}
      </span>
    </span>
  );
}
