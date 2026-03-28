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
let tippyPatched = false;

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
        const shareData = storage.get('share-usage-data') !== 'false';
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

function patchSLTTippy(): boolean {
    const sltIndicator = findSLTIndicator();
    const button = sltIndicator?.querySelector('.slt-ci-button');
    if (!button || !(button as any)?._tippy) return false;

    if (tippyPatched) return true;
    tippyPatched = true;

    const existingOnShow = (button as any)._tippy.props?.onShow;
    if (!existingOnShow) return false;

    const origOnShow = existingOnShow;
    (button as any)._tippy.setProps({
        onShow(instance: any) {
            origOnShow(instance);
            const currentContent = instance.props.content;
            if (typeof currentContent === 'string' && !currentContent.includes('ST Server')) {
                const stSection = getSTTooltipSection();
                const insertPoint = currentContent.lastIndexOf('</div>');
                if (insertPoint >= 0) {
                    instance.setContent(currentContent.slice(0, insertPoint) + stSection + currentContent.slice(insertPoint));
                }
            }
        }
    });
    return true;
}

function updateDisplay(): void {
    patchSLTTippy();
}

function getSTTooltipSection(): string {
    const dotColor = state.connected ? '#1db954' : '#555';
    const dotShadow = state.connected ? '0 0 6px rgba(29,185,84,0.4)' : 'none';
    const statusText = state.connected ? 'Connected' : 'Offline';

    return `
        <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:8px;padding-top:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:default;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:${dotShadow};flex-shrink:0;"></span>
                    <span style="font-weight:700;font-size:12px;letter-spacing:0.02em;">ST Server</span>
                </div>
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.45;font-weight:600;">${statusText}</span>
            </div>
            <div style="display:flex;align-items:stretch;gap:1px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.04);">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;padding:8px 12px;cursor:default;" title="Total Spicy Themes users">
                    <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.4;font-weight:600;">USERS</span>
                    <span style="font-weight:800;font-size:14px;color:#fff;">${state.totalUsers}</span>
                    <span style="font-size:8px;opacity:0.35;">installed</span>
                </div>
            </div>
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

    let patched = false;
    for (let i = 0; i < SLT_DETECT_MAX_ATTEMPTS; i++) {
        patched = patchSLTTippy();
        if (patched) break;
        await new Promise(resolve => setTimeout(resolve, SLT_DETECT_INTERVAL));
    }

    if (!patched) {
    }

    startHeartbeat();

    if (!patched) {
        const observer = new MutationObserver(() => {
            if (tippyPatched) {
                observer.disconnect();
                return;
            }
            if (patchSLTTippy()) {
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
    tippyPatched = false;
    state.isInitialized = false;
}

export function getConnectivityState(): STConnectivityState {
    return { ...state };
}
