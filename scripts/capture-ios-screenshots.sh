#!/usr/bin/env bash

set -euo pipefail

OUTPUT_DIR="${CLIENTIFIC_IOS_SCREENSHOT_DIR:-/tmp/clientific-ios-screenshots}"
DEVICE_ID="${CLIENTIFIC_IOS_SIMULATOR_DEVICE_ID:-booted}"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR"/*.png

if [[ $# -eq 0 ]]; then
  set -- screenshot
fi

capture_index=1

for raw_name in "$@"; do
  safe_name="$(printf '%s' "$raw_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-_')"

  if [[ -z "$safe_name" ]]; then
    safe_name="screenshot-$capture_index"
  fi

  destination="$OUTPUT_DIR/$safe_name.png"

  if [[ $capture_index -gt 1 ]]; then
    printf 'Navigate the simulator to "%s", then press Enter to capture...' "$raw_name"
    read -r _
  fi

  xcrun simctl io "$DEVICE_ID" screenshot "$destination" >/dev/null
  printf 'Saved %s\n' "$destination"
  capture_index=$((capture_index + 1))
done

printf 'Fresh screenshots are in %s\n' "$OUTPUT_DIR"
