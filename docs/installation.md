# Installation

[← Docs index](README.md)

## Requirements

- Spotify Desktop
- Spicetify `>= 2.0.0`
- The [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) extension, installed and working
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
