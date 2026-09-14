import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CartItem, Customer, Database, Expense, Ingredient, Order, OrderStatus, Product, Settings, StockMove,
} from '../types';
import { bootstrapDatabase, createInitialDatabase, storage } from '../lib/db';
import { uid } from '../lib/id';
import { onlyDigits } from '../lib/format';

export interface NewOrderInput {
  customerName: string;
  customerPhone: string;
  address: string;
  fulfillment: 'entrega' | 'retirada';
  payment: 'pix' | 'dinheiro' | 'cartao';
  date: string;
  time: string;
  notes: string;
  items: CartItem[];
  deliveryFee: number;
}

interface StoreValue {
  ready: boolean;
  data: Database;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  ingredients: Ingredient[];
  stockMoves: StockMove[];
  expenses: Expense[];
  settings: Settings;
  currentCustomer: Customer | null;
  // produtos
  saveProduct: (product: Product) => void;
  createProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  deleteProduct: (id: string) => void;
  toggleProductAvailability: (id: string) => void;
  // pedidos
  createOrder: (input: NewOrderInput) => Order;
  setOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  // clientes
  identifyCustomer: (name: string, phone: string) => Customer;
  updateCustomer: (customer: Customer) => void;
  signOut: () => void;
  // estoque
  saveIngredient: (ingredient: Ingredient) => void;
  createIngredient: (ingredient: Omit<Ingredient, 'id' | 'updatedAt'>) => void;
  deleteIngredient: (id: string) => void;
  registerStockMove: (input: { ingredientId: string; type: 'entrada' | 'saida'; quantity: number; reason: string }) => void;
  // financeiro
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
  // configurações
  updateSettings: (settings: Settings) => void;
  resetDatabase: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Database>(() => createInitialDatabase());
  const [ready, setReady] = useState(false);
  const skipPersist = useRef(true);

  useEffect(() => {
    let alive = true;
    bootstrapDatabase().then((loaded) => {
      if (!alive) return;
      skipPersist.current = true;
      setData(loaded);
      setReady(true);
    });
    const unsubscribe = storage.subscribe((incoming) => {
      skipPersist.current = true;
      setData(incoming);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    storage.save(data).catch((error) => console.error(error));
  }, [data, ready]);

  const update = useCallback((updater: (prev: Database) => Database) => {
    setData((prev) => updater(prev));
  }, []);

  const createProduct = useCallback<StoreValue['createProduct']>((input) => {
    const nowIso = new Date().toISOString();
    const product: Product = { ...input, id: uid('prod'), createdAt: nowIso, updatedAt: nowIso };
    update((prev) => ({ ...prev, products: [product, ...prev.products] }));
    return product;
  }, [update]);

  const saveProduct = useCallback<StoreValue['saveProduct']>((product) => {
    update((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === product.id ? { ...product, updatedAt: new Date().toISOString() } : p)),
    }));
  }, [update]);

  const deleteProduct = useCallback((id: string) => {
    update((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
  }, [update]);

  const toggleProductAvailability = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === id ? { ...p, available: !p.available, updatedAt: new Date().toISOString() } : p)),
    }));
  }, [update]);

  const identifyCustomer = useCallback<StoreValue['identifyCustomer']>((name, phone) => {
    const digits = onlyDigits(phone);
    let result: Customer | null = null;
    setData((prev) => {
      const existing = prev.customers.find((c) => onlyDigits(c.phone) === digits);
      if (existing) {
        const updated: Customer = { ...existing, name: name.trim() || existing.name, phone };
        result = updated;
        return {
          ...prev,
          customers: prev.customers.map((c) => (c.id === existing.id ? updated : c)),
          session: { customerId: updated.id },
        };
      }
      const created: Customer = { id: uid('cli'), name: name.trim(), phone, addresses: [], notes: '', createdAt: new Date().toISOString() };
      result = created;
      return { ...prev, customers: [created, ...prev.customers], session: { customerId: created.id } };
    });
    return result ?? { id: uid('cli'), name, phone, addresses: [], notes: '', createdAt: new Date().toISOString() };
  }, []);

  const updateCustomer = useCallback<StoreValue['updateCustomer']>((customer) => {
    update((prev) => ({ ...prev, customers: prev.customers.map((c) => (c.id === customer.id ? customer : c)) }));
  }, [update]);

  const signOut = useCallback(() => {
    update((prev) => ({ ...prev, session: { customerId: null } }));
  }, [update]);

  const createOrder = useCallback<StoreValue['createOrder']>((input) => {
    const nowIso = new Date().toISOString();
    const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const deliveryFee = input.fulfillment === 'entrega' ? input.deliveryFee : 0;
    let created: Order | null = null;

    setData((prev) => {
      const digits = onlyDigits(input.customerPhone);
      let customers = prev.customers;
      let customer = customers.find((c) => onlyDigits(c.phone) === digits);
      if (!customer) {
        customer = { id: uid('cli'), name: input.customerName, phone: input.customerPhone, addresses: [], notes: '', createdAt: nowIso };
        customers = [customer, ...customers];
      } else {
        customer = { ...customer, name: input.customerName || customer.name, phone: input.customerPhone };
        customers = customers.map((c) => (c.id === customer!.id ? customer! : c));
      }
      if (input.fulfillment === 'entrega' && input.address.trim()) {
        const known = customer.addresses.some((a) => a.value.trim().toLowerCase() === input.address.trim().toLowerCase());
        if (!known) {
          customer = { ...customer, addresses: [...customer.addresses, { id: uid('end'), label: 'Endereço', value: input.address.trim() }] };
          customers = customers.map((c) => (c.id === customer!.id ? customer! : c));
        }
      }

      const counter = prev.counter + 1;
      const order: Order = {
        id: uid('ped'),
        code: `#${counter}`,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        address: input.fulfillment === 'entrega' ? input.address.trim() : '',
        fulfillment: input.fulfillment,
        payment: input.payment,
        date: input.date,
        time: input.time,
        notes: input.notes.trim(),
        items: input.items,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        status: 'novo',
        history: [{ status: 'novo', at: nowIso }],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      created = order;
      return { ...prev, counter, customers, orders: [order, ...prev.orders], session: { customerId: customer.id } };
    });

    return created!;
  }, []);

  const setOrderStatus = useCallback<StoreValue['setOrderStatus']>((id, status, note) => {
    update((prev) => ({
      ...prev,
      orders: prev.orders.map((order) => {
        if (order.id !== id || order.status === status) return order;
        const at = new Date().toISOString();
        return { ...order, status, updatedAt: at, history: [...order.history, { status, at, note }] };
      }),
    }));
  }, [update]);

  const createIngredient = useCallback<StoreValue['createIngredient']>((input) => {
    update((prev) => ({
      ...prev,
      ingredients: [{ ...input, id: uid('ing'), updatedAt: new Date().toISOString() }, ...prev.ingredients],
    }));
  }, [update]);

  const saveIngredient = useCallback<StoreValue['saveIngredient']>((ingredient) => {
    update((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => (i.id === ingredient.id ? { ...ingredient, updatedAt: new Date().toISOString() } : i)),
    }));
  }, [update]);

  const deleteIngredient = useCallback((id: string) => {
    update((prev) => ({ ...prev, ingredients: prev.ingredients.filter((i) => i.id !== id) }));
  }, [update]);

  const registerStockMove = useCallback<StoreValue['registerStockMove']>(({ ingredientId, type, quantity, reason }) => {
    update((prev) => {
      const ingredient = prev.ingredients.find((i) => i.id === ingredientId);
      if (!ingredient) return prev;
      const delta = type === 'entrada' ? quantity : -quantity;
      const nextQuantity = Math.max(0, Number((ingredient.quantity + delta).toFixed(3)));
      const move: StockMove = {
        id: uid('mov'),
        ingredientId,
        ingredientName: ingredient.name,
        type,
        quantity,
        unit: ingredient.unit,
        reason: reason.trim() || (type === 'entrada' ? 'Entrada manual' : 'Saída manual'),
        at: new Date().toISOString(),
      };
      return {
        ...prev,
        ingredients: prev.ingredients.map((i) => (i.id === ingredientId ? { ...i, quantity: nextQuantity, updatedAt: move.at } : i)),
        stockMoves: [move, ...prev.stockMoves],
      };
    });
  }, [update]);

  const addExpense = useCallback<StoreValue['addExpense']>((expense) => {
    update((prev) => ({ ...prev, expenses: [{ ...expense, id: uid('desp'), createdAt: new Date().toISOString() }, ...prev.expenses] }));
  }, [update]);

  const deleteExpense = useCallback((id: string) => {
    update((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) }));
  }, [update]);

  const updateSettings = useCallback<StoreValue['updateSettings']>((settings) => {
    update((prev) => ({ ...prev, settings }));
  }, [update]);

  const resetDatabase = useCallback(() => {
    setData(createInitialDatabase());
    skipPersist.current = false;
  }, []);

  const currentCustomer = useMemo(
    () => data.customers.find((c) => c.id === data.session.customerId) ?? null,
    [data.customers, data.session.customerId],
  );

  const value = useMemo<StoreValue>(() => ({
    ready,
    data,
    products: data.products,
    orders: data.orders,
    customers: data.customers,
    ingredients: data.ingredients,
    stockMoves: data.stockMoves,
    expenses: data.expenses,
    settings: data.settings,
    currentCustomer,
    saveProduct,
    createProduct,
    deleteProduct,
    toggleProductAvailability,
    createOrder,
    setOrderStatus,
    identifyCustomer,
    updateCustomer,
    signOut,
    saveIngredient,
    createIngredient,
    deleteIngredient,
    registerStockMove,
    addExpense,
    deleteExpense,
    updateSettings,
    resetDatabase,
  }), [
    ready, data, currentCustomer, saveProduct, createProduct, deleteProduct, toggleProductAvailability,
    createOrder, setOrderStatus, identifyCustomer, updateCustomer, signOut, saveIngredient, createIngredient,
    deleteIngredient, registerStockMove, addExpense, deleteExpense, updateSettings, resetDatabase,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore precisa estar dentro de StoreProvider');
  return ctx;
}
