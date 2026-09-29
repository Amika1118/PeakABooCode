<div align="center">

# 👀 PeekABooCode

### Clean. Scan. Check. Test. Understand.

**A privacy-first, browser-based toolkit for links, QR codes, barcodes, threat checking, and pre-call testing.**

Everything runs directly in your browser - **no accounts, no backend, no tracking, no logs.**

<br>

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge\&logo=html5\&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge\&logo=css3\&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge\&logo=javascript\&logoColor=black)
![No Framework](https://img.shields.io/badge/Framework-None-111827?style=for-the-badge)
![Privacy First](https://img.shields.io/badge/Privacy-First-16A34A?style=for-the-badge)
![Client Side](https://img.shields.io/badge/Processing-Client--Side-2563EB?style=for-the-badge)

<br>

[![Made with Love](https://img.shields.io/badge/Made_with-♥-ff69b4?style=flat-square)](#)
[![No Backend](https://img.shields.io/badge/Backend-None-success?style=flat-square)](#)
[![No Analytics](https://img.shields.io/badge/Analytics-None-success?style=flat-square)](#)
[![Singlish Support](https://img.shields.io/badge/Language-English%20%7C%20Singlish-orange?style=flat-square)](#)

</div>

---

## 📖 About

**PeekABooCode** is a privacy-first, single-page web application designed to make everyday links and digital codes safer and easier to understand.

It combines multiple utilities into one lightweight browser application:

* 🔗 **Link Cleaner**
* 🛡️ **Threat Checker**
* 📷 **QR & Barcode Scanner**
* 🧩 **QR & Barcode Generator**
* 🎥 **Camera / Microphone / Speaker Test**
* 📚 **Interactive Help Center**
* 🤖 **Local Singlish-aware Help Bot**
* ⚙️ **Custom Settings & Data Management**

The core philosophy is simple:

> **Your data should stay in your browser unless you explicitly choose otherwise.**

No account is required, and the application has no traditional backend or database.

---

## ✨ Features

### 🔗 Link Cleaner

Clean URLs before sharing or opening them.

**Automatically detects and removes common tracking parameters such as:**

* `utm_*`
* `fbclid`
* `gclid`
* `igshid`
* `mc_eid`
* `_ga`
* and other known tracking parameters

It also:

* Preserves URL fragments
* Detects the source platform
* Handles bare domains
* Warns about embedded credentials
* Detects common URL shorteners
* Keeps the original URL available for copying
* Never silently modifies unsafe protocols

### 🛡️ Threat Checker

PeekABooCode uses a **hybrid threat-checking system**.

#### Tier 1 - Local Analysis

Every link can be checked locally without making a network request.

It looks for indicators such as:

* Typosquatting
* Homograph / Punycode domains
* Suspicious IP-based hosts
* Excessive subdomains
* Non-standard ports
* Suspicious TLDs
* Missing HTTPS
* Suspicious redirect parameters
* Excessively long URLs
* Embedded credentials
* Suspicious login/account keywords

#### Verdicts

| Verdict            | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| 🟢 **Looks Clean** | No major suspicious indicators detected           |
| 🟡 **Caution**     | Minor concerns were detected                      |
| 🔴 **Suspicious**  | Strong indicators of a potentially dangerous link |
| ⚪ **Unknown**      | No reliable verdict available                     |

> **Important:** A "clean" result does not guarantee that a website is safe.

#### Tier 2 - Optional Online Check

Users can optionally perform an online threat check.

The link is only sent externally after explicit user consent.

If the online service is unavailable or blocked by CORS, PeekABooCode reports that honestly instead of pretending the link is safe.

---

## 📷 QR & Barcode Scanner

Scan codes directly from:

* 🖼️ Uploaded images
* 📸 Camera
* Drag-and-drop files

Supported code types include:

**2D**

* QR
* Data Matrix
* Aztec
* PDF417

**1D**

* EAN
* UPC
* Code 39
* Code 128
* ITF
* Codabar

### 🧠 Smart Routing

PeekABooCode automatically determines what the scanned code contains.

```text
                 ┌──────────────┐
                 │  Scan Code   │
                 └──────┬───────┘
                        │
                 Detect Format
                        │
          ┌─────────────┴─────────────┐
          │                           │
       QR / 2D                     Barcode
          │                           │
     Detect Content             Detect Content
          │                           │
     ┌────┴────┐               ┌─────┴─────┐
     │         │               │           │
    URL      Text           Product      URL
     │         │               │           │
 Clean +    Copy only      Copy/Search   Clean
 Threat
 Check
```

For example:

```text
QR → https://instagram.com/...
        ↓
    Clean Link
        ↓
    Detect Source
        ↓
    Threat Check
        ↓
    Make QR Code
```

A QR code containing Wi-Fi information or a vCard is **not treated as a web link**.

---

## 🧩 Code Generator

Generate codes directly in the browser.

### Supported MVP formats

* QR
* Code 128
* EAN-13

Additional barcode formats can be added later.

Generated codes can be:

* 👁️ Previewed
* 📥 Downloaded as PNG
* 📥 Downloaded as SVG

PeekABooCode always generates codes from the **cleaned URL**, rather than the original tracking-heavy URL.

---

## 🎥 Pre-Call A/V Test

Check your devices before joining a meeting.

### Camera

* Live camera preview
* Camera selection
* Permission status
* Immediate device release

### Microphone

* Live microphone level meter
* Microphone selection
* Permission status
* Optional short recording test

### Speaker

* Speaker test tone
* Device selection where supported

### Privacy

There is:

* ❌ No automatic recording
* ❌ No uploads
* ❌ No analytics
* ❌ No background device access

Camera and microphone access only starts after the user explicitly requests it.

---

## 🤖 Local Help Bot

PeekABooCode includes a lightweight **rule-based help bot**.

It does **not** use an AI API.

### Features

* 🇬🇧 English
* 🇱🇰 Singlish
* 💬 Natural keyword matching
* 👍 / 👎 feedback
* 🧠 Local learning
* ➕ Custom questions
* 🔎 Suggested questions
* 📖 Links directly to Help sections

The bot's knowledge comes from the same help-content file used by the Help page.

```text
help-content.json
       │
       ├──────────────► Help Page
       │
       └──────────────► Help Bot
```

This keeps the documentation and bot knowledge synchronized.

### Singlish Support

The bot can recognize common Singlish expressions such as:

```text
oni
oney
karanna
krnna
puluwanda
mokada
kohomada
```

Users can choose:

* 🇬🇧 English
* 🇱🇰 Singlish
* 🔄 Auto

All bot learning remains inside the browser.

---

## 📚 Help Center

The Help section acts as the application's **single source of truth**.

Topics include:

1. What is PeekABooCode?
2. Link Cleaner
3. QR vs Barcode
4. Phishing & Spam Protection
5. Pre-call A/V Testing
6. Short Link Expansion
7. Settings
8. Privacy
9. Help Bot
10. Singlish Glossary

Help content is stored in:

```text
data/help-content.json
```

The same data powers both the Help page and the bot.

---

## ⚙️ Settings

PeekABooCode allows users to customize their local experience.

### Custom App Mapping

Add, edit, or remove:

* Domain
* Application name
* Icon

### Custom Tracking Parameters

Users can add their own parameters, including wildcard patterns such as:

```text
utm_*
```

### Import / Export

Supported formats:

| Format | Import | Export |
| ------ | :----: | :----: |
| JSON   |    ✅   |    ✅   |
| CSV    |    ✅   |    ✅   |
| XLS    |    ✅   |    ✅   |
| PDF    |    ❌   |    ✅   |

**JSON** is recommended for complete backups.

**CSV/XLS** are useful for spreadsheet editing.

**PDF** is intended for printing or sharing.

### Theme

* ☀️ Light
* 🌙 Dark
* 💻 System

The selected theme is stored locally.

---

## 🔐 Privacy

Privacy is one of the core design principles of PeekABooCode.

### By default

```text
Browser
   │
   ├── Link cleaning
   ├── Threat analysis
   ├── QR decoding
   ├── Barcode decoding
   ├── Code generation
   ├── Help bot
   └── Settings
          │
          ▼
     Local Storage
```

No backend is required.

### Data does NOT automatically leave your browser

* URLs
* QR images
* Barcode images
* Camera footage
* Microphone recordings
* Bot conversations
* Settings
* Custom mappings

### Optional network actions

Network requests only occur when the user explicitly chooses actions such as:

* 🔎 Online threat checking
* 🔗 Short-link expansion
* 🔍 Searching a barcode/code

Each action is clearly identified before external communication occurs.

---

## 🏗️ Architecture

PeekABooCode is intentionally built as a **static single-page application**.

```text
┌─────────────────────────────────────┐
│          PeekABooCode               │
│          Single Page App             │
├─────────────────────────────────────┤
│                                     │
│  Clean   Test   Help   Settings     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│       Client-Side JavaScript        │
│                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Cleaner│ │Scanner │ │Threat  │  │
│  │        │ │        │ │Checker │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Code   │ │ A/V    │ │ Help   │  │
│  │Generator│ │ Test   │ │ Bot    │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
└─────────────────────────────────────┘
                 │
                 ▼
          Browser Storage
          localStorage
```

### Hosting

Because there is no backend, PeekABooCode can be deployed to static hosting platforms such as:

* GitHub Pages
* Cloudflare Pages
* Netlify
* Vercel

---

## 🛠️ Tech Stack

| Purpose             | Technology       |
| ------------------- | ---------------- |
| Frontend            | HTML5            |
| Styling             | CSS3             |
| Logic               | JavaScript       |
| QR Generation       | `qrcode`         |
| Barcode Generation  | `JsBarcode`      |
| Code Decoding       | `@zxing/library` |
| Browser Scanning    | `@zxing/browser` |
| Spreadsheet Support | SheetJS          |
| PDF Export          | jsPDF / pdf-lib  |
| Storage             | `localStorage`   |
| Architecture        | Static SPA       |

No frontend framework is required.

No build system is required.

No server is required.

---

## 📁 Project Structure

```text
PeekABooCode/
│
├── index.html
├── privacy.html
│
├── css/
│   ├── theme.css
│   ├── layout.css
│   └── components.css
│
├── js/
│   ├── app.js
│   ├── tabs.js
│   ├── menu.js
│   ├── link-cleaner.js
│   ├── scan.js
│   ├── generate-code.js
│   ├── threat-checker.js
│   ├── call-test.js
│   ├── settings.js
│   ├── theme.js
│   ├── preloader.js
│   ├── icons.js
│   ├── short-link.js
│   ├── help-page.js
│   │
│   └── bot/
│       ├── bot.js
│       ├── engine.js
│       └── storage.js
│
├── data/
│   ├── help-content.json
│   ├── singlish.json
│   ├── app-mapping.json
│   └── threat-signatures.json
│
└── assets/
    └── icons/
```

---

## 🚀 Getting Started

PeekABooCode requires no build process.

Clone the repository:

```bash
git clone <your-repository-url>
```

Open the project:

```text
PeekABooCode/
```

Then serve it using any static web server.

For example, with VS Code's Live Server:

```text
Right Click index.html
        ↓
Open with Live Server
```

### ⚠️ HTTPS Requirement

Camera and microphone features require a secure context.

Use:

* `https://`
* `localhost`

when testing device access.

---

## 🧭 Application Routes

PeekABooCode uses hash-based navigation.

| Route                  | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `/#clean`              | Link Cleaner, Scanner, Threat Checker & Generator |
| `/#test`               | Camera, microphone & speaker testing              |
| `/#help`               | Documentation                                     |
| `/#settings`           | Application settings                              |
| `/#help/qr-vs-barcode` | Direct Help section                               |

---

## 🛡️ Security Philosophy

PeekABooCode follows a **warn, don't silently block** approach.

If a link appears suspicious:

```text
🔴 Suspicious Link

        ↓

Explain why

        ↓

Warn the user

        ↓

Allow the user to decide
```

The application does not silently prevent users from copying or continuing with a link.

However, dangerous-looking links receive an additional warning before being converted into a QR code.

---

## 🎨 Design Principles

PeekABooCode is designed around several principles:

### Privacy First

Keep processing local whenever possible.

### Transparency

Tell users when information will leave the browser.

### User Control

Never silently block or transmit user data.

### Accessibility

Support:

* Light / dark themes
* Reduced motion
* WCAG AA contrast
* Responsive layouts
* Mobile browsers

### Simplicity

No account.

No complicated setup.

No unnecessary backend.

---

## 📱 Responsive Design

The application is designed for:

* 🖥️ Desktop
* 💻 Laptop
* 📱 Mobile
* 📟 Tablet

On smaller screens, the main navigation transforms into a hamburger menu.

```text
Desktop

[ Clean ] [ Test ] [ Help ] [ Settings ]


Mobile

[ ☰ ]
```

The hamburger icon morphs into an `X` when opened.

---

## ⚠️ Disclaimer

PeekABooCode is a **convenience and security-awareness tool**.

Threat detection is not a guarantee that a website is safe or malicious.

A link marked as clean may still contain threats that cannot be detected by the available checks.

Always use caution when entering:

* Passwords
* Banking information
* Payment details
* Personal information

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

If you find a bug or have an idea:

1. Open an issue
2. Describe the problem or feature
3. Include steps to reproduce when applicable
4. Submit a pull request for improvements

---

## 📄 License

Add your preferred license here.

For example:

```text
MIT License
```

---

<div align="center">

### 👀 Peek before you click.

**PeekABooCode - understand what you're scanning before you trust it.**

Built with HTML, CSS & JavaScript.

</div>
