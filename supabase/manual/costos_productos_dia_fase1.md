# Costos de compra del día · Fase 1

Implementación limitada al desplegable Productos del día de /admin/rutas, incluidas sus variantes histórica y sin contrato de rutas múltiples. El resumen compartido de otras páginas permanece intacto.

## Revisión y unidades

El resumen anterior agrupaba por producto, presentación y unidad de los snapshots, sumando cantidades solicitadas de pedidos no cancelados con fecha_entrega igual a la fecha consultada. Los precios de venta son snapshots por línea y tienen reglas históricas propias; no se usan para inferir compras ni se modifican.

El resumen SQL conserva exactamente ese universo y la agrupación operativa: producto por referencia (o nombre snapshot si falta), presentación por referencia (o nombre snapshot si falta) y unidad exacta. La identidad interna se codifica como JSON, sin delimitadores ambiguos. Los nombres y modos históricos distintos dentro de un grupo bloquean el registro, sin dividir ni alterar su demanda. El frontend compara claves y cantidades con el resumen operativo y bloquea compras si ambas lecturas divergen. No hay conversiones entre presentaciones. KG fraccionable admite hasta tres decimales; unidades y presentaciones cerradas admiten cantidades enteras. Un saco de 25 kg se compra por saco, una caja de 17 kg por caja y un paquete de diez unidades por paquete; no por su peso o contenido. El formulario identifica siempre la presentación completa.

El modo histórico explícito tiene prioridad. Si falta, solo se reconocen formatos cerrados con nombre identificable, KG con nombre `1 kg`/`kg` y UND con nombre `1 unidad`/`unidad`. Otros casos quedan visibles pero bloqueados hasta verificar sus datos; no se inventan equivalencias.

## Registro y seguridad

Precio CLP por la unidad operativa, con hasta tres decimales; cantidad total para asignar ingresada por el administrador y asignación persistida igual al mínimo entre compra y demanda verificada en servidor. Requeridas 300, ingresadas 350: solo se persisten 300. Ingresadas 250: cubiertas 250, faltantes 50. No se almacena el excedente, tampoco en auditoría. Editar reemplaza el total asignado; no suma otra compra. Un registro explícito con cero se distingue de la ausencia de registro.

La clave única fecha/identidad impide duplicados. Una versión esperada evita sobrescribir cambios concurrentes. Un reintento de la última escritura con el mismo actor, versión anterior, revisión, asignación y precio retorna éxito sin repetir auditoría ni aumentar versión. No permite reproducir escrituras antiguas sobre una versión posterior.

El hash de revisión incluye IDs de ítem y pedido, cantidad, snapshots y modo resuelto. El guardado exige READ COMMITTED: adquiere un advisory lock transaccional por fecha/identidad sin esperar y FOR SHARE NOWAIT únicamente sobre los pedidos e ítems contribuyentes de esa identidad, juntos en orden de ítem. No bloquea todos los pedidos de la fecha ni tablas completas. Compara la revisión de las filas efectivamente bloqueadas, la revisión enviada y una nueva lectura de demanda. Si cambia una línea, aparece otra entre lecturas o hay contención, aborta sin escribir. Los locks de padres impiden cancelaciones/reprogramaciones y los de ítems impiden reducciones, borrados o cambios de identidad de la base validada hasta finalizar la transacción. Los padres compartidos con otros productos sí quedan bloqueados: es necesario para proteger su estado y fecha.

No se intenta impedir inserciones ni entradas nuevas posteriores al snapshot final: solo pueden aumentar la demanda respecto de la base bloqueada y no permiten sobreasignación. Se reflejan al refrescar. No se promete congelar la demanda después del commit; eso exigiría modificar los escritores de pedidos, fuera del alcance autorizado.

Esquema privado sin acceso directo para clientes, RLS sin políticas públicas y RPC con autenticación y es_admin en cada lectura/escritura. Auditoría transaccional con actor, fecha y valores anteriores/nuevos. No hay eliminación desde la aplicación. Si cambia posteriormente la demanda, se marca el registro para revisión; la asignación vigente que devuelve la RPC nunca supera la requerida actual. El valor original permanece en el historial privado. Si cambia el modo de unidad o el grupo queda ambiguo, no se acredita su precio ni cobertura histórica; se conserva la versión para corregir sin sobrescribir cambios ajenos. Si desaparece toda la demanda, el registro se conserva como historial privado, fuera del resumen vigente. Un futuro cálculo de utilidad deberá resolver explícitamente estos cambios; esta fase no lo implementa.

## SQL pendiente

Revisar y ejecutar manualmente `supabase/manual/costos_productos_dia_fase1.sql`. Instalación única y transaccional: no es un script de reinstalación. Ejecutar como postgres. Verifica ese rol, fecha_entrega de tipo date y public.es_admin() antes de crear objetos; las vistas verifican las columnas requeridas, incluido modo_cantidad_snapshot. Falla si el esquema privado ya existe: no reutiliza objetos desconocidos ni borra registros. RPC con propietario postgres y search_path vacío. Los índices primarios cubren lectura y exclusión por fecha/clave; no se agregan índices ni triggers a pedidos o ítems. No se ha ejecutado ni comprobado contra una base de datos. Sin instalación, el desplegable muestra el resumen original y un aviso de compras no disponibles; no presume compras, cobertura ni costo cero.

No se modifican pedidos, precios de venta, snapshots, rutas, cuentas corrientes ni proveedores. No se implementan utilidad, inventario ni compras a proveedores.

Validación realizada: revisión estática y git diff --check. No se ejecutaron SQL, migraciones, Supabase CLI, tests, builds, ESLint ni TypeScript CLI; tampoco commits o push. La validación funcional y del SQL queda pendiente en un entorno autorizado tras su revisión manual.

## Límites de la revisión estática

Se contrastaron las referencias con las migraciones locales y las reglas reales de consolidarItemsEntrega. No se verificaron remotamente esquema desplegado, propietarios, grants adicionales de roles personalizados, políticas RLS, aislamiento efectivo de PostgREST ni comportamiento del SQL bajo carga. La RPC rechaza aislamientos distintos de READ COMMITTED. Las garantías presuponen escritura PostgreSQL normal que respeta row locks; no cubren alteraciones de esquema o intervención de superusuario. La instalación y validación funcional siguen pendientes; el archivo original queda preparado para revisión y ejecución manual como postgres, sin parches ni migraciones adicionales.
