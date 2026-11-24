"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { IdentidadCuenta } from "@/lib/account/identity";

type IdentidadPublica = Pick<IdentidadCuenta, "rol">;
const PublicIdentityContext = createContext<IdentidadPublica | null>(null);

export function PublicIdentityProvider({ children, identidad }: { children: ReactNode; identidad: IdentidadPublica | null }) {
  return <PublicIdentityContext value={identidad}>{children}</PublicIdentityContext>;
}

export function usePublicIdentity() {
  return useContext(PublicIdentityContext);
}
