import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { obtenerIdentidadActual } from "@/lib/account/identity";

export default async function CustomerAddressesLayout({ children }: Readonly<{ children: ReactNode }>) {
  const identidad = await obtenerIdentidadActual();
  if (identidad?.rol !== "cliente") redirect("/mi-cuenta");

  return children;
}
