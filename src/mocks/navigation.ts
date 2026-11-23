import { ROUTES } from "@/config/routes";
import type { NavigationItem } from "@/types/navigation";

export const PUBLIC_NAVIGATION = [
  { label: "Inicio", href: ROUTES.home, icon: "home" },
  { label: "Catálogo", href: ROUTES.catalog, icon: "catalog" },
] as const satisfies readonly NavigationItem[];

export const PUBLIC_ACCOUNT_NAVIGATION = [
  { label: "Iniciar sesión", href: "/iniciar-sesion", icon: "account" },
] as const satisfies readonly NavigationItem[];

export const SHOW_CUSTOMER_BENEFITS = false;

export const CUSTOMER_NAVIGATION = [
  { label: "Resumen", href: ROUTES.account, icon: "home", description: "Vista general de tu cuenta." },
  { label: "Pedidos", href: ROUTES.accountOrders, icon: "orders", description: "Revisa el estado de tus compras." },
  { label: "Direcciones", href: ROUTES.accountAddresses, icon: "delivery", description: "Revisa tus direcciones de entrega." },
  ...(SHOW_CUSTOMER_BENEFITS ? [{ label: "Beneficios", href: ROUTES.accountBenefits, icon: "account", description: "Compras acumuladas y cupones." } as const] : []),
  { label: "Mensajes", href: ROUTES.accountMessages, icon: "messages", description: "Habla directamente con Hidro Leufú." },
] as const satisfies readonly NavigationItem[];

export const ADMIN_NAVIGATION = [
  { label: "Inteligencia comercial", href: ROUTES.admin, icon: "analytics" },
  { label: "Gestores", href: ROUTES.adminPublicManager, icon: "catalog" },
  { label: "Clientes / Proveedores", href: ROUTES.adminCustomers, icon: "customers" },
  { label: "Pedidos", href: ROUTES.adminOrders, icon: "orders" },
  { label: "Rutas", href: ROUTES.adminRoutes, icon: "routes" },
  { label: "Producción", href: ROUTES.adminProduction, icon: "box" },
] as const satisfies readonly NavigationItem[];

export const ADMIN_NAVIGATION_GROUPS = [
  {
    label: "Gestores",
    tabs: [
      { label: "Gestor público", href: ROUTES.adminPublicManager, related: [ROUTES.adminProducts, ROUTES.adminCategories, ROUTES.adminHomeSections] },
      { label: "Gestor interno", href: ROUTES.adminInternalManager, related: [ROUTES.adminStaff, "/admin/repartidores", ROUTES.adminSettings] },
    ],
  },
  {
    label: "Clientes / Proveedores",
    tabs: [
      { label: "Clientes", href: ROUTES.adminCustomers, related: [ROUTES.adminMessages] },
      { label: "Proveedores", href: ROUTES.adminSuppliers, related: [] },
    ],
  },
] as const;

export function matchesNavigationPath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function matchesAdminTab(pathname: string, tab: { href: string; related: readonly string[] }) {
  return [tab.href, ...tab.related].some((route) => matchesNavigationPath(pathname, route));
}
