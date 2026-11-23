import {
  Box,
  ChartColumnIncreasing,
  CircleUserRound,
  FolderTree,
  House,
  MapPinned,
  MessageCircle,
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
  analytics: ChartColumnIncreasing,
  box: Box,
  cart: ShoppingCart,
  catalog: Tags,
  category: FolderTree,
  customers: UsersRound,
  delivery: MapPinned,
  home: House,
  messages: MessageCircle,
  orders: PackageCheck,
  routes: Route,
  settings: Settings,
} as const;

export function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} />;
}
