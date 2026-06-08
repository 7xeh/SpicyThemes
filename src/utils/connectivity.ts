import { storage } from './storage';


const API_BASE = 'https://7xeh.dev/apps/SpicyThemes/api/connectivity.php';
const CLIENT_ID_KEY = 'client-id';

function getOrCreateClientId(): string {
    let clientId = storage.get(CLIENT_ID_KEY);
    if (!clientId) {
        clientId = crypto.randomUUID?.() ??
            (Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join(''));
        storage.set(CLIENT_ID_KEY, clientId);
    }
    return clientId;
}

const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 5000;
const INITIAL_DELAY = 4000;
const SLT_DETECT_INTERVAL = 3000;
const SLT_DETECT_MAX_ATTEMPTS = 10;

interface STConnectivityState {
    sessionId: string | null;
    totalUsers: number;
    isViewingLyrics: boolean;
    connected: boolean;
    isInitialized: boolean;
}

const state: STConnectivityState = {
    sessionId: null,
    totalUsers: 0,
    isViewingLyrics: false,
    connected: false,
    isInitialized: false,
};

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let tippyAttached = false;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = CONNECTION_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function connectToAPI(): Promise<boolean> {
    try {
        const params = new URLSearchParams({
            action: 'connect',
            version: getExtensionVersion(),
            clientId: getOrCreateClientId(),
        });
        const response = await fetchWithTimeout(`${API_BASE}?${params}`);
        if (!response.ok) return false;

        const data = await response.json();
        if (data.success) {
            state.sessionId = data.sessionId;
            state.totalUsers = data.totalUsers || 0;
            state.connected = true;
            updateDisplay();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function sendHeartbeat(): Promise<boolean> {
    if (!state.sessionId) return false;
    try {
        const shareData = storage.get('share-usage-data') === 'true';
        const params = new URLSearchParams({
            action: 'heartbeat',
            session: state.sessionId,
            version: getExtensionVersion(),
            active: (shareData && state.isViewingLyrics) ? 'true' : 'false',
            clientId: getOrCreateClientId(),
        });
        const response = await fetchWithTimeout(`${API_BASE}?${params}`);
        if (!response.ok) return false;

        const data = await response.json();
        if (data.success) {
            state.sessionId = data.sessionId || state.sessionId;
            state.totalUsers = data.totalUsers || 0;
            updateDisplay();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function disconnectFromAPI(): Promise<void> {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (state.sessionId) {
        try {
            const params = new URLSearchParams({
                action: 'disconnect',
                session: state.sessionId,
            });
            await fetch(`${API_BASE}?${params}`);
        } catch (_) {}
    }
    state.connected = false;
    state.sessionId = null;
}

function getExtensionVersion(): string {
    const metadata = (window as any)._spicy_themes_metadata;
    if (metadata?.LoadedVersion) return metadata.LoadedVersion;
    try {
        return typeof (window as any).__VERSION__ !== 'undefined' ? (window as any).__VERSION__ : '1.0.0';
    } catch (_) {
        return '1.0.0';
    }
}

function findSLTIndicator(): HTMLElement | null {
    return document.querySelector('.SLT_ConnectionIndicator');
}

function getSLTButton(): HTMLElement | null {
    return findSLTIndicator()?.querySelector('.slt-ci-button') as HTMLElement | null;
}

function stripNativeTitles(container: HTMLElement): void {
    if (container.hasAttribute('title')) container.removeAttribute('title');
    container.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
}

const GLASS_STYLE_ID = 'st-connectivity-glass';

function injectGlassStyles(): void {
    if (document.getElementById(GLASS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = GLASS_STYLE_ID;
    style.textContent = `
.tippy-box[data-theme~='st-glass'] {
    background: rgba(16, 16, 20, 0.72);
    -webkit-backdrop-filter: blur(22px) saturate(1.5);
    backdrop-filter: blur(22px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.14),
        inset 0 0 0 1px rgba(255, 255, 255, 0.05),
        0 18px 44px -14px rgba(0, 0, 0, 0.66);
    color: hsla(0, 0%, 100%, 0.92);
    -webkit-font-smoothing: antialiased;
}
.tippy-box[data-theme~='st-glass'] .tippy-content {
    padding: 0;
}
.tippy-box[data-theme~='st-glass'] > .tippy-arrow::before,
.tippy-box[data-theme~='st-glass'] > .tippy-svg-arrow {
    color: rgba(16, 16, 20, 0.72);
    fill: rgba(16, 16, 20, 0.72);
}
`;
    (document.head || document.documentElement).appendChild(style);
}

function attachSTTippy(): boolean {
    const container = findSLTIndicator();
    const button = container?.querySelector('.slt-ci-button') as HTMLElement | null;
    if (!container || !button) return false;

    if (typeof Spicetify === 'undefined' || !Spicetify.Tippy) return false;

    injectGlassStyles();
    stripNativeTitles(container);

    if ((container as any)._tippy) {
        (container as any)._tippy.setContent(getCombinedTooltipContent(button));
        tippyAttached = true;
        return true;
    }

    if (tippyAttached) return true;

    try {
        Spicetify.Tippy(container, {
            ...Spicetify.TippyProps,
            theme: 'st-glass',
            interactive: false,
            appendTo: document.body,
            allowHTML: true,
            delay: [200, 100],
            content: getCombinedTooltipContent(button),
            onShow: (instance: any) => {
                stripNativeTitles(container);
                instance.setContent(getCombinedTooltipContent(getSLTButton()));
            }
        });
        tippyAttached = true;
        return true;
    } catch (_) {
        return false;
    }
}

function getCombinedTooltipContent(button: HTMLElement | null): string {
    const sltAriaLabel = button?.getAttribute('aria-label') || '';
    const sltSection = sltAriaLabel
        ? `<div style="font-size:11px;color:hsla(0,0%,100%,0.58);padding-bottom:9px;margin-bottom:11px;border-bottom:1px solid rgba(255,255,255,0.07);">${escapeHtml(sltAriaLabel)}</div>`
        : '';
    return `<div style="padding:13px 14px;min-width:182px;font-family:'SpotifyMixUI','CircularSp','Helvetica Neue',sans-serif;">${sltSection}${getSTTooltipSection()}</div>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateDisplay(): void {
    if (!tippyAttached) return;
    const container = findSLTIndicator();
    const tippy = container && (container as any)._tippy;
    if (tippy) {
        tippy.setContent(getCombinedTooltipContent(getSLTButton()));
    }
}

function getSTTooltipSection(): string {
    const dotColor = state.connected ? '#1ed760' : '#5b5b5b';
    const dotShadow = state.connected ? '0 0 7px -1px #1ed760' : 'none';
    const statusText = state.connected ? 'Connected' : 'Offline';

    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:default;">
            <div style="display:flex;align-items:center;gap:7px;">
                <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:${dotShadow};flex-shrink:0;"></span>
                <span style="font-weight:700;font-size:12px;letter-spacing:0.01em;color:hsla(0,0%,100%,0.92);">ST Server</span>
            </div>
            <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:hsla(0,0%,100%,0.4);font-weight:600;">${statusText}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:11px 12px;border-radius:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),inset 0 0 0 1px rgba(255,255,255,0.04);cursor:default;">
            <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:hsla(0,0%,100%,0.4);font-weight:600;">Users</span>
            <span style="font-weight:800;font-size:18px;line-height:1.1;color:hsla(0,0%,100%,0.95);font-variant-numeric:tabular-nums;">${state.totalUsers.toLocaleString()}</span>
            <span style="font-size:8px;color:hsla(0,0%,100%,0.35);letter-spacing:0.04em;">installed</span>
        </div>
    `;
}

function startHeartbeat(): void {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(async () => {
        if (!state.connected) {
            await connectToAPI();
            return;
        }
        const ok = await sendHeartbeat();
        if (!ok) {
            state.connected = false;
            await connectToAPI();
        }
    }, HEARTBEAT_INTERVAL);
}

export async function initConnectivity(): Promise<void> {
    if (state.isInitialized) return;
    state.isInitialized = true;

    await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY));

    const connected = await connectToAPI();
    if (!connected) {
    }

    let attached = false;
    for (let i = 0; i < SLT_DETECT_MAX_ATTEMPTS; i++) {
        attached = attachSTTippy();
        if (attached) break;
        await new Promise(resolve => setTimeout(resolve, SLT_DETECT_INTERVAL));
    }

    startHeartbeat();

    if (!attached) {
        const observer = new MutationObserver(() => {
            if (tippyAttached) {
                observer.disconnect();
                return;
            }
            if (attachSTTippy()) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('beforeunload', () => {
        disconnectFromAPI();
    });
}

export function setViewingLyrics(isViewing: boolean): void {
    if (state.isViewingLyrics !== isViewing) {
        state.isViewingLyrics = isViewing;
        if (state.connected) {
            sendHeartbeat();
        }
    }
}

export function cleanupConnectivity(): void {
    disconnectFromAPI();
    tippyAttached = false;
    state.isInitialized = false;
}

export function getConnectivityState(): STConnectivityState {
    return { ...state };
}
