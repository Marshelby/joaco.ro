"use client";

import { ChevronUp, LoaderCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cargarMensajesAnterioresCliente, enviarMensajeCliente, marcarConversacionLeidaCliente } from "@/app/(customer)/mi-cuenta/mensajes/actions";
import { MessageComposer } from "@/components/account/messages/message-composer";
import { MessageList } from "@/components/account/messages/message-list";
import { Button } from "@/components/ui/button";
import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";
import type { ConversacionCliente, MensajeConversacion } from "@/types/chat";

type CustomerChatProps = {
  conversacionInicial: ConversacionCliente | null;
  mensajesIniciales: readonly MensajeConversacion[];
  tieneMensajesAnterioresInicial: boolean;
};

type MensajeRealtimeFila = {
  id: string;
  conversacion_id: string;
  remitente_usuario_id: string;
  remitente_tipo: "cliente" | "admin";
  remitente_nombre_snapshot: string;
  contenido: string;
  fecha_creacion: string;
  pedidos: { id: string; numero_pedido: string } | null;
};

function ordenarYUnir(actuales: readonly MensajeConversacion[], nuevos: readonly MensajeConversacion[]) {
  const porId = new Map(actuales.map((mensaje) => [mensaje.id, mensaje]));
  nuevos.forEach((mensaje) => porId.set(mensaje.id, mensaje));
  return [...porId.values()].sort((a, b) => a.fechaCreacion.localeCompare(b.fechaCreacion) || a.id.localeCompare(b.id));
}

function mapMensajeRealtime(fila: MensajeRealtimeFila): MensajeConversacion {
  return {
    id: fila.id,
    conversacionId: fila.conversacion_id,
    remitenteUsuarioId: fila.remitente_usuario_id,
    remitenteTipo: fila.remitente_tipo,
    remitenteNombreSnapshot: fila.remitente_nombre_snapshot,
    contenido: fila.contenido,
    pedido: fila.pedidos ? { id: fila.pedidos.id, numeroPedido: fila.pedidos.numero_pedido } : null,
    fechaCreacion: fila.fecha_creacion,
  };
}

export function CustomerChat({ conversacionInicial, mensajesIniciales, tieneMensajesAnterioresInicial }: CustomerChatProps) {
  const [conversacionId, setConversacionId] = useState(conversacionInicial?.id ?? null);
  const [mensajes, setMensajes] = useState<MensajeConversacion[]>([...mensajesIniciales]);
  const [tieneMensajesAnteriores, setTieneMensajesAnteriores] = useState(tieneMensajesAnterioresInicial);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [nuevoMensajePendiente, setNuevoMensajePendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cercaDelFinalRef = useRef(true);
  const desplazarAlFinalRef = useRef(true);

  useEffect(() => {
    if (!conversacionId) return;
    void marcarConversacionLeidaCliente();
  }, [conversacionId]);

  useEffect(() => {
    if (!conversacionId) return;
    const supabase = crearClienteSupabaseNavegador();
    const canal = supabase
      .channel(`mensajes-cliente-${conversacionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_conversacion", filter: `conversacion_id=eq.${conversacionId}` }, async (evento) => {
        const id = String(evento.new.id ?? "");
        if (!id) return;
        const { data, error: errorConsulta } = await supabase
          .from("mensajes_conversacion")
          .select("id,conversacion_id,remitente_usuario_id,remitente_tipo,remitente_nombre_snapshot,contenido,fecha_creacion,pedidos(id,numero_pedido)")
          .eq("id", id)
          .maybeSingle();
        if (errorConsulta || !data) return;

        const mensaje = mapMensajeRealtime(data as unknown as MensajeRealtimeFila);
        setMensajes((actuales) => ordenarYUnir(actuales, [mensaje]));
        if (cercaDelFinalRef.current) desplazarAlFinalRef.current = true;
        else setNuevoMensajePendiente(true);
        if (mensaje.remitenteTipo === "admin") void marcarConversacionLeidaCliente();
      })
      .subscribe();

    return () => { void supabase.removeChannel(canal); };
  }, [conversacionId]);

  useLayoutEffect(() => {
    if (!desplazarAlFinalRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
    desplazarAlFinalRef.current = false;
    setNuevoMensajePendiente(false);
  }, [mensajes.length]);

  function manejarScroll() {
    const panel = panelRef.current;
    if (!panel) return;
    cercaDelFinalRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 96;
    if (cercaDelFinalRef.current) setNuevoMensajePendiente(false);
  }

  async function enviar(contenido: string, claveIdempotencia: string) {
    const resultado = await enviarMensajeCliente({ contenido, claveIdempotencia });
    if (!resultado.ok) {
      setError(resultado.error);
      return false;
    }

    setError(null);
    setConversacionId(resultado.mensaje.conversacionId);
    desplazarAlFinalRef.current = true;
    setMensajes((actuales) => ordenarYUnir(actuales, [resultado.mensaje]));
    return true;
  }

  async function cargarAnteriores() {
    const primerMensaje = mensajes[0];
    const panel = panelRef.current;
    if (!primerMensaje || !panel || cargandoAnteriores) return;
    const alturaAnterior = panel.scrollHeight;
    const posicionAnterior = panel.scrollTop;
    setCargandoAnteriores(true);
    setError(null);
    const resultado = await cargarMensajesAnterioresCliente({ fechaCreacion: primerMensaje.fechaCreacion, id: primerMensaje.id });
    setMensajes((actuales) => ordenarYUnir(resultado.mensajes, actuales));
    setTieneMensajesAnteriores(resultado.tieneMensajesAnteriores);
    setCargandoAnteriores(false);
    requestAnimationFrame(() => {
      const panelActual = panelRef.current;
      if (panelActual) panelActual.scrollTop = posicionAnterior + (panelActual.scrollHeight - alturaAnterior);
    });
  }

  function irAlFinal() {
    desplazarAlFinalRef.current = true;
    const panel = panelRef.current;
    if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
    setNuevoMensajePendiente(false);
  }

  return (
    <section aria-label="Conversación con Hidro Leufú" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-foreground">Mensajes con Hidro Leufú</h2><p className="mt-1 text-sm text-muted-foreground">Escríbenos cuando lo necesites. Mantendremos el historial de la conversación.</p></header>
      <div className="relative">
        <div ref={panelRef} onScroll={manejarScroll} className="h-[min(58svh,38rem)] min-h-80 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
          {tieneMensajesAnteriores ? <div className="mb-4 flex justify-center"><Button type="button" variant="outline" size="sm" onClick={() => void cargarAnteriores()} disabled={cargandoAnteriores}>{cargandoAnteriores ? <><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Cargando…</> : "Cargar mensajes anteriores"}</Button></div> : null}
          {mensajes.length > 0 ? <MessageList mensajes={mensajes} /> : <div className="flex h-full min-h-56 items-center justify-center px-4 text-center"><div className="max-w-sm space-y-2"><p className="font-medium text-foreground">Aún no tienes mensajes.</p><p className="text-sm leading-6 text-muted-foreground">Puedes escribirnos por aquí y mantendremos el historial de la conversación.</p></div></div>}
        </div>
        {nuevoMensajePendiente ? <Button type="button" size="sm" onClick={irAlFinal} className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md"><ChevronUp className="size-3.5" aria-hidden="true" />Nuevos mensajes</Button> : null}
      </div>
      <MessageComposer onSend={enviar} />
      {error ? <p role="alert" className="border-t border-border px-4 py-3 text-sm text-destructive sm:px-5">{error}</p> : null}
    </section>
  );
}
