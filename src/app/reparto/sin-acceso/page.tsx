import Link from "next/link";
export default function SinAcceso() {
  return <main id="main-content" className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-bold">Reparto no disponible</h1><p>Tu cuenta no tiene permiso activo de repartidor. Contacta a administración.</p><Link className="underline" href="/iniciar-sesion?returnTo=%2Freparto">Iniciar sesión</Link></main>;
}
