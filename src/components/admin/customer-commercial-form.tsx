"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cargarFichaComercial, guardarFichaComercial } from "@/app/(admin)/admin/clientes/comercial-actions";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { campoDireccion } from "@/components/account/address-form-styles";
import type { ClienteComercial, DireccionComercial, DocumentoComercial, EstadoComercial, FichaComercial } from "@/lib/admin/cliente-comercial-contrato";

type Props = { clienteId?: string; zonas: readonly { id: string; nombre: string }[]; posible?: { id: string; version: number; nombre: string; telefono: string } };
const vacio: ClienteComercial = { nombre: "", telefono: null, email: null, observaciones: null, activo: true };
const camposDireccion = [ ["nombre", "Nombre de dirección"], ["destinatario", "Destinatario (opcional)"], ["telefono_contacto", "Teléfono de contacto"], ["direccion", "Dirección"], ["comuna", "Comuna"], ["region", "Región"], ["referencia", "Referencia (opcional)"] ] as const;

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

function Formulario({ ficha, zonas, posible, cerrar }: Props & { ficha?: FichaComercial; cerrar: () => void }) {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteComercial>(() => ficha ? { nombre: ficha.cliente.nombre, telefono: ficha.cliente.telefono, email: ficha.cliente.email, observaciones: ficha.cliente.observaciones, activo: ficha.cliente.activo } : { ...vacio, nombre: posible?.nombre ?? "", telefono: posible?.telefono ?? null });
  const [direcciones, setDirecciones] = useState<DireccionComercial[]>(ficha?.direcciones ?? []);
  const [estado, setEstado] = useState<EstadoComercial>({});
  const [confirmado, setConfirmado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const documento = useRef<DocumentoComercial | null>(null);
  const bloqueado = pendiente || !!estado.incierto || !!estado.clienteId || !!estado.conflicto;
  function cambiar() { setEstado({}); setConfirmado(false); documento.current = null; }
  function direccion(indice: number, cambios: Partial<DireccionComercial>) {
    cambiar(); setDirecciones((previas) => previas.map((d, i) => i === indice ? { ...d, ...cambios } : cambios.es_principal ? { ...d, es_principal: false } : d));
  }
  return <form className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6" onSubmit={(e) => {
    e.preventDefault();
    if (!documento.current) documento.current = { clave: crypto.randomUUID(), clienteId: ficha?.cliente.id ?? null, revision: ficha?.revision ?? null, cliente, direcciones, posibleId: posible?.id ?? null, version: posible?.version ?? null };
    const datos = documento.current;
    iniciar(async () => {
      try {
        const resultado = await guardarFichaComercial(datos, confirmado ? estado.confirmacion : undefined);
        setEstado(resultado);
        if (resultado.clienteId) router.refresh();
      } catch { setEstado({ error: "No se pudo confirmar el resultado. Reintenta sin cambiar los datos.", incierto: true }); }
    });
  }}>
    <h2 className="text-xl font-semibold">{ficha ? "Editar ficha comercial" : posible ? "Crear y asociar cliente" : "Crear ficha comercial"}</h2>
    <fieldset disabled={bloqueado} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre<input required maxLength={200} className={campoDireccion} value={cliente.nombre} onChange={(e) => { cambiar(); setCliente({ ...cliente, nombre: e.target.value }); }} /></label>
        <label className="text-sm font-medium">Teléfono (con código de país)<input type="tel" maxLength={100} className={campoDireccion} value={cliente.telefono ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, telefono: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Email (opcional)<input type="email" maxLength={254} className={campoDireccion} value={cliente.email ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, email: e.target.value || null }); }} /></label>
        <label className="text-sm font-medium">Observaciones<textarea maxLength={4000} className={campoDireccion + " h-24 py-3"} value={cliente.observaciones ?? ""} onChange={(e) => { cambiar(); setCliente({ ...cliente, observaciones: e.target.value || null }); }} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={cliente.activo} onChange={(e) => { cambiar(); setCliente({ ...cliente, activo: e.target.checked }); }} />Cliente activo</label>
      <h3 className="font-semibold">Direcciones ({direcciones.length}/50)</h3>
      {direcciones.map((d, i) => <section key={d.id ?? `nueva-${i}`} className="space-y-4 rounded-xl border p-4" aria-label={`Dirección ${i + 1}`}>
        <div className="grid gap-5 sm:grid-cols-2">{camposDireccion.map(([campo, etiqueta]) => <label key={campo} className="text-sm font-medium">{etiqueta}<input required={!["destinatario", "referencia"].includes(campo)} type={campo === "telefono_contacto" ? "tel" : "text"} maxLength={1000} className={campoDireccion} value={d[campo] ?? ""} onChange={(e) => direccion(i, { [campo]: e.target.value, ...(["direccion", "comuna", "region"].includes(campo) ? { latitud: null, longitud: null } : {}) })} /></label>)}
          <label className="text-sm font-medium">Zona (opcional)<select className={campoDireccion} value={d.zona_entrega_id ?? ""} onChange={(e) => direccion(i, { zona_entrega_id: e.target.value || null })}><option value="">Sin zona</option>{d.zona_entrega_id && !zonas.some((z) => z.id === d.zona_entrega_id) && <option value={d.zona_entrega_id}>Zona inactiva: selecciona otra o sin zona</option>}{zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</select></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={d.activa} onChange={(e) => direccion(i, { activa: e.target.checked, ...(!e.target.checked ? { es_principal: false } : {}) })} />Dirección activa</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!d.activa} checked={d.es_principal} onChange={(e) => direccion(i, { es_principal: e.target.checked })} />Dirección principal</label>
        {d.latitud === null || d.longitud === null || !d.zona_entrega_id ? <p className="text-sm text-amber-700 dark:text-amber-400">Dirección pendiente de geolocalización: no apta para conversión oficial ni rutas hasta completar coordenadas y zona.</p> : <p className="text-sm text-muted-foreground">Coordenadas guardadas: {d.latitud}, {d.longitud}. Se conservan al guardar. Al cambiar dirección, comuna o región se retirarán para dejarla pendiente.</p>}
        {d.latitud !== null && <Button type="button" variant="outline" onClick={() => direccion(i, { latitud: null, longitud: null })}>Retirar coordenadas</Button>}
        {!d.id && <Button type="button" variant="ghost" onClick={() => { cambiar(); setDirecciones(direcciones.filter((_, n) => n !== i)); }}>Quitar dirección nueva</Button>}
      </section>)}
      <Button type="button" variant="outline" disabled={direcciones.length >= 50} onClick={() => { cambiar(); setDirecciones([...direcciones, { id: null, nombre: "", destinatario: null, telefono_contacto: cliente.telefono ?? "", direccion: "", comuna: "", region: "", zona_entrega_id: null, referencia: null, latitud: null, longitud: null, es_principal: !direcciones.some((d) => d.es_principal), activa: true }]); }}>Agregar dirección</Button>
    </fieldset>
    {!!estado.coincidencias?.length && <div className="space-y-3 rounded-lg border p-4"><p className="text-sm font-medium">Hay clientes con el mismo teléfono o email, incluidos inactivos. No se fusionarán automáticamente.</p><ul className="space-y-2 text-sm">{estado.coincidencias.map((c) => <li key={c.cliente_id}><Link className="text-primary underline" href={`/admin/clientes/${c.cliente_id}`} target="_blank" rel="noopener noreferrer">{c.nombre}</Link> · { [c.por_telefono && "teléfono", c.por_email && "email"].filter(Boolean).join(" y ")}</li>)}</ul>{!estado.clienteId && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Revisé las coincidencias y confirmo crear una ficha independiente.</label>}</div>}
    {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
    {estado.clienteId ? <p role="status" className="text-sm text-primary">Cliente guardado{posible ? " y asociado a la solicitud" : ""}. <Link className="underline" href={`/admin/clientes/${estado.clienteId}`}>Ver ficha</Link></p> : <PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…" disabled={!!estado.conflicto || (!!estado.confirmacion && !confirmado)}>{estado.incierto ? "Reintentar el mismo guardado" : "Guardar cliente"}</PendingButton>}
    {(estado.conflicto || estado.incierto) && <Button type="button" variant="outline" onClick={() => window.location.reload()}>Recargar y revisar estado</Button>}
    {!estado.incierto && <Button type="button" variant="ghost" disabled={pendiente} onClick={cerrar}>Cerrar formulario</Button>}
  </form>;
}
