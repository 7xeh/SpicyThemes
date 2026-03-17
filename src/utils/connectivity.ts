import { storage } from './storage';
import { debug } from './debug';

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
let sltStatsElement: HTMLElement | null = null;
let standaloneElement: HTMLElement | null = null;

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
            debug('ST connectivity connected');
            return true;
        }
        return false;
    } catch (e) {
        debug('ST connectivity connect failed:', e);
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

function createSTStatsRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'st-ci-stats-row';
    row.innerHTML = `
        <span class="slt-ci-sep" style="width:100%;height:1px;margin:2px 0;"></span>
        <div class="slt-ci-stats-row" style="width:100%;">
            <span class="st-ci-label" title="Spicy Themes users" style="font-size:0.58rem;opacity:0.5;font-weight:600;letter-spacing:0.03em;">ST</span>
            <span class="slt-ci-sep"></span>
            <span class="slt-ci-users-count slt-ci-total" title="Total ST users installed">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span class="st-ci-total-count">0</span>
            </span>
        </div>
    `;
    return row;
}

// Removed standalone ST indicator. Only show ST stats in the tippy/tooltip.

function appendToSLTIndicator(): boolean {
    const sltIndicator = findSLTIndicator();
    if (!sltIndicator) return false;

    if (sltIndicator.querySelector('.st-ci-stats-row')) return true;

    const expanded = sltIndicator.querySelector('.slt-ci-expanded');
    if (!expanded) return false;

    sltStatsElement = createSTStatsRow();
    expanded.appendChild(sltStatsElement);
    debug('ST stats appended to SLT indicator');
    return true;
}

// Removed standalone creation. Only append ST stats to the main indicator.
function updateDisplay(): void {
    const root = sltStatsElement;
    if (!root) return;

    const totalEl = root.querySelector('.st-ci-total-count');
    if (totalEl) totalEl.textContent = `${state.totalUsers}`;

    // Only update the tippy/tooltip, not a standalone indicator
    if (sltStatsElement) {
        const sltIndicator = findSLTIndicator();
        const button = sltIndicator?.querySelector('.slt-ci-button');
        if (button && (button as any)?._tippy) {
            const existingOnShow = (button as any)._tippy.props?.onShow;
            if (existingOnShow && !(button as any)._stTippyPatched) {
                (button as any)._stTippyPatched = true;
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
            }
        }
    }
}

function getSTTooltipSection(): string {
    return `
        <div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;padding-top:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:default;margin-bottom:6px;" title="Spicy Themes connectivity">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="width:7px;height:7px;border-radius:50%;background:${state.connected ? '#1db954' : '#555'};box-shadow:0 0 6px ${state.connected ? 'rgba(29,185,84,0.4)' : 'transparent'};"></span>
                    <span style="font-weight:600;">ST Server</span>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.06);">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;cursor:default;" title="Total Spicy Themes users">
                    <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em;">Users</span>
                    <span style="font-weight:700;font-size:13px;">${state.totalUsers}</span>
                    <span style="font-size:9px;opacity:0.4;">installed</span>
                </div>
                <!-- Active users section removed -->
            </div>
        </div>
    `;
}

function startHeartbeat(): void {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(async () => {
        if (!state.connected) {
            // Not connected yet — retry initial connection
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
        debug('ST connectivity: initial connection failed, will retry via heartbeat');
    }

    // Try to attach to SLT indicator, with retries
    let attached = false;
    for (let i = 0; i < SLT_DETECT_MAX_ATTEMPTS; i++) {
        attached = appendToSLTIndicator();
        if (attached) break;
        await new Promise(resolve => setTimeout(resolve, SLT_DETECT_INTERVAL));
    }

    if (!attached) {
        debug('SLT indicator not found, skipping standalone creation');
    }

    updateDisplay();
    startHeartbeat();

    // Watch for SLT indicator appearing later (e.g. SLT loads after ST)
    if (!attached) {
        const observer = new MutationObserver(() => {
            if (sltStatsElement) {
                observer.disconnect();
                return;
            }
            if (appendToSLTIndicator()) {
                // Remove standalone since we're now in SLT
                if (standaloneElement && standaloneElement.parentNode) {
                    standaloneElement.parentNode.removeChild(standaloneElement);
                    standaloneElement = null;
                }
                updateDisplay();
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
    if (sltStatsElement && sltStatsElement.parentNode) {
        sltStatsElement.parentNode.removeChild(sltStatsElement);
        sltStatsElement = null;
    }
    if (standaloneElement && standaloneElement.parentNode) {
        standaloneElement.parentNode.removeChild(standaloneElement);
        standaloneElement = null;
    }
    state.isInitialized = false;
}

export function getConnectivityState(): STConnectivityState {
    return { ...state };
}
