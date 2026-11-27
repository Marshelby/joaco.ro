import { ActionLink } from "@/components/ui/action-link";

import { obtenerCantidadPedidosRecibidos } from "@/lib/admin/pedidos";
import { obtenerNoEntregadosSinFiltros } from "@/lib/admin/no-entregados";
import { contarPosiblesPedidos } from "@/lib/posibles-pedidos/administracion";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

async function contarPedidos() {
  const supabase = await crearClienteSupabaseServidor();
  const base = () => supabase.from("pedidos").select("id", { count: "exact", head: true });
  const [todos, entregados] = await Promise.all([base(), base().eq("estado", "entregado")]);
  return { todos: todos.error ? null : todos.count, entregados: entregados.error ? null : entregados.count };
}

export async function OrderViews({ vista }: { vista: "recibidos" | "todos" | "posibles" | "no-entregados" | "entregados" }) {
  const [recibidos, noEntregados, oficiales, posibles] = await Promise.all([
    obtenerCantidadPedidosRecibidos().catch(() => null),
    obtenerNoEntregadosSinFiltros().then(resultado => resultado.error ? null : resultado.total).catch(() => null),
    contarPedidos().catch(() => ({ todos: null, entregados: null })),
    fasePosiblesPedidosHabilitada() ? contarPosiblesPedidos("pendientes").catch(() => null) : null,
  ]);
  const cantidades = { recibidos, "no-entregados": noEntregados, ...oficiales, posibles };

  return <nav aria-label="Filtro de pedidos" className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/30 p-1.5">
    {([
      ["recibidos", "/admin/pedidos", "Recibidos"],
      ["no-entregados", "/admin/pedidos?filtro=no-entregados", "No entregados"],
      ["entregados", "/admin/pedidos?filtro=entregados", "Entregados"],
      ["todos", "/admin/pedidos?filtro=todos", "Todos"],
      ["posibles", "/admin/pedidos?filtro=posibles", "Posibles pedidos"],
    ] as const).map(([valor, href, label]) => <ActionLink key={valor} href={href} variant={vista === valor ? "primary" : "secondary"} aria-current={vista === valor ? "page" : undefined} className="min-h-9 gap-1 px-2.5 text-xs motion-safe:duration-200">{label}{cantidades[valor] != null && <span className="tabular-nums">({cantidades[valor]})</span>}</ActionLink>)}
  </nav>;
}
