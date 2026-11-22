export const BUCKET_CONSTANCIAS = "constancias-fotograficas";
export const LIMITE_CONSTANCIA = 2 * 1024 * 1024;

export const rutaConstancia = (id: string) => `${id}/foto`;
export const urlConstancia = (id: string) => `/api/admin/constancias/${id}`;

export type Constancia = {
  pedido_id: string;
  numero_pedido: string;
  nombre_cliente_snapshot: string;
  fecha_entrega: string | null;
  actualizada_en: string;
};
