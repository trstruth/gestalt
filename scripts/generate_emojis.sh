#!/usr/bin/env bash
set -euo pipefail

# Generate emoji PNG assets directly from the Unicode emoji list and record the
# mapping between filenames and codepoint sequences.
#
# Requirements:
#   - curl
#   - python3
#   - ImageMagick's `convert`
#   - A color emoji font (default: Noto Color Emoji). Override with $EMOJI_FONT.

VERSION="${VERSION:-15.1}"
FONT="${EMOJI_FONT:-Noto Color Emoji}"
POINTSIZE="${POINTSIZE:-128}"
FONT_FILE_DEFAULT="/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
MAGICK_BINARY="${MAGICK_CMD:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${OUT_DIR:-${ROOT}/emojis_generated}"

LIST_PATH="${OUT_DIR}/emoji-test.txt"
TSV_PATH="${OUT_DIR}/emoji-list.tsv"
MAP_PATH="${OUT_DIR}/emoji-map.json"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }

# ImageMagick: allow override via $MAGICK_CMD (e.g., an AppImage path).
if [[ -n "${MAGICK_BINARY}" ]]; then
  CONVERT_CMD="${MAGICK_BINARY}"
elif command -v convert >/dev/null 2>&1; then
  CONVERT_CMD="convert"
elif command -v magick >/dev/null 2>&1; then
  CONVERT_CMD="magick"
else
  echo "ImageMagick ('convert' or 'magick') is required; set MAGICK_CMD to override" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

echo "Downloading Unicode emoji list ${VERSION} -> ${LIST_PATH}"
curl -fsSL "https://unicode.org/Public/emoji/${VERSION}/emoji-test.txt" -o "${LIST_PATH}"

echo "Parsing emoji list -> ${TSV_PATH}"
python3 - "${LIST_PATH}" <<'PY' > "${TSV_PATH}"
import re, pathlib, sys
out = []
with open(sys.argv[1], encoding="utf-8") as f:
    for line in f:
        if not line.strip() or line.startswith("#"):
            continue
        codes_part, rest = line.split(";", 1)
        status, rest = rest.split("#", 1)
        seq = [int(cp, 16) for cp in codes_part.strip().split()]
        glyph = "".join(chr(c) for c in seq)
        name = rest.split(" ", 1)[1].strip()
        fname = "-".join(f"U{c:04X}" for c in seq) + ".png"
        out.append((glyph, fname, name))
for glyph, fname, name in out:
    print(f"{glyph}\t{fname}\t{name}")
PY

echo "Rendering PNGs to ${OUT_DIR} using font '${FONT}'"
# Prefer explicit font file if available (helps ImageMagick find NotoColorEmoji)
FONT_SPEC="${FONT}"
if [[ -z "${EMOJI_FONT:-}" && -f "${FONT_FILE_DEFAULT}" ]]; then
  FONT_SPEC="${FONT_FILE_DEFAULT}"
fi

# Use Pango renderer to better support color emoji fonts.
while IFS=$'\t' read -r glyph fname name; do
  "${CONVERT_CMD}" -background none -font "${FONT_SPEC}" -pointsize "${POINTSIZE}" \
                   -gravity center "pango:${glyph}" "${OUT_DIR}/${fname}"
done < "${TSV_PATH}"

echo "Building JSON mapping -> ${MAP_PATH}"
python3 - "${TSV_PATH}" <<'PY' > "${MAP_PATH}"
import json, sys, pathlib
tsv_path = pathlib.Path(sys.argv[1])
items = []
for line in tsv_path.read_text(encoding="utf-8").splitlines():
    glyph, fname, name = line.split("\t")
    cps = [f"U{ord(ch):04X}" for ch in glyph]
    items.append({"codepoints": cps, "filename": fname, "name": name})
json.dump(items, sys.stdout, ensure_ascii=False, indent=2)
print()
PY

echo "Done. Assets and mappings are in ${OUT_DIR}"
