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

# Ensure Homebrew and standard command line tool paths are in PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

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

print_step() {
  local num="$1"
  local title="$2"
  echo ""
  if [ "$FROM_INSTALLER" = true ]; then
    echo -e "  ${BLUE}${BOLD}[6.${num}]${NC} ${BOLD}${title}${NC}"
  else
    echo -e "  ${BLUE}${BOLD}[${num}/${TOTAL_STEPS}]${NC} ${BOLD}${title}${NC}"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# STEP 0: Create Electron Executor User Workspace
# ═════════════════════════════════════════════════════════════════════
print_step 0 "Electron Executor Workspace Directory"

ELECTRON_DIR="$HOME/Electron Executor"
mkdir -p "$ELECTRON_DIR"
mkdir -p "$ELECTRON_DIR/autoexec"
mkdir -p "$ELECTRON_DIR/workspace"
mkdir -p "$ELECTRON_DIR/scripts"
mkdir -p "$ELECTRON_DIR/modules"
mkdir -p "$ELECTRON_DIR/themes"

success "Created workspace directory structure under $ELECTRON_DIR"
add_result "${GREEN}✓${NC} Workspace: Initialized at ~/Electron Executor"


# ── Check if Roblox is already installed and patched ────────────────
SKIP_ROBLOX_REINSTALL=false
DETECTED_ROBLOX_PATH=""
if [ -d "/Applications/Roblox.app" ]; then
  DETECTED_ROBLOX_PATH="/Applications/Roblox.app"
elif [ -d "$HOME/Applications/Roblox.app" ]; then
  DETECTED_ROBLOX_PATH="$HOME/Applications/Roblox.app"
fi

if [ -n "$DETECTED_ROBLOX_PATH" ] && [ -f "$DETECTED_ROBLOX_PATH/Contents/MacOS/ClientSettings/ClientAppSettings.json" ] && [ -f "$HOME/Library/Application Support/Roblox/ClientSettings/ClientAppSettings.json" ]; then
  info "Roblox already installed and patched. Skipping download/re-installation."
  SKIP_ROBLOX_REINSTALL=true
fi

# ═════════════════════════════════════════════════════════════════════
# STEP 1: Kill Running Roblox Processes
# ═════════════════════════════════════════════════════════════════════
print_step 1 "Terminating Running Roblox Processes"

KILLED=0
if [ "$SKIP_ROBLOX_REINSTALL" = false ]; then
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
  # Small delay to ensure processes are fully terminated
  sleep 1
else
  info "Roblox processes do not need to be terminated (reinstall skipped)"
fi
add_result "${GREEN}✓${NC} Roblox processes: Terminated ($KILLED killed)"


# ═════════════════════════════════════════════════════════════════════
# STEP 2: Remove Old Roblox Installation
# ═════════════════════════════════════════════════════════════════════
print_step 2 "Removing Old Roblox Installation"

REMOVED=0
if [ "$SKIP_ROBLOX_REINSTALL" = false ]; then
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
else
  info "Old Roblox removal skipped (reinstall skipped)"
fi
add_result "${GREEN}✓${NC} Old Roblox: Removed ($REMOVED app bundles cleaned)"

# ═════════════════════════════════════════════════════════════════════
# STEP 3 & 4: Download and Install Fresh Roblox (Official CDN Method)
# ═════════════════════════════════════════════════════════════════════
print_step 3 "Installing Fresh Roblox"

ROBLOX_INSTALLED=false
if [ "$SKIP_ROBLOX_REINSTALL" = false ]; then
  ARCH=$(uname -m)
  UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
  
  # ── Detect Mac architecture ────────────────────────────────────────
  if [ "$ARCH" = "arm64" ]; then
    info "Detected: Apple Silicon (M-series) — downloading ARM64 build"
    MAC_TYPE="arm64"
  else
    info "Detected: Intel Mac (x86_64) — downloading Intel build"
    MAC_TYPE="x86_64"
  fi

  # Step A: Fetch latest version hash from Homebrew Cask API (which is not blocked) or Roblox API
  info "Fetching latest Roblox version hash..."
  VERSION_JSON=$(curl -sS --connect-timeout 15 --max-time 30 --retry 3 --retry-delay 2 \
    "https://formulae.brew.sh/api/cask/roblox.json" 2>/dev/null) || VERSION_JSON=""

  VERSION_HASH=""
  if [ -n "$VERSION_JSON" ]; then
    # Extract version hash from Homebrew API response (e.g. "version":"0.726.0.7261140,d9748b94acff4b5d")
    VERSION_HASH=$(echo "$VERSION_JSON" | grep -oE '"version"\s*:\s*"[^"]+"' | head -1 | cut -d',' -f2 | tr -d '"')
  fi

  # Fallback: Try official API if Homebrew API failed
  if [ -z "$VERSION_HASH" ]; then
    info "Homebrew API unavailable, trying official API..."
    VERSION_JSON=$(curl -sS -A "$UA" \
      "https://clientsettings.roblox.com/v2/client-version/MacPlayer" \
      --connect-timeout 15 --max-time 30 --retry 3 --retry-delay 2 2>/dev/null) || VERSION_JSON=""

    if [ -n "$VERSION_JSON" ]; then
      VERSION_HASH=$(echo "$VERSION_JSON" | grep -oE '"clientVersionUpload"\s*:\s*"[^"]+"' | head -1 | sed 's/.*"clientVersionUpload"\s*:\s*"\([^"]*\)".*/\1/')
    fi
  fi

  if [ -z "$VERSION_HASH" ]; then
    echo -e "  ${RED}${BOLD}  ✗ Failed to fetch Roblox version hash.${NC}"
    echo -e "  ${RED}    Error: Network connectivity issue or API format changed.${NC}"
    echo -e "  ${YELLOW}    Retry: ${CYAN}./setup-roblox.sh${NC}"
    exit 1
  fi

  success "Latest Roblox version hash: $VERSION_HASH"

  # Step B: Build architecture-specific download URL (using HTTP to bypass SNI filters)
  DOWNLOAD_FILE="/tmp/RobloxPlayer_$$.zip"
  rm -f "$DOWNLOAD_FILE" 2>/dev/null

  if [ "$MAC_TYPE" = "arm64" ]; then
    DOWNLOAD_URL="http://setup.rbxcdn.com/mac/arm64/version-${VERSION_HASH}-RobloxPlayer.zip"
  else
    DOWNLOAD_URL="http://setup.rbxcdn.com/mac/version-${VERSION_HASH}-RobloxPlayer.zip"
  fi

  info "Downloading: $DOWNLOAD_URL"
  HTTP_CODE=$(curl -L -A "$UA" \
    -o "$DOWNLOAD_FILE" \
    -w "%{http_code}" \
    --connect-timeout 20 \
    --max-time 600 \
    --retry 3 \
    --retry-delay 3 \
    -# \
    "$DOWNLOAD_URL" 2>/dev/null) || HTTP_CODE="000"

  if [ "$HTTP_CODE" != "200" ] || [ ! -f "$DOWNLOAD_FILE" ]; then
    rm -f "$DOWNLOAD_FILE" 2>/dev/null
    echo -e "  ${RED}${BOLD}  ✗ Download failed (HTTP $HTTP_CODE).${NC}"
    echo -e "  ${RED}    Please check your internet connection and try again.${NC}"
    echo -e "  ${YELLOW}    Retry: ${CYAN}./setup-roblox.sh${NC}"
    exit 1
  fi

  FILE_BYTES=$(wc -c < "$DOWNLOAD_FILE" | tr -d ' ')
  if [ "$FILE_BYTES" -lt 10485760 ]; then # Must be at least 10MB to be valid
    rm -f "$DOWNLOAD_FILE" 2>/dev/null
    echo -e "  ${RED}${BOLD}  ✗ Downloaded file is too small or invalid (${FILE_BYTES} bytes).${NC}"
    exit 1
  fi

  FILE_MB=$(echo "scale=1; $FILE_BYTES / 1048576" | bc 2>/dev/null || echo "?")
  success "Downloaded Roblox archive (${FILE_MB} MB)"

  # Step C: Extract ZIP archive
  EXTRACT_DIR="/tmp/roblox_extract_$$"
  rm -rf "$EXTRACT_DIR" 2>/dev/null
  mkdir -p "$EXTRACT_DIR"

  info "Extracting ZIP archive..."
  if ! unzip -q -o "$DOWNLOAD_FILE" -d "$EXTRACT_DIR" 2>/dev/null; then
    rm -f "$DOWNLOAD_FILE" 2>/dev/null
    rm -rf "$EXTRACT_DIR" 2>/dev/null
    echo -e "  ${RED}${BOLD}  ✗ Failed to extract ZIP archive.${NC}"
    exit 1
  fi

  rm -f "$DOWNLOAD_FILE" 2>/dev/null

  # Find the .app bundle (could be named RobloxPlayer.app)
  ROBLOX_APP=$(find "$EXTRACT_DIR" -maxdepth 3 -name "*.app" -type d 2>/dev/null | head -1)

  if [ -z "$ROBLOX_APP" ]; then
    rm -rf "$EXTRACT_DIR" 2>/dev/null
    echo -e "  ${RED}${BOLD}  ✗ No .app bundle found inside the downloaded archive.${NC}"
    exit 1
  fi

  APP_NAME=$(basename "$ROBLOX_APP")
  info "Found application: $APP_NAME"

  # Direct .app — copy to /Applications
  info "Installing to /Applications/Roblox.app..."
  rm -rf "/Applications/Roblox.app" 2>/dev/null || sudo rm -rf "/Applications/Roblox.app" 2>/dev/null

  if cp -R "$ROBLOX_APP" "/Applications/Roblox.app" 2>/dev/null; then
    success "Copied Roblox.app to /Applications"
  else
    info "Retrying with elevated permissions..."
    sudo cp -R "$ROBLOX_APP" "/Applications/Roblox.app" 2>/dev/null || true
  fi

  rm -rf "$EXTRACT_DIR" 2>/dev/null

  if [ ! -d "/Applications/Roblox.app" ]; then
    echo -e "  ${RED}${BOLD}  ✗ Failed to place Roblox.app into /Applications directory.${NC}"
    exit 1
  fi

  # Remove quarantine attribute
  xattr -rd com.apple.quarantine "/Applications/Roblox.app" 2>/dev/null || true

  # Verify architecture of installed binary
  if [ -f "/Applications/Roblox.app/Contents/MacOS/RobloxPlayer" ]; then
    ROBLOX_ARCH=$(file "/Applications/Roblox.app/Contents/MacOS/RobloxPlayer" 2>/dev/null | grep -oE "arm64|x86_64" | head -1)
    if [ -n "$ROBLOX_ARCH" ]; then
      success "Installed Roblox architecture: $ROBLOX_ARCH"
    fi
  fi

  ROBLOX_INSTALLED=true
  success "Roblox installed successfully to /Applications"
  add_result "${GREEN}✓${NC} Roblox Install: Fresh copy installed ($MAC_TYPE)"
else
  info "Skipping: Roblox download and installation skipped (Already installed)"
  add_result "${GREEN}✓${NC} Roblox Install: Skipped (Using existing local copy)"
fi

# ═════════════════════════════════════════════════════════════════════
# STEP 5: Patch Roblox Bundle with Electron Executor Injection
# ═════════════════════════════════════════════════════════════════════
print_step 4 "Patching Roblox with Electron Executor Injection"

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

if [ "$SKIP_ROBLOX_REINSTALL" = false ]; then
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

    # 5c. Re-sign the patched Roblox.app to prevent Gatekeeper issues
    info "Re-signing patched Roblox.app..."
    codesign --force --deep --sign - "$ROBLOX_PATH" 2>/dev/null || true
    success "Ad-hoc code signature applied to patched Roblox"
    PATCH_COUNT=$((PATCH_COUNT + 1))
  else
    warn "Roblox.app not found — skipping bundle patching"
  fi
else
  info "Skipping: Roblox bundle patching and codesign skipped (Already patched)"
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
print_step 5 "Roblox Studio Plugin Integration"

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
print_step 6 "Verification"

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
