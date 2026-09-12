import { themeState } from './state';

export const BG_IMAGE_LAYER_ID = 'spicy-themes-bgimg';
export const BG_IMAGE_ACTIVE_CLASS = 'st-bgimg-active';

const DB_NAME = 'spicy-themes-media';
const STORE = 'background-images';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 3840;

interface StoredImage {
    blob: Blob;
    name: string;
    width: number;
    height: number;
    added: number;
}

export interface BackgroundImageInfo {
    id: string;
    name: string;
    width: number;
    height: number;
    size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const urls = new Map<string, string>();
const infos = new Map<string, BackgroundImageInfo>();
const missing = new Set<string>();
const pending = new Map<string, Promise<string | null>>();
let applyToken = 0;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }).catch(err => {
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
}

function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    return openDb().then(db => new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    }));
}

function newImageId(): string {
    return `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function decodeImage(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    return img.decode().then(
        () => {
            URL.revokeObjectURL(url);
            return img;
        },
        err => {
            URL.revokeObjectURL(url);
            throw err;
        },
    );
}

async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
    if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.');
    if (file.size > MAX_BYTES) throw new Error('Background images must be 25 MB or smaller.');

    let img: HTMLImageElement;
    try {
        img = await decodeImage(file);
    } catch (e) {
        throw new Error('Couldn’t read that image.');
    }

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const longest = Math.max(width, height);
    if (file.type === 'image/gif' || file.type === 'image/svg+xml' || longest <= MAX_EDGE) {
        return { blob: file, width, height };
    }

    const scale = MAX_EDGE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, width, height };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.92));
    return blob ? { blob, width: canvas.width, height: canvas.height } : { blob: file, width, height };
}

function remember(id: string, record: StoredImage): string {
    missing.delete(id);
    infos.set(id, { id, name: record.name, width: record.width, height: record.height, size: record.blob.size });
    let url = urls.get(id);
    if (!url) {
        url = URL.createObjectURL(record.blob);
        urls.set(id, url);
    }
    return url;
}

export async function saveBackgroundImage(file: File): Promise<string> {
    const prepared = await prepareImage(file);
    const id = newImageId();
    const record: StoredImage = { ...prepared, name: file.name || 'Image', added: Date.now() };
    try {
        await withStore('readwrite', store => store.put(record, id));
    } catch (e) {
        throw new Error('Couldn’t store the image on this device.');
    }
    remember(id, record);
    return id;
}

export function getCachedBackgroundUrl(id: string): string | null {
    return urls.get(id) || null;
}

export function getBackgroundImageUrl(id: string): Promise<string | null> {
    if (!id || missing.has(id)) return Promise.resolve(null);
    const cached = urls.get(id);
    if (cached) return Promise.resolve(cached);

    let request = pending.get(id);
    if (!request) {
        request = withStore<StoredImage>('readonly', store => store.get(id))
            .then(record => {
                if (!record || !(record.blob instanceof Blob)) {
                    missing.add(id);
                    return null;
                }
                return remember(id, record);
            })
            .catch(() => {
                missing.add(id);
                return null;
            })
            .finally(() => {
                pending.delete(id);
            });
        pending.set(id, request);
    }
    return request;
}

export function getBackgroundImageInfo(id: string): Promise<BackgroundImageInfo | null> {
    return getBackgroundImageUrl(id).then(url => (url ? infos.get(id) || null : null));
}

export async function pruneBackgroundImages(): Promise<void> {
    const keep = new Set<string>();
    const add = (id: unknown) => {
        if (typeof id === 'string' && id) keep.add(id);
    };
    add(themeState.activeTheme.pageBgImage);
    themeState.customPresets.forEach(p => add(p.config?.pageBgImage));

    const keys = await withStore<IDBValidKey[]>('readonly', store => store.getAllKeys());
    const stale = (keys || []).map(String).filter(k => !keep.has(k));
    if (!stale.length) return;

    await withStore('readwrite', store => {
        stale.forEach(k => store.delete(k));
    });
    stale.forEach(k => {
        const url = urls.get(k);
        if (url) URL.revokeObjectURL(url);
        urls.delete(k);
        infos.delete(k);
    });
}

export function bgImageSize(fit: string): string {
    if (fit === 'contain') return 'contain';
    if (fit === 'stretch') return '100% 100%';
    if (fit === 'tile') return 'auto';
    return 'cover';
}

export function bgImageRepeat(fit: string): string {
    return fit === 'tile' ? 'repeat' : 'no-repeat';
}

const POSITIONS: Record<string, string> = {
    center: 'center',
    top: 'center top',
    bottom: 'center bottom',
    left: 'left center',
    right: 'right center',
};

export function bgImagePosition(position: string): string {
    return POSITIONS[position] || 'center';
}

function wantedImageId(): string {
    const t = themeState.activeTheme;
    return themeState.isEnabled && t.pageBgImageEnabled && t.pageBgImage ? t.pageBgImage : '';
}

function documents(): Document[] {
    const list: Document[] = [document];
    try {
        const pip = (window as any).documentPictureInPicture?.window as Window | undefined;
        if (pip && pip.document !== document) list.push(pip.document);
    } catch (e) {}
    return list;
}

function layerOf(page: Element): HTMLElement | null {
    for (const child of Array.from(page.children)) {
        if (child.id === BG_IMAGE_LAYER_ID) return child as HTMLElement;
    }
    return null;
}

function clearLayerIn(doc: Document): void {
    doc.querySelectorAll(`#${BG_IMAGE_LAYER_ID}`).forEach(el => el.remove());
    doc.querySelectorAll(`.${BG_IMAGE_ACTIVE_CLASS}`).forEach(el => el.classList.remove(BG_IMAGE_ACTIVE_CLASS));
}

function mountLayerIn(doc: Document, url: string): void {
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('#SpicyLyricsPage'));
    doc.querySelectorAll<HTMLElement>(`#${BG_IMAGE_LAYER_ID}`).forEach(el => {
        if (!el.parentElement || !pages.includes(el.parentElement)) el.remove();
    });

    const value = `url("${url}")`;
    pages.forEach(page => {
        let layer = layerOf(page);
        if (!layer) {
            layer = doc.createElement('div');
            layer.id = BG_IMAGE_LAYER_ID;
            layer.setAttribute('aria-hidden', 'true');
            page.appendChild(layer);
        }
        if (layer.style.getPropertyValue('--st-bgimg') !== value) {
            layer.style.setProperty('--st-bgimg', value);
        }
        page.classList.add(BG_IMAGE_ACTIVE_CLASS);
    });
}

export function updateBackgroundImage(): void {
    const token = ++applyToken;
    const id = wantedImageId();
    if (!id) {
        documents().forEach(clearLayerIn);
        return;
    }

    const cached = urls.get(id);
    if (cached) {
        documents().forEach(doc => mountLayerIn(doc, cached));
        return;
    }

    getBackgroundImageUrl(id).then(url => {
        if (token !== applyToken) return;
        if (url) documents().forEach(doc => mountLayerIn(doc, url));
        else documents().forEach(clearLayerIn);
    });
}

export function removeBackgroundImage(): void {
    applyToken++;
    documents().forEach(clearLayerIn);
}

export function backgroundImageNeedsMount(): boolean {
    const id = wantedImageId();
    if (!id || missing.has(id)) return false;
    return Array.from(document.querySelectorAll('#SpicyLyricsPage')).some(page => !layerOf(page));
}
