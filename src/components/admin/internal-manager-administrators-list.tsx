"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { PendingButton } from "@/components/ui/pending-button";
import { actualizarPermisoAdministrador, buscarUsuariosAdministracion } from "./internal-manager-administrators-actions";
import { useInternalManagerUserSearch, type UsuarioGestorInterno } from "./internal-manager-user-search";

export type GestionAdministradores = {
  configurado: boolean;
  administradores: (UsuarioGestorInterno & { principal: boolean; propio: boolean })[];
};

function Identidad({ usuario }: { usuario: UsuarioGestorInterno }) {
  return <div className="min-w-0 flex-1">
    <p className="break-words text-sm font-medium">{usuario.nombre || "Sin nombre registrado"}</p>
    <p className="break-all text-xs text-muted-foreground">{usuario.correo || "Sin correo registrado"}</p>
    <p className="break-all text-xs text-muted-foreground">{usuario.usuario_id}</p>
  </div>;
}

function BotonPermiso({ activo, identidad }: { activo: boolean; identidad: string }) {
  const { pending } = useFormStatus();
  const etiqueta = activo ? "Conceder rol" : "Revocar rol";
  return <PendingButton type="submit" variant="outline" pending={pending} pendingLabel="Guardando…"
    aria-label={`${etiqueta} a ${identidad}`}>{etiqueta}</PendingButton>;
}

function PermisoAdministrador({ usuario, activo, onUpdated }: {
  usuario: UsuarioGestorInterno;
  activo: boolean;
  onUpdated: (activo: boolean) => void;
}) {
  const clave = useRef<string | null>(null);
  const [error, setError] = useState("");
  const identidad = usuario.correo || usuario.nombre || usuario.usuario_id;

  async function guardar() {
    setError("");
    try {
      clave.current ??= crypto.randomUUID();
      const resultado = await actualizarPermisoAdministrador({ usuario: usuario.usuario_id, activo, clave: clave.current });
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      clave.current = null;
      onUpdated(activo);
    } catch {
      setError("No se pudo confirmar el cambio. Revisa tu conexión e intenta nuevamente.");
    }
  }

  return <form action={guardar} onSubmit={event => {
    if (!window.confirm(`¿${activo ? "Conceder" : "Revocar"} el rol administrador a ${identidad}?`)) event.preventDefault();
  }}>
    <BotonPermiso activo={activo} identidad={identidad} />
    {error && <p role="alert" className="max-w-64 text-xs text-destructive">{error}</p>}
  </form>;
}

const resultadoVacio = { query: "", usuarios: [] as UsuarioGestorInterno[], error: "" };

export function InternalManagerAdministratorsList({ gestion }: { gestion: GestionAdministradores }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(resultadoVacio);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLHeadingElement>(null);
  const search = gestion.configurado ? query.trim() : "";
  const loading = search.length >= 2 && result.query !== search;
  const usuarios = result.usuarios.filter(u => !gestion.administradores.some(a => a.usuario_id === u.usuario_id));
  useInternalManagerUserSearch(search, retry, buscarUsuariosAdministracion, setResult);

  function refrescarBusqueda() {
    setResult(resultadoVacio);
    setRetry(value => value + 1);
  }

  function onUpdated(activo: boolean) {
    (activo ? input.current : lista.current)?.focus();
    setNotice(activo ? "Rol administrador concedido." : "Rol administrador revocado.");
    refrescarBusqueda();
  }

  return <div className="space-y-4">
    {gestion.configurado ? <section className="rounded-lg border border-border" aria-labelledby="buscar-administradores-title">
      <div className="space-y-2 p-3">
        <h3 id="buscar-administradores-title" className="text-sm font-semibold">Conceder rol administrador</h3>
        <label htmlFor="buscar-administradores" className="block text-sm">Buscar por nombre o correo</label>
        <input ref={input} id="buscar-administradores" type="search" value={query} maxLength={100}
          onChange={event => setQuery(event.target.value)} aria-describedby="buscar-administradores-status"
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
        <p id="buscar-administradores-status" role="status" className="text-xs text-muted-foreground">
          {search.length < 2 ? "Escribe al menos 2 caracteres para buscar cuentas registradas."
            : loading ? "Buscando usuarios…"
            : !result.error && (usuarios.length ? `${usuarios.length} coincidencias · Hasta 30 cuentas por búsqueda.` : "No hay usuarios disponibles que coincidan con la búsqueda.")}
        </p>
      </div>
      {search.length >= 2 && !loading && (result.error
        ? <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">{result.error}{" "}
          <button type="button" className="min-h-11 underline" onClick={refrescarBusqueda}>Reintentar</button></p>
        : usuarios.length > 0 && <ul aria-label="Usuarios encontrados" className="max-h-72 divide-y divide-border overflow-y-auto border-t">
          {usuarios.map(usuario => <li key={usuario.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <Identidad usuario={usuario} />
            <PermisoAdministrador usuario={usuario} activo onUpdated={onUpdated} />
          </li>)}
        </ul>)}
    </section> : <p role="status" className="rounded-lg border border-border p-3 text-sm">
      Confirma y configura el UUID del administrador principal para habilitar los cambios de rol.
    </p>}
    <p role="status" className="text-xs text-muted-foreground">{notice}</p>
    <section aria-labelledby="administradores-activos-title" className="space-y-2">
      <h3 ref={lista} tabIndex={-1} id="administradores-activos-title" className="text-sm font-semibold">Administradores activos</h3>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {gestion.administradores.map(usuario => <li key={usuario.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <Identidad usuario={usuario} />
          {usuario.propio && <span className="text-xs text-muted-foreground">Tu cuenta</span>}
          {usuario.principal && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Principal protegido</span>}
          {gestion.configurado && !usuario.principal && !usuario.propio &&
            <PermisoAdministrador usuario={usuario} activo={false} onUpdated={onUpdated} />}
        </li>)}
      </ul>
    </section>
  </div>;
}
