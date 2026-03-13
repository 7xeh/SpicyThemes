# SpicyThemes

A Spicetify extension that lets you fully customize the look and feel of [Spicy Lyrics](https://github.com/Spicy-Lyrics/Spicy-Lyrics) — colors, glow effects, blur, fonts, opacity, and more.

## Features

- **Color Customization** — Change active, sung, and unsung lyric line colors
- **Glow Effects** — Add customizable glow/text-shadow to lyrics with per-state control
- **Opacity Control** — Fine-tune visibility of active, sung, and unsung lines
- **Font Options** — Change font family, weight, size, and letter spacing
- **Blur Effects** — Blur unsung lines for a cinematic focus effect
- **Scale Active Lines** — Enlarge the currently playing line
- **Animation Speed** — Speed up or slow down lyric transitions
- **Background Overlay** — Add a tinted overlay behind lyrics
- **Theme Presets** — Choose from built-in presets: Neon Glow, Sunset, Ocean, Minimal, Purple Haze, Spotify Green, High Contrast
- **Custom Presets** — Save, export, and import your own themes
- **SLT Compatibility** — Style translation text from [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslate) independently
- **Multi-Context** — Works in full page, sidebar, Cinema mode, and Picture-in-Picture

## Installation

### Quick Install

1. Make sure [Spicetify](https://spicetify.app/) and [Spicy Lyrics](https://github.com/Spicy-Lyrics/Spicy-Lyrics) are installed
2. Download the latest `spicy-themes.js` from [Releases](https://github.com/7xeh/SpicyThemes/releases)
3. Copy it to your Spicetify extensions folder:
   ```
   %APPDATA%\spicetify\Extensions\
   ```
4. Run `spicetify apply`
5. Restart Spotify

### From Source

```bash
git clone https://github.com/7xeh/SpicyThemes.git
cd SpicyThemes
npm install
npm run build
npm run deploy
spicetify apply
```

## Usage

1. Open Spotify and navigate to the lyrics page (Spicy Lyrics)
2. Click the **palette icon** in the lyrics view controls to toggle theming
3. Go to **Settings** in Spotify to find the **Spicy Themes** section
4. Customize colors, effects, fonts, and more
5. Use presets for quick theme changes or save your own

## Configuration

All settings are available in Spotify Settings → Spicy Themes:

| Setting | Description |
|---------|-------------|
| Active Line Color | Color of the currently playing lyric line |
| Sung/Unsung Colors | Colors for already-sung and upcoming lines |
| Glow Effect | Toggle and customize text glow intensity & color |
| Font | Family, weight, size, letter spacing |
| Blur Unsung | Apply blur to lines not yet sung |
| Scale Active | Make the active line larger |
| Animation Speed | Control transition speed |
| Background Overlay | Add a colored overlay behind lyrics |
| SLT Translation Styling | Independent color/opacity/size for translation text |

## Presets

Built-in presets:

- **Default** — Standard Spicy Lyrics look
- **Neon Glow** — Vibrant green glow
- **Sunset** — Warm orange/yellow gradient tones
- **Ocean** — Cool blue tones
- **Minimal** — Clean and subtle
- **Purple Haze** — Deep purple vibes
- **Spotify Green** — Spotify-branded accent
- **High Contrast** — Maximum readability

You can also create, export, and import custom presets.

## Compatibility

- Works alongside **Spicy Lyrics** (required)
- Works alongside **Spicy Lyric Translator (SLT)** with dedicated translation styling
- Supports all Spicy Lyrics view modes: full page, sidebar, Cinema, PiP

## License

MIT