# Guardado persistente de Stones en Supabase

Proyecto gratuito: `stones-game`, referencia `aljfstqzmzbjomxljsru`.
El servidor sigue en Render. Supabase sólo guarda el mundo, que incluye las partidas por nombre.
No añade cuentas de usuario: la identificación de jugadores conserva el comportamiento existente.

## Configuración

1. Ejecutar `server/supabase.sql` en el SQL Editor del proyecto. Crea `public.stones_worlds`,
   activa RLS, quita el acceso de `anon` y `authenticated` y autoriza al servidor.
2. En Environment del servicio Render configurar:
   - `WORLD_STORE=supabase`
   - `WORLD_ID=main`
   - `SUPABASE_URL=https://aljfstqzmzbjomxljsru.supabase.co`
   - `SUPABASE_SECRET_KEY`: llave **secret** del proyecto, guardada como secreto. Nunca `VITE_`.
3. Build: `npm ci --include=dev && npm run build`. Start: `node server/index.mjs`.

`render.yaml` contiene los nombres y la URL pública; la llave no se publica en Git.
El servidor se niega a arrancar si falta la configuración o no puede leer un guardado remoto.
Sin configuración Supabase se conserva el modo local para desarrollo.

## Migración y recuperación

Cada `WORLD_ID` tiene una fila con el mismo JSON que antes se guardaba en `server/data/world.json`.
Al arrancar se carga Supabase antes de abrir el puerto. Si todavía no hay fila, se importa el
archivo local, si existe, o se crea un mundo nuevo. Una fila remota existente tiene prioridad.
Un archivo de migración corrupto o una fila inválida detienen el arranque, sin reemplazar datos.

Los guardados son serializados. Los cambios que llegan durante una escritura permanecen pendientes.
Las revisiones impiden que dos servidores sobrescriban el mismo mundo: ante conflicto se detiene
el servidor. Mantener una sola instancia para cada mundo. El cierre SIGTERM espera el guardado.
Las partidas se escriben al recibirlas; los demás cambios del mundo se guardan cada cuatro segundos.
Un corte abrupto puede perder cambios todavía no escritos; Supabase inaccesible conserva pendientes
sólo mientras el proceso siga vivo. Los fallos quedan en el log, nunca como éxito de una petición.

Para desarrollo, usar un `WORLD_ID` distinto de `main`. Copiar `.env.example` a `.env`, introducir
la llave fuera de Git y arrancar con `node --env-file=.env server/index.mjs`.
No arrancar localmente el mundo `main` mientras Render lo está sirviendo.

## Respaldo sin costo adicional

El plan Free no incluye respaldos automáticos. Exportar periódicamente desde un equipo de confianza:

```bash
node --env-file=.env server/world-backup.mjs /ruta/privada/stones-2026-10-09.json
```

El comando usa el WORLD_ID de .env, no sobrescribe archivos, crea permisos 600 y no imprime partidas.
Para recuperar un respaldo: usar otro WORLD_ID vacío y WORLD_FILE apuntando al respaldo, comprobarlo
antes de sustituir el mundo activo. No borrar ni reemplazar la fila original durante la revisión.
Para volver al modo de archivo, exportar primero el mundo remoto y retirar la configuración Supabase
sólo después de detener el servidor activo. No volver a un archivo antiguo.

## Validación 2026-10-09

- Siete pruebas de migración, arranque fallido, revisión en conflicto, respuesta perdida,
  reintento con cambios nuevos, guardados concurrentes y compatibilidad local.
- Tabla real: RLS activo; anon SELECT=false; authenticated UPDATE=false; service_role UPDATE=true.
- Supabase real: dos jugadores y un cambio compartido recuperados en una fila separada de QA.
- Servidor real local con WebSocket: dos jugadores guardados, SIGTERM, proceso nuevo y recuperación
  de ambas partidas desde Supabase, en otro WORLD_ID de QA.
- Render desplegó `f91be78` correctamente el 9 de octubre de 2026 a las 19:13 PDT; log de arranque: guardado en Supabase.
- Prueba en el servicio público: dos jugadores sintéticos QA-Render-A/B guardaron oro 321/654 y vida 77.
  Render confirmó «Service restarted by you» a las 19:15 PDT. Ambas partidas se recuperaron por WebSocket
  después del reinicio. El mundo main también se exportó a un respaldo local privado con permisos 600.
- QR público verificado en Chrome: https://stones-game-v1y1.onrender.com/. Cámara e instalación real
  en teléfono siguen sin probar. La llave está en el entorno de Render y en .env local ignorado por Git.

Límites Free: 500 MB, pausa por inactividad y cuotas de transferencia; revisar el panel de Usage.
No se contrató ningún plan de pago.
