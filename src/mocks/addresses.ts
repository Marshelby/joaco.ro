import type { CustomerAddressMock } from "@/types/account";

export const CUSTOMER_ADDRESSES_MOCK = [
  { id: "address-home-quilpue", label: "Casa", type: "home", street: "Los Carrera", number: "1245", apartmentOrUnit: null, commune: "Quilpué", region: "Región de Valparaíso", reference: "Casa de fachada clara, portón negro.", recipientName: "Joaquín Rojas", phone: "+56 9 8765 4321", isPrimary: true, isActive: true },
  { id: "address-work-villa-alemana", label: "Trabajo", type: "work", street: "Avenida Valparaíso", number: "680", apartmentOrUnit: "Oficina 4", commune: "Villa Alemana", region: "Región de Valparaíso", reference: "Acceso por recepción principal.", recipientName: "Joaquín Rojas", phone: "+56 9 8765 4321", isPrimary: false, isActive: true },
  { id: "address-family-quilpue", label: "Casa familiar", type: "other", street: "Freire", number: "932", apartmentOrUnit: null, commune: "Quilpué", region: "Región de Valparaíso", reference: "Frente a una plaza pequeña.", recipientName: "Joaquín Rojas", phone: "+56 9 8765 4321", isPrimary: false, isActive: true },
] as const satisfies readonly CustomerAddressMock[];
