import { debug } from './debug';

const API_BASE = 'https://7xeh.dev/apps/spicythemes/api/tube.php';
const TRUSTED_ORIGIN = 'https://7xeh.dev';
const LINK_PATH = '/apps/spicythemes/videos/link/';
export const PREMIUM_INFO_URL = `${TRUSTED_ORIGIN}${LINK_PATH}`;

const TOKEN_RE = /^t7d_[A-Za-z0-9_-]{32,128}$/;
const DEVICE_CODE_RE = /^[A-Za-z0-9_-]{32,128}$/;
const USER_CODE_RE = /^[A-Z0-9]{2,8}(-[A-Z0-9]{2,8}){0,3}$/;
const TICKET_RE = /^[A-Za-z0-9._~-]{16,512}$/;

const TOKEN_KEY = 'vdb:tube-token';
const USER_KEY = 'vdb:tube-user';
const PREF_KEY = 'vdb:quality-pref';

export const FREE_MAX_HEIGHT = 720;
export const BACKDROP_HEIGHT = 480;
export const QUALITY_CHOICES = [2160, 1440, 1080, 720, 480, 360];

const REQUEST_TIMEOUT_MS = 10000;
const MIN_REFRESH_MS = 15 * 1000;
const MAX_REFRESH_MS = 4 * 60 * 60 * 1000;
const RETRY_BASE_MS = 30 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const SKEWED_TICKET_GRACE_MS = 60 * 60 * 1000;
const FORCED_REFRESH_SPACING_MS = 30 * 1000;
const MANUAL_REFRESH_SPACING_MS = 5 * 1000;
const MIN_POLL_MS = 2000;
const MAX_POLL_MS = 30 * 1000;
const MAX_LINK_LIFETIME_S = 30 * 60;

export interface TubeUser {
    id: string;
    username: string;
    avatar: string | null;
}

export type QualityPref = 'auto' | number;

export interface TicketState {
    linked: boolean;
    premium: boolean;
    maxHeight: number;
    user: TubeUser | null;
    checked: boolean;
    refreshing: boolean;
    error: 'network' | 'rate_limited' | 'server' | null;
}

export type LinkPhase = 'idle' | 'starting' | 'waiting' | 'expired' | 'error';

export interface LinkState {
    phase: LinkPhase;
    userCode: string | null;
    verifyUrlComplete: string | null;
    expiresAt: number;
    error: string | null;
    unlinkUnconfirmed: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let ticket: string | null = null;
let ticketExpiresMs = 0;
let state: TicketState = {
    linked: false,
    premium: false,
    maxHeight: FREE_MAX_HEIGHT,
    user: null,
    checked: false,
    refreshing: false,
    error: null,
};
let link: LinkState = idleLink();

let initialized = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight: Promise<void> | null = null;
let failStreak = 0;
let lastForcedRefresh = 0;
let lastManualRefresh = 0;
let unlinkUnconfirmed = false;

let deviceCode: string | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let linkSession = 0;

function idleLink(): LinkState {
    return { phase: 'idle', userCode: null, verifyUrlComplete: null, expiresAt: 0, error: null, unlinkUnconfirmed: false };
}

function storeGet(key: string): string | null {
    try {
        const ls = (window as any).Spicetify?.LocalStorage;
        if (ls && typeof ls.get === 'function') {
            const v = ls.get(key);
            return typeof v === 'string' && v ? v : null;
        }
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function storeSet(key: string, value: string): void {
    try {
        const ls = (window as any).Spicetify?.LocalStorage;
        if (ls && typeof ls.set === 'function') ls.set(key, value);
        else localStorage.setItem(key, value);
    } catch (e) {}
}

function storeRemove(key: string): void {
    try {
        const ls = (window as any).Spicetify?.LocalStorage;
        if (ls && typeof ls.remove === 'function') ls.remove(key);
        else localStorage.removeItem(key);
    } catch (e) {}
}

function readToken(): string | null {
    const token = storeGet(TOKEN_KEY);
    return token && TOKEN_RE.test(token) ? token : null;
}

function parseUser(raw: any): TubeUser | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : '';
    if (!/^\d{5,25}$/.test(id)) return null;
    const username = typeof raw.username === 'string' ? raw.username.slice(0, 64) : '';
    const avatar = typeof raw.avatar === 'string' && /^(a_)?[0-9a-f]{16,64}$/i.test(raw.avatar) ? raw.avatar : null;
    return { id, username: username || 'Discord user', avatar };
}

function readCachedUser(): TubeUser | null {
    try {
        const raw = storeGet(USER_KEY);
        return raw ? parseUser(JSON.parse(raw)) : null;
    } catch (e) {
        return null;
    }
}

function emit(): void {
    listeners.forEach(fn => {
        try {
            fn();
        } catch (e) {}
    });
}

export function onTubeChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function getTicketState(): TicketState {
    return { ...state, premium: isPremiumActive() };
}

export function getLinkState(): LinkState {
    return { ...link, unlinkUnconfirmed };
}

export function dismissUnlinkNotice(): void {
    if (!unlinkUnconfirmed) return;
    unlinkUnconfirmed = false;
    emit();
}

function trustedLinkUrl(raw: unknown): string | null {
    if (typeof raw !== 'string' || raw.length > 512) return null;
    try {
        const u = new URL(raw);
        if (u.protocol !== 'https:' || u.origin !== TRUSTED_ORIGIN) return null;
        if (u.username || u.password) return null;
        if (!u.pathname.startsWith(LINK_PATH)) return null;
        return u.toString();
    } catch (e) {
        return null;
    }
}

function isTrustedExternal(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' && u.origin === TRUSTED_ORIGIN && !u.username && !u.password;
    } catch (e) {
        return false;
    }
}

export function currentTicket(): string | null {
    if (!ticket) return null;
    return Date.now() < ticketExpiresMs ? ticket : null;
}

export function isPremiumActive(): boolean {
    return state.premium && currentTicket() !== null;
}

export function hasLinkedDevice(): boolean {
    return readToken() !== null;
}

export function avatarUrl(user: TubeUser | null): string | null {
    if (!user || !user.avatar) return null;
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=64`;
}

export function formatHeight(height: number): string {
    if (height >= 4320) return '8K';
    if (height >= 2160) return '4K';
    return `${height}p`;
}

export function getQualityPref(): QualityPref {
    const raw = storeGet(PREF_KEY);
    if (!raw || raw === 'auto') return 'auto';
    const n = parseInt(raw, 10);
    return isFinite(n) && n >= 144 && n <= 4320 ? n : 'auto';
}

export function setQualityPref(pref: QualityPref): void {
    if (pref === 'auto') storeSet(PREF_KEY, 'auto');
    else if (isFinite(pref) && pref >= 144 && pref <= 4320) storeSet(PREF_KEY, String(Math.round(pref)));
    else return;
    emit();
}

export function resolvePreferredHeight(pref: QualityPref, levels: number[]): number | 'auto' {
    if (pref === 'auto') return 'auto';
    if (levels.includes(pref)) return pref;
    const below = levels.filter(h => h < pref).sort((a, b) => b - a);
    return below.length ? below[0] : 'auto';
}

function deviceLabel(): string {
    let hint = '';
    try {
        hint = `${(navigator as any).userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent || ''}`;
    } catch (e) {}
    let os = 'desktop';
    if (/mac|darwin/i.test(hint)) os = 'macOS';
    else if (/win/i.test(hint)) os = 'Windows';
    else if (/linux|x11|cros/i.test(hint)) os = 'Linux';
    return `Spotify on ${os}`;
}

interface ApiResult {
    status: number;
    data: any;
}

async function api(action: string, init: { method: 'GET' | 'POST'; body?: unknown; auth?: string }): Promise<ApiResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.auth) headers.Authorization = `Bearer ${init.auth}`;
    try {
        const response = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, {
            method: init.method,
            headers,
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        return { status: response.status, data };
    } finally {
        clearTimeout(timer);
    }
}

function clearRefreshTimers(): void {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
    if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
    }
}

function scheduleRefresh(delayMs: number): void {
    if (refreshTimer) clearTimeout(refreshTimer);
    const delay = Math.min(Math.max(delayMs, MIN_REFRESH_MS), MAX_REFRESH_MS);
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshTicket().catch(() => {});
    }, delay);
}

function scheduleExpiry(): void {
    if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
    }
    if (!ticket) return;
    const delay = ticketExpiresMs - Date.now();
    if (delay <= 0) return;
    expiryTimer = setTimeout(() => {
        expiryTimer = null;
        debug('video quality: ticket expired without a successful refresh, using free quality');
        emit();
        refreshTicket().catch(() => {});
    }, Math.min(delay, 2147483000));
}

function applyUnlinked(): void {
    clearRefreshTimers();
    ticket = null;
    ticketExpiresMs = 0;
    failStreak = 0;
    storeRemove(USER_KEY);
    state = {
        linked: false,
        premium: false,
        maxHeight: FREE_MAX_HEIGHT,
        user: null,
        checked: true,
        refreshing: false,
        error: null,
    };
}

function clearToken(): void {
    storeRemove(TOKEN_KEY);
    applyUnlinked();
}

function applyTicketResponse(data: any): void {
    const user = parseUser(data.user) || state.user;
    const premium = data.premium === true && typeof data.ticket === 'string' && TICKET_RE.test(data.ticket);
    const maxHeight = typeof data.max_height === 'number' && isFinite(data.max_height) ? data.max_height : FREE_MAX_HEIGHT;

    if (premium) {
        ticket = data.ticket;
        const expires = typeof data.expires_at === 'number' ? data.expires_at * 1000 : 0;
        ticketExpiresMs = expires > Date.now() ? expires : Date.now() + SKEWED_TICKET_GRACE_MS;
    } else {
        ticket = null;
        ticketExpiresMs = 0;
    }

    state = {
        linked: data.linked === true,
        premium,
        maxHeight: premium ? maxHeight : Math.min(maxHeight, FREE_MAX_HEIGHT),
        user,
        checked: true,
        refreshing: false,
        error: null,
    };
    if (user) storeSet(USER_KEY, JSON.stringify(user));

    const refreshAfter = typeof data.refresh_after === 'number' ? data.refresh_after * 1000 : 0;
    if (refreshAfter > 0) scheduleRefresh(refreshAfter - Date.now());
    else if (premium) scheduleRefresh(ticketExpiresMs - Date.now() - 60 * 60 * 1000);
    scheduleExpiry();
}

async function performRefresh(): Promise<void> {
    const token = readToken();
    if (!token) {
        applyUnlinked();
        emit();
        return;
    }

    state = { ...state, linked: true, refreshing: true, user: state.user || readCachedUser() };
    emit();

    let result: ApiResult;
    try {
        result = await api('ticket', { method: 'GET', auth: token });
    } catch (e) {
        handleRefreshFailure('network');
        return;
    }

    if (readToken() !== token) return;

    if (result.status === 401) {
        debug('video quality: device was unlinked remotely');
        clearToken();
        emit();
        return;
    }
    if (result.status === 429) {
        handleRefreshFailure('rate_limited');
        return;
    }
    if (result.status !== 200 || !result.data || typeof result.data !== 'object') {
        handleRefreshFailure('server');
        return;
    }

    failStreak = 0;
    applyTicketResponse(result.data);
    debug('video quality: ticket refreshed', state.premium ? 'premium' : 'free', 'max', state.maxHeight);
    emit();
}

function handleRefreshFailure(reason: 'network' | 'rate_limited' | 'server'): void {
    failStreak++;
    state = { ...state, refreshing: false, error: reason };
    const retry = Math.min(RETRY_BASE_MS * Math.pow(2, failStreak - 1), RETRY_MAX_MS);
    debug('video quality: ticket refresh failed', reason, 'retry in', Math.round(retry / 1000), 's');
    scheduleRefresh(retry);
    scheduleExpiry();
    emit();
}

export function refreshTicket(): Promise<void> {
    if (!refreshInFlight) {
        refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
        });
    }
    return refreshInFlight;
}

export function refreshTicketManually(): Promise<void> {
    const now = Date.now();
    if (now - lastManualRefresh < MANUAL_REFRESH_SPACING_MS) return refreshInFlight || Promise.resolve();
    lastManualRefresh = now;
    return refreshTicket();
}

export async function refreshTicketAfterRejection(): Promise<boolean> {
    const now = Date.now();
    if (now - lastForcedRefresh < FORCED_REFRESH_SPACING_MS) return isPremiumActive();
    lastForcedRefresh = now;
    await refreshTicket();
    return isPremiumActive();
}

export function initTubeAccess(): void {
    if (initialized) return;
    initialized = true;
    if (readToken()) {
        state = { ...state, linked: true, user: readCachedUser() };
        refreshTicket().catch(() => {});
    } else {
        state = { ...state, checked: true };
    }
}

function stopPolling(): void {
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
    deviceCode = null;
}

export function cancelLink(): void {
    linkSession++;
    stopPolling();
    link = idleLink();
    emit();
}

export async function startLink(): Promise<void> {
    const session = ++linkSession;
    stopPolling();
    unlinkUnconfirmed = false;
    link = { ...idleLink(), phase: 'starting' };
    emit();

    let result: ApiResult;
    try {
        result = await api('link_start', { method: 'POST', body: { label: deviceLabel() } });
    } catch (e) {
        if (session !== linkSession) return;
        link = { ...idleLink(), phase: 'error', error: 'Could not reach the link service. Check your connection and try again.' };
        emit();
        return;
    }
    if (session !== linkSession) return;

    const d = result.data;
    if (result.status === 429) {
        link = { ...idleLink(), phase: 'error', error: 'Too many link attempts. Wait a few minutes and try again.' };
        emit();
        return;
    }
    const valid = result.status === 200 && !!d
        && typeof d.device_code === 'string' && DEVICE_CODE_RE.test(d.device_code)
        && typeof d.user_code === 'string' && USER_CODE_RE.test(d.user_code);
    if (!valid) {
        link = { ...idleLink(), phase: 'error', error: 'The link service returned an unexpected response.' };
        emit();
        return;
    }

    const expiresIn = typeof d.expires_in === 'number' && isFinite(d.expires_in) && d.expires_in > 0
        ? Math.min(d.expires_in, MAX_LINK_LIFETIME_S)
        : 600;
    const intervalS = typeof d.interval === 'number' && isFinite(d.interval) ? d.interval : 3;
    const interval = Math.min(Math.max(intervalS * 1000, MIN_POLL_MS), MAX_POLL_MS);
    const complete = trustedLinkUrl(d.verify_url_complete) || `${PREMIUM_INFO_URL}?code=${encodeURIComponent(d.user_code)}`;

    deviceCode = d.device_code;
    link = {
        phase: 'waiting',
        userCode: d.user_code,
        verifyUrlComplete: complete,
        expiresAt: Date.now() + expiresIn * 1000,
        error: null,
        unlinkUnconfirmed: false,
    };
    emit();
    schedulePoll(session, interval);
}

function schedulePoll(session: number, delay: number): void {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => {
        pollTimer = null;
        pollLink(session, delay).catch(() => {});
    }, delay);
}

async function pollLink(session: number, interval: number): Promise<void> {
    if (session !== linkSession || !deviceCode) return;
    if (Date.now() >= link.expiresAt) {
        stopPolling();
        link = { ...link, phase: 'expired' };
        emit();
        return;
    }

    let result: ApiResult;
    try {
        result = await api('link_poll', { method: 'POST', body: { device_code: deviceCode } });
    } catch (e) {
        if (session === linkSession) schedulePoll(session, interval);
        return;
    }
    if (session !== linkSession) return;

    const d = result.data;
    if (result.status === 429) {
        schedulePoll(session, Math.min(interval * 2, MAX_POLL_MS));
        return;
    }
    if (result.status !== 200 || !d) {
        schedulePoll(session, interval);
        return;
    }

    if (d.status === 'linked' && typeof d.token === 'string' && TOKEN_RE.test(d.token)) {
        stopPolling();
        storeSet(TOKEN_KEY, d.token);
        const user = parseUser(d.user);
        if (user) storeSet(USER_KEY, JSON.stringify(user));
        link = idleLink();
        state = { ...state, linked: true, user, checked: false, error: null };
        debug('video quality: device linked');
        emit();
        await refreshTicket();
        return;
    }
    if (d.status === 'expired') {
        stopPolling();
        link = { ...link, phase: 'expired' };
        emit();
        return;
    }
    schedulePoll(session, interval);
}

export async function unlinkDevice(): Promise<void> {
    cancelLink();
    const token = readToken();
    let confirmed = !token;
    if (token) {
        try {
            const result = await api('unlink', { method: 'POST', auth: token });
            confirmed = result.status === 200 || result.status === 401;
        } catch (e) {
            confirmed = false;
        }
    }
    clearToken();
    unlinkUnconfirmed = !confirmed;
    debug('video quality: device unlinked', confirmed ? '' : '(server not reached)');
    emit();
}

export function openExternal(url: string): void {
    if (!isTrustedExternal(url)) return;
    try {
        window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {}
}
