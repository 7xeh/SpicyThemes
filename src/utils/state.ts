import { storage } from './storage';

export type WordEffectTrigger = 'word' | 'line' | 'loop';

export interface WordEffectMeta {
    id: string;
    label: string;
    group: string;
    defaultTrigger: WordEffectTrigger;
    triggers: WordEffectTrigger[];
}

export const WORD_EFFECTS: WordEffectMeta[] = [
    { id: 'pop', label: 'Pop', group: 'Classic', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'wave', label: 'Wave', group: 'Classic', defaultTrigger: 'loop', triggers: ['loop', 'word', 'line'] },

    { id: 'bounce', label: 'Bounce', group: 'Energetic', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'stamp', label: 'Stamp', group: 'Energetic', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'shake', label: 'Shake', group: 'Energetic', defaultTrigger: 'word', triggers: ['word', 'line', 'loop'] },
    { id: 'glitch', label: 'Glitch', group: 'Energetic', defaultTrigger: 'word', triggers: ['word', 'line', 'loop'] },

    { id: 'rise', label: 'Rise', group: 'Smooth', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'sway', label: 'Sway', group: 'Smooth', defaultTrigger: 'loop', triggers: ['loop', 'word', 'line'] },
    { id: 'focus', label: 'Focus', group: 'Smooth', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'swell', label: 'Swell', group: 'Smooth', defaultTrigger: 'loop', triggers: ['loop', 'word', 'line'] },

    { id: 'flip', label: 'Flip', group: 'Dimensional', defaultTrigger: 'word', triggers: ['word', 'line'] },
    { id: 'depth', label: 'Depth', group: 'Dimensional', defaultTrigger: 'word', triggers: ['word', 'line', 'loop'] },
    { id: 'lean', label: 'Lean', group: 'Dimensional', defaultTrigger: 'word', triggers: ['word', 'line'] },
];

export const WORD_EFFECT_IDS = WORD_EFFECTS.map(e => e.id);

export interface AnimBgStyleMeta {
    id: string;
    label: string;
    description: string;
    angle: boolean;
    perspective: boolean;
    mirror: boolean;
    solid: boolean;
}

export const ANIM_BG_STYLES: AnimBgStyleMeta[] = [
    { id: 'ridges', label: 'Ridgelines', description: 'Stacked lines of the spectrum rolling away into the distance.', angle: true, perspective: true, mirror: true, solid: true },
    { id: 'silk', label: 'Silk', description: 'Fine threads that ripple and flow with the music.', angle: true, perspective: false, mirror: false, solid: false },
    { id: 'halo', label: 'Halo', description: 'Rings of sound radiating out from the centre.', angle: true, perspective: false, mirror: true, solid: false },
    { id: 'pulse', label: 'Pulse', description: 'Layered glowing waveforms that swell with the song.', angle: true, perspective: false, mirror: true, solid: false },
    { id: 'dots', label: 'Dots', description: 'An LED wall scrolling the spectrum like a waterfall.', angle: true, perspective: false, mirror: true, solid: false },
    { id: 'aurora', label: 'Aurora', description: 'Folding curtains of northern lights over a starry sky.', angle: true, perspective: false, mirror: false, solid: false },
    { id: 'nebula', label: 'Nebula', description: 'Slowly swirling clouds of cosmic gas.', angle: true, perspective: false, mirror: false, solid: false },
    { id: 'orbs', label: 'Orbs', description: 'Glassy blobs that drift, merge and swell on the beat.', angle: false, perspective: false, mirror: false, solid: false },
    { id: 'horizon', label: 'Horizon', description: 'A retro grid racing toward a sunset and a spectrum skyline.', angle: false, perspective: true, mirror: true, solid: false },
    { id: 'tunnel', label: 'Wormhole', description: 'A swirling wormhole of spiralling light that bends and pulls you toward a blazing core.', angle: true, perspective: true, mirror: true, solid: false },
    { id: 'hyperspace', label: 'Hyperspace', description: 'Stars streaking past at light speed, stretching on every beat.', angle: false, perspective: false, mirror: false, solid: false },
];

export const ANIM_BG_STYLE_IDS = ANIM_BG_STYLES.map(s => s.id);

export interface EqStyleMeta {
    id: string;
    label: string;
    group: string;
    count: number;
    width: number;
    height: number;
    peaks?: boolean;
}

export const EQ_STYLES: EqStyleMeta[] = [
    { id: 'equalizer', label: 'Equalizer', group: 'Classic', count: 10, width: 8.3, height: 3.6, peaks: true },
    { id: 'dotwave', label: 'Dot Wave', group: 'Classic', count: 10, width: 8.1, height: 2.4 },
    { id: 'waveform', label: 'Waveform', group: 'Classic', count: 12, width: 8.4, height: 3.6, peaks: true },
    { id: 'ladder', label: 'Ladder', group: 'Classic', count: 12, width: 2.0, height: 3.9 },

    { id: 'bounce', label: 'Bounce', group: 'Energetic', count: 5, width: 5.3, height: 3.0 },
    { id: 'glitch', label: 'Glitch', group: 'Energetic', count: 8, width: 6.6, height: 3.6 },
    { id: 'pulsedot', label: 'Pulse Dot', group: 'Energetic', count: 3, width: 3.6, height: 3.6 },

    { id: 'signal', label: 'Signal', group: 'Smooth', count: 10, width: 5.9, height: 2.9 },
    { id: 'breathe', label: 'Breathe', group: 'Smooth', count: 3, width: 3.8, height: 3.8 },
    { id: 'sway', label: 'Sway', group: 'Smooth', count: 7, width: 6.2, height: 2.7 },

    { id: 'orbit', label: 'Orbit', group: 'Dimensional', count: 4, width: 5.3, height: 5.3 },
    { id: 'spectrumring', label: 'Spectrum Ring', group: 'Dimensional', count: 20, width: 5.3, height: 5.3 },
    { id: 'helix', label: 'Helix', group: 'Dimensional', count: 8, width: 6.8, height: 3.4 },
];

export const EQ_STYLE_IDS = EQ_STYLES.map(s => s.id);

export function eqStyleMeta(id: string): EqStyleMeta | null {
    return EQ_STYLES.find(s => s.id === id) || null;
}

export function eqStyleBands(count: number): number[] {
    if (count === 12) return [10, 8, 6, 4, 2, 1, 1, 2, 4, 6, 8, 10];
    if (count === 20) return Array.from({ length: 20 }, (_, i) => (i < 10 ? i + 1 : 20 - i));
    if (count === 1) return [1];
    return Array.from({ length: count }, (_, i) => Math.round(1 + (i * 9) / (count - 1)));
}

export function wordEffectMeta(id: string): WordEffectMeta | null {
    return WORD_EFFECTS.find(e => e.id === id) || null;
}

export function resolveWordTrigger(effect: string, trigger: string): WordEffectTrigger {
    const meta = wordEffectMeta(effect);
    if (!meta) return 'word';
    if (trigger !== 'auto' && meta.triggers.includes(trigger as WordEffectTrigger)) {
        return trigger as WordEffectTrigger;
    }
    return meta.defaultTrigger;
}

export interface ThemeConfig {
    activeLineColor: string;
    sungLineColor: string;
    notSungLineColor: string;

    activeLineOpacity: number;
    sungLineOpacity: number;
    notSungLineOpacity: number;

    glowEnabled: boolean;
    glowColor: string;
    glowIntensity: number;
    activeGlowColor: string;
    activeGlowIntensity: number;

    gradientEnabled: boolean;
    gradientStartColor: string;
    gradientEndColor: string;
    gradientAngle: number;

    fontFamily: string;
    fontWeight: number;
    letterSpacing: number;
    lineHeight: number;
    lyricsScale: number;

    blurUnsung: boolean;
    blurAmount: number;
    blurPreviewLines: number;

    blurSungWords: boolean;
    blurSungWordsAmount: number;
    blurSungWordsOpacity: number;

    textShadowEnabled: boolean;
    textShadowColor: string;
    textShadowOpacity: number;
    textShadowBlur: number;
    textShadowOffsetX: number;
    textShadowOffsetY: number;

    lineWindowEnabled: boolean;
    lineWindowSungLines: number;
    lineWindowUnsungLines: number;
    scaleActive: number;
    scaleInEffect: boolean;
    scaleInFrom: number;
    scaleInDuration: number;
    animationSpeed: number;

    pageBgOverlay: boolean;
    pageBgColor: string;
    pageBgOpacity: number;
    pageBgImageEnabled: boolean;
    pageBgImage: string;
    pageBgImageFit: string;
    pageBgImagePosition: string;
    pageBgImageBlur: number;
    pageBgImageDim: number;
    animBgEnabled: boolean;
    animBgStyle: string;
    animBgPalette: string;
    animBgColor: string;
    animBgColor2: string;
    animBgBackdrop: string;
    animBgBgColor: string;
    animBgOpacity: number;
    animBgSpeed: number;
    animBgReactivity: number;
    animBgIdleMotion: number;
    animBgDensity: number;
    animBgThickness: number;
    animBgAmplitude: number;
    animBgAngle: number;
    animBgPerspective: number;
    animBgMirror: boolean;
    animBgSolid: boolean;
    animBgGlow: number;
    animBgBrightness: number;
    animBgHueCycle: number;
    animBgGrain: number;
    animBgVignette: number;
    animBgBlur: number;
    animBgQuality: string;
    animBgFps: string;

    sltStylingEnabled: boolean;
    sltTranslationOpacity: number;
    sltTranslationFontSize: number;
    sltTranslationFont: string;
    sltTranslationColorEnabled: boolean;
    sltTranslationColor: string;
    sltHighlightStartColor: string;
    sltHighlightEndColor: string;
    sltGlowColorEnabled: boolean;
    sltGlowColor: string;

    sltIndependent: boolean;
    sltActiveLineColor: string;
    sltSungLineColor: string;
    sltNotSungLineColor: string;
    sltActiveLineOpacity: number;
    sltSungLineOpacity: number;
    sltNotSungLineOpacity: number;
    sltGradientEnabled: boolean;
    sltGradientStartColor: string;
    sltGradientEndColor: string;
    sltGradientDirection: string;
    sltGradientAngle: number;
    sltGradientFeather: number;
    sltFontFamily: string;
    sltFontWeight: number;
    sltActiveLineWeight: number;
    sltTextTransform: string;
    sltFontStyle: string;
    sltLyricsScale: number;
    sltLetterSpacing: number;
    sltWordSpacing: number;
    sltLineHeight: number;
    sltTextAlign: string;
    sltMaxLineWidth: number;
    sltGlowEnabled: boolean;
    sltActiveGlowColor: string;
    sltActiveGlowIntensity: number;
    sltInactiveGlowColor: string;
    sltGlowIntensity: number;
    sltGlowPulse: boolean;
    sltGlowPulseSpeed: number;
    sltBgGlowEnabled: boolean;
    sltBgGlowColor: string;
    sltBgGlowIntensity: number;
    sltTextShadowEnabled: boolean;
    sltTextShadowColor: string;
    sltTextShadowOpacity: number;
    sltTextShadowBlur: number;
    sltTextShadowOffsetX: number;
    sltTextShadowOffsetY: number;
    sltTextStrokeEnabled: boolean;
    sltTextStrokeColor: string;
    sltTextStrokeWidth: number;
    sltBlurUnsung: boolean;
    sltBlurAmount: number;
    sltBlurSungWords: boolean;
    sltBlurSungWordsAmount: number;
    sltBlurSungWordsOpacity: number;
    sltWordEffect: string;
    sltWordEffectTrigger: string;
    sltWordEffectIntensity: number;
    sltWordEffectSpeed: number;
    sltWordEffectStagger: number;
    sltScaleActive: number;
    sltScaleInEffect: boolean;
    sltScaleInFrom: number;
    sltScaleInDuration: number;
    sltAnimationSpeed: number;
    sltDisableHighlight: boolean;
    sltHighlightColor: string;

    bgGlowEnabled: boolean;
    bgGlowColor: string;
    bgGlowIntensity: number;

    disableHighlight: boolean;
    highlightColor: string;
    wordEffect: string;
    wordEffectTrigger: string;
    wordEffectIntensity: number;
    wordEffectSpeed: number;
    wordEffectStagger: number;
    popEffect: boolean;
    popScale: number;
    popDuration: number;

    waveEffect: boolean;
    waveIntensity: number;
    waveSpeed: number;

    textStrokeEnabled: boolean;
    textStrokeColor: string;
    textStrokeWidth: number;

    gradientFeather: number;
    wordSpacing: number;
    fontStyle: string;
    textAlign: string;
    maxLineWidth: number;

    playerStylingEnabled: boolean;
    playerArtRadius: number;
    playerProgressThickness: number;
    blurProgressive: boolean;
    gradientDirection: string;
    activeLineWeight: number;
    textTransform: string;
    glowPulse: boolean;
    glowPulseSpeed: number;
    playerAccentEnabled: boolean;
    playerAccentColor: string;
    playerControlsAnimation: boolean;
    playerHideShuffle: boolean;
    playerHideRepeat: boolean;
    playerHideLike: boolean;

    musicVideoEnabled: boolean;
    musicVideoCompact: boolean;
    musicVideoFullscreenCompact: boolean;
    musicVideoDim: number;

    eqEnabled: boolean;
    eqStyle: string;
    eqPosition: string;
    eqColor: string;
    eqSize: number;
    eqSpeed: number;
    eqStereoSpread: boolean;
    eqStereoAmount: number;
}

export const DEFAULT_THEME: ThemeConfig = {
    activeLineColor: '#ffffff',
    sungLineColor: '#b6beca',
    notSungLineColor: '#6b7280',

    activeLineOpacity: 1.0,
    sungLineOpacity: 0.5,
    notSungLineOpacity: 0.25,

    glowEnabled: false,
    glowColor: '#ffffff',
    glowIntensity: 4,
    activeGlowColor: '#ffffff',
    activeGlowIntensity: 12,

    gradientEnabled: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#9ca3af',
    gradientAngle: 180,

    fontFamily: 'Segoe UI Variable, Segoe UI, system-ui, sans-serif',
    fontWeight: 800,
    letterSpacing: 0.02,
    lineHeight: 1.4,
    lyricsScale: 1.0,

    blurUnsung: true,
    blurAmount: 2.0,
    blurPreviewLines: 2,

    blurSungWords: false,
    blurSungWordsAmount: 2.0,
    blurSungWordsOpacity: 0.6,

    textShadowEnabled: false,
    textShadowColor: '#000000',
    textShadowOpacity: 0.8,
    textShadowBlur: 4,
    textShadowOffsetX: 0,
    textShadowOffsetY: 2,

    lineWindowEnabled: false,
    lineWindowSungLines: 2,
    lineWindowUnsungLines: 3,
    scaleActive: 1.02,
    scaleInEffect: false,
    scaleInFrom: 0.96,
    scaleInDuration: 0.35,
    animationSpeed: 1.0,

    pageBgOverlay: true,
    pageBgColor: '#000000',
    pageBgOpacity: 0.5,
    pageBgImageEnabled: false,
    pageBgImage: '',
    pageBgImageFit: 'cover',
    pageBgImagePosition: 'center',
    pageBgImageBlur: 0,
    pageBgImageDim: 0.3,
    animBgEnabled: false,
    animBgStyle: 'ridges',
    animBgPalette: 'custom',
    animBgColor: '#5eead4',
    animBgColor2: '#2563eb',
    animBgBackdrop: 'solid',
    animBgBgColor: '#050809',
    animBgOpacity: 1,
    animBgSpeed: 1,
    animBgReactivity: 1,
    animBgIdleMotion: 0.35,
    animBgDensity: 0.5,
    animBgThickness: 0.35,
    animBgAmplitude: 0.55,
    animBgAngle: 30,
    animBgPerspective: 0.6,
    animBgMirror: true,
    animBgSolid: true,
    animBgGlow: 0.6,
    animBgBrightness: 1,
    animBgHueCycle: 0,
    animBgGrain: 0.03,
    animBgVignette: 0.45,
    animBgBlur: 0,
    animBgQuality: 'balanced',
    animBgFps: '60',

    sltStylingEnabled: true,
    sltTranslationOpacity: 0.8,
    sltTranslationFontSize: 0.75,
    sltTranslationFont: '',
    sltTranslationColorEnabled: false,
    sltTranslationColor: '#ffffff',
    sltHighlightStartColor: '#ffffff',
    sltHighlightEndColor: '#9ca3af',
    sltGlowColorEnabled: false,
    sltGlowColor: '#ffffff',

    sltIndependent: false,
    sltActiveLineColor: '#ffffff',
    sltSungLineColor: '#b6beca',
    sltNotSungLineColor: '#6b7280',
    sltActiveLineOpacity: 0.8,
    sltSungLineOpacity: 0.4,
    sltNotSungLineOpacity: 0.2,
    sltGradientEnabled: true,
    sltGradientStartColor: '#ffffff',
    sltGradientEndColor: '#9ca3af',
    sltGradientDirection: 'auto',
    sltGradientAngle: 180,
    sltGradientFeather: 20,
    sltFontFamily: '',
    sltFontWeight: 800,
    sltActiveLineWeight: 0,
    sltTextTransform: 'none',
    sltFontStyle: 'normal',
    sltLyricsScale: 0.75,
    sltLetterSpacing: 0.02,
    sltWordSpacing: 0,
    sltLineHeight: 1.4,
    sltTextAlign: 'default',
    sltMaxLineWidth: 0,
    sltGlowEnabled: false,
    sltActiveGlowColor: '#ffffff',
    sltActiveGlowIntensity: 12,
    sltInactiveGlowColor: '#ffffff',
    sltGlowIntensity: 4,
    sltGlowPulse: false,
    sltGlowPulseSpeed: 1.0,
    sltBgGlowEnabled: false,
    sltBgGlowColor: '#ffffff',
    sltBgGlowIntensity: 12,
    sltTextShadowEnabled: false,
    sltTextShadowColor: '#000000',
    sltTextShadowOpacity: 0.8,
    sltTextShadowBlur: 4,
    sltTextShadowOffsetX: 0,
    sltTextShadowOffsetY: 2,
    sltTextStrokeEnabled: false,
    sltTextStrokeColor: '#000000',
    sltTextStrokeWidth: 0.6,
    sltBlurUnsung: true,
    sltBlurAmount: 2.0,
    sltBlurSungWords: false,
    sltBlurSungWordsAmount: 2.0,
    sltBlurSungWordsOpacity: 0.6,
    sltWordEffect: 'none',
    sltWordEffectTrigger: 'auto',
    sltWordEffectIntensity: 1.0,
    sltWordEffectSpeed: 1.0,
    sltWordEffectStagger: 55,
    sltScaleActive: 1.02,
    sltScaleInEffect: false,
    sltScaleInFrom: 0.96,
    sltScaleInDuration: 0.35,
    sltAnimationSpeed: 1.0,
    sltDisableHighlight: false,
    sltHighlightColor: '#ffffff',

    bgGlowEnabled: false,
    bgGlowColor: '#ffffff',
    bgGlowIntensity: 12,

    disableHighlight: false,
    highlightColor: '#ffffff',
    wordEffect: 'none',
    wordEffectTrigger: 'auto',
    wordEffectIntensity: 1.0,
    wordEffectSpeed: 1.0,
    wordEffectStagger: 55,
    popEffect: false,
    popScale: 1.05,
    popDuration: 0.3,

    waveEffect: false,
    waveIntensity: 4,
    waveSpeed: 0.8,

    textStrokeEnabled: false,
    textStrokeColor: '#000000',
    textStrokeWidth: 0.6,

    gradientFeather: 20,
    wordSpacing: 0,
    fontStyle: 'normal',
    textAlign: 'default',
    maxLineWidth: 0,

    playerStylingEnabled: false,
    playerArtRadius: 12,
    playerProgressThickness: 1.0,
    blurProgressive: false,
    gradientDirection: 'auto',
    activeLineWeight: 0,
    textTransform: 'none',
    glowPulse: false,
    glowPulseSpeed: 1.0,
    playerAccentEnabled: false,
    playerAccentColor: '#1db954',
    playerControlsAnimation: false,
    playerHideShuffle: false,
    playerHideRepeat: false,
    playerHideLike: false,

    musicVideoEnabled: false,
    musicVideoCompact: false,
    musicVideoFullscreenCompact: false,
    musicVideoDim: 0.3,

    eqEnabled: false,
    eqStyle: 'equalizer',
    eqPosition: 'both',
    eqColor: '#ffffff',
    eqSize: 1.0,
    eqSpeed: 1.0,
    eqStereoSpread: false,
    eqStereoAmount: 0.6,
};

export interface ThemePreset {
    name: string;
    description: string;
    config: ThemeConfig;
    sourceId?: string;
    sourceVersion?: number;
    sourceName?: string;
    sourceFingerprint?: string;
    sourceRemoved?: boolean;
}

export interface ThemeSource {
    id: string;
    version: number;
    name: string;
    fingerprint?: string;
}

export const BUILTIN_PRESETS: ThemePreset[] = [
    {
        name: 'Default',
        description: 'Balanced baseline with clean contrast and comfortable spacing. A neutral starting point to build from.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#ffffff',
            sungLineColor: '#cbd5e1',
            notSungLineColor: '#64748b',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.52,
            notSungLineOpacity: 0.24,
            gradientEnabled: true,
            gradientStartColor: '#ffffff',
            gradientEndColor: '#94a3b8',
            gradientAngle: 180,
            sltHighlightStartColor: '#ffffff',
            sltHighlightEndColor: '#94a3b8',
            glowEnabled: false,
            blurUnsung: true,
            blurAmount: 1.6,
            letterSpacing: 0.03,
            lineHeight: 1.5,
            fontFamily: 'Segoe UI Variable, Segoe UI, system-ui, sans-serif',
            fontWeight: 760,
            wordEffect: 'none',
            scaleActive: 1.02,
        }
    },
    {
        name: 'Cinematic',
        description: 'Feature focus: synced music videos + dramatic depth. Dark page overlay, deep text shadow, scale-in on the active line, and a tight line window keep every lyric front and center over the video.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#f5e8d0',
            sungLineColor: '#d8c4a0',
            notSungLineColor: '#6b5d48',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.5,
            notSungLineOpacity: 0.18,
            gradientEnabled: true,
            gradientStartColor: '#f7ecd6',
            gradientEndColor: '#c9a876',
            gradientAngle: 165,
            sltHighlightStartColor: '#f7ecd6',
            sltHighlightEndColor: '#c9a876',
            glowEnabled: false,
            textShadowEnabled: true,
            textShadowColor: '#000000',
            textShadowOpacity: 0.85,
            textShadowBlur: 12,
            textShadowOffsetX: 0,
            textShadowOffsetY: 4,
            pageBgOverlay: true,
            pageBgColor: '#000000',
            pageBgOpacity: 0.72,
            musicVideoEnabled: true,
            musicVideoDim: 0.55,
            blurUnsung: true,
            blurAmount: 3.0,
            blurPreviewLines: 2,
            lineWindowEnabled: true,
            lineWindowSungLines: 2,
            lineWindowUnsungLines: 3,
            scaleActive: 1.04,
            scaleInEffect: true,
            scaleInFrom: 0.92,
            scaleInDuration: 0.5,
            animationSpeed: 0.8,
            wordEffect: 'none',
            fontFamily: "'Merriweather', Georgia, serif",
            fontWeight: 700,
            letterSpacing: 0.02,
            lineHeight: 1.62,
        }
    },
    {
        name: 'Neon Arcade',
        description: 'Feature focus: the song-title equalizer + punchy effects. Spectrum-ring EQ on both sides, layered active/background glow, a Pop word animation, and animated player controls for a loud, reactive vibe.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#ff2e97',
            sungLineColor: '#ff8cf6',
            notSungLineColor: '#5a2f6b',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.6,
            notSungLineOpacity: 0.22,
            gradientEnabled: true,
            gradientStartColor: '#ff2e97',
            gradientEndColor: '#00e5ff',
            gradientAngle: 100,
            sltHighlightStartColor: '#ff2e97',
            sltHighlightEndColor: '#00e5ff',
            glowEnabled: true,
            activeGlowColor: '#ff2e97',
            activeGlowIntensity: 14,
            glowColor: '#00e5ff',
            glowIntensity: 6,
            bgGlowEnabled: true,
            bgGlowColor: '#ff2e97',
            bgGlowIntensity: 20,
            wordEffect: 'stamp',
            wordEffectTrigger: 'word',
            wordEffectIntensity: 1.15,
            wordEffectSpeed: 1.5,
            popScale: 1.12,
            popDuration: 0.22,
            eqEnabled: true,
            eqStyle: 'spectrumring',
            eqPosition: 'both',
            eqColor: '#00e5ff',
            eqSize: 1.2,
            eqSpeed: 1.6,
            playerStylingEnabled: true,
            playerControlsAnimation: true,
            playerArtRadius: 18,
            playerProgressThickness: 1.6,
            blurUnsung: false,
            fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
            fontWeight: 800,
            letterSpacing: 0.04,
            lineHeight: 1.55,
        }
    },
    {
        name: 'Focus',
        description: 'Feature focus: line window + word blur for distraction-free reading. Only a couple of lines stay sharp, sung words soften and fade behind you, and a scale-in draws the eye to the current line.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#ffffff',
            sungLineColor: '#9aa4b2',
            notSungLineColor: '#3d444f',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.4,
            notSungLineOpacity: 0.15,
            gradientEnabled: false,
            glowEnabled: false,
            bgGlowEnabled: false,
            wordEffect: 'none',
            lineWindowEnabled: true,
            lineWindowSungLines: 1,
            lineWindowUnsungLines: 2,
            blurUnsung: true,
            blurAmount: 4.5,
            blurPreviewLines: 1,
            blurSungWords: true,
            blurSungWordsAmount: 3.0,
            blurSungWordsOpacity: 0.45,
            scaleActive: 1.05,
            scaleInEffect: true,
            scaleInFrom: 0.94,
            scaleInDuration: 0.4,
            animationSpeed: 1.2,
            pageBgOverlay: true,
            pageBgColor: '#000000',
            pageBgOpacity: 0.4,
            fontFamily: "'Inter', Arial, sans-serif",
            fontWeight: 600,
            letterSpacing: 0.01,
            lineHeight: 1.7,
        }
    },
    {
        name: 'Player Pro',
        description: 'Feature focus: the NowBar player styling suite. Rounded artwork, a chunky progress bar, animated controls, a hidden shuffle/repeat, a right-side Dot Wave equalizer, and synced videos dimmed low.',
        config: {
            ...DEFAULT_THEME,
            playerStylingEnabled: true,
            playerArtRadius: 24,
            playerProgressThickness: 2.2,
            playerControlsAnimation: true,
            playerHideShuffle: true,
            playerHideRepeat: true,
            playerHideLike: false,
            eqEnabled: true,
            eqStyle: 'dotwave',
            eqPosition: 'right',
            eqColor: '#1db954',
            eqSize: 1.1,
            eqSpeed: 1.2,
            musicVideoEnabled: true,
            musicVideoDim: 0.35,
            activeLineColor: '#ffffff',
            sungLineColor: '#c3ccd8',
            notSungLineColor: '#5a636e',
            gradientEnabled: true,
            gradientStartColor: '#ffffff',
            gradientEndColor: '#9fb0c3',
            gradientAngle: 180,
            sltHighlightStartColor: '#ffffff',
            sltHighlightEndColor: '#9fb0c3',
            glowEnabled: false,
            blurUnsung: true,
            blurAmount: 1.8,
            scaleActive: 1.03,
            fontFamily: "'Montserrat', Arial, sans-serif",
            fontWeight: 700,
            letterSpacing: 0.03,
            lineHeight: 1.55,
        }
    },
    {
        name: 'Bilingual',
        description: 'Feature focus: translation (SLT) styling. A tinted, glowing translation line in its own larger Noto Sans, extra line height for the second language, and a gentle Wave on the original lyric.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#ffffff',
            sungLineColor: '#bcd4e6',
            notSungLineColor: '#4f6373',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.55,
            notSungLineOpacity: 0.22,
            gradientEnabled: true,
            gradientStartColor: '#ffffff',
            gradientEndColor: '#7fd4ff',
            gradientAngle: 175,
            glowEnabled: true,
            activeGlowColor: '#7fd4ff',
            activeGlowIntensity: 8,
            glowColor: '#7fd4ff',
            glowIntensity: 3,
            wordEffect: 'wave',
            wordEffectTrigger: 'loop',
            wordEffectIntensity: 0.35,
            wordEffectSpeed: 0.95,
            waveIntensity: 2,
            waveSpeed: 1.2,
            blurUnsung: true,
            blurAmount: 1.5,
            sltStylingEnabled: true,
            sltTranslationOpacity: 0.9,
            sltTranslationFontSize: 0.95,
            sltTranslationFont: "'Noto Sans', Arial, sans-serif",
            sltTranslationColorEnabled: true,
            sltTranslationColor: '#9fe6ff',
            sltHighlightStartColor: '#ffffff',
            sltHighlightEndColor: '#7fd4ff',
            sltGlowColorEnabled: true,
            sltGlowColor: '#00b4d8',
            fontFamily: "'Noto Sans', Arial, sans-serif",
            fontWeight: 700,
            letterSpacing: 0.02,
            lineHeight: 1.75,
        }
    },
    {
        name: 'Aurora',
        description: 'Feature focus: ambient atmosphere. A shifting green-to-violet gradient, wide background glow, an Orbit equalizer, slow scale-in and a relaxed animation speed for a dreamy, drifting feel.',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#c8ffe0',
            sungLineColor: '#c9b8ff',
            notSungLineColor: '#4a4a6a',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.55,
            notSungLineOpacity: 0.2,
            gradientEnabled: true,
            gradientStartColor: '#a8ffce',
            gradientEndColor: '#9d7bff',
            gradientAngle: 120,
            sltHighlightStartColor: '#a8ffce',
            sltHighlightEndColor: '#9d7bff',
            glowEnabled: true,
            activeGlowColor: '#a8ffce',
            activeGlowIntensity: 10,
            glowColor: '#9d7bff',
            glowIntensity: 5,
            bgGlowEnabled: true,
            bgGlowColor: '#9d7bff',
            bgGlowIntensity: 22,
            wordEffect: 'sway',
            wordEffectTrigger: 'loop',
            wordEffectIntensity: 0.6,
            wordEffectSpeed: 0.7,
            waveIntensity: 3,
            waveSpeed: 1.4,
            eqEnabled: true,
            eqStyle: 'orbit',
            eqPosition: 'both',
            eqColor: '#a8ffce',
            eqSize: 1.0,
            eqSpeed: 0.9,
            scaleActive: 1.03,
            scaleInEffect: true,
            scaleInFrom: 0.95,
            scaleInDuration: 0.6,
            animationSpeed: 0.7,
            blurUnsung: true,
            blurAmount: 2.5,
            pageBgOverlay: true,
            pageBgColor: '#0a0416',
            pageBgOpacity: 0.5,
            fontFamily: "'Poppins', Arial, sans-serif",
            fontWeight: 600,
            letterSpacing: 0.03,
            lineHeight: 1.65,
        }
    },
    {
        name: 'Raw Performance',
        description: 'Feature focus: maximum FPS. Every expensive effect off — no gradient, glow, blur, shadow, EQ, video, line window or animation. Ideal for low-end devices.',
        config: {
            ...DEFAULT_THEME,
            glowEnabled: false,
            gradientEnabled: false,
            blurUnsung: false,
            blurSungWords: false,
            bgGlowEnabled: false,
            textShadowEnabled: false,
            wordEffect: 'none',
            lineWindowEnabled: false,
            scaleInEffect: false,
            eqEnabled: false,
            musicVideoEnabled: false,
            playerControlsAnimation: false,
            disableHighlight: false,
            scaleActive: 1.0,
            activeLineColor: '#ffffff',
            sungLineColor: '#b6beca',
            notSungLineColor: '#6b7280',
            sungLineOpacity: 0.5,
            notSungLineOpacity: 0.25,
            activeLineOpacity: 1.0,
            sltHighlightStartColor: '#ffffff',
            sltHighlightEndColor: '#ffffff',
            fontFamily: 'Segoe UI, system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: 0.03,
            lineHeight: 1.5,
        }
    },
];

export interface ThemeState {
    activeTheme: ThemeConfig;
    activePresetName: string;
    customPresets: ThemePreset[];
    isEnabled: boolean;
    activeBasePreset?: string;
    activeSourceId?: string;
    activeSourceVersion?: number;
    activeSourceName?: string;
    activeSourceFingerprint?: string;
}

const CLAMPS: Partial<Record<keyof ThemeConfig, [number, number]>> = {
    activeLineOpacity: [0, 1],
    sungLineOpacity: [0, 1],
    notSungLineOpacity: [0, 1],
    pageBgOpacity: [0, 1],
    pageBgImageBlur: [0, 40],
    pageBgImageDim: [0, 1],
    animBgOpacity: [0.05, 1],
    animBgSpeed: [0, 3],
    animBgReactivity: [0, 2],
    animBgIdleMotion: [0, 1],
    animBgDensity: [0, 1],
    animBgThickness: [0, 1],
    animBgAmplitude: [0, 1],
    animBgAngle: [-180, 180],
    animBgPerspective: [0, 1],
    animBgGlow: [0, 1.5],
    animBgBrightness: [0.2, 2],
    animBgHueCycle: [0, 1],
    animBgGrain: [0, 0.2],
    animBgVignette: [0, 1],
    animBgBlur: [0, 30],
    sltTranslationOpacity: [0, 1],
    blurAmount: [0, 8],
    blurPreviewLines: [0, 5],
    blurSungWordsAmount: [0, 8],
    blurSungWordsOpacity: [0.05, 1],
    textShadowOpacity: [0, 1],
    textShadowBlur: [0, 20],
    textShadowOffsetX: [-10, 10],
    textShadowOffsetY: [-10, 10],
    lineWindowSungLines: [0, 10],
    lineWindowUnsungLines: [0, 10],
    glowIntensity: [0, 15],
    activeGlowIntensity: [0, 15],
    bgGlowIntensity: [0, 30],
    glowPulseSpeed: [0.3, 3.0],
    activeLineWeight: [0, 900],
    sltTranslationFontSize: [0.25, 2.0],
    sltActiveLineOpacity: [0, 1],
    sltSungLineOpacity: [0, 1],
    sltNotSungLineOpacity: [0, 1],
    sltGradientAngle: [0, 360],
    sltGradientFeather: [0, 60],
    sltFontWeight: [100, 900],
    sltActiveLineWeight: [0, 900],
    sltLyricsScale: [0.25, 2.0],
    sltLetterSpacing: [-0.1, 0.3],
    sltWordSpacing: [-0.1, 1.0],
    sltLineHeight: [1.0, 2.5],
    sltMaxLineWidth: [0, 100],
    sltActiveGlowIntensity: [0, 15],
    sltGlowIntensity: [0, 15],
    sltGlowPulseSpeed: [0.3, 3.0],
    sltBgGlowIntensity: [0, 30],
    sltTextShadowOpacity: [0, 1],
    sltTextShadowBlur: [0, 20],
    sltTextShadowOffsetX: [-10, 10],
    sltTextShadowOffsetY: [-10, 10],
    sltTextStrokeWidth: [0, 3],
    sltBlurAmount: [0, 8],
    sltBlurSungWordsAmount: [0, 8],
    sltBlurSungWordsOpacity: [0.05, 1],
    sltWordEffectIntensity: [0.1, 2.0],
    sltWordEffectSpeed: [0.3, 3.0],
    sltWordEffectStagger: [0, 150],
    sltScaleActive: [0.95, 1.12],
    sltScaleInFrom: [0.85, 1.05],
    sltScaleInDuration: [0.1, 1.0],
    sltAnimationSpeed: [0.3, 3.0],
    scaleActive: [0.95, 1.12],
    scaleInFrom: [0.85, 1.05],
    scaleInDuration: [0.1, 1.0],
    animationSpeed: [0.3, 3.0],
    gradientAngle: [0, 360],
    popScale: [1.0, 1.3],
    popDuration: [0.1, 0.6],
    waveIntensity: [1, 10],
    waveSpeed: [0.3, 2.0],
    wordEffectIntensity: [0.1, 2.0],
    wordEffectSpeed: [0.3, 3.0],
    wordEffectStagger: [0, 150],
    textStrokeWidth: [0, 3],
    gradientFeather: [0, 60],
    wordSpacing: [-0.1, 1.0],
    maxLineWidth: [0, 100],
    lineHeight: [1.0, 2.5],
    letterSpacing: [-0.1, 0.3],
    lyricsScale: [0.25, 2.0],
    fontWeight: [100, 900],
    playerArtRadius: [0, 50],
    playerProgressThickness: [0.5, 5],
    musicVideoDim: [0, 1],
    eqSize: [0.4, 2.5],
    eqSpeed: [0.3, 3.0],
};

const COLOR_KEYS: (keyof ThemeConfig)[] = [
    'activeLineColor', 'sungLineColor', 'notSungLineColor',
    'glowColor', 'activeGlowColor',
    'gradientStartColor', 'gradientEndColor',
    'textShadowColor', 'pageBgColor',
    'sltTranslationColor', 'sltHighlightStartColor', 'sltHighlightEndColor', 'sltGlowColor',
    'sltActiveLineColor', 'sltSungLineColor', 'sltNotSungLineColor',
    'sltGradientStartColor', 'sltGradientEndColor',
    'sltActiveGlowColor', 'sltInactiveGlowColor', 'sltBgGlowColor',
    'sltTextShadowColor', 'sltTextStrokeColor', 'sltHighlightColor',
    'bgGlowColor', 'highlightColor', 'eqColor', 'playerAccentColor',
    'textStrokeColor',
    'animBgColor', 'animBgColor2', 'animBgBgColor',
];

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_RE = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/;
const FONT_NAME_RE = /^[A-Za-z0-9 ,'"._-]*$/;
const BG_IMAGE_ID_RE = /^[a-z0-9-]{0,64}$/;

function sanitizeColor(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    return HEX_COLOR_RE.test(v) || RGB_COLOR_RE.test(v) ? v : fallback;
}

function sanitizeFont(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    if (v === '' || v === 'Custom Font') return v;
    return FONT_NAME_RE.test(v) ? v : fallback;
}

export function sanitizeThemeString<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]): ThemeConfig[K] {
    if (typeof value !== 'string') return value;
    if (COLOR_KEYS.includes(key)) {
        return sanitizeColor(value, DEFAULT_THEME[key] as string) as ThemeConfig[K];
    }
    if (key === 'fontFamily' || key === 'sltTranslationFont' || key === 'sltFontFamily') {
        return sanitizeFont(value, DEFAULT_THEME[key] as string) as ThemeConfig[K];
    }
    if (key === 'pageBgImage') {
        return (BG_IMAGE_ID_RE.test(value) ? value : '') as ThemeConfig[K];
    }
    return value;
}

function normalizeThemeConfig(config: ThemeConfig): ThemeConfig {
    const normalized = { ...config };
    for (const [key, range] of Object.entries(CLAMPS) as [keyof ThemeConfig, [number, number]][]) {
        const value = (normalized as any)[key];
        if (typeof value === 'number') {
            (normalized as any)[key] = Math.min(Math.max(value, range[0]), range[1]);
        }
    }

    if (!EQ_STYLE_IDS.includes(normalized.eqStyle)) {
        normalized.eqStyle = 'equalizer';
    }

    if (!WORD_EFFECT_IDS.includes(normalized.wordEffect)) {
        normalized.wordEffect = 'none';
    }
    if (normalized.wordEffect === 'none' && (normalized.popEffect || normalized.waveEffect)) {
        normalized.wordEffect = normalized.popEffect ? 'pop' : 'wave';
    }
    normalized.popEffect = normalized.wordEffect === 'pop';
    normalized.waveEffect = normalized.wordEffect === 'wave';

    const meta = wordEffectMeta(normalized.wordEffect);
    if (!meta || (normalized.wordEffectTrigger !== 'auto' && !meta.triggers.includes(normalized.wordEffectTrigger as WordEffectTrigger))) {
        normalized.wordEffectTrigger = 'auto';
    }

    if (!WORD_EFFECT_IDS.includes(normalized.sltWordEffect)) {
        normalized.sltWordEffect = 'none';
    }

    const sltMeta = wordEffectMeta(normalized.sltWordEffect);
    if (!sltMeta || (normalized.sltWordEffectTrigger !== 'auto' && !sltMeta.triggers.includes(normalized.sltWordEffectTrigger as WordEffectTrigger))) {
        normalized.sltWordEffectTrigger = 'auto';
    }

    if (!['normal', 'italic', 'oblique'].includes(normalized.fontStyle)) {
        normalized.fontStyle = 'normal';
    }

    if (!['normal', 'italic', 'oblique'].includes(normalized.sltFontStyle)) {
        normalized.sltFontStyle = 'normal';
    }

    if (!['default', 'left', 'center', 'right'].includes(normalized.textAlign)) {
        normalized.textAlign = 'default';
    }

    if (!['default', 'left', 'center', 'right'].includes(normalized.sltTextAlign)) {
        normalized.sltTextAlign = 'default';
    }

    for (const key of COLOR_KEYS) {
        (normalized as any)[key] = sanitizeColor((normalized as any)[key], (DEFAULT_THEME as any)[key]);
    }
    normalized.fontFamily = sanitizeFont(normalized.fontFamily, DEFAULT_THEME.fontFamily);
    normalized.sltTranslationFont = sanitizeFont(normalized.sltTranslationFont, DEFAULT_THEME.sltTranslationFont);
    normalized.sltFontFamily = sanitizeFont(normalized.sltFontFamily, DEFAULT_THEME.sltFontFamily);

    if (!['both', 'left', 'right'].includes(normalized.eqPosition)) {
        normalized.eqPosition = 'both';
    }

    if (!['auto', 'horizontal', 'vertical', 'diagonal', 'custom'].includes(normalized.gradientDirection)) {
        normalized.gradientDirection = 'auto';
    }

    if (!['auto', 'horizontal', 'vertical', 'diagonal', 'custom'].includes(normalized.sltGradientDirection)) {
        normalized.sltGradientDirection = 'auto';
    }

    if (!['none', 'uppercase', 'lowercase', 'capitalize'].includes(normalized.textTransform)) {
        normalized.textTransform = 'none';
    }

    if (!['none', 'uppercase', 'lowercase', 'capitalize'].includes(normalized.sltTextTransform)) {
        normalized.sltTextTransform = 'none';
    }

    if (typeof normalized.pageBgImage !== 'string' || !BG_IMAGE_ID_RE.test(normalized.pageBgImage)) {
        normalized.pageBgImage = '';
    }

    if (!['cover', 'contain', 'stretch', 'tile'].includes(normalized.pageBgImageFit)) {
        normalized.pageBgImageFit = 'cover';
    }

    if (!['center', 'top', 'bottom', 'left', 'right'].includes(normalized.pageBgImagePosition)) {
        normalized.pageBgImagePosition = 'center';
    }

    if (!ANIM_BG_STYLE_IDS.includes(normalized.animBgStyle)) {
        normalized.animBgStyle = DEFAULT_THEME.animBgStyle;
    }

    if (!['custom', 'album', 'spectrum'].includes(normalized.animBgPalette)) {
        normalized.animBgPalette = 'custom';
    }

    if (!['solid', 'blend'].includes(normalized.animBgBackdrop)) {
        normalized.animBgBackdrop = 'solid';
    }

    if (!['performance', 'balanced', 'quality'].includes(normalized.animBgQuality)) {
        normalized.animBgQuality = 'balanced';
    }

    if (!['30', '60', 'max'].includes(normalized.animBgFps)) {
        normalized.animBgFps = '60';
    }

    normalized.lineHeight = Math.round(normalized.lineHeight * 100) / 100;
    return normalized;
}

const POP_BASE_SCALE_DELTA = 0.10;
const POP_BASE_DURATION = 0.34;
const WAVE_BASE_HEIGHT = 6;
const WAVE_BASE_DURATION = 1.1;

export function mergeThemeConfig(raw: Partial<ThemeConfig> | null | undefined): ThemeConfig {
    const merged = { ...DEFAULT_THEME, ...(raw || {}) };
    const source = (raw || {}) as Partial<ThemeConfig>;

    if (raw && source.wordEffect === undefined) {
        merged.wordEffect = merged.popEffect ? 'pop' : merged.waveEffect ? 'wave' : 'none';
    }

    if (raw && source.wordEffectIntensity === undefined) {
        if (merged.wordEffect === 'pop' && typeof source.popScale === 'number') {
            merged.wordEffectIntensity = (source.popScale - 1) / POP_BASE_SCALE_DELTA;
        } else if (merged.wordEffect === 'wave' && typeof source.waveIntensity === 'number') {
            merged.wordEffectIntensity = source.waveIntensity / WAVE_BASE_HEIGHT;
        }
    }

    if (raw && source.wordEffectSpeed === undefined) {
        if (merged.wordEffect === 'pop' && typeof source.popDuration === 'number' && source.popDuration > 0) {
            merged.wordEffectSpeed = POP_BASE_DURATION / source.popDuration;
        } else if (merged.wordEffect === 'wave' && typeof source.waveSpeed === 'number' && source.waveSpeed > 0) {
            merged.wordEffectSpeed = WAVE_BASE_DURATION / source.waveSpeed;
        }
    }

    if (raw && source.wordEffectTrigger === undefined && merged.wordEffect === 'pop') {
        merged.wordEffectTrigger = 'line';
    }

    return normalizeThemeConfig(merged);
}

export function themeFingerprint(config: Partial<ThemeConfig> | null | undefined): string {
    if (!config) return '';
    const defaults = DEFAULT_THEME as unknown as Record<string, unknown>;
    let hash = 0x811c9dc5;
    for (const key of Object.keys(config).sort()) {
        const value = (config as Record<string, unknown>)[key];
        if (value === undefined) continue;
        if (key in defaults && value === defaults[key]) continue;
        const chunk = key + '=' + (typeof value === 'object' ? JSON.stringify(value) : String(value)) + ';';
        for (let i = 0; i < chunk.length; i++) {
            hash ^= chunk.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
    }
    return (hash >>> 0).toString(16);
}

function sanitizePreset(raw: unknown): ThemePreset | null {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw as Record<string, unknown>;
    if (typeof src.name !== 'string' || !src.name) return null;
    const preset: ThemePreset = {
        name: src.name,
        description: typeof src.description === 'string' ? src.description : '',
        config: mergeThemeConfig(src.config as Partial<ThemeConfig> | null),
    };
    if (typeof src.sourceId === 'string' && src.sourceId) preset.sourceId = src.sourceId;
    if (typeof src.sourceVersion === 'number' && isFinite(src.sourceVersion)) preset.sourceVersion = src.sourceVersion;
    if (typeof src.sourceName === 'string' && src.sourceName) preset.sourceName = src.sourceName;
    if (typeof src.sourceFingerprint === 'string' && src.sourceFingerprint) preset.sourceFingerprint = src.sourceFingerprint;
    if (src.sourceRemoved === true) preset.sourceRemoved = true;
    return preset;
}

export function sanitizeCustomPresets(raw: unknown): ThemePreset[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizePreset).filter((p): p is ThemePreset => p !== null);
}

export function sanitizeThemeSource(raw: unknown): ThemeSource | null {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw as Record<string, unknown>;
    if (typeof src.id !== 'string' || !src.id) return null;
    return {
        id: src.id,
        version: typeof src.version === 'number' && isFinite(src.version) ? src.version : 1,
        name: typeof src.name === 'string' ? src.name : '',
        fingerprint: typeof src.fingerprint === 'string' && src.fingerprint ? src.fingerprint : undefined,
    };
}

function loadCustomPresets(): ThemePreset[] {
    try {
        const raw = storage.get('custom-presets');
        if (raw) return sanitizeCustomPresets(JSON.parse(raw));
    } catch (e) {}
    return [];
}

function loadStoredNumber(key: string): number | undefined {
    const raw = storage.get(key);
    if (raw === null || raw === '') return undefined;
    const parsed = Number(raw);
    return isFinite(parsed) ? parsed : undefined;
}

function loadActiveTheme(): ThemeConfig {
    try {
        const raw = storage.get('active-theme');
        if (raw) {
            return mergeThemeConfig(JSON.parse(raw));
        }
    } catch (e) {}
    return mergeThemeConfig(null);
}

export const themeState: ThemeState = {
    activeTheme: loadActiveTheme(),
    activePresetName: storage.get('active-preset') || 'Default',
    customPresets: loadCustomPresets(),
    isEnabled: storage.get('enabled') !== 'false',
    activeBasePreset: storage.get('active-base-preset') || undefined,
    activeSourceId: storage.get('active-source-id') || undefined,
    activeSourceVersion: loadStoredNumber('active-source-version'),
    activeSourceName: storage.get('active-source-name') || undefined,
    activeSourceFingerprint: storage.get('active-source-fingerprint') || undefined,
};

const FINGERPRINT_FORMAT = '2';

function migrateFingerprintFormat(): void {
    if (storage.get('fingerprint-format') === FINGERPRINT_FORMAT) return;
    let changed = false;

    themeState.customPresets.forEach(preset => {
        if (!preset.sourceFingerprint) return;
        const current = themeFingerprint(preset.config);
        if (current !== preset.sourceFingerprint) {
            preset.sourceFingerprint = current;
            changed = true;
        }
    });

    if (themeState.activeSourceFingerprint) {
        const current = themeFingerprint(themeState.activeTheme);
        if (current !== themeState.activeSourceFingerprint) {
            themeState.activeSourceFingerprint = current;
            changed = true;
        }
    }

    storage.set('fingerprint-format', FINGERPRINT_FORMAT);
    if (changed) saveThemeState();
}

function persistOptional(key: string, value: string | number | undefined): void {
    if (value === undefined || value === '') {
        storage.remove(key);
        return;
    }
    storage.set(key, String(value));
}

export function saveThemeState(): void {
    storage.set('active-theme', JSON.stringify(themeState.activeTheme));
    storage.set('active-preset', themeState.activePresetName);
    storage.set('custom-presets', JSON.stringify(themeState.customPresets));
    storage.set('enabled', String(themeState.isEnabled));
    persistOptional('active-base-preset', themeState.activeBasePreset);
    persistOptional('active-source-id', themeState.activeSourceId);
    persistOptional('active-source-version', themeState.activeSourceVersion);
    persistOptional('active-source-name', themeState.activeSourceName);
    persistOptional('active-source-fingerprint', themeState.activeSourceFingerprint);
}

migrateFingerprintFormat();

export function setActiveSource(source: ThemeSource | null): void {
    themeState.activeSourceId = source ? source.id : undefined;
    themeState.activeSourceVersion = source ? source.version : undefined;
    themeState.activeSourceName = source ? source.name : undefined;
    themeState.activeSourceFingerprint = source ? source.fingerprint : undefined;
}

export function presetSource(preset: ThemePreset): ThemeSource | null {
    if (!preset.sourceId) return null;
    return {
        id: preset.sourceId,
        version: preset.sourceVersion ?? 1,
        name: preset.sourceName || preset.name,
        fingerprint: preset.sourceFingerprint,
    };
}

export function applyPreset(preset: ThemePreset): void {
    themeState.activeTheme = mergeThemeConfig(preset.config);
    themeState.activePresetName = preset.name;
    themeState.activeBasePreset = preset.name;
    setActiveSource(presetSource(preset));
    saveThemeState();
}

export function activeBaseName(): string {
    return themeState.activeBasePreset || themeState.activePresetName;
}

export function getAllPresets(): ThemePreset[] {
    return [...BUILTIN_PRESETS, ...themeState.customPresets];
}

export function findCustomPresetIndex(name: string, sourceId?: string): number {
    if (sourceId) {
        const byId = themeState.customPresets.findIndex(p => p.sourceId === sourceId);
        if (byId >= 0) return byId;
    }
    return themeState.customPresets.findIndex(p => p.name === name && !(sourceId && p.sourceId));
}

export function upsertCustomPreset(preset: ThemePreset): void {
    const existing = findCustomPresetIndex(preset.name, preset.sourceId);
    if (existing >= 0) {
        themeState.customPresets[existing] = preset;
    } else {
        themeState.customPresets.push(preset);
    }
    saveThemeState();
}

export function saveCustomPreset(name: string, description: string, source?: ThemeSource | null): void {
    const existing = findCustomPresetIndex(name, source?.id);
    const preset: ThemePreset = {
        name,
        description,
        config: { ...themeState.activeTheme }
    };
    if (source) {
        preset.sourceId = source.id;
        preset.sourceVersion = source.version;
        preset.sourceName = source.name;
        preset.sourceFingerprint = source.fingerprint;
    } else if (existing >= 0) {
        const prev = themeState.customPresets[existing];
        preset.sourceId = prev.sourceId;
        preset.sourceVersion = prev.sourceVersion;
        preset.sourceName = prev.sourceName;
        preset.sourceFingerprint = prev.sourceFingerprint;
        preset.sourceRemoved = prev.sourceRemoved;
    }
    if (existing >= 0) {
        themeState.customPresets[existing] = preset;
    } else {
        themeState.customPresets.push(preset);
    }
    themeState.activeBasePreset = name;
    themeState.activePresetName = name;
    saveThemeState();
}

export function deleteCustomPreset(name: string, sourceId?: string): boolean {
    const index = sourceId
        ? themeState.customPresets.findIndex(p => p.sourceId === sourceId)
        : themeState.customPresets.findIndex(p => p.name === name && !p.sourceId);
    if (index >= 0) {
        const [removed] = themeState.customPresets.splice(index, 1);
        if (themeState.activeBasePreset === removed.name) themeState.activeBasePreset = undefined;
        saveThemeState();
        return true;
    }
    return false;
}

function seedTranslationStyle(theme: ThemeConfig): void {
    const opacity = theme.sltTranslationOpacity;
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const glowColor = theme.sltGlowColorEnabled && theme.sltGlowColor ? theme.sltGlowColor : '';

    theme.sltActiveLineColor = theme.sltHighlightStartColor;
    theme.sltSungLineColor = theme.sltTranslationColorEnabled && theme.sltTranslationColor
        ? theme.sltTranslationColor
        : theme.sungLineColor;
    theme.sltNotSungLineColor = theme.sltTranslationColorEnabled && theme.sltTranslationColor
        ? theme.sltTranslationColor
        : theme.notSungLineColor;
    theme.sltActiveLineOpacity = round3(theme.activeLineOpacity * opacity);
    theme.sltSungLineOpacity = round3(theme.sungLineOpacity * opacity);
    theme.sltNotSungLineOpacity = round3(theme.notSungLineOpacity * opacity);

    theme.sltGradientEnabled = true;
    theme.sltGradientStartColor = theme.sltHighlightStartColor;
    theme.sltGradientEndColor = theme.sltHighlightEndColor;
    theme.sltGradientDirection = 'auto';
    theme.sltGradientAngle = theme.gradientAngle;
    theme.sltGradientFeather = theme.gradientFeather;

    theme.sltFontFamily = theme.sltTranslationFont;
    theme.sltFontWeight = theme.fontWeight;
    theme.sltActiveLineWeight = theme.activeLineWeight;
    theme.sltTextTransform = theme.textTransform;
    theme.sltFontStyle = theme.fontStyle;
    theme.sltLyricsScale = round3(theme.sltTranslationFontSize * theme.lyricsScale);
    theme.sltLetterSpacing = theme.letterSpacing;
    theme.sltWordSpacing = theme.wordSpacing;
    theme.sltLineHeight = theme.lineHeight;
    theme.sltTextAlign = theme.textAlign;
    theme.sltMaxLineWidth = theme.maxLineWidth;

    theme.sltGlowEnabled = theme.glowEnabled;
    theme.sltActiveGlowColor = glowColor || theme.activeGlowColor;
    theme.sltActiveGlowIntensity = theme.activeGlowIntensity;
    theme.sltInactiveGlowColor = glowColor || theme.glowColor;
    theme.sltGlowIntensity = theme.glowIntensity;
    theme.sltGlowPulse = theme.glowPulse;
    theme.sltGlowPulseSpeed = theme.glowPulseSpeed;
    theme.sltBgGlowEnabled = theme.bgGlowEnabled;
    theme.sltBgGlowColor = glowColor || theme.bgGlowColor;
    theme.sltBgGlowIntensity = theme.bgGlowIntensity;

    theme.sltTextShadowEnabled = theme.textShadowEnabled;
    theme.sltTextShadowColor = theme.textShadowColor;
    theme.sltTextShadowOpacity = theme.textShadowOpacity;
    theme.sltTextShadowBlur = theme.textShadowBlur;
    theme.sltTextShadowOffsetX = theme.textShadowOffsetX;
    theme.sltTextShadowOffsetY = theme.textShadowOffsetY;
    theme.sltTextStrokeEnabled = theme.textStrokeEnabled;
    theme.sltTextStrokeColor = theme.textStrokeColor;
    theme.sltTextStrokeWidth = theme.textStrokeWidth;

    theme.sltBlurUnsung = theme.blurUnsung;
    theme.sltBlurAmount = theme.blurAmount;
    theme.sltBlurSungWords = theme.blurSungWords;
    theme.sltBlurSungWordsAmount = theme.blurSungWordsAmount;
    theme.sltBlurSungWordsOpacity = theme.blurSungWordsOpacity;

    theme.sltWordEffect = theme.wordEffect;
    theme.sltWordEffectTrigger = theme.wordEffectTrigger;
    theme.sltWordEffectIntensity = theme.wordEffectIntensity;
    theme.sltWordEffectSpeed = theme.wordEffectSpeed;
    theme.sltWordEffectStagger = theme.wordEffectStagger;
    theme.sltScaleActive = theme.scaleActive;
    theme.sltScaleInEffect = theme.scaleInEffect;
    theme.sltScaleInFrom = theme.scaleInFrom;
    theme.sltScaleInDuration = theme.scaleInDuration;
    theme.sltAnimationSpeed = theme.animationSpeed;
    theme.sltDisableHighlight = theme.disableHighlight;
    theme.sltHighlightColor = theme.highlightColor;
}

export function updateThemeProperty<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]): void {
    if (typeof value === 'number') {
        const range = CLAMPS[key];
        if (range) {
            value = Math.min(Math.max(value as number, range[0]), range[1]) as ThemeConfig[K];
        }
        if (key === 'lineHeight') {
            value = Math.round((value as number) * 100) / 100 as ThemeConfig[K];
        }
    } else if (typeof value === 'string') {
        value = sanitizeThemeString(key, value);
    }
    themeState.activeTheme[key] = value;

    if (key === 'wordEffect') {
        themeState.activeTheme.popEffect = value === 'pop';
        themeState.activeTheme.waveEffect = value === 'wave';
        const meta = wordEffectMeta(String(value));
        const trigger = themeState.activeTheme.wordEffectTrigger;
        if (!meta || (trigger !== 'auto' && !meta.triggers.includes(trigger as WordEffectTrigger))) {
            themeState.activeTheme.wordEffectTrigger = 'auto';
        }
    }
    if (key === 'sltIndependent' && value === true) {
        seedTranslationStyle(themeState.activeTheme);
    }
    if (key === 'popEffect') {
        themeState.activeTheme.waveEffect = value === true ? false : themeState.activeTheme.waveEffect;
        themeState.activeTheme.wordEffect = value === true ? 'pop' : (themeState.activeTheme.waveEffect ? 'wave' : 'none');
    }
    if (key === 'waveEffect') {
        themeState.activeTheme.popEffect = value === true ? false : themeState.activeTheme.popEffect;
        themeState.activeTheme.wordEffect = value === true ? 'wave' : (themeState.activeTheme.popEffect ? 'pop' : 'none');
    }

    themeState.activePresetName = 'Custom';
    saveThemeState();
}
