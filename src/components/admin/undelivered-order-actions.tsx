"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FechaEntregaDisponible } from "@/types/delivery";
import { Button } from "@/components/ui/button";
import { prepararResolucionNoEntregado, resolverNoEntregado, type ResolucionNoEntregado } from "@/app/(admin)/admin/pedidos/no-entregados-actions";

export function UndeliveredOrderActions({ pedidoId, historico = false }: { pedidoId: string; historico?: boolean }) {
  const router = useRouter();
  const [accion, setAccion] = useState<"reprogramar" | "cancelar" | null>(null);
  const [fechas, setFechas] = useState<FechaEntregaDisponible[]>([]);
  const [version, setVersion] = useState<number>();
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [solicitud, setSolicitud] = useState<ResolucionNoEntregado>();
  const [pendiente, iniciar] = useTransition();
  const ocupado = useRef(false);
  function abrir(tipo: "reprogramar" | "cancelar") {
    if (ocupado.current) return;
    ocupado.current = true;
    setError(""); setMensaje(""); setSolicitud(undefined); setVersion(undefined); setAccion(tipo); setFechas([]);
    iniciar(async () => {
      try {
        const r = await prepararResolucionNoEntregado(pedidoId, tipo === "reprogramar");
        if (r.error) setError(r.error); else { setVersion(r.version); setFechas(r.fechas ?? []); }
      } catch { setError("No se pudo cargar el pedido. Cierra e intenta nuevamente."); }
      finally { ocupado.current = false; }
    });
  }
  function enviar(form: FormData) {
    if (ocupado.current || version === undefined || !accion) return;
    const s = solicitud ?? { pedido: pedidoId, version, clave: crypto.randomUUID(), accion,
      motivo: String(form.get("motivo") ?? "").trim(), fecha: String(form.get("fecha") ?? ""), tratamiento: String(form.get("tratamiento") ?? "").trim() };
    if (!solicitud && (!s.motivo || (accion === "reprogramar" && !fechas.some(f => f.fecha === s.fecha)))) {
      setError("Elige una fecha disponible y escribe el motivo del cambio.");
      return;
    }
    ocupado.current = true;
    setSolicitud(s); setError("");
    iniciar(async () => {
      try {
        const r = await resolverNoEntregado(s, form.get("confirmado") === "on");
        if (r.error) {
          setError(r.error);
          // Un rechazo explícito no escribió datos. Una respuesta incierta conserva
          // la misma clave y contenido para consultar/reintentar sin duplicados.
          if (r.rechazada) setSolicitud(undefined);
        }
        else {
          const texto = s.accion === "reprogramar" ? "Pedido reprogramado. Ahora debes agregarlo al reparto de la nueva fecha." : "Pedido cancelado. Pagos, créditos y cierre original conservados.";
          setMensaje(texto); toast.success(texto); setAccion(null); router.refresh();
        }
      } catch { setError("Respuesta interrumpida. Reintenta la misma solicitud."); }
      finally { ocupado.current = false; }
    });
  }
  const campo = "block w-full min-w-0 rounded-lg border border-input bg-background p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={historico || pendiente || accion !== null} onClick={() => abrir("reprogramar")}>Reprogramar</Button><Button variant="outline" disabled={historico || pendiente || accion !== null} onClick={() => abrir("cancelar")}>Cancelar</Button></div>
    {historico ? <p className="text-sm text-muted-foreground">Requiere revisar la evidencia del intento histórico antes de resolverlo.</p> : null}
    {accion ? <form onSubmit={(event) => { event.preventDefault(); enviar(new FormData(event.currentTarget)); }} className="max-w-xl space-y-3 rounded-xl border border-border bg-muted/30 p-3 sm:p-4" aria-busy={pendiente} aria-label={accion === "reprogramar" ? "Reprogramar pedido no entregado" : "Cancelar pedido no entregado"}>
      <h3 className="text-sm font-semibold">{accion === "reprogramar" ? "Cambiar fecha de entrega" : "Cancelar pedido"}</h3>
      {pendiente && version === undefined ? <p role="status" className="text-sm text-muted-foreground">Consultando pedido y fechas disponibles…</p> : null}
      <p className="text-sm text-muted-foreground">{accion === "reprogramar" ? "Se mantienen los productos, precios y cantidades ya preparadas. Al confirmar, cambiaremos la fecha de entrega. Después debes agregarlo al reparto de ese día." : "Cancelación lógica del mismo pedido. No genera venta, deuda ni cargos. Conserva pagos, créditos y evidencia; no realiza devoluciones. Requiere ruta cerrada y no admite venta definitiva ni régimen legado."}</p>
      <fieldset disabled={pendiente || !!solicitud || version === undefined} className="space-y-3">
        {accion === "reprogramar" ? <label className="block text-sm">Nueva fecha de entrega<select name="fecha" required defaultValue="" className={`${campo} min-h-11 mt-1`}>
          <option value="" disabled>Elige una fecha</option>
          {fechas.map(f => <option key={f.fecha} value={f.fecha}>{f.etiquetaLarga}</option>)}
        </select><span className="mt-1 block text-xs text-muted-foreground">Hasta 10 próximas fechas habilitadas, según el horario de Chile y la disponibilidad del reparto.</span>
        {!fechas.length && version !== undefined ? <span role="status" className="mt-1 block">No hay fechas habilitadas dentro del plazo vigente. Verifica que el reparto anterior esté cerrado y la preparación terminada; luego actualiza las fechas.</span> : null}</label> : null}
        <label className="block text-sm">Motivo administrativo<textarea name="motivo" required maxLength={2000} rows={2} className={`${campo} mt-1 resize-y`} /></label>
        {accion === "cancelar" ? <label className="block text-sm">Tratamiento administrativo de pagos y créditos<textarea name="tratamiento" required maxLength={2000} className={campo} /><span>Indica la revisión realizada y la gestión pendiente o su referencia. Si no existen pagos ni créditos, indícalo expresamente. Esta constancia no ejecuta ajustes ni devoluciones.</span></label> : null}
      </fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmado" required disabled={pendiente || version === undefined} />Confirmo {accion === "reprogramar" ? "la fecha y que debo agregar el pedido al reparto de ese día" : "la cancelación y el tratamiento administrativo registrado, sin devolución automática"}.</label>
      {solicitud ? <p className="text-xs text-muted-foreground">Guardamos los datos de este intento para evitar duplicados. Si no recibiste confirmación, reintenta o revisa el historial antes de iniciar otro cambio.</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pendiente || version === undefined || (accion === "reprogramar" && !fechas.length && !solicitud)}>{pendiente ? "Procesando…" : solicitud ? "Reintentar misma solicitud" : accion === "reprogramar" ? "Confirmar nueva fecha" : "Confirmar cancelación"}</Button>{accion === "reprogramar" && !solicitud ? <Button type="button" variant="outline" disabled={pendiente} onClick={() => abrir("reprogramar")}>Actualizar fechas</Button> : null}<Button type="button" variant="outline" disabled={pendiente} onClick={() => { setAccion(null); setSolicitud(undefined); setError(""); }}>Cerrar</Button></div>
    </form> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    {mensaje ? <p role="status" className="text-sm">{mensaje}</p> : null}
  </div>;
}
