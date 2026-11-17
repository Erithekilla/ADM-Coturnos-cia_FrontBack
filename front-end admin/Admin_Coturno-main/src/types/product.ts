export type ProductStatus = 'Em Estoque' | 'Baixo Estoque' | 'Esgotado';

export interface Product {
  id: string | number;
  name: string;
  category: string;
  model: string;
  color: string;
  price: number;
  cost_price?: number;
  costPrice?: number;
  stock: number;
  status: ProductStatus;
}