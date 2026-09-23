# 2026-09-19 — Programar Roblox Studio desde Cursor / Claude / Codex

## Qué se preguntó

Leo: ¿se puede hacer el mismo loop del AI game studio, pero con Roblox Studio? Eso es lo que más llama la atención. ¿Hay forma de programarlo desde Cursor, Claude Code o Codex?

## Respuesta corta

Sí. Roblox ya metió un **MCP server oficial dentro de Studio**. Cursor, Claude Code y Codex CLI están en Quick Connect. El agente puede leer el árbol del juego, escribir Luau, ejecutar código, playtestear y capturar el viewport.

No hay que montar un editor propio ni un MCP casero. El puente oficial existe.

## Cómo se parece a lo que ya hacemos

| Aquí (Phaser) | En Roblox |
|---|---|
| Chat en Cursor | Chat en Cursor / Claude Code / Codex |
| Agente edita `src/` | Agente edita `.luau` (Script Sync o Rojo) |
| MCP no hace falta | MCP oficial habla con la sesión abierta de Studio |
| Leo recarga el navegador | Leo (o el agente) da Play en Studio |

Roblox llama a ese combo **coding harness**: editor con IA + Script Sync + MCP + Git.

Guías oficiales:

- [Connect to the Roblox Studio MCP server](https://create.roblox.com/docs/studio/mcp)
- [Build with a coding harness](https://create.roblox.com/docs/ai/coding-harness)
- [Script Sync](https://create.roblox.com/docs/scripting/sync)

## Qué puede hacer el agente (MCP oficial)

- Scripts: leer, buscar, grep, editar o crear (`script_read`, `multi_edit`, `script_search`, `script_grep`).
- Árbol: explorar e inspeccionar instancias (`search_game_tree`, `inspect_instance`).
- Luau en vivo: `execute_luau` en Edit / Client / Server.
- Playtest: start/stop, consola, captura de viewport, mover personaje, teclado/mouse.
- Assets: buscar/insertar del Creator Store, generar mesh/material/modelo procedural.
- Docs: `http_get` a las docs de Roblox y skills internas (debug, devices).

Quick Connect detecta y configura:

- Cursor
- Claude Code
- Claude Desktop
- Codex CLI
- VS Code
- Gemini CLI
- Antigravity

## Dos capas (no se elige una sola)

1. **Script Sync** (oficial, ya no beta en release notes recientes) — los scripts viven como archivos. Cursor los edita igual que `src/`. Studio los refleja al instante. Sirve para Git.
2. **MCP** — el agente *conduce* Studio: partes, GUI, playtest, output. Cubre lo que Script Sync no toca (StarterGui, StarterPack, instancias que no son scripts).

**Rojo** sigue siendo la opción si el filesystem es la fuente de verdad de *todo* el place (modelos, instancias), no solo scripts. Para el loop “igual que Stones”, Script Sync + MCP es el camino que documenta Roblox.

El MCP viejo de Rust (`Roblox/studio-rust-mcp-server`) está **deprecado**. No usarlo.

## El problema de esta máquina

Esta PC es Linux. Studio oficial es Windows/macOS. Docs de MCP solo dan:

- Windows: `cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`
- macOS: `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`

Aquí ya está instalado **Vinegar** Flatpak `org.vinegarhq.Vinegar` 1.9.4. Eso corre Studio en Wine. MCP en Linux hoy es workaround: Cursor lanza `StudioMCP.exe` con el Wine y el prefix de Vinegar. La ruta cambia cuando Studio se actualiza. Vinegar tiene issue/PR para facilitar esto; no es one-click como en Windows.

El Player de Roblox en Linux es otro tema (Sober). Studio y Player no son el mismo binario.

## Qué no hacer

- No convertir `stones_Game` a Roblox. Stones sigue Phaser 4.
- No clonar este repo. Si se prueba Roblox, es **otro** directorio, con `studio/` propio.
- No instalar el MCP de Rust ni plugins de terceros como primer intento.
- No montar un editor visual.

## Decisión de esta plática

Investigado. No cerrado. El loop existe y es oficial. El cuello de botella aquí es Linux + Vinegar, no la falta de puente Cursor↔Studio.
