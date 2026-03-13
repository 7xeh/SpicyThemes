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

    // Inject base UI styles (settings components, button states)
    injectBaseStyles();

    // Inject theme styles if enabled
    if (themeState.isEnabled) {
        injectThemeStyles();
    }

    // Register settings page
    registerSettings();

    // Watch for Spicy Lyrics page opening/closing
    let wasSpicyLyricsOpen = false;
    const observer = new MutationObserver(() => {
        const isOpen = isSpicyLyricsOpen();
        if (isOpen && !wasSpicyLyricsOpen) {
            wasSpicyLyricsOpen = true;
            onSpicyLyricsOpen();
        } else if (!isOpen && wasSpicyLyricsOpen) {
            wasSpicyLyricsOpen = false;
            onSpicyLyricsClose();
        }

        // Ensure button is always present when lyrics page is open
        if (isOpen && !document.getElementById('ThemeToggle')) {
            createThemeButton();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Check if already open
    if (isSpicyLyricsOpen()) {
        wasSpicyLyricsOpen = true;
        onSpicyLyricsOpen();
    }

    // PiP support
    try {
        if ((window as any).documentPictureInPicture) {
            (window as any).documentPictureInPicture.addEventListener('enter', () => {
                setTimeout(injectIntoPiP, 500);
            });
        }
    } catch (e) {
        debug('PiP listener registration failed:', e);
    }

    // Expose global API
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
