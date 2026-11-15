# Reciclar pedido: cambio de estrategia y limpieza local

Al iniciar, `git status --short` mostraba exclusivamente nueve archivos sin seguimiento: los siete retirados y los dos conservados de esta lista. No había modificaciones locales en archivos versionados. La inspección de cabeceras y referencias delimita estos artefactos al diagnóstico/parche de reprogramación legacy/multi. No se consultó producción ni se comprobó instalación alguna.

## Artefactos retirados

Los SQL retirados se describían como propuestas o diagnósticos no ejecutados. Se retiraron únicamente copias locales sin seguimiento, sin inferir el estado de producción. SHA-256 previo al retiro:

- `docs/diagnostico-reprogramacion-pedido-nuevo.md` — `46980bc39fe55bcbf71a94a7e3b010a8e0f2c78b4ed0357e64c33fb7d25307aa`
- `supabase/manual/diagnostico_reprogramacion_pedido_nuevo.sql` — `eaece1de25f575f97e2eb28399d811b9acb221780149e6a12047de8729503b7e`
- `supabase/manual/reprogramacion_74_contraste.sql` — `32d356c3908946d78cbe04178836d82cbd5c5f6b2a56d2bccd2f083db2d3c05f`
- `supabase/manual/reprogramacion_74_dependencias_pendientes.sql` — `21245ae70c5acfcbd682aa8cb9be716e3fc120fbcb9e62a34c111fdc2be42907`
- `supabase/manual/reprogramacion_contrato_indispensable.sql` — `4d8f37487a6678fdd9ef36fd4e5912f8d6b150987a1ead1dce6118001d0f1e4a`
- `supabase/manual/reprogramacion_legacy_multi_integral.sql` — `a07b84c42da091ef78458f4f863bfc1e9f30509d22fa2170c206b9ee7df8f5ab`
- `supabase/manual/verificar_reprogramacion_legacy_multi_integral.sql` — `8c1afe3d02bb6ba592d81eead5d5294db087c068422bca4c4547f5d19e547d18`

## Evidencia conservada

- `supabase/manual/reprogramacion_contratos_produccion_74.json`: exportación de contratos de producción recibida previamente, conservada como evidencia del esquema instalado; no es un parche ni certifica el estado actual.
- `supabase/manual/reprogramacion_dependencias_produccion_504.json`: exportación de contratos de producción recibida previamente, conservada como evidencia del esquema instalado; no es un parche ni certifica el estado actual.

Se conservan todos los SQL y documentos versionados, incluidos `corregir_reprogramacion_no_entregados.sql`, `corregir_reprogramacion_origen_multi.sql`, su documentación, `diagnostico_hl_000081_reprogramacion.sql`, `docs/auditoria-reprogramacion-no-entregados.md` y todas las migraciones. No es posible certificar cuáles fueron aplicados. Pueden compartir dependencias con cancelación, rutas, permisos, barreras e historial; retirarlos sin esa evidencia no sería una limpieza segura. La documentación histórica se conserva como antecedente, no como instrucción de instalación vigente.

## Implementación

- `src/app/(admin)/admin/pedidos/nuevo/actions.ts`: lectura administrativa del origen; recupera cliente, dirección e items con identidad de producto/presentación; usa catálogo y precios vigentes. Nunca envía el ID original a la confirmación.
- `src/app/(admin)/admin/pedidos/nuevo/page.tsx`: reutiliza creador y muestra advertencias de precarga.
- `src/components/admin/order-customer-selection.tsx`, `order-product-selection.tsx`, `order-wizard.tsx`: precarga editable; comienza en paso 3 si cliente, dirección y productos son válidos. Si faltan referencias vigentes o hay cantidades inválidas, conserva las líneas para corregirlas en los pasos anteriores y bloquea el avance. No sustituye ni omite productos silenciosamente.
- `src/components/admin/recycle-order-link.tsx` (nuevo), `src/config/routes.ts`: enlace completo a `/admin/pedidos/nuevo?reciclar=UUID`, evitando preservar modales de detalle.
- `src/app/(admin)/admin/pedidos/page.tsx`, `src/components/admin/order-views.tsx`: vista Entregados y acción en listados de estados terminales.
- `src/components/admin/order-detail.tsx`, `delivery-order-card.tsx`, `undelivered-order-actions.tsx`: acción en detalle/tarjetas administrativas y reemplazo de Reprogramar en No entregados, incluidos históricos. La restricción histórica sigue aplicándose a cancelar.
- `src/app/(admin)/admin/pedidos/no-entregados-actions.ts`: retira acceso servidor a reprogramación y conserva cancelación con sesión, versión, idempotencia y comprobante.

Confirmación mediante el creador original y su RPC existente `crear_pedido_administrativo`, que revalida disponibilidad, cantidades, precios y permisos; no se instaló ni ejecutó. No se copian fechas, pagos, ajustes de precios antiguos, preparación, ventas ni asignaciones de ruta. El pedido original no se actualiza. Una referencia sin cliente activo impide precargar y se informa sin crear nada.

## Rutas, permisos y revisión

Se leyó la guía local de Next.js de páginas y layouts. El creador mantiene su segmento estático `nuevo`; los interceptores existentes usan `detalle/[id]` y el acceso antiguo `[id]` redirige al detalle. La nueva acción no crea segmentos dinámicos adicionales. Layout administrativo y lector de precarga exigen administrador; confirmar conserva la autorización del creador.

Revisión estática del diff y búsqueda de consumidores; `git diff --check`. No SQL, migraciones, Supabase CLI, tests, builds, ESLint, TypeScript CLI, commits ni push. Sin verificación de ejecución o navegador. Dependencia operativa: catálogo, cliente/dirección comercial activos y RPC de creación existente; no se asume que los contratos locales estén instalados en producción.
