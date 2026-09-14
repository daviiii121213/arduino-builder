import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem } from '../types';

const CART_KEY = 'doce-encanto:cart';

interface CartValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  updateNotes: (id: string, notes: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Não foi possível salvar o carrinho:', error);
    }
  }, [items]);

  const signature = (item: Pick<CartItem, 'productId' | 'selections' | 'notes'>) =>
    `${item.productId}|${item.selections.map((s) => s.optionId).sort().join(',')}|${item.notes.trim().toLowerCase()}`;

  const addItem = useCallback<CartValue['addItem']>((item) => {
    setItems((prev) => {
      const key = signature(item);
      const index = prev.findIndex((existing) => signature(existing) === key);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], quantity: next[index].quantity + item.quantity };
        return next;
      }
      return [...prev, { ...item, id: `cart_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }];
    });
  }, []);

  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.flatMap((item) => {
        if (item.id !== id) return [item];
        const next = Math.max(0, Math.min(99, quantity));
        return next === 0 ? [] : [{ ...item, quantity: next }];
      }),
    );
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, notes } : item)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem,
    removeItem,
    setQuantity,
    updateNotes,
    clear,
  }), [items, addItem, removeItem, setQuantity, updateNotes, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart precisa estar dentro de CartProvider');
  return ctx;
}
