<div align="center">

# 🧱 XenoEditor

**Modern, open-source IDE for Minecraft Development**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://github.com/phytonhacker/XenoEditor-opensoruce)
[![Electron](https://img.shields.io/badge/Built%20with-Electron-47848f?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![CodeMirror](https://img.shields.io/badge/Editor-CodeMirror-d30707?logo=codemirror&logoColor=white)](https://codemirror.net/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/phytonhacker/XenoEditor-opensoruce/pulls)
[![GitHub stars](https://img.shields.io/github/stars/phytonhacker/XenoEditor-opensoruce?style=social)](https://github.com/phytonhacker/XenoEditor-opensoruce/stargazers)

*A lightweight desktop IDE built specifically for Minecraft modders and addon developers.*

</div>

---

## 📸 Screenshots

> *Coming soon – add screenshots of the editor here to make your repo stand out!*

---

## ✨ Features

- 🏠 **Welcome Screen** – Project launcher with recent projects and quick-start cards
- 🧙 **New Project Wizard** – Step-by-step project setup with Minecraft-specific templates
- 🗂️ **File Tree Sidebar** – Browse and manage your project files easily
- 📑 **Multi-tab Editor** – Work on multiple files simultaneously with a tabbed interface
- 🗺️ **Minimap** – Bird's-eye view of your code for fast navigation
- 🎨 **Dracula Theme** – Beautiful dark color scheme, easy on the eyes
- 🖥️ **Integrated Console** – Run and monitor your project without leaving the editor
- ⚠️ **Problems Panel** – See errors, warnings and info messages at a glance
- 💻 **Integrated Terminal** – Full terminal access built right in
- 🔍 **Syntax Highlighting** – Powered by [CodeMirror](https://codemirror.net/) with autocomplete support

---

## 💻 System Requirements

| Requirement | Details |
|---|---|
| **OS** | Windows 10 / 11 (x64) |
| **Node.js** | LTS version recommended |
| **npm** | Included with Node.js |

> ⚠️ **Windows only.** macOS and Linux support is not available at this time.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/phytonhacker/XenoEditor-opensoruce.git
cd XenoEditor-opensoruce
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run in development mode

```bash
npm start
```

Or use the included Windows batch script:

```bash
debug.bat
```

---

## 🏗️ Building for Windows

```bash
npm run build:win
```

Or use the batch script:

```bash
build.bat
```

The output (installer + portable `.exe`) will appear in the `dist/` folder.

| Output format | Description |
|---|---|
| NSIS Installer | Standard Windows setup wizard |
| Portable `.exe` | Run without installing |

---

## 📁 Project Structure

```
XenoEditor-opensoruce/
├── main.js          # Electron main process
├── index.html       # Editor UI & all IDE logic
├── styles.css       # Stylesheet
├── package.json     # Project metadata & build config
├── build.bat        # Windows build script
└── debug.bat        # Windows dev/debug launcher
```

---

## 🛠️ Tech Stack

| Technology | Role |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop application shell |
| [CodeMirror 5](https://codemirror.net/) | Code editor engine with Dracula theme |
| HTML / CSS / JS | UI & renderer logic |

---

## 🤝 Contributing

Contributions are very welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Feel free to open an [Issue](https://github.com/phytonhacker/XenoEditor-opensoruce/issues) for bugs or feature requests.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**phytonhacker**

[![GitHub](https://img.shields.io/badge/GitHub-phytonhacker-181717?logo=github)](https://github.com/phytonhacker)

---

<div align="center">

*Made with ❤️ for the Minecraft developer community*

⭐ If you find this project useful, please consider leaving a star!

</div>
