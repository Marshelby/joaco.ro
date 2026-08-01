import type { HomeSectionMock } from "@/types/home-section";

export const ADMIN_HOME_SECTIONS_MOCK: readonly HomeSectionMock[] = [
  {
    id: "featured",
    title: "Productos destacados",
    description: "Una selección editorial para recibir a quienes visitan la tienda.",
    productIds: ["mock-sarten-24", "mock-termo-uno-litro", "mock-cobertor-liviano", "mock-almohada-confort", "mock-lampara-solar", "mock-organizador-modular"],
  },
  {
    id: "best-sellers",
    title: "Lo más vendido",
    description: "Un escaparate editorial con productos que quieres destacar.",
    productIds: ["mock-sarten-24", "mock-termo-uno-litro", "mock-cobertor-liviano", "mock-almohada-confort", "mock-set-limpieza", "mock-cama-mascota"],
  },
  {
    id: "opportunities",
    title: "Oportunidades",
    description: "Productos seleccionados manualmente para esta vitrina.",
    productIds: ["mock-sarten-24", "mock-almohada-confort", "mock-lampara-solar", "mock-organizador-modular", "mock-set-limpieza", "mock-set-contenedores"],
  },
  {
    id: "new-arrivals",
    title: "Novedades",
    description: "Productos que quieres presentar como una selección reciente.",
    productIds: ["mock-lampara-solar", "mock-juego-bloques", "mock-set-contenedores", "mock-set-herramientas", "mock-cama-mascota"],
  },
];
