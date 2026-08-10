import type { ImageFallbackKind } from "@/types/media";
import type { MockProduct, ProductSaleUnit } from "@/types/product";

type ProductSeed = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  netPrice: number;
  unitPrice: number;
  saleUnit: ProductSaleUnit;
  imageFallback: ImageFallbackKind;
  badge?: string;
  featured?: boolean;
  bestSeller?: boolean;
  opportunity?: boolean;
  newArrival?: boolean;
};

function product(seed: ProductSeed): MockProduct {
  return {
    ...seed,
    slug: seed.id.replace(/^prod-/, ""),
    description: `${seed.name}.`,
    availability: "available_subject_to_confirmation",
    adminStatus: "active",
    featured: seed.featured ?? false,
    bestSeller: seed.bestSeller ?? false,
    opportunity: seed.opportunity ?? false,
    newArrival: seed.newArrival ?? false,
  };
}

export const HOME_PRODUCTS = [
  product({ id: "prod-albahaca-en-rama", name: "Albahaca en rama", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 1000, unitPrice: 1190, saleUnit: "unit", imageFallback: "herb", featured: true, bestSeller: true }),
  product({ id: "prod-berro-hidroponico", name: "Berro hidropónico", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 9000, unitPrice: 10710, saleUnit: "kg", imageFallback: "herb", featured: true, bestSeller: true }),
  product({ id: "prod-ciboulette-75-gr", name: "Ciboulette 75 gr", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 500, unitPrice: 595, saleUnit: "unit", imageFallback: "herb", bestSeller: true }),
  product({ id: "prod-docena-de-ciboulette", name: "Docena de ciboulette", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 5000, unitPrice: 5950, saleUnit: "dozen", imageFallback: "herb" }),
  product({ id: "prod-flores-comestibles-50-und", name: "Flores comestibles 50 und", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 2500, unitPrice: 2975, saleUnit: "unit", imageFallback: "herb", badge: "Hidropónico", featured: true, bestSeller: true }),
  product({ id: "prod-jengibre", name: "Jengibre", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 4000, unitPrice: 4760, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-lechuga-hidroponica", name: "Lechuga hidropónica", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 700, unitPrice: 833, saleUnit: "unit", imageFallback: "herb", badge: "Hidropónico", featured: true, bestSeller: true }),
  product({ id: "prod-microgreens-50-gr", name: "Microgreens 50 gr (brotes)", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 2500, unitPrice: 2975, saleUnit: "unit", imageFallback: "herb", badge: "Hidropónico", featured: true, bestSeller: true }),
  product({ id: "prod-mix-de-hojas-mizuna-y-mostaza", name: "Mix de hojas (mizuna y mostaza)", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 9000, unitPrice: 10710, saleUnit: "kg", imageFallback: "herb", badge: "Hidropónico" }),
  product({ id: "prod-romero-fresco", name: "Romero fresco", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 1500, unitPrice: 1785, saleUnit: "100g", imageFallback: "herb" }),
  product({ id: "prod-rucula", name: "Rúcula", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 9000, unitPrice: 10710, saleUnit: "kg", imageFallback: "herb", bestSeller: true }),
  product({ id: "prod-tomate-cherry", name: "Tomate cherry", category: "Hidropónicos", subcategory: "Cultivos hidropónicos", netPrice: 2500, unitPrice: 2975, saleUnit: "kg", imageFallback: "fresh-produce", bestSeller: true }),

  product({ id: "prod-aji-verde", name: "Ají verde", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 4000, unitPrice: 4760, saleUnit: "kg", imageFallback: "fresh-produce", opportunity: true }),
  product({ id: "prod-ajo", name: "Ajo", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 250, unitPrice: 298, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-apio", name: "Apio", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1200, unitPrice: 1428, saleUnit: "unit", imageFallback: "fresh-produce", newArrival: true }),
  product({ id: "prod-berenjena", name: "Berenjena", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 600, unitPrice: 714, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-betarraga", name: "Betarraga", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-brocoli", name: "Brócoli", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1200, unitPrice: 1428, saleUnit: "unit", imageFallback: "fresh-produce", opportunity: true }),
  product({ id: "prod-cebolla-blanca", name: "Cebolla blanca", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 800, unitPrice: 952, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-cebolla-morada", name: "Cebolla morada", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-coliflor", name: "Coliflor", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-escarola", name: "Escarola", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1000, unitPrice: 1190, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-espinaca", name: "Espinaca", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 800, unitPrice: 952, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-lechuga-chilena", name: "Lechuga chilena", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1000, unitPrice: 1190, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-papa-camote", name: "Papa camote", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 2500, unitPrice: 2975, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-papa", name: "Papa", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 950, unitPrice: 1131, saleUnit: "kg", imageFallback: "fresh-produce", opportunity: true }),
  product({ id: "prod-pepino-verdura", name: "Pepino verdura", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 500, unitPrice: 595, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-pimenton-amarillo", name: "Pimentón amarillo", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 900, unitPrice: 1071, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-pimenton-rojo-primera", name: "Pimentón rojo 1era", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1000, unitPrice: 1190, saleUnit: "unit", imageFallback: "fresh-produce", opportunity: true }),
  product({ id: "prod-pimenton-verde-primera", name: "Pimentón verde 1era", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 800, unitPrice: 952, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-rabano", name: "Rábano", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 600, unitPrice: 714, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-repollo-morado", name: "Repollo morado", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 2000, unitPrice: 2380, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-repollo-verde", name: "Repollo verde", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 2000, unitPrice: 2380, saleUnit: "unit", imageFallback: "fresh-produce" }),
  product({ id: "prod-tomate-primera", name: "Tomate primera", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1200, unitPrice: 1428, saleUnit: "kg", imageFallback: "fresh-produce", opportunity: true, newArrival: true }),
  product({ id: "prod-zanahoria", name: "Zanahoria", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 1400, unitPrice: 1666, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-zapallo-camote", name: "Zapallo camote", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 2500, unitPrice: 2975, saleUnit: "kg", imageFallback: "fresh-produce" }),
  product({ id: "prod-aji-amarillo", name: "Ají amarillo", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 8000, unitPrice: 9520, saleUnit: "kg", imageFallback: "fresh-produce", newArrival: true }),
  product({ id: "prod-italiano", name: "Italiano", category: "Verduras y hortalizas", subcategory: "Verduras frescas", netPrice: 600, unitPrice: 714, saleUnit: "unit", imageFallback: "fresh-produce" }),

  product({ id: "prod-limon-camote-malla", name: "Limón camote malla", category: "Frutas", subcategory: "Frutas frescas", netPrice: 4000, unitPrice: 4760, saleUnit: "unit", imageFallback: "fruit" }),
  product({ id: "prod-limon-normal-malla", name: "Limón normal malla", category: "Frutas", subcategory: "Frutas frescas", netPrice: 4500, unitPrice: 5355, saleUnit: "unit", imageFallback: "fruit" }),
  product({ id: "prod-limon-sutil", name: "Limón sutil", category: "Frutas", subcategory: "Frutas frescas", netPrice: 2800, unitPrice: 3332, saleUnit: "kg", imageFallback: "fruit" }),
  product({ id: "prod-mango", name: "Mango", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "unit", imageFallback: "fruit" }),
  product({ id: "prod-manzana-roja-o-verde", name: "Manzana roja o verde", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "kg", imageFallback: "fruit" }),
  product({ id: "prod-naranja", name: "Naranja", category: "Frutas", subcategory: "Frutas frescas", netPrice: 700, unitPrice: 833, saleUnit: "kg", imageFallback: "fruit", opportunity: true }),
  product({ id: "prod-palta-peruana-1ra", name: "Palta peruana 1ra", category: "Frutas", subcategory: "Frutas frescas", netPrice: 3000, unitPrice: 3570, saleUnit: "kg", imageFallback: "fruit", opportunity: true }),
  product({ id: "prod-pina", name: "Piña", category: "Frutas", subcategory: "Frutas frescas", netPrice: 2800, unitPrice: 3332, saleUnit: "unit", imageFallback: "fruit" }),
  product({ id: "prod-platano", name: "Plátano", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1200, unitPrice: 1428, saleUnit: "kg", imageFallback: "fruit" }),
  product({ id: "prod-pomelo", name: "Pomelo", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1000, unitPrice: 1190, saleUnit: "kg", imageFallback: "fruit" }),
  product({ id: "prod-platano-macho", name: "Plátano macho", category: "Frutas", subcategory: "Frutas frescas", netPrice: 2500, unitPrice: 2975, saleUnit: "kg", imageFallback: "fruit", newArrival: true }),
  product({ id: "prod-mandarina", name: "Mandarina", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1000, unitPrice: 1190, saleUnit: "kg", imageFallback: "fruit" }),
  product({ id: "prod-kiwi", name: "Kiwi", category: "Frutas", subcategory: "Frutas frescas", netPrice: 1500, unitPrice: 1785, saleUnit: "kg", imageFallback: "fruit" }),

  product({ id: "prod-cebollin", name: "Cebollín", category: "Hierbas y especias", subcategory: "Hierbas frescas", netPrice: 700, unitPrice: 833, saleUnit: "unit", imageFallback: "herb" }),
  product({ id: "prod-champinon", name: "Champiñón", category: "Hierbas y especias", subcategory: "Hierbas frescas", netPrice: 8000, unitPrice: 9520, saleUnit: "kg", imageFallback: "herb" }),
  product({ id: "prod-cilantro", name: "Cilantro", category: "Hierbas y especias", subcategory: "Hierbas frescas", netPrice: 900, unitPrice: 1071, saleUnit: "unit", imageFallback: "herb", opportunity: true }),
  product({ id: "prod-perejil", name: "Perejil", category: "Hierbas y especias", subcategory: "Hierbas frescas", netPrice: 600, unitPrice: 714, saleUnit: "unit", imageFallback: "herb" }),
  product({ id: "prod-semilla-de-mostaza", name: "Semilla de mostaza", category: "Hierbas y especias", subcategory: "Especias", netPrice: 5500, unitPrice: 6545, saleUnit: "kg", imageFallback: "herb" }),
  product({ id: "prod-anis-estrellado", name: "Anís estrellado", category: "Hierbas y especias", subcategory: "Especias", netPrice: 18000, unitPrice: 21420, saleUnit: "kg", imageFallback: "herb" }),

  product({ id: "prod-cebolla-blanca-malla", name: "Cebolla blanca malla", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 12000, unitPrice: 14280, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-cebolla-morada-malla", name: "Cebolla morada malla", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 20000, unitPrice: 23800, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-paquete-cebollin-10-und", name: "Paquete cebollín 10 und", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 7000, unitPrice: 8330, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-escarola-caja", name: "Escarola caja", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 13000, unitPrice: 15470, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-naranja-malla-15-kg", name: "Naranja malla 15 kg", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 7000, unitPrice: 8330, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-saco-papa-lavada-25-kg", name: "Saco papa lavada 25 kg", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 22000, unitPrice: 26180, saleUnit: "sack", imageFallback: "package", opportunity: true }),
  product({ id: "prod-saco-de-papa-sucia-25-kg", name: "Saco de papa sucia 25 kg", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 19000, unitPrice: 22610, saleUnit: "sack", imageFallback: "package" }),
  product({ id: "prod-tomate-primera-caja-17-kg", name: "Tomate primera caja 17 kg", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 19000, unitPrice: 22610, saleUnit: "unit", imageFallback: "package", newArrival: true }),
  product({ id: "prod-caja-de-italiano", name: "Caja de italiano", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 22000, unitPrice: 26180, saleUnit: "unit", imageFallback: "package" }),
  product({ id: "prod-caja-de-huevo", name: "Caja de huevo", category: "Formatos y cajas", subcategory: "Formatos comerciales", netPrice: 36000, unitPrice: 42840, saleUnit: "unit", imageFallback: "package" }),

  product({ id: "prod-miel", name: "Miel", category: "Otros", subcategory: "Otros productos", netPrice: 6000, unitPrice: 7140, saleUnit: "kg", imageFallback: "package" }),
] as const satisfies readonly MockProduct[];
