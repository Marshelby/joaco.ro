import { ActionLink } from "@/components/ui/action-link";

export function OrderViews({ vista }: { vista: "recibidos" | "todos" | "entregas" | "posibles" | "no-entregados" }) {
  return <nav aria-label="Filtro de pedidos" className="flex flex-wrap gap-2">
    {([
      ["recibidos", "/admin/pedidos", "Recibidos"],
      ["entregas", "/admin/pedidos?filtro=entregas", "Próximas entregas"],
      ["no-entregados", "/admin/pedidos?filtro=no-entregados", "No entregados"],
      ["todos", "/admin/pedidos?filtro=todos", "Todos"],
      ["posibles", "/admin/pedidos?filtro=posibles", "Posibles pedidos"],
    ] as const).map(([valor, href, label]) => <ActionLink key={valor} href={href} variant={vista === valor ? "primary" : "secondary"} aria-current={vista === valor ? "page" : undefined}>{label}</ActionLink>)}
  </nav>;
}
