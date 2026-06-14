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
    playerControlsAnimation: boolean;
    playerHideShuffle: boolean;
    playerHideRepeat: boolean;
    playerHideLike: boolean;

    musicVideoEnabled: boolean;
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
    highlightColor: 'rgba(255, 255, 255, 0.2)',
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
    playerControlsAnimation: false,
    playerHideShuffle: false,
    playerHideRepeat: false,
    playerHideLike: false,

    musicVideoEnabled: false,
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
        description: 'Balanced baseline preset with clean contrast and comfortable spacing',
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
            popEffect: false,
            waveEffect: false,
            scaleActive: 1.02,
        }
    },
    {
        name: 'SpotiGlow',
        description: 'High-contrast Spotify green with looser spacing and cleaner glow',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#1db954',
            sungLineColor: '#7fffad',
            notSungLineColor: '#5f7a68',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.55,
            notSungLineOpacity: 0.2,
            glowEnabled: true,
            activeGlowColor: '#1db954',
            activeGlowIntensity: 10,
            glowColor: '#1db954',
            glowIntensity: 4,
            gradientEnabled: true,
            gradientStartColor: '#1db954',
            gradientEndColor: '#00ff88',
            gradientAngle: 135,
            sltHighlightStartColor: '#1db954',
            sltHighlightEndColor: '#00ff88',
            bgGlowEnabled: true,
            bgGlowColor: '#1db954',
            bgGlowIntensity: 9,
            disableHighlight: false,
            wordEffect: 'pop',
            popEffect: true,
            popScale: 1.08,
            popDuration: 0.2,
            waveEffect: false,
            waveIntensity: 3,
            waveSpeed: 0.86,
            fontFamily: 'Bahnschrift, Segoe UI, system-ui, sans-serif',
            fontWeight: 750,
            letterSpacing: 0.04,
            lineHeight: 1.6,
            blurUnsung: true,
            blurAmount: 1.2,
            scaleActive: 1.03,
        }
    },
    {
        name: 'Sunset',
        description: 'Warm cinematic blend with looser type rhythm and softer effects',
        config: {
            ...DEFAULT_THEME,
            gradientEnabled: true,
            gradientStartColor: '#ff6b35',
            gradientEndColor: '#f7c948',
            gradientAngle: 135,
            sltHighlightStartColor: '#ff6b35',
            sltHighlightEndColor: '#f7c948',
            activeLineColor: '#ff6b35',
            sungLineColor: '#ffd27a',
            notSungLineColor: '#836d56',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.58,
            notSungLineOpacity: 0.24,
            glowEnabled: true,
            activeGlowColor: '#ff6b35',
            activeGlowIntensity: 8,
            glowColor: '#f7c948',
            glowIntensity: 4,
            bgGlowEnabled: true,
            bgGlowColor: '#ff6b35',
            bgGlowIntensity: 8,
            disableHighlight: false,
            wordEffect: 'wave',
            popEffect: false,
            waveEffect: true,
            waveIntensity: 2,
            waveSpeed: 1.12,
            blurUnsung: true,
            blurAmount: 1.4,
            fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
            fontWeight: 700,
            letterSpacing: 0.045,
            lineHeight: 1.62,
            animationSpeed: 0.8,
        }
    },
    {
        name: 'Deep Ocean',
        description: 'Calm deep-blue atmosphere with crisp active focus',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#00d4ff',
            sungLineColor: '#5ec8ff',
            notSungLineColor: '#466a84',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.55,
            notSungLineOpacity: 0.22,
            glowEnabled: true,
            activeGlowColor: '#00d4ff',
            activeGlowIntensity: 14,
            glowColor: '#0088cc',
            glowIntensity: 6,
            gradientEnabled: true,
            gradientStartColor: '#00d4ff',
            gradientEndColor: '#0066aa',
            gradientAngle: 180,
            sltHighlightStartColor: '#00d4ff',
            sltHighlightEndColor: '#5ec8ff',
            bgGlowEnabled: true,
            bgGlowColor: '#00d4ff',
            bgGlowIntensity: 14,
            disableHighlight: false,
            blurUnsung: true,
            blurAmount: 3.5,
            popEffect: false,
            waveEffect: false,
            fontFamily: 'Georgia, Cambria, Times New Roman, serif',
            fontWeight: 700,
            letterSpacing: 0.035,
            lineHeight: 1.6,
            scaleActive: 1.02,
        }
    },
    {
        name: 'Synthwave',
        description: 'Retro neon contrast with fast pulse and wave motion',
        config: {
            ...DEFAULT_THEME,
            gradientEnabled: true,
            gradientStartColor: '#ff00ff',
            gradientEndColor: '#00ffff',
            gradientAngle: 90,
            sltHighlightStartColor: '#ff00ff',
            sltHighlightEndColor: '#00ffff',
            activeLineColor: '#ff00ff',
            sungLineColor: '#ff8cf6',
            notSungLineColor: '#6d4e7a',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.6,
            notSungLineOpacity: 0.2,
            glowEnabled: true,
            activeGlowColor: '#ff00ff',
            activeGlowIntensity: 15,
            glowColor: '#00ffff',
            glowIntensity: 6,
            bgGlowEnabled: true,
            bgGlowColor: '#ff00ff',
            bgGlowIntensity: 15,
            disableHighlight: false,
            wordEffect: 'wave',
            popEffect: false,
            popScale: 1.1,
            popDuration: 0.2,
            waveEffect: true,
            waveIntensity: 5,
            waveSpeed: 0.7,
            fontFamily: 'Verdana, Geneva, Tahoma, sans-serif',
            fontWeight: 800,
            letterSpacing: 0.04,
            lineHeight: 1.58,
        }
    },
    {
        name: 'Raw Performance',
        description: 'Zero expensive CSS effects. Maximum FPS for low-end devices.',
        config: {
            ...DEFAULT_THEME,
            glowEnabled: false,
            gradientEnabled: false,
            blurUnsung: false,
            popEffect: false,
            bgGlowEnabled: false,
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
