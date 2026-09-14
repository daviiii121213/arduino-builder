export type CategoryId =
  | 'bolos' | 'doces' | 'cupcakes' | 'tortas'
  | 'kits' | 'salgados' | 'bebidas' | 'personalizados';

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  art: string;
}

export interface ProductOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface OptionGroup {
  id: string;
  label: string;
  type: 'single' | 'multi';
  required: boolean;
  options: ProductOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  details: string;
  price: number;
  category: CategoryId;
  art: string;
  image?: string;
  available: boolean;
  featured: boolean;
  bestSeller: boolean;
  promoPrice?: number | null;
  unitLabel: string;
  prepDays: number;
  stock: number | null;
  optionGroups: OptionGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface CartSelection {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  priceDelta: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  art: string;
  image?: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  selections: CartSelection[];
  notes: string;
}

export type OrderStatus =
  | 'novo' | 'confirmado' | 'producao' | 'pronto' | 'entregue' | 'cancelado';

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  note?: string;
}

export type Fulfillment = 'entrega' | 'retirada';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';

export interface Order {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  fulfillment: Fulfillment;
  payment: PaymentMethod;
  date: string;
  time: string;
  notes: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  history: OrderEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  value: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  addresses: CustomerAddress[];
  notes: string;
  createdAt: string;
}

export type StockUnit = 'kg' | 'g' | 'L' | 'ml' | 'un' | 'cx' | 'pct';

export interface Ingredient {
  id: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  minQuantity: number;
  cost: number;
  updatedAt: string;
}

export interface StockMove {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: 'entrada' | 'saida';
  quantity: number;
  unit: StockUnit;
  reason: string;
  at: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
}

export interface Settings {
  storeName: string;
  tagline: string;
  logo: string;
  whatsapp: string;
  phone: string;
  address: string;
  hours: string;
  deliveryFee: number;
  freeDeliveryFrom: number;
  minOrder: number;
  pixKey: string;
  payments: Record<PaymentMethod, boolean>;
  primaryColor: string;
  accentColor: string;
}

export interface Session {
  customerId: string | null;
}

export interface Database {
  version: number;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  ingredients: Ingredient[];
  stockMoves: StockMove[];
  expenses: Expense[];
  settings: Settings;
  session: Session;
  counter: number;
}
