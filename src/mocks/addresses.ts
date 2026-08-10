import type { CustomerAddressMock } from "@/types/account";

export const CUSTOMER_ADDRESSES_MOCK = [
  { id: "address-demo-home", label: "Casa", type: "home", street: "Dirección de ejemplo", number: "1245", apartmentOrUnit: null, commune: "Comuna de ejemplo", region: "Región de ejemplo", reference: "Referencia de ejemplo.", recipientName: "Cliente Demo", phone: "+56 9 0000 0000", isPrimary: true, isActive: true },
  { id: "address-demo-work", label: "Trabajo", type: "work", street: "Avenida de ejemplo", number: "680", apartmentOrUnit: "Oficina 4", commune: "Comuna de ejemplo", region: "Región de ejemplo", reference: "Acceso por recepción principal.", recipientName: "Cliente Demo", phone: "+56 9 0000 0000", isPrimary: false, isActive: true },
  { id: "address-demo-other", label: "Otra dirección", type: "other", street: "Calle de ejemplo", number: "932", apartmentOrUnit: null, commune: "Comuna de ejemplo", region: "Región de ejemplo", reference: "Referencia de ejemplo.", recipientName: "Cliente Demo", phone: "+56 9 0000 0000", isPrimary: false, isActive: true },
] as const satisfies readonly CustomerAddressMock[];
