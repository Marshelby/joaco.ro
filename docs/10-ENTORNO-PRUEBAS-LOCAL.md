> **ACTUALIZACIÓN:** este documento conserva el estado histórico previo. La recuperación y validación real posterior están en [11-VALIDACION-FASE1-RECUPERADA.md](11-VALIDACION-FASE1-RECUPERADA.md). No reiniciar ni reaplicar migraciones basándose en el bloqueo descrito abajo.

# Preparación del entorno aislado — 2026-10-22

## Estado real: BLOQUEADO

No se aplicaron migraciones a PostgreSQL ni se ejecutaron pruebas funcionales,
RLS o concurrencia. No se usó MCP para escrituras ni se modificó producción.

### Reanudación tras instalación de Docker

El usuario confirmó instalación y hello-world satisfactorios. Esta sesión verificó
Docker CLI 29.9.2 y Compose 5.6.1. El daemon sigue inaccesible para Codex:

- `docker version` dentro del sandbox: permission denied al socket.
- La misma comprobación fuera del sandbox: permission denied al socket.
- `sudo -n docker version`: interactive authentication is required.
- Contexto local: `unix:///var/run/docker.sock`; modo 0660. No se cambió.

Se verificaron nuevamente los 61 nombres y hashes del manifiesto: sin diferencias
entre copias y repositorio. No existen enlace remoto ni .env en la raíz aislada.
Supabase CLI permanece en la ruta temporal preparada. El hash de next-env.d.ts
continúa siendo 7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc.

No se repitió `supabase start` sin acceso al daemon. Las pruebas funcionales,
RLS y concurrencia de esta reanudación están NO EJECUTADAS. Se solicitó una
decisión de acceso puntual; no se agregaron grupos, ACL ni cambios de sudoers.

## Herramientas y acceso

- Kernel WSL2: 6.18.54.1-microsoft-standard-WSL2, x86_64.
- Ubuntu 26.04.1 LTS; Node 24.22.1, npm 11.19.1, Python 3.14.4.
- Docker CLI 29.9.2 y Compose 5.6.1 disponibles tras instalación por el usuario;
  acceso al daemon bloqueado para esta sesión. psql no instalado aquí.
- `sudo -n true` fuera del sandbox devuelve autenticación interactiva requerida.
  Dentro del sandbox existe además NoNewPrivs. No se modificó esa protección.
- El PID 1 observado por esta sesión es `codex`, no systemd. No demuestra que la
  terminal WSL del usuario tenga la misma vista; no se cambió `/etc/wsl.conf`.
- Supabase CLI 2.121.0 instalada con npm oficial en
  `/tmp/hidro-leufu-tools/node_modules/.bin/supabase`. Verificada con `--version`.
  Es instalación temporal; no se cambiaron package.json ni package-lock.json.
- Parsers auxiliares: libpg-query 17.7.4 (SQL PG17) y 18.1.5 (PL/pgSQL PG18),
  también en /tmp. No son servidores ni ejecutan SQL.

Docker Docs incluye Ubuntu 26.04 entre las distribuciones soportadas:
https://docs.docker.com/engine/install/ubuntu/
Método npm de Supabase CLI:
https://supabase.com/docs/guides/local-development/cli/getting-started

## Instalación Docker ejecutada por el usuario

`scripts/instalar-docker-wsl.sh` sigue el repositorio APT oficial de Docker e
instala Engine, CLI, containerd, Buildx y Compose Plugin. Se validó con bash -n.
Debe ejecutarse desde la terminal WSL del usuario con autenticación sudo:

```bash
sudo bash /home/unk0/joaco.ro/scripts/instalar-docker-wsl.sh
```

No desinstala paquetes conflictivos ni sobrescribe repositorios existentes:
si los encuentra se detiene para revisión. No cambia grupos, sudoers, firewall
ni arranque WSL. Si PID 1 no es systemd se detiene antes de instalar; cualquier
cambio de esa configuración requiere autorización específica. No exponer el
daemon por TCP ni cambiar el socket a permisos de escritura globales.

## Proyecto local inicializado

- Directorio: `/tmp/hidro-leufu-aislado-f5f94pg4`.
- project_id: `hidro-leufu-aislado-f5f94pg4`.
- API prevista 55421; PostgreSQL 55422; Studio 55423; versión PostgreSQL 17.
- Creado con `supabase init --workdir` en un directorio nuevo.
- No se ejecutó login ni link; no existe `.temp/project-ref`.
- No se copiaron .env, credenciales ni datos de clientes. Se eliminaron referencias
  activas a variables externas en su config generada y se deshabilitó el seed.
- Se copiaron las 61 migraciones locales y se generó un manifiesto SHA-256.
  Las migraciones aún NO están aplicadas: copiar archivos no es migrar.
- `supabase start` con variables de conexión/producción retiradas devolvió código
  1; el stack NO está iniciado. Docker sigue siendo el prerrequisito pendiente.
- El directorio y la instalación CLI están en /tmp: pueden desaparecer al reiniciar.

Antes de reanudar, verificar hashes de las copias, identidad local, puertos,
ausencia de enlace y acceso al daemon. No iniciar desde la raíz del repositorio
con sus variables de producción. No mostrar claves locales en logs.

## Errores y correcciones

1. El parser PL/pgSQL detectó `syntax error at end of input` en
   `proteger_item_posible_pedido`. Se aisló la función y comprobó que envolver
   CASE con paréntesis resuelve el error de parsing. Se corrigió la migración
   estructural aún no aplicada: `IS DISTINCT FROM (CASE ... END)`.
   No se alteraron las 57 migraciones históricas reconciliadas.
2. `dias_anticipacion_corte >= 1` impedía el corte del mismo día y hacía inválidas
   las fixtures que usan cero. Nueva migración 20261022013000: permite >=0, añade
   firma administrativa de cuatro argumentos y mantiene la firma antigua
   preservando la anticipación existente. No contiene UPDATE de configuración.
3. Se añadieron al script de pruebas llamadas para cero, anticipación 2 y
   conservación del cero al invocar la firma antigua. Pruebas NO ejecutadas.

## Resultados realmente obtenidos

| Comprobación | Resultado |
|---|---|
| CLI instalada y versión | PASÓ |
| Proyecto local independiente, sin enlace | PASÓ (configuración, no servidor) |
| Sintaxis externa de 61 migraciones con parser PG17 | PASÓ |
| PL/pgSQL nuevo con parser PG18 | PASÓ tras corregir CASE |
| Cuerpo de pruebas con parser PL/pgSQL PG18 | PASÓ (solo parsing) |
| Bash del instalador | PASÓ, bash -n |
| Docker CLI / Compose disponibles | PASÓ: 29.9.2 / 5.6.1 |
| Acceso efectivo de Codex al daemon | FALLÓ: permission denied incluso fuera del sandbox |
| Supabase start | FALLÓ, código 1; stack no iniciado |
| Aplicación de migraciones en PostgreSQL 17 real | NO EJECUTADO |
| Registro, snapshots, edición, autorización, descarte | NO EJECUTADO |
| Conversión y contabilidad | NO EJECUTADO |
| Permisos/RLS efectivos de los cuatro roles | NO EJECUTADO |
| Concurrencia en dos sesiones | NO EJECUTADO |
| Corte real 07:59/08:00 con calendario configurable | NO EJECUTADO |

Resultados de parsing en el directorio aislado: `resultados-parser.json`.
No equivalen a aprobación funcional ni a compatibilidad ejecutada con PG17.

## Pendiente al disponer de Docker

1. Verificar acceso local al daemon sin modificar permisos sensibles.
2. Levantar únicamente el project_id aislado; usar componentes reales Supabase.
3. Revisar cada fallo histórico sin modificar SQL histórico ya aplicado.
4. Crear fixtures de administradores sintéticos, nunca copiar usuarios reales.
5. Aplicar el marcador de pruebas solo en esa base aislada y ejecutar el script
   de `supabase/tests`, después ampliar la cobertura indicada en documento 09.
6. Ejecutar las seis carreras concurrentes solicitadas con dos sesiones reales.
7. Comprobar pagos/aplicaciones/ajustes preexistentes, sumas y rollback completo.
8. Actualizar este informe con evidencias reales antes de aprobar despliegue.

## Dashboard futuro, sin modificaciones en esta etapa

Añadir selector de `diasAnticipacionCorte`, aceptar 0, enviar
`p_dias_anticipacion_corte` por la firma nueva y mostrar "mismo día" cuando sea
cero. Conservar los valores guardados al editar activo/hora. La validación SQL
de fecha sigue usando America/Santiago y corte exclusivo; no requiere fijar
lunes/martes/viernes en código. La configuración deseada se hará posteriormente.
