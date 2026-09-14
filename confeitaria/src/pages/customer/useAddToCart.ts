import { useCallback } from 'react';
import type { CartSelection, Product } from '../../types';
import { useCart } from '../../store/cart';
import { useToast } from '../../components/Toast';

export function useAddToCart() {
  const cart = useCart();
  const toast = useToast();

  return useCallback(
    (payload: { product: Product; quantity: number; selections: CartSelection[]; notes: string; unitPrice: number }) => {
      const { product, quantity, selections, notes, unitPrice } = payload;
      if (!product.available) {
        toast.error('Produto indisponível', 'Este item não está disponível para pedido no momento.');
        return false;
      }
      cart.addItem({
        productId: product.id,
        name: product.name,
        art: product.art,
        image: product.image,
        basePrice: product.promoPrice ?? product.price,
        unitPrice,
        quantity,
        selections,
        notes: notes.trim(),
      });
      toast.success('Adicionado ao carrinho', `${quantity}x ${product.name}`);
      return true;
    },
    [cart, toast],
  );
}
