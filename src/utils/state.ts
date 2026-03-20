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

    blurUnsung: boolean;
    blurAmount: number;
    scaleActive: number;
    animationSpeed: number;

    pageBgOverlay: boolean;
    pageBgColor: string;
    pageBgOpacity: number;

    sltStylingEnabled: boolean;
    sltTranslationOpacity: number;
    sltTranslationFontSize: number;

    bgGlowEnabled: boolean;
    bgGlowColor: string;
    bgGlowIntensity: number;

    disableHighlight: boolean;
    highlightColor: string;
    popEffect: boolean;
    popScale: number;
    popDuration: number;

    waveEffect: boolean;
    waveIntensity: number;
    waveSpeed: number;
}

export const DEFAULT_THEME: ThemeConfig = {
    activeLineColor: '#ffffff',
    sungLineColor: '#ffffff',
    notSungLineColor: '#ffffff',

    activeLineOpacity: 1.0,
    sungLineOpacity: 0.25,
    notSungLineOpacity: 0.6,

    glowEnabled: false,
    glowColor: '#ffffff',
    glowIntensity: 4,
    activeGlowColor: '#ffffff',
    activeGlowIntensity: 12,

    gradientEnabled: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#b3b3b3',
    gradientAngle: 180,

    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 800,
    letterSpacing: 0,
    lineHeight: 1.4,

    blurUnsung: true,
    blurAmount: 2.0,
    scaleActive: 1.05,
    animationSpeed: 1.0,

    pageBgOverlay: true,
    pageBgColor: '#000000',
    pageBgOpacity: 0.5,

    sltStylingEnabled: true,
    sltTranslationOpacity: 0.8,
    sltTranslationFontSize: 0.75,

    bgGlowEnabled: false,
    bgGlowColor: '#ffffff',
    bgGlowIntensity: 12,

    disableHighlight: true,
    highlightColor: 'rgba(255, 255, 255, 0.2)',
    popEffect: true,
    popScale: 1.05,
    popDuration: 0.3,

    waveEffect: false,
    waveIntensity: 4,
    waveSpeed: 0.8,
};

export interface ThemePreset {
    name: string;
    description: string;
    config: ThemeConfig;
}

export const BUILTIN_PRESETS: ThemePreset[] = [
    {
        name: 'Neon Green',
        description: 'High-energy, gamified feel with sharp active states',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#1db954',
            sungLineColor: '#1db954',
            notSungLineColor: '#ffffff',
            glowEnabled: true,
            activeGlowColor: '#1db954',
            activeGlowIntensity: 15,
            glowColor: '#1db954',
            glowIntensity: 4,
            gradientEnabled: true,
            gradientStartColor: '#1db954',
            gradientEndColor: '#00ff88',
            gradientAngle: 135,
            bgGlowEnabled: true,
            bgGlowColor: '#1db954',
            bgGlowIntensity: 15,
            disableHighlight: false,
            popEffect: true,
            popScale: 1.12,
            popDuration: 0.15,
            scaleActive: 1.08,
        }
    },
    {
        name: 'Sunset',
        description: 'Warm, smooth gradients with relaxed transitions',
        config: {
            ...DEFAULT_THEME,
            gradientEnabled: true,
            gradientStartColor: '#ff6b35',
            gradientEndColor: '#f7c948',
            gradientAngle: 135,
            activeLineColor: '#ff6b35',
            sungLineColor: '#f7c948',
            notSungLineColor: '#ffffff',
            glowEnabled: true,
            activeGlowColor: '#ff6b35',
            activeGlowIntensity: 12,
            glowColor: '#f7c948',
            glowIntensity: 6,
            bgGlowEnabled: true,
            bgGlowColor: '#ff6b35',
            bgGlowIntensity: 12,
            disableHighlight: false,
            popEffect: true,
            popScale: 1.05,
            popDuration: 0.4,
            animationSpeed: 0.8,
        }
    },
    {
        name: 'Deep Ocean',
        description: 'Ambient, calm depth-of-field effect',
        config: {
            ...DEFAULT_THEME,
            activeLineColor: '#00d4ff',
            sungLineColor: '#004466',
            notSungLineColor: '#ffffff',
            glowEnabled: true,
            activeGlowColor: '#00d4ff',
            activeGlowIntensity: 14,
            glowColor: '#0088cc',
            glowIntensity: 6,
            gradientEnabled: true,
            gradientStartColor: '#00d4ff',
            gradientEndColor: '#0066aa',
            gradientAngle: 180,
            bgGlowEnabled: true,
            bgGlowColor: '#00d4ff',
            bgGlowIntensity: 14,
            disableHighlight: false,
            blurUnsung: true,
            blurAmount: 3.5,
            popEffect: false,
            scaleActive: 1.05,
        }
    },
    {
        name: 'Synthwave',
        description: 'Retro high-contrast vibes',
        config: {
            ...DEFAULT_THEME,
            gradientEnabled: true,
            gradientStartColor: '#ff00ff',
            gradientEndColor: '#00ffff',
            gradientAngle: 90,
            activeLineColor: '#ff00ff',
            sungLineColor: '#8e44ad',
            notSungLineColor: '#ffffff',
            glowEnabled: true,
            activeGlowColor: '#ff00ff',
            activeGlowIntensity: 15,
            glowColor: '#00ffff',
            glowIntensity: 6,
            bgGlowEnabled: true,
            bgGlowColor: '#ff00ff',
            bgGlowIntensity: 15,
            disableHighlight: false,
            popEffect: true,
            popScale: 1.1,
            popDuration: 0.2,
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
            sungLineOpacity: 0.2,
            notSungLineOpacity: 0.5,
            activeLineOpacity: 1.0,
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
            glowIntensity: [0, 15],
            activeGlowIntensity: [0, 15],
            bgGlowIntensity: [0, 30],
            sltTranslationFontSize: [0.5, 2.0],
            scaleActive: [0.8, 1.5],
            animationSpeed: [0.3, 3.0],
            gradientAngle: [0, 360],
            popScale: [1.0, 1.3],
            popDuration: [0.1, 0.6],
            waveIntensity: [1, 10],
            waveSpeed: [0.3, 2.0],
            lineHeight: [1.0, 2.5],
            letterSpacing: [-0.1, 0.3],
            fontWeight: [100, 900],
        };
        const range = clamps[key];
        if (range) {
            value = Math.min(Math.max(value as number, range[0]), range[1]) as ThemeConfig[K];
        }
        if (key === 'lineHeight') {
            value = Math.round((value as number) * 100) / 100 as ThemeConfig[K];
        }
    }
    themeState.activeTheme[key] = value;
    themeState.activePresetName = 'Custom';
    saveThemeState();
}
