#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=$(node -p "require('$project_root/package.json').version")
product_name='方序看图'
app_path="$project_root/src-tauri/target/release/bundle/macos/$product_name.app"
output_dir="$project_root/release"
output_path="$output_dir/${product_name}_${version}_aarch64.dmg"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/fangxu-viewer-dmg.XXXXXX")
staging_dir="$work_dir/staging"
rw_image="$work_dir/layout.dmg"
device_name=''

detach_image() {
  attempts=0
  while [ "$attempts" -lt 5 ]; do
    if hdiutil detach "$device_name" >/dev/null 2>&1; then
      device_name=''
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 1
  done

  hdiutil detach -force "$device_name" >/dev/null
  device_name=''
}

icon_path="$project_root/src-tauri/icons/icon.icns"

cleanup() {
  if [ -n "$device_name" ]; then
    detach_image || true
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

if [ ! -d "$app_path" ] || [ "$icon_path" -nt "$app_path" ]; then
  echo "应用包不存在或图标已更新，正在重新构建应用包..." >&2
  npm run tauri -- build --bundles app
fi

if [ ! -d "$app_path" ]; then
  echo "构建后依然未找到应用包：$app_path" >&2
  exit 1
fi

mkdir -p "$output_dir"
mkdir -p "$staging_dir"
ditto "$app_path" "$staging_dir/$product_name.app"
ln -s /Applications "$staging_dir/Applications"
if [ -f "$icon_path" ]; then
  cp "$icon_path" "$staging_dir/.VolumeIcon.icns"
fi

hdiutil create -quiet \
  -volname "$product_name $version" \
  -srcfolder "$staging_dir" \
  -ov \
  -fs HFS+ \
  -format UDRW \
  "$rw_image"

attach_output=$(hdiutil attach \
  -readwrite \
  -noverify \
  -noautoopen \
  -nobrowse \
  -mountrandom /Volumes \
  "$rw_image")
device_name=$(printf '%s\n' "$attach_output" | awk '/Apple_HFS/ { print $1; exit }')
mount_dir=$(printf '%s\n' "$attach_output" | awk -F '\t' '/Apple_HFS/ { print $NF; exit }')

if [ -z "$device_name" ] || [ -z "$mount_dir" ]; then
  echo "无法挂载临时磁盘映像。" >&2
  exit 1
fi

if [ -f "$icon_path" ]; then
  cp "$icon_path" "$mount_dir/.VolumeIcon.icns"
  SetFile -c icnC "$mount_dir/.VolumeIcon.icns" 2>/dev/null || true
  SetFile -a C "$mount_dir" 2>/dev/null || true
fi

volume_name=$(basename "$mount_dir")

/usr/bin/osascript - "$volume_name" "$product_name.app" <<'APPLESCRIPT'
on run argv
  set volumeName to item 1 of argv
  set applicationName to item 2 of argv
  set windowLeft to 100
  set windowTop to 100
  set windowWidth to 600
  set windowHeight to 360

  tell application "Finder"
    tell disk volumeName
      open

      tell container window
        set current view to icon view
        set toolbar visible to false
        set statusbar visible to false
        set bounds to {windowLeft, windowTop, windowLeft + windowWidth, windowTop + windowHeight}
      end tell

      tell icon view options of container window
        set arrangement to not arranged
        set icon size to 112
        set text size to 14
      end tell

      set position of item applicationName of container window to {155, 165}
      set position of item "Applications" of container window to {445, 165}

      update without registering applications
      close
      open
      delay 1

      tell container window
        set bounds to {windowLeft, windowTop, windowLeft + windowWidth - 10, windowTop + windowHeight - 10}
        set bounds to {windowLeft, windowTop, windowLeft + windowWidth, windowTop + windowHeight}
      end tell
    end tell

    delay 2
  end tell
end run
APPLESCRIPT

sync
detach_image

rm -f "$output_path"
hdiutil convert -quiet \
  "$rw_image" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -o "$output_path"

if [ -f "$icon_path" ] && [ -f "$output_path" ]; then
  swift -e '
import Cocoa
let args = CommandLine.arguments
if args.count >= 3 {
  let iconPath = args[1]
  let filePath = args[2]
  if let image = NSImage(contentsOfFile: iconPath) {
    _ = NSWorkspace.shared.setIcon(image, forFile: filePath, options: [])
  }
}
' "$icon_path" "$output_path" 2>/dev/null || true
fi

echo "DMG 安装包已成功生成：$output_path"
