import { themeState } from './state';
import { injectThemeStyles, removeThemeStyles, startLineTagLoop, stopLineTagLoop, stopSungWordTagger } from './themeEngine';
import { Icons } from './icons';
import { openSettingsModal } from './settings';

import { setViewingLyrics } from './connectivity';
import { themeMode, nextThemeMode, cycleThemeMode, onThemeModeChange, ThemeMode } from './videoMode';
import { currentVideoVariants, chooseVideoVariant, onVideoVariantsChange, onVideoCreditChange, videoShowing, currentVideoHeldBack, VideoVariantInfo } from './musicVideo';
import { openMenu, paintTone, MenuItem } from './surface';
import { startFullscreenTools, stopFullscreenTools } from './fullscreenTools';
import {
    videoListMode,
    videoBlocked,
    videoAllowed,
    blockVideo,
    unblockVideo,
    allowVideo,
    disallowVideo,
    currentTrackEntry,
    onVideoListChange,
} from './videoList';

const VARIANT_BUTTON_ID = 'STVideoVariants';
let variantMenuHost: HTMLElement | null = null;

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

function variantTooltip(variants: VideoVariantInfo[]): string {
    const playing = variants.find(v => v.current);
    return playing ? `Video: ${playing.label}` : 'Video options';
}

function videoListItems(): MenuItem[] {
    const track = currentTrackEntry();
    if (!track) return [];
    const allowOnly = videoListMode() === 'allow';
    if (videoBlocked(track.id)) {
        return [{
            label: 'Allow this song’s video',
            hint: 'Takes it off your blocked list',
            onClick: () => (allowOnly ? allowVideo(track) : unblockVideo(track.id)),
        }];
    }
    if (allowOnly && !videoAllowed(track.id)) {
        return [{ label: 'Play this song’s video', hint: 'Adds it to your allowed list', onClick: () => allowVideo(track) }];
    }
    const items: MenuItem[] = [];
    if (allowOnly) {
        items.push({ label: 'Remove from allowed songs', hint: 'Its video stops playing', onClick: () => disallowVideo(track.id) });
    }
    items.push({ label: 'Never play this song’s video', hint: 'Adds it to your blocked list', onClick: () => blockVideo(track) });
    return items;
}

function openVariantMenu(button: HTMLElement): void {
    const variants = videoShowing() ? currentVideoVariants() : [];
    if (!variantMenuHost || !variantMenuHost.isConnected) {
        variantMenuHost = document.createElement('div');
        variantMenuHost.className = 'st-ui-menu-host';
        paintTone(variantMenuHost, 'accent');
        document.body.append(variantMenuHost);
    }
    const items: MenuItem[] = variants.map(v => ({
        label: v.current ? `${v.label} ✓` : v.label,
        hint: [v.current ? 'Playing now' : '', v.preferred ? 'Uploader’s pick' : ''].filter(Boolean).join(' · ') || undefined,
        onClick: () => {
            if (!v.current) chooseVideoVariant(v.id);
        },
    }));
    items.push(...videoListItems());
    items.push({
        label: 'Manage blocked and allowed songs',
        onClick: () => openSettingsModal({ tab: 'customize', category: 'cz-background' }),
    });
    openMenu(button, items, variantMenuHost);
}

const VIEW_CONTROLS = '#SpicyLyricsPage:not(.CardMode) .ViewControls';
const PLACE_AFTER = ['#LearningToggle', '#TranslateToggle'];
const PLACE_BEFORE = ['#SettingsToggle', '#Close'];

let variantButton: HTMLElement | null = null;
let pipWatched: Document | null = null;

function retireButton(button: HTMLElement): void {
    try {
        (button as any)._tippy?.destroy();
    } catch (e) {}
    button.remove();
}

function directChild(parent: Element, node: Element | null): Element | null {
    let current = node;
    while (current && current.parentElement !== parent) current = current.parentElement;
    return current;
}

function placeInViewControls(controls: Element, button: HTMLElement): void {
    for (const selector of PLACE_AFTER) {
        const anchor = directChild(controls, controls.querySelector(selector));
        if (anchor) {
            anchor.after(button);
            return;
        }
    }
    for (const selector of PLACE_BEFORE) {
        const anchor = directChild(controls, controls.querySelector(selector));
        if (anchor) {
            anchor.before(button);
            return;
        }
    }
    controls.append(button);
}

function buildThemeButton(doc: Document): HTMLElement {
    const button = doc.createElement('button');
    button.id = 'ThemeToggle';
    button.className = 'ViewControl';
    if (doc === document && typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
        Spicetify.Tippy(button, { ...Spicetify.TippyProps, content: modeTooltip() });
    }
    paintModeButton(button);
    button.addEventListener('click', applyModeClick);
    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsModal();
        return false;
    });
    return button;
}

function ensureThemeButton(doc: Document): HTMLElement | null {
    const controls = doc.querySelector(VIEW_CONTROLS);
    const all = Array.from(doc.querySelectorAll<HTMLElement>('#ThemeToggle'));
    const keep = controls ? all.find(button => controls.contains(button)) || null : null;
    all.filter(button => button !== keep).forEach(retireButton);
    if (!controls) return null;
    if (keep) {
        if (doc !== document && (keep as any)._tippy) (keep as any)._tippy.destroy();
        return keep;
    }
    const button = buildThemeButton(doc);
    placeInViewControls(controls, button);
    return button;
}

export function syncVariantButton(): void {
    if (variantButton && !variantButton.isConnected) {
        retireButton(variantButton);
        variantButton = null;
    }
    const existing = document.getElementById(VARIANT_BUTTON_ID);
    const showing = themeState.isEnabled && videoShowing();
    const wanted = showing || (themeState.isEnabled && currentVideoHeldBack());
    if (!wanted) {
        if (existing) retireButton(existing);
        variantButton = null;
        return;
    }
    const tip = variantTooltip(showing ? currentVideoVariants() : []);
    const toggle = document.querySelector(`${VIEW_CONTROLS} #ThemeToggle`);
    if (existing) {
        if (existing.getAttribute('aria-label') !== tip) {
            existing.setAttribute('aria-label', tip);
            (existing as any)._tippy?.setContent(tip);
        }
        if (toggle && existing.previousElementSibling !== toggle) toggle.after(existing);
        return;
    }
    if (!toggle) return;
    const button = document.createElement('button');
    button.id = VARIANT_BUTTON_ID;
    button.className = 'ViewControl';
    button.innerHTML = Icons.Videos;
    button.setAttribute('aria-label', tip);
    button.setAttribute('aria-haspopup', 'menu');
    if (typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
        Spicetify.Tippy(button, { ...Spicetify.TippyProps, content: tip });
    }
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        openVariantMenu(button);
    });
    toggle.after(button);
    variantButton = button;
}

onVideoVariantsChange(syncVariantButton);
onVideoCreditChange(syncVariantButton);
onVideoListChange(syncVariantButton);

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
    if (themeButton && !themeButton.isConnected) retireButton(themeButton);
    const button = ensureThemeButton(document);
    const created = button !== themeButton;
    themeButton = button;
    if (created || !document.getElementById(VARIANT_BUTTON_ID) || (variantButton && !variantButton.isConnected)) {
        syncVariantButton();
    }
}

export function removeThemeButton(): void {
    if (themeButton) retireButton(themeButton);
    themeButton = null;
    document.querySelectorAll<HTMLElement>(`#ThemeToggle, #${VARIANT_BUTTON_ID}`).forEach(retireButton);
    variantButton = null;
}

export function onSpicyLyricsOpen(): void {
    createThemeButton();
    setViewingLyrics(true);
    if (themeState.isEnabled) {
        injectThemeStyles();
    }
    startLineTagLoop();
    startFullscreenTools();
}

export function onSpicyLyricsClose(): void {
    setViewingLyrics(false);
    stopFullscreenTools();
    removeThemeButton();
    stopLineTagLoop();
    stopSungWordTagger();
}

export function injectIntoPiP(): void {
    let pipWindow: Window | null = null;
    try {
        pipWindow = (window as any).documentPictureInPicture?.window || null;
    } catch (e) {}
    if (!pipWindow) return;

    const pipDoc = pipWindow.document;
    const sync = () => {
        try {
            const button = ensureThemeButton(pipDoc);
            if (button) paintModeButton(button);
        } catch (e) {}
    };
    sync();
    if (themeState.isEnabled) injectThemeStyles();
    if (pipWatched === pipDoc) return;

    pipWatched = pipDoc;
    let queued: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = setTimeout(() => {
            queued = null;
            sync();
        }, 50);
    });
    observer.observe(pipDoc.documentElement, { childList: true, subtree: true });
    pipWindow.addEventListener('pagehide', () => {
        observer.disconnect();
        if (queued) clearTimeout(queued);
        if (pipWatched === pipDoc) pipWatched = null;
    }, { once: true });
}
