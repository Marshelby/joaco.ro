import Link from "next/link";
import { Leaf, Sprout, Truck, Recycle } from "lucide-react";
import { ROUTES } from "@/config/routes";

const confianza = [
  { icon: Leaf, titulo: "14 años de experiencia", texto: "Abasteciendo a nuestros clientes." },
  { icon: Sprout, titulo: "Hidropónicos frescos", texto: "Una de nuestras principales especialidades." },
  { icon: Truck, titulo: "Abastecimiento confiable", texto: "Productos frescos para tu negocio." },
  { icon: Recycle, titulo: "Compromiso sustentable", texto: "Una forma más consciente de trabajar." },
];

export function B2bIntro() {
  return <><section className="px-1 py-1 sm:px-0"><h1 className="max-w-2xl text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Abastecimiento fresco para tu negocio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Seleccionamos productos frescos para restaurantes, comercios y empresas.</p><div className="mt-4 flex flex-wrap gap-3"><Link href={ROUTES.catalog} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Ver productos</Link><Link href="/iniciar-sesion" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Acceso clientes</Link></div></section><section aria-label="Señales de confianza" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">{confianza.map(({ icon: Icon, titulo, texto }) => <article key={titulo} className="bg-muted/35 p-4 sm:p-5"><Icon className="size-5 text-accent" aria-hidden="true" /><h2 className="mt-3 text-sm font-semibold text-foreground">{titulo}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{texto}</p></article>)}</section></>;
}
