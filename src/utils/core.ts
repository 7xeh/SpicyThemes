import { themeState, saveThemeState } from './state';
import { injectThemeStyles, removeThemeStyles } from './themeEngine';
import { Icons } from './icons';
import { debug } from './debug';

let themeButton: HTMLElement | null = null;

export function isSpicyLyricsOpen(): boolean {
    if (document.querySelector('#SpicyLyricsPage')) return true;
    if (document.querySelector('.spicy-pip-wrapper #SpicyLyricsPage')) return true;
    if (document.querySelector('.Cinema--Container')) return true;
    if (document.body.classList.contains('SpicySidebarLyrics__Active')) return true;

    try {
        const pipWindow = (window as any).documentPictureInPicture?.window;
        if (pipWindow?.document.querySelector('#SpicyLyricsPage')) return true;
    } catch (e) { /* ignore */ }

    return false;
}

export function createThemeButton(): void {
    if (themeButton) return;

    const viewControls = document.querySelector('#SpicyLyricsPage .ViewControls');
    if (!viewControls) {
        debug('ViewControls not found, skipping button creation');
        return;
    }

    // Don't duplicate
    if (document.getElementById('ThemeToggle')) return;

    const button = document.createElement('button');
    button.id = 'ThemeToggle';
    button.className = 'ViewControl';
    button.innerHTML = Icons.Palette;

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
            injectThemeStyles();
        } else {
            button.classList.remove('active');
            removeThemeStyles();
        }

        // Update tooltip
        if ((button as any)._tippy) {
            (button as any)._tippy.setContent(themeState.isEnabled ? 'Disable Theme' : 'Enable Theme');
        }
    });

    // Insert into ViewControls — place after translation toggle or at end
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
    debug('Theme button created');
}

export function removeThemeButton(): void {
    if (themeButton) {
        themeButton.remove();
        themeButton = null;
        debug('Theme button removed');
    }
    // Also remove any orphaned buttons
    document.getElementById('ThemeToggle')?.remove();
}

export function onSpicyLyricsOpen(): void {
    debug('Spicy Lyrics opened');
    createThemeButton();
    if (themeState.isEnabled) {
        injectThemeStyles();
    }
}

export function onSpicyLyricsClose(): void {
    debug('Spicy Lyrics closed');
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
        button.innerHTML = Icons.Palette;
        if (themeState.isEnabled) button.classList.add('active');

        button.addEventListener('click', () => {
            themeState.isEnabled = !themeState.isEnabled;
            saveThemeState();
            button.classList.toggle('active', themeState.isEnabled);
            if (themeState.isEnabled) {
                injectThemeStyles();
            } else {
                removeThemeStyles();
            }
        });

        pipViewControls.appendChild(button);
        debug('Theme button injected into PiP');
    } catch (e) {
        debug('PiP injection failed:', e);
    }
}
