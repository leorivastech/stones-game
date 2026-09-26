#!/usr/bin/env bash
# Corre todas las etapas de generar.py con el venv que le toca a cada una.
# Uso: bash studio/musica/ia/generar.sh [musica|stingers|sfx|convertir|clap|catalogo|todo] [ids…]
set -u
cd "$(dirname "$0")/../../.."
AUDIO="${STONES_AUDIO_MODELOS:-$HOME/Development/lumi/pruebas/2026-09-25/c-audio}"
ACE="$AUDIO/ACE-Step-1.5/.venv/bin/python"
MOSS="$AUDIO/venv-moss/bin/python"
G=studio/musica/ia/generar.py
etapa="${1:-todo}"; shift || true
case "$etapa" in
  musica)    MAX_CUDA_VRAM=3 "$ACE" $G musica "$@" ;;
  stingers)  MAX_CUDA_VRAM=3 "$ACE" $G stingers "$@" ;;
  sfx)       TORCHDYNAMO_DISABLE=1 "$MOSS" $G sfx "$@" ;;
  convertir) python3 $G convertir ;;
  clap)      "$MOSS" $G clap ;;
  catalogo)  python3 $G catalogo ;;
  todo)
    MAX_CUDA_VRAM=3 "$ACE" $G musica && MAX_CUDA_VRAM=3 "$ACE" $G stingers
    TORCHDYNAMO_DISABLE=1 "$MOSS" $G sfx
    python3 $G convertir && "$MOSS" $G clap && python3 $G catalogo ;;
  *) echo "etapa desconocida: $etapa"; exit 1 ;;
esac
