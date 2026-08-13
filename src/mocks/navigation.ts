import { ROUTES } from "@/config/routes";
import type { NavigationItem } from "@/types/navigation";

export const PUBLIC_NAVIGATION = [
  { label: "Inicio", href: ROUTES.home, icon: "home" },
  { label: "Catálogo", href: ROUTES.catalog, icon: "catalog" },
] as const satisfies readonly NavigationItem[];

export const PUBLIC_ACCOUNT_NAVIGATION = [
  { label: "Acceso clientes", href: "/iniciar-sesion", icon: "account" },
] as const satisfies readonly NavigationItem[];

export const CUSTOMER_NAVIGATION = [
  { label: "Resumen", href: ROUTES.account, icon: "home", description: "Vista general de tu cuenta." },
  { label: "Pedidos", href: ROUTES.accountOrders, icon: "orders", description: "Revisa el estado de tus compras." },
  { label: "Direcciones", href: ROUTES.accountAddresses, icon: "delivery", description: "Revisa tus direcciones de entrega." },
  { label: "Beneficios", href: ROUTES.accountBenefits, icon: "account", description: "Revisa sorteos y promociones disponibles." },
] as const satisfies readonly NavigationItem[];

export const ADMIN_NAVIGATION = [
  { label: "Dashboard", href: ROUTES.admin, icon: "home" },
  { label: "Productos", href: ROUTES.adminProducts, icon: "box" },
  { label: "Categorías", href: ROUTES.adminCategories, icon: "category" },
  { label: "Pedidos", href: ROUTES.adminOrders, icon: "orders" },
  { label: "Secciones Inicio", href: ROUTES.adminHomeSections, icon: "catalog" },
  { label: "Configuración", href: ROUTES.adminSettings, icon: "settings" },
] as const satisfies readonly NavigationItem[];
