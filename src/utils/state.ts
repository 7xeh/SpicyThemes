import { storage } from './storage';

export interface ThemeConfig {
    // Lyric line colors
    activeLineColor: string;
    sungLineColor: string;
    notSungLineColor: string;

    // Background vocals
    bgLineColor: string;

    // Opacity
    activeLineOpacity: number;
    sungLineOpacity: number;
    notSungLineOpacity: number;

    // Glow / text shadow
    glowEnabled: boolean;
    glowColor: string;
    glowIntensity: number; // 0-20 px blur radius
    activeGlowColor: string;
    activeGlowIntensity: number;

    // Gradient
    gradientEnabled: boolean;
    gradientStartColor: string;
    gradientEndColor: string;
    gradientAngle: number; // degrees

    // Font
    fontFamily: string;
    fontWeight: number; // 100-900
    fontSize: number; // scale factor 0.5-2.0
    letterSpacing: number; // em
    lineHeight: number;

    // Effects
    blurUnsung: boolean;
    blurAmount: number; // px
    scaleActive: number; // scale factor e.g. 1.0 - 1.3
    animationSpeed: number; // multiplier 0.5-2.0

    // Page background
    pageBgOverlay: boolean;
    pageBgColor: string;
    pageBgOpacity: number;

    // SLT compatibility — translation line styling
    sltTranslationColor: string;
    sltTranslationOpacity: number;
    sltTranslationFontSize: number; // scale factor

    // Misc
    hideScrollbar: boolean;
    roundedCorners: boolean;
}

export const DEFAULT_THEME: ThemeConfig = {
    activeLineColor: '#ffffff',
    sungLineColor: '#ffffff',
    notSungLineColor: '#ffffff',
    bgLineColor: 'rgba(255, 255, 255, 0.4)',

    activeLineOpacity: 1.0,
    sungLineOpacity: 0.497,
    notSungLineOpacity: 0.51,

    glowEnabled: false,
    glowColor: '#ffffff',
    glowIntensity: 4,
    activeGlowColor: '#ffffff',
    activeGlowIntensity: 8,

    gradientEnabled: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: 'rgba(255, 255, 255, 0.5)',
    gradientAngle: 180,

    fontFamily: '',
    fontWeight: 900,
    fontSize: 1.0,
    letterSpacing: 0,
    lineHeight: 1.1818181818,

    blurUnsung: false,
    blurAmount: 0,
    scaleActive: 1.0,
    animationSpeed: 1.0,

    pageBgOverlay: false,
    pageBgColor: '#000000',
    pageBgOpacity: 0.3,

    sltTranslationColor: '#ffffff',
    sltTranslationOpacity: 0.7,
    sltTranslationFontSize: 1.0,

    hideScrollbar: false,
    roundedCorners: false,
};

export interface ThemePreset {
    name: string;
    description: string;
    config: ThemeConfig;
}

export const BUILTIN_PRESETS: ThemePreset[] = [
    {
        name: 'Default',
        description: 'The standard Spicy Lyrics look',
        config: { ...DEFAULT_THEME }
    },
    {
        name: 'Neon Glow',
        description: 'Vibrant neon glow on active lyrics',
        config: {
            ...DEFAULT_THEME,
            glowEnabled: true,
            glowColor: '#00ff88',
            glowIntensity: 6,
            activeGlowColor: '#00ff88',
            activeGlowIntensity: 16,
            activeLineColor: '#00ff88',
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
        config: {
            ...DEFAULT_THEME,
            fontWeight: 500,
            activeLineOpacity: 0.95,
            sungLineOpacity: 0.3,
            notSungLineOpacity: 0.35,
            glowEnabled: false,
            gradientEnabled: false,
            blurUnsung: true,
            blurAmount: 1.5,
            scaleActive: 1.0,
        }
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
    {
        name: 'Spotify Green',
        description: 'Spotify-branded green accent',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#1db954',
            glowEnabled: true,
            glowColor: '#1db954',
            glowIntensity: 4,
            activeGlowColor: '#1db954',
            activeGlowIntensity: 12,
            gradientEnabled: true,
            gradientStartColor: '#1db954',
            gradientEndColor: 'rgba(29, 185, 84, 0.4)',
            gradientAngle: 180,
        }
    },
    {
        name: 'High Contrast',
        description: 'Maximum readability with sharp contrast',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#ffffff',
            sungLineColor: '#aaaaaa',
            notSungLineColor: '#666666',
            activeLineOpacity: 1.0,
            sungLineOpacity: 0.6,
            notSungLineOpacity: 0.25,
            glowEnabled: true,
            glowColor: '#ffffff',
            glowIntensity: 3,
            activeGlowColor: '#ffffff',
            activeGlowIntensity: 8,
            fontWeight: 900,
            blurUnsung: true,
            blurAmount: 2,
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
    } catch (e) { /* ignore */ }
    return [];
}

function loadActiveTheme(): ThemeConfig {
    try {
        const raw = storage.get('active-theme');
        if (raw) {
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_THEME, ...parsed };
        }
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_THEME };
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
    themeState.activeTheme[key] = value;
    themeState.activePresetName = 'Custom';
    saveThemeState();
}
