// Only public catalog fields cross the server/client boundary. Prices retain V6's GEL units.
export type Product = {
  slug: string; name: string; ka: string; price: number; oldPrice?: number;
  tone: string; categories: string[]; category: string; categoryName: string;
  imageUrl: string; stock: number; sizes: string[]; colors: string[]; description: string;
};
export type Category = { slug: string; name: string; description: string };
export type Catalog = { products: Product[]; categories: Category[] };
