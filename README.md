# Electron Executor ⚡

Premium, secure, and next-generation Roblox script executor built on **Next.js 16**, **Electron**, and **PostgreSQL**. Features lightning-fast startup splash loading screens, dynamic process detection, local script management, and local/cloud synchronization capabilities.

---

## ⚡ Quick Install (One Command)

Open **Terminal** and paste this:

```bash
curl -sSL https://raw.githubusercontent.com/ARAEMXA26/Electron-Executor/main/install.sh | bash
```

This will automatically:
- ✅ Install Homebrew & Node.js (if missing)
- ✅ Clone the repository
- ✅ Install all dependencies
- ✅ Auto-patch Roblox folders (plugins, settings, autoexec)
- ✅ Launch the application

---

## 🌟 Key Features

- **Startup Splash Screen**: A premium 5-second animated loading screen featuring a breathing squircle logo, a neon progress bar, and real-time status updates on system initialization.
- **Mac-Style Inset Context Menus**: Beautiful right-click tab context menus matching macOS styling guidelines.
- **Built-in Lua Engine Simulator**: Run scripts locally using the simulator even when Roblox isn't connected.
- **Roblox Studio Integration**: Automated copying of Roblox connection hooks to Studio plugins and Autoexec exploit folders on boot.
- **Auto Roblox Patching**: Automatically creates `ClientAppSettings.json` to enable HTTP connections between the executor and Roblox.
- **Robust Database Sync**: Syncs local scripts and profile metrics automatically to a PostgreSQL database.
- **Secure Email OTP Authentication**: Register and login securely using numeric 6-digit verification codes.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, React, Next.js (Turbopack), Tailwind CSS, Framer Motion
- **Desktop Wrapper**: Electron
- **Database**: PostgreSQL (pg client)
- **Email Dispatch**: Nodemailer

---

## ⚙️ Prerequisites

Before installing the project, make sure you have:
1. **macOS** (Apple Silicon or Intel)
2. **Node.js** (v18 or higher recommended) — auto-installed by the installer
3. **PostgreSQL** running locally (optional, for cloud sync features)

---

## 📦 Manual Installation & Setup

If you prefer manual setup over the one-command installer:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ARAEMXA26/Electron-Executor.git
   cd Electron-Executor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Setup Roblox integration** (auto-patches all folders):
   ```bash
   chmod +x setup-roblox.sh && ./setup-roblox.sh
   ```

4. **Launch development server**:
   ```bash
   npm run dev
   ```

---

## 🔧 Roblox Setup (Re-run Anytime)

If Roblox updates and breaks the executor connection, simply re-run:

```bash
./setup-roblox.sh
```

This script will:
- Copy `ElectronLoader.lua` to Roblox Studio Plugins
- Create autoexec files for macOS exploit clients (MacSploit, Hydrogen, Wave, etc.)
- Create `ClientAppSettings.json` with HTTP flags enabled
- Verify all file placements

---

## 🚀 Usage

1. Open the application. Wait 5 seconds for the system to boot up.
2. Sign up or log in. Ethereal developer OTP logs will be visible in the console if Ethereal SMTP is used.
3. Open a `.lua` or `.txt` file, or create a new tab.
4. Execute scripts into active Roblox instances or run them in the simulator!

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Executor can't connect to Roblox | Run `./setup-roblox.sh` to re-patch all folders |
| Port 8392 already in use | Run `lsof -ti :8392 \| xargs kill -9` |
| Roblox Studio: HTTP error | Enable in Studio: `Game Settings → Security → Allow HTTP Requests` |
| Node.js not found | Install via `brew install node` |
| After Roblox update, loader broken | Run `./setup-roblox.sh` — it re-copies everything |

---

## 📝 License

Distributed under the ISC License. See `package.json` for details.
