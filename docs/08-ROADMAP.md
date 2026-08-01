# Roadmap inicial

**Estado:** Propuesto y ajustable.  
**Propósito:** Ordenar la evolución del proyecto sin reemplazar la validación antes de cada fase.  
**Última actualización:** 2026-07-30

El roadmap es ajustable: cada fase puede refinarse, dividirse o reordenarse si cambian las prioridades del dueño del proyecto. Ninguna fase autoriza inventar reglas pendientes.

| Fase | Objetivo | Entregables | Criterio de término | Dependencias |
| --- | --- | --- | --- | --- |
| 0. Documentación y reglas | Consolidar el contexto. | Documentos base y decisiones iniciales. | Documentación revisada y coherente. | Ninguna. |
| 1. Base visual y navegación — Implementada; validación local pendiente | Definir la base de experiencia. | Dirección visual, layouts, navegación pública de destinos funcionales, menú móvil accesible, Footer comercial y componentes base. | Navegación responsive validada, lint, TypeScript, build y comprobación local de rutas correctos. | Fase 0. |
| 2. Home y catálogo con mocks — En curso | Presentar oferta y exploración. | Identidad visual, Hero definitivo, Home de descubrimiento, catálogo mock con búsqueda, categorías, ordenamiento, ficha por slug y sistema visual de imágenes con fallbacks tipados; auditoría taxonómica pendiente de aprobación; carrito, fotografías reales y datos reales pendientes. | Recorrido de exploración usable hasta la ficha de producto. | Fase 1. |
| 3. Producto, carrito y checkout | Permitir solicitud web. | Detalle, carrito y checkout mock. | Cliente puede enviar solicitud simulada. | Fase 2. |
| 4. Cuenta de cliente y pedidos — En curso | Modelar la experiencia de cuenta. | Resumen, historial y detalle de pedidos mock con snapshots, entrega/retiro, pago y seguimiento; direcciones centralizadas y beneficios mock con campañas y participaciones; persistencia y reglas definitivas pendientes. | Flujos de cliente coherentes. | Fase 3. |
| 5. Panel administrativo | Base operativa interna. | Navegación y vistas administrativas mock. | Roles y recorridos conceptuales claros. | Fases 0 a 4. |
| 6. Productos y categorías | Gestionar catálogo. | Administración mock de productos y categorías. | Reglas de producto reflejadas. | Fase 5. |
| 7. Gestión de pedidos | Operar solicitudes. | Revisión, ajuste, aprobación y estados mock. | Flujos documentados representados y validados. | Fases 3 y 5. |
| 8. Entregas, zonas y rutas | Preparar operación logística. | Gestión mock de zonas, días, capacidad y rutas. | Selección y administración coherentes. | Fase 7. |
| 9. Auditoría integral frontend | Revisar calidad antes del backend. | Hallazgos, riesgos y plan de corrección. | Flujos, responsive y accesibilidad revisados. | Fases 1 a 8. |
| 10. Diseño de base de datos | Validar modelo de datos. | Diseño definitivo, migraciones planificadas y decisiones actualizadas. | Aprobación explícita del diseño. | Fase 9. |
| 11. Supabase, Auth, Storage y RLS | Crear plataforma de datos segura. | Integración, migraciones, Auth, Storage y RLS. | Seguridad y contratos validados. | Fase 10. |
| 12. Integración frontend-backend | Sustituir mocks de forma controlada. | Servicios, repositorios y datos reales. | Flujos críticos operan contra contratos reales. | Fase 11. |
| 13. Pagos | Integrar el flujo de pago definido. | Gestión de transferencias y preparación para pasarela. | Pago y revisión auditables. | Fase 12. |
| 14. WhatsApp, n8n y chatbot | Incorporar comunicación controlada. | Automatizaciones y acciones seguras. | Sin acceso irrestricto ni spam. | Fases 11 a 13. |
| 15. Fidelización, puntos, sorteos y beneficios | Expandir relación con clientes. | Diseño e implementación aprobados de beneficios. | Reglas, seguridad e historial validados. | Fases 11 y 12; reglas específicas aprobadas. |
