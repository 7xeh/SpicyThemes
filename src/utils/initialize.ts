import { themeState, saveThemeState, getAllPresets, applyPreset as applyPresetFn } from './state';
import { injectThemeStyles, injectBaseStyles, removeThemeStyles } from './themeEngine';
import { registerSettings } from './settings';
import { isSpicyLyricsOpen, onSpicyLyricsOpen, onSpicyLyricsClose, createThemeButton, injectIntoPiP } from './core';
import { info, debug } from './debug';

export async function initialize(): Promise<void> {
    while (typeof Spicetify === 'undefined' || !Spicetify.Platform) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    info('Initializing...');

    injectBaseStyles();

    if (themeState.isEnabled) {
        injectThemeStyles();
    }

    await registerSettings();

    let wasSpicyLyricsOpen = false;
    let observerDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
        if (observerDebounceTimer) return;
        observerDebounceTimer = setTimeout(() => {
            observerDebounceTimer = null;
            const isOpen = isSpicyLyricsOpen();
            if (isOpen && !wasSpicyLyricsOpen) {
                wasSpicyLyricsOpen = true;
                onSpicyLyricsOpen();
            } else if (!isOpen && wasSpicyLyricsOpen) {
                wasSpicyLyricsOpen = false;
                onSpicyLyricsClose();
            }

            if (isOpen && !document.getElementById('ThemeToggle')) {
                createThemeButton();
            }
        }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (isSpicyLyricsOpen()) {
        wasSpicyLyricsOpen = true;
        onSpicyLyricsOpen();
    }

    try {
        if ((window as any).documentPictureInPicture) {
            (window as any).documentPictureInPicture.addEventListener('enter', () => {
                setTimeout(injectIntoPiP, 500);
            });
        }
    } catch (e) {
        debug('PiP listener registration failed:', e);
    }

    (window as any).SpicyThemes = {
        enable: () => {
            themeState.isEnabled = true;
            saveThemeState();
            injectThemeStyles();
        },
        disable: () => {
            themeState.isEnabled = false;
            saveThemeState();
            removeThemeStyles();
        },
        getState: () => ({ ...themeState }),
        applyPreset: (name: string) => {
            const preset = getAllPresets().find(p => p.name === name);
            if (preset) {
                applyPresetFn(preset);
                injectThemeStyles();
            }
        },
        version: '1.0.0',
    };

    info('Initialized successfully!');
}
