import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/admin",
        "/mi-cuenta/",
        "/mi-cuenta",
        "/checkout",
        "/carrito",
        "/iniciar-sesion",
        "/recuperar-contrasena",
        "/actualizar-contrasena",
        "/confirmar-recuperacion",
        "/confirmar-correo",
        "/aceptar-invitacion",
        "/auth/",
      ],
    },
    sitemap: "https://www.hidroleufu.cl/sitemap.xml",
  };
}
