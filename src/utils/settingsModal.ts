import { storage } from './storage';
import {
    themeState,
    saveThemeState,
    applyPreset,
    getAllPresets,
    saveCustomPreset,
    deleteCustomPreset,
    updateThemeProperty,
    mergeThemeConfig,
    DEFAULT_THEME,
    BUILTIN_PRESETS,
    WORD_EFFECTS,
    resolveWordTrigger,
    ThemeConfig,
    ThemePreset,
} from './state';
import { injectThemeStyles } from './themeEngine';
import { checkForUpdates, getCurrentVersion, getDisplayHash, getUpdateInfo } from './updater';
import * as Marketplace from './marketplace';

export type FieldType = 'toggle' | 'color' | 'slider' | 'dropdown' | 'text';

export interface FieldDef<K extends keyof ThemeConfig = keyof ThemeConfig> {
    id: K;
    label: string;
    type: FieldType;
    section: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    placeholder?: string;
    options?: { value: string; text: string }[];
    when?: (t: ThemeConfig) => boolean;
    comingSoon?: boolean;
    parent?: keyof ThemeConfig;
    hint?: string;
    keywords?: string;
}

export const FONT_OPTIONS = [
    { value: '', text: 'Default (Spotify)' },
    { value: "'Inter', Arial, sans-serif", text: 'Inter' },
    { value: "'Roboto', Arial, sans-serif", text: 'Roboto' },
    { value: "'Noto Sans', Arial, sans-serif", text: 'Noto Sans' },
    { value: "'Open Sans', Arial, sans-serif", text: 'Open Sans' },
    { value: "'Montserrat', Arial, sans-serif", text: 'Montserrat' },
    { value: "'Poppins', Arial, sans-serif", text: 'Poppins' },
    { value: "'Lato', Arial, sans-serif", text: 'Lato' },
    { value: "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif", text: 'Source Sans' },
    { value: "'Nunito Sans', Arial, sans-serif", text: 'Nunito Sans' },
    { value: "'Raleway', Arial, sans-serif", text: 'Raleway' },
    { value: "'Oswald', 'Arial Narrow', Arial, sans-serif", text: 'Oswald' },
    { value: "'Ubuntu', Arial, sans-serif", text: 'Ubuntu' },
    { value: "'Fira Sans', Arial, sans-serif", text: 'Fira Sans' },
    { value: "'IBM Plex Sans', Arial, sans-serif", text: 'IBM Plex Sans' },
    { value: "'Merriweather', Georgia, serif", text: 'Merriweather' },
    { value: "'JetBrains Mono', Consolas, monospace", text: 'JetBrains Mono' },
    { value: "'Fira Code', Consolas, monospace", text: 'Fira Code' },
    { value: "'Cascadia Code', Consolas, monospace", text: 'Cascadia Code' },
    { value: 'Arial', text: 'Arial' },
    { value: 'Helvetica Neue', text: 'Helvetica Neue' },
    { value: 'Georgia', text: 'Georgia' },
    { value: 'Verdana', text: 'Verdana' },
    { value: 'Segoe UI', text: 'Segoe UI' },
    { value: 'Trebuchet MS', text: 'Trebuchet MS' },
    { value: 'Courier New', text: 'Courier New' },
    { value: 'Consolas', text: 'Consolas' },
    { value: 'Impact', text: 'Impact' },
];

export const TRANSLATION_FONT_OPTIONS = [
    { value: '', text: 'Match lyrics font' },
    ...FONT_OPTIONS.filter(o => o.value !== ''),
];

export const WEIGHT_OPTIONS = [
    { value: '300', text: 'Light (300)' },
    { value: '400', text: 'Regular (400)' },
    { value: '500', text: 'Medium (500)' },
    { value: '600', text: 'Semi-Bold (600)' },
    { value: '700', text: 'Bold (700)' },
    { value: '800', text: 'Extra-Bold (800)' },
    { value: '900', text: 'Black (900)' },
];

const WORD_EFFECT_OPTIONS = [
    { value: 'none', text: 'None' },
    ...WORD_EFFECTS.map(e => ({ value: e.id, text: `${e.group} — ${e.label}` })),
];

export const SCHEMA: FieldDef[] = [
    { id: 'activeLineColor', label: 'Active line', type: 'color', section: 'Line colors', when: (t) => !t.gradientEnabled, hint: 'The line currently being sung. Replaced by the gradient when gradient text is on.', keywords: 'current karaoke highlight' },
    { id: 'sungLineColor', label: 'Already sung', type: 'color', section: 'Line colors', keywords: 'past previous' },
    { id: 'notSungLineColor', label: 'Not yet sung', type: 'color', section: 'Line colors', keywords: 'upcoming future next' },
    { id: 'activeLineOpacity', label: 'Active line opacity', type: 'slider', section: 'Line colors', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },
    { id: 'sungLineOpacity', label: 'Sung line opacity', type: 'slider', section: 'Line colors', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },
    { id: 'notSungLineOpacity', label: 'Unsung line opacity', type: 'slider', section: 'Line colors', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },

    { id: 'gradientEnabled', label: 'Gradient text', type: 'toggle', section: 'Gradient', hint: 'Fills the active line with a two-colour gradient instead of a flat colour.', keywords: 'rainbow fade blend' },
    { id: 'gradientStartColor', label: 'Sung colour', type: 'color', section: 'Gradient', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The part of the active line already sung.' },
    { id: 'gradientEndColor', label: 'Upcoming colour', type: 'color', section: 'Gradient', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The part of the active line still to come.' },
    { id: 'gradientDirection', label: 'Sweep direction', type: 'dropdown', section: 'Gradient', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, options: [
        { value: 'auto', text: 'Follow Spicy Lyrics' },
        { value: 'horizontal', text: 'Horizontal' },
        { value: 'vertical', text: 'Vertical' },
        { value: 'diagonal', text: 'Diagonal' },
        { value: 'custom', text: 'Custom angle' },
    ], hint: 'Which way the karaoke fill travels. Horizontal, diagonal and custom flip automatically for right-to-left lyrics.', keywords: 'angle direction karaoke sweep fill' },
    { id: 'gradientAngle', label: 'Sweep angle', type: 'slider', section: 'Gradient', min: 0, max: 360, step: 5, unit: '°', parent: 'gradientEnabled', when: (t) => t.gradientEnabled && t.gradientDirection === 'custom', hint: '0° sweeps upward, 90° to the right, 180° downward.', keywords: 'degrees rotation direction' },
    { id: 'gradientFeather', label: 'Fill softness', type: 'slider', section: 'Gradient', min: 0, max: 60, step: 1, unit: '%', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The length of the blend between the sung and upcoming colours. 0% is a hard wipe, higher values trail a long fade behind the karaoke position.', keywords: 'blend fade edge transition sharpness feather' },

    { id: 'fontFamily', label: 'Font', type: 'dropdown', section: 'Typography', options: [...FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], keywords: 'typeface family' },
    { id: 'fontFamily', label: 'Custom font name', type: 'text', section: 'Typography', placeholder: "e.g. 'Inter', sans-serif", when: (t) => t.fontFamily !== '' && !FONT_OPTIONS.some(o => o.value === t.fontFamily) },
    { id: 'fontWeight', label: 'Weight', type: 'dropdown', section: 'Typography', options: WEIGHT_OPTIONS, keywords: 'bold thin' },
    { id: 'activeLineWeight', label: 'Active line weight', type: 'dropdown', section: 'Typography', options: [{ value: '0', text: 'Same as above' }, ...WEIGHT_OPTIONS], hint: 'Make the line being sung heavier than the rest.', keywords: 'bold emphasis active' },
    { id: 'textTransform', label: 'Capitalisation', type: 'dropdown', section: 'Typography', options: [
        { value: 'none', text: 'As written' },
        { value: 'uppercase', text: 'UPPERCASE' },
        { value: 'lowercase', text: 'lowercase' },
        { value: 'capitalize', text: 'Title Case' },
    ], keywords: 'uppercase lowercase caps case' },
    { id: 'fontStyle', label: 'Style', type: 'dropdown', section: 'Typography', options: [
        { value: 'normal', text: 'Upright' },
        { value: 'italic', text: 'Italic' },
        { value: 'oblique', text: 'Oblique (slanted)' },
    ], hint: 'Italic uses the font’s own italic cut if it ships one; oblique slants the upright cut mathematically.', keywords: 'italic slant oblique cursive' },
    { id: 'lyricsScale', label: 'Text size', type: 'slider', section: 'Typography', min: 0.25, max: 2.0, step: 0.05, unit: 'x', keywords: 'scale bigger smaller font size' },
    { id: 'letterSpacing', label: 'Letter spacing', type: 'slider', section: 'Typography', min: -0.1, max: 0.3, step: 0.01, unit: 'em', keywords: 'tracking kerning' },
    { id: 'wordSpacing', label: 'Word spacing', type: 'slider', section: 'Typography', min: -0.1, max: 1.0, step: 0.02, unit: 'em', hint: 'Widens the gaps between words without touching the letters inside them.', keywords: 'gap space between words' },
    { id: 'lineHeight', label: 'Line spacing', type: 'slider', section: 'Typography', min: 1.0, max: 2.5, step: 0.01, keywords: 'leading gap' },
    { id: 'textAlign', label: 'Alignment', type: 'dropdown', section: 'Typography', options: [
        { value: 'default', text: 'Follow Spicy Lyrics' },
        { value: 'left', text: 'Left' },
        { value: 'center', text: 'Centre' },
        { value: 'right', text: 'Right' },
    ], hint: 'Overrides Spicy Lyrics’ own alignment, including its per-vocalist opposite alignment.', keywords: 'align left right centre centered justify' },
    { id: 'maxLineWidth', label: 'Max line width', type: 'slider', section: 'Typography', min: 0, max: 100, step: 5, unit: '%', hint: 'Caps how wide a line can get before it wraps. 0% leaves it uncapped — lower values keep lines readable on wide screens.', keywords: 'measure wrap width narrow column readability' },

    { id: 'glowEnabled', label: 'Line glow', type: 'toggle', section: 'Glow', hint: 'Adds a soft halo around every lyric line.', keywords: 'halo neon shine bloom' },
    { id: 'activeGlowColor', label: 'Active line colour', type: 'color', section: 'Glow', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'activeGlowIntensity', label: 'Active line strength', type: 'slider', section: 'Glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowColor', label: 'Other lines colour', type: 'color', section: 'Glow', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowIntensity', label: 'Other lines strength', type: 'slider', section: 'Glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowPulse', label: 'Pulse the active line', type: 'toggle', section: 'Glow', parent: 'glowEnabled', when: (t) => t.glowEnabled, hint: 'The active line’s glow breathes in and out instead of sitting still.', keywords: 'breathe pulse animate throb' },
    { id: 'glowPulseSpeed', label: 'Pulse speed', type: 'slider', section: 'Glow', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'glowPulse', when: (t) => t.glowEnabled && t.glowPulse },
    { id: 'bgGlowEnabled', label: 'Active word glow', type: 'toggle', section: 'Glow', hint: 'Lights up only the word being sung right now.', keywords: 'karaoke halo neon' },
    { id: 'bgGlowColor', label: 'Word glow colour', type: 'color', section: 'Glow', parent: 'bgGlowEnabled', when: (t) => t.bgGlowEnabled },
    { id: 'bgGlowIntensity', label: 'Word glow strength', type: 'slider', section: 'Glow', min: 0, max: 30, step: 1, unit: 'px', parent: 'bgGlowEnabled', when: (t) => t.bgGlowEnabled },
    { id: 'textShadowEnabled', label: 'Text shadow', type: 'toggle', section: 'Glow', hint: 'A hard drop shadow — useful for readability over bright backgrounds.', keywords: 'drop shadow outline readability' },
    { id: 'textShadowColor', label: 'Shadow colour', type: 'color', section: 'Glow', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOpacity', label: 'Shadow opacity', type: 'slider', section: 'Glow', min: 0, max: 1, step: 0.05, parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowBlur', label: 'Shadow blur', type: 'slider', section: 'Glow', min: 0, max: 20, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOffsetX', label: 'Shadow offset X', type: 'slider', section: 'Glow', min: -10, max: 10, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOffsetY', label: 'Shadow offset Y', type: 'slider', section: 'Glow', min: -10, max: 10, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textStrokeEnabled', label: 'Text outline', type: 'toggle', section: 'Glow', hint: 'Draws a hard outline around every glyph. Holds up over busy backgrounds and music video better than a shadow does, and sits outside the karaoke gradient so the fill still shows through.', keywords: 'stroke border outline edge contour readability' },
    { id: 'textStrokeColor', label: 'Outline colour', type: 'color', section: 'Glow', parent: 'textStrokeEnabled', when: (t) => t.textStrokeEnabled },
    { id: 'textStrokeWidth', label: 'Outline width', type: 'slider', section: 'Glow', min: 0, max: 3, step: 0.1, unit: 'px', parent: 'textStrokeEnabled', when: (t) => t.textStrokeEnabled, hint: 'Above roughly 1.5px the outline starts eating into thin letterforms.' },

    { id: 'blurUnsung', label: 'Blur other lines', type: 'toggle', section: 'Focus', hint: 'Softens every line except the one being sung, so the eye lands on the right place.', keywords: 'depth of field defocus soft' },
    { id: 'blurAmount', label: 'Blur amount', type: 'slider', section: 'Focus', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'blurUnsung', when: (t) => t.blurUnsung },
    { id: 'blurPreviewLines', label: 'Keep upcoming lines sharp', type: 'slider', section: 'Focus', min: 0, max: 5, step: 1, unit: ' lines', parent: 'blurUnsung', when: (t) => t.blurUnsung, hint: 'How many lines ahead stay readable through the blur.' },
    { id: 'blurProgressive', label: 'Ramp blur with distance', type: 'toggle', section: 'Focus', parent: 'blurUnsung', when: (t) => t.blurUnsung, hint: 'Lines near the active one blur gently and further ones blur fully, instead of everything blurring equally.', keywords: 'gradual depth falloff distance' },
    { id: 'blurSungWords', label: 'Fade words as they pass', type: 'toggle', section: 'Focus', hint: 'Blurs each word of the active line once it has been sung.', keywords: 'karaoke word blur trail' },
    { id: 'blurSungWordsAmount', label: 'Word blur amount', type: 'slider', section: 'Focus', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'blurSungWords', when: (t) => t.blurSungWords },
    { id: 'blurSungWordsOpacity', label: 'Word opacity', type: 'slider', section: 'Focus', min: 0.05, max: 1.0, step: 0.05, parent: 'blurSungWords', when: (t) => t.blurSungWords },
    { id: 'lineWindowEnabled', label: 'Limit visible lines', type: 'toggle', section: 'Focus', hint: 'Hides everything outside a window around the active line.', keywords: 'window hide crop few lines' },
    { id: 'lineWindowSungLines', label: 'Sung lines shown', type: 'slider', section: 'Focus', min: 0, max: 10, step: 1, unit: ' lines', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled },
    { id: 'lineWindowUnsungLines', label: 'Upcoming lines shown', type: 'slider', section: 'Focus', min: 0, max: 10, step: 1, unit: ' lines', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled },

    { id: 'disableHighlight', label: 'Flat colour mode', type: 'toggle', section: 'Motion', hint: 'Turns off the sweeping karaoke fill — every line uses one solid colour.', keywords: 'no karaoke disable highlight solid' },
    { id: 'highlightColor', label: 'Flat colour', type: 'color', section: 'Motion', parent: 'disableHighlight', when: (t) => t.disableHighlight },
    { id: 'wordEffect', label: 'Word animation', type: 'dropdown', section: 'Motion', options: WORD_EFFECT_OPTIONS, hint: 'Animates individual words in the active line. Grouped by feel — Classic is subtle, Energetic is punchy, Smooth is understated, Dimensional uses 3D.', keywords: 'bounce pop wave stamp shake glitch rise sway focus swell flip depth lean animate word' },
    { id: 'wordEffectTrigger', label: 'Fires', type: 'dropdown', section: 'Motion', options: [
        { value: 'auto', text: 'Recommended for this animation' },
        { value: 'word', text: 'As each word is sung' },
        { value: 'line', text: 'When the line starts' },
        { value: 'loop', text: 'Continuously' },
    ], parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'Per-word keeps the animation in time with the karaoke. Only the options an animation can actually do are accepted.', keywords: 'trigger timing sync karaoke per word' },
    { id: 'wordEffectIntensity', label: 'Intensity', type: 'slider', section: 'Motion', min: 0.1, max: 2.0, step: 0.05, unit: 'x', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'How far the animation travels. Scales with text size, so it stays proportional.', keywords: 'strength amount size distance' },
    { id: 'wordEffectSpeed', label: 'Speed', type: 'slider', section: 'Motion', min: 0.3, max: 3.0, step: 0.05, unit: 'x', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'Higher is faster. Applies to whichever animation is selected.', keywords: 'duration fast slow tempo' },
    { id: 'wordEffectStagger', label: 'Stagger between words', type: 'slider', section: 'Motion', min: 0, max: 150, step: 5, unit: 'ms', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none' && resolveWordTrigger(t.wordEffect, t.wordEffectTrigger) !== 'word', hint: 'Offsets each word so the animation ripples along the line instead of firing all at once.', keywords: 'delay ripple cascade offset sequence' },
    { id: 'scaleActive', label: 'Active line zoom', type: 'slider', section: 'Motion', min: 0.95, max: 1.12, step: 0.01, unit: 'x', keywords: 'scale grow size' },
    { id: 'scaleInEffect', label: 'Zoom in on arrival', type: 'toggle', section: 'Motion', hint: 'Animates each line up to its zoom level as it becomes active.', keywords: 'scale in entrance animate' },
    { id: 'scaleInFrom', label: 'Starting scale', type: 'slider', section: 'Motion', min: 0.85, max: 1.05, step: 0.01, unit: 'x', parent: 'scaleInEffect', when: (t) => t.scaleInEffect },
    { id: 'scaleInDuration', label: 'Zoom duration', type: 'slider', section: 'Motion', min: 0.1, max: 1.0, step: 0.05, unit: 's', parent: 'scaleInEffect', when: (t) => t.scaleInEffect },
    { id: 'animationSpeed', label: 'Overall animation speed', type: 'slider', section: 'Motion', min: 0.3, max: 3.0, step: 0.1, unit: 'x', hint: 'Scales every lyric transition. Higher is snappier.', keywords: 'transition tempo fast slow' },

    { id: 'pageBgOverlay', label: 'Background tint', type: 'toggle', section: 'Background', hint: 'Lays a coloured wash over the album-art background to calm it down.', keywords: 'overlay dim darken tint' },
    { id: 'pageBgColor', label: 'Tint colour', type: 'color', section: 'Background', parent: 'pageBgOverlay', when: (t) => t.pageBgOverlay },
    { id: 'pageBgOpacity', label: 'Tint strength', type: 'slider', section: 'Background', min: 0, max: 1, step: 0.05, parent: 'pageBgOverlay', when: (t) => t.pageBgOverlay },
    { id: 'musicVideoEnabled', label: 'Synced music videos', type: 'toggle', section: 'Background', hint: 'Plays the track’s music video behind the lyrics when one is available.', keywords: 'video clip mv youtube background' },
    { id: 'musicVideoCompact', label: 'Also in compact player', type: 'toggle', section: 'Background', parent: 'musicVideoEnabled', when: (t) => t.musicVideoEnabled },
    { id: 'musicVideoDim', label: 'Video dimming', type: 'slider', section: 'Background', min: 0, max: 1, step: 0.05, parent: 'musicVideoEnabled', when: (t) => t.musicVideoEnabled, hint: 'Darkens the video so lyrics stay readable.' },

    { id: 'playerStylingEnabled', label: 'Restyle the player', type: 'toggle', section: 'Now Playing bar', hint: 'Unlocks the controls below for the Spicy Lyrics player bar.', keywords: 'nowbar controls player' },
    { id: 'playerArtRadius', label: 'Album art roundness', type: 'slider', section: 'Now Playing bar', min: 0, max: 50, step: 1, unit: '%', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'corner radius rounded' },
    { id: 'playerProgressThickness', label: 'Progress bar thickness', type: 'slider', section: 'Now Playing bar', min: 0.5, max: 5, step: 0.5, unit: 'x', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'seek bar height' },
    { id: 'playerAccentEnabled', label: 'Custom progress colour', type: 'toggle', section: 'Now Playing bar', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, hint: 'Overrides the accent colour on the progress and volume bars.', keywords: 'accent seek volume colour' },
    { id: 'playerAccentColor', label: 'Progress colour', type: 'color', section: 'Now Playing bar', parent: 'playerAccentEnabled', when: (t) => t.playerStylingEnabled && t.playerAccentEnabled },
    { id: 'playerControlsAnimation', label: 'Animate control buttons', type: 'toggle', section: 'Now Playing bar', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'hover bounce buttons' },
    { id: 'playerHideShuffle', label: 'Hide shuffle', type: 'toggle', section: 'Now Playing bar', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideRepeat', label: 'Hide repeat', type: 'toggle', section: 'Now Playing bar', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideLike', label: 'Hide like (heart)', type: 'toggle', section: 'Now Playing bar', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },

    { id: 'eqEnabled', label: 'Song title equalizer', type: 'toggle', section: 'Equalizer', hint: 'Audio-reactive bars beside the song title in the Now Playing bar.', keywords: 'visualizer spectrum bars audio reactive' },
    { id: 'eqStyle', label: 'Style', type: 'dropdown', section: 'Equalizer', options: [
        { value: 'equalizer', text: '01 Equalizer' },
        { value: 'dotwave', text: '02 Dot Wave' },
        { value: 'signal', text: '03 Signal' },
        { value: 'orbit', text: '04 Orbit' },
        { value: 'pulsedot', text: '05 Pulse Dot' },
        { value: 'spectrumring', text: '06 Spectrum Ring' },
    ], parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqPosition', label: 'Position', type: 'dropdown', section: 'Equalizer', options: [
        { value: 'both', text: 'Both sides' },
        { value: 'left', text: 'Left only' },
        { value: 'right', text: 'Right only' },
    ], parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqColor', label: 'Colour', type: 'color', section: 'Equalizer', parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqSize', label: 'Size', type: 'slider', section: 'Equalizer', min: 0.4, max: 2.5, step: 0.05, unit: 'x', parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqSpeed', label: 'Speed', type: 'slider', section: 'Equalizer', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'eqEnabled', when: (t) => t.eqEnabled },

    { id: 'sltStylingEnabled', label: 'Style translated lines', type: 'toggle', section: 'Translation', hint: 'Requires the Spicy Lyrics Translator extension. Styles the translation lines it adds.', keywords: 'slt translator subtitle' },
    { id: 'sltTranslationFont', label: 'Font', type: 'dropdown', section: 'Translation', options: [...TRANSLATION_FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltTranslationFont', label: 'Custom font name', type: 'text', section: 'Translation', placeholder: "e.g. 'Inter', sans-serif", parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && t.sltTranslationFont !== '' && !TRANSLATION_FONT_OPTIONS.some(o => o.value === t.sltTranslationFont) },
    { id: 'sltTranslationFontSize', label: 'Text size', type: 'slider', section: 'Translation', min: 0.25, max: 2.0, step: 0.05, unit: 'x', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltTranslationOpacity', label: 'Opacity', type: 'slider', section: 'Translation', min: 0.1, max: 1.0, step: 0.05, parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltHighlightStartColor', label: 'Highlight start', type: 'color', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltHighlightEndColor', label: 'Highlight end', type: 'color', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltTranslationColorEnabled', label: 'Custom base colour', type: 'toggle', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltTranslationColor', label: 'Base colour', type: 'color', section: 'Translation', parent: 'sltTranslationColorEnabled', when: (t) => t.sltStylingEnabled && t.sltTranslationColorEnabled },
    { id: 'sltGlowColorEnabled', label: 'Custom glow colour', type: 'toggle', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled },
    { id: 'sltGlowColor', label: 'Glow colour', type: 'color', section: 'Translation', parent: 'sltGlowColorEnabled', when: (t) => t.sltStylingEnabled && t.sltGlowColorEnabled },
];

interface FieldHandle {
    row: HTMLElement;
    def: FieldDef;
    sync: () => void;
    refreshReset: () => void;
}

let baseline: { name: string; config: ThemeConfig } = { name: 'default', config: DEFAULT_THEME };

function resolveBaseline(): void {
    if (!storage.get('active-preset')) {
        baseline = { name: 'default', config: DEFAULT_THEME };
        return;
    }
    const match = getAllPresets().find(p => p.name === themeState.activePresetName);
    if (match) baseline = { name: match.name, config: match.config };
}

let liveContainer: HTMLElement | null = null;
let czFields: FieldHandle[] = [];
let czGroups: { el: HTMLElement; parent: keyof ThemeConfig }[] = [];
let syncChrome: (() => void)[] = [];

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function notify(message: string, isError = false): void {
    if (typeof Spicetify !== 'undefined' && Spicetify.showNotification) {
        Spicetify.showNotification(message, isError);
    }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    if (hex.startsWith('rgb')) {
        const m = hex.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    }
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
        r: parseInt(h.substring(0, 2), 16) || 0,
        g: parseInt(h.substring(2, 4), 16) || 0,
        b: parseInt(h.substring(4, 6), 16) || 0,
    };
}

function toColorInputValue(value: string): string {
    if (!value) return '#ffffff';
    const { r, g, b } = hexToRgb(value);
    const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function renderPreview(host: HTMLElement, theme: Partial<ThemeConfig>): void {
    const t = { ...DEFAULT_THEME, ...theme } as ThemeConfig;
    host.style.setProperty('--st-prv-scale', String(t.lyricsScale ?? 1));
    host.innerHTML = `
        <div class="st-prv-line st-prv-sung">Waiting for this moment</div>
        <div class="st-prv-line st-prv-active">Feel the rhythm in my heartbeat</div>
        <div class="st-prv-line st-prv-unsung">Dancing underneath the starlight</div>
    `;

    const fontFamily = (t.fontFamily && t.fontFamily !== 'Custom Font') ? t.fontFamily : 'inherit';
    const fontWeight = String(t.fontWeight || 700);
    const letterSpacing = `${t.letterSpacing}em`;
    const lineHeight = String(t.lineHeight);

    const lines = host.querySelectorAll<HTMLElement>('.st-prv-line');
    lines.forEach(line => {
        line.style.fontFamily = fontFamily;
        line.style.fontWeight = fontWeight;
        line.style.letterSpacing = letterSpacing;
        line.style.lineHeight = lineHeight;
        line.style.fontStyle = t.fontStyle === 'normal' ? '' : t.fontStyle;
        line.style.wordSpacing = t.wordSpacing ? `${t.wordSpacing}em` : '';
        line.style.textAlign = t.textAlign === 'default' ? '' : t.textAlign;
        line.style.maxWidth = t.maxLineWidth > 0 ? `${t.maxLineWidth}%` : '';
        line.style.marginInline = t.maxLineWidth > 0
            ? (t.textAlign === 'center' ? 'auto' : t.textAlign === 'right' ? 'auto 0' : '0 auto')
            : '';
        (line.style as any).webkitTextStroke = t.textStrokeEnabled && t.textStrokeWidth > 0
            ? `${t.textStrokeWidth}px ${t.textStrokeColor}`
            : '';
        (line.style as any).paintOrder = t.textStrokeEnabled ? 'stroke fill' : '';
        line.style.background = '';
        line.style.backgroundClip = '';
        line.style.webkitBackgroundClip = '';
        (line.style as any).webkitTextFillColor = '';
        line.style.color = '';
        line.style.opacity = '';
        line.style.filter = '';
        line.style.transform = '';
        line.style.textShadow = '';
    });

    const active = host.querySelector<HTMLElement>('.st-prv-active');
    const sung = host.querySelector<HTMLElement>('.st-prv-sung');
    const unsung = host.querySelector<HTMLElement>('.st-prv-unsung');

    if (active) {
        active.style.opacity = String(t.activeLineOpacity);
        active.style.transform = `scale(${t.scaleActive})`;
        if (t.gradientEnabled) {
            const DIRECTION_ANGLES: Record<string, number> = { horizontal: 90, vertical: 180, diagonal: 135 };
            const angle = DIRECTION_ANGLES[t.gradientDirection] ?? t.gradientAngle;
            const feather = Math.min(Math.max(t.gradientFeather, 0), 60);
            active.style.background = `linear-gradient(${angle}deg, ${t.gradientStartColor} ${Math.max(0, 50 - feather / 2)}%, ${t.gradientEndColor} ${Math.min(100, 50 + feather / 2)}%)`;
            active.style.backgroundClip = 'text';
            active.style.webkitBackgroundClip = 'text';
            (active.style as any).webkitTextFillColor = 'transparent';
        } else {
            active.style.color = t.activeLineColor;
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.activeGlowColor);
            active.style.textShadow = `0 0 ${t.activeGlowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.85)`;
        }
        if (t.bgGlowEnabled) {
            const c = hexToRgb(t.bgGlowColor);
            const existing = active.style.textShadow;
            const bg = `0 0 ${t.bgGlowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 1)`;
            active.style.textShadow = existing ? `${existing}, ${bg}` : bg;
        }
    }
    if (sung) {
        sung.style.opacity = String(t.sungLineOpacity);
        sung.style.color = t.sungLineColor;
        if (t.glowEnabled) {
            const c = hexToRgb(t.glowColor);
            sung.style.textShadow = `0 0 ${t.glowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`;
        }
    }
    if (unsung) {
        unsung.style.opacity = String(t.notSungLineOpacity);
        unsung.style.color = t.notSungLineColor;
        if (t.blurUnsung && t.blurPreviewLines === 0) {
            unsung.style.filter = `blur(${t.blurAmount}px)`;
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.glowColor);
            const existing = unsung.style.textShadow;
            const sh = `0 0 ${t.glowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.45)`;
            unsung.style.textShadow = existing ? `${existing}, ${sh}` : sh;
        }
    }

    if (t.pageBgOverlay) {
        const c = hexToRgb(t.pageBgColor);
        host.style.background = `linear-gradient(145deg, rgba(${c.r}, ${c.g}, ${c.b}, ${t.pageBgOpacity}), rgba(8, 8, 10, 0.95))`;
    } else {
        host.style.background = '';
    }
}

function liveUpdate<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]): void {
    updateThemeProperty(key, value);
    injectThemeStyles();
    applyCustomizeFilter();
    refreshResetIndicators();
    syncChrome.forEach(fn => fn());
}

function matchesQuery(def: FieldDef, q: string): boolean {
    if (!q) return true;
    return `${def.label} ${def.section} ${def.hint || ''} ${def.keywords || ''}`.toLowerCase().includes(q);
}

function applyCustomizeFilter(): void {
    if (!liveContainer) return;
    const searchEl = liveContainer.querySelector<HTMLInputElement>('.st-m-cz-search');
    const q = (searchEl?.value || '').trim().toLowerCase();
    const searching = q.length > 0;

    let hits = 0;
    czFields.forEach(({ row, def }) => {
        const whenOk = !def.when || def.when(themeState.activeTheme);
        const searchOk = matchesQuery(def, q);
        const show = whenOk && searchOk;
        row.style.display = show ? '' : 'none';
        if (show && searching) hits++;
    });

    czGroups.forEach(({ el }) => {
        const anyVisible = Array.from(el.querySelectorAll<HTMLElement>('.st-m-field'))
            .some(f => f.style.display !== 'none');
        el.style.display = anyVisible ? '' : 'none';
    });

    liveContainer.querySelectorAll<HTMLElement>('.st-m-cz-sections .st-m-section').forEach(sec => {
        const anyVisible = Array.from(sec.querySelectorAll<HTMLElement>('.st-m-field')).some(f => f.style.display !== 'none');
        sec.style.display = anyVisible ? '' : 'none';
    });

    liveContainer.querySelectorAll<HTMLElement>('.st-m-cz-category').forEach(cat => {
        const anyVisible = Array.from(cat.querySelectorAll<HTMLElement>('.st-m-section')).some(s => s.style.display !== 'none');
        const show = searching ? anyVisible : (cat.id === activeCategoryId && anyVisible);
        cat.style.display = show ? '' : 'none';
        const navItem = liveContainer!.querySelector<HTMLElement>(`.st-m-cz-nav-item[data-target="${cat.id}"]`);
        if (navItem) {
            const isActive = !searching && cat.id === activeCategoryId;
            navItem.classList.toggle('active', isActive);
            navItem.setAttribute('aria-selected', String(isActive));
        }
    });

    const rail = liveContainer.querySelector<HTMLElement>('.st-m-cz-nav');
    if (rail) rail.classList.toggle('st-m-cz-nav-muted', searching);

    const status = liveContainer.querySelector<HTMLElement>('.st-m-cz-status');
    if (status) {
        status.style.display = searching ? '' : 'none';
        status.textContent = hits === 0
            ? `No settings match “${q}”.`
            : `${hits} setting${hits === 1 ? '' : 's'} match “${q}”.`;
        status.classList.toggle('st-m-cz-status-empty', hits === 0);
    }

    const clear = liveContainer.querySelector<HTMLElement>('.st-m-cz-clear');
    if (clear) clear.style.display = searching ? '' : 'none';
}

function formatFieldValue(value: unknown, unit = ''): string {
    if (typeof value === 'number') {
        const rounded = Math.round(value * 100) / 100;
        return `${rounded}${unit}`;
    }
    return `${value ?? ''}${unit}`;
}

const RESET_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"></path><path d="M2 2.5V6h3.5"></path></svg>';

function isBaselineValue(def: FieldDef): boolean {
    return themeState.activeTheme[def.id] === baseline.config[def.id];
}

function buildField(def: FieldDef, index: number): FieldHandle {
    const row = document.createElement('div');
    row.className = `st-m-field st-m-field-${def.type}`;
    row.dataset.stIdx = String(index);
    if (def.when) {
        row.dataset.stWhen = String(index);
        row.style.display = def.when(themeState.activeTheme) ? '' : 'none';
    }

    const labelBox = document.createElement('div');
    labelBox.className = 'st-m-field-labelbox';

    const label = document.createElement('label');
    label.className = 'st-m-field-label';
    label.textContent = def.label;
    labelBox.appendChild(label);

    if (def.hint) {
        const hint = document.createElement('div');
        hint.className = 'st-m-field-hint';
        hint.textContent = def.hint;
        labelBox.appendChild(hint);
    }
    row.appendChild(labelBox);

    const control = document.createElement('div');
    control.className = 'st-m-field-control';
    row.appendChild(control);

    const cur = themeState.activeTheme[def.id];

    if (def.comingSoon) {
        row.className = 'st-m-field st-m-field-coming-soon';
        const badge = document.createElement('span');
        badge.className = 'st-m-coming-soon';
        badge.textContent = 'Coming soon';
        control.appendChild(badge);
        return { row, def, sync: () => {}, refreshReset: () => {} };
    }

    let sync: () => void = () => {};

    switch (def.type) {
        case 'toggle': {
            const wrap = document.createElement('label');
            wrap.className = 'st-m-toggle';
            wrap.innerHTML = `<input type="checkbox" ${cur ? 'checked' : ''}><span class="st-m-toggle-slider"></span>`;
            const input = wrap.querySelector('input') as HTMLInputElement;
            input.addEventListener('change', () => liveUpdate(def.id, input.checked as any));
            control.appendChild(wrap);
            sync = () => { input.checked = !!themeState.activeTheme[def.id]; };
            break;
        }
        case 'color': {
            const input = document.createElement('input');
            input.type = 'color';
            input.className = 'st-m-color';
            input.value = toColorInputValue(String(cur ?? ''));
            input.addEventListener('input', () => liveUpdate(def.id, input.value as any));
            control.appendChild(input);
            sync = () => { input.value = toColorInputValue(String(themeState.activeTheme[def.id] ?? '')); };
            break;
        }
        case 'slider': {
            const wrap = document.createElement('div');
            wrap.className = 'st-m-slider-wrap';
            const input = document.createElement('input');
            input.type = 'range';
            input.className = 'st-m-slider';
            input.min = String(def.min ?? 0);
            input.max = String(def.max ?? 1);
            input.step = String(def.step ?? 0.05);
            input.value = String(cur);
            const value = document.createElement('span');
            value.className = 'st-m-slider-value';
            value.textContent = formatFieldValue(cur, def.unit);
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                value.textContent = formatFieldValue(v, def.unit);
                liveUpdate(def.id, v as any);
            });
            wrap.appendChild(input);
            wrap.appendChild(value);
            control.appendChild(wrap);
            sync = () => {
                const v = themeState.activeTheme[def.id];
                input.value = String(v);
                value.textContent = formatFieldValue(v, def.unit);
            };
            break;
        }
        case 'dropdown': {
            const select = document.createElement('select');
            select.className = 'st-m-select';
            const opts = def.options || [];

            if (def.options?.some(o => o.value === '__custom__')) {
                const namedOptions = def.options.filter(o => o.value !== '__custom__');
                const resolve = (v: unknown) => {
                    const isCustom = !namedOptions.some(o => o.value === v);
                    return isCustom && v !== '' ? '__custom__' : String(v);
                };
                opts.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.value;
                    opt.textContent = o.text;
                    if (o.value === resolve(cur)) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    if (select.value === '__custom__') {
                        liveUpdate(def.id, 'Custom Font' as any);
                    } else {
                        liveUpdate(def.id, select.value as any);
                    }
                });
                sync = () => { select.value = resolve(themeState.activeTheme[def.id]); };
            } else {
                let matched = false;
                opts.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.value;
                    opt.textContent = o.text;
                    if (String(cur) === o.value) {
                        opt.selected = true;
                        matched = true;
                    }
                    select.appendChild(opt);
                });
                const isNumeric = typeof DEFAULT_THEME[def.id] === 'number';
                if (!matched && cur !== undefined && cur !== null && String(cur) !== '') {
                    const opt = document.createElement('option');
                    opt.value = String(cur);
                    opt.textContent = isNumeric ? `Custom (${cur})` : String(cur);
                    opt.selected = true;
                    select.appendChild(opt);
                }
                select.addEventListener('change', () => {
                    const v: any = isNumeric ? parseInt(select.value, 10) : select.value;
                    liveUpdate(def.id, v);
                });
                sync = () => { select.value = String(themeState.activeTheme[def.id]); };
            }
            control.appendChild(select);
            break;
        }
        case 'text': {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'st-m-text';
            const curText = String(cur || '');
            input.value = curText === 'Custom Font' ? '' : curText;
            input.placeholder = def.placeholder || 'Enter font name';
            input.addEventListener('change', () => liveUpdate(def.id, input.value as any));
            control.appendChild(input);
            sync = () => {
                const v = String(themeState.activeTheme[def.id] || '');
                input.value = v === 'Custom Font' ? '' : v;
            };
            break;
        }
    }

    const reset = document.createElement('button');
    reset.className = 'st-m-field-reset';
    reset.type = 'button';
    reset.innerHTML = RESET_SVG;
    reset.addEventListener('click', () => {
        liveUpdate(def.id, baseline.config[def.id]);
        syncAllFields();
    });
    control.appendChild(reset);

    const refreshReset = () => {
        reset.classList.toggle('st-m-field-reset-on', !isBaselineValue(def));
        const label = `Reset “${def.label}” to ${baseline.name === 'default' ? 'the default' : `“${baseline.name}”`}`;
        reset.title = label;
        reset.setAttribute('aria-label', label);
    };
    const handle: FieldHandle = {
        row,
        def,
        refreshReset,
        sync: () => {
            sync();
            refreshReset();
        },
    };
    handle.sync();
    return handle;
}

function refreshResetIndicators(): void {
    czFields = czFields.filter(f => f.row.isConnected);
    czFields.forEach(f => f.refreshReset());
}

function syncAllFields(): void {
    czFields = czFields.filter(f => f.row.isConnected);
    czFields.forEach(f => f.sync());
    applyCustomizeFilter();
    syncChrome.forEach(fn => fn());
}

interface CzCategory {
    id: string;
    label: string;
    icon: string;
    description: string;
    sections: string[];
}

const CZ_CATEGORIES: CzCategory[] = [
    {
        id: 'cz-text',
        label: 'Text',
        icon: 'Aa',
        description: 'The colour, font and size of the lyrics themselves.',
        sections: ['Line colors', 'Gradient', 'Typography'],
    },
    {
        id: 'cz-glow',
        label: 'Glow',
        icon: '✦',
        description: 'Halos and shadows behind the text.',
        sections: ['Glow'],
    },
    {
        id: 'cz-focus',
        label: 'Focus',
        icon: '◎',
        description: 'Draw the eye to the line being sung by softening or hiding the rest.',
        sections: ['Focus'],
    },
    {
        id: 'cz-motion',
        label: 'Motion',
        icon: '⟩',
        description: 'How lines and words animate as the song plays.',
        sections: ['Motion'],
    },
    {
        id: 'cz-background',
        label: 'Background',
        icon: '▦',
        description: 'What sits behind the lyrics.',
        sections: ['Background'],
    },
    {
        id: 'cz-player',
        label: 'Player',
        icon: '♪',
        description: 'The Now Playing bar inside the Spicy Lyrics window.',
        sections: ['Now Playing bar', 'Equalizer'],
    },
    {
        id: 'cz-translation',
        label: 'Translation',
        icon: '文',
        description: 'Styling for lines added by the Spicy Lyrics Translator extension.',
        sections: ['Translation'],
    },
];

let activeCategoryId = CZ_CATEGORIES[0].id;

const SEARCH_SVG = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"></circle><line x1="10.6" y1="10.6" x2="14" y2="14"></line></svg>';

function buildSectionBody(section: HTMLElement, defs: { def: FieldDef; index: number }[]): void {
    const groups = new Map<string, HTMLElement>();
    const hasChildren = new Set(defs.map(d => d.def.parent).filter(Boolean) as string[]);

    defs.forEach(({ def, index }) => {
        const target = (def.parent && groups.get(def.parent)) || section;
        const handle = buildField(def, index);
        czFields.push(handle);
        target.appendChild(handle.row);

        if (hasChildren.has(def.id)) {
            const group = document.createElement('div');
            group.className = 'st-m-subgroup';
            target.appendChild(group);
            groups.set(def.id, group);
            czGroups.push({ el: group, parent: def.id });
        }
    });
}

function buildCustomizeTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content st-m-cz';

    const toolbar = document.createElement('div');
    toolbar.className = 'st-m-cz-toolbar';
    toolbar.innerHTML = `
        <span class="st-m-cz-search-icon" aria-hidden="true">${SEARCH_SVG}</span>
        <input type="text" class="st-m-text st-m-cz-search" placeholder="Search all settings…" spellcheck="false" aria-label="Search settings">
        <button type="button" class="st-m-cz-clear" style="display: none;" aria-label="Clear search">Clear</button>
    `;
    const search = toolbar.querySelector('input') as HTMLInputElement;
    const clear = toolbar.querySelector('.st-m-cz-clear') as HTMLButtonElement;
    search.addEventListener('input', applyCustomizeFilter);
    search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && search.value) {
            e.stopPropagation();
            search.value = '';
            applyCustomizeFilter();
        }
    });
    clear.addEventListener('click', () => {
        search.value = '';
        applyCustomizeFilter();
        search.focus();
    });

    const body = document.createElement('div');
    body.className = 'st-m-cz-body';

    const rail = document.createElement('div');
    rail.className = 'st-m-cz-rail';

    const nav = document.createElement('nav');
    nav.className = 'st-m-cz-nav';
    nav.setAttribute('role', 'tablist');

    const sectionsCol = document.createElement('div');
    sectionsCol.className = 'st-m-cz-sections';

    const status = document.createElement('div');
    status.className = 'st-m-cz-status';
    status.style.display = 'none';
    status.setAttribute('role', 'status');

    czFields = [];
    czGroups = [];

    const bySection = new Map<string, { def: FieldDef; index: number }[]>();
    SCHEMA.forEach((def, index) => {
        const list = bySection.get(def.section);
        if (list) list.push({ def, index });
        else bySection.set(def.section, [{ def, index }]);
    });

    const sectionEls = new Map<string, HTMLElement>();
    bySection.forEach((defs, name) => {
        const section = document.createElement('div');
        section.className = 'st-m-section';
        section.dataset.section = name;
        const header = document.createElement('div');
        header.className = 'st-m-section-title';
        header.textContent = name;
        section.appendChild(header);
        buildSectionBody(section, defs);
        sectionEls.set(name, section);
    });

    CZ_CATEGORIES.forEach(cat => {
        const catEl = document.createElement('div');
        catEl.className = 'st-m-cz-category';
        catEl.id = cat.id;

        const catHead = document.createElement('div');
        catHead.className = 'st-m-cz-cat-head';
        catHead.innerHTML = `
            <div class="st-m-cz-cat-title">${escapeHtml(cat.label)}</div>
            <div class="st-m-cz-cat-desc">${escapeHtml(cat.description)}</div>
        `;
        catEl.appendChild(catHead);

        cat.sections.forEach(s => {
            const el = sectionEls.get(s);
            if (el) catEl.appendChild(el);
        });
        sectionsCol.appendChild(catEl);

        const navBtn = document.createElement('button');
        navBtn.type = 'button';
        navBtn.className = `st-m-cz-nav-item${cat.id === activeCategoryId ? ' active' : ''}`;
        navBtn.innerHTML = `<span class="st-m-cz-nav-icon" aria-hidden="true">${escapeHtml(cat.icon)}</span><span>${escapeHtml(cat.label)}</span>`;
        navBtn.dataset.target = cat.id;
        navBtn.setAttribute('role', 'tab');
        navBtn.setAttribute('aria-selected', String(cat.id === activeCategoryId));
        navBtn.addEventListener('click', () => {
            activeCategoryId = cat.id;
            if (search.value) search.value = '';
            applyCustomizeFilter();
            const host = liveContainer?.querySelector('.st-m-tab-host') as HTMLElement | null;
            if (host) host.scrollTop = 0;
            if (liveContainer) liveContainer.scrollTop = 0;
            liveContainer?.closest('.sl-modal-content')?.scrollTo?.(0, 0);
        });
        nav.appendChild(navBtn);
    });

    sectionEls.forEach((el, name) => {
        if (!CZ_CATEGORIES.some(c => c.sections.includes(name))) sectionsCol.appendChild(el);
    });

    rail.appendChild(nav);
    body.appendChild(rail);
    body.appendChild(sectionsCol);
    tab.appendChild(toolbar);
    tab.appendChild(status);
    tab.appendChild(body);

    return tab;
}

function buildPresetsTab(refresh: () => void): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    const grid = document.createElement('div');
    grid.className = 'st-m-preset-grid';

    const all = getAllPresets();
    all.forEach(preset => {
        const card = document.createElement('div');
        const isActive = preset.name === themeState.activePresetName;
        card.className = `st-m-preset-card${isActive ? ' active' : ''}`;
        card.title = preset.description;

        const preview = document.createElement('div');
        preview.className = 'st-m-preset-preview';
        renderPreview(preview, preset.config);

        const meta = document.createElement('div');
        meta.className = 'st-m-preset-meta';
        const isCustom = !BUILTIN_PRESETS.some(b => b.name === preset.name);
        meta.innerHTML = `
            <div class="st-m-preset-name">${escapeHtml(preset.name)}${isCustom ? ' <span class="st-m-preset-tag">custom</span>' : ''}</div>
            <div class="st-m-preset-desc">${escapeHtml(preset.description || '')}</div>
        `;

        const actions = document.createElement('div');
        actions.className = 'st-m-preset-actions';

        const apply = document.createElement('button');
        apply.className = 'st-m-btn st-m-btn-primary';
        apply.textContent = isActive ? 'Active' : 'Apply';
        apply.disabled = isActive;
        apply.addEventListener('click', () => {
            applyPreset(preset);
            resolveBaseline();
            injectThemeStyles();
            refresh();
        });
        actions.appendChild(apply);

        if (isCustom) {
            const del = document.createElement('button');
            del.className = 'st-m-btn st-m-btn-danger';
            del.textContent = 'Delete';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCustomPreset(preset.name);
                refresh();
            });
            actions.appendChild(del);
        }

        card.appendChild(preview);
        card.appendChild(meta);
        card.appendChild(actions);
        grid.appendChild(card);
    });

    const saveBox = document.createElement('div');
    saveBox.className = 'st-m-save-preset';
    saveBox.innerHTML = `
        <div class="st-m-section-title">Save current theme</div>
        <div class="st-m-save-row">
            <input type="text" class="st-m-text" id="st-m-save-name" placeholder="Preset name" maxlength="60">
            <input type="text" class="st-m-text" id="st-m-save-desc" placeholder="Description (optional)" maxlength="200">
            <button class="st-m-btn st-m-btn-primary" id="st-m-save-btn">Save</button>
        </div>
    `;

    const nameInput = saveBox.querySelector('#st-m-save-name') as HTMLInputElement;
    const descInput = saveBox.querySelector('#st-m-save-desc') as HTMLInputElement;
    const saveBtn = saveBox.querySelector('#st-m-save-btn') as HTMLButtonElement;
    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            notify('Enter a preset name', true);
            nameInput.focus();
            return;
        }
        saveCustomPreset(name, descInput.value.trim());
        notify(`Preset "${name}" saved`);
        refresh();
    });

    tab.appendChild(grid);
    tab.appendChild(saveBox);
    return tab;
}

function buildMarketplaceTab(refresh: () => void): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    tab.innerHTML = `
        <div class="st-m-mp-toolbar">
            <div class="st-m-mp-searchbar">
                <span class="st-m-cz-search-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"></circle><line x1="10.6" y1="10.6" x2="14" y2="14"></line></svg></span>
                <input type="text" class="st-m-mp-search" placeholder="Search themes, authors…" spellcheck="false">
            </div>
            <div class="st-m-mp-sort">
                <button class="st-m-chip active" data-sort="newest">Newest</button>
                <button class="st-m-chip" data-sort="popular">Popular</button>
                <button class="st-m-chip" data-sort="featured">Featured</button>
            </div>
        </div>
        <div class="st-m-mp-status"></div>
        <div class="st-m-mp-grid"></div>
        <div class="st-m-mp-pagination" style="display: none;">
            <button class="st-m-btn" id="st-m-mp-prev">Prev</button>
            <span class="st-m-mp-page-info"></span>
            <button class="st-m-btn" id="st-m-mp-next">Next</button>
        </div>
    `;

    const search = tab.querySelector('.st-m-mp-search') as HTMLInputElement;
    const grid = tab.querySelector('.st-m-mp-grid') as HTMLElement;
    const status = tab.querySelector('.st-m-mp-status') as HTMLElement;
    const pagination = tab.querySelector('.st-m-mp-pagination') as HTMLElement;
    const pageInfo = tab.querySelector('.st-m-mp-page-info') as HTMLElement;
    const prev = tab.querySelector('#st-m-mp-prev') as HTMLButtonElement;
    const next = tab.querySelector('#st-m-mp-next') as HTMLButtonElement;
    const sortChips = tab.querySelectorAll<HTMLButtonElement>('.st-m-chip[data-sort]');

    let page = 1;
    let sort: Marketplace.MarketplaceSort = 'newest';
    let query = '';
    let totalPages = 1;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    function renderCards(themes: Marketplace.MarketplaceTheme[]): void {
        grid.innerHTML = '';
        themes.forEach(t => {
            const card = document.createElement('div');
            card.className = 'st-m-mp-card';

            const preview = document.createElement('div');
            preview.className = 'st-m-mp-preview';
            renderPreview(preview, t.theme);

            const body = document.createElement('div');
            body.className = 'st-m-mp-body';
            body.innerHTML = `
                <div class="st-m-mp-name">${escapeHtml(t.name)}${t.featured ? ' <span class="st-m-mp-featured">FEATURED</span>' : ''}</div>
                <div class="st-m-mp-author">by ${escapeHtml(t.author)}</div>
                ${t.description ? `<div class="st-m-mp-desc">${escapeHtml(t.description)}</div>` : ''}
                <div class="st-m-mp-stats"><span>${t.downloads || 0} downloads</span></div>
            `;

            const actions = document.createElement('div');
            actions.className = 'st-m-mp-actions';

            const apply = document.createElement('button');
            apply.className = 'st-m-btn st-m-btn-primary';
            apply.textContent = 'Apply';
            apply.addEventListener('click', async () => {
                apply.disabled = true;
                apply.textContent = 'Applying...';
                try {
                    const data = await Marketplace.downloadTheme(t.id);
                    themeState.activeTheme = mergeThemeConfig(data.theme);
                    themeState.activePresetName = t.name;
                    baseline = { name: t.name, config: { ...themeState.activeTheme } };
                    saveThemeState();
                    injectThemeStyles();
                    refresh();
                    notify(`Applied "${t.name}" by ${t.author}`);
                } catch (e) {
                    notify(`Failed to apply: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                    apply.disabled = false;
                    apply.textContent = 'Apply';
                }
            });

            const savePreset = document.createElement('button');
            savePreset.className = 'st-m-btn';
            savePreset.textContent = 'Save as preset';
            savePreset.addEventListener('click', async () => {
                savePreset.disabled = true;
                try {
                    const data = await Marketplace.downloadTheme(t.id);
                    const presetName = t.name;
                    const merged: ThemeConfig = mergeThemeConfig(data.theme);
                    const preset: ThemePreset = {
                        name: presetName,
                        description: t.description || `By ${t.author}`,
                        config: merged,
                    };
                    const existing = themeState.customPresets.findIndex(p => p.name === presetName);
                    if (existing >= 0) {
                        themeState.customPresets[existing] = preset;
                    } else {
                        themeState.customPresets.push(preset);
                    }
                    saveThemeState();
                    notify(`Saved preset "${presetName}"`);
                } catch (e) {
                    notify(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                } finally {
                    savePreset.disabled = false;
                }
            });

            actions.appendChild(apply);
            actions.appendChild(savePreset);

            card.appendChild(preview);
            card.appendChild(body);
            card.appendChild(actions);
            grid.appendChild(card);
        });
    }

    function renderSkeleton(count = 6): void {
        grid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = 'st-m-mp-card st-m-mp-skeleton';
            card.innerHTML = `
                <div class="st-m-mp-preview st-sk"></div>
                <div class="st-m-mp-body">
                    <div class="st-sk st-sk-line" style="width: 62%;"></div>
                    <div class="st-sk st-sk-line" style="width: 40%;"></div>
                    <div class="st-sk st-sk-line" style="width: 80%;"></div>
                </div>`;
            grid.appendChild(card);
        }
    }

    async function load(): Promise<void> {
        status.style.display = 'none';
        renderSkeleton();
        pagination.style.display = 'none';
        try {
            const res = await Marketplace.listThemes({ page, sort, query });
            status.style.display = 'none';
            if (!res.themes || res.themes.length === 0) {
                grid.innerHTML = '';
                status.textContent = 'No themes found.';
                status.style.display = '';
                return;
            }
            renderCards(res.themes);
            totalPages = res.totalPages;
            if (totalPages > 1) {
                pagination.style.display = '';
                pageInfo.textContent = `Page ${res.page} of ${res.totalPages}`;
                prev.disabled = res.page <= 1;
                next.disabled = res.page >= res.totalPages;
            }
        } catch (e) {
            grid.innerHTML = '';
            status.textContent = `Failed to load marketplace: ${e instanceof Error ? e.message : 'Unknown error'}. Make sure you're online.`;
            status.style.display = '';
        }
    }

    sortChips.forEach(chip => {
        chip.addEventListener('click', () => {
            sortChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            sort = (chip.dataset.sort || 'newest') as Marketplace.MarketplaceSort;
            page = 1;
            load();
        });
    });

    search.addEventListener('input', () => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            query = search.value.trim();
            page = 1;
            load();
        }, 350);
    });

    prev.addEventListener('click', () => { if (page > 1) { page--; load(); } });
    next.addEventListener('click', () => { if (page < totalPages) { page++; load(); } });

    load();
    return tab;
}

function buildAboutTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    const version = getCurrentVersion().text;
    const { hash, source } = getDisplayHash();
    const shortHash = hash ? hash.substring(0, 8) : '';
    const hashTitle = source === 'delivered'
        ? `SHA-256 of the loaded script — ${hash}`
        : `Build hash — ${hash}`;

    tab.innerHTML = `
        <div class="st-m-section">
            <div class="st-m-about-hero">
                <div class="st-m-about-title">Spicy Themes</div>
                <div class="st-m-about-version">v${escapeHtml(version)}</div>
                ${shortHash ? `<div class="st-m-about-hash" title="${escapeHtml(hashTitle)}">${escapeHtml(shortHash)}</div>` : ''}
            </div>
            <div class="st-m-about-text">Customize Spicy Lyrics with colors, glow, gradients, blur, fonts and more.</div>
        </div>
        <div class="st-m-section">
            <div class="st-m-section-title">Configuration</div>
            <div class="st-m-about-actions">
                <button class="st-m-btn" id="st-m-export">Export theme as JSON</button>
                <button class="st-m-btn" id="st-m-import">Import theme JSON</button>
                <button class="st-m-btn st-m-btn-danger" id="st-m-reset">Reset to default</button>
            </div>
        </div>
        <div class="st-m-section">
            <div class="st-m-section-title">Updates</div>
            <div class="st-m-about-actions">
                <button class="st-m-btn" id="st-m-check">Check for updates</button>
            </div>
        </div>
        <div class="st-m-section">
            <div class="st-m-about-links">
                <a href="https://github.com/7xeh/SpicyThemes" target="_blank" rel="noopener noreferrer">GitHub</a>
                <a href="https://7xeh.dev/apps/spicythemes/marketplace/" target="_blank" rel="noopener noreferrer">Marketplace</a>
                <a href="https://7xeh.dev/apps/spicythemes/create/" target="_blank" rel="noopener noreferrer">Theme Creator</a>
            </div>
        </div>
    `;

    const exportBtn = tab.querySelector('#st-m-export') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
        const data = JSON.stringify({
            theme: themeState.activeTheme,
            presets: themeState.customPresets,
            presetName: themeState.activePresetName,
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spicy-themes-config.json';
        a.click();
        URL.revokeObjectURL(url);
        notify('Theme exported');
    });

    const importBtn = tab.querySelector('#st-m-import') as HTMLButtonElement;
    importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    if (data.theme) {
                        themeState.activeTheme = mergeThemeConfig(data.theme);
                    }
                    if (Array.isArray(data.presets)) {
                        themeState.customPresets = data.presets;
                    }
                    if (data.presetName) {
                        themeState.activePresetName = data.presetName;
                    }
                    saveThemeState();
                    injectThemeStyles();
                    notify('Theme imported');
                } catch {
                    notify('Invalid theme file', true);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    const resetBtn = tab.querySelector('#st-m-reset') as HTMLButtonElement;
    resetBtn.addEventListener('click', () => {
        applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
        injectThemeStyles();
        notify('Theme reset to default');
    });

    const checkBtn = tab.querySelector('#st-m-check') as HTMLButtonElement;
    checkBtn.addEventListener('click', async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
        try {
            const info = await getUpdateInfo();
            if (!info) throw new Error('No metadata');
            if (info.hasUpdate) {
                notify(`Update available: v${info.latestVersion}! Updating...`);
                await checkForUpdates(true);
            } else {
                let hotfix = false;
                try {
                    const metadata = (window as any)._spicy_themes_metadata;
                    if (metadata?.utils?.runHotfixCheck) {
                        hotfix = await metadata.utils.runHotfixCheck(true);
                    }
                } catch (_) {}
                if (hotfix) {
                    notify('Hotfix found! Reloading...');
                } else {
                    notify("You're on the latest version");
                }
            }
        } catch {
            notify('Failed to check for updates', true);
        } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check for updates';
        }
    });

    return tab;
}

function buildMasterBar(onChange: () => void): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'st-m-enabled-bar';
    bar.innerHTML = `
        <div class="st-m-enabled-text">
            <div class="st-m-enabled-title">Spicy Themes</div>
            <div class="st-m-enabled-sub"></div>
        </div>
        <button type="button" class="st-m-btn st-m-enabled-reset">Reset all</button>
        <label class="st-m-toggle" title="Turn all Spicy Themes styling on or off">
            <input type="checkbox" aria-label="Enable Spicy Themes">
            <span class="st-m-toggle-slider"></span>
        </label>
    `;

    const sub = bar.querySelector('.st-m-enabled-sub') as HTMLElement;
    const input = bar.querySelector('input') as HTMLInputElement;
    const resetBtn = bar.querySelector('.st-m-enabled-reset') as HTMLButtonElement;

    const sync = () => {
        input.checked = themeState.isEnabled;
        bar.classList.toggle('st-m-enabled-off', !themeState.isEnabled);
        const changed = new Set(
            SCHEMA.filter(d => themeState.activeTheme[d.id] !== baseline.config[d.id]).map(d => d.id)
        ).size;
        const base = baseline.name === 'default' ? 'Default' : baseline.name;
        sub.textContent = themeState.isEnabled
            ? `Based on “${base}”${changed ? ` · ${changed} tweak${changed === 1 ? '' : 's'}` : ''}`
            : 'Styling is off — Spicy Lyrics looks stock';
    };

    input.addEventListener('change', () => {
        themeState.isEnabled = input.checked;
        saveThemeState();
        injectThemeStyles();
        sync();
    });

    resetBtn.addEventListener('click', () => {
        applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
        resolveBaseline();
        injectThemeStyles();
        notify('Everything reset to default');
        onChange();
    });

    syncChrome.push(sync);
    sync();
    return bar;
}

export function createSettingsModal(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'st-modal-root';
    liveContainer = container;
    syncChrome = [];
    resolveBaseline();

    const tabBar = document.createElement('div');
    tabBar.className = 'st-m-tabbar';
    tabBar.setAttribute('role', 'tablist');

    const tabContent = document.createElement('div');
    tabContent.className = 'st-m-tab-host';

    const tabs: { id: string; label: string; render: () => HTMLElement }[] = [
        { id: 'customize', label: 'Customize', render: () => buildCustomizeTab() },
        { id: 'presets', label: 'Presets', render: () => buildPresetsTab(rerender) },
        { id: 'marketplace', label: 'Marketplace', render: () => buildMarketplaceTab(rerender) },
        { id: 'about', label: 'About', render: () => buildAboutTab() },
    ];
    let activeTab = tabs[0].id;

    function rerender(): void {
        const current = tabs.find(t => t.id === activeTab) || tabs[0];
        tabContent.innerHTML = '';
        tabContent.appendChild(current.render());
        applyCustomizeFilter();
        syncChrome.forEach(fn => fn());
    }

    const masterBar = buildMasterBar(rerender);

    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `st-m-tab${t.id === activeTab ? ' active' : ''}`;
        btn.textContent = t.label;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(t.id === activeTab));
        btn.addEventListener('click', () => {
            activeTab = t.id;
            tabBar.querySelectorAll('.st-m-tab').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            rerender();
        });
        tabBar.appendChild(btn);
    });

    const header = document.createElement('div');
    header.className = 'st-m-header';
    header.appendChild(masterBar);
    header.appendChild(tabBar);

    container.appendChild(header);
    container.appendChild(tabContent);

    rerender();

    return container;
}
