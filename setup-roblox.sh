#!/bin/bash

# ====================================================================
# ELECTRON EXECUTOR — ROBLOX AUTO-SETUP SCRIPT
# Automatically patches Roblox folders so the executor can connect.
#
# Usage:
#   chmod +x setup-roblox.sh && ./setup-roblox.sh
#
# What this script does:
#   1. Copies ElectronLoader.lua to Roblox Studio Plugins folder
#   2. Creates autoexec folders for macOS exploit clients
#   3. Creates ClientSettings with HTTP enabled for Roblox Player
#   4. Verifies all files are correctly placed
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
  echo -e "${MAGENTA}${BOLD}  ║     🔧 Electron Executor — Roblox Setup 🔧      ║${NC}"
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

# ═════════════════════════════════════════════════════════════════════
# PRE-STEP: Create Electron Executor User Workspace
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[0/4]${NC} ${BOLD}Electron Executor Workspace Directory${NC}"

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
# STEP 1: Copy loader.lua to Roblox Studio Plugins
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[1/4]${NC} ${BOLD}Roblox Studio Plugins${NC}"

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
# STEP 2: Copy loader.lua to macOS Exploit Autoexec Folders
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[2/4]${NC} ${BOLD}Exploit Autoexec Folders${NC}"

EXPLOIT_NAMES=("MacSploit" "Hydrogen" "Wave" "Xeno" "Arceus-X" "Opiumware" "opiumware-executor" "com.norbyv1.opiumware")
EXPLOIT_FOUND=0

for EXPLOIT_NAME in "${EXPLOIT_NAMES[@]}"; do
  EXPLOIT_BASE="$HOME/Library/Application Support/$EXPLOIT_NAME"
  EXPLOIT_AUTOEXEC="$EXPLOIT_BASE/autoexec"

  if [ -d "$EXPLOIT_BASE" ]; then
    mkdir -p "$EXPLOIT_AUTOEXEC" 2>/dev/null
    if cp "$LOADER_FILE" "$EXPLOIT_AUTOEXEC/ElectronLoader.lua" 2>/dev/null; then
      success "$EXPLOIT_NAME: Copied to autoexec"
      add_result "${GREEN}✓${NC} $EXPLOIT_NAME autoexec: Installed"
      EXPLOIT_FOUND=$((EXPLOIT_FOUND + 1))
    else
      fail_soft "$EXPLOIT_NAME: Failed to copy"
      add_result "${RED}✗${NC} $EXPLOIT_NAME autoexec: Copy failed"
    fi
  else
    info "$EXPLOIT_NAME: Not installed (skipping)"
  fi
done

if [ "$EXPLOIT_FOUND" -eq 0 ]; then
  info "No exploit clients detected. Loader will work via Roblox Studio Plugin."
  add_result "${DIM}→${NC} No exploit clients found (Studio-only mode)"
fi

# ═════════════════════════════════════════════════════════════════════
# STEP 3: Create ClientSettings for Roblox Player (HTTP enabled)
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[3/4]${NC} ${BOLD}Roblox Player HTTP Settings${NC}"

# Detect Roblox path dynamically on this device
ROBLOX_PATH=""
if [ -d "/Applications/Roblox.app" ]; then
  ROBLOX_PATH="/Applications/Roblox.app"
elif [ -d "$HOME/Applications/Roblox.app" ]; then
  ROBLOX_PATH="$HOME/Applications/Roblox.app"
else
  # Spotlight lookup fallback
  ROBLOX_PATH=$(mdfind "kMDItemCFBundleIdentifier == 'com.roblox.RobloxPlayer'" 2>/dev/null | head -n 1)
fi

CLIENT_SETTINGS_JSON='{
  "FFlagDebugLocalRccServerConnection": "true",
  "FIntHttpRequestFrequencyLimitPerMinute": "1000",
  "DFIntHttpRbxApiMaxRetryCount": "3",
  "FFlagEnableHttpServiceAutoRetry": "true"
}'

if [ -n "$ROBLOX_PATH" ] && [ -d "$ROBLOX_PATH" ]; then
  ROBLOX_APP_CONTENTS="$ROBLOX_PATH/Contents/MacOS"
  ROBLOX_CLIENT_SETTINGS_DIR="$ROBLOX_APP_CONTENTS/ClientSettings"
  
  mkdir -p "$ROBLOX_CLIENT_SETTINGS_DIR" 2>/dev/null
  if echo "$CLIENT_SETTINGS_JSON" > "$ROBLOX_CLIENT_SETTINGS_DIR/ClientAppSettings.json" 2>/dev/null; then
    success "Created ClientAppSettings.json in Roblox Player ($ROBLOX_PATH)"
    add_result "${GREEN}✓${NC} Roblox Player: ClientAppSettings.json created"
  else
    # Try with sudo if write failed
    if sudo mkdir -p "$ROBLOX_CLIENT_SETTINGS_DIR" && echo "$CLIENT_SETTINGS_JSON" | sudo tee "$ROBLOX_CLIENT_SETTINGS_DIR/ClientAppSettings.json" >/dev/null; then
      success "Created ClientAppSettings.json in Roblox Player with sudo ($ROBLOX_PATH)"
      add_result "${GREEN}✓${NC} Roblox Player: ClientAppSettings.json created (sudo)"
    else
      fail_soft "Failed to write ClientAppSettings.json"
      add_result "${YELLOW}⚠${NC} Roblox Player: ClientAppSettings needs manual setup"
    fi
  fi
else
  info "Roblox Player not found on this device (skipping Roblox Player patch)"
  add_result "${DIM}→${NC} Roblox Player: Not found"
fi

# Path 2: Roblox Player ClientSettings (user-level ~/Library)
ROBLOX_USER_SETTINGS_DIR="$HOME/Library/Application Support/Roblox/ClientSettings"
mkdir -p "$ROBLOX_USER_SETTINGS_DIR" 2>/dev/null

if echo "$CLIENT_SETTINGS_JSON" > "$ROBLOX_USER_SETTINGS_DIR/ClientAppSettings.json" 2>/dev/null; then
  success "Created ClientAppSettings.json in ~/Library (user-level)"
  add_result "${GREEN}✓${NC} User-level: ClientAppSettings.json created"
else
  fail_soft "Failed to write user-level ClientAppSettings.json"
  add_result "${RED}✗${NC} User-level: ClientAppSettings.json failed"
fi

# ═════════════════════════════════════════════════════════════════════
# STEP 4: Verify All Files & Port Availability
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BLUE}${BOLD}[4/4]${NC} ${BOLD}Verification${NC}"

# Verify loader in Studio Plugins
if [ -f "$STUDIO_PLUGINS_DIR/ElectronLoader.lua" ]; then
  FILE_SIZE=$(wc -c < "$STUDIO_PLUGINS_DIR/ElectronLoader.lua" | tr -d ' ')
  success "ElectronLoader.lua verified ($FILE_SIZE bytes)"
else
  fail_soft "ElectronLoader.lua not found in Plugins"
fi

# Check if port 8392 is available
if lsof -i :8392 &>/dev/null; then
  warn "Port 8392 is currently in use — the executor server may conflict"
  info "Kill existing process: lsof -ti :8392 | xargs kill -9"
else
  success "Port 8392 is available"
fi

# Check Roblox Studio HttpService enabled status
ROBLOX_STUDIO_SETTINGS="$HOME/Library/Roblox/GlobalSettings_13.xml"
if [ -f "$ROBLOX_STUDIO_SETTINGS" ]; then
  if grep -q "HttpEnabled" "$ROBLOX_STUDIO_SETTINGS" 2>/dev/null; then
    success "Roblox Studio GlobalSettings found (HttpEnabled present)"
  else
    info "Roblox Studio GlobalSettings found but HttpEnabled not set"
    info "Enable it in Studio: Game Settings → Security → Allow HTTP Requests"
  fi
else
  info "Roblox Studio GlobalSettings not found"
  info "When using Studio: enable Game Settings → Security → Allow HTTP Requests"
fi

# ═════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "  ${DIM}══════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}Setup Summary:${NC}"
echo ""
for result in "${RESULTS[@]}"; do
  echo -e "    $result"
done
echo ""
echo -e "  ${DIM}══════════════════════════════════════════════════${NC}"

if [ "$FROM_INSTALLER" = false ]; then
  echo ""
  echo -e "  ${BOLD}What's next:${NC}"
  echo -e "    1. Start the executor: ${CYAN}npm run dev${NC}"
  echo -e "    2. Open Roblox and join any game"
  echo -e "    3. The executor will auto-detect Roblox"
  echo -e "    4. Write Lua scripts and hit ${GREEN}Execute ▶${NC}"
  echo ""
  echo -e "  ${DIM}If you're using Roblox Studio:${NC}"
  echo -e "    Go to: ${YELLOW}Game Settings → Security → Allow HTTP Requests${NC}"
  echo ""
fi
