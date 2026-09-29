<div align="center">

# 👀 PeekABooCode

### Clean. Scan. Check. Test. Understand.

**A privacy-first, browser-based toolkit for links, QR codes, barcodes, threat checking, and pre-call testing.**

Runs in your browser by default: **no accounts, no backend, no tracking, no logs.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![No Backend](https://img.shields.io/badge/Backend-None-success?style=flat-square)
![Privacy First](https://img.shields.io/badge/Privacy-First-16A34A?style=flat-square)
![Singlish](https://img.shields.io/badge/Language-English%20%7C%20Singlish-orange?style=flat-square)

</div>

---

## About

PeekABooCode is a single-page web app that combines several everyday utilities into one lightweight tool:

- 🔗 **Link Cleaner**: strip tracking parameters
- 🛡️ **Threat Checker**: local check, plus an optional online check
- 📷 **QR & Barcode Scanner**: from an image or camera
- 🧩 **Code Generator**: QR, Code 128, EAN-13
- 🎥 **A/V Test**: camera, mic, speaker
- 📚 **Help Center**: full documentation
- 🤖 **Help Bot**: local, Singlish-aware
- ⚙️ **Settings**: custom mapping, import/export, theme

> Your data stays in your browser unless you explicitly choose otherwise.

---

## Features

### 🔗 Link Cleaner
Removes common tracking parameters (`utm_*`, `fbclid`, `gclid`, `igshid`, `mc_eid`, `_ga`, etc.), preserves fragments, detects the source platform, handles bare domains, warns about embedded credentials, and detects link shorteners.

### 🛡️ Threat Checker
**Local (automatic):** typosquatting, homograph/Punycode, IP hosts, excessive subdomains, non-standard ports, suspicious TLDs, missing HTTPS, redirect parameters, long URLs, embedded credentials.

| Verdict | Meaning |
|---------|---------|
| 🟢 Clean | No local warning signs found |
| 🟡 Caution | Some risk signals present |
| 🔴 Suspicious | Multiple or strong risk signals |
| ⚪ Unknown | Not enough information to judge |

**Online (opt-in only):** you consent first, then the link is checked externally. CORS blocks and failures are reported honestly, never faked.

### 📷 QR & Barcode Scanner
Decodes from image upload, drag-and-drop, or camera.

- **2D:** QR, Data Matrix, Aztec, PDF417
- **1D:** EAN, UPC, Code 39, Code 128, ITF, Codabar

**Smart routing:**
- QR with a URL → clean + threat check
- QR with text, WiFi, or vCard → copy only
- Barcode with a number → copy or search
- Barcode with a URL → clean

### 🧩 Code Generator
QR, Code 128, and EAN-13. Preview and download as PNG or SVG. Always encodes the **cleaned** URL.

### 🎥 Pre-Call A/V Test
Camera preview, mic level meter, speaker tone, device pickers, and an optional short recording. No auto-recording, no uploads, and devices are released as soon as you stop.

### 🤖 Help Bot
Rule-based, with no AI API. Supports English and Singlish through keyword matching, 👍/👎 feedback, local learning, and custom questions. Its knowledge comes from the same `help-content.json` used by the Help Center.

### 📚 Help Center
The single source of documentation. Topics: Link Cleaner, QR vs Barcode, Phishing Protection, A/V Test, Short Links, Settings, Privacy, Bot, and a Singlish glossary.

### ⚙️ Settings
Custom app mapping, custom tracking parameters, theme (Light / Dark / System), and bot reset.

| Format | Import | Export |
|--------|:------:|:------:|
| JSON   |   ✅   |   ✅   |
| CSV    |   ✅   |   ✅   |
| XLS    |   ✅   |   ✅   |
| PDF    |   ❌   |   ✅   |

JSON is recommended for backups. PDF is for print/share only.

---

## Privacy

**Stays in your browser:** URLs · QR/barcode images · camera and mic data · bot conversations · settings · custom mappings

**Leaves your browser only when you click:**
- Online threat check
- Short-link expansion
- "Search this code"

Each of these is clearly labeled before any external request is made.

---

## Tech Stack

| Purpose            | Technology                          |
|--------------------|-------------------------------------|
| Frontend           | HTML5, CSS3, JavaScript             |
| QR generation      | `qrcode`                            |
| Barcode generation | `JsBarcode`                         |
| Code decoding      | `@zxing/library`, `@zxing/browser`  |
| Spreadsheet        | SheetJS                             |
| PDF export         | jsPDF / pdf-lib                     |
| Storage            | `localStorage`                      |

No framework. No build step. No server.

---

## Project Structure

```
PeekABooCode/
├── index.html
├── privacy.html
├── css/
│   ├── theme.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── app.js, tabs.js, menu.js
│   ├── link-cleaner.js, scan.js, generate-code.js
│   ├── threat-checker.js, call-test.js
│   ├── settings.js, theme.js, preloader.js
│   ├── icons.js, short-link.js, help-page.js
│   └── bot/
│       ├── bot.js, engine.js, storage.js
├── data/
│   ├── help-content.json
│   ├── singlish.json
│   ├── app-mapping.json
│   └── threat-signatures.json
└── assets/icons/
```

---

## Getting Started

There's no build process. Just serve the folder.

```bash
git clone https://github.com/Amika1118/PeekABooCode.git
cd PeekABooCode
```

Then use any static server. With VS Code, right-click `index.html` → **Open with Live Server**.

> ⚠️ Camera and mic need a secure context. Use `https://` or `localhost`.

---

## Routes

| Route                  | Purpose                                |
|------------------------|----------------------------------------|
| `/#clean`              | Link Cleaner, Scanner, Threat Checker  |
| `/#test`               | Camera, mic, speaker test              |
| `/#help`               | Documentation                          |
| `/#settings`           | Settings                               |
| `/#help/qr-vs-barcode` | Direct Help section                    |

---

## Design Principles

- **Privacy first**: local by default
- **Transparency**: say when data leaves the browser
- **User control**: warn, don't silently block
- **Accessibility**: themes, reduced motion, WCAG AA, responsive
- **Simplicity**: no account, no setup, no backend

---

## Disclaimer

PeekABooCode is a convenience and security-awareness tool. Threat detection is **not a guarantee**, and a link marked clean may still be unsafe. Always be cautious with passwords, banking, payment, and personal information.

---

## Contributing

Open an issue for bugs or ideas. Pull requests are welcome.

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

### 👀 Peek before you click.

**PeekABooCode: understand what you're scanning before you trust it.**

</div>