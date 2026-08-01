import type { AccountSummaryMock } from "@/types/account";

/** Datos exclusivamente visuales para validar el resumen de Mi Cuenta. */
export const ACCOUNT_SUMMARY_MOCK = {
  profile: {
    avatarInitials: "JR",
    name: "Joaquín Rojas",
    googleEmail: "joaquin.rojas@gmail.com",
    phone: "+56 9 8765 4321",
    commune: "Quilpué",
  },
} as const satisfies AccountSummaryMock;
