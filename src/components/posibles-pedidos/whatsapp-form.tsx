"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { PublicLink } from "@/components/navigation/public-navigation-feedback";
import { TurnstileCaptcha } from "@/components/auth/turnstile-captcha";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { datosSolicitud, respuestaSolicitud, type DatosSolicitud, type RespuestaSolicitud } from "@/lib/posibles-pedidos/contrato";
import { guardarRespuesta, huellaSolicitud, obtenerIntento } from "@/lib/posibles-pedidos/intentos";
import { enlaceSolicitud } from "@/lib/posibles-pedidos/mensaje";
import { formatCLP } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { cotizarDespacho } from "@/lib/delivery-pricing";

const input = "mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70";
const CLAVE_BORRADOR = "hidro-leufu-posible-pendiente-v1";
function recuperarContacto(datos: DatosSolicitud) {
  const coincidencia = /^Localidad: ([^\n]*)(?:\n|$)/.exec(datos.observaciones);
  return { nombre: datos.nombre, telefono: datos.telefono!, localidad: coincidencia?.[1] ?? "", fecha: datos.fecha,
    observaciones: coincidencia ? datos.observaciones.slice(coincidencia[0].length) : datos.observaciones };
}
type Confirmada = { datos: DatosSolicitud; respuesta: RespuestaSolicitud };
export function WhatsappForm() {
  const { items, isHydrated, totalEstimado } = useCart();
  const [fechas, setFechas] = useState<string[]>([]);
  const [cargandoFechas, setCargandoFechas] = useState(true);
  const [form, setForm] = useState({ nombre: "", telefono: "", localidad: "", fecha: "", observaciones: "" });
  const [pendienteDatos, setPendienteDatos] = useState<DatosSolicitud | null>(null);
  const [confirmada, setConfirmada] = useState<Confirmada | null>(null);
  const [captcha, setCaptcha] = useState("");
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const enviandoRef = useRef(false);
  const cotizacion = cotizarDespacho(totalEstimado);
  const cargarFechas = useCallback(async () => {
    setCargandoFechas(true);
    try {
      const response = await fetch("/api/posibles-pedidos/fechas", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.fechas)) throw new Error();
      setFechas(data.fechas); setError("");
      return true;
    } catch { setError("No pudimos cargar las fechas disponibles. Vuelve a intentar."); return false; }
    finally { setCargandoFechas(false); }
  }, []);
  useEffect(() => {
    let activo = true;
    void Promise.resolve().then(async () => {
      if (!activo) return;
      void cargarFechas();
      try {
        const texto = sessionStorage.getItem(CLAVE_BORRADOR);
        if (texto) {
          const borrador = JSON.parse(texto);
          // Una solicitud incierta nunca recibe una clave nueva por caducidad silenciosa.
          const datos = datosSolicitud.parse(borrador.datos);
          if (borrador.expira <= Date.now()) throw new Error();
          setForm(recuperarContacto(datos));
          setPendienteDatos(datos);
          const huella = await huellaSolicitud(datos);
          const intento = obtenerIntento(localStorage, huella);
          if (intento.clave !== borrador.clave) throw new Error();
          if (intento.respuesta) setConfirmada({ datos, respuesta: respuestaSolicitud.parse(intento.respuesta) });
        }
        setListo(true);
      } catch { setError("No pudimos recuperar el intento anterior. Contacta a Hidro Leufú antes de crear otra solicitud desde este navegador."); }
    });
    return () => { activo = false; };
  }, [cargarFechas]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;
    if (!pendienteDatos && (cargandoFechas || !fechas.includes(form.fecha))) { setError("Selecciona una fecha de entrega disponible."); return; }
    if (!pendienteDatos && !form.localidad.trim()) { setError("Indica tu localidad."); return; }
    const validado = datosSolicitud.safeParse(pendienteDatos ?? { nombre: form.nombre, telefono: form.telefono, fecha: form.fecha, observaciones: `Localidad: ${form.localidad.trim()}${form.observaciones.trim() ? `\n${form.observaciones.trim()}` : ""}`, items: items.map((i) => ({ presentacion_id: i.presentacionId, cantidad: i.cantidad })) });
    if (!validado.success) { setError("Revisa tu nombre, teléfono móvil chileno, fecha y productos."); return; }
    if (!navigator.locks || !crypto.subtle) { setError("Actualiza tu navegador para registrar la solicitud de forma segura."); return; }
    enviandoRef.current = true; setEnviando(true); setError("");
    try {
      await navigator.locks.request("hidro-leufu-posible-registro", async () => {
        const datos = validado.data;
        const huella = await huellaSolicitud(datos);
        const intento = obtenerIntento(localStorage, huella);
        if (intento.respuesta) { setConfirmada({ datos, respuesta: intento.respuesta }); return; }
        sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ datos, clave: intento.clave, expira: intento.expira }));
        setPendienteDatos(datos);
        const response = await fetch("/api/posibles-pedidos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...datos, claveIdempotencia: intento.clave, secretoReintento: intento.secreto, captchaToken: captcha }),
          signal: AbortSignal.timeout(25000),
        });
        const resultado = await response.json();
        if (!response.ok) {
          if (response.status === 409 && resultado.codigo === "FECHA_FUERA_DE_OPCIONES") {
            // Rechazo definitivo anterior al registro: permitir corregir solo la fecha.
            sessionStorage.removeItem(CLAVE_BORRADOR);
            setPendienteDatos(null);
            setForm({ ...recuperarContacto(datos), fecha: "" });
            setFechas([]);
            if (await cargarFechas()) setError("La fecha elegida ya no está disponible. Selecciona una nueva fecha de entrega.");
            return;
          }
          // 4xx confirma rechazo. Un 503 o fallo de red conserva el mismo intento y payload.
          if ([400,409,415,422,429].includes(response.status)) { sessionStorage.removeItem(CLAVE_BORRADOR); setPendienteDatos(null); }
          setError(typeof resultado.error === "string" ? resultado.error : "No pudimos registrar la solicitud. Vuelve a intentar.");
          return;
        }
        const respuesta = respuestaSolicitud.parse(resultado.solicitud);
        // Mostrar éxito incluso si después falla el almacenamiento; no volver a enviar en esta vista.
        setConfirmada({ datos, respuesta });
        guardarRespuesta(localStorage, huella, intento, respuesta);
      });
    } catch { setError("No pudimos verificar el resultado. Conservamos el mismo intento: completa la verificación y pulsa Reintentar solicitud."); }
    finally { setEnviando(false); enviandoRef.current = false; setCaptcha(""); setResetCaptcha((n) => n + 1); }
  }

  if (!isHydrated) return <p role="status">Cargando tu carrito…</p>;
  if (confirmada) {
    const enlace = enlaceSolicitud(confirmada.datos, confirmada.respuesta);
    return <section className="mx-auto max-w-2xl rounded-3xl border border-primary/20 bg-card p-6 sm:p-10">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check aria-hidden="true" className="size-7" /></div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-primary">Solicitud recibida</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ahora conversemos por WhatsApp</h1>
      <p className="mt-3 leading-7 text-muted-foreground">Tu solicitud quedó registrada. Hidro Leufú debe revisar disponibilidad, entrega y total antes de confirmar el pedido.</p>
      <div className="mt-6 rounded-2xl bg-muted/50 p-4"><p className="break-all font-mono text-sm">{confirmada.respuesta.codigo}</p><p className="mt-2 text-sm">{formatFechaEntregaLarga(confirmada.respuesta.fecha_solicitada)} · {formatCLP(confirmada.respuesta.total)} referenciales</p></div>
      <Button render={<a href={enlace} target="_blank" rel="noopener noreferrer" />} className="mt-6 w-full bg-[#167647] text-white hover:bg-[#115c37]" size="lg"><MessageCircle aria-hidden="true" />Abrir WhatsApp<ExternalLink aria-hidden="true" className="size-4" /></Button>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Abrir WhatsApp no envía el mensaje automáticamente. Revisa el texto y pulsa Enviar en WhatsApp. Esta solicitud aún no es un pedido oficialmente aceptado.</p>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Ver productos registrados</summary><ul className="mt-2 space-y-2">{confirmada.respuesta.items.map((i,n) => <li key={n}>{i.producto} · {i.presentacion} · {i.cantidad} × {formatCLP(i.precio_unitario)}</li>)}</ul></details>
      <PublicLink href={ROUTES.catalog} className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary">Volver al catálogo</PublicLink>
    </section>;
  }
  if (!items.length && !pendienteDatos) return <section className="rounded-2xl border p-8"><h1 className="text-2xl font-semibold">Agrega productos a tu carrito</h1><PublicLink href={ROUTES.catalog} className="mt-4 inline-block text-primary">Ver catálogo</PublicLink></section>;
  return <div className="mx-auto max-w-5xl">
    <PublicLink href={ROUTES.cart} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Volver al carrito</PublicLink>
    <header className="mb-8 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-primary">A tu ritmo, sin crear una cuenta</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tu pedido comienza con una conversación</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">Déjanos tus datos y una fecha de entrega. Registraremos tu solicitud para que puedas coordinarla con nuestro equipo por WhatsApp.</p></header>
    <form onSubmit={enviar} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <fieldset disabled={enviando || !!pendienteDatos || !listo} className="space-y-5">
          <legend className="mb-5 text-lg font-semibold">Datos de contacto</legend>
          <label className="block text-sm font-medium" htmlFor="pp-nombre">Nombre del solicitante<input id="pp-nombre" autoComplete="name" required maxLength={160} className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          <label className="block text-sm font-medium" htmlFor="pp-telefono">Teléfono móvil chileno<input id="pp-telefono" type="tel" autoComplete="tel" required maxLength={40} placeholder="+56 9 1234 5678" className={input} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /><span className="mt-2 block text-xs font-normal text-muted-foreground">Te contactaremos para revisar la solicitud.</span></label>
          <label className="block text-sm font-medium" htmlFor="pp-localidad">Localidad<input id="pp-localidad" autoComplete="address-level2" required maxLength={160} className={input} value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} /></label>
          <label className="block text-sm font-medium" htmlFor="pp-fecha">Fecha de entrega solicitada<select id="pp-fecha" required className={input} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}><option value="">{cargandoFechas ? "Cargando fechas…" : "Selecciona una fecha"}</option>{(pendienteDatos && !fechas.includes(pendienteDatos.fecha) ? [pendienteDatos.fecha,...fechas] : fechas).map((fecha) => <option key={fecha} value={fecha}>{formatFechaEntregaLarga(fecha)}</option>)}</select></label>
          <p className="text-xs leading-5 text-muted-foreground">Mostramos las próximas tres fechas habilitadas por Hidro Leufú. Los horarios se evalúan en America/Santiago.</p>
          <label className="block text-sm font-medium" htmlFor="pp-observaciones">Observaciones <span className="font-normal text-muted-foreground">(opcional)</span><textarea id="pp-observaciones" rows={4} maxLength={1800} className={input} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></label>
        </fieldset>
        {!cargandoFechas && !fechas.length && !pendienteDatos ? <Button type="button" variant="outline" onClick={() => void cargarFechas()} className="mt-4">Volver a cargar fechas</Button> : null}
        {pendienteDatos ? <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">Conservamos los datos del intento anterior para evitar duplicados. Reintenta esta misma solicitud para comprobar su resultado.</p> : null}
        <div className="mt-6"><TurnstileCaptcha onTokenChange={setCaptcha} resetSignal={resetCaptcha} /></div>
        <Button type="submit" size="lg" disabled={!listo || enviando || !captcha || (!pendienteDatos && (cargandoFechas || !fechas.includes(form.fecha)))} className="mt-5 w-full bg-[#167647] text-white hover:bg-[#115c37]"><MessageCircle aria-hidden="true" />{enviando ? "Registrando solicitud…" : pendienteDatos ? "Reintentar solicitud" : "Registrar y continuar por WhatsApp"}</Button>
        {error ? <p role="alert" className="mt-4 text-sm leading-6 text-destructive">{error}</p> : null}
        <p className="mt-4 flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />No se realizará ningún cobro. La solicitud requiere confirmación de nuestro equipo.</p>
      </section>
      <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6"><h2 className="text-lg font-semibold">Resumen referencial</h2>{pendienteDatos ? <p className="mt-4 text-sm leading-6 text-muted-foreground">Se verificará el intento guardado con {pendienteDatos.items.length} presentaciones. Los importes registrados se mostrarán al recuperar la respuesta del servidor.</p> : <><ul className="mt-4 divide-y divide-border">{items.map((i) => <li key={i.presentacionId} className="py-3"><p className="text-sm font-medium">{i.nombre}</p><div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"><span>{i.presentacionNombre} · {i.cantidad} {i.unidad}</span><span>{formatCLP(Math.round(i.cantidad*i.precioFinalReferencia))}</span></div></li>)}</ul><dl className="mt-4 space-y-3 border-t pt-4 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCLP(cotizacion.subtotal)}</dd></div><div className="flex justify-between"><dt>Despacho</dt><dd>{formatCLP(cotizacion.costoEntrega)}</dd></div><div className="flex justify-between border-t pt-3 text-lg font-semibold"><dt>Total estimado</dt><dd>{formatCLP(cotizacion.totalEstimado)}</dd></div></dl></>}<p className="mt-4 text-xs leading-6 text-muted-foreground">El servidor valida precios y disponibilidad al registrar. Compartirás el resumen por WhatsApp; el envío del mensaje depende de ti.</p></aside>
    </form>
  </div>;
}
