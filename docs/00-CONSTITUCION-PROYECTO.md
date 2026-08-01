# Constitución del proyecto JOACO RO

**Estado:** Decidido  
**Propósito:** Establecer el marco permanente de producto, operación y desarrollo de JOACO RO.  
**Última actualización:** 2026-07-26

## Propósito

JOACO RO es una plataforma de comercio y gestión integral para un negocio chileno de productos variados, con foco outlet, comercio local y oportunidades de compra. No es solamente un catálogo ni una tienda online: debe permitir operar el ciclo completo de venta y, con el tiempo, su relación con clientes, pagos, entregas y crecimiento territorial.

## Visión de largo plazo

La plataforma deberá poder incorporar, de forma gradual y sin comprometer la base, una tienda pública, panel administrativo, gestión de clientes, pedidos, pagos, despachos, rutas, historial, fidelización, puntos, sorteos, promociones, automatizaciones, chatbot, integración con WhatsApp y futuras pasarelas o servicios. También debe poder escalar a nuevas comunas, zonas, bodegas y sucursales.

La primera etapa es **mock-first**: se construye y valida la experiencia con datos mock. Supabase no forma parte de la implementación actual.

## Principios obligatorios

1. Auditar antes de modificar.
2. Entender el flujo completo antes de implementar.
3. Separar interfaz, negocio y acceso a datos.
4. Evitar duplicación de lógica.
5. No mezclar mocks con lógica de presentación de forma desordenada.
6. Mantener tipado estricto.
7. Priorizar mantenibilidad.
8. No sacrificar arquitectura por velocidad.
9. No inventar reglas de negocio.
10. Mantener compatibilidad responsive.
11. Preservar accesibilidad.
12. No introducir dependencias sin justificación.
13. No realizar cambios masivos sin plan previo.
14. No romper flujos existentes.
15. Validar después de implementar.
16. Registrar decisiones importantes.
17. Documentar backend, RPCs y base de datos cuando se incorporen.
18. Aplicar seguridad desde el diseño.
19. Mantener precios históricos de pedidos.
20. Considerar siempre crecimiento futuro.

## Flujo obligatorio para cambios futuros

1. Auditoría.
2. Hallazgos.
3. Riesgos.
4. Plan.
5. Esperar aprobación explícita.
6. Implementación.
7. Validación.
8. Resumen final.
9. Actualización documental cuando corresponda.

Para cambios pequeños, evidentes y seguros este proceso puede abreviarse, pero la validación nunca se omite. Si un cambio requiere una decisión de negocio aún no definida, se debe detener el trabajo y solicitarla.

## Fuente de verdad

- La documentación define el negocio y sus decisiones vigentes.
- Los tipos definen los contratos del frontend.
- Supabase será la fuente real de datos cuando se conecte.
- Los mocks son temporales y no sustituyen una fuente real de datos.
- Las reglas críticas no deben depender únicamente de la UI.

## Regla de prioridad

Ante una decisión o conflicto se aplica, en este orden:

1. Instrucción explícita del dueño del proyecto.
2. Esta Constitución del proyecto.
3. [Reglas de negocio](./02-REGLAS-NEGOCIO.md) documentadas.
4. [Arquitectura](./01-ARQUITECTURA.md) documentada.
5. Código existente.
6. Suposiciones técnicas.

Si existe una contradicción entre estas fuentes, Codex o cualquier colaborador debe detenerse, explicarla y pedir definición antes de continuar.
