import { themeState, saveThemeState } from './state';
import { currentTrackId, currentVideoAvailable, probeCurrentVideo, onVideoAvailabilityChange } from './musicVideo';

export type ThemeMode = 'off' | 'theme' | 'video';

type ModeListener = (reinject: boolean) => void;

const listeners = new Set<ModeListener>();
let suppressedFor: string | null = null;
let lastWanted: boolean | null = null;
let started = false;

function emit(reinject: boolean): void {
    listeners.forEach(fn => {
        try {
            fn(reinject);
        } catch (e) {}
    });
}

function lyricsOpen(): boolean {
    return !!document.querySelector('#SpicyLyricsPage');
}

function probe(): void {
    if (!themeState.isEnabled || !lyricsOpen()) return;
    probeCurrentVideo().catch(() => {});
}

export function onThemeModeChange(fn: ModeListener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function videoWanted(): boolean {
    if (!themeState.isEnabled) return false;
    if (themeState.videoMode) return true;
    if (!themeState.videoAuto) return false;
    const id = currentTrackId();
    return !id || id !== suppressedFor;
}

export function themeMode(): ThemeMode {
    if (!themeState.isEnabled) return 'off';
    return videoWanted() && currentVideoAvailable() ? 'video' : 'theme';
}

export function nextThemeMode(): ThemeMode {
    const mode = themeMode();
    if (mode === 'off') return themeState.videoAuto && currentVideoAvailable() ? 'video' : 'theme';
    if (mode === 'theme') return currentVideoAvailable() && suppressedFor !== currentTrackId() ? 'video' : 'off';
    return themeState.videoAuto ? 'theme' : 'off';
}

function turnOff(): void {
    themeState.isEnabled = false;
    themeState.videoMode = false;
    suppressedFor = null;
}

export function cycleThemeMode(): void {
    const mode = themeMode();
    const id = currentTrackId();
    if (mode === 'off') {
        themeState.isEnabled = true;
        themeState.videoMode = false;
        suppressedFor = null;
    } else if (mode === 'theme') {
        if (currentVideoAvailable() && suppressedFor !== id) {
            themeState.videoMode = true;
            suppressedFor = null;
        } else {
            turnOff();
        }
    } else if (themeState.videoAuto) {
        themeState.videoMode = false;
        suppressedFor = id;
    } else {
        turnOff();
    }
    saveThemeState();
}

export function setVideoAuto(value: boolean): void {
    themeState.videoAuto = value;
    suppressedFor = null;
    saveThemeState();
}

export function noteThemeModeApplied(): void {
    lastWanted = videoWanted();
    emit(false);
    probe();
}

function onSongChange(): void {
    if (!themeState.isEnabled) return;
    const wanted = videoWanted();
    const changed = wanted !== lastWanted;
    lastWanted = wanted;
    emit(changed);
    probe();
}

export function initVideoMode(): void {
    if (started) return;
    started = true;
    lastWanted = videoWanted();
    onVideoAvailabilityChange(() => emit(false));
    try {
        Spicetify.Player.addEventListener('songchange', onSongChange);
    } catch (e) {}
}
