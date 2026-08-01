import { storage } from './storage';
import { warn, error as logError } from './debug';
import { displayModal, hideModal } from './modal';

declare const __VERSION__: string;

const getLoadedVersion = (): string => {
    const metadata = (window as any)._spicy_themes_metadata;
    if (metadata?.LoadedVersion) {
        return metadata.LoadedVersion;
    }
    return typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0';
};

const CURRENT_VERSION = getLoadedVersion();
const GITHUB_REPO = '7xeh/SpicyThemes';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

const UPDATE_API_URL = 'https://7xeh.dev/apps/spicythemes/api/version.php';

function getDevChannelParams(): string {
    const devKey = storage.get('dev-channel');
    if (devKey) {
        return '&channel=dev';
    }
    return '';
}

function getDevChannelHeaders(): Record<string, string> {
    const devKey = storage.get('dev-channel');
    if (devKey) {
        return { 'X-Dev-Channel-Key': devKey };
    }
    return {};
}

export function isDevChannel(): boolean {
    return !!storage.get('dev-channel');
}

interface VersionInfo {
    major: number;
    minor: number;
    patch: number;
    text: string;
}

interface GitHubRelease {
    tag_name: string;
    name: string;
    html_url: string;
    body: string;
    published_at: string;
    assets: GitHubAsset[];
}

interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
}

interface UpdateState {
    isUpdating: boolean;
    progress: number;
    status: string;
}

const updateState: UpdateState = {
    isUpdating: false,
    progress: 0,
    status: ''
};

let notifiedVersion: string | null = null;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const SCHEDULE_JITTER_MS = 2 * 60 * 1000;

let currentCheckIntervalMs = DEFAULT_CHECK_INTERVAL_MS;
let currentBackoffMs = 0;
let checkTimer: number | null = null;
let checkInProgress = false;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function getScheduledDelay(baseMs: number): number {
    const normalizedBase = Math.max(MIN_CHECK_INTERVAL_MS, baseMs);
    const jitter = Math.floor(Math.random() * SCHEDULE_JITTER_MS);
    return normalizedBase + jitter + currentBackoffMs;
}

function scheduleNextCheck(forceDelayMs?: number): void {
    if (checkTimer !== null) {
        window.clearTimeout(checkTimer);
    }
    const delay = typeof forceDelayMs === 'number' ? Math.max(1000, forceDelayMs) : getScheduledDelay(currentCheckIntervalMs);
    checkTimer = window.setTimeout(() => {
        checkForUpdates();
    }, delay);
}

function increaseBackoff(): void {
    currentBackoffMs = currentBackoffMs === 0
        ? 5 * 60 * 1000
        : Math.min(MAX_BACKOFF_MS, currentBackoffMs * 2);
}

function resetBackoff(): void {
    currentBackoffMs = 0;
}

function parseVersion(version: string): VersionInfo | null {
    const cleanVersion = String(version || '').trim().replace(/^v/i, '');
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        text: cleanVersion
    };
}

function compareVersions(v1: VersionInfo, v2: VersionInfo): number {
    if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
    if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
    if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
    return 0;
}

export function getCurrentVersion(): VersionInfo {
    return parseVersion(CURRENT_VERSION) || { major: 1, minor: 0, patch: 0, text: CURRENT_VERSION };
}

export function getContentHash(): string {
    try {
        const metadata = (window as any)._spicy_themes_metadata;
        const hash = metadata?.ContentHash;
        if (typeof hash === 'string' && hash.length > 0) return hash;
    } catch {}
    return '';
}

export function getContentHashShort(length: number = 8): string {
    const hash = getContentHash();
    return hash ? hash.substring(0, length) : '';
}

type LatestVersionResult = { version: VersionInfo; release: GitHubRelease; downloadUrl: string };

async function getLatestVersionFromPrimaryApi(): Promise<LatestVersionResult> {
    const url = `${UPDATE_API_URL}?action=version${getDevChannelParams()}&_=${Date.now()}`;
    const response = await fetchWithTimeout(url, { headers: getDevChannelHeaders() });
    if (!response.ok) throw new Error(`Primary API status ${response.status}`);

    const data = await response.json();
    const version = parseVersion(String(data?.version ?? ''));
    if (!version) throw new Error('Primary API did not return a valid version');

    const downloadUrl = typeof data?.download_url === 'string' ? data.download_url : '';
    return {
        version,
        release: {
            tag_name: `v${version.text}`,
            name: `v${version.text}`,
            html_url: typeof data?.release_notes_url === 'string' && data.release_notes_url ? data.release_notes_url : RELEASES_URL,
            body: typeof data?.changelog === 'string' ? data.changelog : '',
            published_at: typeof data?.published_at === 'string' ? data.published_at : new Date().toISOString(),
            assets: downloadUrl
                ? [{ name: 'spicy-themes.js', browser_download_url: downloadUrl, size: 0, download_count: 0 }]
                : []
        },
        downloadUrl
    };
}

async function getLatestVersionFromGitHub(): Promise<LatestVersionResult> {
    const response = await fetchWithTimeout(`${GITHUB_API_URL}?_=${Date.now()}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!response.ok) throw new Error(`GitHub API status ${response.status}`);

    const release: GitHubRelease = await response.json();
    const version = parseVersion(String(release?.tag_name ?? ''));
    if (!version) throw new Error('GitHub API did not return a valid release tag');

    const jsAsset = Array.isArray(release.assets)
        ? release.assets.find(a => typeof a?.name === 'string' && a.name.endsWith('.js'))
        : null;
    return { version, release, downloadUrl: jsAsset?.browser_download_url || '' };
}

export async function getLatestVersion(): Promise<LatestVersionResult | null> {
    try {
        return await getLatestVersionFromPrimaryApi();
    } catch (primaryError) {
        warn('Primary version API unavailable, falling back to GitHub:', primaryError);
    }

    try {
        return await getLatestVersionFromGitHub();
    } catch (githubError) {
        logError('Error fetching latest version:', githubError);
        return null;
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function processInlineMarkdown(text: string): string {
    const sanitizeUrl = (url: string): string => {
        const trimmed = url.trim();
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return '';
    };
    return text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, url: string) => {
            const safe = sanitizeUrl(url);
            return safe ? `<img src="${safe}" alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 4px 0;">` : alt;
        })
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text: string, url: string) => {
            const safe = sanitizeUrl(url);
            return safe ? `<a href="${safe}" style="color: #1db954; text-decoration: none;" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
        })
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<![*\w])\*([^*]+?)\*(?![*\w])/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 12px; color: #1db954;">$1</code>');
}

function formatReleaseNotes(body: string): string {
    if (!body || body.trim() === '') {
        return '<span style="color: var(--spice-subtext); font-style: italic;">No changelog available for this release.</span>';
    }

    const lines = body.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
        if (inUl) { output.push('</ul>'); inUl = false; }
        if (inOl) { output.push('</ol>'); inOl = false; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Fira Code','Consolas',monospace; font-size: 12px; color: var(--spice-subtext); margin: 8px 0; white-space: pre-wrap; word-break: break-word;"><code>${codeContent.join('\n')}</code></pre>`);
                codeContent = [];
                inCodeBlock = false;
            } else {
                closeLists();
                inCodeBlock = true;
            }
            continue;
        }
        if (inCodeBlock) { codeContent.push(escapeHtml(line)); continue; }
        if (line.trim() === '') { closeLists(); output.push('<div style="height: 8px;"></div>'); continue; }

        const h3 = line.match(/^###\s+(.*)/);
        if (h3) { closeLists(); output.push(`<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: var(--spice-text);">${processInlineMarkdown(h3[1])}</div>`); continue; }
        const h2 = line.match(/^##\s+(.*)/);
        if (h2) { closeLists(); output.push(`<div style="font-weight: 600; font-size: 14px; margin-top: 14px; margin-bottom: 8px; color: var(--spice-text);">${processInlineMarkdown(h2[1])}</div>`); continue; }
        const h1 = line.match(/^#\s+(.*)/);
        if (h1) { closeLists(); output.push(`<div style="font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 10px; color: var(--spice-text);">${processInlineMarkdown(h1[1])}</div>`); continue; }

        if (line.match(/^(---+|===+|\*\*\*+)\s*$/)) {
            closeLists();
            output.push('<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;">');
            continue;
        }
        const bq = line.match(/^>\s?(.*)/);
        if (bq) { closeLists(); output.push(`<div style="border-left: 3px solid #1db954; padding-left: 12px; margin: 6px 0; color: var(--spice-subtext); font-style: italic;">${processInlineMarkdown(bq[1])}</div>`); continue; }

        const ul = line.match(/^\s*[-*+]\s+(.*)/);
        if (ul) {
            if (inOl) { output.push('</ol>'); inOl = false; }
            if (!inUl) { output.push('<ul style="margin: 4px 0; padding-left: 0; list-style: none;">'); inUl = true; }
            output.push(`<li style="display: flex; gap: 8px; margin: 4px 0;"><span style="color: var(--st-cl-accent, #1db954);">\u2022</span><span>${processInlineMarkdown(ul[1])}</span></li>`);
            continue;
        }
        const ol = line.match(/^\s*(\d+)\.\s+(.*)/);
        if (ol) {
            if (inUl) { output.push('</ul>'); inUl = false; }
            if (!inOl) { output.push('<ol style="margin: 4px 0; padding-left: 20px; color: var(--spice-subtext);">'); inOl = true; }
            output.push(`<li style="margin: 4px 0;">${processInlineMarkdown(ol[2])}</li>`);
            continue;
        }

        closeLists();
        output.push(`<p style="margin: 4px 0; color: var(--spice-subtext);">${processInlineMarkdown(line)}</p>`);
    }

    closeLists();
    if (inCodeBlock) {
        output.push(`<pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; color: var(--spice-subtext); margin: 8px 0;"><code>${codeContent.join('\n')}</code></pre>`);
    }
    return output.join('');
}

export async function checkForUpdates(force: boolean = false): Promise<void> {
    const now = Date.now();
    if (checkInProgress) return;
    if (!force && now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
        scheduleNextCheck(MIN_CHECK_INTERVAL_MS - (now - lastCheckTime));
        return;
    }
    if (!force && document.hidden) { scheduleNextCheck(); return; }
    if (!force && navigator.onLine === false) { increaseBackoff(); scheduleNextCheck(); return; }

    lastCheckTime = now;
    checkInProgress = true;

    try {
        const latest = await getLatestVersion();
        if (!latest) { increaseBackoff(); return; }

        resetBackoff();
        const current = getCurrentVersion();
        if (compareVersions(latest.version, current) > 0) {
            if (notifiedVersion !== latest.version.text) {
                notifiedVersion = latest.version.text;
                if (Spicetify.showNotification) {
                    Spicetify.showNotification(`SpicyThemes v${latest.version.text} available! Restart Spotify to update.`, false, 10000);
                }
                storage.set('pending-update-version', latest.version.text);
                storage.set('pending-update-timestamp', Date.now().toString());
                if (latest.release.body) {
                    storage.set('pending-update-changelog', latest.release.body);
                }
            }
        } else {
            notifiedVersion = null;
        }
    } catch (error) {
        increaseBackoff();
        logError('Error checking for updates:', error);
    } finally {
        checkInProgress = false;
        if (!updateState.isUpdating) {
            scheduleNextCheck();
        }
    }
}

export function startUpdateChecker(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
    currentCheckIntervalMs = Math.max(MIN_CHECK_INTERVAL_MS, intervalMs);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const elapsed = Date.now() - lastCheckTime;
            if (elapsed >= MIN_CHECK_INTERVAL_MS && !checkInProgress && !updateState.isUpdating) {
                checkForUpdates();
            }
        }
    });

    window.addEventListener('online', () => {
        if (!checkInProgress && !updateState.isUpdating) {
            resetBackoff();
            checkForUpdates();
        }
    });

    scheduleNextCheck(5000);
}

export async function getUpdateInfo(): Promise<{
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string | null;
    releaseUrl: string | null;
} | null> {
    try {
        const current = getCurrentVersion();
        const latest = await getLatestVersion();
        if (!latest) {
            return { hasUpdate: false, currentVersion: current.text, latestVersion: null, releaseUrl: null };
        }
        return {
            hasUpdate: compareVersions(latest.version, current) > 0,
            currentVersion: current.text,
            latestVersion: latest.version.text,
            releaseUrl: latest.release.html_url
        };
    } catch {
        return null;
    }
}

interface ChangelogModalOptions {
    isHotfix?: boolean;
    hashShort?: string;
}

function showChangelogModal(version: string, changelog: string, options: ChangelogModalOptions = {}): void {
    const { isHotfix = false, hashShort = '' } = options;
    const heroIcon = isHotfix ? '🔧' : '✨';
    const heroTitle = isHotfix ? 'Hotfix Applied' : 'Updated Successfully';
    const heroSubtitle = isHotfix
        ? "Here's what's new in the hotfix"
        : "Here's what's new in this release";
    const accentVar = isHotfix
        ? '--st-cl-accent: #ffb74d; --st-cl-accent-rgb: 255, 183, 77; --st-cl-accent-alt: #ff9800;'
        : '--st-cl-accent: #1ed760; --st-cl-accent-rgb: 30, 215, 96; --st-cl-accent-alt: #1db954;';
    const content = document.createElement('div');
    content.className = 'st-changelog-modal' + (isHotfix ? ' st-changelog-hotfix' : '');
    content.setAttribute('style', accentVar);
    content.innerHTML = `
        <style>
            @keyframes st-cl-fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .st-changelog-modal {
                padding: 2px;
                color: var(--spice-text);
                animation: st-cl-fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .st-changelog-modal .changelog-hero {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 20px;
                padding: 16px 18px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.12) 0%, rgba(99, 102, 241, 0.08) 100%);
                border: 1px solid rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.18);
                position: relative;
                overflow: hidden;
            }
            .st-changelog-modal .changelog-hero::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.4), transparent);
            }
            .st-changelog-modal .changelog-hero-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: linear-gradient(135deg, var(--st-cl-accent-alt, #1db954), var(--st-cl-accent, #1ed760));
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.25);
            }
            .st-changelog-modal .changelog-hero-text {
                flex: 1;
            }
            .st-changelog-modal .changelog-hero-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--spice-text);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .st-changelog-modal .changelog-badge {
                background: linear-gradient(135deg, var(--st-cl-accent-alt, #1db954), var(--st-cl-accent, #1ed760));
                color: #000;
                padding: 3px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 800;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                letter-spacing: 0.3px;
                box-shadow: 0 2px 8px rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.2);
            }
            .st-changelog-modal .changelog-hash {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-subtext);
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 600;
                font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                letter-spacing: 0.3px;
                margin-left: 6px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .st-changelog-modal .changelog-hero-subtitle {
                font-size: 12px;
                color: var(--spice-subtext);
                margin-top: 3px;
            }
            .st-changelog-modal .changelog-content {
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                padding: 16px 18px;
                border-radius: 10px;
                margin-bottom: 18px;
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid rgba(255, 255, 255, 0.06);
                font-size: 13px;
                line-height: 1.65;
                color: var(--spice-subtext);
            }
            .st-changelog-modal .changelog-content::-webkit-scrollbar { width: 5px; }
            .st-changelog-modal .changelog-content::-webkit-scrollbar-track { background: transparent; }
            .st-changelog-modal .changelog-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
            .st-changelog-modal .changelog-content::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
            .st-changelog-modal .changelog-content a {
                color: var(--st-cl-accent, #1ed760);
                text-decoration: none;
                border-bottom: 1px solid rgba(var(--st-cl-accent-rgb, 30, 215, 96), 0.3);
                transition: border-color 0.2s;
            }
            .st-changelog-modal .changelog-content a:hover { border-color: var(--st-cl-accent, #1ed760); }
            .st-changelog-modal .changelog-content img {
                max-width: 100%;
                border-radius: 8px;
                margin: 8px 0;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .st-changelog-modal .changelog-content strong { color: var(--spice-text); }
            .st-changelog-modal .changelog-content del { opacity: 0.5; }
            .st-changelog-modal .changelog-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .st-changelog-modal .changelog-btn {
                padding: 10px 24px;
                border-radius: 24px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.2px;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }
            .st-changelog-modal .changelog-btn::after {
                content: '';
                position: absolute;
                inset: 0;
                opacity: 0;
                background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%);
                transition: opacity 0.3s;
            }
            .st-changelog-modal .changelog-btn:hover::after { opacity: 1; }
            .st-changelog-modal .changelog-btn.primary {
                background: linear-gradient(135deg, var(--st-cl-accent-alt, #1db954), var(--st-cl-accent, #1ed760));
                color: #000;
                box-shadow: 0 2px 12px rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.25);
            }
            .st-changelog-modal .changelog-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 20px rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.35);
            }
            .st-changelog-modal .changelog-btn.primary:active {
                transform: translateY(0);
                box-shadow: 0 1px 6px rgba(var(--st-cl-accent-rgb, 29, 185, 84), 0.2);
            }
            .st-changelog-modal .changelog-btn.secondary {
                background: rgba(255, 255, 255, 0.06);
                color: var(--spice-text);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .st-changelog-modal .changelog-btn.secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.14);
            }
        </style>
        <div class="changelog-hero">
            <div class="changelog-hero-icon">${heroIcon}</div>
            <div class="changelog-hero-text">
                <div class="changelog-hero-title">
                    ${heroTitle}
                    <span class="changelog-badge">v${version}</span>
                    ${hashShort ? `<span class="changelog-hash">${hashShort}</span>` : ''}
                </div>
                <div class="changelog-hero-subtitle">${heroSubtitle}</div>
            </div>
        </div>
        <div class="changelog-content">${formatReleaseNotes(changelog)}</div>
        <div class="changelog-buttons">
            <a href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                <button class="changelog-btn secondary" type="button">View on GitHub</button>
            </a>
            <button class="changelog-btn primary" id="st-changelog-dismiss">Got it</button>
        </div>
    `;

    displayModal({
        title: 'Spicy Themes',
        content: content,
        isLarge: true
    });
    setTimeout(() => {
        const dismissBtn = document.getElementById('st-changelog-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => hideModal());
        }
    }, 100);
}

async function fetchChangelogForVersion(version: string): Promise<string> {
    try {
        const tagUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`;
        const response = await fetchWithTimeout(tagUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
    }

    try {
        const response = await fetchWithTimeout(GITHUB_API_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.ok) {
            const release: GitHubRelease = await response.json();
            if (release.body) return release.body;
        }
    } catch (e) {
    }

    return '';
}

export async function showPostUpdateChangelog(): Promise<void> {
    const currentVersion = CURRENT_VERSION;
    const currentHash = getContentHash();
    let targetVersion: string | null = null;
    let changelog: string | null = null;

    const persistKnown = (): void => {
        storage.set('last-known-version', currentVersion);
        if (currentHash) storage.set('last-known-hash', currentHash);
    };

    const showHotfix = async (): Promise<void> => {
        persistKnown();
        await new Promise(r => setTimeout(r, 2000));
        const hashShort = getContentHashShort();
        const hotfixChangelog = await fetchChangelogForVersion(currentVersion);
        showChangelogModal(currentVersion, hotfixChangelog || '', { isHotfix: true, hashShort });
    };

    const hotfixDetected = storage.get('hotfix-detected');
    if (hotfixDetected) {
        storage.remove('hotfix-detected');
        await showHotfix();
        return;
    }

    const pendingVersion = storage.get('pending-update-version');
    if (pendingVersion) {
        const pendingTimestamp = storage.get('pending-update-timestamp');
        storage.remove('pending-update-version');
        storage.remove('pending-update-timestamp');

        if (pendingTimestamp) {
            const elapsed = Date.now() - parseInt(pendingTimestamp, 10);
            if (elapsed > 60 * 60 * 1000) {
                storage.remove('pending-update-changelog');
                persistKnown();
                return;
            }
        }

        changelog = storage.get('pending-update-changelog');
        storage.remove('pending-update-changelog');
        targetVersion = pendingVersion;
    } else {
        const lastKnownVersion = storage.get('last-known-version');
        const lastKnownHash = storage.get('last-known-hash');

        if (!lastKnownVersion) {
            persistKnown();
            return;
        }

        if (lastKnownVersion !== currentVersion) {
            const lastParsed = parseVersion(lastKnownVersion);
            const currentParsed = parseVersion(currentVersion);
            if (lastParsed && currentParsed && compareVersions(currentParsed, lastParsed) > 0) {
                targetVersion = currentVersion;
            }
        } else if (currentHash && lastKnownHash && lastKnownHash !== currentHash) {
            await showHotfix();
            return;
        }
    }

    persistKnown();
    if (!targetVersion) return;

    if (!changelog) {
        changelog = await fetchChangelogForVersion(targetVersion);
    }

    await new Promise(r => setTimeout(r, 2000));
    showChangelogModal(targetVersion, changelog || '');
}

export async function showCurrentChangelog(): Promise<void> {
    const changelog = await fetchChangelogForVersion(CURRENT_VERSION);
    const hashShort = getContentHashShort();
    showChangelogModal(CURRENT_VERSION, changelog, { hashShort });
}

export const VERSION = CURRENT_VERSION;
export const REPO_URL = RELEASES_URL;
