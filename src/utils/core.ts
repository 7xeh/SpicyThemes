import { themeState } from './state';
import { injectThemeStyles, removeThemeStyles, startBlurPreviewObserver, stopBlurPreviewObserver, stopSungWordTagger } from './themeEngine';
import { Icons } from './icons';
import { openSettingsModal } from './settings';

import { setViewingLyrics } from './connectivity';
import { themeMode, nextThemeMode, cycleThemeMode, onThemeModeChange, ThemeMode } from './videoMode';

let themeButton: HTMLElement | null = null;

const MODE_ICONS: Record<ThemeMode, string> = {
    off: Icons.PaletteOff,
    theme: Icons.Palette,
    video: Icons.Video,
};

const NEXT_LABELS: Record<ThemeMode, string> = {
    off: 'Disable Theme',
    theme: 'Switch to Theme',
    video: 'Switch to Video Background',
};

function modeTooltip(): string {
    if (themeMode() === 'off') return 'Enable Theme';
    return NEXT_LABELS[nextThemeMode()];
}

function paintModeButton(button: HTMLElement): void {
    const mode = themeMode();
    if (button.dataset.stMode !== mode) {
        button.dataset.stMode = mode;
        button.innerHTML = MODE_ICONS[mode];
    }
    button.classList.toggle('active', mode !== 'off');
    const tip = modeTooltip();
    button.setAttribute('aria-label', tip);
    const tippy = (button as any)._tippy;
    if (tippy) tippy.setContent(tip);
}

function applyModeClick(): void {
    cycleThemeMode();
    if (themeState.isEnabled) {
        injectThemeStyles();
    } else {
        removeThemeStyles();
    }
}

function modeButtons(): HTMLElement[] {
    const buttons: HTMLElement[] = [];
    const main = document.getElementById('ThemeToggle');
    if (main) buttons.push(main);
    try {
        const pip = (window as any).documentPictureInPicture?.window?.document.getElementById('ThemeToggle');
        if (pip) buttons.push(pip);
    } catch (e) {}
    return buttons;
}

export function refreshThemeButton(): void {
    modeButtons().forEach(paintModeButton);
}

onThemeModeChange((reinject) => {
    if (reinject && themeState.isEnabled) {
        injectThemeStyles();
        return;
    }
    refreshThemeButton();
});

export function isSpicyLyricsOpen(): boolean {
    if (document.querySelector('#SpicyLyricsPage')) return true;
    if (document.querySelector('.spicy-pip-wrapper #SpicyLyricsPage')) return true;
    if (document.querySelector('#SpicyLyricsNPVCard')) return true;

    try {
        const pipWindow = (window as any).documentPictureInPicture?.window;
        if (pipWindow?.document.querySelector('#SpicyLyricsPage')) return true;
    } catch (e) {}

    return false;
}

export function createThemeButton(): void {
    if (themeButton && !document.body.contains(themeButton)) {
        themeButton = null;
    }
    if (themeButton) return;

    if (document.getElementById('ThemeToggle')) return;

    const viewControls = document.querySelector('#SpicyLyricsPage:not(.CardMode) .ViewControls');
    if (!viewControls) {
        return;
    }

    const button = document.createElement('button');
    button.id = 'ThemeToggle';
    button.className = 'ViewControl';

    if (typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
        Spicetify.Tippy(button, {
            ...Spicetify.TippyProps,
            content: modeTooltip()
        });
    }

    paintModeButton(button);

    button.addEventListener('click', applyModeClick);

    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsModal();
        return false;
    });

    const learningToggle = viewControls.querySelector('#LearningToggle');
    const translateToggle = viewControls.querySelector('#TranslateToggle');
    const romanizationToggle = viewControls.querySelector('#RomanizationToggle');
    if (learningToggle) {
        learningToggle.after(button);
    } else if (translateToggle) {
        translateToggle.after(button);
    } else if (romanizationToggle) {
        romanizationToggle.after(button);
    } else {
        viewControls.appendChild(button);
    }

    themeButton = button;
}

export function removeThemeButton(): void {
    if (themeButton) {
        themeButton.remove();
        themeButton = null;
    }
    document.getElementById('ThemeToggle')?.remove();
}

export function onSpicyLyricsOpen(): void {
    createThemeButton();
    setViewingLyrics(true);
    if (themeState.isEnabled) {
        injectThemeStyles();
    }
    startBlurPreviewObserver();
}

export function onSpicyLyricsClose(): void {
    setViewingLyrics(false);
    removeThemeButton();
    stopBlurPreviewObserver();
    stopSungWordTagger();
}

export function injectIntoPiP(): void {
    try {
        const pipWindow = (window as any).documentPictureInPicture?.window;
        if (!pipWindow) return;

        const pipDoc = pipWindow.document;
        const pipViewControls = pipDoc.querySelector('#SpicyLyricsPage .ViewControls');
        if (!pipViewControls || pipDoc.getElementById('ThemeToggle')) return;

        const button = pipDoc.createElement('button') as HTMLElement;
        button.id = 'ThemeToggle';
        button.className = 'ViewControl';
        paintModeButton(button);

        button.addEventListener('click', applyModeClick);

        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSettingsModal();
            return false;
        });

        pipViewControls.appendChild(button);
        if (themeState.isEnabled) {
            injectThemeStyles();
        }
    } catch (e) {
    }
}
