import { themeState, saveThemeState } from './state';
import { injectThemeStyles, removeThemeStyles } from './themeEngine';
import { Icons } from './icons';
import { openSettingsModal } from './settings';

import { setViewingLyrics } from './connectivity';

let themeButton: HTMLElement | null = null;

export function isSpicyLyricsOpen(): boolean {
    if (document.querySelector('#SpicyLyricsPage')) return true;
    if (document.querySelector('.spicy-pip-wrapper #SpicyLyricsPage')) return true;
    if (document.querySelector('.Cinema--Container')) return true;
    if (document.body.classList.contains('SpicySidebarLyrics__Active')) return true;

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

    const viewControls = document.querySelector('#SpicyLyricsPage .ViewControls');
    if (!viewControls) {
        return;
    }

    const button = document.createElement('button');
    button.id = 'ThemeToggle';
    button.className = 'ViewControl';
    button.innerHTML = themeState.isEnabled ? Icons.Palette : Icons.PaletteOff;

    if (themeState.isEnabled) {
        button.classList.add('active');
    }

    if (typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
        Spicetify.Tippy(button, {
            ...Spicetify.TippyProps,
            content: themeState.isEnabled ? 'Disable Theme' : 'Enable Theme'
        });
    }

    button.addEventListener('click', () => {
        themeState.isEnabled = !themeState.isEnabled;
        saveThemeState();

        if (themeState.isEnabled) {
            button.classList.add('active');
            button.innerHTML = Icons.Palette;
            injectThemeStyles();
        } else {
            button.classList.remove('active');
            button.innerHTML = Icons.PaletteOff;
            removeThemeStyles();
        }

        if ((button as any)._tippy) {
            (button as any)._tippy.setContent(themeState.isEnabled ? 'Disable Theme' : 'Enable Theme');
        }
    });

    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsModal();
        return false;
    });

    const translateToggle = viewControls.querySelector('#TranslateToggle');
    const romanizationToggle = viewControls.querySelector('#RomanizationToggle');
    if (translateToggle) {
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
}

export function onSpicyLyricsClose(): void {
    setViewingLyrics(false);
    removeThemeButton();
}

export function injectIntoPiP(): void {
    try {
        const pipWindow = (window as any).documentPictureInPicture?.window;
        if (!pipWindow) return;

        const pipDoc = pipWindow.document;
        const pipViewControls = pipDoc.querySelector('#SpicyLyricsPage .ViewControls');
        if (!pipViewControls || pipDoc.getElementById('ThemeToggle')) return;

        const button = document.createElement('button');
        button.id = 'ThemeToggle';
        button.className = 'ViewControl';
        button.innerHTML = themeState.isEnabled ? Icons.Palette : Icons.PaletteOff;
        if (themeState.isEnabled) button.classList.add('active');

        button.addEventListener('click', () => {
            themeState.isEnabled = !themeState.isEnabled;
            saveThemeState();
            button.classList.toggle('active', themeState.isEnabled);
            button.innerHTML = themeState.isEnabled ? Icons.Palette : Icons.PaletteOff;
            if (themeState.isEnabled) {
                injectThemeStyles();
            } else {
                removeThemeStyles();
            }
        });

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
