"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepararResolucionNoEntregado, resolverNoEntregado, type ResolucionNoEntregado } from "@/app/(admin)/admin/pedidos/no-entregados-actions";

export function UndeliveredOrderActions({ pedidoId, historico = false }: { pedidoId: string; historico?: boolean }) {
  const router = useRouter();
  const [accion, setAccion] = useState<"reprogramar" | "cancelar" | null>(null);
  const [version, setVersion] = useState<number>();
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [solicitud, setSolicitud] = useState<ResolucionNoEntregado>();
  const [pendiente, iniciar] = useTransition();
  const ocupado = useRef(false);
  function abrir(tipo: "reprogramar" | "cancelar") {
    if (ocupado.current) return;
    ocupado.current = true;
    setError(""); setMensaje(""); setSolicitud(undefined); setVersion(undefined); setAccion(tipo);
    iniciar(async () => {
      try {
        const r = await prepararResolucionNoEntregado(pedidoId);
        if (r.error) setError(r.error); else setVersion(r.version);
      } catch { setError("No se pudo cargar el pedido. Cierra e intenta nuevamente."); }
      finally { ocupado.current = false; }
    });
  }
  function enviar(form: FormData) {
    if (ocupado.current || version === undefined || !accion) return;
    const s = solicitud ?? { pedido: pedidoId, version, clave: crypto.randomUUID(), accion,
      motivo: String(form.get("motivo") ?? "").trim(), fecha: String(form.get("fecha") ?? ""), tratamiento: String(form.get("tratamiento") ?? "").trim() };
    ocupado.current = true;
    setSolicitud(s); setError("");
    iniciar(async () => {
      try {
        const r = await resolverNoEntregado(s, form.get("confirmado") === "on");
        if (r.error) setError(r.error);
        else {
          const texto = s.accion === "reprogramar" ? "Pedido reprogramado. Debes incluirlo explícitamente en la nueva carga." : "Pedido cancelado. Pagos, créditos y cierre original conservados.";
          setMensaje(texto); toast.success(texto); setAccion(null); router.refresh();
        }
      } catch { setError("Respuesta interrumpida. Reintenta la misma solicitud."); }
      finally { ocupado.current = false; }
    });
  }
  const campo = "block w-full rounded-lg border bg-background p-2";
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={historico || pendiente || accion !== null} onClick={() => abrir("reprogramar")}>Reprogramar</Button><Button variant="outline" disabled={historico || pendiente || accion !== null} onClick={() => abrir("cancelar")}>Cancelar</Button></div>
    {historico ? <p className="text-sm text-muted-foreground">Requiere revisar la evidencia del intento histórico antes de resolverlo.</p> : null}
    {accion ? <form onSubmit={(event) => { event.preventDefault(); enviar(new FormData(event.currentTarget)); }} className="space-y-3 rounded-lg border p-4" aria-label={accion === "reprogramar" ? "Reprogramar pedido no entregado" : "Cancelar pedido no entregado"}>
      <p className="text-sm">{accion === "reprogramar" ? "Conserva el mismo pedido, productos, precios y preparación. La nueva fecha debe ser posterior al intento original; la jornada debe estar en preparación. El pedido quedará fuera de la carga hasta su inclusión explícita." : "Cancelación lógica del mismo pedido. No genera venta, deuda ni cargos. Conserva pagos, créditos y evidencia; no realiza devoluciones. Requiere ruta cerrada y no admite venta definitiva ni régimen legado."}</p>
      <fieldset disabled={pendiente || !!solicitud || version === undefined} className="space-y-3">
        {accion === "reprogramar" ? <label className="block text-sm">Nueva fecha de entrega<input type="date" name="fecha" required className={campo} /></label> : null}
        <label className="block text-sm">Motivo administrativo<textarea name="motivo" required maxLength={2000} className={campo} /></label>
        {accion === "cancelar" ? <label className="block text-sm">Tratamiento administrativo de pagos y créditos<textarea name="tratamiento" required maxLength={2000} className={campo} /><span>Indica la revisión realizada y la gestión pendiente o su referencia. Si no existen pagos ni créditos, indícalo expresamente. Esta constancia no ejecuta ajustes ni devoluciones.</span></label> : null}
      </fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmado" required disabled={pendiente || version === undefined} />Confirmo {accion === "reprogramar" ? "la fecha y que debo incluir el pedido explícitamente en una carga" : "la cancelación y el tratamiento administrativo registrado, sin devolución automática"}.</label>
      {solicitud ? <p className="text-xs text-muted-foreground">Solicitud conservada para reintentar sin duplicados. Revisa el historial antes de abandonarla o iniciar otra.</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pendiente || version === undefined}>{pendiente ? "Procesando…" : solicitud ? "Reintentar misma solicitud" : "Confirmar operación"}</Button><Button type="button" variant="outline" disabled={pendiente} onClick={() => { setAccion(null); setSolicitud(undefined); setError(""); }}>Cerrar</Button></div>
    </form> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {mensaje ? <p role="status" className="text-sm">{mensaje}</p> : null}
  </div>;
}
