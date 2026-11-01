import { z } from "zod";

export const celularChilenoSchema = z.string().regex(/^\+569[0-9]{8}$/, "Celular: ingresa exactamente 8 dígitos después de +569.");
const telefono = z.string().trim().max(100).refine((v) => /^[0-9]{8,15}$/.test(v.replace(/\D/g, "")), "Teléfono: usa entre 8 y 15 dígitos, incluido el país.");
const texto = z.string().trim().min(1).max(1000);
const opcional = z.string().trim().max(1000).nullable();
export const clienteComercialSchema = z.object({
  nombre: z.string().trim().min(1).max(200), telefono: telefono.nullable(),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).nullable(),
  observaciones: z.string().trim().max(4000).nullable(), activo: z.boolean(),
}).strict();
export const direccionComercialSchema = z.object({
  id: z.uuid().nullable(), nombre: texto.nullable(), destinatario: opcional, telefono_contacto: telefono.nullable(),
  direccion: texto, comuna: texto, region: texto.nullable(), zona_entrega_id: z.uuid().nullable(), referencia: opcional,
  latitud: z.number().min(-90).max(90).nullable(), longitud: z.number().min(-180).max(180).nullable(),
  es_principal: z.boolean(), activa: z.boolean(),
}).strict().refine((d) => (d.latitud === null) === (d.longitud === null), "Coordenadas incompletas.")
  .refine((d) => !d.es_principal || d.activa, "La dirección principal debe estar activa.");
export const documentoComercialSchema = z.object({
  clave: z.uuid(), clienteId: z.uuid().nullable(), revision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  cliente: clienteComercialSchema, direcciones: z.array(direccionComercialSchema).max(50),
  direccionRapida: z.object({ direccion: texto, comuna: texto }).strict().nullable().optional(),
  posibleId: z.uuid().nullable(), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict().refine((d) => (d.posibleId === null) === (d.version === null), "Asociación incompleta.")
  .refine((d) => (d.clienteId === null) === (d.revision === null), "Revisión requerida para editar.")
  .refine((d) => d.clienteId !== null || celularChilenoSchema.safeParse(d.cliente.telefono).success, "Celular: ingresa exactamente 8 dígitos después de +569.")
  .refine((d) => d.clienteId === null || !d.direccionRapida, "La dirección simplificada solo está disponible al crear.")
  .refine((d) => d.direcciones.filter((a) => a.es_principal).length <= 1, "Selecciona una sola dirección principal.");
export type ClienteComercial = z.infer<typeof clienteComercialSchema>;
export type DireccionComercial = z.infer<typeof direccionComercialSchema>;
export type DocumentoComercial = z.infer<typeof documentoComercialSchema>;
export type FichaComercial = { cliente: ClienteComercial & { id: string }; direcciones: DireccionComercial[]; revision: string };
export type CoincidenciaComercial = { cliente_id: string; nombre: string; por_telefono: boolean; por_email: boolean };
export type EstadoComercial = { error?: string; conflicto?: boolean; incierto?: boolean; clienteId?: string; coincidencias?: CoincidenciaComercial[]; confirmacion?: string };
