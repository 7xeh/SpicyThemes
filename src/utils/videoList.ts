import { storage } from './storage';

export type VideoListMode = 'all' | 'allow';

export interface VideoListEntry {
    id: string;
    title: string;
    artist: string;
    at: number;
}

type EntryMap = Record<string, VideoListEntry>;

const MODE_KEY = 'mv-list-mode';
const BLOCKED_KEY = 'mv-blocked';
const ALLOWED_KEY = 'mv-allowed';
const MAX_ENTRIES = 2000;
const TRACK_ID_RE = /^[A-Za-z0-9]{10,40}$/;
const TEXT_STRIP_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

const listeners = new Set<() => void>();

function cleanText(value: unknown): string {
    return typeof value === 'string' ? value.replace(TEXT_STRIP_RE, '').trim().slice(0, 160) : '';
}

function load(key: string): EntryMap {
    const out: EntryMap = {};
    try {
        const parsed = JSON.parse(storage.get(key) || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
        Object.keys(parsed).slice(0, MAX_ENTRIES).forEach(id => {
            if (!TRACK_ID_RE.test(id)) return;
            const raw = parsed[id] || {};
            const at = Number(raw.at);
            out[id] = { id, title: cleanText(raw.title), artist: cleanText(raw.artist), at: isFinite(at) ? at : 0 };
        });
    } catch (e) {}
    return out;
}

let mode: VideoListMode = storage.get(MODE_KEY) === 'allow' ? 'allow' : 'all';
let blocked = load(BLOCKED_KEY);
let allowed = load(ALLOWED_KEY);

function save(key: string, map: EntryMap): void {
    const ids = Object.keys(map);
    if (!ids.length) {
        storage.remove(key);
        return;
    }
    const compact: Record<string, { title: string; artist: string; at: number }> = {};
    ids.forEach(id => {
        compact[id] = { title: map[id].title, artist: map[id].artist, at: map[id].at };
    });
    storage.set(key, JSON.stringify(compact));
}

function emit(): void {
    listeners.forEach(fn => {
        try {
            fn();
        } catch (e) {}
    });
}

function trim(map: EntryMap): void {
    const ids = Object.keys(map);
    if (ids.length <= MAX_ENTRIES) return;
    ids.sort((a, b) => map[a].at - map[b].at)
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach(id => delete map[id]);
}

function sorted(map: EntryMap): VideoListEntry[] {
    return Object.keys(map).map(id => map[id]).sort((a, b) => b.at - a.at);
}

export function onVideoListChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function videoListMode(): VideoListMode {
    return mode;
}

export function setVideoListMode(next: VideoListMode): void {
    const value: VideoListMode = next === 'allow' ? 'allow' : 'all';
    if (value === mode) return;
    mode = value;
    if (mode === 'all') storage.remove(MODE_KEY);
    else storage.set(MODE_KEY, mode);
    emit();
}

export function videoBlocked(id: string | null): boolean {
    return !!id && !!blocked[id];
}

export function videoAllowed(id: string | null): boolean {
    return !!id && !!allowed[id];
}

export function videoPermitted(id: string | null): boolean {
    if (!id || blocked[id]) return false;
    return mode !== 'allow' || !!allowed[id];
}

export function blockedVideos(): VideoListEntry[] {
    return sorted(blocked);
}

export function allowedVideos(): VideoListEntry[] {
    return sorted(allowed);
}

function normalizeEntry(entry: { id: string; title?: string; artist?: string }): VideoListEntry | null {
    if (!entry || !TRACK_ID_RE.test(entry.id)) return null;
    return { id: entry.id, title: cleanText(entry.title), artist: cleanText(entry.artist), at: Date.now() };
}

export function blockVideo(entry: { id: string; title?: string; artist?: string }): void {
    const next = normalizeEntry(entry);
    if (!next) return;
    blocked[next.id] = next;
    trim(blocked);
    save(BLOCKED_KEY, blocked);
    if (allowed[next.id]) {
        delete allowed[next.id];
        save(ALLOWED_KEY, allowed);
    }
    emit();
}

export function unblockVideo(id: string): void {
    if (!blocked[id]) return;
    delete blocked[id];
    save(BLOCKED_KEY, blocked);
    emit();
}

export function allowVideo(entry: { id: string; title?: string; artist?: string }): void {
    const next = normalizeEntry(entry);
    if (!next) return;
    allowed[next.id] = next;
    trim(allowed);
    save(ALLOWED_KEY, allowed);
    if (blocked[next.id]) {
        delete blocked[next.id];
        save(BLOCKED_KEY, blocked);
    }
    emit();
}

export function disallowVideo(id: string): void {
    if (!allowed[id]) return;
    delete allowed[id];
    save(ALLOWED_KEY, allowed);
    emit();
}

export function clearBlockedVideos(): void {
    if (!Object.keys(blocked).length) return;
    blocked = {};
    save(BLOCKED_KEY, blocked);
    emit();
}

export function clearAllowedVideos(): void {
    if (!Object.keys(allowed).length) return;
    allowed = {};
    save(ALLOWED_KEY, allowed);
    emit();
}

export function currentTrackEntry(): { id: string; title: string; artist: string } | null {
    try {
        const data = (Spicetify.Player as any).data;
        const item = data?.item || data?.track;
        const uri: string = item?.uri || '';
        if (!uri.startsWith('spotify:track:')) return null;
        const id = uri.split(':').pop() || '';
        if (!TRACK_ID_RE.test(id)) return null;
        const artists = Array.isArray(item?.artists) ? item.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '';
        return {
            id,
            title: cleanText(item?.name || item?.metadata?.title),
            artist: cleanText(artists || item?.metadata?.artist_name),
        };
    } catch (e) {
        return null;
    }
}
