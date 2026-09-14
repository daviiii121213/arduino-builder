import { useMemo } from 'react';
import { useStore } from '../../store/store';
import { addDays, monthKey, toISODate, todayISO } from '../../lib/format';
import type { Order, PaymentMethod } from '../../types';

const isRevenue = (order: Order) => order.status !== 'cancelado';
/** Consideramos faturado o pedido entregue; os demais entram como previsão. */
const isPaid = (order: Order) => order.status === 'entregue';

export function useAnalytics() {
  const { orders, products, ingredients, expenses, customers } = useStore();

  return useMemo(() => {
    const today = todayISO();
    const currentMonth = monthKey(today);

    const paid = orders.filter(isPaid);
    const active = orders.filter(isRevenue);

    const revenueToday = paid.filter((o) => o.updatedAt.slice(0, 10) === today).reduce((s, o) => s + o.total, 0);
    const ordersToday = orders.filter((o) => o.createdAt.slice(0, 10) === today).length;
    const revenueMonth = paid.filter((o) => monthKey(o.updatedAt.slice(0, 10)) === currentMonth).reduce((s, o) => s + o.total, 0);
    const forecastMonth = active.filter((o) => monthKey(o.date) === currentMonth).reduce((s, o) => s + o.total, 0);

    const lastMonthKey = monthKey(toISODate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
    const revenueLastMonth = paid.filter((o) => monthKey(o.updatedAt.slice(0, 10)) === lastMonthKey).reduce((s, o) => s + o.total, 0);
    const monthGrowth = revenueLastMonth > 0 ? ((revenueMonth - revenueLastMonth) / revenueLastMonth) * 100 : null;

    const counts = {
      novo: orders.filter((o) => o.status === 'novo').length,
      confirmado: orders.filter((o) => o.status === 'confirmado').length,
      producao: orders.filter((o) => o.status === 'producao').length,
      pronto: orders.filter((o) => o.status === 'pronto').length,
      entregue: orders.filter((o) => o.status === 'entregue').length,
      cancelado: orders.filter((o) => o.status === 'cancelado').length,
    };

    const upcoming = active
      .filter((o) => o.status !== 'entregue' && o.date >= today)
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
      .slice(0, 6);

    const soldMap = new Map<string, { quantity: number; revenue: number }>();
    active.forEach((order) => {
      order.items.forEach((item) => {
        const entry = soldMap.get(item.productId) ?? { quantity: 0, revenue: 0 };
        entry.quantity += item.quantity;
        entry.revenue += item.unitPrice * item.quantity;
        soldMap.set(item.productId, entry);
      });
    });

    const topProducts = [...soldMap.entries()]
      .map(([productId, stats]) => ({ product: products.find((p) => p.id === productId), ...stats }))
      .filter((entry) => entry.product)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const lowStock = ingredients.filter((i) => i.quantity <= i.minQuantity);

    const revenueByDay = Array.from({ length: 14 }, (_, index) => {
      const day = addDays(today, index - 13);
      const value = paid.filter((o) => o.updatedAt.slice(0, 10) === day).reduce((s, o) => s + o.total, 0);
      const ordersOfDay = orders.filter((o) => o.createdAt.slice(0, 10) === day).length;
      return { day, label: day.slice(8, 10) + '/' + day.slice(5, 7), value, orders: ordersOfDay };
    });

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - index), 1);
      const key = monthKey(toISODate(date));
      const value = paid.filter((o) => monthKey(o.updatedAt.slice(0, 10)) === key).reduce((s, o) => s + o.total, 0);
      const expense = expenses.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + e.amount, 0);
      return { key, label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value, expense };
    });

    const paymentSplit = (['pix', 'dinheiro', 'cartao'] as PaymentMethod[]).map((method) => ({
      method,
      total: active.filter((o) => o.payment === method).reduce((s, o) => s + o.total, 0),
      count: active.filter((o) => o.payment === method).length,
    }));

    const categorySplit = Object.entries(
      active.reduce<Record<string, number>>((acc, order) => {
        order.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          const key = product?.category ?? 'outros';
          acc[key] = (acc[key] ?? 0) + item.unitPrice * item.quantity;
        });
        return acc;
      }, {}),
    ).map(([category, total]) => ({ category, total }));

    const totalRevenue = paid.reduce((s, o) => s + o.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const averageTicket = active.length ? active.reduce((s, o) => s + o.total, 0) / active.length : 0;

    return {
      today,
      revenueToday,
      ordersToday,
      revenueMonth,
      forecastMonth,
      monthGrowth,
      counts,
      upcoming,
      topProducts,
      lowStock,
      revenueByDay,
      revenueByMonth,
      paymentSplit,
      categorySplit,
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      averageTicket,
      customersCount: customers.length,
      ordersCount: orders.length,
    };
  }, [orders, products, ingredients, expenses, customers]);
}
