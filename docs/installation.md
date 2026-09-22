# Installation

[← Docs index](README.md)

## Requirements

- Spotify Desktop, within the range Spicetify supports:
  - Windows / macOS: `1.2.14` – `1.3.1`
  - Linux: `1.2.14` – `1.2.96`
- Spicetify `>= 2.45.1` — required on Spotify `1.3.x`, where older Spicetify builds drop the **ST Settings** profile-menu entry and break popup modal sizing. Run `spicetify update` if you're behind.
- The [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) extension, installed and working (tested through `6.3.20`)
- An internet connection for the Marketplace, Theme Creator, and update checks (everything else works offline)

## Option 1 — Spicetify Marketplace (recommended)

1. Open Spotify and go to **Marketplace → Extensions**.
2. Search for **Spicy Themes** and install it.
3. Restart Spotify.

You'll get updates automatically — the extension ships as a thin loader that fetches and verifies the latest build on startup.

## Option 2 — Manual

1. Download `spicy-themes.js` from the [latest release](https://github.com/7xeh/SpicyThemes/releases/latest).
2. Drop it into your Spicetify extensions folder:
   - **Windows** — `%APPDATA%\spicetify\Extensions`
   - **macOS / Linux** — `~/.config/spicetify/Extensions`
3. Register and apply it:

```bash
spicetify config extensions spicy-themes.js
```

```bash
spicetify apply
```

4. Restart Spotify.

---

Next: [Getting started](getting-started.md) · Trouble? [Troubleshooting](troubleshooting.md)
