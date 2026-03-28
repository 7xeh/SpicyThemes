# SpicyThemes

Customize [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) with colors, glow effects, gradients, blur, fonts, opacity and more.

![Preview](preview.png)

## Features

- **Color Customization** — Change active, sung, unsung and background lyric line colors
- **Opacity Control** — Fine-tune the visibility of active, sung and unsung lines independently
- **Glow Effects** — Customizable glow with separate colors and intensity for active vs normal lines, plus background text glow
- **Gradient Text** — Gradient rendering on lyrics with configurable start/end colors and angle
- **Font Options** — Font family, weight, size, letter spacing and line height
- **Blur Effects** — Blur unsung lines with adjustable intensity for a cinematic focus effect
- **Word Effects** — Word Pop (scale burst on highlight), Word Wave (vertical wave animation), and Word Highlight with custom color
- **Scale & Speed** — Scale active lines and control animation speed
- **Background Overlay** — Tinted color overlay behind lyrics with adjustable opacity
- **Theme Presets** — 6 built-in presets or save your own custom themes
- **Theme Creator** — Design themes on the web with a [live preview editor](https://7xeh.dev/apps/SpicyThemes/create/) and publish directly to the Marketplace
- **Theme Marketplace** — Browse, download and share community-made themes at the [Marketplace](https://7xeh.dev/apps/SpicyThemes/marketplace/)
- **SLT Compatibility** — Style translation text from [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator) independently
- **Multi-Context** — Works in full page, sidebar, Cinema mode and Picture-in-Picture
- **Toggle Button** — Palette icon in the lyrics view to quickly enable/disable theming
- **Auto Updates** — Automatically updates to the latest version
- **Export / Import** — Export your full theme configuration as JSON or import one from the community

## Installation

### Spicetify Marketplace (Recommended)

1. Open Spotify and go to the Marketplace
2. Search for **Spicy Themes**
3. Click **Install**

### Manual Install

1. Make sure [Spicetify](https://spicetify.app/) and [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics) are installed
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
```

## Usage

1. Open Spotify and navigate to the lyrics page (Spicy Lyrics)
2. Click the **palette icon** in the lyrics view controls to toggle theming
3. Go to **Settings** in Spotify to find the **Spicy Themes** section
4. Pick a preset or customize colors, effects, fonts and more
5. Right-click the palette icon to open the settings modal directly

## Theme Creator & Marketplace

Design, publish and discover community themes:

### Creating a Theme

1. Open the **[Theme Creator](https://7xeh.dev/apps/SpicyThemes/create/)** on the web
2. Design your theme with a live preview — adjust every color, effect, and font
3. Click **Publish** to upload it to the Marketplace, or **Export** to save as a `.json` file

### Marketplace

1. Browse the **[Theme Marketplace](https://7xeh.dev/apps/SpicyThemes/marketplace/)** to discover themes shared by the community
2. Search by name or author, sort by newest or most popular
3. Click **Get** to download any theme as a `.json` file
4. Open Spicy Themes settings in Spotify and click **Import** to apply it

## Configuration

All settings are available in Spotify Settings > Spicy Themes:

| Category | Settings |
|----------|----------|
| Colors | Active line, sung line, unsung line |
| Opacity | Active line, sung line, unsung line |
| Glow | Enable/disable, glow color and intensity, active glow color and intensity, background text glow |
| Gradient | Enable/disable, start color, end color, angle |
| Typography | Font family, font weight, letter spacing, line height |
| Effects | Word highlight, word pop (scale + duration), word wave (intensity + speed), blur unsung, blur amount, scale active, animation speed |
| Background | Page overlay toggle, overlay color, overlay opacity |
| SLT Styling | Translation opacity, translation font size scale |
| Misc | Dev channel, export/import, check for updates, reset |

## Presets

Built-in presets:

| Preset | Description |
|--------|-------------|
| Default | Balanced baseline with clean contrast and comfortable spacing |
| SpotiGlow | Spotify green with vibrant neon glow and gradient |
| Sunset | Warm orange/yellow gradient tones with glow and wave effect |
| Deep Ocean | Cool blue tones with crisp active focus and strong glow |
| Synthwave | Retro neon magenta/cyan with wave motion |
| Raw Performance | Zero expensive CSS effects — maximum FPS for low-end devices |

You can also save and manage your own custom presets.

## Compatibility

- Requires [Spicy Lyrics](https://github.com/Spikerko/spicy-lyrics)
- Works alongside [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator) with dedicated translation styling
- Supports all Spicy Lyrics view modes: full page, sidebar, Cinema and PiP

## License

MIT
