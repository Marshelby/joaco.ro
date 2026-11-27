export const camposFacturacion = [
  { nombre: "rut", etiqueta: "RUT", maximo: 12 },
  { nombre: "razon_social", etiqueta: "Razón social", maximo: 200 },
  { nombre: "giro_comercial", etiqueta: "Giro comercial", maximo: 200 },
  { nombre: "direccion_tributaria", etiqueta: "Dirección tributaria", maximo: 250 },
  { nombre: "comuna", etiqueta: "Comuna", maximo: 100 },
  { nombre: "ciudad", etiqueta: "Ciudad", maximo: 100 },
  { nombre: "correo_facturacion", etiqueta: "Correo de facturación", maximo: 254 },
] as const;

export type DatosFacturacion = Record<(typeof camposFacturacion)[number]["nombre"], string | null>;
