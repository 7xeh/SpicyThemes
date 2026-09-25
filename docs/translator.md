# Translator support

[← Docs index](README.md)

Spicy Themes has first-class support for [Spicy Lyric Translator](https://github.com/7xeh/SpicyLyricTranslator) (SLT).

Translation lines get their own font, size, opacity, base color, karaoke highlight, and glow, so a second language can sit visually below the original instead of fighting it.

## Setup

1. Install SLT and confirm translated lines are showing.
2. Open the Spicy Themes modal and turn on **Style translated lines** in the Translation group.
3. Adjust font, size, and opacity until the translation reads as secondary to the original.

The **Bilingual** preset is a ready-made starting point.

Picking a different font for translations is worth it when the second language uses a script your main lyrics font doesn't cover — Noto Sans is a safe broad choice.

## Learning Mode (SLT 2.1.9+)

When Learning Mode is on in SLT, a word-by-word breakdown appears under the playing line. With **Style translated lines** on, Spicy Themes recolors the breakdown to match your theme:

- The full-line translation header and the original words use your translation highlight color.
- Meanings, dictionary forms and parts of speech use the translation base color (or the sung-line color if no base color is set).
- Word cards pick up a faint tint and border in the highlight color, and the translation font carries over.

The Spicy Themes palette button sits after SLT's Learning Mode button in the lyrics controls.

---

See also: [Translation settings](settings.md#translation) · [Presets](presets.md)
