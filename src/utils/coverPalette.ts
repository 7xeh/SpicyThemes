export type Rgb = [number, number, number];

export interface CoverPalette {
    primary: Rgb;
    secondary: Rgb;
}

export type CoverSource = 'primary' | 'secondary';

export interface CoverChoice {
    src: CoverSource;
    h: number;
    s: number;
    v: number;
}

interface Consumer {
    wanted: () => boolean;
    changed: () => void;
}

const consumers = new Set<Consumer>();
let palette: CoverPalette | null = null;
let paletteUrl = '';
let loadingUrl = '';
let loadToken = 0;
let songHooked = false;

export function rgbToHsl([r, g, b]: Rgb): Rgb {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
    return [h, s, l];
}

export function hslToRgb([h, s, l]: Rgb): Rgb {
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
        t = ((t % 1) + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

function rgbToHsv([r, g, b]: Rgb): Rgb {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0) {
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h /= 6;
    }
    return [h, max > 0 ? d / max : 0, max];
}

function hsvToRgb([h, s, v]: Rgb): Rgb {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (((i % 6) + 6) % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

function glowable(rgb: Rgb, grey: boolean): Rgb {
    const [h, s, l] = rgbToHsl(rgb);
    return hslToRgb([h, grey ? Math.min(s, 0.12) : Math.max(s, 0.6), Math.min(Math.max(l, 0.55), 0.72)]);
}

function paletteFromImage(img: HTMLImageElement): CoverPalette | null {
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    const BUCKETS = 24;
    const weight = new Array(BUCKETS).fill(0);
    const sums = Array.from({ length: BUCKETS }, () => [0, 0, 0]);
    const avg = [0, 0, 0];
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
        const rgb: Rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
        avg[0] += rgb[0];
        avg[1] += rgb[1];
        avg[2] += rgb[2];
        const max = Math.max(...rgb);
        const min = Math.min(...rgb);
        const sat = max > 0 ? (max - min) / max : 0;
        const w = sat * sat * max * (max > 0.12 ? 1 : 0);
        if (w <= 0) continue;
        const k = Math.floor(rgbToHsl(rgb)[0] * BUCKETS) % BUCKETS;
        weight[k] += w;
        sums[k][0] += rgb[0] * w;
        sums[k][1] += rgb[1] * w;
        sums[k][2] += rgb[2] * w;
        total += w;
    }
    const pixels = data.length / 4;
    if (total < pixels * 0.02) {
        const mean: Rgb = [avg[0] / pixels, avg[1] / pixels, avg[2] / pixels];
        const light = glowable(mean, true);
        return { primary: light, secondary: light.map(v => v * 0.55) as Rgb };
    }
    const smooth = weight.map((w, k) => w + 0.5 * (weight[(k + 1) % BUCKETS] + weight[(k + BUCKETS - 1) % BUCKETS]));
    const colorOf = (k: number): Rgb => {
        const ks = [k, (k + 1) % BUCKETS, (k + BUCKETS - 1) % BUCKETS];
        const w = ks.reduce((a, j) => a + weight[j], 0) || 1;
        return [0, 1, 2].map(c => ks.reduce((a, j) => a + sums[j][c], 0) / w) as Rgb;
    };
    let first = 0;
    smooth.forEach((w, k) => { if (w > smooth[first]) first = k; });
    let second = -1;
    smooth.forEach((w, k) => {
        const dist = Math.min(Math.abs(k - first), BUCKETS - Math.abs(k - first));
        if (dist >= 3 && w >= smooth[first] * 0.18 && (second < 0 || w > smooth[second])) second = k;
    });
    const primary = glowable(colorOf(first), false);
    if (second < 0) {
        const [h, sat, l] = rgbToHsl(primary);
        return { primary, secondary: hslToRgb([h + 0.09, sat, l * 0.8]) };
    }
    return { primary, secondary: glowable(colorOf(second), false) };
}

export function coverUrl(): string {
    try {
        const meta = (Spicetify?.Player?.data?.item as any)?.metadata || {};
        const raw: string = meta.image_large_url || meta.image_url || meta.image_xlarge_url || meta.image_small_url || '';
        if (raw.startsWith('spotify:image:')) return `https://i.scdn.co/image/${raw.slice('spotify:image:'.length)}`;
        if (/^https:\/\//.test(raw)) return raw;
    } catch (e) {}
    return '';
}

function anyWanted(): boolean {
    for (const c of consumers) {
        try {
            if (c.wanted()) return true;
        } catch (e) {}
    }
    return false;
}

function notify(): void {
    consumers.forEach(c => {
        try {
            if (c.wanted()) c.changed();
        } catch (e) {}
    });
}

function hookSongChange(): void {
    if (songHooked) return;
    try {
        Spicetify.Player.addEventListener('songchange', () => refreshCoverPalette());
        songHooked = true;
    } catch (e) {}
}

export function refreshCoverPalette(): void {
    hookSongChange();
    if (!anyWanted()) return;
    const url = coverUrl();
    if (!url || url === paletteUrl || url === loadingUrl) return;
    loadingUrl = url;
    const token = ++loadToken;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.decode().then(() => {
        if (token !== loadToken) return;
        loadingUrl = '';
        const next = paletteFromImage(img);
        if (!next) return;
        palette = next;
        paletteUrl = url;
        notify();
    }).catch(() => {
        if (token === loadToken) loadingUrl = '';
    });
}

export function registerCoverConsumer(wanted: () => boolean, changed: () => void): () => void {
    const consumer: Consumer = { wanted, changed };
    consumers.add(consumer);
    return () => consumers.delete(consumer);
}

export function currentCoverPalette(): CoverPalette | null {
    return palette;
}

export function rgbToHex(rgb: Rgb): string {
    return '#' + rgb.map(v => Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0')).join('');
}

export function adjustCoverColor(rgb: Rgb, choice: CoverChoice): Rgb {
    const [h, s, v] = rgbToHsv(rgb);
    const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
    return hsvToRgb([
        (((h + choice.h / 360) % 1) + 1) % 1,
        clamp01(s + choice.s / 100),
        clamp01(v + choice.v / 100),
    ]);
}

export function coverColorHex(choice: CoverChoice, from: CoverPalette | null = palette): string | null {
    if (!from) return null;
    return rgbToHex(adjustCoverColor(from[choice.src], choice));
}
