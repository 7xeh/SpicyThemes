# Settings reference

[← Docs index](README.md)

Every setting below lives in the **Customize** tab of the settings modal, grouped the same way. Sub-settings appear only once their parent toggle is on.

## Line colors

| Setting | What it does |
|---|---|
| Active line | Color of the line currently being sung. Replaced by the gradient when gradient text is on. |
| Already sung | Color of lines that have passed. |
| Not yet sung | Color of upcoming lines. |
| Active / Sung / Unsung line opacity | Independent transparency for each of the three states. |

## Gradient

| Setting | What it does |
|---|---|
| Gradient text | Fills the active line with a two-color gradient instead of a flat color. |
| Sung colour | The part of the active line already sung. |
| Upcoming colour | The part still to come. |
| Sweep direction | Follow Spicy Lyrics, Horizontal, Vertical, or Diagonal. Horizontal and diagonal flip automatically for RTL lyrics. |

## Typography

| Setting | What it does |
|---|---|
| Font | 28 bundled options, or `Custom…` to type any CSS font stack. |
| Weight | Light 300 through Black 900. |
| Active line weight | Optionally make the line being sung heavier than the rest. |
| Capitalisation | As written, UPPERCASE, lowercase, or Title Case. |
| Text size | 0.25x – 2.0x. |
| Letter spacing | -0.1em – 0.3em. |
| Line spacing | 1.0 – 2.5. |

## Glow

| Setting | What it does |
|---|---|
| Line glow | Soft halo around every lyric line. |
| Active line colour / strength | Glow for the current line, up to 15px. |
| Other lines colour / strength | Glow for everything else. |
| Pulse the active line | The active line's glow breathes in and out, at an adjustable speed. |
| Active word glow | Lights up only the word being sung right now — color and strength up to 30px. |
| Text shadow | Hard drop shadow with color, opacity, blur, and X/Y offset. Useful over bright backgrounds. |

## Focus

| Setting | What it does |
|---|---|
| Blur other lines | Softens everything except the active line, 0 – 8px. |
| Keep upcoming lines sharp | How many lines ahead stay readable through the blur. |
| Ramp blur with distance | Nearby lines blur gently, distant ones blur fully. |
| Fade words as they pass | Blurs and fades each word of the active line once it's been sung. |
| Limit visible lines | Hides everything outside a window around the active line — set how many sung and upcoming lines stay visible. |

## Motion

| Setting | What it does |
|---|---|
| Flat colour mode | Turns off the sweeping karaoke fill; every line uses one solid color. |
| Word animation | None, **Pop** (scale and duration), or **Wave** (height and speed). |
| Active line zoom | 0.95x – 1.12x. |
| Zoom in on arrival | Animates each line up to its zoom level as it becomes active, from an adjustable starting scale. |
| Overall animation speed | Scales every lyric transition. Higher is snappier. |

## Background

| Setting | What it does |
|---|---|
| Background tint | Color wash over the album-art background, with adjustable strength. |
| Synced music videos | Plays the track's music video behind the lyrics when one is available. |
| Also in compact player | Extends videos to the compact player. |
| Video dimming | Darkens the video so lyrics stay readable. |

## Now Playing bar

| Setting | What it does |
|---|---|
| Restyle the player | Master toggle for everything below. |
| Album art roundness | 0 – 50%. |
| Progress bar thickness | 0.5x – 5x. |
| Custom progress colour | Overrides the accent on the progress and volume bars. |
| Animate control buttons | Adds motion to the transport controls. |
| Hide shuffle / repeat / like | Strips buttons you don't use. |

## Equalizer

| Setting | What it does |
|---|---|
| Song title equalizer | Audio-reactive bars beside the song title in the Now Playing bar. |
| Style | Equalizer, Dot Wave, Signal, Orbit, Pulse Dot, or Spectrum Ring. |
| Position | Both sides, left only, or right only. |
| Colour / Size / Speed | Color, 0.4x – 2.5x scale, 0.3x – 3x speed. |

## Translation

Requires [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator) — see [Translator support](translator.md).

| Setting | What it does |
|---|---|
| Style translated lines | Master toggle for SLT styling. |
| Font | Match the lyrics font or pick a different one — handy for scripts the main font doesn't cover. |
| Text size / Opacity | Scale and transparency for the translation line. |
| Highlight start / end | Gradient colors for the translation's karaoke fill. |
| Custom base colour | Override the translation's base text color. |
| Custom glow colour | Give the translation its own glow. |

## Miscellaneous

Check for updates, reset to default, export, and import live at the bottom of the in-page settings section and in the Presets tab of the modal.

---

See also: [Presets](presets.md) · [Performance](performance.md)
