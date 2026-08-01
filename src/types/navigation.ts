export type NavigationIconName =
  | "account"
  | "box"
  | "cart"
  | "catalog"
  | "category"
  | "customers"
  | "delivery"
  | "home"
  | "orders"
  | "routes"
  | "settings";

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIconName;
  description?: string;
  available?: boolean;
  section?: string;
};
