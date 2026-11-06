"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cargarFichaComercial, guardarFichaComercial } from "@/app/(admin)/admin/clientes/comercial-actions";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { CustomerAddressMap, type AddressCoordinates } from "@/components/account/customer-address-map";
import { CommercialLocationSearch } from "@/components/admin/commercial-location-search";
import { campoDireccion } from "@/components/account/address-form-styles";
import { documentoComercialSchema } from "@/lib/admin/cliente-comercial-contrato";
import type { ClienteComercial, DireccionComercial, DocumentoComercial, EstadoComercial, FichaComercial } from "@/lib/admin/cliente-comercial-contrato";

type Props = { clienteId?: string; zonas: readonly { id: string; nombre: string }[]; posible?: { id: string; version: number; nombre: string; telefono: string } };
const vacio: ClienteComercial = { nombre: "", telefono: null, email: null, observaciones: null, activo: true };
function nuevaDireccion(es_principal: boolean): DireccionComercial {
  return { id: null, nombre_ubicacion: null, nombre: null, destinatario: null, telefono_contacto: null, direccion: null, comuna: null, region: null, zona_entrega_id: null, referencia: null, latitud: null, longitud: null, es_principal, activa: true };
}
const camposDireccion = [ ["nombre_ubicacion", "Nombre de ubicación"], ["destinatario", "Destinatario (opcional)"], ["telefono_contacto", "Teléfono de contacto (opcional)"], ["region", "Región (opcional)"], ["referencia", "Referencia (opcional)"] ] as const;

function ResumenUbicacion({ ubicacion: d, indice, provisional = false }: { ubicacion: DireccionComercial; indice: number; provisional?: boolean }) {
  const confirmada = d.latitud !== null && d.longitud !== null;
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
      <span className="text-muted-foreground">Ubicación {indice + 1}</span>
      {d.es_principal && <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">Principal comercial</span>}
      <span className="rounded-full bg-muted px-3 py-1">{d.activa ? "Activa" : "Inactiva"}</span>
    </div>
    <h4 className="break-words text-lg font-semibold leading-snug">{d.nombre_ubicacion || d.nombre || d.direccion || `Ubicación ${indice + 1}`}</h4>
    {(d.direccion || d.comuna || d.region) && <address className="space-y-1 break-words text-sm not-italic text-muted-foreground">
      {d.direccion && <p>{d.direccion}</p>}
      {(d.comuna || d.region) && <p>{[d.comuna, d.region].filter(Boolean).join(" · ")}</p>}
    </address>}
    <div role="status" className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{provisional ? "Marcador pendiente de confirmación" : confirmada ? "Geolocalización confirmada" : "Ubicación pendiente de geolocalizar"}</p>
      {confirmada && <p className="break-words font-mono text-xs text-muted-foreground">Coordenadas confirmadas: {d.latitud!.toFixed(6)}, {d.longitud!.toFixed(6)}</p>}
      {provisional && <p className="text-muted-foreground">Confirma el punto provisional en el mapa antes de guardar.</p>}
      {!confirmada && !provisional && <p className="text-muted-foreground">{d.id ? "Puedes conservar los datos actuales o confirmar un punto en el mapa." : "Selecciona y confirma un punto en el mapa antes de guardar."}</p>}
    </div>
  </div>;
}

export function CustomerCommercialForm(props: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ficha, setFicha] = useState<FichaComercial>();
  const [error, setError] = useState("");
  const [cargando, iniciar] = useTransition();
  return <div className="space-y-3">
    <Button type="button" variant="secondary" disabled={cargando} onClick={() => iniciar(async () => {
      setError("");
      try { if (props.clienteId) setFicha(await cargarFichaComercial(props.clienteId)); setAbierto(true); }
      catch { setError("No fue posible cargar la ficha comercial. Revisa tu sesión y vuelve a intentar."); }
    })}>{cargando ? "Cargando…" : props.clienteId ? "Editar cliente" : props.posible ? "Crear y asociar cliente" : "Crear cliente"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {abierto && <Formulario key={ficha?.revision ?? "nuevo"} {...props} ficha={ficha} cerrar={() => setAbierto(false)} />}
  </div>;
}

function Formulario({ ficha, zonas, posible, cerrar, soloDirecciones = false }: Props & { ficha?: FichaComercial; cerrar: () => void; soloDirecciones?: boolean }) {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteComercial>(() => ficha ? { nombre: ficha.cliente.nombre, telefono: ficha.cliente.telefono, email: ficha.cliente.email, observaciones: ficha.cliente.observaciones, activo: ficha.cliente.activo } : { ...vacio, nombre: posible?.nombre ?? "", telefono: posible?.telefono ?? null });
  const [celular, setCelular] = useState(() => {
    const original = posible?.telefono ?? "";
    const digitos = original.replace(/\D/g, "");
    return /^569[0-9]{8}$/.test(digitos) ? digitos.slice(3) : /^9[0-9]{8}$/.test(digitos) ? digitos.slice(1) : original;
  });
  const [mapaAbierto, setMapaAbierto] = useState<number | null>(null);
  const [direcciones, setDirecciones] = useState<DireccionComercial[]>(() => ficha?.direcciones ?? [nuevaDireccion(true)]);
  const [ubicacionesProvisionales, setUbicacionesProvisionales] = useState<Record<number, AddressCoordinates>>({});
  const hayUbicacionesProvisionales = Object.keys(ubicacionesProvisionales).length > 0;
  const [estado, setEstado] = useState<EstadoComercial>({});
  const [confirmado, setConfirmado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const documento = useRef<DocumentoComercial | null>(null);
  const bloqueado = pendiente || !!estado.incierto || !!estado.clienteId || !!estado.conflicto;
  function cambiar() { setEstado({}); setConfirmado(false); documento.current = null; }
  function descartarUbicacionProvisional(indice: number) {
    setUbicacionesProvisionales((previas) => {
      const siguientes = { ...previas };
      delete siguientes[indice];
      return siguientes;
    });
  }
  function direccion(indice: number, cambios: Partial<DireccionComercial>) {
    if ("latitud" in cambios || "longitud" in cambios) descartarUbicacionProvisional(indice);
    cambiar(); setDirecciones((previas) => previas.map((d, i) => i === indice ? { ...d, ...cambios } : cambios.es_principal ? { ...d, es_principal: false } : d));
  }
  return <form className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-3 sm:p-6" onSubmit={(e) => {
    e.preventDefault();
    if (pendiente || estado.conflicto || estado.clienteId) return;
    if (hayUbicacionesProvisionales) { setEstado({ error: "Confirma el punto provisional de cada ubicación antes de guardar." }); return; }
    if (!documento.current) {
      const validado = documentoComercialSchema.safeParse({ clave: crypto.randomUUID(), clienteId: ficha?.cliente.id ?? null, revision: ficha?.revision ?? null,
        cliente: ficha ? cliente : { ...cliente, telefono: `+569${celular}`, activo: true }, direcciones: !ficha || soloDirecciones ? direcciones : [],
        posibleId: posible?.id ?? null, version: posible?.version ?? null });
      if (!validado.success) { setEstado({ error: validado.error.issues[0]?.message ?? "Revisa los datos." }); return; }
      documento.current = validado.data;
    }
    const datos = documento.current;
    iniciar(async () => {
      try {
        const resultado = await guardarFichaComercial(datos, confirmado ? estado.confirmacion : undefined);
        setEstado(resultado);
        if (resultado.clienteId) router.refresh();
      } catch { setEstado({ error: "No se pudo confirmar el resultado. Reintenta sin cambiar los datos.", incierto: true }); }
    });
  }}>
    <h2 className="text-xl font-semibold">{soloDirecciones ? "Gestionar ubicaciones comerciales" : ficha ? "Editar ficha comercial" : posible ? "Crear y asociar cliente" : "Crear ficha comercial"}</h2>
    <fieldset disabled={bloqueado} className="space-y-5">
      {!ficha ? <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre comercial<input required maxLength={200} className={campoDireccion} value={cliente.nombre} onChange={(e) => { cambiar(); setCliente({ ...cliente, nombre: e.target.value }); }} /></label>
        <label className="text-sm font-medium">Celular chileno<span className="flex items-center gap-2"><span>+569</span><input required type="tel" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} title="Ingresa exactamente 8 dígitos después de +569." aria-label="Ocho dígitos del celular después de +569" className={campoDireccion} value={celular} onChange={(e) => { cambiar(); setCelular(e.target.value); }} /></span></label>
      </div> : <>
      {!soloDirecciones && <><div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre<input required maxLength={200} className={campoDireccion} value={cliente.nombre} onChange={(e) => { cambiar(); setCliente({ ...cliente, nombre: e.target.value }); }} /></label>
        <label className="text-sm font-medium">Teléfono (con código de país)<input type="tel" maxLength={100} className={campoDireccion} value={cliente.telefono ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, telefono: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Email (opcional)<input type="email" maxLength={254} className={campoDireccion} value={cliente.email ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, email: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Observaciones<textarea maxLength={4000} className={campoDireccion + " h-24 py-3"} value={cliente.observaciones ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, observaciones: e.target.value || null }); }} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={cliente.activo} onChange={(e) => { cambiar(); setCliente({ ...cliente, activo: e.target.checked }); }} />Cliente activo</label></>}
      </>}
      {(!ficha || soloDirecciones) && <><div className="space-y-1"><h3 className="font-semibold">Ubicaciones comerciales <span className="text-sm font-normal text-muted-foreground">{direcciones.length}/50</span></h3><p className="text-sm text-muted-foreground">Identifica cada ubicación por su nombre y confirma su punto en el mapa. Solo una puede ser principal.</p></div>
      {direcciones.map((d, i) => <section key={d.id ?? `nueva-${i}`} className="min-w-0 space-y-4 rounded-xl border border-border bg-background p-3 sm:p-5" aria-label={d.nombre_ubicacion || `Ubicación ${i + 1}`}>
        <ResumenUbicacion ubicacion={d} indice={i} provisional={!!ubicacionesProvisionales[i]} />
        {d.id && !d.nombre_ubicacion && <p className="text-sm text-muted-foreground">Ubicación histórica: {[d.nombre, d.direccion, d.comuna].filter(Boolean).join(" · ")}. Puedes conservarla sin asignar nombre ni coordenadas todavía.</p>}
        <details open className="group rounded-lg border border-border" onInvalidCapture={(event) => { event.currentTarget.open = true; }}>
        <summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Editar ubicación</summary>
        <div className="space-y-4 border-t border-border p-3 sm:p-4">
        <div className="grid gap-5 sm:grid-cols-2">{camposDireccion.map(([campo, etiqueta]) => <label key={campo} className="text-sm font-medium">{etiqueta}<input required={campo === "nombre_ubicacion" && (!d.id || d.nombre_ubicacion !== null)} type={campo === "telefono_contacto" ? "tel" : "text"} maxLength={campo === "telefono_contacto" ? 100 : 1000} className={campoDireccion} value={d[campo] ?? ""} onChange={(e) => direccion(i, { [campo]: e.target.value || null })} /></label>)}
          <label className="text-sm font-medium">Zona (opcional)<select className={campoDireccion} value={d.zona_entrega_id ?? ""} onChange={(e) => direccion(i, { zona_entrega_id: e.target.value || null })}><option value="">Sin zona</option>{d.zona_entrega_id && !zonas.some((z) => z.id === d.zona_entrega_id) && <option value={d.zona_entrega_id}>Zona inactiva: selecciona otra o sin zona</option>}{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={d.activa} onChange={(e) => direccion(i, { activa: e.target.checked, ...(!e.target.checked ? { es_principal: false } : {}) })} />Ubicación activa</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!d.activa} checked={d.es_principal} onChange={(e) => direccion(i, { es_principal: e.target.checked })} />Principal comercial</label>
        </div>
        </details>
        <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal px-3 py-2 sm:w-auto" aria-expanded={mapaAbierto === i} onClick={() => setMapaAbierto(mapaAbierto === i ? null : i)}>{mapaAbierto === i ? "Cerrar mapa" : "Marcar o ajustar en el mapa"}</Button>
        {!bloqueado && mapaAbierto === i && <CustomerAddressMap
          renderLocationSearch={(onSelect) => <CommercialLocationSearch onSelect={onSelect} />}
          latitude={ubicacionesProvisionales[i] ? ubicacionesProvisionales[i].latitude : d.latitud}
          longitude={ubicacionesProvisionales[i] ? ubicacionesProvisionales[i].longitude : d.longitud}
          requireConfirmation
          locationConfirmed={!ubicacionesProvisionales[i] && d.latitud !== null && d.longitud !== null}
          onCoordinatesChange={(coordinates) => {
            cambiar();
            setUbicacionesProvisionales((previas) => ({ ...previas, [i]: coordinates }));
          }}
          onConfirmLocation={({ latitude, longitude }) => {
            if (latitude === null || longitude === null) { setEstado({ error: "Selecciona un punto válido antes de confirmar." }); return; }
            direccion(i, { latitud: latitude, longitud: longitude });
          }}
        />}
        {!d.id && <Button type="button" variant="ghost" onClick={() => { cambiar(); setMapaAbierto(null); setDirecciones(direcciones.filter((_, n) => n !== i)); setUbicacionesProvisionales((previas) => {
          const siguientes: Record<number, AddressCoordinates> = {};
          for (const [indice, coordinates] of Object.entries(previas)) {
            const n = Number(indice);
            if (n !== i) siguientes[n > i ? n - 1 : n] = coordinates;
          }
          return siguientes;
        }); }}>Quitar ubicación nueva</Button>}
      </section>)}
      <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={direcciones.length >= 50} onClick={() => { cambiar(); setDirecciones((previas) => previas.length >= 50 ? previas : [...previas, nuevaDireccion(!previas.some((d) => d.es_principal))]); }}>Agregar ubicación</Button></>}
    </fieldset>
    {!!estado.coincidencias?.length && <div className="space-y-3 rounded-lg border p-4"><p className="text-sm font-medium">Hay clientes con el mismo teléfono o email, incluidos inactivos. No se fusionarán automáticamente.</p><ul className="space-y-2 text-sm">{estado.coincidencias.map((c) => <li key={c.cliente_id}><Link className="text-primary underline" href={`/admin/clientes/${c.cliente_id}`} target="_blank" rel="noopener noreferrer">{c.nombre}</Link> · { [c.por_telefono && "teléfono", c.por_email && "email"].filter(Boolean).join(" y ")}</li>)}</ul>{!estado.clienteId && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Revisé las coincidencias y confirmo crear una ficha independiente.</label>}</div>}
    {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
    {estado.clienteId ? <p role="status" className="text-sm text-primary">Cliente guardado{posible ? " y asociado a la solicitud" : ""}. <Link className="underline" href={`/admin/clientes/${estado.clienteId}`}>Ver ficha</Link></p> : <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…" disabled={hayUbicacionesProvisionales || !!estado.conflicto || (!!estado.confirmacion && !confirmado)}>{estado.incierto ? "Reintentar el mismo guardado" : soloDirecciones ? "Guardar ubicaciones comerciales" : "Guardar cliente"}</PendingButton>}
    {(estado.conflicto || estado.incierto) && <Button type="button" variant="outline" onClick={() => window.location.reload()}>Recargar y revisar estado</Button>}
    {!estado.incierto && <Button type="button" variant="ghost" disabled={pendiente} onClick={cerrar}>Cerrar formulario</Button>}
  </form>;
}

export function CustomerCommercialAddresses({ ficha, zonas }: { ficha: FichaComercial; zonas: Props["zonas"] }) {
  const [editando, setEditando] = useState(false);
  return <section className="space-y-4" aria-labelledby="direcciones-comerciales-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="direcciones-comerciales-title" className="text-2xl font-semibold tracking-tight">Ubicaciones comerciales</h2>
      {!editando && <Button type="button" variant="secondary" onClick={() => setEditando(true)}>Agregar ubicación</Button>}
    </div>
    <p className="text-sm text-muted-foreground">Hasta 50 ubicaciones por cliente, con nombre único y punto confirmado en el mapa. Las ubicaciones históricas pueden conservar sus datos actuales.</p>
    {!editando && (ficha.direcciones.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Sin ubicaciones comerciales registradas.</p> : <div className="grid gap-4 sm:grid-cols-2">{ficha.direcciones.map((d, i) => <article key={d.id} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <ResumenUbicacion ubicacion={d} indice={i} />
      <p className="text-sm text-muted-foreground">{zonas.find((zona) => zona.id === d.zona_entrega_id)?.nombre ?? (d.zona_entrega_id ? "Zona asignada" : "Sin zona asignada")}</p>
      {!editando && <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditando(true)}>Editar ubicación</Button>}
    </article>)}</div>)}
    {editando && <Formulario ficha={ficha} zonas={zonas} soloDirecciones cerrar={() => setEditando(false)} />}
  </section>;
}
