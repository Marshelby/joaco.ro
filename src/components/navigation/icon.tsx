import {
  Box,
  CircleUserRound,
  FolderTree,
  House,
  MapPinned,
  PackageCheck,
  Route,
  Settings,
  ShoppingCart,
  Tags,
  UsersRound,
} from "lucide-react";

import type { NavigationIconName } from "@/types/navigation";

const icons = {
  account: CircleUserRound,
  box: Box,
  cart: ShoppingCart,
  catalog: Tags,
  category: FolderTree,
  customers: UsersRound,
  delivery: MapPinned,
  home: House,
  orders: PackageCheck,
  routes: Route,
  settings: Settings,
} as const;

export function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} />;
}
