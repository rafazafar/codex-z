#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: scripts/release/macos/package.sh <payload-root> <app-path> <dmg-path> <bundle-version>" >&2
  exit 2
fi

PAYLOAD_ROOT="$1"
APP_PATH="$2"
DMG_PATH="$3"
BUNDLE_VERSION="$4"

case "$APP_PATH" in
  */codex-z.app) ;;
  *) echo "error: app output must end with /codex-z.app" >&2; exit 2 ;;
esac
case "$DMG_PATH" in
  *.dmg) ;;
  *) echo "error: DMG output must end with .dmg" >&2; exit 2 ;;
esac

for relative in \
  bin/codex-z \
  libexec/codex-z-shim \
  libexec/codex-z-updater \
  runtime/node \
  LICENSE \
  NOTICE \
  app/codex-z-distribution.json \
  app/desktop-controller.mjs \
  app/host-runtime.mjs \
  app/renderer-extension.js \
  licenses/Node.js-LICENSE.txt \
  licenses/Anthropic-SDK-LICENSE.txt \
  licenses/Claude-Agent-SDK-LICENSE.md \
  licenses/MCP-SDK-LICENSE.txt \
  licenses/diff-LICENSE.txt \
  licenses/zod-LICENSE.txt \
  THIRD_PARTY_NOTICES.txt; do
  test -f "$PAYLOAD_ROOT/$relative" || {
    echo "error: missing Payload file: $relative" >&2
    exit 1
  }
done

OUTPUT_DIRECTORY="$(dirname "$DMG_PATH")"
DMG_STAGE="$OUTPUT_DIRECTORY/.codex-z-dmg-stage-$$"
ASSETS_DIR="$OUTPUT_DIRECTORY/.codex-z-dmg-assets-$$"
cleanup() {
  rm -rf "$DMG_STAGE" "$ASSETS_DIR"
}
trap cleanup EXIT

CONTENTS="$APP_PATH/Contents"
RESOURCES="$CONTENTS/Resources"
rm -rf "$APP_PATH" "$DMG_STAGE"
rm -f "$DMG_PATH"
mkdir -p "$CONTENTS/MacOS" "$RESOURCES" "$OUTPUT_DIRECTORY"

cp "$PAYLOAD_ROOT/bin/codex-z" "$CONTENTS/MacOS/codex-z"
cp -R "$PAYLOAD_ROOT/libexec" "$RESOURCES/libexec"
cp -R "$PAYLOAD_ROOT/runtime" "$RESOURCES/runtime"
cp -R "$PAYLOAD_ROOT/app" "$RESOURCES/app"
cp -R "$PAYLOAD_ROOT/licenses" "$RESOURCES/licenses"
cp "$PAYLOAD_ROOT/LICENSE" "$RESOURCES/LICENSE"
cp "$PAYLOAD_ROOT/NOTICE" "$RESOURCES/NOTICE"
cp "$PAYLOAD_ROOT/THIRD_PARTY_NOTICES.txt" "$RESOURCES/THIRD_PARTY_NOTICES.txt"
chmod 755 \
  "$CONTENTS/MacOS/codex-z" \
  "$RESOURCES/libexec/codex-z-shim" \
  "$RESOURCES/libexec/codex-z-updater" \
  "$RESOURCES/runtime/node"

mkdir -p "$ASSETS_DIR"
node "$(cd "$(dirname "$0")" && pwd)/assets.mjs" --output "$ASSETS_DIR"
mkdir -p "$ASSETS_DIR/codex-z.iconset"
for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$ASSETS_DIR/codex-z-icon.png" \
    --out "$ASSETS_DIR/codex-z.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  /usr/bin/sips -z "$double" "$double" "$ASSETS_DIR/codex-z-icon.png" \
    --out "$ASSETS_DIR/codex-z.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil -c icns "$ASSETS_DIR/codex-z.iconset" -o "$ASSETS_DIR/codex-z.icns"
cp "$ASSETS_DIR/codex-z.icns" "$RESOURCES/codex-z.icns"
printf 'APPL????' > "$CONTENTS/PkgInfo"

cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>codex-z</string>
  <key>CFBundleExecutable</key>
  <string>codex-z</string>
  <key>CFBundleIconFile</key>
  <string>codex-z.icns</string>
  <key>CFBundleIdentifier</key>
  <string>io.github.rafazafar.codex-z</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>codex-z</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$BUNDLE_VERSION</string>
  <key>CFBundleVersion</key>
  <string>$BUNDLE_VERSION</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

/usr/bin/plutil -lint "$CONTENTS/Info.plist" >/dev/null
/usr/bin/codesign --force --sign - "$RESOURCES/runtime/node"
/usr/bin/codesign --force --sign - "$RESOURCES/libexec/codex-z-shim"
/usr/bin/codesign --force --sign - "$RESOURCES/libexec/codex-z-updater"
/usr/bin/codesign --force --sign - "$CONTENTS/MacOS/codex-z"
/usr/bin/codesign --force --sign - "$APP_PATH"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"
"$RESOURCES/runtime/node" -e 'if (process.version !== "v24.13.1") process.exit(1)'

mkdir -p "$DMG_STAGE"
/usr/bin/ditto "$APP_PATH" "$DMG_STAGE/codex-z.app"
/usr/bin/codesign --verify --deep --strict "$DMG_STAGE/codex-z.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# create-dmg (https://github.com/create-dmg/create-dmg) builds the styled
# standard DMG: window size, icon positions, Applications drop link, volume
# icon and background are matched to the official example template.
create-dmg \
  --volname "codex-z" \
  --volicon "$RESOURCES/codex-z.icns" \
  --background "$SCRIPT_DIR/assets/installer-background.png" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "codex-z.app" 200 190 \
  --hide-extension "codex-z.app" \
  --app-drop-link 600 185 \
  "$DMG_PATH" \
  "$DMG_STAGE" >/dev/null
/usr/bin/hdiutil verify "$DMG_PATH" >/dev/null

test -s "$DMG_PATH" || {
  echo "error: macOS DMG is missing or empty: $DMG_PATH" >&2
  exit 1
}
