import type { AccountSummaryMock } from "@/types/account";

/** Datos exclusivamente visuales para validar el resumen de Mi Cuenta. */
export const ACCOUNT_SUMMARY_MOCK = {
  profile: {
    avatarInitials: "CD",
    name: "Cliente Demo",
    googleEmail: "cliente@ejemplo.cl",
    phone: "+56 9 0000 0000",
    commune: "Comuna de ejemplo",
  },
} as const satisfies AccountSummaryMock;
