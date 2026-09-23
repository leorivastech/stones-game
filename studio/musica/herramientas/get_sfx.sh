#!/usr/bin/env bash
# Baja paquetes CC0 de efectos (Kenney + OpenGameArt) a zips/ y los descomprime en packs/.
set -u
cd "$(dirname "$0")"
mkdir -p zips packs
get() {
  local name="$1" url="$2"
  if [ ! -s "zips/$name" ]; then
    curl -sSL --fail -o "zips/$name" "$url" || { echo "FALLÓ $name"; return; }
  fi
  mkdir -p "packs/${name%.*}"
  unzip -oq "zips/$name" -d "packs/${name%.*}" && echo "ok $name"
}
get kenney-rpg.zip "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip"
get kenney-impact.zip "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"
get kenney-interface.zip "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip"
get kenney-jingles.zip "https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip"
get oga-80rpg.zip "https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip"
get oga-80creature.zip "https://opengameart.org/sites/default/files/80-CC0-creature-SFX_0.zip"
get oga-80creature2.zip "https://opengameart.org/sites/default/files/80-CC0-creature-sfx-2.zip"
get oga-100sfx2.zip "https://opengameart.org/sites/default/files/sfx_100_v2.zip"
get oga-loops.zip "https://opengameart.org/sites/default/files/sfx_loops.zip"
get oga-water.zip "https://opengameart.org/sites/default/files/water-splash-slime-sfx.zip"
get oga-tinysized.zip "https://opengameart.org/sites/default/files/tinysized.zip"
get oga-rpgpack.zip "https://opengameart.org/sites/default/files/rpg_sound_pack.zip"
get oga-battle.zip "https://opengameart.org/sites/default/files/battle_sound_effects_0.zip"
get oga-swishes.zip "https://opengameart.org/sites/default/files/swishes.zip"
get oga-thwack.zip "https://opengameart.org/sites/default/files/thwack-1.0.zip"
get oga-coins12.zip "https://opengameart.org/sites/default/files/coins_-_starninjas.zip"
get oga-steps.zip "https://opengameart.org/sites/default/files/%5Bkdd%5DDifferentSteps_0.zip"
# Ambientes sueltos
mkdir -p packs/single
for u in \
  "https://opengameart.org/sites/default/files/dungeon_ambient_1_0.ogg" \
  "https://opengameart.org/sites/default/files/fire-1_0.ogg" \
  "https://opengameart.org/sites/default/files/wind1.wav" \
  "https://opengameart.org/sites/default/files/wind2.wav" \
  "https://opengameart.org/sites/default/files/wind3.wav" \
  "https://opengameart.org/sites/default/files/birds-isaiah658_0.ogg" \
  "https://opengameart.org/sites/default/files/VistulaShort_0.mp3" \
  "https://opengameart.org/sites/default/files/sand_footsteps_0.mp3" \
  "https://opengameart.org/sites/default/files/Trot.ogg" \
  "https://opengameart.org/sites/default/files/wave_01_cc0-18363__jasinski__alkaibeach.flac"; do
  f="packs/single/$(basename "$u")"
  [ -s "$f" ] || curl -sSL --fail -o "$f" "$u" && echo "ok $(basename "$u")"
done
