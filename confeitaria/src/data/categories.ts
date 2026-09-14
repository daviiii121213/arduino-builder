import type { Category } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'bolos', name: 'Bolos', description: 'Bolos artesanais para todas as ocasiões', art: 'bolo-chocolate' },
  { id: 'doces', name: 'Doces', description: 'Brigadeiros, beijinhos e docinhos gourmet', art: 'brigadeiro' },
  { id: 'cupcakes', name: 'Cupcakes', description: 'Pequenos, fofinhos e irresistíveis', art: 'cupcake-chocolate' },
  { id: 'tortas', name: 'Tortas', description: 'Tortas cremosas com massa amanteigada', art: 'torta-morango' },
  { id: 'kits', name: 'Kits Festa', description: 'Tudo pronto para a sua comemoração', art: 'kit-festa' },
  { id: 'salgados', name: 'Salgados', description: 'Salgadinhos fritos e assados na hora', art: 'salgados' },
  { id: 'bebidas', name: 'Bebidas', description: 'Sucos naturais e refrigerantes gelados', art: 'bebidas' },
  { id: 'personalizados', name: 'Personalizados', description: 'Criamos o doce dos seus sonhos', art: 'personalizados' },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const categoryName = (id: string): string => CATEGORY_MAP[id]?.name ?? 'Outros';
