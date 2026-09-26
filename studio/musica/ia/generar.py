"""Música y efectos PROPIOS de Stones con los modelos de IA que ya viven en esta máquina.

Modelos (instalados por el proyecto Lumi el 25-sep-2026, ver ~/Development/lumi/pruebas/2026-09-25/c-audio/):
  * ACE-Step 1.5 (MIT) — música. Venv: c-audio/ACE-Step-1.5/.venv
  * MOSS-SoundEffect v2.0 (Apache-2.0) — efectos. Venv: c-audio/venv-moss
  * CLAP laion/clap-htsat-fused (CPU) — puntúa si el clip suena a lo pedido. Venv: venv-moss

Cada etapa corre con su venv (ver generar.sh):
  generar.py musica   [ids]   -> WAV crudos en $STONES_IA_TMP/musica    (venv ACE)
  generar.py stingers [ids]   -> WAV crudos en $STONES_IA_TMP/musica    (venv ACE)
  generar.py sfx      [ids]   -> WAV crudos en $STONES_IA_TMP/sfx       (venv MOSS)
  generar.py convertir        -> OGG en public/assets/{music-ia,sfx-ia} (cualquier python3 + ffmpeg)
  generar.py clap             -> puntajes CLAP sobre los OGG            (venv MOSS)
  generar.py catalogo         -> studio/musica/ia/catalogo.json

Reglas: un modelo a la vez en la GPU; antes de cargar espera hasta 10 min a que haya VRAM libre;
nunca mata procesos ajenos. No toca nada fuera de music-ia/, sfx-ia/ y studio/musica/ia/.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent            # studio/musica/ia
PROJ = HERE.parent.parent.parent                   # raíz del juego
AUDIO = Path(os.environ.get("STONES_AUDIO_MODELOS", Path.home() / "Development/lumi/pruebas/2026-09-25/c-audio"))
TMP = Path(os.environ.get("STONES_IA_TMP", "/tmp/stones-ia"))
MUSIC_OUT = PROJ / "public/assets/music-ia"
SFX_OUT = PROJ / "public/assets/sfx-ia"
RUNS = HERE / "corridas.jsonl"                      # una línea por clip crudo generado (tiempos, prompt, semilla)

MUSIC_DUR = float(os.environ.get("STONES_MUSIC_DUR", 70))
STINGER_DUR = float(os.environ.get("STONES_STINGER_DUR", 10))   # ACE no baja de ~10 s; se recorta al convertir

BASE = ("pixel-art fantasy RPG game soundtrack, light medieval folk, instrumental, no vocals, no singing, "
        "seamless loop, clean ending")
TENSION = ("adds driving hand percussion, frame drum, staccato strings ostinato, urgent chase feeling, "
           "same melody and key, still light, not epic")

# ---- Zonas: (bpm, tonalidad, compás, caption calma, caption tensión) -------------------------------------------
ZONES = {
    "title": dict(bpm=90, key="D major", ts="4", calma=(
        "main title theme, memorable singable melody on celtic harp and wooden flute, soft warm strings, "
        "gentle lute, hopeful and adventurous but calm, opening of a trading adventure game")),
    "ashfen": dict(bpm=96, key="G major", ts="4",
        calma="warm acoustic village theme, nylon guitar fingerpicking and wooden flute melody, light tambourine, "
              "meadows and farms, mild countryside town, cozy, pastoral, sunny",
        tension="village theme with nylon guitar and wooden flute melody"),
    "valkeep": dict(bpm=84, key="D minor", ts="4",
        calma="stone mountain town theme, low cellos and double bass drone, cold wind, dulzaina double-reed shawm melody, "
              "sparse frame drum, austere, cold, high altitude, medieval",
        tension="mountain town theme with cellos and dulzaina shawm melody"),
    "verdelume": dict(bpm=104, key="A minor", ts="4",
        calma="jungle canal town theme, marimba and wooden xylophone, pan flute melody, wooden log drums and shakers, "
              "humid, green, lively but relaxed, rainforest market",
        tension="jungle town theme with marimba, pan flute and log drums"),
    "duneshade": dict(bpm=100, key="E minor", ts="4",
        calma="desert adobe town theme, oud melody in phrygian mode, soft darbuka and riq, ney flute, "
              "warm and dry, caravan market at dusk, middle eastern folk, relaxed",
        tension="desert town theme with oud in phrygian mode, ney flute and darbuka"),
    "frostholm": dict(bpm=72, key="F major", ts="4",
        calma="frozen harbor town theme, tubular bells and glockenspiel, soft wordless choir pad, slow legato strings, "
              "distant sleigh bells, snow, ice, quiet, wide, peaceful",
        tension="frozen harbor town theme with bells, choir pad and slow strings"),
    "mossgrove": dict(bpm=80, key="E minor", ts="4",
        calma="damp forest village theme, celtic harp arpeggios, clarinet melody, soft bowed strings, "
              "gentle mystery, moss and fog, curious, mysterious but not scary",
        tension="forest village theme with celtic harp arpeggios and clarinet melody"),
    "ruta-pradera": dict(bpm=110, key="G major", ts="4",
        calma="walking travel theme along a meadow road, light marching rhythm, acoustic guitar strumming, tin whistle "
              "melody, bodhran, cheerful, moving forward, countryside journey",
        tension="meadow road travel theme with tin whistle melody and bodhran"),
    "ruta-montana": dict(bpm=104, key="D minor", ts="4",
        calma="walking travel theme on a mountain pass, steady marching rhythm, cellos, low flute, frame drum, "
              "wind, rocky, determined, cold journey",
        tension="mountain pass travel theme with cellos, low flute and frame drum"),
    "ruta-selva": dict(bpm=112, key="A minor", ts="4",
        calma="walking travel theme through a jungle, steady rhythm, wooden percussion, shakers, marimba, "
              "bamboo flute, humid, alert, moving through dense vegetation",
        tension="jungle travel theme with wooden percussion, marimba and bamboo flute"),
    "ruta-nieve": dict(bpm=100, key="F minor", ts="4",
        calma="walking travel theme across a snowy pass, steady marching rhythm, low strings, glockenspiel, "
              "soft taiko, icy wind, cold, careful journey",
        tension="snowy pass travel theme with low strings, glockenspiel and taiko"),
    "ruta-desierto": dict(bpm=106, key="E minor", ts="4",
        calma="walking travel theme across a desert, steady caravan rhythm, oud, darbuka, ney flute, phrygian mode, "
              "hot, dry, shimmering heat, long journey",
        tension="desert caravan travel theme with oud, darbuka and ney flute in phrygian mode"),
    "refugio-cueva": dict(bpm=66, key="C minor", ts="4",
        calma="hidden cave refuge theme, slow, dripping water echo feeling, soft kalimba, low ambient pad, "
              "distant reverb, tranquil, safe, damp stone",
        tension="cave refuge theme with soft kalimba and low ambient pad"),
    "refugio-tierra": dict(bpm=78, key="C major", ts="4",
        calma="hidden cabin refuge theme, campfire warmth, gentle acoustic guitar and mandolin, soft accordion, "
              "cozy, safe, resting, small and intimate",
        tension="cabin refuge theme with acoustic guitar, mandolin and soft accordion"),
}
ZONE_VARIANTS = {"title": 3}
SEED_BASE = {"calma": 100, "tension": 200}

STINGERS = {
    "llegada": ("short warm arrival fanfare, bright trumpet and horns with harp, welcoming, resolves happily", 110, "C major"),
    "fama": ("short achievement jingle, rising glockenspiel and harp arpeggio, triumphant chime, reward, bright", 120, "G major"),
    "cobrador": ("short menacing sting, low brass and cellos, ominous debt collector arrives, dark, threatening", 80, "D minor"),
    "redada": ("short alarm sting, urgent war drums and blaring horns, raid warning, danger, rapid", 140, "D minor"),
    "ko": ("short soft defeat sting, descending sad flute and strings, falling down, gentle loss, fades out", 70, "A minor"),
    "amanecer": ("short sunrise sting, rising harp glissando and soft flute, dawn, hopeful, light, waking up", 90, "F major"),
    "anochecer": ("short nightfall sting, descending soft chimes and low strings, dusk, calm, settling down", 76, "D minor"),
    # 26-sep (tanda 2): los jingles que eran muestras CC0 (jingle-mission, jingle-free).
    "mision": ("very short quest complete jingle, plucked harp and glockenspiel quick rising arpeggio resolving on the tonic, "
               "small success, cheerful, bright, then silence", 120, "C major"),
    "deuda": ("short triumphant freedom fanfare, bright trumpets and french horns with timpani roll and rising strings, "
              "debt finally paid, liberation, celebratory, resolves grandly on the tonic, then silence", 100, "D major"),
}
STINGER_VARIANTS = 3
# Segundos que quedan de cada stinger al convertir (ACE no baja de ~10 s). Por omisión 6; los jingles cortos 4-5.
STINGER_RECORTE = {"mision": 4, "deuda": 5}


def recorte_stinger(stem):
    """stinger-<nombre>-<n> → segundos a los que se recorta (None si no es stinger)."""
    if not stem.startswith("stinger-"):
        return None
    return STINGER_RECORTE.get(stem[len("stinger-"):].rsplit("-", 1)[0], 6)

# ---- Efectos (MOSS): (prompt, segundos, variantes) ------------------------------------------------------------
SFX = {
    "moneda-comprar": ("A few gold coins clinking together once, short, dry, close, single coin purchase sound.", 1.5, 2),
    "moneda-vender": ("A handful of gold coins dropped on a wooden counter, short jingle, dry, close.", 1.5, 2),
    "moneda-pagar": ("A leather bag full of coins being shaken and set down, coins jingling, short, dry.", 2.0, 2),
    "golpe-baston": ("A quick wooden staff swing whoosh through the air, single swish, short, dry.", 1.0, 2),
    "impacto": ("A single dull punch impact on leather and flesh, thud, short, dry, no reverb.", 1.0, 2),
    "dano-jugador": ("A short male grunt of pain, single 'ugh', no words, dry, close.", 1.0, 2),
    "cofre-abrir": ("A wooden treasure chest lid creaking open with a metal latch click, short.", 1.5, 2),
    "puerta-madera": ("A heavy wooden door opening with a creak and a latch click, short, dry.", 1.5, 2),
    "tienda-abrir": ("A small shop bell dinging once as a door opens, bright little bell, short.", 1.5, 2),
    "relincho": ("A single horse neigh, whinny, close, short, dry.", 2.0, 2),
    "cuerno-guardia": ("A single medieval guard horn blast, alarm signal, short, dry.", 2.0, 2),
    "jabali-grunido": ("A wild boar snorting and grunting aggressively, short, close.", 1.5, 2),
    "lobo-grunido": ("A wolf growling and snarling, low threatening growl, short, close.", 2.0, 2),
    "escorpion": ("A scorpion skittering and clicking on sand, chitinous clicks, short, dry.", 1.5, 2),
    "flecha": ("An arrow shot from a bow, string twang and quick whoosh, short, dry.", 1.0, 2),
    "viento-rafaga": ("A single strong gust of wind whooshing past, short, no music.", 2.5, 2),
    "aves-bosque": ("Small birds chirping and singing in a forest, daytime, no wind, no water.", 3.0, 2),
    "grillos-noche": ("Crickets chirping steadily on a calm night in a meadow, no other sounds.", 5.0, 2),
    "fogata": ("A campfire crackling and popping steadily, burning wood, close, steady loop.", 5.0, 2),
    "agua-orilla": ("Gentle water lapping at a shore, small waves on a canal bank, steady, no wind.", 5.0, 2),
    "nieve-viento": ("Cold wind blowing steadily over a snowy field, icy wind, steady, no music.", 5.0, 2),
    "arena-viento": ("Dry desert wind blowing steadily with fine sand hissing, steady, no music.", 5.0, 2),
    "campana-pueblo": ("A single church tower bell ringing once, town bell, medium distance, short tail.", 3.0, 2),
    "pergamino": ("A parchment scroll being unrolled, paper rustling, short, dry.", 1.5, 2),
    "sello": ("A wax seal stamp pressed firmly on paper with a thump, short, dry.", 1.0, 2),
    # ---- tanda 2 (26-sep): reemplazan las muestras CC0 viejas y los tonos de 8 bits ----
    "armadura-moverse": ("Metal plate armor and chainmail rattling as a knight turns and starts to move, short clanking, dry, close.", 1.5, 2),
    "armadura-golpe": ("A wooden staff striking a steel shield and plate armor, single metallic clang, short, dry.", 1.0, 2),
    "flecha-clavar": ("An arrow thudding into a wooden post, single sharp thunk with a short wobble, dry, close.", 1.0, 3),
    "moneda-chica": ("A single small gold coin clinking, tiny bright metallic tink, short, dry, close.", 1.0, 3),
    "muerte-criatura": ("A small monster creature's short dying squeal and whimper, no words, fading, dry, close.", 1.5, 3),
    "palanca": ("A heavy iron lever being pulled down with a mechanical clunk and ratchet, short, dry.", 1.5, 2),
    "chapuzon": ("A splash of something dropping into water, single splash, short, close.", 1.5, 2),
    "baston-ligero": ("A quick light swish of a thin wooden stick swung through the air, fast whoosh, short, dry.", 1.0, 2),
    "baston-pesado": ("A heavy wooden quarterstaff swung hard through the air, deep whoosh, short, dry.", 1.0, 2),
    "cerrojo": ("A metal door latch bolt sliding and clicking shut, short mechanical click, dry, close.", 1.0, 2),
    "costal": ("A heavy sack of stones dropped on the ground, dull thud with rustle of cloth, short, dry.", 1.0, 2),
    "hachazo": ("A single axe chop into wood, sharp wooden thunk, short, dry, close.", 1.0, 2),
    "desenvainar": ("A sword being drawn from its sheath, metallic scrape and ring, short, dry.", 1.5, 2),
    "ui-mover": ("A soft short wooden click, subtle menu cursor tick, very short, dry, close.", 1.0, 3),
    "ui-ok": ("A short bright confirmation chime, two soft rising bell notes, clean, dry.", 1.0, 3),
    "ui-error": ("A short low dull buzz and wooden knock, error denied sound, dry, close.", 1.0, 3),
    "recoger": ("Picking up a small item, quick light pop with a tiny bright chime, short, dry.", 1.0, 3),
    "alerta": ("A sudden sharp short metallic ping of alarm, a guard noticing something, bright, short.", 1.0, 3),
    "curar": ("A gentle magical healing shimmer, soft rising sparkling chimes, warm, short.", 1.5, 3),
    "ui-exito": ("A short cheerful success jingle, three quick rising bright bell notes, clean, dry.", 1.5, 3),
    "sospecha": ("A short soft rising questioning whistle, curious huh, no words, dry.", 1.0, 2),
    "rodar": ("A quick body roll on dirt, cloth and leather rustling with a soft thump, short, dry.", 1.0, 2),
    "cortar-pasto": ("A quick swish cutting through tall grass, leaves rustling and snapping, short, dry, close.", 1.0, 2),
    "saltar": ("A light quick jump, short cloth rustle and soft whoosh, dry, close.", 1.0, 2),
    "aterrizar": ("Boots landing softly on dirt after a small jump, single soft thud, short, dry.", 1.0, 2),
    "cargar": ("A rising whoosh building up energy, wooden staff spinning faster, short, dry.", 1.5, 2),
    "cueva-goteo": ("Water drops dripping slowly in a large stone cave, echoing drips, deep quiet reverb, no wind, no music.", 10.0, 2),
}
# Loops de ambiente (llevan fundido corto en las orillas; music.js toca dos copias desfasadas).
LOOPS = {"fogata", "agua-orilla", "grillos-noche", "nieve-viento", "arena-viento", "aves-bosque", "cueva-goteo"}
# Pasos: se generan 2 clips de 4 s con varios pasos y se cortan en 4 variantes cada uno (ver convertir).
STEP_SURFACES = {
    "paso-pasto": "Slow walking footsteps on grass, one step per second, boots on soft grass, dry, close, no other sounds.",
    "paso-piedra": "Slow walking footsteps on stone cobblestones, one step per second, boots on hard stone, dry, close.",
    "paso-madera": "Slow walking footsteps on a wooden floor, one step per second, boots on planks, dry, close.",
    "paso-arena": "Slow walking footsteps on dry sand, one step per second, boots on sand, dry, close.",
    "paso-nieve": "Slow walking footsteps on crunchy snow, one step per second, boots crunching snow, dry, close.",
}
STEP_VARIANTS = 4


# ---- utilidades --------------------------------------------------------------------------------------------------
def gpu_free_mb():
    out = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
                         capture_output=True, text=True).stdout
    used, total = [int(x) for x in out.strip().split(",")]
    return total - used


def esperar_gpu(necesarios_mb, max_min=10):
    t0 = time.time()
    while True:
        libre = gpu_free_mb()
        if libre >= necesarios_mb:
            print(f"[gpu] {libre} MB libres (necesito {necesarios_mb})", flush=True)
            return True
        if time.time() - t0 > max_min * 60:
            print(f"[gpu] sólo {libre} MB libres tras {max_min} min; sigo de todos modos", flush=True)
            return False
        print(f"[gpu] {libre} MB libres, espero 30 s…", flush=True)
        time.sleep(30)


def anotar(rec):
    with RUNS.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def ffprobe_dur(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True).stdout.strip()
    return round(float(o or 0), 2)


def music_jobs():
    """Lista de (id, caption, bpm, key, ts, seed, dur) para música de zonas."""
    jobs = []
    for zona, z in ZONES.items():
        for capa in ("calma", "tension"):
            if capa not in z:
                continue
            n = ZONE_VARIANTS.get(zona, 2)
            for i in range(1, n + 1):
                cap = z[capa] + ", " + (TENSION + ", " if capa == "tension" else "") + BASE
                jobs.append(dict(id=f"{zona}-{capa}-{i}", zona=zona, capa=capa, caption=cap, bpm=z["bpm"], key=z["key"],
                                 ts=z["ts"], seed=SEED_BASE[capa] + i + 10 * list(ZONES).index(zona), dur=MUSIC_DUR))
    return jobs


def stinger_jobs():
    jobs = []
    for k, (cap, bpm, key) in STINGERS.items():
        for i in range(1, STINGER_VARIANTS + 1):
            jobs.append(dict(id=f"stinger-{k}-{i}", zona="stinger", capa=k, bpm=bpm, key=key, ts="4",
                             caption=cap + ", pixel-art fantasy RPG game jingle, instrumental, no vocals, short, ends cleanly",
                             seed=300 + i + 10 * list(STINGERS).index(k), dur=STINGER_DUR))
    return jobs


# ---- música (ACE-Step) -----------------------------------------------------------------------------------------
def cmd_musica(jobs, only, lm):
    sys.path.insert(0, str(AUDIO / "ACE-Step-1.5"))
    sys.path.insert(0, str(AUDIO / "scripts"))
    os.environ.setdefault("MAX_CUDA_VRAM", "3")
    import soundfile as sf
    import torch
    from gen_acestep_music import install_block_streaming
    from acestep.handler import AceStepHandler
    install_block_streaming(AceStepHandler)
    from acestep.inference import GenerationConfig, GenerationParams, generate_music

    out = TMP / "musica"
    out.mkdir(parents=True, exist_ok=True)
    jobs = [j for j in jobs if (not only or j["id"] in only or j["zona"] in only)
            and not (out / f"{j['id']}.wav").exists() and not (MUSIC_OUT / f"{j['id']}.ogg").exists()]
    if not jobs:
        print("nada que hacer")
        return
    print(f"[ace] {len(jobs)} clips por hacer", flush=True)
    necesito = 2600 if lm else 1400   # sin el LM 0.6B el pico baja ~1.2 GB
    esperar_gpu(necesito)
    t0 = time.time()
    dit = AceStepHandler()
    status, ok = dit.initialize_service(project_root=str(AUDIO / "ACE-Step-1.5"), config_path="acestep-v15-turbo",
                                        device="cuda", use_flash_attention=False, compile_model=False,
                                        offload_to_cpu=True, offload_dit_to_cpu=True, quantization=None)
    if not ok:
        print("ACE-Step no cargó:", status[:300]); sys.exit(1)
    llm = None
    if lm:
        from acestep.llm_inference import LLMHandler
        llm = LLMHandler()
        st, ok2 = llm.initialize(checkpoint_dir=str(AUDIO / "ACE-Step-1.5/checkpoints"), lm_model_path="acestep-5Hz-lm-0.6B",
                                 backend="pt", device="cuda", offload_to_cpu=True)
        if not ok2:
            print("LM no cargó, sigo sin él:", st[:200]); llm = None
    print(f"[ace] cargado en {time.time() - t0:.1f} s (LM={'sí' if llm else 'no'})", flush=True)

    # uno por uno: con el tope de 3 GB el guardia de VRAM de ACE-Step baja el lote a 1 y se pierde la 2.ª semilla
    for j in jobs:
        try:
            _musica_clip(j, dit, llm, out, sf, torch, GenerationParams, GenerationConfig, generate_music, necesito)
        except Exception as e:  # noqa: BLE001  — un clip malo no para la corrida
            print(f"FALLÓ {j['id']}: {type(e).__name__}: {e}"[:300], flush=True)
            anotar(dict(j, ok=False, error=f"{type(e).__name__}: {e}"[:300], modelo="ACE-Step-1.5"))
    print(f"[ace] total {time.time() - t0:.0f} s", flush=True)


def _musica_clip(j, dit, llm, out, sf, torch, GenerationParams, GenerationConfig, generate_music, necesito=2600):
        esperar_gpu(necesito)
        print(f"--- {j['id']} (GPU libre {gpu_free_mb()} MB)", flush=True)
        params = GenerationParams(caption=j["caption"], lyrics="[Instrumental]", instrumental=True, bpm=j["bpm"], keyscale=j["key"],
                                  timesignature=j["ts"], duration=j["dur"], seed=j["seed"], thinking=llm is not None,
                                  use_cot_metas=False, use_cot_caption=False, use_cot_language=False, vocal_language="unknown")
        cfg = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[j["seed"]], audio_format="wav")
        torch.cuda.reset_peak_memory_stats()
        t1 = time.time()
        res = None
        for intento in range(20):
            res = generate_music(dit, llm, params, cfg, save_dir=str(out / "_raw"))
            if res.success or "out of memory" not in str(res.error).lower():
                break
            torch.cuda.empty_cache()
            print(f"OOM (GPU libre {gpu_free_mb()} MB); reintento {intento + 1} en 30 s", flush=True)
            time.sleep(30)
        dt = time.time() - t1
        if not res.success or not res.audios:
            print("FALLÓ", res.error, flush=True)
            anotar(dict(j, ok=False, error=str(res.error)[:300], modelo="ACE-Step-1.5"))
            return
        a = res.audios[0]
        wav = a["tensor"].numpy().T
        sf.write(out / f"{j['id']}.wav", wav, a["sample_rate"])
        anotar(dict(j, ok=True, modelo="ACE-Step-1.5", lm=llm is not None, segundos_gpu=round(dt, 1),
                    raw_s=round(wav.shape[0] / a["sample_rate"], 1), vram_max_mb=round(torch.cuda.max_memory_allocated() / 2**20)))
        print(f"  ok {j['id']} {dt:.1f} s", flush=True)
        for f in (out / "_raw").glob("*"):
            f.unlink()
        try:
            MUSIC_OUT.mkdir(parents=True, exist_ok=True)
            convertir_musica(out / f"{j['id']}.wav", MUSIC_OUT / f"{j['id']}.ogg", recorte=recorte_stinger(j["id"]))
            cmd_catalogo()
        except Exception as e:  # noqa: BLE001
            print(f"  conversión falló {j['id']}: {e}"[:300], flush=True)


# ---- efectos (MOSS) --------------------------------------------------------------------------------------------
def sfx_jobs():
    jobs = []
    for k, (prompt, s, n) in SFX.items():
        for i in range(1, n + 1):
            jobs.append(dict(id=f"{k}-{i}", nombre=k, prompt=prompt, s=s, seed=500 + i + 10 * list(SFX).index(k)))
    for k, prompt in STEP_SURFACES.items():
        for i in (1, 2):
            jobs.append(dict(id=f"{k}-lote{i}", nombre=k, prompt=prompt, s=4.0, seed=900 + i + 10 * list(STEP_SURFACES).index(k), pasos=True))
    return jobs


def moss_poca_vram(pipe, torch):
    """MOSS en ~0.5 GB de VRAM (26-sep: el bot de actas deja fijos 3.9 GB y Lumi 1 GB; sólo quedan ~2 GB).

    - DiT en bf16 (sin int8): las piezas chicas y los buffers viven en la GPU; cada uno de los bloques de
      `dit.blocks` se sube justo antes de usarse desde una copia fijada en RAM y se suelta después.
    - VAE (DAC, 371 M) decodifica en la CPU: nunca sube a la GPU.
    - `load_models_to_device` queda sin efecto (lo manejan los ganchos).
    """
    eng = pipe.engine
    dit = eng.dit
    blocks = dit.blocks
    dit.blocks = torch.nn.ModuleList()
    dit.to("cuda")                       # todo menos los bloques
    dit.blocks = blocks
    for blk in blocks:
        for mod in blk.modules():
            for bn, b in list(mod._buffers.items()):
                if b is not None:
                    mod._buffers[bn] = b.to("cuda")
        cpu = {}
        for pn, prm in blk.named_parameters():
            cpu[pn] = prm.data.to(torch.bfloat16).contiguous().pin_memory()
            prm.data = cpu[pn]

        def pre(m, args, _cpu=cpu):
            for pn, prm in m.named_parameters():
                prm.data = _cpu[pn].to("cuda", non_blocking=True)

        def post(m, args, out, _cpu=cpu):
            for pn, prm in m.named_parameters():
                prm.data = _cpu[pn]
            return out
        blk.register_forward_pre_hook(pre)
        blk.register_forward_hook(post)
    eng.load_models_to_device = lambda names=[]: None
    vae = eng.vae.to("cpu").float()
    dec = vae.decode                    # ya trae el recorte a _DECODE_SECONDS de gen_moss_sfx

    def decode_cpu(z):
        with torch.autocast("cuda", enabled=False), torch.no_grad():
            return dec(z.detach().to("cpu", torch.float32))
    vae.decode = decode_cpu
    return pipe


def cmd_sfx(only, steps, quant, cap_gb, bajo=False):
    os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
    sys.path.insert(0, str(AUDIO / "scripts"))
    import soundfile as sf
    import torch
    import gen_moss_sfx as moss

    out = TMP / "sfx"
    out.mkdir(parents=True, exist_ok=True)
    def hecho(j):
        if (out / f"{j['id']}.wav").exists():
            return True
        if j.get("pasos"):
            base = (int(j["id"][-1]) - 1) * STEP_VARIANTS
            return (SFX_OUT / f"{j['nombre']}-{base + 1}.ogg").exists()
        return (SFX_OUT / f"{j['id']}.ogg").exists()
    jobs = [j for j in sfx_jobs() if (not only or j["id"] in only or j["nombre"] in only) and not hecho(j)]
    if not jobs:
        print("nada que hacer")
        return
    print(f"[moss] {len(jobs)} clips por hacer", flush=True)
    if bajo:
        cap_gb, quant = 0.9, "none"
    esperar_gpu(int(cap_gb * 1024) + 200)
    total = torch.cuda.get_device_properties(0).total_memory / 2**30
    torch.cuda.set_per_process_memory_fraction(min(1.0, cap_gb / total))
    t0 = time.time()
    pipe = moss.load_pipe(None if quant == "none" else quant)
    if bajo:
        moss_poca_vram(pipe, torch)
    print(f"[moss] cargado en {time.time() - t0:.1f} s (quant={quant}, tope {cap_gb} GB, poca_vram={bajo})", flush=True)
    for j in jobs:
        try:
            _sfx_clip(j, pipe, moss, sf, torch, out, steps, quant, cap_gb)
        except Exception as e:  # noqa: BLE001
            print(f"FALLÓ {j['id']}: {type(e).__name__}: {e}"[:300], flush=True)
            anotar(dict(j, ok=False, error=f"{type(e).__name__}: {e}"[:300], modelo="MOSS-SoundEffect-v2.0"))
    print(f"[moss] total {time.time() - t0:.0f} s", flush=True)


def _sfx_clip(j, pipe, moss, sf, torch, out, steps, quant, cap_gb):
        esperar_gpu(int(cap_gb * 1024) + 200)
        moss._DECODE_SECONDS["v"] = j["s"]
        torch.cuda.reset_peak_memory_stats()
        t1 = time.time()
        audio = None
        for intento in range(20):
            try:
                audio = pipe(prompt=j["prompt"], seconds=j["s"], num_inference_steps=steps, cfg_scale=4.0,
                             sigma_shift=5.0, seed=j["seed"])
                break
            except torch.OutOfMemoryError:
                try:
                    pipe.engine.load_models_to_device([])
                except Exception:  # noqa: BLE001
                    pass
                torch.cuda.empty_cache()
                print(f"OOM en {j['id']} (GPU libre {gpu_free_mb()} MB); reintento {intento + 1} en 30 s", flush=True)
                time.sleep(30)
        dt = time.time() - t1
        if audio is None:
            anotar(dict(j, ok=False, error="OOM", modelo="MOSS-SoundEffect-v2.0"))
            return
        sf.write(out / f"{j['id']}.wav", audio[0].float().cpu().numpy().T, pipe.sample_rate)
        anotar(dict(j, ok=True, modelo="MOSS-SoundEffect-v2.0", pasos_difusion=steps, quant=quant, poca_vram=cap_gb < 1, segundos_gpu=round(dt, 1),
                    vram_max_mb=round(torch.cuda.max_memory_allocated() / 2**20)))
        print(f"  ok {j['id']} {dt:.1f} s", flush=True)
        try:
            cmd_convertir()
            cmd_catalogo()
        except Exception as e:  # noqa: BLE001
            print(f"  conversión falló {j['id']}: {e}"[:300], flush=True)


# ---- convertir a OGG ----------------------------------------------------------------------------------------------
def ff(*args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[:400])


def peak_db(p):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", str(p), "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    for line in r.splitlines():
        if "max_volume" in line:
            return float(line.split("max_volume:")[1].split("dB")[0])
    return 0.0


def convertir_musica(src, dst, recorte=None):
    """Quita silencio de cola, fundido 200 ms al inicio y al fin, -18 LUFS, 44.1 kHz estéreo, OGG q5."""
    filtros = []
    if recorte:
        filtros.append(f"atrim=0:{recorte}")
    filtros += ["areverse", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1", "areverse"]
    tmp = dst.with_suffix(".trim.wav")
    ff("-i", str(src), "-af", ",".join(filtros), str(tmp))
    d = ffprobe_dur(tmp)
    fo = 0.7 if recorte and recorte < 6 else 0.2   # los jingles de 4-5 s se cortan a media cola: fundido más largo
    ff("-i", str(tmp), "-af", f"afade=t=in:st=0:d=0.2,afade=t=out:st={max(0, d - fo):.2f}:d={fo},loudnorm=I=-18:TP=-1.5:LRA=11",
       "-ar", "44100", "-ac", "2", "-c:a", "libvorbis", "-q:a", "5", str(dst))
    tmp.unlink()


def convertir_sfx(src, dst, mono=True, loop=False):
    """Recorta silencio al inicio y al fin, pico a -3 dB, mono 44.1 kHz, OGG q5. Los loops llevan fundido corto."""
    tmp = dst.with_suffix(".trim.wav")
    ff("-i", str(src), "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
       "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse", "-ac", "1" if mono else "2", str(tmp))
    gain = -3.0 - peak_db(tmp)
    d = ffprobe_dur(tmp)
    extra = f",afade=t=in:st=0:d=0.05,afade=t=out:st={max(0, d - 0.05):.2f}:d=0.05" if loop else ""
    ff("-i", str(tmp), "-af", f"volume={gain:.2f}dB{extra}", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "5", str(dst))
    tmp.unlink()


def cortar_pasos(src, prefijo, n=STEP_VARIANTS):
    """Parte un clip de varios pasos en golpes sueltos (por energía) y guarda los n más claros como variantes."""
    import numpy as np
    import soundfile as sf
    x, sr = sf.read(src)
    if x.ndim > 1:
        x = x.mean(1)
    win = int(sr * 0.01)
    env = np.array([np.abs(x[i:i + win]).max() for i in range(0, len(x) - win, win)])
    thr = max(env.max() * 0.25, 0.02)
    onsets = []
    i = 0
    while i < len(env):
        if env[i] > thr and (not onsets or i - onsets[-1] > 25):   # mínimo 250 ms entre pasos
            onsets.append(i)
            i += 25
        else:
            i += 1
    clips = []
    for k, o in enumerate(onsets):
        a = max(0, (o - 2) * win)
        fin = onsets[k + 1] * win - win if k + 1 < len(onsets) else len(x)
        b = min(fin, a + int(sr * 0.45))
        seg = x[a:b]
        if len(seg) > sr * 0.08:
            clips.append((float(np.abs(seg).max()), seg))
    clips.sort(key=lambda c: -c[0])
    outs = []
    for k, (_, seg) in enumerate(clips[:n]):
        p = TMP / "sfx" / f"{prefijo}-corte{k + 1}.wav"
        sf.write(p, seg, sr)
        outs.append(p)
    return outs


def cmd_convertir():
    MUSIC_OUT.mkdir(parents=True, exist_ok=True)
    SFX_OUT.mkdir(parents=True, exist_ok=True)
    for w in sorted((TMP / "musica").glob("*.wav")):
        dst = MUSIC_OUT / (w.stem + ".ogg")
        if dst.exists():
            continue
        try:
            convertir_musica(w, dst, recorte=recorte_stinger(w.stem))
            print("ogg", dst.name, ffprobe_dur(dst), "s")
        except Exception as e:  # noqa: BLE001
            print("FALLÓ", w.name, e)
    loops = LOOPS
    for w in sorted((TMP / "sfx").glob("*.wav")):
        if "-corte" in w.stem:
            continue
        if "-lote" in w.stem:
            nombre, lote = w.stem.rsplit("-lote", 1)
            base = (int(lote) - 1) * STEP_VARIANTS
            if all((SFX_OUT / f"{nombre}-{base + k + 1}.ogg").exists() for k in range(STEP_VARIANTS)):
                continue               # ya cortado (y así no hace falta numpy en el python del sistema)
            try:
                cortes = cortar_pasos(w, w.stem)
            except Exception as e:  # noqa: BLE001  (paso-pasto-lote1 nunca dio cortes buenos; sin numpy tampoco)
                print("FALLÓ", w.name, e)
                continue
            for k, c in enumerate(cortes):
                dst = SFX_OUT / f"{nombre}-{base + k + 1}.ogg"
                if not dst.exists():
                    convertir_sfx(c, dst)
                    print("ogg", dst.name, ffprobe_dur(dst), "s")
            continue
        dst = SFX_OUT / (w.stem + ".ogg")
        if dst.exists():
            continue
        nombre = w.stem.rsplit("-", 1)[0]
        try:
            convertir_sfx(w, dst, loop=nombre in loops)
            print("ogg", dst.name, ffprobe_dur(dst), "s")
        except Exception as e:  # noqa: BLE001
            print("FALLÓ", w.name, e)


# ---- CLAP ------------------------------------------------------------------------------------------------------------
def clap_label_musica(j):
    z = ZONES.get(j["zona"])
    if j["zona"] == "stinger":
        return STINGERS[j["capa"]][0].split(",")[0]
    return z[j["capa"] if j["capa"] in z else "calma"].split(",")[0] + (" with driving percussion" if j["capa"] == "tension" else "")


def cmd_clap():
    import numpy as np
    import torch
    from transformers import ClapModel, ClapProcessor
    torch.set_num_threads(8)
    model = ClapModel.from_pretrained("laion/clap-htsat-fused").eval()
    proc = ClapProcessor.from_pretrained("laion/clap-htsat-fused")

    def temb(texts):
        with torch.no_grad():
            e = model.get_text_features(**proc(text=texts, return_tensors="pt", padding=True))
        return torch.nn.functional.normalize(e, dim=-1)

    def aemb(path, offsets):
        embs = []
        for o in offsets:
            raw = subprocess.run(["ffmpeg", "-v", "quiet", "-ss", str(o), "-t", "10", "-i", str(path), "-ac", "1", "-ar", "48000",
                                  "-f", "f32le", "-"], capture_output=True).stdout
            x = np.frombuffer(raw, dtype=np.float32).copy()
            if len(x) < 2400:          # < 50 ms: no hay nada que medir
                continue
            if len(x) < 48000:         # clips cortos (golpes, menú): se rellenan con silencio hasta 1 s
                x = np.concatenate([x, np.zeros(48000 - len(x), dtype=np.float32)])
            with torch.no_grad():
                e = model.get_audio_features(**proc(audio=[x], sampling_rate=48000, return_tensors="pt"))
            embs.append(torch.nn.functional.normalize(e, dim=-1))
        if not embs:
            return None
        return torch.nn.functional.normalize(torch.cat(embs).mean(0, keepdim=True), dim=-1)

    out_path = HERE / "clap.json"
    out = json.loads(out_path.read_text()) if out_path.exists() else {}
    # música: etiqueta propia contra las de todas las zonas
    mjobs = {j["id"]: j for j in music_jobs() + stinger_jobs()}
    labels = {}
    for j in mjobs.values():
        labels.setdefault(j["zona"] + "/" + j["capa"], clap_label_musica(j))
    mkeys = list(labels)
    E_m = temb([labels[k] for k in mkeys])
    E_voc = temb(["instrumental music without singing", "music with a person singing lyrics"])
    for ogg in sorted(MUSIC_OUT.glob("*.ogg")):
        rel = "music-ia/" + ogg.name
        if rel in out:
            continue
        j = mjobs.get(ogg.stem)
        if not j:
            continue
        d = ffprobe_dur(ogg)
        ea = aemb(ogg, [0.0] if d < 20 else [2.0, d / 2 - 5, max(2.0, d - 12)])
        if ea is None:
            continue
        sims = (ea @ E_m.T)[0].tolist()
        propio = j["zona"] + "/" + j["capa"]
        order = sorted(range(len(mkeys)), key=lambda i: -sims[i])
        voz = torch.softmax(100 * (ea @ E_voc.T)[0], -1)[1].item()
        out[rel] = dict(etiqueta=labels[propio], sim_propio=round(sims[mkeys.index(propio)], 3), puesto=[mkeys[i] for i in order].index(propio) + 1,
                        top1=mkeys[order[0]], sim_top1=round(sims[order[0]], 3), prob_voz=round(voz, 3), duracion=d)
        print(rel, out[rel], flush=True)
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    # efectos: etiqueta propia contra las de todos los efectos
    slabels = {k: v[0].split(",")[0] for k, v in SFX.items()}
    slabels.update({k: "footsteps on " + k.split("-")[1].replace("pasto", "grass").replace("piedra", "stone").replace("madera", "wood")
                     .replace("arena", "sand").replace("nieve", "snow") for k in STEP_SURFACES})
    skeys = list(slabels)
    E_s = temb([slabels[k] for k in skeys])
    for ogg in sorted(SFX_OUT.glob("*.ogg")):
        rel = "sfx-ia/" + ogg.name
        if rel in out:
            continue
        nombre = ogg.stem.rsplit("-", 1)[0]
        if nombre not in slabels:
            continue
        ea = aemb(ogg, [0.0])
        if ea is None:
            continue
        sims = (ea @ E_s.T)[0].tolist()
        order = sorted(range(len(skeys)), key=lambda i: -sims[i])
        out[rel] = dict(etiqueta=slabels[nombre], sim_propio=round(sims[skeys.index(nombre)], 3), puesto=[skeys[i] for i in order].index(nombre) + 1,
                        top1=skeys[order[0]], sim_top1=round(sims[order[0]], 3), duracion=ffprobe_dur(ogg))
        print(rel, out[rel], flush=True)
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1))


# ---- catálogo -------------------------------------------------------------------------------------------------------
def cmd_catalogo():
    runs = {}
    if RUNS.exists():
        for line in RUNS.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                runs[r["id"]] = r
    clap = json.loads((HERE / "clap.json").read_text()) if (HERE / "clap.json").exists() else {}
    items = []
    for ogg in sorted(MUSIC_OUT.glob("*.ogg")):
        r = runs.get(ogg.stem, {})
        c = clap.get("music-ia/" + ogg.name, {})
        items.append(dict(archivo="public/assets/music-ia/" + ogg.name, tipo="stinger" if ogg.stem.startswith("stinger-") else "musica",
                          zona=r.get("zona"), capa=r.get("capa"), variante=int(ogg.stem.rsplit("-", 1)[1]), bpm=r.get("bpm"),
                          tonalidad=r.get("key"), prompt=r.get("caption"), semilla=r.get("seed"), modelo=r.get("modelo"), lm=r.get("lm"),
                          duracion_s=ffprobe_dur(ogg), segundos_gpu=r.get("segundos_gpu"), kb=ogg.stat().st_size // 1024,
                          clap_sim=c.get("sim_propio"), clap_puesto=c.get("puesto"), clap_top1=c.get("top1"), clap_prob_voz=c.get("prob_voz")))
    for ogg in sorted(SFX_OUT.glob("*.ogg")):
        nombre, var = ogg.stem.rsplit("-", 1)
        r = runs.get(ogg.stem)
        if r is None and nombre in STEP_SURFACES:   # variantes cortadas de un lote
            r = runs.get(f"{nombre}-lote{1 if int(var) <= STEP_VARIANTS else 2}", {})
        r = r or {}
        c = clap.get("sfx-ia/" + ogg.name, {})
        items.append(dict(archivo="public/assets/sfx-ia/" + ogg.name, tipo="sfx", nombre=nombre, variante=int(var), prompt=r.get("prompt"),
                          semilla=r.get("seed"), modelo=r.get("modelo"), pasos_difusion=r.get("pasos_difusion"), duracion_s=ffprobe_dur(ogg),
                          segundos_gpu=r.get("segundos_gpu"), kb=ogg.stat().st_size // 1024,
                          clap_sim=c.get("sim_propio"), clap_puesto=c.get("puesto"), clap_top1=c.get("top1")))
    (HERE / "catalogo.json").write_text(json.dumps(dict(generado=time.strftime("%Y-%m-%d %H:%M"), archivos=len(items), items=items),
                                                   ensure_ascii=False, indent=1))
    print("catálogo:", len(items), "archivos")


def cmd_todo():
    """Corre todo, reanudable: música (ACE) → stingers (ACE) → efectos (MOSS) → convertir → CLAP → catálogo."""
    ace = str(AUDIO / "ACE-Step-1.5/.venv/bin/python")
    mossp = str(AUDIO / "venv-moss/bin/python")
    me = str(Path(__file__).resolve())
    pasos = [([ace, me, "musica"], {"MAX_CUDA_VRAM": "3"}), ([ace, me, "stingers"], {"MAX_CUDA_VRAM": "3"}),
             ([mossp, me, "sfx"], {"TORCHDYNAMO_DISABLE": "1"}), ([sys.executable, me, "convertir"], {}),
             ([mossp, me, "clap"], {}), ([sys.executable, me, "catalogo"], {})]
    for cmd, env in pasos:
        print(f"\n===== {cmd[-1]} ({time.strftime('%H:%M:%S')}) =====", flush=True)
        r = subprocess.run(cmd, env={**os.environ, **env}, cwd=str(PROJ))
        print(f"===== {cmd[-1]} terminó con código {r.returncode} =====", flush=True)
    print("TODO LISTO", time.strftime("%Y-%m-%d %H:%M:%S"), flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("etapa", nargs="?", default="todo", choices=["todo", "musica", "stingers", "sfx", "convertir", "clap", "catalogo", "lista"])
    ap.add_argument("ids", nargs="*", help="sólo estos ids o zonas/nombres")
    ap.add_argument("--sin-lm", action="store_true", help="música sin el planeador LM 0.6B (más rápido)")
    ap.add_argument("--steps", type=int, default=100, help="pasos de difusión de MOSS (oficial: 100)")
    ap.add_argument("--quant", default="int8", help="MOSS: int8 | none")
    ap.add_argument("--cap-gb", type=float, default=2.6, help="MOSS: tope de VRAM del proceso")
    ap.add_argument("--poca-vram", action="store_true",
                    help="MOSS con bloques del DiT subidos de a uno y VAE en CPU (~0.5 GB); también STONES_POCA_VRAM=1")
    a = ap.parse_args()
    only = set(a.ids)
    if a.etapa == "todo":
        cmd_todo()
    elif a.etapa == "lista":
        for j in music_jobs() + stinger_jobs():
            print(j["id"], j["bpm"], j["key"])
        for j in sfx_jobs():
            print(j["id"], j["s"], "s")
    elif a.etapa == "musica":
        cmd_musica(music_jobs(), only, lm=not (a.sin_lm or os.environ.get("STONES_SIN_LM") == "1"))
    elif a.etapa == "stingers":
        cmd_musica(stinger_jobs(), only, lm=not (a.sin_lm or os.environ.get("STONES_SIN_LM") == "1"))
    elif a.etapa == "sfx":
        cmd_sfx(only, a.steps, a.quant, a.cap_gb, bajo=a.poca_vram or os.environ.get("STONES_POCA_VRAM") == "1")
    elif a.etapa == "convertir":
        cmd_convertir()
    elif a.etapa == "clap":
        cmd_clap()
    elif a.etapa == "catalogo":
        cmd_catalogo()


if __name__ == "__main__":
    main()
