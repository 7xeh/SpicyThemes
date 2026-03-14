import { storage } from './storage';

export interface ThemeConfig {
    activeLineColor: string;
    sungLineColor: string;
    notSungLineColor: string;

    bgLineColor: string;

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

    blurUnsung: boolean;
    blurAmount: number;
    scaleActive: number;
    animationSpeed: number;

    pageBgOverlay: boolean;
    pageBgColor: string;
    pageBgOpacity: number;

    sltStylingEnabled: boolean;
    sltTranslationColor: string;
    sltTranslationOpacity: number;
    sltTranslationFontSize: number;

    hideScrollbar: boolean;
    disableHighlight: boolean;
    highlightColor: string;
    popEffect: boolean;
    popScale: number;
    popDuration: number;
}

export const DEFAULT_THEME: ThemeConfig = {
    activeLineColor: '#ffffff',
    sungLineColor: '#ffffff',
    notSungLineColor: '#ffffff',
    bgLineColor: 'rgba(255, 255, 255, 0.4)',

    activeLineOpacity: 0.95,
    sungLineOpacity: 0.3,
    notSungLineOpacity: 0.35,

    glowEnabled: false,
    glowColor: '#ffffff',
    glowIntensity: 4,
    activeGlowColor: '#ffffff',
    activeGlowIntensity: 8,

    gradientEnabled: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#aaaaaa',
    gradientAngle: 180,

    fontFamily: '',
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.1818181818,

    blurUnsung: true,
    blurAmount: 1.5,
    scaleActive: 1.0,
    animationSpeed: 1.0,

    pageBgOverlay: false,
    pageBgColor: '#000000',
    pageBgOpacity: 0.3,

    sltStylingEnabled: true,
    sltTranslationColor: '#ffffff',
    sltTranslationOpacity: 0.7,
    sltTranslationFontSize: 1.0,

    hideScrollbar: false,
    disableHighlight: false,
    highlightColor: '#ffffff',
    popEffect: false,
    popScale: 1.08,
    popDuration: 0.25,
};

export interface ThemePreset {
    name: string;
    description: string;
    config: ThemeConfig;
}

export const BUILTIN_PRESETS: ThemePreset[] = [
    {
        name: 'SpotiGlow',
        description: 'Spotify green with vibrant neon glow',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#1db954',
            glowEnabled: true,
            glowColor: '#1db954',
            glowIntensity: 6,
            activeGlowColor: '#00ff88',
            activeGlowIntensity: 16,
            gradientEnabled: true,
            gradientStartColor: '#1db954',
            gradientEndColor: '#00ff88',
            gradientAngle: 180,
            notSungLineOpacity: 0.35,
        }
    },
    {
        name: 'Sunset',
        description: 'Warm sunset gradient tones',
        config: {
            ...DEFAULT_THEME,
            gradientEnabled: true,
            gradientStartColor: '#ff6b35',
            gradientEndColor: '#f7c948',
            gradientAngle: 135,
            activeLineColor: '#ff6b35',
            sungLineColor: '#f7c948',
            glowEnabled: true,
            glowColor: '#ff6b35',
            glowIntensity: 4,
            activeGlowColor: '#ff6b35',
            activeGlowIntensity: 10,
        }
    },
    {
        name: 'Ocean',
        description: 'Cool blue tones with a calm feel',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#00d4ff',
            sungLineColor: '#0099cc',
            notSungLineColor: '#66ccff',
            glowEnabled: true,
            glowColor: '#00d4ff',
            glowIntensity: 5,
            activeGlowColor: '#00d4ff',
            activeGlowIntensity: 12,
            gradientEnabled: true,
            gradientStartColor: '#00d4ff',
            gradientEndColor: '#004466',
            gradientAngle: 180,
            notSungLineOpacity: 0.4,
        }
    },
    {
        name: 'Minimal',
        description: 'Clean, subtle, and easy on the eyes',
        config: { ...DEFAULT_THEME }
    },
    {
        name: 'Purple Haze',
        description: 'Deep purple vibes',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#bf5fff',
            sungLineColor: '#9b59b6',
            notSungLineColor: '#8e44ad',
            glowEnabled: true,
            glowColor: '#9b59b6',
            glowIntensity: 5,
            activeGlowColor: '#bf5fff',
            activeGlowIntensity: 14,
            gradientEnabled: true,
            gradientStartColor: '#bf5fff',
            gradientEndColor: '#6c3483',
            gradientAngle: 160,
        }
    },
];

export interface ThemeState {
    activeTheme: ThemeConfig;
    activePresetName: string;
    customPresets: ThemePreset[];
    isEnabled: boolean;
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
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_THEME, ...parsed };
        }
    } catch (e) {}
    return { ...DEFAULT_THEME };
}

export const themeState: ThemeState = {
    activeTheme: loadActiveTheme(),
    activePresetName: storage.get('active-preset') || 'Minimal',
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
    themeState.activeTheme = { ...preset.config };
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
        const clamps: Partial<Record<keyof ThemeConfig, [number, number]>> = {
            activeLineOpacity: [0, 1],
            sungLineOpacity: [0, 1],
            notSungLineOpacity: [0, 1],
            pageBgOpacity: [0, 1],
            sltTranslationOpacity: [0, 1],
            blurAmount: [0, 8],
            glowIntensity: [0, 20],
            activeGlowIntensity: [0, 30],
            sltTranslationFontSize: [0.5, 2.0],
            scaleActive: [0.8, 1.5],
            animationSpeed: [0.3, 3.0],
            gradientAngle: [0, 360],
            popScale: [1.0, 1.3],
            popDuration: [0.1, 0.6],
            lineHeight: [1.0, 2.5],
            letterSpacing: [-0.1, 0.3],
            fontWeight: [100, 900],
        };
        const range = clamps[key];
        if (range) {
            value = Math.min(Math.max(value as number, range[0]), range[1]) as ThemeConfig[K];
        }
        if (key === 'lineHeight') {
            value = Math.round((value as number) * 10) / 10 as ThemeConfig[K];
        }
    }
    themeState.activeTheme[key] = value;
    themeState.activePresetName = 'Custom';
    saveThemeState();
}
