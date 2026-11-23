export type NavigationIconName =
  | "account"
  | "analytics"
  | "box"
  | "cart"
  | "catalog"
  | "category"
  | "customers"
  | "delivery"
  | "home"
  | "messages"
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
