import type { Database } from '../types';
import { buildSeedDatabase, DEFAULT_SETTINGS } from '../data/seed';

/**
 * Camada de persistência.
 *
 * Toda a aplicação fala apenas com a interface `StorageDriver`, que é assíncrona
 * de propósito: trocar o `LocalStorageDriver` por um driver HTTP (API + banco de
 * dados real) no futuro não exige mudança nas telas nem no estado global.
 */

export const DB_VERSION = 2;

/** Identificadores do histórico fictício usado nas versões anteriores. */
const LEGACY_DEMO_PREFIXES = ['ped-demo-', 'desp-', 'mov-', 'demo-item-'];
const LEGACY_DEMO_CUSTOMERS = ['cli-ana', 'cli-carlos', 'cli-juliana', 'cli-marcos'];

const isLegacyDemo = (id: string): boolean => LEGACY_DEMO_PREFIXES.some((prefix) => id.startsWith(prefix));
export const STORAGE_KEY = 'doce-encanto:db';

export interface StorageDriver {
  load(): Promise<Database | null>;
  save(data: Database): Promise<void>;
  clear(): Promise<void>;
  /** Notifica quando outra aba alterar os dados. */
  subscribe(listener: (data: Database) => void): () => void;
}

export class LocalStorageDriver implements StorageDriver {
  private readonly key: string;

  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  async load(): Promise<Database | null> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Database;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) return null;
      return migrate(parsed);
    } catch (error) {
      console.error('Falha ao ler os dados salvos:', error);
      return null;
    }
  }

  async save(data: Database): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.error('Falha ao salvar os dados:', error);
      throw new Error('Não foi possível salvar os dados neste navegador.');
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  subscribe(listener: (data: Database) => void): () => void {
    const handler = (event: StorageEvent) => {
      if (event.key !== this.key || !event.newValue) return;
      try {
        listener(migrate(JSON.parse(event.newValue) as Database));
      } catch {
        /* ignora payload inválido vindo de outra aba */
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

function migrate(data: Database): Database {
  const base = buildSeedDatabase(DB_VERSION);
  const previousVersion = typeof data.version === 'number' ? data.version : 1;
  /** A partir da versão 2 o sistema começa sem pedidos: limpamos o histórico fictício antigo. */
  const clean = previousVersion < 2;
  const orders = (data.orders ?? []).filter((order) => !clean || !isLegacyDemo(order.id));
  const customers = (data.customers ?? []).filter(
    (customer) => !clean || !LEGACY_DEMO_CUSTOMERS.includes(customer.id) || orders.some((order) => order.customerId === customer.id),
  );
  const expenses = (data.expenses ?? []).filter((expense) => !clean || !isLegacyDemo(expense.id));
  const stockMoves = (data.stockMoves ?? []).filter((move) => !clean || !isLegacyDemo(move.id));

  return {
    ...base,
    ...data,
    version: DB_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}), payments: { ...DEFAULT_SETTINGS.payments, ...(data.settings?.payments ?? {}) } },
    session: { customerId: data.session?.customerId ?? null },
    products: (data.products ?? []).map((p) => ({ ...p, optionGroups: p.optionGroups ?? [], stock: p.stock ?? null })),
    orders,
    customers,
    ingredients: data.ingredients ?? [],
    stockMoves,
    expenses,
    counter: typeof data.counter === 'number' ? data.counter : base.counter,
  };
}

/** Banco inicial: catálogo pronto para vender, sem nenhum pedido lançado. */
export function createInitialDatabase(): Database {
  return buildSeedDatabase(DB_VERSION);
}

export const storage: StorageDriver = new LocalStorageDriver();

export async function bootstrapDatabase(driver: StorageDriver = storage): Promise<Database> {
  const saved = await driver.load();
  if (saved) return saved;
  const fresh = createInitialDatabase();
  await driver.save(fresh);
  return fresh;
}
