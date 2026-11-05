"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cargarFichaComercial, guardarFichaComercial } from "@/app/(admin)/admin/clientes/comercial-actions";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { CustomerAddressMap, type AddressCoordinates } from "@/components/account/customer-address-map";
import { campoDireccion } from "@/components/account/address-form-styles";
import { documentoComercialSchema } from "@/lib/admin/cliente-comercial-contrato";
import type { ClienteComercial, DireccionComercial, DocumentoComercial, EstadoComercial, FichaComercial } from "@/lib/admin/cliente-comercial-contrato";

type Props = { clienteId?: string; zonas: readonly { id: string; nombre: string }[]; posible?: { id: string; version: number; nombre: string; telefono: string } };
const vacio: ClienteComercial = { nombre: "", telefono: null, email: null, observaciones: null, activo: true };
const camposDireccion = [ ["nombre", "Nombre de dirección (opcional)"], ["destinatario", "Destinatario (opcional)"], ["telefono_contacto", "Teléfono de contacto (opcional)"], ["direccion", "Dirección"], ["comuna", "Comuna"], ["region", "Región (opcional)"], ["referencia", "Referencia (opcional)"] ] as const;

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
  const [direccionEscrita, setDireccionEscrita] = useState("");
  const [comuna, setComuna] = useState("");
  const [ubicacionRapida, setUbicacionRapida] = useState<AddressCoordinates>({ latitude: null, longitude: null });
  const [mapaAbierto, setMapaAbierto] = useState<number | "rapida" | null>(null);
  const [direcciones, setDirecciones] = useState<DireccionComercial[]>(ficha?.direcciones ?? []);
  const [estado, setEstado] = useState<EstadoComercial>({});
  const [confirmado, setConfirmado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const documento = useRef<DocumentoComercial | null>(null);
  const bloqueado = pendiente || !!estado.incierto || !!estado.clienteId || !!estado.conflicto;
  function cambiar() { setEstado({}); setConfirmado(false); documento.current = null; }
  function direccion(indice: number, cambios: Partial<DireccionComercial>) {
    if (["direccion", "comuna", "region"].some((campo) => campo in cambios)) setMapaAbierto(null);
    cambiar(); setDirecciones((previas) => previas.map((d, i) => i === indice ? { ...d, ...cambios } : cambios.es_principal ? { ...d, es_principal: false } : d));
  }
  return <form className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6" onSubmit={(e) => {
    e.preventDefault();
    if (pendiente || estado.conflicto || estado.clienteId) return;
    if (!documento.current) {
      const validado = documentoComercialSchema.safeParse({ clave: crypto.randomUUID(), clienteId: ficha?.cliente.id ?? null, revision: ficha?.revision ?? null,
        cliente: ficha ? cliente : { ...cliente, telefono: `+569${celular}`, activo: true }, direcciones: ficha && soloDirecciones ? direcciones : [],
        ...(!ficha ? { direccionRapida: direccionEscrita.trim() || comuna.trim() ? { direccion: direccionEscrita, comuna, latitud: ubicacionRapida.latitude, longitud: ubicacionRapida.longitude } : null } : {}),
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
    <h2 className="text-xl font-semibold">{soloDirecciones ? "Gestionar direcciones comerciales" : ficha ? "Editar ficha comercial" : posible ? "Crear y asociar cliente" : "Crear ficha comercial"}</h2>
    <fieldset disabled={bloqueado} className="space-y-5">
      {!ficha ? <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre comercial<input required maxLength={200} className={campoDireccion} value={cliente.nombre} onChange={(e) => { cambiar(); setCliente({ ...cliente, nombre: e.target.value }); }} /></label>
        <label className="text-sm font-medium">Celular chileno<span className="flex items-center gap-2"><span>+569</span><input required type="tel" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} title="Ingresa exactamente 8 dígitos después de +569." aria-label="Ocho dígitos del celular después de +569" className={campoDireccion} value={celular} onChange={(e) => { cambiar(); setCelular(e.target.value); }} /></span></label>
        <label className="text-sm font-medium">Dirección escrita (opcional)<input maxLength={1000} className={campoDireccion} value={direccionEscrita} onChange={(e) => { cambiar(); setDireccionEscrita(e.target.value); setUbicacionRapida({ latitude: null, longitude: null }); setMapaAbierto(null); }} /></label>
        <label className="text-sm font-medium">Comuna{direccionEscrita.trim() ? " (obligatoria)" : " (solo si ingresas dirección)"}<input required={!!direccionEscrita.trim()} maxLength={1000} className={campoDireccion} value={comuna} onChange={(e) => { cambiar(); setComuna(e.target.value); setUbicacionRapida({ latitude: null, longitude: null }); setMapaAbierto(null); }} /></label>
        <div className="space-y-3 sm:col-span-2">
          <p role="status" className="text-sm text-muted-foreground">{ubicacionRapida.latitude === null || ubicacionRapida.longitude === null ? "Sin ubicación confirmada. Selecciona un punto en el mapa; si cambias la dirección o comuna, debes seleccionarlo de nuevo." : `Ubicación seleccionada: ${ubicacionRapida.latitude}, ${ubicacionRapida.longitude}`}</p>
          <Button type="button" variant="outline" disabled={!direccionEscrita.trim() || !comuna.trim()} onClick={() => setMapaAbierto(mapaAbierto === "rapida" ? null : "rapida")}>{mapaAbierto === "rapida" ? "Cerrar mapa" : "Seleccionar ubicación en el mapa"}</Button>
          {!bloqueado && mapaAbierto === "rapida" && <CustomerAddressMap {...ubicacionRapida} onCoordinatesChange={(coordinates) => { cambiar(); setUbicacionRapida(coordinates); }} />}
          {ubicacionRapida.latitude !== null && <Button type="button" variant="outline" onClick={() => { cambiar(); setUbicacionRapida({ latitude: null, longitude: null }); setMapaAbierto(null); }}>Retirar ubicación</Button>}
        </div>
      </div> : <>
      {!soloDirecciones && <><div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre<input required maxLength={200} className={campoDireccion} value={cliente.nombre} onChange={(e) => { cambiar(); setCliente({ ...cliente, nombre: e.target.value }); }} /></label>
        <label className="text-sm font-medium">Teléfono (con código de país)<input type="tel" maxLength={100} className={campoDireccion} value={cliente.telefono ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, telefono: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Email (opcional)<input type="email" maxLength={254} className={campoDireccion} value={cliente.email ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, email: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Observaciones<textarea maxLength={4000} className={campoDireccion + " h-24 py-3"} value={cliente.observaciones ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, observaciones: e.target.value || null }); }} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={cliente.activo} onChange={(e) => { cambiar(); setCliente({ ...cliente, activo: e.target.checked }); }} />Cliente activo</label></>}
      {soloDirecciones && <><h3 className="font-semibold">Direcciones comerciales ({direcciones.length}/50)</h3>
      {direcciones.map((d, i) => <section key={d.id ?? `nueva-${i}`} className="space-y-4 rounded-xl border p-4" aria-label={`Dirección ${i + 1}`}>
        <div className="grid gap-5 sm:grid-cols-2">{camposDireccion.map(([campo, etiqueta]) => <label key={campo} className="text-sm font-medium">{etiqueta}<input required={["direccion", "comuna"].includes(campo)} type={campo === "telefono_contacto" ? "tel" : "text"} maxLength={campo === "telefono_contacto" ? 100 : 1000} className={campoDireccion} value={d[campo] ?? ""} onChange={(e) => direccion(i, { [campo]: e.target.value || null, ...(["direccion", "comuna", "region"].includes(campo) ? { latitud: null, longitud: null } : {}) })} /></label>)}
          <label className="text-sm font-medium">Zona (opcional)<select className={campoDireccion} value={d.zona_entrega_id ?? ""} onChange={(e) => direccion(i, { zona_entrega_id: e.target.value || null })}><option value="">Sin zona</option>{d.zona_entrega_id && !zonas.some((z) => z.id === d.zona_entrega_id) && <option value={d.zona_entrega_id}>Zona inactiva: selecciona otra o sin zona</option>}{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={d.activa} onChange={(e) => direccion(i, { activa: e.target.checked, ...(!e.target.checked ? { es_principal: false } : {}) })} />Dirección activa</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!d.activa} checked={d.es_principal} onChange={(e) => direccion(i, { es_principal: e.target.checked })} />Principal comercial</label>
        <p role="status" className="text-sm text-muted-foreground">{d.latitud === null || d.longitud === null ? "Sin ubicación confirmada. Selecciona un punto en el mapa; si cambias la dirección, comuna o región, debes seleccionarlo de nuevo." : `Ubicación seleccionada: ${d.latitud}, ${d.longitud}`}</p>
        <Button type="button" variant="outline" onClick={() => setMapaAbierto(mapaAbierto === i ? null : i)}>{mapaAbierto === i ? "Cerrar mapa" : "Seleccionar ubicación en el mapa"}</Button>
        {!bloqueado && mapaAbierto === i && <CustomerAddressMap latitude={d.latitud} longitude={d.longitud} onCoordinatesChange={({ latitude, longitude }) => direccion(i, { latitud: latitude, longitud: longitude })} />}
        {d.latitud !== null && <Button type="button" variant="outline" onClick={() => { direccion(i, { latitud: null, longitud: null }); setMapaAbierto(null); }}>Retirar coordenadas</Button>}
        {!d.id && <Button type="button" variant="ghost" onClick={() => { cambiar(); setMapaAbierto(null); setDirecciones(direcciones.filter((_, n) => n !== i)); }}>Quitar dirección nueva</Button>}
      </section>)}
      <Button type="button" variant="outline" disabled={direcciones.length >= 50} onClick={() => { cambiar(); setDirecciones([...direcciones, { id: null, nombre: null, destinatario: null, telefono_contacto: null, direccion: "", comuna: "", region: null, zona_entrega_id: null, referencia: null, latitud: null, longitud: null, es_principal: !direcciones.some((d) => d.es_principal), activa: true }]); }}>Agregar dirección comercial</Button></>}
      </>}
    </fieldset>
    {!!estado.coincidencias?.length && <div className="space-y-3 rounded-lg border p-4"><p className="text-sm font-medium">Hay clientes con el mismo teléfono o email, incluidos inactivos. No se fusionarán automáticamente.</p><ul className="space-y-2 text-sm">{estado.coincidencias.map((c) => <li key={c.cliente_id}><Link className="text-primary underline" href={`/admin/clientes/${c.cliente_id}`} target="_blank" rel="noopener noreferrer">{c.nombre}</Link> · { [c.por_telefono && "teléfono", c.por_email && "email"].filter(Boolean).join(" y ")}</li>)}</ul>{!estado.clienteId && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Revisé las coincidencias y confirmo crear una ficha independiente.</label>}</div>}
    {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
    {estado.clienteId ? <p role="status" className="text-sm text-primary">Cliente guardado{posible ? " y asociado a la solicitud" : ""}. <Link className="underline" href={`/admin/clientes/${estado.clienteId}`}>Ver ficha</Link></p> : <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…" disabled={!!estado.conflicto || (!!estado.confirmacion && !confirmado)}>{estado.incierto ? "Reintentar el mismo guardado" : soloDirecciones ? "Guardar direcciones comerciales" : "Guardar cliente"}</PendingButton>}
    {(estado.conflicto || estado.incierto) && <Button type="button" variant="outline" onClick={() => window.location.reload()}>Recargar y revisar estado</Button>}
    {!estado.incierto && <Button type="button" variant="ghost" disabled={pendiente} onClick={cerrar}>Cerrar formulario</Button>}
  </form>;
}

export function CustomerCommercialAddresses({ ficha, zonas }: { ficha: FichaComercial; zonas: Props["zonas"] }) {
  const [editando, setEditando] = useState(false);
  return <section className="space-y-4" aria-labelledby="direcciones-comerciales-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="direcciones-comerciales-title" className="text-2xl font-semibold tracking-tight">Direcciones comerciales</h2>
      {!editando && <Button type="button" variant="secondary" onClick={() => setEditando(true)}>Añadir o editar direcciones</Button>}
    </div>
    <p className="text-sm text-muted-foreground">Direcciones de uso administrativo. Solo dirección escrita y comuna son obligatorias.</p>
    {ficha.direcciones.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Sin direcciones comerciales registradas.</p> : <div className="grid gap-4 sm:grid-cols-2">{ficha.direcciones.map((d) => <article key={d.id} className="space-y-3 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-muted px-3 py-1">{d.activa ? "Activa" : "Inactiva"}</span>{d.es_principal && <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">Principal comercial</span>}</div>
      <address className="break-words not-italic"><p className="font-medium">{d.direccion}</p><p className="mt-1 text-sm text-muted-foreground">{[d.comuna, d.region].filter(Boolean).join(" · ")}</p></address>
      <p className="text-sm text-muted-foreground">{d.latitud === null || d.longitud === null ? "Pendiente de ubicación" : "Ubicación registrada"} · {d.zona_entrega_id ? "Zona asignada" : "Pendiente de zona"}</p>
    </article>)}</div>}
    {editando && <Formulario ficha={ficha} zonas={zonas} soloDirecciones cerrar={() => setEditando(false)} />}
  </section>;
}
