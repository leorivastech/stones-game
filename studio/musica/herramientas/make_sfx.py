"""Efectos y ambientes elegidos → OGG mono normalizados en sfx_out/ y amb_out/.

Efectos: se recorta el silencio del inicio y se normaliza el pico a -3 dB.
Ambientes: se normalizan a -26 LUFS (suenan suaves; el juego baja aún más su volumen).
"""
import json
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent
P = HERE / "packs"
SFX_OUT = HERE / "sfx_out"
AMB_OUT = HERE / "amb_out"
SFX_OUT.mkdir(exist_ok=True)
AMB_OUT.mkdir(exist_ok=True)

KEN = "Kenney · CC0 · https://kenney.nl/assets"
RD = "rubberduck · CC0 · https://opengameart.org/users/rubberduck"

# nombre en el juego: (archivo de origen, crédito)
SFX = {
    "bow": ("oga-battle/battle_sound_effects/Bow.wav", "artisticdude · CC0 · https://opengameart.org/content/battle-sound-effects"),
    "arrow-hit": ("kenney-impact/Audio/impactSoft_medium_000.ogg", KEN + "/impact-sounds"),
    "swing": ("oga-swishes/swishes/swish-1.wav", "artisticdude · CC0 · https://opengameart.org/content/swishes-sound-pack"),
    "swing2": ("oga-swishes/swishes/swish-2.wav", "artisticdude · CC0 · https://opengameart.org/content/swishes-sound-pack"),
    "hit": ("kenney-impact/Audio/impactPunch_medium_000.ogg", KEN + "/impact-sounds"),
    "hit2": ("kenney-impact/Audio/impactPunch_medium_001.ogg", KEN + "/impact-sounds"),
    "armor": ("kenney-impact/Audio/impactPlate_light_000.ogg", KEN + "/impact-sounds"),
    "bump": ("kenney-impact/Audio/impactGeneric_light_000.ogg", KEN + "/impact-sounds"),
    "die": ("oga-80creature2/die_01.ogg", RD + " (80 CC0 creature SFX #2)"),
    "wolf": ("oga-80creature/howl.ogg", RD + " (80 CC0 creature SFX)"),
    "growl": ("oga-80creature/roar_01.ogg", RD + " (80 CC0 creature SFX)"),
    "boar": ("oga-80creature/grunt_02.ogg", RD + " (80 CC0 creature SFX)"),
    "scorpion": ("oga-80creature/bug_01.ogg", RD + " (80 CC0 creature SFX)"),
    "step-grass": ("kenney-impact/Audio/footstep_grass_000.ogg", KEN + "/impact-sounds"),
    "step-grass2": ("kenney-impact/Audio/footstep_grass_001.ogg", KEN + "/impact-sounds"),
    "step-snow": ("kenney-impact/Audio/footstep_snow_000.ogg", KEN + "/impact-sounds"),
    "step-snow2": ("kenney-impact/Audio/footstep_snow_001.ogg", KEN + "/impact-sounds"),
    "step-stone": ("kenney-impact/Audio/footstep_concrete_000.ogg", KEN + "/impact-sounds"),
    "step-stone2": ("kenney-impact/Audio/footstep_concrete_001.ogg", KEN + "/impact-sounds"),
    "step-wood": ("kenney-impact/Audio/footstep_wood_000.ogg", KEN + "/impact-sounds"),
    "step-wood2": ("kenney-impact/Audio/footstep_wood_001.ogg", KEN + "/impact-sounds"),
    "step-sand": ("kenney-impact/Audio/footstep_carpet_000.ogg", KEN + "/impact-sounds"),
    "step-sand2": ("kenney-impact/Audio/footstep_carpet_001.ogg", KEN + "/impact-sounds"),
    "door-open": ("kenney-rpg/Audio/doorOpen_1.ogg", KEN + "/rpg-audio"),
    "door-close": ("kenney-rpg/Audio/doorClose_1.ogg", KEN + "/rpg-audio"),
    "chest": ("oga-80rpg/lock_01.ogg", RD + " (80 CC0 RPG SFX)"),
    "lever": ("oga-100sfx2/sfx100v2_switch_01.ogg", RD + " (100 CC0 SFX #2)"),
    "splash": ("oga-water/splash_01.ogg", RD + " (40 CC0 water SFX)"),
    "coin": ("oga-coins12/coin.1.ogg", "StarNinjas · CC0 · https://opengameart.org/content/12-coin-sound-effects"),
    "coins-sell": ("oga-80rpg/item_coins_04.ogg", RD + " (80 CC0 RPG SFX)"),
    "gem": ("oga-80rpg/item_gem_01.ogg", RD + " (80 CC0 RPG SFX)"),
    "ui-move": ("kenney-interface/Audio/select_001.ogg", KEN + "/interface-sounds"),
    "ui-ok": ("kenney-interface/Audio/confirmation_001.ogg", KEN + "/interface-sounds"),
    "ui-back": ("kenney-interface/Audio/back_001.ogg", KEN + "/interface-sounds"),
    "ui-error": ("kenney-interface/Audio/error_001.ogg", KEN + "/interface-sounds"),
    "jingle-mission": ("kenney-jingles/Audio/Pizzicato jingles/jingles_PIZZI00.ogg", KEN + "/music-jingles"),
    "jingle-fame": ("kenney-jingles/Audio/Steel jingles/jingles_STEEL00.ogg", KEN + "/music-jingles"),
    "jingle-free": ("kenney-jingles/Audio/8-Bit jingles/jingles_NES00.ogg", KEN + "/music-jingles"),
    "jingle-buy": ("kenney-jingles/Audio/Hit jingles/jingles_HIT00.ogg", KEN + "/music-jingles"),
}

AMB = {
    "jungle": ("single/birds-isaiah658_0.ogg", "isaiah658 · CC0 · https://opengameart.org/content/ambient-bird-sounds"),
    "desert": ("single/wind1.wav", "Luke.RUSTLTD · CC0 · https://opengameart.org/content/wind1"),
    "snow": ("single/wind2.wav", "Luke.RUSTLTD · CC0 · https://opengameart.org/content/wind1"),
    "cave": ("single/dungeon_ambient_1_0.ogg", "JaggedStone · CC0 · https://opengameart.org/content/loopable-dungeon-ambience"),
    "sea": ("single/wave_01_cc0-18363__jasinski__alkaibeach.flac", "jasinski · CC0 · https://opengameart.org/content/beach-ocean-waves"),
    "fire": ("single/fire-1_0.ogg", "AntumDeluge · CC0 · https://opengameart.org/content/fire-crackling"),
}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def peak(path):
    r = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"])
    for line in r.stderr.splitlines():
        if "max_volume" in line:
            return float(line.split(":")[1].split()[0])
    return 0.0


credits = {"sfx": {}, "amb": {}}
for name, (src, credit) in SFX.items():
    out = SFX_OUT / f"{name}.ogg"
    tmp = SFX_OUT / f"_{name}.wav"
    r = run(["ffmpeg", "-v", "error", "-y", "-i", str(P / src), "-af",
             "silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:3", "-ac", "1", "-ar", "44100", str(tmp)])
    if r.returncode:
        print("FALLÓ", name, r.stderr[:200])
        continue
    gain = -3.0 - peak(tmp)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"volume={gain}dB", "-c:a", "libvorbis", "-q:a", "4", str(out)])
    tmp.unlink()
    credits["sfx"][name] = {"src": src, "credit": credit}
    print(f"sfx {name:15} {out.stat().st_size // 1024:3} KB")

for name, (src, credit) in AMB.items():
    out = AMB_OUT / f"{name}.ogg"
    r = run(["ffmpeg", "-v", "error", "-y", "-i", str(P / src), "-af", "loudnorm=I=-26:TP=-3", "-ac", "1", "-ar", "44100",
             "-c:a", "libvorbis", "-q:a", "3", str(out)])
    if r.returncode:
        print("FALLÓ", name, r.stderr[:200])
        continue
    dur = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)]).stdout.strip()
    credits["amb"][name] = {"src": src, "credit": credit, "duration": round(float(dur))}
    print(f"amb {name:10} {round(float(dur)):4}s {out.stat().st_size // 1024:4} KB")

(HERE / "sfx_credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=1))
