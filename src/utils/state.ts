import { storage } from './storage';

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

    bgGlowEnabled: boolean;
    bgGlowColor: string;
    bgGlowIntensity: number;

    disableHighlight: boolean;
    highlightColor: string;
    wordEffect: string;
    popEffect: boolean;
    popScale: number;
    popDuration: number;

    waveEffect: boolean;
    waveIntensity: number;
    waveSpeed: number;

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
    musicVideoDim: number;

    eqEnabled: boolean;
    eqStyle: string;
    eqPosition: string;
    eqColor: string;
    eqSize: number;
    eqSpeed: number;
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

    bgGlowEnabled: false,
    bgGlowColor: '#ffffff',
    bgGlowIntensity: 12,

    disableHighlight: false,
    highlightColor: '#ffffff',
    wordEffect: 'none',
    popEffect: false,
    popScale: 1.05,
    popDuration: 0.3,

    waveEffect: false,
    waveIntensity: 4,
    waveSpeed: 0.8,

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
    musicVideoDim: 0.3,

    eqEnabled: false,
    eqStyle: 'equalizer',
    eqPosition: 'both',
    eqColor: '#ffffff',
    eqSize: 1.0,
    eqSpeed: 1.0,
};

export interface ThemePreset {
    name: string;
    description: string;
    config: ThemeConfig;
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
            wordEffect: 'pop',
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
            wordEffect: 'wave',
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
}

const CLAMPS: Partial<Record<keyof ThemeConfig, [number, number]>> = {
    activeLineOpacity: [0, 1],
    sungLineOpacity: [0, 1],
    notSungLineOpacity: [0, 1],
    pageBgOpacity: [0, 1],
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
    scaleActive: [0.95, 1.12],
    scaleInFrom: [0.85, 1.05],
    scaleInDuration: [0.1, 1.0],
    animationSpeed: [0.3, 3.0],
    gradientAngle: [0, 360],
    popScale: [1.0, 1.3],
    popDuration: [0.1, 0.6],
    waveIntensity: [1, 10],
    waveSpeed: [0.3, 2.0],
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
    'bgGlowColor', 'highlightColor', 'eqColor', 'playerAccentColor',
];

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_RE = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/;
const FONT_NAME_RE = /^[A-Za-z0-9 ,'"._-]*$/;

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
    if (key === 'fontFamily' || key === 'sltTranslationFont') {
        return sanitizeFont(value, DEFAULT_THEME[key] as string) as ThemeConfig[K];
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

    const eqStyles = ['equalizer', 'dotwave', 'signal', 'orbit', 'pulsedot', 'spectrumring'];
    if (!eqStyles.includes(normalized.eqStyle)) {
        normalized.eqStyle = 'equalizer';
    }

    if (normalized.wordEffect !== 'pop' && normalized.wordEffect !== 'wave') {
        normalized.wordEffect = 'none';
    }
    if (normalized.wordEffect === 'none' && (normalized.popEffect || normalized.waveEffect)) {
        normalized.wordEffect = normalized.popEffect ? 'pop' : 'wave';
    }
    normalized.popEffect = normalized.wordEffect === 'pop';
    normalized.waveEffect = normalized.wordEffect === 'wave';

    for (const key of COLOR_KEYS) {
        (normalized as any)[key] = sanitizeColor((normalized as any)[key], (DEFAULT_THEME as any)[key]);
    }
    normalized.fontFamily = sanitizeFont(normalized.fontFamily, DEFAULT_THEME.fontFamily);
    normalized.sltTranslationFont = sanitizeFont(normalized.sltTranslationFont, DEFAULT_THEME.sltTranslationFont);

    if (!['both', 'left', 'right'].includes(normalized.eqPosition)) {
        normalized.eqPosition = 'both';
    }

    if (!['auto', 'horizontal', 'vertical', 'diagonal'].includes(normalized.gradientDirection)) {
        normalized.gradientDirection = 'auto';
    }

    if (!['none', 'uppercase', 'lowercase', 'capitalize'].includes(normalized.textTransform)) {
        normalized.textTransform = 'none';
    }

    normalized.lineHeight = Math.round(normalized.lineHeight * 100) / 100;
    return normalized;
}

export function mergeThemeConfig(raw: Partial<ThemeConfig> | null | undefined): ThemeConfig {
    const merged = { ...DEFAULT_THEME, ...(raw || {}) };
    if (raw && (raw as any).wordEffect === undefined) {
        merged.wordEffect = merged.popEffect ? 'pop' : merged.waveEffect ? 'wave' : 'none';
    }
    return normalizeThemeConfig(merged);
}

function loadCustomPresets(): ThemePreset[] {
    try {
        const raw = storage.get('custom-presets');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
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
};

export function saveThemeState(): void {
    storage.set('active-theme', JSON.stringify(themeState.activeTheme));
    storage.set('active-preset', themeState.activePresetName);
    storage.set('custom-presets', JSON.stringify(themeState.customPresets));
    storage.set('enabled', String(themeState.isEnabled));
}

export function applyPreset(preset: ThemePreset): void {
    themeState.activeTheme = mergeThemeConfig(preset.config);
    themeState.activePresetName = preset.name;
    saveThemeState();
}

export function getAllPresets(): ThemePreset[] {
    return [...BUILTIN_PRESETS, ...themeState.customPresets];
}

export function saveCustomPreset(name: string, description: string): void {
    const existing = themeState.customPresets.findIndex(p => p.name === name);
    const preset: ThemePreset = {
        name,
        description,
        config: { ...themeState.activeTheme }
    };
    if (existing >= 0) {
        themeState.customPresets[existing] = preset;
    } else {
        themeState.customPresets.push(preset);
    }
    saveThemeState();
}

export function deleteCustomPreset(name: string): boolean {
    const index = themeState.customPresets.findIndex(p => p.name === name);
    if (index >= 0) {
        themeState.customPresets.splice(index, 1);
        saveThemeState();
        return true;
    }
    return false;
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
