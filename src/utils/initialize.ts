import { themeState, saveThemeState, getAllPresets, applyPreset as applyPresetFn } from './state';
import { injectThemeStyles, injectBaseStyles, removeThemeStyles } from './themeEngine';
import { registerSettings } from './settings';
import { isSpicyLyricsOpen, onSpicyLyricsOpen, onSpicyLyricsClose, createThemeButton, injectIntoPiP } from './core';
import { startUpdateChecker, checkForUpdates, getUpdateInfo, VERSION, showPostUpdateChangelog } from './updater';
import { initConnectivity, getConnectivityState } from './connectivity';
import { info, debug } from './debug';

const INIT_STATE_KEY = '__spicyThemesInitState';

type InitState = {
    initializing: boolean;
    initialized: boolean;
};

function getInitState(): InitState {
    const globalWindow = window as typeof window & { [INIT_STATE_KEY]?: InitState };
    if (!globalWindow[INIT_STATE_KEY]) {
        globalWindow[INIT_STATE_KEY] = {
            initializing: false,
            initialized: false,
        };
    }
    return globalWindow[INIT_STATE_KEY] as InitState;
}

export async function initialize(): Promise<void> {
    const initState = getInitState();
    if (initState.initialized) {
        debug('Initialization skipped: already initialized');
        return;
    }
    if (initState.initializing) {
        debug('Initialization skipped: initialization already in progress');
        return;
    }

    initState.initializing = true;

    try {
    while (
        typeof Spicetify === 'undefined' ||
        !Spicetify.Platform ||
        !Spicetify.Player
    ) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    info('Initializing...');

    injectBaseStyles();

    if (themeState.isEnabled) {
        injectThemeStyles();
    }

    await registerSettings();

    startUpdateChecker(30 * 60 * 1000);

    initConnectivity().catch(e => debug('Connectivity init error:', e));

    showPostUpdateChangelog().catch(e => debug('Changelog display error:', e));

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
        checkForUpdates: () => checkForUpdates(true),
        getUpdateInfo,
        getConnectivityState,
        version: VERSION,
    };

    initState.initialized = true;
    info('Initialized successfully!');
    } finally {
        initState.initializing = false;
    }
}
