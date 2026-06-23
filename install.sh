#!/bin/bash

# ====================================================================
# ELECTRON EXECUTOR — ALL-IN-ONE TERMINAL INSTALLER
# Download, setup, patch Roblox, and run in one command.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/ARAEMXA26/Electron-Executor/main/install.sh | bash
#
# Or locally:
#   chmod +x install.sh && ./install.sh
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

# ── Helper functions ─────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════════════════════════╗"
  echo "  ║                                                                       ║"
  echo "  ║   ███████╗██╗     ███████╗ ██████╗████████╗██████╗  ██████╗██╗  ██╗   ║"
  echo "  ║   ██╔════╝██║     ██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔══██║████╗██║   ║"
  echo "  ║   █████╗  ██║     █████╗  ██║        ██║   ██████╔╝██║  ██║██║█╗██║   ║"
  echo "  ║   ██╔══╝  ██║     ██╔══╝  ██║        ██║   ██╔══██╗██║  ██║██║ ███║   ║"
  echo "  ║   ███████╗███████╗███████╗╚██████╗   ██║   ██║  ██║╚██████║██║  ██║   ║"
  echo "  ║   ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝   ║"
  echo "  ║                                                                       ║"
  echo "  ║                  ⚡ EXECUTOR — Premium Lua Engine ⚡                   ║"
  echo "  ║                          for Roblox on macOS                          ║"
  echo "  ║                                                                       ║"
  echo "  ╚═══════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

step() {
  echo ""
  echo -e "${BLUE}${BOLD}  [$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"
  echo -e "  ${DIM}────────────────────────────────────────────${NC}"
}

success() {
  echo -e "  ${GREEN}✓${NC} $1"
}

info() {
  echo -e "  ${DIM}→${NC} $1"
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

fail() {
  echo -e "  ${RED}✗ $1${NC}"
  exit 1
}

# ── Configuration ────────────────────────────────────────────────────
REPO_URL="https://github.com/ARAEMXA26/Electron-Executor.git"
INSTALL_DIR="$HOME/Documents/ElectronExecutor"
TOTAL_STEPS=7

# ── Start ────────────────────────────────────────────────────────────
print_banner

# ── Step 1: OS Check ─────────────────────────────────────────────────
step 1 "Checking system requirements..."

if [[ "$(uname)" != "Darwin" ]]; then
  fail "This installer only supports macOS. Detected: $(uname)"
fi
success "macOS detected ($(sw_vers -productVersion))"

ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  success "Apple Silicon (M-series) detected"
else
  success "Intel Mac detected"
fi

# Check if Roblox is installed (will be reinstalled with injection patches in Step 6)
if [ -d "/Applications/Roblox.app" ] || [ -d "$HOME/Applications/Roblox.app" ]; then
  info "Existing Roblox Player found — will be replaced with patched version"
else
  info "Roblox Player not found — will be downloaded and injected automatically"
fi

# ── Step 2: Install prerequisites ───────────────────────────────────
step 2 "Checking prerequisites (Homebrew, Node.js, Git)..."

# Check/install Homebrew
if ! command -v brew &> /dev/null; then
  info "Homebrew not found. Installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "Failed to install Homebrew"

  # Add Homebrew to PATH for Apple Silicon
  if [[ "$ARCH" == "arm64" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile" 2>/dev/null
  fi
  success "Homebrew installed"
else
  success "Homebrew found ($(brew --version | head -1))"
fi

# Check/install Node.js
if ! command -v node &> /dev/null; then
  info "Node.js not found. Installing via Homebrew..."
  brew install node || fail "Failed to install Node.js"
  success "Node.js installed ($(node --version))"
else
  NODE_VER=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    warn "Node.js $NODE_VER detected (v18+ recommended). Upgrading..."
    brew upgrade node 2>/dev/null || brew install node
  fi
  success "Node.js found ($NODE_VER)"
fi

# Check npm
if ! command -v npm &> /dev/null; then
  fail "npm not found. Please reinstall Node.js."
fi
success "npm found ($(npm --version))"

# Check/install Git
if ! command -v git &> /dev/null; then
  info "Git not found. Installing via Homebrew..."
  brew install git || fail "Failed to install Git"
  success "Git installed"
else
  success "Git found ($(git --version | cut -d' ' -f3))"
fi

# ── Step 3: Clone or update repository ──────────────────────────────
step 3 "Downloading Electron Executor..."

# Deleting old Electron Executor installations to ensure a fresh clean reinstall
if pgrep -f "Electron Executor" >/dev/null 2>&1; then
  info "Terminating running Electron Executor instances..."
  pkill -f "Electron Executor" 2>/dev/null || true
  sleep 1
fi

if [ -d "/Applications/Electron Executor.app" ]; then
  info "Removing old Electron Executor application..."
  rm -rf "/Applications/Electron Executor.app" 2>/dev/null || true
  if [ -d "/Applications/Electron Executor.app" ]; then
    warn "Failed to remove old app. Trying with sudo..."
    sudo rm -rf "/Applications/Electron Executor.app" || true
  fi
fi

if [ -d "$INSTALL_DIR" ]; then
  info "Removing old Electron Executor source directory..."
  if [[ "$(pwd)" == "$INSTALL_DIR"* ]]; then
    cd "$HOME"
  fi
  rm -rf "$INSTALL_DIR" 2>/dev/null || true
  if [ -d "$INSTALL_DIR" ]; then
    warn "Failed to remove old source directory. Trying with sudo..."
    sudo rm -rf "$INSTALL_DIR" || true
  fi
fi

info "Cloning fresh repository from GitHub..."
git clone "$REPO_URL" "$INSTALL_DIR" || fail "Failed to clone repository. Check your internet connection."
cd "$INSTALL_DIR"
success "Repository cloned to $INSTALL_DIR"

# ── Step 4: Install Node.js dependencies ────────────────────────────
step 4 "Installing Node.js dependencies..."

cd "$INSTALL_DIR"
npm install 2>&1 | tail -3
if [ $? -eq 0 ]; then
  success "All dependencies installed"
else
  fail "Failed to install dependencies. Check the error above."
fi

# ── Step 5: Build and package macOS App ──────────────────────────────
step 5 "Building and packaging macOS App..."

cd "$INSTALL_DIR"
info "Compiling production build..."
npm run build 2>&1 | tail -3 || fail "Failed to compile production build."

# Ensure macOS application icon exists
if [ ! -f "public/logo.icns" ] && [ -f "public/logo.png" ]; then
  info "Generating macOS application icon..."
  mkdir -p public/logo.iconset
  sips -z 16 16     public/logo.png --out public/logo.iconset/icon_16x16.png &>/dev/null
  sips -z 32 32     public/logo.png --out public/logo.iconset/icon_16x16@2x.png &>/dev/null
  sips -z 32 32     public/logo.png --out public/logo.iconset/icon_32x32.png &>/dev/null
  sips -z 64 64     public/logo.png --out public/logo.iconset/icon_32x32@2x.png &>/dev/null
  sips -z 128 128   public/logo.png --out public/logo.iconset/icon_128x128.png &>/dev/null
  sips -z 256 256   public/logo.png --out public/logo.iconset/icon_128x128@2x.png &>/dev/null
  sips -z 256 256   public/logo.png --out public/logo.iconset/icon_256x256.png &>/dev/null
  sips -z 512 512   public/logo.png --out public/logo.iconset/icon_256x256@2x.png &>/dev/null
  sips -z 512 512   public/logo.png --out public/logo.iconset/icon_512x512.png &>/dev/null
  sips -z 1024 1024 public/logo.png --out public/logo.iconset/icon_512x512@2x.png &>/dev/null
  iconutil -c icns public/logo.iconset
  rm -rf public/logo.iconset
fi

# Packages the Electron app dynamically based on the current architecture
info "Packaging Electron app via electron-packager..."
npx electron-packager . "Electron Executor" --platform=darwin --overwrite --out=dist --icon=public/logo.icns --app-bundle-id=com.araemxa.electron-executor --ignore='^/dist($|/)|^/\.git($|/)|^/\.next/cache($|/)' 2>&1 | tail -3 || fail "Failed to package Electron application."

# Find the generated app path
APP_PATH=$(find dist -maxdepth 2 -name "Electron Executor.app" | head -n 1)
if [ -z "$APP_PATH" ]; then
  fail "Failed to find compiled Electron Executor.app in dist/"
fi

# Clean up unnecessary localization resources (.lproj) to keep Resources folder clean
info "Cleaning up unnecessary resources (localization files)..."
find "$APP_PATH/Contents/Resources" -name "*.lproj" -exec rm -rf {} + 2>/dev/null || true

# Clean previous install
rm -rf "/Applications/Electron Executor.app" 2>/dev/null || true
if [ -d "/Applications/Electron Executor.app" ]; then
  warn "Failed to remove old app. Trying with sudo..."
  sudo rm -rf "/Applications/Electron Executor.app" || fail "Could not remove old Electron Executor.app from /Applications."
fi

# Copy to Applications folder (requires no sudo for user-writable Applications folder)
if cp -R "$APP_PATH" "/Applications/" 2>/dev/null; then
  success "Successfully installed to /Applications/Electron Executor.app"
else
  warn "Failed to install directly to /Applications. Trying with sudo..."
  sudo cp -R "$APP_PATH" "/Applications/" || fail "Could not install to /Applications. Please drag-and-drop the app manually from $INSTALL_DIR/$APP_PATH."
fi

# Ad-hoc sign to prevent OS crash on launch
info "Applying ad-hoc signature..."
codesign --force --deep --sign - "/Applications/Electron Executor.app" 2>/dev/null || true
success "Codesign complete"

# Force Finder to reload application metadata and icon
info "Forcing macOS Finder to reload the application icon..."
xattr -cr "/Applications/Electron Executor.app" 2>/dev/null || true
touch "/Applications/Electron Executor.app"

# Clean up build directories immediately so macOS Spotlight/Launchpad don't index duplicate .app bundles
info "Cleaning up temporary build outputs..."
rm -rf "$INSTALL_DIR/dist" 2>/dev/null || true
rm -rf "$(pwd)/dist" 2>/dev/null || true
success "Temporary build outputs removed"

# Refresh Launchpad and Finder to reload icons
info "Refreshing macOS Launchpad and Finder databases..."
defaults write com.apple.dock ResetLaunchPad -bool true
killall Dock Finder 2>/dev/null || true
success "Launchpad and Finder databases refreshed"


# ── Step 6: Auto-setup Roblox ────────────────────────────────────────
step 6 "Setting up Roblox integration..."

if [ -f "$INSTALL_DIR/setup-roblox.sh" ]; then
  chmod +x "$INSTALL_DIR/setup-roblox.sh"
  bash "$INSTALL_DIR/setup-roblox.sh" --from-installer
  success "Roblox integration configured"
else
  warn "setup-roblox.sh not found. Skipping Roblox auto-setup."
  warn "You can run it manually later: ./setup-roblox.sh"
fi

# ── Step 7: Launch application ───────────────────────────────────────
step 7 "Launching Electron Executor..."

echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ║          ✅ Installation Complete!                   ║${NC}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}App Location:${NC}  /Applications/Electron Executor.app"
echo -e "  ${BOLD}Dev Folder:${NC}    $INSTALL_DIR"
echo -e "  ${BOLD}Re-inject:${NC}     ${CYAN}cd $INSTALL_DIR && ./setup-roblox.sh${NC}"
echo ""
echo -e "  ${DIM}────────────────────────────────────────────${NC}"
echo -e "  ${YELLOW}How to use:${NC}"
echo -e "  1. Wait for the app to fully load (5 sec splash screen)"
echo -e "  2. Open Roblox and join any game"
echo -e "  3. Injeksi otomatis — Electron Executor akan terhubung langsung"
echo -e "  4. Write Lua scripts and press ${GREEN}Execute ▶${NC}"
echo ""
echo -e "  ${DIM}Tidak perlu software pihak ketiga.${NC}"
echo -e "  ${DIM}Injeksi dilakukan langsung oleh Electron Executor.${NC}"
echo -e "  ${DIM}────────────────────────────────────────────${NC}"
echo ""

open "/Applications/Electron Executor.app"
