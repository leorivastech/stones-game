# 2026-09-19 — Prueba Vinegar + MCP en esta PC

## Qué se hizo

1. Wrapper `~/.local/bin/roblox-studio-mcp`: lanza el `StudioMCP.exe` más nuevo con el Wine de Vinegar (`WINEDEBUG=-all`).
2. `~/.cursor/mcp.json` apunta a ese wrapper. Cursor hay que recargarlo para verlo.
3. `flatpak run org.vinegarhq.Vinegar` actualizó Studio de `0.732` a `0.739` (`version-673d6e19eae14fec`) y lo lanzó.

## Qué funcionó

- El exe de MCP **corre en Linux**. `--help` imprime `MCP proxy for Roblox Studio`.
- Handshake MCP OK: servidor `RobloxStudio` 1.0.0, protocolo `2024-11-05`.
- Wine 11.11 del kombucha de Vinegar sirve desde el host, no hace falta entrar al Flatpak.

## Qué no

- Studio **colgó el hilo principal** a los ~5 s (`StudioHangMonitor` / `RBXCRASH-HangDetected`). Creó swapchain 1918×960 pero no hay ventana usable. Assistant.rbxm llegó a cargar.
- `tools/list` = vacío. `list_roblox_studios` = `{studios:[]}`. El proxy está vivo; no hay sesión de Studio sana detrás.
- En agosto (0.732) Studio sí corrió ~20 min en esta misma GPU (RTX 3070). El corte es la versión nueva + Wine, no el wrapper.

## Qué tiene que hacer Leo

1. Recargar Cursor (`Developer: Reload Window`) para que tome `mcp.json`.
2. Si Studio está congelado: cerrar Vinegar y volver a abrirlo. Si cuelga otra vez: Windows o esperar un update de Vinegar.
3. Cuando Studio responda: Assistant → … → Manage MCP Servers → Enable Studio as MCP server.
4. Recién ahí este chat puede listar el árbol y editar.

Stones no se tocó. No hay repo Roblox todavía.

## Estado al revisar de nuevo (13:24)

Vinegar registró `Roblox was killed` y se cerró. Studio ya no está abierto. Quedó un `StudioMCP.exe` suelto (el cable), sin Studio al otro lado. Leo no entendió el reporte anterior: el resultado real es “el cable existe; la ventana de Roblox no arrancó”.

## Leo: se traba al abrir. ¿Yo lo rompí?

No toqué la config de Vinegar ni archivos internos de Studio. Al lanzarlo yo, Vinegar **actualizó solo** de 0.732 (la que le andaba en agosto) a 0.739. Esa versión nueva es la que cuelga. Reinstalar baja la misma 0.739. No es falta de RAM (30 GB libres). Quedaron procesos viejos de la primera prueba; se mataron. El Studio que Leo abrió ahora sigue en pie.

## Reinstalación (pedido de Leo)

Se borró Studio + prefix de Wine. Se bajó de nuevo el canal LIVE (`version-55808de4b1914919`, sigue siendo 0.739). Config: `channel=LIVE`, `renderer=Vulkan`. **Sigue colgando a los ~36 s.**

Después se forzó la build de agosto (`forced_version=version-ff6341faef444107`, 0.732.0.7321040). El CDN todavía la tiene. Se instaló limpia. Con `renderer=D3D11` y con `renderer=DXVK` se queda en el splash (logo) y el log se corta a ~0.8 s. **La 0.732 ya no arranca en esta PC.** No seguir reinstalando.

Config dejada: LIVE + DXVK + `forced_version` a la 0.732, para que Vinegar no vuelva a bajar la 0.739 sola.
