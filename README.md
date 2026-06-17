# Electron Executor 🚀

Premium, secure, and next-generation Roblox script executor built on **Next.js 16**, **Electron**, and **PostgreSQL**. Features lightning-fast startup splash loading screens, dynamic process detection, local script management, and local/cloud synchronization capabilities.

---

## 🌟 Key Features

- **Startup Splash Screen**: A premium 5-second animated loading screen featuring a breathing squircle logo, a neon progress bar, and real-time status updates on system initialization.
- **Mac-Style Inset Context Menus**: Beautiful right-click tab context menus matching macOS styling guidelines.
- **Built-in Lua Engine Simulator**: Run scripts locally using the simulator even when Roblox isn't connected.
- **Roblox Studio Integration**: Automated copying of Roblox connection hooks to Studio plugins and Autoexec exploit folders on boot.
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
1. **Node.js** (v18 or higher recommended)
2. **PostgreSQL** running locally

---

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ARAEMXA26/Electron-Executor.git
   cd Electron-Executor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Database**:
   The application auto-connects to a local PostgreSQL instance. If the database role `postgres` is missing, the application attempts fallback connections to empty-password configurations and active system users.

4. **Launch development server**:
   ```bash
   npm run dev
   ```

---

## 🚀 Usage

1. Open the application. Wait 5 seconds for the system to boot up.
2. Sign up or log in. Ethereal developer OTP logs will be visible in the console if Ethereal SMTP is used.
3. Open a `.lua` or `.txt` file, or create a new tab.
4. Execute scripts into active Roblox instances or run them in the simulator!

---

## 📝 License

Distributed under the ISC License. See `package.json` for details.
