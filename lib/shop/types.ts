export type Money = { amount: string; currencyCode: string };
export type ProductImage = { url: string; altText: string | null; width?: number; height?: number };
export type Variant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  selectedOptions: { name: string; value: string }[];
  image: ProductImage | null;
};
export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  availableForSale: boolean;
  requiresSellingPlan: boolean;
  featuredImage: ProductImage | null;
  images: { nodes: ProductImage[] };
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  options: { name: string; values: string[] }[];
  variants: { nodes: Variant[]; pageInfo: PageInfo };
  metafields: ({ key: string; value: string } | null)[];
  seo: { title: string | null; description: string | null };
};
export type PageInfo = { hasNextPage: boolean; endCursor: string | null };
export type CartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money };
  merchandise: Variant & { product: { title: string; handle: string } };
};
export type ShopCart = {
  confirmationUrl?: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: { subtotalAmount: Money; totalAmount: Money };
};
export type CartResponse = { cart: ShopCart | null; enabled: boolean; warning?: string; error?: string };
