# Música y efectos propios con IA local (ACE-Step + MOSS)

Generación de música y efectos PROPIOS del juego con los modelos que ya viven en esta máquina (RTX 3070 8 GB).
Nada de llaves de pago: todo corre local. Fecha: 25/26-sep-2026.

## Estado de la corrida (26-sep 00:12)

- Se lanzó **desacoplado** de la sesión con:

  ```bash
  cd ~/Development/stones_Game/.claude/worktrees/pixel-remake
  setsid nohup python3 studio/musica/ia/generar.py todo > studio/musica/ia/generar.log 2>&1 < /dev/null &
  ```

- **PID del orquestador: 695016** (`python3 studio/musica/ia/generar.py todo`, sesión propia, padre 1).
  Él va lanzando hijos: `…ACE-Step-1.5/.venv/bin/python generar.py musica`, luego `stingers`, luego
  `…venv-moss/bin/python generar.py sfx`, y al final `convertir`, `clap` y `catalogo`.
- Al lanzarlo llevaba **32 de 55 pistas de zona** (raw en `/tmp/stones-ia/musica/`, 28 ya en OGG). Faltaban:
  23 pistas de zona + 21 stingers (ACE-Step) + 60 efectos (MOSS) + CLAP.
- Tiempo estimado: música ~10 min + stingers ~6 min + efectos ~65 min (≈65 s cada uno en INT8) + CLAP ~5 min
  ≈ **1 h 30 min** en total si la GPU no se llena.

### Cómo revisar el avance

```bash
tail -f studio/musica/ia/generar.log            # log completo (ruidoso: ACE-Step imprime mucho)
grep -E "^  ok |FALLÓ|OOM|=====" studio/musica/ia/generar.log   # sólo lo importante
ls public/assets/music-ia | wc -l; ls public/assets/sfx-ia | wc -l
pgrep -af generar.py                            # ¿sigue vivo?
```

`catalogo.json` se reescribe después de cada clip, así que siempre refleja lo que ya existe.

### Cómo reanudar si se corta

Volver a correr el mismo comando de arriba. El script **salta** todo lo que ya exista en
`public/assets/music-ia/` y `public/assets/sfx-ia/` (y los WAV crudos de `/tmp/stones-ia/`), así que
sólo hace lo que falta. Si `/tmp/stones-ia/` se borró, no pasa nada: se rehace lo que no tenga OGG.

### Cómo detenerlo

```bash
pkill -f "generar.py todo"; pkill -f "generar.py (musica|stingers|sfx|clap)"
```

(Nunca matar procesos ajenos: el trabajador de Lumi `trabajador_musica.py` y el bot de actas también usan la GPU.)

## Qué hay

- `generar.py` — el script (reutilizable). Etapas: `todo` (por defecto) · `musica` · `stingers` · `sfx` ·
  `convertir` · `clap` · `catalogo` · `lista`. Cada etapa corre con su venv; `todo` lo hace solo.
- `generar.sh` — atajo que elige el venv por etapa (`bash studio/musica/ia/generar.sh sfx relincho`).
- `corridas.jsonl` — una línea por clip crudo: prompt, semilla, bpm, tonalidad, segundos de GPU, VRAM.
- `clap.json` — puntaje CLAP de cada OGG (lo escribe la etapa `clap`, al final).
- `catalogo.json` — lista de todos los OGG con zona, capa, bpm, tonalidad, prompt, CLAP, duración, segundos de GPU.
- `generar.log` — log de la corrida desacoplada.
- Salida: `public/assets/music-ia/<zona>-<capa>-<n>.ogg`, `public/assets/music-ia/stinger-<nombre>-<n>.ogg`,
  `public/assets/sfx-ia/<nombre>-<n>.ogg`.

Nada de `src/`, `server/`, `index.html` ni `public/assets/music|sfx|ambience` se tocó. Sin commits.

## Cómo se genera

### Música — ACE-Step 1.5 (MIT), venv `~/Development/lumi/pruebas/2026-09-25/c-audio/ACE-Step-1.5/.venv`

- Modelo `acestep-v15-turbo` (8 pasos) + planeador LM 0.6B (`acestep-5Hz-lm-0.6B`, `thinking=True`,
  `use_cot_metas=False` para que respete bpm y tonalidad).
- GPU compartida: `MAX_CUDA_VRAM=3`, `offload_dit_to_cpu=True`, sin cuantizar, sin compilar, y el parche
  `install_block_streaming` de Lumi (sube los bloques del DiT a la GPU de a uno). Pico real ~1.4 GB de VRAM.
- Un clip por llamada (`batch_size=1`): con el tope de 3 GB el guardia de VRAM de ACE-Step baja el lote a 1 y se
  perdía la segunda semilla (probado: pedí 2 y devolvió 1).
- Prompts: género/instrumentos + `bpm` y `keyscale` explícitos por zona; `calma` y `tension` de la misma zona
  comparten bpm y tonalidad (para mezclarlas). Duración pedida 70 s; stingers 10 s (ACE no baja de ~10 s) y se
  recortan a 6 s al convertir.
- Tiempo medido: **~25 s por pista de 70 s** (incluye LM), carga del modelo ~25 s.
- Conversión (`convertir_musica`): quita el silencio de la cola (−45 dB), fundido de 200 ms al inicio y al fin,
  `loudnorm=I=-18:TP=-1.5:LRA=11`, 44.1 kHz estéreo, `libvorbis -q:a 5`. Medido: −18.0 a −18.2 LUFS.

### Efectos — MOSS-SoundEffect v2.0 (Apache-2.0), venv `…/c-audio/venv-moss`

- Ajustes de Lumi: texto en CPU, DiT en INT8 (torchao), VAE sube sólo al decodificar, `TORCHDYNAMO_DISABLE=1`,
  tope 2.6 GB (`--cap-gb`), 100 pasos (`--steps`; el modo rápido de 22 s salió mal en las pruebas de Lumi).
- Pasos (paso-pasto/piedra/madera/arena/nieve): se generan 2 clips de 4 s con «un paso por segundo» y
  `cortar_pasos` los parte por energía en golpes sueltos → 4 variantes por clip (8 por superficie si salen bien).
- Conversión (`convertir_sfx`): recorta silencio al inicio y al fin (−45 dB), pico a −3 dB, mono 44.1 kHz,
  `libvorbis -q:a 5`; los ambientes de 5 s (fogata, agua, grillos, vientos, aves) llevan fundido de 50 ms.

### CLAP — `laion/clap-htsat-fused` en CPU (venv-moss)

Cada OGG se compara con su propia etiqueta y con las de todas las demás zonas/efectos: `sim_propio` (coseno),
`puesto` (1 = la etiqueta propia fue la más parecida), `top1`, y en música `prob_voz` (si es alta, escucharla).

## Qué salió bien y qué no (se completa al terminar la corrida)

- ✅ ACE-Step: 32/32 pistas de zona generadas sin fallos en la primera tanda, ~25 s cada una, −18 LUFS.
  Las pistas salen con 5–8 s de silencio/cola al final (el prompt pide «clean ending»); se recorta al convertir,
  así que quedan de 60–69 s en vez de 70.
- ⚠️ Lote de 2 semillas en ACE-Step no sirve con el tope de 3 GB (ver arriba): se generan de una en una.
- ⚠️ El trabajador de música de Lumi (`trabajador_musica.py`) estaba vivo con ACE-Step cargado (720 MB); no se
  tocó, cabe junto con esta corrida.
- Pendiente de anotar cuando termine: fallos de MOSS (si los hay), tiempos totales, y CLAP.

## Recomendación por zona (se llena con `catalogo.json` cuando termine)

Regla: por zona y capa, la variante con mayor `clap_sim` y `clap_puesto` = 1, salvo que la duración sea rara
(< 55 s en música de zona) o `clap_prob_voz` > 0.7 (hay que escucharla). Para sacar la tabla rápido:

```bash
python3 - <<'EOF'
import json; c=json.load(open('studio/musica/ia/catalogo.json'))
mejor={}
for i in c['items']:
    k=(i.get('zona') or i.get('nombre'), i.get('capa'))
    if (i.get('clap_sim') or 0) > (mejor.get(k,{}).get('clap_sim') or 0): mejor[k]=i
for k,i in sorted(mejor.items(), key=lambda x: str(x[0])): print(k, i['archivo'], i['clap_sim'], i['duracion_s'])
EOF
```
