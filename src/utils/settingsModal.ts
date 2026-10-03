import { storage } from './storage';
import {
    themeState,
    saveThemeState,
    applyPreset,
    getAllPresets,
    activeBaseName,
    saveCustomPreset,
    deleteCustomPreset,
    upsertCustomPreset,
    setActiveSource,
    sanitizeCustomPresets,
    sanitizeThemeSource,
    updateThemeProperty,
    mergeThemeConfig,
    DEFAULT_THEME,
    BUILTIN_PRESETS,
    WORD_EFFECTS,
    EQ_STYLES,
    ANIM_BG_STYLES,
    resolveWordTrigger,
    ThemeConfig,
    ThemePreset,
} from './state';
import { injectThemeStyles } from './themeEngine';
import { buildVideoQualityPanel } from './videoQualityPanel';
import { setVideoAuto } from './videoMode';
import { saveBackgroundImage, pruneBackgroundImages, getCachedBackgroundUrl, getBackgroundImageUrl, getBackgroundImageInfo, bgImageSize, bgImageRepeat, bgImagePosition } from './backgroundImage';
import { getCurrentVersion, getDisplayHash, runManualUpdateCheck, showCurrentChangelog, hasWaitingUpdate, openWaitingUpdate } from './updater';
import { el, openDialog, openSurfaces, prefersReducedMotion, paintTone, CLOSE_SVG, SurfaceHandle, Tone } from './surface';
import { toast, getInbox, markInboxRead, clearInbox, onInboxChange, unreadCount, runInboxAction, InboxEntry } from './toast';
import { Icons } from './icons';
import * as Marketplace from './marketplace';
import {
    scanForUpdates,
    presetUpdate,
    activeThemeUpdate,
    presetHasLocalChanges,
    activeThemeHasLocalChanges,
    updatePresetFromSource,
    updateActiveThemeFromSource,
    downloadThemeWithSource,
} from './themeUpdates';

export type FieldType = 'toggle' | 'color' | 'slider' | 'dropdown' | 'text' | 'image';

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
    options?: { value: string; text: string; hint?: string }[];
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

const EQ_STYLE_OPTIONS = EQ_STYLES.map(s => ({ value: s.id, text: `${s.group} — ${s.label}` }));

const VIDEO_QUALITY_SECTION = 'Video quality';
const MUSIC_VIDEO_SECTION = 'Music video';
const ANIM_BG_SECTION = 'Animated background';

const ANIM_BG_STYLE_OPTIONS = ANIM_BG_STYLES.map(s => ({ value: s.id, text: s.label, hint: s.description }));

function animStyle(t: ThemeConfig) {
    return ANIM_BG_STYLES.find(s => s.id === t.animBgStyle) || ANIM_BG_STYLES[0];
}

export const SCHEMA: FieldDef[] = [
    { id: 'lyricsStylingEnabled', label: 'Restyle lyrics', type: 'toggle', section: 'Line colors', hint: 'Off keeps Spicy Lyrics’ own lyric look, untouched. Changing any lyric setting turns it back on.', keywords: 'stock native original spicy lyrics look default plain' },
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
    { id: 'blurSungWholeWords', label: 'Fade whole words, not syllables', type: 'toggle', section: 'Focus', parent: 'blurSungWords', when: (t) => t.blurSungWords, hint: 'On syllable-synced lyrics, a word split into syllables only fades once its last syllable has been sung, instead of fading piece by piece.', keywords: 'syllable word whole group karaoke blur trail' },
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
    { id: 'pageBgImageEnabled', label: 'Custom background image', type: 'toggle', section: 'Background', hint: 'Replaces the Spicy Lyrics background — album colours, artist header or animated art — with a picture of your own. Music videos still play over it when one is available.', keywords: 'wallpaper picture photo upload image static custom artist header dynamic' },
    { id: 'pageBgImage', label: 'Image', type: 'image', section: 'Background', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, hint: 'Saved on this device only, so it isn’t included when you export or share a theme.', keywords: 'upload file picture wallpaper photo' },
    { id: 'pageBgImageFit', label: 'Fit', type: 'dropdown', section: 'Background', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, options: [
        { value: 'cover', text: 'Fill (crop to fit)' },
        { value: 'contain', text: 'Fit (show whole image)' },
        { value: 'stretch', text: 'Stretch' },
        { value: 'tile', text: 'Tile' },
    ], keywords: 'cover contain stretch tile repeat scale' },
    { id: 'pageBgImagePosition', label: 'Focus point', type: 'dropdown', section: 'Background', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled && (t.pageBgImageFit === 'cover' || t.pageBgImageFit === 'contain'), options: [
        { value: 'center', text: 'Centre' },
        { value: 'top', text: 'Top' },
        { value: 'bottom', text: 'Bottom' },
        { value: 'left', text: 'Left' },
        { value: 'right', text: 'Right' },
    ], hint: 'Which part of the image stays in view when it’s cropped.', keywords: 'position align anchor crop' },
    { id: 'pageBgImageBlur', label: 'Blur', type: 'slider', section: 'Background', min: 0, max: 40, step: 1, unit: 'px', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, keywords: 'soften frosted' },
    { id: 'pageBgImageDim', label: 'Dimming', type: 'slider', section: 'Background', min: 0, max: 1, step: 0.05, parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, hint: 'Darkens the image so lyrics stay readable.', keywords: 'darken brightness' },
    { id: 'musicVideoDim', label: 'Video dimming', type: 'slider', section: MUSIC_VIDEO_SECTION, min: 0, max: 1, step: 0.05, hint: 'Darkens the video so lyrics stay readable.', keywords: 'music video darken brightness mv' },
    { id: 'musicVideoBackdrop', label: 'Video backdrop', type: 'dropdown', section: MUSIC_VIDEO_SECTION, options: [
        { value: 'solid', text: 'Replace the background' },
        { value: 'blend', text: 'Blend over Spicy Lyrics / image' },
    ], hint: 'Blend mixes the video with the album background or your custom image instead of covering it.', keywords: 'music video behind transparent overlay mix mv' },
    { id: 'musicVideoBlend', label: 'Video strength', type: 'slider', section: MUSIC_VIDEO_SECTION, min: 0.1, max: 1, step: 0.05, parent: 'musicVideoBackdrop', when: (t) => t.musicVideoBackdrop === 'blend', hint: 'How much of the video shows through. Lower values keep more of the background.', keywords: 'music video opacity mix amount mv' },
    { id: 'musicVideoCompact', label: 'Also in compact player', type: 'toggle', section: MUSIC_VIDEO_SECTION, keywords: 'music video compact card mv' },
    { id: 'musicVideoFullscreenCompact', label: 'Also in fullscreen compact', type: 'toggle', section: MUSIC_VIDEO_SECTION, when: (t) => !t.musicVideoCompact, hint: 'Keeps the video behind the compact layout while fullscreen, without turning it on for the windowed or popout player.', keywords: 'music video fullscreen compact mv' },

    { id: 'animBgEnabled', label: 'Animated background', type: 'toggle', section: ANIM_BG_SECTION, hint: 'Draws a live, music-reactive scene behind the lyrics. Music videos still play over it when one is available.', keywords: 'visualizer visualiser animated moving live webgl shader reactive audio spectrum unknown pleasures waves lines' },
    { id: 'animBgStyle', label: 'Style', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: ANIM_BG_STYLE_OPTIONS, hint: 'Hover a style in the list for a description. Controls that don’t apply to it are hidden.', keywords: 'ridgelines silk halo aurora orbs horizon synthwave rings mode preset' },
    { id: 'animBgPalette', label: 'Colours', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'custom', text: 'Custom colours' },
        { value: 'album', text: 'From album art' },
        { value: 'spectrum', text: 'Rainbow spectrum' },
    ], hint: 'Album colours fade smoothly into each new track’s palette.', keywords: 'palette colour color album art rainbow' },
    { id: 'animBgColor', label: 'Primary colour', type: 'color', section: ANIM_BG_SECTION, parent: 'animBgPalette', when: (t) => t.animBgEnabled && t.animBgPalette === 'custom', hint: 'Used up front — the nearest lines, inner rings and lower layers.' },
    { id: 'animBgColor2', label: 'Secondary colour', type: 'color', section: ANIM_BG_SECTION, parent: 'animBgPalette', when: (t) => t.animBgEnabled && t.animBgPalette === 'custom', hint: 'Blended in toward the back of the scene.' },
    { id: 'animBgHueCycle', label: 'Colour cycling', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgPalette', when: (t) => t.animBgEnabled, hint: 'Slowly rotates the hue of every colour over time. 0 keeps colours fixed.', keywords: 'hue rotate shift rainbow' },
    { id: 'animBgBackdrop', label: 'Backdrop', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'solid', text: 'Solid colour' },
        { value: 'blend', text: 'Blend over Spicy Lyrics / image' },
    ], hint: 'Blend draws just the lines and light on top of the album background or your custom image.', keywords: 'behind transparent overlay mix' },
    { id: 'animBgBgColor', label: 'Backdrop colour', type: 'color', section: ANIM_BG_SECTION, parent: 'animBgBackdrop', when: (t) => t.animBgEnabled && t.animBgBackdrop === 'solid' },
    { id: 'animBgSpeed', label: 'Speed', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 3, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'tempo fast slow flow' },
    { id: 'animBgReactivity', label: 'Music reactivity', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 2, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How strongly the scene follows the track’s loudness, beats and spectrum. 0 turns it into a calm ambient loop.', keywords: 'audio beat bass sensitivity react' },
    { id: 'animBgReactTo', label: 'Reacts to', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgReactivity', when: (t) => t.animBgEnabled && t.animBgReactivity > 0, options: [
        { value: 'all', text: 'Bass and highs' },
        { value: 'bass', text: 'Bass only' },
        { value: 'highs', text: 'Highs only' },
    ], hint: 'Which part of the track drives the scene. Bass follows kicks and low end; highs follow vocals, hats and cymbals.', keywords: 'audio frequency bass treble highs lows kick beat focus range' },
    { id: 'animBgIdleMotion', label: 'Motion while paused', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How much the scene keeps drifting when nothing is playing. 0 freezes it and stops redrawing.', keywords: 'idle pause freeze' },
    { id: 'animBgDensity', label: 'Density', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How much is drawn — lines, rings, curtains, stars, waves or dots.', keywords: 'count lines rings amount' },
    { id: 'animBgThickness', label: 'Thickness', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Line weight — or curtain height, orb and dot size, and cloud contrast.', keywords: 'width weight size' },
    { id: 'animBgAmplitude', label: 'Wave height', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How far the music pushes the scene — peak height, warping, bulges or streak length.', keywords: 'amplitude peaks height' },
    { id: 'animBgAngle', label: 'Rotation', type: 'slider', section: ANIM_BG_SECTION, min: -180, max: 180, step: 1, unit: '°', parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).angle, keywords: 'angle tilt diagonal rotate' },
    { id: 'animBgPerspective', label: 'Perspective', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).perspective, hint: 'How deep the scene recedes. For Horizon it sets where the horizon sits; for Wormhole, how far you can see down it.', keywords: 'depth 3d distance horizon' },
    { id: 'animBgMirror', label: 'Mirror spectrum', type: 'toggle', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).mirror, hint: 'Puts the bass in the middle and mirrors the highs out to both sides.', keywords: 'symmetric symmetry bass centre' },
    { id: 'animBgSolid', label: 'Solid ridges', type: 'toggle', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).solid, hint: 'Each ridge hides the lines behind it, like a mountain range.', keywords: 'occlude hide behind fill mountain' },
    { id: 'animBgGlow', label: 'Glow', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1.5, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'bloom halo neon soft' },
    { id: 'animBgBrightness', label: 'Brightness', type: 'slider', section: ANIM_BG_SECTION, min: 0.2, max: 2, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'intensity exposure' },
    { id: 'animBgOpacity', label: 'Opacity', type: 'slider', section: ANIM_BG_SECTION, min: 0.05, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'transparency fade' },
    { id: 'animBgVignette', label: 'Vignette', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Darkens the edges so the lyrics stand out.', keywords: 'edges darken corners' },
    { id: 'animBgGrain', label: 'Film grain', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 0.2, step: 0.01, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'A little noise hides colour banding in dark gradients.', keywords: 'noise dither texture' },
    { id: 'animBgBlur', label: 'Blur', type: 'slider', section: ANIM_BG_SECTION, min: 0, max: 30, step: 1, unit: 'px', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Softens the whole scene. Blurred scenes render at a lower resolution, so this also saves power.', keywords: 'soften frosted defocus' },
    { id: 'animBgQuality', label: 'Render quality', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'performance', text: 'Performance (half resolution)' },
        { value: 'balanced', text: 'Balanced' },
        { value: 'quality', text: 'Sharpest (full resolution)' },
    ], hint: 'Lower resolutions use far less GPU on large or high-DPI screens.', keywords: 'resolution gpu performance fps lag' },
    { id: 'animBgFps', label: 'Frame rate', type: 'dropdown', section: ANIM_BG_SECTION, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: '30', text: '30 fps' },
        { value: '60', text: '60 fps' },
        { value: 'max', text: 'Match display' },
    ], keywords: 'fps frame rate smooth performance battery' },

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
    { id: 'eqStyle', label: 'Style', type: 'dropdown', section: 'Equalizer', options: EQ_STYLE_OPTIONS, parent: 'eqEnabled', when: (t) => t.eqEnabled, hint: 'Grouped by feel, the same way word animations are — Classic reads as a meter, Energetic hits on the beat, Smooth drifts, Dimensional works in 3D.', keywords: 'equalizer dot wave waveform ladder bounce glitch pulse signal breathe sway orbit spectrum ring helix' },
    { id: 'eqPosition', label: 'Position', type: 'dropdown', section: 'Equalizer', options: [
        { value: 'both', text: 'Both sides' },
        { value: 'left', text: 'Left only' },
        { value: 'right', text: 'Right only' },
    ], parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqColor', label: 'Colour', type: 'color', section: 'Equalizer', parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqSize', label: 'Size', type: 'slider', section: 'Equalizer', min: 0.4, max: 2.5, step: 0.05, unit: 'x', parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqSpeed', label: 'Speed', type: 'slider', section: 'Equalizer', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'eqEnabled', when: (t) => t.eqEnabled },
    { id: 'eqStereoSpread', label: 'Stereo spread', type: 'toggle', section: 'Equalizer', parent: 'eqEnabled', when: (t) => t.eqEnabled && t.eqPosition === 'both', hint: 'Offsets the two sides in time and spectrum so they move independently instead of mirroring each other. Spotify only publishes a mono analysis, so this is a stereo-style spread rather than real left and right channels.', keywords: 'stereo channel split independent dual separate' },
    { id: 'eqStereoAmount', label: 'Spread amount', type: 'slider', section: 'Equalizer', min: 0.1, max: 1.0, step: 0.05, parent: 'eqStereoSpread', when: (t) => t.eqEnabled && t.eqPosition === 'both' && t.eqStereoSpread },

    { id: 'sltStylingEnabled', label: 'Style translated lines', type: 'toggle', section: 'Translation', hint: 'Requires the Spicy Lyrics Translator extension. Styles the translation lines and Learning Mode word cards it adds.', keywords: 'slt translator subtitle' },
    { id: 'sltIndependent', label: 'Style translations independently', type: 'toggle', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled, hint: 'Gives translated lines their own copy of every lyric control — colours, gradient, typography, glow, focus and motion — instead of following the main lyrics.', keywords: 'independent separate own controls mirror full' },
    { id: 'sltTranslationFont', label: 'Font', type: 'dropdown', section: 'Translation', options: [...TRANSLATION_FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationFont', label: 'Custom font name', type: 'text', section: 'Translation', placeholder: "e.g. 'Inter', sans-serif", parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltTranslationFont !== '' && !TRANSLATION_FONT_OPTIONS.some(o => o.value === t.sltTranslationFont) },
    { id: 'sltTranslationFontSize', label: 'Text size', type: 'slider', section: 'Translation', min: 0.25, max: 2.0, step: 0.05, unit: 'x', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationOpacity', label: 'Opacity', type: 'slider', section: 'Translation', min: 0.1, max: 1.0, step: 0.05, parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltHighlightStartColor', label: 'Highlight start', type: 'color', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltHighlightEndColor', label: 'Highlight end', type: 'color', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationColorEnabled', label: 'Custom base colour', type: 'toggle', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationColor', label: 'Base colour', type: 'color', section: 'Translation', parent: 'sltTranslationColorEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltTranslationColorEnabled },
    { id: 'sltGlowColorEnabled', label: 'Custom glow colour', type: 'toggle', section: 'Translation', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltGlowColor', label: 'Glow colour', type: 'color', section: 'Translation', parent: 'sltGlowColorEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltGlowColorEnabled },

    { id: 'sltActiveLineColor', label: 'Active line', type: 'color', section: 'Translation colours', when: (t) => t.sltStylingEnabled && t.sltIndependent && !t.sltGradientEnabled, hint: 'The translation of the line currently being sung. Replaced by the gradient when gradient text is on.', keywords: 'translation current karaoke highlight' },
    { id: 'sltSungLineColor', label: 'Already sung', type: 'color', section: 'Translation colours', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation past previous' },
    { id: 'sltNotSungLineColor', label: 'Not yet sung', type: 'color', section: 'Translation colours', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation upcoming future next' },
    { id: 'sltActiveLineOpacity', label: 'Active line opacity', type: 'slider', section: 'Translation colours', min: 0.1, max: 1.0, step: 0.05, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation transparency fade' },
    { id: 'sltSungLineOpacity', label: 'Sung line opacity', type: 'slider', section: 'Translation colours', min: 0.1, max: 1.0, step: 0.05, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation transparency fade' },
    { id: 'sltNotSungLineOpacity', label: 'Unsung line opacity', type: 'slider', section: 'Translation colours', min: 0.1, max: 1.0, step: 0.05, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation transparency fade' },

    { id: 'sltGradientEnabled', label: 'Gradient text', type: 'toggle', section: 'Translation gradient', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Fills the active translation with a two-colour gradient instead of a flat colour.', keywords: 'translation rainbow fade blend' },
    { id: 'sltGradientStartColor', label: 'Sung colour', type: 'color', section: 'Translation gradient', parent: 'sltGradientEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGradientEnabled },
    { id: 'sltGradientEndColor', label: 'Upcoming colour', type: 'color', section: 'Translation gradient', parent: 'sltGradientEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGradientEnabled },
    { id: 'sltGradientDirection', label: 'Sweep direction', type: 'dropdown', section: 'Translation gradient', parent: 'sltGradientEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGradientEnabled, options: [
        { value: 'auto', text: 'Follow Spicy Lyrics' },
        { value: 'horizontal', text: 'Horizontal' },
        { value: 'vertical', text: 'Vertical' },
        { value: 'diagonal', text: 'Diagonal' },
        { value: 'custom', text: 'Custom angle' },
    ], keywords: 'translation angle direction sweep fill' },
    { id: 'sltGradientAngle', label: 'Sweep angle', type: 'slider', section: 'Translation gradient', min: 0, max: 360, step: 5, unit: '°', parent: 'sltGradientEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGradientEnabled && t.sltGradientDirection === 'custom', keywords: 'translation degrees rotation' },
    { id: 'sltGradientFeather', label: 'Fill softness', type: 'slider', section: 'Translation gradient', min: 0, max: 60, step: 1, unit: '%', parent: 'sltGradientEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGradientEnabled, keywords: 'translation blend fade edge feather' },

    { id: 'sltFontFamily', label: 'Font', type: 'dropdown', section: 'Translation typography', options: [...TRANSLATION_FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation typeface family' },
    { id: 'sltFontFamily', label: 'Custom font name', type: 'text', section: 'Translation typography', placeholder: "e.g. 'Inter', sans-serif", when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltFontFamily !== '' && !TRANSLATION_FONT_OPTIONS.some(o => o.value === t.sltFontFamily) },
    { id: 'sltFontWeight', label: 'Weight', type: 'dropdown', section: 'Translation typography', options: WEIGHT_OPTIONS, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation bold thin' },
    { id: 'sltActiveLineWeight', label: 'Active line weight', type: 'dropdown', section: 'Translation typography', options: [{ value: '0', text: 'Same as above' }, ...WEIGHT_OPTIONS], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation bold emphasis active' },
    { id: 'sltTextTransform', label: 'Capitalisation', type: 'dropdown', section: 'Translation typography', options: [
        { value: 'none', text: 'As written' },
        { value: 'uppercase', text: 'UPPERCASE' },
        { value: 'lowercase', text: 'lowercase' },
        { value: 'capitalize', text: 'Title Case' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation uppercase lowercase caps case' },
    { id: 'sltFontStyle', label: 'Style', type: 'dropdown', section: 'Translation typography', options: [
        { value: 'normal', text: 'Upright' },
        { value: 'italic', text: 'Italic' },
        { value: 'oblique', text: 'Oblique (slanted)' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation italic slant oblique' },
    { id: 'sltLyricsScale', label: 'Text size', type: 'slider', section: 'Translation typography', min: 0.25, max: 2.0, step: 0.05, unit: 'x', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation scale bigger smaller font size' },
    { id: 'sltLetterSpacing', label: 'Letter spacing', type: 'slider', section: 'Translation typography', min: -0.1, max: 0.3, step: 0.01, unit: 'em', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation tracking kerning' },
    { id: 'sltWordSpacing', label: 'Word spacing', type: 'slider', section: 'Translation typography', min: -0.1, max: 1.0, step: 0.02, unit: 'em', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation gap space between words' },
    { id: 'sltLineHeight', label: 'Line spacing', type: 'slider', section: 'Translation typography', min: 1.0, max: 2.5, step: 0.01, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation leading gap' },
    { id: 'sltTextAlign', label: 'Alignment', type: 'dropdown', section: 'Translation typography', options: [
        { value: 'default', text: 'Follow Spicy Lyrics' },
        { value: 'left', text: 'Left' },
        { value: 'center', text: 'Centre' },
        { value: 'right', text: 'Right' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation align left right centre' },
    { id: 'sltMaxLineWidth', label: 'Max line width', type: 'slider', section: 'Translation typography', min: 0, max: 100, step: 5, unit: '%', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation measure wrap width column' },

    { id: 'sltGlowEnabled', label: 'Line glow', type: 'toggle', section: 'Translation glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Adds a soft halo around every translated line.', keywords: 'translation halo neon shine bloom' },
    { id: 'sltActiveGlowColor', label: 'Active line colour', type: 'color', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltActiveGlowIntensity', label: 'Active line strength', type: 'slider', section: 'Translation glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltInactiveGlowColor', label: 'Other lines colour', type: 'color', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltGlowIntensity', label: 'Other lines strength', type: 'slider', section: 'Translation glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltGlowPulse', label: 'Pulse the active line', type: 'toggle', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled, keywords: 'translation breathe pulse animate' },
    { id: 'sltGlowPulseSpeed', label: 'Pulse speed', type: 'slider', section: 'Translation glow', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'sltGlowPulse', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled && t.sltGlowPulse },
    { id: 'sltBgGlowEnabled', label: 'Active word glow', type: 'toggle', section: 'Translation glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Lights up only the translated word being sung right now.', keywords: 'translation karaoke halo neon' },
    { id: 'sltBgGlowColor', label: 'Word glow colour', type: 'color', section: 'Translation glow', parent: 'sltBgGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBgGlowEnabled },
    { id: 'sltBgGlowIntensity', label: 'Word glow strength', type: 'slider', section: 'Translation glow', min: 0, max: 30, step: 1, unit: 'px', parent: 'sltBgGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBgGlowEnabled },
    { id: 'sltTextShadowEnabled', label: 'Text shadow', type: 'toggle', section: 'Translation glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation drop shadow outline readability' },
    { id: 'sltTextShadowColor', label: 'Shadow colour', type: 'color', section: 'Translation glow', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOpacity', label: 'Shadow opacity', type: 'slider', section: 'Translation glow', min: 0, max: 1, step: 0.05, parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowBlur', label: 'Shadow blur', type: 'slider', section: 'Translation glow', min: 0, max: 20, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOffsetX', label: 'Shadow offset X', type: 'slider', section: 'Translation glow', min: -10, max: 10, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOffsetY', label: 'Shadow offset Y', type: 'slider', section: 'Translation glow', min: -10, max: 10, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextStrokeEnabled', label: 'Text outline', type: 'toggle', section: 'Translation glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation stroke border outline edge' },
    { id: 'sltTextStrokeColor', label: 'Outline colour', type: 'color', section: 'Translation glow', parent: 'sltTextStrokeEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextStrokeEnabled },
    { id: 'sltTextStrokeWidth', label: 'Outline width', type: 'slider', section: 'Translation glow', min: 0, max: 3, step: 0.1, unit: 'px', parent: 'sltTextStrokeEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextStrokeEnabled },

    { id: 'sltBlurUnsung', label: 'Blur other lines', type: 'toggle', section: 'Translation focus', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Softens every translated line except the one being sung.', keywords: 'translation depth of field defocus soft' },
    { id: 'sltBlurAmount', label: 'Blur amount', type: 'slider', section: 'Translation focus', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'sltBlurUnsung', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurUnsung },
    { id: 'sltBlurSungWords', label: 'Fade words as they pass', type: 'toggle', section: 'Translation focus', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Blurs each translated word once it has been sung.', keywords: 'translation karaoke word blur trail' },
    { id: 'sltBlurSungWordsAmount', label: 'Word blur amount', type: 'slider', section: 'Translation focus', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'sltBlurSungWords', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurSungWords },
    { id: 'sltBlurSungWordsOpacity', label: 'Word opacity', type: 'slider', section: 'Translation focus', min: 0.05, max: 1.0, step: 0.05, parent: 'sltBlurSungWords', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurSungWords },

    { id: 'sltDisableHighlight', label: 'Flat colour mode', type: 'toggle', section: 'Translation motion', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Turns off the sweeping fill on translations — every translated line uses one solid colour.', keywords: 'translation no karaoke disable highlight solid' },
    { id: 'sltHighlightColor', label: 'Flat colour', type: 'color', section: 'Translation motion', parent: 'sltDisableHighlight', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltDisableHighlight },
    { id: 'sltWordEffect', label: 'Word animation', type: 'dropdown', section: 'Translation motion', options: WORD_EFFECT_OPTIONS, when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Animates individual words in the active translation.', keywords: 'translation bounce pop wave stamp shake glitch rise sway animate word' },
    { id: 'sltWordEffectTrigger', label: 'Fires', type: 'dropdown', section: 'Translation motion', options: [
        { value: 'auto', text: 'Recommended for this animation' },
        { value: 'word', text: 'As each word is sung' },
        { value: 'line', text: 'When the line starts' },
        { value: 'loop', text: 'Continuously' },
    ], parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation trigger timing sync' },
    { id: 'sltWordEffectIntensity', label: 'Intensity', type: 'slider', section: 'Translation motion', min: 0.1, max: 2.0, step: 0.05, unit: 'x', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation strength amount' },
    { id: 'sltWordEffectSpeed', label: 'Speed', type: 'slider', section: 'Translation motion', min: 0.3, max: 3.0, step: 0.05, unit: 'x', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation duration fast slow' },
    { id: 'sltWordEffectStagger', label: 'Stagger between words', type: 'slider', section: 'Translation motion', min: 0, max: 150, step: 5, unit: 'ms', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none' && resolveWordTrigger(t.sltWordEffect, t.sltWordEffectTrigger) !== 'word', keywords: 'translation delay ripple cascade' },
    { id: 'sltScaleActive', label: 'Active line zoom', type: 'slider', section: 'Translation motion', min: 0.95, max: 1.12, step: 0.01, unit: 'x', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation scale grow size' },
    { id: 'sltScaleInEffect', label: 'Zoom in on arrival', type: 'toggle', section: 'Translation motion', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation scale in entrance animate' },
    { id: 'sltScaleInFrom', label: 'Starting scale', type: 'slider', section: 'Translation motion', min: 0.85, max: 1.05, step: 0.01, unit: 'x', parent: 'sltScaleInEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltScaleInEffect },
    { id: 'sltScaleInDuration', label: 'Zoom duration', type: 'slider', section: 'Translation motion', min: 0.1, max: 1.0, step: 0.05, unit: 's', parent: 'sltScaleInEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltScaleInEffect },
    { id: 'sltAnimationSpeed', label: 'Overall animation speed', type: 'slider', section: 'Translation motion', min: 0.3, max: 3.0, step: 0.1, unit: 'x', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Scales every translation transition. Higher is snappier.', keywords: 'translation transition tempo fast slow' },
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
        baseline = { name: 'default', config: mergeThemeConfig(BUILTIN_PRESETS[0].config) };
        return;
    }
    if (!themeState.activeBasePreset) {
        const exact = getAllPresets().find(p => changedFieldCount(p.config) === 0);
        if (exact) {
            themeState.activeBasePreset = exact.name;
            saveThemeState();
        }
    }
    const match = getAllPresets().find(p => p.name === activeBaseName());
    if (match) baseline = { name: match.name, config: match.config };
}

function changedFieldCount(config: ThemeConfig): number {
    const changed = new Set<keyof ThemeConfig>();
    SCHEMA.forEach(d => {
        if (themeState.activeTheme[d.id] !== config[d.id]) changed.add(d.id);
    });
    return changed.size;
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
    toast({ kind: isError ? 'error' : 'success', title: message });
}

function snapshotState(): () => void {
    const saved = {
        activeTheme: { ...themeState.activeTheme },
        activePresetName: themeState.activePresetName,
        customPresets: JSON.parse(JSON.stringify(themeState.customPresets)) as ThemePreset[],
        isEnabled: themeState.isEnabled,
        activeBasePreset: themeState.activeBasePreset,
        activeSourceId: themeState.activeSourceId,
        activeSourceVersion: themeState.activeSourceVersion,
        activeSourceName: themeState.activeSourceName,
        activeSourceFingerprint: themeState.activeSourceFingerprint,
    };
    const savedBaseline = baseline;
    return () => {
        themeState.activeTheme = { ...saved.activeTheme };
        themeState.activePresetName = saved.activePresetName;
        themeState.customPresets = JSON.parse(JSON.stringify(saved.customPresets));
        themeState.isEnabled = saved.isEnabled;
        themeState.activeBasePreset = saved.activeBasePreset;
        themeState.activeSourceId = saved.activeSourceId;
        themeState.activeSourceVersion = saved.activeSourceVersion;
        themeState.activeSourceName = saved.activeSourceName;
        themeState.activeSourceFingerprint = saved.activeSourceFingerprint;
        saveThemeState();
        baseline = savedBaseline;
        injectThemeStyles();
        rerenderLive?.();
    };
}

function undoable(title: string, description: string | undefined, mutate: () => void): void {
    const restore = snapshotState();
    mutate();
    offerUndo(title, description, restore);
}

function offerUndo(title: string, description: string | undefined, restore: () => void): void {
    toast({
        kind: 'success',
        key: 'st-undo',
        title,
        description,
        duration: 8000,
        undo: () => {
            restore();
            toast({ kind: 'info', key: 'st-undo', title: 'Undone', description: 'Everything is back the way it was.' });
        },
    });
}

let rerenderLive: (() => void) | null = null;

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

    const shadowFilter = t.textShadowEnabled
        ? (() => {
            const c = hexToRgb(t.textShadowColor);
            return `drop-shadow(${t.textShadowOffsetX}px ${t.textShadowOffsetY}px ${t.textShadowBlur}px rgba(${c.r}, ${c.g}, ${c.b}, ${t.textShadowOpacity}))`;
        })()
        : '';

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
        line.style.filter = shadowFilter;
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
            unsung.style.filter = [`blur(${t.blurAmount}px)`, shadowFilter].filter(Boolean).join(' ');
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.glowColor);
            const existing = unsung.style.textShadow;
            const sh = `0 0 ${t.glowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.45)`;
            unsung.style.textShadow = existing ? `${existing}, ${sh}` : sh;
        }
    }

    const imageId = t.pageBgImageEnabled ? t.pageBgImage : '';
    const imageUrl = imageId ? getCachedBackgroundUrl(imageId) : null;
    if (imageId && !imageUrl) {
        getBackgroundImageUrl(imageId).then(url => {
            if (url && host.isConnected) renderPreview(host, theme);
        });
    }

    const layers: string[] = [];
    if (t.pageBgOverlay) {
        const c = hexToRgb(t.pageBgColor);
        const tint = `rgba(${c.r}, ${c.g}, ${c.b}, ${t.pageBgOpacity})`;
        layers.push(imageUrl
            ? `linear-gradient(${tint}, ${tint})`
            : `linear-gradient(145deg, ${tint}, rgba(8, 8, 10, 0.95))`);
    }
    if (imageUrl) {
        const dim = `rgba(0, 0, 0, ${t.pageBgImageDim})`;
        layers.push(`linear-gradient(${dim}, ${dim})`);
        layers.push(`url("${imageUrl}") ${bgImagePosition(t.pageBgImagePosition)} / ${bgImageSize(t.pageBgImageFit)} ${bgImageRepeat(t.pageBgImageFit)}`);
    } else if (t.animBgEnabled) {
        const [first, second] = t.animBgPalette === 'custom'
            ? [t.animBgColor, t.animBgColor2]
            : t.animBgPalette === 'spectrum' ? ['#ff4d6d', '#4cc9f0'] : ['#a78bfa', '#34d399'];
        const a = hexToRgb(first);
        const b = hexToRgb(second);
        const glow = Math.min(0.6, 0.3 + t.animBgGlow * 0.2);
        layers.push(`radial-gradient(circle at 18% 85%, rgba(${a.r}, ${a.g}, ${a.b}, ${glow}), transparent 60%)`);
        layers.push(`radial-gradient(circle at 85% 15%, rgba(${b.r}, ${b.g}, ${b.b}, ${glow}), transparent 65%)`);
        layers.push(t.animBgBackdrop === 'solid' ? t.animBgBgColor : 'rgba(8, 8, 10, 0.95)');
    }
    host.style.background = layers.join(', ');
}

function liveUpdate<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]): void {
    const wasNative = !themeState.activeTheme.lyricsStylingEnabled;
    updateThemeProperty(key, value);
    injectThemeStyles();
    const leftNative = wasNative && key !== 'lyricsStylingEnabled' && themeState.activeTheme.lyricsStylingEnabled;
    if ((key === 'sltIndependent' && value === true) || leftNative) {
        syncAllFields();
    }
    if (leftNative) {
        toast({ kind: 'info', title: 'Lyric styling turned on', description: 'Spicy Themes now styles the lyrics. Turn off “Restyle lyrics” to go back to the stock look.' });
    }
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
    liveContainer.classList.toggle('st-m-searching', searching);

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
                    if (o.hint) opt.title = o.hint;
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
                const showHint = () => { select.title = opts.find(o => o.value === select.value)?.hint || ''; };
                showHint();
                select.addEventListener('change', () => {
                    const v: any = isNumeric ? parseInt(select.value, 10) : select.value;
                    liveUpdate(def.id, v);
                    showHint();
                });
                sync = () => {
                    select.value = String(themeState.activeTheme[def.id]);
                    showHint();
                };
            }
            control.appendChild(select);
            break;
        }
        case 'image': {
            const thumb = document.createElement('div');
            thumb.className = 'st-m-image-thumb';
            const meta = document.createElement('div');
            meta.className = 'st-m-image-meta';
            const pick = document.createElement('button');
            pick.type = 'button';
            pick.className = 'st-m-btn';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'st-m-btn st-m-btn-danger';
            remove.textContent = 'Remove';
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            let busy = false;

            const paint = () => {
                const id = String(themeState.activeTheme[def.id] || '');
                pick.disabled = busy;
                pick.textContent = busy ? 'Saving…' : id ? 'Replace…' : 'Choose image…';
                remove.style.display = id && !busy ? '' : 'none';
                if (!id) {
                    thumb.style.backgroundImage = '';
                    meta.textContent = 'No image chosen';
                    meta.title = '';
                    return;
                }
                const cached = getCachedBackgroundUrl(id);
                thumb.style.backgroundImage = cached ? `url("${cached}")` : '';
                if (!cached) meta.textContent = 'Loading…';
                getBackgroundImageInfo(id).then(info => {
                    if (String(themeState.activeTheme[def.id] || '') !== id) return;
                    const url = getCachedBackgroundUrl(id);
                    thumb.style.backgroundImage = url ? `url("${url}")` : '';
                    meta.textContent = info ? `${info.name} · ${info.width}×${info.height}` : 'Image not found on this device';
                    meta.title = info ? info.name : 'This theme points at an image saved on another device. Choose one to replace it.';
                });
            };

            pick.addEventListener('click', () => input.click());
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                busy = true;
                paint();
                try {
                    const id = await saveBackgroundImage(file);
                    liveUpdate(def.id, id as any);
                    pruneBackgroundImages().catch(() => {});
                } catch (e) {
                    notify(e instanceof Error ? e.message : 'Couldn’t use that image.', true);
                } finally {
                    busy = false;
                    paint();
                }
            });
            remove.addEventListener('click', () => {
                liveUpdate(def.id, '' as any);
                pruneBackgroundImages().catch(() => {});
                paint();
            });

            control.append(thumb, meta, pick, remove, input);
            sync = paint;
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
        sections: ['Background', MUSIC_VIDEO_SECTION, VIDEO_QUALITY_SECTION, ANIM_BG_SECTION],
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
        sections: [
            'Translation',
            'Translation colours',
            'Translation gradient',
            'Translation typography',
            'Translation glow',
            'Translation focus',
            'Translation motion',
        ],
    },
];

let activeCategoryId = CZ_CATEGORIES[0].id;

const SEARCH_SVG = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"></circle><line x1="10.6" y1="10.6" x2="14" y2="14"></line></svg>';

const VIDEO_QUALITY_DEF: FieldDef = {
    id: 'musicVideoEnabled',
    label: 'Video quality',
    type: 'toggle',
    section: VIDEO_QUALITY_SECTION,
    keywords: 'music video quality premium hd 4k 1080p 1440p 720p resolution discord link account unlink',
};

const VIDEO_AUTO_DEF: FieldDef = {
    id: 'musicVideoEnabled',
    label: 'Switch to video automatically',
    type: 'toggle',
    section: MUSIC_VIDEO_SECTION,
    hint: 'Plays the track’s music video behind the lyrics whenever one is available. Otherwise, click the theme button in Spicy Lyrics to cycle Off → Theme → Video.',
    keywords: 'music video auto automatic switch clip mv youtube background synced',
};

function buildVideoAutoRow(): FieldHandle {
    const row = document.createElement('div');
    row.className = 'st-m-field st-m-field-toggle';
    const labelBox = document.createElement('div');
    labelBox.className = 'st-m-field-labelbox';
    const label = document.createElement('label');
    label.className = 'st-m-field-label';
    label.textContent = VIDEO_AUTO_DEF.label;
    const hint = document.createElement('div');
    hint.className = 'st-m-field-hint';
    hint.textContent = VIDEO_AUTO_DEF.hint || '';
    labelBox.append(label, hint);
    const control = document.createElement('div');
    control.className = 'st-m-field-control';
    const wrap = document.createElement('label');
    wrap.className = 'st-m-toggle';
    wrap.innerHTML = '<input type="checkbox"><span class="st-m-toggle-slider"></span>';
    const input = wrap.querySelector('input') as HTMLInputElement;
    input.checked = themeState.videoAuto;
    input.addEventListener('change', () => {
        setVideoAuto(input.checked);
        injectThemeStyles();
    });
    control.appendChild(wrap);
    row.append(labelBox, control);
    return { row, def: VIDEO_AUTO_DEF, sync: () => { input.checked = themeState.videoAuto; }, refreshReset: () => {} };
}

function buildVideoQualitySection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'st-m-section';
    section.dataset.section = VIDEO_QUALITY_SECTION;
    const header = document.createElement('div');
    header.className = 'st-m-section-title';
    header.textContent = VIDEO_QUALITY_SECTION;
    section.appendChild(header);

    const panel = buildVideoQualityPanel();
    const row = panel.root;
    if (VIDEO_QUALITY_DEF.when) row.style.display = VIDEO_QUALITY_DEF.when(themeState.activeTheme) ? '' : 'none';
    section.appendChild(row);
    czFields.push({ row, def: VIDEO_QUALITY_DEF, sync: panel.sync, refreshReset: () => {} });
    return section;
}

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
        <input type="text" class="st-m-text st-m-cz-search" placeholder="Filter this page…" spellcheck="false" aria-label="Filter settings" data-st-esc-local>
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

    sectionEls.set(VIDEO_QUALITY_SECTION, buildVideoQualitySection());

    const videoSection = sectionEls.get(MUSIC_VIDEO_SECTION);
    if (videoSection) {
        const auto = buildVideoAutoRow();
        videoSection.querySelector('.st-m-section-title')?.after(auto.row);
        czFields.push(auto);
    }

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
    });

    sectionEls.forEach((el, name) => {
        if (!CZ_CATEGORIES.some(c => c.sections.includes(name))) sectionsCol.appendChild(el);
    });

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
    const baseName = activeBaseName();
    all.forEach(preset => {
        const isBase = preset.name === baseName;
        const tweaks = isBase ? changedFieldCount(preset.config) : 0;
        const isActive = isBase && tweaks === 0;
        const isModified = isBase && tweaks > 0;

        const card = document.createElement('div');
        card.className = `st-m-preset-card${isActive ? ' active' : ''}${isModified ? ' modified' : ''}`;
        card.title = preset.description;

        const preview = document.createElement('div');
        preview.className = 'st-m-preset-preview';
        renderPreview(preview, preset.config);

        const meta = document.createElement('div');
        meta.className = 'st-m-preset-meta';
        const isCustom = !BUILTIN_PRESETS.some(b => b.name === preset.name);
        const update = presetUpdate(preset);
        meta.innerHTML = `
            <div class="st-m-preset-name">${escapeHtml(preset.name)}${preset.badge ? ` <span class="st-m-preset-tag st-m-preset-tag-seasonal">${escapeHtml(preset.badge)}</span>` : ''}${isCustom ? ' <span class="st-m-preset-tag">custom</span>' : ''}${update ? ' <span class="st-m-preset-tag st-m-preset-tag-update">update</span>' : ''}${isModified ? ' <span class="st-m-preset-tag st-m-preset-tag-modified">modified</span>' : ''}</div>
            <div class="st-m-preset-desc">${escapeHtml(preset.description || '')}</div>
            ${isModified ? `<div class="st-m-preset-note st-m-preset-note-edit">${tweaks} unsaved tweak${tweaks === 1 ? '' : 's'}</div>` : ''}
            ${preset.sourceRemoved ? '<div class="st-m-preset-note">No longer on the Marketplace</div>' : ''}
        `;

        const actions = document.createElement('div');
        actions.className = 'st-m-preset-actions';

        if (update) {
            const updateBtn = document.createElement('button');
            updateBtn.type = 'button';
            updateBtn.className = 'st-m-btn st-m-btn-update';
            updateBtn.textContent = 'Update available';
            updateBtn.title = `Version ${update.version} is on the Marketplace`;
            updateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const replaced = presetHasLocalChanges(preset);
                const restore = snapshotState();
                updateBtn.disabled = true;
                updateBtn.textContent = 'Updating…';
                try {
                    const name = await updatePresetFromSource(preset);
                    refresh();
                    offerUndo(`Updated “${name}”`, replaced ? 'Your edits were replaced by the new version.' : `Now on version ${update.version}.`, restore);
                } catch (err) {
                    notify(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
                    updateBtn.disabled = false;
                    updateBtn.textContent = 'Update available';
                }
            });
            actions.appendChild(updateBtn);
        }

        const differs = isCustom ? changedFieldCount(preset.config) : 0;
        if (isCustom && differs > 0) {
            const overwrite = document.createElement('button');
            overwrite.type = 'button';
            overwrite.className = `st-m-btn${isModified ? ' st-m-btn-primary' : ''}`;
            overwrite.textContent = isModified ? 'Save changes' : 'Overwrite';
            overwrite.title = isModified
                ? `Save your ${differs} tweak${differs === 1 ? '' : 's'} into "${preset.name}"`
                : `Replace "${preset.name}" with the theme you have now`;
            overwrite.addEventListener('click', (e) => {
                e.stopPropagation();
                undoable(
                    isModified ? `Saved your changes to “${preset.name}”` : `Overwrote “${preset.name}”`,
                    `${differs} setting${differs === 1 ? '' : 's'} changed in the preset.`,
                    () => {
                        saveCustomPreset(preset.name, preset.description);
                        resolveBaseline();
                        refresh();
                    },
                );
            });
            actions.appendChild(overwrite);
        }

        const apply = document.createElement('button');
        apply.className = `st-m-btn${isModified && isCustom ? '' : ' st-m-btn-primary'}`;
        apply.textContent = isActive ? 'Active' : isModified ? 'Revert' : 'Apply';
        apply.disabled = isActive;
        if (isModified) apply.title = `Discard your ${tweaks} tweak${tweaks === 1 ? '' : 's'} and go back to "${preset.name}"`;
        apply.addEventListener('click', () => {
            undoable(
                isModified ? `Reverted to “${preset.name}”` : `Applied “${preset.name}”`,
                isModified ? `${tweaks} tweak${tweaks === 1 ? '' : 's'} discarded.` : undefined,
                () => {
                    applyPreset(preset);
                    resolveBaseline();
                    injectThemeStyles();
                    refresh();
                },
            );
        });
        actions.appendChild(apply);

        if (isCustom) {
            const del = document.createElement('button');
            del.className = 'st-m-btn st-m-btn-danger';
            del.textContent = 'Delete';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                undoable(`Deleted “${preset.name}”`, undefined, () => {
                    deleteCustomPreset(preset.name, preset.sourceId);
                    resolveBaseline();
                    refresh();
                });
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
        <div class="st-m-section-title">Save current theme as a new preset</div>
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
        const overwrites = themeState.customPresets.some(p => p.name === name);
        undoable(overwrites ? `Overwrote “${name}”` : `Saved “${name}”`, 'You can find it in your presets.', () => {
            saveCustomPreset(name, descInput.value.trim());
            resolveBaseline();
            refresh();
        });
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
                <input type="text" class="st-m-mp-search" placeholder="Search themes, authors…" spellcheck="false" data-st-esc-local>
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
                apply.textContent = 'Downloading…';
                const restore = snapshotState();
                try {
                    const { config, source, meta } = await downloadThemeWithSource(t.id);
                    const name = source.name || t.name;
                    const preset: ThemePreset = {
                        name,
                        description: meta?.description || t.description || `By ${t.author}`,
                        config,
                        sourceId: source.id,
                        sourceVersion: source.version,
                        sourceName: name,
                        sourceFingerprint: source.fingerprint,
                    };
                    upsertCustomPreset(preset);
                    applyPreset(preset);
                    baseline = { name, config: { ...themeState.activeTheme } };
                    injectThemeStyles();
                    refresh();
                    offerUndo(`Applied “${name}”`, `By ${t.author}. Saved to your presets.`, restore);
                } catch (e) {
                    notify(`Failed to apply: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                    apply.disabled = false;
                    apply.textContent = 'Apply';
                }
            });

            actions.appendChild(apply);

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
                <button class="st-m-btn" id="st-m-changelog">Show changelog</button>
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
            presetName: activeBaseName(),
            source: themeState.activeSourceId
                ? {
                    id: themeState.activeSourceId,
                    version: themeState.activeSourceVersion,
                    name: themeState.activeSourceName,
                    fingerprint: themeState.activeSourceFingerprint,
                }
                : undefined,
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
                    const restore = snapshotState();
                    if (data.theme) {
                        themeState.activeTheme = mergeThemeConfig(data.theme);
                        setActiveSource(sanitizeThemeSource(data.source));
                    }
                    if (Array.isArray(data.presets)) {
                        themeState.customPresets = sanitizeCustomPresets(data.presets);
                    }
                    if (data.presetName) {
                        themeState.activePresetName = data.presetName;
                        themeState.activeBasePreset = data.presetName;
                    } else {
                        themeState.activeBasePreset = undefined;
                    }
                    saveThemeState();
                    resolveBaseline();
                    injectThemeStyles();
                    rerenderLive?.();
                    offerUndo('Theme imported', file.name, restore);
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
        undoable('Reset to Default', 'Your custom presets were kept.', () => {
            applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
            resolveBaseline();
            injectThemeStyles();
            rerenderLive?.();
        });
    });

    const changelogBtn = tab.querySelector('#st-m-changelog') as HTMLButtonElement;
    changelogBtn.addEventListener('click', async () => {
        if (changelogBtn.disabled) return;
        changelogBtn.disabled = true;
        changelogBtn.textContent = 'Loading changelog…';
        try {
            await showCurrentChangelog({ expanded: true });
        } catch {
            notify('Could not load the changelog', true);
        } finally {
            changelogBtn.disabled = false;
            changelogBtn.textContent = 'Show changelog';
        }
    });

    const checkBtn = tab.querySelector('#st-m-check') as HTMLButtonElement;
    checkBtn.addEventListener('click', () => {
        runManualUpdateCheck(checkBtn);
    });

    return tab;
}

interface EnabledGroup {
    label: string;
    icon: string;
    items: string[];
}

function collectEnabledFeatures(): EnabledGroup[] {
    const theme = themeState.activeTheme;
    const sectionCategory = new Map<string, CzCategory>();
    CZ_CATEGORIES.forEach(cat => cat.sections.forEach(section => sectionCategory.set(section, cat)));

    const buckets = new Map<string, string[]>();
    const add = (section: string, label: string) => {
        const key = sectionCategory.get(section)?.id || 'cz-other';
        const bucket = buckets.get(key);
        if (bucket) bucket.push(label);
        else buckets.set(key, [label]);
    };

    SCHEMA.forEach(def => {
        if (def.comingSoon) return;
        if (def.when && !def.when(theme)) return;
        if (def.type === 'toggle') {
            if (theme[def.id] === true) add(def.section, def.label);
            return;
        }
        if (def.id === 'wordEffect') {
            const value = String(theme.wordEffect || 'none');
            if (value === 'none') return;
            const option = (def.options || []).find(o => o.value === value);
            add(def.section, `${def.label}: ${option ? option.text : value}`);
        }
    });

    const groups: EnabledGroup[] = [];
    CZ_CATEGORIES.forEach(cat => {
        const items = buckets.get(cat.id);
        if (items && items.length) groups.push({ label: cat.label, icon: cat.icon, items });
    });
    const rest = buckets.get('cz-other');
    if (rest && rest.length) groups.push({ label: 'Other', icon: '•', items: rest });
    return groups;
}

let enabledTip: HTMLElement | null = null;
let enabledTipCleanup: (() => void) | null = null;
let enabledTipTimer: ReturnType<typeof setTimeout> | null = null;

function cancelEnabledTipHide(): void {
    if (!enabledTipTimer) return;
    clearTimeout(enabledTipTimer);
    enabledTipTimer = null;
}

function hideEnabledTip(): void {
    cancelEnabledTipHide();
    if (enabledTipCleanup) {
        enabledTipCleanup();
        enabledTipCleanup = null;
    }
    if (enabledTip) {
        enabledTip.remove();
        enabledTip = null;
    }
}

function hideEnabledTipSoon(): void {
    cancelEnabledTipHide();
    enabledTipTimer = setTimeout(hideEnabledTip, 140);
}

function positionEnabledTip(tip: HTMLElement, anchor: HTMLElement): void {
    const a = anchor.getBoundingClientRect();
    const side = anchor.closest('.st-m-side')?.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const margin = 8;

    let left = side ? side.right + 10 : a.left;
    let top = side ? a.top - 14 : a.bottom + 6;
    if (left + t.width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - t.width - margin);
        top = a.bottom + 6;
    }
    if (top + t.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - t.height - margin);

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
}

function showEnabledTip(anchor: HTMLElement): void {
    hideEnabledTip();

    const tip = document.createElement('div');
    tip.className = 'st-m-enabled-tip';
    tip.setAttribute('role', 'tooltip');
    paintTone(tip, 'accent');

    if (!themeState.isEnabled) {
        tip.innerHTML = `
            <div class="st-m-enabled-tip-head">Styling is off</div>
            <div class="st-m-enabled-tip-empty">Spicy Lyrics is showing its stock look. Your settings are kept.</div>
        `;
    } else {
        const groups = collectEnabledFeatures();
        const total = groups.reduce((sum, g) => sum + g.items.length, 0);
        if (!total) {
            tip.innerHTML = `
                <div class="st-m-enabled-tip-head">No effects on</div>
                <div class="st-m-enabled-tip-empty">Only colours, fonts and sizes are in play.</div>
            `;
        } else {
            tip.innerHTML = `
                <div class="st-m-enabled-tip-head">${total} effect${total === 1 ? '' : 's'} on</div>
                ${groups.map(group => `
                    <div class="st-m-enabled-tip-group">
                        <div class="st-m-enabled-tip-cat">${escapeHtml(group.label)}</div>
                        <div class="st-m-enabled-tip-list">${group.items.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
                    </div>
                `).join('')}
            `;
        }
    }

    tip.addEventListener('mouseenter', cancelEnabledTipHide);
    tip.addEventListener('mouseleave', hideEnabledTipSoon);

    document.body.appendChild(tip);
    enabledTip = tip;
    positionEnabledTip(tip, anchor);

    const dismiss = () => hideEnabledTip();
    const onPointerDown = (event: Event) => {
        if (enabledTip && event.target instanceof Node && enabledTip.contains(event.target)) return;
        hideEnabledTip();
    };
    const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') hideEnabledTip();
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    enabledTipCleanup = () => {
        window.removeEventListener('resize', dismiss);
        window.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKey, true);
    };
}


function buildMasterBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'st-m-enabled-bar';
    bar.innerHTML = `
        <div class="st-m-enabled-text">
            <div class="st-m-enabled-title">Styling</div>
            <div class="st-m-enabled-sub"></div>
        </div>
        <label class="st-m-toggle" title="Turn all Spicy Themes styling on or off">
            <input type="checkbox" aria-label="Enable Spicy Themes">
            <span class="st-m-toggle-slider"></span>
        </label>
    `;

    const title = bar.querySelector('.st-m-enabled-title') as HTMLElement;
    const sub = bar.querySelector('.st-m-enabled-sub') as HTMLElement;
    const input = bar.querySelector('input') as HTMLInputElement;

    sub.tabIndex = 0;
    sub.addEventListener('mouseenter', () => {
        cancelEnabledTipHide();
        if (!enabledTip) showEnabledTip(sub);
    });
    sub.addEventListener('mouseleave', hideEnabledTipSoon);
    sub.addEventListener('focus', () => showEnabledTip(sub));
    sub.addEventListener('blur', hideEnabledTip);

    const sync = () => {
        input.checked = themeState.isEnabled;
        bar.classList.toggle('st-m-enabled-off', !themeState.isEnabled);
        title.textContent = themeState.isEnabled ? 'Styling on' : 'Styling off';
        const base = baseline.name === 'default' ? 'Default' : baseline.name;
        sub.textContent = themeState.isEnabled ? `Based on “${base}”` : 'Spicy Lyrics looks stock';
        if (enabledTip) showEnabledTip(sub);
    };

    input.addEventListener('change', () => {
        themeState.isEnabled = input.checked;
        saveThemeState();
        injectThemeStyles();
        sync();
    });

    syncChrome.push(sync);
    sync();
    return bar;
}

function buildUpdateBanner(onChange: () => void): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'st-m-update-banner';

    const sync = () => {
        const update = activeThemeUpdate();
        banner.innerHTML = '';
        if (!update) {
            banner.style.display = 'none';
            return;
        }
        banner.style.display = '';

        const label = themeState.activeSourceName || themeState.activePresetName;
        const text = document.createElement('div');
        text.className = 'st-m-update-banner-text';
        text.textContent = `“${label}” has a new version on the Marketplace`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-m-btn st-m-btn-primary';
        btn.textContent = 'Update theme';
        btn.addEventListener('click', async () => {
            const replaced = activeThemeHasLocalChanges();
            const restore = snapshotState();
            btn.disabled = true;
            btn.textContent = 'Updating…';
            try {
                const name = await updateActiveThemeFromSource();
                resolveBaseline();
                injectThemeStyles();
                onChange();
                offerUndo(`Updated “${name}”`, replaced ? 'Your edits were replaced by the new version.' : `Now on version ${update.version}.`, restore);
            } catch (e) {
                notify(`Update failed: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                btn.disabled = false;
                btn.textContent = 'Update theme';
            }
        });

        banner.appendChild(text);
        banner.appendChild(btn);
    };

    syncChrome.push(sync);
    sync();
    return banner;
}

export type TabId = 'customize' | 'presets' | 'marketplace' | 'about';

const TAB_META: Record<TabId, { label: string; description: string }> = {
    customize: { label: 'Customize', description: 'Every part of how the lyrics look and move.' },
    presets: { label: 'Presets', description: 'Built-in looks and the ones you saved.' },
    marketplace: { label: 'Marketplace', description: 'Themes shared by the community.' },
    about: { label: 'About', description: 'Version, updates and your configuration.' },
};

let activeTabId: TabId = 'customize';
let goToLive: ((tab: TabId, category?: string) => void) | null = null;

const EYE_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
const BELL_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M4 11V7a4 4 0 118 0v4l1.2 1.5H2.8zM6.5 13.5a1.6 1.6 0 003 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const DIFF_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M5 2.5v7M1.5 6h7M9 11.5h5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function dedupedSchema(): FieldDef[] {
    const seen = new Set<keyof ThemeConfig>();
    return SCHEMA.filter(d => {
        if (d.comingSoon || seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    });
}

function categoryOf(def: FieldDef): CzCategory | undefined {
    return CZ_CATEGORIES.find(c => c.sections.includes(def.section));
}

function whereLabel(def: FieldDef): string {
    const cat = categoryOf(def);
    if (!cat || cat.label === def.section) return def.section;
    return `${cat.label} · ${def.section}`;
}

export function settingById(id: string): { id: string; label: string } | null {
    const def = SCHEMA.find(d => d.id === id && !d.comingSoon);
    return def ? { id: def.id, label: def.label } : null;
}

const GENERIC_LABELS = new Set(['enabled', 'opacity', 'intensity', 'color', 'colour', 'amount', 'style', 'speed', 'size']);

export function matchSettingInText(input: string): { id: string; label: string } | null {
    const haystack = ` ${input.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `;
    let best: FieldDef | null = null;
    dedupedSchema().forEach(def => {
        const label = def.label.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
        if (label.length < 7 || !label.includes(' ') || GENERIC_LABELS.has(label)) return;
        if (!haystack.includes(` ${label} `)) return;
        if (!best || label.length > best.label.length) best = def;
    });
    const found = best as FieldDef | null;
    return found ? { id: found.id, label: found.label } : null;
}

export function isSettingsOpen(): boolean {
    return !!liveContainer && liveContainer.isConnected;
}

export function goToSettings(tab: TabId, category?: string): void {
    goToLive?.(tab, category);
}

export function revealSetting(id: string): void {
    if (!liveContainer || !goToLive) return;
    const index = SCHEMA.findIndex(d => d.id === id);
    if (index < 0) return;
    let def = SCHEMA[index];
    goToLive('customize', categoryOf(def)?.id);
    let row = liveContainer.querySelector<HTMLElement>(`.st-m-field[data-st-idx="${index}"]`);
    while (row && row.style.display === 'none' && def.parent) {
        const parentIndex = SCHEMA.findIndex(d => d.id === def.parent);
        if (parentIndex < 0) break;
        def = SCHEMA[parentIndex];
        row = liveContainer.querySelector<HTMLElement>(`.st-m-field[data-st-idx="${parentIndex}"]`);
    }
    if (!row) return;
    const target = row;
    target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    target.classList.remove('st-m-spot');
    void target.offsetWidth;
    target.classList.add('st-m-spot');
    window.setTimeout(() => target.classList.remove('st-m-spot'), 2400);
    const control = target.querySelector<HTMLElement>('input, select, button:not(.st-m-field-reset)');
    control?.focus({ preventScroll: true });
}

function describeValue(def: FieldDef, value: unknown): HTMLElement {
    const node = el('span', { class: 'st-m-rv-value' });
    if (def.type === 'color') {
        const swatch = el('span', { class: 'st-m-rv-swatch' });
        swatch.style.background = String(value || 'transparent');
        node.append(swatch, String(value || '—'));
        return node;
    }
    if (def.type === 'toggle') {
        node.textContent = value ? 'On' : 'Off';
        return node;
    }
    if (def.type === 'dropdown') {
        const option = (def.options || []).find(o => o.value === value);
        node.textContent = option ? option.text : String(value || '—');
        return node;
    }
    if (def.type === 'image') {
        node.textContent = value ? 'Custom image' : 'None';
        return node;
    }
    if (def.type === 'slider') {
        node.textContent = formatFieldValue(value, def.unit || '');
        return node;
    }
    const str = String(value ?? '');
    node.textContent = str ? (str.length > 28 ? `${str.slice(0, 27)}…` : str) : '—';
    return node;
}

function changedDefs(): FieldDef[] {
    return dedupedSchema().filter(d => themeState.activeTheme[d.id] !== baseline.config[d.id]);
}

function openReviewChanges(): void {
    const list = el('div', { class: 'st-m-rv-list' });
    const summary = el('p', { class: 'st-ui-text' });
    let dialog: SurfaceHandle | null = null;

    const render = () => {
        const defs = changedDefs();
        const base = baseline.name === 'default' ? 'Default' : baseline.name;
        list.innerHTML = '';
        summary.textContent = defs.length
            ? `${defs.length} setting${defs.length === 1 ? ' differs' : 's differ'} from “${base}”.`
            : `Nothing differs from “${base}” right now.`;
        defs.forEach(def => {
            const row = el('div', { class: 'st-m-rv-row' },
                el('div', { class: 'st-m-rv-head' },
                    el('button', { class: 'st-m-rv-label', type: 'button', text: def.label, title: 'Show this setting' }),
                    el('span', { class: 'st-m-rv-where', text: whereLabel(def) }),
                ),
                el('div', { class: 'st-m-rv-diff' },
                    describeValue(def, baseline.config[def.id]),
                    el('span', { class: 'st-m-rv-arrow', 'aria-hidden': 'true' }),
                    describeValue(def, themeState.activeTheme[def.id]),
                ),
                el('button', { class: 'st-m-btn st-m-rv-revert', type: 'button', text: 'Revert' }),
            );
            row.querySelector('.st-m-rv-label')?.addEventListener('click', () => {
                dialog?.close();
                revealSetting(def.id);
            });
            row.querySelector('.st-m-rv-revert')?.addEventListener('click', () => {
                const before = themeState.activeTheme[def.id];
                liveUpdate(def.id, baseline.config[def.id]);
                syncAllFields();
                render();
                toast({
                    kind: 'success',
                    key: 'st-undo',
                    title: `Reverted “${def.label}”`,
                    duration: 6000,
                    undo: () => {
                        liveUpdate(def.id, before as any);
                        syncAllFields();
                        if (dialog && !dialog.closed) render();
                    },
                });
            });
            list.append(row);
        });
        list.hidden = defs.length === 0;
        const revertAll = dialog?.footer.querySelector('[data-action="revert-all"]') as HTMLButtonElement | null;
        if (revertAll) revertAll.disabled = defs.length === 0;
    };

    dialog = openDialog({
        eyebrow: 'Spicy Themes · Review',
        title: 'Your changes',
        size: 'lg',
        body: [summary, list],
        actions: [
            {
                id: 'reset-default',
                label: 'Reset everything',
                kind: 'danger',
                onClick: () => undoable('Everything reset to Default', 'Your custom presets were kept.', () => {
                    applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
                    resolveBaseline();
                    injectThemeStyles();
                    rerenderLive?.();
                }),
            },
            {
                id: 'save-preset',
                label: 'Save as preset',
                kind: 'quiet',
                onClick: () => {
                    goToLive?.('presets');
                    window.setTimeout(() => liveContainer?.querySelector<HTMLInputElement>('#st-m-save-name')?.focus(), 60);
                },
            },
            {
                id: 'revert-all',
                label: 'Revert all',
                kind: 'ghost',
                keepOpen: true,
                onClick: () => {
                    const count = changedDefs().length;
                    const base = baseline;
                    undoable(`Reverted ${count} setting${count === 1 ? '' : 's'}`, `Back to “${base.name === 'default' ? 'Default' : base.name}”.`, () => {
                        themeState.activeTheme = mergeThemeConfig({ ...base.config });
                        themeState.activePresetName = base.name === 'default' ? 'Default' : base.name;
                        saveThemeState();
                        injectThemeStyles();
                        rerenderLive?.();
                    });
                    render();
                },
            },
            { label: 'Done', kind: 'primary' },
        ],
    });
    render();
}

interface PaletteItem {
    group: string;
    label: string;
    hint?: string;
    keywords?: string;
    run: () => void;
}

function paletteItems(close: () => void): PaletteItem[] {
    const items: PaletteItem[] = [];
    (Object.keys(TAB_META) as TabId[]).forEach(tab => {
        items.push({ group: 'Go to', label: TAB_META[tab].label, hint: TAB_META[tab].description, run: () => { close(); goToLive?.(tab); } });
    });
    CZ_CATEGORIES.forEach(cat => {
        items.push({ group: 'Go to', label: `Customize › ${cat.label}`, hint: cat.description, run: () => { close(); goToLive?.('customize', cat.id); } });
    });
    dedupedSchema().forEach(def => {
        items.push({
            group: 'Settings',
            label: def.label,
            hint: whereLabel(def),
            keywords: `${def.section} ${def.hint || ''} ${def.keywords || ''}`,
            run: () => { close(); revealSetting(def.id); },
        });
    });
    getAllPresets().forEach(preset => {
        items.push({
            group: 'Presets',
            label: `Apply “${preset.name}”`,
            hint: preset.description,
            keywords: 'preset theme apply',
            run: () => {
                close();
                undoable(`Applied “${preset.name}”`, undefined, () => {
                    applyPreset(preset);
                    resolveBaseline();
                    injectThemeStyles();
                    rerenderLive?.();
                });
            },
        });
    });
    items.push(
        { group: 'Actions', label: 'Review changes', hint: 'See everything that differs from your preset', run: () => { close(); openReviewChanges(); } },
        {
            group: 'Actions',
            label: themeState.isEnabled ? 'Turn styling off' : 'Turn styling on',
            keywords: 'enable disable toggle',
            run: () => {
                close();
                themeState.isEnabled = !themeState.isEnabled;
                saveThemeState();
                injectThemeStyles();
                syncChrome.forEach(fn => fn());
            },
        },
        { group: 'Actions', label: 'Check for updates', keywords: 'version update', run: () => { close(); runManualUpdateCheck(null); } },
        { group: 'Actions', label: 'Show changelog', keywords: 'whats new release notes', run: () => { close(); showCurrentChangelog({ expanded: true }).catch(() => notify('Could not load the changelog', true)); } },
        { group: 'Actions', label: 'Notifications', keywords: 'inbox bell history', run: () => { close(); openInbox(); } },
    );
    return items;
}

function scoreItem(item: PaletteItem, q: string): number {
    const label = item.label.toLowerCase();
    if (label.startsWith(q)) return 100 - label.length * 0.1;
    const words = label.split(/[\s›·“”]+/);
    if (words.some(w => w.startsWith(q))) return 70 - label.length * 0.1;
    if (label.includes(q)) return 50;
    if (`${item.hint || ''} ${item.keywords || ''}`.toLowerCase().includes(q)) return 20;
    return -1;
}

function openPalette(): void {
    if (document.querySelector('.st-m-pal')) return;
    let dialog: SurfaceHandle | null = null;
    const close = () => dialog?.close();
    const all = paletteItems(close);
    const input = el('input', {
        class: 'st-m-pal-input',
        type: 'text',
        placeholder: 'Search settings, presets, themes and actions…',
        spellcheck: 'false',
        'aria-label': 'Search Spicy Themes',
        'data-st-autofocus': true,
        'data-st-esc-local': true,
    });
    const results = el('div', { class: 'st-m-pal-results', role: 'listbox' });
    const foot = el('div', { class: 'st-m-pal-foot' },
        el('span', { html: '<kbd>↑</kbd><kbd>↓</kbd> move' }),
        el('span', { html: '<kbd>Enter</kbd> open' }),
        el('span', { html: '<kbd>Esc</kbd> close' }),
    );
    const box = el('div', { class: 'st-m-pal' },
        el('div', { class: 'st-m-pal-bar' }, el('span', { class: 'st-m-pal-icon', html: SEARCH_SVG }), input),
        results,
        foot,
    );

    let shown: PaletteItem[] = [];
    let active = 0;
    let remoteTimer: number | null = null;
    let remote: PaletteItem[] = [];
    let remoteQuery = '';

    const paint = () => {
        results.innerHTML = '';
        let lastGroup = '';
        shown.forEach((item, i) => {
            if (item.group !== lastGroup) {
                lastGroup = item.group;
                results.append(el('div', { class: 'st-m-pal-group', text: item.group }));
            }
            const row = el('button', { class: `st-m-pal-item${i === active ? ' active' : ''}`, type: 'button', role: 'option', 'aria-selected': String(i === active) },
                el('span', { class: 'st-m-pal-label', text: item.label }),
                item.hint ? el('span', { class: 'st-m-pal-hint', text: item.hint }) : null,
            );
            row.addEventListener('mousemove', () => {
                if (active === i) return;
                active = i;
                results.querySelectorAll('.st-m-pal-item').forEach((n, j) => n.classList.toggle('active', j === i));
            });
            row.addEventListener('click', () => item.run());
            results.append(row);
        });
        if (!shown.length) results.append(el('div', { class: 'st-m-pal-empty', text: input.value.trim() ? 'Nothing matches that.' : 'Start typing to search.' }));
        results.querySelector('.st-m-pal-item.active')?.scrollIntoView({ block: 'nearest' });
    };

    const compute = () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            shown = all.filter(i => i.group === 'Go to' || i.group === 'Actions').slice(0, 10);
        } else {
            const scored = all
                .map(item => ({ item, score: scoreItem(item, q) }))
                .filter(x => x.score >= 0)
                .sort((a, b) => b.score - a.score);
            const byGroup = new Map<string, PaletteItem[]>();
            scored.forEach(({ item }) => {
                const list = byGroup.get(item.group) || [];
                if (list.length < (item.group === 'Settings' ? 7 : 4)) list.push(item);
                byGroup.set(item.group, list);
            });
            shown = ['Settings', 'Go to', 'Presets', 'Actions'].flatMap(g => byGroup.get(g) || []);
            if (remoteQuery === q) shown = shown.concat(remote);
        }
        active = Math.min(active, Math.max(0, shown.length - 1));
        paint();
    };

    const fetchRemote = () => {
        const q = input.value.trim();
        if (remoteTimer) window.clearTimeout(remoteTimer);
        if (q.length < 2) return;
        remoteTimer = window.setTimeout(async () => {
            try {
                const res = await Marketplace.listThemes({ page: 1, query: q });
                if (input.value.trim() !== q || !dialog || dialog.closed) return;
                remoteQuery = q.toLowerCase();
                remote = (res.themes || []).slice(0, 4).map(t => ({
                    group: 'Marketplace',
                    label: t.name,
                    hint: `by ${t.author}`,
                    run: () => {
                        close();
                        goToLive?.('marketplace');
                        const search = liveContainer?.querySelector<HTMLInputElement>('.st-m-mp-search');
                        if (search) {
                            search.value = t.name;
                            search.dispatchEvent(new Event('input'));
                        }
                    },
                }));
                compute();
            } catch {}
        }, 320);
    };

    input.addEventListener('input', () => {
        active = 0;
        compute();
        fetchRemote();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); shown[active]?.run(); }
        else if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; compute(); }
    });

    dialog = openDialog({ title: 'Search', bare: true, size: 'md', placement: 'top', className: 'st-m-pal-dialog', content: box });
    compute();
    input.focus();
}

function relativeTime(at: number): string {
    const s = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
}

const INBOX_TONE: Record<InboxEntry['kind'], Tone> = {
    info: 'accent',
    success: 'success',
    warning: 'hotfix',
    error: 'error',
    update: 'accent',
};

function openInbox(): void {
    const list = el('div', { class: 'st-m-inbox' });
    let dialog: SurfaceHandle | null = null;
    const render = (items: InboxEntry[]) => {
        list.innerHTML = '';
        if (!items.length) {
            list.append(el('div', { class: 'st-m-inbox-empty' },
                el('div', { class: 'st-m-inbox-empty-title', text: 'All caught up' }),
                el('div', { class: 'st-m-inbox-empty-sub', text: 'Updates, warnings and errors land here so you never miss one.' }),
            ));
            return;
        }
        items.forEach(entry => {
            const dot = el('span', { class: 'st-m-inbox-dot', 'aria-hidden': 'true' });
            paintTone(dot, INBOX_TONE[entry.kind] || 'accent');
            const row = el('div', { class: `st-m-inbox-row${entry.read ? '' : ' unread'}` },
                dot,
                el('div', { class: 'st-m-inbox-text' },
                    el('div', { class: 'st-m-inbox-title', text: entry.title }),
                    entry.description ? el('div', { class: 'st-m-inbox-desc', text: entry.description }) : null,
                    el('div', { class: 'st-m-inbox-time', text: relativeTime(entry.at) }),
                ),
            );
            if (entry.actionId) {
                const actionId = entry.actionId;
                const btn = el('button', { class: 'st-m-btn', type: 'button', text: entry.actionLabel || 'Open' });
                btn.addEventListener('click', () => {
                    dialog?.close();
                    runInboxAction(actionId);
                });
                row.append(btn);
            }
            list.append(row);
        });
    };
    render(getInbox());
    dialog = openDialog({
        eyebrow: 'Spicy Themes',
        title: 'Notifications',
        size: 'md',
        className: 'st-m-inbox-dialog',
        content: list,
        actions: [
            { label: 'Clear all', kind: 'quiet', keepOpen: true, onClick: () => { clearInbox(); render([]); } },
            { label: 'Done', kind: 'primary' },
        ],
    });
    markInboxRead();
}

function iconButton(className: string, label: string, svg: string): HTMLButtonElement {
    return el('button', { class: `st-m-icon-btn ${className}`, type: 'button', 'aria-label': label, title: label, html: svg });
}

function bindShortcuts(peekButton: HTMLElement, overlayOf: () => HTMLElement | null): () => void {
    const on = () => overlayOf()?.classList.add('st-ui-peek');
    const off = () => overlayOf()?.classList.remove('st-ui-peek');
    peekButton.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    peekButton.addEventListener('pointerup', off);
    peekButton.addEventListener('pointerleave', off);
    peekButton.addEventListener('blur', off);
    peekButton.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on(); } });
    peekButton.addEventListener('keyup', off);
    const editable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const settingsOnTop = () => {
        const surfaces = openSurfaces();
        const top = surfaces[surfaces.length - 1];
        return !!top && !!liveContainer && top.root.contains(liveContainer);
    };
    const onKeyDown = (e: KeyboardEvent) => {
        if (!liveContainer?.isConnected) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            if (!settingsOnTop()) return;
            e.preventDefault();
            e.stopPropagation();
            openPalette();
            return;
        }
        if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !editable(e.target) && settingsOnTop()) {
            on();
        }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'p') off(); };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', off);
    return () => {
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('keyup', onKeyUp, true);
        window.removeEventListener('blur', off);
    };
}

let teardownLive: (() => void) | null = null;

export function destroySettingsModal(): void {
    teardownLive?.();
    teardownLive = null;
    hideEnabledTip();
    liveContainer = null;
    goToLive = null;
    rerenderLive = null;
}

export function createSettingsModal(options: { tab?: TabId; category?: string } = {}): HTMLElement {
    hideEnabledTip();
    teardownLive?.();
    const container = document.createElement('div');
    container.className = 'st-modal-root';
    liveContainer = container;
    syncChrome = [];
    resolveBaseline();

    if (options.tab) activeTabId = options.tab;
    if (options.category) activeCategoryId = options.category;

    const renderers: Record<TabId, () => HTMLElement> = {
        customize: () => buildCustomizeTab(),
        presets: () => buildPresetsTab(rerender),
        marketplace: () => buildMarketplaceTab(rerender),
        about: () => buildAboutTab(),
    };

    const tabContent = el('div', { class: 'st-m-tab-host' });
    const crumbTitle = el('div', { class: 'st-m-crumb-title' });
    const crumbSub = el('div', { class: 'st-m-crumb-sub' });

    function rerender(): void {
        tabContent.innerHTML = '';
        tabContent.appendChild(renderers[activeTabId]());
        applyCustomizeFilter();
        syncChrome.forEach(fn => fn());
    }
    rerenderLive = rerender;

    function goTo(tab: TabId, category?: string): void {
        const sameTab = tab === activeTabId;
        activeTabId = tab;
        if (category) activeCategoryId = category;
        if (!sameTab || tab !== 'customize') {
            rerender();
        } else {
            const search = container.querySelector<HTMLInputElement>('.st-m-cz-search');
            if (search) search.value = '';
            applyCustomizeFilter();
            syncChrome.forEach(fn => fn());
        }
        tabContent.scrollTop = 0;
        if (!prefersReducedMotion()) {
            tabContent.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' });
        }
    }
    goToLive = goTo;

    const side = el('aside', { class: 'st-m-side' });
    const brand = el('div', { class: 'st-m-brand' },
        el('span', { class: 'st-m-brand-mark', html: Icons.Palette }),
        el('div', { class: 'st-m-brand-text' },
            el('div', { class: 'st-m-brand-name', text: 'Spicy Themes' }),
            el('div', { class: 'st-m-brand-ver', text: `v${getCurrentVersion().text}` }),
        ),
    );
    side.append(brand, buildMasterBar());

    const nav = el('nav', { class: 'st-m-side-nav', 'aria-label': 'Settings sections' });
    nav.append(el('div', { class: 'st-m-side-label', text: 'Customize' }));
    const catNav = el('div', { class: 'st-m-cz-nav', role: 'tablist' });
    CZ_CATEGORIES.forEach(cat => {
        const btn = el('button', { class: 'st-m-cz-nav-item st-m-side-item', type: 'button', role: 'tab', 'data-target': cat.id },
            el('span', { class: 'st-m-cz-nav-icon', 'aria-hidden': 'true', text: cat.icon }),
            el('span', { class: 'st-m-side-item-label', text: cat.label }),
        );
        btn.addEventListener('click', () => goTo('customize', cat.id));
        catNav.append(btn);
    });
    nav.append(catNav, el('div', { class: 'st-m-side-label', text: 'Library' }));
    const tabButtons = new Map<TabId, HTMLButtonElement>();
    ([['presets', '◆'], ['marketplace', '✺'], ['about', 'i']] as [TabId, string][]).forEach(([tab, icon]) => {
        const btn = el('button', { class: 'st-m-side-item st-m-side-tab', type: 'button', 'data-tab': tab },
            el('span', { class: 'st-m-cz-nav-icon', 'aria-hidden': 'true', text: icon }),
            el('span', { class: 'st-m-side-item-label', text: TAB_META[tab].label }),
        );
        btn.addEventListener('click', () => goTo(tab));
        tabButtons.set(tab, btn);
        nav.append(btn);
    });
    side.append(nav);

    const searchHint = el('button', { class: 'st-m-side-search', type: 'button' },
        el('span', { class: 'st-m-side-search-icon', html: SEARCH_SVG }),
        el('span', { class: 'st-m-side-search-label', text: 'Search everything' }),
        el('kbd', { text: 'Ctrl K' }),
    );
    searchHint.addEventListener('click', openPalette);
    side.append(searchHint);

    const main = el('div', { class: 'st-m-main' });
    const topbar = el('header', { class: 'st-m-topbar' });
    const crumb = el('div', { class: 'st-m-crumb' }, crumbTitle, crumbSub);
    const tools = el('div', { class: 'st-m-tools' });

    const updateChip = el('button', { class: 'st-m-update-chip', type: 'button' });
    updateChip.addEventListener('click', () => openWaitingUpdate(updateChip.getBoundingClientRect()));

    const reviewBtn = el('button', { class: 'st-m-review-btn', type: 'button', title: 'Review everything you changed' },
        el('span', { class: 'st-m-review-icon', html: DIFF_SVG }),
        el('span', { class: 'st-m-review-label' }),
    );
    reviewBtn.addEventListener('click', openReviewChanges);

    const peekBtn = iconButton('st-m-peek', 'Hold to peek at the lyrics (or hold P)', EYE_SVG);
    const bellBtn = iconButton('st-m-bell', 'Notifications', BELL_SVG);
    const closeBtn = iconButton('st-m-close', 'Close', CLOSE_SVG);
    closeBtn.addEventListener('click', () => {
        openSurfaces().find(s => s.root.contains(container))?.close();
    });

    tools.append(updateChip, reviewBtn, peekBtn, bellBtn, closeBtn);
    topbar.append(crumb, tools);
    main.append(topbar, buildUpdateBanner(rerender), tabContent);
    container.append(side, main);

    const syncBell = () => {
        const unread = unreadCount();
        bellBtn.classList.toggle('st-m-has-unread', unread > 0);
        bellBtn.title = unread ? `Notifications (${unread} new)` : 'Notifications';
    };
    bellBtn.addEventListener('click', () => {
        openInbox();
        syncBell();
    });

    const syncShell = () => {
        const searching = !!container.querySelector<HTMLInputElement>('.st-m-cz-search')?.value.trim();
        catNav.querySelectorAll<HTMLElement>('.st-m-cz-nav-item').forEach(btn => {
            const on = activeTabId === 'customize' && !searching && btn.dataset.target === activeCategoryId;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', String(on));
        });
        catNav.classList.toggle('st-m-cz-nav-muted', activeTabId === 'customize' && searching);
        tabButtons.forEach((btn, tab) => btn.classList.toggle('active', tab === activeTabId));
        const cat = CZ_CATEGORIES.find(c => c.id === activeCategoryId);
        const onCustomize = activeTabId === 'customize' && !!cat;
        crumbTitle.textContent = onCustomize ? cat!.label : TAB_META[activeTabId].label;
        crumbSub.textContent = onCustomize ? cat!.description : TAB_META[activeTabId].description;
        container.dataset.tab = activeTabId;
        const changed = changedFieldCount(baseline.config);
        reviewBtn.classList.toggle('st-m-has-changes', changed > 0);
        (reviewBtn.querySelector('.st-m-review-label') as HTMLElement).textContent = changed ? `${changed} change${changed === 1 ? '' : 's'}` : 'No changes';
        const waiting = hasWaitingUpdate();
        updateChip.hidden = !waiting;
        if (waiting) updateChip.textContent = waiting.kind === 'hotfix' ? 'Patch ready' : `v${waiting.version} ready`;
        syncBell();
    };
    syncChrome.push(syncShell);

    rerender();

    const stopShortcuts = bindShortcuts(peekBtn, () => container.closest<HTMLElement>('.st-ui-overlay'));
    const stopInbox = onInboxChange(syncBell);
    const waitObserver = new MutationObserver(syncShell);
    waitObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    teardownLive = () => {
        stopShortcuts();
        stopInbox();
        waitObserver.disconnect();
    };

    scanForUpdates()
        .then(changed => {
            if (!changed || liveContainer !== container || !container.isConnected) return;
            if (activeTabId === 'presets') rerender();
            else syncChrome.forEach(fn => fn());
        })
        .catch(() => {});

    return container;
}
