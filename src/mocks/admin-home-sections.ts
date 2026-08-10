import type { HomeSectionMock } from "@/types/home-section";

export const ADMIN_HOME_SECTIONS_MOCK: readonly HomeSectionMock[] = [
  {
    id: "featured",
    title: "Frescos de Hidro Leufú",
    description: "Una selección prioritaria de productos hidropónicos.",
    productIds: ["prod-lechuga-hidroponica", "prod-flores-comestibles-50-und", "prod-microgreens-50-gr", "prod-albahaca-en-rama", "prod-ciboulette-75-gr", "prod-berro-hidroponico", "prod-rucula", "prod-tomate-cherry"],
  },
  {
    id: "best-sellers",
    title: "Productos destacados",
    description: "Productos seleccionados para la vitrina principal.",
    productIds: ["prod-lechuga-hidroponica", "prod-flores-comestibles-50-und", "prod-microgreens-50-gr", "prod-albahaca-en-rama", "prod-berro-hidroponico", "prod-rucula"],
  },
  {
    id: "opportunities",
    title: "Más productos frescos",
    description: "Productos seleccionados manualmente para complementar la vitrina.",
    productIds: ["prod-brocoli", "prod-pimenton-rojo-primera", "prod-palta-peruana-1ra", "prod-naranja", "prod-tomate-primera", "prod-cilantro", "prod-saco-papa-lavada-25-kg"],
  },
  {
    id: "new-arrivals",
    title: "Recién seleccionados",
    description: "Productos que se suman a la selección disponible.",
    productIds: ["prod-apio", "prod-tomate-primera", "prod-aji-amarillo", "prod-platano-macho", "prod-tomate-primera-caja-17-kg"],
  },
];
