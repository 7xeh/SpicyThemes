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
    COVER_COLOR_KEYS,
    COVER_HUE_RANGE,
    COVER_SHIFT_RANGE,
    coverChoiceFor,
    setCoverColor,
} from './state';
import { CoverChoice, CoverSource, currentCoverPalette, coverColorHex, registerCoverConsumer, refreshCoverPalette, rgbToHex } from './coverPalette';
import { injectThemeStyles } from './themeEngine';
import { buildVideoQualityPanel } from './videoQualityPanel';
import { buildVideoListPanel } from './videoListPanel';
import { setVideoAuto } from './videoMode';
import { fullscreenHideCursor, setFullscreenHideCursor, fullscreenHideNowBar, setFullscreenHideNowBar, onFullscreenPrefsChange } from './fullscreenTools';
import { saveBackgroundImage, pruneBackgroundImages, getCachedBackgroundUrl, getBackgroundImageUrl, getBackgroundImageInfo, bgImageSize, bgImageRepeat, bgImagePosition } from './backgroundImage';
import { getCurrentVersion, getDisplayHash, runManualUpdateCheck, showCurrentChangelog, hasWaitingUpdate, openWaitingUpdate } from './updater';
import { el, openDialog, openSurfaces, prefersReducedMotion, paintTone, onEscape, CLOSE_SVG, SurfaceHandle, Tone, RegionPlacement, getRegionPlacement, setRegionPlacement } from './surface';
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
const VIDEO_LIST_SECTION = 'Video list';
const FULLSCREEN_SECTION = 'Fullscreen';
const ANIM_BG_SECTION = 'Animated background';

const ANIM_BG_STYLE_OPTIONS = ANIM_BG_STYLES.map(s => ({ value: s.id, text: s.label, hint: s.description }));

function animStyle(t: ThemeConfig) {
    return ANIM_BG_STYLES.find(s => s.id === t.animBgStyle) || ANIM_BG_STYLES[0];
}

export const SCHEMA: FieldDef[] = [
    { id: 'lyricsStylingEnabled', label: 'Restyle lyrics', type: 'toggle', section: 'Lyric styling', hint: 'Off keeps Spicy Lyrics’ own lyric look, untouched. Changing any lyric setting turns it back on.', keywords: 'stock native original spicy lyrics look default plain' },

    { id: 'activeLineColor', label: 'Active line', type: 'color', section: 'Line colours', when: (t) => !t.gradientEnabled, hint: 'The line currently being sung. Replaced by the gradient when gradient text is on.', keywords: 'current karaoke highlight' },
    { id: 'sungLineColor', label: 'Already sung', type: 'color', section: 'Line colours', keywords: 'past previous' },
    { id: 'notSungLineColor', label: 'Not yet sung', type: 'color', section: 'Line colours', keywords: 'upcoming future next' },
    { id: 'activeLineOpacity', label: 'Active line opacity', type: 'slider', section: 'Line colours', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },
    { id: 'sungLineOpacity', label: 'Sung line opacity', type: 'slider', section: 'Line colours', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },
    { id: 'notSungLineOpacity', label: 'Unsung line opacity', type: 'slider', section: 'Line colours', min: 0.1, max: 1.0, step: 0.05, keywords: 'transparency fade' },

    { id: 'gradientEnabled', label: 'Gradient text', type: 'toggle', section: 'Gradient text', hint: 'Fills the active line with a two-colour gradient instead of a flat colour.', keywords: 'rainbow fade blend' },
    { id: 'gradientStartColor', label: 'Sung colour', type: 'color', section: 'Gradient text', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The part of the active line already sung.' },
    { id: 'gradientEndColor', label: 'Upcoming colour', type: 'color', section: 'Gradient text', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The part of the active line still to come.' },
    { id: 'gradientDirection', label: 'Sweep direction', type: 'dropdown', section: 'Gradient text', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, options: [
        { value: 'auto', text: 'Follow Spicy Lyrics' },
        { value: 'horizontal', text: 'Horizontal' },
        { value: 'vertical', text: 'Vertical' },
        { value: 'diagonal', text: 'Diagonal' },
        { value: 'custom', text: 'Custom angle' },
    ], hint: 'Which way the karaoke fill travels. Horizontal, diagonal and custom flip automatically for right-to-left lyrics.', keywords: 'angle direction karaoke sweep fill' },
    { id: 'gradientAngle', label: 'Sweep angle', type: 'slider', section: 'Gradient text', min: 0, max: 360, step: 5, unit: '°', parent: 'gradientEnabled', when: (t) => t.gradientEnabled && t.gradientDirection === 'custom', hint: '0° sweeps upward, 90° to the right, 180° downward.', keywords: 'degrees rotation direction' },
    { id: 'gradientFeather', label: 'Fill softness', type: 'slider', section: 'Gradient text', min: 0, max: 60, step: 1, unit: '%', parent: 'gradientEnabled', when: (t) => t.gradientEnabled, hint: 'The length of the blend between the sung and upcoming colours. 0% is a hard wipe, higher values trail a long fade behind the karaoke position.', keywords: 'blend fade edge transition sharpness feather' },

    { id: 'disableHighlight', label: 'Flat colour mode', type: 'toggle', section: 'Flat colour', hint: 'Turns off the sweeping karaoke fill — every line uses one solid colour.', keywords: 'no karaoke disable highlight solid' },
    { id: 'highlightColor', label: 'Flat colour', type: 'color', section: 'Flat colour', parent: 'disableHighlight', when: (t) => t.disableHighlight },

    { id: 'fontFamily', label: 'Font', type: 'dropdown', section: 'Font', options: [...FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], keywords: 'typeface family' },
    { id: 'fontFamily', label: 'Custom font name', type: 'text', section: 'Font', placeholder: "e.g. 'Inter', sans-serif", when: (t) => t.fontFamily !== '' && !FONT_OPTIONS.some(o => o.value === t.fontFamily) },
    { id: 'fontWeight', label: 'Weight', type: 'dropdown', section: 'Font', options: WEIGHT_OPTIONS, keywords: 'bold thin' },
    { id: 'activeLineWeight', label: 'Active line weight', type: 'dropdown', section: 'Font', options: [{ value: '0', text: 'Same as above' }, ...WEIGHT_OPTIONS], hint: 'Make the line being sung heavier than the rest.', keywords: 'bold emphasis active' },
    { id: 'textTransform', label: 'Capitalisation', type: 'dropdown', section: 'Font', options: [
        { value: 'none', text: 'As written' },
        { value: 'uppercase', text: 'UPPERCASE' },
        { value: 'lowercase', text: 'lowercase' },
        { value: 'capitalize', text: 'Title Case' },
    ], keywords: 'uppercase lowercase caps case' },
    { id: 'fontStyle', label: 'Style', type: 'dropdown', section: 'Font', options: [
        { value: 'normal', text: 'Upright' },
        { value: 'italic', text: 'Italic' },
        { value: 'oblique', text: 'Oblique (slanted)' },
    ], hint: 'Italic uses the font’s own italic cut if it ships one; oblique slants the upright cut mathematically.', keywords: 'italic slant oblique cursive' },

    { id: 'lyricsScale', label: 'Text size', type: 'slider', section: 'Size and spacing', min: 0.25, max: 2.0, step: 0.05, unit: 'x', keywords: 'scale bigger smaller font size' },
    { id: 'letterSpacing', label: 'Letter spacing', type: 'slider', section: 'Size and spacing', min: -0.1, max: 0.3, step: 0.01, unit: 'em', keywords: 'tracking kerning' },
    { id: 'wordSpacing', label: 'Word spacing', type: 'slider', section: 'Size and spacing', min: -0.1, max: 1.0, step: 0.02, unit: 'em', hint: 'Widens the gaps between words without touching the letters inside them.', keywords: 'gap space between words' },
    { id: 'lineHeight', label: 'Line spacing', type: 'slider', section: 'Size and spacing', min: 1.0, max: 2.5, step: 0.01, keywords: 'leading gap' },

    { id: 'textAlign', label: 'Alignment', type: 'dropdown', section: 'Line layout', options: [
        { value: 'default', text: 'Follow Spicy Lyrics' },
        { value: 'left', text: 'Left' },
        { value: 'center', text: 'Centre' },
        { value: 'right', text: 'Right' },
    ], hint: 'Overrides Spicy Lyrics’ own alignment, including its per-vocalist opposite alignment.', keywords: 'align left right centre centered justify' },
    { id: 'maxLineWidth', label: 'Max line width', type: 'slider', section: 'Line layout', min: 0, max: 100, step: 5, unit: '%', hint: 'Caps how wide a line can get before it wraps. 0% leaves it uncapped — lower values keep lines readable on wide screens.', keywords: 'measure wrap width narrow column readability' },

    { id: 'glowEnabled', label: 'Line glow', type: 'toggle', section: 'Line glow', hint: 'Adds a soft halo around every lyric line.', keywords: 'halo neon shine bloom' },
    { id: 'activeGlowColor', label: 'Active line colour', type: 'color', section: 'Line glow', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'activeGlowIntensity', label: 'Active line strength', type: 'slider', section: 'Line glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowColor', label: 'Other lines colour', type: 'color', section: 'Line glow', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowIntensity', label: 'Other lines strength', type: 'slider', section: 'Line glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'glowEnabled', when: (t) => t.glowEnabled },
    { id: 'glowPulse', label: 'Pulse the active line', type: 'toggle', section: 'Line glow', parent: 'glowEnabled', when: (t) => t.glowEnabled, hint: 'The active line’s glow breathes in and out instead of sitting still.', keywords: 'breathe pulse animate throb' },
    { id: 'glowPulseSpeed', label: 'Pulse speed', type: 'slider', section: 'Line glow', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'glowPulse', when: (t) => t.glowEnabled && t.glowPulse },

    { id: 'bgGlowEnabled', label: 'Active word glow', type: 'toggle', section: 'Word glow', hint: 'Lights up only the word being sung right now.', keywords: 'karaoke halo neon' },
    { id: 'bgGlowColor', label: 'Word glow colour', type: 'color', section: 'Word glow', parent: 'bgGlowEnabled', when: (t) => t.bgGlowEnabled },
    { id: 'bgGlowIntensity', label: 'Word glow strength', type: 'slider', section: 'Word glow', min: 0, max: 30, step: 1, unit: 'px', parent: 'bgGlowEnabled', when: (t) => t.bgGlowEnabled },

    { id: 'textShadowEnabled', label: 'Text shadow', type: 'toggle', section: 'Text shadow', hint: 'A hard drop shadow — useful for readability over bright backgrounds.', keywords: 'drop shadow outline readability' },
    { id: 'textShadowColor', label: 'Shadow colour', type: 'color', section: 'Text shadow', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOpacity', label: 'Shadow opacity', type: 'slider', section: 'Text shadow', min: 0, max: 1, step: 0.05, parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowBlur', label: 'Shadow blur', type: 'slider', section: 'Text shadow', min: 0, max: 20, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOffsetX', label: 'Shadow offset X', type: 'slider', section: 'Text shadow', min: -10, max: 10, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },
    { id: 'textShadowOffsetY', label: 'Shadow offset Y', type: 'slider', section: 'Text shadow', min: -10, max: 10, step: 1, unit: 'px', parent: 'textShadowEnabled', when: (t) => t.textShadowEnabled },

    { id: 'textStrokeEnabled', label: 'Text outline', type: 'toggle', section: 'Text outline', hint: 'Draws a hard outline around every glyph. Holds up over busy backgrounds and music video better than a shadow does, and sits outside the karaoke gradient so the fill still shows through.', keywords: 'stroke border outline edge contour readability' },
    { id: 'textStrokeColor', label: 'Outline colour', type: 'color', section: 'Text outline', parent: 'textStrokeEnabled', when: (t) => t.textStrokeEnabled },
    { id: 'textStrokeWidth', label: 'Outline width', type: 'slider', section: 'Text outline', min: 0, max: 3, step: 0.1, unit: 'px', parent: 'textStrokeEnabled', when: (t) => t.textStrokeEnabled, hint: 'Above roughly 1.5px the outline starts eating into thin letterforms.' },

    { id: 'blurUnsung', label: 'Blur other lines', type: 'toggle', section: 'Blur other lines', hint: 'Softens every line except the one being sung, so the eye lands on the right place.', keywords: 'depth of field defocus soft' },
    { id: 'blurAmount', label: 'Blur amount', type: 'slider', section: 'Blur other lines', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'blurUnsung', when: (t) => t.blurUnsung },
    { id: 'blurPreviewLines', label: 'Keep upcoming lines sharp', type: 'slider', section: 'Blur other lines', min: 0, max: 5, step: 1, unit: ' lines', parent: 'blurUnsung', when: (t) => t.blurUnsung, hint: 'How many lines ahead stay readable through the blur.' },
    { id: 'blurProgressive', label: 'Ramp blur with distance', type: 'toggle', section: 'Blur other lines', parent: 'blurUnsung', when: (t) => t.blurUnsung, hint: 'Lines near the active one blur gently and further ones blur fully, instead of everything blurring equally.', keywords: 'gradual depth falloff distance' },

    { id: 'blurSungWords', label: 'Fade words as they pass', type: 'toggle', section: 'Fade sung words', hint: 'Blurs each word of the active line once it has been sung.', keywords: 'karaoke word blur trail' },
    { id: 'blurSungWholeWords', label: 'Fade whole words, not syllables', type: 'toggle', section: 'Fade sung words', parent: 'blurSungWords', when: (t) => t.blurSungWords, hint: 'On syllable-synced lyrics, a word split into syllables only fades once its last syllable has been sung, instead of fading piece by piece.', keywords: 'syllable word whole group karaoke blur trail' },
    { id: 'blurSungWordsAmount', label: 'Word blur amount', type: 'slider', section: 'Fade sung words', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'blurSungWords', when: (t) => t.blurSungWords },
    { id: 'blurSungWordsOpacity', label: 'Word opacity', type: 'slider', section: 'Fade sung words', min: 0.05, max: 1.0, step: 0.05, parent: 'blurSungWords', when: (t) => t.blurSungWords },

    { id: 'lineWindowEnabled', label: 'Limit visible lines', type: 'toggle', section: 'Visible lines', hint: 'Hides everything outside a window around the active line.', keywords: 'window hide crop few lines' },
    { id: 'lineWindowSungLines', label: 'Sung lines shown', type: 'slider', section: 'Visible lines', min: 0, max: 10, step: 1, unit: ' lines', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled },
    { id: 'lineWindowUnsungLines', label: 'Upcoming lines shown', type: 'slider', section: 'Visible lines', min: 0, max: 10, step: 1, unit: ' lines', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled },
    { id: 'lineWindowFadeStyle', label: 'Edge style', type: 'dropdown', section: 'Visible lines', options: [
        { value: 'cut', text: 'Hard cut' },
        { value: 'fade', text: 'Fade' },
        { value: 'gradient', text: 'Gradient' },
    ], parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled, hint: 'Hard cut snaps lines on and off. Fade eases them. Gradient also dims each line the further it sits from the active one.', keywords: 'fade gradient dim edge transition soft' },
    { id: 'lineWindowFadeMs', label: 'Fade speed', type: 'slider', section: 'Visible lines', min: 0, max: 1000, step: 25, unit: 'ms', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled && t.lineWindowFadeStyle !== 'cut', hint: 'How long a line takes to appear or vanish.', keywords: 'duration fade transition time' },
    { id: 'lineWindowGapMode', label: 'During instrumental breaks', type: 'dropdown', section: 'Visible lines', options: [
        { value: 'hide', text: 'Hide everything' },
        { value: 'line', text: 'Keep the last line' },
        { value: 'window', text: 'Keep the whole window' },
    ], parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled, hint: 'What stays on screen while no line is being sung, until the next one starts.', keywords: 'gap break instrumental intro hold keep previous last line' },
    { id: 'lineWindowEdgeBlur', label: 'Blur edge lines', type: 'slider', section: 'Visible lines', min: 0, max: 6, step: 0.5, unit: 'px', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled, hint: 'Blurs lines more the closer they sit to the edge of the window.', keywords: 'blur edge soft depth falloff' },
    { id: 'lineWindowHoverReveal', label: 'Show all lines on hover', type: 'toggle', section: 'Visible lines', parent: 'lineWindowEnabled', when: (t) => t.lineWindowEnabled, hint: 'Brings every line back while the pointer is over the lyrics, so you can scroll back.', keywords: 'hover reveal mouse show all scroll' },

    { id: 'wordEffect', label: 'Word animation', type: 'dropdown', section: 'Word animation', options: WORD_EFFECT_OPTIONS, hint: 'Animates individual words in the active line. Grouped by feel — Classic is subtle, Energetic is punchy, Smooth is understated, Dimensional uses 3D.', keywords: 'bounce pop wave stamp shake glitch rise sway focus swell flip depth lean animate word' },
    { id: 'wordEffectTrigger', label: 'Fires', type: 'dropdown', section: 'Word animation', options: [
        { value: 'auto', text: 'Recommended for this animation' },
        { value: 'word', text: 'As each word is sung' },
        { value: 'line', text: 'When the line starts' },
        { value: 'loop', text: 'Continuously' },
    ], parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'Per-word keeps the animation in time with the karaoke. Only the options an animation can actually do are accepted.', keywords: 'trigger timing sync karaoke per word' },
    { id: 'wordEffectIntensity', label: 'Intensity', type: 'slider', section: 'Word animation', min: 0.1, max: 2.0, step: 0.05, unit: 'x', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'How far the animation travels. Scales with text size, so it stays proportional.', keywords: 'strength amount size distance' },
    { id: 'wordEffectSpeed', label: 'Speed', type: 'slider', section: 'Word animation', min: 0.3, max: 3.0, step: 0.05, unit: 'x', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none', hint: 'Higher is faster. Applies to whichever animation is selected.', keywords: 'duration fast slow tempo' },
    { id: 'wordEffectStagger', label: 'Stagger between words', type: 'slider', section: 'Word animation', min: 0, max: 150, step: 5, unit: 'ms', parent: 'wordEffect', when: (t) => t.wordEffect !== 'none' && resolveWordTrigger(t.wordEffect, t.wordEffectTrigger) !== 'word', hint: 'Offsets each word so the animation ripples along the line instead of firing all at once.', keywords: 'delay ripple cascade offset sequence' },

    { id: 'scaleActive', label: 'Active line zoom', type: 'slider', section: 'Line emphasis', min: 0.95, max: 1.12, step: 0.01, unit: 'x', keywords: 'scale grow size' },
    { id: 'inactiveLineScale', label: 'Inactive line size', type: 'slider', section: 'Line emphasis', min: 0.5, max: 1, step: 0.01, unit: 'x', hint: 'Shrinks the lines that aren’t being sung. Each line grows back to full size as it becomes active.', keywords: 'scale shrink small inactive focus size zoom unfocused' },
    { id: 'focusDuration', label: 'Focus animation', type: 'slider', section: 'Line emphasis', min: 0.1, max: 1.5, step: 0.05, unit: 's', parent: 'inactiveLineScale', when: (t) => t.inactiveLineScale < 1, hint: 'How long a line takes to grow into focus and shrink back out.', keywords: 'focus transition speed duration grow shrink' },

    { id: 'scaleInEffect', label: 'Zoom in on arrival', type: 'toggle', section: 'Line entrance', when: (t) => !(t.inactiveLineScale < 1), hint: 'Animates each line up to its zoom level as it becomes active.', keywords: 'scale in entrance animate' },
    { id: 'scaleInFrom', label: 'Starting scale', type: 'slider', section: 'Line entrance', min: 0.85, max: 1.05, step: 0.01, unit: 'x', parent: 'scaleInEffect', when: (t) => t.scaleInEffect && !(t.inactiveLineScale < 1) },
    { id: 'scaleInDuration', label: 'Zoom duration', type: 'slider', section: 'Line entrance', min: 0.1, max: 1.0, step: 0.05, unit: 's', parent: 'scaleInEffect', when: (t) => t.scaleInEffect && !(t.inactiveLineScale < 1) },

    { id: 'animationSpeed', label: 'Overall animation speed', type: 'slider', section: 'Timing', min: 0.3, max: 3.0, step: 0.1, unit: 'x', hint: 'Scales every lyric transition. Higher is snappier.', keywords: 'transition tempo fast slow' },

    { id: 'pageBgOverlay', label: 'Background tint', type: 'toggle', section: 'Colour tint', hint: 'Lays a coloured wash over the album-art background to calm it down.', keywords: 'overlay dim darken tint' },
    { id: 'pageBgColor', label: 'Tint colour', type: 'color', section: 'Colour tint', parent: 'pageBgOverlay', when: (t) => t.pageBgOverlay },
    { id: 'pageBgOpacity', label: 'Tint strength', type: 'slider', section: 'Colour tint', min: 0, max: 1, step: 0.05, parent: 'pageBgOverlay', when: (t) => t.pageBgOverlay },

    { id: 'pageBgImageEnabled', label: 'Custom background image', type: 'toggle', section: 'Custom image', hint: 'Replaces the Spicy Lyrics background — album colours, artist header or animated art — with a picture of your own. Music videos still play over it when one is available.', keywords: 'wallpaper picture photo upload image static custom artist header dynamic' },
    { id: 'pageBgImage', label: 'Image', type: 'image', section: 'Custom image', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, hint: 'Saved on this device only, so it isn’t included when you export or share a theme.', keywords: 'upload file picture wallpaper photo' },
    { id: 'pageBgImageFit', label: 'Fit', type: 'dropdown', section: 'Custom image', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, options: [
        { value: 'cover', text: 'Fill (crop to fit)' },
        { value: 'contain', text: 'Fit (show whole image)' },
        { value: 'stretch', text: 'Stretch' },
        { value: 'tile', text: 'Tile' },
    ], keywords: 'cover contain stretch tile repeat scale' },
    { id: 'pageBgImagePosition', label: 'Focus point', type: 'dropdown', section: 'Custom image', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled && (t.pageBgImageFit === 'cover' || t.pageBgImageFit === 'contain'), options: [
        { value: 'center', text: 'Centre' },
        { value: 'top', text: 'Top' },
        { value: 'bottom', text: 'Bottom' },
        { value: 'left', text: 'Left' },
        { value: 'right', text: 'Right' },
    ], hint: 'Which part of the image stays in view when it’s cropped.', keywords: 'position align anchor crop' },
    { id: 'pageBgImageBlur', label: 'Blur', type: 'slider', section: 'Custom image', min: 0, max: 40, step: 1, unit: 'px', parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, keywords: 'soften frosted' },
    { id: 'pageBgImageDim', label: 'Dimming', type: 'slider', section: 'Custom image', min: 0, max: 1, step: 0.05, parent: 'pageBgImageEnabled', when: (t) => t.pageBgImageEnabled, hint: 'Darkens the image so lyrics stay readable.', keywords: 'darken brightness' },

    { id: 'animBgEnabled', label: 'Animated background', type: 'toggle', section: 'Animated background', hint: 'Draws a live, music-reactive scene behind the lyrics. Music videos still play over it when one is available.', keywords: 'visualizer visualiser animated moving live webgl shader reactive audio spectrum unknown pleasures waves lines' },
    { id: 'animBgStyle', label: 'Style', type: 'dropdown', section: 'Animated background', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: ANIM_BG_STYLE_OPTIONS, hint: 'Hover a style in the list for a description. Controls that don’t apply to it are hidden.', keywords: 'ridgelines silk halo aurora orbs horizon synthwave rings mode preset' },
    { id: 'animBgPalette', label: 'Colours', type: 'dropdown', section: 'Animated background', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'custom', text: 'Custom colours' },
        { value: 'album', text: 'From album art' },
        { value: 'spectrum', text: 'Rainbow spectrum' },
    ], hint: 'Album colours fade smoothly into each new track’s palette.', keywords: 'palette colour color album art rainbow' },
    { id: 'animBgColor', label: 'Primary colour', type: 'color', section: 'Animated background', parent: 'animBgPalette', when: (t) => t.animBgEnabled && t.animBgPalette === 'custom', hint: 'Used up front — the nearest lines, inner rings and lower layers.' },
    { id: 'animBgColor2', label: 'Secondary colour', type: 'color', section: 'Animated background', parent: 'animBgPalette', when: (t) => t.animBgEnabled && t.animBgPalette === 'custom', hint: 'Blended in toward the back of the scene.' },
    { id: 'animBgHueCycle', label: 'Colour cycling', type: 'slider', section: 'Animated background', min: 0, max: 1, step: 0.05, parent: 'animBgPalette', when: (t) => t.animBgEnabled, hint: 'Slowly rotates the hue of every colour over time. 0 keeps colours fixed.', keywords: 'hue rotate shift rainbow' },
    { id: 'animBgBackdrop', label: 'Backdrop', type: 'dropdown', section: 'Animated background', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'solid', text: 'Solid colour' },
        { value: 'blend', text: 'Blend over Spicy Lyrics / image' },
    ], hint: 'Blend draws just the lines and light on top of the album background or your custom image.', keywords: 'behind transparent overlay mix' },
    { id: 'animBgBgColor', label: 'Backdrop colour', type: 'color', section: 'Animated background', parent: 'animBgBackdrop', when: (t) => t.animBgEnabled && t.animBgBackdrop === 'solid' },

    { id: 'animBgSpeed', label: 'Speed', type: 'slider', section: 'Animated motion', min: 0, max: 3, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'tempo fast slow flow' },
    { id: 'animBgReactivity', label: 'Music reactivity', type: 'slider', section: 'Animated motion', min: 0, max: 2, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How strongly the scene follows the track’s loudness, beats and spectrum. 0 turns it into a calm ambient loop.', keywords: 'audio beat bass sensitivity react' },
    { id: 'animBgReactTo', label: 'Reacts to', type: 'dropdown', section: 'Animated motion', parent: 'animBgReactivity', when: (t) => t.animBgEnabled && t.animBgReactivity > 0, options: [
        { value: 'all', text: 'Bass and highs' },
        { value: 'bass', text: 'Bass only' },
        { value: 'highs', text: 'Highs only' },
    ], hint: 'Which part of the track drives the scene. Bass follows kicks and low end; highs follow vocals, hats and cymbals.', keywords: 'audio frequency bass treble highs lows kick beat focus range' },
    { id: 'animBgIdleMotion', label: 'Motion while paused', type: 'slider', section: 'Animated motion', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How much the scene keeps drifting when nothing is playing. 0 freezes it and stops redrawing.', keywords: 'idle pause freeze' },

    { id: 'animBgDensity', label: 'Density', type: 'slider', section: 'Animated shape', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How much is drawn — lines, rings, curtains, stars, waves or dots.', keywords: 'count lines rings amount' },
    { id: 'animBgThickness', label: 'Thickness', type: 'slider', section: 'Animated shape', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Line weight — or curtain height, orb and dot size, and cloud contrast.', keywords: 'width weight size' },
    { id: 'animBgAmplitude', label: 'Wave height', type: 'slider', section: 'Animated shape', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'How far the music pushes the scene — peak height, warping, bulges or streak length.', keywords: 'amplitude peaks height' },
    { id: 'animBgAngle', label: 'Rotation', type: 'slider', section: 'Animated shape', min: -180, max: 180, step: 1, unit: '°', parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).angle, keywords: 'angle tilt diagonal rotate' },
    { id: 'animBgPerspective', label: 'Perspective', type: 'slider', section: 'Animated shape', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).perspective, hint: 'How deep the scene recedes. For Horizon it sets where the horizon sits; for Wormhole, how far you can see down it.', keywords: 'depth 3d distance horizon' },
    { id: 'animBgMirror', label: 'Mirror spectrum', type: 'toggle', section: 'Animated shape', parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).mirror, hint: 'Puts the bass in the middle and mirrors the highs out to both sides.', keywords: 'symmetric symmetry bass centre' },
    { id: 'animBgSolid', label: 'Solid ridges', type: 'toggle', section: 'Animated shape', parent: 'animBgEnabled', when: (t) => t.animBgEnabled && animStyle(t).solid, hint: 'Each ridge hides the lines behind it, like a mountain range.', keywords: 'occlude hide behind fill mountain' },

    { id: 'animBgGlow', label: 'Glow', type: 'slider', section: 'Animated finish', min: 0, max: 1.5, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'bloom halo neon soft' },
    { id: 'animBgBrightness', label: 'Brightness', type: 'slider', section: 'Animated finish', min: 0.2, max: 2, step: 0.05, unit: 'x', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'intensity exposure' },
    { id: 'animBgOpacity', label: 'Opacity', type: 'slider', section: 'Animated finish', min: 0.05, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, keywords: 'transparency fade' },
    { id: 'animBgVignette', label: 'Vignette', type: 'slider', section: 'Animated finish', min: 0, max: 1, step: 0.05, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Darkens the edges so the lyrics stand out.', keywords: 'edges darken corners' },
    { id: 'animBgGrain', label: 'Film grain', type: 'slider', section: 'Animated finish', min: 0, max: 0.2, step: 0.01, parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'A little noise hides colour banding in dark gradients.', keywords: 'noise dither texture' },
    { id: 'animBgBlur', label: 'Blur', type: 'slider', section: 'Animated finish', min: 0, max: 30, step: 1, unit: 'px', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, hint: 'Softens the whole scene. Blurred scenes render at a lower resolution, so this also saves power.', keywords: 'soften frosted defocus' },

    { id: 'animBgQuality', label: 'Render quality', type: 'dropdown', section: 'Animated performance', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: 'performance', text: 'Performance (half resolution)' },
        { value: 'balanced', text: 'Balanced' },
        { value: 'quality', text: 'Sharpest (full resolution)' },
    ], hint: 'Lower resolutions use far less GPU on large or high-DPI screens.', keywords: 'resolution gpu performance fps lag' },
    { id: 'animBgFps', label: 'Frame rate', type: 'dropdown', section: 'Animated performance', parent: 'animBgEnabled', when: (t) => t.animBgEnabled, options: [
        { value: '30', text: '30 fps' },
        { value: '60', text: '60 fps' },
        { value: 'max', text: 'Match display' },
    ], keywords: 'fps frame rate smooth performance battery' },

    { id: 'musicVideoDim', label: 'Video dimming', type: 'slider', section: 'Music video', min: 0, max: 1, step: 0.05, hint: 'Darkens the video so lyrics stay readable.', keywords: 'music video darken brightness mv' },
    { id: 'musicVideoCredit', label: 'Video sync credit', type: 'dropdown', section: 'Music video', options: [
        { value: 'video', text: 'While the video is showing' },
        { value: 'always', text: 'Whenever the song has a sync' },
        { value: 'off', text: 'Never' },
    ], hint: 'Adds “Video synced by …” under the song credits, linking to the uploader’s profile.', keywords: 'music video credit uploader synced by profile mv' },

    { id: 'musicVideoLayout', label: 'Video layout', type: 'dropdown', section: 'Video framing', options: [
        { value: 'background', text: 'Full background' },
        { value: 'stage', text: 'Stage beside the lyrics' },
    ], hint: 'Stage puts the video on the player’s side of the page and fades it into the album background, like Spicy Lyrics’ Canvas view. It falls back to the full background when the player is hidden or compact.', keywords: 'music video layout stage canvas side panel immersive full screen background mv' },
    { id: 'musicVideoFullscreenLayout', label: 'Fullscreen layout', type: 'dropdown', section: 'Video framing', options: [
        { value: 'canvas', text: 'Canvas (video beside the lyrics)' },
        { value: 'compact', text: 'Switch to compact' },
        { value: 'keep', text: 'Keep my layout' },
    ], hint: 'How Spicy Lyrics fullscreen looks while a video plays. Canvas puts the video on the player’s side and docks the title and progress bar in the corner, whatever the layout above says. Switch to compact turns on the compact player every time a video starts.', keywords: 'music video fullscreen canvas compact layout stage dock immersive auto switch mv' },
    { id: 'musicVideoFit', label: 'Video fit', type: 'dropdown', section: 'Video framing', options: [
        { value: 'zoom', text: 'Zoom (hide player edges)' },
        { value: 'cover', text: 'Fill (crop to fit)' },
        { value: 'contain', text: 'Fit (show whole video)' },
        { value: 'blend', text: 'Fit and blend edges' },
        { value: 'stretch', text: 'Stretch' },
    ], hint: 'How the video is sized to the window or stage. Zoom crops a little extra so YouTube’s player edges never show; Fit adds bars on screens that aren’t 16:9; Fit and blend is the same size but fades those bars away instead. Only Fit and blend softens the video’s own edges — the edge facing the lyrics always fades in the stage and Canvas layouts.', keywords: 'music video size scale zoom fill fit stretch crop aspect ratio 16:10 letterbox blend feather edges bars mv' },
    { id: 'musicVideoEdgeFeather', label: 'Edge fade', type: 'slider', section: 'Video framing', min: 0, max: 45, step: 1, unit: '%', parent: 'musicVideoFit', when: (t) => t.musicVideoFit === 'blend' || t.musicVideoLayout === 'stage' || t.musicVideoFullscreenLayout === 'canvas', hint: 'How far the video fades into the background, or into its blurred copy. Applies to the edge facing the lyrics in the stage layout, to both blurred sides in Canvas fullscreen, and to every uncovered edge when Video fit is Fit and blend. Set it to 0 for a hard edge.', keywords: 'music video feather fade soft edges blend mv' },
    { id: 'musicVideoTrimBars', label: 'Trim black bars', type: 'toggle', section: 'Video framing', hint: 'Crops bars that are part of the video itself when the uploader or the player has marked them.', keywords: 'music video black bars letterbox pillarbox crop trim mv' },
    { id: 'musicVideoDockPlayer', label: 'Dock the player', type: 'toggle', section: 'Video framing', hint: 'While a video plays, hides the cover and moves the title and progress bar to the bottom corner, like Spicy Lyrics’ Canvas view. Needs a Spicy Lyrics version with Canvas view.', keywords: 'music video dock player hide cover artwork canvas immersive title corner mv' },
    { id: 'musicVideoCompact', label: 'Also in compact player', type: 'toggle', section: 'Video framing', keywords: 'music video compact card mv' },
    { id: 'musicVideoFullscreenCompact', label: 'Also in fullscreen compact', type: 'toggle', section: 'Video framing', when: (t) => !t.musicVideoCompact, hint: 'Keeps the video behind the compact layout while fullscreen, without turning it on for the windowed or popout player.', keywords: 'music video fullscreen compact mv' },

    { id: 'musicVideoAmbient', label: 'Blur the video into the edges', type: 'toggle', section: 'Video blending', hint: 'Fills the space around a staged or fitted video with a blurred copy of the same video instead of the album background. Needs the built-in 7Tube player; YouTube fallback and MP4 videos keep the album background.', keywords: 'music video ambient blur glow mirror sides edges bars background canvas mv' },
    { id: 'musicVideoAmbientBand', label: 'Blurred sides in fullscreen', type: 'slider', section: 'Video blending', min: 0, max: 30, step: 1, unit: '%', parent: 'musicVideoAmbient', when: (t) => t.musicVideoFullscreenLayout === 'canvas' && t.musicVideoAmbient !== false, hint: 'How much of each side the blurred copy covers in Canvas fullscreen. The video keeps its full height either way, so this only trims the sides. Set it to 0% and the video fills the whole screen; a video shaped differently from your screen still blurs into the space it leaves.', keywords: 'music video blur edges sides ambient canvas fullscreen width band pillarbox full screen mv' },
    { id: 'musicVideoBlurStyle', label: 'Blur style', type: 'dropdown', section: 'Video blending', options: [
        { value: 'gaussian', text: 'Gaussian (smooth)' },
        { value: 'frosted', text: 'Frosted glass' },
        { value: 'pixel', text: 'Pixelated' },
        { value: 'focus', text: 'Focus (soft picture edges)' },
    ], parent: 'musicVideoAmbient', when: (t) => t.musicVideoAmbient !== false, hint: 'The look of the blurred copy around a fitted or staged video. Frosted brightens and softens it, Pixelated turns it into a mosaic, Focus melts the picture’s own edges into the blur. Saved with the theme, and needs the built-in 7Tube player.', keywords: 'music video blur style mode type gaussian frosted glass pixelated pixel mosaic focus progressive tilt shift ambient fit blend edges mv' },
    { id: 'musicVideoBlurStrength', label: 'Blur style strength', type: 'slider', section: 'Video blending', min: 0, max: 100, step: 5, unit: '%', parent: 'musicVideoBlurStyle', when: (t) => t.musicVideoAmbient !== false && t.musicVideoBlurStyle !== 'gaussian', hint: 'How heavy the frost is, how big the mosaic blocks are, or how far Focus reaches into the picture.', keywords: 'music video blur strength amount size intensity pixel block frost focus depth mv' },
    { id: 'musicVideoBackdrop', label: 'Video backdrop', type: 'dropdown', section: 'Video blending', options: [
        { value: 'solid', text: 'Replace the background' },
        { value: 'blend', text: 'Blend over Spicy Lyrics / image' },
    ], hint: 'Blend mixes the video with the album background or your custom image instead of covering it.', keywords: 'music video behind transparent overlay mix mv' },
    { id: 'musicVideoBlend', label: 'Video strength', type: 'slider', section: 'Video blending', min: 0.1, max: 1, step: 0.05, parent: 'musicVideoBackdrop', when: (t) => t.musicVideoBackdrop === 'blend', hint: 'How much of the video shows through. Lower values keep more of the background.', keywords: 'music video opacity mix amount mv' },
    { id: 'musicVideoPlayerFade', label: 'Player transparency', type: 'slider', section: 'Video blending', min: 0, max: 100, step: 5, unit: '%', hint: 'Fades the cover, title and progress bar while a video plays so more of it shows. 100% hides them until you hover.', keywords: 'music video player nowbar cover artwork title progress hide fade transparent opacity minimize mv' },

    { id: 'playerStylingEnabled', label: 'Restyle the player', type: 'toggle', section: 'Player styling', hint: 'Unlocks the controls below for the Spicy Lyrics player bar.', keywords: 'nowbar controls player' },
    { id: 'playerArtRadius', label: 'Album art roundness', type: 'slider', section: 'Player styling', min: 0, max: 50, step: 1, unit: '%', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'corner radius rounded' },
    { id: 'playerProgressThickness', label: 'Progress bar thickness', type: 'slider', section: 'Player styling', min: 0.5, max: 5, step: 0.5, unit: 'x', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'seek bar height' },
    { id: 'playerAccentEnabled', label: 'Custom progress colour', type: 'toggle', section: 'Player styling', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, hint: 'Overrides the accent colour on the progress and volume bars.', keywords: 'accent seek volume colour' },
    { id: 'playerAccentColor', label: 'Progress colour', type: 'color', section: 'Player styling', parent: 'playerAccentEnabled', when: (t) => t.playerStylingEnabled && t.playerAccentEnabled },
    { id: 'playerControlsAnimation', label: 'Animate control buttons', type: 'toggle', section: 'Player styling', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, keywords: 'hover bounce buttons' },

    { id: 'playerHideShuffle', label: 'Hide shuffle', type: 'toggle', section: 'Hide controls', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideRepeat', label: 'Hide repeat', type: 'toggle', section: 'Hide controls', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideLike', label: 'Hide like (heart)', type: 'toggle', section: 'Hide controls', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideVolume', label: 'Hide volume slider', type: 'toggle', section: 'Hide controls', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, hint: 'Removes the fullscreen volume capsule. Spotify’s own volume still works.', keywords: 'volume slider capsule sound' },
    { id: 'playerHideViewControls', label: 'Hide top buttons', type: 'toggle', section: 'Hide controls', parent: 'playerStylingEnabled', when: (t) => t.playerStylingEnabled, hint: 'Keeps the compact, translate, video, fullscreen, settings and close buttons invisible until you point at them.', keywords: 'view controls buttons toolbar close settings fullscreen compact translate top bar' },

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

    { id: 'sltStylingEnabled', label: 'Style translated lines', type: 'toggle', section: 'Translated lines', hint: 'Requires the Spicy Lyrics Translator extension. Styles the translation lines and Learning Mode word cards it adds, including the translations under background vocals.', keywords: 'slt translator subtitle background vocals backing vocals bg lines' },
    { id: 'sltIndependent', label: 'Style translations independently', type: 'toggle', section: 'Translated lines', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled, hint: 'Gives translated lines their own copy of every lyric control — colours, gradient, typography, glow, focus and motion — instead of following the main lyrics.', keywords: 'independent separate own controls mirror full' },

    { id: 'sltTranslationFont', label: 'Font', type: 'dropdown', section: 'Translation basics', options: [...TRANSLATION_FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationFont', label: 'Custom font name', type: 'text', section: 'Translation basics', placeholder: "e.g. 'Inter', sans-serif", parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltTranslationFont !== '' && !TRANSLATION_FONT_OPTIONS.some(o => o.value === t.sltTranslationFont) },
    { id: 'sltTranslationFontSize', label: 'Text size', type: 'slider', section: 'Translation basics', min: 0.25, max: 2.0, step: 0.05, unit: 'x', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent, hint: 'Scales every translation line. Translations under background vocals keep their smaller size relative to this.', keywords: 'background vocals backing vocals bg lines scale' },
    { id: 'sltBgLineScale', label: 'Background vocal size', type: 'slider', section: 'Translation basics', min: 0.25, max: 1.5, step: 0.05, unit: 'x', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled, hint: 'How big the translation under a background vocal line is next to the other translation lines. 1x makes them match.', keywords: 'background vocals backing vocals bg lines smaller shrink size scale' },
    { id: 'sltTranslationOpacity', label: 'Opacity', type: 'slider', section: 'Translation basics', min: 0.1, max: 1.0, step: 0.05, parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltHighlightStartColor', label: 'Highlight start', type: 'color', section: 'Translation basics', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltHighlightEndColor', label: 'Highlight end', type: 'color', section: 'Translation basics', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationColorEnabled', label: 'Custom base colour', type: 'toggle', section: 'Translation basics', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltTranslationColor', label: 'Base colour', type: 'color', section: 'Translation basics', parent: 'sltTranslationColorEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltTranslationColorEnabled },
    { id: 'sltGlowColorEnabled', label: 'Custom glow colour', type: 'toggle', section: 'Translation basics', parent: 'sltStylingEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent },
    { id: 'sltGlowColor', label: 'Glow colour', type: 'color', section: 'Translation basics', parent: 'sltGlowColorEnabled', when: (t) => t.sltStylingEnabled && !t.sltIndependent && t.sltGlowColorEnabled },

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

    { id: 'sltDisableHighlight', label: 'Flat colour mode', type: 'toggle', section: 'Translation flat colour', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Turns off the sweeping fill on translations — every translated line uses one solid colour.', keywords: 'translation no karaoke disable highlight solid' },
    { id: 'sltHighlightColor', label: 'Flat colour', type: 'color', section: 'Translation flat colour', parent: 'sltDisableHighlight', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltDisableHighlight },

    { id: 'sltFontFamily', label: 'Font', type: 'dropdown', section: 'Translation font', options: [...TRANSLATION_FONT_OPTIONS, { value: '__custom__', text: 'Custom…' }], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation typeface family' },
    { id: 'sltFontFamily', label: 'Custom font name', type: 'text', section: 'Translation font', placeholder: "e.g. 'Inter', sans-serif", when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltFontFamily !== '' && !TRANSLATION_FONT_OPTIONS.some(o => o.value === t.sltFontFamily) },
    { id: 'sltFontWeight', label: 'Weight', type: 'dropdown', section: 'Translation font', options: WEIGHT_OPTIONS, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation bold thin' },
    { id: 'sltActiveLineWeight', label: 'Active line weight', type: 'dropdown', section: 'Translation font', options: [{ value: '0', text: 'Same as above' }, ...WEIGHT_OPTIONS], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation bold emphasis active' },
    { id: 'sltTextTransform', label: 'Capitalisation', type: 'dropdown', section: 'Translation font', options: [
        { value: 'none', text: 'As written' },
        { value: 'uppercase', text: 'UPPERCASE' },
        { value: 'lowercase', text: 'lowercase' },
        { value: 'capitalize', text: 'Title Case' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation uppercase lowercase caps case' },
    { id: 'sltFontStyle', label: 'Style', type: 'dropdown', section: 'Translation font', options: [
        { value: 'normal', text: 'Upright' },
        { value: 'italic', text: 'Italic' },
        { value: 'oblique', text: 'Oblique (slanted)' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation italic slant oblique' },

    { id: 'sltLyricsScale', label: 'Text size', type: 'slider', section: 'Translation size', min: 0.25, max: 2.0, step: 0.05, unit: 'x', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation scale bigger smaller font size' },
    { id: 'sltLetterSpacing', label: 'Letter spacing', type: 'slider', section: 'Translation size', min: -0.1, max: 0.3, step: 0.01, unit: 'em', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation tracking kerning' },
    { id: 'sltWordSpacing', label: 'Word spacing', type: 'slider', section: 'Translation size', min: -0.1, max: 1.0, step: 0.02, unit: 'em', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation gap space between words' },
    { id: 'sltLineHeight', label: 'Line spacing', type: 'slider', section: 'Translation size', min: 1.0, max: 2.5, step: 0.01, when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation leading gap' },

    { id: 'sltTextAlign', label: 'Alignment', type: 'dropdown', section: 'Translation layout', options: [
        { value: 'default', text: 'Follow Spicy Lyrics' },
        { value: 'left', text: 'Left' },
        { value: 'center', text: 'Centre' },
        { value: 'right', text: 'Right' },
    ], when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation align left right centre' },
    { id: 'sltMaxLineWidth', label: 'Max line width', type: 'slider', section: 'Translation layout', min: 0, max: 100, step: 5, unit: '%', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation measure wrap width column' },

    { id: 'sltGlowEnabled', label: 'Line glow', type: 'toggle', section: 'Translation glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Adds a soft halo around every translated line.', keywords: 'translation halo neon shine bloom' },
    { id: 'sltActiveGlowColor', label: 'Active line colour', type: 'color', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltActiveGlowIntensity', label: 'Active line strength', type: 'slider', section: 'Translation glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltInactiveGlowColor', label: 'Other lines colour', type: 'color', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltGlowIntensity', label: 'Other lines strength', type: 'slider', section: 'Translation glow', min: 0, max: 15, step: 1, unit: 'px', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled },
    { id: 'sltGlowPulse', label: 'Pulse the active line', type: 'toggle', section: 'Translation glow', parent: 'sltGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled, keywords: 'translation breathe pulse animate' },
    { id: 'sltGlowPulseSpeed', label: 'Pulse speed', type: 'slider', section: 'Translation glow', min: 0.3, max: 3.0, step: 0.1, unit: 'x', parent: 'sltGlowPulse', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltGlowEnabled && t.sltGlowPulse },

    { id: 'sltBgGlowEnabled', label: 'Active word glow', type: 'toggle', section: 'Translation word glow', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Lights up only the translated word being sung right now.', keywords: 'translation karaoke halo neon' },
    { id: 'sltBgGlowColor', label: 'Word glow colour', type: 'color', section: 'Translation word glow', parent: 'sltBgGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBgGlowEnabled },
    { id: 'sltBgGlowIntensity', label: 'Word glow strength', type: 'slider', section: 'Translation word glow', min: 0, max: 30, step: 1, unit: 'px', parent: 'sltBgGlowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBgGlowEnabled },

    { id: 'sltTextShadowEnabled', label: 'Text shadow', type: 'toggle', section: 'Translation shadow', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation drop shadow outline readability' },
    { id: 'sltTextShadowColor', label: 'Shadow colour', type: 'color', section: 'Translation shadow', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOpacity', label: 'Shadow opacity', type: 'slider', section: 'Translation shadow', min: 0, max: 1, step: 0.05, parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowBlur', label: 'Shadow blur', type: 'slider', section: 'Translation shadow', min: 0, max: 20, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOffsetX', label: 'Shadow offset X', type: 'slider', section: 'Translation shadow', min: -10, max: 10, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },
    { id: 'sltTextShadowOffsetY', label: 'Shadow offset Y', type: 'slider', section: 'Translation shadow', min: -10, max: 10, step: 1, unit: 'px', parent: 'sltTextShadowEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextShadowEnabled },

    { id: 'sltTextStrokeEnabled', label: 'Text outline', type: 'toggle', section: 'Translation outline', when: (t) => t.sltStylingEnabled && t.sltIndependent, keywords: 'translation stroke border outline edge' },
    { id: 'sltTextStrokeColor', label: 'Outline colour', type: 'color', section: 'Translation outline', parent: 'sltTextStrokeEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextStrokeEnabled },
    { id: 'sltTextStrokeWidth', label: 'Outline width', type: 'slider', section: 'Translation outline', min: 0, max: 3, step: 0.1, unit: 'px', parent: 'sltTextStrokeEnabled', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltTextStrokeEnabled },

    { id: 'sltBlurUnsung', label: 'Blur other lines', type: 'toggle', section: 'Translation blur', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Softens every translated line except the one being sung.', keywords: 'translation depth of field defocus soft' },
    { id: 'sltBlurAmount', label: 'Blur amount', type: 'slider', section: 'Translation blur', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'sltBlurUnsung', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurUnsung },

    { id: 'sltBlurSungWords', label: 'Fade words as they pass', type: 'toggle', section: 'Translation word fade', when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Blurs each translated word once it has been sung.', keywords: 'translation karaoke word blur trail' },
    { id: 'sltBlurSungWordsAmount', label: 'Word blur amount', type: 'slider', section: 'Translation word fade', min: 0, max: 8, step: 0.5, unit: 'px', parent: 'sltBlurSungWords', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurSungWords },
    { id: 'sltBlurSungWordsOpacity', label: 'Word opacity', type: 'slider', section: 'Translation word fade', min: 0.05, max: 1.0, step: 0.05, parent: 'sltBlurSungWords', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltBlurSungWords },

    { id: 'sltWordEffect', label: 'Word animation', type: 'dropdown', section: 'Translation word animation', options: WORD_EFFECT_OPTIONS, when: (t) => t.sltStylingEnabled && t.sltIndependent, hint: 'Animates individual words in the active translation.', keywords: 'translation bounce pop wave stamp shake glitch rise sway animate word' },
    { id: 'sltWordEffectTrigger', label: 'Fires', type: 'dropdown', section: 'Translation word animation', options: [
        { value: 'auto', text: 'Recommended for this animation' },
        { value: 'word', text: 'As each word is sung' },
        { value: 'line', text: 'When the line starts' },
        { value: 'loop', text: 'Continuously' },
    ], parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation trigger timing sync' },
    { id: 'sltWordEffectIntensity', label: 'Intensity', type: 'slider', section: 'Translation word animation', min: 0.1, max: 2.0, step: 0.05, unit: 'x', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation strength amount' },
    { id: 'sltWordEffectSpeed', label: 'Speed', type: 'slider', section: 'Translation word animation', min: 0.3, max: 3.0, step: 0.05, unit: 'x', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none', keywords: 'translation duration fast slow' },
    { id: 'sltWordEffectStagger', label: 'Stagger between words', type: 'slider', section: 'Translation word animation', min: 0, max: 150, step: 5, unit: 'ms', parent: 'sltWordEffect', when: (t) => t.sltStylingEnabled && t.sltIndependent && t.sltWordEffect !== 'none' && resolveWordTrigger(t.sltWordEffect, t.sltWordEffectTrigger) !== 'word', keywords: 'translation delay ripple cascade' },

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
            const angle = DIRECTION_ANGLES[t.gradientDirection] ?? (t.gradientDirection === 'custom' ? t.gradientAngle : 90);
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

    const inactiveScale = Math.min(Math.max(Number(t.inactiveLineScale) || 1, 0.5), 1);
    [sung, unsung].forEach(line => {
        if (!line) return;
        line.style.transformOrigin = t.textAlign === 'right' ? 'right center' : t.textAlign === 'center' ? 'center' : 'left center';
        line.style.transform = inactiveScale < 1 ? `scale(${inactiveScale})` : '';
    });

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
    liveApply(key, () => updateThemeProperty(key, value), key === 'sltIndependent' && value === true);
}

function liveCoverUpdate(key: keyof ThemeConfig, choice: CoverChoice | null): void {
    liveApply(key, () => setCoverColor(key, choice));
}

function liveApply(key: keyof ThemeConfig, apply: () => void, resync = false): void {
    const wasNative = !themeState.activeTheme.lyricsStylingEnabled;
    apply();
    injectThemeStyles();
    const leftNative = wasNative && key !== 'lyricsStylingEnabled' && themeState.activeTheme.lyricsStylingEnabled;
    if (resync || leftNative) {
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
    const cover = isCoverField(def) ? ' cover album artwork art song colour color hue saturation brightness hsv' : '';
    return `${def.label} ${def.section} ${sectionLabel(def.section)} ${def.hint || ''} ${def.keywords || ''}${cover}`.toLowerCase().includes(q);
}

function isCoverField(def: FieldDef): boolean {
    return def.type === 'color' && COVER_COLOR_KEYS.includes(def.id);
}

function sameCoverChoice(a: CoverChoice | null, b: CoverChoice | null): boolean {
    if (!a || !b) return a === b;
    return a.src === b.src && a.h === b.h && a.s === b.s && a.v === b.v;
}

const coverRepaints = new Map<HTMLElement, () => void>();
let coverConsumerHooked = false;

function liveCoverRows(): (() => void)[] {
    coverRepaints.forEach((_, row) => {
        if (!row.isConnected) coverRepaints.delete(row);
    });
    return Array.from(coverRepaints.values());
}

function hookCoverPreview(): void {
    if (coverConsumerHooked) return;
    coverConsumerHooked = true;
    registerCoverConsumer(
        () => liveCoverRows().length > 0,
        () => liveCoverRows().forEach(fn => fn()),
    );
}

const COVER_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5"></rect><circle cx="8" cy="8" r="3"></circle><circle cx="8" cy="8" r="0.6" fill="currentColor"></circle></svg>';

const COVER_SLIDERS: { key: 'h' | 's' | 'v'; label: string; min: number; max: number; unit: string }[] = [
    { key: 'h', label: 'Hue', min: -COVER_HUE_RANGE, max: COVER_HUE_RANGE, unit: '°' },
    { key: 's', label: 'Saturation', min: -COVER_SHIFT_RANGE, max: COVER_SHIFT_RANGE, unit: '%' },
    { key: 'v', label: 'Brightness', min: -COVER_SHIFT_RANGE, max: COVER_SHIFT_RANGE, unit: '%' },
];

function signed(n: number, unit: string): string {
    return `${n > 0 ? '+' : ''}${n}${unit}`;
}

function buildCoverControls(def: FieldDef, input: HTMLInputElement, row: HTMLElement): { button: HTMLButtonElement; panel: HTMLElement; sync: () => void } {
    hookCoverPreview();
    const key = def.id;
    const choice = () => coverChoiceFor(themeState.activeTheme, key);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'st-m-cover-btn';
    button.innerHTML = COVER_SVG;

    const panel = document.createElement('div');
    panel.className = 'st-m-cover-panel';

    const sources = document.createElement('div');
    sources.className = 'st-m-cover-sources';
    sources.setAttribute('role', 'radiogroup');
    sources.setAttribute('aria-label', `${def.label} cover colour`);
    const sourceButtons = (['primary', 'secondary'] as CoverSource[]).map(src => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-m-cover-source';
        b.setAttribute('role', 'radio');
        const swatch = document.createElement('span');
        swatch.className = 'st-m-cover-swatch';
        const text = document.createElement('span');
        text.textContent = src === 'primary' ? 'Primary' : 'Secondary';
        b.append(swatch, text);
        b.addEventListener('click', () => {
            const cur = choice();
            if (!cur || cur.src === src) return;
            liveCoverUpdate(key, { ...cur, src });
        });
        sources.appendChild(b);
        return { src, b, swatch };
    });

    const result = document.createElement('span');
    result.className = 'st-m-cover-result';
    const resultSwatch = document.createElement('span');
    resultSwatch.className = 'st-m-cover-swatch';
    const resultText = document.createElement('span');
    result.append(resultSwatch, resultText);
    sources.appendChild(result);
    panel.appendChild(sources);

    const sliders = COVER_SLIDERS.map(cfg => {
        const wrap = document.createElement('label');
        wrap.className = 'st-m-cover-slider';
        const name = document.createElement('span');
        name.className = 'st-m-cover-slider-label';
        name.textContent = cfg.label;
        const range = document.createElement('input');
        range.type = 'range';
        range.className = 'st-m-slider';
        range.min = String(cfg.min);
        range.max = String(cfg.max);
        range.step = '1';
        const value = document.createElement('span');
        value.className = 'st-m-slider-value';
        range.addEventListener('input', () => {
            const cur = choice();
            if (!cur) return;
            const n = parseInt(range.value, 10) || 0;
            value.textContent = signed(n, cfg.unit);
            liveCoverUpdate(key, { ...cur, [cfg.key]: n });
        });
        range.addEventListener('dblclick', () => {
            const cur = choice();
            if (!cur || cur[cfg.key] === 0) return;
            liveCoverUpdate(key, { ...cur, [cfg.key]: 0 });
            sync();
        });
        wrap.append(name, range, value);
        panel.appendChild(wrap);
        return { cfg, range, value };
    });

    const note = document.createElement('div');
    note.className = 'st-m-cover-note';
    panel.appendChild(note);

    button.addEventListener('click', () => {
        if (choice()) {
            liveCoverUpdate(key, null);
        } else {
            liveCoverUpdate(key, { src: 'primary', h: 0, s: 0, v: 0 });
        }
        sync();
    });

    const sync = () => {
        const cur = choice();
        const on = !!cur;
        const palette = currentCoverPalette();
        button.classList.toggle('st-m-cover-btn-on', on);
        button.setAttribute('aria-pressed', String(on));
        const label = on ? `${def.label}: following the album cover. Click to use a fixed colour.` : `Use the album cover colour for ${def.label.toLowerCase()}`;
        button.title = label;
        button.setAttribute('aria-label', label);
        row.classList.toggle('st-m-field-cover-on', on);
        panel.hidden = !on;
        input.classList.toggle('st-m-color-cover', on);
        sourceButtons.forEach(({ src, b, swatch }) => {
            const active = !!cur && cur.src === src;
            b.classList.toggle('st-m-cover-source-on', active);
            b.setAttribute('aria-checked', String(active));
            swatch.style.background = palette ? rgbToHex(palette[src]) : '';
        });
        if (!cur) return;
        sliders.forEach(({ cfg, range, value }) => {
            range.value = String(cur[cfg.key]);
            value.textContent = signed(cur[cfg.key], cfg.unit);
        });
        const hex = coverColorHex(cur, palette);
        resultSwatch.style.background = hex || '';
        resultText.textContent = hex ? hex.toUpperCase() : '';
        result.hidden = !hex;
        note.textContent = hex
            ? 'Changes with every song. Double-click a slider to reset it.'
            : 'Play a song to load its cover colours. Until then the colour picker’s value is used.';
        if (hex) input.value = hex;
    };

    coverRepaints.set(row, sync);
    requestAnimationFrame(() => refreshCoverPalette());

    return { button, panel, sync };
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
        const bodyRows = Array.from(sec.querySelectorAll<HTMLElement>('.st-m-sec-body .st-m-field'));
        sec.classList.toggle('st-m-sec-folded', !bodyRows.some(f => f.style.display !== 'none'));
    });

    czSectionHandles.forEach(h => {
        if (h.jump) h.jump.style.display = h.el.style.display === 'none' ? 'none' : '';
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

    refreshSectionMeters();
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
    if (themeState.activeTheme[def.id] !== baseline.config[def.id]) return false;
    if (!isCoverField(def)) return true;
    return sameCoverChoice(coverChoiceFor(themeState.activeTheme, def.id), coverChoiceFor(baseline.config, def.id));
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
        hint.title = def.hint;
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
            if (!isCoverField(def)) {
                input.addEventListener('input', () => liveUpdate(def.id, input.value as any));
                control.appendChild(input);
                sync = () => { input.value = toColorInputValue(String(themeState.activeTheme[def.id] ?? '')); };
                break;
            }
            const cover = buildCoverControls(def, input, row);
            input.addEventListener('input', () => {
                if (coverChoiceFor(themeState.activeTheme, def.id)) {
                    setCoverColor(def.id, null);
                    cover.sync();
                }
                liveUpdate(def.id, input.value as any);
            });
            control.append(cover.button, input);
            row.appendChild(cover.panel);
            sync = () => {
                input.value = toColorInputValue(String(themeState.activeTheme[def.id] ?? ''));
                cover.sync();
            };
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
        if (isCoverField(def)) setCoverColor(def.id, coverChoiceFor(baseline.config, def.id));
        liveUpdate(def.id, baseline.config[def.id]);
        syncAllFields();
    });
    control.appendChild(reset);

    const refreshReset = () => {
        const changed = !isBaselineValue(def);
        row.classList.toggle('st-m-changed', changed);
        reset.classList.toggle('st-m-field-reset-on', changed);
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
    refreshSectionMeters();
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

interface CzSectionDef {
    name: string;
    label?: string;
    desc?: string;
    master?: keyof ThemeConfig;
}

const CZ_SECTIONS: CzSectionDef[] = [
    { name: 'Lyric styling', master: 'lyricsStylingEnabled' },
    { name: 'Line colours', desc: 'The three states every line moves through as a song plays.' },
    { name: 'Gradient text', master: 'gradientEnabled' },
    { name: 'Flat colour', master: 'disableHighlight' },
    { name: 'Font', desc: 'Typeface, weight and casing.' },
    { name: 'Size and spacing', desc: 'How big the lyrics are and how much air sits between them.' },
    { name: 'Line layout', desc: 'Where lines sit and how far they are allowed to run.' },

    { name: 'Line glow', master: 'glowEnabled' },
    { name: 'Word glow', master: 'bgGlowEnabled' },
    { name: 'Text shadow', master: 'textShadowEnabled' },
    { name: 'Text outline', master: 'textStrokeEnabled' },

    { name: 'Blur other lines', master: 'blurUnsung' },
    { name: 'Fade sung words', master: 'blurSungWords' },
    { name: 'Visible lines', master: 'lineWindowEnabled' },

    { name: 'Word animation', desc: 'Animates single words inside the line being sung.' },
    { name: 'Line emphasis', desc: 'How far the active line stands out from the lines around it.' },
    { name: 'Line entrance', master: 'scaleInEffect' },
    { name: 'Timing', desc: 'One multiplier over every animation above.' },

    { name: 'Colour tint', master: 'pageBgOverlay' },
    { name: 'Custom image', master: 'pageBgImageEnabled' },
    { name: 'Animated background', master: 'animBgEnabled' },
    { name: 'Animated motion', desc: 'How fast it moves and how hard it reacts to the music.' },
    { name: 'Animated shape', desc: 'The geometry the chosen style draws with.' },
    { name: 'Animated finish', desc: 'Light, grain and softness over the finished frame.' },
    { name: 'Animated performance', desc: 'Turn these down if the background costs you frames.' },
    { name: 'Music video', master: 'musicVideoEnabled' },
    { name: VIDEO_LIST_SECTION, label: 'Songs that play videos', desc: 'Block single songs or only allow the ones you pick. Stays on this device, not in the theme.' },
    { name: 'Video framing', desc: 'Where the video sits and how it is cropped.' },
    { name: 'Video blending', desc: 'How the video meets whatever is around it.' },
    { name: 'Video quality', desc: 'The resolution the built-in player asks for.' },

    { name: 'Player styling', master: 'playerStylingEnabled' },
    { name: 'Hide controls', desc: 'Take buttons off the player you never press.' },
    { name: 'Equalizer', label: 'Song title equalizer', master: 'eqEnabled' },
    { name: FULLSCREEN_SECTION, label: 'Fullscreen and cinema view', desc: 'These follow you, not the theme.' },

    { name: 'Translated lines', master: 'sltStylingEnabled' },
    { name: 'Translation basics', label: 'Shared look', desc: 'Applies while translations follow the main lyric styling.' },
    { name: 'Translation colours', label: 'Line colours' },
    { name: 'Translation gradient', label: 'Gradient text', master: 'sltGradientEnabled' },
    { name: 'Translation flat colour', label: 'Flat colour', master: 'sltDisableHighlight' },
    { name: 'Translation font', label: 'Font' },
    { name: 'Translation size', label: 'Size and spacing' },
    { name: 'Translation layout', label: 'Line layout' },
    { name: 'Translation glow', label: 'Line glow', master: 'sltGlowEnabled' },
    { name: 'Translation word glow', label: 'Word glow', master: 'sltBgGlowEnabled' },
    { name: 'Translation shadow', label: 'Text shadow', master: 'sltTextShadowEnabled' },
    { name: 'Translation outline', label: 'Text outline', master: 'sltTextStrokeEnabled' },
    { name: 'Translation blur', label: 'Blur other lines', master: 'sltBlurUnsung' },
    { name: 'Translation word fade', label: 'Fade sung words', master: 'sltBlurSungWords' },
    { name: 'Translation word animation', label: 'Word animation' },
    { name: 'Translation motion', label: 'Motion' },
];

const CZ_SECTION_BY_NAME = new Map(CZ_SECTIONS.map(s => [s.name, s]));

function sectionLabel(name: string): string {
    return CZ_SECTION_BY_NAME.get(name)?.label || name;
}

function categoryChangedCount(cat: CzCategory): number {
    return dedupedSchema().filter(def => cat.sections.includes(def.section) && !isBaselineValue(def)).length;
}

const CZ_CATEGORIES: CzCategory[] = [
    {
        id: 'cz-text',
        label: 'Text',
        icon: 'Aa',
        description: 'The colour, font and size of the lyrics themselves.',
        sections: ['Lyric styling', 'Line colours', 'Gradient text', 'Flat colour', 'Font', 'Size and spacing', 'Line layout'],
    },
    {
        id: 'cz-glow',
        label: 'Glow',
        icon: '✦',
        description: 'Halos, shadows and outlines around the text.',
        sections: ['Line glow', 'Word glow', 'Text shadow', 'Text outline'],
    },
    {
        id: 'cz-focus',
        label: 'Focus',
        icon: '◎',
        description: 'Draw the eye to the line being sung by softening or hiding the rest.',
        sections: ['Blur other lines', 'Fade sung words', 'Visible lines'],
    },
    {
        id: 'cz-motion',
        label: 'Motion',
        icon: '⟩',
        description: 'How lines and words animate as the song plays.',
        sections: ['Word animation', 'Line emphasis', 'Line entrance', 'Timing'],
    },
    {
        id: 'cz-background',
        label: 'Background',
        icon: '▦',
        description: 'What sits behind the lyrics.',
        sections: [
            'Colour tint',
            'Custom image',
            ANIM_BG_SECTION,
            'Animated motion',
            'Animated shape',
            'Animated finish',
            'Animated performance',
            MUSIC_VIDEO_SECTION,
            VIDEO_LIST_SECTION,
            'Video framing',
            'Video blending',
            VIDEO_QUALITY_SECTION,
        ],
    },
    {
        id: 'cz-player',
        label: 'Player',
        icon: '♪',
        description: 'The Now Playing bar inside the Spicy Lyrics window.',
        sections: ['Player styling', 'Hide controls', 'Equalizer', FULLSCREEN_SECTION],
    },
    {
        id: 'cz-translation',
        label: 'Translation',
        icon: '文',
        description: 'Styling for lines added by the Spicy Lyrics Translator extension.',
        sections: [
            'Translated lines',
            'Translation basics',
            'Translation colours',
            'Translation gradient',
            'Translation flat colour',
            'Translation font',
            'Translation size',
            'Translation layout',
            'Translation glow',
            'Translation word glow',
            'Translation shadow',
            'Translation outline',
            'Translation blur',
            'Translation word fade',
            'Translation word animation',
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

const VIDEO_LIST_DEF: FieldDef = {
    id: 'musicVideoEnabled',
    label: 'Songs that play videos',
    type: 'toggle',
    section: VIDEO_LIST_SECTION,
    keywords: 'music video blacklist whitelist blocklist allowlist block allow never play skip disable song list exclude only mv',
};

interface PrefDef {
    def: FieldDef;
    get: () => boolean;
    set: (value: boolean) => void;
}

const FULLSCREEN_PREFS: PrefDef[] = [
    {
        def: {
            id: 'musicVideoEnabled',
            label: 'Hide the cursor when idle',
            type: 'toggle',
            section: FULLSCREEN_SECTION,
            hint: 'In fullscreen and cinema view the pointer disappears after a few seconds without mouse movement and comes back when you move it.',
            keywords: 'cursor mouse pointer hide idle auto fullscreen cinema view',
        },
        get: fullscreenHideCursor,
        set: setFullscreenHideCursor,
    },
    {
        def: {
            id: 'musicVideoEnabled',
            label: 'Hide the Now Playing bar',
            type: 'toggle',
            section: FULLSCREEN_SECTION,
            hint: 'Slides the cover, title and controls away in fullscreen and cinema view so the lyrics get the whole screen. The top buttons show while you move the mouse, and one of them brings the bar back.',
            keywords: 'nowbar now playing bar cover artwork album hide lyrics only full width screen cinema view fullscreen',
        },
        get: fullscreenHideNowBar,
        set: setFullscreenHideNowBar,
    },
];

function buildPrefRow(pref: PrefDef): FieldHandle {
    const row = document.createElement('div');
    row.className = 'st-m-field st-m-field-toggle';
    const labelBox = document.createElement('div');
    labelBox.className = 'st-m-field-labelbox';
    const label = document.createElement('label');
    label.className = 'st-m-field-label';
    label.textContent = pref.def.label;
    labelBox.appendChild(label);
    if (pref.def.hint) {
        const hint = document.createElement('div');
        hint.className = 'st-m-field-hint';
        hint.textContent = pref.def.hint;
        hint.title = pref.def.hint;
        labelBox.appendChild(hint);
    }
    const control = document.createElement('div');
    control.className = 'st-m-field-control';
    const wrap = document.createElement('label');
    wrap.className = 'st-m-toggle';
    wrap.innerHTML = '<input type="checkbox"><span class="st-m-toggle-slider"></span>';
    const input = wrap.querySelector('input') as HTMLInputElement;
    input.setAttribute('aria-label', pref.def.label);
    input.checked = pref.get();
    input.addEventListener('change', () => pref.set(input.checked));
    control.appendChild(wrap);
    row.append(labelBox, control);
    return { row, def: pref.def, sync: () => { input.checked = pref.get(); }, refreshReset: () => {} };
}

function buildFullscreenSection(): { el: HTMLElement; body: HTMLElement } {
    const built = buildSectionShell(FULLSCREEN_SECTION, [], null);
    FULLSCREEN_PREFS.forEach(pref => {
        const handle = buildPrefRow(pref);
        czFields.push(handle);
        built.body.appendChild(handle.row);
    });
    return built;
}

function buildVideoListSection(): { el: HTMLElement; body: HTMLElement } {
    const panel = buildVideoListPanel();
    czFields.push({ row: panel.root, def: VIDEO_LIST_DEF, sync: panel.sync, refreshReset: () => {} });
    const built = buildSectionShell(VIDEO_LIST_SECTION, [], null);
    built.body.appendChild(panel.root);
    return built;
}

onFullscreenPrefsChange(() => {
    czFields.forEach(f => {
        if (f.row.isConnected && f.def.section === FULLSCREEN_SECTION) f.sync();
    });
});

interface CzSectionHandle {
    el: HTMLElement;
    body: HTMLElement;
    chip: HTMLButtonElement;
    jump: HTMLButtonElement | null;
    defs: FieldDef[];
}

let czSectionHandles: CzSectionHandle[] = [];
let czCategoryHandles: { el: HTMLElement; count: HTMLElement; reset: HTMLButtonElement; defs: FieldDef[] }[] = [];

function resetDefs(title: string, defs: FieldDef[]): void {
    const dirty = defs.filter(d => !isBaselineValue(d));
    if (!dirty.length) return;
    const target = baseline.name === 'default' ? 'the default' : `“${baseline.name}”`;
    undoable(`${title} reset`, `${dirty.length} setting${dirty.length === 1 ? '' : 's'} back to ${target}.`, () => {
        dirty.forEach(def => {
            if (isCoverField(def)) setCoverColor(def.id, coverChoiceFor(baseline.config, def.id));
            liveUpdate(def.id, baseline.config[def.id]);
        });
    });
    syncAllFields();
}

function refreshSectionMeters(): void {
    czSectionHandles = czSectionHandles.filter(h => h.el.isConnected);
    czCategoryHandles = czCategoryHandles.filter(h => h.el.isConnected);

    czSectionHandles.forEach(h => {
        const changed = h.defs.filter(d => !isBaselineValue(d)).length;
        h.chip.hidden = changed === 0;
        h.chip.textContent = String(changed);
        h.chip.title = `Reset ${changed} changed setting${changed === 1 ? '' : 's'} in this group`;
        h.el.classList.toggle('st-m-sec-dirty', changed > 0);
        if (h.jump) h.jump.classList.toggle('st-m-cz-jump-dirty', changed > 0);
    });

    czCategoryHandles.forEach(h => {
        const changed = h.defs.filter(d => !isBaselineValue(d)).length;
        h.count.textContent = changed
            ? `${changed} setting${changed === 1 ? '' : 's'} changed here`
            : 'Nothing changed here yet';
        h.reset.hidden = changed === 0;
    });
}

function buildVideoQualitySection(): { el: HTMLElement; body: HTMLElement } {
    const panel = buildVideoQualityPanel();
    const row = panel.root;
    if (VIDEO_QUALITY_DEF.when) row.style.display = VIDEO_QUALITY_DEF.when(themeState.activeTheme) ? '' : 'none';
    czFields.push({ row, def: VIDEO_QUALITY_DEF, sync: panel.sync, refreshReset: () => {} });
    const built = buildSectionShell(VIDEO_QUALITY_SECTION, [], null);
    built.body.appendChild(row);
    return built;
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

function buildSectionShell(name: string, defs: FieldDef[], masterRow: HTMLElement | null, desc?: string): { el: HTMLElement; body: HTMLElement } {
    const meta = CZ_SECTION_BY_NAME.get(name);
    const section = el('section', { class: 'st-m-section' });
    section.dataset.section = name;

    const head = el('div', { class: 'st-m-sec-head' });
    const text = el('div', { class: 'st-m-sec-text' }, el('div', { class: 'st-m-sec-title', text: sectionLabel(name) }));
    const line = desc || meta?.desc;
    if (line) text.append(el('p', { class: 'st-m-sec-desc', text: line, title: line }));

    const chip = el('button', { class: 'st-m-sec-chip', type: 'button', hidden: true });
    chip.addEventListener('click', () => resetDefs(sectionLabel(name), defs));

    const aside = el('div', { class: 'st-m-sec-aside' }, chip);
    if (masterRow) aside.append(masterRow);
    head.append(text, aside);

    const body = el('div', { class: 'st-m-sec-body' });
    section.append(head, body);

    czSectionHandles.push({ el: section, body, chip, jump: null, defs });
    return { el: section, body };
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
    czSectionHandles = [];
    czCategoryHandles = [];

    const bySection = new Map<string, { def: FieldDef; index: number }[]>();
    SCHEMA.forEach((def, index) => {
        const list = bySection.get(def.section);
        if (list) list.push({ def, index });
        else bySection.set(def.section, [{ def, index }]);
    });

    const sectionEls = new Map<string, HTMLElement>();

    bySection.forEach((defs, name) => {
        const meta = CZ_SECTION_BY_NAME.get(name);
        let rest = defs;
        let masterRow: HTMLElement | null = null;
        let masterHint: string | undefined;

        if (name === MUSIC_VIDEO_SECTION) {
            const auto = buildVideoAutoRow();
            czFields.push(auto);
            auto.row.classList.add('st-m-sec-master');
            masterRow = auto.row;
            masterHint = VIDEO_AUTO_DEF.hint;
        } else if (meta?.master) {
            const at = defs.findIndex(d => d.def.id === meta.master);
            if (at >= 0) {
                const entry = defs[at];
                rest = defs.filter((_, i) => i !== at);
                const handle = buildField(entry.def, entry.index);
                czFields.push(handle);
                handle.row.classList.add('st-m-sec-master');
                masterRow = handle.row;
                masterHint = entry.def.hint;
            }
        }

        const built = buildSectionShell(name, defs.map(d => d.def), masterRow, masterHint);
        buildSectionBody(built.body, rest);
        sectionEls.set(name, built.el);
    });

    sectionEls.set(VIDEO_QUALITY_SECTION, buildVideoQualitySection().el);
    sectionEls.set(VIDEO_LIST_SECTION, buildVideoListSection().el);
    sectionEls.set(FULLSCREEN_SECTION, buildFullscreenSection().el);

    CZ_CATEGORIES.forEach(cat => {
        const catEl = document.createElement('div');
        catEl.className = 'st-m-cz-category';
        catEl.id = cat.id;

        const count = el('span', { class: 'st-m-cz-cat-count' });
        const reset = el('button', { class: 'st-m-cz-cat-reset', type: 'button', text: 'Reset this page', hidden: true });

        const catHead = el('div', { class: 'st-m-cz-cat-head' },
            el('div', { class: 'st-m-cz-cat-title', text: cat.label }),
            el('p', { class: 'st-m-cz-cat-desc', text: cat.description }),
            el('div', { class: 'st-m-cz-cat-meta' }, count, reset),
        );
        catEl.appendChild(catHead);

        const owned = cat.sections.map(s => sectionEls.get(s)).filter(Boolean) as HTMLElement[];
        const catDefs = cat.sections.flatMap(s => (bySection.get(s) || []).map(d => d.def));
        reset.addEventListener('click', () => resetDefs(cat.label, catDefs));
        czCategoryHandles.push({ el: catEl, count, reset, defs: catDefs });

        if (owned.length >= 4) {
            const jump = el('div', { class: 'st-m-cz-jump' });
            owned.forEach(secEl => {
                const name = secEl.dataset.section || '';
                const btn = el('button', { class: 'st-m-cz-jump-item', type: 'button', text: sectionLabel(name) });
                btn.addEventListener('click', () => {
                    secEl.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                    secEl.classList.remove('st-m-sec-flash');
                    void secEl.offsetWidth;
                    secEl.classList.add('st-m-sec-flash');
                    window.setTimeout(() => secEl.classList.remove('st-m-sec-flash'), 1200);
                });
                const handle = czSectionHandles.find(h => h.el === secEl);
                if (handle) handle.jump = btn;
                jump.append(btn);
            });
            catEl.appendChild(jump);
        }

        owned.forEach(secEl => catEl.appendChild(secEl));
        sectionsCol.appendChild(catEl);
    });

    sectionEls.forEach((secEl, name) => {
        if (!CZ_CATEGORIES.some(c => c.sections.includes(name))) sectionsCol.appendChild(secEl);
    });

    body.appendChild(sectionsCol);
    tab.appendChild(toolbar);
    tab.appendChild(status);
    tab.appendChild(body);

    return tab;
}

const LIB_BACK_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3L4.5 8l5 5"></path></svg>';
const LIB_DL_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v7"></path><path d="M4.8 6.6L8 9.8l3.2-3.2"></path><path d="M3 12.8h10"></path></svg>';
const LIB_STAR_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M8 1.7l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.5l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor"></path></svg>';
const LIB_CHECK_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.6l3.4 3.4L13 5"></path></svg>';
const LIB_CLOCK_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.8"></circle><path d="M8 4.8V8l2.2 1.4"></path></svg>';
const LIB_SPARK_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2v3.1M8 10.7v3.1M2.2 8h3.1M10.7 8h3.1M4.1 4.1l2.2 2.2M9.7 9.7l2.2 2.2M11.9 4.1L9.7 6.3M6.3 9.7l-2.2 2.2"></path></svg>';

const LIB_EDIT_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2.6l2.4 2.4L5.8 12.6 2.6 13.4l0.8-3.2z"></path></svg>';
const LIB_SLIDER_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4.5h11M2.5 11.5h11"></path><circle cx="6" cy="4.5" r="1.8" fill="currentColor" stroke="none"></circle><circle cx="10.5" cy="11.5" r="1.8" fill="currentColor" stroke="none"></circle></svg>';

function libPill(icon: string, label: string, title?: string, variant?: string): HTMLElement {
    return el('span', { class: `st-m-lib-pill${variant ? ` st-m-lib-pill-${variant}` : ''}`, title: title || label },
        el('span', { class: 'st-m-lib-pill-icon', html: icon, 'aria-hidden': 'true' }),
        el('span', { text: label }),
    );
}

function configChanges(from: Partial<ThemeConfig>, to: Partial<ThemeConfig>): { groups: { label: string; defs: FieldDef[] }[]; total: number } {
    const order: string[] = [];
    const map = new Map<string, FieldDef[]>();
    let total = 0;
    dedupedSchema().forEach(def => {
        const next = to[def.id];
        if (next === undefined || next === null) return;
        const prev = from[def.id] === undefined ? DEFAULT_THEME[def.id] : from[def.id];
        if (next === prev) return;
        const label = categoryOf(def)?.label || def.section;
        if (!map.has(label)) {
            map.set(label, []);
            order.push(label);
        }
        map.get(label)!.push(def);
        total++;
    });
    return { groups: order.map(label => ({ label, defs: map.get(label)! })), total };
}

function buildDiffBlock(title: string, from: Partial<ThemeConfig>, to: Partial<ThemeConfig>, emptyText: string): HTMLElement {
    const { groups, total } = configChanges(from, to);
    const block = el('section', { class: 'st-m-lib-block' },
        el('div', { class: 'st-m-lib-block-title' },
            el('span', { text: title }),
            el('span', { class: 'st-m-lib-block-count', text: total ? `${total} setting${total === 1 ? '' : 's'}` : 'nothing' }),
        ),
    );
    if (!total) {
        block.append(el('p', { class: 'st-m-lib-about st-m-lib-desc-empty', text: emptyText }));
        return block;
    }
    const openAll = total <= 14;
    groups.forEach(group => {
        const box = el('details', { class: 'st-m-lib-chg', open: openAll });
        box.append(el('summary', { class: 'st-m-lib-chg-head' },
            el('span', { class: 'st-m-lib-chg-name', text: group.label }),
            el('span', { class: 'st-m-lib-chg-count', text: String(group.defs.length) }),
        ));
        const list = el('div', { class: 'st-m-lib-chg-list' });
        group.defs.forEach(def => {
            const before = from[def.id] === undefined ? DEFAULT_THEME[def.id] : from[def.id];
            list.append(el('div', { class: 'st-m-lib-chg-row' },
                el('div', { class: 'st-m-lib-chg-label' },
                    el('span', { text: def.label }),
                    el('span', { class: 'st-m-lib-chg-where', text: sectionLabel(def.section) }),
                ),
                el('div', { class: 'st-m-rv-diff' },
                    describeValue(def, before),
                    el('span', { class: 'st-m-rv-arrow', 'aria-hidden': 'true' }),
                    describeValue(def, to[def.id]),
                ),
            ));
        });
        box.append(list);
        block.append(box);
    });
    return block;
}

type PresetFilter = 'all' | 'builtin' | 'custom';

interface PresetRow {
    preset: ThemePreset;
    custom: boolean;
    tweaks: number;
    active: boolean;
    modified: boolean;
    differs: number;
    update: Marketplace.RemoteThemeInfo | null;
}

const presetBrowse: { query: string; filter: PresetFilter; openName: string } = { query: '', filter: 'all', openName: '' };

function presetIsCustom(preset: ThemePreset): boolean {
    return !BUILTIN_PRESETS.some(b => b.name === preset.name);
}

function presetRowFor(preset: ThemePreset, baseName: string): PresetRow {
    const custom = presetIsCustom(preset);
    const isBase = preset.name === baseName;
    const tweaks = isBase ? changedFieldCount(preset.config) : 0;
    return {
        preset,
        custom,
        tweaks,
        active: isBase && tweaks === 0,
        modified: isBase && tweaks > 0,
        differs: custom ? changedFieldCount(preset.config) : 0,
        update: presetUpdate(preset),
    };
}

function presetOrigin(row: PresetRow): string {
    if (!row.custom) return 'Built in';
    if (!row.preset.sourceId) return 'Saved by you';
    if (row.preset.sourceRemoved) return 'From the Marketplace · no longer listed';
    return `From the Marketplace · v${row.preset.sourceVersion || 1}`;
}

function buildPresetsTab(refresh: () => void): HTMLElement {
    const tab = el('div', { class: 'st-m-tab-content st-m-lib' });
    const browse = el('div', { class: 'st-m-lib-browse' });
    const detail = el('div', { class: 'st-m-lib-detail', hidden: true });
    tab.append(browse, detail);

    const baseName = activeBaseName();
    const rows = getAllPresets().map(preset => presetRowFor(preset, baseName));

    const searchbar = el('div', { class: 'st-m-lib-searchbar' },
        el('span', { class: 'st-m-lib-search-icon', html: SEARCH_SVG, 'aria-hidden': 'true' }),
    );
    const search = el('input', {
        type: 'text',
        class: 'st-m-lib-search',
        placeholder: 'Search your presets…',
        spellcheck: 'false',
        'data-st-esc-local': true,
        value: presetBrowse.query,
    }) as HTMLInputElement;
    const searchClear = el('button', { class: 'st-m-lib-search-clear', type: 'button', title: 'Clear search', html: CLOSE_SVG, hidden: !presetBrowse.query });
    searchbar.append(search, searchClear);

    const filters = el('div', { class: 'st-m-lib-sort', role: 'tablist', 'aria-label': 'Filter presets' });
    const filterChips = new Map<PresetFilter, HTMLButtonElement>();
    ([['all', 'All'], ['builtin', 'Built in'], ['custom', 'Yours']] as [PresetFilter, string][]).forEach(([value, label]) => {
        const chip = el('button', { class: 'st-m-chip', type: 'button', role: 'tab', text: label }) as HTMLButtonElement;
        chip.addEventListener('click', () => {
            presetBrowse.filter = value;
            paintFilters();
            render();
        });
        filterChips.set(value, chip);
        filters.append(chip);
    });

    function paintFilters(): void {
        filterChips.forEach((chip, value) => {
            const on = presetBrowse.filter === value;
            chip.classList.toggle('active', on);
            chip.setAttribute('aria-selected', String(on));
        });
    }
    paintFilters();

    const summary = el('div', { class: 'st-m-lib-summary' });
    const summaryLeft = el('div', { class: 'st-m-lib-summary-left' });
    const summaryRight = el('div', { class: 'st-m-lib-summary-right' });
    summary.append(summaryLeft, summaryRight);

    const status = el('div', { class: 'st-m-lib-status', hidden: true });
    const grid = el('div', { class: 'st-m-lib-grid' });

    const saveBox = buildSaveBox();

    browse.append(el('div', { class: 'st-m-lib-toolbar' }, searchbar, filters), summary, status, grid, saveBox);

    const host = () => tab.closest<HTMLElement>('.st-m-tab-host');
    let scrollMemo = 0;

    function visibleRows(): PresetRow[] {
        const q = presetBrowse.query.trim().toLowerCase();
        return rows.filter(row => {
            if (presetBrowse.filter === 'builtin' && row.custom) return false;
            if (presetBrowse.filter === 'custom' && !row.custom) return false;
            if (!q) return true;
            return `${row.preset.name} ${row.preset.description || ''} ${presetOrigin(row)}`.toLowerCase().includes(q);
        });
    }

    function applyRow(row: PresetRow): void {
        undoable(
            row.modified ? `Reverted to “${row.preset.name}”` : `Applied “${row.preset.name}”`,
            row.modified ? `${row.tweaks} tweak${row.tweaks === 1 ? '' : 's'} discarded.` : undefined,
            () => {
                applyPreset(row.preset);
                resolveBaseline();
                injectThemeStyles();
                refresh();
            },
        );
    }

    function saveRow(row: PresetRow): void {
        undoable(
            row.modified ? `Saved your changes to “${row.preset.name}”` : `Overwrote “${row.preset.name}”`,
            `${row.differs} setting${row.differs === 1 ? '' : 's'} changed in the preset.`,
            () => {
                saveCustomPreset(row.preset.name, row.preset.description);
                resolveBaseline();
                refresh();
            },
        );
    }

    function deleteRow(row: PresetRow): void {
        presetBrowse.openName = '';
        undoable(`Deleted “${row.preset.name}”`, undefined, () => {
            deleteCustomPreset(row.preset.name, row.preset.sourceId);
            resolveBaseline();
            refresh();
        });
    }

    function updateRow(row: PresetRow, btn: HTMLButtonElement): void {
        const version = row.update?.version || 0;
        const replaced = presetHasLocalChanges(row.preset);
        const restore = snapshotState();
        btn.disabled = true;
        btn.textContent = 'Updating…';
        updatePresetFromSource(row.preset)
            .then(name => {
                refresh();
                offerUndo(`Updated “${name}”`, replaced ? 'Your edits were replaced by the new version.' : `Now on version ${version}.`, restore);
            })
            .catch(err => {
                notify(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
                btn.disabled = false;
                btn.textContent = `Update to v${version}`;
            });
    }

    function applyButton(row: PresetRow, primary: boolean): HTMLButtonElement {
        const btn = el('button', { class: `st-m-btn${primary && !row.active ? ' st-m-btn-primary' : ''}`, type: 'button' }) as HTMLButtonElement;
        btn.textContent = row.active ? 'Active' : row.modified ? 'Revert' : 'Apply';
        btn.disabled = row.active;
        if (row.modified) btn.title = `Discard your ${row.tweaks} tweak${row.tweaks === 1 ? '' : 's'} and go back to “${row.preset.name}”`;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            applyRow(row);
        });
        return btn;
    }

    function saveButton(row: PresetRow, primary: boolean): HTMLButtonElement {
        const btn = el('button', { class: `st-m-btn${primary ? ' st-m-btn-primary' : ''}`, type: 'button' }) as HTMLButtonElement;
        btn.textContent = row.modified ? 'Save changes' : 'Overwrite';
        btn.title = row.modified
            ? `Save your ${row.differs} tweak${row.differs === 1 ? '' : 's'} into “${row.preset.name}”`
            : `Replace “${row.preset.name}” with the theme you have now`;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            saveRow(row);
        });
        return btn;
    }

    function updateButton(row: PresetRow): HTMLButtonElement {
        const btn = el('button', { class: 'st-m-btn st-m-btn-update', type: 'button' }) as HTMLButtonElement;
        btn.textContent = `Update to v${row.update?.version || 0}`;
        btn.title = `You have v${row.preset.sourceVersion || 1} saved`;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            updateRow(row, btn);
        });
        return btn;
    }

    function badges(row: PresetRow): HTMLElement[] {
        const out: HTMLElement[] = [];
        if (row.active) {
            out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-featured', title: 'This is the theme you are using' },
                el('span', { html: LIB_CHECK_SVG, 'aria-hidden': 'true' }),
                el('span', { text: 'Active' }),
            ));
        }
        if (row.modified) {
            out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-edit', title: `${row.tweaks} unsaved tweak${row.tweaks === 1 ? '' : 's'}` },
                el('span', { html: LIB_EDIT_SVG, 'aria-hidden': 'true' }),
                el('span', { text: 'Edited' }),
            ));
        }
        if (row.update) out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-update', text: 'Update' }));
        if (row.preset.badge) out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-season', text: row.preset.badge }));
        return out;
    }

    function renderCards(list: PresetRow[]): void {
        grid.innerHTML = '';
        list.forEach(row => {
            const card = el('div', {
                class: `st-m-lib-card${row.active ? ' st-m-lib-card-live' : ''}${row.modified ? ' st-m-lib-card-edit' : ''}`,
                role: 'button',
                tabindex: '0',
                'aria-label': `${row.preset.name}. Open details.`,
            });

            const preview = el('div', { class: 'st-m-lib-preview' });
            renderPreview(preview, row.preset.config);

            const shell = el('div', { class: 'st-m-lib-shell' }, preview, el('span', { class: 'st-m-lib-scrim', 'aria-hidden': 'true' }));
            const marks = badges(row);
            if (marks.length) shell.append(el('div', { class: 'st-m-lib-marks' }, ...marks));
            shell.append(el('span', { class: 'st-m-lib-open', text: 'View details' }));

            const body = el('div', { class: 'st-m-lib-body' },
                el('div', { class: 'st-m-lib-head' },
                    el('div', { class: 'st-m-lib-name', text: row.preset.name, title: row.preset.name }),
                    el('div', { class: 'st-m-lib-author', text: presetOrigin(row) }),
                ),
                el('p', {
                    class: `st-m-lib-desc${row.preset.description ? '' : ' st-m-lib-desc-empty'}`,
                    text: row.preset.description || 'No description.',
                }),
            );

            const total = configChanges(DEFAULT_THEME, row.preset.config).total;
            const meta = el('div', { class: 'st-m-lib-meta' },
                libPill(LIB_SLIDER_SVG, total ? `${total} tweak${total === 1 ? '' : 's'}` : 'Stock look', 'Settings this preset moves away from the default'),
            );
            if (row.modified) meta.append(libPill(LIB_EDIT_SVG, `${row.tweaks} unsaved`, 'Changes you have not saved into this preset', 'warn'));
            body.append(meta);

            const actions = el('div', { class: 'st-m-lib-actions' });
            if (row.update) {
                actions.append(updateButton(row), applyButton(row, false));
            } else if (row.modified && row.custom) {
                actions.append(saveButton(row, true), applyButton(row, false));
            } else {
                actions.append(applyButton(row, true));
            }
            body.append(actions);

            card.append(shell, body);
            card.addEventListener('click', () => openDetail(row));
            card.addEventListener('keydown', e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                openDetail(row);
            });
            grid.append(card);
        });
    }

    function render(): void {
        const list = visibleRows();
        const mine = rows.filter(r => r.custom).length;

        summaryLeft.innerHTML = '';
        summaryLeft.append(el('span', { class: 'st-m-lib-count', text: `${list.length} preset${list.length === 1 ? '' : 's'}${presetBrowse.query || presetBrowse.filter !== 'all' ? ' shown' : ''}` }));
        summaryRight.innerHTML = '';
        summaryRight.append(el('span', { text: `${rows.length - mine} built in · ${mine} yours` }));

        if (!list.length) {
            grid.innerHTML = '';
            status.innerHTML = '';
            status.hidden = false;
            status.append(el('div', { class: 'st-m-lib-status-title', text: 'Nothing here' }));
            status.append(el('div', {
                class: 'st-m-lib-status-hint',
                text: presetBrowse.filter === 'custom'
                    ? 'Save your current theme below and it shows up here.'
                    : 'No preset matches that search.',
            }));
            if (presetBrowse.query || presetBrowse.filter !== 'all') {
                const clear = el('button', { class: 'st-m-btn', type: 'button', text: 'Clear filters' });
                clear.addEventListener('click', () => {
                    presetBrowse.query = '';
                    presetBrowse.filter = 'all';
                    search.value = '';
                    searchClear.hidden = true;
                    paintFilters();
                    render();
                });
                status.append(clear);
            }
            return;
        }

        status.hidden = true;
        renderCards(list);
    }

    function closeDetail(): void {
        presetBrowse.openName = '';
        detail.hidden = true;
        detail.innerHTML = '';
        browse.hidden = false;
        const h = host();
        if (h) h.scrollTop = scrollMemo;
    }

    function openDetail(row: PresetRow, restoring = false): void {
        const h = host();
        if (h && !restoring) scrollMemo = h.scrollTop;
        presetBrowse.openName = row.preset.name;
        browse.hidden = true;
        detail.hidden = false;
        detail.innerHTML = '';
        detail.append(buildDetail(row));
        if (h) h.scrollTop = 0;
        if (!prefersReducedMotion()) {
            detail.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' });
        }
        detail.querySelector<HTMLElement>('.st-m-lib-back')?.focus({ preventScroll: true });
    }

    function buildDetail(row: PresetRow): HTMLElement {
        const wrap = el('div', { class: 'st-m-lib-sheet' });

        const back = el('button', { class: 'st-m-lib-back', type: 'button' },
            el('span', { class: 'st-m-lib-back-icon', html: LIB_BACK_SVG, 'aria-hidden': 'true' }),
            el('span', { text: 'All presets' }),
        );
        back.addEventListener('click', closeDetail);
        wrap.append(back);

        const preview = el('div', { class: 'st-m-lib-hero-preview' });
        renderPreview(preview, row.preset.config);
        const stage = el('div', { class: 'st-m-lib-hero-stage' }, preview);

        const title = el('div', { class: 'st-m-lib-hero-title' }, el('h3', { class: 'st-m-lib-hero-name', text: row.preset.name }));
        const marks = badges(row);
        if (marks.length) title.append(el('div', { class: 'st-m-lib-marks st-m-lib-marks-inline' }, ...marks));

        const total = configChanges(DEFAULT_THEME, row.preset.config).total;
        const pills = el('div', { class: 'st-m-lib-meta' },
            libPill(LIB_SLIDER_SVG, total ? `${total} setting${total === 1 ? '' : 's'} changed` : 'Stock look', 'Settings this preset moves away from the default'),
        );
        if (row.modified) pills.append(libPill(LIB_EDIT_SVG, `${row.tweaks} unsaved tweak${row.tweaks === 1 ? '' : 's'}`, undefined, 'warn'));
        if (row.update) pills.append(libPill(LIB_SPARK_SVG, `v${row.update.version} on the Marketplace`, 'A newer version was shared'));

        const actions = el('div', { class: 'st-m-lib-hero-actions' });
        const primary = applyButton(row, true);
        if (row.update) actions.append(updateButton(row));
        if (row.custom && row.differs > 0) actions.append(saveButton(row, row.modified && !row.update));
        actions.append(primary);
        if (row.custom) {
            const del = el('button', { class: 'st-m-btn st-m-btn-danger', type: 'button', text: 'Delete' });
            del.addEventListener('click', () => deleteRow(row));
            actions.append(del);
        }

        const info = el('div', { class: 'st-m-lib-hero-info' },
            title,
            el('div', { class: 'st-m-lib-hero-author', text: presetOrigin(row) }),
            pills,
            actions,
        );

        wrap.append(el('div', { class: 'st-m-lib-hero' }, stage, info));

        const about = el('section', { class: 'st-m-lib-block' },
            el('div', { class: 'st-m-lib-block-title', text: 'About this preset' }),
            el('p', {
                class: `st-m-lib-about${row.preset.description ? '' : ' st-m-lib-desc-empty'}`,
                text: row.preset.description || 'No description.',
            }),
        );
        if (row.preset.sourceRemoved) {
            about.append(el('p', { class: 'st-m-lib-note', text: 'The author took this theme off the Marketplace. Your copy keeps working.' }));
        }
        wrap.append(about);

        if (row.modified) {
            wrap.append(buildDiffBlock(
                'Your unsaved tweaks',
                row.preset.config,
                themeState.activeTheme,
                'Nothing differs from the saved preset.',
            ));
        }
        wrap.append(buildDiffBlock(
            'What it changes',
            DEFAULT_THEME,
            row.preset.config,
            'This preset keeps every setting at its default value.',
        ));

        return wrap;
    }

    function buildSaveBox(): HTMLElement {
        const changed = configChanges(DEFAULT_THEME, themeState.activeTheme).total;
        const box = el('section', { class: 'st-m-lib-block st-m-save-preset' },
            el('div', { class: 'st-m-lib-block-title' },
                el('span', { text: 'Save your current theme' }),
                el('span', {
                    class: 'st-m-lib-block-count',
                    text: changed ? `${changed} setting${changed === 1 ? '' : 's'} off default` : 'stock look',
                }),
            ),
        );
        const nameInput = el('input', { type: 'text', class: 'st-m-text', id: 'st-m-save-name', placeholder: 'Preset name', maxlength: '60' }) as HTMLInputElement;
        const descInput = el('input', { type: 'text', class: 'st-m-text', id: 'st-m-save-desc', placeholder: 'Description (optional)', maxlength: '200' }) as HTMLInputElement;
        const saveBtn = el('button', { class: 'st-m-btn st-m-btn-primary', type: 'button', id: 'st-m-save-btn', text: 'Save preset' }) as HTMLButtonElement;
        box.append(el('div', { class: 'st-m-save-row' }, nameInput, descInput, saveBtn));

        const commit = () => {
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
        };
        saveBtn.addEventListener('click', commit);
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') commit();
        });
        descInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') commit();
        });
        return box;
    }

    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    search.addEventListener('input', () => {
        searchClear.hidden = !search.value;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            presetBrowse.query = search.value;
            render();
        }, 160);
    });
    searchClear.addEventListener('click', () => {
        search.value = '';
        searchClear.hidden = true;
        search.focus();
        if (!presetBrowse.query) return;
        presetBrowse.query = '';
        render();
    });

    onEscape(tab, () => {
        if (detail.hidden) return false;
        closeDetail();
        return true;
    });

    render();
    if (presetBrowse.openName) {
        const match = rows.find(r => r.preset.name === presetBrowse.openName);
        if (match) openDetail(match, true);
        else presetBrowse.openName = '';
    }
    return tab;
}

const MP_CACHE_TTL_MS = 45000;

interface MpBrowseState {
    page: number;
    sort: Marketplace.MarketplaceSort;
    query: string;
    tag: string;
    openId: string;
}

const mpBrowse: MpBrowseState = { page: 1, sort: 'newest', query: '', tag: '', openId: '' };
let mpListCache: { key: string; at: number; res: Marketplace.MarketplaceListResponse } | null = null;
let mpStatsCache: Marketplace.MarketplaceStats | null = null;

function mpCount(value: number): string {
    const n = Math.max(0, Math.round(value || 0));
    if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
    return String(n);
}

function mpWhen(theme: Marketplace.MarketplaceTheme): string {
    const raw = theme.updatedAt || theme.uploadDate || '';
    let at = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(at) && theme.uploadTimestamp) {
        at = theme.uploadTimestamp > 1e11 ? theme.uploadTimestamp : theme.uploadTimestamp * 1000;
    }
    if (!Number.isFinite(at)) return '';
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 31) {
        const w = Math.floor(days / 7);
        return `${w} week${w === 1 ? '' : 's'} ago`;
    }
    if (days < 365) {
        const m = Math.floor(days / 30);
        return `${m} month${m === 1 ? '' : 's'} ago`;
    }
    const y = Math.floor(days / 365);
    return `${y} year${y === 1 ? '' : 's'} ago`;
}

function mpInstall(theme: Marketplace.MarketplaceTheme): { preset: ThemePreset; outdated: boolean } | null {
    const preset = themeState.customPresets.find(p => p.sourceId === theme.id);
    if (!preset) return null;
    const have = typeof preset.sourceVersion === 'number' ? preset.sourceVersion : 0;
    return { preset, outdated: typeof theme.version === 'number' && theme.version > have };
}

function mpIsLive(theme: Marketplace.MarketplaceTheme): boolean {
    return !!theme.id && themeState.activeSourceId === theme.id;
}


function buildMarketplaceTab(refresh: () => void): HTMLElement {
    const tab = el('div', { class: 'st-m-tab-content st-m-lib' });

    const browse = el('div', { class: 'st-m-lib-browse' });
    const detail = el('div', { class: 'st-m-lib-detail', hidden: true });
    tab.append(browse, detail);

    const searchbar = el('div', { class: 'st-m-lib-searchbar' },
        el('span', { class: 'st-m-lib-search-icon', html: SEARCH_SVG, 'aria-hidden': 'true' }),
    );
    const search = el('input', {
        type: 'text',
        class: 'st-m-lib-search',
        placeholder: 'Search themes, authors…',
        spellcheck: 'false',
        'data-st-esc-local': true,
        value: mpBrowse.query,
    }) as HTMLInputElement;
    const searchClear = el('button', { class: 'st-m-lib-search-clear', type: 'button', title: 'Clear search', html: CLOSE_SVG, hidden: !mpBrowse.query });
    searchbar.append(search, searchClear);

    const sortWrap = el('div', { class: 'st-m-lib-sort', role: 'tablist', 'aria-label': 'Sort themes' });
    const sortChips = new Map<Marketplace.MarketplaceSort, HTMLButtonElement>();
    ([['newest', 'Newest'], ['popular', 'Popular'], ['featured', 'Featured']] as [Marketplace.MarketplaceSort, string][])
        .forEach(([value, label]) => {
            const chip = el('button', { class: 'st-m-chip', type: 'button', role: 'tab', text: label }) as HTMLButtonElement;
            chip.addEventListener('click', () => {
                if (mpBrowse.sort === value) return;
                mpBrowse.sort = value;
                mpBrowse.page = 1;
                paintSort();
                load();
            });
            sortChips.set(value, chip);
            sortWrap.append(chip);
        });

    function paintSort(): void {
        sortChips.forEach((chip, value) => {
            const on = mpBrowse.sort === value;
            chip.classList.toggle('active', on);
            chip.setAttribute('aria-selected', String(on));
        });
    }
    paintSort();

    const toolbar = el('div', { class: 'st-m-lib-toolbar' }, searchbar, sortWrap);

    const summary = el('div', { class: 'st-m-lib-summary' });
    const summaryLeft = el('div', { class: 'st-m-lib-summary-left' });
    const summaryRight = el('div', { class: 'st-m-lib-summary-right' });
    summary.append(summaryLeft, summaryRight);

    const status = el('div', { class: 'st-m-lib-status', hidden: true });
    const grid = el('div', { class: 'st-m-lib-grid' });

    const prev = el('button', { class: 'st-m-btn', type: 'button', text: 'Previous' }) as HTMLButtonElement;
    const next = el('button', { class: 'st-m-btn', type: 'button', text: 'Next' }) as HTMLButtonElement;
    const pageInfo = el('span', { class: 'st-m-lib-page-info' });
    const pagination = el('div', { class: 'st-m-lib-pagination', hidden: true }, prev, pageInfo, next);

    browse.append(toolbar, summary, status, grid, pagination);

    let totalPages = 1;
    let shown: Marketplace.MarketplaceTheme[] = [];
    let lastRes: Marketplace.MarketplaceListResponse | null = null;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollMemo = 0;

    const host = () => tab.closest<HTMLElement>('.st-m-tab-host');

    function cacheKey(): string {
        return `${mpBrowse.sort}|${mpBrowse.page}|${mpBrowse.query}|${mpBrowse.tag}`;
    }

    function paintSummary(): void {
        const res = lastRes;
        summaryLeft.innerHTML = '';
        if (res) {
            const total = res.totalThemes || shown.length;
            const what = mpBrowse.query || mpBrowse.tag ? 'match' : 'available';
            summaryLeft.append(el('span', { class: 'st-m-lib-count', text: `${mpCount(total)} theme${total === 1 ? '' : 's'} ${what}` }));
        }
        if (mpBrowse.tag) {
            const pill = el('button', { class: 'st-m-lib-filter', type: 'button', title: 'Remove this tag filter' },
                el('span', { text: `#${mpBrowse.tag}` }),
                el('span', { class: 'st-m-lib-filter-x', html: CLOSE_SVG, 'aria-hidden': 'true' }),
            );
            pill.addEventListener('click', () => {
                mpBrowse.tag = '';
                mpBrowse.page = 1;
                load();
            });
            summaryLeft.append(pill);
        }

        summaryRight.innerHTML = '';
        if (mpStatsCache) {
            const s = mpStatsCache;
            summaryRight.append(el('span', { text: `${mpCount(s.totalDownloads)} downloads · ${mpCount(s.totalAuthors)} creator${s.totalAuthors === 1 ? '' : 's'}` }));
        }
    }

    function loadStats(): void {
        if (mpStatsCache) {
            paintSummary();
            return;
        }
        Marketplace.getStats()
            .then(stats => {
                mpStatsCache = stats;
                if (tab.isConnected) paintSummary();
            })
            .catch(() => {});
    }

    function applyTheme(theme: Marketplace.MarketplaceTheme, btn: HTMLButtonElement): void {
        const label = btn.textContent || 'Apply';
        btn.disabled = true;
        btn.textContent = 'Downloading…';
        const restore = snapshotState();
        downloadThemeWithSource(theme.id)
            .then(({ config, source, meta }) => {
                const name = source.name || theme.name;
                const preset: ThemePreset = {
                    name,
                    description: meta?.description || theme.description || `By ${theme.author}`,
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
                if (!detail.hidden) mpBrowse.openId = theme.id;
                refresh();
                offerUndo(`Applied “${name}”`, `By ${theme.author}. Saved to your presets.`, restore);
            })
            .catch(e => {
                notify(`Failed to apply: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                btn.disabled = false;
                btn.textContent = label;
            });
    }

    function applyButton(theme: Marketplace.MarketplaceTheme, big: boolean): HTMLButtonElement {
        const install = mpInstall(theme);
        const live = mpIsLive(theme);
        const btn = el('button', {
            class: `st-m-btn st-m-btn-primary${big ? ' st-m-lib-cta' : ''}`,
            type: 'button',
        }) as HTMLButtonElement;
        if (install?.outdated) {
            btn.textContent = `Update to v${theme.version}`;
            btn.title = `You have v${install.preset.sourceVersion || 1} saved`;
        } else if (live && activeThemeHasLocalChanges()) {
            btn.textContent = 'Restore';
            btn.className = `st-m-btn${big ? ' st-m-lib-cta' : ''}`;
            btn.title = 'Discard your edits and go back to the shared version';
        } else if (live) {
            btn.textContent = 'Applied';
            btn.className = `st-m-btn${big ? ' st-m-lib-cta' : ''}`;
            btn.disabled = true;
        } else if (install) {
            btn.textContent = 'Apply again';
            btn.className = `st-m-btn${big ? ' st-m-lib-cta' : ''}`;
        } else {
            btn.textContent = 'Apply';
        }
        btn.addEventListener('click', e => {
            e.stopPropagation();
            applyTheme(theme, btn);
        });
        return btn;
    }

    function badges(theme: Marketplace.MarketplaceTheme): HTMLElement[] {
        const out: HTMLElement[] = [];
        if (theme.featured) {
            out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-featured', title: 'Picked by the Spicy Themes team' },
                el('span', { html: LIB_STAR_SVG, 'aria-hidden': 'true' }),
                el('span', { text: 'Featured' }),
            ));
        }
        const install = mpInstall(theme);
        if (install?.outdated) {
            out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-update', text: 'Update' }));
        } else if (install) {
            out.push(el('span', { class: 'st-m-lib-badge st-m-lib-badge-saved', title: 'Already in your presets' },
                el('span', { html: LIB_CHECK_SVG, 'aria-hidden': 'true' }),
                el('span', { text: 'Saved' }),
            ));
        }
        return out;
    }

    function renderCards(themes: Marketplace.MarketplaceTheme[]): void {
        grid.innerHTML = '';
        themes.forEach(theme => {
            const card = el('div', {
                class: `st-m-lib-card${mpIsLive(theme) ? ' st-m-lib-card-live' : ''}`,
                role: 'button',
                tabindex: '0',
                'aria-label': `${theme.name} by ${theme.author}. Open details.`,
            });

            const preview = el('div', { class: 'st-m-lib-preview' });
            renderPreview(preview, theme.theme);

            const marks = badges(theme);
            const shell = el('div', { class: 'st-m-lib-shell' }, preview, el('span', { class: 'st-m-lib-scrim', 'aria-hidden': 'true' }));
            if (marks.length) shell.append(el('div', { class: 'st-m-lib-marks' }, ...marks));
            shell.append(el('span', { class: 'st-m-lib-open', text: 'View details' }));

            const head = el('div', { class: 'st-m-lib-head' },
                el('div', { class: 'st-m-lib-name', text: theme.name, title: theme.name }),
                el('div', { class: 'st-m-lib-author', text: `by ${theme.author}` }),
            );

            const body = el('div', { class: 'st-m-lib-body' }, head);
            if (theme.description) {
                body.append(el('p', { class: 'st-m-lib-desc', text: theme.description }));
            } else {
                body.append(el('p', { class: 'st-m-lib-desc st-m-lib-desc-empty', text: 'No description.' }));
            }

            const when = mpWhen(theme);
            const meta = el('div', { class: 'st-m-lib-meta' }, libPill(LIB_DL_SVG, mpCount(theme.downloads), `${theme.downloads || 0} downloads`));
            const changes = configChanges(DEFAULT_THEME, theme.theme).total;
            if (changes) meta.append(libPill(LIB_SPARK_SVG, `${changes} tweak${changes === 1 ? '' : 's'}`, `Changes ${changes} setting${changes === 1 ? '' : 's'}`));
            if (when) meta.append(libPill(LIB_CLOCK_SVG, when, 'Last updated'));
            body.append(meta);

            const actions = el('div', { class: 'st-m-lib-actions' }, applyButton(theme, false));
            body.append(actions);

            card.append(shell, body);
            card.addEventListener('click', () => openDetail(theme));
            card.addEventListener('keydown', e => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                openDetail(theme);
            });
            grid.append(card);
        });
    }

    function renderSkeleton(count = 8): void {
        grid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const card = el('div', { class: 'st-m-lib-card st-m-lib-skeleton' });
            card.innerHTML = `
                <div class="st-m-lib-shell"><div class="st-m-lib-preview st-sk"></div></div>
                <div class="st-m-lib-body">
                    <div class="st-sk st-sk-line" style="width: 58%;"></div>
                    <div class="st-sk st-sk-line" style="width: 34%;"></div>
                    <div class="st-sk st-sk-line" style="width: 86%;"></div>
                </div>`;
            grid.append(card);
        }
    }

    function showStatus(title: string, hint?: string, retry = false): void {
        grid.innerHTML = '';
        status.innerHTML = '';
        status.hidden = false;
        status.append(el('div', { class: 'st-m-lib-status-title', text: title }));
        if (hint) status.append(el('div', { class: 'st-m-lib-status-hint', text: hint }));
        if (retry) {
            const btn = el('button', { class: 'st-m-btn', type: 'button', text: 'Try again' });
            btn.addEventListener('click', () => load(true));
            status.append(btn);
        } else if (mpBrowse.query || mpBrowse.tag) {
            const btn = el('button', { class: 'st-m-btn', type: 'button', text: 'Clear filters' });
            btn.addEventListener('click', () => {
                mpBrowse.query = '';
                mpBrowse.tag = '';
                mpBrowse.page = 1;
                search.value = '';
                searchClear.hidden = true;
                load(true);
            });
            status.append(btn);
        }
    }

    async function load(force = false): Promise<void> {
        const key = cacheKey();
        if (!force && mpListCache && mpListCache.key === key && Date.now() - mpListCache.at < MP_CACHE_TTL_MS) {
            paint(mpListCache.res);
            return;
        }
        status.hidden = true;
        pagination.hidden = true;
        renderSkeleton();
        lastRes = null;
        paintSummary();
        try {
            const res = await Marketplace.listThemes({
                page: mpBrowse.page,
                sort: mpBrowse.sort,
                query: mpBrowse.query,
                tag: mpBrowse.tag || undefined,
            });
            if (!tab.isConnected) return;
            mpListCache = { key, at: Date.now(), res };
            paint(res);
        } catch (e) {
            if (!tab.isConnected) return;
            pagination.hidden = true;
            showStatus(
                'The marketplace did not answer',
                `${e instanceof Error ? e.message : 'Unknown error'}. Check your connection and try again.`,
                true,
            );
        }
    }

    function paint(res: Marketplace.MarketplaceListResponse): void {
        status.hidden = true;
        shown = res.themes || [];
        totalPages = res.totalPages || 1;
        lastRes = res;
        paintSummary();
        if (!shown.length) {
            pagination.hidden = true;
            showStatus(
                mpBrowse.query || mpBrowse.tag ? 'Nothing matches that' : 'No themes yet',
                mpBrowse.query || mpBrowse.tag ? 'Try a shorter search, or drop the filters.' : 'Be the first to share one from the Theme Creator.',
            );
            return;
        }
        renderCards(shown);
        if (totalPages > 1) {
            pagination.hidden = false;
            pageInfo.textContent = `Page ${res.page} of ${totalPages}`;
            prev.disabled = res.page <= 1;
            next.disabled = res.page >= totalPages;
        } else {
            pagination.hidden = true;
        }
        if (mpBrowse.openId) {
            const match = shown.find(t => t.id === mpBrowse.openId);
            if (match) openDetail(match, true);
            else mpBrowse.openId = '';
        }
    }

    function closeDetail(): void {
        mpBrowse.openId = '';
        detail.hidden = true;
        detail.innerHTML = '';
        browse.hidden = false;
        const h = host();
        if (h) h.scrollTop = scrollMemo;
    }

    function openDetail(theme: Marketplace.MarketplaceTheme, restoring = false): void {
        const h = host();
        if (h && !restoring) scrollMemo = h.scrollTop;
        mpBrowse.openId = theme.id;
        browse.hidden = true;
        detail.hidden = false;
        detail.innerHTML = '';
        detail.append(buildDetail(theme));
        if (h) h.scrollTop = 0;
        if (!prefersReducedMotion()) {
            detail.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.9, 0.1, 1)' });
        }
        detail.querySelector<HTMLElement>('.st-m-lib-back')?.focus({ preventScroll: true });
    }

    function buildDetail(theme: Marketplace.MarketplaceTheme): HTMLElement {
        const wrap = el('div', { class: 'st-m-lib-sheet' });

        const back = el('button', { class: 'st-m-lib-back', type: 'button' },
            el('span', { class: 'st-m-lib-back-icon', html: LIB_BACK_SVG, 'aria-hidden': 'true' }),
            el('span', { text: 'All themes' }),
        );
        back.addEventListener('click', closeDetail);
        wrap.append(back);

        const preview = el('div', { class: 'st-m-lib-hero-preview' });
        renderPreview(preview, theme.theme);
        const stage = el('div', { class: 'st-m-lib-hero-stage' }, preview);

        const marks = badges(theme);
        const title = el('div', { class: 'st-m-lib-hero-title' }, el('h3', { class: 'st-m-lib-hero-name', text: theme.name }));
        if (marks.length) title.append(el('div', { class: 'st-m-lib-marks st-m-lib-marks-inline' }, ...marks));

        const when = mpWhen(theme);
        const pills = el('div', { class: 'st-m-lib-meta' },
            libPill(LIB_DL_SVG, `${mpCount(theme.downloads)} download${theme.downloads === 1 ? '' : 's'}`, `${theme.downloads || 0} downloads`),
        );
        if (when) pills.append(libPill(LIB_CLOCK_SVG, `Updated ${when}`, theme.updatedAt || theme.uploadDate || ''));
        if (typeof theme.version === 'number' && theme.version > 0) pills.append(libPill(LIB_SPARK_SVG, `Version ${theme.version}`, 'Marketplace revision'));

        const actions = el('div', { class: 'st-m-lib-hero-actions' }, applyButton(theme, true));
        const install = mpInstall(theme);
        if (install) {
            const open = el('button', { class: 'st-m-btn', type: 'button', text: 'Open in Presets' });
            open.addEventListener('click', () => goToLive?.('presets'));
            actions.append(open);
        }

        const info = el('div', { class: 'st-m-lib-hero-info' },
            title,
            el('div', { class: 'st-m-lib-hero-author', text: `by ${theme.author}` }),
            pills,
            actions,
        );

        wrap.append(el('div', { class: 'st-m-lib-hero' }, stage, info));

        const about = el('section', { class: 'st-m-lib-block' },
            el('div', { class: 'st-m-lib-block-title', text: 'About this theme' }),
            el('p', {
                class: `st-m-lib-about${theme.description ? '' : ' st-m-lib-desc-empty'}`,
                text: theme.description || 'The author did not write a description.',
            }),
        );
        const tags = (theme.tags || []).filter(Boolean);
        if (tags.length) {
            const row = el('div', { class: 'st-m-lib-tags' });
            tags.forEach(tag => {
                const chip = el('button', { class: 'st-m-lib-tag', type: 'button', text: `#${tag}`, title: `Show themes tagged ${tag}` });
                chip.addEventListener('click', () => {
                    mpBrowse.tag = tag;
                    mpBrowse.query = '';
                    mpBrowse.page = 1;
                    search.value = '';
                    searchClear.hidden = true;
                    closeDetail();
                    load(true);
                });
                row.append(chip);
            });
            about.append(row);
        }
        wrap.append(about);

        wrap.append(buildDiffBlock('What it changes', DEFAULT_THEME, theme.theme, 'This theme keeps every setting at its default value.'));

        return wrap;
    }

    search.addEventListener('input', () => {
        searchClear.hidden = !search.value;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const value = search.value.trim();
            if (value === mpBrowse.query) return;
            mpBrowse.query = value;
            mpBrowse.page = 1;
            load();
        }, 320);
    });
    searchClear.addEventListener('click', () => {
        search.value = '';
        searchClear.hidden = true;
        search.focus();
        if (!mpBrowse.query) return;
        mpBrowse.query = '';
        mpBrowse.page = 1;
        load();
    });

    prev.addEventListener('click', () => {
        if (mpBrowse.page <= 1) return;
        mpBrowse.page--;
        load();
        host()?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    next.addEventListener('click', () => {
        if (mpBrowse.page >= totalPages) return;
        mpBrowse.page++;
        load();
        host()?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    onEscape(tab, () => {
        if (detail.hidden) return false;
        closeDetail();
        return true;
    });

    loadStats();
    load();
    return tab;
}

function buildAboutTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content st-m-about';

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
            <div class="st-m-section-title">Notification position</div>
            <div class="st-m-about-actions" id="st-m-toast-place">
                <button class="st-m-chip" data-place="bottom-left">Bottom left</button>
                <button class="st-m-chip" data-place="bottom-center">Bottom center</button>
                <button class="st-m-chip" data-place="bottom-right">Bottom right</button>
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

    const placeChips = tab.querySelectorAll<HTMLButtonElement>('#st-m-toast-place .st-m-chip');
    const markPlace = (current: RegionPlacement) => {
        placeChips.forEach(chip => chip.classList.toggle('active', chip.dataset.place === current));
    };
    markPlace(getRegionPlacement());
    placeChips.forEach(chip => chip.addEventListener('click', () => {
        const place = chip.dataset.place as RegionPlacement;
        setRegionPlacement(place);
        markPlace(place);
        toast({ title: 'Notifications show here now', duration: 2500 });
    }));

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
            if (theme[def.id] === true) add(sectionLabel(def.section), def.label);
            return;
        }
        if (def.id === 'wordEffect') {
            const value = String(theme.wordEffect || 'none');
            if (value === 'none') return;
            const option = (def.options || []).find(o => o.value === value);
            add(sectionLabel(def.section), `${def.label}: ${option ? option.text : value}`);
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
    const label = sectionLabel(def.section);
    if (!cat || cat.label === label) return label;
    return `${cat.label} · ${label}`;
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
            keywords: `${def.section} ${sectionLabel(def.section)} ${def.hint || ''} ${def.keywords || ''}`,
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
    const extra = `${item.hint || ''} ${item.keywords || ''}`.toLowerCase();
    if (extra.includes(q)) return 20;
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.length > 1 && terms.every(t => `${label} ${extra}`.includes(t))) return 10;
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
                        const search = liveContainer?.querySelector<HTMLInputElement>('.st-m-lib-search');
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
            const cat = CZ_CATEGORIES.find(c => c.id === btn.dataset.target);
            const changed = cat ? categoryChangedCount(cat) : 0;
            btn.classList.toggle('st-m-side-item-dirty', changed > 0);
            btn.title = changed ? `${changed} setting${changed === 1 ? '' : 's'} changed` : '';
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
