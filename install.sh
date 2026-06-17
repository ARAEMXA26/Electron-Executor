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
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║                                                      ║"
  echo "  ║   ███████╗██╗     ███████╗ ██████╗████████╗██████╗   ║"
  echo "  ║   ██╔════╝██║     ██╔════╝██╔════╝╚══██╔══╝██╔══██╗  ║"
  echo "  ║   █████╗  ██║     █████╗  ██║        ██║   ██████╔╝  ║"
  echo "  ║   ██╔══╝  ██║     ██╔══╝  ██║        ██║   ██╔══██╗  ║"
  echo "  ║   ███████╗███████╗███████╗╚██████╗   ██║   ██║  ██║  ║"
  echo "  ║   ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝  ║"
  echo "  ║                                                      ║"
  echo "  ║        ⚡ EXECUTOR — Premium Lua Engine ⚡          ║"
  echo "  ║              for Roblox on macOS                     ║"
  echo "  ║                                                      ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
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
TOTAL_STEPS=6

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

# Check if Roblox is installed
if [ -d "/Applications/Roblox.app" ] || [ -d "$HOME/Applications/Roblox.app" ]; then
  success "Roblox Player found"
else
  warn "Roblox Player not found — you can install it later from roblox.com"
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

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Existing installation found. Updating..."
  cd "$INSTALL_DIR"
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || warn "Could not pull latest changes (continuing with existing files)"
  success "Repository updated"
else
  if [ -d "$INSTALL_DIR" ]; then
    info "Directory exists but is not a git repo. Backing up..."
    mv "$INSTALL_DIR" "${INSTALL_DIR}_backup_$(date +%s)"
  fi
  info "Cloning from GitHub..."
  git clone "$REPO_URL" "$INSTALL_DIR" || fail "Failed to clone repository. Check your internet connection."
  cd "$INSTALL_DIR"
  success "Repository cloned to $INSTALL_DIR"
fi

# ── Step 4: Install Node.js dependencies ────────────────────────────
step 4 "Installing Node.js dependencies..."

cd "$INSTALL_DIR"
npm install 2>&1 | tail -3
if [ $? -eq 0 ]; then
  success "All dependencies installed"
else
  fail "Failed to install dependencies. Check the error above."
fi

# ── Step 5: Auto-setup Roblox ────────────────────────────────────────
step 5 "Setting up Roblox integration..."

if [ -f "$INSTALL_DIR/setup-roblox.sh" ]; then
  chmod +x "$INSTALL_DIR/setup-roblox.sh"
  bash "$INSTALL_DIR/setup-roblox.sh" --from-installer
  success "Roblox integration configured"
else
  warn "setup-roblox.sh not found. Skipping Roblox auto-setup."
  warn "You can run it manually later: ./setup-roblox.sh"
fi

# ── Step 6: Launch application ───────────────────────────────────────
step 6 "Launching Electron Executor..."

echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ║          ✅ Installation Complete!                   ║${NC}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Location:${NC}    $INSTALL_DIR"
echo -e "  ${BOLD}Run again:${NC}   ${CYAN}cd $INSTALL_DIR && npm run dev${NC}"
echo -e "  ${BOLD}Roblox fix:${NC}  ${CYAN}cd $INSTALL_DIR && ./setup-roblox.sh${NC}"
echo ""
echo -e "  ${DIM}────────────────────────────────────────────${NC}"
echo -e "  ${YELLOW}How to use:${NC}"
echo -e "  1. Wait for the app to fully load (5 sec splash screen)"
echo -e "  2. Open Roblox and join a game"
echo -e "  3. The app will auto-detect Roblox running"
echo -e "  4. Write/load Lua scripts and press ${GREEN}Execute ▶${NC}"
echo -e "  ${DIM}────────────────────────────────────────────${NC}"
echo ""

cd "$INSTALL_DIR"
npm run dev
