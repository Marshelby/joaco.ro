# Proveedores administrativos: habilitación pendiente

El archivo `proveedores_administrativos.sql` está preparado para revisión y ejecución
manual como postgres. No se ejecutó SQL ni se verificó el esquema remoto. La revisión
local no encontró estructuras de proveedores compatibles. Antes de instalar, comprobar
que no existan objetos homónimos y que `public.es_admin()` y `public.perfiles` correspondan
al esquema existente. El script es transaccional y deliberadamente no reemplaza objetos.

Crea dos tablas, una vista de saldos derivados y cuatro funciones administrativas.
Las tablas no permiten escrituras a roles de aplicación: las RPC registran datos y
administrador desde la sesión. El nombre del administrador se conserva como instantánea,
junto con su UUID, aunque luego cambie su perfil. No hay edición ni eliminación histórica.
Los montos son pesos CLP enteros positivos, hasta 999999999999 por movimiento.
No se permiten saldos a favor. Cada abono comprueba el saldo bajo bloqueo del proveedor;
los reintentos con la misma clave y datos devuelven la operación ya registrada.
La creación también es idempotente; nombres iguales no implican la misma entidad.

Teléfono y dirección son opcionales y se almacenan como `NULL` al dejarlos vacíos.
El teléfono completo debe cumplir `+569XXXXXXXX`; el formulario fija `+569` y exige
exactamente ocho dígitos cuando se ingresa un teléfono. La dirección es texto libre
(hasta 2000 caracteres), independiente de futuras columnas de latitud/longitud;
no se implementan coordenadas, mapas ni geocodificación.
La modal permite editar nombre, descripción, teléfono y dirección mediante una RPC
exclusiva para administradores, sin modificar movimientos ni autoría de creación.
La vista y la consulta de detalle incluyen ambos campos.

Para habilitar:

1. Revisar el SQL y las dependencias en la base de destino.
2. Ejecutar manualmente el archivo SQL como postgres.
3. Publicar los cambios de aplicación mediante el proceso habitual.
4. Verificar manualmente como administrador: crear con solo nombre, buscar, abrir la
   modal, registrar deuda y abono, revisar saldo, historial y administrador responsable.
   Editar nombre, descripción, teléfono y dirección desde «Ver proveedor» y comprobar
   que saldo e historial se conservan. Revisar teléfono vacío, válido, con letras o
   con menos de ocho dígitos, y borrar los campos opcionales previamente guardados.
   Comprobar rechazo de sobreabonos y montos inválidos, reintento sin duplicados,
   concurrencia de abonos y denegación de acceso para sesiones sin rol administrador.

Antes de la instalación, la página muestra un aviso de carga/habilitación y oculta
la creación. Ese aviso también cubre errores de sesión, permisos o conexión; no prueba
por sí solo que falte el SQL. La funcionalidad permanece pendiente de instalación y
validación en el entorno de destino. Solo se realizó revisión estática y diff de espacios.
