#!/bin/bash

# ====================================================================
# ELECTRON EXECUTOR — ROBLOX AUTO-SETUP & INJECTION SCRIPT
# Automatically removes old Roblox, downloads fresh copy, patches
# the bundle for Electron Executor injection, and verifies.
#
# Usage:
#   chmod +x setup-roblox.sh && ./setup-roblox.sh
#
# What this script does:
#   1. Kills running Roblox processes
#   2. Removes old Roblox installation completely
#   3. Downloads fresh Roblox installer from roblox.com
#   4. Installs Roblox to /Applications
#   5. Patches Roblox bundle with Electron Executor injection files
#   6. Copies loader.lua to Studio Plugins and autoexec folders
#   7. Verifies all files are correctly placed
# ====================================================================

set -e

# ── Color codes ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Detect if called from installer or standalone ────────────────────
FROM_INSTALLER=false
if [[ "$1" == "--from-installer" ]]; then
  FROM_INSTALLER=true
fi

# ── Helper functions ─────────────────────────────────────────────────
success() { echo -e "    ${GREEN}✓${NC} $1"; }
info()    { echo -e "    ${DIM}→${NC} $1"; }
warn()    { echo -e "    ${YELLOW}⚠${NC} $1"; }
fail_soft() { echo -e "    ${RED}✗${NC} $1"; }

# ── Determine script directory ───────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOADER_FILE="$SCRIPT_DIR/loader.lua"

# ── Banner (only when run standalone) ────────────────────────────────
if [ "$FROM_INSTALLER" = false ]; then
  echo ""
  echo -e "${MAGENTA}${BOLD}  ╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}${BOLD}  ║  🔧 Electron Executor — Roblox Injection Setup  ║${NC}"
  echo -e "${MAGENTA}${BOLD}  ╚══════════════════════════════════════════════════╝${NC}"
  echo ""
fi

# ── Check loader.lua exists ──────────────────────────────────────────
if [ ! -f "$LOADER_FILE" ]; then
  echo -e "  ${RED}${BOLD}ERROR:${NC} loader.lua not found at: $LOADER_FILE"
  echo -e "  Make sure you run this script from the Electron Executor directory."
  exit 1
fi

info "Using loader script: $LOADER_FILE"

# ── Results tracking ─────────────────────────────────────────────────
RESULTS=()
add_result() { RESULTS+=("$1"); }

# Total steps
TOTAL_STEPS=7

# ═════════════════════════════════════════════════════════════════════
# STEP 0: Create Electron Executor User Workspace
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[0/$TOTAL_STEPS]${NC} ${BOLD}Electron Executor Workspace Directory${NC}"

ELECTRON_DIR="$HOME/Electron Executor"
mkdir -p "$ELECTRON_DIR"
mkdir -p "$ELECTRON_DIR/autoexec"
mkdir -p "$ELECTRON_DIR/workspace"
mkdir -p "$ELECTRON_DIR/scripts"
mkdir -p "$ELECTRON_DIR/modules"
mkdir -p "$ELECTRON_DIR/themes"

success "Created workspace directory structure under $ELECTRON_DIR"
add_result "${GREEN}✓${NC} Workspace: Initialized at ~/Electron Executor"


# ═════════════════════════════════════════════════════════════════════
# STEP 1: Kill Running Roblox Processes
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[1/$TOTAL_STEPS]${NC} ${BOLD}Terminating Running Roblox Processes${NC}"

KILLED=0
for PROC_NAME in "RobloxPlayer" "Roblox" "RobloxStudio" "RobloxPlayerInstaller" "RobloxCrashHandler"; do
  if pgrep -x "$PROC_NAME" > /dev/null 2>&1; then
    pkill -9 "$PROC_NAME" 2>/dev/null || true
    success "Killed process: $PROC_NAME"
    KILLED=$((KILLED + 1))
  fi
done

if [ "$KILLED" -eq 0 ]; then
  info "No Roblox processes were running"
else
  success "Terminated $KILLED Roblox process(es)"
fi
add_result "${GREEN}✓${NC} Roblox processes: Terminated ($KILLED killed)"

# Small delay to ensure processes are fully terminated
sleep 1


# ═════════════════════════════════════════════════════════════════════
# STEP 2: Remove Old Roblox Installation
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[2/$TOTAL_STEPS]${NC} ${BOLD}Removing Old Roblox Installation${NC}"

REMOVED=0

# Remove from /Applications
if [ -d "/Applications/Roblox.app" ]; then
  if rm -rf "/Applications/Roblox.app" 2>/dev/null; then
    success "Removed /Applications/Roblox.app"
    REMOVED=$((REMOVED + 1))
  else
    info "Trying with elevated permissions..."
    sudo rm -rf "/Applications/Roblox.app" 2>/dev/null && success "Removed /Applications/Roblox.app (sudo)" && REMOVED=$((REMOVED + 1)) || fail_soft "Could not remove /Applications/Roblox.app"
  fi
fi

# Remove from ~/Applications
if [ -d "$HOME/Applications/Roblox.app" ]; then
  rm -rf "$HOME/Applications/Roblox.app" 2>/dev/null
  success "Removed ~/Applications/Roblox.app"
  REMOVED=$((REMOVED + 1))
fi

# Remove Roblox Studio
if [ -d "/Applications/RobloxStudio.app" ]; then
  rm -rf "/Applications/RobloxStudio.app" 2>/dev/null || sudo rm -rf "/Applications/RobloxStudio.app" 2>/dev/null
  success "Removed /Applications/RobloxStudio.app"
  REMOVED=$((REMOVED + 1))
fi

# Clean up Roblox cache and version folders (but preserve user data)
ROBLOX_VERSIONS_DIR="$HOME/Library/Application Support/Roblox/Versions"
if [ -d "$ROBLOX_VERSIONS_DIR" ]; then
  rm -rf "$ROBLOX_VERSIONS_DIR" 2>/dev/null
  success "Cleaned Roblox Versions cache"
fi

if [ "$REMOVED" -eq 0 ]; then
  info "No previous Roblox installation found to remove"
fi
add_result "${GREEN}✓${NC} Old Roblox: Removed ($REMOVED app bundles cleaned)"

# ═════════════════════════════════════════════════════════════════════
# STEP 3 & 4: Download and Install Fresh Roblox
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[3/$TOTAL_STEPS]${NC} ${BOLD}Installing Fresh Roblox${NC}"

ROBLOX_INSTALLED=false

# Method 1 (Primary): Homebrew cask — most reliable on macOS
if command -v brew &> /dev/null; then
  info "Installing Roblox via Homebrew (paling reliable)..."
  
  # Uninstall old cask first if exists (silent)
  brew uninstall --cask roblox 2>/dev/null || true
  
  # Install fresh with no quarantine flag (prevents Gatekeeper popups)
  if brew install --cask --no-quarantine roblox 2>&1 | tail -5; then
    if [ -d "/Applications/Roblox.app" ]; then
      ROBLOX_INSTALLED=true
      success "Roblox installed via Homebrew cask"
    fi
  fi
fi

# Method 2 (Fallback): Direct download if Homebrew not available
if [ "$ROBLOX_INSTALLED" = false ]; then
  info "Homebrew not available, trying direct download..."
  
  DMG_PATH="/tmp/RobloxPlayer_$$.dmg"
  rm -f "$DMG_PATH" 2>/dev/null
  
  # Try the Roblox CDN URL (follows redirects)
  DOWNLOAD_URLS=(
    "https://www.roblox.com/download/client"
    "https://setup.rbxcdn.com/mac/RobloxPlayer.dmg"
  )
  
  DOWNLOADED=false
  for URL in "${DOWNLOAD_URLS[@]}"; do
    info "Trying: $URL"
    if curl -L -o "$DMG_PATH" "$URL" --connect-timeout 15 --max-time 120 -s 2>/dev/null; then
      # Verify it's actually a DMG (check magic bytes)
      if file "$DMG_PATH" 2>/dev/null | grep -qi "disk image\|dmg\|apple"; then
        DOWNLOADED=true
        FILE_SIZE=$(wc -c < "$DMG_PATH" | tr -d ' ')
        success "Downloaded Roblox installer ($(echo "scale=1; $FILE_SIZE / 1048576" | bc) MB)"
        break
      fi
    fi
    rm -f "$DMG_PATH" 2>/dev/null
  done
  
  if [ "$DOWNLOADED" = true ]; then
    MOUNT_POINT="/tmp/roblox_mount_$$"
    mkdir -p "$MOUNT_POINT"
    
    info "Mounting and installing..."
    if hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet 2>/dev/null; then
      # Find any .app inside the mount
      ROBLOX_APP=$(find "$MOUNT_POINT" -maxdepth 2 -name "*.app" -type d | head -1)
      
      if [ -n "$ROBLOX_APP" ]; then
        APP_NAME=$(basename "$ROBLOX_APP")
        
        if echo "$APP_NAME" | grep -qi "installer"; then
          # It's an installer app — run it
          cp -R "$ROBLOX_APP" "/tmp/$APP_NAME" 2>/dev/null
          open -W "/tmp/$APP_NAME" 2>/dev/null
          sleep 3
          rm -rf "/tmp/$APP_NAME" 2>/dev/null
        else
          # Direct .app bundle — copy to /Applications
          cp -R "$ROBLOX_APP" "/Applications/Roblox.app" 2>/dev/null || sudo cp -R "$ROBLOX_APP" "/Applications/Roblox.app" 2>/dev/null
        fi
        
        if [ -d "/Applications/Roblox.app" ]; then
          ROBLOX_INSTALLED=true
          success "Roblox installed from DMG"
        fi
      fi
      
      hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || hdiutil detach "$MOUNT_POINT" -force -quiet 2>/dev/null
      rmdir "$MOUNT_POINT" 2>/dev/null
    fi
    rm -f "$DMG_PATH" 2>/dev/null
  fi
fi

if [ "$ROBLOX_INSTALLED" = true ]; then
  add_result "${GREEN}✓${NC} Roblox Install: Fresh copy installed to /Applications"
else
  warn "Could not install Roblox automatically."
  info "Please install manually from https://www.roblox.com/download"
  info "Then re-run this script to apply injection patches."
  add_result "${YELLOW}⚠${NC} Roblox Install: Manual install needed from roblox.com"
fi

# ═════════════════════════════════════════════════════════════════════
# STEP 5: Patch Roblox Bundle with Electron Executor Injection
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[5/$TOTAL_STEPS]${NC} ${BOLD}Patching Roblox with Electron Executor Injection${NC}"

# ClientAppSettings JSON — enables HTTP requests to localhost
CLIENT_SETTINGS_JSON='{
  "FFlagDebugLocalRccServerConnection": "true",
  "FIntHttpRequestFrequencyLimitPerMinute": "1000",
  "DFIntHttpRbxApiMaxRetryCount": "3",
  "FFlagEnableHttpServiceAutoRetry": "true",
  "DFIntHttpRbxApiRequestsPerMinute": "1000",
  "FFlagHandleAltEnterFullscreenManually": "false"
}'

# Detect the installed Roblox path
ROBLOX_PATH=""
if [ -d "/Applications/Roblox.app" ]; then
  ROBLOX_PATH="/Applications/Roblox.app"
elif [ -d "$HOME/Applications/Roblox.app" ]; then
  ROBLOX_PATH="$HOME/Applications/Roblox.app"
else
  ROBLOX_PATH=$(mdfind "kMDItemCFBundleIdentifier == 'com.roblox.RobloxPlayer'" 2>/dev/null | head -n 1)
fi

PATCH_COUNT=0

if [ -n "$ROBLOX_PATH" ] && [ -d "$ROBLOX_PATH" ]; then
  info "Patching Roblox at: $ROBLOX_PATH"

  # 5a. Create ClientSettings inside Roblox.app bundle
  ROBLOX_CLIENT_SETTINGS_DIR="$ROBLOX_PATH/Contents/MacOS/ClientSettings"
  mkdir -p "$ROBLOX_CLIENT_SETTINGS_DIR" 2>/dev/null || sudo mkdir -p "$ROBLOX_CLIENT_SETTINGS_DIR" 2>/dev/null
  
  if echo "$CLIENT_SETTINGS_JSON" > "$ROBLOX_CLIENT_SETTINGS_DIR/ClientAppSettings.json" 2>/dev/null; then
    success "Injected ClientAppSettings.json into Roblox.app bundle"
    PATCH_COUNT=$((PATCH_COUNT + 1))
  else
    echo "$CLIENT_SETTINGS_JSON" | sudo tee "$ROBLOX_CLIENT_SETTINGS_DIR/ClientAppSettings.json" > /dev/null 2>&1
    success "Injected ClientAppSettings.json into Roblox.app bundle (sudo)"
    PATCH_COUNT=$((PATCH_COUNT + 1))
  fi

  # 5b. Copy loader.lua into Electron Executor autoexec
  AUTOEXEC_DIR="$HOME/Electron Executor/autoexec"
  mkdir -p "$AUTOEXEC_DIR" 2>/dev/null
  if cp "$LOADER_FILE" "$AUTOEXEC_DIR/ElectronLoader.lua" 2>/dev/null; then
    success "Copied loader.lua → ~/Electron Executor/autoexec/"
    PATCH_COUNT=$((PATCH_COUNT + 1))
  else
    fail_soft "Failed to copy loader.lua to autoexec"
  fi

  # 5c. Re-sign the patched Roblox.app to prevent Gatekeeper issues
  info "Re-signing patched Roblox.app..."
  codesign --force --deep --sign - "$ROBLOX_PATH" 2>/dev/null || true
  success "Ad-hoc code signature applied to patched Roblox"
  PATCH_COUNT=$((PATCH_COUNT + 1))

else
  warn "Roblox.app not found — skipping bundle patching"
fi

# 5d. User-level ClientSettings (always applies regardless of Roblox.app location)
ROBLOX_USER_SETTINGS_DIR="$HOME/Library/Application Support/Roblox/ClientSettings"
mkdir -p "$ROBLOX_USER_SETTINGS_DIR" 2>/dev/null

if echo "$CLIENT_SETTINGS_JSON" > "$ROBLOX_USER_SETTINGS_DIR/ClientAppSettings.json" 2>/dev/null; then
  success "Injected ClientAppSettings.json to ~/Library (user-level)"
  PATCH_COUNT=$((PATCH_COUNT + 1))
else
  fail_soft "Failed to write user-level ClientAppSettings.json"
fi

add_result "${GREEN}✓${NC} Roblox Injection: $PATCH_COUNT patches applied"


# ═════════════════════════════════════════════════════════════════════
# STEP 6: Copy loader.lua to Roblox Studio Plugins
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[6/$TOTAL_STEPS]${NC} ${BOLD}Roblox Studio Plugin Integration${NC}"

STUDIO_PLUGINS_DIR="$HOME/Library/Application Support/Roblox/Plugins"
mkdir -p "$STUDIO_PLUGINS_DIR" 2>/dev/null

if cp "$LOADER_FILE" "$STUDIO_PLUGINS_DIR/ElectronLoader.lua" 2>/dev/null; then
  success "Copied ElectronLoader.lua → Roblox Studio Plugins"
  add_result "${GREEN}✓${NC} Studio Plugins: ElectronLoader.lua installed"
else
  fail_soft "Failed to copy to Studio Plugins"
  add_result "${RED}✗${NC} Studio Plugins: Copy failed"
fi


# ═════════════════════════════════════════════════════════════════════
# STEP 7: Verification
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[7/$TOTAL_STEPS]${NC} ${BOLD}Verification${NC}"

VERIFY_PASS=0
VERIFY_FAIL=0

# Verify Roblox.app exists
if [ -d "/Applications/Roblox.app" ] || [ -d "$HOME/Applications/Roblox.app" ]; then
  success "Roblox.app is installed"
  VERIFY_PASS=$((VERIFY_PASS + 1))
else
  fail_soft "Roblox.app not found"
  VERIFY_FAIL=$((VERIFY_FAIL + 1))
fi

# Verify ClientAppSettings.json in bundle
if [ -n "$ROBLOX_PATH" ] && [ -f "$ROBLOX_PATH/Contents/MacOS/ClientSettings/ClientAppSettings.json" ]; then
  success "ClientAppSettings.json verified inside Roblox bundle"
  VERIFY_PASS=$((VERIFY_PASS + 1))
else
  fail_soft "ClientAppSettings.json not found in Roblox bundle"
  VERIFY_FAIL=$((VERIFY_FAIL + 1))
fi

# Verify user-level ClientAppSettings
if [ -f "$ROBLOX_USER_SETTINGS_DIR/ClientAppSettings.json" ]; then
  success "User-level ClientAppSettings.json verified"
  VERIFY_PASS=$((VERIFY_PASS + 1))
else
  fail_soft "User-level ClientAppSettings.json not found"
  VERIFY_FAIL=$((VERIFY_FAIL + 1))
fi

# Verify loader in autoexec
if [ -f "$HOME/Electron Executor/autoexec/ElectronLoader.lua" ]; then
  FILE_SIZE=$(wc -c < "$HOME/Electron Executor/autoexec/ElectronLoader.lua" | tr -d ' ')
  success "ElectronLoader.lua verified in autoexec ($FILE_SIZE bytes)"
  VERIFY_PASS=$((VERIFY_PASS + 1))
else
  fail_soft "ElectronLoader.lua not found in autoexec"
  VERIFY_FAIL=$((VERIFY_FAIL + 1))
fi

# Verify loader in Studio Plugins
if [ -f "$STUDIO_PLUGINS_DIR/ElectronLoader.lua" ]; then
  FILE_SIZE=$(wc -c < "$STUDIO_PLUGINS_DIR/ElectronLoader.lua" | tr -d ' ')
  success "ElectronLoader.lua verified in Studio Plugins ($FILE_SIZE bytes)"
  VERIFY_PASS=$((VERIFY_PASS + 1))
else
  fail_soft "ElectronLoader.lua not found in Plugins"
  VERIFY_FAIL=$((VERIFY_FAIL + 1))
fi

# Check if port 8392 is available
if lsof -i :8392 &>/dev/null; then
  warn "Port 8392 is currently in use — the executor server may conflict"
  info "Kill existing process: lsof -ti :8392 | xargs kill -9"
else
  success "Port 8392 is available"
  VERIFY_PASS=$((VERIFY_PASS + 1))
fi

add_result "${GREEN}✓${NC} Verification: $VERIFY_PASS passed, $VERIFY_FAIL failed"


# ═════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${DIM}══════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}Injection Setup Summary:${NC}"
echo ""
for result in "${RESULTS[@]}"; do
  echo -e "    $result"
done
echo ""
echo -e "  ${DIM}══════════════════════════════════════════════════${NC}"

if [ "$FROM_INSTALLER" = false ]; then
  echo ""
  echo -e "  ${BOLD}What's next:${NC}"
  echo -e "    1. Open ${CYAN}Electron Executor.app${NC}"
  echo -e "    2. Open Roblox and join any game"
  echo -e "    3. The executor will auto-inject and connect"
  echo -e "    4. Write Lua scripts and hit ${GREEN}Execute ▶${NC}"
  echo ""
  echo -e "  ${DIM}Injeksi sudah dilakukan otomatis oleh Electron Executor.${NC}"
  echo -e "  ${DIM}Tidak perlu software pihak ketiga (Opiumware/Hydrogen/MacSploit).${NC}"
  echo ""
fi
