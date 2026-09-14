import type { Database } from '../types';
import { buildSeedDatabase, DEFAULT_SETTINGS, SEED_PRODUCTS } from '../data/seed';
import { buildDemoData } from '../data/demo';

/**
 * Camada de persistência.
 *
 * Toda a aplicação fala apenas com a interface `StorageDriver`, que é assíncrona
 * de propósito: trocar o `LocalStorageDriver` por um driver HTTP (API + banco de
 * dados real) no futuro não exige mudança nas telas nem no estado global.
 */

export const DB_VERSION = 1;
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
  return {
    ...base,
    ...data,
    version: DB_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}), payments: { ...DEFAULT_SETTINGS.payments, ...(data.settings?.payments ?? {}) } },
    session: { customerId: data.session?.customerId ?? null },
    products: (data.products ?? []).map((p) => ({ ...p, optionGroups: p.optionGroups ?? [] })),
    orders: data.orders ?? [],
    customers: data.customers ?? [],
    ingredients: data.ingredients ?? [],
    stockMoves: data.stockMoves ?? [],
    expenses: data.expenses ?? [],
    counter: typeof data.counter === 'number' ? data.counter : base.counter,
  };
}

/** Banco inicial com catálogo + histórico de demonstração. */
export function createInitialDatabase(): Database {
  const base = buildSeedDatabase(DB_VERSION);
  const demo = buildDemoData(SEED_PRODUCTS, base.settings.deliveryFee, base.counter);
  return {
    ...base,
    customers: demo.customers,
    orders: demo.orders,
    expenses: demo.expenses,
    stockMoves: demo.stockMoves,
    counter: demo.counter,
  };
}

export const storage: StorageDriver = new LocalStorageDriver();

export async function bootstrapDatabase(driver: StorageDriver = storage): Promise<Database> {
  const saved = await driver.load();
  if (saved) return saved;
  const fresh = createInitialDatabase();
  await driver.save(fresh);
  return fresh;
}
