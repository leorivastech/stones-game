# 2026-09-19 — Análisis profundo: Roblox desde Cursor / Claude / Codex

Complementa `2026-09-19-roblox-desde-cursor.md`. Fuentes: docs oficiales de Roblox, DevForum (anuncios 2026), VinegarHQ, WEPPY, Cursor/Claude/Codex pricing.

## Sirve?

**Sí para el loop que ya usamos.** Chat → agente toca el juego → ves el resultado. En Roblox el agente además puede dar Play, pulsar teclas y mirar el viewport.

**No para “házme el juego y publícalo”. ** En el DevForum lo dicen los propios creadores y un staff: baja el tiempo al MVP; no reemplaza diseño, playtest humano ni modelado. Un post de HuggingFace (VibeGame) concluyó que Roblox MCP solo, sin archivos, es malo para vibe coding one-shot: poco contexto, jardín cerrado. Con Script Sync + Git (el harness oficial) cambia: el agente tiene archivos, como aquí.

Veredicto práctico:

| Qué pedís | Realidad 2026 |
|---|---|
| Prototipo / obby / tycoon simple / shop | Sirve. Roblox ya trae personaje, física, UI, multiplayer. |
| Iterar scripts y probarlos | Sirve. Playtest + consola + captura. |
| Juego complejo (inventario, combate, economía) | El agente ayuda; vos dirigís. Alucina y rompe el DataModel. |
| Dejarlo solo toda la noche | Frágil. Playtest agent da falsos “Pass”, tope 50 turns, sin reflejos. |
| Publicar y ganar Robux | El puente no cobra. Moderación, calidad y DevEx son otro tema. |

Usuarios reales en DevForum: equipos que ya tenían el MCP open-source; gente en Cursor + Claude + Codex; vibe-coders. Nadie serio lo trata como piloto automático. Salieron herramientas de contención (Roview: diffs + undo atómico) porque el agente a veces borra de más.

Dolores reportados (2026): MCP se cae; `list_roblox_studios` vacío; Studio se pega; Cursor se cuelga al restart de Play; editar scripts por MCP gasta ~4× tokens vs archivos; `screen_capture` aparece y desaparece; Assistant built-in tiene contexto chico y límite diario.

## Quién lo usa

- **Roblox** lo empuja como producto (Assistant + MCP built-in, Quick Connect, coding harness). Anuncios: mar–ago 2026.
- **Cursor, Claude Code, Codex CLI** son clientes de primera línea.
- **Equipos** (comentario “my teams’ workflows”) lo usan como acelerador, no como motor.
- **Indie / vibe-coders** en Cursor. Hay plugins (Vibe Code City, WEPPY, Lemonade, Ro-Pilot).
- **No** es el flujo de un estudio AAA fuera de Roblox. Es el flujo de creators de Roblox que ya viven en Studio.

## Capacidades (MCP oficial)

El conector es gratis. Las tools las tiene el agente cuando Studio está abierto.

**Código:** leer, grep, buscar por nombre, editar/crear (`multi_edit`). Mejor editar `.luau` en disco (Script Sync) y usar MCP para lo demás.

**Mundo:** `search_game_tree`, `inspect_instance`, `execute_luau` (Edit / Client / Server).

**Playtest:** start/stop, consola, screenshot, teclado, mouse, pathfinding del personaje. Subagente `playtest` (beta, límite diario, 50 turns, falsos pases). Subagente `explore`.

**Assets (gratis, con cupos):** mesh por texto, material, modelo procedural (50 / 24 h), buscar/insertar Creator Store, subir imágenes.

**Docs:** `http_get` a docs de Roblox, `skill` internas.

**No hace (o hace mal):** debugger remoto; multiplayer real con varios clientes; combate/volante en tiempo real; editar el place entero como archivos (eso es Rojo); garantizar que el juego “se vea bien” sin que vos mires.

## Opciones (de más oficial a más rara)

| Opción | Qué es | Linux | Costo extra | Usar? |
|---|---|---|---|---|
| 1. Assistant dentro de Studio | Chat en Studio, modelo default de Roblox | Solo si Studio abre | Gratis, límite diario, contexto chico | Útil en Studio. No es el loop Cursor. |
| 2. MCP oficial + Cursor/Claude/Codex | El puente | Oficial: Win/mac. Linux: Vinegar + Wine | El LLM que ya pagás | **Camino correcto** |
| 3. Script Sync / Rojo + archivos | Código en Git, Studio refleja | Rojo sí en Linux; Studio no | Gratis | Obligatorio junto al 2 |
| 4. Assistant + API key Anthropic/OpenAI/Gemini | BYOK en Studio | Igual que Studio | Pay-per-token, caro | No, si ya tenés Cursor |
| 5. WEPPY | Plugin + MCP de terceros | Win/mac; MCP en Node también Linux | Basic gratis; Pro suscripción (precio no listado en la comparativa) | Solo si el oficial se queda corto |
| 6. MCP Rust deprecado | GitHub Roblox | Win/mac, se puede compilar | Gratis | No |
| 7. Solo Sober | Player Android en Linux | Sí | Gratis | Jugar, **no** desarrollar |

En esta máquina ya está:

- Vinegar Flatpak 1.9.4
- Un build de Studio: `~/.var/app/org.vinegarhq.Vinegar/data/vinegar/versions/version-ff6341faef444107/`
- `StudioMCP.exe` en esa carpeta

No hay `~/.cursor/mcp.json` todavía. No se probó la conexión.

## Linux: sí, con matices

Roblox **no soporta Linux**. Opciones reales:

1. **Vinegar (ya instalado).** Studio por Wine. Se rompe con updates. MCP: Cursor llama a `StudioMCP.exe` con el Wine y el prefix de Vinegar. La ruta del `version-…` cambia al actualizar. Issue Vinegar #853 / PR #900: quieren un wrapper; no es one-click.
2. **Dual boot Windows.** El único camino “oficial”. Quick Connect funciona.
3. **VM Windows + GPU passthrough.** Cerca de nativo, setup pesado.
4. **Windows remoto / cloud.** Cursor en Linux, Studio en otra máquina: el MCP es local stdio, así que el cliente MCP tiene que correr junto a Studio (o un túnel). No es el setup documentado.
5. **Sober.** Solo Player. No Studio.
6. **Rojo en Linux + Studio en Windows.** Código aquí, Studio allá. Incómodo.

Para *jugar* el juego publicado: Sober. Para *hacerlo*: Studio, o sea Vinegar o Windows.

## Costo

El puente **no cobra**. Roblox Studio **es gratis**. Publicar **es gratis**. Mesh gen **sin costo** (cupos). MCP **sin costo**.

Lo que sí se paga es el **cerebro**:

| Cosa | Precio aprox. (2026) | Nota |
|---|---|---|
| Roblox Studio + MCP + Script Sync | $0 | |
| Assistant default en Studio | $0 | Límite diario, contexto chico |
| Mesh / procedural | $0 | 50 procedurales / 24 h |
| Cursor Hobby | $0 | Agent limitado; MCP listado en planes de pago |
| Cursor Pro | $20/mes | Lo que ya usamos. Pro+ $60, Ultra $200 |
| Claude Pro (Claude Code) | $20/mes | Max 5× $100, Max 20× $200. Límites 5 h + semanal |
| ChatGPT Plus (Codex) | $20/mes | Pro 5×/20× $100/$200 |
| API Anthropic en Assistant | pay-per-token | Sonnet ~$3/$15 por MTok. **No** lo cubre Claude Pro |
| WEPPY Pro | suscripción, USD no publicado en la tabla | No hace falta para empezar |
| Assets de pago en Creator Store | Robux | El agente puede insertarlos; vos pagás si no son free |
| DevEx (sacar plata de Robux) | umbral de Roblox | Independiente del MCP |

Costo diario real si ya tenés Cursor Pro: **$0 extra**, hasta que se acaben los tokens del plan. Editar por MCP (no por archivos) quema tokens más rápido. Los planes $20 se quedan cortos si el agente playtestea en loop todo el día; ahí Pro+/Max.

No hace falta pagar Cursor + Claude + Codex a la vez. Uno basta. Cursor ya está.

## Stack recomendado si se prueba

1. Vinegar abre Studio (o Windows).
2. Script Sync: carpetas `ServerScriptService/`, `ReplicatedStorage/`, `StarterPlayerScripts/` en un **repo nuevo**.
3. MCP oficial en Cursor (Quick Connect en Win; en Linux, JSON con Wine → `StudioMCP.exe`).
4. El agente edita `.luau` en disco; MCP para árbol, playtest, meshes.
5. `studio/` igual que aquí: historia, mecánicas, decisiones.

No mezclar con `stones_Game`. No WEPPY de entrada. No API key de Anthropic de entrada.

## Decisión

Sigue **investigado / no cerrado**. El producto existe, la gente lo usa, sirve para el mismo método de trabajo. En esta PC el experimento barato es Vinegar + MCP. El experimento estable es Windows. Stones no se mueve.
