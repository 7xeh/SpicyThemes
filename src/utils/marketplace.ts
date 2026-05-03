import { ThemeConfig } from './state';

const API_BASE = 'https://7xeh.dev/apps/spicythemes/api/marketplace.php';
const REQUEST_TIMEOUT_MS = 8000;

export interface MarketplaceTheme {
    id: string;
    name: string;
    author: string;
    description: string;
    theme: Partial<ThemeConfig>;
    tags: string[];
    downloads: number;
    featured: boolean;
    uploadDate: string;
    uploadTimestamp: number;
}

export interface MarketplaceListResponse {
    themes: MarketplaceTheme[];
    page: number;
    totalPages: number;
    totalThemes: number;
}

export interface MarketplaceStats {
    totalThemes: number;
    totalDownloads: number;
    totalAuthors: number;
}

export interface MarketplaceDownloadResponse {
    success: true;
    theme: ThemeConfig;
    presets: never[];
    presetName: string;
    meta: {
        id: string;
        name: string;
        author: string;
        downloads: number;
    };
}

export type MarketplaceSort = 'newest' | 'popular' | 'featured';

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

async function request<T>(params: Record<string, string>, init: RequestInit = {}): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const response = await fetchWithTimeout(`${API_BASE}?${query}`, init);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Marketplace API error ${response.status}: ${text || response.statusText}`);
    }
    const data = await response.json();
    if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String((data as { error: string }).error));
    }
    return data as T;
}

export async function listThemes(opts: {
    page?: number;
    sort?: MarketplaceSort;
    query?: string;
    tag?: string;
    featuredOnly?: boolean;
} = {}): Promise<MarketplaceListResponse> {
    const params: Record<string, string> = {
        action: 'list',
        page: String(opts.page || 1),
        sort: opts.sort || 'newest',
    };
    if (opts.query) params.q = opts.query;
    if (opts.tag) params.tag = opts.tag;
    if (opts.featuredOnly) params.featured = '1';
    return request<MarketplaceListResponse>(params);
}

export async function getFeatured(): Promise<{ themes: MarketplaceTheme[] }> {
    return request<{ themes: MarketplaceTheme[] }>({ action: 'featured' });
}

export async function getStats(): Promise<MarketplaceStats> {
    return request<MarketplaceStats>({ action: 'stats' });
}

export async function getTheme(id: string): Promise<MarketplaceTheme> {
    return request<MarketplaceTheme>({ action: 'get', id });
}

export async function downloadTheme(id: string): Promise<MarketplaceDownloadResponse> {
    return request<MarketplaceDownloadResponse>({ action: 'download', id });
}

export async function uploadTheme(payload: {
    name: string;
    author: string;
    description?: string;
    theme: ThemeConfig;
    tags?: string[];
}): Promise<{ success: true; id: string; name: string; author: string }> {
    const response = await fetchWithTimeout(`${API_BASE}?action=upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Upload failed (HTTP ${response.status})`);
    }
    return response.json();
}
