import { storage } from './storage';
import { themeState } from './state';

const CURSOR_KEY = 'fs-hide-cursor';
const NOWBAR_KEY = 'fs-hide-nowbar';
const CHECK_MS = 300;
const IDLE_MS = 2500;
const TOGGLE_ID = 'STNowBarToggle';
const IDLE_CLASS = 'st-fs-idle';
const CURSOR_CLASS = 'st-fs-cursor-hidden';
const BUSY_SELECTOR = '.ViewControls, .PlaybackControls, .Timeline, .VolumeControl, .Heart, .st-modal-root, .st-ui-menu, button, a, input, select';

export const FS_NOBAR_CLASS = 'st-fs-nobar';

const ICON_OPEN = '<svg class="NoFill" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><rect x="6" y="9.5" width="5" height="5" rx="1.25"></rect><path d="M14 10h4M14 14h2.5"></path></svg>';
const ICON_HIDDEN = '<svg class="NoFill" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M7.5 9h9M7.5 12h9M7.5 15h5.5"></path></svg>';

let hideCursor = storage.get(CURSOR_KEY) !== 'false';
let hideNowBar = storage.get(NOWBAR_KEY) === 'true';

let checkTimer: ReturnType<typeof setInterval> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let watchedPage: HTMLElement | null = null;
let idle = false;
let lastX = -1;
let lastY = -1;

const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach(fn => {
        try {
            fn();
        } catch (e) {}
    });
}

export function onFullscreenPrefsChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function fullscreenHideCursor(): boolean {
    return hideCursor;
}

export function fullscreenHideNowBar(): boolean {
    return hideNowBar;
}

export function setFullscreenHideCursor(value: boolean): void {
    hideCursor = !!value;
    storage.set(CURSOR_KEY, String(hideCursor));
    check();
    emit();
}

export function setFullscreenHideNowBar(value: boolean): void {
    hideNowBar = !!value;
    storage.set(NOWBAR_KEY, String(hideNowBar));
    wake();
    check();
    emit();
}

function fullscreenPage(): HTMLElement | null {
    const page = document.querySelector<HTMLElement>('#SpicyLyricsPage.Fullscreen:not(.CardMode)');
    return page && !page.closest('.spicy-pip-wrapper') ? page : null;
}

function nowBarHideable(page: HTMLElement): boolean {
    if (page.matches('.CompactMode, .ForcedCompactMode')) return false;
    return !page.querySelector('.ContentBox.LyricsHidden');
}

function applyClasses(page: HTMLElement): void {
    page.classList.toggle(FS_NOBAR_CLASS, hideNowBar && nowBarHideable(page));
    page.classList.toggle(IDLE_CLASS, idle);
    page.classList.toggle(CURSOR_CLASS, idle && hideCursor);
}

function pointerBusy(): boolean {
    const hovered = document.querySelectorAll(':hover');
    const deepest = hovered[hovered.length - 1];
    return !!deepest && !!deepest.closest(BUSY_SELECTOR);
}

function armIdle(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        idleTimer = null;
        if (!watchedPage) return;
        if (pointerBusy()) {
            armIdle();
            return;
        }
        idle = true;
        applyClasses(watchedPage);
    }, IDLE_MS);
}

function wake(): void {
    if (!watchedPage) return;
    if (idle) {
        idle = false;
        applyClasses(watchedPage);
    }
    armIdle();
}

function onPointer(e: Event): void {
    if (e.type === 'mousemove') {
        const m = e as MouseEvent;
        if (m.screenX === lastX && m.screenY === lastY) return;
        lastX = m.screenX;
        lastY = m.screenY;
    }
    wake();
}

function attach(page: HTMLElement): void {
    watchedPage = page;
    idle = false;
    document.addEventListener('mousemove', onPointer, { capture: true, passive: true });
    document.addEventListener('mousedown', onPointer, { capture: true, passive: true });
    document.addEventListener('wheel', onPointer, { capture: true, passive: true });
    armIdle();
}

function release(): void {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    document.removeEventListener('mousemove', onPointer, true);
    document.removeEventListener('mousedown', onPointer, true);
    document.removeEventListener('wheel', onPointer, true);
    watchedPage?.classList.remove(FS_NOBAR_CLASS, IDLE_CLASS, CURSOR_CLASS);
    watchedPage = null;
    idle = false;
}

function toggleLabel(): string {
    return hideNowBar ? 'Show Now Playing bar' : 'Hide Now Playing bar';
}

function paintToggle(button: HTMLElement, page: HTMLElement): void {
    const state = hideNowBar ? 'hidden' : 'open';
    if (button.dataset.stState !== state) {
        button.dataset.stState = state;
        button.innerHTML = hideNowBar ? ICON_HIDDEN : ICON_OPEN;
        const label = toggleLabel();
        button.setAttribute('aria-label', label);
        (button as any)._tippy?.setContent(label);
    }
    const display = nowBarHideable(page) ? '' : 'none';
    if (button.style.display !== display) {
        button.style.display = display;
        (button as any)._tippy?.hide();
    }
}

function syncToggle(page: HTMLElement): void {
    const controls = page.querySelector<HTMLElement>('.ViewControls');
    let button = document.getElementById(TOGGLE_ID);
    if (!controls) {
        button?.remove();
        return;
    }
    if (!button) {
        button = document.createElement('button');
        button.id = TOGGLE_ID;
        button.className = 'ViewControl';
        if (typeof Spicetify !== 'undefined' && Spicetify.Tippy) {
            Spicetify.Tippy(button, { ...Spicetify.TippyProps, content: toggleLabel() });
        }
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            (e.currentTarget as any)?._tippy?.hide();
            setFullscreenHideNowBar(!hideNowBar);
        });
    }
    if (button.parentElement !== controls) {
        const side = controls.querySelector('#NowBarSideToggle');
        if (side) side.before(button);
        else controls.appendChild(button);
    }
    paintToggle(button, page);
}

function check(): void {
    const page = themeState.isEnabled ? fullscreenPage() : null;
    if (page !== watchedPage) {
        release();
        if (page) attach(page);
    }
    if (!page) {
        document.getElementById(TOGGLE_ID)?.remove();
        return;
    }
    syncToggle(page);
    applyClasses(page);
}

export function refreshFullscreenTools(): void {
    if (checkTimer !== null) check();
}

export function startFullscreenTools(): void {
    if (checkTimer === null) checkTimer = setInterval(check, CHECK_MS);
    check();
}

export function stopFullscreenTools(): void {
    if (checkTimer !== null) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
    release();
    document.getElementById(TOGGLE_ID)?.remove();
}
