import { storage } from './storage';
import {
    themeState,
    saveThemeState,
    setActiveSource,
    mergeThemeConfig,
    themeFingerprint,
    ThemeConfig,
    ThemePreset,
    ThemeSource,
} from './state';
import {
    checkUpdates,
    downloadTheme,
    CHECK_UPDATES_MAX_IDS,
    MarketplaceDownloadResponse,
    RemoteThemeInfo,
} from './marketplace';

const LAST_CHECK_KEY = 'mp-update-checked-at';
const CACHE_KEY = 'mp-update-cache';
const THROTTLE_MS = 60 * 60 * 1000;

let remote = new Map<string, RemoteThemeInfo>();
let cacheLoaded = false;
let inFlight: Promise<boolean> | null = null;

function loadCache(): void {
    if (cacheLoaded) return;
    cacheLoaded = true;
    try {
        const raw = storage.get(CACHE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return;
            const row = entry as Record<string, unknown>;
            if (typeof row.id !== 'string' || typeof row.version !== 'number') return;
            remote.set(row.id, {
                id: row.id,
                name: typeof row.name === 'string' ? row.name : '',
                version: row.version,
                updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
            });
        });
    } catch (e) {}
}

function saveCache(): void {
    try {
        storage.set(CACHE_KEY, JSON.stringify(Array.from(remote.values())));
    } catch (e) {}
}

function noteRemote(source: ThemeSource): void {
    loadCache();
    const existing = remote.get(source.id);
    remote.set(source.id, {
        id: source.id,
        name: source.name,
        version: source.version,
        updatedAt: existing ? existing.updatedAt : '',
    });
    saveCache();
}

export function collectSourceIds(): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const push = (id?: string) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
    };
    push(themeState.activeSourceId);
    themeState.customPresets.forEach(preset => push(preset.sourceId));
    return ids;
}

function chunkIds(ids: string[], size: number): string[][] {
    const groups: string[][] = [];
    for (let i = 0; i < ids.length; i += size) groups.push(ids.slice(i, i + size));
    return groups;
}

function reconcile(found: RemoteThemeInfo[], missing: string[]): boolean {
    const byId = new Map(found.map(info => [info.id, info]));
    const gone = new Set(missing);
    let dirty = false;
    let notable = false;

    themeState.customPresets.forEach(preset => {
        const id = preset.sourceId;
        if (!id) return;

        if (gone.has(id)) {
            preset.sourceId = undefined;
            preset.sourceVersion = undefined;
            preset.sourceFingerprint = undefined;
            preset.sourceRemoved = true;
            dirty = true;
            notable = true;
            return;
        }

        const info = byId.get(id);
        if (!info) return;
        const known = preset.sourceVersion ?? 1;

        if (info.version > known) {
            notable = true;
            return;
        }
        if (info.version === known && info.name && info.name !== preset.sourceName) {
            if (!preset.sourceName || preset.name === preset.sourceName) preset.name = info.name;
            preset.sourceName = info.name;
            dirty = true;
            notable = true;
        }
    });

    const activeId = themeState.activeSourceId;
    if (activeId) {
        if (gone.has(activeId)) {
            setActiveSource(null);
            dirty = true;
        } else {
            const info = byId.get(activeId);
            const known = themeState.activeSourceVersion ?? 1;
            if (info && info.version > known) {
                notable = true;
            } else if (info && info.version === known && info.name && info.name !== themeState.activeSourceName) {
                if (themeState.activePresetName === themeState.activeSourceName) {
                    themeState.activePresetName = info.name;
                }
                themeState.activeSourceName = info.name;
                dirty = true;
                notable = true;
            }
        }
    }

    if (dirty) saveThemeState();
    return dirty || notable;
}

export function scanForUpdates(force = false): Promise<boolean> {
    loadCache();

    const ids = collectSourceIds();
    if (ids.length === 0) {
        if (remote.size > 0) {
            remote.clear();
            saveCache();
        }
        return Promise.resolve(false);
    }

    if (inFlight) return inFlight;

    if (!force) {
        const last = Number(storage.get(LAST_CHECK_KEY) || 0);
        if (isFinite(last) && last > 0 && Date.now() - last < THROTTLE_MS) return Promise.resolve(false);
    }

    inFlight = (async () => {
        try {
            const found: RemoteThemeInfo[] = [];
            const missing: string[] = [];
            for (const group of chunkIds(ids, CHECK_UPDATES_MAX_IDS)) {
                const res = await checkUpdates(group);
                if (Array.isArray(res?.themes)) {
                    res.themes.forEach(info => {
                        if (info && typeof info.id === 'string' && typeof info.version === 'number') found.push(info);
                    });
                }
                if (Array.isArray(res?.missing)) {
                    res.missing.forEach(id => {
                        if (typeof id === 'string' && id) missing.push(id);
                    });
                }
            }
            storage.set(LAST_CHECK_KEY, String(Date.now()));
            remote = new Map(found.map(info => [info.id, info]));
            saveCache();
            return reconcile(found, missing);
        } catch (e) {
            storage.set(LAST_CHECK_KEY, String(Date.now()));
            return false;
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}

function pendingUpdate(sourceId: string | undefined, knownVersion: number | undefined): RemoteThemeInfo | null {
    if (!sourceId) return null;
    loadCache();
    const info = remote.get(sourceId);
    if (!info) return null;
    return info.version > (knownVersion ?? 1) ? info : null;
}

export function presetUpdate(preset: ThemePreset): RemoteThemeInfo | null {
    return pendingUpdate(preset.sourceId, preset.sourceVersion);
}

export function activeThemeUpdate(): RemoteThemeInfo | null {
    return pendingUpdate(themeState.activeSourceId, themeState.activeSourceVersion);
}

export function presetHasLocalChanges(preset: ThemePreset): boolean {
    if (!preset.sourceFingerprint) return false;
    return themeFingerprint(preset.config) !== preset.sourceFingerprint;
}

export function activeThemeHasLocalChanges(): boolean {
    if (!themeState.activeSourceFingerprint) return false;
    return themeFingerprint(themeState.activeTheme) !== themeState.activeSourceFingerprint;
}

export interface DownloadedTheme {
    config: ThemeConfig;
    source: ThemeSource;
    meta: MarketplaceDownloadResponse['meta'];
}

export async function downloadThemeWithSource(id: string): Promise<DownloadedTheme> {
    const data = await downloadTheme(id);
    const config = mergeThemeConfig(data.theme);
    const source: ThemeSource = {
        id: data.meta?.id || id,
        version: typeof data.meta?.version === 'number' ? data.meta.version : 1,
        name: data.meta?.name || '',
        fingerprint: themeFingerprint(config),
    };
    noteRemote(source);
    return { config, source, meta: data.meta };
}

export async function updateActiveThemeFromSource(): Promise<string> {
    const id = themeState.activeSourceId;
    if (!id) throw new Error('This theme did not come from the Marketplace');
    const { config, source } = await downloadThemeWithSource(id);
    themeState.activeTheme = config;
    if (source.name) {
        themeState.activePresetName = source.name;
        themeState.activeBasePreset = source.name;
    }
    setActiveSource(source);
    saveThemeState();
    return source.name || themeState.activePresetName;
}

export async function updatePresetFromSource(preset: ThemePreset): Promise<string> {
    const id = preset.sourceId;
    if (!id) throw new Error('This preset did not come from the Marketplace');
    const { config, source, meta } = await downloadThemeWithSource(id);
    const target = themeState.customPresets.find(p => p.sourceId === id) || preset;
    const followsSourceName = !target.sourceName || target.name === target.sourceName;

    target.config = config;
    target.sourceVersion = source.version;
    target.sourceFingerprint = source.fingerprint;
    if (source.name) {
        target.sourceName = source.name;
        if (followsSourceName) target.name = source.name;
    }
    if (meta?.description) target.description = meta.description;

    saveThemeState();
    return target.name;
}
