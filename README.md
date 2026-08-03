<div align="center">

# Spicy Themes

**Restyle [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) from inside Spotify — colors, glow, gradients, blur, typography, motion, music videos, an audio-reactive equalizer, and a community theme marketplace.**

[![Discord](https://img.shields.io/badge/Discord-Join%20the%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/fXK34DeDW5)

![Spicetify](https://img.shields.io/badge/Spicetify-Extension-1DB954?style=flat-square&logo=spotify&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Online-success?style=flat-square)

![Preview](https://github.com/7xeh/SpicyThemes/blob/main/st-preview.gif?raw=true)

![Preview](preview.png)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Install](#install)
- [First run](#first-run)
- [The settings modal](#the-settings-modal)
- [Settings reference](#settings-reference)
- [Built-in presets](#built-in-presets)
- [Theme Creator](#theme-creator)
- [Theme Marketplace](#theme-marketplace)
- [Sharing themes](#sharing-themes)
- [Translator support](#translator-support)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Building from source](#building-from-source)
- [Support and links](#support-and-links)

---

## What it does

Spicy Lyrics gives you synced, word-by-word lyrics in Spotify. Spicy Themes gives you control over how they look — around 90 settings, live-previewed, saved as presets, and shareable as a single JSON file.

| | |
|---|---|
| **Line colors** | Independent color and opacity for the active line, already-sung lines, and upcoming lines. |
| **Gradient text** | Two-color karaoke fill with a horizontal, vertical, diagonal, or Spicy-Lyrics-matched sweep. RTL-aware. |
| **Typography** | 28 bundled fonts or any custom family, per-weight control, a heavier active line, capitalization, size, letter spacing, line spacing. |
| **Glow** | Separate glow for the active line, the other lines, and the word being sung right now — plus an optional breathing pulse and a hard drop shadow for readability. |
| **Focus** | Blur everything but the active line (progressively, if you like), keep N upcoming lines sharp, fade words as they're sung, or hide everything outside a window around the current line. |
| **Motion** | Pop and Wave word animations, active-line zoom, zoom-in on arrival, global animation speed, and a flat-color mode that turns the karaoke sweep off entirely. |
| **Background** | Color tint over the album-art background, plus synced music videos playing behind the lyrics with adjustable dimming. |
| **Now Playing bar** | Rounded album art, progress bar thickness, custom accent color, animated controls, and toggles to hide shuffle / repeat / like. |
| **Equalizer** | Six audio-reactive visualizer styles beside the song title, with color, size, speed, and placement. |
| **Translation** | Dedicated styling for [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator) lines — own font, size, opacity, base color, highlight, and glow. |
| **Presets** | 8 built-in presets, unlimited custom presets, plus a community marketplace you can browse and apply without leaving Spotify. |

Works in the full-page lyrics view, the sidebar lyrics view, Cinema mode, and Picture-in-Picture.

### Requirements

- Spotify Desktop
- Spicetify `>= 2.0.0`
- The [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) extension, installed and working
- An internet connection for the Marketplace, Theme Creator, and update checks (everything else works offline)

---

## Install

### Option 1 — Spicetify Marketplace (recommended)

1. Open Spotify and go to **Marketplace → Extensions**.
2. Search for **Spicy Themes** and install it.
3. Restart Spotify.

You'll get updates automatically — the extension ships as a thin loader that fetches and verifies the latest build on startup.

### Option 2 — Manual

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

### Option 3 — Windows installer script

`installer/install-spicetify-ST.cmd` installs Spicetify if it's missing, copies `dist/spicy-themes.js` into your Extensions folder, and runs `spicetify apply`. Build first with `npm run build`, then run the script. If the extension doesn't appear afterwards, register it once with `spicetify config extensions spicy-themes.js`.

---

## First run

1. Play a track and open the lyrics view.
2. Click the **palette icon** in the lyrics controls to toggle Spicy Themes on and off.
3. **Right-click the palette icon** to open the settings modal — or use **ST Settings** in the Spicetify profile menu.
4. Pick a preset, or jump into **Customize** and start tweaking. Every change previews live.

A condensed version of the same settings also appears under **Spotify Settings → Spicy Themes**, next to the Spicy Lyrics section.

---

## The settings modal

Four tabs:

- **Customize** — every setting, grouped into Text, Glow, Focus, Motion, Background, Player, and Translation. There's a search box at the top that matches labels, hints, and synonyms across all groups at once (searching "neon" finds the glow controls). Sub-settings only show up when their parent is enabled, so the panel never floods you.
- **Presets** — apply a built-in or custom preset, save your current look as a new one, delete custom presets, and export or import configurations.
- **Marketplace** — browse community themes with live previews, search by name or author, sort by Newest / Popular / Featured, and hit **Apply** to use one instantly. No file downloads involved.
- **About** — installed version, build hash, and links to the repo, Marketplace, and Theme Creator.

---

## Settings reference

### Line colors

| Setting | What it does |
|---|---|
| Active line | Color of the line currently being sung. Replaced by the gradient when gradient text is on. |
| Already sung | Color of lines that have passed. |
| Not yet sung | Color of upcoming lines. |
| Active / Sung / Unsung line opacity | Independent transparency for each of the three states. |

### Gradient

| Setting | What it does |
|---|---|
| Gradient text | Fills the active line with a two-color gradient instead of a flat color. |
| Sung colour | The part of the active line already sung. |
| Upcoming colour | The part still to come. |
| Sweep direction | Follow Spicy Lyrics, Horizontal, Vertical, or Diagonal. Horizontal and diagonal flip automatically for RTL lyrics. |

### Typography

| Setting | What it does |
|---|---|
| Font | 28 bundled options, or `Custom…` to type any CSS font stack. |
| Weight | Light 300 through Black 900. |
| Active line weight | Optionally make the line being sung heavier than the rest. |
| Capitalisation | As written, UPPERCASE, lowercase, or Title Case. |
| Text size | 0.25x – 2.0x. |
| Letter spacing | -0.1em – 0.3em. |
| Line spacing | 1.0 – 2.5. |

### Glow

| Setting | What it does |
|---|---|
| Line glow | Soft halo around every lyric line. |
| Active line colour / strength | Glow for the current line, up to 15px. |
| Other lines colour / strength | Glow for everything else. |
| Pulse the active line | The active line's glow breathes in and out, at an adjustable speed. |
| Active word glow | Lights up only the word being sung right now — color and strength up to 30px. |
| Text shadow | Hard drop shadow with color, opacity, blur, and X/Y offset. Useful over bright backgrounds. |

### Focus

| Setting | What it does |
|---|---|
| Blur other lines | Softens everything except the active line, 0 – 8px. |
| Keep upcoming lines sharp | How many lines ahead stay readable through the blur. |
| Ramp blur with distance | Nearby lines blur gently, distant ones blur fully. |
| Fade words as they pass | Blurs and fades each word of the active line once it's been sung. |
| Limit visible lines | Hides everything outside a window around the active line — set how many sung and upcoming lines stay visible. |

### Motion

| Setting | What it does |
|---|---|
| Flat colour mode | Turns off the sweeping karaoke fill; every line uses one solid color. |
| Word animation | None, **Pop** (scale and duration), or **Wave** (height and speed). |
| Active line zoom | 0.95x – 1.12x. |
| Zoom in on arrival | Animates each line up to its zoom level as it becomes active, from an adjustable starting scale. |
| Overall animation speed | Scales every lyric transition. Higher is snappier. |

### Background

| Setting | What it does |
|---|---|
| Background tint | Color wash over the album-art background, with adjustable strength. |
| Synced music videos | Plays the track's music video behind the lyrics when one is available. |
| Also in compact player | Extends videos to the compact player. |
| Video dimming | Darkens the video so lyrics stay readable. |

### Now Playing bar

| Setting | What it does |
|---|---|
| Restyle the player | Master toggle for everything below. |
| Album art roundness | 0 – 50%. |
| Progress bar thickness | 0.5x – 5x. |
| Custom progress colour | Overrides the accent on the progress and volume bars. |
| Animate control buttons | Adds motion to the transport controls. |
| Hide shuffle / repeat / like | Strips buttons you don't use. |

### Equalizer

| Setting | What it does |
|---|---|
| Song title equalizer | Audio-reactive bars beside the song title in the Now Playing bar. |
| Style | Equalizer, Dot Wave, Signal, Orbit, Pulse Dot, or Spectrum Ring. |
| Position | Both sides, left only, or right only. |
| Colour / Size / Speed | Color, 0.4x – 2.5x scale, 0.3x – 3x speed. |

### Translation

Requires [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator).

| Setting | What it does |
|---|---|
| Style translated lines | Master toggle for SLT styling. |
| Font | Match the lyrics font or pick a different one — handy for scripts the main font doesn't cover. |
| Text size / Opacity | Scale and transparency for the translation line. |
| Highlight start / end | Gradient colors for the translation's karaoke fill. |
| Custom base colour | Override the translation's base text color. |
| Custom glow colour | Give the translation its own glow. |

### Miscellaneous

Check for updates, reset to default, export, and import live at the bottom of the in-page settings section and in the Presets tab of the modal.

---

## Built-in presets

Each preset showcases a different corner of the feature set, not just a palette.

| Preset | What it demonstrates |
|---|---|
| **Default** | Balanced baseline with clean contrast and comfortable spacing. A neutral starting point. |
| **Cinematic** | Synced music videos and dramatic depth — dark overlay, deep text shadow, scale-in, and a tight line window. |
| **Neon Arcade** | The song-title equalizer and punchy effects — Spectrum Ring on both sides, layered glow, Pop word animation, animated player controls. |
| **Focus** | Distraction-free reading — a couple of sharp lines, sung words softening behind you, scale-in on the current line. |
| **Player Pro** | The Now Playing bar suite — rounded art, chunky progress bar, animated controls, hidden shuffle/repeat, right-side Dot Wave EQ, dimmed videos. |
| **Bilingual** | Translation styling — a tinted, glowing translation line in its own larger Noto Sans, extra line height, and a gentle Wave on the original lyric. |
| **Aurora** | Ambient atmosphere — shifting green-to-violet gradient, wide background glow, Orbit equalizer, slow scale-in. |
| **Raw Performance** | Maximum FPS — every expensive effect off. Ideal for low-end devices. |

Save your own with **Save Current as Preset**. Custom presets sit alongside the built-ins and travel with your exported config.

---

## Theme Creator

Design themes in your browser with a live preview, then publish straight to the Marketplace or export a `.json` file.

**https://7xeh.dev/apps/spicythemes/create/**

---

## Theme Marketplace

Browse community themes, search by name or author, and sort by newest, most popular, or featured.

**https://7xeh.dev/apps/spicythemes/marketplace/**

The same catalog is built into the extension — open the settings modal's **Marketplace** tab and hit **Apply** on any theme to use it immediately.

---

## Sharing themes

- **Export** writes your full configuration — active theme, custom presets, and active preset name — to `spicy-themes-config.json`.
- **Import** loads one back. Unknown or missing keys are merged against the defaults, so configs from older versions keep working.
- Marketplace downloads use the same format, so anything you download can be imported by hand and anything you export can be published.

---

## Translator support

Spicy Themes has first-class support for [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator). Translation lines get their own font, size, opacity, base color, karaoke highlight, and glow, so a second language can sit visually below the original instead of fighting it. No extra setup — install SLT, then turn on **Style translated lines**. The **Bilingual** preset is a ready-made starting point.

---

## Performance

If Spotify feels laggy or the lyric animations stutter, apply the **Raw Performance** preset — it turns every expensive effect off in one click.

To tune by hand, the costliest settings, roughly in order:

1. Synced music videos
2. Blur (especially with *Ramp blur with distance*)
3. Glow, active word glow, and glow pulse
4. Gradient text
5. The equalizer
6. Large active-line zoom and Wave word animation

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No palette icon in the lyrics view | Make sure Spicy Lyrics is installed and you're on a lyrics view. Restart Spotify. |
| Theme isn't applying | Toggle Spicy Themes off and back on with the palette icon. |
| Spicy Themes section missing from settings | Restart Spotify, then run `spicetify apply`. |
| Lyrics look wrong after importing | Reset to default, then import again. |
| Spotify feels laggy | Apply the **Raw Performance** preset. |
| Marketplace tab won't load | Check your connection — the Marketplace needs network access. Themes you've already applied keep working offline. |
| Manual install not loading | Confirm `spicy-themes.js` is in your Extensions folder, registered via `spicetify config extensions spicy-themes.js`, then run `spicetify apply`. |
| Translated lines don't match your theme | Turn on **Style translated lines** in the Translation section. |
| Stuck on an old version | Open the modal's **About** tab to see your version and build hash, then use **Check for Updates**. |

Still stuck? [Ask in the Discord](https://discord.gg/fXK34DeDW5) — include your Spicetify version, Spotify version, and the build hash from the About tab.

---

## Building from source

```bash
npm install
```

```bash
npm run build
```

| Script | Does |
|---|---|
| `npm run build` | Type-checks with `tsc --noEmit`, bundles `src/app.ts` to `dist/spicy-themes.js` with esbuild, then stamps the build's own SHA-256 into it. |
| `npm run build:watch` | Incremental rebuilds with inline sourcemaps and no type check. |
| `npm run deploy` | Build, copy to `%APPDATA%\spicetify\Extensions`, and apply. Windows only. |
| `npm run release` | Build and copy to `builds/`. |

The build syncs `manifest.json`'s version from `package.json`, so bump the version in one place only.

### Layout

```
src/
  app.ts              entry point
  utils/
    themeEngine.ts    generates and injects the CSS for every setting
    state.ts          theme config, defaults, built-in presets, persistence
    settingsModal.ts  the tabbed modal, and SCHEMA — the source of truth for settings
    settings.ts       the Spotify settings-page section
    marketplace.ts    marketplace API client
    musicVideo.ts     synced video backgrounds
    eqAudio.ts        audio analysis for the equalizer
    updater.ts        version checks and self-update
    connectivity.ts   offline detection and degradation
    core.ts           palette button and lyrics-view wiring
loader/ST-loader.js   published entry point: fetches, verifies, and caches the build
installer/            Windows install script
```

Adding a setting means adding a field to `SCHEMA` in `settingsModal.ts`, a default in `state.ts`, and the CSS it drives in `themeEngine.ts`. Both settings surfaces render from `SCHEMA`, so neither needs separate wiring.

### How updates work

`ST-loader.js` is what Spicetify actually loads. On startup it asks `7xeh.dev` for the current version (falling back to the GitHub releases API), downloads the matching build, verifies its SHA-256, and caches it. It re-checks periodically so hotfixes land without a reinstall. The version and build hash you're running are shown in the modal's **About** tab.

---

## Support and links

- **Discord** — support, bug reports, theme sharing, release news: https://discord.gg/fXK34DeDW5
- **Theme Creator** — https://7xeh.dev/apps/spicythemes/create/
- **Marketplace** — https://7xeh.dev/apps/spicythemes/marketplace/
- **Issues** — https://github.com/7xeh/SpicyThemes/issues
- **Spicy Lyrics** — https://github.com/Spikerko/spicy-lyrics
- **Spicy Lyric Translator** — https://github.com/7xeh/SpicyLyricTranslator

---

MIT licensed. Made with <3 for the Spicetify community by [7xeh](https://github.com/7xeh).
