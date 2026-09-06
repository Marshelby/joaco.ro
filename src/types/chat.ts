export type TipoRemitenteChat = "cliente" | "admin";

export type ConversacionCliente = {
  id: string;
  clienteId: string;
  clienteUltimoLeidoEn: string | null;
  adminUltimoLeidoEn: string | null;
  ultimoMensajeEn: string | null;
};

export type PedidoRelacionadoMensaje = {
  id: string;
  numeroPedido: string;
};

export type MensajeConversacion = {
  id: string;
  conversacionId: string;
  remitenteUsuarioId: string;
  remitenteTipo: TipoRemitenteChat;
  remitenteNombreSnapshot: string;
  contenido: string;
  pedido: PedidoRelacionadoMensaje | null;
  fechaCreacion: string;
};

export type CursorMensajes = {
  fechaCreacion: string;
  id: string;
};

export type MensajesCuenta = {
  conversacion: ConversacionCliente | null;
  mensajes: readonly MensajeConversacion[];
  tieneMensajesAnteriores: boolean;
  mensajesAdminNoLeidos: number;
};

export type ClienteChatAdmin = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  usuarioId: string | null;
  activo: boolean;
};

export type ConversacionInboxAdmin = {
  id: string;
  cliente: ClienteChatAdmin;
  ultimoMensajePreview: string | null;
  ultimoMensajeEn: string | null;
  ultimoRemitenteTipo: TipoRemitenteChat | null;
  adminUltimoLeidoEn: string | null;
  fechaActualizacion: string;
  mensajesNoLeidos: number;
};

export type InboxAdmin = {
  conversaciones: readonly ConversacionInboxAdmin[];
  siguienteCursor: { ultimoMensajeEn: string; conversacionId: string } | null;
  mensajesNoLeidos: number;
};

export type DetalleChatAdmin = {
  cliente: ClienteChatAdmin;
  conversacion: ConversacionCliente | null;
  mensajes: readonly MensajeConversacion[];
  tieneMensajesAnteriores: boolean;
};
