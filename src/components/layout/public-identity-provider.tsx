"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { IdentidadCuenta } from "@/lib/account/identity";

const PublicIdentityContext = createContext<IdentidadCuenta | null>(null);

export function PublicIdentityProvider({ children, identidad }: { children: ReactNode; identidad: IdentidadCuenta | null }) {
  return <PublicIdentityContext value={identidad}>{children}</PublicIdentityContext>;
}

export function usePublicIdentity() {
  return useContext(PublicIdentityContext);
}
