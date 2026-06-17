#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "===================================================="
echo "    ______              __                          "
echo "   / ____/___  _______ / /__________  ____          "
echo "  / __/ / __ \/ ___/ / / / ___/ ___/ __ \\         "
echo " / /___/ /_/ / /__/ /_/ / /  / /  / /_/ /           "
echo "/_____/\____/\___/\____/_/  /_/   \____/            "
echo "                                                    "
echo "              LUA EXECUTOR INSTALLER                 "
echo "===================================================="
echo -e "${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[Error] Node.js is not installed.${NC}"
    echo -e "Please install Node.js first (e.g. via Homebrew: ${YELLOW}brew install node${NC})"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[Error] npm is not installed.${NC}"
    exit 1
fi

echo -e "${BLUE}[1/2] Installing Node.js dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[Success] Dependencies installed successfully!${NC}"
else
    echo -e "${RED}[Error] Failed to install dependencies.${NC}"
    exit 1
fi

echo -e "${BLUE}[2/2] Starting Electron Lua Executor...${NC}"
echo -e "${YELLOW}====================================================${NC}"
echo -e "${YELLOW}To execute scripts in Roblox Studio / Executor:${NC}"
echo -e "1. Open your Roblox environment."
echo -e "2. Run the connector script found in ${CYAN}loader.lua${NC}."
echo -e "3. Press the ${GREEN}Execute (Play)${NC} button in the Electron app."
echo -e "${YELLOW}====================================================${NC}"

npm start
